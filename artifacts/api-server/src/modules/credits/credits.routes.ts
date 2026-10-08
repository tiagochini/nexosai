import { requirePlatformAdmin } from "../admin/admin.middleware.js";
import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getBalance,
  getTransactionHistory,
  getAgentUsageHistory,
  checkCredits,
  grantCredits,
  type CreditAction,
} from "./credits.service.js";
import { CREDIT_COSTS } from "@workspace/db";
import { AppError } from "../../lib/errors.js";


const router = Router();

router.use(requireAuth);

router.get("/balance", async (req, res): Promise<void> => {
  try {
    const balance = await getBalance(req.auth.workspaceId);
    res.json({ balance });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/history", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"]) || 50, 100);
  const history = await getTransactionHistory(req.auth.workspaceId, limit);
  res.json({ transactions: history });
});

router.get("/check/:action", async (req, res): Promise<void> => {
  const action = req.params["action"] as CreditAction;
  if (!(action in CREDIT_COSTS)) {
    res.status(400).json({ error: "Unknown action", code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await checkCredits(req.auth.workspaceId, action);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/usage", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"]) || 100, 200);
  const usage = await getAgentUsageHistory(req.auth.workspaceId, limit);
  res.json(usage);
});

router.get("/costs", (_req, res): void => {
  res.json({ costs: CREDIT_COSTS });
});

// Admin-only free topup — for the product owner, never a customer flow.
// Guards: authenticated UUID administrator with a live, owned workspace session.
router.post("/admin-topup", requirePlatformAdmin, async (req, res): Promise<void> => {
  const { workspaceId } = req.auth;

  const TOPUP_AMOUNT = 2000;
  const tx = await grantCredits(workspaceId, TOPUP_AMOUNT, "admin_grant", req.log, "Recarga do fundador — sem custo");
  res.json({ ok: true, credited: TOPUP_AMOUNT, newBalance: tx.balanceAfter });
});

export default router;
