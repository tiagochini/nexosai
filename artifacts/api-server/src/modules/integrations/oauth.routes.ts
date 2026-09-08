import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { env } from "../../lib/env.js";
import { db, paidMediaAccountsTable, workspaceIntegrationsTable } from "@workspace/db";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import {
  integrationPurpose,
  metadataForPurpose,
  type IntegrationPurpose,
} from "./integration-purpose.js";
import { assertSocialAccountEntitlement } from "../auth/workspace-entitlements.service.js";

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
    scope: "public_profile,instagram_basic,instagram_content_publish,instagram_manage_insights,instagram_business_manage_messages,instagram_manage_comments,pages_show_list,pages_read_engagement,pages_manage_engagement,pages_manage_posts,pages_manage_metadata,business_management",
    label: "Instagram Business",
    dbProvider: "instagram",
  },
  facebook: {
    platform: "meta",
    scope: "public_profile,instagram_basic,instagram_content_publish,instagram_manage_insights,instagram_business_manage_messages,instagram_manage_comments,pages_show_list,pages_read_engagement,pages_manage_engagement,pages_manage_posts,pages_manage_metadata,business_management",
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
    try{localStorage.setItem("nexos_oauth_result",JSON.stringify({...payload,ts:Date.now()}))}catch(e){}
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

  // Mobile redirect-mode: embed flag in state so callback can do a full-page redirect
  // instead of the popup-based postMessage flow (which doesn't work when the Meta
  // OAuth is handled by the Facebook/Instagram native app on Android).
  const redirectMode = req.query["redirect_mode"] === "1";

  const state = jwt.sign(
    { workspaceId: req.auth.workspaceId, provider, redirectMode },
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
  // Google only issues a refresh token during an offline consent grant. The
  // paid-media adapter refuses expired production credentials without one.
  if (config.platform === "google") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
  }

  res.json({ url: authUrl.toString() });
});

// ── GET /callback/:provider — browser redirect from platform ─────────────────
router.get("/callback/:provider", async (req, res): Promise<void> => {
  const provider = req.params["provider"] as string;
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    // Normalize empty-string error from Meta (sends ?error= without value) to a readable message
    const errMsg = (typeof error === "string" && error.trim())
      ? error.trim()
      : !code
      ? "Autorização cancelada ou negada pelo Instagram."
      : "Parâmetros inválidos na resposta do Instagram.";
    logger.warn({ provider, queryError: error, hasCode: !!code, hasState: !!state }, "OAuth callback: missing/cancelled");
    // Peek at the state JWT (without verifying signature) to detect redirectMode for mobile.
    let earlyRedirectMode = false;
    if (state && typeof state === "string") {
      try {
        const rawPayload = state.split(".")[1];
        if (rawPayload) {
          const decoded = JSON.parse(Buffer.from(rawPayload, "base64url").toString()) as { redirectMode?: boolean };
          earlyRedirectMode = !!decoded.redirectMode;
        }
      } catch { /* ignore — fall back to popupPage */ }
    }
    if (earlyRedirectMode) {
      res.redirect(302, `${env.APP_URL}/integracoes?oauth_error=${encodeURIComponent(errMsg)}`);
    } else {
      res.send(popupPage(false, errMsg));
    }
    return;
  }

  let stateData: { workspaceId: string; provider: string; redirectMode?: boolean };
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

  // Helper: finish the OAuth callback.
  // On desktop (popup mode): sends the popupPage HTML that postMessages the result back.
  // On mobile (redirect mode): does a 302 redirect to the integrations page with a query param.
  const finishOAuth = (success: boolean, errorMessage?: string) => {
    if (stateData.redirectMode) {
      const dest = success
        ? `${env.APP_URL}/integracoes?oauth_connected=${encodeURIComponent(provider)}`
        : `${env.APP_URL}/integracoes?oauth_error=${encodeURIComponent(errorMessage ?? "Falha na autenticação.")}`;
      res.redirect(302, dest);
    } else {
      const msg = success ? "Conectado com sucesso!" : (errorMessage ?? "Falha na autenticação.");
      res.send(popupPage(success, msg, provider));
    }
  };

  const platform = PLATFORMS[config.platform];
  const redirectUri = `${env.APP_URL}/api/integrations/oauth/callback/${provider}`;

  try {
    let accessToken = "";
    let refreshToken: string | undefined;
    let tokenExpiresAt: Date | undefined;
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
        finishOAuth(false, tokenData.error?.message ?? "Falha ao obter access token do Meta.");
        return;
      }
      accessToken = tokenData.access_token;

      // Ads credentials must never use an organic Page or Instagram account as
      // their advertiser id. Keep organic connection behavior isolated below.
      if (config.dbProvider === "meta_ads") {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,currency,timezone_name&limit=500&access_token=${encodeURIComponent(accessToken)}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const accountsData = (await accountsRes.json()) as {
          data?: Array<{ id?: string; name?: string; currency?: string; timezone_name?: string }>;
          error?: { message?: string };
        };
        if (!accountsRes.ok || accountsData.error) {
          finishOAuth(false, accountsData.error?.message ?? "Não foi possível descobrir contas de anúncios Meta.");
          return;
        }
        const accounts = (accountsData.data ?? []).filter((account) => !!account.id);
        if (accounts.length === 0) {
          finishOAuth(false, "Nenhuma conta de anúncios Meta foi autorizada. Verifique as permissões ads_read e business_management.");
          return;
        }
        // A single account may be selected safely. For multiple advertisers we
        // persist discovery only and require explicit account selection.
        const selected = accounts.length === 1 ? accounts[0]! : undefined;
        accountId = selected?.id ?? "";
        accountName = selected?.name ?? `${accounts.length} contas de anúncios Meta disponíveis`;
        metadataExtra = {
          paidMedia: true,
          accountSelectionRequired: accounts.length !== 1,
          discoveredAdAccounts: accounts.map((account) => ({
            id: account.id?.startsWith("act_") ? account.id : `act_${account.id}`,
            name: account.name,
            currency: account.currency,
            timezone: account.timezone_name,
          })),
        };
      } else {
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

        // Buscar dados detalhados do perfil Instagram Business (username, seguidores, foto)
        let igUsername: string | undefined;
        let igFollowersCount: number | undefined;
        let igProfilePictureUrl: string | undefined;
        let igMediaCount: number | undefined;
        if (igAccountId) {
          try {
            const igProfileRes = await fetch(
              `https://graph.facebook.com/v20.0/${igAccountId}?fields=username,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(pageToken)}`,
            );
            if (igProfileRes.ok) {
              const igProfile = (await igProfileRes.json()) as {
                username?: string;
                profile_picture_url?: string;
                followers_count?: number;
                media_count?: number;
              };
              igUsername = igProfile.username;
              igFollowersCount = igProfile.followers_count;
              igProfilePictureUrl = igProfile.profile_picture_url;
              igMediaCount = igProfile.media_count;
              // Se tiver username do IG, usar como accountName principal
              if (igProfile.username) accountName = `@${igProfile.username}`;
            }
          } catch {
            // Non-critical — profile details are optional
          }
        }

        metadataExtra = {
          accountId: pageWithIg.id,          // Facebook Page ID — usado para posting
          accountName: pageWithIg.name,       // Nome da Página Facebook
          igAccountId: igAccountId,           // Instagram Business Account ID
          userId: me.id,                      // ID pessoal do FB
          igUsername,                         // @username do Instagram
          igFollowersCount,                   // Número de seguidores
          igProfilePictureUrl,                // URL da foto de perfil
          igMediaCount,                       // Total de posts publicados
        };
        logger.info(
          { pageId: pageWithIg.id, igAccountId, pageName: pageWithIg.name, igUsername, igFollowersCount },
          "Meta OAuth: Page encontrada e vinculada",
        );
      } else {
        // Fallback: sem acesso a páginas (escopo limitado), usa ID pessoal
        accountId = me.id ?? "";
        metadataExtra = { userId: me.id, note: "no_pages_found" };
        logger.warn({ userId: me.id }, "Meta OAuth: nenhuma Página encontrada — escopo pode estar restrito");
      }
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
        data?: { access_token?: string; open_id?: string; refresh_token?: string; expires_in?: number };
        error?: { code?: string; message?: string };
      };
      if (!tokenData.data?.access_token) {
        finishOAuth(false, tokenData.error?.message ?? "Falha ao obter token TikTok.");
        return;
      }
      accessToken = tokenData.data.access_token;
      accountId = tokenData.data.open_id ?? "";
      refreshToken = tokenData.data.refresh_token;
      if (tokenData.data.expires_in) {
        tokenExpiresAt = new Date(Date.now() + tokenData.data.expires_in * 1000);
      }
      // TikTok Ads has advertiser identities distinct from the Login Kit
      // open_id. Do not claim one was selected until discovery is complete.
      if (config.dbProvider === "tiktok_ads") {
        accountId = "";
        metadataExtra = {
          paidMedia: true,
          accountSelectionRequired: true,
          oauthOpenId: tokenData.data.open_id ?? null,
        };
      }

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
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };
      if (!tokenData.access_token) {
        finishOAuth(false, tokenData.error_description ?? "Falha ao obter token Google.");
        return;
      }
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      if (tokenData.expires_in) tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      if (config.dbProvider === "google_ads") {
        // A Google identity is not a Google Ads customer. Account access is
        // verified by the paid-media discovery endpoint before any customer is
        // selected, including for MCC users.
        accountId = "";
        accountName = config.label;
        metadataExtra = {
          paidMedia: true,
          accountSelectionRequired: true,
          oauthScopes: PROVIDER_MAP.google_ads.scope.split(" "),
          refreshTokenReady: !!refreshToken,
        };
      } else {
        const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const me = (await meRes.json()) as { sub?: string; name?: string; email?: string };
        accountId = me.sub ?? "";
        accountName = me.name ?? me.email ?? config.label;
      }

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
        finishOAuth(false, tokenData.message ?? "Falha ao obter token HubSpot.");
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
        finishOAuth(false, tokenData.error_description ?? "Falha ao obter token LinkedIn.");
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
        finishOAuth(false, tokenData.error ?? "Falha ao obter token RD Station.");
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

    // Provider values are shared by legacy organic and paid integrations.  Match
    // only the same purpose/account; never replace every row for a provider.
    const purpose: IntegrationPurpose =
      provider === "meta_ads" || provider === "tiktok_ads" || provider === "google_ads" ? "paid_media" : "organic_social";
    // OAuth callbacks are another account-creation path. Paid-media accounts
    // remain outside organic social entitlements; the existing account check in
    // the guard keeps OAuth reconnects idempotent.
    if (purpose === "organic_social" &&
      (provider === "instagram" || provider === "facebook" || provider === "tiktok")) {
      await assertSocialAccountEntitlement(stateData.workspaceId, provider, accountId);
    }
    const newMetadata = {
      oauthConnected: true,
      connectedAt: new Date().toISOString(),
      ...metadataExtra,
    };
    const metadata = metadataForPurpose(purpose, newMetadata);
    const existingRows = await db.select()
      .from(workspaceIntegrationsTable)
      .where(and(
        eq(workspaceIntegrationsTable.workspaceId, stateData.workspaceId),
        eq(workspaceIntegrationsTable.provider, config.dbProvider),
      ));
    const existing = existingRows.find((row) =>
      integrationPurpose(row.metadata as Record<string, unknown>) === purpose
      && (purpose === "paid_media" || row.accountId === accountId),
    );
    const values = {
      workspaceId: stateData.workspaceId,
      provider: config.dbProvider,
      status: "connected" as const,
      accessToken, refreshToken, tokenExpiresAt, accountId, accountName,
      isPaymentGateway: false, blocksExecution: false, metadata,
    };
    const [integration] = existing
      ? await db.update(workspaceIntegrationsTable).set(values)
        .where(eq(workspaceIntegrationsTable.id, existing.id))
        .returning({ id: workspaceIntegrationsTable.id })
      : await db.insert(workspaceIntegrationsTable).values(values)
        .returning({ id: workspaceIntegrationsTable.id });

    // Persist all Meta advertiser accounts discovered at OAuth time. This is
    // intentionally separate from the organic Page/IG integration record and
    // preserves every candidate when user access includes multiple accounts.
    const discovered = metadataExtra["discoveredAdAccounts"];
    if (config.dbProvider === "meta_ads" && integration && Array.isArray(discovered)) {
      for (const raw of discovered) {
        if (!raw || typeof raw !== "object") continue;
        const account = raw as { id?: unknown; name?: unknown; currency?: unknown; timezone?: unknown };
        if (typeof account.id !== "string" || !account.id) continue;
        await db.insert(paidMediaAccountsTable).values({
          workspaceId: stateData.workspaceId,
          integrationId: integration.id,
          provider: "meta_ads",
          providerAccountId: account.id,
          accountName: typeof account.name === "string" ? account.name : null,
          currency: typeof account.currency === "string" ? account.currency : "USD",
          timezone: typeof account.timezone === "string" ? account.timezone : "UTC",
          isSelected: account.id === accountId,
          selectedAt: account.id === accountId ? new Date() : null,
        }).onConflictDoUpdate({
          target: [
            paidMediaAccountsTable.workspaceId,
            paidMediaAccountsTable.provider,
            paidMediaAccountsTable.providerAccountId,
          ],
          // Deliberately retain isSelected/selectedAt and dependent history.
          set: {
            integrationId: integration.id,
            accountName: typeof account.name === "string" ? account.name : null,
            currency: typeof account.currency === "string" ? account.currency : "USD",
            timezone: typeof account.timezone === "string" ? account.timezone : "UTC",
            updatedAt: new Date(),
          },
        });
      }
    }

    logger.info({ workspaceId: stateData.workspaceId, provider }, "OAuth integration connected");
    finishOAuth(true);
  } catch (err) {
    logger.error({ err, provider }, "OAuth callback error");
    finishOAuth(false, "Erro interno ao processar autorização.");
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
          if (i.provider === "tiktok_ads") {
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
