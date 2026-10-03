import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  acceptedSqlChecksums,
  normalizeSqlLineEndings,
  sqlChecksum,
} from "./sql-checksum.mjs";

test("normalizes Windows and legacy Mac line endings", () => {
  const expected = "select 1;\nselect 2;\n";

  assert.equal(normalizeSqlLineEndings(expected), expected);
  assert.equal(
    normalizeSqlLineEndings("select 1;\r\nselect 2;\r\n"),
    expected,
  );
  assert.equal(normalizeSqlLineEndings("select 1;\rselect 2;\r"), expected);
});

test("produces the same checksum for equivalent line endings", () => {
  const lf = "select 1;\nselect 2;\n";
  const crlf = "select 1;\r\nselect 2;\r\n";
  const cr = "select 1;\rselect 2;\r";

  assert.equal(sqlChecksum(crlf), sqlChecksum(lf));
  assert.equal(sqlChecksum(cr), sqlChecksum(lf));
  assert.notEqual(sqlChecksum("select 3;\n"), sqlChecksum(lf));
});

test("accepts historical LF and CRLF checksums", () => {
  const lf = "select 1;\nselect 2;\n";
  const crlf = "select 1;\r\nselect 2;\r\n";
  const accepted = acceptedSqlChecksums(lf);

  assert.equal(accepted.size, 2);
  assert.ok(accepted.has(sqlChecksum(lf)));
  assert.ok(accepted.has(createHash("sha256").update(crlf).digest("hex")));
});
