import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { env } from "../../lib/env.js";

export const ACADEMY_VERIFICATION_LIMIT = 10;
export const ACADEMY_VERIFICATION_WINDOW_MS = 15 * 60 * 1000;
const normalize = (ip: string) => ip.toLowerCase().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");

export function academyVerificationKey(req: Pick<Request, "socket" | "ip">, trustedProxyIPs: string[] = []): string {
  const peer = normalize(req.socket.remoteAddress ?? "");
  // Never trust a forwarded client IP solely because the global app trusts one hop.
  const trusted = trustedProxyIPs.some((ip) => isIP(ip) && normalize(ip) === peer);
  const client = trusted && req.ip && isIP(req.ip) ? normalize(req.ip) : peer;
  return isIP(client) ? ipKeyGenerator(client, 56) : "unknown-peer";
}

const clients = new Set<Redis>();
export function closeAcademyQuotaConnections(): void { for (const client of clients) client.disconnect(); clients.clear(); }
export function createAcademyVerificationLimiter(trustedProxyIPs: string[] = [], options: { redisURL?: string; prefix?: string; memoryForTests?: boolean; scope?: "verify" | "tutor" | "checkout" | "leads" } = {}): RequestHandler {
  const memory = options.memoryForTests ?? (process.env.NODE_ENV === "test" && !options.redisURL);
  if (memory && process.env.NODE_ENV !== "test") throw new Error("Memory quota is test-only");
  const counters = new Map<string, { count: number; until: number }>();
  let client: Redis | undefined, connecting: Promise<unknown> | undefined;
  const scopePrefix = `academy:${options.scope ?? "verify"}:v1:`;
  const prefix = process.env.NODE_ENV === "test" ? options.prefix ?? scopePrefix : scopePrefix;
  return async (req, res, next): Promise<void> => {
    const key = prefix + createHash("sha256").update(academyVerificationKey(req, trustedProxyIPs)).digest("hex");
    let count: number, ttl: number;
    try {
      if (memory) {
        const now = Date.now();
        for (const [entry, value] of counters) if (value.until <= now) counters.delete(entry);
        const current = counters.get(key) ?? { count: 0, until: now + ACADEMY_VERIFICATION_WINDOW_MS };
        current.count++; counters.set(key, current); count = current.count; ttl = current.until - now;
      } else {
        if (!client) {
          client = new Redis(options.redisURL ?? env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0, connectTimeout: 1000, commandTimeout: 1000, retryStrategy: () => null });
          clients.add(client); client.on("error", () => {});
        }
        if (["wait", "end"].includes(client.status)) connecting ??= client.connect().finally(() => { connecting = undefined; });
        if (connecting) await connecting;
        const result = await client.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}", 1, key, ACADEMY_VERIFICATION_WINDOW_MS) as number[];
        count = Number(result[0]); ttl = Number(result[1]);
        if (!Number.isSafeInteger(count) || count < 1 || ttl < 0) throw new Error("Invalid quota state");
      }
    } catch {
      res.status(503).json({ valid: false, error: "Validação temporariamente indisponível.", code: "ACADEMY_QUOTA_UNAVAILABLE" }); return;
    }
    const seconds = Math.max(1, Math.ceil(ttl / 1000));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("RateLimit", `limit=${ACADEMY_VERIFICATION_LIMIT}, remaining=${Math.max(0, ACADEMY_VERIFICATION_LIMIT - count)}, reset=${seconds}`);
    if (count > ACADEMY_VERIFICATION_LIMIT) {
      res.setHeader("Retry-After", seconds);
      res.status(429).json({ valid: false, error: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "ACADEMY_VERIFICATION_RATE_LIMITED" }); return;
    }
    next();
  };
}
