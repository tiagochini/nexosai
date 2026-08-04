import { Router } from "express";
import crypto from "crypto";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";

const router = Router();

// ─── Production URL used in the callback response ────────────────────────────
// Must be the canonical public URL — never the .replit.app dev domain.
const DATA_DELETION_STATUS_URL = "https://agencianexos.vip/data-deletion";

function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;
  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expected)) return null;
  return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

// ─── POST /api/meta/data-deletion ─────────────────────────────────────────────
// Called by Meta when a user removes the app or requests data deletion via
// Facebook settings. Must:
//   1. Verify the HMAC-SHA256 signature with APP_SECRET
//   2. Revoke all Meta-related integration tokens for the given user_id
//   3. Return { url, confirmation_code } per Meta's spec
router.post("/meta/data-deletion", async (req, res) => {
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

  const facebookUserId = data.user_id as string | undefined;
  const confirmationCode = crypto.randomBytes(8).toString("hex");

  logger.info({ facebookUserId, confirmationCode }, "meta_data_deletion_request received");

  // ── Revoke tokens for all Meta integrations matching this Facebook user_id ──
  // workspace_integrations stores the external account_id in the accountId column.
  // Meta integrations are provider IN ('instagram', 'facebook', 'meta_ads').
  if (facebookUserId) {
    try {
      // Revoke tokens for any Meta integration whose accountId matches the FB user_id.
      // Providers that can hold a Meta OAuth token: instagram, facebook, meta_ads.
      const affected = await db
        .update(workspaceIntegrationsTable)
        .set({
          accessToken: null,
          refreshToken: null,
          status: "disconnected",
          metadata: { deletionRequested: true, confirmationCode, requestedAt: new Date().toISOString() },
        })
        .where(
          and(
            eq(workspaceIntegrationsTable.accountId, facebookUserId),
            or(
              eq(workspaceIntegrationsTable.provider, "instagram"),
              eq(workspaceIntegrationsTable.provider, "facebook"),
              eq(workspaceIntegrationsTable.provider, "meta_ads"),
            ),
          ),
        )
        .returning({ id: workspaceIntegrationsTable.id, workspaceId: workspaceIntegrationsTable.workspaceId });

      logger.info(
        { facebookUserId, confirmationCode, affectedCount: affected.length },
        "meta_data_deletion tokens revoked",
      );
    } catch (err) {
      // Non-fatal: log the error but still return the confirmation code so Meta
      // considers the callback handled. Manual cleanup can be tracked by confirmationCode.
      logger.error({ err, facebookUserId, confirmationCode }, "meta_data_deletion DB revocation failed");
    }
  }

  res.json({
    url: DATA_DELETION_STATUS_URL,
    confirmation_code: confirmationCode,
  });
});

// ─── GET /api/meta/data-deletion ──────────────────────────────────────────────
// Human-readable fallback shown in Facebook app settings when a user clicks
// "View details" after requesting deletion.
router.get("/meta/data-deletion", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Data Deletion — NexOS AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 600px; margin: 60px auto; padding: 0 20px;
           background: #000; color: #fff; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    a { color: #60a5fa; }
    .box { border: 1px solid #333; padding: 1rem; margin: 1rem 0; background: #111; }
  </style>
</head>
<body>
  <h1>NexOS AI — Data Deletion</h1>
  <p>
    <strong>Operator:</strong> DasKapital Holdings / B.A.T Cabral &mdash; ABN 38 320 484 941 (Australia)
  </p>
  <div class="box">
    <p>To request deletion of your NexOS AI data associated with your Facebook or Instagram account:</p>
    <ol>
      <li>Email <a href="mailto:privacy@agencianexos.vip">privacy@agencianexos.vip</a> with subject <strong>"Exclusão de Dados"</strong></li>
      <li>Or revoke access at <a href="https://www.facebook.com/settings?tab=applications">facebook.com/settings → Apps</a></li>
    </ol>
    <p>All requests are processed within 30 business days in compliance with the LGPD (Lei 13.709/2018).</p>
  </div>
  <p>Full instructions: <a href="https://agencianexos.vip/data-deletion">agencianexos.vip/data-deletion</a></p>
</body>
</html>`);
});

export default router;
