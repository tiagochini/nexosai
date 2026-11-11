import { z } from "zod/v4";

export function confirmsMarketReportChanges(question: string): boolean {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/[.!]+$/, "");
  return /^(?:(?:sim[, ]+)?(?:pode|podes)\s+)?(?:aplicar|aplique|aplica|atualizar|atualize|atualiza)(?:\s+(?:agora|as correcoes|os ajustes|as alteracoes|no relatorio|o relatorio|tudo|isso|ao relatorio))*$/i.test(text);
}

const competitor = z.object({
  name: z.string().min(1), estimatedRevenue: z.string(),
  marketShare: z.enum(["dominant", "major", "significant", "minor", "niche"]),
  positioningAngle: z.string(), strengthsPerceived: z.array(z.string()), weaknessesExposed: z.array(z.string()),
  pricingStrategy: z.string(), trafficSources: z.array(z.string()), contentStrategy: z.string(),
  biggestVulnerability: z.string(), reverseEngineeredStrategy: z.string(),
}).passthrough();
export const revisedMarketReportSchema = z.object({
  market: z.string().min(1), analysisDate: z.string(), marketSize: z.string(),
  marketMaturity: z.enum(["emerging", "growing", "mature", "saturated", "declining"]),
  totalAdressableAudience: z.string(), competitors: z.array(competitor),
  positioningGaps: z.array(z.object({ gap: z.string(), opportunity: z.string(), entryBarrier: z.string(), estimatedTAM: z.string() })),
  winningStrategyVsField: z.string(), untappedSegments: z.array(z.string()),
  keywordBattlefield: z.string(), contentArbitrage: z.string(), pricingArbitrage: z.string(),
  platformArbitrage: z.string(), entryRecommendation: z.string(), firstMoverActions: z.array(z.string()),
  clarifyingQuestions: z.array(z.string()).optional(),
}).passthrough();

export const marketRevisionFormat = JSON.stringify(z.toJSONSchema(revisedMarketReportSchema));

/** Unwrap provider envelopes without accepting incomplete report payloads. */
export function parseMarketRevision(content: string): Record<string, unknown> {
  let value: unknown = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  for (let depth = 0; depth < 8; depth++) {
    if (typeof value === "string") { value = JSON.parse(value); continue; }
    if (!value || typeof value !== "object" || Array.isArray(value)) break;
    const object = value as Record<string, unknown>;
    if ("market" in object || "competitors" in object) return revisedMarketReportSchema.parse(object);
    const key = ["report", "output", "data", "result", "revisedReport", "updatedReport", "revised_report", "updated_report", "relatorio", "relatorioAtualizado", "analysis"].find(k => object[k] !== undefined);
    if (!key) break;
    value = object[key];
  }
  return revisedMarketReportSchema.parse(value);
}
