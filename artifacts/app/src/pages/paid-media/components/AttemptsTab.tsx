import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  useListPaidMediaActionAttempts,
  useRollbackPaidMediaActionAttempt,
  getListPaidMediaActionAttemptsQueryKey
} from "@workspace/api-client-react";
import { RotateCcw, ShieldCheck, AlertCircle, FileCode2, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function AttemptsTab() {
  const queryClient = useQueryClient();
  const { data: attemptsData, isLoading } = useListPaidMediaActionAttempts({
    query: { queryKey: getListPaidMediaActionAttemptsQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  const rollbackMutation = useRollbackPaidMediaActionAttempt();

  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);

  const attempts = attemptsData?.attempts || [];

  const handleRollback = (id: string) => {
    if (!confirm("Esta ação emitirá uma nova requisição ao provedor revertendo as mudanças. Confirma o rollback imutável?")) return;
    
    rollbackMutation.mutate({ id, attemptId: id, data: {} } as any, {
      onSuccess: () => {
        toast.success("Procedimento de rollback isolado emitido para o provedor.");
        queryClient.invalidateQueries({ queryKey: getListPaidMediaActionAttemptsQueryKey() });
        setSelectedAttempt(null);
      },
      onError: (err: any) => toast.error(err?.message || "Erro crasso ao solicitar rollback. Verifique as credenciais.")
    });
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'succeeded': 
      case 'verified': 
        return <ShieldCheck className="h-4 w-4 text-success" />;
      case 'failed': 
      case 'verification_failed': 
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'rolled_back': 
        return <RotateCcw className="h-4 w-4 text-yellow-400" />;
      case 'executing':
      case 'pending':
        return <Play className="h-4 w-4 text-primary animate-pulse" />;
      default: 
        return <div className="h-2 w-2 rounded-full bg-primary animate-pulse ml-1" />;
    }
  };

  if (isLoading) return <div className="text-muted-foreground animate-pulse font-mono text-xs">Analisando ledger imutável de transações...</div>;
  if (!attempts.length) return <div className="text-muted-foreground font-mono text-xs p-4">O ledger de ações está limpo. Nenhuma operação finalizada.</div>;

  return (
    <div className="space-y-4">
      <div className="border border-border/40 rounded-sm overflow-hidden bg-card/30">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-muted/20 text-muted-foreground text-[10px] uppercase tracking-widest border-b border-border/40">
            <tr>
              <th className="p-3 font-normal">State</th>
              <th className="p-3 font-normal">Transação / Ref Proposta</th>
              <th className="p-3 font-normal">Timestamp Execução</th>
              <th className="p-3 font-normal text-right">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {attempts.map((att: any) => (
              <tr key={att.id} className="table-row-glow cursor-pointer group" onClick={() => setSelectedAttempt(att)}>
                <td className="p-3 flex items-center gap-2">
                  {getStatusIcon(att.status)}
                  <span className="uppercase tracking-widest font-semibold">{att.status.replace(/_/g, ' ')}</span>
                </td>
                <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={att.proposalId}>
                  {att.proposalId}
                </td>
                <td className="p-3 text-muted-foreground">
                  {att.completedAt ? new Date(att.completedAt).toLocaleString() : 'Processing...'}
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" aria-label="Ver auditoria da transação" className="h-7 w-7 text-primary hover:bg-primary/10 border border-transparent group-hover:border-primary/20">
                    <FileCode2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selectedAttempt} onOpenChange={(o) => !o && setSelectedAttempt(null)}>
        <DialogContent className="max-w-3xl bg-card border border-border/50 rounded-none font-mono">
          <DialogHeader>
            <DialogTitle className="text-primary uppercase tracking-widest flex items-center gap-2">
              <FileCode2 className="h-4 w-4" /> Dossiê de Auditoria (Ledger)
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalhes da execução no provedor, respostas brutas e evidências de auditoria.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAttempt && (
            <div className="space-y-4 mt-4 text-xs overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin">
              
              <div className="grid grid-cols-3 gap-4 border-b border-border/30 pb-4">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase mb-1 tracking-widest">Transaction Status</div>
                  <div className="font-bold flex items-center gap-2 text-sm">
                    {getStatusIcon(selectedAttempt.status)}
                    <span className="uppercase">{selectedAttempt.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase mb-1 tracking-widest">Início</div>
                  <div className="font-bold text-foreground">{selectedAttempt.startedAt ? new Date(selectedAttempt.startedAt).toLocaleString() : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase mb-1 tracking-widest">Conclusão</div>
                  <div className="font-bold text-foreground">{selectedAttempt.completedAt ? new Date(selectedAttempt.completedAt).toLocaleString() : 'Pendente'}</div>
                </div>
              </div>

              {selectedAttempt.errorMessage && (
                <div className="bg-destructive/10 border border-destructive/30 p-4 rounded-sm text-destructive">
                  <div className="font-bold text-[10px] uppercase mb-2 tracking-widest flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Falha Crítica de Provider
                  </div>
                  <div className="font-mono text-sm leading-relaxed">{selectedAttempt.errorMessage}</div>
                  {selectedAttempt.errorCode && <div className="text-[10px] mt-2 opacity-70">Provider Code: {selectedAttempt.errorCode}</div>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border/30 rounded-sm flex flex-col">
                  <div className="bg-muted/20 p-2 border-b border-border/30 text-[10px] uppercase tracking-widest text-muted-foreground">Snapshot Origem (State Anterior)</div>
                  <div className="p-3 overflow-x-auto flex-1">
                    <pre className="text-[10px] text-muted-foreground">{JSON.stringify(selectedAttempt.beforeSnapshot || {}, null, 2)}</pre>
                  </div>
                </div>

                <div className="border border-primary/20 rounded-sm flex flex-col bg-primary/5">
                  <div className="bg-primary/10 p-2 border-b border-primary/20 text-[10px] uppercase tracking-widest text-primary">Raw Provider Response (Destino)</div>
                  <div className="p-3 overflow-x-auto flex-1">
                    <pre className="text-[10px] text-primary/80">{JSON.stringify(selectedAttempt.providerResponse || { status: 'pending_receipt' }, null, 2)}</pre>
                  </div>
                </div>
              </div>

              {selectedAttempt.verificationEvidence && (
                <div className="border border-border/30 rounded-sm">
                  <div className="bg-muted/20 p-2 border-b border-border/30 text-[10px] uppercase tracking-widest text-muted-foreground">Evidência de Validação</div>
                  <div className="p-3 overflow-x-auto">
                    <pre className="text-[10px] text-foreground">{JSON.stringify(selectedAttempt.verificationEvidence, null, 2)}</pre>
                  </div>
                </div>
              )}

              {(selectedAttempt.status === 'succeeded' || selectedAttempt.status === 'verified') && (
                <div className="pt-4 mt-2 flex justify-end">
                  <Button onClick={() => handleRollback(selectedAttempt.id)} className="h-9 font-mono text-[10px] uppercase bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/30 px-6" disabled={rollbackMutation.isPending}>
                    <RotateCcw className="h-3 w-3 mr-2" /> Rollback Mandatório
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
