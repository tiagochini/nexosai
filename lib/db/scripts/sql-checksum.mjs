import { createHash } from "node:crypto";

export function normalizeSqlLineEndings(contents) {
  return contents.replace(/\r\n?/g, "\n");
}

export function sqlChecksum(contents) {
  return createHash("sha256")
    .update(normalizeSqlLineEndings(contents))
    .digest("hex");
}

export function acceptedSqlChecksums(contents) {
  const normalized = normalizeSqlLineEndings(contents);
  const crlf = normalized.replace(/\n/g, "\r\n");

  return new Set([
    sqlChecksum(normalized),
    createHash("sha256").update(crlf).digest("hex"),
  ]);
}
