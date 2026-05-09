import crypto from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  revenueEventsTable,
  webhookConfigsTable,
  sequenceContactsTable,
  sequenceEngagementTable,
  launchSequencesTable,
  type RevenuePlatform,
  type RevenueEventType,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { AppError } from "../../lib/errors.js";

// ─── Hotmart ──────────────────────────────────────────────────────────────────

type HotmartEvent = {
  event?: string;
  data?: {
    purchase?: {
      transaction?: string;
      status?: string;
      price?: { value?: number; currency_value?: string };
      commission_total?: { value?: number };
    };
    product?: { id?: number; name?: string };
    buyer?: { email?: string; name?: string };
    affiliates?: Array<{ name?: string }>;
    subscription?: { status?: string };
  };
  hottok?: string;
};

const HOTMART_EVENT_MAP: Record<string, RevenueEventType> = {
  PURCHASE_COMPLETE: "sale",
  PURCHASE_APPROVED: "sale",
  PURCHASE_REFUNDED: "refund",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_CANCELED: "subscription_cancel",
  PURCHASE_DELAYED: "pending",
  SWITCH_PLAN: "subscription_renewal",
  SUBSCRIPTION_CANCELLATION: "subscription_cancel",
  ABANDONED_CART: "abandoned_cart",
  PURCHASE_OUT_OF_SHOPPING_CART: "lead",
} as unknown as Record<string, RevenueEventType>;

export async function processHotmartWebhook(
  token: string,
  body: unknown,
  hottok?: string
): Promise<void> {
  const config = await getWebhookConfig(token, "hotmart");

  const expectedHottok = (config.metadata as Record<string, string>)?.hottok;
  if (expectedHottok && hottok && hottok !== expectedHottok) {
    throw new AppError(401, "Invalid Hotmart hottok", "INVALID_SIGNATURE");
  }

  const payload = body as HotmartEvent;
  const event = payload.event ?? "";
  const eventType: RevenueEventType = HOTMART_EVENT_MAP[event] ?? "sale";
  const purchase = payload.data?.purchase;
  const buyer = payload.data?.buyer;
  const product = payload.data?.product;

  const grossCents = Math.round((purchase?.price?.value ?? 0) * 100);
  const commissionCents = Math.round((purchase?.commission_total?.value ?? 0) * 100);
  const netCents = grossCents - commissionCents;

  await saveRevenueEvent({
    workspaceId: config.workspaceId,
    platform: "hotmart",
    eventType,
    grossAmountCents: grossCents,
    netAmountCents: netCents,
    currency: purchase?.price?.currency_value ?? "BRL",
    productName: product?.name ?? null,
    productId: product?.id ? String(product.id) : null,
    customerEmail: buyer?.email ?? null,
    customerName: buyer?.name ?? null,
    transactionId: purchase?.transaction ?? null,
    commissionAmountCents: commissionCents,
    isRecurring: event.includes("SUBSCRIPTION") || event === "SWITCH_PLAN",
    webhookPayload: body as Record<string, unknown>,
  });

  await touchWebhookConfig(config.id);
  logger.info({ workspaceId: config.workspaceId, event, grossCents }, "Hotmart webhook processed");
}

// ─── Kiwify ───────────────────────────────────────────────────────────────────

type KiwifyEvent = {
  webhook_event_type?: string;
  order?: {
    id?: string;
    status?: string;
    total_value?: number;
    net_value?: number;
    currency?: string;
    is_subscription?: boolean;
    product?: { id?: string; name?: string };
    customer?: { email?: string; name?: string };
    commissions?: { store_value?: number };
  };
};

const KIWIFY_EVENT_MAP: Record<string, RevenueEventType> = {
  "order.paid": "sale",
  "order.refunded": "refund",
  "order.chargedback": "chargeback",
  "order.abandoned": "abandoned_cart",
  "subscription.active": "subscription_renewal",
  "subscription.cancelled": "subscription_cancel",
  "subscription.overdue": "subscription_cancel",
  "upsell.paid": "upsell",
} as unknown as Record<string, RevenueEventType>;

export async function processKiwifyWebhook(
  token: string,
  body: unknown,
  signature?: string
): Promise<void> {
  const config = await getWebhookConfig(token, "kiwify");

  if (config.signingSecret && signature) {
    const expected = crypto
      .createHmac("sha256", config.signingSecret)
      .update(JSON.stringify(body))
      .digest("hex");
    if (signature !== expected) {
      throw new AppError(401, "Invalid Kiwify signature", "INVALID_SIGNATURE");
    }
  }

  const payload = body as KiwifyEvent;
  const event = payload.webhook_event_type ?? "";
  const eventType: RevenueEventType = KIWIFY_EVENT_MAP[event] ?? "sale";
  const order = payload.order;

  const grossCents = Math.round((order?.total_value ?? 0) * 100);
  const netCents = Math.round((order?.net_value ?? 0) * 100);
  const commissionCents = Math.round((order?.commissions?.store_value ?? 0) * 100);

  await saveRevenueEvent({
    workspaceId: config.workspaceId,
    platform: "kiwify",
    eventType,
    grossAmountCents: grossCents,
    netAmountCents: netCents,
    currency: order?.currency ?? "BRL",
    productName: order?.product?.name ?? null,
    productId: order?.product?.id ?? null,
    customerEmail: order?.customer?.email ?? null,
    customerName: order?.customer?.name ?? null,
    transactionId: order?.id ?? null,
    commissionAmountCents: commissionCents,
    isRecurring: order?.is_subscription ?? false,
    webhookPayload: body as Record<string, unknown>,
  });

  await touchWebhookConfig(config.id);
  logger.info({ workspaceId: config.workspaceId, event, grossCents }, "Kiwify webhook processed");
}

// ─── Eduzz ────────────────────────────────────────────────────────────────────

type EduzzEvent = {
  key?: string;
  trans_cod?: string;
  trans_status?: number;
  total?: number;
  liq_total?: number;
  content_title?: string;
  content_cod?: string;
  client_email?: string;
  client_name?: string;
};

const EDUZZ_STATUS_MAP: Record<number, RevenueEventType> = {
  1: "sale",    // approved
  2: "sale",    // completed
  3: "refund",  // refunded
  4: "chargeback",
  6: "sale",    // waiting payment
  7: "lead",    // lead
};

export async function processEduzzWebhook(
  token: string,
  body: unknown
): Promise<void> {
  const config = await getWebhookConfig(token, "eduzz");
  const payload = body as EduzzEvent;

  const status = payload.trans_status ?? 1;
  const eventType: RevenueEventType = EDUZZ_STATUS_MAP[status] ?? "sale";
  const grossCents = Math.round((payload.total ?? 0) * 100);
  const netCents = Math.round((payload.liq_total ?? 0) * 100);

  await saveRevenueEvent({
    workspaceId: config.workspaceId,
    platform: "eduzz",
    eventType,
    grossAmountCents: grossCents,
    netAmountCents: netCents,
    currency: "BRL",
    productName: payload.content_title ?? null,
    productId: payload.content_cod ?? null,
    customerEmail: payload.client_email ?? null,
    customerName: payload.client_name ?? null,
    transactionId: payload.trans_cod ?? null,
    commissionAmountCents: 0,
    isRecurring: false,
    webhookPayload: body as Record<string, unknown>,
  });

  await touchWebhookConfig(config.id);
  logger.info({ workspaceId: config.workspaceId, status, grossCents }, "Eduzz webhook processed");
}

// ─── Monetizze ────────────────────────────────────────────────────────────────

type MonetizzeEvent = {
  tipoPostback?: { codigo?: number; descricao?: string };
  venda?: {
    codigo?: string;
    valorTotal?: number;
    valorLiquido?: number;
    moeda?: { sigla?: string };
  };
  produto?: { codigo?: number; nome?: string };
  comprador?: { email?: string; nome?: string };
};

export async function processMonetizzeWebhook(
  token: string,
  body: unknown
): Promise<void> {
  const config = await getWebhookConfig(token, "monetizze");
  const payload = body as MonetizzeEvent;

  const codigo = payload.tipoPostback?.codigo ?? 1;
  const eventTypeMap: Record<number, RevenueEventType> = {
    1: "sale",
    2: "refund",
    3: "chargeback",
    4: "subscription_renewal",
    5: "subscription_cancel",
  };
  const eventType: RevenueEventType = eventTypeMap[codigo] ?? "sale";

  const grossCents = Math.round((payload.venda?.valorTotal ?? 0) * 100);
  const netCents = Math.round((payload.venda?.valorLiquido ?? 0) * 100);

  await saveRevenueEvent({
    workspaceId: config.workspaceId,
    platform: "monetizze",
    eventType,
    grossAmountCents: grossCents,
    netAmountCents: netCents,
    currency: payload.venda?.moeda?.sigla ?? "BRL",
    productName: payload.produto?.nome ?? null,
    productId: payload.produto?.codigo ? String(payload.produto.codigo) : null,
    customerEmail: payload.comprador?.email ?? null,
    customerName: payload.comprador?.nome ?? null,
    transactionId: payload.venda?.codigo ?? null,
    commissionAmountCents: 0,
    isRecurring: codigo === 4,
    webhookPayload: body as Record<string, unknown>,
  });

  await touchWebhookConfig(config.id);
  logger.info({ workspaceId: config.workspaceId, codigo, grossCents }, "Monetizze webhook processed");
}

// ─── Generic / Custom ─────────────────────────────────────────────────────────

type CustomEvent = {
  event_type?: string;
  gross_amount?: number;
  net_amount?: number;
  currency?: string;
  product_name?: string;
  product_id?: string;
  customer_email?: string;
  customer_name?: string;
  transaction_id?: string;
};

export async function processCustomWebhook(
  token: string,
  body: unknown
): Promise<void> {
  const config = await getWebhookConfig(token, "custom");
  const payload = body as CustomEvent;

  const grossCents = Math.round((payload.gross_amount ?? 0) * 100);
  const netCents = Math.round((payload.net_amount ?? grossCents / 100) * 100);

  await saveRevenueEvent({
    workspaceId: config.workspaceId,
    platform: "custom",
    eventType: (payload.event_type as RevenueEventType) ?? "sale",
    grossAmountCents: grossCents,
    netAmountCents: netCents,
    currency: payload.currency ?? "BRL",
    productName: payload.product_name ?? null,
    productId: payload.product_id ?? null,
    customerEmail: payload.customer_email ?? null,
    customerName: payload.customer_name ?? null,
    transactionId: payload.transaction_id ?? null,
    commissionAmountCents: 0,
    isRecurring: false,
    webhookPayload: body as Record<string, unknown>,
  });

  await touchWebhookConfig(config.id);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWebhookConfig(token: string, platform: RevenuePlatform) {
  const [config] = await db
    .select()
    .from(webhookConfigsTable)
    .where(
      and(
        eq(webhookConfigsTable.webhookToken, token),
        eq(webhookConfigsTable.platform, platform),
        eq(webhookConfigsTable.isActive, true)
      )
    )
    .limit(1);

  if (!config) {
    throw new AppError(404, "Webhook config não encontrado", "WEBHOOK_NOT_FOUND");
  }
  return config;
}

async function saveRevenueEvent(data: {
  workspaceId: string;
  platform: RevenuePlatform;
  eventType: RevenueEventType;
  grossAmountCents: number;
  netAmountCents: number;
  currency: string;
  productName: string | null;
  productId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  transactionId: string | null;
  commissionAmountCents: number;
  isRecurring: boolean;
  webhookPayload: Record<string, unknown>;
  campaignId?: string;
}): Promise<void> {
  const status =
    data.eventType === "refund" || data.eventType === "chargeback"
      ? "refunded"
      : data.eventType === "abandoned_cart" || data.eventType === "lead"
        ? "pending"
        : "confirmed";

  await db.insert(revenueEventsTable).values({
    workspaceId: data.workspaceId,
    campaignId: data.campaignId ?? null,
    platform: data.platform,
    eventType: data.eventType,
    status,
    grossAmountCents: data.grossAmountCents,
    netAmountCents: data.netAmountCents,
    currency: data.currency,
    productName: data.productName,
    productId: data.productId,
    customerEmail: data.customerEmail,
    customerName: data.customerName,
    transactionId: data.transactionId,
    commissionAmountCents: data.commissionAmountCents,
    isRecurring: data.isRecurring,
    webhookPayload: data.webhookPayload,
  });

  // ── Auto-convert sequence contacts on confirmed sale ──────────────────────
  if (
    data.eventType === "sale" &&
    status === "confirmed" &&
    data.customerEmail
  ) {
    setImmediate(() =>
      convertSequenceContactsByEmail(data.workspaceId, data.customerEmail!).catch((err) =>
        logger.warn({ err }, "Failed to convert sequence contacts after sale"),
      ),
    );
  }
}

// ─── Convert sequence contacts that match customerEmail ───────────────────────

async function convertSequenceContactsByEmail(
  workspaceId: string,
  email: string,
): Promise<void> {
  // Find all active sequences for this workspace
  const activeSequences = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.workspaceId, workspaceId),
        inArray(launchSequencesTable.status, ["active", "scheduled"]),
      ),
    );

  if (activeSequences.length === 0) return;

  const sequenceIds = activeSequences.map((s) => s.id);

  // Find contacts with matching email that aren't already converted
  const contacts = await db
    .select({ id: sequenceContactsTable.id, sequenceId: sequenceContactsTable.sequenceId })
    .from(sequenceContactsTable)
    .where(
      and(
        eq(sequenceContactsTable.workspaceId, workspaceId),
        eq(sequenceContactsTable.email, email),
        inArray(sequenceContactsTable.sequenceId, sequenceIds),
      ),
    );

  if (contacts.length === 0) return;

  for (const contact of contacts) {
    await db
      .update(sequenceContactsTable)
      .set({
        segment: "converted",
        conversions: 1,
        engagementScore: 100,
        updatedAt: new Date(),
      })
      .where(eq(sequenceContactsTable.id, contact.id));

    await db.insert(sequenceEngagementTable).values({
      sequenceId: contact.sequenceId,
      contactId: contact.id,
      workspaceId,
      event: "convert",
      channel: "checkout",
      externalRef: email,
      metadata: { source: "purchase_webhook" },
    });
  }

  logger.info(
    { workspaceId, email, converted: contacts.length },
    "Sequence contacts auto-converted after purchase",
  );
}

async function touchWebhookConfig(configId: string): Promise<void> {
  await db
    .update(webhookConfigsTable)
    .set({ lastReceivedAt: new Date(), updatedAt: new Date() })
    .where(eq(webhookConfigsTable.id, configId));
}
