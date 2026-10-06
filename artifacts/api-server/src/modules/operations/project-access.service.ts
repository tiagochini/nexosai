import { and, eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { NotFoundError } from "../../lib/errors.js";

export async function requireProject(workspaceId: string, campaignId: string): Promise<void> {
  if (!workspaceId || !campaignId) throw new NotFoundError("Project");
  const [project] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.workspaceId, workspaceId), eq(campaignsTable.id, campaignId))).limit(1);
  if (!project) throw new NotFoundError("Project");
}
