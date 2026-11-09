import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, commercialProductsTable, commercialSubscriptionsTable, workspacesTable } from "@workspace/db";
import { ADMIN_CAMPAIGN_ACCESS_PRODUCT_KEY, WORKSPACE_PLAN_ACCESS_PRODUCT_KEY } from "../billing/commercial-access.constants.js";

export type TrialSocialStatus = "available" | "reserved" | "used";

export interface NexosTrialAccess {
  active: true;
  briefingCampaignId: string | null;
  socialAnalysisStatus: TrialSocialStatus;
}

type WorkspaceSettings = Record<string, unknown> & {
  nexosTrial?: {
    active?: boolean;
    briefingCampaignId?: string | null;
    socialAnalysisStatus?: TrialSocialStatus;
    [key: string]: unknown;
  };
};

/** Activates the limited trial without changing the workspace plan or balances. */
export function activateTrialSettings(value: unknown): WorkspaceSettings {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? value as WorkspaceSettings
    : {};
  return {
    ...settings,
    nexosTrial: {
      active: true,
      briefingCampaignId: null,
      socialAnalysisStatus: "available",
    },
  };
}

/** Preserve trial provenance while marking its access as converted to a plan. */
export function deactivateTrialSettings(value: unknown, reason: string): WorkspaceSettings {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? value as WorkspaceSettings
    : {};
  const trial = settings.nexosTrial;
  if (!trial || typeof trial !== "object") return { ...settings, pendingSalesCheckout: false };
  return {
    ...settings,
    pendingSalesCheckout: false,
    nexosTrial: {
      ...trial,
      active: false,
      convertedAt: new Date().toISOString(),
      conversionReason: reason,
    },
  };
}

export function canRepairConsumedTrialAccess(input: {
  inviteUsed: boolean;
  invitePlanSlug: string;
  usedByWorkspaceId: string | null;
  workspaceId: string;
  settings: unknown;
}): boolean {
  if (!input.inviteUsed || input.invitePlanSlug !== "trial" || input.usedByWorkspaceId !== input.workspaceId) return false;
  const settings = input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
    ? input.settings as Record<string, unknown>
    : {};
  return !Object.hasOwn(settings, "nexosTrial");
}

export function trialFromSettings(value: unknown): NexosTrialAccess | null {
  if (!value || typeof value !== "object") return null;
  const settings = value as WorkspaceSettings;
  const trial = settings.nexosTrial;
  if (trial?.active !== true) return null;
  const status = trial.socialAnalysisStatus;
  return {
    active: true,
    briefingCampaignId: typeof trial.briefingCampaignId === "string" ? trial.briefingCampaignId : null,
    socialAnalysisStatus: status === "reserved" || status === "used" ? status : "available",
  };
}

export async function getWorkspaceTrial(workspaceId: string): Promise<NexosTrialAccess | null> {
  const [workspace] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const trial = trialFromSettings(workspace?.settings);
  if (!trial) return null;

  // A plan or permanent campaign subscription always supersedes a stale trial
  // marker. This also repairs access for workspaces converted before the marker
  // was explicitly deactivated.
  const subscriptions = await db.select({
    productKey: commercialProductsTable.key,
    capabilities: commercialProductsTable.capabilities,
  }).from(commercialSubscriptionsTable)
    .innerJoin(commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId))
    .where(and(
      eq(commercialSubscriptionsTable.workspaceId, workspaceId),
      eq(commercialSubscriptionsTable.status, "active"),
      eq(commercialProductsTable.status, "active"),
      or(isNull(commercialSubscriptionsTable.endsAt), gt(commercialSubscriptionsTable.endsAt, new Date())),
    ));
  const hasPlanAccess = subscriptions.some(subscription => {
    if (subscription.productKey === WORKSPACE_PLAN_ACCESS_PRODUCT_KEY || subscription.productKey === ADMIN_CAMPAIGN_ACCESS_PRODUCT_KEY) return true;
    const capabilities = subscription.capabilities as Record<string, unknown> | null;
    const licensePlan = capabilities?.license_plan;
    return Boolean(licensePlan && typeof licensePlan === "object" && typeof (licensePlan as Record<string, unknown>).slug === "string");
  });
  return hasPlanAccess ? null : trial;
}

/** Reserve the single social analysis under a workspace row lock to prevent concurrent duplicate use. */
export async function reserveTrialSocialAnalysis(workspaceId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx.select().from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId)).for("update").limit(1);
    const trial = trialFromSettings(workspace?.settings);
    if (!workspace || !trial || trial.socialAnalysisStatus !== "available") return false;
    const settings = (workspace.settings ?? {}) as WorkspaceSettings;
    await tx.update(workspacesTable).set({
      settings: { ...settings, nexosTrial: { ...trial, socialAnalysisStatus: "reserved" } },
    }).where(eq(workspacesTable.id, workspaceId));
    return true;
  });
}

export async function finishTrialSocialAnalysis(workspaceId: string, status: "available" | "used"): Promise<void> {
  await db.transaction(async (tx) => {
    const [workspace] = await tx.select().from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId)).for("update").limit(1);
    const trial = trialFromSettings(workspace?.settings);
    if (!workspace || !trial) return;
    const settings = (workspace.settings ?? {}) as WorkspaceSettings;
    await tx.update(workspacesTable).set({
      settings: { ...settings, nexosTrial: { ...trial, socialAnalysisStatus: status } },
    }).where(eq(workspacesTable.id, workspaceId));
  });
}
