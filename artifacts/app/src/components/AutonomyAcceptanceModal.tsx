import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAutonomyStatusQueryKey, getGetCampaignQueryKey, getListAutonomyEvidenceQueryKey, useAcceptAutonomyContract, type AutonomyStatus, type AutonomyAcceptanceInputAcceptanceTypesItem } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, Info, KeyRound, Loader2, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUiText } from "@/lib/i18n";

interface Props {
  campaignId?: string;
  autonomyStatus: AutonomyStatus;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AutonomyAcceptanceModal({ campaignId, autonomyStatus, onSuccess, onCancel }: Props) {
  const t = useUiText();
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
        toast.success(t("Autorizações registradas com sucesso.", "Authorizations recorded successfully.", "Autorizaciones registradas correctamente."));
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey(campaignId ? { campaignId } : undefined) });
        queryClient.invalidateQueries({ queryKey: getListAutonomyEvidenceQueryKey(campaignId ? { campaignId } : undefined) });
        if (campaignId) {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        }
        onSuccess();
      },
      onError: (err: any) => {
        toast.error(err?.data?.error || t("Erro ao registrar aceites.", "Error recording acceptance.", "Error al registrar la aceptación."));
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
    autonomy: t("Autorização de autonomia do agente", "Agent autonomy authorization", "Autorización de autonomía del agente"),
    regulated_activity: t("Ciência de atividade regulada", "Regulated activity acknowledgment", "Reconocimiento de actividad regulada"),
    asset_rights: t("Uso de imagem e direitos autorais", "Image use and copyright", "Uso de imagen y derechos de autor"),
  };

  const TYPE_DESCRIPTIONS: Record<string, string> = {
    autonomy: t("Autorizo os agentes a executar e publicar dentro do Masterplan e dos limites aprovados. Otimizações na mesma plataforma podem ser automáticas; realocações entre plataformas exigem nova aprovação.", "I authorize agents to execute and publish within the approved Masterplan and limits. Optimizations on the same platform may be automatic; moving budgets across platforms requires new approval.", "Autorizo a los agentes a ejecutar y publicar dentro del Masterplan y los límites aprobados. Las optimizaciones en la misma plataforma pueden ser automáticas; mover presupuesto entre plataformas requiere una nueva aprobación."),
    regulated_activity: t("Declaro que minha atuação envolve áreas sensíveis ou reguladas (saúde, finanças, direito etc.) e assumo a responsabilidade pelas promessas geradas e anunciadas.", "I declare that my work involves sensitive or regulated areas (health, finance, law, etc.) and accept responsibility for the claims generated and advertised.", "Declaro que mi actividad involucra áreas sensibles o reguladas (salud, finanzas, derecho, etc.) y asumo la responsabilidad por las afirmaciones generadas y anunciadas."),
    asset_rights: t("Garanto que possuo os direitos de imagem e áudio fornecidos à plataforma e autorizo que a inteligência artificial manipule esses ativos para fins de campanha.", "I confirm that I own the image and audio rights for assets provided to the platform and authorize AI to modify them for campaign purposes.", "Confirmo que poseo los derechos de imagen y audio de los recursos proporcionados a la plataforma y autorizo que la inteligencia artificial los modifique para la campaña."),
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
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-foreground">{t("Autorização necessária", "Authorization required", "Autorización necesaria")}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t("Para iniciar a execução, precisamos da sua confirmação explícita sobre a autonomia do sistema e suas responsabilidades. Isto não é aprovação legal, mas o aceite operacional obrigatório.", "Before execution begins, we need your explicit confirmation of the system's autonomy and your responsibilities. This is not legal approval; it is required operational consent.", "Para iniciar la ejecución, necesitamos tu confirmación explícita sobre la autonomía del sistema y tus responsabilidades. Esto no es una aprobación legal, sino un consentimiento operativo obligatorio.")}
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
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">{t("Resumo do contrato", "Contract summary", "Resumen del contrato")} ({autonomyStatus.contract?.version})</h3>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>1. <strong>{t("Você continua no controle:", "You remain in control:", "Tú mantienes el control:")}</strong> {t("O NexOS executa as estratégias, mas você é o responsável final pelo conteúdo aprovado e lançado.", "NexOS executes strategies, but you remain ultimately responsible for approved and published content.", "NexOS ejecuta las estrategias, pero tú sigues siendo responsable del contenido aprobado y publicado.")}</p>
                <p>2. <strong>{t("Limites de autonomia:", "Autonomy limits:", "Límites de autonomía:")}</strong> {t("Os agentes operam somente dentro do Masterplan, dos canais e dos orçamentos aprovados. Mover verba entre plataformas sempre exige sua aprovação.", "Agents operate only within the approved Masterplan, channels, and budgets. Moving budget between platforms always requires your approval.", "Los agentes operan únicamente dentro del Masterplan, los canales y los presupuestos aprobados. Mover presupuesto entre plataformas siempre requiere tu aprobación.")}</p>
                <p>3. <strong>{t("Conformidade:", "Compliance:", "Cumplimiento:")}</strong> {t("Você declara possuir as licenças, autorizações e direitos necessários. O NexOS mantém pausas obrigatórias para riscos graves e não substitui orientação jurídica.", "You confirm that you hold the necessary licenses, permissions, and rights. NexOS enforces pauses for serious risks and does not replace legal advice.", "Confirmas que tienes las licencias, autorizaciones y derechos necesarios. NexOS mantiene pausas obligatorias ante riesgos graves y no sustituye el asesoramiento legal.")}</p>
                <p className="pt-2 font-mono text-[10px] opacity-50 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Hash: {autonomyStatus.contract?.hash}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-mono text-sm uppercase tracking-widest font-bold">{t("Autorizações pendentes", "Pending acknowledgments", "Autorizaciones pendientes")}</h3>
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
              <p>{t("O NexOS possui proteções de pausa obrigatórias para prevenir execuções descontroladas, mas a responsabilidade pelo que é veiculado é do usuário. Verifique suas campanhas ativas regularmente.", "NexOS has mandatory pause safeguards to prevent uncontrolled execution, but users remain responsible for published content. Check your active campaigns regularly.", "NexOS cuenta con pausas obligatorias para evitar ejecuciones descontroladas, pero el usuario es responsable del contenido publicado. Revisa tus campañas activas con regularidad.")}</p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-muted/10 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onCancel} className="font-mono uppercase text-xs tracking-widest" data-testid="button-cancel-autonomy">
            {t("Cancelar lançamento", "Cancel launch", "Cancelar lanzamiento")}
          </Button>
          <Button 
            onClick={handleAccept} 
            disabled={acceptedTypes.size < missing.length || acceptMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono uppercase text-xs tracking-widest"
            data-testid="button-accept-autonomy"
          >
            {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {acceptMutation.isPending ? t("Registrando...", "Recording...", "Registrando...") : t("Autorizar e continuar", "Authorize and continue", "Autorizar y continuar")}
          </Button>
        </div>
      </div>
    </div>
  );
}
