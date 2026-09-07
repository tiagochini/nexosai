import { Router } from "express";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { auditLogsTable, buyerOnboardingInstancesTable, cartRecoveryActionsTable, db, lifecycleContactsTable, lifecycleEventsTable, purchaserReferralsTable, retentionActionsTable, upsellActionsTable, upsellOffersTable } from "@workspace/db";
import { requireAuth } from "../auth/auth.middleware.js";
import { createRetentionAction, queueEligibleUpsells, recordLifecycleEvent } from "./lifecycle.service.js";

const router = Router();

router.get("/contacts", requireAuth, async (req, res): Promise<void> => {
  const contacts = await db.select().from(lifecycleContactsTable)
    .where(eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId))
    .orderBy(desc(lifecycleContactsTable.lastActivityAt));
  res.json({ contacts });
});

router.get("/contacts/:contactId/timeline", requireAuth, async (req, res): Promise<void> => {
  const contactId = Array.isArray(req.params.contactId) ? req.params.contactId[0] : req.params.contactId;
  const [contact] = await db.select().from(lifecycleContactsTable).where(and(
    eq(lifecycleContactsTable.id, contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId),
  )).limit(1);
  if (!contact) { res.status(404).json({ error: "Contato não encontrado", code: "NOT_FOUND" }); return; }
  const [events, onboarding, recovery] = await Promise.all([
    db.select().from(lifecycleEventsTable).where(and(eq(lifecycleEventsTable.workspaceId, req.auth.workspaceId), eq(lifecycleEventsTable.contactId, contactId))).orderBy(desc(lifecycleEventsTable.occurredAt)),
    db.select().from(buyerOnboardingInstancesTable).where(and(eq(buyerOnboardingInstancesTable.workspaceId, req.auth.workspaceId), eq(buyerOnboardingInstancesTable.contactId, contactId))),
    db.select().from(cartRecoveryActionsTable).where(and(eq(cartRecoveryActionsTable.workspaceId, req.auth.workspaceId), eq(cartRecoveryActionsTable.contactId, contactId))),
  ]);
  res.json({ contact, events, onboarding, recovery });
});

const stageSchema = z.object({ stage: z.enum(["lead", "qualified", "checkout_started", "customer", "at_risk", "churned"]) });
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
  const [instance] = await db.update(buyerOnboardingInstancesTable).set({ status: "completed", activatedAt: new Date() })
    .where(and(eq(buyerOnboardingInstancesTable.saleId, parsed.data.saleId), eq(buyerOnboardingInstancesTable.workspaceId, req.auth.workspaceId), eq(buyerOnboardingInstancesTable.status, "pending")))
    .returning();
  if (!instance) { res.status(409).json({ error: "Onboarding inexistente ou já ativado", code: "ONBOARDING_NOT_PENDING" }); return; }
  await recordLifecycleEvent({ workspaceId: req.auth.workspaceId, contactId: instance.contactId, eventKey: `activation:${instance.saleId}`, type: "activation", subjectType: "product_sale", subjectId: instance.saleId });
  await queueEligibleUpsells(instance.saleId, req.auth.workspaceId);
  res.json({ onboarding: instance });
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
  const [contact] = await db.select().from(lifecycleContactsTable).where(and(eq(lifecycleContactsTable.id, parsed.data.contactId), eq(lifecycleContactsTable.workspaceId, req.auth.workspaceId), eq(lifecycleContactsTable.stage, "customer"))).limit(1);
  if (!contact) { res.status(409).json({ error: "Somente compradores podem participar", code: "REFERRER_NOT_CUSTOMER" }); return; }
  const [existing] = await db.select().from(purchaserReferralsTable).where(and(eq(purchaserReferralsTable.workspaceId, req.auth.workspaceId), eq(purchaserReferralsTable.referrerContactId, contact.id))).limit(1);
  if (existing) { res.json({ referral: existing, duplicate: true }); return; }
  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const [referral] = await db.insert(purchaserReferralsTable).values({ workspaceId: req.auth.workspaceId, referrerContactId: contact.id, code, expiresAt: parsed.data.expiresAt ?? null }).returning();
  res.status(201).json({ referral, duplicate: false });
});

export default router;