import { Router } from "express";
import { z } from "zod";
import { requestBillingRefund, refreshBillingRefund } from "../billing/billing-refund-request.service.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAdminOverview, getAdminFinancials, getAdminPayments, getCampaignCostBreakdown, getAdminDRE, getAdminCRM } from "./admin.service.js";
import { queryAgentExecutionLogs, getAgentExecutionLogById, getAgentExecutionLogsSummary } from "./audit-logs.service.js";
import { markPaymentPaid } from "../billing/billing.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { collectOperationalHealth } from "../../routes/health.js";
import { getOperationalStatus } from "../operations/operational-status.service.js";
import { getAiCreditMarginMultiplier, setAiCreditMarginMultiplier } from "../ai-gateway/ai-credit-pricing.service.js";
import { requirePlatformAdmin } from "./admin.middleware.js";
import { grantCredits } from "../credits/credits.service.js";
import { triggerStrategyPhase, triggerContentPhase } from "../orchestration/orchestration.service.js";
import { getDeadLetter, listDeadLetters, replayDeadLetter } from "../orchestration/dead-letter.service.js";
import {
  db, inviteCodesTable, usersTable, workspacesTable, plansTable,
  subscriptionPaymentsTable, campaignsTable, creditTransactionsTable,
  waitlistTable, commercialProductsTable, commercialSubscriptionsTable, auditLogsTable,
  aiCreditSettingsTable, commercialSalesOffersTable,
  creditPackPricingTable,
} from "@workspace/db";
import { and, eq, desc, count, sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requirePlatformAdmin);


function assertOptionalUuid(value: string | undefined, field: string): void {
  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`${field} must be a valid UUID`);
  }
}

// GET /api/admin/operations/status — fleet-wide, sanitized operational view.
// This is deliberately admin-only; regular workspace users must use their
// product-facing integration screens and can never enumerate another tenant.
router.get("/operations/status", async (req, res): Promise<void> => {
  const query = req.query as Record<string, string | undefined>;
  assertOptionalUuid(query["workspaceId"], "workspaceId");
  assertOptionalUuid(query["campaignId"], "campaignId");
  const limitValue = query["limit"] ? Number.parseInt(query["limit"], 10) : undefined;
  const filters = {
    workspaceId: query["workspaceId"],
    campaignId: query["campaignId"],
    provider: query["provider"],
    correlationId: query["correlationId"],
    limit: Number.isFinite(limitValue) ? limitValue : undefined,
  };
  const [health, operational] = await Promise.all([
    collectOperationalHealth(),
    getOperationalStatus(filters),
  ]);
  res.status(health.statusCode).json({ health, ...operational });
});

router.get("/overview", async (req, res): Promise<void> => {
  const data = await getAdminOverview();
  res.json(data);
});

const adminPlanUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceMonthly: z.number().finite().min(0).max(1_000_000),
  priceOnboarding: z.number().finite().min(0).max(1_000_000),
  creditsMonthly: z.number().int().min(0).max(10_000_000),
  maxCampaigns: z.number().int().min(1).max(10_000),
  maxWorkspaces: z.number().int().min(1).max(10_000),
  allowedSocialNetworks: z.array(z.enum(["instagram", "facebook", "tiktok", "linkedin", "youtube"])).max(5),
  maxAccountsPerNetwork: z.record(z.string(), z.number().int().min(0).max(10_000)),
  features: z.array(z.string().trim().min(1).max(160)).max(50),
  active: z.boolean(),
}).strict();

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.slug);
  res.setHeader("Cache-Control", "no-store");
  res.json({ plans });
});

router.patch("/plans/:slug", async (req, res): Promise<void> => {
  const parsed = adminPlanUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  const slug = z.enum(["solo", "agency"]).safeParse(req.params["slug"]);
  if (!slug.success) throw new ValidationError("Plano inválido");

  const [plan] = await db.update(plansTable).set({
    ...parsed.data,
    priceMonthly: parsed.data.priceMonthly.toFixed(2),
    priceOnboarding: parsed.data.priceOnboarding.toFixed(2),
  }).where(eq(plansTable.slug, slug.data)).returning();
  if (!plan) throw new NotFoundError("Plano não encontrado");
  req.log.info({ planSlug: plan.slug, actorUserId: req.auth.userId }, "admin commercial plan updated");
  res.setHeader("Cache-Control", "no-store");
  res.json({ plan });
});

const creditPackPriceSchema = z.object({ priceBrl: z.number().finite().min(0).max(1_000_000) }).strict();

router.get("/credit-packs", async (_req, res): Promise<void> => {
  const packs = await db.select().from(creditPackPricingTable).orderBy(creditPackPricingTable.credits);
  res.setHeader("Cache-Control", "no-store");
  res.json({ packs });
});

router.patch("/credit-packs/:id", async (req, res): Promise<void> => {
  const id = z.enum(["pack_500", "pack_1500", "pack_3500", "pack_7000"]).safeParse(req.params["id"]);
  if (!id.success) throw new NotFoundError("Pack de créditos não encontrado");
  const parsed = creditPackPriceSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Informe um preço válido entre R$ 0 e R$ 1.000.000");
  const [pack] = await db.update(creditPackPricingTable).set({
    priceBrl: parsed.data.priceBrl.toFixed(2), updatedBy: req.auth.userId, updatedAt: new Date(),
  }).where(eq(creditPackPricingTable.id, id.data)).returning();
  if (!pack) throw new NotFoundError("Pack de créditos não encontrado");
  req.log.info({ packId: pack.id, actorUserId: req.auth.userId, priceBrl: Number(pack.priceBrl) }, "admin credit pack price updated");
  res.setHeader("Cache-Control", "no-store");
  res.json({ pack });
});

const salesOfferSchema = z.object({
  key: z.string().trim().min(3).max(60).regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(""),
  priceCents: z.number().int().min(100).max(100_000_000),
  interval: z.enum(["one_time", "monthly", "yearly"]),
  planSlug: z.enum(["solo", "agency"]),
  nexosAccessLifetime: z.boolean().default(false),
  campaignsIncluded: z.number().int().min(0).max(100),
  socialMediaDays: z.number().int().min(0).max(3650),
  creditsIncluded: z.number().int().min(0).max(10_000_000).default(0),
  active: z.boolean().default(true),
}).strict().superRefine((offer, ctx) => {
  if (!offer.nexosAccessLifetime && offer.campaignsIncluded === 0 && offer.socialMediaDays === 0 && offer.creditsIncluded === 0) {
    ctx.addIssue({ code: "custom", path: ["campaignsIncluded"], message: "A oferta precisa incluir ao menos um benefício" });
  }
  if (offer.interval !== "one_time" && offer.socialMediaDays > 0) {
    const recurringDays = offer.interval === "monthly" ? 30 : 365;
    if (offer.socialMediaDays !== recurringDays) {
      ctx.addIssue({ code: "custom", path: ["socialMediaDays"], message: `Para cobrança ${offer.interval}, o prazo de Social Media deve ser ${recurringDays} dias por ciclo` });
    }
  }
  if (offer.interval !== "one_time" && offer.nexosAccessLifetime) {
    ctx.addIssue({ code: "custom", path: ["nexosAccessLifetime"], message: "Acesso vitalício não pode ser cobrado em plano recorrente" });
  }
});

router.get("/sales-offers", async (_req, res): Promise<void> => {
  const offers = await db.select().from(commercialSalesOffersTable).orderBy(commercialSalesOffersTable.createdAt);
  res.setHeader("Cache-Control", "no-store");
  res.json({ offers });
});

router.post("/sales-offers", async (req, res): Promise<void> => {
  const parsed = salesOfferSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  const [existing] = await db.select({ id: commercialSalesOffersTable.id }).from(commercialSalesOffersTable)
    .where(eq(commercialSalesOffersTable.key, parsed.data.key)).limit(1);
  if (existing) throw new ValidationError("Já existe uma oferta com esse identificador");
  const [offer] = await db.insert(commercialSalesOffersTable).values(parsed.data).returning();
  req.log.info({ offerId: offer!.id, key: offer!.key, actorUserId: req.auth.userId }, "admin commercial sales offer created");
  res.status(201).json({ offer });
});

router.patch("/sales-offers/:id", async (req, res): Promise<void> => {
  const id = z.uuid().safeParse(req.params["id"]);
  if (!id.success) throw new ValidationError("ID de oferta inválido");
  const parsed = salesOfferSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  const [duplicate] = await db.select({ id: commercialSalesOffersTable.id }).from(commercialSalesOffersTable)
    .where(eq(commercialSalesOffersTable.key, parsed.data.key)).limit(1);
  if (duplicate && duplicate.id !== id.data) throw new ValidationError("Já existe uma oferta com esse identificador");
  const [offer] = await db.update(commercialSalesOffersTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(commercialSalesOffersTable.id, id.data)).returning();
  if (!offer) throw new NotFoundError("Oferta comercial");
  req.log.info({ offerId: offer.id, key: offer.key, actorUserId: req.auth.userId }, "admin commercial sales offer updated");
  res.setHeader("Cache-Control", "no-store");
  res.json({ offer });
});

router.get("/financials", async (req, res): Promise<void> => {
  const data = await getAdminFinancials();
  res.json(data);
});

router.get("/cost-breakdown", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(req.query["limit"] as string ?? "50", 10), 200);
  const dateFromRaw = req.query["dateFrom"] as string | undefined;
  const dateToRaw = req.query["dateTo"] as string | undefined;
  const parseDate = (raw: string | undefined): Date | undefined => {
    if (!raw) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) throw new ValidationError("dateFrom/dateTo devem ser datas ISO com fuso horário");
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) throw new ValidationError("Período inválido");
    return parsed;
  };
  const dateFrom = parseDate(dateFromRaw);
  const dateTo = parseDate(dateToRaw);
  if (dateFrom && dateTo && dateFrom > dateTo) throw new ValidationError("dateFrom não pode ser posterior a dateTo");
  const data = await getCampaignCostBreakdown(limit, dateFrom, dateTo);
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
});

router.get("/ai-credit-pricing", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(aiCreditSettingsTable).limit(1);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    marginMultiplier: settings ? Number(settings.marginMultiplier) : await getAiCreditMarginMultiplier(),
    creditsPerUsd: 100,
    updatedAt: settings?.updatedAt ?? null,
  });
});

router.patch("/ai-credit-pricing", async (req, res): Promise<void> => {
  const parsed = z.object({ marginMultiplier: z.number().finite().min(0.1).max(100) }).strict().safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Multiplicador deve estar entre 0,1x e 100x");
  const settings = await setAiCreditMarginMultiplier(parsed.data.marginMultiplier, req.auth.userId);
  req.log.info({ actorUserId: req.auth.userId, marginMultiplier: Number(settings.marginMultiplier) }, "admin AI credit pricing updated");
  res.setHeader("Cache-Control", "no-store");
  res.json({ marginMultiplier: Number(settings.marginMultiplier), creditsPerUsd: 100, updatedAt: settings.updatedAt });
});

router.get("/dre", async (req, res): Promise<void> => {
  const year = parseInt(req.query["year"] as string ?? String(new Date().getFullYear()), 10);
  const data = await getAdminDRE(year);
  res.json(data);
});

router.get("/crm", async (req, res): Promise<void> => {
  const data = await getAdminCRM();
  res.json(data);
});

router.get("/payments", async (req, res): Promise<void> => {
  const status = req.query["status"] as string | undefined;
  const limit  = parseInt(req.query["limit"] as string ?? "100", 10);
  const data = await getAdminPayments({ status, limit });
  res.json({ payments: data });
});

router.post("/payments/:paymentId/refund", async (req, res): Promise<void> => {
  const parsed = z.object({ paymentId: z.string().uuid(), amountCents: z.number().int().positive().safe() }).safeParse({ ...req.body, paymentId: req.params["paymentId"] });
  if (!parsed.success) throw new ValidationError("Informe pagamento e valor em centavos válidos");
  res.status(202).json(await requestBillingRefund(parsed.data.paymentId, parsed.data.amountCents));
});

router.post("/payments/:paymentId/refund/refresh", async (req, res): Promise<void> => {
  const paymentId = z.string().uuid().safeParse(req.params["paymentId"]);
  if (!paymentId.success) throw new ValidationError("Pagamento inválido");
  res.json(await refreshBillingRefund(paymentId.data));
});

router.post("/payments/:paymentId/confirm", async (req, res): Promise<void> => {
  const paymentId = req.params["paymentId"] as string;
  const note = (req.body as { note?: string }).note ?? `Confirmado manualmente por ${req.auth.email}`;

  const payments = await getAdminPayments({ limit: 1000 });
  const p = payments.find(x => x.id === paymentId);
  if (!p) { res.status(404).json({ error: "Pagamento não encontrado" }); return; }

  const updated = await markPaymentPaid(p.workspaceId, paymentId, note);
  res.json({ payment: updated, message: "Pagamento confirmado com sucesso" });
});

// ─── Invite Codes ─────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/admin/invite-codes — list all invite codes (with used-by name via join)
router.get("/invite-codes", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: inviteCodesTable.id,
      code: inviteCodesTable.code,
      planSlug: inviteCodesTable.planSlug,
      label: inviteCodesTable.label,
      used: inviteCodesTable.used,
      usedByEmail: inviteCodesTable.usedByEmail,
      usedByUserId: inviteCodesTable.usedByUserId,
      usedByWorkspaceId: inviteCodesTable.usedByWorkspaceId,
      usedAt: inviteCodesTable.usedAt,
      createdAt: inviteCodesTable.createdAt,
      usedByName: usersTable.name,
    })
    .from(inviteCodesTable)
    .leftJoin(usersTable, eq(inviteCodesTable.usedByUserId, usersTable.id))
    .orderBy(desc(inviteCodesTable.createdAt));
  res.json({ codes: rows });
});

// POST /api/admin/invite-codes/generate — generate N new invite codes
router.post("/invite-codes/generate", async (req, res): Promise<void> => {
  const { count = 10, planSlug = "agency", label } = req.body as {
    count?: number;
    planSlug?: string;
    label?: string;
  };

  const toInsert = Array.from({ length: Math.min(count, 50) }, () => ({
    code: generateInviteCode(),
    planSlug,
    label: label ?? null,
  }));

  const inserted = await db
    .insert(inviteCodesTable)
    .values(toInsert)
    .returning();

  res.status(201).json({ codes: inserted });
});

// DELETE /api/admin/invite-codes/:id — delete a free invite code
router.delete("/invite-codes/:id", async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const [code] = await db
    .select()
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.id, id))
    .limit(1);
  if (!code) { res.status(404).json({ error: "Código não encontrado" }); return; }
  if (code.used) { res.status(409).json({ error: "Código já utilizado — não pode ser deletado" }); return; }
  await db.delete(inviteCodesTable).where(eq(inviteCodesTable.id, id));
  res.json({ ok: true });
});

// ─── Grant plan access to existing workspace ──────────────────────────────────
router.post("/workspaces/:workspaceId/grant-plan", async (req, res): Promise<void> => {
  const { workspaceId } = req.params as { workspaceId: string };
  const { planSlug, note } = req.body as { planSlug?: string; note?: string };

  if (!planSlug || !["solo", "agency"].includes(planSlug)) {
    res.status(400).json({ error: "planSlug deve ser 'solo' ou 'agency'" });
    return;
  }

  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  if (!workspace) throw new NotFoundError("Workspace não encontrado");

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug as "solo" | "agency")).limit(1);
  if (!plan) throw new NotFoundError("Plano não encontrado");

  await db.update(workspacesTable)
    .set({
      planId: plan.id,
      creditsMonthlyBalance: Math.max(workspace.creditsMonthlyBalance ?? 0, plan.creditsMonthly),
      creditsBalance: (workspace.creditsPurchasedBalance ?? 0) + Math.max(workspace.creditsMonthlyBalance ?? 0, plan.creditsMonthly),
    })
    .where(eq(workspacesTable.id, workspaceId));

  req.log.info({ workspaceId, planSlug, grantedByUserId: req.auth.userId }, "admin grant-plan");
  res.json({ ok: true, planName: plan.name, creditsGranted: plan.creditsMonthly });
});

// ─── Grant permanent campaign/briefing access without recording a payment ────
// This is separate from the workspace plan grant: campaign creation requires
// an active commercial subscription, which is a different entitlement.
const NEXOS_CAMPAIGN_ACCESS_PRODUCT = {
  key: "nexos_campaign_access",
  name: "NexOS Campaign Access",
  masterPlanKey: "launch",
} as const;

router.post("/workspaces/:workspaceId/grant-campaign-access", async (req, res): Promise<void> => {
  const workspaceId = req.params["workspaceId"] as string;
  const parsed = z.object({ note: z.string().trim().max(500).optional() }).safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [workspace] = await tx.select({ id: workspacesTable.id })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    if (!workspace) throw new NotFoundError("Workspace não encontrado");

    let [product] = await tx.select({ id: commercialProductsTable.id, status: commercialProductsTable.status })
      .from(commercialProductsTable).where(eq(commercialProductsTable.key, NEXOS_CAMPAIGN_ACCESS_PRODUCT.key)).limit(1);
    if (!product) {
      await tx.insert(commercialProductsTable).values({
        ...NEXOS_CAMPAIGN_ACCESS_PRODUCT,
        metadata: { purpose: "admin_granted_campaign_access" },
      }).onConflictDoNothing({ target: commercialProductsTable.key });
      [product] = await tx.select({ id: commercialProductsTable.id, status: commercialProductsTable.status })
        .from(commercialProductsTable).where(eq(commercialProductsTable.key, NEXOS_CAMPAIGN_ACCESS_PRODUCT.key)).limit(1);
    }
    if (!product || product.status !== "active") {
      throw new ValidationError("O produto de acesso a campanhas do NexOS não está ativo");
    }

    const [existing] = await tx.select({ id: commercialSubscriptionsTable.id })
      .from(commercialSubscriptionsTable)
      .where(and(
        eq(commercialSubscriptionsTable.workspaceId, workspaceId),
        eq(commercialSubscriptionsTable.productId, product.id),
        eq(commercialSubscriptionsTable.status, "active"),
      )).limit(1);
    if (existing) return { subscriptionId: existing.id, created: false };

    const note = parsed.data.note || "Concessão permanente de acesso ao briefing/campanhas autorizada pelo founder.";
    const [subscription] = await tx.insert(commercialSubscriptionsTable).values({
      workspaceId,
      productId: product.id,
      status: "active",
      startedAt: new Date(),
      endsAt: null,
      providerMetadata: {
        source: "admin_grant",
        permanent: true,
        note,
        grantedByUserId: req.auth.userId,
      },
    }).returning({ id: commercialSubscriptionsTable.id });

    await tx.insert(auditLogsTable).values({
      workspaceId,
      action: "commercial_subscription.admin_granted",
      actor: "platform_admin",
      data: {
        subscriptionId: subscription!.id,
        productKey: NEXOS_CAMPAIGN_ACCESS_PRODUCT.key,
        permanent: true,
        note,
        grantedByUserId: req.auth.userId,
      },
    });
    return { subscriptionId: subscription!.id, created: true };
  });

  req.log.info({ workspaceId, subscriptionId: result.subscriptionId, created: result.created }, "admin grant permanent campaign access");
  res.status(result.created ? 201 : 200).json({
    ok: true,
    permanent: true,
    created: result.created,
    subscriptionId: result.subscriptionId,
    productName: NEXOS_CAMPAIGN_ACCESS_PRODUCT.name,
  });
});

// ─── User detail / profile ────────────────────────────────────────────────────
router.get("/users/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };

  const [user] = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
      workspaceId: workspacesTable.id,
      workspaceName: workspacesTable.name,
      workspaceStatus: workspacesTable.status,
      planId: workspacesTable.planId,
      planName: plansTable.name,
      planSlug: plansTable.slug,
      creditsBalance: workspacesTable.creditsBalance,
      activeCampaigns: workspacesTable.activeCampaigns,
    })
    .from(usersTable)
    .innerJoin(workspacesTable, eq(workspacesTable.ownerId, usersTable.id))
    .leftJoin(plansTable, eq(plansTable.id, workspacesTable.planId))
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError("Usuário não encontrado");

  // Invite code used at registration (lead source)
  const [invite] = await db
    .select({ code: inviteCodesTable.code, planSlug: inviteCodesTable.planSlug, usedAt: inviteCodesTable.usedAt })
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.usedByUserId, userId))
    .limit(1);

  // Payments
  const payments = await db
    .select({
      id: subscriptionPaymentsTable.id,
      amountCents: subscriptionPaymentsTable.amountCents,
      currency: subscriptionPaymentsTable.currency,
      method: subscriptionPaymentsTable.method,
      status: subscriptionPaymentsTable.status,
      description: subscriptionPaymentsTable.description,
      createdAt: subscriptionPaymentsTable.createdAt,
      paidAt: subscriptionPaymentsTable.paidAt,
    })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.workspaceId, user.workspaceId))
    .orderBy(desc(subscriptionPaymentsTable.createdAt))
    .limit(20);

  // Campaigns
  const campaigns = await db
    .select({
      id: campaignsTable.id,
      name: campaignsTable.title,
      type: campaignsTable.type,
      status: campaignsTable.status,
      track: campaignsTable.track,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, user.workspaceId))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(20);

  // Credit usage stats
  const [creditStats] = await db
    .select({
      totalDebited: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactionsTable.type}='debit' THEN ${creditTransactionsTable.amount} ELSE 0 END),0)`.mapWith(Number),
      totalCredited: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactionsTable.type}='credit' THEN ${creditTransactionsTable.amount} ELSE 0 END),0)`.mapWith(Number),
      txCount: count(),
    })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, user.workspaceId));

  // Recent credit transactions
  const recentCredits = await db
    .select({
      id: creditTransactionsTable.id,
      type: creditTransactionsTable.type,
      amount: creditTransactionsTable.amount,
      action: creditTransactionsTable.action,
      createdAt: creditTransactionsTable.createdAt,
    })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, user.workspaceId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(10);

  res.json({
    user,
    leadSource: invite ?? null,
    payments,
    campaigns,
    creditStats: creditStats ?? { totalDebited: 0, totalCredited: 0, txCount: 0 },
    recentCredits,
  });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs/summary — aggregate stats
router.get("/audit-logs/summary", async (req, res): Promise<void> => {
  const summary = await getAgentExecutionLogsSummary();
  res.json(summary);
});

// GET /api/admin/audit-logs — list with filters
router.get("/audit-logs", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const logs = await queryAgentExecutionLogs({
    campaignId:       q["campaignId"],
    agentName:        q["agentName"],
    executionStatus:  q["executionStatus"],
    minRiskScore:     q["minRiskScore"] !== undefined ? parseFloat(q["minRiskScore"]) : undefined,
    approvalRequired: q["approvalRequired"] !== undefined ? q["approvalRequired"] === "true" : undefined,
    isDryRun:         q["isDryRun"] !== undefined ? q["isDryRun"] === "true" : undefined,
    dateFrom:         q["dateFrom"],
    dateTo:           q["dateTo"],
    limit:            q["limit"] !== undefined ? parseInt(q["limit"], 10) : 50,
    offset:           q["offset"] !== undefined ? parseInt(q["offset"], 10) : 0,
  });
  res.json({ logs });
});

// GET /api/admin/audit-logs/:id — single log detail
router.get("/audit-logs/:id", async (req, res): Promise<void> => {
  const log = await getAgentExecutionLogById(req.params["id"] as string);
  if (!log) { res.status(404).json({ error: "Log não encontrado" }); return; }
  res.json({ log });
});

// ─── Waitlist / Access Requests ───────────────────────────────────────────────

// GET /api/admin/waitlist — list all waitlist entries
router.get("/waitlist", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(waitlistTable)
    .orderBy(desc(waitlistTable.createdAt));
  res.json({ entries: rows, total: rows.length });
});

// POST /api/admin/waitlist/:id/approve — generate invite code + mark as notified
router.post("/waitlist/:id/approve", async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const { planSlug = "solo" } = req.body as { planSlug?: string };

  const [entry] = await db
    .select()
    .from(waitlistTable)
    .where(eq(waitlistTable.id, id))
    .limit(1);
  if (!entry) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

  const code = generateInviteCode();
  const [invite] = await db
    .insert(inviteCodesTable)
    .values({ code, planSlug, label: `waitlist:${entry.whatsapp}` })
    .returning();

  await db
    .update(waitlistTable)
    .set({ notified: true, confirmedAt: new Date() })
    .where(eq(waitlistTable.id, id));

  res.status(201).json({ code: invite!.code, planSlug, entry });
});

// DELETE /api/admin/waitlist/:id — remove / reject entry
router.delete("/waitlist/:id", async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  await db.delete(waitlistTable).where(eq(waitlistTable.id, id));
  res.json({ ok: true });
});

// ─── Admin: adicionar créditos a qualquer workspace ──────────────────────────
// POST /api/admin/workspaces/:workspaceId/add-credits { amount: number, note?: string }
router.post("/workspaces/:workspaceId/add-credits", async (req, res): Promise<void> => {
  const { workspaceId } = req.params as { workspaceId: string };
  const { amount, note } = req.body as { amount?: number; note?: string };

  if (!amount || typeof amount !== "number" || amount <= 0 || amount > 50_000) {
    res.status(400).json({ error: "amount deve ser um número positivo até 50.000" });
    return;
  }

  const [workspace] = await db.select({ id: workspacesTable.id, name: workspacesTable.name })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  if (!workspace) throw new NotFoundError("Workspace não encontrado");

  const tx = await grantCredits(
    workspaceId,
    amount,
    "admin_grant",
    req.log,
    note ?? `Recarga admin por ${req.auth.email}`,
  );

  req.log.info({ workspaceId, amount, grantedByUserId: req.auth.userId, balanceAfter: tx.balanceAfter }, "admin add-credits");
  res.json({ ok: true, workspaceName: workspace.name, credited: amount, newBalance: tx.balanceAfter });
});

// ─── Admin: forçar retry de campanha travada (ignora ownership) ────────────────
// POST /api/admin/campaigns/:campaignId/force-retry
router.post("/campaigns/:campaignId/force-retry", async (req, res): Promise<void> => {
  const { campaignId } = req.params as { campaignId: string };

  const [campaign] = await db
    .select({ status: campaignsTable.status, workspaceId: campaignsTable.workspaceId, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campanha não encontrada");

  if (!["analyzing", "generating"].includes(campaign.status)) {
    res.status(400).json({
      error: `Campanha não está travada (status: ${campaign.status}). Só é possível retry em analyzing ou generating.`,
      code: "NOT_STUCK",
      currentStatus: campaign.status,
    });
    return;
  }

  const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
  const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
  const retryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;

  const clearedBrain = {
    ...brain,
    pipelineCheckpoint: { ...cp, lockedAt: null, lastProgressAt: null },
    contentRetry: { ...contentRetry, retryCount: retryCount + 1, lastRetryAt: new Date().toISOString(), adminRetry: true, adminRetryBy: req.auth.email },
  };

  if (campaign.status === "analyzing") {
    await db.update(campaignsTable)
      .set({ status: "intake" as any, updatedAt: new Date(), brainData: clearedBrain as any })
      .where(eq(campaignsTable.id, campaignId));
    const result = await triggerStrategyPhase(campaignId, campaign.workspaceId, req.log);
    req.log.info({ campaignId, adminUserId: req.auth.userId }, "[ADMIN FORCE-RETRY] analyzing → strategy re-enqueued");
    res.status(202).json({ retried: true, phase: "strategy", queued: result.queued });
  } else {
    await db.update(campaignsTable)
      .set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: clearedBrain as any })
      .where(eq(campaignsTable.id, campaignId));
    const result = await triggerContentPhase(campaignId, campaign.workspaceId, req.log);
    req.log.info({ campaignId, adminUserId: req.auth.userId }, "[ADMIN FORCE-RETRY] generating → content re-enqueued");
    res.status(202).json({ retried: true, phase: "content", queued: result.queued });
  }
});

// Operational records are platform-admin only: they can cover multiple tenants.
router.get("/dead-letters", async (req, res): Promise<void> => {
  const limit = Number.parseInt(String(req.query["limit"] ?? "100"), 10);
  res.json({ deadLetters: await listDeadLetters(Number.isFinite(limit) ? limit : 100) });
});

router.get("/dead-letters/:id", async (req, res): Promise<void> => {
  const record = await getDeadLetter(req.params["id"] as string);
  if (!record) throw new NotFoundError("Dead-letter record");
  res.json({ deadLetter: record });
});

router.post("/dead-letters/:id/replay", async (req, res): Promise<void> => {
  const result = await replayDeadLetter(req.params["id"] as string, req.auth.email);
  if (!result.accepted) {
    res.status(409).json({ error: "Replay already claimed or record does not exist", code: "REPLAY_ALREADY_CLAIMED" });
    return;
  }
  res.status(202).json({ replayed: true, replayJobId: result.replayJobId });
});

export default router;
