# Bacom

An offline desktop vault for two-factor authentication backup codes. TypeScript, React, shadcn/ui, Tailwind CSS, and Electron, built with Bun.

## Run the desktop app

Use Bun 1.4.3 or newer and Node 22.12 or newer for Electron's installer.

```sh
bun install
bun run desktop:build
bun run desktop:start
```

If Electron's binary was not downloaded during installation, run `node node_modules/electron/install.js` once. The repository includes a local Bun dependency, so `npm install` followed by `npm run desktop:build` and `npm run desktop:start` also works when Bun is absent from your PATH. `bun.lock` is the primary lockfile; `package-lock.json` supports the npm bootstrap path.

The development vault is `.bacom-dev/userData/vault.json`. Development Electron profile/cache files stay inside `.bacom-dev`, which Git ignores. This is the actual encrypted vault: preserve it across rebuilds. An optional `BACOM_DEV_PROFILE` selects another folder inside this repository for isolated manual testing. Packaged applications use Electron's normal OS user-data location. Signing, installers, notarization, and automatic updates are not included in this local MVP.

## Use it

1. Create a master password of at least 12 characters, at most 72 UTF-8 bytes. There is no reset or recovery service.
2. Choose **Add codes**, enter the website and optional account label, and select its downloaded `.txt` or `.rtf` file.
3. Review every detected code against the original. Edit, remove, or add missed values. Check **Used** for codes already consumed. Save the reviewed list.
4. Select an account and choose **Reveal a code**. Enter the master password again, then copy the single code shown.
5. After the website accepts it, choose **Mark as used**. Copying or closing without confirmation leaves the count unchanged. The next reveal skips used codes.

Codes hide after 60 seconds, but the same prompt still allows usage confirmation. The app attempts to clear its copied code after 30 seconds, on prompt completion, and on lock, provided the clipboard still contains that code. Another app or clipboard-history utility may retain copies. The vault locks after five minutes without app activity, on OS lock/suspend, and on window close.

Choose Light, Dark, or System in the entry header or **Vault settings**. Only the theme preference is stored in renderer localStorage; credentials and recovery codes are never stored there.

### Optional Touch ID unlock

On a Mac with Touch ID configured, unlock with your master password, open **Vault settings**, and choose **Enable Touch ID**. Enrollment requires the master password and successful Touch ID verification. Bacom stores an OS-encrypted vault unlock key on this device, never your master password or fingerprint data. The sidecar is `device-auth.json` beside `vault.json` and is not included in exported backups.

After enrollment, reopening Bacom attempts Touch ID once. Canceling or an unavailable sensor leaves password access available; a button lets you retry. Manually locking does not automatically reopen the biometric prompt. Every recovery-code reveal still requires the master password. Disabling device unlock requires the master password and removes only its enrollment file.

This release supports macOS Touch ID first. Windows Hello and Linux device authentication are unavailable. Actual biometric success must be checked on a supported Mac; the development machine reported Touch ID unavailable. Development builds may trigger Keychain access prompts, and consistent app signing is needed for stable Keychain identity across updates.

## Import formats and limits

The parser detects common structural patterns rather than claiming verified support for every website: numeric/alphanumeric values, letter-only values, hyphenated or two-group alphabetic codes, numbered lines, `[ ]` / `[x]` checkboxes, spaced numeric groups, and multiword codes. It preserves leading zeros, case, and order. A multiword sequence stays one code, including internal spacing. Duplicate candidates are merged; if any duplicate is marked used, the merged value stays used. Common headings, URLs, dates, and instructions are skipped.

The four supplied example structures are covered: 10-letter lines, two alphabetic groups, hyphenated alphabetic groups, and the single long space-separated code. The original reference files remain local and are ignored by Git; regression tests use synthetic equivalents.

Numeric groups remain one code per line. Letter-only values and word sequences can resemble prose, so a preview and warnings always precede saving. Multi-column lists, uncommon word lengths, or lines over 128 characters may require manual correction. UTF-8 source files are limited to 1 MiB; imports allow 1,000 unique codes of at most 128 characters each. RTF support extracts visible text from RTF1/TextEdit documents with Windows-1252 hex escapes and Unicode controls. It skips formatting/hidden destinations and rejects malformed documents, embedded binary data, unsupported code pages, and excessive nesting. It never executes RTF content. The vault allows 500 account entries, 10,000 codes total, and an 8 MiB encrypted envelope. Duplicate codes for the same website are rejected across entries; website matching ignores case but does not infer that different URLs represent the same service.

## Motion

The app uses CSS-only entry, dialog, list, selection, and feedback animations. Dialogs enter in 200 ms and exit in 150 ms; list staggering stops at 120 ms rather than growing with account count. Sensitive dialog content is cleared immediately on close, and the main-process reveal token is released before the empty shell exits. Lock removes the dialog immediately. Reduced-motion mode disables motion from the first paint, including the JavaScript exit delay. No animation dependency is required.

Generating a fresh code set on a website typically invalidates the old one. Label the new entry clearly and use it. Bacom does not contact websites to verify validity or usage. Original downloaded files are left untouched.

## Storage and backup

**Vault settings → Export encrypted backup** saves the encrypted envelope using a native save dialog. The master password is still required. Export does not produce plaintext codes.

**Vault settings → Restore encrypted backup** lets you choose an exported `.json` backup and enter the master password used when it was made. Bacom asks you to confirm that restoration replaces the current vault, then verifies the selected backup and password before writing anything. The backup's password becomes the active password and its usage history is restored. Bacom removes Touch ID enrollment; if the OS prevents cleanup, it warns you, and the old device key cannot unlock the restored vault. Export the current vault first if you may need its latest changes. Restoring an older file also restores older usage counts; codes accepted since then must be treated as used.

Choose the auto-lock delay in **Vault settings → Auto-lock**. The available delays are 1, 5, 10, 15, and 30 minutes. This preference is saved separately from the encrypted vault.

## Development and checks

```sh
bun run dev                 # disposable browser preview at http://127.0.0.1:3000
bun run typecheck
bun run test
bun run desktop:build
```

The browser preview is explicitly disposable and intended for sample data. It encrypts an in-memory demo vault with WebCrypto; reload discards everything. It does not replace desktop storage. A missing Electron bridge causes an actionable startup failure instead of silently switching to demo mode.

For Electron renderer development, first build the desktop bundles, run the preview server, then launch with `BACOM_DEV_URL=http://127.0.0.1:3000 bun run desktop:start`. The packaged/local-file path does not require a server and blocks network requests.

See [PLAN.md](PLAN.md), [TASKS.md](TASKS.md), and [SECURITY.md](SECURITY.md) for the implementation plan, verification record, and security boundaries.
