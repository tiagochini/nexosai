import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListRealizationContracts,
  getListRealizationContractsQueryKey,
  useGetRealizationContract,
  getGetRealizationContractQueryKey,
  usePreflightRealization,
  useExecuteRealization,
  useRetryRealization,
  useQcRealization,
  useMonitorRealization,
  useCompensateRealization,
  type RealizationContract,
  type RealizationAttempt,
  type RealizationEvent,
} from "@workspace/api-client-react";
import { Activity, Power, Settings, Shield, RefreshCw, Layers, CheckCircle2, AlertTriangle, ExternalLink, Cpu, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface Props {
  campaignId: string;
}

export function RealizationContractPanel({ campaignId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const { data: contracts, isLoading } = useListRealizationContracts({
    campaignId
  }, {
    query: {
      queryKey: getListRealizationContractsQueryKey({ campaignId }),
      refetchInterval: 5000,
    }
  });

  const safeContracts = contracts || [];
  const activeContracts = safeContracts.filter(c => !["proposal", "exception", "failed", "compensated"].includes(c.state));
  const hasActive = activeContracts.length > 0;
  
  return (
    <>
      <section className="border border-primary/30 bg-black/60 backdrop-blur-md overflow-hidden relative group flex flex-col h-[350px]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="p-3 border-b border-primary/20 flex justify-between items-center bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">M09 Realization Engine</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
             {hasActive ? (
               <div className="px-2 py-0.5 border border-primary/40 bg-primary/10 text-primary font-mono text-[9px] uppercase tracking-wider">
                 Active ({activeContracts.length})
               </div>
             ) : (
               <div className="px-2 py-0.5 border border-border/40 bg-background/30 text-muted-foreground font-mono text-[9px] uppercase tracking-wider">
                 Idle
               </div>
             )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-0 hide-scrollbar">
          {isLoading ? (
             <div className="flex justify-center items-center h-full">
               <RefreshCw className="h-4 w-4 text-primary animate-spin" />
             </div>
          ) : safeContracts.length > 0 ? (
            <div className="divide-y divide-border/10">
              {safeContracts.map(contract => (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="w-full text-left block px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/5 group/row"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-3 w-3 text-primary" />
                        <span className="font-mono text-[11px] uppercase tracking-widest font-bold text-primary">
                          {contract.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="font-sans text-xs text-foreground/80 mb-1.5 line-clamp-1">
                        Contract: {contract.id.substring(0, 8)} | Target: {contract.subjectId.substring(0, 8)}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                        <span className="px-1 border border-border/40 text-muted-foreground bg-black/40">{contract.state}</span>
                        <span>Attempts: {contract.attemptsUsed}/{contract.maxAttempts}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center text-center h-full">
              <Cpu className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold">No Active Contracts</div>
              <div className="font-mono text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-widest leading-relaxed">
                Nenhum contrato de realizacao persistido.
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-black/40 border-t border-primary/20 shrink-0">
          <Button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full font-mono text-[10px] uppercase tracking-widest border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/70 hover:text-primary rounded-none h-10 transition-colors"
          >
            Abrir Central de Realizacoes
          </Button>
        </div>
      </section>

      <RealizationDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        campaignId={campaignId}
      />
    </>
  );
}

function RealizationDrawer({ open, onOpenChange, campaignId }: { open: boolean, onOpenChange: (o: boolean) => void, campaignId: string }) {
  const { data: contracts, isLoading } = useListRealizationContracts({ campaignId }, {
    query: {
      enabled: open,
      queryKey: getListRealizationContractsQueryKey({ campaignId }),
      refetchInterval: 5000,
    }
  });

  const safeContracts = contracts || [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none">
        <div className="mx-auto w-full max-w-[1200px] overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/20 shrink-0 p-4 bg-[#030712] flex justify-between items-start">
            <div>
              <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                M09 Realization Engine
              </DrawerTitle>
              <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                Governanca de operacoes de midia paga via orquestrador autonomo.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="font-mono text-[9px] uppercase tracking-widest h-8 rounded-none border-border/40 hover:bg-white/5">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-[#010308] p-4 md:p-6 hide-scrollbar">
            {isLoading ? (
               <div className="flex justify-center items-center h-32">
                 <RefreshCw className="h-5 w-5 text-primary animate-spin" />
               </div>
            ) : safeContracts.length > 0 ? (
              <div className="space-y-6">
                {safeContracts.map(contract => (
                  <ContractDetail key={contract.id} contractId={contract.id} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-border/30 bg-black/20 flex flex-col items-center justify-center">
                <Shield className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <div className="font-mono text-[12px] uppercase tracking-widest text-muted-foreground font-bold">Nenhum contrato existente</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-2 max-w-lg">
                  Nao existe nenhuma operacao solicitada nesta campanha. 
                  (A criacao manual de contratos pelo painel nao e suportada se nao houver um Approval Subject aprovado correspondente.)
                </div>
              </div>
            )}
            
            <div className="mt-8 border border-border/30 bg-black/40 p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-white mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Coverage & Governance
              </h3>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                VEREDICTO DE GOVERNANCA: Apenas as acoes <span className="text-white">paid_media_pause</span> e <span className="text-white">paid_media_launch</span> sao governadas e suportadas no M09.
                Qualquer outro vertical (email, whatsapp, content) e considerado unsupported/not governed. A execucao e estritamente controlada atraves de State Machine e Checkpoints de Qualidade.
              </p>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ContractDetail({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetRealizationContract(contractId, {
    query: {
      queryKey: getGetRealizationContractQueryKey(contractId),
      refetchInterval: 3000,
    }
  });

  const preflight = usePreflightRealization();
  const execute = useExecuteRealization();
  const retry = useRetryRealization();
  const qc = useQcRealization();
  const monitor = useMonitorRealization();
  const compensate = useCompensateRealization();

  if (isLoading || !data) {
    return (
      <div className="border border-border/20 p-4 bg-black/40 flex justify-center">
        <RefreshCw className="h-4 w-4 text-primary animate-spin" />
      </div>
    );
  }

  const { contract, attempts, events } = data;
  
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetRealizationContractQueryKey(contractId) });
  };
  
  const isGoverned = contract.action === "paid_media_pause" || contract.action === "paid_media_launch";
  
  return (
    <div className="border border-border/30 bg-black/40 overflow-hidden">
      <div className="p-4 border-b border-border/20 bg-black/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-[12px] uppercase tracking-widest text-primary font-bold">
              {contract.action}
            </h3>
            {!isGoverned && (
              <span className="px-1.5 py-0.5 border border-[#FFB000]/40 bg-[#FFB000]/10 text-[#FFB000] font-mono text-[8px] uppercase tracking-wider">
                Unsupported
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-3">
            <span>ID: {contract.id.substring(0, 13)}</span>
            <span>Target: {contract.subjectId.substring(0, 8)}</span>
          </div>
        </div>
        
        <div className="flex flex-col md:items-end gap-1">
          <span className="px-2 py-1 border border-primary/30 bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-widest font-bold text-center">
            State: {contract.state}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">
            Attempts: {contract.attemptsUsed}/{contract.maxAttempts}
          </span>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border/20 p-3 bg-black/20">
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Binding Integrity</h4>
            <div className="space-y-1 font-mono text-[9px] text-white break-all">
              <div><span className="text-muted-foreground">Snapshot Hash:</span> {contract.snapshotHash}</div>
              <div><span className="text-muted-foreground">Binding Hash:</span> {contract.bindingHash}</div>
              <div><span className="text-muted-foreground">Masterplan ID:</span> {contract.masterplanVersionId}</div>
            </div>
          </div>
          
          <div className="border border-border/20 p-3 bg-black/20">
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Manual Intervention</h4>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" variant="outline" 
                disabled={!["approval_binding", "blocked"].includes(contract.state) || preflight.isPending}
                onClick={() => preflight.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none"
              >Preflight</Button>
              <Button 
                size="sm" variant="outline" 
                disabled={contract.state !== "preflight" || execute.isPending}
                onClick={() => execute.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none border-primary/40 text-primary hover:bg-primary/10"
              >Execute</Button>
              <Button 
                size="sm" variant="outline" 
                disabled={contract.state !== "provider_confirmed" || qc.isPending}
                onClick={() => qc.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none"
              >QC</Button>
              <Button 
                size="sm" variant="outline" 
                disabled={contract.state !== "artifact_qc" || monitor.isPending}
                onClick={() => monitor.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none"
              >Monitor</Button>
              <Button 
                size="sm" variant="outline" 
                disabled={contract.state !== "retryable" || retry.isPending}
                onClick={() => retry.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none border-[#FFB000]/40 text-[#FFB000] hover:bg-[#FFB000]/10"
              >Retry</Button>
              <Button 
                size="sm" variant="outline" 
                disabled={contract.state !== "recovery" || compensate.isPending}
                onClick={() => compensate.mutate({ id: contract.id }, { onSuccess: refresh })}
                className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none border-destructive/40 text-destructive hover:bg-destructive/10"
              >Compensate</Button>
            </div>
          </div>
        </div>

        {attempts && attempts.length > 0 && (
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-white border-b border-border/20 pb-2 mb-3">Timeline (Attempts)</h4>
            <div className="space-y-3">
              {attempts.map(attempt => (
                <div key={attempt.id} className="border border-border/20 bg-black/40 p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Attempt #{attempt.number}</span>
                      <span className={`px-1.5 py-0.5 border font-mono text-[8px] uppercase tracking-wider ${
                        attempt.state === 'confirmed' ? 'border-success/30 text-success bg-success/5' : 
                        attempt.state === 'failed' ? 'border-destructive/30 text-destructive bg-destructive/5' : 
                        'border-border/40 text-muted-foreground'
                      }`}>
                        {attempt.state}
                      </span>
                    </div>
                    <span className="font-mono text-[8px] text-muted-foreground">{new Date(attempt.claimedAt).toLocaleString()}</span>
                  </div>
                  
                  {attempt.error && (
                    <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 text-destructive font-mono text-[9px]">
                      ERROR: {JSON.stringify(attempt.error)}
                    </div>
                  )}
                  {attempt.receipt && (
                    <div className="mt-2 p-2 bg-black/60 border border-white/5 font-mono text-[8px] text-muted-foreground break-all whitespace-pre-wrap">
                      <div className="text-white/50 uppercase tracking-widest mb-1">Provider Receipt</div>
                      {JSON.stringify(attempt.receipt, null, 2)}
                    </div>
                  )}
                  {attempt.qc && (
                    <div className="mt-2 p-2 bg-black/60 border border-white/5 font-mono text-[8px] text-muted-foreground break-all whitespace-pre-wrap">
                      <div className="text-white/50 uppercase tracking-widest mb-1">QC Result</div>
                      {JSON.stringify(attempt.qc, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
