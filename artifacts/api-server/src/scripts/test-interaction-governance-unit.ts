import assert from "node:assert/strict";
import { boundInteractionPayload, evaluateInteractionGate, validateInteractionDraft } from "../modules/market-intel/interaction-governance.service.js";

const base = { policy: { enabled: true, maximumRiskScore: 50, requireApproval: true }, capability: { officialAdapter: true, enabled: true, allowsAutomaticExecution: true, requiresOwnedAsset: true }, integrationHealthy: true, action: "public_comment" as const, evidence: { source: "verified" }, context: { topic: "real" }, riskScore: 10, optedOut: false, duplicate: false, cooldown: false, lawfulBasis: "permitted", contactable: true, assetOwned: true, conversationOwned: false, automatic: false };
assert.equal(evaluateInteractionGate(base).decision, "requires_approval");
assert.equal(evaluateInteractionGate({ ...base, capability: { ...base.capability, officialAdapter: false } }).decision, "blocked", "a permissive recommendation cannot override unofficial capability");
assert.equal(evaluateInteractionGate({ ...base, capability: { ...base.capability, enabled: false } }).decision, "blocked");
assert.match(evaluateInteractionGate({ ...base, automatic: true, assetOwned: false, conversationOwned: false }).reasons.join(","), /owned/);
assert.match(evaluateInteractionGate({ ...base, riskScore: 99 }).reasons.join(","), /risk/);
assert.match(evaluateInteractionGate({ ...base, optedOut: true, cooldown: true }).reasons.join(","), /opted_out.*cooldown/);
assert.match(evaluateInteractionGate({ ...base, action: "private_message", lawfulBasis: "unknown", contactable: false }).reasons.join(","), /lawful/);
assert.throws(() => validateInteractionDraft("texto", 6, []), /CTA/);
assert.throws(() => validateInteractionDraft("Texto  contextual", 1, ["texto contextual"]), /similaridade/);
assert.throws(() => validateInteractionDraft("Oferta exclusiva para você hoje agora", 1, ["Oferta exclusiva para você hoje agora mesmo"]), /similaridade/);
const oversized = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
assert.equal(Object.keys(boundInteractionPayload(oversized)).length, 20, "downstream context is bounded");
console.log("interaction governance pure unit tests passed");