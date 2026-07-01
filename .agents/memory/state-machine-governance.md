---
name: State Machine Governance
description: Campaign state machine is Level 3 enforced — throws on undeclared transitions, single source of truth in campaign-state-machine.ts
---

## Rule
`campaign-state-machine.ts` is the single source of truth for all campaign status transitions.
`transitionCampaign()` and `updateCampaignStatus()` in `campaigns.service.ts` both call `isValidTransition()` — they throw `ValidationError` (not warn) on undeclared transitions.

## Re-exports
`campaigns.service.ts` re-exports all constants from `campaign-state-machine.ts` for backward compat. Consumers keep importing from `campaigns.service.ts` unchanged.

**Why:** Previously VALID_STATUS_TRANSITIONS was inline in campaigns.service with level 2 warn (silently executed). Level 3 active means every undeclared transition is a hard stop, preventing silent pipeline corruption.

**How to apply:** To add a new valid transition, edit ONLY `campaign-state-machine.ts`. Never add `db.update(campaignsTable).set({status})` directly — always go through `transitionCampaign()` or `updateCampaignStatus()`.

## Self-transition no-op
`transitionCampaign()` now treats `from === to` as an idempotent no-op (log + return) BEFORE the `isValidTransition` check, instead of throwing. This was a real production bug: the strategy pipeline (command.agent.ts) re-asserts `strategy_ready` as its final step after several agents already transitioned the campaign there inline mid-pipeline — that self-transition edge was never declared in `VALID_STATUS_TRANSITIONS`, so the entire multi-minute, multi-agent, real-credit-charging strategy run crashed at the very last line every time.

**Why:** any pipeline step that "re-confirms" a status the campaign already reached is not a real state change and must not be validated against declared edges — only genuine cross-status transitions should be gated.

**How to apply:** if a new bug report shows a job failing with `PIPELINE_KERNEL: undeclared transition X → X`, it's this same class — no state-machine edge is missing, the self-transition guard is the fix, not a new edge in `campaign-state-machine.ts`.
