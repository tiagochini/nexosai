/**
 * Strategic Alignment Engine + Contradiction Detector
 *
 * O "juiz de coerência" do sistema. Verifica se TODOS os agentes falam
 * a mesma língua estratégica — mede ICP, emoção dominante, awareness,
 * mecanismo único, posicionamento, promessa, tom e preço percebido.
 *
 * Também detecta contradições psicológicas, narrativas e de posicionamento
 * entre os outputs dos agentes antes que destruam a campanha.
 *
 * Integration points:
 *  - Called: setImmediate in command.agent.ts after pipeline completes
 *  - Result: written to campaigns.brainData.alignment + campaigns.brainData.contradictions
 */

import type { Logger } from "pino";
import type { CampaignBrain, AlignmentState, ContradictionFlag } from "./campaign-brain.service.js";
import { updateBrainSection } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlignmentReport {
  alignmentScore:    number;
  criticalConflicts: string[];
  warnings:          string[];
  dimensions:        AlignmentState["dimensions"];
  contradictions:    ContradictionFlag[];
  isMisaligned:      boolean;
  checkedAt:         string;
}

// ─── Alignment Engine ─────────────────────────────────────────────────────────

export async function runStrategicAlignmentEngine(
  campaignId: string,
  brain:       CampaignBrain,
  log:         Logger,
): Promise<AlignmentReport> {
  const conflicts: string[] = [];
  const warnings:  string[] = [];
  const contradictions: ContradictionFlag[] = [];
  const now = new Date().toISOString();

  // ── Dimension scores (0-100 each) ──────────────────────────────────────────

  // 1. ICP alignment — Is the tone appropriate for the sophistication level?
  const icpScore = scoreICPAlignment(brain);
  if (icpScore < 50) {
    conflicts.push(`Tom '${brain.narrative.tone}' inadequado para nível de consciência '${brain.icp.sophisticationLevel}'`);
  }

  // 2. Tone coherence — Is the narrative tone consistent with dominant emotion?
  const toneScore = scoreToneCoherence(brain);
  if (toneScore < 60) {
    warnings.push(`Tom e emoção dominante potencialmente conflitantes: '${brain.narrative.tone}' + '${brain.narrative.dominantEmotion}'`);
  }

  // 3. Awareness level match — Does the content match the audience awareness stage?
  const awarenessScore = scoreAwarenessMatch(brain);
  if (awarenessScore < 50) {
    conflicts.push(`Awareness nível ${brain.icp.awarenessScore} exige abordagem educativa antes de vender — verificar sequência narrativa`);
  }

  // 4. Unique mechanism presence — Is the mechanism consistently present?
  const mechanismScore = brain.offer.uniqueMechanism.length > 0 ? 80 : 40;
  if (mechanismScore < 60) {
    warnings.push("Mecanismo único ausente ou vago — agentes podem estar usando argumentos genéricos");
  }

  // 5. Positioning coherence — Does positioning match price point?
  const positioningScore = scorePositioningCoherence(brain);
  if (positioningScore < 60) {
    conflicts.push(`Posicionamento '${brain.offer.positioning}' inconsistente com preço R$${brain.offer.price} e percepção de valor '${brain.offer.perceivedValue}'`);
  }

  // 6. Promise viability — Are claims within bounds?
  const promiseScore = brain.offer.uniqueMechanism.length > 10 ? 85 : 65;

  // 7. Pricing perception — Does pricing align with the positioning?
  const pricingScore = scorePricingPerception(brain);
  if (pricingScore < 55) {
    warnings.push(`Percepção de preço desalinhada: '${brain.offer.perceivedValue}' vs posicionamento '${brain.offer.positioning}'`);
  }

  // 8. Emotional coherence — Is the emotional sequence coherent?
  const emotionalScore = brain.narrative.emotionalSequence.length >= 3 ? 85 : 65;
  if (brain.narrative.emotionalSequence.length < 2) {
    warnings.push("Sequência emocional insuficiente — risco de jornada do cliente sem progressão");
  }

  // ── Contradiction Detection ─────────────────────────────────────────────────

  // Psychological contradiction: premium positioning + scarcity urgency copy
  if (brain.offer.positioning === "premium" && brain.narrative.dominantEmotion.includes("medo")) {
    contradictions.push({
      type: "psychological",
      description: `Posicionamento premium + gatilho de medo como emoção dominante destroem percepção de exclusividade`,
      severity: "critical",
      agents: ["offer", "strategy", "copywriter"],
      detectedAt: now,
    });
    conflicts.push("CONTRADIÇÃO PSICOLÓGICA: premium + medo/urgência — percepção de valor destruída");
  }

  // Tone contradiction: sophisticated authority + aggressive urgency
  if (brain.narrative.tone === "challenger" && brain.icp.sophisticationLevel === "most_aware") {
    contradictions.push({
      type: "tone",
      description: "Tom challenger para audiência most_aware — risco de parecer simplista ou condescendente",
      severity: "warning",
      agents: ["strategy", "copywriter"],
      detectedAt: now,
    });
    warnings.push("Tom challenger com audiência most_aware pode reduzir conversão");
  }

  // Narrative contradiction: luxury offer + discount/promotional language
  if (brain.offer.price >= 2000 && brain.narrative.tone === "promotional") {
    contradictions.push({
      type: "narrative",
      description: `Oferta de alto valor (R$${brain.offer.price}) com tom promocional destrói ancoragem de preço`,
      severity: "critical",
      agents: ["offer", "copywriter", "creative_director"],
      detectedAt: now,
    });
    conflicts.push(`CONTRADIÇÃO NARRATIVA: produto R$${brain.offer.price} com tom promocional`);
  }

  // Positioning contradiction: premium positioning + commodity pricing signals
  if (brain.offer.positioning === "premium" && brain.offer.price < 500) {
    contradictions.push({
      type: "positioning",
      description: `Posicionamento 'premium' com preço R$${brain.offer.price} é incoerente — risco de credibilidade`,
      severity: "warning",
      agents: ["offer", "strategy"],
      detectedAt: now,
    });
    warnings.push(`Posicionamento premium com ticket R$${brain.offer.price} pode gerar ceticismo`);
  }

  // Awareness contradiction: low awareness audience + product-focused copy
  if (brain.icp.awarenessScore <= 1 && brain.offer.uniqueMechanism.length > 0) {
    contradictions.push({
      type: "psychological",
      description: "Audiência com baixo awareness precisa ser educada antes de apresentar o mecanismo único",
      severity: "warning",
      agents: ["strategy", "copywriter", "landing_page"],
      detectedAt: now,
    });
    warnings.push("Audiência unaware/problem_aware — sequência deve educar antes de vender mecanismo");
  }

  // ── Overall Score ───────────────────────────────────────────────────────────
  const dimensions = {
    icp:               icpScore,
    tone:              toneScore,
    awarenessLevel:    awarenessScore,
    mechanism:         mechanismScore,
    positioning:       positioningScore,
    promise:           promiseScore,
    pricingPerception: pricingScore,
    emotionalCoherence:emotionalScore,
  };

  const criticalCount  = contradictions.filter(c => c.severity === "critical").length;
  const dimensionAvg   = Object.values(dimensions).reduce((s, v) => s + v, 0) / Object.values(dimensions).length;
  const penaltyPerCrit = 8;
  const alignmentScore = Math.max(0, Math.round(dimensionAvg - criticalCount * penaltyPerCrit));
  const isMisaligned   = alignmentScore < 60 || criticalCount > 0;

  const alignment: AlignmentState = {
    score: alignmentScore, criticalConflicts: conflicts, warnings, dimensions, isMisaligned, checkedAt: now,
  };

  const report: AlignmentReport = { alignmentScore, criticalConflicts: conflicts, warnings, dimensions, contradictions, isMisaligned, checkedAt: now };

  log.info({
    campaignId, alignmentScore, criticalConflicts: conflicts.length,
    warnings: warnings.length, contradictions: contradictions.length, isMisaligned,
  }, "Strategic Alignment Engine completed");

  return report;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function scoreICPAlignment(brain: CampaignBrain): number {
  const { tone, dominantEmotion } = brain.narrative;
  const { sophisticationLevel }   = brain.icp;

  // Problem_unaware needs educational/inspirational, not direct-response
  if (sophisticationLevel === "unaware" && (tone === "direct_response" || tone === "promotional")) return 35;
  if (sophisticationLevel === "unaware" && (tone === "educational" || tone === "inspirational")) return 90;

  // Most_aware audiences respond to deals/specifics, not education
  if (sophisticationLevel === "most_aware" && tone === "educational") return 55;
  if (sophisticationLevel === "most_aware" && (tone === "direct_response" || tone === "challenger")) return 85;

  // Solution_aware: challenger/educational work well
  if (sophisticationLevel === "solution_aware" && (tone === "challenger" || tone === "educational")) return 85;

  return 70; // Default OK score
}

function scoreToneCoherence(brain: CampaignBrain): number {
  const { tone, dominantEmotion } = brain.narrative;

  const coherentPairs: Array<[string, string]> = [
    ["inspirational", "transformação"], ["inspirational", "esperança"],
    ["educational",   "curiosidade"],   ["educational",   "confiança"],
    ["challenger",    "desconforto"],   ["challenger",    "urgência"],
    ["direct_response","urgência"],     ["direct_response","medo"],
    ["authority",     "confiança"],     ["authority",     "respeito"],
    ["storytelling",  "identificação"], ["storytelling",  "emoção"],
  ];

  const isCoherent = coherentPairs.some(([t, e]) =>
    tone.toLowerCase().includes(t) || dominantEmotion.toLowerCase().includes(e),
  );
  return isCoherent ? 85 : 65;
}

function scoreAwarenessMatch(brain: CampaignBrain): number {
  const { awarenessScore } = brain.icp;
  const { emotionalSequence } = brain.narrative;

  // Low awareness needs longer sequence to warm up
  if (awarenessScore <= 1 && emotionalSequence.length < 3) return 45;
  if (awarenessScore <= 1 && emotionalSequence.length >= 3) return 75;
  if (awarenessScore >= 3) return 85; // High awareness = shorter path OK
  return 70;
}

function scorePositioningCoherence(brain: CampaignBrain): number {
  const { positioning, price, perceivedValue } = brain.offer;

  if (positioning === "premium" && perceivedValue === "high")  return 95;
  if (positioning === "premium" && perceivedValue === "low")   return 25;
  if (positioning === "premium" && price < 500)                return 35;
  if (positioning === "commodity" && perceivedValue === "high") return 50;
  if (positioning === "accessible" && perceivedValue === "medium") return 85;
  if (positioning === "mid-market" && perceivedValue === "medium") return 85;
  return 70;
}

function scorePricingPerception(brain: CampaignBrain): number {
  const { price, positioning, perceivedValue } = brain.offer;
  if (positioning === "premium" && price >= 1000) return 90;
  if (positioning === "premium" && price < 500)   return 30;
  if (positioning === "accessible" && price <= 500) return 90;
  return 70;
}
