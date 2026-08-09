import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { env } from "../../lib/env.js";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const router = Router();

// ── Platform configs ─────────────────────────────────────────────────────────
type OAuthPlatform = "meta" | "tiktok" | "google" | "hubspot" | "rdstation" | "linkedin";
type DbProvider = "instagram" | "meta_ads" | "tiktok_ads" | "google_ads" | "hubspot" | "rd_station" | "linkedin_ads";

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
  linkedin: {
    name: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientId: () => env.LINKEDIN_CLIENT_ID,
    clientSecret: () => env.LINKEDIN_CLIENT_SECRET,
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
    scope: "public_profile,instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
    label: "Instagram Business",
    dbProvider: "instagram",
  },
  facebook: {
    platform: "meta",
    scope: "public_profile,instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
    label: "Facebook Páginas",
    dbProvider: "instagram",
  },
  meta_ads: {
    platform: "meta",
    scope: "public_profile,ads_management,ads_read,business_management",
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
    scope: "advertiser.info.read,campaign.read,campaign.write,ad.read,ad.write,report.read",
    label: "TikTok Ads",
    dbProvider: "tiktok_ads",
  },
  linkedin_ads: {
    platform: "linkedin",
    scope: "r_ads r_ads_reporting rw_ads w_member_social r_basicprofile",
    label: "LinkedIn Ads",
    dbProvider: "linkedin_ads",
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

// ── GET /providers — which OAuth platforms are configured ────────────────────
router.get("/providers", requireAuth, (_req, res): void => {
  res.json({
    providers: {
      meta:      !!(env.META_APP_ID && env.META_APP_SECRET),
      tiktok:    !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
      google:    !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      hubspot:   !!(env.HUBSPOT_CLIENT_ID && env.HUBSPOT_CLIENT_SECRET),
      rdstation: !!(env.RD_STATION_CLIENT_ID && env.RD_STATION_CLIENT_SECRET),
      linkedin:  !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
    },
  });
});

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
    const PLATFORM_VARS: Record<string, string> = {
      meta:      "META_APP_ID e META_APP_SECRET",
      tiktok:    "TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET",
      google:    "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET",
      hubspot:   "HUBSPOT_CLIENT_ID e HUBSPOT_CLIENT_SECRET",
      rdstation: "RD_STATION_CLIENT_ID e RD_STATION_CLIENT_SECRET",
      linkedin:  "LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET",
    };
    res.status(400).json({
      error: `OAuth não configurado para ${provider}. Configure ${PLATFORM_VARS[config.platform] ?? "as variáveis OAuth"} nas variáveis de ambiente.`,
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

  // TikTok uses client_key instead of client_id
  if (config.platform === "tiktok") {
    authUrl.searchParams.set("client_key", platform.clientId());
  } else {
    authUrl.searchParams.set("client_id", platform.clientId());
  }
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

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
    let metadataExtra: Record<string, unknown> = {};

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

      // Buscar dados do usuário
      const meRes = await fetch(
        `https://graph.facebook.com/v20.0/me?access_token=${accessToken}&fields=id,name`,
      );
      const me = (await meRes.json()) as { id?: string; name?: string };
      accountName = me.name ?? config.label;

      // Buscar Páginas que o usuário administra + Instagram Business Account vinculado
      const pagesRes = await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`,
      );
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: { id: string };
        }>;
      };
      const pages = pagesData.data ?? [];

      if (pages.length > 0) {
        // Preferir a página que já tem Instagram Business vinculado
        const pageWithIg = pages.find((p) => p.instagram_business_account) ?? pages[0];
        const igAccountId = pageWithIg.instagram_business_account?.id ?? me.id ?? "";

        // Usar o Page Access Token (válido para posts via Graph API)
        const pageToken = pageWithIg.access_token || accessToken;

        accountId = igAccountId;
        accessToken = pageToken;
        metadataExtra = {
          accountId: pageWithIg.id,          // Facebook Page ID — usado para posting
          accountName: pageWithIg.name,       // Nome da Página
          igAccountId: igAccountId,           // Instagram Business Account ID
          userId: me.id,                      // ID pessoal do FB
        };
        logger.info(
          { pageId: pageWithIg.id, igAccountId, pageName: pageWithIg.name },
          "Meta OAuth: Page encontrada e vinculada",
        );
      } else {
        // Fallback: sem acesso a páginas (escopo limitado), usa ID pessoal
        accountId = me.id ?? "";
        metadataExtra = { userId: me.id, note: "no_pages_found" };
        logger.warn({ userId: me.id }, "Meta OAuth: nenhuma Página encontrada — escopo pode estar restrito");
      }

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

    } else if (config.platform === "linkedin") {
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
        res.send(popupPage(false, tokenData.error_description ?? "Falha ao obter token LinkedIn."));
        return;
      }
      accessToken = tokenData.access_token;
      const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = (await meRes.json()) as { sub?: string; name?: string; email?: string };
      accountId = me.sub ?? "";
      accountName = me.name ?? me.email ?? config.label;

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

    const newMetadata = {
      oauthConnected: true,
      connectedAt: new Date().toISOString(),
      ...metadataExtra,
    };

    if (existing) {
      await db
        .update(workspaceIntegrationsTable)
        .set({
          status: "connected",
          accessToken,
          accountId,
          accountName,
          metadata: newMetadata,
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
        metadata: newMetadata,
      });
    }

    logger.info({ workspaceId: stateData.workspaceId, provider }, "OAuth integration connected");
    res.send(popupPage(true, "Conectado com sucesso!", provider));
  } catch (err) {
    logger.error({ err, provider }, "OAuth callback error");
    res.send(popupPage(false, "Erro interno ao processar autorização."));
  }
});

// ── GET /integrations/oauth/social-health ─────────────────────────────────────
// Verifica validade dos tokens sociais + faz ping real nas APIs das redes sociais.
// Retorna: dados da DB + resultado do ping ao vivo para cada integração.
router.get("/social-health", requireAuth, async (req, res): Promise<void> => {
  try {
    const SOCIAL_PROVIDERS = ["instagram", "facebook", "meta_ads", "tiktok_ads"];
    const all = await db
      .select()
      .from(workspaceIntegrationsTable)
      .where(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId));

    const now = Date.now();
    const WARN_DAYS = 14;

    // Ping real a cada API para verificar se o token ainda aceita requisições
    async function pingMeta(token: string, accountId: string): Promise<{
      ok: boolean; httpStatus: number; accountName?: string; errorMsg?: string;
    }> {
      try {
        // username field deprecated in Graph API v2.0+ — use only id,name
        const url = `https://graph.facebook.com/v20.0/${accountId}?fields=id,name&access_token=${token}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const body = (await r.json()) as {
          id?: string; name?: string;
          error?: { message: string; type: string; code: number };
        };
        if (!r.ok || body.error) {
          return { ok: false, httpStatus: r.status, errorMsg: body.error?.message ?? `HTTP ${r.status}` };
        }
        return { ok: true, httpStatus: r.status, accountName: body.name };
      } catch (e) {
        return { ok: false, httpStatus: 0, errorMsg: e instanceof Error ? e.message : "timeout" };
      }
    }

    async function pingTikTok(token: string): Promise<{
      ok: boolean; httpStatus: number; displayName?: string; errorMsg?: string;
    }> {
      try {
        const r = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url", {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        });
        const body = (await r.json()) as {
          data?: { user?: { display_name?: string } };
          error?: { message?: string };
        };
        if (!r.ok || body.error?.message) {
          return { ok: false, httpStatus: r.status, errorMsg: body.error?.message ?? `HTTP ${r.status}` };
        }
        return { ok: true, httpStatus: r.status, displayName: body.data?.user?.display_name };
      } catch (e) {
        return { ok: false, httpStatus: 0, errorMsg: e instanceof Error ? e.message : "timeout" };
      }
    }

    const social = all.filter(
      (i) => SOCIAL_PROVIDERS.includes(i.provider) && i.status === "connected",
    );

    const results = await Promise.all(
      social.map(async (i) => {
        const expiresMs = i.tokenExpiresAt ? new Date(i.tokenExpiresAt).getTime() : null;
        const daysLeft = expiresMs !== null ? Math.ceil((expiresMs - now) / 86_400_000) : null;
        const tokenExpired = daysLeft !== null && daysLeft <= 0;
        const expiringSoon = !tokenExpired && daysLeft !== null && daysLeft <= WARN_DAYS;

        // Ping ao vivo
        let ping: { ok: boolean; httpStatus: number; liveAccountName?: string; errorMsg?: string } = {
          ok: false, httpStatus: 0, errorMsg: "não testado",
        };
        if (i.accessToken) {
          if (i.provider === "tiktok") {
            const r = await pingTikTok(i.accessToken);
            ping = { ok: r.ok, httpStatus: r.httpStatus, liveAccountName: r.displayName, errorMsg: r.errorMsg };
          } else {
            // instagram, facebook, meta_ads — usa Graph API
            const accountId = i.accountId ?? "me";
            const r = await pingMeta(i.accessToken, accountId);
            ping = { ok: r.ok, httpStatus: r.httpStatus, liveAccountName: r.accountName, errorMsg: r.errorMsg };
          }
        }

        // Se o ping funcionou mas o token estava marcado como "expirado" na DB → corrigir
        const needsAction = !ping.ok || tokenExpired || expiringSoon;

        return {
          // ─ dados da DB ─
          provider: i.provider,
          accountId: i.accountId ?? null,
          accountName: i.accountName ?? null,
          tokenExpiresAt: i.tokenExpiresAt ?? null,
          daysLeft,
          connectedSince: i.createdAt,
          lastUpdated: i.updatedAt,
          tokenPresente: !!i.accessToken,
          metadata: i.metadata ?? {},
          // ─ expiração calculada ─
          tokenExpired,
          expiringSoon,
          // ─ ping ao vivo ─
          pingOk: ping.ok,
          pingStatus: ping.httpStatus,
          liveAccountName: ping.liveAccountName ?? null,
          pingError: ping.errorMsg ?? null,
          // ─ resumo ─
          needsAction,
          statusLabel: ping.ok ? "conectado" : tokenExpired ? "expirado" : "falhou_ping",
        };
      }),
    );

    logger.info({ workspaceId: req.auth.workspaceId, count: results.length }, "social-health check complete");
    res.json({ integrations: results });
  } catch (err) {
    logger.warn({ err }, "social-health check failed");
    res.json({ integrations: [] });
  }
});

export default router;
