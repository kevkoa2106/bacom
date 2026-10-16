import { constants } from "node:fs";
import { link, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scrypt,
} from "node:crypto";
import bcrypt from "bcryptjs";
import type {
  AccountSummary,
  ImportInput,
  ParsedCode,
  RevealResult,
  VaultStatus,
} from "../shared/types";
import { MAX_CODES, parseBackupCodes } from "./parser";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ACCOUNTS = 500;
const MAX_TOTAL_CODES = 10_000;
const KDF = {
  1: { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  2: { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
};
interface Account {
  id: string;
  website: string;
  label: string;
  createdAt: string;
  codes: ParsedCode[];
}
interface Payload {
  version: 1;
  accounts: Account[];
}
interface Header {
  version: 1 | 2;
  cipher: "aes-256-gcm";
  kdf: "scrypt";
  salt: string;
  verifier: string;
}
interface Envelope extends Header {
  iv: string;
  tag: string;
  ciphertext: string;
}
interface Active {
  token: string;
  accountId: string;
  index: number;
  expiresAt: number;
}

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}
function fail(message: string): never {
  throw new VaultError(message);
}
function passwordValid(password: unknown): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    fail(
      "Use a master password of at least 12 characters and at most 72 UTF-8 bytes.",
    );
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function bounded(
  value: unknown,
  max: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}
function validCodes(codes: unknown): codes is ParsedCode[] {
  return (
    Array.isArray(codes) &&
    codes.length > 0 &&
    codes.length <= MAX_CODES &&
    codes.every(
      (c) =>
        object(c) &&
        bounded(c.value, 128) &&
        !/[\r\n\u0000]/.test(c.value) &&
        typeof c.used === "boolean",
    ) &&
    new Set(codes.map((c) => c.value)).size === codes.length
  );
}
function validInput(input: unknown): input is ImportInput {
  return (
    object(input) &&
    bounded(input.website, 2048) &&
    bounded(input.label, 120, true) &&
    validCodes(input.codes)
  );
}
function decode(value: unknown, exact?: number): Buffer {
  if (
    typeof value !== "string" ||
    value.length > MAX_FILE_BYTES ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    fail("The vault file is damaged or unsupported.");
  const result = Buffer.from(value, "base64");
  if (
    result.toString("base64") !== value ||
    (exact !== undefined && result.length !== exact) ||
    (!exact && !result.length)
  )
    fail("The vault file is damaged or unsupported.");
  return result;
}
function header(e: Envelope): Header {
  return {
    version: e.version,
    cipher: "aes-256-gcm",
    kdf: "scrypt",
    salt: e.salt,
    verifier: e.verifier,
  };
}
function envelope(bytes: Buffer): Envelope {
  try {
    const e: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !object(e) ||
      (e.version !== 1 && e.version !== 2) ||
      e.cipher !== "aes-256-gcm" ||
      e.kdf !== "scrypt" ||
      typeof e.verifier !== "string" ||
      !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(e.verifier)
    )
      fail("The vault file is damaged or unsupported.");
    decode(e.salt, 32);
    decode(e.iv, 12);
    decode(e.tag, 16);
    decode(e.ciphertext);
    return e as unknown as Envelope;
  } catch {
    return fail("The vault file is damaged or unsupported.");
  }
}
function payload(value: unknown): Payload {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.accounts) ||
    value.accounts.length > MAX_ACCOUNTS
  )
    fail("The vault contents are invalid.");
  let count = 0;
  const ids = new Set<string>();
  for (const a of value.accounts) {
    if (
      !object(a) ||
      !validInput(a) ||
      !bounded(a.id, 64) ||
      ids.has(a.id) ||
      !bounded(a.createdAt, 40) ||
      !Number.isFinite(Date.parse(a.createdAt))
    )
      fail("The vault contents are invalid.");
    ids.add(a.id);
    count += a.codes.length;
  }
  if (count > MAX_TOTAL_CODES) fail("The vault contains too many codes.");
  return value as unknown as Payload;
}
function derive(
  password: string,
  salt: Buffer,
  version: Header["version"],
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 32, KDF[version], (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export class VaultService {
  private data: Payload | null = null;
  private key: Buffer | null = null;
  private stored: Envelope | null = null;
  private active: Active | null = null;
  private epoch = 0;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly filePath: string) {}

  private run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.catch(() => {});
    return result;
  }
  private requireUnlocked(): Payload {
    if (!this.data || !this.key || !this.stored)
      fail("Unlock your vault first.");
    return this.data;
  }
  private checkEpoch(epoch: number): void {
    if (this.epoch !== epoch) fail("The vault was locked. Unlock it again.");
  }
  private async read(): Promise<Buffer | null> {
    let handle;
    try {
      handle = await open(
        this.filePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FILE_BYTES)
        fail("The vault file is too large or invalid.");
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (!result.bytesRead)
          fail("The vault file changed while reading. Try again.");
        offset += result.bytesRead;
      }
      return bytes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    } finally {
      await handle?.close();
    }
  }
  private async save(
    data: Payload,
    key: Buffer,
    base: Header,
    epoch: number,
    create = false,
  ): Promise<Envelope> {
    this.checkEpoch(epoch);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(base)));
    const plaintext = Buffer.from(JSON.stringify(data));
    let ciphertext: Buffer;
    try {
      ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    } finally {
      plaintext.fill(0);
    }
    const e: Envelope = {
      ...base,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    const bytes = Buffer.from(JSON.stringify(e));
    if (bytes.length > MAX_FILE_BYTES)
      fail("The vault has reached its size limit.");
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      this.checkEpoch(epoch);
      if (create) await link(temporary, this.filePath);
      else await rename(temporary, this.filePath);
      return e;
    } catch (error) {
      if (error instanceof VaultError) throw error;
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        fail("A vault already exists. Unlock it instead.");
      return fail(
        "Could not save the vault. Check available disk space and folder permissions.",
      );
    } finally {
      await handle?.close();
      await unlink(temporary).catch(() => {});
    }
  }

  async status(): Promise<VaultStatus> {
    return { exists: !!(await this.read()), unlocked: !!this.data };
  }
  lock(): Promise<void> {
    this.epoch++;
    this.key?.fill(0);
    this.key = null;
    this.data = null;
    this.stored = null;
    this.active = null;
    return Promise.resolve();
  }
  create(password: string): Promise<void> {
    const epoch = this.epoch;
    return this.run(async () => {
      passwordValid(password);
      this.checkEpoch(epoch);
      if (await this.read()) fail("A vault already exists. Unlock it instead.");
      const salt = randomBytes(32);
      const verifier = await bcrypt.hash(password, 12);
      const key = await derive(password, salt, 2);
      try {
        const data: Payload = { version: 1, accounts: [] };
        const stored = await this.save(
          data,
          key,
          {
            version: 2,
            cipher: "aes-256-gcm",
            kdf: "scrypt",
            salt: salt.toString("base64"),
            verifier,
          },
          epoch,
          true,
        );
        this.checkEpoch(epoch);
        this.key = key;
        this.data = data;
        this.stored = stored;
      } catch (error) {
        key.fill(0);
        throw error;
      }
    });
  }
  unlock(password: string): Promise<void> {
    const epoch = this.epoch;
    return this.run(async () => {
      passwordValid(password);
      this.checkEpoch(epoch);
      const bytes = await this.read();
      if (!bytes) fail("No vault exists yet. Create one first.");
      const stored = envelope(bytes);
      if (!(await bcrypt.compare(password, stored.verifier)))
        fail("The master password is incorrect.");
      const key = await derive(
        password,
        decode(stored.salt, 32),
        stored.version,
      );
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          decode(stored.iv, 12),
        );
        decipher.setAAD(Buffer.from(JSON.stringify(header(stored))));
        decipher.setAuthTag(decode(stored.tag, 16));
        const plaintext = Buffer.concat([
          decipher.update(decode(stored.ciphertext)),
          decipher.final(),
        ]);
        let data: Payload;
        try {
          data = payload(JSON.parse(plaintext.toString("utf8")));
        } finally {
          plaintext.fill(0);
        }
        this.checkEpoch(epoch);
        this.key?.fill(0);
        this.key = key;
        this.data = data;
        this.stored = stored;
        this.active = null;
      } catch (error) {
        key.fill(0);
        if (error instanceof VaultError) throw error;
        fail("The vault could not be authenticated. The file may be damaged.");
      }
    });
  }
  async list(): Promise<AccountSummary[]> {
    return this.requireUnlocked().accounts.map((a) => {
      const used = a.codes.filter((c) => c.used).length;
      return {
        id: a.id,
        website: a.website,
        label: a.label,
        createdAt: a.createdAt,
        total: a.codes.length,
        used,
        remaining: a.codes.length - used,
      };
    });
  }
  async parse(text: string, website: string) {
    this.requireUnlocked();
    return parseBackupCodes(text, website);
  }
  importCodes(input: ImportInput): Promise<void> {
    const epoch = this.epoch;
    // Copy renderer input before queueing to prevent caller mutation during persistence.
    if (!validInput(input))
      return Promise.reject(
        new VaultError(
          "Check the website, label, and codes. Codes must be unique and no longer than 128 characters.",
        ),
      );
    const clean: ImportInput = {
      website: input.website.trim(),
      label: input.label.trim(),
      codes: input.codes.map((c) => ({ value: c.value, used: c.used })),
    };
    return this.run(async () => {
      this.checkEpoch(epoch);
      const data = this.requireUnlocked();
      if (
        data.accounts.length >= MAX_ACCOUNTS ||
        data.accounts.reduce((n, a) => n + a.codes.length, 0) +
          clean.codes.length >
          MAX_TOTAL_CODES
      )
        fail("The vault has reached its account or code limit.");
      if (
        data.accounts.some(
          (a) =>
            a.website.toLowerCase() === clean.website.toLowerCase() &&
            a.codes.some((c) => clean.codes.some((n) => c.value === n.value)),
        )
      )
        fail(
          "Some codes already exist for this website. Remove duplicates before importing.",
        );
      const next: Payload = {
        version: 1,
        accounts: [
          ...data.accounts,
          { id: randomUUID(), ...clean, createdAt: new Date().toISOString() },
        ],
      };
      const stored = await this.save(
        next,
        this.key!,
        header(this.stored!),
        epoch,
      );
      this.checkEpoch(epoch);
      this.data = next;
      this.stored = stored;
    });
  }
  reveal(accountId: string, password: string): Promise<RevealResult> {
    const epoch = this.epoch;
    return this.run(async () => {
      passwordValid(password);
      this.checkEpoch(epoch);
      this.requireUnlocked();
      if (this.active && this.active.expiresAt > Date.now())
        fail("Close the current code prompt before revealing another code.");
      this.active = null;
      if (!(await bcrypt.compare(password, this.stored!.verifier)))
        fail("The master password is incorrect.");
      this.checkEpoch(epoch);
      const account = this.requireUnlocked().accounts.find(
        (a) => a.id === accountId,
      );
      if (!account) fail("This account could not be found.");
      const index = account.codes.findIndex((c) => !c.used);
      if (index < 0) fail("This account has no unused codes.");
      const token = randomBytes(32).toString("hex");
      this.active = { token, accountId, index, expiresAt: Date.now() + 60_000 };
      return { token, accountId, code: account.codes[index]!.value };
    });
  }
  getActiveCode(token: string): string {
    const data = this.requireUnlocked();
    if (
      !this.active ||
      this.active.token !== token ||
      this.active.expiresAt <= Date.now()
    ) {
      fail("This code prompt expired. Reveal a code again.");
    }
    const account = data.accounts.find((a) => a.id === this.active!.accountId);
    if (!account || account.codes[this.active.index]?.used)
      fail("This code is no longer available.");
    return account.codes[this.active.index]!.value;
  }
  finishReveal(token: string, used: boolean): Promise<void> {
    const epoch = this.epoch;
    return this.run(async () => {
      this.checkEpoch(epoch);
      if (typeof used !== "boolean") fail("Choose whether the code was used.");
      const data = this.requireUnlocked();
      // Expiry hides the secret, but a user may still confirm a code already accepted by a site.
      if (!this.active || this.active.token !== token)
        fail("This code prompt is no longer active.");
      const current = data.accounts.find((a) => a.id === this.active!.accountId)
        ?.codes[this.active.index];
      if (!current || current.used) fail("This code is no longer available.");
      const active = this.active!;
      if (!used) {
        this.active = null;
        return;
      }
      const next = structuredClone(this.requireUnlocked());
      next.accounts.find((a) => a.id === active.accountId)!.codes[
        active.index
      ]!.used = true;
      const stored = await this.save(
        next,
        this.key!,
        header(this.stored!),
        epoch,
      );
      this.checkEpoch(epoch);
      this.data = next;
      this.stored = stored;
      this.active = null;
    });
  }
  exportEncrypted(): Promise<Buffer> {
    return this.run(async () => {
      this.requireUnlocked();
      return Buffer.from(JSON.stringify(this.stored));
    });
  }
}
