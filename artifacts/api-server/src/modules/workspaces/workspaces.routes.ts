import { Router } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, workspacesTable, workspaceIntegrationsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  brandName: z.string().optional(),
  logoUrl: z.string().optional(),
});

router.get("/me", async (req, res): Promise<void> => {
  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    return;
  }

  const integrations = await db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountName: workspaceIntegrationsTable.accountName,
      isPaymentGateway: workspaceIntegrationsTable.isPaymentGateway,
      blocksExecution: workspaceIntegrationsTable.blocksExecution,
    })
    .from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId));

  res.json({ workspace, integrations });
});

router.patch("/me", async (req, res): Promise<void> => {
  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates["name"] = parsed.data.name;
  if (parsed.data.brandName !== undefined) updates["brandName"] = parsed.data.brandName;
  if (parsed.data.logoUrl !== undefined) updates["logoUrl"] = parsed.data.logoUrl;

  const [updated] = await db
    .update(workspacesTable)
    .set(updates)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .returning();

  res.json({ workspace: updated });
});

router.get("/me/integrations", async (req, res): Promise<void> => {
  const integrations = await db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      isPaymentGateway: workspaceIntegrationsTable.isPaymentGateway,
      blocksExecution: workspaceIntegrationsTable.blocksExecution,
      createdAt: workspaceIntegrationsTable.createdAt,
    })
    .from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId));

  res.json({ integrations });
});

router.post("/me/integrations", async (req, res): Promise<void> => {
  const schema = z.object({
    provider: z.enum([
      "meta_ads", "instagram", "tiktok_ads", "google_ads",
      "whatsapp_business", "telegram", "stripe", "hotmart",
      "eduzz", "kiwify", "mailchimp", "activecampaign", "rd_station", "hubspot",
      "crypto_native", "custom_webhook",
    ]),
    accountId: z.string().optional(),
    accountName: z.string().optional(),
    webhookUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const PAYMENT_GATEWAYS = ["stripe", "hotmart", "eduzz", "kiwify", "crypto_native"];
  const isPaymentGateway = PAYMENT_GATEWAYS.includes(parsed.data.provider);

  const [integration] = await db
    .insert(workspaceIntegrationsTable)
    .values({
      workspaceId: req.auth.workspaceId,
      provider: parsed.data.provider,
      status: "disconnected",
      accountId: parsed.data.accountId,
      accountName: parsed.data.accountName,
      webhookUrl: parsed.data.webhookUrl,
      metadata: parsed.data.metadata ?? {},
      isPaymentGateway,
      blocksExecution: false,
    })
    .returning();

  res.status(201).json({ integration });
});

export default router;
