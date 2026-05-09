import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { db, launchSequencesTable, sequenceContactsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// ─── Schema ───────────────────────────────────────────────────────────────────

const leadCaptureSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.email().optional(),
  phone: z.string().max(30).optional(),
  source: z.string().max(100).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── GET /api/lead-capture/:sequenceId — public info ──────────────────────────

router.get("/:sequenceId", async (req, res): Promise<void> => {
  const { sequenceId } = req.params;

  const [sequence] = await db
    .select({
      id: launchSequencesTable.id,
      name: launchSequencesTable.name,
      status: launchSequencesTable.status,
      productName: launchSequencesTable.productName,
      leadCaptureEnabled: launchSequencesTable.leadCaptureEnabled,
    })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);

  if (!sequence || !sequence.leadCaptureEnabled) {
    res.status(404).json({ error: "Lead capture not found or disabled" });
    return;
  }

  res.json({
    id: sequence.id,
    name: sequence.name,
    productName: sequence.productName,
    active: sequence.status === "active",
  });
});

// ─── POST /api/lead-capture/:sequenceId — submit lead ─────────────────────────

router.post("/:sequenceId", async (req, res): Promise<void> => {
  const { sequenceId } = req.params;

  const parsed = leadCaptureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const body = parsed.data;

  if (!body.email && !body.phone) {
    res.status(400).json({ error: "Informe email ou telefone" });
    return;
  }

  const [sequence] = await db
    .select({
      id: launchSequencesTable.id,
      workspaceId: launchSequencesTable.workspaceId,
      status: launchSequencesTable.status,
      leadCaptureEnabled: launchSequencesTable.leadCaptureEnabled,
    })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);

  if (!sequence || !sequence.leadCaptureEnabled) {
    res.status(404).json({ error: "Lead capture not found or disabled" });
    return;
  }

  if (!["active", "scheduled"].includes(sequence.status)) {
    res.status(409).json({ error: "Esta sequência não está aceitando novos leads no momento" });
    return;
  }

  // Deduplicate by email within sequence
  if (body.email) {
    const [existing] = await db
      .select({ id: sequenceContactsTable.id })
      .from(sequenceContactsTable)
      .where(
        and(
          eq(sequenceContactsTable.sequenceId, sequenceId),
          eq(sequenceContactsTable.email, body.email),
        ),
      )
      .limit(1);

    if (existing) {
      res.json({ captured: true, duplicate: true, message: "Lead já registrado nesta sequência" });
      return;
    }
  }

  const utmData: Record<string, string> = {};
  if (body.utmSource) utmData.utm_source = body.utmSource;
  if (body.utmMedium) utmData.utm_medium = body.utmMedium;
  if (body.utmCampaign) utmData.utm_campaign = body.utmCampaign;
  if (body.utmContent) utmData.utm_content = body.utmContent;
  if (body.source) utmData.source = body.source;

  const [contact] = await db
    .insert(sequenceContactsTable)
    .values({
      sequenceId,
      workspaceId: sequence.workspaceId,
      name: body.name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      tags: body.tags ?? [],
      metadata: { ...utmData, ...(body.metadata ?? {}) },
    })
    .returning({ id: sequenceContactsTable.id });

  logger.info({ sequenceId, contactId: contact.id }, "Lead captured via public form");

  res.status(201).json({
    captured: true,
    duplicate: false,
    contactId: contact.id,
    message: "Lead registrado com sucesso",
  });
});

export default router;
