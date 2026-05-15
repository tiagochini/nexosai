import { Router } from "express";
import crypto from "crypto";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const router = Router();

function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;
  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expected)) return null;
  return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

router.post("/meta/data-deletion", (req, res) => {
  const { signed_request } = req.body as { signed_request?: string };
  if (!signed_request) {
    res.status(400).json({ error: "missing signed_request" });
    return;
  }
  const appSecret = env.META_APP_SECRET ?? "";
  const data = parseSignedRequest(signed_request, appSecret);
  if (!data) {
    res.status(400).json({ error: "invalid signature" });
    return;
  }
  const userId = data.user_id as string | undefined;
  logger.info({ userId }, "meta_data_deletion_request");
  const confirmationCode = crypto.randomBytes(8).toString("hex");
  res.json({
    url: `https://nex-os-ai.replit.app/landing/data-deletion`,
    confirmation_code: confirmationCode,
  });
});

router.get("/meta/data-deletion", (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Data Deletion — NexOS AI</title></head><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px;background:#000;color:#fff"><h1>Data Deletion</h1><p>To request deletion of your NexOS AI data, email <a href="mailto:privacy@nexos.ai" style="color:#60a5fa">privacy@nexos.ai</a> with subject "Exclusão de Dados".</p><p>You can also revoke access at <a href="https://www.facebook.com/settings?tab=applications" style="color:#60a5fa">facebook.com/settings → Apps</a>.</p></body></html>`);
});

export default router;
