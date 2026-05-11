import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview, getAdminFinancials } from "./admin.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

const ADMIN_EMAILS = new Set([
  "admin@nexos.ai",
  "founder@nexos.ai",
]);

const router = Router();

function requireAdmin(email: string) {
  if (!ADMIN_EMAILS.has(email)) {
    throw new UnauthorizedError("Admin access required");
  }
}

router.get("/overview", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const data = await getAdminOverview();
  res.json(data);
});

router.get("/financials", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const data = await getAdminFinancials();
  res.json(data);
});

export default router;
