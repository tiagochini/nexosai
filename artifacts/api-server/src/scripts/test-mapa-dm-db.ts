import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool, socialConversationTurnsTable } from "@workspace/db";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";
import { processMetaWebhookDelivery } from "../modules/social/meta-webhook.processor.js";
import { getMetaE2eGraphCalls, resetMetaE2eGraphCalls } from "../lib/meta-graph.transport.js";
import { saveModerationConfig } from "../modules/social-moderation/social-moderation.service.js";

assert.equal(process.env.META_E2E_TEST_MODE, "true");
await assertIsolationTestDatabase(pool);
const marker = markerFromSuffix(`dmmapa-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const text = "Que bom! Você quer o mapa do sucesso. Recebi seu pedido no Direct.";
const payload = (mid: string, message: string, account = `${marker}_ig_one`, sender = `${marker}_reader`) => ({
  object: "instagram", entry: [{ id: account, messaging: [{
    sender: { id: sender }, recipient: { id: account }, timestamp: Date.now(), message: { mid, text: message },
  }] }],
});
async function waitForTurn(mid: string) {
  for (let n = 0; n < 100; n++) {
    const [turn] = await db.select().from(socialConversationTurnsTable).where(and(
      eq(socialConversationTurnsTable.workspaceId, manifest.workspaces[0]!),
      eq(socialConversationTurnsTable.providerEventId, mid),
    ));
    if (turn?.providerStatus) return turn;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error("DM pipeline did not complete");
}
try {
  await saveModerationConfig(manifest.workspaces[0]!, { immediateDmKeywordReplies: { mapa: text } });
  resetMetaE2eGraphCalls();
  for (const [index, message] of ["mapa", "MAPA", "Quero o mapa!"].entries()) {
    const mid = `${marker}_dm_${index}`;
    const event = payload(mid, message);
    await processMetaWebhookDelivery(event);
    const turn = await waitForTurn(mid);
    assert.equal(turn.decision, "keyword_reply");
    assert.equal(turn.providerStatus, "sent");
    assert.ok(turn.providerResponseId);
    assert.equal(turn.replyText, text);
    assert.equal(turn.integrationId, manifest.integrations[0]);
    const calls = getMetaE2eGraphCalls();
    assert.equal(calls.length, index + 1, "One response per real incoming message");
    assert.ok(calls.every(c => c.path.endsWith("/me/messages")));
    assert.equal((calls.at(-1)!.body as { recipient: { id: string }; message: { text: string } }).message.text, text);
    await processMetaWebhookDelivery(event);
    assert.equal(getMetaE2eGraphCalls().length, calls.length, "Replay must not send again");
  }
  const before = getMetaE2eGraphCalls().length;
  await processMetaWebhookDelivery(payload(`${marker}_foreign`, "mapa", `${marker}_unknown`));
  await processMetaWebhookDelivery(payload(`${marker}_echo`, "mapa", `${marker}_ig_one`, `${marker}_ig_one`));
  assert.equal(getMetaE2eGraphCalls().length, before, "Unknown accounts and own echoes must not respond");
  assert.equal((await db.select().from(socialConversationTurnsTable).where(eq(socialConversationTurnsTable.workspaceId, manifest.workspaces[1]!))).length, 0);
  process.env.META_E2E_FAIL_ONCE = "/me/messages";
  resetMetaE2eGraphCalls();
  const failed = `${marker}_failed`;
  await processMetaWebhookDelivery(payload(failed, "mapa"));
  const failedTurn = await waitForTurn(failed);
  assert.equal(failedTurn.providerStatus, "failed");
  assert.equal(failedTurn.providerResponseId, null);
  delete process.env.META_E2E_FAIL_ONCE;
  console.log("PASS MAPA Direct: real webhook processor, fixed scoped rule, case/phrase, receipt, failure, replay, unknown account and echo isolation; no real providers");
} finally {
  delete process.env.META_E2E_FAIL_ONCE;
  await cleanupE2eFixtures(manifest);
  await pool.end();
}
