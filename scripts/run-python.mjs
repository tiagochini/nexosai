import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-python.mjs <script.py> [...args]");
  process.exit(2);
}

const candidates = process.platform === "win32"
  ? ["python", "py"]
  : ["python3", "python"];

for (const executable of candidates) {
  const executableArgs = executable === "py" ? ["-3", ...args] : args;
  const result = spawnSync(executable, executableArgs, { stdio: "inherit" });
  if (result.error && result.error.code === "ENOENT") continue;
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error("Python 3 was not found. Install it and ensure it is available on PATH.");
process.exit(1);
