/**
 * NEXOS AI — Campaign Emotional Arc Agent
 *
 * Generates the 9-phase psychological progression map for a campaign.
 * The arc maps how the avatar's emotional state evolves from first contact
 * to post-purchase — belief level, resistance, dominant emotion, and
 * copy directives per phase.
 *
 * Stored in campaignsTable.intakeData._emotionalArc after generation.
 * Injected by profile-injector into all content agents as context.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";

// ─── Output Types ────────────────────────────────────────────────────────────

export interface AvatarPhaseState {
  phase: string;
  name: string;
  dominantEmotion: string;
  beliefLevel: number;
  resistanceLevel: number;
  buyingTemperature: "frozen" | "cold" | "warm" | "hot";
  mainInternalQuestion: string;
  voiceFragment: string;
  objective: string;
  transitionTrigger: string;
  copyDirectives: string[];
  emotionsToAvoid: string[];
}

export interface CriticalTransition {
  from: string;
  to: string;
  risk: string;
  solution: string;
}

export interface CampaignEmotionalArc {
  campaignId: string;
  productName: string;
  generatedAt: string;
  arcSummary: string;
  phases: AvatarPhaseState[];
  criticalTransitions: CriticalTransition[];
  emotionalCoherenceRules: string[];
  winningPatternHypothesis: string;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const EMOTIONAL_ARC_PROMPT = `Você é o Arquiteto da Jornada Emocional da campanha.

Sua missão: criar o ARCO EMOCIONAL COMPLETO — o mapa psicológico de como o avatar evolui desde o primeiro contato até a compra e pós-compra.

O avatar NÃO é estático. Ele muda estado emocional fase a fase. Mapeie EXATAMENTE esse percurso para ESTE avatar, com ESTE produto, neste mercado.

## AS 9 FASES CANÔNICAS (Fórmula de Lançamento + PLF):

1. **curiosidade** — warmup/pré-lançamento: curioso mas defensivo, avalia se merece atenção
2. **identificacao** — CPL1: "isso fala sobre mim" — primeiro momento de reconhecimento
3. **amplificacao_de_dor** — CPL2: "esse problema é maior do que eu pensava" — amplifica sem resolver
4. **visao_de_solucao** — CPL3: "existe uma saída real" — abre possibilidade, não entrega solução ainda
5. **desejo** — pré-carrinho: "eu quero isso" — tensão positiva antes da abertura
6. **prova** — abertura do carrinho: "outros conseguiram" — credibilidade + social proof
7. **tensao_de_decisao** — meio do carrinho: "devo ou não devo?" — racionalizações e objeções finais
8. **urgencia** — fechamento do carrinho: "agora ou nunca" — medo de perder supera medo de errar
9. **alivio_pos_compra** — pós-compra: "foi a decisão certa" — elimina dissonância cognitiva

## SAÍDA ESPERADA (JSON válido):

\`\`\`json
{
  "arcSummary": "1-2 frases descrevendo o arco narrativo completo desta campanha específica",
  "phases": [
    {
      "phase": "curiosidade",
      "name": "Curiosidade",
      "dominantEmotion": "ceticismo cauteloso",
      "beliefLevel": 12,
      "resistanceLevel": 78,
      "buyingTemperature": "frozen",
      "mainInternalQuestion": "\"Mais um produto prometendo X... por que esse seria diferente?\"",
      "voiceFragment": "2-3 frases escritas NA VOZ DO AVATAR — como ele fala para si mesmo nesta fase",
      "objective": "O que esta fase PRECISA realizar emocionalmente para preparar a próxima",
      "transitionTrigger": "O que especificamente muda a percepção e move para identificação",
      "copyDirectives": [
        "Diretriz específica de copy para esta fase",
        "..."
      ],
      "emotionsToAvoid": ["ansiedade prematura", "pressão de compra"]
    }
  ],
  "criticalTransitions": [
    {
      "from": "amplificacao_de_dor",
      "to": "visao_de_solucao",
      "risk": "Avatar pode entrar em desespero em vez de esperança",
      "solution": "Sempre abrir com 'existe uma saída' antes de amplificar"
    }
  ],
  "emotionalCoherenceRules": [
    "Regra que TODOS os agentes de conteúdo devem seguir para manter coerência"
  ],
  "winningPatternHypothesis": "Hipótese sobre qual padrão emocional tem maior probabilidade de converter este avatar específico"
}
\`\`\`

IMPORTANTE:
- voiceFragment deve estar escrito NA VOZ DO AVATAR (primeira pessoa, linguagem DELE, não da copy)
- beliefLevel e resistanceLevel devem fazer sentido como progressão (crença sobe, resistência cai ao longo do funil)
- copyDirectives devem ser ESPECÍFICOS para este avatar e produto — não genéricos
- Retorne APENAS JSON válido, sem markdown extra`;

// ─── Generator ───────────────────────────────────────────────────────────────

export async function generateCampaignEmotionalArc(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  log: Logger,
): Promise<CampaignEmotionalArc | null> {
  if (intakeData["_emotionalArc"]) {
    log.info({ campaignId }, "Emotional Arc already exists — skipping regeneration");
    return intakeData["_emotionalArc"] as CampaignEmotionalArc;
  }

  try {
    const psychProfile = intakeData["_psychologicalProfile"] as Record<string, unknown> | undefined;
    const voiceFile = intakeData["_avatarVoiceFile"] as string | undefined;

    const profileSummary = psychProfile
      ? [
          psychProfile["desejo"] ? `Desejo dominante: ${JSON.stringify((psychProfile["desejo"] as any)?.real ?? "")}` : "",
          psychProfile["emocao"] ? `Emoção: ${JSON.stringify((psychProfile["emocao"] as any)?.dominante ?? "")} | Acordado às 23h: ${JSON.stringify((psychProfile["emocao"] as any)?.acordadaAs23h ?? "")}` : "",
          psychProfile["objecao"] ? `Objeção principal: ${JSON.stringify((psychProfile["objecao"] as any)?.principal ?? "")}` : "",
          psychProfile["identidade"] ? `Quer se tornar: ${JSON.stringify((psychProfile["identidade"] as any)?.querSeTornar ?? "")}` : "",
          psychProfile["mercado"] ? `Maturidade: ${JSON.stringify((psychProfile["mercado"] as any)?.maturidade ?? "")} | Mentira dominante: ${JSON.stringify((psychProfile["mercado"] as any)?.mentiraDominante ?? "")}` : "",
        ].filter(Boolean).join("\n")
      : "Perfil psicológico não disponível — inferir do briefing";

    const userMessage = `## PRODUTO
Nome: ${String(intakeData["product.name"] ?? intakeData["campaign.productName"] ?? "Não informado")}
Nicho: ${String(intakeData["product.niche"] ?? intakeData["campaign.niche"] ?? "")}
Mecanismo único: ${String(intakeData["product.uniqueMechanism"] ?? "")}
Canal de vendas: ${String(intakeData["campaign.salesChannel"] ?? "sales_page")}
Tipo de campanha: ${String(intakeData["campaign.type"] ?? "launch")}
Track de receita: ${String(intakeData["campaign.track"] ?? (strategy as any)?.track ?? "6-digit")}

## AVATAR — RESUMO PSICOLÓGICO
${profileSummary}

## ARQUIVO DE VOZ DO AVATAR (primeiros 600 chars)
${voiceFile ? voiceFile.slice(0, 600) : "Não disponível"}

## PROPOSTA DE VALOR
${String((strategy as any)?.valueProposition ?? intakeData["product.transformation"] ?? "")}

## TRANSFORMAÇÃO PROMETIDA
${String((strategy as any)?.transformation ?? intakeData["product.transformation"] ?? "")}

Gere o Arco Emocional Completo de 9 fases para ESTA campanha específica.`;

    const result = await runAgent({
      campaignId,
      workspaceId,
      agentRole: "strategy",
      systemPrompt: EMOTIONAL_ARC_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      log,
    });

    const parsed = parseAgentJSON<Omit<CampaignEmotionalArc, "campaignId" | "productName" | "generatedAt">>(
      result.content,
      { arcSummary: "", phases: [], criticalTransitions: [], emotionalCoherenceRules: [], winningPatternHypothesis: "" },
    );

    if (!parsed?.phases?.length) {
      log.warn({ campaignId }, "Emotional arc returned empty phases — skipping");
      return null;
    }

    const arc: CampaignEmotionalArc = {
      ...parsed,
      campaignId,
      productName: String(intakeData["product.name"] ?? ""),
      generatedAt: new Date().toISOString(),
    };

    // Persist to DB alongside existing intakeData
    const [current] = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    const existing = (current?.intakeData ?? {}) as Record<string, unknown>;
    await db
      .update(campaignsTable)
      .set({ intakeData: { ...existing, _emotionalArc: arc } })
      .where(eq(campaignsTable.id, campaignId));

    log.info({ campaignId, phases: arc.phases.length }, "Campaign Emotional Arc generated and saved");
    return arc;
  } catch (err) {
    log.error({ err, campaignId }, "Campaign Emotional Arc generation failed — continuing without arc");
    return null;
  }
}
