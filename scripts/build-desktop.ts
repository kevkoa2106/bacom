import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

// file:// does not consistently pass through response-header interception.
const htmlPath = path.join(process.cwd(), "dist", "index.html");
const policy =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const html = await readFile(htmlPath, "utf8");
const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
const withoutPolicy = html.replace(
  /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
  "",
);
if (!/<head\b[^>]*>/i.test(withoutPolicy))
  throw new Error("Renderer HTML has no head element.");
await writeFile(
  htmlPath,
  withoutPolicy.replace(/<head\b[^>]*>/i, (head) => `${head}${meta}`),
);

const outdir = path.join(process.cwd(), "dist-electron");
for (const [entrypoint, output] of [
  ["electron/main.ts", "main.cjs"],
  ["electron/preload.ts", "preload.cjs"],
] as const) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    naming: output,
    target: "node",
    format: "cjs",
    external: ["electron"],
    minify: false,
    sourcemap: "none",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(
    `Built ${path.relative(process.cwd(), path.join(outdir, output))}`,
  );
}
