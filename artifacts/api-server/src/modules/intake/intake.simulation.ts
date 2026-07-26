/**
 * Budget Simulation Engine
 * Real Brazilian digital marketing benchmarks — Q1 2026
 * Sources: Meta Business, Google Ads BR, TikTok for Business, internal campaign data
 */

export type ProductCategory = "infoproduct" | "mentorship" | "software" | "service" | "ecommerce" | "community" | "event";
export type CampaignModelType = "launch" | "perpetual_launch" | "flash_sale" | "live_sale" | "continuous_sales" | "authority" | "audience_growth" | "subscription_growth" | "affiliate";

export interface ScenarioValues {
  low: number;
  mid: number;
  high: number;
}

export interface PlatformSimulation {
  platform: string;
  label: string;
  icon: string;
  color: string;
  budgetAllocation: number;
  budgetPct: number;
  impressions: ScenarioValues;
  reach: ScenarioValues;
  leads: ScenarioValues;
  sales: ScenarioValues;
  revenue: ScenarioValues;
  cpl: ScenarioValues;
  cpa: ScenarioValues;
  roas: ScenarioValues;
  notes: string;
}

export interface BudgetSimulation {
  budget: number;
  productPrice: number;
  campaignType: string;
  productCategory: string;
  totalImpressions: ScenarioValues;
  totalReach: ScenarioValues;
  totalLeads: ScenarioValues;
  totalSales: ScenarioValues;
  totalRevenue: ScenarioValues;
  totalRoi: ScenarioValues;
  totalRoas: ScenarioValues;
  breakEvenSales: number;
  breakEvenCpa: number;
  platforms: PlatformSimulation[];
  allocationRecommendation: { platform: string; pct: number; label: string }[];
  benchmarkNote: string;
}

// ─── Real CPL benchmarks by product category (R$) ────────────────────────────

const CPL_BENCHMARKS: Record<string, Record<ProductCategory, ScenarioValues>> = {
  meta_ads: {
    infoproduct: { low: 6,  mid: 11,  high: 18  },
    mentorship:  { low: 18, mid: 28,  high: 48  },
    software:    { low: 22, mid: 40,  high: 70  },
    service:     { low: 14, mid: 22,  high: 38  },
    ecommerce:   { low: 8,  mid: 15,  high: 28  },
    community:   { low: 10, mid: 17,  high: 30  },
    event:       { low: 12, mid: 20,  high: 35  },
  },
  google_ads: {
    infoproduct: { low: 14, mid: 24,  high: 40  },
    mentorship:  { low: 30, mid: 48,  high: 80  },
    software:    { low: 35, mid: 58,  high: 95  },
    service:     { low: 20, mid: 35,  high: 58  },
    ecommerce:   { low: 12, mid: 22,  high: 38  },
    community:   { low: 16, mid: 28,  high: 45  },
    event:       { low: 18, mid: 30,  high: 50  },
  },
  tiktok_ads: {
    infoproduct: { low: 4,  mid: 8,   high: 14  },
    mentorship:  { low: 12, mid: 20,  high: 35  },
    software:    { low: 18, mid: 30,  high: 50  },
    service:     { low: 10, mid: 16,  high: 28  },
    ecommerce:   { low: 5,  mid: 10,  high: 18  },
    community:   { low: 7,  mid: 13,  high: 22  },
    event:       { low: 9,  mid: 15,  high: 26  },
  },
  youtube_ads: {
    infoproduct: { low: 10, mid: 17,  high: 28  },
    mentorship:  { low: 25, mid: 40,  high: 65  },
    software:    { low: 28, mid: 48,  high: 80  },
    service:     { low: 18, mid: 30,  high: 50  },
    ecommerce:   { low: 12, mid: 20,  high: 35  },
    community:   { low: 14, mid: 24,  high: 40  },
    event:       { low: 15, mid: 25,  high: 42  },
  },
};

// ─── CPM benchmarks (R$ per 1000 impressions) ────────────────────────────────

const CPM_BENCHMARKS: Record<string, ScenarioValues> = {
  meta_ads:    { low: 8,   mid: 14,  high: 22  },
  google_ads:  { low: 5,   mid: 9,   high: 16  },
  tiktok_ads:  { low: 8,   mid: 13,  high: 19  },
  youtube_ads: { low: 12,  mid: 18,  high: 26  },
};

// ─── Conversion rate benchmarks (lead → sale) by campaign model ───────────────

const CONVERSION_BENCHMARKS: Record<string, ScenarioValues> = {
  launch:              { low: 0.015, mid: 0.025, high: 0.04  },
  perpetual_launch:    { low: 0.025, mid: 0.04,  high: 0.065 },
  flash_sale:          { low: 0.02,  mid: 0.035, high: 0.055 },
  live_sale:           { low: 0.025, mid: 0.04,  high: 0.07  },
  continuous_sales:    { low: 0.015, mid: 0.028, high: 0.045 },
  authority:           { low: 0.01,  mid: 0.02,  high: 0.035 },
  audience_growth:     { low: 0.005, mid: 0.012, high: 0.022 },
  subscription_growth: { low: 0.02,  mid: 0.035, high: 0.06  },
  affiliate:           { low: 0.015, mid: 0.025, high: 0.04  },
};

// ─── Budget allocation by campaign model ─────────────────────────────────────

const BUDGET_ALLOCATION: Record<string, Record<string, number>> = {
  launch:              { meta_ads: 0.60, google_ads: 0.20, tiktok_ads: 0.10, youtube_ads: 0.10 },
  perpetual_launch:    { meta_ads: 0.50, google_ads: 0.30, tiktok_ads: 0.10, youtube_ads: 0.10 },
  flash_sale:          { meta_ads: 0.70, google_ads: 0.15, tiktok_ads: 0.15, youtube_ads: 0.00 },
  live_sale:           { meta_ads: 0.60, google_ads: 0.10, tiktok_ads: 0.10, youtube_ads: 0.20 },
  continuous_sales:    { meta_ads: 0.50, google_ads: 0.30, tiktok_ads: 0.20, youtube_ads: 0.00 },
  authority:           { meta_ads: 0.40, google_ads: 0.10, tiktok_ads: 0.20, youtube_ads: 0.30 },
  audience_growth:     { meta_ads: 0.40, google_ads: 0.10, tiktok_ads: 0.30, youtube_ads: 0.20 },
  subscription_growth: { meta_ads: 0.55, google_ads: 0.25, tiktok_ads: 0.10, youtube_ads: 0.10 },
  affiliate:           { meta_ads: 0.65, google_ads: 0.20, tiktok_ads: 0.15, youtube_ads: 0.00 },
};

const PLATFORM_META = {
  meta_ads:    { label: "Meta Ads",    sublabel: "Facebook + Instagram", icon: "📘", color: "#1877F2" },
  google_ads:  { label: "Google Ads",  sublabel: "Search + Display",     icon: "🔍", color: "#4285F4" },
  tiktok_ads:  { label: "TikTok Ads",  sublabel: "Short video",          icon: "🎵", color: "#010101" },
  youtube_ads: { label: "YouTube Ads", sublabel: "Vídeo + Pre-roll",     icon: "▶️", color: "#FF0000" },
};

const PLATFORM_NOTES: Record<string, string> = {
  meta_ads:    "Maior escala no Brasil. CPL ideal para infoprodutos e mentorias. Alto alcance em lookalikes.",
  google_ads:  "Intenção de compra alta (Search). Leads mais qualificados, porém mais caros. Melhor para remarketing.",
  tiktok_ads:  "CPL mais barato, volume alto. Converte melhor para público 18–35. Qualidade de lead menor.",
  youtube_ads: "Melhor para autoridade e VSL longo. Público educado. Excelente para ticket acima de R$2.000.",
};

// ─── Simulation engine ────────────────────────────────────────────────────────

function inv(scenario: ScenarioValues): ScenarioValues {
  return { low: scenario.high, mid: scenario.mid, high: scenario.low };
}

function scaledCpl(baseCpl: ScenarioValues, budget: number): ScenarioValues {
  // CPL increases slightly with budget (saturation effect above R$30k/month)
  const factor = budget > 30000 ? 1.15 : budget > 10000 ? 1.05 : 1.0;
  return {
    low: baseCpl.low * factor,
    mid: baseCpl.mid * factor,
    high: baseCpl.high * factor,
  };
}

export function simulateBudget(
  budget: number,
  productPrice: number,
  campaignType: CampaignModelType,
  productCategory: ProductCategory,
): BudgetSimulation {
  const allocation = BUDGET_ALLOCATION[campaignType] ?? BUDGET_ALLOCATION["launch"]!;
  const conversion = CONVERSION_BENCHMARKS[campaignType] ?? CONVERSION_BENCHMARKS["launch"]!;

  const platforms: PlatformSimulation[] = [];

  let totalLeads = { low: 0, mid: 0, high: 0 };
  let totalImpressions = { low: 0, mid: 0, high: 0 };
  let totalReach = { low: 0, mid: 0, high: 0 };

  for (const [platformKey, pct] of Object.entries(allocation)) {
    if (pct === 0) continue;

    const platformBudget = budget * pct;
    const meta = PLATFORM_META[platformKey as keyof typeof PLATFORM_META];
    const cplBase = CPL_BENCHMARKS[platformKey]?.[productCategory];
    const cpmBase = CPM_BENCHMARKS[platformKey];

    if (!meta || !cplBase || !cpmBase) continue;

    const cpl = scaledCpl(cplBase, platformBudget);

    // Leads: budget / CPL (inverted because lower CPL = more leads)
    const leads: ScenarioValues = {
      low: Math.round(platformBudget / cpl.high),
      mid: Math.round(platformBudget / cpl.mid),
      high: Math.round(platformBudget / cpl.low),
    };

    // Impressions: budget * 1000 / CPM
    const impressions: ScenarioValues = {
      low: Math.round((platformBudget * 1000) / cpmBase.high),
      mid: Math.round((platformBudget * 1000) / cpmBase.mid),
      high: Math.round((platformBudget * 1000) / cpmBase.low),
    };

    // Reach ≈ 60-75% of impressions (frequency ~1.4)
    const reach: ScenarioValues = {
      low: Math.round(impressions.low * 0.60),
      mid: Math.round(impressions.mid * 0.68),
      high: Math.round(impressions.high * 0.75),
    };

    // Sales: leads × conversion rate
    const sales: ScenarioValues = {
      low: Math.round(leads.low * conversion.low),
      mid: Math.round(leads.mid * conversion.mid),
      high: Math.round(leads.high * conversion.high),
    };

    // Revenue
    const revenue: ScenarioValues = {
      low: sales.low * productPrice,
      mid: sales.mid * productPrice,
      high: sales.high * productPrice,
    };

    // CPA (cost per acquisition)
    const cpa: ScenarioValues = {
      low: sales.high > 0 ? Math.round(platformBudget / sales.high) : 0,
      mid: sales.mid > 0 ? Math.round(platformBudget / sales.mid) : 0,
      high: sales.low > 0 ? Math.round(platformBudget / sales.low) : 0,
    };

    // ROAS
    const roas: ScenarioValues = {
      low: platformBudget > 0 ? Math.round((revenue.low / platformBudget) * 100) / 100 : 0,
      mid: platformBudget > 0 ? Math.round((revenue.mid / platformBudget) * 100) / 100 : 0,
      high: platformBudget > 0 ? Math.round((revenue.high / platformBudget) * 100) / 100 : 0,
    };

    totalLeads.low += leads.low;
    totalLeads.mid += leads.mid;
    totalLeads.high += leads.high;
    totalImpressions.low += impressions.low;
    totalImpressions.mid += impressions.mid;
    totalImpressions.high += impressions.high;
    totalReach.low += reach.low;
    totalReach.mid += reach.mid;
    totalReach.high += reach.high;

    platforms.push({
      platform: platformKey,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      budgetAllocation: Math.round(platformBudget),
      budgetPct: Math.round(pct * 100),
      impressions,
      reach,
      leads,
      sales,
      revenue,
      cpl: inv(cpl), // invert for display (high cpl = pessimistic)
      cpa,
      roas,
      notes: PLATFORM_NOTES[platformKey] ?? "",
    });
  }

  // Total sales & revenue
  const totalSales: ScenarioValues = {
    low: Math.round(totalLeads.low * conversion.low),
    mid: Math.round(totalLeads.mid * conversion.mid),
    high: Math.round(totalLeads.high * conversion.high),
  };
  const totalRevenue: ScenarioValues = {
    low: totalSales.low * productPrice,
    mid: totalSales.mid * productPrice,
    high: totalSales.high * productPrice,
  };
  const totalRoi: ScenarioValues = {
    low: budget > 0 ? Math.round(((totalRevenue.low - budget) / budget) * 100) : 0,
    mid: budget > 0 ? Math.round(((totalRevenue.mid - budget) / budget) * 100) : 0,
    high: budget > 0 ? Math.round(((totalRevenue.high - budget) / budget) * 100) : 0,
  };
  const totalRoas: ScenarioValues = {
    low: budget > 0 ? Math.round((totalRevenue.low / budget) * 100) / 100 : 0,
    mid: budget > 0 ? Math.round((totalRevenue.mid / budget) * 100) / 100 : 0,
    high: budget > 0 ? Math.round((totalRevenue.high / budget) * 100) / 100 : 0,
  };

  const breakEvenSales = productPrice > 0 ? Math.ceil(budget / productPrice) : 0;
  const breakEvenCpa = productPrice;

  const allocationRecommendation = Object.entries(allocation)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, pct]) => ({
      platform: key,
      pct: Math.round(pct * 100),
      label: PLATFORM_META[key as keyof typeof PLATFORM_META]?.label ?? key,
    }));

  const benchmarkNote = "Benchmarks baseados em dados reais do mercado digital brasileiro (Q1 2026). Valores variam conforme criativo, copy, sazonalidade e histórico da conta.";

  return {
    budget,
    productPrice,
    campaignType,
    productCategory,
    totalImpressions,
    totalReach,
    totalLeads,
    totalSales,
    totalRevenue,
    totalRoi,
    totalRoas,
    breakEvenSales,
    breakEvenCpa,
    platforms,
    allocationRecommendation,
    benchmarkNote,
  };
}

// ─── Reverse Budget Engine ────────────────────────────────────────────────────
// Given a revenue target + product price, calculates the minimum viable traffic
// budget using the same CPL/conversion benchmarks as simulateBudget() — but in
// reverse: target → sales needed → leads needed → budget.

export interface ReverseBudgetResult {
  budgetMin: number;          // optimistic (high conversion × low CPL)
  budgetMid: number;          // typical (mid conversion × mid CPL) — used as default
  budgetPessimistic: number;  // conservative (low conversion × high CPL)
  impliedCPL: number;         // weighted average CPL at budgetMid scenario
  impliedROAS: number;        // revenueTarget / budgetMid
  salesNeeded: number;        // ceil(revenueTarget / productPrice)
  leadsNeeded: number;        // salesNeeded / midConversionRate
  revenueTarget: number;
  productPrice: number;
  campaignType: string;
  productCategory: string;
  reasoning: string;
  benchmarkNote: string;
  allocationBreakdown: {
    platform: string;
    label: string;
    pct: number;
    cplMid: number;
    budgetShare: number;
  }[];
}

export function reverseBudget(
  revenueTarget: number,
  productPrice: number,
  campaignType: CampaignModelType,
  productCategory: ProductCategory,
): ReverseBudgetResult {
  const conversion = CONVERSION_BENCHMARKS[campaignType] ?? CONVERSION_BENCHMARKS["launch"]!;
  const allocation = BUDGET_ALLOCATION[campaignType] ?? BUDGET_ALLOCATION["launch"]!;

  const benchmarkNote = "Benchmarks baseados em dados reais do mercado digital brasileiro (Q1 2026). Valores variam conforme criativo, copy, sazonalidade e histórico da conta.";

  if (productPrice <= 0 || revenueTarget <= 0) {
    return {
      budgetMin: 0, budgetMid: 0, budgetPessimistic: 0,
      impliedCPL: 0, impliedROAS: 0,
      salesNeeded: 0, leadsNeeded: 0,
      revenueTarget, productPrice, campaignType, productCategory,
      reasoning: "Produto sem preço ou sem meta de resultado definidos — não é possível calcular budget reverso.",
      benchmarkNote,
      allocationBreakdown: [],
    };
  }

  const salesNeeded = Math.ceil(revenueTarget / productPrice);

  // Leads needed under each conversion scenario
  const leadsMin = Math.ceil(salesNeeded / conversion.high);          // best conversion → fewer leads
  const leadsMid = Math.ceil(salesNeeded / conversion.mid);           // typical
  const leadsPessimistic = Math.ceil(salesNeeded / conversion.low);   // worst → more leads needed

  // Weighted CPL and breakdown across platforms
  let wCplLow = 0;
  let wCplMid = 0;
  let wCplHigh = 0;
  const allocationBreakdown: ReverseBudgetResult["allocationBreakdown"] = [];

  for (const [platformKey, pct] of Object.entries(allocation)) {
    if (pct === 0) continue;
    const cplBase = CPL_BENCHMARKS[platformKey]?.[productCategory];
    const meta = PLATFORM_META[platformKey as keyof typeof PLATFORM_META];
    if (!cplBase || !meta) continue;
    wCplLow  += cplBase.low  * pct;
    wCplMid  += cplBase.mid  * pct;
    wCplHigh += cplBase.high * pct;
    allocationBreakdown.push({
      platform: platformKey,
      label: meta.label,
      pct: Math.round(pct * 100),
      cplMid: cplBase.mid,
      budgetShare: Math.round(leadsMid * cplBase.mid * pct),
    });
  }

  const budgetMin         = Math.round(leadsMin         * wCplMid);   // fewer leads × typical CPL
  const budgetMid         = Math.round(leadsMid         * wCplMid);   // typical × typical
  const budgetPessimistic = Math.round(leadsPessimistic * wCplHigh);  // more leads × high CPL

  const impliedROAS = budgetMid > 0
    ? Math.round((revenueTarget / budgetMid) * 10) / 10
    : 0;

  const platformList = Object.entries(allocation)
    .filter(([, p]) => p > 0)
    .map(([k]) => PLATFORM_META[k as keyof typeof PLATFORM_META]?.label ?? k)
    .join(", ");

  const reasoning =
    `Para atingir R$${revenueTarget.toLocaleString("pt-BR")} com produto de ` +
    `R$${productPrice.toLocaleString("pt-BR")}, são necessárias ${salesNeeded} vendas. ` +
    `Com conversão típica de ${(conversion.mid * 100).toFixed(1)}% (modelo ${campaignType}), ` +
    `isso exige ~${leadsMid} leads. CPL ponderado estimado: R$${Math.round(wCplMid)} ` +
    `(${platformList}). Budget recomendado: R$${budgetMid.toLocaleString("pt-BR")} ` +
    `(ROAS implícito ${impliedROAS}x). ` +
    `Cenário otimista: R$${budgetMin.toLocaleString("pt-BR")}. ` +
    `Cenário conservador: R$${budgetPessimistic.toLocaleString("pt-BR")}.`;

  return {
    budgetMin,
    budgetMid,
    budgetPessimistic,
    impliedCPL: Math.round(wCplMid),
    impliedROAS,
    salesNeeded,
    leadsNeeded: leadsMid,
    revenueTarget,
    productPrice,
    campaignType,
    productCategory,
    reasoning,
    benchmarkNote,
    allocationBreakdown,
  };
}
