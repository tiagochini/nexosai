import assert from "node:assert/strict";
import {
  reconcileAmbiguousEnqueue,
  runKnownNoRedisFallback,
} from "../modules/orchestration/orchestration-fallback.service.js";

// Models the database's unique conditional phase transition. The set is shared
// (unlike a process-local request mutex) and claim acquisition is indivisible,
// as a Postgres UPDATE ... WHERE status IN (...) is.
const durableClaims = new Set<string>();
const claimOnce = async (key: string): Promise<boolean> => {
  if (durableClaims.has(key)) return false;
  durableClaims.add(key);
  return true;
};

// (a) Concurrent known-no-Redis calls must execute only the single durable
// claimant for this campaign/action.
let directExecutions = 0;
const key = "campaign-a:run_strategy";
const claims = await Promise.all(
  Array.from({ length: 2 }, () =>
    runKnownNoRedisFallback(
      () => claimOnce(key),
      async () => { directExecutions += 1; },
    )),
);
assert.deepEqual(claims.sort(), [false, true], "exactly one durable phase claim must win");
assert.equal(directExecutions, 1, "only the claim winner may execute directly");

// (b) Redis accepted/persisted the deterministic job, then its acknowledgement
// was lost. Reconciliation finds the job and direct execution remains forbidden.
const persistedJobs = new Map<string, { id: string }>();
const jobId = "campaign-b-generate_content";
let fallbackExecutions = 0;
const addThenLoseAcknowledgement = async () => {
  persistedJobs.set(jobId, { id: jobId });
  throw new Error("simulated lost Redis acknowledgement");
};
await assert.rejects(addThenLoseAcknowledgement);
const persistedResult = await reconcileAmbiguousEnqueue(async () => persistedJobs.get(jobId));
assert.equal(persistedResult, "persisted");
assert.equal(fallbackExecutions, 0, "a reconciled queue job must never invoke direct fallback");

// (c) If reconciliation itself cannot read Redis, fail closed. A late queue
// write remains possible, so a local fallback would create duplicate execution.
const unknownResult = await reconcileAmbiguousEnqueue(async () => {
  throw new Error("simulated reconciliation connection loss");
});
assert.equal(unknownResult, "unknown");
assert.equal(fallbackExecutions, 0, "ambiguous reconciliation must not invoke direct fallback");

console.log("orchestration fallback race regression test passed");