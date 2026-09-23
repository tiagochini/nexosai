---
name: Post-merge database migrations
description: Safety rule for database reconciliation after isolated task merges.
---

Post-merge setup must be fully non-interactive and apply only new, tracked SQL migrations. Do not use whole-schema `drizzle-kit push` in this path, and never enable automatic data-loss acceptance or truncation.

**Why:** Closed stdin does not reliably terminate Drizzle's selection prompt; setup timed out while asking whether to truncate a populated table to add a constraint. Automatically forcing that prompt would risk data loss.

**How to apply:** Keep a database-backed migration ledger with checksums and an advisory lock. Baseline the legacy push-created development schema once, execute each subsequent SQL migration transactionally exactly once, reject edits to already-applied migrations, and allow enough setup time for dependency installation.