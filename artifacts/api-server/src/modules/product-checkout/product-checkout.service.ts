import { eq, and } from "drizzle-orm";
import { db, productsTable, productSalesTable, sequenceContactsTable, type Product, type ProductSale } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { CardInputData } from "../billing/billing.service.js";

// ─── Re-use Asaas helpers from billing (copied to keep modules decoupled) ─────

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
    const msg = (data as { errors?: Array<{ description: string }> }).errors?.[0]?.description
      ?? `Asaas API error ${res.status}`;
    throw new AppError(res.status >= 500 ? 502 : 400, msg, "ASAAS_ERROR");
  }
  return data;
}

async function ensureCustomer(name: string, email: string, cpfCnpj?: string): Promise<string> {
  const customer = await asaasRequest<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, cpfCnpj: cpfCnpj ?? "00000000000" }),
  });
  return customer.id;
}

export function applyCardFee(cents: number): number {
  return Math.round(cents * 1.035);
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
}): Promise<ProductSale> {
  const product = await getProduct(opts.productId);
  if (!product || !product.active) throw new NotFoundError("Produto não encontrado ou inativo");

  const baseCents = product.priceCents;
  const chargedCents = opts.method === "credit_card" ? applyCardFee(baseCents) : baseCents;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
  const description = `${product.name} — compra`;

  let pixData = null;
  let boletoData = null;
  let cardData = null;
  let externalId: string | null = null;
  let expiresAt: Date | null = null;
  let initialStatus: "pending" | "paid" = "pending";

  const customerId = await ensureCustomer(opts.buyerName, opts.buyerEmail, opts.buyerCpf);

  if (opts.method === "pix") {
    const payment = await asaasRequest<{ id: string }>("/payments", {
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
      `/payments/${payment.id}/pixQrCode`
    );
    pixData = { qrCode: pix.encodedImage, copiaECola: pix.payload, expiresAt: pix.expirationDate, asaasId: payment.id };
    externalId = payment.id;
    expiresAt = new Date(pix.expirationDate);
  } else if (opts.method === "boleto") {
    const payment = await asaasRequest<{ id: string; bankSlipUrl?: string; nossoNumero?: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: chargedCents / 100,
        dueDate,
        description,
      }),
    });
    const idf = await asaasRequest<{ identificationField?: string }>(`/payments/${payment.id}/identificationField`);
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
    }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: chargedCents / 100,
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
    metadata: { productName: product.name, sequenceId: product.sequenceId },
  }).returning();

  if (!sale) throw new AppError(500, "Erro ao criar venda", "DB_ERROR");

  // If credit card approved immediately, convert the lead
  if (initialStatus === "paid") {
    setImmediate(() => convertLeadByEmail(opts.buyerEmail, product.sequenceId ?? null, sale.id).catch(() => {}));
  }

  logger.info({ saleId: sale.id, productId: opts.productId, method: opts.method, chargedCents }, "Product checkout initiated");
  return sale;
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

  await db.update(productSalesTable)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(productSalesTable.id, sale.id));

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
