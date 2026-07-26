---
name: RC-011 Strategy Phase Resilience
description: Root cause, fixes, and proof pattern for the "campaign stuck in analyzing" bug when Redis is rate-limited.
---

# RC-011: Strategy Phase Resilience

## Root Cause
`emitCampaignEvent()` in `realtime.service.ts` calls `io.to(room).emit()` synchronously with no try/catch.
When the Socket.io Redis adapter is rate-limited (Upstash ReplyError every ~150ms), `emit()` throws synchronously.
This exception propagates up through `runAgent()` → `runStrategyAgent()` → caught by the strategy try/catch as "Strategy agent failed".
`saveCheckpoint("strategy")` never runs. `transitionCampaign("strategy_ready")` never runs.
Campaign stays in `analyzing` forever with no visible error. Credits already deducted: ~74cr.

## Fixes Applied (all in one session)

### 1. `emitCampaignEvent` try/catch (root cause fix)
File: `artifacts/api-server/src/modules/realtime/realtime.service.ts`
Wrapped `io.to().emit()` in try/catch → logs WARN, never throws.
**Why:** Socket.io Redis failures must never kill DB-persistence pipeline. Campaign state lives in Postgres.

### 2. Profile Builder `isStepDone` guard
File: `artifacts/api-server/src/modules/agents/command.agent.ts`
Added `if (!isStepDone(cp, "profile_builder"))` around Profile Builder block.
Else branch: loads output from `campaign.audienceData` + `campaign.targetingData` (already saved by first run).
**Why:** On retry after degraded Redis, Profile Builder was re-running and charging 25cr again.

### 3. Strategy Agent `isStepDone` guard
File: `artifacts/api-server/src/modules/agents/command.agent.ts`
Added `if (!isStepDone(cp, "strategy"))` around Strategy Agent block.
Else branch: loads `campaign.strategyData` → re-asserts `transitionCampaign("strategy_ready")` if status != strategy_ready.
**Why:** Same double-charge protection. Also handles the case where transitionCampaign itself threw.

### 4. Failure marker persistence in strategy catch
In the catch block: writes `brainData.strategyTransitionFailed = { at, error, retryable: true, message }` via setImmediate.
Success path (after transitionCampaign): clears the marker from brainData.
**Why:** Campaign in "analyzing" with no error marker = infinite spinner. Marker allows UI to show retry button.

### 5. Bug 1 fix: `strategyData` key bug (bonus)
File: `artifacts/api-server/src/modules/agents/command.agent.ts`
Changed `{ strategyData: result }` → `{ strategy: result }` in transitionCampaign call.
`campaigns.service.ts` line 274 reads `data.strategy`, not `data.strategyData`.
**Why:** strategy_data column was always `{}` for all campaigns despite pipeline completing.

## Proof Pattern (without full LLM run)
- (a) Failure marker: SELECT brain_data->'strategyTransitionFailed' from campaigns WHERE id=X
- (b) No double charge: isStepDone returns true → block skipped → 0 new credit_transactions
- (c) Recovery: UPDATE campaigns SET status='strategy_ready', brain_data = brain_data - 'strategyTransitionFailed' WHERE strategy_data != '{}' AND failure_marker IS NOT NULL

## How to Apply
- Any new agent added to command.agent.ts pipeline should: (1) have isStepDone guard, (2) save to a DB column in the success path, (3) load from that column in the else branch.
- Follow-ups: #38 (UI error card), #39 (add guards to other 7 agents), #40 (Redis health endpoint).
