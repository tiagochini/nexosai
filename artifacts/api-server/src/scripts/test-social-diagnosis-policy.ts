import assert from "node:assert/strict";
import {
  assertSocialDiagnosisApproved,
  determineSocialDiagnosisStatus,
  SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES,
} from "../modules/campaigns/social-diagnosis.policy.js";
import { ValidationError } from "../lib/errors.js";

for (const type of SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES) {
  assert.throws(() => assertSocialDiagnosisApproved(type, {}), ValidationError, `${type} must be blocked without approval`);
  assert.throws(() => assertSocialDiagnosisApproved(type, { socialDiagnosis: { status: "insufficient_data" } }), ValidationError);
  assert.throws(() => assertSocialDiagnosisApproved(type, { socialDiagnosis: { status: "generated" } }), ValidationError);
  assert.doesNotThrow(() => assertSocialDiagnosisApproved(type, { socialDiagnosis: { status: "approved" } }));
}

for (const type of ["authority", "audience_growth", "continuous_sales", "branding"]) {
  assert.doesNotThrow(() => assertSocialDiagnosisApproved(type, {}), `${type} must not be gated by the launch diagnosis`);
}

assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: false }), "insufficient_data");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: true, citedPublicResearchAvailable: false }), "generated");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: true }), "generated");

console.log("✓ Social diagnosis policy: required launch types gated, other campaign types unaffected, evidence sufficiency enforced");
