import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, campaignsTable, masterplanVersionsTable, agentClarificationRequestsTable, auditLogsTable, commercialSubscriptionsTable, productIntakesTable } from "@workspace/db";
import { fillMissingCampaignArchitectureFields, fillMissingCampaignCoreFields, fillMissingMasterplanQualityFields, fillMissingTriggerMapFields, missingCampaignArchitectureFields, missingCampaignCoreFields, missingMasterplanQualityFields, missingTriggerMapFields, REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS, REQUIRED_CAMPAIGN_CORE_FIELDS, REQUIRED_MASTERPLAN_QUALITY_FIELDS, REQUIRED_TRIGGER_MAP_FIELDS } from "@workspace/api-zod";
import { NotFoundError, AppError } from "../../lib/errors.js";
import { providerFailureDiagnostics } from "../../lib/provider-failure-diagnostics.js";
import { PRODUCT_AUTONOMY_CONTRACT } from "../autonomy/autonomy.service.js";
import { latestRegionalIntelligenceSummary } from "../market-intel/regional-intelligence.service.js";
import { completeMissingStrategySections } from "../agents/strategy.agent.js";

import { assertPaidMediaApprovalMatchesCampaign, paidMediaSnapshotFields } from "../paid-media/paid-media-setup.service.js";

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
const nonEmptyText = (value: unknown): boolean => typeof value === "string" && value.trim().length >= 3;
const nonEmptyList = (value: unknown): boolean => Array.isArray(value) && value.some((item) => nonEmptyText(item));

/** Unwrap legacy responses that stored the model JSON inside executiveSummary. */
function strategyPayload(value: unknown): Json {
  const source = object(value);
  const summary = source["executiveSummary"];
  if (typeof summary === "string") {
    try {
      const parsed: unknown = JSON.parse(summary.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
      const nested = object(parsed);
      if (["bigDomino", "marketDiagnosis", "offerPositioning", "audienceSegmentation", "campaignArchitecture", "successMetrics", "risks", "triggerMap", "strategistNotes"]
        .some((key) => key in nested)) return { ...source, ...nested };
    } catch { /* malformed/truncated output stays incomplete */ }
  }
  const hasStructuredStrategy = ["bigDomino", "marketDiagnosis", "offerPositioning", "audienceSegmentation", "campaignArchitecture", "successMetrics", "risks", "triggerMap", "strategistNotes"]
    .some((key) => key in source);
  if (hasStructuredStrategy) return source;
  return source;
}

const REQUIRED_STRATEGY_FIELDS: Array<{ path: string; label: string; kind?: "list" | "text" | "number" }> = [
  ...REQUIRED_CAMPAIGN_CORE_FIELDS,
  ...REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS,
  ...REQUIRED_MASTERPLAN_QUALITY_FIELDS,
  ...REQUIRED_TRIGGER_MAP_FIELDS.map((field) => ({ path: `triggerMap.${field.path}`, label: field.label, kind: field.kind })),
];

function getRepairableMissingFields(strategy: Json) {
  const core = missingCampaignCoreFields(strategy);
  const architecture = missingCampaignArchitectureFields(strategy);
  const quality = missingMasterplanQualityFields(strategy);
  const triggers = missingTriggerMapFields(strategy["triggerMap"]).map((field) => ({
    path: `triggerMap.${field.path}`,
    label: field.label,
  }));
  return [...core, ...architecture, ...quality, ...triggers];
}

function repairStagesFor(fields: Array<{ path: string }>): string[] {
  const stages = new Set<string>();
  for (const field of fields) {
    if (field.path.startsWith("offerPositioning.")) stages.add("M03_offer_positioning");
    else if (field.path.startsWith("marketDiagnosis.")) stages.add("M04_market_diagnosis");
    else if (field.path.startsWith("audienceSegmentation.")) stages.add("M05_audience_archetype");
    else if (field.path.startsWith("campaignArchitecture.")) stages.add("M06_campaign_architecture");
    else if (field.path.startsWith("triggerMap.")) stages.add("M07_triggers");
    else if (field.path.startsWith("successMetrics.")) stages.add("M08_metrics");
    else if (field.path.startsWith("risks.")) stages.add("M09_risks");
    else if (field.path === "bigDomino") stages.add("M02_big_domino");
    else if (field.path === "executiveSummary") stages.add("M01_executive_summary");
    else if (field.path === "strategistNotes") stages.add("M10_strategist_notes");
  }
  return [...stages];
}

function actionableRepairProviderError(error: unknown): AppError | null {
  const failure = error && typeof error === "object" ? error as { code?: unknown; attempts?: unknown } : {};
  if (failure.code === "AI_COMPLETION_EXHAUSTED") {
    const attempts = Array.isArray(failure.attempts) ? failure.attempts : [];
    const providers = attempts.flatMap((attempt) => {
      if (!attempt || typeof attempt !== "object") return [];
      const item = attempt as { provider?: unknown; credentialMode?: unknown; reason?: unknown };
      const provider = typeof item.provider === "string" ? item.provider : "unknown";
      const credentialMode = typeof item.credentialMode === "string" ? item.credentialMode : "unknown";
      const diagnostics = providerFailureDiagnostics(new Error(typeof item.reason === "string" ? item.reason : "provider_error"));
      return [{ provider, credentialMode, ...diagnostics }];
    });
    return new AppError(
      503,
      "Ocorreu uma falha na comunicação com os agentes e a correção não foi concluída. Nenhuma alteração foi salva. Tente novamente em alguns minutos. Se o problema persistir, entre em contato com o suporte.",
      "AI_PROVIDERS_UNAVAILABLE",
      { providers },
    );
  }
  if (failure.code === "AI_COMPLETION_UNAVAILABLE") {
    return new AppError(
      503,
      "Ocorreu uma falha na comunicação com os agentes e a correção não foi concluída. Nenhuma alteração foi salva. Tente novamente em alguns minutos. Se o problema persistir, entre em contato com o suporte.",
      "AI_CREDENTIALS_UNAVAILABLE",
    );
  }
  return null;
}

function getPath(source: Json, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => object(current)[key], source);
}

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
  const strategy = strategyPayload(strategyData);
  const incompleteCorePaths = new Set(missingCampaignCoreFields(strategy).map(({ path }) => path));
  const incompleteArchitecturePaths = new Set(missingCampaignArchitectureFields(strategy).map(({ path }) => path));
  const missingFields = REQUIRED_STRATEGY_FIELDS.filter(({ path, kind }) => {
    if (incompleteCorePaths.has(path)) return true;
    if (path.startsWith("campaignArchitecture.")) return incompleteArchitecturePaths.has(path);
    const value = getPath(strategy, path);
    if (kind === "list") return !nonEmptyList(value);
    if (kind === "number") return typeof value !== "number" || !Number.isFinite(value) || value <= 0;
    return !nonEmptyText(value);
  });
  const missingStrategy = missingFields.length > 0;
  const blockers = [
    ...pendingClarifications.map((item) => ({ type: "clarification", id: item.id, message: item.question })),
    ...missingFields.map(({ path, label }) => ({ type: "strategy", id: path, message: `Campo obrigatório ausente: ${label}.` })),
  ];
  const score = Math.round(((REQUIRED_STRATEGY_FIELDS.length - missingFields.length) / REQUIRED_STRATEGY_FIELDS.length) * 100);
  return { blockers, score, status: missingStrategy || pendingClarifications.length ? "blocked" : "ready" };
}

export async function listMasterplanVersions(workspaceId: string, campaignId: string) {
  return db.select().from(masterplanVersionsTable).where(and(
    eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId),
  )).orderBy(desc(masterplanVersionsTable.version));
}
export async function getApprovedMasterplan(workspaceId: string, campaignId: string, query: any = db) {
  const [row] = await query.select().from(masterplanVersionsTable).where(and(
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
  if (!campaign.commercialProductId || !campaign.commercialSubscriptionId || !campaign.productIntakeVersionId) {
    throw new AppError(409, "Campaign requires explicit product adoption and an approved intake before materialization", "PRODUCT_INTAKE_BINDING_REQUIRED");
  }
  const [subscription] = await db.select({
    id: commercialSubscriptionsTable.id,
    productId: commercialSubscriptionsTable.productId,
  }).from(commercialSubscriptionsTable).where(and(
    eq(commercialSubscriptionsTable.id, campaign.commercialSubscriptionId),
    eq(commercialSubscriptionsTable.workspaceId, workspaceId),
    eq(commercialSubscriptionsTable.productId, campaign.commercialProductId),
    eq(commercialSubscriptionsTable.status, "active"),
  )).limit(1);
  if (!subscription) throw new AppError(409, "Campaign subscription does not belong to its workspace/product", "PRODUCT_SUBSCRIPTION_MISMATCH");
  const [intake] = await db.select()
    .from(productIntakesTable).where(and(
      eq(productIntakesTable.id, campaign.productIntakeVersionId),
      eq(productIntakesTable.workspaceId, workspaceId),
      eq(productIntakesTable.commercialProductId, campaign.commercialProductId),
    )).limit(1);
  if (!intake || (intake.status !== "approved" && intake.status !== "locked")) {
    throw new AppError(409, "Campaign must bind an approved product intake version", "PRODUCT_INTAKE_NOT_APPROVED");
  }
  const boundSubscriptionId = campaign.commercialSubscriptionId;
  const boundProductId = campaign.commercialProductId;
  const pending = await db.select({ id: agentClarificationRequestsTable.id, question: agentClarificationRequestsTable.question })
    .from(agentClarificationRequestsTable).where(and(
      eq(agentClarificationRequestsTable.workspaceId, workspaceId), eq(agentClarificationRequestsTable.campaignId, campaignId),
      eq(agentClarificationRequestsTable.status, "pending"),
    ));
  const memory = object(campaign.memoryData);
  const regionalIntelligence = await latestRegionalIntelligenceSummary(workspaceId, campaignId);
  const paidMedia = paidMediaSnapshotFields(campaign.strategyData, campaign.intakeData);
  const snapshot = canonicalize({
    schema: "nexos-masterplan/v1",
    campaign: { id: campaign.id, title: campaign.title, type: campaign.type, track: campaign.track, locale: campaign.locale, timezone: campaign.timezone, durationDays: campaign.durationDays, budgetTotal: campaign.budgetTotal, revenueTarget: campaign.revenueTarget, currentPhase: campaign.currentPhase, ...paidMedia.schedule },
     intake: intake.snapshot, intakeVersionId: intake.id, strategy: paidMedia.strategy, offer: campaign.offerData, targeting: campaign.targetingData,
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
  if (latest?.contentHash === contentHash) {
    const current = await getCurrentMasterplan(workspaceId, campaignId);
    if (current?.status !== "superseded") return current;
  }
  const [created] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: (latest?.version ?? 0) + 1, status: requestApproval ? "pending_approval" : "draft",
    snapshot, contentHash, contextFingerprint, readinessScore: score, readinessStatus, readinessBlockers: blockers,
    autonomyContract: PRODUCT_AUTONOMY_CONTRACT, allowedActions: ["generate_content", "launch"],
    requiredApprovals: ["masterplan_approval"], createdByUserId: actorId,
    commercialSubscriptionId: boundSubscriptionId,
    commercialProductId: boundProductId,
     productIntakeVersionId: campaign.productIntakeVersionId,
  }).returning();
  await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.materialized", actor: actorId ?? "system", data: { masterplanId: created!.id, version: created!.version, contentHash, readinessStatus } });
  return created;
}

/** Revisions an existing legacy masterplan without inventing a product-intake binding. */
async function materializeLegacyTriggerRepair(workspaceId: string, campaignId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [campaign] = await tx.select().from(campaignsTable).where(and(
      eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
    )).for("update").limit(1);
    if (!campaign) throw new NotFoundError("Campaign");
    const [latest] = await tx.select().from(masterplanVersionsTable).where(and(
      eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId),
    )).orderBy(desc(masterplanVersionsTable.version)).limit(1).for("update");
    // A legacy campaign can still have its saved strategy repaired even if it
    // predates Masterplan versioning. Do not fabricate a product/intake binding
    // or fail after the strategy fields have already been safely persisted.
    if (!latest) return null;

    const pending = await tx.select({ id: agentClarificationRequestsTable.id, question: agentClarificationRequestsTable.question })
      .from(agentClarificationRequestsTable).where(and(
        eq(agentClarificationRequestsTable.workspaceId, workspaceId), eq(agentClarificationRequestsTable.campaignId, campaignId),
        eq(agentClarificationRequestsTable.status, "pending"),
      ));
    const previousSnapshot = object(latest.snapshot);
    const currentStrategy = strategyPayload(campaign.strategyData);
    const paidMedia = paidMediaSnapshotFields(currentStrategy, campaign.intakeData);
    const snapshot = canonicalize({ ...previousSnapshot, strategy: paidMedia.strategy });
    const readiness = calculateMasterplanReadiness(campaign.strategyData, pending);
    const contentHash = deterministicHash(snapshot);
    const contextFingerprint = deterministicHash({ contentHash, readinessScore: readiness.score, blockers: readiness.blockers });
    const [created] = await tx.insert(masterplanVersionsTable).values({
      workspaceId,
      campaignId,
      version: latest.version + 1,
      status: "pending_approval",
      snapshot,
      contentHash,
      contextFingerprint,
      readinessScore: readiness.score,
      readinessStatus: readiness.status,
      readinessBlockers: readiness.blockers,
      autonomyContract: latest.autonomyContract,
      allowedActions: latest.allowedActions,
      requiredApprovals: latest.requiredApprovals,
      commercialSubscriptionId: latest.commercialSubscriptionId,
      commercialProductId: latest.commercialProductId,
      productIntakeVersionId: latest.productIntakeVersionId,
      createdByUserId: actorId,
    }).returning();
    await tx.insert(auditLogsTable).values({
      workspaceId, campaignId, action: "masterplan.legacy_trigger_repair_materialized", actor: actorId,
      data: { masterplanId: created!.id, version: created!.version, readinessStatus: readiness.status },
    });
    return created!;
  });
}

async function materializeTriggerRepairVersion(
  workspaceId: string,
  campaignId: string,
  actorId: string,
  campaign: typeof campaignsTable.$inferSelect,
) {
  if (campaign.commercialProductId && campaign.commercialSubscriptionId && campaign.productIntakeVersionId) {
    return materializeMasterplan(workspaceId, campaignId, actorId, true);
  }
  return materializeLegacyTriggerRepair(workspaceId, campaignId, actorId);
}

/** Completes missing or visibly truncated M06-M09 fields, preserving existing content. */
export async function repairMasterplanTriggerMap(workspaceId: string, campaignId: string, actorId: string, log: any) {
  const [campaign] = await db.select().from(campaignsTable).where(and(
    eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  if (!["strategy_ready", "awaiting_approval"].includes(campaign.status)) {
    throw new AppError(409, "As seções só podem ser completadas enquanto o Masterplan aguarda revisão.", "MASTERPLAN_REPAIR_NOT_AVAILABLE");
  }

  const originalStrategy = strategyPayload(campaign.strategyData);
  const missingBefore = getRepairableMissingFields(originalStrategy);
  const initialStages = repairStagesFor(missingBefore);
  const repairContext = {
    operation: "masterplan_section_repair",
    campaignId,
    campaignTitle: campaign.title,
    workspaceId,
    actorUserId: actorId,
    repairStages: initialStages,
    repairFields: missingBefore.map((field) => field.path),
  };
  log.info(repairContext, "Masterplan section repair started");
  if (!missingBefore.length) {
    const masterplan = await materializeTriggerRepairVersion(workspaceId, campaignId, actorId, campaign);
    const readiness = calculateMasterplanReadiness(originalStrategy, []);
    return { masterplan, repairedFields: [], readiness: masterplan
      ? { status: masterplan.readinessStatus, score: masterplan.readinessScore, blockers: masterplan.readinessBlockers }
      : readiness };
  }

  let proposedStrategy = originalStrategy;
  let proposedMissing = missingBefore;
  let repairAttempts = 0;
  while (proposedMissing.length > 0 && repairAttempts < 2) {
    repairAttempts += 1;
    const attemptLog = typeof log.child === "function"
      ? log.child({ ...repairContext, attempt: repairAttempts, repairStages: repairStagesFor(proposedMissing), repairFields: proposedMissing.map((field) => field.path) })
      : log;
    try {
      proposedStrategy = await completeMissingStrategySections(
        campaignId,
        workspaceId,
        object(campaign.intakeData),
        proposedStrategy,
        attemptLog,
        repairAttempts,
      );
    } catch (error) {
      const actionableError = actionableRepairProviderError(error);
      if (actionableError) throw actionableError;
      throw error;
    }
    proposedMissing = getRepairableMissingFields(proposedStrategy);
  }
  if (proposedMissing.length) {
    const blockers = proposedMissing;
    await db.insert(auditLogsTable).values({
      workspaceId, campaignId, action: "masterplan.sections_repair_failed", actor: actorId,
      data: { attempts: repairAttempts, missingFields: blockers.map((field) => field.path) },
    });
    const pendingLabels = blockers.map((field) => field.label).join(", ");
    throw new AppError(422, `A IA não conseguiu completar todas as seções após ${repairAttempts} tentativas. Ainda falta: ${pendingLabels}. O Masterplan continua bloqueado; você pode tentar novamente.`, "MASTERPLAN_SECTIONS_INCOMPLETE", { blockers, attempts: repairAttempts });
  }

  const repairedFields: string[] = [];
  const strategyValidation = { triggerMapStatus: "complete", triggerMapAttempts: repairAttempts, missingTriggerFields: [], qualitySectionsStatus: "complete", missingQualityFields: [], architectureStatus: "complete", missingArchitectureFields: [], coreStatus: "complete", missingCoreFields: [] };
  let repairedStrategyForReadiness = originalStrategy;
  await db.transaction(async (tx) => {
    const [currentCampaign] = await tx.select({ strategyData: campaignsTable.strategyData, intakeData: campaignsTable.intakeData, status: campaignsTable.status })
      .from(campaignsTable).where(and(
        eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
      )).for("update").limit(1);
    if (!currentCampaign) throw new NotFoundError("Campaign");
    if (!["strategy_ready", "awaiting_approval"].includes(currentCampaign.status)) {
      throw new AppError(409, "A campanha mudou de etapa. Atualize a página antes de completar as seções do Masterplan.", "TRIGGER_MAP_REPAIR_NOT_AVAILABLE");
    }
    const currentStrategy = strategyPayload(currentCampaign.strategyData);
    const stillMissing = getRepairableMissingFields(currentStrategy);
    const coreFields = missingCampaignCoreFields(currentStrategy);
    const architectureFields = missingCampaignArchitectureFields(currentStrategy);
    const triggerFields = missingTriggerMapFields(currentStrategy["triggerMap"]);
    const qualityFields = missingMasterplanQualityFields(currentStrategy);
    const repairedCore = fillMissingCampaignCoreFields(currentStrategy, proposedStrategy, coreFields);
    const repairedArchitecture = fillMissingCampaignArchitectureFields(currentStrategy, proposedStrategy, architectureFields);
    const repairedMap = fillMissingTriggerMapFields(currentStrategy["triggerMap"], proposedStrategy["triggerMap"], triggerFields);
    const repairedQuality = fillMissingMasterplanQualityFields(currentStrategy, proposedStrategy, qualityFields);
    const repairedStrategy = { ...currentStrategy, ...repairedCore, campaignArchitecture: repairedArchitecture["campaignArchitecture"], triggerMap: repairedMap, successMetrics: repairedQuality["successMetrics"], risks: repairedQuality["risks"] };
    const remaining = getRepairableMissingFields(repairedStrategy);
    if (remaining.length) {
      throw new AppError(409, "Os dados da campanha mudaram durante a correção. Atualize e tente novamente.", "MASTERPLAN_REPAIR_CONFLICT");
    }
    repairedFields.push(...stillMissing.map((field) => field.path));
    repairedStrategyForReadiness = repairedStrategy;
    await tx.update(campaignsTable).set({
      strategyData: { ...repairedStrategy, strategyValidation } as any,
      updatedAt: new Date(),
    }).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
  });

  const masterplan = await materializeTriggerRepairVersion(workspaceId, campaignId, actorId, campaign);
  const readiness = calculateMasterplanReadiness(repairedStrategyForReadiness, []);
  await db.insert(auditLogsTable).values({
    workspaceId, campaignId, action: "masterplan.sections_repaired", actor: actorId,
    data: { fields: repairedFields, masterplanId: masterplan?.id, readinessStatus: masterplan?.readinessStatus },
  });
  return { masterplan, repairedFields, readiness: masterplan
    ? { status: masterplan.readinessStatus, score: masterplan.readinessScore, blockers: masterplan.readinessBlockers }
    : readiness };
}

export async function approveMasterplan(workspaceId: string, campaignId: string, version: number, actorId: string) {
  const [plan] = await db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.version, version))).limit(1);
  if (!plan) throw new NotFoundError("Masterplan");
  if (plan.status === "approved") return plan;
  if (plan.status === "superseded") throw new AppError(409, "Versão do Masterplan já foi substituída.", "MASTERPLAN_SUPERSEDED");
  const now = new Date();
  await db.transaction(async (tx) => {
    // Serialize with executable briefing edits. Re-read after taking the same
    // campaign lock so a concurrent approval cannot resurrect a stale version.
    const [campaign] = await tx.select({ strategyData: campaignsTable.strategyData, intakeData: campaignsTable.intakeData }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).for("update").limit(1);
    const [current] = await tx.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.id, plan.id), eq(masterplanVersionsTable.workspaceId, workspaceId))).limit(1);
    if (!campaign || !current || current.status === "superseded") throw new AppError(409, "Versão do Master Plan substituída; atualize antes de aprovar.", "MASTERPLAN_SUPERSEDED");
    const pending = await tx.select({ id: agentClarificationRequestsTable.id, question: agentClarificationRequestsTable.question })
      .from(agentClarificationRequestsTable).where(and(
        eq(agentClarificationRequestsTable.workspaceId, workspaceId),
        eq(agentClarificationRequestsTable.campaignId, campaignId),
        eq(agentClarificationRequestsTable.status, "pending"),
      ));
    const readiness = calculateMasterplanReadiness(campaign.strategyData, pending);
    if (readiness.status !== "ready") {
      throw new AppError(428, "Masterplan incompleto. Preencha todos os módulos obrigatórios antes de aprovar.", "MASTERPLAN_NOT_READY", { blockers: readiness.blockers, score: readiness.score });
    }
    assertPaidMediaApprovalMatchesCampaign(campaign.strategyData, campaign.intakeData, current.snapshot);
    await tx.update(masterplanVersionsTable).set({ status: "superseded", supersededAt: now }).where(and(
      eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.status, "approved"),
    ));
    await tx.update(masterplanVersionsTable).set({ status: "approved", approvedAt: now, approvedByUserId: actorId }).where(eq(masterplanVersionsTable.id, plan.id));
  });
  const approved = await getApprovedMasterplan(workspaceId, campaignId);
  await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.approved", actor: actorId, data: { masterplanId: plan.id, version, contextFingerprint: plan.contextFingerprint } });
  return approved!;
}
