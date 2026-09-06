import type { ProviderAccount, ProviderAction, ProviderEntity, ProviderInsight } from "./providers.js";

type ProviderRow = Record<string, unknown>;

export function normalizeMetaAccounts(rows: ProviderRow[]): ProviderAccount[] {
  return rows.filter((row) => typeof row["id"] === "string").map((row) => {
    const id = String(row["id"]);
    return {
      providerAccountId: id.startsWith("act_") ? id : `act_${id}`,
      name: String(row["name"] ?? id),
      currency: String(row["currency"] ?? "USD"),
      timezone: String(row["timezone_name"] ?? "UTC"),
    };
  });
}

export function normalizeTikTokAccounts(rows: ProviderRow[]): ProviderAccount[] {
  return rows.filter((row) => row["advertiser_id"] != null).map((row) => ({
    providerAccountId: String(row["advertiser_id"]),
    name: String(row["advertiser_name"] ?? row["advertiser_id"]),
    currency: String(row["currency"] ?? "USD"),
    timezone: String(row["timezone"] ?? "UTC"),
  }));
}

function metaActionTotal(values: unknown, action = "offsite_conversion.fb_pixel_purchase"): number {
  return Array.isArray(values) ? values
    .filter((value): value is ProviderRow => !!value && typeof value === "object")
    .filter((value) => value["action_type"] === action)
    .reduce((sum, value) => sum + Number(value["value"] ?? 0), 0) : 0;
}

export function normalizeMetaInsights(rows: ProviderRow[]): ProviderInsight[] {
  return rows.map((row) => ({
    providerInsightId: `${row["id"]}:${row["date_start"]}`,
    providerEntityId: String(row["id"]),
    metricDate: String(row["date_start"]),
    attributionWindow: "provider_default",
    currency: String(row["account_currency"] ?? "USD"),
    timezone: "UTC",
    impressions: Number(row["impressions"] ?? 0),
    clicks: Number(row["clicks"] ?? 0),
    spend: String(row["spend"] ?? "0"),
    conversions: String(metaActionTotal(row["actions"])),
    conversionValue: String(metaActionTotal(row["action_values"])),
    rawMetrics: row,
  }));
}

export function normalizeTikTokInsights(rows: ProviderRow[], type: ProviderAction["entityType"]): ProviderInsight[] {
  return rows.map((row) => ({
    providerEntityId: String(row[`${type === "ad_set" ? "adgroup" : type}_id`] ?? row["id"]),
    metricDate: String(row["stat_time_day"]),
    currency: "USD",
    timezone: "UTC",
    impressions: Number(row["impressions"] ?? 0),
    clicks: Number(row["clicks"] ?? 0),
    spend: String(row["spend"] ?? "0"),
    conversions: String(row["conversion"] ?? "0"),
    conversionValue: String(row["total_purchase_value"] ?? "0"),
    rawMetrics: row,
  }));
}

export function tikTokRefreshPersistence(
  credential: { refreshToken: string | null },
  data: ProviderRow,
  now = Date.now(),
) {
  if (!data["access_token"]) throw new Error("TikTok Ads did not return a refreshed credential.");
  return {
    accessToken: String(data["access_token"]),
    refreshToken: String(data["refresh_token"] ?? credential.refreshToken),
    tokenExpiresAt: new Date(now + Number(data["expires_in"] ?? 0) * 1000),
    status: "connected" as const,
  };
}

export type PolicyLimits = {
  enabled: boolean;
  accepted: boolean;
  mandatoryPause: boolean;
  minimumSampleSize: number;
  minimumDataQualityScore: number;
  maxDailyBudgetChangePercent: number;
  maxBidChangePercent: number;
};

export function policyAllows(
  policy: PolicyLimits,
  action: Pick<ProviderAction, "type" | "changes">,
  sampleSize: number,
  quality: number,
): boolean {
  const crossPlatform = typeof action.changes["targetProvider"] === "string";
  const delta = Number(action.changes["dailyBudgetDeltaPercent"] ?? action.changes["bidDeltaPercent"] ?? 0);
  const limit = action.type === "update_bid" ? policy.maxBidChangePercent : policy.maxDailyBudgetChangePercent;
  return !crossPlatform && policy.enabled && policy.accepted && !policy.mandatoryPause
    && sampleSize >= policy.minimumSampleSize && quality >= policy.minimumDataQualityScore
    && Math.abs(delta) <= limit;
}

export function requiresHumanApproval(action: Pick<ProviderAction, "changes">, provider: string): boolean {
  return typeof action.changes["targetProvider"] === "string" && action.changes["targetProvider"] !== provider;
}

export function verifyActionSnapshot(action: Pick<ProviderAction, "type" | "changes">, after: ProviderEntity): boolean {
  if (action.type === "pause") return after.status === "PAUSED" || after.status === "DISABLE";
  if (action.type === "resume") return after.status === "ACTIVE" || after.status === "ENABLE";
  if (action.type === "update_daily_budget") return String(after.data["daily_budget"] ?? after.data["budget"]) === String(action.changes["dailyBudget"]);
  if (action.type === "update_bid") return String(after.data["bid_amount"] ?? after.data["bid_price"]) === String(action.changes["bidAmount"]);
  return false;
}

/** Builds rollback input exclusively from the persisted pre-action snapshot. */
export function rollbackActionFromSnapshot(action: ProviderAction, before: ProviderEntity): ProviderAction {
  const changes = action.type === "update_daily_budget" ? { dailyBudget: before.data["daily_budget"] ?? before.data["budget"] }
    : action.type === "update_bid" ? { bidAmount: before.data["bid_amount"] ?? before.data["bid_price"] } : {};
  return {
    ...action,
    type: Object.keys(changes).length ? action.type : (before.status === "PAUSED" || before.status === "DISABLE" ? "pause" : "resume"),
    changes,
    expectedVersion: undefined,
    idempotencyKey: `${action.idempotencyKey}:rollback`,
  };
}