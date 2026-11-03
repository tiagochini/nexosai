import { isPlatformAdmin } from "../admin/admin-access.js";
import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { runCrossAgentValidation } from "../campaign-brain/cross-validation.service.js";
import {
  getExecutionStatus,
  triggerStrategyPhase,
  triggerContentPhase,
  triggerExecutionPhase,
  triggerMonitor,
} from "./orchestration.service.js";
import { AppError } from "../../lib/errors.js";
import {
  db,
  campaignsTable,
  masterplanVersionsTable,
  workspacesTable,
  workspaceIntegrationsTable,
  contentPiecesTable,
  pagesTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, and, inArray, ne, count, desc } from "drizzle-orm";
import { env } from "../../lib/env.js";
import { z } from "zod/v4";
import { testIntegrationCredential } from "../integrations/integration-validator.js";

const router = Router();
router.use(requireAuth);

// ── Server startup guard ──────────────────────────────────────────────────────
// Tracks when this module was loaded (proxy for server start time).
// Heavy jobs (execute/content) are blocked for the first 15s after restart
// to avoid 502s from the Replit proxy before the server is fully warmed up.
const MODULE_LOADED_AT = Date.now();
const SERVER_CONTENT_GRACE_MS = 5_000;

/** Single launch gate used by both explicit launch endpoints. Keep all outbound
 * launch checks here so no route can accidentally bypass them. */
async function launchCampaign(
  campaignId: string,
  workspaceId: string,
  userId: string,
  log: Parameters<typeof triggerExecutionPhase>[2],
) {
  const [ownedCampaign] = await db.select({ id: campaignsTable.id, landingSetupData: campaignsTable.landingSetupData }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!ownedCampaign) throw new AppError(404, "Campaign not found", "NOT_FOUND");
  const [approvedMasterplan] = await db.select({ id: masterplanVersionsTable.id }).from(masterplanVersionsTable)
    .where(and(eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.status, "approved"))).limit(1);
  if (!approvedMasterplan) throw new AppError(422, "Aprove o Master Plan antes de lançar a campanha.", "MASTERPLAN_NOT_APPROVED", { approvalUrl: `/campaigns/${campaignId}/control-room` });
  const integrationCheck = await checkIntegrationsForLaunch(workspaceId, campaignId);
  if (integrationCheck.status === "blocked") {
    const missing = integrationCheck.missing ?? [];
    const categoryList = missing.map((m) => m.category).join(", ");
    throw new AppError(422, `Para lançar esta campanha, conecte as integrações necessárias: ${categoryList}. Acesse /integracoes para conectar.`, "MISSING_INTEGRATIONS", { missing, connectUrl: "/integracoes" });
  }
  const allPieces = await db.select({ status: contentPiecesTable.status, type: contentPiecesTable.type }).from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId));
  const unapprovedPieces = allPieces.filter((piece) => piece.status !== "approved").length;
  if (allPieces.length === 0) {
    throw new AppError(422, "Nenhuma peça de conteúdo encontrada. Gere e aprove o conteúdo antes de lançar.", "NO_CONTENT", { approvalUrl: `/campaigns/${campaignId}/content` });
  }
  if (unapprovedPieces > 0) {
    throw new AppError(422, `${unapprovedPieces} peça${unapprovedPieces > 1 ? "s" : ""} de conteúdo ainda ${unapprovedPieces > 1 ? "precisam" : "precisa"} de aprovação antes do lançamento.`, "CONTENT_NOT_APPROVED", { unapprovedPieces, totalPieces: allPieces.length, approvalUrl: `/campaigns/${campaignId}/content` });
  }
  const landingPiece = allPieces.some((piece) => piece.status === "approved" && piece.type === "landing_page_structure");
  if (landingPiece) {
    const [publishedPage] = await db.select({ publishedUrl: pagesTable.publishedUrl }).from(pagesTable)
      .where(and(eq(pagesTable.workspaceId, workspaceId), eq(pagesTable.campaignId, campaignId), eq(pagesTable.status, "published"))).limit(1);
    const landingSetup = (ownedCampaign.landingSetupData ?? {}) as { status?: string; ctas?: unknown[] };
    if (!publishedPage?.publishedUrl || landingSetup.status !== "published" || !Array.isArray(landingSetup.ctas) || landingSetup.ctas.length === 0) {
      throw new AppError(422, "A landing page aprovada precisa estar publicada com pelo menos um CTA configurado antes do lançamento.", "LANDING_NOT_PUBLISHED", { landingUrl: `/campaigns/${campaignId}/content` });
    }
  }
  const validation = await runCrossAgentValidation(campaignId, workspaceId, log);
  if (!validation.isViable) {
    throw new AppError(422, `Validação cruzada de agentes detectou ${validation.blockers.length} conflito(s) crítico(s): ${validation.blockers[0]?.description ?? "verificar agentes"}`, "CROSS_VALIDATION_FAILED", { blockers: validation.blockers, warnings: validation.warnings, metrics: validation.metrics });
  }
  const result = await triggerExecutionPhase(campaignId, workspaceId, log, userId);
  return { result };
}

// A live, campaign-scoped preflight used by the visual launch checklist.
router.post("/:campaignId/execute/preflight", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const workspaceId = req.auth.workspaceId;
  const [campaign] = await db.select({ id: campaignsTable.id, landingSetupData: campaignsTable.landingSetupData })
    .from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" }); return; }

  const [masterplan, pieces, landingPage] = await Promise.all([
    db.select({ id: masterplanVersionsTable.id, version: masterplanVersionsTable.version, approvedAt: masterplanVersionsTable.approvedAt })
      .from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.status, "approved"))).orderBy(desc(masterplanVersionsTable.version)).limit(1),
    db.select({ id: contentPiecesTable.id, type: contentPiecesTable.type, status: contentPiecesTable.status })
      .from(contentPiecesTable).where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.workspaceId, workspaceId))),
    db.select({ publishedUrl: pagesTable.publishedUrl, publishedAt: pagesTable.publishedAt })
      .from(pagesTable).where(and(eq(pagesTable.campaignId, campaignId), eq(pagesTable.workspaceId, workspaceId), eq(pagesTable.status, "published"))).limit(1),
  ]);
  const plan = masterplan[0];
  const approvedPieces = pieces.filter((piece) => piece.status === "approved");
  const pendingPieces = pieces.length - approvedPieces.length;
  const integrationCheck = await checkIntegrationsForLaunch(workspaceId, campaignId);
  const hasLanding = approvedPieces.some((piece) => piece.type === "landing_page_structure");
  const setup = (campaign.landingSetupData ?? {}) as { status?: string; ctas?: unknown[]; tracking?: unknown };
  const liveLanding = landingPage[0];
  const checks: Array<{ id: string; label: string; state: "ready" | "blocked" | "warning" | "skipped"; detail: string; href?: string }> = [
    { id: "masterplan", label: "Master Plan aprovado", state: plan ? "ready" : "blocked", detail: plan ? `Versão ${plan.version} aprovada${plan.approvedAt ? ` em ${new Date(plan.approvedAt).toLocaleString("pt-BR")}` : ""}.` : "Aprove o Master Plan para continuar.", href: `/campaigns/${campaignId}/control-room` },
    { id: "integrations", label: "Integrações necessárias", state: integrationCheck.status === "ok" ? (integrationCheck.checks.some((check) => check.state === "warning") ? "warning" : "ready") : "blocked", detail: integrationCheck.status === "ok" ? (integrationCheck.checks.map((check) => check.detail).join(" ") || "Nenhuma integração externa exigida pelas peças aprovadas.") : (integrationCheck.missing ?? []).map((item) => `${item.category}: ${item.reason}`).join(" "), href: "/integracoes" },
    { id: "content", label: "Conteúdos aprovados", state: pieces.length > 0 && pendingPieces === 0 ? "ready" : "blocked", detail: pieces.length === 0 ? "Gere e aprove as peças antes de iniciar." : pendingPieces === 0 ? `${approvedPieces.length} peça(s) aprovadas.` : `${pendingPieces} de ${pieces.length} peça(s) ainda aguardam aprovação.`, href: `/campaigns/${campaignId}/content` },
  ];
  if (hasLanding) {
    const landingReady = !!liveLanding?.publishedUrl;
    const setupReady = setup.status === "published" && Array.isArray(setup.ctas) && setup.ctas.length > 0;
    checks.push({ id: "landing", label: "Landing page, CTAs e publicação", state: landingReady && setupReady ? "ready" : "blocked", detail: landingReady && setupReady ? `Página publicada: ${liveLanding.publishedUrl}` : "A landing aprovada precisa de plano de implementação com CTAs e publicação ativa.", href: `/campaigns/${campaignId}/content` });
  } else {
    checks.push({ id: "landing", label: "Landing page", state: "skipped", detail: "Esta campanha não tem landing page aprovada como entregável." });
  }
  let crossValidation: { isViable: boolean; blockers: Array<{ description: string }> } | null = null;
  if (plan && pieces.length > 0 && pendingPieces === 0 && integrationCheck.status === "ok" && (!hasLanding || !!liveLanding?.publishedUrl)) {
    try { crossValidation = await runCrossAgentValidation(campaignId, workspaceId, req.log); }
    catch (error) { req.log.warn({ campaignId, error }, "launch preflight cross-validation unavailable"); }
  }
  checks.push({
    id: "validation",
    label: "Validação estratégica final",
    state: crossValidation ? (crossValidation.isViable ? "ready" : "blocked") : "warning",
    detail: crossValidation ? (crossValidation.isViable ? "Validação cruzada concluída sem bloqueios." : crossValidation.blockers.map((blocker) => blocker.description).join(" ")) : "A validação será executada ao iniciar o lançamento.",
  });
  const blockers = checks.filter((check) => check.state === "blocked");
  res.json({ campaignId, checkedAt: new Date().toISOString(), ready: blockers.length === 0 && checks.some((check) => check.id === "validation" && check.state === "ready"), checks });
});

// GET /campaigns/:campaignId/execution/status
router.get("/:campaignId/execution/status", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const status = await getExecutionStatus(campaignId, req.auth.workspaceId);
    res.json(status);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

const executeBodySchema = z.object({ phase: z.enum(["strategy", "content", "launch", "monitor"]) });
// POST /campaigns/:campaignId/execute — explicit phase only.
router.post("/:campaignId/execute", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const parsed = executeBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }

  try {
    if (parsed.data.phase === "launch") {
      const { result } = await launchCampaign(campaignId, req.auth.workspaceId, req.auth.userId, req.log);
      res.status(202).json({ message: result.queued ? "Lançamento enfileirado — campanha será ativada em instantes" : "Lançamento iniciado diretamente", campaignId, action: "execute", jobId: result.jobId ?? null, queued: result.queued });
      return;
    }
    const result = parsed.data.phase === "strategy"
      ? await triggerStrategyPhase(campaignId, req.auth.workspaceId, req.log)
      : parsed.data.phase === "content"
        ? await triggerContentPhase(campaignId, req.auth.workspaceId, req.log)
        : await triggerMonitor(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase enfileirada para execução assíncrona"
        : "Fase iniciada diretamente (Redis indisponível)",
      campaignId,
      action: parsed.data.phase === "strategy" ? "run_strategy" : parsed.data.phase === "content" ? "generate_content" : "monitor",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/strategy
router.post("/:campaignId/execute/strategy", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await triggerStrategyPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase de estratégia enfileirada — Command → Profile → Strategy → Offer → Manager → Financial Projector"
        : "Fase de estratégia iniciada diretamente",
      campaignId,
      action: "run_strategy",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/content
router.post("/:campaignId/execute/content", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  // Startup guard: reject heavy content jobs during server warm-up window.
  // Prevents the Replit proxy 502 that occurs when content is triggered immediately
  // after a server restart (proxy routes to new process before it's ready).
  const uptimeMs = Date.now() - MODULE_LOADED_AT;
  if (uptimeMs < SERVER_CONTENT_GRACE_MS) {
    const retryAfterMs = SERVER_CONTENT_GRACE_MS - uptimeMs;
    res
      .status(503)
      .set("Retry-After", String(Math.ceil(retryAfterMs / 1000)))
      .json({
        error: "Servidor inicializando — aguarde alguns segundos e tente novamente",
        code: "SERVER_STARTING",
        retryAfterMs,
      });
    return;
  }

  try {
    const result = await triggerContentPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Geração de conteúdo enfileirada — 16 agentes em sequência"
        : "Geração de conteúdo iniciada diretamente",
      campaignId,
      action: "generate_content",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/market-validation/acknowledge
// Self-proof: founder confirmou ciência dos alertas regulatórios.
// Registra acknowledgmentRecordedAt + userId em brainData e re-dispara o pipeline.
// O step "market_validation" já está no checkpoint — é pulado na próxima execução.
router.post("/:campaignId/market-validation/acknowledge", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const { workspaceId, userId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.status !== "analyzing") {
    res.status(422).json({ error: "Campanha não está em fase de análise", code: "INVALID_STATUS" });
    return;
  }

  const brainRaw = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const mv = ((brainRaw["marketValidation"] ?? {}) as Record<string, unknown>);

  // Guard: conteúdo ilegal flagrante — bloqueio definitivo, não pode ser desbloqueado
  // nem pelo founder nem por nenhum endpoint. O acknowledge serve APENAS para alertas
  // regulatórios (requiresAcknowledgment=true), nunca para casos isCriticalBlock=true.
  if (mv["overallVerdict"] === "INVIAVEL") {
    req.log.warn({ campaignId, workspaceId, userId }, "[COMPLIANCE] Tentativa de acknowledge em campanha com bloqueio definitivo (INVIAVEL) — rejeitado");
    res.status(403).json({
      error: "Esta campanha contém conteúdo incompatível com as regras da plataforma e não pode prosseguir. O bloqueio é definitivo e não pode ser removido por nenhuma ação do usuário.",
      code: "COMPLIANCE_HARD_BLOCK",
    });
    return;
  }

  // Self-proof: registra timestamp e userId de quem confirmou ciência
  const acknowledgmentRecordedAt = new Date().toISOString();

  // Extrai lista de alertas regulatórios dos validators que exigem ciência
  const validators = (mv["validators"] as Array<Record<string, unknown>> | undefined) ?? [];
  const regulatoryAlerts = validators
    .filter((v) => v["requiresAcknowledgment"])
    .flatMap((v) => (v["regulatoryAlerts"] as string[] | undefined) ?? []);

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainRaw,
        marketValidation: {
          ...mv,
          acknowledgmentRecordedAt,
          acknowledgedByUserId: userId,
          // compatibilidade com código legado que ainda lê userDecision
          userDecision: "proceed",
        },
      } as any,
    })
    .where(eq(campaignsTable.id, campaignId));

  // Audit log imutável — self-proof de ciência regulatória com lista de alertas confirmados
  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.regulatory.acknowledged",
    actor: userId,
    data: {
      acknowledgmentRecordedAt,
      acknowledgedByUserId: userId,
      regulatoryAlerts,
      overallVerdict: mv["overallVerdict"],
    },
  });

  req.log.info(
    { campaignId, workspaceId, userId, acknowledgmentRecordedAt, regulatoryAlerts },
    "[COMPLIANCE] Self-proof registrado — founder confirmou ciência dos alertas regulatórios",
  );

  await triggerStrategyPhase(campaignId, workspaceId, req.log);

  res.json({
    ok: true,
    message: "Ciência registrada. Pipeline de estratégia iniciado.",
    acknowledgmentRecordedAt,
  });
});

// POST /campaigns/:campaignId/market-validation/proceed  (alias legado — NÃO é bypass)
// Este endpoint é um alias do /acknowledge. Não oferece nenhuma capacidade além do que
// o founder já tem via /acknowledge. Bloqueios definitivos (INVIAVEL / isCriticalBlock)
// são rejeitados aqui exatamente como no /acknowledge — não existe caminho de override.
router.post("/:campaignId/market-validation/proceed", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const { workspaceId, userId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (campaign.status !== "analyzing") {
    res.status(422).json({ error: "Campanha não está em fase de análise", code: "INVALID_STATUS" });
    return;
  }

  const brainRaw = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const mv = ((brainRaw["marketValidation"] ?? {}) as Record<string, unknown>);

  // Guard idêntico ao /acknowledge — bloqueio definitivo não pode ser removido por nenhuma rota
  if (mv["overallVerdict"] === "INVIAVEL") {
    req.log.warn({ campaignId, workspaceId, userId }, "[COMPLIANCE] Tentativa de proceed em campanha com bloqueio definitivo (INVIAVEL) — rejeitado");
    res.status(403).json({
      error: "Esta campanha contém conteúdo incompatível com as regras da plataforma e não pode prosseguir. O bloqueio é definitivo.",
      code: "COMPLIANCE_HARD_BLOCK",
    });
    return;
  }

  // Alias do /acknowledge: registra self-proof completo (userId + timestamp)
  const acknowledgmentRecordedAt = new Date().toISOString();

  // Extrai lista de alertas regulatórios dos validators que exigem ciência
  const validators = (mv["validators"] as Array<Record<string, unknown>> | undefined) ?? [];
  const regulatoryAlerts = validators
    .filter((v) => v["requiresAcknowledgment"])
    .flatMap((v) => (v["regulatoryAlerts"] as string[] | undefined) ?? []);

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainRaw,
        marketValidation: {
          ...mv,
          userDecision: "proceed",
          acknowledgmentRecordedAt,
          acknowledgedByUserId: userId,
        },
      } as any,
    })
    .where(eq(campaignsTable.id, campaignId));

  // Audit log imutável — self-proof de ciência regulatória com lista de alertas confirmados
  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.regulatory.acknowledged",
    actor: userId,
    data: {
      acknowledgmentRecordedAt,
      acknowledgedByUserId: userId,
      regulatoryAlerts,
      overallVerdict: mv["overallVerdict"],
    },
  });

  req.log.info({ campaignId, workspaceId, userId, acknowledgmentRecordedAt }, "[COMPLIANCE] /proceed (legado) — self-proof registrado via alias");
  await triggerStrategyPhase(campaignId, workspaceId, req.log);
  res.json({ ok: true, message: "Pipeline retomado.", acknowledgmentRecordedAt });
});

// POST /campaigns/:campaignId/execute/retry — failsafe recovery for stuck campaigns
// Clears the pipeline lock, forces campaign back to a retryable state, and re-enqueues
// the appropriate job. Safe to call from analyzing or generating status only.
// Includes retry-count teto: after 3 manual retries, returns REQUIRES_INTERVENTION
// instead of re-enqueuing — preventing infinite credit-burning loops on deterministic errors.
router.post("/:campaignId/execute/retry", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const { workspaceId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" });
    return;
  }

  if (!["analyzing", "generating"].includes(campaign.status)) {
    res.status(400).json({
      error: `Campanha não está em estado de recuperação (status atual: ${campaign.status}).`,
      code: "NOT_STUCK",
    });
    return;
  }

  try {
    const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
    const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
    const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
    const retryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;

    // ── Trato admin: sem teto de retries ──
    const [wsOwner] = await db
      .select({ ownerId: workspacesTable.ownerId })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);
    const isAdminRetry = wsOwner?.ownerId ? isPlatformAdmin(wsOwner.ownerId) : false;

    // ── Auto-skip de peça problemática após 3 tentativas ──
    // Nunca bloqueia o cliente. Após 3 falhas no mesmo ponto, a peça é adicionada
    // a contentRetry.skippedPieces (lida por skipAgent() em content.service.ts)
    // e o pipeline reinicia limpo. Admin bypass: retryCount é resetado diretamente.
    //
    // IMPORTANT: also inserts a "skipped" placeholder piece into contentPiecesTable
    // so the approval UI can see and display it (with a "Rewrite with AI" CTA)
    // instead of silently hiding the piece from the user.
    const VALID_CONTENT_TYPES = new Set([
      "email_sequence","sales_page","whatsapp_broadcast","whatsapp_group_message","telegram_message",
      "social_post","ad_copy","vsl_script","media_brief","content_calendar","cart_open_announcement",
      "cart_close_urgency","remarketing_sequence","cpl_script","webinar_script","live_script",
      "stories_sequence","landing_page_structure","creative_direction","targeting_config",
      "media_buying_plan","video_strategy","creator_growth_plan","seo_organic_plan",
      "compliance_report","optimization_report",
    ]);
    if (retryCount >= 3 && !isAdminRetry) {
      const failedPieceType = contentRetry["lastFailedPieceType"] as string | undefined;
      req.log.warn({ campaignId, retryCount, failedPieceType }, "[FAILSAFE] 3 retries — auto-skipping problematic piece, restarting pipeline");
      const currentSkipped = ((contentRetry["skippedPieces"] ?? []) as string[]);
      const newSkipped = failedPieceType && !currentSkipped.includes(failedPieceType)
        ? [...currentSkipped, failedPieceType]
        : currentSkipped;
      const autoSkipBrain = {
        ...brain,
        pipelineCheckpoint: { lockedAt: null, lastProgressAt: null },
        contentRetry: {
          ...contentRetry,
          skippedPieces: newSkipped,
          retryCount: 0,
          autoSkippedAt: new Date().toISOString(),
          autoSkippedPiece: failedPieceType,
        },
      };

      // Insert a visible "skipped" placeholder so the approval UI can display it
      if (failedPieceType && VALID_CONTENT_TYPES.has(failedPieceType)) {
        const [existingPiece] = await db
          .select({ id: contentPiecesTable.id })
          .from(contentPiecesTable)
          .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, failedPieceType as any)))
          .limit(1);
        if (!existingPiece) {
          await db.insert(contentPiecesTable).values({
            campaignId,
            workspaceId,
            type: failedPieceType as any,
            status: "draft",
            title: `[Pulado automaticamente] ${failedPieceType}`,
            content: { _notGenerated: true, _autoSkipped: true, _minimalFallback: true, reason: "Esta peça foi pulada automaticamente após 3 tentativas. Clique em \"Reescrever com IA\" para gerar." } as any,
            aiProvider: "none" as any,
            creditsUsed: 0,
          }).catch(err => req.log.warn({ err, campaignId, failedPieceType }, "[FAILSAFE] Could not insert auto-skip placeholder — non-blocking"));
        }
      }

      if (campaign.status === "analyzing") {
        await db.update(campaignsTable).set({ status: "intake" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, campaignId));
        const result = await triggerStrategyPhase(campaignId, workspaceId, req.log);
        res.status(202).json({ retried: true, phase: "strategy", queued: result.queued, retryCount: 0, autoSkipped: failedPieceType });
      } else {
        await db.update(campaignsTable).set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, campaignId));
        const result = await triggerContentPhase(campaignId, workspaceId, req.log);
        res.status(202).json({ retried: true, phase: "content", queued: result.queued, retryCount: 0, autoSkipped: failedPieceType });
      }
      return;
    }

    // Increment retry counter and clear pipeline lock
    const updatedContentRetry = { ...contentRetry, retryCount: retryCount + 1, lastRetryAt: new Date().toISOString() };
    const clearedBrain = {
      ...brain,
      pipelineCheckpoint: { ...cp, lockedAt: null, lastProgressAt: null },
      contentRetry: updatedContentRetry,
    };

    if (campaign.status === "analyzing") {
      await db
        .update(campaignsTable)
        .set({ status: "intake" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerStrategyPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId, retryCount: retryCount + 1 }, "[FAILSAFE] analyzing → intake → strategy re-enqueued");
      res.status(202).json({ retried: true, phase: "strategy", queued: result.queued, retryCount: retryCount + 1 });
    } else {
      await db
        .update(campaignsTable)
        .set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerContentPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId, retryCount: retryCount + 1 }, "[FAILSAFE] generating → strategy_ready → content re-enqueued");
      res.status(202).json({ retried: true, phase: "content", queued: result.queued, retryCount: retryCount + 1 });
    }
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/pieces/:pieceType/skip
// Marks a specific content piece type as "skipped" so the content pipeline will
// bypass it on the next run. Injects a placeholder piece into contentPiecesTable
// (status=draft, content._skipped=true) which skipAgent() detects and bypasses.
// This breaks deterministic error loops: if VSL Agent always fails, skip it and
// generate the remaining 15 pieces.
router.post("/:campaignId/content/pieces/:pieceType/skip", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const pieceType = req.params["pieceType"] as string;
  const { workspaceId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" });
    return;
  }

  // Store skipped piece types in brainData (no schema migration needed)
  const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
  const skippedPieces = ((contentRetry["skippedPieces"] ?? []) as string[]);
  if (!skippedPieces.includes(pieceType)) {
    skippedPieces.push(pieceType);
  }
  const updatedBrain = {
    ...brain,
    contentRetry: {
      ...contentRetry,
      skippedPieces,
      retryCount: 0, // reset retry counter after manual skip
      requiresIntervention: false,
    },
  };
  await db
    .update(campaignsTable)
    .set({ brainData: updatedBrain as any, updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));

  req.log.info({ campaignId, pieceType, skippedPieces }, "[FAILSAFE] Content piece skipped by user");
  res.status(200).json({ skipped: true, pieceType, skippedPieces });
});

// ── Integration gate for launch ──────────────────────────────────────────────
// Blocks campaign launch if NO messaging AND NO email channels are connected.
type DbIntegrationProvider = "meta_ads" | "instagram" | "tiktok_ads" | "google_ads" | "whatsapp_business" | "telegram" | "stripe" | "hotmart" | "eduzz" | "kiwify" | "mailchimp" | "activecampaign" | "rd_station" | "hubspot" | "crypto_native" | "custom_webhook";

type IntegrationCheckResult = {
  status: "ok" | "blocked";
  checks: { category: string; provider: string; state: "ready" | "warning" | "blocked"; detail: string }[];
  missing?: { category: string; providers: string[]; reason: string; pieceTypes: string[] }[];
};

// Maps each content piece type to the integration category it operationally requires.
// If a piece of that type exists in the campaign, the corresponding integration MUST
// be connected before launch — otherwise the piece cannot be dispatched/published.
const PIECE_TYPE_REQUIRES: Record<string, { category: string; providers: DbIntegrationProvider[]; displayProviders: string[]; reason: string } | null> = {
  // Messaging
  email_sequence:           { category: "E-mail",          providers: ["rd_station", "activecampaign"],            displayProviders: ["RD Station", "ActiveCampaign", "Resend"], reason: "Disparo da sequência de e-mails" },
  whatsapp_broadcast:       { category: "WhatsApp",         providers: ["whatsapp_business"],                       displayProviders: ["WhatsApp Business"],                      reason: "Disparo de broadcast no WhatsApp" },
  whatsapp_group_message:   { category: "WhatsApp",         providers: ["whatsapp_business"],                       displayProviders: ["WhatsApp Business"],                      reason: "Envio de mensagens para grupos WhatsApp" },
  prelaunch_warming:        { category: "WhatsApp",         providers: ["whatsapp_business"],                       displayProviders: ["WhatsApp Business"],                      reason: "Aquecimento pré-lançamento via WhatsApp" },
  telegram_message:         { category: "Telegram",         providers: ["telegram"],                                displayProviders: ["Telegram"],                               reason: "Disparo de mensagens no Telegram" },
  // Paid ads
  ad_copy:                  { category: "Meta Ads",         providers: ["meta_ads"],                                displayProviders: ["Facebook / Meta Ads"],                    reason: "Veiculação dos anúncios criados" },
  targeting_config:         { category: "Meta Ads",         providers: ["meta_ads"],                                displayProviders: ["Facebook / Meta Ads"],                    reason: "Configuração de audiências no Meta Ads" },
  media_buying_plan:        { category: "Meta Ads",         providers: ["meta_ads"],                                displayProviders: ["Facebook / Meta Ads"],                    reason: "Execução do plano de media buying" },
  // Organic social (auto-post)
  social_post:              { category: "Instagram",        providers: ["instagram", "meta_ads"],                   displayProviders: ["Instagram", "Facebook / Meta Ads"],       reason: "Auto-post de conteúdo orgânico" },
  stories_sequence:         { category: "Instagram",        providers: ["instagram", "meta_ads"],                   displayProviders: ["Instagram", "Facebook / Meta Ads"],       reason: "Publicação automática de Stories" },
  // No integration required — these are pure content assets dispatched via other pieces
  vsl_script:               null,
  sales_page:               null,
  landing_page_structure:   null,
  creative_direction:       null,
  cpl_script:               null,
  webinar_script:           null,
  live_script:              null,
  media_brief:              null,
  content_calendar:         null,
  video_strategy:           null,
  creator_growth_plan:      null,
  compliance_report:        null,
  optimization_report:      null,
  cart_open_announcement:   null,
  cart_close_urgency:       null,
  remarketing_sequence:     null,
  seo_organic_plan:         null,
};

async function checkIntegrationsForLaunch(
  workspaceId: string,
  campaignId: string,
): Promise<IntegrationCheckResult> {
  // 1. Get all approved pieces for this specific campaign
  const pieces = await db
    .select({ type: contentPiecesTable.type })
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.status, "approved"),
      ),
    );

  const pieceTypes = [...new Set(pieces.map((p) => p.type))];

  // 2. Determine which integration categories this campaign operationally requires
  const requiredCategories = new Map<string, { providers: DbIntegrationProvider[]; displayProviders: string[]; reason: string; pieceTypes: string[] }>();

  for (const type of pieceTypes) {
    const req = PIECE_TYPE_REQUIRES[type];
    if (!req) continue;

    const existing = requiredCategories.get(req.category);
    if (existing) {
      existing.pieceTypes.push(type);
    } else {
      requiredCategories.set(req.category, {
        providers: req.providers,
        displayProviders: req.displayProviders,
        reason: req.reason,
        pieceTypes: [type],
      });
    }
  }

  // E-mail: RESEND_API_KEY satisfies the e-mail requirement even without a DB integration
  const checks: { category: string; provider: string; state: "ready" | "warning" | "blocked"; detail: string }[] = [];
  if (env.RESEND_API_KEY && requiredCategories.has("E-mail")) {
    try {
      const result = await testIntegrationCredential("resend", { accessToken: env.RESEND_API_KEY });
      if (result.valid) {
        checks.push({ category: "E-mail", provider: "Resend", state: "ready", detail: result.detail ?? "Chave Resend validada com a API." });
        requiredCategories.delete("E-mail");
      }
    } catch {
      // Other configured email integrations remain eligible as a fallback.
    }
  }

  if (requiredCategories.size === 0) return { status: "ok", checks };

  // 3. Check which required providers are actually connected
  const allRequiredProviders = [...requiredCategories.values()].flatMap((r) => r.providers);
  const connected = await db
    .select({
      provider: workspaceIntegrationsTable.provider,
      accessToken: workspaceIntegrationsTable.accessToken,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      metadata: workspaceIntegrationsTable.metadata,
      webhookUrl: workspaceIntegrationsTable.webhookUrl,
      tokenExpiresAt: workspaceIntegrationsTable.tokenExpiresAt,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.status, "connected"),
        inArray(workspaceIntegrationsTable.provider, [...new Set(allRequiredProviders)] as DbIntegrationProvider[]),
      ),
    );

  // 4. Ping each connected candidate on its provider API. Secrets stay server-side.
  const checkedProviders = new Map<string, { state: "ready" | "warning" | "blocked"; detail: string }>();
  for (const integration of connected) {
    const provider = integration.provider as string;
    if (!integration.accessToken && !integration.webhookUrl) {
      checkedProviders.set(provider, { state: "blocked", detail: `${provider}: conexão sem credencial disponível.` });
      continue;
    }
    if (integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() <= Date.now()) {
      checkedProviders.set(provider, { state: "blocked", detail: `${provider}: token expirado; reconecte a integração.` });
      continue;
    }
    try {
      const result = await testIntegrationCredential(provider, {
        accessToken: integration.accessToken ?? undefined,
        accountId: integration.accountId ?? undefined,
        webhookUrl: integration.webhookUrl ?? undefined,
        metadata: (integration.metadata ?? {}) as Record<string, unknown>,
      });
      checkedProviders.set(provider, result.valid
        ? { state: result.validationSkipped ? "warning" : "ready", detail: result.detail ?? `${integration.accountName ?? provider}: ${result.validationSkipped ? "credencial salva; verificação automática indisponível" : "conexão confirmada pela API"}.` }
        : { state: "blocked", detail: result.error ?? `${provider}: o provedor recusou a credencial.` });
    } catch {
      checkedProviders.set(provider, { state: "blocked", detail: `${provider}: não foi possível validar a conexão agora.` });
    }
  }

  // 5. Find categories where NONE of the required providers passed validation.
  const missing: { category: string; providers: string[]; reason: string; pieceTypes: string[] }[] = [];
  for (const [category, req] of requiredCategories) {
    const hasAny = req.providers.some((provider) => {
      const state = checkedProviders.get(provider)?.state;
      return state === "ready" || state === "warning";
    });
    const selected = req.providers.find((provider) => checkedProviders.get(provider)?.state === "ready")
      ?? req.providers.find((provider) => checkedProviders.get(provider)?.state === "warning");
    if (selected) {
      const check = checkedProviders.get(selected)!;
      checks.push({ category, provider: selected, state: check.state, detail: check.detail });
    } else {
      const attempted = req.providers.find((provider) => checkedProviders.has(provider));
      checks.push({ category, provider: attempted ?? req.providers[0] ?? category, state: "blocked", detail: attempted ? checkedProviders.get(attempted)!.detail : `${category}: conecte uma integração necessária.` });
    }
    if (!hasAny) {
      missing.push({
        category,
        providers: req.displayProviders,
        reason: req.reason,
        pieceTypes: req.pieceTypes,
      });
    }
  }

  if (missing.length === 0) return { status: "ok", checks };
  return { status: "blocked", checks, missing };
}

// POST /campaigns/:campaignId/execute/launch
router.post("/:campaignId/execute/launch", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const { result } = await launchCampaign(campaignId, req.auth.workspaceId, req.auth.userId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Lançamento enfileirado — campanha será ativada em instantes"
        : "Lançamento iniciado diretamente",
      campaignId,
      action: "execute",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/monitor
router.post("/:campaignId/execute/monitor", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await triggerMonitor(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: "Monitor de saúde enfileirado",
      campaignId,
      action: "monitor",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
