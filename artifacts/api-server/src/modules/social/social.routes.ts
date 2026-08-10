import { Router } from "express";
import { z } from "zod/v4";
import crypto from "crypto";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";

import {
  getOAuthUrl,
  verifyOAuthState,
  handleMetaCallback,
  handleTikTokCallback,
  disconnectAccount,
  getConnectedAccounts,
  getAccountsWithAnalytics,
  createPost,
  listPosts,
  getPost,
  updatePost,
  cancelPost,
  publishPost,
  syncPostMetrics,
  schedulePostsForCampaign,
  processMetaWebhook,
  processTikTokWebhook,
  type SupportedPlatform,
} from "./social.service.js";

const router = Router();

// ─── OAuth connect ────────────────────────────────────────────────────────────

router.get("/connect/:platform", requireAuth, (req, res): void => {
  const platform = req.params["platform"] as SupportedPlatform;
  const validPlatforms: SupportedPlatform[] = ["meta", "tiktok"];

  if (!validPlatforms.includes(platform)) {
    res.status(400).json({ error: `Plataforma não suportada: ${platform}`, code: "INVALID_PLATFORM" });
    return;
  }

  try {
    const url = getOAuthUrl(platform, req.auth.workspaceId);
    res.json({ url });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ─── OAuth callbacks ──────────────────────────────────────────────────────────

router.get("/callback/meta", async (req, res): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    res.status(400).json({ error: `OAuth cancelado: ${oauthError}`, code: "OAUTH_CANCELLED" });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Parâmetros OAuth inválidos", code: "INVALID_PARAMS" });
    return;
  }

  try {
    const { workspaceId } = verifyOAuthState(state);
    const integrations = await handleMetaCallback(code, workspaceId);

    const appUrl = process.env["APP_URL"] ?? "";
    const redirectUrl = `${appUrl}/app/settings/integrations?connected=meta&count=${integrations.length}`;
    res.redirect(redirectUrl);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/callback/tiktok", async (req, res): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    res.status(400).json({ error: `OAuth cancelado: ${oauthError}`, code: "OAUTH_CANCELLED" });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Parâmetros OAuth inválidos", code: "INVALID_PARAMS" });
    return;
  }

  try {
    const { workspaceId } = verifyOAuthState(state);
    const integration = await handleTikTokCallback(code, workspaceId);

    const appUrl = process.env["APP_URL"] ?? "";
    const redirectUrl = `${appUrl}/app/settings/integrations?connected=tiktok&account=${integration.accountName}`;
    res.redirect(redirectUrl);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ─── Accounts management ──────────────────────────────────────────────────────

router.get("/accounts/analytics", requireAuth, async (req, res): Promise<void> => {
  const analytics = await getAccountsWithAnalytics(req.auth.workspaceId);
  res.json({ analytics });
});

router.get("/accounts", requireAuth, async (req, res): Promise<void> => {
  const accounts = await getConnectedAccounts(req.auth.workspaceId);
  res.json({ accounts });
});

router.delete("/accounts/:integrationId", requireAuth, async (req, res): Promise<void> => {
  const integrationId = req.params["integrationId"] as string;

  await disconnectAccount(req.auth.workspaceId, integrationId);
  res.json({ success: true });
});

// ─── Posts ────────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  integrationId: z.string().uuid(),
  platform: z.enum(["instagram", "facebook_page", "tiktok", "whatsapp_business", "youtube", "linkedin"]),
  postType: z.enum(["feed_image", "feed_video", "reel", "story", "carousel", "text", "whatsapp_message"]).optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  callToAction: z.string().optional(),
  linkUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  campaignId: z.string().uuid().optional(),
  contentPieceId: z.string().uuid().optional(),
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { scheduledAt, ...rest } = parsed.data;

  const post = await createPost(req.auth.workspaceId, {
    ...rest,
    postType: rest.postType ?? "feed_image",
    hashtags: rest.hashtags ?? [],
    mediaUrls: rest.mediaUrls ?? [],
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status: scheduledAt ? "scheduled" : "draft",
    aiGenerated: false,
  });

  res.status(201).json({ post });
});

router.get("/posts", requireAuth, async (req, res): Promise<void> => {
  const { campaignId, platform, status, limit, offset } = req.query as Record<string, string>;

  const result = await listPosts(req.auth.workspaceId, {
    campaignId,
    platform,
    status,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  res.json(result);
});

router.get("/posts/:postId", requireAuth, async (req, res): Promise<void> => {
  const post = await getPost(req.auth.workspaceId, req.params["postId"] as string);
  res.json({ post });
});

const updatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
  callToAction: z.string().optional(),
  linkUrl: z.string().url().optional(),
});

router.patch("/posts/:postId", requireAuth, async (req, res): Promise<void> => {
  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { scheduledAt, ...rest } = parsed.data;
  const post = await updatePost(req.auth.workspaceId, req.params["postId"] as string, {
    ...rest,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  });

  res.json({ post });
});

router.delete("/posts/:postId", requireAuth, async (req, res): Promise<void> => {
  await cancelPost(req.auth.workspaceId, req.params["postId"] as string);
  res.json({ success: true });
});

router.post("/posts/:postId/publish", requireAuth, async (req, res): Promise<void> => {
  const post = await publishPost(req.params["postId"] as string);
  res.json({ post });
});

router.post("/posts/:postId/sync-metrics", requireAuth, async (req, res): Promise<void> => {
  const post = await syncPostMetrics(req.params["postId"] as string);
  res.json({ post });
});

// ─── Campaign auto-schedule ───────────────────────────────────────────────────

const scheduleSchema = z.object({
  contentPieceIds: z.array(z.string().uuid()).min(1),
  integrationIds: z.array(z.string().uuid()).min(1),
  startDate: z.string().datetime(),
});

router.post("/campaigns/:campaignId/schedule", requireAuth, async (req, res): Promise<void> => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const posts = await schedulePostsForCampaign(
    req.auth.workspaceId,
    req.params["campaignId"] as string,
    parsed.data.contentPieceIds,
    parsed.data.integrationIds,
    new Date(parsed.data.startDate)
  );

  res.status(201).json({ posts, count: posts.length });
});

// ─── Webhooks (public — no auth) ──────────────────────────────────────────────

// Meta webhook verification (GET)
router.get("/webhooks/meta", (req, res): void => {
  const verifyToken = process.env["META_WEBHOOK_VERIFY_TOKEN"];
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: "Verification failed" });
});

// Meta webhook events (POST)
router.post("/webhooks/meta", async (req, res): Promise<void> => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const appSecret = process.env["FACEBOOK_APP_SECRET"];

  if (appSecret && signature) {
    const expected = `sha256=${crypto
      .createHmac("sha256", appSecret)
      .update(JSON.stringify(req.body))
      .digest("hex")}`;

    if (signature !== expected) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  await processMetaWebhook(req.body);
  res.status(200).json({ status: "ok" });
});

// TikTok webhook events
router.post("/webhooks/tiktok", async (req, res): Promise<void> => {
  await processTikTokWebhook(req.body);
  res.status(200).json({ status: "ok" });
});

export default router;
