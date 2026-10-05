import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  workspacesTable,
  usersTable,
  creditTransactionsTable,
  plansTable,
  aiProviderLogsTable,
  campaignsTable,
  CREDIT_COSTS,
  type CreditTransaction,
} from "@workspace/db";
import { InsufficientCreditsError, NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";

// Founder/admin emails always have unlimited credits — checked directly against
// the users table so it works even if the DB settings flag was never set.
const ADMIN_EMAILS = new Set([
  "admin@nexos.ai",
  "founder@nexos.ai",
  "admin@agencianexos.vip",
  "founder@agencianexos.vip",
]);

async function isAdminWorkspace(workspaceOwnerId: string): Promise<boolean> {
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, workspaceOwnerId))
    .limit(1);
  return user ? ADMIN_EMAILS.has(user.email) : false;
}

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
  idempotencyKey?: string,
): Promise<CreditTransaction> {
  const cost = CREDIT_COSTS[action];
  if (cost === undefined) throw new Error(`Unknown credit action: ${action}`);

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) throw new NotFoundError("Workspace");

  // Unlimited = DB flag OR owner email is an admin email (authoritative, no flag dependency)
  const adminWorkspace = await isAdminWorkspace(workspace.ownerId);
  let duplicateTx: CreditTransaction | undefined;
  let insertedTx: CreditTransaction | undefined;
  let newBalance = workspace.creditsBalance;
  let unlimited = false;

  // The workspace row lock serializes charges with different idempotency keys.
  // An idempotency unique constraint only serializes equal keys; without this lock
  // two distinct keys could both write a balance calculated from the same stale read.
  await db.transaction(async (trx) => {
    const [ws] = await trx
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1)
      .for("update");

    if (!ws) throw new NotFoundError("Workspace");

    if (idempotencyKey) {
      const [existing] = await trx
        .select()
        .from(creditTransactionsTable)
        .where(eq(creditTransactionsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing) {
        duplicateTx = existing;
        return;
      }
    }

    if (ws.creditsBalance < 0) throw new InsufficientCreditsError(cost, ws.creditsBalance);
    unlimited = (ws.settings as Record<string, unknown>)?.unlimitedCredits === true || adminWorkspace;
    if (!unlimited && ws.creditsBalance < cost) {
      throw new InsufficientCreditsError(cost, ws.creditsBalance);
    }

    const balanceBefore = ws.creditsBalance;
    newBalance = unlimited ? balanceBefore : balanceBefore - cost;

    if (!unlimited) {
      await trx
        .update(workspacesTable)
        .set({ creditsBalance: newBalance })
        .where(eq(workspacesTable.id, workspaceId));
    }

    const [inserted] = await trx
      .insert(creditTransactionsTable)
      .values({
        workspaceId,
        campaignId,
        type: "debit",
        action: action as any,
        amount: cost,
        balanceBefore,
        balanceAfter: newBalance,
        aiProvider,
        tokensUsed,
        costUsd: actualCostUsd?.toString(),
        description: unlimited ? `[∞] ${action.replace(/_/g, " ")}` : action.replace(/_/g, " "),
        idempotencyKey,
      })
      .onConflictDoNothing()
      .returning();

    // This can only occur if a caller reused a key from another workspace.
    // Roll back the balance mutation rather than silently charging this workspace.
    if (!inserted) {
      throw new Error(`Credit idempotency key is already in use: ${idempotencyKey}`);
    }
    insertedTx = inserted;

    if (campaignId) {
      await trx
        .update(campaignsTable)
        .set({ creditsCost: sql`${campaignsTable.creditsCost} + ${cost}` })
        .where(eq(campaignsTable.id, campaignId));
    }
  });

  if (duplicateTx) {
      log.warn(
        { workspaceId, action, idempotencyKey },
        "[C3-STANDALONE] Credit already charged for this action — skipping duplicate deduction (idempotency guard triggered)",
      );
      return duplicateTx;
  }

  log.info({ workspaceId, action, cost, newBalance, unlimited, idempotencyKey }, "Credits deducted");
  return insertedTx!;
}

type CreditDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function grantCreditsInTransaction(
  trx: CreditDbTransaction,
  workspaceId: string,
  amount: number,
  action: "monthly_reset" | "purchase" | "admin_grant" | "referral_bonus",
  description?: string,
  idempotencyKey?: string,
): Promise<CreditTransaction> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid credit grant amount");
  const [ws] = await trx
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1)
    .for("update");

  if (!ws) throw new NotFoundError("Workspace");

  if (idempotencyKey) {
    const [existing] = await trx.select().from(creditTransactionsTable)
      .where(eq(creditTransactionsTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) {
      if (existing.workspaceId !== workspaceId || existing.type !== "credit" || existing.amount !== amount || existing.action !== action) {
        throw new Error("Credit grant idempotency conflict");
      }
      return existing;
    }
  }

  const newBalance = ws.creditsBalance + amount;
  if (!Number.isSafeInteger(newBalance) || newBalance > 2_147_483_647) throw new Error("Credit balance exceeds supported range");

  await trx
    .update(workspacesTable)
    .set({ creditsBalance: newBalance })
    .where(eq(workspacesTable.id, workspaceId));

  const [tx] = await trx
    .insert(creditTransactionsTable)
    .values({
      workspaceId,
      type: "credit",
      action: action as any,
      amount,
      balanceBefore: ws.creditsBalance,
      balanceAfter: newBalance,
      description: description ?? action.replace(/_/g, " "),
      idempotencyKey,
    })
    .returning();

  return tx!;
}

export async function grantCredits(
  workspaceId: string,
  amount: number,
  action: "monthly_reset" | "purchase" | "admin_grant" | "referral_bonus",
  log: Logger,
  description?: string,
  idempotencyKey?: string,
): Promise<CreditTransaction> {
  const tx = await db.transaction((trx) => grantCreditsInTransaction(trx, workspaceId, amount, action, description, idempotencyKey));
  log.info({ workspaceId, action, amount, newBalance: tx.balanceAfter }, "Credit grant reconciled");
  return tx;
}

export async function resetMonthlyCredits(
  workspaceId: string,
  log: Logger,
): Promise<void> {
  await db.transaction(async (trx) => {
    const [ws] = await trx.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).for("update");
    if (!ws) throw new NotFoundError("Workspace");
    const resetKey = `monthly-reset:${workspaceId}:${new Date().toISOString().slice(0, 7)}`;
    const [alreadyReset] = await trx.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.idempotencyKey, resetKey));
    if (alreadyReset) return;
    const [plan] = await trx.select().from(plansTable).where(eq(plansTable.id, ws.planId));
    if (!plan) throw new NotFoundError("Plan");
    // New monthly allocation repays debt; renewal must never erase refund debt.
    const balanceAfter = ws.creditsBalance < 0 ? ws.creditsBalance + plan.creditsMonthly : plan.creditsMonthly;
    await trx.update(workspacesTable).set({ creditsBalance: balanceAfter, creditsLastReset: new Date() }).where(eq(workspacesTable.id, workspaceId));
    await trx.insert(creditTransactionsTable).values({ workspaceId, type: "credit", action: "monthly_reset", amount: plan.creditsMonthly, balanceBefore: ws.creditsBalance, balanceAfter, description: "Monthly credit renewal", idempotencyKey: resetKey });
  });
  log.info({ workspaceId }, "Monthly credits reset with debt preserved");
}

export async function reversePurchaseCreditsInTransaction(trx: CreditDbTransaction, workspaceId: string, delta: number, key: string): Promise<void> {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error("Invalid reversal delta");
  const [ws] = await trx.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).for("update");
  if (!ws) throw new NotFoundError("Workspace");
  const [prior] = await trx.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.idempotencyKey, key));
  if (prior) throw new Error("Reversal ledger key already used");
  const balanceAfter = ws.creditsBalance - delta;
  if (!Number.isSafeInteger(balanceAfter) || balanceAfter < -2147483648 || balanceAfter > 2147483647) throw new Error("Reversal balance exceeds supported range");
  await trx.update(workspacesTable).set({ creditsBalance: balanceAfter }).where(eq(workspacesTable.id, workspaceId));
  await trx.insert(creditTransactionsTable).values({ workspaceId, type: delta > 0 ? "debit" : "credit", action: "refund_reversal", amount: Math.abs(delta), balanceBefore: ws.creditsBalance, balanceAfter, idempotencyKey: key, description: delta > 0 ? "Verified payment reversal" : "Verified chargeback release" });
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
): Promise<{ sufficient: boolean; balance: number; required: number; unlimited: boolean }> {
  const [ws] = await db
    .select({ creditsBalance: workspacesTable.creditsBalance, settings: workspacesTable.settings, ownerId: workspacesTable.ownerId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);
  const balance = ws?.creditsBalance ?? 0;
  const flagUnlimited = (ws?.settings as Record<string, unknown>)?.unlimitedCredits === true;
  const unlimited = flagUnlimited || (ws?.ownerId ? await isAdminWorkspace(ws.ownerId) : false);
  const required = CREDIT_COSTS[action] ?? 0;
  return { sufficient: balance >= 0 && (unlimited || balance >= required), balance, required, unlimited: balance >= 0 && unlimited };
}
