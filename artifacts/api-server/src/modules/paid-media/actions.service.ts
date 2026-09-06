import { and, eq, gt } from "drizzle-orm";
import { db, contractAcceptancesTable, mandatoryPausesTable, paidMediaAccountsTable, paidMediaActionAttemptsTable, paidMediaApprovalsTable, paidMediaEntitiesTable, paidMediaPoliciesTable, paidMediaProposalsTable } from "@workspace/db";
import { paidMediaProvider, PaidMediaProviderError, type ProviderAction } from "./providers.js";
import { hasConsistentRollbackOwnership, policyAllows, requiresHumanApproval } from "./paid-media.domain.js";

export async function evaluatePolicy(workspaceId: string, accountId: string, action: ProviderAction, sampleSize: number, quality: number) {
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
  if (!account) throw new Error("Account not found.");
  const [policy] = await db.select().from(paidMediaPoliciesTable).where(and(eq(paidMediaPoliciesTable.workspaceId, workspaceId), eq(paidMediaPoliciesTable.provider, account.provider), eq(paidMediaPoliciesTable.accountId, accountId))).limit(1);
  const crossPlatform = requiresHumanApproval(action, account.provider);
  const accepted = !!policy?.acceptedAt && (!policy.acceptanceExpiresAt || policy.acceptanceExpiresAt > new Date());
  const eligible = !!policy && policyAllows({
    enabled: policy.enabled, accepted, mandatoryPause: policy.mandatoryPause,
    minimumSampleSize: policy.minimumSampleSize,
    minimumDataQualityScore: Number(policy.minimumDataQualityScore),
    maxDailyBudgetChangePercent: Number(policy.maxDailyBudgetChangePercent ?? 0),
    maxBidChangePercent: Number(policy.maxBidChangePercent ?? 0),
  }, action, sampleSize, quality);
  return { policy, crossPlatform, eligible: !crossPlatform && eligible, reason: crossPlatform ? "Cross-platform budget movement always requires human approval." : eligible ? "Within approved policy limits." : "Policy, acceptance, quality, sample, pause, or limit check failed." };
}

export async function decideProposal(workspaceId: string, userId: string, proposalId: string, approved: boolean, evidence: Record<string, unknown>, comment?: string) {
  const [proposal] = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.id, proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId))).limit(1);
  if (!proposal) throw new Error("Proposal not found.");
  if (proposal.status !== "pending_approval") throw new PaidMediaProviderError("Proposal is no longer awaiting approval.", "PRECONDITION_FAILED", 409);
  if (proposal.expiresAt <= new Date()) throw new PaidMediaProviderError("Proposal has expired.", "PRECONDITION_FAILED", 409);
  const status = approved ? "approved" as const : "rejected" as const;
  await db.transaction(async (tx) => {
    await tx.insert(paidMediaApprovalsTable).values({ proposalId, workspaceId, decision: status, approverId: userId, evidence, comment });
    await tx.update(paidMediaProposalsTable).set({ status }).where(eq(paidMediaProposalsTable.id, proposalId));
  });
  return { ...proposal, status };
}

export async function executeProposal(workspaceId: string, proposalId: string) {
  const [proposal] = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.id, proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId))).limit(1);
  if (!proposal || !proposal.accountId || !proposal.entityId) throw new Error("Executable proposal not found.");
  if (proposal.status !== "approved") throw new PaidMediaProviderError("Proposal requires human approval before execution.", "PRECONDITION_FAILED", 409);
  if (proposal.expiresAt <= new Date()) throw new PaidMediaProviderError("Proposal has expired.", "PRECONDITION_FAILED", 409);
  const [pause] = await db.select({ id: mandatoryPausesTable.id }).from(mandatoryPausesTable).where(and(eq(mandatoryPausesTable.workspaceId, workspaceId), eq(mandatoryPausesTable.status, "active"))).limit(1);
  if (pause) throw new PaidMediaProviderError("Execution is blocked by an active mandatory pause.", "PRECONDITION_FAILED", 423);
  const [acceptance] = await db.select({ id: contractAcceptancesTable.id }).from(contractAcceptancesTable).where(and(eq(contractAcceptancesTable.workspaceId, workspaceId), eq(contractAcceptancesTable.acceptanceType, "autonomy"), eq(contractAcceptancesTable.revokedAt, null as never))).limit(1);
  if (!acceptance) throw new PaidMediaProviderError("Current autonomy acceptance is required.", "PRECONDITION_FAILED", 423);
  const [entity] = await db.select().from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id, proposal.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId))).limit(1);
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, proposal.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
  if (!entity || !account) throw new Error("Proposal entity or account not found.");
  // Attempt keys are globally unique in storage; namespace them so two
  // workspaces may legitimately use the same proposal idempotency key.
  const attemptIdempotencyKey = `${workspaceId}:${proposal.idempotencyKey}`;
  const existing = await db.select().from(paidMediaActionAttemptsTable).where(and(
    eq(paidMediaActionAttemptsTable.workspaceId, workspaceId),
    eq(paidMediaActionAttemptsTable.idempotencyKey, attemptIdempotencyKey),
  )).limit(1);
  if (existing[0]) return existing[0];
  const adapter = paidMediaProvider(proposal.provider);
  const action: ProviderAction = { ...(proposal.requestedChange as ProviderAction), entityId: entity.providerEntityId, entityType: entity.entityType, expectedVersion: entity.version ?? undefined, idempotencyKey: proposal.idempotencyKey };
  const before = await adapter.getEntitySnapshot(workspaceId, account.providerAccountId, action.entityId, action.entityType);
  const [attempt] = await db.insert(paidMediaActionAttemptsTable).values({ proposalId, workspaceId, attemptNumber: 1, idempotencyKey: attemptIdempotencyKey, beforeSnapshot: before, status: "executing", startedAt: new Date() }).returning();
  await db.update(paidMediaProposalsTable).set({ status: "executing" }).where(eq(paidMediaProposalsTable.id, proposalId));
  try {
    const response = await adapter.applyAction(workspaceId, account.providerAccountId, action);
    const verification = await adapter.verifyAction(workspaceId, account.providerAccountId, action);
    const status = verification.verified ? "succeeded" as const : "verification_failed" as const;
    await db.update(paidMediaActionAttemptsTable).set({ status, providerResponse: response.evidence, verificationEvidence: verification.evidence, completedAt: new Date() }).where(eq(paidMediaActionAttemptsTable.id, attempt.id));
    await db.update(paidMediaProposalsTable).set({ status: verification.verified ? "verified" : "failed" }).where(eq(paidMediaProposalsTable.id, proposalId));
    return { ...attempt, status, verification };
  } catch (error) {
    await db.update(paidMediaActionAttemptsTable).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Execution failed.", completedAt: new Date() }).where(eq(paidMediaActionAttemptsTable.id, attempt.id));
    await db.update(paidMediaProposalsTable).set({ status: "failed" }).where(eq(paidMediaProposalsTable.id, proposalId));
    throw error;
  }
}

export async function rollbackAttempt(workspaceId: string, attemptId: string) {
  const [attempt] = await db.select().from(paidMediaActionAttemptsTable).where(and(eq(paidMediaActionAttemptsTable.id, attemptId), eq(paidMediaActionAttemptsTable.workspaceId, workspaceId))).limit(1);
  if (!attempt) throw new Error("Action attempt not found.");
  const [proposal] = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.id, attempt.proposalId), eq(paidMediaProposalsTable.workspaceId, workspaceId))).limit(1);
  const [account] = proposal?.accountId ? await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, proposal.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1) : [];
  const [entity] = proposal?.entityId ? await db.select().from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id, proposal.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId))).limit(1) : [];
  if (!proposal || !account || !entity) throw new PaidMediaProviderError("Rollback context unavailable.", "PRECONDITION_FAILED", 409);
  if (!hasConsistentRollbackOwnership(workspaceId, attempt, proposal, account, entity)) {
    throw new PaidMediaProviderError("Rollback context ownership mismatch.", "PRECONDITION_FAILED", 409);
  }
  const action = { ...(proposal.requestedChange as ProviderAction), entityId: entity.providerEntityId, entityType: entity.entityType, idempotencyKey: attempt.idempotencyKey };
  const result = await paidMediaProvider(proposal.provider).rollbackAction(workspaceId, account.providerAccountId, action, attempt.beforeSnapshot as never);
  await db.update(paidMediaActionAttemptsTable).set({ status: "rolled_back", rollbackEvidence: result.evidence, completedAt: new Date() }).where(and(eq(paidMediaActionAttemptsTable.id, attempt.id), eq(paidMediaActionAttemptsTable.workspaceId, workspaceId)));
  await db.update(paidMediaProposalsTable).set({ status: "rolled_back" }).where(and(eq(paidMediaProposalsTable.id, proposal.id), eq(paidMediaProposalsTable.workspaceId, workspaceId)));
  return result;
}