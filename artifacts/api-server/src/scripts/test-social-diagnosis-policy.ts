import assert from "node:assert/strict";
import {
  assertSocialDiagnosisApproved,
  determineSocialDiagnosisStatus,
} from "../modules/campaigns/social-diagnosis.policy.js";
import { ValidationError } from "../lib/errors.js";

assert.throws(() => assertSocialDiagnosisApproved(true, {}), ValidationError, "active Social Media contract requires diagnosis approval");
assert.throws(() => assertSocialDiagnosisApproved(true, { socialDiagnosis: { status: "insufficient_data" } }), ValidationError);
assert.throws(() => assertSocialDiagnosisApproved(true, { socialDiagnosis: { status: "generated" } }), ValidationError);
assert.doesNotThrow(() => assertSocialDiagnosisApproved(true, { socialDiagnosis: { status: "approved" } }));
for (const campaignType of ["launch", "continuous_sales", "authority", "branding"]) {
  assert.doesNotThrow(() => assertSocialDiagnosisApproved(false, {}), `${campaignType} must not be gated without the contracted feature`);
}

assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: false }), "insufficient_data");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: true, citedPublicResearchAvailable: false }), "generated");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: true }), "generated");

console.log("✓ Social diagnosis policy: contract entitlement gates the diagnosis independent of campaign type");
