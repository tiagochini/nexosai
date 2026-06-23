---
name: OpenAI SDK Timeout Override
description: The OpenAI SDK has a built-in default timeout (~10 min) that fires before any AbortSignal. Must set timeout on client constructor.
---

## Rule

Always pass `timeout: LLM_CALL_TIMEOUT_MS` when constructing `new OpenAI({...})` — including the main singleton in `getOpenAI()` AND any ad-hoc fallback clients (e.g. the quota-exhausted integration fallback inside `callOpenAI()`).

**Why:** The OpenAI Node.js SDK has its own internal connection timeout (~10 min by default). When a deep LLM call runs longer than 10 min, the SDK throws `APIConnectionTimeoutError2` — even though our `AbortSignal` from `withLLMTimeout()` is set to 30 min. The SDK timeout fires first and crashes the call.

**How to apply:** Whenever creating a `new OpenAI({...})` instance, include `timeout: LLM_CALL_TIMEOUT_MS`. Because `openaiClient` is a singleton cached after first instantiation, a change here requires an API server restart to take effect.

**Fix location:** `artifacts/api-server/src/modules/ai-gateway/ai-gateway.service.ts` — `getOpenAI()` function (3 branches: native key, integration, missing) + quota-exhausted fallback client inside `callOpenAI()`.
