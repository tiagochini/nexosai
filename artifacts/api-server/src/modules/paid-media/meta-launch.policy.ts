import { AppError } from "../../lib/errors.js";
import { validateMetaTargeting, validateMetaCreative } from "./meta-assets.policy.js";
import { assertLifecycle } from "./meta-automation.policy.js";

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const fail = (code: string, message: string): never => { throw new AppError(422, message, code); };

// Deliberately narrow website flows. Other conversion locations need their own
// approved assets and API contract; never infer them from prose or downgrade goals.
export const META_WEBSITE_OBJECTIVES = {
  OUTCOME_TRAFFIC: { optimization_goal: "LINK_CLICKS", events: [] },
  OUTCOME_LEADS: { optimization_goal: "OFFSITE_CONVERSIONS", events: ["Lead", "CompleteRegistration"] },
  OUTCOME_SALES: { optimization_goal: "OFFSITE_CONVERSIONS", events: ["Purchase"] },
} as const;

export function metaDelivery(campaign: Json): Json {
  const rule = META_WEBSITE_OBJECTIVES[campaign.objective as keyof typeof META_WEBSITE_OBJECTIVES];
  if (!Object.hasOwn(META_WEBSITE_OBJECTIVES, String(campaign.objective))) fail("META_OBJECTIVE_UNSUPPORTED", "Aprove um objetivo Meta suportado: OUTCOME_TRAFFIC, OUTCOME_LEADS ou OUTCOME_SALES para website.");
  if (campaign.destinationType !== "WEBSITE") fail("META_DESTINATION_UNSUPPORTED", "Este executor suporta apenas destino WEBSITE; formulários nativos, aplicativos e mensagens não estão implementados.");
  const tracking = obj(campaign.tracking);
  const promoted: Json = {};
  if (rule.events.length) {
    if (typeof tracking.pixelId !== "string" || !/^\d+$/.test(tracking.pixelId) || !(rule.events as readonly unknown[]).includes(tracking.conversionEvent)) {
      fail("TRACKING_REQUIREMENTS_REQUIRED", "Aprove um pixelId numérico e um conversionEvent compatível: Lead/CompleteRegistration para leads; Purchase para vendas.");
    }
    promoted.pixel_id = tracking.pixelId;
    promoted.custom_event_type = String(tracking.conversionEvent).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
  }
  if (campaign.catalog != null) {
    const catalog = obj(campaign.catalog);
    if (campaign.objective !== "OUTCOME_SALES" || Object.keys(catalog).some(key => !["catalogId", "productSetId"].includes(key)) || !/^\d+$/.test(String(catalog.catalogId ?? "")) || !/^\d+$/.test(String(catalog.productSetId ?? ""))) fail("CATALOG_CONFIGURATION_INVALID", "Catálogo exige OUTCOME_SALES, catalogId e productSetId numéricos aprovados.");
    promoted.product_set_id = catalog.productSetId;
  }
  const optimizationGoal = campaign.bidStrategy === "min_roas" ? "VALUE" : rule.optimization_goal;
  if (campaign.bidStrategy === "min_roas" && campaign.objective !== "OUTCOME_SALES") fail("META_BID_STRATEGY_UNSUPPORTED", "ROAS Goal exige objetivo de vendas.");
  if (campaign.optimizationGoal != null && campaign.optimizationGoal !== optimizationGoal) fail("META_OPTIMIZATION_UNSUPPORTED", "A otimização aprovada não é compatível com o objetivo ou estratégia de lance.");
  return { optimization_goal: optimizationGoal, billing_event: "IMPRESSIONS", destination_type: "WEBSITE", ...(rule.events.length ? { promoted_object: promoted } : {}) };
}

export function metaBudget(campaign: Json, group?: Json): Json {
  if (campaign.budgetMode !== "abo" && campaign.budgetMode !== "cbo") fail("BUDGET_MODE_UNSUPPORTED", "Aprove budget.mode como abo ou cbo.");
  const amount = Number(group ? group.budgetMinorUnits : campaign.authorizedMinorUnits);
  const ownsBudget = group ? campaign.budgetMode === "abo" : campaign.budgetMode === "cbo";
  if (!ownsBudget) {
    if (group && group.budgetMinorUnits != null) fail("BUDGET_LEVEL_CONFLICT", "CBO não pode conter orçamento no conjunto de anúncios.");
    return {};
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) fail("BUDGET_AUTHORIZATION_REQUIRED", "O orçamento de cada nível deve ser positivo e expresso em unidades monetárias mínimas inteiras.");
  if (campaign.budgetKind !== "daily" && campaign.budgetKind !== "lifetime") fail("BUDGET_SEMANTICS_REQUIRED", "Aprove budget.kind como daily ou lifetime.");
  return { [campaign.budgetKind === "daily" ? "daily_budget" : "lifetime_budget"]: amount };
}

const BID_STRATEGIES = {
  lowest_cost: "LOWEST_COST_WITHOUT_CAP",
  cost_cap: "COST_CAP",
  bid_cap: "LOWEST_COST_WITH_BID_CAP",
  min_roas: "LOWEST_COST_WITH_MIN_ROAS",
} as const;
export function metaBid(campaign: Json): Json {
  const strategy = campaign.bidStrategy ?? "lowest_cost";
  if (!Object.hasOwn(BID_STRATEGIES, String(strategy)))
    fail("META_BID_STRATEGY_UNSUPPORTED", "Escolha Lowest Cost, Cost Cap, Bid Cap ou ROAS Goal.");
  const amount = campaign.bidAmountMinorUnits;
  const roasFloor = campaign.roasFloorBasisPoints;
  if (strategy === "lowest_cost") {
    if (amount != null || roasFloor != null) fail("META_BID_CONFIGURATION_INVALID", "Lowest Cost não aceita limite de lance ou ROAS mínimo neste fluxo.");
  } else if (strategy === "min_roas") {
    if (campaign.budgetMode !== "abo" || campaign.objective !== "OUTCOME_SALES") fail("META_BID_STRATEGY_UNSUPPORTED", "ROAS Goal exige vendas com orçamento ABO neste fluxo.");
    if (!Number.isSafeInteger(roasFloor) || Number(roasFloor) < 1 || Number(roasFloor) > 10_000_000) fail("META_ROAS_FLOOR_REQUIRED", "Aprove um ROAS mínimo positivo em incrementos de 0,0001.");
    if (amount != null) fail("META_BID_CONFIGURATION_INVALID", "ROAS Goal usa bid_constraints; remova bid_amount.");
  } else {
    if (campaign.budgetMode !== "abo") fail("META_BID_STRATEGY_UNSUPPORTED", "Cost Cap e Bid Cap estão disponíveis apenas em ABO neste fluxo.");
    if (roasFloor != null) fail("META_BID_CONFIGURATION_INVALID", "ROAS mínimo só pode ser usado em ROAS Goal.");
    if (!Number.isSafeInteger(amount) || Number(amount) <= 0) fail("META_BID_AMOUNT_REQUIRED", "Aprove um limite de lance positivo em unidades monetárias mínimas.");
  }
  return { bid_strategy: BID_STRATEGIES[strategy as keyof typeof BID_STRATEGIES], ...(strategy === "cost_cap" || strategy === "bid_cap" ? { bid_amount: amount } : {}), ...(strategy === "min_roas" ? { bid_constraints: { roas_average_floor: roasFloor } } : {}) };
}

export function metaCampaignPayload(campaign: Json): Json {
  return { name: campaign.name, objective: campaign.objective, special_ad_categories: [], status: "PAUSED", ...metaBudget(campaign),
    ...(campaign.budgetMode === "cbo" ? { bid_strategy: "LOWEST_COST_WITHOUT_CAP" } : { is_adset_budget_sharing_enabled: false }) };
}

export function metaAdSetPayload(campaign: Json, group: Json, campaignId: unknown): Json {
  return { name: group.key, campaign_id: campaignId, ...metaDelivery(campaign), targeting: group.targeting, ...metaBudget(campaign, group),
    ...(campaign.budgetMode === "abo" ? metaBid(campaign) : {}),
    ...(campaign.budgetKind === "lifetime" ? { start_time: campaign.startTime, end_time: campaign.endTime } : {}) };
}

export function validateMetaAccountBudget(tree: Json, currency: string, minimumDaily: number): void {
  const campaign = obj(tree.campaign);
  if (obj(campaign.budget).currency !== currency) fail("BUDGET_CURRENCY_MISMATCH", "A moeda aprovada difere da moeda atual da conta Meta.");
  if (!Number.isSafeInteger(minimumDaily) || minimumDaily <= 0) fail("META_MINIMUM_BUDGET_UNAVAILABLE", "A Meta não informou um mínimo de orçamento válido para esta conta; revise a conta antes de criar ativos.");
  const days = campaign.budgetKind === "lifetime" ? Math.ceil((Date.parse(String(campaign.endTime)) - Date.parse(String(campaign.startTime))) / 86400000) : 1;
  const amounts = campaign.budgetMode === "cbo" ? [campaign.authorizedMinorUnits] : (tree.adGroups as Json[]).map(group => group.budgetMinorUnits);
  if (!Number.isFinite(days) || days <= 0 || amounts.some(amount => Number(amount) < minimumDaily * days)) fail("META_MINIMUM_BUDGET_NOT_MET", "O orçamento aprovado está abaixo do mínimo informado pela conta Meta para o período; revise e aprove um novo plano.");
}

export function validateMetaTree(tree: Json): void {
  const campaign = obj(tree.campaign);
  metaBid(campaign);
  if (Array.isArray(campaign.unsupportedConfiguration) && campaign.unsupportedConfiguration.length) fail("META_CONFIGURATION_UNSUPPORTED", `Configurações não suportadas: ${campaign.unsupportedConfiguration.join(", ")}. Revise o Master Plan antes de aprovar.`);
  if (campaign.approvedAccountId != null && campaign.approvedAccountId !== tree.accountId) fail("APPROVED_ACCOUNT_MISMATCH", "O plano deve ser compilado para a conta aprovada no briefing de anúncios.");
  metaDelivery(campaign);
  metaBudget(campaign);
  const budget = obj(campaign.budget);
  // The current compiler uses 100 minor units. Reject other currencies instead
  // of silently applying that conversion to e.g. JPY or KWD.
  if (!["BRL", "USD", "EUR", "GBP"].includes(String(budget.currency))) fail("BUDGET_CURRENCY_UNSUPPORTED", "Aprove budget.currency (BRL, USD, EUR ou GBP); outras moedas não estão implementadas neste compilador.");
  if (typeof budget.amount !== "number" || !Number.isFinite(budget.amount) || budget.amount <= 0 || Math.abs(budget.amount * 100 - Math.round(budget.amount * 100)) > 1e-8 || Math.round(budget.amount * 100) !== campaign.authorizedMinorUnits) fail("BUDGET_AUTHORIZATION_REQUIRED", "Aprove um orçamento positivo com até duas casas decimais.");
  if (campaign.budgetKind === "lifetime" && !(Date.parse(String(campaign.startTime)) < Date.parse(String(campaign.endTime)))) fail("BUDGET_SEMANTICS_REQUIRED", "Orçamento vitalício exige startTime e endTime válidos e ordenados.");
  try { if (!["https:", "http:"].includes(new URL(String(campaign.destination)).protocol)) throw new Error(); } catch { fail("DESTINATION_URL_REQUIRED", "Aprove uma URL de destino HTTP(S) válida."); }
  if (!Array.isArray(campaign.specialAdCategories) || campaign.specialAdCategories.length) fail("META_SPECIAL_CATEGORY_UNSUPPORTED", "Declare specialAdCategories: []; categorias especiais exigem um fluxo próprio ainda não suportado.");
  const groups = Array.isArray(tree.adGroups) ? tree.adGroups.map(obj) : [];
  if (!groups.length) fail("AUDIENCE_CONFIGURATION_REQUIRED", "Aprove ao menos um público geográfico.");
  let sum = 0;
  for (const group of groups) {
    metaBudget(campaign, group);
    sum += Number(group.budgetMinorUnits ?? 0);
    validateMetaTargeting(group.targeting);
    assertLifecycle(campaign.customerLifecycle, obj(group.targeting));
    const ads = Array.isArray(group.ads) ? group.ads.map(obj) : [];
    if (!ads.length) fail("CREATIVE_READINESS_REQUIRED", "Aprove ao menos um criativo por conjunto.");
    for (const ad of ads) {
      validateMetaCreative(ad.creative, campaign);
    }
  }
  if (campaign.budgetMode === "abo" && sum !== campaign.authorizedMinorUnits) fail("BUDGET_ALLOCATION_INVALID", "A soma dos conjuntos deve ser igual ao orçamento aprovado.");
}
