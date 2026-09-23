import { and, asc, eq, lte, or, sql } from "drizzle-orm";
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

export async function findOrCreateLifecycleContact(input: ContactInput, executor: any = db) {
  if (!input.email && !input.phone) return null;
  const identity = [
    input.email ? eq(lifecycleContactsTable.email, input.email.toLowerCase()) : undefined,
    input.phone ? eq(lifecycleContactsTable.phone, input.phone) : undefined,
  ].filter(Boolean);
  const [existing] = await executor.select().from(lifecycleContactsTable).where(and(
    eq(lifecycleContactsTable.workspaceId, input.workspaceId),
    or(...identity as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]),
  )).limit(1);
  if (existing) return existing;
  const [contact] = await executor.insert(lifecycleContactsTable).values({
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
  await db.transaction(async (tx) => {
    // The sale row is authoritative. This lock also makes a delayed paid callback
    // harmless when a refund won the state transition.
    const [authoritative] = await tx.select().from(productSalesTable)
      .where(and(eq(productSalesTable.id, sale.id), eq(productSalesTable.workspaceId, sale.workspaceId))).for("update");
    if (!authoritative || authoritative.status !== "paid") return;
    const contact = await findOrCreateLifecycleContact({
      workspaceId: authoritative.workspaceId, email: authoritative.buyerEmail, name: authoritative.buyerName,
    }, tx);
    const event = await tx.insert(lifecycleEventsTable).values({
      workspaceId: authoritative.workspaceId, contactId: contact?.id ?? null, eventKey: `paid:${authoritative.id}`,
      type: "paid", subjectType: "product_sale", subjectId: authoritative.id, occurredAt: authoritative.paidAt ?? new Date(),
    }).onConflictDoNothing().returning();
    if (!event[0]) return;
    if (contact) await tx.update(lifecycleContactsTable).set({
      stage: "customer",
      lifetimeValueCents: sql`${lifecycleContactsTable.lifetimeValueCents} + ${authoritative.amountCents}`,
      lastActivityAt: new Date(),
    }).where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, authoritative.workspaceId)));
    await tx.insert(buyerOnboardingInstancesTable).values({
      workspaceId: authoritative.workspaceId, saleId: authoritative.id, productId: authoritative.productId, contactId: contact?.id ?? null,
    }).onConflictDoNothing();
    await tx.update(cartRecoveryActionsTable).set({ status: "suppressed", reason: "payment_confirmed" })
      .where(and(eq(cartRecoveryActionsTable.saleId, authoritative.id), eq(cartRecoveryActionsTable.workspaceId, authoritative.workspaceId), eq(cartRecoveryActionsTable.status, "pending")));
    const referralCode = (authoritative.metadata as Record<string, unknown>)["purchaserReferralCode"];
    if (typeof referralCode === "string" && referralCode && contact) {
      const [referral] = await tx.select().from(purchaserReferralsTable).where(and(
      eq(purchaserReferralsTable.workspaceId, authoritative.workspaceId), eq(purchaserReferralsTable.code, referralCode),
      eq(purchaserReferralsTable.active, true),
    )).limit(1);
      if (referral && referral.referrerContactId !== contact.id && (!referral.expiresAt || referral.expiresAt > new Date())) {
        const [attribution] = await tx.insert(purchaserReferralAttributionsTable).values({
          workspaceId: authoritative.workspaceId, referralId: referral.id, referredContactId: contact.id, saleId: authoritative.id,
      }).onConflictDoNothing().returning();
        if (attribution) await tx.insert(referralRewardsTable).values({
        workspaceId: authoritative.workspaceId, attributionId: attribution.id, amountCents: 0,
        status: "pending", reason: "awaiting_approved_reward_fulfillment",
      }).onConflictDoNothing();
      }
    }
  });
}

export async function recordRefundedSale(sale: typeof productSalesTable.$inferSelect): Promise<void> {
  await db.transaction(async (tx) => {
  const [authoritative] = await tx.select().from(productSalesTable)
    .where(and(eq(productSalesTable.id, sale.id), eq(productSalesTable.workspaceId, sale.workspaceId))).for("update");
  if (!authoritative || authoritative.status !== "refunded") return;
  const contact = await findOrCreateLifecycleContact({ workspaceId: authoritative.workspaceId, email: authoritative.buyerEmail, name: authoritative.buyerName }, tx);
  const [event] = await tx.insert(lifecycleEventsTable).values({ workspaceId: authoritative.workspaceId, contactId: contact?.id ?? null, eventKey: `refunded:${authoritative.id}`, type: "refunded", subjectType: "product_sale", subjectId: authoritative.id, occurredAt: new Date() }).onConflictDoNothing().returning();
  if (!event) return;
  if (contact) await tx.update(lifecycleContactsTable).set({
    lifetimeValueCents: sql`GREATEST(0, ${lifecycleContactsTable.lifetimeValueCents} - ${authoritative.amountCents})`,
    churnRisk: 100, stage: "at_risk", lastActivityAt: new Date(),
  }).where(and(eq(lifecycleContactsTable.id, contact.id), eq(lifecycleContactsTable.workspaceId, authoritative.workspaceId)));
  await tx.update(buyerOnboardingInstancesTable).set({ status: "suppressed" })
    .where(and(eq(buyerOnboardingInstancesTable.saleId, authoritative.id), eq(buyerOnboardingInstancesTable.workspaceId, authoritative.workspaceId), eq(buyerOnboardingInstancesTable.status, "pending")));
  await tx.update(upsellActionsTable).set({ status: "suppressed" })
    .where(and(eq(upsellActionsTable.sourceSaleId, authoritative.id), eq(upsellActionsTable.workspaceId, authoritative.workspaceId), eq(upsellActionsTable.status, "pending")));
  await tx.update(referralRewardsTable).set({ status: "reversed", reversedAt: new Date() })
    .where(and(eq(referralRewardsTable.workspaceId, authoritative.workspaceId), eq(referralRewardsTable.status, "pending"),
      sql`${referralRewardsTable.attributionId} IN (SELECT id FROM purchaser_referral_attributions WHERE sale_id = ${authoritative.id})`));
  });
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
  )).orderBy(asc(productSalesTable.id)).limit(100);
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

/**
 * Reconcile recovery intents against the authoritative sale and contact rows.
 *
 * This only ever suppresses an intent.  In particular, it does not claim,
 * complete, or dispatch anything.  The status predicate on the update is the
 * inter-process CAS; the audit event is appended in the same transaction and
 * therefore only the CAS winner leaves an audit trail.
 */
export async function reconcilePendingCartRecoveryActions(
  workspaceId: string,
  now = new Date(),
  limit = 100,
): Promise<number> {
  const actions = await db.select().from(cartRecoveryActionsTable).where(and(
    eq(cartRecoveryActionsTable.workspaceId, workspaceId),
    eq(cartRecoveryActionsTable.status, "pending"),
    // Do not spend the page on valid intents, which are intentionally left
    // pending until a provider dispatcher claims them.
    sql`NOT EXISTS (
      SELECT 1 FROM product_sales s
      LEFT JOIN lifecycle_contacts c ON c.id = ${cartRecoveryActionsTable.contactId}
        AND c.workspace_id = ${workspaceId}
      WHERE s.id = ${cartRecoveryActionsTable.saleId}
        AND s.workspace_id = ${workspaceId}
        AND s.status = 'expired' AND s.expires_at <= ${now}
        AND ((${cartRecoveryActionsTable.channel} = 'email' AND c.email_consent = true)
          OR (${cartRecoveryActionsTable.channel} = 'whatsapp' AND c.whatsapp_consent = true))
    )`,
  )).orderBy(asc(cartRecoveryActionsTable.id)).limit(limit);
  let suppressed = 0;

  for (const action of actions) {
    const won = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(productSalesTable).where(and(
        eq(productSalesTable.id, action.saleId),
        eq(productSalesTable.workspaceId, workspaceId),
      )).limit(1);
      const [contact] = action.contactId
        ? await tx.select().from(lifecycleContactsTable).where(and(
          eq(lifecycleContactsTable.id, action.contactId),
          eq(lifecycleContactsTable.workspaceId, workspaceId),
        )).limit(1)
        : [];

      let reason: string | null = null;
      if (!sale) reason = "sale_not_found";
      else if (sale.status === "paid") reason = "payment_confirmed";
      else if (sale.status === "refunded") reason = "sale_refunded";
      else if (sale.status !== "expired" || !sale.expiresAt || sale.expiresAt > now) reason = "checkout_not_expired";
      else {
        const consented = action.channel === "email"
          ? Boolean(contact?.emailConsent)
          : action.channel === "whatsapp" && Boolean(contact?.whatsappConsent);
        if (!consented) reason = "marketing_consent_revoked";
      }
      if (!reason) return false;

      const [updated] = await tx.update(cartRecoveryActionsTable).set({
        status: "suppressed",
        reason,
      }).where(and(
        eq(cartRecoveryActionsTable.id, action.id),
        eq(cartRecoveryActionsTable.workspaceId, workspaceId),
        eq(cartRecoveryActionsTable.status, "pending"),
      )).returning({ id: cartRecoveryActionsTable.id });
      if (!updated) return false;

      await tx.insert(lifecycleEventsTable).values({
        workspaceId,
        contactId: action.contactId ?? null,
        eventKey: `cart_recovery_suppressed:${action.id}:${reason}`,
        type: "payment_expired",
        subjectType: "cart_recovery_action",
        subjectId: action.id,
        payload: { reason },
        occurredAt: now,
      }).onConflictDoNothing();
      return true;
    });
    if (won) suppressed += 1;
  }
  return suppressed;
}

/** Repairs only a bounded, deterministic page of authoritative terminal sales. */
export async function repairProductSaleLifecycle(limit = 100, workspaceId?: string): Promise<number> {
  const candidates = await db.select().from(productSalesTable)
    .where(sql`${productSalesTable.status} IN ('paid', 'refunded')
      ${workspaceId ? sql`AND ${eq(productSalesTable.workspaceId, workspaceId)}` : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM lifecycle_events le
        WHERE le.workspace_id = ${productSalesTable.workspaceId}
          AND le.event_key = ${productSalesTable.status} || ':' || ${productSalesTable.id}
      )`)
    .orderBy(asc(productSalesTable.id)).limit(limit);
  let repaired = 0;
  for (const sale of candidates) {
    const [event] = await db.select({ id: lifecycleEventsTable.id }).from(lifecycleEventsTable)
      .where(and(eq(lifecycleEventsTable.workspaceId, sale.workspaceId), eq(lifecycleEventsTable.eventKey, `${sale.status}:${sale.id}`))).limit(1);
    if (event) continue;
    if (sale.status === "paid") await recordPaidSale(sale);
    else await recordRefundedSale(sale);
    repaired += 1;
  }
  return repaired;
}

export async function lifecycleSchedulerTick(): Promise<void> {
  const recoveryCreated = await processExpiredCarts();
  const lifecycleRepaired = await repairProductSaleLifecycle(100);
  // Discover only a bounded page, then reconcile each workspace separately.
  // No provider work is performed here.
  const pending = await db.select({ workspaceId: cartRecoveryActionsTable.workspaceId })
    .from(cartRecoveryActionsTable)
    .where(and(eq(cartRecoveryActionsTable.status, "pending"), sql`NOT EXISTS (
      SELECT 1 FROM product_sales s
      LEFT JOIN lifecycle_contacts c ON c.id = ${cartRecoveryActionsTable.contactId}
      WHERE s.id = ${cartRecoveryActionsTable.saleId} AND s.workspace_id = ${cartRecoveryActionsTable.workspaceId}
        AND s.status = 'expired' AND s.expires_at <= NOW()
        AND ((${cartRecoveryActionsTable.channel} = 'email' AND c.email_consent = true)
          OR (${cartRecoveryActionsTable.channel} = 'whatsapp' AND c.whatsapp_consent = true))
    )`))
    .orderBy(asc(cartRecoveryActionsTable.id)).limit(100);
  const workspaceIds = [...new Set(pending.map((row) => row.workspaceId))];
  let recoverySuppressed = 0;
  for (const workspaceId of workspaceIds) {
    recoverySuppressed += await reconcilePendingCartRecoveryActions(workspaceId);
  }
  if (recoveryCreated || recoverySuppressed || lifecycleRepaired) {
    logger.info({ recoveryCreated, recoverySuppressed, lifecycleRepaired }, "Lifecycle recovery intents reconciled; provider dispatch remains external");
  }
}