import { hasActivePlatformAdminSession } from "../admin/admin.middleware.js";
import { Router } from "express";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { issueTokens, registerUser, loginUser, refreshTokens } from "./auth.service.js";
import { createOwnedWorkspace, getWorkspaceOverview } from "./workspaces.service.js";
import { requireAuth } from "./auth.middleware.js";
import { db, usersTable, workspacesTable, plansTable, inviteCodesTable, commercialSalesOffersTable, authRefreshSessionsTable } from "@workspace/db";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { clearRefreshCookie, readRefreshCookie, requireTrustedSessionOrigin, sendSessionTokens } from "./auth-session-cookie.js";
import { revokeRefreshSession } from "./refresh-session.service.js";

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  inviteCode: z.string().optional(),
  referralCode: z.string().optional(),
  offerKey: z.string().trim().min(1).max(120).optional(),
  salePlanSlug: z.enum(["solo", "agency"]).optional(),
  planSlug: z.enum(["solo", "agency"]).optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

// GET /api/auth/platform-status — public, tells the frontend if cart is open
router.get("/platform-status", (_req, res): void => {
  const platformOpen = process.env["PLATFORM_OPEN"] === "true";
  const cartOpen = process.env["CART_OPEN"] === "true";
  res.json({ platformOpen, cartOpen });
});

router.post("/register", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  // ── Platform access gate ───────────────────────────────────────────────────
  // When PLATFORM_OPEN is not "true", only users with a valid invite code can register.
  const platformOpen = process.env["PLATFORM_OPEN"] === "true";
  let validSalesOffer = false;
  let salesOfferPlanSlug: "solo" | "agency" | undefined;
  let validBasePlan: "solo" | "agency" | undefined;
  if (parsed.data.offerKey) {
    const [offer] = await db.select({ id: commercialSalesOffersTable.id, planSlug: commercialSalesOffersTable.planSlug })
      .from(commercialSalesOffersTable)
      .innerJoin(plansTable, eq(plansTable.slug, commercialSalesOffersTable.planSlug))
      .where(and(
        eq(commercialSalesOffersTable.key, parsed.data.offerKey),
        eq(commercialSalesOffersTable.active, true),
        eq(plansTable.active, true),
      )).limit(1);
    validSalesOffer = Boolean(offer);
    if (offer?.planSlug === "solo" || offer?.planSlug === "agency") salesOfferPlanSlug = offer.planSlug;
    if (!validSalesOffer) {
      res.status(404).json({ code: "OFFER_NOT_AVAILABLE", error: "Esta oferta não está mais disponível." });
      return;
    }
  }
  if (parsed.data.salePlanSlug) {
    const [plan] = await db.select({ slug: plansTable.slug }).from(plansTable)
      .where(and(eq(plansTable.slug, parsed.data.salePlanSlug), eq(plansTable.active, true))).limit(1);
    if (!plan) {
      res.status(404).json({ code: "PLAN_NOT_AVAILABLE", error: "Este plano não está disponível para contratação." });
      return;
    }
    validBasePlan = plan.slug;
  }
  let trialInvite = false;
  if (parsed.data.inviteCode) {
    const code = parsed.data.inviteCode.toUpperCase().trim();
    const [invite] = await db.select({ planSlug: inviteCodesTable.planSlug, used: inviteCodesTable.used })
      .from(inviteCodesTable).where(eq(inviteCodesTable.code, code)).limit(1);
    if (!invite || invite.used) {
      res.status(400).json({ error: "Código de convite inválido ou já utilizado.", code: "INVALID_INVITE_CODE" });
      return;
    }
    trialInvite = invite.planSlug === "trial";
  }
  if (trialInvite && (validSalesOffer || validBasePlan)) {
    res.status(400).json({ error: "Use o código trial sozinho; a licença comercial pode ser contratada depois.", code: "TRIAL_INVITE_CANNOT_COMBINE_PURCHASE" });
    return;
  }
  if (!platformOpen && !parsed.data.inviteCode && !validSalesOffer && !validBasePlan) {
    res.status(423).json({
      code: "PLATFORM_CLOSED",
      error: "A plataforma está em modo exclusivo. Você precisa de um código de convite para se cadastrar.",
    });
    return;
  }

  try {
    const tokens = await registerUser({
      ...parsed.data,
      ...((salesOfferPlanSlug || validBasePlan) ? {
        planSlug: salesOfferPlanSlug ?? validBasePlan!,
        initialCredits: 0,
        pendingSalesCheckout: true,
      } : {}),
      ...(trialInvite ? { initialCredits: 0, trialAccess: true } : {}),
    }, req.log);

    // Mark invite code as used after registration.
    // NOTE: invite codes are an ACCESS gate only — they do not change the
    // plan the user selected during registration (registerUser already set
    // planId/creditsBalance from parsed.data.planSlug). Previously this
    // block force-upgraded the workspace to invite.planSlug (defaulting to
    // "agency"), silently overriding the user's chosen Solo plan — that was
    // a bug, not intended behavior.
    if (parsed.data.inviteCode) {
      const code = parsed.data.inviteCode.toUpperCase().trim();
      const [invite] = await db
        .select()
        .from(inviteCodesTable)
        .where(eq(inviteCodesTable.code, code))
        .limit(1);

      if (invite && !invite.used) {
        const [user] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
          .limit(1);

        const [workspace] = await db
          .select()
          .from(workspacesTable)
          .where(eq(workspacesTable.ownerId, user!.id))
          .limit(1);

        if (workspace) {
          await db
            .update(inviteCodesTable)
            .set({
              used: true,
              usedByEmail: parsed.data.email.toLowerCase(),
              usedByUserId: user!.id,
              usedByWorkspaceId: workspace.id,
              usedAt: new Date(),
            })
            .where(and(eq(inviteCodesTable.code, code), eq(inviteCodesTable.used, false)));

          req.log.info({ workspaceId: workspace.id }, "Invite code marked used (access gate only, plan unaffected)");
        }
      }
    }

    res.status(201).json(sendSessionTokens(res, tokens));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/login", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const tokens = await loginUser(parsed.data, req.log);
    const previous = readRefreshCookie(req);
    if (previous) await revokeRefreshSession(previous);
    res.json(sendSessionTokens(res, tokens));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/change-password", requireTrustedSessionOrigin, requireAuth, async (req, res): Promise<void> => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const sessionId = req.auth.sessionId;
  if (!sessionId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId)) {
    res.status(401).json({ error: "A valid authenticated session is required", code: "UNAUTHORIZED" });
    return;
  }

  const [user] = await db.select({ passwordHash: usersTable.passwordHash })
    .from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect", code: "INVALID_CREDENTIALS" });
    return;
  }
  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    res.status(400).json({ error: "Choose a different password", code: "PASSWORD_UNCHANGED" });
    return;
  }

  const [session] = await db.select({ id: authRefreshSessionsTable.id })
    .from(authRefreshSessionsTable)
    .where(and(
      eq(authRefreshSessionsTable.id, sessionId),
      eq(authRefreshSessionsTable.userId, req.auth.userId),
      eq(authRefreshSessionsTable.workspaceId, req.auth.workspaceId),
      isNull(authRefreshSessionsTable.revokedAt),
      gt(authRefreshSessionsTable.expiresAt, new Date()),
    )).limit(1);
  if (!session) {
    res.status(401).json({ error: "An active authenticated session is required", code: "UNAUTHORIZED" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.auth.userId));
    await tx.update(authRefreshSessionsTable)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(authRefreshSessionsTable.userId, req.auth.userId),
        ne(authRefreshSessionsTable.id, sessionId),
        isNull(authRefreshSessionsTable.revokedAt),
      ));
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

router.post("/refresh", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  const token = readRefreshCookie(req);
  if (!token) {
    res.status(401).json({ error: "Refresh session cookie is required", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const tokens = await refreshTokens(token, req.log);
    res.json(sendSessionTokens(res, tokens));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/logout", requireTrustedSessionOrigin, async (req, res): Promise<void> => {
  const token = readRefreshCookie(req);
  if (token) await revokeRefreshSession(token);
  clearRefreshCookie(res);
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
});

// Owner-only workspace foundation. Membership is intentionally not modeled.
router.get("/workspaces", requireAuth, async (req, res): Promise<void> => {
  try {
    res.json(await getWorkspaceOverview(req.auth.userId, req.auth.workspaceId));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/workspaces", requireTrustedSessionOrigin, requireAuth, async (req, res): Promise<void> => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  try {
    const workspace = await createOwnedWorkspace(req.auth.userId, req.auth.workspaceId, parsed.data.name);
    const tokens = await issueTokens({ id: req.auth.userId, email: req.auth.email }, workspace.id);
    const previous = readRefreshCookie(req);
    if (previous) await revokeRefreshSession(previous);
    req.log.info({ userId: req.auth.userId, workspaceId: workspace.id }, "Owner workspace created");
    res.status(201).json({ workspace, ...sendSessionTokens(res, tokens) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/workspaces/:id/switch", requireTrustedSessionOrigin, requireAuth, async (req, res): Promise<void> => {
  try {
    const overview = await getWorkspaceOverview(req.auth.userId, req.params["id"] as string);
    const tokens = await issueTokens({ id: req.auth.userId, email: req.auth.email }, overview.activeWorkspaceId);
    const previous = readRefreshCookie(req);
    if (previous) await revokeRefreshSession(previous);
    req.log.info({ userId: req.auth.userId, workspaceId: overview.activeWorkspaceId }, "Owner workspace switched");
    res.json(sendSessionTokens(res, tokens));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

const updateProfileSchema = z.object({
  locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).optional(),
  name: z.string().min(2).optional(),
});

router.patch("/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const { locale, name } = parsed.data;
  if (!locale && !name) {
    res.status(400).json({ error: "Nenhum campo para atualizar", code: "VALIDATION_ERROR" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (locale) updates.locale = locale;
  if (name) updates.name = name;

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.auth.userId));
  res.json({ ok: true });
});


router.post("/onboarding/seen", requireAuth, async (req, res): Promise<void> => {
  await db.update(usersTable)
    .set({ hasSeenOnboarding: true })
    .where(eq(usersTable.id, req.auth.userId));
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      locale: usersTable.locale,
      emailVerified: usersTable.emailVerified,
      createdAt: usersTable.createdAt,
      hasSeenOnboarding: usersTable.hasSeenOnboarding,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.auth.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
    return;
  }

  const [workspace] = await db
    .select({
      id: workspacesTable.id,
      name: workspacesTable.name,
      slug: workspacesTable.slug,
      status: workspacesTable.status,
      creditsBalance: workspacesTable.creditsBalance,
      activeCampaigns: workspacesTable.activeCampaigns,
      brandName: workspacesTable.brandName,
      logoUrl: workspacesTable.logoUrl,
      planId: workspacesTable.planId,
    })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);

  // Founders always see Agency plan — fetch it by slug so all frontend plan gates pass.
  const isFounder = await hasActivePlatformAdminSession(req.auth);
  const plan = workspace
    ? await db
        .select()
        .from(plansTable)
        .where(isFounder ? eq(plansTable.slug, "agency") : eq(plansTable.id, workspace.planId))
        .limit(1)
    : [];

  res.setHeader("Cache-Control", "no-store");
  res.json({ user, workspace, plan: plan[0] ?? null, isPlatformAdmin: isFounder });
});

export default router;
