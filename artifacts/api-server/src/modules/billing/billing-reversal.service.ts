import { and, eq, sql } from "drizzle-orm";
import { db, subscriptionPaymentsTable as payments, creditTransactionsTable as credits, workspacesTable, commercialSubscriptionsTable, commercialOfferContractsTable } from "@workspace/db";
import { parseAsaasSettlement, fetchAsaasSettlement, assertBillingSettlementBinding } from "./billing-settlement.js";
import { completedRefundCents, isChargebackHold } from "../../lib/asaas-refunds.js";
import { reversePurchaseCreditsInTransaction } from "../credits/credits.service.js";
import { AppError } from "../../lib/errors.js";
import { reconcileWorkspacePlan } from "./billing-plan-activation.js";

export async function reconcileBillingReversal(externalId: string, lookup: (id: string) => Promise<unknown> = fetchAsaasSettlement) {
  const where = eq(payments.externalId, externalId);
  const rows = await db.select().from(payments).where(where).limit(2);
  if (rows.length > 1) throw new AppError(409, "Pagamento externo ambíguo", "AMBIGUOUS_EXTERNAL_PAYMENT");
  const snapshot = rows[0];
  if (!snapshot) return { handled: false };
  const proof = parseAsaasSettlement(await lookup(externalId));
  assertBillingSettlementBinding(snapshot, proof);
  const refunded = completedRefundCents(proof);
  const hold = isChargebackHold(proof);
  const paid = proof.status === "RECEIVED" || (proof.billingType === "CREDIT_CARD" && proof.status === "CONFIRMED");
  if (!hold && !paid && proof.status !== "REFUNDED") return { handled: true, changed: false };
  return db.transaction(async (trx) => {
    const candidates = await trx.select().from(payments).where(where).orderBy(payments.id).limit(2).for("update");
    const payment = candidates[0];
    if (candidates.length !== 1 || !payment || payment.id !== snapshot.id) throw new AppError(409, "Pagamento alterado", "PAYMENT_CHANGED_DURING_VERIFICATION");
    assertBillingSettlementBinding(payment, proof);
    const meta = payment.metadata as Record<string, unknown>;
    // Serialize the reservation with consumption, preserving the visible balance.
    await trx.select({ id: workspacesTable.id }).from(workspacesTable).where(eq(workspacesTable.id, payment.workspaceId)).for("update");
    const pendingRefund = proof.refunds?.find(r => !["DONE", "CANCELLED"].includes(r.status));
    const request = meta.refundRequest as { amountCents: number; baselineCents: number } | undefined;
    const hasResolution = request ? refunded >= request.baselineCents + request.amountCents : proof.refunds?.some(r => ["DONE", "CANCELLED"].includes(r.status));
    const refundHold = Boolean(pendingRefund) || (meta.refundHold === true && !hasResolution);
    const refundNotice = pendingRefund?.status ?? (hasResolution ? "RESOLVED" : meta.refundNotice);
    const priorRefunded = Number(meta.refundedAmountCents ?? 0);
    if (refunded < priorRefunded) throw new AppError(409, "Estorno consultado regrediu", "REFUND_STATE_REGRESSION");
    const full = refunded === payment.amountCents;
    const activation = meta.planActivation as { creditsGranted?: number; basePlanId: string } | undefined;
    const offerSnapshot = meta.type === "sales_offer" ? meta.offerSnapshot as { creditsIncluded?: number; interval?: string } | undefined : undefined;
    const refundableCredits = meta.type === "pack" ? Number(meta.packCredits)
      : meta.type === "plan" && activation ? Number(activation.creditsGranted)
        : meta.type === "sales_offer" ? Number(offerSnapshot?.creditsIncluded ?? 0) : 0;
    if (!Number.isSafeInteger(refundableCredits) || refundableCredits < 0) throw new AppError(409, "Créditos da oferta inválidos", "INVALID_OFFER_CREDIT_REVERSAL");
    // Cumulative integer proportion; repeated partial events cannot compound rounding.
    const desired = hold || full ? refundableCredits : Number(BigInt(refundableCredits) * BigInt(refunded) / BigInt(payment.amountCents));
    const prior = Number(meta.creditsReversed ?? 0);
    const version = Number(meta.reversalVersion ?? 0);
    if (![prior, version, priorRefunded].every(Number.isSafeInteger) || prior < 0 || prior > refundableCredits || version < 0) throw new AppError(409, "Histórico financeiro inválido", "INVALID_REVERSAL_HISTORY");
    let review: string | null = null;
    if (desired !== prior && refundableCredits > 0) {
      const grantKey = meta.type === "sales_offer" ? `offer-payment:${payment.id}` : `billing-payment:${payment.id}`;
      const [grant] = await trx.select().from(credits).where(eq(credits.idempotencyKey, grantKey));
      if (!grant || grant.workspaceId !== payment.workspaceId || grant.type !== "credit" || grant.amount !== refundableCredits) review = "LEGACY_CREDIT_GRANT_UNVERIFIED";
      else await reversePurchaseCreditsInTransaction(trx, payment.workspaceId, desired - prior, `billing-reversal:${payment.id}:${version + 1}`);
    }
    const beforeHold = ["pending", "processing", "paid"].includes(String(meta.financialPreviousStatus)) ? meta.financialPreviousStatus as "pending" | "processing" | "paid" : "paid";
    const status = full ? "refunded" : hold ? "failed" : meta.financialHold && paid ? beforeHold : payment.status;
    const changed = refunded !== priorRefunded || desired !== prior || (meta.financialHold ?? null) !== (hold ? proof.status : null) || status !== payment.status || refundHold !== (meta.refundHold === true) || refundNotice !== meta.refundNotice;
    if (!changed) return { handled: true, changed: false };
    await trx.update(payments).set({ status, updatedAt: new Date(), metadata: {
      ...meta, refundHold, refundNotice, refundedAmountCents: refunded, financialHold: hold ? proof.status : null,
      ...(hold && !meta.financialHold ? { financialPreviousStatus: payment.status } : {}),
      creditsReversed: review ? prior : desired, reversalVersion: desired !== prior && !review ? version + 1 : version,
      reversalReview: review, providerFinancialStatus: proof.status,
    } }).where(eq(payments.id, payment.id));
    if (full && meta.type === "sales_offer") {
      await trx.update(commercialSubscriptionsTable).set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(commercialSubscriptionsTable.workspaceId, payment.workspaceId), sql`${commercialSubscriptionsTable.providerMetadata}->>'sourcePaymentId' = ${payment.id}`));
      const contractId = typeof meta.offerContractId === "string" ? meta.offerContractId : null;
      const offerInterval = offerSnapshot?.interval;
      if (contractId && offerInterval === "one_time") {
        await trx.update(commercialSubscriptionsTable).set({ status: "expired", updatedAt: new Date() })
          .where(and(eq(commercialSubscriptionsTable.workspaceId, payment.workspaceId), sql`${commercialSubscriptionsTable.providerMetadata}->>'salesOfferContractId' = ${contractId}`));
        await trx.update(commercialOfferContractsTable).set({ status: "expired", currentPeriodEndsAt: new Date(), updatedAt: new Date() })
          .where(and(eq(commercialOfferContractsTable.id, contractId), eq(commercialOfferContractsTable.workspaceId, payment.workspaceId)));
      } else if (contractId) {
        await trx.update(commercialOfferContractsTable).set({ currentPeriodEndsAt: new Date(), updatedAt: new Date() })
          .where(and(eq(commercialOfferContractsTable.id, contractId), eq(commercialOfferContractsTable.workspaceId, payment.workspaceId)));
      }
    }
    if (meta.type === "plan" && activation) await reconcileWorkspacePlan(trx, payment.workspaceId, activation.basePlanId);
    return { handled: true, changed: true, review };
  });
}

export async function reconcileBillingIfHeld(externalId: string): Promise<void> {
  const [payment] = await db.select({ metadata: payments.metadata }).from(payments).where(eq(payments.externalId, externalId)).limit(1);
  if ((payment?.metadata as { financialHold?: string } | undefined)?.financialHold) await reconcileBillingReversal(externalId);
}
