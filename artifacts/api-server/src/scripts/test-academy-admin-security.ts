import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import express from "express";
import { once } from "node:events";

// Unauthorized routes and the empty authorized request must never query the DB.
process.env.DATABASE_URL ??= "postgresql://fixture:fixture@127.0.0.1:1/unused";
const previous = process.env.ACADEMY_ADMIN_SECRET;
const secret = randomBytes(32).toString("hex");
const { default: academyRouter } = await import("../modules/academy/academy.routes.js");
const { pool } = await import("@workspace/db");
const app = express();
app.use(express.json());
app.use("/api/academy", academyRouter);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/academy`;
const routes: [string, string][] = [
  ["GET", "/leads"], ["GET", "/funnel/stats"], ["GET", "/purchases"],
  ["GET", "/admin/purchases"], ["POST", "/admin/confirm"], ["POST", "/admin/gift-codes"],
  ["GET", "/leads/00000000-0000-4000-8000-000000000000"],
  ["PATCH", "/leads/00000000-0000-4000-8000-000000000000"],
  ["POST", "/leads/00000000-0000-4000-8000-000000000000/enroll"],
  ["POST", "/leads/00000000-0000-4000-8000-000000000000/convert"],
  ["POST", "/funnel-tick"],
];
try {
  for (const configured of [undefined, "", "nexos2025", " ".repeat(32), secret]) {
    if (configured === undefined) delete process.env.ACADEMY_ADMIN_SECRET;
    else process.env.ACADEMY_ADMIN_SECRET = configured;
    for (const [method, path] of routes) {
      for (const credential of [undefined, "nexos2025"]) {
        const response = await fetch(`${base}${path}?secret=${encodeURIComponent(secret)}`, {
          method, headers: credential ? { "x-admin-secret": credential } : {},
        });
        assert.equal(response.status, 401, `${method} ${path} must reject missing/default/query credentials`);
        assert.deepEqual(await response.json(), { error: "Unauthorized" });
      }
    }
  }
  process.env.ACADEMY_ADMIN_SECRET = secret;
  const accepted = await fetch(`${base}/admin/confirm`, {
    method: "POST", headers: { "x-admin-secret": secret, "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(accepted.status, 400, "configured header must reach ordinary input validation, without any DB write");
  assert.deepEqual(await accepted.json(), { error: "purchaseId required" });
  console.log("PASS Academy admin HTTP: 11 sensitive routes deny absent/default/query credentials; configured header reaches validation (no DB or email writes)");
} finally {
  if (previous === undefined) delete process.env.ACADEMY_ADMIN_SECRET;
  else process.env.ACADEMY_ADMIN_SECRET = previous;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
