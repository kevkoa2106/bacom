# Graph Report - bacom  (2026-09-27)

## Corpus Check
- 41 files · ~787,791 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 279 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 16)

## Summary
- 334 nodes · 667 edges · 15 communities
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `14ea0b33`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardView
- App.axaml.cs
- Bacom (Backup Code Manager)
- system
- bacom.csproj
- DashboardEntry
- Dashboard file map
- .Unlock
- LinuxVaultKey
- new-entry.sh
- .LoadImageAsync
- VaultData
- vault.sh
- NativeCleanup
- .Unlock

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 40 edges
2. `DashboardEntry` - 30 edges
3. `VaultEntry` - 18 edges
4. `VaultData` - 17 edges
5. `LinuxVaultKey` - 16 edges
6. `MacVaultKey` - 16 edges
7. `VaultStore` - 15 edges
8. `BackupWindow` - 14 edges
9. `bacom.Services` - 13 edges
10. `Query` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Entry details overlay` --references--> `DashboardEntry`  [INFERRED]
  docs/dashboard-map.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `BackupCode`  [INFERRED]
  docs/vault-data.md → Models/BackupCode.cs
- `Vault data format` --references--> `DashboardEntry`  [INFERRED]
  docs/vault-data.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `VaultEntry`  [INFERRED]
  docs/vault-data.md → Models/VaultEntry.cs
- `Vault data format` --references--> `MacVaultKey`  [INFERRED]
  docs/vault-data.md → Services/MacVaultKey.cs

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.11
Nodes (14): Button, CancellationTokenSource, Dictionary, IEnumerable, KeyEventArgs, ObservableCollection, Point, SizeChangedEventArgs (+6 more)

### Community 1 - "App.axaml.cs"
Cohesion: 0.14
Nodes (11): App, AppBuilder, Application, avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, MainWindow (+3 more)

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.11
Nodes (16): Encrypted local storage, Native platform verification, Password backups and recovery, Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites (+8 more)

### Community 3 - "system"
Cohesion: 0.09
Nodes (33): avalonia_animation, avalonia_animation_easings, avalonia_controls, avalonia_input, avalonia_interactivity, avalonia_media, avalonia_media_imaging, avalonia_platform_storage (+25 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.18
Nodes (9): net10.0, Microsoft.NET.Sdk, net10.0, Microsoft.NET.Sdk, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2) (+1 more)

### Community 5 - "DashboardEntry"
Cohesion: 0.05
Nodes (40): INotifyPropertyChanged, BackupCode, Id, IsUsed, Value, Guid, DashboardEntry, AccountLabel (+32 more)

### Community 6 - "Dashboard file map"
Cohesion: 0.17
Nodes (11): Account images, Card options menu, Create and edit forms, Dashboard file map, Deleting entries, Documentation consulted through Context7, Entry details overlay, GrepAI (+3 more)

### Community 7 - ".Unlock"
Cohesion: 0.23
Nodes (7): MacVaultKey, Query, Handle, True, DllImport, IntPtr, List

### Community 8 - "LinuxVaultKey"
Cohesion: 0.25
Nodes (7): CryptographicException, Attributes, Handle, LinuxVaultKey, DllImport, IntPtr, VaultKeyException

### Community 9 - "new-entry.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, new-entry.sh script

### Community 10 - ".LoadImageAsync"
Cohesion: 0.29
Nodes (7): CancellationToken, HttpClient, EntryIconLoader, Bitmap, Task, Stream, Uri

### Community 11 - "VaultData"
Cohesion: 0.08
Nodes (26): Vault data format, FilePickerFileType, FileStream, Func, IDisposable, UserControl, VaultData, Entries (+18 more)

### Community 12 - "vault.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, vault.sh script

### Community 13 - "NativeCleanup"
Cohesion: 0.45
Nodes (4): DllImport, IntPtr, MarshalAs, NativeCleanup

### Community 14 - ".Unlock"
Cohesion: 0.36
Nodes (7): Credential, FILETIME, Credential, WindowsVaultKey, DllImport, IntPtr, MarshalAs

## Knowledge Gaps
- **72 isolated node(s):** `Id`, `Value`, `IsUsed`, `Data`, `Id` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 125 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `VaultData`, `.LoadImageAsync`, `system`, `DashboardEntry`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `system`, `DashboardView`, `VaultData`, `Dashboard file map`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **Why does `VaultKey` connect `Bacom (Backup Code Manager)` to `VaultData`, `system`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardEntry` (e.g. with `Entry details overlay` and `Vault data format`) actually correct?**
  _`DashboardEntry` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `VaultEntry` (e.g. with `Vault data format` and `.SampleEntry()`) actually correct?**
  _`VaultEntry` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `VaultData` (e.g. with `Vault data format` and `.AuthUser()`) actually correct?**
  _`VaultData` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Id`, `Value`, `IsUsed` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._