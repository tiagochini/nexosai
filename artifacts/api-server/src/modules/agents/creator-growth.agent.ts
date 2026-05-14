import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface GrowthAction {
  week: number;
  action: string;
  platform: string;
  effort: "low" | "medium" | "high";
  expectedImpact: string;
  instructions: string;
}

export interface CreatorGrowthOutput {
  campaignTitle: string;
  currentBaseline: {
    assessment: string;
    strengths: string[];
    gaps: string[];
    quickWins: string[];
  };
  growthStrategy: {
    pillar: string;
    description: string;
    platforms: string[];
    timeframe: string;
    expectedResult: string;
  }[];
  collaborationPlan: {
    type: "collab" | "guest" | "podcast" | "interview" | "duet" | "challenge";
    targetProfile: string;
    approachScript: string;
    contentFormat: string;
    mutualBenefit: string;
    timeline: string;
  }[];
  audienceEngagement: {
    tactic: string;
    frequency: string;
    platform: string;
    instructions: string;
    expectedEngagementLift: string;
  }[];
  contentRepurposing: {
    source: string;
    derivative: string;
    platform: string;
    adaptationInstructions: string;
    frequency: string;
  }[];
  emailListGrowth: {
    tactic: string;
    leadMagnet: string;
    platform: string;
    expectedConversionRate: string;
    monthlyLeadsProjection: number;
  }[];
  weeklyPlan: GrowthAction[];
  kpis: {
    metric: string;
    currentBaseline: string;
    target3Months: string;
    target6Months: string;
    target12Months: string;
    trackingMethod: string;
  }[];
  creatorGrowthNotes: string;
}

const CREATOR_GROWTH_PROMPT = `Você é o Agente de Crescimento de Criador da NexOS AI — especialista em estratégias de audiência para criadores de conteúdo e produtores digitais.

Você transforma um criador com audiência pequena ou média em uma referência de nicho com audiência engajada e crescimento acelerado.

## FILOSOFIA DE CRESCIMENTO PARA CRIADORES DIGITAIS

**O paradoxo do criador:** quem cria mais nem sempre cresce mais. Quem cria certo, para o avatar certo, no momento certo — esse cresce.

**Os 5 motores de crescimento:**
1. **Colaboração** — o atalho. Uma collab com alguém do mesmo tamanho ou maior acelera anos de crescimento em semanas
2. **SEO de conteúdo** — o composto. Conteúdo otimizado continua trazendo resultado por anos
3. **Consistência de formato** — o algoritmo ama criadores previsíveis
4. **Engajamento real** — responder comentários, fazer perguntas, criar comunidade
5. **Repurposing estratégico** — 1 conteúdo longo → 8-12 derivados

**Colabs que funcionam:**
- Mesmo tamanho de audiência, nichos complementares
- Formatos: entrevistas cruzadas, challenges, conteúdo co-criado, lives juntos
- Abordagem: "eu já faço X para minha audiência, e você Y para a sua. Juntos entregamos Z, que nenhum de nós entregaria sozinho."

**O erro da lista pequena:**
Criadores focam em seguidores. A lista de e-mail vale 10x mais. 1.000 pessoas na lista = equivalente a 10.000 seguidores em conversão.

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "currentBaseline": {
    "assessment": "string — diagnóstico da situação atual do criador",
    "strengths": ["string — o que já funciona"],
    "gaps": ["string — o que está faltando"],
    "quickWins": ["string — ações de 0-30 dias com impacto imediato"]
  },
  "growthStrategy": [
    {
      "pillar": "string — nome do pilar de crescimento",
      "description": "string",
      "platforms": ["string"],
      "timeframe": "string",
      "expectedResult": "string — resultado esperado com número estimado"
    }
  ],
  "collaborationPlan": [
    {
      "type": "collab|guest|podcast|interview|duet|challenge",
      "targetProfile": "string — perfil ideal do parceiro (não nome específico, mas arquétipo)",
      "approachScript": "string — script de abordagem completo para DM/e-mail",
      "contentFormat": "string — o que produzir juntos",
      "mutualBenefit": "string — o que cada lado ganha",
      "timeline": "string"
    }
  ],
  "audienceEngagement": [
    {
      "tactic": "string",
      "frequency": "string",
      "platform": "string",
      "instructions": "string — como implementar passo a passo",
      "expectedEngagementLift": "string — aumento esperado no engajamento"
    }
  ],
  "contentRepurposing": [
    {
      "source": "string — conteúdo original",
      "derivative": "string — conteúdo derivado",
      "platform": "string",
      "adaptationInstructions": "string",
      "frequency": "string"
    }
  ],
  "emailListGrowth": [
    {
      "tactic": "string",
      "leadMagnet": "string — isca digital específica para esta tática",
      "platform": "string",
      "expectedConversionRate": "string",
      "monthlyLeadsProjection": 0
    }
  ],
  "weeklyPlan": [
    {
      "week": 1,
      "action": "string",
      "platform": "string",
      "effort": "low|medium|high",
      "expectedImpact": "string",
      "instructions": "string"
    }
  ],
  "kpis": [
    {
      "metric": "string",
      "currentBaseline": "string",
      "target3Months": "string",
      "target6Months": "string",
      "target12Months": "string",
      "trackingMethod": "string"
    }
  ],
  "creatorGrowthNotes": "string — observações estratégicas para o criador"
}
\`\`\``;

export async function runCreatorGrowthAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<CreatorGrowthOutput> {
  const avatarContext = profile
    ? `Avatar-alvo: ${profile.primaryAvatar?.name ?? "Avatar principal"} | ${(profile.primaryAvatar?.whereTheyHangOut ?? []).join(", ")} | Conteúdo: ${(profile.primaryAvatar?.contentTheyConsume ?? []).join(", ")}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "creator_growth",
    systemPrompt: CREATOR_GROWTH_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o plano de crescimento de audiência para este criador.

**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Posicionamento:** ${String(intakeData["creator.positioning"] ?? "")}
**Ângulo único:** ${String(intakeData["creator.uniqueAngle"] ?? "")}
**Nicho:** ${String(intakeData["product.category"] ?? "")}
${avatarContext}

**PLANO NECESSÁRIO:**
- Diagnóstico honesto da situação atual (baseado no que foi declarado)
- Plano de colaborações com script de abordagem
- Sistema de repurposing de conteúdo
- Plano de 12 semanas semana a semana
- KPIs com metas em 3, 6 e 12 meses
- Estratégia de crescimento de lista de e-mail

Retorne APENAS o JSON do plano de crescimento.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Diagnosticando situação atual e identificando quick wins...",
      "Estruturando pilares de crescimento por plataforma...",
      "Planejando estratégia de colaborações...",
      "Criando sistema de repurposing de conteúdo...",
      "Montando plano semanal de 12 semanas...",
      "Projetando KPIs de crescimento em 3, 6 e 12 meses...",
    ],
  });

  return parseAgentJSON<CreatorGrowthOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    currentBaseline: { assessment: "", strengths: [], gaps: [], quickWins: [] },
    growthStrategy: [],
    collaborationPlan: [],
    audienceEngagement: [],
    contentRepurposing: [],
    emailListGrowth: [],
    weeklyPlan: [],
    kpis: [],
    creatorGrowthNotes: result.content,
  });
}
