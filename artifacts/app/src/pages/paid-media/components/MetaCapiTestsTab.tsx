import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
type Test = {
  id: string;
  accountId: string;
  datasetId: string;
  requestHash: string;
  status: string;
  expiresAt: string;
  summary: {
    eventName: string;
    eventSourceUrl: string;
    eventId: string;
    pixelId: string;
    matchKeyNames: string[];
    value: number | null;
    currency: string | null;
  };
  evidence: { eventsReceived?: number; errorCode?: string };
};
const root = "/api/paid-media/advanced/capi-tests";
export function MetaCapiTestsTab() {
  const t = useUiText(),
    client = useQueryClient();
  const [accountId, setAccount] = useState(""),
    [datasetId, setDataset] = useState(""),
    [code, setCode] = useState(""),
    [eventName, setEventName] = useState("Lead"),
    [consent, setConsent] = useState(false),
    [sharing, setSharing] = useState(false),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [eventSourceUrl, setSourceUrl] = useState("");
  const [matchKeys, setMatchKeys] = useState<Record<string, string>>({}),
    [value, setValue] = useState(""),
    [currency, setCurrency] = useState("BRL");
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
  const { data: datasets } = useQuery({
    queryKey: ["/api/paid-media/datasets", accountId],
    enabled: !!accountId,
    queryFn: () =>
      customFetch<{
        datasets: Array<{
          id: string;
          accountId: string;
          provider: string;
          providerDatasetId: string;
          name: string;
        }>;
      }>(`/api/paid-media/datasets?accountId=${encodeURIComponent(accountId)}`),
  });
  const { data, error } = useQuery({
    queryKey: [root],
    queryFn: () => customFetch<{ tests: Test[] }>(root),
    refetchInterval: 60000,
  });
  const submit = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      await customFetch(`${root}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await client.invalidateQueries({ queryKey: [root] });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no teste");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const field =
    "block w-full h-10 border border-border/50 bg-background px-3 text-sm";
  return (
    <section className="space-y-4" data-testid="meta-capi-tests">
      <h3>
        {t("CAPI — Test Events", "CAPI — Test Events", "CAPI — Test Events")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t(
          "Copie o código de Test Events do Events Manager. Preparar salva somente um diagnóstico criptografado, válido por 30 minutos. Enviar exige outra confirmação e política vigente da conta. Eventos de teste não entram nos relatórios, conversões ou fila de produção.",
          "Copy the Test Events code from Events Manager. Preparation only saves an encrypted diagnostic valid for 30 minutes. Sending requires another confirmation and current account policy. Test events never enter production reports, conversions or retry queues.",
          "Copia el código de Test Events de Events Manager. Preparar guarda un diagnóstico cifrado válido por 30 minutos. Enviar requiere otra confirmación y política vigente. Los eventos de prueba no entran en informes, conversiones ni colas de producción.",
        )}
      </p>
      {error && <p role="alert">{error.message}</p>}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await submit("", {
              accountId,
              datasetId,
              testEventCode: code,
              eventSourceUrl,
              eventName,
              marketingConsent: consent,
              diagnosticSharingConfirmed: sharing,
              matchKeys: Object.fromEntries(
                Object.entries(matchKeys).filter(([, value]) => value.trim()),
              ),
              ...(value !== "" ? { value: Number(value), currency } : {}),
            })
          ) {
            setCode("");
            setMatchKeys({});
            setConsent(false);
            setSharing(false);
            toast.success(
              t(
                "Preparado. Revise o resumo antes de enviar.",
                "Prepared. Review the summary before sending.",
                "Preparado. Revisa el resumen antes de enviar.",
              ),
            );
          }
        }}
      >
        <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            {t("Conta Meta", "Meta account", "Cuenta Meta")}
            <select
              className={field}
              required
              value={accountId}
              onChange={(event) => {
                setAccount(event.target.value);
                setDataset("");
              }}
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
          <label className="text-xs">
            Pixel
            <select
              className={field}
              required
              value={datasetId}
              onChange={(event) => setDataset(event.target.value)}
            >
              <option value="">{t("Selecione", "Select", "Selecciona")}</option>
              {datasets?.datasets
                .filter(
                  (row) =>
                    row.accountId === accountId && row.provider === "meta_ads",
                )
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name || row.providerDatasetId}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs">
            Test Events code
            <input
              className={field}
              required
              pattern="[A-Za-z0-9_-]{1,100}"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="text-xs">
            {t("Evento", "Event", "Evento")}
            <select
              className={field}
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            >
              {[
                "Lead",
                "CompleteRegistration",
                "PageView",
                "ViewContent",
                "AddToCart",
                "InitiateCheckout",
                "Purchase",
                "Schedule",
                "Contact",
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            {t(
              "URL HTTPS do evento de teste",
              "Test event HTTPS URL",
              "URL HTTPS del evento de prueba",
            )}
            <input
              className={field}
              required
              type="url"
              maxLength={2000}
              value={eventSourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>
          {(
            [
              ["email", "E-mail"],
              ["phone", t("Telefone E.164", "E.164 phone", "Teléfono E.164")],
              ["externalId", "External ID"],
              ["firstName", t("Nome", "First name", "Nombre")],
              ["lastName", t("Sobrenome", "Last name", "Apellido")],
              ["city", t("Cidade", "City", "Ciudad")],
              ["state", t("Estado", "State", "Estado")],
              ["postalCode", t("CEP", "Postal code", "Código postal")],
              [
                "country",
                t(
                  "País ISO, ex.: BR",
                  "ISO country, e.g. BR",
                  "País ISO, ej.: BR",
                ),
              ],
            ] as const
          ).map(([key, label]) => (
            <label className="text-xs" key={key}>
              {label}
              <input
                className={field}
                type={key === "email" ? "email" : "text"}
                maxLength={200}
                autoComplete="off"
                value={matchKeys[key] ?? ""}
                onChange={(event) =>
                  setMatchKeys((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          <label className="text-xs">
            {t(
              "Valor opcional do teste",
              "Optional test value",
              "Valor opcional de prueba",
            )}
            <input
              className={field}
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          {value !== "" && (
            <label className="text-xs">
              {t("Moeda", "Currency", "Moneda")}
              <input
                className={field}
                required
                pattern="[A-Z]{3}"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
              />
            </label>
          )}
          <label className="text-xs">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />{" "}
            {t(
              "Confirmo o consentimento para os identificadores informados.",
              "I confirm consent for these identifiers.",
              "Confirmo consentimiento para estos identificadores.",
            )}
          </label>
          <label className="text-xs">
            <input
              type="checkbox"
              required
              checked={sharing}
              onChange={(event) => setSharing(event.target.checked)}
            />{" "}
            {t(
              "Autorizo seu uso neste diagnóstico enviado à Meta.",
              "I authorize their use in this diagnostic sent to Meta.",
              "Autorizo su uso en este diagnóstico enviado a Meta.",
            )}
          </label>
          <Button
            disabled={
              !consent ||
              !sharing ||
              !(matchKeys.email || matchKeys.phone || matchKeys.externalId)
            }
          >
            {t(
              "Preparar evento de teste",
              "Prepare test event",
              "Preparar evento de prueba",
            )}
          </Button>
        </fieldset>
      </form>
      {data?.tests
        .filter((row) => !accountId || row.accountId === accountId)
        .map((row) => (
          <article
            key={row.id}
            className="text-xs space-y-2 border-t border-border/40 pt-3"
          >
            <strong>
              {row.summary.eventName} · {row.status}
            </strong>
            <p>{row.summary.eventSourceUrl}</p>
            <p>
              Pixel {row.summary.pixelId} · {row.summary.eventId}
            </p>
            <p>
              {row.summary.matchKeyNames.join(", ")} ·{" "}
              {new Date(row.expiresAt).toLocaleString()}
            </p>
            {row.summary.value != null && (
              <p>
                {row.summary.value} {row.summary.currency}
              </p>
            )}
            {row.status === "prepared" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed[row.id] ?? false}
                    onChange={(event) =>
                      setConfirmed((current) => ({
                        ...current,
                        [row.id]: event.target.checked,
                      }))
                    }
                  />{" "}
                  {t(
                    "Revisei o resumo e autorizo enviar este evento em modo de teste.",
                    "I reviewed the summary and authorize this event in test mode.",
                    "Revisé el resumen y autorizo enviar este evento en modo de prueba.",
                  )}
                </label>
                <Button
                  disabled={
                    busy ||
                    !confirmed[row.id] ||
                    Date.parse(row.expiresAt) <= Date.now()
                  }
                  onClick={() =>
                    void submit(`/${row.id}/execute`, {
                      hash: row.requestHash,
                      confirm: true,
                    })
                  }
                >
                  {t(
                    "Enviar Test Event",
                    "Send Test Event",
                    "Enviar Test Event",
                  )}
                </Button>
              </>
            )}
            {row.status === "sent_test" && (
              <p>
                {t(
                  "Recibo de teste recebido. Confira no Events Manager; isso não comprova deduplicação browser/server nem EMQ.",
                  "Test receipt received. Check Events Manager; this does not prove browser/server deduplication or EMQ.",
                  "Recibo de prueba recibido. Verifica Events Manager; no demuestra deduplicación ni EMQ.",
                )}
              </p>
            )}
            {row.status === "manual_recovery" && (
              <p>
                {t(
                  "Resposta ambígua: não repita este evento. Confira o event_id no Events Manager.",
                  "Ambiguous response: do not replay this event. Inspect its event_id in Events Manager.",
                  "Respuesta ambigua: no repitas el evento. Verifica event_id en Events Manager.",
                )}
              </p>
            )}
            {row.evidence.errorCode && <p>{row.evidence.errorCode}</p>}
          </article>
        ))}
    </section>
  );
}
