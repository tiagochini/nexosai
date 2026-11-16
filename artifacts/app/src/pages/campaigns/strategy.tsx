import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetCampaign,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, CheckCheck, Loader2, Brain, Zap,
  BookOpen, Clock, Archive, ChevronRight, ChevronDown, Activity, RotateCw, List,
  AlertTriangle, Sparkles, CheckCircle2
} from "lucide-react";
import { StrategyMasterplan, parseStrategyInsights } from "./strategy-masterplan";
import { missingTriggerMapFields } from "@/lib/trigger-map-contract";
import { missingCampaignArchitectureFields, missingCampaignCoreFields, missingMasterplanQualityFields } from "@/lib/masterplan-quality-contract";
import { MarketValidationReview } from "@/components/MarketValidationReview";
import { intlLocale, useAppI18n, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Status helpers ───────────────────────────────────────────────────────────

const POST_STRATEGY_STATUSES = [
  "generating", "compliance_review", "awaiting_approval", "approved",
  "executing", "live", "paused", "completed",
];

function isPostStrategy(status: string) {
  return POST_STRATEGY_STATUSES.includes(status);
}

const STRATEGY_SECTION_KEYS = [
  "marketDiagnosis", "offerPositioning", "audienceSegmentation", "campaignArchitecture",
  "successMetrics", "risks", "triggerMap",
];

function mergeStrategyData(...sources: Record<string, unknown>[]): Record<string, unknown> {
  return sources.reduce<Record<string, unknown>>((merged, source) => {
    const result = { ...merged, ...source };
    for (const key of STRATEGY_SECTION_KEYS) {
      const previous = merged[key];
      const incoming = source[key];
      if ((previous && typeof previous === "object" && !Array.isArray(previous))
        || (incoming && typeof incoming === "object" && !Array.isArray(incoming))) {
        result[key] = {
          ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {}),
          ...(incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming as Record<string, unknown> : {}),
        };
      }
    }
    return result;
  }, {});
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
  moduleReviews?: Record<string, "pending" | "approved" | "flagged" | "rejected">;
  contentHash: string;
  contextFingerprint: string;
  readinessScore: number;
  readinessStatus: string;
  readinessBlockers: Array<string | { message?: string }>;
  allowedActions: string[];
  requiredApprovals: string[];
  createdAt: string;
  approvedAt: string | null;
}

const REQUIRED_MASTERPLAN_REVIEWS = [
  "executiveSummary", "bigDomino", "positioning", "market", "audience",
  "architecture", "triggers", "metrics", "risks", "notes",
] as const;

function MasterplanPanel({
  currentMp,
  versions,
  onMaterialize,
  isMaterializing,
  readOnly,
  approvalDisabled
}: {
  currentMp?: MasterplanVersion;
  versions: MasterplanVersion[];
  onMaterialize: (req: { requestApproval: boolean }) => void;
  isMaterializing: boolean;
  readOnly?: boolean;
  approvalDisabled?: boolean;
}) {
  const copy = useAppI18n().masterplanStatus;
  const { locale } = useUiLocale();
  const [expanded, setExpanded] = useState(false);
  if (!currentMp) return null;

  const score = currentMp.readinessScore ?? 0;
  const scoreColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const statusLabels: Record<string, string> = {
    draft: copy.draft,
    pending_approval: copy.pendingApproval,
    approved: copy.approved,
    superseded: copy.superseded,
  };
  const readinessLabels: Record<string, string> = {
    ready: copy.ready,
    blocked: copy.blocked,
    review_required: copy.reviewRequired,
  };
  const actionLabels: Record<string, string> = {
    generate_content: copy.generateContent,
    launch: copy.launch,
  };
  const approvalLabels: Record<string, string> = { masterplan_approval: copy.masterplanApproval };
  const humanizeCode = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const readinessLabel = readinessLabels[currentMp.readinessStatus] ?? copy.processing;

  return (
    <div className="mb-6 border border-border/30 bg-muted/5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="masterplan-status-details"
        onClick={() => setExpanded(value => !value)}
        className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-white/[0.015]"
      >
        <Activity className="h-4 w-4 shrink-0 text-primary/70" />
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{copy.title}</h3>
        <Badge variant="outline" className="font-mono text-[9px] uppercase border-primary/20 text-primary/80">v{currentMp.version}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">{copy.readiness}</span>
          <strong className={`font-mono text-sm ${scoreColor}`}>{score}% · {readinessLabel}</strong>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && <div id="masterplan-status-details" className="border-t border-border/20 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border border-border/20 bg-background/50 p-3">
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase mb-1">{copy.status}</div>
            <div className="font-mono text-xs font-bold text-foreground/80">{statusLabels[currentMp.status] ?? humanizeCode(currentMp.status)}</div>
          </div>
          <div className="border border-border/20 bg-background/50 p-3">
            <div className="font-mono text-[9px] text-muted-foreground/60 uppercase mb-1">{copy.allowedActions}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {currentMp.allowedActions?.length > 0 ? currentMp.allowedActions.map(action => (
                <span key={action} className="border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                  {actionLabels[action] ?? humanizeCode(action)}
                </span>
              )) : <span className="font-mono text-[9px] text-muted-foreground/50">{copy.noActions}</span>}
            </div>
          </div>
        </div>

        {(currentMp.readinessBlockers?.length > 0 || currentMp.requiredApprovals?.length > 0) && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {currentMp.readinessBlockers?.length > 0 && (
              <div className="border border-red-500/20 bg-red-500/5 p-3">
                <div className="mb-2 font-mono text-[9px] uppercase text-red-400/80">{copy.blockers}</div>
                <ul className="space-y-1">
                  {currentMp.readinessBlockers.map((blocker, index) => {
                    const message = typeof blocker === "string" ? blocker : blocker.message ?? copy.requiredDataMissing;
                    return <li key={index} className="flex items-start gap-2 font-mono text-[10px] text-red-400/70">
                      <span className="mt-0.5 shrink-0">◆</span><span>{message.includes("_") ? humanizeCode(message) : message}</span>
                    </li>;
                  })}
                </ul>
              </div>
            )}
            {currentMp.requiredApprovals?.length > 0 && (
              <div className="border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="mb-2 font-mono text-[9px] uppercase text-amber-400/80">{copy.approvals}</div>
                <ul className="space-y-1">
                  {currentMp.requiredApprovals.map((approval, index) => (
                    <li key={index} className="flex items-start gap-2 font-mono text-[10px] text-amber-400/70">
                      <span className="mt-0.5 shrink-0">◆</span><span>{approvalLabels[approval] ?? humanizeCode(approval)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/10 pt-3">
            <Button variant="outline" size="sm" onClick={() => onMaterialize({ requestApproval: false })} disabled={isMaterializing} className="h-8 gap-2 font-mono text-[10px] uppercase tracking-widest">
              {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
              {copy.refresh}
            </Button>
            {currentMp.status === "draft" && (
              <Button variant="outline" size="sm" onClick={() => onMaterialize({ requestApproval: true })} disabled={isMaterializing || approvalDisabled} className="h-8 gap-2 border-cyan-500/30 font-mono text-[10px] uppercase tracking-widest text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300">
                {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                {copy.requestApproval}
              </Button>
            )}
          </div>
        )}

        {versions.length > 0 && (
          <div className="mt-4 border-t border-border/10 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <List className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{copy.history}</span>
            </div>
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {versions.map(version => (
                <div key={version.id} className={`flex items-center gap-3 border p-2 ${version.id === currentMp.id ? "border-primary/30 bg-primary/5" : "border-border/10 bg-muted/5"}`}>
                  <Badge variant="outline" className={`font-mono text-[8px] uppercase ${version.id === currentMp.id ? "border-primary/40 text-primary" : "border-border/40 text-muted-foreground"}`}>
                    v{version.version}{version.id === currentMp.id ? ` · ${copy.currentVersion}` : ""}
                  </Badge>
                  <span className="font-mono text-[9px] text-muted-foreground/70">
                    {new Date(version.createdAt).toLocaleString(intlLocale(locale))}
                  </span>
                  <div className="flex-1" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground/50">
                    {statusLabels[version.status] ?? humanizeCode(version.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignStrategyPage() {
  const t = useUiText();
  const adoptionText = useAppI18n().campaignBriefingAdoption;
  const [, params] = useRoute("/campaigns/:id/strategy");
  const campaignId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: onboardingStatus } = useQuery<{ trialAccess?: boolean }>({
    queryKey: ["/api/onboarding/status"],
    queryFn: () => customFetch("/api/onboarding/status"),
    staleTime: 60000,
  });
  const trialAccess = onboardingStatus?.trialAccess === true;
  const trialStrategyPreview = trialAccess && new URLSearchParams(window.location.search).get("trialStrategy") === "1";

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [triggerHelpDialogOpen, setTriggerHelpDialogOpen] = useState(false);
  const [briefingAdoptionOpen, setBriefingAdoptionOpen] = useState(false);
  const [selectedAdoptionSubscriptionId, setSelectedAdoptionSubscriptionId] = useState("");
  const [triggerHelpRunning, setTriggerHelpRunning] = useState(false);
  const [triggerHelpComplete, setTriggerHelpComplete] = useState(false);
  const [triggerHelpError, setTriggerHelpError] = useState("");
  const [triggerHelpStages, setTriggerHelpStages] = useState<string[]>([]);
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
    setLocalIsActive(status === "analyzing" || (trialStrategyPreview && status === "intake"));
  }, [campaign?.status, trialStrategyPreview]);

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
    if (onboardingStatus === undefined) return;
    const status = campaign.status ?? "";
    if ((status === "draft" || status === "intake") && !(trialStrategyPreview && status === "intake")) {
      setLocation(`/campaigns/${campaignId}/intake`);
    }
  }, [campaign?.status, campaignId, setLocation, campaign, isLoading, onboardingStatus, trialStrategyPreview]);

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
    campaign?.status === "analyzing" || triggerHelpRunning,
  );

  // ── Masterplan Versions ───────────────────────────────────────────────────
  const isAnalyzingStatus = campaign?.status === "analyzing";

  const { data: currentMpRes, isLoading: isMpLoading, isError: isMpError } = useQuery<{ masterplan: MasterplanVersion | null; moduleReviews?: Record<string, "pending" | "approved" | "flagged" | "rejected"> }>({
    queryKey: ["/api/campaigns", campaignId, "masterplan", "current"],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/current`),
    enabled: !!campaignId && !isAnalyzingStatus && campaign?.status !== "draft" && campaign?.status !== "intake",
    retry: false,
  });
  const currentMp = currentMpRes?.masterplan;

  const moduleReviewMutation = useMutation({
    mutationFn: ({ moduleId, status }: { moduleId: string; status: "pending" | "approved" | "flagged" | "rejected" }) => {
      if (!currentMp?.id && !trialAccess) throw new Error(t("Master Plan indisponível para revisão.", "Master plan is not available for review.", "El plan maestro no está disponible para revisión."));
      return customFetch(`/api/campaigns/${campaignId}/masterplan/reviews/${moduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(currentMp?.id ? { versionId: currentMp.id } : {}), status }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "current"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "versions"] }),
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) }),
      ]);
    },
    onError: async (error: any) => {
      if (error?.data?.code === "MASTERPLAN_REVIEW_VERSION_STALE") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "current"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "versions"] }),
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) }),
        ]);
        toast.info(t(
          "O Master Plan foi atualizado em outra ação. Carreguei a versão mais recente; revise o conteúdo antes de aprovar novamente.",
          "The Master Plan changed in another action. I loaded the latest version; review its content before approving again.",
          "El Master Plan cambió en otra acción. Cargué la versión más reciente; revisa el contenido antes de aprobarla de nuevo.",
        ), { duration: 8000 });
        return;
      }
      toast.error(error?.data?.error || error?.message || t("Não foi possível salvar a revisão.", "Could not save the review.", "No se pudo guardar la revisión."));
    },
  });

  const approveAllModuleReviewsMutation = useMutation({
    mutationFn: () => {
      if (!currentMp?.id && !trialAccess) throw new Error(t("Master Plan indisponível para revisão.", "Master plan is not available for review.", "El plan maestro no está disponible para revisión."));
      return customFetch(`/api/campaigns/${campaignId}/masterplan/reviews/approve-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentMp?.id ? { versionId: currentMp.id } : {}),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "current"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "versions"] }),
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) }),
      ]);
      toast.success(t("Todos os módulos foram aprovados.", "All modules have been approved.", "Todos los módulos han sido aprobados."));
    },
    onError: async (error: any) => {
      if (error?.data?.code === "MASTERPLAN_REVIEW_VERSION_STALE") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "current"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan", "versions"] }),
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) }),
        ]);
        toast.info(t("O Master Plan mudou. Carreguei a versão atual; confira o conteúdo e tente novamente.", "The Master Plan changed. I loaded the current version; review it and try again.", "El Master Plan cambió. Cargué la versión actual; revísala y vuelve a intentarlo."), { duration: 8000 });
        return;
      }
      toast.error(error?.data?.error || error?.message || t("Não foi possível aprovar os módulos.", "Could not approve the modules.", "No se pudieron aprobar los módulos."));
    },
  });

  type BriefingAdoptionOptions = {
    briefingAnswerCount: number;
    briefingProductName: string | null;
    currentBinding: { commercialProductId: string | null; commercialSubscriptionId: string | null; productIntakeVersionId: string | null; intakeStatus: string | null };
    candidates: Array<{ subscriptionId: string; productId: string; productName: string; productKey: string; suggested: boolean }>;
  };
  const briefingAdoptionQuery = useQuery<BriefingAdoptionOptions>({
    queryKey: ["/api/campaigns", campaignId, "masterplan", "briefing-adoption-options"],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/briefing-adoption-options`),
    enabled: briefingAdoptionOpen,
    retry: false,
  });
  useEffect(() => {
    const candidates = briefingAdoptionQuery.data?.candidates ?? [];
    const suggested = candidates.filter((candidate) => candidate.suggested);
    if (suggested.length === 1) setSelectedAdoptionSubscriptionId(suggested[0]!.subscriptionId);
    else if (candidates.length === 1) setSelectedAdoptionSubscriptionId(candidates[0]!.subscriptionId);
    else if (!candidates.some((candidate) => candidate.subscriptionId === selectedAdoptionSubscriptionId)) setSelectedAdoptionSubscriptionId("");
  }, [briefingAdoptionQuery.data, selectedAdoptionSubscriptionId]);

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

  const adoptBriefingMutation = useMutation({
    mutationFn: (subscriptionId: string) => customFetch(`/api/campaigns/${campaignId}/masterplan/adopt-briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    }),
    onSuccess: () => {
      setBriefingAdoptionOpen(false);
      toast.success(adoptionText.linked);
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      materializeMutation.mutate({ requestApproval: false });
    },
    onError: (err: any) => {
      const messages: Record<string, string> = {
        CAMPAIGN_PRODUCT_ADOPTION_INVALID: adoptionText.activeSubscriptionRequired,
        CAMPAIGN_PRODUCT_MISMATCH: adoptionText.productMismatch,
        CAMPAIGN_SUBSCRIPTION_MISMATCH: adoptionText.subscriptionMismatch,
        CAMPAIGN_BRIEFING_INCOMPLETE: adoptionText.briefingIncomplete,
        INTAKE_INCOMPLETE: adoptionText.briefingIncomplete,
        CAMPAIGN_INTAKE_PRODUCT_MISMATCH: adoptionText.intakeMismatch,
      };
      toast.error(messages[err?.data?.code] ?? adoptionText.failed, { duration: 7000 });
    },
  });

  const completeTriggerStrategyMutation = useMutation({
    mutationFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/repair-sections`, {
      method: "POST",
    }),
    onSuccess: (result: unknown) => {
      const repairResult = result && typeof result === "object"
        ? result as { masterplan?: unknown; repairedFields?: unknown }
        : {};
      const repairedFields = Array.isArray(repairResult.repairedFields) ? repairResult.repairedFields : [];
      if (repairedFields.length === 0) {
        setTriggerHelpRunning(false);
        setTriggerHelpError(t(
          "Os agentes não confirmaram nenhuma alteração. Atualize a página e confira se a seção ainda está pendente.",
          "The agents did not confirm any changes. Refresh the page and check whether the section is still pending.",
          "Los agentes no confirmaron ningún cambio. Actualiza la página y comprueba si la sección sigue pendiente.",
        ));
        return;
      }
      setTriggerHelpError("");
      setTriggerHelpRunning(false);
      setTriggerHelpComplete(true);
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan"] });
      window.setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err: any) => {
      setTriggerHelpRunning(false);
      setTriggerHelpError(err?.data?.error || t("Não foi possível iniciar a análise dos agentes.", "Could not start the agents' analysis.", "No se pudo iniciar el análisis de los agentes."));
    },
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
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast.success(t("Masterplan aprovado. A prévia do cronograma está na próxima tela.", "Master plan approved. The schedule preview is on the next screen.", "Plan maestro aprobado. La vista previa del cronograma está en la siguiente pantalla."));
      setLocation(`/campaigns/${campaignId}`);
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || t("Falha ao aprovar masterplan.", "Failed to approve master plan.", "No se pudo aprobar el plan maestro."));
    }
  });


  const handleApprove = () => {
    if (trialAccess) {
      if (!allChecklistsApproved) {
        toast.error(t("Aprove os 10 checklists para abrir a prévia do cronograma.", "Approve all 10 checklists to open the schedule preview.", "Aprueba los 10 checklists para abrir la vista previa del cronograma."));
        return;
      }
      setLocation(`/campaigns/${campaignId}`);
      return;
    }
    if (currentMp && currentMp.readinessStatus !== "ready") {
      toast.error(t("O plano está incompleto. Preencha os módulos indicados em Bloqueios antes de avançar.", "The plan is incomplete. Fill the modules listed under Blockers before continuing.", "El plan está incompleto. Completa los módulos indicados en Bloqueos antes de continuar."), { duration: 7000 });
      return;
    }
    if (!allChecklistsApproved) {
      toast.error(t("Aprove os 10 checklists do Masterplan antes de gerar o conteúdo.", "Approve all 10 master plan checklists before generating content.", "Aprueba los 10 checklists del plan maestro antes de generar contenido."), { duration: 7000 });
      return;
    }
    if (currentMp && currentMp.status !== "approved") {
      approveMpMutation.mutate({ version: currentMp.version });
    } else if (currentMp?.status === "approved") {
      setLocation(`/campaigns/${campaignId}`);
    }
  };
  const isApproving = approveMpMutation.isPending;
  const strategyCanAdvance = currentMp?.readinessStatus === "ready";
  const moduleReviewStatuses = currentMp?.moduleReviews ?? currentMpRes?.moduleReviews ?? {};
  const approvedChecklistCount = REQUIRED_MASTERPLAN_REVIEWS.filter((moduleId) => moduleReviewStatuses[moduleId] === "approved").length;
  const allChecklistsApproved = approvedChecklistCount === REQUIRED_MASTERPLAN_REVIEWS.length;
  const advanceBlockers = (currentMp?.readinessBlockers ?? [])
    .map((blocker) => typeof blocker === "string" ? blocker : blocker.message)
    .filter((message): message is string => Boolean(message));
  const advanceBlockReason = isMpLoading
    ? t("Verificando a prontidão do Masterplan…", "Checking master plan readiness…", "Verificando la preparación del plan maestro…")
    : isMpError
    ? t("Não foi possível consultar a prontidão do Masterplan. Atualize a página ou tente recalcular.", "Could not load master plan readiness. Refresh the page or recalculate it.", "No se pudo consultar la preparación del plan maestro. Actualiza la página o vuelve a calcularla.")
    : !currentMp
    ? t("Ainda não existe uma versão materializada do Masterplan para aprovar.", "There is no materialized master plan version to approve yet.", "Todavía no existe una versión materializada del plan maestro para aprobar.")
    : strategyCanAdvance && !allChecklistsApproved
    ? t(`Aprove os 10 checklists do Masterplan para continuar (${approvedChecklistCount}/10 aprovados).`, `Approve all 10 master plan checklists to continue (${approvedChecklistCount}/10 approved).`, `Aprueba los 10 checklists del plan maestro para continuar (${approvedChecklistCount}/10 aprobados).`)
    : !strategyCanAdvance
    ? advanceBlockers.length > 0
      ? `${t("Pendências registradas pelo sistema", "System-reported blockers", "Bloqueos reportados por el sistema")}: ${advanceBlockers.join(" ")}`
      : `${t("O sistema retornou o status", "The system returned status", "El sistema devolvió el estado")} “${currentMp.readinessStatus || t("desconhecido", "unknown", "desconocido")}” ${t("sem detalhar pendências. Recalcule a prontidão para atualizar esta versão.", "without listing blockers. Recalculate readiness to refresh this version.", "sin detallar bloqueos. Vuelve a calcular la preparación para actualizar esta versión.")}`
    : "";
  const confirmTriggerHelp = () => {
    setTriggerHelpRunning(true);
    setLiveEvents([]);
    completeTriggerStrategyMutation.mutate();
  };

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
  const campaignStrategyD = (campaignRaw["strategyData"] && typeof campaignRaw["strategyData"] === "object")
    ? campaignRaw["strategyData"] as Record<string, unknown>
    : {};
  const snapshotD = (currentMp?.snapshot && typeof currentMp.snapshot === "object")
    ? currentMp.snapshot as Record<string, unknown>
    : {};
  const snapshotStrategyD = (snapshotD["strategy"] && typeof snapshotD["strategy"] === "object" && !Array.isArray(snapshotD["strategy"]))
    ? snapshotD["strategy"] as Record<string, unknown>
    : typeof snapshotD["strategy"] === "string"
      ? parseStrategyInsights({ executiveSummary: snapshotD["strategy"] })
      : {};
  // The repair endpoint treats campaign.strategyData as the source of truth.
  // Keep the displayed strategy aligned with it so an older snapshot cannot
  // show a truncated value after the campaign data has already been repaired.
  const strategyD = mergeStrategyData(snapshotStrategyD, campaignStrategyD);
  const strategyInsights = mergeStrategyData(
    parseStrategyInsights(snapshotStrategyD),
    snapshotStrategyD,
    parseStrategyInsights(campaignStrategyD),
    campaignStrategyD,
  );
  const campaignTitle = String(intakeD["product.name"] ?? campaign.title ?? t("Campanha", "Campaign", "Campaña"));
  const repairStrategy = mergeStrategyData(parseStrategyInsights(campaignStrategyD), campaignStrategyD);
  const missingRepairCore = missingCampaignCoreFields(repairStrategy);
  const missingRepairArchitecture = missingCampaignArchitectureFields(repairStrategy);
  const missingRepairTriggers = missingTriggerMapFields(repairStrategy["triggerMap"]);
  const missingRepairQuality = missingMasterplanQualityFields(repairStrategy);
  const repairStages = [
    ...(missingRepairCore.some(field => field.path === "executiveSummary") ? ["M01 — Resumo executivo"] : []),
    ...(missingRepairCore.some(field => field.path === "bigDomino") ? ["M02 — Big Domino"] : []),
    ...(missingRepairCore.some(field => field.path.startsWith("offerPositioning.")) ? ["M03 — Posicionamento da oferta"] : []),
    ...(missingRepairCore.some(field => field.path.startsWith("marketDiagnosis.")) ? ["M04 — Diagnóstico de mercado"] : []),
    ...(missingRepairCore.some(field => field.path.startsWith("audienceSegmentation.")) ? ["M05 — Arquétipo de audiência"] : []),
    ...(missingRepairArchitecture.length ? ["M06 — Arquitetura da campanha"] : []),
    ...(missingRepairTriggers.length ? ["M07 — Engenharia de gatilhos"] : []),
    ...(missingRepairQuality.some(field => field.path.startsWith("successMetrics.")) ? ["M08 — Métricas de performance"] : []),
    ...(missingRepairQuality.some(field => field.path.startsWith("risks.")) ? ["M09 — Análise de riscos"] : []),
    ...(missingRepairCore.some(field => field.path === "strategistNotes") ? ["M10 — Observações estratégicas"] : []),
  ];
  const requestTriggerHelp = () => {
    setTriggerHelpError("");
    setTriggerHelpComplete(false);
    setTriggerHelpStages(repairStages);
    setTriggerHelpDialogOpen(true);
  };
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
            <div className="mb-6 overflow-hidden border border-cyan-400/30 bg-gradient-to-br from-cyan-400/[0.07] via-card/80 to-primary/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-300">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-black uppercase tracking-[0.16em] text-cyan-200">
                      {t("Masterplan pronto", "Master plan ready", "Plan maestro listo")}
                    </h2>
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${strategyCanAdvance ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300/80" : "border-amber-300/25 bg-amber-300/[0.06] text-amber-200/80"}`}>
                      {trialAccess
                        ? t("Prévia", "Preview", "Vista previa")
                        : strategyCanAdvance
                        ? t("Pronto para revisão", "Ready for review", "Listo para revisión")
                        : t("Prontidão pendente", "Readiness pending", "Preparación pendiente")}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground/75">
                    {trialAccess
                      ? t("Revise e aprove os 10 módulos para liberar o PDF. Aprovar o plano e gerar conteúdo exige uma licença.", "Review and approve all 10 modules to unlock the PDF. Approving the plan and generating content require a license.", "Revisa y aprueba los 10 módulos para desbloquear el PDF. Aprobar el plan y generar contenido requiere una licencia.")
                      : t("Revise a estratégia. Depois da aprovação, os agentes preparam o conteúdo da campanha.", "Review the strategy. After approval, the agents prepare the campaign content.", "Revisa la estrategia. Tras aprobarla, los agentes preparan el contenido de la campaña.")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  {!trialAccess && advanceBlockReason ? (
                    <div role="status" className="flex items-start gap-2 text-amber-200/85">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] leading-relaxed">{advanceBlockReason}</p>
                        {!isMpLoading && !isMpError && !strategyCanAdvance && advanceBlockers.length === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => currentMp ? materializeMutation.mutate({ requestApproval: false }) : setBriefingAdoptionOpen(true)}
                            disabled={materializeMutation.isPending || adoptBriefingMutation.isPending}
                            className="h-7 gap-1.5 rounded-none border-amber-200/20 px-2.5 font-mono text-[9px] uppercase tracking-wider text-amber-100/80 hover:bg-amber-200/[0.06]"
                          >
                            {materializeMutation.isPending || adoptBriefingMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : currentMp ? <RotateCw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            {currentMp ? t("Recalcular prontidão", "Recalculate readiness", "Recalcular preparación") : t("Vincular briefing existente", "Link existing briefing", "Vincular briefing existente")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/60">
                      {trialAccess
                        ? t("A geração de conteúdo fica disponível com uma licença NexOS.", "Content generation is available with a NexOS license.", "La generación de contenido está disponible con una licencia NexOS.")
                        : allChecklistsApproved
                        ? t("Todos os checklists foram aprovados. O plano está pronto para gerar o conteúdo.", "All checklists are approved. The plan is ready to generate content.", "Todos los checklists están aprobados. El plan está listo para generar contenido.")
                        : advanceBlockReason || t("Aprove os 10 checklists para liberar a aprovação e a geração do conteúdo.", "Approve all 10 checklists to unlock approval and content generation.", "Aprueba los 10 checklists para desbloquear la aprobación y la generación de contenido.")}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || (trialAccess ? !allChecklistsApproved : !strategyCanAdvance || !allChecklistsApproved)}
                  className="h-11 w-full gap-2 rounded-none px-5 font-mono text-[10px] font-black uppercase tracking-[0.12em] btn-weapon-primary sm:w-auto sm:min-w-[250px]"
                >
                  {trialAccess
                    ? <><ChevronRight className="h-3.5 w-3.5" /> {t("Ver prévia do cronograma", "View schedule preview", "Ver vista previa del cronograma")}</>
                    : isApproving
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</>
                    : <><CheckCheck className="h-3.5 w-3.5" /> {t("Aprovar Masterplan", "Approve master plan", "Aprobar plan maestro")}</>}
                </Button>
              </div>
            </div>

            <MasterplanPanel
              currentMp={currentMp ?? undefined}
              versions={mpVersions}
              onMaterialize={(req) => materializeMutation.mutate(req)}
              isMaterializing={materializeMutation.isPending}
              approvalDisabled={trialAccess}
            />

            {/* Full masterplan */}
            {hasStrategy ? (
              <StrategyMasterplan
                key={currentMp?.id ?? "current-masterplan"}
                strategyD={strategyD}
                ins={strategyInsights}
                reviewStatuses={moduleReviewStatuses}
                onReviewStatusChange={(moduleId, status) => moduleReviewMutation.mutateAsync({ moduleId, status })}
                onApproveAll={() => approveAllModuleReviewsMutation.mutate()}
                canApproveAll={!trialAccess && currentMp?.readinessStatus === "ready" && currentMp.status !== "superseded"}
                approvingAll={approveAllModuleReviewsMutation.isPending}
                trialReviewMode={trialAccess}
                campaignId={campaignId}
                campaignTitle={campaignTitle}
                track={track}
                userIdentity={userIdentity}
                onRequestTriggerHelp={trialAccess ? undefined : requestTriggerHelp}
                triggerHelpPending={completeTriggerStrategyMutation.isPending}
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
              <div className="mt-6 grid grid-cols-1 gap-4 border border-cyan-400/25 bg-gradient-to-r from-cyan-400/[0.05] to-primary/[0.04] p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0 space-y-1.5">
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-200/90">
                    {t("Tudo revisado?", "Finished reviewing?", "¿Terminaste de revisar?")}
                  </h3>
                  <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/65">
                    {allChecklistsApproved
                      ? t("Todos os checklists foram aprovados. Aprove o Masterplan para preparar o conteúdo completo do lançamento.", "All checklists are approved. Approve the master plan to prepare the complete launch content.", "Todos los checklists están aprobados. Aprueba el plan maestro para preparar todo el contenido del lanzamiento.")
                      : t(`Aprove os 10 checklists do Masterplan antes de gerar conteúdo (${approvedChecklistCount}/10 aprovados).`, `Approve all 10 master plan checklists before generating content (${approvedChecklistCount}/10 approved).`, `Aprueba los 10 checklists del plan maestro antes de generar contenido (${approvedChecklistCount}/10 aprobados).`)}
                  </p>
                  {!trialAccess && advanceBlockReason && (
                    <div role="status" className="space-y-2 pt-1">
                      <p className="font-mono text-[10px] leading-relaxed text-amber-200/85">{advanceBlockReason}</p>
                      {!isMpLoading && !isMpError && !strategyCanAdvance && advanceBlockers.length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => currentMp ? materializeMutation.mutate({ requestApproval: false }) : setBriefingAdoptionOpen(true)}
                          disabled={materializeMutation.isPending || adoptBriefingMutation.isPending}
                          className="h-7 gap-1.5 rounded-none border-amber-200/20 px-2.5 font-mono text-[9px] uppercase tracking-wider text-amber-100/80 hover:bg-amber-200/[0.06]"
                        >
                          {materializeMutation.isPending || adoptBriefingMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : currentMp ? <RotateCw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {currentMp ? t("Recalcular prontidão", "Recalculate readiness", "Recalcular preparación") : t("Vincular briefing existente", "Link existing briefing", "Vincular briefing existente")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || (trialAccess ? !allChecklistsApproved : !strategyCanAdvance || !allChecklistsApproved)}
                  className="h-11 w-full gap-2 rounded-none px-5 font-mono text-[10px] font-black uppercase tracking-[0.12em] btn-weapon-primary sm:w-auto sm:min-w-[250px]"
                >
                  {trialAccess
                    ? <><ChevronRight className="h-3.5 w-3.5" /> {t("Ver prévia do cronograma", "View schedule preview", "Ver vista previa del cronograma")}</>
                    : isApproving
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</>
                    : <><CheckCheck className="h-3.5 w-3.5" /> {t("Aprovar Masterplan", "Approve master plan", "Aprobar plan maestro")}</>}
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
              currentMp={currentMp ?? undefined}
              versions={mpVersions}
              onMaterialize={(req) => materializeMutation.mutate(req)}
              isMaterializing={materializeMutation.isPending}
              approvalDisabled={trialAccess}
              readOnly={true}
            />

            {/* Masterplan (read-only) */}
            {hasStrategy ? (
              <StrategyMasterplan
                strategyD={strategyD}
                ins={strategyInsights}
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

      <Dialog open={briefingAdoptionOpen} onOpenChange={(open) => {
        if (adoptBriefingMutation.isPending || materializeMutation.isPending) return;
        setBriefingAdoptionOpen(open);
        if (!open) setSelectedAdoptionSubscriptionId("");
      }}>
        <DialogContent className="max-w-xl border border-cyan-400/25 bg-[#090b11] p-0 shadow-[0_24px_100px_rgba(0,0,0,0.7)]">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
          <div className="p-6 sm:p-7">
            <DialogHeader className="text-left">
              <div className="mb-4 flex h-11 w-11 items-center justify-center border border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <DialogTitle className="font-mono text-base font-black uppercase tracking-wider text-foreground">
                {adoptionText.title}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm leading-relaxed text-muted-foreground">
                {adoptionText.description}
              </DialogDescription>
            </DialogHeader>

            {briefingAdoptionQuery.isLoading ? (
              <div className="mt-5 flex items-center gap-2 border border-cyan-400/15 bg-cyan-400/[0.03] p-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                {adoptionText.loading}
              </div>
            ) : briefingAdoptionQuery.isError ? (
              <div role="alert" className="mt-5 border border-red-400/25 bg-red-400/[0.05] p-3 text-xs leading-relaxed text-red-200/90">
                {adoptionText.loadError}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="border border-white/8 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-200/80">{adoptionText.savedBriefing}</span>
                  <div className="mt-1 text-foreground/85">
                    {briefingAdoptionQuery.data?.briefingProductName ?? adoptionText.productUnknown}
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-muted-foreground/60">
                    {adoptionText.structuredAnswers.replace("{count}", String(briefingAdoptionQuery.data?.briefingAnswerCount ?? 0))}
                  </div>
                </div>

                {briefingAdoptionQuery.data?.candidates.length ? (
                  <label className="block space-y-1.5 text-xs">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">{adoptionText.selectionLabel}</span>
                    <select
                      value={selectedAdoptionSubscriptionId}
                      onChange={(event) => setSelectedAdoptionSubscriptionId(event.target.value)}
                      className="h-10 w-full border border-border/50 bg-background px-3 text-sm"
                    >
                      <option value="">{adoptionText.selectionPlaceholder}</option>
                      {briefingAdoptionQuery.data.candidates.map((candidate) => (
                        <option key={candidate.subscriptionId} value={candidate.subscriptionId}>
                          {candidate.productName}{candidate.suggested ? ` · ${adoptionText.matchesBriefing}` : ""} · {candidate.productKey}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.04] p-3 text-xs leading-relaxed text-amber-100/85">
                    {adoptionText.noActiveSubscription}
                  </div>
                )}

                <div className="border border-amber-300/15 bg-amber-300/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {adoptionText.confirmationNote}
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setBriefingAdoptionOpen(false)} disabled={adoptBriefingMutation.isPending || materializeMutation.isPending} className="rounded-none font-mono text-[10px] uppercase tracking-wider">
                {adoptionText.cancel}
              </Button>
              <Button
                onClick={() => adoptBriefingMutation.mutate(selectedAdoptionSubscriptionId)}
                disabled={!selectedAdoptionSubscriptionId || (briefingAdoptionQuery.data?.briefingAnswerCount ?? 0) < 3 || adoptBriefingMutation.isPending || materializeMutation.isPending}
                className="rounded-none bg-gradient-to-r from-cyan-600 to-blue-600 font-mono text-[10px] font-bold uppercase tracking-wider text-white hover:brightness-110"
              >
                {adoptBriefingMutation.isPending || materializeMutation.isPending
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{adoptionText.linking}</>
                  : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />{adoptionText.confirm}</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={triggerHelpDialogOpen}
        onOpenChange={(open) => {
          if (triggerHelpRunning) return;
          setTriggerHelpDialogOpen(open);
          if (!open) setTriggerHelpComplete(false);
        }}
      >
        <DialogContent
          className={`max-w-lg overflow-hidden border border-violet-400/30 bg-[#090b11] p-0 shadow-[0_24px_100px_rgba(0,0,0,0.7)] ${triggerHelpRunning ? "[&>button:last-child]:hidden" : ""}`}
          style={{ backgroundColor: "#090b11", opacity: 1 }}
          onEscapeKeyDown={(event) => { if (triggerHelpRunning) event.preventDefault(); }}
          onInteractOutside={(event) => { if (triggerHelpRunning) event.preventDefault(); }}
        >
          <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400" />
          <div className="p-6 sm:p-7">
            <DialogHeader className="text-left">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center border ${triggerHelpRunning ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : triggerHelpComplete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-violet-400/30 bg-violet-400/10 text-violet-300"}`}>
                {triggerHelpRunning
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : triggerHelpComplete
                    ? <CheckCircle2 className="h-5 w-5" />
                    : <Sparkles className="h-5 w-5" />}
              </div>
              <DialogTitle className="font-mono text-base font-black uppercase tracking-wider text-foreground">
                {triggerHelpRunning
                  ? t("Completando o Masterplan", "Completing the master plan", "Completando el plan maestro")
                  : triggerHelpComplete
                    ? t("Estratégia atualizada", "Strategy updated", "Estrategia actualizada")
                    : t("Completar seções pendentes?", "Complete missing sections?", "¿Completar las secciones pendientes?")}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm leading-relaxed text-muted-foreground">
                {triggerHelpRunning
                  ? t("Os agentes estão completando apenas os campos ausentes ou interrompidos das etapas listadas. As informações e os conteúdos existentes serão preservados. A página será atualizada ao concluir.", "The agents are completing only missing or cut-off fields in the listed sections. Existing information and content will be preserved. This page will refresh when complete.", "Los agentes están completando solo los campos faltantes o cortados de las secciones indicadas. Se conservarán la información y el contenido existentes. La página se actualizará al terminar.")
                  : triggerHelpComplete
                    ? t("Os agentes finalizaram. Atualizando os dados da campanha…", "The agents are done. Refreshing campaign data…", "Los agentes terminaron. Actualizando los datos de la campaña…")
                    : t("Você não precisa conhecer termos técnicos. Os agentes conferem o que já está salvo e usam o briefing para completar somente os campos ausentes ou interrompidos nas etapas listadas. O conteúdo existente será preservado.", "You do not need technical knowledge. Agents check what is already saved and use the brief to complete only missing or cut-off fields in the listed sections. Existing content will be preserved.", "No necesitas conocimientos técnicos. Los agentes revisan lo que ya está guardado y usan el briefing para completar solo los campos faltantes o cortados de las secciones indicadas. Se conservará el contenido existente.")}
              </DialogDescription>
            </DialogHeader>

            {!triggerHelpRunning && !triggerHelpComplete && (
              <div className="mt-5 space-y-3">
                <div className="border border-cyan-400/20 bg-cyan-400/[0.04] p-3.5">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200">{t("Etapas identificadas para correção", "Sections identified for repair", "Secciones identificadas para corregir")}</p>
                  {triggerHelpStages.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{triggerHelpStages.map(stage => <span key={stage} className="border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-1 font-mono text-[9px] text-cyan-100">{stage}</span>)}</div> : <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("Não encontrei lacunas nesta cópia da tela. O servidor fará uma nova validação antes de corrigir.", "No gaps were found in this screen copy. The server will validate again before making changes.", "No encontré faltantes en esta copia. El servidor volverá a validar antes de corregir.")}</p>}
                </div>
                <div className="border border-amber-400/20 bg-amber-400/[0.05] p-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">{t("O que vai acontecer", "What will happen", "Qué sucederá")}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {t("A IA vai tentar completar os campos ausentes ou interrompidos das etapas listadas. Quando existir um Masterplan, uma nova versão será criada para revisão. Os dados e conteúdos atuais serão preservados. Esta ação consome créditos.", "AI will try to complete missing or cut-off fields in the listed sections. If a master plan exists, a new version will be created for review. Existing data and content will be preserved. This uses credits.", "La IA intentará completar los campos faltantes o cortados de las secciones indicadas. Si existe un plan maestro, se creará una nueva versión para revisión. Se conservarán los datos y contenidos actuales. Esta acción consume créditos.")}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/60">
                  {t("Se os dados do briefing não forem suficientes, a seção continuará bloqueada e o sistema mostrará o que ainda falta.", "If the brief does not contain enough information, the section will remain blocked and the system will show what is still missing.", "Si el briefing no contiene información suficiente, la sección seguirá bloqueada y el sistema indicará qué falta.")}
                </p>
              </div>
            )}

            {triggerHelpRunning && (
              <div className="mt-5 space-y-3">
                <div className="border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-200">{t("Etapas em processamento", "Sections being processed", "Secciones en proceso")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{(triggerHelpStages.length ? triggerHelpStages : ["M01 — Resumo executivo", "M02 — Big Domino", "M03 — Posicionamento da oferta", "M04 — Diagnóstico de mercado", "M05 — Arquétipo de audiência", "M06 — Arquitetura da campanha", "M07 — Engenharia de gatilhos", "M08 — Métricas de performance", "M09 — Análise de riscos", "M10 — Observações estratégicas"]).map(stage => <span key={stage} className="border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-1 font-mono text-[9px] text-cyan-100">{stage}</span>)}</div>
                </div>
                <div className="h-1.5 overflow-hidden bg-white/5">
                  <div className="h-full w-full animate-pulse bg-gradient-to-r from-blue-500 to-violet-500" />
                </div>
                <div className="max-h-32 space-y-1.5 overflow-y-auto border border-white/5 bg-black/20 p-3">
                  {(liveEvents.slice(-4).length ? liveEvents.slice(-4) : [{ id: "starting", message: t("Preparando os agentes e carregando o briefing…", "Preparing the agents and loading the brief…", "Preparando los agentes y cargando el briefing…"), timestamp: "", type: "info" }]).map((event) => (
                    <div key={event.id} className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-muted-foreground/75">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                      <span>{event.message}</span>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-[9px] text-muted-foreground/50">{t("A correção é pontual; esta janela mostra o andamento e será fechada após a atualização.", "This is a targeted repair; progress appears here and this dialog closes after refresh.", "La corrección es puntual; el progreso aparece aquí y este cuadro se cerrará tras actualizar.")}</p>
              </div>
            )}

            {triggerHelpError && (
              <div role="alert" className="mt-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-xs leading-relaxed text-red-200/90">
                {triggerHelpError}
              </div>
            )}

            {!triggerHelpRunning && !triggerHelpComplete && (
              <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setTriggerHelpDialogOpen(false)} className="rounded-none font-mono text-[10px] uppercase tracking-wider">
                  {t("Agora não", "Not now", "Ahora no")}
                </Button>
                <Button onClick={confirmTriggerHelp} disabled={completeTriggerStrategyMutation.isPending} className="rounded-none bg-gradient-to-r from-blue-600 to-violet-600 font-mono text-[10px] font-bold uppercase tracking-wider text-white hover:brightness-110">
                  {completeTriggerStrategyMutation.isPending
                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{t("Iniciando…", "Starting…", "Iniciando…")}</>
                    : <><Sparkles className="mr-2 h-3.5 w-3.5" />{t("Completar seções", "Complete sections", "Completar secciones")}</>}
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
