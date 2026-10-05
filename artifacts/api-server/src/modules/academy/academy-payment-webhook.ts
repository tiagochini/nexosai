import type { RequestHandler } from "express";
import { z } from "zod/v4";
import { checkAcademyWebhook } from "./academy-webhook.security.js";
import { confirmAcademyPayment } from "./academy-settlement.service.js";
import { sendAccessEmail } from "./academy.service.js";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const eventSchema = z.object({ event: z.string().min(1).max(100) });
const notificationSchema = eventSchema.extend({
  payment: z.object({ id: z.string().min(1).max(100).refine((id) => id.trim() === id) }),
});
export function createAcademyPaymentWebhook(options: {
  lookup?: (id: string) => Promise<unknown>;
  sendAccess?: (opts: Parameters<typeof sendAccessEmail>[0]) => Promise<unknown>;
  productName?: (id: string) => string;
} = {}): RequestHandler {
  return async (req, res): Promise<void> => {
    if (!checkAcademyWebhook(req, res)) return;
    const notification = eventSchema.safeParse(req.body);
    if (!notification.success) { res.status(400).json({ error: "Invalid webhook payload" }); return; }
    const { event } = notification.data;
    if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_APPROVED_BY_RISK_ANALYSIS"].includes(event)) {
      res.json({ ok: true, ignored: true }); return;
    }
    const parsed = notificationSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid webhook payload" }); return; }
    const { payment } = parsed.data;
    const result = await confirmAcademyPayment(payment.id, options.lookup);
    if (result.status !== "confirmed") {
      res.json({ ok: true, ...(result.status === "already_confirmed" ? { alreadyConfirmed: true } : { ignored: true }) });
      return;
    }
    const purchase = result.purchase;
    logger.info({ purchaseId: purchase.id }, "academy: payment verified and confirmed");
    // Only the transaction winner schedules delivery. A durable access-email
    // outbox is still required to recover a process exit after this commit.
    setImmediate(() => {
      (options.sendAccess ?? sendAccessEmail)({
        email: purchase.customerEmail, name: purchase.customerName ?? purchase.customerEmail,
        token: purchase.accessToken, productName: options.productName?.(purchase.productId) ?? purchase.productId,
        portalUrl: `${env.APP_URL}/nexos-academy/`,
      }).catch((err) => logger.error({ err }, "academy: access email error"));
    });
    // Provider acknowledgements must not disclose the customer's access code.
    res.json({ ok: true });
  };
}
