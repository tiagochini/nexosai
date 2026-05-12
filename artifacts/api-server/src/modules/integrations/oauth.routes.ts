import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { env } from "../../lib/env.js";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const router = Router();

// ── Platform configs ─────────────────────────────────────────────────────────
type OAuthPlatform = "meta" | "tiktok" | "google" | "hubspot" | "rdstation";
type DbProvider = "instagram" | "meta_ads" | "tiktok_ads" | "google_ads" | "hubspot" | "rd_station";

interface PlatformConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientId: () => string;
  clientSecret: () => string;
}

const PLATFORMS: Record<OAuthPlatform, PlatformConfig> = {
  meta: {
    name: "Meta",
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    clientId: () => env.META_APP_ID,
    clientSecret: () => env.META_APP_SECRET,
  },
  tiktok: {
    name: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    clientId: () => env.TIKTOK_CLIENT_KEY,
    clientSecret: () => env.TIKTOK_CLIENT_SECRET,
  },
  google: {
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: () => env.GOOGLE_CLIENT_ID,
    clientSecret: () => env.GOOGLE_CLIENT_SECRET,
  },
  hubspot: {
    name: "HubSpot",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    clientId: () => env.HUBSPOT_CLIENT_ID,
    clientSecret: () => env.HUBSPOT_CLIENT_SECRET,
  },
  rdstation: {
    name: "RD Station",
    authUrl: "https://app.rdstation.com.br/oauth/sign-in",
    tokenUrl: "https://api.rd.services/auth/token",
    clientId: () => env.RD_STATION_CLIENT_ID,
    clientSecret: () => env.RD_STATION_CLIENT_SECRET,
  },
};

interface ProviderConfig {
  platform: OAuthPlatform;
  scope: string;
  label: string;
  dbProvider: DbProvider;
}

const PROVIDER_MAP: Record<string, ProviderConfig> = {
  instagram: {
    platform: "meta",
    scope: "instagram_basic,instagram_content_publish,pages_read_engagement,pages_manage_posts",
    label: "Instagram Business",
    dbProvider: "instagram",
  },
  meta_ads: {
    platform: "meta",
    scope: "ads_management,ads_read,business_management",
    label: "Meta Ads",
    dbProvider: "meta_ads",
  },
  tiktok: {
    platform: "tiktok",
    scope: "video.publish,video.upload,user.info.basic",
    label: "TikTok Business",
    dbProvider: "tiktok_ads",
  },
  tiktok_ads: {
    platform: "tiktok",
    scope: "biz.creator.info",
    label: "TikTok Ads",
    dbProvider: "tiktok_ads",
  },
  google_ads: {
    platform: "google",
    scope: "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.profile openid email",
    label: "Google Ads",
    dbProvider: "google_ads",
  },
  hubspot: {
    platform: "hubspot",
    scope: "oauth crm.objects.contacts.write crm.objects.deals.write crm.lists.write",
    label: "HubSpot",
    dbProvider: "hubspot",
  },
  rd_station: {
    platform: "rdstation",
    scope: "read_contacts write_contacts",
    label: "RD Station",
    dbProvider: "rd_station",
  },
};

// ── Popup response page ────────────────────────────────────────────────────────
function popupPage(success: boolean, message: string, provider?: string): string {
  const payload = JSON.stringify({
    type: "oauth_complete",
    success,
    provider,
    error: success ? undefined : message,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NexOS — ${success ? "Conectado" : "Erro"}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#090a0f;color:#fff;font-family:'Courier New',monospace;
         display:flex;align-items:center;justify-content:center;
         min-height:100vh;flex-direction:column;gap:14px;padding:24px;text-align:center}
    .icon{font-size:36px}
    .title{font-size:13px;text-transform:uppercase;letter-spacing:.18em;font-weight:700;
           color:${success ? "#22c55e" : "#f87171"}}
    .sub{font-size:11px;color:rgba(255,255,255,.4);max-width:280px}
    .bar{width:180px;height:2px;background:rgba(255,255,255,.08);margin-top:8px;position:relative;overflow:hidden}
    .bar::after{content:'';position:absolute;inset:0;background:${success ? "#22c55e" : "#f87171"};
                animation:fill 1.8s linear forwards}
    @keyframes fill{from{width:0}to{width:100%}}
  </style>
</head>
<body>
  <div class="icon">${success ? "✓" : "✗"}</div>
  <div class="title">${success ? "Conectado com sucesso!" : "Falha na conexão"}</div>
  <div class="sub">${success ? "Esta janela vai fechar automaticamente." : message}</div>
  <div class="bar"></div>
  <script>
    var payload=${payload};
    try{if(window.opener)window.opener.postMessage(payload,"*")}catch(e){}
    setTimeout(function(){try{window.close()}catch(e){}},2000);
  </script>
</body>
</html>`;
}

// ── GET /start/:provider — authenticated, returns OAuth URL ──────────────────
router.get("/start/:provider", requireAuth, (req, res): void => {
  const provider = req.params["provider"] as string;
  const config = PROVIDER_MAP[provider];

  if (!config) {
    res.status(400).json({ error: "Provedor desconhecido", code: "UNKNOWN_PROVIDER" });
    return;
  }

  const platform = PLATFORMS[config.platform];

  if (!platform.clientId()) {
    const vars =
      config.platform === "meta"
        ? "META_APP_ID e META_APP_SECRET"
        : "TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET";
    res.status(400).json({
      error: `OAuth não configurado para ${provider}. Configure ${vars} nas variáveis de ambiente.`,
      code: "OAUTH_NOT_CONFIGURED",
    });
    return;
  }

  const state = jwt.sign(
    { workspaceId: req.auth.workspaceId, provider },
    env.JWT_SECRET,
    { expiresIn: "10m" },
  );

  const redirectUri = `${env.APP_URL}/api/integrations/oauth/callback/${provider}`;
  const authUrl = new URL(platform.authUrl);

  if (config.platform === "meta") {
    authUrl.searchParams.set("client_id", platform.clientId());
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", config.scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
  } else {
    authUrl.searchParams.set("client_key", platform.clientId());
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", config.scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
  }

  res.json({ url: authUrl.toString() });
});

// ── GET /callback/:provider — browser redirect from platform ─────────────────
router.get("/callback/:provider", async (req, res): Promise<void> => {
  const provider = req.params["provider"] as string;
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.send(popupPage(false, typeof error === "string" ? error : "Autorização cancelada."));
    return;
  }

  let stateData: { workspaceId: string; provider: string };
  try {
    stateData = jwt.verify(state as string, env.JWT_SECRET) as typeof stateData;
  } catch {
    res.send(popupPage(false, "Sessão expirada. Tente novamente."));
    return;
  }

  const config = PROVIDER_MAP[provider];
  if (!config) {
    res.send(popupPage(false, "Provedor desconhecido."));
    return;
  }

  const platform = PLATFORMS[config.platform];
  const redirectUri = `${env.APP_URL}/api/integrations/oauth/callback/${provider}`;

  try {
    let accessToken = "";
    let accountId = "";
    let accountName = config.label;

    if (config.platform === "meta") {
      const qs = new URLSearchParams({
        client_id: platform.clientId(),
        client_secret: platform.clientSecret(),
        code: code as string,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch(`${platform.tokenUrl}?${qs}`);
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: { message: string };
      };
      if (!tokenData.access_token) {
        res.send(popupPage(false, tokenData.error?.message ?? "Falha ao obter access token."));
        return;
      }
      accessToken = tokenData.access_token;
      const meRes = await fetch(
        `https://graph.facebook.com/v20.0/me?access_token=${accessToken}&fields=id,name`,
      );
      const me = (await meRes.json()) as { id?: string; name?: string };
      accountId = me.id ?? "";
      accountName = me.name ?? config.label;

    } else if (config.platform === "tiktok") {
      const tokenRes = await fetch(platform.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: platform.clientId(),
          client_secret: platform.clientSecret(),
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        data?: { access_token?: string; open_id?: string };
        error?: { code?: string; message?: string };
      };
      if (!tokenData.data?.access_token) {
        res.send(popupPage(false, tokenData.error?.message ?? "Falha ao obter token TikTok."));
        return;
      }
      accessToken = tokenData.data.access_token;
      accountId = tokenData.data.open_id ?? "";

    } else if (config.platform === "google") {
      const tokenRes = await fetch(platform.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: platform.clientId(),
          client_secret: platform.clientSecret(),
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (!tokenData.access_token) {
        res.send(popupPage(false, tokenData.error_description ?? "Falha ao obter token Google."));
        return;
      }
      accessToken = tokenData.access_token;
      const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = (await meRes.json()) as { sub?: string; name?: string; email?: string };
      accountId = me.sub ?? "";
      accountName = me.name ?? me.email ?? config.label;

    } else if (config.platform === "hubspot") {
      const tokenRes = await fetch(platform.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: platform.clientId(),
          client_secret: platform.clientSecret(),
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        message?: string;
      };
      if (!tokenData.access_token) {
        res.send(popupPage(false, tokenData.message ?? "Falha ao obter token HubSpot."));
        return;
      }
      accessToken = tokenData.access_token;
      const meRes = await fetch(
        `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`,
      );
      const me = (await meRes.json()) as {
        hub_id?: number;
        hub_domain?: string;
        user?: string;
      };
      accountId = String(me.hub_id ?? "");
      accountName = me.hub_domain ?? me.user ?? config.label;

    } else {
      // rdstation
      const tokenRes = await fetch(platform.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: platform.clientId(),
          client_secret: platform.clientSecret(),
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
      };
      if (!tokenData.access_token) {
        res.send(popupPage(false, tokenData.error ?? "Falha ao obter token RD Station."));
        return;
      }
      accessToken = tokenData.access_token;
      const meRes = await fetch("https://api.rd.services/platform/account", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = (await meRes.json()) as { uuid?: string; name?: string };
      accountId = me.uuid ?? "";
      accountName = me.name ?? config.label;
    }

    // Upsert integration
    const [existing] = await db
      .select({ id: workspaceIntegrationsTable.id })
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, stateData.workspaceId),
          eq(workspaceIntegrationsTable.provider, config.dbProvider),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(workspaceIntegrationsTable)
        .set({
          status: "connected",
          accessToken,
          accountId,
          accountName,
          updatedAt: new Date(),
        })
        .where(eq(workspaceIntegrationsTable.id, existing.id));
    } else {
      await db.insert(workspaceIntegrationsTable).values({
        workspaceId: stateData.workspaceId,
        provider: config.dbProvider,
        status: "connected",
        accessToken,
        accountId,
        accountName,
        isPaymentGateway: false,
        blocksExecution: false,
        metadata: { oauthConnected: true, connectedAt: new Date().toISOString() },
      });
    }

    logger.info({ workspaceId: stateData.workspaceId, provider }, "OAuth integration connected");
    res.send(popupPage(true, "Conectado com sucesso!", provider));
  } catch (err) {
    logger.error({ err, provider }, "OAuth callback error");
    res.send(popupPage(false, "Erro interno ao processar autorização."));
  }
});

export default router;
