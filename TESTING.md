# Verification, 2026-10-16

## Automated

- `bun run test`: 12 passed, 0 failed, 57 assertions across parser, vault, and native file-reader tests.
- `bun run typecheck`: 27 files, no type errors.
- `bun run desktop:build`: renderer HTML/CSS/JS and Electron main/preload CommonJS bundles build successfully.
- Dependency installation audit reported no known vulnerabilities at installation time.

Tests cover preservation of leading zeros and checkbox state, numeric-group ambiguity, duplicate-used merging, oversized/invalid UTF-8 files, wrong passwords, AES-GCM tampering, bounded/canonical envelopes, nonce freshness, private file modes, failed-save state preservation, duplicate imports, serialized mutations, reveal expiration/confirmation, concurrent locking, and old/new KDF-format compatibility.

## Native macOS smoke test

Used `tests/fixtures/sample-recovery.txt` and a generated password solely for testing. The preserved test profile is ignored at `.cache/native-smoke-profile`; the normal `.bacom-dev` profile is separate.

1. Created a vault in the real Electron window, closed the app, and unlocked it after restart.
2. Imported the fixture through the native picker. Preview showed exactly three codes, preserved `00112233`, and checked the existing used marker on `44556677`.
3. Saved the review. The account showed two unused codes out of three.
4. Entered a wrong password: no code appeared. The correct password revealed only `00112233`.
5. Chose Copy and saw copied feedback. Closing without using retained two available codes. A new reveal required the password again and offered the same unused code.
6. Chose Mark as used: the count became one available, two used. Restart retained those counts.
7. Searched a nonexistent website: the no-results state hid unrelated account details. Manual lock hid the library and required unlock.
8. Inspected the supplied dark and light palettes in the real app, including settings and code prompts. Semantic text/primary contrast was checked numerically during implementation. Theme selectors are available before and after unlock.
9. Exported an encrypted backup through the native save dialog into `.cache/bacom-vault.json`. An independent service instance authenticated and opened it: total 3, remaining 1, used 2. The file was mode 0600 and contained no sample website, codes, or password in plaintext.

## Review findings fixed

- Bun embedded the source directory in compiled `__dirname`, breaking preload loading. Paths now derive from `app.getAppPath()`. Compiled main no longer embeds the source-directory path.
- A missing desktop bridge initially fell back to demo mode. Electron now fails closed and presents an actionable error.
- Electron's asynchronous clipboard calls needed ordering. Copy and conditional clear operations are serialized.
- Local-file CSP needed an HTML meta policy; the desktop build injects it before assets.
- Expiring a reveal initially prevented later usage confirmation. Secret access expires separately from the confirmation token.
- Duplicate parsed lines initially could lose a used marker. Any used duplicate now keeps the merged code used.
- Import validation errors initially erased the review, and save errors could lose the confirmation token. Users can now correct imports or retry confirmation.
- The Chromium file-input picker left a selected `.txt` disabled on this machine. Desktop import now uses a native dialog and a bounded main-process UTF-8 reader; native import succeeded afterward.
- Idle tracking now includes native mouse events and consistently uses app activity. OS lock/suspend still locks immediately.
- New vaults use stronger scrypt parameters; legacy development vaults remain readable without changing their encryption scheme.

## Limits of verification

This verifies the local macOS development app. Windows/Linux packaging, signing, notarization, automatic updates, narrow browser screenshots, OS lock/suspend events, clipboard-manager behavior, and crash/power-loss durability have not been exhaustively exercised. Native dialog focus and keyboard operation were used during testing; no formal screen-reader audit was performed. Responsive/reduced-motion styles are implemented, but no claim is made that every viewport or assistive-technology combination was tested. No independent security assessment has been performed.
