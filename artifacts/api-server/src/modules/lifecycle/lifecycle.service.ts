import { and, eq, lte, or, sql } from "drizzle-orm";
import {
  buyerOnboardingInstancesTable,
  cartRecoveryActionsTable,
  db,
  lifecycleContactsTable,
  lifecycleEventsTable,
  purchaserReferralAttributionsTable,
  purchaserReferralsTable,
  productSalesTable,
  referralRewardsTable,
  retentionActionsTable,
  upsellActionsTable,
  upsellOffersTable,
  type LifecycleEvent,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";

type ContactInput = {
  workspaceId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  emailConsent?: boolean;
  whatsappConsent?: boolean;
  source?: string | null;
};

export async function findOrCreateLifecycleContact(input: ContactInput) {
  if (!input.email && !input.phone) return null;
  const identity = [
    input.email ? eq(lifecycleContactsTable.email, input.email.toLowerCase()) : undefined,
    input.phone ? eq(lifecycleContactsTable.phone, input.phone) : undefined,
  ].filter(Boolean);
  const [existing] = await db.select().from(lifecycleContactsTable).where(and(
    eq(lifecycleContactsTable.workspaceId, input.workspaceId),
    or(...identity as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]),
  )).limit(1);
  if (existing) return existing;
  const [contact] = await db.insert(lifecycleContactsTable).values({
    workspaceId: input.workspaceId,
    email: input.email?.toLowerCase() ?? null,
    phone: input.phone ?? null,
    name: input.name ?? null,
    emailConsent: input.emailConsent ?? false,
    whatsappConsent: input.whatsappConsent ?? false,
    source: input.source ?? null,
    lastActivityAt: new Date(),
  }).returning();
  return contact!;
}

/** Inserts once and is safe to call from a retried webhook or scheduler tick. */
export async function recordLifecycleEvent(input: {
  workspaceId: string;
  eventKey: string;
  type: LifecycleEvent["type"];
  contactId?: string | null;
  subjectType?: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
}): Promise<{ inserted: boolean; event?: LifecycleEvent }> {
  const [event] = await db.insert(lifecycleEventsTable).values({
    workspaceId: input.workspaceId,
    contactId: input.contactId ?? null,
    eventKey: input.eventKey,
    type: input.type,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    payload: input.payload ?? {},
    occurredAt: input.occurredAt ?? new Date(),
  }).onConflictDoNothing().returning();
  return { inserted: Boolean(event), event };
}

export async function recordCheckoutStarted(sale: typeof productSalesTable.$inferSelect): Promise<void> {
  const contact = await findOrCreateLifecycleContact({
    workspaceId: sale.workspaceId, email: sale.buyerEmail, name: sale.buyerName,
  });
  const event = await recordLifecycleEvent({
    workspaceId: sale.workspaceId, contactId: contact?.id, eventKey: `checkout_started:${sale.id}`,
    type: "checkout_started", subjectType: "product_sale", subjectId: sale.id,
  });
  if (event.inserted && contact) {
    await db.update(lifecycleContactsTable).set({ stage: "checkout_started", lastActivityAt: new Date() })
      .where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, sale.workspaceId)));
  }
}

/** Paid-sale boundary: creates exactly one onboarding entitlement and ledger event. */
export async function recordPaidSale(sale: typeof productSalesTable.$inferSelect): Promise<void> {
  const contact = await findOrCreateLifecycleContact({
    workspaceId: sale.workspaceId, email: sale.buyerEmail, name: sale.buyerName,
  });
  const event = await recordLifecycleEvent({
    workspaceId: sale.workspaceId, contactId: contact?.id, eventKey: `paid:${sale.id}`,
    type: "paid", subjectType: "product_sale", subjectId: sale.id, occurredAt: sale.paidAt ?? new Date(),
  });
  if (!event.inserted) return;
  await db.update(lifecycleContactsTable).set({
    stage: "customer",
    lifetimeValueCents: sql`${lifecycleContactsTable.lifetimeValueCents} + ${sale.amountCents}`,
    lastActivityAt: new Date(),
  }).where(and(eq(lifecycleContactsTable.id, contact!.id), eq(lifecycleContactsTable.workspaceId, sale.workspaceId)));
  await db.insert(buyerOnboardingInstancesTable).values({
    workspaceId: sale.workspaceId, saleId: sale.id, productId: sale.productId, contactId: contact?.id ?? null,
  }).onConflictDoNothing();
  await db.update(cartRecoveryActionsTable).set({ status: "suppressed", reason: "payment_confirmed" })
    .where(and(eq(cartRecoveryActionsTable.saleId, sale.id), eq(cartRecoveryActionsTable.workspaceId, sale.workspaceId), eq(cartRecoveryActionsTable.status, "pending")));
  const referralCode = (sale.metadata as Record<string, unknown>)["purchaserReferralCode"];
  if (typeof referralCode === "string" && referralCode) {
    const [referral] = await db.select().from(purchaserReferralsTable).where(and(
      eq(purchaserReferralsTable.workspaceId, sale.workspaceId), eq(purchaserReferralsTable.code, referralCode),
      eq(purchaserReferralsTable.active, true),
    )).limit(1);
    if (referral && referral.referrerContactId !== contact!.id && (!referral.expiresAt || referral.expiresAt > new Date())) {
      const [attribution] = await db.insert(purchaserReferralAttributionsTable).values({
        workspaceId: sale.workspaceId, referralId: referral.id, referredContactId: contact!.id, saleId: sale.id,
      }).onConflictDoNothing().returning();
      if (attribution) await db.insert(referralRewardsTable).values({
        workspaceId: sale.workspaceId, attributionId: attribution.id, amountCents: 0,
        status: "pending", reason: "awaiting_approved_reward_fulfillment",
      }).onConflictDoNothing();
    }
  }
}

export async function recordRefundedSale(sale: typeof productSalesTable.$inferSelect): Promise<void> {
  const contact = await findOrCreateLifecycleContact({ workspaceId: sale.workspaceId, email: sale.buyerEmail, name: sale.buyerName });
  const event = await recordLifecycleEvent({ workspaceId: sale.workspaceId, contactId: contact?.id, eventKey: `refunded:${sale.id}`, type: "refunded", subjectType: "product_sale", subjectId: sale.id });
  if (!event.inserted) return;
  if (contact) await db.update(lifecycleContactsTable).set({
    lifetimeValueCents: sql`GREATEST(0, ${lifecycleContactsTable.lifetimeValueCents} - ${sale.amountCents})`,
    churnRisk: 100, stage: "at_risk", lastActivityAt: new Date(),
  }).where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, sale.workspaceId)));
  await db.update(referralRewardsTable).set({ status: "reversed", reversedAt: new Date() })
    .where(and(eq(referralRewardsTable.workspaceId, sale.workspaceId), eq(referralRewardsTable.status, "pending"),
      sql`${referralRewardsTable.attributionId} IN (SELECT id FROM purchaser_referral_attributions WHERE sale_id = ${sale.id})`));
}

/** Records external revenue without assuming a provider mutation succeeded. */
export async function recordExternalRevenueLifecycle(input: {
  workspaceId: string; eventType: "sale" | "refund" | "subscription_renewal" | "subscription_cancel" | "upsell" | "order_bump";
  transactionId?: string | null; email?: string | null; name?: string | null; netAmountCents: number;
}): Promise<void> {
  if (!input.email) return;
  const contact = await findOrCreateLifecycleContact({ workspaceId: input.workspaceId, email: input.email, name: input.name });
  if (!contact) return;
  const kind = input.eventType === "refund" ? "refunded" : input.eventType === "subscription_renewal" ? "renewal" : input.eventType === "subscription_cancel" ? "payment_expired" : "paid";
  const key = `revenue:${input.eventType}:${input.transactionId ?? `${input.email}:${input.netAmountCents}`}`;
  const event = await recordLifecycleEvent({ workspaceId: input.workspaceId, contactId: contact.id, eventKey: key, type: kind, subjectType: "revenue_event", subjectId: input.transactionId ?? undefined });
  if (!event.inserted) return;
  if (input.eventType === "refund") {
    await db.update(lifecycleContactsTable).set({ lifetimeValueCents: sql`GREATEST(0, ${lifecycleContactsTable.lifetimeValueCents} - ${Math.abs(input.netAmountCents)})`, churnRisk: 100, stage: "at_risk" })
      .where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, input.workspaceId)));
    await createRetentionAction(contact.id, input.workspaceId, 100, "refunded_revenue");
  } else if (input.eventType === "subscription_cancel") {
    await createRetentionAction(contact.id, input.workspaceId, 80, "subscription_cancelled");
  } else {
    await db.update(lifecycleContactsTable).set({ stage: "customer", lifetimeValueCents: sql`${lifecycleContactsTable.lifetimeValueCents} + ${Math.max(0, input.netAmountCents)}`, lastActivityAt: new Date() })
      .where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, input.workspaceId)));
  }
}

export async function createRetentionAction(contactId: string, workspaceId: string, riskScore: number, reason: string): Promise<void> {
  if (riskScore < 60) return;
  await db.update(lifecycleContactsTable).set({ churnRisk: riskScore, stage: "at_risk" })
    .where(and(eq(lifecycleContactsTable.id, contactId), eq(lifecycleContactsTable.workspaceId, workspaceId)));
  await db.insert(retentionActionsTable).values({ workspaceId, contactId, riskScore, reason })
    .onConflictDoNothing();
}

export async function queueEligibleUpsells(saleId: string, workspaceId: string): Promise<number> {
  const [onboarding] = await db.select().from(buyerOnboardingInstancesTable).where(and(
    eq(buyerOnboardingInstancesTable.saleId, saleId), eq(buyerOnboardingInstancesTable.workspaceId, workspaceId), eq(buyerOnboardingInstancesTable.status, "completed"),
  )).limit(1);
  if (!onboarding?.contactId) return 0;
  const [sale] = await db.select().from(productSalesTable).where(and(eq(productSalesTable.id, saleId), eq(productSalesTable.workspaceId, workspaceId), eq(productSalesTable.status, "paid"))).limit(1);
  if (!sale) return 0;
  const offers = await db.select().from(upsellOffersTable).where(and(eq(upsellOffersTable.workspaceId, workspaceId), eq(upsellOffersTable.productId, sale.productId), eq(upsellOffersTable.approved, true)));
  const activationAgeHours = onboarding.activatedAt ? (Date.now() - onboarding.activatedAt.getTime()) / 3_600_000 : 0;
  const eligible = offers.filter((offer) => activationAgeHours >= offer.minimumActivationHours);
  for (const offer of eligible) await db.insert(upsellActionsTable).values({ workspaceId, offerId: offer.id, contactId: onboarding.contactId, sourceSaleId: sale.id })
    .onConflictDoNothing();
  return eligible.length;
}

/** Creates recovery actions only after an expired unpaid sale. Provider sends are intentionally not claimed here. */
export async function processExpiredCarts(now = new Date()): Promise<number> {
  const candidates = await db.select().from(productSalesTable).where(and(
    eq(productSalesTable.status, "pending"), lte(productSalesTable.expiresAt, now),
  ));
  let created = 0;
  for (const sale of candidates) {
    // Claim the expiry transition. A concurrently delivered paid webhook can win
    // this compare-and-swap, in which case no recovery action is created.
    const [expiredSale] = await db.update(productSalesTable)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(productSalesTable.id, sale.id), eq(productSalesTable.status, "pending")))
      .returning();
    if (!expiredSale) continue;
    const contact = await findOrCreateLifecycleContact({ workspaceId: sale.workspaceId, email: sale.buyerEmail, name: sale.buyerName });
    const event = await recordLifecycleEvent({
      workspaceId: sale.workspaceId, contactId: contact?.id, eventKey: `payment_expired:${sale.id}`,
      type: "payment_expired", subjectType: "product_sale", subjectId: sale.id, occurredAt: now,
    });
    if (!event.inserted) continue;
    const channel = contact?.emailConsent ? "email" : contact?.whatsappConsent ? "whatsapp" : null;
    if (channel) {
      await db.insert(cartRecoveryActionsTable).values({
        workspaceId: sale.workspaceId, saleId: sale.id, contactId: contact!.id, channel, reason: "expired_unpaid_checkout",
      }).onConflictDoNothing();
      created += 1;
    } else {
      await db.insert(cartRecoveryActionsTable).values({
        workspaceId: sale.workspaceId, saleId: sale.id, contactId: contact?.id ?? null, channel: "none",
        status: "suppressed", reason: "marketing_consent_missing",
      }).onConflictDoNothing();
    }
  }
  return created;
}

export async function lifecycleSchedulerTick(): Promise<void> {
  const recoveryCreated = await processExpiredCarts();
  if (recoveryCreated) logger.info({ recoveryCreated }, "Lifecycle recovery actions created awaiting approved provider dispatch");
}