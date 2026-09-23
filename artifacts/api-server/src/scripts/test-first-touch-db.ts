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
import { advanceJourneyStage } from "../modules/launch-sequence/journey-stage.service.js";
import { captureLead, LeadIdentityConflictError } from "../modules/launch-sequence/lead-capture.service.js";
import { phaseEligible, SEGMENTS, FIRST_TOUCH_PHASES } from "../modules/launch-sequence/first-touch-policy.js";

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
  await db.insert(launchSequenceItemsTable).values({ id: ids.item, sequenceId: ids.sequence, workspaceId: ids.workspace, phase: "plc1", name: "FT", dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: new Date(Date.now() - 1000), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h", copyPolicyVersion: "segment-phase-v1", generatedCopy: { cold: { subject: "s", body: "marker-cold" } } } });
  await db.insert(sequenceContactsTable).values([
    { id: ids.c1, sequenceId: ids.sequence, workspaceId: ids.workspace, email: email1 },
    { id: ids.c2, sequenceId: ids.sequence, workspaceId: ids.workspace, email: email2 },
  ]);
  const fake = async () => { adapterCalls++; await new Promise((r) => setTimeout(r, 15)); return { confirmed: true, receipt: { providerId: randomUUID() } }; };
  let matrixAssertions = 0;
  for (const segment of SEGMENTS) for (const stage of ["awareness", "consideration", "qualification", "objection_handling", "closing", "converted"]) for (const phase of FIRST_TOUCH_PHASES) { phaseEligible(segment, stage, phase); matrixAssertions++; }
  let journeyAssertions = 0;
  assert.equal(await advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c1, stage: "consideration", evidence: { source: "test", externalRef: "j1" } }), true); journeyAssertions++;
  assert.equal(await advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c1, stage: "closing", evidence: { source: "test", externalRef: "skip" } }), false); journeyAssertions++;
  assert.equal(await advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c1, stage: "awareness", evidence: { source: "test", externalRef: "regress" } }), false); journeyAssertions++;
  await assert.rejects(() => advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c1, stage: "qualification", evidence: {} })); journeyAssertions++;
  await assert.rejects(() => advanceJourneyStage({ workspaceId: randomUUID(), contactId: ids.c1, stage: "qualification", evidence: { source: "test", externalRef: "tenant" } })); journeyAssertions++;

  const first = await Promise.all([executeFirstTouch(ids.workspace, fake), executeFirstTouch(ids.workspace, fake)]);
  assert.ok(first.filter((x) => x === "confirmed").length >= 1);
  assert.ok(adapterCalls >= 1 && adapterCalls <= 2);
  let attempts = await db.select().from(firstTouchAttemptsTable).where(eq(firstTouchAttemptsTable.workspaceId, ids.workspace));
  assert.equal(attempts.filter((x) => x.state === "confirmed").length, adapterCalls);
  assert.ok((await db.select().from(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace))).length >= adapterCalls);
  const firstCounters = await db.select({ id: sequenceContactsTable.id, n: sequenceContactsTable.itemsReceived }).from(sequenceContactsTable).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
  assert.ok(firstCounters.filter((row) => row.n === 1).length >= 1);

  while (adapterCalls < 2) await executeFirstTouch(ids.workspace, fake);
  assert.equal(adapterCalls, 2);
  assert.ok((await db.select().from(sequenceEngagementTable).where(eq(sequenceEngagementTable.workspaceId, ids.workspace))).length >= 2);
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
  let dbRouteAllowed = 0, dbRouteDenied = 0, dbUnsafeCopy = 0, dbJourneyTransitions = journeyAssertions;
  const runRoute = async (segment: any, journeyStage: any, phase: string, channel: "email" | "whatsapp", unsafe?: string) => {
    await db.update(launchSequenceItemsTable).set({ status: "skipped" }).where(eq(launchSequenceItemsTable.workspaceId, ids.workspace));
    await db.update(sequenceContactsTable).set({ segment: "converted" }).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
    const contactId = randomUUID(), itemId = randomUUID(), marker = `route-${contactId}`;
    const recipient = channel === "email" ? `${contactId}@example.test` : `5511${contactId.replaceAll("-", "").slice(0, 10)}`;
    const copy = channel === "email" ? { subject: marker, body: marker } : { message: marker };
    const generatedCopy = unsafe === "default" ? { default: copy } : unsafe === "wrong" ? { [segment]: { subject: marker } } : unsafe === "legacy" ? { hot: copy } : { [segment]: copy };
    await db.insert(sequenceContactsTable).values({ id: contactId, sequenceId: ids.sequence, workspaceId: ids.workspace, email: channel === "email" ? recipient : null, phone: channel === "whatsapp" ? recipient : null, segment, journeyStage });
    await db.insert(launchSequenceItemsTable).values({ id: itemId, sequenceId: ids.sequence, workspaceId: ids.workspace, phase, name: marker, dayIndex: 0, deliveryChannels: [channel], status: "scheduled", scheduledAt: new Date(Date.now() - 1000), metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h", copyPolicyVersion: unsafe === "legacy" ? "legacy" : "segment-phase-v1", generatedCopy } } as any);
    let calls = 0;
    const checked = async (input: any) => { calls++; assert.equal(input.contactId, contactId); assert.equal(input.segment, segment); assert.equal(input.journeyStage, journeyStage); assert.equal(input.phase, phase); assert.equal(input.channel, channel); assert.equal(input.recipient, recipient); assert.equal(input.selectedCopy.subject ?? input.selectedCopy.message, marker); return { confirmed: true, receipt: { marker } }; };
    let result;
    try { result = await executeFirstTouch(ids.workspace, checked, new Date()); } catch (error) { console.error("route-check", segment, journeyStage, phase, channel, error); throw error; }
    if (unsafe) { assert.equal(result, "suppressed"); assert.equal(calls, 0); dbUnsafeCopy++; }
    else if (phaseEligible(segment, journeyStage, phase)) { assert.equal(result, "confirmed"); assert.equal(calls, 1); dbRouteAllowed++; }
    else { assert.equal(calls, 0); assert.notEqual(result, "confirmed"); dbRouteDenied++; }
  };
  for (const c of [["cold","awareness","plc1","email"],["warm","consideration","plc2","email"],["warm","qualification","plc3","whatsapp"],["hot","objection_handling","cart_open","email"],["hot","objection_handling","cart_middle","whatsapp"],["hot","closing","cart_close","email"],["hot","closing","cart_close","whatsapp"]] as const) await runRoute(c[0], c[1], c[2], c[3]);
  for (const c of [["cold","awareness","plc2","email"],["warm","consideration","plc3","email"],["warm","consideration","cart_open","email"],["warm","qualification","cart_middle","email"],["warm","closing","cart_close","email"],["hot","qualification","cart_close","email"],["hot","objection_handling","cart_close","email"],["converted","awareness","plc1","email"],["unsubscribed","awareness","plc1","email"],["hot","closing","post_purchase","email"]] as const) await runRoute(c[0], c[1], c[2], c[3]);
  await runRoute("warm", "consideration", "plc2", "email", "default");
  await runRoute("warm", "consideration", "plc2", "email", "legacy");
  await runRoute("warm", "consideration", "plc2", "email", "wrong");
  await advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c2, stage: "consideration", evidence: { source: "test", externalRef: "j2" } }); dbJourneyTransitions++;
  const winners = await Promise.all([advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c2, stage: "qualification", evidence: { source: "test", externalRef: "j3a" } }), advanceJourneyStage({ workspaceId: ids.workspace, contactId: ids.c2, stage: "qualification", evidence: { source: "test", externalRef: "j3b" } })]);
  assert.equal(winners.filter(Boolean).length, 1); dbJourneyTransitions++;
  let dbNoStarvation = 0, dbJourneyUnlock = 0;
  await db.update(launchSequenceItemsTable).set({ status: "skipped" }).where(eq(launchSequenceItemsTable.workspaceId, ids.workspace));
  await db.update(sequenceContactsTable).set({ segment: "converted" }).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
  const insertRoutable = async (segment: any, stage: any, phase: string, marker: string, when: Date) => {
    const contactId = randomUUID(), itemId = randomUUID(), email = `${contactId}@example.test`;
    await db.insert(sequenceContactsTable).values({ id: contactId, sequenceId: ids.sequence, workspaceId: ids.workspace, email, segment, journeyStage: stage });
    await db.insert(launchSequenceItemsTable).values({ id: itemId, sequenceId: ids.sequence, workspaceId: ids.workspace, phase, name: marker, dayIndex: 0, deliveryChannels: ["email"], status: "scheduled", scheduledAt: when, metadata: { firstTouchExecutable: true, masterplanVersionId: ids.master, contextFingerprint: "f", contentHash: "h", copyPolicyVersion: "segment-phase-v1", generatedCopy: { [segment]: { subject: marker, body: marker } } } } as any);
    return { contactId, itemId, email, marker };
  };
  const denied = await insertRoutable("warm", "consideration", "cart_open", "older-denied", new Date(Date.now() - 3000));
  const allowed = await insertRoutable("warm", "consideration", "plc2", "newer-allowed", new Date(Date.now() - 2000));
  await db.update(sequenceContactsTable).set({ email: null }).where(eq(sequenceContactsTable.id, denied.contactId));
  const noStarveAdapter = async (input: any) => {
    assert.equal(input.contactId, allowed.contactId); assert.equal(input.selectedCopy.subject, allowed.marker);
    return { confirmed: true, receipt: { marker: allowed.marker } };
  };
  assert.equal(await executeFirstTouch(ids.workspace, noStarveAdapter), "confirmed");
  const deniedAttempts = await db.select().from(firstTouchAttemptsTable).where(and(eq(firstTouchAttemptsTable.contactId, denied.contactId), eq(firstTouchAttemptsTable.itemId, denied.itemId)));
  assert.equal(deniedAttempts.filter((x) => x.state === "confirmed").length, 0);
  dbNoStarvation += 3;
  await db.update(sequenceContactsTable).set({ segment: "converted" }).where(eq(sequenceContactsTable.id, allowed.contactId));
  await db.update(launchSequenceItemsTable).set({ status: "skipped" }).where(eq(launchSequenceItemsTable.id, allowed.itemId));
  const journey = await insertRoutable("warm", "awareness", "plc1", "journey-awareness", new Date(Date.now() - 1000));
  const plc2 = await insertRoutable("warm", "awareness", "plc2", "journey-plc2", new Date(Date.now() - 1000));
  const plc3 = await insertRoutable("warm", "awareness", "plc3", "journey-plc3", new Date(Date.now() - 1000));
  await db.update(launchSequenceItemsTable).set({ status: "skipped" }).where(eq(launchSequenceItemsTable.id, journey.itemId));
  assert.equal(await executeFirstTouch(ids.workspace, async () => { throw new Error("locked stage dispatched"); }), "none"); dbJourneyUnlock++;
  assert.equal(await advanceJourneyStage({ workspaceId: ids.workspace, contactId: journey.contactId, stage: "consideration", evidence: { source: "test", externalRef: "unlock-consideration" } }), true); dbJourneyUnlock++;
  assert.equal((await db.select({ stage: sequenceContactsTable.journeyStage }).from(sequenceContactsTable).where(eq(sequenceContactsTable.id, journey.contactId)))[0]?.stage, "consideration"); dbJourneyUnlock++;
  await db.update(launchSequenceItemsTable).set({ phase: "plc2", status: "scheduled", scheduledAt: new Date(Date.now() - 1000) }).where(eq(launchSequenceItemsTable.id, plc2.itemId));
  const plc2Adapter = async (input: any) => { assert.equal(input.contactId, journey.contactId); assert.equal(input.selectedCopy.subject, plc2.marker); return { confirmed: true, receipt: { marker: plc2.marker } }; };
  assert.equal(await executeFirstTouch(ids.workspace, plc2Adapter), "confirmed"); dbJourneyUnlock++;
  await db.update(launchSequenceItemsTable).set({ phase: "plc3", status: "scheduled", scheduledAt: new Date(Date.now() - 1000) }).where(eq(launchSequenceItemsTable.id, plc3.itemId));
  assert.equal(await executeFirstTouch(ids.workspace, async () => { throw new Error("plc3 skipped stage dispatched"); }), "none"); dbJourneyUnlock++;
  const transitionWinners = await Promise.all([advanceJourneyStage({ workspaceId: ids.workspace, contactId: journey.contactId, stage: "qualification", evidence: { source: "test", externalRef: "qual-a" } }), advanceJourneyStage({ workspaceId: ids.workspace, contactId: journey.contactId, stage: "qualification", evidence: { source: "test", externalRef: "qual-b" } })]);
  assert.equal(transitionWinners.filter(Boolean).length, 1); dbJourneyUnlock++;
  assert.equal((await db.select({ stage: sequenceContactsTable.journeyStage }).from(sequenceContactsTable).where(eq(sequenceContactsTable.id, journey.contactId)))[0]?.stage, "qualification"); dbJourneyUnlock++;
  const plc3Adapter = async (input: any) => { assert.equal(input.contactId, journey.contactId); assert.equal(input.selectedCopy.subject, plc3.marker); return { confirmed: true, receipt: { marker: plc3.marker } }; };
  assert.equal(await executeFirstTouch(ids.workspace, plc3Adapter), "confirmed"); dbJourneyUnlock++;
  let dbConcurrentCapture = 0;
  const captures = await Promise.all(Array.from({ length: 8 }, (_, i) => captureLead({
    workspaceId: ids.workspace, sequenceId: ids.sequence, email: `  CONCURRENT-${suffix}@Example.Test `, phone: i % 2 ? "+55 (11) 99999-0000" : "5511999990000", name: "Concurrent",
    audit: { actor: "test", data: { source: "concurrent", externalRef: "capture" } },
  })));
  assert.equal(new Set(captures.map((x) => x.contactId)).size, 1); assert.equal(captures.filter((x) => !x.duplicate).length, 1);
  const auditCount = await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.workspaceId, ids.workspace), eq(auditLogsTable.action, "lead.captured")));
  assert.equal(auditCount.filter((x) => (x.data as any)?.externalRef === "capture").length, 1); dbConcurrentCapture += 3;
  const secondSequence = randomUUID();
  const secondCampaign = randomUUID();
  await db.insert(campaignsTable).values({ id: secondCampaign, workspaceId: ids.workspace, title: "second", strategyData: {} });
  await db.insert(launchSequencesTable).values({ id: secondSequence, workspaceId: ids.workspace, campaignId: secondCampaign, name: "second", status: "active", leadCaptureEnabled: true, config: {} });
  const second = await captureLead({ workspaceId: ids.workspace, sequenceId: secondSequence, email: `concurrent-${suffix}@example.test`, phone: "5511999990000", audit: { actor: "test", data: { source: "second", externalRef: "capture-second" } } });
  assert.notEqual(second.contactId, captures[0]!.contactId); dbConcurrentCapture++;
  const splitEmail = randomUUID(), splitPhone = randomUUID();
  await db.insert(sequenceContactsTable).values([
    { id: splitEmail, sequenceId: ids.sequence, workspaceId: ids.workspace, email: "split@example.test" },
    { id: splitPhone, sequenceId: ids.sequence, workspaceId: ids.workspace, phone: "5511888888888" },
  ]);
  await assert.rejects(() => captureLead({ workspaceId: ids.workspace, sequenceId: ids.sequence, email: "split@example.test", phone: "55 11 88888-8888", audit: { actor: "test", data: { source: "split", externalRef: "split" } } }), (error: unknown) => error instanceof LeadIdentityConflictError);
  dbConcurrentCapture += 2;
  console.log(`first-touch-db: dbRouteAllowed=${dbRouteAllowed}, dbRouteDenied=${dbRouteDenied}, dbUnsafeCopy=${dbUnsafeCopy}, dbJourneyTransitions=${dbJourneyTransitions}, dbNoStarvation=${dbNoStarvation}, dbJourneyUnlock=${dbJourneyUnlock}, dbConcurrentCapture=${dbConcurrentCapture}`);
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