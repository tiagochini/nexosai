import { timingSafeEqual } from "node:crypto";

// Provider credentials must be configured explicitly; no token is ever logged.
export function matchesAsaasWebhookToken(provided: unknown, configured: unknown): boolean {
  if (typeof configured !== "string" || !configured.trim() || configured.trim() !== configured || configured.length > 1024 ||
      typeof provided !== "string" || !provided || provided.length > 1024) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
