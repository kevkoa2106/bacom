using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using bacom.Models;
using bacom.Services;

namespace bacom.Views;

public partial class BackupWindow : Window
{
    private readonly Func<VaultData>? _snapshot;
    private readonly Func<VaultData, Task>? _restore;
    private readonly string? _vaultPath;
    private VaultData? _pending;
    private bool _busy;
    private static readonly FilePickerFileType BackupType = new("Bacom encrypted backup") { Patterns = ["*.bacombackup"] };

    public BackupWindow() { InitializeComponent(); }
    public BackupWindow(Func<VaultData>? snapshot, Func<VaultData, Task> restore, string? vaultPath = null) : this()
    {
        _snapshot = snapshot; _restore = restore;
        _vaultPath = vaultPath;
        ExportButton.IsVisible = ConfirmLabel.IsVisible = ConfirmPassword.IsVisible = PasswordHelp.IsVisible = snapshot is not null;
        Closing += (_, e) => { if (_busy) e.Cancel = true; };
        Closed += (_, _) => { _pending = null; BackupPassword.Text = ConfirmPassword.Text = string.Empty; };
    }

    private void PasswordChanged(object? sender, TextChangedEventArgs e)
    {
        _pending = null;
        if (RestoreConfirmation is not null) RestoreConfirmation.IsVisible = false;
    }

    // File operations: native pickers, encrypted bytes only, no plaintext temporary export.
    private async void ExportBackup(object? sender, RoutedEventArgs e)
    {
        if (_busy || _snapshot is null) return;
        var password = BackupPassword.Text ?? string.Empty;
        if (password.Length < 12 || password != ConfirmPassword.Text)
        { BackupStatus.Text = "Use at least 12 characters and enter the same password twice."; return; }
        await Run(async () =>
        {
            var file = await StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
            {
                Title = "Export encrypted backup", SuggestedFileName = "Bacom.bacombackup",
                DefaultExtension = "bacombackup", FileTypeChoices = [BackupType], ShowOverwritePrompt = true,
            });
            if (file is null) return;
            var path = file.TryGetLocalPath() ?? throw new IOException("Choose a local backup destination.");
            if (_vaultPath is not null && (string.Equals(Path.GetFullPath(path), _vaultPath, StringComparison.OrdinalIgnoreCase)
                || Path.GetFullPath(path).StartsWith(_vaultPath + ".", StringComparison.OrdinalIgnoreCase)))
                throw new IOException("Choose a destination outside the active vault files.");
            var data = _snapshot();
            await Task.Run(() => VaultStore.WriteAtomic(path, VaultBackup.Export(data, password)));
            BackupPassword.Text = ConfirmPassword.Text = string.Empty;
            BackupStatus.Text = "Encrypted backup exported. Keep its password separately in a safe place.";
        });
    }

    private async void ChooseBackup(object? sender, RoutedEventArgs e)
    {
        if (_busy) return;
        _pending = null; RestoreConfirmation.IsVisible = false; ReplaceConsent.IsChecked = false;
        var password = BackupPassword.Text ?? string.Empty;
        if (password.Length == 0) { BackupStatus.Text = "Enter the password for this backup first."; return; }
        await Run(async () =>
        {
            var files = await StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
            { Title = "Choose encrypted backup", AllowMultiple = false, FileTypeFilter = [BackupType] });
            if (files.Count == 0) return;
            var path = files[0].TryGetLocalPath() ?? throw new IOException("Choose a local backup file.");
            var data = await Task.Run(() => VaultBackup.Import(VaultStore.ReadBounded(path), password));
            _pending = data;
            BackupStatus.Text = $"Backup verified: {data.Entries.Count} account(s). Confirm below to replace your current vault.";
            RestoreConfirmation.IsVisible = true;
        });
    }

    private async void RestoreBackup(object? sender, RoutedEventArgs e)
    {
        if (_busy || _pending is null || _restore is null) return;
        if (ReplaceConsent.IsChecked != true) { BackupStatus.Text = "Confirm replacement before restoring."; return; }
        var data = _pending;
        var restored = false;
        await Run(async () => { await _restore(data); restored = true; });
        if (restored) Close(true);
    }

    private async Task Run(Func<Task> action)
    {
        _busy = true; BackupForm.IsEnabled = false;
        try { await action(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or CryptographicException
            or System.Text.Json.JsonException or ArgumentException or PlatformNotSupportedException)
        {
            BackupStatus.Text = ex is VaultKeyException ? ex.Message
                : "Could not complete this operation. Check the backup password, file, system secret-store access and available disk space. Your current accounts were not replaced.";
        }
        finally { _busy = false; BackupForm.IsEnabled = true; }
    }

    private void CloseBackup(object? sender, RoutedEventArgs e) { if (!_busy) Close(false); }
}
