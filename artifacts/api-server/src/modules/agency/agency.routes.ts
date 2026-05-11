import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";

import {
  inviteClient,
  acceptInvite,
  listClients,
  getClient,
  updateClient,
  revokeClient,
  getClientCampaigns,
  getAgencyStats,
} from "./agency.service.js";

const router = Router();

// ─── Stats overview ───────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const stats = await getAgencyStats(req.auth.workspaceId);
  res.json(stats);
});

// ─── Invite client ────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  clientEmail: z.email(),
  clientName: z.string().optional(),
  notes: z.string().optional(),
  permissions: z
    .object({
      canViewCampaigns: z.boolean().optional(),
      canEditCampaigns: z.boolean().optional(),
      canViewMetrics: z.boolean().optional(),
      canViewRevenue: z.boolean().optional(),
      canExecuteCampaigns: z.boolean().optional(),
      canApproveContent: z.boolean().optional(),
      canManageSocial: z.boolean().optional(),
    })
    .optional(),
});

router.post("/clients/invite", requireAuth, async (req, res): Promise<void> => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const result = await inviteClient(req.auth.workspaceId, parsed.data);
  res.status(201).json({ client: result, inviteUrl: result.inviteUrl });
});

// ─── Accept invite (public) ───────────────────────────────────────────────────

router.post("/accept", requireAuth, async (req, res): Promise<void> => {
  const token = (req.query["token"] ?? (req.body as Record<string, unknown>)?.token) as string | undefined;

  if (!token) {
    res.status(400).json({ error: "token obrigatório", code: "MISSING_TOKEN" });
    return;
  }

  const client = await acceptInvite(token, req.auth.workspaceId);
  res.json({ client, message: "Convite aceito com sucesso" });
});

// ─── List clients ─────────────────────────────────────────────────────────────

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const { status, limit, offset } = req.query as Record<string, string>;

  const clients = await listClients(req.auth.workspaceId, {
    status: status as "pending" | "active" | "suspended" | "revoked" | undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  res.json({ clients, count: clients.length });
});

router.get("/clients/:clientId", requireAuth, async (req, res): Promise<void> => {
  const client = await getClient(
    req.auth.workspaceId,
    req.params["clientId"] as string
  );
  res.json({ client });
});

// ─── Update client ────────────────────────────────────────────────────────────

const updateSchema = z.object({
  status: z.enum(["active", "suspended", "revoked"]).optional(),
  clientName: z.string().optional(),
  notes: z.string().optional(),
  permissions: z
    .object({
      canViewCampaigns: z.boolean().optional(),
      canEditCampaigns: z.boolean().optional(),
      canViewMetrics: z.boolean().optional(),
      canViewRevenue: z.boolean().optional(),
      canExecuteCampaigns: z.boolean().optional(),
      canApproveContent: z.boolean().optional(),
      canManageSocial: z.boolean().optional(),
    })
    .optional(),
});

router.patch("/clients/:clientId", requireAuth, async (req, res): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const client = await updateClient(
    req.auth.workspaceId,
    req.params["clientId"] as string,
    parsed.data
  );
  res.json({ client });
});

// ─── Revoke client ────────────────────────────────────────────────────────────

router.delete("/clients/:clientId", requireAuth, async (req, res): Promise<void> => {
  await revokeClient(req.auth.workspaceId, req.params["clientId"] as string);
  res.json({ success: true });
});

// ─── View client campaigns ────────────────────────────────────────────────────

router.get("/clients/:clientId/campaigns", requireAuth, async (req, res): Promise<void> => {
  const result = await getClientCampaigns(
    req.auth.workspaceId,
    req.params["clientId"] as string
  );
  res.json(result);
});

export default router;
