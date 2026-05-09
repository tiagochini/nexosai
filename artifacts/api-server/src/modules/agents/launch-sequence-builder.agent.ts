import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { Logger } from "pino";

export interface SequenceItemPlan {
  phase: string;
  name: string;
  description: string;
  dayIndex: number;
  mentalTrigger: string;
  deliveryChannels: string[];
  contentType: string;
  objective: string;
  copyHints: string;
}

export interface LaunchSequencePlan {
  summary: string;
  model: string;
  totalDays: number;
  phases: {
    phase: string;
    label: string;
    startDay: number;
    endDay: number;
    objective: string;
    primaryTrigger: string;
  }[];
  items: SequenceItemPlan[];
  keyMilestones: { day: number; event: string; importance: string }[];
  strategicNotes: string;
}

export interface SequenceBuilderInput {
  model: string;
  totalDays: number;
  productName: string;
  productPrice: string;
  revenueTarget: string;
  launchStartDate?: string;
  cartOpenDate?: string;
  cartCloseDate?: string;
  intakeData: Record<string, unknown>;
}

const SEQUENCE_BUILDER_PROMPT = `Você é o Agente Arquiteto de Sequência de Lançamento da NexOS AI.

Você domina profundamente o Product Launch Formula (Jeff Walker), a Fórmula de Lançamento (Erico Rocha) e todas as variações aplicadas ao mercado brasileiro de produtos digitais.

## OS MODELOS DE LANÇAMENTO

### PLF (Product Launch Formula) — Jeff Walker
- **Pré-captura (dias -14 a -7):** Aquecimento silencioso, conteúdo de autoridade sem revelar o produto
- **Captura (dias -7 a 0):** Lead magnet, página de espera, anúncios de captura
- **PLC1 — A Oportunidade (dia 1):** Vídeo de 20-30min revelando a oportunidade. Gatilho: CURIOSIDADE + ANTECIPAÇÃO
- **PLC2 — A Transformação (dia 3):** Vídeo mostrando jornada e prova social. Gatilho: PROVA SOCIAL + AUTORIDADE
- **PLC3 — A Experiência (dia 5):** Vídeo entrando em objeções e comunidade. Gatilho: COMUNIDADE + RECIPROCIDADE
- **Abertura do Carrinho (dia 7):** Oferta revelada, sequência de emails agressiva, WhatsApp. Gatilho: URGÊNCIA + ESCASSEZ
- **Meio do Carrinho (dias 8-9):** Suporte, FAQ, depoimentos, bônus revelados. Gatilho: PROVA SOCIAL
- **Fechamento (dia 10):** Últimas 24h, sequência final, countdown. Gatilho: ESCASSEZ + MEDO DE PERDA
- **Pós-compra:** Upsell, onboarding

### Fórmula de Lançamento (Erico Rocha) — Adaptações PT-BR
- Uso intensivo de WhatsApp desde o pré-captura
- Lives ao vivo em vez de vídeos gravados para PLC
- Grupos de WhatsApp segmentados (leads, compradores)
- Sequência de emails em PT-BR coloquial + emojis estratégicos
- Reforço com Stories diários

## GATILHOS MENTAIS POR FASE
- authority: PLC1, conteúdo de expertise
- social_proof: PLC2, depoimentos
- reciprocity: PLC3, dar valor antes de pedir
- community: PLC3, senso de pertencimento
- anticipation: Pré-captura, PLC1, teaser
- curiosity: Pré-captura, hooks
- event: Abertura do carrinho
- scarcity: Meio e fechamento (vagas limitadas)
- urgency: Fechamento (tempo acabando)
- fear_of_loss: Últimas 24h
- transformation: PLC2, antes/depois
- contrast: Abertura (compara com alternativas)

## CANAIS DE ENTREGA PT-BR
- email: Sequência principal
- whatsapp: Broadcast, grupos
- social: Instagram/Facebook posts e Stories
- video: YouTube, VSL, lives

**Retorne APENAS JSON válido** no formato exato:

\`\`\`json
{
  "summary": "string",
  "model": "string",
  "totalDays": 0,
  "phases": [
    {
      "phase": "string — pre_capture|capture|plc1|plc2|plc3|cart_open|cart_middle|cart_close|post_purchase|post_launch",
      "label": "string — ex: PLC 1 — A Oportunidade",
      "startDay": 0,
      "endDay": 0,
      "objective": "string",
      "primaryTrigger": "string"
    }
  ],
  "items": [
    {
      "phase": "string",
      "name": "string — ex: Email de abertura do carrinho",
      "description": "string",
      "dayIndex": 0,
      "mentalTrigger": "string",
      "deliveryChannels": ["email", "whatsapp"],
      "contentType": "string — email_sequence|whatsapp_broadcast|social_post|vsl_script|live_script|etc",
      "objective": "string",
      "copyHints": "string — dicas cruciais para escrever este item"
    }
  ],
  "keyMilestones": [
    { "day": 0, "event": "string", "importance": "string" }
  ],
  "strategicNotes": "string"
}
\`\`\``;

export async function runLaunchSequenceBuilderAgent(
  workspaceId: string,
  input: SequenceBuilderInput,
  log: Logger,
): Promise<LaunchSequencePlan> {
  const memCtx = await getMemoryContext(workspaceId, "launch_sequence", input.model);
  const memBlock = buildMemoryContextBlock(memCtx);

  const salesChannel = String(input.intakeData["campaign.salesChannel"] ?? "hybrid");
  const emailTool = String(input.intakeData["campaign.emailTool"] ?? "activecampaign");
  const socialProof = String(input.intakeData["product.socialProof"] ?? "a ser definida");
  const productCategory = String(input.intakeData["product.category"] ?? "infoproduto");

  const modelLabel = input.model === "plf"
    ? "PLF (Product Launch Formula)"
    : input.model === "formula_de_lancamento"
    ? "Fórmula de Lançamento (Erico Rocha)"
    : input.model;

  const userMessage = `Crie a sequência de lançamento completa para este produto.

**Modelo:** ${modelLabel}
**Produto:** ${input.productName}
**Preço:** R$${input.productPrice}
**Meta de receita:** R$${input.revenueTarget}
**Duração total:** ${input.totalDays} dias
**Categoria:** ${productCategory}
**Canal principal:** ${salesChannel}
**Email:** ${emailTool}
**Prova social:** ${socialProof}
${input.launchStartDate ? `**Início:** ${input.launchStartDate}` : ""}
${input.cartOpenDate ? `**Abertura carrinho:** ${input.cartOpenDate}` : ""}
${input.cartCloseDate ? `**Fechamento carrinho:** ${input.cartCloseDate}` : ""}

Gere TODOS os items da sequência, dia a dia. Mínimo 25 items.
Inclua email + WhatsApp para cada momento crítico.
Retorne APENAS o JSON.`;

  const result = await runAgent({
    campaignId: `seq-${workspaceId}`,
    workspaceId,
    agentRole: "strategy",
    systemPrompt: memBlock + SEQUENCE_BUILDER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
  });

  return parseAgentJSON<LaunchSequencePlan>(result.content, {
    summary: `Sequência ${input.model} para ${input.productName}`,
    model: input.model,
    totalDays: input.totalDays,
    phases: [],
    items: [],
    keyMilestones: [],
    strategicNotes: result.content,
  });
}
