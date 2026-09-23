import { and, desc, eq, sql } from "drizzle-orm";
import {
  buyerOnboardingInstancesTable, cartRecoveryActionsTable, db,
  lifecycleContactsTable, lifecycleEventsTable, purchaserReferralAttributionsTable,
  referralRewardsTable, retentionActionsTable, upsellActionsTable,
} from "@workspace/db";

export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_OFFSET = 10_000;
export function parsePage(value: unknown, fallback: number, maximum = MAX_PAGE_OFFSET): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}
export function page(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
export function boundedLimit(value: unknown): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, page(value, 25)));
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export function toLifecycleContactDto(contact: {
  id: string; email: string | null; stage: string; churnRisk: number; lastActivityAt: Date | null;
}) {
  return {
    id: contact.id,
    displayLabel: `Contact •${contact.id.slice(-6)}`,
    email: maskEmail(contact.email),
    stage: contact.stage,
    churnRisk: contact.churnRisk,
    lastActivityAt: contact.lastActivityAt,
  };
}

/** Read-only projections for the lifecycle control plane. Deliberately excludes identity fields. */
export async function getLifecycleOverview(workspaceId: string) {
  const [stages, recovery, onboarding, retention, upsell, referrals, rewards, ltv] = await Promise.all([
    db.select({ stage: lifecycleContactsTable.stage, count: sql<number>`count(*)::int` }).from(lifecycleContactsTable)
      .where(eq(lifecycleContactsTable.workspaceId, workspaceId)).groupBy(lifecycleContactsTable.stage),
    db.select({ status: cartRecoveryActionsTable.status, count: sql<number>`count(*)::int` }).from(cartRecoveryActionsTable)
      .where(eq(cartRecoveryActionsTable.workspaceId, workspaceId)).groupBy(cartRecoveryActionsTable.status),
    db.select({ status: buyerOnboardingInstancesTable.status, count: sql<number>`count(*)::int` }).from(buyerOnboardingInstancesTable)
      .where(eq(buyerOnboardingInstancesTable.workspaceId, workspaceId)).groupBy(buyerOnboardingInstancesTable.status),
    db.select({ status: retentionActionsTable.status, count: sql<number>`count(*)::int` }).from(retentionActionsTable)
      .where(eq(retentionActionsTable.workspaceId, workspaceId)).groupBy(retentionActionsTable.status),
    db.select({ status: upsellActionsTable.status, count: sql<number>`count(*)::int` }).from(upsellActionsTable)
      .where(eq(upsellActionsTable.workspaceId, workspaceId)).groupBy(upsellActionsTable.status),
    db.select({ count: sql<number>`count(*)::int` }).from(purchaserReferralAttributionsTable).where(eq(purchaserReferralAttributionsTable.workspaceId, workspaceId)),
    db.select({ status: referralRewardsTable.status, count: sql<number>`count(*)::int`, amountCents: sql<number>`coalesce(sum(${referralRewardsTable.amountCents}), 0)::int` }).from(referralRewardsTable)
      .where(eq(referralRewardsTable.workspaceId, workspaceId)).groupBy(referralRewardsTable.status),
    db.select({ contacts: sql<number>`count(*)::int`, lifetimeValueCents: sql<number>`coalesce(sum(${lifecycleContactsTable.lifetimeValueCents}), 0)::int` }).from(lifecycleContactsTable)
      .where(eq(lifecycleContactsTable.workspaceId, workspaceId)),
  ]);
  const byStatus = (rows: Array<{ status: string; count: number }>) => Object.fromEntries(rows.map((r) => [r.status, r.count]));
  return {
    contactStages: Object.fromEntries(stages.map((r) => [r.stage, r.count])),
    actions: { recovery: byStatus(recovery), onboarding: byStatus(onboarding), retention: byStatus(retention), upsell: byStatus(upsell) },
    referrals: { attributions: referrals[0]?.count ?? 0, rewards: rewards.map((r) => ({ status: r.status, count: r.count, amountCents: r.amountCents })) },
    ltv: { contacts: ltv[0]?.contacts ?? 0, recordedLifetimeValueCents: ltv[0]?.lifetimeValueCents ?? 0, attribution: "recorded_local_ledger_not_externally_attributed_kpi" },
  };
}

export async function listLifecycleActions(workspaceId: string, status?: string, type?: string, limit = 25, offset = 0) {
  const rows: Array<Record<string, unknown>> = [];
  const window = Math.min(MAX_PAGE_SIZE + MAX_PAGE_OFFSET, offset + limit);
  const statusCondition = status ? sql`status = ${status}` : sql`TRUE`;
  const include = !type || type;
  const counts: Promise<Array<{ count: number }>>[] = [];
  if (include === "recovery" || include === true) {
    const where = and(eq(cartRecoveryActionsTable.workspaceId, workspaceId), statusCondition); counts.push(db.select({ count: sql<number>`count(*)::int` }).from(cartRecoveryActionsTable).where(where));
    const result = await db.select().from(cartRecoveryActionsTable).where(where).orderBy(desc(cartRecoveryActionsTable.createdAt), desc(cartRecoveryActionsTable.id)).limit(window);
    rows.push(...result.map((r) => ({ id: r.id, type: "recovery", status: r.status, channel: r.channel, reason: r.reason, createdAt: r.createdAt, completedAt: r.completedAt })));
  }
  if (include === "onboarding" || include === true) {
    const where = and(eq(buyerOnboardingInstancesTable.workspaceId, workspaceId), statusCondition); counts.push(db.select({ count: sql<number>`count(*)::int` }).from(buyerOnboardingInstancesTable).where(where));
    const result = await db.select().from(buyerOnboardingInstancesTable).where(where).orderBy(desc(buyerOnboardingInstancesTable.createdAt), desc(buyerOnboardingInstancesTable.id)).limit(window);
    rows.push(...result.map((r) => ({ id: r.id, type: "onboarding", status: r.status, createdAt: r.createdAt, completedAt: r.activatedAt })));
  }
  if (include === "retention" || include === true) {
    const where = and(eq(retentionActionsTable.workspaceId, workspaceId), statusCondition); counts.push(db.select({ count: sql<number>`count(*)::int` }).from(retentionActionsTable).where(where));
    const result = await db.select().from(retentionActionsTable).where(where).orderBy(desc(retentionActionsTable.createdAt), desc(retentionActionsTable.id)).limit(window);
    rows.push(...result.map((r) => ({ id: r.id, type: "retention", status: r.status, reason: r.reason, riskScore: r.riskScore, createdAt: r.createdAt, completedAt: r.completedAt })));
  }
  if (include === "upsell" || include === true) {
    const where = and(eq(upsellActionsTable.workspaceId, workspaceId), statusCondition); counts.push(db.select({ count: sql<number>`count(*)::int` }).from(upsellActionsTable).where(where));
    const result = await db.select().from(upsellActionsTable).where(where).orderBy(desc(upsellActionsTable.createdAt), desc(upsellActionsTable.id)).limit(window);
    rows.push(...result.map((r) => ({ id: r.id, type: "upsell", status: r.status, createdAt: r.createdAt })));
  }
  rows.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime() || String(b.id).localeCompare(String(a.id)));
  const countResults = await Promise.all(counts);
  return { actions: rows.slice(offset, offset + limit), pagination: { limit, offset, total: countResults.reduce((sum, result) => sum + (result[0]?.count ?? 0), 0) } };
}