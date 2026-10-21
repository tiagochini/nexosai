import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool, usersTable as users, academyStudentAccountsTable as accounts, academyPurchasesTable as purchases, workspacesTable } from "@workspace/db";
import studentRouter from "../modules/academy/academy-student.routes.js";
import contentRouter from "../modules/academy/academy-content.routes.js";
import academyRouter from "../modules/academy/academy.routes.js";
import { hashStudentSecret, newStudentSecret, STUDENT_COOKIE } from "../modules/academy/academy-student-session.js";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.ACADEMY_STUDENT_OWNED_TESTS, "true", "Use the isolated local test runner");
assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/nexos_academy_students_test");
const app = express(); app.use(express.json());
app.use("/student", studentRouter); app.use("/content", contentRouter); app.use("/academy", academyRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err); res.status(500).json({ error: "Test route failed" });
});
const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const password = "Owned-academy-password-123";
const ids: string[] = []; const purchaseIds: string[] = [];
async function request(path: string, cookie = "", body?: unknown, method = body === undefined ? "GET" : "POST") {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: "http://localhost:8081", ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!;
async function register(label: string) {
  const email = `${label}-${randomUUID()}@example.invalid`;
  const response = await request("/student/register", "", { name: label, email, password });
  assert.equal(response.status, 201);
  const data = await response.json() as { user: { id: string }; products: unknown[] };
  ids.push(data.user.id); assert.deepEqual(data.products, []);
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/i); assert.match(header, /Path=\/api\/academy/);
  assert.ok(!header.includes("nexos_refresh"));
  return { id: data.user.id, email, cookie: cookieOf(response) };
}
async function purchase(productId: string, status = "confirmed") {
  const id = randomUUID(), key = `ST-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
  purchaseIds.push(id);
  await db.insert(purchases).values({ id, accessToken: key, customerEmail: "buyer@example.invalid", productId, status, amountCents: 100 });
  return { id, key };
}
try {
  const hostile = await fetch(base + "/student/register", { method: "POST", headers: { Origin: "https://evil.invalid", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(hostile.status, 403);
  assert.equal((await request("/student/session", `${STUDENT_COOKIE}=${"-".repeat(36)}.${"0".repeat(64)}`)).status, 401);
  const alice = await register("Alice"), bob = await register("Bob");
  assert.equal((await db.select().from(workspacesTable).where(inArray(workspacesTable.ownerId, ids))).length, 0, "Academy signup must not provision a platform subscription/workspace");
  const paid = await purchase("complete-bundle");
  const claims = await Promise.all([request("/student/activate", alice.cookie, { key: paid.key }), request("/student/activate", bob.cookie, { key: paid.key })]);
  assert.deepEqual(claims.map(response => response.status).sort(), [200, 409], "Concurrent claims must have exactly one owner");
  const owner = claims[0]!.status === 200 ? alice : bob;
  assert.equal((await request("/student/activate", owner.cookie, { key: paid.key.toLowerCase() })).status, 200, "Owner can safely repeat activation");
  const pending = await purchase("mini-guide", "pending");
  assert.equal((await request("/student/activate", owner.cookie, { key: pending.key })).status, 403);
  const rawCode = await fetch(base + "/content/course", { headers: { "X-Academy-Access-Code": paid.key } });
  assert.equal(rawCode.status, 401, "A raw key must no longer authorize material");
  assert.equal((await request("/content/course", owner.cookie)).status, 200);
  const saved = await request("/student/progress", owner.cookie, { lessonId: "atencao-1", complete: true }, "PATCH");
  assert.equal(saved.status, 200);
  const login = await request("/student/login", "", { email: owner.email.toUpperCase(), password });
  assert.equal(login.status, 200); const replacement = cookieOf(login);
  assert.notEqual(replacement, owner.cookie);
  const stale = await request("/student/session", owner.cookie);
  assert.equal(stale.status, 401); assert.equal((await stale.json() as { code: string }).code, "ACADEMY_SESSION_ENDED");
  for (const endpoint of ["/content/course", "/content/mini-guide", "/content/mini-guide.pdf"]) assert.equal((await request(endpoint, owner.cookie)).status, 401, endpoint);
  assert.equal((await request("/academy/tutor", owner.cookie, {})).status, 401);
  assert.equal((await request("/student/progress", owner.cookie, { lessonId: "atencao-2", complete: true }, "PATCH")).status, 401);
  assert.equal((await request("/student/activate", owner.cookie, { key: paid.key })).status, 401);
  await request("/student/logout", owner.cookie, {});
  const current = await request("/student/session", replacement); assert.equal(current.status, 200, "Old logout must not revoke new session");
  assert.deepEqual((await current.json() as { progress: unknown }).progress, { "atencao-1": true });
  assert.equal((await request("/content/course", replacement)).status, 200);
  await db.update(purchases).set({ financialHold: "chargeback" }).where(eq(purchases.id, paid.id));
  assert.equal((await request("/content/course", replacement)).status, 403, "Financial holds block account entitlements");
  await db.update(purchases).set({ financialHold: null }).where(eq(purchases.id, paid.id));
  const simultaneous = await Promise.all([request("/student/login", "", { email: owner.email, password }), request("/student/login", "", { email: owner.email, password })]);
  assert.ok(simultaneous.every(response => response.status === 200));
  const sessions = await Promise.all(simultaneous.map(response => request("/student/session", cookieOf(response))));
  assert.deepEqual(sessions.map(response => response.status).sort(), [200, 401], "Concurrent logins leave exactly one active session");
  const token = newStudentSecret();
  await db.update(accounts).set({ resetHash: hashStudentSecret(token), resetExpiresAt: new Date(Date.now() + 60_000) }).where(eq(accounts.userId, owner.id));
  const reset = { token: `${owner.id}.${token}`, password: "New-owned-password-456" };
  assert.equal((await request("/student/reset-password", "", reset)).status, 200);
  assert.equal((await request("/student/reset-password", "", reset)).status, 400, "Reset tokens are single use");
  const oldValidCookie = cookieOf(simultaneous[sessions[0]!.status === 200 ? 0 : 1]!);
  assert.equal((await request("/student/session", oldValidCookie)).status, 401, "Reset revokes existing sessions");
  assert.equal((await request("/student/login", "", { email: owner.email, password })).status, 401);
  const newLogin = await request("/student/login", "", { email: owner.email, password: reset.password }); assert.equal(newLogin.status, 200);
  const existingId = randomUUID(); ids.push(existingId);
  const existingEmail = `existing-${existingId}@example.invalid`;
  await db.insert(users).values({ id: existingId, name: "Existing NexOS user", email: existingEmail, passwordHash: await bcrypt.hash(password, 4) });
  const existingLogin = await request("/student/login", "", { email: existingEmail, password }); assert.equal(existingLogin.status, 200, "Existing users use their original credentials");
  const guide = await purchase("mini-guide");
  assert.equal((await request("/student/activate", cookieOf(existingLogin), { key: guide.key })).status, 200);
  assert.equal((await request("/content/mini-guide", cookieOf(existingLogin))).status, 200);
  assert.equal((await request("/content/course", cookieOf(existingLogin))).status, 403, "Mini-guide does not grant the course");
  const pdf = await request("/content/mini-guide.pdf", cookieOf(existingLogin)); assert.equal(pdf.status, 200); assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
  assert.equal((await request("/student/progress", cookieOf(newLogin), undefined, "DELETE")).status, 200);
  await db.update(accounts).set({ resetHash: hashStudentSecret(token), resetExpiresAt: new Date(Date.now() - 1000) }).where(eq(accounts.userId, owner.id));
  assert.equal((await request("/student/reset-password", "", reset)).status, 400, "Expired recovery links are rejected");
  assert.equal((await request("/student/reset-password", "", { ...reset, token: "-".repeat(36) + "." + token })).status, 400);
  assert.equal((await request("/student/register", "", { name: "Duplicate", email: existingEmail, password })).status, 409);
  console.log("PASS Academy accounts: signup, existing users, atomic key binding, product checks, raw-key rejection, progress, replacement sessions across content/PDF/tutor, stale logout, concurrent logins and single-use password reset");
} finally {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  if (purchaseIds.length) await db.delete(purchases).where(inArray(purchases.id, purchaseIds));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
  await pool.end();
}
