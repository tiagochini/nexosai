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

const router = Router();
router.use(requireAuth);

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
      res.status(err.statusCode).json({ error: err.message, code: err.code });
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
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/content
router.post("/:campaignId/execute/content", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

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
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/launch
router.post("/:campaignId/execute/launch", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
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
      res.status(err.statusCode).json({ error: err.message, code: err.code });
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
