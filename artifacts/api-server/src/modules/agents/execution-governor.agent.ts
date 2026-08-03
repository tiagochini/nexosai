/**
 * Execution Governor Agent
 *
 * Combines the NEXOS Execution Governor and Agent Priority System.
 * Runs immediately after Command validates readiness — BEFORE the main pipeline.
 *
 * Responsibilities:
 *   • Decide executionMode (quick / standard / premium)
 *   • Classify every pipeline agent (core / contextual / expensive / passive)
 *   • Produce an ordered execution plan with parallelism hints
 *   • Estimate cost, latency and operational risk
 *   • Block agents that add no value for this specific campaign
 *
 * The pipeline respects .skippedAgents — any agent listed there is skipped.
 * This keeps expensive compute disciplined without removing capability.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ── Execution Plan ────────────────────────────────────────────────────────────

export interface AgentClassification {
  agentId: string;
  tier: "core" | "contextual" | "expensive" | "passive";
  shouldRun: boolean;
  skipReason?: string;
  priority: number; // 1 = highest
  canParallelWith?: string[];
}

export interface ExecutionPlan {
  executionMode: "quick" | "standard" | "premium";

  // Cost & latency estimates
  estimatedCost: number;          // in credits
  estimatedLatency: string;        // human label e.g. "2-3 min"
  estimatedLatencySeconds: number;

  // Agent control
  activeAgents: string[];
  skippedAgents: string[];
  blockedAgents: string[];        // agents that are logically impossible for this type
  parallelAgents: string[][];     // groups that can execute concurrently
  executionOrder: string[];       // recommended serial order

  // Classification map
  agentClassifications: AgentClassification[];

  // Operational metadata
  estimatedComplexity: "simple" | "standard" | "complex" | "enterprise";
  operationalRisk: "low" | "medium" | "high" | "critical";
  optimizationNotes: string[];
  reasoningSummary: string;
  recommendation: string;
  confidenceScore: number;        // 0-1

  // Token budget
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  tokenBudgetWarning: boolean;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildGovernorSystemPrompt(): string {
  const fence = "```";
  return (
    `Você é o NEXOS Execution Governor — supervisor de eficiência operacional.\n` +
    `Você NÃO cria campanhas. Você controla qual trabalho computacional deve acontecer.\n` +
    `\n` +
    `## SUA MISSÃO\n` +
    `Analisar o contexto da campanha e produzir um plano de execução otimizado:\n` +
    `• Decidir o executionMode: quick / standard / premium\n` +
    `• Classificar cada agente (core / contextual / expensive / passive)\n` +
    `• Eliminar agentes redundantes ou de baixo valor para este contexto específico\n` +
    `• Estimar custo e latência com precisão\n` +
    `\n` +
    `## MODOS OPERACIONAIS\n` +
    `\n` +
    `**QUICK** — Use quando:\n` +
    `- Campanha simples (flash_sale, remarketing, upsell pequeno)\n` +
    `- Budget total < R$5.000\n` +
    `- Usuário básico (plano Solo, primeiro lançamento)\n` +
    `- Pipeline mínimo viável: command + profile_builder + strategy + offer (se aplicável)\n` +
    `- Pula: strategic_doctrine, traffic_intelligence, ux_simplification\n` +
    `- Custo: 45-80 créditos\n` +
    `\n` +
    `**STANDARD** — Use quando:\n` +
    `- Campanha moderada (launch, perpetual_launch, continuous_sales)\n` +
    `- Budget total R$5.000-R$50.000\n` +
    `- Pipeline completo exceto agentes de nicho\n` +
    `- Inclui: strategic_doctrine, financial_projector, business_intelligence\n` +
    `- Pula: agentes altamente especializados sem evidência de necessidade\n` +
    `- Custo: 80-250 créditos\n` +
    `\n` +
    `**PREMIUM** — Use quando:\n` +
    `- Campanha complexa (launch com track 8/10 dígitos, enterprise, agency)\n` +
    `- Budget total > R$50.000 OU ticket alto OU múltiplos canais\n` +
    `- Ativa TODOS os agentes aplicáveis\n` +
    `- Custo: 250-500+ créditos\n` +
    `\n` +
    `## CLASSIFICAÇÃO DE AGENTES\n` +
    `\n` +
    `CORE (sempre rodam — não skippar nunca):\n` +
    `- command, profile_builder, strategy, strategic_core, campaign_memory\n` +
    `\n` +
    `CONTEXTUAL (rodam se tipo/complexidade justificar):\n` +
    `- strategic_doctrine (skip para: flash_sale, remarketing sem orçamento grande)\n` +
    `- offer (skip para: authority, audience_growth, branding)\n` +
    `- financial_projector (skip se: sem budget declarado, authority/branding types)\n` +
    `- traffic_intelligence (skip se: sem budget de tráfego declarado)\n` +
    `- manager_agents (launch_manager / continuous_sales_manager / perpetual_launch_manager)\n` +
    `\n` +
    `EXPENSIVE (só no PREMIUM ou quando valor claramente justifica):\n` +
    `- critique loops internos (ad_copy, landing_page, vsl_script — já embutidos no pipeline B)\n` +
    `\n` +
    `PASSIVE (fire-and-forget — nunca bloqueiam o pipeline):\n` +
    `- memory_compression, ux_simplification, business_intelligence, launch_debriefing\n` +
    `\n` +
    `## REGRAS DE OTIMIZAÇÃO\n` +
    `1. Agents que fazem a mesma coisa → manter apenas o mais preciso\n` +
    `2. Doctrine engine = custo alto, valor alto — skip apenas para campanhas simples\n` +
    `3. Traffic Intelligence = só roda com hasTraffic=true E business justificado\n` +
    `4. Business Intelligence = sempre passive (fire-and-forget), nunca bloqueia\n` +
    `5. UX Simplification = sempre passive, roda ao final independente do modo\n` +
    `6. Memory Compression = passive, roda se entries > 20 ou após conclusão\n` +
    `\n` +
    `## PROTEÇÃO CONTRA FALHAS\n` +
    `Detectar e reportar em operationalRisk:\n` +
    `- Budget insuficiente para os agentes solicitados → escalate para medium/high\n` +
    `- Intake muito incompleto → high risk, sugira quick mode\n` +
    `- Campanha enterprise sem dados de mercado → critical\n` +
    `\n` +
    `**Retorne APENAS JSON válido:**\n` +
    fence + `json\n` +
    `{\n` +
    `  "executionMode": "quick|standard|premium",\n` +
    `  "estimatedCost": 0,\n` +
    `  "estimatedLatency": "string",\n` +
    `  "estimatedLatencySeconds": 0,\n` +
    `  "activeAgents": ["string"],\n` +
    `  "skippedAgents": ["string"],\n` +
    `  "blockedAgents": ["string"],\n` +
    `  "parallelAgents": [["string"]],\n` +
    `  "executionOrder": ["string"],\n` +
    `  "agentClassifications": [\n` +
    `    { "agentId": "string", "tier": "core|contextual|expensive|passive", "shouldRun": true, "skipReason": null, "priority": 1, "canParallelWith": [] }\n` +
    `  ],\n` +
    `  "estimatedComplexity": "simple|standard|complex|enterprise",\n` +
    `  "operationalRisk": "low|medium|high|critical",\n` +
    `  "optimizationNotes": ["string"],\n` +
    `  "reasoningSummary": "string",\n` +
    `  "recommendation": "string",\n` +
    `  "confidenceScore": 0.9,\n` +
    `  "estimatedInputTokens": 0,\n` +
    `  "estimatedOutputTokens": 0,\n` +
    `  "tokenBudgetWarning": false\n` +
    `}\n` +
    fence
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runExecutionGovernor(
  campaignId: string | null,
  workspaceId: string,
  campaignType: string,
  campaignTrack: string,
  intakeData: Record<string, unknown>,
  hasTraffic: boolean,
  commandComplexity: string,
  availableCredits: number,
  log: Logger,
): Promise<ExecutionPlan> {
  // campaign.budget.traffic = chave atual do intake (AI conversacional)
  // campaign.trafficBudget  = chave legada (direct-form anterior)
  const budget = Number(
    intakeData["campaign.budget.traffic"] ??
    intakeData["campaign.trafficBudget"] ??
    0,
  );
  const ticket = Number(intakeData["product.price"] ?? intakeData["product.ticket"] ?? 0);
  const isSimpleType = ["flash_sale", "remarketing", "upsell", "authority", "audience_growth", "branding"].includes(campaignType);
  const isComplexType = ["launch", "perpetual_launch", "continuous_sales", "subscription_growth", "affiliate"].includes(campaignType);

  const userContent =
    `Analise esta campanha e decida o plano de execução otimizado.\n\n` +
    `**Tipo de campanha:** ${campaignType}\n` +
    `**Track:** ${campaignTrack}\n` +
    `**Complexidade avaliada pelo Command:** ${commandComplexity}\n` +
    `**Tem tráfego pago:** ${hasTraffic ? "SIM" : "NÃO"}\n` +
    `**Budget de tráfego:** R$${budget.toLocaleString("pt-BR")}\n` +
    `**Ticket do produto:** R$${ticket.toLocaleString("pt-BR")}\n` +
    `**Créditos disponíveis:** ${availableCredits}\n` +
    `**Tipo simples:** ${isSimpleType ? "SIM" : "NÃO"}\n` +
    `**Tipo complexo:** ${isComplexType ? "SIM" : "NÃO"}\n\n` +
    `**Campos de intake preenchidos:** ${Object.keys(intakeData).length}\n\n` +
    `Retorne o plano de execução JSON.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "execution_governor",
    systemPrompt: buildGovernorSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
    log,
    requiresApproval: false,
    skipAllStaticLayers: true,
    thinkingMessages: [
      "Analisando complexidade e tipo da campanha...",
      "Classificando agentes por valor e custo...",
      "Calculando modo de execução otimizado...",
    ],
  });

  const defaultPlan: ExecutionPlan = {
    executionMode: "standard",
    estimatedCost: 200,
    estimatedLatency: "3-5 min",
    estimatedLatencySeconds: 240,
    activeAgents: ["command", "profile_builder", "strategy", "strategic_core", "campaign_memory", "strategic_doctrine", "offer", "launch_manager", "financial_projector"],
    skippedAgents: [],
    blockedAgents: [],
    parallelAgents: [],
    executionOrder: ["command", "profile_builder", "strategy", "strategic_core", "campaign_memory", "strategic_doctrine", "offer", "launch_manager", "financial_projector"],
    agentClassifications: [],
    estimatedComplexity: "standard",
    operationalRisk: "low",
    optimizationNotes: [],
    reasoningSummary: "Pipeline padrão — fallback automático",
    recommendation: "Execute o pipeline padrão",
    confidenceScore: 0.7,
    estimatedInputTokens: 8000,
    estimatedOutputTokens: 2000,
    tokenBudgetWarning: false,
  };

  const plan = parseAgentJSON<ExecutionPlan>(result.content, defaultPlan);

  // Hard guard: the LLM must never skip traffic_intelligence when the caller
  // has already confirmed hasTraffic=true. The budget misread (legacy key vs new
  // key) could still fool the LLM into thinking there's no budget even when
  // hasTraffic is explicitly true. This deterministic override prevents that.
  if (hasTraffic) {
    plan.skippedAgents = (plan.skippedAgents ?? []).filter(
      (a) => a !== "traffic_intelligence",
    );
  }

  return plan;
}
