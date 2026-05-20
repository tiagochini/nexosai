/**
 * Decision Weighting — Camada 8: Métricas com pesos por contexto
 *
 * "Nem toda métrica importa igual."
 *
 * Uma campanha premium de R$10k não deve ser julgada pelos mesmos pesos
 * que um produto low-ticket de R$97. ROAS no dia 1 de aquecimento não
 * significa o mesmo que ROAS no dia 7 de carrinho aberto.
 *
 * Este serviço produz um WeightProfile que torna o health score sensível
 * ao contexto: posicionamento, fase, tipo de campanha, awareness.
 *
 * Integration points:
 *  - metrics.service.ts → calculateHealthScore(metric, ..., weights)
 *  - cross-validation.service.ts → adjust alert thresholds by context
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeightProfile {
  revenue:  number; // max pts: revenue vs daily projection
  roas:     number; // max pts: ROAS vs target
  cpl:      number; // max pts: CPL efficiency
  email:    number; // max pts: email engagement
  trend:    number; // max pts: trend direction
  // sum MUST equal 100
}

export interface AlertThresholdProfile {
  roasDropPercent:      number; // fraction of target to trigger critical alert (default 0.5)
  cplSpikeMultiplier:   number; // multiples of benchmark to trigger alert (default 2.5)
  revenueGapWarning:    number; // fraction below projection to warn (default 0.3)
  emailOpenRateMin:     number; // minimum open rate before alerting (default 0.15)
  ctrFatigueThreshold:  number; // fraction of peak CTR that triggers fatigue (default 0.70)
  minPeakCtrForFatigue: number; // minimum peak CTR before fatigue detection (default 0.005)
}

export interface DecisionContext {
  positioning:    "premium" | "mid-market" | "accessible" | "commodity";
  campaignType:   string;
  currentPhase:   string | null;
  dayIndex:       number;
  totalDays:      number;
  awarenessScore: number;   // 0-4 (Schwartz)
  revenueTarget:  number;   // R$
  ticketPrice:    number;   // R$
  isPreCart:      boolean;  // true = warmup/pre-launch
}

// ─── Default profiles ─────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: WeightProfile = {
  revenue: 35,
  roas:    25,
  cpl:     20,
  email:   10,
  trend:   10,
};

export const DEFAULT_THRESHOLDS: AlertThresholdProfile = {
  roasDropPercent:      0.5,
  cplSpikeMultiplier:   2.5,
  revenueGapWarning:    0.3,
  emailOpenRateMin:     0.15,
  ctrFatigueThreshold:  0.70,
  minPeakCtrForFatigue: 0.005,
};

// ─── Weight Profiles by Positioning ──────────────────────────────────────────

const PREMIUM_WEIGHTS: WeightProfile = {
  // Premium: perception > scale. Revenue builds slowly. Email nurturing critical.
  // CTR/CPL less important than quality signals. Trend matters a lot.
  revenue: 25,  // Lighter — premium launches build slowly
  roas:    20,  // Less critical — margin > scale for premium
  cpl:     15,  // Lead quality > volume
  email:   25,  // High-touch nurturing is the main conversion path
  trend:   15,  // Trend direction matters more — premium is narrative momentum
};

const MID_MARKET_WEIGHTS: WeightProfile = {
  revenue: 30,
  roas:    25,
  cpl:     20,
  email:   15,
  trend:   10,
};

const ACCESSIBLE_WEIGHTS: WeightProfile = DEFAULT_WEIGHTS; // standard

const COMMODITY_WEIGHTS: WeightProfile = {
  // Commodity/low-ticket: volume and efficiency dominate
  revenue: 40,
  roas:    30,
  cpl:     20,
  email:   5,
  trend:   5,
};

// ─── Phase Modifiers ──────────────────────────────────────────────────────────

function applyPhaseModifier(weights: WeightProfile, ctx: DecisionContext): WeightProfile {
  if (ctx.isPreCart) {
    // Pre-cart / warmup: revenue is 0 (expected). Shift weight to email + trend.
    // Revenue weight is redistributed to engagement signals.
    const revenueBonus = Math.round(weights.revenue * 0.6);
    return {
      revenue: Math.round(weights.revenue * 0.4), // drastically reduce revenue weight
      roas:    Math.round(weights.roas    * 0.6), // ROAS irrelevant pre-cart
      cpl:     Math.min(30, weights.cpl + Math.round(revenueBonus * 0.5)),
      email:   Math.min(30, weights.email + Math.round(revenueBonus * 0.5)),
      trend:   weights.trend,
    };
  }

  const phase = ctx.currentPhase ?? "";

  if (phase === "scarcity" || phase === "cart_close") {
    // Scarcity phase: revenue is everything. ROAS spikes here.
    return {
      revenue: Math.min(45, weights.revenue + 10),
      roas:    Math.min(35, weights.roas    + 5),
      cpl:     Math.max(5,  weights.cpl     - 10),
      email:   Math.max(5,  weights.email   - 5),
      trend:   weights.trend,
    };
  }

  if (phase === "cart_open" || phase === "cart_middle") {
    // Cart open: revenue tracking starts mattering. Balance maintained.
    return weights; // default for this phase
  }

  return weights;
}

// ─── Alert Threshold Profiles ─────────────────────────────────────────────────

function getAlertThresholdsForPositioning(positioning: string): AlertThresholdProfile {
  switch (positioning) {
    case "premium":
      return {
        roasDropPercent:      0.3,  // Premium: flag ROAS drop earlier (we can't fix with scale)
        cplSpikeMultiplier:   3.0,  // More tolerant of high CPL (quality leads cost more)
        revenueGapWarning:    0.4,  // Revenue starts later — wider tolerance before warning
        emailOpenRateMin:     0.20, // Premium audiences need higher open rates
        ctrFatigueThreshold:  0.65, // Flag fatigue earlier for premium (perception matters)
        minPeakCtrForFatigue: 0.003,
      };
    case "commodity":
      return {
        roasDropPercent:      0.6,  // Commodity: cut losses faster on poor ROAS
        cplSpikeMultiplier:   2.0,  // CPL spikes are dangerous at low margins
        revenueGapWarning:    0.2,  // Revenue gap should be caught early
        emailOpenRateMin:     0.12, // Lower open threshold for mass market
        ctrFatigueThreshold:  0.75, // High-volume — catch fatigue later (more data)
        minPeakCtrForFatigue: 0.008,
      };
    default:
      return DEFAULT_THRESHOLDS;
  }
}

// ─── Main exports ──────────────────────────────────────────────────────────────

export function getDecisionWeights(ctx: DecisionContext): WeightProfile {
  let base: WeightProfile;

  switch (ctx.positioning) {
    case "premium":     base = PREMIUM_WEIGHTS;    break;
    case "mid-market":  base = MID_MARKET_WEIGHTS; break;
    case "accessible":  base = ACCESSIBLE_WEIGHTS; break;
    case "commodity":   base = COMMODITY_WEIGHTS;  break;
    default:            base = DEFAULT_WEIGHTS;
  }

  // Apply type-specific override
  if (ctx.campaignType === "flash_sale") {
    // Flash sales: all about conversion velocity
    base = { revenue: 40, roas: 30, cpl: 18, email: 7, trend: 5 };
  } else if (ctx.campaignType === "subscription_growth") {
    // Subscriptions: LTV matters, CPL tolerance higher
    base = { revenue: 25, roas: 20, cpl: 25, email: 20, trend: 10 };
  }

  const phaseAdjusted = applyPhaseModifier(base, ctx);

  // Normalize to 100 (floating point drift correction)
  const total = phaseAdjusted.revenue + phaseAdjusted.roas + phaseAdjusted.cpl + phaseAdjusted.email + phaseAdjusted.trend;
  if (total !== 100 && total > 0) {
    const scale = 100 / total;
    return {
      revenue: Math.round(phaseAdjusted.revenue * scale),
      roas:    Math.round(phaseAdjusted.roas    * scale),
      cpl:     Math.round(phaseAdjusted.cpl     * scale),
      email:   Math.round(phaseAdjusted.email   * scale),
      trend:   100 - Math.round(phaseAdjusted.revenue * scale) - Math.round(phaseAdjusted.roas * scale) - Math.round(phaseAdjusted.cpl * scale) - Math.round(phaseAdjusted.email * scale),
    };
  }

  return phaseAdjusted;
}

export function getAlertThresholds(ctx: DecisionContext): AlertThresholdProfile {
  const base = getAlertThresholdsForPositioning(ctx.positioning);

  // Pre-cart: no revenue/ROAS alerts yet — widen gaps
  if (ctx.isPreCart) {
    return {
      ...base,
      revenueGapWarning: 1.0, // no revenue expected yet
      roasDropPercent:   0.1,  // ROAS irrelevant pre-cart
    };
  }

  return base;
}

/**
 * Build a DecisionContext from campaign + brain data.
 * Called in ingestMetrics before calculateHealthScore.
 */
export function buildDecisionContext(
  intake:     Record<string, unknown>,
  campaign:   Record<string, unknown>,
  brain:      Record<string, unknown> | null,
  dayIndex:   number,
): DecisionContext {
  const positioning = (brain as any)?.offer?.positioning
    ?? inferPositioningFromPrice(Number(intake["product.price"] ?? 0));

  const awarenessScore = (brain as any)?.icp?.awarenessScore ?? 2;
  const totalDays      = Number(intake["campaign.durationDays"] ?? 21);
  const cartOpenDay    = Number(intake["campaign.cartOpenDay"] ?? Math.ceil(totalDays * 0.6));
  const isPreCart      = dayIndex < cartOpenDay;
  const currentPhase   = String(campaign["currentPhase"] ?? (isPreCart ? "warmup" : "cart_open"));
  const campaignType   = String(campaign["type"] ?? "launch");
  const revenueTarget  = Number(intake["campaign.revenueTarget"] ?? 0);
  const ticketPrice    = Number(intake["product.price"] ?? 0);

  return {
    positioning: positioning as DecisionContext["positioning"],
    campaignType,
    currentPhase,
    dayIndex,
    totalDays,
    awarenessScore,
    revenueTarget,
    ticketPrice,
    isPreCart,
  };
}

function inferPositioningFromPrice(price: number): DecisionContext["positioning"] {
  if (price >= 5000) return "premium";
  if (price >= 1500) return "mid-market";
  if (price >= 300)  return "accessible";
  return "commodity";
}

/**
 * Format decision context as a human-readable label for logs/UI.
 */
export function formatWeightContext(ctx: DecisionContext, weights: WeightProfile): string {
  return `[${ctx.positioning}/${ctx.campaignType}] dia ${ctx.dayIndex}/${ctx.totalDays} ${ctx.isPreCart ? "(pré-carrinho)" : "(carrinho aberto)"} → pesos: rev=${weights.revenue} roas=${weights.roas} cpl=${weights.cpl} email=${weights.email} trend=${weights.trend}`;
}
