import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useListCampaigns,
  useListSequences,
  useGetCreditsBalance,
  getListCampaignsQueryKey,
  getGetCreditsBalanceQueryKey,
  getListSequencesQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StrategyMasterplan, parseStrategyInsights } from "./campaigns/strategy-masterplan";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useMode } from "@/lib/mode";
import { IdentityMemoryCard } from "@/components/IdentityMemoryCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Rocket, Plus, CreditCard, ChevronRight, Bot, Workflow,
  ArrowRight, CheckCircle2, Play, Zap, AlertTriangle,
  DollarSign, Activity, TrendingUp, Target, Users,
  BarChart3, Calendar, Loader2, Star, Mail, ChevronDown, ChevronUp,
  FileText, Layers, Eye, BarChart2, Link2, Wifi, WifiOff,
  MessageSquare, Instagram, Facebook, Phone, Music2,
  Share2, Copy, Gift,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueSummary {
  total: number;
  byPlatform: Record<string, number>;
  transactionCount: number;
  avgTicket: number;
  dailyRevenue?: Array<{ date: string; gross: number; net: number; sales: number }>;
}
interface WeeklyRevenueSummary {
  total: number;
  transactionCount: number;
}
interface AgentRun {
  id: string; agentRole: string; status: string;
  startedAt: string; completedAt?: string;
}
interface Checkpoint {
  id: string; type: string; status: string; createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Briefing com o agente", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando Conteúdo",
  awaiting_approval: "Aguardando Aprovação", approved: "Aprovado",
  executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  live:              "text-success border-success/40 bg-success/10",
  executing:         "text-primary border-primary/40 bg-primary/10",
  generating:        "text-primary border-primary/40 bg-primary/10",
  analyzing:         "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved:          "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready:    "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed:         "text-muted-foreground border-border bg-muted/20",
  draft:             "text-muted-foreground border-border bg-muted/20",
  intake:            "text-blue-400 border-blue-400/40 bg-blue-400/10",
};
const AGENT_ROLE_LABEL: Record<string, string> = {
  command:               "Comandante",
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
  optimization:          "Otimizador",
  video:                 "Estrategista de Vídeo",
  video_strategy:        "Estrategista de Vídeo",
  creator_growth:        "Creator Growth",
  compliance:            "Compliance Officer",
  profile_builder:       "Profile Builder",
  intake:                "Briefing",
  ad_copy:               "Copy de Anúncios",
  cpl_script:            "Script CPL",
  vsl_script:            "Roteiro VSL",
  webinar_script:        "Roteiro Webinar",
  live_script:           "Roteiro Live",
  stories_sequence:      "Sequência Stories",
  media_brief:           "Brief de Mídia",
  financial_projector:   "Projetor Financeiro",
  launch_sequence_builder: "Builder de Sequências",
  social_media:          "Social Media",
  whatsapp_response:     "Auto-Resposta WhatsApp",
  perpetual_launch_manager: "Lançamento Perpétuo",
  continuous_sales_manager: "Gestor de Vendas Contínuas",
  item_copy:             "Copy de Item",
};
const PIPELINE_ORDER = [
  "draft", "intake", "analyzing", "strategy_ready",
  "generating", "awaiting_approval", "approved",
  "executing", "live", "completed",
];
const PIPELINE_STEPS = [
  { id: "intake",    label: "Briefing",    statuses: ["draft", "intake"] },
  { id: "strategy",  label: "Estratégia",  statuses: ["analyzing", "strategy_ready"] },
  { id: "content",   label: "Conteúdo",    statuses: ["generating", "awaiting_approval", "approved"] },
  { id: "launch",    label: "Lançamento",  statuses: ["executing", "live"] },
  { id: "monitor",   label: "Monitorar",   statuses: ["completed"] },
];
const MODEL_LABEL: Record<string, string> = {
  plf: "PLF", formula_de_lancamento: "Fórmula de Lançamento",
  semente: "Semente", afiliado: "Afiliado", perpetual: "Perpétuo", custom: "Custom",
};

// ─── Mini Components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color = "primary", href, loading,
  breakdown, expanded, onToggle,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "primary" | "success" | "yellow" | "cyan";
  href?: string; loading?: boolean;
  breakdown?: Array<{ label: string; value: string | number }>;
  expanded?: boolean; onToggle?: () => void;
}) {
  const colorMap = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    success:  "border-success/20 bg-success/5 text-success",
    yellow:   "border-yellow-400/20 bg-yellow-400/5 text-yellow-400",
    cyan:     "border-cyan-400/20 bg-cyan-400/5 text-cyan-400",
  };
  const hasBreakdown = breakdown && breakdown.length > 0;
  const inner = (
    <div className={`border h-full group transition-all ${colorMap[color]}`}>
      <div
        className={`p-4 ${hasBreakdown ? "cursor-pointer select-none" : href ? "cursor-pointer hover:opacity-80" : ""}`}
        onClick={hasBreakdown && onToggle ? onToggle : undefined}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="font-mono text-[11px] uppercase tracking-widest opacity-60 flex-1">{label}</span>
          {hasBreakdown && (
            expanded
              ? <ChevronUp className="h-3 w-3 opacity-40" />
              : <ChevronDown className="h-3 w-3 opacity-40" />
          )}
        </div>
        {loading ? (
          <Skeleton className="h-9 w-24 bg-muted/20" />
        ) : (
          <>
            <div className="font-mono font-bold text-2xl text-foreground">{value}</div>
            {sub && <div className="font-mono text-xs opacity-50 mt-1">{sub}</div>}
          </>
        )}
      </div>
      {expanded && hasBreakdown && (
        <div className="border-t border-current/10 px-4 py-3 space-y-1.5">
          {breakdown.map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest opacity-50">{item.label}</span>
              <span className="font-mono text-xs font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  if (hasBreakdown) return inner;
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Execution Flowchart ──────────────────────────────────────────────────────

function ExecutionFlowchart({ campaigns }: { campaigns: Array<{ id: string; status: string }> }) {
  const nodes = [
    { id: "intake",    label: "Briefing",    icon: FileText,  statuses: ["draft", "intake"],         color: "text-blue-400  border-blue-400/40  bg-blue-400/10",  href: null },
    { id: "strategy",  label: "Estratégia",  icon: Target,    statuses: ["analyzing","strategy_ready"], color: "text-cyan-400  border-cyan-400/40  bg-cyan-400/10",  href: null },
    { id: "content",   label: "Conteúdo",    icon: Layers,    statuses: ["generating","awaiting_approval","approved"], color: "text-purple-400 border-purple-400/40 bg-purple-400/10", href: null },
    { id: "launch",    label: "Lançamento",  icon: Rocket,    statuses: ["executing","live"],         color: "text-success    border-success/40    bg-success/10",    href: null },
    { id: "monitor",   label: "Resultados",  icon: BarChart2, statuses: ["completed"],                color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", href: "/revenue" },
  ];

  const statusCounts = nodes.map(node => ({
    ...node,
    count: campaigns.filter(c => node.statuses.includes(c.status)).length,
    campaign: campaigns.find(c => node.statuses.includes(c.status)),
  }));

  return (
    <div className="border border-border/50 bg-card/30 p-4 overflow-x-auto">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-4">
        Fluxo de Execução · Visão Geral
      </div>
      <div className="flex items-center gap-0 min-w-max">
        {statusCounts.map((node, idx) => {
          const Icon = node.icon;
          const isActive = node.count > 0;
          const content = (
            <div
              key={node.id}
              className={`border px-3 py-2.5 flex flex-col items-center gap-1.5 min-w-[90px] transition-all
                ${isActive ? `${node.color} cursor-pointer hover:opacity-80` : "border-border/20 bg-muted/5 text-muted-foreground/30"}`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-widest font-bold">{node.label}</span>
              {isActive ? (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1 py-0 border-current/40 bg-current/10">
                  {node.count}
                </Badge>
              ) : (
                <span className="font-mono text-[11px] opacity-30">—</span>
              )}
            </div>
          );
          return (
            <div key={node.id} className="flex items-center">
              {idx > 0 && (
                <div className="flex items-center">
                  <div className="w-4 h-px bg-border/30" />
                  <ChevronRight className="h-2.5 w-2.5 text-border/30 -mx-0.5" />
                  <div className="w-2 h-px bg-border/30" />
                </div>
              )}
              {node.campaign ? (
                <Link href={`/campaigns/${node.campaign.id}`}>
                  {content}
                </Link>
              ) : node.href ? (
                <Link href={node.href}>
                  {content}
                </Link>
              ) : content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineProgress({ status }: { status: string }) {
  const currentIdx = PIPELINE_ORDER.indexOf(status);
  const total = PIPELINE_ORDER.length - 1;
  const pct = total > 0 ? Math.round((currentIdx / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Step indicators */}
      <div className="flex gap-0">
        {PIPELINE_STEPS.map((step, i) => {
          const stepStatuses = step.statuses;
          const stepMin = Math.min(...stepStatuses.map(s => PIPELINE_ORDER.indexOf(s)));
          const stepMax = Math.max(...stepStatuses.map(s => PIPELINE_ORDER.indexOf(s)));
          const isDone    = currentIdx > stepMax;
          const isActive  = currentIdx >= stepMin && currentIdx <= stepMax;
          const isPending = currentIdx < stepMin;
          return (
            <div key={step.id} className="flex-1 flex flex-col gap-1">
              <div className={`h-1 transition-all ${
                isDone   ? "bg-success" :
                isActive ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" :
                           "bg-muted/20"
              }`} />
              <span className={`font-mono text-[11px] uppercase tracking-widest hidden sm:block ${
                isActive ? "text-primary font-bold" :
                isDone   ? "text-muted-foreground/60" :
                           "text-muted-foreground/30"
              }`}>{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground/50">{pct}% concluído</span>
        <span className={`font-mono text-[11px] uppercase tracking-widest ${STATUS_COLOR[status]?.split(" ")[0] ?? "text-primary"}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
    </div>
  );
}

// ─── Integration Health Panel ─────────────────────────────────────────────────

interface IntegrationStatus {
  provider: string;
  status: string;
}

const CRITICAL_INTEGRATIONS = [
  { provider: "whatsapp_business", label: "WhatsApp",  icon: MessageSquare, color: "text-green-400"  },
  { provider: "instagram",         label: "Instagram", icon: Instagram,     color: "text-pink-400"   },
  { provider: "tiktok",            label: "TikTok",    icon: Music2,        color: "text-pink-300"   },
  { provider: "facebook",          label: "Facebook",  icon: Facebook,      color: "text-blue-400"   },
  { provider: "rd_station",        label: "RD Station",icon: Mail,          color: "text-orange-400" },
];

// ─── Referral Widget ──────────────────────────────────────────────────────────

interface ReferralStats {
  referralCode: string | null;
  referralCount: number;
  totalCreditsEarned: number;
  currentTier: { label: string; reward: string | null };
  nextTier: { min: number; label: string } | null;
  bonusPerReferral: number;
}

function ReferralWidget() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/referrals/stats"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/referrals/stats");
      if (!res.ok) return null;
      return res.json() as Promise<ReferralStats>;
    },
    staleTime: 60_000,
  });

  if (isLoading || !data?.referralCode) return null;

  const shareUrl = `https://agencianexos.vip/mapa?ref=${data.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nextIn = data.nextTier ? data.nextTier.min - data.referralCount : 0;

  return (
    <div className="border border-primary/20 bg-card/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Left — icon + label */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 border border-primary/30 bg-primary/10 flex items-center justify-center text-primary">
          <Gift className="h-4 w-4" />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Indicações</p>
          <p className="font-mono text-base font-bold text-foreground leading-tight">
            {data.referralCode}
          </p>
        </div>
      </div>

      <div className="w-px h-8 bg-border/40 shrink-0 hidden sm:block" />

      {/* Stats */}
      <div className="flex items-center gap-6 flex-1 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Indicados</p>
          <p className="font-mono text-lg font-bold text-primary">{data.referralCount}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Créditos ganhos</p>
          <p className="font-mono text-lg font-bold text-success">{data.totalCreditsEarned} cr</p>
        </div>
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            {data.currentTier.label}
            {data.nextTier && <span className="text-muted-foreground/50"> · {nextIn} para {data.nextTier.label}</span>}
          </p>
          <div className="h-1 bg-border/30 w-full max-w-[160px]">
            {data.nextTier && (
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, ((data.nextTier.min - nextIn) / data.nextTier.min) * 100)}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Copy link */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 border-primary/30 text-primary hover:bg-primary/10 gap-1.5 shrink-0"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado!" : "Copiar link"}
      </Button>
    </div>
  );
}

function SalesTeamPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-team/analytics"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/sales-team/analytics");
      if (!res.ok) return null;
      return res.json() as Promise<{ analytics: { active: number; converted: number; todayConversions: number; conversionRate: number } }>;
    },
    staleTime: 60_000,
  });

  const analytics = data?.analytics;
  if (isLoading || !analytics) return null;

  const hasActivity = analytics.active > 0 || analytics.converted > 0;

  return (
    <div className="border border-border/30 bg-card/20 px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-cyan-400 shrink-0">
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] uppercase tracking-widest font-bold">Time de Vendas</span>
      </div>
      <div className="w-px h-4 bg-border/40 shrink-0" />
      <div className="flex items-center gap-4 flex-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground/60">Ativos:</span>
          <span className={`font-mono text-[11px] font-bold ${analytics.active > 0 ? "text-primary" : "text-muted-foreground/40"}`}>{analytics.active}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground/60">Convertidos hoje:</span>
          <span className={`font-mono text-[11px] font-bold ${analytics.todayConversions > 0 ? "text-green-400" : "text-muted-foreground/40"}`}>{analytics.todayConversions}</span>
        </div>
        {hasActivity && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground/60">Taxa:</span>
            <span className="font-mono text-[11px] font-bold text-amber-400">{analytics.conversionRate}%</span>
          </div>
        )}
      </div>
      <Link href="/atendimento" className="shrink-0">
        <Button size="sm" variant="outline"
          className="rounded-none font-mono text-[10px] uppercase tracking-widest h-6 px-2 border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 gap-1">
          <ChevronRight className="h-3 w-3" />
          {hasActivity ? "Ver Atendimentos" : "Iniciar Atendimento"}
        </Button>
      </Link>
    </div>
  );
}

function IntegrationHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as IntegrationStatus[] };
      return res.json() as Promise<{ integrations: IntegrationStatus[] }>;
    },
    staleTime: 60_000,
  });

  const integrations = data?.integrations ?? [];
  const connected = integrations.filter(i => i.status === "connected").map(i => i.provider);
  const connectedCount = CRITICAL_INTEGRATIONS.filter(i => connected.includes(i.provider)).length;
  const isFullAuto = connectedCount === CRITICAL_INTEGRATIONS.length;
  const missingCount = CRITICAL_INTEGRATIONS.length - connectedCount;

  if (isLoading) return null;

  return (
    <div className={`border flex items-center gap-3 px-4 py-3 transition-colors ${
      isFullAuto
        ? "border-success/30 bg-success/5"
        : missingCount > 2
          ? "border-yellow-400/20 bg-yellow-400/5"
          : "border-border/40 bg-card/30"
    }`}>
      {/* Status badge */}
      <div className={`flex items-center gap-1.5 shrink-0 ${isFullAuto ? "text-success" : "text-yellow-400"}`}>
        {isFullAuto
          ? <Wifi className="h-3.5 w-3.5" />
          : <WifiOff className="h-3.5 w-3.5" />}
        <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
          {isFullAuto ? "Full Auto" : `${connectedCount}/${CRITICAL_INTEGRATIONS.length} conectadas`}
        </span>
      </div>

      <div className="w-px h-4 bg-border/40 shrink-0" />

      {/* Integration icons */}
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {CRITICAL_INTEGRATIONS.map(({ provider, label, icon: Icon, color }) => {
          const isConn = connected.includes(provider);
          return (
            <div key={provider} className={`flex items-center gap-1 ${isConn ? color : "text-muted-foreground/30"}`}>
              <Icon className="h-3 w-3" />
              <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">{label}</span>
              {isConn && <span className="font-mono text-[10px] text-success">✓</span>}
            </div>
          );
        })}
      </div>

      {/* CTA if missing */}
      {!isFullAuto && (
        <Link href="/integracoes" className="shrink-0">
          <Button size="sm" variant="outline"
            className="rounded-none font-mono text-[10px] uppercase tracking-widest h-6 px-2 border-primary/30 text-primary hover:bg-primary/10 gap-1">
            <Link2 className="h-2.5 w-2.5" />
            Conectar
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Smart Next Action ────────────────────────────────────────────────────────

function nextAction(campaigns: { id: string; title: string; status: string }[]) {
  if (!campaigns.length) {
    return {
      icon: Rocket, color: "text-primary", bg: "border-primary/20 bg-primary/5",
      title: "Inicie sua primeira missão de lançamento",
      sub: "O agente monta toda a estratégia, cria o conteúdo e executa automaticamente",
      href: "/campaigns/new", cta: "Criar Campanha",
    };
  }
  const live        = campaigns.find(c => c.status === "live");
  const executing   = campaigns.find(c => c.status === "executing");
  const approval    = campaigns.find(c => c.status === "awaiting_approval");
  const generating  = campaigns.find(c => c.status === "generating");
  const analyzing   = campaigns.find(c => c.status === "analyzing");
  const intake      = campaigns.find(c => c.status === "intake" || c.status === "draft");
  const ready       = campaigns.find(c => c.status === "strategy_ready");
  const approved    = campaigns.find(c => c.status === "approved");

  if (live) return {
    icon: Play, color: "text-success", bg: "border-success/20 bg-success/5",
    title: `Campanha ao vivo: "${live.title}"`,
    sub: "Acompanhe métricas em tempo real e aplique ajustes do agente",
    href: `/campaigns/${live.id}`, cta: "Ver Métricas",
  };
  if (approval) return {
    icon: CheckCircle2, color: "text-yellow-400", bg: "border-yellow-400/20 bg-yellow-400/5",
    title: `Conteúdo aguarda sua aprovação: "${approval.title}"`,
    sub: "A agente gerou o conteúdo completo. Revise e aprove para lançar.",
    href: `/campaigns/${approval.id}`, cta: "Revisar Agora",
  };
  if (approved) return {
    icon: Zap, color: "text-green-400", bg: "border-green-400/20 bg-green-400/5",
    title: `Pronto para lançar: "${approved.title}"`,
    sub: "Conteúdo aprovado. Execute o lançamento agora.",
    href: `/campaigns/${approved.id}`, cta: "Lançar",
  };
  if (executing || generating || analyzing) {
    const c = executing ?? generating ?? analyzing!;
    return {
      icon: Bot, color: "text-primary", bg: "border-primary/20 bg-primary/5",
      title: `Em execução: "${c.title}"`,
      sub: "Os agentes estão trabalhando. Acompanhe na aba Agentes.",
      href: `/campaigns/${c.id}`, cta: "Ver Agentes",
    };
  }
  if (ready) return {
    icon: Target, color: "text-cyan-400", bg: "border-cyan-400/20 bg-cyan-400/5",
    title: `Estratégia pronta para "${ready.title}"`,
    sub: "Estratégia criada. Inicie a geração de conteúdo com o agente.",
    href: `/campaigns/${ready.id}`, cta: "Gerar Conteúdo",
  };
  if (intake) return {
    icon: Bot, color: "text-blue-400", bg: "border-blue-400/20 bg-blue-400/5",
    title: `Continue o briefing: "${intake.title}"`,
    sub: "A agente está aguardando suas respostas para montar a estratégia de lançamento.",
    href: `/campaigns/${intake.id}/intake`, cta: "Continuar Briefing",
  };
  return {
    icon: Workflow, color: "text-cyan-400", bg: "border-cyan-400/20 bg-cyan-400/5",
    title: "Configure sequências de automação para seu lançamento",
    sub: "Email + WhatsApp automatizados para nutrir e converter sua lista",
    href: "/sequences", cta: "Ver Sequências",
  };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, workspace, plan, planSlug, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);
  const { isArquiteto, isFundador, isExpert, isGuided } = useMode();

  // ── Data fetching ──
  const { data: campaignsData, isLoading: loadingCampaigns } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey() },
  });

  const { data: creditsData, isLoading: loadingCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey() },
  });

  const { data: sequencesData, isLoading: loadingSequences } = useListSequences({
    query: { queryKey: getListSequencesQueryKey() },
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ["/api/revenue/summary"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/summary");
      if (!res.ok) return null;
      return res.json() as Promise<RevenueSummary>;
    },
  });

  const { data: weeklyRevenueData } = useQuery({
    queryKey: ["/api/revenue/summary", "7d"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/summary?days=7");
      if (!res.ok) return null;
      return res.json() as Promise<WeeklyRevenueSummary>;
    },
  });

  const campaigns = campaignsData?.campaigns ?? [];

  // Active campaign = first non-completed, non-draft
  const activeCampaign = campaigns.find(c =>
    !["completed", "draft"].includes(c.status)
  ) ?? campaigns[0];

  // Strategy-ready campaign — fetch full data with strategyData for masterplan
  const readyCampaign = campaigns.find(c => c.status === "strategy_ready");
  const { data: readyCampaignFull } = useQuery({
    queryKey: [`/api/campaigns/${readyCampaign?.id}`],
    enabled: !!readyCampaign?.id,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${readyCampaign!.id}`);
      if (!res.ok) return null;
      const d = await res.json() as { campaign: Record<string, unknown> };
      return d.campaign;
    },
  });

  const queryClient = useQueryClient();
  const approveMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "content" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Erro ao aprovar estratégia");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Estratégia aprovada! Gerando conteúdo...");
      void queryClient.invalidateQueries({ queryKey: [getListCampaignsQueryKey()] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [masterplanExpanded, setMasterplanExpanded] = useState(true);

  const { data: agentsData } = useQuery({
    queryKey: [`/api/campaigns/${activeCampaign?.id}/agents`],
    enabled: !!activeCampaign?.id,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${activeCampaign!.id}/agents`);
      if (!res.ok) return { agents: [], checkpoints: [] };
      return res.json() as Promise<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>;
    },
  });

  // ── Auto-redirect to onboarding for new solo users ──
  useEffect(() => {
    if (onboardingChecked) return;
    if (isAdmin || planSlug === "agency") return;
    if (loadingCampaigns) return;
    if (campaigns.length === 0 && planSlug !== null) {
      setOnboardingChecked(true);
      setLocation("/welcome");
    } else {
      setOnboardingChecked(true);
    }
  }, [isAdmin, planSlug, campaigns, loadingCampaigns, onboardingChecked, setLocation]);

  // ── Derived state ──
  const activeCampaigns = campaigns.filter(c => !["completed"].includes(c.status)).length;
  const liveCampaigns   = campaigns.filter(c => c.status === "live").length;
  const activeSequences = (sequencesData?.sequences ?? []).filter(s => s.status === "active" || s.status === "live").length;
  const totalCredits    = plan?.creditsMonthly ?? 0;
  const creditsBalance  = creditsData?.balance ?? 0;
  const creditsPct      = totalCredits > 0 ? Math.min(100, Math.round((creditsBalance / totalCredits) * 100)) : 0;
  const creditsLow      = creditsPct < 15;
  const revenueTotal    = revenueData?.total ?? 0;
  const action          = nextAction(campaigns);
  const ActionIcon      = action.icon;

  const recentAgents = [...(agentsData?.agents ?? [])].reverse().slice(0, 6);
  const pendingCheckpoints = (agentsData?.checkpoints ?? []).filter(c => c.status === "awaiting_review");

  // Loading skeleton
  if (loadingCampaigns && !onboardingChecked) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-border/50 pb-5">
          <Skeleton className="h-9 w-72 bg-muted/20" />
          <Skeleton className="h-4 w-48 bg-muted/20 mt-2" />
        </div>
        <Skeleton className="h-36 bg-muted/20" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}
        </div>
      </div>
    );
  }

  // ── Fundador View — guided, simplified, emotional ─────────────────────────
  if (isFundador) {
    const firstName = user?.name?.split(" ")[0] ?? "você";
    const MISSION_PHASES = [
      { id: "intake",    label: "Briefing",    desc: "Agente conversa com você", icon: "01" },
      { id: "strategy",  label: "Estratégia",  desc: "Plano gerado",         icon: "02" },
      { id: "content",   label: "Conteúdo",    desc: "Copy pronto",          icon: "03" },
      { id: "executing", label: "Execução",    desc: "Disparo automático",   icon: "04" },
      { id: "live",      label: "Ao Vivo",     desc: "Carrinho aberto",      icon: "05" },
    ];
    const phaseIndex = activeCampaign
      ? Math.max(0, MISSION_PHASES.findIndex(p => activeCampaign.status.includes(p.id)))
      : -1;

    return (
      <div className="max-w-2xl mx-auto space-y-5 py-2">

        {/* Greeting */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">
              {liveCampaigns > 0 ? `${liveCampaigns} campanha ao vivo` : "Plataforma pronta"}
            </span>
          </div>
          <h1 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground mb-1">
            Olá, <span className="text-primary">{firstName}</span>.
          </h1>
          <p className="font-mono text-sm text-muted-foreground/60">
            {activeCampaign
              ? "Aqui está onde sua missão está agora."
              : "O time está esperando seu briefing."}
          </p>
        </div>

        {/* Missão ativa ou CTA para criar */}
        {activeCampaign ? (
          <div className="border border-primary/30 bg-card/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/60" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/60" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary/60" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/60" />
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
                Missão em Andamento
              </div>
              <h2 className="font-mono font-bold text-base uppercase tracking-tight text-foreground mb-4">
                {activeCampaign.title}
              </h2>
              {/* Phase progress */}
              <div className="flex gap-1 mb-4">
                {MISSION_PHASES.map((phase, idx) => (
                  <div key={phase.id} className="flex-1 flex flex-col gap-1">
                    <div className={`h-1 rounded-full transition-all ${
                      idx < phaseIndex ? "bg-success" :
                      idx === phaseIndex ? "bg-primary animate-pulse" :
                      "bg-border/30"
                    }`} />
                    <span className={`font-mono text-[9px] uppercase tracking-widest text-center ${
                      idx === phaseIndex ? "text-primary font-bold" : "text-muted-foreground/30"
                    }`}>{phase.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {(activeCampaign.status === "intake" || activeCampaign.status === "draft") ? (
                  <Link href={`/campaigns/${activeCampaign.id}/intake`} className="flex-1">
                    <Button className="w-full rounded-none font-mono uppercase tracking-widest text-xs h-10 btn-weapon-primary gap-2">
                      <Bot className="h-3.5 w-3.5" />
                      Continuar Briefing
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/campaigns/${activeCampaign.id}`} className="flex-1">
                    <Button className="w-full rounded-none font-mono uppercase tracking-widest text-xs h-10 btn-weapon-primary gap-2">
                      <Rocket className="h-3.5 w-3.5" />
                      Ver Minha Campanha
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-primary/30 bg-primary/5 p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/60" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/60" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/60" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/60" />
            <Bot className="h-8 w-8 text-primary/60 mx-auto mb-3" />
            <h2 className="font-mono font-black text-lg uppercase tracking-tight text-foreground mb-2">
              O time está pronto para você.
            </h2>
            <p className="font-mono text-sm text-muted-foreground/60 mb-5 leading-relaxed">
              Três minutos de conversa com o agente e você tem estratégia, copy e cronograma prontos.
            </p>
            <Link href="/onboarding">
              <Button className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 px-8 text-sm">
                <Bot className="h-4 w-4" />
                Criar minha campanha
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* KPI strip simplificado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border/30 bg-card/20 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Créditos do agente</div>
            <div className={`font-mono font-bold text-xl ${creditsLow ? "text-yellow-400" : "text-foreground"}`}>
              {creditsBalance.toLocaleString("pt-BR")}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/40">{creditsPct}% disponível</div>
            <div className="mt-2 h-0.5 bg-muted/20">
              <div className="h-full bg-primary transition-all" style={{ width: `${creditsPct}%` }} />
            </div>
          </div>
          <div className="border border-border/30 bg-card/20 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Receita</div>
            <div className="font-mono font-bold text-xl text-success">
              {revenueTotal > 0 ? `R$${(revenueTotal / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "—"}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/40">
              {revenueData?.transactionCount ? `${revenueData.transactionCount} vendas` : "Configure webhooks"}
            </div>
          </div>
        </div>

        {/* Próxima ação */}
        <div className={`border ${action.bg} p-4 flex items-center gap-4`}>
          <div className={`w-9 h-9 border border-current/20 bg-current/10 flex items-center justify-center shrink-0 ${action.color}`}>
            <ActionIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">Próxima Ação</div>
            <div className={`font-mono font-bold text-sm ${action.color}`}>{action.title}</div>
          </div>
          <Link href={action.href} className="shrink-0">
            <Button variant="outline" size="sm"
              className={`rounded-none font-mono uppercase text-[11px] tracking-widest border-current/30 hover:bg-current/10 ${action.color} gap-2 h-8`}>
              {action.cta}<ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Modo toggle hint */}
        <div className="text-center pt-2">
          <span className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest">
            Quer ver todos os painéis técnicos?{" "}
            <button
              onClick={() => {}}
              className="text-primary/50 hover:text-primary underline underline-offset-2 transition-colors"
            >
              Mude para Arquiteto na barra lateral
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
              Central de Lançamento
            </h1>
            {liveCampaigns > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 8px hsl(var(--success))" }} />
                <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">{liveCampaigns} ao vivo</span>
              </div>
            )}
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {workspace?.name ?? "Workspace"} · {plan?.name ?? "NexOS"}
            {planSlug && <span className="ml-2 px-2 py-0.5 border border-primary/20 text-primary bg-primary/10">{planSlug.toUpperCase()}</span>}
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button className="rounded-none font-mono uppercase tracking-widest font-bold gap-2 btn-weapon-primary text-xs px-4 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova Campanha</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </Link>
      </div>

      {/* ── Welcome Hero: shown when user has no campaigns yet ── */}
      {campaigns.length === 0 && (
        <div className="border border-primary/30 bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/60" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/60" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/60" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/60" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="p-6 md:p-8 relative z-10">

            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
                NexOS · 63 agentes prontos para trabalhar
              </span>
            </div>

            <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tight text-foreground mb-2 leading-tight">
              Sua próxima receita começa com uma conversa de 3 minutos.
            </h2>
            <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed mb-5 max-w-2xl">
              Conta para a agente o que você quer vender. Em menos de uma hora, você tem estratégia, copy completo, sequência de WhatsApp, emails e cronograma prontos para aprovar.{" "}
              <strong className="text-foreground">Sem copywriter. Sem agência. Sem esperar.</strong>
            </p>

            {/* Social proof + anti-requisite strip */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6">
              {[
                { value: "R$41.200", label: "lançamento de 312 leads" },
                { value: "7 dias", label: "do briefing ao carrinho aberto" },
                { value: "63 agentes", label: "trabalhando ao mesmo tempo" },
              ].map(stat => (
                <div key={stat.label} className="flex items-baseline gap-1.5">
                  <span className="font-mono font-black text-base text-primary">{stat.value}</span>
                  <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Fear of loss strip */}
            <div className="flex items-center gap-2 mb-6 border border-destructive/20 bg-destructive/5 px-3 py-2 w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 animate-pulse shrink-0" />
              <span className="font-mono text-[11px] text-destructive/70 uppercase tracking-widest">
                Cada semana sem lançar é receita que não volta — sua base esfria enquanto você planeja
              </span>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/campaigns/new">
                <Button className="rounded-none font-mono uppercase tracking-widest font-bold gap-2 btn-weapon-primary h-11 px-7 text-sm">
                  <Rocket className="h-4 w-4" />
                  Criar minha primeira campanha
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest h-11 px-5 text-xs border-border/50 hover:border-primary/50 hover:text-primary gap-2">
                  <Bot className="h-3.5 w-3.5" />
                  Conversar com os Agentes agente
                </Button>
              </Link>
            </div>

            {/* Steps mini-preview */}
            <div className="mt-6 pt-5 border-t border-border/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: "01", label: "Briefing (≈3 min)", desc: "A agente conversa com você sobre produto, público e meta. Sem formulário chato." },
                { step: "02", label: "Plano completo gerado", desc: "Estratégia, copy, cronograma de emails e WhatsApp — tudo pronto para você aprovar." },
                { step: "03", label: "Execução automática", desc: "Você aprova. A agente dispara, segmenta, abre carrinho e fecha. Você acompanha o faturamento." },
              ].map(item => (
                <div key={item.step} className="flex gap-3">
                  <span className="font-mono text-[11px] text-primary/40 tracking-widest shrink-0 mt-0.5 font-bold">{item.step}</span>
                  <div>
                    <div className="font-mono text-xs font-bold text-foreground/80 uppercase tracking-widest mb-0.5">{item.label}</div>
                    <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Mission Panel ── */}
      {activeCampaign && (
        <div className="border border-border/50 bg-card/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/60 to-transparent pointer-events-none" />
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                  Missão em Progresso
                </div>
                <h2 className="font-mono font-bold text-base sm:text-lg uppercase tracking-tight text-foreground break-words">
                  {activeCampaign.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {(activeCampaign as unknown as Record<string,string>)["type"] && (
                    <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                      {(activeCampaign as unknown as Record<string,string>)["type"]}
                    </span>
                  )}
                  {(activeCampaign as unknown as Record<string,string>)["track"] && (
                    <span className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                      · Track {(activeCampaign as unknown as Record<string,string>)["track"]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {pendingCheckpoints.length > 0 && (
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] border-yellow-400/40 text-yellow-400 bg-yellow-400/10 animate-pulse">
                    {pendingCheckpoints.length} Aprovação
                  </Badge>
                )}
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_COLOR[activeCampaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                  {STATUS_LABEL[activeCampaign.status] ?? activeCampaign.status}
                </Badge>
                {(activeCampaign.status === "intake" || activeCampaign.status === "draft") ? (
                  <Link href={`/campaigns/${activeCampaign.id}/intake`}>
                    <Button size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-primary">
                      Briefing<ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/campaigns/${activeCampaign.id}`}>
                    <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline">
                      Abrir<ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <PipelineProgress status={activeCampaign.status} />
          </div>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Créditos do agente"
          value={creditsBalance.toLocaleString("pt-BR")}
          sub={`${creditsPct}% de ${totalCredits.toLocaleString("pt-BR")} cr incluídos`}
          icon={CreditCard}
          color={creditsLow ? "yellow" : "primary"}
          href="/credits"
          loading={loadingCredits}
          breakdown={[
            { label: "Saldo atual",  value: creditsBalance.toLocaleString("pt-BR") },
            { label: "Créditos incluídos",  value: totalCredits.toLocaleString("pt-BR") },
            { label: "Utilizado",    value: `${100 - creditsPct}%` },
          ]}
          expanded={expandedKpi === "credits"}
          onToggle={() => setExpandedKpi(expandedKpi === "credits" ? null : "credits")}
        />
        <KpiCard
          label="Receita do Produto"
          value={revenueTotal > 0 ? `R$${(revenueTotal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          sub={revenueData?.transactionCount ? `${revenueData.transactionCount} vendas` : "Configure webhooks →"}
          icon={DollarSign}
          color="success"
          href="/revenue"
          loading={loadingRevenue}
          breakdown={revenueData?.byPlatform
            ? Object.entries(revenueData.byPlatform).slice(0, 3).map(([k, v]) => ({ label: k, value: `R$${(Number(v) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` }))
            : [{ label: "Sem dados", value: "—" }]
          }
          expanded={expandedKpi === "revenue"}
          onToggle={() => setExpandedKpi(expandedKpi === "revenue" ? null : "revenue")}
        />
        <KpiCard
          label="Sequências Ativas"
          value={activeSequences}
          sub={`${(sequencesData?.sequences ?? []).length} total configuradas`}
          icon={Workflow}
          color="cyan"
          href="/sequences"
          loading={loadingSequences}
          breakdown={[
            { label: "Ativas",    value: activeSequences },
            { label: "Total",     value: (sequencesData?.sequences ?? []).length },
            { label: "Inativas",  value: (sequencesData?.sequences ?? []).length - activeSequences },
          ]}
          expanded={expandedKpi === "sequences"}
          onToggle={() => setExpandedKpi(expandedKpi === "sequences" ? null : "sequences")}
        />
        <KpiCard
          label="Missões em Andamento"
          value={activeCampaigns}
          sub={liveCampaigns > 0 ? `${liveCampaigns} ao vivo agora` : "Campanhas em progresso"}
          icon={Rocket}
          color={liveCampaigns > 0 ? "success" : "primary"}
          href="/campaigns"
          loading={loadingCampaigns}
          breakdown={[
            { label: "Ao vivo",     value: liveCampaigns },
            { label: "Ativas",      value: activeCampaigns },
            { label: "Total",       value: campaigns.length },
          ]}
          expanded={expandedKpi === "campaigns"}
          onToggle={() => setExpandedKpi(expandedKpi === "campaigns" ? null : "campaigns")}
        />
      </div>

      {/* ── Integration Health / Full Auto Status ── */}
      <IntegrationHealthPanel />

      {/* ── Referral Widget ── */}
      <ReferralWidget />

      {/* ── Time de Vendas Panel ── */}
      <SalesTeamPanel />

      {/* ── Execution Flowchart ── */}
      {campaigns.length > 0 && <ExecutionFlowchart campaigns={campaigns} />}

      {/* ── Strategy Masterplan Panel — aparece quando campanha está strategy_ready ── */}
      {readyCampaign && (() => {
        const strategyD = (readyCampaignFull?.["strategyData"] ?? {}) as Record<string, unknown>;
        const ins = parseStrategyInsights(strategyD);
        const hasData = Object.keys(strategyD).length > 0;
        return (
          <div className="border border-cyan-400/30 bg-cyan-400/[0.03] overflow-hidden">
            {/* Header clicável para expandir/recolher */}
            <button
              onClick={() => setMasterplanExpanded(e => !e)}
              className="w-full px-4 py-3 border-b border-cyan-400/20 flex items-center gap-2 hover:bg-cyan-400/5 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" style={{ boxShadow: "0 0 8px hsl(180 100% 60%)" }} />
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-bold flex-1 text-left">
                ⚡ Masterplan Pronto — Aprovação Necessária
              </span>
              <span className="font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest">{readyCampaign.title}</span>
              <span className="font-mono text-[10px] text-cyan-400/40 ml-2">{masterplanExpanded ? "▲" : "▼"}</span>
            </button>

            {masterplanExpanded && (
              <>
                {!readyCampaignFull ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400/50 mx-auto mb-2" />
                    <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">Carregando masterplan...</p>
                  </div>
                ) : !hasData ? (
                  <div className="p-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground/40">Dados do plano não disponíveis.</p>
                  </div>
                ) : (
                  <div className="p-4">
                    <StrategyMasterplan strategyD={strategyD} ins={ins} />
                  </div>
                )}

                {/* Botões de ação */}
                <div className="px-4 pb-4 pt-2 border-t border-cyan-400/15 flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => approveMutation.mutate(readyCampaign.id)}
                    disabled={approveMutation.isPending || !hasData}
                    className="flex-1 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-11 text-sm"
                  >
                    {approveMutation.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando conteúdo...</>
                      : <><CheckCircle2 className="h-4 w-4" /> Aprovar e Gerar Conteúdo</>}
                  </Button>
                  <Link href={`/campaigns/${readyCampaign.id}`} className="shrink-0">
                    <Button variant="outline" className="w-full sm:w-auto rounded-none font-mono uppercase tracking-widest text-[11px] h-11 gap-1.5 btn-weapon-outline">
                      Abrir Campanha <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Identity Memory — Modo Arquiteto only ── */}
      {isArquiteto && <IdentityMemoryCard />}

      {/* ── Smart Next Action ── */}
      <div className={`border ${action.bg} p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 relative overflow-hidden group`}>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-current/[0.02] pointer-events-none" />
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 border border-current/20 bg-current/10 flex items-center justify-center shrink-0 ${action.color}`}>
            <ActionIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">
              Próxima Ação Recomendada pelo agente
            </div>
            <div className={`font-mono font-bold text-sm leading-snug ${action.color}`}>{action.title}</div>
            <div className="font-mono text-xs text-muted-foreground/60 mt-0.5 leading-snug line-clamp-2 sm:line-clamp-1">{action.sub}</div>
          </div>
        </div>
        <Link href={action.href} className="shrink-0">
          <Button variant="outline" size="sm"
            className={`rounded-none font-mono uppercase text-[11px] tracking-widest w-full sm:w-auto border-current/30 hover:bg-current/10 ${action.color} gap-2 h-8`}>
            {action.cta}<ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* ── Two Column: AI Activity + Sequences ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* AI Activity Feed */}
        <div className="border border-border/50 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Atividade dos Especialistas</span>
            </div>
            {activeCampaign && (
              <Link href={`/campaigns/${activeCampaign.id}`}>
                <span className="font-mono text-[11px] text-primary hover:underline uppercase tracking-widest">Ver Todos →</span>
              </Link>
            )}
          </div>
          <div className="divide-y divide-border/20">
            {!activeCampaign ? (
              <div className="py-8 text-center">
                <Bot className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                  Nenhuma campanha ativa
                </p>
              </div>
            ) : recentAgents.length === 0 ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2 animate-spin" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                  Aguardando execução dos agentes
                </p>
              </div>
            ) : (
              recentAgents.map(agent => (
                <div key={agent.id} className="px-4 py-3 flex items-center gap-3">
                  <span className={`text-xs font-mono shrink-0 ${
                    agent.status === "completed" ? "text-success" :
                    agent.status === "running"   ? "text-primary animate-pulse" :
                    agent.status === "failed"    ? "text-destructive" : "text-muted-foreground/40"
                  }`}>
                    {agent.status === "completed" ? "✓" : agent.status === "running" ? "▶" : agent.status === "failed" ? "✗" : "·"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-bold text-foreground/80 truncate">
                      {AGENT_ROLE_LABEL[agent.agentRole] ?? agent.agentRole}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                      {agent.completedAt
                        ? `Concluído · ${new Date(agent.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                        : `Iniciado · ${new Date(agent.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] shrink-0 ${
                    agent.status === "completed" ? "border-success/40 text-success" :
                    agent.status === "running"   ? "border-primary/40 text-primary" :
                    agent.status === "failed"    ? "border-destructive/40 text-destructive" :
                    "border-border/40 text-muted-foreground"
                  }`}>
                    {agent.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sequences Summary */}
        <div className="border border-border/50 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Sequências de Automação</span>
            </div>
            <Link href="/sequences">
              <span className="font-mono text-[11px] text-primary hover:underline uppercase tracking-widest">Ver Todas →</span>
            </Link>
          </div>
          <div className="divide-y divide-border/20">
            {loadingSequences ? (
              <div className="p-6 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}
              </div>
            ) : !(sequencesData?.sequences?.length) ? (
              <div className="py-8 text-center">
                <Workflow className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest mb-3">
                  Nenhuma sequência criada
                </p>
                <Link href="/sequences/new">
                  <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest btn-weapon-outline gap-1.5">
                    <Plus className="h-3 w-3" />Criar Sequência
                  </Button>
                </Link>
              </div>
            ) : (
              (sequencesData.sequences as unknown as Array<{
                id: string; name: string; status: string; model: string; totalDays: number;
              }>).slice(0, 5).map(seq => (
                <Link key={seq.id} href={`/sequences/${seq.id}`}>
                  <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/5 transition-colors group cursor-pointer">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      seq.status === "active" || seq.status === "live" ? "bg-success animate-pulse" :
                      seq.status === "generating" ? "bg-primary animate-pulse" :
                      "bg-muted-foreground/30"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold text-foreground/80 truncate group-hover:text-primary transition-colors">
                        {seq.name}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                        {MODEL_LABEL[seq.model] ?? seq.model} · {seq.totalDays} dias
                      </div>
                    </div>
                    <Badge variant="outline" className={`rounded-none font-mono text-[11px] shrink-0 ${
                      seq.status === "active" || seq.status === "live" ? "border-success/40 text-success" :
                      seq.status === "draft"    ? "border-border/40 text-muted-foreground" :
                      "border-primary/40 text-primary"
                    }`}>
                      {seq.status === "active" || seq.status === "live" ? "Ativa" : seq.status === "draft" ? "Rascunho" : seq.status}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Campaigns List ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-3.5 w-3.5 text-muted-foreground/60" />
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
              Todas as Missões · {campaigns.length}
            </h2>
          </div>
          <Link href="/campaigns">
            <span className="font-mono text-xs text-primary hover:underline uppercase tracking-widest">Ver todas →</span>
          </Link>
        </div>

        <div className="border border-border/50 bg-card/40 relative overflow-hidden">
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/40 to-transparent pointer-events-none" />
          {loadingCampaigns ? (
            <div className="p-8 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}
            </div>
          ) : !campaigns.length ? (
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-muted-foreground/30" />
              <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                Nenhuma missão ainda
              </p>
              <Link href="/campaigns/new">
                <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-1.5">
                  <Plus className="h-3 w-3" />Iniciar primeira missão
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {campaigns.slice(0, 7).map(c => {
                const cr = c as unknown as Record<string, string>;
                return (
                  <div key={c.id} className="px-4 py-3.5 flex items-center gap-4 group hover:bg-muted/5 transition-colors">
                    <div className={`w-1.5 h-6 shrink-0 transition-all ${
                      c.status === "live"              ? "bg-success shadow-[0_0_8px_hsl(var(--success))]" :
                      c.status === "awaiting_approval" ? "bg-yellow-400" :
                      ["analyzing","generating","executing"].includes(c.status) ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" :
                      "bg-muted/30"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold group-hover:text-primary transition-colors truncate">
                        {c.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {cr["type"] && <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">{cr["type"]}</span>}
                        {cr["track"] && <><span className="text-muted-foreground/30">·</span><span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">{cr["track"]}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest hidden sm:flex ${STATUS_COLOR[c.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                      <Link href={`/campaigns/${c.id}`}>
                        <Button variant="ghost" size="icon" className="rounded-sm h-7 w-7 hover:bg-primary/10 hover:text-primary">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
              {campaigns.length > 7 && (
                <div className="px-4 py-3">
                  <Link href="/campaigns">
                    <span className="font-mono text-xs text-primary hover:underline uppercase tracking-widest">
                      + {campaigns.length - 7} mais missões →
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly Report Card ── */}
      <WeeklyReportCard revenue={revenueData} weeklyRevenue={weeklyRevenueData} activeCampaigns={activeCampaigns} activeSequences={activeSequences} />

      {/* ── Quick Access Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Especialistas",    href: "/agents",     icon: Bot,       color: "hover:border-purple-400/40 hover:text-purple-400" },
          { label: "VSL Studio",    href: "/vsls",       icon: BarChart3, color: "hover:border-cyan-400/40 hover:text-cyan-400" },
          { label: "Afiliados",     href: "/affiliate",  icon: Star,      color: "hover:border-yellow-400/40 hover:text-yellow-400" },
          { label: "Configurações", href: "/settings",   icon: Target,    color: "hover:border-primary/40 hover:text-primary" },
        ].map(ql => {
          const Icon = ql.icon;
          return (
            <Link key={ql.label} href={ql.href}>
              <div className={`border border-border/30 bg-card/20 p-3 flex items-center gap-2.5 cursor-pointer group transition-all ${ql.color}`}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-current transition-colors shrink-0" />
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest truncate">
                  {ql.label}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-current ml-auto shrink-0 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}

// ─── Weekly Report Card ───────────────────────────────────────────────────────

function WeeklyReportCard({
  revenue, weeklyRevenue, activeCampaigns, activeSequences,
}: {
  revenue: RevenueSummary | null | undefined;
  weeklyRevenue: WeeklyRevenueSummary | null | undefined;
  activeCampaigns: number;
  activeSequences: number;
}) {
  const today    = new Date();
  const dayOfWeek = today.getDay(); // 0=sun, 1=mon
  const isMonday  = dayOfWeek === 1;
  const weekNum   = getISOWeek(today);

  // Real 7-day revenue from dedicated API query
  const weekRevenue = weeklyRevenue?.total ?? 0;
  const weekSales   = weeklyRevenue?.transactionCount ?? 0;

  // Health score: 0 campaigns = bad; +10 per active campaign, +5 per active sequence, capped at 100
  // Only signals operational health — no invented financial metrics
  const healthScore = activeCampaigns > 0
    ? Math.min(100, 50 + activeCampaigns * 10 + Math.min(activeSequences, 5) * 5)
    : 30;
  const trend      = healthScore >= 70 ? "up" : healthScore >= 50 ? "neutral" : "down";
  const trendColor = trend === "up" ? "text-success" : trend === "neutral" ? "text-yellow-400" : "text-destructive";

  const aiInsight =
    activeCampaigns === 0
      ? "Nenhuma campanha ativa esta semana. Inicie uma missão para ativar os agentes."
      : weekRevenue > 0
        ? `R$ ${(weekRevenue / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} em receita nos últimos 7 dias — ${weekSales} venda${weekSales !== 1 ? "s" : ""}. Continue executando as sequências ativas.`
        : `${activeCampaigns} campanha${activeCampaigns > 1 ? "s" : ""} ativa${activeCampaigns > 1 ? "s" : ""}. Configure webhooks de receita para monitoramento completo.`;

  return (
    <div className={`border relative overflow-hidden ${isMonday ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card/20"}`}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />

      <div className="p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {isMonday ? "📊 Relatório Semanal — " : "Semana "}Semana {weekNum} · {today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
              {isMonday && (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 text-primary border-primary/40 bg-primary/10">
                  Nova semana
                </Badge>
              )}
            </div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-tight">Performance Semanal</h3>
          </div>
          <Link href="/revenue">
            <Button variant="ghost" size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1 text-primary hover:bg-primary/10 shrink-0">
              Ver Detalhes <ChevronRight className="h-2.5 w-2.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Receita semana", value: weekRevenue > 0 ? `R$ ${(weekRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—", color: "text-success" },
            { label: "Vendas", value: weekSales > 0 ? String(weekSales) : "—", color: "text-primary" },
            { label: "Campanhas ativas", value: String(activeCampaigns), color: "text-cyan-400" },
            { label: "Sequências ativas", value: String(activeSequences), color: "text-yellow-400" },
          ].map(item => (
            <div key={item.label} className="border border-border/20 bg-background/30 px-3 py-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-1">{item.label}</div>
              <div className={`font-mono font-bold text-lg ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Health score bar */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Health Score da Semana</span>
            <span className={`font-mono text-[11px] font-bold ${trendColor}`}>{healthScore}/100</span>
          </div>
          <div className="h-1 bg-muted/20 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${trend === "up" ? "bg-success" : trend === "neutral" ? "bg-yellow-400" : "bg-destructive"}`}
              style={{ width: `${healthScore}%`, boxShadow: `0 0 6px currentColor` }}
            />
          </div>
        </div>

        {/* AI insight */}
        <div className="flex items-start gap-2 bg-muted/10 border border-border/20 px-3 py-2">
          <TrendingUp className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${trendColor}`} />
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{aiInsight}</p>
        </div>

        {isMonday && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            <Mail className="h-3 w-3" />
            Relatório enviado para o seu email esta manhã
          </div>
        )}
      </div>
    </div>
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
