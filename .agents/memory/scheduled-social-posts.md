---
name: Scheduled Social Authorization
description: Why campaign scheduling must fail closed without immutable preview and policy evidence.
---

Campaign content approval or sequence activation is not itself authorization to publish to a connected account. Automatic scheduling needs a durable, exact binding to the approved payload, destination, Master Plan version and a separately accepted publication policy. Historical rows without that proof must remain auditable and stop before any provider mutation; never reconstruct the proof from their current values.

**Why:** Campaign scheduling once treated approved status plus a connected integration as sufficient and could send changed content later. A current Master Plan context fingerprint identifies strategy context, not the exact post the user saw. Creating a new fingerprint at execution time would manufacture consent.

**How to apply:** Every future scheduled or silence-triggered publisher must check the persisted authorization and final preview binding before sending. Preserve old rows for explicit reconciliation; do not delete, silently retry, or equate a failed row with permission. Explicit user confirmation of a fresh preview is a separate path and does not retroactively authorize prior attempts.