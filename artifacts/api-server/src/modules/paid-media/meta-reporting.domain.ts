type Json = Record<string, unknown>;
const obj = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
export type MetaMeasurementEvent =
  "Lead" | "CompleteRegistration" | "Purchase" | "LinkClick";
const actions: Record<MetaMeasurementEvent, readonly string[]> = {
  Lead: ["offsite_conversion.fb_pixel_lead", "lead"],
  CompleteRegistration: [
    "offsite_conversion.fb_pixel_complete_registration",
    "complete_registration",
  ],
  Purchase: ["offsite_conversion.fb_pixel_purchase", "purchase"],
  LinkClick: ["link_click"],
};

export function metaMeasurementEvent(
  objective: unknown,
  adSetData: unknown,
): MetaMeasurementEvent | null {
  if (objective === "OUTCOME_TRAFFIC") return "LinkClick";
  const set = obj(adSetData);
  if (set.destination_type !== "WEBSITE") return null;
  const event = obj(set.promoted_object).custom_event_type;
  if (objective === "OUTCOME_LEADS" && event === "LEAD") return "Lead";
  if (objective === "OUTCOME_LEADS" && event === "COMPLETE_REGISTRATION")
    return "CompleteRegistration";
  if (objective === "OUTCOME_SALES" && event === "PURCHASE") return "Purchase";
  return null;
}

function actionEntries(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(obj) : [];
}
function nonNegative(value: unknown): number | null {
  const number = Number(value);
  return value != null && Number.isFinite(number) && number >= 0
    ? number
    : null;
}

export function measureMetaInsight(
  raw: Json,
  event: MetaMeasurementEvent | null,
) {
  if (!event)
    return {
      event: null,
      actionType: null,
      results: null,
      conversionValue: null,
      status: "goal_unavailable",
    };
  const entries = actionEntries(raw.actions);
  // Action aliases can describe the same conversion. Choose one available
  // representation; never sum generic and website aliases.
  const actionType =
    actions[event].find((type) =>
      entries.some((entry) => entry.action_type === type),
    ) ?? null;
  const entry = entries.find((item) => item.action_type === actionType);
  const results = entry
    ? nonNegative(entry.value)
    : Array.isArray(raw.actions)
      ? 0
      : null;
  const value = actionEntries(raw.action_values).find(
    (item) => item.action_type === actionType,
  );
  return {
    event,
    actionType,
    results,
    conversionValue:
      event === "Purchase"
        ? value
          ? nonNegative(value.value)
          : results === 0
            ? 0
            : null
        : null,
    status: results == null ? "metric_unavailable" : "measured",
  };
}

export type MetaReportInput = {
  entityType: string;
  currency: string;
  attributionWindow: string | null;
  spend: string | number;
  impressions: number;
  clicks: number;
  rawMetrics: unknown;
};
export function summarizeMetaReport(rows: MetaReportInput[], currency: string) {
  const groups = new Map<
    string,
    {
      event: string;
      attributionWindow: string;
      spend: number;
      impressions: number;
      clicks: number;
      results: number;
      metricComplete: boolean;
      conversionValue: number;
      valueComplete: boolean;
      rows: number;
      actionTypes: Set<string>;
    }
  >();
  let ignoredRows = 0;
  for (const row of rows) {
    // Ads are the single reporting grain. Campaign/ad-set aggregates would
    // count the same spend and conversions multiple times.
    if (row.entityType !== "ad" || row.currency !== currency) {
      ignoredRows++;
      continue;
    }
    const saved = obj(obj(row.rawMetrics).nexosMeasurement);
    const event = Object.hasOwn(actions, String(saved.event))
      ? (saved.event as MetaMeasurementEvent)
      : null;
    const measurement = measureMetaInsight(obj(row.rawMetrics), event);
    const key = `${event ?? "Unknown"}:${row.attributionWindow ?? "provider_default"}`;
    const group = groups.get(key) ?? {
      event: event ?? "Unknown",
      attributionWindow: row.attributionWindow ?? "provider_default",
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      metricComplete: true,
      conversionValue: 0,
      valueComplete: true,
      rows: 0,
      actionTypes: new Set<string>(),
    };
    group.spend += Number(row.spend);
    group.impressions += row.impressions;
    group.clicks += row.clicks;
    group.rows++;
    group.results += measurement.results ?? 0;
    group.metricComplete &&= measurement.results != null;
    group.conversionValue += measurement.conversionValue ?? 0;
    group.valueComplete &&= measurement.conversionValue != null;
    if (measurement.actionType) group.actionTypes.add(measurement.actionType);
    groups.set(key, group);
  }
  return {
    currency,
    grain: "ad",
    ignoredRows,
    groups: [...groups.values()].map((group) => ({
      event: group.event,
      attributionWindow: group.attributionWindow,
      spend: group.spend,
      impressions: group.impressions,
      clicks: group.clicks,
      rows: group.rows,
      results: group.metricComplete ? group.results : null,
      costPerResult:
        group.metricComplete && group.results > 0
          ? group.spend / group.results
          : null,
      purchaseValue:
        group.event === "Purchase" && group.valueComplete
          ? group.conversionValue
          : null,
      roas:
        group.event === "Purchase" && group.valueComplete && group.spend > 0
          ? group.conversionValue / group.spend
          : null,
      actionTypes: [...group.actionTypes],
      status: group.metricComplete
        ? "measured"
        : "resync_or_goal_review_required",
    })),
  };
}
