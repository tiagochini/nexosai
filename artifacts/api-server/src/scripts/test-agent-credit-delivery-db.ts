import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import pino from "pino";
import { db, pool, usersTable, workspacesTable, plansTable, campaignsTable, campaignAgentsTable, creditTransactionsTable, subscriptionPaymentsTable, approvalCheckpointsTable } from "@workspace/db";
import { env } from "../lib/env.js";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
await assertIsolationTestDatabase(pool);
Object.assign(env, { ANTHROPIC_API_KEY: "offline-agent-credit-fixture", OPENAI_API_KEY: undefined, GEMINI_API_KEY: undefined,
  AI_INTEGRATIONS_ANTHROPIC_API_KEY: undefined, AI_INTEGRATIONS_OPENAI_API_KEY: undefined, AI_INTEGRATIONS_GEMINI_API_KEY: undefined });
const { runAgent } = await import("../modules/agents/agent.runner.js");
const log = pino({ level: "silent" }), marker = randomUUID();
let userId: string | undefined, wsId = "", campaignId = "", calls = 0;
let onResponse: (() => Promise<void>) | undefined;
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  assert.ok(url.startsWith("https://api.anthropic.com/"), "No real provider calls"); calls++;
  if (onResponse) await onResponse();
  return new Response(JSON.stringify({ id: "msg_fixture", type: "message", role: "assistant", model: "claude-opus-4-5",
    content: [{ type: "text", text: "Persisted fixture delivery" }], stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 1000 } }), { status: 200, headers: { "Content-Type": "application/json" } });
};
const hasCause = (message: string) => (error: unknown): boolean => {
  let current = error as { message?: string; cause?: unknown } | undefined;
  while (current) { if (current.message?.includes(message)) return true; current = current.cause as typeof current; }
  return false;
};
const balance = async () => (await db.select().from(workspacesTable).where(eq(workspacesTable.id, wsId)))[0]!.creditsBalance;
const entries = async () => db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, wsId));
const run = (key: string, approval = false) => runAgent({ campaignId, workspaceId: wsId, agentRole: "analytics", systemPrompt: "fixture",
  messages: [{ role: "user", content: "fixture" }], skipAllStaticLayers: true, log, idempotencyKeyOverride: marker + key,
  requiresApproval: approval, checkpointType: approval ? "execution_approval" : undefined });
try {
  const [plan] = await db.select().from(plansTable).limit(1); assert.ok(plan);
  const [user] = await db.insert(usersTable).values({ name: "Delivery fixture", email: `agent-credit-${marker}@example.invalid`, passwordHash: "inert" }).returning(); userId = user!.id;
  const [ws] = await db.insert(workspacesTable).values({ ownerId: userId, planId: plan.id, name: "Delivery fixture", slug: marker, creditsBalance: 100000 }).returning(); wsId = ws!.id;
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId: wsId, title: "Delivery fixture", intakeData: { "product.name": "fixture" } }).returning(); campaignId = campaign!.id;
  const first = await run("success", true); const charged = first.creditsCharged; assert.ok(charged > 0);
  assert.equal(await balance(), 100000 - charged); assert.equal((await entries()).length, 1);
  assert.equal(first.content, "Persisted fixture delivery"); assert.ok(first.checkpointId);
  const checkpoints = await db.select().from(approvalCheckpointsTable).where(eq(approvalCheckpointsTable.campaignId, campaignId)); assert.equal(checkpoints.length, 1);
  const replayCalls = calls;
  const repeat = await run("success", true); assert.equal(repeat.creditsCharged, 0); assert.equal(repeat.agentRecord!.id, first.agentRecord!.id);
  assert.equal(repeat.checkpointId, first.checkpointId); assert.equal(calls, replayCalls); assert.equal((await entries()).length, 1);
  console.log("PASS real mocked-provider generation: debit, full result and approval persisted; replay returns saved result without provider or debit");

  const start = await balance();
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => run("concurrent")));
  assert.ok(concurrent.every(r => r.content === first.content));
  assert.equal(concurrent.reduce((sum, r) => sum + r.creditsCharged, 0), charged);
  assert.equal(await balance(), start - charged); assert.equal((await entries()).length, 2);
  console.log("PASS concurrent same-operation generations settle one debit without overwriting the balance");

  // PostgreSQL fault AFTER the debit INSERT, inside the result persistence transaction.
  await pool.query(`CREATE FUNCTION test_agent_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.status IN ('completed','waiting_approval') AND NEW.input->>'creditOperationKey' = '${marker}rollback' THEN RAISE EXCEPTION 'fixture delivery save failed'; END IF;
    RETURN NEW; END $$; CREATE TRIGGER test_agent_delivery_failure BEFORE UPDATE ON campaign_agents FOR EACH ROW EXECUTE FUNCTION test_agent_delivery_failure()`);
  const beforeFailure = await balance(), countFailure = (await entries()).length;
  await assert.rejects(run("rollback"), hasCause("fixture delivery save failed"));
  assert.equal(await balance(), beforeFailure); assert.equal((await entries()).length, countFailure);
  const failed = await db.select().from(campaignAgentsTable).where(and(eq(campaignAgentsTable.campaignId, campaignId), eq(campaignAgentsTable.status, "failed"))); assert.ok(failed.length);
  await pool.query("DROP TRIGGER test_agent_delivery_failure ON campaign_agents; DROP FUNCTION test_agent_delivery_failure()");
  const rollbackCalls = calls;
  const recovered = await run("rollback"); assert.equal(recovered.creditsCharged, charged); assert.equal(calls, rollbackCalls);
  assert.equal(await balance(), beforeFailure - charged); assert.equal((await entries()).length, countFailure + 1);
  const recoveredCalls = calls; await run("rollback"); assert.equal(calls, recoveredCalls);
  console.log("PASS injected save failure rolls back debit and campaign cost; corrected retry charges once, subsequent retry recovers output");

  // Failure AFTER commit must preserve the delivery, not turn it into failed or charge again.
  await pool.query(`CREATE FUNCTION test_agent_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.execution_status = 'completed' THEN RAISE EXCEPTION 'fixture post-delivery failed'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_agent_audit_failure BEFORE UPDATE ON agent_execution_logs FOR EACH ROW EXECUTE FUNCTION test_agent_audit_failure()`);
  const prior = await balance(); await assert.rejects(run("postcommit"), hasCause("fixture post-delivery failed"));
  assert.equal(await balance(), prior - charged);
  const callsAfterCommit = calls; const saved = await run("postcommit"); assert.equal(saved.content, first.content); assert.equal(saved.creditsCharged, 0); assert.equal(calls, callsAfterCommit);
  assert.equal(saved.agentRecord!.status, "completed");
  await pool.query("DROP TRIGGER test_agent_audit_failure ON agent_execution_logs; DROP FUNCTION test_agent_audit_failure()");
  console.log("PASS post-commit failure preserves completed full delivery; retry invokes no provider and no debit");

  await db.update(workspacesTable).set({ creditsBalance: 0 }).where(eq(workspacesTable.id, wsId));
  const blockedCalls = calls; await assert.rejects(run("empty"), /Créditos insuficientes/); assert.equal(calls, blockedCalls);
  await db.update(workspacesTable).set({ settings: { unlimitedCredits: true } }).where(eq(workspacesTable.id, wsId));
  const exempt = await run("exempt"); assert.equal(exempt.creditsCharged, 0); assert.equal(await balance(), 0);
  const exemptRow = (await entries()).find(e => e.idempotencyKey === marker + "exempt")!; assert.ok(exemptRow.description?.startsWith("[∞]")); assert.equal(exemptRow.amount, charged);
  assert.equal(exempt.agentRecord!.creditsUsed, 0);
  await db.update(workspacesTable).set({ creditsBalance: -1 }).where(eq(workspacesTable.id, wsId));
  const debtCalls = calls; await assert.rejects(run("debt"), /Créditos insuficientes/); assert.equal(calls, debtCalls);
  await db.update(workspacesTable).set({ creditsBalance: 1000 }).where(eq(workspacesTable.id, wsId));
  const [hold] = await db.insert(subscriptionPaymentsTable).values({ workspaceId: wsId, userId: userId!, planId: plan.id, amountCents: 100, method: "pix", metadata: { refundHold: true } }).returning();
  const holdCalls = calls; await assert.rejects(run("held"), /Créditos bloqueados/); assert.equal(calls, holdCalls);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.id, hold!.id));
  console.log("PASS preflight: zero balance blocks paid inference, unlimited is exempt, negative debt and refund hold block even unlimited");

  await db.update(workspacesTable).set({ settings: {} }).where(eq(workspacesTable.id, wsId));
  onResponse = async () => { await db.update(workspacesTable).set({ creditsBalance: 1 }).where(eq(workspacesTable.id, wsId)); };
  const beforeRace = (await entries()).length; await assert.rejects(run("spent-in-flight"), /Créditos insuficientes/);
  onResponse = undefined; assert.equal(await balance(), 1); assert.equal((await entries()).length, beforeRace);
  const pendingCalls = calls;
  await db.update(workspacesTable).set({ creditsBalance: 100000 }).where(eq(workspacesTable.id, wsId));
  const pendingRecovery = await run("spent-in-flight"); assert.equal(calls, pendingCalls); assert.equal(pendingRecovery.creditsCharged, charged);
  console.log("PASS balance spent during inference preserves full pending result without debit; retry settles once without provider");

  let inFlightHold: string | undefined;
  onResponse = async () => {
    const [payment] = await db.insert(subscriptionPaymentsTable).values({ workspaceId: wsId, userId: userId!, planId: plan.id, amountCents: 100, method: "pix", metadata: { refundHold: true } }).returning();
    inFlightHold = payment!.id;
  };
  const holdEntryCount = (await entries()).length;
  await assert.rejects(run("hold-in-flight"), /Créditos bloqueados/);
  onResponse = undefined; assert.equal((await entries()).length, holdEntryCount);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.id, inFlightHold!));
  const holdRecoveryCalls = calls; await run("hold-in-flight"); assert.equal(calls, holdRecoveryCalls);
  console.log("PASS refund hold acquired during inference prevents settlement and preserves result for recovery after release");
  await db.update(workspacesTable).set({ creditsBalance: 100000, settings: {} }).where(eq(workspacesTable.id, wsId));
  const { runAgentWithCritique } = await import("../modules/agents/critique.runner.js");
  const { withRegenContext } = await import("../modules/agents/regen-context.js");
  const critique = (key: string) => withRegenContext(marker + key, () => runAgentWithCritique({
    workspaceId: wsId, campaignId, agentRole: "analytics", systemPrompt: "fixture", userMessage: "fixture", log,
  }));
  const critiqueStart = await balance(), critiqueCalls = calls;
  const reviewed = await critique("review"); assert.ok(reviewed.totalCreditsCharged > 0);
  assert.equal(calls, critiqueCalls + 3); assert.equal(await balance(), critiqueStart - reviewed.totalCreditsCharged);
  const reviewReplay = await critique("review"); assert.equal(reviewReplay.totalCreditsCharged, 0); assert.equal(calls, critiqueCalls + 3);
  assert.equal(reviewReplay.refinedOutput, reviewed.refinedOutput);
  await assert.rejects(runAgentWithCritique({ workspaceId: randomUUID(), campaignId, agentRole: "analytics", systemPrompt: "fixture", userMessage: "fixture", log }), /not found/);
  console.log("PASS three-turn critique uses shared debit and durable full result; same-operation replay has no calls or debit");
  await pool.query(`CREATE FUNCTION test_critique_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.status = 'completed' AND NEW.input->>'creditOperationKey' = 'critique:${marker}review-rollback' THEN RAISE EXCEPTION 'fixture critique save failed'; END IF;
    RETURN NEW; END $$; CREATE TRIGGER test_critique_delivery_failure BEFORE INSERT ON campaign_agents FOR EACH ROW EXECUTE FUNCTION test_critique_delivery_failure()`);
  const reviewBalance = await balance(), reviewCount = (await entries()).length;
  await assert.rejects(critique("review-rollback"), hasCause("fixture critique save failed"));
  assert.equal(await balance(), reviewBalance); assert.equal((await entries()).length, reviewCount);
  await pool.query("DROP TRIGGER test_critique_delivery_failure ON campaign_agents; DROP FUNCTION test_critique_delivery_failure()");
  const recoveryCalls = calls;
  const recoveredReview = await critique("review-rollback"); assert.ok(recoveredReview.totalCreditsCharged > 0); assert.equal(calls, recoveryCalls);
  assert.equal(await balance(), reviewBalance - recoveredReview.totalCreditsCharged);
  const fixedCalls = calls; await critique("review-rollback"); assert.equal(calls, fixedCalls);
  console.log("PASS critique delivery failure rolls back debit; retry settles once and subsequent replay is free");
  await db.update(workspacesTable).set({ creditsBalance: 0, settings: { unlimitedCredits: true } }).where(eq(workspacesTable.id, wsId));
  assert.equal((await critique("review-exempt")).totalCreditsCharged, 0); assert.equal(await balance(), 0);
  await db.update(workspacesTable).set({ settings: {} }).where(eq(workspacesTable.id, wsId));
  const noFundsCalls = calls; await assert.rejects(critique("review-empty"), /Créditos insuficientes/); assert.equal(calls, noFundsCalls);
  console.log("PASS critique honors unlimited exemption and prevents provider calls without balance");

} finally {
  globalThis.fetch = originalFetch;
  await pool.query("DROP TRIGGER IF EXISTS test_critique_delivery_failure ON campaign_agents; DROP FUNCTION IF EXISTS test_critique_delivery_failure(); DROP TRIGGER IF EXISTS test_agent_delivery_failure ON campaign_agents; DROP FUNCTION IF EXISTS test_agent_delivery_failure(); DROP TRIGGER IF EXISTS test_agent_audit_failure ON agent_execution_logs; DROP FUNCTION IF EXISTS test_agent_audit_failure()");
  if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
}
