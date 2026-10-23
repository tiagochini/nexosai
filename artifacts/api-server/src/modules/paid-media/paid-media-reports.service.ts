import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  paidMediaAccountsTable,
  paidMediaEntitiesTable,
  paidMediaInsightsTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { summarizeMetaReport } from "./meta-reporting.domain.js";

export const metaReportQuerySchema = z
  .object({
    accountId: z.string().uuid(),
    since: z.iso.date(),
    until: z.iso.date(),
  })
  .refine(
    (value) =>
      value.since <= value.until &&
      (Date.parse(value.until) - Date.parse(value.since)) / 86400000 <= 366,
    "Informe um período de até 366 dias, em ordem.",
  );
export async function paidMediaGoalReport(workspaceId: string, input: unknown) {
  const parsed = metaReportQuerySchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise conta e período do relatório.",
      "REPORT_QUERY_INVALID",
      parsed.error.issues,
    );
  const { accountId, since, until } = parsed.data;
  const [account] = await db
    .select()
    .from(paidMediaAccountsTable)
    .where(
      and(
        eq(paidMediaAccountsTable.id, accountId),
        eq(paidMediaAccountsTable.workspaceId, workspaceId),
        eq(paidMediaAccountsTable.provider, "meta_ads"),
      ),
    )
    .limit(1);
  if (!account) throw new NotFoundError("Meta account");
  const rows = await db
    .select({
      entityType: paidMediaEntitiesTable.entityType,
      currency: paidMediaInsightsTable.currency,
      attributionWindow: paidMediaInsightsTable.attributionWindow,
      spend: paidMediaInsightsTable.spend,
      impressions: paidMediaInsightsTable.impressions,
      clicks: paidMediaInsightsTable.clicks,
      rawMetrics: paidMediaInsightsTable.rawMetrics,
    })
    .from(paidMediaInsightsTable)
    .innerJoin(
      paidMediaEntitiesTable,
      eq(paidMediaEntitiesTable.id, paidMediaInsightsTable.entityId),
    )
    .where(
      and(
        eq(paidMediaInsightsTable.workspaceId, workspaceId),
        eq(paidMediaInsightsTable.accountId, accountId),
        eq(paidMediaEntitiesTable.workspaceId, workspaceId),
        eq(paidMediaEntitiesTable.accountId, accountId),
        eq(paidMediaEntitiesTable.entityType, "ad"),
        gte(paidMediaInsightsTable.metricDate, since),
        lte(paidMediaInsightsTable.metricDate, until),
      ),
    );
  return {
    since,
    until,
    accountId,
    timezone: account.timezone,
    source: "meta_insights",
    ...summarizeMetaReport(rows, account.currency),
  };
}
