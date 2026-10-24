import { z } from "zod/v4";
import { AppError } from "../../lib/errors.js";

export const advancedReportQuery = z
  .object({
    accountId: z.string().uuid(),
    since: z.iso.date(),
    until: z.iso.date(),
    breakdown: z
      .enum(["none", "age_gender", "placement", "platform", "hour", "day"])
      .default("none"),
    attribution: z
      .enum(["account", "1d_click", "7d_click", "1d_view"])
      .default("account"),
  })
  .strict()
  .refine(
    (value) =>
      value.since <= value.until &&
      (Date.parse(value.until) - Date.parse(value.since)) / 86400000 < 31,
    "Escolha até 31 dias, incluindo as duas datas.",
  );
export type AdvancedReportQuery = z.infer<typeof advancedReportQuery>;
type Json = Record<string, any>;
export const reportBreakdowns = {
  none: [],
  age_gender: ["age", "gender"],
  placement: ["publisher_platform", "platform_position"],
  platform: ["publisher_platform"],
  hour: ["hourly_stats_aggregated_by_advertiser_time_zone"],
  day: [],
} satisfies Record<AdvancedReportQuery["breakdown"], string[]>;
const commonFields = [
  "account_id",
  "account_currency",
  "date_start",
  "date_stop",
  "impressions",
  "clicks",
  "spend",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
];
const videoFields = [
  "video_play_actions",
  "video_p75_watched_actions",
  "video_thruplay_watched_actions",
];
const rankingFields = [
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking",
];
export function advancedInsightsQuery(
  form: AdvancedReportQuery,
  summary: boolean,
): Record<string, string> {
  const dimensions = summary ? [] : reportBreakdowns[form.breakdown];
  return {
    level: summary ? "account" : "ad",
    time_range: JSON.stringify({ since: form.since, until: form.until }),
    time_increment: !summary && form.breakdown === "day" ? "1" : "all_days",
    limit: "200",
    fields: [
      ...commonFields,
      ...(summary
        ? []
        : [
            "ad_id",
            "ad_name",
            "adset_id",
            "adset_name",
            "campaign_id",
            "campaign_name",
          ]),
      ...(summary || form.breakdown !== "hour"
        ? ["reach", "frequency", ...videoFields]
        : []),
      ...(!summary && form.breakdown === "none" ? rankingFields : []),
    ].join(","),
    ...(dimensions.length ? { breakdowns: dimensions.join(",") } : {}),
    ...(form.attribution === "account"
      ? { use_account_attribution_setting: "true" }
      : { action_attribution_windows: JSON.stringify([form.attribution]) }),
    action_report_time: "impression",
  };
}
export const nullableMetric = (value: unknown): number | null => {
  if (
    value == null ||
    typeof value === "boolean" ||
    typeof value === "object" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const ratio = (
  numerator: number | null,
  denominator: number | null,
  multiplier = 1,
) => {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : null;
};
function actionValue(
  input: unknown,
  aliases: string[],
  attribution: AdvancedReportQuery["attribution"],
  missingIsZero = true,
) {
  if (!Array.isArray(input)) return null;
  for (const alias of aliases) {
    const rows = input.filter(
      (row) => row && typeof row === "object" && row.action_type === alias,
    );
    if (rows.length > 1) return null; // An ambiguous action grain is not additive.
    if (rows[0])
      return nullableMetric(
        attribution !== "account" && Object.hasOwn(rows[0], attribution)
          ? rows[0][attribution]
          : rows[0].value,
      );
  }
  return missingIsZero ? 0 : null; // Missing revenue is unknown, even with known purchases.
}
const actionAliases = {
  purchases: ["offsite_conversion.fb_pixel_purchase", "purchase"],
  leads: ["offsite_conversion.fb_pixel_lead", "lead"],
  registrations: [
    "offsite_conversion.fb_pixel_complete_registration",
    "complete_registration",
  ],
  addToCart: ["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"],
  checkouts: [
    "offsite_conversion.fb_pixel_initiate_checkout",
    "initiate_checkout",
  ],
  linkClicks: ["link_click"],
};
const text = (value: unknown) =>
  typeof value === "string" && value.length <= 500 ? value : null;
export function advancedRowMetrics(
  row: Json,
  form: AdvancedReportQuery,
  summary = false,
) {
  const impressions = nullableMetric(row.impressions),
    clicks = nullableMetric(row.clicks),
    spend = nullableMetric(row.spend);
  const metrics = Object.fromEntries(
    Object.entries(actionAliases).map(([key, aliases]) => [
      key,
      actionValue(row.actions, aliases, form.attribution),
    ]),
  ) as Record<keyof typeof actionAliases, number | null>;
  const purchaseValue = actionValue(
    row.action_values,
    actionAliases.purchases,
    form.attribution,
    false,
  );
  const rate = (
    key: string,
    numerator: number | null,
    denominator: number | null,
    multiplier = 1,
  ) =>
    row[key] == null
      ? ratio(numerator, denominator, multiplier)
      : nullableMetric(row[key]);
  // Do not turn account/hour aggregate reach or rankings into sums or averages.
  const supportsUnique = summary || form.breakdown !== "hour";
  const video = (key: string) => {
    const rows = row[key];
    if (!supportsUnique || !Array.isArray(rows)) return null;
    if (!rows.length) return 0;
    const matches = rows.filter((item) => item?.action_type === "video_view");
    return matches.length === 1 ? nullableMetric(matches[0].value) : null;
  };
  return {
    impressions,
    clicks,
    spend,
    reach: supportsUnique ? nullableMetric(row.reach) : null,
    frequency: supportsUnique ? nullableMetric(row.frequency) : null,
    ctr: rate("ctr", clicks, impressions, 100),
    cpc: rate("cpc", spend, clicks),
    cpm: rate("cpm", spend, impressions, 1000),
    ...metrics,
    purchaseValue,
    roas: ratio(purchaseValue, spend),
    costPerLead: ratio(spend, metrics.leads),
    costPerPurchase: ratio(spend, metrics.purchases),
    videoPlays: video("video_play_actions"),
    video75: video("video_p75_watched_actions"),
    thruPlays: video("video_thruplay_watched_actions"),
    qualityRanking:
      !summary && form.breakdown === "none" ? text(row.quality_ranking) : null,
    engagementRanking:
      !summary && form.breakdown === "none"
        ? text(row.engagement_rate_ranking)
        : null,
    conversionRanking:
      !summary && form.breakdown === "none"
        ? text(row.conversion_rate_ranking)
        : null,
  };
}
export function assertReportRow(
  row: unknown,
  account: { providerAccountId: string; currency: string },
  form: AdvancedReportQuery,
  summary: boolean,
): asserts row is Json {
  const input = row as Json;
  if (
    !input ||
    typeof input !== "object" ||
    input.account_id !== account.providerAccountId.replace(/^act_/, "") ||
    input.account_currency !== account.currency ||
    !z.iso.date().safeParse(input.date_start).success ||
    !z.iso.date().safeParse(input.date_stop).success ||
    input.date_start < form.since ||
    input.date_stop > form.until ||
    input.date_start > input.date_stop ||
    (!summary &&
      (typeof input.ad_id !== "string" || !/^\d+$/.test(input.ad_id))) ||
    (!summary &&
      reportBreakdowns[form.breakdown].some(
        (key) =>
          typeof input[key] !== "string" ||
          !input[key] ||
          input[key].length > 200,
      ))
  ) {
    throw new AppError(
      502,
      "A Meta retornou conta, moeda, período ou detalhamento incompatível. Revise a conta e o filtro.",
      "META_REPORT_SCOPE_INVALID",
    );
  }
  if (
    !summary &&
    form.breakdown === "day" &&
    input.date_start !== input.date_stop
  )
    throw new AppError(
      502,
      "O detalhamento diário retornou um período agregado.",
      "META_REPORT_SCOPE_INVALID",
    );
}
export function advancedReportRow(row: Json, form: AdvancedReportQuery) {
  return {
    adId: row.ad_id as string,
    adName: text(row.ad_name),
    adSetId: text(row.adset_id),
    adSetName: text(row.adset_name),
    campaignId: text(row.campaign_id),
    campaignName: text(row.campaign_name),
    since: row.date_start as string,
    until: row.date_stop as string,
    weekday:
      form.breakdown === "day"
        ? new Date(`${row.date_start}T00:00:00Z`).getUTCDay()
        : null,
    dimensions: Object.fromEntries(
      reportBreakdowns[form.breakdown].map((key) => [key, row[key] as string]),
    ),
    ...advancedRowMetrics(row, form),
  };
}
