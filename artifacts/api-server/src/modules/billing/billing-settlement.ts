import type { SubscriptionPayment } from "@workspace/db";
import { AppError } from "../../lib/errors.js";

export interface AsaasSettlement {
  id: string;
  status: string;
  value: number;
  billingType: string;
  deleted?: boolean;
}

export function parseAsaasSettlement(value: unknown): AsaasSettlement {
  if (!value || typeof value !== "object") throw new AppError(502, "Resposta inválida do provedor", "INVALID_SETTLEMENT_RESPONSE");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || row.id.length > 128 ||
      typeof row.status !== "string" || !row.status || row.status.length > 64 ||
      typeof row.billingType !== "string" || !row.billingType || row.billingType.length > 64 ||
      typeof row.value !== "number" || !Number.isFinite(row.value) || row.value <= 0 ||
      (row.deleted !== undefined && typeof row.deleted !== "boolean")) {
    throw new AppError(502, "Resposta inválida do provedor", "INVALID_SETTLEMENT_RESPONSE");
  }
  // Do not retain the full provider object (customer/card details, tokens, etc.).
  return { id: row.id, status: row.status, value: row.value, billingType: row.billingType, deleted: row.deleted as boolean | undefined };
}

export async function fetchAsaasSettlement(paymentId: string, request: typeof fetch = fetch): Promise<AsaasSettlement> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AppError(503, "Asaas não configurado", "ASAAS_NOT_CONFIGURED");
  const base = process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  let body: unknown;
  try {
    const response = await request(`${base}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET", headers: { accept: "application/json", access_token: apiKey, "User-Agent": "NexOS/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Provider lookup failed");
    body = await response.json();
  } catch {
    throw new AppError(503, "Não foi possível verificar o pagamento", "SETTLEMENT_VERIFICATION_UNAVAILABLE");
  }
  return parseAsaasSettlement(body);
}

export function matchesBillingSettlement(
  payment: Pick<SubscriptionPayment, "externalId" | "amountCents" | "currency" | "method">,
  settlement: AsaasSettlement,
): boolean {
  const method = { pix: "PIX", boleto: "BOLETO", credit_card: "CREDIT_CARD" }[payment.method as "pix" | "boleto" | "credit_card"];
  const cents = Math.round(settlement.value * 100);
  if (settlement.deleted || payment.currency !== "BRL" || !method || method !== settlement.billingType ||
      payment.externalId !== settlement.id || !Number.isSafeInteger(cents) ||
      Math.abs(settlement.value * 100 - cents) > 0.000001 || cents !== payment.amountCents) {
    throw new AppError(409, "Pagamento divergente do registro local", "SETTLEMENT_MISMATCH");
  }
  // CONFIRMED Pix may be under precautionary hold. Release Pix/boleto only at
  // RECEIVED; a canonically CONFIRMED credit-card capture is accepted.
  return settlement.status === "RECEIVED" || (payment.method === "credit_card" && settlement.status === "CONFIRMED");
}
