import type { Request, Response } from "express";
import { matchesAsaasWebhookToken } from "../../lib/asaas-webhook-auth.js";

// Endpoint-specific token takes precedence, including an explicitly empty value.
export function checkAcademyWebhook(req: Request, res: Response): boolean {
  const configured = process.env["ASAAS_ACADEMY_WEBHOOK_TOKEN"] ?? process.env["ASAAS_WEBHOOK_TOKEN"];
  const provided = req.headers["asaas-access-token"];
  if (!matchesAsaasWebhookToken(provided, configured)) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return false;
  }
  return true;
}
