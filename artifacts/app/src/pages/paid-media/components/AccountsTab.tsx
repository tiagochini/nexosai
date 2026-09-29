import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  useListPaidMediaAccounts, 
  useDiscoverPaidMediaAccounts, 
  useSelectPaidMediaAccount, 
  useSyncPaidMediaAccount, 
  useGetPaidMediaSyncStatus,
  getListPaidMediaAccountsQueryKey,
  getGetPaidMediaSyncStatusQueryKey
} from "@workspace/api-client-react";
import { RefreshCw, CheckCircle, Database, Search } from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

type ProviderType = "meta_ads" | "tiktok_ads" | "google_ads";

export function AccountsTab() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const queryClient = useQueryClient();
  const [discoveringProvider, setDiscoveringProvider] = useState<ProviderType | null>(null);
  
  // Query providers
  const metaAdsQuery = useListPaidMediaAccounts("meta_ads", {
    query: { queryKey: getListPaidMediaAccountsQueryKey("meta_ads"), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  const tiktokAdsQuery = useListPaidMediaAccounts("tiktok_ads", {
    query: { queryKey: getListPaidMediaAccountsQueryKey("tiktok_ads"), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  const googleAdsQuery = useListPaidMediaAccounts("google_ads", {
    query: { queryKey: getListPaidMediaAccountsQueryKey("google_ads"), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  
  const { data: syncStatusData } = useGetPaidMediaSyncStatus({
    query: { queryKey: getGetPaidMediaSyncStatusQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  
  const selectAccount = useSelectPaidMediaAccount();
  const syncAccount = useSyncPaidMediaAccount();
  
  // Discover queries
  const discoverMeta = useDiscoverPaidMediaAccounts("meta_ads", { query: { enabled: false, queryKey: ["discover-accounts", "meta_ads"] } });
  const discoverTiktok = useDiscoverPaidMediaAccounts("tiktok_ads", { query: { enabled: false, queryKey: ["discover-accounts", "tiktok_ads"] } });
  const discoverGoogle = useDiscoverPaidMediaAccounts("google_ads", { query: { enabled: false, queryKey: ["discover-accounts", "google_ads"] } });

  const handleSelect = (accountId: string, provider: ProviderType) => {
    selectAccount.mutate({ provider, accountId }, {
      onSuccess: () => {
        toast.success(t("Conta selecionada com sucesso.", "Account selected successfully.", "Cuenta seleccionada correctamente."));
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey("meta_ads") });
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey("tiktok_ads") });
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey("google_ads") });
      },
      onError: (err: any) => toast.error(err?.message || t("Erro ao selecionar conta.", "Failed to select account.", "No se pudo seleccionar la cuenta."))
    });
  };

  const handleSync = (accountId: string) => {
    syncAccount.mutate({ accountId, data: {} }, {
      onSuccess: (res: any) => {
        toast.success(t(`Sincronização iniciada. ${res?.entitiesUpserted || 0} entidades processadas.`, `Sync started. ${res?.entitiesUpserted || 0} entities processed.`, `Sincronización iniciada. ${res?.entitiesUpserted || 0} entidades procesadas.`));
        queryClient.invalidateQueries({ queryKey: getGetPaidMediaSyncStatusQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || t("Erro ao sincronizar.", "Failed to sync.", "No se pudo sincronizar."))
    });
  };


  const handleDiscover = async (provider: ProviderType) => {
    setDiscoveringProvider(provider);
    const providerName = provider === "meta_ads" ? "Meta Ads" : provider === "tiktok_ads" ? "TikTok Ads" : "Google Ads";
    toast.info(t(`Iniciando descoberta em ${providerName}...`, `Starting account discovery on ${providerName}...`, `Iniciando la búsqueda de cuentas en ${providerName}...`));

    try {
      if (provider === "meta_ads") await discoverMeta.refetch();
      else if (provider === "tiktok_ads") await discoverTiktok.refetch();
      else await discoverGoogle.refetch();

      toast.success(t(`Descoberta concluída em ${providerName}.`, `Discovery completed on ${providerName}.`, `Búsqueda completada en ${providerName}.`));
      queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey(provider) });
    } catch (err: any) {
      toast.error(err?.message || t(`Erro ao descobrir contas em ${providerName}.`, `Failed to discover accounts on ${providerName}.`, `No se pudieron buscar cuentas en ${providerName}.`));
    } finally {
      setDiscoveringProvider(null);
    }
  };

  // Merge accounts from all providers
  const metaAccounts = metaAdsQuery.data?.accounts?.map(acc => ({ ...acc, provider: "meta_ads" as ProviderType })) || [];
  const tiktokAccounts = tiktokAdsQuery.data?.accounts?.map(acc => ({ ...acc, provider: "tiktok_ads" as ProviderType })) || [];
  const googleAccounts = googleAdsQuery.data?.accounts?.map(acc => ({ ...acc, provider: "google_ads" as ProviderType })) || [];
  const accounts = [...metaAccounts, ...tiktokAccounts, ...googleAccounts];
  
  const isLoading = metaAdsQuery.isLoading || tiktokAdsQuery.isLoading || googleAdsQuery.isLoading;

  if (isLoading) return <div className="text-muted-foreground animate-pulse font-mono text-xs">{t("Carregando contas conectadas...", "Loading connected accounts...", "Cargando cuentas conectadas...")}</div>;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <h3 className="text-lg font-mono uppercase tracking-widest font-semibold mb-1">{t("Nenhuma Conta Conectada", "No Connected Accounts", "No hay cuentas conectadas")}</h3>
          <p className="text-sm font-mono text-muted-foreground max-w-sm mx-auto">
            {t("Conecte seu provedor de mídia paga (Meta, TikTok ou Google) para permitir a gestão autônoma de campanhas e inteligência.", "Connect your paid media provider (Meta, TikTok, or Google) to enable autonomous campaign management and insights.", "Conecta tu proveedor de medios pagados (Meta, TikTok o Google) para habilitar la gestión autónoma de campañas e inteligencia.")}
          </p>
        </div>
        <div className="flex gap-4 mt-2">
          <Button variant="outline" onClick={() => handleDiscover("meta_ads")} disabled={!!discoveringProvider} className="font-mono text-[10px] uppercase">
            {discoveringProvider === "meta_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            {t("Descobrir Meta Ads", "Discover Meta Ads", "Buscar Meta Ads")}
          </Button>
          <Button variant="outline" onClick={() => handleDiscover("tiktok_ads")} disabled={!!discoveringProvider} className="font-mono text-[10px] uppercase">
            {discoveringProvider === "tiktok_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            {t("Descobrir TikTok Ads", "Discover TikTok Ads", "Buscar TikTok Ads")}
          </Button>
          <Button variant="outline" onClick={() => handleDiscover("google_ads")} disabled={!!discoveringProvider} className="font-mono text-[10px] uppercase">
            {discoveringProvider === "google_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            {t("Descobrir Google Ads", "Discover Google Ads", "Buscar Google Ads")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-2 border-b border-border/30">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t(`Contas Mapeadas (${accounts.length})`, `Mapped Accounts (${accounts.length})`, `Cuentas detectadas (${accounts.length})`)}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDiscover("meta_ads")} disabled={!!discoveringProvider} className="h-8 text-[10px] font-mono uppercase">
            {discoveringProvider === "meta_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            Meta
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDiscover("tiktok_ads")} disabled={!!discoveringProvider} className="h-8 text-[10px] font-mono uppercase">
            {discoveringProvider === "tiktok_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            TikTok
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDiscover("google_ads")} disabled={!!discoveringProvider} className="h-8 text-[10px] font-mono uppercase">
            {discoveringProvider === "google_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            Google
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc: any) => (
          <div key={`${acc.provider}:${acc.id}:${acc.providerAccountId}`} className={`card-weapon p-4 flex flex-col gap-3 ${acc.isSelected ? 'border-primary shadow-[inset_0_0_12px_hsl(var(--primary)/0.1)]' : 'border-border/30'}`}>
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <div className="font-mono text-sm uppercase tracking-widest font-bold text-foreground truncate" title={acc.accountName || acc.providerAccountId}>
                  {acc.accountName || acc.providerAccountId}
                </div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground mt-0.5 truncate">
                  {acc.provider === "meta_ads" ? "Meta Ads" : acc.provider === "google_ads" ? "Google Ads" : "TikTok Ads"} • ID: {acc.providerAccountId}
                </div>
              </div>
              {acc.isSelected && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-background/50 p-2 rounded-sm border border-border/50">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Moeda", "Currency", "Moneda")}</div>
                <div className="font-mono text-xs">{acc.currency}</div>
              </div>
              <div className="bg-background/50 p-2 rounded-sm border border-border/50">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Fuso", "Time Zone", "Zona horaria")}</div>
                <div className="font-mono text-xs truncate" title={acc.timezone}>{acc.timezone}</div>
              </div>
            </div>

            <div className="flex gap-2 mt-2 pt-3 border-t border-border/30">
              {!acc.isSelected && (
                <Button variant="outline" className="flex-1 font-mono text-[10px] uppercase h-8" onClick={() => handleSelect(acc.id, acc.provider)} disabled={selectAccount.isPending}>
                  {t("Selecionar", "Select", "Seleccionar")}
                </Button>
              )}
              {acc.isSelected && (
                <Button variant="outline" className="flex-1 font-mono text-[10px] uppercase h-8 border-primary/30 text-primary hover:bg-primary/10" onClick={() => toast.info(t("Use a aba Lançamentos para operações em lote ou dossiês individuais.", "Use the Launches tab for bulk operations or individual reports.", "Usa la pestaña Lanzamientos para operaciones en lote o informes individuales."))} >
                  {t("Otimizar", "Optimize", "Optimizar")}
                </Button>
              )}
              <Button className="flex-1 font-mono text-[10px] uppercase h-8 btn-weapon-primary" onClick={() => handleSync(acc.id)} disabled={syncAccount.isPending}>
                <RefreshCw className={`h-3 w-3 mr-2 ${syncAccount.isPending ? 'animate-spin' : ''}`} />
                {t("Sync", "Sync", "Sincronizar")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {syncStatusData?.cursors && syncStatusData.cursors.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> {t("Saúde da Sincronização", "Sync Health", "Estado de sincronización")}
          </h3>
          <div className="border border-border/40 rounded-sm overflow-hidden bg-card/30">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-muted/20 text-muted-foreground text-[10px] uppercase tracking-widest border-b border-border/40">
                <tr>
                  <th className="p-3 font-normal">{t("Entidade", "Entity", "Entidad")}</th>
                  <th className="p-3 font-normal">{t("Conta / ID", "Account / ID", "Cuenta / ID")}</th>
                  <th className="p-3 font-normal">{t("Sincronizado Até", "Synced Through", "Sincronizado hasta")}</th>
                  <th className="p-3 font-normal">{t("Status", "Status", "Estado")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {syncStatusData.cursors.map((cursor: any) => (
                  <tr key={`${cursor.id}:${cursor.accountId}:${cursor.entityType}`} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold">{cursor.entityType}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[120px]" title={cursor.accountId}>{cursor.accountId}</td>
                    <td className="p-3 text-muted-foreground">{cursor.syncedThrough ? new Date(cursor.syncedThrough).toLocaleString(intlLocale(locale)) : t("Pendente...", "Pending...", "Pendiente...")}</td>
                    <td className="p-3">
                      {cursor.lastError ? (
                        <span className="text-destructive font-bold" title={cursor.lastError}>{t("ERRO", "ERROR", "ERROR")}</span>
                      ) : (
                        <span className="text-primary font-bold">{t("ATIVO", "ACTIVE", "ACTIVO")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
