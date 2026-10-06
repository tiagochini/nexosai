import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { Request } from "express";
import { academyVerificationKey, ACADEMY_VERIFICATION_LIMIT } from "../modules/academy/academy-verification.security.js";

process.env.DATABASE_URL ??= "postgresql://127.0.0.1:1/unused";
// Default route must not trust forwarded addresses from direct clients.
delete process.env.ACADEMY_TRUSTED_PROXY_IPS;
const { default: router } = await import("../modules/academy/academy.routes.js");
const { pool } = await import("@workspace/db");
const request = (peer: string, ip: string) => ({ socket: { remoteAddress: peer }, ip }) as Pick<Request, "socket" | "ip">;
assert.equal(academyVerificationKey(request("::ffff:127.0.0.1", "198.51.100.1")), "127.0.0.1");
assert.equal(academyVerificationKey(request("127.0.0.1", "198.51.100.2"), ["0.0.0.0/0", "not-an-ip"]), "127.0.0.1");
assert.equal(academyVerificationKey(request("127.0.0.1", "198.51.100.2"), ["127.0.0.1"]), "198.51.100.2");
assert.equal(academyVerificationKey(request("2001:db8:1:1::1", "")), academyVerificationKey(request("2001:db8:1:2::2", "")), "IPv6 addresses in the same /56 share quota");
const app = express();
app.set("trust proxy", 1); // Same global setting as the real app.
app.use(express.json());
app.use("/api/academy", router);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/academy`;
try {
  for (let index = 0; index < ACADEMY_VERIFICATION_LIMIT; index++) {
    const response = await fetch(`${base}/verify/${index}`, { headers: { "X-Forwarded-For": `198.51.100.${index + 1}` } });
    assert.equal(response.status, 400, "short tokens fail before any DB query but count against quota");
    await response.json();
  }
  const blocked = await fetch(`${base}/verify/new`, { headers: { "X-Forwarded-For": "203.0.113.1" } });
  assert.equal(blocked.status, 429, "changing token/forwarded IP must not reset quota");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.ok(blocked.headers.get("ratelimit"));
  assert.equal(((await blocked.json()) as { code: string }).code, "ACADEMY_VERIFICATION_RATE_LIMITED");
  const unrelated = await fetch(`${base}/admin/confirm`, { method: "POST" });
  assert.equal(unrelated.status, 401, "verification quota does not apply to unrelated routes");
  await unrelated.json();
  console.log("PASS Academy verification HTTP: bounded attempts, forwarded-IP spoof resistance, IPv6 grouping and unrelated-route isolation (no DB/email writes)");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
