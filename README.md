# Bacom (Backup Code Manager)

Y'know 1Password and Bitwarden? This is similar but instead of passwords, it stores backup codes instead.

## Overview

Bacom is a cross-platform desktop application for securely storing and managing backup/recovery codes from services like GitHub, Google, Discord, etc. It provides a simple interface to keep your one-time recovery codes organized and accessible offline.

## Tech Stack

- **Framework:** [Avalonia UI](https://avaloniaui.net/) 12.1
- **Runtime:** .NET 10
- **Language:** C#
- **Platforms:** Avalonia UI supports macOS, Windows and Linux; encrypted vault unlocking currently supports macOS Keychain only.
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

Create, edit and delete accounts, paste one backup code per line, and mark redeemed
codes Used. Changes save automatically to a local encrypted vault. Use **Vault →
Backup and restore** to export a password-protected backup; restore is also
available from the locked screen if your local key or file is lost.

Use a backup password of at least 12 characters and keep it separately. A backup
password cannot be recovered by Bacom. Restore replaces the entire account list
after confirmation and retains an encrypted copy of the old local vault.

See [storage details and limitations](docs/storage.md) and [TODO.md](TODO.md).
Run `sh checks/vault.sh` and `sh checks/new-entry.sh` for automated storage and UI
checks. Native Keychain approval and file-picker interaction need a desktop check.

## License

TBD
