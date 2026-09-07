---
name: Canonical AI completion chain
description: Text agents and routed completions share one safe provider order.
---

Every text completion, including direct `completeWithAgent`/`completeWithAgentSafe`
and `routedComplete`, uses exactly one chain: native Anthropic, native OpenAI,
native Gemini, then the final Replit AI Integrations stage. The Replit stage
prefers its OpenAI-compatible integration and may then try the compatible
Anthropic integration; it never returns to a native provider. Gemini integration
is deliberately omitted until its proxy base-URL contract is supported.

Task and role mappings may tune output-token budgets or models but must never
change provider order. This includes `market_intel`: it is not an OpenAI/Replit
exception. Keeping direct and routed callers on the same entry point prevents
cycles, duplicate provider attempts, misleading billing, and inconsistent UI
latency.