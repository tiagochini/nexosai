import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

// Same provider header/configuration convention used by product checkout.
export function checkAcademyWebhook(req: Request, res: Response): boolean {
  const configured = process.env["ASAAS_WEBHOOK_TOKEN"];
  const provided = req.headers["asaas-access-token"];
  if (typeof configured !== "string" || !configured.trim() || configured.length > 1024 ||
      typeof provided !== "string" || provided.length > 1024) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return false;
  }
  const actual = Buffer.from(provided);
  const expected = Buffer.from(configured);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return false;
  }
  return true;
}
