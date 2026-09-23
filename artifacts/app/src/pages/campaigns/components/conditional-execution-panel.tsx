import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetConditionalExecutionPolicy,
  getGetConditionalExecutionPolicyQueryKey,
  useListConditionalExecutions,
  getListConditionalExecutionsQueryKey,
  useCreateConditionalExecutionPolicy,
  useRevokeConditionalExecutionPolicy,
  useListPaidMediaAccounts,
  getListPaidMediaAccountsQueryKey,
  useListPaidMediaProposals,
  getListPaidMediaProposalsQueryKey,
  type ConditionalExecutionPolicyInputActionProvider,
  type ConditionalExecutionResponse,
  type ConditionalExecutionAttempt,
  type ConditionalExecutionIntent,
  type PaidMediaAccount,
  type PaidMediaProposal,
} from "@workspace/api-client-react";
import {
  ShieldAlert, Shield, Activity, AlertTriangle, 
  RefreshCw, Power, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// Implementation next

interface Props {
  campaignId: string;
  masterplan: {
    version?: number;
    contentHash?: string;
    contextFingerprint?: string;
  };
}

export function ConditionalExecutionPanel({ campaignId, masterplan }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: policyData, isLoading: policyLoading, isError: policyError, refetch: refetchPolicy } = useGetConditionalExecutionPolicy(campaignId, {
    query: {
      queryKey: getGetConditionalExecutionPolicyQueryKey(campaignId),
      refetchInterval: 5000,
      retry: false,
    }
  });

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useListConditionalExecutions(campaignId, {
    query: {
      queryKey: getListConditionalExecutionsQueryKey(campaignId),
      refetchInterval: 5000,
      retry: false,
    }
  });

  const policy = policyData?.policy;
  const isEnabled = policy?.enabled === true && !policy?.revokedAt && new Date(policy.expiresAt).getTime() > Date.now();
  const intentsCount = listData?.counts?.intents || 0;
  const attemptsCount = listData?.counts?.attempts || 0;

  const isLoading = policyLoading || listLoading;
  const isError = policyError;
  const refetch = () => { refetchPolicy(); refetchList(); };

  return (
    <>
      <section className={`border bg-black/60 backdrop-blur-md overflow-hidden relative group flex flex-col ${isEnabled ? 'border-[#FFB000]/30' : 'border-border/30'}`}>
        {isEnabled && <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFB000]/50 to-transparent" />}
        <div className={`p-3 border-b flex justify-between items-center shrink-0 ${isEnabled ? 'bg-[#FFB000]/5 border-[#FFB000]/20' : 'bg-white/5 border-border/20'}`}>
          <div className="flex items-center gap-2">
            <Power className={`h-4 w-4 ${isEnabled ? 'text-[#FFB000]' : 'text-muted-foreground'}`} />
            <h2 className={`font-mono text-[11px] uppercase tracking-widest font-bold ${isEnabled ? 'text-[#FFB000]' : 'text-muted-foreground'}`}>
              M08 Conditional Execution
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 border font-mono text-[9px] uppercase tracking-wider ${isEnabled ? 'border-[#FFB000]/40 bg-[#FFB000]/10 text-[#FFB000]' : 'border-border/40 bg-background/30 text-muted-foreground'}`}>
              {isEnabled ? "Ativo" : "Desativado"}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="font-sans text-xs text-muted-foreground leading-relaxed">
            {isEnabled 
              ? "A política de execução condicional está ativada. O orquestrador executará a proposta de pausa exata aprovada quando a política e todos os portões de segurança passarem."
              : "Execução condicional M08 desativada. Aprovações são obrigatórias e o orquestrador não executará nenhuma ação corretiva automática."}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <Metric label="Intents" value={intentsCount} />
             <Metric label="Attempts" value={attemptsCount} />
             <Metric label="Eligibility" value={listData?.eligibility ? "Pronto" : "Bloqueado"} />
             <Metric label="Policy" value={policy?.version ? `v${policy.version}` : "N/A"} />
          </div>

          <Button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`w-full font-mono text-[10px] uppercase tracking-widest border rounded-none h-10 transition-colors ${
              isEnabled 
                ? "border-[#FFB000]/40 bg-[#FFB000]/10 text-[#FFB000] hover:bg-[#FFB000]/20 hover:border-[#FFB000]/70"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/70 hover:text-primary"
            }`}
          >
            {isEnabled ? "Ver Política e Eventos" : "Configurar Política"}
          </Button>
        </div>
      </section>

      <ConditionalExecutionDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        campaignId={campaignId}
        masterplan={masterplan}
        policyData={policyData}
        listData={listData}
        isLoading={isLoading}
        refetch={refetch}
      />
    </>
  );
}

function Metric({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex flex-col border border-border/30 bg-background/20 p-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</span>
      <span className="font-mono text-xs text-white truncate">{value}</span>
    </div>
  );
}

function ConditionalExecutionDrawer({
  open,
  onOpenChange,
  campaignId,
  masterplan,
  policyData,
  listData,
  isLoading,
  refetch
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  masterplan: Props['masterplan'];
  policyData: ConditionalExecutionResponse | undefined;
  listData: ConditionalExecutionResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
}) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<ConditionalExecutionPolicyInputActionProvider>("meta_ads");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [maxActions, setMaxActions] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [errorMsg, setErrorMsg] = useState("");

  const policy = policyData?.policy;
  const action = policyData?.action;
  const approvedBinding = policyData?.approvedBinding;
  const isEnabled = policy?.enabled === true && !policy?.revokedAt && new Date(policy.expiresAt).getTime() > Date.now();

  const { data: accountsData } = useListPaidMediaAccounts(provider, {
    query: { 
      enabled: open && !isEnabled,
      queryKey: getListPaidMediaAccountsQueryKey(provider)
    }
  });

  const { data: proposalsData } = useListPaidMediaProposals({
    query: { 
      enabled: open && !isEnabled,
      queryKey: getListPaidMediaProposalsQueryKey()
    }
  });

  const { mutate: createPolicy, isPending: isCreating } = useCreateConditionalExecutionPolicy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConditionalExecutionPolicyQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getListConditionalExecutionsQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "control-room"] });
        setErrorMsg("");
      },
      onError: (err: Error | { message?: string; response?: any }) => {
        setErrorMsg('message' in err ? err.message || "Failed to create policy" : "Failed to create policy");
      }
    }
  });

  const { mutate: revokePolicy, isPending: isRevoking } = useRevokeConditionalExecutionPolicy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConditionalExecutionPolicyQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getListConditionalExecutionsQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "control-room"] });
      },
      onError: (err: Error | { message?: string; response?: any }) => {
        setErrorMsg('message' in err ? err.message || "Failed to revoke policy" : "Failed to revoke policy");
      }
    }
  });

  const handleCreate = () => {
    if (!selectedAccountId || !selectedEntityId) {
      setErrorMsg("Selecione um alvo (conta e entidade) primeiro.");
      return;
    }
    if (!approvedBinding?.masterplanVersionId || !approvedBinding?.snapshotHash || !approvedBinding?.contextFingerprint) {
      setErrorMsg("Nenhum masterplan aprovado disponível para vincular a política. É necessário ter um masterplan aprovado vigente no Control Room.");
      return;
    }

    createPolicy({
      campaignId,
      data: {
        enabled: true,
        masterplanVersionId: approvedBinding.masterplanVersionId,
        snapshotHash: approvedBinding.snapshotHash,
        contextFingerprint: approvedBinding.contextFingerprint,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
        idempotencyKey: Math.random().toString(36).substring(2) + Date.now().toString(36),
        action: {
          actionType: "paid_media_pause",
          provider,
          accountId: selectedAccountId,
          entityId: selectedEntityId,
          maxActionsPerDay: maxActions,
        }
      }
    });
  };

  const handleRevoke = () => {
    if (!policy) return;
    if (confirm("ATENÇÃO: Revogar a política removerá a permissão de pausa automática imediatamente. O orquestrador não poderá agir em caso de emergência. Confirmar?")) {
      revokePolicy({ campaignId, version: policy.version });
    }
  };

  const safeProposals = proposalsData?.proposals || [];
  const safeAccounts = accountsData?.accounts || [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none">
        <div className="mx-auto w-full max-w-[1000px] overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/20 shrink-0 p-4 bg-[#030712] flex justify-between items-start">
            <div>
              <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                <Power className="h-4 w-4" />
                M08 Conditional Auto-Execution
              </DrawerTitle>
              <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                Autorize ações corretivas limitadas e rastreáveis.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="font-mono text-[9px] uppercase tracking-widest h-8 rounded-none border-border/40 hover:bg-white/5">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-[#010308] p-4 md:p-6 hide-scrollbar space-y-8">
            {isLoading ? (
               <div className="flex justify-center items-center h-32">
                 <RefreshCw className="h-5 w-5 text-primary animate-spin" />
               </div>
            ) : (
              <div className="space-y-6">
                {policy && (
                  <div className={`border ${isEnabled ? 'border-[#FFB000]/30 bg-[#FFB000]/5' : 'border-border/30 bg-black/40'} p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className={`h-4 w-4 ${isEnabled ? 'text-[#FFB000]' : 'text-muted-foreground'}`} />
                        <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${isEnabled ? 'text-[#FFB000]' : 'text-muted-foreground'}`}>
                          {isEnabled ? `Política Ativa (v${policy.version})` : `Política Inativa (v${policy.version})`}
                        </span>
                      </div>
                      <p className="font-mono text-[9px] text-muted-foreground">
                        {policy.revokedAt ? `Revogada em: ${new Date(policy.revokedAt).toLocaleString()}` : `Expira(ou) em: ${new Date(policy.expiresAt).toLocaleString()}`}
                      </p>
                    </div>
                    {isEnabled && (
                      <Button 
                        variant="outline" 
                        onClick={handleRevoke}
                        disabled={isRevoking}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 font-mono text-[10px] uppercase tracking-widest rounded-none h-8"
                      >
                        {isRevoking ? "Revogando..." : "Revogar Política"}
                      </Button>
                    )}
                  </div>
                )}

                {policy && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-border/20 bg-black/40 p-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-white mb-3">Binding (Masterplan)</h3>
                      <div className="space-y-2 font-mono text-[9px] text-muted-foreground break-all">
                        <div><span className="text-white/50">Version ID:</span> {policy.masterplanVersionId}</div>
                        <div><span className="text-white/50">Hash:</span> {policy.snapshotHash}</div>
                        <div><span className="text-white/50">Signature:</span> {policy.contextFingerprint}</div>
                      </div>
                    </div>

                    <div className="border border-border/20 bg-black/40 p-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-white mb-3">Target & Limits</h3>
                      {action && (
                        <div className="space-y-2 font-mono text-[9px] text-muted-foreground break-all">
                          <div><span className="text-white/50">Ação:</span> {action.actionType}</div>
                          <div><span className="text-white/50">Provider:</span> {action.provider}</div>
                          <div><span className="text-white/50">Account ID:</span> {action.accountId}</div>
                          <div><span className="text-white/50">Entity ID:</span> {action.entityId}</div>
                          <div><span className="text-white/50">Teto Diário:</span> {action.maxActionsPerDay} ações/dia</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="border border-destructive/30 bg-destructive/10 text-destructive p-3 font-mono text-[10px]">
                    {errorMsg}
                  </div>
                )}

                {!listData?.eligibility && listData?.blockers && listData.blockers.length > 0 && (
                  <div className="border border-destructive/30 bg-destructive/5 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-destructive mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" /> Motivos de Bloqueio (Ineligível)
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 font-mono text-[9px] text-destructive/80">
                      {listData.blockers.map((b: string, i: number) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-white border-b border-white/10 pb-2">Histórico de Execução (Audit Trail)</h3>
                  
                  <div className="space-y-3">
                    {(!listData?.intents?.length && !listData?.attempts?.length) ? (
                      <div className="p-6 text-center border border-dashed border-border/30 bg-black/20">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nenhuma execução acionada</div>
                      </div>
                    ) : (
                      <>
                        {listData?.attempts?.map((attempt: ConditionalExecutionAttempt) => (
                          <div key={attempt.id} className="border border-border/20 bg-black/40 p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Activity className="h-3 w-3 text-primary" />
                                <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Tentativa M08</span>
                                <span className={`px-1.5 py-0.5 border font-mono text-[8px] uppercase tracking-wider ${attempt.status === 'confirmed' ? 'border-success/30 text-success bg-success/5' : 'border-[#FFB000]/30 text-[#FFB000] bg-[#FFB000]/5'}`}>
                                  {attempt.status}
                                </span>
                              </div>
                              <span className="font-mono text-[8px] text-muted-foreground">{new Date(attempt.createdAt).toLocaleString()}</span>
                            </div>
                            {attempt.providerReceipt && (
                              <div className="mt-2 p-2 bg-black/60 border border-white/5">
                                <div className="font-mono text-[8px] text-white/50 uppercase tracking-widest mb-1">Provider Receipt</div>
                                <pre className="font-mono text-[8px] text-muted-foreground break-all whitespace-pre-wrap">{JSON.stringify(attempt.providerReceipt, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                        {listData?.intents?.map((intent: ConditionalExecutionIntent) => (
                          <div key={intent.id} className="border border-border/20 bg-black/20 p-3 opacity-70">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <Target className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Intent M08</span>
                                <span className="px-1.5 py-0.5 border border-border/40 text-muted-foreground font-mono text-[8px] uppercase tracking-wider">
                                  {intent.status}
                                </span>
                              </div>
                              <span className="font-mono text-[8px] text-muted-foreground">{new Date(intent.createdAt).toLocaleString()}</span>
                            </div>
                            {intent.blockCode && (
                              <div className="mt-1 font-mono text-[9px] text-destructive/80">Bloqueado: {intent.blockCode}</div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {!isEnabled && (
                  <div className="space-y-6 max-w-2xl mt-8 pt-8 border-t border-border/20">
                    <div className="border border-primary/30 bg-primary/5 p-4">
                      <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4" /> Configurar Nova Política
                      </h3>
                      <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                        Nenhuma ação de mídia será executada automaticamente sem aprovação explícita, a menos que você ative esta política M08. 
                        Se configurada, o orquestrador apenas executará a proposta de pausa exata e aprovada no alvo autorizado, caso todos os portões de segurança e limites de política sejam validados.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Ação Permitida</label>
                        <div className="p-2 border border-border/40 bg-black/40 font-mono text-[11px] text-white">
                          Pausa de Mídia Paga (paid_media_pause)
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Provedor</label>
                        <select 
                          className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                          value={provider}
                          onChange={e => {
                            setProvider(e.target.value as ConditionalExecutionPolicyInputActionProvider);
                            setSelectedAccountId("");
                            setSelectedEntityId("");
                          }}
                        >
                          <option value="meta_ads">Meta Ads</option>
                          <option value="tiktok_ads">TikTok Ads</option>
                          <option value="google_ads">Google Ads</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Conta Alvo</label>
                        <select 
                          className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                          value={selectedAccountId}
                          onChange={e => {
                            setSelectedAccountId(e.target.value);
                            setSelectedEntityId("");
                          }}
                        >
                          <option value="">-- Selecione uma conta ({safeAccounts.length} disponíveis) --</option>
                          {safeAccounts.map((acc: PaidMediaAccount) => (
                            <option key={acc.id} value={acc.id}>{acc.accountName || acc.providerAccountId}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Entidade Alvo (De Propostas de Mídia)</label>
                        <select 
                          className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                          value={selectedEntityId}
                          onChange={e => setSelectedEntityId(e.target.value)}
                          disabled={!selectedAccountId}
                        >
                          <option value="">-- Selecione uma entidade / campanha ({safeProposals.length} propostas compatíveis) --</option>
                          {safeProposals.filter((p: PaidMediaProposal) => p.status === 'approved' && p.actionType === 'pause' && p.provider === provider && p.accountId === selectedAccountId && p.entityId).map((p: PaidMediaProposal) => (
                            <option key={p.id} value={p.entityId!}>{p.recommendation?.substring(0,60)}... ({p.entityId})</option>
                          ))}
                        </select>
                        {!selectedAccountId && <p className="font-mono text-[8px] text-muted-foreground mt-1">Selecione uma conta primeiro.</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Teto Máximo / Dia</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="10" 
                            className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                            value={maxActions}
                            onChange={e => setMaxActions(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Expira Em (Horas)</label>
                          <select
                            className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                            value={expiresInHours}
                            onChange={e => setExpiresInHours(Number(e.target.value))}
                          >
                            <option value={12}>12 Horas</option>
                            <option value={24}>24 Horas</option>
                            <option value={48}>48 Horas</option>
                            <option value={72}>72 Horas</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/20">
                        <Button 
                          onClick={handleCreate} 
                          disabled={isCreating || !selectedAccountId || !selectedEntityId}
                          className="w-full font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 rounded-none h-10"
                        >
                          {isCreating ? "Autorizando..." : "Autorizar Execução Condicional"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
