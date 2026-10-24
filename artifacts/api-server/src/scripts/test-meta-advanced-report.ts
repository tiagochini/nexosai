import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  paidMediaAccountsTable as accounts,
  workspaceIntegrationsTable as integrations,
} from "@workspace/db";
import {
  advancedReportQuery,
  advancedInsightsQuery,
  advancedRowMetrics,
  advancedReportRow,
} from "../modules/paid-media/meta-advanced-report.domain.js";
import { paidMediaAdvancedReport } from "../modules/paid-media/meta-advanced-report.service.js";
import { metaAccountAssetRequest } from "../modules/paid-media/providers.js";
import { env } from "../lib/env.js";

const original = {
    select: db.select,
    insert: db.insert,
    update: db.update,
    delete: db.delete,
  },
  originalFetch = globalThis.fetch,
  oldInstagram = env.INSTAGRAM_APP_ID,
  oldE2e = env.META_E2E_TEST_MODE;
const workspaceId = randomUUID(),
  accountId = randomUUID(),
  integrationId = randomUUID();
const account = {
  id: accountId,
  workspaceId,
  integrationId,
  provider: "meta_ads",
  providerAccountId: "act_9",
  currency: "BRL",
  timezone: "America/Cuiaba",
  isSelected: true,
};
const form = {
  accountId,
  since: "2026-10-01",
  until: "2026-10-07",
  breakdown: "none" as const,
  attribution: "account" as const,
};
const sample = {
  account_id: "9",
  account_currency: "BRL",
  date_start: form.since,
  date_stop: form.until,
  spend: "100",
  impressions: "1000",
  clicks: "50",
  reach: "600",
  frequency: "1.66",
  actions: [
    {
      action_type: "offsite_conversion.fb_pixel_purchase",
      value: "3",
      "7d_click": "2",
    },
    { action_type: "purchase", value: "3" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "5" },
    { action_type: "add_to_cart", value: "8" },
  ],
  action_values: [
    {
      action_type: "offsite_conversion.fb_pixel_purchase",
      value: "300",
      "7d_click": "200",
    },
  ],
  video_play_actions: [{ action_type: "video_view", value: "20" }],
  video_3_sec_watched_actions: [{ action_type: "video_view", value: "16" }],
  video_p75_watched_actions: [{ action_type: "video_view", value: "5" }],
  quality_ranking: "AVERAGE",
  engagement_rate_ranking: "ABOVE_AVERAGE",
  conversion_rate_ranking: "AVERAGE",
};
const detail = {
  ...sample,
  ad_id: "11",
  ad_name: "Ad",
  adset_id: "22",
  campaign_id: "33",
};
const dialect = new PgDialect();
let reads = 0,
  purpose = "paid_media";
try {
  // There is no write path in an advanced report.
  db.insert =
    db.update =
    db.delete =
      (() => {
        throw new Error("Report attempted a database mutation");
      }) as any;
  db.select = (() => ({
    from(table: unknown) {
      let condition: any;
      const execute = () => {
        const { params, sql } = dialect.sqlToQuery(condition);
        assert.match(sql, /workspace_id/);
        if (!params.includes(workspaceId)) return [];
        if (table === accounts)
          return params.includes(accountId) && account.isSelected
            ? [structuredClone(account)]
            : [];
        assert.equal(table, integrations);
        return [
          {
            integrationId: "organic",
            accessToken: "organic-secret",
            metadata: { integrationPurpose: "organic_social" },
          },
          {
            integrationId,
            accessToken: "paid-secret",
            metadata: { integrationPurpose: purpose },
          },
        ];
      };
      const chain: any = {
        where(value: any) {
          condition = value;
          return chain;
        },
        limit: async () => execute(),
        then(resolve: any) {
          resolve(execute());
        },
      };
      return chain;
    },
  })) as any;
  assert.equal(
    advancedReportQuery.safeParse({
      ...form,
      since: "2026-01-01",
      until: "2026-01-31",
    }).success,
    true,
  );
  assert.equal(
    advancedReportQuery.safeParse({
      ...form,
      since: "2026-01-01",
      until: "2026-02-01",
    }).success,
    false,
  );
  assert.equal(
    advancedReportQuery.safeParse({ ...form, since: "2026-02-30" }).success,
    false,
  );
  assert.equal(advancedReportQuery.safeParse({
    ...form, reviewConversion: "purchases", reviewTargetCost: "20",
  }).success, false, "Cost review requires a user-defined sample floor");
  const reviewForm = advancedReportQuery.parse({
    ...form,
    reviewMinImpressions: "100",
    reviewMaxFrequency: "1.5",
    reviewMinCtrPercent: "6",
    reviewConversion: "purchases",
    reviewTargetCost: "20",
    reviewMinConversions: "2",
  });
  const reviewed = advancedReportRow({ ...detail, ...sample }, reviewForm);
  assert.ok(reviewed.optimizationReview.includes("frequency_at_or_above_user_limit"));
  assert.ok(reviewed.optimizationReview.includes("ctr_below_user_benchmark"));
  assert.ok(reviewed.optimizationReview.includes("cost_above_user_target"));
  assert.ok(reviewed.optimizationReview.includes("fatigue_review_signal"));
  assert.deepEqual(advancedReportRow({ ...detail, ...sample }, form).optimizationReview, []);
  assert.equal(
    advancedRowMetrics(
      {
        ...sample,
        spend: "not-a-number",
        impressions: -1,
        reach: "",
        frequency: null,
      },
      form,
    ).spend,
    null,
  );
  assert.equal(
    advancedRowMetrics(
      { ...sample, spend: 1e308, clicks: 1e-308, cpc: undefined },
      form,
    ).cpc,
    null,
  );
  const metrics = advancedRowMetrics(sample, form);
  assert.equal(metrics.purchases, 3, "Do not sum purchase aliases");
  assert.equal(metrics.purchaseValue, 300);
  assert.equal(metrics.roas, 3);
  assert.equal(metrics.ctr, 5);
  assert.equal(metrics.cpc, 2);
  assert.equal(metrics.cpm, 100);
  assert.equal(metrics.costPerLead, 20);
  assert.equal(metrics.qualityRanking, "AVERAGE");
  assert.equal(metrics.videoPlays, 20);
  assert.equal(metrics.video3SecondViews, 16);
  assert.equal(metrics.video75, 5);
  assert.equal(metrics.thruPlays, null);
  const explicit = advancedRowMetrics(sample, {
    ...form,
    attribution: "7d_click",
  });
  assert.equal(explicit.purchases, 2);
  assert.equal(explicit.purchaseValue, 200);
  assert.equal(
    advancedRowMetrics({ ...sample, action_values: [] }, form).purchaseValue,
    null,
    "Unknown revenue must not become zero",
  );
  assert.equal(
    advancedRowMetrics({ ...sample, actions: undefined }, form).purchases,
    null,
  );
  assert.equal(
    advancedRowMetrics({ ...sample, actions: [] }, form).purchases,
    0,
  );
  assert.equal(
    advancedRowMetrics(
      {
        ...sample,
        actions: [
          { action_type: "purchase", value: "4" },
          { action_type: "purchase", value: "5" },
        ],
      },
      form,
    ).purchases,
    null,
  );
  assert.equal(
    advancedRowMetrics({ ...sample, spend: 0, impressions: 0, clicks: 0 }, form)
      .roas,
    null,
  );
  for (const breakdown of [
    "age_gender",
    "placement",
    "platform",
    "hour",
    "day",
  ] as const) {
    const query = advancedInsightsQuery({ ...form, breakdown }, false),
      summary = advancedInsightsQuery({ ...form, breakdown }, true);
    assert.equal(query.level, "ad");
    assert.ok(!query.fields.includes("quality_ranking"));
    assert.equal(summary.level, "account");
    assert.equal(summary.breakdowns, undefined);
    assert.equal(summary.time_increment, "all_days");
    if (breakdown === "hour") {
      assert.ok(!query.fields.split(",").includes("reach"));
      assert.equal(
        advancedRowMetrics(sample, { ...form, breakdown }).reach,
        null,
      );
    }
    if (breakdown === "day") assert.equal(query.time_increment, "1");
  }
  assert.equal(
    advancedInsightsQuery({ ...form, attribution: "7d_click" }, false)
      .action_attribution_windows,
    '["7d_click"]',
  );
  assert.equal(
    advancedInsightsQuery(form, false).use_account_attribution_setting,
    "true",
  );
  const reader: any = async (
    ws: string,
    acct: string,
    path: string,
    options: any,
  ) => {
    reads++;
    assert.equal(ws, workspaceId);
    assert.equal(acct, accountId);
    assert.equal(path, "account/insights");
    assert.equal(options.method, undefined);
    assert.equal(options.query.time_increment, "all_days");
    if (options.query.level === "account") return { data: [sample] };
    if (!options.query.after)
      return {
        data: [detail],
        paging: {
          next: "https://attacker.invalid/?access_token=private",
          cursors: { after: "cursor-2" },
        },
      };
    assert.equal(options.query.after, "cursor-2");
    return { data: [{ ...detail, ad_id: "12", reach: "600" }] };
  };
  await assert.rejects(
    paidMediaAdvancedReport(workspaceId, { ...form, fields: "secret" }, reader),
  );
  await assert.rejects(
    paidMediaAdvancedReport(
      workspaceId,
      { ...form, breakdown: "arbitrary,field" },
      reader,
    ),
  );
  await assert.rejects(paidMediaAdvancedReport(randomUUID(), form, reader));
  assert.equal(reads, 0);
  account.isSelected = false;
  await assert.rejects(paidMediaAdvancedReport(workspaceId, form, reader));
  account.isSelected = true;
  assert.equal(reads, 0);
  const report = await paidMediaAdvancedReport(workspaceId, form, reader);
  assert.equal(reads, 3);
  assert.equal(report.rows.length, 2);
  assert.equal(
    report.summary!.reach,
    600,
    "Account reach comes from its period query, never 600+600 across ads",
  );
  assert.equal(report.summary!.frequency, 1.66);
  assert.equal(report.complete, true);
  const rowsReader =
    (rows: any[], total: any[] = [sample]): any =>
    async (_ws: string, _acct: string, _path: string, options: any) => ({
      data: options.query.level === "account" ? total : rows,
    });
  for (const changed of [
    { account_id: "foreign" },
    { account_currency: "USD" },
    { date_start: "2026-09-30" },
    { ad_id: "" },
  ])
    await assert.rejects(
      paidMediaAdvancedReport(
        workspaceId,
        form,
        rowsReader([{ ...detail, ...changed }]),
      ),
      (error: any) => error.code === "META_REPORT_SCOPE_INVALID",
    );
  await assert.rejects(
    paidMediaAdvancedReport(workspaceId, form, rowsReader([detail, detail])),
    (error: any) => error.code === "META_REPORT_DUPLICATE",
  );
  await assert.rejects(
    paidMediaAdvancedReport(
      workspaceId,
      form,
      rowsReader(
        Array.from({ length: 5001 }, (_, index) => ({
          ...detail,
          ad_id: String(index + 100),
        })),
      ),
    ),
    (error: any) => error.code === "META_REPORT_LIMIT",
  );
  await assert.rejects(
    paidMediaAdvancedReport(
      workspaceId,
      form,
      rowsReader([detail], [sample, sample]),
    ),
    (error: any) => error.code === "META_REPORT_INVALID",
  );
  await assert.rejects(
    paidMediaAdvancedReport(
      workspaceId,
      { ...form, breakdown: "placement" },
      rowsReader([detail]),
    ),
    (error: any) => error.code === "META_REPORT_SCOPE_INVALID",
  );
  await assert.rejects(
    paidMediaAdvancedReport(workspaceId, form, (async () => ({
      data: [],
      paging: { next: "https://never-follow.invalid" },
    })) as any),
    (error: any) => error.code === "META_REPORT_LIMIT",
  );
  await assert.rejects(
    paidMediaAdvancedReport(workspaceId, form, (async () => ({
      data: [],
      paging: { next: "ignored", cursors: { after: "repeat" } },
    })) as any),
    (error: any) => error.code === "META_REPORT_LIMIT",
  );
  let calls = 0;
  await assert.rejects(
    paidMediaAdvancedReport(workspaceId, form, (async () => {
      calls++;
      throw new Error("private reflected token");
    }) as any),
    (error: any) =>
      error.code === "META_REPORT_PROVIDER_ERROR" &&
      !error.message.includes("private reflected"),
  );
  assert.equal(
    calls,
    1,
    "No fallback to another window or unsupported field subset",
  );
  const day = await paidMediaAdvancedReport(
    workspaceId,
    { ...form, breakdown: "day" },
    rowsReader([
      { ...detail, date_start: "2026-10-04", date_stop: "2026-10-04" },
    ]),
  );
  assert.equal(day.rows[0]!.weekday, 0);
  assert.equal(
    (await paidMediaAdvancedReport(workspaceId, form, rowsReader([], [])))
      .summary,
    null,
  );
  Object.assign(env, { INSTAGRAM_APP_ID: "", META_E2E_TEST_MODE: false });
  let http = 0;
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    http++;
    const target = new URL(url);
    assert.equal(target.origin, "https://graph.facebook.com");
    assert.equal(target.pathname, "/v26.0/act_9/insights");
    assert.equal(target.searchParams.get("access_token"), "paid-secret");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as any;
  await metaAccountAssetRequest(workspaceId, accountId, "account/insights", {
    query: advancedInsightsQuery(form, true),
  });
  assert.equal(http, 1);
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "account/insights", {
      method: "POST",
    }),
  );
  assert.equal(http, 1);
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "act_8/insights"),
  );
  assert.equal(http, 1);
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "account/insights", {
      payload: { unexpected: true },
    }),
  );
  assert.equal(http, 1);
  purpose = "organic_social";
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "account/insights"),
  );
  assert.equal(http, 1);
  console.log(
    "PASS advanced Meta reports: exact paid credential, read-only/no DB writes, bounded strict query, period account reach/frequency, aliases/attribution/revenue nulls, pagination without URL following, duplicate/scope/partial-result rejection, daily/hourly/ranking limits; no live Graph",
  );
} finally {
  Object.assign(db, original);
  globalThis.fetch = originalFetch;
  Object.assign(env, {
    INSTAGRAM_APP_ID: oldInstagram,
    META_E2E_TEST_MODE: oldE2e,
  });
}
