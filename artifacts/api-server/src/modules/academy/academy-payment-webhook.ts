import type { RequestHandler } from "express";
import { z } from "zod/v4";
import { checkAcademyWebhook } from "./academy-webhook.security.js";
import { confirmAcademyPayment, reconcileAcademyReversal, reconcileAcademyIfHeld } from "./academy-settlement.service.js";
import { REVERSAL_EVENTS } from "../../lib/asaas-refunds.js";
import { sendAccessEmail } from "./academy.service.js";
import { dispatchAcademyAccessEmail } from "./academy-access-outbox.service.js";
import type { FunnelDeliveryResult } from "./academy-funnel-delivery.js";
import { logger } from "../../lib/logger.js";

const eventSchema = z.object({ event: z.string().min(1).max(100) });
const notificationSchema = eventSchema.extend({
  payment: z.object({ id: z.string().min(1).max(100).refine((id) => id.trim() === id) }),
});
export function createAcademyPaymentWebhook(options: {
  lookup?: (id: string) => Promise<unknown>;
  sendAccess?: (opts: Parameters<typeof sendAccessEmail>[0]) => Promise<FunnelDeliveryResult>;
  productName?: (id: string) => string;
} = {}): RequestHandler {
  return async (req, res): Promise<void> => {
    if (!checkAcademyWebhook(req, res)) return;
    const notification = eventSchema.safeParse(req.body);
    if (!notification.success) { res.status(400).json({ error: "Invalid webhook payload" }); return; }
    const { event } = notification.data;
    if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_APPROVED_BY_RISK_ANALYSIS", ...REVERSAL_EVENTS].includes(event)) {
      res.json({ ok: true, ignored: true }); return;
    }
    const parsed = notificationSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid webhook payload" }); return; }
    const { payment } = parsed.data;
    if (REVERSAL_EVENTS.includes(event)) {
      await reconcileAcademyReversal(payment.id, options.lookup);
      res.json({ ok: true }); return;
    }
    // A successful state may release a canonical chargeback hold, not a refund.
    await reconcileAcademyIfHeld(payment.id, options.lookup);
    const result = await confirmAcademyPayment(payment.id, options.lookup);
    if (result.status !== "confirmed") {
      res.json({ ok: true, ...(result.status === "already_confirmed" ? { alreadyConfirmed: true } : { ignored: true }) });
      return;
    }
    const purchase = result.purchase;
    logger.info({ purchaseId: purchase.id }, "academy: payment verified and confirmed");
    // Durable job is already committed; this is merely a best-effort wake-up.
    setImmediate(() => {
      dispatchAcademyAccessEmail(purchase.id, { deliver: options.sendAccess, productName: options.productName })
        .catch((err) => logger.error({ err }, "academy: access outbox dispatch error"));
    });
    // Provider acknowledgements must not disclose the customer's access code.
    res.json({ ok: true });
  };
}
