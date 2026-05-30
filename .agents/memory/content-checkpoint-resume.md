---
name: Content Generation Checkpoint/Resume
description: Per-agent checkpoint system in generateCampaignContent so server restarts resume rather than restart from scratch
---

# Content Generation Checkpoint/Resume

## The rule
After a server restart, campaigns stuck in `generating` are re-enqueued (NOT reset to `strategy_ready`). Each agent checks whether its output piece already exists in `contentPiecesTable` — if it does, it skips the LLM call entirely.

**Why:** The content pipeline runs up to 16 LLM calls sequentially (Creative Director → Compliance). A mid-pipeline server restart used to discard all progress. Now it resumes from the last completed agent.

## How to apply

### DB / State Machine
- `"generating"` added to `CONTENT_PHASE_ENTRY_STATUSES` in `campaign-state-machine.ts` (was excluded before to prevent re-triggers).
- `generateCampaignContent` skips `transitionCampaign("generating")` when `campaign.status === "generating"` already (the `isResume` flag).

### Checkpoint map (agent → contentPiecesTable.type)
creative_director → `creative_direction`, copywriter → `email_sequence`, landing_page → `landing_page_structure`, social_media → `content_calendar`, ad_copy → `ad_copy`, targeting → `targeting_config`, media_buyer → `media_buying_plan`, vsl_script → `vsl_script`, cpl_script → `cpl_script`, webinar_script → `webinar_script`, live_script → `live_script`, stories_sequence → `stories_sequence`, video_strategy → `video_strategy`, creator_growth → `creator_growth_plan`, media_brief → `media_brief`, compliance → `compliance_report`.

### skipAgent() helper (in content.service.ts)
```typescript
const skipAgent = (pieceType: string, agentName: string): boolean => {
  if (!done.has(pieceType)) return false;
  agentsRun.push(agentName); piecesGenerated++;
  log.info(...); emitCampaignEvent(...type:"agent_completed"...);
  return true;
};
```
Each agent block: `if (!skipAgent("piece_type", "agent_name")) try { ... } catch { ... }`

### Boot sequence (index.ts)
`Promise.all([drainQueueAtBoot, markAgentsFailed, resetAnalyzing])` → `.then(async () => { await resumeGeneratingCampaigns(); ... })`.
`resumeGeneratingCampaigns()` in `orchestration.service.ts` queries `status="generating"` campaigns and calls `enqueueOrExecute({ action:"generate_content" })` for each.
The guard in `triggerContentPhase` is bypassed because by the time `.then()` fires, all running agents are already marked `failed`.

## BullMQ Root Cause (confirmed in production logs)
The actual production failure was **not** a server restart — it was a BullMQ stall:
```
UnrecoverableError: job stalled more than allowable limit
```
With `lockDuration: 30_000` (30s), the lock-renewal heartbeat fires every 15s. If Node.js event-loop is busy processing a slow LLM response (30-90s), the renewal is delayed → BullMQ marks job stalled → with `maxStalledCount: 0` it becomes `UnrecoverableError` → job dies silently, no frontend notification, campaign stuck in "generating" forever.

**Fix:** `lockDuration: 300_000` (5 min) + `stalledInterval: 300_000`. Renewal now fires every 150s — well within the gap between sequential LLM calls. `maxStalledCount: 0` kept to prevent double charges.

## Other fixes applied in same session
- **Double transition bug**: `orchestration.worker.ts processGenerateContent` was calling `transitionCampaign("awaiting_approval")` AFTER `generateCampaignContent` which already does it internally. This caused a state machine error → `throw err` → `failed` handler reset to `strategy_ready` silently. Fixed by removing the duplicate call from the worker.
- **`attempts: 3` removed**: changed to `attempts: 1` in `enqueueCampaignOrchestration` — silent retries would double-charge credits.
- **`failed` handler simplified**: `generate_content` action no longer resets campaign in the `failed` handler (the catch block inside `processGenerateContent` already does it). Only `run_strategy` is handled there now.

## Gotchas
- `ne(contentPiecesTable.status, "cancelled")` fails typecheck — "cancelled" is not in the enum. Load all pieces for campaign without status filter.
- `Set<string>` required for `done` — plain `Set` infers the enum type and rejects `string` param in `skipAgent`.
- Don't add "generating" to `STRATEGY_PHASE_ENTRY_STATUSES` — only content phase needs resume; strategy agents are fast enough to restart from scratch.
- `lockDuration` controls lock RENEWAL frequency (heartbeat = lockDuration/2), NOT total job time limit. Jobs can run indefinitely as long as the process is alive and renewing. Setting it too low kills long-running jobs silently via stall.
