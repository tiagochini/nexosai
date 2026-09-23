import { eq, and, or, lte, inArray, isNull, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import {
  db,
  socialPostsTable,
  workspaceIntegrationsTable,
  campaignsTable,
  contentPiecesTable,
  executionEvidenceTable,
  socialPublishAttemptsTable,
  socialConversationTurnsTable,
  type InsertSocialPost,
  type SocialPost,
  type WorkspaceIntegration,
  type SocialMetrics,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import {
  publishToInstagram,
  publishToFacebook,
  publishToTikTok,
  sendWhatsAppMessage,
  getInstagramMetrics,
  getTikTokMetrics,
  checkSocialCredentialReadiness,
  ProviderOutcomeError,
  readBackSocialPost,
} from "./social.publisher.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
import jwt from "jsonwebtoken";
import { isOrganicSocialIntegration, metadataForPurpose } from "../integrations/integration-purpose.js";
import { claimMetaWebhookEvent } from "./meta-webhook-evidence.service.js";
import { getApprovedMasterplan, matchesApprovedDossier } from "../masterplan/masterplan.service.js";
import { ingestInboundCommunityEvent } from "../community/community.service.js";
import { orchestrateIntelligentConversation } from "./contextual-conversation.service.js";
import { META_GRAPH_VERSION, metaGraphUrl } from "../../lib/meta-graph.constants.js";
import {
  assertSocialAccountEntitlement,
  canonicalNetworkForProvider,
} from "../auth/workspace-entitlements.service.js";

// ─── OAuth ────────────────────────────────────────────────────────────────────

const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_business_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "business_management",
].join(",");

const TIKTOK_SCOPES = [
  "user.info.basic",
  "video.publish",
  "video.upload",
  "video.list",
].join(",");

export type SupportedPlatform = "meta" | "tiktok" | "whatsapp";

export function getOAuthUrl(platform: SupportedPlatform, workspaceId: string): string {
  const state = jwt.sign({ workspaceId, platform }, env.SESSION_SECRET, {
    expiresIn: "10m",
  });

  if (platform === "meta") {
    const appId = env.META_APP_ID || process.env["FACEBOOK_APP_ID"];
    const redirectUri = process.env["FACEBOOK_REDIRECT_URI"] ?? `${env.APP_URL}/api/social/callback/meta`;
    if (!appId) throw new AppError(503, "Facebook App ID não configurado", "SOCIAL_NOT_CONFIGURED");
    const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", META_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  if (platform === "tiktok") {
    const clientKey = process.env["TIKTOK_CLIENT_KEY"];
    const redirectUri = process.env["TIKTOK_REDIRECT_URI"] ?? `${env.APP_URL}/api/social/callback/tiktok`;
    if (!clientKey) throw new AppError(503, "TikTok Client Key não configurado", "SOCIAL_NOT_CONFIGURED");
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", TIKTOK_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  throw new AppError(400, `Plataforma ${platform} não suporta OAuth`, "INVALID_PLATFORM");
}

export function verifyOAuthState(state: string): { workspaceId: string; platform: string } {
  try {
    return jwt.verify(state, env.SESSION_SECRET) as { workspaceId: string; platform: string };
  } catch {
    throw new AppError(400, "OAuth state inválido ou expirado", "INVALID_STATE");
  }
}

export async function handleMetaCallback(
  code: string,
  workspaceId: string
): Promise<WorkspaceIntegration[]> {
  const appId = env.META_APP_ID || process.env["FACEBOOK_APP_ID"];
  const appSecret = env.META_APP_SECRET || process.env["FACEBOOK_APP_SECRET"];
  const redirectUri = process.env["FACEBOOK_REDIRECT_URI"] ?? `${env.APP_URL}/api/social/callback/meta`;

  if (!appId || !appSecret) {
    throw new AppError(503, "Credenciais Meta não configuradas", "SOCIAL_NOT_CONFIGURED");
  }

  // Exchange code for short-lived token
  const tokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new AppError(400, tokenData.error?.message ?? "Meta token exchange failed", "OAUTH_FAILED");
  }

  // Exchange for long-lived token
  const llUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  llUrl.searchParams.set("grant_type", "fb_exchange_token");
  llUrl.searchParams.set("client_id", appId);
  llUrl.searchParams.set("client_secret", appSecret);
  llUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

  const llRes = await fetch(llUrl.toString());
  const llData = (await llRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  const longLivedToken = llData.access_token ?? tokenData.access_token;
  const expiresInSec = llData.expires_in ?? 60 * 24 * 60 * 60; // 60 days default

  // Get Facebook pages
  const pagesUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("access_token", longLivedToken);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,name,username}");

  const pagesRes = await fetch(pagesUrl.toString());
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; name: string; username: string };
    }>;
    error?: { message: string };
  };

  if (!pagesRes.ok || !pagesData.data) {
    throw new AppError(400, pagesData.error?.message ?? "Failed to fetch pages", "OAUTH_FAILED");
  }

  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const savedIntegrations: WorkspaceIntegration[] = [];

  for (const page of pagesData.data) {
    // Upsert Facebook Page integration by accountId
    const fbIntegration = await upsertIntegration(workspaceId, {
      // Historical adapter key retained for existing publishing compatibility.
      // metadata.integrationPurpose distinguishes organic Page access from paid media.
      provider: "meta_ads",
      accountId: page.id,
      accountName: page.name,
      accessToken: page.access_token,
      tokenExpiresAt: expiresAt,
      metadata: metadataForPurpose("organic_social", { pageId: page.id }),
    });
    savedIntegrations.push(fbIntegration);

    // Upsert Instagram integration if linked
    const ig = page.instagram_business_account;
    if (ig) {
      const igIntegration = await upsertIntegration(workspaceId, {
        provider: "instagram",
        accountId: ig.id,
        accountName: ig.name ?? ig.username,
        accessToken: page.access_token,
        tokenExpiresAt: expiresAt,
        metadata: metadataForPurpose("organic_social", { username: ig.username, pageId: page.id }),
      });
      savedIntegrations.push(igIntegration);
    }
  }

  logger.info({ workspaceId, count: savedIntegrations.length }, "Meta OAuth completed");
  return savedIntegrations;
}

export async function handleTikTokCallback(
  code: string,
  workspaceId: string
): Promise<WorkspaceIntegration> {
  const clientKey = process.env["TIKTOK_CLIENT_KEY"];
  const clientSecret = process.env["TIKTOK_CLIENT_SECRET"];
  const redirectUri = process.env["TIKTOK_REDIRECT_URI"] ?? `${env.APP_URL}/api/social/callback/tiktok`;

  if (!clientKey || !clientSecret) {
    throw new AppError(503, "Credenciais TikTok não configuradas", "SOCIAL_NOT_CONFIGURED");
  }

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new AppError(400, tokenData.error_description ?? "TikTok token exchange failed", "OAUTH_FAILED");
  }

  // Get user info
  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const userData = (await userRes.json()) as {
    data?: { user?: { open_id?: string; display_name?: string } };
  };

  const displayName = userData.data?.user?.display_name ?? "TikTok Account";
  const openId = tokenData.open_id ?? userData.data?.user?.open_id ?? "";
  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000);

  const integration = await upsertIntegration(workspaceId, {
    provider: "tiktok_ads",
    accountId: openId,
    accountName: displayName,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    tokenExpiresAt: expiresAt,
    metadata: metadataForPurpose("organic_social", { openId }),
  });
  logger.info({ workspaceId, openId }, "TikTok OAuth completed");
  return integration;
}

export async function disconnectAccount(
  workspaceId: string,
  integrationId: string
): Promise<void> {
  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.id, integrationId),
        eq(workspaceIntegrationsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!integration) throw new NotFoundError("Integration not found");

  await db
    .update(workspaceIntegrationsTable)
    .set({
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    })
    .where(eq(workspaceIntegrationsTable.id, integrationId));
}

export async function getConnectedAccounts(workspaceId: string) {
  return db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      tokenExpiresAt: workspaceIntegrationsTable.tokenExpiresAt,
      isPaymentGateway: workspaceIntegrationsTable.isPaymentGateway,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.isPaymentGateway, false),
        inArray(workspaceIntegrationsTable.status, ["connected", "expired", "error"])
      )
    );
}

// ─── Account Analytics ────────────────────────────────────────────────────────

const ANALYTICS_TIMEOUT_MS = 12_000;

function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export interface AccountAnalyticsPost {
  id: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  caption?: string;
  timestamp?: string;
  likes: number;
  comments: number;
  reach: number;
  impressions: number;
  saved?: number;
}

export interface DailyMetricPoint {
  date: string; // "YYYY-MM-DD"
  followers?: number;
  reach?: number;
  impressions?: number;
}

export interface AccountAnalytics {
  integrationId: string;
  provider: string;
  accountName: string;
  accountId: string | null;
  profilePictureUrl?: string;
  biography?: string;
  website?: string;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  avgEngagement: number | null;
  totalReach30d: number | null;
  totalImpressions30d: number | null;
  dailyMetrics: DailyMetricPoint[];
  recentPosts: AccountAnalyticsPost[];
  status: string;
  error?: string;
}

async function fetchInstagramAnalytics(
  integrationId: string,
  accountId: string,
  accountName: string,
  accessToken: string,
  status: string,
): Promise<AccountAnalytics> {
  const base: AccountAnalytics = {
    integrationId,
    provider: "instagram",
    accountName,
    accountId,
    followers: null,
    following: null,
    mediaCount: null,
    avgEngagement: null,
    totalReach30d: null,
    totalImpressions30d: null,
    dailyMetrics: [],
    recentPosts: [],
    status,
  };

  try {
    // 1. Profile
    const profileUrl = `${metaGraphUrl(accountId)}?fields=username,profile_picture_url,followers_count,follows_count,media_count,biography,website&access_token=${encodeURIComponent(accessToken)}`;
    const profileRes = await fetchWithTimeout(profileUrl);
    if (!profileRes.ok) return { ...base, error: `Graph API ${profileRes.status}` };
    const profile = await profileRes.json() as {
      username?: string; profile_picture_url?: string; followers_count?: number;
      follows_count?: number; media_count?: number; biography?: string; website?: string;
    };

    base.accountName = profile.username ? `@${profile.username}` : accountName;
    base.profilePictureUrl = profile.profile_picture_url;
    base.followers = profile.followers_count ?? null;
    base.following = profile.follows_count ?? null;
    base.mediaCount = profile.media_count ?? null;
    base.biography = profile.biography;
    base.website = profile.website;

    // 2. Recent media with cached insights, falling back to the Graph API.
    const mediaUrl = `${metaGraphUrl(`${accountId}/media`)}?fields=id,media_type,media_url,thumbnail_url,caption,timestamp&limit=12&access_token=${encodeURIComponent(accessToken)}`;
    const mediaRes = await fetchWithTimeout(mediaUrl);
    if (mediaRes.ok) {
      const mediaData = await mediaRes.json() as { data?: Array<{ id: string; media_type?: string; media_url?: string; thumbnail_url?: string; caption?: string; timestamp?: string }> };
      const recentMedia = (mediaData.data ?? []).slice(0, 9);
      const posts: AccountAnalyticsPost[] = [];

      const mediaIds = recentMedia.map((media) => media.id);
      const cachedMetrics = new Map<string, SocialMetrics>();
      if (mediaIds.length > 0) {
        try {
          const cachedRows = await db
            .select({
              platformPostId: socialPostsTable.platformPostId,
              metrics: socialPostsTable.metrics,
            })
            .from(socialPostsTable)
            .where(inArray(socialPostsTable.platformPostId, mediaIds));

          for (const row of cachedRows) {
            if (!row.platformPostId) continue;
            const metrics = row.metrics as SocialMetrics;
            const hasSyncedMetrics =
              metrics.likes > 0 ||
              metrics.comments > 0 ||
              metrics.shares > 0 ||
              metrics.views > 0 ||
              metrics.reach > 0 ||
              metrics.impressions > 0 ||
              metrics.clicks > 0;
            if (hasSyncedMetrics) cachedMetrics.set(row.platformPostId, metrics);
          }
        } catch (err) {
          logger.warn(
            { err, integrationId },
            "Instagram metrics cache lookup failed; falling back to Graph API",
          );
        }
      }

      for (const media of recentMedia) {
        const cached = cachedMetrics.get(media.id);
        if (cached) {
          posts.push({
            id: media.id,
            mediaUrl: media.media_url,
            thumbnailUrl: media.thumbnail_url,
            mediaType: media.media_type,
            caption: media.caption,
            timestamp: media.timestamp,
            likes: cached.likes,
            comments: cached.comments,
            reach: cached.reach,
            impressions: cached.impressions,
          });
          continue;
        }

        try {
          const insightUrl = `${metaGraphUrl(`${media.id}/insights`)}?metric=impressions,reach,likes,comments,saved&access_token=${encodeURIComponent(accessToken)}`;
          const insightRes = await fetchWithTimeout(insightUrl);
          let likes = 0, comments = 0, reach = 0, impressions = 0, saved = 0;
          if (insightRes.ok) {
            const insightData = await insightRes.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
            for (const m of insightData.data ?? []) {
              const v = m.values?.[0]?.value ?? 0;
              if (m.name === "impressions") impressions = v;
              else if (m.name === "reach") reach = v;
              else if (m.name === "likes") likes = v;
              else if (m.name === "comments") comments = v;
              else if (m.name === "saved") saved = v;
            }
          }
          posts.push({ id: media.id, mediaUrl: media.media_url, thumbnailUrl: media.thumbnail_url, mediaType: media.media_type, caption: media.caption, timestamp: media.timestamp, likes, comments, reach, impressions, saved });
        } catch {
          posts.push({ id: media.id, mediaUrl: media.media_url, thumbnailUrl: media.thumbnail_url, mediaType: media.media_type, caption: media.caption, timestamp: media.timestamp, likes: 0, comments: 0, reach: 0, impressions: 0 });
        }
      }

      base.recentPosts = posts;

      // 3. 30-day account insights (daily breakdown)
      try {
        const since = Math.floor((Date.now() - 30 * 86400_000) / 1000);
        const until = Math.floor(Date.now() / 1000);
        const accInsightUrl = `${metaGraphUrl(`${accountId}/insights`)}?metric=reach,impressions,follower_count&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(accessToken)}`;
        const accInsightRes = await fetchWithTimeout(accInsightUrl);
        if (accInsightRes.ok) {
          const accData = await accInsightRes.json() as { data?: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> };
          const dailyMap: Record<string, DailyMetricPoint> = {};
          for (const m of accData.data ?? []) {
            const total = (m.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
            if (m.name === "reach") base.totalReach30d = total;
            if (m.name === "impressions") base.totalImpressions30d = total;
            for (const v of m.values ?? []) {
              const date = v.end_time ? v.end_time.split("T")[0] : "";
              if (!date) continue;
              if (!dailyMap[date]) dailyMap[date] = { date };
              if (m.name === "reach") dailyMap[date].reach = v.value ?? 0;
              if (m.name === "impressions") dailyMap[date].impressions = v.value ?? 0;
              if (m.name === "follower_count") dailyMap[date].followers = v.value ?? 0;
            }
          }
          base.dailyMetrics = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        }
      } catch { /* non-critical */ }

      // 4. Avg engagement
      if (posts.length > 0) {
        const engSum = posts.reduce((s, p) => s + p.likes + p.comments + (p.saved ?? 0), 0);
        base.avgEngagement = Math.round(engSum / posts.length);
      }
    }

    return base;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: msg.includes("abort") ? "Timeout ao buscar dados" : msg };
  }
}

async function fetchFacebookAnalytics(
  integrationId: string,
  accountId: string,
  accountName: string,
  accessToken: string,
  status: string,
): Promise<AccountAnalytics> {
  const base: AccountAnalytics = {
    integrationId,
    provider: "facebook",
    accountName,
    accountId,
    followers: null,
    following: null,
    mediaCount: null,
    avgEngagement: null,
    totalReach30d: null,
    totalImpressions30d: null,
    dailyMetrics: [],
    recentPosts: [],
    status,
  };

  try {
    // Page profile + fan count
    const profileUrl = `${metaGraphUrl(accountId)}?fields=name,picture.type(large),fan_count,followers_count,about,website&access_token=${encodeURIComponent(accessToken)}`;
    const profileRes = await fetchWithTimeout(profileUrl);
    if (!profileRes.ok) return { ...base, error: `Graph API ${profileRes.status}` };
    const profile = await profileRes.json() as {
      name?: string; picture?: { data?: { url?: string } }; fan_count?: number;
      followers_count?: number; about?: string; website?: string;
    };

    base.accountName = profile.name ?? accountName;
    base.profilePictureUrl = profile.picture?.data?.url;
    base.followers = profile.followers_count ?? profile.fan_count ?? null;
    base.biography = profile.about;
    base.website = profile.website;

    // Recent posts
    const postsUrl = `${metaGraphUrl(`${accountId}/posts`)}?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true)&limit=9&access_token=${encodeURIComponent(accessToken)}`;
    const postsRes = await fetchWithTimeout(postsUrl);
    if (postsRes.ok) {
      const postsData = await postsRes.json() as { data?: Array<{ id: string; message?: string; full_picture?: string; created_time?: string; likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } } }> };
      base.recentPosts = (postsData.data ?? []).map(p => ({
        id: p.id,
        mediaUrl: p.full_picture,
        caption: p.message,
        timestamp: p.created_time,
        likes: p.likes?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        reach: 0,
        impressions: 0,
      }));
      if (base.recentPosts.length > 0) {
        const engSum = base.recentPosts.reduce((s, p) => s + p.likes + p.comments, 0);
        base.avgEngagement = Math.round(engSum / base.recentPosts.length);
      }
    }

    // 30-day page insights (daily breakdown)
    try {
      const since = Math.floor((Date.now() - 30 * 86400_000) / 1000);
      const until = Math.floor(Date.now() / 1000);
      const insightUrl = `${metaGraphUrl(`${accountId}/insights`)}?metric=page_fans,page_impressions,page_impressions_unique&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(accessToken)}`;
      const insightRes = await fetchWithTimeout(insightUrl);
      if (insightRes.ok) {
        const insightData = await insightRes.json() as { data?: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> };
        const dailyMap: Record<string, DailyMetricPoint> = {};
        for (const m of insightData.data ?? []) {
          const total = (m.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
          if (m.name === "page_impressions") base.totalImpressions30d = total;
          if (m.name === "page_impressions_unique") base.totalReach30d = total;
          for (const v of m.values ?? []) {
            const date = v.end_time ? v.end_time.split("T")[0] : "";
            if (!date) continue;
            if (!dailyMap[date]) dailyMap[date] = { date };
            if (m.name === "page_fans") dailyMap[date].followers = v.value ?? 0;
            if (m.name === "page_impressions") dailyMap[date].impressions = v.value ?? 0;
            if (m.name === "page_impressions_unique") dailyMap[date].reach = v.value ?? 0;
          }
        }
        base.dailyMetrics = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch { /* non-critical */ }

    return base;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: msg.includes("abort") ? "Timeout ao buscar dados" : msg };
  }
}

async function fetchTikTokAnalytics(
  integrationId: string,
  accountId: string,
  accountName: string,
  accessToken: string,
  status: string,
): Promise<AccountAnalytics> {
  const base: AccountAnalytics = {
    integrationId,
    provider: "tiktok",
    accountName,
    accountId,
    followers: null,
    following: null,
    mediaCount: null,
    avgEngagement: null,
    totalReach30d: null,
    totalImpressions30d: null,
    dailyMetrics: [],
    recentPosts: [],
    status,
  };

  try {
    // User info
    const userRes = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,video_count,likes_count,bio_description,profile_web_url",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!userRes.ok) return { ...base, error: `TikTok API ${userRes.status}` };
    const userData = await userRes.json() as {
      data?: {
        user?: {
          display_name?: string; avatar_url?: string; follower_count?: number;
          following_count?: number; video_count?: number; likes_count?: number;
          bio_description?: string; profile_web_url?: string;
        }
      }
    };
    const user = userData.data?.user;
    if (user) {
      base.accountName = user.display_name ? `@${user.display_name}` : accountName;
      base.profilePictureUrl = user.avatar_url;
      base.followers = user.follower_count ?? null;
      base.following = user.following_count ?? null;
      base.mediaCount = user.video_count ?? null;
      base.biography = user.bio_description;
      base.website = user.profile_web_url;
    }

    // Recent videos
    try {
      const videosRes = await fetchWithTimeout(
        "https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,create_time,like_count,comment_count,share_count,view_count",
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ max_count: 9 }) }
      );
      if (videosRes.ok) {
        const videosData = await videosRes.json() as {
          data?: { videos?: Array<{ id: string; title?: string; cover_image_url?: string; create_time?: number; like_count?: number; comment_count?: number; share_count?: number; view_count?: number }> }
        };
        const videos = videosData.data?.videos ?? [];
        base.recentPosts = videos.map(v => ({
          id: v.id,
          thumbnailUrl: v.cover_image_url,
          caption: v.title,
          timestamp: v.create_time ? new Date(v.create_time * 1000).toISOString() : undefined,
          likes: v.like_count ?? 0,
          comments: v.comment_count ?? 0,
          reach: v.view_count ?? 0,
          impressions: v.view_count ?? 0,
        }));
        if (base.recentPosts.length > 0) {
          const engSum = base.recentPosts.reduce((s, p) => s + p.likes + p.comments, 0);
          base.avgEngagement = Math.round(engSum / base.recentPosts.length);

          // Fallback daily metrics from posts sorted by date (TikTok has no historical API)
          const cutoff = Date.now() - 30 * 86400_000;
          const dailyMap: Record<string, DailyMetricPoint> = {};
          for (const p of base.recentPosts) {
            if (!p.timestamp) continue;
            const ts = new Date(p.timestamp).getTime();
            if (ts < cutoff) continue;
            const date = p.timestamp.split("T")[0];
            if (!dailyMap[date]) dailyMap[date] = { date, reach: 0, impressions: 0 };
            dailyMap[date].reach = (dailyMap[date].reach ?? 0) + p.reach;
            dailyMap[date].impressions = (dailyMap[date].impressions ?? 0) + p.impressions;
          }
          base.dailyMetrics = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        }
      }
    } catch { /* non-critical */ }

    return base;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: msg.includes("abort") ? "Timeout ao buscar dados" : msg };
  }
}

export async function getAccountsWithAnalytics(workspaceId: string): Promise<AccountAnalytics[]> {
  // Fetch accounts WITH access tokens for live API calls
  const accounts = (await db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      accessToken: workspaceIntegrationsTable.accessToken,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.isPaymentGateway, false),
        inArray(workspaceIntegrationsTable.provider, ["instagram", "facebook", "meta_ads", "tiktok_ads"]),
        inArray(workspaceIntegrationsTable.status, ["connected", "expired"])
      )
    )).filter((account) => isOrganicSocialIntegration(account.metadata as Record<string, unknown>));

  const results = await Promise.allSettled(
    accounts.map(async (acct) => {
      const token = acct.accessToken ?? "";
      const id = acct.id;
      const name = acct.accountName ?? "Conta";
      const accountId = acct.accountId ?? "";
      const status = acct.status;

      if (acct.provider === "instagram") {
        return fetchInstagramAnalytics(id, accountId, name, token, status);
      }
      if (acct.provider === "facebook" || acct.provider === "meta_ads") {
        const pageId = (acct.metadata as Record<string, string> | null)?.["pageId"] ?? accountId;
        return fetchFacebookAnalytics(id, pageId, name, token, status);
      }
      if (acct.provider === "tiktok_ads") {
        return fetchTikTokAnalytics(id, accountId, name, token, status);
      }
      // Unsupported — return stub
      return {
        integrationId: id,
        provider: acct.provider,
        accountName: name,
        accountId,
        followers: null,
        following: null,
        mediaCount: null,
        avgEngagement: null,
        totalReach30d: null,
        totalImpressions30d: null,
        dailyMetrics: [],
        recentPosts: [],
        status,
      } satisfies AccountAnalytics;
    })
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const acct = accounts[i]!;
    return {
      integrationId: acct.id,
      provider: acct.provider,
      accountName: acct.accountName ?? "Conta",
      accountId: acct.accountId,
      followers: null,
      following: null,
      mediaCount: null,
      avgEngagement: null,
      totalReach30d: null,
      totalImpressions30d: null,
      dailyMetrics: [],
      recentPosts: [],
      status: acct.status,
      error: r.reason instanceof Error ? r.reason.message : "Erro desconhecido",
    } satisfies AccountAnalytics;
  });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(
  workspaceId: string,
  data: Omit<InsertSocialPost, "workspaceId">
): Promise<SocialPost> {
  const integration = await getIntegration(workspaceId, data.integrationId);
  if (!integration) throw new NotFoundError("Integration not found");
  if (data.campaignId) {
    const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, data.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
    if (!campaign) throw new NotFoundError("Campaign not found");
  }
  const approved = data.campaignId ? await getApprovedMasterplan(workspaceId, data.campaignId) : undefined;

  const [post] = await db
    .insert(socialPostsTable)
    .values({ ...data, workspaceId, masterplanVersionId: approved?.id, contextFingerprint: approved?.contextFingerprint })
    .returning();

  if (!post) throw new AppError(500, "Falha ao criar post", "DB_ERROR");
  await db.insert(executionEvidenceTable).values({
    workspaceId, campaignId: post.campaignId, masterplanVersionId: approved?.id, contextFingerprint: approved?.contextFingerprint,
    subjectType: "social_post", subjectId: post.id, state: "planned", details: { platform: post.platform, postType: post.postType },
  });
  logger.info({ workspaceId, postId: post.id, platform: post.platform }, "Social post created");
  return post;
}

const CAMPAIGN_SOCIAL_PROVIDERS: Record<string, { platform: SocialPost["platform"]; postType: SocialPost["postType"] }> = {
  instagram: { platform: "instagram", postType: "feed_image" },
  meta_ads: { platform: "facebook_page", postType: "feed_image" },
  tiktok_ads: { platform: "tiktok", postType: "feed_video" },
};
const CAMPAIGN_TYPE_PROVIDERS: Record<string, string[]> = {
  instagram_post: ["instagram"], instagram_story: ["instagram"], instagram_reel: ["instagram"],
  facebook_post: ["meta_ads"], facebook_video: ["meta_ads"],
  feed_image: ["instagram", "meta_ads"], feed_video: ["instagram", "meta_ads", "tiktok_ads"],
  story: ["instagram"], reel: ["instagram", "tiktok_ads"], carousel: ["instagram"],
  tiktok_video: ["tiktok_ads"], tiktok_reel: ["tiktok_ads"], short_video: ["tiktok_ads"],
};

function campaignProvidersForPiece(type: string, content: unknown): string[] {
  const explicit = CAMPAIGN_TYPE_PROVIDERS[type];
  if (explicit) return explicit;
  if (type !== "social_post" && type !== "content_calendar") return [];
  const value = content && typeof content === "object" ? content as Record<string, unknown> : {};
  const requested = typeof value.platform === "string" ? value.platform.toLowerCase() : "";
  if (requested === "tiktok" || requested === "tiktok_ads") return campaignPieceMedia(content).length > 0 ? ["tiktok_ads"] : [];
  if (requested === "instagram") return campaignPieceMedia(content).length > 0 ? ["instagram"] : [];
  if (requested === "facebook" || requested === "facebook_page" || requested === "meta_ads") return ["meta_ads"];
  // Generic text content must not be sent to TikTok (or Instagram, which
  // requires media). Facebook is the only compatible text target.
  return campaignPieceMedia(content).length > 0 ? ["instagram", "meta_ads"] : ["meta_ads"];
}

function campaignPieceCaption(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 2200);
  if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    for (const key of ["caption", "body", "text", "copy", "message", "content"]) {
      if (typeof value[key] === "string") return (value[key] as string).slice(0, 2200);
    }
  }
  return "";
}

function campaignPieceMedia(content: unknown): string[] {
  if (!content || typeof content !== "object") return [];
  const value = content as Record<string, unknown>;
  for (const key of ["mediaUrls", "media_urls", "imageUrls", "videoUrls"]) {
    if (Array.isArray(value[key])) return value[key].filter((item): item is string => typeof item === "string");
  }
  for (const key of ["mediaUrl", "imageUrl", "videoUrl", "url"]) {
    if (typeof value[key] === "string") return [value[key] as string];
  }
  return [];
}

type CampaignPublishPreview = {
  platforms: { provider: string; platform: string; label: string; integrationId: string; accountId: string | null }[];
  pieceType: string;
  caption: string;
  mediaUrls: string[];
  masterplanVersionId: string;
  fingerprint: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stableValue(v)]));
  return value;
}

function publicationFingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(input))).digest("hex");
}

/**
 * Workspace/campaign-scoped preview and confirmation boundary.  This is
 * intentionally separate from the legacy autopost adapter: explicit
 * confirmation creates durable posts and routes every mutation through
 * publishPost's lease/readback governance.
 */
export async function getCampaignPublishPreview(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
): Promise<CampaignPublishPreview> {
  const [piece] = await db.select().from(contentPiecesTable).where(and(
    eq(contentPiecesTable.id, pieceId),
    eq(contentPiecesTable.campaignId, campaignId),
    eq(contentPiecesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!piece) throw new NotFoundError("Content piece not found");
  const approved = await getApprovedMasterplan(workspaceId, campaignId);
  if (!matchesApprovedDossier(approved, {
    campaignId, masterplanVersionId: approved?.id, contextFingerprint: approved?.contextFingerprint,
  })) {
    throw new AppError(409, "Campanha não possui um Master Plan aprovado", "MASTERPLAN_CONTEXT_MISMATCH");
  }
  if (piece.status !== "approved") {
    throw new AppError(409, "A peça de conteúdo precisa estar aprovada antes da publicação", "CONTENT_NOT_APPROVED");
  }
  const providers = campaignProvidersForPiece(piece.type, piece.content);
  const integrations = await db.select({ id: workspaceIntegrationsTable.id, provider: workspaceIntegrationsTable.provider, accountId: workspaceIntegrationsTable.accountId, metadata: workspaceIntegrationsTable.metadata }).from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.workspaceId, workspaceId),
    inArray(workspaceIntegrationsTable.provider, providers as any),
    eq(workspaceIntegrationsTable.status, "connected"),
  ));
  const labels: Record<string, string> = { instagram: "Instagram", meta_ads: "Facebook", tiktok_ads: "TikTok" };
  const eligibleIntegrations = integrations.filter((item) => isOrganicSocialIntegration(item.metadata as Record<string, unknown>));
  const platforms = eligibleIntegrations.map((item) => ({
      provider: item.provider,
      platform: CAMPAIGN_SOCIAL_PROVIDERS[item.provider]?.platform ?? item.provider,
      label: labels[item.provider] ?? item.provider,
      integrationId: item.id,
      accountId: item.accountId,
    }));
  return {
    platforms,
    pieceType: piece.type,
    caption: campaignPieceCaption(piece.content).slice(0, 280),
    mediaUrls: campaignPieceMedia(piece.content),
    masterplanVersionId: approved.id,
    fingerprint: publicationFingerprint({
      workspaceId, campaignId, pieceId, content: piece.content,
      masterplan: { id: approved.id, contentHash: approved.contentHash, contextFingerprint: approved.contextFingerprint },
      targets: platforms.map(({ provider, platform, integrationId, accountId }) => ({ provider, platform, integrationId, accountId })),
      caption: campaignPieceCaption(piece.content), mediaUrls: campaignPieceMedia(piece.content),
    }),
  };
}

export async function publishCampaignContentPiece(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
  expectedFingerprint: string,
): Promise<Array<{ postId?: string; integrationId: string; platform: string; status: string; confirmed: boolean; providerPostId?: string | null; errorCode?: string }>> {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new AppError(409, "Gere e confirme uma prévia antes de publicar", "PUBLISH_PREVIEW_REQUIRED");
  }
  const initialPreview = await getCampaignPublishPreview(workspaceId, campaignId, pieceId);
  if (expectedFingerprint !== initialPreview.fingerprint) {
    throw new AppError(409, "Preview desatualizado; gere uma nova prévia antes de confirmar", "PUBLISH_PREVIEW_STALE");
  }
  const [piece] = await db.select().from(contentPiecesTable).where(and(
    eq(contentPiecesTable.id, pieceId),
    eq(contentPiecesTable.campaignId, campaignId),
    eq(contentPiecesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!piece) throw new NotFoundError("Content piece not found");
  if (piece.status !== "approved") throw new AppError(409, "A peça de conteúdo precisa estar aprovada antes da publicação", "CONTENT_NOT_APPROVED");
  const approved = await getApprovedMasterplan(workspaceId, campaignId);
  if (!approved) throw new AppError(409, "Campanha não possui um Master Plan aprovado", "MASTERPLAN_CONTEXT_MISMATCH");
  const providers = campaignProvidersForPiece(piece.type, piece.content);
  const integrations = (await db.select().from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.workspaceId, workspaceId),
    inArray(workspaceIntegrationsTable.provider, providers as any),
    eq(workspaceIntegrationsTable.status, "connected"),
  ))).filter((item) => isOrganicSocialIntegration(item.metadata as Record<string, unknown>));
  const created: Array<{ postId?: string; integrationId: string; platform: string; status: string; confirmed: boolean; providerPostId?: string | null; errorCode?: string }> = [];
  for (const integration of integrations) {
    const mapping = CAMPAIGN_SOCIAL_PROVIDERS[integration.provider];
    if (!mapping) continue;
    // Re-read the source and target set before each durable write. This
    // prevents confirmation from silently reusing a post after source,
    // approved dossier, account, or connected target changed.
    let currentPreview: CampaignPublishPreview;
    try {
      currentPreview = await getCampaignPublishPreview(workspaceId, campaignId, pieceId);
    } catch (error) {
      const code = error instanceof AppError ? error.code : "PUBLISH_PREVIEW_STALE";
      created.push(...initialPreview.platforms
        .filter((target) => !created.some((item) => item.integrationId === target.integrationId))
        .map((target) => ({ integrationId: target.integrationId, platform: target.platform, status: "stale", confirmed: false, errorCode: code })));
      break;
    }
    if (currentPreview.fingerprint !== expectedFingerprint) {
      const staleTargets = [...initialPreview.platforms, ...currentPreview.platforms]
        .filter((target, index, all) => all.findIndex((item) => item.integrationId === target.integrationId) === index)
        .filter((target) => !created.some((item) => item.integrationId === target.integrationId));
      created.push(...staleTargets.map((target) => ({
        integrationId: target.integrationId, platform: target.platform, status: "stale",
        confirmed: false, errorCode: "PUBLISH_PREVIEW_STALE",
      })));
      break;
    }
    const post = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${workspaceId}:${pieceId}:${integration.id}`}))`);
      let [existing] = await tx.select().from(socialPostsTable).where(and(
        eq(socialPostsTable.workspaceId, workspaceId),
        eq(socialPostsTable.campaignId, campaignId),
        eq(socialPostsTable.contentPieceId, pieceId),
        eq(socialPostsTable.integrationId, integration.id),
      )).limit(1);
      if (existing) {
        const expectedCaption = campaignPieceCaption(piece.content);
        const expectedMedia = campaignPieceMedia(piece.content);
        const samePayload = existing.masterplanVersionId === approved.id
          && existing.contextFingerprint === approved.contextFingerprint
          && existing.platform === mapping.platform
          && existing.postType === mapping.postType
          && existing.caption === expectedCaption
          && JSON.stringify(existing.mediaUrls ?? []) === JSON.stringify(expectedMedia);
        if (!samePayload) return { stale: true as const, existing };
      }
      if (!existing) {
        [existing] = await tx.insert(socialPostsTable).values({
          workspaceId, campaignId, contentPieceId: pieceId, integrationId: integration.id,
          platform: mapping.platform, postType: mapping.postType, status: "draft",
          caption: campaignPieceCaption(piece.content), hashtags: [],
          mediaUrls: campaignPieceMedia(piece.content), aiGenerated: true,
          masterplanVersionId: approved.id, contextFingerprint: approved.contextFingerprint,
        }).returning();
      }
      return existing ? { stale: false as const, post: existing } : { stale: false as const, post: undefined };
    });
    if (post.stale) {
      created.push({
        postId: post.existing.id, integrationId: integration.id, platform: mapping.platform,
        status: "stale", confirmed: false, providerPostId: post.existing.platformPostId,
        errorCode: "PUBLISH_BINDING_STALE",
      });
      continue;
    }
    if (!post.post) continue;
    try {
      const published = await publishPost(workspaceId, post.post.id);
      created.push({
        postId: published.id, integrationId: published.integrationId, platform: published.platform,
        status: published.status, confirmed: published.status === "published",
        providerPostId: published.platformPostId,
      });
    } catch (error) {
      const code = error instanceof AppError ? error.code : "PUBLISH_FAILED";
      const current = await getPost(workspaceId, post.post.id);
      created.push({
        postId: current.id, integrationId: current.integrationId, platform: current.platform,
        status: current.status, confirmed: false, providerPostId: current.platformPostId,
        errorCode: code,
      });
    }
  }
  return created;
}

export async function listPosts(
  workspaceId: string,
  filters: {
    campaignId?: string;
    platform?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ posts: SocialPost[]; total: number }> {
  const conditions: ReturnType<typeof eq>[] = [eq(socialPostsTable.workspaceId, workspaceId)];
  if (filters.campaignId) conditions.push(eq(socialPostsTable.campaignId, filters.campaignId));
  if (filters.status) conditions.push(eq(socialPostsTable.status, filters.status as "draft" | "scheduled" | "published" | "failed" | "cancelled"));

  const rows = await db
    .select()
    .from(socialPostsTable)
    .where(and(...conditions))
    .orderBy(socialPostsTable.scheduledAt)
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return { posts: rows, total: rows.length };
}

export async function getPost(workspaceId: string, postId: string): Promise<SocialPost> {
  const [post] = await db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.id, postId),
        eq(socialPostsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!post) throw new NotFoundError("Post not found");
  return post;
}

export async function updatePost(
  workspaceId: string,
  postId: string,
  data: Partial<Pick<InsertSocialPost, "caption" | "hashtags" | "mediaUrls" | "scheduledAt" | "callToAction" | "linkUrl">>
): Promise<SocialPost> {
  const existing = await getPost(workspaceId, postId);
  if (!["draft", "scheduled"].includes(existing.status)) {
    throw new AppError(400, "Só é possível editar posts em draft ou scheduled", "INVALID_STATUS");
  }

  const [updated] = await db
    .update(socialPostsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)))
    .returning();

  if (!updated) throw new AppError(500, "Falha ao atualizar post", "DB_ERROR");
  return updated;
}

export async function cancelPost(workspaceId: string, postId: string): Promise<void> {
  const existing = await getPost(workspaceId, postId);
  if (!["draft", "scheduled"].includes(existing.status)) {
    throw new AppError(400, "Só é possível cancelar posts em draft ou scheduled", "INVALID_STATUS");
  }

  await db
    .update(socialPostsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export async function publishPost(workspaceId: string, postId: string): Promise<SocialPost> {
  // Resolve the post before doing any state transition or credential lookup. This
  // is deliberately workspace-scoped: post IDs must never authorize a caller to
  // publish a post belonging to another workspace.
  const post = await getPost(workspaceId, postId);
  const approvedDossier = post.campaignId ? await getApprovedMasterplan(workspaceId, post.campaignId) : undefined;
  if (!matchesApprovedDossier(approvedDossier, post)) {
    throw new AppError(409, "Social post dossier is stale or no longer approved; regenerate it from the current dossier", "MASTERPLAN_CONTEXT_MISMATCH");
  }
  // Campaign publications are only valid when they still point at the
  // approved source piece.  Keep this check immediately before any pause,
  // credential, lease, or provider work so a stale/draft piece cannot mutate
  // an external account.
  if (post.campaignId) {
    if (!post.contentPieceId) {
      throw new AppError(409, "Publicação de campanha requer uma peça de conteúdo aprovada", "CONTENT_BINDING_REQUIRED");
    }
    const [piece] = await db.select({
      id: contentPiecesTable.id,
      campaignId: contentPiecesTable.campaignId,
      workspaceId: contentPiecesTable.workspaceId,
      status: contentPiecesTable.status,
    }).from(contentPiecesTable).where(and(
      eq(contentPiecesTable.id, post.contentPieceId),
      eq(contentPiecesTable.campaignId, post.campaignId),
      eq(contentPiecesTable.workspaceId, workspaceId),
    )).limit(1);
    if (!piece || piece.status !== "approved") {
      throw new AppError(409, "A peça de conteúdo da campanha não está aprovada ou não pertence à campanha", "CONTENT_BINDING_MISMATCH");
    }
  }
  // Re-reads above are intentional even for an already published row: a
  // caller must never turn an old receipt into confirmation of a new request.
  if (post.status === "published") return post;
  if (["failed", "cancelled"].includes(post.status)) {
    throw new AppError(400, `Cannot publish post in status: ${post.status}`, "INVALID_STATUS");
  }
  const pauseChannel = post.platform === "instagram" ? "instagram"
    : post.platform === "facebook_page" ? "facebook"
      : post.platform === "tiktok" ? "tiktok" : null;
  if (pauseChannel) {
    await enforceNoMandatoryPause(post.workspaceId, {
      campaignId: post.campaignId ?? undefined,
      channel: pauseChannel,
      action: "social_publish",
    });
  }

  const integration = await getIntegration(workspaceId, post.integrationId);
  const expectedProvider = post.platform === "instagram" ? "instagram"
    : post.platform === "facebook_page" ? "meta_ads" : post.platform === "tiktok" ? "tiktok_ads" : null;
  if (!integration || (expectedProvider && integration.provider !== expectedProvider)) {
    await markFailed(workspaceId, postId, "Integração incompatível com a plataforma do post");
    throw new AppError(400, "Integração incompatível", "INTEGRATION_ERROR");
  }
  if (!integration || integration.status !== "connected" ||
      (integration.tokenExpiresAt && integration.tokenExpiresAt <= new Date())) {
    if (integration && integration.status === "connected" && integration.tokenExpiresAt && integration.tokenExpiresAt <= new Date()) {
      await db.update(workspaceIntegrationsTable).set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(workspaceIntegrationsTable.id, integration.id), eq(workspaceIntegrationsTable.workspaceId, workspaceId)));
    }
    await markFailed(workspaceId, postId, "Integração não conectada ou expirada");
    throw new AppError(400, "Integração não conectada", "INTEGRATION_ERROR");
  }
  const readiness = await checkSocialCredentialReadiness(post.platform, integration);
  if (!readiness.ok) {
    if (readiness.kind === "transient") {
      const retryCount = post.retryCount + 1;
      const nextAttempt = new Date(Date.now() + Math.min(15 * 60_000, 60_000 * (2 ** Math.min(retryCount - 1, 3))));
      await db.update(socialPostsTable).set({ status: "scheduled", retryCount, scheduledAt: nextAttempt, errorMessage: "Provider temporariamente indisponível", updatedAt: new Date() })
        .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));
      throw new AppError(503, "Provider temporariamente indisponível", "PUBLISH_RETRYABLE");
    }
    if (readiness.integrationStatus) {
      await db.update(workspaceIntegrationsTable).set({ status: readiness.integrationStatus, updatedAt: new Date() })
        .where(and(eq(workspaceIntegrationsTable.id, integration.id), eq(workspaceIntegrationsTable.workspaceId, workspaceId)));
    }
    await markFailed(workspaceId, postId, "Integração não autorizada para publicação");
    throw new AppError(400, "Integração não autorizada", "INTEGRATION_ERROR");
  }

  const fingerprint = createHash("sha256").update(JSON.stringify({
    platform: post.platform, postType: post.postType, caption: post.caption ?? "",
    hashtags: post.hashtags ?? [], mediaUrls: post.mediaUrls ?? [], linkUrl: post.linkUrl ?? "",
  })).digest("hex");
  // One durable attempt identity spans retries and process restarts. The attempt
  // row, rather than the post status, is the authoritative external-action lease.
  const attemptKey = `${workspaceId}:${post.id}:${fingerprint}`;
  const [attemptBeforeInsert] = await db.select().from(socialPublishAttemptsTable).where(and(
    eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.postId, post.id),
    eq(socialPublishAttemptsTable.attemptKey, attemptKey),
  )).limit(1);
  if (post.status === "publishing" && !attemptBeforeInsert) {
    throw new AppError(409, "Publicação em andamento sem tentativa recuperável", "PUBLISH_LEASE_HELD");
  }
  await db.insert(socialPublishAttemptsTable).values({
    workspaceId, postId: post.id, attemptKey, contentFingerprint: fingerprint,
  }).onConflictDoNothing();
  const [existingAttempt] = await db.select().from(socialPublishAttemptsTable).where(and(
    eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.postId, post.id),
    eq(socialPublishAttemptsTable.attemptKey, attemptKey),
  )).limit(1);
  if (!existingAttempt) throw new AppError(500, "Falha ao criar tentativa de publicação", "DB_ERROR");
  if (existingAttempt.state === "confirmed") return getPost(workspaceId, postId);
  if (existingAttempt.state === "ambiguous" || existingAttempt.state === "manual_recovery") {
    throw new AppError(409, "Resultado do provedor requer reconciliação manual", "PUBLISH_MANUAL_RECOVERY");
  }
  const owner = `${process.pid}:${randomUUID()}`;
  const leaseUntil = new Date(Date.now() + 15 * 60_000);
  const [attempt] = await db.update(socialPublishAttemptsTable).set({
    state: "executing", leaseOwner: owner, leaseExpiresAt: leaseUntil,
    retryCount: existingAttempt.retryCount + 1, updatedAt: new Date(),
  }).where(and(
    eq(socialPublishAttemptsTable.id, existingAttempt.id),
    eq(socialPublishAttemptsTable.workspaceId, workspaceId),
    or(eq(socialPublishAttemptsTable.state, "retryable"),
      and(eq(socialPublishAttemptsTable.state, "executing"),
        or(lte(socialPublishAttemptsTable.leaseExpiresAt, new Date()), isNull(socialPublishAttemptsTable.leaseExpiresAt)))),
  )).returning();
  if (!attempt) {
    const current = await getPost(workspaceId, postId);
    if (current.status === "published") return current;
    throw new AppError(409, "Publicação já está em andamento", "PUBLISH_LEASE_HELD");
  }
  // A reclaimed lease with any provider identifier is recovery-only. Never
  // submit again until an independent readback proves it was not published.
  const recordedProviderId = existingAttempt.providerPublishId ?? existingAttempt.providerContainerId;
  const finalProviderStage = ["published", "media_published", "publish_initialized"].includes(existingAttempt.providerStage ?? "");
  if (recordedProviderId && !finalProviderStage) {
    await db.update(socialPublishAttemptsTable).set({
      state: "manual_recovery", error: "Intermediate provider artifact has no final publish receipt",
      leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    throw new AppError(409, "Publicação intermediária requer recuperação manual", "PUBLISH_MANUAL_RECOVERY");
  }
  if (recordedProviderId) {
    const recovered = await readBackSocialPost(post.platform, integration, recordedProviderId, post.postType);
    if (recovered.pending) {
      const nextAttempt = new Date(Date.now() + 60_000);
      await db.update(socialPublishAttemptsTable).set({
        state: "retryable", nextAttemptAt: nextAttempt, leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(),
      }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
      throw new AppError(503, "Readback do provedor ainda pendente", "PUBLISH_PENDING");
    }
    if (recovered.confirmed) {
      await db.update(socialPublishAttemptsTable).set({
        state: "confirmed", readback: { confirmed: true, providerPostId: recovered.platformPostId, providerUrl: recovered.platformUrl, accountId: recovered.accountId },
        leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(),
      }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
      const [recoveredPost] = await db.update(socialPostsTable).set({
        status: "published", platformPostId: recovered.platformPostId ?? recordedProviderId,
        platformUrl: recovered.platformUrl ?? null, publishedAt: new Date(), updatedAt: new Date(),
      }).where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId))).returning();
      return recoveredPost!;
    }
    await db.update(socialPublishAttemptsTable).set({ state: "manual_recovery", error: "Recorded provider identifier could not be reconciled", updatedAt: new Date() })
      .where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    throw new AppError(409, "Resultado do provedor requer reconciliação manual", "PUBLISH_MANUAL_RECOVERY");
  }
  if (existingAttempt.providerStage?.includes("intent")) {
    await db.update(socialPublishAttemptsTable).set({
      state: "manual_recovery", error: "Provider mutation intent has no receipt identifier; bounded lookup required",
      leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    throw new AppError(409, "Intenção do provedor sem recibo requer recuperação manual", "PUBLISH_MANUAL_RECOVERY");
  }

  // Keep the post status as a compatibility projection; the attempt lease is
  // what prevents concurrent provider mutation and permits safe recovery.
  const staleLease = new Date(Date.now() - 15 * 60_000);
  const [claimed] = await db.update(socialPostsTable)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(and(
      eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId),
      or(eq(socialPostsTable.status, "draft"), eq(socialPostsTable.status, "scheduled"),
        and(eq(socialPostsTable.status, "publishing"), lte(socialPostsTable.updatedAt, staleLease))),
    )).returning();
  if (!claimed) {
    const current = await getPost(workspaceId, postId);
    if (current.status === "published") return current;
    throw new AppError(409, "Publicação já está em andamento", "PUBLISH_LEASE_HELD");
  }

  await db.insert(executionEvidenceTable).values({
    workspaceId, campaignId: post.campaignId, masterplanVersionId: post.masterplanVersionId, contextFingerprint: post.contextFingerprint,
    subjectType: "social_post", subjectId: post.id, state: "attempted",
    details: { platform: post.platform, attemptKey, mediaCaptionFingerprint: fingerprint },
  });

  let result;
  const onProviderStage = async (stage: { name: string; providerId?: string; intent?: boolean }): Promise<void> => {
    const finalReceipt = !stage.intent && ["published", "media_published", "publish_initialized"].includes(stage.name);
    const [stageRow] = await db.update(socialPublishAttemptsTable).set({
      providerStage: stage.name,
      providerContainerId: !stage.intent && !finalReceipt ? stage.providerId : undefined,
      providerPublishId: finalReceipt ? stage.providerId : undefined,
      receipt: !stage.intent && stage.providerId ? { providerId: stage.providerId, stage: stage.name } : {},
      updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner), eq(socialPublishAttemptsTable.state, "executing"))).returning();
    if (stageRow?.id !== attempt.id) {
      throw new AppError(409, "Lease de publicação perdido antes da mutação do provedor", "PUBLISH_LEASE_LOST");
    }
  };
  switch (post.platform) {
    case "instagram":
       result = await publishToInstagram(post, integration, { attemptKey, onStage: onProviderStage });
      break;
    case "facebook_page":
       result = await publishToFacebook(post, integration, { attemptKey, onStage: onProviderStage });
      break;
    case "tiktok":
       result = await publishToTikTok(post, integration, { attemptKey, onStage: onProviderStage });
      break;
    default:
      result = { success: false, error: `Platform ${post.platform} not yet supported for direct publishing` };
  }

  if (!result.success) {
    const retryCount = post.retryCount + 1;
    if (result.ambiguous) {
      await db.update(socialPublishAttemptsTable).set({
        state: "ambiguous", error: "Ambiguous provider outcome; reconciliation required", updatedAt: new Date(),
      }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
      throw new AppError(502, "Resultado do provedor não determinístico; recuperação manual necessária", "PUBLISH_MANUAL_RECOVERY");
    }
    const terminal = /401|403|permission|not authorized|invalid token|expired|rejected|content/i.test(result.error ?? "");
    const nextAttempt = new Date(Date.now() + Math.min(15 * 60_000, 60_000 * (2 ** Math.min(retryCount - 1, 3))));
    await db.update(socialPublishAttemptsTable).set({
      state: terminal ? "terminal" : "retryable",
      nextAttemptAt: terminal ? null : nextAttempt,
      error: result.error ?? "Provider rejected publication",
      updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    await db
      .update(socialPostsTable)
      .set({
        status: terminal || retryCount >= 4 ? "failed" : "scheduled",
        scheduledAt: terminal ? post.scheduledAt : nextAttempt,
        errorMessage: result.error ?? "Provider rejected publication",
        retryCount,
        updatedAt: new Date(),
      })
      .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));
    if (terminal) {
      await db.update(workspaceIntegrationsTable).set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(workspaceIntegrationsTable.id, integration.id), eq(workspaceIntegrationsTable.workspaceId, workspaceId)));
    }
    throw new AppError(500, result.error ?? "Publish failed", "PUBLISH_FAILED");
  }

  if (!result.platformPostId) {
    await db.update(socialPublishAttemptsTable).set({ state: "manual_recovery", error: "Provider receipt missing object id", updatedAt: new Date() })
      .where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    await markFailed(workspaceId, postId, "Provider não retornou um identificador verificável");
    throw new AppError(502, "Publicação não verificável", "PUBLISH_UNCONFIRMED");
  }
  const readback = await readBackSocialPost(post.platform, integration, result.platformPostId, post.postType);
  if (readback.pending) {
    const nextAttempt = new Date(Date.now() + Math.min(15 * 60_000, 60_000 * (2 ** Math.min(post.retryCount, 3))));
    await db.update(socialPublishAttemptsTable).set({
      state: "retryable", nextAttemptAt: nextAttempt, leaseOwner: null, leaseExpiresAt: null,
      providerPublishId: result.platformPostId, updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    throw new AppError(503, "Publicação TikTok ainda pendente", "PUBLISH_PENDING");
  }
  if (!readback.confirmed) {
    await db.update(socialPublishAttemptsTable).set({
      state: "manual_recovery", providerPublishId: result.platformPostId,
      receipt: { providerPostId: result.platformPostId }, readback: { confirmed: false },
      error: "Provider readback did not prove publication", updatedAt: new Date(),
    }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));
    await markFailed(workspaceId, postId, "Publicação submetida, mas não confirmada pelo provedor; recuperação manual necessária");
    throw new AppError(502, "Publicação não confirmada", "PUBLISH_UNCONFIRMED");
  }
  const [updated] = await db
    .update(socialPostsTable)
    .set({
      status: "published",
      publishedAt: new Date(),
      platformPostId: readback.platformPostId ?? result.platformPostId ?? null,
      platformUrl: readback.platformUrl ?? result.platformUrl ?? null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)))
    .returning();
  await db.insert(executionEvidenceTable).values({
    workspaceId, campaignId: post.campaignId, masterplanVersionId: post.masterplanVersionId, contextFingerprint: post.contextFingerprint,
    subjectType: "social_post", subjectId: post.id, state: "provider_confirmed",
     details: { platform: post.platform, providerPostId: result.platformPostId, providerUrl: readback.platformUrl ?? result.platformUrl ?? null, mediaCaptionFingerprint: fingerprint, attemptKey },
  });
  await db.update(socialPublishAttemptsTable).set({
    state: "confirmed", providerPublishId: result.platformPostId,
    receipt: { providerPostId: result.platformPostId, providerUrl: result.platformUrl ?? null },
    readback: { confirmed: true, providerPostId: readback.platformPostId, providerUrl: readback.platformUrl, accountId: readback.accountId },
    leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(),
  }).where(and(eq(socialPublishAttemptsTable.id, attempt.id), eq(socialPublishAttemptsTable.workspaceId, workspaceId), eq(socialPublishAttemptsTable.leaseOwner, owner)));

  logger.info({ postId, platform: post.platform, platformPostId: result.platformPostId }, "Post published");
  return updated!;
}

export async function syncPostMetrics(workspaceId: string, postId: string): Promise<SocialPost> {
  // Do not fold the status into this lookup. A missing foreign post must be
  // indistinguishable from an absent post, while a local non-published post can
  // safely be returned without contacting a provider.
  const post = await getPost(workspaceId, postId);
  if (post.status !== "published" || !post.platformPostId) return post;

  const integration = await getIntegration(workspaceId, post.integrationId);
  const expectedProvider = post.platform === "instagram" ? "instagram"
    : post.platform === "facebook_page" ? "meta_ads"
      : post.platform === "tiktok" ? "tiktok_ads" : null;
  if (
    !integration ||
    !expectedProvider ||
    integration.provider !== expectedProvider ||
    integration.status !== "connected" ||
    !integration.accessToken?.trim() ||
    !integration.accountId?.trim() ||
    (integration.tokenExpiresAt && integration.tokenExpiresAt <= new Date())
  ) {
    if (
      integration &&
      integration.status === "connected" &&
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt <= new Date()
    ) {
      await db.update(workspaceIntegrationsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(
          eq(workspaceIntegrationsTable.id, integration.id),
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        ));
    }
    return post;
  }

  let metrics;
  try {
    if (post.platform === "instagram") {
      metrics = await getInstagramMetrics(post.platformPostId, integration.accessToken);
    } else if (post.platform === "tiktok") {
      metrics = await getTikTokMetrics(post.platformPostId, integration.accessToken);
    } else {
      return post;
    }
  } catch (error) {
    if (error instanceof ProviderOutcomeError && (error.statusCode === 401 || error.statusCode === 403)) {
      await db.update(workspaceIntegrationsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(
          eq(workspaceIntegrationsTable.id, integration.id),
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        ));
    }
    return post;
  }

  const [updated] = await db
    .update(socialPostsTable)
    .set({ metrics, updatedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)))
    .returning();

  return updated ?? post;
}

export async function getDueScheduledPosts(): Promise<SocialPost[]> {
  const staleLease = new Date(Date.now() - 15 * 60_000);
  const posts = await db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        or(
          and(eq(socialPostsTable.status, "scheduled"), lte(socialPostsTable.scheduledAt, new Date())),
          and(eq(socialPostsTable.status, "publishing"), lte(socialPostsTable.updatedAt, staleLease)),
        ),
      )
    )
    .limit(20);
  const dueAttempts = await db.select({
    workspaceId: socialPublishAttemptsTable.workspaceId,
    postId: socialPublishAttemptsTable.postId,
  }).from(socialPublishAttemptsTable).where(and(
    eq(socialPublishAttemptsTable.state, "retryable"),
    lte(socialPublishAttemptsTable.nextAttemptAt, new Date()),
  )).limit(20);
  const recovered = await Promise.all(dueAttempts.map((row) => getPost(row.workspaceId, row.postId).catch(() => null)));
  const seen = new Set(posts.map((post) => post.id));
  return posts.concat(recovered.filter((post): post is SocialPost => post !== null && !seen.has(post.id)));
}

// ─── Auto-schedule from campaign ──────────────────────────────────────────────

export async function schedulePostsForCampaign(
  _workspaceId: string,
  _campaignId: string,
  _contentPieceIds: string[],
  _integrationIds: string[],
  _startDate: Date
): Promise<SocialPost[]> {
  throw new AppError(
    409,
    "Agendamento de campanha requer uma política versionada e confirmação por prévia",
    "CAMPAIGN_SCHEDULE_CONFIRMATION_REQUIRED",
  );
}

// ─── Webhook processing ───────────────────────────────────────────────────────

// Both legacy callback URLs delegate DM processing here. This short-lived claim
// prevents a dual-configured Meta app from advancing the same DM twice. Durable
// provider-event claims are added with the webhook audit schema.
const recentMetaDmDeliveries = new Map<string, number>();
const META_DELIVERY_TTL_MS = 10 * 60 * 1000;

function claimMetaDmDelivery(key: string): boolean {
  const now = Date.now();
  for (const [existingKey, receivedAt] of recentMetaDmDeliveries) {
    if (now - receivedAt > META_DELIVERY_TTL_MS) recentMetaDmDeliveries.delete(existingKey);
  }
  if (recentMetaDmDeliveries.has(key)) return false;
  recentMetaDmDeliveries.set(key, now);
  return true;
}

export async function processMetaWebhook(body: unknown): Promise<void> {
  const payload = body as {
    object?: string;
    entry?: Array<{
      id: string;
      changes?: Array<{ field: string; value: unknown }>;
      messaging?: Array<{
        sender: { id: string };
        recipient: { id: string };
        timestamp: number;
        message?: { mid: string; text?: string };
      }>;
    }>;
  };

  if (!payload.entry) return;

  for (const entry of payload.entry) {
    // Eventos de mudança (comentários, menções, etc.)
    for (const change of entry.changes ?? []) {
      logger.info({ field: change.field, entryId: entry.id }, "Meta webhook received");
    }

    // Mensagens diretas (DM) — dispara fluxos de resposta automatizados
    for (const msg of entry.messaging ?? []) {
      if (!msg.message?.mid) continue;
      // entry.id is the receiving IG account or Facebook Page.
      const accountId = entry.id;
      const isInstagram = payload.object === "instagram";
      const senderId = msg.sender.id;
      // Ignorar mensagens do próprio bot (echo)
      if (senderId === accountId) continue;
      const deliveryKey = `${accountId}:${msg.message.mid || `${msg.timestamp}:${senderId}`}`;
      if (!claimMetaDmDelivery(deliveryKey)) {
        logger.info({ accountId, deliveryKey }, "Duplicate Meta DM delivery ignored");
        continue;
      }
       const integrations = await db.select({
        id: workspaceIntegrationsTable.id,
        workspaceId: workspaceIntegrationsTable.workspaceId,
        accessToken: workspaceIntegrationsTable.accessToken,
        metadata: workspaceIntegrationsTable.metadata,
      }).from(workspaceIntegrationsTable).where(and(
        eq(workspaceIntegrationsTable.accountId, accountId),
        isInstagram
          ? eq(workspaceIntegrationsTable.provider, "instagram")
          : inArray(workspaceIntegrationsTable.provider, ["facebook", "meta_ads"]),
        eq(workspaceIntegrationsTable.status, "connected"),
      )).limit(2);
      const integration = integrations.find((candidate) =>
        !!candidate.accessToken?.trim() &&
        isOrganicSocialIntegration(candidate.metadata as Record<string, unknown> | null));
      if (!integration) {
        logger.warn({ accountId }, "Ignoring unroutable Meta DM webhook account");
        continue;
      }
      const normalized = await ingestInboundCommunityEvent(integration.workspaceId, {
        channel: isInstagram ? "instagram" : "facebook",
        providerEventId: msg.message.mid,
        providerMessageId: msg.message.mid,
        providerConversationId: senderId,
        providerParticipantId: senderId,
        body: msg.message.text,
        occurredAt: new Date(msg.timestamp),
        integrationId: integration.id,
        payload: msg as unknown as Record<string, unknown>,
      });
      if (normalized.duplicate) continue;
      // Only text DMs can enter the existing keyword-response foundation.
      if (!msg.message.text) continue;
      const eventClaim = await claimMetaWebhookEvent({
        workspaceId: integration.workspaceId,
        integrationId: integration.id,
          accountId,
        providerEventId: msg.message.mid || `${msg.timestamp}:${senderId}`,
        eventType: isInstagram ? "instagram_dm" : "facebook_dm",
        actionKey: "sequence_trigger",
      });
      if (!eventClaim.claimed) {
        logger.info({ accountId, deliveryKey }, "Duplicate Meta DM database claim ignored");
        continue;
      }

      logger.info({ accountId, senderId, text: msg.message.text }, "Meta webhook: DM recebida");

      setImmediate(async () => {
        try {
          // Sequence handlers run first. Awaiting them prevents a configured
          // keyword response and contextual AI from racing each other.
          if (isInstagram) {
            const { handleInstagramDmTrigger, handleIncomingDmReply } = await import("../social-presence/social-presence.service.js");
            await handleInstagramDmTrigger(accountId, senderId, msg.message!.text!);
            await handleIncomingDmReply(accountId, senderId, msg.message!.text!);
          }

          const turn = await db.insert(socialConversationTurnsTable).values({
            workspaceId: integration.workspaceId,
            integrationId: integration.id,
            accountId,
            providerUserId: senderId,
            providerEventId: msg.message!.mid,
            providerMessageId: msg.message!.mid,
            channel: isInstagram ? "instagram_dm" : "facebook_dm",
            direction: "inbound",
            inputText: msg.message!.text!,
            decision: "received",
          }).onConflictDoNothing().returning({ id: socialConversationTurnsTable.id });
          if (!turn[0]) return;

          // A newly-created or existing active sequence owns this message.
          // Do not let the free-form orchestrator produce a second reply.
          const { instagramDmSequencesTable } = await import("@workspace/db");
          const active = await db.select({ id: instagramDmSequencesTable.id })
            .from(instagramDmSequencesTable).where(and(
              eq(instagramDmSequencesTable.workspaceId, integration.workspaceId),
              eq(instagramDmSequencesTable.igAccountId, accountId),
              eq(instagramDmSequencesTable.recipientId, senderId),
              isNull(instagramDmSequencesTable.completedAt),
            )).limit(1);
          if (active[0]) {
            await db.update(socialConversationTurnsTable).set({ decision: "keyword_sequence" }).where(eq(socialConversationTurnsTable.id, turn[0].id));
            return;
          }

          const decision = await orchestrateIntelligentConversation({
            workspaceId: integration.workspaceId, integrationId: integration.id,
            accountId, provider: isInstagram ? "instagram" : "facebook", providerUserId: senderId,
            channel: isInstagram ? "instagram_dm" : "facebook_dm", message: msg.message!.text!,
          });
          await db.update(socialConversationTurnsTable).set({
            campaignId: decision.contextProvenance.campaignId,
            masterplanVersion: decision.contextProvenance.masterplanVersion ? String(decision.contextProvenance.masterplanVersion) : null,
            contextFingerprint: decision.contextProvenance.contextFingerprint ?? null,
            intent: decision.intent, salesStage: decision.salesStage, decision: decision.action,
            confidence: String(decision.confidence), needsHuman: String(decision.needsHuman),
            safetyReason: decision.safetyReason, replyText: decision.reply || null,
            provenance: decision.contextProvenance,
          }).where(eq(socialConversationTurnsTable.id, turn[0].id));
          if (decision.action !== "reply_dm" && decision.action !== "reply_private") return;

          const endpoint = `/${accountId}/messages`;
          const response = await metaGraphFetch(metaGraphUrl(endpoint), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipient: { id: senderId }, message: { text: decision.reply }, access_token: integration.accessToken }),
          });
          const data = await response.json().catch(() => ({})) as { id?: string; message_id?: string; error?: { message?: string } };
          await db.update(socialConversationTurnsTable).set({
            providerResponseId: data.message_id ?? data.id ?? null,
            providerStatus: response.ok ? "sent" : "failed",
            providerError: response.ok ? null : (data.error?.message ?? `Meta API ${response.status}`),
            sentAt: response.ok ? new Date() : null,
          }).where(eq(socialConversationTurnsTable.id, turn[0].id));
        } catch (err) {
          logger.warn({ err }, "Meta webhook: contextual DM processing failed closed");
        }
      });
    }
  }
}

export async function processTikTokWebhook(body: unknown): Promise<void> {
  const payload = body as { event?: string; data?: unknown };
  logger.info({ event: payload.event }, "TikTok webhook received");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getIntegration(
  workspaceId: string,
  integrationId: string
): Promise<WorkspaceIntegration | undefined> {
  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.id, integrationId),
        eq(workspaceIntegrationsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return integration && isOrganicSocialIntegration(integration.metadata as Record<string, unknown>)
    ? integration
    : undefined;
}

async function markFailed(workspaceId: string, postId: string, error: string): Promise<void> {
  await db
    .update(socialPostsTable)
    .set({ status: "failed", errorMessage: error, updatedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));
}

function providerToPlatform(
  provider: WorkspaceIntegration["provider"]
): SocialPost["platform"] {
  switch (provider) {
    case "instagram": return "instagram";
    case "tiktok_ads": return "tiktok";
    case "whatsapp_business": return "whatsapp_business";
    default: return "facebook_page";
  }
}

async function upsertIntegration(
  workspaceId: string,
  data: {
    provider: WorkspaceIntegration["provider"];
    accountId: string;
    accountName: string;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt: Date;
    metadata: Record<string, unknown>;
  }
): Promise<WorkspaceIntegration> {
  const network = canonicalNetworkForProvider(data.provider);
  if (network) {
    await assertSocialAccountEntitlement(workspaceId, network, data.accountId);
  }
  // Check if integration with same provider + accountId already exists
  const candidates = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, data.provider),
        eq(workspaceIntegrationsTable.accountId, data.accountId)
      )
    );
  const existing = candidates.find((row) =>
    isOrganicSocialIntegration(row.metadata as Record<string, unknown>),
  );

  if (existing) {
    const [updated] = await db
      .update(workspaceIntegrationsTable)
      .set({
        status: "connected",
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        tokenExpiresAt: data.tokenExpiresAt,
        accountName: data.accountName,
        metadata: metadataForPurpose("organic_social", data.metadata),
        updatedAt: new Date(),
      })
      .where(eq(workspaceIntegrationsTable.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(workspaceIntegrationsTable)
    .values({
      workspaceId,
      provider: data.provider,
      status: "connected",
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      tokenExpiresAt: data.tokenExpiresAt,
      accountId: data.accountId,
      accountName: data.accountName,
      isPaymentGateway: false,
      blocksExecution: false,
      metadata: data.metadata,
    })
    .returning();

  if (!created) throw new AppError(500, "Falha ao salvar integração", "DB_ERROR");
  return created;
}
