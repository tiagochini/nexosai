import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import {
  reverseBudget,
  type ReverseBudgetResult,
  type CampaignModelType,
  type ProductCategory,
} from "../intake/intake.simulation.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

export type { ReverseBudgetResult };

function toSimulationCampaignType(raw: string): CampaignModelType {
  const map: Record<string, CampaignModelType> = {
    launch: "launch",
    perpetual: "perpetual_launch",
    perpetual_launch: "perpetual_launch",
    flash_sale: "flash_sale",
    live_sale: "live_sale",
    continuous: "continuous_sales",
    continuous_sales: "continuous_sales",
    authority: "authority",
    audience_growth: "audience_growth",
    subscription_growth: "subscription_growth",
    affiliate: "affiliate",
  };
  return map[raw] ?? "launch";
}

function toProductCategory(intakeData: Record<string, unknown>): ProductCategory {
  const rawType = String(
    intakeData["product.category"] ??
    intakeData["campaign.productCategory"] ??
    intakeData["campaign.type"] ??
    "infoproduct",
  ).toLowerCase();

  if (rawType.includes("ecom")) return "ecommerce";
  if (rawType.includes("mentor")) return "mentorship";
  if (rawType.includes("saas") || rawType.includes("software")) return "software";
  if (rawType.includes("service") || rawType.includes("servic")) return "service";
  if (rawType.includes("communit") || rawType.includes("comunid")) return "community";
  if (rawType.includes("event") || rawType.includes("evento")) return "event";
  return "infoproduct";
}

export async function calculateReverseBudget(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<ReverseBudgetResult | null> {
  const revenueTarget = Number(intakeData["campaign.revenueTarget"] ?? 0);
  const productPrice = Number(
    intakeData["product.price"] ??
    intakeData["campaign.productPrice"] ??
    intakeData["campaign.price"] ??
    0,
  );
  const campaignType = String(intakeData["campaign.type"] ?? "launch");

  if (revenueTarget <= 0) {
    log.warn({ campaignId }, "[BUDGET-REVERSE] No revenueTarget — cannot reverse-engineer budget");
    return null;
  }

  if (productPrice <= 0) {
    log.warn({ campaignId, revenueTarget }, "[BUDGET-REVERSE] No productPrice — cannot reverse-engineer budget");
    return null;
  }

  const simType = toSimulationCampaignType(campaignType);
  const category = toProductCategory(intakeData);

  const result = reverseBudget(revenueTarget, productPrice, simType, category);

  log.info(
    { campaignId, budgetMid: result.budgetMid, impliedROAS: result.impliedROAS, salesNeeded: result.salesNeeded },
    "[BUDGET-REVERSE] Reverse budget calculated",
  );

  return result;
}

export async function saveBudgetProposal(
  campaignId: string,
  workspaceId: string,
  proposal: ReverseBudgetResult,
  log: Logger,
): Promise<void> {
  const [row] = await db
    .select({ brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  const existing = ((row?.brainData ?? {}) as Record<string, unknown>);

  await db
    .update(campaignsTable)
    .set({ brainData: { ...existing, budgetProposal: proposal } as any, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  emitCampaignEvent({
    campaignId,
    type: "budget_proposal",
    agentType: "budget_reverse",
    message:
      `Engenharia Reversa de Orçamento — budget estimado ` +
      `R$${proposal.budgetMid.toLocaleString("pt-BR")} ` +
      `(ROAS implícito ${proposal.impliedROAS}x) ` +
      `para meta de R$${proposal.revenueTarget.toLocaleString("pt-BR")}. ` +
      `Targeting e Media Buying gerados com budget proposto — aguardando confirmação.`,
    data: {
      budgetMin: proposal.budgetMin,
      budgetMid: proposal.budgetMid,
      budgetPessimistic: proposal.budgetPessimistic,
      impliedROAS: proposal.impliedROAS,
      impliedCPL: proposal.impliedCPL,
      salesNeeded: proposal.salesNeeded,
      leadsNeeded: proposal.leadsNeeded,
      reasoning: proposal.reasoning,
      allocationBreakdown: proposal.allocationBreakdown,
    },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId, budgetMid: proposal.budgetMid }, "[BUDGET-REVERSE] Proposal saved to brainData + Socket.io emitted");
}
