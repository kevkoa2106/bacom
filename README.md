# Bacom

An offline desktop vault for two-factor authentication backup codes.

[Features](#features) · [Getting started](#getting-started) · [Development](#development) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Features

Checked items are available now. Unchecked items are proposed improvements, not release commitments.

- [x] Import `.txt` and `.rtf` backup codes with editable previews and used-code tracking.
- [x] Reveal and copy one code at a time after confirming your master password.
- [x] Store the vault encrypted locally, with encrypted backup export and restore.
- [x] Unlock with macOS Touch ID on supported devices.
- [x] Search accounts and filter services running low on unused codes.
- [x] Choose light, dark, or system appearance, an auto-lock delay, and optional animations.
- [ ] Rename accounts and remove obsolete entries with confirmation.
- [ ] Replace a service’s old code set when new recovery codes are generated.
- [ ] Change the master password and securely re-encrypt the vault.
- [ ] Add Windows Hello unlock.
- [ ] Add optional reminders to export a fresh encrypted backup.
- [ ] Provide signed installers and verified automatic updates.

Codes are marked used only after explicit confirmation. Bacom never contacts websites to check whether a code is valid.

## Getting started

Requires **Bun 1.4.3+** and **Node.js 22.12+** for Electron’s installer.

```sh
git clone https://github.com/kevkoa2106/bacom.git
cd bacom
bun install
bun run desktop:build
bun run desktop:start
```

If Electron’s binary is missing, run `node node_modules/electron/install.js` once.

Create a master password, choose **Add codes**, and review your imported codes before saving. There is no master-password reset.

## Development

```sh
bun run dev            # Disposable browser preview
bun run typecheck
bun run test
bun run desktop:build  # Build the renderer and Electron bundles
```

The browser preview runs at `http://127.0.0.1:3000` and resets on reload. Use sample data only.

For Electron with hot reload, build the desktop bundles, start the preview server, then run:

```sh
BACOM_DEV_URL=http://127.0.0.1:3000 bun run desktop:start
```

Installers, signing, notarization, and automatic updates are not configured.

## Architecture

Built with **TypeScript, React 19, shadcn/ui, Tailwind CSS 4, and Electron**, using Bun for builds and tooling.

```text
electron/       Desktop lifecycle, native dialogs, and secure IPC
src/core/       Code parsing and encrypted vault storage
src/components/ Shared UI components
src/shared/     Desktop and renderer contracts
src/App.tsx     Vault interface
scripts/        Desktop build tooling
```

## Storage and security

Development vault data lives in `.bacom-dev/userData/vault.json`; preserve this folder across rebuilds. Packaged apps use the OS application-data location.

Export an encrypted backup from **Vault settings → Backups**. Restoring replaces the current vault and requires the backup’s master password.

See [SECURITY.md](SECURITY.md) for encryption and security boundaries, and [TESTING.md](TESTING.md) for verification notes.

## Contributing

Bug reports, parser examples, accessibility improvements, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting.
