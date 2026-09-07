import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { attemptCommunityAction, createModerationRule, listInbox } from "./community.service.js";
import { providerCapability } from "./community-capabilities.js";

const router = Router();
router.use(requireAuth);
const channel = z.enum(["whatsapp", "telegram", "instagram", "facebook"]);

router.get("/inbox/messages", async (req, res) => res.json({ messages: await listInbox(req.auth.workspaceId) }));
router.get("/capabilities/:channel", (req, res): void => {
  const parsed = channel.safeParse(req.params["channel"]);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid channel" });
    return;
  }
  res.json({ channel: parsed.data, actions: ["delete", "restrict", "ban", "respond"].map((action) => ({ action, ...providerCapability(parsed.data, action as "delete") })) });
});
router.post("/moderation/rules", async (req, res): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1).max(200), channel: channel.optional(), condition: z.record(z.string(), z.unknown()), decision: z.enum(["allow", "queue", "delete", "restrict", "ban", "respond", "capability_blocked"]), requiresApproval: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid moderation rule", details: parsed.error.issues });
    return;
  }
  res.status(201).json({ rule: await createModerationRule(req.auth.workspaceId, parsed.data) });
});
router.post("/messages/:messageId/actions", async (req, res): Promise<void> => {
  const parsed = z.object({ action: z.enum(["delete", "restrict", "ban", "respond"]), idempotencyKey: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid action", details: parsed.error.issues });
    return;
  }
  try { res.status(202).json({ attempt: await attemptCommunityAction(req.auth.workspaceId, req.params["messageId"]!, parsed.data.action, parsed.data.idempotencyKey) }); }
  catch { res.status(404).json({ error: "Message not found" }); }
});
export default router;