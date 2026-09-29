import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import {
  DollarSign, TrendingUp, Plus, Link2, Loader2, CheckCircle2,
  Globe, Zap, Download, BarChart3, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart,
} from "recharts";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueSummary {
  total: number;
  byPlatform: Record<string, number>;
  transactionCount: number;
  avgTicket: number;
  dailyRevenue: Array<{ date: string; gross: number; net: number; sales: number }>;
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
const PERIOD_DAYS: Record<PeriodKey, number> = { "7d": 7, "30d": 30, "90d": 90, "all": 365 };

// ── Build chart data from real daily revenue ──────────────────────────────────
function buildChartData(
  dailyRevenue: Array<{ date: string; gross: number; net: number; sales: number }>,
  locale: string,
): Array<{ label: string; value: number; cumulative: number }> {
  let cumulative = 0;
  return dailyRevenue.map(d => {
    cumulative += d.gross;
    const label = new Date(d.date + "T00:00:00").toLocaleDateString(intlLocale(locale), { day: "2-digit", month: "2-digit" });
    return { label, value: d.gross, cumulative };
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  const { locale } = useUiLocale();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 px-3 py-2 font-mono text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-success font-bold">R$ {(payload[0].value / 100).toLocaleString(intlLocale(locale), { minimumFractionDigits: 2 })}</p>
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
  const t = useUiText();
  const { locale } = useUiLocale();
  const [activeTab, setActiveTab]       = useState<Tab>("overview");
  const [period, setPeriod]             = useState<PeriodKey>("30d");
  const [chartType, setChartType]       = useState<"bar" | "area">("area");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [webhookPlatform, setWebhookPlatform] = useState("hotmart");
  const queryClient = useQueryClient();

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/revenue/summary", period],
    queryFn: async () => {
      const days = PERIOD_DAYS[period];
      return customFetch<RevenueSummary>(`/api/revenue/summary?days=${days}`).catch(() => null);
    },
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/revenue/events", period],
    enabled: activeTab === "events",
    queryFn: async () => {
      const days = PERIOD_DAYS[period];
      return customFetch<{ events: RevenueEvent[] }>(`/api/revenue/events?limit=500&days=${days}`)
        .catch(() => ({ events: [] as RevenueEvent[] }));
    },
  });

  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({
    queryKey: ["/api/revenue/webhook-configs"],
    enabled: activeTab === "webhooks",
    queryFn: async () => {
      return customFetch<{ configs: WebhookConfig[] }>("/api/revenue/webhook-configs")
        .catch(() => ({ configs: [] as WebhookConfig[] }));
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async () => {
      await customFetch<unknown>("/api/revenue/webhook-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: webhookPlatform }),
      });
    },
    onSuccess: () => {
      toast.success(t("Webhook configurado. Copie o URL e configure-o na plataforma.", "Webhook configured. Copy the URL and set it up on the platform.", "Webhook configurado. Copia la URL y configúrala en la plataforma."));
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/webhook-configs"] });
      setAddingWebhook(false);
    },
    onError: () => toast.error(t("Erro ao configurar webhook", "Failed to configure webhook", "Error al configurar el webhook")),
  });

  const chartData = buildChartData(summaryData?.dailyRevenue ?? [], intlLocale(locale));
  const events = eventsData?.events ?? [];

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",  label: t("Resumo", "Overview", "Resumen"),       icon: DollarSign },
    { id: "chart",     label: t("Evolução", "Trends", "Evolución"),      icon: BarChart3 },
    { id: "events",    label: t("Transações", "Transactions", "Transacciones"),    icon: CheckCircle2 },
    { id: "webhooks",  label: "Webhooks",      icon: Link2 },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">{t("Receita e vendas", "Revenue & Sales", "Ingresos y ventas")}</h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Hotmart · Kiwify · Eduzz · Stripe · {t("Tempo real", "Real time", "Tiempo real")}
          </p>
        </div>
        <Button
          onClick={() => exportCsv(events)}
          disabled={events.length === 0}
          variant="outline"
          className="rounded-none font-mono uppercase tracking-widest gap-2 h-9 text-xs btn-weapon-outline shrink-0 w-full sm:w-auto"
        >
          <Download className="h-3.5 w-3.5" />
          {t("Exportar CSV", "Export CSV", "Exportar CSV")}
        </Button>
      </div>

      <FeatureOnboarding
        featureKey={FEATURE_KEYS.REVENUE}
        title={t("RECEITA E VENDAS", "REVENUE & SALES", "INGRESOS Y VENTAS")}
        description={t("Visão consolidada de todas as vendas em tempo real — Hotmart, Kiwify, Eduzz e Stripe. Cada venda é capturada automaticamente via webhook.", "A real-time overview of sales across Hotmart, Kiwify, Eduzz, and Stripe. Every sale is automatically captured via webhook.", "Vista consolidada de las ventas en tiempo real — Hotmart, Kiwify, Eduzz y Stripe. Cada venta se captura automáticamente mediante webhook.")}
        variant="banner"
        steps={[
          t("Conecte sua plataforma de pagamento em Integrações", "Connect your payment platform in Integrations", "Conecta tu plataforma de pagos en Integraciones"),
          t("Cada venda é capturada via webhook e aparece aqui em segundos", "Every sale is captured via webhook and appears here within seconds", "Cada venta se captura mediante webhook y aparece aquí en segundos"),
          t("Analise a evolução por período (7d / 30d / 90d) e exporte para CSV", "Review trends by period (7d / 30d / 90d) and export to CSV", "Analiza la evolución por período (7d / 30d / 90d) y exporta a CSV"),
          t("O score de saúde e o relatório semanal são gerados automaticamente toda segunda-feira", "The health score and weekly report are generated automatically every Monday", "La puntuación de salud y el informe semanal se generan automáticamente cada lunes"),
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-0.5 border border-border/50 bg-card/40 p-1 w-full overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center
                ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
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
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">{t("Nenhuma receita registrada ainda", "No revenue recorded yet", "Aún no hay ingresos registrados")}</p>
              <p className="font-mono text-xs text-muted-foreground/50 max-w-xs mx-auto">{t("Configure os webhooks das suas plataformas de venda para começar a monitorar a receita em tempo real.", "Configure webhooks for your sales platforms to start monitoring revenue in real time.", "Configura los webhooks de tus plataformas de venta para empezar a supervisar los ingresos en tiempo real.")}</p>
              <Button onClick={() => setActiveTab("webhooks")} className="mt-4 rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
                <Link2 className="h-3.5 w-3.5" />{t("Configurar webhooks", "Configure webhooks", "Configurar webhooks")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t("Receita total", "Total revenue", "Ingresos totales"), value: `R$ ${(summaryData.total / 100).toLocaleString(intlLocale(locale), { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success border-success/20 bg-success/5" },
                  { label: t("Transações", "Transactions", "Transacciones"), value: String(summaryData.transactionCount), icon: CheckCircle2, color: "text-primary border-primary/20 bg-primary/5" },
                  { label: t("Ticket médio", "Average order", "Pedido promedio"), value: `R$ ${(summaryData.avgTicket / 100).toLocaleString(intlLocale(locale), { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" },
                  { label: t("Plataformas", "Platforms", "Plataformas"), value: String(Object.keys(summaryData.byPlatform).length), icon: Globe, color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5" },
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
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{t("Receita por plataforma", "Revenue by platform", "Ingresos por plataforma")}</div>
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
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("Nenhuma transação registrada", "No transactions recorded", "No hay transacciones registradas")}</p>
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
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground block">{t("Plataforma", "Platform", "Plataforma")}</label>
              <select value={webhookPlatform} onChange={e => setWebhookPlatform(e.target.value)}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createWebhookMutation.mutate()} disabled={createWebhookMutation.isPending}
                  className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
                  {createWebhookMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />{t("Salvando...", "Saving...", "Guardando...")}</> : <><Zap className="h-3 w-3" />{t("Configurar", "Configure", "Configurar")}</>}
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
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("Nenhum webhook configurado", "No webhooks configured", "No hay webhooks configurados")}</p>
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
