# Graph Report - bacom  (2026-09-26)

## Corpus Check
- 24 files · ~780,914 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 278 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 16)

## Summary
- 154 nodes · 236 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d05a50a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardView
- App.axaml.cs
- Bacom (Backup Code Manager)
- DashboardView.axaml.cs
- bacom.csproj
- system
- Dashboard file map
- DashboardEntry
- .NavigateTo
- new-entry.sh
- .FindAsync
- .ResizeCards

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 35 edges
2. `DashboardEntry` - 15 edges
3. `Dashboard file map` - 11 edges
4. `Bacom (Backup Code Manager)` - 8 edges
5. `App` - 5 edges
6. `EntryIconLoader` - 5 edges
7. `LoginView` - 5 edges
8. `MainWindow` - 4 edges
9. `bacom` - 3 edges
10. `Program` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Entry details overlay` --references--> `DashboardEntry`  [INFERRED]
  docs/dashboard-map.md → Models/DashboardEntry.cs
- `DashboardView` --references--> `DashboardEntry`  [EXTRACTED]
  Views/DashboardView.axaml.cs → Models/DashboardEntry.cs
- `DashboardView` --references--> `EntryIconLoader`  [EXTRACTED]
  Views/DashboardView.axaml.cs → Services/EntryIconLoader.cs

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.13
Nodes (12): Button, CancellationTokenSource, Dictionary, KeyEventArgs, List, ObservableCollection, Point, TextChangedEventArgs (+4 more)

### Community 1 - "App.axaml.cs"
Cohesion: 0.14
Nodes (11): App, AppBuilder, Application, avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, MainWindow (+3 more)

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.15
Nodes (11): Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites, Project Structure, Publish (AOT, size-optimized), Roadmap (+3 more)

### Community 3 - "DashboardView.axaml.cs"
Cohesion: 0.11
Nodes (19): avalonia_animation, avalonia_animation_easings, avalonia_input, avalonia_media, avalonia_media_imaging, avalonia_platform_storage, avalonia_threading, avalonia_visualtree (+11 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.25
Nodes (7): net10.0, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2), AvaloniaUI.DiagnosticsSupport (2.2.3), Microsoft.NET.Sdk

### Community 5 - "system"
Cohesion: 0.23
Nodes (8): avalonia_controls, avalonia_interactivity, bacom.Views, system, system_diagnostics, system_io, system_reflection, system_runtime_interopservices

### Community 6 - "Dashboard file map"
Cohesion: 0.17
Nodes (11): Account images, Card options menu, Create and edit forms, Dashboard file map, Deleting entries, Documentation consulted through Context7, Entry details overlay, GrepAI (+3 more)

### Community 7 - "DashboardEntry"
Cohesion: 0.18
Nodes (11): DashboardEntry, HasCustomIcon, HasIcon, Icon, IsEmpty, IsLow, NeedsIconPlaceholder, Notes (+3 more)

### Community 8 - ".NavigateTo"
Cohesion: 0.36
Nodes (4): UserControl, UserControl, LoginView, RoutedEventArgs

### Community 9 - "new-entry.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, new-entry.sh script

### Community 10 - ".FindAsync"
Cohesion: 0.33
Nodes (7): CancellationToken, HttpClient, EntryIconLoader, Bitmap, Stream, Task, Uri

## Knowledge Gaps
- **37 isolated node(s):** `Website`, `Icon`, `HasCustomIcon`, `HasIcon`, `NeedsIconPlaceholder` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 69 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `DashboardView.axaml.cs`, `DashboardEntry`, `.NavigateTo`, `.FindAsync`, `.ResizeCards`?**
  _High betweenness centrality (0.468) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `DashboardView`, `DashboardView.axaml.cs`, `Dashboard file map`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `Entry details overlay` connect `Dashboard file map` to `DashboardEntry`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardView` (e.g. with `.AuthUser()` and `.BypassAuth()`) actually correct?**
  _`DashboardView` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Website`, `Icon`, `HasCustomIcon` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardView` be split into smaller, more focused modules?**
  _Cohesion score 0.13368983957219252 - nodes in this community are weakly interconnected._
- **Should `App.axaml.cs` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._