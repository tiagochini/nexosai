import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getWhatsAppStatus,
  createWhatsAppDispatch,
  sendWhatsAppDispatch,
  getWhatsAppDispatches,
  getWhatsAppDispatch,
  handleWhatsAppWebhook,
} from "./whatsapp.service.js";

const router = Router();

const createSchema = z.object({
  campaignId: z.string().uuid().optional(),
  type: z.enum(["broadcast", "individual", "group", "template"]),
  recipients: z.array(z.string().min(1)).min(1),
  message: z.string().optional(),
  contentPieceId: z.string().uuid().optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  templateName: z.string().optional(),
  templateParams: z.record(z.string(), z.string()).optional(),
  scheduledAt: z.string().optional(),
});

router.get("/status", requireAuth, async (req, res): Promise<void> => {
  const status = await getWhatsAppStatus(req.auth.workspaceId);
  res.json(status);
});

router.get("/dispatches", requireAuth, async (req, res): Promise<void> => {
  const { campaignId } = req.query as Record<string, string | undefined>;
  const dispatches = await getWhatsAppDispatches(req.auth.workspaceId, campaignId);
  res.json({ dispatches, total: dispatches.length });
});

router.post("/dispatches", requireAuth, async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const dispatch = await createWhatsAppDispatch(req.auth.workspaceId, parsed.data);
  res.status(201).json({ dispatch });
});

router.get("/dispatches/:id", requireAuth, async (req, res): Promise<void> => {
  const dispatch = await getWhatsAppDispatch(req.auth.workspaceId, req.params["id"] as string);
  res.json({ dispatch });
});

router.post("/dispatches/:id/send", requireAuth, async (req, res): Promise<void> => {
  const dispatch = await sendWhatsAppDispatch(req.auth.workspaceId, req.params["id"] as string);
  res.json({ dispatch });
});

router.get("/webhook", (req, res): void => {
  res.send((req.query as Record<string, string>)["hub.challenge"] ?? "ok");
});

router.post("/webhook", async (req, res): Promise<void> => {
  const result = await handleWhatsAppWebhook(req.body);
  res.json(result);
});

export default router;
