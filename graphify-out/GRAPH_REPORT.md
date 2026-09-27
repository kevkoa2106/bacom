# Graph Report - bacom  (2026-09-27)

## Corpus Check
- 34 files · ~784,305 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 278 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 16)

## Summary
- 253 nodes · 444 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4bcb7daa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardView
- App.axaml.cs
- Bacom (Backup Code Manager)
- DashboardView.axaml.cs
- bacom.csproj
- DashboardEntry
- Dashboard file map
- IntPtr
- new-entry.sh
- .FindAsync
- VaultData
- vault.sh
- .Parse
- storage.md

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 38 edges
2. `DashboardEntry` - 30 edges
3. `VaultEntry` - 18 edges
4. `MacVaultKey` - 15 edges
5. `VaultData` - 13 edges
6. `Query` - 12 edges
7. `VaultStore` - 11 edges
8. `Dashboard file map` - 11 edges
9. `BackupCode` - 10 edges
10. `bacom.Models` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Entry details overlay` --references--> `DashboardEntry`  [INFERRED]
  docs/dashboard-map.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `VaultData`  [INFERRED]
  docs/vault-data.md → Models/VaultData.cs
- `Vault data format` --references--> `BackupCode`  [INFERRED]
  docs/vault-data.md → Models/BackupCode.cs
- `Vault data format` --references--> `DashboardEntry`  [INFERRED]
  docs/vault-data.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `VaultEntry`  [INFERRED]
  docs/vault-data.md → Models/VaultEntry.cs

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.10
Nodes (16): Button, CancellationTokenSource, Dictionary, IEnumerable, KeyEventArgs, ObservableCollection, Point, SizeChangedEventArgs (+8 more)

### Community 1 - "App.axaml.cs"
Cohesion: 0.12
Nodes (12): App, AppBuilder, Application, avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, MainWindow (+4 more)

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.15
Nodes (11): Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites, Project Structure, Publish (AOT, size-optimized), Roadmap (+3 more)

### Community 3 - "DashboardView.axaml.cs"
Cohesion: 0.08
Nodes (33): avalonia_animation, avalonia_animation_easings, avalonia_controls, avalonia_input, avalonia_interactivity, avalonia_media, avalonia_media_imaging, avalonia_platform_storage (+25 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.25
Nodes (7): net10.0, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2), AvaloniaUI.DiagnosticsSupport (2.2.3), Microsoft.NET.Sdk

### Community 5 - "DashboardEntry"
Cohesion: 0.05
Nodes (38): Vault data format, INotifyPropertyChanged, BackupCode, Id, IsUsed, Value, Guid, DashboardEntry (+30 more)

### Community 6 - "Dashboard file map"
Cohesion: 0.17
Nodes (11): Account images, Card options menu, Create and edit forms, Dashboard file map, Deleting entries, Documentation consulted through Context7, Entry details overlay, GrepAI (+3 more)

### Community 7 - "IntPtr"
Cohesion: 0.23
Nodes (7): DllImport, IntPtr, MacVaultKey, Query, Handle, True, List

### Community 9 - "new-entry.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, new-entry.sh script

### Community 10 - ".FindAsync"
Cohesion: 0.33
Nodes (7): CancellationToken, HttpClient, EntryIconLoader, Bitmap, Stream, Task, Uri

### Community 11 - "VaultData"
Cohesion: 0.16
Nodes (12): FileStream, IDisposable, VaultData, Entries, SchemaVersion, List, ReadOnlySpan, VaultCodec (+4 more)

### Community 12 - "vault.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, vault.sh script

### Community 13 - ".Parse"
Cohesion: 0.50
Nodes (3): BackupCodeParser, IReadOnlyList, List

## Knowledge Gaps
- **65 isolated node(s):** `Id`, `Value`, `IsUsed`, `Data`, `Id` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `VaultData`, `.FindAsync`, `DashboardView.axaml.cs`, `DashboardEntry`?**
  _High betweenness centrality (0.332) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `DashboardView`, `DashboardView.axaml.cs`, `Dashboard file map`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `VaultEntry` connect `DashboardEntry` to `DashboardView.axaml.cs`, `DashboardView`, `VaultData`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardEntry` (e.g. with `Entry details overlay` and `Vault data format`) actually correct?**
  _`DashboardEntry` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `VaultEntry` (e.g. with `Vault data format` and `.SampleEntry()`) actually correct?**
  _`VaultEntry` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Id`, `Value`, `IsUsed` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardView` be split into smaller, more focused modules?**
  _Cohesion score 0.10336817653890824 - nodes in this community are weakly interconnected._