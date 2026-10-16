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
2. Choose **Add codes**, enter the website and optional account label, and select its downloaded `.txt` file.
3. Review every detected code against the original. Edit, remove, or add missed values. Check **Used** for codes already consumed. Save the reviewed list.
4. Select an account and choose **Reveal a code**. Enter the master password again, then copy the single code shown.
5. After the website accepts it, choose **Mark as used**. Copying or closing without confirmation leaves the count unchanged. The next reveal skips used codes.

Codes hide after 60 seconds, but the same prompt still allows usage confirmation. The app attempts to clear its copied code after 30 seconds, on prompt completion, and on lock, provided the clipboard still contains that code. Another app or clipboard-history utility may retain copies. The vault locks after five minutes without app activity, on OS lock/suspend, and on window close.

Choose Light, Dark, or System in the entry header or **Vault settings**. Only the theme preference is stored in renderer localStorage; credentials and recovery codes are never stored there.

## Import formats and limits

The parser detects common structural patterns rather than claiming verified support for every website: plain numeric/alphanumeric values containing digits, hyphenated codes, numbered lines, `[ ]` / `[x]` checkboxes, and spaced numeric groups. It preserves leading zeros, case, and order. Duplicate candidates are merged; if any duplicate is marked used, the merged value stays used. Common headings, URLs, dates, and instructions are skipped.

Numeric groups remain one code per line. Multi-column lists and alphabet-only codes may require manual correction. A preview and warnings always precede saving. Files must be UTF-8 `.txt`, no larger than 1 MiB; imports allow 1,000 unique codes of at most 128 characters each. The vault allows 500 account entries, 10,000 codes total, and an 8 MiB encrypted envelope. Duplicate codes for the same website are rejected across entries; website matching ignores case but does not infer that different URLs represent the same service.

Generating a fresh code set on a website typically invalidates the old one. Label the new entry clearly and use it. Bacom does not contact websites to verify validity or usage. Original downloaded files are left untouched.

## Storage and backup

**Vault settings → Export encrypted backup** saves the encrypted envelope using a native save dialog. The master password is still required. Export does not produce plaintext codes.

To restore manually, close Bacom, preserve the current `vault.json` elsewhere, and copy the encrypted backup into its place. Launch Bacom and unlock with the password associated with that backup. Restoring an older file also restores its older usage counts; codes accepted since that backup must be treated as used. There is no in-app restore or password-change flow in this version.

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
