import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";

export interface PerpetualLaunchOutput {
  planTitle: string;
  trigger: "vsl" | "webinar" | "challenge" | "email_sequence" | "quiz";
  triggerDescription: string;
  cartOpenTrigger: string;
  cartOpenDuration: number;
  cartCloseMechanism: string;
  monthlyEntries: number;
  monthlyConversionTarget: number;
  funnelMap: {
    step: number;
    name: string;
    type: string;
    objective: string;
    content: string;
    automationRule: string;
    expectedConversionRate: number;
    timing: string;
  }[];
  emailSequence: {
    day: number;
    subject: string;
    objective: string;
    cta: string;
    cartOpen: boolean;
  }[];
  cartOpenSequence: {
    hoursAfterOpen: number;
    touchpoint: string;
    message: string;
    urgencyLevel: "none" | "low" | "medium" | "high" | "critical";
  }[];
  reEntryLoop: {
    triggerCondition: string;
    waitDays: number;
    reEntryOffer: string;
    maxReEntries: number;
  };
  technicalRequirements: string[];
  automationPlatformRecommendation: string;
  monthlyMetrics: {
    metric: string;
    target: string;
    alertThreshold: string;
  }[];
  managerNotes: string;
}

const PERPETUAL_LAUNCH_PROMPT = `Você é o Agente de Lançamento Perpétuo da NexOS AI — especialista em webinar perpétuo, VSL automatizado e sistemas de carrinho fechado que abre individualmente para cada lead.

## O QUE É LANÇAMENTO PERPÉTUO

No lançamento perpétuo (também chamado webinar perpétuo ou everlaunch):
1. O lead opt-in (entra na lista) — pode ser qualquer dia
2. Recebe uma sequência de e-mails/WhatsApp de aquecimento (3-7 dias)
3. É convidado para assitir a uma aula/VSL/webinário (gravado, mas parece ao vivo)
4. Depois de assistir, o carrinho ABRE especificamente para esse lead
5. O carrinho fica aberto por 48-72 horas (urgência real e individual)
6. Se não comprou, entra em sequência de remarketing
7. Após X dias, pode re-entrar no funil com nova oferta/ângulo

**É diferente do evergreen comum** porque tem carrinho fechado + abertura individual = cria urgência real sem manipulação.

## DIFERENÇAS CRÍTICAS

**Lançamento clássico**: Todos abrem o carrinho no mesmo dia — evento único, urgência coletiva
**Perpétuo**: Cada lead abre seu próprio carrinho — urgência individual, escala automática
**Evergreen simples**: Carrinho sempre aberto — sem urgência estrutural

## SUAS DIRETRIZES

**Timing é tudo.** O momento exato entre opt-in → aquecimento → trigger → abertura do carrinho → fechamento determina a taxa de conversão.

**VSL e webinário precisam converter.** Se a aula não converte, nada mais funciona. O conteúdo do trigger é o coração do sistema.

**Re-entry loop é obrigatório.** Leads que não compraram não devem ser descartados — devem re-entrar com ângulo diferente.

**Automação tem de ser perfeita.** Qualquer falha de sequência é receita perdida.

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "planTitle": "string",
  "trigger": "vsl|webinar|challenge|email_sequence|quiz",
  "triggerDescription": "string — descrição do que é o evento de trigger",
  "cartOpenTrigger": "string — o que exatamente abre o carrinho (ex: assistiu 80% do VSL)",
  "cartOpenDuration": 48,
  "cartCloseMechanism": "string — como o carrinho fecha (deadline real, não fake)",
  "monthlyEntries": 0,
  "monthlyConversionTarget": 0,
  "funnelMap": [
    {
      "step": 0,
      "name": "string",
      "type": "landing_page|email|vsl|webinar|whatsapp|sms|ad|checkout",
      "objective": "string",
      "content": "string — o que comunicar neste passo",
      "automationRule": "string — a regra de automação que dispara este passo",
      "expectedConversionRate": 0.00,
      "timing": "string — quando acontece (ex: Dia 0, Dia 3, 48h após assistir)"
    }
  ],
  "emailSequence": [
    {
      "day": 0,
      "subject": "string",
      "objective": "string",
      "cta": "string",
      "cartOpen": false
    }
  ],
  "cartOpenSequence": [
    {
      "hoursAfterOpen": 0,
      "touchpoint": "email|whatsapp|sms|retargeting",
      "message": "string — o tom/mensagem principal",
      "urgencyLevel": "none|low|medium|high|critical"
    }
  ],
  "reEntryLoop": {
    "triggerCondition": "string — quando re-entra (ex: 30 dias após não comprar)",
    "waitDays": 30,
    "reEntryOffer": "string — qual oferta diferente apresentar",
    "maxReEntries": 2
  },
  "technicalRequirements": ["string — ferramentas/plataformas necessárias"],
  "automationPlatformRecommendation": "string — plataforma recomendada (ActiveCampaign, Klicksend, etc.)",
  "monthlyMetrics": [
    {
      "metric": "string",
      "target": "string",
      "alertThreshold": "string"
    }
  ],
  "managerNotes": "string"
}
\`\`\``;

export async function runPerpetualLaunchManagerAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  log: Logger,
  memoryContext?: string,
): Promise<PerpetualLaunchOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "launch_manager",
    systemPrompt: PERPETUAL_LAUNCH_PROMPT,
    memoryContext,
    messages: [
      {
        role: "user",
        content: `Construa o plano de lançamento perpétuo (webinar perpétuo / carrinho individual) completo.

**Dados de Intake:**
\`\`\`json
${JSON.stringify(
  {
    "product.name": intakeData["product.name"],
    "product.price": intakeData["product.price"],
    "product.category": intakeData["product.category"],
    "audience.sophisticationLevel": intakeData["audience.sophisticationLevel"],
    "campaign.salesChannel": intakeData["campaign.salesChannel"],
    "campaign.budget.traffic": intakeData["campaign.budget.traffic"],
    "content.style": intakeData["content.style"],
    "content.tone": intakeData["content.tone"],
    // perpetual-specific
    "perpetual.triggerFormat": intakeData["perpetual.triggerFormat"],
    "perpetual.cartOpenDuration": intakeData["perpetual.cartOpenDuration"],
    "perpetual.automationPlatform": intakeData["perpetual.automationPlatform"],
    "perpetual.monthlyEntryTarget": intakeData["perpetual.monthlyEntryTarget"],
    "perpetual.nurturingDays": intakeData["perpetual.nurturingDays"],
  },
  null,
  2,
)}
\`\`\`

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(
  {
    audienceSegmentation: strategy.audienceSegmentation,
    offerPositioning: strategy.offerPositioning,
    campaignArchitecture: strategy.campaignArchitecture,
  },
  null,
  2,
)}
\`\`\`

Retorne APENAS o JSON do plano perpétuo. Cada passo do funil deve ter regra de automação precisa.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "launch_plan_approval",
    thinkingMessages: [
      "Analisando modelo de lançamento perpétuo...",
      "Definindo trigger do funil (VSL, webinário, desafio)...",
      "Estruturando sequência de aquecimento pré-trigger...",
      "Projetando abertura individual do carrinho por lead...",
      "Criando sequência de cart open com urgência real...",
      "Construindo loop de re-entry para leads não convertidos...",
      "Mapeando automações necessárias para cada etapa...",
    ],
  });

  return parseAgentJSON<PerpetualLaunchOutput>(result.content, {
    planTitle: `Lançamento Perpétuo — ${String(intakeData["product.name"] ?? "")}`,
    trigger: "vsl",
    triggerDescription: "",
    cartOpenTrigger: "Assistiu 80% do VSL",
    cartOpenDuration: 48,
    cartCloseMechanism: "",
    monthlyEntries: 0,
    monthlyConversionTarget: 0,
    funnelMap: [],
    emailSequence: [],
    cartOpenSequence: [],
    reEntryLoop: {
      triggerCondition: "30 dias após não comprar",
      waitDays: 30,
      reEntryOffer: "",
      maxReEntries: 2,
    },
    technicalRequirements: [],
    automationPlatformRecommendation: "",
    monthlyMetrics: [],
    managerNotes: result.content,
  });
}
