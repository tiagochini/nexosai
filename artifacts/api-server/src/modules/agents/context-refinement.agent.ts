/**
 * Context Refinement Agent
 *
 * Triggered when content generation fails with an INVALID_INPUT_CONTEXT error.
 * Analyzes the intake data for gaps or inconsistencies, then:
 *   1. Inserts a targeted clarifying question into agentClarificationRequestsTable
 *   2. Sets autocorrectionStatus = "waiting_clarification" in brainData
 *
 * The existing AgentClarificationPanel in the frontend surfaces this question.
 * When the user answers, buildClarificationContextBlock() injects the answer
 * into the next content run automatically.
 *
 * Non-blocking: always called via setImmediate / fire-and-forget.
 */

import { eq, and } from "drizzle-orm";
import { db, campaignsTable, agentClarificationRequestsTable } from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

export async function runContextRefinement(
  campaignId: string,
  workspaceId: string,
  pieceType: string,
  agentName: string,
  errorMessage: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<void> {
  log.info({ campaignId, pieceType, agentName }, "[CONTEXT-REFINEMENT] Starting intake gap analysis");

  const [campaign] = await db
    .select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) return;

  const brainRaw = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const contentRetry = ((brainRaw["contentRetry"] ?? {}) as Record<string, unknown>);

  // Mark as running
  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainRaw,
        contentRetry: { ...contentRetry, autocorrectionStatus: "running" },
      } as any,
    })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  const intakeSummary = JSON.stringify({
    offerName: intakeData["offerName"] ?? intakeData["productName"],
    targetAudience: intakeData["targetAudience"] ?? intakeData["avatar"],
    price: intakeData["price"] ?? intakeData["offerPrice"],
    format: intakeData["productFormat"] ?? intakeData["format"],
    guarantee: intakeData["guarantee"],
    launchModel: intakeData["launchModel"],
    revenueGoal: intakeData["revenueGoal"],
  }).slice(0, 800);

  const systemPrompt = `Você é o Entry Analyzer da NexOS AI — especialista em diagnóstico de briefings.

Sua missão: identificar qual campo específico do briefing está causando falha nos agentes de conteúdo e formular UMA pergunta cirúrgica para corrigir isso.

REGRAS:
- Faça APENAS UMA pergunta — a mais importante para destravar o agente
- A pergunta deve ser direta, específica e fácil de responder
- Prefira perguntas com opções claras (A/B/C) quando possível
- O usuário não é técnico — fale sobre o PRODUTO/NEGÓCIO, não sobre a tecnologia`;

  const userMessage = `Um agente de conteúdo falhou ao tentar gerar "${pieceType}".

ERRO: ${errorMessage.slice(0, 400)}

DADOS DO BRIEFING DISPONÍVEIS:
${intakeSummary}

Analise: qual dado crítico está ausente ou inconsistente no briefing que pode ter causado esta falha?

Responda em JSON:
{
  "gapIdentified": "descrição do dado que está faltando ou inconsistente",
  "question": "A pergunta única que você faria ao usuário (clara, direta, em PT-BR)",
  "options": ["opção A", "opção B", "opção C"],
  "fieldHint": "nome do campo do briefing que precisa ser preenchido",
  "urgency": "critical|high|medium"
}`;

  let question = "";
  let options: string[] = [];
  let fieldHint = "";

  try {
    const result = await completeWithAgent(
      "command",
      systemPrompt,
      [{ role: "user", content: userMessage }],
      workspaceId,
      log,
      undefined,
    );

    const match = result.content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      question = String(parsed["question"] ?? "");
      options = (parsed["options"] as string[] | undefined) ?? [];
      fieldHint = String(parsed["fieldHint"] ?? pieceType);
    }
  } catch (err) {
    log.warn({ err, campaignId, pieceType }, "[CONTEXT-REFINEMENT] AI call failed — using generic fallback question");
  }

  if (!question) {
    question = `O agente de "${pieceType}" encontrou dados insuficientes no briefing. Você pode detalhar melhor o produto ou a audiência para que a NexOS possa gerar este conteúdo?`;
    fieldHint = pieceType;
  }

  // Insert clarification request using existing system
  const [clarification] = await db
    .insert(agentClarificationRequestsTable)
    .values({
      campaignId,
      workspaceId,
      agentRole: agentName,
      question,
      options: options.length > 0 ? options : undefined,
      context: `Falha ao gerar: ${pieceType}. Erro: ${errorMessage.slice(0, 200)}`,
      isBriefingGap: true,
      severity: "high",
      status: "pending",
    })
    .returning();

  // Update brainData: waiting_clarification (keeps retryCount, fallback mode stays active)
  const [refreshed] = await db
    .select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!refreshed) return;

  const brainFresh = ((refreshed.brainData ?? {}) as Record<string, unknown>);
  const retryFresh = ((brainFresh["contentRetry"] ?? {}) as Record<string, unknown>);

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainFresh,
        contentRetry: {
          ...retryFresh,
          requiresIntervention: false,
          autocorrectionStatus: "waiting_clarification",
          pendingClarificationId: clarification?.id,
          pendingClarificationField: fieldHint,
          lastAutocorrectionType: "INVALID_INPUT_CONTEXT",
        },
      } as any,
    })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  // Emit real-time event so frontend knows to surface the clarification panel
  emitCampaignEvent({
    campaignId,
    type: "clarification_needed",
    agentType: agentName as any,
    message: `Pergunta necessária para destravar geração de "${pieceType}": ${question.slice(0, 80)}...`,
    data: {
      requestId: clarification?.id,
      pieceType,
      fieldHint,
      autocorrectionType: "INVALID_INPUT_CONTEXT",
    },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId, pieceType, clarificationId: clarification?.id }, "[CONTEXT-REFINEMENT] Clarification request inserted — waiting for user answer");
}
