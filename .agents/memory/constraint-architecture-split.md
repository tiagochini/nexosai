---
name: Constraint Architecture Split
description: StrategicBrief.prohibitedPromises replaced by two-tier constraint system; offer agent respects appealIntensity setting.
---

## Rule
`StrategicBrief.prohibitedPromises` no longer exists. It was split into:
- `hardConstraints: string[]` — legal/platform violations (CDC, CONAR, Meta/Google/TikTok ad policy) or claims that cause account ban. **Never optional**, regardless of `appealIntensity`.
- `boldnessOpportunities: { claim: string; containmentReason: string }[]` — language that could be more aggressive within the law but was self-restrained for brand safety.

`runOfferAgent()` now accepts three extra trailing params:
```ts
hardConstraints?: string[],
boldnessOpportunities?: { claim: string; containmentReason: string }[],
appealIntensity?: "protegido" | "ousado",
```

When `appealIntensity === "ousado"`, the offer prompt explicitly **authorises and incentivises** the LLM to use each `boldnessOpportunities[].claim` at full strength while `hardConstraints` remain as absolute restrictions.

`command.agent.ts` reads `intakeData["campaign.appealIntensity"]` and passes it. No schema migration needed — `appealIntensity` lives in `intakeData` JSONB.

**Why:** The previous flat `prohibitedPromises` list treated brand-safety self-restraints the same as real legal violations. This caused the offer `overallScore` to drop (84→72) even for items that weren't legally prohibited — just conservatively worded. The split lets the founder choose boldness level without touching legal safety rails.

**How to apply:** Any code that previously read `brief.prohibitedPromises` must now read `brief.hardConstraints`. Files already updated: command.agent.ts, campaign-memory.service.ts, strategic-doctrine.agent.ts, strategy.agent.ts, offer.agent.ts.
