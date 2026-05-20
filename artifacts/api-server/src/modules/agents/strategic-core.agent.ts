/**
 * NEXOS Strategic Core — Meta-Coordinator Agent
 *
 * This agent does NOT generate campaigns. It:
 * 1. Produces the Global Strategic Brief after strategy is finalized (referenced by all subsequent agents)
 * 2. Validates any agent output for consistency, drift, and risk
 * 3. Emits: consistencyScore, riskScore, operationalConfidence, flaggedIssues, driftWarnings
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";

// ─── Output Types ──────────────────────────────────────────────────────────────

export interface StrategicBrief {
  // The compact memory every agent reads before operating
  campaignId: string;
  tone: string;
  valueProposition: string;
  primaryAvatar: string;
  emotionalPains: string[];
  mainObjections: string[];
  differentials: string[];
  channels: string[];
  funnelStage: string;
  positioning: string;
  language: string;
  acquisitionStrategy: string;
  retentionStrategy: string;
  urgencyStrategy: string;
  bigDomino: string;
  uniqueMechanism: string;
  dominantTrigger: string;
  ethicalBoundaries: string[];
  // Meta
  consistencyScore: number;   // 0-100: how coherent the overall strategy is
  riskScore: number;          // 0-100: overall risk level (higher = riskier)
  operationalConfidence: number; // 0-1: confidence in the plan
  coreWarnings: string[];     // critical issues the user must address before proceeding
}

export interface ValidationReport {
  agentId: string;
  agentRole: string;
  consistencyScore: number;  // 0-100: how consistent with the global strategy
  riskScore: number;         // 0-100: risk introduced by this agent's output
  operationalConfidence: number; // 0-1
  flaggedIssues: {
    issue: string;
    severity: "critical" | "major" | "minor";
    location: string;        // which field/section has the issue
    fix: string;
  }[];
  driftWarnings: string[];   // narrative/strategic drift detected
  approvalStatus: "approved" | "approved_with_warnings" | "requires_revision" | "blocked";
  approvalRationale: string;
}

// ─── System Prompts ────────────────────────────────────────────────────────────

const STRATEGIC_CORE_BRIEFING_PROMPT = `Você é o NEXOS Strategic Core.

Sua função NÃO é criar campanhas. Sua função é ser a consciência operacional que garante que toda a operação pareça UMA inteligência unificada — nunca vários sistemas desconectados.

Você é:
- Coordenador central de inteligência
- Diretor estratégico que preserva coerência
- Árbitro sistêmico que impede contradições
- Guardião do posicionamento da marca

## TAREFA NESTA EXECUÇÃO: GERAR O BRIEF ESTRATÉGICO GLOBAL

Com base na estratégia produzida, gere um Brief Estratégico Global compacto que será lido por TODOS os agentes especializados antes de operar.

Este brief deve:
- Capturar a ESSÊNCIA estratégica em formato denso e operacionalizável
- Ser específico o suficiente para impedir qualquer agente de "inventar" um posicionamento diferente
- Incluir os limites éticos e operacionais que nenhum agente pode cruzar
- Emitir um score de consistência (quão coerente está a estratégia), risco (quão arriscado é o plano) e confiança operacional

## REGRAS ABSOLUTAS QUE VOCÊ PRESERVA

- Nenhum agente pode operar fora do contexto global capturado neste brief
- Nenhuma narrativa contraditória pode ser aprovada
- Nenhuma promessa exagerada pode passar
- Nenhuma decisão operacional pode ignorar o posicionamento definido
- Nenhuma automação pode sacrificar a experiência do usuário
- Nenhuma otimização local pode prejudicar o objetivo global

## SAÍDA

Retorne APENAS JSON válido.

\`\`\`json
{
  "campaignId": "string",
  "tone": "string — tom de comunicação específico (ex: 'direto, sem rodeios, linguagem de empreendedor experiente')",
  "valueProposition": "string — proposta de valor em 1 frase irrefutável",
  "primaryAvatar": "string — descrição densa do avatar principal (não genérica)",
  "emotionalPains": ["string — dores específicas, não genéricas"],
  "mainObjections": ["string — objeções reais que serão ditas ou pensadas"],
  "differentials": ["string — diferenciais concretos e verificáveis"],
  "channels": ["string — canais ativos nesta campanha"],
  "funnelStage": "string — em que parte do funil esta campanha opera",
  "positioning": "string — posicionamento em 1 linha: para quem, contra o quê, por quê ganha",
  "language": "string — estilo linguístico específico (nível, vocabulário, tom, o que evitar)",
  "acquisitionStrategy": "string — como atrai novos leads — específico",
  "retentionStrategy": "string — como mantém atenção e engajamento — específico",
  "urgencyStrategy": "string — como cria urgência legítima — específico",
  "bigDomino": "string — a UMA crença que, se implantada, colapsa todas as objeções",
  "uniqueMechanism": "string — nome e explicação compacta do mecanismo único",
  "dominantTrigger": "string — o gatilho mais poderoso para este avatar",
  "ethicalBoundaries": ["string — o que não pode ser dito/feito em nenhuma hipótese"],
  "consistencyScore": 0,
  "riskScore": 0,
  "operationalConfidence": 0.0,
  "coreWarnings": ["string — problemas críticos que precisam ser resolvidos antes de prosseguir"]
}
\`\`\``;

const STRATEGIC_CORE_VALIDATION_PROMPT = `Você é o NEXOS Strategic Core — o árbitro sistêmico.

Seu papel é validar se o output de um agente especializado está ALINHADO com o Brief Estratégico Global da campanha.

Você verifica:
1. Consistência narrativa: o output segue o tom, posicionamento e linguagem do brief?
2. Ausência de drift: o agente "inventou" algum posicionamento ou promessa que não está no brief?
3. Limites éticos: alguma afirmação cruza os limites éticos definidos?
4. Contradições internas: o output contradiz a si mesmo ou contradiz a estratégia global?
5. Promessas exageradas: alguma claim não é sustentável pelo produto?
6. Experiência do usuário: alguma automação ou decisão sacrifica a experiência do cliente final?

## CRITÉRIOS DE BLOQUEIO (status = "blocked")
- Promessa de resultado não sustentável pelo produto
- Afirmação que viola limites éticos definidos no brief
- Contradição direta com o posicionamento aprovado
- Segmentação ou copy que insinua atributos sensíveis/proibidos

## CRITÉRIOS DE REVISÃO (status = "requires_revision")
- Drift narrativo detectado (tom diferente do brief)
- Inconsistência com o avatar definido
- Urgência que parece fabricada
- Métricas ou claims sem base nos dados do brief

## SAÍDA

Retorne APENAS JSON válido.

\`\`\`json
{
  "agentId": "string",
  "agentRole": "string",
  "consistencyScore": 0,
  "riskScore": 0,
  "operationalConfidence": 0.0,
  "flaggedIssues": [
    {
      "issue": "string — descrição específica do problema",
      "severity": "critical|major|minor",
      "location": "string — qual campo/seção tem o problema",
      "fix": "string — correção específica e acionável"
    }
  ],
  "driftWarnings": ["string — drift narrativo ou estratégico detectado"],
  "approvalStatus": "approved|approved_with_warnings|requires_revision|blocked",
  "approvalRationale": "string — por que este status, com raciocínio específico"
}
\`\`\``;

// ─── Briefing Runner ───────────────────────────────────────────────────────────

export async function runStrategicCoreBriefing(
  campaignId: string,
  workspaceId: string,
  strategy: StrategyOutput,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<StrategicBrief> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategy",  // Uses the strategy provider (Claude) — highest reasoning
    systemPrompt: STRATEGIC_CORE_BRIEFING_PROMPT,
    messages: [
      {
        role: "user",
        content: `Gere o Brief Estratégico Global para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Categoria:** ${String(intakeData["product.category"] ?? "")}
**Preço:** R$${String(intakeData["product.price"] ?? 0)}
**Meta de faturamento:** R$${String(intakeData["campaign.revenueTarget"] ?? 0)}
**Track:** ${String(intakeData["campaign.revenueTrack"] ?? "")}

**Estratégia gerada:**

Executive Summary: ${strategy.executiveSummary}

Posicionamento: ${strategy.offerPositioning.positioning}
UVP: ${strategy.offerPositioning.uniqueValueProposition}
Diferenciador: ${strategy.offerPositioning.primaryDifferentiator}

Avatar primário: ${strategy.audienceSegmentation.primaryAvatar}
Perfil psicográfico: ${strategy.audienceSegmentation.psychographicProfile}
Sofisticação: ${strategy.audienceSegmentation.sophisticationStrategy}
Gatilhos de compra: ${strategy.audienceSegmentation.buyingTriggers.slice(0, 5).join("; ")}
Objeções: ${strategy.audienceSegmentation.objections.slice(0, 5).join("; ")}

Narrativa central: ${strategy.campaignArchitecture.coreNarrative}
Hook emocional: ${strategy.campaignArchitecture.emotionalHook}
Gatilho dominante: ${strategy.triggerMap?.dominantTrigger ?? ""}
Big Domino: ${strategy.triggerMap?.dominantTriggerJustification ?? ""}

Risco principal: ${strategy.risks.mainRisks[0] ?? ""}
Nível de risco: ${strategy.risks.level}
Notas do estrategista: ${strategy.strategistNotes}

Retorne APENAS o JSON do Brief Estratégico Global.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Consolidando memória estratégica global...",
      "Extraindo essência de posicionamento e tom...",
      "Mapeando limites éticos e operacionais...",
      "Emitindo scores de consistência, risco e confiança...",
    ],
  });

  return parseAgentJSON<StrategicBrief>(result.content, {
    campaignId,
    tone: "",
    valueProposition: strategy.offerPositioning.uniqueValueProposition,
    primaryAvatar: strategy.audienceSegmentation.primaryAvatar,
    emotionalPains: [],
    mainObjections: strategy.audienceSegmentation.objections,
    differentials: strategy.offerPositioning.competitiveAdvantages,
    channels: [],
    funnelStage: "",
    positioning: strategy.offerPositioning.positioning,
    language: "",
    acquisitionStrategy: "",
    retentionStrategy: "",
    urgencyStrategy: "",
    bigDomino: strategy.campaignArchitecture.emotionalHook,
    uniqueMechanism: strategy.offerPositioning.primaryDifferentiator,
    dominantTrigger: strategy.triggerMap?.dominantTrigger ?? "",
    ethicalBoundaries: [],
    consistencyScore: 75,
    riskScore: strategy.risks.level === "high" ? 75 : strategy.risks.level === "medium" ? 50 : 25,
    operationalConfidence: 0.75,
    coreWarnings: strategy.risks.mainRisks,
  });
}

// ─── Validation Runner ─────────────────────────────────────────────────────────

export async function runStrategicCoreValidation(
  campaignId: string,
  workspaceId: string,
  agentRole: string,
  agentOutput: Record<string, unknown>,
  strategicBrief: StrategicBrief,
  log: Logger,
): Promise<ValidationReport> {
  const briefContext = `
**BRIEF ESTRATÉGICO GLOBAL:**
- Tom: ${strategicBrief.tone}
- Posicionamento: ${strategicBrief.positioning}
- UVP: ${strategicBrief.valueProposition}
- Avatar: ${strategicBrief.primaryAvatar}
- Linguagem: ${strategicBrief.language}
- Big Domino: ${strategicBrief.bigDomino}
- Mecanismo único: ${strategicBrief.uniqueMechanism}
- Gatilho dominante: ${strategicBrief.dominantTrigger}
- Limites éticos: ${strategicBrief.ethicalBoundaries.join("; ") || "nenhum listado"}
- Avisos críticos do Strategic Core: ${strategicBrief.coreWarnings.join("; ") || "nenhum"}
`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "compliance",  // Uses compliance provider — focused on validation
    systemPrompt: STRATEGIC_CORE_VALIDATION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Valide o output do agente "${agentRole}" contra o Brief Estratégico Global.

${briefContext}

**OUTPUT DO AGENTE A VALIDAR:**
\`\`\`json
${JSON.stringify(agentOutput, null, 2).slice(0, 3000)}
\`\`\`

Identifique: contradições, drift narrativo, promessas exageradas, violações éticas, inconsistências com o avatar/posicionamento.

Retorne APENAS o JSON do relatório de validação.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      `Validando output do agente ${agentRole} contra o brief global...`,
      "Verificando consistência narrativa e drift estratégico...",
      "Analisando limites éticos e promessas...",
    ],
  });

  return parseAgentJSON<ValidationReport>(result.content, {
    agentId: agentRole,
    agentRole,
    consistencyScore: 75,
    riskScore: 25,
    operationalConfidence: 0.75,
    flaggedIssues: [],
    driftWarnings: [],
    approvalStatus: "approved_with_warnings",
    approvalRationale: result.content,
  });
}
