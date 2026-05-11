import { eq, and, desc } from "drizzle-orm";
import {
  db,
  clientProfilesTable,
  type ClientProfile,
  type InsertClientProfile,
} from "@workspace/db";
import { NotFoundError } from "../../lib/errors.js";

export async function listClientProfiles(workspaceId: string): Promise<ClientProfile[]> {
  return db
    .select()
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.workspaceId, workspaceId))
    .orderBy(desc(clientProfilesTable.createdAt));
}

export async function getClientProfile(id: string, workspaceId: string): Promise<ClientProfile> {
  const [profile] = await db
    .select()
    .from(clientProfilesTable)
    .where(and(eq(clientProfilesTable.id, id), eq(clientProfilesTable.workspaceId, workspaceId)))
    .limit(1);
  if (!profile) throw new NotFoundError("Client profile not found");
  return profile;
}

export async function createClientProfile(
  workspaceId: string,
  data: Omit<InsertClientProfile, "workspaceId">
): Promise<ClientProfile> {
  const [created] = await db
    .insert(clientProfilesTable)
    .values({ ...data, workspaceId })
    .returning();
  return created!;
}

export async function updateClientProfile(
  id: string,
  workspaceId: string,
  data: Partial<Omit<InsertClientProfile, "workspaceId">>
): Promise<ClientProfile> {
  const [updated] = await db
    .update(clientProfilesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clientProfilesTable.id, id), eq(clientProfilesTable.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new NotFoundError("Client profile not found");
  return updated;
}

export async function deleteClientProfile(id: string, workspaceId: string): Promise<void> {
  const result = await db
    .delete(clientProfilesTable)
    .where(and(eq(clientProfilesTable.id, id), eq(clientProfilesTable.workspaceId, workspaceId)))
    .returning({ id: clientProfilesTable.id });
  if (!result.length) throw new NotFoundError("Client profile not found");
}
