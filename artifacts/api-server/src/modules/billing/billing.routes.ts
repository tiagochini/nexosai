import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  initiatePayment,
  initiatePackPayment,
  getPaymentById,
  getPaymentHistory,
  getSubscriptionStatus,
  markPaymentPaid,
  processAsaasWebhook,
} from "./billing.service.js";
import { db, inviteCodesTable, workspacesTable, plansTable, subscriptionPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Subscription status ──────────────────────────────────────────────────────

router.get("/status", requireAuth, async (req, res): Promise<void> => {
  const status = await getSubscriptionStatus(req.auth.workspaceId);
  res.json(status);
});

router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt(req.query["limit"] as string ?? "20", 10);
  const payments = await getPaymentHistory(req.auth.workspaceId, limit);
  res.json({ payments });
});

// ─── Payment status polling ───────────────────────────────────────────────────

router.get("/payment/:paymentId", requireAuth, async (req, res): Promise<void> => {
  const paymentId = req.params["paymentId"] as string;
  const payment = await getPaymentById(req.auth.workspaceId, paymentId);
  if (!payment) {
    res.status(404).json({ error: "Pagamento não encontrado", code: "NOT_FOUND" });
    return;
  }
  res.json({ payment });
});

// ─── Initiate plan payment ────────────────────────────────────────────────────

const cardDataSchema = z.object({
  holderName: z.string().min(1),
  number: z.string().min(13),
  expiryMonth: z.string().length(2),
  expiryYear: z.string().min(4),
  cvv: z.string().min(3).max(4),
  cpfCnpj: z.string().optional(),
  phone: z.string().optional(),
  postalCode: z.string().optional(),
});

const initiateSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum(["pix", "boleto", "bank_transfer", "credit_card", "manual"]),
  card: cardDataSchema.optional(),
});

router.post("/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const payment = await initiatePayment({
    workspaceId: req.auth.workspaceId,
    userId: req.auth.userId,
    planId: parsed.data.planId,
    method: parsed.data.method,
    userName: req.auth.email,
    userEmail: req.auth.email,
    card: parsed.data.card,
  });

  res.status(201).json({ payment });
});

// ─── Initiate pack payment ────────────────────────────────────────────────────

const initiatePackSchema = z.object({
  packId: z.string(),
  method: z.enum(["pix", "boleto", "bank_transfer", "credit_card", "manual"]),
  card: cardDataSchema.optional(),
});

router.post("/packs/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = initiatePackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const payment = await initiatePackPayment({
    workspaceId: req.auth.workspaceId,
    userId: req.auth.userId,
    packId: parsed.data.packId,
    method: parsed.data.method,
    card: parsed.data.card,
    userName: req.auth.email,
    userEmail: req.auth.email,
  });

  res.status(201).json({ payment });
});

// ─── Manual confirmation ──────────────────────────────────────────────────────

router.post("/confirm/:paymentId", requireAuth, async (req, res): Promise<void> => {
  const paymentId = req.params["paymentId"] as string;
  const note = (req.body as { note?: string }).note;
  const payment = await markPaymentPaid(req.auth.workspaceId, paymentId, note);
  res.json({ payment });
});

// ─── Asaas webhook (public) ───────────────────────────────────────────────────

router.post("/webhooks/asaas", async (req, res): Promise<void> => {
  const webhookSecret = process.env["ASAAS_WEBHOOK_SECRET"];
  if (webhookSecret) {
    const signature = req.headers["asaas-access-token"] as string | undefined;
    if (signature !== webhookSecret) {
      res.status(401).json({ error: "Invalid webhook token" });
      return;
    }
  }
  await processAsaasWebhook(req.body);
  res.status(200).json({ received: true });
});

// ─── Bank transfer info ───────────────────────────────────────────────────────

router.get("/bank-transfer", requireAuth, async (_req, res): Promise<void> => {
  const info = {
    bank: process.env["BANK_NAME"] ?? null,
    agency: process.env["BANK_AGENCY"] ?? null,
    account: process.env["BANK_ACCOUNT"] ?? null,
    accountType: process.env["BANK_ACCOUNT_TYPE"] ?? null,
    cnpj: process.env["COMPANY_CNPJ"] ?? null,
    companyName: process.env["COMPANY_NAME"] ?? "NexOS AI",
    instructions: "Envie o comprovante para suporte@agencianexos.vip após a transferência.",
  };
  res.json({ bankTransfer: info });
});

// ─── Platform access check (logged-in user) ───────────────────────────────────
router.get("/access", requireAuth, async (req, res): Promise<void> => {
  const ADMIN_EMAILS = new Set(["admin@nexos.ai", "founder@nexos.ai", "admin@agencianexos.vip", "founder@agencianexos.vip"]);
  if (ADMIN_EMAILS.has(req.auth.email)) {
    res.json({ hasAccess: true, reason: "admin" });
    return;
  }

  // Paid access
  const [paidPayment] = await db
    .select({ id: subscriptionPaymentsTable.id })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.workspaceId, req.auth.workspaceId))
    .limit(1);
  if (paidPayment) { res.json({ hasAccess: true, reason: "paid" }); return; }

  // Invite code used at registration
  const [invite] = await db
    .select({ id: inviteCodesTable.id })
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.usedByWorkspaceId, req.auth.workspaceId))
    .limit(1);
  if (invite) { res.json({ hasAccess: true, reason: "invite_code" }); return; }

  // Plan assigned — workspace went through a legitimate registration or admin setup
  // (covers invite-code registrations where the invite row wasn't linked, and admin-created test users)
  const [ws] = await db
    .select({ planId: workspacesTable.planId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  if (ws?.planId) { res.json({ hasAccess: true, reason: "plan_assigned" }); return; }

  res.json({ hasAccess: false, reason: "none" });
});

// ─── Redeem invite code (logged-in user) ──────────────────────────────────────
router.post("/redeem-code", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "Informe o código." }); return; }

  const normalized = code.toUpperCase().trim();
  const [invite] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, normalized)).limit(1);

  if (!invite) { res.status(404).json({ error: "Código não encontrado. Verifique e tente novamente." }); return; }
  if (invite.used) { res.status(409).json({ error: "Este código já foi utilizado." }); return; }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, invite.planSlug as "solo" | "agency")).limit(1);
  if (!plan) { res.status(500).json({ error: "Plano associado ao código não encontrado." }); return; }

  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  if (!workspace) { res.status(404).json({ error: "Workspace não encontrado." }); return; }

  await db.update(workspacesTable)
    .set({
      planId: plan.id,
      creditsBalance: Math.max(workspace.creditsBalance ?? 0, plan.creditsMonthly),
    })
    .where(eq(workspacesTable.id, req.auth.workspaceId));

  await db.update(inviteCodesTable)
    .set({
      used: true,
      usedByEmail: req.auth.email,
      usedByUserId: req.auth.userId,
      usedByWorkspaceId: req.auth.workspaceId,
      usedAt: new Date(),
    })
    .where(eq(inviteCodesTable.code, normalized));

  res.json({ ok: true, planName: plan.name, planSlug: plan.slug, creditsGranted: plan.creditsMonthly });
});

export default router;
