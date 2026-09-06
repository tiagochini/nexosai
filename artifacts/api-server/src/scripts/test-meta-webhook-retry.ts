import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, metaWebhookEventsTable } from "@workspace/db";
import {
  claimMetaWebhookEvent,
  recordMetaSendResult,
  recordMetaSendStarted,
} from "../modules/social/meta-webhook-evidence.service.js";
import { closeSequenceScheduler, initSequenceScheduler } from "../modules/launch-sequence/sequence-scheduler.worker.js";
import { buildEnvironmentQueueName } from "../modules/queue/queue.service.js";
import {
  getMetaE2eGraphCalls,
  metaGraphFetch,
  resetMetaE2eGraphCalls,
} from "../lib/meta-graph.transport.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const marker = markerFromSuffix(`retry-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const accountId = `${marker}_ig_one`;
const endpoint = `/${accountId}/messages`;
let schedulerStarted = false;

try {
  const devQueue = buildEnvironmentQueueName("sequence-scheduler", { nodeEnv: "development" });
  const prodQueue = buildEnvironmentQueueName("sequence-scheduler", { nodeEnv: "production" });
  assert.notEqual(devQueue, prodQueue);
  assert.doesNotMatch(devQueue, /:/);
  assert.doesNotMatch(prodQueue, /:/);

  resetMetaE2eGraphCalls();
  process.env["META_E2E_FAIL_ONCE"] = endpoint;

  const claimed = await claimMetaWebhookEvent({
    workspaceId: manifest.workspaces[0],
    integrationId: manifest.integrations[0],
    accountId,
    providerEventId: `${marker}_retry`,
    eventType: "instagram_dm",
    actionKey: "retry_scheduler",
  });
  assert.equal(claimed.claimed, true);
  assert.ok(claimed.id);

  const request = { recipient: { id: `${marker}_recipient` }, message: { text: "retry scheduler E2E" } };
  await recordMetaSendStarted(claimed.id, endpoint, request);
  const first = await metaGraphFetch(`https://graph.facebook.com/v22.0${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, access_token: "E2E_TEST_TOKEN" }),
  });
  assert.equal(first.status, 500, "the original delivery must fail once");
  assert.equal(getMetaE2eGraphCalls().filter((call) => call.path.endsWith(endpoint)).length, 1,
    "the original failed delivery must use the shared E2E Graph ledger");
  await recordMetaSendResult(claimed.id, { error: `Meta API ${first.status}` });
  delete process.env["META_E2E_FAIL_ONCE"];

  // Make the initial retry due without waiting a minute. The accelerated
  // scheduler lifecycle must discover it; this test never invokes replay
  // directly.
  await db.update(metaWebhookEventsTable).set({ nextRetryAt: new Date(Date.now() - 1) })
    .where(eq(metaWebhookEventsTable.id, claimed.id));
  await initSequenceScheduler({
    disableRedis: true,
    schedulerEveryMs: 60_000,
    metaRetryWatchdogEveryMs: 10,
  });
  schedulerStarted = true;

  const deadline = Date.now() + 5_000;
  let event: typeof metaWebhookEventsTable.$inferSelect | undefined;
  do {
    [event] = await db.select().from(metaWebhookEventsTable).where(and(
      eq(metaWebhookEventsTable.id, claimed.id),
      eq(metaWebhookEventsTable.workspaceId, manifest.workspaces[0]),
    ));
    if (event?.status === "sent") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.ok(event);
  assert.equal(event.status, "sent");
  assert.equal(event.retryCount, 1);
  assert.equal(event.deadLetterAt, null);
  assert.equal(getMetaE2eGraphCalls().filter((call) => call.path.endsWith(endpoint)).length, 2,
    "one original failure and exactly one claimed replay are sent");

  // Several later scheduler ticks must not reclaim the sent row.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(getMetaE2eGraphCalls().filter((call) => call.path.endsWith(endpoint)).length, 2);
  console.log("meta webhook retry scheduler integration test passed");
} finally {
  delete process.env["META_E2E_FAIL_ONCE"];
  if (schedulerStarted) await closeSequenceScheduler();
  await cleanupE2eFixtures(manifest);
}