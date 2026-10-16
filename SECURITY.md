# Bacom security design

## What is protected

Account metadata, recovery codes, and used flags are JSON-serialized and encrypted together with AES-256-GCM. Each save uses a fresh 96-bit random nonce and a 128-bit authentication tag. A random 32-byte salt feeds the password KDF. The version/cipher/KDF/salt/password-verifier header is authenticated as additional data. The file exposes format information and a salted password verifier, but no account summaries or codes.

Bcrypt is a one-way password hash; it cannot encrypt or decrypt recovery codes. Bacom retains the requested bcrypt password verifier at cost 12 and derives the separate encryption key using Node's scrypt. Passwords are bounded to 12 characters minimum and 72 UTF-8 bytes maximum, preventing bcrypt's silent truncation.

Current envelopes use version 2 and scrypt N=131072, r=8, p=1, with a 256 MiB implementation memory ceiling. Legacy development version 1 files retain N=32768, r=8, p=1 when read or saved. Version-specific fixed parameters prevent an untrusted file from requesting arbitrary KDF work. The payload schema is separately versioned. These choices use [Node's authenticated encryption and scrypt APIs](https://nodejs.org/api/crypto.html) and the current [OWASP scrypt guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).

The plaintext password is not stored. The key is retained in the main process while unlocked and zeroed on lock. Code strings and temporary JavaScript strings are garbage-collected; JavaScript does not offer reliable zeroization of every copy. The app decrypts the full vault to support browsing and imports while unlocked; each individual reveal additionally verifies the password. It does not decrypt anew for every reveal.

## Optional device unlock

Touch ID enrollment is off by default and requires both a master-password check and a successful native biometric prompt. An enrollment secret contains the vault key and its salt/verifier binding, never the master password. The main process encrypts it using Electron's asynchronous `safeStorage` and atomically saves only ciphertext in a private, bounded `device-auth.json` sidecar. It never sends the secret to React, localStorage, or exported backups. A restored/replaced vault with a different binding rejects the key; users can fall back to their master password and enroll again.

Unlock first authenticates with macOS Touch ID, then decrypts the OS-protected secret and authenticates the vault with AES-GCM. Cancellation, unsupported hardware, unavailable protected storage, malformed credentials, and locking during an in-flight operation fail closed. Merely checking availability does not call Keychain encryption or open an OS prompt. Disabling enrollment requires the master password and removes only the sidecar.

Touch ID verification and OS key encryption are separate protections. This implementation gates access in the main process; it does not create a native Keychain access-control item that cryptographically requires biometric presence. A modified app or malicious same-user process is outside its threat boundary. Electron documents this distinction in [systemPreferences](https://www.electronjs.org/docs/latest/api/system-preferences#systempreferencesprompttouchidreason-macos) and the platform semantics in [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). Consistent macOS code signing is required for stable Keychain identity across app updates. No biometric data is collected by Bacom. Windows Hello is deliberately unavailable in this macOS-first release.

## Boundaries and consistency

Electron owns file access, cryptography, clipboard, and dialogs. Its renderer uses context isolation, sandboxing, disabled Node integration, denied permissions, restricted navigation/popups/downloads, and a method-specific preload bridge. Every IPC request validates its sender and inputs. Production has a restrictive CSP injected into the built HTML and blocks network requests. The configuration follows [Electron's security recommendations](https://www.electronjs.org/docs/latest/tutorial/security/).

The renderer receives account counts without codes. Codes enter renderer memory only during an import preview or one explicit reveal. Reveals use random single-session tokens; copying expires after 60 seconds, while explicit usage confirmation remains possible until dismissal, replacement, or lock. Lock invalidates pending authentication work and reveal tokens. UI cleanup removes passwords, preview codes, and revealed values on close/lock. A missing desktop bridge fails closed.

Mutations are serialized. Saves write a new encrypted file with mode 0600, sync it, then atomically rename it over the prior file. Creation is exclusive and cannot overwrite an existing vault. Save failures preserve the prior in-memory state; a file-system failure at the final replacement boundary may still require reopening the app to reconcile state. Mode bits apply on POSIX systems; Windows permissions depend on the containing directory's ACL. Single-instance enforcement protects the normal app path; external tools can still alter the vault file.

## Limits

This is a local MVP, not a security certification or independently audited password manager. It protects a copied vault file from disclosure without its password and detects authenticated-data tampering. With device unlock enabled, access to the OS-protected enrollment secret is an additional route to the vault key. It cannot protect an unlocked device from malware, keyloggers, screenshots, process-memory inspection, clipboard history, or a malicious same-user process. There is no hardware-enforced biometric key release, automatic distribution/update pipeline, cloud synchronization, rollback protection, or master-password recovery.

Encrypted files and backups permit offline password guessing. A long, unique master password matters. In-app restore requires an explicit replacement confirmation, validates the selected backup and its password before atomically replacing the vault, and re-encrypts the imported data with the current KDF settings. Restoring an older backup can restore codes already used; the app cannot query websites to detect that. Touch ID enrollment is removed on restore because its unlock key is bound to the replaced vault. If OS storage prevents removing the old encrypted key, Bacom warns the user; the binding prevents that key from unlocking the restored vault. Bacom never removes the original downloaded plaintext files. Manage those files and backups separately.

The selected auto-lock delay is stored separately as a bounded, non-secret local preference. The Electron main process enforces the timeout and continues to lock immediately on OS lock and suspend events.

Tests cover wrong passwords, tampering, envelope bounds, nonce freshness, save failures, concurrent imports, expiry/confirmation, and authentication interrupted by lock. Native smoke checks use only the synthetic fixture in `tests/fixtures/` and a disposable repository-local profile.
