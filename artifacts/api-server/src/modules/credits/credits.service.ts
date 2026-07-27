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

  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  // Unlimited = DB flag OR owner email is an admin email (authoritative, no flag dependency)
  const flagUnlimited = (ws.settings as Record<string, unknown>)?.unlimitedCredits === true;
  const unlimited = flagUnlimited || await isAdminWorkspace(ws.ownerId);

  if (!unlimited && ws.creditsBalance < cost) {
    throw new InsufficientCreditsError(cost, ws.creditsBalance);
  }

  // For regular accounts: deduct balance. For unlimited: keep balance intact.
  const newBalance = unlimited ? ws.creditsBalance : ws.creditsBalance - cost;

  if (idempotencyKey) {
    // ── [C3-STANDALONE] Atomic idempotency via INSERT ON CONFLICT DO NOTHING + db.transaction() ──
    //
    // All three mutations (tx INSERT, balance UPDATE, campaign counter UPDATE) run inside a single
    // Postgres transaction so they are commit-or-rollback together:
    //   • If the INSERT conflicts (duplicate key) → we return early inside the txn (nothing committed)
    //     and fetch + return the existing transaction record after the txn closes.
    //   • If the INSERT succeeds but balance/campaign update fails → the txn rolls back, the INSERT
    //     is undone, and the idempotency key is released so a future retry can claim it cleanly.
    //   • Two concurrent requests racing on the same key: only one wins the INSERT; the other gets
    //     DO NOTHING and skips balance deduction — Postgres serialises this at the INSERT level.
    let isDuplicate = false;
    let insertedTx: CreditTransaction | undefined;

    await db.transaction(async (trx) => {
      const [claimed] = await trx
        .insert(creditTransactionsTable)
        .values({
          workspaceId,
          campaignId,
          type: "debit" as const,
          action: action as any,
          amount: cost,
          balanceBefore: ws.creditsBalance,
          balanceAfter: newBalance,
          aiProvider,
          tokensUsed,
          costUsd: actualCostUsd?.toString(),
          description: unlimited ? `[∞] ${action.replace(/_/g, " ")}` : action.replace(/_/g, " "),
          idempotencyKey,
        })
        .onConflictDoNothing()
        .returning();

      if (!claimed) {
        isDuplicate = true;
        return; // Early return — nothing mutated, txn commits as a no-op
      }

      insertedTx = claimed;

      if (!unlimited) {
        await trx
          .update(workspacesTable)
          .set({ creditsBalance: newBalance })
          .where(eq(workspacesTable.id, workspaceId));
      }

      if (campaignId) {
        await trx
          .update(campaignsTable)
          .set({ creditsCost: sql`${campaignsTable.creditsCost} + ${cost}` })
          .where(eq(campaignsTable.id, campaignId));
      }
    });

    if (isDuplicate) {
      log.warn(
        { workspaceId, action, idempotencyKey },
        "[C3-STANDALONE] Credit already charged for this action — skipping duplicate deduction (idempotency guard triggered)",
      );
      const [existingTx] = await db
        .select()
        .from(creditTransactionsTable)
        .where(eq(creditTransactionsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      return existingTx!;
    }

    log.info({ workspaceId, action, cost, newBalance, unlimited, idempotencyKey }, "Credits deducted [idempotent]");
    return insertedTx!;
  }

  // ── Standard (non-idempotent) path — original behaviour preserved ──
  if (!unlimited) {
    await db
      .update(workspacesTable)
      .set({ creditsBalance: newBalance })
      .where(eq(workspacesTable.id, workspaceId));
  }

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
      description: unlimited ? `[∞] ${action.replace(/_/g, " ")}` : action.replace(/_/g, " "),
    })
    .returning();

  // Always update per-campaign credit counter when campaignId is provided
  if (campaignId) {
    await db
      .update(campaignsTable)
      .set({ creditsCost: sql`${campaignsTable.creditsCost} + ${cost}` })
      .where(eq(campaignsTable.id, campaignId));
  }

  log.info({ workspaceId, action, cost, newBalance, unlimited }, "Credits deducted");
  return tx;
}

export async function grantCredits(
  workspaceId: string,
  amount: number,
  action: "monthly_reset" | "purchase" | "admin_grant" | "referral_bonus",
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
  return { sufficient: unlimited || balance >= required, balance, required, unlimited };
}
