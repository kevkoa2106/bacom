using System;
using System.IO;
using System.Security.Cryptography;
using bacom.Models;

namespace bacom.Services;

// One unlocked session owns the key and exclusive file lock. Dispose on logout/close.
public sealed class VaultStore : IDisposable
{
    public static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Bacom", "vault.bacom");
    private readonly string _path;
    public string FilePath => _path;
    private readonly byte[] _key;
    private readonly FileStream _lock;
    private bool _disposed;

    public VaultStore(string path, byte[] key)
    {
        if (key.Length != 32) throw new ArgumentException("A 256-bit vault key is required.");
        _path = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        _lock = new FileStream(_path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        _key = (byte[])key.Clone();
    }

    public VaultData Load()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        return VaultCodec.Decrypt(ReadBounded(_path), _key);
    }

    public void Save(VaultData data)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        var encrypted = VaultCodec.Encrypt(data, _key);
        // Retain the previous encrypted version; never overwrite a file we cannot decrypt.
        if (File.Exists(_path))
        {
            var previous = ReadBounded(_path);
            VaultCodec.Decrypt(previous, _key);
            WriteAtomic(_path + ".previous", previous);
        }
        WriteAtomic(_path, encrypted);
    }

    public static byte[] ReadBounded(string path)
    {
        using var file = File.OpenRead(path);
        if (file.Length > VaultCodec.MaxBytes) throw new InvalidDataException("The file exceeds 32 MB.");
        var bytes = new byte[checked((int)file.Length)];
        file.ReadExactly(bytes);
        return bytes;
    }

    // Explicit recovery can replace a corrupt vault, retaining its original encrypted bytes.
    public void Restore(VaultData data)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        var encrypted = VaultCodec.Encrypt(data, _key);
        if (File.Exists(_path))
            WriteAtomic(_path + ".before-restore-" + Guid.NewGuid().ToString("N"), ReadBounded(_path));
        WriteAtomic(_path, encrypted);
    }

    public static void WriteAtomic(string path, byte[] bytes)
    {
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
            if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            using (var file = new FileStream(temp, options)) { file.Write(bytes); file.Flush(flushToDisk: true); }
            File.Move(temp, path, overwrite: true);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        CryptographicOperations.ZeroMemory(_key);
        _lock.Dispose();
    }
}
