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
  getGetPaidMediaSyncStatusQueryKey,
  useGeneratePaidMediaProposal,
  getListPaidMediaProposalsQueryKey
} from "@workspace/api-client-react";
import { RefreshCw, Link2, CheckCircle, Database, Search } from "lucide-react";

type ProviderType = "meta_ads" | "tiktok_ads";

export function AccountsTab() {
  const queryClient = useQueryClient();
  const [discoveringProvider, setDiscoveringProvider] = useState<ProviderType | null>(null);
  
  // Query both providers
  const metaAdsQuery = useListPaidMediaAccounts("meta_ads");
  const tiktokAdsQuery = useListPaidMediaAccounts("tiktok_ads");
  
  const { data: syncStatusData } = useGetPaidMediaSyncStatus();
  
  const selectAccount = useSelectPaidMediaAccount();
  const syncAccount = useSyncPaidMediaAccount();
  const generateMutation = useGeneratePaidMediaProposal();
  
  // Discover queries
  const discoverMeta = useDiscoverPaidMediaAccounts("meta_ads", { query: { enabled: false, queryKey: ["discover-accounts", "meta_ads"] } });
  const discoverTiktok = useDiscoverPaidMediaAccounts("tiktok_ads", { query: { enabled: false, queryKey: ["discover-accounts", "tiktok_ads"] } });

  const handleSelect = (accountId: string, provider: ProviderType) => {
    selectAccount.mutate({ provider, accountId }, {
      onSuccess: () => {
        toast.success("Conta selecionada com sucesso.");
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey("meta_ads") });
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey("tiktok_ads") });
      },
      onError: (err: any) => toast.error(err?.message || "Erro ao selecionar conta.")
    });
  };

  const handleSync = (accountId: string) => {
    syncAccount.mutate({ accountId, data: {} }, {
      onSuccess: (res: any) => {
        toast.success(`Sincronização iniciada. ${res?.entitiesUpserted || 0} entidades processadas.`);
        queryClient.invalidateQueries({ queryKey: getGetPaidMediaSyncStatusQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Erro ao sincronizar.")
    });
  };

  const handleOptimize = (accountId: string) => {
    generateMutation.mutate({ data: {
      accountId,
      entityId: "all",
      actionType: "update_daily_budget",
      proposedChange: {}
    }}, {
      onSuccess: () => {
        toast.success("Ciclo de otimização disparado para esta conta.");
        queryClient.invalidateQueries({ queryKey: getListPaidMediaProposalsQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Erro ao solicitar otimização.")
    });
  };

  const handleDiscover = async (provider: ProviderType) => {
    setDiscoveringProvider(provider);
    toast.info(`Iniciando descoberta em ${provider === 'meta_ads' ? 'Meta Ads' : 'TikTok Ads'}...`);
    
    try {
      const res = provider === "meta_ads" ? await discoverMeta.refetch() : await discoverTiktok.refetch();
      if (res.data) {
        toast.success(`Descoberta concluída em ${provider === 'meta_ads' ? 'Meta Ads' : 'TikTok Ads'}.`);
        queryClient.invalidateQueries({ queryKey: getListPaidMediaAccountsQueryKey(provider) });
      }
    } catch (err: any) {
      toast.error(err?.message || `Erro ao descobrir contas em ${provider}.`);
    } finally {
      setDiscoveringProvider(null);
    }
  };

  // Merge accounts from both providers
  const metaAccounts = metaAdsQuery.data?.accounts?.map(acc => ({ ...acc, provider: "meta_ads" as ProviderType })) || [];
  const tiktokAccounts = tiktokAdsQuery.data?.accounts?.map(acc => ({ ...acc, provider: "tiktok_ads" as ProviderType })) || [];
  const accounts = [...metaAccounts, ...tiktokAccounts];
  
  const isLoading = metaAdsQuery.isLoading || tiktokAdsQuery.isLoading;

  if (isLoading) return <div className="text-muted-foreground animate-pulse font-mono text-xs">Carregando contas conectadas...</div>;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <h3 className="text-lg font-mono uppercase tracking-widest font-semibold mb-1">Nenhuma Conta Conectada</h3>
          <p className="text-sm font-mono text-muted-foreground max-w-sm mx-auto">
            Conecte seu provedor de mídia paga (Meta Ads ou TikTok Ads) para permitir a gestão autônoma de campanhas e inteligência.
          </p>
        </div>
        <div className="flex gap-4 mt-2">
          <Button variant="outline" onClick={() => handleDiscover("meta_ads")} disabled={!!discoveringProvider} className="font-mono text-[10px] uppercase">
            {discoveringProvider === "meta_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            Descobrir Meta Ads
          </Button>
          <Button variant="outline" onClick={() => handleDiscover("tiktok_ads")} disabled={!!discoveringProvider} className="font-mono text-[10px] uppercase">
            {discoveringProvider === "tiktok_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            Descobrir TikTok Ads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-2 border-b border-border/30">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Contas Mapeadas ({accounts.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDiscover("meta_ads")} disabled={!!discoveringProvider} className="h-8 text-[10px] font-mono uppercase">
            {discoveringProvider === "meta_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            Meta Ads
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDiscover("tiktok_ads")} disabled={!!discoveringProvider} className="h-8 text-[10px] font-mono uppercase">
            {discoveringProvider === "tiktok_ads" ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
            TikTok Ads
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc: any) => (
          <div key={acc.id} className={`card-weapon p-4 flex flex-col gap-3 ${acc.isSelected ? 'border-primary shadow-[inset_0_0_12px_hsl(var(--primary)/0.1)]' : 'border-border/30'}`}>
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <div className="font-mono text-sm uppercase tracking-widest font-bold text-foreground truncate" title={acc.accountName || acc.providerAccountId}>
                  {acc.accountName || acc.providerAccountId}
                </div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground mt-0.5 truncate">
                  {acc.provider === "meta_ads" ? "Meta Ads" : "TikTok Ads"} • ID: {acc.providerAccountId}
                </div>
              </div>
              {acc.isSelected && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-background/50 p-2 rounded-sm border border-border/50">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Moeda</div>
                <div className="font-mono text-xs">{acc.currency}</div>
              </div>
              <div className="bg-background/50 p-2 rounded-sm border border-border/50">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Fuso</div>
                <div className="font-mono text-xs truncate" title={acc.timezone}>{acc.timezone}</div>
              </div>
            </div>

            <div className="flex gap-2 mt-2 pt-3 border-t border-border/30">
              {!acc.isSelected && (
                <Button variant="outline" className="flex-1 font-mono text-[10px] uppercase h-8" onClick={() => handleSelect(acc.id, acc.provider)} disabled={selectAccount.isPending}>
                  Selecionar
                </Button>
              )}
              {acc.isSelected && (
                <Button variant="outline" className="flex-1 font-mono text-[10px] uppercase h-8 border-primary/30 text-primary hover:bg-primary/10" onClick={() => handleOptimize(acc.id)} disabled={generateMutation.isPending}>
                  Otimizar IA
                </Button>
              )}
              <Button className="flex-1 font-mono text-[10px] uppercase h-8 btn-weapon-primary" onClick={() => handleSync(acc.id)} disabled={syncAccount.isPending}>
                <RefreshCw className={`h-3 w-3 mr-2 ${syncAccount.isPending ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {syncStatusData?.cursors && syncStatusData.cursors.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> Saúde da Sincronização
          </h3>
          <div className="border border-border/40 rounded-sm overflow-hidden bg-card/30">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-muted/20 text-muted-foreground text-[10px] uppercase tracking-widest border-b border-border/40">
                <tr>
                  <th className="p-3 font-normal">Entidade</th>
                  <th className="p-3 font-normal">Conta / ID</th>
                  <th className="p-3 font-normal">Sincronizado Até</th>
                  <th className="p-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {syncStatusData.cursors.map((cursor: any) => (
                  <tr key={cursor.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold">{cursor.entityType}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[120px]" title={cursor.accountId}>{cursor.accountId}</td>
                    <td className="p-3 text-muted-foreground">{cursor.syncedThrough ? new Date(cursor.syncedThrough).toLocaleString() : 'Pendente...'}</td>
                    <td className="p-3">
                      {cursor.lastError ? (
                        <span className="text-destructive font-bold" title={cursor.lastError}>ERRO</span>
                      ) : (
                        <span className="text-primary font-bold">ATIVO</span>
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
