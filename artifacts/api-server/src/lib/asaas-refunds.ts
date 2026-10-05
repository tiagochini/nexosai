import type { AsaasSettlement } from "../modules/billing/billing-settlement.js";
import { AppError } from "./errors.js";
export const REVERSAL_EVENTS = ["PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_REFUND_DENIED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"];
export function completedRefundCents(payment: AsaasSettlement): number {
  let total = 0;
  for (const refund of payment.refunds ?? []) {
    if (refund.status !== "DONE") continue;
    const cents = Math.round(refund.value * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(refund.value * 100 - cents) > 0.000001) throw new AppError(502, "Valor de estorno inválido", "INVALID_REFUND_RESPONSE");
    total += cents;
  }
  if (!Number.isSafeInteger(total) || total > Math.round(payment.value * 100)) throw new AppError(502, "Total de estorno inválido", "INVALID_REFUND_RESPONSE");
  if (payment.status === "REFUNDED" && total !== Math.round(payment.value * 100)) throw new AppError(502, "Estorno integral sem comprovação de conclusão", "INCOMPLETE_REFUND_PROOF");
  return total;
}
export function isChargebackHold(payment: AsaasSettlement): boolean {
  return ["CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(payment.status);
}
