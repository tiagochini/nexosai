import assert from "node:assert/strict";
import { REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS, REQUIRED_CAMPAIGN_CORE_FIELDS, REQUIRED_MASTERPLAN_QUALITY_FIELDS, REQUIRED_TRIGGER_MAP_FIELDS } from "@workspace/api-zod";
import { calculateMasterplanReadiness, canonicalize, deterministicHash, matchesApprovedDossier } from "../modules/masterplan/masterplan.service.js";
import { campaignContextPreamble } from "../modules/agents/campaign-action-context.js";

// Pure, no-migration test: deliberately does not touch a development database.
// DB lifecycle cases are covered by the service's tenant predicates and should be
// exercised only after a developer has explicitly applied migration 0008.
const unordered = { strategy: { b: 2, a: [{ z: true, y: false }] }, campaign: "abc" };
const ordered = { campaign: "abc", strategy: { a: [{ y: false, z: true }], b: 2 } };
assert.deepEqual(canonicalize(unordered), canonicalize(ordered));
assert.equal(deterministicHash(unordered), deterministicHash(ordered), "hash must be key-order deterministic");

const requiredFields = [
  ...REQUIRED_CAMPAIGN_CORE_FIELDS,
  ...REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS,
  ...REQUIRED_MASTERPLAN_QUALITY_FIELDS,
  ...REQUIRED_TRIGGER_MAP_FIELDS.map((field) => ({ ...field, path: `triggerMap.${field.path}` })),
];
function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let current = target;
  for (const key of keys.slice(0, -1)) {
    const child = current[key];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
}
const completeStrategy: Record<string, unknown> = {};
for (const field of requiredFields) {
  setPath(completeStrategy, field.path, field.kind === "list" ? ["validated fixture"] : field.kind === "number" ? 1 : "Validated fixture");
}
const ready = calculateMasterplanReadiness(completeStrategy, []);
assert.deepEqual(ready, { blockers: [], score: 100, status: "ready" });
const needsAttention = calculateMasterplanReadiness(completeStrategy, [{ id: "clarification-1", question: "Preço?" }]);
assert.equal(needsAttention.score, 100, "clarifications do not erase completed strategy fields");
assert.equal(needsAttention.status, "blocked");
assert.equal(needsAttention.blockers[0]?.type, "clarification");
const incompleteStrategy = structuredClone(completeStrategy);
setPath(incompleteStrategy, "executiveSummary", "");
setPath(incompleteStrategy, "bigDomino", "");
const blocked = calculateMasterplanReadiness(incompleteStrategy, [
  { id: "clarification-1", question: "Data?" },
]);
assert.equal(blocked.score, Math.round(((requiredFields.length - 2) / requiredFields.length) * 100));
assert.equal(blocked.status, "blocked");
assert.equal(blocked.blockers.length, 3, "missing fields and pending clarification blockers are retained");

assert.match(campaignContextPreamble(false), /FALLBACK LEGADO EXPLÍCITO/);
assert.doesNotMatch(campaignContextPreamble(true), /FALLBACK LEGADO EXPLÍCITO/);
assert.match(campaignContextPreamble(true), /Masterplan aprovado/);
const approvedDossier = { id: "approved-v2", contextFingerprint: "f".repeat(64) };
assert.equal(matchesApprovedDossier(approvedDossier, { campaignId: "campaign-1", masterplanVersionId: "approved-v2", contextFingerprint: "f".repeat(64) }), true);
assert.equal(matchesApprovedDossier(approvedDossier, { campaignId: "campaign-1", masterplanVersionId: null, contextFingerprint: "f".repeat(64) }), false, "missing dossier must fail closed");
assert.equal(matchesApprovedDossier(approvedDossier, { campaignId: "campaign-1", masterplanVersionId: "approved-v1", contextFingerprint: "f".repeat(64) }), false, "superseded dossier must fail closed");
assert.equal(matchesApprovedDossier(approvedDossier, { campaignId: "campaign-1", masterplanVersionId: "approved-v2", contextFingerprint: "e".repeat(64) }), false, "stale fingerprint must fail closed");
console.log("masterplan pure unit tests passed (DB isolation/materialize/approval require explicit migration application)");
