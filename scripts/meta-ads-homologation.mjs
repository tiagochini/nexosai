import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { homologationEnvironment, root } from "./homologation-environment.mjs";

// Explicit private runtime profile; no provider credentials inherited from parent.
const { environment, adminUrl } = homologationEnvironment();
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(path.join(root, "scripts/homologation-test-transport.mjs"))
      .href,
    path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs"),
    "artifacts/api-server/src/scripts/test-meta-homologation-db.ts",
  ],
  {
    cwd: root,
    env: { ...environment, META_ADS_HOMOLOGATION_DB: "true" },
    windowsHide: true,
  },
);
let output = "";
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    output = (output + chunk).slice(-24000);
  });
const status = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
const secrets = [
  adminUrl,
  environment.DATABASE_URL,
  ...[adminUrl, environment.DATABASE_URL].flatMap((url) => {
    const parsed = new URL(url);
    return [parsed.password, decodeURIComponent(parsed.password)];
  }),
];
for (const value of secrets)
  if (value) output = output.replaceAll(value, "[redacted]");
console.log(output.trim());
process.exitCode = status ?? 1;
