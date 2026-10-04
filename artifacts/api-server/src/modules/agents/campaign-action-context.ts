/**
 * Tenant-scoped, canonical campaign facts for runAgent().
 *
 * Keep direct SDK callers out of scope for this pass: see the runAgent TODO in
 * agent.runner.ts. New campaign-aware agents must use runAgent rather than
 * assembling this context themselves.
 */
import { createHash } from "node:crypto";
import { logger } from "../../lib/logger.js";
import { and, eq, desc } from "drizzle-orm";
import { db, campaignsTable, agentClarificationRequestsTable, marketIntelReportsTable } from "@workspace/db";
import type { AgentRole } from "../ai-gateway/ai-gateway.service.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { latestRegionalIntelligenceSummary } from "../market-intel/regional-intelligence.service.js";

export interface CampaignActionContext {
  block: string;
  metadata: {
    contextVersion: "campaign-action-context/v1";
    fingerprint: string;
    sections: string[];
    truncated: boolean;
    builtAt: string;
    marketReport?: { id: string; source: string; updatedAt: string; fingerprint: string };
  };
}

const TOTAL_LIMIT = 11_000;
const SECTION_LIMIT = 1_500;
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: CampaignActionContext }>();

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonicalize(v)]));
  }
  return value;
}

export function fingerprintMarketReport(report: {
  id: string;
  source: string;
  updatedAt: Date | string;
  output: unknown;
}): string {
  return createHash("sha256").update(JSON.stringify(canonicalize({
    id: report.id,
    source: report.source,
    updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
    output: report.output,
  }))).digest("hex");
}

export function fingerprintCampaignPerformanceFeedback(value: unknown): string | undefined {
  const feedback = asObject(value);
  return Object.keys(feedback).length > 0
    ? createHash("sha256").update(JSON.stringify(canonicalize(feedback))).digest("hex")
    : undefined;
}

function compact(value: unknown, max = SECTION_LIMIT): { text: string; truncated: boolean } {
  const text = JSON.stringify(canonicalize(value), null, 2).replace(/\s+\n/g, "\n").trim();
  return text.length > max ? { text: `${text.slice(0, max - 18)}\n…[truncated]`, truncated: true } : { text, truncated: false };
}

const ROLE_SECTIONS: Record<string, string[]> = {
  compliance: ["objective", "constraints", "offer_psychology", "decisions", "clarifications"],
  media_buyer: ["objective", "market", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  // Competitive regional intelligence is bounded in the market section and is
  // deliberately available to every social/content/launch/paid-media executor.
  social_media: ["objective", "market", "strategy", "offer_psychology", "launch", "constraints", "decisions"],
  presence_planner: ["objective", "market", "strategy", "offer_psychology", "launch", "constraints", "decisions"],
  content_calendar: ["objective", "market", "strategy", "offer_psychology", "launch", "constraints", "decisions"],
  launch_manager: ["objective", "market", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  perpetual_launch_manager: ["objective", "market", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  targeting: ["objective", "market", "strategy", "constraints", "clarifications"],
  market_intel: ["objective", "market", "strategy", "constraints"],
  profile_builder: ["objective", "market", "constraints", "clarifications"],
  sales_consultant: ["objective", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions", "clarifications"],
  sales_warmer: ["objective", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  sales_desire: ["objective", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  sales_closer: ["objective", "strategy", "offer_psychology", "sales", "launch", "constraints", "decisions"],
  sales_objection: ["objective", "strategy", "offer_psychology", "sales", "constraints", "decisions", "clarifications"],
  art_direction: ["objective", "strategy", "offer_psychology", "launch", "constraints", "decisions"],
  wardrobe_appearance: ["objective", "strategy", "constraints", "decisions"],
  performance_voice: ["objective", "strategy", "offer_psychology", "sales", "constraints", "decisions"],
  sound_design: ["objective", "strategy", "launch", "constraints"],
  editor: ["objective", "strategy", "launch", "constraints", "decisions"],
  color_continuity: ["objective", "strategy", "constraints"],
  av_qc: ["objective", "strategy", "launch", "constraints", "decisions", "clarifications"],
};

const DEFAULT_SECTIONS = ["objective", "market", "strategy", "offer_psychology", "launch", "constraints", "decisions", "clarifications"];
export function campaignContextPreamble(hasApprovedMasterplan: boolean): string {
  const header = "## CONTEXTO DE AÇÃO DA CAMPANHA — FONTE CANÔNICA\n\n> Precedência: Masterplan aprovado > contexto de ação da campanha > contexto do chamador > doutrina genérica.\n> Use somente estes fatos persistidos; não invente nem substitua decisões aprovadas.\n\n";
  return hasApprovedMasterplan ? header : `${header}> FALLBACK LEGADO EXPLÍCITO: não há Masterplan aprovado; contexto abaixo é derivado dos dados legados da campanha.\n\n`;
}

function unavailable(reason: string): CampaignActionContext {
  const block = `## CONTEXTO DE AÇÃO DA CAMPANHA — INDISPONÍVEL\n\n${reason}\nNão infira nem use dados de outra campanha.\n\n---\n`;
  return {
    block,
    metadata: {
      contextVersion: "campaign-action-context/v1",
      fingerprint: createHash("sha256").update(block).digest("hex"),
      sections: [],
      truncated: false,
      builtAt: new Date().toISOString(),
    },
  };
}

/** Reads only a campaign owned by workspaceId; a caller can never select another tenant's campaign. */
export async function buildCampaignActionContext(
  campaignId: string | null | undefined,
  workspaceId: string,
  agentRole: AgentRole,
): Promise<CampaignActionContext> {
  if (!campaignId) return unavailable("Nenhuma campanha foi fornecida para esta execução.");

  const [campaign] = await db.select({
    id: campaignsTable.id, workspaceId: campaignsTable.workspaceId, title: campaignsTable.title,
    type: campaignsTable.type, status: campaignsTable.status, currentPhase: campaignsTable.currentPhase,
    durationDays: campaignsTable.durationDays, budgetTotal: campaignsTable.budgetTotal,
    revenueTarget: campaignsTable.revenueTarget, locale: campaignsTable.locale, timezone: campaignsTable.timezone,
    intakeData: campaignsTable.intakeData, strategyData: campaignsTable.strategyData,
    timelineData: campaignsTable.timelineData, offerData: campaignsTable.offerData,
    targetingData: campaignsTable.targetingData, audienceData: campaignsTable.audienceData,
    memoryData: campaignsTable.memoryData, brainData: campaignsTable.brainData, updatedAt: campaignsTable.updatedAt,
  }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);

  if (!campaign) {
    // Intentionally no unscoped lookup: this is both missing and cross-tenant safe.
    logger.warn({ campaignId, workspaceId, agentRole }, "SECURITY_CAMPAIGN_CONTEXT_MISMATCH");
    return unavailable("A campanha não existe neste workspace ou não está disponível.");
  }

  const approvedMasterplan = await getApprovedMasterplan(workspaceId, campaignId);
  const [marketReport] = await db.select().from(marketIntelReportsTable).where(and(
    eq(marketIntelReportsTable.workspaceId, workspaceId),
    eq(marketIntelReportsTable.campaignId, campaignId),
    eq(marketIntelReportsTable.status, "ready"),
  )).orderBy(desc(marketIntelReportsTable.updatedAt), desc(marketIntelReportsTable.createdAt)).limit(1);
  const marketFingerprint = marketReport ? fingerprintMarketReport(marketReport) : undefined;
  // Explicit null is retained below: regional monitoring is optional, never inferred.
  const regionalIntelligence = await latestRegionalIntelligenceSummary(workspaceId, campaignId);
  const memory = asObject(campaign.memoryData);
  const brain = asObject(campaign.brainData);
  const performanceFeedback = asObject(brain["trafficLearnings"]);
  const performanceFeedbackFingerprint = fingerprintCampaignPerformanceFeedback(performanceFeedback);
  const sourceVersion = `${campaign.updatedAt.toISOString()}:${String(memory.version ?? "")}:${approvedMasterplan?.contextFingerprint ?? "legacy"}:${marketReport?.id ?? "none"}:${marketReport?.updatedAt.toISOString() ?? ""}:${marketFingerprint ?? ""}:${performanceFeedbackFingerprint ?? ""}`;
  const key = `${workspaceId}:${campaignId}:${agentRole}:${sourceVersion}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const intake = asObject(campaign.intakeData);
  // An approved Masterplan is the immutable operating contract. Legacy campaigns
  // deliberately retain the prior assembled context until a version exists.
  const answered = await db.select({
    agentRole: agentClarificationRequestsTable.agentRole,
    question: agentClarificationRequestsTable.question,
    answer: agentClarificationRequestsTable.answer,
  }).from(agentClarificationRequestsTable).where(and(
    eq(agentClarificationRequestsTable.workspaceId, workspaceId),
    eq(agentClarificationRequestsTable.campaignId, campaignId),
    eq(agentClarificationRequestsTable.status, "answered"),
  )).limit(12);

  const source: Record<string, unknown> = {
    masterplan: approvedMasterplan ? {
      version: approvedMasterplan.version,
      contentHash: approvedMasterplan.contentHash,
      contextFingerprint: approvedMasterplan.contextFingerprint,
      readiness: { score: approvedMasterplan.readinessScore, status: approvedMasterplan.readinessStatus, blockers: approvedMasterplan.readinessBlockers },
      allowedActions: approvedMasterplan.allowedActions,
      requiredApprovals: approvedMasterplan.requiredApprovals,
      snapshot: approvedMasterplan.snapshot,
    } : undefined,
    objective: { campaign: { title: campaign.title, type: campaign.type, status: campaign.status, locale: campaign.locale }, intake },
    strategy: campaign.strategyData,
    market: {
      targeting: campaign.targetingData,
      audience: campaign.audienceData,
      profile: brain["profileData"],
      regionalIntelligence: regionalIntelligence ?? { available: false },
      marketIntel: marketReport ? {
        id: marketReport.id,
        source: marketReport.source,
        updatedAt: marketReport.updatedAt.toISOString(),
        fingerprint: marketFingerprint,
        output: marketReport.output,
      } : { available: false },
      performanceFeedback: performanceFeedbackFingerprint ? {
        fingerprint: performanceFeedbackFingerprint,
        evidenceType: "observed_campaign_performance",
        learnings: performanceFeedback,
        governance: "Evidência para novas análises e decisões; não altera intake, estratégia ou relatório-fonte automaticamente.",
      } : { available: false },
    },
    offer_psychology: { offer: campaign.offerData, psychology: brain["offerPsychologyLayer"] },
    sales: { salesContext: brain["salesContext"], channel: intake["campaign.salesChannel"] },
    launch: { currentPhase: campaign.currentPhase, durationDays: campaign.durationDays, budgetTotal: campaign.budgetTotal, revenueTarget: campaign.revenueTarget, timezone: campaign.timezone, launchPlan: brain["launchPlan"] ?? campaign.timelineData },
    constraints: {
      hardConstraints: intake["hardConstraints"], compliance: intake["compliance"],
      permittedPromises: memory.permittedPromises, prohibitedClaims: memory.prohibitedClaims,
      ethicalBoundaries: memory.ethicalBoundaries, legalBoundaries: memory.legalBoundaries,
      complianceRules: memory.complianceRules, warnings: memory.coreWarnings,
    },
    clarifications: answered.map((r) => ({ agentRole: r.agentRole, question: r.question, answer: r.answer })),
    decisions: { approved: Array.isArray(memory.approvedDecisions) ? memory.approvedDecisions.slice(-8) : [], relevantMemory: Array.isArray(memory.campaignLearnings) ? memory.campaignLearnings.slice(-5) : [] },
  };

  const requested = approvedMasterplan
    ? ["masterplan", ...(ROLE_SECTIONS[agentRole] ?? DEFAULT_SECTIONS)]
    : ROLE_SECTIONS[agentRole] ?? DEFAULT_SECTIONS;
  const sections: string[] = [];
  let truncated = false;
  let body = campaignContextPreamble(Boolean(approvedMasterplan));
  for (const name of requested) {
    const value = source[name];
    if (value === undefined || (typeof value === "object" && Object.keys(asObject(value)).length === 0)) continue;
    const clipped = compact(value);
    const section = `### ${name.toUpperCase()}\n${clipped.text}\n\n`;
    if (body.length + section.length + 5 > TOTAL_LIMIT) { truncated = true; break; }
    body += section;
    sections.push(name);
    truncated ||= clipped.truncated;
  }
  body += "---\n";
  const fingerprint = createHash("sha256").update(JSON.stringify(canonicalize({ sourceVersion, agentRole, sections, body }))).digest("hex");
  const value = { block: body, metadata: { contextVersion: "campaign-action-context/v1" as const, fingerprint, sections, truncated, builtAt: new Date().toISOString(), ...(marketReport && marketFingerprint ? { marketReport: { id: marketReport.id, source: marketReport.source, updatedAt: marketReport.updatedAt.toISOString(), fingerprint: marketFingerprint } } : {}) } };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
