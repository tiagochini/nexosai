import { eq, desc } from "drizzle-orm";
import {
  db,
  workspacesTable,
  creditTransactionsTable,
  plansTable,
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

export async function checkCredits(
  workspaceId: string,
  action: CreditAction,
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  const balance = await getBalance(workspaceId);
  const required = CREDIT_COSTS[action] ?? 0;
  return { sufficient: balance >= required, balance, required };
}
