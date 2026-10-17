# Verification, 2026-10-16

## Optional motion and selector alignment, 2026-10-17

The General panel has a keyboard-accessible Animations switch, off on fresh storage. Both enabled and disabled states survive reload. The setting gates CSS transitions/animations, the JavaScript settings resize, and the dialog close delay. System Reduce Motion overrides it and cancels an active resize when its media query changes.

Chromium verification used a disposable synthetic desktop bridge, with no real vault access. The auto-lock dropdown is 44px high, aligns with its label, and has a chevron inset 12px from the right edge. General, Security, and Backups fit 760×600, 1160×800, and 390×844 without dialog overflow, including the unavailable-but-enabled Touch ID state. Light and dark captures were inspected. Default-off and reduced-motion category changes produced no animations; enabled changes produced both the selection transition and popup resize. Keyboard Space toggles the switch. Type checking, desktop build, whitespace checks, and scoped design detection pass. No findings were suppressed or left standing.

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

## Reference-format, device-unlock, and motion follow-up

- Automated suite now passes **40 tests and 176 assertions** across four files; type checking passes 30 source files and desktop bundling passes.
- Reviewed local example files by structure without logging values or committing originals. Read-only checks recognize all four structures. Repeated placeholder codes deduplicate; the fourth example remains one 101-character candidate with internal spaces intact.
- Added synthetic TextEdit-style RTF tests for metadata exclusion, line escapes, hex/Unicode controls, visibility reset, invalid nesting/code pages/binary controls, mixed-case letters, alphabetic groups, and a long word sequence with double spaces.
- Added device-key tests proving password-authorized enrollment, vault binding, authenticated decryption, and continued password requirements on reveals. Lock invalidates enrollment and device unlock in flight.
- Eighteen device-authentication tests use injected OS providers and repository-local sidecars. They cover cancellation, unavailable hardware/storage, corrupt/foreign credentials, concurrent prompts, atomic write cancellation, private file/directory modes, bounded files, symbolic links, and sidecar removal preserving the vault.
- No actual Keychain enrollment or biometric prompt was triggered during development. The native UI reports Touch ID unavailable on this machine and retains password access. A configured Touch ID Mac is required to verify real enrollment and fingerprint success. Windows Hello is outside the macOS-first scope confirmed by the user.
- Native smoke testing used the isolated `.cache/native-smoke-profile`, with its process profile paths checked before entering test credentials. Imported `tests/fixtures/sample-recovery.rtf`: four candidates appeared, including mixed case, a spaced value, a hyphenated value, and the complete long phrase with double spaces. Save succeeded and account/unused totals updated. The user's default vault was not modified.
- Inspected the updated native library and settings dialog. Error messages and code contents have no entry animation; dialogs use a 200 ms entry and a 150 ms empty-shell exit. Root review removed a proposed side stripe and moved token revocation ahead of the exit delay. Reduced-motion paths are verified in source, including the zero-delay close branch; the OS-wide accessibility preference was not changed for testing.
- Mechanical design detector returned no findings on App/CSS. No suppressions were added.

### Scoped Anti Slop delivery gate

- Hard gate PASS: native RTF import/preview/save and settings close operate; focus remains native-modal; all 40 tests pass and original reference files are ignored by Git.
- Purpose gate PASS: motion serves entry continuity, selection, pending work, and action feedback as recorded in PLAN.md; code text and urgent errors remain immediate.
- Liveliness PASS: ENERGY 2 / RHYTHM 3 / MOTION 3; bounded row arrival and quick dialog transitions add motion while preserving the approved palettes and layout.
- Craftsmanship PASS: 30-file type check, production renderer/Electron build, native layout inspection, source-verified reduced motion, and a clean mechanical design scan. Hardware limits are stated above rather than presented as verified success.

## Responsive window layout follow-up

The existing palette, typography, and motion direction remain authoritative: ENERGY 2 / RHYTHM 3 / MOTION 3. This is an Operate-mode refinement. Window height controls spacing and composition; category navigation replaces the long settings panel. Lists retain local scrolling for arbitrary amounts of data, and dialogs retain overflow fallback for enlarged text or unusually short browser viewports.

Chromium viewport checks used a disposable preview and a synthetic desktop bridge. These checks verify layout and renderer interaction, not live biometric hardware or native backup dialogs.

| View | Window | Result |
| --- | --- | --- |
| Vault with 20 synthetic accounts | 760×600, 1160×800, 1440×900, 390×844 | No document overflow in either axis |
| General, Security, Backups | Same four sizes | No settings scrollbar; tested Touch ID enrollment form, password errors, and backup feedback |
| Initial import / review of 20 codes | 760×600 | Dialog heights 510 / 529px within the 552px limit; only the code list scrolls |
| Onboarding | 760×600, 1160×800, 390×844 | No document overflow in either axis |
| Empty vault | 760×600 | All primary controls visible without document scrolling |

At 760×600, scrolling to the twentieth account moved the list by 1432px while document scroll remained zero and document height remained 600px. Settings keyboard activation with Enter and dismissal with Escape succeeded. Switching categories cleared both device-unlock and backup passwords. Sampled settings text contrast measured at least 6.24:1 in light mode and 5.78:1 in dark mode.

`bun run typecheck` passes 31 files. `bun run desktop:build` builds the renderer and both Electron bundles. The scoped Impeccable detector returned zero findings; no suppressions were added. Independent review found no state, security-boundary, or form-handler regressions.

### Scoped Anti Slop delivery gate

- Hard gate PASS: no added claims or assets; categories were explicitly approved. Viewport measurements, theme contrast checks, keyboard interaction, password clearing, and build evidence are recorded above. Existing loading, empty, error, and disabled states remain functional.
- Purpose gate PASS: category navigation exposes each task without a long dialog; paired columns use available width; fluid spacing uses window height; progressive disclosure keeps existing account guidance accessible while preserving room for Reveal.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 3 / MOTION 3 direction retained. Account content and settings controls remain the focal points; section gaps and the active-category underline communicate hierarchy with the approved palette.
- Craftsmanship PASS: type check, production build, rendered desktop/narrow inspection, keyboard checks, and clean detector result. No dependency or custom resize observer was introduced; CSS handles window adaptation.

## Borderless dialogs and category selection

The category highlight is a single CSS surface translated between the three buttons over 240ms. It uses the existing selection token: #e7e9ee against #fefefe in light mode and #373839 against #1f1f20 in dark mode. Buttons retain keyboard focus styling; selection itself adds no border, underline, or shadow. Dialog containers have neither borders nor outlines; their existing shadow preserves separation from the backdrop.

Chromium checks confirmed zero dialog border width, no container outline, no selection shadow, and highlight alignment within 0.02px of the selected button in both themes. Rapid repeated changes end on the correct category. Reduced motion reports a zero-second transition and immediately updates the selected position. The 390×844 viewport has no document or settings overflow. Type checking passes 31 files and the desktop bundle builds successfully. The mechanical design detector returned no findings; no suppressions were added.

- Hard gate PASS: category controls remain functional; selected backgrounds differ from the dialog; both themes, rapid switching, reduced motion, and narrow layout were exercised with a synthetic bridge.
- Purpose gate PASS: the moving highlight communicates category selection and continuity; no other surface gained animation.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 3 / MOTION 3 retained with one focused selection transition.
- Craftsmanship PASS: rendered inspection, computed-style checks, type checking, desktop build, and design detector pass; no animation dependency was introduced.

## Settings resize motion

Category changes capture the popup’s current rendered height before replacing its content. A layout effect animates from that height to the new natural height over 240ms, matching the category highlight’s easing. Content is clipped only during the transition to avoid temporary scrollbars. The animation releases its height when finished, and cleanup cancels it when interrupted or when the dialog closes. No animation runs when reduced motion is requested.

Chromium checks with a synthetic bridge at 760×600 measured a transition from 365px toward 509px with intermediate sizes. Interrupting growth at 398.48px started the reverse animation at the same 398.48px, then returned to the natural 365.19px height. Repeated category switches settled on Backups with no running animation, fixed inline height, or overflow. Reduced motion produced zero animations. Security also fit the 390×844 viewport without document or dialog overflow. No runtime errors occurred in the fresh verification page.

- Hard gate PASS: grow, shrink, interruption, repeated switching, reduced motion, and narrow layout checks passed; existing controls and security behavior remain unchanged.
- Purpose gate PASS: resizing communicates the change in category content without scaling text or adding another motion effect.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 3 / MOTION 3 retained; resizing and selection share timing and easing.
- Craftsmanship PASS: 31-file type check, desktop build, diff check, and scoped design detector pass. No dependencies or suppressions were added.
