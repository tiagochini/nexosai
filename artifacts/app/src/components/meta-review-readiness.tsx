import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ShieldCheck,
  Server,
  Activity,
  MessageSquare,
  Key,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

type MetaReviewReadiness = {
  ready: boolean;
  generatedAt: string;
  callbackUrl: string;
  legalUrls: {
    privacy: string;
    terms: string;
    dataDeletion: string;
  };
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  permissions: Array<{
    scope: string;
    useCase: string;
    recording: string;
    status: "required" | "conditional";
  }>;
  accounts: Array<{
    id: string;
    provider: string;
    accountId: string | null;
    accountName: string | null;
    status: string;
  }>;
  evidence: Array<{
    id: string;
    eventType: string;
    actionKey: string;
    status: string;
    accountId: string;
    providerEventId: string;
    providerMessageId: string | null;
    latencyMs: number | null;
    slaStatus: string | null;
    receivedAt: string;
    sentAt: string | null;
    error: string | null;
  }>;
  conversationTurns: Array<{
    id: string;
    channel: string;
    direction: string;
    decision: string | null;
    providerStatus: string | null;
    providerEventId: string;
    providerResponseId: string | null;
    accountId: string;
    receivedAt: string;
    sentAt: string | null;
    safetyReason: string | null;
  }>;
};

function DiagnosticSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 bg-card/20 relative flex flex-col overflow-hidden">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/40 pointer-events-none" />
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2 bg-muted/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  const t = useUiText();
  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    toast.success(t("URL copiada para a área de transferência", "URL copied to clipboard", "URL copiada al portapapeles"));
  };
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/20 last:border-0">
      <div className="font-mono text-xs text-foreground/80 min-w-[90px]">
        {label}
      </div>
      <code className="font-mono text-[10px] text-muted-foreground flex-1 truncate bg-muted/30 px-2 py-1 border border-border/20">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={`${t("Copiar", "Copy", "Copiar")} ${label}`}
        className="h-7 w-7 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors rounded-none border border-border/20"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function MetaReviewReadinessPanel() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const statusText = (status: string) => ({
    pass: t("Aprovado", "Passed", "Aprobado"),
    warn: t("Aviso", "Warning", "Advertencia"),
    fail: t("Falhou", "Failed", "Fallido"),
    required: t("Obrigatória", "Required", "Obligatoria"),
    conditional: t("Condicional", "Conditional", "Condicional"),
    connected: t("Conectada", "Connected", "Conectada"),
    disconnected: t("Desconectada", "Disconnected", "Desconectada"),
    inbound: t("Entrada", "Inbound", "Entrante"),
    outbound: t("Saída", "Outbound", "Saliente"),
    under_30s: t("Abaixo de 30 s", "Under 30 s", "Menos de 30 s"),
    over_30s: t("Acima de 30 s", "Over 30 s", "Más de 30 s"),
  } as Record<string, string>)[status] ?? status;
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["/api/social/review-readiness"],
    queryFn: () => customFetch<MetaReviewReadiness>("/api/social/review-readiness"),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-none bg-muted/30" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-none bg-muted/30" />
          <Skeleton className="h-64 w-full rounded-none bg-muted/30" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 border border-destructive/30 bg-destructive/10 flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div className="font-mono text-sm text-destructive uppercase tracking-widest font-semibold">
          {t("Falha de Diagnóstico", "Diagnostic Failed", "Error de diagnóstico")}
        </div>
        <p className="font-mono text-xs text-destructive/80 mb-2">
          {t("Não foi possível carregar os dados de prontidão da API.", "Unable to load API readiness data.", "No se pudieron cargar los datos de preparación de la API.")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="rounded-none border-destructive/40 hover:bg-destructive/20 hover:text-destructive text-destructive font-mono uppercase text-[10px] tracking-widest"
        >
          {t("Tentar Novamente", "Try Again", "Intentar de nuevo")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-border/50 bg-card/40 relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-1 h-full ${
            data.ready ? "bg-primary/60" : "bg-destructive/60"
          }`}
        />
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-mono text-sm uppercase tracking-widest text-foreground font-semibold">
              Meta App Review Diagnostic
            </h3>
            <Badge
              variant="outline"
              className={`rounded-none font-mono text-[10px] tracking-widest uppercase ${
                data.ready
                  ? "border-primary/40 text-primary bg-primary/10"
                  : "border-destructive/40 text-destructive bg-destructive/10"
              }`}
            >
              {data.ready ? t("Pronto para Submissão", "Ready to Submit", "Listo para enviar") : t("Bloqueios Identificados", "Blockers Identified", "Bloqueos identificados")}
            </Badge>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">
            {t("Diagnóstico gerado em", "Diagnostic generated", "Diagnóstico generado")} {new Date(data.generatedAt).toLocaleString(dateLocale)}
          </p>
          <p className="font-mono text-[10px] text-primary/70 mt-1">
            {t("Evidências sem tokens: tokens de acesso e segredos nunca são retornados por esta tela.", "Token-free evidence: access tokens and secrets are never returned by this screen.", "Evidencias sin tokens: esta pantalla nunca devuelve tokens de acceso ni secretos.")}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            <a className="text-primary hover:underline" href={data.legalUrls.privacy} target="_blank" rel="noreferrer">{t("Política de Privacidade", "Privacy Policy", "Política de privacidad")}</a>
            <a className="text-primary hover:underline" href={data.legalUrls.terms} target="_blank" rel="noreferrer">{t("Termos de Serviço", "Terms of Service", "Términos del servicio")}</a>
            <a className="text-primary hover:underline" href={data.legalUrls.dataDeletion} target="_blank" rel="noreferrer">{t("Exclusão de dados", "Data Deletion", "Eliminación de datos")}</a>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="rounded-none font-mono uppercase text-[10px] tracking-widest shrink-0 border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <RefreshCw
            className={`h-3 w-3 mr-2 ${isRefetching ? "animate-spin" : ""}`}
          />
          {t("Sincronizar", "Sync", "Sincronizar")}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6 flex flex-col">
          <DiagnosticSection title={t("Verificações de Prontidão", "Readiness Checks", "Comprobaciones de preparación")} icon={ShieldCheck}>
            <div className="space-y-3">
              {data.checks.map((check) => (
                <div
                  key={check.key}
                  className="flex gap-3 p-2 bg-background/30 border border-border/20"
                >
                  <div className="mt-0.5 shrink-0">
                    {check.status === "pass" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {check.status === "warn" && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    {check.status === "fail" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-xs text-foreground/90 font-medium">
                      {check.label}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {check.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DiagnosticSection>

          <DiagnosticSection title={t("URLs de Configuração (App Dashboard)", "Configuration URLs (App Dashboard)", "URLs de configuración (panel de la aplicación)")} icon={Link2}>
            <UrlRow label="Callback URL" value={data.callbackUrl} />
            <UrlRow label={t("Privacidade", "Privacy", "Privacidad")} value={data.legalUrls.privacy} />
            <UrlRow label={t("Termos", "Terms", "Términos")} value={data.legalUrls.terms} />
            <UrlRow label={t("Exclusão", "Deletion", "Eliminación")} value={data.legalUrls.dataDeletion} />
          </DiagnosticSection>

          <DiagnosticSection title={t("Matriz de Permissões", "Permissions Matrix", "Matriz de permisos")} icon={Key}>
            <div className="overflow-x-auto -mx-4 -mb-4 mt-2 border-t border-border/30">
              <table className="w-full text-left font-mono text-[10px]">
                <thead className="bg-muted/10 text-muted-foreground uppercase tracking-widest border-b border-border/40">
                  <tr>
                    <th className="py-2 px-4 font-medium">{t("Escopo", "Scope", "Permiso")}</th>
                    <th className="py-2 px-4 font-medium">{t("Caso de uso / Gravação", "Use Case / Recording", "Caso de uso / Grabación")}</th>
                    <th className="py-2 px-4 font-medium">{t("Status", "Status", "Estado")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {data.permissions.map((perm) => (
                    <tr
                      key={perm.scope}
                      className="hover:bg-muted/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-primary whitespace-nowrap">
                        {perm.scope}
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="text-foreground leading-snug">
                          {perm.useCase}
                        </div>
                        <div
                          className="text-muted-foreground mt-1 truncate max-w-[240px]"
                          title={perm.recording}
                        >
                          <span className="opacity-50">{t("Grav.:", "Rec.:", "Grab.:")}</span>{" "}
                          {perm.recording}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 h-5 rounded-none border-border/40 bg-background/50"
                        >
                          {statusText(perm.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DiagnosticSection>
        </div>

        {/* Right Column */}
        <div className="space-y-6 flex flex-col">
          <DiagnosticSection title={t("Contas de Teste Conectadas", "Connected Test Accounts", "Cuentas de prueba conectadas")} icon={Server}>
            {data.accounts.length === 0 ? (
              <div className="text-center py-6 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                {t("Nenhuma conta configurada", "No accounts configured", "No hay cuentas configuradas")}
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {data.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 border border-border/30 bg-background/40"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-foreground font-medium">
                        {acc.accountName || t("Conta desconhecida", "Unknown Account", "Cuenta desconocida")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground mt-1">
                        {acc.provider.toUpperCase()} &middot;{" "}
                        {acc.accountId || acc.id}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`rounded-none text-[9px] uppercase tracking-widest ${
                        acc.status === "connected"
                          ? "border-primary/40 text-primary bg-primary/5"
                          : "border-destructive/40 text-destructive bg-destructive/5"
                      }`}
                    >
                      {statusText(acc.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </DiagnosticSection>

          <DiagnosticSection title={t("Evidência de Operação (SLA & Latência)", "Operational Evidence (SLA & Latency)", "Evidencia operativa (SLA y latencia)")} icon={Activity}>
            {data.evidence.length === 0 ? (
              <div className="text-center py-6 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                {t("Sem evidências recentes registradas", "No recent evidence recorded", "No hay evidencia reciente")}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 -mb-4 mt-2 border-t border-border/30">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="bg-muted/10 text-muted-foreground uppercase tracking-widest border-b border-border/40">
                    <tr>
                      <th className="py-2 px-4 font-medium">{t("Evento / Ação", "Event / Action", "Evento / Acción")}</th>
                      <th className="py-2 px-4 font-medium">{t("Status / SLA", "Status / SLA", "Estado / SLA")}</th>
                      <th className="py-2 px-4 font-medium">{t("Latência", "Latency", "Latencia")}</th>
                      <th className="py-2 px-4 font-medium">{t("Horários", "Timestamps", "Marcas de tiempo")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {data.evidence.map((ev) => (
                      <tr
                        key={ev.id}
                        className="hover:bg-muted/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div
                            className="text-foreground truncate max-w-[120px]"
                            title={ev.providerEventId}
                          >
                            {ev.providerEventId.slice(0, 14)}...
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {ev.eventType} &rarr; {ev.actionKey}
                          </div>
                           {ev.providerMessageId && (
                             <div className="text-muted-foreground mt-1" title={ev.providerMessageId}>
                                {t("ID de resposta:", "Response ID:", "ID de respuesta:")} {ev.providerMessageId}
                             </div>
                           )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 h-4 rounded-none border-border/40"
                            >
                               {statusText(ev.status)}
                            </Badge>
                            {ev.slaStatus && (
                              <span
                                className={
                                  ev.slaStatus === "under_30s"
                                    ? "text-primary"
                                    : "text-destructive"
                                }
                              >
                                SLA {statusText(ev.slaStatus)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {ev.latencyMs !== null ? (
                            <span className="text-primary">{ev.latencyMs}ms</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div>
                            <span className="opacity-50 mr-1">{t("Ent.:", "In:", "Ent.:")}</span>
                            {new Date(ev.receivedAt).toLocaleTimeString(dateLocale)}
                          </div>
                          {ev.sentAt && (
                            <div className="mt-1">
                              <span className="opacity-50 mr-1">{t("Saí.:", "Out:", "Sal.:")}</span>
                              {new Date(ev.sentAt).toLocaleTimeString(dateLocale)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DiagnosticSection>

          <DiagnosticSection title={t("Turnos de Conversação", "Conversation Turns", "Turnos de conversación")} icon={MessageSquare}>
            {data.conversationTurns.length === 0 ? (
              <div className="text-center py-6 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                {t("Nenhuma conversa recente registrada", "No recent conversations recorded", "No hay conversaciones recientes")}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 -mb-4 mt-2 border-t border-border/30">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="bg-muted/10 text-muted-foreground uppercase tracking-widest border-b border-border/40">
                    <tr>
                      <th className="py-2 px-4 font-medium">{t("Direção / Canal", "Direction / Channel", "Dirección / Canal")}</th>
                      <th className="py-2 px-4 font-medium">{t("Decisão / Segurança", "Decision / Safety", "Decisión / Seguridad")}</th>
                      <th className="py-2 px-4 font-medium">{t("Status do provedor", "Provider Status", "Estado del proveedor")}</th>
                      <th className="py-2 px-4 font-medium">{t("Horário", "Time", "Hora")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {data.conversationTurns.map((turn) => (
                      <tr
                        key={turn.id}
                        className="hover:bg-muted/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div
                            className={`font-semibold ${
                              turn.direction === "inbound"
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {statusText(turn.direction)}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {turn.channel}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {turn.decision ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 h-4 rounded-none border-border/40"
                            >
                              {turn.decision}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {turn.safetyReason && (
                            <div className="text-destructive mt-1 leading-snug">
                              {turn.safetyReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div>{turn.providerStatus || "—"}</div>
                          {turn.providerResponseId && (
                            <div className="mt-1" title={turn.providerResponseId}>
                              {t("ID de resposta:", "Response ID:", "ID de respuesta:")} {turn.providerResponseId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(turn.receivedAt).toLocaleTimeString(dateLocale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DiagnosticSection>
        </div>
      </div>
    </div>
  );
}
