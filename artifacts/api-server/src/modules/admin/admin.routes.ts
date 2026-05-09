import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview } from "./admin.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

const ADMIN_EMAILS = new Set(["admin@nexos.ai"]);

const router = Router();

router.get("/overview", requireAuth, async (req, res): Promise<void> => {
  if (!ADMIN_EMAILS.has(req.auth.email)) {
    throw new UnauthorizedError("Admin access required");
  }
  const data = await getAdminOverview();
  res.json(data);
});

export default router;
