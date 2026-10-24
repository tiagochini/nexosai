import { AppError } from "../../lib/errors.js";
import { accountFor } from "./meta-audience.service.js";
import { metaAccountAssetRequest } from "./providers.js";
import {
  advancedReportQuery,
  advancedInsightsQuery,
  assertReportRow,
  advancedReportRow,
  advancedRowMetrics,
  reportBreakdowns,
} from "./meta-advanced-report.domain.js";

async function reportPages(
  workspaceId: string,
  accountId: string,
  query: Record<string, string>,
  read: typeof metaAccountAssetRequest,
  deadline: number,
) {
  const rows: unknown[] = [],
    cursors = new Set<string>();
  let after = "";
  for (let page = 0; page < 25; page++) {
    if (Date.now() > deadline) break;
    const response = await read(workspaceId, accountId, "account/insights", {
      query: { ...query, ...(after ? { after } : {}) },
    });
    if (!Array.isArray(response.data))
      throw new AppError(
        502,
        "A Meta não retornou uma lista válida de métricas.",
        "META_REPORT_INVALID",
      );
    rows.push(...response.data);
    if (rows.length > 5000) break;
    const paging = response.paging as
      { next?: unknown; cursors?: { after?: unknown } } | undefined;
    if (Date.now() > deadline) break;
    if (!paging?.next) return rows;
    const cursor = paging?.cursors?.after;
    if (
      typeof cursor !== "string" ||
      !cursor ||
      cursor.length > 2000 ||
      cursors.has(cursor)
    )
      break;
    cursors.add(cursor);
    after = cursor; // Never follow a provider URL containing credentials.
  }
  throw new AppError(
    422,
    "Consulta incompleta ou acima de 5.000 linhas. Reduza o período ou escolha outro detalhamento; nenhum total parcial foi apresentado.",
    "META_REPORT_LIMIT",
  );
}
export async function paidMediaAdvancedReport(
  workspaceId: string,
  input: unknown,
  read = metaAccountAssetRequest,
) {
  const parsed = advancedReportQuery.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise a conta, o período de até 31 dias e os filtros do relatório.",
      "META_REPORT_QUERY_INVALID",
    );
  const form = parsed.data,
    account = await accountFor(workspaceId, form.accountId);
  const deadline = Date.now() + 60000;
  let summaryRows: unknown[], detailRows: unknown[];
  try {
    summaryRows = await reportPages(
      workspaceId,
      form.accountId,
      advancedInsightsQuery(form, true),
      read,
      deadline,
    );
    detailRows = await reportPages(
      workspaceId,
      form.accountId,
      advancedInsightsQuery(form, false),
      read,
      deadline,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      "Consulta Meta indisponível. Revise permissões, integração paga e a combinação de métricas/detalhamento. Nenhum filtro foi trocado automaticamente.",
      "META_REPORT_PROVIDER_ERROR",
    );
  }
  if (summaryRows.length > 1)
    throw new AppError(
      502,
      "O provedor dividiu o agregado da conta. Alcance e frequência não serão somados.",
      "META_REPORT_INVALID",
    );
  for (const row of summaryRows) assertReportRow(row, account, form, true);
  const seen = new Set<string>();
  const rows = detailRows.map((row) => {
    assertReportRow(row, account, form, false);
    const key = JSON.stringify([
      row.ad_id,
      row.date_start,
      row.date_stop,
      ...reportBreakdowns[form.breakdown].map((field) => row[field]),
    ]);
    if (seen.has(key))
      throw new AppError(
        502,
        "O provedor repetiu o mesmo anúncio/período/detalhamento. O relatório foi interrompido para evitar duplicação.",
        "META_REPORT_DUPLICATE",
      );
    seen.add(key);
    return advancedReportRow(row, form);
  });
  return {
    accountId: account.id,
    since: form.since,
    until: form.until,
    currency: account.currency,
    timezone: account.timezone,
    breakdown: form.breakdown,
    attribution: form.attribution,
    source: "meta_insights_live",
    fetchedAt: new Date().toISOString(),
    actionReportTime: "impression",
    complete: true,
    summary: summaryRows[0]
      ? {
          since: (summaryRows[0] as Record<string, any>).date_start,
          until: (summaryRows[0] as Record<string, any>).date_stop,
          ...advancedRowMetrics(
            summaryRows[0] as Record<string, any>,
            form,
            true,
          ),
        }
      : null,
    rows,
    limitations: {
      reachAndFrequency: "provider_period_aggregate_never_summed",
      rankings:
        form.breakdown === "none"
          ? "provider_availability"
          : "not_requested_with_breakdown",
      hourlyUniqueAndVideo:
        form.breakdown === "hour" ? "not_requested" : "not_applicable",
      video3SecondViews: "not_certified_use_named_video_metrics",
      attributionChangesCampaign: false,
    },
  };
}
