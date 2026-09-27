# Graph Report - bacom  (2026-09-26)

## Corpus Check
- 23 files · ~779,486 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 278 file(s) not represented in the graph (top: .dll 206, .dylib 19, (none) 16)

## Summary
- 119 nodes · 167 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.84)
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

## God Nodes (most connected - your core abstractions)
1. `DashboardView` - 24 edges
2. `DashboardEntry` - 11 edges
3. `Dashboard file map` - 10 edges
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

## Communities (10 total, 1 thin omitted)

### Community 0 - "DashboardView"
Cohesion: 0.16
Nodes (10): Button, Dictionary, KeyEventArgs, List, ObservableCollection, Point, SizeChangedEventArgs, TextChangedEventArgs (+2 more)

### Community 1 - "App.axaml.cs"
Cohesion: 0.14
Nodes (11): App, AppBuilder, Application, avalonia, avalonia_controls_applicationlifetimes, avalonia_markup_xaml, bacom, MainWindow (+3 more)

### Community 2 - "Bacom (Backup Code Manager)"
Cohesion: 0.15
Nodes (11): Bacom (Backup Code Manager), Getting Started, License, Overview, Prerequisites, Project Structure, Publish (AOT, size-optimized), Roadmap (+3 more)

### Community 3 - "DashboardView.axaml.cs"
Cohesion: 0.15
Nodes (15): avalonia_animation, avalonia_animation_easings, avalonia_controls, avalonia_input, avalonia_interactivity, avalonia_media, avalonia_threading, avalonia_visualtree (+7 more)

### Community 4 - "bacom.csproj"
Cohesion: 0.25
Nodes (7): net10.0, Avalonia (12.1.2), Avalonia.Desktop (12.1.2), Avalonia.Fonts.Inter (12.1.2), Avalonia.Themes.Fluent (12.1.2), AvaloniaUI.DiagnosticsSupport (2.2.3), Microsoft.NET.Sdk

### Community 6 - "Dashboard file map"
Cohesion: 0.20
Nodes (9): Card options menu, Create and edit forms, Dashboard file map, Deleting entries, Documentation consulted through Context7, GrepAI, Preview behavior, Proportional card sizing and opening motion (+1 more)

### Community 7 - "DashboardEntry"
Cohesion: 0.20
Nodes (9): bacom.Models, Entry details overlay, DashboardEntry, FaviconUrl, IsEmpty, IsLow, Notes, RemainingLabel (+1 more)

### Community 8 - ".NavigateTo"
Cohesion: 0.36
Nodes (4): UserControl, UserControl, LoginView, RoutedEventArgs

### Community 9 - "new-entry.sh"
Cohesion: 0.50
Nodes (3): BACOM_PROJECT_ROOT, CHECK_DIR, new-entry.sh script

## Knowledge Gaps
- **33 isolated node(s):** `Website`, `FaviconUrl`, `Notes`, `IsLow`, `IsEmpty` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 56 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardView` connect `DashboardView` to `.NavigateTo`, `DashboardView.axaml.cs`, `DashboardEntry`?**
  _High betweenness centrality (0.399) - this node is a cross-community bridge._
- **Why does `DashboardEntry` connect `DashboardEntry` to `DashboardView`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `Entry details overlay` connect `DashboardEntry` to `Dashboard file map`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardView` (e.g. with `.AuthUser()` and `.BypassAuth()`) actually correct?**
  _`DashboardView` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Website`, `FaviconUrl`, `Notes` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.axaml.cs` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._