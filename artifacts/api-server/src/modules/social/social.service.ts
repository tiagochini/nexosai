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
import jwt from "jsonwebtoken";

// ─── OAuth ────────────────────────────────────────────────────────────────────

const META_GRAPH_VERSION = "v19.0";
const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
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
      metadata: { pageId: page.id },
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
        metadata: { username: ig.username, pageId: page.id },
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
    metadata: { openId },
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
    .where(eq(socialPostsTable.id, postId))
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
    .where(eq(socialPostsTable.id, postId));
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export async function publishPost(postId: string): Promise<SocialPost> {
  const [post] = await db
    .select()
    .from(socialPostsTable)
    .where(eq(socialPostsTable.id, postId))
    .limit(1);

  if (!post) throw new NotFoundError("Post not found");
  if (post.status === "published") return post;
  if (!["scheduled", "draft"].includes(post.status)) {
    throw new AppError(400, `Cannot publish post in status: ${post.status}`, "INVALID_STATUS");
  }

  // Mark as publishing
  await db
    .update(socialPostsTable)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(eq(socialPostsTable.id, postId));

  const integration = await getIntegration(post.workspaceId, post.integrationId);
  if (!integration || integration.status !== "connected") {
    await markFailed(postId, "Integração não conectada ou expirada");
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
      .where(eq(socialPostsTable.id, postId));
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
    .where(eq(socialPostsTable.id, postId))
    .returning();

  logger.info({ postId, platform: post.platform, platformPostId: result.platformPostId }, "Post published");
  return updated!;
}

export async function syncPostMetrics(postId: string): Promise<SocialPost> {
  const [post] = await db
    .select()
    .from(socialPostsTable)
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.status, "published")))
    .limit(1);

  if (!post || !post.platformPostId) return post!;

  const integration = await getIntegration(post.workspaceId, post.integrationId);
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
    .where(eq(socialPostsTable.id, postId))
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

      logger.info({ igAccountId, senderId, text: msg.message.text }, "Meta webhook: DM recebida");

      const { handleInstagramDmTrigger } = await import(
        "../social-presence/social-presence.service.js"
      );
      setImmediate(() =>
        handleInstagramDmTrigger(igAccountId, senderId, msg.message!.text!).catch((err) =>
          logger.warn({ err }, "Meta webhook: DM trigger error (non-fatal)"),
        ),
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
  return integration;
}

async function markFailed(postId: string, error: string): Promise<void> {
  await db
    .update(socialPostsTable)
    .set({ status: "failed", errorMessage: error, updatedAt: new Date() })
    .where(eq(socialPostsTable.id, postId));
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
  const [existing] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, data.provider),
        eq(workspaceIntegrationsTable.accountId, data.accountId)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(workspaceIntegrationsTable)
      .set({
        status: "connected",
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        tokenExpiresAt: data.tokenExpiresAt,
        accountName: data.accountName,
        metadata: data.metadata,
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
