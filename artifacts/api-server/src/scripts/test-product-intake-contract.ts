import assert from "node:assert/strict";
import { PRODUCT_INTAKE_ENTRY_POINTS, affectedSurfaceKeys, canonicalIntakeSnapshot, continueDecision, exactProductBinding, intakeResponseSemantics, resolveUnambiguousSubscription, successorVersion } from "../modules/product-intake/product-intake.contracts.js";

// Provider-free contract coverage for the canonical intake boundary.
assert.equal(new Set(PRODUCT_INTAKE_ENTRY_POINTS).size, 4);
for (const entryPoint of PRODUCT_INTAKE_ENTRY_POINTS) assert.equal(continueDecision(true), "continue_or_review", entryPoint);
assert.equal(continueDecision(false), "create_other_product_or_start");
assert.equal(successorVersion(3, "approved"), 4);
assert.equal(successorVersion(3, "locked"), 4);
assert.equal(successorVersion(3, "draft"), 3);
assert.equal(exactProductBinding({ workspaceId: "w1", commercialProductId: "p1", intakeProductId: "p1" }, { workspaceId: "w1", commercialProductId: "p1", intakeProductId: "p1" }), true);
assert.equal(exactProductBinding({ workspaceId: "w2", commercialProductId: "p1", intakeProductId: "p1" }, { workspaceId: "w1", commercialProductId: "p1", intakeProductId: "p1" }), false);
assert.equal(resolveUnambiguousSubscription([{ id: "s1", productId: "p1" }])?.id, "s1");
assert.equal(resolveUnambiguousSubscription([{ id: "s1", productId: "p1" }, { id: "s2", productId: "p2" }]), null);
assert.deepEqual(canonicalIntakeSnapshot({ approved: true, productMatches: true }, { canonical: true }, { stale: true }), { canonical: true });
assert.throws(() => canonicalIntakeSnapshot({ approved: false, productMatches: true }, { canonical: true }, {}));
assert.deepEqual(intakeResponseSemantics("draft"), { canonicalCurrent: false, draft: true });
assert.deepEqual(intakeResponseSemantics("approved"), { canonicalCurrent: true, draft: false });
assert.deepEqual(intakeResponseSemantics("locked"), { canonicalCurrent: true, draft: false });
assert.deepEqual(affectedSurfaceKeys(), ["launch", "marketIntel", "socialMedia", "paidMedia"]);
console.log("product intake provider-free contract tests passed");