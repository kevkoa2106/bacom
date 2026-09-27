# Vault data format

Step 1 defines the data that will eventually live inside the encrypted vault:

| Model | Stored fields |
| --- | --- |
| `VaultData` | Schema version (currently 1), ordered account entries. |
| `VaultEntry` | Stable ID, service name, account label, optional website, notes, optional PNG image bytes, custom-image flag, ordered backup codes. |
| `BackupCode` | Stable ID, exact code text, used status (false for a new code). |

`VaultEntry.RemainingCodes` counts unused codes and is excluded from JSON. Keep
IDs when editing an account or code; create new IDs only for new items. Website
and image absence use null, and absent notes use an empty string. Display text
such as “Not added” belongs in the UI, not the saved data. Image bytes keep both
uploaded images and detected favicons available without another network request.

The models contain decrypted secrets. They must not be logged or written as
plaintext files. Encryption, key management, schema validation on import/load,
and disk writes are later steps. The serializer should use a source-generated
System.Text.Json context to support the app's Native AOT configuration.

`DashboardEntry` is now a display adapter around `VaultEntry`, retaining only the
decoded bitmap for the UI. Create and Edit accept one backup code per line;
surrounding whitespace and blank lines are removed, while internal separators
and leading zeros are preserved. Duplicate codes are rejected, with limits of
1,000 codes per account and 256 characters per code. Empty lists are allowed.
Unchanged codes retain their IDs and used status across edits and reordering.

The details popup provides a Used checkbox for each code, which can be unchecked
to undo a mistake. Counts and low/empty indicators update immediately. Account
images are normalized to PNG bytes on Apply/Create. Entries still live only in
memory; encrypted persistence and recovery remain future steps.

Run `sh checks/new-entry.sh` to check parsing, create/edit/cancel, code usage and
undo, identity preservation, card counts, images, animations, and narrow layout.
