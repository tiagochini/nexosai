import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Target, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUiText } from "@/lib/i18n";

interface WorkspaceIntegration {
  id: string;
  provider: string;
  status: string;
  accountName?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
}

const ADS_PROVIDERS = [
  { id: "meta_ads", name: "Meta Ads", dbProvider: "meta_ads", platform: "meta" },
  { id: "tiktok_ads", name: "TikTok Ads", dbProvider: "tiktok_ads", platform: "tiktok" },
  { id: "google_ads", name: "Google Ads", dbProvider: "google_ads", platform: "google" },
];

export function AdsReadinessTab() {
  const t = useUiText();
  const queryClient = useQueryClient();

  const { data: integrationsData, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: () => customFetch<{ integrations: WorkspaceIntegration[] }>("/api/workspaces/me/integrations"),
  });

  const { data: oauthProviders, isLoading: loadingOAuth } = useQuery({
    queryKey: ["/api/integrations/oauth/providers"],
    queryFn: () => customFetch<{ providers: Record<string, boolean> }>("/api/integrations/oauth/providers"),
  });

  const handleOAuthConnect = async (providerId: string) => {
    try {
      const data = await customFetch<{ url: string }>(`/api/integrations/oauth/start/${providerId}`);
      if (data.url) {
        const popup = window.open(data.url, "oauth_connect", "width=600,height=700,status=no,menubar=no");
        if (!popup) {
           toast.error(t("Pop-up bloqueado. Permita pop-ups para autenticar.", "Pop-up blocked. Allow pop-ups to authenticate.", "Ventana emergente bloqueada. Permite las ventanas emergentes para autenticarte."));
          return;
        }
        
        let resultHandled = false;
        const handleResult = (success: boolean, error?: string) => {
          if (resultHandled) return;
          resultHandled = true;
          if (success) {
             toast.success(t("Conectado com sucesso!", "Connected successfully!", "¡Conectado correctamente!"));
            queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
          } else {
             toast.error(error || t("A autenticação não foi concluída.", "Authentication was not completed.", "No se completó la autenticación."));
          }
        };

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === "oauth_complete") {
            handleResult(!!event.data.success, event.data.error);
          }
        };
        window.addEventListener("message", messageHandler);

        try { localStorage.removeItem("nexos_oauth_result"); } catch { /* ignore */ }
        const storageHandler = (event: StorageEvent) => {
          if (event.key !== "nexos_oauth_result" || !event.newValue) return;
          try {
            const result = JSON.parse(event.newValue);
            if (result.type === "oauth_complete") {
              handleResult(!!result.success, result.error);
            }
          } catch { /* ignore */ }
        };
        window.addEventListener("storage", storageHandler);

        const checkClosed = setInterval(async () => {
          if (popup.closed) {
            clearInterval(checkClosed);
            if (!resultHandled) {
              await new Promise(r => setTimeout(r, 400));
               if (!resultHandled) handleResult(false, t("Janela fechada antes de concluir.", "Window closed before completion.", "La ventana se cerró antes de completar."));
            }
            window.removeEventListener("message", messageHandler);
            window.removeEventListener("storage", storageHandler);
          }
        }, 500);
      }
    } catch (err: any) {
       toast.error(err.message || t("Falha ao iniciar autenticação OAuth.", "Failed to start OAuth authentication.", "No se pudo iniciar la autenticación OAuth."));
    }
  };

  if (loadingIntegrations || loadingOAuth) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  const integrations = integrationsData?.integrations || [];
  const oauthStatus = oauthProviders?.providers || {};

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 p-4 mb-4 max-w-4xl">
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
           {t('Verifique o status da conexão OAuth, as autorizações do anunciante e a prontidão de produção de cada rede de anúncios. O agente autônomo não publicará campanhas em contas com status "Test" ou que exijam seleção de conta.', 'Check OAuth connection status, advertiser authorization, and production readiness for each ad network. The autonomous agent will not publish campaigns to accounts with "Test" status or accounts requiring account selection.', 'Comprueba el estado de conexión OAuth, las autorizaciones del anunciante y la preparación para producción de cada red publicitaria. El agente autónomo no publicará campañas en cuentas con estado "Test" ni en cuentas que requieran selección de cuenta.')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ADS_PROVIDERS.map(adsProvider => {
          const isOauthConfigured = oauthStatus[adsProvider.platform] === true;
          const integration = integrations.find(i => i.provider === adsProvider.dbProvider);
          const isConnected = !!integration && integration.status === "connected";

          return (
            <ProviderCard 
              key={adsProvider.id}
              adsProvider={adsProvider}
              isOauthConfigured={isOauthConfigured}
              isConnected={isConnected}
              onConnect={() => handleOAuthConnect(adsProvider.platform)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderCard({ 
  adsProvider, 
  isOauthConfigured, 
  isConnected,
  onConnect
}: { 
  adsProvider: { id: string, name: string, dbProvider: string, platform: string };
  isOauthConfigured: boolean;
  isConnected: boolean;
  onConnect: () => void;
}) {
  const t = useUiText();
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["/api/paid-media/setup", adsProvider.dbProvider, "status"],
    queryFn: () => customFetch<any>(`/api/paid-media/setup/${adsProvider.dbProvider}/status`),
    enabled: isConnected,
    retry: false,
  });

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon flex flex-col">
      <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground/90">{adsProvider.name}</span>
        </div>
        {isConnected ? (
          statusData?.productionReady ? (
            <Badge variant="outline" className="rounded-none border-success/30 text-success bg-success/10 font-mono text-[9px] uppercase">{t("Pronto", "Ready", "Listo")}</Badge>
          ) : (
            <Badge variant="outline" className="rounded-none border-warning/30 text-warning bg-warning/10 font-mono text-[9px] uppercase">{t("Pendente", "Pending", "Pendiente")}</Badge>
          )
        ) : (
          <Badge variant="outline" className="rounded-none border-muted-foreground/30 text-muted-foreground bg-muted/10 font-mono text-[9px] uppercase">{t("Desconectado", "Disconnected", "Desconectado")}</Badge>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {!isOauthConfigured ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-6">
            <AlertTriangle className="h-6 w-6 text-muted-foreground/50" />
            <div className="font-mono text-[10px] uppercase text-muted-foreground">{t("App OAuth não configurado", "OAuth app not configured", "App OAuth no configurada")}</div>
            <p className="font-mono text-[10px] text-muted-foreground/60 max-w-[200px]">
              {t("O OAuth exige credenciais do servidor, mas a conexão manual via API já está disponível em Integrações.", "OAuth requires server credentials, but manual connection via API is available in Integrations.", "OAuth requiere credenciales del servidor, pero la conexión manual mediante API ya está disponible en Integraciones.")}
            </p>
            <Button
              variant="outline"
              className="rounded-none font-mono uppercase text-[10px]"
              onClick={() => { window.location.href = "/integracoes"; }}
            >
              {t("Conectar via API", "Connect via API", "Conectar mediante API")}
            </Button>
          </div>
        ) : !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-6">
            <Target className="h-8 w-8 text-primary/30" />
            <Button 
              className="btn-weapon-primary rounded-none font-mono uppercase text-xs w-full"
              onClick={onConnect}
            >
              {t("Conectar conta", "Connect account", "Conectar cuenta")}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : statusData ? (
          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Status OAuth", "OAuth status", "Estado OAuth")}</span>
                <span className="font-mono text-[10px] text-success font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {statusData.oauth}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Autorização do anunciante", "Advertiser authorization", "Autorización del anunciante")}</span>
                <span className="font-mono text-[10px] text-success font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {statusData.advertiserAuthorization}
                </span>
              </div>
            </div>

            <div className="border-t border-border/30 pt-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Contas de anúncio", "Ad accounts", "Cuentas publicitarias")}</div>
              {statusData.accounts?.length > 0 ? (
                <div className="space-y-2">
                  {statusData.accounts.map((acc: any) => (
                    <div key={acc.providerAccountId} className="p-2 border border-border/30 bg-background/20 text-[10px] font-mono flex items-center justify-between">
                      <span className="truncate max-w-[120px]">{acc.name || acc.providerAccountId}</span>
                      <span className={acc.environment === "production" ? "text-primary" : "text-warning"}>
                        {acc.environment}
                      </span>
                    </div>
                  ))}
                  
                  {statusData.accountSelectionRequired && (
                    <div className="mt-2 text-[10px] font-mono text-warning flex gap-1">
                       <AlertTriangle className="h-3 w-3" /> {t("Seleção de conta exigida na tela de Integrações.", "Account selection required on the Integrations page.", "Se requiere seleccionar una cuenta en la página de Integraciones.")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-muted-foreground">{t("Nenhuma conta encontrada.", "No accounts found.", "No se encontraron cuentas.")}</div>
              )}
            </div>
            
            <div className="mt-auto pt-4 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Prontidão de produção", "Production readiness", "Preparación para producción")}</span>
                {statusData.productionReady ? (
                  <span className="font-mono text-[10px] text-success font-bold">{t("SIM", "YES", "SÍ")}</span>
                ) : (
                  <span className="font-mono text-[10px] text-destructive font-bold">{t("NÃO", "NO", "NO")}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-6">
            <XCircle className="h-6 w-6 text-destructive/50" />
            <div className="font-mono text-[10px] uppercase text-destructive">{t("Erro na validação", "Validation error", "Error de validación")}</div>
            <p className="font-mono text-[10px] text-muted-foreground/60">
              {t("A conexão parece estar inválida ou o token expirou.", "The connection appears invalid or the token has expired.", "La conexión parece no ser válida o el token ha caducado.")}
            </p>
            <Button 
              variant="outline"
              className="btn-weapon-outline rounded-none font-mono uppercase text-[10px] mt-2"
              onClick={onConnect}
            >
              {t("Reconectar", "Reconnect", "Volver a conectar")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}