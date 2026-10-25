import { Router } from "express";
import { z } from "zod/v4";
import {
  GetCampaignControlRoomEvidenceQueryParams,
  GetCampaignControlRoomEvidenceResponse,
  GetCampaignControlRoomPreviewsQueryParams,
  GetCampaignControlRoomPreviewsResponse,
  GetCampaignControlRoomVersionSourcesResponse,
  GetCampaignControlRoomVersionDiffQueryParams,
  GetCampaignControlRoomVersionDiffResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../auth/auth.middleware.js";
import { createExecutionPolicy, getConditionalExecutions, revokeExecutionPolicy } from "../paid-media/conditional-execution.service.js";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  getCampaignWithAgents,
  getCampaignLiveStats,
  DIGIT_TRACK_LABELS,
  mergeIntakeDirectives,
  reorientCampaign,
} from "./campaigns.service.js";
import { getCampaignControlRoom, getCampaignControlRoomEvidence, getCampaignControlRoomPreviews, getCampaignControlRoomVersionSources, getCampaignControlRoomVersionDiff } from "./control-room.service.js";
import { triggerStrategyPhase } from "../orchestration/orchestration.service.js";
import { AppError, ValidationError } from "../../lib/errors.js";
import { db, campaignsTable, auditLogsTable, workspacesTable, masterplanVersionsTable, CAMPAIGN_CREDIT_BUFFER } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { analyzeSocialProfile } from "../agents/social-profile-analyzer.agent.js";
import { getAccountsWithAnalytics } from "../social/social.service.js";
import { determineSocialDiagnosisStatus, SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES } from "./social-diagnosis.policy.js";
import {
  getIntakeQuestions,
  validateIntakeCompleteness,
  type CampaignType as IntakeCampaignType,
  type CampaignTrack as IntakeCampaignTrack,
} from "../intake/intake.service.js";

const REORIENT_STRATEGY_COST = 45;

const router = Router();
router.use(requireAuth);

router.get("/:id/social-diagnosis", async (req, res): Promise<void> => {
  const id = String(req.params["id"]);
  const [campaign] = await db.select({ brainData: campaignsTable.brainData })
    .from(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" }); return; }
  const brain = (campaign.brainData ?? {}) as Record<string, unknown>;
  res.json({ diagnosis: brain.socialDiagnosis ?? null });
});

function cleanSocialHandle(value: string): string {
  return value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?[^/]+\//i, "").replace(/\/$/, "");
}

// A campaign-specific pre-strategy diagnosis. Public analysis is clearly labeled
// as AI-assisted; connected account metrics are included only for an exact handle match.
router.post("/:id/social-diagnosis", async (req, res): Promise<void> => {
  const id = String(req.params["id"]);
  const parsed = z.object({
    platform: z.enum(["instagram", "facebook", "tiktok"]),
    handle: z.string().min(1).max(200),
  }).safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Informe a rede e o perfil público.", code: "VALIDATION_ERROR" }); return; }

  const [campaign] = await db.select({ type: campaignsTable.type, status: campaignsTable.status, intakeData: campaignsTable.intakeData, brainData: campaignsTable.brainData })
    .from(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" }); return; }
  if (!SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES.has(campaign.type)) {
    res.status(422).json({ error: "O diagnóstico obrigatório se aplica a campanhas de lançamento e vendas com data definida.", code: "SOCIAL_DIAGNOSIS_NOT_REQUIRED" }); return;
  }
  if (campaign.status !== "intake") { res.status(409).json({ error: "O diagnóstico só pode ser gerado enquanto o briefing estiver em edição.", code: "SOCIAL_DIAGNOSIS_PHASE_CLOSED" }); return; }

  const handle = cleanSocialHandle(parsed.data.handle);
  const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const businessContext = Object.entries(intake)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, value]) => `${key}: ${String(value).slice(0, 300)}`)
    .join("\n").slice(0, 6000);
  const analysis = await analyzeSocialProfile(parsed.data.platform, handle, businessContext, req.log);
  const accounts = await getAccountsWithAnalytics(req.auth.workspaceId);
  const normalizedHandle = handle.toLowerCase().replace(/^@/, "");
  const connected = accounts.find((account) => account.provider === parsed.data.platform && account.accountName.toLowerCase().replace(/^@/, "") === normalizedHandle);
  const accountEvidence = connected ? {
    source: "connected_account_insights",
    account: connected.accountName,
    fetchedAt: new Date().toISOString(),
    followers: connected.followers,
    following: connected.following,
    mediaCount: connected.mediaCount,
    averageInteractionsRecentPosts: connected.avgEngagement,
    reachLast30Days: connected.totalReach30d,
    recentPosts: connected.recentPosts.slice(0, 9).map((post) => ({
      id: post.id, mediaType: post.mediaType, timestamp: post.timestamp,
      likes: post.likes, comments: post.comments, reach: post.reach,
      interactions: post.totalInteractions ?? null, metricsAvailable: post.metricsAvailable ?? false,
    })),
    apiError: connected.error ?? null,
  } : null;
  const hasAccountMetrics = accountEvidence != null && [accountEvidence.followers, accountEvidence.mediaCount, accountEvidence.reachLast30Days].some((value) => value != null);
  const hasCitedPublicResearch = analysis.searchSourced && analysis.sources.length > 0;
  const evidenceStatus = determineSocialDiagnosisStatus({ accountMetricsAvailable: hasAccountMetrics, citedPublicResearchAvailable: hasCitedPublicResearch });
  const diagnosis = {
    version: 1,
    status: evidenceStatus,
    platform: parsed.data.platform,
    handle,
    generatedAt: new Date().toISOString(),
    campaignContext: {
      product: intake["product.name"] ?? intake["product.nome"] ?? null,
      audience: intake["audience.description"] ?? intake["audience.profile"] ?? null,
      objective: intake["campaign.revenueTarget"] ?? intake["campaign.objective"] ?? null,
      budget: intake["campaign.budget.total"] ?? intake["campaign.budget"] ?? null,
      urgency: intake["launch.cartOpenDate"] ?? intake["campaign.durationDays"] ?? null,
    },
    accountEvidence,
    publicProfileAnalysis: {
      method: analysis.searchSourced ? "AI-assisted web search" : "AI-assisted analysis; web search unavailable",
      overview: analysis.overview,
      contentAnalysis: analysis.contentAnalysis,
      strategicAnalysis: analysis.strategicAnalysis,
      gapAnalysis: analysis.gapAnalysis,
      actionPlan: analysis.actionPlan,
      searchSourced: analysis.searchSourced,
      sources: analysis.sources,
    },
    evidenceLimitations: [
      "Análise pública assistida por IA é indicativa; valide fatos e referências antes de investir.",
      ...(accountEvidence ? [] : ["Insights oficiais da conta não foram incluídos: conecte a conta correspondente ou use esta análise pública como referência limitada."]),
      "A API não permite inferir identidade, qualidade individual de seguidores ou tamanho de públicos personalizados nesta etapa.",
      "Projeções de CPM, CPA e conversão são hipóteses de planejamento, não garantias.",
      ...(evidenceStatus === "insufficient_data" ? ["Não há métricas oficiais ou fontes públicas verificáveis suficientes para concluir o diagnóstico. Conecte o perfil correspondente ou tente novamente quando houver fontes disponíveis."] : []),
    ],
    approvedAt: null,
    approvedBy: null,
  };
  const brainData = (campaign.brainData ?? {}) as Record<string, unknown>;
  await db.update(campaignsTable).set({ brainData: { ...brainData, socialDiagnosis: diagnosis } as any, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.auth.workspaceId)));
  await db.insert(auditLogsTable).values({ workspaceId: req.auth.workspaceId, campaignId: id, action: "campaign.social_diagnosis.generated", actor: req.auth.userId, data: { platform: diagnosis.platform, handle: diagnosis.handle, status: diagnosis.status, accountMetricsIncluded: Boolean(accountEvidence), publicSearchCited: hasCitedPublicResearch } });
  res.json({ diagnosis });
});

router.post("/:id/social-diagnosis/approve", async (req, res): Promise<void> => {
  const id = String(req.params["id"]);
  const [campaign] = await db.select({ type: campaignsTable.type, status: campaignsTable.status, brainData: campaignsTable.brainData })
    .from(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" }); return; }
  if (!SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES.has(campaign.type)) { res.status(422).json({ error: "Diagnóstico não obrigatório para este tipo de campanha.", code: "SOCIAL_DIAGNOSIS_NOT_REQUIRED" }); return; }
  if (campaign.status !== "intake") { res.status(409).json({ error: "O diagnóstico só pode ser confirmado enquanto o briefing estiver em edição.", code: "SOCIAL_DIAGNOSIS_PHASE_CLOSED" }); return; }
  const brainData = (campaign.brainData ?? {}) as Record<string, unknown>;
  const current = brainData.socialDiagnosis as Record<string, unknown> | undefined;
  if (!current || current.status !== "generated") { res.status(409).json({ error: "Gere o diagnóstico antes de confirmá-lo.", code: "SOCIAL_DIAGNOSIS_MISSING" }); return; }
  const diagnosis = { ...current, status: "approved", approvedAt: new Date().toISOString(), approvedBy: req.auth.userId };
  await db.update(campaignsTable).set({ brainData: { ...brainData, socialDiagnosis: diagnosis } as any, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.auth.workspaceId)));
  await db.insert(auditLogsTable).values({ workspaceId: req.auth.workspaceId, campaignId: id, action: "campaign.social_diagnosis.approved", actor: req.auth.userId, data: { platform: current.platform, handle: current.handle } });
  res.json({ diagnosis });
});

const createCampaignSchema = z.object({
  title: z.string().min(3),
  commercialProductId: z.string().uuid(),
  commercialSubscriptionId: z.string().uuid(),
  type: z
    .enum([
      // Closed-cart / event-driven
      "launch",
      "perpetual_launch",
      "flash_sale",
      "live_sale",
      // Always-open cart / evergreen
      "continuous_sales",
      "subscription_growth",
      // Relationship / authority
      "authority",
      "audience_growth",
      "branding",
      "creator_monetization",
      // Activation / reengagement
      "upsell",
      "remarketing",
      "affiliate",
      // Expansion
      "scale",
      "regional_dominance",
      // Seed / validation launch
      "semente_launch",
    ])
    .default("launch"),
  track: z
    .enum(["six_digits", "eight_digits", "ten_digits", "not_applicable"])
    .default("six_digits"),
  locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  intakeData: z.record(z.string(), z.unknown()).default({}),
});

const statusTransitionSchema = z.object({
  status: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

function parseControlRoomEvidenceQuery(query: Record<string, unknown>) {
  const allowed = new Set(["limit", "cursor", "state", "subjectType", "subjectId", "from", "to"]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || Array.isArray(value)) {
      throw new AppError(400, "Invalid query parameters", "VALIDATION_ERROR");
    }
  }
  const parsed = GetCampaignControlRoomEvidenceQueryParams.safeParse({
    ...query,
    from: typeof query["from"] === "string" ? new Date(query["from"]) : query["from"],
    to: typeof query["to"] === "string" ? new Date(query["to"]) : query["to"],
  });
  if (!parsed.success) throw new AppError(400, parsed.error.message, "VALIDATION_ERROR");
  if (!Number.isInteger(parsed.data.limit)) {
    throw new AppError(400, "limit must be an integer", "VALIDATION_ERROR");
  }
  if (parsed.data.from && parsed.data.to && parsed.data.from >= parsed.data.to) {
    throw new AppError(400, "from must be before to", "VALIDATION_ERROR");
  }
  return {
    ...parsed.data,
    from: parsed.data.from?.toISOString(),
    to: parsed.data.to?.toISOString(),
  };
}

function parseControlRoomPreviewsQuery(query: Record<string, unknown>) {
  const allowed = new Set(["limit", "cursor", "kind", "status", "updatedFrom", "updatedTo"]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || Array.isArray(value)) throw new AppError(400, "Invalid query parameters", "VALIDATION_ERROR");
  }
  const parsed = GetCampaignControlRoomPreviewsQueryParams.safeParse({
    ...query,
    updatedFrom: typeof query["updatedFrom"] === "string" ? new Date(query["updatedFrom"]) : query["updatedFrom"],
    updatedTo: typeof query["updatedTo"] === "string" ? new Date(query["updatedTo"]) : query["updatedTo"],
  });
  if (!parsed.success) throw new AppError(400, parsed.error.message, "VALIDATION_ERROR");
  if (!Number.isInteger(parsed.data.limit)) throw new AppError(400, "limit must be an integer", "VALIDATION_ERROR");
  if (parsed.data.updatedFrom && parsed.data.updatedTo && parsed.data.updatedFrom >= parsed.data.updatedTo) throw new AppError(400, "updatedFrom must be before updatedTo", "VALIDATION_ERROR");
  return { ...parsed.data, updatedFrom: parsed.data.updatedFrom?.toISOString(), updatedTo: parsed.data.updatedTo?.toISOString() };
}

router.get("/tracks", (_req, res): void => {
  res.json({ tracks: DIGIT_TRACK_LABELS });
});

router.get("/", async (req, res): Promise<void> => {
  const campaigns = await listCampaigns(req.auth.workspaceId);

  // Attach real intake completeness for campaigns still in `intake` status —
  // the list card must show the SAME percentage as the intake page itself.
  // (Pipeline-stage progress, i.e. "intake is step 2 of 10", is a different
  // metric and must never be labeled "completude"/"%" the same way — see
  // replit.md Gotchas: intake completeness coherence.)
  const enriched = campaigns.map((campaign) => {
    if (campaign.status !== "intake") return campaign;
    const type = (campaign.type ?? "launch") as IntakeCampaignType;
    const track = (campaign.track ?? "six_digits") as IntakeCampaignTrack;
    const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const questions = getIntakeQuestions(type, track);
    const totalRequired = questions.filter((q) => q.required).length;
    const completeness = validateIntakeCompleteness(type, track, intakeData);
    const answeredRequired = totalRequired - completeness.missingRequired.length;
    const intakePercentage = totalRequired > 0
      ? Math.round((answeredRequired / totalRequired) * 100)
      : 100;
    return { ...campaign, intakeCompleteness: { answeredRequired, totalRequired, percentage: intakePercentage } };
  });

  res.json({ campaigns: enriched });
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await createCampaign(req.auth.workspaceId, parsed.data, req.log, req.auth.userId);
    res.status(201).json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/:id/duplicate", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
  try {
    const source = await getCampaign(id, req.auth.workspaceId);
    const [approvedMasterplan] = await db
      .select({ id: masterplanVersionsTable.id })
      .from(masterplanVersionsTable)
      .where(and(
        eq(masterplanVersionsTable.campaignId, id),
        eq(masterplanVersionsTable.workspaceId, req.auth.workspaceId),
        isNotNull(masterplanVersionsTable.approvedAt),
      ))
      .limit(1);

    if (!approvedMasterplan) {
      res.status(409).json({ error: "Só é possível criar uma cópia depois da aprovação do Master Plan.", code: "MASTERPLAN_NOT_APPROVED" });
      return;
    }
    if (!source.commercialProductId || !source.commercialSubscriptionId) {
      res.status(409).json({ error: "A campanha não possui um produto e uma assinatura ativos para criar outra campanha.", code: "CAMPAIGN_SUBSCRIPTION_REQUIRED" });
      return;
    }

    const sourceIntake = (source.intakeData ?? {}) as Record<string, unknown>;
    const copiedIntake = Object.fromEntries(
      Object.entries(sourceIntake).filter(([key]) => !["_conversationHistory", "_intakeChatComplete", "_psychologicalProfile"].includes(key)),
    );
    const campaign = await createCampaign(req.auth.workspaceId, {
      title: `${source.title} — revisão`,
      type: source.type as typeof createCampaignSchema.shape.type._output,
      track: source.track as typeof createCampaignSchema.shape.track._output,
      locale: source.locale as typeof createCampaignSchema.shape.locale._output,
      commercialProductId: source.commercialProductId,
      commercialSubscriptionId: source.commercialSubscriptionId,
      intakeData: copiedIntake,
    }, req.log, req.auth.userId);

    res.status(201).json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { campaign, agents, checkpoints } = await getCampaignWithAgents(
      id,
      req.auth.workspaceId,
    );
    res.json({ campaign, agents, checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/live-stats", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const stats = await getCampaignLiveStats(id!, req.auth.workspaceId);
    res.json({ liveStats: stats });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/control-room", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    res.json(await getCampaignControlRoom(id!, req.auth.workspaceId));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/control-room/execution-policy", async (req, res, next): Promise<void> => {
  try { res.json(await getConditionalExecutions(req.auth.workspaceId, req.params["id"])); } catch (e) { next(e); }
});
router.post("/:id/control-room/execution-policy", async (req, res, next): Promise<void> => {
  try { res.status(201).json(await createExecutionPolicy(req.auth.workspaceId, req.auth.userId, req.params["id"], req.body)); } catch (e) { next(e); }
});
router.post("/:id/control-room/execution-policy/:version/revoke", async (req, res, next): Promise<void> => {
  try { res.json({ policy: await revokeExecutionPolicy(req.auth.workspaceId, req.auth.userId, req.params["id"], Number(req.params["version"])) }); } catch (e) { next(e); }
});
router.get("/:id/control-room/conditional-executions", async (req, res, next): Promise<void> => {
  try { res.json(await getConditionalExecutions(req.auth.workspaceId, req.params["id"])); } catch (e) { next(e); }
});

router.get("/:id/control-room/evidence", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const filters = parseControlRoomEvidenceQuery(req.query as Record<string, unknown>);
    const result = await getCampaignControlRoomEvidence(id!, req.auth.workspaceId, filters);
    res.json(GetCampaignControlRoomEvidenceResponse.parse(result));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/control-room/previews", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const filters = parseControlRoomPreviewsQuery(req.query as Record<string, unknown>);
    const result = await getCampaignControlRoomPreviews(id!, req.auth.workspaceId, filters);
    res.json(GetCampaignControlRoomPreviewsResponse.parse(result));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/control-room/version-sources", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try { res.json(GetCampaignControlRoomVersionSourcesResponse.parse(await getCampaignControlRoomVersionSources(id!, req.auth.workspaceId))); }
  catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});

router.get("/:id/control-room/version-diff", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const q = req.query as Record<string, unknown>;
    const allowed = new Set(["resource", "sourceId", "baseId", "targetId", "maxChanges"]);
    if (Object.keys(q).some(key => !allowed.has(key)) || Object.values(q).some(value => Array.isArray(value))) throw new ValidationError("Invalid diff parameters");
    const one = (key: string) => typeof q[key] === "string" ? q[key] as string : undefined;
    let parsed: ReturnType<typeof GetCampaignControlRoomVersionDiffQueryParams.parse>;
    try { parsed = GetCampaignControlRoomVersionDiffQueryParams.parse(req.query); } catch { throw new ValidationError("Invalid diff parameters"); }
    const resource = parsed.resource;
    const maxChanges = parsed.maxChanges;
    if ((resource !== "masterplan" && resource !== "page") || !one("baseId") || !one("targetId") || !Number.isInteger(maxChanges) || maxChanges < 1 || maxChanges > 1000) throw new ValidationError("Invalid diff parameters");
    res.json(GetCampaignControlRoomVersionDiffResponse.parse(await getCampaignControlRoomVersionDiff(id!, req.auth.workspaceId, { resource, sourceId: parsed.sourceId, baseId: parsed.baseId, targetId: parsed.targetId, maxChanges })));
  } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});

router.post("/:id/reorient", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const directive = req.body?.directive as string | undefined;
  if (!directive || typeof directive !== "string" || directive.trim().length < 10) {
    res.status(400).json({ error: "directive deve ter ao menos 10 caracteres", code: "VALIDATION_ERROR" });
    return;
  }
  try {
    // Pre-flight credit check — strategy phase costs 45 cr + buffer
    const [workspace] = await db
      .select({ balance: workspacesTable.creditsBalance })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId))
      .limit(1);

    const balance = workspace?.balance ?? 0;
    const required = REORIENT_STRATEGY_COST + CAMPAIGN_CREDIT_BUFFER;
    if (balance < required) {
      const shortage = required - balance;
      res.status(402).json({
        error:
          `Créditos insuficientes para reconstruir a estratégia. ` +
          `Saldo atual: ${balance} cr. Necessário: ${required} cr (${REORIENT_STRATEGY_COST} para análise + ${CAMPAIGN_CREDIT_BUFFER} de reserva). ` +
          `Adquira mais ${shortage} crédito${shortage !== 1 ? "s" : ""} para continuar.`,
        code: "INSUFFICIENT_CREDITS",
        data: { balance, required, shortage },
      });
      return;
    }

    await reorientCampaign(id, req.auth.workspaceId, directive.trim(), req.log);
    setImmediate(() =>
      triggerStrategyPhase(id, req.auth.workspaceId, req.log).catch((err) =>
        req.log.warn({ err, campaignId: id }, "Failed to trigger strategy after reorient"),
      ),
    );
    res.json({ ok: true, status: "analyzing" });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.patch("/:id/directives", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const directives = req.body?.directives as Record<string, string> | undefined;
  if (!directives || typeof directives !== "object") {
    res.status(400).json({ error: "directives object required", code: "VALIDATION_ERROR" });
    return;
  }
  try {
    const campaign = await mergeIntakeDirectives(id, req.auth.workspaceId, directives, req.log);
    res.json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.patch("/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const parsed = statusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    if (["analyzing", "strategy_ready", "generating", "compliance_review", "awaiting_approval", "executing", "live"].includes(parsed.data.status)) {
      throw new AppError(
        409,
        `Status "${parsed.data.status}" pertence ao motor de execução. Use POST /campaigns/${id}/execute.`,
        "EXECUTION_STATUS_REQUIRES_EXECUTE_ENDPOINT",
      );
    }
    const campaign = await updateCampaignStatus(
      id,
      req.auth.workspaceId,
      parsed.data.status,
      req.log,
      parsed.data.data,
    );
    res.json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:id/launch-financials — Plano financeiro e de mídia para pré-lançamento
router.get("/:id/launch-financials", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { getLaunchFinancials } = await import("./campaigns.service.js");
    const financials = await getLaunchFinancials(id!, req.auth.workspaceId);
    res.json({ financials });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:id/credit-stats — per-campaign credit + token usage
router.get("/:id/credit-stats", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const { db: _db, creditTransactionsTable, aiProviderLogsTable, campaignsTable: ct } = await import("@workspace/db");
  const { eq: _eq, and: _and, sum, count } = await import("drizzle-orm");

  // Verify ownership
  const [campaign] = await _db.select({ id: ct.id, creditsCost: ct.creditsCost })
    .from(ct)
    .where(_and(_eq(ct.id, id), _eq(ct.workspaceId, req.auth.workspaceId)))
    .limit(1);
  if (!campaign) { res.status(404).json({ error: "Campanha não encontrada" }); return; }

  // Token + cost breakdown from AI logs
  const aiRows = await _db.select({
    provider: aiProviderLogsTable.provider,
    model: aiProviderLogsTable.model,
    agentType: aiProviderLogsTable.agentType,
    totalCredits: sum(aiProviderLogsTable.creditsCharged).mapWith(Number),
    totalTokens: sum(aiProviderLogsTable.totalTokens).mapWith(Number),
    totalCostUsd: sum(aiProviderLogsTable.costUsd).mapWith(Number),
    calls: count(),
  })
    .from(aiProviderLogsTable)
    .where(_and(_eq(aiProviderLogsTable.campaignId, id), _eq(aiProviderLogsTable.workspaceId, req.auth.workspaceId)))
    .groupBy(aiProviderLogsTable.provider, aiProviderLogsTable.model, aiProviderLogsTable.agentType);

  const totalCredits = aiRows.reduce((s, r) => s + (r.totalCredits ?? 0), 0);
  const totalTokens  = aiRows.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
  const totalCostUsd = aiRows.reduce((s, r) => s + (r.totalCostUsd ?? 0), 0);
  const totalCalls   = aiRows.reduce((s, r) => s + Number(r.calls ?? 0), 0);

  res.json({
    campaignId: id,
    creditsCost: campaign.creditsCost,
    totalCredits,
    totalTokens,
    totalCostUsd,
    totalCalls,
    byAgent: aiRows
      .map(r => ({
        agentType: r.agentType ?? "desconhecido",
        provider: r.provider,
        model: r.model,
        credits: r.totalCredits ?? 0,
        tokens: r.totalTokens ?? 0,
        costUsd: r.totalCostUsd ?? 0,
        calls: r.calls,
      }))
      .sort((a, b) => b.credits - a.credits),
  });
});

// GET /campaigns/:id/decision-trace — Arquiteto mode explainability
router.get("/:id/decision-trace", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { getDecisionTrace } = await import("../campaign-brain/decision-trace.service.js");
    const trace = await getDecisionTrace(id, req.auth.workspaceId);
    res.json({ trace });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
