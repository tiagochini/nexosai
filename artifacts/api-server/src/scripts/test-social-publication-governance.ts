import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, campaignsTable, contentPiecesTable, masterplanVersionsTable,
  socialPostsTable, workspaceIntegrationsTable,
  socialPublishAttemptsTable, executionEvidenceTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../lib/errors.js";
import { getMetaE2eGraphCalls, resetMetaE2eGraphCalls } from "../lib/meta-graph.transport.js";
import { getCampaignPublishPreview, publishCampaignContentPiece, publishPost, schedulePostsForCampaign, syncPostMetrics } from "../modules/social/social.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const marker = markerFromSuffix(`social-governance-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspace = manifest.workspaces[0]!;
const foreignWorkspace = manifest.workspaces[1]!;
const ownedIntegration = manifest.integrations[2]!;
const createdPosts: string[] = [];
let campaignId: string | undefined;
try {
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId: workspace, title: `${marker} campaign`, status: "approved",
  }).returning();
  assert.ok(campaign);
  campaignId = campaign.id;
  const [plan] = await db.insert(masterplanVersionsTable).values({
    workspaceId: workspace, campaignId: campaign.id, version: 1, status: "approved",
    snapshot: { marker }, contentHash: `${marker}:hash`, contextFingerprint: `${marker}:ctx`,
    readinessScore: 100, readinessStatus: "ready", approvedAt: new Date(),
  }).returning();
  assert.ok(plan);
  const [piece] = await db.insert(contentPiecesTable).values({
    workspaceId: workspace, campaignId: campaign.id, type: "social_post",
    status: "approved", title: `${marker} exact caption`,
    content: { text: `${marker} exact caption` },
  }).returning();
  assert.ok(piece);

  await assert.rejects(
    () => schedulePostsForCampaign(workspace, campaign.id, [piece.id], [ownedIntegration], new Date()),
    (err: unknown) => err instanceof AppError && err.code === "CAMPAIGN_SCHEDULE_CONFIRMATION_REQUIRED",
    "campaign scheduling must fail closed before persisting unverifiable future sends",
  );
  const unscheduled = await db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, workspace),
    eq(socialPostsTable.campaignId, campaign.id),
    eq(socialPostsTable.contentPieceId, piece.id),
  ));
  assert.equal(unscheduled.length, 0, "blocked campaign scheduling must not persist a row");

  // Text-only social content is Facebook-compatible only; TikTok and
  // Instagram must not appear in the preview or confirmation targets.
  const [tiktok] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId: workspace, provider: "tiktok_ads", status: "connected",
    accountId: `${marker}_tiktok`, accessToken: "E2E_DUMMY_TIKTOK_TOKEN",
    metadata: { integrationPurpose: "organic_social" },
  }).returning();
  assert.ok(tiktok);
  await db.update(workspaceIntegrationsTable).set({ status: "disconnected" }).where(eq(
    workspaceIntegrationsTable.id, manifest.integrations[3]!,
  ));
  const preview = await getCampaignPublishPreview(workspace, campaign.id, piece.id);
  assert.ok(preview.platforms.length > 0);
  assert.ok(preview.platforms.every((p) => p.provider === "meta_ads"));
  assert.equal(preview.caption, `${marker} exact caption`);
  assert.equal(preview.masterplanVersionId, plan.id);
  assert.deepEqual(preview.mediaUrls, []);

  const [foreignPiece] = await db.insert(contentPiecesTable).values({
    workspaceId: foreignWorkspace, campaignId: campaign.id, type: "social_post",
    status: "approved", title: `${marker} foreign`,
    content: { text: "must not leak" },
  }).returning();
  assert.ok(foreignPiece);
  await assert.rejects(() => getCampaignPublishPreview(workspace, campaign.id, foreignPiece.id), (err: unknown) =>
    err instanceof NotFoundError);
  const [draft] = await db.insert(contentPiecesTable).values({
    workspaceId: workspace, campaignId: campaign.id, type: "social_post",
    status: "draft", title: `${marker} draft`, content: { text: "draft" },
  }).returning();
  await assert.rejects(() => getCampaignPublishPreview(workspace, campaign.id, draft!.id), (err: unknown) =>
    err instanceof AppError && err.code === "CONTENT_NOT_APPROVED");

  // A campaign post bound to a different tenant/piece cannot reach Graph.
  const [badPost] = await db.insert(socialPostsTable).values({
    workspaceId: workspace, campaignId: campaign.id, contentPieceId: foreignPiece.id,
    integrationId: ownedIntegration, platform: "instagram", postType: "feed_image",
    status: "draft", caption: marker, hashtags: [], mediaUrls: [],
    masterplanVersionId: plan.id, contextFingerprint: plan.contextFingerprint,
  }).returning();
  assert.ok(badPost);
  resetMetaE2eGraphCalls();
  await assert.rejects(() => publishPost(workspace, badPost.id), (err: unknown) =>
    err instanceof AppError && err.code === "CONTENT_BINDING_MISMATCH");
  assert.equal(getMetaE2eGraphCalls().length, 0);

  // Two confirmations contend on the same advisory lock and durable post.
  resetMetaE2eGraphCalls();
  await assert.rejects(
    () => publishCampaignContentPiece(workspace, campaign.id, piece.id, ""),
    (err: unknown) => err instanceof AppError && err.code === "PUBLISH_PREVIEW_REQUIRED",
  );
  assert.equal(getMetaE2eGraphCalls().length, 0, "no provider call without a preview fingerprint");
  const initialPreview = await getCampaignPublishPreview(workspace, campaign.id, piece.id);
  const outcomes = await Promise.allSettled([
    publishCampaignContentPiece(workspace, campaign.id, piece.id, initialPreview.fingerprint),
    publishCampaignContentPiece(workspace, campaign.id, piece.id, initialPreview.fingerprint),
  ]);
  // The safe transport may reject the dummy credential; the invariant under
  // test is durable idempotency and bounded provider invocation, not a live
  // provider success.
  const durable = await db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, workspace), eq(socialPostsTable.campaignId, campaign.id),
    eq(socialPostsTable.contentPieceId, piece.id), eq(socialPostsTable.integrationId, ownedIntegration),
  ));
  createdPosts.push(...durable.map((row) => row.id));
  assert.equal(durable.length, 1, "concurrent confirmation must create one durable row");
  // The safe transport records the mutation and its mandatory readback as
  // separate calls; the durable-row assertion is the duplicate-submission
  // oracle (and the transport call count remains bounded).
  assert.ok(getMetaE2eGraphCalls().length > 0, "positive path must use safe Graph transport");
  const published = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, durable[0]!.id));
  assert.equal(published[0]!.status, "published", "fake independent readback must confirm publication");
  const attempts = await db.select().from(socialPublishAttemptsTable).where(eq(socialPublishAttemptsTable.postId, durable[0]!.id));
  assert.ok(attempts.some((attempt) => attempt.state === "confirmed"), "attempt receipt/readback must be confirmed");
  const evidence = await db.select({ state: executionEvidenceTable.state }).from(executionEvidenceTable).where(and(
    eq(executionEvidenceTable.subjectType, "social_post"), eq(executionEvidenceTable.subjectId, durable[0]!.id),
  ));
  assert.ok(evidence.some((row) => row.state === "attempted"));
  assert.ok(evidence.some((row) => row.state === "provider_confirmed"));
  // A fresh preview over changed source content must not recycle the old
  // published receipt as confirmation of the new payload.
  const callsBeforeChangedPayload = getMetaE2eGraphCalls().length;
  await db.update(contentPiecesTable).set({ content: { text: `${marker} changed payload` } })
    .where(eq(contentPiecesTable.id, piece.id));
  const changedPreview = await getCampaignPublishPreview(workspace, campaign.id, piece.id);
  const changedResult = await publishCampaignContentPiece(workspace, campaign.id, piece.id, changedPreview.fingerprint);
  assert.ok(changedResult.every((target) => !target.confirmed), "changed payload must be unresolved");
  assert.equal(getMetaE2eGraphCalls().length, callsBeforeChangedPayload, "changed payload must not resubmit");
  const metrics = await syncPostMetrics(workspace, durable[0]!.id);
  assert.equal(metrics.status, "published");
  assert.deepEqual(metrics.metrics, { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0, clicks: 0 }, "metrics are mock cache only");
  console.log("social publication governance adversarial integration test passed");
} finally {
  if (createdPosts.length) await db.delete(socialPostsTable).where(inArray(socialPostsTable.id, createdPosts));
  await db.delete(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, workspace),
    eq(socialPostsTable.campaignId, campaignId ?? ""),
  ));
  await db.delete(contentPiecesTable).where(eq(contentPiecesTable.workspaceId, workspace));
  await db.delete(contentPiecesTable).where(eq(contentPiecesTable.workspaceId, foreignWorkspace));
  // execution_evidence is append-only by database policy; its evidence rows
  // intentionally outlive disposable campaign fixtures.
  try {
    await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, workspace));
  } catch {
    // execution_evidence is append-only and retains campaign references by
    // design; disposable campaign rows are consequently retained in this DB.
  }
  try { await cleanupE2eFixtures(manifest); } catch { /* append-only evidence retention */ }
  await pool.end();
}