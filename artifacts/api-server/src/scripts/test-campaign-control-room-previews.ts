import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, campaignsTable, contentPiecesTable, mediaBriefsTable, socialPostsTable,
  campaignCreativesTable, campaignAssetsTable, pagesTable, videoProjectsTable,
} from "@workspace/db";
import campaignsRouter from "../modules/campaigns/campaigns.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`control-room-previews-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const token = signAccess({ userId: fixtures.users[0]!, workspaceId, email: `${marker}@e2e.invalid` });
let server: http.Server | undefined;
const campaignIds: string[] = [];
const sourceIds: Record<string, string[]> = { content: [], media: [], social: [], creative: [], asset: [], page: [], video: [] };
try {
  const [campaign, other, foreign] = await db.insert(campaignsTable).values([
    { workspaceId, title: `${marker} primary` }, { workspaceId, title: `${marker} other` }, { workspaceId: foreignWorkspaceId, title: `${marker} foreign` },
  ]).returning({ id: campaignsTable.id });
  campaignIds.push(campaign!.id, other!.id, foreign!.id);
  const at = new Date("2025-02-01T00:00:00.000Z");
  const content = await db.insert(contentPiecesTable).values([
    { workspaceId, campaignId: campaign!.id, type: "social_post", status: "draft", title: `${marker} text`, content: { body: `${marker} safe`, accessToken: "SECRET", signedUrl: "https://safe.invalid/a?sig=bad#fragment", huge: "x".repeat(40_000), nested: { password: "nope" } }, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "ad_copy", status: "approved", title: `${marker} ad`, content: { headline: "hello" }, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} empty`, content: {}, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} json-object-empty`, content: "{}" as any, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} json-array-empty`, content: "[]" as any, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} json-null-empty`, content: " null " as any, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} whitespace-empty`, content: "   " as any, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} nested-empty`, content: { nested: { values: [] } }, createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, type: "email_sequence", status: "draft", title: `${marker} real-script`, content: "real nonempty script", createdAt: at, updatedAt: at },
  ]).returning({ id: contentPiecesTable.id });
  sourceIds.content.push(...content.map(x => x.id));
  const [media] = await db.insert(mediaBriefsTable).values({ workspaceId, campaignId: campaign!.id, mediaType: "image", conceptStatus: "pending_concept", conceptData: {}, createdAt: at, updatedAt: at }).returning({ id: mediaBriefsTable.id });
  sourceIds.media.push(media!.id);
  const social = await db.insert(socialPostsTable).values([
    { workspaceId, campaignId: campaign!.id, integrationId: fixtures.integrations[0]!, platform: "instagram", postType: "text", status: "draft", caption: `${marker} social`, mediaUrls: [], createdAt: at, updatedAt: at },
    { workspaceId, campaignId: campaign!.id, integrationId: fixtures.integrations[0]!, platform: "instagram", postType: "reel", status: "published", caption: `${marker} reel`, mediaUrls: ["https://user:pass@cdn.invalid/x?token=secret#x", "javascript:alert(1)", "/app/preview?secret=1"], createdAt: at, updatedAt: at },
  ]).returning({ id: socialPostsTable.id });
  sourceIds.social.push(...social.map(x => x.id));
  const [creative] = await db.insert(campaignCreativesTable).values({ workspaceId, campaignId: campaign!.id, format: "feed_square", platform: "instagram", status: "preview_ready", requestNote: `${marker} creative`, concept: null, createdAt: at, updatedAt: at }).returning({ id: campaignCreativesTable.id });
  sourceIds.creative.push(creative!.id);
  const [asset] = await db.insert(campaignAssetsTable).values({ campaignId: campaign!.id, assetType: "copy", status: "draft", title: `${marker} asset`, content: null, metadata: { only: "metadata" }, createdAt: at, updatedAt: at }).returning({ id: campaignAssetsTable.id });
  sourceIds.asset.push(asset!.id);
  const [page] = await db.insert(pagesTable).values({ workspaceId, campaignId: campaign!.id, type: "landing", title: `${marker} page`, slug: `${marker.toLowerCase()}-page`, status: "draft", metadata: { only: "metadata" }, html: null, createdAt: at, updatedAt: at }).returning({ id: pagesTable.id });
  sourceIds.page.push(page!.id);
  const [video] = await db.insert(videoProjectsTable).values({ workspaceId, campaignId: campaign!.id, title: `${marker} video`, format: "vsl", status: "script_ready", createdAt: at, updatedAt: at }).returning({ id: videoProjectsTable.id });
  sourceIds.video.push(video!.id);
  const app = express(); app.use("/campaigns", campaignsRouter); server = http.createServer(app);
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (id = campaign!.id, query = "") => {
    const response = await fetch(`${base}/campaigns/${id}/control-room/previews${query}`, { headers: { authorization: `Bearer ${token}` } });
    const text = await response.text(); let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 5000) }; }
    return { response, json };
  };
  const before = await Promise.all([db.select({ id: contentPiecesTable.id }).from(contentPiecesTable).where(inArray(contentPiecesTable.id, sourceIds.content)), db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(inArray(socialPostsTable.id, sourceIds.social))]);
  const ids: string[] = []; let cursor = "";
  for (let i = 0; i < 6; i++) {
    const pageResult = await get(campaign!.id, `?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(pageResult.response.status, 200, JSON.stringify(pageResult.json)); ids.push(...pageResult.json.records.map((r: any) => r.source.id)); cursor = pageResult.json.pageInfo.nextCursor ?? "";
    if (!pageResult.json.pageInfo.hasNextPage) break;
  }
  assert.equal(new Set(ids).size, 16); assert.equal(ids.length, 16);
  const all = (await get()).json.records;
  assert.deepEqual(new Set(all.map((r: any) => r.source.kind)), new Set(["content_piece", "media_brief", "creative", "social_post", "campaign_asset", "page", "video_project"]));
  assert.equal(all.find((r: any) => r.source.kind === "social_post").sourceLink, `/campaigns/${campaign!.id}/content`);
  const safe = all.find((r: any) => r.source.kind === "content_piece" && r.source.title.endsWith("text"));
  assert.equal(safe.preview.content.content.accessToken, undefined); assert.equal(safe.preview.content.content.nested.password, undefined);
  assert.equal(safe.preview.content.content.signedUrl, undefined); assert.ok(JSON.stringify(safe).length < 40_000);
  const reel = all.find((r: any) => r.source.type === "reel");
  assert.deepEqual(reel.preview.content.mediaUrls, ["https://cdn.invalid/x", "/app/preview"]);
  assert.equal(all.find((r: any) => r.source.title.endsWith("empty")).preview.state, "unavailable");
  for (const suffix of ["json-object-empty", "json-array-empty", "json-null-empty", "whitespace-empty", "nested-empty"]) {
    assert.equal(all.find((r: any) => r.source.title.endsWith(suffix)).preview.state, "unavailable");
  }
  assert.equal(all.find((r: any) => r.source.title.endsWith("real-script")).preview.state, "ready");
  assert.equal(all.find((r: any) => r.source.kind === "creative").preview.state, "unavailable");
  assert.equal(all.find((r: any) => r.source.kind === "campaign_asset").preview.state, "unavailable");
  assert.equal(all.find((r: any) => r.source.kind === "page").preview.state, "unavailable");
  assert.equal(all.find((r: any) => r.source.kind === "video_project").preview.state, "unavailable");
  const combined = await get(campaign!.id, "?kind=social_post&status=draft"); assert.equal(combined.response.status, 200, JSON.stringify(combined.json)); assert.equal(combined.json.records.length, 1);
  assert.equal((await get(campaign!.id, "?updatedFrom=2025-02-01T00%3A00%3A00.000Z&updatedTo=2025-02-01T00%3A00%3A00.001Z")).json.total, 16);
  const first = await get(campaign!.id, "?limit=2"); const valid = first.json.pageInfo.nextCursor;
  for (const q of [`?cursor=${valid}x`, `?cursor=${encodeURIComponent(valid)}&limit=3`, `?cursor=${encodeURIComponent(valid)}&kind=page`, `?limit=2&cursor=${encodeURIComponent(valid)}&status=draft`, "?limit=0", "?limit=51", "?limit=nope", "?kind=nope", "?unknown=x", "?kind=social_post&kind=page", "?limit[]=2"]) assert.equal((await get(campaign!.id, q)).response.status, 400);
  assert.equal((await get(foreign!.id)).response.status, 404); assert.equal((await get("00000000-0000-0000-0000-000000000000")).response.status, 404);
  const after = await Promise.all([db.select({ id: contentPiecesTable.id }).from(contentPiecesTable).where(inArray(contentPiecesTable.id, sourceIds.content)), db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(inArray(socialPostsTable.id, sourceIds.social))]);
  assert.deepEqual(after, before);
  console.log("campaign control room previews pagination, ownership, filters, sanitization and read-only tests passed");
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(err => err ? reject(err) : resolve()));
  await db.delete(videoProjectsTable).where(inArray(videoProjectsTable.id, sourceIds.video));
  await db.delete(pagesTable).where(inArray(pagesTable.id, sourceIds.page));
  await db.delete(campaignAssetsTable).where(inArray(campaignAssetsTable.id, sourceIds.asset));
  await db.delete(campaignCreativesTable).where(inArray(campaignCreativesTable.id, sourceIds.creative));
  await db.delete(socialPostsTable).where(inArray(socialPostsTable.id, sourceIds.social));
  await db.delete(mediaBriefsTable).where(inArray(mediaBriefsTable.id, sourceIds.media));
  await db.delete(contentPiecesTable).where(inArray(contentPiecesTable.id, sourceIds.content));
  if (campaignIds.length) await db.delete(campaignsTable).where(inArray(campaignsTable.id, campaignIds));
  await cleanupE2eFixtures(fixtures); await pool.end();
}