import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemCopyInput {
  itemId: string;
  phase: string;
  name: string;
  description: string | null;
  contentType: string | null;
  mentalTrigger: string | null;
  copyHints: string | null;
  dayIndex: number;
  deliveryChannels: string[];
  productName: string;
  productPrice: string;
  revenueTarget: string;
  launchModel: string;
  contactSegment?: "hot" | "warm" | "cold";
}

export interface GeneratedItemCopy {
  itemId: string;
  phase: string;
  contentType: string;
  contactSegment: string;
  email?: {
    subject: string;
    previewText: string;
    body: string;
    cta: string;
    ctaUrl: string;
    psLine?: string;
  };
  whatsapp?: {
    message: string;
    timing: string;
    followUp?: string;
  };
  socialPost?: {
    caption: string;
    hashtags: string[];
    imageDirection: string;
    storiesVariant?: string;
  };
  videoScript?: {
    hook: string;
    mainPoints: string[];
    transitionLines: string[];
    cta: string;
    estimatedDuration: string;
  };
  liveScript?: {
    openingHook: string;
    agenda: string[];
    pitchMoment: string;
    closingUrgency: string;
    estimatedDuration: string;
  };
  copywriterNotes: string;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const ITEM_COPY_PROMPT = `Você é o Agente Copywriter de Lançamento da NexOS AI.

Você escreve a copy exata para cada peça do lançamento — emails, WhatsApp, posts de social e scripts. Você conhece profundamente o PLF (Jeff Walker), a Fórmula de Lançamento (Erico Rocha) e os gatilhos mentais que convertem o mercado brasileiro.

## REGRAS DE ESCRITA

**Email:**
- Assunto: 6-9 palavras, curiosidade ou benefício direto. Sem clickbait barato.
- Preview text: complementa o assunto, aumenta a abertura
- Body: PT-BR coloquial, parágrafos curtos (2-3 linhas), emojis estratégicos nos momentos certos
- CTA: um único CTA, verbo de ação + benefício específico
- PS: reforça a escassez ou o benefício principal

**WhatsApp:**
- Máximo 280 caracteres na primeira mensagem
- Emojis estratégicos (não em excesso)
- Direto ao ponto — WhatsApp não é email
- Follow-up 2h depois se a fase for cart_open ou cart_close

**Post de Social / Stories:**
- Hook nas primeiras 2 linhas (antes do "ver mais")
- Narrativa que conecta com a jornada do avatar
- CTA com pergunta ou ação simples

**Script de Vídeo / Live:**
- Hook dos primeiros 30s é decisivo
- Estrutura: Problema → Agitação → Solução → Prova → Oferta → CTA
- Citar o nome do produto no início e no final

## GATILHOS POR FASE

- pre_capture: curiosidade, antecipação (não revele o produto ainda)
- capture: autoridade, promessa de transformação
- plc1: curiosidade + oportunidade ("A grande revelação")
- plc2: transformação + prova social ("Antes e depois")
- plc3: comunidade + reciprocidade ("Você não está sozinho")
- cart_open: evento + urgência (o carrinho ABRIU — é agora)
- cart_middle: prova social + escassez (vagas estão acabando)
- cart_close: medo de perda + urgência máxima (ÚLTIMAS HORAS)
- post_purchase: celebração + onboarding (confirme a decisão certa)
- post_launch: reengajamento + próxima oportunidade

## VARIANTES POR SEGMENTO

- **hot** (score ≥ 60): Já engajou com PLC1/2/3. Usa linguagem de insider, cria senso de VIP. No cart_open: acesso antecipado ou bônus exclusivo.
- **warm** (score ≥ 25): Abriu mas não clicou. Reforça o benefício principal, quebra a objeção de "será que vale?". No cart_open: oferta padrão com garantia destacada.
- **cold** (score < 25): Pouco engajamento. Recomeça com curiosidade, nunca com venda direta. No cart_open: reativação com angle diferente ou urgência de última chamada.

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "itemId": "string",
  "phase": "string",
  "contentType": "string",
  "contactSegment": "hot|warm|cold|all",
  "email": {
    "subject": "string",
    "previewText": "string",
    "body": "string — HTML simples, parágrafos com <p> tags",
    "cta": "string",
    "ctaUrl": "{{CTA_URL}}",
    "psLine": "string — opcional"
  },
  "whatsapp": {
    "message": "string",
    "timing": "string — ex: 08:00 horário de Brasília",
    "followUp": "string — opcional, mensagem de follow-up 2h depois"
  },
  "socialPost": {
    "caption": "string",
    "hashtags": ["string"],
    "imageDirection": "string — direção visual para o designer",
    "storiesVariant": "string — versão curta para stories"
  },
  "videoScript": {
    "hook": "string — primeiros 30s",
    "mainPoints": ["string"],
    "transitionLines": ["string — frases de transição entre pontos"],
    "cta": "string",
    "estimatedDuration": "string"
  },
  "liveScript": {
    "openingHook": "string",
    "agenda": ["string"],
    "pitchMoment": "string",
    "closingUrgency": "string",
    "estimatedDuration": "string"
  },
  "copywriterNotes": "string — observações sobre como usar esta copy"
}
\`\`\`

Preencha APENAS os campos relevantes para o contentType do item. Deixe os outros campos fora do JSON ou como null.`;

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runItemCopyAgent(
  workspaceId: string,
  input: ItemCopyInput,
  log: Logger,
): Promise<GeneratedItemCopy> {
  const segmentLabel = {
    hot: "LEAD QUENTE (score ≥ 60) — engajou com todo o conteúdo, pronto para comprar",
    warm: "LEAD MORNO (score ≥ 25) — abriu emails mas não clicou muito, precisa de reforço",
    cold: "LEAD FRIO (score < 25) — pouco engajamento, precisa de reativação",
    all: "Todos os leads (copy genérica sem segmentação)",
  }[input.contactSegment ?? "all"];

  const phaseLabel: Record<string, string> = {
    pre_capture: "Pré-Captura — Aquecimento Silencioso",
    capture: "Captura — Construção de Lista",
    plc1: "PLC 1 — A Oportunidade",
    plc2: "PLC 2 — A Transformação",
    plc3: "PLC 3 — A Experiência e Comunidade",
    cart_open: "Abertura do Carrinho — VENDAS ATIVAS",
    cart_middle: "Meio do Carrinho — Suporte e Prova Social",
    cart_close: "Fechamento do Carrinho — ÚLTIMAS HORAS",
    post_purchase: "Pós-Compra — Onboarding e Celebração",
    post_launch: "Pós-Lançamento — Reengajamento",
    evergreen: "Evergreen — Sequência Contínua",
  };

  const userMessage = `Gere a copy completa para esta peça do lançamento.

## DADOS DO PRODUTO
- **Produto:** ${input.productName}
- **Preço:** R$${input.productPrice}
- **Meta de receita:** R$${input.revenueTarget}
- **Modelo de lançamento:** ${input.launchModel}

## DADOS DA PEÇA
- **Nome da peça:** ${input.name}
- **Fase:** ${phaseLabel[input.phase] ?? input.phase}
- **Dia do lançamento:** Dia ${input.dayIndex}
- **Tipo de conteúdo:** ${input.contentType ?? "geral"}
- **Canais:** ${input.deliveryChannels.join(", ")}
- **Gatilho mental principal:** ${input.mentalTrigger ?? "não definido"}
- **Segmento de contato:** ${segmentLabel}

## DESCRIÇÃO DA PEÇA
${input.description ?? "Sem descrição adicional."}

## INSTRUÇÕES DO COPYWRITER (COPY HINTS)
${input.copyHints ?? "Sem instruções específicas — use o melhor julgamento para a fase e o gatilho."}

Gere a copy completa para esta peça. Adapte o tom e a urgência ao segmento "${input.contactSegment ?? "all"}".
Retorne APENAS o JSON.`;

  const result = await runAgent({
    campaignId: `seq-copy-${workspaceId}`,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: ITEM_COPY_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
  });

  return parseAgentJSON<GeneratedItemCopy>(result.content, {
    itemId: input.itemId,
    phase: input.phase,
    contentType: input.contentType ?? "general",
    contactSegment: input.contactSegment ?? "all",
    copywriterNotes: result.content,
  });
}
