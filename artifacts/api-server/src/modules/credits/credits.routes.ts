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
import { db, usersTable, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CREDIT_COSTS } from "@workspace/db";
import { AppError } from "../../lib/errors.js";

const ADMIN_EMAILS_TOPUP = new Set([
  "admin@nexos.ai",
  "founder@nexos.ai",
  "admin@agencianexos.vip",
  "founder@agencianexos.vip",
]);

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

  // Custo real em USD é informação interna — visível apenas para admins
  const isAdmin = ADMIN_EMAILS_TOPUP.has(req.auth.email ?? "");
  if (!isAdmin) {
    const sanitized = {
      ...usage,
      totalCostUsd: "0",
      entries: usage.entries.map((e) => ({ ...e, costUsd: "0" })),
    };
    res.json(sanitized);
    return;
  }

  res.json(usage);
});

router.get("/costs", (_req, res): void => {
  res.json({ costs: CREDIT_COSTS });
});

// Admin-only free topup — for the product owner, never a customer flow.
// Guards: must be authenticated + workspace owner email must be in ADMIN_EMAILS set.
router.post("/admin-topup", async (req, res): Promise<void> => {
  const { workspaceId, userId } = req.auth;

  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || !ADMIN_EMAILS_TOPUP.has(user.email)) {
    res.status(403).json({ error: "Acesso restrito ao fundador.", code: "FORBIDDEN" });
    return;
  }

  const TOPUP_AMOUNT = 2000;
  const tx = await grantCredits(workspaceId, TOPUP_AMOUNT, "admin_grant", req.log, "Recarga do fundador — sem custo");
  res.json({ ok: true, credited: TOPUP_AMOUNT, newBalance: tx.balanceAfter });
});

export default router;
