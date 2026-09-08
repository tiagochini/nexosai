import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { requireAuth } from "../auth/auth.middleware.js";
import { ingestInboundCommunityEvent } from "./community.service.js";
import { TelegramBotAdapter, normalizeTelegramUpdate, validateTelegramWebhookSecret, type TelegramIntegrationConfig } from "./telegram.adapter.js";

const router = Router();
const integrationSelect = { id: workspaceIntegrationsTable.id, workspaceId: workspaceIntegrationsTable.workspaceId, status: workspaceIntegrationsTable.status, accountId: workspaceIntegrationsTable.accountId, metadata: workspaceIntegrationsTable.metadata };
async function getIntegration(id: string, workspaceId?: string) {
  return db.select(integrationSelect).from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, id), eq(workspaceIntegrationsTable.provider, "telegram"), ...(workspaceId ? [eq(workspaceIntegrationsTable.workspaceId, workspaceId)] : []))).then((r) => r[0] as TelegramIntegrationConfig | undefined);
}

router.post("/webhook/:integrationId", async (req, res): Promise<void> => {
  const integration = await getIntegration(req.params["integrationId"]!);
  if (!integration || !validateTelegramWebhookSecret(integration, req.header("X-Telegram-Bot-Api-Secret-Token"))) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({ update_id: z.number().int() }).passthrough().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid Telegram update" }); return; }
  const event = normalizeTelegramUpdate(parsed.data, integration.id);
  if (!event) { res.status(200).json({ accepted: false, reason: "unsupported_update" }); return; }
  const result = await ingestInboundCommunityEvent(integration.workspaceId, event);
  res.status(200).json({ accepted: !result.duplicate, duplicate: result.duplicate });
});

router.use(requireAuth);
router.get("/setup/:integrationId", async (req, res): Promise<void> => {
  const integration = await getIntegration(req.params["integrationId"]!, req.auth.workspaceId);
  if (!integration) { res.status(404).json({ error: "Telegram integration not found" }); return; }
  res.json({ integrationId: integration.id, steps: [
    { id: "create_group", state: "human_required", detail: "Create or select the Telegram group yourself; bots cannot create arbitrary groups through Bot API." },
    { id: "add_bot", state: "human_required", detail: "Add the bot to that group." },
    { id: "promote_bot", state: "human_required", detail: "Promote the bot to administrator with only the permissions required for intended actions." },
    { id: "configure_webhook", state: "ready", detail: "Use the readiness endpoint after secret references are configured." },
  ] });
});
router.post("/setup/:integrationId/readiness", async (req, res): Promise<void> => {
  const integration = await getIntegration(req.params["integrationId"]!, req.auth.workspaceId);
  const parsed = z.object({ webhookUrl: z.string().url() }).safeParse(req.body);
  if (!integration) { res.status(404).json({ error: "Telegram integration not found" }); return; }
  if (!parsed.success) { res.status(400).json({ error: "A valid HTTPS webhookUrl is required" }); return; }
  try { const adapter = new TelegramBotAdapter(integration); const me = await adapter.getMe(); const receipt = await adapter.setWebhook(parsed.data.webhookUrl); res.json({ ready: true, bot: { id: String(me.id), username: me.username, name: me.first_name }, receipt }); }
  catch (error) { res.status(409).json({ ready: false, error: error instanceof Error ? error.message : "Telegram readiness failed" }); }
});
router.get("/groups/:integrationId/:chatId/capabilities", async (req, res): Promise<void> => {
  const integration = await getIntegration(req.params["integrationId"]!, req.auth.workspaceId);
  if (!integration) { res.status(404).json({ error: "Telegram integration not found" }); return; }
  try { res.json({ group: await new TelegramBotAdapter(integration).discoverGroup(req.params["chatId"]!) }); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Telegram group discovery failed" }); }
});
export default router;