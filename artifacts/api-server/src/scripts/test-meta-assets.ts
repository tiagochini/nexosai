import assert from "node:assert/strict";
import {
  paidMediaSetupSchema,
  executablePaidMediaSetup,
} from "../modules/paid-media/paid-media-setup.service.js";
import {
  compileMasterplanTree,
  validateLaunchReadback,
} from "../modules/paid-media/launch-plans.service.js";
import { executeMetaLaunchTree } from "../modules/paid-media/providers.js";
import {
  placementTargeting,
  validateMetaTargeting,
  metaCreativePayload,
} from "../modules/paid-media/meta-assets.policy.js";
import { metaAdSetPayload } from "../modules/paid-media/meta-launch.policy.js";
import {
  requireAccountAssets,
  verifyMetaLaunchAssets,
} from "../modules/paid-media/meta-asset-preflight.js";
import {
  compileAudienceRequest,
  assertAudienceReadback,
} from "../modules/paid-media/meta-audience.policy.js";

const base = {
  accountId: "00000000-0000-4000-8000-000000000001",
  datasetId: "00000000-0000-4000-8000-000000000002",
  objective: "OUTCOME_SALES" as const,
  conversionEvent: "Purchase" as const,
  amount: 100,
  budgetKind: "daily" as const,
  budgetMode: "abo" as const,
  startTime: null,
  endTime: null,
  destinationUrl: "https://example.test/",
  country: "BR",
  ageMin: 18,
  ageMax: 65,
  pageId: "123",
  imageUrl: "https://example.test/thumbnail.jpg",
  message: "Approved",
  specialCategoriesConfirmed: true as const,
};
for (const mode of ["original", "advantage"] as const)
  for (const format of ["image", "video", "catalog"] as const) {
    const form = paidMediaSetupSchema.parse({
      ...base,
      audienceMode: mode,
      includedAudienceIds: ["111"],
      excludedAudienceIds: ["222"],
      placementMode: "manual",
      placements: ["facebook_feed", "instagram_reels"],
      creativeFormat: format,
      ...(format === "video"
        ? { videoId: "333" }
        : format === "catalog"
          ? { catalogId: "444", productSetId: "555" }
          : {}),
    });
    const configuration = executablePaidMediaSetup(
      form,
      { providerAccountId: "act_9", currency: "BRL" },
      "12345",
    );
    const compiled = compileMasterplanTree(
      { campaign: { title: "Assets" }, strategy: { paidMedia: configuration } },
      "meta_ads",
      "act_9",
    );
    assert.deepEqual(compiled.tree.validationBlockers, []);
    const targeting = compiled.tree.adGroups[0]!.targeting as any;
    assert.equal(
      targeting.targeting_automation.advantage_audience,
      mode === "advantage" ? 1 : 0,
    );
    assert.equal(targeting.age_max, mode === "advantage" ? undefined : 65);
    assert.deepEqual(targeting.custom_audiences, [{ id: "111" }]);
    assert.deepEqual(targeting.excluded_custom_audiences, [{ id: "222" }]);
    assert.deepEqual(targeting.instagram_positions, ["reels"]);
    const sent: any[] = [];
    await executeMetaLaunchTree("act_9", compiled.tree, async (_path, body) => {
      sent.push(body);
      return { id: `id-${sent.length}` };
    });
    assert.equal(sent[0].status, "PAUSED");
    assert.equal(sent[1].status, "PAUSED");
    assert.equal(sent[3].status, "PAUSED");
    if (format === "catalog") {
      assert.equal(sent[2].product_set_id, "555");
      assert.equal(
        (
          metaAdSetPayload(
            compiled.tree.campaign,
            compiled.tree.adGroups[0]!,
            "c",
          ).promoted_object as any
        ).product_set_id,
        "555",
      );
      const payload = metaCreativePayload(
        compiled.tree.adGroups[0]!.ads[0]!.creative as any,
        "creative",
      );
      validateLaunchReadback(
        "creative",
        "555",
        { id: "555", ...payload },
        payload,
      );
      assert.throws(() =>
        validateLaunchReadback(
          "creative",
          "555",
          { id: "555", ...payload, product_set_id: "other" },
          payload,
        ),
      );
    }
    if (format === "video")
      assert.equal(sent[2].object_story_spec.video_data.video_id, "333");
    const reads: string[] = [];
    await verifyMetaLaunchAssets(
      compiled.tree,
      "act_9",
      async (path, params) => {
        reads.push(path);
        if (path.endsWith("/customaudiences"))
          return params.after
            ? { data: [{ id: "222" }] }
            : {
                data: [{ id: "111" }],
                paging: {
                  next: "https://untrusted.invalid/token",
                  cursors: { after: "cursor" },
                },
              };
        if (path.endsWith("/advideos")) return { data: [{ id: "333" }] };
        if (path === "333")
          return { id: "333", status: { video_status: "ready" } };
        if (path === "555")
          return {
            id: "555",
            product_catalog: { id: "444" },
            product_count: 10,
          };
        throw new Error("Unexpected read");
      },
    );
    assert.ok(
      !reads.some((path) => path.startsWith("https:")),
      "provider pagination URLs are never followed",
    );
    await assert.rejects(
      verifyMetaLaunchAssets(compiled.tree, "act_9", async () => ({
        data: [],
      })),
      /ativos/,
    );
  }
assert.deepEqual(
  placementTargeting(["facebook_feed", "facebook_feed", "instagram_stories"]),
  {
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
    instagram_positions: ["story"],
  },
);
for (const targeting of [
  {
    geo_locations: { countries: ["BR"] },
    targeting_automation: { advantage_audience: 3 },
  },
  {
    geo_locations: { countries: ["BR"] },
    targeting_automation: { advantage_audience: 1 },
    age_max: 30,
  },
  { geo_locations: { countries: ["BR"] }, facebook_positions: ["feed"] },
  {
    geo_locations: { countries: ["BR"] },
    custom_audiences: [{ id: "1" }],
    excluded_custom_audiences: [{ id: "1" }],
  },
  { geo_locations: { countries: ["BR"] }, interests: [{ id: "1" }] },
])
  assert.throws(() => validateMetaTargeting(targeting));
for (const extra of [
  { creativeFormat: "video" },
  {
    creativeFormat: "catalog",
    objective: "OUTCOME_LEADS",
    conversionEvent: "Lead",
    catalogId: "444",
    productSetId: "555",
  },
  { placementMode: "manual", placements: [] },
  { includedAudienceIds: ["1"], excludedAudienceIds: ["1"] },
])
  assert.equal(
    paidMediaSetupSchema.safeParse({ ...base, ...extra }).success,
    false,
  );
await assert.rejects(
  requireAccountAssets(
    async () => ({
      data: [],
      paging: { next: "ignored", cursors: { after: "same" } },
    }),
    "act_9",
    "customaudiences",
    ["unknown"],
  ),
);
await assert.rejects(
  verifyMetaLaunchAssets(
    {
      campaign: {},
      adGroups: [
        {
          ads: [
            {
              creative: {
                object_story_spec: { video_data: { video_id: "333" } },
              },
            },
          ],
        },
      ],
    },
    "act_9",
    async (path) =>
      path.endsWith("/advideos")
        ? { data: [{ id: "333" }] }
        : { id: "333", status: { video_status: "processing" } },
  ),
  /vídeo/,
);
await assert.rejects(
  verifyMetaLaunchAssets(
    {
      campaign: { catalog: { productSetId: "555", catalogId: "444" } },
      adGroups: [],
    },
    "act_9",
    async () => ({
      id: "555",
      product_catalog: { id: "999" },
      product_count: 10,
    }),
  ),
  /produtos/,
);
await assert.rejects(
  verifyMetaLaunchAssets(
    {
      campaign: { catalog: { productSetId: "555", catalogId: "444" } },
      adGroups: [],
    },
    "act_9",
    async () => ({
      id: "555",
      product_catalog: { id: "444" },
      product_count: 0,
    }),
  ),
  /produtos/,
);

const common = {
  accountId: base.accountId,
  idempotencyKey: "test-key",
  name: "Owned audience",
  dataRightsConfirmed: true,
};
const website = compileAudienceRequest({
  ...common,
  kind: "website",
  pixelId: "123",
  event: "Purchase",
  retentionDays: 30,
  urlContains: "/checkout",
});
assert.equal(
  JSON.parse(String(website.request.payload.rule)).inclusions.rules[0]
    .retention_seconds,
  30 * 86400,
);
assertAudienceReadback(
  {
    id: "1",
    account_id: "9",
    name: common.name,
    subtype: "WEBSITE",
    rule: website.request.payload.rule,
  },
  "act_9",
  website.request.payload,
  "1",
);
assert.throws(() =>
  assertAudienceReadback(
    {
      id: "1",
      account_id: "8",
      name: common.name,
      subtype: "WEBSITE",
      rule: website.request.payload.rule,
    },
    "act_9",
    website.request.payload,
    "1",
  ),
);
const lookalike = compileAudienceRequest({
  ...common,
  kind: "lookalike",
  originAudienceId: "11",
  country: "BR",
  ratio: 0.01,
});
assert.equal(lookalike.request.payload.subtype, "LOOKALIKE");
assertAudienceReadback(
  {
    id: "2",
    account_id: "9",
    name: common.name,
    subtype: "LOOKALIKE",
    seed_audience: "11",
    lookalike_spec: { country: "BR", ratio: 0.01 },
  },
  "act_9",
  lookalike.request.payload,
  "2",
);
assert.throws(() =>
  assertAudienceReadback(
    {
      id: "2",
      account_id: "9",
      name: common.name,
      subtype: "LOOKALIKE",
      seed_audience: "12",
      lookalike_spec: { country: "BR", ratio: 0.01 },
    },
    "act_9",
    lookalike.request.payload,
    "2",
  ),
);
const largeSource = "120209658343900243";
const largeLookalike = compileAudienceRequest({
  ...common,
  kind: "lookalike",
  originAudienceId: largeSource,
  country: "BR",
  ratio: 0.01,
});
const largeReadback = {
  id: "2",
  account_id: "9",
  name: common.name,
  subtype: "LOOKALIKE",
  seed_audience: Number(largeSource),
  lookalike_spec: { country: "BR", ratio: 0.01, origin: [{ id: largeSource }] },
};
assertAudienceReadback(
  largeReadback,
  "act_9",
  largeLookalike.request.payload,
  "2",
);
assert.throws(
  () =>
    assertAudienceReadback(
      {
        ...largeReadback,
        lookalike_spec: { country: "BR", ratio: 0.01, origin: [] },
      },
      "act_9",
      largeLookalike.request.payload,
      "2",
    ),
  "rounded Meta IDs cannot certify the approved seed",
);
const member = {
  email: "person@example.test",
  phone: "+5511999999999",
  marketingConsent: true,
  consentedAt: new Date(Date.now() - 1000).toISOString(),
  consentReference: "private-consent-reference",
};
const crm = compileAudienceRequest({
  ...common,
  kind: "crm",
  members: [member, member],
});
assert.equal(crm.request.members.length, 1);
assert.equal(crm.request.members[0]![0]!.length, 64);
for (const sensitive of [member.email, member.phone, member.consentReference])
  assert.equal(JSON.stringify(crm.request).includes(sensitive), false);
assert.throws(() =>
  compileAudienceRequest({
    ...common,
    kind: "crm",
    members: [{ ...member, marketingConsent: false }],
  }),
);
assert.throws(() =>
  compileAudienceRequest({
    ...common,
    kind: "crm",
    members: [{ ...member, consentReference: "" }],
  }),
);
assert.throws(() =>
  compileAudienceRequest({
    ...common,
    kind: "crm",
    members: [
      { ...member, consentedAt: new Date(Date.now() + 86400000).toISOString() },
    ],
  }),
);
console.log(
  "PASS Meta advanced assets: approved setup/compiler/paused payloads, video/catalog bindings, audience/placement policy, access pagination, consent/hash minimization and readback",
);
