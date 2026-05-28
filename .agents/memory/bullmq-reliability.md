---
name: BullMQ Reliability Fixes
description: Three silent failure modes in BullMQ + ioredis that prevent job processing; fix pattern in enqueueOrExecute().
---

## Three silent failure modes

### 1. lazyConnect swallows Redis-unavailable errors
`lazyConnect: true` makes `queue.add()` succeed (buffers the command) even when Redis is unreachable. The catch block that triggers `executeDirectly()` never fires.

**Fix:** Call `isRedisAvailable()` (in queue.service.ts) BEFORE attempting `queue.add()`. It does a real ping with a 2s timeout on a separate ioredis probe client, caches the result for 10s.

### 2. Dedup jobId returns stale failed job
When `queue.add()` is called with a `jobId` that already exists in `failed` state, BullMQ silently returns the stale job reference instead of creating a new one. The worker never reprocesses a failed job. The caller sees "Orchestration job enqueued" in logs — everything looks fine, nothing runs.

**Fix:** Before `queue.add()`, call `queue.getJob(dedupJobId)`. If state is `"failed"`, remove it and execute directly (don't re-queue — a failed job indicates the worker is unhealthy for that jobId).

### 3. Worker blocking connection (BRPOP) silently broken
The BullMQ Worker's blocking Redis connection can be non-functional even when standard connections work (ping succeeds, queue.add() works). Jobs sit in `"waiting"` state indefinitely. Symptom: "Orchestration worker initialized" in logs but NO "Processing orchestration job" ever appears after jobs are added.

**Fix:** After removing a stale failed job and adding a fresh one — if the new job remains in `"waiting"` state for >30s on the next execute call, treat it as a zombie: remove and execute directly via `executeDirectly()`.

## How to apply
All three fixes live in `enqueueOrExecute()` in `orchestration.service.ts`. The order is:
1. `isRedisAvailable()` → if false, go direct
2. `queue.getJob(dedupJobId)` → if `failed`, go direct; if `waiting` with age >30s, go direct; if `active`, skip (dedup); if `completed`, remove then re-queue
3. `queue.add(...)` → normal BullMQ path

## Why
BullMQ is well-suited for production Redis environments. In Replit dev (and some restricted Redis providers), the blocking BLPOP/BRPOP connection used by BullMQ Workers is silently broken while standard Redis commands work fine. Direct execution via `setImmediate(() => executeDirectly(...))` is the reliable fallback — it uses no Redis at all.
