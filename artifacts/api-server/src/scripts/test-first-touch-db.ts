import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, pool, usersTable, plansTable, workspacesTable, campaignsTable,
  masterplanVersionsTable, launchSequencesTable, launchSequenceItemsTable,
  sequenceContactsTable, sequenceEngagementTable, firstTouchAttemptsTable,
  auditLogsTable, emailDispatchesTable, whatsappDispatchesTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { executeFirstTouch, firstTouchAttemptKey } from "../modules/launch-sequence/first-touch-executor.service.js";
import { createEmailDispatch } from "../modules/email-dispatch/email-dispatch.service.js";
import { createWhatsAppDispatch } from "../modules/whatsapp/whatsapp.service.js";

if (process.env.FIRST_TOUCH_DB_TESTS !== "true") throw new Error("FIRST_TOUCH_DB_TESTS=true is required");
const suffix = randomUUID();
const ids = { user: randomUUID(), plan: randomUUID(), workspace: randomUUID(), campaign: randomUUID(), master: randomUUID(), sequence: randomUUID(), item: randomUUID(), c1: randomUUID(), c2: randomUUID(), c3: randomUUID(), integration: randomUUID() };
const email1 = `ft-${suffix}-1@example.test`, email2 = `ft-${suffix}-2@example.test`;
let adapterCalls = 0;
let createdPlan = false;
let planId: string = ids.plan;
try {
  const [existingPlan] = await db.select({ id: plansTable.id }).from(plansTable).where(eq(plansTable.slug, "solo")).limit(1);
  if (existingPlan) planId = existingPlan.id;
  else { await db.insert(plansTable).values({ id: planId, name: "FT test", slug: "solo", priceMonthly: "0", creditsMonthly: 1, maxCampaigns: 1 }); createdPlan = true; }
  await db.insert(usersTable).values({ id: ids.user, email: `ft-${suffix}@example.test`, passwordHash: "test", name: "FT" });
  await db.insert(workspacesTable).values({ id: ids.workspace, ownerId: ids.user, planId, name: "FT", slug: `ft-${suffix}` });
  await db.insert(workspaceIntegrationsTable).values({ id: ids.integration, workspaceId: ids.workspace, provider: "whatsapp_business", status: "connected", accessToken: "test", accountId: "test-phone" });
  await db.insert(campaignsTable).values({ id: ids.campaign, workspaceId: ids.workspace, title: "FT", strategyData: { ready: true } });
  await db.insert(masterplanVersionsTable).values({ id: ids.master, workspaceId: ids.workspace, campaignId: ids.campaign, version: 1, status: "approved", snapshot: {}, contentHash: "h", contextFingerprint: "f", readinessScore: 100, readinessStatus: "ready" });
  await db.insert(launchSequencesTable).values({ id: ids.sequence, workspaceId: ids.workspace, campaignId: ids.campaign, name: "FT", status: "active", leadCaptureEnabled: true, config: { masterplanVersionId: ids.master, contextFingerprint: "f", emailProvider: "custom_smtp" } });
  await db.insert(launchSequenceItemsTable).values({ id: ids.item, sequenceId: ids.sequence, workspaceId: ids.workspace, phase: "plc1", name: "FT", dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: new Date(Date.now() - 1000), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h" } });
  await db.insert(sequenceContactsTable).values([
    { id: ids.c1, sequenceId: ids.sequence, workspaceId: ids.workspace, email: email1 },
    { id: ids.c2, sequenceId: ids.sequence, workspaceId: ids.workspace, email: email2 },
  ]);
  const fake = async () => { adapterCalls++; await new Promise((r) => setTimeout(r, 15)); return { confirmed: true, receipt: { providerId: randomUUID() } }; };

  const first = await Promise.all([executeFirstTouch(ids.workspace, fake), executeFirstTouch(ids.workspace, fake)]);
  assert.ok(first.filter((x) => x === "confirmed").length >= 1);
  assert.ok(adapterCalls >= 1 && adapterCalls <= 2);
  let attempts = await db.select().from(firstTouchAttemptsTable).where(eq(firstTouchAttemptsTable.workspaceId, ids.workspace));
  assert.equal(attempts.filter((x) => x.state === "confirmed").length, adapterCalls);
  assert.equal((await db.select().from(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace))).length, adapterCalls);
  const firstCounters = await db.select({ id: sequenceContactsTable.id, n: sequenceContactsTable.itemsReceived }).from(sequenceContactsTable).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
  assert.ok(firstCounters.filter((row) => row.n === 1).length >= 1);

  while (adapterCalls < 2) await executeFirstTouch(ids.workspace, fake);
  assert.equal(adapterCalls, 2);
  assert.equal((await db.select().from(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace))).length, 2);
  assert.equal((await db.select({ n: sequenceContactsTable.itemsReceived }).from(sequenceContactsTable).where(eq(sequenceContactsTable.workspaceId, ids.workspace))).filter((row) => row.n === 1).length, 2);
  await db.update(sequenceContactsTable).set({ segment: "converted" }).where(eq(sequenceContactsTable.id, ids.c2));
  const staleItem = randomUUID(), validItem = randomUUID(), staleContact = randomUUID(), validContact = randomUUID();
  await db.insert(sequenceContactsTable).values([
    { id: staleContact, sequenceId: ids.sequence, workspaceId: ids.workspace, email: `stale-${suffix}@example.test` },
    { id: validContact, sequenceId: ids.sequence, workspaceId: ids.workspace, email: `valid-${suffix}@example.test` },
  ]);
  await db.insert(launchSequenceItemsTable).values([
    { id: staleItem, sequenceId: ids.sequence, workspaceId: ids.workspace, phase: "plc1", name: "stale", dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: new Date("2020-01-01T00:00:00Z"), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "old", contentHash: "old" } },
    { id: validItem, sequenceId: ids.sequence, workspaceId: ids.workspace, phase: "plc1", name: "valid", dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: new Date(Date.now() - 2000), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h" } },
  ]);
  const staleKey = firstTouchAttemptKey({ sequenceId: ids.sequence, contactId: staleContact, itemId: staleItem, channel: "email", version: ids.master });
  await db.insert(firstTouchAttemptsTable).values({ workspaceId: ids.workspace, sequenceId: ids.sequence, contactId: staleContact, itemId: staleItem, channel: "email", version: "old", attemptKey: staleKey, state: "retryable", nextAttemptAt: new Date(Date.now() - 1000) });
  const beforeStale = adapterCalls;
  assert.equal(await executeFirstTouch(ids.workspace, fake, new Date()), "suppressed");
  const staleRow = await db.select({ state: firstTouchAttemptsTable.state }).from(firstTouchAttemptsTable).where(eq(firstTouchAttemptsTable.itemId, staleItem));
  assert.equal(staleRow.some((row) => row.state === "terminal"), true);
  assert.equal(adapterCalls, beforeStale);
  let validResult = await executeFirstTouch(ids.workspace, fake, new Date());
  while (validResult === "suppressed") validResult = await executeFirstTouch(ids.workspace, fake, new Date());
  assert.equal(validResult, "confirmed");
  assert.ok(adapterCalls >= beforeStale + 1);

  await db.insert(launchSequenceItemsTable).values({ id: randomUUID(), sequenceId: ids.sequence, workspaceId: ids.workspace, phase: "plc1", name: "amb", dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: new Date(Date.now() - 1000), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h" } });
  const beforeThrow = adapterCalls;
  const throwing = async () => { adapterCalls++; throw new Error("timeout"); };
  assert.equal(await executeFirstTouch(ids.workspace, throwing), "ambiguous");
  assert.equal(adapterCalls, beforeThrow + 1);

  assert.equal(await executeFirstTouch(randomUUID(), fake), "none");
  const key = `db-${suffix}`;
  const emailRows = await Promise.all([1, 2].map(() => createEmailDispatch(ids.workspace, { idempotencyKey: key, provider: "custom_smtp", listId: email1, subject: "x", fromName: "x", fromEmail: "x@example.test", htmlContent: "x" })));
  assert.equal(new Set(emailRows.map((x) => x.id)).size, 1);
  const waRows = await Promise.all([1, 2].map(() => createWhatsAppDispatch(ids.workspace, { idempotencyKey: `${key}-wa`, type: "individual", recipients: ["5511999999999"], message: "x" })));
  assert.equal(new Set(waRows.map((x) => x.id)).size, 1);
  console.log(`first-touch-db: adapterCalls=${adapterCalls}, attempts=${(await db.select().from(firstTouchAttemptsTable).where(eq(firstTouchAttemptsTable.workspaceId, ids.workspace))).length}, engagements=${(await db.select().from(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace))).length}`);
} finally {
  await db.delete(emailDispatchesTable).where(eq(emailDispatchesTable.workspaceId, ids.workspace));
  await db.delete(whatsappDispatchesTable).where(eq(whatsappDispatchesTable.workspaceId, ids.workspace));
  await db.delete(firstTouchAttemptsTable).where(eq(firstTouchAttemptsTable.workspaceId, ids.workspace));
  await db.delete(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace));
  await db.delete(sequenceContactsTable).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
  await db.delete(launchSequenceItemsTable).where(eq(launchSequenceItemsTable.workspaceId, ids.workspace));
  await db.delete(launchSequencesTable).where(eq(launchSequencesTable.workspaceId, ids.workspace));
  await db.delete(masterplanVersionsTable).where(eq(masterplanVersionsTable.workspaceId, ids.workspace));
  await db.delete(auditLogsTable).where(eq(auditLogsTable.workspaceId, ids.workspace));
  await db.delete(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.workspaceId, ids.workspace));
  await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, ids.workspace));
  await db.delete(workspacesTable).where(eq(workspacesTable.id, ids.workspace));
  await db.delete(usersTable).where(eq(usersTable.id, ids.user));
  if (createdPlan) await db.delete(plansTable).where(eq(plansTable.id, planId));
  await pool.end();
}