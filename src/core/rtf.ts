const MAX_RTF_LENGTH = 1024 * 1024;
const MAX_DEPTH = 64;
const destinations = new Set([
  "fonttbl",
  "colortbl",
  "expandedcolortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "headerl",
  "headerr",
  "footer",
  "footerl",
  "footerr",
  "footnote",
  "annotation",
  "fldinst",
  "generator",
  "filetbl",
  "listtable",
  "listoverridetable",
  "themedata",
  "datastore",
  "xmlnstbl",
  "colorschememapping",
]);
interface State {
  hidden: boolean;
  invisible: boolean;
  fallbackLength: number;
}
function invalid(): never {
  throw new Error(
    "The RTF file is malformed or unsupported. Export it as plain UTF-8 text and try again.",
  );
}

/** Reads RTF1 text with Windows-1252 hex escapes; unsupported code pages and binaries fail closed. */
export function rtfToPlainText(input: string): string {
  if (
    input.length > MAX_RTF_LENGTH ||
    new TextEncoder().encode(input).byteLength > MAX_RTF_LENGTH
  )
    invalid();
  const source = input.replace(/^\uFEFF/, "").trim();
  if (!/^\{\\rtf1\b/.test(source)) invalid();
  const stack: State[] = [];
  let state: State = { hidden: false, invisible: false, fallbackLength: 1 };
  let fallback = 0;
  let closed = false;
  let length = 0;
  const output: string[] = [];
  const emit = (text: string, unicode = false) => {
    if (!unicode && fallback > 0) {
      fallback--;
      return;
    }
    if (!state.hidden && !state.invisible) {
      length += text.length;
      if (length > MAX_RTF_LENGTH) invalid();
      output.push(text);
    }
  };
  for (let index = 0; index < source.length;) {
    const character = source[index++]!;
    if (closed) {
      if (!/\s/.test(character)) invalid();
      continue;
    }
    if (character === "{") {
      if (fallback) invalid();
      if (stack.length >= MAX_DEPTH) invalid();
      stack.push(state);
      state = { ...state };
      continue;
    }
    if (character === "}") {
      if (fallback) invalid();
      if (!stack.length) invalid();
      state = stack.pop()!;
      if (!stack.length) closed = true;
      continue;
    }
    if (!stack.length || character === "\0") invalid();
    if (character === "\r" || character === "\n") continue;
    if (character !== "\\") {
      emit(character);
      continue;
    }
    if (index >= source.length) invalid();
    const symbol = source[index++]!;
    if (symbol === "\\" || symbol === "{" || symbol === "}") {
      emit(symbol);
      continue;
    }
    if (symbol === "\n" || symbol === "\r") {
      if (symbol === "\r" && source[index] === "\n") index++;
      emit("\n");
      continue;
    }
    if (symbol === "*") {
      state.hidden = true;
      continue;
    }
    if (symbol === "~") {
      emit(" ");
      continue;
    }
    if (symbol === "_") {
      emit("-");
      continue;
    }
    if (symbol === "-") {
      if (fallback > 0) fallback--;
      continue;
    }
    if (symbol === "'") {
      const hex = source.slice(index, index + 2);
      if (!/^[a-fA-F0-9]{2}$/.test(hex)) invalid();
      emit(
        new TextDecoder("windows-1252").decode(
          Uint8Array.of(parseInt(hex, 16)),
        ),
      );
      index += 2;
      continue;
    }
    if (!/[A-Za-z]/.test(symbol)) invalid();
    const start = index - 1;
    while (index < source.length && /[A-Za-z]/.test(source[index]!)) index++;
    if (index - start > 64) invalid();
    const word = source.slice(start, index);
    const numberStart = index;
    if (source[index] === "-") index++;
    while (index < source.length && /\d/.test(source[index]!)) index++;
    const numeric = source.slice(numberStart, index);
    if (numeric.length > 10 || numeric === "-") invalid();
    const argument = numeric ? Number(numeric) : undefined;
    if (source[index] === " ") index++;
    if (fallback > 0) {
      fallback--;
      continue;
    }
    if (destinations.has(word)) {
      state.hidden = true;
      continue;
    }
    if (word === "bin") invalid();
    if (word === "ansicpg" && argument !== 1252) invalid();
    if (word === "uc") {
      if (argument === undefined || argument < 0 || argument > 16) invalid();
      state.fallbackLength = argument;
    } else if (word === "u") {
      if (argument === undefined || argument < -32768 || argument > 32767)
        invalid();
      emit(String.fromCharCode(argument & 0xffff), true);
      fallback = state.fallbackLength;
    } else if (word === "par" || word === "line") emit("\n");
    else if (word === "tab") emit("\t");
    else if (word === "v") state.invisible = argument !== 0;
    else if (word === "plain") state.invisible = false;
    else if (word === "emdash") emit("—");
    else if (word === "endash") emit("–");
    else if (word === "lquote" || word === "rquote") emit("'");
    else if (word === "ldblquote" || word === "rdblquote") emit('"');
  }
  if (!closed || stack.length || fallback) invalid();
  return output.join("");
}
