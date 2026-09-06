import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetAutonomyStatus, getGetAutonomyStatusQueryKey,
  useListAutonomyEvidence, getListAutonomyEvidenceQueryKey,
  useRevokeAutonomyAcceptance
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, Activity, KeyRound, Clock, Loader2, XCircle, FileSignature
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function SectionCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: React.ElementType }) {
  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />
      <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ label, sublabel, children }: { label: string; sublabel?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 py-4 border-b border-border/30 last:border-0">
      <div className="md:w-48 shrink-0">
        <div className="font-mono text-xs text-foreground/90 font-semibold">{label}</div>
        {sublabel && <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{sublabel}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  autonomy: "Autonomia do Agente",
  regulated_activity: "Atividade Regulada",
  asset_rights: "Direitos de Ativos",
};

export function AutonomyTab() {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: statusData, isLoading: isLoadingStatus } = useGetAutonomyStatus();
  const { data: evidenceData, isLoading: isLoadingEvidence } = useListAutonomyEvidence();

  const revokeMutation = useRevokeAutonomyAcceptance();

  const handleRevoke = (acceptanceId: string) => {
    if (!revokeReason.trim()) {
      toast.error("Informe o motivo da revogação.");
      return;
    }
    
    revokeMutation.mutate(
      { acceptanceId, data: { reason: revokeReason } },
      {
        onSuccess: () => {
          toast.success("Autorização revogada com sucesso.");
          queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAutonomyEvidenceQueryKey() });
          setRevokingId(null);
          setRevokeReason("");
        },
        onError: () => {
          toast.error("Erro ao revogar autorização.");
        }
      }
    );
  };

  if (isLoadingStatus || isLoadingEvidence) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-none" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  const { contract, requiredAcceptanceTypes = [], acceptedAcceptanceTypes = [], missingAcceptanceTypes = [] } = statusData || {};
  const acceptances = evidenceData?.acceptances || [];

  return (
    <div className="space-y-6">
      <div className="p-4 border border-primary/20 bg-primary/5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-mono text-sm uppercase tracking-widest font-bold text-primary">Autonomia da Inteligência Artificial</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Aqui você gerencia os limites de atuação dos agentes. O NexOS permite que a IA tome decisões estratégicas, publique conteúdo e aloque orçamento de mídia.
             <strong> A revogação impede novos lançamentos que dependam desses aceites; operações já iniciadas preservam seu histórico e seguem os controles do Masterplan.</strong>
          </p>
        </div>
      </div>

      <SectionCard title="Contrato Vigente" icon={FileSignature}>
        <FieldRow label="Versão e Integridade" sublabel="Hash criptográfico do contrato">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-none font-mono text-[10px] bg-muted/20 border-border/50">
                v{contract?.version || "0.0.0"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">Última atualização do sistema</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/10 border border-border/30">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="font-mono text-[10px] text-muted-foreground break-all">{contract?.hash || "---"}</code>
            </div>
          </div>
        </FieldRow>

        <FieldRow label="Status de Aceite Global" sublabel="Requisitos para operação">
          <div className="space-y-3">
            {requiredAcceptanceTypes.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">Nenhum requisito aplicável no momento.</p>
            )}
            {requiredAcceptanceTypes.map((type) => {
              const isAccepted = acceptedAcceptanceTypes.includes(type);
              return (
                <div key={type} className={`flex items-center justify-between p-3 border ${isAccepted ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div>
                    <div className="font-mono text-xs font-bold uppercase">{TYPE_LABELS[type] || type}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {isAccepted ? "Autorização ativa." : "Autorização pendente. O lançamento será bloqueado."}
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest ${isAccepted ? 'text-success border-success/40' : 'text-destructive border-destructive/40'}`}>
                    {isAccepted ? 'Aceito' : 'Pendente'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </FieldRow>
      </SectionCard>

      <SectionCard title="Evidências de Aceite e Revogação" icon={Activity}>
        <div className="space-y-4">
          {acceptances.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-4 border border-dashed border-border/40">Nenhum registro de aceite encontrado.</p>
          ) : (
            acceptances.map((acc) => (
              <div key={acc.id} className={`border border-border/40 p-4 ${acc.revokedAt ? 'bg-muted/10 opacity-70' : 'bg-card'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-mono text-xs font-bold uppercase text-foreground">{TYPE_LABELS[acc.acceptanceType] || acc.acceptanceType}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {format(new Date(acc.acceptedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest ${acc.revokedAt ? 'text-destructive border-destructive/40' : 'text-success border-success/40'}`}>
                    {acc.revokedAt ? 'Revogado' : 'Ativo'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 font-mono text-[10px] text-muted-foreground">
                  <div>
                    <span className="opacity-50">Campanha:</span> <span className="text-foreground">{acc.campaignId || "Global (Todas)"}</span>
                  </div>
                  <div>
                    <span className="opacity-50">Contrato:</span> <span className="text-foreground">v{acc.contractVersion}</span>
                  </div>
                  <div>
                    <span className="opacity-50">IP:</span> <span className="text-foreground">{acc.ipAddress || "---"}</span>
                  </div>
                </div>

                {acc.revokedAt ? (
                  <div className="p-2 border border-destructive/20 bg-destructive/5 font-mono text-[10px] text-destructive">
                    Revogado em {format(new Date(acc.revokedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}.<br/>
                    Motivo: {acc.revocationReason}
                  </div>
                ) : (
                  <div className="flex justify-end pt-2 border-t border-border/30">
                    {revokingId === acc.id ? (
                      <div className="w-full flex items-center gap-2">
                        <Input
                          placeholder="Motivo da revogação..."
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          className="h-8 font-mono text-xs rounded-none bg-background border-border/50 flex-1"
                          data-testid={`input-revoke-${acc.id}`}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 rounded-none font-mono text-xs hover:bg-muted/20"
                          onClick={() => { setRevokingId(null); setRevokeReason(""); }}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="h-8 px-3 rounded-none font-mono text-xs uppercase tracking-widest"
                          onClick={() => handleRevoke(acc.id)}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-confirm-revoke-${acc.id}`}
                        >
                          {revokeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar Revogação"}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-3 rounded-none font-mono text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive uppercase tracking-widest"
                        onClick={() => setRevokingId(acc.id)}
                        data-testid={`button-revoke-${acc.id}`}
                      >
                        <XCircle className="h-3 w-3 mr-1.5" /> Revogar Autorização
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
