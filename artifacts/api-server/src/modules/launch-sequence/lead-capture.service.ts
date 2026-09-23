import { and, eq, or, sql } from "drizzle-orm";
import { db, auditLogsTable, sequenceContactsTable } from "@workspace/db";

export class LeadIdentityConflictError extends Error {
  code = "IDENTITY_CONFLICT" as const;
}
export function normalizeLeadEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
export function normalizeLeadPhone(value?: string | null): string | null {
  const normalized = value?.replace(/\D/g, "");
  return normalized || null;
}
export async function captureLead(input: {
  workspaceId: string; sequenceId: string; email?: string | null; phone?: string | null;
  name?: string | null; tags?: string[]; metadata?: Record<string, unknown>;
  audit: { actor: string; ipAddress?: string | null; data: Record<string, unknown> };
}): Promise<{ contactId: string; duplicate: boolean }> {
  const email = normalizeLeadEmail(input.email), phone = normalizeLeadPhone(input.phone);
  return db.transaction(async (tx) => {
    const identities = [email && `email:${email}`, phone && `phone:${phone}`].filter(Boolean).sort();
    for (const identity of identities) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId + ":" + identity}, 0))`);
    const matches = await tx.select({ id: sequenceContactsTable.id, email: sequenceContactsTable.email, phone: sequenceContactsTable.phone })
      .from(sequenceContactsTable).where(and(eq(sequenceContactsTable.workspaceId, input.workspaceId), eq(sequenceContactsTable.sequenceId, input.sequenceId),
        or(email ? eq(sequenceContactsTable.email, email) : sql`false`, phone ? eq(sequenceContactsTable.phone, phone) : sql`false`)));
    const ids = [...new Set(matches.map((row) => row.id))];
    if (ids.length > 1) throw new LeadIdentityConflictError("email and phone belong to different contacts");
    if (ids.length === 1) return { contactId: ids[0]!, duplicate: true };
    const [contact] = await tx.insert(sequenceContactsTable).values({
      sequenceId: input.sequenceId, workspaceId: input.workspaceId, name: input.name ?? null, email, phone,
      tags: input.tags ?? [], metadata: input.metadata ?? {},
    }).returning({ id: sequenceContactsTable.id });
    await tx.insert(auditLogsTable).values({ workspaceId: input.workspaceId, action: "lead.captured", actor: input.audit.actor, ipAddress: input.audit.ipAddress ?? undefined, data: { ...input.audit.data, sequenceId: input.sequenceId, contactId: contact.id } });
    return { contactId: contact.id, duplicate: false };
  });
}