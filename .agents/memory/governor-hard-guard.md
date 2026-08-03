---
name: Governor Hard-Guard Pattern
description: execution-governor reads intake keys too — same key mismatch as command.agent.ts; fix pattern for flag-driven agents the LLM must never skip.
---

## The Rule
Any agent whose activation is controlled by a programmatic flag (e.g. `hasTraffic`) must be protected by a **deterministic post-LLM guard** inside `runExecutionGovernor()` that removes it from `skippedAgents` when the flag is true — regardless of what the LLM decided.

## Why
`execution-governor.agent.ts` computes its own budget display (`const budget = Number(intakeData["campaign.trafficBudget"] ?? 0)`) and passes it to the LLM prompt as `**Budget de tráfego: R$...`**. When the intake stores the traffic budget under a DIFFERENT key (`campaign.budget.traffic`), the governor shows `R$0`, the LLM interprets "no declared budget" → skips `traffic_intelligence` — even though `hasTraffic=true` was passed as a separate boolean. The LLM gives more weight to the numeric evidence it can see.

## How to Apply
1. **Fix the key read** in `execution-governor.agent.ts` to match whichever keys command.agent.ts checks (always use the same dual-key fallback pattern):
   ```ts
   const budget = Number(
     intakeData["campaign.budget.traffic"] ??
     intakeData["campaign.trafficBudget"] ??
     0,
   );
   ```
2. **Add a hard post-LLM guard** after `parseAgentJSON`:
   ```ts
   if (hasTraffic) {
     plan.skippedAgents = (plan.skippedAgents ?? []).filter(
       (a) => a !== "traffic_intelligence",
     );
   }
   return plan;
   ```
3. **General pattern**: for any future flag-driven agent, apply the same guard: `if (flagIsTrue) plan.skippedAgents = plan.skippedAgents.filter(a => a !== agentId)`.

## Root Cause of the Original Bug
`traffic_intelligence` had 0 runs across all campaigns because:
- `command.agent.ts` checked `campaign.trafficBudget` (old key) for `hasTraffic` — campaign stored budget as `campaign.budget.traffic` (new intake key) → `hasTraffic=false` → gate never reached
- Even after fixing command.agent.ts to check the new key, `hasTraffic=true` but governor still saw `budget=0` → skipped the agent anyway

Both layers needed the same fix.
