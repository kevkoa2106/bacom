import { constants, renameSync, unlinkSync } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { VaultError } from "../src/core/vault";
import type { AutoLockMinutes } from "../src/shared/types";

export function parseAutoLockMinutes(value: unknown): AutoLockMinutes {
  if (
    value === 1 ||
    value === 5 ||
    value === 10 ||
    value === 15 ||
    value === 30
  )
    return value;
  throw new VaultError(
    "Choose an auto-lock timeout of 1, 5, 10, 15, or 30 minutes.",
  );
}

export async function readBoundedRegularFile(
  filePath: string,
  maxBytes: number,
): Promise<Buffer> {
  const before = await lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink())
    throw new VaultError(
      "Choose a regular file, rather than a folder or symbolic link.",
    );
  const file = await open(
    filePath,
    constants.O_RDONLY |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0),
  );
  try {
    const current = await file.stat();
    if (
      !current.isFile() ||
      current.dev !== before.dev ||
      current.ino !== before.ino
    )
      throw new VaultError(
        "The selected file changed while it was opening. Choose it again.",
      );
    if (current.size > maxBytes)
      throw new VaultError("The selected file is too large.");
    const bytes = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await file.read(
        bytes,
        size,
        bytes.length - size,
        size,
      );
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > maxBytes)
      throw new VaultError("The selected file is too large.");
    return Buffer.from(bytes.subarray(0, size));
  } finally {
    await file.close();
  }
}

export async function readAutoLockMinutes(
  filePath: string,
): Promise<AutoLockMinutes> {
  try {
    const bytes = await readBoundedRegularFile(filePath, 1024);
    const preferences: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !preferences ||
      typeof preferences !== "object" ||
      Array.isArray(preferences)
    )
      return 5;
    const settings = preferences as Record<string, unknown>;
    return settings.version === 1
      ? parseAutoLockMinutes(settings.autoLockMinutes)
      : 5;
  } catch {
    return 5;
  }
}

export async function writeAutoLockMinutes(
  filePath: string,
  value: AutoLockMinutes,
): Promise<void> {
  const autoLockMinutes = parseAutoLockMinutes(value);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify({ version: 1, autoLockMinutes }));
      await file.sync();
    } finally {
      await file.close();
    }
    renameSync(temporary, filePath);
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
