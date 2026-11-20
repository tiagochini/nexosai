import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, paidMediaAccountsTable, workspaceIntegrationsTable } from "@workspace/db";
import { paidMediaProvider } from "../modules/paid-media/providers.js";

const select = db.select, originalFetch = globalThis.fetch;
const dialect = new PgDialect();
const adapter = paidMediaProvider("tiktok_ads");
let requests: { url: URL; method: string; body: any }[] = [];
let failMutation = false, malformedMutation = false, accountMissing = false;
try {
  db.select = (() => ({ from: (table: unknown) => ({ where: (condition: any) => {
    const query = dialect.sqlToQuery(condition);
    assert.ok(query.params.includes("workspace"), "every credential and account query is workspace-scoped");
    const rows = table === paidMediaAccountsTable
      ? accountMissing ? [] : [{ id: "account", providerAccountId: "advertiser", integrationId: "integration", isSelected: true }]
      : table === workspaceIntegrationsTable ? [{ integrationId: "integration", accessToken: "never-log-this-token", refreshToken: null, expiresAt: null, metadata: { integrationPurpose: "paid_media", authorizedAdvertiserIds: ["advertiser"] } }] : [];
    return { limit: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
  } }) })) as any;
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit) => {
    const url = new URL(String(input)), method = init.method!;
    const body = init.body ? JSON.parse(String(init.body)) : {};
    requests.push({ url, method, body });
    assert.equal(url.hostname, "business-api.tiktok.com");
    assert.equal((init.headers as Record<string, string>)["Access-Token"], "never-log-this-token");
    if (failMutation && method === "POST") throw new Error("timeout");
    if (malformedMutation && method === "POST") return new Response("{}", { status: 200 });
    if (url.pathname.endsWith("/campaign/create/")) {
      assert.equal(body.advertiser_id, "advertiser");
      assert.equal(body.operation_status, "DISABLE");
      return new Response(JSON.stringify({ code: 0, request_id: "req", data: { campaign_id: "campaign" } }));
    }
    if (url.pathname.endsWith("/campaign/get/")) return new Response(JSON.stringify({ code: 0, data: { list: [{ campaign_id: "campaign", operation_status: "DISABLE" }] } }));
    if (url.pathname.endsWith("/pixel/list/")) return new Response(JSON.stringify({ code: 0, request_id: "pixel-req", data: { pixels: [{ pixel_id: "pixel-id", pixel_code: "pixel-code", pixel_name: "Pixel" }] } }));
    if (url.pathname.endsWith("/campaign/status/update/")) { assert.equal(body.operation_status, "DELETE"); return new Response(JSON.stringify({ code: 0, data: {} })); }
    if (url.pathname.endsWith("/file/video/ad/upload/")) { assert.equal(body.upload_type, "UPLOAD_BY_URL"); assert.equal(body.auto_fix_enabled, false); return new Response(JSON.stringify({ code: 0, request_id: "upload-req", data: [{ video_id: "video-id" }] })); }
    if (url.pathname.endsWith("/file/video/ad/info/")) return new Response(JSON.stringify({ code: 0, data: { list: [{ video_id: "video-id" }] } }));
    throw new Error(`Unexpected request ${url.pathname}`);
  }) as typeof fetch;
  const created = await adapter.createLaunchEntity!("workspace", "account", "campaign", { campaign_name: "Campaign", operation_status: "ENABLE" }, "key");
  assert.equal(created.providerEntityId, "campaign");
  assert.ok(!JSON.stringify(created).includes("never-log-this-token"));
  const readback = await adapter.readLaunchEntity!("workspace", "account", "campaign", "campaign");
  assert.equal(readback.data.operation_status, "DISABLE");
  assert.equal(requests.at(-1)!.method, "GET");
  assert.deepEqual(JSON.parse(requests.at(-1)!.url.searchParams.get("filtering")!), { campaign_ids: ["campaign"] });
  const diagnostic = await adapter.diagnoseDataset!("workspace", "account", "pixel-code");
  assert.equal(diagnostic.accessible, true);
  assert.equal(diagnostic.installationVerified, false);
  assert.equal((await adapter.diagnoseDataset!("workspace", "account", "missing")).accessible, false);
  await adapter.deleteEntity!("workspace", "account", "campaign", "rollback", "campaign");
  const upload = await adapter.uploadAdVideo!("workspace", "account", "https://example.test/video.mp4?signature=private");
  assert.equal(upload.videoId, "video-id");
  assert.equal(upload.verified, true);
  assert.ok(!JSON.stringify(upload).includes("private"));
  const beforeInvalid = requests.length;
  await assert.rejects(adapter.uploadAdVideo!("workspace", "account", "https://127.0.0.1/video"));
  await assert.rejects(adapter.uploadAdVideo!("workspace", "account", "http://example.test/video"));
  assert.equal(requests.length, beforeInvalid);
  failMutation = true;
  const beforeFailure = requests.length;
  await assert.rejects(adapter.createLaunchEntity!("workspace", "account", "campaign", { campaign_name: "Campaign" }, "key"));
  assert.equal(requests.length - beforeFailure, 1, "ambiguous creation is never retried by transport");
  assert.equal(await adapter.reconcileLaunchEntity!("workspace", "account", "campaign", {}, "key"), undefined, "ambiguous creation requires recovery rather than a duplicate create");
  failMutation = false;
  malformedMutation = true;
  await assert.rejects(adapter.createLaunchEntity!("workspace", "account", "campaign", {}, "key"), (error: any) => error.status === 502, "malformed success must preserve the durable mutation intent");
  accountMissing = true;
  const beforeScope = requests.length;
  await assert.rejects(adapter.createLaunchEntity!("workspace", "other-account", "campaign", {}, "key"));
  assert.equal(requests.length, beforeScope, "foreign account never reaches TikTok");
  console.log("TikTok adapter: scoped credentials, paused creation, native GET, pixel diagnostics, compensation and no retry on ambiguous create passed.");
} finally { db.select = select; globalThis.fetch = originalFetch; }
