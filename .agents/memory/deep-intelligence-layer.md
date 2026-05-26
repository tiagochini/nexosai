---
name: Deep Intelligence Layer
description: 3 cross-cutting intelligence systems that make every agent output smarter over time
---

## 1. Cross-Campaign Adaptive Memory (`cross-campaign-intelligence.service.ts`)

`buildCrossCampaignIntelligence(workspaceId, campaignId, intakeData, log)` — called in `command.agent.ts` as step 0c before the Profile Builder agent.

Result is prepended to `memoryContext` (before `assembleCampaignContext`):
```ts
memoryContext = crossCampaignContext ? crossCampaignContext + "\n" + baseContext : baseContext;
```

Sources it queries:
- Past campaigns of same workspace (last 5 completed, via `campaignMemoryTable.memoryData`)
- Vertical learnings (`getVerticalLearnings(verticalKey, workspaceId)`) — note: verticalKey is FIRST arg
- Workspace learnings (`workspaceMemoryTable`)

**Why:** Every new campaign benefits from patterns extracted from past ones. Non-fatal — any error is caught and logged, agents still run without it.

---

## 2. Output Quality Judge (`output-judge.agent.ts`)

`judgeAgentOutput(opts)` — evaluates 6 dimensions (PLF alignment, emotional density, specificity, compliance, persuasion strength, originality). Each dimension scored 0–100; `overallScore` is weighted average.

`APPROVAL_THRESHOLD = 70` — below this, `runJudgedAgent()` triggers a refinement pass.

`saveCritiqueLog(opts)` — saves both pre/post scores to `critiqueLogsTable`.

`buildRefinementMessage(rawOutput, score)` — builds targeted critique prompt from low-scoring dimensions.

`extractContextSummaryForJudge(memoryContext)` — extracts first 2000 chars of memoryContext for judge prompt.

**parseAgentJSON note:** Requires `fallback` as second arg — `parseAgentJSON<T>(content, {})` not `parseAgentJSON<T>(content)`.

**completeWithAgent campaignId:** Must be `string | undefined` not `string | null`. Use `campaignId ?? undefined`.

---

## 3. DOMINO Applied Frameworks (`domino-core.ts` → `DOMINO_APPLIED_FRAMEWORKS`)

10 IF→THEN→EXAMPLE blocks for: Schwartz (5 stages), Hormozi (offer stack), Kahneman (S1/S2), Cialdini (6 triggers), Voss (negotiation), Belfort (straight line), PLF (phase-by-phase emotional arc), NEPQ (discovery sequence), McKee (dramatic gap), Sugarman (slippery slope).

**Injection order in agent.runner.ts:**
```
buildTemporalContextBlock()
+ DOMINO_PLF_SUPREMACY
+ DOMINO_CORE_PREAMBLE
+ DOMINO_APPLIED_FRAMEWORKS   ← new, injected between preamble and evolution prompt
+ NEXOS_MASTER_EVOLUTION_PROMPT
+ memoryBlock
+ systemPrompt
+ DOMINO_SELF_CRITIC
```

---

## 4. `runJudgedAgent()` (`agent.runner.ts`)

Wraps `runAgent()` — only activates for 5 critical roles: `copywriter`, `vsl_script`, `offer`, `landing_page`, `hook_factory`.

Flow: run agent → judge → if score < 70: append critique as user message → re-run agent → judge again → save critique log → return best output.

Always falls back to original output if refinement throws.

**getVerticalLearnings signature:** `(verticalKey: string, workspaceId?: string)` — verticalKey is FIRST, workspaceId is second optional.
