import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  powerMonitor,
  session,
  safeStorage,
  systemPreferences,
} from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VaultError, VaultService } from "../src/core/vault";
import type { AutoLockMinutes, ImportInput } from "../src/shared/types";
import { readImportText } from "./import-file";
import { DeviceAuthService, FileDeviceAuthStore } from "./device-auth";
import type { DeviceAuthProvider } from "./device-auth";
import {
  parseAutoLockMinutes,
  readAutoLockMinutes,
  readBoundedRegularFile,
  writeAutoLockMinutes,
} from "./settings-store";

const root = app.getAppPath();
const isolatedTestProfile = !app.isPackaged && !!process.env.BACOM_DEV_PROFILE;
const rendererRoot = path.join(root, "dist");
const rendererURL = pathToFileURL(path.join(rendererRoot, "index.html")).href;
let autoLockMinutes: AutoLockMinutes = 5;
let preferencesFile: string;
let preferenceWrites: Promise<void> = Promise.resolve();
let restoringVault = false;
let window: BrowserWindow | null = null;
let service: VaultService;
let deviceAuth: DeviceAuthService;
let lastActivity = Date.now();
let copiedCode: string | null = null;
let clipboardTimer: ReturnType<typeof setTimeout> | undefined;
let lockAnnounced = true;
let clipboardQueue: Promise<void> = Promise.resolve();
let quitting = false;
let lockGeneration = 0;

// Electron otherwise creates its development profile in the user's Library.
if (!app.isPackaged) {
  const profile = path.resolve(
    root,
    process.env.BACOM_DEV_PROFILE ?? ".bacom-dev",
  );
  const relative = path.relative(root, profile);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "The development profile must be a folder inside the repository.",
    );
  }
  for (const name of [
    "appData",
    "userData",
    "sessionData",
    "crashDumps",
  ] as const) {
    const location = path.join(profile, name);
    mkdirSync(location, { recursive: true, mode: 0o700 });
    app.setPath(name, location);
  }
  app.setAppLogsPath(path.join(profile, "logs"));
  app.commandLine.appendSwitch("disk-cache-dir", path.join(profile, "cache"));
}
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");

function developmentURL(): string | undefined {
  if (app.isPackaged || !process.env.BACOM_DEV_URL) return undefined;
  const url = new URL(process.env.BACOM_DEV_URL);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error("BACOM_DEV_URL must be a local HTTP server.");
  }
  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error("BACOM_DEV_URL must use the server root.");
  return url.href;
}
const devURL = developmentURL();
const documentURL = devURL ?? rendererURL;

function clipboardOperation(action: () => Promise<void>): Promise<void> {
  const operation = clipboardQueue.then(action);
  clipboardQueue = operation.catch(() => {});
  return operation;
}

function clearCopiedCode(): Promise<void> {
  if (clipboardTimer) clearTimeout(clipboardTimer);
  clipboardTimer = undefined;
  return clipboardOperation(async () => {
    if (copiedCode !== null && (await clipboard.readText()) === copiedCode)
      clipboard.clear();
    copiedCode = null;
  });
}

async function lock(): Promise<void> {
  lockGeneration++;
  deviceAuth?.invalidate();
  await service.lock();
  if (!lockAnnounced && window && !window.isDestroyed())
    window.webContents.send("vault:locked");
  lockAnnounced = true;
  await clearCopiedCode();
}

function lifecycleLock(): void {
  // Lock clears service memory before touching the OS clipboard, which can fail.
  void lock().catch(() => {});
}

function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.length || value.length > max)
    throw new Error("Invalid input.");
  return value;
}

function importInput(value: unknown): ImportInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid import.");
  const input = value as Record<string, unknown>;
  const website = string(input.website, 2048);
  if (typeof input.label !== "string" || input.label.length > 120)
    throw new Error("Invalid account label.");
  if (
    !Array.isArray(input.codes) ||
    !input.codes.length ||
    input.codes.length > 1000
  )
    throw new Error("Import between 1 and 1000 codes.");
  const codes = input.codes.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid code.");
    const code = item as Record<string, unknown>;
    if (typeof code.used !== "boolean") throw new Error("Invalid usage state.");
    return { value: string(code.value, 256), used: code.used };
  });
  return { website, label: input.label, codes };
}

function trustedSender(event: IpcMainInvokeEvent): boolean {
  return (
    !!window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === documentURL
  );
}

function assertRestoreAllows(name: string): void {
  if (
    restoringVault &&
    ![
      "vault:status",
      "vault:list",
      "vault:lock",
      "vault:get-auto-lock",
      "vault:device-auth-status",
    ].includes(name)
  )
    throw new VaultError(
      "Finish or cancel the backup restore before another operation.",
    );
}

function handle(name: string, action: (...args: unknown[]) => unknown): void {
  ipcMain.handle(name, async (event, ...args: unknown[]) => {
    if (!trustedSender(event)) throw new Error("This request is not allowed.");
    try {
      assertRestoreAllows(name);
      if (Date.now() - lastActivity >= autoLockMinutes * 60_000) await lock();
      assertRestoreAllows(name);
      if (
        name !== "vault:status" &&
        name !== "vault:list" &&
        name !== "vault:device-auth-status" &&
        name !== "vault:get-auto-lock"
      )
        lastActivity = Date.now();
      return await action(...args);
    } catch (error) {
      // Never send filesystem paths or internal exceptions across the bridge.
      if (error instanceof Error && error.name === "VaultError")
        throw new Error(error.message);
      throw new Error(
        "The operation could not be completed. Check your input and try again.",
      );
    }
  });
}

function registerIPC(): void {
  handle("vault:status", () => service.status());
  handle("vault:get-auto-lock", () => autoLockMinutes);
  handle("vault:set-auto-lock", (value) => {
    const minutes = parseAutoLockMinutes(value);
    const update = preferenceWrites.then(async () => {
      await writeAutoLockMinutes(preferencesFile, minutes);
      autoLockMinutes = minutes;
    });
    preferenceWrites = update.catch(() => {});
    return update;
  });
  handle("vault:create", async (password) => {
    deviceAuth.invalidate();
    await service.create(string(password, 72));
    lockAnnounced = false;
  });
  handle("vault:unlock", async (password) => {
    deviceAuth.invalidate();
    await service.unlock(string(password, 72));
    lockAnnounced = false;
  });
  handle("vault:lock", () => lock());
  handle("vault:device-auth-status", () => deviceAuth.status());
  handle("vault:enable-device-auth", (password) =>
    deviceAuth.enable(string(password, 72)),
  );
  handle("vault:disable-device-auth", (password) =>
    deviceAuth.disable(string(password, 72)),
  );
  handle("vault:unlock-with-device", async () => {
    await deviceAuth.unlock();
    lockAnnounced = false;
  });
  handle("vault:list", () => service.list());
  handle("vault:parse", (text, website) =>
    service.parse(string(text, 1024 * 1024), string(website, 2048)),
  );
  handle("vault:choose-file", async (website) => {
    if (typeof website !== "string" || website.length > 2048)
      throw new VaultError("Enter a website of at most 2,048 characters.");
    const site = website;
    const owner = window;
    if (!owner || !(await service.status()).unlocked)
      throw new VaultError("Unlock the vault first.");
    const generation = lockGeneration;
    const { canceled, filePaths } = await dialog.showOpenDialog(owner, {
      title: "Import backup codes",
      buttonLabel: "Import text file",
      filters: [{ name: "Text files", extensions: ["txt", "rtf"] }],
      properties: ["openFile"],
    });
    const selected = filePaths[0];
    if (canceled || !selected) return null;
    if (generation !== lockGeneration)
      throw new VaultError(
        "The vault locked while selecting a file. Unlock it and try again.",
      );
    const text = await readImportText(selected);
    if (generation !== lockGeneration)
      throw new VaultError(
        "The vault locked while reading the file. Unlock it and try again.",
      );
    return {
      name: path.basename(selected),
      result: await service.parse(text, site),
    };
  });
  handle("vault:import", (input) => service.importCodes(importInput(input)));
  handle("vault:reveal", (accountId, password) =>
    service.reveal(string(accountId, 128), string(password, 72)),
  );
  handle("vault:finish", async (token, used) => {
    if (typeof used !== "boolean") throw new Error("Invalid confirmation.");
    await service.finishReveal(string(token, 128), used);
    await clearCopiedCode();
  });
  handle("vault:copy", async (token) => {
    const revealToken = string(token, 128);
    await clipboardOperation(async () => {
      const code = service.getActiveCode(revealToken);
      await clipboard.writeText(code);
      copiedCode = code;
      if (clipboardTimer) clearTimeout(clipboardTimer);
      clipboardTimer = setTimeout(() => {
        void clearCopiedCode().catch(() => {});
      }, 30_000);
    });
  });
  handle("vault:export", async () => {
    const owner = window;
    if (!owner) return false;
    const generation = lockGeneration;
    const { canceled, filePath } = await dialog.showSaveDialog(owner, {
      title: "Export encrypted vault",
      defaultPath: "bacom-vault.json",
      filters: [{ name: "Encrypted Bacom vault", extensions: ["json"] }],
      properties: ["showOverwriteConfirmation"],
    });
    if (canceled || !filePath) return false;
    if (generation !== lockGeneration || owner.isDestroyed())
      throw new VaultError(
        "The vault changed while choosing an export location. Try again.",
      );
    const encrypted = await service.exportEncrypted();
    await writeFile(filePath, encrypted, { mode: 0o600 });
    return true;
  });
  handle("vault:restore-backup", async (inputPassword) => {
    if (restoringVault)
      throw new VaultError(
        "Finish or cancel the current backup restore first.",
      );
    restoringVault = true;
    let bytes: Buffer | undefined;
    try {
      const password = string(inputPassword, 72);
      const owner = window;
      let generation = lockGeneration;
      if (!owner || !(await service.status()).unlocked)
        throw new VaultError("Unlock the vault before restoring a backup.");
      const assertCurrent = () => {
        if (generation !== lockGeneration || owner.isDestroyed())
          throw new VaultError(
            "The vault locked or changed during backup selection. Unlock it and try again.",
          );
      };
      assertCurrent();
      const { canceled, filePaths } = await dialog.showOpenDialog(owner, {
        title: "Restore encrypted vault backup",
        buttonLabel: "Choose backup",
        filters: [{ name: "Encrypted Bacom vault", extensions: ["json"] }],
        properties: ["openFile"],
      });
      const selected = filePaths[0];
      if (canceled || !selected) return false;
      assertCurrent();
      if (path.extname(selected).toLowerCase() !== ".json")
        throw new VaultError("Choose an encrypted .json Bacom backup.");
      bytes = await readBoundedRegularFile(selected, 8 * 1024 * 1024);
      assertCurrent();
      const confirmation = await dialog.showMessageBox(owner, {
        type: "warning",
        title: "Replace your current vault?",
        message: "Restoring this backup replaces your current vault.",
        detail:
          "Accounts, recovery codes, and usage states will be replaced by this backup. Its master password becomes your active password, and device unlock will be turned off. Export your current vault first if you need to keep it.",
        buttons: ["Cancel", "Replace vault"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (confirmation.response !== 1) return false;
      assertCurrent();
      generation = ++lockGeneration;
      deviceAuth.invalidate();
      await clearCopiedCode();
      assertCurrent();
      await service.importEncryptedBackup(bytes, password);
      try {
        deviceAuth = makeDeviceAuth();
        await deviceAuth.disable(password);
      } catch {
        console.warn(
          "Bacom restored the vault; device unlock cleanup could not finish.",
        );
        if (!owner.isDestroyed()) {
          try {
            await dialog.showMessageBox(owner, {
              type: "warning",
              title: "Backup restored",
              message:
                "Your backup was restored, but old device unlock settings could not be removed.",
              detail:
                "The old device unlock secret cannot unlock the restored vault. Use the backup's master password, then disable or enroll device unlock again in Settings.",
              buttons: ["OK"],
            });
          } catch {
            /* A closed window cannot turn a committed restore into a failure. */
          }
        }
      }
      return true;
    } finally {
      bytes?.fill(0);
      restoringVault = false;
    }
  });
}

function makeDeviceAuth(): DeviceAuthService {
  return new DeviceAuthService(
    service,
    deviceAuthProvider(),
    new FileDeviceAuthStore(
      path.join(app.getPath("userData"), "device-auth.json"),
    ),
  );
}

function deviceAuthProvider(): DeviceAuthProvider {
  const mac = process.platform === "darwin";
  return {
    platform: process.platform,
    label: mac
      ? "Touch ID"
      : process.platform === "win32"
        ? "Windows Hello"
        : "Device unlock",
    unsupportedReason: mac
      ? "Touch ID is not available. Set up Touch ID in macOS or use your master password."
      : process.platform === "win32"
        ? "Windows Hello requires a native desktop adapter, which is not included in this build. Use your master password."
        : "Device unlock is not supported on this platform. Use your master password.",
    available: () => mac && systemPreferences.canPromptTouchID(),
    authenticate: async (reason) => {
      if (!mac) throw new VaultError("Device authentication is unavailable.");
      await systemPreferences.promptTouchID(reason);
    },
    // These calls can access Keychain; invoke them only following a user-approved biometric prompt.
    encryptionAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
    wrap: (secret) => safeStorage.encryptStringAsync(secret),
    unwrap: (bytes) => safeStorage.decryptStringAsync(bytes),
  };
}

async function createWindow(): Promise<void> {
  const isolatedSession = session.fromPartition("persist:bacom");
  isolatedSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  isolatedSession.setPermissionCheckHandler(() => false);
  isolatedSession.on("will-download", (event) => event.preventDefault());
  isolatedSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      if (devURL) {
        const origin = new URL(devURL);
        allowed =
          ["http:", "ws:"].includes(url.protocol) &&
          url.hostname === origin.hostname &&
          url.port === origin.port;
      } else if (url.protocol === "file:") {
        const relative = path.relative(rendererRoot, fileURLToPath(url));
        allowed =
          relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative);
      } else allowed = url.protocol === "data:";
    } catch {
      /* Malformed URLs are blocked. */
    }
    callback({ cancel: !allowed });
  });
  const source = devURL ? new URL(devURL).origin : "'self'";
  const connect = devURL
    ? `${source} ${source.replace("http:", "ws:")}`
    : "'none'";
  const csp = `default-src 'none'; script-src ${source}${devURL ? " 'unsafe-eval'" : ""}; style-src ${source} 'unsafe-inline'; img-src ${source} data:; font-src ${source}; connect-src ${connect}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
  isolatedSession.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    }),
  );
  window = new BrowserWindow({
    title: isolatedTestProfile ? "Bacom · Test profile" : "Bacom",
    width: 1160,
    height: 800,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: "#f5f3ed",
    show: false,
    webPreferences: {
      preload: path.join(root, "dist-electron", "preload.cjs"),
      session: isolatedSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });
  window.webContents.on("preload-error", () => {
    console.error(
      "Bacom preload failed to initialize; closing the vault window.",
    );
    lifecycleLock();
    dialog.showErrorBox(
      "Bacom could not start",
      "The desktop bridge failed to load. Rebuild the desktop application and try again.",
    );
    app.quit();
  });
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, _description, _url, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      console.error(`Bacom renderer failed to load (error ${errorCode}).`);
      lifecycleLock();
      dialog.showErrorBox(
        "Bacom could not start",
        "The application interface failed to load. Rebuild the desktop application and try again.",
      );
      app.quit();
    },
  );
  window.setMenuBarVisibility(false);
  if (isolatedTestProfile)
    window.webContents.on("page-title-updated", (event) =>
      event.preventDefault(),
    );
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-frame-navigate", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("before-input-event", () => {
    lastActivity = Date.now();
  });
  window.webContents.on("before-mouse-event", () => {
    lastActivity = Date.now();
  });
  window.webContents.on("render-process-gone", lifecycleLock);
  window.once("ready-to-show", () => window?.show());
  window.on("close", lifecycleLock);
  window.on("closed", () => {
    window = null;
  });
  await window.loadURL(documentURL);
  if (isolatedTestProfile) window.setTitle("Bacom · Test profile");
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      service = new VaultService(
        path.join(app.getPath("userData"), "vault.json"),
      );
      deviceAuth = makeDeviceAuth();
      preferencesFile = path.join(app.getPath("userData"), "preferences.json");
      autoLockMinutes = await readAutoLockMinutes(preferencesFile);
      registerIPC();
      powerMonitor.on("lock-screen", lifecycleLock);
      powerMonitor.on("suspend", lifecycleLock);
      setInterval(() => {
        if (Date.now() - lastActivity >= autoLockMinutes * 60_000)
          lifecycleLock();
      }, 10_000).unref();
      await createWindow();
    })
    .catch(() => {
      dialog.showErrorBox(
        "Bacom could not start",
        "Check that the application build is complete and that its local data folder is writable.",
      );
      app.quit();
    });
  app.on("activate", () => {
    if (!window && service) void createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (quitting || !service) return;
    event.preventDefault();
    quitting = true;
    void lock()
      .catch(() => {})
      .finally(() => app.quit());
  });
}
