/**
 * NEXOS AI — Dynamic Avatar State
 *
 * Maps PLF phase identifiers to their corresponding emotional arc phase state.
 * Optionally adjusts the state based on real engagement trends from sequence analytics.
 *
 * Pipeline:
 *   CampaignEmotionalArc (stored in intakeData._emotionalArc)
 *     → getAvatarStateForPhase(arc, plfPhase)
 *       → adjustStateForEngagement(state, trend)
 *         → buildPhaseStateBlock(state)
 *           → injected as phaseContext in RunAgentOptions
 */

import type { AvatarPhaseState, CampaignEmotionalArc } from "./campaign-emotional-arc.agent.js";

export { type AvatarPhaseState, type CampaignEmotionalArc };

// ─── PLF Phase → Arc Phase Mapping ───────────────────────────────────────────

/**
 * Canonical mapping from PLF calendar phase identifiers to arc phase IDs.
 * The arc phases are the emotional states; the PLF phases are the calendar labels.
 */
export const PLF_PHASE_TO_ARC: Record<string, string> = {
  // Warmup / awareness
  warmup: "curiosidade",
  pre_launch: "curiosidade",
  awareness: "curiosidade",
  pre_lançamento: "curiosidade",

  // CPL 1 — identification
  cpl1: "identificacao",
  cpl_1: "identificacao",
  CPL1: "identificacao",
  "cpl-1": "identificacao",

  // CPL 2 — pain amplification
  cpl2: "amplificacao_de_dor",
  cpl_2: "amplificacao_de_dor",
  CPL2: "amplificacao_de_dor",
  "cpl-2": "amplificacao_de_dor",

  // CPL 3 — solution vision
  cpl3: "visao_de_solucao",
  cpl_3: "visao_de_solucao",
  CPL3: "visao_de_solucao",
  "cpl-3": "visao_de_solucao",

  // Pre-cart
  pre_cart: "desejo",
  pre_open: "desejo",
  anticipation: "desejo",

  // Cart phases
  cart_open: "prova",
  cart_middle: "tensao_de_decisao",
  cart_close: "urgencia",
  cart_last_chance: "urgencia",
  closing: "urgencia",

  // Post-purchase
  post_purchase: "alivio_pos_compra",
  onboarding: "alivio_pos_compra",
  pos_compra: "alivio_pos_compra",
};

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Returns the avatar state for a given PLF phase from the campaign arc.
 * Returns null if no arc exists or no matching phase is found.
 */
export function getAvatarStateForPhase(
  arc: CampaignEmotionalArc | null | undefined,
  plfPhase: string,
): AvatarPhaseState | null {
  if (!arc?.phases?.length) return null;
  const arcPhaseId =
    PLF_PHASE_TO_ARC[plfPhase] ??
    PLF_PHASE_TO_ARC[plfPhase.toLowerCase()] ??
    PLF_PHASE_TO_ARC[plfPhase.toUpperCase()];
  if (!arcPhaseId) return null;
  return arc.phases.find((p) => p.phase === arcPhaseId) ?? null;
}

/**
 * Adjusts the base phase state based on real engagement metrics from sequence analytics.
 * engagement "up" → higher belief, lower resistance, warmer temperature.
 * engagement "down" → lower belief, higher resistance, colder temperature.
 */
export function adjustStateForEngagement(
  baseState: AvatarPhaseState,
  engagementTrend: "up" | "stable" | "down" | undefined,
): AvatarPhaseState {
  if (!engagementTrend || engagementTrend === "stable") return baseState;

  const tempOrder: AvatarPhaseState["buyingTemperature"][] = ["frozen", "cold", "warm", "hot"];
  const idx = tempOrder.indexOf(baseState.buyingTemperature);

  if (engagementTrend === "up") {
    return {
      ...baseState,
      beliefLevel: Math.min(100, baseState.beliefLevel + 15),
      resistanceLevel: Math.max(0, baseState.resistanceLevel - 10),
      buyingTemperature: tempOrder[Math.min(idx + 1, 3)],
    };
  }

  return {
    ...baseState,
    beliefLevel: Math.max(0, baseState.beliefLevel - 15),
    resistanceLevel: Math.min(100, baseState.resistanceLevel + 10),
    buyingTemperature: tempOrder[Math.max(idx - 1, 0)],
  };
}

// ─── Block Builders ───────────────────────────────────────────────────────────

const TEMP_LABELS: Record<AvatarPhaseState["buyingTemperature"], string> = {
  frozen: "❄️ FROZEN — totalmente fechado, ainda não viu razão para acreditar",
  cold: "🔵 COLD — curioso mas defensivo, avaliando se vale a atenção",
  warm: "🟡 WARM — começando a acreditar, ainda resistindo",
  hot: "🔴 HOT — desejando, buscando razão para dizer sim",
};

/**
 * Formats a single phase state as an injected context block.
 * Injected as phaseContext in RunAgentOptions for phase-specific agents.
 */
export function buildPhaseStateBlock(state: AvatarPhaseState): string {
  const lines: string[] = [];

  lines.push(`## ━━━ ESTADO EMOCIONAL DO AVATAR — FASE ATUAL ━━━`);
  lines.push(`**Fase:** ${state.name} (${state.phase})`);
  lines.push(`**Temperatura de compra:** ${TEMP_LABELS[state.buyingTemperature]}`);
  lines.push(`**Nível de crença:** ${state.beliefLevel}/100 — o quanto acredita que este produto vai funcionar para ELE`);
  lines.push(`**Nível de resistência:** ${state.resistanceLevel}/100 — o quanto está na defensiva`);
  lines.push(`**Emoção dominante nesta fase:** ${state.dominantEmotion}`);
  lines.push(``);
  lines.push(`**A pergunta que domina a mente dele agora:**`);
  lines.push(`${state.mainInternalQuestion}`);
  lines.push(``);
  lines.push(`**Como ele fala para si mesmo nesta fase (USE estas frases no copy):**`);
  lines.push(state.voiceFragment);
  lines.push(``);
  lines.push(`**Objetivo desta fase — o que PRECISA ser conseguido emocionalmente:**`);
  lines.push(state.objective);
  lines.push(``);
  lines.push(`**O que vai levá-lo para a próxima fase:**`);
  lines.push(state.transitionTrigger);
  lines.push(``);
  lines.push(`**Diretrizes de copy para esta fase:**`);
  state.copyDirectives.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  lines.push(``);
  lines.push(`**Emoções a EVITAR (quebram a progressão do funil):**`);
  lines.push(state.emotionsToAvoid.join(" | "));
  lines.push(``);
  lines.push(
    `> **REGRA ABSOLUTA:** Este conteúdo opera no estado emocional "${state.name}".\n` +
    `> Não pule etapas. Não presuma que o avatar está em estágio mais avançado.\n` +
    `> Conteúdo no estado emocional ERRADO destrói a progressão da campanha inteira.`,
  );
  lines.push(`\n---\n`);

  return lines.join("\n");
}

/**
 * Formats the full Campaign Emotional Arc as an overview block.
 * Used by agents that generate content spanning multiple phases (CPL 1-4, stories, etc.)
 */
export function buildArcOverviewBlock(arc: CampaignEmotionalArc): string {
  const lines: string[] = [];

  lines.push(`## ━━━ ARCO EMOCIONAL DA CAMPANHA ━━━`);
  lines.push(`> ${arc.arcSummary}`);
  lines.push(``);

  lines.push(`### PROGRESSÃO EMOCIONAL — FASE A FASE`);
  arc.phases.forEach((p) => {
    lines.push(
      `**${p.name}** (beliefLevel: ${p.beliefLevel}/100 | resistência: ${p.resistanceLevel}/100 | temp: ${p.buyingTemperature})` +
      ` — "${p.mainInternalQuestion}"`,
    );
  });
  lines.push(``);

  if (arc.emotionalCoherenceRules?.length) {
    lines.push(`### REGRAS DE COERÊNCIA EMOCIONAL (todos os agentes devem seguir)`);
    arc.emotionalCoherenceRules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push(``);
  }

  if (arc.criticalTransitions?.length) {
    lines.push(`### TRANSIÇÕES CRÍTICAS — PONTOS DE RISCO`);
    arc.criticalTransitions.forEach((t) => {
      lines.push(`**${t.from} → ${t.to}:** ${t.risk}`);
      lines.push(`  → Solução: ${t.solution}`);
    });
    lines.push(``);
  }

  if (arc.winningPatternHypothesis) {
    lines.push(`**Hipótese de padrão emocional vencedor:** ${arc.winningPatternHypothesis}`);
    lines.push(``);
  }

  lines.push(`---\n`);
  return lines.join("\n");
}

/**
 * Reads the emotional arc from intakeData and returns the formatted arc block.
 * Used in profile-injector.ts to include the arc in the profile context.
 */
export function buildArcBlockFromIntakeData(intakeData: Record<string, unknown>): string {
  const arc = intakeData["_emotionalArc"] as CampaignEmotionalArc | undefined;
  if (!arc?.phases?.length) return "";
  return buildArcOverviewBlock(arc);
}

/**
 * Returns the full arc from intakeData, or null.
 */
export function getArcFromIntakeData(intakeData: Record<string, unknown>): CampaignEmotionalArc | null {
  const arc = intakeData["_emotionalArc"];
  if (!arc || typeof arc !== "object") return null;
  return arc as CampaignEmotionalArc;
}
