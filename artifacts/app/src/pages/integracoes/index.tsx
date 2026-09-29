import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Link2, AlertTriangle,
  Wifi, WifiOff, Plug,
} from "lucide-react";
import {
  ConnectModal, INTEGRATION_CATALOG, INTEGRATION_CATEGORIES,
  type Provider, type CatalogEntry, type WorkspaceIntegration,
} from "@/components/integration-connect-modal";
import { OnboardingAgent } from "@/components/onboarding-agent";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import { IntegrationWizard } from "@/components/integration-wizard";
import { IntegrationChatPanel } from "@/components/integration-chat-panel";
import { useUiText } from "@/lib/i18n";

export default function IntegracoesPage() {
  const t = useUiText();
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<CatalogEntry | null>(null);

  // Handle mobile OAuth redirect-mode return: the server redirects to
  // /integracoes?oauth_connected=instagram  (success)
  // /integracoes?oauth_error=<message>       (failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("oauth_connected");
    const errMsg   = params.get("oauth_error");

    if (connected || errMsg) {
      // Clean the URL immediately so the toast doesn't re-fire on refresh
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      if (connected) {
        toast.success(t(`${connected.charAt(0).toUpperCase() + connected.slice(1)} conectado com sucesso!`, `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`, `¡${connected.charAt(0).toUpperCase() + connected.slice(1)} conectado correctamente!`));
        // Refresh the integrations list so the connected status appears
        void queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      } else if (errMsg) {
        toast.error(t(`Falha ao conectar: ${errMsg}`, `Connection failed: ${errMsg}`, `Error al conectar: ${errMsg}`));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  type TestResultRow = { label: string; value: string; status?: "ok" | "warn" | "error" };
  type TestResult = { valid: boolean; detail?: string; error?: string; validationSkipped?: boolean; rows?: TestResultRow[]; accountName?: string; profilePictureUrl?: string };
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const handleTestConnection = async (integrationId: string) => {
    setTesting(integrationId);
    setTestResults(prev => { const n = { ...prev }; delete n[integrationId]; return n; });
    try {
      const result = await customFetch<TestResult>(
        `/api/workspaces/me/integrations/${integrationId}/test`,
        { method: "POST" },
      );
      setTestResults(prev => ({ ...prev, [integrationId]: result }));
      // Auto-clear success after 8s; keep error until next action
      if (result.valid) setTimeout(() => setTestResults(p => { const n = { ...p }; delete n[integrationId]; return n; }), 8000);
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [integrationId]: { valid: false, error: err instanceof Error ? err.message : t("Erro ao testar conexão.", "Connection test failed.", "Error al probar la conexión.") },
      }));
    } finally {
      setTesting(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      return customFetch<{ integrations: WorkspaceIntegration[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as WorkspaceIntegration[] }));
    },
    staleTime: 30_000,
  });

  const { data: oauthStatus } = useQuery({
    queryKey: ["/api/integrations/oauth/providers"],
    queryFn: async () => {
      return customFetch<{ providers: Record<string, boolean> }>("/api/integrations/oauth/providers")
        .catch(() => ({ providers: {} as Record<string, boolean> }));
    },
    staleTime: 300_000,
  });

  const oauthProviders = oauthStatus?.providers ?? {};
  const integrations = data?.integrations ?? [];
  const connectedProviders = integrations.filter(i => i.status === "connected").map(i => i.provider);

  // Build connected map — facebook shares the instagram token/record in DB
  const connectedMap = new Map(
    integrations.filter(i => i.status === "connected").map(i => [i.provider, i])
  );
  // When instagram is connected, facebook is also effectively connected (same Meta OAuth)
  if (connectedMap.has("instagram") && !connectedMap.has("facebook")) {
    connectedMap.set("facebook", connectedMap.get("instagram")!);
  }

  const hasMessaging = ["whatsapp_business", "telegram"].some(p => connectedMap.has(p as Provider));
  const hasEmail = ["rd_station", "activecampaign", "resend"].some(p => connectedMap.has(p as Provider));
  const isFullAuto = hasMessaging && hasEmail;
  const connectedCount = integrations.filter(i => i.status === "connected").length;

  const connectMutation = useMutation({
    mutationFn: async ({ provider, fields }: { provider: Provider; fields: Record<string, string> }) => {
      return customFetch<unknown>("/api/workspaces/me/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          accountId: fields["accountId"],
          accountName: fields["accountName"],
          accessToken: fields["accessToken"],
          metadata: fields,
        }),
      });
    },
    onSuccess: () => {
      toast.success(t("Integração conectada com sucesso.", "Integration connected successfully.", "Integración conectada correctamente."));
      setConnectModal(null);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      await customFetch<unknown>(`/api/social/accounts/${integrationId}`, { method: "DELETE" });
      toast.success(t("Integração removida.", "Integration removed.", "Integración eliminada."));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    } catch {
      toast.error(t("Erro ao desconectar.", "Failed to disconnect.", "Error al desconectar."));
    } finally {
      setDisconnecting(null);
    }
  };

  const openConnectModal = (providerOrId: string) => {
    const entry = INTEGRATION_CATALOG.find(e => e.provider === providerOrId);
    if (entry) setConnectModal(entry);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold uppercase tracking-tighter text-foreground">
          {t("Integrações", "Integrations", "Integraciones")}
        </h1>
        <p className="text-sm font-mono text-muted-foreground/60 mt-1">
          {t("Conecte seus canais para ativar o modo Full Auto — disparos automáticos durante o lançamento.", "Connect your channels to enable Full Auto—automated messages during your launch.", "Conecta tus canales para activar Full Auto: mensajes automáticos durante el lanzamiento.")}
        </p>
      </div>

      <FeatureOnboarding
        featureKey={FEATURE_KEYS.INTEGRATIONS}
        title={t("INTEGRAÇÕES & FULL AUTO", "INTEGRATIONS & FULL AUTO", "INTEGRACIONES Y FULL AUTO")}
        description={t("Conecte seus canais para que a NexOS opere de forma autônoma. Sem integrações, a operação será manual durante o lançamento.", "Connect your channels so NexOS can run autonomously. Without integrations, launch operations remain manual.", "Conecta tus canales para que NexOS opere de forma autónoma. Sin integraciones, la operación del lanzamiento será manual.")}
        variant="banner"
        steps={[
          t("WhatsApp Business ou Telegram — sequências automáticas e respostas dos agentes", "WhatsApp Business or Telegram—automated sequences and agent replies", "WhatsApp Business o Telegram: secuencias automáticas y respuestas de agentes"),
          t("RD Station ou ActiveCampaign — e-mails segmentados por temperatura", "RD Station or ActiveCampaign—emails segmented by lead temperature", "RD Station o ActiveCampaign: correos segmentados por temperatura del lead"),
          t("Meta Ads / Google Ads — ROAS e métricas em tempo real", "Meta Ads / Google Ads—ROAS and real-time metrics", "Meta Ads / Google Ads: ROAS y métricas en tiempo real"),
          t("Hotmart / Kiwify — captura automática de vendas e conversão de leads", "Hotmart / Kiwify—automatic sales capture and lead conversion", "Hotmart / Kiwify: captura automática de ventas y conversión de leads"),
        ]}
      />

      {/* Onboarding Agent */}
      <OnboardingAgent
        connectedProviders={connectedProviders}
        onConnect={openConnectModal}
      />

      {/* Full Auto status bar */}
      <div className={`border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isFullAuto ? "border-success/30 bg-success/5" : "border-yellow-400/25 bg-yellow-400/5"
      }`}>
        <div className="flex items-center gap-3">
          {isFullAuto
            ? <Wifi className="h-5 w-5 text-success shrink-0" />
            : <WifiOff className="h-5 w-5 text-yellow-400 shrink-0" />}
          <div>
            <div className={`font-mono font-bold uppercase tracking-widest text-sm ${isFullAuto ? "text-success" : "text-yellow-400"}`}>
              {isFullAuto ? t("Full Auto — Pronto para lançar", "Full Auto — Ready to launch", "Full Auto — Listo para lanzar") : t("Modo parcial — Configure para lançar", "Partial mode — Configure to launch", "Modo parcial — Configura para lanzar")}
            </div>
            <div className="text-xs font-mono text-muted-foreground/60 mt-0.5">
              {isFullAuto
                ? t(`${connectedCount} integrações ativas. Todos os disparos automáticos ativados.`, `${connectedCount} active integrations. All automated messages are enabled.`, `${connectedCount} integraciones activas. Todos los mensajes automáticos están habilitados.`)
                : t(`Conecte ${!hasMessaging ? "um canal de mensagens" : ""}${!hasMessaging && !hasEmail ? " e " : ""}${!hasEmail ? "um canal de e-mail" : ""} para lançar campanhas.`, `Connect ${!hasMessaging ? "a messaging channel" : ""}${!hasMessaging && !hasEmail ? " and " : ""}${!hasEmail ? "an email channel" : ""} to launch campaigns.`, `Conecta ${!hasMessaging ? "un canal de mensajes" : ""}${!hasMessaging && !hasEmail ? " y " : ""}${!hasEmail ? "un canal de correo" : ""} para lanzar campañas.`)}
            </div>
          </div>
        </div>
        {!isFullAuto && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {!hasMessaging && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />{t("Mensagens — obrigatório para lançar", "Messaging — required to launch", "Mensajería — obligatorio para lanzar")}
              </Badge>
            )}
            {!hasEmail && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />{t("E-mail — obrigatório para lançar", "Email — required to launch", "Correo — obligatorio para lanzar")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Integration catalog grouped by category */}
      {isLoading ? (
        <div className="space-y-8">
          {[0, 1].map(g => (
            <div key={g} className="space-y-3">
              <Skeleton className="h-4 w-32 bg-muted/20" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[0, 1, 2].map(c => (
                  <Skeleton key={c} className="h-24 w-full bg-muted/20" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {INTEGRATION_CATEGORIES.map(cat => {
            const items = INTEGRATION_CATALOG.filter(c => c.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40">{cat}</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="space-y-2">
                  {items.map(entry => {
                    const isConn = connectedMap.has(entry.provider);
                    const integration = connectedMap.get(entry.provider);
                    const Icon = entry.icon;
                    return (
                      <div
                        key={entry.provider}
                        className={`border flex flex-col sm:flex-row sm:items-center gap-4 p-4 transition-all ${
                          isConn
                            ? "border-success/30 bg-success/5"
                            : entry.required
                            ? "border-yellow-400/25 bg-yellow-400/5"
                            : "border-border/50 bg-card/30"
                        }`}
                      >
                        {/* Icon + name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-8 w-8 border flex items-center justify-center shrink-0 ${isConn ? "border-success/30 bg-success/10" : "border-border/40 bg-muted/20"}`}>
                            <Icon className={`h-4 w-4 ${isConn ? "text-success" : entry.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-sm">{entry.label}</span>
                              {entry.required && !isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 rounded-none px-1.5 py-0">{t("obrigatório", "required", "obligatorio")}</Badge>
                              )}
                              {isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-success/40 text-success rounded-none px-1.5 py-0 gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />{t("conectado", "connected", "conectado")}
                                </Badge>
                              )}
                              {/* Facebook note: shares Instagram connection */}
                              {entry.provider === "facebook" && isConn && (
                                <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">via Meta</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
                            {isConn && integration && (() => {
                              const meta = integration.metadata;
                              // Use server-side proxy for the profile picture so it loads
                              // on all devices regardless of Facebook CDN geographic routing.
                              const hasProfilePic = !!(meta?.igProfilePictureUrl);
                              const profilePicProxy = hasProfilePic
                                ? `/api/workspaces/me/integrations/${integration.id}/profile-picture`
                                : null;
                              const username = meta?.igUsername;
                              const followers = meta?.igFollowersCount;
                              const mediaCount = meta?.igMediaCount;
                              const hasIgData = hasProfilePic || username || followers !== undefined;
                              if (!hasIgData && !integration.accountName) return null;
                              return (
                                <div className="flex items-center gap-2 mt-1.5">
                                  {profilePicProxy ? (
                                    <img
                                      src={profilePicProxy}
                                      alt="Instagram profile"
                                      className="w-8 h-8 rounded-full border border-success/40 object-cover shrink-0"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border border-success/30 bg-success/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-mono text-success/60">
                                        {(integration.accountName ?? "?")[0].toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    {integration.accountName && (
                                      <p className="text-[10px] font-mono text-success/80 truncate leading-tight">
                                        {integration.accountName}
                                      </p>
                                    )}
                                    {username && integration.accountName !== `@${username}` && (
                                      <p className="text-[10px] font-mono text-success/50 truncate leading-tight">
                                        @{username}
                                      </p>
                                    )}
                                    {(followers !== undefined || mediaCount !== undefined) && (
                                      <p className="text-[9px] font-mono text-muted-foreground/50 leading-tight mt-0.5">
                                        {followers !== undefined && `${followers.toLocaleString("pt-BR")} seguidores`}
                                        {followers !== undefined && mediaCount !== undefined && " · "}
                                        {mediaCount !== undefined && `${mediaCount.toLocaleString("pt-BR")} posts`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {isConn ? (
                            <>
                              {/* Test result panel — expands below the card when rows exist */}
                              {integration && testResults[integration.id] && (() => {
                                const tr = testResults[integration.id];
                                const hasRows = tr.rows && tr.rows.length > 0;
                                const isExpanded = expandedTest === integration.id;
                                return (
                                  <div className="w-full mt-1">
                                    {/* Summary line — always visible */}
                                    <button
                                      onClick={() => hasRows && setExpandedTest(isExpanded ? null : integration.id)}
                                      className={`w-full text-left font-mono text-[10px] flex items-center gap-1.5 leading-tight py-1 px-2 border ${
                                        tr.valid
                                          ? "border-success/30 bg-success/5 text-success"
                                          : "border-destructive/30 bg-destructive/5 text-destructive"
                                      } ${hasRows ? "cursor-pointer hover:bg-success/10" : ""}`}
                                    >
                                      {tr.valid
                                        ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                                        : <XCircle className="h-3 w-3 shrink-0" />}
                                      <span className="flex-1 truncate">
                                        {tr.valid
                                          ? (tr.accountName ? `✓ ${t("Conta", "Account", "Cuenta")}: ${tr.accountName}` : t("Conexão verificada", "Connection verified", "Conexión verificada"))
                                          : (tr.error ?? t("Falha na conexão", "Connection failed", "Error de conexión"))}
                                      </span>
                                      {hasRows && (
                                        <span className="text-[9px] opacity-50 shrink-0">{isExpanded ? "▲" : "▼"} {t("detalhes", "details", "detalles")}</span>
                                      )}
                                    </button>

                                    {/* Expanded rows */}
                                    {hasRows && isExpanded && (() => {
                                      const picRow = tr.rows!.find(r => r.label === "__profilePictureUrl");
                                      const visibleRows = tr.rows!.filter(r => r.label !== "__profilePictureUrl");
                                      return (
                                        <div className="border border-t-0 border-success/20 bg-black/30 p-2 space-y-1">
                                          {picRow && (
                                            <div className="flex gap-2 font-mono text-[10px] items-center mb-2">
                                              <span className="text-muted-foreground/50 shrink-0 w-[130px] text-right">Foto de Perfil</span>
                                              <img
                                                src={picRow.value}
                                                alt="Instagram profile"
                                                className="w-10 h-10 rounded-full border border-success/30 object-cover"
                                              />
                                            </div>
                                          )}
                                          {visibleRows.map((row, i) => (
                                            <div key={i} className="flex gap-2 font-mono text-[10px]">
                                              <span className="text-muted-foreground/50 shrink-0 w-[130px] text-right">{row.label}</span>
                                              <span className={
                                                row.status === "ok" ? "text-success/80" :
                                                row.status === "warn" ? "text-amber-400/80" :
                                                row.status === "error" ? "text-destructive/80" :
                                                "text-foreground/70"
                                              }>
                                                {row.value}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}

                              {/* Test connection + disconnect buttons */}
                              <div className="flex items-center gap-3 mt-0.5">
                                {entry.provider !== "facebook" && (
                                  <button
                                    onClick={() => {
                                      if (integration) {
                                        setExpandedTest(integration.id);
                                        handleTestConnection(integration.id);
                                      }
                                    }}
                                    disabled={testing === integration?.id}
                                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1"
                                  >
                                    {testing === integration?.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Plug className="h-3 w-3" />}
                                    {testing === integration?.id ? t("Testando...", "Testing...", "Probando...") : t("Testar conexão", "Test connection", "Probar conexión")}
                                  </button>
                                )}
                                {entry.provider !== "facebook" ? (
                                  <button
                                    onClick={() => integration && handleDisconnect(integration.id)}
                                    disabled={disconnecting === integration?.id}
                                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1"
                                  >
                                    {disconnecting === integration?.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <XCircle className="h-3 w-3" />}
                                    {t("Desconectar", "Disconnect", "Desconectar")}
                                  </button>
                                ) : (
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
                                    {t("Desconecte pelo Instagram", "Disconnect through Instagram", "Desconecta desde Instagram")}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setConnectModal(entry)}
                              className={`font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-[11px] ${
                                entry.required
                                  ? "btn-weapon-primary"
                                  : "bg-muted/40 hover:bg-muted/60 text-foreground border border-border/50"
                              }`}
                            >
                              <Link2 className="h-3 w-3" />
                              {t("Conectar", "Connect", "Conectar")}
                            </Button>
                          )}
                          {!isConn && entry.oauthPlatform && (
                            <span className={`font-mono text-[9px] uppercase tracking-widest flex items-center gap-0.5 ${
                              oauthProviders[entry.oauthPlatform]
                                ? "text-success/70"
                                : "text-muted-foreground/30"
                            }`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${oauthProviders[entry.oauthPlatform] ? "bg-success/60" : "bg-muted-foreground/20"}`} />
                              {oauthProviders[entry.oauthPlatform] ? t("OAuth pronto", "OAuth ready", "OAuth listo") : t("Inserção manual", "Manual entry", "Entrada manual")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Integration Wizard */}
      <IntegrationWizard />

      {/* Connect modal */}
      {connectModal && (
        <ConnectModal
          entry={connectModal}
          onClose={() => setConnectModal(null)}
          onConnect={(provider, fields) => connectMutation.mutate({ provider, fields })}
          onOAuthSuccess={() => {
            toast.success(t("Integração conectada com sucesso via OAuth.", "Integration connected successfully via OAuth.", "Integración conectada correctamente mediante OAuth."));
            setConnectModal(null);
            queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
          }}
        />
      )}

      <IntegrationChatPanel />
    </div>
  );
}
