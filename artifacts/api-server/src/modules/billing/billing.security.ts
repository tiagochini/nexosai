import type { Request, Response } from "express";
import { matchesAsaasWebhookToken } from "../../lib/asaas-webhook-auth.js";

export function checkBillingManualConfirmation(req: Pick<Request, "headers">, res: Response): boolean {
  const configured = process.env["BILLING_MANUAL_CONFIRM_SECRET"];
  if (typeof configured !== "string" || configured.length < 32 || configured.length > 256 ||
      !matchesAsaasWebhookToken(req.headers["x-billing-admin-secret"], configured)) {
    res.status(403).json({ error: "Manual confirmation not authorized", code: "MANUAL_CONFIRMATION_FORBIDDEN" });
    return false;
  }
  return true;
}
