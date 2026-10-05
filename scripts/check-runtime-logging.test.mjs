import assert from "node:assert/strict";
import test from "node:test";
import { inspectRuntimeLogging } from "./check-runtime-logging.mjs";

test("reject private content, alternate raw error fields, console and independent logger imports", () => {
  for (const field of ["text", "msg", "message", "lastError", "errText", "errorMessage", "contractWarn", "response", "body", "payload", "prompt", "stdout", "stderr"]) {
    assert.equal(inspectRuntimeLogging(`logger.info({ ${field}: fixture }, 'static event');`, "modules/fixture.ts").findings.length, 1);
  }
  assert.equal(inspectRuntimeLogging("console.error(fixture);", "modules/fixture.ts").findings.length, 1);
  assert.equal(inspectRuntimeLogging("globalThis.console.log(fixture);", "modules/fixture.ts").findings.length, 1);
  assert.equal(inspectRuntimeLogging("process.stderr.write(fixture);", "modules/fixture.ts").findings.length, 1);
  assert.equal(inspectRuntimeLogging("logger.info({ ['raw_preview']: fixture }, 'static');", "modules/fixture.ts").findings.length, 1);
  assert.equal(inspectRuntimeLogging("import pino from 'pino';", "modules/fixture.ts").findings.length, 1);
});

test("allow operational metadata, type imports and the central logger factory", () => {
  assert.deepEqual(inspectRuntimeLogging("req.log.warn({ campaignId, statusCode: 502, err }, 'Provider failed');", "modules/fixture.ts").findings, []);
  assert.deepEqual(inspectRuntimeLogging("import type { Logger } from 'pino';", "modules/fixture.ts").findings, []);
  assert.deepEqual(inspectRuntimeLogging("import { type Logger } from 'pino';", "modules/fixture.ts").findings, []);
  assert.deepEqual(inspectRuntimeLogging("import pino from 'pino';", "src/lib/logger.ts").findings, []);
});
