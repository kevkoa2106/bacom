# Graph Report - bacom  (2026-09-26)

## Corpus Check
- 22 files · ~778,126 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 277 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 15)

## Summary
- 102 nodes · 132 edges · 8 communities
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4fc22860`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardView
- App
- Bacom (Backup Code Manager)
- DashboardView.axaml.cs
- bacom.csproj
- system
- Dashboard file map
- DashboardEntry

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 17 edges
2. `Dashboard file map` - 9 edges
3. `DashboardEntry` - 8 edges
4. `Bacom (Backup Code Manager)` - 8 edges
5. `App` - 5 edges
6. `LoginView` - 5 edges
7. `MainWindow` - 4 edges
8. `bacom` - 3 edges
9. `Program` - 3 edges
10. `bacom.Views` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Entry details overlay` --references--> `DashboardEntry`  [INFERRED]
  docs/dashboard-map.md → Models/DashboardEntry.cs
- `DashboardView` --references--> `DashboardEntry`  [EXTRACTED]
  Views/DashboardView.axaml.cs → Models/DashboardEntry.cs

## Import Cycles
- None detected.

## Communities (8 total, 0 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.13
Nodes (12): Button, KeyEventArgs, List, UserControl, ObservableCollection, SizeChangedEventArgs, TextChangedEventArgs, UserControl (+4 more)

### Community 1 - "App"
Cohesion: 0.20
Nodes (7): App, AppBuilder, Application, MainWindow, Program, STAThread, Window

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.15
Nodes (11): Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites, Project Structure, Publish (AOT, size-optimized), Roadmap (+3 more)

### Community 3 - "DashboardView.axaml.cs"
Cohesion: 0.17
Nodes (13): avalonia_animation, avalonia_animation_easings, avalonia_controls, avalonia_input, avalonia_interactivity, avalonia_media, bacom.Views, system_collections_generic (+5 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.25
Nodes (7): net10.0, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2), AvaloniaUI.DiagnosticsSupport (2.2.3), Microsoft.NET.Sdk

### Community 5 - "system"
Cohesion: 0.23
Nodes (6): avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, system, system_reflection

### Community 6 - "Dashboard file map"
Cohesion: 0.22
Nodes (8): Card options menu, Dashboard file map, Deleting entries, Documentation consulted through Context7, GrepAI, Preview behavior, Proportional card sizing and opening motion, Validation

### Community 7 - "DashboardEntry"
Cohesion: 0.22
Nodes (8): bacom.Models, Entry details overlay, DashboardEntry, IsEmpty, IsLow, Notes, RemainingLabel, Website

## Knowledge Gaps
- **28 isolated node(s):** `Website`, `Notes`, `IsLow`, `IsEmpty`, `RemainingLabel` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 50 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `DashboardView.axaml.cs`, `DashboardEntry`?**
  _High betweenness centrality (0.383) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `DashboardView`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `Entry details overlay` connect `DashboardEntry` to `Dashboard file map`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardView` (e.g. with `.AuthUser()` and `.BypassAuth()`) actually correct?**
  _`DashboardView` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Website`, `Notes`, `IsLow` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardView` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._