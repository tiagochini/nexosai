import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const ASAAS_BASE = env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/api/v3";

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

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

// Find existing customer by email, or create a new one
export async function findOrCreateCustomer(name: string, email: string): Promise<AsaasCustomer> {
  // Search existing
  const searchResp = await fetch(
    `${ASAAS_BASE}/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: asaasHeaders() }
  );
  if (!searchResp.ok) {
    const text = await searchResp.text();
    logger.error({ status: searchResp.status, body: text }, "asaas: customer search failed");
    throw new Error("Falha ao consultar clientes no Asaas");
  }
  const searchData = await searchResp.json() as { data?: AsaasCustomer[] };
  if (searchData.data && searchData.data.length > 0) {
    return searchData.data[0];
  }

  // Create new
  const createResp = await fetch(`${ASAAS_BASE}/customers`, {
    method: "POST",
    headers: asaasHeaders(),
    body: JSON.stringify({ name, email }),
  });
  if (!createResp.ok) {
    const text = await createResp.text();
    logger.error({ status: createResp.status, body: text }, "asaas: customer create failed");
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
  successUrl: string;
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
      callback: {
        successUrl: opts.successUrl,
        autoRedirect: true,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    logger.error({ status: resp.status, body: text }, "asaas: payment create failed");
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

// Send access token via Resend (if configured)
export async function sendAccessEmail(opts: {
  email: string;
  name: string;
  token: string;
  productName: string;
  portalUrl: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.info({ email: opts.email, token: opts.token }, "academy: access token generated (Resend not configured — log only)");
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f14;color:#e2e8f0;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);border-radius:10px;padding:10px 16px;font-size:22px;font-weight:800;color:#fff">N</div>
        <p style="color:#a0aec0;margin-top:8px;font-size:14px">NexOS Academy</p>
      </div>
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin-bottom:8px">Seu acesso está pronto, ${opts.name.split(" ")[0]}!</h1>
      <p style="color:#a0aec0;margin-bottom:24px">Sua compra de <strong style="color:#e2e8f0">${opts.productName}</strong> foi confirmada. Use o código abaixo para acessar o portal:</p>
      <div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="color:#a0aec0;font-size:12px;margin-bottom:8px;letter-spacing:0.1em;text-transform:uppercase">Seu Código de Acesso</p>
        <p style="font-size:32px;font-weight:800;color:#a78bfa;letter-spacing:4px;margin:0">${opts.token}</p>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${opts.portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Acessar o Portal →</a>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center">Guarde este código. Você precisará dele para acessar o portal em outros dispositivos.<br/>Suporte: suporte@nexos.ai</p>
    </div>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: opts.email,
      subject: `Seu acesso à NexOS Academy — Código: ${opts.token}`,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    logger.error({ status: resp.status, body: text }, "academy: failed to send access email");
  } else {
    logger.info({ email: opts.email }, "academy: access email sent");
  }
}
