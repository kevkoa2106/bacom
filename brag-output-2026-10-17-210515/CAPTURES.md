# Screenshot provenance

All PNGs in composition/assets/captures/ are screenshots of the actual Bacom Electron renderer, not recreated UI or model-generated images. A new repository-local profile under .cache isolates the demo from the user's vault. The app's own preload bridge imports synthetic records and the normal UI opens settings, authenticates, reveals, copies, and confirms usage. No private profile, real password, or real recovery-code file was read.

Source viewport:1440×900 logical pixels, captured at4× pixel density for enlarged product details in the4K export. Full images are5760×3600. Dialogs and account details use their CSS bounds with Chrome DevTools screenshot capture at the same density. The native file-picker return is controlled to select demo-recovery-codes.txt; Bacom itself reads and parses the file. The capture script isolates clipboard operations in memory so reruns leave the host clipboard untouched. Each rerun uses a fresh profile and never deletes an existing one.

Data: four synthetic accounts (github.com, google.com, discord.com, proton.me), labels Personal/Work/Community/Mail,20 synthetic code values. GitHub begins with3 unused codes; one is marked used through the real confirmation button, leaving2. Codes in the film are visibly demo values. example.com is used for the unsaved import preview.

Reproduce from composition/:

```sh
bun install
bun capture-app.mjs
```

Build the parent app first if its Electron bundles are absent. The capture script launches and closes its own Electron instance. The product source is unchanged.
