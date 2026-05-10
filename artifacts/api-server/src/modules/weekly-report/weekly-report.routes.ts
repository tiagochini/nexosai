import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { sendWeeklyReport } from "./weekly-report.service.js";
import { logger } from "../../lib/logger.js";

const router = Router();

router.post("/send", requireAuth, async (req, res) => {
  const workspaceId = req.auth.workspaceId;
  await sendWeeklyReport(workspaceId);
  logger.child({ workspaceId }).info("Weekly report sent manually");
  res.json({ ok: true, message: "Relatório enviado para o seu email" });
});

export default router;
