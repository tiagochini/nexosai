import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface OrganicContentPiece {
  platform: "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin" | "threads";
  format: string;
  hook: string;
  angle: string;
  postingTime: string;
  frequency: string;
  hashtagStrategy: string;
  cta: string;
  repurposeFrom?: string;
}

export interface OrganicGrowthPhase {
  phase: "awareness" | "authority" | "warmup" | "pre_launch" | "cart_open" | "cart_close" | "post_launch";
  name: string;
  dayStart: number;
  dayEnd: number;
  objective: string;
  emotionalState: string;
  contentPillars: string[];
  platformFocus: {
    platform: string;
    role: string;
    dailyActions: string[];
    frequency: string;
  }[];
  keyContent: OrganicContentPiece[];
  engagementTactics: string[];
  audienceGrowthGoal: string;
  kpis: { metric: string; target: string }[];
}

export interface OrganicTrafficOutput {
  campaignTitle: string;
  audienceDiagnosis: {
    currentState: string;
    primaryPlatforms: string[];
    audienceTemperature: "cold" | "warm" | "hot";
    competitorGaps: string[];
    uniqueAngle: string;
    authorityPositioning: string;
  };
  contentStrategy: {
    pillar: string;
    description: string;
    percentage: number;
    platforms: string[];
    examples: string[];
  }[];
  phases: OrganicGrowthPhase[];
  platformPlaybooks: {
    platform: string;
    algorithmInsights: string;
    bestPostingTimes: string[];
    formatPriority: string[];
    growthTactics: string[];
    engagementRules: string[];
    hashtagFramework: string;
    monthlyFollowerProjection: string;
  }[];
  followerGrowthPlan: {
    tactic: string;
    platform: string;
    effort: "low" | "medium" | "high";
    weeklyTimeInvestment: string;
    expectedMonthlyGrowth: string;
    instructions: string;
  }[];
  contentCalendar: {
    dayOfWeek: string;
    platform: string;
    format: string;
    contentAngle: string;
    productionNotes: string;
  }[];
  audiencePreparationSequence: {
    week: number;
    focus: string;
    contentPieces: number;
    keyMessage: string;
    platformActions: string[];
    audienceStateTarget: string;
  }[];
  engagementSystem: {
    rule: string;
    timing: string;
    platform: string;
    script?: string;
  }[];
  kpis: {
    metric: string;
    baseline: string;
    target30d: string;
    target60d: string;
    target90d: string;
    trackingMethod: string;
  }[];
  organicNotes: string;
}

const ORGANIC_TRAFFIC_PROMPT = `Você é o Especialista de Tráfego Orgânico da NexOS AI — o profissional que opera 24 horas por dia preparando audiências, crescendo seguidores e construindo o ativo orgânico que nenhuma plataforma de anúncios pode comprar: confiança real de uma audiência engajada.

## FILOSOFIA CENTRAL — ORGÂNICO NÃO É GRÁTIS, É COMPOSTO

Tráfego orgânico parece grátis porque não tem custo em dinheiro — mas tem custo em tempo, consistência e inteligência estratégica. Quem trata orgânico como "post qualquer coisa" desperdiça o ativo mais valioso do marketing digital: atenção voluntária.

**A verdade sobre o algoritmo:** Toda plataforma quer fazer usuários ficarem mais tempo. Conteúdo que gera engajamento real (comentários, salvamentos, compartilhamentos, re-assistências) é amplificado. Conteúdo que gera scroll passivo é suprimido. Você precisa pensar como o algoritmo quer que você pense.

## ARQUITETURA ORGÂNICA DE 5 PILARES

**Pilar 1 — Atenção (Stop the Scroll)**
Os primeiros 0–3 segundos são o único filtro que importa. O algoritmo lê taxa de retenção dos primeiros 3s. Se menos de 50% das pessoas passam desse ponto, o conteúdo morre. Hook visual + hook verbal + promessa específica — tudo nos primeiros 3 segundos.

**Pilar 2 — Autoridade Específica (Nicho de Nicho)**
Generalistas são invisíveis. Especialistas em algo específico são algoritmo-favorecidos E têm audiência de compradores. "Marketing digital" é invisível. "Estratégia de lançamento para coaches de saúde feminina" converte.

**Pilar 3 — Engajamento Ativo (Comunidade > Audiência)**
Comentário respondido dentro de 1h aumenta distribuição em 40%. Pergunta no final do post duplica comentários. Story com enquete dobra visualizações do próximo post. Engajamento não é opcional — é o combustível do algoritmo.

**Pilar 4 — Consistência de Formato (Treinamento do Algoritmo)**
Postar o mesmo formato, no mesmo horário, na mesma frequência treina o algoritmo a distribuir seu conteúdo proativamente. Variação aleatória = distribuição aleatória.

**Pilar 5 — Ponte para Aquecimento (Orgânico que Vende)**
Cada peça de conteúdo orgânico tem um JOB dentro do funil: criar consciência, construir autoridade, gerar desejo, capturar lead, ou converter. Conteúdo sem JOB definido é hobby, não estratégia.

## ESTRATÉGIA POR PLATAFORMA

### Instagram
- **Reels**: prioridade máxima do algoritmo (2024–2025). Hook visual nos primeiros 0,5s. Texto na tela com palavra-chave de paragem. Duração: 7–30s (maior retenção) ou 45–90s (maior entrega para novos).
- **Carrossel**: maior taxa de salvamento de todos os formatos. Cada slide deve gerar curiosidade para o próximo. Último slide = CTA de follow ou link.
- **Stories**: manter streak de 5+ dias aumenta distribuição. Enquetes, caixinhas de pergunta e contagens regressivas aumentam interação e aquecimento.
- **Feed estático**: menor alcance orgânico, mas indexável pela busca do Instagram. Use para conteúdo evergreen com keyword no caption.
- **Horários de pico**: Ter–Sex 18h–21h (BRL). Seg 12h–14h para audiência profissional.

### TikTok
- **Velocidade é o algoritmo**: 3 posts/dia nos primeiros 30 dias de conta nova = aceleração exponencial de distribuição.
- **FYP (For You Page)**: conteúdo que mantém 80%+ de watch rate chega ao FYP de não-seguidores. Prioritize hooks que prendem.
- **Tendências + Nicho**: usar áudio em trend + aplicar ao seu nicho é a arbitragem de alcance do TikTok.
- **Duração**: 15–30s (alta retenção) ou 2–3min (mais autoridade, mais comentários).
- **Comentários**: responder comentários com vídeo gera novo conteúdo indexado pelo algoritmo.

### YouTube (Shorts + Longo)
- **Shorts**: concorre no mesmo espaço que TikTok/Reels. Hook nos primeiros 3s, sem barra preta nas bordas, sem logo no início.
- **Vídeo longo**: SEO de longo prazo. Um vídeo bem otimizado gera leads por anos. Título com keyword de busca, thumbnail que compete, primeiros 30s que entregam a promessa do título.
- **Consistência**: 1 vídeo longo/semana é suficiente se mantido por 6+ meses. Canal que para por 2 semanas perde 30–60% de distribuição.

### Facebook
- **Grupos**: maior engajamento orgânico do Facebook em 2024. Criar ou participar ativamente de grupo do nicho é tráfego gratuito.
- **Reels**: Facebook distribuindo Reels para audiências fora dos seguidores — único formato com alcance orgânico real.
- **Posts de texto**: contra-intuitivo, mas posts longos de texto que geram comentários têm alcance alto.

## PREPARAÇÃO DE AUDIÊNCIA PRÉ-LANÇAMENTO (CRÍTICO)

A audiência orgânica precisa de preparo mínimo de 21 dias antes do carrinho abrir. Sem esse preparo, até seguidores fiéis não compram.

**Semanas -3 a -2 (Consciência do Problema)**
Job: Fazer o avatar sentir o problema com mais intensidade. Sem mencionar solução ou produto.
Conteúdo: "3 erros que [avatar] comete sem perceber", "Por que [resultado desejado] parece impossível", histórias de transformação sem revelar o mecanismo.

**Semana -1 (Consciência da Solução)**
Job: Introduzir o mecanismo único sem revelar o produto. Criar categoria mental.
Conteúdo: "A razão pela qual [método comum] não funciona", "Existe uma forma diferente de chegar a [resultado]", bastidores e prova de conceito.

**Dias -3 a -1 (Antecipação)**
Job: Criar expectativa real de que algo está chegando. Deixar a audiência ansiosa.
Conteúdo: Contagem regressiva stories, "preparando algo grande para vocês", caixinha de perguntas sobre a dor principal, lista VIP.

## ESTRUTURA DE SAÍDA

Retorne APENAS JSON válido exatamente no formato abaixo:

\`\`\`json
{
  "campaignTitle": "string",
  "audienceDiagnosis": {
    "currentState": "string — diagnóstico honesto da situação atual da audiência orgânica",
    "primaryPlatforms": ["string"],
    "audienceTemperature": "cold|warm|hot",
    "competitorGaps": ["string — oportunidades que os concorrentes não exploram"],
    "uniqueAngle": "string — o ângulo de conteúdo diferenciador para este avatar",
    "authorityPositioning": "string — como se posicionar como referência no nicho"
  },
  "contentStrategy": [
    {
      "pillar": "string — nome do pilar de conteúdo",
      "description": "string",
      "percentage": 0,
      "platforms": ["string"],
      "examples": ["string — exemplos de posts/vídeos concretos"]
    }
  ],
  "phases": [
    {
      "phase": "awareness|authority|warmup|pre_launch|cart_open|cart_close|post_launch",
      "name": "string",
      "dayStart": 0,
      "dayEnd": 0,
      "objective": "string",
      "emotionalState": "string — estado emocional que o avatar deve ter ao final",
      "contentPillars": ["string"],
      "platformFocus": [
        {
          "platform": "string",
          "role": "string — papel desta plataforma nesta fase",
          "dailyActions": ["string — ações específicas do dia a dia"],
          "frequency": "string"
        }
      ],
      "keyContent": [
        {
          "platform": "instagram|tiktok|youtube|facebook|linkedin|threads",
          "format": "string",
          "hook": "string — hook completo pronto para usar",
          "angle": "string",
          "postingTime": "string",
          "frequency": "string",
          "hashtagStrategy": "string",
          "cta": "string",
          "repurposeFrom": "string ou null"
        }
      ],
      "engagementTactics": ["string"],
      "audienceGrowthGoal": "string — meta de crescimento para esta fase",
      "kpis": [{ "metric": "string", "target": "string" }]
    }
  ],
  "platformPlaybooks": [
    {
      "platform": "string",
      "algorithmInsights": "string — como o algoritmo desta plataforma funciona hoje",
      "bestPostingTimes": ["string"],
      "formatPriority": ["string — formatos em ordem de prioridade de alcance"],
      "growthTactics": ["string"],
      "engagementRules": ["string — regras de ouro para engajamento"],
      "hashtagFramework": "string — estratégia completa de hashtags",
      "monthlyFollowerProjection": "string — projeção de crescimento mensal"
    }
  ],
  "followerGrowthPlan": [
    {
      "tactic": "string",
      "platform": "string",
      "effort": "low|medium|high",
      "weeklyTimeInvestment": "string",
      "expectedMonthlyGrowth": "string",
      "instructions": "string — passo a passo completo de execução"
    }
  ],
  "contentCalendar": [
    {
      "dayOfWeek": "string",
      "platform": "string",
      "format": "string",
      "contentAngle": "string",
      "productionNotes": "string"
    }
  ],
  "audiencePreparationSequence": [
    {
      "week": 0,
      "focus": "string",
      "contentPieces": 0,
      "keyMessage": "string",
      "platformActions": ["string"],
      "audienceStateTarget": "string — estado mental que a audiência deve ter ao final desta semana"
    }
  ],
  "engagementSystem": [
    {
      "rule": "string",
      "timing": "string",
      "platform": "string",
      "script": "string ou null — script pronto para resposta/interação"
    }
  ],
  "kpis": [
    {
      "metric": "string",
      "baseline": "string",
      "target30d": "string",
      "target60d": "string",
      "target90d": "string",
      "trackingMethod": "string"
    }
  ],
  "organicNotes": "string — observações estratégicas críticas para execução"
}
\`\`\``;

export async function runOrganicTrafficAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput | undefined,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
  memoryContext?: string,
): Promise<OrganicTrafficOutput> {
  const avatarSummary = profile?.primaryAvatar
    ? `Avatar: ${profile.primaryAvatar.name} | Plataformas: ${(profile.primaryAvatar.whereTheyHangOut ?? []).join(", ")} | Conteúdo: ${(profile.primaryAvatar.contentTheyConsume ?? []).join(", ")}`
    : "";

  const strategySummary = strategy
    ? `Posicionamento: ${strategy.offerPositioning?.uniqueValueProposition ?? ""} | Diferencial: ${strategy.offerPositioning?.primaryDifferentiator ?? ""} | Narrativa: ${strategy.campaignArchitecture?.coreNarrative ?? ""}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "organic_traffic",
    systemPrompt: ORGANIC_TRAFFIC_PROMPT,
    memoryContext,
    messages: [
      {
        role: "user",
        content: `Crie o plano completo de tráfego orgânico para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Categoria:** ${String(intakeData["product.category"] ?? "")}
**Preço:** R$ ${String(intakeData["product.price"] ?? "")}
**Modelo de campanha:** ${String(intakeData["campaign.type"] ?? "launch")}
**Meta de receita:** R$ ${String(intakeData["campaign.revenueTarget"] ?? "")}
**Plataformas onde já tem presença:** ${String(intakeData["social.platforms"] ?? "Instagram, TikTok")}
**Tamanho atual da audiência:** ${String(intakeData["social.audienceSize"] ?? "não informado")}
**Nicho / mercado:** ${String(intakeData["audience.market"] ?? "")}

${avatarSummary ? `**Avatar:**\n${avatarSummary}` : ""}
${strategySummary ? `**Estratégia aprovada:**\n${strategySummary}` : ""}

**O PLANO PRECISA INCLUIR:**
1. Diagnóstico honesto da situação atual da audiência orgânica
2. Estratégia de conteúdo com pilares e percentual de cada tipo
3. Fases do orgânico alinhadas com o lançamento (pré-aquecimento mínimo 21 dias antes do carrinho)
4. Playbook específico por plataforma (Instagram, TikTok, YouTube, Facebook)
5. Plano de crescimento de seguidores com táticas, esforço e projeção mensal
6. Calendário semanal de conteúdo com formato, ângulo e horário
7. Sequência de preparação de audiência semana a semana até o carrinho abrir
8. Sistema de engajamento com scripts prontos para resposta
9. KPIs em 30, 60 e 90 dias com metodologia de rastreamento

Retorne APENAS o JSON do plano de tráfego orgânico.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Diagnosticando situação atual da audiência orgânica...",
      "Analisando algoritmos das plataformas e oportunidades de crescimento...",
      "Estruturando pilares de conteúdo e ângulo diferenciador...",
      "Construindo playbooks por plataforma (Instagram, TikTok, YouTube, Facebook)...",
      "Montando sequência de preparação de audiência pré-lançamento...",
      "Criando calendário semanal de conteúdo com hooks prontos...",
      "Projetando KPIs de crescimento orgânico em 30, 60 e 90 dias...",
    ],
  });

  return parseAgentJSON<OrganicTrafficOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    audienceDiagnosis: {
      currentState: "",
      primaryPlatforms: [],
      audienceTemperature: "cold",
      competitorGaps: [],
      uniqueAngle: "",
      authorityPositioning: "",
    },
    contentStrategy: [],
    phases: [],
    platformPlaybooks: [],
    followerGrowthPlan: [],
    contentCalendar: [],
    audiencePreparationSequence: [],
    engagementSystem: [],
    kpis: [],
    organicNotes: result.content,
  });
}
