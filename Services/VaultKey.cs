using System;
using System.IO;
using System.Security.Cryptography;

namespace bacom.Services;

public static class VaultKey
{
    public static string UnlockHint => OperatingSystem.IsWindows()
        ? "Unlocking with your Windows user account…"
        : OperatingSystem.IsLinux() ? "Unlocking your desktop keyring. Approve its prompt if shown."
        : "Approve the macOS Keychain prompt to unlock your vault.";

    public static byte[] Unlock(bool allowCreate)
    {
        // Serialize key lookup/creation across app instances, including backup recovery.
        var path = VaultStore.DefaultPath + ".key.lock";
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var keyLock = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        if (OperatingSystem.IsMacOS()) return MacVaultKey.Unlock(allowCreate);
        if (OperatingSystem.IsWindows()) return WindowsVaultKey.Unlock(allowCreate);
        if (OperatingSystem.IsLinux())
        {
            try { return LinuxVaultKey.Unlock(allowCreate); }
            catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException)
            { throw new VaultKeyException("Install libsecret and enable a Secret Service keyring (such as GNOME Keyring), then try again."); }
        }
        throw new PlatformNotSupportedException("Vault unlocking supports macOS, Windows and Linux.");
    }
}

// Only fixed, user-safe messages are exposed by native providers; never raw secret-service output.
public sealed class VaultKeyException(string message) : CryptographicException(message);
