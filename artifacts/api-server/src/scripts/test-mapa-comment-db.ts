import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool, socialCommentActionsTable, metaWebhookEventsTable, workspaceIntegrationsTable, instagramDmSequencesTable } from "@workspace/db";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";
import { processMetaWebhookDelivery } from "../modules/social/meta-webhook.processor.js";
import { getMetaE2eGraphCalls, resetMetaE2eGraphCalls } from "../lib/meta-graph.transport.js";
import { saveModerationConfig } from "../modules/social-moderation/social-moderation.service.js";
import { claimMetaWebhookEvent, recordMetaSendStarted, recordMetaSendResult, replayDueMetaWebhookEvents } from "../modules/social/meta-webhook-evidence.service.js";

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
  await saveModerationConfig(manifest.workspaces[0]!, {
    immediateKeywordReplyPostIds: [`${marker}_post`],
    immediateKeywordReplies: { mapa: "Que bom, {nome}, que você quer o mapa do sucesso! {confirmacao_direct}" },
  });
  resetMetaE2eGraphCalls();
  for (const [index, text] of ["MAPA", "mapa", "Quero o MAPA! 🗺️"].entries()) {
    const commentId = `${marker}_live_shape_${index}`;
    await processMetaWebhookDelivery(payload(commentId, text));
    const calls = getMetaE2eGraphCalls().filter(call => call.method === "POST" && (call.path.includes(`/${commentId}/`) || (call.body as { recipient?: { comment_id?: string } })?.recipient?.comment_id === commentId));
    assert.equal(calls.length, 2, `${text}: expected public and enabled private replies`);
    assert.ok(calls.some(call => call.path.endsWith("/replies")));
    assert.ok(calls.some(call => call.path.endsWith("/me/messages")));
    for (const call of calls) {
      const message = (call.body as { message: string | { text: string } }).message;
      assert.equal(typeof message === "string" ? message : message.text,
        "Que bom, test_reader, que você quer o mapa do sucesso!" +
        (call.path.endsWith("/replies") ? " Já encaminhei uma mensagem no seu Direct." : ""));
    }
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
  const ownReply = payload(`${marker}_own_reply`, "Que bom, que você quer o mapa do sucesso!");
  ownReply.entry[0]!.changes[0]!.value.from.id = `${marker}_ig_one`;
  ownReply.entry[0]!.changes[0]!.value.from.username = "publisher";
  await processMetaWebhookDelivery(ownReply);
  assert.equal(getMetaE2eGraphCalls().length, before, "Own public replies must not recursively trigger MAPA");
  assert.equal((await db.select().from(metaWebhookEventsTable).where(and(
    eq(metaWebhookEventsTable.workspaceId, manifest.workspaces[0]!),
    eq(metaWebhookEventsTable.providerEventId, `${marker}_own_reply`),
  ))).length, 0, "Own comments must not create outbound claims");
  const otherPost = payload(`${marker}_other_post`, "MAPA");
  otherPost.entry[0]!.changes[0]!.value.media.id = `${marker}_outside_scope`;
  await processMetaWebhookDelivery(otherPost);
  assert.equal(getMetaE2eGraphCalls().length, before, "another post must not use the test keyword response");
  assert.equal((await db.select().from(instagramDmSequencesTable).where(eq(
    instagramDmSequencesTable.workspaceId, manifest.workspaces[0]!,
  ))).length, 0, "A different post must not create a background DM sequence");
  await processMetaWebhookDelivery(payload(`${marker}_unroutable`, "MAPA", `${marker}_foreign_account`));
  assert.equal(getMetaE2eGraphCalls().length, before, "Unknown accounts must not borrow another workspace's response");
  assert.equal((await db.select().from(socialCommentActionsTable).where(eq(
    socialCommentActionsTable.workspaceId, manifest.workspaces[1],
  ))).length, 0, "The second user's workspace must remain untouched");
  process.env.META_E2E_FAIL_ONCE = "/me/messages";
  resetMetaE2eGraphCalls();
  const failedDm = payload(`${marker}_failed_dm`, "MAPA");
  failedDm.entry[0]!.changes[0]!.value.from.username = "$& visitante";
  await processMetaWebhookDelivery(failedDm);
  delete process.env.META_E2E_FAIL_ONCE;
  const failedPublic = getMetaE2eGraphCalls().find(call => call.path.endsWith("/replies"));
  assert.equal((failedPublic?.body as { message: string }).message,
    "Que bom, $& visitante, que você quer o mapa do sucesso!",
    "Failed private delivery must not claim a sent Direct; provider name remains literal");
  await saveModerationConfig(manifest.workspaces[0]!, { enableInstagramPrivateReplies: false });
  // Restore only the disposable credential fixture marked errored by fail-once.
  await db.update(workspaceIntegrationsTable).set({ status: "connected" }).where(and(
    eq(workspaceIntegrationsTable.workspaceId, manifest.workspaces[0]!),
    eq(workspaceIntegrationsTable.accountId, `${marker}_ig_one`),
  ));
  resetMetaE2eGraphCalls();
  const noDm = payload(`${marker}_disabled_dm`, "MAPA");
  noDm.entry[0]!.changes[0]!.value.from.username = "";
  await processMetaWebhookDelivery(noDm);
  assert.equal(getMetaE2eGraphCalls().length, 1);
  assert.equal((await db.select().from(instagramDmSequencesTable).where(eq(
    instagramDmSequencesTable.workspaceId, manifest.workspaces[0]!,
  ))).length, 0, "Disabled private replies must not create a background DM sequence");
  assert.equal((getMetaE2eGraphCalls()[0]?.body as { message: string }).message,
    "Que bom, amigo(a), que você quer o mapa do sucesso!",
    "Disabled private replies use a safe name fallback and no delivery confirmation");
  // A corrupt/legacy retry binding must never borrow the first tenant's token
  // just because its accountId resolves there.
  const foreignRetry = await claimMetaWebhookEvent({
    workspaceId: manifest.workspaces[1]!, integrationId: manifest.integrations[3]!,
    accountId: `${marker}_ig_one`, providerEventId: `${marker}_foreign_retry`,
    eventType: "instagram_comment", actionKey: "private_reply",
  });
  assert.ok(foreignRetry.claimed);
  assert.ok(foreignRetry.id);
  await recordMetaSendStarted(foreignRetry.id, "/me/messages", { recipient: { comment_id: `${marker}_foreign_retry` }, message: { text: "must not send" } });
  await recordMetaSendResult(foreignRetry.id, { error: "offline failed request" });
  await db.update(metaWebhookEventsTable).set({ nextRetryAt: new Date(Date.now() - 1000) }).where(eq(metaWebhookEventsTable.id, foreignRetry.id));
  await replayDueMetaWebhookEvents();
  assert.ok(!getMetaE2eGraphCalls().some(call => (call.body as { recipient?: { comment_id?: string } })?.recipient?.comment_id === `${marker}_foreign_retry`), "retry must require matching workspace, integration and account");
  const [rejectedRetry] = await db.select().from(metaWebhookEventsTable).where(eq(metaWebhookEventsTable.id, foreignRetry.id));
  assert.equal(rejectedRetry?.providerMessageId, null);
  assert.match(rejectedRetry?.error ?? "", /credential.*missing/i);
  console.log("PASS MAPA comment: actual webhook processor, uppercase/lowercase/phrase, public/private simulated delivery, media context, replay and unknown-account isolation; no real Meta calls");
} finally {
  await cleanupE2eFixtures(manifest);
  await pool.end();
}
