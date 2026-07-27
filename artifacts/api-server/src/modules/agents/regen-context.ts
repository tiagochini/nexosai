/**
 * ── Regeneration Idempotency Context ─────────────────────────────────────────
 * AsyncLocalStorage-based context that propagates a per-regeneration idempotency
 * key through the entire agent call stack without requiring signature changes on
 * any of the 18+ agent functions.
 *
 * How it works:
 *   - `regeneratePiece()` in content.service.ts wraps each agent call with
 *     `withRegenContext(key, fn)`, setting a time-bucketed key.
 *   - `critique.runner.ts` and `agent.runner.ts` read `getRegenIdempotencyKey()`
 *     at the credit-deduction point and use it as the C3 key when present.
 *
 * Key format:  `${campaignId}:${pieceId}:regen:${Math.floor(Date.now() / 60000)}`
 *
 *   → Same minute window: two concurrent requests (rapid double-click) share the
 *     same key → ON CONFLICT DO NOTHING → exactly 1 credit charge.
 *   → New minute: fresh key → new credit charge (subsequent manual regeneration).
 *
 * Concurrency safety: AsyncLocalStorage provides an async-scoped store — each
 * in-flight regeneration request has its own key, completely isolated from others.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface RegenContext {
  idempotencyKey: string;
}

const _storage = new AsyncLocalStorage<RegenContext>();

/**
 * Run `fn` inside a regeneration context with the given idempotency key.
 * Credit deductions inside the call stack will use this key instead of the
 * default `${campaignId}:${agentRole}` key.
 */
export function withRegenContext<T>(idempotencyKey: string, fn: () => Promise<T>): Promise<T> {
  return _storage.run({ idempotencyKey }, fn);
}

/**
 * Returns the active regeneration idempotency key, or `undefined` if no
 * regeneration context is active (i.e., normal pipeline run).
 */
export function getRegenIdempotencyKey(): string | undefined {
  return _storage.getStore()?.idempotencyKey;
}
