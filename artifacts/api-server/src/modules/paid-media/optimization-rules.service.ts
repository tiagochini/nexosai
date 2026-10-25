import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaInsightsTable,
  paidMediaOptimizationAlertsTable as alerts, paidMediaOptimizationRulesTable as rules,
} from "@workspace/db";
import { evaluateOptimizationThresholds } from "./optimization-rules.domain.js";

export const optimizationRuleSchema = z.object({
  accountId: z.string().uuid(), name: z.string().trim().min(1).max(120),
  scheduleMinutes: z.number().int().min(15).max(1440),
  lookbackDays: z.number().int().min(1).max(30),
  entityTypes: z.array(z.enum(["campaign", "ad_set", "ad"])).min(1).max(3),
  minSpend: z.number().nonnegative().optional(),
  maxCpa: z.number().positive().optional(), minRoas: z.number().positive().optional(), minCtr: z.number().nonnegative().max(100).optional(),
}).strict().refine(v => v.maxCpa != null || v.minRoas != null || v.minCtr != null, "Defina ao menos um limite de CPA, ROAS ou CTR.");

export async function listOptimizationRules(workspaceId: string) {
  return db.select().from(rules).where(eq(rules.workspaceId, workspaceId)).orderBy(desc(rules.updatedAt));
}

export async function createOptimizationRule(workspaceId: string, actor: string, input: unknown) {
  const form = optimizationRuleSchema.parse(input);
  const [account] = await db.select({ id: paidMediaAccountsTable.id }).from(paidMediaAccountsTable)
    .where(and(eq(paidMediaAccountsTable.id, form.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, "meta_ads"))).limit(1);
  if (!account) throw new Error("A conta Meta precisa pertencer a este workspace.");
  const { accountId, name, scheduleMinutes, ...criteria } = form;
  const [rule] = await db.insert(rules).values({ workspaceId, accountId, name, scheduleMinutes, configuration: criteria, createdBy: actor, enabled: false }).returning();
  return rule;
}

export async function setOptimizationRuleEnabled(workspaceId: string, ruleId: string, enabled: boolean) {
  const [rule] = await db.update(rules).set({ enabled, nextRunAt: new Date(), lastError: null })
    .where(and(eq(rules.id, ruleId), eq(rules.workspaceId, workspaceId))).returning();
  return rule ?? null;
}

export async function listOptimizationAlerts(workspaceId: string, unreadOnly = false) {
  return db.select().from(alerts).where(and(eq(alerts.workspaceId, workspaceId), unreadOnly ? isNull(alerts.readAt) : undefined))
    .orderBy(desc(alerts.createdAt)).limit(100);
}

export async function markOptimizationAlertRead(workspaceId: string, alertId: string) {
  const [row] = await db.update(alerts).set({ readAt: new Date() })
    .where(and(eq(alerts.id, alertId), eq(alerts.workspaceId, workspaceId), isNull(alerts.readAt))).returning();
  return row ?? null;
}

function numeric(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function localDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}
function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
function metricSummary(rows: Array<{ entityId: string; metricDate: string; currency: string; impressions: number; clicks: number; spend: string; conversions: string; conversionValue: string }>) {
  return rows.reduce((m, row) => ({
    entityId: row.entityId, currency: row.currency,
    impressions: m.impressions + numeric(row.impressions), clicks: m.clicks + numeric(row.clicks),
    spend: m.spend + numeric(row.spend), conversions: m.conversions + numeric(row.conversions),
    conversionValue: m.conversionValue + numeric(row.conversionValue),
  }), { entityId: rows[0]!.entityId, currency: rows[0]!.currency, impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 });
}

/** Scheduled evaluation is observational only: it records alerts and never edits Meta assets. */
export async function optimizationRulesTick(now = new Date()) {
  const due = await db.select().from(rules).where(and(eq(rules.enabled, true), lte(rules.nextRunAt, now))).limit(25);
  for (const rule of due) {
    try {
      const config = rule.configuration as z.infer<typeof optimizationRuleSchema>;
      const [account] = await db.select({ timezone: paidMediaAccountsTable.timezone }).from(paidMediaAccountsTable)
        .where(and(eq(paidMediaAccountsTable.id, rule.accountId), eq(paidMediaAccountsTable.workspaceId, rule.workspaceId))).limit(1);
      if (!account) throw new Error("Account unavailable");
      const until = shiftDate(localDate(now, account.timezone), -1),
        since = shiftDate(until, -(Number(config.lookbackDays) - 1));
      const rows = await db.select({ entityId: paidMediaInsightsTable.entityId, metricDate: paidMediaInsightsTable.metricDate, currency: paidMediaInsightsTable.currency, impressions: paidMediaInsightsTable.impressions, clicks: paidMediaInsightsTable.clicks, spend: paidMediaInsightsTable.spend, conversions: paidMediaInsightsTable.conversions, conversionValue: paidMediaInsightsTable.conversionValue })
        .from(paidMediaInsightsTable).innerJoin(paidMediaEntitiesTable, and(eq(paidMediaEntitiesTable.id, paidMediaInsightsTable.entityId), eq(paidMediaEntitiesTable.workspaceId, rule.workspaceId)))
        .where(and(eq(paidMediaInsightsTable.workspaceId, rule.workspaceId), eq(paidMediaInsightsTable.accountId, rule.accountId), eq(paidMediaInsightsTable.dateGrain, "daily"), eq(paidMediaInsightsTable.attributionWindow, "provider_default"), inArray(paidMediaEntitiesTable.entityType, config.entityTypes), gte(paidMediaInsightsTable.metricDate, since), lte(paidMediaInsightsTable.metricDate, until)));
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) grouped.set(row.entityId, [...(grouped.get(row.entityId) ?? []), row]);
      const fingerprint = `${since}:${until}`;
      for (const group of grouped.values()) {
        const m = metricSummary(group);
        const evaluation = evaluateOptimizationThresholds(m, config);
        if (!evaluation.eligible) continue;
        if (evaluation.breaches.length) await db.insert(alerts).values({ workspaceId: rule.workspaceId, ruleId: rule.id, entityId: m.entityId, fingerprint, severity: "review", message: evaluation.breaches.join("; "), metrics: { ...m, cpa: evaluation.cpa, roas: evaluation.roas, ctr: evaluation.ctr, since, until } }).onConflictDoNothing();
      }
      await db.update(rules).set({ lastRunAt: now, nextRunAt: new Date(now.getTime() + rule.scheduleMinutes * 60000), lastError: null }).where(eq(rules.id, rule.id));
    } catch {
      await db.update(rules).set({ lastRunAt: now, nextRunAt: new Date(now.getTime() + rule.scheduleMinutes * 60000), lastError: "RULE_EVALUATION_FAILED" }).where(eq(rules.id, rule.id));
    }
  }
}
