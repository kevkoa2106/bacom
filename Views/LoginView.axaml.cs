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

    // Unlocking: Keychain releases the key; only a successfully decrypted vault opens.
    private async void AuthUser(object? sender, RoutedEventArgs e)
    {
        if (!UnlockButton.IsEnabled) return;
        UnlockButton.IsEnabled = false;
        LoginStatus.Text = "Approve the macOS Keychain prompt to unlock your vault.";
        VaultStore? store = null;
        try
        {
            var path = VaultStore.DefaultPath;
            var key = await Task.Run(() => MacVaultKey.Unlock(allowCreate: !File.Exists(path)));
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
            LoginStatus.Text = ex is PlatformNotSupportedException ? ex.Message
                : "Could not unlock the vault. Approve Keychain access and close any other Bacom window. If the key or file is damaged, restore a backup. Your existing vault was not reset.";
        }
        finally { store?.Dispose(); UnlockButton.IsEnabled = true; }
    }
}
