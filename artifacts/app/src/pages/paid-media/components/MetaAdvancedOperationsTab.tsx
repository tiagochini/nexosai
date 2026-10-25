import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
type Sync = {
  id: string;
  accountId: string;
  sequenceId: string;
  audienceId: string;
  configurationHash: string;
  enabled: boolean;
  status: string;
  expiresAt: string;
  errorCode: string | null;
  evidence: { added?: number; removed?: number; retained?: number };
};
type Experiment = {
  id: string;
  configurationHash: string;
  status: string;
  providerStudyId: string | null;
  configuration: {
    name: string;
    businessId: string;
    adA: string;
    adB: string;
    startAt: string;
    endAt: string;
  };
  evidence: Record<string, unknown>;
};
export function MetaAdvancedOperationsTab() {
  const t = useUiText(),
    client = useQueryClient(),
    root = "/api/paid-media/advanced";
  const [accountId, setAccount] = useState(""),
    [sequenceId, setSequence] = useState(""),
    [seedOperationId, setSeed] = useState(""),
    [expiresAt, setExpiry] = useState("");
  const [contactId, setContact] = useState(""),
    [consentedAt, setConsentTime] = useState(""),
    [consentReference, setReference] = useState(""),
    [consentConfirmed, setConsentConfirmed] = useState(false);
  const [name, setName] = useState(""),
    [businessId, setBusiness] = useState(""),
    [adA, setA] = useState(""),
    [adB, setB] = useState(""),
    [startAt, setStart] = useState(""),
    [endAt, setEnd] = useState("");
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState<Record<string, boolean>>({}),
    [studyIds, setStudyIds] = useState<Record<string, string>>({}),
    [inspection, setInspection] = useState<Record<string, any>>({});
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
  const { data: seeds } = useQuery({
    queryKey: ["/api/paid-media/audiences/operations"],
    queryFn: () =>
      customFetch<{
        operations: Array<{
          id: string;
          accountId: string;
          status: string;
          summary: { name: string; syncSeed?: boolean };
        }>;
      }>("/api/paid-media/audiences/operations"),
  });
  const { data: syncs, error: syncError } = useQuery({
    queryKey: [root, "crm-syncs"],
    queryFn: () => customFetch<{ syncs: Sync[] }>(`${root}/crm-syncs`),
    refetchInterval: 60000,
  });
  const { data: experiments, error: experimentError } = useQuery({
    queryKey: [root, "experiments"],
    queryFn: () =>
      customFetch<{ experiments: Experiment[] }>(`${root}/experiments`),
    refetchInterval: 60000,
  });
  const submit = async (path: string, body?: unknown, read = false) => {
    setBusy(true);
    try {
      const result = await customFetch<any>(
        `${root}/${path}`,
        read
          ? undefined
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
      );
      await client.invalidateQueries({ queryKey: [root] });
      toast.success(
        read
          ? t(
              "Registro conferido e métricas comparativas consultadas.",
              "Registration checked and comparative metrics retrieved.",
              "Registro verificado y métricas comparativas consultadas.",
            )
          : t(
              "Operação registrada.",
              "Operation recorded.",
              "Operación registrada.",
            ),
      );
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na operação");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const field =
    "block w-full h-10 border border-border/50 bg-background px-3 text-sm";
  const text = (
    label: string,
    value: string,
    set: (value: string) => void,
    type = "text",
    required = true,
  ) => (
    <label className="text-xs">
      {label}
      <input
        className={field}
        type={type}
        required={required}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
  const confirm = (key: string, label: string) => (
    <label className="block text-xs">
      <input
        type="checkbox"
        checked={confirmed[key] ?? false}
        onChange={(event) =>
          setConfirmed((current) => ({
            ...current,
            [key]: event.target.checked,
          }))
        }
      />{" "}
      {label}
    </label>
  );
  return (
    <section className="space-y-6" data-testid="meta-advanced-operations">
      <h3>
        {t(
          "CRM recorrente e Experimentos",
          "Recurring CRM and Experiments",
          "CRM recurrente y Experimentos",
        )}
      </h3>
      <label className="text-xs">
        {t(
          "Conta Meta autorizada",
          "Authorized Meta account",
          "Cuenta Meta autorizada",
        )}
        <select
          className={field}
          value={accountId}
          onChange={(event) => {
            setAccount(event.target.value);
            setSeed("");
          }}
        >
          <option value="">{t("Selecione", "Select", "Selecciona")}</option>
          {accounts?.accounts
            .filter((account) => account.isSelected)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountName}
              </option>
            ))}
        </select>
      </label>
      {(syncError || experimentError) && (
        <p role="alert">{syncError?.message ?? experimentError?.message}</p>
      )}
      <section className="border border-border/40 p-3 space-y-3">
        <h4>
          {t(
            "Consentimento específico para públicos Meta",
            "Specific Meta audience consent",
            "Consentimiento específico para públicos Meta",
          )}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t(
            "Cadastros e consentimentos de contato não autorizam compartilhamento de CRM. Registre a evidência deste uso por contato. Alterações de e-mail/telefone exigem nova autorização. Revogações e descadastros saem no próximo ciclo autorizado; se a sincronização estiver pausada ou bloqueada, a remoção fica pendente.",
            "Registration/contact consent does not authorize CRM sharing. Record evidence per contact. Changed identifiers need renewed consent. Revocations/unsubscribes are removed in the next authorized cycle; paused/blocked sync leaves removal pending.",
            "El consentimiento de contacto no autoriza compartir CRM. Registra evidencia por contacto. Nuevos identificadores requieren nuevo consentimiento. Revocaciones se retiran en el siguiente ciclo autorizado; si está pausado/bloqueado, quedan pendientes.",
          )}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await submit("crm-consents", {
              contactId,
              granted: true,
              consentedAt: new Date(consentedAt).toISOString(),
              consentReference,
              metaAudienceSharingConfirmed: consentConfirmed,
            });
            if (result) {
              setReference("");
              setConsentConfirmed(false);
            }
          }}
        >
          <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
            {text(
              t(
                "UUID do contato no CRM",
                "CRM contact UUID",
                "UUID del contacto CRM",
              ),
              contactId,
              setContact,
            )}
            {text(
              t(
                "Data do consentimento",
                "Consent date",
                "Fecha de consentimiento",
              ),
              consentedAt,
              setConsentTime,
              "datetime-local",
            )}
            {text(
              t(
                "Referência documental",
                "Evidence reference",
                "Referencia documental",
              ),
              consentReference,
              setReference,
            )}
            <label className="text-xs">
              <input
                type="checkbox"
                required
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
              />{" "}
              {t(
                "Confirmo autorização para compartilhar identificadores deste contato com públicos Meta.",
                "I confirm authorization to share this contact's identifiers with Meta audiences.",
                "Confirmo autorización para compartir identificadores con públicos Meta.",
              )}
            </label>
            <Button disabled={!consentConfirmed}>
              {t(
                "Registrar consentimento",
                "Record consent",
                "Registrar consentimiento",
              )}
            </Button>
          </fieldset>
        </form>
        <Button
          variant="outline"
          disabled={busy || !contactId}
          onClick={() =>
            void submit("crm-consents", {
              contactId,
              granted: false,
              metaAudienceSharingConfirmed: true,
            })
          }
        >
          {t(
            "Revogar autorização deste contato",
            "Revoke this contact's authorization",
            "Revocar autorización del contacto",
          )}
        </Button>
      </section>
      <section className="border border-border/40 p-3 space-y-3">
        <h4>
          {t(
            "Sincronização contínua de CRM",
            "Continuous CRM synchronization",
            "Sincronización continua CRM",
          )}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t(
            "Crie e execute uma semente vazia em Públicos Meta. Prepare o vínculo com uma sequência de até 1.000 contatos e validade de até 30 dias. Somente uma autorização posterior habilita o worker; a política da conta também deve permitir execução automática. Remoções precedem inclusões. Não há repetição automática de chamadas ambíguas.",
            "Create/execute an empty seed in Meta audiences. Prepare a sequence with up to 1,000 contacts and authorization up to 30 days. A later authorization enables the worker; account policy must also allow automatic execution. Removals precede additions. Ambiguous calls are never replayed.",
            "Crea/ejecuta una semilla vacía en Públicos Meta. Prepara secuencia de hasta 1.000 contactos y vigencia hasta 30 días. Otra autorización habilita el worker y requiere política automática. Las bajas preceden altas. No se repiten llamadas ambiguas.",
          )}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await submit("crm-syncs", {
              accountId,
              sequenceId,
              seedOperationId,
              expiresAt: new Date(expiresAt).toISOString(),
            });
          }}
        >
          <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
            {text(
              t("UUID da sequência", "Sequence UUID", "UUID de secuencia"),
              sequenceId,
              setSequence,
            )}
            <label className="text-xs">
              {t(
                "Semente vazia confirmada",
                "Confirmed empty seed",
                "Semilla vacía confirmada",
              )}
              <select
                className={field}
                required
                value={seedOperationId}
                onChange={(event) => setSeed(event.target.value)}
              >
                <option value="">
                  {t("Selecione", "Select", "Selecciona")}
                </option>
                {seeds?.operations
                  .filter(
                    (row) =>
                      row.accountId === accountId &&
                      row.status === "ready" &&
                      row.summary.syncSeed,
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.summary.name}
                    </option>
                  ))}
              </select>
            </label>
            {text(
              t("Autorização até", "Authorized until", "Autorizado hasta"),
              expiresAt,
              setExpiry,
              "datetime-local",
            )}
            <Button disabled={!accountId}>
              {t(
                "Preparar sincronização desativada",
                "Prepare disabled sync",
                "Preparar sincronización desactivada",
              )}
            </Button>
          </fieldset>
        </form>
        {syncs?.syncs
          .filter((row) => !accountId || row.accountId === accountId)
          .map((row) => (
            <article
              key={row.id}
              className="border-t border-border/40 pt-3 space-y-2 text-xs"
            >
              <p>
                {row.sequenceId} → {row.audienceId} · {row.status} ·{" "}
                {new Date(row.expiresAt).toLocaleString()}
              </p>
              <p>
                {t("Último ciclo", "Last cycle", "Último ciclo")}: +
                {row.evidence.added ?? 0} / −{row.evidence.removed ?? 0} ·{" "}
                {row.errorCode ?? ""}
              </p>
              {confirm(
                row.id,
                t(
                  "Autorizo os próximos ciclos de envio/remoção dos contatos com consentimento específico, até a data exibida.",
                  "I authorize upcoming upload/removal cycles for specifically consented contacts until the displayed date.",
                  "Autorizo ciclos de envío/baja de contactos consentidos hasta la fecha indicada.",
                ),
              )}
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !confirmed[row.id] ||
                  row.status === "blocked" ||
                  Date.parse(row.expiresAt) <= Date.now()
                }
                onClick={() =>
                  void submit(`crm-syncs/${row.id}/authorization`, {
                    hash: row.configurationHash,
                    confirm: true,
                    enabled: !row.enabled,
                  })
                }
              >
                {row.enabled
                  ? t(
                      "Pausar próximos ciclos",
                      "Pause upcoming cycles",
                      "Pausar ciclos",
                    )
                  : t(
                      "Autorizar sincronização recorrente",
                      "Authorize recurring sync",
                      "Autorizar sincronización recurrente",
                    )}
              </Button>
              {row.status === "blocked" && (
                <p>
                  {t(
                    "Não repita o lote. Confira o público na Meta e use uma nova semente após resolver a operação interrompida.",
                    "Do not replay the batch. Inspect Meta and use a new seed after resolving the interrupted operation.",
                    "No repitas el lote. Revisa Meta y usa nueva semilla tras resolver la operación.",
                  )}
                </p>
              )}
            </article>
          ))}
      </section>
      <section className="border border-border/40 p-3 space-y-3">
        <h4>Meta Experiments — A/B</h4>
        <p className="text-xs text-muted-foreground">
          {t(
            "Estudo SPLIT_TEST com dois anúncios sincronizados da mesma conta, divisão 50/50 e período futuro de até 30 dias. Aprovar não registra na Meta; executar apenas registra o estudo, mantendo anúncios pausados. Não há promessa de significância nem escolha automática de vencedor.",
            "SPLIT_TEST with two synchronized ads in the same account, 50/50 allocation and a future period up to 30 days. Approval is local; execution registers the study without activating ads. Statistical significance and an automatic winner are not promised.",
            "SPLIT_TEST con dos anuncios sincronizados de la misma cuenta, división 50/50 y período futuro hasta 30 días. Aprobar es local; ejecutar registra sin activar anuncios. No se promete significancia ni ganador automático.",
          )}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await submit("experiments", {
              accountId,
              name,
              businessId,
              adA,
              adB,
              startAt: new Date(startAt).toISOString(),
              endAt: new Date(endAt).toISOString(),
            });
          }}
        >
          <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
            {text(t("Nome", "Name", "Nombre"), name, setName)}
            {text("Business ID", businessId, setBusiness)}
            {text("Meta Ad ID — A", adA, setA)}
            {text("Meta Ad ID — B", adB, setB)}
            {text(
              t("Início", "Start", "Inicio"),
              startAt,
              setStart,
              "datetime-local",
            )}
            {text(t("Fim", "End", "Fin"), endAt, setEnd, "datetime-local")}
            <Button disabled={!accountId}>
              {t(
                "Preparar desenho A/B",
                "Prepare A/B design",
                "Preparar diseño A/B",
              )}
            </Button>
          </fieldset>
        </form>
        {experiments?.experiments.map((row) => (
          <article
            key={row.id}
            className="text-xs border-t border-border/40 pt-3 space-y-2"
          >
            <strong>{row.configuration.name}</strong>
            <p>
              {row.status} · {row.providerStudyId ?? "—"}
            </p>
            <p>
              {row.configuration.adA} / {row.configuration.adB} · 50/50 ·{" "}
              {new Date(row.configuration.startAt).toLocaleString()} →{" "}
              {new Date(row.configuration.endAt).toLocaleString()}
            </p>
            {confirm(
              row.id,
              t(
                "Revisei os anúncios, a divisão e o período; confirmo esta operação sobre o estudo.",
                "I reviewed the ads, allocation and dates and confirm this study operation.",
                "Revisé anuncios, división y fechas y confirmo la operación.",
              ),
            )}
            <div className="flex flex-wrap gap-2">
              {row.status === "draft" && (
                <Button
                  disabled={busy || !confirmed[row.id]}
                  onClick={() =>
                    void submit(`experiments/${row.id}/approve`, {
                      hash: row.configurationHash,
                      confirm: true,
                    })
                  }
                >
                  {t("Aprovar desenho", "Approve design", "Aprobar diseño")}
                </Button>
              )}
              {row.status === "approved" && (
                <Button
                  disabled={busy || !confirmed[row.id]}
                  onClick={() =>
                    void submit(`experiments/${row.id}/execute`, {
                      hash: row.configurationHash,
                      confirm: true,
                    })
                  }
                >
                  {t(
                    "Registrar na Meta",
                    "Register in Meta",
                    "Registrar en Meta",
                  )}
                </Button>
              )}
              {[
                "draft",
                "approved",
                "ready",
                "failed",
                "manual_recovery",
              ].includes(row.status) && (
                <Button
                  variant="outline"
                  disabled={busy || !confirmed[row.id]}
                  onClick={() =>
                    void submit(`experiments/${row.id}/cancel`, {
                      hash: row.configurationHash,
                      confirm: true,
                    })
                  }
                >
                  {t(
                    "Cancelar somente o estudo",
                    "Cancel study only",
                    "Cancelar solo el estudio",
                  )}
                </Button>
              )}
              {row.providerStudyId && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void submit(
                      `experiments/${row.id}/inspection`,
                      undefined,
                      true,
                    ).then(result => { if (result) setInspection(current => ({ ...current, [row.id]: result })); })
                  }
                >
                  {t(
                    "Conferir registro",
                    "Inspect registration",
                    "Verificar registro",
                  )}
                </Button>
              )}
              {row.status === "manual_recovery" && row.providerStudyId && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void submit(`experiments/${row.id}/verify-deletion`, {
                      hash: row.configurationHash,
                      confirm: true,
                    })
                  }
                >
                  {t(
                    "Conferir exclusão solicitada",
                    "Verify requested deletion",
                    "Verificar eliminación solicitada",
                  )}
                </Button>
              )}
            </div>
            {(inspection[row.id]?.comparison ?? row.evidence?.["comparison"]) && <div className="rounded border border-border/40 p-3 space-y-1">
              {(() => { const comparison = inspection[row.id]?.comparison ?? row.evidence?.["comparison"] as any; return <>
              <strong>{t("Comparação descritiva (sem declaração estatística de vencedor)", "Descriptive comparison (no statistical winner declaration)", "Comparación descriptiva (sin declarar ganador estadístico)")}</strong>
              <p>{t("Anúncio A", "Ad A", "Anuncio A")}: {JSON.stringify(comparison.A)} </p>
              <p>{t("Anúncio B", "Ad B", "Anuncio B")}: {JSON.stringify(comparison.B)}</p>
              <p className="text-muted-foreground">{comparison.note}</p>
              </>; })()}
            </div>}
            {row.status === "manual_recovery" && !row.providerStudyId && (
              <div className="flex gap-2">
                <input
                  className={field}
                  placeholder="Meta Study ID"
                  aria-label="Meta Study ID"
                  value={studyIds[row.id] ?? ""}
                  onChange={(event) =>
                    setStudyIds((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                />
                <Button
                  disabled={busy || !confirmed[row.id]}
                  onClick={() =>
                    void submit(`experiments/${row.id}/recover`, {
                      hash: row.configurationHash,
                      confirm: true,
                      studyId: studyIds[row.id],
                    })
                  }
                >
                  {t(
                    "Vincular ID conferido",
                    "Bind verified ID",
                    "Vincular ID verificado",
                  )}
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
