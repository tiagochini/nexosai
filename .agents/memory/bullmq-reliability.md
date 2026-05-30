---
name: BullMQ Reliability Fixes
description: Silent failure modes in BullMQ + orphaned job cleanup at boot; essential for clean restart behavior after deploys.
---

## Root cause of post-deploy "stuck campaign" UX

After a server restart (deploy), BullMQ jobs that were "active" at the time remain in Redis
with no live worker to extend their lock. The DB boot cleanup resets campaign statuses, but
without draining Redis the dedup check sees them as "already running" and silently skips new
executions — leaving the user stuck with a campaign doing nothing, no error, no feedback.

**Fix (RC-011 FINAL):** Call `drainQueueAtBoot(queueName)` for all queues in `index.ts`
INSIDE the boot `Promise.all()`, BEFORE `httpServer.listen()`. This removes all active/waiting/
delayed/failed jobs at startup, ensuring Redis and the DB are in sync on every boot.

**How to apply:** `index.ts` already calls it for `CAMPAIGN_ORCHESTRATION`, `AGENT_EXECUTION`,
`CONTENT_GENERATION`. Any new queue that feeds user-facing pipelines must be added here too.

## Three additional silent failure modes (enqueueOrExecute)

### 1. lazyConnect swallows Redis-unavailable errors
`lazyConnect: true` makes `queue.add()` succeed even when Redis is unreachable. The catch
block that triggers `executeDirectly()` never fires.
**Fix:** Call `isRedisAvailable()` BEFORE `queue.add()` — real ping with 2s timeout, cached 10s.

### 2. Dedup jobId returns stale failed job
`queue.add()` with an existing `failed` jobId silently returns the stale reference. Worker
never reprocesses. Logs say "enqueued" — nothing runs.
**Fix:** `queue.getJob(dedupJobId)` before add; if state=`failed`, remove + execute directly.

### 3. Worker blocking connection (BRPOP) silently broken
Jobs sit in `"waiting"` indefinitely. Symptom: "worker initialized" in logs, no "Processing job" ever.
**Fix:** If job remains `waiting` >30s on next execute call → treat as zombie, remove + direct exec.

## BullMQ worker settings (correct values)

- `lockDuration: 30_000` — lock renewal frequency (NOT execution time limit). Worker renews every 15s.
  Jobs run for hours safely. Smaller = faster orphan detection after crash (~60s total).
- `stalledInterval: 30_000` — how often BullMQ checks for expired locks. 30s means orphaned
  jobs detected within 60s of crash (lockDuration + stalledInterval).
- `maxStalledCount: 0` — no automatic retry. AI jobs charge credits; silent retry = double charge.
  `failed` handler in worker resets campaign status so user can manually retry from UI.

**Why:** lockDuration does NOT cap execution time. It caps how long a dead worker's lock persists.
As long as the process is alive, the worker extends automatically — agents can run indefinitely.
