import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, academyPurchasesTable as purchases, academyAccessEmailOutboxTable as jobs, academyGiftBatchesTable as batches } from "@workspace/db";
import { confirmAcademyManually, requestAcademyResend, createAcademyGiftBatch } from "../modules/academy/academy-delivery-intents.service.js";
import { dispatchAcademyAccessEmail } from "../modules/academy/academy-access-outbox.service.js";
import { reconcileAcademyReversal, confirmAcademyPayment } from "../modules/academy/academy-settlement.service.js";
import { generateAccessToken } from "../modules/academy/academy-access-code.js";
import express from "express";
import { once } from "node:events";
import academyRouter from "../modules/academy/academy.routes.js";
import { env } from "../lib/env.js";
const localFetch = globalThis.fetch;
assert.equal(process.env.NODE_ENV, "test");
globalThis.fetch = async () => { throw new Error("External calls forbidden"); };
const ids: string[] = [], batchIds: string[] = [];
async function fixture() {
  const id = randomUUID(); ids.push(id);
  const [row] = await db.insert(purchases).values({ id, accessToken: generateAccessToken(), customerEmail: `lifecycle-${id}@example.invalid`, productId: "mini-guide", amountCents: 9700, asaasPaymentId: `pay_${id}`, asaasCustomerId: `cus_${id}` }).returning();
  return row!;
}
async function read(id: string) { const [row] = await db.select().from(purchases).where(eq(purchases.id, id)); return row!; }
async function queue(id: string) { return db.select().from(jobs).where(eq(jobs.purchaseId, id)); }
const deliver = async () => ({ status: "sent" as const, providerId: "offline-lifecycle" });
function proof(p: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) {
  return { id: p.asaasPaymentId, customer: p.asaasCustomerId, externalReference: p.id, value: 97, billingType: "PIX", status: "RECEIVED", ...overrides };
}
try {
  const p = await fixture();
  await Promise.all(Array.from({ length: 12 }, () => confirmAcademyManually(p.id)));
  assert.equal((await queue(p.id)).length, 1);
  const before = (await read(p.id)).confirmedAt;
  const coalescedKey = randomUUID();
  await Promise.all(Array.from({ length: 12 }, () => requestAcademyResend(p.id, coalescedKey)));
  assert.equal((await queue(p.id)).length, 1);
  await dispatchAcademyAccessEmail(p.id, { deliver });
  await requestAcademyResend(p.id, coalescedKey);
  assert.equal((await queue(p.id)).length, 1, "Coalesced request replay must not create a second job after acceptance");
  const resendKey = randomUUID();
  await Promise.all(Array.from({ length: 12 }, () => requestAcademyResend(p.id, resendKey)));
  assert.equal((await queue(p.id)).length, 2);
  await dispatchAcademyAccessEmail(p.id, { deliver });
  await requestAcademyResend(p.id, resendKey);
  assert.equal((await queue(p.id)).length, 2);
  assert.deepEqual((await read(p.id)).confirmedAt, before);
  for (let i = 0; i < 10; i++) await requestAcademyResend(p.id, randomUUID(), { publicRequest: true });
  assert.equal((await queue(p.id)).length, 2, "Public cooldown cannot be bypassed by changing keys");
  const other = await fixture(); await confirmAcademyManually(other.id);
  await assert.rejects(requestAcademyResend(other.id, resendKey), /Chave reutilizada/);
  await db.update(jobs).set({ status: "sending" }).where(eq(jobs.purchaseId, other.id));
  await assert.rejects(requestAcademyResend(other.id, randomUUID()), /incerto/);
  console.log("PASS: manual confirmation and keyed/coalesced resends are durable, concurrent and replay-safe; public cooldown enforced");

  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, () => createAcademyGiftBatch(key, { count: 3, productId: "mini-guide" })));
  const gifts = results[0]!; batchIds.push(gifts[0]!.giftBatchId!);
  assert.ok(results.every((r) => r.map((g) => g.id).join() === gifts.map((g) => g.id).join()));
  for (const gift of gifts) { assert.equal((await queue(gift.id))[0]!.status, "skipped"); assert.equal(await dispatchAcademyAccessEmail(gift.id, { deliver }), false); }
  await assert.rejects(createAcademyGiftBatch(key, { count: 2, productId: "mini-guide" }), /Chave reutilizada/);
  const assignedKey = randomUUID();
  await requestAcademyResend(gifts[0]!.id, assignedKey, { recipientEmail: "owned-fixture@example.invalid" });
  assert.equal((await read(gifts[0]!.id)).customerEmail, "owned-fixture@example.invalid");
  await dispatchAcademyAccessEmail(gifts[0]!.id, { deliver });
  await requestAcademyResend(gifts[0]!.id, assignedKey, { recipientEmail: "owned-fixture@example.invalid" });
  assert.equal((await queue(gifts[0]!.id)).length, 2);
  await assert.rejects(requestAcademyResend(gifts[0]!.id, randomUUID(), { recipientEmail: "other-fixture@example.invalid" }), /outro destinatário/);
  const addressed = await createAcademyGiftBatch(randomUUID(), { count: 2, productId: "mini-guide", recipientEmail: "owned-fixture@example.invalid" });
  batchIds.push(addressed[0]!.giftBatchId!);
  for (const gift of addressed) assert.equal((await queue(gift.id))[0]!.status, "scheduled");
  console.log("PASS: gift batches are atomic/idempotent; unassigned gifts never mail placeholder; assigned gifts enter durable delivery");

  const revoked = await fixture(); await confirmAcademyManually(revoked.id);
  const refund = async () => proof(revoked, { status: "REFUNDED", refunds: [{ status: "DONE", value: 97 }] });
  await Promise.all(Array.from({ length: 12 }, () => reconcileAcademyReversal(revoked.asaasPaymentId!, refund)));
  assert.equal((await read(revoked.id)).status, "refunded");
  assert.ok((await read(revoked.id)).revokedAt);
  assert.equal((await queue(revoked.id))[0]!.status, "skipped");
  assert.equal(await dispatchAcademyAccessEmail(revoked.id, { deliver }), false);
  await assert.rejects(confirmAcademyManually(revoked.id), /revogada/);
  await assert.rejects(requestAcademyResend(revoked.id, randomUUID()), /ativo/);
  await assert.rejects(confirmAcademyPayment(revoked.asaasPaymentId!, async () => proof(revoked)), /não permite/);
  const held = await fixture(); await confirmAcademyManually(held.id);
  await reconcileAcademyReversal(held.asaasPaymentId!, async () => proof(held, { status: "CHARGEBACK_REQUESTED", billingType: "CREDIT_CARD" }));
  assert.equal((await read(held.id)).status, "suspended");
  await reconcileAcademyReversal(held.asaasPaymentId!, async () => proof(held, { status: "CONFIRMED", billingType: "CREDIT_CARD" }));
  assert.equal((await read(held.id)).status, "confirmed"); assert.equal((await read(held.id)).revokedAt, null);
  const unconfirmed = await fixture();
  await reconcileAcademyReversal(unconfirmed.asaasPaymentId!, async () => proof(unconfirmed, { status: "CHARGEBACK_REQUESTED", billingType: "CREDIT_CARD" }));
  await reconcileAcademyReversal(unconfirmed.asaasPaymentId!, async () => proof(unconfirmed, { status: "CONFIRMED", billingType: "CREDIT_CARD" }));
  assert.equal((await read(unconfirmed.id)).status, "pending"); assert.equal((await queue(unconfirmed.id)).length, 0);
  await confirmAcademyPayment(unconfirmed.asaasPaymentId!, async () => proof(unconfirmed, { status: "CONFIRMED", billingType: "CREDIT_CARD" }));
  assert.equal((await read(unconfirmed.id)).status, "confirmed"); assert.equal((await queue(unconfirmed.id)).length, 1);
  const partial = await fixture(); await confirmAcademyManually(partial.id);
  await reconcileAcademyReversal(partial.asaasPaymentId!, async () => proof(partial, { refunds: [{ status: "DONE", value: 10 }, { status: "PENDING", value: 20 }] }));
  assert.equal((await read(partial.id)).refundedAmountCents, 1000); assert.equal((await read(partial.id)).status, "confirmed");
  await assert.rejects(reconcileAcademyReversal(partial.asaasPaymentId!, async () => proof(partial)), /regrediu/);
  await assert.rejects(reconcileAcademyReversal(held.asaasPaymentId!, async () => { throw new Error("offline-outage"); }), /offline-outage/);
  assert.equal((await read(held.id)).status, "confirmed");
  console.log("PASS: verified refunds revoke access/cancel pending jobs; holds suspend/release canonically; partial/pending refunds and outages handled safely");
  const previousSecret = process.env.ACADEMY_ADMIN_SECRET;
  process.env.ACADEMY_ALLOW_LEGACY_ADMIN_SECRET = "true";
  const providerConfig = [env.RESEND_API_KEY, env.GMAIL_USER, env.GMAIL_APP_PASSWORD];
  Object.assign(env, { RESEND_API_KEY: "", GMAIL_USER: "", GMAIL_APP_PASSWORD: "" });
  process.env.ACADEMY_ADMIN_SECRET = randomUUID();
  const app = express(); app.use(express.json()); app.use("/api/academy", academyRouter);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/academy`;
  const headers = { "Content-Type": "application/json", "x-admin-secret": process.env.ACADEMY_ADMIN_SECRET! };
  try {
    const confirmed = await localFetch(`${base}/admin/confirm`, { method: "POST", headers, body: JSON.stringify({ purchaseId: p.id }) });
    assert.equal(confirmed.status, 200); assert.equal((await queue(p.id)).length, 2);
    const missingKey = await localFetch(`${base}/admin/resend`, { method: "POST", headers, body: JSON.stringify({ purchaseId: p.id }) });
    assert.equal(missingKey.status, 400);
    const replay = await localFetch(`${base}/admin/resend`, { method: "POST", headers: { ...headers, "Idempotency-Key": resendKey }, body: JSON.stringify({ purchaseId: p.id }) });
    assert.equal(replay.status, 202); assert.equal((await queue(p.id)).length, 2);
    const giftReplay = await localFetch(`${base}/admin/gift-codes`, { method: "POST", headers: { ...headers, "Idempotency-Key": key }, body: JSON.stringify({ count: 3, productId: "mini-guide" }) });
    assert.equal(giftReplay.status, 201); const giftBody = await giftReplay.json() as { purchases: { id: string }[] };
    assert.deepEqual(giftBody.purchases.map((g) => g.id), gifts.map((g) => g.id));
    const forbidden = await localFetch(`${base}/verify/${revoked.accessToken}`); assert.equal(forbidden.status, 403);
    const active = await localFetch(`${base}/verify/${partial.accessToken}`); assert.equal(active.status, 200);
    console.log("PASS: actual admin HTTP confirmation/resend/gift replay preserves history; missing key rejected; revoked token denied");
  } finally {
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    Object.assign(env, { RESEND_API_KEY: providerConfig[0], GMAIL_USER: providerConfig[1], GMAIL_APP_PASSWORD: providerConfig[2] });
    if (previousSecret === undefined) delete process.env.ACADEMY_ADMIN_SECRET; else process.env.ACADEMY_ADMIN_SECRET = previousSecret;
  }
} finally {
  try {
    if (ids.length) await db.delete(purchases).where(inArray(purchases.id, ids));
    if (batchIds.length) await db.delete(batches).where(inArray(batches.id, batchIds));
  } finally { await pool.end(); }
}
console.log("PASS: owned lifecycle fixtures removed; no real mail, charges or refunds");
