---
name: Simulation Exec Log Artifact
description: Why agentExecutionLogsTable shows 0 rows in the launch simulation — it's expected, not a bug
---

## Rule
WARN [19] "0 audit log(s)" in the NEXOS Full Launch Simulation is an artifact of the simulation design, NOT a production bug.

**Why:** The simulation uses `simulatePhaseCompletion()` which injects `campaign_agents` rows directly into the DB (with status=`completed`) AND force-updates campaign.status to the target phase. The real BullMQ strategy job starts processing but hits RC-010 guard ("campaign not in strategy-eligible state") because the status was already force-changed. No `runAgent` call → no `agentExecutionLogsTable` insert.

In REAL production (no simulation), the strategy agents run naturally and DO create exec_logs.

**Evidence:** When the real command agent runs in background (before RC-010 kicks in), its exec_log IS created — simulation shows "1 audit log(s) — [command]" in later runs where it races to completion before the force-status.

**How to apply:** Do not add workarounds to populate exec_logs during simulated phases. The simulation's force-completion is intentional for speed. The audit trail is verified in real runs and via the NEXOS Full Audit Test (DRY_RUN_MODE=true).
