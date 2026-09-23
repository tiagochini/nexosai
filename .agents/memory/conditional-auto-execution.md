---
name: Conditional auto-execution
description: Safety contract for any automatic provider mutation authorized by a campaign policy.
---

An approval is evidence, never execution authorization. Automatic provider work requires a separate current, versioned, owner-authorized, expiring policy bound to the exact approved plan snapshot and context.

**Why:** Provider mutations cannot be rolled back reliably after network uncertainty. A durable attempted marker, cross-process serialization and independent readback are required to prevent duplicate or falsely confirmed work.

**How to apply:** Persist intent and attempt before provider I/O; share the campaign lock with policy creation/revocation; keep protected reads and final writes on the lock-owning session; restart in readback-only mode; report success only when provider receipt and independent readback agree. Any ambiguity becomes recovery-required.