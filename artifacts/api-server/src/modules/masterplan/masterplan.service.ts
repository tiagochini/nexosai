import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, campaignsTable, masterplanVersionsTable, agentClarificationRequestsTable, auditLogsTable, commercialSubscriptionsTable, productIntakesTable } from "@workspace/db";
import { fillMissingTriggerMapFields, missingTriggerMapFields, REQUIRED_TRIGGER_MAP_FIELDS } from "@workspace/api-zod";
import { NotFoundError, AppError } from "../../lib/errors.js";
import { PRODUCT_AUTONOMY_CONTRACT } from "../autonomy/autonomy.service.js";
import { latestRegionalIntelligenceSummary } from "../market-intel/regional-intelligence.service.js";
import { completeMissingTriggerMap } from "../agents/strategy.agent.js";

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
  { path: "executiveSummary", label: "Resumo executivo" },
  { path: "bigDomino", label: "Big Domino" },
  { path: "marketDiagnosis.marketMaturity", label: "Maturidade do mercado" },
  { path: "marketDiagnosis.competitiveLandscape", label: "Cenário competitivo" },
  { path: "marketDiagnosis.entryBarriers", label: "Barreiras de entrada", kind: "list" },
  { path: "marketDiagnosis.opportunities", label: "Oportunidades", kind: "list" },
  { path: "marketDiagnosis.threats", label: "Ameaças", kind: "list" },
  { path: "offerPositioning.uniqueValueProposition", label: "Proposta de valor" },
  { path: "offerPositioning.primaryDifferentiator", label: "Diferencial principal" },
  { path: "offerPositioning.positioning", label: "Posicionamento" },
  { path: "offerPositioning.priceJustification", label: "Justificativa de preço" },
  { path: "offerPositioning.competitiveAdvantages", label: "Vantagens competitivas", kind: "list" },
  { path: "audienceSegmentation.primaryAvatar", label: "Avatar principal" },
  { path: "audienceSegmentation.psychographicProfile", label: "Perfil psicográfico" },
  { path: "audienceSegmentation.buyingTriggers", label: "Gatilhos de compra", kind: "list" },
  { path: "audienceSegmentation.objections", label: "Objeções", kind: "list" },
  { path: "audienceSegmentation.sophisticationStrategy", label: "Estratégia de sofisticação" },
  { path: "campaignArchitecture.coreNarrative", label: "Narrativa central" },
  { path: "campaignArchitecture.emotionalHook", label: "Gancho emocional" },
  { path: "campaignArchitecture.keyMessages", label: "Mensagens-chave", kind: "list" },
  { path: "campaignArchitecture.contentPillars", label: "Pilares de conteúdo", kind: "list" },
  { path: "campaignArchitecture.platformDistributionStrategy", label: "Distribuição por plataforma" },
  { path: "campaignArchitecture.callToActionStrategy", label: "Estratégia de chamada para ação" },
  { path: "successMetrics.primaryKPI", label: "KPI principal" },
  { path: "successMetrics.conversionRateTarget", label: "Meta de conversão", kind: "number" },
  { path: "successMetrics.launchWindow", label: "Janela da campanha" },
  { path: "successMetrics.criticalAssumptions", label: "Premissas críticas", kind: "list" },
  { path: "risks.level", label: "Nível de risco" },
  { path: "risks.mainRisks", label: "Riscos principais", kind: "list" },
  { path: "risks.mitigations", label: "Mitigações", kind: "list" },
  { path: "strategistNotes", label: "Observações do estrategista" },
  ...REQUIRED_TRIGGER_MAP_FIELDS.map((field) => ({ path: `triggerMap.${field.path}`, label: field.label, kind: field.kind })),
];

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
  const missingFields = REQUIRED_STRATEGY_FIELDS.filter(({ path, kind }) => {
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

/** Completes only missing trigger-map fields, retaining the existing strategy and generated assets. */
export async function repairMasterplanTriggerMap(workspaceId: string, campaignId: string, actorId: string, log: any) {
  const [campaign] = await db.select().from(campaignsTable).where(and(
    eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  if (!["strategy_ready", "awaiting_approval"].includes(campaign.status)) {
    throw new AppError(409, "Os gatilhos só podem ser completados enquanto o Masterplan aguarda revisão.", "TRIGGER_MAP_REPAIR_NOT_AVAILABLE");
  }

  const originalStrategy = strategyPayload(campaign.strategyData);
  const originalMap = object(originalStrategy["triggerMap"]);
  const missingBefore = missingTriggerMapFields(originalMap);
  if (!missingBefore.length) {
    const masterplan = await materializeMasterplan(workspaceId, campaignId, actorId, true);
    return { masterplan, repairedFields: [], readiness: { status: masterplan?.readinessStatus, score: masterplan?.readinessScore, blockers: masterplan?.readinessBlockers } };
  }

  let proposedMap = originalMap;
  let proposedMissing = missingBefore;
  let repairAttempts = 0;
  while (proposedMissing.length > 0 && repairAttempts < 2) {
    repairAttempts += 1;
    proposedMap = await completeMissingTriggerMap(
      campaignId,
      workspaceId,
      object(campaign.intakeData),
      { ...originalStrategy, triggerMap: proposedMap },
      log,
      repairAttempts,
    );
    proposedMissing = missingTriggerMapFields(proposedMap);
  }
  if (proposedMissing.length) {
    const blockers = proposedMissing.map((field) => ({ path: `triggerMap.${field.path}`, label: field.label }));
    await db.insert(auditLogsTable).values({
      workspaceId, campaignId, action: "masterplan.trigger_map_repair_failed", actor: actorId,
      data: { attempts: repairAttempts, missingFields: blockers.map((field) => field.path) },
    });
    const pendingLabels = blockers.map((field) => field.label).join(", ");
    throw new AppError(422, `A IA não conseguiu preencher todos os itens após ${repairAttempts} tentativas. Ainda falta: ${pendingLabels}. O Masterplan continua bloqueado; você pode tentar novamente.`, "TRIGGER_MAP_INCOMPLETE", { blockers, attempts: repairAttempts });
  }

  const repairedFields: string[] = [];
  const strategyValidation = { triggerMapStatus: "complete", triggerMapAttempts: repairAttempts, missingTriggerFields: [] };
  await db.transaction(async (tx) => {
    const [currentCampaign] = await tx.select({ strategyData: campaignsTable.strategyData, intakeData: campaignsTable.intakeData, status: campaignsTable.status })
      .from(campaignsTable).where(and(
        eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
      )).for("update").limit(1);
    if (!currentCampaign) throw new NotFoundError("Campaign");
    if (!["strategy_ready", "awaiting_approval"].includes(currentCampaign.status)) {
      throw new AppError(409, "A campanha mudou de etapa. Atualize a página antes de completar os gatilhos.", "TRIGGER_MAP_REPAIR_NOT_AVAILABLE");
    }
    const currentStrategy = strategyPayload(currentCampaign.strategyData);
    const currentMap = object(currentStrategy["triggerMap"]);
    const stillMissing = missingTriggerMapFields(currentMap);
    const repairedMap = fillMissingTriggerMapFields(currentMap, proposedMap, stillMissing);
    const remaining = missingTriggerMapFields(repairedMap);
    if (remaining.length) {
      throw new AppError(409, "Os dados da campanha mudaram durante a correção. Atualize e tente novamente.", "TRIGGER_MAP_CHANGED");
    }
    repairedFields.push(...stillMissing.map((field) => `triggerMap.${field.path}`));
    await tx.update(campaignsTable).set({
      strategyData: { ...currentStrategy, triggerMap: repairedMap, strategyValidation } as any,
      updatedAt: new Date(),
    }).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
  });

  const masterplan = await materializeMasterplan(workspaceId, campaignId, actorId, true);
  await db.insert(auditLogsTable).values({
    workspaceId, campaignId, action: "masterplan.trigger_map_repaired", actor: actorId,
    data: { fields: repairedFields, masterplanId: masterplan?.id, readinessStatus: masterplan?.readinessStatus },
  });
  return { masterplan, repairedFields, readiness: { status: masterplan?.readinessStatus, score: masterplan?.readinessScore, blockers: masterplan?.readinessBlockers } };
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
