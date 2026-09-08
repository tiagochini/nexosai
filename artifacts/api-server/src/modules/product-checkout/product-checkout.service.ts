import { eq, and, inArray } from "drizzle-orm";
import { db, productsTable, productSalesTable, sequenceContactsTable, workspaceIntegrationsTable, type Product, type ProductSale } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { CardInputData } from "../billing/billing.service.js";
import { recordCheckoutStarted, recordPaidSale, recordRefundedSale } from "../lifecycle/lifecycle.service.js";

// ─── Asaas helpers — workspace key takes priority over platform key ───────────

const ASAAS_SANDBOX_BASE = "https://sandbox.asaas.com/api/v3";
const ASAAS_PRODUCTION_BASE = "https://api.asaas.com/v3";

export type AsaasEnvironment = {
  apiKey: string;
  base: string;
  sandbox: boolean;
};

/** Resolves platform credentials without ever mixing sandbox and live keys. */
export function resolvePlatformAsaasEnvironment(
  values: Record<string, string | undefined> = process.env,
): AsaasEnvironment {
  const sandbox = values["ASAAS_SANDBOX"] === "true";
  const apiKey = sandbox ? values["ASAAS_SANDBOX_API_KEY"] : values["ASAAS_API_KEY"];
  return { apiKey: apiKey ?? "", base: sandbox ? ASAAS_SANDBOX_BASE : ASAAS_PRODUCTION_BASE, sandbox };
}

/** E2E-only fail-closed guard. It deliberately does not inspect the live key. */
export function assertAsaasSandboxE2eEnvironment(
  values: Record<string, string | undefined> = process.env,
): AsaasEnvironment {
  const resolved = resolvePlatformAsaasEnvironment(values);
  const host = new URL(resolved.base).hostname;
  if (values["ASAAS_SANDBOX"] !== "true" || !values["ASAAS_SANDBOX_API_KEY"] || host !== "sandbox.asaas.com") {
    throw new Error("Sandbox E2E requires ASAAS_SANDBOX=true and ASAAS_SANDBOX_API_KEY; no production credential will be used");
  }
  return resolved;
}

function asaasBase(environment?: string) {
  return environment === "sandbox" ? ASAAS_SANDBOX_BASE : ASAAS_PRODUCTION_BASE;
}

async function asaasRequest<T>(apiKey: string, base: string, path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
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

/** Returns the Asaas API key + base URL to use for a workspace.
 *  Priority: workspace's own connected Asaas account → platform key (NexOS). */
async function resolveAsaas(workspaceId: string): Promise<{ apiKey: string; base: string }> {
  const [wsIntegration] = await db
    .select({ accessToken: workspaceIntegrationsTable.accessToken, accountId: workspaceIntegrationsTable.accountId })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "asaas"),
        eq(workspaceIntegrationsTable.status, "connected"),
      )
    )
    .limit(1);

  if (wsIntegration?.accessToken) {
    return {
      apiKey: wsIntegration.accessToken,
      base: asaasBase(wsIntegration.accountId ?? "production"),
    };
  }

  // Fall back to platform key (NexOS sells its own products)
  const platform = resolvePlatformAsaasEnvironment();
  if (!platform.apiKey) throw new AppError(503, "Asaas não configurado. Conecte sua conta Asaas em Integrações.", "ASAAS_NOT_CONFIGURED");
  return {
    apiKey: platform.apiKey,
    base: platform.base,
  };
}

async function ensureCustomer(apiKey: string, base: string, name: string, email: string, cpfCnpj?: string): Promise<string> {
  const customer = await asaasRequest<{ id: string }>(apiKey, base, "/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, cpfCnpj: cpfCnpj ?? "00000000000" }),
  });
  return customer.id;
}

export type CardInstallmentOption = {
  installmentCount: number;
  installmentValueCents: number;
  totalCents: number;
};

type AsaasSimulation = {
  value: number;
  creditCard: {
    netValue: number;
    installment: {
      paymentNetValue: number;
      paymentValue: number;
    };
  } | null;
};

const installmentCache = new Map<string, { expiresAt: number; options: CardInstallmentOption[] }>();

async function simulateCardPayment(apiKey: string, base: string, valueCents: number, installmentCount: number): Promise<AsaasSimulation> {
  return asaasRequest<AsaasSimulation>(apiKey, base, "/payments/simulate", {
    method: "POST",
    body: JSON.stringify({
      value: valueCents / 100,
      installmentCount,
      billingTypes: ["CREDIT_CARD"],
    }),
  });
}

async function buildGrossedUpInstallment(
  apiKey: string,
  base: string,
  contractedCents: number,
  installmentCount: number,
): Promise<CardInstallmentOption> {
  let chargedCents = contractedCents;
  let simulation: AsaasSimulation | null = null;

  // The Asaas simulator is authoritative. Iterate until its net amount matches
  // the contracted amount, so the buyer sees the final financed values.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    simulation = await simulateCardPayment(apiKey, base, chargedCents, installmentCount);
    if (!simulation.creditCard) throw new AppError(502, "O Asaas não retornou condições para cartão", "ASAAS_SIMULATION_UNAVAILABLE");
    const netCents = Math.round(simulation.creditCard.netValue * 100);
    const difference = contractedCents - netCents;
    if (Math.abs(difference) <= 1) break;
    chargedCents = Math.max(contractedCents, chargedCents + difference);
  }

  if (!simulation?.creditCard) throw new AppError(502, "O Asaas não retornou condições para cartão", "ASAAS_SIMULATION_UNAVAILABLE");
  return {
    installmentCount,
    installmentValueCents: Math.round(simulation.creditCard.installment.paymentValue * 100),
    totalCents: Math.round(simulation.value * 100),
  };
}

export async function getProductCardInstallments(productId: string): Promise<CardInstallmentOption[]> {
  const product = await getProduct(productId);
  if (!product || !product.active) throw new NotFoundError("Produto não encontrado ou inativo");

  const cacheKey = `${product.id}:${product.priceCents}`;
  const cached = installmentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.options;

  const { apiKey, base } = await resolveAsaas(product.workspaceId);
  const options = await Promise.all(
    Array.from({ length: 21 }, (_, index) =>
      buildGrossedUpInstallment(apiKey, base, product.priceCents, index + 1)
    )
  );
  installmentCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60_000, options });
  return options;
}

// ─── Product CRUD (workspace owner) ──────────────────────────────────────────

export async function createProduct(opts: {
  workspaceId: string;
  name: string;
  description?: string;
  priceCents: number;
  sequenceId?: string;
  successUrl?: string;
}): Promise<Product> {
  const [product] = await db.insert(productsTable).values({
    workspaceId: opts.workspaceId,
    name: opts.name,
    description: opts.description ?? null,
    priceCents: opts.priceCents,
    sequenceId: opts.sequenceId ?? null,
    successUrl: opts.successUrl ?? null,
  }).returning();
  if (!product) throw new AppError(500, "Erro ao criar produto", "DB_ERROR");
  logger.info({ productId: product.id, workspaceId: opts.workspaceId }, "Product created");
  return product;
}

export async function listProducts(workspaceId: string): Promise<Product[]> {
  return db.select().from(productsTable).where(eq(productsTable.workspaceId, workspaceId));
}

export async function getProduct(productId: string): Promise<Product | null> {
  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  return p ?? null;
}

export async function updateProduct(workspaceId: string, productId: string, patch: Partial<Pick<Product, "name" | "description" | "priceCents" | "active" | "sequenceId" | "successUrl">>): Promise<Product> {
  const [updated] = await db
    .update(productsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(productsTable.id, productId), eq(productsTable.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new NotFoundError("Produto não encontrado");
  return updated;
}

export async function deleteProduct(workspaceId: string, productId: string): Promise<void> {
  await db.delete(productsTable).where(
    and(eq(productsTable.id, productId), eq(productsTable.workspaceId, workspaceId))
  );
}

// ─── Public checkout (buyer facing) ──────────────────────────────────────────

export async function initiateProductCheckout(opts: {
  productId: string;
  buyerName: string;
  buyerEmail: string;
  buyerCpf?: string;
  method: "pix" | "boleto" | "credit_card";
  card?: CardInputData;
  installmentCount?: number;
  purchaserReferralCode?: string;
}): Promise<ProductSale> {
  const product = await getProduct(opts.productId);
  if (!product || !product.active) throw new NotFoundError("Produto não encontrado ou inativo");

  const baseCents = product.priceCents;
  const installmentCount = opts.method === "credit_card" ? (opts.installmentCount ?? 1) : 1;
  if (installmentCount < 1 || installmentCount > 21) {
    throw new AppError(400, "Quantidade de parcelas inválida", "INVALID_INSTALLMENT_COUNT");
  }
  const installmentOption = opts.method === "credit_card"
    ? (await getProductCardInstallments(product.id)).find((option) => option.installmentCount === installmentCount)
    : null;
  if (opts.method === "credit_card" && !installmentOption) {
    throw new AppError(400, "Condição de parcelamento indisponível", "INSTALLMENT_UNAVAILABLE");
  }
  const chargedCents = installmentOption?.totalCents ?? baseCents;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
  const description = `${product.name} — compra`;

  let pixData = null;
  let boletoData = null;
  let cardData = null;
  let externalId: string | null = null;
  let expiresAt: Date | null = null;
  let initialStatus: "pending" | "paid" = "pending";

  const { apiKey, base } = await resolveAsaas(product.workspaceId);
  const customerId = await ensureCustomer(apiKey, base, opts.buyerName, opts.buyerEmail, opts.buyerCpf);

  if (opts.method === "pix") {
    const payment = await asaasRequest<{ id: string }>(apiKey, base, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: chargedCents / 100,
        dueDate,
        description,
      }),
    });
    const pix = await asaasRequest<{ encodedImage: string; payload: string; expirationDate: string }>(
      apiKey, base, `/payments/${payment.id}/pixQrCode`
    );
    pixData = { qrCode: pix.encodedImage, copiaECola: pix.payload, expiresAt: pix.expirationDate, asaasId: payment.id };
    externalId = payment.id;
    expiresAt = new Date(pix.expirationDate);
  } else if (opts.method === "boleto") {
    const payment = await asaasRequest<{ id: string; bankSlipUrl?: string; nossoNumero?: string }>(apiKey, base, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: chargedCents / 100,
        dueDate,
        description,
      }),
    });
    const idf = await asaasRequest<{ identificationField?: string }>(apiKey, base, `/payments/${payment.id}/identificationField`);
    boletoData = {
      barcodeUrl: payment.bankSlipUrl ?? "",
      barcode: idf.identificationField ?? "",
      dueDate,
      asaasId: payment.id,
      nossoNumero: payment.nossoNumero ?? "",
    };
    externalId = payment.id;
    expiresAt = new Date(dueDate + "T23:59:59.000Z");
  } else if (opts.method === "credit_card" && opts.card) {
    const payment = await asaasRequest<{
      id: string;
      status: string;
      creditCard?: { creditCardBrand: string; creditCardNumber: string };
    }>(apiKey, base, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        ...(installmentCount > 1
          ? { installmentCount, totalValue: chargedCents / 100 }
          : { value: chargedCents / 100 }),
        dueDate,
        description,
        creditCard: {
          holderName: opts.card.holderName,
          number: opts.card.number.replace(/\D/g, ""),
          expiryMonth: opts.card.expiryMonth,
          expiryYear: opts.card.expiryYear,
          ccv: opts.card.cvv,
        },
        creditCardHolderInfo: {
          name: opts.buyerName,
          email: opts.buyerEmail,
          cpfCnpj: opts.buyerCpf ?? "00000000000",
          postalCode: opts.card.postalCode ?? "00000000",
          addressNumber: "S/N",
          phone: opts.card.phone ?? "00000000000",
        },
      }),
    });
    cardData = {
      last4: payment.creditCard?.creditCardNumber ?? "****",
      brand: payment.creditCard?.creditCardBrand ?? "VISA",
      status: payment.status,
      asaasId: payment.id,
      installmentCount,
      installmentValueCents: installmentOption?.installmentValueCents ?? chargedCents,
    };
    externalId = payment.id;
    expiresAt = new Date();
    if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
      initialStatus = "paid";
    }
  } else {
    throw new AppError(400, "Método de pagamento inválido ou dados de cartão ausentes", "INVALID_METHOD");
  }

  const [sale] = await db.insert(productSalesTable).values({
    productId: opts.productId,
    workspaceId: product.workspaceId,
    buyerName: opts.buyerName,
    buyerEmail: opts.buyerEmail,
    buyerCpf: opts.buyerCpf ?? null,
    amountCents: chargedCents,
    currency: "BRL",
    method: opts.method === "credit_card" ? "credit_card" : opts.method,
    status: initialStatus,
    externalId,
    pixData,
    boletoData,
    cardData,
    paidAt: initialStatus === "paid" ? new Date() : null,
    expiresAt,
    metadata: { productName: product.name, sequenceId: product.sequenceId, ...(opts.purchaserReferralCode ? { purchaserReferralCode: opts.purchaserReferralCode } : {}) },
  }).returning();

  if (!sale) throw new AppError(500, "Erro ao criar venda", "DB_ERROR");
  await recordCheckoutStarted(sale);

  // If credit card approved immediately, convert the lead
  if (initialStatus === "paid") {
    await recordPaidSale(sale);
    setImmediate(() => convertLeadByEmail(opts.buyerEmail, product.sequenceId ?? null, sale.id).catch(() => {}));
  }

  logger.info({ saleId: sale.id, productId: opts.productId, method: opts.method, chargedCents }, "Product checkout initiated");
  return sale;
}

export async function refundProductSaleByExternalId(externalId: string): Promise<void> {
  const [sale] = await db.select().from(productSalesTable).where(eq(productSalesTable.externalId, externalId)).limit(1);
  if (!sale || sale.status === "refunded") return;
  const [refunded] = await db.update(productSalesTable).set({ status: "refunded", updatedAt: new Date() })
    .where(and(eq(productSalesTable.id, sale.id), inArray(productSalesTable.status, ["paid", "expired"]))).returning();
  if (refunded) await recordRefundedSale(refunded);
}

export type AsaasPaymentVerification = {
  id: string;
  status: string;
  value?: number;
  netValue?: number;
};

export type AsaasHttpTransport = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** Fetches the canonical payment state from Asaas, rather than trusting webhook JSON. */
export async function fetchAsaasPayment(
  apiKey: string,
  base: string,
  externalId: string,
  transport: AsaasHttpTransport = fetch,
): Promise<AsaasPaymentVerification> {
  const response = await transport(`${base}/payments/${encodeURIComponent(externalId)}`, {
    headers: { "Content-Type": "application/json", access_token: apiKey },
  });
  const data = await response.json() as AsaasPaymentVerification & { errors?: Array<{ description?: string }> };
  if (!response.ok || data.id !== externalId || !data.status) {
    throw new AppError(502, data.errors?.[0]?.description ?? "Não foi possível verificar o pagamento no Asaas", "ASAAS_VERIFICATION_FAILED");
  }
  return data;
}

const SETTLED_ASAAS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const REFUNDED_ASAAS_STATUSES = new Set(["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"]);

/** Re-verifies ownership and provider status before any local webhook transition. */
export async function reconcileProductSaleFromAsaasWebhook(
  externalId: string,
  transport: AsaasHttpTransport = fetch,
): Promise<"paid" | "refunded" | "ignored"> {
  const [sale] = await db.select().from(productSalesTable)
    .where(eq(productSalesTable.externalId, externalId)).limit(1);
  if (!sale) return "ignored";

  // Resolve after locating the sale so an incoming id cannot cross workspace boundaries.
  const { apiKey, base } = await resolveAsaas(sale.workspaceId);
  const payment = await fetchAsaasPayment(apiKey, base, externalId, transport);
  if (SETTLED_ASAAS_STATUSES.has(payment.status)) {
    await confirmProductSaleByExternalId(externalId);
    return "paid";
  }
  if (REFUNDED_ASAAS_STATUSES.has(payment.status)) {
    await refundProductSaleByExternalId(externalId);
    return "refunded";
  }
  return "ignored";
}

export async function getSale(saleId: string): Promise<ProductSale | null> {
  const [s] = await db.select().from(productSalesTable).where(eq(productSalesTable.id, saleId)).limit(1);
  return s ?? null;
}

// ─── Asaas webhook: confirm product sale ─────────────────────────────────────

export async function confirmProductSaleByExternalId(externalId: string): Promise<void> {
  const [sale] = await db
    .select()
    .from(productSalesTable)
    .where(eq(productSalesTable.externalId, externalId))
    .limit(1);

  if (!sale) return;
  if (sale.status === "paid") return;

  const [paidSale] = await db.update(productSalesTable)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(productSalesTable.id, sale.id), inArray(productSalesTable.status, ["pending", "expired"])))
    .returning();
  if (!paidSale) return;
  await recordPaidSale(paidSale);

  const meta = sale.metadata as { sequenceId?: string } | null;
  setImmediate(() =>
    convertLeadByEmail(sale.buyerEmail, meta?.sequenceId ?? null, sale.id).catch(() => {})
  );

  logger.info({ saleId: sale.id, externalId }, "Product sale confirmed via webhook");
}

async function convertLeadByEmail(email: string, sequenceId: string | null, saleId: string): Promise<void> {
  if (!sequenceId) return;
  const contacts = await db
    .select()
    .from(sequenceContactsTable)
    .where(
      and(
        eq(sequenceContactsTable.sequenceId, sequenceId),
        eq(sequenceContactsTable.email, email)
      )
    )
    .limit(1);

  const contact = contacts[0];
  if (!contact) return;

  await db.update(sequenceContactsTable)
    .set({
      segment: "converted",
      engagementScore: 100,
      updatedAt: new Date(),
      metadata: { ...(contact.metadata as object ?? {}), convertedViaSale: saleId, convertedAt: new Date().toISOString() },
    })
    .where(eq(sequenceContactsTable.id, contact.id));

  logger.info({ contactId: contact.id, email, saleId }, "Lead converted via product sale");
}
