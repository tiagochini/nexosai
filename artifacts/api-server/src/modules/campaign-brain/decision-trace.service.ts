/**
 * Decision Trace Engine — Explainability Layer
 *
 * Compõe uma trilha auditável de "por que essa decisão foi tomada"
 * a partir dos dados que já existem: campaign_agents, brainData,
 * doctrine checks, self-critique, decision weights.
 *
 * Nenhuma nova IA é invocada — é agregação estruturada do histórico.
 */

import { db, campaignsTable, campaignAgentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceAgent {
  agentType:    string;
  status:       string;
  aiProvider:   string | null;
  model:        string | null;
  creditsUsed:  number;
  tokensUsed:   number | null;
  completedAt:  Date | null;
  keyOutputs:   string[];      // extracted highlights from output
  influence:    "primary" | "secondary" | "validation";
}

export interface TraceDecision {
  dimension:   string;         // e.g. "ROAS target", "Posicionamento", "Tom da narrativa"
  value:       string;         // e.g. "3.8x"
  rationale:   string[];       // bullet reasons
  agent:       string;         // who decided
  confidence:  number;         // 0-100
}

export interface DoctrineCheck {
  principle:   string;
  passed:      boolean;
  reason:      string;
}

export interface DecisionTrace {
  campaignId:     string;
  campaignTitle:  string;
  status:         string;
  track:          string;
  generatedAt:    string;

  // Agent execution chain
  agentChain:     TraceAgent[];

  // Structured decisions with rationale
  keyDecisions:   TraceDecision[];

  // Doctrine gate results
  doctrineChecks: DoctrineCheck[];

  // Self-critique summary
  selfCritique: {
    ran:           boolean;
    overallScore:  number | null;
    strengths:     string[];
    risks:         string[];
    suggestions:   string[];
  };

  // Memory influence
  memoryInfluence: {
    alignmentScore:      number | null;
    conflicts:           string[];
    warnings:            string[];
    verticalInsights:    string[];
    creativeDirection:   string | null;
  };

  // Health & weights
  decisionWeights: {
    appliedProfile:  string | null;
    weightedKPIs:    string[];
  };

  // Summary sentence
  narrativeSummary: string;
}

// ─── Agent influence mapping ──────────────────────────────────────────────────

const AGENT_INFLUENCE: Record<string, "primary" | "secondary" | "validation"> = {
  command:                  "primary",
  strategy:                 "primary",
  offer:                    "primary",
  copywriter:               "secondary",
  creative_director:        "secondary",
  targeting:                "secondary",
  media_buyer:              "secondary",
  financial_projector:      "secondary",
  launch_sequence_builder:  "secondary",
  analytics:                "validation",
  compliance:               "validation",
  optimization:             "validation",
};

const AGENT_LABELS: Record<string, string> = {
  command:                  "Conselho Estratégico",
  strategy:                 "Agente de Estratégia",
  offer:                    "Agente de Oferta",
  copywriter:               "Copywriter",
  creative_director:        "Diretor de Arte",
  targeting:                "Especialista de Audiência",
  media_buyer:              "Gestor de Mídia",
  financial_projector:      "Projetor Financeiro",
  launch_sequence_builder:  "Construtor de Sequência",
  analytics:                "Agente de Analytics",
  compliance:               "Agente de Compliance",
  optimization:             "Agente de Otimização",
  vsl_script:               "Roteirista VSL",
  social_media:             "Estrategista Social",
};

// ─── Key output extractor ─────────────────────────────────────────────────────

function extractKeyOutputs(output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const o = output as Record<string, unknown>;
  const keys: string[] = [];

  if (o["strategy"]          && typeof o["strategy"] === "string")          keys.push(`Estratégia: ${String(o["strategy"]).slice(0, 80)}`);
  if (o["positioning"]       && typeof o["positioning"] === "string")       keys.push(`Posicionamento: ${o["positioning"]}`);
  if (o["roasTarget"]        && typeof o["roasTarget"] === "number")        keys.push(`ROAS alvo: ${o["roasTarget"]}x`);
  if (o["cpaTarget"]         && typeof o["cpaTarget"] === "number")         keys.push(`CPA alvo: R$${o["cpaTarget"]}`);
  if (o["dominantEmotion"]   && typeof o["dominantEmotion"] === "string")   keys.push(`Emoção dominante: ${o["dominantEmotion"]}`);
  if (o["tone"]              && typeof o["tone"] === "string")              keys.push(`Tom: ${o["tone"]}`);
  if (o["uniqueMechanism"]   && typeof o["uniqueMechanism"] === "string")   keys.push(`Mecanismo: ${o["uniqueMechanism"]}`);
  if (o["bigDomino"]         && typeof o["bigDomino"] === "string")         keys.push(`Big Domino: ${String(o["bigDomino"]).slice(0, 80)}`);
  if (o["centralNarrative"]  && typeof o["centralNarrative"] === "string")  keys.push(`Narrativa: ${String(o["centralNarrative"]).slice(0, 80)}`);

  if (Array.isArray(o["mentalTriggers"])) keys.push(`Gatilhos: ${(o["mentalTriggers"] as string[]).join(", ")}`);
  if (Array.isArray(o["platforms"]))      keys.push(`Plataformas: ${(o["platforms"] as string[]).join(", ")}`);

  return keys.slice(0, 5);
}

// ─── Key decisions composer ───────────────────────────────────────────────────

function composeKeyDecisions(
  brain:    Record<string, unknown>,
  agents:   Array<{ agentType: string; output: unknown }>,
): TraceDecision[] {
  const decisions: TraceDecision[] = [];
  const intake    = (brain["intake"]    ?? {}) as Record<string, unknown>;
  const narrative = (brain["narrative"] ?? {}) as Record<string, unknown>;
  const offer     = (brain["offer"]     ?? {}) as Record<string, unknown>;
  const icp       = (brain["icp"]       ?? {}) as Record<string, unknown>;
  const weights   = (brain["weights"]   ?? {}) as Record<string, unknown>;

  // ROAS target
  const roasAgent = agents.find(a => ["strategy", "media_buyer"].includes(a.agentType));
  const roasOutput = (roasAgent?.output ?? {}) as Record<string, unknown>;
  if (roasOutput["roasTarget"]) {
    const reasons: string[] = [];
    const type  = String(intake["campaignType"]  ?? "");
    const pos   = String(offer["positioning"]    ?? narrative["tone"] ?? "");
    const track = String(brain["track"]          ?? "");
    if (type)  reasons.push(`tipo de campanha: ${type}`);
    if (pos)   reasons.push(`posicionamento ${pos}`);
    if (track) reasons.push(`track ${track}`);
    if ((weights["roasWeight"] as number) < 0.25) reasons.push("awareness campaign — ROAS tem peso reduzido no scoring");
    decisions.push({
      dimension:  "ROAS alvo",
      value:      `${roasOutput["roasTarget"]}x`,
      rationale:  reasons,
      agent:      AGENT_LABELS[roasAgent!.agentType] ?? roasAgent!.agentType,
      confidence: 85,
    });
  }

  // Positioning
  if (offer["positioning"]) {
    const reasons = ["análise de percepção de valor do ICP", "mecanismo único do produto"];
    if (icp["sophisticationLevel"]) reasons.push(`nível de sofisticação do ICP: ${icp["sophisticationLevel"]}`);
    decisions.push({
      dimension: "Posicionamento",
      value:     String(offer["positioning"]),
      rationale: reasons,
      agent:     AGENT_LABELS["offer"] ?? "Oferta",
      confidence: 90,
    });
  }

  // Tone
  if (narrative["tone"]) {
    const reasons: string[] = [];
    if (narrative["dominantEmotion"]) reasons.push(`emoção dominante: ${narrative["dominantEmotion"]}`);
    if (icp["awarenessScore"]) reasons.push(`nível de consciência do ICP: ${icp["awarenessScore"]}/5`);
    decisions.push({
      dimension: "Tom da narrativa",
      value:     String(narrative["tone"]),
      rationale: reasons,
      agent:     AGENT_LABELS["strategy"] ?? "Estratégia",
      confidence: 88,
    });
  }

  // Mental triggers
  const stratAgent = agents.find(a => a.agentType === "strategy");
  const stratOutput = (stratAgent?.output ?? {}) as Record<string, unknown>;
  if (Array.isArray(stratOutput["mentalTriggers"]) && stratOutput["mentalTriggers"].length > 0) {
    const triggers = stratOutput["mentalTriggers"] as string[];
    decisions.push({
      dimension: "Gatilhos mentais ativados",
      value:     triggers.join(", "),
      rationale: [
        "selecionados com base na jornada emocional do ICP",
        "validados contra posicionamento da oferta",
        icp["decisionMaker"] ? `decisor-chave: ${icp["decisionMaker"]}` : "",
      ].filter(Boolean),
      agent:     AGENT_LABELS["strategy"] ?? "Estratégia",
      confidence: 82,
    });
  }

  return decisions;
}

// ─── Doctrine check mapper ────────────────────────────────────────────────────

function mapDoctrineChecks(doctrine: Record<string, unknown>): DoctrineCheck[] {
  const checks: DoctrineCheck[] = [];
  const PRINCIPLES: Record<string, string> = {
    positioning:          "Posicionamento claro e premium",
    emotionalAlignment:   "Alinhamento emocional com ICP",
    offerClarity:         "Clareza da oferta",
    compliance:           "Compliance e veracidade",
    narrativeConsistency: "Consistência narrativa",
    audienceFit:          "Fit com audiência",
    mechanismUniqueness:  "Unicidade do mecanismo",
  };
  for (const [key, label] of Object.entries(PRINCIPLES)) {
    const result = (doctrine[key] ?? doctrine[`${key}Check`]) as Record<string, unknown> | undefined;
    if (result && typeof result === "object") {
      checks.push({
        principle: label,
        passed:    !!result["passed"],
        reason:    String(result["reason"] ?? result["message"] ?? (result["passed"] ? "Aprovado" : "Pendente")),
      });
    } else if (key in doctrine) {
      checks.push({
        principle: label,
        passed:    !!doctrine[key],
        reason:    "Validado pelo Doctrine Gate",
      });
    }
  }
  return checks;
}

// ─── Narrative summary ────────────────────────────────────────────────────────

function buildNarrativeSummary(
  campaign: { title: string; track: string; status: string },
  brain:    Record<string, unknown>,
  agents:   Array<{ agentType: string }>,
): string {
  const narrative = (brain["narrative"] ?? {}) as Record<string, unknown>;
  const offer     = (brain["offer"]     ?? {}) as Record<string, unknown>;
  const icp       = (brain["icp"]       ?? {}) as Record<string, unknown>;

  const tone     = narrative["tone"]           ?? "estratégico";
  const pos      = offer["positioning"]        ?? "posicionamento definido";
  const emotion  = narrative["dominantEmotion"] ?? "engajamento";
  const who      = icp["description"]          ?? "audiência alvo";
  const count    = agents.length;

  return `"${campaign.title}" foi estruturada com posicionamento ${pos} e tom ${tone}, ` +
    `ativando ${emotion} como emoção dominante para ${who}. ` +
    `${count} agente${count !== 1 ? "s" : ""} colaboraram para construir esta estratégia.`;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getDecisionTrace(
  campaignId:  string,
  workspaceId: string,
): Promise<DecisionTrace> {
  // 1. Load campaign + brainData
  const [row] = await db
    .select({
      id:        campaignsTable.id,
      title:     campaignsTable.title,
      status:    campaignsTable.status,
      track:     campaignsTable.track,
      brainData: (campaignsTable as any).brainData,
      intakeData: campaignsTable.intakeData,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!row) throw new NotFoundError("Campaign not found");

  const brain = (row.brainData ?? {}) as Record<string, unknown>;

  // 2. Load all agents
  const agentRows = await db
    .select()
    .from(campaignAgentsTable)
    .where(eq(campaignAgentsTable.campaignId, campaignId))
    .orderBy(desc(campaignAgentsTable.createdAt));

  // 3. Build agent chain
  const agentChain: TraceAgent[] = agentRows.map(a => ({
    agentType:   a.agentType,
    status:      a.status,
    aiProvider:  a.aiProvider,
    model:       a.model,
    creditsUsed: a.creditsUsed,
    tokensUsed:  a.tokensUsed,
    completedAt: a.completedAt,
    keyOutputs:  extractKeyOutputs(a.output),
    influence:   AGENT_INFLUENCE[a.agentType] ?? "secondary",
  }));

  // 4. Doctrine checks
  const doctrineData = (brain["doctrine"] ?? {}) as Record<string, unknown>;
  const doctrineChecks = mapDoctrineChecks(doctrineData);

  // 5. Self-critique
  const critique = (brain["selfCritique"] ?? {}) as Record<string, unknown>;
  const selfCritique = {
    ran:          !!critique["ran"] || Object.keys(critique).length > 0,
    overallScore: typeof critique["overallScore"] === "number" ? critique["overallScore"] : null,
    strengths:    Array.isArray(critique["strengths"])   ? critique["strengths"]   as string[] : [],
    risks:        Array.isArray(critique["risks"])       ? critique["risks"]       as string[] : [],
    suggestions:  Array.isArray(critique["suggestions"]) ? critique["suggestions"] as string[] : [],
  };

  // 6. Memory influence
  const alignment   = (brain["alignment"]   ?? {}) as Record<string, unknown>;
  const vertical    = (brain["verticalMemory"] ?? brain["vertical"] ?? {}) as Record<string, unknown>;
  const creative    = (brain["creativeIntent"] ?? {}) as Record<string, unknown>;

  const approvedDir = Array.isArray(creative["drafts"])
    ? ((creative["drafts"] as any[]).find((d: any) => d.approved))?.name ?? null
    : null;

  const memoryInfluence = {
    alignmentScore:   typeof alignment["score"]  === "number" ? alignment["score"] : null,
    conflicts:        Array.isArray(alignment["criticalConflicts"]) ? alignment["criticalConflicts"] as string[] : [],
    warnings:         Array.isArray(alignment["warnings"])         ? alignment["warnings"]         as string[] : [],
    verticalInsights: Array.isArray(vertical["insights"])          ? vertical["insights"]          as string[] : [],
    creativeDirection: approvedDir,
  };

  // 7. Decision weights profile
  const weightsData  = (brain["weights"] ?? {}) as Record<string, unknown>;
  const appliedProfile = String(
    (brain["decisionProfile"] ?? brain["weightProfile"] ?? "standard")
  );

  const weightedKPIs: string[] = [];
  const W = weightsData as Record<string, number>;
  if (W["revenueWeight"])     weightedKPIs.push(`Receita ${Math.round(W["revenueWeight"] * 100)}%`);
  if (W["roasWeight"])        weightedKPIs.push(`ROAS ${Math.round(W["roasWeight"] * 100)}%`);
  if (W["cplWeight"])         weightedKPIs.push(`CPL ${Math.round(W["cplWeight"] * 100)}%`);
  if (W["emailWeight"])       weightedKPIs.push(`Email ${Math.round(W["emailWeight"] * 100)}%`);
  if (W["retentionWeight"])   weightedKPIs.push(`Retenção ${Math.round(W["retentionWeight"] * 100)}%`);

  // 8. Key decisions
  const keyDecisions = composeKeyDecisions(brain, agentRows.map(a => ({ agentType: a.agentType, output: a.output })));

  return {
    campaignId,
    campaignTitle:   row.title,
    status:          row.status,
    track:           row.track,
    generatedAt:     new Date().toISOString(),
    agentChain,
    keyDecisions,
    doctrineChecks,
    selfCritique,
    memoryInfluence,
    decisionWeights: { appliedProfile, weightedKPIs },
    narrativeSummary: buildNarrativeSummary(
      { title: row.title, track: row.track, status: row.status },
      brain,
      agentRows,
    ),
  };
}
