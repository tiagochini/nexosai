---
name: Agent Clarification Feedback Loop
description: How agents request missing info from users mid-generation; parsing, storage, realtime, and frontend integration.
---

## Architecture

Fire-and-report pattern (non-blocking): agents complete their current run AND flag clarification needs. Answers are injected into subsequent runs.

## Agent Output Format

Agents append `__clarifications` to their JSON output:
```json
{
  "seuOutputNormal": "...",
  "__clarifications": [
    {
      "question": "...",
      "options": ["A", "B"],     // null = free text only
      "context": "...",           // why this info matters
      "isBriefingGap": true,      // was it missing from intake?
      "severity": "blocking"      // "blocking" | "normal" | "nice_to_have"
    }
  ]
}
```

Max 3 clarifications per agent run.

## Backend

- DB: `agent_clarification_requests` (lib/db/src/schema/agent-clarifications.ts)
- Parsing: `processClarificationsFromContent()` in agent.runner.ts (called after LLM, before emitAgentCompleted, non-blocking try/catch)
- Emitting: `emitClarificationNeeded()` in realtime.service.ts → `clarification_needed` socket event
- Context injection: `buildClarificationContextBlock(campaignId)` — exported from agent.runner.ts; returns formatted block of all answered clarifications for campaign
- Routes: `clarification.routes.ts` mounted at `/api/campaigns` — GET list, POST answer, POST dismiss
- Always use `String(req.params.x)` for param extraction in Express 5 (returns `string | string[]`)

## Frontend

- `AgentClarificationPanel` (artifacts/app/src/components/AgentClarificationPanel.tsx)
- Integrated in `detail.tsx` below the live events feed, shown when `isActive || liveEvents.length > 0`
- Listens for `clarification_needed` and `clarification_answered` socket events
- Options rendered as clickable buttons; free text as fallback or supplement
- Dismissed items removed locally + DB-dismissed

## Socket Events

Both events added to `CampaignEvent` type union in both:
- `artifacts/api-server/src/modules/realtime/realtime.service.ts`
- `artifacts/app/src/lib/socket.ts`

## Key Rule

`processClarificationsFromContent()` NEVER throws. It wraps everything in try/catch so agent execution is never blocked by clarification failures.

**Why:** Clarifications are a quality enhancement, not core execution. A parsing bug should never stop strategy or content generation.

## Answer Injection

`buildClarificationContextBlock(campaignId)` is exported for use in orchestration/agent context building. Future work: inject into `memoryContext` on each agent run for campaigns with answered clarifications.
