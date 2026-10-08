import { requirePlatformAdmin } from "../admin/admin.middleware.js";
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { acknowledgeAlert, aggregateAudienceSegment, campaignOwned, createCompetitor, createVerifiedEvidence, finishMonitorRun, getRegionalProfile, listAlerts, listAudienceOpportunities, listAudienceSegments, listCompetitors, listMonitorRuns, listObservations, listPublicInteractionSignals, listVerifiedEvidence, promoteSignalToAudienceOpportunity, recordObservation, startMonitorRun, transitionAudienceOpportunity, upsertPublicInteractionSignal, upsertRegionalProfile } from "./regional-intelligence.service.js";
import { acquireCampaignRegionalIntel, regionalAcquisitionHealth } from "./regional-acquisition.service.js";
import { RADAR_CATALOG, activateRadarEntitlement, createRadarCheckout, getRadarPayment, radarUsageSummary, requestRadarPurchase, selectNoRadar } from "./radar-entitlements.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);
const campaign = z.string().uuid();
const json = z.record(z.string(), z.unknown());
const evidenceSchema = z.object({ competitorId: z.string().uuid().optional(), url: z.string().url().max(4000), title: z.string().max(1000).optional(), sourceType: z.string().max(100).optional(), claim: z.string().min(1).max(10000), payload: json.optional(), observedAt: z.coerce.date().optional() });
const pageLimit = (value: unknown) => Math.min(Math.max(Number(value) || 50, 1), 100);
const entitlementError = (res: import("express").Response, error: unknown, fallback: string, status = 400) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message, code: error.code, details: error.data });
  return res.status(status).json({ error: error instanceof Error ? error.message : fallback, code: "RADAR_OPERATION_FAILED" });
};

// Radar uses a pending-sales request because the existing billing provider only sells
// platform plans/credit packs; this endpoint never represents payment as completed.
router.get("/catalog", (_req, res) => res.json({ packages: Object.values(RADAR_CATALOG) }));
router.get("/entitlement", async (req, res) => res.json(await radarUsageSummary(req.auth.workspaceId)));
router.post("/purchase-requests", async (req, res) => {
  const parsed = z.object({ package: z.enum(["RADAR_ESSENTIAL", "RADAR_PRO", "RADAR_SCALE", "WAR_ROOM"]), currency: z.enum(["BRL", "USD"]).default("BRL"), idempotencyKey: z.string().min(8).max(200), notes: z.string().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Solicitação comercial Radar inválida.", code: "VALIDATION_ERROR" });
  const result = await requestRadarPurchase(req.auth.workspaceId, req.auth.userId, parsed.data.package, parsed.data.currency, parsed.data.idempotencyKey, parsed.data.notes);
  res.status(result.deduplicated ? 200 : 202).json({ ...result, payment: "pending_sales", message: "Solicitação registrada. A ativação ocorre somente após confirmação comercial." });
});
router.post("/checkout", async (req, res): Promise<void> => {
  const parsed = z.object({
    package: z.enum(["RADAR_ESSENTIAL", "RADAR_PRO", "RADAR_SCALE", "WAR_ROOM"]),
    currency: z.literal("BRL"),
    method: z.enum(["pix", "boleto"]),
    idempotencyKey: z.string().min(8).max(200),
    campaignId: z.string().uuid().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Checkout Radar inválido.", code: "VALIDATION_ERROR" }); return; }
  if (parsed.data.package === "WAR_ROOM" && !parsed.data.campaignId) {
    res.status(400).json({ error: "War Room exige a campanha da janela de lançamento.", code: "CAMPAIGN_REQUIRED" }); return;
  }
  if (parsed.data.package === "WAR_ROOM" && !await campaignOwned(req.auth.workspaceId, parsed.data.campaignId!)) {
    res.status(404).json({ error: "Campanha não encontrada.", code: "CAMPAIGN_NOT_FOUND" }); return;
  }
  try {
    const order = await createRadarCheckout({
      workspaceId: req.auth.workspaceId, userId: req.auth.userId, userName: req.auth.email, userEmail: req.auth.email,
      pkg: parsed.data.package, method: parsed.data.method, idempotencyKey: parsed.data.idempotencyKey, campaignId: parsed.data.campaignId,
    });
    const provider = order.providerData as { pixData?: unknown; boletoData?: unknown };
    res.status(201).json({ payment: { ...order, ...provider, fulfillmentStatus: order.status } });
  } catch (error) { entitlementError(res, error, "Não foi possível criar o checkout Asaas.", 502); }
});
router.get("/payments/:paymentId", async (req, res): Promise<void> => {
  const id = z.string().uuid().safeParse(req.params["paymentId"]);
  if (!id.success) { res.status(400).json({ error: "paymentId inválido.", code: "VALIDATION_ERROR" }); return; }
  const order = await getRadarPayment(req.auth.workspaceId, id.data);
  if (!order) { res.status(404).json({ error: "Pagamento Radar não encontrado.", code: "NOT_FOUND" }); return; }
  const provider = order.providerData as { pixData?: unknown; boletoData?: unknown };
  res.json({ payment: { ...order, ...provider, fulfillmentStatus: order.status }, fulfillmentStatus: order.status });
});
router.post("/no-radar", async (req, res): Promise<void> => {
  const parsed = z.object({ idempotencyKey: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Escolha No Radar inválida.", code: "VALIDATION_ERROR" }); return; }
  const choice = await selectNoRadar(req.auth.workspaceId, req.auth.userId, parsed.data.idempotencyKey);
  res.status(201).json({ choice });
});
router.post("/entitlement/admin-activate", requirePlatformAdmin, async (req, res) => {
  const parsed = z.object({ package: z.enum(["RADAR_ESSENTIAL", "RADAR_PRO", "RADAR_SCALE", "WAR_ROOM"]), currency: z.enum(["BRL", "USD"]).default("BRL") }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Ativação Radar inválida.", code: "VALIDATION_ERROR" });
  res.status(201).json({ entitlement: await activateRadarEntitlement(req.auth.workspaceId, parsed.data.package, parsed.data.currency, req.auth.userId) });
});

router.get("/acquisition/health", (_req, res) => res.json({ scheduler: regionalAcquisitionHealth(), paused: process.env["REGIONAL_INTEL_ACQUISITION_PAUSED"] === "true" }));
router.post("/campaigns/:campaignId/acquisition/run-now", async (req, res) => {
  const parsed = z.object({ mode: z.enum(["lightweight", "detailed"]).default("detailed"), idempotencyKey: z.string().min(8).max(200).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Solicitação de aquisição inválida." });
  try {
    const key = parsed.data.idempotencyKey ?? `manual:${parsed.data.mode}:${new Date().toISOString().slice(0, 13)}`;
    res.status(202).json(await acquireCampaignRegionalIntel(req.auth.workspaceId, req.params.campaignId, parsed.data.mode, key));
  } catch (e) { entitlementError(res, e, "Aquisição indisponível.", 503); }
});

router.get("/campaigns/:campaignId/config", async (req, res) => {
  const parsed = campaign.safeParse(req.params.campaignId); if (!parsed.success) return void res.status(400).json({ error: "campaignId inválido." });
  try { res.json({ profile: await getRegionalProfile(req.auth.workspaceId, parsed.data) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); }
});
router.put("/campaigns/:campaignId/config", async (req, res) => {
  const parsed = z.object({ region: z.string().min(2).max(500), locale: z.string().min(2).max(20).default("pt-BR"), config: json.default({}), countryCode: z.string().length(2).optional(), subdivision: z.string().max(200).optional(), city: z.string().max(200).optional(), postalCode: z.string().max(30).optional(), address: json.optional(), timezone: z.string().max(100).optional(), languages: z.array(z.string().min(2).max(20)).max(20).optional(), operatingRegions: z.array(json).max(100).optional(), residenceRegion: json.optional(), serviceRegion: json.optional(), geoProvenance: json.optional(), geoConfidence: z.number().int().min(0).max(100).optional(), referralGeography: z.object({ origin: json, destination: json }).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Configuração regional inválida." });
  try { const { region, locale, config, referralGeography, ...geo } = parsed.data; res.json({ profile: await upsertRegionalProfile(req.auth.workspaceId, req.params.campaignId, region, locale, { ...config, referralGeography: referralGeography ?? config["referralGeography"] }, geo) }); } catch (e) { entitlementError(res, e, "Configuração regional inválida."); }
});
router.get("/campaigns/:campaignId/competitors", async (req, res) => { try { res.json({ competitors: await listCompetitors(req.auth.workspaceId, req.params.campaignId) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/competitors", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(500), kind: z.enum(["direct", "indirect", "substitute", "aspirational", "emerging"]), websiteUrl: z.string().url().max(4000).optional(), notes: z.string().max(5000).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Concorrente inválido." });
  try { res.status(201).json({ competitor: await createCompetitor(req.auth.workspaceId, req.params.campaignId, parsed.data) }); } catch (e) { entitlementError(res, e, "Não foi possível criar concorrente.", 409); }
});
router.post("/campaigns/:campaignId/evidence", async (req, res) => {
  const parsed = evidenceSchema.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: "Evidência pública verificada inválida." });
  try { res.status(201).json(await createVerifiedEvidence(req.auth.workspaceId, req.params.campaignId, { ...parsed.data, observedAt: parsed.data.observedAt ?? new Date() })); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Evidência inválida." }); }
});
router.get("/campaigns/:campaignId/evidence", async (req, res) => { try { res.json({ evidence: await listVerifiedEvidence(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/observations", async (req, res) => {
  const parsed = z.object({ competitorId: z.string().uuid(), evidenceId: z.string().uuid(), facts: json, observedAt: z.coerce.date().optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Observação inválida." });
  try { res.status(201).json(await recordObservation(req.auth.workspaceId, req.params.campaignId, { ...parsed.data, observedAt: parsed.data.observedAt ?? new Date() })); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Observação inválida." }); }
});
router.get("/campaigns/:campaignId/observations", async (req, res) => { try { res.json({ observations: await listObservations(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/runs", async (req, res) => {
  const parsed = z.object({ idempotencyKey: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "idempotencyKey inválida." });
  try { res.status(202).json({ run: await startMonitorRun(req.auth.workspaceId, req.params.campaignId, parsed.data.idempotencyKey), acquisition: "manual_verified_evidence_only" }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); }
});
router.get("/campaigns/:campaignId/runs", async (req, res) => { try { res.json({ runs: await listMonitorRuns(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/runs/:runId/finish", async (req, res) => {
  const parsed = z.object({ status: z.enum(["completed", "failed"]), summary: json.default({}), error: z.string().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Finalização de monitoramento inválida." });
  const run = await finishMonitorRun(req.auth.workspaceId, req.params.runId, parsed.data.status, parsed.data.summary, parsed.data.error);
  if (!run) return void res.status(404).json({ error: "Execução não encontrada." });
  res.json({ run });
});
router.get("/campaigns/:campaignId/alerts", async (req, res) => { try { res.json({ alerts: await listAlerts(req.auth.workspaceId, req.params.campaignId) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/alerts/:alertId/acknowledge", async (req, res) => {
  const alert = await acknowledgeAlert(req.auth.workspaceId, req.params.alertId, req.auth.userId);
  if (!alert) return void res.status(404).json({ error: "Alerta não encontrado." });
  res.json({ alert });
});
const signalSchema = z.object({
  platform: z.string().min(1).max(100), publicAccountRef: z.string().max(300).optional(), displayName: z.string().max(300).optional(),
  sourceUrl: z.string().url().max(4000), postRef: z.string().max(500).optional(), interactionType: z.string().min(1).max(100),
  publicTextExcerpt: z.string().max(2000).optional(), occurredAt: z.coerce.date(), sentiment: z.string().max(100).optional(),
  intent: z.string().max(100).optional(), confidence: z.number().int().min(0).max(100).optional(), regionInference: z.string().max(500).optional(),
  regionProvenance: json.optional(), lawfulBasisStatus: z.enum(["unknown", "not_permitted", "permitted", "opted_out"]).optional(),
  sensitiveDataExcluded: z.literal(true),
});
router.get("/campaigns/:campaignId/signals", async (req, res) => { try { res.json({ signals: await listPublicInteractionSignals(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/signals", async (req, res) => {
  const parsed = signalSchema.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: "Sinal público inválido ou contém dados não permitidos." });
  try { res.status(201).json(await upsertPublicInteractionSignal(req.auth.workspaceId, req.params.campaignId, parsed.data)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Sinal público inválido." }); }
});
router.get("/campaigns/:campaignId/opportunities", async (req, res) => { try { res.json({ opportunities: await listAudienceOpportunities(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/signals/:signalId/promote", async (req, res) => {
  const parsed = z.object({ opportunityType: z.string().min(1).max(100), summary: z.string().min(1).max(2000), attributes: json.optional(), interestTopic: z.string().max(300).optional(), competitorId: z.string().uuid().optional(), crossPlatformIdentityHint: z.string().min(3).max(500).optional(), contactPhoneE164: z.string().max(30).optional(), processingPurpose: z.string().max(300).optional(), lawfulBasis: z.enum(["unknown", "not_permitted", "permitted", "opted_out"]).optional(), consentSource: z.string().max(300).optional(), consentedAt: z.coerce.date().optional(), jurisdictionCodes: z.array(z.string().length(2)).max(20).optional(), retentionUntil: z.coerce.date().optional(), deletionState: z.enum(["active", "opted_out", "pending_deletion", "deleted"]).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Oportunidade inválida." });
  try { res.status(201).json(await promoteSignalToAudienceOpportunity(req.auth.workspaceId, req.params.campaignId, req.params.signalId, parsed.data.opportunityType, parsed.data.summary, parsed.data.attributes ?? {}, parsed.data)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Oportunidade inválida." }); }
});
router.post("/opportunities/:opportunityId/lifecycle", async (req, res) => {
  const parsed = z.object({ lifecycle: z.enum(["observed", "qualified", "ready_for_activation", "activated", "converted", "discarded"]) }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Transição inválida." });
  try {
    const opportunity = await transitionAudienceOpportunity(req.auth.workspaceId, req.params.opportunityId, parsed.data.lifecycle);
    if (!opportunity) return void res.status(404).json({ error: "Oportunidade não encontrada." });
    res.json({ opportunity, activation: "future_contract_only_no_contact_sent" });
  } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Transição bloqueada." }); }
});
router.get("/campaigns/:campaignId/segments", async (req, res) => { try { res.json({ segments: await listAudienceSegments(req.auth.workspaceId, req.params.campaignId, pageLimit(req.query["limit"])) }); } catch { res.status(404).json({ error: "Campanha não encontrada." }); } });
router.post("/campaigns/:campaignId/segments/aggregate", async (req, res) => {
  const parsed = z.object({ label: z.string().min(1).max(300), dimensions: json }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Segmento inválido." });
  try { res.status(201).json({ segment: await aggregateAudienceSegment(req.auth.workspaceId, req.params.campaignId, parsed.data.label, parsed.data.dimensions) }); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Segmento inválido." }); }
});
export default router;