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
  ArrowUpRight, Cpu, ChevronRight,
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

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  strategy_generation:    { label: "Estratégia IA",       icon: Bot,          color: "text-primary" },
  intake_conversation:    { label: "Intake IA",           icon: MessageSquare, color: "text-blue-400" },
  intake_finalize:        { label: "Finalizar Intake",    icon: FileText,      color: "text-cyan-400" },
  content_generation:     { label: "Geração de Conteúdo", icon: FileText,      color: "text-purple-400" },
  compliance_check:       { label: "Compliance",          icon: Shield,        color: "text-yellow-400" },
  analytics_report:       { label: "Relatório IA",        icon: BarChart3,     color: "text-green-400" },
  vsl_generation:         { label: "VSL Gerado",          icon: Video,         color: "text-pink-400" },
  email_sequence_item:    { label: "Item de Sequência",   icon: Mail,          color: "text-orange-400" },
  whatsapp_sequence_item: { label: "WhatsApp Seq.",       icon: MessageSquare, color: "text-success" },
  nurturing_message:      { label: "Copy de Nurturing",   icon: Mail,          color: "text-cyan-400" },
  agent_direct_chat:      { label: "Chat com Agente",     icon: Cpu,           color: "text-primary" },
  sequence_plan:          { label: "Plano de Sequência",  icon: Bot,           color: "text-purple-400" },
  credit_topup:           { label: "Recarga de Créditos", icon: Zap,           color: "text-success" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Zap, color: "text-muted-foreground" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function CreditGauge({ balance, total }: { balance: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (balance / total) * 100) : 0;
  const used = total - balance;
  const isLow = pct < 15;
  const isMedium = pct < 35;

  const gaugeColor = isLow
    ? "hsl(var(--destructive))"
    : isMedium
    ? "hsl(45 100% 50%)"
    : "hsl(var(--primary))";

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
        {/* Circular gauge */}
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

        {/* Stats */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Saldo Disponível</div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-mono font-bold text-5xl"
                style={{ color: gaugeColor, textShadow: `0 0 20px ${gaugeColor}` }}
              >
                {balance.toLocaleString("pt-BR")}
              </span>
              <span className="font-mono text-sm text-muted-foreground">Cr</span>
              {isLow && (
                <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest text-destructive border-destructive/40 bg-destructive/10 animate-pulse ml-2">
                  Crítico
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Total Mensal</div>
              <div className="font-mono font-bold text-lg text-foreground">{total.toLocaleString("pt-BR")}</div>
            </div>
            <div className="border border-border/30 bg-background/40 p-3">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Utilizados</div>
              <div className="font-mono font-bold text-lg text-muted-foreground">{used.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostReference() {
  const costs = [
    { action: "Chat com Agente",        cost: 3,  icon: Cpu },
    { action: "Intake IA (por msg)",    cost: 2,  icon: MessageSquare },
    { action: "Finalizar Intake",       cost: 5,  icon: FileText },
    { action: "Estratégia Completa",    cost: 25, icon: Bot },
    { action: "Geração de Conteúdo",    cost: 15, icon: FileText },
    { action: "Compliance Check",       cost: 5,  icon: Shield },
    { action: "Relatório de Analytics", cost: 10, icon: BarChart3 },
    { action: "VSL Script",             cost: 20, icon: Video },
    { action: "Plano de Sequência",     cost: 30, icon: Bot },
    { action: "Copy de Nurturing",      cost: 2,  icon: Mail },
  ];

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Custo por Ação de IA</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y divide-x-0 sm:divide-y-0 sm:grid-flow-row">
        {costs.map((c, i) => {
          const Icon = c.icon;
          const isOdd = i % 2 === 1;
          return (
            <div key={c.action} className={`flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-0 ${isOdd ? "sm:border-l border-border/20" : ""}`}>
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                <span className="font-mono text-xs text-muted-foreground">{c.action}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono font-bold text-sm text-foreground">{c.cost}</span>
                <span className="font-mono text-[11px] text-muted-foreground">Cr</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const { plan } = useAuth();

  const { data: balanceData, isLoading: loadingBalance } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey() },
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/credits/history"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/credits/history?limit=50");
      if (!res.ok) return { transactions: [] };
      return res.json() as Promise<{ transactions: Transaction[] }>;
    },
  });

  const balance = balanceData?.balance ?? 0;
  const total = plan?.creditsMonthly ?? 1500;
  const transactions = historyData?.transactions ?? [];

  const debits  = transactions.filter(t => t.amount < 0);
  const topUps  = transactions.filter(t => t.amount > 0);
  const totalSpent = debits.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Créditos de IA
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
            Saldo · Histórico · Custo por Ação
          </p>
        </div>
        <Link href="/settings?tab=workspace">
          <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline shrink-0">
            <ArrowUpRight className="h-3 w-3 mr-1.5" />
            Ver Planos
          </Button>
        </Link>
      </div>

      {/* Gauge */}
      {loadingBalance ? (
        <Skeleton className="h-44 bg-muted/20" />
      ) : (
        <CreditGauge balance={balance} total={total} />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Transações",    value: transactions.length, icon: Clock,       color: "text-foreground" },
          { label: "Total Gasto",   value: totalSpent,          icon: TrendingDown, color: "text-destructive" },
          { label: "Recargas",      value: topUps.length,       icon: TrendingUp,   color: "text-success" },
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

      {/* History */}
      <div className="border border-border/50 bg-card/40 backdrop-blur-sm card-weapon overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Histórico de Uso</span>
          </div>
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
            <p className="font-mono text-xs text-muted-foreground/40">Use os agentes de IA para ver o histórico aqui</p>
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
      </div>

      {/* Cost reference */}
      <CostReference />

      {/* CTA to agents */}
      <div className="border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-primary mb-1">Time de IA disponível</div>
          <div className="font-mono text-xs text-muted-foreground">16 agentes especializados prontos para brainstorm, estratégia e execução</div>
        </div>
        <Link href="/agents">
          <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary shrink-0 gap-2">
            <Bot className="h-3.5 w-3.5" />
            Acessar Agentes
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
