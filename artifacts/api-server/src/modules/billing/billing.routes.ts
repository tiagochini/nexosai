import { Router } from "express";
import { z } from "zod/v4";
import crypto from "crypto";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  initiatePayment,
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

// ─── Initiate payment ─────────────────────────────────────────────────────────

const initiateSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum([
    "pix",
    "bank_transfer",
    "crypto_usdt",
    "crypto_btc",
    "crypto_eth",
    "credit_card",
    "manual",
  ]),
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
  });

  res.status(201).json({ payment });
});

// ─── Manual confirmation (admin or user upload proof) ────────────────────────

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

// ─── Crypto payment verification (manual + auto) ─────────────────────────────

router.get("/crypto/addresses", requireAuth, async (_req, res): Promise<void> => {
  const addresses = {
    usdt: {
      address: process.env["CRYPTO_USDT_ADDRESS"] ?? null,
      network: process.env["CRYPTO_USDT_NETWORK"] ?? "TRC20",
    },
    btc: {
      address: process.env["CRYPTO_BTC_ADDRESS"] ?? null,
      network: "Bitcoin",
    },
    eth: {
      address: process.env["CRYPTO_ETH_ADDRESS"] ?? null,
      network: "ERC20",
    },
  };
  const configured = Object.entries(addresses)
    .filter(([, v]) => v.address)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  res.json({ addresses: configured });
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
    instructions: "Envie o comprovante para suporte@nexos.ai após a transferência.",
  };
  res.json({ bankTransfer: info });
});

export default router;
