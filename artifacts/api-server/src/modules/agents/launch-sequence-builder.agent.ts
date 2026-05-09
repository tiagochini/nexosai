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

const SEQUENCE_BUILDER_PROMPT = `Você é o Agente Arquiteto de Sequência de Lançamento da NexOS AI especializado em PLF e Fórmula de Lançamento para o mercado brasileiro.

## FASES PLF
pre_capture(dias 0-6): aquecimento, autoridade
capture(dias 7-13): lead magnet, lista
plc1(dia 14): vídeo oportunidade — gatilho: curiosity+anticipation
plc2(dia 16): vídeo transformação — gatilho: social_proof+authority
plc3(dia 18): vídeo objeções — gatilho: community+reciprocity
cart_open(dia 21): abertura carrinho — gatilho: urgency+scarcity
cart_middle(dias 22-23): suporte, prova — gatilho: social_proof
cart_close(dia 24): fechamento — gatilho: fear_of_loss+scarcity
post_purchase: onboarding

**Retorne APENAS JSON válido** (sem texto extra):

{
  "summary": "string curto",
  "model": "string",
  "totalDays": 0,
  "phases": [
    {"phase":"pre_capture","label":"Pré-Captura","startDay":0,"endDay":6,"objective":"string","primaryTrigger":"curiosity"}
  ],
  "items": [
    {"phase":"pre_capture","name":"string","description":"string curta","dayIndex":0,"mentalTrigger":"curiosity","deliveryChannels":["email"],"contentType":"social_post","objective":"string curta","copyHints":"string curta"}
  ],
  "keyMilestones": [{"day":0,"event":"string","importance":"high"}],
  "strategicNotes": "string curto"
}`;

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

Gere os items da sequência, dia a dia. Mínimo 15 items, máximo 20.
Inclua email + WhatsApp nos momentos críticos (pré-lançamento, abertura e fechamento do carrinho).
Seja conciso nos campos de texto. Retorne APENAS o JSON.`;

  const result = await runAgent({
    campaignId: null,
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
