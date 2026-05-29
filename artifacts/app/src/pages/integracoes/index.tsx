import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Link2, AlertTriangle,
  Wifi, WifiOff,
} from "lucide-react";
import {
  ConnectModal, INTEGRATION_CATALOG, INTEGRATION_CATEGORIES,
  type Provider, type CatalogEntry, type WorkspaceIntegration,
} from "@/components/integration-connect-modal";
import { OnboardingAgent } from "@/components/onboarding-agent";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import { IntegrationWizard } from "@/components/integration-wizard";

export default function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<CatalogEntry | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as WorkspaceIntegration[] };
      return res.json() as Promise<{ integrations: WorkspaceIntegration[] }>;
    },
    staleTime: 30_000,
  });

  const { data: oauthStatus } = useQuery({
    queryKey: ["/api/integrations/oauth/providers"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/integrations/oauth/providers");
      if (!res.ok) return { providers: {} as Record<string, boolean> };
      return res.json() as Promise<{ providers: Record<string, boolean> }>;
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
      const res = await customFetch<Response>("/api/workspaces/me/integrations", {
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
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao conectar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Integração conectada com sucesso.");
      setConnectModal(null);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      const res = await customFetch<Response>(`/api/workspaces/me/integrations/${integrationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao desconectar");
      toast.success("Integração removida.");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    } catch {
      toast.error("Erro ao desconectar.");
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
          Integrações
        </h1>
        <p className="text-sm font-mono text-muted-foreground/60 mt-1">
          Conecte seus canais para ativar o modo Full Auto — disparos automáticos durante o lançamento.
        </p>
      </div>

      <FeatureOnboarding
        featureKey={FEATURE_KEYS.INTEGRATIONS}
        title="INTEGRAÇÕES & FULL AUTO"
        description="Conecte seus canais para que a NexOS opere de forma autônoma. Sem integrações = operação manual durante o lançamento."
        variant="banner"
        steps={[
          "WhatsApp Business ou Telegram — sequências automáticas e respostas dos agentes",
          "RD Station ou ActiveCampaign — e-mails segmentados por temperatura",
          "Meta Ads / Google Ads — ROAS e métricas em tempo real",
          "Hotmart / Kiwify — captura automática de vendas e conversão de leads",
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
              {isFullAuto ? "Full Auto — Pronto para lançar" : "Modo Parcial — Configure para lançar"}
            </div>
            <div className="text-xs font-mono text-muted-foreground/60 mt-0.5">
              {isFullAuto
                ? `${connectedCount} integrações ativas. Todos os disparos automáticos ativados.`
                : `Conecte ${!hasMessaging ? "um canal de Mensagens" : ""}${!hasMessaging && !hasEmail ? " e " : ""}${!hasEmail ? "um canal de E-mail" : ""} para lançar campanhas.`}
            </div>
          </div>
        </div>
        {!isFullAuto && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {!hasMessaging && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />Mensagens — obrigatório para lançar
              </Badge>
            )}
            {!hasEmail && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />E-mail — obrigatório para lançar
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Integration catalog grouped by category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
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
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 rounded-none px-1.5 py-0">obrigatório</Badge>
                              )}
                              {isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-success/40 text-success rounded-none px-1.5 py-0 gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />conectado
                                </Badge>
                              )}
                              {/* Facebook note: shares Instagram connection */}
                              {entry.provider === "facebook" && isConn && (
                                <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">via Meta</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
                            {isConn && integration?.accountName && (
                              <p className="text-[10px] font-mono text-success/70 mt-0.5">{integration.accountName}</p>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {isConn ? (
                            entry.provider !== "facebook" ? (
                              <button
                                onClick={() => integration && handleDisconnect(integration.id)}
                                disabled={disconnecting === integration?.id}
                                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1"
                              >
                                {disconnecting === integration?.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <XCircle className="h-3 w-3" />}
                                Desconectar
                              </button>
                            ) : (
                              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
                                Desconecte pelo Instagram
                              </span>
                            )
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
                              Conectar
                            </Button>
                          )}
                          {!isConn && entry.oauthPlatform && (
                            <span className={`font-mono text-[9px] uppercase tracking-widest flex items-center gap-0.5 ${
                              oauthProviders[entry.oauthPlatform]
                                ? "text-success/70"
                                : "text-muted-foreground/30"
                            }`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${oauthProviders[entry.oauthPlatform] ? "bg-success/60" : "bg-muted-foreground/20"}`} />
                              {oauthProviders[entry.oauthPlatform] ? "OAuth pronto" : "Inserção manual"}
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
            toast.success("Integração conectada com sucesso via OAuth.");
            setConnectModal(null);
            queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
          }}
        />
      )}
    </div>
  );
}
