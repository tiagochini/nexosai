import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput, AudienceSegment } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_TARGETING } from "./cognitive-identity-system.js";

export interface MetaAudience {
  audienceId: string;
  name: string;
  type: "interest" | "custom" | "lookalike" | "broad" | "retargeting";
  size: string;
  interests?: string[];
  behaviors?: string[];
  demographics?: { ageMin: number; ageMax: number; genders: string[]; locations: string[] };
  exclusions?: string[];
  lookalikeSeed?: string;
  lookalikeSimilarity?: string;
  customAudienceSource?: string;
  phase: string;
  priority: "primary" | "secondary" | "test";
  estimatedCPL: number;
  notes: string;
}

export interface GoogleAudience {
  audienceId: string;
  name: string;
  type: "in_market" | "affinity" | "custom_intent" | "remarketing" | "similar" | "customer_match";
  description: string;
  keywords?: string[];
  urls?: string[];
  apps?: string[];
  phase: string;
  priority: "primary" | "secondary" | "test";
  notes: string;
}

export interface TikTokAudience {
  audienceId: string;
  name: string;
  type: "interest" | "behavior" | "custom" | "lookalike" | "broad";
  interests?: string[];
  behaviors?: string[];
  demographics?: { ageMin: number; ageMax: number; genders: string[] };
  customAudienceSource?: string;
  phase: string;
  priority: "primary" | "secondary" | "test";
  notes: string;
}

export interface TargetingOutput {
  campaignTitle: string;
  pixelSetupInstructions: {
    meta: { events: string[]; customConversions: string[]; setupNotes: string };
    google: { tags: string[]; conversions: string[]; setupNotes: string };
    tiktok: { events: string[]; setupNotes: string };
  };
  metaAudiences: MetaAudience[];
  googleAudiences: GoogleAudience[];
  tiktokAudiences: TikTokAudience[];
  audienceExclusions: {
    platform: string;
    audience: string;
    reason: string;
  }[];
  customAudiencesToBuild: {
    name: string;
    platform: string;
    source: string;
    instructions: string;
    buildNow: boolean;
  }[];
  audienceTestingMatrix: {
    phase: string;
    winner: string;
    testAudiences: string[];
    successMetric: string;
  }[];
  utmStructure: {
    source: string;
    medium: string;
    campaign: string;
    adset: string;
    ad: string;
    examples: string[];
  };
  targetingNotes: string;
}

const TARGETING_PROMPT = `Você é o Agente de Targeting Híbrido da NexOS AI — especialista em integrar tráfego PAGO e ORGÂNICO numa estratégia unificada de lançamento digital, com domínio em geolocalização e segmentação física para negócios locais (academias, studios, clínicas, unidades físicas).

Você vai além dos segmentos teóricos — você entrega as audiências prontas para configurar no Meta Business Manager, Google Ads e TikTok Ads Manager, combinadas com a estratégia orgânica de cada canal.

## ESTRATÉGIA HÍBRIDA: PAGO + ORGÂNICO

**Sempre planeje os dois eixos — mesmo sem orçamento confirmado:**
- PAGO: Meta Ads, Google Ads, TikTok Ads — capture leads frios, retargeting de visitantes
- ORGÂNICO: Reels/TikTok para topo de funil, WhatsApp VIP para base quente, e-mail para nutrição

**Sinergia pago + orgânico:**
- Orgânico cria prova social → pago amplifica com boosting dos posts mais engajados
- Lista orgânica (e-mail/WhatsApp) → semente para Lookalike no Meta (melhor qualidade)
- Conteúdo orgânico de autoridade → remarketing pago para quem assistiu 50%+ do vídeo
- Google Search captura intenção ativa → Reels/TikTok criam demanda passiva

## GEOLOCALIZAÇÃO PARA NEGÓCIOS FÍSICOS (ACADEMIAS, STUDIOS, CLÍNICAS)

**Quando o produto tem componente físico/local, use raio geográfico:**
- Meta: "Pessoas que vivem ou frequentam recentemente" + raio de 3-15km de cada unidade
- Google: raio de localização por CEP/cidade de cada unidade física
- Segmento VIP: raio de 5km de academias concorrentes (meta: captação lateral)
- Excluir: pessoas que vivem fora do raio de atendimento (evita leads inválidos)

**Estratégia para academias e fitness:**
- Interesses: fitness, musculação, emagrecimento, crossfit, yoga, nutrição esportiva
- Comportamentos: compradores de suplementos, ativos em apps fitness, uso de rastreador
- Geolocalização: bairros específicos + raio das unidades + cidades da região
- Público-alvo local: 500m a 5km de cada unidade física (criar conjunto separado por unidade)
- Segmentos de renda: médio-alto para academias premium, médio para academias populares

## FILOSOFIA DE TARGETING

**O maior erro de targeting:** públicos muito pequenos ou muito amplos.
- Muito pequeno (<50k): frequência sobe rápido, CPL sobe
- Muito amplo (>5M): sem relevância, CTR baixo, CPL alto
- Sweet spot para lançamentos: 500k - 2M por público no Meta
- Para negócios locais: 20k-200k é aceitável por praça

**A hierarquia de qualidade de audiência:**
1. Lookalike 1% de compradores → melhor qualidade
2. Lookalike 1% de lista engajada → ótima qualidade  
3. Custom audience (site, vídeo, engajamento) → retargeting
4. Geolocalização por raio + interesses → boa qualidade para negócios locais
5. Interesses específicos e nichados → boa qualidade
6. Comportamentos de compra → boa qualidade
7. Interesses amplos → teste apenas
8. Broad (sem targeting) → só com pixel maduro

**Regras de exclusão sempre ativas:**
- Excluir compradores de TODOS os públicos de topo de funil
- Excluir quem já está na lista de e-mail dos públicos de captura
- Excluir públicos em teste uns dos outros para não contaminar dados

**UTM é obrigatório:**
Cada conjunto de anúncio tem UTM único. Sem UTM não tem atribuição. Sem atribuição não tem otimização.

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "pixelSetupInstructions": {
    "meta": {
      "events": ["string — evento do pixel a configurar (ex: Lead, Purchase, ViewContent)"],
      "customConversions": ["string — conversão customizada a criar"],
      "setupNotes": "string — instruções de configuração do pixel Meta"
    },
    "google": {
      "tags": ["string — tag a instalar"],
      "conversions": ["string — conversão a criar no Google Ads"],
      "setupNotes": "string"
    },
    "tiktok": {
      "events": ["string"],
      "setupNotes": "string"
    }
  },
  "metaAudiences": [
    {
      "audienceId": "string — slug único",
      "name": "string — nome para usar no Meta",
      "type": "interest|custom|lookalike|broad|retargeting",
      "size": "string — tamanho estimado",
      "interests": ["string — interesse exato como aparece no Meta"],
      "behaviors": ["string ou null"],
      "demographics": {
        "ageMin": 25,
        "ageMax": 55,
        "genders": ["all"],
        "locations": ["Brazil"]
      },
      "exclusions": ["string — o que excluir deste público"],
      "lookalikeSeed": "string ou null — qual lista usar como semente",
      "lookalikeSimilarity": "string ou null — ex: 1%, 2%, 5%",
      "customAudienceSource": "string ou null",
      "phase": "string",
      "priority": "primary|secondary|test",
      "estimatedCPL": 0,
      "notes": "string"
    }
  ],
  "googleAudiences": [
    {
      "audienceId": "string",
      "name": "string",
      "type": "in_market|affinity|custom_intent|remarketing|similar|customer_match",
      "description": "string",
      "keywords": ["string ou null"],
      "urls": ["string ou null"],
      "apps": ["string ou null"],
      "phase": "string",
      "priority": "primary|secondary|test",
      "notes": "string"
    }
  ],
  "tiktokAudiences": [
    {
      "audienceId": "string",
      "name": "string",
      "type": "interest|behavior|custom|lookalike|broad",
      "interests": ["string"],
      "behaviors": ["string"],
      "demographics": { "ageMin": 18, "ageMax": 55, "genders": ["all"] },
      "customAudienceSource": "string ou null",
      "phase": "string",
      "priority": "primary|secondary|test",
      "notes": "string"
    }
  ],
  "audienceExclusions": [
    {
      "platform": "string",
      "audience": "string",
      "reason": "string"
    }
  ],
  "customAudiencesToBuild": [
    {
      "name": "string",
      "platform": "string",
      "source": "string — de onde vem essa audiência",
      "instructions": "string — como criar passo a passo",
      "buildNow": true
    }
  ],
  "audienceTestingMatrix": [
    {
      "phase": "string",
      "winner": "string — audiência hipótese de vencedora",
      "testAudiences": ["string"],
      "successMetric": "string"
    }
  ],
  "utmStructure": {
    "source": "string — ex: facebook, google, tiktok",
    "medium": "string — ex: cpc, paid_social",
    "campaign": "string — padrão de nomenclatura da campanha",
    "adset": "string — padrão de nomenclatura do conjunto",
    "ad": "string — padrão de nomenclatura do anúncio",
    "examples": ["string — exemplo real de UTM completo"]
  },
  "targetingNotes": "string — observações estratégicas sobre o targeting"
}
\`\`\``;

export async function runTargetingAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<TargetingOutput> {
  const segmentsContext = profile?.segments.length
    ? profile.segments.map((s: AudienceSegment) =>
        `- [${s.priority.toUpperCase()}] ${s.name}: ${s.messageAngle} | Canais: ${s.bestChannels.join(", ")} | CPL: R$${s.estimatedCPL}`
      ).join("\n")
    : "segmentos não definidos";

  const avatarContext = profile
    ? `
Avatar: ${profile.primaryAvatar?.name ?? "Avatar principal"}, ${profile.primaryAvatar?.age ?? ""}
Localização: ${profile.primaryAvatar?.location ?? ""}
Renda: ${profile.primaryAvatar?.income ?? ""}
Ocupação: ${profile.primaryAvatar?.occupation ?? ""}
Onde está online: ${(profile.primaryAvatar?.whereTheyHangOut ?? []).join(", ")}
Conteúdo que consome: ${(profile.primaryAvatar?.contentTheyConsume ?? []).join(", ")}
Comportamentos de compra: ${(profile.primaryAvatar?.buyingTriggers ?? []).slice(0, 3).join("; ")}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "targeting",
    systemPrompt: COGNITIVE_IDENTITY_TARGETING + TARGETING_PROMPT,
    skipAllStaticLayers: true,
    messages: [
      {
        role: "user",
        content: `Configure a estratégia HÍBRIDA (pago + orgânico) e todas as audiências para a campanha — Meta, Google e TikTok.

**Produto:** ${String(intakeData["product.name"] ?? "")} — categoria: ${String(intakeData["product.category"] ?? "")}
**Budget de tráfego pago:** R$${String(intakeData["campaign.budget.traffic"] ?? intakeData["campaign.trafficBudget"] ?? 0)}
**Localização principal:** ${String(intakeData["audience.location"] ?? "brazil_nationwide")}
**Tem negócio físico/local (academia, studio, clínica)?** ${String(intakeData["business.hasPhysicalLocation"] ?? intakeData["product.category"] ?? "").toLowerCase().includes("academi") || String(intakeData["product.category"] ?? "").toLowerCase().includes("fitness") ? "SIM — use geolocalização por raio" : "verificar perfil"}
**Possui endereços físicos:** ${String(intakeData["business.locations"] ?? intakeData["audience.city"] ?? "verificar dados do produto")}
${avatarContext}

**Segmentos de audiência:**
${segmentsContext}

**Nível de sofisticação da audiência:** ${String(intakeData["audience.sophisticationLevel"] ?? "solution_aware")}
**Concorrência no mercado:** ${profile?.marketIntelligence?.competitionLevel ?? "medium"}

**Diretrizes adicionais do usuário:**
${JSON.stringify((intakeData["user_directives"] as Record<string, string> | undefined) ?? {}, null, 2)}

**ENTREGÁVEIS NECESSÁRIOS:**
- Mínimo 8 públicos no Meta (2 frios por interesses, 2 lookalike, 2 retargeting, 2 geolocalização por raio se negócio local)
- Mínimo 3 públicos no Google (search intent + display + remarketing)
- Mínimo 3 públicos no TikTok
- Configuração completa de pixel para cada plataforma
- Estrutura de UTM padronizada
- Lista de exclusões obrigatórias
- Plano de sinergia: como o orgânico alimenta o pago (Lookalike seeds, boosting de Reels, etc.)
- Se produto fitness/academia: OBRIGATÓRIO incluir pelo menos 2 públicos com raio geográfico de 3-10km

Retorne APENAS o JSON de configuração de audiências.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Mapeando avatar para interesses e comportamentos no Meta...",
      "Estruturando públicos frios, lookalike e retargeting...",
      "Configurando audiências no Google por intenção...",
      "Criando targeting nativo para TikTok...",
      "Definindo exclusões e proteção de audiências...",
      "Estruturando UTMs e atribuição...",
    ],
  });

  return parseAgentJSON<TargetingOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    pixelSetupInstructions: {
      meta: { events: [], customConversions: [], setupNotes: "" },
      google: { tags: [], conversions: [], setupNotes: "" },
      tiktok: { events: [], setupNotes: "" },
    },
    metaAudiences: [],
    googleAudiences: [],
    tiktokAudiences: [],
    audienceExclusions: [],
    customAudiencesToBuild: [],
    audienceTestingMatrix: [],
    utmStructure: { source: "", medium: "", campaign: "", adset: "", ad: "", examples: [] },
    targetingNotes: result.content,
  });
}
