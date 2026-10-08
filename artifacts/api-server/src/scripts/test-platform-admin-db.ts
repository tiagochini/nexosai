import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pino from "pino";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, authRefreshSessionsTable } from "@workspace/db";
import adminRouter from "../modules/admin/admin.routes.js";
import authRouter from "../modules/auth/auth.routes.js";
import billingRouter from "../modules/billing/billing.routes.js";
import creditsRouter from "../modules/credits/credits.routes.js";
import fingerprintRouter from "../modules/fingerprint/fingerprint.routes.js";
import launchRouter from "../modules/nexos-self-launch/nexos-self-launch.routes.js";
import regionalRouter from "../modules/market-intel/regional-intelligence.routes.js";
import { issueTokens } from "../modules/auth/auth.service.js";
import { isPlatformAdmin } from "../modules/admin/admin-access.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

// Fixtures must never be run against homologation, production or a persistent dev DB.
assert.equal(process.env.NODE_ENV, "test");
assert.ok(["/nexos_p3", "/nexos_ci"].includes(new URL(process.env.DATABASE_URL!).pathname));
const previous = process.env.PLATFORM_ADMIN_USER_IDS;
const marker = randomUUID();
const actors: string[] = [];
const log = pino({ level: "silent" });
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = log; next(); });
for (const [prefix, router] of [["admin", adminRouter], ["auth", authRouter], ["billing", billingRouter],
  ["credits", creditsRouter], ["fingerprints", fingerprintRouter], ["nexos-launch", launchRouter], ["regional", regionalRouter]] as const) {
  app.use(`/api/${prefix}`, router);
}
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof AppError) res.status(error.statusCode).json({ code: error.code });
  else res.status(500).json({ error: "Test request failed" });
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api`;
async function request(path: string, token?: string, method = "GET", body?: object) {
  return fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
try {
  const [plan] = await db.select().from(plansTable).limit(1);
  assert.ok(plan);
  const [admin] = await db.insert(usersTable).values({ email: `uuid-admin-${marker}@example.invalid`, name: "UUID admin", passwordHash: "inert-fixture" }).returning();
  const [ordinary] = await db.insert(usersTable).values({ email: "admin@nexos.ai", name: "Old allowlisted email", passwordHash: "inert-fixture" }).returning();
  assert.ok(admin && ordinary);
  actors.push(admin.id, ordinary.id);
  const [adminWs] = await db.insert(workspacesTable).values({ ownerId: admin.id, planId: plan.id, name: "Admin fixture", slug: `admin-${marker}` }).returning();
  const [ordinaryWs] = await db.insert(workspacesTable).values({ ownerId: ordinary.id, planId: plan.id, name: "Ordinary fixture", slug: `ordinary-${marker}` }).returning();
  assert.ok(adminWs && ordinaryWs);
  const session = await issueTokens(admin, adminWs.id);
  const other = await issueTokens(ordinary, ordinaryWs.id);

  for (const config of [undefined, "", admin.email, `${admin.id},invalid`]) {
    if (config === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS; else process.env.PLATFORM_ADMIN_USER_IDS = config;
    assert.equal(isPlatformAdmin(admin.id), false);
    assert.equal((await request("/admin/overview", session.accessToken)).status, 403);
  }
  process.env.PLATFORM_ADMIN_USER_IDS = ` ${admin.id.toUpperCase()} `;
  assert.equal(isPlatformAdmin(admin.id), true);
  assert.equal(isPlatformAdmin(ordinary.id), false);
  assert.equal((await request("/admin/overview", session.accessToken)).status, 200);
  // Exercise every real Command Center route: denial must precede DB/provider/mutation handlers.
  const routes = (adminRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
    .flatMap(layer => layer.route ? Object.keys(layer.route.methods).map(method => ({ path: layer.route!.path, method })) : []);
  assert.ok(routes.length >= 20);
  for (const route of routes) {
    const path = `/admin${route.path.replace(/:[A-Za-z]+/g, randomUUID())}`;
    assert.equal((await request(path, undefined, route.method.toUpperCase())).status, 401);
    assert.equal((await request(path, other.accessToken, route.method.toUpperCase(), route.method === "get" ? undefined : {})).status, 403);
  }
  for (const [path, method] of [["/credits/admin-topup", "POST"], ["/billing/admin/unlimited-credits", "POST"],
    ["/fingerprints", "GET"], ["/fingerprints/fixture", "GET"], ["/nexos-launch/framework", "GET"],
    ["/nexos-launch/generate", "POST"], ["/regional/entitlement/admin-activate", "POST"]]) {
    assert.equal((await request(path!, other.accessToken, method!, method === "POST" ? {} : undefined)).status, 403);
  }
  const me = await (await request("/auth/me", session.accessToken)).json() as { isPlatformAdmin: boolean };
  assert.equal(me.isPlatformAdmin, true);
  const otherMe = await (await request("/auth/me", other.accessToken)).json() as { isPlatformAdmin: boolean };
  assert.equal(otherMe.isPlatformAdmin, false);
  await db.update(usersTable).set({ email: `renamed-${marker}@example.invalid` }).where(eq(usersTable.id, admin.id));
  assert.equal((await request("/admin/overview", session.accessToken)).status, 200, "email changes do not alter UUID privilege");
  const sign = (payload: object) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: "5m" });
  const claims = { userId: admin.id, workspaceId: adminWs.id, email: "founder@nexos.ai" };
  for (const token of [sign(claims), sign({ ...claims, sessionId: other.refreshToken.split(".")[0] })]) {
    assert.equal((await request("/admin/overview", token)).status, 401, "session must be bound to authorized UUID/workspace");
  }
  await db.update(authRefreshSessionsTable).set({ expiresAt: new Date(0) }).where(eq(authRefreshSessionsTable.id, session.refreshToken.split(".")[0]!));
  assert.equal((await request("/admin/overview", session.accessToken)).status, 401);
  const fresh = await issueTokens(admin, adminWs.id);
  await db.update(workspacesTable).set({ status: "suspended" }).where(eq(workspacesTable.id, adminWs.id));
  assert.equal((await request("/admin/overview", fresh.accessToken)).status, 401);
  await db.update(workspacesTable).set({ status: "active" }).where(eq(workspacesTable.id, adminWs.id));
  const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers: {
    Origin: new URL(env.APP_URL).origin, Cookie: `nexos_refresh=${encodeURIComponent(fresh.refreshToken)}` } });
  assert.equal(logout.status, 204);
  assert.equal((await request("/admin/overview", fresh.accessToken)).status, 401, "logout immediately revokes admin access");
  const revokedMe = await (await request("/auth/me", fresh.accessToken)).json() as { isPlatformAdmin: boolean };
  assert.equal(revokedMe.isPlatformAdmin, false);
  const active = await issueTokens(admin, adminWs.id);
  delete process.env.PLATFORM_ADMIN_USER_IDS;
  assert.equal((await request("/admin/overview", active.accessToken)).status, 403, "removing UUID takes effect without new token");
  console.log(`PASS platform UUID admin: ${routes.length} Command Center routes and 7 related routes deny ordinary users; configuration, email change, session binding, expiry, inactive workspace, logout and removal verified`);
} finally {
  if (previous === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS; else process.env.PLATFORM_ADMIN_USER_IDS = previous;
  for (const id of actors) await db.delete(usersTable).where(eq(usersTable.id, id));
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
