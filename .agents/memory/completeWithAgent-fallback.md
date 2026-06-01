---
name: completeWithAgent Anthropic/Gemini Fallback
description: completeWithAgent() must have try-catch fallback to OpenAI — it calls providers directly, bypassing the LLM router chain.
---

## Rule

`completeWithAgent()` in `ai-gateway.service.ts` calls `callAnthropic()` / `callGemini()` directly in a `switch` statement — it does NOT go through the LLM router's fallback chain.

**Always wrap the anthropic and gemini cases with try-catch that falls back to `callOpenAI(getDefaultModelForProvider("openai"), ...)`.**

## Why

`runAgent()` uses the LLM router (with full fallback chain). `completeWithAgent()` is a separate path used by direct-chat, sales-team suggest, and other non-pipeline callers. When Anthropic has zero balance (400 error), `completeWithAgent` threw unhandled 500s for ALL strategy/analytics/video agents called through direct-chat. The LLM router in `runAgent` was unaffected.

## How to apply

Any time `completeWithAgent` is modified, verify the `case "anthropic":` and `case "gemini":` blocks have their try-catch fallback to OpenAI. Without it, any Anthropic outage or credit exhaustion crashes the Agents Hub and Sales Team AI suggestions.
