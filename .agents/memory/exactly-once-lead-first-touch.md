---
name: Exactly-once lead first touch
description: Durable execution rules for converting an approved campaign plan into safe individual lead outreach.
---

First contact is an execution boundary per workspace, sequence, contact, item, channel and approved Master Plan version. A shared sequence item must remain available until every eligible contact has its own terminal attempt.

**Why:** Global item state, unfenced leases, stale plan bindings, and overlapping legacy schedulers can duplicate messages or let one invalid contact block every valid lead in a workspace.

**How to apply:** Strictly partition first-touch items from legacy dispatch; use stable internal idempotency, atomic provider-dispatch claims and lease-owner fencing for every outcome. Treat uncertain provider mutations as ambiguous and never retry them blindly. Candidate selection must skip future retries and fresh leases, terminalize stale bindings, and require a channel-compatible recipient. Validate with real PostgreSQL concurrency fixtures, not only pure models or schema checks.