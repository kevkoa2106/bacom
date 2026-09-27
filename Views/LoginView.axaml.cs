using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using bacom.Services;

namespace bacom.Views;

public partial class LoginView : UserControl
{
    public LoginView() { InitializeComponent(); }

    // Unlocking: the platform secret store releases the key before decryption.
    private async void AuthUser(object? sender, RoutedEventArgs e)
    {
        if (!UnlockButton.IsEnabled) return;
        UnlockButton.IsEnabled = false;
        RestoreLoginButton.IsEnabled = false;
        LoginStatus.Text = VaultKey.UnlockHint;
        VaultStore? store = null;
        try
        {
            var path = VaultStore.DefaultPath;
            var key = await Task.Run(() => VaultKey.Unlock(allowCreate: !File.Exists(path)));
            try { store = new VaultStore(path, key); }
            finally { CryptographicOperations.ZeroMemory(key); }
            var data = await Task.Run(() =>
            {
                if (File.Exists(path)) return store.Load();
                var empty = new bacom.Models.VaultData();
                store.Save(empty);
                return empty;
            });
            if (TopLevel.GetTopLevel(this) is MainWindow window)
            {
                var dashboard = new DashboardView(new EntryIconLoader(), store, data);
                window.NavigateTo(dashboard);
                store = null; // Dashboard owns and disposes the unlocked session.
            }
        }
        catch (Exception ex) when (ex is CryptographicException or IOException or UnauthorizedAccessException
            or PlatformNotSupportedException or System.Text.Json.JsonException or ArgumentException)
        {
            LoginStatus.Text = ex is PlatformNotSupportedException or VaultKeyException ? ex.Message
                : "Could not unlock the vault. Allow access to your system's secret store and close any other Bacom window. If the key or file is damaged, restore a backup. Your existing vault was not reset.";
        }
        finally { store?.Dispose(); UnlockButton.IsEnabled = RestoreLoginButton.IsEnabled = true; }
    }

    // Recovery is available even if the original local key or vault is missing.
    private async void RestoreFromBackup(object? sender, RoutedEventArgs e)
    {
        if (!UnlockButton.IsEnabled || TopLevel.GetTopLevel(this) is not Window owner) return;
        UnlockButton.IsEnabled = RestoreLoginButton.IsEnabled = false;
        try
        {
            var dialog = new BackupWindow(null, data => Task.Run(() =>
            {
                var key = VaultKey.Unlock(allowCreate: true);
                try
                {
                    using var store = new VaultStore(VaultStore.DefaultPath, key);
                    store.Restore(data);
                }
                finally { CryptographicOperations.ZeroMemory(key); }
            }));
            if (await dialog.ShowDialog<bool>(owner)) LoginStatus.Text = "Backup restored. Unlock your vault to continue.";
        }
        finally { UnlockButton.IsEnabled = RestoreLoginButton.IsEnabled = true; }
    }
}
