import { Router } from "express";
import { z } from "zod/v4";
import { eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { academyPurchasesTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import {
  findOrCreateCustomer,
  createPayment,
  generateAccessToken,
  sendAccessEmail,
} from "./academy.service.js";

const router = Router();

const ACADEMY_PRODUCTS: Record<string, { name: string; amountBrl: number }> = {
  "mini-guide": { name: "Mini-Guia: Primeiros R$10k Online", amountBrl: 10 },
  "complete-bundle": { name: "Metodologia NexOS — Edição Completa", amountBrl: 2500 },
};

const checkoutSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.email(),
  productId: z.enum(["mini-guide", "complete-bundle"]),
});

// POST /api/academy/checkout
// Creates Asaas customer + payment, returns paymentUrl
router.post("/checkout", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = checkoutSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email e produto." });
    return;
  }

  const product = ACADEMY_PRODUCTS[parsed.productId];
  if (!product) {
    res.status(400).json({ error: "Produto não encontrado." });
    return;
  }

  // Check if this email already has a confirmed purchase for this product
  const existing = await db
    .select()
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.customerEmail, parsed.email.toLowerCase()))
    .limit(10);

  const confirmedForProduct = existing.find(
    p => p.productId === parsed.productId && p.status === "confirmed"
  );
  if (confirmedForProduct) {
    // Resend the access email
    setImmediate(() => {
      sendAccessEmail({
        email: parsed.email,
        name: parsed.name,
        token: confirmedForProduct.accessToken,
        productName: product.name,
        portalUrl: `${env.APP_URL}/nexos-academy/`,
      }).catch(err => logger.error({ err }, "academy: resend email error"));
    });
    res.json({
      alreadyPurchased: true,
      message: "Você já tem acesso! Reenviamos o código para o seu e-mail.",
    });
    return;
  }

  try {
    // Create or find Asaas customer
    const customer = await findOrCreateCustomer(parsed.name, parsed.email.toLowerCase());

    // Pre-generate the access token and create the pending purchase record
    const accessToken = generateAccessToken();

    const [purchase] = await db
      .insert(academyPurchasesTable)
      .values({
        accessToken,
        customerEmail: parsed.email.toLowerCase(),
        customerName: parsed.name,
        productId: parsed.productId,
        asaasCustomerId: customer.id,
        status: "pending",
        amountCents: Math.round(product.amountBrl * 100),
      })
      .returning();

    // Create Asaas payment
    const successUrl = `${env.APP_URL}/nexos-academy/?payment=success`;
    const payment = await createPayment({
      customerId: customer.id,
      amountBrl: product.amountBrl,
      description: product.name,
      externalReference: purchase.id,
      successUrl,
    });

    // Update purchase with Asaas payment ID and URL
    await db
      .update(academyPurchasesTable)
      .set({ asaasPaymentId: payment.id, paymentUrl: payment.invoiceUrl })
      .where(eq(academyPurchasesTable.id, purchase.id));

    logger.info({ purchaseId: purchase.id, paymentId: payment.id }, "academy: checkout created");

    res.json({ paymentUrl: payment.invoiceUrl });
  } catch (err) {
    logger.error({ err }, "academy: checkout error");
    res.status(502).json({ error: err instanceof Error ? err.message : "Erro ao processar pagamento." });
  }
});

// POST /api/academy/webhook
// Asaas webhook — confirms payment and activates access token
router.post("/webhook", async (req, res): Promise<void> => {
  const event = req.body?.event as string | undefined;
  const payment = req.body?.payment as {
    id?: string;
    externalReference?: string;
    status?: string;
    value?: number;
  } | undefined;

  logger.info({ event, paymentId: payment?.id }, "academy: webhook received");

  if (!event || !payment) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  const confirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_APPROVED_BY_RISK_ANALYSIS"];
  if (!confirmedEvents.includes(event)) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const purchaseId = payment.externalReference;
  if (!purchaseId) {
    logger.warn({ paymentId: payment.id }, "academy: webhook missing externalReference");
    res.json({ ok: true });
    return;
  }

  const [purchase] = await db
    .select()
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.id, purchaseId))
    .limit(1);

  if (!purchase) {
    logger.warn({ purchaseId }, "academy: purchase not found in webhook");
    res.json({ ok: true });
    return;
  }

  if (purchase.status === "confirmed") {
    res.json({ ok: true, alreadyConfirmed: true });
    return;
  }

  await db
    .update(academyPurchasesTable)
    .set({ status: "confirmed", confirmedAt: new Date(), asaasPaymentId: payment.id ?? purchase.asaasPaymentId })
    .where(eq(academyPurchasesTable.id, purchase.id));

  logger.info({ purchaseId, token: purchase.accessToken, email: purchase.customerEmail }, "academy: purchase confirmed");

  // Send access email non-blocking
  const productInfo = ACADEMY_PRODUCTS[purchase.productId];
  setImmediate(() => {
    sendAccessEmail({
      email: purchase.customerEmail,
      name: purchase.customerName ?? purchase.customerEmail,
      token: purchase.accessToken,
      productName: productInfo?.name ?? purchase.productId,
      portalUrl: `${env.APP_URL}/nexos-academy/`,
    }).catch(err => logger.error({ err }, "academy: access email error"));
  });

  res.json({ ok: true, token: purchase.accessToken });
});

// GET /api/academy/verify/:token
// Validates an access token — no auth required
router.get("/verify/:token", async (req, res): Promise<void> => {
  const token = req.params.token?.toUpperCase().trim();
  if (!token || token.length < 8) {
    res.status(400).json({ valid: false, error: "Token inválido." });
    return;
  }

  const [purchase] = await db
    .select({
      id: academyPurchasesTable.id,
      status: academyPurchasesTable.status,
      productId: academyPurchasesTable.productId,
      customerEmail: academyPurchasesTable.customerEmail,
      customerName: academyPurchasesTable.customerName,
    })
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.accessToken, token))
    .limit(1);

  if (!purchase) {
    res.status(404).json({ valid: false, error: "Código não encontrado." });
    return;
  }

  if (purchase.status !== "confirmed") {
    res.status(402).json({ valid: false, error: "Pagamento ainda não confirmado. Aguarde alguns minutos." });
    return;
  }

  res.json({
    valid: true,
    productId: purchase.productId,
    email: purchase.customerEmail,
    name: purchase.customerName,
  });
});

// POST /api/academy/simulate-confirm (dev/owner only — manually confirms a pending purchase)
router.post("/simulate-confirm", async (req, res): Promise<void> => {
  if (env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production." });
    return;
  }

  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  const [purchase] = await db
    .select()
    .from(academyPurchasesTable)
    .where(or(
      eq(academyPurchasesTable.accessToken, token.toUpperCase()),
      eq(academyPurchasesTable.id, token)
    ))
    .limit(1);

  if (!purchase) {
    res.status(404).json({ error: "Purchase not found" });
    return;
  }

  await db
    .update(academyPurchasesTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(academyPurchasesTable.id, purchase.id));

  res.json({ ok: true, token: purchase.accessToken, email: purchase.customerEmail });
});

export default router;
