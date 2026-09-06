import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  getMetaE2eGraphCalls,
  metaGraphFetch,
  resetMetaE2eGraphCalls,
} from "../lib/meta-graph.transport.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run this harness self-test with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const production = spawnSync(
  process.execPath,
  ["--import", "tsx", "-e", "import('./src/lib/env.ts')"],
  { cwd: new URL("../..", import.meta.url), env: { ...process.env, NODE_ENV: "production", META_E2E_TEST_MODE: "true" } },
);
assert.notEqual(production.status, 0, "production must reject META_E2E_TEST_MODE");

const defaultMode = spawnSync(
  process.execPath,
  ["--import", "tsx", "-e", "globalThis.fetch=async()=>new Response('{}'); import('./src/lib/meta-graph.transport.ts').then(async m=>{const r=await m.metaGraphFetch('https://graph.facebook.com/v1/x'); if(!r.ok)process.exit(1)})"],
  { cwd: new URL("../..", import.meta.url), env: { ...process.env, NODE_ENV: "test", META_E2E_TEST_MODE: "false" } },
);
assert.equal(defaultMode.status, 0, "default transport must delegate to fetch");

resetMetaE2eGraphCalls();
const first = await metaGraphFetch("https://graph.facebook.com/v22.0/123/messages?access_token=real-secret", {
  method: "POST",
  headers: { Authorization: "Bearer real-secret" },
  body: JSON.stringify({ access_token: "real-secret", message: "safe test" }),
});
assert.equal(first.ok, true);
const calls = getMetaE2eGraphCalls();
assert.equal(calls.length, 1);
assert.equal(calls[0]?.query.access_token, "[REDACTED]");
assert.deepEqual((calls[0]?.body as Record<string, unknown>).access_token, "[REDACTED]");
assert.doesNotMatch(JSON.stringify(calls), /real-secret/);

process.env["META_E2E_FAIL_ONCE"] = "/fail-once";
resetMetaE2eGraphCalls();
assert.equal((await metaGraphFetch("https://graph.facebook.com/v22.0/fail-once")).status, 500);
assert.equal((await metaGraphFetch("https://graph.facebook.com/v22.0/fail-once")).status, 200);
delete process.env["META_E2E_FAIL_ONCE"];

console.log("meta e2e harness self-test passed");