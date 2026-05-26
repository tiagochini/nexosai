import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_LAUNCH_MANAGER } from "./cognitive-identity-system.js";

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
  channelActions?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    whatsapp?: string;
    email?: string;
    youtube?: string | null;
  };
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

**Multi-plataforma é obrigatório.** Todo lançamento opera em Instagram + Facebook + TikTok + WhatsApp + Email simultaneamente. Cada fase deve listar TODOS os canais ativos com suas ações específicas. Um lançamento que só menciona e-mail e WhatsApp está incompleto.

**Canais mínimos por fase:**
- **Captura / Aquecimento**: Instagram Reels + TikTok (alcance), Facebook posts + grupos (distribuição), Email (lista), WhatsApp (grupos de interesse)
- **Autoridade / Desejo**: Instagram Carrossel + Stories, Facebook posts longos com prova social, TikTok educacional, Email sequência de valor
- **Abertura do carrinho**: TODAS as plataformas ao mesmo tempo — Instagram + Facebook Live, TikTok ao vivo, Email blast, WhatsApp broadcast, Stories de contagem
- **Fechamento / Cart Close**: Stories urgência (Instagram + Facebook), TikTok last-chance, Email de última hora, WhatsApp escassez real

## ESTRATÉGIA META LIVE — OBRIGATÓRIO para fases cart_open com live de vendas

Quando o lançamento inclui uma live de vendas (especialmente na abertura do carrinho), o Launch Manager DEVE incluir a estratégia de campanhas Meta Live em 3 camadas simultâneas no campo 'cartOpenStrategy':

**Camada 1 — Engajamento (encher a sala)**
- Objetivo: Engajamento (conversão: Vídeo ao vivo no Instagram)
- Comportamento: Maior alcance, maior volume de ThruPlays, CPM ~R$12, custo por visualizador ~R$0,41
- Papel: Escalar o volume de pessoas ao vivo criando prova social e efeito manada
- Orçamento sugerido: 30–40% do budget do dia da live

**Camada 2 — Tráfego (trazer os qualificados)**
- Objetivo: Tráfego (conversão: Vídeo ao vivo no Instagram)
- Comportamento: Menor CPC (~R$1,04), maior volume de cliques, CTR saudável ~1,57%
- Papel: Levar as pessoas certas — quem clicou está ativamente interessado, não apenas alcançado
- Orçamento sugerido: 40–50% do budget do dia da live

**Camada 3 — Vendas (fechar os prontos para comprar)**
- Objetivo: Vendas (conversão: Vídeo ao vivo no Instagram)
- Comportamento: CPM mais alto (~R$30,98), entrega mais seletiva, CTR ~2,36%, 77 conversões qualificadas no teste
- Papel: Retargeting de leads quentes durante e logo após a live — público que o algoritmo classifica como comprador
- Orçamento sugerido: 20–30% do budget do dia da live

**Timing crítico:** Programar as campanhas para iniciarem 5 minutos DEPOIS do horário combinado da live. Isso evita que a campanha inicie antes da live ao vivo, prevenindo falhas de entrega e "bug" no Gerenciador.

**Observação técnica:** O criativo é a própria live — não é necessário subir criativo separado. A funcionalidade pode não estar disponível em todas as contas Meta; testar em modo rascunho primeiro.

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
      "contentTypes": ["string — lista todos os formatos: Reels, TikTok nativo, Facebook post, Stories, Email, WhatsApp broadcast, etc."],
      "channels": ["instagram", "facebook", "tiktok", "whatsapp", "email"],
      "channelActions": {
        "instagram": "string — ação específica no Instagram nesta fase",
        "facebook": "string — ação específica no Facebook nesta fase",
        "tiktok": "string — ação específica no TikTok nesta fase",
        "whatsapp": "string — ação via launch sequence nesta fase",
        "email": "string — ação via sequência de email nesta fase",
        "youtube": "string ou null — YouTube Shorts/Live se aplicável"
      },
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
  memoryContext?: string,
): Promise<LaunchPlanOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "launch_manager",
    systemPrompt: COGNITIVE_IDENTITY_LAUNCH_MANAGER + LAUNCH_MANAGER_PROMPT,
    memoryContext,
    messages: [
      {
        role: "user",
        content: `Construa o plano de lançamento completo com base nos dados abaixo.

**Track:** ${track}
**Data de início do planejamento:** ${new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Sao_Paulo" })} — o Dia 1 do lançamento DEVE ser igual ou posterior a esta data.

⚠️ ATENÇÃO CRÍTICA: Todas as datas que você sugerir (início de fases, datas de abertura de carrinho, datas de fechamento) DEVEM ser no futuro — nunca em 2024 ou em meses passados de 2025 ou anteriores. O sistema registrará automaticamente datas passadas como erro.

**Dados de Intake:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(strategy, null, 2)}
\`\`\`

Retorne APENAS o JSON do plano de lançamento. Seja operacionalmente preciso — cada fase, cada dia, cada KPI. O plano deve iniciar a partir de hoje.`,
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
