---
name: Dev/Prod Redis Queue Isolation
description: Dev and prod workers share the same Redis URL — without a queue prefix, prod worker picks up dev jobs and RC-010s them (campaign not found in prod DB). Fixed with QUEUE_PREFIX env var.
---

# Dev/Prod Redis Queue Isolation Bug

## Rule
`QUEUE_NAMES` in `queue.service.ts` must include an env-based prefix so dev and prod BullMQ workers never compete for the same jobs.

**Why:** Both environments share one Redis URL (same `REDIS_URL` secret). Without prefix isolation, a strategy job enqueued in dev is picked up by the prod worker first. The prod DB has no record of the dev campaign → RC-010 fires → job silently skipped → dev pipeline stalls indefinitely.

**How to apply:** `QUEUE_PREFIX` env var (falls back to `NODE_ENV === 'production' ? 'prod' : 'dev'`). Produces `dev:campaign-orchestration` vs `prod:campaign-orchestration`. Fix is in `artifacts/api-server/src/modules/queue/queue.service.ts` lines 61-80.

## Post-restart Redis probe failure (related)
`isRedisAvailable()` creates a separate TCP connection to probe Redis. At restart, Upstash hits connection burst from BullMQ's own connections → probe times out in 2s → cached as `ok: false` for 10s → `enqueueOrExecute` falls back to `executeDirectly` unnecessarily. BullMQ worker itself is ready 559ms after boot. Credit idempotency guards ([C3]) are identical in both paths (DB-level `ON CONFLICT DO NOTHING`), so the fallback is safe but obscures the real transport.
