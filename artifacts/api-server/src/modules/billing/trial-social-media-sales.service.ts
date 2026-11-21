import { db, platformFeatureSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

/** Fails closed: Social Media sales remain hidden for trial users until an admin enables them. */
export async function isTrialSocialMediaSalesEnabled(): Promise<boolean> {
  try {
    const [settings] = await db.select({ enabled: platformFeatureSettingsTable.trialSocialMediaSalesEnabled })
      .from(platformFeatureSettingsTable)
      .where(eq(platformFeatureSettingsTable.id, 1))
      .limit(1);
    return settings?.enabled ?? false;
  } catch (error) {
    logger.error({ err: error }, "Could not read the trial Social Media sales switch; keeping sales disabled");
    return false;
  }
}
