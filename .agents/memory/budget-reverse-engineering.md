---
name: Budget Reverse Engineering
description: Design decisions and gotchas for the budget reverse-engineering feature (Engenharia Reversa de Orçamento)
---

# Budget Reverse Engineering

## The Rule
When `campaign.budget.traffic` is missing/0 AND `campaign.revenueTarget > 0` AND `product.price > 0`,
the system must NEVER silently skip targeting + media_buying agents. Instead it:
1. Calls `calculateReverseBudget()` → returns `ReverseBudgetResult` with budgetMin/Mid/Pessimistic
2. Persists to `campaigns.brainData.budgetProposal`
3. Injects `agentIntakeData` with the proposed budget so agents run transparently
4. Saves pieces with `status = "budget_proposed"` (not `"pending_approval"`)
5. User resolves via `POST /campaigns/:id/budget-decision`

**Why:** Users who don't know their budget should still get complete targeting/media plans,
just flagged as "pending confirmation." Silent skipping was the most confusing UX gap.

## Key files
- `content/budget-reverse.service.ts` — `calculateReverseBudget()`, `saveBudgetProposal()`
- `content/budget-decision.service.ts` — `applyBudgetDecision()` (4 decisions)
- `intake/intake.simulation.ts` — `reverseBudget()` pure function (exported)
- `lib/db/src/schema/content.ts` — `"budget_proposed"` in `contentStatusEnum`

## Budget decision flow
- `approve_proposed` — confirms proposal budget → re-runs agents → pieces become `pending_approval`
- `enter_own` — user provides their own budget → re-runs agents
- `organic_only` — deletes budget_proposed pieces, marks campaign as organic-only in brainData
- `seed_launch` — graduated ramp (30%→60%→100% over 3 weeks), stored in `brainData.seedLaunch`

## Test gotcha
- `content.service.ts` reads intake from `campaign.intakeData` column (NOT `brainData.intakeData`)
- When seeding test campaigns via SQL, always populate the `intake_data` column directly
- Probe account (step0probe@nexos.dev) has 0 credits by default — grant 500 credits to let
  targeting agents actually run past the deductCredits check

## Draft-sweep safety
The final draft→pending_approval sweep in `generateCampaignContent` only touches
`status = "draft"` — so `budget_proposed` pieces are never accidentally promoted.
