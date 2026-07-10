import { Router } from "express";
import { z } from "zod/v4";
import { registerUser, loginUser, refreshTokens } from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";
import { db, usersTable, workspacesTable, plansTable, inviteCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  inviteCode: z.string().optional(),
  referralCode: z.string().optional(),
  planSlug: z.enum(["solo", "agency"]).optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// GET /api/auth/platform-status — public, tells the frontend if cart is open
router.get("/platform-status", (_req, res): void => {
  const platformOpen = process.env["PLATFORM_OPEN"] === "true";
  const cartOpen = process.env["CART_OPEN"] === "true";
  res.json({ platformOpen, cartOpen });
});

router.post("/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  // ── Platform access gate ───────────────────────────────────────────────────
  // When PLATFORM_OPEN is not "true", only users with a valid invite code can register.
  const platformOpen = process.env["PLATFORM_OPEN"] === "true";
  if (!platformOpen && !parsed.data.inviteCode) {
    res.status(423).json({
      code: "PLATFORM_CLOSED",
      error: "A plataforma está em modo exclusivo. Você precisa de um código de convite para se cadastrar.",
    });
    return;
  }

  try {
    const tokens = await registerUser(parsed.data, req.log);

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
            .where(eq(inviteCodesTable.code, code));

          req.log.info({ code, email: parsed.data.email }, "Invite code marked used (access gate only, plan unaffected)");
        }
      }
    }

    res.status(201).json(tokens);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const tokens = await loginUser(parsed.data, req.log);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/refresh", async (req, res): Promise<void> => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "refreshToken is required", code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const tokens = await refreshTokens(parsed.data.refreshToken, req.log);
    res.json(tokens);
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

// Founder/admin accounts always receive Agency-level plan data regardless of DB plan.
const FOUNDER_EMAILS_ME = new Set([
  "founder@nexos.ai",
  "founder@agencianexos.vip",
  "admin@nexos.ai",
  "admin@agencianexos.vip",
]);

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
  const isFounder = FOUNDER_EMAILS_ME.has(user.email);
  const plan = workspace
    ? await db
        .select()
        .from(plansTable)
        .where(isFounder ? eq(plansTable.slug, "agency") : eq(plansTable.id, workspace.planId))
        .limit(1)
    : [];

  res.json({ user, workspace, plan: plan[0] ?? null });
});

export default router;
