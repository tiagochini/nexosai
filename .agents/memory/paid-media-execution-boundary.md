---
name: Paid Media Execution Boundary
description: Durable safety and ownership rules for Meta Ads and TikTok Ads optimization.
---

Paid-media intelligence may recommend actions, but only the deterministic execution layer may mutate provider state. Every external mutation must be tied to a selected advertiser account, enforce current autonomy and mandatory-pause gates, capture an immutable before snapshot, use an idempotency key, verify state by reading it back, and retain rollback evidence.

OAuth credentials for paid media and organic social must remain purpose-separated even when legacy records share a provider name. Reauthorization must update only the matching purpose/account record; it must never delete every integration row for a provider.

Provider connection capability is independent from launch-tree execution capability. Meta Ads, Google Ads and TikTok Ads must all be connectable by OAuth or manual API credentials from day one; a provider may still be blocked from automatic campaign creation until its deterministic executor is homologated.

A launch tree must execute as a persisted, lease-fenced saga. Preinsert stable ordered steps before the first provider call; persist each provider ID before independent readback; resume from verified steps only after fresh validation; and compensate in reverse dependency order with verified absence. A batch create method is not durable enough because a crash can leave untracked provider entities.

Persist a pre-mutation intent before every provider create/delete. If the transport outcome is ambiguous and the provider cannot reconcile the intent, stop for manual recovery; never retry a non-idempotent mutation based only on a custom idempotency header.

Approved spend must be represented once, in provider minor units, at the chosen budget level. The emitted allocation and provider readback totals must exactly equal the immutable authorization. Never infer daily versus lifetime semantics, and never place the same authorization at campaign and ad-set levels.

**Why:** Advertising APIs change real budgets and delivery. Treating an LLM recommendation as an executable command would bypass workspace isolation, approved limits, human approval for cross-platform allocation, and recoverability. Legacy Meta storage also used meta_ads for organic Facebook Pages, so provider-wide replacement can silently destroy social publishing access. Batch provider calls also hide partial success from the database, making safe retry and rollback impossible.

**How to apply:** Classify integration records by purpose and bind every create/read/delete to the selected paid account's exact integration. Never hide or disable provider connection based on launchTreeCreation; apply that capability only to compile, approval and activation actions. Keep organic identities separate from advertiser IDs. Claim execution with an expiring owner lease; fence heartbeats, completion and compensation by owner; persist intent before mutation and provider IDs before readback; disable automatic retries for non-idempotent calls; and stop destructive work immediately when lease ownership is lost. Meta Ads uses act_ advertiser accounts; TikTok Ads uses advertiser IDs rather than Login Kit open_id. Intraplatform changes may auto-execute only inside explicit account policy limits. Any cross-platform budget movement always requires human approval against an immutable simulation.
