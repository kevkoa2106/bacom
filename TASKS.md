# Bacom tasks

## Planning
- [x] Inspect starter, tools, and repository state.
- [x] Read requested skill routing and design guidance.
- [x] Correct bcrypt/encryption model.
- [x] Clarify explicit code-use confirmation.
- [x] Write architecture, scope, design direction, and validation plan.
- [x] Commit baseline and plan.

## Core vault and parser
- [x] Define typed shared bridge contract.
- [x] Implement bounded, conservative text parsing.
- [x] Preserve existing used markers and leading zeros.
- [x] Add schema validation and input limits.
- [x] Implement bcrypt verifier and scrypt/AES-GCM envelope.
- [x] Implement atomic private file writes and serialized mutations.
- [x] Implement create/unlock/lock and summary-only listing.
- [x] Implement password-protected single-code reveal.
- [x] Implement explicit mark-used and cancel lifecycle.
- [x] Test parser formats and ambiguity warnings.
- [x] Test wrong password, tampering, persistence, and concurrency.
- [x] Review core agent, request fixes, verify, and commit.

## Electron
- [x] Add sandboxed main window and narrow preload bridge.
- [x] Validate IPC sender and all input boundaries.
- [x] Restrict navigation, popups, permissions, and network access.
- [x] Integrate native clipboard with conditional expiry.
- [x] Integrate encrypted backup export.
- [x] Lock on idle, OS lock, and close.
- [x] Enforce single instance and safe development profile path.
- [x] Add desktop build/start scripts for the local MVP.
- [x] Replace Chromium file input with a bounded native file-import bridge.
- [x] Review Electron agent, request fixes, verify, and commit.

## Renderer
- [x] Implement onboarding and unlock forms.
- [x] Implement vault sidebar, list, search, and filters.
- [x] Implement useful empty and exhausted states.
- [x] Implement text-file selection and website/account fields.
- [x] Implement editable parse preview and used-code checklist.
- [x] Implement import persistence and error feedback.
- [x] Implement password reveal, copy feedback, and explicit usage confirmation.
- [x] Implement lock, encrypted export, and help.
- [x] Handle async loading, errors, dialog focus, and keyboard navigation.
- [x] Apply responsive layout and reduced motion.
- [x] Apply user-provided light/dark palettes and System appearance preference.
- [x] Review renderer agent, request fixes, verify, and commit.

## Integration and evidence
- [x] Install required dependencies within project.
- [x] Run typecheck, core tests, renderer build, and desktop bundle.
- [x] Visually exercise onboarding/import/search/reveal/usage/lock.
- [x] Exercise real Electron IPC and restart persistence.
- [x] Independently reopen a native exported backup and verify counts/privacy/mode 0600.
- [x] Review encryption boundaries and production configuration.
- [x] Strengthen new vaults with version 2 scrypt parameters while retaining version 1 compatibility.
- [x] Preserve synthetic native test data outside the default development profile.
- [x] Document setup, parser limits, security model, backups, and recovery.
- [x] Commit final reviewed integration.

## Verification record

2026-10-16: `bun run test` passes 12 tests / 57 assertions; `bun run typecheck` passes 27 files; `bun run desktop:build` builds renderer and both Electron bundles. Native Electron exercised creation, native UTF-8 import, parse preview/used flags, wrong/correct password, copy feedback, dismissal, explicit usage, no-result search, manual lock, restart persistence, both supplied palettes, and encrypted export. See TESTING.md for review fixes and limits.

## Distribution follow-ups (outside local MVP)
- [ ] Choose installer targets and distribution channel.
- [ ] Add packaging, signing/notarization, and update delivery with the owner's credentials.
- [ ] Run platform-specific Windows/Linux and narrow browser visual checks.
- [ ] Obtain an independent security review before a public release.
