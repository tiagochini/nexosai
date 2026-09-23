---
name: Universal Realization Contracts
description: Durable rules for extending the M09 realization lifecycle to additional action families.
---

Realization contracts govern exactly two proven families today: `paid_media_pause` and `paid_media_launch`. New families remain unsupported until they have a real executor, independent readback, semantic QC, monitoring, bounded retry, recovery, and verified compensation semantics.

**Why:** A generic ledger without composition to real executors creates false evidence. Approval or provider receipt alone cannot prove completion, and ambiguous outcomes must never be promoted to success.

**How to apply:** Keep immutable Master Plan and subject binding in the generic contract, create a durable attempt before provider I/O, delegate mutation to the existing family executor, require receipt plus matching readback, and append QC/monitor/recovery evidence. Never rewrite family adapters inside the generic layer.