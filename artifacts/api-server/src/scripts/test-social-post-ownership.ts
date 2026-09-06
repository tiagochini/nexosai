import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  socialPostsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { NotFoundError } from "../lib/errors.js";
import {
  getMetaE2eGraphCalls,
  resetMetaE2eGraphCalls,
} from "../lib/meta-graph.transport.js";
import { publishPost, syncPostMetrics } from "../modules/social/social.service.js";
import {
  cleanupE2eFixtures,
  markerFromSuffix,
  seedE2eFixtures,
} from "./e2e-fixtures.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const marker = markerFromSuffix(`social-owner-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const [workspaceA, workspaceB] = manifest.workspaces;
if (!workspaceA || !workspaceB) throw new Error("E2E fixture must create two workspaces");

const baselineMetrics = {
  likes: 17, comments: 3, shares: 2, views: 41,
  reach: 51, impressions: 63, clicks: 5,
};
let postIds: string[] = [];

async function readPost(workspaceId: string, postId: string) {
  const [post] = await db.select().from(socialPostsTable).where(and(
    eq(socialPostsTable.id, postId),
    eq(socialPostsTable.workspaceId, workspaceId),
  ));
  assert.ok(post, `expected post ${postId} in its owning workspace`);
  return post;
}

async function expectForeignNotFound(operation: () => Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) =>
    error instanceof NotFoundError && error.statusCode === 404 && error.code === "NOT_FOUND",
  );
}

try {
  const [integration] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId: workspaceB,
    provider: "instagram",
    status: "connected",
    accountId: `${marker}_ig_owner`,
    accountName: `${marker} Owner IG`,
    accessToken: "E2E_DUMMY_SOCIAL_OWNER_TOKEN",
    metadata: { integrationPurpose: "organic_social", pageId: `${marker}_page_owner` },
  }).returning();
  assert.ok(integration, "owner integration was inserted");

  const inserted = await db.insert(socialPostsTable).values([
    {
      workspaceId: workspaceB,
      integrationId: integration.id,
      platform: "instagram",
      postType: "feed_image",
      status: "draft",
      caption: `${marker} foreign publish target`,
      hashtags: [],
      mediaUrls: ["https://example.invalid/e2e-social-owner.png"],
    },
    {
      workspaceId: workspaceB,
      integrationId: integration.id,
      platform: "instagram",
      postType: "feed_image",
      status: "published",
      caption: `${marker} foreign metrics target`,
      hashtags: [],
      mediaUrls: ["https://example.invalid/e2e-social-owner.png"],
      platformPostId: `${marker}_published`,
      publishedAt: new Date(),
      metrics: baselineMetrics,
    },
  ]).returning();
  const [publishTarget, metricsTarget] = inserted;
  assert.ok(publishTarget && metricsTarget, "both workspace-B posts were inserted");
  postIds = [publishTarget.id, metricsTarget.id];

  // Calling the real service boundary with workspace A models an authenticated
  // workspace-A request. Both checks must fail before publisher/Graph access.
  resetMetaE2eGraphCalls();
  const publishBefore = await readPost(workspaceB, publishTarget.id);
  await expectForeignNotFound(() => publishPost(workspaceA, publishTarget.id));
  assert.equal(getMetaE2eGraphCalls().length, 0, "foreign publish must not reach Graph");
  const publishAfter = await readPost(workspaceB, publishTarget.id);
  assert.equal(publishAfter.status, publishBefore.status, "foreign publish must not change status");
  assert.deepEqual(publishAfter.metrics, publishBefore.metrics, "foreign publish must not change metrics");

  resetMetaE2eGraphCalls();
  const metricsBefore = await readPost(workspaceB, metricsTarget.id);
  await expectForeignNotFound(() => syncPostMetrics(workspaceA, metricsTarget.id));
  assert.equal(getMetaE2eGraphCalls().length, 0, "foreign metrics sync must not reach Graph");
  const metricsAfter = await readPost(workspaceB, metricsTarget.id);
  assert.equal(metricsAfter.status, metricsBefore.status, "foreign metrics sync must not change status");
  assert.deepEqual(metricsAfter.metrics, metricsBefore.metrics, "foreign metrics sync must not change metrics");

  // A valid owner request still uses the process-local E2E Graph transport.
  resetMetaE2eGraphCalls();
  const synced = await syncPostMetrics(workspaceB, metricsTarget.id);
  assert.equal(synced.status, "published");
  assert.equal(getMetaE2eGraphCalls().length, 1, "owner metrics sync reaches Graph exactly once");
  assert.match(getMetaE2eGraphCalls()[0]!.path, new RegExp(`/${metricsTarget.platformPostId}/insights$`));

  resetMetaE2eGraphCalls();
  const published = await publishPost(workspaceB, publishTarget.id);
  assert.equal(published.status, "published");
  assert.equal(getMetaE2eGraphCalls().length, 3, "owner image publish reaches the E2E Graph mock safely");

  console.log("social post workspace ownership integration test passed");
} finally {
  try {
    if (postIds.length > 0) {
      const ownedRows = await db.select({
        id: socialPostsTable.id,
        workspaceId: socialPostsTable.workspaceId,
        caption: socialPostsTable.caption,
      }).from(socialPostsTable).where(inArray(socialPostsTable.id, postIds));
      if (
        ownedRows.length !== postIds.length ||
        ownedRows.some((post) => post.workspaceId !== workspaceB || !post.caption?.startsWith(marker))
      ) {
        throw new Error("Refusing cleanup: social ownership test rows lack strict E2E marker");
      }
      await db.delete(socialPostsTable).where(and(
        inArray(socialPostsTable.id, postIds),
        eq(socialPostsTable.workspaceId, workspaceB),
      ));
    }
  } finally {
    await cleanupE2eFixtures(manifest);
    await pool.end();
  }
}