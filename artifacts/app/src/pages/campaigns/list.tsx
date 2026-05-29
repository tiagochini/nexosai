import { useState } from "react";
import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Plus, Rocket, ChevronRight, Clock, CheckCircle2,
  Loader2, Play, Search, Filter, Zap, TrendingUp, BarChart3,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Intake", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando",
  awaiting_approval: "Aprovação", approved: "Aprovado",
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
const STATUS_ICON: Record<string, React.ElementType> = {
  live: Play, executing: Loader2, generating: Loader2, analyzing: Loader2,
  awaiting_approval: Clock, approved: CheckCircle2, strategy_ready: CheckCircle2,
  completed: CheckCircle2, draft: Clock, intake: Loader2,
};
const TYPE_LABEL: Record<string, string> = {
  launch: "Lançamento", perpetual_launch: "Perpétuo", flash_sale: "Flash Sale",
  live_sale: "Live Sale", continuous_sales: "Contínuo", subscription_growth: "Assinatura",
  authority: "Autoridade", audience_growth: "Crescimento", affiliate: "Afiliado",
  branding: "Branding", upsell: "Upsell", remarketing: "Remarketing", scale: "Escala",
};
const TRACK_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  six_digits:    { label: "6 Díg",  color: "text-blue-400 border-blue-400/30 bg-blue-400/8",   icon: Rocket    },
  eight_digits:  { label: "8 Díg",  color: "text-purple-400 border-purple-400/30 bg-purple-400/8", icon: TrendingUp },
  ten_digits:    { label: "10 Díg", color: "text-red-400 border-red-400/30 bg-red-400/8",     icon: BarChart3 },
  not_applicable:{ label: "—",      color: "text-muted-foreground border-border/30 bg-muted/10", icon: Rocket  },
};

// Pipeline steps used for progress visualization
const PIPELINE_ORDER = [
  "draft", "intake", "analyzing", "strategy_ready",
  "generating", "awaiting_approval", "approved",
  "executing", "live", "completed",
];

function PipelineBar({ status }: { status: string }) {
  const idx     = PIPELINE_ORDER.indexOf(status);
  const total   = PIPELINE_ORDER.length;
  const pct     = total > 1 ? Math.round((idx / (total - 1)) * 100) : 0;
  const isLive  = status === "live";
  const isDone  = status === "completed";
  const barColor = isDone ? "hsl(var(--success))" : isLive ? "hsl(var(--success))" : "hsl(var(--primary))";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 4px ${barColor}` }}
        />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground/50 shrink-0 w-8 text-right">{pct}%</span>
    </div>
  );
}

type FilterStatus = "all" | "active" | "completed";

export default function CampaignsList() {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<FilterStatus>("all");

  const { data, isLoading } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey() },
  });

  const allCampaigns = data?.campaigns ?? [];

  const campaigns = allCampaigns.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"       ? true :
      filter === "active"    ? !["completed", "draft"].includes(c.status) :
      filter === "completed" ? c.status === "completed" : true;
    return matchSearch && matchFilter;
  });

  const active    = allCampaigns.filter(c => c.status === "live" || c.status === "executing").length;
  const inProcess = allCampaigns.filter(c => !["draft", "completed", "live", "executing"].includes(c.status)).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Missões
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              {allCampaigns.length} total
            </span>
            {active > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-success uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 5px hsl(var(--success))" }} />
                {active} ao vivo
              </span>
            )}
            {inProcess > 0 && (
              <span className="text-xs font-mono text-primary uppercase tracking-widest">
                {inProcess} em processo
              </span>
            )}
          </div>
        </div>
        <Link href="/campaigns/new">
          <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-5 text-xs shrink-0">
            <Plus className="h-3.5 w-3.5" />Nova Campanha
          </Button>
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar missões..."
            className="font-mono text-sm rounded-none border-border/50 bg-background/60 focus-visible:ring-primary focus-visible:border-primary h-9 pl-9"
          />
        </div>
        <div className="flex gap-1 border border-border/40 bg-card/30 p-0.5 rounded-sm">
          {(["all", "active", "completed"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-all rounded-sm ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Concluídas"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 bg-muted/20" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && campaigns.length === 0 && (
        search ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Rocket className="h-8 w-8 text-muted-foreground/20" />
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
              Nenhum resultado para &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <div className="border border-primary/20 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-transparent pointer-events-none" />

            <div className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row gap-8 items-start">
              {/* Left: headline + CTA */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-primary" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Pronto para começar</span>
                </div>
                <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tight text-foreground leading-tight">
                  Nenhum lançamento ainda.
                  <br />
                  <span className="text-primary">A equipe especializada está esperando por você.</span>
                </h2>
                <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-md">
                  Em menos de 3 minutos de briefing, a equipe monta o plano completo do seu lançamento — estratégia, copy, cronograma e execução automatizada.
                </p>
                <Link href="/campaigns/new">
                  <Button className="rounded-none font-mono uppercase tracking-widest font-bold gap-2 btn-weapon-primary h-11 px-7 mt-2 text-sm">
                    <Plus className="h-4 w-4" />
                    Criar meu primeiro lançamento
                    <TrendingUp className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Right: what happens */}
              <div className="shrink-0 w-full md:w-56 space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 mb-3">O que acontece agora:</p>
                {[
                  { num: "01", text: "Você escolhe seu objetivo" },
                  { num: "02", text: "A equipe faz um briefing rápido" },
                  { num: "03", text: "Plano estratégico gerado" },
                  { num: "04", text: "Conteúdo pronto para aprovar" },
                  { num: "05", text: "Campanha vai ao ar" },
                ].map(item => (
                  <div key={item.num} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-primary/40 tracking-widest w-5 shrink-0 font-bold">{item.num}</span>
                    <div className="flex-1 h-px bg-border/20" />
                    <span className="font-mono text-[11px] text-muted-foreground/60">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* Campaign cards */}
      {!isLoading && campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const StatusIcon = STATUS_ICON[campaign.status] ?? Rocket;
            const isAnimated = ["analyzing", "generating", "executing"].includes(campaign.status);
            const isLive = campaign.status === "live";
            const trackMeta = TRACK_META[campaign.track ?? "not_applicable"] ?? TRACK_META["not_applicable"]!;
            const TrackIcon = trackMeta.icon;

            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <div className="border border-border/40 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/60 transition-all group cursor-pointer relative overflow-hidden card-weapon">
                  {/* Live glow */}
                  {isLive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-success/3 to-transparent pointer-events-none" />
                  )}
                  {/* Left accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 transition-all ${
                    isLive ? "bg-success shadow-[0_0_8px_hsl(var(--success))]" :
                    campaign.status === "awaiting_approval" ? "bg-yellow-400" :
                    "bg-primary/30 group-hover:bg-primary/70"
                  }`} />

                  <div className="pl-4 pr-4 md:pr-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
                    {/* Status icon */}
                    <div className={`w-10 h-10 border flex items-center justify-center shrink-0 ${STATUS_COLOR[campaign.status] ?? "border-border text-muted-foreground"}`}>
                      <StatusIcon className={`h-4 w-4 ${isAnimated ? "animate-spin" : ""} ${isLive ? "animate-pulse" : ""}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Title row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors uppercase tracking-wide">
                          {campaign.title}
                        </span>
                        <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 border shrink-0 ${STATUS_COLOR[campaign.status] ?? ""}`}>
                          {STATUS_LABEL[campaign.status] ?? campaign.status}
                        </Badge>
                        {isLive && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-success uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-mono text-[11px] px-2 py-0.5 border ${trackMeta.color} flex items-center gap-1`}>
                          <TrackIcon className="h-2.5 w-2.5" />
                          {trackMeta.label}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                          {TYPE_LABEL[campaign.type] ?? campaign.type}
                        </span>
                        {campaign.revenueTarget && (
                          <span className="font-mono text-[11px] text-success/80">
                            Meta R$ {Number(campaign.revenueTarget).toLocaleString("pt-BR")}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground/40">
                          {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—"}
                        </span>
                      </div>

                      {/* Pipeline progress */}
                      <PipelineBar status={campaign.status} />
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 hidden md:flex items-center gap-2">
                      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                        {campaign.status === "draft" || campaign.status === "intake" ? "Continuar Intake" :
                         campaign.status === "awaiting_approval" ? "Revisar" : "Ver Missão"}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom CTA when there are campaigns */}
      {!isLoading && allCampaigns.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link href="/campaigns/new">
            <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2">
              <Plus className="h-3 w-3" />Iniciar Nova Missão
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
