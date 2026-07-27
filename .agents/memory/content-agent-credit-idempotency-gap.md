---
name: Content Agent Credit Idempotency Gap
description: FIXED — generateExtraContent was using the pipeline-level C3 key; also covers regeneratePiece and rewriteContentPiece regen-context pattern
---

## Rule
Every code path that calls `runAgent` (or a critique-runner agent) OUTSIDE the initial pipeline MUST be wrapped in `withRegenContext(key, fn)`. Without this, C3 falls back to `${campaignId}:${agentRole}` — the same key the initial pipeline already consumed — and `ON CONFLICT DO NOTHING` blocks the charge forever.

**Why:** C3 idempotency uses a partial unique index on `credit_transactions.idempotency_key`. First insert wins; duplicates are silently dropped. Any subsequent call with the same key charges 0 credits.

**How to apply:**
- `regeneratePiece` → key: `${campaignId}:${pieceId}:regen:${Math.floor(Date.now()/60000)}`
- `rewriteContentPiece` → key: `${campaignId}:${pieceId}:rewrite:${Math.floor(Date.now()/60000)}`
- `generateExtraContent` → key: `${campaignId}:${platform}:extra:${Math.floor(Date.now()/60000)}`
- Same-minute calls share the bucket key → exactly 1 charge (dedup of rapid double-clicks)
- New minute → fresh key → new charge

## Fixed paths
- `generateExtraContent()` — **FIXED**: now wraps `runAgent` with `withRegenContext(extraIdempotencyKey, ...)`
- `regeneratePiece()` — already fixed (AsyncLocalStorage)
- `rewriteContentPiece()` — already fixed (AsyncLocalStorage)

## New path pattern
```typescript
const extraBucket = Math.floor(Date.now() / 60_000);
const extraIdempotencyKey = `${campaignId}:${platform}:extra:${extraBucket}`;
const rawOutput = await withRegenContext(extraIdempotencyKey, async () => {
  const result = await runAgent({ ... });
  return result.content;
});
```
