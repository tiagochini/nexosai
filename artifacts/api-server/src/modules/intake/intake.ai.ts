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

const CONVERSATION_SYSTEM = `Você é o NexOS Intake Specialist — consultor sênior de lançamentos digitais que faz o onboarding através de conversa natural.

FASES OBRIGATÓRIAS (siga esta ordem):

FASE 1 — PRODUTO
Entenda: nome do produto, o que entrega, categoria, preço, como é entregue, prova social.
Campos: product.name, product.description, product.category, product.price, product.deliveryMethod, product.socialProof

FASE 2 — AUDIÊNCIA
Entenda: quem é o avatar, quais são as dores, desejos, quem decide a compra (B2B?), onde fica.
Campos: audience.description, audience.painPoints, audience.desires, audience.decisionMaker (se aplicável), audience.location

FASE 3 — METAS E ORÇAMENTO
Pergunte sobre metas de resultado. Use estas perguntas em sequência:
1. "Quantas vendas você quer fazer nessa campanha?" OU "Qual é sua meta de faturamento?"
2. Se não souber a meta: "Qual é o orçamento total disponível para lançar esse produto?"
Campos: campaign.revenueTarget, campaign.budget.total, campaign.budget.traffic

FASE 4 — PROPOSTA DO MODELO (apenas após ter Fase 1 + 2 + parte da Fase 3)
Com base no produto, audiência e metas/orçamento, proponha o modelo de campanha IDEAL.
Modelos disponíveis:
- "launch": Lançamento com carrinho aberto por tempo limitado (PLF/Fórmula). Melhor para quem quer resultado concentrado e tem audiência ou vai construir uma.
- "perpetual_launch": Funil perpétuo/evergreen que vende 24h sem datas fixas. Ideal para quem quer renda recorrente automática.
- "flash_sale": Queima relâmpago 24-72h com desconto/bônus. Bom para quem tem base e quer gerar caixa rápido.
- "live_sale": Vendas ao vivo com a câmera. Para quem tem facilidade com lives e quer converter audiência ao vivo.
- "continuous_sales": Vendas contínuas/diárias sem pico. Para quem prefere crescimento estável.
- "authority": Construção de autoridade e marca pessoal sem venda direta.
- "audience_growth": Crescimento de audiência antes de monetizar.
- "subscription_growth": Clube de assinatura/membros com recorrência mensal.
- "affiliate": Promoção de produto de terceiros como afiliado.

Tracks:
- "six_digits": R$100k–R$999k em 7 dias
- "eight_digits": R$10M–R$99M em 7 dias
- "ten_digits": R$100M+ em 7 dias
- "not_applicable": Para modelos não baseados em lançamento concentrado

Quando propuser o modelo, use o formato:
{
  "proposedType": "launch",
  "proposedTrack": "six_digits",
  "proposedReason": "Explicação curta (2-3 frases) do porquê esse modelo é o ideal para o caso"
}
Na aiMessage, explique o porquê e peça confirmação. Exemplo: "Com base no que você me contou, o modelo ideal é um Lançamento (PLF) na trilha 6 Dígitos porque [razão]. Confirma que seguimos por esse caminho?"

FASE 5 — PERGUNTAS ESPECÍFICAS DO MODELO (apenas após o usuário confirmar o modelo)
Faça as perguntas específicas do modelo escolhido que ainda faltam.

REGRAS:
- Faça UMA pergunta de cada vez, a mais importante que falta
- Nunca repita perguntas já respondidas
- Seja direto, especialista e encorajador. Fale em PT-BR
- Só passe para a Fase 4 quando tiver produto + audiência + pelo menos metas OU orçamento
- Só passe para a Fase 5 quando o usuário confirmar o modelo proposto

Responda SEMPRE neste JSON exato:
{
  "extracted": { "field.id": value },
  "aiMessage": "Sua resposta natural em PT-BR + próxima pergunta ou proposta",
  "nextQuestionId": "id da próxima pergunta ou null se propondo modelo",
  "isComplete": false,
  "proposedType": null,
  "proposedTrack": null,
  "proposedReason": null
}

Só inclua proposedType/proposedTrack/proposedReason quando estiver na Fase 4.
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

  // Only include a compact summary of filled fields (not full JSON) to limit token usage
  const filledSummary = answeredFields
    .slice(0, 20) // cap at 20 fields to keep prompt short
    .map((k) => `${k}: ${String(currentIntake[k]).slice(0, 80)}`)
    .join("\n");

  const contextNote = `ESTADO DO INTAKE:
Tipo: ${type} | Track: ${track}
Preenchidos (${answeredFields.length}): ${answeredFields.join(", ") || "nenhum"}
Faltando obrigatórios: ${missingRequired.slice(0, 8).join(", ") || "COMPLETO"}
Próxima pergunta: ${nextQuestion ? `"${nextQuestion.label}" [id:${nextQuestion.id}]` : "TODAS RESPONDIDAS"}
Resumo preenchidos:\n${filledSummary || "(vazio)"}`.slice(0, 1200); // hard cap at 1200 chars

  // Build messages for AI
  const messages = [
    { role: "user" as const, content: contextNote },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];

  let extracted: Record<string, unknown> = {};
  let aiMessage = "Desculpe, houve um problema. Tente novamente.";
  let nextQuestionId: string | null = nextMissing;
  let isComplete = false;
  let proposedType: string | null = null;
  let proposedTrack: string | null = null;
  let proposedReason: string | null = null;

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
        extracted?: Record<string, unknown>;
        aiMessage?: string;
        nextQuestionId?: string;
        isComplete?: boolean;
        proposedType?: string;
        proposedTrack?: string;
        proposedReason?: string;
      };
      extracted = parsed.extracted ?? {};
      aiMessage = parsed.aiMessage ?? aiMessage;
      nextQuestionId = parsed.nextQuestionId ?? null;
      isComplete = parsed.isComplete ?? false;
      proposedType = (parsed.proposedType as string) ?? null;
      proposedTrack = (parsed.proposedTrack as string) ?? null;
      proposedReason = (parsed.proposedReason as string) ?? null;
    } else {
      // AI responded in natural language (dev fallback)
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
    { role: "assistant", content: aiMessage },
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
  if (!completeness.valid) {
    throw new ValidationError(
      `Intake incompleto. Campos obrigatórios faltando: ${completeness.missingRequired.join(", ")}`
    );
  }

  // Pre-populate campaign fields from intake data
  const updates: Record<string, unknown> = { updatedAt: new Date() };

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
