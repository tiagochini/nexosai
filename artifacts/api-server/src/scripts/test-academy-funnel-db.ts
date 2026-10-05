import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool, academyLeadsTable, academyFunnelEmailsTable } from "@workspace/db";
import { enrollLeadInFunnel, sendWelcomeEmailNow, runFunnelSchedulerTick } from "../modules/academy/academy-funnel.service.js";
import { deliverFunnelMessage, type FunnelDeliveryResult } from "../modules/academy/academy-funnel-delivery.js";

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
  await enrollLeadInFunnel(leadId);
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
  console.log("PASS Academy database: welcome and scheduler pending/failure/success, no regression, conversion and unsubscribe (no real mail)");
} finally {
  await db.delete(academyLeadsTable).where(eq(academyLeadsTable.id, leadId));
  await pool.end();
}
