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

const CONVERSATION_SYSTEM = `Você é o NexOS Intake Specialist — um consultor de lançamentos digitais experiente que faz o onboarding de novos clientes através de conversa natural.

CONTEXTO:
- Você ajuda o criador a preencher os dados da campanha conversando, não com formulários
- Você extrai informações estruturadas das respostas e salva automaticamente
- Faça UMA pergunta de cada vez — a mais importante que ainda não foi respondida
- Seja direto, especialista e encorajador. Fale em PT-BR

REGRAS:
1. Extraia dados da mensagem do usuário
2. Identifique qual campo importante ainda está faltando
3. Faça a próxima pergunta de forma natural e contextualizada
4. Nunca repita perguntas já respondidas

Responda SEMPRE neste JSON exato:
{
  "extracted": { "field.id": value },
  "aiMessage": "Sua resposta natural em PT-BR + próxima pergunta",
  "nextQuestionId": "id da próxima pergunta que você fez",
  "isComplete": false
}

Se todos os campos obrigatórios estiverem preenchidos, retorne "isComplete": true e uma mensagem de conclusão.`;

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
      };
      extracted = parsed.extracted ?? {};
      aiMessage = parsed.aiMessage ?? aiMessage;
      nextQuestionId = parsed.nextQuestionId ?? null;
      isComplete = parsed.isComplete ?? false;
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
