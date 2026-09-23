import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, campaignsTable, masterplanVersionsTable, pagesTable, landingRevisionsTable,
} from "@workspace/db";
import {
  GetCampaignControlRoomVersionSourcesResponse,
  GetCampaignControlRoomVersionDiffResponse,
} from "@workspace/api-zod";
import {
  getCampaignControlRoomVersionSources,
  getCampaignControlRoomVersionDiff,
} from "../modules/campaigns/control-room.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`control-room-version-diff-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const ids: string[] = [];
const at = new Date("2025-03-01T00:00:00.000Z");
const longA = "A".repeat(4096) + "tail-a";
const longB = "A".repeat(4096) + "tail-b";
const secret = "Bearer abc.def.ghi -----BEGIN PRIVATE KEY----- hidden -----END PRIVATE KEY-----";

try {
  const [campaign, foreignCampaign] = await db.insert(campaignsTable).values([
    { workspaceId, title: `${marker} primary` }, { workspaceId: foreignWorkspaceId, title: `${marker} foreign` },
  ]).returning({ id: campaignsTable.id });
  ids.push(campaign!.id, foreignCampaign!.id);
  const snap1 = { text: "same", cta: { label: "old" }, media: ["a"], rules: { min: 1 }, phase: { name: "one" }, nested: [{ x: 1, keep: true }], removed: true };
  const snap2 = { text: longA, cta: { label: "new" }, media: ["a", "b"], rules: { min: 2 }, phase: { name: "two" }, nested: [{ x: 2, keep: true }, { x: 3 }], added: true, sensitive: secret, url: "https://user:pass@example.invalid/p?token=one#hash" };
  const snap3 = { ...snap2, text: longB, sensitive: "Bearer changed.jwt.value", url: "https://user:pass@example.invalid/p?token=two#other" };
  const oversized = { huge: Array.from({ length: 3_500 }, (_, index) => ({ index, values: [index, index + 1, index + 2] })) };
  const masters = await db.insert(masterplanVersionsTable).values([
    { workspaceId, campaignId: campaign!.id, version: 1, status: "superseded", snapshot: snap1, contentHash: "h1", contextFingerprint: "f1", readinessScore: 1, readinessStatus: "ready", createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, version: 2, status: "superseded", snapshot: snap2, contentHash: "h2", contextFingerprint: "f2", readinessScore: 1, readinessStatus: "ready", createdAt: new Date(+at + 1), updatedAt: new Date(+at + 1) },
    { workspaceId, campaignId: campaign!.id, version: 3, status: "approved", snapshot: snap3, contentHash: "h3", contextFingerprint: "f3", readinessScore: 1, readinessStatus: "ready", createdAt: new Date(+at + 2), updatedAt: new Date(+at + 2) },
    { workspaceId, campaignId: campaign!.id, version: 4, status: "approved", snapshot: oversized, contentHash: "h4", contextFingerprint: "f4", readinessScore: 1, readinessStatus: "ready", createdAt: new Date(+at + 3), updatedAt: new Date(+at + 3) },
  ]).returning({ id: masterplanVersionsTable.id });
  ids.push(...masters.map(x => x.id));
  const [page, page2, foreignPage] = await db.insert(pagesTable).values([
    { workspaceId, campaignId: campaign!.id, type: "landing", title: `${marker} page`, slug: `${marker}-one`, status: "draft", html: "<p>mutable</p>", metadata: {}, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "sales", title: `${marker} page2`, slug: `${marker}-two`, status: "draft", html: "<p>mutable</p>", metadata: {}, createdAt: at, updatedAt: at },
    { workspaceId: foreignWorkspaceId, campaignId: foreignCampaign!.id, type: "landing", title: `${marker} foreign page`, slug: `${marker}-foreign`, status: "draft", html: "<p>x</p>", metadata: {}, createdAt: at, updatedAt: at },
  ]).returning({ id: pagesTable.id });
  ids.push(page!.id, page2!.id, foreignPage!.id);
  const revisions = await db.insert(landingRevisionsTable).values([
    { workspaceId, pageId: page!.id, revision: 1, source: { text: "old", nested: [{ a: 1 }], media: ["a"] }, html: "<p>old</p>", contentHash: "p1", status: "superseded", createdAt: at },
    { workspaceId, pageId: page!.id, revision: 2, source: { text: "new", nested: [{ a: 2 }, { b: true }], media: ["a", "b"] }, html: `<p>${longB}</p>`, contentHash: "p2", status: "generated", createdAt: new Date(+at + 1) },
    { workspaceId, pageId: page2!.id, revision: 1, source: {}, html: "<p>1</p>", contentHash: "q1", status: "superseded", createdAt: at },
    { workspaceId, pageId: page2!.id, revision: 2, source: {}, html: "<p>2</p>", contentHash: "q2", status: "generated", createdAt: new Date(+at + 1) },
    { workspaceId: foreignWorkspaceId, pageId: foreignPage!.id, revision: 1, source: {}, html: "<p>x</p>", contentHash: "x1", status: "generated", createdAt: at },
  ]).returning({ id: landingRevisionsTable.id });
  ids.push(...revisions.map(x => x.id));

  const before = await db.select({ id: masterplanVersionsTable.id, hash: masterplanVersionsTable.contentHash, updatedAt: masterplanVersionsTable.updatedAt }).from(masterplanVersionsTable).where(inArray(masterplanVersionsTable.id, masters.map(x => x.id)));
  const catalog = GetCampaignControlRoomVersionSourcesResponse.parse(await getCampaignControlRoomVersionSources(campaign!.id, workspaceId));
  const masterSource = catalog.sources.find(x => x.kind === "masterplan")!;
  assert.deepEqual(masterSource.versions!.map(x => x.version), [4, 3, 2, 1]);
  assert.equal(masterSource.historyAvailable, true); assert.equal(masterSource.comparable, true); assert.equal(masterSource.versionCount, 4);
  const pageSource = catalog.sources.find(x => x.id === page!.id)!;
  assert.deepEqual(pageSource.versions!.map(x => x.revision), [2, 1]); assert.equal(pageSource.versionCount, 2);
  assert.ok(catalog.sources.some(x => x.kind === "content_piece" && !x.historyAvailable && x.reason === "history_not_persisted"));

  const diffInput = { resource: "masterplan" as const, baseId: masters[0]!.id, targetId: masters[2]!.id, maxChanges: 500 };
  const diff = GetCampaignControlRoomVersionDiffResponse.parse(await getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, diffInput));
  const repeat = await getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, diffInput);
  assert.deepEqual(diff, repeat); assert.ok(diff.summary.added > 0 && diff.summary.removed > 0 && diff.summary.changed > 0);
  assert.ok(diff.changes.some(x => x.category === "cta") && diff.changes.some(x => x.category === "media") && diff.changes.some(x => x.category === "rules") && diff.changes.some(x => x.category === "phase") && diff.changes.some(x => x.category === "text"));
  assert.ok(diff.warnings.includes("values_truncated_to_preview_limit")); assert.ok(!JSON.stringify(diff).includes(secret));
  const hiddenOnlyDiff = GetCampaignControlRoomVersionDiffResponse.parse(await getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { resource: "masterplan", baseId: masters[1]!.id, targetId: masters[2]!.id, maxChanges: 20 }));
  assert.ok(hiddenOnlyDiff.summary.changed >= 3);
  assert.ok(hiddenOnlyDiff.changes.some(x => x.path === "/text"));
  assert.ok(hiddenOnlyDiff.changes.some(x => x.path === "/sensitive"));
  assert.ok(hiddenOnlyDiff.changes.some(x => x.path === "/url"));
  assert.ok(!JSON.stringify(hiddenOnlyDiff).includes("tail-a"));
  assert.ok(!JSON.stringify(hiddenOnlyDiff).includes("tail-b"));
  assert.ok(!JSON.stringify(hiddenOnlyDiff).includes("token=one"));
  assert.ok(!JSON.stringify(hiddenOnlyDiff).includes("token=two"));
  const boundedDiff = GetCampaignControlRoomVersionDiffResponse.parse(await getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { resource: "masterplan", baseId: masters[2]!.id, targetId: masters[3]!.id, maxChanges: 1000 }));
  assert.equal(boundedDiff.summary.truncated, true);
  assert.ok(boundedDiff.warnings.includes("comparison_incomplete_due_to_limits"));
  assert.ok(Buffer.byteLength(JSON.stringify(boundedDiff)) < 300_000);
  const pageDiff = GetCampaignControlRoomVersionDiffResponse.parse(await getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { resource: "page", sourceId: page!.id, baseId: revisions[0]!.id, targetId: revisions[1]!.id, maxChanges: 1 }));
  assert.equal(pageDiff.summary.truncated, true); assert.ok(pageDiff.changes.length <= 1); assert.ok(Buffer.byteLength(JSON.stringify(pageDiff)) < 256_000);
  await assert.rejects(() => getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { ...diffInput, baseId: masters[0]!.id, targetId: masters[0]!.id }), /Invalid diff combination/);
  await assert.rejects(() => getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { ...diffInput, baseId: masters[0]!.id, targetId: masters[0]!.id.replace(/.$/, "0") }), /Version|Invalid/);
  await assert.rejects(() => getCampaignControlRoomVersionDiff(foreignCampaign!.id, workspaceId, diffInput), /Campaign/);
  await assert.rejects(() => getCampaignControlRoomVersionDiff(campaign!.id, workspaceId, { resource: "page", sourceId: foreignPage!.id, baseId: revisions[0]!.id, targetId: revisions[1]!.id, maxChanges: 10 }), /Page/);
  const after = await db.select({ id: masterplanVersionsTable.id, hash: masterplanVersionsTable.contentHash, updatedAt: masterplanVersionsTable.updatedAt }).from(masterplanVersionsTable).where(inArray(masterplanVersionsTable.id, masters.map(x => x.id)));
  assert.deepEqual(after, before);
  assert.throws(() => GetCampaignControlRoomVersionDiffResponse.parse({ schemaVersion: 1, available: true, resource: "page", source: {}, base: {}, target: {}, summary: {}, changes: [], warnings: [] }));
  console.log("campaign control-room version diff DB/service, ownership, determinism, sanitization, bounds and immutability tests passed");
} finally {
  await db.delete(campaignsTable).where(inArray(campaignsTable.id, ids.filter(Boolean)));
  await cleanupE2eFixtures(fixtures);
  await pool.end();
}