---
name: Backend Hardening Invariants
description: Non-negotiable reliability and isolation rules for multitenant backend work.
---

Every user-triggered read, mutation, provider call and status write must be scoped by the authenticated workspace, even when the record ID is globally unique.

**Why:** UUID secrecy is not authorization; an unscoped publish, metrics sync, report read or rollback can affect another tenant.

**How to apply:** Carry workspace identity through service boundaries and include it in every relationship lookup and mutation predicate. Tests must use two workspaces and assert zero external calls for foreign IDs.

Credit debits must serialize against the current database balance and keep the ledger chain consistent.

**Why:** Reading a balance and later writing an absolute value loses one debit when different idempotency keys execute concurrently.

**How to apply:** Lock or atomically decrement inside the transaction, then derive before/after values from that serialized state.

Ambiguous queue acknowledgement must fail closed, and boot recovery must be stale-only.

**Why:** A queue may persist a job before the client sees an error; direct fallback would then duplicate execution. A second live instance must never globally fail active work or drain diagnostic evidence.

**How to apply:** Reconcile deterministic job IDs before fallback, use durable phase claims for direct execution, preserve failed jobs, and recover only records older than a defensible heartbeat threshold.