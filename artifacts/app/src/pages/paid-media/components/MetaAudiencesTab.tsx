import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
type Operation = {
  id: string;
  accountId: string;
  requestHash: string;
  summary: {
    name: string;
    kind: string;
    members: number;
    pixelId?: string;
    event?: string;
    retentionDays?: number;
    urlContains?: string | null;
    originAudienceId?: string;
    country?: string;
    ratio?: number;
  };
  status: string;
  providerAudienceId: string | null;
  errorCode: string | null;
  evidence: { upload?: { received: number } };
  expiresAt: string;
};
type Audience = { id: string; name: string; subtype: string };
export function MetaAudiencesTab() {
  const t = useUiText(),
    client = useQueryClient();
  const [accountId, setAccountId] = useState(""),
    [kind, setKind] = useState("website"),
    [name, setName] = useState("");
  const [pixelId, setPixelId] = useState(""),
    [originAudienceId, setOrigin] = useState(""),
    [country, setCountry] = useState("BR"),
    [ratio, setRatio] = useState(0.01),
    [retentionDays, setDays] = useState(30),
    [event, setEvent] = useState("PageView"),
    [urlContains, setUrl] = useState("");
  const [members, setMembers] = useState<unknown[]>([]),
    [fileVersion, setFileVersion] = useState(0),
    [rights, setRights] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({}),
    [recoveryIds, setRecoveryIds] = useState<Record<string, string>>({});
  const [audiences, setAudiences] = useState<Audience[]>([]),
    [after, setAfter] = useState<string | null>(null);
  const queryKey = ["/api/paid-media/audiences/operations"];
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
  const { data, error } = useQuery({
    queryKey,
    queryFn: () =>
      customFetch<{ operations: Operation[] }>(
        "/api/paid-media/audiences/operations",
      ),
    refetchInterval: busy ? false : 60_000,
  });
  const field =
    "block w-full h-10 border border-border/50 bg-background px-3 text-sm";
  const prepare = async (submit: React.FormEvent) => {
    submit.preventDefault();
    setBusy(true);
    try {
      await customFetch("/api/paid-media/audiences/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          kind,
          name,
          idempotencyKey: key,
          dataRightsConfirmed: rights,
          ...(kind === "website"
            ? {
                pixelId,
                retentionDays,
                event,
                ...(urlContains ? { urlContains } : {}),
              }
            : kind === "lookalike"
              ? { originAudienceId, country, ratio }
              : { members }),
        }),
      });
      setMembers([]);
      setFileVersion((value) => value + 1);
      setKey(crypto.randomUUID());
      setRights(false);
      await client.invalidateQueries({ queryKey });
      toast.success(
        t(
          "Preparação salva. Revise e aprove o resumo antes de executar na Meta.",
          "Prepared. Review and approve the summary before executing in Meta.",
          "Preparado. Revisa y aprueba el resumen antes de ejecutar en Meta.",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao preparar público",
      );
    } finally {
      setBusy(false);
    }
  };
  const act = async (
    row: Operation,
    action:
      | "approve"
      | "execute"
      | "rollback"
      | "recover"
      | "cancel"
      | "verify-rollback",
  ) => {
    setBusy(true);
    try {
      const result = await customFetch<Operation>(
        `/api/paid-media/audiences/operations/${row.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestHash: row.requestHash,
            confirm: true,
            ...(action === "recover"
              ? { providerAudienceId: recoveryIds[row.id] }
              : {}),
          }),
        },
      );
      await client.invalidateQueries({ queryKey });
      setConfirmed((current) => ({ ...current, [row.id]: false }));
      if (result.status === "manual_recovery" && action !== "recover")
        toast.error(
          t(
            "Operação interrompida. Confira o estado na Meta antes de recuperar ou excluir.",
            "Operation stopped. Check Meta before recovery or deletion.",
            "Operación detenida. Revisa Meta antes de recuperar o eliminar.",
          ),
        );
      else
        toast.success(
          t(
            "Operação registrada.",
            "Operation recorded.",
            "Operación registrada.",
          ),
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na operação");
    } finally {
      await client.invalidateQueries({ queryKey });
      setBusy(false);
    }
  };
  const loadAudiences = async (next = false) => {
    if (!accountId) return;
    setBusy(true);
    try {
      const result = await customFetch<{
        audiences: Audience[];
        after: string | null;
      }>(
        `/api/paid-media/audiences/accounts/${accountId}${next && after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      setAudiences((current) =>
        next ? [...current, ...result.audiences] : result.audiences,
      );
      setAfter(result.after);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao consultar Meta",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5" data-testid="meta-audiences">
      <h3>{t("Públicos Meta", "Meta audiences", "Públicos Meta")}</h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "Preparar e aprovar são ações locais. Executar cria o público na conta escolhida e, para CRM, envia somente os identificadores consentidos após hash. Isso não ativa anúncios. É necessária uma política aceita e vigente para a conta. Recebimento da lista não comprova correspondência de pessoas nem elegibilidade para entrega.",
          "Preparation and approval are local. Execution creates an audience in the selected account and, for CRM, sends only consented hashed identifiers. It does not activate ads. An accepted current account policy is required. List receipt does not prove matched people or delivery eligibility.",
          "Preparar y aprobar son acciones locales. Ejecutar crea el público y, para CRM, envía identificadores consentidos con hash. No activa anuncios. Requiere política vigente aceptada. Recepción no demuestra personas coincidentes ni elegibilidad.",
        )}
      </p>
      {error && <p role="alert">{error.message}</p>}
      <form onSubmit={prepare} className="space-y-4">
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          <label className="text-xs">
            {t("Conta autorizada", "Authorized account", "Cuenta autorizada")}
            <select
              className={field}
              required
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
                setAudiences([]);
                setAfter(null);
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
            {t("Tipo", "Type", "Tipo")}
            <select
              className={field}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setMembers([]);
                setFileVersion((value) => value + 1);
                setRights(false);
              }}
            >
              <option value="website">
                {t(
                  "Website — evento/URL",
                  "Website — event/URL",
                  "Website — evento/URL",
                )}
              </option>
              <option value="crm">
                {t(
                  "Lista CRM consentida",
                  "Consented CRM list",
                  "Lista CRM consentida",
                )}
              </option>
              <option value="lookalike">Lookalike</option>
            </select>
          </label>
          <label className="text-xs">
            {t("Nome do público", "Audience name", "Nombre del público")}
            <input
              className={field}
              required
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {kind === "website" && (
            <>
              <label className="text-xs">
                Pixel ID
                <input
                  className={field}
                  required
                  pattern="[0-9]+"
                  value={pixelId}
                  onChange={(event) => setPixelId(event.target.value)}
                />
              </label>
              <label className="text-xs">
                {t(
                  "Retenção em dias (1–180)",
                  "Retention days (1–180)",
                  "Retención en días (1–180)",
                )}
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={180}
                  required
                  value={retentionDays}
                  onChange={(event) => setDays(Number(event.target.value))}
                />
              </label>
              <label className="text-xs">
                {t("Evento", "Event", "Evento")}
                <select
                  className={field}
                  value={event}
                  onChange={(event) => setEvent(event.target.value)}
                >
                  {[
                    "PageView",
                    "Lead",
                    "CompleteRegistration",
                    "Purchase",
                    "AddToCart",
                    "InitiateCheckout",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {t(
                  "URL contém — opcional",
                  "URL contains — optional",
                  "URL contiene — opcional",
                )}
                <input
                  className={field}
                  maxLength={500}
                  value={urlContains}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </label>
            </>
          )}
          {kind === "lookalike" && (
            <>
              <label className="text-xs">
                {t(
                  "ID do público de origem",
                  "Source audience ID",
                  "ID del público de origen",
                )}
                <input
                  className={field}
                  required
                  pattern="[0-9]+"
                  value={originAudienceId}
                  onChange={(event) => setOrigin(event.target.value)}
                />
              </label>
              <label className="text-xs">
                {t("País", "Country", "País")}
                <input
                  className={field}
                  required
                  pattern="[A-Z]{2}"
                  value={country}
                  onChange={(event) =>
                    setCountry(event.target.value.toUpperCase())
                  }
                />
              </label>
              <label className="text-xs">
                {t(
                  "Proporção (0,01 = 1%)",
                  "Ratio (0.01 = 1%)",
                  "Proporción (0,01 = 1%)",
                )}
                <input
                  className={field}
                  type="number"
                  min={0.01}
                  max={0.2}
                  step={0.01}
                  required
                  value={ratio}
                  onChange={(event) => setRatio(Number(event.target.value))}
                />
              </label>
            </>
          )}
          {kind === "crm" && (
            <div className="md:col-span-2 space-y-2 text-xs">
              <label>
                {t(
                  "Arquivo JSON — até 1.000 contatos",
                  "JSON file — up to 1,000 contacts",
                  "Archivo JSON — hasta 1.000 contactos",
                )}
                <input
                  key={fileVersion}
                  className="block"
                  required
                  type="file"
                  accept=".json,application/json"
                  onChange={async (event) => {
                    setMembers([]);
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1_000_000) {
                      toast.error(
                        t(
                          "Arquivo excede 1 MB.",
                          "File exceeds 1 MB.",
                          "Archivo supera 1 MB.",
                        ),
                      );
                      return;
                    }
                    try {
                      const rows: unknown = JSON.parse(await file.text());
                      if (
                        !Array.isArray(rows) ||
                        !rows.length ||
                        rows.length > 1000
                      )
                        throw new Error();
                      setMembers(rows);
                    } catch {
                      toast.error(
                        t(
                          "Use um array JSON válido com 1 a 1.000 contatos.",
                          "Use a valid JSON array with 1–1,000 contacts.",
                          "Usa un array JSON válido con 1–1.000 contactos.",
                        ),
                      );
                    }
                  }}
                />
              </label>
              <p>
                {members.length}{" "}
                {t(
                  "contatos carregados localmente",
                  "contacts loaded locally",
                  "contactos cargados localmente",
                )}
              </p>
              <p>
                {t(
                  "Cada contato deve fornecer email e/ou phone (formato +5511999999999), marketingConsent:true, consentedAt (ISO) e consentReference. Não inclua contatos sem autorização para este uso. O arquivo é limpo da tela após preparar.",
                  "Every contact needs email and/or phone (+5511999999999), marketingConsent:true, consentedAt (ISO) and consentReference. Exclude contacts without authorization for this use. The file is cleared after preparation.",
                  "Cada contacto requiere email y/o phone (+5511999999999), marketingConsent:true, consentedAt ISO y consentReference. Excluye contactos sin autorización. El archivo se limpia al preparar.",
                )}
              </p>
            </div>
          )}
          <label className="text-xs md:col-span-2">
            <input
              type="checkbox"
              required
              checked={rights}
              onChange={(event) => setRights(event.target.checked)}
            />{" "}
            {t(
              "Confirmo os direitos sobre estes dados e autorização para criar este público. Para CRM, cada contato possui consentimento documentado para este uso.",
              "I confirm data rights and authorization to create this audience. For CRM, every contact has documented consent for this use.",
              "Confirmo derechos y autorización para crear este público. Cada contacto CRM tiene consentimiento documentado para este uso.",
            )}
          </label>
          <Button
            type="submit"
            disabled={
              !rights || !accountId || (kind === "crm" && !members.length)
            }
          >
            {t(
              "Preparar sem enviar à Meta",
              "Prepare without sending to Meta",
              "Preparar sin enviar a Meta",
            )}
          </Button>
        </fieldset>
      </form>
      <div className="space-y-2 border-t border-border/40 pt-3">
        <Button
          disabled={busy || !accountId}
          onClick={() => void loadAudiences()}
        >
          {t(
            "Consultar públicos existentes na Meta",
            "Fetch existing Meta audiences",
            "Consultar públicos existentes en Meta",
          )}
        </Button>
        {audiences.map((row) => (
          <p className="text-xs" key={row.id}>
            {row.name} · {row.subtype} · <code>{row.id}</code>
          </p>
        ))}
        {after && (
          <Button disabled={busy} onClick={() => void loadAudiences(true)}>
            {t("Carregar mais", "Load more", "Cargar más")}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {data?.operations
          .filter((row) => !accountId || row.accountId === accountId)
          .map((row) => (
            <article
              key={row.id}
              className="border border-border/40 p-3 space-y-2 text-xs"
            >
              <strong>{row.summary.name}</strong>
              <p>
                {row.summary.kind} · {row.status}
                {row.providerAudienceId
                  ? ` · ID ${row.providerAudienceId}`
                  : ""}
              </p>
              {row.summary.kind === "website" && (
                <p>
                  Pixel {row.summary.pixelId} · {row.summary.event} ·{" "}
                  {row.summary.retentionDays} {t("dias", "days", "días")} ·{" "}
                  {row.summary.urlContains
                    ? `URL: ${row.summary.urlContains}`
                    : t("Todas as URLs", "All URLs", "Todas las URLs")}
                </p>
              )}
              {row.summary.kind === "lookalike" && (
                <p>
                  {row.summary.originAudienceId} · {row.summary.country} ·{" "}
                  {(row.summary.ratio ?? 0) * 100}%
                </p>
              )}
              {row.summary.kind === "crm" && (
                <p>
                  {row.summary.members}{" "}
                  {t(
                    "linhas consentidas após deduplicação",
                    "consented rows after deduplication",
                    "filas consentidas tras deduplicar",
                  )}
                  {row.evidence.upload
                    ? ` · ${row.evidence.upload.received} ${t("recebidas, pessoas correspondentes não verificadas", "received, matched people not verified", "recibidas, personas coincidentes no verificadas")}`
                    : ""}
                </p>
              )}
              {row.errorCode && <p role="alert">{row.errorCode}</p>}
              {row.status === "draft" && (
                <Button
                  disabled={busy || Date.parse(row.expiresAt) <= Date.now()}
                  onClick={() => void act(row, "approve")}
                >
                  {t(
                    "Aprovar este resumo",
                    "Approve this summary",
                    "Aprobar este resumen",
                  )}
                </Button>
              )}
              {["draft", "approved"].includes(row.status) && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act(row, "cancel")}
                >
                  {t(
                    "Cancelar e apagar preparação",
                    "Cancel and erase preparation",
                    "Cancelar y borrar preparación",
                  )}
                </Button>
              )}
              {["approved", "ready", "manual_recovery", "failed"].includes(
                row.status,
              ) && (
                <label className="block">
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
                  {row.status === "approved"
                    ? t(
                        "Autorizo criar o público e, para CRM, enviar as linhas aprovadas à Meta.",
                        "I authorize creating this audience and sending approved CRM rows to Meta.",
                        "Autorizo crear el público y enviar filas CRM aprobadas a Meta.",
                      )
                    : t(
                        "Confirmo a recuperação/exclusão somente do público criado por esta operação.",
                        "I confirm recovery/deletion of only the audience created by this operation.",
                        "Confirmo recuperación/eliminación solo del público creado por esta operación.",
                      )}
                </label>
              )}
              {row.status === "approved" && (
                <Button
                  disabled={
                    busy ||
                    !confirmed[row.id] ||
                    Date.parse(row.expiresAt) <= Date.now()
                  }
                  onClick={() => void act(row, "execute")}
                >
                  {t("Executar na Meta", "Execute in Meta", "Ejecutar en Meta")}
                </Button>
              )}
              {row.status === "manual_recovery" && !row.providerAudienceId && (
                <div className="flex gap-2">
                  <input
                    className={field}
                    aria-label="Meta audience ID for recovery"
                    placeholder="Meta audience ID"
                    value={recoveryIds[row.id] ?? ""}
                    onChange={(event) =>
                      setRecoveryIds((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    disabled={
                      busy ||
                      !confirmed[row.id] ||
                      !/^\d+$/.test(recoveryIds[row.id] ?? "")
                    }
                    onClick={() => void act(row, "recover")}
                  >
                    {t(
                      "Conferir e vincular ID",
                      "Verify and bind ID",
                      "Verificar y vincular ID",
                    )}
                  </Button>
                </div>
              )}
              {row.providerAudienceId &&
                ["ready", "manual_recovery", "failed"].includes(row.status) && (
                  <Button
                    variant="destructive"
                    disabled={busy || !confirmed[row.id]}
                    onClick={() => void act(row, "rollback")}
                  >
                    {t(
                      "Excluir público desta operação",
                      "Delete this operation's audience",
                      "Eliminar público de esta operación",
                    )}
                  </Button>
                )}
              {row.status === "manual_recovery" && row.providerAudienceId && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act(row, "verify-rollback")}
                >
                  {t(
                    "Conferir exclusão já solicitada",
                    "Verify previously requested deletion",
                    "Verificar eliminación solicitada",
                  )}
                </Button>
              )}
              {row.status === "manual_recovery" && (
                <p>
                  {t(
                    "Não repita a criação. Confira o público na Meta. Um ID informado será aceito somente se conta, marcador e configuração coincidirem; depois, é possível excluir o público criado. Recuperação não repete upload CRM.",
                    "Do not repeat creation. Check Meta. A supplied ID must match account, marker and specification before binding; then the created audience can be deleted. Recovery never repeats a CRM upload.",
                    "No repitas la creación. Revisa Meta. El ID debe coincidir en cuenta, marcador y configuración; luego podrá eliminarse. Recuperar no repite el envío CRM.",
                  )}
                </p>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
