import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, campaignsTable, masterplanVersionsTable, agentClarificationRequestsTable, auditLogsTable, commercialSubscriptionsTable } from "@workspace/db";
import { NotFoundError, AppError } from "../../lib/errors.js";
import { PRODUCT_AUTONOMY_CONTRACT } from "../autonomy/autonomy.service.js";
import { latestRegionalIntelligenceSummary } from "../market-intel/regional-intelligence.service.js";

type Json = Record<string, unknown>;
export type ApprovedDossierBinding = {
  campaignId: string | null | undefined;
  masterplanVersionId: string | null | undefined;
  contextFingerprint: string | null | undefined;
};
/** Pure fail-closed predicate shared by provider mutation boundaries. */
export function matchesApprovedDossier(
  approved: { id: string; contextFingerprint: string } | null | undefined,
  binding: ApprovedDossierBinding,
): boolean {
  return Boolean(binding.campaignId && binding.masterplanVersionId && binding.contextFingerprint
    && approved && approved.id === binding.masterplanVersionId
    && approved.contextFingerprint === binding.contextFingerprint);
}
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}
export function deterministicHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
export function calculateMasterplanReadiness(strategyData: unknown, pendingClarifications: { id: string; question: string }[]) {
  const missingStrategy = Object.keys(object(strategyData)).length === 0;
  const blockers = [
    ...pendingClarifications.map((item) => ({ type: "clarification", id: item.id, message: item.question })),
    ...(missingStrategy ? [{ type: "strategy", message: "Estratégia ainda não foi materializada." }] : []),
  ];
  const score = Math.max(0, 100 - blockers.length * 25);
  return { blockers, score, status: missingStrategy || score < 50 ? "blocked" : blockers.length ? "needs_attention" : "ready" };
}

export async function listMasterplanVersions(workspaceId: string, campaignId: string) {
  return db.select().from(masterplanVersionsTable).where(and(
    eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId),
  )).orderBy(desc(masterplanVersionsTable.version));
}
export async function getApprovedMasterplan(workspaceId: string, campaignId: string) {
  const [row] = await db.select().from(masterplanVersionsTable).where(and(
    eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId),
    eq(masterplanVersionsTable.status, "approved"),
  )).orderBy(desc(masterplanVersionsTable.version)).limit(1);
  return row;
}
export async function getCurrentMasterplan(workspaceId: string, campaignId: string) {
  const [row] = await db.select().from(masterplanVersionsTable).where(and(
    eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId),
  )).orderBy(desc(masterplanVersionsTable.version)).limit(1);
  return row;
}

export async function materializeMasterplan(workspaceId: string, campaignId: string, actorId?: string, requestApproval = false) {
  const [campaign] = await db.select().from(campaignsTable).where(and(
    eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  // Existing unbound campaigns use the active subscription as a safe staged
  // fallback; once bound, a masterplan can never silently switch lineage.
  const [subscription] = await db.select({
    id: commercialSubscriptionsTable.id,
    productId: commercialSubscriptionsTable.productId,
  }).from(commercialSubscriptionsTable).where(and(
    eq(commercialSubscriptionsTable.workspaceId, workspaceId),
    eq(commercialSubscriptionsTable.status, "active"),
  )).limit(1);
  if (!campaign.commercialSubscriptionId && subscription) {
    await db.update(campaignsTable).set({
      commercialSubscriptionId: subscription.id,
      commercialProductId: subscription.productId,
    }).where(eq(campaignsTable.id, campaign.id));
  }
  const boundSubscriptionId = campaign.commercialSubscriptionId ?? subscription?.id ?? null;
  const boundProductId = campaign.commercialProductId ?? subscription?.productId ?? null;
  const pending = await db.select({ id: agentClarificationRequestsTable.id, question: agentClarificationRequestsTable.question })
    .from(agentClarificationRequestsTable).where(and(
      eq(agentClarificationRequestsTable.workspaceId, workspaceId), eq(agentClarificationRequestsTable.campaignId, campaignId),
      eq(agentClarificationRequestsTable.status, "pending"),
    ));
  const memory = object(campaign.memoryData);
  const regionalIntelligence = await latestRegionalIntelligenceSummary(workspaceId, campaignId);
  const snapshot = canonicalize({
    schema: "nexos-masterplan/v1",
    campaign: { id: campaign.id, title: campaign.title, type: campaign.type, track: campaign.track, locale: campaign.locale, timezone: campaign.timezone, durationDays: campaign.durationDays, budgetTotal: campaign.budgetTotal, revenueTarget: campaign.revenueTarget, currentPhase: campaign.currentPhase },
    intake: campaign.intakeData, strategy: campaign.strategyData, offer: campaign.offerData, targeting: campaign.targetingData,
    audience: campaign.audienceData, timeline: campaign.timelineData,
    regionalIntelligence: regionalIntelligence ?? { available: false },
    operatingMemory: { permittedPromises: memory["permittedPromises"], prohibitedClaims: memory["prohibitedClaims"], ethicalBoundaries: memory["ethicalBoundaries"], legalBoundaries: memory["legalBoundaries"], approvedDecisions: memory["approvedDecisions"] },
  });
  const readiness = calculateMasterplanReadiness(campaign.strategyData, pending);
  const { blockers, score, status: readinessStatus } = readiness;
  const contentHash = deterministicHash(snapshot);
  const contextFingerprint = deterministicHash({ contentHash, readinessScore: score, blockers });
  const [latest] = await db.select({ version: masterplanVersionsTable.version, contentHash: masterplanVersionsTable.contentHash })
    .from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId)))
    .orderBy(desc(masterplanVersionsTable.version)).limit(1);
  // Materialization is idempotent while the campaign's canonical data is unchanged.
  if (latest?.contentHash === contentHash) return getCurrentMasterplan(workspaceId, campaignId);
  const [created] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: (latest?.version ?? 0) + 1, status: requestApproval ? "pending_approval" : "draft",
    snapshot, contentHash, contextFingerprint, readinessScore: score, readinessStatus, readinessBlockers: blockers,
    autonomyContract: PRODUCT_AUTONOMY_CONTRACT, allowedActions: ["generate_content", "launch"],
    requiredApprovals: ["masterplan_approval"], createdByUserId: actorId,
    commercialSubscriptionId: boundSubscriptionId,
    commercialProductId: boundProductId,
  }).returning();
  await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.materialized", actor: actorId ?? "system", data: { masterplanId: created!.id, version: created!.version, contentHash, readinessStatus } });
  return created;
}

export async function approveMasterplan(workspaceId: string, campaignId: string, version: number, actorId: string) {
  const [plan] = await db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.version, version))).limit(1);
  if (!plan) throw new NotFoundError("Masterplan");
  if (plan.status === "approved") return plan;
  if (plan.status === "superseded") throw new AppError(409, "Versão do Masterplan já foi substituída.", "MASTERPLAN_SUPERSEDED");
  if (plan.readinessStatus === "blocked") throw new AppError(428, "Masterplan possui bloqueios de readiness.", "MASTERPLAN_NOT_READY", { blockers: plan.readinessBlockers });
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(masterplanVersionsTable).set({ status: "superseded", supersededAt: now }).where(and(
      eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.status, "approved"),
    ));
    await tx.update(masterplanVersionsTable).set({ status: "approved", approvedAt: now, approvedByUserId: actorId }).where(eq(masterplanVersionsTable.id, plan.id));
  });
  const approved = await getApprovedMasterplan(workspaceId, campaignId);
  await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.approved", actor: actorId, data: { masterplanId: plan.id, version, contextFingerprint: plan.contextFingerprint } });
  return approved!;
}