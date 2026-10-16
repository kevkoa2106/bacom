import { open } from "node:fs/promises";
import path from "node:path";
import { VaultError } from "../src/core/vault";

const maxImportBytes = 1024 * 1024;

export async function readImportText(filePath: string): Promise<string> {
  if (path.extname(filePath).toLowerCase() !== ".txt") {
    throw new VaultError("Choose a .txt backup-code file.");
  }
  const file = await open(filePath, "r");
  const bytes = Buffer.alloc(maxImportBytes + 1);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxImportBytes) {
      throw new VaultError("Choose a text file no larger than 1 MiB.");
    }
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
    if (size > maxImportBytes)
      throw new VaultError("Choose a text file no larger than 1 MiB.");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(0, size),
      );
    } catch {
      throw new VaultError("The selected file must contain UTF-8 text.");
    }
    if (!text.trim() || text.includes("\0"))
      throw new VaultError(
        "The selected file does not contain readable backup-code text.",
      );
    return text;
  } finally {
    bytes.fill(0);
    await file.close();
  }
}
