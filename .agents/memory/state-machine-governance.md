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
