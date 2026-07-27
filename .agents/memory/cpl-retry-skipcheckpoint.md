---
name: CPL Retry skipCheckpoint Pattern
description: Critique runner retry bypass and CPL_JSON_SCHEMA injection; also covers agent_warning dual-path emit (generateCampaignContent + regeneratePiece)
---

## Rule
`runAgentWithCritique` accepts `skipCheckpoint?: boolean`; when true it nullifies the loaded checkpoint and runs all turns fresh. Without this, every retry inside `runCPLScriptAgent` hits the cached bad checkpoint from iteration=3 and returns the same bad result.

**Why:** All 3 CPL agents share the same checkpoint key `(campaignId, "cpl_script")`. When a retry is needed, `skipCheckpoint: true` is the clean fix without renaming any agentRole.

**How to apply:** Pass `{ skipCheckpoint: true }` only on the retry path inside `retryCPLIfNeeded`. Initial run still benefits from checkpoint resume.

## CPL_JSON_SCHEMA injection (root cause fix)
The CPL schema must be injected into the `userMessage` of all 3 CPL agents (`runCPL1Agent`, `runCPL2Agent`, `runCPL3Agent`). Without this, the LLM invents its own schema (`tipo_cpl`, `objetivo`, etc.) and `liveScript` is always empty even on fresh LLM calls.

**File:** `artifacts/api-server/src/modules/agents/cpl-scripts.agent.ts`

## agent_warning dual-path emit (#60)
The `emitCampaignEvent({ type: "agent_warning" })` + `db.insert(auditLogsTable)` emit must happen in BOTH:
1. `generateCampaignContent` (initial pipeline) — in the `else` branch (B2 passes, degradedCPLs > 0)
2. `regeneratePiece` (regenerate path) — after "contract clean → pending_approval" save

**Why:** Without the second path, founders who trigger regeneration (not initial generation) never get the audit_log row — the warning disappears after the live Socket.io feed.

**B2 threshold awareness:** B2 fails only when ALL videos have BOTH empty `hook` AND empty `structure`. `isCPLLiveScriptComplete` fails when `mainContentSections` is empty OR `estimatedDuration` is empty. These are different checks — a CPL can pass B2 but still be degraded.

**File:** `artifacts/api-server/src/modules/content/content.service.ts`, function `regeneratePiece` (after line ~3200)
