import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  getSalesConversations,
  createSalesConversation,
  getSalesConversationWithMessages,
  addSalesMessage,
  suggestSalesReply,
  updateSalesConversation,
  deleteSalesConversation,
  getSalesAnalytics,
} from "./sales-team.service.js";

const router = Router();
router.use(requireAuth);

const createConvSchema = z.object({
  contactName: z.string().min(1).max(200),
  contactHandle: z.string().max(300).optional(),
  channel: z.enum(["whatsapp", "telegram", "facebook", "instagram", "landing", "manual"]).optional(),
  funnelStage: z.enum(["warming", "desire", "scarcity", "objection", "post_sale"]).optional(),
  campaignId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const updateConvSchema = z.object({
  contactName: z.string().min(1).max(200).optional(),
  contactHandle: z.string().max(300).optional(),
  channel: z.enum(["whatsapp", "telegram", "facebook", "instagram", "landing", "manual"]).optional(),
  funnelStage: z.enum(["warming", "desire", "scarcity", "objection", "post_sale"]).optional(),
  status: z.enum(["active", "converted", "lost", "paused"]).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

const addMessageSchema = z.object({
  role: z.enum(["contact", "agent", "note"]),
  content: z.string().min(1).max(5000),
  agentRole: z.string().max(100).optional(),
  isAiGenerated: z.boolean().optional(),
});

router.get("/analytics", async (req, res): Promise<void> => {
  const analytics = await getSalesAnalytics(req.auth.workspaceId);
  res.json({ analytics });
});

router.get("/", async (req, res): Promise<void> => {
  const { status, funnelStage, channel } = req.query as Record<string, string | undefined>;
  const conversations = await getSalesConversations(req.auth.workspaceId, { status, funnelStage, channel });
  res.json({ conversations });
});

router.post("/", async (req, res): Promise<void> => {
  let parsed;
  try { parsed = createConvSchema.parse(req.body); } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const conv = await createSalesConversation(req.auth.workspaceId, parsed);
  res.status(201).json({ conversation: conv });
});

router.get("/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const conv = await getSalesConversationWithMessages(id, req.auth.workspaceId);
  if (!conv) { res.status(404).json({ error: "Conversa não encontrada." }); return; }
  res.json({ conversation: conv });
});

router.patch("/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  let parsed;
  try { parsed = updateConvSchema.parse(req.body); } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const conv = await updateSalesConversation(id, req.auth.workspaceId, parsed);
  if (!conv) { res.status(404).json({ error: "Conversa não encontrada." }); return; }
  res.json({ conversation: conv });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  await deleteSalesConversation(id, req.auth.workspaceId);
  res.json({ ok: true });
});

router.post("/:id/messages", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  let parsed;
  try { parsed = addMessageSchema.parse(req.body); } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const msg = await addSalesMessage(id, req.auth.workspaceId, parsed);
  if (!msg) { res.status(404).json({ error: "Conversa não encontrada." }); return; }
  res.status(201).json({ message: msg });
});

router.post("/:id/suggest", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const result = await suggestSalesReply(id, req.auth.workspaceId, req.log);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar sugestão.";
    if (msg === "Conversa não encontrada") { res.status(404).json({ error: msg }); return; }
    throw new AppError(502, msg);
  }
});

export default router;
