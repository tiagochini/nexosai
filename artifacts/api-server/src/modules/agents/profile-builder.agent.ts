import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AvatarProfile {
  name: string;
  age: string;
  gender: string;
  location: string;
  income: string;
  education: string;
  occupation: string;
  familyStatus: string;
  values: string[];
  aspirations: string[];
  fears: string[];
  dailyPains: string[];
  deepestDesire: string;
  whereTheyHangOut: string[];
  contentTheyConsume: string[];
  buyingTriggers: string[];
  buyingBlockers: string[];
  languageStyle: string;
  keywordsTheyUse: string[];
  wordsToAvoid: string[];
  awarenessLevel: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
  sophisticationLevel: "naive" | "intermediate" | "sophisticated" | "hyper_aware";
  typicalObjections: string[];
  whatMakesThemTrust: string[];
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  estimatedMarketSize: string;
  priority: "primary" | "secondary" | "tertiary";
  painPoint: string;
  deepestDesire: string;
  messageAngle: string;
  emotionalTrigger: string;
  bestChannels: string[];
  contentFormat: string[];
  estimatedCPL: number;
  estimatedConversionRate: number;
  budgetAllocationPercent: number;
  warningNotes?: string;
}

export interface ProductProfile {
  name: string;
  category: string;
  pricePoint: "economy" | "mid_market" | "premium" | "luxury";
  priceAnchorRecommended: number;
  usp: string;
  keyBenefits: string[];
  mainObjections: string[];
  competitivePositioning: string;
  productMarketFitScore: number;
  productMarketFitAnalysis: string;
  idealPriceRange: { min: number; max: number };
  priceStrategy: string;
  guaranteeRecommendation: string;
}

export interface MarketIntelligence {
  maturity: "emerging" | "growing" | "mature" | "saturated" | "declining";
  competitionLevel: "low" | "medium" | "high" | "extreme";
  marketSizeEstimate: string;
  averageCPL: number;
  typicalConversionRate: number;
  typicalROAS: number;
  campaignApproach: string;
  redFlags: string[];
  opportunities: string[];
  benchmarks: {
    metric: string;
    industryAverage: string;
    topPerformer: string;
  }[];
}

export interface PositioningFramework {
  coreHeadline: string;
  subheadline: string;
  emotionalHook: string;
  logicalArgument: string;
  socialProofAngle: string;
  urgencyFraming: string;
  uniqueMechanism: string;
  campaignBigIdea: string;
  elevatorPitch: string;
}

export interface ProfileBuilderOutput {
  product: ProductProfile;
  primaryAvatar: AvatarProfile;
  secondaryAvatars: Omit<AvatarProfile, "values" | "aspirations" | "contentTheyConsume" | "wordsToAvoid">[];
  segments: AudienceSegment[];
  marketIntelligence: MarketIntelligence;
  positioning: PositioningFramework;
  profileScore: number;
  profileStrengths: string[];
  validationWarnings: string[];
  criticalInsights: string[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const PROFILE_BUILDER_PROMPT = `Você é o Agente de Inteligência de Perfil da NexOS AI.

Sua função é a mais crítica de toda a plataforma: **entender profundamente o produto, o mercado e as pessoas** antes de qualquer estratégia ou campanha ser criada.

Você é a diferença entre uma campanha genérica e uma campanha que ressoa tão profundamente com a audiência que parece que o criador "leu a mente" do cliente.

## O QUE VOCÊ FAZ

### 1. Perfil do Produto
Você analisa o produto como um médico analisa um paciente. Não aceita o que o criador diz no valor de face — você **deriva** o que o produto realmente é, qual é sua proposta de valor real e onde ele se encaixa no mercado.

- **USP real vs USP declarado**: O criador pode dizer "meu método é único", mas você olha os dados e determina qual é o diferencial genuíno
- **Score de product-market fit**: 0-100. Abaixo de 50, você avisa. Acima de 80, você identifica o mecanismo de sucesso
- **Posicionamento de preço**: economia / mid-market / premium / luxury — com análise de se o preço está correto para a percepção de valor

### 2. Avatar Primário (Hiperpersonalizado)
Um avatar tão específico que ao ler, o cliente real pensa "como eles me conhecem assim?".

Não escreva generalidades como "mulher que quer crescer profissionalmente". Escreva:
- "Maria, 38 anos, dentista em Belo Horizonte, renda R$18k/mês, 2 filhos, divorciada há 3 anos, usa Instagram e YouTube como principal entretenimento, acorda às 6h ansiedade sobre..."

### 3. Segmentação de Audiência
Mínimo 3 segmentos distintos. Cada um com:
- Dor específica (não genérica)
- Ângulo de mensagem diferente
- Canal onde estão
- CPL e taxa de conversão estimados com base em benchmarks do mercado
- % do budget recomendado para cada segmento

### 4. Inteligência de Mercado
Você tem memória de +10.000 campanhas brasileiras. Use esses benchmarks para avaliar:
- CPL típico por nicho (saúde digital: R$3-12, finança: R$8-25, relacionamento: R$2-8...)
- Taxa de conversão típica por mercado e sofisticação de audiência
- Nível real de saturação do mercado
- Oportunidades que o criador provavelmente não viu

### 5. Framework de Posicionamento
A "Big Idea" — o conceito central que vai unir toda a comunicação da campanha.
O mecanismo único — o que explica POR QUE este produto funciona de forma diferente de tudo que existe.

## DIRETRIZES CRÍTICAS

**Seja brutalmente honesto.** Se o produto tem problemas, aponte. Se o preço está errado para o mercado, diga. Se o avatar está mal definido, construa um melhor.

**Use benchmarks reais.** Não invente dados. Se você não tem benchmark específico, estime conservadoramente e indique que é estimativa.

**Pense em 3 camadas de desejo:**
1. Desejo superficial (o que dizem que querem)
2. Desejo real (o que realmente querem)
3. Desejo oculto (o que nunca admitem querer mas é o real motor)

**Palavras que você usa na análise:**
- Específicas: "mulher 35-45 que já tentou X e Y e falhou"
- Emocionais: "medo de envelhecer sem realizações financeiras"
- Comportamentais: "assiste vídeos de Y às 23h no celular enquanto os filhos dormem"

**Retorne APENAS JSON válido** no formato exato abaixo. Zero texto fora do JSON.

\`\`\`json
{
  "product": {
    "name": "string",
    "category": "string",
    "pricePoint": "economy|mid_market|premium|luxury",
    "priceAnchorRecommended": 0,
    "usp": "string — a proposta de valor real, derivada pela IA, não o que o criador disse",
    "keyBenefits": ["string — outcomes reais, não features (o que o cliente GANHA, não o que o produto É)"],
    "mainObjections": ["string — as 5 principais objeções que impedem a compra"],
    "competitivePositioning": "string — onde se encaixa vs concorrência",
    "productMarketFitScore": 0,
    "productMarketFitAnalysis": "string — análise crítica do fit com o mercado",
    "idealPriceRange": { "min": 0, "max": 0 },
    "priceStrategy": "string — estratégia de precificação e ancoragem",
    "guaranteeRecommendation": "string — garantia recomendada para reduzir risco percebido"
  },
  "primaryAvatar": {
    "name": "string — nome fictício específico",
    "age": "string — faixa etária específica",
    "gender": "string",
    "location": "string — onde vive (cidade/região)",
    "income": "string — renda mensal estimada",
    "education": "string",
    "occupation": "string — profissão específica",
    "familyStatus": "string",
    "values": ["string — valores que guiam suas decisões"],
    "aspirations": ["string — o que aspira ter/ser/fazer"],
    "fears": ["string — medos profundos e específicos"],
    "dailyPains": ["string — dores do dia a dia relacionadas ao problema"],
    "deepestDesire": "string — desejo mais profundo e oculto",
    "whereTheyHangOut": ["string — plataformas e comunidades"],
    "contentTheyConsume": ["string — tipo de conteúdo que consomem"],
    "buyingTriggers": ["string — o que os faz comprar"],
    "buyingBlockers": ["string — o que os impede de comprar"],
    "languageStyle": "string — como se comunicam (vocabulário, tom, gírias)",
    "keywordsTheyUse": ["string — palavras e frases que usam para descrever o problema"],
    "wordsToAvoid": ["string — palavras que causam resistência ou soam erradas para eles"],
    "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
    "sophisticationLevel": "naive|intermediate|sophisticated|hyper_aware",
    "typicalObjections": ["string — objeções específicas deste avatar"],
    "whatMakesThemTrust": ["string — o que os faz confiar em um produto/criador"]
  },
  "secondaryAvatars": [
    {
      "name": "string",
      "age": "string",
      "gender": "string",
      "location": "string",
      "income": "string",
      "education": "string",
      "occupation": "string",
      "familyStatus": "string",
      "fears": ["string"],
      "dailyPains": ["string"],
      "deepestDesire": "string",
      "whereTheyHangOut": ["string"],
      "buyingTriggers": ["string"],
      "buyingBlockers": ["string"],
      "languageStyle": "string",
      "keywordsTheyUse": ["string"],
      "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
      "sophisticationLevel": "naive|intermediate|sophisticated|hyper_aware",
      "typicalObjections": ["string"],
      "whatMakesThemTrust": ["string"]
    }
  ],
  "segments": [
    {
      "id": "string — slug único (ex: dentistas_bh)",
      "name": "string — nome descritivo do segmento",
      "description": "string — quem são essas pessoas especificamente",
      "estimatedMarketSize": "string — tamanho estimado (ex: ~180k pessoas no Brasil)",
      "priority": "primary|secondary|tertiary",
      "painPoint": "string — a dor principal deste segmento",
      "deepestDesire": "string — o desejo mais profundo",
      "messageAngle": "string — o ângulo de mensagem que vai ressoar",
      "emotionalTrigger": "string — o gatilho emocional principal",
      "bestChannels": ["string"],
      "contentFormat": ["string — formatos de conteúdo que consomem"],
      "estimatedCPL": 0,
      "estimatedConversionRate": 0.00,
      "budgetAllocationPercent": 0,
      "warningNotes": "string ou null — avisos sobre dificuldades deste segmento"
    }
  ],
  "marketIntelligence": {
    "maturity": "emerging|growing|mature|saturated|declining",
    "competitionLevel": "low|medium|high|extreme",
    "marketSizeEstimate": "string",
    "averageCPL": 0,
    "typicalConversionRate": 0.00,
    "typicalROAS": 0.0,
    "campaignApproach": "string — abordagem recomendada dado o estado do mercado",
    "redFlags": ["string — riscos específicos neste mercado"],
    "opportunities": ["string — oportunidades que o criador provavelmente não viu"],
    "benchmarks": [
      {
        "metric": "string — CPL, taxa de conversão, ticket médio...",
        "industryAverage": "string",
        "topPerformer": "string"
      }
    ]
  },
  "positioning": {
    "coreHeadline": "string — o headline principal da campanha",
    "subheadline": "string",
    "emotionalHook": "string — o gancho emocional que abre a campanha",
    "logicalArgument": "string — o argumento lógico que justifica a compra",
    "socialProofAngle": "string — como usar prova social para este avatar",
    "urgencyFraming": "string — como criar urgência genuína para este avatar",
    "uniqueMechanism": "string — o mecanismo único que explica por que funciona",
    "campaignBigIdea": "string — a grande ideia central que unifica toda a comunicação",
    "elevatorPitch": "string — 1 frase que explica o produto e seu resultado"
  },
  "profileScore": 0,
  "profileStrengths": ["string — pontos fortes do produto/avatar/posicionamento"],
  "validationWarnings": ["string — avisos sobre problemas que podem prejudicar a campanha"],
  "criticalInsights": ["string — insights que o criador provavelmente não tem mas são decisivos"]
}
\`\`\``;

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runProfileBuilderAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  campaignType: string,
  log: Logger,
): Promise<ProfileBuilderOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "command",
    systemPrompt: PROFILE_BUILDER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Construa o perfil completo de produto, avatar e mercado para esta campanha.

**Tipo de campanha:** ${campaignType}

**Dados fornecidos pelo criador:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

## INSTRUÇÕES ESPECÍFICAS

1. **Seja hiperespecífico no avatar primário** — não escreva "mulher que quer mudar de vida". Escreva quem ela é, onde mora, o que sente às 23h, o que teme, o que deseja com vergonha de admitir.

2. **Crie mínimo 3 segmentos** — cada um com um ângulo de mensagem diferente, canal diferente e estimativas de CPL e conversão baseadas em benchmarks do mercado brasileiro.

3. **Score de product-market fit** — seja honesto. Se o produto tem problemas (preço errado, avatar mal definido, mercado saturado), aponte no score e nas validationWarnings.

4. **Posicionamento** — derive a "Big Idea" da campanha. O conceito central que vai unificar todo o conteúdo. O "mecanismo único" que explica por que este produto funciona diferente de qualquer outro.

5. **Inteligência de mercado** — use benchmarks reais do mercado digital brasileiro para estimar CPL, taxa de conversão e ROAS típico para este nicho.

Retorne APENAS o JSON. Zero texto fora do JSON.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando o produto e sua proposta de valor real...",
      "Identificando o nível de sofisticação e consciência da audiência...",
      "Construindo o avatar primário com profundidade psicográfica...",
      "Mapeando segmentos distintos com ângulos de mensagem diferentes...",
      "Calculando benchmarks de CPL e conversão para este mercado...",
      "Avaliando maturidade e saturação do mercado...",
      "Derivando o mecanismo único e a Big Idea da campanha...",
      "Calculando score de product-market fit e validando riscos...",
    ],
  });

  const fallback: ProfileBuilderOutput = {
    product: {
      name: String(intakeData["product.name"] ?? ""),
      category: String(intakeData["product.category"] ?? ""),
      pricePoint: "mid_market",
      priceAnchorRecommended: Number(intakeData["product.price"] ?? 0),
      usp: "",
      keyBenefits: [],
      mainObjections: [],
      competitivePositioning: "",
      productMarketFitScore: 50,
      productMarketFitAnalysis: "",
      idealPriceRange: { min: 0, max: 0 },
      priceStrategy: "",
      guaranteeRecommendation: "",
    },
    primaryAvatar: {
      name: "Avatar",
      age: "",
      gender: "",
      location: "",
      income: "",
      education: "",
      occupation: "",
      familyStatus: "",
      values: [],
      aspirations: [],
      fears: [],
      dailyPains: [],
      deepestDesire: "",
      whereTheyHangOut: [],
      contentTheyConsume: [],
      buyingTriggers: [],
      buyingBlockers: [],
      languageStyle: "",
      keywordsTheyUse: [],
      wordsToAvoid: [],
      awarenessLevel: "problem_aware",
      sophisticationLevel: "intermediate",
      typicalObjections: [],
      whatMakesThemTrust: [],
    },
    secondaryAvatars: [],
    segments: [],
    marketIntelligence: {
      maturity: "growing",
      competitionLevel: "medium",
      marketSizeEstimate: "",
      averageCPL: 0,
      typicalConversionRate: 0,
      typicalROAS: 0,
      campaignApproach: "",
      redFlags: [],
      opportunities: [],
      benchmarks: [],
    },
    positioning: {
      coreHeadline: "",
      subheadline: "",
      emotionalHook: "",
      logicalArgument: "",
      socialProofAngle: "",
      urgencyFraming: "",
      uniqueMechanism: "",
      campaignBigIdea: "",
      elevatorPitch: "",
    },
    profileScore: 50,
    profileStrengths: [],
    validationWarnings: [],
    criticalInsights: [],
  };

  return parseAgentJSON<ProfileBuilderOutput>(result.content, fallback);
}
