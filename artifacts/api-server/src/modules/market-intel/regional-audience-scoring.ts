export interface DeterministicHeatInput {
  intent?: string | null; sentiment?: string | null; confidence?: number | null; occurredAt: Date;
  interactionType?: string | null; frequency?: number; now?: Date;
}
export function calculateDeterministicHeat(input: DeterministicHeatInput) {
  const reasons: string[] = []; let score = 0; const intent = input.intent?.toLowerCase() ?? "";
  if (/(buy|compr|pre[cç]o|or[cç]amento|quero|interess)/.test(intent)) { score += 40; reasons.push("intenção pública de compra/interesse"); } else if (intent) { score += 15; reasons.push("intenção pública identificada"); }
  if ((input.sentiment ?? "").toLowerCase() === "positive") { score += 10; reasons.push("sentimento público positivo"); }
  if ((input.confidence ?? 0) >= 75) { score += 10; reasons.push("alta confiança da classificação"); }
  if (/(comment|reply|question|save)/.test(input.interactionType?.toLowerCase() ?? "")) { score += 10; reasons.push("interação pública de alta intenção"); }
  const frequency = Math.max(1, Math.min(input.frequency ?? 1, 10));
  if (frequency > 1) { score += Math.min(15, (frequency - 1) * 5); reasons.push(`${frequency} interações públicas observadas`); }
  const recencyHours = Math.max(0, Math.floor(((input.now ?? new Date()).getTime() - input.occurredAt.getTime()) / 3_600_000));
  if (recencyHours <= 24) { score += 20; reasons.push("interação nas últimas 24h"); } else if (recencyHours <= 168) { score += 10; reasons.push("interação na última semana"); }
  const heatScore = Math.min(100, score);
  return { heatScore, heatBand: heatScore >= 70 ? "hot" as const : heatScore >= 35 ? "warm" as const : "cold" as const, reasons, recencyHours };
}