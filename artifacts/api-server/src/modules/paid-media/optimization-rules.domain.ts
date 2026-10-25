export type OptimizationThresholds = { minSpend?: number; maxCpa?: number; minRoas?: number; minCtr?: number };
export type OptimizationMetrics = { spend: number; conversions: number; conversionValue: number; impressions: number; clicks: number };

export function evaluateOptimizationThresholds(metrics: OptimizationMetrics, thresholds: OptimizationThresholds) {
  const cpa = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
  const roas = metrics.spend > 0 ? metrics.conversionValue / metrics.spend : null;
  const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions * 100 : null;
  const breaches = [
    thresholds.maxCpa != null && (cpa == null || cpa > thresholds.maxCpa) ? `CPA ${cpa == null ? "sem conversões" : cpa.toFixed(2)} acima de ${thresholds.maxCpa}` : null,
    thresholds.minRoas != null && (roas == null || roas < thresholds.minRoas) ? `ROAS ${roas == null ? "indisponível" : roas.toFixed(2)} abaixo de ${thresholds.minRoas}` : null,
    thresholds.minCtr != null && (ctr == null || ctr < thresholds.minCtr) ? `CTR ${ctr == null ? "indisponível" : ctr.toFixed(2)}% abaixo de ${thresholds.minCtr}%` : null,
  ].filter((message): message is string => Boolean(message));
  return { eligible: metrics.spend >= (thresholds.minSpend ?? 0), breaches, cpa, roas, ctr };
}
