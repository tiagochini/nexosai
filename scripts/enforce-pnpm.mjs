import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const userAgent = process.env.npm_config_user_agent ?? "";

for (const filename of ["package-lock.json", "yarn.lock"]) {
  rmSync(fileURLToPath(new URL(filename, root)), { force: true });
}

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
