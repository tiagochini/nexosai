import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetCampaign,
  useExecuteCampaign,
  CampaignExecuteInputPhase,
  getGetCampaignQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useCampaignSocket, type CampaignEvent } from "@/lib/socket";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, CheckCheck, Loader2, Brain, Zap,
  BookOpen, Clock, Archive, ChevronRight, Activity, RotateCw, List
} from "lucide-react";
import { StrategyMasterplan, parseStrategyInsights } from "./strategy-masterplan";
import { MarketValidationReview } from "@/components/MarketValidationReview";
import { useUiText } from "@/lib/i18n";

// ─── Status helpers ───────────────────────────────────────────────────────────

const POST_STRATEGY_STATUSES = [
  "generating", "compliance_review", "awaiting_approval", "approved",
  "executing", "live", "paused", "completed",
];

function isPostStrategy(status: string) {
  return POST_STRATEGY_STATUSES.includes(status);
}

// ─── Live event feed (during analyzing) ──────────────────────────────────────

interface LiveEvent {
  id: string;
  message: string;
  timestamp: string;
  type: string;
}

const ANALYZING_STEPS: { label: [string, string, string]; done: boolean }[] = [
  { label: ["Agente Comando — orquestração iniciada", "Command Agent — orchestration started", "Agente Comando — orquestación iniciada"], done: false },
  { label: ["Execution Governor — planejando o pipeline", "Execution Governor — planning the pipeline", "Execution Governor — planificando el flujo"], done: false },
  { label: ["Agente de Estratégia — análise de mercado", "Strategy Agent — market analysis", "Agente de Estrategia — análisis de mercado"], done: false },
  { label: ["Agente de Oferta — posicionamento e UVP", "Offer Agent — positioning and UVP", "Agente de Oferta — posicionamiento y propuesta única de valor"], done: false },
  { label: ["Agente de Audiência — segmentação de mercado", "Audience Agent — market segmentation", "Agente de Audiencia — segmentación de mercado"], done: false },
  { label: ["Arquitetura de Campanha — estrutura completa", "Campaign Architecture — complete structure", "Arquitectura de Campaña — estructura completa"], done: false },
  { label: ["Masterplan — compilação final", "Master plan — final compilation", "Plan maestro — compilación final"], done: false },
];

function AnalyzingMasterplanDisplay({ liveEvents }: { liveEvents: LiveEvent[] }) {
  const t = useUiText();
  const [tick, setTick] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, ANALYZING_STEPS.length - 1));
    }, 18000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  const mins = Math.floor(tick / 60);
  const secs = tick % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
      {/* Central icon */}
      <div className="relative">
        <div className="w-20 h-20 border border-primary/30 bg-primary/5 flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-primary/60" />
        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-primary/60" />
        <div className="absolute inset-0 border border-primary/10 scale-110 animate-ping" style={{ animationDuration: "3s" }} />
      </div>

      {/* Title */}
      <div className="text-center space-y-2 max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/50">
          {t("Sistema de estratégia — em execução", "Strategy system — running", "Sistema de estrategia — en ejecución")}
        </div>
        <h1 className="font-mono text-2xl font-black uppercase tracking-widest text-foreground">
          {t("Gerando masterplan", "Generating master plan", "Generando el plan maestro")}
        </h1>
        <p className="font-mono text-xs text-muted-foreground/60">
          {t("34 agentes de IA estão criando seu plano completo de lançamento", "34 AI agents are building your complete launch plan", "34 agentes de IA están creando tu plan de lanzamiento completo")}
        </p>
        <div className="font-mono text-[10px] text-primary/40 tabular-nums">
          {t("Tempo decorrido:", "Elapsed time:", "Tiempo transcurrido:")} {timeStr}
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="w-full max-w-sm space-y-1.5">
        {ANALYZING_STEPS.map((step, i) => {
          const isDone = i < stepIdx;
          const isActive = i === stepIdx;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 border transition-all duration-500 ${
                isDone
                  ? "border-primary/20 bg-primary/[0.04] opacity-60"
                  : isActive
                  ? "border-primary/40 bg-primary/[0.08]"
                  : "border-border/20 opacity-30"
              }`}
            >
              <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                {isDone ? (
                  <CheckCheck className="h-3 w-3 text-primary/60" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-border/40" />
                )}
              </div>
              <span className={`font-mono text-[11px] ${isActive ? "text-foreground" : "text-muted-foreground/50"}`}>
                {t(...step.label)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live event feed */}
      {liveEvents.length > 0 && (
        <div className="w-full max-w-sm border border-border/20 bg-background/50 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border/20 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary/50 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              {t("Eventos em tempo real", "Live events", "Eventos en tiempo real")}
            </span>
          </div>
          <div className="max-h-28 overflow-y-auto">
            {liveEvents.slice(-8).map((ev) => (
              <div key={ev.id} className="px-3 py-1.5 border-b border-border/10 last:border-0">
                <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                  {ev.message}
                </p>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>
      )}

      <p className="font-mono text-[10px] text-muted-foreground/30 text-center max-w-xs">
        {t("Este processo leva de 3 a 8 minutos. Você pode fechar esta página — o masterplan ficará disponível aqui quando estiver pronto.", "This process takes 3–8 minutes. You can close this page—the master plan will be available here when it is ready.", "Este proceso tarda de 3 a 8 minutos. Puedes cerrar esta página; el plan maestro estará disponible aquí cuando esté listo.")}
      </p>
    </div>
  );
}

// ─── History badge ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, [string, string, string]> = {
  generating: ["Gerando conteúdo", "Generating content", "Generando contenido"],
  compliance_review: ["Revisão de conformidade", "Compliance review", "Revisión de cumplimiento"],
  awaiting_approval: ["Aguardando aprovação", "Awaiting approval", "Pendiente de aprobación"],
  approved: ["Aprovado", "Approved", "Aprobado"],
  executing: ["Em execução", "Executing", "En ejecución"],
  live: ["Ao vivo", "Live", "En directo"],
  paused: ["Pausado", "Paused", "En pausa"],
  completed: ["Concluído", "Completed", "Completado"],
};

// ─── Masterplan Types & Panel ──────────────────────────────────────────────────

interface MasterplanVersion {
  id: string;
  version: number;
  status: "draft" | "pending_approval" | "approved" | "superseded";
  snapshot: any;
  contentHash: string;
  contextFingerprint: string;
  readinessScore: number;
  readinessStatus: string;
  readinessBlockers: string[];
  allowedActions: string[];
  requiredApprovals: string[];
  createdAt: string;
  approvedAt: string | null;
}

function MasterplanPanel({
  currentMp,
  versions,
  onMaterialize,
  isMaterializing,
  readOnly
}: {
  currentMp?: MasterplanVersion;
  versions: MasterplanVersion[];
  onMaterialize: (req: { requestApproval: boolean }) => void;
  isMaterializing: boolean;
  readOnly?: boolean;
}) {
  const t = useUiText();
  if (!currentMp) return null;

  const score = currentMp.readinessScore ?? 0;
  const scoreColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const statusLabels: Record<string, [string, string, string]> = {
    draft: ["Rascunho", "Draft", "Borrador"],
    pending_approval: ["Aguardando aprovação", "Awaiting approval", "Pendiente de aprobación"],
    approved: ["Aprovado", "Approved", "Aprobado"],
    superseded: ["Substituído", "Superseded", "Reemplazado"]
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Current Version */}
      <div className="border border-border/30 bg-muted/5 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary/60" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              {t("Status do masterplan", "Master plan status", "Estado del plan maestro")}
            </h3>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] uppercase border-primary/20 text-primary/80">
            v{currentMp.version} · {statusLabels[currentMp.status] ? t(...statusLabels[currentMp.status]) : currentMp.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="border border-border/20 bg-background/50 p-3">
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase mb-1">{t("Prontidão", "Readiness", "Preparación")}</div>
            <div className={`font-mono text-xl font-black ${scoreColor}`}>
              {score}%
            </div>
          </div>
          <div className="border border-border/20 bg-background/50 p-3">
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase mb-1">{t("Status", "Status", "Estado")}</div>
            <div className="font-mono text-xs font-bold text-foreground/80 mt-1 truncate">
              {currentMp.readinessStatus === "ready" ? t("Pronto", "Ready", "Listo") :
               currentMp.readinessStatus === "blocked" ? t("Bloqueado", "Blocked", "Bloqueado") :
               currentMp.readinessStatus === "review_required" ? t("Requer revisão", "Review required", "Requiere revisión") : (currentMp.readinessStatus || t("Processando", "Processing", "Procesando"))}
            </div>
          </div>
          <div className="border border-border/20 bg-background/50 p-3 md:col-span-2">
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase mb-1">{t("Ações permitidas", "Allowed actions", "Acciones permitidas")}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {currentMp.allowedActions?.length > 0 ? currentMp.allowedActions.map(a => (
                <span key={a} className="font-mono text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 border border-primary/20">
                  {a}
                </span>
              )) : (
                <span className="font-mono text-[9px] text-muted-foreground/50">{t("Nenhuma", "None", "Ninguna")}</span>
              )}
            </div>
          </div>
        </div>

        {(currentMp.readinessBlockers?.length > 0 || currentMp.requiredApprovals?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {currentMp.readinessBlockers?.length > 0 && (
              <div className="border border-red-500/20 bg-red-500/5 p-3">
                <div className="font-mono text-[9px] text-red-400/80 uppercase mb-2">{t("Bloqueios:", "Blockers:", "Bloqueos:")}</div>
                <ul className="space-y-1">
                  {currentMp.readinessBlockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px] font-mono text-red-400/70">
                      <span className="shrink-0 mt-0.5">◆</span> <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {currentMp.requiredApprovals?.length > 0 && (
              <div className="border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="font-mono text-[9px] text-amber-400/80 uppercase mb-2">{t("Aprovações:", "Approvals:", "Aprobaciones:")}</div>
                <ul className="space-y-1">
                  {currentMp.requiredApprovals.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px] font-mono text-amber-400/70">
                      <span className="shrink-0 mt-0.5">◆</span> <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMaterialize({ requestApproval: false })}
              disabled={isMaterializing}
              className="font-mono text-[10px] uppercase tracking-widest gap-2 h-8"
            >
              {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
              {t("Atualizar materialização", "Refresh materialization", "Actualizar materialización")}
            </Button>
            {currentMp.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMaterialize({ requestApproval: true })}
                disabled={isMaterializing}
                className="font-mono text-[10px] uppercase tracking-widest gap-2 h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                {t("Solicitar aprovação", "Request approval", "Solicitar aprobación")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {versions.length > 0 && (
        <div className="border border-border/20 bg-background/30 p-3">
          <div className="flex items-center gap-2 mb-3">
            <List className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {t("Histórico de versões", "Version history", "Historial de versiones")}
            </span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {versions.map(v => (
              <div key={v.id} className={`flex items-center gap-3 p-2 border ${v.id === currentMp.id ? 'border-primary/30 bg-primary/5' : 'border-border/10 bg-muted/5'}`}>
                <Badge variant="outline" className={`font-mono text-[8px] uppercase ${v.id === currentMp.id ? 'border-primary/40 text-primary' : 'border-border/40 text-muted-foreground'}`}>
                  v{v.version}
                </Badge>
                <span className="font-mono text-[9px] text-muted-foreground/70">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
                <div className="flex-1" />
                <span className="font-mono text-[9px] text-muted-foreground/50 uppercase">
                  {statusLabels[v.status] ? t(...statusLabels[v.status]) : v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignStrategyPage() {
  const t = useUiText();
  const [, params] = useRoute("/campaigns/:id/strategy");
  const campaignId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const eventIdRef = useRef(0);

  // ── Campaign data ──────────────────────────────────────────────────────────
  const [localIsActive, setLocalIsActive] = useState(true);
  const { data, isLoading } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
      staleTime: 0,
      refetchInterval: localIsActive ? 5000 : false,
    },
  });
  const campaign = data?.campaign as (Record<string, unknown> & { status?: string; title?: string; id?: string }) | undefined;

  useEffect(() => {
    const status = campaign?.status ?? "";
    setLocalIsActive(status === "analyzing");
  }, [campaign?.status]);

  // ── Workspace data (for PDF identity) ─────────────────────────────────────
  const { data: wsData } = useQuery({
    queryKey: ["/api/workspaces/me"],
    queryFn: () => customFetch<{ workspace?: { name?: string; id?: string } }>("/api/workspaces/me"),
    staleTime: 60000,
  });
  const workspace = wsData?.workspace;

  // ── Redirect rules ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!campaign || isLoading) return;
    const status = campaign.status ?? "";
    if (status === "draft" || status === "intake") {
      setLocation(`/campaigns/${campaignId}/intake`);
    }
  }, [campaign?.status, campaignId, setLocation, campaign, isLoading]);

  // ── Live WebSocket events (only while analyzing) ───────────────────────────
  useCampaignSocket(
    campaignId,
    (ev: CampaignEvent) => {
      setLiveEvents(prev => [
        ...prev,
        {
          id: String(++eventIdRef.current),
          message: ev.message ?? "",
          timestamp: ev.timestamp ?? new Date().toISOString(),
          type: ev.type ?? "info",
        },
      ]);
    },
    campaign?.status === "analyzing",
  );

  // ── Masterplan Versions ───────────────────────────────────────────────────
  const isAnalyzingStatus = campaign?.status === "analyzing";
  const { data: currentMpRes, isLoading: isMpLoading } = useQuery<{ masterplan: MasterplanVersion }>({
    queryKey: ["/api/campaigns", campaignId, "masterplan", "current"],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/current`),
    enabled: !!campaignId && !isAnalyzingStatus && campaign?.status !== "draft" && campaign?.status !== "intake",
    retry: false,
  });
  const currentMp = currentMpRes?.masterplan;

  const { data: mpVersionsRes } = useQuery<{ versions: MasterplanVersion[] }>({
    queryKey: ["/api/campaigns", campaignId, "masterplan", "versions"],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/versions`),
    enabled: !!campaignId && !isAnalyzingStatus && campaign?.status !== "draft" && campaign?.status !== "intake",
    retry: false,
  });
  const mpVersions = mpVersionsRes?.versions ?? [];

  const materializeMutation = useMutation({
    mutationFn: (req: { requestApproval: boolean }) =>
      customFetch(`/api/campaigns/${campaignId}/masterplan/materialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan"] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast.success(t("Masterplan atualizado.", "Master plan updated.", "Plan maestro actualizado."));
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || t("Falha ao atualizar masterplan.", "Failed to update master plan.", "No se pudo actualizar el plan maestro."));
    }
  });

  const approveMpMutation = useMutation({
    mutationFn: (req: { version: number }) =>
      customFetch(`/api/campaigns/${campaignId}/masterplan/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan"] });
      executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } });
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || t("Falha ao aprovar masterplan.", "Failed to approve master plan.", "No se pudo aprobar el plan maestro."));
    }
  });

  // ── Execute mutation (approve → generate content) ──────────────────────────
  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success(t("Aprovado! Gerando as peças de conteúdo...", "Approved! Generating content...", "¡Aprobado! Generando las piezas de contenido..."));
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        setLocation(`/campaigns/${campaignId}`);
      },
      onError: (err: unknown) => {
        type ErrBody = { error?: string; code?: string };
        const msg = (err as { data?: ErrBody })?.data?.error ?? t("Falha ao iniciar geração.", "Failed to start generation.", "No se pudo iniciar la generación.");
        toast.error(msg, { duration: 6000 });
      },
    },
  });

  const handleApprove = () => {
    if (currentMp && currentMp.status !== "approved") {
      approveMpMutation.mutate({ version: currentMp.version });
    } else {
      executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } });
    }
  };
  const isApproving = approveMpMutation.isPending || executeMutation.isPending;

  // ── Derived data ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-32 w-full bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
        <Skeleton className="h-48 w-full bg-muted/20" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-16 text-center font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
        {t("Campanha não encontrada.", "Campaign not found.", "No se encontró la campaña.")}
      </div>
    );
  }

  const status = campaign.status ?? "";
  const campaignRaw = campaign as Record<string, unknown>;
  const intakeD = ((campaignRaw["intakeData"] ?? {}) as Record<string, unknown>);
  const strategyD = (currentMp?.snapshot && typeof currentMp.snapshot === 'object')
    ? (currentMp.snapshot as Record<string, unknown>)
    : ((campaignRaw["strategyData"] ?? {}) as Record<string, unknown>);
  const campaignTitle = String(intakeD["product.name"] ?? campaign.title ?? t("Campanha", "Campaign", "Campaña"));
  const track = String(intakeD["launch.track"] ?? "");
  const hasStrategy = Object.keys(strategyD).length > 0;
  const isHistory = isPostStrategy(status);
  const isReady = status === "strategy_ready";
  const isAnalyzing = status === "analyzing";

  // ── Market validation acknowledgment gate ─────────────────────────────────
  const brainDataRaw = ((campaignRaw["brainData"] ?? {}) as Record<string, unknown>);
  const mv = (brainDataRaw["marketValidation"] ?? null) as Record<string, unknown> | null;
  const needsAcknowledgment = isAnalyzing
    && !!mv?.["overallVerdict"]
    && (mv["validators"] as Array<Record<string, unknown>> | undefined)?.some(v => v["requiresAcknowledgment"])
    && !mv["acknowledgmentRecordedAt"];

  const userIdentity = user ? {
    name: user.name ?? "",
    email: user.email ?? "",
    userId: user.id,
    workspaceName: workspace?.name ?? "",
    workspaceId: workspace?.id ?? "",
  } : undefined;

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation(`/campaigns/${campaignId}`)}
            className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px] uppercase tracking-widest">{t("Campanha", "Campaign", "Campaña")}</span>
          </button>

          <div className="h-3 w-px bg-border/40" />

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BookOpen className="h-3.5 w-3.5 text-primary/60 shrink-0" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-foreground font-bold truncate">
              {campaignTitle}
            </span>
          </div>

          {isHistory && (
            <Badge variant="outline" className="shrink-0 font-mono text-[9px] uppercase tracking-widest border-border/40 text-muted-foreground/50 gap-1.5">
              <Archive className="h-2.5 w-2.5" />
              {t("Histórico", "History", "Historial")} · {STATUS_LABELS[status] ? t(...STATUS_LABELS[status]) : status}
            </Badge>
          )}
          {isReady && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400 font-bold">
                {t("Aguardando aprovação", "Awaiting approval", "Pendiente de aprobación")}
              </span>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">
                {t("Em geração", "Generating", "Generando")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">

        {/* ANALYZING — show market validation ack gate if pipeline is paused, else spinner */}
        {isAnalyzing && (
          needsAcknowledgment && mv ? (
            <MarketValidationReview
              campaignId={campaignId}
              marketValidation={mv as any}
              onProceed={() => {
                void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
                setLocalIsActive(true);
              }}
            />
          ) : (
            <AnalyzingMasterplanDisplay liveEvents={liveEvents} />
          )
        )}

        {/* STRATEGY READY — full masterplan + approve */}
        {isReady && (
          <div className="space-y-0">
            {/* Approve banner (sticky-ish at top) */}
            <div className="border border-cyan-400/40 bg-cyan-400/[0.04] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-2 flex-1">
                <Zap className="h-4 w-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-mono text-xs font-black uppercase tracking-widest text-cyan-400">
                     {t("Masterplan pronto", "Master plan ready", "Plan maestro listo")}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                     {t("Revise o plano abaixo. Quando aprovado, os agentes gerarão todo o conteúdo automaticamente.", "Review the plan below. Once approved, the agents will generate all content automatically.", "Revisa el plan a continuación. Cuando lo apruebes, los agentes generarán todo el contenido automáticamente.")}
                  </div>
                </div>
              </div>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="shrink-0 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-10 text-xs px-6"
              >
                {isApproving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</>
                  : <><CheckCheck className="h-3.5 w-3.5" /> {t("Aprovar e gerar conteúdo", "Approve and generate content", "Aprobar y generar contenido")}</>}
              </Button>
            </div>

            <MasterplanPanel
              currentMp={currentMp}
              versions={mpVersions}
              onMaterialize={(req) => materializeMutation.mutate(req)}
              isMaterializing={materializeMutation.isPending}
            />

            {/* Full masterplan */}
            {hasStrategy ? (
              <StrategyMasterplan
                strategyD={strategyD}
                ins={parseStrategyInsights(strategyD)}
                campaignId={campaignId}
                campaignTitle={campaignTitle}
                track={track}
                userIdentity={userIdentity}
              />
            ) : (
              <div className="py-20 text-center border border-border/20">
                <Brain className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                   {t("O masterplan ainda está sendo compilado...", "The master plan is still being compiled...", "El plan maestro todavía se está compilando...")}
                </p>
              </div>
            )}

            {/* Approve button — repeated at bottom for convenience */}
            {hasStrategy && (
              <div className="border border-cyan-400/40 bg-cyan-400/[0.04] p-4 flex flex-col sm:flex-row items-center gap-3 mt-6">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400/80">
                     {t("Tudo revisado? Aprove para gerar o conteúdo completo do lançamento.", "All reviewed? Approve to generate the complete launch content.", "¿Ya revisaste todo? Aprueba para generar el contenido completo del lanzamiento.")}
                  </span>
                </div>
                <Button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="shrink-0 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-10 text-xs px-6"
                >
                  {isApproving
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</>
                    : <><CheckCheck className="h-3.5 w-3.5" /> {t("Aprovar e gerar conteúdo", "Approve and generate content", "Aprobar y generar contenido")}</>}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* HISTÓRICO — read-only masterplan after strategy was advanced */}
        {isHistory && (
          <div className="space-y-6">
            {/* History header */}
            <div className="border border-border/30 bg-muted/5 p-4 flex items-start gap-3">
              <Archive className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                   {t("Masterplan — histórico da campanha", "Master plan — campaign history", "Plan maestro — historial de la campaña")}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">
                   {t("Esta estratégia foi aprovada e o pipeline avançou para", "This strategy was approved and the pipeline advanced to", "Esta estrategia fue aprobada y el flujo avanzó a")} {STATUS_LABELS[status] ? t(...STATUS_LABELS[status]) : status}. {t("O masterplan abaixo é somente leitura.", "The master plan below is read-only.", "El plan maestro que sigue es de solo lectura.")}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/campaigns/${campaignId}`)}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest gap-1.5 border-border/40"
              >
                 {t("Ver campanha", "View campaign", "Ver campaña")} <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <MasterplanPanel
              currentMp={currentMp}
              versions={mpVersions}
              onMaterialize={(req) => materializeMutation.mutate(req)}
              isMaterializing={materializeMutation.isPending}
              readOnly={true}
            />

            {/* Masterplan (read-only) */}
            {hasStrategy ? (
              <StrategyMasterplan
                strategyD={strategyD}
                ins={parseStrategyInsights(strategyD)}
                campaignId={campaignId}
                campaignTitle={campaignTitle}
                track={track}
                userIdentity={userIdentity}
              />
            ) : (
              <div className="py-20 text-center border border-border/20">
                <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                   {t("Dados de estratégia não estão disponíveis para esta campanha.", "Strategy data is unavailable for this campaign.", "Los datos de estrategia no están disponibles para esta campaña.")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* No status match (e.g. loading edge case) */}
        {!isAnalyzing && !isReady && !isHistory && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Clock className="h-8 w-8 text-muted-foreground/20" />
            <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest text-center">
               {t("Aguardando início da estratégia...", "Waiting for strategy to start...", "Esperando a que comience la estrategia...")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/campaigns/${campaignId}`)}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest border-border/40"
            >
               {t("Voltar para a campanha", "Back to campaign", "Volver a la campaña")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
