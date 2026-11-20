import { AppError } from "../../lib/errors.js";
type Json = Record<string, unknown>;
export const ttObject = (v: unknown): Json => v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new AppError(422, message, "TIKTOK_CONFIGURATION_INVALID"); }
export function validateTikTokTree(tree: Json, now = new Date()) {
  const c = ttObject(tree.campaign), budget = ttObject(c.budget);
  requireValue(["TRAFFIC", "WEB_CONVERSIONS"].includes(String(c.objective)), "TikTok: selecione TRAFFIC ou WEB_CONVERSIONS explicitamente.");
  requireValue(c.destinationType === "WEBSITE" && /^https:\/\//.test(String(c.destination)), "TikTok: destino HTTPS do tipo WEBSITE obrigatório.");
  requireValue(c.bidStrategy === "lowest_cost", "TikTok: somente o lance lowest_cost está habilitado neste fluxo.");
  requireValue(!c.catalog && !c.customerLifecycle && c.bidAmountMinorUnits == null && c.roasFloorBasisPoints == null && (!Array.isArray(c.specialAdCategories) || c.specialAdCategories.length === 0), "TikTok: catálogo, categoria especial e controles avançados exigem outro fluxo de aprovação.");
  requireValue(!c.approvedAccountId || c.approvedAccountId === tree.accountId, "TikTok: conta difere da aprovada no Master Plan.");
  requireValue(c.optimizationGoal == null || c.optimizationGoal === (c.objective === "TRAFFIC" ? "CLICK" : "CONVERT"), "TikTok: meta de otimização não corresponde ao objetivo aprovado.");
  requireValue(["abo", "cbo"].includes(String(c.budgetMode)), "TikTok: defina o modo de orçamento aprovado.");
  requireValue(typeof budget.amount === "number" && Number.isFinite(budget.amount) && budget.amount > 0 && ["daily", "lifetime"].includes(String(c.budgetKind)), "TikTok: orçamento aprovado obrigatório.");
  requireValue(Number.isFinite(Date.parse(String(c.startTime))) && Number.isFinite(Date.parse(String(c.endTime))) && Date.parse(String(c.startTime)) < Date.parse(String(c.endTime)), "TikTok: informe início e fim explícitos com fuso horário.");
  requireValue([c.startTime, c.endTime].every(value => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)), "TikTok: datas precisam declarar fuso horário.");
  if (c.objective === "WEB_CONVERSIONS") {
    requireValue(now.getTime() < Date.parse("2027-01-01T00:00:00Z") && Date.parse(String(c.startTime)) < Date.parse("2027-01-01T00:00:00Z"), "TikTok: este objetivo exige Upgraded Smart+ a partir de janeiro de 2027.");
    const tracking = ttObject(c.tracking);
    requireValue(tracking.pixelId && tracking.conversionEvent, "TikTok: pixel e evento de otimização obrigatórios.");
  }
  requireValue(!Array.isArray(c.unsupportedConfiguration) || c.unsupportedConfiguration.length === 0, "TikTok: plano contém configurações não suportadas.");
  requireValue(Array.isArray(tree.adGroups) && tree.adGroups.length > 0, "TikTok: grupo de anúncios obrigatório.");
  let total = 0;
  for (const raw of tree.adGroups) {
    const group = ttObject(raw), targeting = ttObject(group.targeting);
    const allowed = ["location_ids", "age_groups", "gender", "languages", "interest_category_ids", "audience_ids", "excluded_audience_ids", "operating_systems"];
    requireValue(Object.keys(targeting).every(key => allowed.includes(key)), "TikTok: público deve usar campos nativos suportados; nenhuma segmentação será descartada.");
    requireValue(Array.isArray(targeting.location_ids) && targeting.location_ids.length > 0, "TikTok: location_ids obrigatório no público aprovado.");
    if (c.budgetMode === "abo") { requireValue(Number.isSafeInteger(group.budgetMinorUnits) && Number(group.budgetMinorUnits) > 0, "TikTok: orçamento do grupo obrigatório."); total += Number(group.budgetMinorUnits); }
    requireValue(Array.isArray(group.ads) && group.ads.length > 0, "TikTok: cada grupo precisa de anúncio.");
    for (const rawAd of group.ads) {
      const ad = ttObject(rawAd), creative = ttObject(ad.creative);
      requireValue(ad.destination === c.destination, "TikTok: destino do anúncio difere da aprovação.");
      requireValue(creative.videoId && creative.identityId && creative.identityType && creative.adText && creative.callToAction, "TikTok: vídeo, identidade, texto e CTA aprovados são obrigatórios.");
      requireValue(Array.isArray(creative.imageIds) && creative.imageIds.length > 0, "TikTok: informe a capa do vídeo (imageIds).");
    }
  }
  if (c.budgetMode === "abo") requireValue(total === Number(c.authorizedMinorUnits), "TikTok: soma dos grupos difere da verba aprovada.");
}
export function tikTokCampaignPayload(c: Json): Json {
  return { campaign_name: c.name, objective_type: c.objective, budget_optimize_on: c.budgetMode === "cbo", budget_mode: c.budgetMode === "abo" ? "BUDGET_MODE_INFINITE" : c.budgetKind === "daily" ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL", ...(c.budgetMode === "cbo" ? { budget: Number(c.authorizedMinorUnits) / 100 } : {}), operation_status: "DISABLE" };
}
export function tikTokGroupPayload(c: Json, group: Json, campaignId?: string): Json {
  const tracking = ttObject(c.tracking);
  const utc = (value: unknown) => new Date(String(value)).toISOString().slice(0, 19).replace("T", " ");
  return { ...ttObject(group.targeting), campaign_id: campaignId, adgroup_name: group.key, promotion_type: "WEBSITE", placement_type: "PLACEMENT_TYPE_NORMAL", placements: ["PLACEMENT_TIKTOK"], ...(c.budgetMode === "abo" ? { budget_mode: c.budgetKind === "daily" ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL", budget: Number(group.budgetMinorUnits) / 100 } : {}), schedule_type: "SCHEDULE_START_END", schedule_start_time: utc(c.startTime), schedule_end_time: utc(c.endTime), optimization_goal: c.objective === "TRAFFIC" ? "CLICK" : "CONVERT", billing_event: c.objective === "TRAFFIC" ? "CPC" : "OCPM", bid_type: "BID_TYPE_NO_BID", pacing: "PACING_MODE_SMOOTH", ...(c.objective === "WEB_CONVERSIONS" ? { pixel_id: tracking.pixelId, optimization_event: tracking.conversionEvent } : {}), operation_status: "DISABLE" };
}
export function tikTokAdPayload(ad: Json, adgroupId?: string): Json {
  const c = ttObject(ad.creative);
  return { adgroup_id: adgroupId, creatives: [{ ad_name: ad.key, ad_format: "SINGLE_VIDEO", video_id: c.videoId, image_ids: c.imageIds, identity_type: c.identityType, identity_id: c.identityId, ...(c.identityAuthorizedBcId ? { identity_authorized_bc_id: c.identityAuthorizedBcId } : {}), ad_text: c.adText, call_to_action: c.callToAction, landing_page_url: ad.destination, operation_status: "DISABLE" }] };
}
export function validateTikTokReadback(type: string, id: string, row: Json, payload: Json) {
  const prefix = type === "ad_set" ? "adgroup" : type;
  requireValue(String(row[`${prefix}_id`] ?? "") === id && row.operation_status === "DISABLE", "TikTok: criação pausada não confirmada pelo provedor.");
  const expected = type === "ad" ? ttObject((payload.creatives as Json[] | undefined)?.[0]) : payload;
  for (const [key, value] of Object.entries(expected)) {
    if (["operation_status", "advertiser_id"].includes(key) || value == null) continue;
    const actual = row[key];
    if (key === "budget") requireValue(Math.round(Number(actual) * 100) === Math.round(Number(value) * 100), "TikTok: orçamento confirmado difere da aprovação.");
    else requireValue(JSON.stringify(actual) === JSON.stringify(value), `TikTok: ${key} confirmado difere da aprovação.`);
  }
  if (payload.adgroup_id) requireValue(row.adgroup_id === payload.adgroup_id, "TikTok: vínculo do anúncio ao grupo incorreto.");
}
