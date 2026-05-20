/**
 * Traffic Feedback Loop — Aprendizado operacional do tráfego
 *
 * Transforma dados brutos de performance em inteligência acionável.
 * Aprende padrões de hook, ângulo, emoção e formato e injeta de volta
 * no Campaign Brain para que novos criativos comecem mais inteligentes.
 *
 * Integration points:
 *  - Called: metrics.service.ts setImmediate after ingestMetrics
 *  - Writes: campaigns.brainData.trafficLearnings
 *  - Enhanced fatigue signals: CPM rise + frequency + thumbstop beyond just CTR
 */

import { db, campaignsTable, campaignMetricsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import type { Logger } from "pino";
import { getCampaignBrain, updateBrainSection, type TrafficLearnings } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FatigueAnalysis {
  isFatigued:    boolean;
  signals:       string[];
  severity:      "none" | "warning" | "critical";
  recommendation:string;
  fatigueScore:  number; // 0-100 (100 = very fatigued)
}

export interface TrafficInsight {
  type:       "hook_winner" | "hook_loser" | "fatigue" | "cpm_spike" | "frequency_cap" | "angle_discovery";
  label:      string;
  metric:     string;
  value:      number;
  lift?:      number;
  action:     string;
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export async function processTrafficFeedback(
  campaignId:   string,
  workspaceId:  string,
  latestMetric: Record<string, unknown>,
  log:          Logger,
): Promise<void> {
  try {
    // Pull recent 7 days of metrics for pattern detection
    const recentMetrics = await db
      .select({
        dayIndex:          campaignMetricsTable.dayIndex,
        ctr:               campaignMetricsTable.ctr,
        roas:              campaignMetricsTable.roas,
        impressions:       campaignMetricsTable.impressions,
        clicks:            campaignMetricsTable.clicks,
        conversionRate:    campaignMetricsTable.conversionRate,
        socialEngagements: campaignMetricsTable.socialEngagements,
        notes:             campaignMetricsTable.notes,
        healthScore:       campaignMetricsTable.healthScore,
      })
      .from(campaignMetricsTable)
      .where(eq(campaignMetricsTable.campaignId, campaignId))
      .orderBy(desc(campaignMetricsTable.dayIndex))
      .limit(14);

    if (recentMetrics.length < 2) return;

    const brain = await getCampaignBrain(campaignId);
    const existing = brain?.trafficLearnings ?? defaultLearnings();

    const insights: TrafficInsight[] = [];
    const fatigueSignals: string[] = [];

    // ── CTR trend analysis ──
    const ctrs = recentMetrics.map(m => Number(m.ctr ?? 0)).filter(v => v > 0);
    const cpms: number[] = []; // CPM not stored in campaignMetricsTable — no spike detection via DB

    if (ctrs.length >= 3) {
      const peakCTR   = Math.max(...ctrs);
      const recentCTR = ctrs[0] ?? 0;
      const ctrDrop   = peakCTR > 0 ? (1 - recentCTR / peakCTR) : 0;

      // CTR drop signal
      if (ctrDrop > 0.30 && peakCTR > 0.005) {
        fatigueSignals.push(`CTR caiu ${Math.round(ctrDrop * 100)}% do pico (${(recentCTR * 100).toFixed(2)}% vs ${(peakCTR * 100).toFixed(2)}%)`);
        insights.push({
          type: "fatigue", label: "Queda de CTR detectada",
          metric: "ctr", value: recentCTR, lift: -ctrDrop,
          action: `Substituir hook principal — novo ângulo sugerido baseado em ${brain?.narrative.dominantEmotion ?? "emoção dominante"}`,
        });
      }

      // CPM spike signal (ad auction heating up — creative losing relevance)
      if (cpms.length >= 3) {
        const avgCPM    = cpms.slice(1).reduce((s, v) => s + v, 0) / Math.max(1, cpms.length - 1);
        const currentCPM = cpms[0] ?? 0;
        if (currentCPM > avgCPM * 1.35 && avgCPM > 0) {
          fatigueSignals.push(`CPM subiu ${Math.round((currentCPM / avgCPM - 1) * 100)}% — leilão aquecendo, relevância caindo`);
          insights.push({
            type: "cpm_spike", label: "CPM em alta",
            metric: "cpm", value: currentCPM, lift: currentCPM / avgCPM - 1,
            action: "Renovar criativo antes que CPM force pausar campanha. Testar nova thumbnail e headline",
          });
        }
      }
    }

    // ── Pattern extraction from high-performance days ──
    const highPerfDays = recentMetrics.filter(m => (m.healthScore ?? 0) >= 70);
    const lowPerfDays  = recentMetrics.filter(m => (m.healthScore ?? 0) < 50);

    // Extract winning patterns from notes (if present)
    const winningNotes = highPerfDays.flatMap(m =>
      typeof m.notes === "string" && m.notes.length > 5 ? [m.notes] : [],
    ).slice(0, 3);

    const losingNotes = lowPerfDays.flatMap(m =>
      typeof m.notes === "string" && m.notes.length > 5 ? [m.notes] : [],
    ).slice(0, 3);

    // ── ROAS trend ──
    const roasVals = recentMetrics.map(m => Number(m.roas ?? 0)).filter(v => v > 0);
    if (roasVals.length >= 3) {
      const recentRoas = roasVals[0] ?? 0;
      const avgRoas    = roasVals.slice(0, 5).reduce((s, v) => s + v, 0) / Math.min(5, roasVals.length);
      if (recentRoas < avgRoas * 0.6 && avgRoas > 0) {
        insights.push({
          type: "hook_loser", label: "ROAS em declínio",
          metric: "roas", value: recentRoas, lift: recentRoas / avgRoas - 1,
          action: `ROAS caiu ${Math.round((1 - recentRoas / avgRoas) * 100)}% — revisar funil de conversão, não só criativo`,
        });
      }
    }

    // ── Merge into existing learnings ──
    const avgCTR = ctrs.length > 0 ? ctrs.reduce((s, v) => s + v, 0) / ctrs.length : existing.avgCTR;
    const avgCPM = cpms.length > 0 ? cpms.reduce((s, v) => s + v, 0) / cpms.length : existing.avgCPM;
    const peakCTR = ctrs.length > 0 ? Math.max(Math.max(...ctrs), existing.peakCTR) : existing.peakCTR;

    // Merge winning/losing hooks, dedup, cap at 10
    const newWinning = [...new Set([...existing.winningHooks, ...winningNotes])].slice(0, 10);
    const newLosing  = [...new Set([...existing.losingHooks,  ...losingNotes])].slice(0, 10);
    const allSignals = [...new Set([...existing.fatigueSignals, ...fatigueSignals])].slice(0, 8);

    const updated: TrafficLearnings = {
      winningHooks:         newWinning,
      losingHooks:          newLosing,
      bestPerformingAngles: extractAngles(highPerfDays, existing.bestPerformingAngles),
      avgCTR:               avgCTR,
      avgCPM:               avgCPM,
      peakCTR:              peakCTR,
      fatigueSignals:       allSignals,
      hookPerformance:      mergeHookPerformance(insights, existing.hookPerformance ?? []),
      lastUpdatedAt:        new Date().toISOString(),
    };

    if (brain) {
      await updateBrainSection(campaignId, "trafficLearnings", updated, log);
    }

    log.info({ campaignId, insights: insights.length, fatigueSignals: fatigueSignals.length, avgCTR, avgCPM }, "Traffic Feedback Loop processed");
  } catch (err) {
    log.warn({ err, campaignId }, "Traffic Feedback Loop failed — non-blocking");
  }
}

// ─── Enhanced Creative Fatigue Detection ──────────────────────────────────────
// Checks multiple signals beyond just CTR (CPM rise, social engagement drop, conversion drop)

export function analyzeCreativeFatigue(
  currentMetric: Record<string, unknown>,
  historicalMetrics: Array<Record<string, unknown>>,
): FatigueAnalysis {
  const signals: string[] = [];
  let fatigueScore = 0;

  const currentCTR  = Number(currentMetric["ctr"]  ?? 0);
  const currentCPM  = Number(currentMetric["cpm"]  ?? 0);
  const currentRoas = Number(currentMetric["roas"] ?? 0);
  const currentCR   = Number(currentMetric["conversionRate"] ?? 0);
  const currentEngage = Number(currentMetric["socialEngagements"] ?? 0);

  if (historicalMetrics.length < 2) return { isFatigued: false, signals: [], severity: "none", recommendation: "", fatigueScore: 0 };

  const peakCTR  = Math.max(...historicalMetrics.map(m => Number(m["ctr"]  ?? 0)));
  const avgCPM   = historicalMetrics.reduce((s, m) => s + Number(m["cpm"]  ?? 0), 0) / historicalMetrics.length;
  const peakRoas = Math.max(...historicalMetrics.map(m => Number(m["roas"] ?? 0)));
  const avgCR    = historicalMetrics.reduce((s, m) => s + Number(m["conversionRate"] ?? 0), 0) / historicalMetrics.length;
  const avgEngage = historicalMetrics.reduce((s, m) => s + Number(m["socialEngagements"] ?? 0), 0) / historicalMetrics.length;

  // Signal 1: CTR drop (weight: 35)
  if (peakCTR > 0.005 && currentCTR < peakCTR * 0.70) {
    const drop = Math.round((1 - currentCTR / peakCTR) * 100);
    signals.push(`CTR ${drop}% abaixo do pico`);
    fatigueScore += 35 * Math.min(1, drop / 50);
  }

  // Signal 2: CPM spike (weight: 25) — higher CPM = lower relevance score in the algorithm
  if (avgCPM > 0 && currentCPM > avgCPM * 1.35) {
    const rise = Math.round((currentCPM / avgCPM - 1) * 100);
    signals.push(`CPM ${rise}% acima da média (sinal de queda de relevância)`);
    fatigueScore += 25 * Math.min(1, rise / 60);
  }

  // Signal 3: Conversion rate drop (weight: 25)
  if (avgCR > 0 && currentCR < avgCR * 0.65) {
    signals.push(`Taxa de conversão caiu ${Math.round((1 - currentCR / avgCR) * 100)}%`);
    fatigueScore += 25 * Math.min(1, (1 - currentCR / avgCR) * 2);
  }

  // Signal 4: Social engagement drop — thumbstop/hook rate proxy (weight: 15)
  if (avgEngage > 0 && currentEngage < avgEngage * 0.5) {
    signals.push(`Engajamento social caiu ${Math.round((1 - currentEngage / avgEngage) * 100)}% (hook rate fraco)`);
    fatigueScore += 15;
  }

  const isFatigued = fatigueScore >= 30;
  const severity: FatigueAnalysis["severity"] = fatigueScore >= 60 ? "critical" : fatigueScore >= 30 ? "warning" : "none";

  const recommendation = isFatigued
    ? severity === "critical"
      ? "Pausar anúncios com baixo CTR imediatamente. Ativar criativos virgens com novo hook, thumbnail e headline. Testar nova emoção dominante e ângulo."
      : "Preparar criativos novos (novo hook e thumbnail). Testar variações antes de pausar atuais. Monitorar CPM diariamente."
    : "";

  return { isFatigued, signals, severity, recommendation, fatigueScore: Math.round(fatigueScore) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultLearnings(): TrafficLearnings {
  return { winningHooks: [], losingHooks: [], bestPerformingAngles: [], avgCTR: 0, avgCPM: 0, peakCTR: 0, fatigueSignals: [], hookPerformance: [], lastUpdatedAt: new Date().toISOString() };
}

function extractAngles(highPerfDays: Array<Record<string, unknown>>, existing: string[]): string[] {
  const newAngles = highPerfDays
    .filter(d => typeof d["notes"] === "string")
    .map(d => String(d["notes"]!).slice(0, 80))
    .filter(Boolean);
  return [...new Set([...existing, ...newAngles])].slice(0, 8);
}

function mergeHookPerformance(
  insights: TrafficInsight[],
  existing: TrafficLearnings["hookPerformance"],
): TrafficLearnings["hookPerformance"] {
  const newEntries = insights
    .filter(i => i.lift !== undefined)
    .map(i => ({ hook: i.label, ctrLift: i.lift ?? 0, angle: i.type }));
  return [...existing, ...newEntries].slice(-20);
}
