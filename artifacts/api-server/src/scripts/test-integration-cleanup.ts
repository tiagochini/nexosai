import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { cleanupDisconnectedIntegrationDuplicates } from "../modules/integrations/integration-cleanup.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const marker = markerFromSuffix(`integration_cleanup_${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspaceId = manifest.workspaces[0]!;

try {
  // These are exact, disconnected OAuth debris duplicates. They are the only
  // rows this maintenance operation is permitted to reduce.
  await db.insert(workspaceIntegrationsTable).values([
    {
      workspaceId, provider: "instagram", status: "disconnected",
      accountId: `${marker}_abandoned`, accountName: "abandoned one",
      metadata: { integrationPurpose: "organic_social" },
    },
    {
      workspaceId, provider: "instagram", status: "disconnected",
      accountId: `${marker}_abandoned`, accountName: "abandoned two",
      metadata: { integrationPurpose: "organic_social" },
    },
    // Same provider/account, but the canonical legacy Page and paid-media
    // fallback classifications differ. These must not be treated as duplicates.
    {
      workspaceId, provider: "meta_ads", status: "disconnected",
      accountId: `${marker}_purpose_split`, accountName: "legacy Page",
      metadata: { pageId: `${marker}_purpose_split` },
    },
    {
      workspaceId, provider: "meta_ads", status: "disconnected",
      accountId: `${marker}_purpose_split`, accountName: "legacy paid OAuth",
      metadata: { paidMedia: true },
    },
  ]);

  assert.ok(await cleanupDisconnectedIntegrationDuplicates() >= 1);
  const rows = await db.select({
    provider: workspaceIntegrationsTable.provider,
    accountId: workspaceIntegrationsTable.accountId,
    status: workspaceIntegrationsTable.status,
    metadata: workspaceIntegrationsTable.metadata,
  }).from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.workspaceId, workspaceId));

  const connected = rows.filter((row) => row.status === "connected");
  assert.equal(connected.length, 4, "all connected logical integrations must survive");
  assert.equal(connected.filter((row) => row.provider === "instagram").length, 2,
    "two organic Instagram accounts must not collapse");
  assert.ok(connected.some((row) => row.provider === "meta_ads"
    && row.accountId === `${marker}_legacy_page`
    && !("integrationPurpose" in (row.metadata as Record<string, unknown>))),
  "legacy organic Meta Page must survive");
  assert.ok(connected.some((row) => row.provider === "meta_ads"
    && row.accountId === `act_${marker}`
    && (row.metadata as Record<string, unknown>).integrationPurpose === "paid_media"),
  "paid-media Meta credential must survive");

  const abandoned = rows.filter((row) => row.provider === "instagram"
    && row.accountId === `${marker}_abandoned`);
  assert.equal(abandoned.length, 1, "only exact disconnected duplicates are reduced");
  const purposeSplit = rows.filter((row) => row.provider === "meta_ads"
    && row.accountId === `${marker}_purpose_split`);
  assert.equal(purposeSplit.length, 2,
    "legacy organic Page and paid-media fallback must remain distinct");
} finally {
  await cleanupE2eFixtures(manifest);
}

console.log("integration cleanup regression test passed");