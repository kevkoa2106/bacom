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

## Example formats, device unlock, and motion
- [x] Review example structures without disclosing or committing their contents.
- [x] Extract plain text safely from bounded RTF documents.
- [x] Recognize letter-only and spaced/hyphenated formats with ambiguity warnings.
- [x] Keep uncertain code boundaries editable; user confirmed the fourth example is one long code.
- [x] Add parser and native-reader regression checks from synthetic equivalents.
- [x] Add main-process vault-bound device unlock keys, without saving the master password.
- [x] Add opt-in native Touch ID, protected device-key storage, and password fallback.
- [x] Confirm macOS-first scope with the user; Windows Hello remains unsupported.
- [x] Test biometric cancellation, missing credentials, enrollment races, and vault binding with mock OS providers.
- [x] Add enrollment/removal UI and once-per-launch authentication prompt.
- [x] Add purposeful screen/dialog/list/feedback animations and first-paint reduced-motion support.
- [x] Review each agent's work, obtain fixes, and commit completed parts.
- [x] Run final tests/build, inspect native UI, and update security and verification docs.

Follow-up evidence: 40 tests pass with 176 assertions; type checking passes 30 files; desktop build passes. All four user-supplied structures parse, with the fourth preserved as one 101-character code. Native RTF import preview/save succeeds with a synthetic four-code fixture. Actual Touch ID is unavailable on this machine; native success/cancellation are covered using injected OS providers, with real hardware testing still a release check.

## Settings follow-up
- [x] Standardize section, label, helper, and control spacing; align dropdown widths and verify desktop/narrow layouts.
- [x] Add a bold Appearance heading consistent with the other settings sections.
- [x] Add persistent 1, 5, 10, 15, and 30 minute auto-lock choices, with the Electron main process as the single timer owner.
- [x] Add encrypted JSON backup restoration with a backup-password check, atomic replacement, and explicit confirmation.
- [x] Invalidate the previous device-unlock key on restore, remove its sidecar when possible, and warn if OS storage blocks cleanup.
- [x] Document restore replacement, password, and usage-history behavior.

## Responsive window layout
- [x] Confirm General, Security, and Backups settings categories with the user.
- [x] Fit the vault shell to the window and contain long account lists within the library.
- [x] Adapt account details and onboarding to shorter desktop windows.
- [x] Place import fields and code review side by side when space allows.
- [x] Keep settings feedback visible and clear password fields when changing categories.
- [x] Review code and verify minimum desktop, standard desktop, wide, and narrow layouts.
- [x] Run type checking, desktop bundling, and the scoped design detector.
- [x] Remove popup outlines and category underlines; add a contrasting, animated category selection with reduced-motion support.
- [x] Animate settings popup resizing on category changes, including interrupted transitions and instant reduced-motion updates.

## Optional animations and selector alignment
- [x] Inset dropdown chevrons consistently and keep the auto-lock selector aligned with its label.
- [x] Add a persistent Animations switch in General, disabled by default.
- [x] Gate CSS motion, popup resizing, and closing delays with the preference; respect system Reduce Motion.
- [x] Review the change and verify settings at standard and small window sizes.
- [x] Run type checking, desktop build, and the scoped design detector; commit the change.

## Lock screen and shared controls
- [x] Fix the theme selector's intrinsic width so the lock screen fits the window without page scrollbars.
- [x] Group the topbar lock label so icon spacing does not split its words.
- [x] Reuse one native select wrapper for appearance, auto-lock, and account filtering.
- [x] Verify locked and unlocked screens at desktop, short desktop, and narrow sizes; build and review the diff.

## Narrated launch video
- [x] Inspect the product and write a source-grounded, 24-second storyboard.
- [x] Prepare local music, UI sounds, and an isolated Kokoro environment.
- [x] Generate narration and align the product scenes with its duration.
- [x] Review the composition, pass Hyperframes check, and launch the local preview.
- [x] Obtain preview approval required by the brag workflow.
- [x] Render MP4, select the poster, bake frame zero, and verify the deliverables.

## 18-second dimensional product showcase
- [x] Write a new screenshot-led storyboard; preserve previous video outputs.
- [x] Capture actual Electron screens using synthetic data in an isolated vault.
- [x] Compose and synthesize an original18-second score in code with no samples or models.
- [x] Build3D screen choreography, transitions, and kinetic typography.
- [x] Review snapshots, run runtime/layout/contrast/motion checks, and fix real defects.
- [ ] Render the requested MP4, bake the poster, verify audio/frame count, and deliver.
