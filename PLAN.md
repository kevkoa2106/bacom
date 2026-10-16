# Bacom implementation plan

## Outcome and scope
Build a local, offline Electron desktop vault for website recovery codes using TypeScript, React, shadcn components, and Tailwind. Keep the existing Bun build and development server for renderer previews. No cloud account, telemetry, remote fonts, or syncing. An encrypted vault file is the durable source of truth. Browser preview must be clearly labeled and must not silently store real secrets in plaintext.

## Security design
Bcrypt is a one-way password hash, not encryption. Store a bcrypt verifier (cost 12) and use scrypt with a fresh random salt to derive a 256-bit AES-GCM key from the master password. Encrypt all website metadata, codes, and usage state together. Each write gets a fresh nonce. Validate envelope sizes and versions before expensive work; authenticated decryption must fail closed. Reject overlong passwords rather than accept bcrypt truncation. Never persist a master password or an unencrypted vault. Atomic replacement, restrictive permissions, serialized mutations, and one running instance protect consistency. Plaintext exists in process memory only while unlocked. The main process owns filesystem and cryptography; a sandboxed renderer receives only account summaries except during explicit import/reveal. Authenticate every reveal, keep one active reveal, and mark a code used only after the user explicitly confirms. Closing without confirmation leaves it unused. Copying never changes usage. Clear copied content after a short timeout if it still matches. Lock on inactivity, system lock, and window close. No automatic password reset or vault deletion.

## Architecture and shared contract
- `src/shared/types.ts`: AccountSummary `{id, website, label, createdAt, total, remaining, used}`, ParsedCode `{value, used}`, ParseResult `{format, codes, warnings}`, ImportInput `{website, label, codes}`, RevealResult `{token, code, accountId}`. `VaultStatus` `{exists, unlocked}`.
- `VaultAPI`: `status()`, `create(password)`, `unlock(password)`, `lock()`, `list()`, `parse(text, website)`, `importCodes(input)`, `reveal(accountId,password)`, `finishReveal(token,used)`, `copy(token)`, `exportVault()`. Async methods. Main process returns safe actionable errors. Summaries have no codes. `window.bacom` exposes these methods individually. Renderer fallback lives in a separate adapter and is explicitly a demo.
- `src/core/parser.ts`: deterministic local parsing for numbered, checkbox, grouped numeric, hyphenated/alphanumeric lines. Preserve code spelling, leading zeros, used markers, and order; deduplicate with warnings. Ignore known prose; flag ambiguity. Users review and edit candidates before import. Never claim universal format coverage.
- `src/core/vault.ts`: encryption, schema checks, atomic file persistence and service state, bounded inputs, serialized operations, password verification, explicit-use reveal lifecycle. Independent of Electron for meaningful filesystem tests.
- `electron/main.ts`, `electron/preload.ts`: lifecycle, safe IPC, native save dialog, clipboard, lock hooks, navigation restrictions. Main process uses Node APIs required by Electron.
- `src/App.tsx`, `src/index.css`: complete UI and adapter. Onboarding, lock screen, account library, search/status filter, selected account summary, import preview/checklist, password reveal, copy and explicit mark-used confirmation, encrypted backup export, settings/help. No fake account data in a real vault.

## Design direction
User-approved palette direction: dark uses `#dbdbdb`, `#999999`, `#5f6062`, `#373839`, `#1f1f20`, `#0a0a0a`; light uses `#fefefe`, `#f7f9fa`, `#e7e9ee`, `#caccd5`, `#909ffa`, `#a1a0a5`. Dark shades provide readable text on light surfaces. Light, Dark, and System controls persist only the appearance preference. Desktop sidebar and practical account rows, no marketing hero or fake security badges. Local system fonts and Lucide icons; keyboard-accessible dialogs, visible labels, inline errors, empty/loading states, reduced motion, and narrow-window layout. UI/UX Pro Max's Swiss/minimal style fits the utility; its marketing/conversion pattern does not. Apply Anti Slop during work under the user's instruction to proceed autonomously.

## Delivery sequence
1. Commit the plan/checklist and baseline. Delegate core, Electron integration, and renderer work against the shared contract.
2. Review each agent's output, give concrete findings and obtain fixes. Validate each part and commit it separately with a concise description.
3. Integrate build scripts/dependencies, run type checking, core tests, renderer build, and Electron bundling.
4. Exercise browser UI and real desktop behavior where supported. Verify import, unlock, reveal, copy, explicit usage, reload persistence, tampering, wrong password, duplicate imports, and failure handling.
5. Review sensitive boundaries, document supported parser patterns and recovery limitations, update checklist with evidence, and commit final integration.

## Validation limits
Tests establish specific behaviors, not a security certification. OS packaging, signing, notarization, and distribution require platform credentials and remain outside local MVP scope. A forgotten master password cannot be recovered. The original downloaded text files remain the user's responsibility; Bacom never deletes them. Encrypted backup export writes only after an explicit native save selection. Development must keep Electron profile/cache paths inside the repository until the user authorizes changes outside it.
