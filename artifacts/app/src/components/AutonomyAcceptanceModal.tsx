import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAutonomyStatusQueryKey, getGetCampaignQueryKey, getListAutonomyEvidenceQueryKey, useAcceptAutonomyContract, type AutonomyStatus, type AutonomyAcceptanceInputAcceptanceTypesItem } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, Info, KeyRound, Loader2, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  campaignId?: string;
  autonomyStatus: AutonomyStatus;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AutonomyAcceptanceModal({ campaignId, autonomyStatus, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [acceptedTypes, setAcceptedTypes] = useState<Set<string>>(new Set());
  const missing = autonomyStatus.missingAcceptanceTypes || [];
  
  const acceptMutation = useAcceptAutonomyContract();

  const handleAccept = () => {
    if (acceptedTypes.size < missing.length) return;
    
    const idempotencyKey = `accept-${crypto.randomUUID()}`;
    
    acceptMutation.mutate({
      data: {
        campaignId,
        acceptanceTypes: Array.from(acceptedTypes) as AutonomyAcceptanceInputAcceptanceTypesItem[],
        idempotencyKey,
      }
    }, {
      onSuccess: () => {
        toast.success("Autorizações registradas com sucesso.");
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey(campaignId ? { campaignId } : undefined) });
        queryClient.invalidateQueries({ queryKey: getListAutonomyEvidenceQueryKey(campaignId ? { campaignId } : undefined) });
        if (campaignId) {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        }
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err?.data?.error || "Erro ao registrar aceites.");
      }
    });
  };

  const handleToggle = (type: string, checked: boolean) => {
    setAcceptedTypes(prev => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  };

  const TYPE_LABELS: Record<string, string> = {
    autonomy: "Autorização de Autonomia do Agente",
    regulated_activity: "Ciência de Atividade Regulada",
    asset_rights: "Uso de Imagem e Direitos Autorais",
  };

  const TYPE_DESCRIPTIONS: Record<string, string> = {
    autonomy: "Autorizo os agentes a executar e publicar dentro do Masterplan e dos limites aprovados. Otimizações na mesma plataforma podem ser automáticas; realocações entre plataformas exigem nova aprovação.",
    regulated_activity: "Declaro que minha atuação envolve áreas sensíveis/reguladas (saúde, finanças, direito, etc) e assumo a responsabilidade pelas promessas geradas e anunciadas.",
    asset_rights: "Garanto que possuo os direitos de imagem e áudio fornecidos à plataforma, e autorizo a manipulação destes ativos pela inteligência artificial para fins de campanha.",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-muted/10 shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 rounded-full shrink-0">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-foreground">Autorização Requerida</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Para iniciar a execução, precisamos da sua confirmação explícita sobre a autonomia do sistema e suas responsabilidades. Isto não é aprovação legal, mas o aceite operacional obrigatório.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            <div className="border border-border/50 bg-background/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-destructive" />
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Resumo do Contrato ({autonomyStatus.contract?.version})</h3>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>1. <strong>Você continua no controle:</strong> O NexOS executa as estratégias, mas você é o responsável final pelo conteúdo aprovado e lançado.</p>
                <p>2. <strong>Limites de autonomia:</strong> Os agentes operam somente dentro do Masterplan, dos canais e dos orçamentos aprovados. Mover verba entre plataformas sempre exige sua aprovação.</p>
                <p>3. <strong>Conformidade:</strong> Você declara possuir as licenças, autorizações e direitos necessários. O NexOS mantém pausas obrigatórias para riscos graves e não substitui orientação jurídica.</p>
                <p className="pt-2 font-mono text-[10px] opacity-50 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Hash: {autonomyStatus.contract?.hash}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-mono text-sm uppercase tracking-widest font-bold">Aceites Pendentes</h3>
              {missing.map((type) => (
                <div key={type} className="flex items-start space-x-3 border border-border/30 p-4 bg-muted/5 transition-colors hover:bg-muted/10">
                  <Checkbox 
                    id={`accept-${type}`} 
                    checked={acceptedTypes.has(type)}
                    onCheckedChange={(c) => handleToggle(type, !!c)}
                    className="mt-0.5 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
                    data-testid={`checkbox-${type}`}
                  />
                  <div className="grid gap-1.5 leading-none cursor-pointer" onClick={() => handleToggle(type, !acceptedTypes.has(type))}>
                    <label htmlFor={`accept-${type}`} className="text-sm font-semibold font-mono uppercase cursor-pointer">
                      {TYPE_LABELS[type] || type}
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {TYPE_DESCRIPTIONS[type] || ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 p-3 bg-yellow-400/10 border border-yellow-400/20 text-yellow-500 text-xs">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>O NexOS possui proteções de pausa obrigatórias para prevenir execuções descontroladas, mas a responsabilidade pelo que é veiculado é do usuário. Verifique suas campanhas ativas regularmente.</p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-muted/10 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onCancel} className="font-mono uppercase text-xs tracking-widest" data-testid="button-cancel-autonomy">
            Cancelar Lançamento
          </Button>
          <Button 
            onClick={handleAccept} 
            disabled={acceptedTypes.size < missing.length || acceptMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono uppercase text-xs tracking-widest"
            data-testid="button-accept-autonomy"
          >
            {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {acceptMutation.isPending ? "Registrando..." : "Autorizar e Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
