import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertHomologationDatabase } from "./helpers/homologation-database.js";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";

const localFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("External calls disabled during founder provisioning"); };

const { db, pool, usersTable, workspacesTable, authRefreshSessionsTable, academyAdminAuditTable } = await import("@workspace/db");
const { eq, desc } = await import("drizzle-orm");
const { default: pino } = await import("pino");
const { registerUser, loginUser, verifyAccessToken, signAccess } = await import("../modules/auth/auth.service.js");
const { default: express } = await import("express");
const { default: academyRouter } = await import("../modules/academy/academy.routes.js");
await assertHomologationDatabase(pool);
const root = new URL("../../../../", import.meta.url);
const credentialsPath = fileURLToPath(new URL(".local/founder-homologation-credentials.json", root));
const email = "founder@nexos.ai";
const log = pino({ level: "silent" });
const issuedSessionIds: string[] = [];
let server: ReturnType<typeof express.application.listen> | undefined;

try {
  const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  let credentials: { email: string; password: string; userId?: string; workspaceId?: string };
  if (!rows.length) {
    const count = await pool.query("SELECT count(*)::int AS count FROM users");
    assert.equal(count.rows[0].count, 0, "Expected empty homologation user database");
    assert.equal(existsSync(credentialsPath), false, "Refusing to replace existing private credentials");
    credentials = { email, password: randomBytes(32).toString("base64url") };
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    const tokens = await registerUser({ email, password: credentials.password, name: "NexOS Founder", locale: "pt-BR", planSlug: "agency" }, log);
    issuedSessionIds.push(tokens.refreshToken.split(".")[0]!);
  } else {
    assert.equal(rows.length, 1);
    assert.ok(existsSync(credentialsPath), "Existing account requires its existing credentials; no reset performed");
    credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
  }
  const login = await loginUser({ email, password: credentials.password }, log);
  issuedSessionIds.push(login.refreshToken.split(".")[0]!);
  const auth = verifyAccessToken(login.accessToken);
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, auth.workspaceId));
  assert.ok(workspace && workspace.ownerId === auth.userId && workspace.status === "active");
  credentials.userId = auth.userId; credentials.workspaceId = auth.workspaceId;
  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });

  const path = fileURLToPath(new URL(".env.homologation.local", root));
  let config = readFileSync(path, "utf8");
  const configured = new Set((process.env.ACADEMY_ADMIN_USER_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean));
  configured.add(auth.userId);
  const updates = { ACADEMY_ADMIN_USER_IDS: [...configured].join(","), ACADEMY_ALLOW_LEGACY_ADMIN_SECRET: "false" };
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    config = pattern.test(config) ? config.replace(pattern, line) : config.trimEnd() + "\n" + line + "\n";
    process.env[key] = value;
  }
  writeFileSync(path, config);
  const app = express(); app.use(express.json()); app.use("/api/academy", academyRouter);
  app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => response.status(500).json({ error: "Activation check failed" }));
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/academy/admin/session`;
  const request = (token?: string) => localFetch(endpoint, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal((await request()).status, 401);
  const response = await request(login.accessToken); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: auth.userId });
  assert.equal((await request(signAccess({ userId: auth.userId, workspaceId: auth.workspaceId, email }))).status, 401);
  await db.update(authRefreshSessionsTable).set({ revokedAt: new Date() }).where(eq(authRefreshSessionsTable.id, auth.sessionId!));
  assert.equal((await request(login.accessToken)).status, 401);
  let audit;
  for (let attempt = 0; attempt < 20; attempt++) {
    [audit] = await db.select().from(academyAdminAuditTable).where(eq(academyAdminAuditTable.actorId, auth.userId)).orderBy(desc(academyAdminAuditTable.createdAt)).limit(1);
    if (audit?.status === 200) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(audit?.status, 200);
  const evidence = { verifiedAt: new Date().toISOString(), scope: "Supabase homologation PostgreSQL and temporary loopback HTTP server; no public deployment", email, userId: auth.userId, workspaceId: auth.workspaceId, checks: { firstUserCreated: !rows.length, passwordLogin: "PASS", uuidAuthorization: "PASS", activeWorkspaceOwnership: "PASS", noAuthorization: "401", tokenWithoutSession: "401", revokedSession: "401", persistedAdminAudit: "PASS" }, auditId: audit!.id, emailOwnershipVerified: false, externalProviderCalls: 0, testSessionsRevoked: true, restartConfiguredApiRequired: true, asaasSandboxJourney: "BLOCKED missing valid key and public application webhook URL" };
  writeFileSync(new URL("docs/SUPABASE_HOMOLOGATION_FOUNDER_ACTIVATION.json", root), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ userId: auth.userId, workspaceId: auth.workspaceId, credentialsFile: credentialsPath, checks: evidence.checks, evidenceFile: "docs/SUPABASE_HOMOLOGATION_FOUNDER_ACTIVATION.json" }));
} finally {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
  for (const id of issuedSessionIds) await db.update(authRefreshSessionsTable).set({ revokedAt: new Date() }).where(eq(authRefreshSessionsTable.id, id));
  await new Promise(resolve => setTimeout(resolve, 100));
  await pool.end();
}
