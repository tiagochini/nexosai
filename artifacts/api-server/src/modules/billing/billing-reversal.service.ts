import { eq } from "drizzle-orm";
import { db, subscriptionPaymentsTable as payments, creditTransactionsTable as credits } from "@workspace/db";
import { parseAsaasSettlement, fetchAsaasSettlement, assertBillingSettlementBinding } from "./billing-settlement.js";
import { completedRefundCents, isChargebackHold } from "../../lib/asaas-refunds.js";
import { reversePurchaseCreditsInTransaction } from "../credits/credits.service.js";
import { AppError } from "../../lib/errors.js";

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
    const priorRefunded = Number(meta.refundedAmountCents ?? 0);
    if (refunded < priorRefunded) throw new AppError(409, "Estorno consultado regrediu", "REFUND_STATE_REGRESSION");
    const full = refunded === payment.amountCents;
    const packCredits = meta.type === "pack" ? Number(meta.packCredits) : 0;
    if (!Number.isSafeInteger(packCredits) || packCredits < 0) throw new AppError(409, "Pack inválido", "INVALID_PACK_REVERSAL");
    // Cumulative integer proportion; repeated partial events cannot compound rounding.
    const desired = hold || full ? packCredits : Number(BigInt(packCredits) * BigInt(refunded) / BigInt(payment.amountCents));
    const prior = Number(meta.creditsReversed ?? 0);
    const version = Number(meta.reversalVersion ?? 0);
    if (![prior, version, priorRefunded].every(Number.isSafeInteger) || prior < 0 || prior > packCredits || version < 0) throw new AppError(409, "Histórico financeiro inválido", "INVALID_REVERSAL_HISTORY");
    let review: string | null = null;
    if (desired !== prior && packCredits > 0) {
      const [grant] = await trx.select().from(credits).where(eq(credits.idempotencyKey, `billing-payment:${payment.id}`));
      if (!grant || grant.workspaceId !== payment.workspaceId || grant.type !== "credit" || grant.amount !== packCredits) review = "LEGACY_CREDIT_GRANT_UNVERIFIED";
      else await reversePurchaseCreditsInTransaction(trx, payment.workspaceId, desired - prior, `billing-reversal:${payment.id}:${version + 1}`);
    }
    const beforeHold = ["pending", "processing", "paid"].includes(String(meta.financialPreviousStatus)) ? meta.financialPreviousStatus as "pending" | "processing" | "paid" : "paid";
    const status = full ? "refunded" : hold ? "failed" : meta.financialHold && paid ? beforeHold : payment.status;
    const changed = refunded !== priorRefunded || desired !== prior || (meta.financialHold ?? null) !== (hold ? proof.status : null) || status !== payment.status;
    if (!changed) return { handled: true, changed: false };
    await trx.update(payments).set({ status, updatedAt: new Date(), metadata: {
      ...meta, refundedAmountCents: refunded, financialHold: hold ? proof.status : null,
      ...(hold && !meta.financialHold ? { financialPreviousStatus: payment.status } : {}),
      creditsReversed: review ? prior : desired, reversalVersion: desired !== prior && !review ? version + 1 : version,
      reversalReview: review, providerFinancialStatus: proof.status,
    } }).where(eq(payments.id, payment.id));
    return { handled: true, changed: true, review };
  });
}

export async function reconcileBillingIfHeld(externalId: string): Promise<void> {
  const [payment] = await db.select({ metadata: payments.metadata }).from(payments).where(eq(payments.externalId, externalId)).limit(1);
  if ((payment?.metadata as { financialHold?: string } | undefined)?.financialHold) await reconcileBillingReversal(externalId);
}
