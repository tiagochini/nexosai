---
name: Intake chat resilience pattern
description: how interactive AI chat calls get short timeouts + non-throwing errors without breaking long-running background agents
---

`ai-gateway.service.ts` has one global `LLM_CALL_TIMEOUT_MS` (30 min) used by deep background agents (strategy/content generation) — this must never be lowered globally, deep agents legitimately run 10-20+ min.

**Pattern for interactive/short-lived callers** (e.g. intake/briefing chat):
- `completeWithAgent()` now accepts an optional trailing `timeoutMs` param that overrides the global ceiling per-call, without touching the default for the ~40+ other callers.
- `completeWithAgentSafe()` wraps `completeWithAgent()` and never throws — returns `{success:true, ...}` or `{success:false, error:"TIMEOUT"|"PROVIDER_ERROR", message}`. Use this for any HTTP-request-scoped AI call where a hang/crash must not take down the request.
- Retry: `withRetry()` + `isRetryableError()` wrap the primary provider call inside `callAnthropic`/`callOpenAI`/`callGemini` — retries only on network errors/502/504/timeout (max 3, exponential backoff from 500ms), never on 4xx.

**Why:** the intake conversational flow (`intake.ai.ts` `processConversationalTurn`) used to lose the user's message on any AI timeout because history was only saved after the call succeeded — a slow/failed LLM call silently discarded a turn of the conversation.

**How to apply:** for any new interactive AI chat surface, checkpoint the user's message to persistent state *before* calling the LLM, then use `completeWithAgentSafe` with a `timeoutMs` sized to the agent's real processing time — NOT an arbitrary short value. NexOS agents do internal multi-step processing (defense analysis, audits, quality checks) and can legitimately take 2-5 min per turn; intake chat uses 5 min (300000ms), not 90s — a too-short timeout defeats the retry/checkpoint work by aborting calls that were going to succeed. `withLLMTimeout()`'s per-call `timeoutMs` is enforced via a fresh AbortSignal per call (not the SDK client's construction-time timeout), so overriding it per-caller is safe and doesn't affect the global 30-min ceiling used by background agents.
