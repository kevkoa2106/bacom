using System;
using System.Collections.Generic;
using System.ComponentModel;
using Avalonia.Media.Imaging;

namespace bacom.Models;

// Display adapter: the vault owns account data; only the UI owns the decoded image.
public sealed class DashboardEntry(VaultEntry data) : INotifyPropertyChanged
{
    public VaultEntry Data { get; } = data;
    public Guid Id => Data.Id;
    public string ServiceName => Data.ServiceName;
    public string AccountLabel => Data.AccountLabel;
    public int RemainingCodes => Data.RemainingCodes;
    public IReadOnlyList<BackupCode> BackupCodes => Data.BackupCodes;
    public string Website => Data.Website ?? "Not added";
    public Bitmap? Icon { get; init; }
    public bool HasCustomIcon => Data.HasCustomIcon;
    public bool HasIcon => Icon is not null;
    public bool NeedsIconPlaceholder => Icon is null;
    public string Notes => Data.Notes.Length == 0 ? "No notes yet." : Data.Notes;

    public event PropertyChangedEventHandler? PropertyChanged;

    public void SetCodeUsed(BackupCode code, bool used)
    {
        if (!Data.BackupCodes.Contains(code) || code.IsUsed == used) return;
        code.IsUsed = used;
        foreach (var property in new[] { nameof(RemainingCodes), nameof(RemainingLabel), nameof(IsLow), nameof(IsEmpty) })
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
    }

    public bool IsLow => RemainingCodes is > 0 and <= 2;
    public bool IsEmpty => RemainingCodes == 0;

    public string RemainingLabel => RemainingCodes switch
    {
        0 => "No codes remaining",
        1 => "1 code remaining",
        _ => $"{RemainingCodes} codes remaining",
    };
}
