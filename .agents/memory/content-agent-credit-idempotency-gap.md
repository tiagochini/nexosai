---
name: Content Agent Credit Idempotency Gap
description: content.service.ts deducts credits without setting an idempotency_key — unlike agent.runner.ts [C3] guard. 43 transactions recorded with empty key during JORNADA LIMPA #1.
---

# Content Agent Credit Idempotency Gap

## Rule
Credit deductions made directly by `content.service.ts` (not via `agent.runner.ts`) bypass the [C3] `ON CONFLICT DO NOTHING` idempotency guard because they pass an empty/null `idempotency_key` to `deductCredits()`.

**Why:** `agent.runner.ts` sets `idempotencyKey: "${campaignId}:${agentRole}"`. The content service's direct deductions pass no key, so the DB unique-constraint check is skipped. This means concurrent or repeated content-phase runs can double-charge credits for content pieces.

**How to apply:** Any call to `deductCredits()` in `content.service.ts` must pass a non-null `idempotencyKey` — format: `"${campaignId}:${contentType}:${pieceIndex}"`. Audit all call sites in `artifacts/api-server/src/modules/content/content.service.ts`.

## Observed in production
JORNADA LIMPA #1: 43 of 70 credit transactions had empty idempotency_key (all content-phase). Zero duplicates on strategy agents (all had keys). Strategy [C3] = protected. Content = unprotected.
