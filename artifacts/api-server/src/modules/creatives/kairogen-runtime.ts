import { createHash, randomUUID } from "node:crypto";
import Redis from "ioredis";
import { encryptIntegrationToken, decryptIntegrationToken, validateIntegrationEncryptionConfig } from "@workspace/db/token-crypto";
import { env } from "../../lib/env.js";
import { redisConnectionOptions } from "../../lib/redis-connection.js";
import { logger } from "../../lib/logger.js";
import { KairogenError, KairogenMcp, generationResult, submitKairogen, type Generation, type KairogenRequest } from "./kairogen-provider.js";

let redis: Redis | undefined;
function store(): Redis {
  if (!redis) {
    redis = new Redis({ ...redisConnectionOptions("producer"), enableOfflineQueue: true });
    redis.on("error", () => { /* callers handle errors without logging connection secrets */ });
  }
  return redis;
}
function prefix(): string {
  const seed = createHash("sha256").update(env.KAIROGEN_CLIENT_ID + env.KAIROGEN_ACCESS_TOKEN + env.KAIROGEN_REFRESH_TOKEN).digest("hex").slice(0, 24);
  return `${process.env.QUEUE_PREFIX || "nexos"}:kairogen:${seed}`;
}
export function kairogenConfigured(): boolean {
  return env.KAIROGEN_ENABLED && Boolean(env.KAIROGEN_ACCESS_TOKEN || (env.KAIROGEN_REFRESH_TOKEN && env.KAIROGEN_CLIENT_ID));
}
type Credentials = { access_token: string; refresh_token: string; expires_at: number };
async function credentials(): Promise<Credentials> {
  const saved = await store().get(`${prefix()}:oauth`);
  if (saved) {
    try { return JSON.parse(decryptIntegrationToken(saved)) as Credentials; }
    catch { throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true); }
  }
  return { access_token: env.KAIROGEN_ACCESS_TOKEN, refresh_token: env.KAIROGEN_REFRESH_TOKEN, expires_at: Number(env.KAIROGEN_TOKEN_EXPIRES_AT) || 0 };
}
async function lock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const owner = randomUUID();
  if (await store().set(key, owner, "PX", 300000, "NX") !== "OK") throw new KairogenError("KAIROGEN_BUSY", true);
  try { return await run(); }
  finally {
    await store().eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, key, owner).catch(() => {});
  }
}
async function refreshAccess(): Promise<string> {
  return lock(`${prefix()}:oauth-lock`, async () => {
    const previous = await credentials();
    if (!previous.refresh_token || !env.KAIROGEN_CLIENT_ID) throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true);
    // Validate before rotating a refresh token, so a missing key cannot lose its replacement.
    try { validateIntegrationEncryptionConfig(); } catch { throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true); }
    let response: Response;
    try {
      response = await fetch("https://api.kairogen.ai/oauth/token", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: previous.refresh_token, client_id: env.KAIROGEN_CLIENT_ID }).toString(),
      });
    } catch { throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true); }
    if (!response.ok) { await response.body?.cancel(); throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true); }
    const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true);
    const next: Credentials = {
      access_token: data.access_token, refresh_token: data.refresh_token || previous.refresh_token,
      expires_at: Date.now() + Math.max(30, Number(data.expires_in) || 3600) * 1000,
    };
    // Rotation survives API restarts without storing a refresh token in plaintext Redis.
    await store().set(`${prefix()}:oauth`, encryptIntegrationToken(JSON.stringify(next)));
    return next.access_token;
  });
}
async function client(): Promise<KairogenMcp> {
  const connection = new KairogenMcp({ token: async () => {
    const current = await credentials();
    return current.expires_at && current.expires_at < Date.now() + 30000 ? refreshAccess() : current.access_token;
  }, refresh: refreshAccess });
  await connection.connect();
  return connection;
}
export function kairogenCanFallback(error: unknown): boolean {
  return error instanceof KairogenError && error.fallbackAllowed;
}

export async function generateKairogen(request: KairogenRequest): Promise<Generation> {
  if (!kairogenConfigured()) throw new KairogenError("KAIROGEN_NOT_CONFIGURED", true);
  if (env.DRY_RUN_MODE) throw new KairogenError("KAIROGEN_DRY_RUN", true);
  let submitted = false;
  try {
    return await lock(`${prefix()}:submission`, async () => {
      const connection = await client();
      const result = await submitKairogen(connection, request, request.kind === "image" ? env.KAIROGEN_IMAGE_MODEL : env.KAIROGEN_VIDEO_MODEL);
      submitted = true;
      if (result.url && !allowedMediaHost(new URL(result.url).hostname)) throw new KairogenError("KAIROGEN_OUTPUT_UNAVAILABLE", false, result.generationId);
      if (result.generationId) {
        // Durable recovery reference; no prompt or customer data in this shared supplier record.
        await store().set(`${prefix()}:job:${result.generationId}`, JSON.stringify({ kind: request.kind, createdAt: new Date().toISOString() }), "EX", 604800).catch(() => {});
      }
      logger.info({ provider: "kairogen", kind: request.kind, generationId: result.generationId, status: result.status }, "Kairogen generation accepted");
      return result;
    });
  } catch (error) {
    if (error instanceof KairogenError) throw error;
    throw new KairogenError(submitted ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_UNAVAILABLE", !submitted);
  }
}

export async function pollKairogen(generationId: string, kind: "image" | "video"): Promise<Generation> {
  try {
    const connection = await client();
    const result = generationResult(await connection.call("get_generation", { generation_id: generationId, wait_for_completion: false }), kind, generationId);
    if (result.url && !allowedMediaHost(new URL(result.url).hostname)) return { status: "failed", generationId };
    return result;
  } catch (error) {
    if (error instanceof KairogenError && error.code === "IMAGE_SAFETY_BLOCKED") throw error;
    // A transient poll/auth failure must not turn an accepted job into a new paid attempt.
    return { status: "processing", generationId };
  }
}

export async function generateKairogenImage(prompt: string, aspectRatio: string, quality: "standard" | "hd"): Promise<string> {
  let result = await generateKairogen({ kind: "image", prompt, aspectRatio, quality });
  const deadline = Date.now() + 240000;
  while (result.status !== "ready" && result.status !== "failed" && result.generationId && Date.now() < deadline) {
    await new Promise(done => setTimeout(done, 4000));
    result = await pollKairogen(result.generationId, "image");
  }
  if (result.status !== "ready" || !result.url) throw new KairogenError("KAIROGEN_PENDING_OR_FAILED", false, result.generationId);
  try {
    const url = new URL(result.url);
    // Download media only, never send the supplier token to a CDN or follow redirects.
    if (url.protocol !== "https:" || url.username || url.password || !allowedMediaHost(url.hostname)) throw new Error("untrusted media URL");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    const mime = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !mime || !["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new Error("invalid image");
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 20 * 1024 * 1024) throw new Error("image too large");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks);
    const valid = (mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      || (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
      || (mime === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
    if (!valid) throw new Error("invalid image signature");
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch { throw new KairogenError("KAIROGEN_OUTPUT_UNAVAILABLE", false, result.generationId); }
}

export function allowedMediaHost(hostname: string): boolean {
  const allowed = env.KAIROGEN_MEDIA_HOSTS.split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  return allowed.some(host => hostname === host || hostname.endsWith(`.${host}`));
}
