import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  createWebhookConfig,
  getWebhookConfigs,
  deleteWebhookConfig,
  getRevenueSummary,
  getRevenueEvents,
  linkEventToCampaign,
} from "./revenue.service.js";
import {
  processHotmartWebhook,
  processKiwifyWebhook,
  processEduzzWebhook,
  processMonetizzeWebhook,
  processCustomWebhook,
} from "./revenue.webhooks.js";
import type { RevenuePlatform } from "@workspace/db";

const router = Router();

// ─── Webhook config management ────────────────────────────────────────────────

const createWebhookSchema = z.object({
  platform: z.enum(["hotmart", "kiwify", "eduzz", "monetizze", "stripe", "pagarme", "asaas", "custom"]),
  hottok: z.string().optional(),
  signingSecret: z.string().optional(),
});

router.post("/webhook-configs", requireAuth, async (req, res): Promise<void> => {
  const parsed = createWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const config = await createWebhookConfig(
    req.auth.workspaceId,
    parsed.data.platform as RevenuePlatform,
    { hottok: parsed.data.hottok, signingSecret: parsed.data.signingSecret }
  );

  res.status(201).json({ config });
});

router.get("/webhook-configs", requireAuth, async (req, res): Promise<void> => {
  const configs = await getWebhookConfigs(req.auth.workspaceId);
  res.json({ configs });
});

router.delete("/webhook-configs/:id", requireAuth, async (req, res): Promise<void> => {
  await deleteWebhookConfig(req.auth.workspaceId, req.params["id"] as string);
  res.json({ success: true });
});

// ─── Revenue analytics ────────────────────────────────────────────────────────

router.get("/summary", requireAuth, async (req, res): Promise<void> => {
  const days = parseInt(req.query["days"] as string ?? "30", 10);
  const summary = await getRevenueSummary(req.auth.workspaceId, days);
  res.json(summary);
});

router.get("/events", requireAuth, async (req, res): Promise<void> => {
  const { platform, campaignId, eventType, limit, offset } = req.query as Record<string, string>;

  const events = await getRevenueEvents(req.auth.workspaceId, {
    platform,
    campaignId,
    eventType,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  res.json({ events });
});

router.patch("/events/:eventId/campaign", requireAuth, async (req, res): Promise<void> => {
  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ error: "campaignId obrigatório", code: "VALIDATION_ERROR" });
    return;
  }

  await linkEventToCampaign(req.auth.workspaceId, req.params["eventId"] as string, campaignId);
  res.json({ success: true });
});

// ─── Incoming webhooks (public — identified by token) ─────────────────────────

router.post("/webhooks/hotmart", async (req, res): Promise<void> => {
  const token = req.query["token"] as string | undefined;
  const hottok = req.headers["x-hotmart-webhook-token"] as string | undefined
    ?? (req.body as Record<string, unknown>)?.hottok as string | undefined;

  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  try {
    await processHotmartWebhook(token, req.body, hottok);
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err instanceof AppError && err.statusCode === 404) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/webhooks/kiwify", async (req, res): Promise<void> => {
  const token = req.query["token"] as string | undefined;
  const signature = req.headers["x-kiwify-signature"] as string | undefined;

  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  try {
    await processKiwifyWebhook(token, req.body, signature);
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/webhooks/eduzz", async (req, res): Promise<void> => {
  const token = req.query["token"] as string | undefined;
  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  try {
    await processEduzzWebhook(token, req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/webhooks/monetizze", async (req, res): Promise<void> => {
  const token = req.query["token"] as string | undefined;
  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  try {
    await processMonetizzeWebhook(token, req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/webhooks/custom", async (req, res): Promise<void> => {
  const token = req.query["token"] as string | undefined;
  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  try {
    await processCustomWebhook(token, req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
