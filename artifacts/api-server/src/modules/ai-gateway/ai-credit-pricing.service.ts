import { db, aiCreditSettingsTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { eq } from "drizzle-orm";

const CACHE_TTL_MS = 15_000;
let cachedMultiplier = env.CREDIT_MARGIN_MULTIPLIER;
let cacheExpiresAt = 0;

export async function getAiCreditMarginMultiplier(): Promise<number> {
  if (Date.now() < cacheExpiresAt) return cachedMultiplier;
  try {
    const [settings] = await db.select({ marginMultiplier: aiCreditSettingsTable.marginMultiplier })
      .from(aiCreditSettingsTable).where(eq(aiCreditSettingsTable.id, 1)).limit(1);
    if (settings) cachedMultiplier = Number(settings.marginMultiplier);
  } catch {
    // During a rolling deployment, continue charging with the documented env fallback.
  }
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedMultiplier;
}

export async function setAiCreditMarginMultiplier(multiplier: number, actorUserId: string) {
  const [settings] = await db.insert(aiCreditSettingsTable).values({
    id: 1,
    marginMultiplier: multiplier.toFixed(4),
    updatedBy: actorUserId,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: aiCreditSettingsTable.id,
    set: { marginMultiplier: multiplier.toFixed(4), updatedBy: actorUserId, updatedAt: new Date() },
  }).returning();
  cachedMultiplier = Number(settings!.marginMultiplier);
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return settings!;
}
