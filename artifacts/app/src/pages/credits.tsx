import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Zap, Clock, TrendingDown, TrendingUp, BarChart3,
  Bot, FileText, Shield, Video, Mail, MessageSquare,
  ArrowUpRight, Cpu, ChevronRight, Package, ListFilter,
  Timer, DollarSign, Layers, Activity,
} from "lucide-react";

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

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Zap, color: "text-muted-foreground" };
}

function agentLabel(agentType: string | null) {
  if (!agentType) return "Desconhecido";
  return AGENT_LABELS[agentType] ?? agentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
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

function CreditGauge({ balance, included }: { balance: number; included: number }) {
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
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">restante</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Saldo Disponível</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-mono font-bold text-5xl"
                style={{ color: gaugeColor, textShadow: `0 0 20px ${gaugeColor}` }}
              >
                {balance.toLocaleString("pt-BR")}
              </span>
              <span className="font-mono text-sm text-muted-foreground">Cr</span>
              {isLow && (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest text-destructive border-destructive/40 bg-destructive/10 animate-pulse ml-2">
                  Baixo — recarregue
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Incluídos</div>
              <div className="font-mono font-bold text-lg text-foreground">{included.toLocaleString("pt-BR")}</div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Utilizados</div>
              <div className="font-mono font-bold text-lg text-muted-foreground">{used.toLocaleString("pt-BR")}</div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Lançamentos ok</div>
              <div className="font-mono font-bold text-lg text-foreground">{launchesLeft} <span className="text-xs text-muted-foreground font-normal">restantes</span></div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Lançamentos feitos</div>
              <div className="font-mono font-bold text-lg text-muted-foreground">{launchesUsed}</div>
            </div>
          </div>
          {isLow && (
            <Link href="/billing">
              <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-9">
                <Zap className="h-3.5 w-3.5" />
                Comprar Pack de Créditos
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
  const [view, setView] = useState<"timeline" | "by_agent" | "by_campaign">("timeline");

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
        <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">Nenhum uso de agente ainda</p>
        <p className="font-mono text-xs text-muted-foreground/40">Execute um lançamento para ver o extrato aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Totais */}
      <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/30">
        <div className="px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Total Consumido</div>
          <div className="font-mono font-bold text-2xl text-destructive">{data.totalCredits.toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted-foreground">cr</span></div>
        </div>
        <div className="px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Custo Real (USD)</div>
          <div className="font-mono font-bold text-2xl text-foreground">${parseFloat(data.totalCostUsd).toFixed(2)}</div>
        </div>
        <div className="px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Chamadas do agente</div>
          <div className="font-mono font-bold text-2xl text-foreground">{data.entries.length}</div>
        </div>
      </div>

      {/* Navegação de views */}
      <div className="flex border-b border-border/30 bg-muted/5">
        {([
          ["timeline",    "Linha do Tempo", Timer],
          ["by_agent",    "Por Agente",     Bot],
          ["by_campaign", "Por Campanha",   Layers],
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
                {["Agente", "Provedor", "Créditos", "Custo", "Duração", "Campanha", "Data"].map(h => (
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
                        <span className="font-mono text-xs text-foreground">{agentLabel(e.agentType)}</span>
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
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">${parseFloat(e.costUsd).toFixed(4)}</span>
                    </td>
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
                      <span className="font-mono text-xs text-muted-foreground/60">{formatDate(e.createdAt)}</span>
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
                    <span className="font-mono text-xs text-foreground font-medium">{agentLabel(a.agentType)}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-muted-foreground">{a.calls}x</span>
                      <span className="font-mono text-sm font-bold text-destructive">{a.credits} cr</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border/30 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-primary/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground/40">{pct.toFixed(1)}% do total</span>
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
                        <span className="font-mono text-xs text-muted-foreground/60">Sem campanha (testes/chat)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-muted-foreground">{c.calls} chamadas</span>
                      <span className="font-mono text-sm font-bold text-destructive">{c.credits} cr</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border/30 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-primary/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground/40">{pct.toFixed(1)}% do total</span>
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
  const costs = [
    { action: "Estratégia Completa",    cost: 45,  icon: Bot },
    { action: "Geração de Conteúdo",    cost: 161, icon: FileText },
    { action: "Sequência PLF (15 msg)", cost: 37,  icon: Mail },
    { action: "Lançamento típico total",cost: 420, icon: Zap },
    { action: "Copy de Nurturing",      cost: 2,   icon: Mail },
    { action: "Relatório de Analytics", cost: 5,   icon: BarChart3 },
    { action: "VSL Script",             cost: 8,   icon: Video },
    { action: "Chat com Agente",        cost: 3,   icon: Cpu },
    { action: "Compliance Check",       cost: 32,  icon: Shield },
    { action: "Plano de Sequência",     cost: 7,   icon: Bot },
  ];

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Custo por Ação do agente</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/50">1 cr ≈ R$0,17</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {costs.map((c, i) => {
          const Icon = c.icon;
          const isOdd = i % 2 === 1;
          const isHighlight = c.action.includes("total");
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
  const { plan, planSlug, workspace } = useAuth();
  const workspaceId = workspace?.id;
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
    { id: "agentes",   label: "Extrato por Agente",   icon: Activity },
    { id: "extrato",   label: "Histórico de Débitos",  icon: Clock },
    { id: "referencia",label: "Tabela de Custos",      icon: ListFilter },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Créditos do agente
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
            Saldo · Extrato detalhado · Custo por Agente
          </p>
        </div>
        <Link href="/billing">
          <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline shrink-0 gap-2">
            <Package className="h-3 w-3" />
            Comprar Pack
          </Button>
        </Link>
      </div>

      {/* Gauge */}
      {loadingBalance ? (
        <Skeleton className="h-44 bg-muted/20" />
      ) : (
        <CreditGauge balance={balance} included={included} />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Transações",  value: transactions.length, icon: Clock,       color: "text-foreground" },
          { label: "Total Gasto", value: totalSpent,          icon: TrendingDown, color: "text-destructive" },
          { label: "Recargas",    value: topUps.length,       icon: TrendingUp,   color: "text-success" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="border border-border/40 bg-card/30 p-4 card-weapon">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
              <div className={`font-mono font-bold text-2xl ${s.color}`}>
                {s.value.toLocaleString("pt-BR")}
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
              <span className="font-mono text-[11px] text-muted-foreground">{transactions.length} transações</span>
            </div>
            {loadingHistory ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Zap className="h-8 w-8 text-muted-foreground/20" />
                <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">Nenhuma transação ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      {["Ação", "Créditos", "Saldo Antes", "Saldo Depois", "Data"].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {transactions.map((tx) => {
                      const meta = getActionMeta(tx.action);
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
                            <span className="font-mono text-xs text-muted-foreground/60">{formatDate(tx.createdAt)}</span>
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
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-primary mb-1">Precisa de mais créditos?</div>
          <div className="font-mono text-xs text-muted-foreground">Packs a partir de R$85 — sem mensalidade, sem prazo de validade</div>
        </div>
        <Link href="/billing">
          <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary shrink-0 gap-2">
            <Package className="h-3.5 w-3.5" />
            Ver Packs
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
