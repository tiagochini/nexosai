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

export default router;
