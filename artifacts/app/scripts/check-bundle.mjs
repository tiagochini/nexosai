import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = path.join(appRoot, "dist", "public");
const html = await readFile(path.join(outputRoot, "index.html"), "utf8");
const entryMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i);

if (!entryMatch) {
  throw new Error("Could not find the initial JavaScript entry in dist/public/index.html");
}

const entryRelativePath = entryMatch[1].replace(/^\/+/, "");
const entryPath = path.join(outputRoot, entryRelativePath);
const entryStat = await stat(entryPath);
const entryContents = await readFile(entryPath);
const gzipBytes = gzipSync(entryContents).byteLength;
const maxBytes = Number(process.env.MAX_INITIAL_JS_BYTES ?? 500 * 1024);

if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
  throw new Error("MAX_INITIAL_JS_BYTES must be a positive number");
}

console.log(
  `Initial JavaScript: ${(entryStat.size / 1024).toFixed(1)} KiB ` +
    `(${(gzipBytes / 1024).toFixed(1)} KiB gzip); budget ${(maxBytes / 1024).toFixed(1)} KiB.`,
);

if (entryStat.size > maxBytes) {
  throw new Error(
    `Initial JavaScript exceeds the budget by ${((entryStat.size - maxBytes) / 1024).toFixed(1)} KiB`,
  );
}
