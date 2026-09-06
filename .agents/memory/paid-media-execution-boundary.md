---
name: Paid Media Execution Boundary
description: Durable safety and ownership rules for Meta Ads and TikTok Ads optimization.
---

Paid-media intelligence may recommend actions, but only the deterministic execution layer may mutate provider state. Every external mutation must be tied to a selected advertiser account, enforce current autonomy and mandatory-pause gates, capture an immutable before snapshot, use an idempotency key, verify state by reading it back, and retain rollback evidence.

OAuth credentials for paid media and organic social must remain purpose-separated even when legacy records share a provider name. Reauthorization must update only the matching purpose/account record; it must never delete every integration row for a provider.

**Why:** Advertising APIs change real budgets and delivery. Treating an LLM recommendation as an executable command would bypass workspace isolation, approved limits, human approval for cross-platform allocation, and recoverability. Legacy Meta storage also used `meta_ads` for organic Facebook Pages, so provider-wide replacement can silently destroy social publishing access.

**How to apply:** Classify integration records by purpose, filter credential resolvers accordingly, and preserve legacy organic rows. Keep organic social identities separate from advertising account IDs. Meta Ads uses `act_...` advertiser accounts; TikTok Ads uses advertiser IDs rather than Login Kit `open_id`. Intraplatform changes may auto-execute only inside explicit account policy limits. Any cross-platform budget movement always requires human approval against an immutable simulation.