/**
 * Campaign Brain — Verdade Oficial Centralizada
 *
 * É a "single source of truth" da campanha.
 * Todos os agentes leem daqui. Construída a partir dos outputs dos agentes
 * de estratégia e atualizada continuamente ao longo do ciclo de vida.
 *
 * Integration points:
 *  - Built: command.agent.ts (setImmediate após pipeline de estratégia)
 *  - Read: agent.runner.ts (injetado no systemPrompt via memoryContext)
 *  - Updated: metrics.service.ts (traffic learnings), content.routes.ts (contradictions)
 */

import { db, campaignsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ICPProfile {
  description:         string;
  painPoints:          string[];
  desires:             string[];
  sophisticationLevel: string; // problem_unaware / solution_aware / product_aware / most_aware
  decisionMaker:       string;
  awarenessScore:      number; // 0-5 Schwartz
}

export interface OfferProfile {
  name:            string;
  price:           number;
  pricingModel:    string;
  uniqueMechanism: string;
  guarantee:       string;
  positioning:     string; // premium / mid-market / accessible / commodity
  perceivedValue:  string; // high / medium / low
}

export interface NarrativeProfile {
  tone:              string;
  dominantEmotion:   string;
  emotionalSequence: string[];
  centralNarrative:  string;
  bigDomino:         string;
  permittedClaims:   string[];
  forbiddenTopics:   string[];
}

export interface AlignmentState {
  score:              number; // 0-100
  criticalConflicts:  string[];
  warnings:           string[];
  dimensions: {
    icp:               number;
    tone:              number;
    awarenessLevel:    number;
    mechanism:         number;
    positioning:       number;
    promise:           number;
    pricingPerception: number;
    emotionalCoherence:number;
  };
  isMisaligned: boolean;
  checkedAt:    string;
}

export interface TrafficLearnings {
  winningHooks:          string[];
  losingHooks:           string[];
  bestPerformingAngles:  string[];
  avgCTR:                number;
  avgCPM:                number;
  peakCTR:               number;
  fatigueSignals:        string[];
  hookPerformance:       Array<{ hook: string; ctrLift: number; angle: string }>;
  lastUpdatedAt:         string;
}

export interface ContradictionFlag {
  type:        "tone" | "positioning" | "psychological" | "narrative" | "pricing";
  description: string;
  severity:    "critical" | "warning";
  agents:      string[];
  detectedAt:  string;
}

export interface PrelaunchValidation {
  roasTarget:      number;
  roasRequired:    number;
  estimatedCPM:    number;
  ticketPrice:     number;
  budgetTraffic:   number;
  cpaBreakEven:    number;
  isViable:        boolean;
  blockers:        string[];
  warnings:        string[];
  validatedAt:     string;
}

export type MarketVerdictType = "VIAVEL" | "VIAVEL_COM_AJUSTES" | "INVIAVEL";

export interface MarketValidatorResult {
  validator: "market_validator" | "offer_price_validator" | "brand_validator";
  verdict: MarketVerdictType;
  score: number;
  justification: string;
  criticalIssues: string[];
  adjustmentSuggestions: string[];
  isCriticalBlock: boolean;
  /** true quando o nicho/produto exige habilitação legal — gera alerta de ciência, não bloqueio */
  requiresAcknowledgment?: boolean;
  /** lista dos alertas legais/regulatórios que o founder precisa confirmar ciência */
  regulatoryAlerts?: string[];
}

export interface MarketValidationResult {
  overallVerdict: MarketVerdictType;
  validators: MarketValidatorResult[];
  pivotSuggestions: string[];
  /** timestamp de quando o founder clicou "Confirmo ciência" — registra self-proof */
  acknowledgmentRecordedAt?: string;
  /** @deprecated mantido para compatibilidade — use acknowledgmentRecordedAt */
  userDecision?: "proceed";
  validatedAt: string;
}

export interface CampaignBrain {
  icp:                 ICPProfile;
  offer:               OfferProfile;
  narrative:           NarrativeProfile;
  alignment:           AlignmentState;
  trafficLearnings:    TrafficLearnings;
  contradictions:      ContradictionFlag[];
  prelaunchValidation: PrelaunchValidation | null;
  marketValidation:    MarketValidationResult | null;
  builtAt:             string;
  version:             number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultAlignment(): AlignmentState {
  const dim = { icp: 0, tone: 0, awarenessLevel: 0, mechanism: 0, positioning: 0, promise: 0, pricingPerception: 0, emotionalCoherence: 0 };
  return { score: 0, criticalConflicts: [], warnings: [], dimensions: dim, isMisaligned: false, checkedAt: new Date().toISOString() };
}

function defaultTrafficLearnings(): TrafficLearnings {
  return { winningHooks: [], losingHooks: [], bestPerformingAngles: [], avgCTR: 0, avgCPM: 0, peakCTR: 0, fatigueSignals: [], hookPerformance: [], lastUpdatedAt: new Date().toISOString() };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildCampaignBrain(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<CampaignBrain | null> {
  try {
    const [campaign] = await db
      .select({
        intakeData:   campaignsTable.intakeData,
        strategyData: campaignsTable.strategyData,
        offerData:    campaignsTable.offerData,
        audienceData: campaignsTable.audienceData,
        memoryData:   campaignsTable.memoryData,
        targetingData:campaignsTable.targetingData,
        brainData:    (campaignsTable as any).brainData,
      })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!campaign) return null;

    const intake   = (campaign.intakeData   ?? {}) as Record<string, unknown>;
    const strategy = (campaign.strategyData ?? {}) as Record<string, unknown>;
    const offer    = (campaign.offerData    ?? {}) as Record<string, unknown>;
    const audience = (campaign.audienceData ?? {}) as Record<string, unknown>;
    const memory   = (campaign.memoryData   ?? {}) as Record<string, unknown>;
    const targeting= (campaign.targetingData?? {}) as Record<string, unknown>;

    // Preserve existing brain sections so they aren't overwritten
    const existing = (campaign.brainData ?? {}) as Partial<CampaignBrain>;

    // ── ICP ──
    const icp: ICPProfile = {
      description:         String(intake["audience.description"]  ?? (audience as any)?.avatar?.description ?? ""),
      painPoints:          toStringArray(intake["audience.painPoints"] ?? (audience as any)?.avatar?.pains),
      desires:             toStringArray(intake["audience.desires"]    ?? (audience as any)?.avatar?.desires),
      sophisticationLevel: String(intake["audience.sophisticationLevel"] ?? (strategy as any)?.audienceSophistication ?? "solution_aware"),
      decisionMaker:       String(intake["audience.decisionMaker"] ?? ""),
      awarenessScore:      toAwarenessScore(String(intake["audience.sophisticationLevel"] ?? "")),
    };

    // ── Offer ──
    const offerName      = String((offer as any)?.offerName ?? (offer as any)?.name ?? intake["product.name"] ?? "");
    const price          = Number(intake["product.price"] ?? 0);
    const pricingModel   = String(intake["product.pricingModel"] ?? "");
    const uniqueMech     = String((offer as any)?.uniqueMechanism?.name ?? (offer as any)?.uniqueMechanism ?? (strategy as any)?.uniqueMechanism ?? "");
    const guarantee      = String((offer as any)?.offerStructure?.guarantee?.type ?? (offer as any)?.guarantee ?? "");
    const positioning    = inferPositioning(price, String(intake["product.category"] ?? ""));

    const offerProfile: OfferProfile = {
      name: offerName, price, pricingModel, uniqueMechanism: uniqueMech,
      guarantee, positioning, perceivedValue: price >= 1000 ? "high" : price >= 300 ? "medium" : "low",
    };

    // ── Narrative ──
    const memNarrative   = (memory as any)?.narrative ?? {};
    const docDoctrine    = (memory as any)?.doctrine ?? {};
    const tone           = String(intake["content.tone"]      ?? memNarrative?.toneOfVoice   ?? "challenger");
    const domEmotion     = String(docDoctrine?.dominantEmotion ?? memNarrative?.dominantEmotion ?? (strategy as any)?.dominantEmotion ?? "curiosidade");
    const emotionalSeq   = toStringArray(docDoctrine?.emotionalSequence ?? memNarrative?.emotionalSequence ?? []);
    const centralNarr    = String(memNarrative?.centralNarrative  ?? (strategy as any)?.centralNarrative  ?? "");
    const bigDomino      = String(memNarrative?.bigDomino          ?? (strategy as any)?.bigDomino         ?? "");
    const permitted      = toStringArray((memory as any)?.compliance?.permittedClaims   ?? []);
    const forbidden      = toStringArray(intake["content.forbiddenTopics"] ?? (memory as any)?.compliance?.prohibitedClaims ?? []);

    const narrative: NarrativeProfile = {
      tone, dominantEmotion: domEmotion, emotionalSequence: emotionalSeq,
      centralNarrative: centralNarr, bigDomino, permittedClaims: permitted, forbiddenTopics: forbidden,
    };

    const brain: CampaignBrain = {
      icp,
      offer: offerProfile,
      narrative,
      alignment:           existing.alignment          ?? defaultAlignment(),
      trafficLearnings:    existing.trafficLearnings   ?? defaultTrafficLearnings(),
      contradictions:      existing.contradictions     ?? [],
      prelaunchValidation: existing.prelaunchValidation ?? null,
      marketValidation:    existing.marketValidation    ?? null,
      builtAt:             new Date().toISOString(),
      version:             ((existing.version ?? 0) as number) + 1,
    };

    await db.update(campaignsTable as any)
      .set({ brainData: brain as any })
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

    log.info({ campaignId, version: brain.version, icpSophistication: icp.sophisticationLevel, positioning: offerProfile.positioning }, "Campaign Brain built");
    return brain;
  } catch (err) {
    log.warn({ err, campaignId }, "Campaign Brain build failed — non-blocking");
    return null;
  }
}

export async function getCampaignBrain(campaignId: string, workspaceId: string): Promise<CampaignBrain | null> {
  const [row] = await db
    .select({ brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  return (row?.brainData as CampaignBrain | null) ?? null;
}

export async function updateBrainSection<K extends keyof CampaignBrain>(
  campaignId: string,
  key: K,
  value: CampaignBrain[K],
  log: Logger,
  workspaceId: string,
): Promise<void> {
  try {
    const existing = await getCampaignBrain(campaignId, workspaceId);
    if (!existing) return;
    const updated = { ...existing, [key]: value };
    await db.update(campaignsTable as any)
      .set({ brainData: updated as any })
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
  } catch (err) {
    log.warn({ err, campaignId, key }, "Brain section update failed");
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string" && val.length > 0) return [val];
  return [];
}

function toAwarenessScore(sophistication: string): number {
  const map: Record<string, number> = {
    unaware: 0, problem_aware: 1, solution_aware: 2,
    product_aware: 3, most_aware: 4,
  };
  return map[sophistication] ?? 2;
}

function inferPositioning(price: number, category: string): string {
  if (price >= 5000) return "premium";
  if (price >= 1500) return "mid-market";
  if (price >= 300)  return "accessible";
  return "commodity";
}
