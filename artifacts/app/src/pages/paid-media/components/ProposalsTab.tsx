import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  useListPaidMediaProposals, 
  useApprovePaidMediaProposal,
  useRejectPaidMediaProposal,
  useExecutePaidMediaProposal,
  getListPaidMediaProposalsQueryKey 
} from "@workspace/api-client-react";
import { Check, X, Play, FileText, BarChart, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

export function ProposalsTab() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const queryClient = useQueryClient();
  const { data: proposalsData, isLoading } = useListPaidMediaProposals({
    query: { queryKey: getListPaidMediaProposalsQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  
  const approveMutation = useApprovePaidMediaProposal();
  const rejectMutation = useRejectPaidMediaProposal();
  const executeMutation = useExecutePaidMediaProposal();

  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  const proposals = proposalsData?.proposals || [];

  const handleAction = (action: 'approve' | 'reject' | 'execute', id: string) => {
    let mut: any;
    let payload: any = { id, proposalId: id };
    const actionLabel = action === "approve" ? t("aprovar", "approve", "aprobar") : action === "reject" ? t("rejeitar", "reject", "rechazar") : t("executar", "execute", "ejecutar");
    
    if (action === 'approve') {
      mut = approveMutation;
      payload.data = { comment: "Aprovado via Cockpit de Autonomia NexOS" };
    } else if (action === 'reject') {
      mut = rejectMutation;
      payload.data = { comment: "Rejeitado via Cockpit de Autonomia NexOS" };
    } else {
      mut = executeMutation;
      payload.data = {}; // Ensure data is present if generated hook enforces it
    }

    mut.mutate(payload, {
      onSuccess: () => {
        toast.success(t(`Proposta processada com sucesso: ${actionLabel.toUpperCase()}`, `Proposal processed successfully: ${actionLabel.toUpperCase()}`, `Propuesta procesada correctamente: ${actionLabel.toUpperCase()}`));
        queryClient.invalidateQueries({ queryKey: getListPaidMediaProposalsQueryKey() });
        if (selectedProposal?.id === id) setSelectedProposal(null);
      },
      onError: (err: any) => toast.error(err?.message || t(`Erro ao processar ação '${actionLabel}'.`, `Failed to process the '${actionLabel}' action.`, `No se pudo procesar la acción '${actionLabel}'.`))
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending_approval': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'approved': return 'text-primary bg-primary/10 border-primary/20';
      case 'rejected': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'executing': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'executed': case 'verified': return 'text-success bg-success/10 border-success/20';
      case 'failed': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-muted-foreground bg-muted/10 border-border/20';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending_approval": return t("Aguardando aprovação", "Pending approval", "Pendiente de aprobación");
      case "approved": return t("Aprovada", "Approved", "Aprobada");
      case "rejected": return t("Rejeitada", "Rejected", "Rechazada");
      case "executing": return t("Em execução", "Executing", "En ejecución");
      case "executed": return t("Executada", "Executed", "Ejecutada");
      case "verified": return t("Verificada", "Verified", "Verificada");
      case "failed": return t("Falhou", "Failed", "Fallida");
      default: return status.replace(/_/g, " ");
    }
  };

  if (isLoading) return <div className="text-muted-foreground animate-pulse font-mono text-xs">{t("Analisando propostas de otimização no motor de inteligência...", "Analyzing optimization proposals in the intelligence engine...", "Analizando propuestas de optimización en el motor de inteligencia...")}</div>;
  if (!proposals.length) return <div className="text-muted-foreground font-mono text-xs p-4">{t("Nenhuma proposta de otimização identificada no ciclo atual. A IA continua monitorando o mercado.", "No optimization proposals found in this cycle. AI is still monitoring the market.", "No se encontraron propuestas de optimización en este ciclo. La IA sigue monitoreando el mercado.")}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {proposals.map((prop: any) => (
          <div key={prop.id} className="card-weapon border border-border/30 rounded-sm p-4 flex flex-col md:flex-row md:items-center gap-4 transition-colors hover:bg-muted/5 group">
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded-sm border ${getStatusColor(prop.status)}`}>
                  {statusLabel(prop.status)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center">
                  {prop.provider.replace('_', ' ')} <ChevronRight className="h-3 w-3 mx-0.5" /> {prop.actionType.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="font-mono text-sm font-semibold truncate text-foreground">
                {prop.recommendation}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                 {t("ID alvo:", "Target ID:", "ID de destino:")} {prop.entityId} | {t("Expira em:", "Expires:", "Caduca:")} {new Date(prop.expiresAt).toLocaleString(intlLocale(locale))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 border-t border-border/20 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
              <Button variant="outline" size="sm" onClick={() => setSelectedProposal(prop)} className="h-8 font-mono text-[10px] uppercase">
                <BarChart className="h-3 w-3 mr-2" /> {t("Contexto IA", "AI Context", "Contexto de IA")}
              </Button>
              
              {prop.status === 'pending_approval' && (
                <>
                  <Button variant="outline" size="icon" aria-label={t("Rejeitar Otimização", "Reject Optimization", "Rechazar optimización")} onClick={() => handleAction('reject', prop.id)} className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={rejectMutation.isPending} title={t("Rejeitar Otimização", "Reject Optimization", "Rechazar optimización")}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" aria-label={t("Aprovar Modificação", "Approve Change", "Aprobar modificación")} onClick={() => handleAction('approve', prop.id)} className="h-8 w-8 bg-success/20 text-success border border-success/30 hover:bg-success/30 hover:text-success-foreground" disabled={approveMutation.isPending} title={t("Aprovar Modificação", "Approve Change", "Aprobar modificación")}>
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              )}

              {prop.status === 'approved' && (
                <Button onClick={() => handleAction('execute', prop.id)} className="h-8 font-mono text-[10px] uppercase btn-weapon-primary px-4" disabled={executeMutation.isPending}>
                  <Play className="h-3 w-3 mr-2" /> {t("Disparar Deploy", "Deploy", "Implementar")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedProposal} onOpenChange={(o) => !o && setSelectedProposal(null)}>
        <DialogContent className="max-w-3xl bg-card border border-border/50 rounded-none font-mono">
          <DialogHeader>
            <DialogTitle className="text-primary uppercase tracking-widest flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("Dossiê de Otimização", "Optimization Report", "Informe de optimización")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("Detalhes técnicos e justificativa da IA para esta proposta de otimização de campanha.", "Technical details and AI rationale for this campaign optimization proposal.", "Detalles técnicos y razonamiento de la IA para esta propuesta de optimización de campaña.")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProposal && (
            <div className="space-y-6 mt-4 text-xs">
              <div className="bg-muted/10 p-4 border border-border/30 rounded-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h4 className="text-[10px] uppercase tracking-widest text-primary mb-2">{t("Justificativa da Inteligência", "Intelligence Rationale", "Justificación de inteligencia")}</h4>
                <p className="text-foreground text-sm leading-relaxed">{selectedProposal.recommendation}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-border/30 rounded-sm flex flex-col">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground p-3 border-b border-border/30 bg-muted/20">{t("Referência atual", "Current Baseline", "Referencia actual")}</h4>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap p-3 overflow-x-auto flex-1">
                    {JSON.stringify(selectedProposal.beforeAllocation || { message: t("Sem dados prévios disponíveis ou irrelevantes.", "No prior data available or relevant.", "No hay datos previos disponibles o relevantes.") }, null, 2)}
                  </pre>
                </div>
                <div className="border border-primary/30 rounded-sm bg-primary/5 flex flex-col shadow-[0_0_15px_hsl(var(--primary)/0.05)]">
                  <h4 className="text-[10px] uppercase tracking-widest text-primary p-3 border-b border-primary/20 bg-primary/10">{t("Projeção / Modificação", "Projection / Change", "Proyección / modificación")}</h4>
                  <pre className="text-[10px] text-primary/80 whitespace-pre-wrap p-3 overflow-x-auto flex-1">
                    {JSON.stringify(selectedProposal.afterAllocation || selectedProposal.simulation || selectedProposal.requestedChange || { status: t("Ação estrutural solicitada", "Structural change requested", "Cambio estructural solicitado") }, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="border border-border/30 rounded-sm">
                <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground p-3 border-b border-border/30 bg-muted/20">{t("Evidências e métricas de referência", "Evidence and Baseline Metrics", "Evidencias y métricas de referencia")}</h4>
                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap p-3 overflow-x-auto">
                  {JSON.stringify(selectedProposal.metrics || {}, null, 2)}
                </pre>
              </div>

              {selectedProposal.status === 'pending_approval' && (
                <div className="flex gap-3 justify-end pt-4 border-t border-border/30">
                  <Button variant="outline" onClick={() => handleAction('reject', selectedProposal.id)} className="font-mono text-xs uppercase text-destructive border-destructive/30 hover:bg-destructive/10 h-9">
                    <X className="h-3 w-3 mr-2" /> {t("Rejeitar Intervenção", "Reject Change", "Rechazar intervención")}
                  </Button>
                  <Button onClick={() => handleAction('approve', selectedProposal.id)} className="font-mono text-xs uppercase bg-success text-success-foreground hover:bg-success/90 h-9 px-6">
                    <Check className="h-3 w-3 mr-2" /> {t("Autorizar", "Authorize", "Autorizar")}
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
