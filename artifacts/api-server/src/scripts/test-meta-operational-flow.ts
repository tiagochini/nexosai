import { isVerifiedLandingSameOrigin } from "../lib/public-landing-origin.js";
import assert from "node:assert/strict";
import { Script, createContext } from "node:vm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  campaignsTable,
  masterplanVersionsTable,
  paidMediaAccountsTable,
  paidMediaDatasetsTable,
  pagesTable,
} from "@workspace/db";
import {
  assertPaidMediaApprovalMatchesCampaign,
  executablePaidMediaSetup,
  paidMediaSetupSchema,
  paidMediaSnapshotFields,
  savePaidMediaSetup,
} from "../modules/paid-media/paid-media-setup.service.js";
import {
  compileMasterplanTree,
  buildLaunchReadiness,
} from "../modules/paid-media/launch-plans.service.js";
import {
  measureMetaInsight,
  metaMeasurementEvent,
  summarizeMetaReport,
} from "../modules/paid-media/meta-reporting.domain.js";
import {
  assertLandingAdTracking,
  assertLandingEventScope,
  landingLeadEventId,
  trackCapturedLandingLead,
  trackLandingPageView,
} from "../modules/landing-publication/landing-tracking.service.js";
import { materializeLandingHtml } from "../modules/landing-publication/landing-publication.service.js";
import {
  normalizeMetaCapiEvent,
  sendMetaCapiRequest,
} from "../modules/paid-media/providers.js";

const accountId = "11111111-1111-4111-8111-111111111111",
  datasetId = "22222222-2222-4222-8222-222222222222",
  pageId = "33333333-3333-4333-8333-333333333333";
const form = paidMediaSetupSchema.parse({
  accountId,
  datasetId,
  objective: "OUTCOME_LEADS",
  conversionEvent: "Lead",
  amount: 100.25,
  budgetKind: "daily",
  budgetMode: "abo",
  startTime: null,
  endTime: null,
  destinationUrl: "https://example.test/",
  country: "BR",
  ageMin: 18,
  ageMax: 65,
  pageId: "12345",
  imageUrl: "https://example.test/image.jpg",
  message: "Texto para aprovação",
  specialCategoriesConfirmed: true,
});
const configuration = executablePaidMediaSetup(
  form,
  { providerAccountId: "act_123", currency: "BRL" },
  "123456",
);
const snapshotFields = paidMediaSnapshotFields(
  { executiveSummary: "Preservado" },
  { otherTask: "preserve", paidMediaSetup: { form, configuration } },
);
assert.equal((snapshotFields.strategy as any).executiveSummary, "Preservado");
const compiled = compileMasterplanTree(
  {
    campaign: { title: "Campanha", ...snapshotFields.schedule },
    strategy: snapshotFields.strategy,
  },
  "meta_ads",
  "act_123",
);
assert.deepEqual(compiled.tree.validationBlockers, []);
assert.equal(compiled.tree.campaign.approvedAccountId, "act_123");
assert.equal(compiled.tree.adGroups[0]?.budgetMinorUnits, 10025);
assert.equal(
  buildLaunchReadiness({
    masterplan: { id: "mp", status: "approved", contextFingerprint: "fp" },
    account: {
      id: accountId,
      isSelected: true,
      currency: "BRL",
      timezone: "America/Cuiaba",
      provider: "meta_ads",
    },
    intake: { id: "intake", status: "approved" },
    tree: compiled.tree,
    provider: "meta_ads",
  }).status,
  "ready",
);
assert.ok(
  compileMasterplanTree(
    { campaign: { title: "Campanha" }, strategy: snapshotFields.strategy },
    "meta_ads",
    "act_other",
  ).tree.validationBlockers.some(
    (item) => item.code === "APPROVED_ACCOUNT_MISMATCH",
  ),
);
for (const patch of [
  { datasetId: null },
  { objective: "OUTCOME_SALES" },
  { amount: 1.001 },
  { ageMin: 65, ageMax: 18 },
  { budgetKind: "lifetime" },
  { specialCategoriesConfirmed: false },
  { destinationUrl: "javascript:alert(1)" },
])
  assert.equal(
    paidMediaSetupSchema.safeParse({ ...form, ...patch }).success,
    false,
  );

// Exercise the save boundary: scoped account/dataset checks, JSON-only update,
// and invalidation of old approvals happen within the same transaction.
const originals = { transaction: db.transaction, select: db.select };
const dialect = new PgDialect();
const updates: Array<{ table: unknown; patch: any; where: any }> = [];
let validAccount = true,
  validDataset = true;
const account = {
  id: accountId,
  providerAccountId: "act_123",
  currency: "BRL",
};
try {
  db.transaction = (async (callback: any) =>
    callback({
      select: () => ({
        from: (table: unknown) => ({
          where: (where: any) => {
            const query = dialect.sqlToQuery(where);
            assert.ok(query.params.includes("workspace"));
            const result =
              table === campaignsTable
                ? [{ id: "campaign" }]
                : table === paidMediaAccountsTable
                  ? validAccount
                    ? [account]
                    : []
                  : table === paidMediaDatasetsTable
                    ? validDataset
                      ? [{ providerDatasetId: "123456" }]
                      : []
                    : [];
            const chain = { limit: async () => result, for: () => chain };
            return chain;
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (patch: any) => ({
          where: async (where: any) => {
            updates.push({ table, patch, where });
          },
        }),
      }),
      insert: () => ({ values: async () => undefined }),
    })) as any;
  await savePaidMediaSetup("workspace", "campaign", "user", form);
  const briefing = updates.find((update) => update.table === campaignsTable)!;
  assert.match(
    dialect.sqlToQuery(briefing.patch.intakeData).sql,
    /jsonb_set\(coalesce/,
  );
  const superseded = updates.find(
    (update) => update.table === masterplanVersionsTable,
  )!;
  assert.equal(superseded.patch.status, "superseded");
  assert.ok(dialect.sqlToQuery(superseded.where).params.includes("workspace"));
  updates.length = 0;
  validDataset = false;
  await assert.rejects(
    () => savePaidMediaSetup("workspace", "campaign", "user", form),
    /pixel precisa pertencer/,
  );
  assert.equal(updates.length, 0);
  validAccount = false;
  await assert.rejects(
    () => savePaidMediaSetup("workspace", "campaign", "user", form),
    /conta Meta autorizada/,
  );
  assert.equal(updates.length, 0);
} finally {
  db.transaction = originals.transaction;
}

const raw = {
  actions: [
    { action_type: "offsite_conversion.fb_pixel_lead", value: "4" },
    { action_type: "lead", value: "4" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
  ],
  action_values: [
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "500" },
  ],
};
assert.equal(
  measureMetaInsight(raw, "Lead").results,
  4,
  "aliases are not added together",
);
assert.equal(measureMetaInsight(raw, "Purchase").results, 2);
assert.equal(measureMetaInsight(raw, "Purchase").conversionValue, 500);
assert.equal(measureMetaInsight(raw, "Lead").conversionValue, null);
assert.equal(measureMetaInsight({}, "Lead").results, null);
assert.equal(measureMetaInsight({ actions: [] }, "Lead").results, 0);
assert.equal(
  metaMeasurementEvent("OUTCOME_LEADS", {
    destination_type: "WEBSITE",
    promoted_object: { custom_event_type: "COMPLETE_REGISTRATION" },
  }),
  "CompleteRegistration",
);
assert.equal(
  metaMeasurementEvent("OUTCOME_LEADS", { destination_type: "ON_AD" }),
  null,
);
const reportRow = {
  entityType: "ad",
  currency: "BRL",
  attributionWindow: "provider_default",
  spend: "40",
  impressions: 100,
  clicks: 10,
  rawMetrics: { ...raw, nexosMeasurement: { event: "Lead" } },
};
const report = summarizeMetaReport(
  [
    reportRow,
    { ...reportRow, entityType: "campaign" },
    { ...reportRow, entityType: "ad_set" },
    { ...reportRow, currency: "USD" },
  ],
  "BRL",
);
assert.equal(report.ignoredRows, 3);
assert.equal(report.groups[0]?.spend, 40);
assert.equal(report.groups[0]?.results, 4);
assert.equal(report.groups[0]?.costPerResult, 10);
assert.equal(report.groups[0]?.roas, null);
assert.equal(
  summarizeMetaReport(
    [
      {
        ...reportRow,
        rawMetrics: { ...raw, nexosMeasurement: { event: "Purchase" } },
      },
    ],
    "BRL",
  ).groups[0]?.roas,
  12.5,
);
assert.equal(
  summarizeMetaReport([{ ...reportRow, rawMetrics: raw }], "BRL").groups[0]
    ?.results,
  null,
  "legacy goal is not inferred as purchase",
);
assert.equal(
  summarizeMetaReport(
    [reportRow, { ...reportRow, attributionWindow: "7d_click" }],
    "BRL",
  ).groups.length,
  2,
);

const tracking = {
  pageId,
  metaDatasetId: datasetId,
  metaEventKey: "a".repeat(64),
  metaPixelId: "123456",
};
const published = {
  id: pageId,
  workspaceId: "workspace",
  status: "published",
  publishedUrl: "https://example.test/",
  leadCaptureSequenceId: "sequence",
  metadata: { implementation: { tracking } },
};
const trackingInput = {
  pageId,
  eventKey: tracking.metaEventKey,
  marketingConsent: true,
};
assertLandingEventScope(
  published,
  tracking,
  trackingInput,
  "https://example.test",
  "sequence",
);
assert.throws(
  () =>
    assertLandingEventScope(
      published,
      tracking,
      trackingInput,
      "https://other.test",
    ),
  /Origem/,
);
assert.throws(
  () =>
    assertLandingEventScope(
      published,
      tracking,
      { ...trackingInput, eventKey: "b".repeat(64) },
      "https://example.test",
    ),
  /indisponível/,
);
assert.throws(
  () =>
    assertLandingEventScope(
      published,
      tracking,
      trackingInput,
      "https://example.test",
      "other-sequence",
    ),
  /sequência/,
);
assert.throws(
  () =>
    assertLandingEventScope(
      { ...published, status: "preview" },
      tracking,
      trackingInput,
      "https://example.test",
    ),
  /indisponível/,
);
let databaseReads = 0;
try {
  db.select = (() => {
    databaseReads++;
    return {
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === pagesTable ? [published] : []),
        }),
      }),
    };
  }) as any;
  assert.equal(
    (
      await trackLandingPageView(
        { ...trackingInput, marketingConsent: false, eventId: "v" },
        {},
      )
    ).deliveryStatus,
    "consent_withheld",
  );
  assert.equal(
    databaseReads,
    0,
    "no-consent pageview stops before persistence/provider",
  );
  assert.equal(
    (
      await trackCapturedLandingLead(
        undefined,
        {},
        { contactId: "contact", duplicate: false, sequenceId: "sequence" },
      )
    ).deliveryStatus,
    "consent_withheld",
  );
  assert.equal(
    (
      await trackCapturedLandingLead(
        trackingInput,
        { origin: "https://other.test" },
        { contactId: "contact", duplicate: false, sequenceId: "sequence" },
      )
    ).deliveryStatus,
    "tracking_unavailable",
    "tracking failure does not fail capture",
  );
} finally {
  db.select = originals.select;
}
assert.equal(
  landingLeadEventId(pageId, "contact"),
  landingLeadEventId(pageId, "contact"),
);
assert.notEqual(
  landingLeadEventId(pageId, "contact"),
  landingLeadEventId(pageId, "other"),
);

const normalized = normalizeMetaCapiEvent({
  eventName: "PageView",
  eventId: "page-view",
  occurredAt: "2026-10-23",
  matchKeys: { clientIpAddress: "127.0.0.1", clientUserAgent: "browser" },
  payload: { eventSourceUrl: "https://example.test/?email=private#fragment" },
});
assert.equal(normalized.eventSourceUrl, "https://example.test/");
let outbound: any;
await sendMetaCapiRequest(
  "123456",
  "test-token",
  normalized,
  async (_url, init) => {
    outbound = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ events_received: 1 }));
  },
);
assert.equal(outbound.data[0].event_source_url, "https://example.test/");

// Execute the actual generated landing JS, with DOM/network mocks, to check
// consent, the browser/server PageView ID, successful Lead ID and duplicates.
async function runLanding(
  consentValue: string | null,
  duplicate = false,
  metaLeadEventName: "Lead" | "CompleteRegistration" = "Lead",
) {
  const events: any[][] = [],
    requests: Array<{ url: string; body: any }> = [];
  const nodes = new Map<string, any>();
  const node = (id: string) => {
    if (!nodes.has(id))
      nodes.set(id, {
        hidden: false,
        classList: { add() {}, remove() {} },
        reset() {},
      });
    return nodes.get(id);
  };
  const html = materializeLandingHtml(
    {
      pageTitle: "Teste",
      metaTitle: "Teste",
      metaDescription: "Teste",
      sections: [{ headline: "Título", bodyContent: "Texto" }],
    },
    {
      ctas: [
        {
          key: "hero",
          label: "Enviar",
          action: "capture_lead",
          target: "sequence",
        },
      ],
      tracking: { ...tracking, metaLeadEventName },
    },
    "sequence",
  );
  const sandbox: any = {
    crypto: { randomUUID: () => "44444444-4444-4444-8444-444444444444" },
    localStorage: { getItem: () => consentValue, setItem() {} },
    location: { search: "", assign() {} },
    URLSearchParams,
    FormData: class {
      get(key: string) {
        return (
          { email: "person@example.test", name: "Person", phone: "" } as any
        )[key];
      }
    },
    document: {
      cookie: "_fbp=fb.1.test; _fbc=fb.1.click",
      getElementById: node,
      querySelectorAll: () => [],
      createElement: () => ({}),
      getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
    },
    fetch: async (url: string, options: any) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({
          captured: true,
          duplicate,
          tracking: { eventId: "server-lead-id" },
        }),
      };
    },
  };
  sandbox.window = sandbox;
  // Existing Pixel still needs PageView; it must not depend on installing fbq.
  sandbox.fbq = (...args: any[]) => events.push(args);
  const context = createContext(sandbox);
  new Script(html.match(/<script>([\s\S]*?)<\/script>/)![1]!).runInContext(
    context,
  );
  await node("lead-form").onsubmit({
    preventDefault() {},
    currentTarget: node("lead-form"),
  });
  return { events, requests, node };
}
const accepted = await runLanding("granted");
assert.equal(
  accepted.requests.filter((request) =>
    request.url.startsWith("/api/landings/"),
  ).length,
  1,
);
const pageView = accepted.events.find((event) => event[1] === "PageView")!;
const pageRequest = accepted.requests.find((request) =>
  request.url.startsWith("/api/landings/"),
)!;
assert.equal(
  pageView[3].eventID,
  `pageview:${pageId}:${pageRequest.body.eventId}`,
);
assert.equal(
  accepted.events.find((event) => event[1] === "Lead")![3].eventID,
  "server-lead-id",
);
assert.equal(
  accepted.requests.find((request) =>
    request.url.startsWith("/api/lead-capture/"),
  )!.body.landingTracking.marketingConsent,
  true,
);
const denied = await runLanding("denied");
assert.equal(denied.events.length, 0);
assert.equal(
  denied.requests.filter((request) => request.url.startsWith("/api/landings/"))
    .length,
  0,
);
assert.equal(denied.requests[0]!.body.landingTracking.marketingConsent, false);
assert.equal(
  (await runLanding("granted", true)).events.filter(
    (event) => event[1] === "Lead",
  ).length,
  0,
);

const publicRequest = {
  path: `/api/landings/${pageId}/events`,
  origin: "https://example.test",
  protocol: "https",
  host: "example.test",
};
assert.equal(
  await isVerifiedLandingSameOrigin(
    publicRequest,
    async (hostname) => hostname === "example.test",
  ),
  true,
);
assert.equal(
  await isVerifiedLandingSameOrigin(
    { ...publicRequest, origin: "https://other.test" },
    async () => true,
  ),
  false,
);
assert.equal(
  await isVerifiedLandingSameOrigin(
    { ...publicRequest, path: "/api/campaigns" },
    async () => true,
  ),
  false,
);
assert.equal(
  await isVerifiedLandingSameOrigin(publicRequest, async () => false),
  false,
);

assert.equal(
  (await runLanding("granted", false, "CompleteRegistration")).events.some(
    (event) => event[1] === "CompleteRegistration",
  ),
  true,
);

assertLandingAdTracking(
  { strategy: { paidMedia: configuration } },
  "example.test",
  { metaPixelId: "123456", metaLeadEventName: "Lead" },
);
assert.throws(
  () =>
    assertLandingAdTracking(
      { strategy: { paidMedia: configuration } },
      "example.test",
      { metaPixelId: "other", metaLeadEventName: "Lead" },
    ),
  /pixel da landing/,
);
assert.throws(
  () =>
    assertLandingAdTracking(
      { strategy: { paidMedia: configuration } },
      "example.test",
      { metaPixelId: "123456", metaLeadEventName: "CompleteRegistration" },
    ),
  /mesmo evento/,
);
const undecided = await runLanding(null);
assert.equal(undecided.events.length, 0);
undecided.node("accept").onclick();
undecided.node("accept").onclick();
assert.equal(
  undecided.events.filter((event) => event[1] === "PageView").length,
  1,
  "repeated consent action does not repeat PageView",
);



assertPaidMediaApprovalMatchesCampaign({ executiveSummary: "Preservado" }, { paidMediaSetup: { form, configuration } }, { strategy: snapshotFields.strategy, campaign: snapshotFields.schedule });
assert.throws(() => assertPaidMediaApprovalMatchesCampaign({}, { paidMediaSetup: { form, configuration: { ...configuration, destinationUrl: "https://changed.test/" } } }, { strategy: snapshotFields.strategy, campaign: snapshotFields.schedule }), /configuração de anúncios mudou/);

console.log(
  "Meta operational flow: PASS (setup/approval invalidation, scope, reporting aliases/grain, consent, source URL, actual landing JS event IDs/duplicate suppression)",
);
