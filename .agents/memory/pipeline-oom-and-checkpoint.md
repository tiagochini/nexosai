---
name: Pipeline OOM & Checkpoint System
description: OOM root cause, checkpoint/resume system, and LLM router for the command agent pipeline
---

## OOM Root Cause
Static prompt layers in `agent.runner.ts` were being rebuilt on every `runAgent()` call — 130KB reallocated per call during pipeline execution. Fixed by caching `_STATIC_PROMPT_LAYERS` and `_PIPELINE_PROMPT_LAYERS` as module-level constants. Also added `_globalPipelineMode` flag + `setPipelineMode()` export so agents inside the pipeline skip the 27KB Cognitive Foundations layer.

**Why:** The strategy pipeline calls 10-15 agents sequentially; 130KB × 15 = ~2MB per pipeline run that previously caused SIGKILL under memory pressure.

**How to apply:** `setPipelineMode(true)` at pipeline entry, always `setPipelineMode(false)` in `finally` block. Already done in `command.agent.ts`.

## Pipeline Checkpoint System (command.agent.ts)
`brainData` JSONB column in campaigns table stores checkpoint under key `brain.pipelineCheckpoint`. Checkpoint interface:
```
{ completedSteps: string[], lastProgressAt: string, lockAcquiredAt?: string, meta: Record<string, unknown> }
```
Key functions: `loadCheckpoint`, `saveCheckpoint`, `isStepDone`, `isLockActive`, `acquireExecutionLock`, `releaseExecutionLock`.

Lock grace period = 3 minutes (single LLM call max). Checkpoints saved after: `command`, `profile_builder`, `strategy`, `offer`, `launch_manager`, `financial_projector`.

**Why:** Server SIGKILL during pipeline left campaigns stuck in `analyzing` forever. Checkpoint allows resume from last completed step on retry.

## LLM Router (ai-gateway/llm-router.ts)
`routedComplete(opts)` routes by `taskType` to optimal provider with automatic fallback chain: Anthropic → OpenAI → Gemini → error. `agent.runner.ts` uses `routedComplete()` instead of `completeWithAgent()` directly.

## execute/content 503 Grace Period
`MODULE_LOADED_AT` constant in `execution.routes.ts` + `SERVER_CONTENT_GRACE_MS = 15_000` guard returns 503 + `Retry-After: 15` header during warmup window after server restart, preventing 502 from incomplete initialization.

## Boot Cleanup
Server restart resets campaigns stuck in `analyzing` for >30 min back to previous state (checked on boot). This is why campaigns return to `intake` after extended downtime — expected behavior.

## UI Bug: analyzing status re-trigger
`getNextAction()` in `campaigns/detail.tsx` — `analyzing` case was showing "Iniciar Análise Estratégica" (clickable), allowing duplicate pipeline trigger. Fixed to show `"Analisando..."` with `phase: undefined` (renders as disabled button). Also:
- `onSuccess` of executeMutation: optimistically sets cache status to "analyzing" so polling activates before next refetch
- `onError`: detects "Pipeline já está executando" message → shows `toast.info` instead of `toast.error`
