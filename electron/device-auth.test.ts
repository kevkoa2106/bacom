import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { DeviceAuthService, FileDeviceAuthStore } from "./device-auth";
import type {
  DeviceAuthProvider,
  DeviceAuthStore,
  DeviceAuthVault,
} from "./device-auth";

function fixture() {
  let record: Buffer | null = null;
  const calls: string[] = [];
  const vault: DeviceAuthVault = {
    async createDeviceUnlockSecret(password) {
      calls.push("verify-password");
      if (password !== "correct-password") throw new Error("Wrong password");
      return "bound-vault-secret";
    },
    async unlockWithDeviceSecret(secret) {
      calls.push("unlock");
      if (secret !== "bound-vault-secret")
        throw new Error("Vault binding changed");
    },
  };
  const provider: DeviceAuthProvider = {
    platform: "test",
    label: "Test biometrics",
    unsupportedReason: "Biometrics unavailable",
    available: () => true,
    async authenticate() {
      calls.push("authenticate");
    },
    async encryptionAvailable() {
      calls.push("encryption-available");
      return true;
    },
    async wrap() {
      calls.push("wrap");
      return Buffer.from("wrapped-secret");
    },
    async unwrap() {
      calls.push("unwrap");
      return { result: "bound-vault-secret", shouldReEncrypt: false };
    },
  };
  const store: DeviceAuthStore = {
    async read() {
      return record ? Buffer.from(record) : null;
    },
    async write(bytes, assertCurrent) {
      assertCurrent();
      calls.push("write");
      record = Buffer.from(bytes);
    },
    async remove(assertCurrent) {
      assertCurrent();
      calls.push("remove");
      record = null;
    },
  };
  const auth = new DeviceAuthService(vault, provider, store);
  return { auth, provider, vault, calls, store, getRecord: () => record };
}

describe("optional device authentication", () => {
  test("status never accesses protected storage or opens an authentication prompt", async () => {
    const { auth, calls } = fixture();
    expect(await auth.status()).toEqual({
      supported: true,
      enabled: false,
      label: "Test biometrics",
    });
    expect(calls).toEqual([]);
  });

  test("enrollment verifies password and authenticates before wrapping; only ciphertext is saved", async () => {
    const { auth, calls, getRecord } = fixture();
    await auth.enable("correct-password");
    expect(calls).toEqual([
      "verify-password",
      "authenticate",
      "encryption-available",
      "wrap",
      "write",
    ]);
    expect(getRecord()?.toString()).not.toContain("bound-vault-secret");
    expect(getRecord()?.toString()).not.toContain("correct-password");
    expect((await auth.status()).enabled).toBe(true);
    await auth.unlock();
    expect(calls.slice(-4)).toEqual([
      "authenticate",
      "encryption-available",
      "unwrap",
      "unlock",
    ]);
  });

  test("wrong password or rejected biometric enrollment never persists a secret", async () => {
    const f = fixture();
    await expect(f.auth.enable("wrong-password")).rejects.toThrow(
      "Wrong password",
    );
    expect(f.calls).toEqual(["verify-password"]);
    f.provider.authenticate = async () => {
      throw new Error("User canceled");
    };
    await expect(f.auth.enable("correct-password")).rejects.toThrow(
      "canceled or unavailable",
    );
    expect(f.getRecord()).toBeNull();
    expect(f.calls).not.toContain("wrap");
  });

  test("unsupported hardware and unavailable protected storage fail closed", async () => {
    const f = fixture();
    f.provider.available = () => false;
    expect((await f.auth.status()).supported).toBe(false);
    await expect(f.auth.enable("correct-password")).rejects.toThrow(
      "Biometrics unavailable",
    );
    expect(f.calls).not.toContain("authenticate");
    f.provider.available = () => true;
    f.provider.encryptionAvailable = async () => false;
    await expect(f.auth.enable("correct-password")).rejects.toThrow(
      "Protected device storage is unavailable",
    );
    expect(f.calls).not.toContain("wrap");
    expect(f.getRecord()).toBeNull();
  });

  test("availability exceptions report unsupported and never open a prompt", async () => {
    const f = fixture();
    f.provider.available = () => {
      throw new Error("Internal hardware failure");
    };
    expect(await f.auth.status()).toEqual({
      supported: false,
      enabled: false,
      label: "Test biometrics",
      reason: "Biometrics unavailable",
    });
    await expect(f.auth.enable("correct-password")).rejects.toThrow(
      "Biometrics unavailable",
    );
    expect(f.calls).toEqual(["verify-password"]);
  });

  test("unlock denial and protected-storage errors never call vault unlock", async () => {
    const f = fixture();
    await f.auth.enable("correct-password");
    f.calls.length = 0;
    f.provider.authenticate = async () => {
      throw new Error("Denied");
    };
    await expect(f.auth.unlock()).rejects.toThrow("canceled or unavailable");
    expect(f.calls).not.toContain("unwrap");
    f.provider.authenticate = async () => {};
    f.provider.unwrap = async () => {
      throw new Error("Key removed");
    };
    await expect(f.auth.unlock()).rejects.toThrow(
      "Protected device storage could not unlock",
    );
    expect(f.calls).not.toContain("unlock");
  });

  test("changed vault binding is rejected by the vault", async () => {
    const f = fixture();
    await f.auth.enable("correct-password");
    f.provider.unwrap = async () => ({
      result: "another-vault-secret",
      shouldReEncrypt: false,
    });
    await expect(f.auth.unlock()).rejects.toThrow("Vault binding changed");
  });

  test("lock invalidates enrollment while a biometric prompt is open", async () => {
    const f = fixture();
    let proceed!: () => void;
    let began!: () => void;
    const prompted = new Promise<void>((resolve) => {
      began = resolve;
    });
    f.provider.authenticate = () => {
      began();
      return new Promise<void>((resolve) => {
        proceed = resolve;
      });
    };
    const enrollment = f.auth.enable("correct-password");
    await prompted;
    await expect(f.auth.unlock()).rejects.toThrow("already open");
    f.auth.invalidate();
    proceed();
    await expect(enrollment).rejects.toThrow("vault locked during");
    expect(f.getRecord()).toBeNull();
    expect(f.calls).not.toContain("wrap");
  });

  test("lock invalidates an enrollment before its atomic persistence commit", async () => {
    const f = fixture();
    f.store.write = async (_bytes, assertCurrent) => {
      f.auth.invalidate();
      assertCurrent();
    };
    await expect(f.auth.enable("correct-password")).rejects.toThrow(
      "vault locked during",
    );
    expect(f.getRecord()).toBeNull();
  });

  test("lock invalidates an in-flight protected-storage decryption", async () => {
    const f = fixture();
    await f.auth.enable("correct-password");
    f.calls.length = 0;
    f.provider.unwrap = async () => {
      f.auth.invalidate();
      return { result: "bound-vault-secret", shouldReEncrypt: false };
    };
    await expect(f.auth.unlock()).rejects.toThrow("vault locked during");
    expect(f.calls).not.toContain("unlock");
  });

  test("malformed or foreign-platform enrollment fails without any OS prompt", async () => {
    const f = fixture();
    f.store.read = async () =>
      Buffer.from('{"version":1,"platform":"other","ciphertext":"dGVzdA=="}');
    expect((await f.auth.status()).enabled).toBe(false);
    await expect(f.auth.unlock()).rejects.toThrow(
      "Device unlock settings are invalid",
    );
    expect(f.calls).toEqual([]);
  });

  test("disabling enrollment requires password verification and removes only its sidecar", async () => {
    const f = fixture();
    await f.auth.enable("correct-password");
    await expect(f.auth.disable("wrong-password")).rejects.toThrow(
      "Wrong password",
    );
    expect((await f.auth.status()).enabled).toBe(true);
    f.calls.length = 0;
    await f.auth.disable("correct-password");
    expect(f.calls).toEqual(["verify-password", "remove"]);
    expect((await f.auth.status()).enabled).toBe(false);
  });
});

describe("device authentication sidecar persistence", () => {
  let directory: string;
  let filePath: string;
  let store: FileDeviceAuthStore;

  beforeEach(async () => {
    const root = path.join(process.cwd(), ".cache", "device-auth-tests");
    await mkdir(root, { recursive: true });
    directory = await mkdtemp(path.join(root, "sidecar-"));
    filePath = path.join(directory, "profile", "device-auth.json");
    store = new FileDeviceAuthStore(filePath);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("writes and replaces a private sidecar without leaving temporary files", async () => {
    expect(await store.read()).toBeNull();
    await store.write(Buffer.from("first ciphertext"), () => {});
    expect((await store.read())?.toString()).toBe("first ciphertext");
    if (process.platform !== "win32") {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
      expect((await stat(path.dirname(filePath))).mode & 0o777).toBe(0o700);
    }
    await store.write(Buffer.from("replacement ciphertext"), () => {});
    expect((await store.read())?.toString()).toBe("replacement ciphertext");
    expect(await readdir(path.dirname(filePath))).toEqual(["device-auth.json"]);
  });

  test("aborted atomic replacement retains the previous sidecar and removes its temporary file", async () => {
    await store.write(Buffer.from("previous ciphertext"), () => {});
    await expect(
      store.write(Buffer.from("new ciphertext"), () => {
        throw new Error("Locked before commit");
      }),
    ).rejects.toThrow("Locked before commit");
    expect((await store.read())?.toString()).toBe("previous ciphertext");
    expect(await readdir(path.dirname(filePath))).toEqual(["device-auth.json"]);
    await expect(store.write(Buffer.alloc(0), () => {})).rejects.toThrow(
      "settings are invalid",
    );
    expect((await store.read())?.toString()).toBe("previous ciphertext");
  });

  test("bounds on disk reads and writes reject oversized settings", async () => {
    await store.write(Buffer.from("retained ciphertext"), () => {});
    await expect(
      store.write(Buffer.alloc(16 * 1024 + 1), () => {}),
    ).rejects.toThrow("settings are invalid");
    expect((await store.read())?.toString()).toBe("retained ciphertext");
    await writeFile(filePath, Buffer.alloc(16 * 1024 + 1));
    await expect(store.read()).rejects.toThrow("settings are invalid");
    const directoryStore = new FileDeviceAuthStore(path.dirname(filePath));
    await expect(directoryStore.read()).rejects.toThrow("settings are invalid");
  });

  test("removing enrollment preserves the vault file and respects cancellation", async () => {
    await store.write(Buffer.from("wrapped sidecar"), () => {});
    const vaultPath = path.join(path.dirname(filePath), "vault.json");
    await writeFile(vaultPath, "encrypted vault marker");
    await expect(
      store.remove(() => {
        throw new Error("Canceled");
      }),
    ).rejects.toThrow("Canceled");
    expect((await store.read())?.toString()).toBe("wrapped sidecar");
    await store.remove(() => {});
    expect(await store.read()).toBeNull();
    expect(await readFile(vaultPath, "utf8")).toBe("encrypted vault marker");
    await store.remove(() => {});
  });

  test("malformed real sidecars are rejected without authentication or decryption", async () => {
    const f = fixture();
    const auth = new DeviceAuthService(f.vault, f.provider, store);
    for (const malformed of [
      "not json",
      "null",
      '{"version":2}',
      '{"version":1,"platform":"test","ciphertext":"%%%"}',
    ]) {
      await store.write(Buffer.from(malformed), () => {});
      expect((await auth.status()).enabled).toBe(false);
      await expect(auth.unlock()).rejects.toThrow("settings are invalid");
    }
    expect(f.calls).toEqual([]);
  });

  test.skipIf(process.platform === "win32")(
    "sidecar reads reject symbolic links without modifying their target",
    async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      const target = path.join(directory, "vault.json");
      await writeFile(target, "encrypted vault marker");
      await symlink(target, filePath);
      await expect(store.read()).rejects.toThrow("settings could not be read");
      expect(await readFile(target, "utf8")).toBe("encrypted vault marker");
    },
  );
});
