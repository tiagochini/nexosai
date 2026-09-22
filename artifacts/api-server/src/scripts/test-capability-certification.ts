import assert from "node:assert/strict";
import {
  CAPABILITY_REGISTRY,
  CERTIFICATION_DIMENSIONS,
} from "../modules/capabilities/capability-registry.js";
import { evaluateCapabilityCertification } from "../modules/capabilities/capability-certification.service.js";

const [paidMedia] = CAPABILITY_REGISTRY.filter((item) => item.key === "paid_media");
assert.equal(CAPABILITY_REGISTRY.length, 22);
assert.equal(new Set(CAPABILITY_REGISTRY.map((item) => item.key)).size, 22);
assert.equal(CAPABILITY_REGISTRY.filter((item) => item.baseline === "PARTIAL").length, 20);
assert.equal(CAPABILITY_REGISTRY.filter((item) => item.baseline === "BLOCKED").length, 2);
assert.ok(paidMedia);

const proof = (details: Record<string, unknown> = {}, subjectType = "paid_media_attempt") => ({
  workspaceId: "workspace-1", subjectType, state: "provider_confirmed",
   masterplanVersionId: "plan-1", contextFingerprint: "fingerprint-1", contentHash: "sha256:approved-plan",
  details: {
    receipt: { id: "receipt-1" }, readback: { id: "entity-1" },
    certification: {
      capabilityKey: "paid_media",
       source: "trusted_paid_media_executor",
      environment: "provider_sandbox",
      independentlyVerified: true,
      dimensions: CERTIFICATION_DIMENSIONS,
      deterministicExecutorVerified: true,
      tenantIsolationVerified: true,
      idempotencyVerified: true,
      failureInjected: true,
      recoveryVerified: true,
      masterPlanContentHash: "sha256:approved-plan",
    },
    ...details,
  },
});

const healthy = evaluateCapabilityCertification(paidMedia!, [proof()]);
assert.equal(healthy.health, "HEALTHY");
for (const dimension of CERTIFICATION_DIMENSIONS) assert.ok(healthy.verifiedDimensions.includes(dimension));
for (const bad of ["mock", "fixture", "test", "simulated", "local", "dryRun"]) {
  assert.notEqual(evaluateCapabilityCertification(paidMedia!, [proof({ [bad]: true })]).health, "HEALTHY");
}
assert.notEqual(evaluateCapabilityCertification(paidMedia!, [proof({ receipt: undefined, readback: undefined })]).health, "HEALTHY");
assert.notEqual(evaluateCapabilityCertification(paidMedia!, [proof({
  certification: { ...proof().details.certification as object, recoveryVerified: false },
})]).health, "HEALTHY");
assert.notEqual(evaluateCapabilityCertification(paidMedia!, [{
  ...proof(), masterplanVersionId: null,
}]).health, "HEALTHY");
assert.notEqual(evaluateCapabilityCertification(paidMedia!, [proof({
  certification: { ...proof().details.certification as object, environment: "local" },
})]).health, "HEALTHY");
assert.equal(evaluateCapabilityCertification(paidMedia!, [proof({}, "unrelated_subject")]).verified, false);

// A legacy row with a real receipt/readback can establish only the dimensions
// objectively present on that row; success never implies recovery or binding.
const legacy = evaluateCapabilityCertification(paidMedia!, [{
  subjectType: "paid_media_attempt", state: "provider_confirmed", masterplanVersionId: "plan-1",
  details: { providerRequestId: "req-1", verification: { id: "entity-1" } },
}]);
assert.deepEqual(legacy.verifiedDimensions.sort(), ["independent_provider_evidence", "material_execution"].sort());
assert.ok(legacy.missingDimensions.includes("failure_injection_recovery"));
assert.ok(legacy.missingDimensions.includes("approved_master_plan_binding"));

console.log("capability certification tests passed");