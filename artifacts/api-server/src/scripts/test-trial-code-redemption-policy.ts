import assert from "node:assert/strict";
import {
  activateTrialSettings,
  canRepairConsumedTrialAccess,
  trialFromSettings,
} from "../modules/auth/trial-access.service.js";
import { isTrialRouteAllowed } from "../modules/auth/trial-scope.middleware.js";

const original = {
  referralCode: "REF-123",
  unlimitedCredits: false,
  nexosTrial: { active: false, briefingCampaignId: null, socialAnalysisStatus: "used" },
};
const activated = activateTrialSettings(original);

assert.equal(activated.referralCode, "REF-123", "unrelated workspace settings are preserved");
assert.equal(activated.unlimitedCredits, false, "trial must not change credit entitlements");
assert.deepEqual(activated.nexosTrial, {
  active: true,
  briefingCampaignId: null,
  socialAnalysisStatus: "available",
});
assert.deepEqual(trialFromSettings(activated), {
  active: true,
  briefingCampaignId: null,
  socialAnalysisStatus: "available",
});
assert.equal(trialFromSettings({}), null, "non-trial workspaces remain non-trial");
assert.equal(trialFromSettings(activateTrialSettings(null))?.active, true);
assert.equal(canRepairConsumedTrialAccess({
  inviteUsed: true,
  invitePlanSlug: "trial",
  usedByWorkspaceId: "workspace-a",
  workspaceId: "workspace-a",
  settings: { referralCode: "REF-123" },
}), true, "repairs a consumed trial invite for its original workspace when the marker is missing");
assert.equal(canRepairConsumedTrialAccess({
  inviteUsed: true,
  invitePlanSlug: "trial",
  usedByWorkspaceId: "workspace-a",
  workspaceId: "workspace-b",
  settings: {},
}), false, "a consumed code cannot be moved to another workspace");
assert.equal(canRepairConsumedTrialAccess({
  inviteUsed: true,
  invitePlanSlug: "trial",
  usedByWorkspaceId: "workspace-a",
  workspaceId: "workspace-a",
  settings: { nexosTrial: { active: false } },
}), false, "an explicitly ended trial is never reactivated");
assert.equal(isTrialRouteAllowed("POST", "/billing/redeem-code"), true, "trial users must be able to redeem their access code");
assert.equal(isTrialRouteAllowed("POST", "/billing/credit-packs/purchase"), false, "trial users cannot access unrelated billing operations");

console.log("✓ Trial code redemption policy: activates the limited trial while preserving other workspace settings and entitlements");
