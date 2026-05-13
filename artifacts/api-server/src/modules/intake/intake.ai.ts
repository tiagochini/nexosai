import { eq, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  auditLogsTable,
  type Campaign,
} from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Logger } from "pino";
import {
  getIntakeQuestions,
  validateIntakeCompleteness,
  saveIntakeData,
  type CampaignType,
  type CampaignTrack,
} from "./intake.service.js";
import { recommendTrackFromRevenue } from "./intake.scoring.js";

// ─── Natural language extraction ──────────────────────────────────────────────

const NL_SYSTEM_PROMPT = `Você é especialista em marketing digital brasileiro, focado em lançamentos e infoprodutos.

Sua função é extrair dados estruturados de campanha a partir de texto livre do usuário.

SEMPRE responda EXCLUSIVAMENTE em JSON válido neste formato:
{
  "extracted": {
    "field.id": value
  },
  "confidence": {
    "field.id": 0.0-1.0
  },
  "suggestedTrack": "six_digits|eight_digits|ten_digits|not_applicable",
  "notes": "observações relevantes que o sistema deve considerar"
}

Campos possíveis:
- product.name: string
- product.description: string
- product.category: "infoproduct"|"mentorship"|"software"|"service"|"ecommerce"|"community"|"event"
- product.price: number (em R$)
- product.pricingModel: "one_time"|"installments"|"recurring_monthly"|"recurring_annual"|"hybrid"
- product.deliveryMethod: "100_online"|"hybrid"|"in_person"|"physical_shipment"
- product.socialProof: string (depoimentos, números, resultados)
- audience.description: string (avatar ideal)
- audience.painPoints: string
- audience.desires: string
- audience.decisionMaker: "self"|"business_owner"|"manager"|"teacher_educator"|"hr_department"|"couple_family"|"committee"
- audience.buyerVsUser: string (quem paga vs quem usa, ex: "escola paga, professor usa")
- audience.sophisticationLevel: "unaware"|"problem_aware"|"solution_aware"|"product_aware"|"most_aware"
- audience.location: "brazil_nationwide"|"brazil_southeast"|"brazil_northeast"|"latin_america"|"portugal"|"global_ptbr"
- creator.name: string
- creator.positioning: "expert"|"authority"|"storyteller"|"educator"|"entertainer"|"transformation"|"community_leader"
- creator.uniqueAngle: string
- content.style: array de "educational"|"inspirational"|"provocative"|"testimonial"|"documentary"|"storytelling"|"authority"
- content.tone: "formal"|"casual"|"intimate"|"urgent"|"empathetic"|"challenger"
- content.forbiddenTopics: string
- campaign.revenueTarget: number (em R$)
- campaign.budget.total: number (em R$)
- campaign.budget.traffic: number (em R$)
- campaign.salesChannel: "sales_page"|"whatsapp_group"|"webinar"|"lives"|"vsl"|"telegram"|"hybrid"
- campaign.hasAffiliate: boolean
- campaign.affiliateCommission: number (percentual)
- launch.cartOpenDuration: number (dias)
- launch.scarcityMechanism: "deadline"|"limited_spots"|"bonus_expiry"|"price_increase"|"combined"
- risk.tolerance: "conservative"|"moderate"|"aggressive"
- risk.previousCampaigns: string

Extrai APENAS campos que claramente estão no texto. Não invente. Confidence 1.0 = certeza total, 0.5 = inferência razoável.`;

export async function extractIntakeFromText(
  campaignId: string,
  workspaceId: string,
  text: string,
  log: Logger
): Promise<{
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  suggestedTrack: CampaignTrack | null;
  notes: string;
  savedCount: number;
}> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  let extracted: Record<string, unknown> = {};
  let confidence: Record<string, number> = {};
  let suggestedTrack: CampaignTrack | null = null;
  let notes = "";

  try {
    const result = await completeWithAgent(
      "strategy",
      NL_SYSTEM_PROMPT,
      [{ role: "user", content: `Extraia os dados de campanha deste texto:\n\n${text}` }],
      workspaceId,
      log,
      campaignId
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        extracted?: Record<string, unknown>;
        confidence?: Record<string, number>;
        suggestedTrack?: string;
        notes?: string;
      };
      extracted = parsed.extracted ?? {};
      confidence = parsed.confidence ?? {};
      suggestedTrack = (parsed.suggestedTrack as CampaignTrack) ?? null;
      notes = parsed.notes ?? "";
    }
  } catch (err) {
    log.warn({ err }, "NL extraction AI failed — returning empty extraction");
    // Return empty rather than crashing
  }

  // Merge with existing intakeData and save
  const existingData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const highConfidenceExtracted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(extracted)) {
    const conf = confidence[key] ?? 0.5;
    if (conf >= 0.5) {
      highConfidenceExtracted[key] = value;
    }
  }

  const merged = { ...existingData, ...highConfidenceExtracted };

  if (Object.keys(highConfidenceExtracted).length > 0) {
    await saveIntakeData(campaignId, workspaceId, merged, log);
  }

  // Auto-detect track from revenue target if not set
  if (!suggestedTrack && extracted["campaign.revenueTarget"]) {
    suggestedTrack = recommendTrackFromRevenue(Number(extracted["campaign.revenueTarget"]));
  }

  return {
    extracted,
    confidence,
    suggestedTrack,
    notes,
    savedCount: Object.keys(highConfidenceExtracted).length,
  };
}

// ─── Conversational intake ─────────────────────────────────────────────────────

// ─── Agent roster — inspired by real digital marketing legends ─────────────────

export interface IntakeAgent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  color: string;     // tailwind color token (text-* compatible)
  initial: string;   // avatar letter
  phases: number[];  // which phases this agent leads (1-5)
  greeting: string;  // how they introduce themselves
}

export const INTAKE_AGENTS: IntakeAgent[] = [
  {
    id: "erico",
    name: "Érico",
    role: "Estrategista de Produto",
    specialty: "PLF · Fórmula de Lançamento · Posicionamento",
    color: "text-blue-400",
    initial: "E",
    phases: [1],
    greeting: "Oi! Sou o Érico, estrategista de produto aqui na NexOS. Trabalho com lançamentos desde a Fórmula de Lançamento original — já vi centenas de produtos decolarem (e alguns afundarem) e sei exatamente o que faz a diferença.",
  },
  {
    id: "ryan",
    name: "Ryan",
    role: "Especialista em Audiência",
    specialty: "Avatar · Segmentação · Psicologia do Comprador",
    color: "text-emerald-400",
    initial: "R",
    phases: [2],
    greeting: "Prazer, sou o Ryan — especialista em audiência e comportamento do comprador. Minha obsessão é entender quem compra, por quê compra e o que impede de comprar. Essa parte é onde os lançamentos ganham ou perdem antes de começar.",
  },
  {
    id: "jeff",
    name: "Jeff",
    role: "Estrategista de Receita",
    specialty: "Metas · Orçamento · ROI · Trilhas de Crescimento",
    color: "text-yellow-400",
    initial: "J",
    phases: [3],
    greeting: "Oi, pode me chamar de Jeff — cuido da parte de números e estratégia de receita. Fui eu quem trouxe a lógica de 'lançamento como evento' para o mercado digital, e hoje aplico isso para escalar produtos de todo tamanho.",
  },
  {
    id: "chet",
    name: "Chet",
    role: "Diretor de Estratégia de Campanha",
    specialty: "Modelo de Campanha · Funil · Mecanismo Único",
    color: "text-violet-400",
    initial: "C",
    phases: [4],
    greeting: "Oi, sou o Chet — responsável por montar a arquitetura da campanha. Com o que o Érico, o Ryan e o Jeff coletaram, posso te dizer exatamente qual modelo de lançamento vai funcionar para o seu caso.",
  },
  {
    id: "walker",
    name: "Walker",
    role: "Especialista em Execução",
    specialty: "PLF Avançado · Copy de Lançamento · Sequência de Conteúdo",
    color: "text-orange-400",
    initial: "W",
    phases: [5],
    greeting: "Aqui é o Walker — execução é comigo. Agora que o modelo está definido, preciso entender alguns detalhes específicos para montar a sequência perfeita para o seu lançamento.",
  },
];

function getAgentForPhase(phase: number): IntakeAgent {
  return INTAKE_AGENTS.find(a => a.phases.includes(phase)) ?? INTAKE_AGENTS[0]!;
}

function detectPhaseFromFields(answeredFields: string[], missingRequired: string[]): number {
  const hasProduct = answeredFields.some(f => f.startsWith("product."));
  const hasAudience = answeredFields.some(f => f.startsWith("audience."));
  const hasGoals = answeredFields.some(f => f.startsWith("campaign."));
  if (!hasProduct) return 1;
  if (!hasAudience) return 2;
  if (!hasGoals) return 3;
  if (missingRequired.length > 0) return 5;
  return 4;
}

const CONVERSATION_SYSTEM = `Você é o orquestrador de uma MESA DE REUNIÃO de especialistas em lançamento digital da NexOS AI.

## O CONCEITO
O usuário acabou de contratar uma agência de lançamento de alto nível. Cada especialista tem nome, personalidade e área de domínio própria. Eles se revezam fazendo perguntas conforme a fase do briefing.

## ESPECIALISTAS DA MESA

**Érico** (Fases 1 — Produto): Estrategista de produto. Inspirado nos maiores lançamentos do mercado digital brasileiro. Tom: empolgado com produto, faz o usuário ver o potencial do que tem nas mãos.

**Ryan** (Fase 2 — Audiência): Psicólogo do comprador. Obcecado com avatar e dor do cliente. Tom: curioso, investigativo, faz perguntas que o usuário nunca pensou.

**Jeff** (Fase 3 — Receita): Estrategista de números. Tom: direto, confiante, trata metas como ciência, não como adivinhação. Ajuda quem não sabe a meta a calcular.

**Chet** (Fase 4 — Modelo): Arquiteto de campanha. Tom: assertivo, apresenta a proposta como um diagnóstico de especialista, explica o raciocínio.

**Walker** (Fase 5 — Execução): Especialista em PLF e sequências. Tom: técnico mas acessível, trata cada detalhe como crucial para o resultado.

## REGRAS CRÍTICAS
1. Cada turno começa com: "[AGENT:id_do_agente]" na primeira linha do JSON (ex: "[AGENT:erico]")
2. Quando o agente MUDA de fase para outra, ele se apresenta brevemente e passa a palavra. Exemplo: "Sou o Érico, estrategista de produto — vou começar. [pergunta]"
3. Quando o agente CONTINUA na mesma fase, ele NÃO se apresenta — vai direto ao ponto, reconhecendo a resposta anterior
4. UMA pergunta por turno — a mais importante que falta naquela fase
5. Se a resposta for VAGA ou incompleta, o agente aprofunda ANTES de avançar. Ex: "Quando você diz 'ajuda pessoas a emagrecer', você quer dizer um método específico, ou é consultoria personalizada? Isso muda bastante a estratégia."
6. Se o usuário NÃO SABE a resposta, o agente oferece opções e explica cada uma brevemente para ajudá-lo a escolher
7. Reconheça o que foi dito antes de perguntar — isso cria sensação de conversa real, não de formulário
8. Adapte o tom: iniciantes recebem mais explicação, profissionais recebem linguagem técnica direta
9. Nunca repita perguntas já respondidas
10. Só avance de fase quando a fase atual estiver suficientemente preenchida

## FASES E RESPONSÁVEIS

FASE 1 — PRODUTO (Érico)
Entenda: nome, o que entrega/transforma, categoria, preço, como é entregue, prova social existente.
Campos: product.name, product.description, product.category, product.price, product.deliveryMethod, product.socialProof

FASE 2 — AUDIÊNCIA (Ryan)
Entenda: avatar detalhado, dores principais, desejos profundos, quem decide a compra, localização.
Campos: audience.description, audience.painPoints, audience.desires, audience.decisionMaker, audience.location
Dica: perguntas como "qual é a maior frustração que seu cliente tem antes de encontrar você?" revelam muito mais que "qual é o público-alvo?"

FASE 3 — METAS E RECEITA (Jeff)
Entenda: meta de faturamento, orçamento disponível, orçamento para tráfego.
Campos: campaign.revenueTarget, campaign.budget.total, campaign.budget.traffic
Dica: se o usuário não souber a meta, Jeff pergunta o preço × quantas vendas fariam sentido, e calcula junto.

FASE 4 — PROPOSTA DO MODELO (Chet)
Com base em tudo coletado, Chet propõe o modelo ideal e explica o raciocínio como um diagnóstico médico.
Modelos: launch (PLF/Fórmula — carrinho por tempo limitado), perpetual_launch (evergreen/funil perpétuo), flash_sale (queima 24-72h), live_sale (vendas ao vivo), continuous_sales (vendas diárias), authority (construção de autoridade), audience_growth (crescimento de audiência), subscription_growth (clube/assinatura), affiliate (afiliado)
Tracks: six_digits (R$100k-999k/7dias), eight_digits (R$10M-99M/7dias), ten_digits (R$100M+/7dias), not_applicable

FASE 5 — EXECUÇÃO (Walker)
Perguntas específicas do modelo confirmado. Walker coleta os detalhes táticos que faltam.

## PRIMEIRA MENSAGEM (message = "iniciar_intake")
Érico abre a reunião com energia. Ele:
1. Diz que o time está pronto e animado para conhecer o produto
2. Explica em 1 frase o que vai acontecer (brainstorm de briefing com especialistas)
3. Faz a primeira pergunta: qual é o produto e o que ele transforma na vida de quem compra

## RETOMADA (message = "continuar_intake")
O agente da fase atual faz um resumo do que foi coletado e indica onde continuam.

Responda SEMPRE neste JSON exato:
{
  "agentId": "erico|ryan|jeff|chet|walker",
  "extracted": { "field.id": value },
  "aiMessage": "mensagem natural do agente em PT-BR",
  "nextQuestionId": "id da próxima pergunta ou null",
  "isComplete": false,
  "proposedType": null,
  "proposedTrack": null,
  "proposedReason": null
}

Só inclua proposedType/proposedTrack/proposedReason quando Chet estiver na Fase 4.
Se todos os campos obrigatórios do modelo confirmado estiverem preenchidos, retorne "isComplete": true.`;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export async function processConversationalTurn(
  campaignId: string,
  workspaceId: string,
  userMessage: string,
  history: ConversationTurn[],
  log: Logger
): Promise<{
  agentId: string;
  extracted: Record<string, unknown>;
  aiMessage: string;
  nextQuestionId: string | null;
  isComplete: boolean;
  progress: number;
  missingRequired: string[];
  intakeData: Record<string, unknown>;
  proposedType: string | null;
  proposedTrack: string | null;
  proposedReason: string | null;
}> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const currentIntake = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const questions = getIntakeQuestions(type, track);
  const completeness = validateIntakeCompleteness(type, track, currentIntake);

  // Build context for AI — keep it compact to avoid token overflow
  const missingRequired = completeness.missingRequired;
  const answeredFields = Object.keys(currentIntake).filter((k) => !k.startsWith("_"));
  const nextMissing = missingRequired[0] ?? null;
  const nextQuestion = questions.find((q) => q.id === nextMissing);

  // ── Hard-stop: all required fields already filled ─────────────────────────
  // Don't call the LLM at all — return a deterministic completion message.
  if (completeness.valid) {
    const productName = String(
      currentIntake["product.name"] ?? currentIntake["product.nome"] ?? "seu produto"
    );
    const wrapUpMessage = `Perfeito! Temos tudo que precisamos para montar o Master Plan de Lançamento de **${productName}** 🎯\n\nO briefing está 100% completo. Clique no botão abaixo para ver e aprovar o Master Plan do Lançamento — com estratégia, calendário editorial, criativos e projeções de resultado.`;

    // Persist the wrap-up as the last assistant message in history
    const prevHistory = Array.isArray(currentIntake["_conversationHistory"])
      ? (currentIntake["_conversationHistory"] as Array<{ role: string; content: string }>)
      : [];
    const updatedHistory = [
      ...prevHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: wrapUpMessage, agentId: "erico" },
    ].slice(-40);
    await saveIntakeData(campaignId, workspaceId, { ...currentIntake, _conversationHistory: updatedHistory }, log);

    const progress = 100;
    return {
      agentId: "erico",
      extracted: {},
      aiMessage: wrapUpMessage,
      nextQuestionId: null,
      isComplete: true,
      progress,
      missingRequired: [],
      intakeData: { ...currentIntake, _conversationHistory: updatedHistory },
      proposedType: null,
      proposedTrack: null,
      proposedReason: null,
    };
  }

  // ── Round limit: after 40 history entries (~20 exchanges), force completion ─
  const existingHistory = Array.isArray(currentIntake["_conversationHistory"])
    ? (currentIntake["_conversationHistory"] as unknown[])
    : [];
  if (existingHistory.length >= 40) {
    const forcedMessage = `Temos informações suficientes para começar! Briefing registrado com os dados coletados até aqui. Clique no botão abaixo para ver e aprovar o Master Plan do Lançamento.`;
    const updatedHistory = [
      ...existingHistory as Array<{ role: string; content: string }>,
      { role: "user", content: userMessage },
      { role: "assistant", content: forcedMessage, agentId: "erico" },
    ].slice(-40);
    await saveIntakeData(campaignId, workspaceId, { ...currentIntake, _conversationHistory: updatedHistory }, log);

    const newCompleteness2 = validateIntakeCompleteness(type, track, currentIntake);
    const progress2 = Math.round(
      ((questions.length - newCompleteness2.missingRequired.length) / questions.length) * 100
    );
    return {
      agentId: "erico",
      extracted: {},
      aiMessage: forcedMessage,
      nextQuestionId: null,
      isComplete: true,
      progress: progress2,
      missingRequired: newCompleteness2.missingRequired,
      intakeData: { ...currentIntake, _conversationHistory: updatedHistory },
      proposedType: null,
      proposedTrack: null,
      proposedReason: null,
    };
  }

  // Only include a compact summary of filled fields (not full JSON) to limit token usage
  const filledSummary = answeredFields
    .slice(0, 20) // cap at 20 fields to keep prompt short
    .map((k) => `${k}: ${String(currentIntake[k]).slice(0, 80)}`)
    .join("\n");

  const isResume = userMessage === "continuar_intake";

  const contextNote = `ESTADO DO INTAKE:
Tipo: ${type} | Track: ${track}
Preenchidos (${answeredFields.length}): ${answeredFields.join(", ") || "nenhum"}
Faltando obrigatórios: ${missingRequired.slice(0, 8).join(", ") || "COMPLETO"}
Próxima pergunta: ${nextQuestion ? `"${nextQuestion.label}" [id:${nextQuestion.id}]` : "TODAS RESPONDIDAS"}
Resumo preenchidos:\n${filledSummary || "(vazio)"}${isResume ? `\n\nINSTRUÇÃO ESPECIAL: O usuário está RETOMANDO um briefing iniciado anteriormente. Apresente um resumo claro e objetivo do que já foi coletado (produto, audiência, metas já preenchidas), indique em qual fase estamos (${answeredFields.length === 0 ? "Fase 1 — Produto" : missingRequired.length === 0 ? "Completo" : "progresso parcial"}), e pergunte a próxima questão que falta de forma natural. Não comece do zero.` : ""}`.slice(0, 1400); // hard cap

  // Build messages for AI
  const actualUserMessage = isResume ? "Olá, estou retomando meu briefing. O que já foi preenchido e qual é o próximo passo?" : userMessage;

  const messages = [
    { role: "user" as const, content: contextNote },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: actualUserMessage },
  ];

  const currentPhase = detectPhaseFromFields(answeredFields, missingRequired);
  const currentAgent = getAgentForPhase(currentPhase);

  let extracted: Record<string, unknown> = {};
  let aiMessage = "Desculpe, houve um problema. Tente novamente.";
  let nextQuestionId: string | null = nextMissing;
  let isComplete = false;
  let proposedType: string | null = null;
  let proposedTrack: string | null = null;
  let proposedReason: string | null = null;
  let agentId: string = currentAgent.id;

  try {
    const result = await completeWithAgent(
      "strategy",
      CONVERSATION_SYSTEM,
      messages,
      workspaceId,
      log,
      campaignId
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        agentId?: string;
        extracted?: Record<string, unknown>;
        aiMessage?: string;
        nextQuestionId?: string;
        isComplete?: boolean;
        proposedType?: string;
        proposedTrack?: string;
        proposedReason?: string;
      };
      agentId = parsed.agentId ?? currentAgent.id;
      extracted = parsed.extracted ?? {};
      aiMessage = parsed.aiMessage ?? aiMessage;
      nextQuestionId = parsed.nextQuestionId ?? null;
      isComplete = parsed.isComplete ?? false;
      proposedType = (parsed.proposedType as string) ?? null;
      proposedTrack = (parsed.proposedTrack as string) ?? null;
      proposedReason = (parsed.proposedReason as string) ?? null;
    } else {
      aiMessage = result.content.replace(/^\[DEV MODE.*?\]/, "").trim() ||
        (nextQuestion ? `${nextQuestion.label}` : "Intake concluído!");
    }
  } catch (err) {
    log.warn({ err }, "Conversational AI failed");
    aiMessage = nextQuestion
      ? `Entendido! Agora me conta: ${nextQuestion.label}${nextQuestion.description ? ` (${nextQuestion.description})` : ""}`
      : "Ótimo! Todos os dados foram coletados.";
  }

  // ── Always persist conversation history ──────────────────────────────────────
  const HIST_KEY = "_conversationHistory";
  const prevHistory = Array.isArray(currentIntake[HIST_KEY])
    ? (currentIntake[HIST_KEY] as Array<{ role: string; content: string }>)
    : [];
  const updatedHistory = [
    ...prevHistory,
    { role: "user", content: userMessage },
    { role: "assistant", content: aiMessage, agentId },
  ].slice(-40); // keep last 40 turns (20 exchanges)

  // Merge extracted fields + updated history and save
  const mergedData = {
    ...currentIntake,
    ...(Object.keys(extracted).length > 0 ? extracted : {}),
    [HIST_KEY]: updatedHistory,
  };
  await saveIntakeData(campaignId, workspaceId, mergedData, log);

  // Re-check completeness with new data
  const newCompleteness = validateIntakeCompleteness(type, track, mergedData);
  isComplete = isComplete || newCompleteness.valid;

  const progress = Math.round(
    ((questions.length - newCompleteness.missingRequired.length) / questions.length) * 100
  );

  return {
    agentId,
    extracted,
    aiMessage,
    nextQuestionId,
    isComplete,
    progress,
    missingRequired: newCompleteness.missingRequired,
    intakeData: mergedData,
    proposedType,
    proposedTrack,
    proposedReason,
  };
}

// ─── Finalize intake ──────────────────────────────────────────────────────────

export async function finalizeIntake(
  campaignId: string,
  workspaceId: string,
  log: Logger
): Promise<Campaign> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  if (campaign.status !== "intake") {
    throw new ValidationError(`Campanha não está em intake (status atual: ${campaign.status})`);
  }

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;

  const completeness = validateIntakeCompleteness(type, track, intakeData);
  const fieldsCount = Object.keys(intakeData).length;

  // Soft validation: require at least 3 fields collected; missing required fields only warn, don't block.
  // The conversational AI decides when it has enough — strict field-key matching would block valid intakes
  // where the AI stored data under slightly different keys than the static schema expects.
  if (fieldsCount < 3) {
    throw new ValidationError("Briefing muito curto. Continue a conversa com a IA antes de finalizar.");
  }
  if (!completeness.valid) {
    log.warn(
      { campaignId, missingRequired: completeness.missingRequired },
      "Finalizing intake with soft-incomplete fields — AI conversation marked complete"
    );
  }

  // Pre-populate campaign fields from intake data
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    status: "analyzing", // Advance out of intake so campaign detail page doesn't redirect back
  };

  if (intakeData["campaign.revenueTarget"]) {
    updates["revenueTarget"] = String(Number(intakeData["campaign.revenueTarget"]));
  }
  if (intakeData["campaign.budget.total"]) {
    updates["budgetTotal"] = Math.round(Number(intakeData["campaign.budget.total"]));
  }

  const [updated] = await db
    .update(campaignsTable)
    .set(updates)
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.intake.finalized",
    actor: "user",
    data: {
      fieldsCount: Object.keys(intakeData).length,
      requiredComplete: completeness.valid,
    },
  });

  log.info({ campaignId }, "Intake finalized — ready for orchestration");
  return updated!;
}
