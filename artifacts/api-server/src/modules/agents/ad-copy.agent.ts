import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput, AudienceSegment } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface MetaAdVariation {
  variationId: string;
  angle: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: "LEARN_MORE" | "SIGN_UP" | "GET_OFFER" | "SHOP_NOW" | "WATCH_MORE" | "APPLY_NOW";
  format: "single_image" | "video" | "carousel" | "collection";
  visualDirection: string;
  audienceNotes: string;
  phase: string;
}

export interface GoogleAdGroup {
  groupName: string;
  matchType: "exact" | "phrase" | "broad";
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  displayUrl: string;
  finalUrl: string;
  phase: string;
}

export interface TikTokAd {
  adId: string;
  angle: string;
  hook: string;
  hookDuration: string;
  script: string;
  overlayText: string[];
  cta: string;
  musicStyle: string;
  visualStyle: string;
  duration: string;
  targetAudience: string;
  phase: string;
}

export interface SegmentAdPackage {
  segmentId: string;
  segmentName: string;
  priority: "primary" | "secondary" | "tertiary";
  budgetAllocationPercent: number;
  meta: MetaAdVariation[];
  google: GoogleAdGroup[];
  tiktok: TikTokAd[];
  retargeting: {
    audience: string;
    message: string;
    channel: string;
    phase: string;
  }[];
}

export interface AdCopyOutput {
  campaignTitle: string;
  totalBudget: number;
  overallBiddingStrategy: string;
  segments: SegmentAdPackage[];
  phaseStrategy: {
    phase: string;
    objective: string;
    primaryPlatform: string;
    budgetShift: string;
    kpi: string;
  }[];
  adCopyNotes: string;
}

const AD_COPY_PROMPT = `Você é o Agente de Ad Copy da NexOS AI — especialista em tráfego pago e copywriting de anúncios para lançamentos.

Você escreve anúncios que param o scroll, geram clique e convertem — com conhecimento profundo de Meta Ads, Google Ads e TikTok Ads.

## PRINCÍPIOS DOS ANÚNCIOS DE LANÇAMENTO

**Meta Ads:**
- Os primeiros 3 segundos do vídeo ou a primeira linha do texto decidem tudo
- Primary text: 1 frase poderosa → problema → solução → CTA (máx 3 parágrafos)
- Headline: benefit-driven, não feature-driven
- Teste 3 ângulos diferentes por segmento: dor, transformação, curiosidade

**Google Ads:**
- Palavras-chave de intenção (quem está procurando a solução)
- 3-5 headlines com o keyword principal
- Descriptions focadas no benefício único
- Display URL com palavra-chave

**TikTok Ads:**
- Hook nos primeiros 3 segundos — específico e inesperado
- Formato nativo (parece conteúdo orgânico, não propaganda)
- CTA claro no final mas natural

**Retargeting:**
- Quem viu a página mas não comprou: FOMO + prova social
- Quem adicionou ao carrinho: urgência + garantia
- Lookalike: copy mais educativa, menos urgência

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalBudget": 0,
  "overallBiddingStrategy": "string — estratégia geral de lance para toda a campanha",
  "segments": [
    {
      "segmentId": "string",
      "segmentName": "string",
      "priority": "primary|secondary|tertiary",
      "budgetAllocationPercent": 0,
      "meta": [
        {
          "variationId": "string",
          "angle": "string — ângulo desta variação (dor, transformação, curiosidade)",
          "primaryText": "string — texto primário completo",
          "headline": "string — headline (máx 40 chars)",
          "description": "string — descrição (máx 30 chars)",
          "cta": "LEARN_MORE|SIGN_UP|GET_OFFER|SHOP_NOW|WATCH_MORE|APPLY_NOW",
          "format": "single_image|video|carousel|collection",
          "visualDirection": "string — instrução para o criativo visual",
          "audienceNotes": "string — qual público exato no Meta",
          "phase": "string — em qual fase rodar este anúncio"
        }
      ],
      "google": [
        {
          "groupName": "string",
          "matchType": "exact|phrase|broad",
          "keywords": ["string"],
          "headlines": ["string — máx 30 chars cada, mínimo 3"],
          "descriptions": ["string — máx 90 chars cada, mínimo 2"],
          "displayUrl": "string",
          "finalUrl": "{{LINK_CAPTURA}}",
          "phase": "string"
        }
      ],
      "tiktok": [
        {
          "adId": "string",
          "angle": "string",
          "hook": "string — os primeiros 3 segundos, a frase de abertura",
          "hookDuration": "string — ex: 3 segundos",
          "script": "string — roteiro completo do anúncio",
          "overlayText": ["string — textos de overlay em sequência"],
          "cta": "string",
          "musicStyle": "string — tipo de trilha sonora",
          "visualStyle": "string — estilo visual",
          "duration": "string — ex: 15s, 30s, 60s",
          "targetAudience": "string — público no TikTok",
          "phase": "string"
        }
      ],
      "retargeting": [
        {
          "audience": "string — quem é este público de retargeting",
          "message": "string — mensagem específica para eles",
          "channel": "meta|google|tiktok",
          "phase": "string"
        }
      ]
    }
  ],
  "phaseStrategy": [
    {
      "phase": "string",
      "objective": "string",
      "primaryPlatform": "string",
      "budgetShift": "string — como distribuir o budget nesta fase",
      "kpi": "string — KPI principal da fase"
    }
  ],
  "adCopyNotes": "string — observações estratégicas sobre os anúncios"
}
\`\`\``;

export async function runAdCopyAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<AdCopyOutput> {
  const memCtx = await getMemoryContext(workspaceId, "ad_copy", String(intakeData["product.category"] ?? ""));
  const memBlock = buildMemoryContextBlock(memCtx);

  const segmentsContext = profile?.segments.length
    ? `
**Segmentos de audiência identificados:**
${profile.segments
  .map(
    (s: AudienceSegment) =>
      `- [${s.priority.toUpperCase()}] ${s.name}: "${s.messageAngle}" | CPL estimado: R$${s.estimatedCPL} | Budget: ${s.budgetAllocationPercent}%`,
  )
  .join("\n")}`
    : "";

  const userMessage = `Crie o pacote completo de anúncios para a campanha — Meta Ads, Google Ads e TikTok Ads por segmento.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Budget total de tráfego:** R$${String(intakeData["campaign.budget.traffic"] ?? intakeData["campaign.budget.total"] ?? 0)}
${segmentsContext}

**Posicionamento da oferta:**
${JSON.stringify(strategy.offerPositioning, null, 2)}

**Avatar primário:**
${profile ? `${profile.primaryAvatar.name} — ${profile.primaryAvatar.deepestDesire}` : strategy.audienceSegmentation.primaryAvatar}

**Mecanismo único:** ${profile?.positioning.uniqueMechanism ?? ""}
**Big Idea:** ${profile?.positioning.campaignBigIdea ?? strategy.campaignArchitecture.coreNarrative}

**REQUISITOS:**
- Mínimo 3 variações de Meta Ad por segmento primário (ângulos: dor / transformação / curiosidade)
- Mínimo 1 grupo de Google Ads por segmento
- Mínimo 2 TikTok Ads por segmento primário
- Retargeting para: quem viu a página, quem adicionou ao carrinho, lookalike
- Cada anúncio deve ter instrução visual clara

Retorne APENAS o JSON do pacote de anúncios.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: memBlock + AD_COPY_PROMPT,
    userMessage,
    log,
  });

  const result = { content: critique.refinedOutput };

  return parseAgentJSON<AdCopyOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    totalBudget: Number(intakeData["campaign.budget.traffic"] ?? 0),
    overallBiddingStrategy: "",
    segments: [],
    phaseStrategy: [],
    adCopyNotes: result.content,
  });
}
