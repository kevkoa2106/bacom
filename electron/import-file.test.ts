import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readImportText } from "./import-file";

let directory: string;
beforeEach(async () => {
  const root = join(process.cwd(), ".cache", "import-tests");
  await mkdir(root, { recursive: true });
  directory = await mkdtemp(join(root, "reader-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test("native import accepts UTF-8 text and rejects unsupported or unsafe contents", async () => {
  const file = join(directory, "codes.txt");
  await writeFile(file, "00112233\n");
  expect(await readImportText(file)).toBe("00112233\n");
  await expect(readImportText(join(directory, "codes.json"))).rejects.toThrow(
    ".txt",
  );
  await writeFile(file, Buffer.from([0xff, 0xfe]));
  await expect(readImportText(file)).rejects.toThrow("UTF-8");
  await writeFile(file, "abc\0def");
  await expect(readImportText(file)).rejects.toThrow("readable");
  await writeFile(file, " ");
  await expect(readImportText(file)).rejects.toThrow("readable");
  await writeFile(file, Buffer.alloc(1024 * 1024 + 1, 65));
  await expect(readImportText(file)).rejects.toThrow("1 MiB");
});
