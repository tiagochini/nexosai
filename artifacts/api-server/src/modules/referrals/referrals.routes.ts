import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, workspacesTable, creditTransactionsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

// GET /api/referrals/stats — returns referral code, count, credits earned, tier
router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;

  const [workspace] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const settings = (workspace?.settings as Record<string, unknown>) ?? {};
  const referralCode = (settings.referralCode as string) ?? null;
  const referralCount = typeof settings.referralCount === "number" ? settings.referralCount : 0;

  // Sum credits earned from referral bonuses
  const bonusTxs = await db
    .select({ amount: creditTransactionsTable.amount })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.workspaceId, workspaceId),
        sql`${creditTransactionsTable.action} = 'referral_bonus'`,
      ),
    );

  const totalCreditsEarned = bonusTxs.reduce((sum, tx) => sum + tx.amount, 0);

  // Tier thresholds
  const tiers = [
    { min: 0,  max: 0,  label: "Sem indicações",          reward: null },
    { min: 1,  max: 2,  label: "Prioridade na fila",       reward: "priority" },
    { min: 3,  max: 4,  label: "Acesso antecipado",        reward: "early_access" },
    { min: 5,  max: 9,  label: "10% de desconto + acesso", reward: "discount_10" },
    { min: 10, max: 99, label: "20% de desconto + acesso", reward: "discount_20" },
  ];

  const currentTier = [...tiers].reverse().find((t) => referralCount >= t.min) ?? tiers[0];
  const nextTier = tiers.find((t) => t.min > referralCount) ?? null;

  res.json({
    referralCode,
    referralCount,
    totalCreditsEarned,
    currentTier,
    nextTier,
    bonusPerReferral: 50,
  });
});

export default router;
