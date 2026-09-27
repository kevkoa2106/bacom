using System;
using System.IO;
using System.Security.Cryptography;
using bacom.Models;

namespace bacom.Services;

public static class VaultBackup
{
    private static ReadOnlySpan<byte> Header => "BACOMB01"u8;
    private const int Iterations = 600000;

    // Recovery: independent of the device key. Each export gets a new salt and nonce.
    public static byte[] Export(VaultData data, string password)
    {
        if (password.Length is < 12 or > 1024)
            throw new ArgumentException("Choose a backup password with 12–1,024 characters.");
        var salt = RandomNumberGenerator.GetBytes(16);
        var key = Derive(password, salt);
        try
        {
            var encrypted = VaultCodec.Encrypt(data, key);
            if (encrypted.Length > VaultCodec.MaxBytes - 24) throw new InvalidDataException("The backup exceeds 32 MB.");
            var output = new byte[24 + encrypted.Length];
            Header.CopyTo(output); salt.CopyTo(output, 8); encrypted.CopyTo(output, 24);
            return output;
        }
        finally { CryptographicOperations.ZeroMemory(key); }
    }

    public static VaultData Import(byte[] bytes, string password)
    {
        if (bytes.Length < 60 || bytes.Length > VaultCodec.MaxBytes || !bytes.AsSpan(0, 8).SequenceEqual(Header))
            throw new InvalidDataException("Choose a Bacom password-protected backup (.bacombackup).");
        if (password.Length > 1024) throw new ArgumentException("The backup password is too long.");
        var key = Derive(password, bytes.AsSpan(8, 16));
        try { return VaultCodec.Decrypt(bytes[24..], key); }
        finally { CryptographicOperations.ZeroMemory(key); }
    }

    private static byte[] Derive(string password, ReadOnlySpan<byte> salt) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
}
