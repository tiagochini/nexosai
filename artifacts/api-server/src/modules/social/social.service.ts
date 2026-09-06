import { eq, and, lte, inArray } from "drizzle-orm";
import {
  db,
  socialPostsTable,
  workspaceIntegrationsTable,
  campaignsTable,
  contentPiecesTable,
  type InsertSocialPost,
  type SocialPost,
  type WorkspaceIntegration,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import {
  publishToInstagram,
  publishToFacebook,
  publishToTikTok,
  sendWhatsAppMessage,
  getInstagramMetrics,
  getTikTokMetrics,
} from "./social.publisher.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
import jwt from "jsonwebtoken";
import { isOrganicSocialIntegration, metadataForPurpose } from "../integrations/integration-purpose.js";
import { claimMetaWebhookEvent } from "./meta-webhook-evidence.service.js";

// ─── OAuth ────────────────────────────────────────────────────────────────────

const META_GRAPH_VERSION = "v19.0";
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
    const appId = process.env["FACEBOOK_APP_ID"];
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
  const appId = process.env["FACEBOOK_APP_ID"];
  const appSecret = process.env["FACEBOOK_APP_SECRET"];
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
    const profileUrl = `https://graph.facebook.com/v20.0/${accountId}?fields=username,profile_picture_url,followers_count,follows_count,media_count,biography,website&access_token=${encodeURIComponent(accessToken)}`;
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

    // 2. Recent media with insights
    const mediaUrl = `https://graph.facebook.com/v20.0/${accountId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp&limit=12&access_token=${encodeURIComponent(accessToken)}`;
    const mediaRes = await fetchWithTimeout(mediaUrl);
    if (mediaRes.ok) {
      const mediaData = await mediaRes.json() as { data?: Array<{ id: string; media_type?: string; media_url?: string; thumbnail_url?: string; caption?: string; timestamp?: string }> };
      const posts: AccountAnalyticsPost[] = [];

      for (const media of (mediaData.data ?? []).slice(0, 9)) {
        try {
          const insightUrl = `https://graph.facebook.com/v20.0/${media.id}/insights?metric=impressions,reach,likes,comments,saved&access_token=${encodeURIComponent(accessToken)}`;
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
        const accInsightUrl = `https://graph.facebook.com/v20.0/${accountId}/insights?metric=reach,impressions,follower_count&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(accessToken)}`;
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
    const profileUrl = `https://graph.facebook.com/v20.0/${accountId}?fields=name,picture.type(large),fan_count,followers_count,about,website&access_token=${encodeURIComponent(accessToken)}`;
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
    const postsUrl = `https://graph.facebook.com/v20.0/${accountId}/posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true)&limit=9&access_token=${encodeURIComponent(accessToken)}`;
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
      const insightUrl = `https://graph.facebook.com/v20.0/${accountId}/insights?metric=page_fans,page_impressions,page_impressions_unique&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(accessToken)}`;
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

  const [post] = await db
    .insert(socialPostsTable)
    .values({ ...data, workspaceId })
    .returning();

  if (!post) throw new AppError(500, "Falha ao criar post", "DB_ERROR");
  logger.info({ workspaceId, postId: post.id, platform: post.platform }, "Social post created");
  return post;
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
  if (post.status === "published") return post;
  if (!["scheduled", "draft"].includes(post.status)) {
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

  // Mark as publishing
  await db
    .update(socialPostsTable)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));

  const integration = await getIntegration(workspaceId, post.integrationId);
  if (!integration || integration.status !== "connected") {
    await markFailed(workspaceId, postId, "Integração não conectada ou expirada");
    throw new AppError(400, "Integração não conectada", "INTEGRATION_ERROR");
  }

  let result;
  switch (post.platform) {
    case "instagram":
      result = await publishToInstagram(post, integration);
      break;
    case "facebook_page":
      result = await publishToFacebook(post, integration);
      break;
    case "tiktok":
      result = await publishToTikTok(post, integration);
      break;
    default:
      result = { success: false, error: `Platform ${post.platform} not yet supported for direct publishing` };
  }

  if (!result.success) {
    const retryCount = post.retryCount + 1;
    await db
      .update(socialPostsTable)
      .set({
        status: retryCount >= 3 ? "failed" : "scheduled",
        errorMessage: result.error,
        retryCount,
        updatedAt: new Date(),
      })
      .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)));
    throw new AppError(500, result.error ?? "Publish failed", "PUBLISH_FAILED");
  }

  const [updated] = await db
    .update(socialPostsTable)
    .set({
      status: "published",
      publishedAt: new Date(),
      platformPostId: result.platformPostId ?? null,
      platformUrl: result.platformUrl ?? null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.workspaceId, workspaceId)))
    .returning();

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
  if (!integration?.accessToken) return post;

  let metrics;
  if (post.platform === "instagram") {
    metrics = await getInstagramMetrics(post.platformPostId, integration.accessToken);
  } else if (post.platform === "tiktok") {
    metrics = await getTikTokMetrics(post.platformPostId, integration.accessToken);
  } else {
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
  return db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.status, "scheduled"),
        lte(socialPostsTable.scheduledAt, new Date())
      )
    )
    .limit(20);
}

// ─── Auto-schedule from campaign ──────────────────────────────────────────────

export async function schedulePostsForCampaign(
  workspaceId: string,
  campaignId: string,
  contentPieceIds: string[],
  integrationIds: string[],
  startDate: Date
): Promise<SocialPost[]> {
  const created: SocialPost[] = [];
  let offset = 0;

  for (const contentPieceId of contentPieceIds) {
    const [piece] = await db
      .select()
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.id, contentPieceId))
      .limit(1);

    if (!piece) continue;

    for (const integrationId of integrationIds) {
      const integration = await getIntegration(workspaceId, integrationId);
      if (!integration) continue;

      const scheduledAt = new Date(startDate.getTime() + offset * 6 * 60 * 60 * 1000);

      const post = await createPost(workspaceId, {
        campaignId,
        contentPieceId,
        integrationId,
        platform: providerToPlatform(integration.provider),
        postType: "feed_image",
        status: "scheduled",
        caption: typeof piece.content === "string" ? piece.content.slice(0, 2200) : null,
        hashtags: [],
        mediaUrls: [],
        scheduledAt,
        aiGenerated: true,
      });
      created.push(post);
      offset++;
    }
  }

  return created;
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
      if (!msg.message?.text) continue;
      // entry.id é o ID da conta Instagram que recebeu a mensagem
      const igAccountId = entry.id;
      const senderId = msg.sender.id;
      // Ignorar mensagens do próprio bot (echo)
      if (senderId === igAccountId) continue;
      const deliveryKey = `${igAccountId}:${msg.message.mid || `${msg.timestamp}:${senderId}`}`;
      if (!claimMetaDmDelivery(deliveryKey)) {
        logger.info({ igAccountId, deliveryKey }, "Duplicate Meta DM delivery ignored");
        continue;
      }
      const integrations = await db.select({
        id: workspaceIntegrationsTable.id,
        workspaceId: workspaceIntegrationsTable.workspaceId,
        accessToken: workspaceIntegrationsTable.accessToken,
        metadata: workspaceIntegrationsTable.metadata,
      }).from(workspaceIntegrationsTable).where(and(
        eq(workspaceIntegrationsTable.accountId, igAccountId),
        eq(workspaceIntegrationsTable.provider, "instagram"),
        eq(workspaceIntegrationsTable.status, "connected"),
      )).limit(2);
      const integration = integrations.find((candidate) =>
        !!candidate.accessToken?.trim() &&
        isOrganicSocialIntegration(candidate.metadata as Record<string, unknown> | null));
      if (!integration) {
        logger.warn({ igAccountId }, "Ignoring unroutable Meta DM webhook account");
        continue;
      }
      const eventClaim = await claimMetaWebhookEvent({
        workspaceId: integration.workspaceId,
        integrationId: integration.id,
        accountId: igAccountId,
        providerEventId: msg.message.mid || `${msg.timestamp}:${senderId}`,
        eventType: "instagram_dm",
        actionKey: "sequence_trigger",
      });
      if (!eventClaim.claimed) {
        logger.info({ igAccountId, deliveryKey }, "Duplicate Meta DM database claim ignored");
        continue;
      }

      logger.info({ igAccountId, senderId, text: msg.message.text }, "Meta webhook: DM recebida");

      const { handleInstagramDmTrigger, handleIncomingDmReply } = await import(
        "../social-presence/social-presence.service.js"
      );
      setImmediate(() =>
        Promise.all([
          handleInstagramDmTrigger(igAccountId, senderId, msg.message!.text!),
          handleIncomingDmReply(igAccountId, senderId, msg.message!.text!),
        ]).catch((err) => logger.warn({ err }, "Meta webhook: DM processing error (non-fatal)")),
      );
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
