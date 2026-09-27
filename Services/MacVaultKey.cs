using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace bacom.Services;

// Login Keychain access control requests approval when releasing the vault key.
// No shell commands, command-line secrets, plaintext key files, or authentication bypass.
public static class MacVaultKey
{
    private const string Security = "/System/Library/Frameworks/Security.framework/Security";
    private const string Core = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";

    public static byte[] Unlock(bool allowCreate)
    {
        if (!OperatingSystem.IsMacOS()) throw new PlatformNotSupportedException("Vault unlocking currently requires macOS Keychain.");
        using var query = new Query();
        query.Set("kSecClass", query.Constant("kSecClassGenericPassword"));
        query.Set("kSecAttrService", query.String("Bacom.Vault.v1"));
        query.Set("kSecAttrAccount", query.String("vault-key"));
        query.Set("kSecReturnData", query.True);
        var status = SecItemCopyMatching(query.Handle, out var result);
        if (status == 0)
        {
            try
            {
                if (CFDataGetLength(result) != 32) throw new CryptographicException("Invalid vault key in Keychain.");
                var key = new byte[32];
                Marshal.Copy(CFDataGetBytePtr(result), key, 0, key.Length);
                return key;
            }
            finally { CFRelease(result); }
        }
        if (status != -25300 || !allowCreate)
            throw new CryptographicException(status == -25300
                ? "The vault key is missing. Restore a password-protected backup."
                : $"Keychain did not unlock the vault (status {status}). Try again and approve the system prompt.");

        var newKey = RandomNumberGenerator.GetBytes(32);
        try
        {
            // ponytail: login Keychain supports local unsigned development. Move to the
            // data-protection Keychain + userPresence with a provisioned, signed app.
            var trustedApps = query.Own(CFArrayCreate(IntPtr.Zero, IntPtr.Zero, 0, IntPtr.Zero));
            status = SecAccessCreate(query.String("Bacom encrypted vault"), trustedApps, out var access);
            if (status != 0) throw new CryptographicException("Unable to create Keychain access control.");
            query.Own(access);
            CFDictionaryRemoveValue(query.Handle, query.Constant("kSecReturnData"));
            query.Set("kSecAttrAccess", access);
            query.Set("kSecValueData", query.Own(CFDataCreate(IntPtr.Zero, newKey, newKey.Length)));
            status = SecItemAdd(query.Handle, IntPtr.Zero);
            if (status != 0) throw new CryptographicException($"Unable to create the vault key (Keychain status {status}).");
        }
        finally { CryptographicOperations.ZeroMemory(newKey); }
        // Read through the same authenticated path, even immediately after creation.
        return Unlock(allowCreate: false);
    }

    private sealed class Query : IDisposable
    {
        private readonly IntPtr _security = NativeLibrary.Load(Security);
        private readonly IntPtr _core = NativeLibrary.Load(Core);
        private readonly List<IntPtr> _owned = [];
        public IntPtr Handle { get; }
        public Query()
        {
            Handle = CFDictionaryCreateMutable(IntPtr.Zero, 0,
                NativeLibrary.GetExport(_core, "kCFTypeDictionaryKeyCallBacks"),
                NativeLibrary.GetExport(_core, "kCFTypeDictionaryValueCallBacks"));
        }
        public IntPtr Constant(string name) => Marshal.ReadIntPtr(NativeLibrary.GetExport(_security, name));
        public IntPtr True => Marshal.ReadIntPtr(NativeLibrary.GetExport(_core, "kCFBooleanTrue"));
        public IntPtr Own(IntPtr value) { _owned.Add(value); return value; }
        public IntPtr String(string value) => Own(CFStringCreateWithCString(IntPtr.Zero, value, 0x08000100));
        public void Set(string key, IntPtr value) => CFDictionarySetValue(Handle, Constant(key), value);
        public void Dispose()
        {
            CFRelease(Handle);
            foreach (var value in _owned) CFRelease(value);
            NativeLibrary.Free(_security); NativeLibrary.Free(_core);
        }
    }

    [DllImport(Security)] private static extern int SecItemCopyMatching(IntPtr query, out IntPtr result);
    [DllImport(Security)] private static extern int SecItemAdd(IntPtr query, IntPtr result);
    [DllImport(Security)] private static extern int SecAccessCreate(IntPtr description, IntPtr trustedApps, out IntPtr access);
    [DllImport(Core)] private static extern IntPtr CFArrayCreate(IntPtr allocator, IntPtr values, nint count, IntPtr callbacks);
    [DllImport(Core)] private static extern IntPtr CFDictionaryCreateMutable(IntPtr allocator, nint capacity, IntPtr keys, IntPtr values);
    [DllImport(Core)] private static extern void CFDictionarySetValue(IntPtr dictionary, IntPtr key, IntPtr value);
    [DllImport(Core)] private static extern void CFDictionaryRemoveValue(IntPtr dictionary, IntPtr key);
    [DllImport(Core)] private static extern IntPtr CFStringCreateWithCString(IntPtr allocator, [MarshalAs(UnmanagedType.LPUTF8Str)] string value, uint encoding);
    [DllImport(Core)] private static extern IntPtr CFDataCreate(IntPtr allocator, byte[] bytes, nint length);
    [DllImport(Core)] private static extern nint CFDataGetLength(IntPtr data);
    [DllImport(Core)] private static extern IntPtr CFDataGetBytePtr(IntPtr data);
    [DllImport(Core)] private static extern void CFRelease(IntPtr value);
}
