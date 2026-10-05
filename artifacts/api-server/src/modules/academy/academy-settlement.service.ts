import { and, eq, isNull } from "drizzle-orm";
import { db, academyPurchasesTable, academyLeadsTable, type AcademyPurchase } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { parseAsaasSettlement, type AsaasSettlement } from "../billing/billing-settlement.js";

export interface AcademySettlement extends AsaasSettlement {
  customer: string;
  externalReference: string;
}

export function parseAcademySettlement(value: unknown): AcademySettlement {
  const payment = parseAsaasSettlement(value);
  const binding = value as Record<string, unknown>;
  if (typeof binding.customer !== "string" || !binding.customer || binding.customer.length > 100 ||
      typeof binding.externalReference !== "string" || !binding.externalReference || binding.externalReference.length > 100) {
    throw new AppError(502, "Resposta inválida do provedor", "INVALID_SETTLEMENT_RESPONSE");
  }
  return { ...payment, customer: binding.customer, externalReference: binding.externalReference };
}

export async function fetchAcademySettlement(paymentId: string, request: typeof fetch = fetch): Promise<AcademySettlement> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new AppError(503, "Asaas não configurado", "ASAAS_NOT_CONFIGURED");
  // Academy creation uses ASAAS_SANDBOX, not billing's ASAAS_ENV. Preserve
  // that account/environment selection rather than silently mixing them.
  const base = process.env.ASAAS_SANDBOX === "true" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  let body: unknown;
  try {
    const response = await request(`${base}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET", headers: { accept: "application/json", access_token: key, "User-Agent": "NexOS/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Provider lookup failed");
    body = await response.json();
  } catch {
    throw new AppError(503, "Não foi possível verificar o pagamento", "SETTLEMENT_VERIFICATION_UNAVAILABLE");
  }
  return parseAcademySettlement(body);
}

export function matchesAcademySettlement(purchase: AcademyPurchase, payment: AcademySettlement): boolean {
  const cents = Math.round(payment.value * 100);
  if (payment.deleted || !purchase.asaasPaymentId || !purchase.asaasCustomerId ||
      payment.id !== purchase.asaasPaymentId || payment.customer !== purchase.asaasCustomerId ||
      payment.externalReference !== purchase.id || !Number.isSafeInteger(cents) ||
      Math.abs(payment.value * 100 - cents) > 0.000001 || cents !== purchase.amountCents ||
      !["PIX", "BOLETO", "CREDIT_CARD"].includes(payment.billingType)) {
    throw new AppError(409, "Pagamento divergente da compra Academy", "ACADEMY_SETTLEMENT_MISMATCH");
  }
  return payment.status === "RECEIVED" || (payment.billingType === "CREDIT_CARD" && payment.status === "CONFIRMED");
}

export type AcademyConfirmation = { status: "not_found" | "already_confirmed" | "unsettled" }
  | { status: "confirmed"; purchase: AcademyPurchase };

export async function confirmAcademyPayment(
  paymentId: string,
  lookup: (id: string) => Promise<unknown> = fetchAcademySettlement,
): Promise<AcademyConfirmation> {
  // Never select a purchase using the webhook's untrusted externalReference.
  const where = eq(academyPurchasesTable.asaasPaymentId, paymentId);
  const candidates = await db.select().from(academyPurchasesTable).where(where).limit(2);
  if (candidates.length > 1) throw new AppError(409, "Pagamento Academy ambíguo", "AMBIGUOUS_ACADEMY_PAYMENT");
  const existing = candidates[0];
  if (!existing) return { status: "not_found" };
  if (existing.status === "confirmed") return { status: "already_confirmed" };
  if (existing.status !== "pending") throw new AppError(409, "Estado da compra não permite confirmação", "INVALID_ACADEMY_TRANSITION");
  const payment = parseAcademySettlement(await lookup(paymentId));
  if (!matchesAcademySettlement(existing, payment)) return { status: "unsettled" };

  return db.transaction(async (trx): Promise<AcademyConfirmation> => {
    const rows = await trx.select().from(academyPurchasesTable).where(where)
      .orderBy(academyPurchasesTable.id).limit(2).for("update");
    if (rows.length > 1) throw new AppError(409, "Pagamento Academy ambíguo", "AMBIGUOUS_ACADEMY_PAYMENT");
    const purchase = rows[0];
    if (!purchase || purchase.id !== existing.id) throw new AppError(409, "Compra alterada durante verificação", "ACADEMY_PURCHASE_CHANGED");
    if (purchase.status === "confirmed") return { status: "already_confirmed" };
    if (purchase.status !== "pending") throw new AppError(409, "Estado da compra não permite confirmação", "INVALID_ACADEMY_TRANSITION");
    if (!matchesAcademySettlement(purchase, payment)) return { status: "unsettled" };
    const confirmedAt = new Date();
    const [confirmed] = await trx.update(academyPurchasesTable)
      .set({ status: "confirmed", confirmedAt }).where(eq(academyPurchasesTable.id, purchase.id)).returning();
    await trx.update(academyLeadsTable).set({ convertedAt: confirmedAt }).where(and(
      eq(academyLeadsTable.email, purchase.customerEmail.toLowerCase()), isNull(academyLeadsTable.convertedAt),
    ));
    return { status: "confirmed", purchase: confirmed! };
  });
}
