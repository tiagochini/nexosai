import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { db, pool, academyLeadsTable, academyFunnelEmailsTable } from "@workspace/db";
import { enrollLeadInFunnel, sendWelcomeEmailNow, runFunnelSchedulerTick, getFunnelStats } from "../modules/academy/academy-funnel.service.js";
import { deliverFunnelMessage, type FunnelDeliveryResult } from "../modules/academy/academy-funnel-delivery.js";
import { inspectFunnelDelivery } from "../modules/academy/academy-funnel-inspection.js";

function startWorker(leadId: string, mode: "hold" | "complete") {
  const child = fork(fileURLToPath(new URL("./academy-funnel-test-worker.ts", import.meta.url)), [leadId, mode], {
    execArgv: ["--import", "tsx"], stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "silent", RESEND_API_KEY: "", GMAIL_USER: "", GMAIL_APP_PASSWORD: "" },
  });
  child.stdout?.resume();
  child.stderr?.resume();
  const exited = new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.once("close", () => resolve()); });
  const outcome = new Promise<"claimed" | "completed">((resolve, reject) => {
    let notified = false;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Test worker timed out")); }, 15_000);
    const finish = (type: "claimed" | "completed") => { notified = true; clearTimeout(timeout); resolve(type); };
    child.on("message", (message) => {
      const type = (message as { type?: string }).type;
      if (type === "claimed" || type === "completed") finish(type);
      else if (type === "error") { clearTimeout(timeout); reject(new Error("Test worker failed")); }
    });
    child.once("error", () => { clearTimeout(timeout); reject(new Error("Test worker launch failed")); });
    child.once("exit", () => { clearTimeout(timeout); if (!notified) reject(new Error("Test worker exited unexpectedly")); });
  });
  return { child, outcome, exited };
}

const leadId = randomUUID();
let attempts = 0;
let result: FunnelDeliveryResult = { status: "scheduled", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" };
// Injected delivery never reads real provider configuration or performs I/O.
const deliver: typeof deliverFunnelMessage = async () => { attempts++; return result; };
const readEmail = () => db.query.academyFunnelEmailsTable.findFirst({
  where: eq(academyFunnelEmailsTable.leadId, leadId), orderBy: academyFunnelEmailsTable.step,
});
const readLead = () => db.query.academyLeadsTable.findFirst({ where: eq(academyLeadsTable.id, leadId) });
try {
  await db.insert(academyLeadsTable).values({ id: leadId, email: `${leadId}@example.invalid` });
  await Promise.all(Array.from({ length: 8 }, () => enrollLeadInFunnel(leadId)));
  assert.equal((await db.select().from(academyFunnelEmailsTable).where(eq(academyFunnelEmailsTable.leadId, leadId))).length, 5,
    "concurrent enrollment must create exactly one five-email sequence");
  assert.equal((await readLead())!.funnelStep, -1);
  await sendWelcomeEmailNow(leadId, deliver);
  let row = (await readEmail())!;
  assert.equal(row.status, "scheduled");
  assert.equal(row.sentAt, null);
  assert.equal(row.resendId, null);
  assert.equal(row.errorMessage, "EMAIL_PROVIDER_NOT_CONFIGURED");
  assert.equal((await readLead())!.funnelStep, -1);

  result = { status: "failed", errorCode: "RESEND_HTTP_503" };
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal((await readEmail())!.status, "failed");
  assert.equal((await readLead())!.funnelStep, -1);

  result = { status: "sent", providerId: "offline-fixture-receipt" };
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal(attempts, 2, "failed sends require reconciliation, not blind welcome retries");
  await db.update(academyFunnelEmailsTable).set({ status: "scheduled" }).where(eq(academyFunnelEmailsTable.id, (await readEmail())!.id));
  await sendWelcomeEmailNow(leadId, deliver);
  row = (await readEmail())!;
  assert.equal(row.status, "sent");
  assert.ok(row.sentAt);
  assert.equal(row.errorMessage, null);
  assert.equal((await readLead())!.funnelStep, 0);
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal(attempts, 3, "already sent welcome must not be sent again");

  await db.update(academyFunnelEmailsTable).set({ status: "scheduled", sentAt: null }).where(eq(academyFunnelEmailsTable.id, row.id));
  await db.update(academyLeadsTable).set({ funnelStep: 3 }).where(eq(academyLeadsTable.id, leadId));
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal((await readLead())!.funnelStep, 3, "late welcome must not regress progress");

  await db.update(academyFunnelEmailsTable).set({ status: "skipped" }).where(eq(academyFunnelEmailsTable.id, row.id));
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal(attempts, 4, "skipped welcome must not be retried");
  await db.update(academyFunnelEmailsTable).set({ status: "scheduled" }).where(eq(academyFunnelEmailsTable.id, row.id));
  await db.update(academyLeadsTable).set({ unsubscribedAt: new Date() }).where(eq(academyLeadsTable.id, leadId));
  await sendWelcomeEmailNow(leadId, deliver);
  assert.equal(attempts, 4, "unsubscribe must prevent welcome delivery");

  // Scope every scheduler test to our own fixture; never touch other leads.
  await db.update(academyFunnelEmailsTable).set({ status: "skipped" }).where(eq(academyFunnelEmailsTable.id, row.id));
  await db.update(academyLeadsTable).set({ unsubscribedAt: null, funnelStep: 0 }).where(eq(academyLeadsTable.id, leadId));
  const dueDate = new Date(Date.now() - 60_000);
  const stepWhere = (step: number) => and(eq(academyFunnelEmailsTable.leadId, leadId), eq(academyFunnelEmailsTable.step, step));
  await db.update(academyFunnelEmailsTable).set({ scheduledAt: dueDate }).where(stepWhere(1));
  result = { status: "scheduled", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  await runFunnelSchedulerTick({ leadId, deliver });
  assert.equal((await readLead())!.funnelStep, 0);
  result = { status: "failed", errorCode: "GMAIL_TRANSPORT_ERROR" };
  await runFunnelSchedulerTick({ leadId, deliver });
  assert.equal((await readLead())!.funnelStep, 0);
  await db.update(academyFunnelEmailsTable).set({ status: "scheduled" }).where(stepWhere(1));
  result = { status: "sent", providerId: "offline-scheduler-receipt" };
  await runFunnelSchedulerTick({ leadId, deliver });
  assert.equal((await readLead())!.funnelStep, 1);
  await db.update(academyLeadsTable).set({ convertedAt: new Date() }).where(eq(academyLeadsTable.id, leadId));
  await db.update(academyFunnelEmailsTable).set({ scheduledAt: dueDate }).where(stepWhere(3));
  const beforeSkipped = attempts;
  await runFunnelSchedulerTick({ leadId, deliver });
  assert.equal(attempts, beforeSkipped, "sales email must be skipped after conversion");
  await db.update(academyLeadsTable).set({ unsubscribedAt: new Date() }).where(eq(academyLeadsTable.id, leadId));
  await db.update(academyFunnelEmailsTable).set({ scheduledAt: dueDate }).where(stepWhere(2));
  await runFunnelSchedulerTick({ leadId, deliver });
  assert.equal(attempts, beforeSkipped, "scheduler must honor unsubscribe");
  assert.equal((await readLead())!.funnelStep, 1);
  const enrolledAt = (await readLead())!.funnelEnrolledAt!.getTime();
  await enrollLeadInFunnel(leadId, new Date(Date.now() + 86_400_000));
  assert.equal((await readLead())!.funnelEnrolledAt!.getTime(), enrolledAt);
  assert.equal((await readLead())!.funnelStep, 1, "re-enrollment must preserve progress");
  assert.equal((await db.select().from(academyFunnelEmailsTable).where(eq(academyFunnelEmailsTable.leadId, leadId))).length, 5);

  await db.update(academyLeadsTable).set({ unsubscribedAt: null, convertedAt: null }).where(eq(academyLeadsTable.id, leadId));
  await db.update(academyFunnelEmailsTable).set({ status: "scheduled", sentAt: null }).where(eq(academyFunnelEmailsTable.id, row.id));
  let release!: () => void;
  let entered!: () => void;
  const inFlight = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let concurrentAttempts = 0;
  const slowDeliver: typeof deliverFunnelMessage = async () => {
    concurrentAttempts++;
    entered();
    await gate;
    return { status: "sent", providerId: "offline-concurrent-receipt" };
  };
  const first = sendWelcomeEmailNow(leadId, slowDeliver);
  try {
    await Promise.race([inFlight, first.then(() => { throw new Error("test delivery never entered"); })]);
    assert.equal((await readEmail())!.status, "sending");
    assert.ok((await getFunnelStats()).byStep[0]!.sending >= 1);
    await Promise.all(Array.from({ length: 8 }, () => sendWelcomeEmailNow(leadId, slowDeliver)));
    await Promise.all(Array.from({ length: 8 }, () => runFunnelSchedulerTick({ leadId, deliver: slowDeliver })));
    assert.equal(concurrentAttempts, 1, "welcome and scheduler must not dispatch a claimed email");
  } finally {
    release();
    await first;
  }
  assert.equal((await readEmail())!.status, "sent");
  assert.equal((await readLead())!.funnelStep, 1);

  // All contenders start together, exercising concurrent database claims.
  await db.update(academyFunnelEmailsTable).set({ status: "scheduled", sentAt: null }).where(eq(academyFunnelEmailsTable.id, row.id));
  concurrentAttempts = 0;
  const immediateDeliver: typeof deliverFunnelMessage = async () => {
    concurrentAttempts++;
    return { status: "sent", providerId: "offline-race-receipt" };
  };
  await Promise.all(Array.from({ length: 16 }, (_, index) => index % 2
    ? sendWelcomeEmailNow(leadId, immediateDeliver)
    : runFunnelSchedulerTick({ leadId, deliver: immediateDeliver })));
  assert.equal(concurrentAttempts, 1, "exactly one simultaneous claimant can dispatch");

  await db.update(academyFunnelEmailsTable).set({ status: "scheduled", sentAt: null, resendId: null }).where(eq(academyFunnelEmailsTable.id, row.id));
  let interruptedAttempts = 0;
  const interruptedDeliver: typeof deliverFunnelMessage = async () => {
    interruptedAttempts++;
    throw new Error("offline simulated process interruption");
  };
  await assert.rejects(sendWelcomeEmailNow(leadId, interruptedDeliver));
  assert.equal((await readEmail())!.status, "sending");
  assert.equal((await readEmail())!.errorMessage, "DELIVERY_IN_PROGRESS_OR_UNKNOWN");
  await sendWelcomeEmailNow(leadId, interruptedDeliver);
  await runFunnelSchedulerTick({ leadId, deliver: interruptedDeliver });
  assert.equal(interruptedAttempts, 1, "unknown outcomes must not be automatically retried");
  const interruptedReport = await inspectFunnelDelivery(leadId);
  assert.equal(interruptedReport.reviewCount, 1);
  assert.equal(interruptedReport.requiresReview, true);
  assert.equal(interruptedReport.reviewRows[0]!.id, row.id);
  assert.ok(!JSON.stringify(interruptedReport).includes("@example.invalid"));
  assert.equal((await readEmail())!.status, "sending", "inspection must not change delivery state");
  const legacyId = randomUUID();
  await db.insert(academyFunnelEmailsTable).values({
    id: legacyId, leadId, step: 4, scheduledAt: new Date(), status: "sent", resendId: "dev-no-provider",
  });
  await db.update(academyFunnelEmailsTable).set({ errorMessage: "EMAIL_PROVIDER_NOT_CONFIGURED" }).where(stepWhere(4));
  const legacyReport = await inspectFunnelDelivery(leadId);
  assert.equal(legacyReport.legacyFalseSuccessCount, 1);
  assert.equal(legacyReport.unconfiguredPendingCount, 1);
  assert.equal(legacyReport.duplicateGroups.length, 1);
  assert.equal(legacyReport.duplicateGroups[0]!.count, 2);
  await db.delete(academyFunnelEmailsTable).where(eq(academyFunnelEmailsTable.id, legacyId));

  await db.update(academyFunnelEmailsTable).set({ status: "scheduled" }).where(eq(academyFunnelEmailsTable.id, row.id));
  const workers = Array.from({ length: 3 }, () => startWorker(leadId, "hold"));
  try {
    const outcomes = await Promise.all(workers.map((worker) => worker.outcome));
    assert.equal(outcomes.filter((outcome) => outcome === "claimed").length, 1, "one separate process must win the claim");
    const winner = workers[outcomes.indexOf("claimed")]!;
    assert.equal((await readEmail())!.status, "sending");
    assert.equal(winner.child.kill("SIGKILL"), true, "terminate only the owned test worker");
    await winner.exited;
    const replacement = startWorker(leadId, "complete");
    try {
      assert.equal(await replacement.outcome, "completed", "replacement must complete without invoking delivery");
      await replacement.exited;
    } finally {
      if (replacement.child.exitCode === null && replacement.child.signalCode === null) replacement.child.kill();
      await replacement.exited;
    }
    assert.equal((await readEmail())!.status, "sending", "process death must not trigger blind redelivery");
  } finally {
    for (const worker of workers) {
      if (worker.child.exitCode === null && worker.child.signalCode === null) worker.child.kill();
    }
    await Promise.all(workers.map((worker) => worker.exited));
  }
  console.log("PASS Academy database: welcome and scheduler pending/failure/success, no regression, conversion and unsubscribe (no real mail)");
  console.log("PASS Academy concurrency: enrollment idempotency, atomic dispatch claims, in-flight visibility and interruption quarantine");
  console.log("PASS Academy recovery: separate-process contention, owned-worker termination, restart quarantine and read-only inspection");
} finally {
  await db.delete(academyLeadsTable).where(eq(academyLeadsTable.id, leadId));
  await pool.end();
}
