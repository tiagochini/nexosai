import assert from "node:assert/strict";
import { applyMetaSetupReadinessGate, buildMetaSetupDiagnostic } from "../modules/agents/meta-ads-setup-architect.js";

const partial = buildMetaSetupDiagnostic({ "campaign.budget.traffic": 8000, "campaign.type": "launch" });
assert.equal(partial.status, "incomplete");
assert.equal(partial.emq.status, "not_verified");
assert.equal(partial.emq.value, null);
assert.ok(partial.missingFields.includes("weeklyOptimizationConversions"));
assert.ok(partial.missingFields.includes("businessModelAndSalesCycle"));
assert.ok(partial.missingFields.includes("trackingEvidence"));

const makeOutput = () => ({
  prePublishValidation: {
    overallClearance: "approved" as const,
    blockers: [] as string[],
    conditions: [] as string[],
    pixelAndApi: { status: "approved" as const, note: "" },
  },
  campaignReadiness: "ready" as const,
  campaignReadinessScore: 98,
});
const gated = applyMetaSetupReadinessGate(makeOutput(), partial);
assert.equal(gated.prePublishValidation.overallClearance, "blocked");
assert.equal(gated.prePublishValidation.pixelAndApi.status, "blocked");
assert.equal(gated.campaignReadiness, "not_ready");
assert.equal(gated.campaignReadinessScore, 59);
assert.ok(gated.prePublishValidation.conditions.length > 0);

const complete = buildMetaSetupDiagnostic({
  "meta.conversionsPerWeek": 18,
  "meta.trackingEvidence": {
    pixel: "events received",
    capi: "connected",
    eventId: "shared by browser and server",
    deduplication: "verified in Meta Events Manager",
    backendComparison: "matched against orders for 30 days",
  },
  "meta.creativesPerWeek": 4,
  "campaign.budget.monthly": 8000,
  "campaign.budget.daily": 267,
  "campaign.businessModel": "local service",
  "campaign.salesCycle": "7 days",
  "meta.accountPhase": "testing",
  "campaign.brandRestrictions": "no AI image edits; Brazil only",
});
assert.equal(complete.status, "complete");
assert.deepEqual(complete.missingFields, []);
assert.equal(complete.emq.status, "not_verified");
assert.equal(complete.trackingStatus, "strong");

const emqVerified = buildMetaSetupDiagnostic({
  "meta.conversionsPerWeek": 18,
  "meta.trackingEvidence": { pixel: "yes", capi: "yes", eventId: "shared", deduplication: "verified", backendComparison: "matched" },
  "meta.creativesPerWeek": 4,
  "campaign.budget.monthly": 8000,
  "campaign.budget.daily": 267,
  "campaign.businessModel": "e-commerce",
  "campaign.salesCycle": "same day",
  "meta.accountPhase": "scaling",
  "campaign.brandRestrictions": "none",
  "meta.emq": 8.1,
  "meta.emqSource": "Meta Events Manager",
});
assert.equal(emqVerified.emq.status, "verified");
assert.equal(emqVerified.emq.value, 8.1);

const weakTracking = buildMetaSetupDiagnostic({
  "meta.conversionsPerWeek": 18,
  "meta.trackingEvidence": { pixel: "inactive", capi: "not connected", eventId: "missing", deduplication: "not verified", backendComparison: "not compared" },
  "meta.creativesPerWeek": 4,
  "campaign.budget.monthly": 8000,
  "campaign.budget.daily": 267,
  "campaign.businessModel": "e-commerce",
  "campaign.salesCycle": "same day",
  "meta.accountPhase": "scaling",
  "campaign.brandRestrictions": "none",
});
assert.equal(weakTracking.status, "complete");
assert.equal(weakTracking.trackingStatus, "weak");
const weakOutput = applyMetaSetupReadinessGate({
  ...makeOutput(),
  prePublishValidation: { ...makeOutput().prePublishValidation },
}, weakTracking);
assert.equal(weakOutput.prePublishValidation.overallClearance, "conditional");
assert.equal(weakOutput.prePublishValidation.pixelAndApi.status, "needs_review");
assert.equal(weakOutput.campaignReadiness, "needs_review");
assert.equal(weakOutput.campaignReadinessScore, 79);

const allowed = applyMetaSetupReadinessGate({
  ...makeOutput(),
  prePublishValidation: { ...makeOutput().prePublishValidation },
}, complete);
assert.equal(allowed.prePublishValidation.overallClearance, "approved");
assert.equal(allowed.campaignReadiness, "ready");

console.log("meta ads setup architect diagnostic and readiness tests: PASS");
