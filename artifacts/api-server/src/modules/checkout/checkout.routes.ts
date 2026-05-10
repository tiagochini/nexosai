import { Router } from "express";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable, plansTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const router = Router();

const simulateSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.email(),
  password: z.string().min(6),
  plan: z.enum(["solo", "agency"]).default("solo"),
  // Test-mode payment fields — all optional, any value accepted
  testCard: z.object({
    number: z.string().optional(),
    expiry: z.string().optional(),
    cvv: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
});

function signAccess(payload: { userId: string; workspaceId: string; email: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefresh(payload: { userId: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

// POST /api/checkout/simulate
// Test-mode purchase: creates account + assigns plan + returns JWT.
// Any card data is accepted in test mode.
router.post("/simulate", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = simulateSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email e senha." });
    return;
  }

  const { name, email, password, plan } = parsed;

  // Fetch the target plan
  const [targetPlan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, plan))
    .limit(1);

  if (!targetPlan) {
    res.status(500).json({ error: "Plano não encontrado. Contate o suporte." });
    return;
  }

  // Check if user already exists
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  let userId: string;
  let workspaceId: string;

  if (existingUser) {
    // User already registered — upgrade their plan and log them in
    const [existingWorkspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, existingUser.id))
      .limit(1);

    if (!existingWorkspace) {
      res.status(500).json({ error: "Workspace não encontrado. Contate o suporte." });
      return;
    }

    // Upgrade plan + top up credits
    await db
      .update(workspacesTable)
      .set({
        planId: targetPlan.id,
        creditsBalance: targetPlan.creditsMonthly,
      })
      .where(eq(workspacesTable.id, existingWorkspace.id));

    userId = existingUser.id;
    workspaceId = existingWorkspace.id;
    logger.info({ userId, plan }, "checkout: existing user plan upgraded");
  } else {
    // New user — create account + workspace
    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        locale: "pt-BR",
      })
      .returning();

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const [newWorkspace] = await db
      .insert(workspacesTable)
      .values({
        ownerId: newUser.id,
        planId: targetPlan.id,
        name: `${name}'s Workspace`,
        slug,
        creditsBalance: targetPlan.creditsMonthly,
      })
      .returning();

    userId = newUser.id;
    workspaceId = newWorkspace.id;
    logger.info({ userId, workspaceId, plan }, "checkout: new user created");
  }

  const payload = { userId, workspaceId, email: email.toLowerCase() };

  res.json({
    success: true,
    plan: targetPlan.slug,
    planName: targetPlan.name,
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId }),
    expiresIn: 15 * 60,
    isNewUser: !existingUser,
  });
});

export default router;
