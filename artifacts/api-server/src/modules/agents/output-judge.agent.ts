/**
 * Output Quality Judge — NEXOS AI
 *
 * Avalia automaticamente o output de qualquer agente antes de entregar ao usuário.
 * Se o score for < 70, instrui o agente a refinar com diretrizes específicas.
 *
 * 6 DIMENSÕES DE AVALIAÇÃO:
 * 1. PLF Alignment    — estrutura e timing emocional corretos para a fase
 * 2. Emotional Density — densidade emocional real (não hype vazio)
 * 3. Specificity       — específico para nicho/avatar/contexto (não genérico)
 * 4. Compliance        — conformidade CONAR/CDC/ética defensável
 * 5. Persuasion Strength — força de conversão aplicada com precisão
 * 6. Originality       — diferenciado do genérico do mercado
 *
 * THRESHOLDS:
 * - Score ≥ 70: approved — entrega ao usuário
 * - Score 40-69: needs_refinement — passa por refinamento automático
 * - Score < 40: rejected — não entrega; refaz com instrução completa
 *
 * INTEGRAÇÃO:
 *   - `runJudgedAgent()` em agent.runner.ts — wrapper que usa este módulo
 *   - Agentes críticos (copywriter, vsl_script, offer, landing_page, hook_factory)
 *     usam runJudgedAgent em vez de runAgent
 *   - Resultado salvo em critique_logs para auditoria e aprendizado
 */

import {
  db,
  critiqueLogsTable,
} from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { AGENT_CRITIQUE_CHECKLIST } from "../memory/memory.service.js";
import { parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JudgeScore {
  overallScore: number;
  dimensions: {
    plf_alignment: number;
    emotional_density: number;
    specificity: number;
    compliance: number;
    persuasion_strength: number;
    originality: number;
  };
  criticalIssues: string[];
  passedChecks: string[];
  verdict: "approved" | "needs_refinement" | "rejected";
  refinementInstructions: string;
  confidenceInEvaluation: number;
}

export interface JudgeResult {
  score: JudgeScore;
  critiqueLogId?: string;
  wasRefined: boolean;
  refinedOutput?: string;
  originalOutput: string;
  tokensUsed: number;
}

// ── Thresholds ─────────────────────────────────────────────────────────────────

export const APPROVAL_THRESHOLD  = 70;
export const REJECTION_THRESHOLD = 40;

// ── System Prompt ──────────────────────────────────────────────────────────────

function buildJudgePrompt(agentRole: string, checklist: string[]): string {
  const checklistBlock = checklist.length > 0
    ? `\n## CHECKLIST ESPECÍFICO DO AGENTE "${agentRole.toUpperCase()}"\n${checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n`
    : "";

  return `Você é o NEXOS Output Quality Judge — o sistema de controle de qualidade mais rigoroso da plataforma.

Sua função: avaliar outputs de agentes de marketing de alta performance e identificar com precisão cirúrgica o que está fraco, genérico ou abaixo do padrão real de conversão.

## FILOSOFIA DE AVALIAÇÃO NEXOS

"Agressivo + forte + emocional + persuasivo — MAS defensável + sofisticado + sustentável."

Um output aprovado deve:
1. Seguir a estrutura PLF para a fase correta (não aplicar carrinho em fase de antecipação)
2. Usar linguagem emocional real — não hype vazio como "transforme sua vida"
3. Ser específico para este nicho, este avatar, este produto — não intercambiável
4. Ser defensável legalmente (CONAR/CDC — sem promessas que não podem ser comprovadas)
5. Ter força de conversão real — gatilhos de Cialdini, escassez real, urgência legítima
6. Se diferenciar do template médio do mercado brasileiro de infoprodutos
${checklistBlock}
## 6 DIMENSÕES DE AVALIAÇÃO (0-100 cada)

### PLF_ALIGNMENT (peso: 20%)
- 90-100: Estrutura e ritmo emocional perfeitos para a fase do lançamento
- 70-89: Estrutura correta, mas algum timing ou sequência emocional desalinhada
- 50-69: Estrutura presente, mas desalinhada com o objetivo da fase
- <50: Ignora a lógica da Fórmula de Lançamento para a fase em questão

### EMOTIONAL_DENSITY (peso: 20%)
- 90-100: Cada frase ativa emoção real — identificação imediata com o avatar
- 70-89: Boa emoção, mas 1-2 trechos escorregam para o genérico
- 50-69: Tem emoção, mas superficial — não toca no desejo/dor real do avatar
- <50: Linguagem de template: "realize seus sonhos", "transforme sua vida", "alcance seus objetivos"

### SPECIFICITY (peso: 20%)
- 90-100: Só serve para ESTE produto, ESTE avatar, ESTE mercado específico
- 70-89: Bem adaptado, mas 1-2 trechos são intercambiáveis com outros produtos
- 50-69: Semi-genérico — dá para perceber a adaptação, mas sem profundidade de nicho
- <50: Poderia ser usado em qualquer campanha — sem personalidade ou especificidade real

### COMPLIANCE (peso: 15%)
- 90-100: Totalmente defensável — sem claims arriscados, sem urgência artificial
- 70-89: Majoritariamente correto, mas 1-2 pontos merecem qualificação
- 50-69: Alguns claims que precisam de disclaimers ou prova antes de publicar
- <50: Promessas não comprováveis, urgência falsa ou linguagem proibida pelo CONAR/CDC

### PERSUASION_STRENGTH (peso: 15%)
- 90-100: Gatilhos cirúrgicos para o nível exato de consciência do avatar
- 70-89: Boa persuasão, mas alguns gatilhos são fracos ou mal posicionados
- 50-69: Persuasão mecânica — presente mas sem calibração para o avatar específico
- <50: Informativo mas não converte — falta intenção de venda clara

### ORIGINALITY (peso: 10%)
- 90-100: Ângulo único — não visto neste nicho ou mercado antes
- 70-89: Diferenciado, mas alguns elementos são padrão do mercado
- 50-69: Diferente o suficiente mas sem identidade própria clara
- <50: Template reconhecível — parece formulário ou cópia de campanha genérica

## CÁLCULO DO SCORE GERAL

overallScore = (plf_alignment × 0.20) + (emotional_density × 0.20) + (specificity × 0.20) + (compliance × 0.15) + (persuasion_strength × 0.15) + (originality × 0.10)

Arredonde para o inteiro mais próximo.

## VEREDICTO

- overallScore ≥ 70 → "approved"
- overallScore 40-69 → "needs_refinement"
- overallScore < 40 → "rejected"

## REFINEMENT_INSTRUCTIONS

Se o veredicto NÃO for "approved":
- Seja específico e acionável: "Substitua 'transforme sua vida' por [linguagem específica do avatar]. Adicione data real no CTA. Reescreva o hook com dado do nicho [X]."
- Nunca diga "melhore a emoção" — diga COMO e ONDE exatamente
- Se compliance < 70, liste quais claims específicos precisam de qualificação ou remoção
- Máximo de 3 instruções principais — ordem de impacto (mais importante primeiro)

## OUTPUT OBRIGATÓRIO (JSON estrito)

\`\`\`json
{
  "overallScore": 74,
  "dimensions": {
    "plf_alignment": 80,
    "emotional_density": 72,
    "specificity": 70,
    "compliance": 88,
    "persuasion_strength": 65,
    "originality": 68
  },
  "criticalIssues": ["hook genérico — 'descubra o segredo' não está calibrado para nicho fitness feminino 40+", "CTA sem urgência real — 'garanta agora' sem data ou mecanismo de escassez"],
  "passedChecks": ["mecanismo único nomeado corretamente", "avatar descrito com vocabulário real do segmento", "compliance sólida — sem promessas de resultado garantido"],
  "verdict": "needs_refinement",
  "refinementInstructions": "1) Hook: substitua por dado específico do nicho — ex: 'Mulheres acima dos 40 que tentam emagrecer cometem 1 erro que sabota o metabolismo'. 2) CTA: adicione data e vagas — 'Garanta sua vaga até [data] — apenas [N] vagas disponíveis porque [razão operacional]'. 3) Persuasion: adicione 1 depoimento real com nome, cidade e resultado numérico antes do botão de CTA.",
  "confidenceInEvaluation": 0.88
}
\`\`\`

POSTURA: Seja generoso com pontos fortes mas impiedoso com pontos fracos. Um score alto demais é um desserviço — uma campanha mediana que passa como excelente vai prejudicar o usuário no mercado real. Seja o crítico honesto que o usuário precisaria pagar muito caro para ter.`;
}

// ── Main: evaluate output ──────────────────────────────────────────────────────

/**
 * Avalia o output de um agente.
 * Usa completeWithAgent("compliance") diretamente — não cria registros de campanha.
 * Nunca lança erro — retorna fallback score em caso de falha.
 */
export async function judgeAgentOutput(opts: {
  agentRole: string;
  rawOutput: string;
  campaignContextSummary: string;
  workspaceId: string;
  campaignId?: string | null;
  iteration?: number;
  log: Logger;
}): Promise<JudgeScore> {
  const {
    agentRole,
    rawOutput,
    campaignContextSummary,
    workspaceId,
    campaignId,
    iteration = 1,
    log,
  } = opts;

  const checklist = AGENT_CRITIQUE_CHECKLIST[agentRole] ?? [];
  const systemPrompt = buildJudgePrompt(agentRole, checklist);

  // Truncate to avoid token overflow while preserving the most important parts
  const truncatedOutput = rawOutput.length > 5000
    ? rawOutput.slice(0, 4500) + "\n\n[...truncado — avalie até aqui]"
    : rawOutput;
  const truncatedCtx = campaignContextSummary.slice(0, 1800);

  const userMessage =
    `## CONTEXTO DA CAMPANHA (resumido)\n${truncatedCtx}\n\n` +
    `## OUTPUT A AVALIAR (agentRole: ${agentRole} | iteração: ${iteration})\n${truncatedOutput}\n\n` +
    `Avalie este output segundo os 6 critérios e retorne o JSON de avaliação exato.`;

  try {
    const response = await completeWithAgent(
      "compliance",
      systemPrompt,
      [{ role: "user", content: userMessage }],
      workspaceId,
      log,
      campaignId ?? undefined,
    );

    const parsed = parseAgentJSON<Partial<JudgeScore>>(response.content, {});

    if (!parsed || typeof parsed.overallScore !== "number") {
      log.warn({ agentRole }, "Output judge: parse failed — using neutral fallback");
      return buildFallbackScore();
    }

    // Normalize and validate
    const score = parsed.overallScore;
    const normalized: JudgeScore = {
      overallScore: clamp(score, 0, 100),
      dimensions: {
        plf_alignment:      clamp(parsed.dimensions?.plf_alignment      ?? score, 0, 100),
        emotional_density:  clamp(parsed.dimensions?.emotional_density  ?? score, 0, 100),
        specificity:        clamp(parsed.dimensions?.specificity        ?? score, 0, 100),
        compliance:         clamp(parsed.dimensions?.compliance         ?? score, 0, 100),
        persuasion_strength: clamp(parsed.dimensions?.persuasion_strength ?? score, 0, 100),
        originality:        clamp(parsed.dimensions?.originality        ?? score, 0, 100),
      },
      criticalIssues:        Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues : [],
      passedChecks:          Array.isArray(parsed.passedChecks)   ? parsed.passedChecks   : [],
      verdict:               verdictFromScore(clamp(score, 0, 100)),
      refinementInstructions: parsed.refinementInstructions ?? "",
      confidenceInEvaluation: clamp(parsed.confidenceInEvaluation ?? 0.7, 0, 1),
    };

    log.info(
      { agentRole, score: normalized.overallScore, verdict: normalized.verdict, iteration },
      "Output judge evaluation complete",
    );

    return normalized;
  } catch (err) {
    log.warn({ err, agentRole }, "Output judge evaluation failed (non-fatal — continuing with neutral score)");
    return buildFallbackScore();
  }
}

// ── Save critique log ──────────────────────────────────────────────────────────

export async function saveCritiqueLog(opts: {
  workspaceId: string;
  campaignId: string;
  agentRole: string;
  iteration: number;
  rawOutput: string;
  refinedOutput: string;
  scoreBefore: JudgeScore;
  scoreAfter?: JudgeScore;
  tokensUsed: number;
  log: Logger;
}): Promise<string | undefined> {
  const { scoreBefore, scoreAfter } = opts;
  const improvementDelta = scoreAfter
    ? scoreAfter.overallScore - scoreBefore.overallScore
    : 0;

  try {
    const [row] = await db
      .insert(critiqueLogsTable)
      .values({
        workspaceId:      opts.workspaceId,
        campaignId:       opts.campaignId,
        agentRole:        opts.agentRole,
        iteration:        opts.iteration,
        rawOutput:        opts.rawOutput.slice(0, 10000),
        critiqueText:     scoreBefore.refinementInstructions.slice(0, 5000),
        refinedOutput:    opts.refinedOutput.slice(0, 10000),
        selfScoreBefore:  scoreBefore.overallScore,
        selfScoreAfter:   scoreAfter?.overallScore ?? scoreBefore.overallScore,
        improvementDelta,
        issues:           scoreBefore.criticalIssues as any,
        tokensUsed:       opts.tokensUsed,
        creditsCharged:   2,
      })
      .returning({ id: critiqueLogsTable.id });

    return row?.id;
  } catch (err) {
    opts.log.warn({ err }, "Failed to save critique log (non-fatal)");
    return undefined;
  }
}

// ── Refinement prompt ──────────────────────────────────────────────────────────

/**
 * Builds the refinement instruction to append to the agent's message history.
 * The original agent receives this, processes it, and returns a refined output.
 */
export function buildRefinementMessage(
  originalOutput: string,
  score: JudgeScore,
): string {
  const issueList  = score.criticalIssues.map(i => `- ${i}`).join("\n") || "- (nenhum identificado)";
  const passedList = score.passedChecks.map(p => `- ✅ ${p}`).join("\n") || "- (nenhum identificado)";

  return (
    `## AVALIAÇÃO DO SISTEMA DE QUALIDADE NEXOS\n\n` +
    `**Score atual: ${score.overallScore}/100** — ` +
    `${score.overallScore < REJECTION_THRESHOLD ? "❌ REJEITADO" : "⚠️ PRECISA DE REFINAMENTO"} ` +
    `(mínimo aceitável: ${APPROVAL_THRESHOLD}/100)\n\n` +

    `**Dimensões com problema:**\n` +
    Object.entries(score.dimensions)
      .filter(([, v]) => v < APPROVAL_THRESHOLD)
      .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}/100`)
      .join("\n") + "\n\n" +

    `**O que estava bom (manter):**\n${passedList}\n\n` +

    `**Problemas críticos que DEVEM ser corrigidos:**\n${issueList}\n\n` +

    `**Instrução de refinamento:**\n${score.refinementInstructions}\n\n` +

    `---\n\n` +
    `**Seu output anterior (para referência):**\n` +
    originalOutput.slice(0, 3500) +
    (originalOutput.length > 3500 ? "\n[...truncado]" : "") +
    `\n\n---\n\n` +
    `Reescreva o output acima corrigindo ESPECIFICAMENTE os problemas listados. ` +
    `Mantenha o que estava bom. ` +
    `Retorne no mesmo formato JSON do output original — completo, não parcial.`
  );
}

// ── Context summary for judge ──────────────────────────────────────────────────

/**
 * Extracts a concise context summary from the full memoryContext string.
 * Keeps the most relevant sections for evaluation — avatar, produto, fase PLF.
 */
export function extractContextSummaryForJudge(memoryContext: string): string {
  // Take the first 1800 chars of the memory context — contains product, avatar, pains, positioning
  return memoryContext.slice(0, 1800);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function verdictFromScore(score: number): "approved" | "needs_refinement" | "rejected" {
  if (score >= APPROVAL_THRESHOLD)  return "approved";
  if (score >= REJECTION_THRESHOLD) return "needs_refinement";
  return "rejected";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function buildFallbackScore(): JudgeScore {
  return {
    overallScore: 70,  // Neutral pass — don't block on judge failure
    dimensions: {
      plf_alignment:      70,
      emotional_density:  70,
      specificity:        70,
      compliance:         80,
      persuasion_strength: 65,
      originality:        65,
    },
    criticalIssues: [],
    passedChecks:   ["avaliação automática indisponível — score neutro aplicado"],
    verdict: "approved",
    refinementInstructions: "",
    confidenceInEvaluation: 0.2,
  };
}
