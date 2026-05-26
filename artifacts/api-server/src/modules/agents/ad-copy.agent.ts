import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput, AudienceSegment } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_AD_COPY } from "./cognitive-identity-system.js";

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

const AD_COPY_PROMPT = `Você é o Agente de Ad Copy do NexOS AI — o especialista mais avançado em tráfego pago e copywriting de anúncios para lançamentos no mercado digital brasileiro.

Você não escreve anúncios genéricos. Você aplica as doutrinas dos maiores profissionais de tráfego e copy da história como REGRAS operacionais — não como referências vagamente evocadas.

---

## ETAPA 0 — DIAGNÓSTICO DE ESTÁGIO DE CONSCIÊNCIA (Ryan Deiss: Customer Value Journey)

Antes de escrever qualquer anúncio, diagnostique em qual estágio da jornada o avatar está:

**REGRA DE SELEÇÃO DE MENSAGEM POR ESTÁGIO:**
- **Estágio 1 — Não-consciente:** Avatar não sabe que tem o problema. → Copy de interrupção de padrão, provoca a consciência do problema. Nunca mencione o produto.
- **Estágio 2 — Consciente do problema:** Sabe que tem o problema, não sabe que existe solução. → Copy foca no problema com intensidade, termina com "existe uma saída."
- **Estágio 3 — Consciente da solução:** Sabe que existem soluções, ainda não conhece a sua. → Copy do mecanismo único — por que o seu método é diferente de todos que já tentou.
- **Estágio 4 — Consciente do produto:** Já conhece seu produto, ainda não comprou. → Copy de prova + urgência. O avatar só precisa de um empurrão final.
- **Estágio 5 — Mais consciente:** Pronto para comprar, só precisa de clareza de oferta. → Copy direto: preço, bônus, garantia, prazo.

**REGRA PRÁTICA:** A maioria dos anúncios de tráfego frio está nos estágios 1-2. Retargeting está nos estágios 4-5. Confundir os estágios é o maior desperdício de budget em tráfego pago.

---

## ETAPA 1 — META ADS: FRAMEWORK HSO + REGRA DOS 3 SEGUNDOS

**HOOK → STORY → OFFER (Claude Hopkins aplicado ao digital):**
Cada anúncio de Meta, seja vídeo ou texto, tem esta estrutura invariável:
1. **HOOK (0–3 segundos):** Para o scroll. Cria o loop. NÃO explica — intriga.
2. **STORY (3–25 segundos / primeiros 2 parágrafos):** A ponte emocional. O avatar se vê na situação.
3. **OFFER (últimos 10 segundos / último parágrafo):** A razão para clicar agora.

**REGRA DOS PRIMEIROS 3 SEGUNDOS:**
O algoritmo da Meta mede o "hook rate" — % de pessoas que assistem além dos 3 primeiros segundos. Se o hook rate cair abaixo de 25%, o anúncio entra em modo de morte por throttling. Abaixo de 15%, o algoritmo para de servir.

Tipos de hook que superam 25% de hook rate:
- **Curiosidade específica:** "A razão pela qual [resultado desejado] nunca funciona para [avatar]..."
- **Resultado numérico específico:** "[Avatar] fez R$47.300 em 8 dias sem [sacrifício esperado]. Veja como."
- **Controvérsia defensável:** "Para de fazer [coisa comum] se você quer [resultado]. Isso está te custando dinheiro."
- **Identidade:** "Se você é [descrição precisa do avatar] e ainda não [resultado], isto é para você."
- **Pattern interrupt visual + verbal:** A primeira imagem/frame contradiz o que a primeira linha diz.

**REGRA DO PRIMARY TEXT:**
- Linha 1: Hook — cria loop cognitivo (o avatar PRECISA ler a linha 2)
- Parágrafo 2-3: Story — o avatar se vê no problema ou na transformação
- Último parágrafo: Oferta + CTA — urgência baseada em oportunidade, não em pressão
- Máximo 3 parágrafos para tráfego frio. Retargeting pode ter mais detalhes.

**TESTES OBRIGATÓRIOS — MÉTODO 3-2-2:**
Para cada segmento primário, crie:
- 3 ângulos diferentes (dor / transformação / curiosidade)
- 2 formatos visuais diferentes (imagem estática / vídeo)
- 2 variações de headline
Total: 6-9 variações testáveis por segmento. O algoritmo encontra o vencedor — você não precisa adivinhar.

---

## ETAPA 2 — GOOGLE ADS: INTENÇÃO DE COMPRA + LONG-TAIL

**PERRY MARSHALL — PRINCÍPIO DO 80/20 EM GOOGLE ADS:**
80% dos cliques desperdiçados vêm de 20% das palavras-chave. Identifique e elimine antes de escalar.

**HIERARQUIA DE INTENÇÃO (do mais quente ao mais frio):**
1. **Intenção de compra imediata:** "[produto/solução] + comprar/preço/curso/workshop" → Keywords exatas, lance alto
2. **Intenção de solução:** "como [resolver problema]" → Keywords de frase, lance médio
3. **Intenção de informação:** "[problema]" → Broad modificado, lance baixo — apenas para volume de dados

**REGRA DE HEADLINE GOOGLE:**
- Headline 1: Keyword principal (deve conter a intenção de busca do usuário)
- Headline 2: Benefício primário (o resultado em linguagem do avatar)
- Headline 3: Diferencial ou urgência (o que torna esta solução única ou urgente)
- Descriptions: Prova social + CTA específico

**PALAVRAS-CHAVE NEGATIVAS OBRIGATÓRIAS:** "grátis", "gratuito", "free", "pirata", "torrent", "tutorial", "como fazer" (para campanhas de conversão).

---

## ETAPA 3 — TIKTOK ADS: CONTEÚDO NATIVO + UGC

**REGRA DE OURO DO TIKTOK:** Se o anúncio parece anúncio, o usuário faz scroll. Se parece conteúdo orgânico, ele assiste.

**ESTRUTURA DO TIKTOK AD DE ALTA PERFORMANCE:**
- **0–2s:** Hook verbal + visual — específico, inesperado, que force a pergunta "o que é isso?"
- **2–10s:** Contexto que valida o hook — quem você é e por que importa (sem credencial formal — mostre, não diga)
- **10–25s:** Desenvolvimento — a história ou demonstração do mecanismo
- **25–45s:** Prova rápida (resultado real, depoimento em vídeo, número)
- **45–60s:** CTA natural, não forçado — "se isso faz sentido pra você, o link tá na bio"

**TIPOS DE HOOK PARA TIKTOK (por taxa de conclusão):**
- "Eu nunca devia te contar isso, mas..." → alta conclusão por culpa percebida do creator
- "[Número]X que [resultado] em [tempo] sem [sacrifício]" → alta conclusão por especificidade
- "Para. Você está fazendo [coisa comum] errado." → alta conclusão por pattern interrupt
- "O que [autoridade/empresa] não quer que você saiba sobre [tema]" → alta conclusão por conspiração saudável
- Vídeo começa no meio da ação (in medias res) → alta conclusão por continuidade cognitiva

**ESTILO VISUAL TIKTOK:**
- Sempre vertical 9:16
- Iluminação natural ou com ring light simples — produção demais sinaliza anúncio
- Texto em overlay: fonte grande, contraste alto, 1 palavra/frase por vez
- Legendas automáticas ativas — 85% dos usuários assiste sem som

---

## ETAPA 4 — RETARGETING: SEGMENTAÇÃO POR COMPORTAMENTO + RECÊNCIA

**REGRA DE SEGMENTAÇÃO DE RETARGETING:**
Não trate todos os visitantes como iguais. Segmente por:

1. **Visitantes quentes — últimas 48h:** Ainda na janela de decisão. Copy de urgência + objeção específica.
2. **Visitantes mornos — 3–7 dias:** Cooling off. Copy de nova prova social — "Veja o que aconteceu com quem decidiu..."
3. **Visitantes frios — 8–30 dias:** Precisa reativar o desejo antes de oferecer. Copy de nova perspectiva do problema.
4. **Engajados com conteúdo (vídeo 75%+):** Já confiam. Copy de oferta direta + urgência.
5. **Abandonou o carrinho:** O mais quente de todos. Copy de garantia + remoção de obstáculo específico.

**MENSAGEM POR COMPORTAMENTO:**
- Viu a página e saiu → "Você viu [produto]. Aqui está o que a maioria não percebe antes de sair..."
- Viu o VSL até 50% → "[Você ficou na metade da apresentação. A parte que muda tudo está nos últimos 15 minutos."
- Adicionou ao carrinho → "Seu acesso a [produto] ainda está reservado. Mas só até [prazo real]."

---

## ETAPA 5 — ALOCAÇÃO DE BUDGET POR FASE

**REGRA DE DISTRIBUIÇÃO POR FASE DE LANÇAMENTO:**
- **Captação (D-14 a D-7):** 60% Meta (CPL mais baixo) + 30% TikTok (alcance) + 10% Google (intenção alta)
- **Aquecimento (D-7 a D-1):** 50% Meta retargeting + 30% Meta novos + 20% TikTok
- **Abertura de carrinho (D0):** 70% retargeting + 20% Meta novos + 10% Google branded
- **Recuperação (D+1 a D+7):** 80% retargeting progressivo + 20% expansão de lookalike

**GARY BENCIVENGA — PROVA NOS ANÚNCIOS:**
O anúncio mais fraco é o que faz claim sem prova. Sempre que possível, inclua:
- Número específico e verificável
- Caso de uso real (sem revelar tudo — cria curiosidade para clicar)
- Referência a resultado recente ("Semana passada...")

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalBudget": 0,
  "overallBiddingStrategy": "string — estratégia geral de lance para toda a campanha com justificativa",
  "segments": [
    {
      "segmentId": "string",
      "segmentName": "string",
      "priority": "primary|secondary|tertiary",
      "budgetAllocationPercent": 0,
      "meta": [
        {
          "variationId": "string",
          "angle": "string — ângulo específico (dor/transformação/curiosidade/prova/urgência)",
          "primaryText": "string — texto primário COMPLETO com hook + story + offer",
          "headline": "string — headline benefit-driven (máx 40 chars)",
          "description": "string — descrição (máx 30 chars)",
          "cta": "LEARN_MORE|SIGN_UP|GET_OFFER|SHOP_NOW|WATCH_MORE|APPLY_NOW",
          "format": "single_image|video|carousel|collection",
          "visualDirection": "string — instrução específica para o criativo visual",
          "audienceNotes": "string — qual público exato no Meta, warm/cold, lookalike base",
          "phase": "string — em qual fase de lançamento rodar este anúncio"
        }
      ],
      "google": [
        {
          "groupName": "string",
          "matchType": "exact|phrase|broad",
          "keywords": ["string — keywords por intenção de compra"],
          "headlines": ["string — máx 30 chars cada, mínimo 3, seguindo hierarquia keyword+benefício+diferencial"],
          "descriptions": ["string — máx 90 chars cada, mínimo 2, prova social + CTA"],
          "displayUrl": "string",
          "finalUrl": "{{LINK_CAPTURA}}",
          "phase": "string"
        }
      ],
      "tiktok": [
        {
          "adId": "string",
          "angle": "string — tipo de ângulo (UGC/depoimento/educacional/pattern_interrupt)",
          "hook": "string — EXATAMENTE os primeiros 2-3 segundos: frase verbal + instrução visual",
          "hookDuration": "string — ex: 2 segundos",
          "script": "string — roteiro COMPLETO do anúncio em PT-BR coloquial",
          "overlayText": ["string — textos de overlay em sequência com timing"],
          "cta": "string — CTA natural, não forçado",
          "musicStyle": "string — tipo de trilha por vibe (lofi/hype/emocional/silêncio)",
          "visualStyle": "string — UGC/talking-head/demonstração/animação",
          "duration": "string — ex: 30s, 45s, 60s",
          "targetAudience": "string — público específico no TikTok",
          "phase": "string"
        }
      ],
      "retargeting": [
        {
          "audience": "string — segmento de retargeting por comportamento + recência",
          "message": "string — mensagem específica para este comportamento",
          "channel": "meta|google|tiktok",
          "phase": "string"
        }
      ]
    }
  ],
  "phaseStrategy": [
    {
      "phase": "string — captação/aquecimento/abertura/recuperação",
      "objective": "string — objetivo específico desta fase",
      "primaryPlatform": "string",
      "budgetShift": "string — distribuição percentual do budget nesta fase por plataforma",
      "kpi": "string — KPI principal da fase com benchmark numérico (ex: CPL < R$8)"
    }
  ],
  "adCopyNotes": "string — insights estratégicos sobre os anúncios: o que testar primeiro, sinais de alarme, escalonamento"
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
- Diagnostique o estágio de consciência do avatar antes de começar (Ryan Deiss)
- Mínimo 3 variações de Meta Ad por segmento primário usando o método 3-2-2
- Mínimo 1 grupo de Google Ads por segmento com keywords segmentadas por intenção
- Mínimo 2 TikTok Ads por segmento primário com script COMPLETO
- Retargeting segmentado por comportamento E recência (5 segmentos)
- Cada anúncio deve ter instrução visual clara e específica

Retorne APENAS o JSON do pacote de anúncios.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    systemPrompt: COGNITIVE_IDENTITY_AD_COPY + memBlock + AD_COPY_PROMPT,
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
