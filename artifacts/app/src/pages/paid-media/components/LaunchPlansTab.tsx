import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Rocket, Server, Zap, CheckCircle2, AlertTriangle, RotateCw, Play, X,
  ShieldCheck, ArrowRight, Loader2, GitCommit, Plus
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LaunchPlan {
  id: string;
  campaignId: string;
  provider: string;
  accountId: string;
  masterplanVersionId: string;
  contextFingerprint: string;
  intakeVersionId: string;
  tree: any;
  readiness: any;
  approvalSnapshot: any;
  launchStage: string;
  createdAt: string;
}

import { Link } from "wouter";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

export function LaunchPlansTab() {
  const t = useUiText();
  const qc = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["/api/paid-media/launch-plans"],
    queryFn: () => customFetch<{ launchPlans: LaunchPlan[] }>("/api/paid-media/launch-plans"),
  });

  const launchPlans = plansData?.launchPlans ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div>
          <h3 className="font-mono text-sm uppercase tracking-widest text-foreground flex items-center gap-2">
             <Rocket className="h-4 w-4 text-primary" /> {t("Planos de Lançamento (Mídia Paga)", "Paid Media Launch Plans", "Planes de lanzamiento (medios pagados)")}
          </h3>
          <p className="font-mono text-xs text-muted-foreground mt-1">
             {t("Geração autônoma de estruturas de campanha a partir de um Master Plan aprovado.", "Autonomous campaign structure generation from an approved Master Plan.", "Generación autónoma de estructuras de campaña a partir de un Master Plan aprobado.")}
          </p>
        </div>
        <Button asChild variant="outline" className="font-mono text-xs uppercase tracking-widest gap-2 border-primary/30 text-primary hover:bg-primary/10">
           <Link href="/intake?entryPoint=paid_media">
              <Plus className="h-3.5 w-3.5" /> {t("Compilar Novo", "Compile New", "Crear nuevo")}
           </Link>
        </Button>
      </div>

      {loadingPlans ? (
        <Skeleton className="h-40 w-full bg-muted/20" />
      ) : launchPlans.length === 0 ? (
        <div className="border border-dashed border-border/40 p-12 text-center space-y-3 bg-card/30">
          <Server className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
             {t("Nenhum plano de lançamento ativo", "No active launch plans", "No hay planes de lanzamiento activos")}
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 max-w-md mx-auto">
              {t("Meta Ads, Google Ads e TikTok Ads podem ser conectados desde o primeiro dia para sincronização e diagnóstico. A criação automática da árvore de campanha está homologada apenas para Meta Ads.", "Meta Ads, Google Ads, and TikTok Ads can be connected from day one for syncing and diagnostics. Automatic campaign-tree creation is currently supported only for Meta Ads.", "Meta Ads, Google Ads y TikTok Ads se pueden conectar desde el primer día para sincronización y diagnóstico. La creación automática del árbol de campaña solo está habilitada para Meta Ads.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {launchPlans.map(plan => (
            <div key={plan.id} className="border border-border/40 bg-card/40 p-5 space-y-4 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
                    {plan.provider} · {t("Plano", "Plan", "Plan")}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {t("ID da campanha:", "Campaign ID:", "ID de campaña:")} {plan.campaignId.slice(0, 8)} | Master Plan: {plan.masterplanVersionId.slice(0, 8)}
                  </div>
                </div>
                <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${
                  plan.launchStage === "active" ? "border-success/40 text-success bg-success/10" :
                  plan.launchStage === "activating" || plan.launchStage === "executing" ? "border-primary/40 text-primary bg-primary/10 animate-pulse" :
                  plan.launchStage === "failed" || plan.launchStage === "compensation_failed" ? "border-destructive/40 text-destructive bg-destructive/10" :
                  plan.launchStage === "rolled_back" ? "border-muted-foreground/40 text-muted-foreground bg-muted/10" :
                  plan.launchStage === "approved" ? "border-green-400/40 text-green-400 bg-green-400/10" : ""
                }`}>
                   {stageLabel(plan.launchStage, t)}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="font-mono text-xs uppercase h-8" onClick={() => setSelectedPlanId(plan.id)}>
                    {t("Detalhes e Simulação", "Details and Simulation", "Detalles y simulación")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPlanId && (
        <LaunchPlanDetails 
           planId={selectedPlanId} 
           onClose={() => setSelectedPlanId(null)} 
        />
      )}
    </div>
  );
}

function LaunchPlanDetails({ planId, onClose }: { planId: string, onClose: () => void }) {
  const qc = useQueryClient();
  const t = useUiText();
  const { locale } = useUiLocale();

  const { data: planData, isLoading } = useQuery({
    queryKey: ["/api/paid-media/launch-plans", planId],
    queryFn: () => customFetch<{ launchPlan: LaunchPlan }>(`/api/paid-media/launch-plans/${planId}`),
  });

  const {
    data: readinessData,
    refetch: checkReadiness,
    isLoading: isReadinessQueryLoading,
    isError: isReadinessQueryError,
  } = useQuery({
    queryKey: ["/api/paid-media/launch-plans", planId, "readiness"],
    queryFn: () => customFetch<{ readiness: any }>(`/api/paid-media/launch-plans/${planId}/readiness`),
    enabled: !!planId,
  });

  const { data: evidenceData } = useQuery({
    queryKey: ["/api/paid-media/launch-plans", planId, "evidence"],
    queryFn: () => customFetch<{ evidence: any[] }>(`/api/paid-media/launch-plans/${planId}/evidence`),
    enabled: !!planId,
  });

  const simulateMutation = useMutation({
    mutationFn: () => customFetch<{ simulation: any }>(`/api/paid-media/launch-plans/${planId}/simulate`, { method: "POST" }),
     onSuccess: () => toast.success(t("Simulação concluída com sucesso. Verifique os logs.", "Simulation completed successfully. Check the logs.", "Simulación completada correctamente. Revisa los registros.")),
     onError: (e: any) => toast.error(e.message || t("Erro ao simular.", "Simulation failed.", "No se pudo ejecutar la simulación.")),
  });

  const approveMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/approve`, { method: "POST" }),
    onSuccess: () => {
        toast.success(t("Plano aprovado (imutável).", "Plan approved (immutable).", "Plan aprobado (inmutable)."));
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
     onError: (e: any) => toast.error(e.message || t("Erro ao aprovar.", "Failed to approve.", "No se pudo aprobar.")),
  });

  const activateMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/activate`, { method: "POST" }),
    onSuccess: () => {
        toast.success(t("Ativação iniciada.", "Activation started.", "Activación iniciada."));
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
     onError: (e: any) => toast.error(e.message || t("Erro ao ativar.", "Failed to activate.", "No se pudo activar.")),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/rollback`, { method: "POST" }),
    onSuccess: () => {
        toast.success(t("Rollback compensatório registrado.", "Compensating rollback recorded.", "Reversión compensatoria registrada."));
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
     onError: (e: any) => toast.error(e.message || t("Erro no rollback.", "Rollback failed.", "Error en la reversión.")),
  });

  if (isLoading || !planData?.launchPlan) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
         <Skeleton className="w-full max-w-3xl h-[80vh] bg-card border border-border/50" />
      </div>
    );
  }

  const plan = planData.launchPlan;
  const hasImmutableApproval = !!plan.approvalSnapshot;
  const isAwaitingApproval = plan.launchStage === "compiled" || plan.launchStage === "simulated";
  const readiness = isReadinessQueryError ? null : readinessData?.readiness ?? plan.readiness;
  
  // Readiness is strictly ready only if explicitly "ready"
  const isReady = readiness?.status === "ready";
  const isBlocked = readiness?.status === "blocked";
  const isReadinessLoading = isReadinessQueryLoading;
  const isReadinessError = isReadinessQueryError || readiness?.status === "error";

  // Connection/sync support is separate from launch-tree creation support.
  const isProviderSupported = plan.provider === "meta_ads";
  
  const canActivate = 
    plan.launchStage === "approved" && 
    isReady && 
    isProviderSupported &&
    hasImmutableApproval;

  const isActivating = plan.launchStage === "activating" || plan.launchStage === "executing";
  const isFailed = plan.launchStage === "failed";
  const isCompFailed = plan.launchStage === "compensation_failed";
  const isRolledBack = plan.launchStage === "rolled_back";
  const isActive = plan.launchStage === "active";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-primary/30 w-full max-w-4xl h-[90vh] flex flex-col relative shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
             <Rocket className="h-5 w-5 text-primary" />
             <h2 className="font-mono text-base uppercase tracking-widest font-bold text-foreground">
                {t("Dossiê do Lançamento", "Launch Report", "Informe del lanzamiento")}
             </h2>
             <Badge variant="outline" className={`font-mono text-[9px] uppercase ${
                  plan.launchStage === "active" ? "border-success/40 text-success bg-success/10" :
                  plan.launchStage === "activating" || plan.launchStage === "executing" ? "border-primary/40 text-primary bg-primary/10 animate-pulse" :
                  plan.launchStage === "failed" || plan.launchStage === "compensation_failed" ? "border-destructive/40 text-destructive bg-destructive/10" :
                  plan.launchStage === "rolled_back" ? "border-muted-foreground/40 text-muted-foreground bg-muted/10" :
                   plan.launchStage === "approved" ? "border-green-400/40 text-green-400 bg-green-400/10" : ""
                }`}>
                 {stageLabel(plan.launchStage, t)}
             </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scanline-overlay relative">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border/30 bg-muted/10 p-4 space-y-1">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("Provedor", "Provider", "Proveedor")}</div>
                  <div className="font-mono text-sm font-bold">{plan.provider === "meta_ads" ? "Meta Ads" : plan.provider === "google_ads" ? "Google Ads" : plan.provider === "tiktok_ads" ? "TikTok Ads" : plan.provider}</div>
              </div>
              <div className="border border-border/30 bg-muted/10 p-4 space-y-1">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("ID do Master Plan", "Master Plan ID", "ID del Master Plan")}</div>
                 <div className="font-mono text-sm font-bold">{plan.masterplanVersionId.slice(0, 8)}</div>
              </div>
           </div>

           {/* Readiness Blockers */}
           <div className="border border-border/30 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                 <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                   {isReady ? <ShieldCheck className="h-4 w-4 text-success" /> : isReadinessLoading ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {t("Prontidão", "Readiness", "Preparación")}
                 </div>
                 <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => checkReadiness()}>
                     {t("Atualizar", "Refresh", "Actualizar")}
                 </Button>
              </div>
              
              {!isProviderSupported && (
                 <div className="text-xs font-mono text-amber-400 mb-2">
                    {t("Conta conectável para sincronização e diagnóstico. A criação automática da árvore ainda não está homologada neste provedor.", "This account can be connected for syncing and diagnostics. Automatic campaign-tree creation is not yet supported by this provider.", "La cuenta se puede conectar para sincronización y diagnóstico. Este proveedor aún no admite la creación automática del árbol de campaña.")}
                 </div>
              )}

              {isReadinessLoading ? (
                  <div className="text-xs font-mono text-muted-foreground">{t("Verificando...", "Checking...", "Verificando...")}</div>
              ) : isReadinessError ? (
                  <div className="text-xs font-mono text-destructive">{t("Indisponível (Erro ao verificar)", "Unavailable (check failed)", "No disponible (error al verificar)")}</div>
              ) : !readiness ? (
                  <div className="text-xs font-mono text-muted-foreground">{t("Desconhecido", "Unknown", "Desconocido")}</div>
              ) : readiness.blockers?.length > 0 ? (
                 <ul className="space-y-1">
                    {readiness.blockers.map((b: any, i: number) => (
                       <li key={i} className="text-xs font-mono text-destructive flex items-center gap-2">
                         <span className="shrink-0 w-1.5 h-1.5 bg-destructive rounded-full" /> {b.message || JSON.stringify(b)}
                       </li>
                    ))}
                 </ul>
              ) : isReady ? (
                 <div className="text-xs font-mono text-success">
                    {t("Nenhum bloqueio detectado. Pronto para operar.", "No blockers found. Ready to launch.", "No se encontraron bloqueos. Todo está listo para iniciar.")}
                 </div>
              ) : (
                  <div className="text-xs font-mono text-muted-foreground">{t("Desconhecido", "Unknown", "Desconocido")}</div>
              )}
           </div>

           {/* Actions */}
           <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => simulateMutation.mutate()} 
                disabled={simulateMutation.isPending || isActivating}
                variant="outline"
                className="font-mono text-xs uppercase tracking-widest gap-2"
              >
                 {simulateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {t("Simular Execução (Dry Run)", "Simulate Execution (Dry Run)", "Simular ejecución (prueba en seco)")}
              </Button>
              
               {isAwaitingApproval && (
                 <Button 
                   onClick={() => approveMutation.mutate()} 
                   disabled={approveMutation.isPending || !isReady || isActivating || !isProviderSupported}
                   className="font-mono text-xs uppercase tracking-widest gap-2 btn-weapon-primary"
                 >
                     {t("Aprovar Plano (Imutável)", "Approve Plan (Immutable)", "Aprobar plan (inmutable)")}
                 </Button>
              )}

               {plan.launchStage === "approved" && isProviderSupported && (
                 <Button 
                   onClick={() => activateMutation.mutate()} 
                   disabled={activateMutation.isPending || !canActivate || isActivating}
                   className="font-mono text-xs uppercase tracking-widest gap-2 bg-success hover:bg-success/80 text-success-foreground"
                 >
                    {isActivating ? t("Ativando...", "Activating...", "Activando...") : t("Ativar Lançamento", "Activate Launch", "Activar lanzamiento")}
                 </Button>
              )}

              {(isFailed || isCompFailed) && (
                 <Button 
                   onClick={() => rollbackMutation.mutate()} 
                   disabled={rollbackMutation.isPending}
                   variant="destructive"
                   className="font-mono text-xs uppercase tracking-widest gap-2"
                 >
                     {t("Rollback (Compensação)", "Rollback (Compensation)", "Reversión (compensación)")}
                 </Button>
              )}
           </div>

           {/* Evidence */}
           {evidenceData?.evidence && evidenceData.evidence.length > 0 && (
             <div className="border border-border/30 bg-card p-4 space-y-3">
               <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                   <GitCommit className="h-4 w-4 text-primary" /> {t("Histórico de Evidências (Auditoria)", "Evidence History (Audit)", "Historial de evidencias (auditoría)")}
               </div>
               <div className="space-y-2 max-h-40 overflow-y-auto">
                 {evidenceData.evidence.map((ev: any) => (
                   <div key={ev.id} className="p-2 border border-border/20 text-[10px] font-mono flex items-start justify-between">
                     <div>
                       <span className={`font-bold ${ev.status === 'success' ? 'text-success' : 'text-destructive'}`}>[{ev.status}]</span> {ev.step}
                       <div className="text-muted-foreground mt-0.5">{ev.requestSummary}</div>
                     </div>
                      <span className="text-muted-foreground/50">{new Date(ev.createdAt).toLocaleTimeString(intlLocale(locale))}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
}

function stageLabel(stage: string, t: ReturnType<typeof useUiText>): string {
  switch (stage) {
    case "compiled": return t("Compilado", "Compiled", "Compilado");
    case "simulated": return t("Simulado", "Simulated", "Simulado");
    case "approved": return t("Aprovado", "Approved", "Aprobado");
    case "active": return t("Ativo", "Active", "Activo");
    case "activating": return t("Ativando", "Activating", "Activando");
    case "executing": return t("Em execução", "Executing", "En ejecución");
    case "failed": return t("Falhou", "Failed", "Fallido");
    case "compensation_failed": return t("Falha na compensação", "Compensation failed", "Falló la compensación");
    case "rolled_back": return t("Revertido", "Rolled back", "Revertido");
    default: return stage;
  }
}