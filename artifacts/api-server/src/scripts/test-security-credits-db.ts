import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, campaignsTable, creditTransactionsTable, campaignAgentsTable } from "@workspace/db";
import { deductCredits, getBalance } from "../modules/credits/credits.service.js";
import creditsRouter from "../modules/credits/credits.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { runAgent } from "../modules/agents/agent.runner.js";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
import pino from "pino";

await assertIsolationTestDatabase(pool);
const marker = randomUUID(), users: string[] = [], workspaces: string[] = [];
const log = pino({ level: "silent" });
let server: ReturnType<typeof express.application.listen> | undefined;
try {
  const [plan] = await db.select().from(plansTable).limit(1); assert.ok(plan);
  for (let i = 0; i < 2; i++) {
    const [user] = await db.insert(usersTable).values({ name: "Security fixture", email: `security-credit-${marker}-${i}@example.invalid`, passwordHash: "not-a-login-hash" }).returning();
    users.push(user!.id);
    const [ws] = await db.insert(workspacesTable).values({ ownerId: user!.id, planId: plan.id, name: "Security fixture", slug: `security-credit-${marker}-${i}`, creditsBalance: 100 }).returning();
    workspaces.push(ws!.id);
  }
  const [a, b, foreign] = await db.insert(campaignsTable).values([
    { workspaceId: workspaces[0]!, title: "A" }, { workspaceId: workspaces[0]!, title: "B" }, { workspaceId: workspaces[1]!, title: "Foreign" },
  ]).returning(); assert.ok(a && b && foreign);
  const key = `security-credit:${marker}`;
  const debits = await Promise.all(Array.from({ length: 16 }, () => deductCredits(workspaces[0]!, "copy_generation", log, a.id, undefined, undefined, undefined, key)));
  assert.equal(new Set(debits.map(d => d.id)).size, 1);
  const balance = await getBalance(workspaces[0]!);
  const charged = debits[0]!;
  assert.equal(balance, 100 - charged.amount);
  await assert.rejects(deductCredits(workspaces[1]!, "copy_generation", log, foreign.id, undefined, undefined, undefined, key), /idempotency conflict/i);
  await assert.rejects(deductCredits(workspaces[0]!, "copy_generation", log, b.id, undefined, undefined, undefined, key), /idempotency conflict/i);
  await assert.rejects(deductCredits(workspaces[0]!, "strategy_generation", log, a.id, undefined, undefined, undefined, key), /idempotency conflict/i);
  await assert.rejects(deductCredits(workspaces[0]!, "copy_generation", log, foreign.id), /not found/i);
  assert.equal(await getBalance(workspaces[1]!), 100);
  assert.equal(await getBalance(workspaces[0]!), balance);
  const [untouched] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, foreign.id));
  assert.equal(untouched!.creditsCost, 0);
  console.log("PASS: 16 repeated charges debit once; cross-account/project/action keys and foreign campaign charge rejected without mutation");

  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.log = log; next(); }); app.use("/credits", creditsRouter);
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server!.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/credits`;
  const token = (i: number, ws = workspaces[i]!) => signAccess({ userId: users[i]!, workspaceId: ws, email: "fixture@example.invalid" });
  const request = (suffix: string, authorization?: string, method = "GET") => fetch(base + suffix, { method, headers: authorization ? { authorization: `Bearer ${authorization}`, "content-type": "application/json" } : {} });
  assert.equal((await request("/balance")).status, 401);
  assert.equal((await request("/balance", token(1, workspaces[0]!))).status, 401);
  for (const suffix of ["/balance", "/history", "/usage"]) {
    const response = await request(suffix + `?workspaceId=${workspaces[1]}`, token(0)); assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), new RegExp(workspaces[1]!));
  }
  const history = await request("/history", token(1)); assert.deepEqual((await history.json() as { transactions: unknown[] }).transactions, []);
  assert.equal((await request("/admin-topup", token(0), "POST")).status, 403);
  assert.equal(await getBalance(workspaces[0]!), balance);
  console.log("PASS: real HTTP credit routes reject unauthenticated/foreign sessions, ignore foreign workspace selectors, forbid customer free topup");

  const before = await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, workspaces[0]!));
  await assert.rejects(runAgent({ campaignId: b.id, workspaceId: workspaces[0]!, agentRole: "analytics", systemPrompt: "fixture", messages: [{ role: "user", content: "fixture" }], log }), /provider|credentials|completion/i);
  const [agent] = await db.select().from(campaignAgentsTable).where(eq(campaignAgentsTable.campaignId, b.id));
  assert.equal(agent!.status, "failed");
  assert.equal(await getBalance(workspaces[0]!), balance);
  const after = await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, workspaces[0]!)); assert.deepEqual(after, before);
  console.log("PASS: real agent failure with no provider leaves balance and ledger unchanged, persists failed status");
  await db.update(workspacesTable).set({ creditsBalance: 0 }).where(eq(workspacesTable.id, workspaces[0]!));
  await assert.rejects(deductCredits(workspaces[0]!, "copy_generation", log));
  assert.equal(await getBalance(workspaces[0]!), 0);
  assert.equal((await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, workspaces[0]!))).length, before.length);
  console.log("PASS: insufficient-credit fixed-cost charge creates no debit and no lost balance");
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  try { if (users.length) await db.delete(usersTable).where(inArray(usersTable.id, users)); } finally { await pool.end(); }
}
