# Encrypted local storage

The local vault uses AES-256-GCM with a fresh 12-byte random nonce and 16-byte
authentication tag on every save. `BACOMV01` identifies the format and is also
authenticated. The plaintext is versioned JSON using a source-generated serializer
for Native AOT. Keys and temporary plaintext byte buffers are zeroed after use;
managed strings holding unlocked data cannot be reliably erased by .NET.

The random 32-byte key lives in macOS login Keychain under service `Bacom.Vault.v1`,
account `vault-key`. Its initial trusted-app list is empty, requesting Keychain
approval when accessed. If the user selects Always Allow, Keychain can remember
that choice. This is Keychain authorization, not a guarantee of Touch ID at each
unlock. Login Keychain works for unsigned local development; the newer data
protection Keychain requires an app signing/provisioning setup this project does
not have.

`VaultKey` selects the provider for both unlock and locked-screen recovery:

- Windows stores a 32-byte generic credential at `Bacom.Vault.v1/vault-key` using
  Credential Manager, persistent for the current user on the current computer.
  It relies on the Windows logon session; it does not request Windows Hello or
  protect against another process already running as that user.
- Linux uses libsecret (`libsecret-1.so.0`) with a Secret Service desktop keyring,
  attributes `service=Bacom.Vault.v1` and `account=vault-key`. GNOME Keyring and
  compatible KDE Wallet configurations can provide this service. The provider
  may prompt when its keyring is locked; an already unlocked keyring can return
  the key without another prompt. Native requests time out after two minutes.
  Missing libsecret, unavailable service, cancellation and invalid keys are
  reported without falling back to a plaintext file. Before creating a key, a
  separate locked-item search prevents a dismissed prompt from replacing it.

A file lock serializes key lookup and creation across Bacom instances. Missing
keys are only created for a new vault or explicitly confirmed backup recovery;
malformed stored keys and backend failures never trigger replacement. Password
backups remain portable across all three platforms.

The vault is `Bacom/vault.bacom` beneath .NET's LocalApplicationData directory.
An exclusive file lock prevents two unlocked app sessions from overwriting each
other. Saves flush an encrypted temporary file in the same directory, then rename
it over the vault. A `.previous` encrypted version is retained before replacement.
Unix files are created owner-readable/writable only. A malformed or incompatible
vault is rejected, never silently reset. The maximum encrypted file size is 32 MB.

Unlock creates an empty encrypted vault only when no vault exists. Existing vaults
must decrypt successfully before the dashboard opens. The old external auth helper
and debug bypass are removed. Create, Apply, Delete, and Used toggles commit before
the visible state changes; a failed save retains the form or rolls back the toggle.
Lock and window close dispose the session key, release the file lock, clear entry
collections and dispose images. Demo entries are only used by the designer/checks.

`sh checks/vault.sh` tests encryption, tampering, wrong keys, validation, reopening,
file locking, interrupted/failed saves and the previous version with disposable
test keys. It never accesses the user's Keychain. Native Keychain approval needs
an interactive desktop check; automated tests cannot approve that prompt.

References: [AES-GCM](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm),
[Keychain ACLs](https://developer.apple.com/documentation/security/secaccesscreate(_:_:_:)),
[Mac Keychain implementations](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains).

## Password backups and recovery

Choose **Vault → Backup and restore** to export or restore `.bacombackup` files.
The locked screen also offers restore. Export requires a confirmed password of
12–1,024 characters; the password is never saved. PBKDF2-HMAC-SHA256 with 600,000
iterations and a fresh 16-byte salt derives a separate 256-bit encryption key.
The `BACOMB01` version fixes these parameters. The remaining payload uses the same
authenticated encryption as the local vault; changing the salt causes decryption
to fail. This backup is independent of the original computer's credential store.

Restore checks the password, authentication tag, schema, IDs, field sizes and PNG
images before showing an account-count preview. Explicit replacement confirmation
is required. Before replacing, the original encrypted local file is preserved as
`.before-restore-<unique ID>`, even if damaged. Restored data is encrypted with the
current device's key. If no device key exists, the locked-screen restore can create
one only after the backup has been verified and replacement confirmed. Restore
never merges lists or silently resets a damaged file. Keep backup passwords safe:
neither Bacom nor the device key can decrypt a backup without its password.

The automated checks cover wrong passwords, modified/truncated backups, exact
round trips, invalid images, restore with a fresh key, retained old files, failed
restore, weak export passwords and UI replacement confirmation. They use only
generated fixtures and temporary paths, not real account data. Native dialogs
remain a manual check: unlock/deny/retry Keychain, export with the OS picker, lock,
then restore the exported file and confirm the expected accounts appear.

KDF reference: [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Native platform verification

`dotnet run --project checks/platform-keys/PlatformChecks.csproj -- --native`
uses a unique disposable credential on Windows/Linux, verifying missing-key
failure, creation, repeated retrieval without replacement, and cleanup. Run it
inside a desktop user session with a configured keyring. Without `--native`, or
on macOS, it reports SKIP and touches no credentials. Compilation and existing
vault/UI checks run on the development Mac; they do not verify Windows/Linux
native dialogs. Test denied/cancelled keyring prompts interactively on Linux.

Provider references: [Windows credentials](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw),
[libsecret storage](https://gnome.pages.gitlab.gnome.org/libsecret/func.password_storev_sync.html),
[Secret Service locking](https://specifications.freedesktop.org/secret-service/latest/unlocking.html).
