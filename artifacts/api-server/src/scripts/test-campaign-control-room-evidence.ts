import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { campaignsTable, db, executionEvidenceTable, pool, socialPostsTable } from "@workspace/db";
import campaignsRouter from "../modules/campaigns/campaigns.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`control-room-evidence-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const token = signAccess({ userId: fixtures.users[0]!, workspaceId, email: `${marker}@e2e.invalid` });
let server: http.Server | undefined;
const campaignIds: string[] = [];
const evidenceIds: string[] = [];
try {
  const [{ id: campaignId }, { id: otherCampaignId }, { id: foreignCampaignId }] = await db.insert(campaignsTable).values([
    { workspaceId, title: `${marker} primary` }, { workspaceId, title: `${marker} empty` },
    { workspaceId: foreignWorkspaceId, title: `${marker} foreign` },
  ]).returning({ id: campaignsTable.id });
  campaignIds.push(campaignId!, otherCampaignId!, foreignCampaignId!);
  const socialId = randomUUID();
  await db.insert(socialPostsTable).values({
    id: socialId, workspaceId, campaignId: campaignId!, integrationId: fixtures.integrations[0]!,
    platform: "instagram", postType: "text", status: "draft", caption: marker, mediaUrls: [],
  });
  const common = new Date("2025-01-01T00:00:00.000Z");
  const subjects = [
    ["social_post", socialId, "planned"],
    ["social_post", randomUUID(), "attempted"],
    ["paid_media_attempt", randomUUID(), "provider_confirmed"],
    ["paid_media_launch_plan", randomUUID(), "artifact_qc"],
    ["paid_media_proposal", randomUUID(), "planned"],
    ["product_sale", randomUUID(), "attempted"],
    ["revenue_event", randomUUID(), "provider_confirmed"],
  ] as const;
  const inserted = await db.insert(executionEvidenceTable).values(subjects.map(([subjectType, subjectId, state], i) => ({
    workspaceId, campaignId: campaignId!, subjectType, subjectId, state,
    masterplanVersionId: null, contextFingerprint: i === 2 ? `${marker}-fingerprint-long` : null,
    details: { safe: `${marker}/safe`, safeUrl: "https://example.invalid/path?token=secret#hash", accessToken: "MUST_NOT_LEAK", signedUrl: "https://example.invalid/path?token=secret#hash" },
    createdAt: new Date(common.getTime() + (i === 0 ? 1000 : 0)),
  }))).returning({ id: executionEvidenceTable.id, createdAt: executionEvidenceTable.createdAt, subjectId: executionEvidenceTable.subjectId });
  evidenceIds.push(...inserted.map(row => row.id));

  const app = express(); app.use("/campaigns", campaignsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = (id: string, query = "") => fetch(`${base}/campaigns/${id}/control-room/evidence${query}`, { headers: { authorization: `Bearer ${token}` } });
  const body = async (id: string, query = "") => {
    const response = await get(id, query); const json = await response.json() as any;
    return { response, json };
  };
  const fail = async (query: string) => {
    const result = await body(campaignId!, query);
    assert.equal(result.response.status, 400); assert.equal(result.json.code, "VALIDATION_ERROR");
  };

  const allIds: string[] = [];
  let cursor: string | null = null;
  const pages: any[] = [];
  for (let page = 0; page < 3; page++) {
    const result = await body(campaignId!, `?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(result.response.status, 200); pages.push(result.json);
    assert.equal(result.json.total, 7); assert.equal(result.json.pageInfo.limit, 3);
    allIds.push(...result.json.records.map((row: any) => row.id));
    cursor = result.json.pageInfo.nextCursor;
    assert.equal(result.json.records.length, page === 2 ? 1 : 3);
    assert.equal(result.json.pageInfo.hasNextPage, page < 2);
    if (page === 2) assert.equal(cursor, null);
  }
  assert.equal(new Set(allIds).size, 7);
  assert.deepEqual(allIds, [...inserted].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).map(row => row.id));
  assert.deepEqual(pages[0].facets.states.sort((a: any, b: any) => a.value.localeCompare(b.value)), [
    { value: "artifact_qc", count: 1 }, { value: "attempted", count: 2 }, { value: "planned", count: 2 }, { value: "provider_confirmed", count: 2 },
  ]);
  assert.deepEqual(pages[0].facets.subjectTypes.sort((a: any, b: any) => a.value.localeCompare(b.value)), [
    { value: "paid_media_attempt", count: 1 }, { value: "paid_media_launch_plan", count: 1 },
    { value: "paid_media_proposal", count: 1 }, { value: "product_sale", count: 1 },
    { value: "revenue_event", count: 1 }, { value: "social_post", count: 2 },
  ]);
  const first = pages[0].records[0];
  assert.equal(first.masterplanVersionId, null); assert.equal(first.contextFingerprint, null);
  assert.ok(JSON.stringify(pages).length < 100_000);
  assert.ok(pages.flatMap(page => page.records).some((row: any) => row.source?.kind === "social_post"));
  assert.ok(pages.flatMap(page => page.records).some((row: any) => row.subjectType === "social_post" && row.source === null));
  for (const row of pages.flatMap(page => page.records)) {
    assert.equal(row.details.accessToken, undefined); assert.equal(row.details.signedUrl, undefined);
    assert.equal(row.details.safe, `${marker}/safe`);
    assert.equal(row.details.safeUrl, "https://example.invalid/path");
    if (row.contextFingerprint) assert.ok(row.contextFingerprint.length <= 12);
    if (row.subjectType !== "social_post") assert.equal(row.source, null);
  }

  for (const state of ["planned", "attempted", "provider_confirmed", "artifact_qc"]) {
    const result = await body(campaignId!, `?state=${state}`);
    assert.equal(result.json.appliedFilters.state, state); assert.ok(result.json.records.length > 0);
  }
  for (const subjectType of ["social_post", "paid_media_attempt", "paid_media_launch_plan", "paid_media_proposal", "product_sale", "revenue_event"]) {
    const result = await body(campaignId!, `?subjectType=${subjectType}`);
    assert.equal(result.json.appliedFilters.subjectType, subjectType); assert.ok(result.json.records.length > 0);
  }
  const target = inserted[2]!;
  for (const [query, field] of [
    [`subjectId=${target.subjectId}`, "subjectId"], ["from=2025-01-01T00%3A00%3A00.000Z", "from"], ["to=2025-01-01T00%3A00%3A00.001Z", "to"],
  ]) {
    const result = await body(campaignId!, `?${query}`); assert.equal(result.response.status, 200); assert.equal(result.json.appliedFilters[field], decodeURIComponent(query.split("=")[1]!));
  }
  const combined = await body(campaignId!, `?state=provider_confirmed&subjectType=paid_media_attempt`);
  assert.equal(combined.json.total, 1); assert.equal(combined.json.appliedFilters.state, "provider_confirmed");

  const validCursor = pages[0].pageInfo.nextCursor!;
  for (const query of [`?cursor=${validCursor.slice(0, -1)}x`, `?cursor=${validCursor}&state=attempted`, `?cursor=${validCursor}&subjectType=revenue_event`, `?cursor=${validCursor}&limit=4`]) await fail(query);
  const otherCursor = await body(campaignId!, "?limit=3"); const cross = await body(otherCampaignId!, `?cursor=${encodeURIComponent(otherCursor.json.pageInfo.nextCursor)}`);
  assert.equal(cross.response.status, 400); assert.equal(cross.json.code, "VALIDATION_ERROR");
  for (const query of ["?limit=0", "?limit=101", "?limit=nope", "?state=nope", "?subjectType=nope", `?subjectId=${randomUUID().slice(0, -1)}`, "?from=nope", "?from=2025-01-02T00%3A00%3A00Z&to=2025-01-01T00%3A00%3A00Z", "?limit=3&limit=4", "?unknown=1"]) await fail(query);

  const empty = await body(otherCampaignId!); assert.equal(empty.response.status, 200); assert.equal(empty.json.total, 0); assert.deepEqual(empty.json.records, []); assert.deepEqual(empty.json.facets, { states: [], subjectTypes: [] }); assert.equal(empty.json.pageInfo.nextCursor, null);
  for (const id of [foreignCampaignId!, randomUUID()]) { const result = await body(id); assert.equal(result.response.status, 404); }
  console.log("campaign control room evidence pagination, filtering and security tests passed");
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(err => err ? reject(err) : resolve()));
  if (evidenceIds.length) await db.delete(executionEvidenceTable).where(inArray(executionEvidenceTable.id, evidenceIds));
  if (campaignIds.length) {
    await db.delete(socialPostsTable).where(inArray(socialPostsTable.campaignId, campaignIds));
    await db.delete(campaignsTable).where(inArray(campaignsTable.id, campaignIds));
  }
  await cleanupE2eFixtures(fixtures); await pool.end();
}