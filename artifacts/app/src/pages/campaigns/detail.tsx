import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import {
  useGetCampaign,
  useExecuteCampaign,
  CampaignExecuteInputPhase,
  getGetCampaignQueryKey,
} from "@workspace/api-client-react";
import { useCampaignSocket, type CampaignEvent } from "@/lib/socket";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Play, FileText, FileSpreadsheet, CheckCircle2,
  Clock, AlertCircle, Loader2, ChevronRight, Bot, BarChart3,
  ShieldCheck, Layers, Zap, XCircle, Eye, TrendingUp,
  AlertTriangle, Activity, Target, DollarSign, Users, BookOpen, Link2, X,
} from "lucide-react";
import { CampaignBrief } from "@/components/campaign-brief";
import { SocialPostPreview } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AgentRun {
  id: string;
  agentRole: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  tokensUsed?: number;
  costUsd?: string;
  errorMessage?: string;
}
interface Checkpoint {
  id: string;
  type: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
}
interface ContentPiece {
  id: string;
  type: string;
  platform?: string;
  launchPhase?: string;
  mentalTrigger?: string;
  content: string;
  status: string;
  createdAt: string;
}
interface MetricAlert { id: string; title: string; severity: string; description: string; recommendation: string; }
interface MetricsSummary {
  healthScore: number;
  grade: string;
  summary: string;
  totalRevenueBrl?: number;
  avgRoas?: number;
  avgCplBrl?: number;
  totalSales?: number;
  alertCount?: number;
  history?: { dayIndex: number; revenueBrl: string; roas: string; cplBrl: string; healthScore: number }[];
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Intake", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando Conteúdo",
  awaiting_approval: "Aguardando Aprovação", approved: "Aprovado",
  executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  analyzing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed: "text-muted-foreground border-border bg-muted/20",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-blue-400 border-blue-400/40 bg-blue-400/10",
};
const AGENT_ROLE_LABEL: Record<string, string> = {
  command:               "Comandante IA",
  strategy:              "Estrategista",
  launch_manager:        "Gerente de Lançamento",
  offer:                 "Especialista em Oferta",
  product_builder:       "Product Builder",
  copywriter:            "Copywriter",
  creative_director:     "Diretor Criativo",
  creative:              "Diretor Criativo",
  landing_page:          "Landing Page Expert",
  targeting:             "Targeting Expert",
  media_buyer:           "Media Buyer",
  affiliate_campaign:    "Especialista em Afiliados",
  analytics:             "Analista de Performance",
  optimization:          "Otimizador IA",
  video:                 "Estrategista de Vídeo",
  video_strategy:        "Estrategista de Vídeo",
  creator_growth:        "Creator Growth",
  compliance:            "Compliance Officer",
  profile_builder:       "Profile Builder",
  intake:                "Intake IA",
  ad_copy:               "Copy de Anúncios",
  cpl_script:            "Script CPL",
  vsl_script:            "Roteiro VSL",
  webinar_script:        "Roteiro Webinar",
  live_script:           "Roteiro Live",
  stories_sequence:      "Sequência Stories",
  media_brief:           "Brief de Mídia",
  financial_projector:   "Projetor Financeiro",
  launch_sequence_builder: "Builder de Sequências",
  social_media:          "Social Media IA",
  whatsapp_response:     "Auto-Resposta WhatsApp",
  perpetual_launch_manager: "Lançamento Perpétuo",
  continuous_sales_manager: "Gestor de Vendas Contínuas",
  item_copy:             "Copy de Item",
};
const ACTIVE_STATUSES = ["analyzing", "generating", "executing"];
const PIPELINE = [
  { id: "intake", label: "01 · Briefing", statuses: ["draft", "intake"] },
  { id: "strategy", label: "02 · Estratégia", statuses: ["analyzing", "strategy_ready"] },
  { id: "content", label: "03 · Conteúdo", statuses: ["generating", "awaiting_approval", "approved"] },
  { id: "launch", label: "04 · Lançamento", statuses: ["executing", "live"] },
  { id: "monitor", label: "05 · Monitor", statuses: ["completed"] },
];

function getPipelineState(status: string, stepStatuses: string[]): "done" | "active" | "pending" {
  const order = PIPELINE.map((s) => s.statuses).flat();
  const cur = order.indexOf(status);
  const first = Math.min(...stepStatuses.map((s) => order.indexOf(s)));
  const last = Math.max(...stepStatuses.map((s) => order.indexOf(s)));
  if (cur > last) return "done";
  if (cur >= first && cur <= last) return "active";
  return "pending";
}

// ── Mini components ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-success", running: "bg-primary animate-pulse",
    pending: "bg-yellow-400 animate-pulse", failed: "bg-destructive",
    draft: "bg-muted-foreground", approved: "bg-success", rejected: "bg-destructive",
    awaiting_review: "bg-yellow-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status] ?? "bg-muted-foreground"}`} />;
}

function KpiCard({ label, value, sub, icon: Icon, color = "primary" }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: "primary" | "success" | "yellow" | "cyan";
}) {
  const colorMap = {
    primary: "text-primary border-primary/20 bg-primary/5",
    success: "text-success border-success/20 bg-success/5",
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
    cyan: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5",
  };
  return (
    <div className={`border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="font-mono font-bold text-xl">{value}</div>
      {sub && <div className="font-mono text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── AgentPlanPanel ─────────────────────────────────────────────────────────────
function PlanBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/40 bg-muted/5 p-4 space-y-2">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary/70 font-bold">{label}</div>
      {children}
    </div>
  );
}

function PlanText({ value }: { value: unknown }) {
  if (!value) return null;
  if (typeof value === "string") return <p className="font-mono text-xs text-foreground/80 leading-relaxed">{value}</p>;
  if (Array.isArray(value)) return (
    <ul className="space-y-1">
      {(value as unknown[]).map((item, i) => (
        <li key={i} className="font-mono text-xs text-foreground/80 flex items-start gap-2 leading-relaxed">
          <span className="text-primary/50 shrink-0 mt-0.5">·</span>
          <span>{typeof item === "string" ? item : typeof item === "object" && item !== null ? Object.values(item as Record<string, unknown>).filter(v => typeof v === "string").join(" — ") : String(item)}</span>
        </li>
      ))}
    </ul>
  );
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider">{k.replace(/_/g, " ")}: </span>
            <span className="font-mono text-xs text-foreground/80">{typeof v === "string" ? v : Array.isArray(v) ? (v as unknown[]).join(", ") : JSON.stringify(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function AgentPlanPanel({
  strategyD, audienceD, offerD, targetingD, timelineD, checkpoints, onGoToStrategy,
}: {
  strategyD: Record<string, unknown>;
  audienceD: Record<string, unknown>;
  offerD: Record<string, unknown>;
  targetingD: Record<string, unknown>;
  timelineD: Record<string, unknown>;
  checkpoints: Checkpoint[];
  onGoToStrategy: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const approvedCps = checkpoints.filter(c => c.status === "approved");

  const hasPlan = Object.keys(strategyD).length > 0 || Object.keys(audienceD).length > 0 || Object.keys(offerD).length > 0;

  return (
    <div className="border border-cyan-400/25 bg-cyan-400/3 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 border-b border-cyan-400/20 hover:bg-cyan-400/5 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px hsl(180 100% 60%)" }} />
        <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold flex-1 text-left">
          Outputs dos Agentes — Plano de Ação
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/50">
          {expanded ? "▲ recolher" : "▼ expandir"}
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">

          {/* Strategy summary */}
          {!!strategyD.executiveSummary && (
            <PlanBlock label="Diagnóstico Executivo — Estrategista IA">
              <PlanText value={strategyD.executiveSummary} />
            </PlanBlock>
          )}

          {/* Market diagnosis */}
          {!!strategyD.marketDiagnosis && (
            <PlanBlock label="Diagnóstico de Mercado — Estrategista IA">
              <PlanText value={strategyD.marketDiagnosis} />
            </PlanBlock>
          )}

          {/* Offer positioning */}
          {!!(strategyD.offerPositioning ?? offerD.positioning ?? offerD.uvp) && (
            <PlanBlock label="Posicionamento da Oferta — Especialista em Oferta">
              <PlanText value={strategyD.offerPositioning ?? offerD} />
            </PlanBlock>
          )}

          {/* Audience segmentation */}
          {!!(strategyD.audienceSegmentation ?? audienceD.avatars ?? audienceD.segments) && (
            <PlanBlock label="Segmentação de Audiência — Profile Builder">
              <PlanText value={strategyD.audienceSegmentation ?? audienceD} />
            </PlanBlock>
          )}

          {/* Campaign architecture */}
          {!!strategyD.campaignArchitecture && (
            <PlanBlock label="Arquitetura da Campanha — Estrategista IA">
              <PlanText value={strategyD.campaignArchitecture} />
            </PlanBlock>
          )}

          {/* Trigger map */}
          {!!strategyD.triggerMap && (
            <PlanBlock label="Mapa de Gatilhos Mentais — Estrategista IA">
              <PlanText value={strategyD.triggerMap} />
            </PlanBlock>
          )}

          {/* Success metrics */}
          {!!strategyD.successMetrics && (
            <PlanBlock label="Metas & KPIs Projetados — Estrategista IA">
              <PlanText value={strategyD.successMetrics} />
            </PlanBlock>
          )}

          {/* Targeting data */}
          {Object.keys(targetingD).length > 0 && (
            <PlanBlock label="Targeting & Mídia Paga — Media Buyer">
              <PlanText value={targetingD} />
            </PlanBlock>
          )}

          {/* Timeline */}
          {Object.keys(timelineD).length > 0 && (
            <PlanBlock label="Cronograma do Lançamento — Gerente de Lançamento">
              <PlanText value={timelineD} />
            </PlanBlock>
          )}

          {/* Approved checkpoints */}
          {approvedCps.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-success/70 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />Checkpoints Aprovados ({approvedCps.length})
              </div>
              {approvedCps.map(cp => (
                <PlanBlock key={cp.id} label={cp.type.replace(/_/g, " ")}>
                  <div className="text-[11px] font-mono text-muted-foreground/50 mb-2">
                    Aprovado em {new Date(cp.createdAt).toLocaleString("pt-BR")}
                  </div>
                  {cp.data && Object.keys(cp.data).length > 0 && <PlanText value={cp.data} />}
                </PlanBlock>
              ))}
            </div>
          )}

          {!hasPlan && approvedCps.length === 0 && (
            <div className="py-6 text-center font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
              Nenhum output registrado ainda. Execute uma fase de IA para ver os resultados aqui.
            </div>
          )}

          <button
            onClick={onGoToStrategy}
            className="w-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary flex items-center justify-center gap-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ver Proposta Estratégica Completa
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState<"comando" | "agentes" | "estrategia" | "conteudo" | "metricas">("comando");
  const [missingIntegrations, setMissingIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [partialIntegrations, setPartialIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [bypassLaunchLoading, setBypassLaunchLoading] = useState(false);
  const autoLaunchFired = useRef(false);

  const { data, isLoading } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
    },
  });

  const campaign = data?.campaign;
  const isActive = ACTIVE_STATUSES.includes(campaign?.status ?? "");
  const refetchInterval = isActive ? 5000 : false;

  // Auto-redirect draft/intake campaigns to intake chat immediately
  useEffect(() => {
    if (!campaign) return;
    if (campaign.status === "draft" || campaign.status === "intake") {
      setLocation(`/campaigns/${campaignId}/intake`);
    }
  }, [campaign?.status, campaignId, setLocation, campaign]);

  // ── Agents query ──────────────────────────────────────────────────────────────
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/agents`],
    enabled: !!campaignId && activeTab === "agentes",
    refetchInterval: isActive ? 5000 : false,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/agents`);
      if (!res.ok) return { agents: [], checkpoints: [] };
      return res.json() as Promise<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>;
    },
  });

  // ── Content query ──────────────────────────────────────────────────────────────
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    enabled: !!campaignId && activeTab === "conteudo",
    refetchInterval: isActive ? 5000 : false,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return { pieces: [] };
      return res.json() as Promise<{ pieces: ContentPiece[] }>;
    },
  });

  // ── Content preview query (for awaiting_approval visual banner) ────────────
  const { data: previewContentData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content/preview`],
    enabled: !!campaignId && campaign?.status === "awaiting_approval",
    staleTime: 60_000,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return { pieces: [] };
      return res.json() as Promise<{ pieces: ContentPiece[] }>;
    },
  });

  const VISUAL_PLATFORM_ORDER = ["instagram", "tiktok", "facebook"];
  const previewSnippets: PreviewPiece[] = (() => {
    const raw = previewContentData?.pieces ?? [];
    if (raw.length === 0) return [];
    const PLATFORM_MAP: Record<string, PreviewPiece["platform"]> = {
      instagram_post: "instagram", instagram_reel: "instagram", instagram_story: "instagram",
      tiktok_video: "tiktok", tiktok_reel: "tiktok", native_video: "tiktok",
      facebook_post: "facebook", facebook_ad: "facebook",
      email_campaign: "email", email: "email",
      whatsapp_message: "whatsapp", whatsapp: "whatsapp",
      ad_copy: "ads",
    };
    const TYPE_MAP: Record<string, PreviewPiece["type"]> = {
      instagram_post: "post", instagram_reel: "reel", instagram_story: "story",
      tiktok_video: "native_video", tiktok_reel: "native_video",
      facebook_post: "post", facebook_ad: "ad",
      email_campaign: "email", email: "email",
      whatsapp_message: "message", whatsapp: "message",
      ad_copy: "ad",
    };
    const mapped = raw.map((p, i): PreviewPiece => {
      const rawType = p.type?.toLowerCase().replace(/\s+/g, "_") ?? "post";
      const platform = (p.platform as PreviewPiece["platform"] | undefined) ?? PLATFORM_MAP[rawType] ?? "instagram";
      return {
        id: p.id,
        platform,
        type: TYPE_MAP[rawType] ?? "post",
        dayIndex: i % 8,
        title: `${platform} — ${rawType.replace(/_/g, " ")}`,
        body: p.content,
        status: p.status === "draft" ? "pending" : p.status as PreviewPiece["status"],
        segment: "all",
      };
    });
    const visual = mapped.filter(p => VISUAL_PLATFORM_ORDER.includes(p.platform));
    const sorted = [...VISUAL_PLATFORM_ORDER.flatMap(plt => visual.filter(p => p.platform === plt).slice(0, 1))];
    return sorted.slice(0, 3);
  })();

  // ── Metrics query ──────────────────────────────────────────────────────────────
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/metrics/summary`],
    enabled: !!campaignId && activeTab === "metricas",
    refetchInterval: isActive ? 10000 : false,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/metrics/summary`);
      if (!res.ok) return null;
      return res.json() as Promise<MetricsSummary>;
    },
  });

  // ── Alerts query ──────────────────────────────────────────────────────────────
  const { data: alertsData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/alerts`],
    enabled: !!campaignId && activeTab === "metricas",
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/alerts`);
      if (!res.ok) return { alerts: [] };
      return res.json() as Promise<{ alerts: MetricAlert[] }>;
    },
  });

  // ── Real-time agent streaming via Socket.io ────────────────────────────────────
  const [liveEvents, setLiveEvents] = useState<CampaignEvent[]>([]);
  const liveRef = useRef<HTMLDivElement>(null);

  useCampaignSocket(
    campaignId,
    (event) => {
      setLiveEvents((prev) => {
        const next = [...prev, event].slice(-50); // keep last 50
        return next;
      });
      // Auto-invalidate queries on meaningful events
      if (event.type === "agent_completed" || event.type === "checkpoint_created" || event.type === "phase_changed") {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/agents`] });
      }
    },
    isActive,
  );

  // Auto-scroll live feed
  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveEvents]);

  // ── Execute campaign phase ─────────────────────────────────────────────────────
  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success("Fase iniciada. A IA está em execução.");
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      },
      onError: (err: unknown) => {
        const errData = (err as { response?: { data?: { error?: string; code?: string; data?: { shortage?: number; balance?: number; required?: number; missing?: { category: string; providers: string[] }[] } } } })?.response?.data;
        const code = errData?.code;
        const msg = errData?.error;
        if (code === "INSUFFICIENT_CREDITS" && errData?.data) {
          const { shortage = 0, balance = 0, required = 0 } = errData.data;
          toast.error(`Créditos insuficientes — faltam ${shortage} cr (saldo: ${balance}, necessário: ${required})`, {
            description: "Acesse Créditos de IA para comprar mais.",
            duration: 8000,
          });
        } else if (code === "MISSING_INTEGRATIONS") {
          setMissingIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else if (code === "PARTIAL_INTEGRATIONS") {
          setPartialIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else {
          toast.error(msg ?? "Falha ao iniciar fase.");
        }
      },
    },
  });

  // Auto-trigger launch when redirected from content approval with ?autolaunch=1
  useEffect(() => {
    if (!campaign) return;
    const qs = new URLSearchParams(searchString);
    if (qs.get("autolaunch") !== "1") return;
    if (autoLaunchFired.current) return;
    if (campaign.status !== "approved") return;
    autoLaunchFired.current = true;
    window.history.replaceState(null, "", `/campaigns/${campaignId}`);
    executeMutation.mutate({ campaignId, data: { phase: "launch" as CampaignExecuteInputPhase } });
  }, [campaign?.status, searchString, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Approve/reject content ─────────────────────────────────────────────────────
  const [contentActionLoading, setContentActionLoading] = useState<string | null>(null);
  const handleContentAction = async (pieceId: string, action: "approve" | "reject") => {
    setContentActionLoading(pieceId);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${pieceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro");
      }
      toast.success(action === "approve" ? "Conteúdo aprovado." : "Conteúdo rejeitado.");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar ação");
    } finally {
      setContentActionLoading(null);
    }
  };

  // ── Launch with bypass (after partial-integrations confirmation) ──────────────
  const handleBypassLaunch = async () => {
    setBypassLaunchLoading(true);
    setPartialIntegrations(null);
    try {
      const res = await customFetch<Response>(
        `/api/campaigns/${campaignId}/execute/launch?skipIntegrationWarning=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao lançar");
      }
      toast.success("Lançamento iniciado. A IA está em execução.");
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao lançar campanha.");
    } finally {
      setBypassLaunchLoading(false);
    }
  };

  // ── Approve checkpoint ────────────────────────────────────────────────────────
  const [checkpointLoading, setCheckpointLoading] = useState<string | null>(null);
  const handleCheckpointApprove = async (checkpointId: string) => {
    setCheckpointLoading(checkpointId);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId, approved: true }),
      });
      if (!res.ok) throw new Error("Erro");
      toast.success("Checkpoint aprovado.");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/agents`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch {
      toast.error("Erro ao aprovar checkpoint.");
    } finally {
      setCheckpointLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-32 w-full bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">
        Campanha não encontrada no registro
      </div>
    );
  }

  // While redirecting draft/intake campaigns, show a minimal loading state
  if (campaign.status === "draft" || campaign.status === "intake") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="relative">
          <div className="w-14 h-14 border border-primary/30 bg-primary/5 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-primary/40" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-primary/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-sm text-foreground font-bold uppercase tracking-widest">
            Abrindo o briefing com IA...
          </p>
          <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
            Em alguns segundos a IA vai iniciar a conversa
          </p>
        </div>
      </div>
    );
  }

  const campaignRaw = campaign as unknown as Record<string, unknown>;
  const intakeD = ((campaignRaw["intakeData"] ?? {}) as Record<string, unknown>);
  const strategyD = ((campaignRaw["strategyData"] ?? {}) as Record<string, unknown>);
  const offerD = ((campaignRaw["offerData"] ?? {}) as Record<string, unknown>);
  const audienceD = ((campaignRaw["audienceData"] ?? {}) as Record<string, unknown>);
  const targetingD = ((campaignRaw["targetingData"] ?? {}) as Record<string, unknown>);
  const timelineD = ((campaignRaw["timelineData"] ?? {}) as Record<string, unknown>);

  const getNextAction = (): { label: string; phase?: CampaignExecuteInputPhase; href?: string; description: string } | null => {
    switch (campaign.status) {
      case "strategy_ready": return { phase: "content", label: "Gerar Conteúdo", description: "Estratégia aprovada. Inicie a geração de conteúdo com IA." };
      case "awaiting_approval": return { href: `/campaigns/${campaignId}/content`, label: "Aprovar Conteúdo", description: "A IA gerou o conteúdo completo. Revise e aprove antes do lançamento.", phase: undefined };
      case "approved": return { phase: "launch", label: "Lançar Campanha", description: "Conteúdo aprovado. Inicie o lançamento." };
      case "executing": return { phase: "monitor", label: "Ativar Monitoramento", description: "Campanha em execução. Ative o monitoramento de métricas." };
      default: return null;
    }
  };
  const nextAction = getNextAction();

  const TABS = [
    { id: "comando" as const, label: "Comando", icon: Zap },
    { id: "agentes" as const, label: "Agentes", icon: Bot },
    { id: "estrategia" as const, label: "Proposta", icon: BookOpen },
    { id: "conteudo" as const, label: "Conteúdo", icon: Layers },
    { id: "metricas" as const, label: "Métricas", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">

      {/* ── Missing Integrations Modal (hard block) ── */}
      {missingIntegrations && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-destructive/50 bg-card w-full max-w-md shadow-2xl">
            <div className="border-b border-destructive/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-destructive">Canais Obrigatórios Ausentes</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">Conecte ao menos um canal de mensagens e um de e-mail para lançar.</p>
                </div>
              </div>
              <button onClick={() => setMissingIntegrations(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {missingIntegrations.map(m => (
                <div key={m.category} className="border border-destructive/20 bg-destructive/5 p-4">
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-destructive mb-1">{m.category}</div>
                  <p className="text-xs font-mono text-muted-foreground/70">
                    {m.reason && <span className="block text-muted-foreground/50 mb-1">{m.reason}</span>}
                    Conecte: <span className="text-foreground/80">{m.providers.join(" · ")}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 px-5 py-4 flex gap-3">
              <Link href="/integracoes" className="flex-1">
                <Button className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10">
                  <Link2 className="h-4 w-4" />Configurar Agora
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setMissingIntegrations(null)} className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-4">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Partial Integrations Modal (soft confirmation) ── */}
      {partialIntegrations && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-yellow-400/40 bg-card w-full max-w-lg shadow-2xl">
            <div className="border-b border-yellow-400/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-yellow-400">Cobertura de Canais Incompleta</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">Você pode lançar agora ou completar as integrações para máxima performance.</p>
                </div>
              </div>
              <button onClick={() => setPartialIntegrations(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/70 border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                <span className="text-yellow-400 font-bold">Atenção:</span> Sem todos os canais conectados, a IA operará com alcance reduzido. Canais ausentes não receberão disparo automático.
              </p>
              {partialIntegrations.map(m => (
                <div key={m.category} className="border border-border/40 bg-muted/10 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400/70 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80 mb-0.5">{m.category}</div>
                    {m.reason && <p className="text-xs font-mono text-muted-foreground/50 mb-1">{m.reason}</p>}
                    <p className="text-xs font-mono text-muted-foreground/70">Opções: <span className="text-foreground/60">{m.providers.join(" · ")}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 px-5 py-4 flex flex-col sm:flex-row gap-3">
              <Link href="/integracoes" className="flex-1">
                <Button className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10" onClick={() => setPartialIntegrations(null)}>
                  <Link2 className="h-4 w-4" />Completar Integrações
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleBypassLaunch}
                disabled={bypassLaunchLoading}
                className="flex-1 font-mono uppercase tracking-widest rounded-none border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 h-10 gap-2"
              >
                {bypassLaunchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Lançar Assim Mesmo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Retornar ao Radar
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground break-words">
                {campaign.title}
              </h1>
              <Badge variant="outline" className={`font-mono uppercase text-[11px] tracking-widest rounded-none px-2 py-1 border shrink-0 ${STATUS_COLOR[campaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="bg-card px-2 py-1 border border-border/50">{campaign.type}</span>
              <span className="bg-card px-2 py-1 border border-border/50">Track: <span className="text-primary">{campaign.track}</span></span>
              {campaign.revenueTarget && <span className="bg-card px-2 py-1 border border-border/50 text-success">Meta: R$ {Number(campaign.revenueTarget).toLocaleString("pt-BR")}</span>}
              {isActive && <span className="bg-primary/10 px-2 py-1 border border-primary/30 text-primary animate-pulse">IA em execução</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/campaigns/${campaign.id}/intake`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
                <FileText className="h-3.5 w-3.5" />Briefing
              </Button>
            </Link>
            <Link href={`/campaigns/${campaign.id}/creatives`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-primary/40 hover:border-primary text-primary hover:bg-primary/10 h-9 px-3 text-xs">
                <Layers className="h-3.5 w-3.5" />Criativos
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setLocation("/sequences")} className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />Sequências
            </Button>
          </div>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div className="border border-border/50 bg-card/40 p-4 relative overflow-hidden">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Pipeline de Execução</div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:items-center relative">
          <div className="hidden md:block absolute top-4 left-0 right-0 h-px bg-border/40 z-0" />
          {PIPELINE.map((step, idx) => {
            const state = getPipelineState(campaign.status, step.statuses);
            return (
              <div key={step.id} className="flex md:flex-col md:flex-1 items-center md:items-center gap-3 md:gap-2 relative z-10">
                {idx > 0 && <div className="md:hidden w-px h-3 bg-border/40 ml-4" />}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                  ${state === "done" ? "border-success bg-success/20" : state === "active" ? "border-primary bg-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "border-border/50 bg-muted/10"}`}>
                  {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> :
                   state === "active" ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> :
                   <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
                <span className={`text-[11px] font-mono uppercase tracking-widest md:text-center ${state === "done" ? "text-success" : state === "active" ? "text-primary" : "text-muted-foreground/40"}`}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border border-border/50 bg-card/40 p-1 rounded-sm overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all rounded-sm whitespace-nowrap shrink-0 flex-1 justify-center
              ${activeTab === tab.id ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            <tab.icon className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ COMANDO TAB ══════════════ */}
      {activeTab === "comando" && (
        <div className="space-y-4">
          {/* Next action */}
          {nextAction ? (
            <div className="border border-primary/30 bg-card/40 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-primary flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />Próxima Ação
                  </div>
                  <h3 className="font-mono font-bold text-lg text-foreground uppercase tracking-wide">{nextAction.label}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{nextAction.description}</p>
                </div>
                {nextAction.phase ? (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto"
                    onClick={() => executeMutation.mutate({ campaignId, data: { phase: nextAction.phase! } })}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Processando...</> : <><Play className="h-4 w-4 fill-current" />{nextAction.label}</>}
                  </Button>
                ) : nextAction.href ? (
                  <Link href={nextAction.href}>
                    <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto">
                      <Layers className="h-4 w-4" />{nextAction.label}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="border border-border/50 bg-card/40 p-5 flex items-center gap-4">
              {campaign.status === "live" || campaign.status === "executing" ? (
                <><div className="w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_10px_hsl(var(--success))]" />
                <div><div className="font-mono font-bold text-success uppercase tracking-widest">Campanha Ao Vivo</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">Monitorando em tempo real</div></div></>
              ) : campaign.status === "completed" ? (
                <><CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div><div className="font-mono font-bold text-muted-foreground uppercase tracking-widest">Campanha Concluída</div>
                  <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">Todos os dados disponíveis em Métricas</div></div></>
              ) : (
                <><AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div><div className="font-mono font-bold text-yellow-400 uppercase tracking-widest">Aguardando ação</div></div></>
              )}
            </div>
          )}

          {/* ─ Creatives Preview (awaiting_approval) ─ */}
          {campaign.status === "awaiting_approval" && (
            <div className="border border-yellow-400/30 bg-card/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-yellow-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-yellow-400 font-bold">
                    Prévia dos Criativos Gerados pela IA
                  </span>
                </div>
                <Link href={`/campaigns/${campaignId}/content`}>
                  <button className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                    Ver todos <ChevronRight className="h-3 w-3" />
                  </button>
                </Link>
              </div>
              {previewSnippets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {previewSnippets.map(piece => (
                    <SocialPostPreview key={piece.id} piece={piece} showMetrics={false} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { platform: "instagram" as const, type: "post" as const, body: "Algo grande está chegando. 🔥\n\nNos próximos 7 dias vou revelar o método que me ajudou a sair do zero para os 6 dígitos.\n\nSiga de perto." },
                    { platform: "tiktok" as const, type: "native_video" as const, body: "POV: você vai descobrir o que separa os lançamentos de 6 dígitos dos que não vendem nada.\n\nFica aqui essa semana.", tiktokHook: "O método que nenhum guru te conta sobre lançamentos" },
                    { platform: "facebook" as const, type: "post" as const, body: "Nos próximos 7 dias compartilho tudo que aprendi sobre lançamentos digitais que batem 6 dígitos.\n\nSalva e ativa as notificações 🔔" },
                  ].map((p, i) => (
                    <SocialPostPreview key={i} piece={{ id: `preview-${i}`, dayIndex: 0, title: `${p.platform} — Dia 0`, status: "pending", segment: "all", ...p }} showMetrics={false} />
                  ))}
                </div>
              )}
              <p className="font-mono text-[11px] text-muted-foreground/50">
                {previewSnippets.length > 0
                  ? `${previewSnippets.length} de ${previewContentData?.pieces?.length ?? 0} peças. Revise e aprove antes de lançar.`
                  : "Pré-visualização do estilo dos criativos. Clique em Aprovar Conteúdo para revisar todas as peças geradas."}
              </p>
            </div>
          )}

          {/* Quick stats from intake */}
          {Object.keys(intakeD).filter(k => !k.startsWith("_")).length > 0 && (
            <div className="border border-border/50 bg-card/40 p-4">
              <SectionHeader icon={FileText} label="Dados do Briefing (Intake)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ["Produto", intakeD["product.name"] as string],
                  ["Descrição", intakeD["product.description"] as string],
                  ["Categoria", intakeD["product.category"] as string],
                  ["Preço", intakeD["product.price"] ? `R$ ${intakeD["product.price"]}` : null],
                  ["Público", intakeD["audience.primaryPersona"] as string],
                  ["Formato", intakeD["product.deliveryMethod"] as string],
                  ["Tipo de campanha", intakeD["campaign.type"] as string],
                  ["Plataforma de vendas", intakeD["offer.salesPlatform"] as string],
                ].filter(([, v]) => !!v).map(([k, v]) => (
                  <div key={k as string} className="space-y-0.5">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{k}</div>
                    <div className="text-xs font-mono text-foreground">{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "ID", value: campaign.id.split("-")[0].toUpperCase() },
              { label: "Criado", value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—" },
              { label: "Atualizado", value: campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString("pt-BR") : "—" },
            ].map((item) => (
              <div key={item.label} className="border border-border/50 bg-card/30 px-4 py-3">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{item.label}</div>
                <div className="font-mono text-sm text-foreground mt-1 font-bold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ AGENTES TAB ══════════════ */}
      {activeTab === "agentes" && (
        <div className="space-y-4">
          {/* ─ Live feed (Socket.io) ─ */}
          {isActive && (
            <div className="border border-primary/30 bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-pulse" />
              <div className="px-4 py-2.5 border-b border-primary/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 6px hsl(var(--primary))" }} />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Live Production Display</span>
                <span className="font-mono text-[11px] text-muted-foreground/50 ml-auto">Socket.io · Tempo Real</span>
              </div>
              <div ref={liveRef} className="h-48 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px]">
                {liveEvents.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground/40 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Aguardando eventos da IA...</span>
                  </div>
                ) : (
                  liveEvents.map((ev, i) => {
                    const color =
                      ev.type === "agent_started"    ? "text-primary" :
                      ev.type === "agent_thinking"   ? "text-cyan-400/80" :
                      ev.type === "agent_completed"  ? "text-success" :
                      ev.type === "agent_failed"     ? "text-destructive" :
                      ev.type === "checkpoint_created" ? "text-yellow-400" :
                      "text-muted-foreground/60";
                    const prefix =
                      ev.type === "agent_started"    ? "▶" :
                      ev.type === "agent_thinking"   ? "·" :
                      ev.type === "agent_completed"  ? "✓" :
                      ev.type === "agent_failed"     ? "✗" :
                      ev.type === "checkpoint_created" ? "!" :
                      "·";
                    return (
                      <div key={i} className={`flex items-start gap-2 ${color}`}>
                        <span className="shrink-0 w-3">{prefix}</span>
                        <span className="text-muted-foreground/40 shrink-0 text-[11px] mt-0.5">
                          {new Date(ev.timestamp).toLocaleTimeString("pt-BR")}
                        </span>
                        {ev.agentType && (
                          <span className="shrink-0 uppercase tracking-wider text-[11px] font-bold opacity-80">
                            [{AGENT_ROLE_LABEL[ev.agentType] ?? ev.agentType}]
                          </span>
                        )}
                        <span className="leading-relaxed opacity-90">{ev.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─ Plano de Ação gerado pelos Agentes ─ */}
          {(Object.keys(strategyD).length > 0 || Object.keys(audienceD).length > 0 || Object.keys(offerD).length > 0 || Object.keys(timelineD).length > 0) && (
            <AgentPlanPanel
              strategyD={strategyD}
              audienceD={audienceD}
              offerD={offerD}
              targetingD={targetingD}
              timelineD={timelineD}
              checkpoints={agentsData?.checkpoints ?? []}
              onGoToStrategy={() => setActiveTab("estrategia")}
            />
          )}

          {agentsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : (
            <>
              {/* Pending checkpoints */}
              {(agentsData?.checkpoints ?? []).filter(c => c.status === "awaiting_review").map(cp => (
                <div key={cp.id} className="border border-yellow-400/30 bg-yellow-400/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-yellow-400 flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3 w-3" />Aprovação Necessária
                    </div>
                    <div className="font-mono text-sm font-bold uppercase tracking-wide">{cp.type.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{new Date(cp.createdAt).toLocaleString("pt-BR")}</div>
                  </div>
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-4 text-xs"
                    disabled={checkpointLoading === cp.id}
                    onClick={() => handleCheckpointApprove(cp.id)}
                  >
                    {checkpointLoading === cp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Aprovar
                  </Button>
                </div>
              ))}

              {/* Agent runs */}
              {(agentsData?.agents ?? []).length === 0 ? (
                <div className="py-12 text-center font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Nenhum agente executado ainda. Execute uma fase para acionar a IA.
                </div>
              ) : (
                <div className="space-y-2">
                  <SectionHeader icon={Bot} label={`${agentsData?.agents.length ?? 0} Execuções de Agente`} />
                  {[...(agentsData?.agents ?? [])].reverse().map(agent => (
                    <div key={agent.id} className="border border-border/50 bg-card/30 p-3 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <StatusDot status={agent.status} />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold uppercase tracking-wide">{AGENT_ROLE_LABEL[agent.agentRole] ?? agent.agentRole}</div>
                          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">
                            {new Date(agent.startedAt).toLocaleString("pt-BR")}
                            {agent.completedAt && ` → ${new Date(agent.completedAt).toLocaleString("pt-BR")}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {agent.tokensUsed && <span className="text-[11px] font-mono text-muted-foreground">{agent.tokensUsed.toLocaleString()} tokens</span>}
                        {agent.costUsd && <span className="text-[11px] font-mono text-muted-foreground">US$ {Number(agent.costUsd).toFixed(4)}</span>}
                        <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${agent.status === "completed" ? "border-success/40 text-success" : agent.status === "failed" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary"}`}>
                          {agent.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ PROPOSTA / ESTRATÉGIA TAB ══════════════ */}
      {activeTab === "estrategia" && (
        <CampaignBrief
          campaign={campaign as Parameters<typeof CampaignBrief>[0]["campaign"]}
          showApproveButton={campaign.status === "strategy_ready"}
          approveLoading={executeMutation.isPending}
          onApprove={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
        />
      )}

      {/* ══════════════ CONTEÚDO TAB ══════════════ */}
      {activeTab === "conteudo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader icon={Layers} label={`${contentData?.pieces?.length ?? 0} Peças de Conteúdo`} />
            {["strategy_ready", "approved"].includes(campaign.status) && (
              <Button
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
                onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
                disabled={executeMutation.isPending}
              >
                <Zap className="h-3 w-3" />Gerar Conteúdo
              </Button>
            )}
          </div>
          {contentLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 bg-muted/20" />)}</div>
          ) : (contentData?.pieces ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">Nenhuma peça de conteúdo gerada ainda.</p>
              {campaign.status === "strategy_ready" && (
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary" onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })} disabled={executeMutation.isPending}>
                  <Play className="h-4 w-4 fill-current" />Gerar Conteúdo Agora
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(contentData?.pieces ?? []).map(piece => (
                <div key={piece.id} className="border border-border/50 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-primary/40 text-primary">{piece.type}</Badge>
                    {piece.platform && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5">{piece.platform}</Badge>}
                    {piece.launchPhase && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-cyan-400/40 text-cyan-400">{piece.launchPhase}</Badge>}
                    {piece.mentalTrigger && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-yellow-400/40 text-yellow-400">{piece.mentalTrigger}</Badge>}
                    <div className="ml-auto">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${piece.status === "approved" ? "border-success/40 text-success" : piece.status === "rejected" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}>
                        {piece.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap mb-3 line-clamp-4">{piece.content}</p>
                  {piece.status === "draft" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs bg-success/20 hover:bg-success/30 text-success border border-success/30 hover:border-success/50"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "approve")}>
                        {contentActionLoading === piece.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Aprovar
                      </Button>
                      <Button size="sm" variant="outline"
                        className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "reject")}>
                        <XCircle className="h-3 w-3" />Rejeitar
                      </Button>
                      <Button size="sm" variant="ghost" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />Ver Completo
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MÉTRICAS TAB ══════════════ */}
      {activeTab === "metricas" && (
        <div className="space-y-4">
          {metricsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : !metricsData ? (
            <div className="py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhuma métrica registrada ainda.</p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-2">Métricas são ingeridas automaticamente durante a fase de execução ou via POST /api/campaigns/:id/metrics</p>
            </div>
          ) : (
            <>
              {/* Health score */}
              <div className="border border-border/50 bg-card/40 p-5">
                <SectionHeader icon={Activity} label="Health Score da Campanha" />
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="text-center">
                    <div className={`text-5xl font-mono font-bold ${metricsData.healthScore >= 70 ? "text-success" : metricsData.healthScore >= 40 ? "text-yellow-400" : "text-destructive"}`}>
                      {metricsData.healthScore}
                    </div>
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">/ 100 pts</div>
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] mt-2 px-3 py-0.5">Grade {metricsData.grade}</Badge>
                  </div>
                  <div className="flex-1">
                    <Progress value={metricsData.healthScore} className="h-2 rounded-none bg-muted/30 [&>div]:transition-all" />
                    <p className="text-xs font-mono text-muted-foreground mt-3 leading-relaxed">{metricsData.summary}</p>
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Receita Total" value={metricsData.totalRevenueBrl ? `R$ ${Number(metricsData.totalRevenueBrl).toLocaleString("pt-BR")}` : "—"} icon={DollarSign} color="success" />
                <KpiCard label="ROAS Médio" value={metricsData.avgRoas ? `${Number(metricsData.avgRoas).toFixed(1)}x` : "—"} icon={TrendingUp} color="primary" />
                <KpiCard label="CPL Médio" value={metricsData.avgCplBrl ? `R$ ${Number(metricsData.avgCplBrl).toFixed(2)}` : "—"} icon={Target} color="cyan" />
                <KpiCard label="Total Vendas" value={metricsData.totalSales?.toString() ?? "—"} icon={Activity} color="yellow" />
              </div>

              {/* Alerts */}
              {(alertsData?.alerts ?? []).length > 0 && (
                <div className="border border-border/50 bg-card/40 p-4 space-y-3">
                  <SectionHeader icon={AlertTriangle} label={`${alertsData!.alerts.length} Alertas Ativos`} />
                  {alertsData!.alerts.map(alert => (
                    <div key={alert.id} className={`border p-3 ${alert.severity === "critical" ? "border-destructive/40 bg-destructive/5" : "border-yellow-400/30 bg-yellow-400/5"}`}>
                      <div className="font-mono text-xs font-bold mb-1">{alert.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">{alert.description}</div>
                      {alert.recommendation && <div className="text-xs text-primary font-mono mt-1">→ {alert.recommendation}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {(metricsData.history ?? []).length > 0 && (
                <div className="border border-border/50 bg-card/40 p-4">
                  <SectionHeader icon={TrendingUp} label="Histórico Diário" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground uppercase tracking-widest">
                          <th className="text-left py-2 pr-4">Dia</th>
                          <th className="text-right py-2 pr-4">Receita</th>
                          <th className="text-right py-2 pr-4">ROAS</th>
                          <th className="text-right py-2 pr-4">CPL</th>
                          <th className="text-right py-2">Health</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricsData.history!.map(row => (
                          <tr key={row.dayIndex} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="py-2 pr-4">D{row.dayIndex}</td>
                            <td className="py-2 pr-4 text-right text-success">R$ {Number(row.revenueBrl).toLocaleString("pt-BR")}</td>
                            <td className="py-2 pr-4 text-right">{Number(row.roas).toFixed(1)}x</td>
                            <td className="py-2 pr-4 text-right">R$ {Number(row.cplBrl).toFixed(2)}</td>
                            <td className={`py-2 text-right font-bold ${row.healthScore >= 70 ? "text-success" : row.healthScore >= 40 ? "text-yellow-400" : "text-destructive"}`}>{row.healthScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
