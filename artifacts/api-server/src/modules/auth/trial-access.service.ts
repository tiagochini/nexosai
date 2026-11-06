import { eq } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";

export type TrialSocialStatus = "available" | "reserved" | "used";

export interface NexosTrialAccess {
  active: true;
  briefingCampaignId: string | null;
  socialAnalysisStatus: TrialSocialStatus;
}

type WorkspaceSettings = Record<string, unknown> & {
  nexosTrial?: Partial<NexosTrialAccess>;
};

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
  return trialFromSettings(workspace?.settings);
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
