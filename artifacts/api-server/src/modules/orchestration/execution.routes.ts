import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getExecutionStatus,
  triggerNextPhase,
  triggerStrategyPhase,
  triggerContentPhase,
  triggerExecutionPhase,
  triggerMonitor,
} from "./orchestration.service.js";
import { AppError } from "../../lib/errors.js";
import {
  db,
  campaignsTable,
  workspacesTable,
  getCampaignCreditEstimate,
  CAMPAIGN_CREDIT_BUFFER,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

// ── Pre-flight credit check ───────────────────────────────────────────────────
// Returns the credits needed for a phase; throws 402 if balance insufficient.
async function checkCreditsForPhase(
  workspaceId: string,
  campaignId: string,
  phase: "strategy" | "content" | "launch",
): Promise<void> {
  const [workspace] = await db
    .select({ balance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  const [campaign] = await db
    .select({ type: campaignsTable.type })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  const campaignType = campaign?.type ?? "launch";
  const estimate = getCampaignCreditEstimate(campaignType);

  const phaseCost = {
    strategy: 45,
    content: 150,
    launch: 37,
  }[phase];

  // Require phase cost + buffer (next campaign headroom)
  const required = phaseCost + CAMPAIGN_CREDIT_BUFFER;
  const balance = workspace.balance ?? 0;

  if (balance < required) {
    const shortage = required - balance;
    throw new AppError(
      402,
      `Créditos insuficientes para iniciar esta fase. ` +
        `Saldo atual: ${balance} cr. ` +
        `Necessário: ${required} cr (${phaseCost} para a fase + ${CAMPAIGN_CREDIT_BUFFER} de reserva). ` +
        `Compre mais ${shortage} crédito${shortage !== 1 ? "s" : ""} para continuar.`,
      "INSUFFICIENT_CREDITS",
      {
        balance,
        required,
        phaseCost,
        buffer: CAMPAIGN_CREDIT_BUFFER,
        shortage,
        campaignType,
        estimatedTotal: estimate.typical,
      },
    );
  }
}

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

// POST /campaigns/:campaignId/execute — smart trigger (picks next phase automatically)
router.post("/:campaignId/execute", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await triggerNextPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase enfileirada para execução assíncrona"
        : "Fase iniciada diretamente (Redis indisponível)",
      campaignId,
      action: result.action,
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
    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "strategy");
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

  try {
    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "content");
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

// POST /campaigns/:campaignId/execute/launch
router.post("/:campaignId/execute/launch", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "launch");
    const result = await triggerExecutionPhase(campaignId, req.auth.workspaceId, req.log);
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
