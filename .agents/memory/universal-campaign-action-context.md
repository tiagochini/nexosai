---
name: Universal Campaign Action Context
description: Durable context and isolation contract for every agent execution.
---

Every `runAgent` execution must receive a bounded snapshot derived from the
client's final objective, approved/current plan, market intelligence, strategy,
offer psychology, sales context, launch stage, constraints, decisions and relevant
memory. Selection is role-specific; agents receive what they need, not an
unbounded history dump.

**Why:** Caller-specific prompt assembly left some agents deeply informed and
others operating on isolated briefs. That causes locally plausible work that is
misaligned with the client's development, sales and launch plan.

**How to apply:** Resolve campaign and workspace together, fingerprint/version
the snapshot, enforce section and total limits, and inject it even for lightweight
runner modes. Approved campaign context outranks ad-hoc caller context and generic
doctrine. Never cache or query by campaign alone. Direct SDK paths are not covered
until migrated through the shared runner/context contract.