import { and, eq, sql } from "drizzle-orm";
import { db, academyFunnelEmailsTable as emails } from "@workspace/db";

// No provider calls and no personal data. PostgreSQL enforces read-only access.
export async function inspectFunnelDelivery(leadId?: string) {
  return db.transaction(async (tx) => {
    const scope = leadId ? eq(emails.leadId, leadId) : undefined;
    const counts = await tx.select({
      status: emails.status,
      count: sql<number>`count(*)::int`,
    }).from(emails).where(scope).groupBy(emails.status).orderBy(emails.status);
    const [legacy] = await tx.select({ count: sql<number>`count(*)::int` }).from(emails)
      .where(and(scope, eq(emails.resendId, "dev-no-provider")));
    const [unconfigured] = await tx.select({ count: sql<number>`count(*)::int` }).from(emails)
      .where(and(scope, eq(emails.status, "scheduled"), eq(emails.errorMessage, "EMAIL_PROVIDER_NOT_CONFIGURED")));
    const duplicateGroups = await tx.select({
      leadId: emails.leadId, step: emails.step, count: sql<number>`count(*)::int`,
    }).from(emails).where(scope).groupBy(emails.leadId, emails.step)
      .having(sql`count(*) > 1`).orderBy(emails.leadId, emails.step).limit(100);
    const reviewRows = await tx.select({
      id: emails.id, leadId: emails.leadId, step: emails.step, status: emails.status,
      scheduledAt: emails.scheduledAt,
    }).from(emails).where(and(scope, sql`${emails.status} in ('sending', 'failed')`))
      .orderBy(emails.scheduledAt, emails.id).limit(100);
    const reviewCount = counts.filter((row) => row.status === "sending" || row.status === "failed")
      .reduce((sum, row) => sum + row.count, 0);
    return {
      counts, legacyFalseSuccessCount: legacy!.count,
      unconfiguredPendingCount: unconfigured!.count,
      duplicateGroups, duplicateGroupsMayBeTruncated: duplicateGroups.length === 100,
      reviewCount, reviewRows, reviewRowsTruncated: reviewCount > reviewRows.length,
      requiresReview: reviewCount > 0 || legacy!.count > 0 || unconfigured!.count > 0 || duplicateGroups.length > 0,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
