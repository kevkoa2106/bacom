using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace bacom.Models;

// Account data: independent of Avalonia controls, bitmaps, and display placeholders.
public sealed class VaultEntry
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string ServiceName { get; init; }
    public required string AccountLabel { get; init; }
    public string? Website { get; init; }
    public string Notes { get; init; } = string.Empty;

    // Account image: normalized PNG bytes, or null to show the placeholder.
    // Preserve custom-image precedence when the website changes during editing.
    public byte[]? IconPng { get; init; }
    public bool HasCustomIcon { get; init; }

    // Backup codes: list order is preserved; the count is never saved separately.
    public List<BackupCode> BackupCodes { get; init; } = [];

    [JsonIgnore]
    public int RemainingCodes => BackupCodes.Count(code => !code.IsUsed);
}
