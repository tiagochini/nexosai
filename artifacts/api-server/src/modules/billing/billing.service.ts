import { eq, and, desc } from "drizzle-orm";
import {
  db,
  subscriptionPaymentsTable,
  workspacesTable,
  plansTable,
  type SubscriptionPayment,
  type PaymentMethod,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

// ─── Asaas API ────────────────────────────────────────────────────────────────

const ASAAS_BASE = process.env["ASAAS_ENV"] === "production"
  ? "https://api.asaas.com/v3"
  : "https://sandbox.asaas.com/api/v3";

async function asaasRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env["ASAAS_API_KEY"];
  if (!apiKey) throw new AppError(503, "Asaas não configurado", "ASAAS_NOT_CONFIGURED");

  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...options.headers,
    },
  });

  const data = (await res.json()) as T & { errors?: Array<{ description: string }> };
  if (!res.ok) {
    const msg = (data as { errors?: Array<{ description: string }> }).errors?.[0]?.description
      ?? `Asaas API error ${res.status}`;
    throw new AppError(res.status >= 500 ? 502 : 400, msg, "ASAAS_ERROR");
  }
  return data;
}

// ─── PIX via Asaas ───────────────────────────────────────────────────────────

async function createAsaasPix(opts: {
  customerId?: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  amountCents: number;
  description: string;
  dueDate: string;
}): Promise<{ asaasId: string; qrCode: string; copiaECola: string; expiresAt: string }> {
  // Ensure customer exists in Asaas
  let customerId = opts.customerId;
  if (!customerId) {
    const customer = await asaasRequest<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: opts.name,
        email: opts.email,
        cpfCnpj: opts.cpfCnpj ?? "00000000000",
      }),
    });
    customerId = customer.id;
  }

  // Create payment
  const payment = await asaasRequest<{ id: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: opts.amountCents / 100,
      dueDate: opts.dueDate,
      description: opts.description,
    }),
  });

  // Get PIX QR code
  const pix = await asaasRequest<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  }>(`/payments/${payment.id}/pixQrCode`);

  return {
    asaasId: payment.id,
    qrCode: pix.encodedImage,
    copiaECola: pix.payload,
    expiresAt: pix.expirationDate,
  };
}

// ─── Crypto addresses ─────────────────────────────────────────────────────────

const CRYPTO_WALLETS = {
  USDT: {
    address: process.env["CRYPTO_USDT_ADDRESS"] ?? "",
    network: process.env["CRYPTO_USDT_NETWORK"] ?? "TRC20",
  },
  BTC: {
    address: process.env["CRYPTO_BTC_ADDRESS"] ?? "",
    network: "Bitcoin",
  },
  ETH: {
    address: process.env["CRYPTO_ETH_ADDRESS"] ?? "",
    network: "ERC20",
  },
} as const;

const BANK_TRANSFER_DATA = {
  bank: process.env["BANK_NAME"] ?? "Inter",
  agency: process.env["BANK_AGENCY"] ?? "",
  account: process.env["BANK_ACCOUNT"] ?? "",
  accountType: process.env["BANK_ACCOUNT_TYPE"] ?? "corrente",
  cnpj: process.env["COMPANY_CNPJ"] ?? "",
  companyName: process.env["COMPANY_NAME"] ?? "NexOS AI",
  instructions: "Envie o comprovante após a transferência para confirmar o acesso.",
};

// ─── Service ──────────────────────────────────────────────────────────────────

export async function initiatePayment(opts: {
  workspaceId: string;
  userId: string;
  planId: string;
  method: PaymentMethod;
  userName: string;
  userEmail: string;
}): Promise<SubscriptionPayment> {
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, opts.planId))
    .limit(1);

  if (!plan) throw new NotFoundError("Plano não encontrado");

  const amountCents = Math.round(Number(plan.priceMonthly) * 100);
  const description = `NexOS AI — Plano ${plan.name}`;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  let pixData = undefined;
  let cryptoData = undefined;
  let bankTransferData = undefined;
  let externalId: string | undefined;
  let expiresAt: Date | undefined;

  switch (opts.method) {
    case "pix": {
      try {
        const pix = await createAsaasPix({
          name: opts.userName,
          email: opts.userEmail,
          amountCents,
          description,
          dueDate,
        });
        pixData = {
          qrCode: pix.qrCode,
          copiaECola: pix.copiaECola,
          expiresAt: pix.expiresAt,
          asaasId: pix.asaasId,
        };
        externalId = pix.asaasId;
        expiresAt = new Date(pix.expiresAt);
      } catch (err) {
        // Asaas not configured — create pending manual PIX
        if (err instanceof AppError && err.code === "ASAAS_NOT_CONFIGURED") {
          pixData = { instructions: "Entre em contato para receber os dados de PIX." };
        } else {
          throw err;
        }
      }
      break;
    }

    case "crypto_usdt": {
      const wallet = CRYPTO_WALLETS.USDT;
      if (!wallet.address) throw new AppError(503, "Carteira USDT não configurada", "CRYPTO_NOT_CONFIGURED");
      // Approximate BRL → USDT (rate fetched at payment time — placeholder)
      const usdtAmount = amountCents / 100 / 5.2;
      cryptoData = {
        address: wallet.address,
        network: wallet.network,
        amount: Math.ceil(usdtAmount * 100) / 100,
        currency: "USDT",
        exchangeRate: 5.2,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
      expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      break;
    }

    case "crypto_btc": {
      const wallet = CRYPTO_WALLETS.BTC;
      if (!wallet.address) throw new AppError(503, "Carteira BTC não configurada", "CRYPTO_NOT_CONFIGURED");
      cryptoData = {
        address: wallet.address,
        network: wallet.network,
        currency: "BTC",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
      expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      break;
    }

    case "crypto_eth": {
      const wallet = CRYPTO_WALLETS.ETH;
      if (!wallet.address) throw new AppError(503, "Carteira ETH não configurada", "CRYPTO_NOT_CONFIGURED");
      cryptoData = {
        address: wallet.address,
        network: wallet.network,
        currency: "ETH",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
      expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      break;
    }

    case "bank_transfer": {
      bankTransferData = BANK_TRANSFER_DATA;
      expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      break;
    }

    default:
      throw new AppError(400, `Método de pagamento não suportado: ${opts.method}`, "INVALID_METHOD");
  }

  const [payment] = await db
    .insert(subscriptionPaymentsTable)
    .values({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      planId: opts.planId,
      amountCents,
      currency: "BRL",
      method: opts.method,
      status: "pending",
      description,
      externalId: externalId ?? null,
      pixData: pixData ?? null,
      cryptoData: cryptoData ?? null,
      bankTransferData: bankTransferData ?? null,
      expiresAt: expiresAt ?? null,
      metadata: {},
    })
    .returning();

  if (!payment) throw new AppError(500, "Falha ao criar pagamento", "DB_ERROR");

  logger.info({ workspaceId: opts.workspaceId, method: opts.method, amountCents }, "Payment initiated");
  return payment;
}

export async function confirmPaymentByExternalId(
  externalId: string,
  providerPayload: unknown
): Promise<void> {
  const [payment] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.externalId, externalId))
    .limit(1);

  if (!payment) {
    logger.warn({ externalId }, "Payment not found for external ID");
    return;
  }

  if (payment.status === "paid") return;

  await db
    .update(subscriptionPaymentsTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      metadata: { ...(payment.metadata as object), providerPayload },
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPaymentsTable.id, payment.id));

  logger.info({ paymentId: payment.id, workspaceId: payment.workspaceId }, "Payment confirmed");
}

export async function markPaymentPaid(
  workspaceId: string,
  paymentId: string,
  adminNote?: string
): Promise<SubscriptionPayment> {
  const [payment] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(
      and(
        eq(subscriptionPaymentsTable.id, paymentId),
        eq(subscriptionPaymentsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!payment) throw new NotFoundError("Pagamento não encontrado");

  const [updated] = await db
    .update(subscriptionPaymentsTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      metadata: { ...(payment.metadata as object), adminNote, confirmedManually: true },
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPaymentsTable.id, paymentId))
    .returning();

  return updated!;
}

export async function getPaymentHistory(
  workspaceId: string,
  limit = 20
): Promise<SubscriptionPayment[]> {
  return db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.workspaceId, workspaceId))
    .orderBy(desc(subscriptionPaymentsTable.createdAt))
    .limit(limit);
}

export async function getSubscriptionStatus(workspaceId: string): Promise<{
  isActive: boolean;
  lastPayment: SubscriptionPayment | null;
  planName: string | null;
  nextDueDate: Date | null;
}> {
  const payments = await db
    .select({
      payment: subscriptionPaymentsTable,
      planName: plansTable.name,
    })
    .from(subscriptionPaymentsTable)
    .innerJoin(plansTable, eq(subscriptionPaymentsTable.planId, plansTable.id))
    .where(
      and(
        eq(subscriptionPaymentsTable.workspaceId, workspaceId),
        eq(subscriptionPaymentsTable.status, "paid")
      )
    )
    .orderBy(desc(subscriptionPaymentsTable.paidAt))
    .limit(1);

  const last = payments[0];
  if (!last) {
    return { isActive: false, lastPayment: null, planName: null, nextDueDate: null };
  }

  const paidAt = last.payment.paidAt!;
  const nextDue = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isActive = nextDue > new Date();

  return {
    isActive,
    lastPayment: last.payment,
    planName: last.planName,
    nextDueDate: nextDue,
  };
}

export async function processAsaasWebhook(body: unknown): Promise<void> {
  const payload = body as {
    event?: string;
    payment?: { id?: string; status?: string };
  };

  const asaasId = payload.payment?.id;
  const event = payload.event;

  if (!asaasId) return;

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    await confirmPaymentByExternalId(asaasId, payload);
  }
}

export async function getWorkspaceByPaymentToken(token: string) {
  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, token))
    .limit(1);
  return workspace;
}
