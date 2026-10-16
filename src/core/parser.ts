import type { ParseResult, ParsedCode } from "../shared/types";
import { rtfToPlainText } from "./rtf";

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_CODES = 1000;

/** Conservative candidates are reviewed by the user before entering the vault. */
export function parseBackupCodes(text: string, website = ""): ParseResult {
  if (
    typeof text !== "string" ||
    text.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES
  ) {
    throw new Error("Choose a text file smaller than 1 MB.");
  }
  if (typeof website !== "string" || website.length > 2048)
    throw new Error("Website is too long.");
  const codes: ParsedCode[] = [];
  const seen = new Set<string>();
  const warnings = new Set<string>();
  const formats = new Set<string>();
  if (/^\s*\{\\rtf/.test(text.replace(/^\uFEFF/, ""))) {
    text = rtfToPlainText(text);
    formats.add("RTF text");
  }
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    let used = false;
    const checkbox = line.match(/^(?:[-*]\s*)?\[([ xX])\]\s*(.+)$/);
    if (checkbox) {
      used = checkbox[1]!.toLowerCase() === "x";
      line = checkbox[2]!;
      formats.add("checkbox");
    }
    const number = line.match(/^\d{1,3}[.)]\s+(.+)$/);
    if (number) {
      line = number[1]!;
      formats.add("numbered");
    }
    // Download headings, timestamps, URLs and instructions must never become credentials.
    if (
      /^(?:https?:\/\/|www\.)/i.test(line) ||
      /\b(?:backup|recovery|codes?|generated|account|download|save|keep|print|password|unused|used|remaining|date|time|important|each|these|your|store|sign|use|do not|authentication|security|verification|emergency|instructions|warning|please)\b/i.test(
        line,
      )
    )
      continue;
    if (
      /^\d{4}-\d{2}-\d{2}(?:\b|T)/.test(line) ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)
    )
      continue;
    // Some providers put several fixed-width numeric groups on one line.
    if (line.length > 128) {
      warnings.add(
        "Long lines were skipped rather than split into guessed codes. Review their code boundaries manually.",
      );
      continue;
    }
    if (/^\d+(?:[ \t]+\d+){4,}$/.test(line)) {
      warnings.add(
        "Lines with more than four numeric groups were skipped. Review their code boundaries manually.",
      );
      continue;
    }
    if (/^[A-Za-z]{2,32}(?:[ \t]+[A-Za-z]{2,32}){2,}$/.test(line)) {
      formats.add("word sequence");
      warnings.add(
        "Word sequences are treated as one code; verify boundaries. Internal spacing is preserved.",
      );
    } else if (/^\d{3,8}(?:[ \t]+\d{3,8}){1,3}$/.test(line)) {
      formats.add("grouped numeric");
      line = line.replace(/[ \t]+/g, " ");
    } else if (
      /^[A-Za-z]{8,32}$/.test(line) ||
      /^[A-Za-z]{4,8}(?:-|[ \t]+)[A-Za-z]{4,8}$/.test(line)
    ) {
      formats.add("alphabetic");
      warnings.add(
        "Alphabet-only candidates can resemble words. Verify each one against the original file.",
      );
    } else if (
      !/^(?=.{4,128}$)(?=.*\d)[A-Za-z0-9]+(?:[- ][A-Za-z0-9]+){0,3}$/.test(line)
    ) {
      warnings.add(
        "Some lines were skipped. Check the original file for missing codes.",
      );
      continue;
    } else formats.add(line.includes("-") ? "hyphenated" : "plain");
    if (seen.has(line)) {
      if (used) codes.find((code) => code.value === line)!.used = true;
      warnings.add(
        "Duplicate codes were removed; a used marker on any duplicate is preserved.",
      );
      continue;
    }
    if (codes.length >= MAX_CODES)
      throw new Error("Import at most 1,000 codes at a time.");
    seen.add(line);
    codes.push({ value: line, used });
  }
  if (formats.has("grouped numeric"))
    warnings.add(
      "Numeric groups are treated as one code per line. Verify spacing and code boundaries.",
    );
  if (!codes.length)
    warnings.add(
      "No codes identified. Enter codes manually or try another text file.",
    );
  warnings.add(
    "Review every candidate against the original file before importing.",
  );
  return {
    format: [...formats].join(", ") || "unrecognized",
    codes,
    warnings: [...warnings],
  };
}

export const parseCodes = parseBackupCodes;
