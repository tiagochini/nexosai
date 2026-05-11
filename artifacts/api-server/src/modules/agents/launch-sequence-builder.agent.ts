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

const SEQUENCE_BUILDER_PROMPT = `Arquiteto de Sequência NexOS AI — PLF Brasil.

FASES: pre_capture(D0-6) capture(D7-13) plc1(D14) plc2(D16) plc3(D18) cart_open(D21) cart_middle(D22-23) cart_close(D24) post_purchase
CANAIS: email whatsapp
GATILHOS: curiosity anticipation authority social_proof urgency scarcity fear_of_loss community reciprocity transformation

REGRA: Retorne SOMENTE JSON. Sem texto antes ou depois. Campos de texto: máx 60 chars.

{"summary":"<15 palavras>","model":"plf","totalDays":25,"phases":[{"phase":"pre_capture","label":"Pré-Captura","startDay":0,"endDay":6,"objective":"<10 palavras>","primaryTrigger":"curiosity"}],"items":[{"phase":"pre_capture","name":"<6 palavras>","description":"<8 palavras>","dayIndex":0,"mentalTrigger":"curiosity","deliveryChannels":["email"],"contentType":"email","objective":"<6 palavras>","copyHints":"<10 palavras>"}],"keyMilestones":[{"day":0,"event":"<5 palavras>","importance":"high"}],"strategicNotes":"<20 palavras>"}`;

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

  const userMessage = `Produto:${input.productName}|Preço:R$${input.productPrice}|Meta:R$${input.revenueTarget}|Dias:${input.totalDays}|Modelo:${modelLabel}|Canal:${salesChannel}

Gere 15 itens dia a dia. Email+WhatsApp nos dias críticos (cart_open D21, cart_close D24). JSON apenas, campos curtos.`;

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
