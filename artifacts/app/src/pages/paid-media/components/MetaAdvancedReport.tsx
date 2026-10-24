import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "reach"
  | "frequency"
  | "ctr"
  | "cpc"
  | "cpm"
  | "linkClicks"
  | "leads"
  | "registrations"
  | "purchases"
  | "addToCart"
  | "checkouts"
  | "purchaseValue"
  | "roas"
  | "costPerLead"
  | "costPerPurchase"
  | "videoPlays"
  | "video3SecondViews"
  | "video75"
  | "thruPlays";
type Metrics = Record<MetricKey, number | null> & {
  qualityRanking: string | null;
  engagementRanking: string | null;
  conversionRanking: string | null;
};
type Report = {
  accountId: string;
  since: string;
  until: string;
  timezone: string;
  currency: string;
  breakdown: string;
  attribution: string;
  fetchedAt: string;
  summary: Metrics | null;
  rows: Array<
    Metrics & {
      adId: string;
      adName: string | null;
      adSetName: string | null;
      campaignName: string | null;
      since: string;
      until: string;
      weekday: number | null;
      dimensions: Record<string, string>;
      optimizationReview: string[];
    }
  >;
};
export function MetaAdvancedReport() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const [accountId, setAccount] = useState(""),
    [since, setSince] = useState(""),
    [until, setUntil] = useState(""),
    [breakdown, setBreakdown] = useState("none"),
    [attribution, setAttribution] = useState("account");
  const [reviewMinImpressions, setReviewMinImpressions] = useState(""),
    [reviewMaxFrequency, setReviewMaxFrequency] = useState(""),
    [reviewMinCtrPercent, setReviewMinCtrPercent] = useState(""),
    [reviewConversion, setReviewConversion] = useState(""),
    [reviewTargetCost, setReviewTargetCost] = useState(""),
    [reviewMinConversions, setReviewMinConversions] = useState("");
  const [view, setView] = useState("delivery"),
    [page, setPage] = useState(0);
  const { data: accounts } = useQuery({
    queryKey: ["/api/paid-media/accounts/meta_ads"],
    queryFn: () =>
      customFetch<{
        accounts: Array<{
          id: string;
          accountName: string;
          isSelected: boolean;
        }>;
      }>("/api/paid-media/accounts/meta_ads"),
  });
  const {
    data,
    error,
    isPending: isFetching,
    mutate: loadReport,
  } = useMutation({
    retry: false,
    mutationFn: (query: Record<string, string>) =>
      customFetch<Report>(
        `/api/paid-media/reports/meta-advanced?${new URLSearchParams(query)}`,
      ),
  });
  const field = "block h-10 border border-border/50 bg-background px-3 w-full";
  const format = (value: unknown, key?: string) =>
    value == null
      ? "—"
      : typeof value !== "number"
        ? String(value)
        : new Intl.NumberFormat(intlLocale(locale), {
            ...(data &&
            [
              "spend",
              "cpc",
              "cpm",
              "costPerLead",
              "costPerPurchase",
              "purchaseValue",
            ].includes(key ?? "")
              ? { style: "currency" as const, currency: data.currency }
              : { maximumFractionDigits: 2 }),
          }).format(value) + (key === "ctr" ? "%" : "");
  const columns: Array<{ key: keyof Metrics; label: string }> =
    view === "delivery"
      ? [
          { key: "spend", label: t("Gasto", "Spend", "Gasto") },
          {
            key: "impressions",
            label: t("Impressões", "Impressions", "Impresiones"),
          },
          { key: "reach", label: t("Alcance", "Reach", "Alcance") },
          {
            key: "frequency",
            label: t("Frequência", "Frequency", "Frecuencia"),
          },
          {
            key: "clicks",
            label: t("Cliques (todos)", "Clicks (all)", "Clics (todos)"),
          },
          {
            key: "linkClicks",
            label: t("Cliques no link", "Link clicks", "Clics en enlace"),
          },
          { key: "ctr", label: "CTR (all)" },
          { key: "cpc", label: "CPC (all)" },
          { key: "cpm", label: "CPM" },
        ]
      : view === "funnel"
        ? [
            { key: "leads", label: "Leads" },
            {
              key: "registrations",
              label: t("Cadastros", "Registrations", "Registros"),
            },
            { key: "addToCart", label: "AddToCart" },
            { key: "checkouts", label: "InitiateCheckout" },
            { key: "purchases", label: "Purchase" },
            {
              key: "purchaseValue",
              label: t(
                "Valor de compras",
                "Purchase value",
                "Valor de compras",
              ),
            },
            { key: "costPerLead", label: "CPL" },
            { key: "costPerPurchase", label: "CPA Purchase" },
            { key: "roas", label: "ROAS Purchase" },
          ]
        : [
            {
              key: "videoPlays",
              label: t("Reproduções", "Video plays", "Reproducciones"),
            },
            {
              key: "video3SecondViews",
              label: t("Visualizações de 3 s", "3-second views", "Vistas de 3 s"),
            },
            { key: "video75", label: t("Vídeo 75%", "Video 75%", "Vídeo 75%") },
            { key: "thruPlays", label: "ThruPlay" },
            { key: "qualityRanking", label: "Quality ranking" },
            { key: "engagementRanking", label: "Engagement ranking" },
            { key: "conversionRanking", label: "Conversion ranking" },
          ];
  return (
    <section
      className="space-y-4 border-t border-border/40 pt-6"
      data-testid="meta-advanced-report"
    >
      <h3 className="font-mono text-sm font-bold">
        {t(
          "Relatório detalhado — consulta Meta",
          "Detailed report — Meta query",
          "Informe detallado — consulta Meta",
        )}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "Consulta somente de leitura, acionada ao enviar o formulário. O resumo vem do agregado da conta no período. Alcance e frequência não são somados entre anúncios, dias ou segmentos. A janela escolhida muda apenas esta leitura; ela não altera campanhas.",
          "Read-only query triggered by submitting this form. The summary uses Meta's account aggregate for the period. Reach and frequency are not summed across ads, days or segments. The selected attribution window only changes this read; campaigns are unchanged.",
          "Consulta de lectura al enviar el formulario. El resumen usa el agregado de cuenta del período. Alcance y frecuencia no se suman entre anuncios, días o segmentos. La ventana solo modifica esta lectura, sin cambiar campañas.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = Object.fromEntries(Object.entries({
            accountId, since, until, breakdown, attribution,
            ...(reviewMinImpressions ? { reviewMinImpressions } : {}),
            ...(reviewMaxFrequency ? { reviewMaxFrequency } : {}),
            ...(reviewMinCtrPercent ? { reviewMinCtrPercent } : {}),
            ...(reviewConversion ? { reviewConversion } : {}),
            ...(reviewTargetCost ? { reviewTargetCost } : {}),
            ...(reviewMinConversions ? { reviewMinConversions } : {}),
          }).map(([key, value]) => [key, String(value)]));
          setPage(0);
          loadReport(next);
        }}
      >
        <fieldset
          disabled={isFetching}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs"
        >
          <label>
            {t("Conta selecionada", "Selected account", "Cuenta seleccionada")}
            <select
              className={field}
              required
              value={accountId}
              onChange={(event) => setAccount(event.target.value)}
            >
              <option value="">{t("Selecione", "Select", "Selecciona")}</option>
              {accounts?.accounts
                .filter((row) => row.isSelected)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.accountName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("Amostra mínima de impressões (revisão)", "Minimum impressions (review)", "Impresiones mínimas (revisión)")}
            <input className={field} type="number" min="1" value={reviewMinImpressions} onChange={(event) => setReviewMinImpressions(event.target.value)} />
          </label>
          <label>
            {t("Frequência para revisão", "Frequency review limit", "Límite de frecuencia")}
            <input className={field} type="number" min="0.01" step="0.01" value={reviewMaxFrequency} onChange={(event) => setReviewMaxFrequency(event.target.value)} />
          </label>
          <label>
            {t("CTR mínimo (%)", "Minimum CTR (%)", "CTR mínimo (%)")}
            <input className={field} type="number" min="0" max="100" step="0.01" value={reviewMinCtrPercent} onChange={(event) => setReviewMinCtrPercent(event.target.value)} />
          </label>
          <label>
            {t("Conversão para custo-alvo", "Conversion for target cost", "Conversión para coste objetivo")}
            <select className={field} value={reviewConversion} onChange={(event) => setReviewConversion(event.target.value)}>
              <option value="">{t("Sem avaliação de custo", "No cost review", "Sin revisión de coste")}</option>
              <option value="leads">Lead</option>
              <option value="purchases">Purchase</option>
            </select>
          </label>
          <label>
            {t("Custo-alvo", "Target cost", "Coste objetivo")}
            <input className={field} type="number" min="0.01" step="0.01" value={reviewTargetCost} onChange={(event) => setReviewTargetCost(event.target.value)} />
          </label>
          <label>
            {t("Conversões mínimas para avaliar custo", "Minimum conversions for cost review", "Conversiones mínimas para evaluar coste")}
            <input className={field} type="number" min="1" value={reviewMinConversions} onChange={(event) => setReviewMinConversions(event.target.value)} />
          </label>
          <label>
            {t("De", "From", "Desde")}
            <input
              className={field}
              required
              type="date"
              value={since}
              max={until || undefined}
              onChange={(event) => setSince(event.target.value)}
            />
          </label>
          <label>
            {t(
              "Até (máximo 31 dias)",
              "Until (up to 31 days)",
              "Hasta (máximo 31 días)",
            )}
            <input
              className={field}
              required
              type="date"
              value={until}
              min={since || undefined}
              onChange={(event) => setUntil(event.target.value)}
            />
          </label>
          <label>
            {t("Detalhamento", "Breakdown", "Desglose")}
            <select
              className={field}
              value={breakdown}
              onChange={(event) => setBreakdown(event.target.value)}
            >
              <option value="none">
                {t(
                  "Anúncio no período",
                  "Ad for the period",
                  "Anuncio en el período",
                )}
              </option>
              <option value="age_gender">
                {t("Idade e gênero", "Age and gender", "Edad y género")}
              </option>
              <option value="placement">Placement</option>
              <option value="platform">
                {t("Plataforma", "Platform", "Plataforma")}
              </option>
              <option value="hour">
                {t(
                  "Hora no fuso da conta",
                  "Hour in account timezone",
                  "Hora en zona de cuenta",
                )}
              </option>
              <option value="day">
                {t(
                  "Dia e dia da semana",
                  "Date and weekday",
                  "Día y día de semana",
                )}
              </option>
            </select>
          </label>
          <label>
            {t(
              "Atribuição da consulta",
              "Query attribution",
              "Atribución de consulta",
            )}
            <select
              className={field}
              value={attribution}
              onChange={(event) => setAttribution(event.target.value)}
            >
              <option value="account">
                {t(
                  "Configuração da conta Meta",
                  "Meta account setting",
                  "Configuración de cuenta Meta",
                )}
              </option>
              <option value="1d_click">1-day click</option>
              <option value="7d_click">7-day click</option>
              <option value="1d_view">1-day view</option>
            </select>
          </label>
          <Button type="submit" disabled={!accountId || isFetching}>
            {isFetching
              ? t("Consultando…", "Querying…", "Consultando…")
              : t("Consultar Meta", "Query Meta", "Consultar Meta")}
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      {data && !error && !isFetching && (
        <>
          <p className="text-xs">
            {accounts?.accounts.find((account) => account.id === data.accountId)
              ?.accountName ?? data.accountId}{" "}
            · {data.since} → {data.until} · {data.currency} · {data.timezone} ·{" "}
            {data.attribution} ·{" "}
            {new Date(data.fetchedAt).toLocaleString(intlLocale(locale))}
          </p>
          <h4 className="text-xs font-bold">
            {t(
              "Resumo da conta no período",
              "Account summary for period",
              "Resumen de cuenta en período",
            )}
          </h4>
          {data.summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {(
                [
                  ["spend", t("Gasto", "Spend", "Gasto")],
                  [
                    "impressions",
                    t("Impressões", "Impressions", "Impresiones"),
                  ],
                  ["reach", t("Alcance", "Reach", "Alcance")],
                  ["frequency", t("Frequência", "Frequency", "Frecuencia")],
                  ["leads", "Leads"],
                  ["purchases", "Purchase"],
                  ["costPerLead", "CPL"],
                  ["roas", "ROAS Purchase"],
                ] as Array<[MetricKey, string]>
              ).map(([key, label]) => (
                <div key={key} className="border border-border/40 p-3">
                  <span className="text-muted-foreground">{label}</span>
                  <strong className="block text-base">
                    {format(data.summary![key], key)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs">
              {t(
                "Sem agregado disponível para este período.",
                "No aggregate available for this period.",
                "No hay agregado para este período.",
              )}
            </p>
          )}
          <label className="block text-xs">
            {t("Colunas", "Columns", "Columnas")}
            <select
              className={field}
              value={view}
              onChange={(event) => setView(event.target.value)}
            >
              <option value="delivery">
                {t(
                  "Entrega e custos",
                  "Delivery and costs",
                  "Entrega y costos",
                )}
              </option>
              <option value="funnel">
                {t("Funil e retorno", "Funnel and return", "Embudo y retorno")}
              </option>
              <option value="creative">
                {t(
                  "Vídeo e rankings",
                  "Video and rankings",
                  "Vídeo y rankings",
                )}
              </option>
            </select>
          </label>
          <div className="overflow-x-auto border border-border/40">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr>
                  {[
                    t(
                      "Campanha / conjunto / anúncio",
                      "Campaign / ad set / ad",
                      "Campaña / conjunto / anuncio",
                    ),
                    t(
                      "Período / segmento",
                      "Period / segment",
                      "Período / segmento",
                    ),
                    ...columns.map((column) => column.label),
                    t("Sinais para revisão", "Review signals", "Señales para revisar"),
                  ].map((label) => (
                    <th key={label} className="p-3 text-left">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows
                  .slice(page * 100, (page + 1) * 100)
                  .map((row, index) => (
                    <tr
                      key={`${row.adId}:${page}:${index}`}
                      className="border-t border-border/30"
                    >
                      <td className="p-3 whitespace-normal min-w-60">
                        <p>{row.campaignName ?? "—"}</p>
                        <p className="text-muted-foreground">
                          {row.adSetName ?? "—"}
                        </p>
                        <strong>{row.adName ?? row.adId}</strong>
                        <p>{row.adId}</p>
                      </td>
                      <td className="p-3">
                        <p>
                          {row.since} → {row.until}
                        </p>
                        {row.weekday != null && (
                          <p>
                            {new Intl.DateTimeFormat(intlLocale(locale), {
                              weekday: "long",
                              timeZone: "UTC",
                            }).format(new Date(`${row.since}T00:00:00Z`))}
                          </p>
                        )}
                        {Object.entries(row.dimensions).map(([key, value]) => (
                          <p key={key}>{value}</p>
                        ))}
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className="p-3">
                          {format(row[column.key], column.key)}
                        </td>
                      ))}
                      <td className="p-3 whitespace-normal max-w-64">
                        {row.optimizationReview.length
                          ? row.optimizationReview.map((signal) => <p key={signal}>{signal.replaceAll("_", " ")}</p>)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!data.rows.length && (
              <p className="p-3 text-xs">
                {t(
                  "Nenhuma linha retornada.",
                  "No rows returned.",
                  "No se devolvieron filas.",
                )}
              </p>
            )}
          </div>
          <div className="flex gap-3 items-center text-xs">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              {t("Anterior", "Previous", "Anterior")}
            </Button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(data.rows.length / 100))} ·{" "}
              {data.rows.length} {t("linhas", "rows", "filas")}
            </span>
            <Button
              variant="outline"
              disabled={(page + 1) * 100 >= data.rows.length}
              onClick={() => setPage((current) => current + 1)}
            >
              {t("Próxima", "Next", "Siguiente")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "— indica métrica indisponível. Rankings são solicitados apenas sem detalhamento. No detalhamento por hora, alcance, frequência e vídeo ficam indisponíveis por linha. Reproduções, visualizações de 3 segundos, vídeo a 75% e ThruPlay são métricas distintas. Sinais de revisão usam somente os limites preenchidos por você; não pausam nem escalam campanhas e não afirmam tendência ou fadiga comprovada.",
              "— means unavailable. Rankings are requested only without breakdowns. Hourly rows omit reach, frequency and video. Plays, 3-second views, 75% views and ThruPlay are distinct metrics. Review signals use only thresholds you enter; they do not pause or scale campaigns and do not claim a proven trend or fatigue.",
              "— indica métrica no disponible. Rankings solo se solicitan sin desglose. Las filas por hora omiten alcance, frecuencia y vídeo. Reproducciones, vistas de 3 segundos, 75% y ThruPlay son métricas distintas. Las señales usan solo los límites ingresados; no pausan ni escalan campañas ni confirman tendencia o fatiga.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
