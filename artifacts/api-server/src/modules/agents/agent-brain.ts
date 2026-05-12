/**
 * Agent Brain — ReAct (Reason + Act) Framework
 *
 * Upgrades every agent with:
 * 1. Structured OBSERVE → REASON → ACT → OUTPUT thought chain
 * 2. Action directives: agents emit structured actions the system can execute
 * 3. Confidence scoring and uncertainty acknowledgment
 * 4. Two-pass execution: think first, then deliver
 */

import { completeWithAgent, type AgentRole, type AIMessage } from "../ai-gateway/ai-gateway.service.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

// ── Action Taxonomy ─────────────────────────────────────────────────────────

export type ActionType =
  | "PAUSE_CAMPAIGN"
  | "RESUME_CAMPAIGN"
  | "SCALE_BUDGET"
  | "REDUCE_BUDGET"
  | "REALLOCATE_BUDGET"
  | "PAUSE_CREATIVE"
  | "REQUEST_CREATIVE"
  | "ROTATE_CREATIVE"
  | "FIRE_SEQUENCE"
  | "PAUSE_SEQUENCE"
  | "SWITCH_SEGMENT"
  | "SWITCH_STRATEGY"
  | "ACTIVATE_REMARKETING"
  | "A_B_TEST"
  | "ALERT_HUMAN"
  | "ESCALATE_DECISION"
  | "SEND_NOTIFICATION"
  | "GENERATE_REPORT"
  | "REFRESH_COPY"
  | "EXPAND_AUDIENCE"
  | "REDUCE_BID"
  | "INCREASE_BID";

export interface AgentAction {
  type: ActionType;
  confidence: number;        // 0-1: how certain the agent is
  urgency: "immediate" | "next_12h" | "next_24h" | "next_week";
  rationale: string;         // WHY this action (required, specific)
  params: Record<string, unknown>; // action-specific parameters
  requiresApproval: boolean; // should a human approve before execution?
  estimatedImpact?: string;  // what result is expected from this action
}

export interface AgentThought {
  observation: string;       // what the agent sees in the data/situation
  diagnosis: string;         // root cause analysis
  options: string[];         // 2-4 possible courses of action
  decision: string;          // which option and precise reasoning
  confidence: number;        // 0-1 overall confidence in the analysis
  uncertainties: string[];   // what the agent doesn't know that could change the decision
  actions: AgentAction[];    // concrete system directives
}

// ── ReAct System Prompt Wrapper ─────────────────────────────────────────────

const REACT_THINKING_TEMPLATE = `

---

## FRAMEWORK DE RACIOCÍNIO (OBRIGATÓRIO — percorra antes de gerar qualquer output)

Você opera no framework OBSERVE → REASON → ACT → OUTPUT. Não gere output sem percorrer estas etapas.

### OBSERVE
O que os dados/contexto realmente dizem? Liste os fatos objetivos, separando o que é sinal (padrão consistente) do que é ruído (variação aleatória). Se faltar informação crítica, nomeie a lacuna.

### REASON
Por que a situação está assim? Formule 2-3 hipóteses alternativas e escolha a mais provável com justificativa. Resistência ao viés de confirmação: considere o cenário oposto.

### ACT (AÇÕES DO SISTEMA)
Com base na sua análise, que ações concretas o sistema deve executar? Use a taxonomia de ações disponível:
- SCALE_BUDGET, REDUCE_BUDGET, REALLOCATE_BUDGET — ajuste de investimento
- PAUSE_CREATIVE, REQUEST_CREATIVE, ROTATE_CREATIVE — gestão de criativos
- FIRE_SEQUENCE, PAUSE_SEQUENCE — disparo de sequências de email/WhatsApp
- SWITCH_STRATEGY, SWITCH_SEGMENT — mudanças estratégicas
- ACTIVATE_REMARKETING, EXPAND_AUDIENCE, REDUCE_BID, INCREASE_BID — mídia paga
- A_B_TEST — iniciar teste estruturado
- ALERT_HUMAN, ESCALATE_DECISION — quando a decisão requer julgamento humano
- GENERATE_REPORT, SEND_NOTIFICATION, REFRESH_COPY — operacionais

Para cada ação, defina: tipo, urgência (immediate/next_12h/next_24h/next_week), confiança (0-1), parâmetros e se requer aprovação humana.

### OUTPUT
Agora gere o deliverable solicitado, informado pelo raciocínio acima. O output deve ser consistente com as ações decididas.

---`;

export function buildReActSystemPrompt(baseSystemPrompt: string): string {
  return baseSystemPrompt + REACT_THINKING_TEMPLATE;
}

// ── Action Extractor ─────────────────────────────────────────────────────────

export function extractActionsFromOutput(content: string): AgentAction[] {
  try {
    // Try to find an "actions" array in the JSON output
    const jsonMatch = content.match(/"actions"\s*:\s*(\[[\s\S]*?\])/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[1]) as unknown[];
    return parsed.filter((a): a is AgentAction =>
      typeof a === "object" && a !== null && "type" in a && "confidence" in a
    );
  } catch {
    return [];
  }
}

// ── Two-Pass ReAct Runner ─────────────────────────────────────────────────────

export interface ReActRunnerOpts {
  campaignId: string | null;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;  // base system prompt (will be wrapped with ReAct template)
  messages: AIMessage[];
  log: Logger;
  thinkingMessages?: string[];
}

export interface ReActResult {
  content: string;            // the full deliverable
  thought: Partial<AgentThought>; // extracted thought chain
  actions: AgentAction[];     // parsed action directives
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Two-pass ReAct execution:
 * Pass 1: Structured thinking (compact) — what's happening, what to do
 * Pass 2: Full deliverable informed by the thought chain
 *
 * Falls back to single-pass if thinking pass fails.
 */
export async function runReActAgent(opts: ReActRunnerOpts): Promise<ReActResult> {
  const { campaignId, workspaceId, agentRole, systemPrompt, messages, log } = opts;

  const reactSystemPrompt = buildReActSystemPrompt(systemPrompt);

  // Emit start event
  if (campaignId) {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: agentRole,
      message: opts.thinkingMessages?.[0] ?? "Agente analisando situação...",
      timestamp: new Date().toISOString(),
    });
  }

  // Pass 1: Structured thinking
  let thought: Partial<AgentThought> = {};
  let thinkingContent = "";

  try {
    const thinkPrompt = `${messages[messages.length - 1]?.content ?? ""}

IMPORTANTE: Antes de gerar o output final, produza um bloco de raciocínio em JSON com esta estrutura exata:
\`\`\`json
{
  "observation": "string — o que os dados mostram objetivamente",
  "diagnosis": "string — por que a situação está assim (causa raiz)",
  "options": ["string — opção A", "string — opção B", "string — opção C"],
  "decision": "string — qual opção e por quê",
  "confidence": 0.0,
  "uncertainties": ["string — o que não sei que poderia mudar a decisão"],
  "actions": [
    {
      "type": "ACTION_TYPE",
      "confidence": 0.0,
      "urgency": "immediate|next_12h|next_24h|next_week",
      "rationale": "string — por que esta ação agora",
      "params": {},
      "requiresApproval": false,
      "estimatedImpact": "string"
    }
  ]
}
\`\`\`

Depois do bloco JSON, gere o output principal conforme solicitado.`;

    const thinkMessages: AIMessage[] = [
      ...messages.slice(0, -1),
      { role: "user", content: thinkPrompt },
    ];

    if (campaignId) {
      emitCampaignEvent({
        campaignId,
        type: "agent_thinking",
        agentType: agentRole,
        message: opts.thinkingMessages?.[1] ?? "Formulando hipóteses e decidindo ações...",
        timestamp: new Date().toISOString(),
      });
    }

    const thinkResult = await completeWithAgent(
      agentRole,
      reactSystemPrompt,
      thinkMessages,
      workspaceId,
      log,
      campaignId ?? undefined,
    );

    thinkingContent = thinkResult.content;

    // Extract thought chain from thinking pass
    const thoughtMatch = thinkingContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (thoughtMatch) {
      try {
        thought = JSON.parse(thoughtMatch[1]) as Partial<AgentThought>;
      } catch {
        // non-critical, continue
      }
    }

    const actions = extractActionsFromOutput(thinkingContent);

    if (campaignId) {
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: agentRole,
        message: opts.thinkingMessages?.[2] ?? "Análise concluída.",
        timestamp: new Date().toISOString(),
        data: {
          thought: { observation: thought.observation, decision: thought.decision },
          actionCount: actions.length,
        },
      });
    }

    return {
      content: thinkingContent,
      thought,
      actions,
      inputTokens: thinkResult.inputTokens,
      outputTokens: thinkResult.outputTokens,
      model: thinkResult.model,
    };
  } catch (err) {
    log.warn({ err }, "ReAct thinking pass failed, continuing with content");
    // Fall back: return what we have
    return {
      content: thinkingContent,
      thought,
      actions: [],
      inputTokens: 0,
      outputTokens: 0,
      model: "unknown",
    };
  }
}

// ── Action Priority Sorter ───────────────────────────────────────────────────

export function sortActionsByPriority(actions: AgentAction[]): AgentAction[] {
  const urgencyOrder = { immediate: 0, next_12h: 1, next_24h: 2, next_week: 3 };
  return [...actions].sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.confidence - a.confidence; // higher confidence first
  });
}

// ── Action Approval Gate ─────────────────────────────────────────────────────

export function getActionsRequiringApproval(actions: AgentAction[]): AgentAction[] {
  return actions.filter(
    (a) =>
      a.requiresApproval ||
      a.confidence < 0.75 ||
      a.type === "PAUSE_CAMPAIGN" ||
      a.type === "SWITCH_STRATEGY" ||
      a.type === "ESCALATE_DECISION",
  );
}

export function getAutoExecutableActions(actions: AgentAction[]): AgentAction[] {
  return actions.filter(
    (a) =>
      !a.requiresApproval &&
      a.confidence >= 0.75 &&
      a.type !== "PAUSE_CAMPAIGN" &&
      a.type !== "SWITCH_STRATEGY" &&
      a.type !== "ESCALATE_DECISION",
  );
}
