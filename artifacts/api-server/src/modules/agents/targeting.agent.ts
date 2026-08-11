import { runAgent, parseAgentJSON, locationToCountryLabel } from "./agent.runner.js";
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

// ─── Shared context builder ──────────────────────────────────────────────────

function buildCampaignContext(
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
): string {
  const segmentsContext = profile?.segments.length
    ? profile.segments.map((s: AudienceSegment) =>
        `- [${s.priority.toUpperCase()}] ${s.name}: ${s.messageAngle} | Canais: ${s.bestChannels.join(", ")} | CPL: R$${s.estimatedCPL}`
      ).join("\n")
    : "segmentos não definidos";

  const avatarContext = profile
    ? `Avatar: ${profile.primaryAvatar?.name ?? "Avatar principal"}, ${profile.primaryAvatar?.age ?? ""}
Localização: ${profile.primaryAvatar?.location ?? ""}
Renda: ${profile.primaryAvatar?.income ?? ""}
Ocupação: ${profile.primaryAvatar?.occupation ?? ""}
Onde está online: ${(profile.primaryAvatar?.whereTheyHangOut ?? []).join(", ")}
Conteúdo que consome: ${(profile.primaryAvatar?.contentTheyConsume ?? []).join(", ")}
Comportamentos de compra: ${(profile.primaryAvatar?.buyingTriggers ?? []).slice(0, 3).join("; ")}`
    : "";

  const isLocal = String(intakeData["product.category"] ?? "").toLowerCase().includes("academi")
    || String(intakeData["product.category"] ?? "").toLowerCase().includes("fitness")
    || String(intakeData["business.hasPhysicalLocation"] ?? "").toLowerCase() === "true";

  const locationSlug = String(intakeData["audience.location"] ?? "brazil_nationwide");
  const countryLabel = locationToCountryLabel(locationSlug);

  return `**Produto:** ${String(intakeData["product.name"] ?? "")} — categoria: ${String(intakeData["product.category"] ?? "")}
**Budget de tráfego pago:** ${String(intakeData["campaign.budget.traffic"] ?? intakeData["campaign.trafficBudget"] ?? 0)}
**Localização principal:** ${countryLabel} (código: ${locationSlug})
**Negócio físico/local:** ${isLocal ? "SIM — use geolocalização por raio" : "NÃO"}
**Endereços físicos:** ${String(intakeData["business.locations"] ?? intakeData["business.physicalCities"] ?? intakeData["audience.city"] ?? "")}
**Nível de sofisticação:** ${String(intakeData["audience.sophisticationLevel"] ?? "solution_aware")}
**Concorrência:** ${profile?.marketIntelligence?.competitionLevel ?? "medium"}
${avatarContext}

**Segmentos de audiência:**
${segmentsContext}`;
}

// ─── Chunk 1: Meta audiences ─────────────────────────────────────────────────

interface MetaChunk {
  pixelSetupMeta: { events: string[]; customConversions: string[]; setupNotes: string };
  metaAudiences: MetaAudience[];
}

const META_CHUNK_PROMPT = `Você é o Agente de Targeting da NexOS AI — especialista em Meta Ads (Facebook e Instagram).

## REGRAS OBRIGATÓRIAS
- Mínimo 8 públicos: 2 frios (interesses), 2 lookalike, 2 retargeting, 2 geolocalização (se negócio local)
- Sweet spot: 500k–2M por público; para negócios locais: 20k–200k por praça
- Excluir compradores de todos os públicos de topo de funil
- Negócio físico/academia: OBRIGATÓRIO pelo menos 2 públicos com raio geográfico de 3–10km

**Retorne APENAS JSON válido:**
\`\`\`json
{
  "pixelSetupMeta": {
    "events": ["Lead", "Purchase", "ViewContent"],
    "customConversions": ["string"],
    "setupNotes": "string"
  },
  "metaAudiences": [
    {
      "audienceId": "string",
      "name": "string",
      "type": "interest|custom|lookalike|broad|retargeting",
      "size": "string",
      "interests": ["string"],
      "behaviors": ["string"],
      "demographics": { "ageMin": 25, "ageMax": 55, "genders": ["all"], "locations": ["<país real da campanha — use a Localização principal informada acima>"] },
      "exclusions": ["string"],
      "lookalikeSeed": "string ou null",
      "lookalikeSimilarity": "string ou null",
      "customAudienceSource": "string ou null",
      "phase": "string",
      "priority": "primary|secondary|test",
      "estimatedCPL": 0,
      "notes": "string"
    }
  ]
}
\`\`\``;

async function runMetaChunk(
  campaignId: string,
  workspaceId: string,
  ctx: string,
  log: Logger,
): Promise<MetaChunk> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "targeting",
    systemPrompt: COGNITIVE_IDENTITY_TARGETING + META_CHUNK_PROMPT,
    skipAllStaticLayers: true,
    messages: [
      {
        role: "user",
        content: `Configure as audiências do META ADS para esta campanha.\n\n${ctx}\n\nRetorne APENAS o JSON de audiências Meta.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: ["Mapeando interesses e comportamentos no Meta...", "Configurando públicos frios, lookalike e retargeting..."],
  });

  return parseAgentJSON<MetaChunk>(result.content, {
    pixelSetupMeta: { events: [], customConversions: [], setupNotes: "" },
    metaAudiences: [],
  });
}

// ─── Chunk 2: Google audiences ────────────────────────────────────────────────

interface GoogleChunk {
  pixelSetupGoogle: { tags: string[]; conversions: string[]; setupNotes: string };
  googleAudiences: GoogleAudience[];
}

const GOOGLE_CHUNK_PROMPT = `Você é o Agente de Targeting da NexOS AI — especialista em Google Ads.

## REGRAS OBRIGATÓRIAS
- Mínimo 3 públicos: search intent + display + remarketing
- Usar palavras-chave de intenção de compra (não informacionais)
- Custom Intent: combinar termos do produto + concorrentes diretos

**Retorne APENAS JSON válido:**
\`\`\`json
{
  "pixelSetupGoogle": {
    "tags": ["string"],
    "conversions": ["string"],
    "setupNotes": "string"
  },
  "googleAudiences": [
    {
      "audienceId": "string",
      "name": "string",
      "type": "in_market|affinity|custom_intent|remarketing|similar|customer_match",
      "description": "string",
      "keywords": ["string"],
      "urls": ["string"],
      "apps": ["string"],
      "phase": "string",
      "priority": "primary|secondary|test",
      "notes": "string"
    }
  ]
}
\`\`\``;

async function runGoogleChunk(
  campaignId: string,
  workspaceId: string,
  ctx: string,
  log: Logger,
): Promise<GoogleChunk> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "targeting",
    systemPrompt: COGNITIVE_IDENTITY_TARGETING + GOOGLE_CHUNK_PROMPT,
    skipAllStaticLayers: true,
    messages: [
      {
        role: "user",
        content: `Configure as audiências do GOOGLE ADS para esta campanha.\n\n${ctx}\n\nRetorne APENAS o JSON de audiências Google.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: ["Configurando audiências de intenção no Google...", "Estruturando remarketing e in-market audiences..."],
  });

  return parseAgentJSON<GoogleChunk>(result.content, {
    pixelSetupGoogle: { tags: [], conversions: [], setupNotes: "" },
    googleAudiences: [],
  });
}

// ─── Chunk 3: TikTok + UTMs + testing matrix + notes ─────────────────────────

interface TikTokUtmChunk {
  pixelSetupTikTok: { events: string[]; setupNotes: string };
  tiktokAudiences: TikTokAudience[];
  audienceExclusions: { platform: string; audience: string; reason: string }[];
  customAudiencesToBuild: { name: string; platform: string; source: string; instructions: string; buildNow: boolean }[];
  audienceTestingMatrix: { phase: string; winner: string; testAudiences: string[]; successMetric: string }[];
  utmStructure: { source: string; medium: string; campaign: string; adset: string; ad: string; examples: string[] };
  targetingNotes: string;
}

const TIKTOK_UTM_CHUNK_PROMPT = `Você é o Agente de Targeting da NexOS AI — especialista em TikTok Ads, UTMs e estratégia de exclusão.

## REGRAS OBRIGATÓRIAS
- Mínimo 3 públicos TikTok
- UTM obrigatório para cada conjunto — sem UTM não há atribuição
- Exclusões: sempre excluir compradores dos públicos de topo

**Retorne APENAS JSON válido:**
\`\`\`json
{
  "pixelSetupTikTok": {
    "events": ["string"],
    "setupNotes": "string"
  },
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
    { "platform": "string", "audience": "string", "reason": "string" }
  ],
  "customAudiencesToBuild": [
    { "name": "string", "platform": "string", "source": "string", "instructions": "string", "buildNow": true }
  ],
  "audienceTestingMatrix": [
    { "phase": "string", "winner": "string", "testAudiences": ["string"], "successMetric": "string" }
  ],
  "utmStructure": {
    "source": "string",
    "medium": "string",
    "campaign": "string",
    "adset": "string",
    "ad": "string",
    "examples": ["string — exemplo real de UTM completo"]
  },
  "targetingNotes": "string — observações estratégicas"
}
\`\`\``;

async function runTikTokUtmChunk(
  campaignId: string,
  workspaceId: string,
  ctx: string,
  log: Logger,
): Promise<TikTokUtmChunk> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "targeting",
    systemPrompt: COGNITIVE_IDENTITY_TARGETING + TIKTOK_UTM_CHUNK_PROMPT,
    skipAllStaticLayers: true,
    messages: [
      {
        role: "user",
        content: `Configure as audiências do TIKTOK ADS, exclusões, audiências customizadas, matriz de testes e estrutura de UTMs para esta campanha.\n\n${ctx}\n\nRetorne APENAS o JSON completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: ["Criando targeting nativo para TikTok...", "Definindo exclusões e UTMs..."],
  });

  return parseAgentJSON<TikTokUtmChunk>(result.content, {
    pixelSetupTikTok: { events: [], setupNotes: "" },
    tiktokAudiences: [],
    audienceExclusions: [],
    customAudiencesToBuild: [],
    audienceTestingMatrix: [],
    utmStructure: { source: "", medium: "", campaign: "", adset: "", ad: "", examples: [] },
    targetingNotes: "",
  });
}

// ─── Main runner (3 focused calls, context renewed each time) ─────────────────

export async function runTargetingAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<TargetingOutput> {
  const ctx = buildCampaignContext(intakeData, profile);
  const campaignTitle = String(intakeData["product.name"] ?? "");

  log.info({ campaignId }, "targeting: starting chunked delivery (Meta → Google → TikTok+UTMs)");

  // Each call is independent — fresh context, focused output, no shared token budget.
  const [metaChunk, googleChunk, tiktokChunk] = await Promise.all([
    runMetaChunk(campaignId, workspaceId, ctx, log),
    runGoogleChunk(campaignId, workspaceId, ctx, log),
    runTikTokUtmChunk(campaignId, workspaceId, ctx, log),
  ]);

  log.info(
    {
      campaignId,
      metaCount: metaChunk.metaAudiences.length,
      googleCount: googleChunk.googleAudiences.length,
      tiktokCount: tiktokChunk.tiktokAudiences.length,
    },
    "targeting: all chunks delivered — merging",
  );

  return {
    campaignTitle,
    pixelSetupInstructions: {
      meta: metaChunk.pixelSetupMeta,
      google: googleChunk.pixelSetupGoogle,
      tiktok: tiktokChunk.pixelSetupTikTok,
    },
    metaAudiences: metaChunk.metaAudiences,
    googleAudiences: googleChunk.googleAudiences,
    tiktokAudiences: tiktokChunk.tiktokAudiences,
    audienceExclusions: tiktokChunk.audienceExclusions,
    customAudiencesToBuild: tiktokChunk.customAudiencesToBuild,
    audienceTestingMatrix: tiktokChunk.audienceTestingMatrix,
    utmStructure: tiktokChunk.utmStructure,
    targetingNotes: tiktokChunk.targetingNotes,
  };
}
