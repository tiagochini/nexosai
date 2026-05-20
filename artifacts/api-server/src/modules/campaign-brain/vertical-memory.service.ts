/**
 * Learning Memory por Vertical — O ativo mais poderoso a longo prazo
 *
 * O sistema aprende por nicho. Novas campanhas começam mais inteligentes
 * porque já sabem quais hooks vencem, quais emoções convertem, qual CPM
 * esperar e quais objeções surgem mais para aquela vertical.
 *
 * Integration points:
 *  - Writes: setImmediate when campaign transitions to 'completed' in orchestration.worker.ts
 *  - Reads: command.agent.ts (injectado no memoryContext via getVerticalLearnings)
 *  - Table: vertical_memory (upserted por verticalKey + workspaceId)
 */

import { db, campaignsTable, campaignMetricsTable, verticalMemoryTable } from "@workspace/db";
import { eq, and, avg, max } from "drizzle-orm";
import type { Logger } from "pino";
import { getCampaignBrain } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerticalLearningData {
  // Performance baselines
  avgHealthScore:         number;
  avgRoas:                number;
  avgCTR:                 number;
  avgCPM:                 number;
  avgCPL:                 number;
  avgConversionRate:      number;
  // Creative intelligence
  winningHooks:           string[];
  losingHooks:            string[];
  dominantEmotions:       string[];
  winningTones:           string[];
  winningFormats:         string[];
  highRiskAngles:         string[];
  // Audience intelligence
  typicalSophistication:  string;
  typicalAwareness:       number;
  commonObjections:       string[];
  // Timing patterns
  bestLaunchDays:         number[];
  avgCartDuration:        number;
  // Offer patterns
  priceRangeMin:          number;
  priceRangeMax:          number;
  typicalPositioning:     string[];
  // Meta
  campaignCount:          number;
  lastCampaignAt:         string;
  updatedAt:              string;
}

// ─── Vertical Key Derivation ─────────────────────────────────────────────────

export function deriveVerticalKey(intake: Record<string, unknown>): string {
  const category   = String(intake["product.category"] ?? "").toLowerCase().replace(/\s+/g, "_");
  const price      = Number(intake["product.price"] ?? 0);
  const desc       = String(intake["audience.description"] ?? "").toLowerCase();

  // Derive audience segment keyword
  const audienceSegment = deriveAudienceSegment(desc);
  const priceSegment    = price >= 5000 ? "high_ticket" : price >= 500 ? "mid_ticket" : "low_ticket";

  return `${category || "infoproduto"}_${audienceSegment}_${priceSegment}`.replace(/[^a-z0-9_]/g, "_");
}

function deriveAudienceSegment(desc: string): string {
  if (desc.includes("fitness") || desc.includes("saúde") || desc.includes("emagrecer")) return "fitness";
  if (desc.includes("negócio") || desc.includes("empreendedor") || desc.includes("empresa")) return "business";
  if (desc.includes("investimento") || desc.includes("finanças") || desc.includes("renda")) return "finance";
  if (desc.includes("relacionamento") || desc.includes("amor") || desc.includes("autoconhecimento")) return "lifestyle";
  if (desc.includes("mãe") || desc.includes("família") || desc.includes("filho")) return "family";
  if (desc.includes("marketing") || desc.includes("tráfego") || desc.includes("vendas")) return "marketing";
  if (desc.includes("carreira") || desc.includes("trabalho") || desc.includes("emprego")) return "career";
  return "general";
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export async function saveVerticalLearning(
  campaignId:  string,
  workspaceId: string,
  log:         Logger,
): Promise<void> {
  try {
    const [campaign] = await db
      .select({
        intakeData:   campaignsTable.intakeData,
        strategyData: campaignsTable.strategyData,
        type:         campaignsTable.type,
        track:        campaignsTable.track,
        completedAt:  campaignsTable.completedAt,
      })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    if (!campaign) return;

    const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const brain  = await getCampaignBrain(campaignId);

    // Pull aggregated metrics for this campaign
    const [metricAgg] = await db
      .select({
        avgRoas:   avg(campaignMetricsTable.roas),
        avgCTR:    avg(campaignMetricsTable.ctr),
        avgCPL:    avg(campaignMetricsTable.cplBrl),
        avgCR:     avg(campaignMetricsTable.conversionRate),
        maxHealth: max(campaignMetricsTable.healthScore),
      })
      .from(campaignMetricsTable)
      .where(eq(campaignMetricsTable.campaignId, campaignId));

    const verticalKey = deriveVerticalKey(intake);
    const avgHealthScore = Number(metricAgg?.maxHealth ?? brain?.alignment?.score ?? 0);

    // Load existing vertical memory to merge
    const existingRows = await db
      .select()
      .from(verticalMemoryTable)
      .where(and(
        eq(verticalMemoryTable.verticalKey, verticalKey),
        eq(verticalMemoryTable.workspaceId, workspaceId),
      ))
      .limit(1);

    const existing = (existingRows[0]?.learnings ?? {}) as Partial<VerticalLearningData>;
    const existingCount = existingRows[0]?.sampleCount ?? 0;

    // Merge learnings with existing data (weighted average for numeric, union for arrays)
    const newCount = existingCount + 1;
    const w1 = existingCount / newCount; // weight for existing
    const w2 = 1 / newCount;            // weight for new data

    const updated: VerticalLearningData = {
      avgHealthScore:        weightedAvg(existing.avgHealthScore ?? 0, avgHealthScore, w1, w2),
      avgRoas:               weightedAvg(existing.avgRoas ?? 0, Number(metricAgg?.avgRoas ?? 0), w1, w2),
      avgCTR:                weightedAvg(existing.avgCTR ?? 0, Number(metricAgg?.avgCTR ?? 0), w1, w2),
      avgCPM:                existing.avgCPM ?? 0,
      avgCPL:                weightedAvg(existing.avgCPL ?? 0, Number(metricAgg?.avgCPL ?? 0), w1, w2),
      avgConversionRate:     weightedAvg(existing.avgConversionRate ?? 0, Number(metricAgg?.avgCR ?? 0), w1, w2),

      // Creative intelligence — union dedup
      winningHooks:    deduplicateUnion(existing.winningHooks ?? [], brain?.trafficLearnings?.winningHooks ?? [], 15),
      losingHooks:     deduplicateUnion(existing.losingHooks  ?? [], brain?.trafficLearnings?.losingHooks  ?? [], 10),
      dominantEmotions:deduplicateUnion(existing.dominantEmotions ?? [], brain?.narrative?.dominantEmotion ? [brain.narrative.dominantEmotion] : [], 8),
      winningTones:    deduplicateUnion(existing.winningTones ?? [], brain?.narrative?.tone ? [brain.narrative.tone] : [], 5),
      winningFormats:  existing.winningFormats ?? [],
      highRiskAngles:  deduplicateUnion(existing.highRiskAngles ?? [], brain?.trafficLearnings?.losingHooks?.slice(0, 3) ?? [], 8),

      // Audience intelligence
      typicalSophistication: brain?.icp?.sophisticationLevel ?? existing.typicalSophistication ?? "solution_aware",
      typicalAwareness:      brain?.icp?.awarenessScore ?? existing.typicalAwareness ?? 2,
      commonObjections:      deduplicateUnion(existing.commonObjections ?? [], brain?.icp?.painPoints ?? [], 10),

      // Timing
      bestLaunchDays: existing.bestLaunchDays ?? [],
      avgCartDuration: weightedAvg(existing.avgCartDuration ?? 7, Number(intake["launch.cartOpenDuration"] ?? 7), w1, w2),

      // Offer patterns
      priceRangeMin:       Math.min(existing.priceRangeMin ?? 999999, Number(intake["product.price"] ?? 0)),
      priceRangeMax:       Math.max(existing.priceRangeMax ?? 0,      Number(intake["product.price"] ?? 0)),
      typicalPositioning:  deduplicateUnion(existing.typicalPositioning ?? [], brain?.offer?.positioning ? [brain.offer.positioning] : [], 5),

      // Meta
      campaignCount:   newCount,
      lastCampaignAt:  new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };

    if (existingRows.length > 0) {
      await db
        .update(verticalMemoryTable)
        .set({ learnings: updated as any, sampleCount: newCount, avgHealthScore, updatedAt: new Date() })
        .where(eq(verticalMemoryTable.id, existingRows[0]!.id));
    } else {
      await db.insert(verticalMemoryTable).values({
        verticalKey, workspaceId, campaignType: campaign.type, track: campaign.track,
        sampleCount: 1, avgHealthScore, learnings: updated as any,
      });
    }

    log.info({ campaignId, verticalKey, sampleCount: newCount, avgHealthScore }, "Vertical Learning Memory updated");
  } catch (err) {
    log.warn({ err, campaignId }, "Vertical Memory save failed — non-blocking");
  }
}

export async function getVerticalLearnings(
  verticalKey: string,
  workspaceId?: string,
): Promise<VerticalLearningData | null> {
  const conditions = workspaceId
    ? [eq(verticalMemoryTable.verticalKey, verticalKey), eq(verticalMemoryTable.workspaceId, workspaceId)]
    : [eq(verticalMemoryTable.verticalKey, verticalKey)];

  const [row] = await db
    .select()
    .from(verticalMemoryTable)
    .where(and(...conditions))
    .limit(1);

  return (row?.learnings as VerticalLearningData | null) ?? null;
}

export function formatVerticalMemoryContext(data: VerticalLearningData, verticalKey: string): string {
  return `
## Memória de Vertical: ${verticalKey} (${data.campaignCount} campanhas)
- Performance histórica: ROAS médio ${data.avgRoas.toFixed(1)}x | CTR médio ${(data.avgCTR * 100).toFixed(2)}% | CPM médio R$${data.avgCPM.toFixed(0)}
- Health score médio: ${data.avgHealthScore}/100
- Emoções que convertem nesta vertical: ${data.dominantEmotions.slice(0, 3).join(", ") || "desconhecido"}
- Tom dominante nas campanhas vencedoras: ${data.winningTones.slice(0, 2).join(", ") || "desconhecido"}
- Sofisticação típica da audiência: ${data.typicalSophistication} (awareness ${data.typicalAwareness}/4)
- Objeções comuns: ${data.commonObjections.slice(0, 3).join("; ") || "desconhecido"}
- Faixa de preço histórica: R$${data.priceRangeMin}–R$${data.priceRangeMax}
- Posicionamentos que funcionam: ${data.typicalPositioning.join(", ") || "desconhecido"}
${data.winningHooks.length > 0 ? `- Hooks vencedores documentados: ${data.winningHooks.slice(0, 3).join(" | ")}` : ""}
${data.highRiskAngles.length > 0 ? `- Ângulos de alto risco (evitar): ${data.highRiskAngles.slice(0, 2).join(" | ")}` : ""}
`.trim();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weightedAvg(existing: number, incoming: number, w1: number, w2: number): number {
  if (existing === 0 && incoming === 0) return 0;
  const result = existing * w1 + incoming * w2;
  return Math.round(result * 100) / 100;
}

function deduplicateUnion(a: string[], b: string[], max: number): string[] {
  return [...new Set([...a, ...b].filter(Boolean))].slice(0, max);
}
