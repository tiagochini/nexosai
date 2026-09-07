import assert from "node:assert/strict";
import { calculateMasterplanReadiness, canonicalize, deterministicHash } from "../modules/masterplan/masterplan.service.js";
import { campaignContextPreamble } from "../modules/agents/campaign-action-context.js";

// Pure, no-migration test: deliberately does not touch a development database.
// DB lifecycle cases are covered by the service's tenant predicates and should be
// exercised only after a developer has explicitly applied migration 0008.
const unordered = { strategy: { b: 2, a: [{ z: true, y: false }] }, campaign: "abc" };
const ordered = { campaign: "abc", strategy: { a: [{ y: false, z: true }], b: 2 } };
assert.deepEqual(canonicalize(unordered), canonicalize(ordered));
assert.equal(deterministicHash(unordered), deterministicHash(ordered), "hash must be key-order deterministic");

const ready = calculateMasterplanReadiness({ objective: "launch" }, []);
assert.deepEqual(ready, { blockers: [], score: 100, status: "ready" });
const needsAttention = calculateMasterplanReadiness({ objective: "launch" }, [{ id: "clarification-1", question: "Preço?" }]);
assert.equal(needsAttention.score, 75);
assert.equal(needsAttention.status, "needs_attention");
const blocked = calculateMasterplanReadiness({}, [
  { id: "clarification-1", question: "Preço?" },
  { id: "clarification-2", question: "Data?" },
]);
assert.equal(blocked.score, 25);
assert.equal(blocked.status, "blocked");
assert.equal(blocked.blockers.length, 3, "strategy and pending clarification blockers are retained");

assert.match(campaignContextPreamble(false), /FALLBACK LEGADO EXPLÍCITO/);
assert.doesNotMatch(campaignContextPreamble(true), /FALLBACK LEGADO EXPLÍCITO/);
assert.match(campaignContextPreamble(true), /Masterplan aprovado/);
console.log("masterplan pure unit tests passed (DB isolation/materialize/approval require explicit migration application)");