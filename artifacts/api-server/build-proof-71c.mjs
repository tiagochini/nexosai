/**
 * Compila test-proof-71c.ts como entry point separado do bundle principal.
 * Uso: node build-proof-71c.mjs && node dist-proof/proof.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);
const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const outDir = path.resolve(artifactDir, "dist-proof");
await rm(outDir, { recursive: true, force: true });

await build({
  entryPoints: [path.resolve(artifactDir, "src/test-proof-71c.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  outbase: path.resolve(artifactDir, "src"),
  logLevel: "info",
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
  },
  external: [
    "*.node",
    "sharp",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "@google-cloud/storage",
    "@google-cloud/secret-manager",
    "bullmq",
    "ioredis",
    "pino",
    "pino-pretty",
    "thread-stream",
  ],
});

console.log("[build-proof-71c] compilado em dist-proof/test-proof-71c.mjs");
