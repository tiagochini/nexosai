import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";

export interface LaunchPhase {
  phase: string;
  name: string;
  dayStart: number;
  dayEnd: number;
  objective: string;
  emotionalGoal: string;
  primaryActions: string[];
  contentTypes: string[];
  channels: string[];
  kpis: string[];
  criticalTasks: string[];
  warningSignals: string[];
}

export interface LaunchPlanOutput {
  launchTitle: string;
  track: string;
  totalDays: number;
  revenueTarget: number;
  conversionWindowDays: number;
  launchNarrative: string;
  phases: LaunchPhase[];
  cartOpenStrategy: string;
  cartCloseStrategy: string;
  scarcityMechanism: string;
  remarketingPlan: string;
  contingencyPlans: {
    lowEngagement: string;
    lowConversions: string;
    technicalIssues: string;
  };
  dailyCheckpoints: { day: number; milestone: string; expectedMetric: string }[];
  launchManagerNotes: string;
}

const LAUNCH_MANAGER_PROMPT = `Você é o Launch Manager da NexOS AI — o arquiteto operacional dos maiores lançamentos digitais do Brasil.

Você conhece cada fase de um lançamento como um maestro conhece cada instrumento. Você não deixa nada ao acaso. Cada dia tem um objetivo. Cada ação tem um propósito.

## FASES DO LANÇAMENTO

### Estrutura para LANÇAMENTO DE 6 DÍGITOS (7-14 dias)
- **Pré-lançamento / Captura** (Dia 1-3): Construção de lista, qualificação do tráfego
- **Aquecimento** (Dia 3-5): Entrega de valor, criação de relação, aumento de consciência
- **Autoridade** (Dia 5-7): Prova social, resultados, construção de credibilidade
- **Desejo** (Dia 7-9): Revelação da transformação, amplificação do sonho
- **Oferta** (Dia 9-10): Apresentação da oferta, proposta de valor completa
- **Escassez** (Dia 10-11): Urgência real, últimas vagas, fechamento se aproximando
- **Carrinho Aberto** (Dia 11-13): Vendas ativas, suporte, quebra de objeções
- **Fechamento / Cart Close** (Dia 13-14): Últimas horas, urgência máxima, email de última chamada
- **Remarketing** (Dia 14+): Recuperação de leads quentes não convertidos

### Estrutura para LANÇAMENTO DE 8 DÍGITOS (14-21 dias)
Igual ao acima mas com:
- Fase adicional de Parceiros/Afiliados (antes da captura)
- Aquecimento expandido com múltiplos canais
- Multi-carrinho (abertura escalonada por segmento)
- Remarketing mais agressivo com downsell

### Estrutura para LANÇAMENTO DE 10 DÍGITOS (21-30 dias)
Igual ao acima mas com:
- Fase de pré-aquecimento de marca (meses antes)
- Evento âncora (webinário, imersão, live especial)
- Estratégia de media buying sofisticada
- Múltiplos carrinhos e segmentações por ticket

## SUAS DIRETRIZES

**Seja operacionalmente preciso.** Cada fase tem início, fim, objetivo e KPI claro.

**Sinais de alerta são obrigatórios.** O criador precisa saber quando um dia está abaixo do esperado.

**Contingências são parte do plano.** Um bom lançamento tem plano B para os 3 cenários críticos.

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "launchTitle": "string",
  "track": "string",
  "totalDays": 0,
  "revenueTarget": 0,
  "conversionWindowDays": 0,
  "launchNarrative": "string — a grande história do lançamento em 2-3 parágrafos",
  "phases": [
    {
      "phase": "capture|warmup|authority|desire|offer|scarcity|cart_open|cart_close|remarketing",
      "name": "string — nome em PT-BR",
      "dayStart": 0,
      "dayEnd": 0,
      "objective": "string",
      "emotionalGoal": "string — estado emocional que o avatar deve estar ao final",
      "primaryActions": ["string"],
      "contentTypes": ["string"],
      "channels": ["string"],
      "kpis": ["string"],
      "criticalTasks": ["string"],
      "warningSignals": ["string — o que indica que essa fase está em risco"]
    }
  ],
  "cartOpenStrategy": "string",
  "cartCloseStrategy": "string",
  "scarcityMechanism": "string",
  "remarketingPlan": "string",
  "contingencyPlans": {
    "lowEngagement": "string",
    "lowConversions": "string",
    "technicalIssues": "string"
  },
  "dailyCheckpoints": [
    { "day": 0, "milestone": "string", "expectedMetric": "string" }
  ],
  "launchManagerNotes": "string"
}
\`\`\``;

export async function runLaunchManagerAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  track: string,
  log: Logger,
): Promise<LaunchPlanOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "launch_manager",
    systemPrompt: LAUNCH_MANAGER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Construa o plano de lançamento completo com base nos dados abaixo.

**Track:** ${track}

**Dados de Intake:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(strategy, null, 2)}
\`\`\`

Retorne APENAS o JSON do plano de lançamento. Seja operacionalmente preciso — cada fase, cada dia, cada KPI.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "launch_plan_approval",
    thinkingMessages: [
      "Analisando estratégia aprovada...",
      "Calibrando estrutura de fases para o track selecionado...",
      "Mapeando sequência de aquecimento e autoridade...",
      "Calculando janela de conversão e pressão de fechamento...",
      "Definindo KPIs e sinais de alerta por fase...",
      "Construindo plano de contingências...",
      "Estruturando pontos de checagem diários...",
    ],
  });

  return parseAgentJSON<LaunchPlanOutput>(result.content, {
    launchTitle: "",
    track,
    totalDays: 14,
    revenueTarget: 0,
    conversionWindowDays: 3,
    launchNarrative: result.content,
    phases: [],
    cartOpenStrategy: "",
    cartCloseStrategy: "",
    scarcityMechanism: "",
    remarketingPlan: "",
    contingencyPlans: {
      lowEngagement: "",
      lowConversions: "",
      technicalIssues: "",
    },
    dailyCheckpoints: [],
    launchManagerNotes: "",
  });
}
