import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import { IngestMetricsSchema } from "@workspace/db";
import {
  ingestMetrics,
  getMetricsSummary,
  getMetricsHistory,
  getCampaignAlerts,
  acknowledgeAlert,
} from "./metrics.service.js";

const router = Router();
router.use(requireAuth);

// POST /campaigns/:campaignId/metrics — ingest daily metrics
router.post("/:campaignId/metrics", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = IngestMetricsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await ingestMetrics(
      campaignId,
      req.auth.workspaceId,
      parsed.data,
      req.log,
    );
    res.status(201).json({
      message: "Metrics ingested",
      metric: result.metric,
      health: result.health,
      alertsGenerated: result.alertsGenerated,
      autoOptimizationTriggered: result.autoOptimizationTriggered,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/metrics/summary — aggregated summary + all metrics
router.get("/:campaignId/metrics/summary", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const summary = await getMetricsSummary(campaignId, req.auth.workspaceId);
    res.json(summary);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/metrics — paginated metrics history
const historyQuerySchema = z.object({
  fromDay: z.coerce.number().int().min(1).optional(),
  toDay: z.coerce.number().int().min(1).optional(),
});

router.get("/:campaignId/metrics", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await getMetricsHistory(
      campaignId,
      req.auth.workspaceId,
      parsed.data.fromDay,
      parsed.data.toDay,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/alerts — list campaign alerts
router.get("/:campaignId/alerts", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const onlyUnacknowledged = req.query["unacknowledged"] === "true";

  try {
    const result = await getCampaignAlerts(
      campaignId,
      req.auth.workspaceId,
      onlyUnacknowledged,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/alerts/:alertId/acknowledge — acknowledge an alert
router.post("/:campaignId/alerts/:alertId/acknowledge", async (req, res): Promise<void> => {
  const { campaignId, alertId } = req.params as { campaignId: string; alertId: string };

  try {
    const alert = await acknowledgeAlert(
      campaignId,
      req.auth.workspaceId,
      alertId,
      req.auth.userId,
    );
    res.json({ message: "Alert acknowledged", alert });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
