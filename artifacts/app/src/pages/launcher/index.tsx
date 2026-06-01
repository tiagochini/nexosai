import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Rocket, TrendingUp, Users, DollarSign, Zap, Bot, CheckCircle2,
  AlertCircle, Clock, ChevronRight, BarChart3, Activity, ShieldCheck,
  Loader2, ArrowRight, Eye, Video, Link2, RefreshCw, AlertTriangle,
  Target, MessageSquare, Mail, Layers, Star, Play, Calendar, Radio,
  Copy, Wifi,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCampaignSocket } from "@/lib/socket";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  title: string;
  status: string;
  track?: string;
  launchDate?: string;
  createdAt: string;
  intakeData?: Record<string, unknown>;
}

interface AgentEvent {
  type: string;
  agentRole?: string;
  status?: string;
  message?: string;
  timestamp?: number;
}

interface LiveSession {
  id: string;
  title: string;
  status: "scheduled" | "broadcast_ready" | "live" | "ended" | "error";
  streamUrl: string | null;
  streamKey: string | null;
  scheduledAt: string;
  firedAt: string | null;
}

interface SequenceSummary {
  id: string;
  name: string;
  status: string;
  model?: string;
  currentDayIndex?: number;
}

interface ContentPiece {
  id: string;
  platform: string;
  contentType: string;
  status: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Briefing", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando", awaiting_approval: "Aguardando Aprovação",
  approved: "Aprovado", executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};

const STATUS_COLOR: Record<string, string> = {
  live: "text-green-400 border-green-400/40 bg-green-400/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  generating: "text-purple-400 border-purple-400/40 bg-purple-400/10",
  analyzing: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  completed: "text-muted-foreground border-border/40",
};

const ACTIVE_STATUSES = ["live", "executing", "awaiting_approval", "strategy_ready", "generating", "analyzing", "approved"];

const AGENT_COLORS: Record<string, string> = {
  strategy: "text-cyan-400",
  copywriter: "text-yellow-400",
  compliance: "text-red-400",
  analytics: "text-blue-400",
  creative_director: "text-purple-400",
  launcher: "text-green-400",
};

const TRACK_LABELS: Record<string, string> = {
  six_digit: "6 Dígitos", eight_digit: "8 Dígitos", ten_digit: "10 Dígitos",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="border border-border/50 bg-card/40 p-4 relative overflow-hidden group hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 border flex items-center justify-center ${color.replace("text-", "border-").replace("400", "400/30").replace("muted-foreground", "border/50")} ${color.includes("green") ? "border-green-400/30 bg-green-400/5" : color.includes("primary") ? "border-primary/30 bg-primary/5" : color.includes("yellow") ? "border-yellow-400/30 bg-yellow-400/5" : color.includes("blue") ? "border-blue-400/30 bg-blue-400/5" : "border-border/30 bg-card/30"}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
      </div>
      <div className={`font-mono font-bold text-2xl mb-0.5 ${color}`}>{value}</div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">{sub}</div>}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border/30 to-transparent" />
    </div>
  );
}

function AgentEventRow({ event }: { event: AgentEvent }) {
  const colorClass = AGENT_COLORS[event.agentRole ?? ""] ?? "text-muted-foreground";
  const icon = event.status === "completed" ? <CheckCircle2 className="h-3 w-3 text-green-400" />
    : event.status === "error" ? <AlertCircle className="h-3 w-3 text-destructive" />
    : event.type === "thinking" ? <Loader2 className="h-3 w-3 text-primary animate-spin" />
    : <Bot className="h-3 w-3 text-primary" />;

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/20 last:border-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
          {event.agentRole ?? event.type}
        </span>
        {event.message && (
          <p className="font-mono text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{event.message}</p>
        )}
      </div>
      {event.timestamp && (
        <span className="font-mono text-[10px] text-muted-foreground/30 shrink-0">
          {new Date(event.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// ── Live Session Panel ─────────────────────────────────────────────────────────

function LiveSessionPanel({ campaignId }: { campaignId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [delay, setDelay] = useState(5);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["/api/live-launcher"],
    queryFn: () => customFetch<{ sessions: LiveSession[] }>("/api/live-launcher").catch(() => ({ sessions: [] as LiveSession[] })),
    refetchInterval: 15_000,
  });
  const sessions = data?.sessions ?? [];
  const activeSessions = sessions.filter(s => s.status !== "ended" && s.status !== "error");

  const scheduleMutation = useMutation({
    mutationFn: (body: object) => customFetch<{ session: LiveSession }>("/api/live-launcher/schedule", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      toast.success("Live agendada! Prepare sua plataforma de transmissão.");
      setTitle(""); setDelay(5); setOpen(false);
      void qc.invalidateQueries({ queryKey: ["/api/live-launcher"] });
    },
    onError: () => toast.error("Erro ao agendar live. Instagram conectado?"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/live-launcher/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Live cancelada."); void refetch(); },
    onError: () => toast.error("Erro ao cancelar."),
  });

  const copyKey = useCallback((key: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success("Stream key copiada!");
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const STATUS_LABEL: Record<LiveSession["status"], string> = {
    scheduled: "Agendada",
    broadcast_ready: "Pronta para transmitir",
    live: "AO VIVO",
    ended: "Encerrada",
    error: "Erro",
  };
  const STATUS_COLOR: Record<LiveSession["status"], string> = {
    scheduled: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    broadcast_ready: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    live: "text-green-400 border-green-400/30 bg-green-400/5",
    ended: "text-muted-foreground border-border/30 bg-card/20",
    error: "text-destructive border-destructive/30 bg-destructive/5",
  };

  return (
    <div className="border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-red-400" />Live Session
          {activeSessions.length > 0 && (
            <span className="h-4 w-4 flex items-center justify-center bg-red-500 text-white font-mono text-[9px] rounded-full">{activeSessions.length}</span>
          )}
        </h2>
        <Button size="sm" variant="ghost" className="h-6 px-2 font-mono text-[10px] uppercase tracking-widest" onClick={() => setOpen(!open)}>
          {open ? "Fechar" : "Agendar"}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border/30 pt-3">
          <Input
            className="h-8 font-mono text-[11px] bg-background/60 border-border/50 rounded-none"
            placeholder="Título da live..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">Aguardar</label>
            <Input
              type="number" min={0} max={480}
              className="h-8 font-mono text-[11px] bg-background/60 border-border/50 rounded-none w-20"
              value={delay}
              onChange={e => setDelay(Number(e.target.value))}
            />
            <span className="font-mono text-[10px] text-muted-foreground/50">min</span>
          </div>
          <Button
            size="sm"
            className="w-full font-mono uppercase tracking-widest rounded-none h-8 text-[11px] btn-weapon-primary gap-1.5"
            disabled={!title.trim() || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate({ title: title.trim(), delayMinutes: delay, campaignId })}
          >
            {scheduleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            Agendar Live
          </Button>
        </div>
      )}

      {activeSessions.length === 0 && !open && (
        <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">Nenhuma live agendada</p>
      )}

      <div className="space-y-2">
        {activeSessions.map(s => (
          <div key={s.id} className={`border p-2.5 space-y-1.5 ${STATUS_COLOR[s.status]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold truncate">{s.title}</span>
              <Badge className={`font-mono text-[9px] uppercase tracking-widest rounded-none border ${STATUS_COLOR[s.status]} px-1.5 py-0`}>
                {STATUS_COLOR[s.status].includes("green") && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse mr-1 inline-block" />}
                {STATUS_LABEL[s.status]}
              </Badge>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/50">
              {s.firedAt ? `Disparada ${new Date(s.firedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : `Agendada ${new Date(s.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            {s.streamKey && (
              <button
                onClick={() => copyKey(s.streamKey!)}
                className="flex items-center gap-1.5 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors"
              >
                <Copy className="h-2.5 w-2.5" />
                {copiedKey === s.streamKey ? "Copiada!" : "Copiar stream key"}
              </button>
            )}
            {s.status === "scheduled" && (
              <button
                onClick={() => cancelMutation.mutate(s.id)}
                className="font-mono text-[10px] text-destructive/60 hover:text-destructive transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Campaign Selector ──────────────────────────────────────────────────────────

function CampaignSelector({ campaigns, selected, onSelect }: {
  campaigns: Campaign[];
  selected: Campaign | null;
  onSelect: (c: Campaign) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {campaigns.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
            selected?.id === c.id
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
          }`}
        >
          {c.title}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LauncherDashboard() {
  const [, navigate] = useLocation();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [liveStats, setLiveStats] = useState<Record<string, number>>({});
  const [now, setNow] = useState(new Date());

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Campaigns list
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      return customFetch<{ campaigns: Campaign[] }>("/api/campaigns")
        .catch(() => ({ campaigns: [] as Campaign[] }));
    },
    refetchInterval: 30_000,
  });

  const campaigns = campaignsData?.campaigns ?? [];
  const activeCampaigns = campaigns.filter(c => ACTIVE_STATUSES.includes(c.status));

  // Auto-select first active campaign
  useEffect(() => {
    if (!selectedCampaign && activeCampaigns.length > 0) {
      setSelectedCampaign(activeCampaigns[0]!);
    }
  }, [activeCampaigns.length]);

  // Live stats for selected campaign
  useEffect(() => {
    if (!selectedCampaign) return;
    customFetch<Record<string, number>>(`/api/campaigns/${selectedCampaign.id}/live-stats`)
      .then(d => setLiveStats(d))
      .catch(() => undefined);
  }, [selectedCampaign?.id]);

  // Metrics for selected campaign
  const { data: metricsData } = useQuery({
    queryKey: ["/api/campaigns", selectedCampaign?.id, "metrics"],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      return customFetch<{ metrics?: { healthScore?: number; revenue?: number; roas?: number; cpl?: number } }>(`/api/campaigns/${selectedCampaign.id}/metrics`)
        .catch(() => null);
    },
    enabled: !!selectedCampaign,
    refetchInterval: 60_000,
  });

  // Sequences linked to campaign
  const { data: sequencesData } = useQuery({
    queryKey: ["/api/launch-sequences", "campaign", selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      return customFetch<{ sequences: SequenceSummary[] }>(`/api/launch-sequences?campaignId=${selectedCampaign.id}`)
        .catch(() => null);
    },
    enabled: !!selectedCampaign,
  });

  // Content pieces (for pending approvals)
  const { data: contentData } = useQuery({
    queryKey: ["/api/campaigns", selectedCampaign?.id, "content"],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      return customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${selectedCampaign.id}/content`)
        .catch(() => null);
    },
    enabled: !!selectedCampaign,
  });

  // Agent events via Socket.io
  useCampaignSocket(
    selectedCampaign?.id ?? undefined,
    (event) => {
      const ev = event as unknown as Record<string, unknown>;
      setAgentEvents(prev => [{
        type: ev["type"] as string ?? "event",
        agentRole: ev["agentRole"] as string | undefined,
        status: ev["status"] as string | undefined,
        message: ev["message"] as string | undefined,
        timestamp: Date.now(),
      }, ...prev].slice(0, 20));
    },
    !!selectedCampaign && ACTIVE_STATUSES.includes(selectedCampaign.status),
  );

  const sequences = sequencesData?.sequences ?? [];
  const pieces = contentData?.pieces ?? [];
  const pendingApproval = pieces.filter(p => p.status === "generated" || p.status === "concept_ready");
  const metrics = metricsData?.metrics;
  const healthScore = metrics?.healthScore ?? 0;
  const healthColor = healthScore >= 70 ? "text-green-400" : healthScore >= 40 ? "text-yellow-400" : "text-destructive";

  // Countdown to launch date
  const launchDate = selectedCampaign?.launchDate ? new Date(selectedCampaign.launchDate) : null;
  const daysToLaunch = launchDate ? Math.ceil((launchDate.getTime() - now.getTime()) / 86_400_000) : null;

  if (campaignsLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 bg-muted/20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground/50">Painel de Controle</p>
          </div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
            Dashboard do Lançador
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-widest">
            Visão completa em tempo real · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/campaigns/new">
            <Button size="sm" className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
              <Rocket className="h-3.5 w-3.5" />Novo Lançamento
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Campaign Selector ── */}
      {activeCampaigns.length > 1 && (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">Lançamento ativo</p>
          <CampaignSelector campaigns={activeCampaigns} selected={selectedCampaign} onSelect={setSelectedCampaign} />
        </div>
      )}

      {/* ── No active campaigns ── */}
      {activeCampaigns.length === 0 && (
        <div className="py-20 border border-border/40 bg-card/30 flex flex-col items-center text-center">
          <Rocket className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground mb-2">Nenhum lançamento ativo</p>
          <p className="font-mono text-xs text-muted-foreground/50 mb-6">Crie sua primeira campanha para ativar o cockpit de lançamento</p>
          <Link href="/campaigns/new">
            <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-6 text-xs">
              <Rocket className="h-3.5 w-3.5" />Iniciar Lançamento
            </Button>
          </Link>
        </div>
      )}

      {selectedCampaign && (
        <>
          {/* ── Campaign Status Bar ── */}
          <div className="border border-border/50 bg-card/40 px-5 py-3.5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold text-sm uppercase tracking-wide truncate">{selectedCampaign.title}</span>
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${STATUS_COLOR[selectedCampaign.status] ?? "border-border/40 text-muted-foreground"}`}>
                  {STATUS_LABEL[selectedCampaign.status] ?? selectedCampaign.status}
                </Badge>
                {selectedCampaign.track && (
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-primary/30 text-primary">
                    {TRACK_LABELS[selectedCampaign.track] ?? selectedCampaign.track}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              {daysToLaunch !== null && daysToLaunch >= 0 && (
                <div className="text-right">
                  <div className="font-mono text-lg font-bold text-primary">{daysToLaunch}d</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">para abertura</div>
                </div>
              )}
              {daysToLaunch !== null && daysToLaunch < 0 && (
                <div className="text-right">
                  <div className="font-mono text-lg font-bold text-green-400">ABERTO</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">carrinho ao vivo</div>
                </div>
              )}
              <Link href={`/campaigns/${selectedCampaign.id}`}>
                <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest gap-1 text-muted-foreground hover:text-foreground h-8 px-3">
                  Ver Campanha <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Leads Capturados"
              value={liveStats["totalLeads"]?.toLocaleString("pt-BR") ?? "—"}
              sub={liveStats["leadsLast24h"] ? `+${liveStats["leadsLast24h"]} nas últimas 24h` : undefined}
              icon={Users}
              color="text-primary"
            />
            <KpiCard
              label="Vendas"
              value={liveStats["totalSales"]?.toLocaleString("pt-BR") ?? "—"}
              sub={metrics?.roas ? `ROAS ${metrics.roas.toFixed(1)}×` : undefined}
              icon={Star}
              color="text-green-400"
            />
            <KpiCard
              label="Receita Total"
              value={liveStats["totalRevenueBrl"]
                ? `R$ ${Number(liveStats["totalRevenueBrl"]).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
                : "R$ —"}
              sub={liveStats["revenueBrlLast24h"] ? `+R$ ${Number(liveStats["revenueBrlLast24h"]).toLocaleString("pt-BR")} hoje` : undefined}
              icon={DollarSign}
              color="text-yellow-400"
            />
            <KpiCard
              label="Saúde do Lançamento"
              value={healthScore > 0 ? `${healthScore}/100` : "—"}
              sub={metrics?.cpl ? `CPL R$ ${metrics.cpl.toFixed(2)}` : undefined}
              icon={Activity}
              color={healthColor}
            />
          </div>

          {/* ── Main 2-col layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT COL (2/3) */}
            <div className="lg:col-span-2 space-y-4">

              {/* Sequências ativas */}
              <div className="border border-border/50 bg-card/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-primary" />Sequências de Disparo
                  </h2>
                  <Link href="/sequences">
                    <button className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1">
                      Ver todas <ArrowRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
                {sequences.length === 0 ? (
                  <p className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest py-4 text-center">
                    Nenhuma sequência vinculada a esta campanha
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sequences.slice(0, 4).map(seq => (
                      <div key={seq.id} className="flex items-center gap-3 border border-border/30 bg-card/20 px-3 py-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          seq.status === "active" ? "bg-green-400 animate-pulse" :
                          seq.status === "draft" ? "bg-muted-foreground/40" : "bg-muted-foreground/20"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] font-bold uppercase tracking-wide truncate">{seq.name}</p>
                          {seq.model && <p className="font-mono text-[10px] text-muted-foreground/50">{seq.model}</p>}
                        </div>
                        <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 shrink-0 ${
                          seq.status === "active" ? "text-green-400 border-green-400/40" : "text-muted-foreground border-border/30"
                        }`}>
                          {seq.status === "active" ? `Dia ${(seq.currentDayIndex ?? 0) + 1}` : seq.status}
                        </Badge>
                        <Link href={`/sequences/${seq.id}/today`}>
                          <button className="text-muted-foreground/40 hover:text-primary transition-colors">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Criativos pendentes */}
              <div className="border border-border/50 bg-card/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-yellow-400" />Aprovações Pendentes
                    {pendingApproval.length > 0 && (
                      <span className="bg-yellow-400/20 text-yellow-400 font-mono text-[10px] px-1.5 py-0.5 border border-yellow-400/30">
                        {pendingApproval.length}
                      </span>
                    )}
                  </h2>
                  <Link href={`/campaigns/${selectedCampaign.id}/content`}>
                    <button className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1">
                      Revisar <ArrowRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
                {pendingApproval.length === 0 ? (
                  <div className="flex items-center gap-2 py-3">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                      Todos os criativos aprovados
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pendingApproval.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
                        <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" />
                        <span className="font-mono text-[11px] uppercase tracking-wide flex-1 truncate">{p.platform} — {p.contentType}</span>
                        <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1.5 py-0 border-yellow-400/30 text-yellow-400">{p.status}</Badge>
                      </div>
                    ))}
                    {pendingApproval.length > 5 && (
                      <p className="font-mono text-[10px] text-muted-foreground/50 text-center pt-1">
                        +{pendingApproval.length - 5} mais aguardando aprovação
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="border border-border/50 bg-card/40 p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                  <Zap className="h-3.5 w-3.5 text-primary" />Ações Rápidas
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Ver Campanha", href: `/campaigns/${selectedCampaign.id}`, icon: Rocket },
                    { label: "Aprovar Conteúdo", href: `/campaigns/${selectedCampaign.id}/content`, icon: CheckCircle2 },
                    { label: "Ver Criativos", href: `/campaigns/${selectedCampaign.id}/creatives`, icon: Eye },
                    { label: "Criar VSL", href: `/vsls?campaignId=${selectedCampaign.id}&from=campaign`, icon: Video },
                    { label: "Atendimento", href: "/atendimento", icon: MessageSquare },
                    { label: "Ver Métricas", href: `/revenue`, icon: BarChart3 },
                  ].map(action => (
                    <Link key={action.href} href={action.href}>
                      <button className="w-full flex items-center gap-2 border border-border/30 bg-card/20 px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors group">
                        <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors truncate">
                          {action.label}
                        </span>
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COL (1/3) */}
            <div className="space-y-4">
              {/* Live Agent Feed */}
              <div className="border border-border/50 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <h2 className="font-mono text-xs font-bold uppercase tracking-widest">Agentes em Tempo Real</h2>
                </div>
                {agentEvents.length === 0 ? (
                  <div className="py-6 text-center">
                    <Bot className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                      {ACTIVE_STATUSES.includes(selectedCampaign.status)
                        ? "Aguardando eventos dos agentes..."
                        : "Ative a campanha para ver eventos"}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-border/30">
                    {agentEvents.map((ev, i) => <AgentEventRow key={i} event={ev} />)}
                  </div>
                )}
                {ACTIVE_STATUSES.includes(selectedCampaign.status) && (
                  <Link href={`/campaigns/${selectedCampaign.id}`}>
                    <button className="w-full mt-3 font-mono text-[10px] uppercase tracking-widest border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors py-2 flex items-center justify-center gap-1.5">
                      <Play className="h-3 w-3" />Ver Feed Completo
                    </button>
                  </Link>
                )}
              </div>

              {/* Health Score */}
              <div className="border border-border/50 bg-card/40 p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />Saúde do Lançamento
                </h2>
                {healthScore > 0 ? (
                  <>
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
                        <circle
                          cx="50" cy="50" r="38" fill="none" strokeWidth="8"
                          stroke={healthScore >= 70 ? "#4ade80" : healthScore >= 40 ? "#facc15" : "#ef4444"}
                          strokeDasharray={`${(healthScore / 100) * 239} 239`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-mono font-bold text-xl ${healthColor}`}>{healthScore}</span>
                        <span className="font-mono text-[9px] text-muted-foreground/50 uppercase">/100</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Receita", value: metrics?.revenue ? `R$ ${Number(metrics.revenue).toLocaleString("pt-BR")}` : "—" },
                        { label: "ROAS", value: metrics?.roas ? `${metrics.roas.toFixed(1)}×` : "—" },
                        { label: "CPL", value: metrics?.cpl ? `R$ ${Number(metrics.cpl).toFixed(2)}` : "—" },
                        { label: "Engaj.", value: liveStats["engagementEventsLast24h"] ? `${liveStats["engagementEventsLast24h"]}` : "—" },
                      ].map(m => (
                        <div key={m.label} className="border border-border/30 bg-card/20 p-2 text-center">
                          <div className="font-mono text-xs font-bold text-foreground">{m.value}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center py-4">
                    Métricas disponíveis após lançamento
                  </p>
                )}
              </div>

              {/* Live Session */}
              <LiveSessionPanel campaignId={selectedCampaign.id} />

              {/* Status Checklist */}
              <div className="border border-border/50 bg-card/40 p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                  <Target className="h-3.5 w-3.5 text-primary" />Checklist de Lançamento
                </h2>
                <div className="space-y-2">
                  {[
                    { label: "Briefing completo", done: !["draft", "intake"].includes(selectedCampaign.status) },
                    { label: "Estratégia gerada", done: !["draft", "intake", "analyzing"].includes(selectedCampaign.status) },
                    { label: "Conteúdo gerado", done: !["draft", "intake", "analyzing", "strategy_ready"].includes(selectedCampaign.status) },
                    { label: "Criativos aprovados", done: pendingApproval.length === 0 && pieces.length > 0 },
                    { label: "Sequência configurada", done: sequences.length > 0 },
                    { label: "Sequência ativa", done: sequences.some(s => s.status === "active") },
                    { label: "Carrinho ao vivo", done: ["live", "executing"].includes(selectedCampaign.status) },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      {item.done
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        : <div className="h-3.5 w-3.5 border border-border/50 shrink-0" />}
                      <span className={`font-mono text-[11px] uppercase tracking-wide ${item.done ? "text-foreground" : "text-muted-foreground/50"}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
