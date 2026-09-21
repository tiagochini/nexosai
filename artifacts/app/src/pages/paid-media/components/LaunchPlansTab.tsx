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

export function LaunchPlansTab() {
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
            <Rocket className="h-4 w-4 text-primary" /> Planos de Lançamento (Mídia Paga)
          </h3>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Geração autônoma de estruturas de campanha a partir de um Master Plan aprovado.
          </p>
        </div>
        <Button asChild variant="outline" className="font-mono text-xs uppercase tracking-widest gap-2 border-primary/30 text-primary hover:bg-primary/10">
           <Link href="/intake?entryPoint=paid_media">
             <Plus className="h-3.5 w-3.5" /> Compilar Novo
           </Link>
        </Button>
      </div>

      {loadingPlans ? (
        <Skeleton className="h-40 w-full bg-muted/20" />
      ) : launchPlans.length === 0 ? (
        <div className="border border-dashed border-border/40 p-12 text-center space-y-3 bg-card/30">
          <Server className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Nenhum plano de lançamento ativo
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 max-w-md mx-auto">
             Acesse uma campanha e aprove seu Master Plan. A criação automática está disponível para Meta Ads; Google e TikTok permanecem em planejamento até seus executores serem homologados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {launchPlans.map(plan => (
            <div key={plan.id} className="border border-border/40 bg-card/40 p-5 space-y-4 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
                    {plan.provider} · Plano
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Campanha ID: {plan.campaignId.slice(0, 8)} | Master Plan: {plan.masterplanVersionId.slice(0, 8)}
                  </div>
                </div>
                <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${
                  plan.launchStage === "active" ? "border-success/40 text-success bg-success/10" :
                  plan.launchStage === "activating" || plan.launchStage === "executing" ? "border-primary/40 text-primary bg-primary/10 animate-pulse" :
                  plan.launchStage === "failed" || plan.launchStage === "compensation_failed" ? "border-destructive/40 text-destructive bg-destructive/10" :
                  plan.launchStage === "rolled_back" ? "border-muted-foreground/40 text-muted-foreground bg-muted/10" :
                  plan.launchStage === "approved" ? "border-green-400/40 text-green-400 bg-green-400/10" : ""
                }`}>
                  {plan.launchStage}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="font-mono text-xs uppercase h-8" onClick={() => setSelectedPlanId(plan.id)}>
                   Detalhes e Simulação
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
    onSuccess: (res) => toast.success("Simulação concluída com sucesso. Verifique os logs."),
    onError: (e: any) => toast.error(e.message || "Erro ao simular."),
  });

  const approveMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/approve`, { method: "POST" }),
    onSuccess: () => {
       toast.success("Plano aprovado (imutável).");
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao aprovar."),
  });

  const activateMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/activate`, { method: "POST" }),
    onSuccess: () => {
       toast.success("Ativação iniciada.");
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao ativar."),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => customFetch(`/api/paid-media/launch-plans/${planId}/rollback`, { method: "POST" }),
    onSuccess: () => {
       toast.success("Rollback compensatório registrado.");
       qc.invalidateQueries({ queryKey: ["/api/paid-media/launch-plans"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro no rollback."),
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

  // Can activate if:
  // - Approved
  // - launchStage is approved
  // - Readiness is ready
  // - Provider has launchTreeCreation=supported (implied if not blocked by provider capability, but let's be strict if there's a capability field. Actually, we must check if provider is meta_ads as tiktok/google don't support creation yet, but we'll use readiness blockers if they enforce it. The instructions say: "provider capability launchTreeCreation=supported". In the absence of this explicit capability obj on the client, we check provider directly or readiness.)
  // Actually, we must disable if Google/TikTok.
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
               Dossiê do Lançamento
             </h2>
             <Badge variant="outline" className={`font-mono text-[9px] uppercase ${
                  plan.launchStage === "active" ? "border-success/40 text-success bg-success/10" :
                  plan.launchStage === "activating" || plan.launchStage === "executing" ? "border-primary/40 text-primary bg-primary/10 animate-pulse" :
                  plan.launchStage === "failed" || plan.launchStage === "compensation_failed" ? "border-destructive/40 text-destructive bg-destructive/10" :
                  plan.launchStage === "rolled_back" ? "border-muted-foreground/40 text-muted-foreground bg-muted/10" :
                   plan.launchStage === "approved" ? "border-green-400/40 text-green-400 bg-green-400/10" : ""
                }`}>
                {plan.launchStage}
             </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scanline-overlay relative">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border/30 bg-muted/10 p-4 space-y-1">
                 <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Provedor</div>
                 <div className="font-mono text-sm font-bold">{plan.provider}</div>
              </div>
              <div className="border border-border/30 bg-muted/10 p-4 space-y-1">
                 <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Master Plan ID</div>
                 <div className="font-mono text-sm font-bold">{plan.masterplanVersionId.slice(0, 8)}</div>
              </div>
           </div>

           {/* Readiness Blockers */}
           <div className="border border-border/30 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                 <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                   {isReady ? <ShieldCheck className="h-4 w-4 text-success" /> : isReadinessLoading ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                   Readiness
                 </div>
                 <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => checkReadiness()}>
                    Atualizar
                 </Button>
              </div>
              
              {!isProviderSupported && (
                 <div className="text-xs font-mono text-amber-400 mb-2">
                   Operação indisponível: Criação de árvore não suportada neste provedor.
                 </div>
              )}

              {isReadinessLoading ? (
                 <div className="text-xs font-mono text-muted-foreground">Verificando...</div>
              ) : isReadinessError ? (
                 <div className="text-xs font-mono text-destructive">Indisponível (Erro ao verificar)</div>
              ) : !readiness ? (
                 <div className="text-xs font-mono text-muted-foreground">Desconhecido</div>
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
                   Nenhum bloqueio detectado. Pronto para operar.
                 </div>
              ) : (
                 <div className="text-xs font-mono text-muted-foreground">Desconhecido</div>
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
                 Simular Execução (Dry Run)
              </Button>
              
               {isAwaitingApproval && (
                 <Button 
                   onClick={() => approveMutation.mutate()} 
                   disabled={approveMutation.isPending || !isReady || isActivating || !isProviderSupported}
                   className="font-mono text-xs uppercase tracking-widest gap-2 btn-weapon-primary"
                 >
                    Aprovar Plano (Imutável)
                 </Button>
              )}

               {plan.launchStage === "approved" && isProviderSupported && (
                 <Button 
                   onClick={() => activateMutation.mutate()} 
                   disabled={activateMutation.isPending || !canActivate || isActivating}
                   className="font-mono text-xs uppercase tracking-widest gap-2 bg-success hover:bg-success/80 text-success-foreground"
                 >
                    {isActivating ? "Ativando..." : "Ativar Lançamento"}
                 </Button>
              )}

              {(isFailed || isCompFailed) && (
                 <Button 
                   onClick={() => rollbackMutation.mutate()} 
                   disabled={rollbackMutation.isPending}
                   variant="destructive"
                   className="font-mono text-xs uppercase tracking-widest gap-2"
                 >
                    Rollback (Compensação)
                 </Button>
              )}
           </div>

           {/* Evidence */}
           {evidenceData?.evidence && evidenceData.evidence.length > 0 && (
             <div className="border border-border/30 bg-card p-4 space-y-3">
               <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-primary" /> Histórico de Evidências (Audit)
               </div>
               <div className="space-y-2 max-h-40 overflow-y-auto">
                 {evidenceData.evidence.map((ev: any) => (
                   <div key={ev.id} className="p-2 border border-border/20 text-[10px] font-mono flex items-start justify-between">
                     <div>
                       <span className={`font-bold ${ev.status === 'success' ? 'text-success' : 'text-destructive'}`}>[{ev.status}]</span> {ev.step}
                       <div className="text-muted-foreground mt-0.5">{ev.requestSummary}</div>
                     </div>
                     <span className="text-muted-foreground/50">{new Date(ev.createdAt).toLocaleTimeString()}</span>
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