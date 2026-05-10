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
// Test-mode purchase — creates or logs in account, ignores email verification,
// payment data is fully simulated. Returns JWT for immediate access.
router.post("/simulate", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = simulateSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email e senha." });
    return;
  }

  const { name, email, password, creditPackCredits } = parsed;

  // Always use the "solo" plan as the base access tier (DB constraint)
  const [basePlan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, "solo"))
    .limit(1);

  if (!basePlan) {
    res.status(500).json({ error: "Plano base não encontrado. Execute o seed de planos." });
    return;
  }

  // Starting credits: plan base + optional pack credits (no expiry, cumulative)
  const startingCredits = basePlan.creditsMonthly + (creditPackCredits ?? 0);

  // Check if user already exists — test mode: no blocking, just log them in
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  let userId: string;
  let workspaceId: string;

  if (existingUser) {
    // Already registered — locate or create workspace, top up credits
    let [existingWorkspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, existingUser.id))
      .limit(1);

    if (!existingWorkspace) {
      // Workspace missing (edge case) — create one
      const slug = `${existingUser.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "user"}-${Date.now()}`;
      [existingWorkspace] = await db
        .insert(workspacesTable)
        .values({
          ownerId: existingUser.id,
          planId: basePlan.id,
          name: `${existingUser.name ?? email}'s Workspace`,
          slug,
          creditsBalance: startingCredits,
        })
        .returning();
    } else {
      // Top up credits
      await db
        .update(workspacesTable)
        .set({ creditsBalance: existingWorkspace.creditsBalance + (creditPackCredits ?? 0) })
        .where(eq(workspacesTable.id, existingWorkspace.id));
    }

    userId = existingUser.id;
    workspaceId = existingWorkspace.id;
    logger.info({ userId, creditPackCredits }, "checkout: existing user re-access");
  } else {
    // New user — create account + workspace
    const passwordHash = await bcrypt.hash(password, 10);

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
        planId: basePlan.id,
        name: `${name}'s Workspace`,
        slug,
        creditsBalance: startingCredits,
      })
      .returning();

    userId = newUser.id;
    workspaceId = newWorkspace.id;
    logger.info({ userId, workspaceId, startingCredits }, "checkout: new user created");
  }

  const payload = { userId, workspaceId, email: email.toLowerCase() };

  res.json({
    success: true,
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId }),
    expiresIn: 15 * 60,
    isNewUser: !existingUser,
    startingCredits,
  });
});

export default router;
