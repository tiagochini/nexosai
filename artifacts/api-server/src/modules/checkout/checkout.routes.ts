import { Router } from "express";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable, plansTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { issueTokens } from "../auth/auth.service.js";
import { requireTrustedSessionOrigin, sendSessionTokens } from "../auth/auth-session-cookie.js";

const router = Router();

const simulateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  password: z.string().min(6),
  // Optional credit pack — determines starting credits (non-expiring)
  creditPackId: z.string().optional(),
  creditPackCredits: z.number().int().min(0).optional(),
  // Test-mode payment fields — ignored, any value accepted
  testCard: z.object({
    number: z.string().optional(),
    expiry: z.string().optional(),
    cvv: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
});

const initiateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  password: z.string().min(6),
  cpfCnpj: z.string().optional(),
  plan: z.enum(["solo", "agency"]).optional().default("solo"),
  creditPackId: z.string().optional(),
  creditPackCredits: z.number().int().min(0).optional(),
});

// ─── Asaas PIX helper (for new-user checkout, before workspace exists) ─────────

const ASAAS_BASE_URL =
  process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

const PLAN_AMOUNTS: Record<string, number> = {
  solo: 3990,
  agency: 9990,
};

async function createCheckoutPix(opts: {
  name: string;
  email: string;
  cpfCnpj?: string;
  plan: string;
  description: string;
}): Promise<{ asaasId: string; qrCode: string; copiaECola: string; expiresAt: string } | null> {
  const apiKey = process.env["ASAAS_API_KEY"];
  if (!apiKey) return null;

  const amount = PLAN_AMOUNTS[opts.plan] ?? 3990;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  async function asaasPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json() as T;
    if (!res.ok) throw new Error(`Asaas error ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  async function asaasGet<T>(path: string): Promise<T> {
    const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
      headers: { "access_token": apiKey },
    });
    const data = await res.json() as T;
    if (!res.ok) throw new Error(`Asaas error ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  const customer = await asaasPost<{ id: string }>("/customers", {
    name: opts.name,
    email: opts.email,
    cpfCnpj: opts.cpfCnpj?.replace(/\D/g, "") || "00000000000",
  });

  const payment = await asaasPost<{ id: string }>("/payments", {
    customer: customer.id,
    billingType: "PIX",
    value: amount,
    dueDate,
    description: opts.description,
  });

  const pix = await asaasGet<{
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

// ─── Shared: create or find user + workspace ───────────────────────────────────

async function ensureUserAndWorkspace(opts: {
  name: string;
  email: string;
  password: string;
  creditPackCredits?: number;
  planSlug?: string;
}): Promise<{
  userId: string;
  workspaceId: string;
  isNewUser: boolean;
  startingCredits: number;
}> {
  const planSlug = (opts.planSlug === "agency" ? "agency" : "solo") as "solo" | "agency";

  const [basePlan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, planSlug))
    .limit(1);

  const [fallbackPlan] = basePlan
    ? [basePlan]
    : await db.select().from(plansTable).limit(1);

  if (!fallbackPlan) throw new Error("Plano base não encontrado. Execute o seed de planos.");

  const startingCredits = fallbackPlan.creditsMonthly + (opts.creditPackCredits ?? 0);

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, opts.email.toLowerCase()))
    .limit(1);

  let userId: string;
  let workspaceId: string;
  let isNewUser = false;

  if (existingUser) {
    let [existingWorkspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, existingUser.id))
      .limit(1);

    if (!existingWorkspace) {
      const slug = `${existingUser.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "user"}-${Date.now()}`;
      [existingWorkspace] = await db
        .insert(workspacesTable)
        .values({
          ownerId: existingUser.id,
          planId: fallbackPlan.id,
          name: `${existingUser.name ?? opts.email}'s Workspace`,
          slug,
          creditsBalance: startingCredits,
        })
        .returning();
    } else {
      await db
        .update(workspacesTable)
        .set({ creditsBalance: existingWorkspace.creditsBalance + (opts.creditPackCredits ?? 0) })
        .where(eq(workspacesTable.id, existingWorkspace.id));
    }

    userId = existingUser.id;
    workspaceId = existingWorkspace.id;
  } else {
    isNewUser = true;
    const passwordHash = await bcrypt.hash(opts.password, 10);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: opts.email.toLowerCase(),
        passwordHash,
        name: opts.name,
        locale: "pt-BR",
      })
      .returning();

    const slug = `${opts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const [newWorkspace] = await db
      .insert(workspacesTable)
      .values({
        ownerId: newUser.id,
        planId: fallbackPlan.id,
        name: `${opts.name}'s Workspace`,
        slug,
        creditsBalance: startingCredits,
      })
      .returning();

    userId = newUser.id;
    workspaceId = newWorkspace.id;
  }

  return { userId, workspaceId, isNewUser, startingCredits };
}

// POST /api/checkout/simulate
// Test-mode purchase — creates or logs in account, ignores email verification,
// payment data is fully simulated. Returns JWT for immediate access.
router.post("/simulate", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = simulateSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email e senha." });
    return;
  }

  const { name, email, password, creditPackCredits } = parsed;

  try {
    const { userId, workspaceId, isNewUser, startingCredits } = await ensureUserAndWorkspace({
      name, email, password, creditPackCredits,
    });

    const payload = { userId, workspaceId, email: email.toLowerCase() };
    logger.info({ userId, workspaceId, startingCredits }, isNewUser ? "checkout: new user created" : "checkout: existing user re-access");

    res.json({
      success: true,
      ...sendSessionTokens(res, await issueTokens({ id: userId, email: payload.email }, workspaceId)),
      isNewUser,
      startingCredits,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    res.status(500).json({ error: msg });
  }
});

// POST /api/checkout/initiate
// Real Asaas PIX checkout — creates account + initiates PIX payment.
// Returns JWT for immediate access + PIX QR code data.
// If ASAAS_API_KEY not set, falls back to simulate behavior.
router.post("/initiate", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = initiateSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email, senha e CPF." });
    return;
  }

  const { name, email, password, cpfCnpj, plan, creditPackCredits } = parsed;

  try {
    const { userId, workspaceId, isNewUser, startingCredits } = await ensureUserAndWorkspace({
      name, email, password, creditPackCredits, planSlug: plan,
    });

    const payload = { userId, workspaceId, email: email.toLowerCase() };
    logger.info({ userId, workspaceId, plan, startingCredits }, isNewUser ? "checkout/initiate: new user + Asaas PIX" : "checkout/initiate: existing user re-access");

    // Attempt to create real Asaas PIX (null if ASAAS_API_KEY not set)
    let pixData: { asaasId: string; qrCode: string; copiaECola: string; expiresAt: string } | null = null;
    try {
      pixData = await createCheckoutPix({
        name,
        email,
        cpfCnpj,
        plan,
        description: `NexOS AI — Plano ${plan === "agency" ? "Agency" : "Solo"} — Acesso Vitalício`,
      });
    } catch (asaasErr) {
      logger.warn({ err: asaasErr }, "checkout/initiate: Asaas PIX creation failed — returning simulate fallback");
    }

    res.json({
      success: true,
      ...sendSessionTokens(res, await issueTokens({ id: userId, email: payload.email }, workspaceId)),
      isNewUser,
      startingCredits,
      plan,
      planAmount: PLAN_AMOUNTS[plan] ?? 3990,
      pix: pixData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    res.status(500).json({ error: msg });
  }
});

export default router;
