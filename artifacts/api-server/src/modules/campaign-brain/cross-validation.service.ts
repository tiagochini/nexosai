/**
 * Cross-Agent Validation — Agentes auditando agentes
 *
 * Valida se os outputs do Financial Projector, Traffic Intelligence e Offer
 * são mutuamente coerentes ANTES do lançamento. Detecta campanhas inviáveis
 * antes de gastar budget.
 *
 * Integration point:
 *  - Called: execution.routes.ts BEFORE triggerExecutionPhase (launch gate)
 *  - Returns: CrossValidationReport with blockers/warnings
 *  - Blocking: if criticalBlockers.length > 0 → returns HTTP 422
 */

import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { getCampaignBrain } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationConflict {
  rule:        string;
  description: string;
  severity:    "critical" | "warning";
  agents:      string[];
  suggestion:  string;
}

export interface CrossValidationReport {
  isViable:      boolean;
  blockers:      ValidationConflict[];
  warnings:      ValidationConflict[];
  metrics: {
    roasTarget:    number;
    roasRequired:  number;
    estimatedCPM:  number;
    ticketPrice:   number;
    budgetTraffic: number;
    cpaBreakEven:  number;
    conversionRateRequired: number;
  };
  alignmentScore: number;
  validatedAt:    string;
}

// ─── Main Validator ───────────────────────────────────────────────────────────

export async function runCrossAgentValidation(
  campaignId:  string,
  workspaceId: string,
  log:         Logger,
): Promise<CrossValidationReport> {
  const blockers: ValidationConflict[] = [];
  const warnings: ValidationConflict[] = [];

  const [campaign] = await db
    .select({
      intakeData:    campaignsTable.intakeData,
      strategyData:  campaignsTable.strategyData,
      offerData:     campaignsTable.offerData,
      targetingData: campaignsTable.targetingData,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) {
    return { isViable: true, blockers: [], warnings: [], metrics: emptyMetrics(), alignmentScore: 0, validatedAt: new Date().toISOString() };
  }

  const intake   = (campaign.intakeData   ?? {}) as Record<string, unknown>;
  const strategy = (campaign.strategyData ?? {}) as Record<string, unknown>;
  const offer    = (campaign.offerData    ?? {}) as Record<string, unknown>;
  const traffic  = (campaign.targetingData?? {}) as Record<string, unknown>;
  const brain    = await getCampaignBrain(campaignId);

  // ── Extract key metrics from agent outputs ──
  const ticketPrice    = Number(intake["product.price"] ?? 0);
  const budgetTraffic  = Number(intake["campaign.budget.traffic"] ?? 0);
  const revenueTarget  = Number(intake["campaign.revenueTarget"] ?? 0);
  const roasTarget     = revenueTarget > 0 && budgetTraffic > 0 ? revenueTarget / budgetTraffic : 0;

  // Financial projector ROAS target (from strategyData)
  const projectedRoas  = Number((strategy as any)?.projections?.roasTarget ?? (strategy as any)?.financialProjection?.roasTarget ?? roasTarget);

  // Traffic estimated CPM (from targetingData / trafficPlan)
  const trafficPlan    = (traffic as any)?.trafficPlan ?? traffic;
  const estimatedCPM   = Number((trafficPlan as any)?.campaignStructure?.platforms?.[0]?.estimatedCPM
    ?? (trafficPlan as any)?.estimatedCPM ?? 15); // R$15 default

  // Derived metrics
  const cpaBreakEven             = ticketPrice > 0 ? ticketPrice * 0.3 : 0; // assuming 30% margin floor
  const roasRequired             = budgetTraffic > 0 && ticketPrice > 0 ? 1 / (ticketPrice / Math.max(1, budgetTraffic / 100)) : 1;
  const conversionRateRequired   = budgetTraffic > 0 && ticketPrice > 0 && estimatedCPM > 0
    ? (budgetTraffic / Math.max(1, ticketPrice)) / Math.max(1, (budgetTraffic / (estimatedCPM / 1000)) * 0.02)
    : 0;

  // ── Rule 1: ROAS viability ──
  if (projectedRoas > 0 && estimatedCPM > 0 && ticketPrice > 0) {
    const maxAchievableRoas = (ticketPrice / (estimatedCPM / 1000)) * 0.02; // assuming 2% CR
    if (maxAchievableRoas < projectedRoas * 0.5) {
      blockers.push({
        rule: "ROAS_UNREACHABLE",
        description: `Financial Projector exige ROAS ${projectedRoas.toFixed(1)}x mas CPM estimado de R$${estimatedCPM} torna isso matematicamente inviável com CR típico`,
        severity: "critical",
        agents: ["financial_projector", "media_buyer"],
        suggestion: `Reduza meta de receita para R$${Math.round(revenueTarget * 0.5).toLocaleString("pt-BR")}, aumente orçamento de tráfego, ou mude canal para CPM menor`,
      });
    } else if (maxAchievableRoas < projectedRoas * 0.7) {
      warnings.push({
        rule: "ROAS_TIGHT",
        description: `ROAS ${projectedRoas.toFixed(1)}x é apertado dado CPM de R$${estimatedCPM} — exige criativo de alta performance`,
        severity: "warning",
        agents: ["financial_projector", "media_buyer", "creative_director"],
        suggestion: "Prepare variações de criativo agressivas. Monitore CPM real nos primeiros 3 dias e ajuste meta se necessário",
      });
    }
  }

  // ── Rule 2: Ticket vs Budget ratio ──
  if (ticketPrice > 0 && budgetTraffic > 0) {
    const salesNeeded = revenueTarget / ticketPrice;
    const impliedCPA  = budgetTraffic / salesNeeded;
    if (impliedCPA > ticketPrice * 0.5) {
      blockers.push({
        rule: "CPA_UNSUSTAINABLE",
        description: `CPA implícito de R$${impliedCPA.toFixed(0)} é ${Math.round(impliedCPA / ticketPrice * 100)}% do ticket — margem negativa`,
        severity: "critical",
        agents: ["financial_projector", "offer"],
        suggestion: `Aumente ticket acima de R$${Math.round(impliedCPA * 3).toLocaleString("pt-BR")}, crie order bump/upsell, ou reduza meta para R$${Math.round(budgetTraffic * 3).toLocaleString("pt-BR")}`,
      });
    } else if (impliedCPA > ticketPrice * 0.3) {
      warnings.push({
        rule: "CPA_TIGHT_MARGIN",
        description: `CPA de R$${impliedCPA.toFixed(0)} comprimi margem abaixo de 70% — sem espaço para imprevistos`,
        severity: "warning",
        agents: ["financial_projector"],
        suggestion: "Adicione order bump ou downsell para aumentar LTV médio e melhorar CPA efetivo",
      });
    }
  }

  // ── Rule 3: Budget sufficiency ──
  if (budgetTraffic > 0 && estimatedCPM > 0) {
    const estimatedReach = (budgetTraffic / (estimatedCPM / 1000));
    const salesNeeded    = revenueTarget > 0 ? revenueTarget / Math.max(1, ticketPrice) : 0;
    const minReach       = salesNeeded * 50; // 2% CR → need 50x leads
    if (estimatedReach < minReach * 0.5) {
      warnings.push({
        rule: "BUDGET_INSUFFICIENT_REACH",
        description: `Budget de R$${budgetTraffic.toLocaleString("pt-BR")} pode atingir ${Math.round(estimatedReach).toLocaleString("pt-BR")} pessoas — abaixo dos ${Math.round(minReach).toLocaleString("pt-BR")} necessários para meta`,
        severity: "warning",
        agents: ["financial_projector", "media_buyer"],
        suggestion: "Considere aumentar budget de tráfego, focar em audiências mais quentes, ou reduzir meta de receita",
      });
    }
  }

  // ── Rule 4: Alignment score check ──
  const alignmentScore = brain?.alignment?.score ?? 0;
  const criticalConflicts = brain?.alignment?.criticalConflicts ?? [];
  if (brain && alignmentScore < 50 && criticalConflicts.length > 0) {
    blockers.push({
      rule: "CRITICAL_MISALIGNMENT",
      description: `Alignment score ${alignmentScore}/100 com ${criticalConflicts.length} conflito(s) crítico(s) entre agentes`,
      severity: "critical",
      agents: ["strategy", "offer", "copywriter", "creative_director"],
      suggestion: `Resolver conflitos antes de lançar: ${criticalConflicts.slice(0, 2).join("; ")}`,
    });
  } else if (brain && alignmentScore < 70) {
    warnings.push({
      rule: "ALIGNMENT_SUBOPTIMAL",
      description: `Alignment score ${alignmentScore}/100 — agentes podem estar dando mensagens levemente inconsistentes`,
      severity: "warning",
      agents: ["strategy", "copywriter"],
      suggestion: "Revisar tom e emoção dominante na sequência de lançamento",
    });
  }

  // ── Rule 5: Contradiction check ──
  const criticalContradictions = brain?.contradictions?.filter(c => c.severity === "critical") ?? [];
  for (const contradiction of criticalContradictions) {
    blockers.push({
      rule: `CONTRADICTION_${contradiction.type.toUpperCase()}`,
      description: contradiction.description,
      severity: "critical",
      agents: contradiction.agents,
      suggestion: `Resolver contradição de ${contradiction.type} antes de lançar`,
    });
  }

  const isViable = blockers.length === 0;
  const report: CrossValidationReport = {
    isViable,
    blockers,
    warnings,
    metrics: { roasTarget: projectedRoas, roasRequired, estimatedCPM, ticketPrice, budgetTraffic, cpaBreakEven, conversionRateRequired },
    alignmentScore,
    validatedAt: new Date().toISOString(),
  };

  log.info({
    campaignId, isViable, blockers: blockers.length, warnings: warnings.length, alignmentScore,
  }, "Cross-Agent Validation completed");

  return report;
}

function emptyMetrics() {
  return { roasTarget: 0, roasRequired: 0, estimatedCPM: 0, ticketPrice: 0, budgetTraffic: 0, cpaBreakEven: 0, conversionRateRequired: 0 };
}
