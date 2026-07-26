import { eq, and, inArray } from "drizzle-orm";
import { db, campaignsTable, contentPiecesTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { runTargetingAgent, type TargetingOutput } from "../agents/targeting.agent.js";
import { runMediaBuyerAgent } from "../agents/media-buyer.agent.js";
import type { Logger } from "pino";
import type { ReverseBudgetResult } from "./budget-reverse.service.js";

export interface BudgetDecisionParams {
  campaignId: string;
  workspaceId: string;
  decision: "approve_proposed" | "enter_own" | "organic_only" | "seed_launch";
  budget?: number;
  budgetFrequency?: "daily" | "weekly" | "total";
  log: Logger;
}

export interface BudgetDecisionResult {
  success: boolean;
  message: string;
  piecesRegenerated: number;
  effectiveBudget: number;
}

async function loadBrainData(campaignId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));
  return (row?.brainData ?? {}) as Record<string, unknown>;
}

async function loadIntakeData(campaignId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ intakeData: (campaignsTable as any).intakeData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));
  return (row?.intakeData ?? {}) as Record<string, unknown>;
}

async function loadStrategyAndProfile(campaignId: string) {
  const [row] = await db
    .select({ brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  const brain = (row?.brainData ?? {}) as Record<string, unknown>;
  const strategy = (brain["strategyData"] ?? {}) as Record<string, unknown>;
  const profile = (brain["profileData"] ?? undefined) as Record<string, unknown> | undefined;
  const launchPlan = (brain["launchPlan"] ?? undefined) as Record<string, unknown> | undefined;
  return { strategy, profile, launchPlan };
}

async function deleteExistingBudgetProposedPieces(
  campaignId: string,
  workspaceId: string,
): Promise<number> {
  const deleted = await db
    .delete(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.workspaceId, workspaceId),
        eq(contentPiecesTable.status, "budget_proposed"),
        inArray(contentPiecesTable.type, ["targeting_config", "media_buying_plan"]),
      ),
    )
    .returning({ id: contentPiecesTable.id });
  return deleted.length;
}

async function saveBudgetToIntake(
  campaignId: string,
  trafficBudget: number,
  log: Logger,
): Promise<void> {
  const [row] = await db
    .select({ intakeData: (campaignsTable as any).intakeData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  const existing = ((row?.intakeData ?? {}) as Record<string, unknown>);
  await db
    .update(campaignsTable)
    .set({
      intakeData: {
        ...existing,
        "campaign.budget.traffic": trafficBudget,
        "campaign.budget.traffic_confirmed": true,
        "campaign.budget.traffic_confirmed_at": new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, campaignId));

  log.info({ campaignId, trafficBudget }, "[BUDGET-DECISION] Confirmed budget saved to intakeData");
}

async function clearBudgetProposalFromBrain(
  campaignId: string,
  log: Logger,
): Promise<void> {
  const brain = await loadBrainData(campaignId);
  const { budgetProposal: _removed, ...rest } = brain;
  await db
    .update(campaignsTable)
    .set({ brainData: rest as any, updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));
  log.info({ campaignId }, "[BUDGET-DECISION] budgetProposal cleared from brainData");
}

async function rerunTrafficAgents(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  trafficBudget: number,
  log: Logger,
): Promise<{ targetingPieceId?: string; mediaBuyingPieceId?: string }> {
  const agentIntakeData = {
    ...intakeData,
    "campaign.budget.traffic": trafficBudget,
    "campaign.budget.traffic_confirmed": true,
  };

  const { strategy, profile, launchPlan } = await loadStrategyAndProfile(campaignId);

  let capturedTargetingOutput: TargetingOutput | undefined;
  let targetingPieceId: string | undefined;
  let mediaBuyingPieceId: string | undefined;

  emitCampaignEvent({
    campaignId,
    type: "agent_started",
    agentType: "targeting",
    message: `Regenerando Targeting com budget confirmado R$${trafficBudget.toLocaleString("pt-BR")}...`,
    timestamp: new Date().toISOString(),
  });

  try {
    const targetingOutput = await runTargetingAgent(
      campaignId,
      workspaceId,
      agentIntakeData,
      profile as any,
      log,
    );
    capturedTargetingOutput = targetingOutput;

    const [tPiece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "targeting_config",
        status: "pending_approval",
        title: `Configuração de Audiências — ${(targetingOutput.metaAudiences?.length ?? 0)} Meta + ${(targetingOutput.googleAudiences?.length ?? 0)} Google + ${(targetingOutput.tiktokAudiences?.length ?? 0)} TikTok`,
        content: targetingOutput as any,
        aiProvider: "openai",
        creditsUsed: 55,
      })
      .returning();

    targetingPieceId = tPiece?.id;

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "targeting",
      message: `Targeting regenerado — budget confirmado R$${trafficBudget.toLocaleString("pt-BR")}`,
      data: { pieceId: tPiece?.id },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error({ err, campaignId }, "[BUDGET-DECISION] Targeting re-run failed");
    emitCampaignEvent({
      campaignId,
      type: "agent_failed",
      agentType: "targeting",
      message: `Erro ao regenerar Targeting: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });
  }

  emitCampaignEvent({
    campaignId,
    type: "agent_started",
    agentType: "media_buyer",
    message: `Regenerando Media Buying com budget confirmado R$${trafficBudget.toLocaleString("pt-BR")}...`,
    timestamp: new Date().toISOString(),
  });

  try {
    const targetingAudiences = capturedTargetingOutput
      ? {
          meta: capturedTargetingOutput.metaAudiences?.length ?? 0,
          google: capturedTargetingOutput.googleAudiences?.length ?? 0,
          tiktok: capturedTargetingOutput.tiktokAudiences?.length ?? 0,
          notes: capturedTargetingOutput.targetingNotes ?? "",
        }
      : undefined;

    const mediaBuyerOutput = await runMediaBuyerAgent(
      campaignId,
      workspaceId,
      agentIntakeData,
      strategy as any,
      profile as any,
      launchPlan as any,
      log,
      targetingAudiences,
    );

    const [mPiece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "media_buying_plan",
        status: "pending_approval",
        title: `Plano de Media Buying — R$${mediaBuyerOutput.totalBudget} | ${mediaBuyerOutput.dailyAllocations.length} dias`,
        content: mediaBuyerOutput as any,
        aiProvider: "openai",
        creditsUsed: 60,
      })
      .returning();

    mediaBuyingPieceId = mPiece?.id;

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "media_buyer",
      message: `Media Buying regenerado — budget confirmado R$${trafficBudget.toLocaleString("pt-BR")}`,
      data: { pieceId: mPiece?.id },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error({ err, campaignId }, "[BUDGET-DECISION] Media buyer re-run failed");
    emitCampaignEvent({
      campaignId,
      type: "agent_failed",
      agentType: "media_buyer",
      message: `Erro ao regenerar Media Buying: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });
  }

  return { targetingPieceId, mediaBuyingPieceId };
}

export async function applyBudgetDecision(params: BudgetDecisionParams): Promise<BudgetDecisionResult> {
  const { campaignId, workspaceId, decision, budget, budgetFrequency, log } = params;

  const [campaignRow] = await db
    .select({
      id: campaignsTable.id,
      workspaceId: campaignsTable.workspaceId,
    })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  if (!campaignRow) throw new AppError(404, "Campaign not found", "NOT_FOUND");

  const intakeData = await loadIntakeData(campaignId);
  const brain = await loadBrainData(campaignId);
  const proposal = brain["budgetProposal"] as ReverseBudgetResult | undefined;

  log.info({ campaignId, decision, budget }, "[BUDGET-DECISION] Applying budget decision");

  if (decision === "organic_only") {
    const deleted = await deleteExistingBudgetProposedPieces(campaignId, workspaceId);
    await clearBudgetProposalFromBrain(campaignId, log);

    const organic_brain = await loadBrainData(campaignId);
    await db
      .update(campaignsTable)
      .set({
        brainData: { ...organic_brain, organicOnly: true, organicOnlySetAt: new Date().toISOString() } as any,
        updatedAt: new Date(),
      })
      .where(eq(campaignsTable.id, campaignId));

    emitCampaignEvent({
      campaignId,
      type: "budget_proposal",
      agentType: "budget_reverse",
      message: `Campanha configurada como orgânica — targeting e media buying não serão gerados. ${deleted > 0 ? `${deleted} peças propostas removidas.` : ""}`,
      data: { organicOnly: true },
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Campanha definida como orgânica. Targeting e Media Buying removidos.",
      piecesRegenerated: 0,
      effectiveBudget: 0,
    };
  }

  if (decision === "approve_proposed") {
    if (!proposal?.budgetMid) {
      throw new AppError(422, "Sem proposta de budget ativa para aprovar", "NO_BUDGET_PROPOSAL");
    }
    const effectiveBudget = proposal.budgetMid;
    const deleted = await deleteExistingBudgetProposedPieces(campaignId, workspaceId);
    await saveBudgetToIntake(campaignId, effectiveBudget, log);
    await clearBudgetProposalFromBrain(campaignId, log);

    setImmediate(() => {
      rerunTrafficAgents(campaignId, workspaceId, { ...intakeData, "campaign.budget.traffic": effectiveBudget }, effectiveBudget, log)
        .catch(err => log.error({ err, campaignId }, "[BUDGET-DECISION] Async re-run failed"));
    });

    return {
      success: true,
      message: `Budget R$${effectiveBudget.toLocaleString("pt-BR")} aprovado. ${deleted > 0 ? `${deleted} peças antigas removidas. ` : ""}Regenerando targeting e media buying...`,
      piecesRegenerated: deleted,
      effectiveBudget,
    };
  }

  if (decision === "enter_own") {
    if (!budget || budget <= 0) {
      throw new AppError(422, "Budget inválido — informe um valor positivo", "INVALID_BUDGET");
    }

    let effectiveBudget = budget;
    if (budgetFrequency === "daily") {
      effectiveBudget = budget * 30;
    } else if (budgetFrequency === "weekly") {
      effectiveBudget = budget * 4;
    }

    const deleted = await deleteExistingBudgetProposedPieces(campaignId, workspaceId);
    await saveBudgetToIntake(campaignId, effectiveBudget, log);
    await clearBudgetProposalFromBrain(campaignId, log);

    const revenueTarget = Number(intakeData["campaign.revenueTarget"] ?? 0);
    const impliedROAS = revenueTarget > 0 && effectiveBudget > 0
      ? Math.round((revenueTarget / effectiveBudget) * 10) / 10
      : null;

    if (impliedROAS !== null && impliedROAS > 20) {
      log.warn({ campaignId, impliedROAS, effectiveBudget, revenueTarget }, "[BUDGET-DECISION] ROAS implícito muito alto (>20x) — budget pode ser insuficiente");
    }

    setImmediate(() => {
      rerunTrafficAgents(campaignId, workspaceId, { ...intakeData, "campaign.budget.traffic": effectiveBudget }, effectiveBudget, log)
        .catch(err => log.error({ err, campaignId }, "[BUDGET-DECISION] Async re-run failed"));
    });

    return {
      success: true,
      message: `Budget R$${effectiveBudget.toLocaleString("pt-BR")} (${budgetFrequency ?? "total"}) confirmado. ${impliedROAS !== null ? `ROAS implícito: ${impliedROAS}x. ` : ""}${deleted > 0 ? `${deleted} peças antigas removidas. ` : ""}Regenerando targeting e media buying...`,
      piecesRegenerated: deleted,
      effectiveBudget,
    };
  }

  if (decision === "seed_launch") {
    const baseBudget = budget ?? (proposal?.budgetMid ?? 0);
    if (baseBudget <= 0) {
      throw new AppError(422, "Informe um budget base ou aprove a proposta antes de usar o plano semente", "INVALID_BUDGET");
    }

    const week1 = Math.round(baseBudget * 0.3);
    const week2 = Math.round(baseBudget * 0.6);
    const week3 = baseBudget;

    const seedIntakeData = {
      ...intakeData,
      "campaign.budget.traffic": baseBudget,
      "campaign.budget.traffic_confirmed": true,
      "campaign.budget.seed_launch": true,
      "campaign.budget.seed_schedule": { week1, week2, week3 },
    };

    const deleted = await deleteExistingBudgetProposedPieces(campaignId, workspaceId);
    await saveBudgetToIntake(campaignId, baseBudget, log);
    await clearBudgetProposalFromBrain(campaignId, log);

    const seedBrain = await loadBrainData(campaignId);
    await db
      .update(campaignsTable)
      .set({
        brainData: {
          ...seedBrain,
          seedLaunch: { baseBudget, week1, week2, week3, setAt: new Date().toISOString() },
        } as any,
        updatedAt: new Date(),
      })
      .where(eq(campaignsTable.id, campaignId));

    setImmediate(() => {
      rerunTrafficAgents(campaignId, workspaceId, seedIntakeData, baseBudget, log)
        .catch(err => log.error({ err, campaignId }, "[BUDGET-DECISION] Seed launch re-run failed"));
    });

    return {
      success: true,
      message: `Plano semente ativado: semana 1 R$${week1.toLocaleString("pt-BR")} → semana 2 R$${week2.toLocaleString("pt-BR")} → semana 3 R$${week3.toLocaleString("pt-BR")}. ${deleted > 0 ? `${deleted} peças antigas removidas. ` : ""}Regenerando targeting e media buying com progressão de orçamento...`,
      piecesRegenerated: deleted,
      effectiveBudget: baseBudget,
    };
  }

  throw new AppError(422, `Decisão inválida: ${decision}`, "INVALID_DECISION");
}
