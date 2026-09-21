import { and, eq } from "drizzle-orm";
import { db, paidMediaAccountsTable, paidMediaPoliciesTable, paidMediaProposalsTable } from "@workspace/db";
import { executeProposal } from "./actions.service.js";
import { syncPaidMediaAccount } from "./sync.service.js";
import { logger } from "../../lib/logger.js";
import { registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";

let timer: ReturnType<typeof setInterval> | null = null;
async function tick() {
  const accounts = await db.select().from(paidMediaAccountsTable).where(eq(paidMediaAccountsTable.isSelected, true));
  await Promise.all(accounts.map(async (account) => {
    try {
      const until = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      await syncPaidMediaAccount(account.workspaceId, account.id, since, until);
      const [policy] = await db.select().from(paidMediaPoliciesTable).where(and(eq(paidMediaPoliciesTable.workspaceId, account.workspaceId), eq(paidMediaPoliciesTable.accountId, account.id), eq(paidMediaPoliciesTable.autoExecute, true))).limit(1);
      if (!policy) return;
      const proposals = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.workspaceId, account.workspaceId), eq(paidMediaProposalsTable.accountId, account.id), eq(paidMediaProposalsTable.status, "approved")));
      for (const proposal of proposals) try { await executeProposal(account.workspaceId, proposal.id); } catch (error) { logger.warn({ proposalId: proposal.id, err: error }, "Paid-media automatic execution skipped"); }
    } catch (error) { logger.error({ accountId: account.id, err: error }, "Paid-media account scheduler failed"); }
  }));
}
export function startPaidMediaScheduler() {
  if (!timer) {
    registerScheduler("paid-media", 15 * 60_000);
    timer = setInterval(() => {
      void runSchedulerTick("paid-media", tick).catch(() => logger.error("Paid-media scheduler tick failed"));
    }, 15 * 60_000);
    logger.info("Paid-media scheduler started");
  }
}
export function stopPaidMediaScheduler() { if (timer) { clearInterval(timer); timer = null; } }