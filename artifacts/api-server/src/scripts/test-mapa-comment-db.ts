import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool, socialCommentActionsTable, metaWebhookEventsTable } from "@workspace/db";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";
import { processMetaWebhookDelivery } from "../modules/social/meta-webhook.processor.js";
import { getMetaE2eGraphCalls, resetMetaE2eGraphCalls } from "../lib/meta-graph.transport.js";

assert.equal(process.env.META_E2E_TEST_MODE, "true", "Only simulated Meta transport is allowed");
await assertIsolationTestDatabase(pool);
const marker = markerFromSuffix(`mapa-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const payload = (commentId: string, text: string, accountId = `${marker}_ig_one`) => ({
  object: "instagram",
  entry: [{ id: accountId, changes: [{ field: "comments", value: {
    id: commentId, text, media: { id: `${marker}_post` },
    from: { id: `${marker}_reader`, username: "test_reader" },
  } }] }],
});

try {
  resetMetaE2eGraphCalls();
  for (const [index, text] of ["MAPA", "mapa", "Quero o MAPA! 🗺️"].entries()) {
    const commentId = `${marker}_live_shape_${index}`;
    await processMetaWebhookDelivery(payload(commentId, text));
    const calls = getMetaE2eGraphCalls().filter(call => call.method === "POST" && call.path.includes(`/${commentId}/`));
    assert.equal(calls.length, 2, `${text}: expected public and enabled private replies`);
    assert.ok(calls.some(call => call.path.endsWith("/replies")));
    assert.ok(calls.some(call => call.path.endsWith("/private_replies")));
    for (const call of calls) assert.deepEqual((call.body as { message: string }).message, `${marker} reply`);
    const [action] = await db.select().from(socialCommentActionsTable).where(and(
      eq(socialCommentActionsTable.workspaceId, manifest.workspaces[0]),
      eq(socialCommentActionsTable.commentId, commentId),
    ));
    assert.equal(action?.action, "replied");
    assert.equal(action?.postId, `${marker}_post`, "Keep the comment's media context");
    assert.equal(action?.authorName, "test_reader");
    const evidence = await db.select().from(metaWebhookEventsTable).where(and(
      eq(metaWebhookEventsTable.workspaceId, manifest.workspaces[0]),
      eq(metaWebhookEventsTable.providerEventId, commentId),
    ));
    assert.equal(evidence.length, 2);
    assert.ok(evidence.every(event => event.status === "sent" && event.providerMessageId));
    await processMetaWebhookDelivery(payload(commentId, text));
    assert.equal(getMetaE2eGraphCalls().length, (index + 1) * 2, "Webhook replay must not send again");
  }
  const before = getMetaE2eGraphCalls().length;
  await processMetaWebhookDelivery(payload(`${marker}_unroutable`, "MAPA", `${marker}_foreign_account`));
  assert.equal(getMetaE2eGraphCalls().length, before, "Unknown accounts must not borrow another workspace's response");
  assert.equal((await db.select().from(socialCommentActionsTable).where(eq(
    socialCommentActionsTable.workspaceId, manifest.workspaces[1],
  ))).length, 0, "The second user's workspace must remain untouched");
  console.log("PASS MAPA comment: actual webhook processor, uppercase/lowercase/phrase, public/private simulated delivery, media context, replay and unknown-account isolation; no real Meta calls");
} finally {
  await cleanupE2eFixtures(manifest);
  await pool.end();
}
