import { and, desc, eq, sql, gte, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { db, pool, campaignsTable, conditionalExecutionPoliciesTable, conditionalExecutionPolicyActionsTable, conditionalExecutionPolicyEventsTable, conditionalExecutionIntentsTable, conditionalExecutionAttemptsTable, conditionalExecutionEventsTable, paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaProposalsTable, workspaceIntegrationsTable, mandatoryPausesTable, executionEvidenceTable, workspacesTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { approvalSnapshotHash } from "../approval-center/approval-center.service.js";
import { paidMediaProvider, type PaidMediaProviderAdapter, type ProviderAction } from "./providers.js";

const MAX_DAILY = 100;
const MAX_EXECUTION_PAYLOAD_BYTES = 16 * 1024;
const SENSITIVE_EXECUTION_KEY = /token|secret|authorization|password|credential|cookie|api[_-]?key|access[_-]?key|refresh[_-]?key/i;

function sanitizeExecutionPayload(value: unknown): unknown {
  const state = { nodes: 0 };
  const walk = (input: unknown, depth: number): unknown => {
    if (++state.nodes > 500) return "[REDACTED_PAYLOAD_LIMIT]";
    if (depth > 6) return "[REDACTED_DEPTH_LIMIT]";
    if (input === null || typeof input === "number" || typeof input === "boolean") return input;
    if (typeof input === "string") return input.slice(0, 2048);
    if (input instanceof Date) return input.toISOString();
    if (Array.isArray(input)) return input.slice(0, 50).map((item) => walk(item, depth + 1));
    if (typeof input !== "object") return String(input).slice(0, 256);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input as Record<string, unknown>).slice(0, 50)) {
      result[key] = SENSITIVE_EXECUTION_KEY.test(key) ? "[REDACTED]" : walk(item, depth + 1);
    }
    return result;
  };
  const sanitized = walk(value, 0);
  return Buffer.byteLength(JSON.stringify(sanitized), "utf8") <= MAX_EXECUTION_PAYLOAD_BYTES
    ? sanitized
    : { __redacted_truncation: "[REDACTED_EXECUTION_BYTE_LIMIT]" };
}
export async function createExecutionPolicy(workspaceId: string, actorUserId: string, campaignId: string, input: any) {
  if (typeof input.enabled !== "boolean" || input.action?.actionType !== "paid_media_pause") throw new AppError(400, "Only paid_media_pause is supported.", "UNSUPPORTED_ACTION");
  if (!input.idempotencyKey || !input.masterplanVersionId || !input.snapshotHash || !input.contextFingerprint || !input.expiresAt) throw new AppError(400, "Complete approved binding and idempotencyKey are required.", "VALIDATION_ERROR");
  if (new Date(input.expiresAt) <= new Date()) throw new AppError(400, "Execution policy expiry must be in the future.", "INVALID_EXPIRY");
  const [owner] = await db.select({ ownerId: workspacesTable.ownerId }).from(workspacesTable).where(and(eq(workspacesTable.id, workspaceId), eq(workspacesTable.ownerId, actorUserId))).limit(1);
  if (!owner) throw new AppError(403, "Only the workspace owner may authorize execution.", "OWNER_AUTHORIZATION_REQUIRED");
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new AppError(404, "Campaign not found.", "CAMPAIGN_NOT_FOUND");
  const approved = await getApprovedMasterplan(workspaceId, campaignId);
  if (!approved || approved.id !== input.masterplanVersionId || approved.contextFingerprint !== input.contextFingerprint) throw new AppError(409, "Approved masterplan binding is stale.", "STALE_APPROVED_BINDING");
  const hash = approvalSnapshotHash({ subjectType: "masterplan", id: approved.id, campaignId: approved.campaignId, workspaceId: approved.workspaceId, version: approved.version, status: approved.status, snapshot: approved.snapshot, contentHash: approved.contentHash, contextFingerprint: approved.contextFingerprint, readinessScore: approved.readinessScore, readinessStatus: approved.readinessStatus, readinessBlockers: approved.readinessBlockers, autonomyContract: approved.autonomyContract, allowedActions: approved.allowedActions, requiredApprovals: approved.requiredApprovals });
  if (hash !== input.snapshotHash) throw new AppError(409, "Approved masterplan snapshot is stale.", "STALE_SNAPSHOT_HASH");
  const a = input.action;
  if (!Number.isInteger(a.maxActionsPerDay) || a.maxActionsPerDay < 1 || a.maxActionsPerDay > MAX_DAILY || !a.accountId || !a.entityId || !a.provider) throw new AppError(400, "A concrete provider account/entity and bounded ceiling are required.", "INVALID_TARGET");
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, a.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, a.provider))).limit(1);
  const [entity] = await db.select().from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id, a.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId), eq(paidMediaEntitiesTable.accountId, a.accountId))).limit(1);
  if (!account || !entity) throw new AppError(409, "Provider account/entity ownership mismatch.", "TARGET_OWNERSHIP_MISMATCH");
  // Serialize idempotency lookup, version allocation, and insertion.  The
  // unique indexes are a last line of defence, not the coordination mechanism.
  const lockKey = `policy:${workspaceId}:${campaignId}`;
  return db.transaction(async (tx) => {
   await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey},0))`);
  const [current] = await tx.select({ version: sql<number>`coalesce(max(${conditionalExecutionPoliciesTable.version}),0)` }).from(conditionalExecutionPoliciesTable).where(and(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId), eq(conditionalExecutionPoliciesTable.campaignId, campaignId)));
  const [existing] = await tx.select().from(conditionalExecutionPoliciesTable).where(and(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId), eq(conditionalExecutionPoliciesTable.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) {
    const existingAction = (await tx.select().from(conditionalExecutionPolicyActionsTable).where(eq(conditionalExecutionPolicyActionsTable.policyId, existing.id)).limit(1))[0];
    const sameBinding = existing.enabled === input.enabled &&
      existing.masterplanVersionId === approved.id && existing.snapshotHash === input.snapshotHash &&
      existing.contextFingerprint === input.contextFingerprint &&
      existing.expiresAt.getTime() === new Date(input.expiresAt).getTime() &&
      existingAction?.actionType === "paid_media_pause" &&
      existingAction.provider === a.provider && existingAction.accountId === a.accountId &&
      existingAction.entityId === a.entityId && existingAction.maxActionsPerDay === a.maxActionsPerDay;
    if (!sameBinding) throw new AppError(409, "Idempotency key conflicts with an existing execution policy.", "IDEMPOTENCY_CONFLICT");
    return { policy: existing, action: existingAction };
  }
  const [policy] = await tx.insert(conditionalExecutionPoliciesTable).values({ workspaceId, campaignId, version: Number(current?.version ?? 0) + 1, enabled: input.enabled, masterplanVersionId: approved.id, snapshotHash: input.snapshotHash, contextFingerprint: input.contextFingerprint, expiresAt: new Date(input.expiresAt), ownerUserId: actorUserId, idempotencyKey: input.idempotencyKey }).returning();
  const [action] = await tx.insert(conditionalExecutionPolicyActionsTable).values({ policyId: policy.id, workspaceId, actionType: "paid_media_pause", provider: a.provider, accountId: a.accountId, entityId: a.entityId, maxActionsPerDay: a.maxActionsPerDay }).returning();
  return { policy, action };
  });
}
export async function revokeExecutionPolicy(workspaceId: string, actorUserId: string, campaignId: string, version: number) {
  const [owner] = await db.select({ ownerId: workspacesTable.ownerId }).from(workspacesTable).where(and(eq(workspacesTable.id, workspaceId), eq(workspacesTable.ownerId, actorUserId))).limit(1);
  if (!owner) throw new AppError(403, "Only the workspace owner may revoke execution.", "OWNER_AUTHORIZATION_REQUIRED");
  const [policy] = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`policy:${workspaceId}:${campaignId}`},0))`);
    return tx.update(conditionalExecutionPoliciesTable).set({ revokedAt: new Date(), revokedBy: actorUserId }).where(and(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId), eq(conditionalExecutionPoliciesTable.campaignId, campaignId), eq(conditionalExecutionPoliciesTable.version, version))).returning();
  });
  if (!policy) throw new AppError(404, "Policy not found.", "POLICY_NOT_FOUND");
  await db.insert(conditionalExecutionPolicyEventsTable).values({ workspaceId, policyId: policy.id, eventType: "revoked", actorUserId, details: { version } });
  return policy;
}
export async function getConditionalExecutions(workspaceId: string, campaignId: string) {
  const approvedPlan = await getApprovedMasterplan(workspaceId, campaignId);
  const approvedBinding = approvedPlan ? {
    masterplanVersionId: approvedPlan.id,
    snapshotHash: approvalSnapshotHash({ subjectType: "masterplan", id: approvedPlan.id, campaignId: approvedPlan.campaignId, workspaceId: approvedPlan.workspaceId, version: approvedPlan.version, status: approvedPlan.status, snapshot: approvedPlan.snapshot, contentHash: approvedPlan.contentHash, contextFingerprint: approvedPlan.contextFingerprint, readinessScore: approvedPlan.readinessScore, readinessStatus: approvedPlan.readinessStatus, readinessBlockers: approvedPlan.readinessBlockers, autonomyContract: approvedPlan.autonomyContract, allowedActions: approvedPlan.allowedActions, requiredApprovals: approvedPlan.requiredApprovals }),
    contextFingerprint: approvedPlan.contextFingerprint,
    version: approvedPlan.version,
  } : null;
  const [policy] = await db.select().from(conditionalExecutionPoliciesTable).where(and(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId), eq(conditionalExecutionPoliciesTable.campaignId, campaignId))).orderBy(desc(conditionalExecutionPoliciesTable.version)).limit(1);
  const action = policy ? (await db.select().from(conditionalExecutionPolicyActionsTable).where(eq(conditionalExecutionPolicyActionsTable.policyId, policy.id)).limit(1))[0] : null;
  const intents = await db.select().from(conditionalExecutionIntentsTable).where(and(eq(conditionalExecutionIntentsTable.workspaceId, workspaceId), eq(conditionalExecutionIntentsTable.campaignId, campaignId))).orderBy(desc(conditionalExecutionIntentsTable.createdAt)).limit(50);
  const intentIds = intents.map((intent) => intent.id);
  const attempts = intentIds.length ? await db.select().from(conditionalExecutionAttemptsTable).where(and(eq(conditionalExecutionAttemptsTable.workspaceId, workspaceId), inArray(conditionalExecutionAttemptsTable.intentId, intentIds))).orderBy(desc(conditionalExecutionAttemptsTable.createdAt)).limit(50) : [];
  const events = intentIds.length ? await db.select().from(conditionalExecutionEventsTable).where(and(eq(conditionalExecutionEventsTable.workspaceId, workspaceId), inArray(conditionalExecutionEventsTable.intentId, intentIds))).orderBy(desc(conditionalExecutionEventsTable.createdAt)).limit(100) : [];
  const [eligibleProposal] = policy && action
    ? await db.select({ id: paidMediaProposalsTable.id }).from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.workspaceId,workspaceId),eq(paidMediaProposalsTable.campaignId,campaignId),eq(paidMediaProposalsTable.accountId,action.accountId),eq(paidMediaProposalsTable.entityId,action.entityId),eq(paidMediaProposalsTable.status,"approved"))).limit(1)
    : [];
  const eligibility = policy && action && eligibleProposal
    ? await preflightConditionalExecution(workspaceId, policy.id, action.id, eligibleProposal.id)
    : { eligible:false, code: policy && action ? "PROPOSAL_INVALID" : "POLICY_DISABLED" };
  return { policy: policy ? sanitizeExecutionPayload(policy) : null, action: action ? sanitizeExecutionPayload(action) : null,
    approvedBinding,
    eligibility: eligibility.eligible, blockers: eligibility.eligible ? [] : [eligibility.code], intents: sanitizeExecutionPayload(intents), attempts: sanitizeExecutionPayload(attempts), events: sanitizeExecutionPayload(events), counts: { intents: intents.length, attempts: attempts.length, events: events.length, confirmed: intents.filter(i => i.status === "confirmed").length, blocked: intents.filter(i => i.status === "blocked").length } };
}
export type ConditionalBlockCode = "POLICY_DISABLED"|"POLICY_EXPIRED"|"POLICY_REVOKED"|"SUPERSEDED_POLICY"|"STALE_MASTERPLAN"|"CAMPAIGN_PAUSED"|"CAMPAIGN_CANCELLED"|"MANDATORY_PAUSE"|"CREDENTIAL_UNHEALTHY"|"TARGET_OWNERSHIP"|"PROPOSAL_INVALID"|"DAILY_CEILING"|"ALREADY_CONFIRMED";
export async function preflightConditionalExecution(workspaceId: string, policyId: string, actionId: string, proposalId: string, query: any = db, reconciliation = false, reserved = false) {
  const [p] = await query.select().from(conditionalExecutionPoliciesTable).where(and(eq(conditionalExecutionPoliciesTable.id, policyId), eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId))).limit(1);
  const [a] = await query.select().from(conditionalExecutionPolicyActionsTable).where(and(eq(conditionalExecutionPolicyActionsTable.id, actionId), eq(conditionalExecutionPolicyActionsTable.workspaceId, workspaceId))).limit(1);
  const [proposal] = await query.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.id, proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId))).limit(1);
  if (!p || !a || !proposal) return { eligible: false, code: "PROPOSAL_INVALID" as ConditionalBlockCode };
  if (a.policyId !== p.id) return { eligible: false, code: "PROPOSAL_INVALID" as ConditionalBlockCode };
  const [latest] = await query.select({ id: conditionalExecutionPoliciesTable.id })
    .from(conditionalExecutionPoliciesTable)
    .where(and(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId), eq(conditionalExecutionPoliciesTable.campaignId, p.campaignId)))
    .orderBy(desc(conditionalExecutionPoliciesTable.version)).limit(1);
  if (latest && latest.id !== p.id && !reconciliation) return { eligible: false, code: "SUPERSEDED_POLICY" as ConditionalBlockCode };
  if (!reconciliation && !p.enabled) return { eligible: false, code: "POLICY_DISABLED" as ConditionalBlockCode };
  if (!reconciliation && p.revokedAt) return { eligible: false, code: "POLICY_REVOKED" as ConditionalBlockCode };
  if (!reconciliation && p.expiresAt <= new Date()) return { eligible: false, code: "POLICY_EXPIRED" as ConditionalBlockCode };
  const [campaign] = await query.select().from(campaignsTable).where(and(eq(campaignsTable.id, p.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) return { eligible: false, code: "TARGET_OWNERSHIP" as ConditionalBlockCode };
  if (campaign.status === "paused") return { eligible: false, code: "CAMPAIGN_PAUSED" as ConditionalBlockCode };
  if (campaign.status === "cancelled") return { eligible: false, code: "CAMPAIGN_CANCELLED" as ConditionalBlockCode };
  const approved = await getApprovedMasterplan(workspaceId, p.campaignId, query);
  if (!approved || approved.id !== p.masterplanVersionId || approved.contextFingerprint !== p.contextFingerprint) return { eligible: false, code: "STALE_MASTERPLAN" as ConditionalBlockCode };
  const hash = approvalSnapshotHash({ subjectType:"masterplan", id:approved.id, campaignId:approved.campaignId, workspaceId:approved.workspaceId, version:approved.version, status:approved.status, snapshot:approved.snapshot, contentHash:approved.contentHash, contextFingerprint:approved.contextFingerprint, readinessScore:approved.readinessScore, readinessStatus:approved.readinessStatus, readinessBlockers:approved.readinessBlockers, autonomyContract:approved.autonomyContract, allowedActions:approved.allowedActions, requiredApprovals:approved.requiredApprovals });
  if (hash !== p.snapshotHash) return { eligible: false, code: "STALE_MASTERPLAN" as ConditionalBlockCode };
  const [pause] = await query.select({ id: mandatoryPausesTable.id }).from(mandatoryPausesTable).where(and(eq(mandatoryPausesTable.workspaceId, workspaceId), eq(mandatoryPausesTable.status, "active"), orScope(p.campaignId))).limit(1);
  if (pause) return { eligible: false, code: "MANDATORY_PAUSE" as ConditionalBlockCode };
  const [account] = await query.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id,a.accountId),eq(paidMediaAccountsTable.workspaceId,workspaceId),eq(paidMediaAccountsTable.provider,a.provider as "meta_ads"|"tiktok_ads"|"google_ads"))).limit(1);
  const [entity] = await query.select().from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id,a.entityId),eq(paidMediaEntitiesTable.workspaceId,workspaceId),eq(paidMediaEntitiesTable.accountId,a.accountId))).limit(1);
  if (!account || !entity || !account.isSelected || account.provider !== a.provider ||
      entity.provider !== a.provider || !entity.lastSyncedAt ||
      entity.lastSyncedAt <= new Date(Date.now() - 15 * 60_000) ||
      !["ACTIVE", "active", "OPERATIONAL", "operational"].includes(entity.status ?? "")) return { eligible:false, code:"TARGET_OWNERSHIP" as ConditionalBlockCode };
  if (proposal.campaignId !== p.campaignId || proposal.provider !== a.provider ||
      proposal.masterplanVersionId !== p.masterplanVersionId ||
      proposal.contextFingerprint !== p.contextFingerprint ||
      !(proposal.status === "approved" || (reconciliation && proposal.status === "executing")) ||
      proposal.expiresAt <= new Date() ||
      proposal.actionType !== "pause" || proposal.accountId !== a.accountId ||
      proposal.entityId !== a.entityId) return { eligible:false, code:"PROPOSAL_INVALID" as ConditionalBlockCode };
  const [integration] = await query.select().from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id,account.integrationId),eq(workspaceIntegrationsTable.workspaceId,workspaceId))).limit(1);
  if (!integration || integration.provider !== a.provider || integration.status !== "connected" ||
      !integration.accessToken || !integration.tokenExpiresAt || integration.tokenExpiresAt <= new Date() || integration.blocksExecution) return { eligible:false, code:"CREDENTIAL_UNHEALTHY" as ConditionalBlockCode };
  // Provider/account health is intentionally fail-closed.  Connectors expose
  // these fields in providerData as they are discovered during sync.
  const accountHealth = (account as any).providerData;
  const entityHealth = (entity as any).providerData;
  if (account.operationalHealth !== true || !account.healthCheckedAt ||
      account.healthCheckedAt <= new Date(Date.now() - 15 * 60_000) ||
      (accountHealth && (accountHealth.operational === false || accountHealth.health === "unhealthy")) ||
      (entityHealth && (entityHealth.operational === false || entityHealth.health === "unhealthy"))) return { eligible:false, code:"CREDENTIAL_UNHEALTHY" as ConditionalBlockCode };
  const [daily] = await query.select({ n: count() }).from(conditionalExecutionIntentsTable).where(and(eq(conditionalExecutionIntentsTable.workspaceId,workspaceId),eq(conditionalExecutionIntentsTable.policyActionId,a.id),gte(conditionalExecutionIntentsTable.createdAt,new Date(new Date().toISOString().slice(0,10)+"T00:00:00Z")),inArray(conditionalExecutionIntentsTable.status,["eligible","attempted","confirmed","recovery_required"])));
  if (!reserved && Number(daily?.n ?? 0) >= a.maxActionsPerDay) return { eligible:false, code:"DAILY_CEILING" as ConditionalBlockCode };
  return { eligible:true as const, policy:p, action:a, proposal, account, entity };
}

/** Resolve the current policy/action for a proposal and ensure its exact
 * intent exists.  Realization uses this boundary rather than accepting
 * executor identifiers from an untrusted contract binding. */
export async function ensureConditionalIntentForProposal(workspaceId: string, proposalId: string) {
  const [proposal] = await db.select().from(paidMediaProposalsTable).where(and(
    eq(paidMediaProposalsTable.id, proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!proposal) throw new AppError(409, "Paid-media proposal is not owned by this workspace.", "PROPOSAL_INVALID");
  if (!proposal.campaignId || !proposal.accountId || !proposal.entityId) throw new AppError(409, "Proposal target is incomplete.", "PROPOSAL_INVALID");
  const [policy] = await db.select().from(conditionalExecutionPoliciesTable).where(and(
    eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId),
    eq(conditionalExecutionPoliciesTable.campaignId, proposal.campaignId),
  )).orderBy(desc(conditionalExecutionPoliciesTable.version)).limit(1);
  if (!policy) throw new AppError(409, "No current conditional policy matches the proposal.", "POLICY_NOT_FOUND");
  const [action] = await db.select().from(conditionalExecutionPolicyActionsTable).where(and(
    eq(conditionalExecutionPolicyActionsTable.workspaceId, workspaceId),
    eq(conditionalExecutionPolicyActionsTable.policyId, policy.id),
    eq(conditionalExecutionPolicyActionsTable.actionType, "paid_media_pause"),
    eq(conditionalExecutionPolicyActionsTable.provider, proposal.provider),
    eq(conditionalExecutionPolicyActionsTable.accountId, proposal.accountId),
    eq(conditionalExecutionPolicyActionsTable.entityId, proposal.entityId),
  )).limit(1);
  if (!action) throw new AppError(409, "No current conditional action matches the proposal target.", "ACTION_NOT_FOUND");
  const intentKey = `${policy.id}:${action.id}:${proposal.id}`;
  const [existing] = await db.select().from(conditionalExecutionIntentsTable).where(and(
    eq(conditionalExecutionIntentsTable.workspaceId, workspaceId),
    eq(conditionalExecutionIntentsTable.intentKey, intentKey),
  )).limit(1);
  if (existing) return { intent: existing, policy, action, proposal };
  const eligibility = await preflightConditionalExecution(workspaceId, policy.id, action.id, proposal.id, db, false, true);
  const [intent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId: proposal.campaignId, policyId: policy.id, policyActionId: action.id,
    proposalId: proposal.id, intentKey, status: eligibility.eligible ? "eligible" : "blocked",
    ...(eligibility.eligible ? {} : { blockCode: eligibility.code }),
  }).onConflictDoNothing().returning();
  if (!intent) {
    const [raced] = await db.select().from(conditionalExecutionIntentsTable).where(and(
      eq(conditionalExecutionIntentsTable.workspaceId, workspaceId), eq(conditionalExecutionIntentsTable.intentKey, intentKey),
    )).limit(1);
    if (!raced) throw new AppError(409, "Conditional intent could not be created.", "INTENT_CREATE_CONFLICT");
    return { intent: raced, policy, action, proposal };
  }
  return { intent, policy, action, proposal };
}
function orScope(campaignId: string) { return sql`(campaign_id IS NULL OR campaign_id = ${campaignId})`; }
export async function conditionalExecutionTick(adapter?: PaidMediaProviderAdapter) {
  // Select the latest row before evaluating enabled/revocation/expiry.  Never
  // let an older enabled policy become current when its successor is disabled.
  const allPolicies = await db.select().from(conditionalExecutionPoliciesTable).orderBy(desc(conditionalExecutionPoliciesTable.version));
  const latestPolicyByCampaign = new Map<string, typeof allPolicies[number]>();
  for (const policy of allPolicies) {
    const scope = `${policy.workspaceId}:${policy.campaignId}`;
    if (!latestPolicyByCampaign.has(scope)) latestPolicyByCampaign.set(scope, policy);
  }
  const policies = [...latestPolicyByCampaign.values()];
  let created = 0;
  const eligibleIds: Array<{ workspaceId: string; id: string }> = [];
  for (const policy of policies) {
    if (!policy.enabled || policy.revokedAt || policy.expiresAt <= new Date()) continue;
    const actions = await db.select().from(conditionalExecutionPolicyActionsTable).where(eq(conditionalExecutionPolicyActionsTable.policyId,policy.id));
    for (const action of actions) {
      const proposals = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.workspaceId,policy.workspaceId),eq(paidMediaProposalsTable.campaignId,policy.campaignId),eq(paidMediaProposalsTable.accountId,action.accountId),eq(paidMediaProposalsTable.entityId,action.entityId),eq(paidMediaProposalsTable.status,"approved"),eq(paidMediaProposalsTable.actionType,"pause"))).limit(25);
      for (const proposal of proposals) {
          const key = `${policy.id}:${action.id}:${proposal.id}`;
        await db.transaction(async tx => {
           const day = new Date().toISOString().slice(0, 10);
           const ceilingLockKey = `${policy.workspaceId}:${action.id}:${day}`;
           await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ceilingLockKey},0))`);
          const check = await preflightConditionalExecution(policy.workspaceId,policy.id,action.id,proposal.id,tx);
          const [existing] = await tx.select().from(conditionalExecutionIntentsTable).where(and(eq(conditionalExecutionIntentsTable.workspaceId,policy.workspaceId),eq(conditionalExecutionIntentsTable.intentKey,key))).limit(1);
          if (existing) return;
           // Reservation and ceiling check are one serialized operation.
           const [reserved] = await tx.select({ n: count() }).from(conditionalExecutionIntentsTable)
             .where(and(eq(conditionalExecutionIntentsTable.workspaceId, policy.workspaceId),
               eq(conditionalExecutionIntentsTable.policyActionId, action.id),
               gte(conditionalExecutionIntentsTable.createdAt, new Date(`${day}T00:00:00Z`)),
               inArray(conditionalExecutionIntentsTable.status, ["eligible","attempted","confirmed","recovery_required"])));
           const status: "eligible" | "blocked" = check.eligible && Number(reserved?.n ?? 0) < action.maxActionsPerDay ? "eligible" : "blocked";
           const blockCode = status === "blocked" ? (check.eligible ? "DAILY_CEILING" : check.code) : null;
           const [intent] = await tx.insert(conditionalExecutionIntentsTable).values({workspaceId:policy.workspaceId,campaignId:policy.campaignId,policyId:policy.id,policyActionId:action.id,proposalId:proposal.id,intentKey:key,status,blockCode}).returning();
           await tx.insert(conditionalExecutionEventsTable).values({workspaceId:policy.workspaceId,intentId:intent.id,eventType:status,details:status === "eligible"?{}:{code:blockCode}});
          await tx.insert(executionEvidenceTable).values({workspaceId:policy.workspaceId,campaignId:policy.campaignId,masterplanVersionId:policy.masterplanVersionId,contextFingerprint:policy.contextFingerprint,subjectType:"conditional_execution_intent",subjectId:intent.id,state:"planned",details:{eligibility:check.eligible,code:check.eligible?null:check.code}});
          created++;
           if (status === "eligible") eligibleIds.push({ workspaceId: policy.workspaceId, id: intent.id });
        });
      }
    }
  }
  // Sweep durable work, including rows created by a prior crashed tick.
  const pending = await db.select({ workspaceId: conditionalExecutionIntentsTable.workspaceId, id: conditionalExecutionIntentsTable.id })
    .from(conditionalExecutionIntentsTable)
    .where(inArray(conditionalExecutionIntentsTable.status, ["eligible","attempted"]));
  const durableWork = new Map([...eligibleIds, ...pending].map((item) => [`${item.workspaceId}:${item.id}`, item]));
  for (const item of durableWork.values()) await executeConditionalIntent(item.workspaceId, item.id, adapter);
  return created;
}
export async function executeConditionalIntent(workspaceId: string, intentId: string, adapter?: PaidMediaProviderAdapter) {
  const [initialIntent] = await db.select().from(conditionalExecutionIntentsTable)
    .where(and(eq(conditionalExecutionIntentsTable.id, intentId), eq(conditionalExecutionIntentsTable.workspaceId, workspaceId))).limit(1);
  if (!initialIntent) throw new AppError(404, "Intent not found.", "INTENT_NOT_FOUND");

  const lockClient = await pool.connect();
  const campaignLock = `policy:${workspaceId}:${initialIntent.campaignId}`;
  const intentLock = `conditional-intent:${workspaceId}:${intentId}`;
  let campaignLocked = false;
  let intentLocked = false;
  try {
    await lockClient.query("select pg_advisory_lock(hashtextextended($1,0))", [campaignLock]);
    campaignLocked = true;
    await lockClient.query("select pg_advisory_lock(hashtextextended($1,0))", [intentLock]);
    intentLocked = true;
    const lockedDb = drizzle(lockClient);

    const [intent] = await lockedDb.select().from(conditionalExecutionIntentsTable)
      .where(and(eq(conditionalExecutionIntentsTable.id, intentId), eq(conditionalExecutionIntentsTable.workspaceId, workspaceId))).limit(1);
    if (!intent || !["eligible", "attempted"].includes(intent.status)) {
      if (intent) return { status: intent.status };
      throw new AppError(404, "Intent not found.", "INTENT_NOT_FOUND");
    }

    const persistedAttempt = (await lockedDb.select().from(conditionalExecutionAttemptsTable)
      .where(and(eq(conditionalExecutionAttemptsTable.workspaceId, workspaceId), eq(conditionalExecutionAttemptsTable.intentId, intentId))).limit(1))[0];
    const readbackOnly = intent.status === "attempted" || Boolean(persistedAttempt);
    const check = await preflightConditionalExecution(
      workspaceId, intent.policyId, intent.policyActionId, intent.proposalId, lockedDb, readbackOnly, true,
    );
    if (!check.eligible) {
      if (readbackOnly) {
        await lockedDb.update(conditionalExecutionIntentsTable).set({ status: "recovery_required", blockCode: check.code })
          .where(eq(conditionalExecutionIntentsTable.id, intentId));
        return { status: "recovery_required", code: check.code };
      }
      await lockedDb.update(conditionalExecutionIntentsTable).set({ status: "blocked", blockCode: check.code })
        .where(eq(conditionalExecutionIntentsTable.id, intentId));
      return { status: "blocked", code: check.code };
    }

    const ready = check as Extract<typeof check, { eligible: true }>;
    const action = {
      ...(ready.proposal.requestedChange as ProviderAction),
      type: "pause" as const,
      entityId: ready.entity.providerEntityId,
      entityType: ready.entity.entityType,
      idempotencyKey: `m08:${intent.id}`,
    } as ProviderAction;
    const owner = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + 120_000);
    let attempt = persistedAttempt;

    if (!readbackOnly) {
      const claim = await lockedDb.transaction(async (tx) => {
        const [createdAttempt] = await tx.insert(conditionalExecutionAttemptsTable).values({
          workspaceId, intentId, attemptKey: `m08:${intent.id}`, status: "attempted",
          leaseOwner: owner, leaseExpiresAt, applyStartedAt: null,
        }).onConflictDoNothing().returning();
        if (!createdAttempt) return { attempt: null, casFailed: false };
        const [claimedIntent] = await tx.update(conditionalExecutionIntentsTable).set({ status: "attempted" })
          .where(and(eq(conditionalExecutionIntentsTable.id, intentId), eq(conditionalExecutionIntentsTable.status, "eligible"))).returning();
        const [claimedProposal] = await tx.update(paidMediaProposalsTable).set({ status: "executing" })
          .where(and(eq(paidMediaProposalsTable.id, intent.proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId), eq(paidMediaProposalsTable.status, "approved"))).returning();
        if (!claimedIntent || !claimedProposal) {
          await tx.update(conditionalExecutionAttemptsTable).set({ status: "recovery_required", errorCode: "PROPOSAL_CAS_FAILED" })
            .where(and(eq(conditionalExecutionAttemptsTable.id, createdAttempt.id), eq(conditionalExecutionAttemptsTable.leaseOwner, owner)));
          if (claimedIntent) await tx.update(conditionalExecutionIntentsTable).set({ status: "recovery_required", blockCode: "PROPOSAL_CAS_FAILED" })
            .where(eq(conditionalExecutionIntentsTable.id, intentId));
          return { attempt: createdAttempt, casFailed: true };
        }
        const [startedAttempt] = await tx.update(conditionalExecutionAttemptsTable)
          .set({ applyStartedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(conditionalExecutionAttemptsTable.id, createdAttempt.id), eq(conditionalExecutionAttemptsTable.leaseOwner, owner))).returning();
        return { attempt: startedAttempt, casFailed: false };
      });
      if (claim.casFailed) return { status: "recovery_required" };
      if (!claim.attempt) return { status: "in_progress" as const };
      attempt = claim.attempt;
      await lockedDb.insert(conditionalExecutionEventsTable).values({ workspaceId, intentId, eventType: "attempted", details: { attemptId: attempt.id } });
      await lockedDb.insert(executionEvidenceTable).values({ workspaceId, campaignId: intent.campaignId, masterplanVersionId: ready.policy.masterplanVersionId, contextFingerprint: ready.policy.contextFingerprint, subjectType: "conditional_execution_intent", subjectId: intent.id, state: "attempted", details: { attemptId: attempt.id, actionType: "paid_media_pause" } });
    } else {
      if (!attempt) {
        await lockedDb.update(conditionalExecutionIntentsTable).set({ status: "recovery_required", blockCode: "MISSING_ATTEMPT" })
          .where(eq(conditionalExecutionIntentsTable.id, intentId));
        return { status: "recovery_required", code: "MISSING_ATTEMPT" };
      }
      const [claimedAttempt] = await lockedDb.update(conditionalExecutionAttemptsTable)
        .set({ leaseOwner: owner, leaseExpiresAt, updatedAt: new Date() })
        .where(eq(conditionalExecutionAttemptsTable.id, attempt.id)).returning();
      attempt = claimedAttempt;
    }

    if (!attempt) return { status: "in_progress" as const };
    const provider = adapter ?? paidMediaProvider(ready.account.provider);
    try {
      const result = readbackOnly
        ? { evidence: attempt.providerReceipt, providerRequestId: undefined }
        : await provider.applyAction(workspaceId, ready.account.providerAccountId, action);
      await lockClient.query("select 1");
      const verify = await provider.verifyAction(workspaceId, ready.account.providerAccountId, action);
      await lockClient.query("select 1");
      const providerReceipt = sanitizeExecutionPayload(result.evidence);
      const readback = sanitizeExecutionPayload(verify.evidence);
      if (!verify.verified) {
        const finalized = await lockedDb.transaction(async (tx) => {
          const [fenced] = await tx.update(conditionalExecutionAttemptsTable)
            .set({ status: "ambiguous", providerReceipt, readback, errorCode: "READBACK_MISMATCH", updatedAt: new Date() })
            .where(and(eq(conditionalExecutionAttemptsTable.id, attempt.id), eq(conditionalExecutionAttemptsTable.leaseOwner, owner))).returning();
          if (!fenced) return false;
          await tx.update(conditionalExecutionIntentsTable).set({ status: "recovery_required", blockCode: "READBACK_MISMATCH" }).where(eq(conditionalExecutionIntentsTable.id, intentId));
          await tx.update(paidMediaProposalsTable).set({ status: "failed" }).where(and(eq(paidMediaProposalsTable.id, intent.proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId)));
          await tx.insert(conditionalExecutionEventsTable).values({ workspaceId, intentId, eventType: "recovery_required", details: { attemptId: attempt.id, code: "READBACK_MISMATCH" } });
          await tx.insert(executionEvidenceTable).values({ workspaceId, campaignId: intent.campaignId, masterplanVersionId: ready.policy.masterplanVersionId, contextFingerprint: ready.policy.contextFingerprint, subjectType: "conditional_execution_intent", subjectId: intent.id, state: "attempted", details: { attemptId: attempt.id, outcome: "recovery_required", code: "READBACK_MISMATCH" } });
          return true;
        });
        if (!finalized) return { status: "in_progress" as const };
        return { status: "recovery_required" };
      }
      const finalized = await lockedDb.transaction(async (tx) => {
        const [fenced] = await tx.update(conditionalExecutionAttemptsTable)
          .set({ status: "confirmed", providerReceipt, readback, updatedAt: new Date() })
          .where(and(eq(conditionalExecutionAttemptsTable.id, attempt.id), eq(conditionalExecutionAttemptsTable.leaseOwner, owner))).returning();
        if (!fenced) return false;
        await tx.update(conditionalExecutionIntentsTable).set({ status: "confirmed" }).where(eq(conditionalExecutionIntentsTable.id, intentId));
        await tx.update(paidMediaProposalsTable).set({ status: "verified" }).where(and(eq(paidMediaProposalsTable.id, intent.proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId)));
        await tx.insert(conditionalExecutionEventsTable).values({ workspaceId, intentId, eventType: "provider_confirmed", details: { attemptId: attempt.id } });
        await tx.insert(executionEvidenceTable).values({ workspaceId, campaignId: intent.campaignId, masterplanVersionId: ready.policy.masterplanVersionId, contextFingerprint: ready.policy.contextFingerprint, subjectType: "conditional_execution_intent", subjectId: intent.id, state: "provider_confirmed", details: { attemptId: attempt.id, provider: ready.account.provider, providerReceiptId: result.providerRequestId ?? null, readbackVerified: true } });
        return true;
      });
      if (!finalized) return { status: "in_progress" as const };
      return { status: "confirmed" };
    } catch {
      try {
        await lockClient.query("select 1");
        const finalized = await lockedDb.transaction(async (tx) => {
          const [fenced] = await tx.update(conditionalExecutionAttemptsTable)
            .set({ status: "ambiguous", errorCode: "UNKNOWN_PROVIDER_OUTCOME", updatedAt: new Date() })
            .where(and(eq(conditionalExecutionAttemptsTable.id, attempt.id), eq(conditionalExecutionAttemptsTable.leaseOwner, owner))).returning();
          if (!fenced) return false;
          await tx.update(conditionalExecutionIntentsTable).set({ status: "recovery_required", blockCode: "UNKNOWN_PROVIDER_OUTCOME" }).where(eq(conditionalExecutionIntentsTable.id, intentId));
          await tx.update(paidMediaProposalsTable).set({ status: "failed" }).where(and(eq(paidMediaProposalsTable.id, intent.proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId)));
          await tx.insert(conditionalExecutionEventsTable).values({ workspaceId, intentId, eventType: "recovery_required", details: { attemptId: attempt.id, code: "UNKNOWN_PROVIDER_OUTCOME" } });
          await tx.insert(executionEvidenceTable).values({ workspaceId, campaignId: intent.campaignId, masterplanVersionId: ready.policy.masterplanVersionId, contextFingerprint: ready.policy.contextFingerprint, subjectType: "conditional_execution_intent", subjectId: intent.id, state: "attempted", details: { attemptId: attempt.id, outcome: "recovery_required", code: "UNKNOWN_PROVIDER_OUTCOME" } });
          return true;
        });
        if (!finalized) return { status: "in_progress" as const };
      } catch {
        // Losing the lock connection fences this worker. A later sweep performs
        // readback-only reconciliation from the durable attempted marker.
      }
      return { status: "recovery_required" };
    }
  } finally {
    if (intentLocked) {
      try { await lockClient.query("select pg_advisory_unlock(hashtextextended($1,0))", [intentLock]); } catch {}
    }
    if (campaignLocked) {
      try { await lockClient.query("select pg_advisory_unlock(hashtextextended($1,0))", [campaignLock]); } catch {}
    }
    lockClient.release();
  }
}

/** Read the durable provider envelope; never infer a receipt from intent
 * state. */
export async function getConditionalIntentAttempt(workspaceId: string, intentId: string) {
  const [attempt] = await db.select().from(conditionalExecutionAttemptsTable).where(and(
    eq(conditionalExecutionAttemptsTable.workspaceId, workspaceId),
    eq(conditionalExecutionAttemptsTable.intentId, intentId),
  )).orderBy(desc(conditionalExecutionAttemptsTable.createdAt)).limit(1);
  return attempt ?? null;
}