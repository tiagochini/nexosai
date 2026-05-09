import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, Plus, Link2, Loader2, CheckCircle2, Globe, Zap,
} from "lucide-react";

interface RevenueSummary { total: number; byPlatform: Record<string, number>; transactionCount: number; avgTicket: number; }
interface RevenueEvent { id: string; platform: string; eventType: string; amountBrl: string; productName?: string; customerEmail?: string; createdAt: string; }
interface WebhookConfig { id: string; platform: string; endpointUrl?: string; isActive: boolean; }

const PLATFORM_LABEL: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", eduzz: "Eduzz", monetizze: "Monetizze",
  stripe: "Stripe", pagarme: "Pagar.me", asaas: "Asaas", custom: "Custom",
};
const PLATFORM_COLOR: Record<string, string> = {
  hotmart: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  kiwify: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  stripe: "text-purple-400 border-purple-400/40 bg-purple-400/10",
  eduzz: "text-green-400 border-green-400/40 bg-green-400/10",
};
const EVENT_LABEL: Record<string, string> = {
  sale: "Venda", refund: "Reembolso", subscription: "Assinatura", chargeback: "Chargeback",
};

export default function RevenuePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "webhooks">("overview");
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
    queryKey: ["/api/revenue/events"],
    enabled: activeTab === "events",
    queryFn: async () => {
      const res = await customFetch<Response>("/api/revenue/events?limit=30");
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
      if (!res.ok) throw new Error("Erro ao criar webhook");
    },
    onSuccess: () => {
      toast.success("Webhook configurado. Copie a URL e configure na plataforma.");
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/webhook-configs"] });
      setAddingWebhook(false);
    },
    onError: () => toast.error("Erro ao configurar webhook"),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Receita & Vendas</h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Integre Hotmart, Kiwify, Eduzz e outras plataformas · Receita em tempo real
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm w-fit overflow-x-auto">
        {[{ id: "overview" as const, label: "Resumo" }, { id: "events" as const, label: "Transações" }, { id: "webhooks" as const, label: "Webhooks" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all rounded-sm whitespace-nowrap shrink-0
              ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {summaryLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : !summaryData || summaryData.total === 0 ? (
            <div className="py-16 text-center">
              <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Nenhuma receita registrada ainda</p>
              <p className="font-mono text-[10px] text-muted-foreground/50">Configure os webhooks das suas plataformas de venda para começar a monitorar receita em tempo real</p>
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
                    <div className="flex items-center gap-2 mb-2"><kpi.icon className="h-3.5 w-3.5" /><span className="text-[9px] font-mono uppercase tracking-widest opacity-70">{kpi.label}</span></div>
                    <div className="font-mono font-bold text-xl">{kpi.value}</div>
                  </div>
                ))}
              </div>
              <div className="border border-border/50 bg-card/40 p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Por Plataforma</div>
                <div className="space-y-2">
                  {Object.entries(summaryData.byPlatform).map(([platform, amount]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${PLATFORM_COLOR[platform] ?? "border-border/50 text-muted-foreground"}`}>{PLATFORM_LABEL[platform] ?? platform}</Badge>
                      </div>
                      <span className="font-mono text-sm text-success font-bold">R$ {(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Events ── */}
      {activeTab === "events" && (
        <div className="space-y-3">
          {eventsLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : (eventsData?.events ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhuma transação registrada</p>
            </div>
          ) : (
            (eventsData?.events ?? []).map(event => (
              <div key={event.id} className="border border-border/50 bg-card/40 px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 shrink-0 ${PLATFORM_COLOR[event.platform] ?? "border-border/50 text-muted-foreground"}`}>{PLATFORM_LABEL[event.platform] ?? event.platform}</Badge>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 shrink-0 ${event.eventType === "sale" ? "text-success border-success/40 bg-success/5" : "text-destructive border-destructive/40 bg-destructive/5"}`}>{EVENT_LABEL[event.eventType] ?? event.eventType}</Badge>
                  <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{event.productName ?? event.customerEmail ?? "—"}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`font-mono font-bold text-sm ${event.eventType === "sale" ? "text-success" : "text-destructive"}`}>
                    {event.eventType === "refund" ? "-" : "+"}R$ {Number(event.amountBrl).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/60">{new Date(event.createdAt).toLocaleDateString("pt-BR")}</span>
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
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Configure webhooks para receber eventos de venda em tempo real</p>
            <Button size="sm" onClick={() => setAddingWebhook(true)} className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-[10px]">
              <Plus className="h-3.5 w-3.5" />Adicionar
            </Button>
          </div>

          {addingWebhook && (
            <div className="border border-primary/30 bg-card/40 p-4 space-y-3">
              <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">Plataforma</label>
              <select value={webhookPlatform} onChange={e => setWebhookPlatform(e.target.value)}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createWebhookMutation.mutate()} disabled={createWebhookMutation.isPending}
                  className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-[10px]">
                  {createWebhookMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Salvando...</> : <><Zap className="h-3 w-3" />Configurar</>}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingWebhook(false)} className="font-mono uppercase tracking-widest rounded-none h-9 px-4 text-[10px] text-muted-foreground">Cancelar</Button>
              </div>
            </div>
          )}

          {webhooksLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : (webhooksData?.configs ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <Link2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhum webhook configurado</p>
            </div>
          ) : (
            (webhooksData?.configs ?? []).map(config => (
              <div key={config.id} className="border border-border/50 bg-card/40 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${PLATFORM_COLOR[config.platform] ?? "border-border/50"}`}>{PLATFORM_LABEL[config.platform] ?? config.platform}</Badge>
                  {config.endpointUrl && <code className="text-[9px] font-mono text-muted-foreground/70 bg-muted/20 px-2 py-1">{config.endpointUrl}</code>}
                </div>
                <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${config.isActive ? "text-success border-success/40 bg-success/10" : "text-muted-foreground border-border/50"}`}>
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
