import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { homologationEnvironment } from "./homologation-environment.mjs";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const resolveFromRoot = (path) => fileURLToPath(new URL(path, root));

function readEnv(name) {
  const path = new URL(name, root);
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

const sharedEnv = process.argv.includes("--homologation") ? homologationEnvironment().environment : {
  ...process.env,
  ...readEnv(".env"),
  ...readEnv(".env.local"),
};

const metaE2eMode = process.argv.includes("--meta-e2e");
const apiPort = sharedEnv.DEV_API_PORT || "8080";
const appPort = sharedEnv.DEV_APP_PORT || "8081";

const required = ["DATABASE_URL", "SESSION_SECRET"];
const missing = required.filter((name) => !sharedEnv[name]);
if (missing.length > 0) {
  console.error(`Variaveis obrigatorias ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

const apiEnv = {
  ...sharedEnv,
  PORT: apiPort,
  NODE_ENV: "development",
  ...(metaE2eMode ? { META_E2E_TEST_MODE: "true" } : {}),
};
const appEnv = {
  ...sharedEnv,
  PORT: appPort,
  BASE_PATH: sharedEnv.BASE_PATH || "/",
  API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  NODE_ENV: "development",
};

console.log("Compilando a API...");
const build = spawnSync(
  process.execPath,
  [resolveFromRoot("artifacts/api-server/build.mjs")],
  { cwd: rootPath, env: apiEnv, stdio: "inherit" },
);

if (build.status !== 0) process.exit(build.status ?? 1);

const children = [
  spawn(
    process.execPath,
    [resolveFromRoot("artifacts/api-server/dist/index.mjs")],
    { cwd: rootPath, env: apiEnv, stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      resolveFromRoot("artifacts/app/node_modules/vite/bin/vite.js"),
      "--config",
      resolveFromRoot("artifacts/app/vite.config.ts"),
    ],
    { cwd: rootPath, env: appEnv, stdio: "inherit" },
  ),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping && code !== 0) stop(code ?? 1);
  });
}

console.log(`NexOS ${process.argv.includes("--homologation") ? "homologação" : "local"}: http://localhost:${appPort} (API: http://localhost:${apiPort}/api)`);
if (metaE2eMode) {
  console.log("Meta E2E mode enabled: outbound Graph API calls are simulated in memory.");
}
