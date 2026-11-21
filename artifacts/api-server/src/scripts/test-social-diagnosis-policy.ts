import assert from "node:assert/strict";
import {
  assertSocialDiagnosisApproved,
  determineSocialDiagnosisStatus,
} from "../modules/campaigns/social-diagnosis.policy.js";
import { AppError } from "../lib/errors.js";

assert.throws(() => assertSocialDiagnosisApproved({}), (error) => error instanceof AppError && error.code === "SOCIAL_DIAGNOSIS_REQUIRED", "diagnosis is mandatory without a Social Media contract");
assert.throws(() => assertSocialDiagnosisApproved({ socialDiagnosis: { status: "insufficient_data" } }), AppError);
assert.throws(() => assertSocialDiagnosisApproved({ socialDiagnosis: { status: "generated" } }), AppError);
assert.doesNotThrow(() => assertSocialDiagnosisApproved({ socialDiagnosis: { status: "approved" } }));

assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: false }), "insufficient_data");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: true, citedPublicResearchAvailable: false }), "generated");
assert.equal(determineSocialDiagnosisStatus({ accountMetricsAvailable: false, citedPublicResearchAvailable: true }), "generated");

console.log("✓ Social diagnosis policy: approval is mandatory regardless of Social Media entitlement");
