# Graph Report - bacom  (2026-09-27)

## Corpus Check
- 29 files · ~782,083 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 278 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 16)

## Summary
- 199 nodes · 307 edges · 11 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7383df7c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardView
- App.axaml.cs
- Bacom (Backup Code Manager)
- DashboardView.axaml.cs
- bacom.csproj
- VaultEntry
- Dashboard file map
- DashboardEntry
- .NavigateTo
- new-entry.sh
- .FindAsync

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 37 edges
2. `DashboardEntry` - 29 edges
3. `VaultEntry` - 18 edges
4. `Dashboard file map` - 11 edges
5. `BackupCode` - 10 edges
6. `Bacom (Backup Code Manager)` - 8 edges
7. `bacom.Models` - 6 edges
8. `VaultData` - 6 edges
9. `App` - 5 edges
10. `EntryIconLoader` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Entry details overlay` --references--> `DashboardEntry`  [INFERRED]
  docs/dashboard-map.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `DashboardEntry`  [INFERRED]
  docs/vault-data.md → Models/DashboardEntry.cs
- `Vault data format` --references--> `BackupCode`  [INFERRED]
  docs/vault-data.md → Models/BackupCode.cs
- `Vault data format` --references--> `VaultData`  [INFERRED]
  docs/vault-data.md → Models/VaultData.cs
- `Vault data format` --references--> `VaultEntry`  [INFERRED]
  docs/vault-data.md → Models/VaultEntry.cs

## Import Cycles
- None detected.

## Communities (11 total, 0 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.12
Nodes (13): Button, CancellationTokenSource, Dictionary, KeyEventArgs, ObservableCollection, Point, SizeChangedEventArgs, TextChangedEventArgs (+5 more)

### Community 1 - "App.axaml.cs"
Cohesion: 0.18
Nodes (9): App, AppBuilder, Application, avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, Program (+1 more)

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.15
Nodes (11): Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites, Project Structure, Publish (AOT, size-optimized), Roadmap (+3 more)

### Community 3 - "DashboardView.axaml.cs"
Cohesion: 0.08
Nodes (29): avalonia_animation, avalonia_animation_easings, avalonia_controls, avalonia_input, avalonia_interactivity, avalonia_media, avalonia_media_imaging, avalonia_platform_storage (+21 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.25
Nodes (7): net10.0, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2), AvaloniaUI.DiagnosticsSupport (2.2.3), Microsoft.NET.Sdk

### Community 5 - "VaultEntry"
Cohesion: 0.07
Nodes (25): Vault data format, BackupCode, Id, IsUsed, Value, Guid, VaultData, Entries (+17 more)

### Community 6 - "Dashboard file map"
Cohesion: 0.17
Nodes (11): Account images, Card options menu, Create and edit forms, Dashboard file map, Deleting entries, Documentation consulted through Context7, Entry details overlay, GrepAI (+3 more)

### Community 7 - "DashboardEntry"
Cohesion: 0.10
Nodes (20): INotifyPropertyChanged, DashboardEntry, AccountLabel, BackupCodes, Data, HasCustomIcon, HasIcon, Icon (+12 more)

### Community 8 - ".NavigateTo"
Cohesion: 0.24
Nodes (6): MainWindow, UserControl, UserControl, LoginView, RoutedEventArgs, Window

### Community 9 - "new-entry.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, new-entry.sh script

### Community 10 - ".FindAsync"
Cohesion: 0.33
Nodes (7): CancellationToken, HttpClient, EntryIconLoader, Bitmap, Stream, Task, Uri

## Knowledge Gaps
- **57 isolated node(s):** `Id`, `Value`, `IsUsed`, `Data`, `Id` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 100 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `DashboardView.axaml.cs`, `VaultEntry`, `DashboardEntry`, `.NavigateTo`, `.FindAsync`?**
  _High betweenness centrality (0.378) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `DashboardView`, `DashboardView.axaml.cs`, `VaultEntry`, `Dashboard file map`?**
  _High betweenness centrality (0.301) - this node is a cross-community bridge._
- **Why does `VaultEntry` connect `VaultEntry` to `DashboardView`, `DashboardView.axaml.cs`, `DashboardEntry`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardView` (e.g. with `.AuthUser()` and `.BypassAuth()`) actually correct?**
  _`DashboardView` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `DashboardEntry` (e.g. with `Entry details overlay` and `Vault data format`) actually correct?**
  _`DashboardEntry` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `VaultEntry` (e.g. with `Vault data format` and `.SampleEntry()`) actually correct?**
  _`VaultEntry` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Id`, `Value`, `IsUsed` to the rest of the system?**
  _57 weakly-connected nodes found - possible documentation gaps or missing edges._