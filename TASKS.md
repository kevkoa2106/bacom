# Bacom tasks

## Planning
- [x] Inspect starter, tools, and repository state.
- [x] Read requested skill routing and design guidance.
- [x] Correct bcrypt/encryption model.
- [x] Clarify explicit code-use confirmation.
- [x] Write architecture, scope, design direction, and validation plan.
- [ ] Commit baseline and plan.

## Core vault and parser
- [ ] Define typed shared bridge contract.
- [ ] Implement bounded, conservative text parsing.
- [ ] Preserve existing used markers and leading zeros.
- [ ] Add schema validation and input limits.
- [ ] Implement bcrypt verifier and scrypt/AES-GCM envelope.
- [ ] Implement atomic private file writes and serialized mutations.
- [ ] Implement create/unlock/lock and summary-only listing.
- [ ] Implement password-protected single-code reveal.
- [ ] Implement explicit mark-used and cancel lifecycle.
- [ ] Test parser formats and ambiguity warnings.
- [ ] Test wrong password, tampering, persistence, and concurrency.
- [ ] Review core agent, request fixes, verify, and commit.

## Electron
- [ ] Add sandboxed main window and narrow preload bridge.
- [ ] Validate IPC sender and all input boundaries.
- [ ] Restrict navigation, popups, permissions, and network access.
- [ ] Integrate native clipboard with conditional expiry.
- [ ] Integrate encrypted backup export.
- [ ] Lock on idle, OS lock, and close.
- [ ] Enforce single instance and safe development profile path.
- [ ] Add desktop build/start/package scripts.
- [ ] Review Electron agent, request fixes, verify, and commit.

## Renderer
- [ ] Implement onboarding and unlock forms.
- [ ] Implement vault sidebar, list, search, and filters.
- [ ] Implement useful empty and exhausted states.
- [ ] Implement text-file selection and website/account fields.
- [ ] Implement editable parse preview and used-code checklist.
- [ ] Implement import persistence and error feedback.
- [ ] Implement password reveal, copy feedback, and explicit usage confirmation.
- [ ] Implement lock, encrypted export, and help.
- [ ] Handle async loading, errors, dialog focus, and keyboard navigation.
- [ ] Apply responsive layout and reduced motion.
- [ ] Review renderer agent, request fixes, verify, and commit.

## Integration and evidence
- [ ] Install required dependencies within project.
- [ ] Run typecheck, core tests, renderer build, and desktop bundle.
- [ ] Visually exercise onboarding/import/search/reveal/usage/lock.
- [ ] Exercise real Electron IPC and restart persistence.
- [ ] Review encryption boundaries and production configuration.
- [ ] Document setup, parser limits, security model, backups, and recovery.
- [ ] Update checklist and commit final reviewed integration.
