import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview, getAdminFinancials, getAdminPayments } from "./admin.service.js";
import { queryAgentExecutionLogs, getAgentExecutionLogById, getAgentExecutionLogsSummary } from "./audit-logs.service.js";
import { markPaymentPaid } from "../billing/billing.service.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { db, inviteCodesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const ADMIN_EMAILS = new Set([
  "admin@nexos.ai",
  "founder@nexos.ai",
  "admin@agencianexos.vip",
  "founder@agencianexos.vip",
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

  const payments = await getAdminPayments({ limit: 1000 });
  const p = payments.find(x => x.id === paymentId);
  if (!p) { res.status(404).json({ error: "Pagamento não encontrado" }); return; }

  const updated = await markPaymentPaid(p.workspaceId, paymentId, note);
  res.json({ payment: updated, message: "Pagamento confirmado com sucesso" });
});

// ─── Invite Codes ─────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/admin/invite-codes — list all invite codes (with used-by name via join)
router.get("/invite-codes", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const rows = await db
    .select({
      id: inviteCodesTable.id,
      code: inviteCodesTable.code,
      planSlug: inviteCodesTable.planSlug,
      label: inviteCodesTable.label,
      used: inviteCodesTable.used,
      usedByEmail: inviteCodesTable.usedByEmail,
      usedByUserId: inviteCodesTable.usedByUserId,
      usedByWorkspaceId: inviteCodesTable.usedByWorkspaceId,
      usedAt: inviteCodesTable.usedAt,
      createdAt: inviteCodesTable.createdAt,
      usedByName: usersTable.name,
    })
    .from(inviteCodesTable)
    .leftJoin(usersTable, eq(inviteCodesTable.usedByUserId, usersTable.id))
    .orderBy(desc(inviteCodesTable.createdAt));
  res.json({ codes: rows });
});

// POST /api/admin/invite-codes/generate — generate N new invite codes
router.post("/invite-codes/generate", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const { count = 10, planSlug = "agency", label } = req.body as {
    count?: number;
    planSlug?: string;
    label?: string;
  };

  const toInsert = Array.from({ length: Math.min(count, 50) }, () => ({
    code: generateInviteCode(),
    planSlug,
    label: label ?? null,
  }));

  const inserted = await db
    .insert(inviteCodesTable)
    .values(toInsert)
    .returning();

  res.status(201).json({ codes: inserted });
});

// DELETE /api/admin/invite-codes/:id — delete a free invite code
router.delete("/invite-codes/:id", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const id = req.params["id"] as string;
  const [code] = await db
    .select()
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.id, id))
    .limit(1);
  if (!code) { res.status(404).json({ error: "Código não encontrado" }); return; }
  if (code.used) { res.status(409).json({ error: "Código já utilizado — não pode ser deletado" }); return; }
  await db.delete(inviteCodesTable).where(eq(inviteCodesTable.id, id));
  res.json({ ok: true });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs/summary — aggregate stats
router.get("/audit-logs/summary", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const summary = await getAgentExecutionLogsSummary();
  res.json(summary);
});

// GET /api/admin/audit-logs — list with filters
router.get("/audit-logs", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const q = req.query as Record<string, string>;
  const logs = await queryAgentExecutionLogs({
    campaignId:       q["campaignId"],
    agentName:        q["agentName"],
    executionStatus:  q["executionStatus"],
    minRiskScore:     q["minRiskScore"] !== undefined ? parseFloat(q["minRiskScore"]) : undefined,
    approvalRequired: q["approvalRequired"] !== undefined ? q["approvalRequired"] === "true" : undefined,
    isDryRun:         q["isDryRun"] !== undefined ? q["isDryRun"] === "true" : undefined,
    dateFrom:         q["dateFrom"],
    dateTo:           q["dateTo"],
    limit:            q["limit"] !== undefined ? parseInt(q["limit"], 10) : 50,
    offset:           q["offset"] !== undefined ? parseInt(q["offset"], 10) : 0,
  });
  res.json({ logs });
});

// GET /api/admin/audit-logs/:id — single log detail
router.get("/audit-logs/:id", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const log = await getAgentExecutionLogById(req.params["id"] as string);
  if (!log) { res.status(404).json({ error: "Log não encontrado" }); return; }
  res.json({ log });
});

export default router;
