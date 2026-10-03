import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pino from "pino";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, authRefreshSessionsTable } from "@workspace/db";
import authRouter from "../modules/auth/auth.routes.js";
import { issueTokens, verifyAccessToken } from "../modules/auth/auth.service.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

const log = pino({ level: "silent" });
const marker = randomUUID();
const email = `session-${marker}@example.invalid`;
const origin = new URL(env.APP_URL).origin;
const [plan] = await db.select().from(plansTable).limit(1);
assert.ok(plan);
let userId: string | undefined;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = log; next(); });
app.use("/api/auth", authRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof AppError) res.status(error.statusCode).json({ code: error.code });
  else res.status(500).json({ error: "Test request failed" });
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/auth`;
const post = (path: string, cookie?: string, body: object = {}, source = origin, accessToken?: string) => fetch(`${base}${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: source, ...(cookie ? { Cookie: cookie } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  body: JSON.stringify(body),
});
const cookiePair = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!;
async function readSessionResponse(response: Response) {
  const body = await response.json() as Record<string, unknown>;
  assert.equal(typeof body.accessToken, "string");
  return body as { accessToken: string };
}
try {
  // Fixture creation does not call registration providers or alter real accounts.
  const password = `Session-${marker}!`;
  const [user] = await db.insert(usersTable).values({ email, name: "Session Test", passwordHash: await bcrypt.hash(password, 4) }).returning();
  userId = user!.id;
  const workspaces = await db.insert(workspacesTable).values([
    { ownerId: userId, planId: plan.id, name: "Session One", slug: `session-one-${marker}` },
    { ownerId: userId, planId: plan.id, name: "Session Two", slug: `session-two-${marker}` },
  ]).returning();
  const initial = await issueTokens(user!, workspaces[0]!.id);
  const login = await post("/login", undefined, { email, password });
  assert.equal(login.status, 200);
  assert.equal("refreshToken" in await readSessionResponse(login), false);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
  const previousLoginCookie = cookiePair(login);
  assert.equal((await post("/login", previousLoginCookie, { email, password })).status, 200);
  assert.equal((await post("/refresh", previousLoginCookie)).status, 401, "logging in again revokes the previous browser session");
  const cookie = `nexos_refresh=${encodeURIComponent(initial.refreshToken)}`;
  const stored = await db.select().from(authRefreshSessionsTable).where(eq(authRefreshSessionsTable.userId, userId));
  assert.equal(stored[0]!.tokenHash.includes(initial.refreshToken), false, "database stores only hashes");

  const forbidden = await post("/refresh", cookie, {}, "https://attacker.example");
  assert.equal(forbidden.status, 403, "untrusted origins cannot refresh");
  const bodyToken = await post("/refresh", undefined, { refreshToken: initial.refreshToken });
  assert.equal(bodyToken.status, 401, "body tokens cannot replace HttpOnly cookies");
  const concurrent = await Promise.all([post("/refresh", cookie), post("/refresh", cookie)]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 401], "a token is consumed once across concurrent requests");
  const success = concurrent.find((response) => response.status === 200)!;
  const data = await readSessionResponse(success);
  assert.equal("refreshToken" in data, false, "refresh credentials never appear in JSON");
  assert.equal(success.headers.get("cache-control"), "no-store");
  const setCookie = success.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\/api\/auth/i);
  let currentCookie = cookiePair(success);
  assert.notEqual(currentCookie, cookie, "rotation issues a new cookie");
  assert.equal((await post("/refresh", cookie)).status, 401, "replay is rejected");

  const switched = await post(`/workspaces/${workspaces[1]!.id}/switch`, currentCookie, {}, origin, data.accessToken);
  assert.equal(switched.status, 200);
  const switchedData = await readSessionResponse(switched);
  assert.equal(verifyAccessToken(switchedData.accessToken).workspaceId, workspaces[1]!.id);
  assert.equal("refreshToken" in switchedData, false);
  assert.equal((await post("/refresh", currentCookie)).status, 401, "switch revokes the previous workspace session");
  currentCookie = cookiePair(switched);
  const refreshed = await post("/refresh", currentCookie);
  assert.equal(refreshed.status, 200);
  assert.equal(verifyAccessToken((await readSessionResponse(refreshed)).accessToken).workspaceId, workspaces[1]!.id);
  currentCookie = cookiePair(refreshed);
  const logout = await post("/logout", currentCookie);
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await post("/refresh", currentCookie)).status, 401, "logout revocation persists on the server");

  const expiring = await issueTokens(user!, workspaces[0]!.id);
  await db.update(authRefreshSessionsTable).set({ expiresAt: new Date(0) }).where(eq(authRefreshSessionsTable.id, expiring.refreshToken.split(".")[0]!));
  assert.equal((await post("/refresh", `nexos_refresh=${expiring.refreshToken}`)).status, 401);
  assert.equal((await post("/refresh", "nexos_refresh=malformed")).status, 401);
  assert.equal((await post("/refresh", undefined, {}, "null")).status, 403);
  console.log("HTTP session cookie, CSRF, concurrent rotation, replay, workspace switch, expiry, and logout tests passed");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
}
