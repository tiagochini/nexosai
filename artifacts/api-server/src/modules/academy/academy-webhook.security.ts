import type { Request, Response } from "express";
import { matchesAsaasWebhookToken } from "../../lib/asaas-webhook-auth.js";

// Same provider header/configuration convention used by product checkout.
export function checkAcademyWebhook(req: Request, res: Response): boolean {
  const configured = process.env["ASAAS_WEBHOOK_TOKEN"];
  const provided = req.headers["asaas-access-token"];
  if (!matchesAsaasWebhookToken(provided, configured)) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return false;
  }
  return true;
}
