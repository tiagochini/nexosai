import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Network, Play, Pause, ChevronRight, MapPin, TrendingUp,
  DollarSign, Target, CheckCircle2, Clock, Zap, Globe,
  ArrowRight, BarChart2, AlertCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useRef } from "react";

// ─── API helpers ──────────────────────────────────────────────────────────────

function useApiAuth() {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("nexos_token") : "";
  return (path: string, opts?: RequestInit) =>
    fetch(`/api${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts?.headers ?? {}),
      },
    }).then((r) => {
      if (!r.ok) throw new Error(`API ${path} failed: ${r.status}`);
      return r.json();
    });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineCampaign {
  id: string;
  title: string;
  status: string;
  pipelinePosition: number;
  durationDays: number | null;
  budgetTotal: number | null;
  revenueTarget: string | null;
  brainData: {
    week?: number;
    region?: string;
    stateCode?: string;
    tier?: string;
    cpmEst?: string;
    pop?: string;
    notes?: string;
    budgetBRL?: number;
    targetBRL?: number;
  };
  executionStartedAt: string | null;
  completedAt: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentPosition: number;
  capturePosition: number;
  totalCampaigns: number;
}

interface FullPipeline {
  pipeline: Pipeline;
  campaigns: PipelineCampaign[];
  completed: number;
  active: PipelineCampaign[];
  nextCapture: PipelineCampaign | null;
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  validacao: {
    label: "Validação",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  aprendizado: {
    label: "Aprendizado",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  aceleracao: {
    label: "Aceleração",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  dominancia: {
    label: "Dominância",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  segunda_onda: {
    label: "2ª Onda",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  nacional: {
    label: "Gran Finale",
    color: "text-yellow-300",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/40",
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  strategy_ready: { label: "Na fila", color: "text-zinc-400", icon: Clock },
  approved: { label: "Captura ativa", color: "text-blue-400", icon: Zap },
  executing: { label: "Executando", color: "text-primary", icon: Play },
  live: { label: "Ao vivo", color: "text-emerald-400", icon: Globe },
  completed: { label: "Concluída", color: "text-zinc-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "text-red-400", icon: AlertCircle },
};

// ─── Campaign card (conveyor belt item) ───────────────────────────────────────

function RegionCard({
  campaign,
  isActive,
  isCapture,
  isCurrent,
}: {
  campaign: PipelineCampaign;
  isActive: boolean;
  isCapture: boolean;
  isCurrent: boolean;
}) {
  const bd = campaign.brainData ?? {};
  const tier = TIER_CONFIG[bd.tier ?? "validacao"] ?? TIER_CONFIG.validacao;
  const status = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.strategy_ready;
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "relative flex-shrink-0 w-52 rounded-xl border p-4 transition-all duration-300 cursor-pointer",
        isCurrent
          ? "border-primary bg-primary/10 shadow-[0_0_30px_hsl(var(--primary)/0.25)] scale-105"
          : isCapture
          ? "border-blue-500/50 bg-blue-500/8 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
          : campaign.status === "completed"
          ? "border-zinc-700/40 bg-zinc-900/40 opacity-60"
          : "border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600",
      )}
    >
      {isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold">
            EXECUTANDO
          </Badge>
        </div>
      )}
      {isCapture && !isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-blue-500 text-white text-[10px] px-2 py-0.5 font-bold">
            CAPTURA ATIVA
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-mono text-zinc-500">W{bd.week ?? (campaign.pipelinePosition ?? 0) + 1}</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", tier.bg, tier.color)}>
          {tier.label}
        </span>
      </div>

      <div className="mb-2">
        <div className="text-2xl font-black text-zinc-100 tracking-tight leading-none mb-1">
          {bd.stateCode ?? "BR"}
        </div>
        <div className="text-xs font-medium text-zinc-300 leading-tight line-clamp-2">
          {bd.region ?? campaign.title}
        </div>
      </div>

      <div className={cn("text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 mb-3", tier.bg, tier.border, "border")}>
        <span className={tier.color}>CPM {bd.cpmEst ?? "—"}</span>
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between text-zinc-400">
          <span>Budget</span>
          <span className="font-mono text-zinc-300">
            {bd.budgetBRL ? `R$${(bd.budgetBRL / 1000).toFixed(0)}k` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Meta</span>
          <span className="font-mono text-zinc-300">
            {bd.targetBRL ? `R$${(bd.targetBRL / 1000).toFixed(0)}k` : "—"}
          </span>
        </div>
      </div>

      <div className={cn("mt-3 pt-2 border-t border-zinc-700/50 flex items-center gap-1.5", status.color)}>
        <StatusIcon className="w-3 h-3" />
        <span className="text-[10px] font-medium">{status.label}</span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPipeline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Network className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Nenhum pipeline configurado</h2>
        <p className="text-zinc-400 max-w-md">
          O Pipeline Regional orquestra uma sequência de lançamentos semana a semana, região por região.
          A Operação Brasil 52 aparecerá aqui assim que for configurada.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <AlertCircle className="w-4 h-4" />
        <span>Execute o seeder de campanhas regionais para ativar o pipeline.</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const apiFetch = useApiAuth();
  const [, navigate] = useLocation();
  const beltRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: pipelinesData, isLoading } = useQuery({
    queryKey: ["pipelines"],
    queryFn: () => apiFetch("/pipelines"),
  });

  const pipelines = (pipelinesData?.pipelines ?? []) as Array<Pipeline & { completed: number; active: number }>;
  const mainPipeline = pipelines[0] ?? null;

  const { data: fullData, isLoading: isLoadingFull } = useQuery<FullPipeline>({
    queryKey: ["pipeline", mainPipeline?.id],
    queryFn: () => apiFetch(`/pipelines/${mainPipeline!.id}`),
    enabled: !!mainPipeline,
  });

  const advanceMutation = useMutation({
    mutationFn: () => apiFetch(`/pipelines/${mainPipeline!.id}/advance`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", mainPipeline?.id] });
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const pipeline = fullData?.pipeline;
  const campaigns = fullData?.campaigns ?? [];
  const completedCount = fullData?.completed ?? 0;
  const activeCampaigns = fullData?.active ?? [];
  const nextCapture = fullData?.nextCapture;

  const totalCampaigns = campaigns.length || pipeline?.totalCampaigns || 52;
  const progressPct = totalCampaigns > 0 ? Math.round((completedCount / totalCampaigns) * 100) : 0;

  const totalRevenueMeta = campaigns.reduce((s, c) => s + (c.brainData?.targetBRL ?? 0), 0);
  const totalBudget = campaigns.reduce((s, c) => s + (c.brainData?.budgetBRL ?? 0), 0);

  const currentCampaign = campaigns.find(
    (c) => (c.pipelinePosition ?? 0) === (pipeline?.currentPosition ?? 0),
  );
  const captureCampaign = campaigns.find(
    (c) => (c.pipelinePosition ?? 0) === (pipeline?.capturePosition ?? -1),
  );

  // Scroll to active campaign
  const scrollToActive = () => {
    if (!beltRef.current || !currentCampaign) return;
    const activeEl = beltRef.current.querySelector(`[data-pos="${currentCampaign.pipelinePosition}"]`);
    activeEl?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Carregando pipeline...
        </div>
      </div>
    );
  }

  if (!mainPipeline || !pipeline) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <EmptyPipeline />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100 leading-none">{pipeline.name}</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {completedCount} de {totalCampaigns} regiões · Ciclo: <span className="text-zinc-400 font-medium">Sexta → Quinta (7 dias)</span> · Carrinho abre Segunda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToActive}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs"
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5" />
              Localizar atual
            </Button>
            {currentCampaign && (
              <Button
                size="sm"
                onClick={() => navigate(`/campaigns/${currentCampaign.id}`)}
                className="text-xs"
              >
                Ver campanha ativa
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-7xl mx-auto px-6 pb-3">
          <Progress value={progressPct} className="h-1.5 bg-zinc-800" />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span>W1 — Roraima</span>
            <span className="text-primary font-medium">{progressPct}% concluído</span>
            <span>W52 — Brasil Todo</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-5">
          {[
            {
              icon: CheckCircle2,
              label: "Regiões concluídas",
              value: completedCount,
              suffix: `/ ${totalCampaigns}`,
              color: "text-emerald-400",
            },
            {
              icon: Zap,
              label: "Em execução",
              value: activeCampaigns.length,
              suffix: "ativa(s)",
              color: "text-primary",
            },
            {
              icon: DollarSign,
              label: "Budget total",
              value: `R$${(totalBudget / 1000).toFixed(0)}k`,
              suffix: "52 semanas",
              color: "text-zinc-300",
            },
            {
              icon: Target,
              label: "Meta de receita",
              value: `R$${(totalRevenueMeta / 1000000).toFixed(1)}M`,
              suffix: `ROI ${totalBudget > 0 ? (totalRevenueMeta / totalBudget).toFixed(1) : "—"}x`,
              color: "text-amber-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("w-4 h-4", stat.color)} />
                <span className="text-[11px] text-zinc-500">{stat.label}</span>
              </div>
              <div className={cn("text-2xl font-bold leading-none", stat.color)}>
                {stat.value}
              </div>
              <div className="text-[10px] text-zinc-600 mt-1">{stat.suffix}</div>
            </div>
          ))}
        </div>

        {/* ── Current + Next cards ── */}
        {(currentCampaign || nextCapture) && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {currentCampaign && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-[0_0_40px_hsl(var(--primary)/0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Executando agora — Semana {(currentCampaign.pipelinePosition ?? 0) + 1}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/campaigns/${currentCampaign.id}`)}
                    className="border-primary/30 text-primary hover:bg-primary/10 text-xs h-7"
                  >
                    Abrir <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <div className="text-3xl font-black text-zinc-100 mb-1">
                  {currentCampaign.brainData?.stateCode ?? "BR"}
                </div>
                <div className="text-sm text-zinc-300 mb-3">{currentCampaign.brainData?.region ?? currentCampaign.title}</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "CPM est.", value: currentCampaign.brainData?.cpmEst ?? "—" },
                    { label: "Budget", value: currentCampaign.brainData?.budgetBRL ? `R$${(currentCampaign.brainData.budgetBRL / 1000).toFixed(0)}k` : "—" },
                    { label: "Meta", value: currentCampaign.brainData?.targetBRL ? `R$${(currentCampaign.brainData.targetBRL / 1000).toFixed(0)}k` : "—" },
                  ].map((item) => (
                    <div key={item.label} className="bg-zinc-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-zinc-500 mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold text-zinc-200">{item.value}</div>
                    </div>
                  ))}
                </div>
                {currentCampaign.brainData?.notes && (
                  <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                    {currentCampaign.brainData.notes}
                  </p>
                )}
              </div>
            )}

            {nextCapture ? (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                      Próxima — Captura ativa — Semana {(nextCapture.pipelinePosition ?? 0) + 1}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/campaigns/${nextCapture.id}`)}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs h-7"
                  >
                    Abrir <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <div className="text-3xl font-black text-zinc-100 mb-1">
                  {nextCapture.brainData?.stateCode ?? "BR"}
                </div>
                <div className="text-sm text-zinc-300 mb-3">{nextCapture.brainData?.region ?? nextCapture.title}</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "CPM est.", value: nextCapture.brainData?.cpmEst ?? "—" },
                    { label: "Budget", value: nextCapture.brainData?.budgetBRL ? `R$${(nextCapture.brainData.budgetBRL / 1000).toFixed(0)}k` : "—" },
                    { label: "Meta", value: nextCapture.brainData?.targetBRL ? `R$${(nextCapture.brainData.targetBRL / 1000).toFixed(0)}k` : "—" },
                  ].map((item) => (
                    <div key={item.label} className="bg-zinc-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-zinc-500 mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold text-zinc-200">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-center">
                <BarChart2 className="w-8 h-8 text-zinc-600" />
                <div>
                  <p className="text-sm text-zinc-400 font-medium">Próxima região na fila</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Quando a campanha atual atingir o status "Executando", a próxima região entra automaticamente em captura.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tier legend ── */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-[11px] text-zinc-600 font-medium">Tiers:</span>
          {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
            <span key={key} className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", cfg.bg, cfg.color, cfg.border)}>
              {cfg.label}
            </span>
          ))}
        </div>

        {/* ── Conveyor belt ── */}
        <div className="relative">
          <div
            ref={beltRef}
            className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {campaigns.map((campaign) => {
              const pos = campaign.pipelinePosition ?? 0;
              const isActive = activeCampaigns.some((a) => a.id === campaign.id);
              const isCapture = captureCampaign?.id === campaign.id;
              const isCurrent = currentCampaign?.id === campaign.id;

              return (
                <div
                  key={campaign.id}
                  data-pos={pos}
                  style={{ scrollSnapAlign: "center" }}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <RegionCard
                    campaign={campaign}
                    isActive={isActive}
                    isCapture={isCapture}
                    isCurrent={isCurrent}
                  />
                </div>
              );
            })}

            {campaigns.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-16 text-zinc-600 text-sm">
                Nenhuma campanha vinculada ao pipeline ainda.
              </div>
            )}
          </div>
        </div>

        {/* ── Manual advance ── */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/50 pt-5">
          <div>
            <p className="text-sm text-zinc-400 font-medium">Avançar manualmente</p>
            <p className="text-xs text-zinc-600">
              Use apenas para testes. Em produção, o avanço é automático quando a campanha atual entra em execução.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
          >
            {advanceMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Avançar pipeline
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
