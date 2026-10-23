import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

import { CrmReconciliation } from "./CrmReconciliation";

type Group = {
  event: string;
  attributionWindow: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  costPerResult: number | null;
  purchaseValue: number | null;
  roas: number | null;
  actionTypes: string[];
  status: string;
};
type Report = {
  currency: string;
  timezone: string;
  groups: Group[];
  grain: string;
  ignoredRows: number;
};

export function GoalReportsTab() {
  const t = useUiText(),
    { locale } = useUiLocale();
  const today = new Date().toLocaleDateString("en-CA");
  const [accountId, setAccountId] = useState(""),
    [since, setSince] = useState(today),
    [until, setUntil] = useState(today);
  const [query, setQuery] = useState<{
    accountId: string;
    since: string;
    until: string;
  } | null>(null);
  const { data: accounts } = useQuery({
    queryKey: ["/api/paid-media/accounts/meta_ads"],
    queryFn: () =>
      customFetch<{
        accounts: { id: string; accountName: string; currency: string }[];
      }>("/api/paid-media/accounts/meta_ads"),
  });
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["/api/paid-media/reports/goals", query],
    enabled: !!query,
    queryFn: () =>
      customFetch<Report>(
        `/api/paid-media/reports/goals?${new URLSearchParams(query!)}`,
      ),
  });
  const number = (value: number | null) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(intlLocale(locale), {
          maximumFractionDigits: 2,
        }).format(value);
  const money = (value: number | null) =>
    value == null || !data
      ? "—"
      : new Intl.NumberFormat(intlLocale(locale), {
          style: "currency",
          currency: data.currency,
        }).format(value);
  const resultLabel = (event: string) =>
    event === "LinkClick"
      ? t("Cliques no link", "Link clicks", "Clics en el enlace")
      : event === "Unknown"
        ? t(
            "Objetivo indisponível",
            "Goal unavailable",
            "Objetivo no disponible",
          )
        : event;
  return (
    <section className="space-y-5" data-testid="paid-media-goal-report">
      <h3 className="font-mono text-sm font-bold">
        {t(
          "Resultados por objetivo — Meta Ads",
          "Results by goal — Meta Ads",
          "Resultados por objetivo — Meta Ads",
        )}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "Leads, cadastros e compras são apresentados separadamente. O relatório usa somente o nível de anúncio para não somar novamente os totais de campanha e conjunto. Os dados são atribuídos pela Meta; não representam recibos CAPI nem vendas confirmadas no CRM.",
          "Leads, registrations and purchases are reported separately. Only ad-level rows are used to avoid counting campaign and ad-set totals again. Meta attribution is distinct from CAPI receipts and confirmed CRM sales.",
          "Leads, registros y compras se muestran por separado. Se usa solo el nivel de anuncio para evitar duplicar totales de campaña y conjunto. La atribución de Meta es distinta de recibos CAPI y ventas confirmadas en CRM.",
        )}
      </p>
      <form
        className="flex gap-3 items-end flex-wrap"
        onSubmit={(event) => {
          event.preventDefault();
          const next = { accountId, since, until };
          if (JSON.stringify(next) === JSON.stringify(query)) void refetch();
          else setQuery(next);
        }}
      >
        <label className="text-xs space-y-1">
          <span>{t("Conta", "Account", "Cuenta")}</span>
          <select
            className="block h-10 border border-border/50 bg-background px-3"
            required
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">{t("Selecione", "Select", "Selecciona")}</option>
            {accounts?.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountName} · {account.currency}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span>{t("De", "From", "Desde")}</span>
          <input
            className="block h-10 border border-border/50 bg-background px-3"
            type="date"
            value={since}
            required
            max={until}
            onChange={(event) => setSince(event.target.value)}
          />
        </label>
        <label className="text-xs space-y-1">
          <span>{t("Até", "To", "Hasta")}</span>
          <input
            className="block h-10 border border-border/50 bg-background px-3"
            type="date"
            value={until}
            required
            min={since}
            onChange={(event) => setUntil(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={isFetching}>
          {isFetching
            ? t("Carregando…", "Loading…", "Cargando…")
            : t("Consultar", "View report", "Consultar")}
        </Button>
      </form>
      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : t(
                "Falha ao consultar.",
                "Failed to load report.",
                "Error al consultar.",
              )}
        </p>
      ) : (
        data && (
          <>
            <p className="text-xs text-muted-foreground">
              {t(
                "Fuso da conta",
                "Account timezone",
                "Zona horaria de la cuenta",
              )}
              : {data.timezone} ·{" "}
              {t(
                "Atribuição conforme configuração da Meta",
                "Attribution follows Meta settings",
                "Atribución según configuración de Meta",
              )}
            </p>
            {!data.groups.length ? (
              <p className="text-sm">
                {t(
                  "Sem dados de anúncios neste período. Sincronize a conta em Integrações & Sync.",
                  "No ad data for this period. Sync the account in Integrations & Sync.",
                  "Sin datos de anuncios en este período. Sincroniza la cuenta en Integraciones y sincronización.",
                )}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      {[
                        t(
                          "Evento / resultado",
                          "Event / result",
                          "Evento / resultado",
                        ),
                        t("Investimento", "Spend", "Inversión"),
                        t("Resultados", "Results", "Resultados"),
                        t(
                          "Custo por resultado",
                          "Cost per result",
                          "Costo por resultado",
                        ),
                        t(
                          "Valor de compras",
                          "Purchase value",
                          "Valor de compras",
                        ),
                        "ROAS",
                      ].map((label) => (
                        <th className="p-3" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((group) => (
                      <tr
                        className="border-b border-border/30 align-top"
                        key={`${group.event}:${group.attributionWindow}`}
                      >
                        <td className="p-3">
                          <strong>{resultLabel(group.event)}</strong>
                          <p className="text-muted-foreground">
                            {group.attributionWindow}
                          </p>
                          {group.status !== "measured" && (
                            <p className="text-amber-400">
                              {t(
                                "Sincronize novamente ou revise o objetivo do conjunto.",
                                "Resync or review the ad set goal.",
                                "Vuelve a sincronizar o revisa el objetivo del conjunto.",
                              )}
                            </p>
                          )}
                        </td>
                        <td className="p-3">{money(group.spend)}</td>
                        <td className="p-3">{number(group.results)}</td>
                        <td className="p-3">{money(group.costPerResult)}</td>
                        <td className="p-3">{money(group.purchaseValue)}</td>
                        <td className="p-3">{number(group.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                "Campos indisponíveis aparecem como —. Registros anteriores a esta atualização precisam de nova sincronização para identificar o evento. Moedas e janelas de atribuição diferentes não são somadas.",
                "Unavailable fields appear as —. Older rows need a new sync to identify the event. Different currencies and attribution windows are kept separate.",
                "Los campos no disponibles aparecen como —. Los registros anteriores necesitan nueva sincronización para identificar el evento. No se suman distintas monedas ni ventanas de atribución.",
              )}
            </p>
          </>
        )
      )}
      {query && <CrmReconciliation query={query} />}
    </section>
  );
}
