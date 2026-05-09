import type { CampaignType, CampaignTrack, IntakeQuestion } from "./intake.service.js";
import { getIntakeQuestions } from "./intake.service.js";

// ─── Track viability ──────────────────────────────────────────────────────────

export type ViabilityLevel = "green" | "yellow" | "red";

export interface RevenueViabilityResult {
  viable: boolean;
  warningLevel: ViabilityLevel;
  recommendedTrack: CampaignTrack;
  analysis: string;
  requiredConversions: number;
  requiredROAS: number;
  impliedCPL: number;
  budgetSufficiency: "insufficient" | "tight" | "adequate" | "comfortable";
  issues: string[];
  recommendations: string[];
}

const TRACK_RANGES: Record<CampaignTrack, { min: number; max: number; label: string }> = {
  six_digits: { min: 100_000, max: 999_999, label: "6 Dígitos (R$100k–R$999k)" },
  eight_digits: { min: 10_000_000, max: 99_999_999, label: "8 Dígitos (R$10M–R$99M)" },
  ten_digits: { min: 100_000_000, max: Infinity, label: "10 Dígitos (R$100M+)" },
  not_applicable: { min: 0, max: Infinity, label: "Não Aplicável" },
};

export function recommendTrackFromRevenue(revenueTarget: number): CampaignTrack {
  if (revenueTarget >= 100_000_000) return "ten_digits";
  if (revenueTarget >= 10_000_000) return "eight_digits";
  if (revenueTarget >= 100_000) return "six_digits";
  return "not_applicable";
}

export function validateRevenueViability(opts: {
  revenueTarget: number;
  budget: number;
  productPrice: number;
  track: CampaignTrack;
  launchDays?: number;
  hasAffiliate?: boolean;
}): RevenueViabilityResult {
  const { revenueTarget, budget, productPrice, track, launchDays = 7, hasAffiliate = false } = opts;

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Required conversions
  const requiredConversions = productPrice > 0 ? Math.ceil(revenueTarget / productPrice) : 0;

  // Required ROAS (revenue / budget)
  const requiredROAS = budget > 0 ? revenueTarget / budget : 999;

  // Implied CPL at 1.5% typical conversion rate
  const impliedConversionRate = hasAffiliate ? 0.025 : 0.015;
  const requiredLeads = Math.ceil(requiredConversions / impliedConversionRate);
  const impliedCPLRaw = budget > 0 ? budget / requiredLeads : 0;
  const impliedCPL = Math.round(impliedCPLRaw * 100) / 100;

  // Track alignment
  const trackRange = TRACK_RANGES[track];
  const recommendedTrack = recommendTrackFromRevenue(revenueTarget);
  const trackMismatch = track !== recommendedTrack && track !== "not_applicable";

  if (trackMismatch) {
    issues.push(
      `Meta de R$${revenueTarget.toLocaleString("pt-BR")} não corresponde ao track "${TRACK_RANGES[track].label}". Track recomendado: ${TRACK_RANGES[recommendedTrack].label}`
    );
    recommendations.push(`Ajuste o track para ${TRACK_RANGES[recommendedTrack].label} ou revise a meta de faturamento`);
  }

  // Budget sufficiency
  let budgetSufficiency: RevenueViabilityResult["budgetSufficiency"];
  const budgetRatio = revenueTarget / budget;

  if (budgetRatio > 20) {
    budgetSufficiency = "insufficient";
    issues.push(
      `Budget de R$${budget.toLocaleString("pt-BR")} muito baixo para meta de R$${revenueTarget.toLocaleString("pt-BR")} (ROAS implícito: ${requiredROAS.toFixed(0)}x)`
    );
    recommendations.push("Considere reduzir a meta ou aumentar o budget mínimo para 5-10% da meta");
  } else if (budgetRatio > 10) {
    budgetSufficiency = "tight";
    recommendations.push("Budget apertado — planeje ativação de afiliados para compensar alcance orgânico");
  } else if (budgetRatio > 5) {
    budgetSufficiency = "adequate";
  } else {
    budgetSufficiency = "comfortable";
  }

  // ROAS check
  if (requiredROAS > 15) {
    issues.push(`ROAS necessário de ${requiredROAS.toFixed(0)}x é acima do mercado (típico: 3x–8x)`);
    recommendations.push("ROAS desta magnitude requer lista aquecida, alta prova social e oferta premium");
  } else if (requiredROAS > 8) {
    recommendations.push(`ROAS de ${requiredROAS.toFixed(0)}x é ambicioso — planeje ativação de base orgânica e afiliados`);
  }

  // Conversions per day check
  const conversionsPerDay = requiredConversions / launchDays;
  if (conversionsPerDay > 500) {
    issues.push(
      `${requiredConversions.toLocaleString("pt-BR")} vendas em ${launchDays} dias = ${conversionsPerDay.toFixed(0)}/dia. Exige infraestrutura de escala.`
    );
  }

  // Product price vs revenue target sanity
  if (productPrice > 0 && requiredConversions < 5) {
    recommendations.push("Poucas vendas necessárias — foque em qualificação extrema e follow-up pessoal");
  }

  // Track range validation
  if (track !== "not_applicable" && revenueTarget < trackRange.min) {
    issues.push(
      `Meta R$${revenueTarget.toLocaleString("pt-BR")} está abaixo do mínimo do track ${TRACK_RANGES[track].label} (R$${trackRange.min.toLocaleString("pt-BR")})`
    );
  }

  // Determine overall viability
  const redIssues = budgetSufficiency === "insufficient" || requiredROAS > 20;
  const yellowIssues = issues.length > 0 || budgetSufficiency === "tight";

  const warningLevel: ViabilityLevel = redIssues ? "red" : yellowIssues ? "yellow" : "green";

  const analysis = buildAnalysis({ revenueTarget, budget, requiredROAS, requiredConversions, impliedCPL, warningLevel, productPrice, launchDays });

  return {
    viable: warningLevel !== "red",
    warningLevel,
    recommendedTrack,
    analysis,
    requiredConversions,
    requiredROAS: Math.round(requiredROAS * 10) / 10,
    impliedCPL: Math.round(impliedCPL),
    budgetSufficiency,
    issues,
    recommendations,
  };
}

function buildAnalysis(opts: {
  revenueTarget: number;
  budget: number;
  requiredROAS: number;
  requiredConversions: number;
  impliedCPL: number;
  warningLevel: ViabilityLevel;
  productPrice: number;
  launchDays: number;
}): string {
  const { revenueTarget, budget, requiredROAS, requiredConversions, impliedCPL, warningLevel, productPrice, launchDays } = opts;
  const verdicts: Record<ViabilityLevel, string> = {
    green: "Viável com boa execução",
    yellow: "Viável com ressalvas — ajustes recomendados",
    red: "Alto risco — revise os parâmetros antes de executar",
  };

  return (
    `Meta R$${revenueTarget.toLocaleString("pt-BR")} em ${launchDays} dias com budget R$${budget.toLocaleString("pt-BR")}. ` +
    `Requer ${requiredConversions} vendas (${(requiredConversions / launchDays).toFixed(1)}/dia) a R$${productPrice.toLocaleString("pt-BR")} cada. ` +
    `ROAS implícito: ${requiredROAS.toFixed(1)}x. CPL médio estimado: R$${impliedCPL}. ` +
    `Veredicto: ${verdicts[warningLevel]}.`
  );
}

// ─── Readiness score ──────────────────────────────────────────────────────────

export interface ReadinessDimension {
  score: number;
  maxScore: number;
  pct: number;
  issues: string[];
  strengths: string[];
}

export interface ReadinessResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  readyToExecute: boolean;
  blockers: string[];
  dimensions: {
    product: ReadinessDimension;
    audience: ReadinessDimension;
    creator: ReadinessDimension;
    strategy: ReadinessDimension;
    resources: ReadinessDimension;
  };
  summary: string;
}

function scoreDimension(checks: Array<{ condition: boolean; issue?: string; strength?: string; weight: number }>): ReadinessDimension {
  const maxScore = checks.reduce((s, c) => s + c.weight, 0);
  const score = checks.filter((c) => c.condition).reduce((s, c) => s + c.weight, 0);
  const issues = checks.filter((c) => !c.condition && c.issue).map((c) => c.issue!);
  const strengths = checks.filter((c) => c.condition && c.strength).map((c) => c.strength!);

  return { score, maxScore, pct: Math.round((score / maxScore) * 100), issues, strengths };
}

export function calculateReadinessScore(
  type: CampaignType,
  track: CampaignTrack,
  intakeData: Record<string, unknown>
): ReadinessResult {
  const get = (key: string) => intakeData[key];
  const has = (key: string) => {
    const v = intakeData[key];
    return v !== undefined && v !== null && v !== "" && v !== 0;
  };

  // Product dimension (max 20)
  const product = scoreDimension([
    { condition: has("product.name"), issue: "Nome do produto não definido", strength: "Produto nomeado", weight: 4 },
    { condition: has("product.description") && String(get("product.description") ?? "").length > 50, issue: "Descrição do produto muito curta ou ausente", strength: "Produto bem descrito", weight: 5 },
    { condition: has("product.price") && Number(get("product.price")) > 0, issue: "Preço não definido", strength: "Preço definido", weight: 4 },
    { condition: has("product.category"), issue: "Categoria do produto não selecionada", weight: 3 },
    { condition: has("product.socialProof") && String(get("product.socialProof") ?? "").length > 20, issue: "Sem prova social documentada — risco para conversão", strength: "Prova social presente", weight: 4 },
  ]);

  // Audience dimension (max 20)
  const audience = scoreDimension([
    { condition: has("audience.description") && String(get("audience.description") ?? "").length > 30, issue: "Avatar não definido ou muito genérico", strength: "Avatar bem definido", weight: 6 },
    { condition: has("audience.painPoints") && String(get("audience.painPoints") ?? "").length > 20, issue: "Dores do avatar não mapeadas", strength: "Dores identificadas", weight: 5 },
    { condition: has("audience.desires"), issue: "Desejos do avatar não mapeados", strength: "Desejos mapeados", weight: 4 },
    { condition: has("audience.sophisticationLevel"), issue: "Nível de consciência não definido", strength: "Nível de consciência mapeado", weight: 3 },
    { condition: has("audience.location"), issue: "Geolocalização da audiência não definida", weight: 2 },
  ]);

  // Creator dimension (max 20)
  const creator = scoreDimension([
    { condition: has("creator.name"), issue: "Nome do criador/marca não informado", strength: "Criador identificado", weight: 4 },
    { condition: has("creator.positioning"), issue: "Posicionamento não definido", strength: "Posicionamento claro", weight: 6 },
    { condition: has("creator.uniqueAngle") && String(get("creator.uniqueAngle") ?? "").length > 20, issue: "Ângulo único não articulado — diferencial competitivo fraco", strength: "Diferencial competitivo claro", weight: 6 },
    { condition: has("content.tone"), issue: "Tom de comunicação não selecionado", weight: 2 },
    { condition: has("content.style"), issue: "Estilo de conteúdo não selecionado", weight: 2 },
  ]);

  // Strategy dimension (max 20)
  const strategyChecks = [
    { condition: has("campaign.revenueTarget") && Number(get("campaign.revenueTarget")) > 0, issue: "Meta de faturamento não definida", strength: "Meta definida", weight: 5 },
    { condition: has("campaign.salesChannel"), issue: "Canal de vendas não selecionado", strength: "Canal de vendas definido", weight: 5 },
    { condition: has("risk.tolerance"), issue: "Tolerância a risco não definida", weight: 3 },
  ];

  if (type === "launch" || type === "flash_sale") {
    strategyChecks.push(
      { condition: has("launch.scarcityMechanism") || has("flash.discountMechanism"), issue: "Mecanismo de escassez/urgência não definido", strength: "Escassez planejada", weight: 4 },
      { condition: has("campaign.budget.total") && Number(get("campaign.budget.total")) > 0, issue: "Budget de campanha não informado", strength: "Budget definido", weight: 3 }
    );
  } else {
    strategyChecks.push(
      { condition: has("campaign.budget.traffic") && Number(get("campaign.budget.traffic")) > 0, issue: "Budget de tráfego não informado", strength: "Budget de tráfego definido", weight: 4 },
      { condition: has("evergreen.funnelType") || has("perpetual.triggerFormat"), issue: "Tipo de funil não definido", weight: 3 }
    );
  }

  const strategy = scoreDimension(strategyChecks);

  // Resources dimension (max 20)
  const resources = scoreDimension([
    { condition: has("campaign.budget.total") || has("campaign.budget.traffic"), issue: "Budget não informado — impossível planejar mídia", strength: "Budget informado", weight: 8 },
    { condition: !has("risk.previousCampaigns") || String(get("risk.previousCampaigns") ?? "").length > 0, issue: "", strength: "Histórico de campanhas mapeado", weight: 4 },
    { condition: track === "six_digits" || has("scale.affiliateStructure"), issue: track !== "six_digits" ? "Estrutura de afiliados não definida para track de alta escala" : "", strength: "Estrutura de escala adequada", weight: 5 },
    { condition: has("product.pricingModel"), issue: "Modelo de precificação não definido", weight: 3 },
  ]);

  const totalScore = product.score + audience.score + creator.score + strategy.score + resources.score;
  const maxTotal = product.maxScore + audience.maxScore + creator.maxScore + strategy.maxScore + resources.maxScore;
  const pct = Math.round((totalScore / maxTotal) * 100);

  const grade: ReadinessResult["grade"] =
    pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F";

  const blockers: string[] = [
    ...product.issues.slice(0, 2),
    ...audience.issues.slice(0, 2),
    ...strategy.issues.slice(0, 2),
  ].filter(Boolean);

  const readyToExecute = pct >= 60 && !blockers.some((b) => b.includes("não definid") && (b.includes("Meta") || b.includes("Budget") || b.includes("Canal")));

  const summaryVerdict: Record<ReadinessResult["grade"], string> = {
    A: "Campanha excelentemente preparada. Execute com confiança.",
    B: "Boa preparação. Pequenos ajustes aumentariam a precisão da execução.",
    C: "Preparação mínima para execução. Complete os itens faltantes para melhores resultados.",
    D: "Preparação insuficiente. Riscos elevados de execução genérica e resultados abaixo do potencial.",
    F: "Intake incompleto. A IA não tem dados suficientes para personalizar a campanha.",
  };

  return {
    score: pct,
    grade,
    readyToExecute,
    blockers,
    dimensions: { product, audience, creator, strategy, resources },
    summary: summaryVerdict[grade],
  };
}
