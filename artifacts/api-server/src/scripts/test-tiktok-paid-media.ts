import assert from "node:assert/strict";
import { compileMasterplanTree, buildLaunchReadiness } from "../modules/paid-media/launch-plans.service.js";
import { validateTikTokTree, tikTokCampaignPayload, tikTokGroupPayload, tikTokAdPayload, validateTikTokReadback } from "../modules/paid-media/tiktok-launch.policy.js";
import { normalizeProviderConversion } from "../modules/paid-media/providers.js";
import { tikTokEventPayload, sendTikTokEvent } from "../modules/paid-media/tiktok-events.js";
import { tikTokPageConfiguration } from "../modules/paid-media/tiktok-pixel-diagnostics.js";

const snapshot = {
  campaign: { title: "Teste TikTok", startTime: "2026-12-01T10:00:00Z", endTime: "2026-12-10T10:00:00Z" },
  strategy: { paidMedia: { objective: "TRAFFIC", budget: { amount: 123.45, kind: "daily", mode: "abo", currency: "BRL" }, destinationUrl: "https://example.test/capture", audiences: [{ location_ids: ["3469034"] }], creatives: [{ videoId: "video-1", imageIds: ["cover-1"], identityId: "identity-1", identityType: "CUSTOMIZED_USER", adText: "Conheça a oferta", callToAction: "LEARN_MORE" }] } },
};
const compiled = compileMasterplanTree(snapshot, "tiktok_ads", "advertiser-1");
validateTikTokTree(compiled.tree);
const readiness = buildLaunchReadiness({ masterplan: { id: "mp", status: "approved", contextFingerprint: "fp" }, account: { id: "account", provider: "tiktok_ads", isSelected: true, currency: "BRL", timezone: "UTC" }, intake: { id: "intake", status: "approved" }, tree: compiled.tree, provider: "tiktok_ads" });
assert.equal(readiness.status, "ready", JSON.stringify(readiness));
const c = compiled.tree.campaign, group = compiled.tree.adGroups[0]!;
const campaign = tikTokCampaignPayload(c), adgroup = tikTokGroupPayload(c, group, "campaign-1"), ad = tikTokAdPayload(group.ads[0]!, "group-1");
assert.equal(campaign.operation_status, "DISABLE");
assert.equal(adgroup.budget, 123.45);
assert.equal(adgroup.schedule_start_time, "2026-12-01 10:00:00");
assert.equal(adgroup.campaign_id, "campaign-1");
assert.equal((ad.creatives as Record<string, unknown>[])[0]!.operation_status, "DISABLE");
validateTikTokReadback("campaign", "campaign-1", { ...campaign, campaign_id: "campaign-1" }, campaign);
assert.throws(() => validateTikTokReadback("campaign", "campaign-1", { ...campaign, campaign_id: "campaign-1", operation_status: "ENABLE" }, campaign));
assert.throws(() => validateTikTokReadback("ad_set", "group-1", { ...adgroup, adgroup_id: "group-1", budget: 124 }, adgroup));
const creative = (ad.creatives as Record<string, unknown>[])[0]!;
validateTikTokReadback("ad", "ad-1", { ...creative, ad_id: "ad-1", adgroup_id: "group-1", operation_status: "DISABLE" }, ad);
assert.throws(() => validateTikTokTree({ ...compiled.tree, adGroups: [{ ...group, targeting: { unexpected: true } }] }));
assert.throws(() => validateTikTokTree({ ...compiled.tree, campaign: { ...c, objective: "WEB_CONVERSIONS", tracking: { pixelId: "pixel", conversionEvent: "FORM" } } }, new Date("2027-01-01")));

const event = normalizeProviderConversion("tiktok_ads", { eventName: "Lead", eventId: "lead-stable-id", occurredAt: "2026-11-20T12:00:00Z", matchKeys: { email: "PERSON@example.test", ttclid: "click-id", ttp: "cookie-id" }, payload: { currency: "BRL", value: 0, privateNote: "discard" } });
const payload = tikTokEventPayload("pixel-code", event);
assert.equal(payload.data[0]!.event, "SubmitForm");
assert.equal(payload.data[0]!.event_id, "lead-stable-id");
assert.match(payload.data[0]!.user.email!, /^[a-f0-9]{64}$/);
assert.equal(payload.data[0]!.user.ttclid, "click-id");
assert.ok(!JSON.stringify(payload).includes("PERSON"));
assert.ok(!JSON.stringify(payload).includes("discard"));
let calls = 0;
const receipt = await sendTikTokEvent("pixel-code", "secret", event, async (url, init) => {
  calls += 1;
  assert.equal(url, "https://business-api.tiktok.com/open_api/v1.3/event/track/");
  assert.equal((init.headers as Record<string, string>)["Access-Token"], "secret");
  assert.equal(JSON.parse(String(init.body)).data[0].event_id, event.eventId);
  return new Response(JSON.stringify({ code: 0, request_id: "request-1", data: {} }), { status: 200 });
});
assert.equal(calls, 1);
assert.equal(receipt.providerRequestId, "request-1");
assert.ok(!JSON.stringify(receipt).includes("secret"));
await assert.rejects(sendTikTokEvent("pixel", "secret", event, async () => new Response(JSON.stringify({ code: 40001, message: "secret" }), { status: 200 })));
await assert.rejects(sendTikTokEvent("pixel", "secret", event, async () => new Response("{}", { status: 200 })));
await assert.rejects(sendTikTokEvent("pixel", "secret", event, async () => new Response("{}", { status: 429 })), (error: any) => error.code === "RATE_LIMITED");
assert.throws(() => tikTokEventPayload("pixel", { ...event, eventName: "Unsupported" }));
const config = tikTokPageConfiguration([{ id: "page", status: "published", publishedUrl: "https://example.test", html: "analytics.tiktok.com/i18n/pixel/events.js pixel-code", metadata: { implementation: { tracking: { tiktokPixelId: "pixel-code" } } } }], "pixel-code");
assert.equal(config[0]?.tagInStoredHtml, true);
assert.equal(tikTokPageConfiguration([{ id: "page", status: "draft", publishedUrl: null, html: null, metadata: {} }], "other").length, 0);
console.log("TikTok paid media: payloads, paused readback, budget, bindings, capability, event mapping and provider receipts passed.");
