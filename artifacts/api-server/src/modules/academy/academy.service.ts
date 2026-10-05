import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { renderAccessEmailHtml } from "./academy-email-html.js";
import { deliverFunnelMessage, type FunnelDeliveryResult } from "./academy-funnel-delivery.js";

const ASAAS_BASE = env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://www.asaas.com/api/v3";

const ASAAS_KEY = env.ASAAS_API_KEY;

function asaasHeaders() {
  return {
    "Content-Type": "application/json",
    "access_token": ASAAS_KEY,
  };
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

// Find existing customer by email, or create a new one
export async function findOrCreateCustomer(name: string, email: string, cpfCnpj?: string): Promise<AsaasCustomer> {
  // Search existing
  const searchResp = await fetch(
    `${ASAAS_BASE}/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: asaasHeaders() }
  );
  if (!searchResp.ok) {
    await searchResp.text();
    logger.error({ status: searchResp.status }, "asaas: customer search failed");
    throw new Error("Falha ao consultar clientes no Asaas");
  }
  const searchData = await searchResp.json() as { data?: AsaasCustomer[] };
  if (searchData.data && searchData.data.length > 0) {
    const existing = searchData.data[0];
    // Update CPF if customer exists but doesn't have one yet
    if (cpfCnpj && !existing.cpfCnpj) {
      await fetch(`${ASAAS_BASE}/customers/${existing.id}`, {
        method: "PUT",
        headers: asaasHeaders(),
        body: JSON.stringify({ cpfCnpj: sanitizeCpfCnpj(cpfCnpj) }),
      }).catch(() => undefined);
    }
    return existing;
  }

  // Create new
  const createBody: Record<string, string> = { name, email };
  if (cpfCnpj) createBody["cpfCnpj"] = sanitizeCpfCnpj(cpfCnpj);

  const createResp = await fetch(`${ASAAS_BASE}/customers`, {
    method: "POST",
    headers: asaasHeaders(),
    body: JSON.stringify(createBody),
  });
  if (!createResp.ok) {
    await createResp.text();
    logger.error({ status: createResp.status }, "asaas: customer create failed");
    throw new Error("Falha ao criar cliente no Asaas");
  }
  return createResp.json() as Promise<AsaasCustomer>;
}

// Create a single charge and return the invoice URL
export async function createPayment(opts: {
  customerId: string;
  amountBrl: number;
  description: string;
  externalReference: string;
}): Promise<AsaasPayment> {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const resp = await fetch(`${ASAAS_BASE}/payments`, {
    method: "POST",
    headers: asaasHeaders(),
    body: JSON.stringify({
      customer: opts.customerId,
      billingType: "UNDEFINED",
      value: opts.amountBrl,
      dueDate: dueDateStr,
      description: opts.description,
      externalReference: opts.externalReference,
    }),
  });

  if (!resp.ok) {
    await resp.text();
    logger.error({ status: resp.status }, "asaas: payment create failed");
    throw new Error("Falha ao criar cobrança no Asaas");
  }
  return resp.json() as Promise<AsaasPayment>;
}

// Generate a readable 12-char uppercase access token like "A1B2-C3D4-E5F6"
export function generateAccessToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) token += "-";
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Send access token via Gmail or Resend
export async function sendAccessEmail(opts: {
  email: string;
  name: string;
  token: string;
  productName: string;
  portalUrl: string;
}, deliver = deliverFunnelMessage): Promise<FunnelDeliveryResult> {
  const html = renderAccessEmailHtml(opts);

  const subject = `Seu acesso à NexOS Academy — Código: ${opts.token}`;

  const result = await deliver({ to: opts.email, subject, html }, {
    resendKey: env.RESEND_API_KEY, resendFrom: env.RESEND_FROM_EMAIL,
    gmailUser: env.GMAIL_USER, gmailPassword: env.GMAIL_APP_PASSWORD,
  });
  // Never log recipient, access code, rendered message or provider response.
  logger.info({ status: result.status }, "academy: access email delivery attempt completed");
  return result;
}
