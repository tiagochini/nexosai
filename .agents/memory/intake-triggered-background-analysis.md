---
name: Intake-triggered background analysis pattern
description: Rules for modules that auto-trigger AI analyses from intake and reuse prior reports (market-intel is the first instance)
---

Rules learned building the market-intel module (apply to any future intake-triggered background AI analysis):

- **Never re-link a report already owned by another campaign.** Reuse heuristics must filter `campaignId IS NULL` — re-pointing strips the older campaign's context injection silently.
- **Why:** context lookups are by campaignId; hijacking the row breaks the original campaign with no error anywhere.
- **Idempotency checks must exclude `status=failed`** or one failed background run blocks retries forever while the ready-only context builder returns null — a permanent dead end.
- **Substring-match reuse needs a minimum length (≥4 chars) and product-name-only matching.** OR-matching on market/niche alone matches nearly everything in a workspace.
- **Any route accepting an optional `campaignId` must verify campaign ownership against the workspace** before passing it downstream — `runAgent` inserts campaign_agents rows and emits Socket.io to `campaign:{id}` for any UUID (IDOR).
- **How to apply:** copy `campaignBelongsToWorkspace()` from market-intel.service.ts; check-then-insert idempotency without a unique constraint is acceptable only when worst case is duplicate LLM spend, not corruption.
