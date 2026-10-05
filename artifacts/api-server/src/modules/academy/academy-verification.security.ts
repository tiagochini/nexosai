import { isIP } from "node:net";
import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

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

export function createAcademyVerificationLimiter(trustedProxyIPs: string[] = []) {
  return rateLimit({
    windowMs: ACADEMY_VERIFICATION_WINDOW_MS,
    limit: ACADEMY_VERIFICATION_LIMIT,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => academyVerificationKey(req, trustedProxyIPs),
    message: { valid: false, error: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "ACADEMY_VERIFICATION_RATE_LIMITED" },
  });
}
