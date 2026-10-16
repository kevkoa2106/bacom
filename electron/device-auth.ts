import { constants, renameSync, unlinkSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { VaultError } from "../src/core/vault";
import type { DeviceAuthStatus } from "../src/shared/types";

const maxRecordBytes = 16 * 1024;

export interface DeviceAuthProvider {
  platform: string;
  label: string;
  unsupportedReason: string;
  available(): boolean;
  authenticate(reason: string): Promise<void>;
  encryptionAvailable(): Promise<boolean>;
  wrap(secret: string): Promise<Buffer>;
  unwrap(bytes: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

export interface DeviceAuthVault {
  createDeviceUnlockSecret(password: string): Promise<string>;
  unlockWithDeviceSecret(secret: string): Promise<void>;
}

export interface DeviceAuthStore {
  read(): Promise<Buffer | null>;
  write(bytes: Buffer, assertCurrent: () => void): Promise<void>;
  remove(assertCurrent: () => void): Promise<void>;
}

export class FileDeviceAuthStore implements DeviceAuthStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<Buffer | null> {
    let file;
    try {
      file = await open(
        this.filePath,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new VaultError(
        "Device unlock settings could not be read. Use your master password.",
      );
    }
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > maxRecordBytes)
        throw new VaultError(
          "Device unlock settings are invalid. Use your master password.",
        );
      const bytes = Buffer.alloc(maxRecordBytes + 1);
      let length = 0;
      while (length < bytes.length) {
        const { bytesRead } = await file.read(
          bytes,
          length,
          bytes.length - length,
          length,
        );
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > maxRecordBytes)
        throw new VaultError(
          "Device unlock settings are invalid. Use your master password.",
        );
      return Buffer.from(bytes.subarray(0, length));
    } finally {
      await file.close();
    }
  }

  async write(bytes: Buffer, assertCurrent: () => void): Promise<void> {
    if (!bytes.length || bytes.length > maxRecordBytes)
      throw new VaultError("Device unlock settings are invalid.");
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
      // Keep invalidation and the final replacement in the same event-loop turn.
      assertCurrent();
      renameSync(temporary, this.filePath);
    } finally {
      try {
        unlinkSync(temporary);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }

  async remove(assertCurrent: () => void): Promise<void> {
    assertCurrent();
    try {
      unlinkSync(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export class DeviceAuthService {
  private generation = 0;
  private busy = false;

  constructor(
    private readonly vault: DeviceAuthVault,
    private readonly provider: DeviceAuthProvider,
    private readonly store: DeviceAuthStore,
  ) {}

  invalidate(): void {
    this.generation++;
  }

  private available(): boolean {
    try {
      return this.provider.available() === true;
    } catch {
      return false;
    }
  }

  private ciphertext(record: Buffer): Buffer {
    try {
      if (!record.length || record.length > maxRecordBytes) throw new Error();
      const value = JSON.parse(record.toString("utf8")) as Record<
        string,
        unknown
      >;
      if (
        value.version !== 1 ||
        value.platform !== this.provider.platform ||
        typeof value.ciphertext !== "string"
      )
        throw new Error();
      const bytes = Buffer.from(value.ciphertext, "base64");
      if (
        !bytes.length ||
        bytes.length > 8192 ||
        bytes.toString("base64") !== value.ciphertext
      )
        throw new Error();
      return bytes;
    } catch {
      throw new VaultError(
        "Device unlock settings are invalid. Use your master password and enable it again.",
      );
    }
  }

  async status(): Promise<DeviceAuthStatus> {
    let enabled = false;
    let reason: string | undefined;
    try {
      const record = await this.store.read();
      if (record) {
        this.ciphertext(record);
        enabled = true;
      }
    } catch {
      reason =
        "Saved device unlock settings could not be read. Use your master password and enable it again.";
    }
    const supported = this.available();
    if (!supported) reason = this.provider.unsupportedReason;
    return {
      supported,
      enabled,
      label: this.provider.label,
      ...(reason ? { reason } : {}),
    };
  }

  private async operation(
    action: (assertCurrent: () => void) => Promise<void>,
  ): Promise<void> {
    if (this.busy)
      throw new VaultError(
        "Another device authentication request is already open.",
      );
    this.busy = true;
    const generation = this.generation;
    const assertCurrent = () => {
      if (generation !== this.generation)
        throw new VaultError(
          "The vault locked during device authentication. Try again.",
        );
    };
    try {
      await action(assertCurrent);
    } finally {
      this.busy = false;
    }
  }

  private async authenticate(
    reason: string,
    assertCurrent: () => void,
  ): Promise<void> {
    if (!this.available())
      throw new VaultError(this.provider.unsupportedReason);
    try {
      await this.provider.authenticate(reason);
    } catch {
      throw new VaultError(
        `${this.provider.label} was canceled or unavailable. Use your master password or try again.`,
      );
    }
    assertCurrent();
    if (!(await this.provider.encryptionAvailable()))
      throw new VaultError(
        "Protected device storage is unavailable. Use your master password.",
      );
    assertCurrent();
  }

  private async save(secret: string, assertCurrent: () => void): Promise<void> {
    if (!secret.length || Buffer.byteLength(secret, "utf8") > 4096)
      throw new VaultError("The device unlock secret is invalid.");
    const ciphertext = await this.provider.wrap(secret);
    try {
      assertCurrent();
      if (!ciphertext.length || ciphertext.length > 8192)
        throw new VaultError(
          "Protected device storage returned an invalid result.",
        );
      const record = Buffer.from(
        JSON.stringify({
          version: 1,
          platform: this.provider.platform,
          ciphertext: ciphertext.toString("base64"),
        }),
      );
      await this.store.write(record, assertCurrent);
    } finally {
      ciphertext.fill(0);
    }
  }

  enable(password: string): Promise<void> {
    return this.operation(async (assertCurrent) => {
      const secret = await this.vault.createDeviceUnlockSecret(password);
      assertCurrent();
      await this.authenticate(
        "enable Touch ID unlock for your Bacom vault",
        assertCurrent,
      );
      await this.save(secret, assertCurrent);
    });
  }

  disable(password: string): Promise<void> {
    return this.operation(async (assertCurrent) => {
      await this.vault.createDeviceUnlockSecret(password);
      assertCurrent();
      await this.store.remove(assertCurrent);
    });
  }

  unlock(): Promise<void> {
    return this.operation(async (assertCurrent) => {
      const record = await this.store.read();
      assertCurrent();
      if (!record)
        throw new VaultError(
          "Device unlock is not enabled. Use your master password.",
        );
      const ciphertext = this.ciphertext(record);
      try {
        await this.authenticate("unlock your Bacom vault", assertCurrent);
        let decrypted;
        try {
          decrypted = await this.provider.unwrap(ciphertext);
        } catch {
          throw new VaultError(
            "Protected device storage could not unlock this vault. Use your master password and enable device unlock again.",
          );
        }
        assertCurrent();
        if (
          typeof decrypted.result !== "string" ||
          !decrypted.result.length ||
          Buffer.byteLength(decrypted.result, "utf8") > 4096
        )
          throw new VaultError("The device unlock secret is invalid.");
        if (decrypted.shouldReEncrypt)
          await this.save(decrypted.result, assertCurrent);
        await this.vault.unlockWithDeviceSecret(decrypted.result);
        assertCurrent();
      } finally {
        ciphertext.fill(0);
      }
    });
  }
}
