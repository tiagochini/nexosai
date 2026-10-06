import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, academyPurchasesTable as purchases, academyAccessEmailOutboxTable as jobs, academyDeliveryReconciliationsTable as reviews } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function reconcileAcademyDelivery(actorId: string, key: string, input: { jobId: string; decision: "accepted" | "not_accepted"; evidenceReference: string; providerId?: string }) {
  const requestKey = `review:${hash(key)}`, requestHash = hash(input);
  return db.transaction(async (trx) => {
    await trx.execute(sql`select pg_advisory_xact_lock(hashtext(${requestKey}))`);
    const [previous] = await trx.select().from(reviews).where(eq(reviews.requestKey, requestKey));
    if (previous) {
      if (previous.requestHash !== requestHash || previous.actorId !== actorId) throw new AppError(409, "Chave reutilizada", "IDEMPOTENCY_CONFLICT");
      return { jobId: previous.jobId, reused: true };
    }
    const [snapshot] = await trx.select().from(jobs).where(eq(jobs.id, input.jobId));
    if (!snapshot) throw new NotFoundError("Envio");
    // Match resend/reversal lock order: purchase before job.
    await trx.select({ id: purchases.id }).from(purchases).where(eq(purchases.id, snapshot.purchaseId)).for("update");
    const [job] = await trx.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.status, "sending"), sql`${jobs.claimedAt} <= now() - interval '15 minutes'`)).for("update");
    if (!job) throw new AppError(409, "Envio não está em quarentena elegível", "DELIVERY_NOT_RECONCILABLE");
    if (input.decision === "accepted" && !input.providerId) throw new AppError(400, "Comprovante requerido", "PROVIDER_RECEIPT_REQUIRED");
    await trx.update(jobs).set({ status: input.decision === "accepted" ? "sent" : "failed", providerId: input.providerId ?? null,
      errorCode: input.decision === "accepted" ? null : "OPERATOR_VERIFIED_NOT_ACCEPTED", sentAt: input.decision === "accepted" ? new Date() : null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    await trx.insert(reviews).values({ requestKey, actorId, jobId: job.id, decision: input.decision, evidenceHash: hash(input.evidenceReference), requestHash });
    // No dispatch here. A separate explicit resend is required after a proven rejection.
    return { jobId: job.id, reused: false };
  });
}
