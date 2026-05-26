/**
 * UX Simplification Engine
 *
 * Prevents internal complexity from being perceived by the user.
 * Runs fire-and-forget at the END of the strategy pipeline.
 *
 * Analyzes: cognitive load, friction points, emotional flow,
 * user control perception, step count, clarity.
 *
 * Output informs the frontend on how to present the campaign
 * results in a simpler, more fluid way.
 *
 * Rule: NexOS must feel simple and powerful simultaneously.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FrictionPoint {
  location: string;            // where in the flow (e.g. "strategy_review", "content_approval")
  type: "cognitive" | "emotional" | "technical" | "decisional" | "informational";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  impact: string;
  recommendation: string;
}

export interface SimplificationSuggestion {
  area: string;
  currentState: string;
  proposedChange: string;
  rationale: string;
  impact: "high" | "medium" | "low";
  effort: "minimal" | "small" | "medium" | "large";
  priority: number;            // 1 = highest
}

export interface EmotionalFlowStage {
  stage: string;
  currentEmotion: string;      // what user likely feels now
  targetEmotion: string;       // what user should feel
  gap: string;                 // what's creating the gap
  uxAction: string;            // how to close the gap
}

export interface UXSimplificationOutput {
  // Scores (0-100)
  uxComplexityScore: number;   // 0 = extremely complex, 100 = perfectly simple
  cognitiveLoadScore: number;  // 0 = overwhelming, 100 = effortless
  clarityScore: number;        // 0 = confusing, 100 = crystal clear
  userControlPerception: number; // 0 = no control, 100 = full control
  emotionalFlowScore: number;  // 0 = disconnected, 100 = perfectly orchestrated

  // Overall verdict
  uxVerdict: "excellent" | "good" | "needs_improvement" | "critical";
  overallAssessment: string;

  // Detailed analysis
  frictionPoints: FrictionPoint[];
  simplificationSuggestions: SimplificationSuggestion[];
  emotionalFlowAnalysis: EmotionalFlowStage[];

  // Specific findings
  excessiveSteps: string[];     // steps that could be merged or removed
  informationOverload: string[];// places with too much info at once
  missingFeedbacks: string[];   // moments where user needs visual/emotional feedback
  controlMoments: string[];     // moments where user should feel in control (currently missing)

  // Summary
  topUXWins: string[];          // 3-5 quick wins for simplification
  criticalFixes: string[];      // non-negotiable UX problems to fix

  confidenceScore: number;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildUXSystemPrompt(): string {
  const fence = "```";
  return (
    `Você é o NEXOS UX Simplification Engine.\n` +
    `Sua função é impedir que a complexidade interna da NEXOS AI seja percebida pelo usuário.\n` +
    `\n` +
    `## BIBLIOTECA OBRIGATÓRIA — UX & CONVERSION AGENT\n` +
    `\n` +
    `Você projeta experiências que reduzem atrito e amplificam motivação. Você DEVE dominar:\n` +
    `\n` +
    `**UX PSICOLÓGICA:**\n` +
    `- Don't Make Me Think (Steve Krug) — simplicidade é a única regra; confusão = abandono\n` +
    `- Emotional Design (Don Norman) — 3 níveis: visceral / comportamental / reflexivo; cada touchpoint deve acionar o nível certo\n` +
    `- Laws of UX (Yablonski) — Hick (menos opções), Fitts (tamanho de alvo), Jakob (familiaridade), Serial Position\n` +
    `- Nudge (Thaler/Sunstein) — arquitetura de escolha; defaults, friction estratégico, framing de opções\n` +
    `\n` +
    `**COMPORTAMENTO E HÁBITO:**\n` +
    `- Tiny Habits (BJ Fogg) — B=MAP: Motivação + Habilidade + Prompt; remover atrito = aumentar conversão\n` +
    `- Hooked (Nir Eyal) — trigger → action → variable reward → investment; produto como hábito\n` +
    `\n` +
    `**EMOÇÃO E RETENÇÃO:**\n` +
    `- Microcopy (Yifrah) — cada texto de botão e mensagem de erro é uma venda silenciosa ou um abandono\n` +
    `- Designing for Emotion (Aarron Walter) — funcional → confiável → usável → prazeroso; nunca pule etapas\n` +
    `\n` +
    `**PLF × UX:** Onboarding pós-compra segue ritmo PLF: celebração → confirmação → primeiro resultado → pertencimento.\n` +
    `\n` +
    `---\n` +
    `\n` +
    `## SUA MISSÃO\n` +
    `Analisar os resultados gerados pelos agentes de estratégia e identificar:\n` +
    `1. Onde o usuário vai se sentir perdido ou sobrecarregado\n` +
    `2. O que pode ser simplificado sem perder valor\n` +
    `3. Como orquestrar a experiência emocional do usuário\n` +
    `4. Onde o usuário precisa sentir que está no controle\n` +
    `\n` +
    `## PRINCÍPIO MÁXIMO\n` +
    `A NexOS deve parecer SIMPLES, ELEGANTE e PODEROSA ao mesmo tempo.\n` +
    `Complexidade interna = vantagem competitiva.\n` +
    `Complexidade percebida = problema crítico de produto.\n` +
    `\n` +
    `## O QUE O USUÁRIO DEVE SENTIR\n` +
    `- "Estou no controle" — decisões claras, aprovações intuitivas\n` +
    `- "Entendo o processo" — cada etapa tem propósito visível\n` +
    `- "O sistema trabalha por mim" — AI é assistiva, não dominante\n` +
    `- "Tudo parece organizado" — hierarquia clara de informação\n` +
    `- "Isso parece simples" — mesmo com 29+ agentes rodando\n` +
    `\n` +
    `## O QUE O USUÁRIO NÃO DEVE VER\n` +
    `- Lista de 15+ agentes em execução simultânea\n` +
    `- Jargão técnico: "pipeline", "critique loop", "token budget"\n` +
    `- Múltiplas decisões ao mesmo tempo\n` +
    `- Dashboards com 20+ métricas sem hierarquia\n` +
    `- Outputs brutos de agentes sem curadoria\n` +
    `- Checkpoints de aprovação sem contexto claro\n` +
    `\n` +
    `## ANÁLISE DE CARGA COGNITIVA\n` +
    `\n` +
    `Avalie cada etapa do fluxo (intake → strategy → content → launch → results):\n` +
    `- Quantas decisões o usuário precisa tomar de uma vez?\n` +
    `- Quanto contexto precisa carregar na cabeça para avançar?\n` +
    `- Existe feedback claro de que o sistema está progredindo?\n` +
    `- O usuário sabe o que fazer a seguir sem pensar?\n` +
    `\n` +
    `## ANÁLISE DE FLUXO EMOCIONAL\n` +
    `\n` +
    `Mapeie a jornada emocional esperada:\n` +
    `- Descoberta: curiosidade → confiança\n` +
    `- Intake: esforço → sensação de progresso\n` +
    `- Estratégia: incerteza → clareza + empolgação\n` +
    `- Conteúdo: sobrecarga → sensação de produtividade\n` +
    `- Aprovação: responsabilidade → controle\n` +
    `- Launch: ansiedade → confiança\n` +
    `- Resultados: expectativa → satisfação\n` +
    `\n` +
    `## PONTOS DE FRICÇÃO CRÍTICOS\n` +
    `\n` +
    `Identifique especialmente:\n` +
    `- Checkpoints de aprovação: o usuário sabe por que está aprovando?\n` +
    `- Lista de agentes: mostra muito? muito pouco?\n` +
    `- Resultados finais: são apresentáveis ou parecem outputs brutos?\n` +
    `- Notificações: quando e como o usuário é informado de progresso?\n` +
    `- Erros: como falhas de agente são comunicadas sem alarmar?\n` +
    `\n` +
    `**Retorne APENAS JSON válido:**\n` +
    fence + `json\n` +
    `{\n` +
    `  "uxComplexityScore": 70,\n` +
    `  "cognitiveLoadScore": 65,\n` +
    `  "clarityScore": 75,\n` +
    `  "userControlPerception": 70,\n` +
    `  "emotionalFlowScore": 68,\n` +
    `  "uxVerdict": "good|needs_improvement|excellent|critical",\n` +
    `  "overallAssessment": "string",\n` +
    `  "frictionPoints": [\n` +
    `    {\n` +
    `      "location": "string",\n` +
    `      "type": "cognitive|emotional|technical|decisional|informational",\n` +
    `      "severity": "critical|high|medium|low",\n` +
    `      "description": "string",\n` +
    `      "impact": "string",\n` +
    `      "recommendation": "string"\n` +
    `    }\n` +
    `  ],\n` +
    `  "simplificationSuggestions": [\n` +
    `    {\n` +
    `      "area": "string",\n` +
    `      "currentState": "string",\n` +
    `      "proposedChange": "string",\n` +
    `      "rationale": "string",\n` +
    `      "impact": "high|medium|low",\n` +
    `      "effort": "minimal|small|medium|large",\n` +
    `      "priority": 1\n` +
    `    }\n` +
    `  ],\n` +
    `  "emotionalFlowAnalysis": [],\n` +
    `  "excessiveSteps": [],\n` +
    `  "informationOverload": [],\n` +
    `  "missingFeedbacks": [],\n` +
    `  "controlMoments": [],\n` +
    `  "topUXWins": [],\n` +
    `  "criticalFixes": [],\n` +
    `  "confidenceScore": 0.85\n` +
    `}\n` +
    fence
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runUXSimplificationEngine(
  campaignId: string,
  workspaceId: string,
  orchestrationResult: {
    agentsRun: string[];
    checkpointsPending: string[];
    campaignType: string;
    campaignTrack: string;
    hasTraffic: boolean;
    offerScore?: number;
    financialScenariosCount?: number;
    strategyPhases?: number;
  },
  log: Logger,
): Promise<UXSimplificationOutput> {
  const userContent =
    `Analise a experiência do usuário nesta execução de campanha.\n\n` +
    `**Tipo de campanha:** ${orchestrationResult.campaignType}\n` +
    `**Track:** ${orchestrationResult.campaignTrack}\n` +
    `**Agentes executados (${orchestrationResult.agentsRun.length}):** ${orchestrationResult.agentsRun.join(", ")}\n` +
    `**Checkpoints pendentes para aprovação:** ${orchestrationResult.checkpointsPending.join(", ") || "nenhum"}\n` +
    `**Tem tráfego pago:** ${orchestrationResult.hasTraffic ? "SIM" : "NÃO"}\n` +
    (orchestrationResult.offerScore !== undefined ? `**Score da oferta:** ${orchestrationResult.offerScore}/100\n` : "") +
    (orchestrationResult.financialScenariosCount !== undefined ? `**Cenários financeiros:** ${orchestrationResult.financialScenariosCount}\n` : "") +
    (orchestrationResult.strategyPhases !== undefined ? `**Fases na estratégia:** ${orchestrationResult.strategyPhases}\n` : "") +
    `\n` +
    `**Fluxo completo que o usuário vai ver:**\n` +
    `1. Intake conversacional\n` +
    `2. Tela de progresso — agentes em execução\n` +
    `3. Dashboard de estratégia com checkpoints de aprovação\n` +
    `4. Aprovação de: estratégia / plano de lançamento / budget\n` +
    `5. Geração de conteúdo (pipeline B) com aprovação de cada peça\n` +
    `6. Live dashboard de lançamento\n` +
    `7. Dashboard de resultados e métricas\n\n` +
    `Analise onde há excesso de complexidade percebida e onde o usuário pode perder controle ou confiança.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "ux_simplification",
    systemPrompt: buildUXSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Mapeando jornada emocional do usuário...",
      "Identificando pontos de fricção e sobrecarga cognitiva...",
      "Gerando sugestões de simplificação...",
    ],
  });

  const defaultOutput: UXSimplificationOutput = {
    uxComplexityScore: 70,
    cognitiveLoadScore: 65,
    clarityScore: 75,
    userControlPerception: 70,
    emotionalFlowScore: 68,
    uxVerdict: "good",
    overallAssessment: "Experiência adequada com oportunidades de simplificação",
    frictionPoints: [],
    simplificationSuggestions: [],
    emotionalFlowAnalysis: [],
    excessiveSteps: [],
    informationOverload: [],
    missingFeedbacks: [],
    controlMoments: [],
    topUXWins: [],
    criticalFixes: [],
    confidenceScore: 0.7,
  };

  return parseAgentJSON<UXSimplificationOutput>(result.content, defaultOutput);
}
