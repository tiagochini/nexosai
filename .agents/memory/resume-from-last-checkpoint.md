---
name: Resume From Last Confirmed Checkpoint
description: Prevents repeated execution when long-running roadmap work resumes after pauses.
---

Always resume roadmap work from the last confirmed checkpoint. Do not restart a wave, migration, validation, or implementation sequence merely because time passed or the user asks what comes next.

**Why:** Repeating completed work wastes time and can create duplicate records, migrations, external actions, costs, and confusing status reports.

**How to apply:** Before acting, state the last completed checkpoint, the exact next unfinished action, and any user-only action. Re-run a completed operation only when later changes invalidated its result or explicit verification is required, and explain that reason.