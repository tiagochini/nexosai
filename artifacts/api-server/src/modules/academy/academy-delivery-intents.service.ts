import { createHash } from "node:crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, academyPurchasesTable, academyLeadsTable, academyAccessEmailOutboxTable as jobs, academyAccessDeliveryRequestsTable as requests, academyGiftBatchesTable as batches } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { enqueueAcademyAccessEmail, dispatchAcademyAccessEmail } from "./academy-access-outbox.service.js";
import { generateAccessToken } from "./academy-access-code.js";
import { ACADEMY_PRODUCTS } from "./academy-products.js";
import { logger } from "../../lib/logger.js";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function wakeAcademyDelivery(purchaseId: string): void {
  setImmediate(() => void dispatchAcademyAccessEmail(purchaseId).catch((err) => logger.error({ err }, "academy: durable delivery wake-up failed")));
}
export async function confirmAcademyManually(purchaseId: string) {
  return db.transaction(async (trx) => {
    const [purchase] = await trx.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.id, purchaseId)).for("update");
    if (!purchase) throw new NotFoundError("Compra");
    if (purchase.revokedAt || purchase.financialHold || !["pending", "confirmed"].includes(purchase.status)) throw new AppError(409, "Compra revogada ou em estado incompatível", "ACADEMY_ACCESS_REVOKED");
    if (purchase.status === "confirmed") return purchase; // Explicit resend has its own intent/key.
    const now = new Date();
    const [confirmed] = await trx.update(academyPurchasesTable).set({ status: "confirmed", confirmedAt: now }).where(eq(academyPurchasesTable.id, purchaseId)).returning();
    await trx.update(academyLeadsTable).set({ convertedAt: now }).where(and(eq(academyLeadsTable.email, purchase.customerEmail.toLowerCase()), isNull(academyLeadsTable.convertedAt)));
    await enqueueAcademyAccessEmail(trx, purchaseId);
    return confirmed!;
  });
}

export async function requestAcademyResend(purchaseId: string, key: string, options: { publicRequest?: boolean; recipientEmail?: string; recipientName?: string } = {}) {
  const requestKey = `${options.publicRequest ? "public" : "admin"}:${digest(key)}`;
  const requestHash = digest({ purchaseId, recipientEmail: options.recipientEmail ?? null, recipientName: options.recipientName ?? null });
  return db.transaction(async (trx) => {
    await trx.execute(sql`select pg_advisory_xact_lock(hashtext(${requestKey}))`);
    const [previous] = await trx.select().from(requests).where(eq(requests.requestKey, requestKey));
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppError(409, "Chave reutilizada para outra solicitação", "IDEMPOTENCY_CONFLICT");
      return { jobId: previous.jobId, reused: true };
    }
    const [purchase] = await trx.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.id, purchaseId)).for("update");
    if (!purchase) throw new NotFoundError("Compra");
    if (purchase.status !== "confirmed" || purchase.revokedAt || purchase.financialHold) throw new AppError(409, "Acesso não está ativo", "ACADEMY_ACCESS_REVOKED");
    if (options.recipientEmail) {
      if (purchase.amountCents !== 0 || purchase.asaasPaymentId) throw new AppError(409, "Somente brindes podem receber destinatário", "GIFT_REQUIRED");
      if (purchase.customerEmail !== "brinde@agencianexos.vip" && purchase.customerEmail !== options.recipientEmail) throw new AppError(409, "Brinde já atribuído a outro destinatário", "GIFT_ALREADY_ASSIGNED");
      await trx.update(academyPurchasesTable).set({ customerEmail: options.recipientEmail, customerName: options.recipientName ?? purchase.customerName }).where(eq(academyPurchasesTable.id, purchaseId));
    } else if (purchase.customerEmail === "brinde@agencianexos.vip") {
      throw new AppError(409, "Defina o destinatário do brinde", "GIFT_RECIPIENT_REQUIRED");
    }
    const [active] = await trx.select().from(jobs).where(and(eq(jobs.purchaseId, purchaseId), or(eq(jobs.status, "scheduled"), eq(jobs.status, "sending"))));
    if (active?.status === "sending") throw new AppError(409, "Envio em andamento ou incerto requer conciliação", "DELIVERY_UNCERTAIN");
    let jobId = active?.id;
    if (!jobId && options.publicRequest) {
      const [recent] = await trx.select().from(jobs).where(and(eq(jobs.purchaseId, purchaseId), sql`${jobs.createdAt} > now() - interval '5 minutes'`)).orderBy(desc(jobs.createdAt)).limit(1);
      jobId = recent?.id;
    }
    if (!jobId) {
      const [created] = await trx.insert(jobs).values({ purchaseId, deliveryKey: requestKey, purpose: options.recipientEmail ? "gift_assignment" : "resend" }).returning();
      jobId = created!.id;
    }
    await trx.insert(requests).values({ requestKey, purchaseId, jobId, requestHash });
    return { jobId, reused: !!active };
  });
}

export async function createAcademyGiftBatch(key: string, input: { count: number; productId: string; recipientEmail?: string; recipientName?: string }) {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 50 || !ACADEMY_PRODUCTS[input.productId]) throw new AppError(400, "Brindes inválidos", "INVALID_GIFTS");
  const requestKey = `gifts:${digest(key)}`;
  const requestHash = digest({ count: input.count, productId: input.productId, recipientEmail: input.recipientEmail ?? null, recipientName: input.recipientName ?? null });
  return db.transaction(async (trx) => {
    await trx.execute(sql`select pg_advisory_xact_lock(hashtext(${requestKey}))`);
    let [batch] = await trx.select().from(batches).where(eq(batches.requestKey, requestKey));
    if (batch) {
      if (batch.requestHash !== requestHash) throw new AppError(409, "Chave reutilizada para outro lote", "IDEMPOTENCY_CONFLICT");
      return trx.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.giftBatchId, batch.id)).orderBy(academyPurchasesTable.id);
    }
    [batch] = await trx.insert(batches).values({ requestKey, requestHash }).returning();
    const purchases = await trx.insert(academyPurchasesTable).values(Array.from({ length: input.count }, () => ({
      giftBatchId: batch!.id, accessToken: generateAccessToken(), customerEmail: input.recipientEmail ?? "brinde@agencianexos.vip",
      customerName: input.recipientName ?? "Convidado", productId: input.productId, status: "confirmed", amountCents: 0, confirmedAt: new Date(),
    }))).returning();
    for (const purchase of purchases) await enqueueAcademyAccessEmail(trx, purchase.id, { purpose: "gift", ...(!input.recipientEmail ? { skipReason: "GIFT_RECIPIENT_NOT_ASSIGNED" } : {}) });
    return purchases.sort((a, b) => a.id.localeCompare(b.id));
  });
}
