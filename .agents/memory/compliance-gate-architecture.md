---
name: Compliance Gate Architecture
description: Market validation compliance model — what blocks vs. what generates regulatory alerts with self-proof.
---

## Rule

`isCriticalBlock=true` (pipeline hard stop) ONLY for intrinsically illegal content:
- Venda de entorpecentes ilícitos, pirâmide/Ponzi, instruções criminosas, CSAM, fraude de identidade declarada.

Everything else flows through with alerts, never blocks:

| Situation | Behavior |
|---|---|
| Regulated product (health/finance/law) | `requiresAcknowledgment=true` + `regulatoryAlerts[]` populated. Pipeline pauses → founder clicks "Confirmo ciência" → self-proof recorded → pipeline resumes. |
| Price incompatible with audience | `VIAVEL_COM_AJUSTES` + market alert + suggestions. Never blocks. |
| No digital presence / low authority | `VIAVEL_COM_AJUSTES` + suggestions. Never blocks. |
| Illegal/fraudulent content | `isCriticalBlock=true` + `INVIAVEL`. Hard stop. No override. |

## Self-proof flow

1. Validators run → `requiresAcknowledgment=true` on any validator → `command.agent.ts` returns early with `checkpointsPending: ["compliance_acknowledgment_pending"]`
2. `market_validation` checkpoint already saved → re-run skips validators entirely
3. Founder clicks "Confirmo ciência" → `POST /market-validation/acknowledge`
4. Records `acknowledgmentRecordedAt` + `acknowledgedByUserId` in `brainData.marketValidation`
5. Re-triggers strategy phase → resumes from checkpoint past validators

## Key files

- `market-validation.service.ts` — prompts + `computeOverallVerdict` (only `isCriticalBlock` → INVIAVEL)
- `command.agent.ts` STEP 0 — three-case logic: illegal / needsAck / proceed
- `execution.routes.ts` — `/acknowledge` (primary) + `/proceed` (legacy alias)
- `MarketValidationReview.tsx` — three panels: ComplianceBlockPanel / AcknowledgmentPanel / informational

## Why

Old model: ANY `INVIAVEL` verdict blocked the pipeline. A credentialed medical doctor (CRM ativo, 180+ alumni) was returning `brand_validator: INVIAVEL, score=18` because the prompt confused "regulated profession" with "no authority." Required admin curl override to continue.

New model: regulated product → VIAVEL_COM_AJUSTES + regulatory alerts + self-proof click. Validated: Dr. Rodrigo Pinheiro (CRM/SP 152847) now gets scores 87/86/86, `requiresAcknowledgment=true`, pipeline advances after one click. No override needed.
