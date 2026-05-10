import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, Plus, Link2, Loader2, CheckCircle2,
  Globe, Zap, Download, BarChart3, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueSummary {
  total: number;
  byPlatform: Record<string, number>;
  transactionCount: number;
  avgTicket: number;
}
interface RevenueEvent {
  id: string; platform: string; eventType: string;
  amountBrl: string; productName?: string; customerEmail?: string; createdAt: string;
}
interface WebhookConfig {
  id: string; platform: string; endpointUrl?: string; isActive: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", eduzz: "Eduzz", monetizze: "Monetizze",
  stripe: "Stripe", pagarme: "Pagar.me", asaas: "Asaas", custom: "Custom",
};
const PLATFORM_COLOR: Record<string, string> = {
  hotmart:   "text-orange-400 border-orange-400/40 bg-orange-400/10",
  kiwify:    "text-blue-400 border-blue-400/40 bg-blue-400/10",
  stripe:    "text-purple-400 border-purple-400/40 bg-purple-400/10",
  eduzz:     "text-green-400 border-green-400/40 bg-green-400/10",
  monetizze: "text-pink-400 border-pink-400/40 bg-pink-400/10",
};
const EVENT_LABEL: Record<string, string> = {
  sale: "Venda", refund: "Reembolso", subscription: "Assinatura", chargeback: "Chargeback",
};

type PeriodKey = "7d" | "30d" | "90d" | "all";
const PERIOD_LABELS: Record<PeriodKey, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "all": "Tudo" };

// ── Generate mock chart data ──────────────────────────────────────────────────
function generateChartData(period: PeriodKey, total: number): Array<{ label: string; value: number; cumulative: number }> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
  const data: Array<{ label: string; value: number; cumulative: number }> = [];
  const base = total / (days || 1);
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const variance = 0.3 + Math.random() * 1.4;
    const value = total > 0 ? Math.round((base * variance) / 100) * 100 : 0;
    const prev = data.length > 0 ? data[data.length - 1].cumulative : 0;
    data.push({ label, value, cumulative: prev + value });
  }
  return data;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 px-3 py-2 font-mono text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-success font-bold">R$ {(payload[0].value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCsv(events: RevenueEvent[]) {
  const header = "ID,Plataforma,Tipo,Valor (R$),Produto,Email,Data";
  const rows = events.map(e =>
    `${e.id},${e.platform},${EVENT_LABEL[e.eventType] ?? e.eventType},${Number(e.amountBrl).toFixed(2)},${e.productName ?? ""},${e.customerEmail ?? ""},${new Date(e.createdAt).toLocaleDateString("pt-BR")}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receita-nexos-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "chart" | "events" | "webhooks";

export default function RevenuePage() {
  const [activeTab, setActiveTab]       = useState<Tab>("overview");
  const [period, setPeriod]             = useState<PeriodKey>("30d");
  const [chartType, setChartType]       = useState<"bar" | "area">("area");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [webhookPlatform, setWebhookPlatform] = useState("hotmart");
  const queryClient = useQueryClient();

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/revenue/summary"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/summary");
      if (!res.ok) return null;
      return res.json() as Promise<RevenueSummary>;
    },
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/revenue/events", period],
    enabled: activeTab === "events" || activeTab === "chart",
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/events?limit=200");
      if (!res.ok) return { events: [] };
      return res.json() as Promise<{ events: RevenueEvent[] }>;
    },
  });

  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({
    queryKey: ["/api/revenue/webhook-configs"],
    enabled: activeTab === "webhooks",
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/webhook-configs");
      if (!res.ok) return { configs: [] };
      return res.json() as Promise<{ configs: WebhookConfig[] }>;
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>("/api/revenue/webhook-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: webhookPlatform }),
      });
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => {
      toast.success("Webhook configurado. Copie a URL e configure na plataforma.");
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/webhook-configs"] });
      setAddingWebhook(false);
    },
    onError: () => toast.error("Erro ao configurar webhook"),
  });

  const chartData = generateChartData(period, summaryData?.total ?? 0);
  const events = eventsData?.events ?? [];

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",  label: "Resumo",       icon: DollarSign },
    { id: "chart",     label: "Evolução",      icon: BarChart3 },
    { id: "events",    label: "Transações",    icon: CheckCircle2 },
    { id: "webhooks",  label: "Webhooks",      icon: Link2 },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Receita & Vendas</h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Hotmart · Kiwify · Eduzz · Stripe · Tempo Real
          </p>
        </div>
        <Button
          onClick={() => exportCsv(events)}
          disabled={events.length === 0}
          variant="outline"
          className="rounded-none font-mono uppercase tracking-widest gap-2 h-9 text-xs btn-weapon-outline shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-border/50 bg-card/40 p-1 w-fit overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
            >
              <Icon className="h-3 w-3" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {summaryLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : !summaryData || summaryData.total === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/30">
              <DollarSign className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Nenhuma receita registrada ainda</p>
              <p className="font-mono text-xs text-muted-foreground/50 max-w-xs mx-auto">Configure os webhooks das suas plataformas de venda para começar a monitorar receita em tempo real</p>
              <Button onClick={() => setActiveTab("webhooks")} className="mt-4 rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
                <Link2 className="h-3.5 w-3.5" />Configurar Webhooks
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Receita Total", value: `R$ ${(summaryData.total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success border-success/20 bg-success/5" },
                  { label: "Transações", value: String(summaryData.transactionCount), icon: CheckCircle2, color: "text-primary border-primary/20 bg-primary/5" },
                  { label: "Ticket Médio", value: `R$ ${(summaryData.avgTicket / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" },
                  { label: "Plataformas", value: String(Object.keys(summaryData.byPlatform).length), icon: Globe, color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5" },
                ].map(kpi => (
                  <div key={kpi.label} className={`border p-4 ${kpi.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <kpi.icon className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-mono uppercase tracking-widest opacity-70">{kpi.label}</span>
                    </div>
                    <div className="font-mono font-bold text-xl text-foreground">{kpi.value}</div>
                  </div>
                ))}
              </div>

              <div className="border border-border/50 bg-card/40 p-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Receita Por Plataforma</div>
                <div className="space-y-3">
                  {Object.entries(summaryData.byPlatform).map(([platform, amount]) => {
                    const pct = Math.round((amount / summaryData.total) * 100);
                    return (
                      <div key={platform} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${PLATFORM_COLOR[platform] ?? "border-border/50 text-muted-foreground"}`}>
                            {PLATFORM_LABEL[platform] ?? platform}
                          </Badge>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-muted-foreground/50">{pct}%</span>
                            <span className="font-mono text-sm text-success font-bold">
                              R$ {(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="h-1 bg-muted/20">
                          <div className="h-full bg-success/60" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Chart ── */}
      {activeTab === "chart" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 border border-border/50 bg-card/40 p-1">
              {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-all
                    ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="flex gap-1 border border-border/50 bg-card/40 p-1">
              {([["bar", "Barras"], ["area", "Área"]] as const).map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-all
                    ${chartType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="border border-border/50 bg-card/40 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Receita diária — {PERIOD_LABELS[period]}
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/100).toLocaleString("pt-BR", { notation: "compact" })}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="hsl(var(--primary)/0.7)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/100).toLocaleString("pt-BR", { notation: "compact" })}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#revenueGrad)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative */}
          <div className="border border-border/50 bg-card/40 p-4">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Receita acumulada — {PERIOD_LABELS[period]}
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v/100).toLocaleString("pt-BR", { notation: "compact" })}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative" stroke="hsl(142 71% 45%)" strokeWidth={1.5} fill="url(#cumulativeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Events ── */}
      {activeTab === "events" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 border border-border/50 bg-card/40 p-1">
              {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-all
                    ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <Button
              onClick={() => exportCsv(events)}
              disabled={events.length === 0}
              variant="outline"
              size="sm"
              className="rounded-none font-mono uppercase tracking-widest gap-2 h-8 text-xs btn-weapon-outline"
            >
              <Download className="h-3 w-3" />CSV
            </Button>
          </div>

          {eventsLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhuma transação registrada</p>
            </div>
          ) : (
            events.slice(0, 50).map(event => (
              <div key={event.id} className="border border-border/50 bg-card/40 px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 shrink-0 ${PLATFORM_COLOR[event.platform] ?? "border-border/50 text-muted-foreground"}`}>
                    {PLATFORM_LABEL[event.platform] ?? event.platform}
                  </Badge>
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 shrink-0 ${event.eventType === "sale" ? "text-success border-success/40 bg-success/5" : "text-destructive border-destructive/40 bg-destructive/5"}`}>
                    {EVENT_LABEL[event.eventType] ?? event.eventType}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground/70 truncate">
                    {event.productName ?? event.customerEmail ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`font-mono font-bold text-sm ${event.eventType === "sale" ? "text-success" : "text-destructive"}`}>
                    {event.eventType === "refund" ? "-" : "+"}R$ {Number(event.amountBrl).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/60">
                    {new Date(event.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Webhooks ── */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Configure webhooks para receber eventos de venda em tempo real
            </p>
            <Button size="sm" onClick={() => setAddingWebhook(true)}
              className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
              <Plus className="h-3.5 w-3.5" />Adicionar
            </Button>
          </div>

          {addingWebhook && (
            <div className="border border-primary/30 bg-card/40 p-4 space-y-3">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground block">Plataforma</label>
              <select value={webhookPlatform} onChange={e => setWebhookPlatform(e.target.value)}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createWebhookMutation.mutate()} disabled={createWebhookMutation.isPending}
                  className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
                  {createWebhookMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Salvando...</> : <><Zap className="h-3 w-3" />Configurar</>}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingWebhook(false)}
                  className="font-mono uppercase tracking-widest rounded-none h-9 px-4 text-xs text-muted-foreground">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {webhooksLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : (webhooksData?.configs ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhum webhook configurado</p>
            </div>
          ) : (
            (webhooksData?.configs ?? []).map(config => (
              <div key={config.id} className="border border-border/50 bg-card/40 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${PLATFORM_COLOR[config.platform] ?? "border-border/50"}`}>
                    {PLATFORM_LABEL[config.platform] ?? config.platform}
                  </Badge>
                  {config.endpointUrl && (
                    <code className="text-[11px] font-mono text-muted-foreground/70 bg-muted/20 px-2 py-1 truncate max-w-[300px]">
                      {config.endpointUrl}
                    </code>
                  )}
                </div>
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${config.isActive ? "text-success border-success/40 bg-success/10" : "text-muted-foreground border-border/50"}`}>
                  {config.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
