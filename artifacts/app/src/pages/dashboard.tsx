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
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";
import { useMode } from "@/lib/mode";
import { IdentityMemoryCard } from "@/components/IdentityMemoryCard";
import { AvatarVoiceCloneGate } from "@/components/AvatarVoiceCloneGate";
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
  Share2, Copy, Gift, Database
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
const STATUS_LABEL_TRANSLATIONS: Record<string, [string, string]> = {
  draft: ["Draft", "Borrador"],
  intake: ["Agent briefing", "Briefing con el agente"],
  analyzing: ["Analyzing", "Analizando"],
  strategy_ready: ["Strategy Ready", "Estrategia lista"],
  generating: ["Generating Content", "Generando contenido"],
  awaiting_approval: ["Awaiting Approval", "Esperando aprobación"],
  approved: ["Approved", "Aprobado"],
  executing: ["In Progress", "En ejecución"],
  live: ["Live", "En vivo"],
  completed: ["Completed", "Completado"],
};
const AGENT_ROLE_LABEL_TRANSLATIONS: Record<string, [string, string]> = {
  command: ["Commander", "Comandante"],
  strategy: ["Strategist", "Estratega"],
  launch_manager: ["Launch Manager", "Gerente de lanzamiento"],
  offer: ["Offer Specialist", "Especialista en ofertas"],
  product_builder: ["Product Builder", "Desarrollador de producto"],
  copywriter: ["Copywriter", "Copywriter"],
  creative_director: ["Creative Director", "Director creativo"],
  creative: ["Creative Director", "Director creativo"],
  landing_page: ["Landing Page Expert", "Especialista en páginas de aterrizaje"],
  targeting: ["Targeting Expert", "Especialista en segmentación"],
  media_buyer: ["Media Buyer", "Comprador de medios"],
  affiliate_campaign: ["Affiliate Specialist", "Especialista en afiliados"],
  analytics: ["Performance Analyst", "Analista de rendimiento"],
  optimization: ["Optimizer", "Optimizador"],
  video: ["Video Strategist", "Estratega de vídeo"],
  video_strategy: ["Video Strategist", "Estratega de vídeo"],
  creator_growth: ["Creator Growth", "Crecimiento de creadores"],
  compliance: ["Compliance Officer", "Responsable de cumplimiento"],
  profile_builder: ["Profile Builder", "Creador de perfiles"],
  intake: ["Briefing", "Briefing"],
  ad_copy: ["Ad Copy", "Texto de anuncios"],
  cpl_script: ["CPL Script", "Guion CPL"],
  vsl_script: ["VSL Script", "Guion VSL"],
  webinar_script: ["Webinar Script", "Guion de webinar"],
  live_script: ["Live Script", "Guion de directo"],
  stories_sequence: ["Stories Sequence", "Secuencia de Stories"],
  media_brief: ["Media Brief", "Brief de medios"],
  financial_projector: ["Financial Projector", "Proyector financiero"],
  launch_sequence_builder: ["Sequence Builder", "Constructor de secuencias"],
  social_media: ["Social Media", "Redes sociales"],
  whatsapp_response: ["WhatsApp Auto-Reply", "Respuesta automática de WhatsApp"],
  perpetual_launch_manager: ["Evergreen Launch Manager", "Gestor de lanzamientos perpetuos"],
  continuous_sales_manager: ["Continuous Sales Manager", "Gestor de ventas continuas"],
  item_copy: ["Item Copy", "Texto de producto"],
};
const PIPELINE_STEP_TRANSLATIONS: Record<string, [string, string]> = {
  intake: ["Briefing", "Briefing"],
  strategy: ["Strategy", "Estrategia"],
  content: ["Content", "Contenido"],
  launch: ["Launch", "Lanzamiento"],
  monitor: ["Monitor", "Supervisar"],
};
const MODEL_LABEL_TRANSLATIONS: Record<string, [string, string]> = {
  plf: ["PLF", "PLF"],
  formula_de_lancamento: ["Launch Formula", "Fórmula de lanzamiento"],
  semente: ["Seed", "Semilla"],
  afiliado: ["Affiliate", "Afiliado"],
  perpetual: ["Evergreen", "Perpetuo"],
  custom: ["Custom", "Personalizado"],
};

function localizedDashboardStatus(status: string, t: ReturnType<typeof useUiText>) {
  const label = STATUS_LABEL[status];
  if (!label) return status;
  const translations = STATUS_LABEL_TRANSLATIONS[status];
  return translations ? t(label, translations[0], translations[1]) : label;
}

function localizedAgentRole(role: string, t: ReturnType<typeof useUiText>) {
  const label = AGENT_ROLE_LABEL[role];
  if (!label) return role;
  const translations = AGENT_ROLE_LABEL_TRANSLATIONS[role];
  return translations ? t(label, translations[0], translations[1]) : label;
}

function localizedModelLabel(model: string, t: ReturnType<typeof useUiText>) {
  const label = MODEL_LABEL[model];
  if (!label) return model;
  const translations = MODEL_LABEL_TRANSLATIONS[model];
  return translations ? t(label, translations[0], translations[1]) : label;
}

function localizedPipelineStep(stepId: string, label: string, t: ReturnType<typeof useUiText>) {
  const translations = PIPELINE_STEP_TRANSLATIONS[stepId];
  return translations ? t(label, translations[0], translations[1]) : label;
}

function localizedAgentStatus(status: string, t: ReturnType<typeof useUiText>) {
  const translations: Record<string, [string, string, string]> = {
    completed: ["Concluído", "Completed", "Completado"],
    running: ["Em execução", "Running", "En ejecución"],
    failed: ["Falhou", "Failed", "Fallido"],
  };
  const label = translations[status];
  return label ? t(label[0], label[1], label[2]) : status;
}

function localizedSequenceStatus(status: string, t: ReturnType<typeof useUiText>) {
  const translations: Record<string, [string, string, string]> = {
    active: ["Ativa", "Active", "Activa"],
    live: ["Ativa", "Active", "Activa"],
    draft: ["Rascunho", "Draft", "Borrador"],
    generating: ["Gerando", "Generating", "Generando"],
  };
  const label = translations[status];
  return label ? t(label[0], label[1], label[2]) : status;
}

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
  const t = useUiText();
  const nodes = [
    { id: "intake",    label: t("Briefing", "Briefing", "Briefing"), statuses: ["draft", "intake"],         icon: FileText,  color: "text-blue-400  border-blue-400/40  bg-blue-400/10",  href: null },
    { id: "strategy",  label: t("Estratégia", "Strategy", "Estrategia"), statuses: ["analyzing","strategy_ready"], icon: Target,    color: "text-cyan-400  border-cyan-400/40  bg-cyan-400/10",  href: null },
    { id: "content",   label: t("Conteúdo", "Content", "Contenido"), statuses: ["generating","awaiting_approval","approved"], icon: Layers,    color: "text-purple-400 border-purple-400/40 bg-purple-400/10", href: null },
    { id: "launch",    label: t("Lançamento", "Launch", "Lanzamiento"), statuses: ["executing","live"],         icon: Rocket,    color: "text-success    border-success/40    bg-success/10",    href: null },
    { id: "monitor",   label: t("Resultados", "Results", "Resultados"), statuses: ["completed"],                icon: BarChart2, color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", href: "/revenue" },
  ];

  const statusCounts = nodes.map(node => ({
    ...node,
    count: campaigns.filter(c => node.statuses.includes(c.status)).length,
    campaign: campaigns.find(c => node.statuses.includes(c.status)),
  }));

  return (
    <div className="border border-border/50 bg-card/30 p-4 overflow-x-auto">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-4">
        {t("Fluxo de Execução · Visão Geral", "Execution Flow · Overview", "Flujo de Ejecución · Resumen")}
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
  const t = useUiText();
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
              }`}>{localizedPipelineStep(step.id, step.label, t)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground/50">{t(`${pct}% concluído`, `${pct}% complete`, `${pct}% completado`)}</span>
        <span className={`font-mono text-[11px] uppercase tracking-widest ${STATUS_COLOR[status]?.split(" ")[0] ?? "text-primary"}`}>
          {localizedDashboardStatus(status, t)}
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
  const t = useUiText();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/referrals/stats"],
    queryFn: async () => {
      return customFetch<ReferralStats>("/api/referrals/stats").catch(() => null);
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
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Indicações", "Referrals", "Referencias")}</p>
          <p className="font-mono text-base font-bold text-foreground leading-tight">
            {data.referralCode}
          </p>
        </div>
      </div>

      <div className="w-px h-8 bg-border/40 shrink-0 hidden sm:block" />

      {/* Stats */}
      <div className="flex items-center gap-6 flex-1 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Indicados", "Referrals", "Referidos")}</p>
          <p className="font-mono text-lg font-bold text-primary">{data.referralCount}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Créditos ganhos", "Credits earned", "Créditos ganados")}</p>
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
  const t = useUiText();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-team/analytics"],
    queryFn: async () => {
      return customFetch<{ analytics: { active: number; converted: number; todayConversions: number; conversionRate: number } }>("/api/sales-team/analytics").catch(() => null);
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
        <span className="font-mono text-[11px] uppercase tracking-widest font-bold">{t("Time de Vendas", "Sales Team", "Equipo de Ventas")}</span>
      </div>
      <div className="w-px h-4 bg-border/40 shrink-0" />
      <div className="flex items-center gap-4 flex-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground/60">{t("Ativos:", "Active:", "Activos:")}</span>
          <span className={`font-mono text-[11px] font-bold ${analytics.active > 0 ? "text-primary" : "text-muted-foreground/40"}`}>{analytics.active}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground/60">{t("Convertidos hoje:", "Converted today:", "Convertidos hoy:")}</span>
          <span className={`font-mono text-[11px] font-bold ${analytics.todayConversions > 0 ? "text-green-400" : "text-muted-foreground/40"}`}>{analytics.todayConversions}</span>
        </div>
        {hasActivity && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground/60">{t("Taxa:", "Rate:", "Tasa:")}</span>
            <span className="font-mono text-[11px] font-bold text-amber-400">{analytics.conversionRate}%</span>
          </div>
        )}
      </div>
      <Link href="/atendimento" className="shrink-0">
        <Button size="sm" variant="outline"
          className="rounded-none font-mono text-[10px] uppercase tracking-widest h-6 px-2 border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 gap-1">
          <ChevronRight className="h-3 w-3" />
          {hasActivity ? t("Ver Atendimentos", "View Conversations", "Ver Conversaciones") : t("Iniciar Atendimento", "Start Conversation", "Iniciar Conversación")}
        </Button>
      </Link>
    </div>
  );
}

function IntakeHubStatus() {
  const t = useUiText();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const prods = await customFetch<{ products: any[] }>("/api/products").catch(() => ({ products: [] }));
      if (prods.products.length === 0) return null;
      // Fetch intake for the first product just for quick readiness peek
      const first = prods.products[0];
      const intake = await customFetch<any>(`/api/product-intake/${first.id}`).catch(() => null);
      return { product: first, intake };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data?.product) return null;

  const currentStatus = data.intake?.current?.status;
  const draftStatus = data.intake?.draft?.status;

  const isApproved = currentStatus === "approved";
  const isLocked = currentStatus === "locked";
  const hasDraft = draftStatus === "draft";

  const renderBadge = () => {
    if (isApproved) return <Badge variant="outline" className="border-success/40 text-success text-[9px] px-1 py-0 h-4">{t("Aprovado", "Approved", "Aprobado")}</Badge>;
    if (isLocked) return <Badge variant="outline" className="border-primary/40 text-primary text-[9px] px-1 py-0 h-4">{t("Bloqueado", "Blocked", "Bloqueado")}</Badge>;
    if (hasDraft) return <Badge variant="outline" className="border-amber-400/40 text-amber-400 text-[9px] px-1 py-0 h-4">{t("Rascunho", "Draft", "Borrador")}</Badge>;
    return <span className="font-mono text-[9px] text-muted-foreground">{t("Pendente", "Pending", "Pendiente")}</span>;
  };

  const statusColor = isApproved ? "text-success" : isLocked ? "text-primary" : hasDraft ? "text-amber-400" : "text-muted-foreground";
  const bgColor = isApproved ? "border-success/30 bg-success/5" : isLocked ? "border-primary/30 bg-primary/5" : hasDraft ? "border-amber-400/20 bg-amber-400/5" : "border-border/40 bg-card/30";

  return (
    <div className={`border flex items-center gap-3 px-4 py-3 transition-colors ${bgColor}`}>
      <div className={`flex items-center gap-1.5 shrink-0 ${statusColor}`}>
        <Database className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
          Briefing Central
        </span>
      </div>

      <div className="w-px h-4 bg-border/40 shrink-0" />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-mono text-[10px] truncate text-foreground">{data.product.name}</span>
        {renderBadge()}
      </div>

      <Link href="/intake" className="shrink-0">
        <Button size="sm" variant="outline"
          className="rounded-none font-mono text-[10px] uppercase tracking-widest h-6 px-2 border-primary/30 text-primary hover:bg-primary/10 gap-1">
          <ChevronRight className="h-2.5 w-2.5" /> Acessar
        </Button>
      </Link>
    </div>
  );
}

function IntegrationHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      return customFetch<{ integrations: IntegrationStatus[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as IntegrationStatus[] }));
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

function nextAction(campaigns: { id: string; title: string; status: string }[], t: ReturnType<typeof useUiText>) {
  if (!campaigns.length) {
    return {
      icon: Rocket, color: "text-primary", bg: "border-primary/20 bg-primary/5",
      title: t("Inicie sua primeira missão de lançamento", "Start your first launch mission", "Inicia tu primera misión de lanzamiento"),
      sub: t("O agente monta toda a estratégia, cria o conteúdo e executa automaticamente", "The agent builds the strategy, creates the content, and executes automatically", "El agente prepara la estrategia, crea el contenido y ejecuta automáticamente"),
      href: "/campaigns/new", cta: t("Criar Campanha", "Create Campaign", "Crear campaña"),
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
    title: `${t("Campanha ao vivo", "Campaign live", "Campaña en vivo")}: "${live.title}"`,
    sub: t("Acompanhe métricas em tempo real e aplique ajustes do agente", "Track real-time metrics and apply the agent's recommendations", "Sigue las métricas en tiempo real y aplica los ajustes del agente"),
    href: `/campaigns/${live.id}`, cta: t("Ver Métricas", "View Metrics", "Ver métricas"),
  };
  if (approval) return {
    icon: CheckCircle2, color: "text-yellow-400", bg: "border-yellow-400/20 bg-yellow-400/5",
    title: `${t("Conteúdo aguarda sua aprovação", "Content awaiting your approval", "Contenido pendiente de tu aprobación")}: "${approval.title}"`,
    sub: t("A agente gerou o conteúdo completo. Revise e aprove para lançar.", "The agent generated the complete content. Review and approve it to launch.", "El agente generó todo el contenido. Revísalo y apruébalo para lanzar."),
    href: `/campaigns/${approval.id}`, cta: t("Revisar Agora", "Review Now", "Revisar ahora"),
  };
  if (approved) return {
    icon: Zap, color: "text-green-400", bg: "border-green-400/20 bg-green-400/5",
    title: `${t("Pronto para lançar", "Ready to launch", "Listo para lanzar")}: "${approved.title}"`,
    sub: t("Conteúdo aprovado. Execute o lançamento agora.", "Content approved. Start the launch now.", "Contenido aprobado. Inicia el lanzamiento ahora."),
    href: `/campaigns/${approved.id}`, cta: t("Lançar", "Launch", "Lanzar"),
  };
  if (executing || generating || analyzing) {
    const c = executing ?? generating ?? analyzing!;
    return {
      icon: Bot, color: "text-primary", bg: "border-primary/20 bg-primary/5",
      title: `${t("Em execução", "In progress", "En curso")}: "${c.title}"`,
      sub: t("Os agentes estão trabalhando. Acompanhe na aba Agentes.", "Agents are working. Follow their progress in the Agents tab.", "Los agentes están trabajando. Sigue su progreso en la pestaña Agentes."),
      href: `/campaigns/${c.id}`, cta: t("Ver Agentes", "View Agents", "Ver agentes"),
    };
  }
  if (ready) return {
    icon: Target, color: "text-cyan-400", bg: "border-cyan-400/20 bg-cyan-400/5",
    title: `${t("Estratégia pronta para", "Strategy ready for", "Estrategia lista para")} "${ready.title}"`,
    sub: t("Estratégia criada. Inicie a geração de conteúdo com o agente.", "Strategy created. Start content generation with the agent.", "Estrategia creada. Inicia la generación de contenido con el agente."),
    href: `/campaigns/${ready.id}`, cta: t("Gerar Conteúdo", "Generate Content", "Generar contenido"),
  };
  if (intake) return {
    icon: Bot, color: "text-blue-400", bg: "border-blue-400/20 bg-blue-400/5",
    title: `${t("Continue o briefing", "Continue the briefing", "Continúa el briefing")}: "${intake.title}"`,
    sub: t("A agente está aguardando suas respostas para montar a estratégia de lançamento.", "The agent is waiting for your answers to build the launch strategy.", "El agente espera tus respuestas para preparar la estrategia de lanzamiento."),
    href: `/campaigns/${intake.id}/intake`, cta: t("Continuar Briefing", "Continue Briefing", "Continuar briefing"),
  };
  return {
    icon: Workflow, color: "text-cyan-400", bg: "border-cyan-400/20 bg-cyan-400/5",
    title: t("Configure sequências de automação para seu lançamento", "Set up automated sequences for your launch", "Configura secuencias automatizadas para tu lanzamiento"),
    sub: t("Email + WhatsApp automatizados para nutrir e converter sua lista", "Automated email + WhatsApp to nurture and convert your list", "Correo y WhatsApp automatizados para nutrir y convertir tu lista"),
    href: "/sequences", cta: t("Ver Sequências", "View Sequences", "Ver secuencias"),
  };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
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
      return customFetch<RevenueSummary>("/api/revenue/summary").catch(() => null);
    },
  });

  const { data: weeklyRevenueData } = useQuery({
    queryKey: ["/api/revenue/summary", "7d"],
    queryFn: async () => {
      return customFetch<WeeklyRevenueSummary>("/api/revenue/summary?days=7").catch(() => null);
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
      return customFetch<{ campaign: Record<string, unknown> }>(`/api/campaigns/${readyCampaign!.id}`)
        .then(d => d.campaign)
        .catch(() => null);
    },
  });

  const queryClient = useQueryClient();
  const approveMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return customFetch<unknown>(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "content" }),
      });
    },
    onSuccess: () => {
      toast.success(t("Estratégia aprovada! Gerando conteúdo...", "Strategy approved! Generating content...", "¡Estrategia aprobada! Generando contenido..."));
      void queryClient.invalidateQueries({ queryKey: [getListCampaignsQueryKey()] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [masterplanExpanded, setMasterplanExpanded] = useState(true);

  const { data: agentsData } = useQuery({
    queryKey: [`/api/campaigns/${activeCampaign?.id}/agents`],
    enabled: !!activeCampaign?.id,
    queryFn: async () => {
      return customFetch<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>(`/api/campaigns/${activeCampaign!.id}/agents`)
        .catch(() => ({ agents: [] as AgentRun[], checkpoints: [] as Checkpoint[] }));
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
  const action          = nextAction(campaigns, t);
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
      { id: "intake",    label: t("Briefing", "Briefing", "Briefing"),    desc: t("Agente conversa com você", "Agent talks with you", "El agente conversa contigo"), icon: "01" },
      { id: "strategy",  label: t("Estratégia", "Strategy", "Estrategia"),  desc: t("Plano gerado", "Plan generated", "Plan generado"),         icon: "02" },
      { id: "content",   label: t("Conteúdo", "Content", "Contenido"),    desc: t("Copy pronto", "Copy ready", "Textos listos"),          icon: "03" },
      { id: "executing", label: t("Execução", "Execution", "Ejecución"), desc: t("Disparo automático", "Automated send", "Envío automático"),   icon: "04" },
      { id: "live",      label: t("Ao Vivo", "Live", "En vivo"),     desc: t("Carrinho aberto", "Cart open", "Carrito abierto"),      icon: "05" },
    ];
    const phaseIndex = activeCampaign
      ? Math.max(0, MISSION_PHASES.findIndex(p => activeCampaign.status.includes(p.id)))
      : -1;

    return (
      <div className="max-w-2xl mx-auto space-y-5 py-2">
        <AvatarVoiceCloneGate />

        {/* Greeting */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">
              {liveCampaigns > 0 ? t(`${liveCampaigns} campanha ao vivo`, `${liveCampaigns} live campaign${liveCampaigns !== 1 ? "s" : ""}`, `${liveCampaigns} campaña${liveCampaigns !== 1 ? "s" : ""} en vivo`) : t("Plataforma pronta", "Platform ready", "Plataforma lista")}
            </span>
          </div>
          <h1 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground mb-1">
            {t("Olá", "Hello", "Hola")}, <span className="text-primary">{firstName}</span>.
          </h1>
          <p className="font-mono text-sm text-muted-foreground/60">
            {activeCampaign
              ? t("Aqui está onde sua missão está agora.", "Here's where your mission stands.", "Así va tu misión.")
              : t("O time está esperando seu briefing.", "The team is waiting for your briefing.", "El equipo espera tu briefing.")}
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
                {t("Missão em Andamento", "Mission in Progress", "Misión en curso")}
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
                      {t("Continuar Briefing", "Continue Briefing", "Continuar briefing")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/campaigns/${activeCampaign.id}`} className="flex-1">
                    <Button className="w-full rounded-none font-mono uppercase tracking-widest text-xs h-10 btn-weapon-primary gap-2">
                      <Rocket className="h-3.5 w-3.5" />
                      {t("Ver Minha Campanha", "View My Campaign", "Ver mi campaña")}
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
              {t("O time está pronto para você.", "The team is ready for you.", "El equipo está listo para ti.")}
            </h2>
            <p className="font-mono text-sm text-muted-foreground/60 mb-5 leading-relaxed">
              {t("Três minutos de conversa com o agente e você tem estratégia, copy e cronograma prontos.", "A three-minute conversation with the agent gets you a ready-to-use strategy, copy, and timeline.", "Una conversación de tres minutos con el agente te da una estrategia, textos y cronograma listos.")}
            </p>
            <Link href="/onboarding">
              <Button className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 px-8 text-sm">
                <Bot className="h-4 w-4" />
                {t("Criar minha campanha", "Create my campaign", "Crear mi campaña")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* KPI strip simplificado */}
        {(() => {
          const maxCampaigns = planSlug === "agency" ? 10 : 3;
          const usedCampaigns = campaigns.length;
          const remaining = Math.max(0, maxCampaigns - usedCampaigns);
          const capacityPct = Math.round((usedCampaigns / maxCampaigns) * 100);
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border/30 bg-card/20 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Lançamentos disponíveis", "Available launches", "Lanzamientos disponibles")}</div>
                <div className={`font-mono font-bold text-xl ${remaining === 0 ? "text-yellow-400" : "text-foreground"}`}>
                  {remaining}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/40">{t(`${usedCampaigns} de ${maxCampaigns} usados`, `${usedCampaigns} of ${maxCampaigns} used`, `${usedCampaigns} de ${maxCampaigns} usados`)}</div>
                <div className="mt-2 h-0.5 bg-muted/20">
                  <div className="h-full bg-primary transition-all" style={{ width: `${capacityPct}%` }} />
                </div>
              </div>
              <div className="border border-border/30 bg-card/20 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Receita", "Revenue", "Ingresos")}</div>
                <div className="font-mono font-bold text-xl text-success">
                  {revenueTotal > 0 ? `R$${(revenueTotal / 100).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 })}` : "—"}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/40">
                  {revenueData?.transactionCount ? t(`${revenueData.transactionCount} vendas`, `${revenueData.transactionCount} sales`, `${revenueData.transactionCount} ventas`) : t("Configure webhooks", "Configure webhooks", "Configura los webhooks")}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Próxima ação */}
        <div className={`border ${action.bg} p-4 flex items-center gap-4`}>
          <div className={`w-9 h-9 border border-current/20 bg-current/10 flex items-center justify-center shrink-0 ${action.color}`}>
            <ActionIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">{t("Próxima Ação", "Next Action", "Próxima Acción")}</div>
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
            {t("Quer ver todos os painéis técnicos?", "Want to see all technical dashboards?", "¿Quieres ver todos los paneles técnicos?")}{" "}
            <button
              onClick={() => {}}
              className="text-primary/50 hover:text-primary underline underline-offset-2 transition-colors"
            >
              {t("Mude para Arquiteto na barra lateral", "Switch to Architect in the sidebar", "Cambia a Arquitecto en la barra lateral")}
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <AvatarVoiceCloneGate />

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
              {t("Central de Lançamento", "Launch Center", "Centro de lanzamientos")}
            </h1>
            {liveCampaigns > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 8px hsl(var(--success))" }} />
                <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">{t(`${liveCampaigns} ao vivo`, `${liveCampaigns} live`, `${liveCampaigns} en vivo`)}</span>
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
            <span className="hidden sm:inline">{t("Nova Campanha", "New Campaign", "Nueva campaña")}</span>
            <span className="sm:hidden">{t("Nova", "New", "Nueva")}</span>
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
                {t("NexOS · 64 agentes prontos para trabalhar", "NexOS · 64 agents ready to work", "NexOS · 64 agentes listos para trabajar")}
              </span>
            </div>

            <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tight text-foreground mb-2 leading-tight">
              {t("Sua próxima receita começa com uma conversa de 3 minutos.", "Your next revenue stream starts with a 3-minute conversation.", "Tus próximos ingresos comienzan con una conversación de 3 minutos.")}
            </h2>
            <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed mb-5 max-w-2xl">
              {t("Conta para a agente o que você quer vender. Em menos de uma hora, você tem estratégia, copy completo, sequência de WhatsApp, emails e cronograma prontos para aprovar.", "Tell the agent what you want to sell. In less than an hour, you'll have a complete strategy, copy, WhatsApp sequence, emails, and timeline ready for approval.", "Cuéntale al agente qué quieres vender. En menos de una hora tendrás una estrategia completa, textos, secuencia de WhatsApp, correos y cronograma listos para aprobar.")}{" "}
              <strong className="text-foreground">{t("Sem copywriter. Sem agência. Sem esperar.", "No copywriter. No agency. No waiting.", "Sin copywriter. Sin agencia. Sin esperas.")}</strong>
            </p>

            {/* Social proof + anti-requisite strip */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6">
              {[
                { value: "R$41.200", label: t("lançamento de 312 leads", "launch with 312 leads", "lanzamiento con 312 prospectos") },
                { value: t("7 dias", "7 days", "7 días"), label: t("do briefing ao carrinho aberto", "from briefing to cart opening", "del briefing a la apertura del carrito") },
                { value: t("64 agentes", "64 agents", "64 agentes"), label: t("trabalhando ao mesmo tempo", "working at the same time", "trabajando al mismo tiempo") },
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
                {t("Cada semana sem lançar é receita que não volta — sua base esfria enquanto você planeja", "Every week without launching is revenue lost — your audience cools while you plan", "Cada semana sin lanzar es dinero que no vuelve — tu audiencia pierde interés mientras planeas")}
              </span>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/campaigns/new">
                <Button className="rounded-none font-mono uppercase tracking-widest font-bold gap-2 btn-weapon-primary h-11 px-7 text-sm">
                  <Rocket className="h-4 w-4" />
                  {t("Criar minha primeira campanha", "Create my first campaign", "Crear mi primera campaña")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest h-11 px-5 text-xs border-border/50 hover:border-primary/50 hover:text-primary gap-2">
                  <Bot className="h-3.5 w-3.5" />
                  {t("Conversar com os Agentes agente", "Talk to the Agents", "Hablar con los agentes")}
                </Button>
              </Link>
            </div>

            {/* Steps mini-preview */}
            <div className="mt-6 pt-5 border-t border-border/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: "01", label: t("Briefing (≈3 min)", "Briefing (≈3 min)", "Briefing (≈3 min)"), desc: t("A agente conversa com você sobre produto, público e meta. Sem formulário chato.", "The agent talks with you about your product, audience, and goal. No tedious forms.", "El agente conversa contigo sobre tu producto, público y objetivo. Sin formularios tediosos.") },
                { step: "02", label: t("Plano completo gerado", "Complete plan generated", "Plan completo generado"), desc: t("Estratégia, copy, cronograma de emails e WhatsApp — tudo pronto para você aprovar.", "Strategy, copy, and email and WhatsApp schedules — all ready for your approval.", "Estrategia, textos y cronogramas de correo y WhatsApp — todo listo para que lo apruebes.") },
                { step: "03", label: t("Execução automática", "Automatic execution", "Ejecución automática"), desc: t("Você aprova. A agente dispara, segmenta, abre carrinho e fecha. Você acompanha o faturamento.", "You approve. The agent sends, segments, opens and closes the cart. You track revenue.", "Apruebas. El agente envía, segmenta y abre y cierra el carrito. Tú sigues los ingresos.") },
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
                  {t("Missão em Progresso", "Mission in Progress", "Misión en curso")}
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
                      · {t("Trilha", "Track", "Nivel")} {(activeCampaign as unknown as Record<string,string>)["track"]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {pendingCheckpoints.length > 0 && (
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] border-yellow-400/40 text-yellow-400 bg-yellow-400/10 animate-pulse">
                    {t(`${pendingCheckpoints.length} Aprovação`, `${pendingCheckpoints.length} Approval`, `${pendingCheckpoints.length} aprobación`)}
                  </Badge>
                )}
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_COLOR[activeCampaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                  {localizedDashboardStatus(activeCampaign.status, t)}
                </Badge>
                {(activeCampaign.status === "intake" || activeCampaign.status === "draft") ? (
                  <Link href={`/campaigns/${activeCampaign.id}/intake`}>
                    <Button size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-primary">
                      {t("Briefing", "Briefing", "Briefing")}<ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/campaigns/${activeCampaign.id}`}>
                    <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline">
                      {t("Abrir", "Open", "Abrir")}<ChevronRight className="h-2.5 w-2.5" />
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
          label={t("Créditos do agente", "Agent Credits", "Créditos del agente")}
          value={creditsBalance.toLocaleString(numberLocale)}
          sub={t(`${creditsPct}% de ${totalCredits.toLocaleString(numberLocale)} cr incluídos`, `${creditsPct}% of ${totalCredits.toLocaleString(numberLocale)} credits included`, `${creditsPct}% de ${totalCredits.toLocaleString(numberLocale)} créditos incluidos`)}
          icon={CreditCard}
          color={creditsLow ? "yellow" : "primary"}
          href="/credits"
          loading={loadingCredits}
          breakdown={[
            { label: t("Saldo atual", "Current balance", "Saldo actual"),  value: creditsBalance.toLocaleString(numberLocale) },
            { label: t("Créditos incluídos", "Credits included", "Créditos incluidos"),  value: totalCredits.toLocaleString(numberLocale) },
            { label: t("Utilizado", "Used", "Utilizado"),    value: `${100 - creditsPct}%` },
          ]}
          expanded={expandedKpi === "credits"}
          onToggle={() => setExpandedKpi(expandedKpi === "credits" ? null : "credits")}
        />
        <KpiCard
          label={t("Receita do Produto", "Product Revenue", "Ingresos del producto")}
          value={revenueTotal > 0 ? `R$${(revenueTotal / 100).toLocaleString(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          sub={revenueData?.transactionCount ? t(`${revenueData.transactionCount} vendas`, `${revenueData.transactionCount} sales`, `${revenueData.transactionCount} ventas`) : t("Configure webhooks →", "Configure webhooks →", "Configura los webhooks →")}
          icon={DollarSign}
          color="success"
          href="/revenue"
          loading={loadingRevenue}
          breakdown={revenueData?.byPlatform
            ? Object.entries(revenueData.byPlatform).slice(0, 3).map(([k, v]) => ({ label: k, value: `R$${(Number(v) / 100).toLocaleString(numberLocale, { maximumFractionDigits: 0 })}` }))
            : [{ label: t("Sem dados", "No data", "Sin datos"), value: "—" }]
          }
          expanded={expandedKpi === "revenue"}
          onToggle={() => setExpandedKpi(expandedKpi === "revenue" ? null : "revenue")}
        />
        <KpiCard
          label={t("Sequências Ativas", "Active Sequences", "Secuencias activas")}
          value={activeSequences}
          sub={t(`${(sequencesData?.sequences ?? []).length} total configuradas`, `${(sequencesData?.sequences ?? []).length} configured in total`, `${(sequencesData?.sequences ?? []).length} configuradas en total`)}
          icon={Workflow}
          color="cyan"
          href="/sequences"
          loading={loadingSequences}
          breakdown={[
            { label: t("Ativas", "Active", "Activas"),    value: activeSequences },
            { label: t("Total", "Total", "Total"),     value: (sequencesData?.sequences ?? []).length },
            { label: t("Inativas", "Inactive", "Inactivas"),  value: (sequencesData?.sequences ?? []).length - activeSequences },
          ]}
          expanded={expandedKpi === "sequences"}
          onToggle={() => setExpandedKpi(expandedKpi === "sequences" ? null : "sequences")}
        />
        <KpiCard
          label={t("Missões em Andamento", "Missions in Progress", "Misiones en curso")}
          value={activeCampaigns}
          sub={liveCampaigns > 0 ? t(`${liveCampaigns} ao vivo agora`, `${liveCampaigns} live now`, `${liveCampaigns} en vivo ahora`) : t("Campanhas em progresso", "Campaigns in progress", "Campañas en curso")}
          icon={Rocket}
          color={liveCampaigns > 0 ? "success" : "primary"}
          href="/campaigns"
          loading={loadingCampaigns}
          breakdown={[
            { label: t("Ao vivo", "Live", "En vivo"),     value: liveCampaigns },
            { label: t("Ativas", "Active", "Activas"),      value: activeCampaigns },
            { label: t("Total", "Total", "Total"),       value: campaigns.length },
          ]}
          expanded={expandedKpi === "campaigns"}
          onToggle={() => setExpandedKpi(expandedKpi === "campaigns" ? null : "campaigns")}
        />
      </div>

      {/* ── Briefing Central Status ── */}
      <IntakeHubStatus />

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
                ⚡ {t("Masterplan Pronto — Aprovação Necessária", "Masterplan Ready — Approval Required", "Masterplan listo — requiere aprobación")}
              </span>
              <span className="font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest">{readyCampaign.title}</span>
              <span className="font-mono text-[10px] text-cyan-400/40 ml-2">{masterplanExpanded ? "▲" : "▼"}</span>
            </button>

            {masterplanExpanded && (
              <>
                {!readyCampaignFull ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400/50 mx-auto mb-2" />
                    <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">{t("Carregando masterplan...", "Loading masterplan...", "Cargando masterplan...")}</p>
                  </div>
                ) : !hasData ? (
                  <div className="p-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground/40">{t("Dados do plano não disponíveis.", "Plan data unavailable.", "Datos del plan no disponibles.")}</p>
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
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Gerando conteúdo...", "Generating content...", "Generando contenido...")}</>
                      : <><CheckCircle2 className="h-4 w-4" /> {t("Aprovar e Gerar Conteúdo", "Approve and Generate Content", "Aprobar y Generar Contenido")}</>}
                  </Button>
                  <Link href={`/campaigns/${readyCampaign.id}`} className="shrink-0">
                    <Button variant="outline" className="w-full sm:w-auto rounded-none font-mono uppercase tracking-widest text-[11px] h-11 gap-1.5 btn-weapon-outline">
                      {t("Abrir Campanha", "Open Campaign", "Abrir campaña")} <ChevronRight className="h-3 w-3" />
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
              {t("Próxima Ação Recomendada pelo agente", "Next Action Recommended by the Agent", "Próxima Acción Recomendada por el agente")}
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
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Atividade dos Especialistas", "Specialist Activity", "Actividad de especialistas")}</span>
            </div>
            {activeCampaign && (
              <Link href={`/campaigns/${activeCampaign.id}`}>
                <span className="font-mono text-[11px] text-primary hover:underline uppercase tracking-widest">{t("Ver Todos →", "View All →", "Ver todos →")}</span>
              </Link>
            )}
          </div>
          <div className="divide-y divide-border/20">
            {!activeCampaign ? (
              <div className="py-8 text-center">
                <Bot className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                  {t("Nenhuma campanha ativa", "No active campaigns", "No hay campañas activas")}
                </p>
              </div>
            ) : recentAgents.length === 0 ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2 animate-spin" />
                <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
                  {t("Aguardando execução dos agentes", "Waiting for agents to run", "Esperando la ejecución de los agentes")}
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
                      {localizedAgentRole(agent.agentRole, t)}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                      {agent.completedAt
                        ? `${t("Concluído", "Completed", "Completado")} · ${new Date(agent.completedAt).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })}`
                        : `${t("Iniciado", "Started", "Iniciado")} · ${new Date(agent.startedAt).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] shrink-0 ${
                    agent.status === "completed" ? "border-success/40 text-success" :
                    agent.status === "running"   ? "border-primary/40 text-primary" :
                    agent.status === "failed"    ? "border-destructive/40 text-destructive" :
                    "border-border/40 text-muted-foreground"
                  }`}>
                    {localizedAgentStatus(agent.status, t)}
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
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Sequências de Automação", "Automation Sequences", "Secuencias de Automatización")}</span>
            </div>
            <Link href="/sequences">
              <span className="font-mono text-[11px] text-primary hover:underline uppercase tracking-widest">{t("Ver Todas →", "View All →", "Ver todas →")}</span>
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
                  {t("Nenhuma sequência criada", "No sequences created", "No hay secuencias creadas")}
                </p>
                <Link href="/sequences/new">
                  <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest btn-weapon-outline gap-1.5">
                    <Plus className="h-3 w-3" />{t("Criar Sequência", "Create Sequence", "Crear secuencia")}
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
                         {localizedModelLabel(seq.model, t)} · {seq.totalDays} {t("dias", "days", "días")}
                      </div>
                    </div>
                    <Badge variant="outline" className={`rounded-none font-mono text-[11px] shrink-0 ${
                      seq.status === "active" || seq.status === "live" ? "border-success/40 text-success" :
                      seq.status === "draft"    ? "border-border/40 text-muted-foreground" :
                      "border-primary/40 text-primary"
                    }`}>
                      {localizedSequenceStatus(seq.status, t)}
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
              {t("Todas as Missões", "All Missions", "Todas las misiones")} · {campaigns.length}
            </h2>
          </div>
          <Link href="/campaigns">
             <span className="font-mono text-xs text-primary hover:underline uppercase tracking-widest">{t("Ver todas →", "View all →", "Ver todas →")}</span>
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
                 {t("Nenhuma missão ainda", "No missions yet", "Aún no hay misiones")}
              </p>
              <Link href="/campaigns/new">
                <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-1.5">
                   <Plus className="h-3 w-3" />{t("Iniciar primeira missão", "Start first mission", "Iniciar primera misión")}
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
                         {localizedDashboardStatus(c.status, t)}
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
          { label: t("Especialistas", "Specialists", "Especialistas"), href: "/agents",     icon: Bot,       color: "hover:border-purple-400/40 hover:text-purple-400" },
          { label: t("VSL Studio", "VSL Studio", "Estudio VSL"), href: "/vsls",       icon: BarChart3, color: "hover:border-cyan-400/40 hover:text-cyan-400" },
          { label: t("Afiliados", "Affiliates", "Afiliados"), href: "/affiliate",  icon: Star,      color: "hover:border-yellow-400/40 hover:text-yellow-400" },
          { label: t("Configurações", "Settings", "Configuración"), href: "/settings",   icon: Target,    color: "hover:border-primary/40 hover:text-primary" },
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
  const t = useUiText();
  const { locale } = useUiLocale();
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
      ? t("Nenhuma campanha ativa esta semana. Inicie uma missão para ativar os agentes.", "No active campaigns this week. Start a mission to activate the agents.", "No hay campañas activas esta semana. Inicia una misión para activar a los agentes.")
      : weekRevenue > 0
        ? t(
            `R$ ${(weekRevenue / 100).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 })} em receita nos últimos 7 dias — ${weekSales} venda${weekSales !== 1 ? "s" : ""}. Continue executando as sequências ativas.`,
            `R$ ${(weekRevenue / 100).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 })} in revenue over the last 7 days — ${weekSales} sale${weekSales !== 1 ? "s" : ""}. Keep your active sequences running.`,
            `R$ ${(weekRevenue / 100).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 })} en ingresos durante los últimos 7 días — ${weekSales} venta${weekSales !== 1 ? "s" : ""}. Sigue ejecutando las secuencias activas.`,
          )
        : t(
            `${activeCampaigns} campanha${activeCampaigns > 1 ? "s" : ""} ativa${activeCampaigns > 1 ? "s" : ""}. Configure webhooks de receita para monitoramento completo.`,
            `${activeCampaigns} active campaign${activeCampaigns > 1 ? "s" : ""}. Configure revenue webhooks for full monitoring.`,
            `${activeCampaigns} campaña${activeCampaigns > 1 ? "s" : ""} activa${activeCampaigns > 1 ? "s" : ""}. Configura los webhooks de ingresos para un seguimiento completo.`,
          );

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
                {isMonday && `📊 ${t("Relatório Semanal", "Weekly Report", "Informe semanal")} — `}{t("Semana", "Week", "Semana")} {weekNum} · {today.toLocaleDateString(intlLocale(locale), { month: "long", year: "numeric" })}
              </span>
              {isMonday && (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 text-primary border-primary/40 bg-primary/10">
                  {t("Nova semana", "New week", "Nueva semana")}
                </Badge>
              )}
            </div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-tight">{t("Performance Semanal", "Weekly Performance", "Rendimiento semanal")}</h3>
          </div>
          <Link href="/revenue">
            <Button variant="ghost" size="sm" className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1 text-primary hover:bg-primary/10 shrink-0">
              {t("Ver Detalhes", "View Details", "Ver detalles")} <ChevronRight className="h-2.5 w-2.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: t("Receita semana", "Weekly Revenue", "Ingresos semanales"), value: weekRevenue > 0 ? `R$ ${(weekRevenue / 100).toLocaleString(intlLocale(locale), { minimumFractionDigits: 0 })}` : "—", color: "text-success" },
            { label: t("Vendas", "Sales", "Ventas"), value: weekSales > 0 ? String(weekSales) : "—", color: "text-primary" },
            { label: t("Campanhas ativas", "Active Campaigns", "Campañas activas"), value: String(activeCampaigns), color: "text-cyan-400" },
            { label: t("Sequências ativas", "Active Sequences", "Secuencias activas"), value: String(activeSequences), color: "text-yellow-400" },
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
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">{t("Health Score da Semana", "Weekly Health Score", "Puntuación de salud semanal")}</span>
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
            {t("Relatório enviado para o seu email esta manhã", "Report sent to your email this morning", "Informe enviado a tu correo esta mañana")}
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
