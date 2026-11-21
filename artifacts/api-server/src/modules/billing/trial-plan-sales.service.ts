import { db, platformFeatureSettingsTable } from "@workspace/db";

import { eq } from "drizzle-orm";

import { getWorkspaceTrial } from "../auth/trial-access.service.js";

import { AppError } from "../../lib/errors.js";



import { isTrialSaleBlocked } from "./trial-plan-sales.policy.js";
export async function getTrialPlanSales() {

  const [settings] = await db.select().from(platformFeatureSettingsTable).where(eq(platformFeatureSettingsTable.id, 1)).limit(1);

  return { blockedPlans: settings?.trialBlockedPlans ?? [], blockedOffers: settings?.trialBlockedOffers ?? [] };

}

export async function assertTrialPlanSaleAllowed(workspaceId: string, kind: "plan" | "offer", id: string) {

  if (!await getWorkspaceTrial(workspaceId)) return;

  const settings = await getTrialPlanSales();

  if (isTrialSaleBlocked(true, kind === "plan" ? settings.blockedPlans : settings.blockedOffers, id)) {

    throw new AppError(403, "Esta oferta está temporariamente indisponível para o trial.", "TRIAL_PLAN_SALES_DISABLED");

  }

}

