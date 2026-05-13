import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview, getAdminFinancials, getAdminPayments } from "./admin.service.js";
import { markPaymentPaid } from "../billing/billing.service.js";
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

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const status = req.query["status"] as string | undefined;
  const limit  = parseInt(req.query["limit"] as string ?? "100", 10);
  const data = await getAdminPayments({ status, limit });
  res.json({ payments: data });
});

router.post("/payments/:paymentId/confirm", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const paymentId = req.params["paymentId"] as string;
  const note = (req.body as { note?: string }).note ?? `Confirmado manualmente por ${req.auth.email}`;

  // markPaymentPaid expects workspaceId — load payment first, then use its workspaceId
  const payments = await getAdminPayments({ limit: 1000 });
  const p = payments.find(x => x.id === paymentId);
  if (!p) { res.status(404).json({ error: "Pagamento não encontrado" }); return; }

  const updated = await markPaymentPaid(p.workspaceId, paymentId, note);
  res.json({ payment: updated, message: "Pagamento confirmado com sucesso" });
});

export default router;
