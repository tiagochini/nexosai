import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);

const forbiddenTrackedFiles = [
  /^\.env$/i,
  /^\.env\.(?!example$)[^/]+$/i,
  /(^|\/)backup(?:\.[^/]+)?\.(?:sql|dump|gz)$/i,
  /\.(?:pem|p12|pfx|key)$/i,
];

const secretPatterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "GitHub token", regex: /\bgh[oprsu]_[0-9A-Za-z]{30,}\b/g },
  { name: "Slack token", regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { name: "OpenAI-style secret", regex: /\bsk-[0-9A-Za-z_-]{20,}\b/g },
  {
    name: "credential in PostgreSQL URL",
    regex: /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@/]+@[^\s/]+/gi,
  },
  {
    name: "credential in Redis URL",
    regex: /redis(?:s)?:\/\/(?:[^\s:@/]+:)?[^\s@/]+@[^\s/]+/gi,
  },
];

const findings = [];
for (const file of tracked) {
  const normalized = file.replaceAll("\\", "/");
  if (forbiddenTrackedFiles.some((pattern) => pattern.test(normalized))) {
    findings.push({ file: normalized, line: 1, rule: "forbidden sensitive filename" });
  }

  let buffer;
  try {
    buffer = await readFile(path.join(root, file));
  } catch {
    continue;
  }
  if (buffer.length > 5 * 1024 * 1024 || buffer.includes(0)) continue;
  const text = buffer.toString("utf8");
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const matchedText = match[0];
      if (
        pattern.name.includes("URL") &&
        /(?:USUARIO|SENHA|PASSWORD|CHANGE_ME|EXAMPLE|postgres:postgres|user:pass@host)/i.test(matchedText)
      ) {
        continue;
      }
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ file: normalized, line, rule: pattern.name });
    }
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.rule})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${tracked.length} versionable files checked.`);
}
