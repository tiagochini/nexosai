import { and, eq, lte, sql } from "drizzle-orm";
import { db, academyPurchasesTable, academyAccessEmailOutboxTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { sendAccessEmail } from "./academy.service.js";
import { ACADEMY_PRODUCTS } from "./academy-products.js";
import type { FunnelDeliveryResult } from "./academy-funnel-delivery.js";
import { registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Options = {
  deliver?: (opts: Parameters<typeof sendAccessEmail>[0]) => Promise<FunnelDeliveryResult>;
  productName?: (id: string) => string;
};
export async function enqueueAcademyAccessEmail(trx: Transaction, purchaseId: string, options: { skipReason?: string; purpose?: string } = {}): Promise<void> {
  await trx.insert(academyAccessEmailOutboxTable).values({
    purchaseId, deliveryKey: `initial:${purchaseId}`, purpose: options.purpose ?? "initial",
    ...(options.skipReason ? { status: "skipped" as const, errorCode: options.skipReason } : {}),
  }).onConflictDoNothing({ target: academyAccessEmailOutboxTable.deliveryKey });
}

function boundedError(code: string): string {
  return /^(EMAIL_PROVIDER_NOT_CONFIGURED|RESEND_HTTP_[1-5][0-9]{2}|RESEND_INVALID_RECEIPT|RESEND_TRANSPORT_ERROR|GMAIL_INVALID_RECEIPT|GMAIL_RECIPIENT_NOT_ACCEPTED|GMAIL_TRANSPORT_ERROR)$/.test(code)
    ? code : "EMAIL_DELIVERY_UNKNOWN";
}

export async function dispatchAcademyAccessEmail(purchaseId: string, options: Options = {}): Promise<boolean> {
  const now = new Date();
  const [job] = await db.update(academyAccessEmailOutboxTable).set({
    status: "sending", claimedAt: now, updatedAt: now,
    attempts: sql`${academyAccessEmailOutboxTable.attempts} + 1`,
  }).where(and(eq(academyAccessEmailOutboxTable.purchaseId, purchaseId),
    eq(academyAccessEmailOutboxTable.status, "scheduled"), lte(academyAccessEmailOutboxTable.nextAttemptAt, sql`now()`))).returning();
  if (!job) return false;
  const [purchase] = await db.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.id, purchaseId));
  if (!purchase || purchase.status !== "confirmed" || purchase.revokedAt || purchase.financialHold) {
    await db.update(academyAccessEmailOutboxTable).set({ status: "skipped", errorCode: "PURCHASE_NOT_CONFIRMED", updatedAt: new Date() })
      .where(and(eq(academyAccessEmailOutboxTable.id, job.id), eq(academyAccessEmailOutboxTable.status, "sending")));
    return true;
  }
  let result: FunnelDeliveryResult;
  try {
    result = await (options.deliver ?? sendAccessEmail)({
      email: purchase.customerEmail, name: purchase.customerName ?? purchase.customerEmail,
      token: purchase.accessToken,
      productName: options.productName?.(purchase.productId) ?? ACADEMY_PRODUCTS[purchase.productId]?.name ?? purchase.productId,
      portalUrl: `${env.APP_URL}/nexos-academy/`,
    });
  } catch {
    result = { status: "sending", errorCode: "EMAIL_DELIVERY_UNKNOWN" };
  }
  // Only "provider not configured" proves no transport was attempted and is
  // safe to reschedule automatically. All unknown outcomes remain quarantined.
  if (result.status === "sent" && (!result.providerId?.trim() || result.providerId.length > 100)) {
    result = { status: "sending", errorCode: "EMAIL_DELIVERY_UNKNOWN" };
  }
  const status = result.status === "scheduled" && result.errorCode !== "EMAIL_PROVIDER_NOT_CONFIGURED" ? "sending" : result.status;
  await db.update(academyAccessEmailOutboxTable).set({
    status, updatedAt: new Date(),
    sentAt: result.status === "sent" ? new Date() : null,
    providerId: result.status === "sent" ? result.providerId : null,
    errorCode: result.status === "sent" ? null : boundedError(result.errorCode),
    ...(status === "scheduled" ? { nextAttemptAt: sql`now() + interval '5 minutes'`, claimedAt: null } : {}),
  }).where(and(eq(academyAccessEmailOutboxTable.id, job.id), eq(academyAccessEmailOutboxTable.status, "sending")));
  logger.info({ jobId: job.id, status }, "academy: access outbox attempt completed");
  return true;
}

export async function runAcademyAccessOutboxTick(options: Options & { purchaseId?: string } = {}): Promise<number> {
  const jobs = await db.select({ purchaseId: academyAccessEmailOutboxTable.purchaseId }).from(academyAccessEmailOutboxTable)
    .where(and(eq(academyAccessEmailOutboxTable.status, "scheduled"), lte(academyAccessEmailOutboxTable.nextAttemptAt, sql`now()`),
      options.purchaseId ? eq(academyAccessEmailOutboxTable.purchaseId, options.purchaseId) : undefined))
    .orderBy(academyAccessEmailOutboxTable.nextAttemptAt, academyAccessEmailOutboxTable.id).limit(20);
  let dispatched = 0;
  for (const job of jobs) if (await dispatchAcademyAccessEmail(job.purchaseId, options)) dispatched++;
  return dispatched;
}

let timer: NodeJS.Timeout | undefined;
export function startAcademyAccessOutboxScheduler(): void {
  if (timer) return;
  registerScheduler("academy-access-email", 5 * 60_000);
  const tick = () => void runSchedulerTick("academy-access-email", async () => { await runAcademyAccessOutboxTick(); })
    .catch((err) => logger.error({ err }, "academy: access outbox scheduler failed"));
  timer = setInterval(tick, 60_000);
  tick();
}
export function stopAcademyAccessOutboxScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
