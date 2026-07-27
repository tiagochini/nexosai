---
name: Strategy Pipeline Bugs
description: Bugs in the analyze→strategy_ready pipeline; most critical is strategyData silent drop in transitionCampaign
---

## Rule
`transitionCampaign(campaignId, workspaceId, "strategy_ready", ..., log, extra)` spreads `extra` **directly** into the Drizzle UPDATE `.set({...extra})`. Drizzle silently ignores keys that are not valid column names. Therefore:

- ✅ Correct: `{ strategyData: result }` — matches the Drizzle ORM column name
- ❌ Wrong: `{ strategy: result }` — `strategy` is not a column; Drizzle drops it silently

`updateCampaignStatus()` is a different function that uses `data.strategy` (mapped via `updateData.strategyData = data.strategy`). These two functions have different calling conventions and must not be confused.

**Why:** The previous "fix" changed `strategyData → strategy` believing `updateCampaignStatus` was the target, but `command.agent.ts` calls `transitionCampaign`, not `updateCampaignStatus`. The result: strategyData column stayed permanently empty on every campaign.

**How to apply:** Any call to `transitionCampaign(..., extra)` that includes campaign column data must use the exact Drizzle column name (camelCase). Check the schema if unsure.

## Self-transition no-op gotcha
`transitionCampaign` returns early (no DB write at all) when `campaign.status === toStatus`. This means:
- If a second strategy run tries to persist strategyData by calling `transitionCampaign(..., "strategy_ready", ..., { strategyData: result })` and the campaign is already at `strategy_ready`, the update is **silently skipped**.
- Fix pattern: After transition, if strategyData is still empty (checkpoint skip path in RC-011), run a bare `db.update` to set strategyData independently, outside of transitionCampaign.

## Secondary issue: multiple parallel strategy runs
When acknowledge fires `enqueueOrExecute` AND the queue already has a pending job, two pipeline runs can start concurrently. Both run the strategy agent, both compete to transition to strategy_ready. The second one's strategyData save is lost (self-transition no-op). Tracked in backlog as task #34.
