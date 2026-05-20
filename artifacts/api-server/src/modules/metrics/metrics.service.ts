import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import {
  db,
  campaignsTable,
  campaignMetricsTable,
  campaignAlertsTable,
  auditLogsTable,
  type IngestMetricsInput,
} from "@workspace/db";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { runOptimizationAgent } from "../agents/optimization.agent.js";
import { processTrafficFeedback, analyzeCreativeFatigue } from "../campaign-brain/traffic-feedback.service.js";
import type { Logger } from "pino";

// ── Constants ────────────────────────────────────────────────────────────────

const HEALTH_THRESHOLDS = {
  warning: 55,
  critical: 35,
  autoOptimize: 30,
} as const;

const ALERT_THRESHOLDS = {
  roasDropPercent: 0.5,         // ROAS below 50% of target
  cplSpikeMultiplier: 2.5,      // CPL above 2.5x benchmark
  revenueGapWarning: 0.35,      // Revenue 35% below projection
  revenueGapCritical: 0.6,      // Revenue 60% below projection
  emailOpenRateMin: 0.15,       // Open rate below 15%
  emailClickRateMin: 0.02,      // Click rate below 2%
} as const;

// ── Health score calculation ──────────────────────────────────────────────────

interface HealthComponents {
  revenue: number;    // 0-35
  roas: number;       // 0-25
  cpl: number;        // 0-20
  email: number;      // 0-10
  trend: number;      // 0-10
}

export interface HealthScoreResult {
  score: number;
  components: HealthComponents;
  grade: "A" | "B" | "C" | "D" | "F";
  status: "healthy" | "warning" | "critical";
  summary: string;
}

function calculateHealthScore(
  metric: IngestMetricsInput,
  projectedRevenue: number,
  targetRoas: number,
  benchmarkCpl: number,
  previousScore: number | null,
): HealthScoreResult {
  const components: HealthComponents = {
    revenue: 0,
    roas: 0,
    cpl: 0,
    email: 0,
    trend: 0,
  };

  // Revenue vs projection (35 pts)
  if (projectedRevenue > 0 && (metric.revenueBrl ?? 0) >= 0) {
    const ratio = (metric.revenueBrl ?? 0) / projectedRevenue;
    components.revenue = Math.min(35, Math.round(ratio * 35));
  } else if (projectedRevenue === 0) {
    components.revenue = 20; // neutral when no projection
  }

  // ROAS vs target (25 pts)
  if (targetRoas > 0 && metric.roas != null) {
    const ratio = metric.roas / targetRoas;
    components.roas = Math.min(25, Math.round(ratio * 25));
  } else if (metric.roas == null) {
    components.roas = 12; // neutral when no roas data yet
  }

  // CPL vs benchmark (20 pts) — lower is better
  if (benchmarkCpl > 0 && metric.cplBrl != null) {
    const ratio = benchmarkCpl / metric.cplBrl; // inverted — CPL below benchmark = ratio > 1
    components.cpl = Math.min(20, Math.round(Math.max(0, ratio) * 20));
  } else if (metric.cplBrl == null) {
    components.cpl = 10; // neutral
  }

  // Email engagement (10 pts)
  if (metric.openRate != null) {
    const openScore = Math.min(1, metric.openRate / 0.25) * 7; // 25% = full score
    const clickScore = metric.clickRate != null
      ? Math.min(1, metric.clickRate / 0.04) * 3
      : 1.5;
    components.email = Math.round(openScore + clickScore);
  } else {
    components.email = 5; // neutral when no email data
  }

  // Trend (10 pts) — is performance improving?
  if (previousScore != null) {
    const currentRaw = components.revenue + components.roas + components.cpl + components.email;
    const prevRaw = previousScore * 0.9; // scale previous to 90 max for comparison
    components.trend = currentRaw >= prevRaw ? 10 : Math.max(0, Math.round(10 - (prevRaw - currentRaw) / 5));
  } else {
    components.trend = 5; // neutral on first day
  }

  const score = Math.min(100, Math.max(0,
    components.revenue + components.roas + components.cpl + components.email + components.trend,
  ));

  const grade: "A" | "B" | "C" | "D" | "F" =
    score >= 85 ? "A" :
    score >= 70 ? "B" :
    score >= 55 ? "C" :
    score >= 35 ? "D" : "F";

  const status: "healthy" | "warning" | "critical" =
    score >= HEALTH_THRESHOLDS.warning ? "healthy" :
    score >= HEALTH_THRESHOLDS.critical ? "warning" : "critical";

  const summary =
    score >= 85 ? "Campanha performando acima das expectativas" :
    score >= 70 ? "Campanha dentro do esperado — monitoramento normal" :
    score >= 55 ? "Atenção: alguns indicadores abaixo do ideal" :
    score >= 35 ? "Alerta: performance comprometida — ação necessária" :
    "Crítico: campanha em risco — intervenção imediata";

  return { score, components, grade, status, summary };
}

// ── Alert generation ──────────────────────────────────────────────────────────

interface AlertCandidate {
  alertType: "kpi_breach" | "budget_exhausted" | "low_health" | "optimization_triggered" | "phase_behind" | "revenue_gap" | "email_engagement_drop" | "cpl_spike" | "roas_drop" | "custom";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
  metricKey: string;
  metricValue: number;
  thresholdValue: number;
}

function generateAlertCandidates(
  metric: IngestMetricsInput,
  health: HealthScoreResult,
  projectedRevenue: number,
  targetRoas: number,
  benchmarkCpl: number,
  historicalPeakCtr: number = 0,
  historicalMetrics: Array<Record<string, unknown>> = [],
): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];

  // Health-based alerts
  if (health.score < HEALTH_THRESHOLDS.critical) {
    alerts.push({
      alertType: "low_health",
      severity: "critical",
      title: `Health Score crítico: ${health.score}/100`,
      description: `O índice de saúde da campanha caiu para ${health.score}/100 (Grade ${health.grade}). ${health.summary}`,
      recommendation: "Execute o Agente de Otimização imediatamente e revise os públicos com CPL acima do benchmark.",
      metricKey: "health_score",
      metricValue: health.score,
      thresholdValue: HEALTH_THRESHOLDS.critical,
    });
  } else if (health.score < HEALTH_THRESHOLDS.warning) {
    alerts.push({
      alertType: "low_health",
      severity: "warning",
      title: `Health Score em atenção: ${health.score}/100`,
      description: `O índice de saúde da campanha está em ${health.score}/100 (Grade ${health.grade}). Monitoramento reforçado necessário.`,
      recommendation: "Revise as métricas de email e CPL. Considere pausar públicos de baixa performance.",
      metricKey: "health_score",
      metricValue: health.score,
      thresholdValue: HEALTH_THRESHOLDS.warning,
    });
  }

  // ROAS drop
  if (targetRoas > 0 && metric.roas != null && metric.roas < targetRoas * ALERT_THRESHOLDS.roasDropPercent) {
    alerts.push({
      alertType: "roas_drop",
      severity: "critical",
      title: `ROAS crítico: ${metric.roas.toFixed(1)}x (meta: ${targetRoas}x)`,
      description: `O ROAS atual de ${metric.roas.toFixed(1)}x está abaixo de 50% da meta de ${targetRoas}x. Cada R$1 investido está gerando R$${metric.roas.toFixed(2)}.`,
      recommendation: "Pause imediatamente anúncios com ROAS abaixo de 2x. Concentre budget nos públicos lookalike 1% e nos criativos vencedores.",
      metricKey: "roas",
      metricValue: Number(metric.roas),
      thresholdValue: targetRoas * ALERT_THRESHOLDS.roasDropPercent,
    });
  }

  // CPL spike
  if (benchmarkCpl > 0 && metric.cplBrl != null && metric.cplBrl > benchmarkCpl * ALERT_THRESHOLDS.cplSpikeMultiplier) {
    alerts.push({
      alertType: "cpl_spike",
      severity: "critical",
      title: `CPL ${((metric.cplBrl / benchmarkCpl)).toFixed(1)}x acima do benchmark`,
      description: `CPL atual de R$${Number(metric.cplBrl).toFixed(2)} está ${((metric.cplBrl / benchmarkCpl - 1) * 100).toFixed(0)}% acima do benchmark de R$${benchmarkCpl.toFixed(2)}.`,
      recommendation: "Pause públicos com CPL acima de 3x o benchmark. Teste novos criativos com abordagem de problema diferente.",
      metricKey: "cpl_brl",
      metricValue: Number(metric.cplBrl),
      thresholdValue: benchmarkCpl * ALERT_THRESHOLDS.cplSpikeMultiplier,
    });
  }

  // Revenue gap
  if (projectedRevenue > 0 && (metric.revenueBrl ?? 0) >= 0) {
    const gap = 1 - (metric.revenueBrl ?? 0) / projectedRevenue;
    if (gap >= ALERT_THRESHOLDS.revenueGapCritical) {
      alerts.push({
        alertType: "revenue_gap",
        severity: "critical",
        title: `Faturamento ${(gap * 100).toFixed(0)}% abaixo da projeção`,
        description: `Faturamento atual de R$${Number(metric.revenueBrl ?? 0).toFixed(2)} está ${(gap * 100).toFixed(0)}% abaixo da projeção de R$${projectedRevenue.toFixed(2)} para este dia.`,
        recommendation: "Ative sequência de urgência antecipada. Considere oferta de bump ou bônus adicional para aumentar conversão. Execute análise de otimização.",
        metricKey: "revenue_brl",
        metricValue: Number(metric.revenueBrl ?? 0),
        thresholdValue: projectedRevenue * (1 - ALERT_THRESHOLDS.revenueGapCritical),
      });
    } else if (gap >= ALERT_THRESHOLDS.revenueGapWarning) {
      alerts.push({
        alertType: "revenue_gap",
        severity: "warning",
        title: `Faturamento ${(gap * 100).toFixed(0)}% abaixo do esperado`,
        description: `Faturamento de R$${Number(metric.revenueBrl ?? 0).toFixed(2)} está abaixo da projeção de R$${projectedRevenue.toFixed(2)}.`,
        recommendation: "Reforce sequência de e-mail e WhatsApp com prova social adicional. Revise copy do carrinho.",
        metricKey: "revenue_brl",
        metricValue: Number(metric.revenueBrl ?? 0),
        thresholdValue: projectedRevenue * (1 - ALERT_THRESHOLDS.revenueGapWarning),
      });
    }
  }

  // Email engagement drop
  if (metric.openRate != null && metric.openRate < ALERT_THRESHOLDS.emailOpenRateMin && (metric.emailsSent ?? 0) > 100) {
    alerts.push({
      alertType: "email_engagement_drop",
      severity: "warning",
      title: `Taxa de abertura de e-mail baixa: ${(metric.openRate * 100).toFixed(1)}%`,
      description: `Taxa de abertura de ${(metric.openRate * 100).toFixed(1)}% está abaixo do mínimo de 15%. E-mails podem estar caindo em spam.`,
      recommendation: "Verifique autenticação SPF/DKIM/DMARC. Teste assuntos com personalização por nome. Considere higienização da lista.",
      metricKey: "open_rate",
      metricValue: metric.openRate,
      thresholdValue: ALERT_THRESHOLDS.emailOpenRateMin,
    });
  }

  // ── Enhanced creative fatigue detection (multi-signal) ────────────────────
  // Checks CTR drop, CPM spike, conversion rate drop, social engagement drop.
  // Uses historicalMetrics passed from ingestMetrics (has ctr + any extra fields present).
  const currentMetricObj = metric as Record<string, unknown>;
  const fatigue = analyzeCreativeFatigue(currentMetricObj, historicalMetrics);

  if (fatigue.isFatigued) {
    alerts.push({
      alertType: "kpi_breach",
      severity: fatigue.severity === "critical" ? "critical" : "warning",
      title: `Fadiga criativa detectada (score ${fatigue.fatigueScore}/100): ${fatigue.signals[0] ?? "múltiplos sinais"}`,
      description: `${fatigue.signals.join(" • ")}. Criativos perderam impacto em múltiplas dimensões.`,
      recommendation: fatigue.recommendation,
      metricKey: "ctr",
      metricValue: Number(metric.ctr ?? 0),
      thresholdValue: historicalPeakCtr * 0.70,
    });
  } else if (
    // Fallback: single-signal CTR check (backward compat for low-data scenarios)
    historicalPeakCtr > 0.005 &&
    metric.ctr != null &&
    Number(metric.ctr) < historicalPeakCtr * 0.70 &&
    historicalMetrics.length < 2
  ) {
    const dropPct = Math.round((1 - Number(metric.ctr) / historicalPeakCtr) * 100);
    alerts.push({
      alertType: "kpi_breach",
      severity: dropPct >= 50 ? "critical" : "warning",
      title: `Fadiga criativa detectada: CTR caiu ${dropPct}% do pico`,
      description: `CTR atual de ${(Number(metric.ctr) * 100).toFixed(2)}% está ${dropPct}% abaixo do pico histórico de ${(historicalPeakCtr * 100).toFixed(2)}%.`,
      recommendation: "Renove criativos com novos ângulos e gatilhos diferentes.",
      metricKey: "ctr",
      metricValue: Number(metric.ctr),
      thresholdValue: historicalPeakCtr * 0.70,
    });
  }

  return alerts;
}

// ── Main service functions ────────────────────────────────────────────────────

export async function ingestMetrics(
  campaignId: string,
  workspaceId: string,
  input: IngestMetricsInput,
  log: Logger,
) {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const ingestableStatuses = ["approved", "generating", "executing", "live", "paused", "completed"];
  if (!ingestableStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Cannot ingest metrics for campaign in status "${campaign.status}". Campaign must be approved or launched first.`,
    );
  }

  // Pull context from campaign data for health calculation
  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const financialData = (campaign.strategyData ?? {}) as Record<string, unknown>;
  const profileData = (campaign.audienceData ?? {}) as Record<string, unknown>;

  const targetRoas = Number(
    (financialData as any)?.projections?.roasTarget ??
    (Number(intakeData["campaign.revenueTarget"] ?? 0) / Math.max(1, Number(intakeData["campaign.budget.traffic"] ?? 1)))
  );
  const benchmarkCpl = Number((profileData as any)?.marketIntelligence?.averageCPL ?? 10);

  // Get daily projected revenue from financial projector
  const totalRevenue = Number(intakeData["campaign.revenueTarget"] ?? 0);
  const totalDays = Number(intakeData["campaign.durationDays"] ?? 21);
  const cartOpenDay = Number(intakeData["campaign.cartOpenDay"] ?? Math.ceil(totalDays * 0.6));
  const projectedRevenue = input.dayIndex >= cartOpenDay
    ? totalRevenue / Math.max(1, totalDays - cartOpenDay)
    : 0;

  // Get previous day's health score for trend calculation
  const [prevMetric] = await db
    .select({ healthScore: campaignMetricsTable.healthScore, ctr: campaignMetricsTable.ctr })
    .from(campaignMetricsTable)
    .where(and(
      eq(campaignMetricsTable.campaignId, campaignId),
      lte(campaignMetricsTable.dayIndex, input.dayIndex - 1),
    ))
    .orderBy(desc(campaignMetricsTable.dayIndex))
    .limit(1);

  // Peak CTR across all historical metrics (for creative fatigue detection)
  const historicalCtrRows = await db
    .select({ ctr: campaignMetricsTable.ctr })
    .from(campaignMetricsTable)
    .where(and(
      eq(campaignMetricsTable.campaignId, campaignId),
      lte(campaignMetricsTable.dayIndex, input.dayIndex - 1),
    ));
  const historicalPeakCtr = historicalCtrRows.reduce((max, row) => {
    const c = row.ctr != null ? Number(row.ctr) : 0;
    return c > max ? c : max;
  }, 0);

  // Calculate health score
  const health = calculateHealthScore(
    input,
    projectedRevenue,
    targetRoas,
    benchmarkCpl,
    prevMetric?.healthScore ?? null,
  );

  const revenueGapPercent = projectedRevenue > 0
    ? ((projectedRevenue - (input.revenueBrl ?? 0)) / projectedRevenue)
    : 0;

  // Upsert metric (update if same date already exists)
  const [existing] = await db
    .select({ id: campaignMetricsTable.id })
    .from(campaignMetricsTable)
    .where(and(
      eq(campaignMetricsTable.campaignId, campaignId),
      eq(campaignMetricsTable.metricDate, input.metricDate),
    ))
    .limit(1);

  let metric;
  if (existing) {
    [metric] = await db
      .update(campaignMetricsTable)
      .set({
        ...buildMetricRow(input),
        healthScore: health.score,
        projectedRevenueBrl: projectedRevenue.toFixed(2),
        revenueGapPercent: revenueGapPercent.toFixed(4),
      })
      .where(eq(campaignMetricsTable.id, existing.id))
      .returning();
  } else {
    [metric] = await db
      .insert(campaignMetricsTable)
      .values({
        campaignId,
        workspaceId,
        ...buildMetricRow(input),
        healthScore: health.score,
        projectedRevenueBrl: projectedRevenue.toFixed(2),
        revenueGapPercent: revenueGapPercent.toFixed(4),
      })
      .returning();
  }

  // Emit real-time health update
  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: `Dia ${input.dayIndex} — Health: ${health.score}/100 (${health.grade}) | Receita: R$${Number(input.revenueBrl ?? 0).toFixed(0)} | ${health.summary}`,
    data: {
      dayIndex: input.dayIndex,
      health,
      revenue: input.revenueBrl ?? 0,
      projectedRevenue,
      roas: input.roas,
      cpl: input.cplBrl,
      leads: input.leads ?? 0,
      sales: input.sales ?? 0,
    },
    timestamp: new Date().toISOString(),
  });

  // Generate and save alerts
  const alertCandidates = generateAlertCandidates(
    input,
    health,
    projectedRevenue,
    targetRoas,
    benchmarkCpl,
    historicalPeakCtr,
    historicalCtrRows as Array<Record<string, unknown>>,
  );

  const savedAlerts = [];
  for (const candidate of alertCandidates) {
    const [alert] = await db
      .insert(campaignAlertsTable)
      .values({
        campaignId,
        workspaceId,
        ...candidate,
        metricValue: candidate.metricValue.toString(),
        thresholdValue: candidate.thresholdValue.toString(),
      })
      .returning();

    savedAlerts.push(alert);

    // Push alert via WebSocket
    emitCampaignEvent({
      campaignId,
      type: candidate.severity === "critical" ? "agent_failed" : "checkpoint_created",
      agentType: candidate.alertType,
      message: `[${candidate.severity.toUpperCase()}] ${candidate.title}`,
      data: {
        alertId: alert?.id,
        severity: candidate.severity,
        recommendation: candidate.recommendation,
      },
      timestamp: new Date().toISOString(),
    });

    log.warn(
      { campaignId, alertType: candidate.alertType, severity: candidate.severity, score: health.score },
      `Campaign alert: ${candidate.title}`,
    );
  }

  // Auto-trigger optimization agent if health is critical
  let autoOptimizationTriggered = false;
  if (health.score <= HEALTH_THRESHOLDS.autoOptimize) {
    log.info({ campaignId, healthScore: health.score }, "Health critical — auto-triggering optimization agent");

    // Mark auto-trigger alert
    await db
      .insert(campaignAlertsTable)
      .values({
        campaignId,
        workspaceId,
        alertType: "optimization_triggered",
        severity: "info",
        title: "Agente de Otimização ativado automaticamente",
        description: `Health score de ${health.score}/100 ativou o agente de otimização automático.`,
        recommendation: "Aguarde o relatório de otimização e aplique as recomendações prioritárias.",
        metricKey: "health_score",
        metricValue: health.score.toString(),
        thresholdValue: HEALTH_THRESHOLDS.autoOptimize.toString(),
        autoActionTaken: "optimization_agent_triggered",
      });

    // Run optimization async (don't await — returns immediately)
    const currentMetrics = {
      dayIndex: input.dayIndex,
      revenueBrl: input.revenueBrl ?? 0,
      projectedRevenue,
      roas: input.roas,
      cplBrl: input.cplBrl,
      ctr: input.ctr,
      leads: input.leads ?? 0,
      sales: input.sales ?? 0,
      openRate: input.openRate,
      healthScore: health.score,
      healthGrade: health.grade,
      healthComponents: health.components,
    };

    runOptimizationAgent(campaignId, workspaceId, intakeData, currentMetrics, log)
      .then(async (output) => {
        const [piece] = await db
          .insert(
            (await import("@workspace/db")).contentPiecesTable,
          )
          .values({
            campaignId,
            workspaceId,
            type: "optimization_report",
            status: "draft",
            title: `Otimização Automática Dia ${input.dayIndex} — Score ${output.overallHealthScore}/100`,
            content: output as any,
            aiProvider: "google",
            creditsUsed: 35,
          })
          .returning();

        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "optimization",
          message: `Otimização automática concluída — ${output.recommendations.length} recomendações geradas`,
          data: { pieceId: piece?.id, criticalActions: output.recommendations.filter((r) => r.priority === "critical").length },
          timestamp: new Date().toISOString(),
        });
      })
      .catch((err) => {
        log.error({ err, campaignId }, "Auto-optimization agent failed");
      });

    autoOptimizationTriggered = true;
  }

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "metrics.ingested",
    actor: "system",
    data: {
      dayIndex: input.dayIndex,
      healthScore: health.score,
      healthGrade: health.grade,
      alertsGenerated: alertCandidates.length,
      autoOptimizationTriggered,
    },
  });

  // Traffic Feedback Loop — fire-and-forget — updates Campaign Brain with live traffic learnings
  setImmediate(() => {
    processTrafficFeedback(campaignId, workspaceId, metric as Record<string, unknown>, log)
      .catch((err: unknown) => {
        log.warn({ err, campaignId }, "Traffic Feedback Loop failed — non-blocking");
      });
  });

  return {
    metric,
    health,
    alertsGenerated: savedAlerts.length,
    autoOptimizationTriggered,
  };
}

function buildMetricRow(input: IngestMetricsInput) {
  return {
    metricDate: input.metricDate,
    dayIndex: input.dayIndex,
    phase: input.phase,
    clicks: input.clicks ?? 0,
    impressions: input.impressions ?? 0,
    spendBrl: input.spendBrl != null ? input.spendBrl.toFixed(2) : "0",
    cplBrl: input.cplBrl != null ? input.cplBrl.toFixed(2) : null,
    ctr: input.ctr != null ? input.ctr.toFixed(4) : null,
    leads: input.leads ?? 0,
    sales: input.sales ?? 0,
    revenueBrl: input.revenueBrl != null ? input.revenueBrl.toFixed(2) : "0",
    roas: input.roas != null ? input.roas.toFixed(4) : null,
    conversionRate: input.conversionRate != null ? input.conversionRate.toFixed(4) : null,
    emailsSent: input.emailsSent ?? 0,
    emailOpens: input.emailOpens ?? 0,
    emailClicks: input.emailClicks ?? 0,
    openRate: input.openRate != null ? input.openRate.toFixed(4) : null,
    clickRate: input.clickRate != null ? input.clickRate.toFixed(4) : null,
    socialReach: input.socialReach ?? 0,
    socialEngagements: input.socialEngagements ?? 0,
    notes: input.notes,
  };
}

// ── Query functions ───────────────────────────────────────────────────────────

export async function getMetricsSummary(campaignId: string, workspaceId: string) {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const allMetrics = await db
    .select()
    .from(campaignMetricsTable)
    .where(eq(campaignMetricsTable.campaignId, campaignId))
    .orderBy(asc(campaignMetricsTable.dayIndex));

  if (allMetrics.length === 0) {
    return {
      campaignId,
      daysTracked: 0,
      totalRevenue: 0,
      totalSpend: 0,
      totalLeads: 0,
      totalSales: 0,
      totalRoas: 0,
      averageHealthScore: null,
      latestHealthScore: null,
      latestGrade: null,
      metrics: [],
    };
  }

  const latest = allMetrics[allMetrics.length - 1]!;
  const totalRevenue = allMetrics.reduce((s, m) => s + Number(m.revenueBrl ?? 0), 0);
  const totalSpend = allMetrics.reduce((s, m) => s + Number(m.spendBrl ?? 0), 0);
  const totalLeads = allMetrics.reduce((s, m) => s + (m.leads ?? 0), 0);
  const totalSales = allMetrics.reduce((s, m) => s + (m.sales ?? 0), 0);
  const avgHealth = Math.round(
    allMetrics.reduce((s, m) => s + (m.healthScore ?? 0), 0) / allMetrics.length,
  );
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const latestGrade: "A" | "B" | "C" | "D" | "F" =
    (latest.healthScore ?? 0) >= 85 ? "A" :
    (latest.healthScore ?? 0) >= 70 ? "B" :
    (latest.healthScore ?? 0) >= 55 ? "C" :
    (latest.healthScore ?? 0) >= 35 ? "D" : "F";

  return {
    campaignId,
    daysTracked: allMetrics.length,
    totalRevenue,
    totalSpend,
    totalLeads,
    totalSales,
    totalRoas: Number(totalRoas.toFixed(2)),
    averageHealthScore: avgHealth,
    latestHealthScore: latest.healthScore,
    latestGrade,
    metrics: allMetrics,
  };
}

export async function getMetricsHistory(
  campaignId: string,
  workspaceId: string,
  fromDay?: number,
  toDay?: number,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const conditions = [eq(campaignMetricsTable.campaignId, campaignId)];
  if (fromDay != null) conditions.push(gte(campaignMetricsTable.dayIndex, fromDay));
  if (toDay != null) conditions.push(lte(campaignMetricsTable.dayIndex, toDay));

  const metrics = await db
    .select()
    .from(campaignMetricsTable)
    .where(and(...conditions))
    .orderBy(asc(campaignMetricsTable.dayIndex));

  return { metrics, total: metrics.length };
}

export async function getCampaignAlerts(
  campaignId: string,
  workspaceId: string,
  onlyUnacknowledged = false,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const conditions = [eq(campaignAlertsTable.campaignId, campaignId)];
  if (onlyUnacknowledged) {
    conditions.push(eq(campaignAlertsTable.isAcknowledged, false));
  }

  const alerts = await db
    .select()
    .from(campaignAlertsTable)
    .where(and(...conditions))
    .orderBy(desc(campaignAlertsTable.createdAt));

  return { alerts, total: alerts.length };
}

export async function acknowledgeAlert(
  campaignId: string,
  workspaceId: string,
  alertId: string,
  acknowledgedBy: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const [alert] = await db
    .update(campaignAlertsTable)
    .set({
      isAcknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy,
    })
    .where(and(
      eq(campaignAlertsTable.id, alertId),
      eq(campaignAlertsTable.campaignId, campaignId),
    ))
    .returning();

  if (!alert) throw new NotFoundError("Alert");

  return alert;
}
