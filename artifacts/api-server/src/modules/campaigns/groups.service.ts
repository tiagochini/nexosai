import { eq, and, desc } from "drizzle-orm";
import { db, campaignGroupsTable, campaignsTable } from "@workspace/db";
import type { CampaignGroup, InsertCampaignGroup, GroupPlatform } from "@workspace/db";
import { NotFoundError, AppError } from "../../lib/errors.js";

export async function listCampaignGroups(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignGroup[]> {
  return db
    .select()
    .from(campaignGroupsTable)
    .where(
      and(
        eq(campaignGroupsTable.campaignId, campaignId),
        eq(campaignGroupsTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(campaignGroupsTable.createdAt));
}

export async function createCampaignGroup(
  campaignId: string,
  workspaceId: string,
  data: {
    platform: GroupPlatform;
    groupName: string;
    groupLink?: string;
    groupId?: string;
    description?: string;
    segment?: string;
    memberCount?: number;
  },
): Promise<CampaignGroup> {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campanha");

  const [group] = await db
    .insert(campaignGroupsTable)
    .values({
      campaignId,
      workspaceId,
      platform: data.platform,
      groupName: data.groupName,
      groupLink: data.groupLink ?? null,
      groupId: data.groupId ?? null,
      description: data.description ?? null,
      segment: data.segment ?? null,
      memberCount: data.memberCount ?? 0,
    })
    .returning();

  return group;
}

export async function updateCampaignGroup(
  groupId: string,
  workspaceId: string,
  data: Partial<{
    groupName: string;
    groupLink: string;
    description: string;
    segment: string;
    memberCount: number;
    status: "active" | "inactive" | "archived" | "capability_blocked" | "sync_failed";
  }>,
): Promise<CampaignGroup> {
  const [updated] = await db
    .update(campaignGroupsTable)
    .set(data)
    .where(
      and(
        eq(campaignGroupsTable.id, groupId),
        eq(campaignGroupsTable.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Grupo");
  return updated;
}

export async function deleteCampaignGroup(
  groupId: string,
  workspaceId: string,
): Promise<void> {
  const result = await db
    .delete(campaignGroupsTable)
    .where(
      and(
        eq(campaignGroupsTable.id, groupId),
        eq(campaignGroupsTable.workspaceId, workspaceId),
      ),
    )
    .returning({ id: campaignGroupsTable.id });

  if (!result.length) throw new NotFoundError("Grupo");
}
