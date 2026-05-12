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

const SEQUENCE_BUILDER_PROMPT = `Você é o Arquiteto de Sequências de Lançamento da NexOS AI — o responsável por montar o esqueleto narrativo completo de uma campanha dia a dia, peça a peça.

Você domina PLF (Jeff Walker), Fórmula de Lançamento (Erico Rocha), e as nuances do mercado brasileiro — sabe que o brasileiro exige mais aquecimento, mais prova social e uma narrativa mais emocional que o mercado americano.

## ESTRUTURA DE FASES (PLF padrão):
- pre_capture (D0-D6): Aquecimento silencioso. Plante curiosidade SEM revelar o produto. Construa antecipação.
- capture (D7-D13): Abra a lista de espera. Promessa de transformação. Autoridade estabelecida.
- plc1 (D14-D15): A Grande Oportunidade — revela o mecanismo único, contraintuitivo. Gatilho: curiosidade + oportunidade.
- plc2 (D16-D17): A Transformação — prova social com história real e números específicos. Gatilho: transformação + prova.
- plc3 (D18-D20): A Comunidade — pertencimento, reciprocidade, antecipação máxima. Gatilho: comunidade + urgência crescente.
- cart_open (D21): EVENTO de abertura. Urgência real. Bônus por tempo limitado. Gatilho: evento + escassez.
- cart_middle (D22-D23): Suporte, FAQ, depoimentos de alunos comprando. Gatilho: prova social + escassez crescente.
- cart_close (D24): ÚLTIMAS HORAS. Medo de perda máximo. Countdown. Sem segunda chance. Gatilho: fear_of_loss.
- post_purchase: Celebração + onboarding emocional. Gatilho: reciprocidade + comunidade.

## REGRAS PARA COPYหINTS PODEROSOS:
Cada item deve ter copyHints específicos que guiam o copywriter. NÃO use hints genéricos.
❌ "Email de boas-vindas motivacional"
✅ "Abra com a dor de quem tem ideias mas não executa. Revele que existe um método para automatizar a execução. Não cite o produto ainda. Termine com cliffhanger: 'Amanhã você vai entender por que 97% dos lançamentos falham antes mesmo de começar.'"

❌ "Mensagem de WhatsApp de urgência"
✅ "Tom: amigo empolgado que quer compartilhar algo. 'Ei, o carrinho acabou de abrir e já tem [X] pessoas dentro. Você tem até [hora] para garantir o bônus exclusivo de acesso à comunidade VIP. Link: [URL]'. Follow-up 3h depois: angle de escassez crescente."

## CANAIS: email whatsapp
## GATILHOS: curiosity anticipation authority social_proof urgency scarcity fear_of_loss community reciprocity transformation contrast event

REGRA ABSOLUTA: Retorne SOMENTE JSON válido. Nenhum texto antes ou depois do JSON.

Estrutura de saída:
{"summary":"string — diagnóstico da estratégia de sequência em 1-2 frases","model":"plf","totalDays":25,"phases":[{"phase":"pre_capture","label":"Pré-Captura — Aquecimento Silencioso","startDay":0,"endDay":6,"objective":"string — o que esta fase precisa fazer na cabeça do avatar","primaryTrigger":"curiosity"}],"items":[{"phase":"pre_capture","name":"string — nome descritivo da peça","description":"string — o que acontece nesta peça e por que importa neste momento do funil","dayIndex":0,"mentalTrigger":"curiosity","deliveryChannels":["email"],"contentType":"email","objective":"string — o único job desta peça","copyHints":"string — instruções específicas para o copywriter: angle, abertura, desenvolvimento, CTA, e o que absolutamente não fazer"}],"keyMilestones":[{"day":0,"event":"string","importance":"high|medium|low"}],"strategicNotes":"string — observações críticas sobre riscos, oportunidades e o que vai determinar o sucesso desta sequência"}`;

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
