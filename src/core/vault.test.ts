import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import bcrypt from "bcryptjs";
import { VaultService } from "./vault";

const password = "a correct horse battery staple";
let folder: string;
let path: string;
beforeEach(async () => {
  const root = join(process.cwd(), ".cache", "core-tests");
  await mkdir(root, { recursive: true });
  folder = await mkdtemp(join(root, "vault-"));
  path = join(folder, "vault.bacom");
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});
const input = {
  website: "example.com",
  label: "Personal",
  codes: [
    { value: "00001234", used: false },
    { value: "aBc1-def2", used: false },
  ],
};

describe("encrypted file vault", () => {
  test("device secrets are password-authorized, bound to one vault, and preserve reveal checks", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    await vault.importCodes(input);
    await expect(
      vault.createDeviceUnlockSecret("incorrect test password"),
    ).rejects.toThrow("incorrect");
    const secret = await vault.createDeviceUnlockSecret(password);
    expect(secret).not.toContain(password);
    const account = (await vault.list())[0]!;
    await vault.lock();
    await vault.unlockWithDeviceSecret(secret);
    expect((await vault.list())[0]!.remaining).toBe(2);
    await expect(
      vault.reveal(account.id, "incorrect test password"),
    ).rejects.toThrow("incorrect");
    await vault.lock();
    const wrongKey = JSON.stringify({
      ...JSON.parse(secret),
      key: Buffer.alloc(32, 9).toString("base64"),
    });
    await expect(vault.unlockWithDeviceSecret(wrongKey)).rejects.toThrow(
      "authenticated",
    );
    expect((await vault.status()).unlocked).toBe(false);
    await expect(vault.unlockWithDeviceSecret("[bad json")).rejects.toThrow(
      "invalid",
    );
    await expect(
      vault.unlockWithDeviceSecret("x".repeat(1025)),
    ).rejects.toThrow("invalid");
    const other = new VaultService(join(folder, "other.vault"));
    await other.create(password);
    await other.lock();
    await expect(other.unlockWithDeviceSecret(secret)).rejects.toThrow(
      "another vault",
    );
    expect((await other.status()).unlocked).toBe(false);
  });
  test("lock invalidates pending device enrollment and device unlock", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    const secret = await vault.createDeviceUnlockSecret(password);
    const enrolling = vault.createDeviceUnlockSecret(password);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await vault.lock();
    await expect(enrolling).rejects.toThrow("locked");
    const unlocking = vault.unlockWithDeviceSecret(secret);
    await vault.lock();
    await expect(unlocking).rejects.toThrow("locked");
    expect((await vault.status()).unlocked).toBe(false);
  });
  test("reads and updates original version 1 vaults without changing their KDF", async () => {
    const salt = randomBytes(32);
    const iv = randomBytes(12);
    const key = scryptSync(password, salt, 32, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const header = {
      version: 1,
      cipher: "aes-256-gcm",
      kdf: "scrypt",
      salt: salt.toString("base64"),
      verifier: await bcrypt.hash(password, 12),
    };
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(header)));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify({ version: 1, accounts: [] })),
      cipher.final(),
    ]);
    key.fill(0);
    await writeFile(
      path,
      JSON.stringify({
        ...header,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      }),
      { mode: 0o600 },
    );
    const vault = new VaultService(path);
    await vault.unlock(password);
    expect(await vault.list()).toEqual([]);
    await vault.importCodes(input);
    const account = (await vault.list())[0]!;
    const revealed = await vault.reveal(account.id, password);
    await vault.finishReveal(revealed.token, true);
    const saved = JSON.parse(await readFile(path, "utf8"));
    expect(saved.version).toBe(1);
    expect(saved.salt).toBe(header.salt);
    await vault.lock();
    await vault.unlock(password);
    expect((await vault.list())[0]!.used).toBe(1);
  });
  test("round trips privately, authenticates each reveal, and records only explicit use", async () => {
    const vault = new VaultService(path);
    expect(await vault.status()).toEqual({ exists: false, unlocked: false });
    await vault.create(password);
    await vault.importCodes(input);
    const bytes = await readFile(path, "utf8");
    expect(JSON.parse(bytes).version).toBe(2);
    expect(bytes).not.toContain("example.com");
    expect(bytes).not.toContain("00001234");
    expect(bytes).not.toContain(password);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const [account] = await vault.list();
    expect(account).not.toHaveProperty("codes");
    await expect(
      vault.reveal(account!.id, "incorrect password value"),
    ).rejects.toThrow("incorrect");
    const first = await vault.reveal(account!.id, password);
    expect(first.code).toBe("00001234");
    expect(vault.getActiveCode(first.token)).toBe(first.code);
    await vault.finishReveal(first.token, false);
    expect((await vault.list())[0]!.remaining).toBe(2);
    expect(() => vault.getActiveCode(first.token)).toThrow();
    const second = await vault.reveal(account!.id, password);
    await vault.finishReveal(second.token, true);
    expect((await vault.list())[0]!.remaining).toBe(1);
    await vault.lock();
    await expect(vault.list()).rejects.toThrow("Unlock");
    const reopened = new VaultService(path);
    await reopened.unlock(password);
    expect((await reopened.list())[0]!.used).toBe(1);
    expect((await reopened.reveal(account!.id, password)).code).toBe(
      "aBc1-def2",
    );
    expect(
      JSON.parse((await reopened.exportEncrypted()).toString()).cipher,
    ).toBe("aes-256-gcm");
  });
  test("rejects malformed, oversized and authenticated tampered envelopes", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    await vault.lock();
    const e = JSON.parse(await readFile(path, "utf8"));
    const altered = Buffer.from(e.ciphertext, "base64");
    altered[0] = altered[0]! ^ 1;
    await writeFile(
      path,
      JSON.stringify({ ...e, ciphertext: altered.toString("base64") }),
    );
    await expect(vault.unlock(password)).rejects.toThrow("authenticated");
    expect((await vault.status()).unlocked).toBe(false);
    await writeFile(
      path,
      JSON.stringify({ ...e, verifier: "$2b$31$" + "A".repeat(53) }),
    );
    await expect(vault.unlock(password)).rejects.toThrow("unsupported");
    await writeFile(
      path,
      JSON.stringify({ ...e, ciphertext: "A".repeat(6 * 1024 * 1024) }),
    );
    await expect(vault.unlock(password)).rejects.toThrow("authenticated");
    await writeFile(
      path,
      JSON.stringify({
        ...e,
        ciphertext: "A".repeat(6 * 1024 * 1024 - 1) + "!",
      }),
    );
    await expect(vault.unlock(password)).rejects.toThrow("unsupported");
    await writeFile(path, "{".repeat(8 * 1024 * 1024 + 1));
    await expect(vault.unlock(password)).rejects.toThrow("too large");
  });
  test("expires secret access but allows confirming an accepted code", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    await vault.importCodes(input);
    const account = (await vault.list())[0]!;
    const reveal = await vault.reveal(account.id, password);
    await expect(vault.reveal(account.id, password)).rejects.toThrow(
      "current code prompt",
    );
    const future = Date.now() + 61_000;
    const clock = spyOn(Date, "now").mockReturnValue(future);
    try {
      expect(() => vault.getActiveCode(reveal.token)).toThrow("expired");
      await vault.finishReveal(reveal.token, true);
      expect((await vault.list())[0]!.used).toBe(1);
    } finally {
      clock.mockRestore();
    }
  });
  test("fresh nonce on each save and failed save keeps prior state", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    const first = JSON.parse(await readFile(path, "utf8"));
    await vault.importCodes(input);
    const before = await readFile(path, "utf8");
    expect(JSON.parse(before).iv).not.toBe(first.iv);
    const preserved = join(folder, "preserved.bacom");
    await rename(path, preserved);
    await mkdir(path);
    await expect(
      vault.importCodes({ ...input, website: "another.example" }),
    ).rejects.toThrow("Could not save");
    expect(await readFile(preserved, "utf8")).toBe(before);
    expect(await vault.list()).toHaveLength(1);
    await rm(path, { recursive: true });
    await rename(preserved, path);
    await vault.lock();
    await vault.unlock(password);
    expect(await vault.list()).toHaveLength(1);
  });
  test("serializes imports, rejects duplicates and prevents overwrite on create", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    await Promise.all([
      vault.importCodes(input),
      vault.importCodes({ ...input, website: "other.example" }),
    ]);
    expect(await vault.list()).toHaveLength(2);
    await expect(vault.importCodes(input)).rejects.toThrow("already exist");
    await expect(new VaultService(path).create(password)).rejects.toThrow(
      "already exists",
    );
    await expect(vault.create("é".repeat(37))).rejects.toThrow("72");
  });
  test("lock invalidates in-flight unlock and reveal plus old tokens", async () => {
    const vault = new VaultService(path);
    await vault.create(password);
    await vault.importCodes(input);
    const account = (await vault.list())[0]!;
    const revealed = await vault.reveal(account.id, password);
    await vault.lock();
    expect(() => vault.getActiveCode(revealed.token)).toThrow("Unlock");
    const unlocking = vault.unlock(password);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await vault.lock();
    await expect(unlocking).rejects.toThrow("locked");
    expect((await vault.status()).unlocked).toBe(false);
    await vault.unlock(password);
    const revealing = vault.reveal(account.id, password);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await vault.lock();
    await expect(revealing).rejects.toThrow("locked");
    expect((await vault.status()).unlocked).toBe(false);
  });
});
