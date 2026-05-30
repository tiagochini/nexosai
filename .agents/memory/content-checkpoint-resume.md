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

## Gotchas
- `ne(contentPiecesTable.status, "cancelled")` fails typecheck — "cancelled" is not in the enum. Load all pieces for campaign without status filter.
- `Set<string>` required for `done` — plain `Set` infers the enum type and rejects `string` param in `skipAgent`.
- Don't add "generating" to `STRATEGY_PHASE_ENTRY_STATUSES` — only content phase needs resume; strategy agents are fast enough to restart from scratch.
