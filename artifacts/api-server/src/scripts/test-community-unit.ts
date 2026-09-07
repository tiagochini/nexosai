import assert from "node:assert/strict";
import { providerCapability } from "../modules/community/community-capabilities.js";
import { evaluateAutonomousResponsePolicy, evaluateCommunityModerationRules, isDuplicateProviderEvent } from "../modules/community/community.service.js";

assert.equal(providerCapability("whatsapp", "delete").supported, false);
assert.match(providerCapability("whatsapp", "ban").reason!, /does not support/i);
const replay = { workspaceId: "tenant-a", channel: "whatsapp" as const, providerEventId: "wamid.1" };
assert.equal(isDuplicateProviderEvent(replay, "tenant-a", replay), true, "same verified provider event is deduped");
assert.equal(isDuplicateProviderEvent(replay, "tenant-b", replay), false, "provider IDs never cross tenant boundaries");
assert.equal(evaluateAutonomousResponsePolicy({ enabled: true, requiresConsent: true, consentGranted: false, requiresApproval: false, dailyQuota: 2, sentToday: 0 }).reason, "consent_required");
assert.equal(evaluateAutonomousResponsePolicy({ enabled: true, requiresConsent: false, consentGranted: false, requiresApproval: false, dailyQuota: 2, sentToday: 2 }).reason, "quota_exhausted");
assert.equal(evaluateAutonomousResponsePolicy({ enabled: true, requiresConsent: true, consentGranted: true, requiresApproval: false, dailyQuota: 2, sentToday: 1 }).allowed, true);
// Rule evaluation receives only the already workspace-filtered rule set; rules
// from another tenant must never be passed from the persistence boundary.
const decision = evaluateCommunityModerationRules([
  { id: "workspace-rule", enabled: true, condition: { regex: "spam+" }, decision: "queue", requiresApproval: true },
], { body: "this is spamm" });
assert.deepEqual(decision, { ruleId: "workspace-rule", decision: "queue", requiresApproval: true });
assert.equal(evaluateCommunityModerationRules([], { body: "normal" }).decision, "allow");
console.log("community capability, consent/quota, moderation and isolation-boundary unit tests passed");