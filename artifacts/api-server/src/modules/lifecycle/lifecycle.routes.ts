import { Router } from "express";
import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { auditLogsTable, buyerOnboardingInstancesTable, cartRecoveryActionsTable, db, lifecycleContactsTable, lifecycleEventsTable, productSalesTable, purchaserReferralsTable, retentionActionsTable, upsellActionsTable, upsellOffersTable } from "@workspace/db";
import { requireAuth } from "../auth/auth.middleware.js";
import { createRetentionAction } from "./lifecycle.service.js";
import { getLifecycleOverview, listLifecycleActions, MAX_PAGE_OFFSET, parsePage, toLifecycleContactDto } from "./lifecycle-operations.service.js";

const router = Router();

router.get("/contacts", requireAuth, async (req, res): Promise<void> => {
  const limit = parsePage(req.query.limit, 25, 100);
  const offset = parsePage(req.query.offset, 0);
  if (limit === null || offset === null || limit < 1) {
    res.status(400).json({ error: "Paginação inválida", code: "VALIDATION_ERROR" }); return;
  }
  const contacts = await db.select({
    id: lifecycleContactsTable.id, email: lifecycleContactsTable.email,
    stage: lifecycleContactsTable.stage, churnRisk: lifecycleContactsTable.churnRisk,
    lastActivityAt: lifecycleContactsTable.lastActivityAt,
  }).from(lifecycleContactsTable)
    .where(eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId))
    .orderBy(desc(lifecycleContactsTable.lastActivityAt), desc(lifecycleContactsTable.id))
    .limit(limit).offset(offset);
  res.json({ contacts: contacts.map(toLifecycleContactDto), pagination: { limit, offset } });
});

router.get("/overview", requireAuth, async (req, res): Promise<void> => {
  res.json(await getLifecycleOverview(req.auth.workspaceId));
});

router.get("/actions", requireAuth, async (req, res): Promise<void> => {
  const allowedTypes = ["recovery", "onboarding", "retention", "upsell"];
  const allowedStatuses = ["pending", "claimed", "completed", "failed", "suppressed"];
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;
  const validInteger = (value: unknown) => value === undefined || (typeof value === "string" && /^\d+$/.test(value));
  const parsedLimit = rawLimit === undefined ? 25 : Number(rawLimit);
  const parsedOffset = rawOffset === undefined ? 0 : Number(rawOffset);
  if ((type && !allowedTypes.includes(type)) || (status && !allowedStatuses.includes(status))) {
    res.status(400).json({ error: "Filtro inválido", code: "VALIDATION_ERROR" }); return;
  }
  if (!validInteger(rawLimit) || !validInteger(rawOffset) || parsedLimit < 1 || parsedLimit > 100 || parsedOffset > MAX_PAGE_OFFSET) {
    res.status(400).json({ error: "Paginação inválida", code: "VALIDATION_ERROR" }); return;
  }
  res.json(await listLifecycleActions(req.auth.workspaceId, status, type, parsedLimit, parsedOffset));
});

router.get("/contacts/:contactId/timeline", requireAuth, async (req, res): Promise<void> => {
  const contactId = Array.isArray(req.params.contactId) ? req.params.contactId[0] : req.params.contactId;
  const limit = parsePage(req.query.limit, 25, 100);
  const offset = parsePage(req.query.offset, 0);
  if (limit === null || offset === null || limit < 1) {
    res.status(400).json({ error: "Paginação inválida", code: "VALIDATION_ERROR" }); return;
  }
  const [contact] = await db.select({
    id: lifecycleContactsTable.id, email: lifecycleContactsTable.email,
    stage: lifecycleContactsTable.stage, churnRisk: lifecycleContactsTable.churnRisk,
    lastActivityAt: lifecycleContactsTable.lastActivityAt,
  }).from(lifecycleContactsTable).where(and(
    eq(lifecycleContactsTable.id, contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId),
  )).limit(1);
  if (!contact) { res.status(404).json({ error: "Contato não encontrado", code: "NOT_FOUND" }); return; }
  const [events, onboarding, recovery] = await Promise.all([
    db.select({ id: lifecycleEventsTable.id, type: lifecycleEventsTable.type, status: lifecycleEventsTable.status, occurredAt: lifecycleEventsTable.occurredAt, processedAt: lifecycleEventsTable.processedAt }).from(lifecycleEventsTable).where(and(eq(lifecycleEventsTable.workspaceId, req.auth.workspaceId), eq(lifecycleEventsTable.contactId, contactId))).orderBy(desc(lifecycleEventsTable.occurredAt), desc(lifecycleEventsTable.id)).limit(limit).offset(offset),
    db.select({ id: buyerOnboardingInstancesTable.id, status: buyerOnboardingInstancesTable.status, activatedAt: buyerOnboardingInstancesTable.activatedAt, createdAt: buyerOnboardingInstancesTable.createdAt }).from(buyerOnboardingInstancesTable).where(and(eq(buyerOnboardingInstancesTable.workspaceId, req.auth.workspaceId), eq(buyerOnboardingInstancesTable.contactId, contactId))).orderBy(desc(buyerOnboardingInstancesTable.createdAt), desc(buyerOnboardingInstancesTable.id)).limit(limit).offset(offset),
    db.select({ id: cartRecoveryActionsTable.id, status: cartRecoveryActionsTable.status, channel: cartRecoveryActionsTable.channel, createdAt: cartRecoveryActionsTable.createdAt, completedAt: cartRecoveryActionsTable.completedAt }).from(cartRecoveryActionsTable).where(and(eq(cartRecoveryActionsTable.workspaceId, req.auth.workspaceId), eq(cartRecoveryActionsTable.contactId, contactId))).orderBy(desc(cartRecoveryActionsTable.createdAt), desc(cartRecoveryActionsTable.id)).limit(limit).offset(offset),
  ]);
  res.json({ contact: toLifecycleContactDto(contact), events, onboarding, recovery, pagination: { limit, offset } });
});

const stageSchema = z.object({ stage: z.enum(["lead", "qualified", "at_risk", "churned"]) });
router.post("/contacts/:contactId/stage", requireAuth, async (req, res): Promise<void> => {
  const parsed = stageSchema.safeParse(req.body);
  const contactId = Array.isArray(req.params.contactId) ? req.params.contactId[0] : req.params.contactId;
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  const [contact] = await db.update(lifecycleContactsTable).set({ stage: parsed.data.stage, lastActivityAt: new Date() })
    .where(and(eq(lifecycleContactsTable.id, contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId))).returning();
  if (!contact) { res.status(404).json({ error: "Contato não encontrado", code: "NOT_FOUND" }); return; }
  await db.insert(auditLogsTable).values({
    workspaceId: req.auth.workspaceId, action: "lifecycle.stage_changed", actor: req.auth.userId,
    data: { contactId, stage: parsed.data.stage },
  });
  res.json({ contact });
});

const activationSchema = z.object({ saleId: z.string().uuid() });
router.post("/onboarding/activate", requireAuth, async (req, res): Promise<void> => {
  const parsed = activationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  res.status(409).json({
    error: "Ativação requer evidência de entrega verificada por provedor confiável",
    code: "FULFILLMENT_EVIDENCE_REQUIRED",
  });
});

const offerSchema = z.object({ productId: z.string().uuid(), targetProductId: z.string().uuid(), minimumActivationHours: z.number().int().min(0).max(8760).default(0) });
router.post("/upsell-offers", requireAuth, async (req, res): Promise<void> => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  const [offer] = await db.insert(upsellOffersTable).values({ workspaceId: req.auth.workspaceId, ...parsed.data, approved: false }).returning();
  res.status(201).json({ offer });
});
router.post("/upsell-offers/:offerId/approve", requireAuth, async (req, res): Promise<void> => {
  const [offer] = await db.update(upsellOffersTable).set({ approved: true }).where(and(eq(upsellOffersTable.id, req.params.offerId as string), eq(upsellOffersTable.workspaceId, req.auth.workspaceId))).returning();
  if (!offer) { res.status(404).json({ error: "Oferta não encontrada", code: "NOT_FOUND" }); return; }
  res.json({ offer });
});
router.get("/upsell-actions", requireAuth, async (req, res): Promise<void> => {
  const actions = await db.select().from(upsellActionsTable).where(eq(upsellActionsTable.workspaceId, req.auth.workspaceId)).orderBy(desc(upsellActionsTable.createdAt));
  res.json({ actions });
});

const riskSchema = z.object({ contactId: z.string().uuid(), riskScore: z.number().int().min(0).max(100), reason: z.string().min(1).max(250) });
router.post("/retention/risk", requireAuth, async (req, res): Promise<void> => {
  const parsed = riskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  const [contact] = await db.select({ id: lifecycleContactsTable.id }).from(lifecycleContactsTable).where(and(eq(lifecycleContactsTable.id, parsed.data.contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!contact) { res.status(404).json({ error: "Contato não encontrado", code: "NOT_FOUND" }); return; }
  await createRetentionAction(contact.id, req.auth.workspaceId, parsed.data.riskScore, parsed.data.reason);
  const actions = await db.select().from(retentionActionsTable).where(and(eq(retentionActionsTable.workspaceId, req.auth.workspaceId), eq(retentionActionsTable.contactId, contact.id)));
  res.json({ actions });
});

router.post("/referrals/enroll", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ contactId: z.string().uuid(), expiresAt: z.coerce.date().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  const [contact] = await db.select().from(lifecycleContactsTable).where(and(eq(lifecycleContactsTable.id, parsed.data.contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!contact) { res.status(409).json({ error: "Somente compradores podem participar", code: "REFERRER_NOT_CUSTOMER" }); return; }
  const [paidSale] = contact.email
    ? await db.select({ id: productSalesTable.id }).from(productSalesTable).where(and(
      eq(productSalesTable.workspaceId, req.auth.workspaceId),
      eq(productSalesTable.status, "paid"),
      sql`lower(${productSalesTable.buyerEmail}) = lower(${contact.email})`,
    )).limit(1)
    : [];
  if (!paidSale) { res.status(409).json({ error: "Somente compradores podem participar", code: "REFERRER_NOT_CUSTOMER" }); return; }
  const [existing] = await db.select().from(purchaserReferralsTable).where(and(eq(purchaserReferralsTable.workspaceId, req.auth.workspaceId), eq(purchaserReferralsTable.referrerContactId, contact.id))).limit(1);
  if (existing) { res.json({ referral: existing, duplicate: true }); return; }
  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const [referral] = await db.insert(purchaserReferralsTable).values({ workspaceId: req.auth.workspaceId, referrerContactId: contact.id, code, expiresAt: parsed.data.expiresAt ?? null }).returning();
  res.status(201).json({ referral, duplicate: false });
});

export default router;