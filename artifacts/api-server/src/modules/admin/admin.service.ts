import { eq, count, inArray, sql } from "drizzle-orm";
import {
  db,
  workspacesTable,
  usersTable,
  plansTable,
  campaignsTable,
} from "@workspace/db";

export type SaasUserStatus =
  | "novo"
  | "ativo_lancando"
  | "ativo"
  | "pausado"
  | "hibernado";

export interface SaasUserRow {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  email: string;
  planName: string;
  planSlug: string;
  workspaceStatus: string;
  saasStatus: SaasUserStatus;
  totalCampaigns: number;
  hasActiveLaunch: boolean;
  creditsBalance: number;
  createdAt: string;
  daysSinceCreation: number;
}

export interface AdminOverview {
  total: number;
  byStatus: Record<SaasUserStatus, number>;
  users: SaasUserRow[];
}

function computeSaasStatus(
  workspaceStatus: string,
  totalCampaigns: number,
  hasActiveLaunch: boolean,
  daysSinceCreation: number
): SaasUserStatus {
  if (workspaceStatus === "suspended") return "pausado";
  if (hasActiveLaunch) return "ativo_lancando";
  if (totalCampaigns === 0 && daysSinceCreation <= 14) return "novo";
  if (totalCampaigns === 0 && daysSinceCreation > 14) return "hibernado";
  return "ativo";
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const workspaces = await db
    .select({
      workspaceId: workspacesTable.id,
      workspaceName: workspacesTable.name,
      workspaceStatus: workspacesTable.status,
      creditsBalance: workspacesTable.creditsBalance,
      createdAt: workspacesTable.createdAt,
      userId: usersTable.id,
      userName: usersTable.name,
      email: usersTable.email,
      planName: plansTable.name,
      planSlug: plansTable.slug,
    })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .innerJoin(plansTable, eq(workspacesTable.planId, plansTable.id))
    .orderBy(workspacesTable.createdAt);

  if (workspaces.length === 0) {
    return { total: 0, byStatus: { novo: 0, ativo_lancando: 0, ativo: 0, pausado: 0, hibernado: 0 }, users: [] };
  }

  const workspaceIds = workspaces.map((w) => w.workspaceId);

  const campaignCounts = await db
    .select({
      workspaceId: campaignsTable.workspaceId,
      total: count(),
    })
    .from(campaignsTable)
    .where(inArray(campaignsTable.workspaceId, workspaceIds))
    .groupBy(campaignsTable.workspaceId);

  const activeLaunches = await db
    .select({ workspaceId: campaignsTable.workspaceId })
    .from(campaignsTable)
    .where(
      sql`${campaignsTable.workspaceId} = ANY(${sql.raw(`ARRAY[${workspaceIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)}) AND ${campaignsTable.status} IN ('executing','live')`
    );

  const countMap = new Map(campaignCounts.map((r) => [r.workspaceId, r.total]));
  const activeLaunchSet = new Set(activeLaunches.map((r) => r.workspaceId));

  const now = Date.now();

  const byStatus: Record<SaasUserStatus, number> = {
    novo: 0,
    ativo_lancando: 0,
    ativo: 0,
    pausado: 0,
    hibernado: 0,
  };

  const users: SaasUserRow[] = workspaces.map((w) => {
    const totalCampaigns = countMap.get(w.workspaceId) ?? 0;
    const hasActiveLaunch = activeLaunchSet.has(w.workspaceId);
    const daysSinceCreation = Math.floor(
      (now - new Date(w.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const saasStatus = computeSaasStatus(
      w.workspaceStatus,
      totalCampaigns,
      hasActiveLaunch,
      daysSinceCreation
    );
    byStatus[saasStatus]++;
    return {
      workspaceId: w.workspaceId,
      workspaceName: w.workspaceName,
      userId: w.userId,
      userName: w.userName,
      email: w.email,
      planName: w.planName,
      planSlug: w.planSlug,
      workspaceStatus: w.workspaceStatus,
      saasStatus,
      totalCampaigns,
      hasActiveLaunch,
      creditsBalance: w.creditsBalance,
      createdAt: w.createdAt.toISOString(),
      daysSinceCreation,
    };
  });

  return { total: workspaces.length, byStatus, users };
}
