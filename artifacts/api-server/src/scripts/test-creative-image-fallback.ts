import assert from "node:assert/strict";
import { executeImageProviderChain, imageFromGeminiResponse, generateCreativeImage } from "../modules/creatives/image-provider-chain.js";
import { env } from "../lib/env.js";
import type { Logger } from "pino";

const log = { info() {}, warn() {} } as unknown as Logger;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=";
const image = `data:image/png;base64,${png}`;
for (const failure of [
  Object.assign(new Error("No credits remaining"), { status: 429 }),
  Object.assign(new Error("Unavailable"), { status: 503 }),
  Object.assign(new Error("Timeout"), { name: "AbortError" }),
]) {
  const invoked: string[] = [];
  assert.equal(await executeImageProviderChain([
    { provider: "openai", model: "gpt-image-1", run: async () => { invoked.push("openai"); throw failure; } },
    { provider: "gemini", model: "gemini-2.5-flash-image", run: async () => { invoked.push("gemini"); return image; } },
    { provider: "unused", model: "unused", run: async () => { throw new Error("Must stop on image"); } },
  ], log), image);
  assert.deepEqual(invoked, ["openai", "gemini"]);
}
assert.equal(await executeImageProviderChain([
  { provider: "openai", model: "image", run: async () => "only text" },
  { provider: "gemini", model: "image", run: async () => image },
], log), image);
await assert.rejects(executeImageProviderChain([], log), { code: "IMAGE_PROVIDERS_FAILED" });
await assert.rejects(executeImageProviderChain([
  { provider: "openai", model: "image", run: async () => { throw new Error("private upstream error"); } },
  { provider: "gemini", model: "image", run: async () => "data:image/svg+xml;base64,PHN2Zy8+" },
], log), error => {
  assert.equal((error as { code: string }).code, "IMAGE_PROVIDERS_FAILED");
  assert.doesNotMatch(String(error), /private upstream/);
  return true;
});
await assert.rejects(executeImageProviderChain([
  { provider: "openai", model: "image", run: async () => { throw Object.assign(new Error("blocked"), { code: "content_policy_violation" }); } },
  { provider: "gemini", model: "image", run: async () => { throw new Error("Refusal cannot fall back"); } },
], log), { code: "IMAGE_SAFETY_BLOCKED" });
assert.equal(imageFromGeminiResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] }), image);
assert.equal(imageFromGeminiResponse({ candidates: [{ content: { parts: [] } }] }), "");
assert.throws(() => imageFromGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }), { code: "IMAGE_SAFETY_BLOCKED" });
// Exercise both production HTTP adapters with injected responses, no network.
const originalFetch = globalThis.fetch;
const previous = { openai: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY, integration: env.AI_INTEGRATIONS_OPENAI_API_KEY };
try {
  Object.assign(env, { OPENAI_API_KEY: "test-openai", GEMINI_API_KEY: "test-gemini", AI_INTEGRATIONS_OPENAI_API_KEY: "" });
  const calls: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://api.openai.com/v1/images/generations") {
      calls.push("openai");
      return new Response(JSON.stringify({ error: { message: "No credits remaining", code: "insufficient_quota" } }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      calls.push("gemini");
      assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-gemini");
      assert.equal(new URL(url).searchParams.has("key"), false);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.generationConfig.imageConfig.aspectRatio, "2:3");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] }), { status: 200 });
    }
    throw new Error("Unexpected network target blocked by test");
  }) as typeof fetch;
  assert.equal(await generateCreativeImage("Test fixture", "stories", "standard", log), image);
  assert.deepEqual(calls, ["openai", "gemini"], "quota must switch without repeating paid attempts");
} finally {
  globalThis.fetch = originalFetch;
  Object.assign(env, { OPENAI_API_KEY: previous.openai, GEMINI_API_KEY: previous.gemini, AI_INTEGRATIONS_OPENAI_API_KEY: previous.integration });
}
console.log("PASS creative image fallback: quota, unavailable, timeout, empty image, all failed, safe logs, refusal and Gemini decoding (offline)");
