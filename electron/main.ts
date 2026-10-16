import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  powerMonitor,
  session,
} from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VaultError, VaultService } from "../src/core/vault";
import type { ImportInput } from "../src/shared/types";
import { readImportText } from "./import-file";

const root = app.getAppPath();
const rendererRoot = path.join(root, "dist");
const rendererURL = pathToFileURL(path.join(rendererRoot, "index.html")).href;
const idleSeconds = 5 * 60;
let window: BrowserWindow | null = null;
let service: VaultService;
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

function handle(name: string, action: (...args: unknown[]) => unknown): void {
  ipcMain.handle(name, async (event, ...args: unknown[]) => {
    if (!trustedSender(event)) throw new Error("This request is not allowed.");
    try {
      if (Date.now() - lastActivity >= idleSeconds * 1000) await lock();
      if (name !== "vault:status" && name !== "vault:list")
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
  handle("vault:create", async (password) => {
    await service.create(string(password, 72));
    lockAnnounced = false;
  });
  handle("vault:unlock", async (password) => {
    await service.unlock(string(password, 72));
    lockAnnounced = false;
  });
  handle("vault:lock", () => lock());
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
      filters: [{ name: "Text files", extensions: ["txt"] }],
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
    const { canceled, filePath } = await dialog.showSaveDialog(owner, {
      title: "Export encrypted vault",
      defaultPath: "bacom-vault.json",
      filters: [{ name: "Encrypted Bacom vault", extensions: ["json"] }],
      properties: ["showOverwriteConfirmation"],
    });
    if (canceled || !filePath) return false;
    const encrypted = await service.exportEncrypted();
    await writeFile(filePath, encrypted, { mode: 0o600 });
    return true;
  });
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
    title: "Bacom",
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
      registerIPC();
      powerMonitor.on("lock-screen", lifecycleLock);
      powerMonitor.on("suspend", lifecycleLock);
      setInterval(() => {
        if (Date.now() - lastActivity >= idleSeconds * 1000) lifecycleLock();
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
