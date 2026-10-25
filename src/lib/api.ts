import type {
  AccountSummary,
  ImportInput,
  RevealResult,
  VaultAPI,
} from "../shared/types";
import { parseCodes } from "../core/parser";

const desktopWithoutBridge =
  /Electron\//.test(navigator.userAgent) && !window.bacom;
export const isPreview = !window.bacom && !desktopWithoutBridge;

// Browser previews are deliberately disposable: only ciphertext survives a lock,
// and nothing survives a reload. The Electron bridge owns the durable vault.
function previewAPI(): VaultAPI {
  type Account = ImportInput & { id: string; createdAt: string };
  let encrypted: ArrayBuffer | undefined;
  let salt = crypto.getRandomValues(new Uint8Array(16));
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let key: CryptoKey | undefined;
  let accounts: Account[] | undefined;
  let active: (RevealResult & { index: number; expiresAt: number }) | undefined;
  const derive = async (password: string) => {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  };
  const requireOpen = () => {
    if (!accounts || !key) throw new Error("Your vault is locked.");
    return accounts;
  };
  const save = async () => {
    iv = crypto.getRandomValues(new Uint8Array(12));
    encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key!,
      new TextEncoder().encode(JSON.stringify(accounts)),
    );
  };
  const authenticate = async (password: string) => {
    if (!encrypted) throw new Error("Create a preview vault first.");
    try {
      const candidate = await derive(password);
      const data = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        candidate,
        encrypted,
      );
      return { candidate, data };
    } catch {
      throw new Error("Incorrect master password.");
    }
  };
  return {
    status: async () => ({ exists: !!encrypted, unlocked: !!accounts }),
    create: async (password) => {
      if (encrypted) throw new Error("A preview vault already exists.");
      const bytes = new TextEncoder().encode(password).length;
      if (password.length < 12 || bytes > 72)
        throw new Error(
          "Use at least 12 characters and no more than 72 UTF-8 bytes.",
        );
      key = await derive(password);
      accounts = [];
      await save();
    },
    unlock: async (password) => {
      const result = await authenticate(password);
      accounts = JSON.parse(new TextDecoder().decode(result.data));
      key = result.candidate;
    },
    lock: async () => {
      accounts = undefined;
      key = undefined;
      active = undefined;
    },
    list: async () =>
      requireOpen().map(
        ({ id, website, label, createdAt, codes }): AccountSummary => ({
          id,
          website,
          label,
          createdAt,
          total: codes.length,
          used: codes.filter((c) => c.used).length,
          remaining: codes.filter((c) => !c.used).length,
        }),
      ),
    parse: async (text, website) => {
      requireOpen();
      return parseCodes(text, website);
    },
    importCodes: async (input) => {
      const list = requireOpen();
      if (
        !input.website.trim() ||
        input.website.length > 2048 ||
        input.label.length > 120 ||
        !input.codes.length ||
        input.codes.length > 1000 ||
        input.codes.some((c) => !c.value.trim() || c.value.length > 128)
      )
        throw new Error("Add a website and at least one nonempty code.");
      list.push({
        ...input,
        codes: input.codes.map((c) => ({ ...c })),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await save();
    },
    renameAccount: async (id, website, label) => {
      const account = requireOpen().find((a) => a.id === id);
      if (!account) throw new Error("This account could not be found.");
      if (!website.trim() || website.length > 2048 || label.length > 120)
        throw new Error("Enter a website and a label of at most 120 characters.");
      account.website = website.trim();
      account.label = label.trim();
      await save();
    },
    removeAccount: async (id, password) => {
      const list = requireOpen();
      await authenticate(password);
      const index = list.findIndex((a) => a.id === id);
      if (index < 0) throw new Error("This account could not be found.");
      list.splice(index, 1);
      if (active?.accountId === id) active = undefined;
      await save();
    },
    reveal: async (id, password) => {
      requireOpen();
      await authenticate(password);
      if (active && active.expiresAt > Date.now())
        throw new Error("Close the current code prompt first.");
      const account = requireOpen().find((a) => a.id === id);
      const index = account?.codes.findIndex((c) => !c.used) ?? -1;
      if (!account || index < 0)
        throw new Error("There are no unused codes in this set.");
      active = {
        token: crypto.randomUUID(),
        code: account.codes[index]!.value,
        accountId: id,
        index,
        expiresAt: Date.now() + 60000,
      };
      return { token: active.token, code: active.code, accountId: id };
    },
    finishReveal: async (token, used) => {
      const list = requireOpen();
      if (!active || active.token !== token)
        throw new Error("This code prompt has expired.");
      const current = active;
      active = undefined;
      if (used) {
        const account = list.find((a) => a.id === current.accountId)!;
        account.codes[current.index]!.used = true;
        await save();
      }
    },
    copy: async (token) => {
      requireOpen();
      if (!active || active.token !== token || active.expiresAt <= Date.now())
        throw new Error("This code prompt has expired.");
      await navigator.clipboard.writeText(active.code);
      const copied = active.code;
      setTimeout(() => {
        void navigator.clipboard
          .readText()
          .then((value) =>
            value === copied ? navigator.clipboard.writeText("") : undefined,
          )
          .catch(() => {});
      }, 30000);
    },
    exportVault: async () => {
      throw new Error(
        "Encrypted file export is available in the desktop app. This browser preview resets on reload.",
      );
    },
  };
}

const unavailableAPI = new Proxy({} as VaultAPI, {
  get: (_target, method) =>
    method === "onLocked"
      ? undefined
      : async () => {
          throw new Error(
            "The desktop vault could not start. Close Bacom, rebuild the desktop app, and try again. No codes have been saved.",
          );
        },
});

export const api: VaultAPI =
  window.bacom ?? (desktopWithoutBridge ? unavailableAPI : previewAPI());
