import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createLaunchSequence,
  getLaunchSequences,
  getLaunchSequence,
  updateLaunchSequence,
  deleteLaunchSequence,
  generateSequencePlan,
  setSequenceGeneratingFlag,
  updateSequenceItem,
  activateSequence,
  pauseSequence,
  addSequenceContacts,
  getSequenceContacts,
  getSequenceAnalytics,
  recordSequenceEngagement,
  generateItemCopy,
  getLaunchCalendar,
  getLaunchToday,
} from "./launch-sequence.service.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  model: z.enum(["plf", "formula_de_lancamento", "semente", "afiliado", "perpetual", "custom"]),
  campaignId: z.string().uuid().optional(),
  totalDays: z.number().int().min(3).max(730).optional(),
  launchStartDate: z.string().optional(),
  cartOpenDate: z.string().optional(),
  cartCloseDate: z.string().optional(),
  revenueTarget: z.string().optional(),
  productName: z.string().optional(),
  productPrice: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z
    .enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"])
    .optional(),
  leadCaptureEnabled: z.boolean().optional(),
});

const itemPatchSchema = z.object({
  status: z
    .enum([
      "pending",
      "content_generating",
      "content_ready",
      "scheduled",
      "dispatched",
      "skipped",
    ])
    .optional(),
  scheduledAt: z.string().optional(),
  contentPieceId: z.string().uuid().optional(),
  copyHints: z.string().optional(),
  deliveryChannels: z.array(z.string()).optional(),
});

const activateSchema = z.object({
  emailListId: z.string().optional(),
  emailProvider: z.enum(["rd_station", "activecampaign", "resend"]).optional(),
  emailFromName: z.string().optional(),
  emailFromEmail: z.string().email().optional(),
  phoneNumbers: z.array(z.string()).optional(),
  startAt: z.string().optional(),
});

const contactSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

const engagementSchema = z.object({
  itemId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  event: z.enum(["delivered", "open", "click", "convert", "reply", "unsubscribe", "bounced"]),
  channel: z.string().optional(),
  externalRef: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const sequence = await createLaunchSequence(req.auth.workspaceId, parsed.data);
  res.status(201).json({ sequence });
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const sequences = await getLaunchSequences(req.auth.workspaceId);
  res.json({ sequences, total: sequences.length });
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const sequence = await getLaunchSequence(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json({ sequence });
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const sequence = await updateLaunchSequence(
    req.auth.workspaceId,
    req.params["id"] as string,
    parsed.data,
  );
  res.json({ sequence });
});

router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  await deleteLaunchSequence(req.auth.workspaceId, req.params["id"] as string);
  res.json({ success: true });
});

// ─── AI Generation ─────────────────────────────────────────────────────────────

router.post("/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const sequenceId = req.params["id"] as string;
  const { workspaceId } = req.auth;
  const force = req.query["force"] === "true";

  const existing = await getLaunchSequence(workspaceId, sequenceId);
  const cfg = (existing.config ?? {}) as Record<string, unknown>;

  // Already generating — tell client to poll
  if (cfg["generatingPlan"] === true) {
    res.status(202).json({
      status: "generating",
      message: "Plano já está sendo gerado. Acompanhe via GET /:id (config.generatingPlan: false quando pronto)",
    });
    return;
  }

  // Items already exist and force not requested — return immediately, no cost
  if ((existing.items?.length ?? 0) > 0 && !force) {
    res.status(200).json({
      status: "ready",
      sequence: existing,
      message: "Plano já existe — retornando itens existentes. Use ?force=true para regenerar.",
    });
    return;
  }

  // Mark as generating immediately — clients poll GET /:id until flag clears
  await setSequenceGeneratingFlag(workspaceId, sequenceId, true);

  // Return 202 immediately — never block the HTTP connection
  res.status(202).json({
    status: "generating",
    message: "Plano sendo gerado em background. Acompanhe via GET /:id (config.generatingPlan: false quando pronto)",
  });

  // Fire-and-forget — server completes even if client disconnects
  const log = req.log;
  setImmediate(async () => {
    try {
      await generateSequencePlan(workspaceId, sequenceId, log);
    } catch (err) {
      log.error({ err, sequenceId }, "Background sequence generation failed");
      await setSequenceGeneratingFlag(workspaceId, sequenceId, false).catch(() => {});
    }
  });
});

// ─── Automation Control ────────────────────────────────────────────────────────

router.post("/:id/activate", requireAuth, async (req, res): Promise<void> => {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const sequence = await activateSequence(
    req.auth.workspaceId,
    req.params["id"] as string,
    parsed.data,
  );
  res.json({ sequence, message: "Sequência ativada — disparos automáticos agendados" });
});

router.post("/:id/pause", requireAuth, async (req, res): Promise<void> => {
  const sequence = await pauseSequence(req.auth.workspaceId, req.params["id"] as string);
  res.json({ sequence });
});

// ─── Items ─────────────────────────────────────────────────────────────────────

router.patch("/:id/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const parsed = itemPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const item = await updateSequenceItem(
    req.auth.workspaceId,
    req.params["id"] as string,
    req.params["itemId"] as string,
    parsed.data,
  );
  res.json({ item });
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

router.post("/:id/contacts", requireAuth, async (req, res): Promise<void> => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const contacts = await addSequenceContacts(
    req.auth.workspaceId,
    req.params["id"] as string,
    parsed.data.contacts,
  );
  res.status(201).json({ contacts, total: contacts.length });
});

router.get("/:id/contacts", requireAuth, async (req, res): Promise<void> => {
  const contacts = await getSequenceContacts(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json({ contacts, total: contacts.length });
});

// ─── Analytics ─────────────────────────────────────────────────────────────────

router.get("/:id/analytics", requireAuth, async (req, res): Promise<void> => {
  const analytics = await getSequenceAnalytics(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json({ analytics });
});

router.post("/:id/engagement", requireAuth, async (req, res): Promise<void> => {
  const parsed = engagementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  await recordSequenceEngagement(
    req.auth.workspaceId,
    req.params["id"] as string,
    parsed.data,
  );
  res.json({ recorded: true });
});

// ─── Calendar (day-by-day view) ────────────────────────────────────────────────

router.get("/:id/calendar", requireAuth, async (req, res): Promise<void> => {
  const calendar = await getLaunchCalendar(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json(calendar);
});

// ─── Today (current phase + today's dispatch) ──────────────────────────────────

router.get("/:id/today", requireAuth, async (req, res): Promise<void> => {
  const status = await getLaunchToday(
    req.auth.workspaceId,
    req.params["id"] as string,
  );
  res.json(status);
});

// ─── Per-item copy generation ──────────────────────────────────────────────────

const generateCopySchema = z.object({
  contactSegment: z.enum(["hot", "warm", "cold"]).optional(),
});

router.post("/:id/items/:itemId/generate-copy", requireAuth, async (req, res): Promise<void> => {
  const parsed = generateCopySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const copy = await generateItemCopy(
    req.auth.workspaceId,
    req.params["id"] as string,
    req.params["itemId"] as string,
    parsed.data.contactSegment,
    req.log,
  );
  res.json({ copy });
});

export default router;
