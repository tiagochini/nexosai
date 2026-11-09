import { hasActivePlatformAdminSession, requirePlatformAdmin } from "../admin/admin.middleware.js";
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  initiatePayment,
  initiatePackPayment,
  getPaymentById,
  getPaymentHistory,
  getSubscriptionStatus,
  markPaymentPaid,
  processAsaasWebhook,
  initiateSalesOfferPurchase,
  getSalesOfferContracts,
  cancelSalesOfferContract,
} from "./billing.service.js";
import { db, inviteCodesTable, workspacesTable, plansTable, subscriptionPaymentsTable, commercialProductsTable, commercialSubscriptionsTable, commercialSalesOffersTable, commercialOfferContractsTable, creditPackPricingTable } from "@workspace/db";
import { and, eq, gt, isNotNull, isNull, or, sql, inArray } from "drizzle-orm";
import { matchesAsaasWebhookToken } from "../../lib/asaas-webhook-auth.js";
import { checkBillingManualConfirmation } from "./billing.security.js";
import { activateTrialSettings, canRepairConsumedTrialAccess, trialFromSettings } from "../auth/trial-access.service.js";
import { activateWorkspacePlanAccess } from "./billing-plan-activation.js";

const router = Router();

router.get("/packs", requireAuth, async (_req, res): Promise<void> => {
  const packs = await db.select({
    id: creditPackPricingTable.id, credits: creditPackPricingTable.credits,
    priceBrl: creditPackPricingTable.priceBrl, label: creditPackPricingTable.label,
    description: creditPackPricingTable.description, highlight: creditPackPricingTable.highlight,
  }).from(creditPackPricingTable).orderBy(creditPackPricingTable.credits);
  res.setHeader("Cache-Control", "no-store");
  res.json({ packs: packs.map((pack) => ({ ...pack, priceBrl: Number(pack.priceBrl) })) });
});

const cardDataSchema = z.object({
  holderName: z.string().min(1),
  number: z.string().min(13),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Informe o mês de validade entre 01 e 12"),
  expiryYear: z.string().trim().regex(/^\d{2}(?:\d{2})?$/, "Informe o ano de validade com 2 ou 4 dígitos")
    .transform(value => value.length === 2 ? `20${value}` : value),
  cvv: z.string().min(3).max(4),
  cpfCnpj: z.string().trim().refine(value => [11, 14].includes(value.replace(/\D/g, "").length), "Informe um CPF/CNPJ válido"),
  phone: z.string().trim().transform(value => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{10,13}$/, "Informe um telefone válido para o titular")),
  postalCode: z.string().trim().transform(value => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/, "Informe um CEP válido")),
  addressNumber: z.string().trim().min(1, "Informe o número do endereço de cobrança").max(20),
});

const payerDocumentSchema = z.string().trim().max(20)
  .transform(value => value.replace(/[.\-/\s]/g, ""))
  .pipe(z.string().regex(/^(\d{11}|\d{14})$/, "Informe um CPF/CNPJ válido"));

// Public product details used by the shareable sales page. Only active offers
// tied to an active license plan are visible; checkout still requires auth.
router.get("/public-offers/:key", async (req, res): Promise<void> => {
  const key = z.string().trim().min(1).max(120).safeParse(req.params["key"]);
  if (!key.success) { res.status(404).json({ error: "Oferta não encontrada", code: "NOT_FOUND" }); return; }
  const [offer] = await db.select({
    id: commercialSalesOffersTable.id, key: commercialSalesOffersTable.key, name: commercialSalesOffersTable.name,
    description: commercialSalesOffersTable.description, priceCents: commercialSalesOffersTable.priceCents,
    planSlug: commercialSalesOffersTable.planSlug, licensePlanName: plansTable.name,
    licenseMaxCampaigns: plansTable.maxCampaigns, licenseMaxWorkspaces: plansTable.maxWorkspaces,
    licenseSocialNetworks: plansTable.allowedSocialNetworks, licenseWhiteLabel: plansTable.whiteLabel,
    licenseFeatures: plansTable.features, interval: commercialSalesOffersTable.interval,
    nexosAccessLifetime: commercialSalesOffersTable.nexosAccessLifetime,
    campaignsIncluded: commercialSalesOffersTable.campaignsIncluded, socialMediaDays: commercialSalesOffersTable.socialMediaDays,
    creditsIncluded: commercialSalesOffersTable.creditsIncluded,
  }).from(commercialSalesOffersTable)
    .innerJoin(plansTable, eq(plansTable.slug, commercialSalesOffersTable.planSlug))
    .where(and(eq(commercialSalesOffersTable.key, key.data), eq(commercialSalesOffersTable.active, true), eq(plansTable.active, true), isNotNull(commercialSalesOffersTable.planSlug)))
    .limit(1);
  if (!offer) { res.status(404).json({ error: "Esta oferta não está disponível", code: "OFFER_NOT_AVAILABLE" }); return; }
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.json({ offer });
});

router.get("/offers", requireAuth, async (_req, res): Promise<void> => {
  const offers = await db.select({
    id: commercialSalesOffersTable.id, key: commercialSalesOffersTable.key, name: commercialSalesOffersTable.name,
    description: commercialSalesOffersTable.description, priceCents: commercialSalesOffersTable.priceCents,
    planSlug: commercialSalesOffersTable.planSlug, licensePlanName: plansTable.name,
    licenseMaxCampaigns: plansTable.maxCampaigns, licenseMaxWorkspaces: plansTable.maxWorkspaces,
    licenseSocialNetworks: plansTable.allowedSocialNetworks, licenseWhiteLabel: plansTable.whiteLabel,
    licenseFeatures: plansTable.features,
    interval: commercialSalesOffersTable.interval, nexosAccessLifetime: commercialSalesOffersTable.nexosAccessLifetime,
    campaignsIncluded: commercialSalesOffersTable.campaignsIncluded, socialMediaDays: commercialSalesOffersTable.socialMediaDays,
    creditsIncluded: commercialSalesOffersTable.creditsIncluded,
  }).from(commercialSalesOffersTable)
    .innerJoin(plansTable, eq(plansTable.slug, commercialSalesOffersTable.planSlug))
    .where(and(eq(commercialSalesOffersTable.active, true), eq(plansTable.active, true), isNotNull(commercialSalesOffersTable.planSlug)));
  res.setHeader("Cache-Control", "no-store");
  res.json({ offers });
});

router.get("/offer-contracts", requireAuth, async (req, res): Promise<void> => {
  const contracts = await getSalesOfferContracts(req.auth.workspaceId);
  res.json({ contracts: contracts.map(contract => ({
    id: contract.id, offer: contract.offerSnapshot, status: contract.status, startedAt: contract.startedAt,
    currentPeriodEndsAt: contract.currentPeriodEndsAt, recurring: Boolean(contract.providerSubscriptionId), createdAt: contract.createdAt,
  })) });
});

router.post("/offers/:offerId/purchase", requireAuth, async (req, res): Promise<void> => {
  const offerId = z.uuid().safeParse(req.params["offerId"]);
  if (!offerId.success) { res.status(400).json({ error: "ID da oferta inválido", code: "VALIDATION_ERROR" }); return; }
  const parsed = z.object({
    method: z.enum(["pix", "boleto", "credit_card"]),
    card: cardDataSchema.optional(),
    cpfCnpj: payerDocumentSchema.optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados de compra inválidos", code: "VALIDATION_ERROR" });
    return;
  }
  const result = await initiateSalesOfferPurchase({
    workspaceId: req.auth.workspaceId, userId: req.auth.userId, offerId: offerId.data,
    method: parsed.data.method, userName: req.auth.email, userEmail: req.auth.email,
    card: parsed.data.card, cpfCnpj: parsed.data.cpfCnpj, remoteIp: req.ip ?? "",
  });
  res.status(201).json(result);
});

router.post("/offer-contracts/:contractId/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = z.uuid().safeParse(req.params["contractId"]);
  if (!id.success) { res.status(400).json({ error: "ID inválido", code: "VALIDATION_ERROR" }); return; }
  const contract = await cancelSalesOfferContract(req.auth.workspaceId, id.data);
  res.json({ contract: { id: contract.id, status: contract.status, currentPeriodEndsAt: contract.currentPeriodEndsAt } });
});

// ─── Subscription status ──────────────────────────────────────────────────────

router.get("/status", requireAuth, async (req, res): Promise<void> => {
  const status = await getSubscriptionStatus(req.auth.workspaceId);
  res.json(status);
});

router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt(req.query["limit"] as string ?? "20", 10);
  const payments = await getPaymentHistory(req.auth.workspaceId, limit);
  res.json({ payments });
});

// ─── Payment status polling ───────────────────────────────────────────────────

router.get("/payment/:paymentId", requireAuth, async (req, res): Promise<void> => {
  const paymentId = req.params["paymentId"] as string;
  const payment = await getPaymentById(req.auth.workspaceId, paymentId);
  if (!payment) {
    res.status(404).json({ error: "Pagamento não encontrado", code: "NOT_FOUND" });
    return;
  }
  res.json({ payment });
});

// ─── Initiate plan payment ────────────────────────────────────────────────────

const initiateSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum(["pix", "boleto", "bank_transfer", "credit_card", "manual"]),
  card: cardDataSchema.optional(),
  cpfCnpj: payerDocumentSchema.optional(),
}).refine(data => !["pix", "boleto"].includes(data.method) || Boolean(data.cpfCnpj), {
  message: "Informe o CPF/CNPJ para emitir PIX ou boleto", path: ["cpfCnpj"],
});

router.post("/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados de pagamento inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const payment = await initiatePayment({
    workspaceId: req.auth.workspaceId,
    userId: req.auth.userId,
    planId: parsed.data.planId,
    method: parsed.data.method,
    userName: req.auth.email,
    userEmail: req.auth.email,
    card: parsed.data.card,
    cpfCnpj: parsed.data.cpfCnpj,
  });

  res.status(201).json({ payment });
});

// ─── Initiate pack payment ────────────────────────────────────────────────────

const initiatePackSchema = z.object({
  packId: z.string(),
  method: z.enum(["pix", "boleto", "bank_transfer", "credit_card", "manual"]),
  card: cardDataSchema.optional(),
  cpfCnpj: payerDocumentSchema.optional(),
}).refine(data => !["pix", "boleto"].includes(data.method) || Boolean(data.cpfCnpj), {
  message: "Informe o CPF/CNPJ para emitir PIX ou boleto", path: ["cpfCnpj"],
});

router.post("/packs/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = initiatePackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados de pagamento inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const payment = await initiatePackPayment({
    workspaceId: req.auth.workspaceId,
    userId: req.auth.userId,
    packId: parsed.data.packId,
    cpfCnpj: parsed.data.cpfCnpj,
    method: parsed.data.method,
    card: parsed.data.card,
    userName: req.auth.email,
    userEmail: req.auth.email,
  });

  res.status(201).json({ payment });
});

// ─── Manual confirmation ──────────────────────────────────────────────────────

router.post("/confirm/:paymentId", requireAuth, async (req, res): Promise<void> => {
  if (!checkBillingManualConfirmation(req, res)) return;
  const paymentId = req.params["paymentId"] as string;
  const note = (req.body as { note?: string }).note;
  const payment = await markPaymentPaid(req.auth.workspaceId, paymentId, note);
  res.json({ payment });
});

// ─── Asaas webhook (public) ───────────────────────────────────────────────────

router.post("/webhooks/asaas", async (req, res): Promise<void> => {
  // Keep explicit legacy billing configuration; only use the shared token
  // when the legacy variable is absent, never when it is explicitly empty.
  const configured = process.env["ASAAS_WEBHOOK_SECRET"] ?? process.env["ASAAS_WEBHOOK_TOKEN"];
  if (!matchesAsaasWebhookToken(req.headers["asaas-access-token"], configured)) {
    res.status(401).json({ error: "Invalid webhook token", code: "UNAUTHORIZED_WEBHOOK" });
    return;
  }
  await processAsaasWebhook(req.body);
  res.status(200).json({ received: true });
});

// ─── Bank transfer info ───────────────────────────────────────────────────────

router.get("/bank-transfer", requireAuth, async (_req, res): Promise<void> => {
  const info = {
    bank: process.env["BANK_NAME"] ?? null,
    agency: process.env["BANK_AGENCY"] ?? null,
    account: process.env["BANK_ACCOUNT"] ?? null,
    accountType: process.env["BANK_ACCOUNT_TYPE"] ?? null,
    cnpj: process.env["COMPANY_CNPJ"] ?? null,
    companyName: process.env["COMPANY_NAME"] ?? "NexOS AI",
    instructions: "Envie o comprovante para suporte@agencianexos.vip após a transferência.",
  };
  res.json({ bankTransfer: info });
});

// ─── Platform access check (logged-in user) ───────────────────────────────────
router.get("/access", requireAuth, async (req, res): Promise<void> => {
  if (await hasActivePlatformAdminSession(req.auth)) {
    res.json({ hasAccess: true, reason: "admin" });
    return;
  }

  // Legacy purchases retain their existing access semantics. Commercial offers
  // are checked against their explicit contract term below.
  const [paidPayment] = await db
    .select({ id: subscriptionPaymentsTable.id })
    .from(subscriptionPaymentsTable)
    .where(and(eq(subscriptionPaymentsTable.workspaceId, req.auth.workspaceId), eq(subscriptionPaymentsTable.status, "paid"), sql`${subscriptionPaymentsTable.metadata}->>'type' IS DISTINCT FROM 'sales_offer'`))
    .limit(1);
  if (paidPayment) { res.json({ hasAccess: true, reason: "paid" }); return; }

  const commercialContracts = await db.select({ offerSnapshot: commercialOfferContractsTable.offerSnapshot, status: commercialOfferContractsTable.status, currentPeriodEndsAt: commercialOfferContractsTable.currentPeriodEndsAt })
    .from(commercialOfferContractsTable)
    .where(and(
      eq(commercialOfferContractsTable.workspaceId, req.auth.workspaceId),
      inArray(commercialOfferContractsTable.status, ["active", "cancelled"]),
      or(isNull(commercialOfferContractsTable.currentPeriodEndsAt), gt(commercialOfferContractsTable.currentPeriodEndsAt, new Date())),
    ));
  const commercialAccess = commercialContracts.some(contract => {
    const offer = contract.offerSnapshot as { nexosAccessLifetime?: boolean; campaignsIncluded?: number; socialMediaDays?: number };
    const includesPlatformFeature = offer.nexosAccessLifetime === true || Number(offer.campaignsIncluded ?? 0) > 0 || Number(offer.socialMediaDays ?? 0) > 0;
    return includesPlatformFeature && (!contract.currentPeriodEndsAt || contract.currentPeriodEndsAt > new Date());
  });
  if (commercialAccess) { res.json({ hasAccess: true, reason: "commercial_offer" }); return; }

  // Invite code used at registration
  const [invite] = await db
    .select({ id: inviteCodesTable.id })
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.usedByWorkspaceId, req.auth.workspaceId))
    .limit(1);
  if (invite) { res.json({ hasAccess: true, reason: "invite_code" }); return; }

  // Plan assigned — workspace went through a legitimate registration or admin setup
  // (covers invite-code registrations where the invite row wasn't linked, and admin-created test users)
  const [ws] = await db
    .select({ planId: workspacesTable.planId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const [workspaceSettings] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  if ((workspaceSettings?.settings as { pendingSalesCheckout?: boolean } | null)?.pendingSalesCheckout) {
    res.json({ hasAccess: false, reason: "sales_checkout_pending" });
    return;
  }
  if (ws?.planId) { res.json({ hasAccess: true, reason: "plan_assigned" }); return; }

  res.json({ hasAccess: false, reason: "none" });
});

// ─── Admin: activate unlimited credits for founder/admin accounts ─────────────
router.post("/admin/unlimited-credits", requireAuth, requirePlatformAdmin, async (req, res): Promise<void> => {
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  if (!ws) { res.status(404).json({ error: "Workspace não encontrado." }); return; }

  const existing = (ws.settings ?? {}) as Record<string, unknown>;
  await db.update(workspacesTable)
    .set({ settings: { ...existing, unlimitedCredits: true } as any })
    .where(eq(workspacesTable.id, req.auth.workspaceId));

  res.json({ ok: true, unlimitedCredits: true });
});

// ─── Redeem invite code (logged-in user) ──────────────────────────────────────
router.post("/redeem-code", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "Informe o código." }); return; }

  const normalized = code.toUpperCase().trim();
  const result = await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(inviteCodesTable)
      .where(eq(inviteCodesTable.code, normalized)).for("update").limit(1);
    if (!invite) return { error: "Código não encontrado. Verifique e tente novamente.", status: 404 } as const;

    const [workspace] = await tx.select().from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId)).for("update").limit(1);
    if (!workspace) return { error: "Workspace não encontrado.", status: 404 } as const;

    if (invite.used) {
      // A Trial code may already have been consumed during signup by an older
      // server that did not persist nexosTrial. Repair only its own workspace,
      // and only when no trial marker exists; never re-enable an expired trial.
      if (invite.planSlug === "trial" && invite.usedByWorkspaceId === workspace.id) {
        const settings = workspace.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
          ? workspace.settings as Record<string, unknown>
          : {};
        if (trialFromSettings(settings)) return { trial: true as const };
        if (canRepairConsumedTrialAccess({
          inviteUsed: invite.used,
          invitePlanSlug: invite.planSlug,
          usedByWorkspaceId: invite.usedByWorkspaceId,
          workspaceId: workspace.id,
          settings,
        })) {
          await tx.update(workspacesTable)
            .set({ settings: activateTrialSettings(settings) })
            .where(eq(workspacesTable.id, workspace.id));
          return { trial: true as const };
        }
      }
      return { error: "Este código já foi utilizado.", status: 409 } as const;
    }

    if (invite.planSlug === "trial") {
      const settings = workspace.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
        ? workspace.settings as Record<string, unknown>
        : {};
      const trialMarker = settings.nexosTrial && typeof settings.nexosTrial === "object"
        ? settings.nexosTrial as Record<string, unknown>
        : {};
      if (typeof trialMarker.convertedAt === "string") {
        return { error: "O trial já foi convertido em uma licença e não pode ser reativado.", status: 409 } as const;
      }
      const activeSubscriptions = await tx.select({
        productKey: commercialProductsTable.key,
        capabilities: commercialProductsTable.capabilities,
      }).from(commercialSubscriptionsTable)
        .innerJoin(commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId))
        .where(and(
          eq(commercialSubscriptionsTable.workspaceId, workspace.id),
          eq(commercialSubscriptionsTable.status, "active"),
          eq(commercialProductsTable.status, "active"),
          or(isNull(commercialSubscriptionsTable.endsAt), gt(commercialSubscriptionsTable.endsAt, new Date())),
        ));
      const hasPlanAccess = activeSubscriptions.some(subscription => {
        if (["nexos_workspace_plan_access", "nexos_campaign_access"].includes(subscription.productKey)) return true;
        const capabilities = subscription.capabilities as Record<string, unknown> | null;
        const licensePlan = capabilities?.license_plan;
        return Boolean(licensePlan && typeof licensePlan === "object" && typeof (licensePlan as Record<string, unknown>).slug === "string");
      });
      if (hasPlanAccess) {
        return { error: "Este workspace já possui uma licença ativa; o trial não pode ser reativado.", status: 409 } as const;
      }
      if (trialFromSettings(workspace.settings)) {
        return { error: "Este workspace já possui um acesso Trial ativo.", status: 409 } as const;
      }
      await tx.update(workspacesTable)
        .set({ settings: activateTrialSettings(workspace.settings) })
        .where(eq(workspacesTable.id, workspace.id));
      await tx.update(inviteCodesTable).set({
        used: true,
        usedByEmail: req.auth.email,
        usedByUserId: req.auth.userId,
        usedByWorkspaceId: workspace.id,
        usedAt: new Date(),
      }).where(and(eq(inviteCodesTable.id, invite.id), eq(inviteCodesTable.used, false)));
      return { trial: true as const };
    }

    const [plan] = await tx.select().from(plansTable)
      .where(eq(plansTable.slug, invite.planSlug as "solo" | "agency")).limit(1);
    if (!plan) return { error: "Plano associado ao código não encontrado.", status: 500 } as const;

    await tx.update(workspacesTable).set({
      planId: plan.id,
      creditsMonthlyBalance: Math.max(workspace.creditsMonthlyBalance ?? 0, plan.creditsMonthly),
      creditsBalance: (workspace.creditsPurchasedBalance ?? 0) + Math.max(workspace.creditsMonthlyBalance ?? 0, plan.creditsMonthly),
    }).where(eq(workspacesTable.id, workspace.id));
    await activateWorkspacePlanAccess(tx, workspace.id, plan.slug, "invite_code");
    await tx.update(inviteCodesTable).set({
      used: true,
      usedByEmail: req.auth.email,
      usedByUserId: req.auth.userId,
      usedByWorkspaceId: workspace.id,
      usedAt: new Date(),
    }).where(and(eq(inviteCodesTable.id, invite.id), eq(inviteCodesTable.used, false)));
    return { trial: false as const, planName: plan.name, planSlug: plan.slug, creditsGranted: plan.creditsMonthly };
  });

  if ("error" in result) {
    res.status(result.status ?? 500).json({ error: result.error });
    return;
  }
  if (result.trial) {
    res.json({ ok: true, planName: "Trial", planSlug: "trial", creditsGranted: 0, trialAccess: true });
    return;
  }
  res.json({ ok: true, ...result });
});

export default router;
