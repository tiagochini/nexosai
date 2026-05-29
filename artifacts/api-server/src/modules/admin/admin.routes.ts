import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview, getAdminFinancials, getAdminPayments } from "./admin.service.js";
import { queryAgentExecutionLogs, getAgentExecutionLogById, getAgentExecutionLogsSummary } from "./audit-logs.service.js";
import { markPaymentPaid } from "../billing/billing.service.js";
import { UnauthorizedError, NotFoundError } from "../../lib/errors.js";
import {
  db, inviteCodesTable, usersTable, workspacesTable, plansTable,
  subscriptionPaymentsTable, campaignsTable, creditTransactionsTable,
  waitlistTable,
} from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";

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

// ─── Grant plan access to existing workspace ──────────────────────────────────
router.post("/workspaces/:workspaceId/grant-plan", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const { workspaceId } = req.params as { workspaceId: string };
  const { planSlug, note } = req.body as { planSlug?: string; note?: string };

  if (!planSlug || !["solo", "agency"].includes(planSlug)) {
    res.status(400).json({ error: "planSlug deve ser 'solo' ou 'agency'" });
    return;
  }

  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  if (!workspace) throw new NotFoundError("Workspace não encontrado");

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug as "solo" | "agency")).limit(1);
  if (!plan) throw new NotFoundError("Plano não encontrado");

  await db.update(workspacesTable)
    .set({
      planId: plan.id,
      creditsBalance: Math.max(workspace.creditsBalance ?? 0, plan.creditsMonthly),
    })
    .where(eq(workspacesTable.id, workspaceId));

  req.log.info({ workspaceId, planSlug, grantedBy: req.auth.email, note: note ?? null }, "admin grant-plan");
  res.json({ ok: true, planName: plan.name, creditsGranted: plan.creditsMonthly });
});

// ─── User detail / profile ────────────────────────────────────────────────────
router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const { userId } = req.params as { userId: string };

  const [user] = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
      workspaceId: workspacesTable.id,
      workspaceName: workspacesTable.name,
      workspaceStatus: workspacesTable.status,
      planId: workspacesTable.planId,
      planName: plansTable.name,
      planSlug: plansTable.slug,
      creditsBalance: workspacesTable.creditsBalance,
      activeCampaigns: workspacesTable.activeCampaigns,
    })
    .from(usersTable)
    .innerJoin(workspacesTable, eq(workspacesTable.ownerId, usersTable.id))
    .leftJoin(plansTable, eq(plansTable.id, workspacesTable.planId))
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError("Usuário não encontrado");

  // Invite code used at registration (lead source)
  const [invite] = await db
    .select({ code: inviteCodesTable.code, planSlug: inviteCodesTable.planSlug, usedAt: inviteCodesTable.usedAt })
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.usedByUserId, userId))
    .limit(1);

  // Payments
  const payments = await db
    .select({
      id: subscriptionPaymentsTable.id,
      amountCents: subscriptionPaymentsTable.amountCents,
      currency: subscriptionPaymentsTable.currency,
      method: subscriptionPaymentsTable.method,
      status: subscriptionPaymentsTable.status,
      description: subscriptionPaymentsTable.description,
      createdAt: subscriptionPaymentsTable.createdAt,
      paidAt: subscriptionPaymentsTable.paidAt,
    })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.workspaceId, user.workspaceId))
    .orderBy(desc(subscriptionPaymentsTable.createdAt))
    .limit(20);

  // Campaigns
  const campaigns = await db
    .select({
      id: campaignsTable.id,
      name: campaignsTable.title,
      type: campaignsTable.type,
      status: campaignsTable.status,
      track: campaignsTable.track,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, user.workspaceId))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(20);

  // Credit usage stats
  const [creditStats] = await db
    .select({
      totalDebited: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactionsTable.type}='debit' THEN ${creditTransactionsTable.amount} ELSE 0 END),0)`.mapWith(Number),
      totalCredited: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactionsTable.type}='credit' THEN ${creditTransactionsTable.amount} ELSE 0 END),0)`.mapWith(Number),
      txCount: count(),
    })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, user.workspaceId));

  // Recent credit transactions
  const recentCredits = await db
    .select({
      id: creditTransactionsTable.id,
      type: creditTransactionsTable.type,
      amount: creditTransactionsTable.amount,
      action: creditTransactionsTable.action,
      createdAt: creditTransactionsTable.createdAt,
    })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, user.workspaceId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(10);

  res.json({
    user,
    leadSource: invite ?? null,
    payments,
    campaigns,
    creditStats: creditStats ?? { totalDebited: 0, totalCredited: 0, txCount: 0 },
    recentCredits,
  });
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

// ─── Waitlist / Access Requests ───────────────────────────────────────────────

// GET /api/admin/waitlist — list all waitlist entries
router.get("/waitlist", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const rows = await db
    .select()
    .from(waitlistTable)
    .orderBy(desc(waitlistTable.createdAt));
  res.json({ entries: rows, total: rows.length });
});

// POST /api/admin/waitlist/:id/approve — generate invite code + mark as notified
router.post("/waitlist/:id/approve", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const id = req.params["id"] as string;
  const { planSlug = "solo" } = req.body as { planSlug?: string };

  const [entry] = await db
    .select()
    .from(waitlistTable)
    .where(eq(waitlistTable.id, id))
    .limit(1);
  if (!entry) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

  const code = generateInviteCode();
  const [invite] = await db
    .insert(inviteCodesTable)
    .values({ code, planSlug, label: `waitlist:${entry.whatsapp}` })
    .returning();

  await db
    .update(waitlistTable)
    .set({ notified: true, confirmedAt: new Date() })
    .where(eq(waitlistTable.id, id));

  res.status(201).json({ code: invite!.code, planSlug, entry });
});

// DELETE /api/admin/waitlist/:id — remove / reject entry
router.delete("/waitlist/:id", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const id = req.params["id"] as string;
  await db.delete(waitlistTable).where(eq(waitlistTable.id, id));
  res.json({ ok: true });
});

export default router;
