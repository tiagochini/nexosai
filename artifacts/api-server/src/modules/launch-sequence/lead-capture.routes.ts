import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { db, launchSequencesTable, sequenceContactsTable, auditLogsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function extractIp(req: import("express").Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? null;
  }
  return req.ip ?? null;
}

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
  utmTerm: z.string().max(100).optional(),
  referralCode: z.string().max(20).optional(),
  consentText: z.string().max(500).optional(),
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

// ─── GET /api/lead-capture/:sequenceId/referral/:code — referral stats ─────────

router.get("/:sequenceId/referral/:code", async (req, res): Promise<void> => {
  const { sequenceId, code } = req.params;

  const [sequence] = await db
    .select({ id: launchSequencesTable.id, leadCaptureEnabled: launchSequencesTable.leadCaptureEnabled })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);

  if (!sequence || !sequence.leadCaptureEnabled) {
    res.status(404).json({ error: "Sequence not found" });
    return;
  }

  // Find referrer contact
  const allContacts = await db
    .select({ id: sequenceContactsTable.id, name: sequenceContactsTable.name, metadata: sequenceContactsTable.metadata })
    .from(sequenceContactsTable)
    .where(eq(sequenceContactsTable.sequenceId, sequenceId));

  const referrer = allContacts.find(
    (c) => (c.metadata as Record<string, unknown>)?.["referralCode"] === code,
  );

  if (!referrer) {
    res.status(404).json({ error: "Referral code not found" });
    return;
  }

  // Count how many contacts were referred by this code
  const referredCount = allContacts.filter(
    (c) => (c.metadata as Record<string, unknown>)?.["referredBy"] === code,
  ).length;

  res.json({
    referralCode: code,
    referrerName: referrer.name ?? "Participante",
    referredCount,
    captureUrl: `${req.protocol}://${req.get("host")}/lead-capture/${sequenceId}?ref=${code}`,
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

  // Auto-read UTMs from query params if not in body (for pixel/redirect flows)
  const utmSource = body.utmSource ?? (req.query["utm_source"] as string | undefined);
  const utmMedium = body.utmMedium ?? (req.query["utm_medium"] as string | undefined);
  const utmCampaign = body.utmCampaign ?? (req.query["utm_campaign"] as string | undefined);
  const utmContent = body.utmContent ?? (req.query["utm_content"] as string | undefined);
  const utmTerm = body.utmTerm ?? (req.query["utm_term"] as string | undefined);
  const refCode = body.referralCode ?? (req.query["ref"] as string | undefined);

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

  // Validate referral code if provided
  let referrerContact: { id: string } | undefined;
  if (refCode) {
    const allMeta = await db
      .select({ id: sequenceContactsTable.id, metadata: sequenceContactsTable.metadata })
      .from(sequenceContactsTable)
      .where(eq(sequenceContactsTable.sequenceId, sequenceId));

    referrerContact = allMeta.find(
      (c) => (c.metadata as Record<string, unknown>)?.["referralCode"] === refCode,
    );
  }

  // Build UTM data (structured object + legacy flat keys for backwards compat)
  const utmData: Record<string, string | undefined> = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
    source: body.source,
  };
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmData)) {
    if (v) utm[k] = v;
  }

  // LGPD audit data
  const captureIp = extractIp(req);
  const consentAt = new Date().toISOString();
  const lgpd = {
    consentAt,
    captureIp,
    consentText: body.consentText ?? "Aceito receber comunicações sobre este lançamento.",
    source: utmSource ?? body.source ?? "direct",
    userAgent: req.headers["user-agent"]?.slice(0, 200) ?? null,
  };

  const referralCode = generateReferralCode();

  const [contact] = await db
    .insert(sequenceContactsTable)
    .values({
      sequenceId,
      workspaceId: sequence.workspaceId,
      name: body.name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      tags: body.tags ?? [],
      metadata: {
        ...utm,
        utm,
        lgpd,
        referralCode,
        ...(refCode ? { referredBy: refCode } : {}),
        ...(body.metadata ?? {}),
      },
    })
    .returning({ id: sequenceContactsTable.id });

  // LGPD audit log (non-blocking)
  db.insert(auditLogsTable)
    .values({
      workspaceId: sequence.workspaceId,
      action: "lead.captured",
      actor: body.email ?? body.phone ?? "anonymous",
      ipAddress: captureIp ?? undefined,
      data: {
        sequenceId,
        contactId: contact.id,
        utm,
        referralCode,
        referredBy: refCode ?? null,
        consentAt,
        consentText: lgpd.consentText,
        userAgent: lgpd.userAgent,
      },
    })
    .then(() => null)
    .catch((err) => logger.warn({ err }, "LGPD audit log write failed — non-blocking"));

  // Increment referrer's referred count (non-blocking)
  if (referrerContact) {
    db.select({ metadata: sequenceContactsTable.metadata })
      .from(sequenceContactsTable)
      .where(eq(sequenceContactsTable.id, referrerContact.id))
      .limit(1)
      .then(([r]) => {
        if (!r) return;
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        const prev = Number(meta["referralCount"] ?? 0);
        return db.update(sequenceContactsTable)
          .set({ metadata: { ...meta, referralCount: prev + 1 } })
          .where(eq(sequenceContactsTable.id, referrerContact!.id));
      })
      .catch((err) => logger.warn({ err }, "Referral count update failed — non-blocking"));
  }

  logger.info({ sequenceId, contactId: contact.id, utmSource, referredBy: refCode }, "Lead captured via public form");

  res.status(201).json({
    captured: true,
    duplicate: false,
    contactId: contact.id,
    referralCode,
    referralUrl: `${req.protocol}://${req.get("host")}/lead-capture/${sequenceId}?ref=${referralCode}`,
    message: "Lead registrado com sucesso",
  });
});

export default router;
