using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using bacom.Models;

namespace bacom.Services;

[JsonSerializable(typeof(VaultData))]
[JsonSourceGenerationOptions(GenerationMode = JsonSourceGenerationMode.Metadata)]
internal partial class VaultJsonContext : JsonSerializerContext;

public static class VaultCodec
{
    public const int MaxBytes = 32 * 1024 * 1024;
    private static ReadOnlySpan<byte> Header => "BACOMV01"u8;

    // Encryption: each write has an independent nonce; authenticate the format header too.
    public static byte[] Encrypt(VaultData data, byte[] key)
    {
        Validate(data);
        var plain = JsonSerializer.SerializeToUtf8Bytes(data, VaultJsonContext.Default.VaultData);
        try
        {
            if (plain.Length > MaxBytes - 36) throw new InvalidDataException("The vault exceeds 32 MB.");
            var output = new byte[36 + plain.Length];
            Header.CopyTo(output);
            RandomNumberGenerator.Fill(output.AsSpan(8, 12));
            using var aes = new AesGcm(key, 16);
            aes.Encrypt(output.AsSpan(8, 12), plain, output.AsSpan(36), output.AsSpan(20, 16), Header);
            return output;
        }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }

    public static VaultData Decrypt(byte[] bytes, byte[] key)
    {
        if (bytes.Length < 36 || bytes.Length > MaxBytes || !bytes.AsSpan(0, 8).SequenceEqual(Header))
            throw new InvalidDataException("Unsupported or damaged vault file.");
        var plain = new byte[bytes.Length - 36];
        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(bytes.AsSpan(8, 12), bytes.AsSpan(36), bytes.AsSpan(20, 16), plain, Header);
            var data = JsonSerializer.Deserialize(plain, VaultJsonContext.Default.VaultData)
                ?? throw new InvalidDataException("The vault is empty or damaged.");
            Validate(data);
            return data;
        }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }

    // Validation: reject malformed imports before they can replace a working vault.
    public static void Validate(VaultData data)
    {
        if (data.SchemaVersion != 1 || data.Entries is null || data.Entries.Count > 10000)
            throw new InvalidDataException("Unsupported vault version or account count.");
        var ids = new HashSet<Guid>();
        foreach (var entry in data.Entries)
        {
            if (entry is null || entry.Id == Guid.Empty || !ids.Add(entry.Id)
                || string.IsNullOrWhiteSpace(entry.ServiceName) || entry.ServiceName.Length > 80
                || string.IsNullOrWhiteSpace(entry.AccountLabel) || entry.AccountLabel.Length > 254
                || entry.Notes is null || entry.Notes.Length > 2000 || entry.BackupCodes is null
                || entry.BackupCodes.Count > 1000 || entry.IconPng?.Length > 2 * 1024 * 1024)
                throw new InvalidDataException("Invalid account in vault.");
            if (entry.Website is not null && (entry.Website.Length > 2048
                || !Uri.TryCreate(entry.Website, UriKind.Absolute, out var uri)
                || uri.Scheme is not ("http" or "https")))
                throw new InvalidDataException("Invalid website in vault.");
            if (entry.IconPng is { } png)
            {
                using var imageData = SkiaSharp.SKData.CreateCopy(png);
                using var codec = SkiaSharp.SKCodec.Create(imageData);
                if (codec is null || codec.EncodedFormat != SkiaSharp.SKEncodedImageFormat.Png
                    || codec.Info.Width is < 1 or > 128 || codec.Info.Height is < 1 or > 128)
                    throw new InvalidDataException("Invalid account image in vault.");
                using var image = new SkiaSharp.SKBitmap(codec.Info);
                if (codec.GetPixels(image.Info, image.GetPixels()) != SkiaSharp.SKCodecResult.Success)
                    throw new InvalidDataException("Damaged account image in vault.");
            }
            var values = new HashSet<string>(StringComparer.Ordinal);
            foreach (var code in entry.BackupCodes)
                if (code is null || code.Id == Guid.Empty || !ids.Add(code.Id)
                    || string.IsNullOrWhiteSpace(code.Value) || code.Value.Length > 256
                    || code.Value.Contains('\n') || code.Value.Contains('\r') || !values.Add(code.Value))
                    throw new InvalidDataException("Invalid or duplicate backup code in vault.");
        }
    }
}
