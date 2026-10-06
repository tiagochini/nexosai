import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import Redis from "ioredis";
import { createAcademyVerificationLimiter, closeAcademyQuotaConnections } from "../modules/academy/academy-verification.security.js";
import { env } from "../lib/env.js";
assert.equal(process.env.NODE_ENV, "test");
const prefix = `owned-p0-quota:${randomUUID()}:`, servers: ReturnType<express.Express["listen"]>[] = [];
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 0 }); redis.on("error", () => {});
async function start(redisURL: string) {
  const app = express(); app.set("trust proxy", 1);
  app.get("/verify/:token", createAcademyVerificationLimiter([], { redisURL, prefix }), (_req, res) => res.json({ valid: false }));
  const server = app.listen(0, "127.0.0.1"); servers.push(server); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); return `http://127.0.0.1:${address.port}`;
}
try {
  const first = await start(env.REDIS_URL), second = await start(env.REDIS_URL);
  const statuses = await Promise.all(Array.from({ length: 20 }, async (_, i) => (await fetch(`${i % 2 ? first : second}/verify/${i}`, { headers: { "X-Forwarded-For": `198.51.100.${i + 1}` } })).status));
  assert.equal(statuses.filter((s) => s === 200).length, 10); assert.equal(statuses.filter((s) => s === 429).length, 10);
  const replacement = await start(env.REDIS_URL); assert.equal((await fetch(`${replacement}/verify/restarted`)).status, 429);
  const unavailable = await start("redis://127.0.0.1:1"); assert.equal((await fetch(`${unavailable}/verify/offline`)).status, 503);
  console.log("PASS: shared atomic quota across instances/concurrent calls/restart, spoofed-forwarded IP resistance and fail-closed Redis outage");
} finally {
  for (const server of servers) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  closeAcademyQuotaConnections(); const keys = await redis.keys(`${prefix}*`); if (keys.length) await redis.del(...keys); redis.disconnect();
}
