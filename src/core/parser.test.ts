import { describe, expect, test } from "bun:test";
import { parseBackupCodes } from "./parser";

describe("backup code candidates", () => {
  test("preserves leading zeros, spelling, order, and checkboxes", () => {
    const result = parseBackupCodes(
      "Recovery codes\n1. 00123456\n2. aBc9-Def0\n[x] 98765432\n[ ] 87654321\n00123456\nSave these codes safely",
    );
    expect(result.codes).toEqual([
      { value: "00123456", used: false },
      { value: "aBc9-Def0", used: false },
      { value: "98765432", used: true },
      { value: "87654321", used: false },
    ]);
    expect(result.warnings.some((w) => w.includes("Duplicate"))).toBe(true);
  });
  test("keeps grouped numeric codes intact and flags boundaries", () => {
    const result = parseBackupCodes(
      "1234 5678\n0000 0123\nhttps://example.com/123456\n2026-10-16\nperson42@example.com",
    );
    expect(result.codes.map((c) => c.value)).toEqual([
      "1234 5678",
      "0000 0123",
    ]);
    expect(result.warnings.some((w) => w.includes("boundaries"))).toBe(true);
  });
  test("rejects large files and surfaces unsupported prose", () => {
    expect(() => parseBackupCodes("x".repeat(1024 * 1024 + 1))).toThrow();
    expect(
      parseBackupCodes("This provider has a different format").codes,
    ).toEqual([]);
  });
  test("never drops a used marker when deduplicating", () => {
    expect(parseBackupCodes("[ ] 12345678\n[x] 12345678").codes).toEqual([
      { value: "12345678", used: true },
    ]);
  });
});
