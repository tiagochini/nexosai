import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
import { Link } from "wouter";

type Form = {
  accountId: string;
  datasetId: string | null;
  objective: string;
  conversionEvent: string | null;
  amount: number;
  budgetKind: string;
  budgetMode: string;
  startTime: string | null;
  endTime: string | null;
  destinationUrl: string;
  country: string;
  ageMin: number;
  ageMax: number;
  pageId: string;
  imageUrl: string;
  message: string;
  specialCategoriesConfirmed: boolean;
};
type Account = {
  id: string;
  accountName: string;
  currency: string;
  isSelected: boolean;
};
type Dataset = {
  id: string;
  accountId: string;
  provider: string;
  providerDatasetId: string;
  name: string | null;
};
const initial: Form = {
  accountId: "",
  datasetId: null,
  objective: "OUTCOME_LEADS",
  conversionEvent: "Lead",
  amount: 0,
  budgetKind: "daily",
  budgetMode: "abo",
  startTime: null,
  endTime: null,
  destinationUrl: "",
  country: "BR",
  ageMin: 18,
  ageMax: 65,
  pageId: "",
  imageUrl: "",
  message: "",
  specialCategoriesConfirmed: false,
};

export function PaidMediaSetupPanel({
  campaignId,
  masterplan,
  onDirtyChange,
}: {
  campaignId: string;
  masterplan?: {
    id: string;
    status: string;
    contextFingerprint: string;
    version?: number;
    snapshot?: any;
  };
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useUiText(),
    queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(initial),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [newPixelId, setNewPixelId] = useState("");
  const key = ["/api/campaigns", campaignId, "paid-media-setup"];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () =>
      customFetch<{
        setup: { form: Form } | null;
        productIntakeVersionId: string | null;
      }>(`/api/campaigns/${campaignId}/masterplan/paid-media-setup`),
  });
  const { data: accounts } = useQuery({
    queryKey: ["/api/paid-media/accounts/meta_ads"],
    queryFn: () =>
      customFetch<{ accounts: Account[] }>("/api/paid-media/accounts/meta_ads"),
  });
  const { data: datasets } = useQuery({
    queryKey: ["/api/paid-media/datasets"],
    queryFn: () =>
      customFetch<{ datasets: Dataset[] }>("/api/paid-media/datasets"),
  });
  useEffect(() => {
    if (data && !initialized) {
      setForm(
        data.setup?.form ?? {
          ...initial,
          accountId:
            accounts?.accounts.find((account) => account.isSelected)?.id ?? "",
        },
      );
      setInitialized(true);
    }
  }, [data, accounts, initialized]);
  useEffect(() => {
    onDirtyChange?.(dirty || busy);
  }, [dirty, busy, onDirtyChange]);
  const update = <K extends keyof Form>(field: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };
  const field =
    "h-10 w-full border border-border/50 bg-background px-3 text-sm";
  const input = (name: keyof Form, label: string, type = "text") => (
    <label className="space-y-1 text-xs">
      <span>{label}</span>
      <input
        className={field}
        type={type}
        step={
          type === "number" ? (name === "amount" ? "0.01" : "1") : undefined
        }
        value={String(form[name] ?? "")}
        onChange={(event) =>
          update(
            name,
            (type === "number"
              ? Number(event.target.value)
              : event.target.value) as never,
          )
        }
        required
      />
    </label>
  );
  const registerPixel = async () => {
    if (!form.accountId || !/^\d+$/.test(newPixelId)) return;
    setBusy(true);
    try {
      const result = await customFetch<{ dataset: { id: string } }>(
        "/api/paid-media/datasets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "meta_ads",
            accountId: form.accountId,
            providerDatasetId: newPixelId,
            name: `Meta Pixel ${newPixelId}`,
          }),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["/api/paid-media/datasets"],
      });
      update("datasetId", result.dataset.id);
      setNewPixelId("");
      toast.success(
        t(
          "Pixel cadastrado localmente. O acesso será validado antes de criar anúncios.",
          "Pixel registered locally. Access will be checked before creating ads.",
          "Píxel registrado localmente. Se validará el acceso antes de crear anuncios.",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "Não foi possível cadastrar o pixel.",
              "Could not register pixel.",
              "No se pudo registrar el píxel.",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await customFetch(
        `/api/campaigns/${campaignId}/masterplan/paid-media-setup`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: key });
      try {
        await customFetch(
          `/api/campaigns/${campaignId}/masterplan/materialize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestApproval: true }),
          },
        );
      } catch {
        toast.warning(
          t(
            "Configuração salva. Atualize o Master Plan e resolva seus bloqueios antes de aprovar.",
            "Setup saved. Refresh the Master Plan and resolve its blockers before approval.",
            "Configuración guardada. Actualiza el Master Plan y resuelve sus bloqueos antes de aprobar.",
          ),
        );
        return;
      }
      toast.success(
        t(
          "Configuração salva em nova versão. Revise e aprove o Master Plan.",
          "Setup saved in a new version. Review and approve the Master Plan.",
          "Configuración guardada en nueva versión. Revisa y aprueba el Master Plan.",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "Não foi possível salvar.",
              "Could not save.",
              "No se pudo guardar.",
            ),
      );
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["/api/campaigns", campaignId, "masterplan"],
      });
      setBusy(false);
    }
  };
  const approve = async () => {
    if (!masterplan?.version) return;
    setBusy(true);
    try {
      await customFetch(`/api/campaigns/${campaignId}/masterplan/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: masterplan.version }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/campaigns", campaignId, "masterplan"],
      });
      toast.success(
        t(
          "Versão aprovada. Agora você pode compilar o plano de anúncios.",
          "Version approved. You can now compile the ad plan.",
          "Versión aprobada. Ahora puedes compilar el plan de anuncios.",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "Não foi possível aprovar.",
              "Could not approve.",
              "No se pudo aprobar.",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  const compile = async () => {
    if (!masterplan || !data?.productIntakeVersionId) return;
    setBusy(true);
    try {
      await customFetch("/api/paid-media/launch-plans/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          provider: "meta_ads",
          accountId: data.setup?.form.accountId,
          masterplanVersionId: masterplan.id,
          contextFingerprint: masterplan.contextFingerprint,
          productIntakeVersionId: data.productIntakeVersionId,
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/paid-media/launch-plans"],
      });
      toast.success(
        t(
          "Plano compilado. Revise a simulação e os bloqueios em Mídia paga.",
          "Plan compiled. Review the simulation and blockers in Paid Media.",
          "Plan compilado. Revisa la simulación y los bloqueos en Medios pagos.",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "Não foi possível compilar.",
              "Could not compile.",
              "No se pudo compilar.",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  const approvedSettings = masterplan?.snapshot?.strategy?.paidMedia;
  const approvedLink =
    approvedSettings?.creatives?.[0]?.object_story_spec?.link_data;
  const selectedAccount = accounts?.accounts.find(
    (account) => account.id === form.accountId,
  );
  return (
    <details
      className="border border-primary/30 bg-card/40 p-4 space-y-4"
      data-testid="paid-media-setup-panel"
    >
      <summary className="cursor-pointer font-mono text-sm font-bold">
        {t(
          "Configuração dos anúncios Meta",
          "Meta ad setup",
          "Configuración de anuncios Meta",
        )}
      </summary>
      <p className="text-xs text-muted-foreground mt-3">
        {t(
          "Preencha os dados que serão revisados no Master Plan. Salvar exige nova aprovação e não cria anúncios. O orçamento é o total diário ou do período; em ABO ele será dividido entre os públicos.",
          "Enter the settings to review in the Master Plan. Saving requires new approval and creates no ads. Budget is the daily or lifetime total; ABO splits it across audiences.",
          "Completa los datos para revisar en el Master Plan. Guardar exige nueva aprobación y no crea anuncios. El presupuesto es el total diario o del período; ABO lo divide entre públicos.",
        )}
      </p>
      {approvedSettings && (
        <div
          className="my-3 space-y-1 border border-border/40 p-3 text-xs"
          data-testid="masterplan-paid-media-summary"
        >
          <strong>
            {t(
              "Dados de anúncios da versão atual do Master Plan",
              "Ad settings in the current Master Plan version",
              "Datos de anuncios de la versión actual del Master Plan",
            )}
          </strong>
          <p>
            {String(approvedSettings.objective)} ·{" "}
            {String(approvedSettings.budget?.amount)}{" "}
            {String(approvedSettings.budget?.currency)} ·{" "}
            {String(approvedSettings.budget?.mode).toUpperCase()} ·{" "}
            {String(approvedSettings.budget?.kind)}
          </p>
          <p>{String(approvedSettings.destinationUrl)}</p>
          <p>
            Pixel: {String(approvedSettings.tracking?.pixelId ?? "—")} ·{" "}
            {String(
              approvedSettings.tracking?.conversionEvent ?? "Link clicks",
            )}
          </p>
          <p>{String(approvedLink?.message ?? "")}</p>
          <p>
            {String(approvedLink?.picture ?? approvedLink?.image_hash ?? "")}
          </p>
        </div>
      )}
      {dirty && (
        <p className="text-xs text-amber-400">
          {t(
            "Há alterações não salvas. Salve e revise a nova versão antes de aprovar.",
            "There are unsaved changes. Save and review the new version before approval.",
            "Hay cambios sin guardar. Guarda y revisa la nueva versión antes de aprobar.",
          )}
        </p>
      )}
      {isLoading ? (
        <p>{t("Carregando…", "Loading…", "Cargando…")}</p>
      ) : isError ? (
        <p role="alert">
          {t(
            "Não foi possível carregar a configuração. Atualize a página.",
            "Could not load setup. Refresh the page.",
            "No se pudo cargar. Actualiza la página.",
          )}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
          >
            <label className="space-y-1 text-xs">
              <span>
                {t(
                  "Conta autorizada",
                  "Authorized account",
                  "Cuenta autorizada",
                )}
              </span>
              <select
                className={field}
                value={form.accountId}
                required
                onChange={(event) => {
                  update("accountId", event.target.value);
                  update("datasetId", null);
                }}
              >
                <option value="">
                  {t("Selecione", "Select", "Selecciona")}
                </option>
                {accounts?.accounts
                  .filter((account) => account.isSelected)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} · {account.currency}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("Objetivo", "Objective", "Objetivo")}</span>
              <select
                className={field}
                value={form.objective}
                onChange={(event) => {
                  const objective = event.target.value;
                  update("objective", objective);
                  update(
                    "conversionEvent",
                    objective === "OUTCOME_TRAFFIC"
                      ? null
                      : objective === "OUTCOME_SALES"
                        ? "Purchase"
                        : "Lead",
                  );
                }}
              >
                <option value="OUTCOME_TRAFFIC">
                  {t(
                    "Tráfego — cliques",
                    "Traffic — clicks",
                    "Tráfico — clics",
                  )}
                </option>
                <option value="OUTCOME_LEADS">
                  {t("Leads no website", "Website leads", "Leads en el sitio")}
                </option>
                <option value="OUTCOME_SALES">
                  {t(
                    "Vendas no website",
                    "Website sales",
                    "Ventas en el sitio",
                  )}
                </option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span>Meta Pixel / Dataset</span>
              <select
                className={field}
                value={form.datasetId ?? ""}
                required={form.objective !== "OUTCOME_TRAFFIC"}
                onChange={(event) =>
                  update("datasetId", event.target.value || null)
                }
              >
                <option value="">
                  {t("Sem pixel", "No pixel", "Sin píxel")}
                </option>
                {datasets?.datasets
                  .filter(
                    (dataset) =>
                      dataset.provider === "meta_ads" &&
                      dataset.accountId === form.accountId,
                  )
                  .map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name || dataset.providerDatasetId}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span>
                {t(
                  "Evento de conversão",
                  "Conversion event",
                  "Evento de conversión",
                )}
              </span>
              <select
                className={field}
                value={form.conversionEvent ?? ""}
                disabled={form.objective === "OUTCOME_TRAFFIC"}
                onChange={(event) =>
                  update("conversionEvent", event.target.value || null)
                }
              >
                {form.objective === "OUTCOME_TRAFFIC" ? (
                  <option value="">
                    {t(
                      "Sem evento — cliques",
                      "No event — clicks",
                      "Sin evento — clics",
                    )}
                  </option>
                ) : form.objective === "OUTCOME_SALES" ? (
                  <option>Purchase</option>
                ) : (
                  <>
                    <option>Lead</option>
                    <option>CompleteRegistration</option>
                  </>
                )}
              </select>
            </label>
            {input(
              "amount",
              `${t("Orçamento total", "Total budget", "Presupuesto total")} (${selectedAccount?.currency ?? "—"})`,
              "number",
            )}
            <label className="space-y-1 text-xs">
              <span>{t("Distribuição", "Allocation", "Distribución")}</span>
              <select
                className={field}
                value={form.budgetMode}
                onChange={(event) => update("budgetMode", event.target.value)}
              >
                <option value="abo">
                  ABO — {t("por conjunto", "per ad set", "por conjunto")}
                </option>
                <option value="cbo">
                  CBO — {t("na campanha", "campaign budget", "en campaña")}
                </option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span>
                {t(
                  "Período do orçamento",
                  "Budget period",
                  "Período del presupuesto",
                )}
              </span>
              <select
                className={field}
                value={form.budgetKind}
                onChange={(event) => update("budgetKind", event.target.value)}
              >
                <option value="daily">{t("Diário", "Daily", "Diario")}</option>
                <option value="lifetime">
                  {t("Total do período", "Lifetime total", "Total del período")}
                </option>
              </select>
            </label>
            {form.budgetKind === "lifetime" && (
              <div className="grid grid-cols-2 gap-2">
                {(["startTime", "endTime"] as const).map((name, index) => (
                  <label key={name} className="space-y-1 text-xs">
                    <span>
                      {index
                        ? t("Fim", "End", "Fin")
                        : t("Início", "Start", "Inicio")}
                    </span>
                    <input
                      className={field}
                      type="datetime-local"
                      required
                      value={
                        form[name]
                          ? new Date(
                              Date.parse(form[name]!) -
                                new Date(form[name]!).getTimezoneOffset() *
                                  60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(event) =>
                        update(
                          name,
                          event.target.value
                            ? new Date(event.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            {input(
              "destinationUrl",
              t(
                "URL de destino (HTTPS)",
                "Destination URL (HTTPS)",
                "URL de destino (HTTPS)",
              ),
              "url",
            )}
            {input(
              "country",
              t(
                "País — código, ex.: BR",
                "Country code, e.g. BR",
                "Código del país, ej.: BR",
              ),
            )}
            {input(
              "ageMin",
              t("Idade mínima", "Minimum age", "Edad mínima"),
              "number",
            )}
            {input(
              "ageMax",
              t("Idade máxima", "Maximum age", "Edad máxima"),
              "number",
            )}
            {input(
              "pageId",
              t(
                "ID da Página do Facebook",
                "Facebook Page ID",
                "ID de Página de Facebook",
              ),
            )}
            {input(
              "imageUrl",
              t(
                "URL HTTPS da imagem aprovada",
                "Approved image HTTPS URL",
                "URL HTTPS de imagen aprobada",
              ),
              "url",
            )}
            <label className="space-y-1 text-xs md:col-span-2">
              <span>
                {t(
                  "Texto do anúncio para aprovação",
                  "Ad text for approval",
                  "Texto del anuncio para aprobación",
                )}
              </span>
              <textarea
                className={`${field} h-24 py-2`}
                required
                value={form.message}
                onChange={(event) => update("message", event.target.value)}
              />
            </label>
            <label className="text-xs md:col-span-2">
              <input
                type="checkbox"
                required
                checked={form.specialCategoriesConfirmed}
                onChange={(event) =>
                  update("specialCategoriesConfirmed", event.target.checked)
                }
              />{" "}
              {t(
                "Confirmo que esta campanha não pertence a categorias especiais da Meta (como moradia, emprego, produtos financeiros ou política).",
                "I confirm this campaign does not belong to Meta special ad categories (such as housing, employment, financial products or politics).",
                "Confirmo que la campaña no pertenece a categorías especiales de Meta (como vivienda, empleo, productos financieros o política).",
              )}
            </label>
          </fieldset>
          <details className="border border-border/40 p-3 text-xs">
            <summary className="cursor-pointer">
              {t(
                "Cadastrar um pixel que não aparece na lista",
                "Register a pixel missing from the list",
                "Registrar un píxel que no aparece en la lista",
              )}
            </summary>
            <p className="my-2 text-muted-foreground">
              {t(
                "Informe o ID de um Meta Pixel existente na conta escolhida. Este cadastro cria somente o vínculo local; não instala pixels nem altera ativos na Meta.",
                "Enter an existing Meta Pixel ID for the selected account. This only registers a local link; it does not install pixels or modify Meta assets.",
                "Ingresa el ID de un píxel existente en la cuenta elegida. Solo se crea el vínculo local; no instala píxeles ni modifica activos de Meta.",
              )}
            </p>
            <div className="flex gap-2">
              <input
                aria-label="Meta Pixel ID"
                inputMode="numeric"
                className={field}
                value={newPixelId}
                onChange={(event) => setNewPixelId(event.target.value.trim())}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || !form.accountId || !/^\d+$/.test(newPixelId)}
                onClick={() => void registerPixel()}
              >
                {t("Cadastrar pixel", "Register pixel", "Registrar píxel")}
              </Button>
            </div>
          </details>
          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={busy || isError}>
              {t(
                "Salvar e atualizar Master Plan",
                "Save and update Master Plan",
                "Guardar y actualizar Master Plan",
              )}
            </Button>
            {approvedSettings &&
              (masterplan?.status === "draft" ||
                masterplan?.status === "pending_approval") && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || dirty}
                  onClick={() => void approve()}
                >
                  {t(
                    "Aprovar esta versão do Master Plan",
                    "Approve this Master Plan version",
                    "Aprobar esta versión del Master Plan",
                  )}
                </Button>
              )}
            <Button
              type="button"
              variant="outline"
              disabled={
                busy ||
                dirty ||
                !data?.setup ||
                masterplan?.status !== "approved"
              }
              onClick={() => void compile()}
            >
              {t(
                "Compilar plano de anúncios",
                "Compile ad plan",
                "Compilar plan de anuncios",
              )}
            </Button>
            <Link
              className="text-sm text-primary underline self-center"
              href="/paid-media"
            >
              {t("Abrir Mídia paga", "Open Paid Media", "Abrir Medios pagos")}
            </Link>
          </div>
        </form>
      )}
    </details>
  );
}
