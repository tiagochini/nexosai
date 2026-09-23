import { and, desc, eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import {
  db, realizationContractsTable, realizationAttemptsTable, realizationEventsTable, executionEvidenceTable,
  campaignsTable, masterplanVersionsTable, paidMediaProposalsTable, paidMediaLaunchPlansTable,
} from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import {
  ensureConditionalIntentForProposal, preflightConditionalExecution, executeConditionalIntent,
  getConditionalIntentAttempt,
} from "../paid-media/conditional-execution.service.js";
import { assertApprovedLaunchPlan, activateLaunchPlan, compensateLaunchPlan } from "../paid-media/launch-plans.service.js";
import { paidMediaLaunchAttemptsTable, paidMediaLaunchStepsTable } from "@workspace/db";

export interface RealizationFamilyAdapter {
  preflight(ctx: { workspaceId: string; binding: any }): Promise<{ eligible: boolean; blockers?: unknown[] }>;
  executeOrReconcile(ctx: { workspaceId: string; binding: any; readbackOnly: boolean }): Promise<{ receipt?: unknown; readback?: unknown; retryable?: boolean; ambiguous?: boolean }>;
  qc(ctx: { workspaceId: string; binding: any; readback: unknown }): Promise<{ passed: boolean; report: unknown }>;
  monitor(ctx: { workspaceId: string; binding: any; readback?: unknown }): Promise<{ state: "monitored" | "recovery"; evidence?: unknown }>;
  compensate(ctx: { workspaceId: string; binding: any }): Promise<{ compensated: boolean; evidence?: unknown }>;
}
const testAdapters = new Map<string, RealizationFamilyAdapter>();
export function setRealizationTestAdapter(family: "paid_media_pause" | "paid_media_launch", adapter?: RealizationFamilyAdapter) { adapter ? testAdapters.set(family, adapter) : testAdapters.delete(family); }
const transitions: Record<string, string[]> = {
  proposal: ["planned"], planned: ["approval_binding"], approval_binding: ["preflight", "blocked"],
  preflight: ["attempted", "blocked"], blocked: ["preflight", "retryable"], attempted: ["provider_confirmed", "retryable", "failed", "recovery", "exception"],
  provider_confirmed: ["artifact_qc"], artifact_qc: ["monitored", "exception"], monitored: ["recovery", "exception"],
  retryable: ["preflight"], recovery: ["compensated", "exception"], failed: ["recovery"], compensated: [], exception: [],
};
const stable = (v: unknown): string => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x);
const hash = (v: unknown) => createHash("sha256").update(stable(v)).digest("hex");
const sanitize = (v: unknown, depth = 0): unknown => {
  if (depth > 7) return "[REDACTED_DEPTH_LIMIT]";
  if (Array.isArray(v)) return v.slice(0, 50).map(x => sanitize(x, depth + 1));
  if (!v || typeof v !== "object") return typeof v === "string" ? v.slice(0, 2048) : v;
  const sensitive = /^(?:access[_-]?token|refresh[_-]?token|token|secret|authorization|password|cookie|api[_-]?key|private[_-]?key|client[_-]?secret)$/i;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 100).map(([k, x]) => [k, sensitive.test(k) ? "[REDACTED]" : sanitize(x, depth + 1)]));
};
const adapterFor = (family: string): RealizationFamilyAdapter => testAdapters.get(family) ?? productionAdapters[family]!;

const productionAdapters: Record<string, RealizationFamilyAdapter> = {
  paid_media_pause: {
    preflight: async ({ workspaceId, binding }) => {
      const resolved = await ensureConditionalIntentForProposal(workspaceId, binding.subjectId);
      binding.intentId = resolved.intent.id; binding.policyId = resolved.policy.id; binding.actionId = resolved.action.id;
      const result = await preflightConditionalExecution(workspaceId, resolved.policy.id, resolved.action.id, binding.subjectId);
      return { eligible: result.eligible, blockers: result.eligible ? [] : [result.code] };
    },
    executeOrReconcile: async ({ workspaceId, binding, readbackOnly }) => {
      const resolved = await ensureConditionalIntentForProposal(workspaceId, binding.subjectId);
      binding.intentId = resolved.intent.id;
      if (!readbackOnly) await executeConditionalIntent(workspaceId, resolved.intent.id);
      const attempt = await getConditionalIntentAttempt(workspaceId, resolved.intent.id);
      return { receipt: attempt?.providerReceipt, readback: attempt?.readback, ambiguous: attempt?.status === "ambiguous", retryable: attempt?.status === "recovery_required" || (!readbackOnly && attempt?.status === "attempted") };
    },
    qc: async ({ readback }) => ({ passed: Boolean(readback && typeof readback === "object"), report: { source: "conditional_execution", readback: sanitize(readback) } }),
    monitor: async ({ readback }) => ({ state: readback ? "monitored" : "recovery", evidence: { readback: sanitize(readback) } }),
    compensate: async () => ({ compensated: false, evidence: { reason: "paid_media_pause_compensation_unsupported" } }),
  },
  paid_media_launch: {
    preflight: async ({ workspaceId, binding }) => { await assertApprovedLaunchPlan(workspaceId, binding.subjectId); return { eligible: true, blockers: [] }; },
    executeOrReconcile: async ({ workspaceId, binding, readbackOnly }) => {
      if (!readbackOnly) await activateLaunchPlan(workspaceId, binding.subjectId);
      const [attempt] = await db.select().from(paidMediaLaunchAttemptsTable).where(and(eq(paidMediaLaunchAttemptsTable.workspaceId, workspaceId), eq(paidMediaLaunchAttemptsTable.launchPlanId, binding.subjectId))).orderBy(desc(paidMediaLaunchAttemptsTable.createdAt)).limit(1);
      const steps = attempt ? await db.select().from(paidMediaLaunchStepsTable).where(eq(paidMediaLaunchStepsTable.attemptId, attempt.id)) : [];
      const valid = Boolean(attempt?.status === "succeeded" && steps.length > 0 && steps.every(s => s.status === "verified" && s.providerResponse && s.readback));
      return { receipt: valid ? steps.map(s => s.providerResponse) : undefined, readback: valid ? steps.map(s => s.readback) : undefined, ambiguous: !valid };
    },
    qc: async ({ readback }) => ({ passed: Array.isArray(readback) && readback.length > 0, report: { source: "launch_steps", steps: sanitize(readback) } }),
    monitor: async ({ readback }) => ({ state: readback ? "monitored" : "recovery", evidence: { steps: sanitize(readback) } }),
    compensate: async ({ workspaceId, binding }) => compensateLaunchPlan(workspaceId, binding.subjectId),
  },
};

export async function createRealizationContract(workspaceId: string, userId: string, input: any) {
  if (!["paid_media_pause", "paid_media_launch"].includes(input.action) || !input.idempotencyKey) throw new AppError(400, "Action and idempotencyKey are required.", "VALIDATION_ERROR");
  const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, input.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  const [plan] = await db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.id, input.masterplanVersionId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, input.campaignId), eq(masterplanVersionsTable.status, "approved"))).limit(1);
  if (!campaign || !plan || input.contextFingerprint !== plan.contextFingerprint || input.snapshotHash !== plan.contentHash) throw new AppError(409, "Approved masterplan binding is stale or invalid.", "STALE_BINDING");
  const subjectTable = input.action === "paid_media_pause" ? paidMediaProposalsTable : paidMediaLaunchPlansTable;
  const [subject] = await db.select().from(subjectTable).where(and(eq(subjectTable.id, input.subjectId), eq(subjectTable.workspaceId, workspaceId), eq(subjectTable.campaignId, input.campaignId))).limit(1);
  if (!subject || (input.action === "paid_media_pause" && (subject as any).status !== "approved") || (input.action === "paid_media_launch" && (subject as any).launchStage !== "approved")) throw new AppError(409, "Subject binding is stale or not approved.", "STALE_BINDING");
  const canonicalTarget = input.action === "paid_media_pause"
    ? {
        provider: (subject as any).provider,
        accountId: (subject as any).accountId,
        entityId: (subject as any).entityId,
        actionType: (subject as any).actionType,
        requestedChange: (subject as any).requestedChange,
      }
    : {
        provider: (subject as any).provider,
        accountId: (subject as any).accountId,
        planHash: (subject as any).planHash,
        providerPayload: (subject as any).providerPayload,
      };
  if (input.target !== undefined && hash(input.target) !== hash(canonicalTarget)) {
    throw new AppError(409, "Realization target does not match the approved subject.", "STALE_BINDING");
  }
  const normalizedInput = {
    campaignId: input.campaignId,
    masterplanVersionId: input.masterplanVersionId,
    subjectId: input.subjectId,
    contextFingerprint: input.contextFingerprint,
    snapshotHash: input.snapshotHash,
    action: input.action,
    idempotencyKey: input.idempotencyKey,
    maxAttempts: input.maxAttempts ?? 3,
    target: canonicalTarget,
  };
  const binding = { action: input.action, campaignId: input.campaignId, masterplanVersionId: input.masterplanVersionId, subjectId: input.subjectId, target: canonicalTarget, contextFingerprint: input.contextFingerprint, snapshotHash: input.snapshotHash };
  const fingerprint = hash(normalizedInput), bindingHash = hash(binding);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`realization:${workspaceId}:${input.campaignId}`},0))`);
    const [old] = await tx.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (old) { if (old.requestFingerprint !== fingerprint) throw new AppError(409, "Idempotency key conflict.", "IDEMPOTENCY_CONFLICT"); return old; }
    const [created] = await tx.insert(realizationContractsTable).values({ workspaceId, campaignId: input.campaignId, masterplanVersionId: input.masterplanVersionId, action: input.action, idempotencyKey: input.idempotencyKey, bindingHash, requestFingerprint: fingerprint, contextFingerprint: input.contextFingerprint, snapshotHash: input.snapshotHash, subjectType: input.action === "paid_media_pause" ? "paid_media_proposal" : "paid_media_launch_plan", subjectId: input.subjectId, binding, maxAttempts: input.maxAttempts ?? 3, createdByUserId: userId, state: "approval_binding" }).returning();
    await tx.insert(realizationEventsTable).values([{ workspaceId, contractId: created!.id, type: "created", details: { fingerprint } }, { workspaceId, contractId: created!.id, type: "state_changed", details: { from: "proposal", to: "planned" } }, { workspaceId, contractId: created!.id, type: "state_changed", details: { from: "planned", to: "approval_binding" } }]);
     await evidence(tx, created, "planned", { source: "contract_creation" });
     await evidence(tx, created, "planned", { source: "approval_binding" });
    return created;
  });
}
async function load(workspaceId: string, id: string) { const [row] = await db.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.id, id))).limit(1); if (!row) throw new AppError(404, "Realization contract not found.", "NOT_FOUND"); return row; }
async function evidence(tx: any, row: any, state: string, details: unknown, contextFingerprint = row.contextFingerprint) {
  const evidenceState = state === "preflight" ? "planned" : state === "blocked" ? "exception" : state;
  await tx.insert(executionEvidenceTable).values({ workspaceId: row.workspaceId, campaignId: row.campaignId, masterplanVersionId: row.masterplanVersionId, contextFingerprint, subjectType: row.subjectType, subjectId: row.subjectId, state: evidenceState as any, details: sanitize(details) });
}
async function transition(workspaceId: string, id: string, to: string, details: unknown = {}) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.id, id))).limit(1);
    if (!row) throw new AppError(404, "Realization contract not found.", "NOT_FOUND");
    if (!transitions[row.state]?.includes(to)) throw new AppError(409, `Invalid realization transition ${row.state} -> ${to}.`, "INVALID_STATE");
    const [updated] = await tx.update(realizationContractsTable).set({ state: to as any }).where(and(eq(realizationContractsTable.id, id), eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.state, row.state))).returning();
    if (!updated) throw new AppError(409, "Realization state changed concurrently.", "CONCURRENT_STATE_CHANGE");
    await tx.insert(realizationEventsTable).values({ workspaceId, contractId: id, type: "state_changed", details: { from: row.state, to, details: sanitize(details) } });
    await evidence(tx, updated, to, details);
    return updated;
  });
}
export async function getRealizationContract(workspaceId: string, id: string) { const contract = await load(workspaceId, id); const attempts = await db.select().from(realizationAttemptsTable).where(and(eq(realizationAttemptsTable.workspaceId, workspaceId), eq(realizationAttemptsTable.contractId, id))).orderBy(desc(realizationAttemptsTable.number)); const events = await db.select().from(realizationEventsTable).where(and(eq(realizationEventsTable.workspaceId, workspaceId), eq(realizationEventsTable.contractId, id))).orderBy(desc(realizationEventsTable.createdAt)); return { contract, attempts: attempts.map(a => ({ ...a, receipt: sanitize(a.receipt), readback: sanitize(a.readback), error: sanitize(a.error), qc: sanitize(a.qc), retry: sanitize(a.retry), recovery: sanitize(a.recovery), compensation: sanitize(a.compensation) })), events: events.map(e => ({ ...e, details: sanitize(e.details) })) }; }
export const listRealizationContracts = (workspaceId: string, campaignId?: string) => db.select().from(realizationContractsTable).where(campaignId ? and(eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.campaignId, campaignId)) : eq(realizationContractsTable.workspaceId, workspaceId)).orderBy(desc(realizationContractsTable.createdAt));
export async function preflightRealization(workspaceId: string, id: string) { const row = await load(workspaceId, id); const result = await adapterFor(row.action).preflight({ workspaceId, binding: row.binding }); return transition(workspaceId, id, result.eligible ? "preflight" : "blocked", { blockers: result.blockers ?? [] }); }
export async function executeRealization(workspaceId: string, id: string) {
  const initial = await load(workspaceId, id);
  if (!["preflight", "retryable", "attempted"].includes(initial.state)) throw new AppError(409, "Contract is not executable.", "INVALID_STATE");
  const claim = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`realization:${workspaceId}:${initial.campaignId}`},0))`);
    const [current] = await tx.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.id, id))).limit(1);
    if (!current) throw new AppError(404, "Realization contract not found.", "NOT_FOUND");
    const [inflight] = await tx.select().from(realizationAttemptsTable).where(and(eq(realizationAttemptsTable.workspaceId, workspaceId), eq(realizationAttemptsTable.contractId, id), eq(realizationAttemptsTable.state, "in_flight"))).limit(1);
    if (inflight) return { attempt: inflight, readbackOnly: true, row: current };
    if (!["preflight", "retryable"].includes(current.state) || current.attemptsUsed >= current.maxAttempts) throw new AppError(409, "Maximum realization attempts exhausted.", "MAX_ATTEMPTS_EXCEEDED");
    const [attempt] = await tx.insert(realizationAttemptsTable).values({ workspaceId, contractId: id, number: current.attemptsUsed + 1, state: "in_flight", leaseOwner: randomUUID(), leaseExpiresAt: new Date(Date.now() + 120000) }).returning();
    const [updated] = await tx.update(realizationContractsTable).set({ attemptsUsed: current.attemptsUsed + 1, state: "attempted" }).where(and(eq(realizationContractsTable.id, id), eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.state, current.state), eq(realizationContractsTable.attemptsUsed, current.attemptsUsed))).returning();
    if (!updated) throw new AppError(409, "Realization claim lost.", "CONCURRENT_STATE_CHANGE");
    await tx.insert(realizationEventsTable).values({ workspaceId, contractId: id, attemptId: attempt.id, type: "claimed", details: { readbackOnly: false } });
    await evidence(tx, updated, "attempted", { attemptId: attempt.id });
    return { attempt, readbackOnly: false, row: updated };
  });
  try {
    const result = await adapterFor(claim.row.action).executeOrReconcile({ workspaceId, binding: claim.row.binding, readbackOnly: claim.readbackOnly });
    if (result.retryable || result.ambiguous || !result.receipt || !result.readback) {
      const state = result.ambiguous ? "recovery" : "retryable";
      const err = new AppError(result.ambiguous ? 502 : 503, result.ambiguous ? "Provider outcome is ambiguous." : "Provider execution is retryable.", result.ambiguous ? "AMBIGUOUS_PROVIDER_OUTCOME" : "RETRYABLE_PROVIDER_ERROR");
      (err as any).retryable = state === "retryable"; (err as any).ambiguous = result.ambiguous;
      await db.transaction(async tx => {
        await tx.update(realizationAttemptsTable).set({ state: state === "recovery" ? "ambiguous" : "retryable", error: sanitize({ message: err.message }), completedAt: new Date() }).where(and(eq(realizationAttemptsTable.id, claim.attempt.id), eq(realizationAttemptsTable.state, "in_flight")));
        const [updated] = await tx.update(realizationContractsTable).set({ state: state as any }).where(and(eq(realizationContractsTable.id, id), eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.state, "attempted"))).returning();
        if (updated) { await tx.insert(realizationEventsTable).values({ workspaceId, contractId: id, attemptId: claim.attempt.id, type: "exception", details: { state, error: err.message } }); await evidence(tx, updated, state, { error: err.message }); }
      });
      throw err;
    }
    const receipt = sanitize(result.receipt), readback = sanitize(result.readback);
    await db.transaction(async tx => { await tx.update(realizationAttemptsTable).set({ state: "confirmed", receipt, readback, completedAt: new Date() }).where(and(eq(realizationAttemptsTable.id, claim.attempt.id), eq(realizationAttemptsTable.state, "in_flight"))); const [updated] = await tx.update(realizationContractsTable).set({ state: "provider_confirmed" }).where(and(eq(realizationContractsTable.id, id), eq(realizationContractsTable.workspaceId, workspaceId), eq(realizationContractsTable.state, "attempted"))).returning(); if (updated) { await tx.insert(realizationEventsTable).values({ workspaceId, contractId: id, attemptId: claim.attempt.id, type: "provider_receipt", details: { receipt, readback, readbackOnly: claim.readbackOnly } }); await evidence(tx, updated, "provider_confirmed", { receipt, readback, readbackOnly: claim.readbackOnly }); } });
    return { state: "provider_confirmed", receipt, readback, readbackOnly: claim.readbackOnly };
  } catch (error) {
    if ((error as any)?.code === "RETRYABLE_PROVIDER_ERROR" || (error as any)?.code === "AMBIGUOUS_PROVIDER_OUTCOME") throw error;
    const err = error instanceof Error ? error : new Error(String(error));
    await db.update(realizationAttemptsTable).set({ state: "failed", error: sanitize({ message: err.message }), completedAt: new Date() }).where(and(eq(realizationAttemptsTable.id, claim.attempt.id), eq(realizationAttemptsTable.state, "in_flight")));
    const [updated] = await db.update(realizationContractsTable).set({ state: "failed" }).where(and(eq(realizationContractsTable.id, id), eq(realizationContractsTable.state, "attempted"))).returning();
    if (updated) await db.insert(executionEvidenceTable).values({ workspaceId, campaignId: updated.campaignId, masterplanVersionId: updated.masterplanVersionId, contextFingerprint: updated.contextFingerprint, subjectType: updated.subjectType, subjectId: updated.subjectId, state: "failed", details: sanitize({ message: err.message }) });
    throw error;
  }
}
export async function qcRealization(workspaceId: string, id: string) { const row = await load(workspaceId, id); if (row.state !== "provider_confirmed") throw new AppError(409, "QC requires provider confirmation.", "INVALID_STATE"); const [attempt] = await db.select().from(realizationAttemptsTable).where(and(eq(realizationAttemptsTable.workspaceId, workspaceId), eq(realizationAttemptsTable.contractId, id))).orderBy(desc(realizationAttemptsTable.number)).limit(1); const result = await adapterFor(row.action).qc({ workspaceId, binding: row.binding, readback: attempt?.readback }); await db.insert(realizationEventsTable).values({ workspaceId, contractId: id, attemptId: attempt?.id, type: "qc", details: sanitize({ passed: result.passed, report: result.report }) }); return transition(workspaceId, id, result.passed ? "artifact_qc" : "exception", result.report); }
export async function monitorRealization(workspaceId: string, id: string) { const row = await load(workspaceId, id); if (!["artifact_qc", "monitored"].includes(row.state)) throw new AppError(409, "Monitoring requires QC.", "INVALID_STATE"); const [attempt] = await db.select().from(realizationAttemptsTable).where(and(eq(realizationAttemptsTable.workspaceId, workspaceId), eq(realizationAttemptsTable.contractId, id))).orderBy(desc(realizationAttemptsTable.number)).limit(1); const result = await adapterFor(row.action).monitor({ workspaceId, binding: row.binding, readback: attempt?.readback }); await db.insert(realizationEventsTable).values({ workspaceId, contractId: id, attemptId: attempt?.id, type: "monitor", details: sanitize(result.evidence) }); return transition(workspaceId, id, result.state === "monitored" ? "monitored" : "recovery", result.evidence); }
export async function compensateRealization(workspaceId: string, id: string) { const row = await load(workspaceId, id); if (!["recovery", "failed"].includes(row.state)) throw new AppError(409, "Compensation requires recovery or failure.", "INVALID_STATE"); const result = await adapterFor(row.action).compensate({ workspaceId, binding: row.binding }); await db.insert(realizationEventsTable).values({ workspaceId, contractId: id, type: "compensate", details: sanitize(result.evidence) }); return transition(workspaceId, id, result.compensated ? "compensated" : "exception", result.evidence); }
export async function retryRealization(workspaceId: string, id: string) {
  const row = await load(workspaceId, id);
  if (row.state !== "retryable" || row.attemptsUsed >= row.maxAttempts) throw new AppError(409, "Retry is not available.", "RETRY_EXHAUSTED");
  const result = await adapterFor(row.action).preflight({ workspaceId, binding: row.binding });
  await db.insert(realizationEventsTable).values({ workspaceId, contractId: id, type: "retry", details: sanitize({ eligible: result.eligible, blockers: result.blockers ?? [] }) });
  return transition(workspaceId, id, result.eligible ? "preflight" : "blocked", { retry: true, blockers: result.blockers ?? [] });
}