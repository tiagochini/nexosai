import { eq } from "drizzle-orm";
import { db, paidMediaAccountsTable } from "@workspace/db";
import { syncPaidMediaAccount } from "./sync.service.js";
import { logger } from "../../lib/logger.js";
import { registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";
import { conditionalExecutionTick } from "./conditional-execution.service.js";

import { capiRetryTick } from "./capi-retry.service.js";
import { expireAudienceOperations } from "./meta-audience.service.js";
import { crmSyncTick } from "./meta-crm-sync.service.js";
import { expireExperimentExecutions } from "./meta-experiments.service.js";
import { expireCapiTests } from "./meta-capi-tests.service.js";

let timer: ReturnType<typeof setInterval> | null = null;
async function tick() {
  await conditionalExecutionTick();
  const accounts = await db.select().from(paidMediaAccountsTable).where(eq(paidMediaAccountsTable.isSelected, true));
  await Promise.all(accounts.map(async (account) => {
    try {
      const until = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      await syncPaidMediaAccount(account.workspaceId, account.id, since, until);
       // M08 conditional execution is the sole automatic execution boundary.
       // This legacy sync worker must never turn an approval into a provider call.
    } catch (error) { logger.error({ accountId: account.id, err: error }, "Paid-media account scheduler failed"); }
  }));
}
/** Test-only callable scheduler seam; it never invokes provider code. */
export const runConditionalExecutionTick = conditionalExecutionTick;
export function startPaidMediaScheduler() {
  if (!timer) {
    registerScheduler("paid-media", 60_000);
    registerScheduler("paid-media-capi", 60_000);
    registerScheduler("paid-media-audience-retention", 60_000);
    registerScheduler("paid-media-crm-sync", 60_000);
    registerScheduler("paid-media-experiment-recovery", 60_000);
    timer = setInterval(() => {
      void runSchedulerTick("paid-media-crm-sync", crmSyncTick).catch(() => logger.error("CRM audience sync tick failed"));
      void runSchedulerTick("paid-media-experiment-recovery", async () => { await expireExperimentExecutions(); await expireCapiTests(); }).catch(() => logger.error("Diagnostic recovery tick failed"));
      void runSchedulerTick("paid-media-audience-retention", expireAudienceOperations).catch(() => logger.error("Audience retention scheduler tick failed"));
      void runSchedulerTick("paid-media-capi", () => capiRetryTick()).catch(() => logger.error("CAPI retry scheduler tick failed"));
      void runSchedulerTick("paid-media", tick).catch(() => logger.error("Paid-media scheduler tick failed"));
      }, 60_000);
    logger.info("Paid-media scheduler started");
  }
}
export function stopPaidMediaScheduler() { if (timer) { clearInterval(timer); timer = null; } }
