---
name: Strategy Pipeline Bug Cluster
description: 5 bugs found + fixed in the analyze→strategy_ready pipeline during UX audit session (Jun 2026)
---

## The bugs

**Bug 1 (ROOT CAUSE — silent data loss):**
`transitionCampaign(id, ws, "strategy_ready", msg, log, { strategy: result })` — wrong key.
The transition metadata arg uses `strategyData` (snake → camelCase in DB setter), NOT `strategy`.
With wrong key the DB column `strategy_data` stays `{}`. Content worker then aborts with `STRATEGY_EMPTY`.
Fix: `{ strategyData: result }` in `command.agent.ts` line ~804.

**Bug 2 (stale lock after crash):**
`releaseExecutionLock` only cleared `lockedAt`/`lastProgressAt` in checkpoint; left orphaned `running` rows
in `campaign_agents` table → trigger guards saw `running` row and blocked re-entry permanently.
Fix: `releaseExecutionLock` now sets orphaned `running` campaign_agents rows to `failed`.

**Bug 3 (over-aggressive guard):**
`triggerStrategyPhase` / `triggerContentPhase` blocked if ANY `running` agent row existed (no staleness check).
Stale rows from crashed runs blocked the user forever.
Fix: Guards now check `startedAt > (now - 15min)` — rows older than 15 min are considered stale and ignored.

**Bug 4 (checkpoint skip-all on re-run):**
Re-running strategy from `strategy_ready` status uses the checkpoint from the previous run → all agents
marked done → all skipped → `transitionCampaign("strategy_ready")` never called → campaign stuck in `analyzing`.
Fix: `orchestrateCampaign` resets `cp.completedSteps = []` when entry status is `strategy_ready`.

**Bug 5 (no finally-block recovery):**
If all agents were skipped and campaign still stuck in `analyzing` on pipeline exit, nothing transitioned it.
Fix: `orchestrateCampaign` finally block checks if campaign is still `analyzing` + `strategy` in completedSteps
→ calls `transitionCampaign("strategy_ready")` as recovery.

**Bug 6 (scheduler resets to intake aggressively):**
Scheduler failsafe always reset stuck `analyzing` campaigns to `intake`, forcing user to redo full intake
even when strategy was already complete.
Fix: Scheduler checks if `strategy` is in `pipelineCheckpoint.completedSteps` → resets to `strategy_ready`
instead. Also clears `lockedAt`/`lastProgressAt` in the checkpoint so next trigger can acquire the lock.

## Why it was hard to find

Bug 1 was silent — no error, no warning, the wrong key was just ignored. `strategyData` is the canonical
key used by the DB setter (Drizzle mapped column), NOT `strategy`. Always verify the exact property name
when calling `transitionCampaign` with metadata.

## How to apply

- When calling `transitionCampaign` with payload, check the exact column name in the Drizzle schema.
- Any time a pipeline step produces data that must be saved via `transitionCampaign`, verify the key.
- Checkpoint reset on user-initiated re-runs is now automatic for `strategy_ready` → `analyzing`.
