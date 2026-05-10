import { Router } from "express";
import { z } from "zod/v4";
import { registerUser, loginUser, refreshTokens } from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";
import { db, usersTable, workspacesTable, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  locale: z.enum(["pt-BR", "en-US", "es-LA"]).default("pt-BR"),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

router.post("/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const tokens = await registerUser(parsed.data, req.log);
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

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      locale: usersTable.locale,
      emailVerified: usersTable.emailVerified,
      createdAt: usersTable.createdAt,
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

  const plan = workspace
    ? await db
        .select()
        .from(plansTable)
        .where(eq(plansTable.id, workspace.planId))
        .limit(1)
    : [];

  res.json({ user, workspace, plan: plan[0] ?? null });
});

export default router;
