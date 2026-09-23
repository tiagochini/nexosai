import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  campaignCreativesTable,
  masterplanVersionsTable,
  socialPostsTable,
  workspaceIntegrationsTable,
  pool,
} from "@workspace/db";
import {
  cleanupE2eFixtures,
  markerFromSuffix,
  seedE2eFixtures,
} from "./e2e-fixtures.js";
import {
  autoPostApprovedContent,
  createScheduledSocialPosts,
  processScheduledSocialPosts,
} from "../modules/social/social.autopost.service.js";

if (process.env["NODE_ENV"] === "production") throw new Error("E2E test is not for production");

const marker = markerFromSuffix(`social-route-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
let campaignIds: string[] = [];
let pieceIds: string[] = [];
let postIds: string[] = [];
const originalFetch = globalThis.fetch;
let providerFetches = 0;

try {
  // This response makes credential probing deterministic and prevents every
  // test path from reaching a real provider. The durable row is still created.
  globalThis.fetch = (async () => {
    providerFetches++;
    return new Response("test provider unavailable", { status: 503 });
  }) as typeof fetch;
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId: manifest.workspaces[0]!,
    title: `${marker} campaign`,
    type: "launch",
    status: "approved",
    strategyData: { test: true },
  }).returning();
  assert.ok(campaign);
  campaignIds.push(campaign.id);
  // Isolate one provider account so "one row" means one logical
  // piece/provider target rather than one row per connected account.
  await db.update(workspaceIntegrationsTable)
    .set({ status: "disconnected" })
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, manifest.workspaces[0]!),
      inArray(workspaceIntegrationsTable.id, manifest.integrations.slice(1)),
    ));

  const [dossier] = await db.insert(masterplanVersionsTable).values({
    workspaceId: manifest.workspaces[0]!,
    campaignId: campaign.id,
    version: 1,
    status: "approved",
    snapshot: { marker },
    contentHash: `${marker}:content`,
    contextFingerprint: `${marker}:context`,
    readinessScore: 100,
    readinessStatus: "ready",
    readinessBlockers: [],
    autonomyContract: {},
    allowedActions: ["social_publish"],
    requiredApprovals: [],
    createdByUserId: manifest.users[0]!,
    approvedByUserId: manifest.users[0]!,
    approvedAt: new Date(),
  }).returning();
  assert.ok(dossier);

  const [piece] = await db.insert(contentPiecesTable).values({
    workspaceId: manifest.workspaces[0]!,
    campaignId: campaign.id,
    type: "social_post",
    status: "approved",
    title: `${marker} approved piece`,
    content: { caption: `${marker} route`, mediaUrls: ["https://example.invalid/route.png"] },
    approvedAt: new Date(),
  }).returning();
  assert.ok(piece);
  pieceIds.push(piece.id);
  const integrationId = manifest.integrations[0]!;

  await assert.rejects(
    () => autoPostApprovedContent(manifest.workspaces[0]!, campaign.id, piece.id),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "SOCIAL_APPROVAL_CONFIRMATION_REQUIRED",
    "direct approval autopost must fail closed with a stable boundary code",
  );
  await assert.rejects(
    () => autoPostApprovedContent(manifest.workspaces[0]!, campaign.id, piece.id),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "SOCIAL_APPROVAL_CONFIRMATION_REQUIRED",
  );
  let rows = await db.select().from(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, manifest.workspaces[0]!),
    eq(socialPostsTable.contentPieceId, piece.id),
  ));
  assert.equal(rows.length, 0, "approval callback must not create a durable social row");
  assert.equal(providerFetches, 0, "fail-closed approval callback must not call a provider");

  // A piece ID is not a workspace authorization. The wrong workspace/campaign
  // callback must not create a row or probe a provider.
  await assert.rejects(
    () => autoPostApprovedContent(manifest.workspaces[1]!, campaign.id, piece.id),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "SOCIAL_APPROVAL_CONFIRMATION_REQUIRED",
  );
  rows = await db.select().from(socialPostsTable).where(eq(socialPostsTable.contentPieceId, piece.id));
  assert.equal(rows.length, 0, "cross-workspace callback must not create a row");
  await db.update(workspaceIntegrationsTable)
    .set({ status: "connected" })
    .where(eq(workspaceIntegrationsTable.id, integrationId));

  // Launch scheduling is also idempotent at the logical piece/integration
  // boundary, even when activation is delivered twice.
  await createScheduledSocialPosts(manifest.workspaces[0]!, campaign.id, "test-sequence", new Date());
  await createScheduledSocialPosts(manifest.workspaces[0]!, campaign.id, "test-sequence", new Date());
  rows = await db.select().from(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, manifest.workspaces[0]!),
    eq(socialPostsTable.contentPieceId, piece.id),
    eq(socialPostsTable.integrationId, integrationId),
  ));
  assert.equal(rows.length, 1, "repeated scheduling must create one logical row");
  assert.equal(rows[0]!.status, "failed", "new launch rows must be blocked immediately");
  assert.equal(rows[0]!.errorMessage, "SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED");
  assert.equal(rows[0]!.masterplanVersionId, dossier.id);
  assert.equal(rows[0]!.contextFingerprint, dossier.contextFingerprint);
  postIds.push(rows[0]!.id);

  // Historical rows may still be scheduled. The due-time guard must retain
  // them but block them before media hydration/provider access.
  const [scheduledPiece] = await db.insert(contentPiecesTable).values({
    workspaceId: manifest.workspaces[0]!,
    campaignId: campaign.id,
    type: "social_post",
    status: "approved",
    title: `${marker} waiting media`,
    content: { caption: `${marker} waiting` },
    approvedAt: new Date(),
  }).returning();
  assert.ok(scheduledPiece);
  pieceIds.push(scheduledPiece.id);
  const [waiting] = await db.insert(socialPostsTable).values({
    workspaceId: manifest.workspaces[0]!,
    campaignId: campaign.id,
    contentPieceId: scheduledPiece.id,
    integrationId,
    platform: "instagram",
    postType: "feed_image",
    status: "scheduled",
    caption: `${marker} waiting`,
    hashtags: [],
    mediaUrls: [],
    scheduledAt: new Date(0),
    masterplanVersionId: dossier.id,
    contextFingerprint: dossier.contextFingerprint,
    aiGenerated: true,
  }).returning();
  assert.ok(waiting);
  const [historical] = await db.select().from(socialPostsTable).where(eq(
    socialPostsTable.contentPieceId, scheduledPiece.id,
  ));
  assert.ok(historical);
  postIds.push(historical.id);
  const [foreignCampaign] = await db.insert(campaignsTable).values({
    workspaceId: manifest.workspaces[1]!,
    title: `${marker} foreign campaign`,
    type: "launch",
  }).returning();
  assert.ok(foreignCampaign);
  campaignIds.push(foreignCampaign.id);
  await db.insert(campaignCreativesTable).values({
    workspaceId: manifest.workspaces[1]!,
    campaignId: foreignCampaign.id,
    status: "approved",
    format: "feed_square",
    platform: "instagram",
    finalUrl: "https://example.invalid/cross-tenant.png",
    metadata: { contentPieceId: scheduledPiece.id },
  });
  await processScheduledSocialPosts();
  const [after] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, historical.id));
  assert.equal(after?.status, "failed", "legacy scheduled row must be blocked without explicit confirmation");
  assert.equal(after?.errorMessage, "SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED");
  assert.equal(providerFetches, 0, "blocked scheduled row must not call a provider");

  console.log("social autopost durable routing tests passed");
} finally {
  globalThis.fetch = originalFetch;
  // Scheduling exercises may create rows for every fixture integration; clean
  // only rows owned by this campaign/workspace, never by ID alone.
  if (campaignIds.length) {
    await db.delete(socialPostsTable).where(and(
      eq(socialPostsTable.workspaceId, manifest.workspaces[0]!),
      inArray(socialPostsTable.campaignId, campaignIds),
    ));
  }
  if (pieceIds.length) await db.delete(contentPiecesTable).where(inArray(contentPiecesTable.id, pieceIds));
  if (campaignIds.length) await db.delete(masterplanVersionsTable).where(inArray(masterplanVersionsTable.campaignId, campaignIds));
  if (campaignIds.length) await db.delete(campaignsTable).where(inArray(campaignsTable.id, campaignIds));
  await cleanupE2eFixtures(manifest);
  await pool.end();
}