import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  socialPresencePostsTable,
} from "@workspace/db";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";
import {
  getMetaE2eGraphCalls,
  resetMetaE2eGraphCalls,
} from "../lib/meta-graph.transport.js";
import { publishToFacebook, publishToInstagram } from "../modules/social/social.publisher.js";
import { publishPostNow, updatePost } from "../modules/social-presence/social-presence.service.js";
import {
  cleanupE2eFixtures,
  markerFromSuffix,
  seedE2eFixtures,
} from "./e2e-fixtures.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const marker = markerFromSuffix(`presence-carousel-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const [workspaceA, workspaceB] = manifest.workspaces;
if (!workspaceA || !workspaceB) throw new Error("E2E fixture must create two workspaces");
let foreignPostId: string | undefined;

const mediaUrls = [
  "https://cdn.example.invalid/slide-01.jpg",
  "https://cdn.example.invalid/slide-02.jpg",
];
const integration = {
  id: "e2e-integration",
  accessToken: "E2E_DUMMY_TOKEN",
  accountId: "e2e_account",
} as WorkspaceIntegration;
const carouselPost = {
  id: "e2e-carousel-post",
  postType: "carousel",
  mediaUrls,
  caption: "Ordered carousel",
  hashtags: ["carousel"],
} as SocialPost;

function bodyAt(index: number): Record<string, unknown> {
  const body = getMetaE2eGraphCalls()[index]?.body;
  assert.ok(body && typeof body === "object" && !Array.isArray(body), `expected object body at call ${index}`);
  return body as Record<string, unknown>;
}

try {
  // Instagram validates its item count before any Graph request.
  resetMetaE2eGraphCalls();
  for (const invalidMedia of [[mediaUrls[0]!], Array.from({ length: 11 }, (_, i) => `https://cdn.example.invalid/${i}.jpg`)]) {
    const result = await publishToInstagram({ ...carouselPost, mediaUrls: invalidMedia } as SocialPost, integration);
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /between 2 and 10/i);
  }
  assert.equal(getMetaE2eGraphCalls().length, 0);

  // Two child POSTs are kept in input order, each is awaited, followed by the
  // CAROUSEL parent, its readiness poll, and the publish request.
  resetMetaE2eGraphCalls();
  const instagram = await publishToInstagram(carouselPost, integration);
  assert.equal(instagram.success, true);
  const igCalls = getMetaE2eGraphCalls();
  assert.equal(igCalls.length, 7);
  assert.equal(igCalls[0]?.path, "/v22.0/e2e_account/media");
  assert.equal(bodyAt(0).image_url, mediaUrls[0]);
  assert.equal(bodyAt(0).is_carousel_item, true);
  assert.equal(igCalls[1]?.method, "GET");
  assert.equal(bodyAt(2).image_url, mediaUrls[1]);
  assert.equal(bodyAt(2).is_carousel_item, true);
  assert.equal(igCalls[3]?.method, "GET");
  assert.equal(bodyAt(4).media_type, "CAROUSEL");
  assert.equal(typeof bodyAt(4).children, "string");
  assert.equal((bodyAt(4).children as string).split(",").length, 2);
  assert.equal(igCalls[5]?.method, "GET");
  assert.equal(igCalls[6]?.path, "/v22.0/e2e_account/media_publish");

  // Facebook creates unpublished photos in order and attaches the resulting
  // photo media IDs to exactly one feed post.
  resetMetaE2eGraphCalls();
  const facebook = await publishToFacebook(carouselPost, integration);
  assert.equal(facebook.success, true);
  const fbCalls = getMetaE2eGraphCalls();
  assert.equal(fbCalls.length, 3);
  assert.equal(fbCalls[0]?.path, "/v22.0/e2e_account/photos");
  assert.deepEqual(
    [bodyAt(0).url, bodyAt(1).url],
    mediaUrls,
    "unpublished photos preserve slide order",
  );
  assert.equal(bodyAt(0).published, false);
  assert.equal(bodyAt(1).published, false);
  assert.equal(fbCalls[2]?.path, "/v22.0/e2e_account/feed");
  assert.deepEqual(
    bodyAt(2).attached_media,
    (bodyAt(2).attached_media as Array<Record<string, unknown>>).map(({ media_fbid }) => ({ media_fbid })),
  );
  assert.equal((bodyAt(2).attached_media as unknown[]).length, 2);

  // A foreign workspace must not edit or trigger the retry-limit mutation.
  const [foreign] = await db.insert(socialPresencePostsTable).values({
    workspaceId: workspaceB,
    platform: "instagram",
    status: "draft",
    weekStart: new Date(),
    caption: `${marker} foreign presence post`,
    manualRetryCount: 3,
    visualDirection: "original direction",
  }).returning();
  assert.ok(foreign);
  foreignPostId = foreign.id;
  assert.equal(await updatePost(workspaceA, foreign.id, { caption: "foreign mutation" }), null);
  assert.equal(await publishPostNow(workspaceA, foreign.id), null);
  const [after] = await db.select().from(socialPresencePostsTable).where(and(
    eq(socialPresencePostsTable.id, foreign.id),
    eq(socialPresencePostsTable.workspaceId, workspaceB),
  ));
  assert.ok(after);
  assert.equal(after.caption, `${marker} foreign presence post`);
  assert.equal(after.status, "draft", "foreign retry-limit request must not lock the post");
  assert.equal(after.manualRetryCount, 3);

  console.log("presence carousel publishing and workspace ownership test passed");
} finally {
  try {
    if (foreignPostId) {
      await db.delete(socialPresencePostsTable).where(and(
        eq(socialPresencePostsTable.id, foreignPostId),
        eq(socialPresencePostsTable.workspaceId, workspaceB),
      ));
    }
  } finally {
    await cleanupE2eFixtures(manifest);
    await pool.end();
  }
}