import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, workspaceIntegrationsTable } from "@workspace/db";
import { NotFoundError } from "../lib/errors.js";
import { disconnectAccount, disconnectFacebookChannel } from "../modules/social/social.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] === "production") throw new Error("Refusing to run against production");

const marker = markerFromSuffix(`facebook-channel-disconnect-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspaceId = manifest.workspaces[0];
if (!workspaceId) throw new Error("E2E fixture must create a workspace");
const insertedIds: string[] = [];

try {
  const [legacyInstagram] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId,
    provider: "instagram",
    status: "connected",
    accountId: `${marker}_ig_legacy`,
    accountName: `${marker} Instagram`,
    accessToken: "E2E_KEEP_INSTAGRAM_TOKEN",
    metadata: { integrationPurpose: "organic_social", authType: "facebook_login", pageId: `${marker}_page_legacy` },
  }).returning();
  assert.ok(legacyInstagram);
  insertedIds.push(legacyInstagram.id);

  await disconnectFacebookChannel(workspaceId, legacyInstagram.id);
  const [afterLegacyDisconnect] = await db.select().from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.id, legacyInstagram.id));
  assert.equal(afterLegacyDisconnect?.status, "connected", "Instagram remains connected");
  assert.equal(afterLegacyDisconnect?.accessToken, "E2E_KEEP_INSTAGRAM_TOKEN", "Instagram token remains intact");
  assert.equal((afterLegacyDisconnect?.metadata as Record<string, unknown>)?.facebookPageDisconnected, true);

  const [page] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId,
    provider: "meta_ads",
    status: "connected",
    accountId: `${marker}_page_independent`,
    accountName: `${marker} Facebook Page`,
    accessToken: "E2E_FACEBOOK_PAGE_TOKEN",
    metadata: { integrationPurpose: "organic_social", pageId: `${marker}_page_independent` },
  }).returning();
  assert.ok(page);
  insertedIds.push(page.id);

  await disconnectAccount(workspaceId, page.id);
  const [afterPageDisconnect, retainedInstagram] = await Promise.all([
    db.select().from(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.id, page.id)).then(rows => rows[0]),
    db.select().from(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.id, legacyInstagram.id)).then(rows => rows[0]),
  ]);
  assert.equal(afterPageDisconnect?.status, "disconnected", "only the Facebook Page row is disconnected");
  assert.equal(afterPageDisconnect?.accessToken, null, "the Page token is cleared");
  assert.equal(retainedInstagram?.status, "connected", "the linked Instagram row remains connected");
  assert.equal(retainedInstagram?.accessToken, "E2E_KEEP_INSTAGRAM_TOKEN");

  const [directInstagram] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId,
    provider: "instagram",
    status: "connected",
    accountId: `${marker}_ig_direct`,
    accountName: `${marker} Direct Instagram`,
    accessToken: "E2E_DIRECT_INSTAGRAM_TOKEN",
    metadata: { integrationPurpose: "organic_social", authType: "instagram_login" },
  }).returning();
  assert.ok(directInstagram);
  insertedIds.push(directInstagram.id);
  await assert.rejects(
    disconnectFacebookChannel(workspaceId, directInstagram.id),
    (error: unknown) => error instanceof NotFoundError,
    "Facebook-only disconnect must reject a direct Instagram Login credential",
  );

  console.log("Facebook-only disconnect integration test passed");
} finally {
  if (insertedIds.length > 0) {
    await db.delete(workspaceIntegrationsTable).where(and(
      inArray(workspaceIntegrationsTable.id, insertedIds),
      eq(workspaceIntegrationsTable.workspaceId, workspaceId),
    ));
  }
  try {
    await cleanupE2eFixtures(manifest);
  } finally {
    await pool.end();
  }
}
