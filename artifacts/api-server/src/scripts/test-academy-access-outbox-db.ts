import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { db, pool, academyPurchasesTable, academyAccessEmailOutboxTable } from "@workspace/db";
import { enqueueAcademyAccessEmail, dispatchAcademyAccessEmail, runAcademyAccessOutboxTick } from "../modules/academy/academy-access-outbox.service.js";
import { confirmAcademyPayment } from "../modules/academy/academy-settlement.service.js";
import { generateAccessToken } from "../modules/academy/academy-access-code.js";
assert.equal(process.env.NODE_ENV, "test");
globalThis.fetch = async () => { throw new Error("External calls forbidden"); };
const ids: string[] = [];
async function fixture(confirm = true) {
  const id = randomUUID(); ids.push(id);
  await db.insert(academyPurchasesTable).values({ id, accessToken: generateAccessToken(), customerEmail: `outbox-${id}@example.invalid`, productId: "mini-guide", amountCents: 9700, asaasPaymentId: `pay_${id}`, asaasCustomerId: `cus_${id}` });
  if (confirm) await confirmAcademyPayment(`pay_${id}`, async () => ({ id: `pay_${id}`, customer: `cus_${id}`, externalReference: id, value: 97, status: "RECEIVED", billingType: "PIX" }));
  return id;
}
async function job(id: string) {
  const [row] = await db.select().from(academyAccessEmailOutboxTable).where(eq(academyAccessEmailOutboxTable.purchaseId, id)); return row;
}
function worker(id: string, mode: "hold" | "complete") {
  const child = fork(fileURLToPath(new URL("./academy-access-outbox-test-worker.ts", import.meta.url)), [id, mode], {
    execArgv: ["--import", "tsx"], stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, LOG_LEVEL: "silent", RESEND_API_KEY: "", GMAIL_USER: "", GMAIL_APP_PASSWORD: "" },
  });
  child.stdout?.resume(); child.stderr?.resume();
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const outcome = new Promise<"claimed" | "completed">((resolve, reject) => {
    let notified = false;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Owned worker timed out")); }, 15_000);
    child.on("message", (message) => {
      const type = (message as { type?: string }).type;
      if (type === "claimed" || type === "completed") { notified = true; clearTimeout(timeout); resolve(type); }
      else if (type === "error") { clearTimeout(timeout); reject(new Error("Owned worker failed")); }
    });
    child.once("error", () => { clearTimeout(timeout); reject(new Error("Owned worker failed to start")); });
    child.once("exit", () => { clearTimeout(timeout); if (!notified) reject(new Error("Owned worker exited unexpectedly")); });
  });
  return { child, exited, outcome };
}
try {
  const id = await fixture();
  assert.equal((await job(id))?.status, "scheduled", "Confirmation without wake-up must persist a recoverable job");
  await Promise.all(Array.from({ length: 12 }, () => db.transaction((trx) => enqueueAcademyAccessEmail(trx, id))));
  assert.equal((await db.select().from(academyAccessEmailOutboxTable).where(eq(academyAccessEmailOutboxTable.purchaseId, id))).length, 1);
  let sends = 0;
  const deliver = async () => { sends++; return { status: "sent" as const, providerId: "offline-receipt" }; };
  await Promise.all(Array.from({ length: 16 }, () => runAcademyAccessOutboxTick({ purchaseId: id, deliver })));
  assert.equal(sends, 1); assert.equal((await job(id))?.status, "sent");
  assert.equal((await job(id))?.attempts, 1); assert.equal((await job(id))?.providerId, "offline-receipt");
  await runAcademyAccessOutboxTick({ purchaseId: id, deliver }); assert.equal(sends, 1);
  console.log("PASS: committed confirmation persists one job; parallel recovery dispatches once and records acceptance");

  const missing = await fixture();
  await dispatchAcademyAccessEmail(missing, { deliver: async () => ({ status: "scheduled", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" }) });
  assert.equal((await job(missing))?.status, "scheduled");
  assert.ok((await job(missing))!.nextAttemptAt.getTime() > Date.now());
  await runAcademyAccessOutboxTick({ purchaseId: missing, deliver }); assert.equal(sends, 1);
  await db.update(academyAccessEmailOutboxTable).set({ nextAttemptAt: new Date(0) }).where(eq(academyAccessEmailOutboxTable.purchaseId, missing));
  await runAcademyAccessOutboxTick({ purchaseId: missing, deliver }); assert.equal(sends, 2);
  assert.equal((await job(missing))?.status, "sent");
  const failed = await fixture();
  await dispatchAcademyAccessEmail(failed, { deliver: async () => ({ status: "failed", errorCode: "RESEND_HTTP_400" }) });
  await runAcademyAccessOutboxTick({ purchaseId: failed, deliver }); assert.equal(sends, 2);
  assert.equal((await job(failed))?.status, "failed");
  const ambiguous = await fixture();
  await dispatchAcademyAccessEmail(ambiguous, { deliver: async () => { throw new Error("private-token-recipient-provider-details"); } });
  assert.equal((await job(ambiguous))?.status, "sending");
  assert.equal((await job(ambiguous))?.errorCode, "EMAIL_DELIVERY_UNKNOWN");
  await runAcademyAccessOutboxTick({ purchaseId: ambiguous, deliver }); assert.equal(sends, 2);
  assert.ok(!JSON.stringify(await job(ambiguous)).includes("private-token"));
  console.log("PASS: missing configuration safely defers; rejection/unknown outcomes are not blindly retried or persisted as private errors");

  const rollback = await fixture(false);
  await assert.rejects(db.transaction(async (trx) => {
    await trx.update(academyPurchasesTable).set({ status: "confirmed" }).where(eq(academyPurchasesTable.id, rollback));
    await enqueueAcademyAccessEmail(trx, rollback);
    throw new Error("fixture-rollback");
  }), /fixture-rollback/);
  assert.equal(await job(rollback), undefined);
  const [unconfirmed] = await db.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.id, rollback));
  assert.equal(unconfirmed!.status, "pending");
  await db.transaction((trx) => enqueueAcademyAccessEmail(trx, rollback));
  await dispatchAcademyAccessEmail(rollback, { deliver });
  assert.equal((await job(rollback))?.status, "skipped"); assert.equal(sends, 2);
  console.log("PASS: purchase/outbox rollback together and unconfirmed purchases cannot send access");

  const queuedBeforeRestart = await fixture();
  const resumed = worker(queuedBeforeRestart, "complete");
  try {
    assert.equal(await resumed.outcome, "claimed"); await resumed.exited;
    assert.equal((await job(queuedBeforeRestart))?.status, "sent");
    assert.equal((await job(queuedBeforeRestart))?.providerId, "offline-child-receipt");
  } finally {
    if (resumed.child.exitCode === null && resumed.child.signalCode === null) resumed.child.kill();
    await resumed.exited;
  }
  console.log("PASS: a fresh process recovers a committed, not-yet-started delivery");

  const interrupted = await fixture();
  const children = Array.from({ length: 3 }, () => worker(interrupted, "hold"));
  try {
    const outcomes = await Promise.all(children.map((child) => child.outcome));
    assert.equal(outcomes.filter((result) => result === "claimed").length, 1);
    const winner = children[outcomes.indexOf("claimed")]!;
    assert.equal((await job(interrupted))?.status, "sending");
    assert.equal(winner.child.kill("SIGKILL"), true); await winner.exited;
    const replacement = worker(interrupted, "complete");
    try { assert.equal(await replacement.outcome, "completed"); await replacement.exited; }
    finally { if (replacement.child.exitCode === null && replacement.child.signalCode === null) replacement.child.kill(); await replacement.exited; }
    assert.equal((await job(interrupted))?.status, "sending");
    assert.equal((await job(interrupted))?.attempts, 1);
  } finally {
    for (const child of children) if (child.child.exitCode === null && child.child.signalCode === null) child.child.kill();
    await Promise.all(children.map((child) => child.exited));
  }
  console.log("PASS: separate processes contend; owned winner termination leaves quarantine; replacement cannot redeliver");
} finally {
  try { if (ids.length) await db.delete(academyPurchasesTable).where(inArray(academyPurchasesTable.id, ids)); }
  finally { await pool.end(); }
}
console.log("PASS: purchase fixtures and cascading outbox jobs removed; no real mail");
