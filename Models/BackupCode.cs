using System;

namespace bacom.Models;

// Keep code text exactly as entered, including leading zeros and separators.
// A class avoids a record's generated ToString exposing the secret value.
public sealed class BackupCode
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Value { get; init; }

    // Copying a code does not mean it was redeemed; usage is an explicit action.
    public bool IsUsed { get; set; }
}
