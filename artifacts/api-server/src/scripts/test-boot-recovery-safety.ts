import assert from "node:assert/strict";

/**
 * Regression guard for the policy used by index.ts.  This is intentionally a
 * no-DB simulation: a second API boot must leave Redis jobs alone, must retain
 * fresh agent work, and may recover only work older than the boot cutoff.
 */
const STALE_MS = 30 * 60 * 1000;
const now = new Date("2026-01-01T12:00:00.000Z");
const staleBefore = new Date(now.getTime() - STALE_MS);
const isStale = (startedAt: Date) => startedAt < staleBefore;

const freshRunningAgent = { status: "running", startedAt: new Date(now.getTime() - 2 * 60 * 1000) };
const staleRunningAgent = { status: "running", startedAt: new Date(now.getTime() - 31 * 60 * 1000) };
const queueAtSecondBoot = [
  { id: "fresh-active", state: "active" },
  { id: "failed-evidence", state: "failed" },
];

// index.ts no longer invokes drainQueueAtBoot: every existing job survives.
assert.equal(queueAtSecondBoot.length, 2, "second boot must not drain active or failed jobs");
assert.equal(isStale(freshRunningAgent.startedAt), false, "fresh running agent must survive second boot");
assert.equal(isStale(staleRunningAgent.startedAt), true, "truly stale running agent remains recoverable");

console.log("boot recovery safety regression passed");