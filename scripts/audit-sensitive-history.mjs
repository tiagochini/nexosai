import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim() === 'true') {
  throw new Error('Full history audit requires a complete checkout (fetch-depth: 0).');
}
const output = execFileSync(
  "git",
  ["log", "--all", "--pretty=format:", "--name-only"],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const sensitivePathPatterns = [
  /^\.env$/i,
  /^\.env\.(?!example$)[^/]+$/i,
  /(^|\/)backup(?:\.[^/]+)?\.(?:sql|dump|gz)$/i,
  /(^|\/)Pasted-.*(?:SECRET|TOKEN|PASSWORD|CREDENTIAL).*\.txt$/i,
  /\.(?:pem|p12|pfx|key)$/i,
];

const paths = [...new Set(
  output
    .split(/\r?\n/)
    .map((entry) => entry.trim().replaceAll("\\", "/"))
    .filter(Boolean)
    .filter((entry) => sensitivePathPatterns.some((pattern) => pattern.test(entry))),
)].sort();

if (paths.length === 0) {
  console.log("Sensitive history audit passed: no forbidden paths found in reachable commits.");
} else {
  console.error(`Sensitive history audit failed: ${paths.length} forbidden path(s) remain:`);
  for (const file of paths) {
    const commits = execFileSync(
      "git",
      ["log", "--all", "--format=%H", "--", file],
      { cwd: root, encoding: "utf8" },
    ).split(/\r?\n/).filter(Boolean).length;
    console.error(`- ${file} (${commits} commit(s))`);
  }
  process.exitCode = 1;
}
