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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, CheckCheck, Loader2, Brain, Zap,
  BookOpen, Clock, Archive, ChevronRight, Activity,
} from "lucide-react";
import { StrategyMasterplan, parseStrategyInsights } from "./strategy-masterplan";
import { useQuery } from "@tanstack/react-query";

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

const ANALYZING_STEPS = [
  { label: "Agente Comando — orchestração iniciada", done: false },
  { label: "Execution Governor — planejando pipeline", done: false },
  { label: "Agente de Estratégia — análise de mercado", done: false },
  { label: "Agente de Oferta — posicionamento e UVP", done: false },
  { label: "Agente de Audiência — segmentação de mercado", done: false },
  { label: "Arquitetura de Campanha — estrutura completa", done: false },
  { label: "Masterplan — compilação final", done: false },
];

function AnalyzingMasterplanDisplay({ liveEvents }: { liveEvents: LiveEvent[] }) {
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
          Sistema de Estratégia — Em Execução
        </div>
        <h1 className="font-mono text-2xl font-black uppercase tracking-widest text-foreground">
          Gerando Masterplan
        </h1>
        <p className="font-mono text-xs text-muted-foreground/60">
          34 agentes de IA construindo seu plano de lançamento completo
        </p>
        <div className="font-mono text-[10px] text-primary/40 tabular-nums">
          Tempo decorrido: {timeStr}
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
                {step.label}
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
              Eventos em tempo real
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
        Este processo leva de 3 a 8 minutos. Você pode fechar esta página — o Masterplan ficará disponível aqui quando pronto.
      </p>
    </div>
  );
}

// ─── History badge ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  generating: "Gerando Conteúdo",
  compliance_review: "Revisão de Compliance",
  awaiting_approval: "Aguardando Aprovação",
  approved: "Aprovado",
  executing: "Em Execução",
  live: "Ao Vivo",
  paused: "Pausado",
  completed: "Concluído",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignStrategyPage() {
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

  // ── Execute mutation (approve → generate content) ──────────────────────────
  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success("Aprovado! Gerando as peças de conteúdo...");
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        setLocation(`/campaigns/${campaignId}`);
      },
      onError: (err: unknown) => {
        type ErrBody = { error?: string; code?: string };
        const msg = (err as { data?: ErrBody })?.data?.error ?? "Falha ao iniciar geração.";
        toast.error(msg, { duration: 6000 });
      },
    },
  });

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
        Campanha não encontrada.
      </div>
    );
  }

  const status = campaign.status ?? "";
  const campaignRaw = campaign as Record<string, unknown>;
  const intakeD = ((campaignRaw["intakeData"] ?? {}) as Record<string, unknown>);
  const strategyD = ((campaignRaw["strategyData"] ?? {}) as Record<string, unknown>);
  const campaignTitle = String(intakeD["product.name"] ?? campaign.title ?? "Campanha");
  const track = String(intakeD["launch.track"] ?? "");
  const hasStrategy = Object.keys(strategyD).length > 0;
  const isHistory = isPostStrategy(status);
  const isReady = status === "strategy_ready";
  const isAnalyzing = status === "analyzing";

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
            <span className="font-mono text-[11px] uppercase tracking-widest">Campanha</span>
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
              Histórico · {STATUS_LABELS[status] ?? status}
            </Badge>
          )}
          {isReady && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400 font-bold">
                Aguardando Aprovação
              </span>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">
                Em Geração
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">

        {/* ANALYZING — show live loading state */}
        {isAnalyzing && (
          <AnalyzingMasterplanDisplay liveEvents={liveEvents} />
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
                    Masterplan Pronto
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                    Revise o plano abaixo. Quando aprovado, os agentes geram todo o conteúdo automaticamente.
                  </div>
                </div>
              </div>
              <Button
                onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
                disabled={executeMutation.isPending}
                className="shrink-0 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-10 text-xs px-6"
              >
                {executeMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                  : <><CheckCheck className="h-3.5 w-3.5" /> Aprovar e Gerar Conteúdo</>}
              </Button>
            </div>

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
                  Masterplan ainda sendo compilado...
                </p>
              </div>
            )}

            {/* Approve button — repeated at bottom for convenience */}
            {hasStrategy && (
              <div className="border border-cyan-400/40 bg-cyan-400/[0.04] p-4 flex flex-col sm:flex-row items-center gap-3 mt-6">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400/80">
                    Tudo revisado? Aprove para gerar o conteúdo completo do lançamento.
                  </span>
                </div>
                <Button
                  onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
                  disabled={executeMutation.isPending}
                  className="shrink-0 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-10 text-xs px-6"
                >
                  {executeMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                    : <><CheckCheck className="h-3.5 w-3.5" /> Aprovar e Gerar Conteúdo</>}
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
                  Masterplan — Histórico da Campanha
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">
                  Esta estratégia foi aprovada e o pipeline avançou para {STATUS_LABELS[status] ?? status}. O masterplan abaixo é somente leitura.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/campaigns/${campaignId}`)}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest gap-1.5 border-border/40"
              >
                Ver campanha <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

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
                  Dados de estratégia não disponíveis para esta campanha.
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
              Aguardando início da estratégia...
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/campaigns/${campaignId}`)}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest border-border/40"
            >
              Voltar para a campanha
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
