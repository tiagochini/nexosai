import assert from "node:assert/strict";
import Redis from "ioredis";
import { decryptIntegrationToken } from "@workspace/db/token-crypto";
import type { Logger } from "pino";
import { env } from "../lib/env.js";
import { generateCreativeImage } from "../modules/creatives/image-provider-chain.js";
import { generateVideoClip, getAvailableVideoProvider, pollVideoJob } from "../modules/video-production/video-generation.service.js";

const original = { fetch: globalThis.fetch, get: Redis.prototype.get, set: Redis.prototype.set, eval: Redis.prototype.eval, env: { ...env } };
const originalCryptoKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=";
const log = { info() {}, warn() {} } as unknown as Logger;
let balance = 20, cost = 5, loseSubmit = false;
const calls: string[] = [];
const records = new Map<string, string>();
try {
  Object.assign(env, { KAIROGEN_ENABLED: true, KAIROGEN_ACCESS_TOKEN: "fixture-kairogen", KAIROGEN_REFRESH_TOKEN: "", KAIROGEN_TOKEN_EXPIRES_AT: "", DRY_RUN_MODE: false,
    OPENAI_API_KEY: "fixture-openai", RUNWAY_API_KEY: "fixture-runway", GEMINI_API_KEY: "", FAL_API_KEY: "", AI_INTEGRATIONS_OPENAI_API_KEY: "" });
  Redis.prototype.get = (async (key: string) => records.get(key) ?? null) as unknown as typeof Redis.prototype.get;
  Redis.prototype.set = (async (key: string, value: string, ...args: unknown[]) => {
    if (args.includes("NX") && records.has(key)) return null;
    records.set(key, value); return "OK";
  }) as unknown as typeof Redis.prototype.set;
  Redis.prototype.eval = (async (_script: string, _count: number, key: string) => { records.delete(key); return 1; }) as unknown as typeof Redis.prototype.eval;
  globalThis.fetch = (async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://api.kairogen.ai/oauth/token") {
      calls.push("oauth-refresh");
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get("grant_type"), "refresh_token");
      assert.equal(form.get("refresh_token"), "fixture-refresh");
      return Response.json({ access_token: "fixture-new", refresh_token: "fixture-rotated", expires_in: 3600 });
    }
    if (url === "https://mcp.kairogen.ai/mcp") {
      assert.ok(["Bearer fixture-kairogen", "Bearer fixture-new"].includes(new Headers(init?.headers).get("Authorization")!));
      const message = JSON.parse(String(init?.body));
      const name = message.params?.name ?? message.method;
      calls.push(name);
      if (name === "notifications/initialized") return new Response(null, { status: 202 });
      const reply = (data: object) => Response.json({ id: message.id, result: name === "initialize" ? data : { content: [{ type: "text", text: JSON.stringify(data) }] } });
      if (name === "initialize") return reply({ protocolVersion: "2025-06-18" });
      if (name === "get_me_context") return reply({ plan: { planKey: "free", maxConcurrentGenerations: 1 }, active: { activeGenerations: 0 } });
      if (name === "get_credits") return reply({ credits_remaining: balance });
      if (name === "list_models") return reply({ models: [
        { model_key: "nano-banana-2", type: "image", param_schema: [{ key: "resolution" }] },
        { model_key: "wan-2-6", type: "video", param_schema: [{ key: "duration" }, { key: "size" }] },
      ] });
      if (name === "estimate_cost") return reply({ credit_cost: cost });
      if (name.startsWith("generate_")) {
        if (loseSubmit) throw new Error("fixture connection lost");
        if (name === "generate_image") return reply({ generation_id: "image-job", status: "completed", image_url: "https://cdn.kairogen.ai/image.png" });
        return reply({ generation_id: "video-job", status: "pending" });
      }
      if (name === "get_generation") return reply({ generation_id: "video-job", status: "completed", video_url: "https://cdn.kairogen.ai/movie.mp4" });
    }
    if (url === "https://cdn.kairogen.ai/image.png") {
      assert.equal(new Headers(init?.headers).has("Authorization"), false, "no supplier credentials on media downloads");
      return new Response(Buffer.from(png, "base64"), { headers: { "content-type": "image/png" } });
    }
    if (url === "https://api.openai.com/v1/images/generations") { calls.push("openai"); return Response.json({ data: [{ b64_json: png }] }); }
    if (url === "https://api.dev.runwayml.com/v1/image_to_video") { calls.push("runway"); return Response.json({ id: "runway-job" }); }
    throw new Error("Unexpected network target blocked by test");
  }) as typeof fetch;

  assert.equal(getAvailableVideoProvider(), "kairogen");
  assert.equal(await generateCreativeImage("fixture", "stories", "standard", log), `data:image/png;base64,${png}`);
  assert.equal(calls.includes("openai"), false, "funded KAIROGEN must be primary");
  calls.length = 0;
  balance = 2;
  assert.equal(await generateCreativeImage("fixture", "stories", "standard", log), `data:image/png;base64,${png}`);
  assert.equal(calls.includes("generate_image"), false, "positive but insufficient balance must not submit");
  assert.equal(calls.at(-1), "openai");
  const request = { prompt: "fixture", durationSeconds: 5, aspectRatio: "9:16" as const, resolution: "720p" as const };
  calls.length = 0;
  assert.equal((await generateVideoClip(request)).provider, "runway");
  assert.equal(calls.includes("generate_video"), false);
  balance = 20; cost = 5; loseSubmit = false;
  Object.assign(env, { KAIROGEN_TOKEN_EXPIRES_AT: "1", KAIROGEN_REFRESH_TOKEN: "fixture-refresh", KAIROGEN_CLIENT_ID: "fixture-client" });
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  calls.length = 0;
  assert.equal((await generateVideoClip(request)).provider, "kairogen");
  assert.equal(calls.filter(name => name === "oauth-refresh").length, 1);
  const saved = [...records.entries()].find(([key]) => key.endsWith(":oauth"))![1];
  assert.ok(saved.startsWith("nexosenc:v1:"));
  assert.equal(saved.includes("fixture-rotated"), false);
  assert.equal(JSON.parse(decryptIntegrationToken(saved)).refresh_token, "fixture-rotated");
  calls.length = 0;
  assert.equal((await generateVideoClip(request)).provider, "kairogen");
  assert.equal(calls.includes("oauth-refresh"), false, "reuse persisted rotated token instead of stale env seed");
  balance = 20;
  calls.length = 0;
  const accepted = await generateVideoClip(request);
  assert.equal(accepted.provider, "kairogen");
  assert.equal(accepted.jobId, "video-job");
  assert.equal(accepted.status, "submitted");
  assert.equal(calls.includes("runway"), false);
  assert.equal((await pollVideoJob("video-job", "kairogen")).clipUrl, "https://cdn.kairogen.ai/movie.mp4");
  loseSubmit = true;
  calls.length = 0;
  assert.equal((await generateVideoClip(request)).provider, "kairogen");
  assert.equal(calls.includes("runway"), false, "unknown submission outcome cannot fall through");
  cost = 100;
  calls.length = 0;
  assert.equal((await generateVideoClip(request)).provider, "runway");
  assert.equal(calls.includes("generate_video"), false);
  console.log("PASS Kairogen real adapter routing: funded primary image/video, insufficient-positive-balance fallback, CDN without tokens, polling and uncertain submission (offline)");
} finally {
  globalThis.fetch = original.fetch;
  Redis.prototype.get = original.get;
  Redis.prototype.set = original.set;
  Redis.prototype.eval = original.eval;
  Object.assign(env, original.env);
  if (originalCryptoKey === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalCryptoKey;
}
