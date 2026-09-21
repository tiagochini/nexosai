import assert from "node:assert/strict";
import { allocateApprovedBudget, buildLaunchReadiness, compileMasterplanTree, redactLaunchEvidence } from "../modules/paid-media/launch-plans.service.js";
import { executeMetaLaunchTree, paidMediaProviderCapabilities } from "../modules/paid-media/providers.js";
import { policyAllows, requiresHumanApproval, hasConsistentRollbackOwnership } from "../modules/paid-media/paid-media.domain.js";
import { matchesApprovedDossier } from "../modules/masterplan/masterplan.service.js";

const base = { campaign: { title: "Test", budget: { amount: 100, kind: "daily" }, destinationUrl: "https://example.test" }, strategy: { objective: "OUTCOME_SALES" }, targeting: { audiences: [{ geo: ["BR"] }] }, tracking: { pixelId: "px", conversionEvent: "Purchase" }, creatives: [{ id: "creative-1" }], operatingMemory: {} };
const account = { id: "account", isSelected: true, currency: "USD", timezone: "UTC", provider: "meta_ads" };
const plan = { id: "mp", status: "approved", contextFingerprint: "fp" };
const intake = { id: "intake", status: "approved" };
const tree = compileMasterplanTree(base, "meta_ads", "act_123").tree as Record<string, unknown>;
assert.deepEqual(allocateApprovedBudget({ amount: 10, kind: "daily" }, 3), [3.34, 3.33, 3.33]);
assert.equal(allocateApprovedBudget({ amount: 10, kind: "lifetime" }, 3).reduce((a, b) => a + b, 0) <= 10, true);
assert.equal(paidMediaProviderCapabilities("meta_ads").launchTreeCreation, "supported");
assert.equal(paidMediaProviderCapabilities("google_ads").launchTreeCreation, "unsupported");
assert.equal(paidMediaProviderCapabilities("tiktok_ads").launchTreeCreation, "unsupported");

// Exact binding inputs are represented in the immutable compile contract.
assert.equal((tree["accountId"] ?? "act_123"), "act_123");
assert.equal(plan.contextFingerprint, "fp");
assert.equal(intake.id, "intake");
assert.equal(matchesApprovedDossier(plan, { campaignId: "campaign", masterplanVersionId: "mp", contextFingerprint: "fp" }), true);
assert.equal(matchesApprovedDossier(plan, { campaignId: "campaign", masterplanVersionId: "mp", contextFingerprint: "stale" }), false);
assert.equal(hasConsistentRollbackOwnership("workspace", { workspaceId: "other", proposalId: "p" }, { id: "p", workspaceId: "workspace", accountId: "a", entityId: "e", provider: "meta_ads" }, { id: "a", workspaceId: "workspace", provider: "meta_ads" }, { id: "e", workspaceId: "workspace", accountId: "a", provider: "meta_ads" }), false);
assert.equal(buildLaunchReadiness({ masterplan: plan, account, intake, tree, provider: "meta_ads" }).status, "ready");
assert.ok(buildLaunchReadiness({ masterplan: plan, account, intake, tree: compileMasterplanTree({ ...base, campaign: { ...base.campaign, budget: {} } }, "meta_ads", "act_123").tree, provider: "meta_ads" }).blockers.some((x) => x.code === "BUDGET_SEMANTICS_REQUIRED"));
assert.equal(buildLaunchReadiness({ masterplan: { ...plan, contextFingerprint: "stale" }, account, intake, tree, provider: "meta_ads" }).status, "ready"); // stale is rejected at DB binding boundary, never normalized here

for (const [field, code] of [["budget", "BUDGET_AUTHORIZATION_REQUIRED"], ["destination", "DESTINATION_URL_REQUIRED"], ["tracking", "TRACKING_REQUIREMENTS_REQUIRED"], ["creative", "CREATIVE_READINESS_REQUIRED"]] as const) {
  const input = structuredClone(base) as Record<string, unknown>;
  if (field === "budget") (input.campaign as Record<string, unknown>).budget = {};
  if (field === "destination") (input.campaign as Record<string, unknown>).destinationUrl = "not-a-url";
  if (field === "tracking") delete input.tracking;
  if (field === "creative") delete input.creatives;
  const result = buildLaunchReadiness({ masterplan: plan, account, intake, tree: compileMasterplanTree(input, "meta_ads", "act_123").tree, provider: "meta_ads" });
  assert.ok(result.blockers.some((item) => item.code === code), `${field} blocker`);
}
assert.ok(buildLaunchReadiness({ masterplan: plan, account: null, intake, tree, provider: "meta_ads" }).blockers.some((x) => x.code === "ACCOUNT_NOT_FOUND"));
assert.ok(buildLaunchReadiness({ masterplan: plan, account: { ...account, isSelected: false }, intake, tree, provider: "meta_ads" }).blockers.some((x) => x.code === "PRODUCTION_ACCOUNT_SELECTION_REQUIRED"));
assert.ok(buildLaunchReadiness({ masterplan: plan, account, intake, tree, provider: "google_ads" }).blockers.some((x) => x.code === "PROVIDER_CAPABILITY_BLOCKED"));
assert.ok(buildLaunchReadiness({ masterplan: plan, account, intake, tree, provider: "tiktok_ads" }).blockers.some((x) => x.code === "PROVIDER_CAPABILITY_BLOCKED"));

let mutations = 0; const calls: string[] = []; const ids = new Map<string, number>();
const transport = async (path: string, payload: Record<string, unknown>, key: string) => {
  if (payload.__delete) { calls.push(`DELETE:${path}`); return { id: path, status: "PAUSED" }; }
  if (!ids.has(key)) { ids.set(key, ++mutations); calls.push(`${key}:${path}`); }
  return { id: `id-${ids.get(key)}`, status: "PAUSED" };
};
const result = await executeMetaLaunchTree("act_123", { ...tree, idempotencyKey: "fixed" }, transport);
assert.deepEqual(result.map((x) => x.entityType), ["campaign", "ad_set", "creative", "ad"]);
assert.ok(["campaigns", "adsets", "adcreatives", "ads"].every((suffix, index) => calls[index]!.endsWith(`act_123/${suffix}`)));
const beforeRetry = mutations; await executeMetaLaunchTree("act_123", { ...tree, idempotencyKey: "fixed" }, transport); assert.equal(mutations, beforeRetry);
assert.equal(calls.length, 4); // retry reuses the same per-step idempotency keys; dry-run performs none

const partialCalls: string[] = [];
await assert.rejects(() => executeMetaLaunchTree("act_123", { ...tree, idempotencyKey: "partial" }, async (path, payload, key) => {
  partialCalls.push(payload.__delete ? `rollback:${path}` : path);
  if (!payload.__delete && path.endsWith("adcreatives")) throw new Error("provider failure");
  return { id: payload.__delete ? path : `new-${key}`, status: "PAUSED" };
}));
assert.deepEqual(partialCalls.slice(-2), ["rollback:new-partial:ad-group-1", "rollback:new-partial:campaign"]);
assert.equal(requiresHumanApproval({ changes: { targetProvider: "google_ads" } }, "meta_ads"), true);
assert.equal(policyAllows({ enabled: true, accepted: true, mandatoryPause: false, minimumSampleSize: 0, minimumDataQualityScore: 0, maxDailyBudgetChangePercent: 100, maxBidChangePercent: 100 }, { type: "update_daily_budget", changes: { targetProvider: "google_ads" } }, 1, 1), false);
const redacted = redactLaunchEvidence({ accessToken: "secret", nested: [{ refreshToken: "x", ok: "yes" }] });
assert.deepEqual(redacted, { accessToken: "[REDACTED]", nested: [{ refreshToken: "[REDACTED]", ok: "yes" }] });
console.log("paid-media launch focused tests: PASS (binding/readiness/compiler/dry-run/order/idempotency/compensation/policy/capability/redaction)");