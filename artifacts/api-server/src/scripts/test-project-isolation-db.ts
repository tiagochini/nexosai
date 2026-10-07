import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, campaignsTable, plansTable, workspaceMemoryTable, contentPiecesTable } from "@workspace/db";
import memoryRouter from "../modules/memory/memory.routes.js";
import { getMemoryContext, saveApprovedToMemory, saveRejectionToMemory, savePerformanceInsight, processContentPieceApproval, getWorkspaceMemoryStats } from "../modules/memory/memory.service.js";
import { getCampaignMemory, patchCampaignMemory } from "../modules/agents/campaign-memory.service.js";
import { getCampaignBrain } from "../modules/campaign-brain/campaign-brain.service.js";
import { buildCampaignActionContext } from "../modules/agents/campaign-action-context.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod/v4";
import { getPresenceIntelligenceContext, getConfig, upsertConfig } from "../modules/social-presence/social-presence.service.js";
import { socialPresenceConfigTable } from "@workspace/db";
import pino from "pino";
import { runAgent } from "../modules/agents/agent.runner.js";
import { completeWithAgent } from "../modules/ai-gateway/ai-gateway.service.js";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";

await assertIsolationTestDatabase(pool);
const marker = randomUUID();
const users: string[] = [], workspaces: string[] = [];
let server: ReturnType<typeof express.application.listen> | undefined;

try {
  const [plan] = await db.select({ id: plansTable.id }).from(plansTable).limit(1);
  assert.ok(plan);
  for (let i = 0; i < 2; i++) {
    const [user] = await db.insert(usersTable).values({ name: "Isolation fixture", email: `isolation-${marker}-${i}@example.invalid`, passwordHash: "test-only-not-a-login-hash" }).returning();
    users.push(user!.id);
    const [workspace] = await db.insert(workspacesTable).values({ ownerId: user!.id, planId: plan.id, name: "Isolation fixture", slug: `isolation-${marker}-${i}` }).returning();
    workspaces.push(workspace!.id);
  }
  const [a, b, foreign] = await db.insert(campaignsTable).values([
    { workspaceId: workspaces[0]!, title: "PROJECT_A_ONLY", intakeData: { "product.name": "PRODUCT_A_ONLY" }, memoryData: { version: 1, operationStatus: "PROJECT_A_ONLY" }, brainData: { marker: "BRAIN_A_ONLY" } },
    { workspaceId: workspaces[0]!, title: "PROJECT_B_PRIVATE", intakeData: { "product.name": "PRODUCT_B_PRIVATE" }, memoryData: { version: 1, operationStatus: "PROJECT_B_PRIVATE" }, brainData: { marker: "BRAIN_B_PRIVATE" } },
    { workspaceId: workspaces[1]!, title: "OTHER_USER_PRIVATE", intakeData: { "product.name": "OTHER_USER_PRIVATE" }, memoryData: { version: 1, operationStatus: "OTHER_USER_PRIVATE" }, brainData: { marker: "OTHER_BRAIN_PRIVATE" } },
  ]).returning();
  assert.ok(a && b && foreign);
  await saveApprovedToMemory(workspaces[0]!, a.id, "copywriter", "A", "PROJECT_A_ONLY", {});
  await saveRejectionToMemory(workspaces[0]!, a.id, "copywriter", "A", "A_REJECTION_ONLY", "A");
  await savePerformanceInsight(workspaces[0]!, a.id, "A_INSIGHT_ONLY", 80);
  await saveApprovedToMemory(workspaces[0]!, b.id, "copywriter", "B", "PROJECT_B_PRIVATE", {});
  await saveApprovedToMemory(workspaces[1]!, foreign.id, "copywriter", "Other", "OTHER_USER_PRIVATE", {});
  await db.insert(workspaceMemoryTable).values([
    { workspaceId: workspaces[1]!, campaignId: foreign.id, agentRole: "copywriter", memoryType: "approved_copy", title: "PUBLIC_PRIVATE", summary: "PUBLIC_PRIVATE", isPublicReference: true },
    { workspaceId: workspaces[0]!, agentRole: "copywriter", memoryType: "approved_copy", title: "UNLINKED_PRIVATE", summary: "UNLINKED_PRIVATE" },
  ]);
  const ctx = JSON.stringify(await getMemoryContext(workspaces[0]!, "copywriter", a.id));
  assert.match(ctx, /PROJECT_A_ONLY/); assert.match(ctx, /A_REJECTION_ONLY/); assert.match(ctx, /A_INSIGHT_ONLY/);
  assert.doesNotMatch(ctx, /PROJECT_B_PRIVATE|OTHER_USER_PRIVATE|PUBLIC_PRIVATE|UNLINKED_PRIVATE/);
  assert.equal((await getWorkspaceMemoryStats(workspaces[0]!, a.id)).total, 3);
  await assert.rejects(getMemoryContext(workspaces[0]!, "copywriter", foreign.id), /not found/);
  await assert.rejects(savePerformanceInsight(workspaces[0]!, foreign.id, "injection attempt", 99), /not found/);
  assert.equal(await getCampaignBrain(foreign.id, workspaces[0]!), null);
  assert.equal(await getCampaignMemory(foreign.id, workspaces[0]!), null);
  await patchCampaignMemory(foreign.id, workspaces[0]!, { operationStatus: "overwritten" });
  assert.equal((await getCampaignMemory(foreign.id, workspaces[1]!))?.operationStatus, "OTHER_USER_PRIVATE");
  const canonical = await buildCampaignActionContext(a.id, workspaces[0]!, "copywriter");
  assert.match(canonical.block, /PRODUCT_A_ONLY/);
  assert.doesNotMatch(canonical.block, /PROJECT_B_PRIVATE|OTHER_USER_PRIVATE/);
  await assert.rejects(buildCampaignActionContext(foreign.id, workspaces[0]!, "copywriter"), /not found/);
  const log = pino({ level: "silent" });
  await assert.rejects(runAgent({ campaignId: foreign.id, workspaceId: workspaces[0]!, agentRole: "copywriter", systemPrompt: "fixture", messages: [], log }), /not found/);
  await assert.rejects(completeWithAgent("copywriter", "fixture", [], workspaces[0]!, log, foreign.id), /not found/);
  const [piece] = await db.insert(contentPiecesTable).values({ workspaceId: workspaces[1]!, campaignId: foreign.id, type: "sales_page", title: "OTHER_USER_PRIVATE", content: { text: "OTHER_USER_PRIVATE" } }).returning();
  await processContentPieceApproval(workspaces[0]!, a.id, piece!.id, "copywriter", true);
  assert.equal((await getWorkspaceMemoryStats(workspaces[0]!, a.id)).total, 3, "Foreign content cannot be copied into an owned project");
  await assert.rejects(db.insert(workspaceMemoryTable).values({ workspaceId: workspaces[0]!, campaignId: foreign.id, agentRole: "copywriter", memoryType: "approved_copy", title: "invalid", summary: "invalid" }));
  const [ownMemory] = await db.select().from(workspaceMemoryTable).where(and(eq(workspaceMemoryTable.workspaceId, workspaces[0]!), eq(workspaceMemoryTable.campaignId, a.id))).limit(1);
  await assert.rejects(db.update(workspaceMemoryTable).set({ campaignId: b.id }).where(eq(workspaceMemoryTable.id, ownMemory!.id)));

  assert.equal((await getPresenceIntelligenceContext(workspaces[0]!)).campaign, null, "No automatic latest-project selection");
  await assert.rejects(upsertConfig(workspaces[0]!, { alignedCampaignId: foreign.id }), /not found/);
  await upsertConfig(workspaces[0]!, { alignedCampaignId: b.id });
  assert.equal((await getPresenceIntelligenceContext(workspaces[0]!, a.id)).campaign?.id, a.id);
  assert.equal((await getPresenceIntelligenceContext(workspaces[0]!, null)).campaign, null, "Standalone context cannot inherit the configured project");
  await db.update(socialPresenceConfigTable).set({ weeklyInsight: { campaignId: a.id, weekStart: "2026-10-05", summary: "PROJECT_A_ONLY", wins: [], losses: [], adjustments: [], winningFormats: [], generatedAt: new Date().toISOString() } }).where(eq(socialPresenceConfigTable.workspaceId, workspaces[0]!));
  assert.equal((await getConfig(workspaces[0]!))?.weeklyInsight, null, "A previous project's insight cannot appear in the selected project");

  const repair = await readFile(new URL("../../../../lib/db/drizzle/0069_project_memory_isolation.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE workspace_memory DROP CONSTRAINT workspace_memory_project_scope_fk");
    await client.query("DROP TRIGGER workspace_memory_scope_immutable ON workspace_memory");
    const legacy = await client.query("INSERT INTO workspace_memory (workspace_id, campaign_id, agent_role, memory_type, title, summary) VALUES ($1,$2,'copywriter','approved_copy','legacy-preserved','legacy-private') RETURNING id", [workspaces[0]!, foreign.id]);
    await client.query(repair);
    await client.query(repair);
    const repaired = await client.query("SELECT campaign_id, title, summary FROM workspace_memory WHERE id = $1", [legacy.rows[0].id]);
    assert.deepEqual(repaired.rows[0], { campaign_id: null, title: "legacy-preserved", summary: "legacy-private" });
  } finally { await client.query("ROLLBACK"); client.release(); }

  const app = express(); app.use(express.json()); app.use("/memory", memoryRouter);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
    if (err instanceof ZodError) { res.status(400).json({ error: "Invalid request" }); return; }
    res.status(500).json({ error: "Unexpected failure" });
  });
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server!.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/memory`;
  const token = signAccess({ userId: users[0]!, workspaceId: workspaces[0]!, email: "fixture@example.invalid" });
  const request = (suffix: string, method = "GET", body?: unknown, authorization = token) => fetch(base + suffix, { method, headers: { authorization: `Bearer ${authorization}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const suffix of ["", "/stats", "/context/copywriter"]) {
    assert.equal((await request(suffix)).status, 400, "No workspace-wide memory fallback");
    const response = await request(`${suffix}?campaignId=${foreign.id}`); assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /OTHER_USER_PRIVATE/);
  }
  const contexts = await Promise.all([a.id, b.id].map(async id => { const r = await request(`/context/copywriter?campaignId=${id}`); assert.equal(r.status, 200); return r.text(); }));
  assert.match(contexts[0]!, /PROJECT_A_ONLY/); assert.doesNotMatch(contexts[0]!, /PROJECT_B_PRIVATE/);
  assert.match(contexts[1]!, /PROJECT_B_PRIVATE/); assert.doesNotMatch(contexts[1]!, /PROJECT_A_ONLY/);
  assert.equal((await request(`/stats?campaignId=${a.id}`, "GET", undefined, signAccess({ userId: users[1]!, workspaceId: workspaces[0]!, email: "fixture@example.invalid" }))).status, 401, "A signed token cannot grant another user's workspace");
  assert.equal((await request("/insight", "POST", { campaignId: foreign.id, insight: "cross-user write", score: 90 })).status, 404);
  assert.equal((await request(`/${ownMemory!.id}?campaignId=${b.id}`, "DELETE")).status, 404, "A memory ID cannot select a different project");
  await db.update(workspacesTable).set({ ownerId: users[1]! }).where(eq(workspacesTable.id, workspaces[0]!));
  assert.equal((await request(`/stats?campaignId=${a.id}`)).status, 401, "Ownership is checked again after token issuance");
  console.log("PASS project isolation: HTTP ownership, memory read/write/delete, canonical context, legacy exclusion, foreign content capture, FK and immutable scope; no provider calls");
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  if (workspaces.length) await db.delete(workspacesTable).where(inArray(workspacesTable.id, workspaces));
  if (users.length) await db.delete(usersTable).where(inArray(usersTable.id, users));
  await pool.end();
}
