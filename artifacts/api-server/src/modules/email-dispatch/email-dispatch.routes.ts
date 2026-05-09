import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  listEmailLists,
  createEmailDispatch,
  sendEmailDispatch,
  getEmailDispatches,
  getEmailDispatch,
  handleEmailEngagementWebhook,
  type EmailWebhookPayload,
} from "./email-dispatch.service.js";

const router = Router();

const createSchema = z.object({
  provider: z.enum([
    "rd_station",
    "activecampaign",
    "mailchimp",
    "sendgrid",
    "brevo",
    "custom_smtp",
  ]),
  campaignId: z.string().uuid().optional(),
  listId: z.string().min(1),
  listName: z.string().optional(),
  subject: z.string().min(1),
  previewText: z.string().optional(),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
  contentPieceId: z.string().uuid().optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  scheduledAt: z.string().optional(),
});

router.get("/lists", requireAuth, async (req, res): Promise<void> => {
  const { provider } = req.query as { provider?: string };
  if (!provider || !["rd_station", "activecampaign"].includes(provider)) {
    res.status(400).json({
      error: "provider query param required: rd_station | activecampaign",
      code: "VALIDATION_ERROR",
    });
    return;
  }
  const lists = await listEmailLists(
    req.auth.workspaceId,
    provider as "rd_station" | "activecampaign",
  );
  res.json({ lists });
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { campaignId } = req.query as Record<string, string | undefined>;
  const dispatches = await getEmailDispatches(req.auth.workspaceId, campaignId);
  res.json({ dispatches, total: dispatches.length });
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const dispatch = await createEmailDispatch(req.auth.workspaceId, parsed.data);
  res.status(201).json({ dispatch });
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const dispatch = await getEmailDispatch(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json({ dispatch });
});

router.post("/:id/send", requireAuth, async (req, res): Promise<void> => {
  const dispatch = await sendEmailDispatch(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json({ dispatch });
});

// ─── Engagement Webhooks (no auth — signed by provider) ─────────────────────

router.post("/webhook/:provider", async (req, res): Promise<void> => {
  const provider = req.params["provider"] as string;

  if (!["rd_station", "activecampaign"].includes(provider)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }

  const result = await handleEmailEngagementWebhook({
    ...(req.body as Record<string, unknown>),
    provider: provider as "rd_station" | "activecampaign",
  } as EmailWebhookPayload);

  res.json(result);
});

export default router;
