import assert from "node:assert/strict";
import { KairogenError, KairogenMcp, generationParameters, generationResult, submitKairogen, toolPayload, supplierError } from "../modules/creatives/kairogen-provider.js";
import { executeImageProviderChain } from "../modules/creatives/image-provider-chain.js";
import type { Logger } from "pino";

const imageModel = { model_key: "nano-banana-2", type: "image", default_mode: "base", param_schema: [
  { key: "resolution", options: [{ value: "1k" }, { value: "2k" }] },
] };
const videoModel = { model_key: "wan-2-6", type: "video", default_mode: "base", modes: {
  base: { resolved_mode: "text-to-video" }, "image-to-video": { resolved_mode: "image-to-video" },
}, param_schema: [
  { key: "duration", options: [{ value: 5 }, { value: 10 }] },
  { key: "size", modes: ["base"], options: [{ value: "1280*720" }, { value: "1920*1080" }] },
  { key: "resolution", modes: ["image-to-video"], options: [{ value: "720p" }, { value: "1080p" }] },
  { key: "first_frame", modes: ["image-to-video"] },
], reference_inputs: [{ param_key: "first_frame", role: "first_frame", modes: ["image-to-video"] }] };
const request = { kind: "image" as const, prompt: "fixture", aspectRatio: "1:1", quality: "standard" as const };
function fixture(options: { balance?: number; cost?: number; active?: number; failure?: unknown; response?: Record<string, unknown> } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return { calls, async call(name: string, args: Record<string, unknown> = {}) {
    calls.push({ name, args });
    if (name === "get_me_context") return { plan: { planKey: "free", maxConcurrentGenerations: 1 }, active: { activeGenerations: options.active ?? 0 } };
    if (name === "get_credits") return { credits_remaining: options.balance ?? 20 };
    if (name === "list_models") return { models: [imageModel, videoModel] };
    if (name === "estimate_cost") return { credit_cost: options.cost ?? 5 };
    if (options.failure) throw options.failure;
    return options.response ?? { generation_id: "fixture-job", status: "pending" };
  } };
}

for (const options of [{ balance: 0 }, { balance: 3, cost: 5 }, { active: 1 }, { cost: Number.NaN }]) {
  const client = fixture(options);
  await assert.rejects(submitKairogen(client, request, "nano-banana-2"), error => error instanceof KairogenError && error.fallbackAllowed);
  assert.equal(client.calls.some(call => call.name.startsWith("generate_")), false, "no debit with insufficient balance/capacity or invalid quote");
}
const normal = fixture();
assert.deepEqual(await submitKairogen(normal, request, "nano-banana-2"), { status: "submitted", generationId: "fixture-job" });
const quote = normal.calls.find(call => call.name === "estimate_cost")!.args;
const submission = normal.calls.find(call => call.name === "generate_image")!.args;
const { plan_key, ...quotedParameters } = quote;
const { prompt, expected_credits, wait_for_completion, ...submittedParameters } = submission;
assert.deepEqual(quotedParameters, submittedParameters);
assert.equal(expected_credits, 5);
assert.equal(wait_for_completion, false);
assert.equal(plan_key, "free");
assert.equal(normal.calls.filter(call => call.name === "generate_image").length, 1);

const videoRequest = { kind: "video" as const, prompt: "fixture", aspectRatio: "9:16", durationSeconds: 5, resolution: "1080p" };
assert.deepEqual(generationParameters(videoRequest, videoModel).extra_params, { _mode: "base", duration: 5, size: "1920*1080" });
assert.deepEqual(generationParameters({ ...videoRequest, imageUrl: "https://example.com/start.png" }, videoModel).extra_params,
  { _mode: "image-to-video", duration: 5, resolution: "1080p", first_frame: "https://example.com/start.png" });
assert.throws(() => generationParameters({ ...videoRequest, durationSeconds: 7 }, videoModel), { code: "KAIROGEN_UNSUPPORTED_PARAMETERS" });
assert.deepEqual(toolPayload({ content: [{ type: "text", text: '{"credit_cost":4}' }] }), { credit_cost: 4 });
assert.deepEqual(generationResult({ generation: { id: "job", status: "completed", outputs: [{ url: "https://cdn.kairogen.ai/movie.mp4" }] } }, "video"),
  { status: "ready", generationId: "job", url: "https://cdn.kairogen.ai/movie.mp4" });
assert.equal(generationResult({ status: "failed", video_url: "https://cdn.kairogen.ai/old.mp4" }, "video", "job").status, "failed");
assert.equal(generationResult({ status: "processing", video_url: "https://cdn.kairogen.ai/old.mp4" }, "video", "job").status, "processing");
assert.throws(() => generationResult({ status: "pending" }, "image"), { code: "KAIROGEN_OUTCOME_UNKNOWN" });
assert.equal(supplierError({ error: "insufficient_credits" }, true).fallbackAllowed, true);
assert.equal(supplierError({ error: "content_policy_violation" }, true).fallbackAllowed, false);
assert.equal(supplierError({ error: "unknown" }, true).fallbackAllowed, false);

// Exercise the real MCP transport: rejected auth can retry once; uncertain mutations cannot.
let generates = 0, refreshes = 0;
const rpcClient = new KairogenMcp({ token: async () => "fixture-token", refresh: async () => { refreshes++; return "fixture-new"; } }, async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  if (body.method === "initialize") return Response.json({ id: body.id, result: { protocolVersion: "2025-06-18" } }, { headers: { "mcp-session-id": "fixture-session" } });
  assert.equal(new Headers(init?.headers).get("Mcp-Session-Id"), "fixture-session");
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (body.params.name === "get_credits") {
    if (new Headers(init?.headers).get("Authorization") === "Bearer fixture-token") return new Response(null, { status: 401 });
    return Response.json({ id: body.id, result: { content: [{ type: "text", text: '{"credits_remaining":20}' }] } });
  }
  generates++;
  throw new Error("upstream lost after submission");
});
await rpcClient.connect();
assert.equal((await rpcClient.call("get_credits")).credits_remaining, 20);
assert.equal(refreshes, 1);
await assert.rejects(rpcClient.call("generate_image", { model: "fixture", prompt: "fixture" }), { code: "KAIROGEN_OUTCOME_UNKNOWN", fallbackAllowed: false });
assert.equal(generates, 1);
await assert.rejects(rpcClient.call("change_plan"), { code: "KAIROGEN_TOOL_FORBIDDEN" });

const blockedClient = new KairogenMcp({ token: async () => "fixture", refresh: async () => "fixture" }, async () =>
  Response.json({ error: { code: "content_policy_violation" } }, { status: 400 }));
await assert.rejects(blockedClient.call("generate_image", {}), { code: "IMAGE_SAFETY_BLOCKED", fallbackAllowed: false });

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=";
const log = { info() {}, warn() {} } as unknown as Logger;
let fallbacks = 0;
const next = { provider: "openai", model: "fixture", run: async () => { fallbacks++; return png; } };
assert.equal(await executeImageProviderChain([
  { provider: "kairogen", model: "fixture", run: async () => { throw new KairogenError("KAIROGEN_INSUFFICIENT_CREDITS", true); } }, next,
], log), png);
assert.equal(fallbacks, 1);
await assert.rejects(executeImageProviderChain([
  { provider: "kairogen", model: "fixture", run: async () => { throw new KairogenError("KAIROGEN_PENDING_OR_FAILED", false, "job"); } }, next,
], log), { code: "KAIROGEN_PENDING_OR_FAILED" });
assert.equal(fallbacks, 1, "accepted jobs must never create another paid generation through fallback");
console.log("PASS Kairogen: quote/balance/capacity, exact pricing parameters, async status, OAuth 401 refresh, no uncertain retry, primary/fallback and no billing tools (offline)");
