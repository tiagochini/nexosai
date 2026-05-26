/**
 * DOMINO Agent — Revisor Filosófico Central da NEXOS AI
 *
 * Analisa qualquer copy, comunicação ou estratégia e avalia contra
 * o DOMINO CORE — retornando um diagnóstico com pontuação, problemas
 * identificados e sugestões de reescrita alinhadas à filosofia.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import {
  DOMINO_PERSUASION_STRUCTURE,
  DOMINO_COGNITIVE_MAP,
  DOMINO_PROHIBITED,
  DOMINO_STIMULATE,
  DOMINO_PERSUASION_MATRIX,
  DOMINO_SUPREME_RULE,
} from "./domino-core.js";
import type { Logger } from "pino";

export interface DominoAnalysisInput {
  content: string;
  contentType: "copy" | "email" | "whatsapp" | "ad" | "landing_page" | "onboarding" | "ux_string" | "strategy" | "other";
  context?: string;
  targetAvatar?: string;
  campaignPhase?: string;
}

export interface DominoViolation {
  type: "prohibited" | "missing_element" | "tone_mismatch" | "generic_poison" | "trauma_farming" | "false_urgency";
  severity: "critical" | "high" | "medium" | "low";
  excerpt: string;
  explanation: string;
}

export interface DominoSuggestion {
  element: string;
  current: string;
  rewritten: string;
  principle: string;
}

export interface DominoAnalysisOutput {
  dominoScore: number;
  scoreBreakdown: {
    identification: number;
    tension: number;
    restructuring: number;
    possibility: number;
    powerTransfer: number;
    action: number;
  };
  overallAssessment: string;
  violations: DominoViolation[];
  missingElements: string[];
  strengths: string[];
  suggestions: DominoSuggestion[];
  rewrittenVersion?: string;
  philosophicalAlignment: "misaligned" | "partial" | "aligned" | "exemplary";
  verdict: string;
}

const DOMINO_AGENT_PROMPT = `Você é o DOMINO — o revisor filosófico central da NEXOS AI.

Sua função é analisar comunicação com a profundidade de um estrategista de persuasão sênior
que estudou décadas de psicologia comportamental, copywriting científico e neurociência da decisão.

Você não busca erros gramaticais. Você busca falhas filosóficas — lugares onde a comunicação
perde a oportunidade de gerar identificação genuína, criar tensão legítima, reconstruir identidade,
ou conduzir o avatar para a ação de forma inevitável e não manipuladora.

## FILOSOFIA QUE GOVERNA SUA ANÁLISE

${DOMINO_SUPREME_RULE}

${DOMINO_COGNITIVE_MAP}

${DOMINO_PERSUASION_STRUCTURE}

${DOMINO_PROHIBITED}

${DOMINO_STIMULATE}

${DOMINO_PERSUASION_MATRIX}

## SISTEMA DE PONTUAÇÃO DOMINO (0-100)

Avalie cada um dos 6 Momentos de 0 a 100 (peso igual):

1. IDENTIFICAÇÃO (0-100): A pessoa se sente vista com precisão cirúrgica?
2. TENSÃO LEGÍTIMA (0-100): O custo da inércia está revelado sem manipulação?
3. REESTRUTURAÇÃO COGNITIVA (0-100): Culpa foi removida? Nova identidade instalada?
4. NOVA POSSIBILIDADE (0-100): O mecanismo está nomeado e diferenciado?
5. TRANSFERÊNCIA DE PODER (0-100): O avatar sente que tem o que faltava?
6. AÇÃO (0-100): A CTA é próximo passo lógico, não venda forçada?

dominoScore = média dos 6 momentos.

## TIPOS DE VIOLAÇÃO

- "prohibited": item explicitamente proibido pelo DOMINO (urgência falsa, hype, etc.)
- "missing_element": momento da estrutura completamente ausente
- "tone_mismatch": tom não adequado ao avatar ou fase da jornada
- "generic_poison": copy que poderia servir para qualquer concorrente
- "trauma_farming": abre dor sem entregar clareza ou esperança
- "false_urgency": urgência sem base real

## ALINHAMENTO FILOSÓFICO

- "misaligned": viola princípios centrais do DOMINO (score < 30)
- "partial": alguns elementos corretos, problemas estruturais (score 30-59)
- "aligned": respeitam a filosofia com espaço para refinamento (score 60-79)
- "exemplary": comunicação que o DOMINO usaria como referência (score 80+)

Retorne APENAS JSON válido no formato abaixo. Sem markdown, sem explicação fora do JSON.

{
  "dominoScore": 0,
  "scoreBreakdown": {
    "identification": 0,
    "tension": 0,
    "restructuring": 0,
    "possibility": 0,
    "powerTransfer": 0,
    "action": 0
  },
  "overallAssessment": "string — diagnóstico em 2-3 frases, direto e sem condescendência",
  "violations": [
    {
      "type": "prohibited",
      "severity": "critical",
      "excerpt": "trecho exato do conteúdo analisado",
      "explanation": "por que isso viola o DOMINO e qual o custo real"
    }
  ],
  "missingElements": ["elemento ausente 1", "elemento ausente 2"],
  "strengths": ["o que está funcionando e por quê"],
  "suggestions": [
    {
      "element": "nome do elemento (ex: headline, abertura, CTA)",
      "current": "texto atual",
      "rewritten": "versão reescrita segundo o DOMINO",
      "principle": "qual princípio do DOMINO foi aplicado na reescrita"
    }
  ],
  "rewrittenVersion": "versão completa reescrita (apenas se contentType for email, whatsapp ou ad)",
  "philosophicalAlignment": "aligned",
  "verdict": "uma frase que resume o veredito do DOMINO sobre este conteúdo"
}`;

export async function runDominoAnalysis(
  input: DominoAnalysisInput,
  workspaceId: string,
  log: Logger,
  campaignId?: string,
): Promise<DominoAnalysisOutput> {
  const contextBlock = [
    input.context ? `Contexto: ${input.context}` : null,
    input.targetAvatar ? `Avatar-alvo: ${input.targetAvatar}` : null,
    input.campaignPhase ? `Fase da campanha: ${input.campaignPhase}` : null,
    `Tipo de conteúdo: ${input.contentType}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runAgent({
    campaignId: campaignId ?? null,
    workspaceId,
    agentRole: "domino",
    systemPrompt: DOMINO_AGENT_PROMPT,
    messages: [
      {
        role: "user",
        content: `${contextBlock ? contextBlock + "\n\n" : ""}CONTEÚDO PARA ANÁLISE DOMINO:\n\n${input.content}`,
      },
    ],
    log,
    thinkingMessages: [
      "Mapeando o estado cognitivo-emocional do avatar...",
      "Identificando os 6 Momentos de Persuasão...",
      "Verificando violações do protocolo DOMINO...",
      "Calculando pontuação por dimensão filosófica...",
      "Construindo sugestões de reescrita...",
    ],
  });

  return parseAgentJSON<DominoAnalysisOutput>(result.content, {
    dominoScore: 0,
    scoreBreakdown: {
      identification: 0,
      tension: 0,
      restructuring: 0,
      possibility: 0,
      powerTransfer: 0,
      action: 0,
    },
    overallAssessment: result.content,
    violations: [],
    missingElements: [],
    strengths: [],
    suggestions: [],
    philosophicalAlignment: "partial",
    verdict: "Análise DOMINO indisponível — verifique o conteúdo enviado.",
  });
}
