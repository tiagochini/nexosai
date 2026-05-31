---
name: parseAgentJSON Robustness
description: Root cause and fix for LLM JSON extraction failures when narrative text precedes the JSON object
---

## Rule
`parseAgentJSON` must use balanced-brace scanning (Strategy 2), not greedy `{...}` regex, as primary extraction method.

**Why:** LLMs frequently prefix JSON with narrative text (e.g., "Aqui está o plano..."). The greedy regex `/\{[\s\S]*\}/` matches from the FIRST `{` in the narrative to the LAST `}`, producing invalid JSON that fails to parse. The raw response is 25KB+ but `items` comes back empty because `JSON.parse` throws and the fallback returns `{items: []}`.

**How to apply:**
- Strategy 1: code block extraction (```json...```) — handles LLMs that wrap in backticks
- Strategy 2: scan all `{"` positions, find balanced close brace by counting depth, keep largest valid JSON object — handles narrative prefix/suffix
- Strategy 3: original greedy `{...}` match as last resort
- Key normalization: for sequence builder, try `items ?? itens ?? sequencia ?? messages ?? touchpoints` — LLMs sometimes use Portuguese/Spanish key names

## Mechanical Agents
Use `skipAllStaticLayers: true` in `runAgent` for mechanical JSON-output agents (sequence builder, calendar generator). This drops ~110KB of DOMINO philosophy layers that are irrelevant for structured-output tasks and can confuse the LLM into adding explanatory text.

**Files:** `agent.runner.ts` (parseAgentJSON function + RunAgentOptions.skipAllStaticLayers), `launch-sequence-builder.agent.ts` (skipAllStaticLayers + key normalization)
