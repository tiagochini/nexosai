import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { integrationPurpose, metadataForPurpose } from "./integration-purpose.js";

const router = Router();
const STATE_AUDIENCE = "nexos-tiktok-ads-callback";

type TikTokTokenResponse = {
  code?: number;
  message?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    advertiser_ids?: Array<string | number>;
  };
};

function callbackPage(success: boolean, message: string): string {
  const safeMessage = message.replace(/[<>"&]/g, "");
  const result = JSON.stringify({
    type: "oauth_complete",
    success,
    provider: "tiktok_ads",
    error: success ? undefined : safeMessage,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>NexOS · TikTok Ads</title>
    <body style="background:#090a0f;color:#fff;font:16px system-ui;display:grid;place-items:center;min-height:90vh">
    <main style="text-align:center"><h1>${success ? "TikTok Ads conectado" : "Não foi possível conectar"}</h1><p>${safeMessage}</p>
    <a style="color:#a78bfa" href="${env.APP_URL}/integracoes">Voltar ao NexOS</a></main>
    <script>const result=${result};try{window.opener?.postMessage(result,location.origin)}catch{};setTimeout(()=>{try{window.close()}catch{}},2500)</script>
    </body></html>`;
}

function finish(res: Response, success: boolean, message: string): void {
  res.status(success ? 200 : 400).type("html").send(callbackPage(success, message));
}

// TikTok for Business app's Advertiser redirect URL:
// https://agencianexos.vip/api/integrations/tiktok-ads/callback
// This is separate from TikTok Login Kit's organic-account callback.
router.get("/callback", async (req, res): Promise<void> => {
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  const authCode = typeof req.query["auth_code"] === "string"
    ? req.query["auth_code"]
    : typeof req.query["code"] === "string" ? req.query["code"] : "";
  const providerError = typeof req.query["error"] === "string" ? req.query["error"] : "";

  if (providerError) {
    finish(res, false, "A autorização do TikTok Ads foi cancelada ou recusada.");
    return;
  }
  if (!state || !authCode) {
    finish(res, false, "Retorno incompleto do TikTok. Inicie a conexão pelo NexOS e tente novamente.");
    return;
  }
  let stateData: { workspaceId?: string; provider?: string };
  try {
    stateData = jwt.verify(state, env.JWT_SECRET, { audience: STATE_AUDIENCE }) as typeof stateData;
  } catch {
    finish(res, false, "Estado de autorização inválido ou expirado. Inicie a conexão novamente no NexOS.");
    return;
  }
  if (!stateData.workspaceId || stateData.provider !== "tiktok_ads") {
    finish(res, false, "A autorização não corresponde a uma conexão TikTok Ads do NexOS.");
    return;
  }
  if (!env.TIKTOK_ADS_APP_ID || !env.TIKTOK_ADS_APP_SECRET) {
    res.status(503).type("html").send(callbackPage(false, "Credenciais da Marketing API ainda não foram configuradas no NexOS."));
    return;
  }

  try {
    const tokenResponse = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: env.TIKTOK_ADS_APP_ID, secret: env.TIKTOK_ADS_APP_SECRET, auth_code: authCode }),
      signal: AbortSignal.timeout(12_000),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({})) as TikTokTokenResponse;
    const tokenData = tokenBody.data;
    if (!tokenResponse.ok || Number(tokenBody.code ?? 0) !== 0 || !tokenData?.access_token) {
      logger.warn({ status: tokenResponse.status, providerCode: tokenBody.code }, "TikTok Ads authorization code exchange failed");
      finish(res, false, "O TikTok não aceitou o código de autorização. Gere um novo e tente novamente.");
      return;
    }

    const workspaceId = stateData.workspaceId;
    const metadata = metadataForPurpose("paid_media", {
      oauthConnected: true,
      connectedAt: new Date().toISOString(),
      authType: "tiktok_business_marketing_api",
      paidMedia: true,
      accountSelectionRequired: true,
      authorizedAdvertiserIds: tokenData.advertiser_ids ?? [],
    });
    const existingRows = await db.select().from(workspaceIntegrationsTable).where(and(
      eq(workspaceIntegrationsTable.workspaceId, workspaceId),
      eq(workspaceIntegrationsTable.provider, "tiktok_ads"),
    ));
    const existing = existingRows.find((row) => integrationPurpose(row.metadata as Record<string, unknown> | null) === "paid_media");
    const values = {
      workspaceId,
      provider: "tiktok_ads" as const,
      status: "connected" as const,
      accountId: "",
      accountName: "TikTok Ads — selecione uma conta de anúncios",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      tokenExpiresAt: typeof tokenData.expires_in === "number" && tokenData.expires_in > 0
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
      canonicalNetwork: null,
      isPaymentGateway: false,
      blocksExecution: false,
      metadata,
    };
    if (existing) {
      await db.update(workspaceIntegrationsTable).set(values).where(eq(workspaceIntegrationsTable.id, existing.id));
    } else {
      await db.insert(workspaceIntegrationsTable).values(values);
    }
    logger.info({ workspaceId, authorizedAdvertiserCount: tokenData.advertiser_ids?.length ?? 0 }, "TikTok Ads Marketing API connected");
    finish(res, true, "Autorização concluída. Volte ao NexOS e selecione a conta de anúncios.");
  } catch (error) {
    logger.error({ errorName: error instanceof Error ? error.name : "UNKNOWN" }, "TikTok Ads OAuth callback failed");
    res.status(500).type("html").send(callbackPage(false, "Erro interno ao concluir a conexão. Tente novamente pelo NexOS."));
  }
});

export default router;
