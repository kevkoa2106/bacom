# Contributing to Bacom

Small, focused contributions are welcome. For a new feature or a change to encryption, storage, or authentication, open an issue to discuss the approach first. The unchecked features in the README are proposals, not assigned work.

## Local setup

Follow the [README](README.md#getting-started) to install dependencies and build the desktop app. Use Bun for scripts and dependency changes.

```sh
bun run dev             # Disposable browser preview
bun run desktop:build
bun run desktop:start
```

Use synthetic accounts and recovery codes. Never include real passwords, backup codes, vault files, or device-unlock credentials in issues, screenshots, fixtures, or commits. The browser preview resets on reload.

For isolated desktop testing, choose a new profile directory inside the repository:

```sh
BACOM_DEV_PROFILE=.cache/contributor-profile bun run desktop:start
```

Preserve your normal `.bacom-dev` folder; it contains the development vault.

## Issues and parser examples

For bugs, include reproduction steps, expected and actual behavior, OS, and app version or commit. Replace private information before sharing logs or screenshots.

For parser bugs, share a synthetic file that preserves the original layout, separators, and code lengths. Describe the expected codes and used flags. Add a regression case in `src/core/parser.test.ts` when fixing the parser.

## Pull requests

- Keep each change focused and follow existing TypeScript, React, and CSS patterns.
- Keep file access, cryptography, and native capabilities in Electron’s main process. Validate inputs at the IPC boundary; read [SECURITY.md](SECURITY.md) before changing these paths.
- Preserve keyboard navigation, visible focus, responsive layout, and reduced-motion behavior. App animations must remain opt-in.
- Add relevant regression coverage for behavior changes. Use synthetic fixtures only.
- Update documentation when commands or behavior change.

Before opening a pull request, run:

```sh
bun run typecheck
bun run test
bun run desktop:build
git diff --check
```

Explain the problem, the resulting behavior, and how you verified it. Include before-and-after screenshots for UI changes in light and dark modes, and check a small window. Identify platform-specific checks you could not run, especially Touch ID and OS credential storage.

## Security reports

Avoid publishing exploit details or sensitive data in a public issue. Use GitHub’s private vulnerability reporting if it is enabled for this repository; otherwise, ask the maintainer for a private reporting channel without including vulnerability details.
