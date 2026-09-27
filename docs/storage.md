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
not have. Windows/Linux key providers are not implemented; unsupported platforms
fail closed rather than storing a plaintext key.

The vault is `Bacom/vault.bacom` beneath .NET's LocalApplicationData directory.
An exclusive file lock prevents two unlocked app sessions from overwriting each
other. Saves flush an encrypted temporary file in the same directory, then rename
it over the vault. A `.previous` encrypted version is retained before replacement.
Unix files are created owner-readable/writable only. A malformed or incompatible
vault is rejected, never silently reset. The maximum encrypted file size is 32 MB.

`sh checks/vault.sh` tests encryption, tampering, wrong keys, validation, reopening,
file locking, interrupted/failed saves and the previous version with disposable
test keys. It never accesses the user's Keychain. Native Keychain approval needs
an interactive desktop check; automated tests cannot approve that prompt.

References: [AES-GCM](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm),
[Keychain ACLs](https://developer.apple.com/documentation/security/secaccesscreate(_:_:_:)),
[Mac Keychain implementations](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains).
