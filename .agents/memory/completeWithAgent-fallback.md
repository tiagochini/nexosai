---
name: Direct-provider-call fallback (completeWithAgent, callVisionChat, etc.)
description: Any function that calls callAnthropic/callGemini/client.messages.create directly (bypassing the LLM router) needs its own try-catch fallback chain — this bug pattern has recurred more than once.
---

## Rule

Only `runAgent()` goes through the LLM router's full fallback chain automatically. Any other function that calls a provider SDK directly (`completeWithAgent()`'s anthropic/gemini cases, `callVisionChat()`, ad-hoc `getAnthropic().client.messages.create(...)` calls in route handlers, etc.) does NOT get fallback for free — it must be added explicitly.

**Pattern: try native provider → try OpenAI (native model, then a widely-available fallback model like gpt-4o on `model_not_found`/403) → try the Replit AI Integrations proxy (`hasOpenAIIntegration()` + `AI_INTEGRATIONS_OPENAI_*` env vars) → only then let it throw.** The integration proxy tier matters because native `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` can both be simultaneously blocked (credit exhaustion, project lacks access to a given model) while the Replit-provisioned proxy still works.

## Why

When Anthropic has zero balance (400) or the OpenAI project lacks access to a model (403 `model_not_found`), any direct-call site throws an unhandled 500 for its feature even though other AI features (routed through `runAgent`) keep working fine. This has hit `completeWithAgent`'s direct-chat path and, separately, the video-editor's `callVisionChat`/director-chat endpoints — same root cause, different call sites.

## How to apply

Whenever adding or reviewing a new function that calls an LLM provider SDK directly instead of `runAgent()`, check it has the 3-tier fallback (native → OpenAI incl. model downgrade → Replit AI Integrations proxy). Test live with a real API call during development — a `model_not_found`/quota error usually only surfaces at request time, not at typecheck time.
