# Bacom (Backup Code Manager)

Y'know 1Password and Bitwarden? This is similar but instead of passwords, it stores backup codes instead.

## Overview

Bacom is a cross-platform desktop application for securely storing and managing backup/recovery codes from services like GitHub, Google, Discord, etc. It provides a simple interface to keep your one-time recovery codes organized and accessible offline.

## Tech Stack

- **Framework:** [Avalonia UI](https://avaloniaui.net/) 12.1
- **Runtime:** .NET 10
- **Language:** C#
- **Platforms:** macOS, Windows, Linux (via Avalonia Desktop)
- **Build:** AOT-compatible, size-optimized publishing

## Project Structure

```
bacom/
├── App.axaml / App.axaml.cs       # Application entry point and resources
├── MainWindow.axaml / .cs         # Shell window with view navigation
├── Program.cs                     # Build and launch configuration
├── Views/
│   ├── LoginView.axaml / .cs      # Authentication screen
│   └── DashboardView.axaml / .cs  # Main entry display
├── styles/
│   └── Styles.axaml               # Shared UI styles and theme tokens
└── assets/                        # Images and static resources
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) or later

## Getting Started

### Run in development mode

```bash
dotnet run
```

### Publish (AOT, size-optimized)

```bash
dotnet publish -c Release
```

The published binary will be in `bin/Release/net10.0/<rid>/publish/`.

## Roadmap

See [TODO.md](TODO.md) for planned features including:

- Adding and removing entries
- Backup code encryption
- Backup code parsing

## License

TBD
