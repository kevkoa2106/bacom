using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace bacom.Services;

internal static class WindowsVaultKey
{
    internal static byte[] Unlock(bool allowCreate, string target = "Bacom.Vault.v1/vault-key")
    {
        if (CredReadW(target, 1, 0, out var pointer))
        {
            try
            {
                var credential = Marshal.PtrToStructure<Credential>(pointer);
                if (credential.BlobSize != 32 || credential.Blob == IntPtr.Zero)
                    throw new VaultKeyException("The Windows vault key is invalid. Restore a password-protected backup.");
                var key = new byte[32];
                Marshal.Copy(credential.Blob, key, 0, 32);
                return key;
            }
            finally { CredFree(pointer); }
        }
        var error = Marshal.GetLastWin32Error();
        if (error != 1168) throw new VaultKeyException("Windows Credential Manager is unavailable. Sign in to your Windows account and try again.");
        if (!allowCreate) throw new VaultKeyException("The Windows vault key is missing. Restore a password-protected backup.");

        var created = RandomNumberGenerator.GetBytes(32);
        var blob = Marshal.AllocHGlobal(32);
        try
        {
            Marshal.Copy(created, 0, blob, 32);
            // Generic credential, persisted for this user on this computer (not roaming).
            var credential = new Credential { Type = 1, Target = target, UserName = "vault-key",
                BlobSize = 32, Blob = blob, Persist = 2 };
            if (!CredWriteW(ref credential, 0))
                throw new VaultKeyException("Windows could not store the vault key. Check Credential Manager access and try again.");
        }
        finally
        {
            CryptographicOperations.ZeroMemory(created);
            Marshal.Copy(created, 0, blob, 32);
            Marshal.FreeHGlobal(blob);
        }
        return Unlock(false, target);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        public uint Flags, Type;
        [MarshalAs(UnmanagedType.LPWStr)] public string? Target;
        [MarshalAs(UnmanagedType.LPWStr)] public string? Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint BlobSize;
        public IntPtr Blob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] public string? TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] public string? UserName;
    }

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CredReadW(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CredWriteW(ref Credential credential, uint flags);
    [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr credential);
}
