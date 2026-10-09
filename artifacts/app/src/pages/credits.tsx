import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Zap, Clock, TrendingDown, TrendingUp, BarChart3,
  Bot, FileText, Shield, Video, Mail, MessageSquare,
  ArrowUpRight, Cpu, ChevronRight, Package, ListFilter,
  Timer, DollarSign, Layers, Activity, RefreshCw,
} from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

function AdminTopupButton({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { locale } = useUiLocale();
  const t = useUiText();
  const handleTopup = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await customFetch<{ ok: boolean; credited: number; newBalance: number }>("/api/credits/admin-topup", { method: "POST" });
      const nf = new Intl.NumberFormat(intlLocale(locale));
      toast.success(t(`+${nf.format(result.credited)} créditos recarregados. Novo saldo: ${nf.format(result.newBalance)} cr`, `+${nf.format(result.credited)} credits added. New balance: ${nf.format(result.newBalance)} credits`, `+${nf.format(result.credited)} créditos recargados. Nuevo saldo: ${nf.format(result.newBalance)} créditos`));
      onSuccess();
    } catch {
      toast.error(t("Erro ao recarregar créditos.", "Couldn't top up credits.", "No se pudieron recargar los créditos."));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      onClick={handleTopup}
      disabled={loading}
      className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-9"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? t("Recarregando...", "Reloading...", "Recargando...") : t("Recarregar créditos (grátis)", "Top up credits (free)", "Recargar créditos (gratis)")}
    </Button>
  );
}

interface Transaction {
  id: string;
  action: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  campaignId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface AgentUsageEntry {
  id: string;
  agentType: string | null;
  provider: string;
  model: string;
  creditsCharged: number;
  costUsd: string;
  latencyMs: number | null;
  campaignId: string | null;
  campaignName: string | null;
  createdAt: string;
}

interface AgentUsageSummary {
  entries: AgentUsageEntry[];
  totalCredits: number;
  totalCostUsd: string;
  byAgent: { agentType: string; credits: number; calls: number }[];
  byCampaign: { campaignId: string | null; campaignName: string | null; credits: number; calls: number }[];
}

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  strategy_generation:    { label: "Estratégia",          icon: Bot,          color: "text-primary" },
  intake_conversation:    { label: "Briefing",            icon: MessageSquare, color: "text-blue-400" },
  intake_finalize:        { label: "Finalizar Intake",    icon: FileText,      color: "text-cyan-400" },
  content_generation:     { label: "Geração de Conteúdo", icon: FileText,      color: "text-purple-400" },
  compliance_check:       { label: "Compliance",          icon: Shield,        color: "text-yellow-400" },
  analytics_report:       { label: "Relatório",           icon: BarChart3,     color: "text-green-400" },
  vsl_generation:         { label: "VSL Gerado",          icon: Video,         color: "text-pink-400" },
  email_sequence_item:    { label: "Item de Sequência",   icon: Mail,          color: "text-orange-400" },
  whatsapp_sequence_item: { label: "WhatsApp Seq.",       icon: MessageSquare, color: "text-success" },
  nurturing_message:      { label: "Copy de Nurturing",   icon: Mail,          color: "text-cyan-400" },
  agent_direct_chat:      { label: "Chat com Agente",     icon: Cpu,           color: "text-primary" },
  sequence_plan:          { label: "Plano de Sequência",  icon: Bot,           color: "text-purple-400" },
  credit_topup:           { label: "Recarga de Créditos", icon: Zap,           color: "text-success" },
  purchase:               { label: "Pack de Créditos",    icon: Package,       color: "text-success" },
  video_concept:          { label: "Conceito de Vídeo",   icon: Video,         color: "text-pink-400" },
  video_script:           { label: "Roteiro de Vídeo",    icon: Video,         color: "text-pink-400" },
  video_storyboard:       { label: "Storyboard",          icon: Video,         color: "text-pink-400" },
  video_low_res:          { label: "Clipe Preview",       icon: Video,         color: "text-pink-400" },
  video_high_res:         { label: "Clipe HD Final",      icon: Video,         color: "text-pink-400" },
  video_avatar:           { label: "Avatar IA",           icon: Video,         color: "text-pink-400" },
  video_voice_clone:      { label: "Voz Clonada",         icon: Video,         color: "text-pink-400" },
  video_hybrid:           { label: "Edição Híbrida IA",   icon: Video,         color: "text-pink-400" },
  video_filming_brief:    { label: "Guia de Filmagem",    icon: Video,         color: "text-pink-400" },
};

const AGENT_LABELS: Record<string, string> = {
  command:             "ARES — Comando",
  execution_governor:  "Governança de Execução",
  profile_builder:     "Profile Builder",
  strategy:            "Estrategista",
  strategic_core:      "Core Estratégico",
  strategic_doctrine:  "Doutrina Estratégica",
  offer:               "Agente de Oferta",
  financial_projector: "Projeção Financeira",
  launch_manager:      "Launch Manager",
  analytics:           "Analytics & Dados",
  campaign_memory:     "Memória de Campanha",
  copywriter:          "Copywriter",
  vsl_script:          "Roteirista VSL",
  email_sequence:      "Sequência de Email",
  whatsapp_sequence:   "Sequência WhatsApp",
  compliance:          "Compliance",
  business_intelligence: "Business Intelligence",
  ux_simplification:   "UX Simplification",
  memory_compression:  "Memory Compression",
  sales_warmer:        "Marco — Aquecimento",
  sales_closer:        "Vitor — Fechamento",
  sales_objection:     "Clara — Objeções",
  sales_consultant:    "Alex — Consultor",
  sales_desire:        "Renata — Desejo",
};

const PROVIDER_BADGE: Record<string, { label: string; color: string }> = {
  anthropic: { label: "Claude",   color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  openai:    { label: "GPT-5.5",  color: "text-green-400 border-green-400/30 bg-green-400/10" },
  gemini:    { label: "Gemini",   color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
};

function getActionMeta(action: string, t: ReturnType<typeof useUiText>) {
  const meta = ACTION_META[action] ?? { label: action, icon: Zap, color: "text-muted-foreground" };
  const english: Record<string, string> = {
    strategy_generation: "Strategy", intake_conversation: "Briefing", intake_finalize: "Finalize intake",
    content_generation: "Content generation", compliance_check: "Compliance", analytics_report: "Report",
    vsl_generation: "VSL generated", email_sequence_item: "Sequence item", whatsapp_sequence_item: "WhatsApp sequence",
    nurturing_message: "Nurture copy", agent_direct_chat: "Agent chat", sequence_plan: "Sequence plan",
    credit_topup: "Credit top-up", purchase: "Credit pack", video_concept: "Video concept",
    video_script: "Video script", video_storyboard: "Storyboard", video_low_res: "Preview clip",
    video_high_res: "Final HD clip", video_avatar: "AI avatar", video_voice_clone: "Cloned voice",
    video_hybrid: "AI hybrid edit", video_filming_brief: "Filming guide",
  };
  const spanish: Record<string, string> = {
    strategy_generation: "Estrategia", intake_conversation: "Resumen", intake_finalize: "Finalizar resumen",
    content_generation: "Generación de contenido", compliance_check: "Cumplimiento", analytics_report: "Informe",
    vsl_generation: "VSL generado", email_sequence_item: "Elemento de secuencia", whatsapp_sequence_item: "Secuencia de WhatsApp",
    nurturing_message: "Contenido de nurturing", agent_direct_chat: "Chat con agente", sequence_plan: "Plan de secuencia",
    credit_topup: "Recarga de créditos", purchase: "Paquete de créditos", video_concept: "Concepto de video",
    video_script: "Guion de video", video_storyboard: "Storyboard", video_low_res: "Clip de vista previa",
    video_high_res: "Clip final HD", video_avatar: "Avatar IA", video_voice_clone: "Voz clonada",
    video_hybrid: "Edición híbrida IA", video_filming_brief: "Guía de grabación",
  };
  return { ...meta, label: t(meta.label, english[action] ?? meta.label, spanish[action] ?? meta.label) };
}

function agentLabel(agentType: string | null, t: ReturnType<typeof useUiText>) {
  if (!agentType) return t("Desconhecido", "Unknown", "Desconocido");
  const label = AGENT_LABELS[agentType] ?? agentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const english: Record<string, string> = {
    command: "ARES — Command", execution_governor: "Execution Governance", strategy: "Strategist",
    offer: "Offer Agent", campaign_memory: "Campaign Memory", vsl_script: "VSL Writer",
    email_sequence: "Email Sequence", whatsapp_sequence: "WhatsApp Sequence", sales_warmer: "Marco — Lead Nurturing",
    sales_closer: "Vitor — Closing", sales_objection: "Clara — Objections", sales_consultant: "Alex — Consultant",
    sales_desire: "Renata — Desire",
  };
  const spanish: Record<string, string> = {
    command: "ARES — Comando", execution_governor: "Gobernanza de ejecución", strategy: "Estratega",
    offer: "Agente de ofertas", campaign_memory: "Memoria de campaña", vsl_script: "Guionista de VSL",
    email_sequence: "Secuencia de correo", whatsapp_sequence: "Secuencia de WhatsApp", sales_warmer: "Marco — Nutrición de leads",
    sales_closer: "Vitor — Cierre", sales_objection: "Clara — Objeciones", sales_consultant: "Alex — Consultor",
    sales_desire: "Renata — Deseo",
  };
  return t(label, english[agentType] ?? label, spanish[agentType] ?? label);
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(intlLocale(locale as "pt-BR" | "en-US" | "en-AU" | "es-LA"), {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatLatency(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const PLAN_CREDITS: Record<string, number> = {
  solo: 900,
  agency: 2000,
};

function CreditGauge({ balance, included, isAdmin, onTopup }: { balance: number; included: number; isAdmin?: boolean; onTopup?: () => void }) {
  const { locale } = useUiLocale();
  const t = useUiText();
  const numberFormat = new Intl.NumberFormat(intlLocale(locale));
  const pct = included > 0 ? Math.min(100, (balance / included) * 100) : 0;
  const used = Math.max(0, included - balance);
  const isLow = balance < 150;
  const isMedium = balance < 400;

  const gaugeColor = isLow
    ? "hsl(var(--destructive))"
    : isMedium
    ? "hsl(45 100% 50%)"
    : "hsl(var(--primary))";

  const launchesLeft = Math.floor(balance / 420);
  const launchesUsed = Math.floor(used / 420);

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
        <div className="flex items-center justify-center shrink-0">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={gaugeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                style={{ filter: `drop-shadow(0 0 6px ${gaugeColor})`, transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono font-bold text-2xl text-foreground leading-none">{Math.round(pct)}%</span>
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">{t("restante", "remaining", "restante")}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("Saldo disponível", "Available balance", "Saldo disponible")}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-mono font-bold text-5xl"
                style={{ color: gaugeColor, textShadow: `0 0 20px ${gaugeColor}` }}
              >
                {numberFormat.format(balance)}
              </span>
              <span className="font-mono text-sm text-muted-foreground">Cr</span>
              {isLow && (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest text-destructive border-destructive/40 bg-destructive/10 animate-pulse ml-2">
                  {t("Baixo — recarregue", "Low — top up", "Bajo — recargar")}
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{t("Incluídos", "Included", "Incluidos")}</div>
              <div className="font-mono font-bold text-lg text-foreground">{numberFormat.format(included)}</div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{t("Utilizados", "Used", "Utilizados")}</div>
              <div className="font-mono font-bold text-lg text-muted-foreground">{numberFormat.format(used)}</div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{t("Lançamentos possíveis", "Estimated launches", "Lanzamientos posibles")}</div>
              <div className="font-mono font-bold text-lg text-foreground">{numberFormat.format(launchesLeft)} <span className="text-xs text-muted-foreground font-normal">{t("restantes", "remaining", "restantes")}</span></div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{t("Lançamentos feitos", "Launches used", "Lanzamientos realizados")}</div>
              <div className="font-mono font-bold text-lg text-muted-foreground">{numberFormat.format(launchesUsed)}</div>
            </div>
          </div>
          {isAdmin && balance < 500 && onTopup ? (
            <AdminTopupButton onSuccess={onTopup} />
          ) : isLow && (
            <Link href="/billing">
              <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-9">
                <Zap className="h-3.5 w-3.5" />
                {t("Comprar pacote de créditos", "Buy a credit pack", "Comprar paquete de créditos")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentUsageTab({ workspaceId }: { workspaceId: string }) {
  const { locale } = useUiLocale();
  const t = useUiText();
  const numberFormat = new Intl.NumberFormat(intlLocale(locale));
  const [view, setView] = useState<"timeline" | "by_agent" | "by_campaign">("timeline");
  const { isAdmin } = useAuth();

  const { data, isLoading } = useQuery<AgentUsageSummary>({
    queryKey: ["/api/credits/usage"],
    queryFn: async () => {
      return customFetch<AgentUsageSummary>("/api/credits/usage?limit=200")
        .catch(() => ({ entries: [], totalCredits: 0, totalCostUsd: "0", byAgent: [], byCampaign: [] } as AgentUsageSummary));
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-2">
        <Activity className="h-8 w-8 text-muted-foreground/20" />
        <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">{t("Nenhum uso de agente ainda", "No agent usage yet", "Aún no hay uso de agentes")}</p>
        <p className="font-mono text-xs text-muted-foreground/40">{t("Execute um lançamento para ver o extrato aqui", "Run a launch to see activity here", "Ejecuta un lanzamiento para ver la actividad aquí")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Totais */}
      <div className={`grid divide-x divide-border/30 border-b border-border/30 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("Total consumido", "Total used", "Total consumido")}</div>
            <div className="font-mono font-bold text-2xl text-destructive">{numberFormat.format(data.totalCredits)} <span className="text-xs font-normal text-muted-foreground">{t("cr", "credits", "créditos")}</span></div>
        </div>
        {isAdmin && (
          <div className="px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("Custo real (USD)", "Actual cost (USD)", "Costo real (USD)")}</div>
            <div className="font-mono font-bold text-2xl text-foreground">${parseFloat(data.totalCostUsd).toFixed(2)}</div>
          </div>
        )}
        <div className="px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("Chamadas do agente", "Agent calls", "Llamadas del agente")}</div>
          <div className="font-mono font-bold text-2xl text-foreground">{data.entries.length}</div>
        </div>
      </div>

      {/* Navegação de views */}
      <div className="flex border-b border-border/30 bg-muted/5">
        {([
          ["timeline",    t("Linha do tempo", "Timeline", "Cronología"), Timer],
          ["by_agent",    t("Por agente", "By agent", "Por agente"), Bot],
          ["by_campaign", t("Por campanha", "By campaign", "Por campaña"), Layers],
        ] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex items-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-colors ${
              view === v
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* TIMELINE */}
      {view === "timeline" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-muted/10">
                {[t("Agente", "Agent", "Agente"), t("Provedor", "Provider", "Proveedor"), t("Créditos", "Credits", "Créditos"), ...(isAdmin ? [t("Custo", "Cost", "Costo")] : []), t("Duração", "Duration", "Duración"), t("Campanha", "Campaign", "Campaña"), t("Data", "Date", "Fecha")].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {data.entries.map((e) => {
                const provBadge = PROVIDER_BADGE[e.provider] ?? { label: e.provider, color: "text-muted-foreground border-border/30 bg-muted/10" };
                return (
                  <tr key={e.id} className="table-row-glow">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Bot className="h-3 w-3 shrink-0 text-primary/60" />
                        <span className="font-mono text-xs text-foreground">{agentLabel(e.agentType, t)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase tracking-widest ${provBadge.color}`}>
                        {provBadge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-destructive">−{e.creditsCharged}</span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">${parseFloat(e.costUsd).toFixed(4)}</span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{formatLatency(e.latencyMs)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {e.campaignName ? (
                        <Link href={`/campaigns/${e.campaignId}`}>
                          <span className="font-mono text-xs text-primary/80 hover:text-primary truncate block cursor-pointer">{e.campaignName}</span>
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground/60">{formatDate(e.createdAt, locale)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* POR AGENTE */}
      {view === "by_agent" && (
        <div className="divide-y divide-border/20">
          {data.byAgent.map((a, i) => {
            const pct = data.totalCredits > 0 ? (a.credits / data.totalCredits) * 100 : 0;
            return (
              <div key={a.agentType} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/5">
                <span className="font-mono text-xs text-muted-foreground/40 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-foreground font-medium">{agentLabel(a.agentType, t)}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-muted-foreground">{a.calls}x</span>
                      <span className="font-mono text-sm font-bold text-destructive">{numberFormat.format(a.credits)} {t("cr", "credits", "créditos")}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border/30 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-primary/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground/40">{pct.toFixed(1)}% {t("do total", "of total", "del total")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POR CAMPANHA */}
      {view === "by_campaign" && (
        <div className="divide-y divide-border/20">
          {data.byCampaign.map((c, i) => {
            const pct = data.totalCredits > 0 ? (c.credits / data.totalCredits) * 100 : 0;
            return (
              <div key={c.campaignId ?? "none"} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/5">
                <span className="font-mono text-xs text-muted-foreground/40 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      {c.campaignName ? (
                        <Link href={`/campaigns/${c.campaignId}`}>
                          <span className="font-mono text-xs text-primary/80 hover:text-primary cursor-pointer truncate block">{c.campaignName}</span>
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground/60">{t("Sem campanha (testes/chat)", "No campaign (tests/chat)", "Sin campaña (pruebas/chat)")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-muted-foreground">{numberFormat.format(c.calls)} {t("chamadas", "calls", "llamadas")}</span>
                      <span className="font-mono text-sm font-bold text-destructive">{numberFormat.format(c.credits)} {t("cr", "credits", "créditos")}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border/30 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-primary/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground/40">{pct.toFixed(1)}% {t("do total", "of total", "del total")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CostReference() {
  const t = useUiText();
  const costs = [
    { action: t("Estratégia completa", "Complete strategy", "Estrategia completa"), cost: 45, icon: Bot, highlight: false },
    { action: t("Geração de conteúdo", "Content generation", "Generación de contenido"), cost: 161, icon: FileText, highlight: false },
    { action: t("Sequência PLF (15 mensagens)", "PLF sequence (15 messages)", "Secuencia PLF (15 mensajes)"), cost: 37, icon: Mail, highlight: false },
    { action: t("Lançamento típico total", "Typical full launch", "Lanzamiento típico completo"), cost: 420, icon: Zap, highlight: true },
    { action: t("Copy de nurturing", "Nurture copy", "Contenido de nurturing"), cost: 2, icon: Mail, highlight: false },
    { action: t("Relatório de analytics", "Analytics report", "Informe de analítica"), cost: 5, icon: BarChart3, highlight: false },
    { action: t("Roteiro VSL", "VSL script", "Guion de VSL"), cost: 8, icon: Video, highlight: false },
    { action: t("Chat com agente", "Agent chat", "Chat con agente"), cost: 3, icon: Cpu, highlight: false },
    { action: t("Verificação de compliance", "Compliance check", "Revisión de cumplimiento"), cost: 32, icon: Shield, highlight: false },
    { action: t("Plano de sequência", "Sequence plan", "Plan de secuencia"), cost: 7, icon: Bot, highlight: false },
  ];

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Custo por ação do agente", "Cost per agent action", "Costo por acción del agente")}</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/50">1 cr ≈ R$0,17</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {costs.map((c, i) => {
          const Icon = c.icon;
          const isOdd = i % 2 === 1;
          const isHighlight = c.highlight ?? false;
          return (
            <div key={c.action} className={`flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-0 ${isOdd ? "sm:border-l border-border/20" : ""} ${isHighlight ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isHighlight ? "text-primary" : "text-primary/60"}`} />
                <span className={`font-mono text-xs ${isHighlight ? "text-foreground font-bold" : "text-muted-foreground"}`}>{c.action}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`font-mono font-bold text-sm ${isHighlight ? "text-primary" : "text-foreground"}`}>{c.cost}</span>
                <span className="font-mono text-[11px] text-muted-foreground">Cr</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TabId = "extrato" | "agentes" | "referencia";

export default function CreditsPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberFormat = new Intl.NumberFormat(intlLocale(locale));
  const { plan, planSlug, workspace, isAdmin } = useAuth();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();
  const { data: refundCreditState } = useQuery({ queryKey: ["/api/credits/check/strategy_generation"], queryFn: () => customFetch<{ blockedByRefund: boolean }>("/api/credits/check/strategy_generation"), refetchInterval: 15000 });
  const [activeTab, setActiveTab] = useState<TabId>("agentes");

  const { data: balanceData, isLoading: loadingBalance } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey() },
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/credits/history"],
    queryFn: async () => {
      return customFetch<{ transactions: Transaction[] }>("/api/credits/history?limit=50")
        .catch(() => ({ transactions: [] as Transaction[] }));
    },
  });

  const balance = balanceData?.balance ?? 0;
  const included = PLAN_CREDITS[planSlug ?? "solo"] ?? plan?.creditsMonthly ?? 900;
  const transactions = historyData?.transactions ?? [];

  const debits  = transactions.filter(t => t.amount < 0);
  const topUps  = transactions.filter(t => t.amount > 0);
  const totalSpent = debits.reduce((s, t) => s + Math.abs(t.amount), 0);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "agentes",   label: t("Extrato por agente", "Agent usage", "Uso por agente"), icon: Activity },
    { id: "extrato",   label: t("Histórico de débitos", "Debit history", "Historial de débitos"), icon: Clock },
    { id: "referencia",label: t("Tabela de custos", "Cost table", "Tabla de costos"), icon: ListFilter },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            {t("Créditos do agente", "Agent credits", "Créditos del agente")}
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
            {t("Saldo · Extrato detalhado · Custo por agente", "Balance · Detailed statement · Cost per agent", "Saldo · Estado detallado · Costo por agente")}
          </p>
        </div>
        <Link href="/billing">
          <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline shrink-0 gap-2">
            <Package className="h-3 w-3" />
            {t("Comprar pacote", "Buy a pack", "Comprar paquete")}
          </Button>
        </Link>
      </div>

      {/* Gauge */}
      {loadingBalance ? (
        <Skeleton className="h-44 bg-muted/20" />
      ) : (
          <>
          {refundCreditState?.blockedByRefund && <div role="alert" className="border border-yellow-400/40 p-4 text-yellow-400 text-sm">Seus créditos continuam no saldo, mas o consumo está bloqueado enquanto o estorno aguarda aprovação ou processamento. Contate o administrador. A solicitação não pode ser cancelada por aqui.</div>}
          <CreditGauge balance={balance} included={included} isAdmin={isAdmin} onTopup={() => queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() })} />
          </>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("Transações", "Transactions", "Transacciones"), value: transactions.length, icon: Clock, color: "text-foreground" },
          { label: t("Total gasto", "Total spent", "Total gastado"), value: totalSpent, icon: TrendingDown, color: "text-destructive" },
          { label: t("Recargas", "Top-ups", "Recargas"), value: topUps.length, icon: TrendingUp, color: "text-success" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="border border-border/40 bg-card/30 p-4 card-weapon">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
              <div className={`font-mono font-bold text-2xl ${s.color}`}>
                {numberFormat.format(s.value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon overflow-hidden">
        <div className="flex border-b border-border/40 bg-muted/5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Extrato por Agente (detalhado por chamada do agente) */}
        {activeTab === "agentes" && (
          <AgentUsageTab workspaceId={workspaceId ?? ""} />
        )}

        {/* Tab: Histórico de Débitos (crédito debitado por ação) */}
        {activeTab === "extrato" && (
          <>
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">{numberFormat.format(transactions.length)} {t("transações", "transactions", "transacciones")}</span>
            </div>
            {loadingHistory ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Zap className="h-8 w-8 text-muted-foreground/20" />
                <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">{t("Nenhuma transação ainda", "No transactions yet", "Aún no hay transacciones")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      {[t("Ação", "Action", "Acción"), t("Créditos", "Credits", "Créditos"), t("Saldo antes", "Balance before", "Saldo anterior"), t("Saldo depois", "Balance after", "Saldo posterior"), t("Data", "Date", "Fecha")].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {transactions.map((tx) => {
                      const meta = getActionMeta(tx.action, t);
                      const Icon = meta.icon;
                      const isDebit = tx.amount < 0;
                      return (
                        <tr key={tx.id} className="table-row-glow">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                              <span className="font-mono text-xs">{meta.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-mono text-sm font-bold ${isDebit ? "text-destructive" : "text-success"}`}>
                              {isDebit ? "" : "+"}{tx.amount}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">{tx.balanceBefore}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">{tx.balanceAfter}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground/60">{formatDate(tx.createdAt, locale)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Tab: Tabela de Referência */}
        {activeTab === "referencia" && (
          <CostReference />
        )}
      </div>

      {/* CTA */}
      <div className="border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-primary mb-1">{t("Precisa de mais créditos?", "Need more credits?", "¿Necesitas más créditos?")}</div>
          <div className="font-mono text-xs text-muted-foreground">{t("Pacotes a partir de R$85 — sem mensalidade, sem prazo de validade", "Packs from R$85 — no subscription and no expiration", "Paquetes desde R$85 — sin mensualidad ni fecha de vencimiento")}</div>
        </div>
        <Link href="/billing">
          <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary shrink-0 gap-2">
            <Package className="h-3.5 w-3.5" />
            {t("Ver pacotes", "View packs", "Ver paquetes")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
