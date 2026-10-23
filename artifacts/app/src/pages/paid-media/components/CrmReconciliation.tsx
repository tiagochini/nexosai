import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

type Report = {
  groups: Array<{
    accountId: string;
    currency: string;
    attributionWindow: string | null;
    ignoredAttributionWindows: string[];
    spend: number;
    crmConversions: number;
    crmRevenue: number;
    cpa: number | null;
    roas: number | null;
  }>;
  excludedFromPaidMetrics: Array<{
    currency: string;
    conversions: number;
    revenue: number;
  }>;
};
export function CrmReconciliation({
  query,
}: {
  query: { accountId: string; since: string; until: string };
}) {
  const t = useUiText(),
    { locale } = useUiLocale();
  const { data, isFetching, error } = useQuery({
    queryKey: ["/api/paid-media/attribution/reconciliation", query],
    queryFn: () =>
      customFetch<Report>(
        `/api/paid-media/attribution/reconciliation?${new URLSearchParams(query)}`,
      ),
  });
  const money = (value: number | null, currency: string) => {
    if (value == null) return "—";
    try {
      return new Intl.NumberFormat(intlLocale(locale), {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  };
  return (
    <section className="space-y-3 border-t border-border/50 pt-5">
      <h4>
        {t(
          "Reconciliação com CRM",
          "CRM reconciliation",
          "Conciliación con CRM",
        )}
      </h4>
      <p className="text-xs text-muted-foreground">
        {t(
          "Conversões vinculadas à conta consultada, por moeda. Compara totais do período; não é análise de coorte. Datas do CRM em UTC e mídia no fuso da conta. A receita precisa ser informada pelo CRM para calcular ROAS.",
          "Linked conversions for this account, by currency. Compares period totals, not cohorts. CRM dates use UTC and media uses account timezone. CRM revenue must be supplied to calculate ROAS.",
          "Conversiones vinculadas a esta cuenta, por moneda. Compara totales del período, no cohortes. CRM en UTC y medios en zona horaria de la cuenta. El CRM debe informar ingresos para calcular ROAS.",
        )}
      </p>
      {isFetching && <p>{t("Carregando…", "Loading…", "Cargando…")}</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && (
        <>
          {!data.groups.length && (
            <p>
              {t(
                "Sem dados de anúncios para reconciliar.",
                "No ad data to reconcile.",
                "Sin datos de anuncios para conciliar.",
              )}
            </p>
          )}
          {!!data.groups.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {[
                      t(
                        "Moeda / atribuição",
                        "Currency / attribution",
                        "Moneda / atribución",
                      ),
                      t("Gasto", "Spend", "Gasto"),
                      t(
                        "Conversões CRM",
                        "CRM conversions",
                        "Conversiones CRM",
                      ),
                      t("Receita CRM", "CRM revenue", "Ingresos CRM"),
                      "CPA CRM",
                      "ROAS CRM",
                    ].map((label) => (
                      <th className="p-2 text-left" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((group) => (
                    <tr
                      key={`${group.accountId}:${group.currency}`}
                      className="border-t border-border/40"
                    >
                      <td className="p-2">
                        {group.currency} ·{" "}
                        {group.attributionWindow ??
                          t("Padrão", "Default", "Predeterminada")}
                        {!!group.ignoredAttributionWindows.length && (
                          <p>
                            {t(
                              "Outras janelas excluídas para evitar duplicação.",
                              "Other windows excluded to avoid duplicates.",
                              "Otras ventanas excluidas para evitar duplicados.",
                            )}
                          </p>
                        )}
                      </td>
                      <td>{money(group.spend, group.currency)}</td>
                      <td>{group.crmConversions}</td>
                      <td>{money(group.crmRevenue, group.currency)}</td>
                      <td>{money(group.cpa, group.currency)}</td>
                      <td>{group.roas?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.excludedFromPaidMetrics.map((group) => (
            <p key={group.currency} className="text-xs text-muted-foreground">
              {group.conversions} · {money(group.revenue, group.currency)} ·{" "}
              {t(
                "excluídos dos indicadores pagos por falta de vínculo válido ou de gasto na mesma moeda.",
                "excluded from paid metrics because of missing valid linkage or same-currency spend.",
                "excluidos de métricas pagadas por falta de vínculo válido o gasto en la misma moneda.",
              )}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
