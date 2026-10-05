import nodemailer from "nodemailer";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { renderAccessEmailHtml } from "./academy-email-html.js";

function getGmailTransport() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
}

async function sendViaGmail(opts: { to: string; subject: string; html: string; from?: string }): Promise<boolean> {
  const transport = getGmailTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: opts.from ?? `"NexOS Academy" <${env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "academy: gmail send failed");
    return false;
  }
}

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
}): Promise<void> {
  const useResend = !!env.RESEND_API_KEY;
  const useGmail = !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

  if (!useResend && !useGmail) {
    logger.info(
      { recipientConfigured: Boolean(opts.email) },
      "academy: access email skipped because no provider is configured",
    );
    return;
  }

  const html = renderAccessEmailHtml(opts);

  const subject = `Seu acesso à NexOS Academy — Código: ${opts.token}`;

  // Try Resend first (professional sender from @agencianexos.vip)
  if (useResend) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: opts.email,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      await resp.text();
      logger.error({ status: resp.status }, "academy: failed to send access email via Resend");
    } else {
      logger.info({ via: "resend" }, "academy: access email sent via Resend");
    }
  }
}
