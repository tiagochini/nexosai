import { desc, eq, inArray } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { integrationPurpose } from "./integration-purpose.js";

/**
 * Removes only abandoned OAuth rows that describe the same logical integration.
 *
 * Connected credentials are deliberately never removed at boot: even an apparent
 * duplicate can have dependent history or be in use by an in-flight reconnect.
 */
export async function cleanupDisconnectedIntegrationDuplicates(): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      id: workspaceIntegrationsTable.id,
      workspaceId: workspaceIntegrationsTable.workspaceId,
      provider: workspaceIntegrationsTable.provider,
      accountId: workspaceIntegrationsTable.accountId,
      metadata: workspaceIntegrationsTable.metadata,
      createdAt: workspaceIntegrationsTable.createdAt,
    })
      .from(workspaceIntegrationsTable)
      .where(eq(workspaceIntegrationsTable.status, "disconnected"))
      .orderBy(desc(workspaceIntegrationsTable.createdAt), desc(workspaceIntegrationsTable.id));

    const retained = new Set<string>();
    const duplicateIds: string[] = [];
    for (const row of rows) {
      // accountId is part of the identity, including NULL as a distinct,
      // null-safe value. Purpose must be classified by the canonical helper:
      // legacy Meta Page rows are organic, not paid media.
      const key = JSON.stringify([
        row.workspaceId,
        row.provider,
        row.accountId,
        integrationPurpose(row.metadata as Record<string, unknown> | null),
      ]);
      if (retained.has(key)) duplicateIds.push(row.id);
      else retained.add(key);
    }

    if (!duplicateIds.length) return 0;
    const result = await tx.delete(workspaceIntegrationsTable)
      .where(inArray(workspaceIntegrationsTable.id, duplicateIds));
    return result.rowCount ?? 0;
  });
}