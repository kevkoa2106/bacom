using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;

namespace bacom.Services;

internal static class LinuxVaultKey
{
    private const string Secret = "libsecret-1.so.0";
    private const string Glib = "libglib-2.0.so.0";
    private const string Gio = "libgio-2.0.so.0";
    internal static byte[] Unlock(bool allowCreate, string service = "Bacom.Vault.v1")
    {
        using var attributes = new Attributes(service);
        var cancel = g_cancellable_new();
        try
        {
            // The native API may display a keyring prompt; never block the UI thread.
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
            using var registration = timeout.Token.Register(() => g_cancellable_cancel(cancel));
            var secret = secret_password_lookupv_sync(IntPtr.Zero, attributes.Handle, cancel, out var error);
            try
            {
                CheckError(error);
                if (secret != IntPtr.Zero)
                {
                    var encoded = Marshal.PtrToStringUTF8(secret) ?? string.Empty;
                    var key = new byte[32];
                    if (encoded.Length != 44 || !Convert.TryFromBase64String(encoded, key, out var count) || count != 32)
                    {
                        CryptographicOperations.ZeroMemory(key);
                        throw new VaultKeyException("The Linux vault key is invalid. Restore a password-protected backup.");
                    }
                    return key;
                }
            }
            finally { if (secret != IntPtr.Zero) secret_password_free(secret); }
            if (!allowCreate) throw new VaultKeyException("The Linux vault key is missing. Restore a password-protected backup.");

            // A dismissed unlock prompt may return no secret even though a locked item
            // exists. Search without unlocking before creation so we never replace it.
            var existing = secret_password_searchv_sync(IntPtr.Zero, attributes.Handle, 0, cancel, out error);
            try
            {
                CheckError(error);
                if (existing != IntPtr.Zero)
                    throw new VaultKeyException("The vault key exists but is locked. Unlock your desktop keyring and try again.");
            }
            finally
            {
                if (existing != IntPtr.Zero)
                {
                    var library = NativeLibrary.Load("libgobject-2.0.so.0");
                    try { g_list_free_full(existing, NativeLibrary.GetExport(library, "g_object_unref")); }
                    finally { NativeLibrary.Free(library); }
                }
            }

            var created = RandomNumberGenerator.GetBytes(32);
            try
            {
                var stored = secret_password_storev_sync(IntPtr.Zero, attributes.Handle, "default",
                    "Bacom encrypted vault", Convert.ToBase64String(created), cancel, out error);
                CheckError(error);
                if (stored == 0) throw new VaultKeyException("The desktop keyring did not store the vault key. Unlock it and try again.");
            }
            finally { CryptographicOperations.ZeroMemory(created); }
        }
        finally { g_object_unref(cancel); }
        return Unlock(false, service);
    }

    private static void CheckError(IntPtr error)
    {
        if (error == IntPtr.Zero) return;
        g_error_free(error);
        throw new VaultKeyException("Could not access the desktop keyring. Ensure a Secret Service provider is running in your desktop session, unlock it, and try again.");
    }

    private sealed class Attributes : IDisposable
    {
        private readonly IntPtr _library = NativeLibrary.Load(Glib);
        private readonly IntPtr[] _strings;
        public IntPtr Handle { get; }
        public Attributes(string service)
        {
            Handle = g_hash_table_new(NativeLibrary.GetExport(_library, "g_str_hash"), NativeLibrary.GetExport(_library, "g_str_equal"));
            _strings = [Marshal.StringToCoTaskMemUTF8("service"), Marshal.StringToCoTaskMemUTF8(service),
                Marshal.StringToCoTaskMemUTF8("account"), Marshal.StringToCoTaskMemUTF8("vault-key")];
            g_hash_table_insert(Handle, _strings[0], _strings[1]);
            g_hash_table_insert(Handle, _strings[2], _strings[3]);
        }
        public void Dispose()
        {
            g_hash_table_unref(Handle);
            foreach (var value in _strings) Marshal.FreeCoTaskMem(value);
            NativeLibrary.Free(_library);
        }
    }

    [DllImport(Secret)] private static extern IntPtr secret_password_lookupv_sync(IntPtr schema, IntPtr attributes, IntPtr cancellable, out IntPtr error);
    [DllImport(Secret)] private static extern int secret_password_storev_sync(IntPtr schema, IntPtr attributes,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string collection, [MarshalAs(UnmanagedType.LPUTF8Str)] string label,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string password, IntPtr cancellable, out IntPtr error);
    [DllImport(Secret)] private static extern void secret_password_free(IntPtr password);
    [DllImport(Secret)] private static extern IntPtr secret_password_searchv_sync(IntPtr schema, IntPtr attributes, int flags, IntPtr cancellable, out IntPtr error);
    [DllImport(Glib)] private static extern void g_list_free_full(IntPtr list, IntPtr destroy);
    [DllImport(Glib)] private static extern IntPtr g_hash_table_new(IntPtr hash, IntPtr equal);
    [DllImport(Glib)] private static extern int g_hash_table_insert(IntPtr table, IntPtr key, IntPtr value);
    [DllImport(Glib)] private static extern void g_hash_table_unref(IntPtr table);
    [DllImport(Glib)] private static extern void g_error_free(IntPtr error);
    [DllImport(Gio)] private static extern IntPtr g_cancellable_new();
    [DllImport(Gio)] private static extern void g_cancellable_cancel(IntPtr cancellable);
    [DllImport("libgobject-2.0.so.0")] private static extern void g_object_unref(IntPtr value);
}
