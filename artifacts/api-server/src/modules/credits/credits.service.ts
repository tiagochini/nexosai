import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  workspacesTable,
  creditTransactionsTable,
  plansTable,
  aiProviderLogsTable,
  campaignsTable,
  CREDIT_COSTS,
  type CreditTransaction,
} from "@workspace/db";
import { InsufficientCreditsError, NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";

export type CreditAction = string & keyof typeof CREDIT_COSTS;

export async function getBalance(workspaceId: string): Promise<number> {
  const [ws] = await db
    .select({ creditsBalance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);
  if (!ws) throw new NotFoundError("Workspace");
  return ws.creditsBalance;
}

export async function deductCredits(
  workspaceId: string,
  action: CreditAction,
  log: Logger,
  campaignId?: string,
  aiProvider?: string,
  tokensUsed?: number,
  actualCostUsd?: number,
): Promise<CreditTransaction> {
  const cost = CREDIT_COSTS[action];
  if (cost === undefined) throw new Error(`Unknown credit action: ${action}`);

  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  if (ws.creditsBalance < cost) {
    throw new InsufficientCreditsError(cost, ws.creditsBalance);
  }

  const newBalance = ws.creditsBalance - cost;

  await db
    .update(workspacesTable)
    .set({ creditsBalance: newBalance })
    .where(eq(workspacesTable.id, workspaceId));

  const [tx] = await db
    .insert(creditTransactionsTable)
    .values({
      workspaceId,
      campaignId,
      type: "debit",
      action: action as any,
      amount: cost,
      balanceBefore: ws.creditsBalance,
      balanceAfter: newBalance,
      aiProvider,
      tokensUsed,
      costUsd: actualCostUsd?.toString(),
      description: `${action.replace(/_/g, " ")}`,
    })
    .returning();

  log.info({ workspaceId, action, cost, newBalance }, "Credits deducted");

  return tx;
}

export async function grantCredits(
  workspaceId: string,
  amount: number,
  action: "monthly_reset" | "purchase" | "admin_grant",
  log: Logger,
  description?: string,
): Promise<CreditTransaction> {
  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  const newBalance = ws.creditsBalance + amount;

  await db
    .update(workspacesTable)
    .set({ creditsBalance: newBalance })
    .where(eq(workspacesTable.id, workspaceId));

  const [tx] = await db
    .insert(creditTransactionsTable)
    .values({
      workspaceId,
      type: "credit",
      action: action as any,
      amount,
      balanceBefore: ws.creditsBalance,
      balanceAfter: newBalance,
      description: description ?? action.replace(/_/g, " "),
    })
    .returning();

  log.info({ workspaceId, action, amount, newBalance }, "Credits granted");

  return tx;
}

export async function resetMonthlyCredits(
  workspaceId: string,
  log: Logger,
): Promise<void> {
  const [ws] = await db
    .select({ planId: workspacesTable.planId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  const [plan] = await db
    .select({ creditsMonthly: plansTable.creditsMonthly })
    .from(plansTable)
    .where(eq(plansTable.id, ws.planId))
    .limit(1);

  if (!plan) throw new NotFoundError("Plan");

  await db
    .update(workspacesTable)
    .set({
      creditsBalance: plan.creditsMonthly,
      creditsLastReset: new Date(),
    })
    .where(eq(workspacesTable.id, workspaceId));

  await db.insert(creditTransactionsTable).values({
    workspaceId,
    type: "credit",
    action: "monthly_reset",
    amount: plan.creditsMonthly,
    balanceBefore: 0,
    balanceAfter: plan.creditsMonthly,
    description: "Monthly credit renewal",
  });

  log.info(
    { workspaceId, credits: plan.creditsMonthly },
    "Monthly credits reset",
  );
}

export async function getTransactionHistory(
  workspaceId: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  return db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, workspaceId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(limit);
}

export interface AgentUsageEntry {
  id: string;
  agentType: string | null;
  provider: string;
  model: string;
  creditsCharged: number;
  costUsd: string;
  latencyMs: number | null;
  campaignId: string | null;
  campaignName: string | null;
  createdAt: Date;
}

export interface AgentUsageSummary {
  entries: AgentUsageEntry[];
  totalCredits: number;
  totalCostUsd: string;
  byAgent: { agentType: string; credits: number; calls: number }[];
  byCampaign: { campaignId: string | null; campaignName: string | null; credits: number; calls: number }[];
}

export async function getAgentUsageHistory(
  workspaceId: string,
  limit = 100,
): Promise<AgentUsageSummary> {
  const rows = await db
    .select({
      id: aiProviderLogsTable.id,
      agentType: aiProviderLogsTable.agentType,
      provider: aiProviderLogsTable.provider,
      model: aiProviderLogsTable.model,
      creditsCharged: aiProviderLogsTable.creditsCharged,
      costUsd: aiProviderLogsTable.costUsd,
      latencyMs: aiProviderLogsTable.latencyMs,
      campaignId: aiProviderLogsTable.campaignId,
      campaignName: campaignsTable.title,
      createdAt: aiProviderLogsTable.createdAt,
    })
    .from(aiProviderLogsTable)
    .leftJoin(campaignsTable, eq(aiProviderLogsTable.campaignId, campaignsTable.id))
    .where(eq(aiProviderLogsTable.workspaceId, workspaceId))
    .orderBy(desc(aiProviderLogsTable.createdAt))
    .limit(limit);

  const entries: AgentUsageEntry[] = rows.map(r => ({
    id: r.id,
    agentType: r.agentType,
    provider: r.provider,
    model: r.model,
    creditsCharged: r.creditsCharged,
    costUsd: String(r.costUsd),
    latencyMs: r.latencyMs,
    campaignId: r.campaignId ?? null,
    campaignName: (r.campaignName as string | null) ?? null,
    createdAt: r.createdAt,
  }));

  const totalCredits = entries.reduce((s, e) => s + e.creditsCharged, 0);
  const totalCostUsd = entries.reduce((s, e) => s + parseFloat(e.costUsd), 0).toFixed(4);

  const agentMap = new Map<string, { credits: number; calls: number }>();
  const campaignMap = new Map<string, { campaignName: string | null; credits: number; calls: number }>();

  for (const e of entries) {
    const key = e.agentType ?? "desconhecido";
    const a = agentMap.get(key) ?? { credits: 0, calls: 0 };
    a.credits += e.creditsCharged;
    a.calls += 1;
    agentMap.set(key, a);

    const ck = e.campaignId ?? "__none__";
    const c = campaignMap.get(ck) ?? { campaignName: e.campaignName, credits: 0, calls: 0 };
    c.credits += e.creditsCharged;
    c.calls += 1;
    campaignMap.set(ck, c);
  }

  const byAgent = Array.from(agentMap.entries())
    .map(([agentType, v]) => ({ agentType, ...v }))
    .sort((a, b) => b.credits - a.credits);

  const byCampaign = Array.from(campaignMap.entries())
    .map(([campaignId, v]) => ({
      campaignId: campaignId === "__none__" ? null : campaignId,
      campaignName: v.campaignName,
      credits: v.credits,
      calls: v.calls,
    }))
    .sort((a, b) => b.credits - a.credits);

  return { entries, totalCredits, totalCostUsd, byAgent, byCampaign };
}

export async function checkCredits(
  workspaceId: string,
  action: CreditAction,
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  const balance = await getBalance(workspaceId);
  const required = CREDIT_COSTS[action] ?? 0;
  return { sufficient: balance >= required, balance, required };
}
