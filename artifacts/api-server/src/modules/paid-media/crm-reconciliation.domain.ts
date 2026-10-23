export type ReconciliationMedia = {
  accountId: string;
  currency: string;
  entityId: string;
  metricDate: string;
  dateGrain: string;
  entityType: string;
  attributionWindow: string | null;
  spend: string | number;
  impressions: number;
  clicks: number;
  syncedAt: Date;
};
export type ReconciliationConversion = {
  currency: string;
  value: string | number;
  reconciliationStatus: string;
  accountId: string | null;
  occurredAt: Date;
  touchpointAt: Date | null;
};
export function summarizeCrmReconciliation(
  media: ReconciliationMedia[],
  conversions: ReconciliationConversion[],
) {
  // Pick a single attribution snapshot per account/currency. Never add campaign,
  // ad-set and ad totals, or copies of spend from different attribution windows.
  const buckets = new Map<string, ReconciliationMedia[]>();
  for (const row of media) {
    if (row.entityType !== "ad" || row.dateGrain !== "daily") continue;
    const key = JSON.stringify([row.accountId, row.currency.toUpperCase()]);
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  const groups = [...buckets.entries()].map(([key, rows]) => {
    const windows = [
      ...new Set(rows.map((row) => row.attributionWindow ?? "")),
    ].sort();
    const selectedWindow = windows[0]!;
    const latest = new Map<string, ReconciliationMedia>();
    for (const row of rows.filter(
      (row) => (row.attributionWindow ?? "") === selectedWindow,
    )) {
      const naturalKey = JSON.stringify([row.entityId, row.metricDate]);
      if (
        !latest.has(naturalKey) ||
        latest.get(naturalKey)!.syncedAt < row.syncedAt
      )
        latest.set(naturalKey, row);
    }
    const [accountId, currency] = JSON.parse(key) as [string, string];
    const spend = [...latest.values()].reduce(
      (sum, row) => sum + Number(row.spend),
      0,
    );
    const impressions = [...latest.values()].reduce(
      (sum, row) => sum + row.impressions,
      0,
    );
    const clicks = [...latest.values()].reduce(
      (sum, row) => sum + row.clicks,
      0,
    );
    const attributed = conversions.filter(
      (row) =>
        row.reconciliationStatus === "reconciled" &&
        row.accountId === accountId &&
        row.currency.toUpperCase() === currency &&
        row.touchpointAt &&
        row.touchpointAt <= row.occurredAt,
    );
    const crmRevenue = attributed.reduce(
      (sum, row) => sum + Number(row.value),
      0,
    );
    return {
      accountId,
      currency,
      attributionWindow: selectedWindow || null,
      ignoredAttributionWindows: windows.slice(1),
      spend,
      impressions,
      clicks,
      crmConversions: attributed.length,
      crmRevenue,
      ctr: impressions ? clicks / impressions : null,
      cpa: attributed.length ? spend / attributed.length : null,
      roas: spend ? crmRevenue / spend : null,
    };
  });
  const excluded = new Map<
    string,
    { currency: string; conversions: number; revenue: number }
  >();
  for (const row of conversions) {
    if (
      groups.some(
        (group) =>
          row.reconciliationStatus === "reconciled" &&
          group.accountId === row.accountId &&
          group.currency === row.currency.toUpperCase() &&
          row.touchpointAt &&
          row.touchpointAt <= row.occurredAt,
      )
    )
      continue;
    const currency = row.currency.toUpperCase();
    const bucket = excluded.get(currency) ?? {
      currency,
      conversions: 0,
      revenue: 0,
    };
    bucket.conversions++;
    bucket.revenue += Number(row.value);
    excluded.set(currency, bucket);
  }
  return {
    grain: "ad_daily",
    attributionModel: "crm_linked_touchpoint",
    comparison: "period_totals_not_cohort",
    groups,
    excludedFromPaidMetrics: [...excluded.values()],
  };
}
