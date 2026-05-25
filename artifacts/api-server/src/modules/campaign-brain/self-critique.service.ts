/**
 * Self-Critique Estratégico — Camada 10: O sistema critica a si mesmo
 *
 * "O objetivo não é acertar sempre. É errar pouco, detectar rápido e adaptar melhor."
 *
 * Depois que um agente produz um output, o Self-Critique Engine pergunta:
 * "Dado o posicionamento, ICP e doutrina desta campanha, quais são os
 *  3 maiores riscos estratégicos nesta recomendação?"
 *
 * Não modifica o output. Não bloqueia a pipeline.
 * Apenas produz um relatório de riscos que enriquece o Campaign Brain
 * e fica disponível para o usuário e futuros agentes.
 *
 * Integration points:
 *  - command.agent.ts: setImmediate after strategy + offer agents
 *  - Writes: selfCritiques[] to Campaign Brain + critique-logs table
 *  - Uses: runAgent (Anthropic/Claude — best at strategic reasoning)
 */

import type { Logger } from "pino";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runAgent } from "../agents/agent.runner.js";
import { getCampaignBrain, updateBrainSection, type CampaignBrain } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategicRisk {
  risk:         string;        // Risk description
  severity:     "critical" | "moderate" | "low";
  category:     "positioning" | "audience" | "promise" | "execution" | "financial" | "narrative";
  mitigationHint: string;      // Suggested mitigation
}

export interface SelfCritiqueResult {
  agentType:     string;
  risks:         StrategicRisk[];
  doctrineNotes: string[];     // Specific doctrine alignment notes
  strengthNotes: string[];     // What the agent got right
  overallConfidence: number;   // 0-100: how confident the self-critique is in the output
  critiqueAt:    string;
}

// ─── Campaign Brain Extended Interface ───────────────────────────────────────
// We store selfCritiques on brainData — extend the brain type here
declare module "./campaign-brain.service.js" {
  interface CampaignBrain {
    selfCritiques?: SelfCritiqueResult[];
  }
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export async function runSelfCritique(
  campaignId:   string,
  workspaceId:  string,
  agentType:    string,
  agentOutput:  Record<string, unknown>,
  log:          Logger,
): Promise<SelfCritiqueResult | null> {
  try {
    const brain = await getCampaignBrain(campaignId);
    if (!brain) return null;

    const [campaign] = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    const intake = (campaign?.intakeData ?? {}) as Record<string, unknown>;

    const prompt = buildSelfCritiquePrompt(agentType, agentOutput, brain, intake);

    const result = await runAgent({
      systemPrompt: `Você é o Auditor Estratégico do NexOS. Você analisa outputs de agentes de IA contra a doutrina da campanha e identifica riscos estratégicos com precisão cirúrgica. Seja direto, específico e construtivo. Responda APENAS com JSON válido no formato especificado.`,
      messages: [{ role: "user", content: prompt }],
      workspaceId,
      campaignId,
      agentRole: "strategy",
      log,
    });

    const parsed = parseSelfCritiqueOutput(result.content, agentType);
    if (!parsed) return null;

    // Store in Campaign Brain (cap at 10 critiques to avoid bloat)
    const existingCritiques = (brain as any).selfCritiques ?? [];
    const updatedCritiques = [parsed, ...existingCritiques].slice(0, 10);
    await updateBrainSection(campaignId, "selfCritiques" as keyof CampaignBrain, updatedCritiques as any, log);

    log.info({
      campaignId, agentType,
      risks: parsed.risks.length,
      critical: parsed.risks.filter(r => r.severity === "critical").length,
      overallConfidence: parsed.overallConfidence,
    }, "Self-Critique Engine completed");

    return parsed;
  } catch (err) {
    log.warn({ err, campaignId, agentType }, "Self-Critique Engine failed — non-blocking");
    return null;
  }
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSelfCritiquePrompt(
  agentType:   string,
  agentOutput: Record<string, unknown>,
  brain:       CampaignBrain,
  intake:      Record<string, unknown>,
): string {
  // Truncate large outputs to stay within token budget
  const outputStr = JSON.stringify(agentOutput).slice(0, 2000);

  const offer = brain.offer as (typeof brain.offer & Record<string, unknown>) | undefined;
  const icp = brain.icp as (typeof brain.icp & Record<string, unknown>) | undefined;
  const narrative = brain.narrative as (typeof brain.narrative & Record<string, unknown>) | undefined;
  const alignment = brain.alignment;
  const conflicts: string[] = (alignment?.criticalConflicts as unknown as string[] | undefined) ?? [];

  return `
## CONTEXTO DA CAMPANHA
- Produto: ${offer?.["name"] || String(intake["product.name"] ?? "produto")}
- Preço: R$${offer?.["price"] ?? 0}
- Posicionamento: ${offer?.["positioning"] ?? "não definido"}
- Mecanismo único: ${offer?.["uniqueMechanism"] || "não definido"}
- ICP: ${icp?.["description"] || "não definido"} (awareness: ${icp?.["sophisticationLevel"] ?? "–"})
- Tom aprovado: ${narrative?.["tone"] ?? "não definido"}
- Emoção dominante: ${narrative?.["dominantEmotion"] ?? "não definida"}
- Alignment score atual: ${alignment?.score ?? 0}/100
${conflicts.length > 0 ? `- Conflitos já detectados: ${conflicts.join("; ")}` : ""}

## OUTPUT DO AGENTE "${agentType.toUpperCase()}"
${outputStr}

## TAREFA
Identifique os 3 maiores riscos estratégicos neste output considerando:
1. Coerência com posicionamento e ICP
2. Sustentabilidade das promessas/projections
3. Alinhamento de tom e narrativa com a doutrina
4. Riscos de execução ocultos

Responda APENAS com este JSON:
{
  "risks": [
    {
      "risk": "descrição clara do risco",
      "severity": "critical|moderate|low",
      "category": "positioning|audience|promise|execution|financial|narrative",
      "mitigationHint": "como mitigar em 1 frase"
    }
  ],
  "doctrineNotes": ["nota específica de doutrina 1", "nota 2"],
  "strengthNotes": ["o que o agente acertou 1"],
  "overallConfidence": 75
}`.trim();
}

// ─── Output Parser ────────────────────────────────────────────────────────────

function parseSelfCritiqueOutput(
  content:   string,
  agentType: string,
): SelfCritiqueResult | null {
  try {
    // Extract JSON from response
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const raw = JSON.parse(match[0]);

    const risks: StrategicRisk[] = (raw.risks ?? []).map((r: Record<string, unknown>) => ({
      risk:            String(r["risk"]            ?? ""),
      severity:        (r["severity"] as StrategicRisk["severity"]) ?? "moderate",
      category:        (r["category"] as StrategicRisk["category"]) ?? "execution",
      mitigationHint:  String(r["mitigationHint"] ?? ""),
    })).filter((r: StrategicRisk) => r.risk.length > 0);

    return {
      agentType,
      risks,
      doctrineNotes:    (raw.doctrineNotes ?? []).map(String),
      strengthNotes:    (raw.strengthNotes ?? []).map(String),
      overallConfidence: Math.min(100, Math.max(0, Number(raw.overallConfidence ?? 70))),
      critiqueAt:       new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
