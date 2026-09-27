using System.Collections.Generic;

namespace bacom.Models;

// Vault format: entries stay in dashboard order, with new accounts inserted first.
// This is the decrypted data model; disk storage must encrypt the whole payload.
public sealed class VaultData
{
    public int SchemaVersion { get; init; } = 1;
    public List<VaultEntry> Entries { get; init; } = [];
}
