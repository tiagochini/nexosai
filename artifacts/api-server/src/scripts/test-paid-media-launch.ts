import assert from "node:assert/strict";
import { allocateApprovedBudget, buildLaunchReadiness, compileMasterplanTree, redactLaunchEvidence, validateLaunchReadback } from "../modules/paid-media/launch-plans.service.js";
import { metaAdSetPayload, metaCampaignPayload, validateMetaTree, validateMetaAccountBudget } from "../modules/paid-media/meta-launch.policy.js";
import { landingMeasurementState, validateLandingImplementation } from "../modules/landing-publication/landing-publication.service.js";
import { executeMetaLaunchTree, metaEntityFields, paidMediaProvider, paidMediaProviderCapabilities } from "../modules/paid-media/providers.js";
import { policyAllows, requiresHumanApproval, hasConsistentRollbackOwnership } from "../modules/paid-media/paid-media.domain.js";
import { matchesApprovedDossier } from "../modules/masterplan/masterplan.service.js";

const base = { campaign: { title: "Test", budget: { amount: 100, kind: "daily", mode: "abo", currency: "USD" }, destinationUrl: "https://example.test", specialAdCategories: [] }, strategy: { objective: "OUTCOME_SALES" }, targeting: { audiences: [{ geo_locations: { countries: ["BR"] } }] }, tracking: { pixelId: "12345", conversionEvent: "Purchase" }, creatives: [{ object_story_spec: { page_id: "123", link_data: { link: "https://example.test", image_hash: "approved-image" } } }], operatingMemory: {} };
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
// Validate actual emitted fields; the transport is never called for invalid plans.
for (const [objective, event, goal] of [["OUTCOME_TRAFFIC", null, "LINK_CLICKS"], ["OUTCOME_LEADS", "Lead", "OFFSITE_CONVERSIONS"], ["OUTCOME_LEADS", "CompleteRegistration", "OFFSITE_CONVERSIONS"], ["OUTCOME_SALES", "Purchase", "OFFSITE_CONVERSIONS"]] as const) {
  const compiled = compileMasterplanTree({ ...base, strategy: { objective }, tracking: event ? { pixelId: "12345", conversionEvent: event } : {} }, "meta_ads", "act_123");
  assert.deepEqual(compiled.tree.validationBlockers, []);
  const emitted: Array<Record<string, unknown>> = [];
  await executeMetaLaunchTree("act_123", compiled.tree, async (_path, body) => { emitted.push(body); return { id: `id-${emitted.length}` }; });
  assert.equal(emitted[1]!.optimization_goal, goal);
  assert.equal(emitted[1]!.destination_type, "WEBSITE");
  assert.equal(emitted[1]!.billing_event, "IMPRESSIONS");
  assert.equal(emitted[1]!.daily_budget, 10000);
  assert.equal(emitted[0]!.daily_budget, undefined);
  assert.equal((emitted[1]!.promoted_object as Record<string, unknown> | undefined)?.pixel_id, event ? "12345" : undefined);
  assert.ok(emitted.filter((_, index) => index !== 2).every(body => body.status === "PAUSED"));
}
for (const mode of ["abo", "cbo"]) for (const kind of ["daily", "lifetime"]) {
  const compiled = compileMasterplanTree({ ...base, campaign: { ...base.campaign, budget: { amount: 10, currency: "USD", mode, kind }, startTime: "2026-11-01T00:00:00Z", endTime: "2026-11-03T00:00:00Z" }, targeting: { audiences: [base.targeting.audiences[0], base.targeting.audiences[0], base.targeting.audiences[0]] } }, "meta_ads", "act_123");
  assert.deepEqual(compiled.tree.validationBlockers, []);
  const campaign = compiled.tree.campaign, groups = compiled.tree.adGroups;
  const budgetKey = kind === "daily" ? "daily_budget" : "lifetime_budget";
  assert.equal(metaCampaignPayload(campaign)[budgetKey], mode === "cbo" ? 1000 : undefined);
  const budgets = groups.map(group => metaAdSetPayload(campaign, group, "c")[budgetKey]);
  assert.deepEqual(budgets, mode === "abo" ? [334, 333, 333] : [undefined, undefined, undefined]);
  if (kind === "lifetime") assert.equal(metaAdSetPayload(campaign, groups[0]!, "c").end_time, "2026-11-03T00:00:00Z");
  validateMetaAccountBudget(compiled.tree, "USD", 100);
  assert.throws(() => validateMetaAccountBudget(compiled.tree, "BRL", 100), /moeda/);
  assert.throws(() => validateMetaAccountBudget(compiled.tree, "USD", 100000), /mínimo/);
  assert.throws(() => validateMetaAccountBudget(compiled.tree, "USD", NaN), /mínimo/);
}
for (const change of [
  { strategy: { objective: "OUTCOME_SALES", paidMedia: { advantageAudience: true } } },
  { campaign: { ...base.campaign, budget: { ...base.campaign.budget, daily_budget: 100, lifetime_budget: 200 } } },
  { strategy: { objective: "OUTCOME_ENGAGEMENT" } },
  { strategy: { objective: "toString" } },
  { strategy: { objective: "" } },
  { tracking: { pixelId: "12345" } },
  { tracking: { conversionEvent: "Purchase" } },
  { tracking: { pixelId: "12345", conversionEvent: "Lead" } },
  { targeting: { audiences: [{ geo_locations: { countries: ["BR"] }, targeting_automation: { advantage_audience: 2 } }] } },
  { creatives: [{ id: "reference-only" }] },
  { campaign: { ...base.campaign, budget: { amount: 100, kind: "daily", mode: "other", currency: "USD" } } },
  { campaign: { ...base.campaign, budget: { amount: 100, kind: "daily", mode: "abo", currency: "JPY" } } },
  { campaign: { ...base.campaign, specialAdCategories: ["HOUSING"] } },
]) {
  const invalid = compileMasterplanTree({ ...base, ...change }, "meta_ads", "act_123");
  assert.ok(invalid.tree.validationBlockers.length);
  let requests = 0;
  await assert.rejects(() => executeMetaLaunchTree("act_123", invalid.tree, async () => { requests++; return { id: "unexpected" }; }));
  assert.equal(requests, 0, "invalid configuration rejected before any external call");
}
const conflict = structuredClone(tree) as any;
conflict.campaign.budgetMode = "cbo";
assert.throws(() => validateMetaTree(conflict), /CBO/);
const readbackPayload = { name: "group", optimization_goal: "OFFSITE_CONVERSIONS", destination_type: "WEBSITE", promoted_object: { pixel_id: "12345", custom_event_type: "PURCHASE" }, daily_budget: 1000 };
validateLaunchReadback("ad_set", "g", { id: "g", status: "PAUSED", ...readbackPayload }, readbackPayload);
assert.throws(() => validateLaunchReadback("ad_set", "g", { id: "g", status: "PAUSED", ...readbackPayload, optimization_goal: "LINK_CLICKS" }, readbackPayload), /optimization_goal/);
assert.throws(() => validateLaunchReadback("ad_set", "g", { id: "g", status: "ACTIVE", ...readbackPayload }, readbackPayload), /paused/);
assert.equal(landingMeasurementState(false, false, false, false).publication, "draft");
assert.equal(landingMeasurementState(true, false, false, false).publication, "approved");
assert.equal(landingMeasurementState(true, true, false, true).publication, "configured");
assert.equal(landingMeasurementState(true, true, true, true).trackingVerified, false);
assert.equal(landingMeasurementState(true, true, true, true).capi, "not_connected");
validateLandingImplementation({ ctas: [{ key: "hero", label: "Contato", action: "capture_lead", target: "sequence" }], tracking: { metaPixelId: "12345" } }, "sequence");
assert.throws(() => validateLandingImplementation({ ctas: [{ key: "hero", label: "Contato", action: "capture_lead", target: "other" }], tracking: {} }, "sequence"), /CTAs/);
assert.throws(() => validateLandingImplementation({ ctas: [{ key: "hero", label: "Contato", action: "url", target: "javascript:alert(1)" }], tracking: {} }), /CTAs/);
console.log("Meta corrected contracts: PASS (website goals, no-call rejection, ABO/CBO daily/lifetime, currency/minimums, readback, landing states/CTAs)");

await assert.rejects(() => paidMediaProvider("meta_ads").createLaunchTree!("workspace", "account", tree, "legacy"), /plano aprovado/);
assert.equal(metaEntityFields("creative"), "id,name,object_story_spec,product_set_id");
assert.equal(metaEntityFields("campaign").includes("adset_id"), false);
assert.equal(metaEntityFields("ad").includes("daily_budget"), false);
assert.throws(() => validateLaunchReadback("ad_set", "g", { id: "g", status: "PAUSED", name: "group", targeting: { geo_locations: { countries: ["US"] } } }, { name: "group", targeting: { geo_locations: { countries: ["BR"] } } }), /targeting/);
assert.throws(() => validateLaunchReadback("ad", "a", { id: "a", status: "PAUSED", name: "ad", creative: { id: "other" } }, { name: "ad", creative: { creative_id: "approved" } }), /creative binding/);
