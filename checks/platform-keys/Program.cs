using System;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using bacom.Services;

// Explicit opt-in: create only a uniquely named disposable native credential.
if (!args.Contains("--native") || !(OperatingSystem.IsWindows() || OperatingSystem.IsLinux()))
{
    Console.WriteLine("SKIP: run with --native on Windows or Linux in a desktop user session.");
    return;
}
var name = "Bacom.PlatformCheck." + Guid.NewGuid().ToString("N");
byte[] Unlock(bool create) => OperatingSystem.IsWindows()
    ? WindowsVaultKey.Unlock(create, name) : LinuxVaultKey.Unlock(create, name);
void Missing()
{
    try { Unlock(false); }
    catch (VaultKeyException ex) when (ex.Message.Contains("missing")) { return; }
    throw new Exception("Missing-key lookup did not fail closed.");
}
Missing();
try
{
    var first = Unlock(true);
    var second = Unlock(false);
    var third = Unlock(true);
    try
    {
        if (first.Length != 32 || !first.SequenceEqual(second) || !first.SequenceEqual(third))
            throw new Exception("Native credential did not persist or was replaced.");
    }
    finally
    {
        CryptographicOperations.ZeroMemory(first);
        CryptographicOperations.ZeroMemory(second);
        CryptographicOperations.ZeroMemory(third);
    }
}
finally { NativeCleanup.Delete(name); }
Missing();
Console.WriteLine("PASS: native key creation, reload, no replacement, cleanup and missing-key rejection.");

static class NativeCleanup
{
    public static void Delete(string name)
    {
        if (OperatingSystem.IsWindows())
        {
            if (!CredDeleteW(name, 1, 0) && Marshal.GetLastWin32Error() != 1168)
                throw new Exception("Could not remove disposable Windows test credential.");
            return;
        }
        var glib = NativeLibrary.Load("libglib-2.0.so.0");
        var table = g_hash_table_new(NativeLibrary.GetExport(glib, "g_str_hash"), NativeLibrary.GetExport(glib, "g_str_equal"));
        var key = Marshal.StringToCoTaskMemUTF8("service");
        var value = Marshal.StringToCoTaskMemUTF8(name);
        try
        {
            g_hash_table_insert(table, key, value);
            secret_password_clearv_sync(IntPtr.Zero, table, IntPtr.Zero, out var error);
            if (error != IntPtr.Zero) { g_error_free(error); throw new Exception("Could not remove disposable Linux test credential."); }
        }
        finally
        {
            g_hash_table_unref(table);
            Marshal.FreeCoTaskMem(key); Marshal.FreeCoTaskMem(value); NativeLibrary.Free(glib);
        }
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CredDeleteW(string target, uint type, uint flags);
    [DllImport("libsecret-1.so.0")] private static extern int secret_password_clearv_sync(IntPtr schema, IntPtr attributes, IntPtr cancel, out IntPtr error);
    [DllImport("libglib-2.0.so.0")] private static extern IntPtr g_hash_table_new(IntPtr hash, IntPtr equal);
    [DllImport("libglib-2.0.so.0")] private static extern int g_hash_table_insert(IntPtr table, IntPtr key, IntPtr value);
    [DllImport("libglib-2.0.so.0")] private static extern void g_hash_table_unref(IntPtr table);
    [DllImport("libglib-2.0.so.0")] private static extern void g_error_free(IntPtr error);
}
