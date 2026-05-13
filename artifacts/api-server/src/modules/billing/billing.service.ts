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
import { grantCredits } from "../credits/credits.service.js";

// ─── Asaas API ────────────────────────────────────────────────────────────────

const ASAAS_BASE =
  process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

async function asaasRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const msg =
      (data as { errors?: Array<{ description: string }> }).errors?.[0]?.description ??
      `Asaas API error ${res.status}`;
    throw new AppError(res.status >= 500 ? 502 : 400, msg, "ASAAS_ERROR");
  }
  return data;
}

async function ensureAsaasCustomer(name: string, email: string, cpfCnpj?: string): Promise<string> {
  const customer = await asaasRequest<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, cpfCnpj: cpfCnpj ?? "00000000000" }),
  });
  return customer.id;
}

// ─── PIX via Asaas ───────────────────────────────────────────────────────────

async function createAsaasPix(opts: {
  name: string;
  email: string;
  cpfCnpj?: string;
  amountCents: number;
  description: string;
  dueDate: string;
}): Promise<{ asaasId: string; qrCode: string; copiaECola: string; expiresAt: string }> {
  const customerId = await ensureAsaasCustomer(opts.name, opts.email, opts.cpfCnpj);

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

// ─── Boleto via Asaas ────────────────────────────────────────────────────────

async function createAsaasBoleto(opts: {
  name: string;
  email: string;
  cpfCnpj?: string;
  amountCents: number;
  description: string;
  dueDate: string;
}): Promise<{ asaasId: string; bankSlipUrl: string; barcode: string; nossoNumero: string }> {
  const customerId = await ensureAsaasCustomer(opts.name, opts.email, opts.cpfCnpj);

  const payment = await asaasRequest<{
    id: string;
    bankSlipUrl?: string;
    nossoNumero?: string;
  }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "BOLETO",
      value: opts.amountCents / 100,
      dueDate: opts.dueDate,
      description: opts.description,
    }),
  });

  const idf = await asaasRequest<{ identificationField?: string }>(
    `/payments/${payment.id}/identificationField`
  );

  return {
    asaasId: payment.id,
    bankSlipUrl: payment.bankSlipUrl ?? "",
    barcode: idf.identificationField ?? "",
    nossoNumero: payment.nossoNumero ?? "",
  };
}

// ─── Credit card via Asaas ───────────────────────────────────────────────────

/** Adds 3.5% card fee to the base amount (passed to buyer). */
export function applyCardFee(amountCents: number): number {
  return Math.round(amountCents * 1.035);
}

interface AsaasCardOpts {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  postalCode?: string;
  amountCents: number;
  description: string;
  dueDate: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCvv: string;
}

async function createAsaasCardPayment(opts: AsaasCardOpts): Promise<{
  asaasId: string;
  last4: string;
  brand: string;
  status: string;
}> {
  const customerId = await ensureAsaasCustomer(opts.name, opts.email, opts.cpfCnpj);

  const payment = await asaasRequest<{
    id: string;
    status: string;
    creditCard?: { creditCardBrand: string; creditCardNumber: string };
  }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: opts.amountCents / 100,
      dueDate: opts.dueDate,
      description: opts.description,
      creditCard: {
        holderName: opts.cardHolderName,
        number: opts.cardNumber.replace(/\D/g, ""),
        expiryMonth: opts.cardExpiryMonth,
        expiryYear: opts.cardExpiryYear,
        ccv: opts.cardCvv,
      },
      creditCardHolderInfo: {
        name: opts.name,
        email: opts.email,
        cpfCnpj: opts.cpfCnpj ?? "00000000000",
        postalCode: opts.postalCode ?? "00000000",
        addressNumber: "S/N",
        phone: opts.phone ?? "00000000000",
      },
    }),
  });

  return {
    asaasId: payment.id,
    last4: payment.creditCard?.creditCardNumber ?? "****",
    brand: payment.creditCard?.creditCardBrand ?? "VISA",
    status: payment.status,
  };
}

// ─── Pack config (mirrors frontend) ──────────────────────────────────────────

export const PACK_CONFIG: Record<string, { credits: number; priceBrl: number; label: string }> = {
  pack_500:  { credits: 500,  priceBrl: 85,  label: "Pack Lançamento Extra (500 créditos)" },
  pack_1500: { credits: 1500, priceBrl: 239, label: "Pack Trimestral (1.500 créditos)" },
  pack_3500: { credits: 3500, priceBrl: 529, label: "Pack Semestral (3.500 créditos)" },
  pack_7000: { credits: 7000, priceBrl: 979, label: "Pack Anual (7.000 créditos)" },
};

// ─── Shared Asaas payment builder ─────────────────────────────────────────────

export interface CardInputData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cpfCnpj?: string;
  phone?: string;
  postalCode?: string;
}

type PaymentData = Pick<
  SubscriptionPayment,
  "pixData" | "boletoData" | "bankTransferData" | "cryptoData"
> & {
  externalId: string | null;
  expiresAt: Date | null;
  chargedCents: number;
  cardResult?: { last4: string; brand: string; status: string; asaasId: string };
};

async function buildAsaasPayment(
  method: PaymentMethod,
  opts: { name: string; email: string; amountCents: number; description: string; dueDate: string },
  card?: CardInputData
): Promise<PaymentData> {
  const result: PaymentData = {
    pixData: null,
    boletoData: null,
    bankTransferData: null,
    cryptoData: null,
    externalId: null,
    expiresAt: null,
    chargedCents: opts.amountCents,
  };

  switch (method) {
    case "pix": {
      try {
        const pix = await createAsaasPix(opts);
        result.pixData = {
          qrCode: pix.qrCode,
          copiaECola: pix.copiaECola,
          expiresAt: pix.expiresAt,
          asaasId: pix.asaasId,
        };
        result.externalId = pix.asaasId;
        result.expiresAt = new Date(pix.expiresAt);
      } catch (err) {
        if (err instanceof AppError && err.code === "ASAAS_NOT_CONFIGURED") {
          result.pixData = { instructions: "Entre em contato: suporte@nexos.ai" };
          result.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else { throw err; }
      }
      break;
    }

    case "boleto": {
      try {
        const boleto = await createAsaasBoleto(opts);
        result.boletoData = {
          barcodeUrl: boleto.bankSlipUrl,
          barcode: boleto.barcode,
          dueDate: opts.dueDate,
          asaasId: boleto.asaasId,
          nossoNumero: boleto.nossoNumero,
        };
        result.externalId = boleto.asaasId;
        result.expiresAt = new Date(opts.dueDate + "T23:59:59.000Z");
      } catch (err) {
        if (err instanceof AppError && err.code === "ASAAS_NOT_CONFIGURED") {
          result.boletoData = {
            dueDate: opts.dueDate,
            instructions: "Entre em contato para obter o boleto: suporte@nexos.ai",
          };
          result.expiresAt = new Date(opts.dueDate + "T23:59:59.000Z");
        } else { throw err; }
      }
      break;
    }

    case "bank_transfer": {
      result.bankTransferData = {
        bank: process.env["BANK_NAME"] ?? "Inter",
        agency: process.env["BANK_AGENCY"] ?? "",
        account: process.env["BANK_ACCOUNT"] ?? "",
        accountType: process.env["BANK_ACCOUNT_TYPE"] ?? "corrente",
        cnpj: process.env["COMPANY_CNPJ"] ?? "",
        companyName: process.env["COMPANY_NAME"] ?? "NexOS AI",
        instructions: "Envie o comprovante após a transferência para confirmar o acesso.",
      };
      result.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      break;
    }

    case "credit_card": {
      if (!card) throw new AppError(400, "Dados do cartão obrigatórios", "CARD_DATA_REQUIRED");
      const charged = applyCardFee(opts.amountCents);
      result.chargedCents = charged;
      const cc = await createAsaasCardPayment({
        name: opts.name,
        email: opts.email,
        cpfCnpj: card.cpfCnpj,
        phone: card.phone,
        postalCode: card.postalCode,
        amountCents: charged,
        description: opts.description,
        dueDate: opts.dueDate,
        cardHolderName: card.holderName,
        cardNumber: card.number,
        cardExpiryMonth: card.expiryMonth,
        cardExpiryYear: card.expiryYear,
        cardCvv: card.cvv,
      });
      result.externalId = cc.asaasId;
      result.expiresAt = new Date();
      result.cardResult = { last4: cc.last4, brand: cc.brand, status: cc.status, asaasId: cc.asaasId };
      break;
    }

    default:
      throw new AppError(400, `Método de pagamento não suportado: ${method}`, "INVALID_METHOD");
  }

  return result;
}

// ─── Plan payment ─────────────────────────────────────────────────────────────

export async function initiatePayment(opts: {
  workspaceId: string;
  userId: string;
  planId: string;
  method: PaymentMethod;
  userName: string;
  userEmail: string;
  card?: CardInputData;
}): Promise<SubscriptionPayment> {
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, opts.planId))
    .limit(1);
  if (!plan) throw new NotFoundError("Plano não encontrado");

  const amountCents = Math.round(Number(plan.priceMonthly) * 100);
  const description = `NexOS AI — Acesso ${plan.name} (vitalício)`;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const pd = await buildAsaasPayment(opts.method, {
    name: opts.userName,
    email: opts.userEmail,
    amountCents,
    description,
    dueDate,
  }, opts.card);

  const isCardApproved = pd.cardResult &&
    (pd.cardResult.status === "CONFIRMED" || pd.cardResult.status === "RECEIVED");

  const [payment] = await db
    .insert(subscriptionPaymentsTable)
    .values({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      planId: opts.planId,
      amountCents: pd.chargedCents,
      currency: "BRL",
      method: opts.method,
      status: isCardApproved ? "paid" : "pending",
      description,
      externalId: pd.externalId,
      pixData: pd.pixData,
      boletoData: pd.boletoData,
      cryptoData: pd.cryptoData,
      bankTransferData: pd.bankTransferData,
      expiresAt: pd.expiresAt,
      paidAt: isCardApproved ? new Date() : null,
      metadata: { type: "plan", cardResult: pd.cardResult },
    })
    .returning();

  if (!payment) throw new AppError(500, "Falha ao criar pagamento", "DB_ERROR");
  logger.info({ workspaceId: opts.workspaceId, method: opts.method, amountCents: pd.chargedCents }, "Plan payment initiated");
  return payment;
}

// ─── Credit pack payment ──────────────────────────────────────────────────────

export async function initiatePackPayment(opts: {
  workspaceId: string;
  userId: string;
  packId: string;
  method: PaymentMethod;
  userName: string;
  userEmail: string;
  card?: CardInputData;
}): Promise<SubscriptionPayment> {
  const pack = PACK_CONFIG[opts.packId];
  if (!pack) throw new NotFoundError("Pack de créditos não encontrado");

  const [ws] = await db
    .select({ planId: workspacesTable.planId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, opts.workspaceId))
    .limit(1);
  if (!ws) throw new NotFoundError("Workspace não encontrado");

  const amountCents = pack.priceBrl * 100;
  const description = pack.label;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const pd = await buildAsaasPayment(opts.method, {
    name: opts.userName,
    email: opts.userEmail,
    amountCents,
    description,
    dueDate,
  }, opts.card);

  const isCardApproved = pd.cardResult &&
    (pd.cardResult.status === "CONFIRMED" || pd.cardResult.status === "RECEIVED");

  const [payment] = await db
    .insert(subscriptionPaymentsTable)
    .values({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      planId: ws.planId,
      amountCents: pd.chargedCents,
      currency: "BRL",
      method: opts.method,
      status: isCardApproved ? "paid" : "pending",
      description,
      externalId: pd.externalId,
      pixData: pd.pixData,
      boletoData: pd.boletoData,
      cryptoData: pd.cryptoData,
      bankTransferData: pd.bankTransferData,
      expiresAt: pd.expiresAt,
      paidAt: isCardApproved ? new Date() : null,
      metadata: { type: "pack", packId: opts.packId, packCredits: pack.credits, cardResult: pd.cardResult },
    })
    .returning();

  if (!payment) throw new AppError(500, "Falha ao criar pagamento", "DB_ERROR");

  if (isCardApproved && pack.credits > 0) {
    setImmediate(() =>
      grantCredits(opts.workspaceId, pack.credits, "purchase", logger, pack.label).catch(() => {})
    );
  }

  logger.info({ workspaceId: opts.workspaceId, packId: opts.packId, amountCents: pd.chargedCents }, "Pack payment initiated");
  return payment;
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

export async function confirmPaymentByExternalId(
  externalId: string,
  providerPayload: unknown
): Promise<void> {
  const [payment] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.externalId, externalId))
    .limit(1);

  if (!payment) { logger.warn({ externalId }, "Payment not found for external ID"); return; }
  if (payment.status === "paid") return;

  const meta = payment.metadata as { type?: string; packCredits?: number } | null;

  await db
    .update(subscriptionPaymentsTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      metadata: { ...(payment.metadata as object), providerPayload },
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPaymentsTable.id, payment.id));

  if (meta?.type === "pack" && meta.packCredits && meta.packCredits > 0) {
    await grantCredits(
      payment.workspaceId,
      meta.packCredits,
      "purchase",
      logger,
      payment.description ?? "Pack de créditos"
    );
    logger.info({ paymentId: payment.id, credits: meta.packCredits }, "Credits granted for pack payment");
  }

  logger.info({ paymentId: payment.id, workspaceId: payment.workspaceId }, "Payment confirmed via webhook");
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

  const meta = payment.metadata as { type?: string; packCredits?: number } | null;

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

  if (meta?.type === "pack" && meta.packCredits && meta.packCredits > 0) {
    await grantCredits(
      payment.workspaceId,
      meta.packCredits,
      "purchase",
      logger,
      payment.description ?? "Pack de créditos"
    );
  }

  return updated!;
}

// ─── Getters ──────────────────────────────────────────────────────────────────

export async function getPaymentById(
  workspaceId: string,
  paymentId: string
): Promise<SubscriptionPayment | null> {
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
  return payment ?? null;
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
    .select({ payment: subscriptionPaymentsTable, planName: plansTable.name })
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
  if (!last) return { isActive: false, lastPayment: null, planName: null, nextDueDate: null };

  const paidAt = last.payment.paidAt!;
  const nextDue = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    isActive: nextDue > new Date(),
    lastPayment: last.payment,
    planName: last.planName,
    nextDueDate: nextDue,
  };
}

// ─── Asaas webhook ────────────────────────────────────────────────────────────

export async function processAsaasWebhook(body: unknown): Promise<void> {
  const payload = body as { event?: string; payment?: { id?: string } };
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
