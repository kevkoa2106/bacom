import { describe, expect, test } from "bun:test";
import { parseBackupCodes } from "./parser";
import { rtfToPlainText } from "./rtf";

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
  test("reads TextEdit RTF and alphabet-only single, grouped and hyphenated codes", () => {
    const textEdit = String.raw`{\rtf1\ansi\ansicpg1252
{\fonttbl\f0\fswiss\fcharset0 Synthetic Font;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\pard\f0\fs26\cf0 AUTHENTICATION\
QWERTYUIOP\
ASDF GHJK\
ZXCVB-NMKLQ\
0001 0023}`;
    const result = parseBackupCodes(textEdit);
    expect(result.codes.map((code) => code.value)).toEqual([
      "QWERTYUIOP",
      "ASDF GHJK",
      "ZXCVB-NMKLQ",
      "0001 0023",
    ]);
    expect(result.format).toContain("RTF");
    expect(result.warnings.some((w) => w.includes("Alphabet-only"))).toBe(true);
  });
  test("preserves a word sequence as one code and warns about ambiguity", () => {
    const result = parseBackupCodes(
      "SECURITY\nINSTRUCTIONS\nSOME ORDINARY WORDS HERE\none long recovery phrase with many separate tokens\n" +
        "WORD ".repeat(40),
    );
    expect(result.codes).toEqual([
      { value: "SOME ORDINARY WORDS HERE", used: false },
    ]);
    expect(result.warnings.some((w) => w.includes("boundaries"))).toBe(true);
  });
  test("preserves exact internal spaces in a long RTF recovery code", () => {
    const phrase =
      "cedar cobalt fern marble violet hazel amber copper ivory maple  willow birch coral olive spruce jade elm ocean moss silver";
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252\\f0 " +
      phrase.slice(0, 40) +
      "\n" +
      phrase.slice(40) +
      "}";
    const result = parseBackupCodes(rtf);
    expect(result.codes).toEqual([{ value: phrase, used: false }]);
    expect(result.format).toContain("word sequence");
    expect(result.warnings.some((w) => w.includes("one code"))).toBe(true);
  });
  test("does not accept sentence punctuation or guess codes from overlong word sequences", () => {
    expect(
      parseBackupCodes("cedar cobalt fern.\n" + "cedar ".repeat(30)).codes,
    ).toEqual([]);
  });
  test("preserves lowercase and mixed-case alphabetic candidates with an ambiguity warning", () => {
    const result = parseBackupCodes("qwertyuiop\nAsDf GhJk\nzxcvb-NmKlQ");
    expect(result.codes.map((code) => code.value)).toEqual([
      "qwertyuiop",
      "AsDf GhJk",
      "zxcvb-NmKlQ",
    ]);
    expect(result.warnings.some((w) => w.includes("Alphabet-only"))).toBe(true);
  });
  test("extracts visible RTF escapes, Unicode and hex while excluding destinations", () => {
    const result = rtfToPlainText(
      String.raw`{\rtf1\ansi\ansicpg1252{\fonttbl\v0 HIDDEN123}{\*\unrecognized HIDDEN456}{\info HIDDEN789}\uc1 \u65?\u66\'3f\'43\par\{D\}\\\tab E\line\v HIDDEN012\v0 F}`,
    );
    expect(result).toBe("ABC\n{D}\\\tE\nF");
    expect(rtfToPlainText(String.raw`{\rtf1\uc0\u65\u66}`)).toBe("AB");
    expect(rtfToPlainText(String.raw`{\rtf1\'e9}`)).toBe("é");
    expect(
      rtfToPlainText(String.raw`{\rtf1\v PRIVATE123\plain QwErTyUiOp}`),
    ).toBe("QwErTyUiOp");
    expect(rtfToPlainText(String.raw`{\rtf1\u65\{\u66\-\u67\b}`)).toBe("ABC");
  });
  test("rejects malformed, unsupported and excessively nested RTF without data in errors", () => {
    for (const text of [
      String.raw`{\rtf1 PRIVATE123`,
      String.raw`{\rtf1 PRIVATE123}}`,
      String.raw`{\rtf1\'qz PRIVATE123}`,
      String.raw`{\rtf1\bin4 PRIVATE123}`,
      String.raw`{\rtf1\u65}`,
      String.raw`{\rtf1\uc99 PRIVATE123}`,
      String.raw`{\rtf1{\u65}PRIVATE123}`,
      String.raw`{\rtf1\ansicpg932 PRIVATE123}`,
      "{\\rtf1" + "{".repeat(65) + "PRIVATE123" + "}".repeat(66),
    ]) {
      expect(() => rtfToPlainText(text)).toThrow("malformed or unsupported");
      try {
        rtfToPlainText(text);
      } catch (error) {
        expect((error as Error).message).not.toContain("PRIVATE123");
      }
    }
  });
});
