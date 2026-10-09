import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, subscriptionPaymentsTable as payments, workspacesTable } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { assertBillingSettlementBinding, fetchAsaasSettlement, parseAsaasSettlement } from "./billing-settlement.js";
import { completedRefundCents } from "../../lib/asaas-refunds.js";
import { reconcileBillingReversal } from "./billing-reversal.service.js";

const base = () => process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
export async function refundProvider(path: string, method = "GET", body?: object): Promise<unknown> {
  if (!process.env.ASAAS_API_KEY) throw new AppError(503, "Asaas não configurado", "ASAAS_NOT_CONFIGURED");
  let response: Response;
  try { response = await fetch(base() + path, { method, headers: { "Content-Type": "application/json", access_token: process.env.ASAAS_API_KEY, "User-Agent": "NexOS/1.0" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new AppError(503, "Resultado do estorno ainda desconhecido. Consulte o Asaas antes de repetir.", "REFUND_RESULT_UNKNOWN"); }
  if (!response.ok) throw new AppError(502, "Asaas não aceitou a solicitação. Consulte o painel antes de repetir.", "REFUND_PROVIDER_REJECTED");
  try { return await response.json(); } catch { throw new AppError(503, "Resposta inconclusiva do estorno. Consulte o Asaas.", "REFUND_RESULT_UNKNOWN"); }
}

// A durable reservation is committed BEFORE the provider call. An ambiguous timeout
// leaves consumption blocked and cannot trigger a second financial POST.
export async function requestBillingRefund(paymentId: string, amountCents: number, lookup = fetchAsaasSettlement, send = refundProvider) {
  const [snapshot] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!snapshot?.externalId) throw new NotFoundError("Pagamento Asaas");
  const proof = parseAsaasSettlement(await lookup(snapshot.externalId));
  assertBillingSettlementBinding(snapshot, proof);
  const completed = completedRefundCents(proof);
  if (snapshot.status !== "paid" || !["PIX", "CREDIT_CARD"].includes(proof.billingType) || !["CONFIRMED", "RECEIVED"].includes(proof.status) || (proof.billingType === "PIX" && proof.status !== "RECEIVED")) throw new AppError(409, "Pagamento não disponível para estorno", "REFUND_NOT_AVAILABLE");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > snapshot.amountCents - completed) throw new AppError(400, "Valor de estorno inválido", "INVALID_REFUND_AMOUNT");
  const request = { id: randomUUID(), amountCents, baselineCents: completed, createdAt: new Date().toISOString() };
  await db.transaction(async trx => {
    const [payment] = await trx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!payment || payment.externalId !== snapshot.externalId || payment.status !== "paid") throw new AppError(409, "Pagamento alterado", "PAYMENT_CHANGED_DURING_VERIFICATION");
    assertBillingSettlementBinding(payment, proof);
    const meta = payment.metadata as Record<string, unknown>;
    if (meta.refundHold || proof.refunds?.some(r => !["DONE", "CANCELLED"].includes(r.status))) throw new AppError(409, "Estorno já solicitado. Consulte o painel Asaas.", "REFUND_ALREADY_REQUESTED");
    await trx.select({ id: workspacesTable.id }).from(workspacesTable).where(eq(workspacesTable.id, payment.workspaceId)).for("update");
    await trx.update(payments).set({ metadata: { ...meta, refundHold: true, refundNotice: "REQUESTING", refundRequest: request }, updatedAt: new Date() }).where(eq(payments.id, paymentId));
  });
  try {
    await send("/payments/" + encodeURIComponent(snapshot.externalId) + "/refund", "POST", { value: amountCents / 100, description: "NexOS estorno " + request.id });
    await db.transaction(async trx => {
      const [payment] = await trx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
      const meta = payment!.metadata as Record<string, unknown>;
      if (meta.refundNotice === "REQUESTING") await trx.update(payments).set({ metadata: { ...meta, refundNotice: "APPROVAL_OR_PROCESSING" }, updatedAt: new Date() }).where(eq(payments.id, paymentId));
    });
  } catch (error) {
    // Do not release on failure: the provider may have accepted an inconclusive call.
    throw error;
  }
  return { message: "Estorno solicitado. Administrador: aprove no painel Asaas quando exigido e acompanhe o processamento. Créditos mantidos no saldo, com consumo bloqueado até resolução.", approvalUrl: base().includes("sandbox") ? "https://sandbox.asaas.com" : "https://www.asaas.com" };
}

export async function refreshBillingRefund(paymentId: string, lookup = fetchAsaasSettlement, historyLookup = refundProvider) {
  const [snapshot] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!snapshot?.externalId) throw new NotFoundError("Pagamento Asaas");
  const proof = parseAsaasSettlement(await lookup(snapshot.externalId));
  assertBillingSettlementBinding(snapshot, proof);
  await reconcileBillingReversal(snapshot.externalId, async () => proof);
  const request = (snapshot.metadata as { refundRequest?: { id: string } }).refundRequest;
  if (request) {
    const result = await historyLookup("/payments/" + encodeURIComponent(snapshot.externalId) + "/refunds");
    const history = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data;
    const cancelled = history?.some((r: unknown) => { const row = r as { description?: string; status?: string }; return row.description === "NexOS estorno " + request.id && row.status === "CANCELLED"; });
    if (cancelled) await db.transaction(async trx => {
      const [payment] = await trx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
      const meta = payment!.metadata as { refundRequest?: { id: string }; [key: string]: unknown };
      if (meta.refundRequest?.id !== request.id) return;
      await trx.select({ id: workspacesTable.id }).from(workspacesTable).where(eq(workspacesTable.id, payment!.workspaceId)).for("update");
      const pending = proof.refunds?.find(r => !["DONE", "CANCELLED"].includes(r.status));
      await trx.update(payments).set({ metadata: { ...meta, refundHold: Boolean(pending), refundNotice: pending?.status ?? "CANCELLED" }, updatedAt: new Date() }).where(eq(payments.id, paymentId));
    });
  }
  return { message: "Estado consultado no Asaas. Estornos pendentes mantêm o consumo bloqueado; apenas devoluções concluídas descontam créditos." };
}
