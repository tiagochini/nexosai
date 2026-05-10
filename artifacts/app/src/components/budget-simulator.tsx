import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Users, ShoppingCart, DollarSign, Info, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScenarioValues { low: number; mid: number; high: number }

interface PlatformSim {
  platform: string;
  label: string;
  icon: string;
  color: string;
  budgetAllocation: number;
  budgetPct: number;
  impressions: ScenarioValues;
  reach: ScenarioValues;
  leads: ScenarioValues;
  sales: ScenarioValues;
  revenue: ScenarioValues;
  cpl: ScenarioValues;
  cpa: ScenarioValues;
  roas: ScenarioValues;
  notes: string;
}

interface BudgetSimulation {
  budget: number;
  productPrice: number;
  campaignType: string;
  productCategory: string;
  totalImpressions: ScenarioValues;
  totalReach: ScenarioValues;
  totalLeads: ScenarioValues;
  totalSales: ScenarioValues;
  totalRevenue: ScenarioValues;
  totalRoi: ScenarioValues;
  totalRoas: ScenarioValues;
  breakEvenSales: number;
  breakEvenCpa: number;
  platforms: PlatformSim[];
  allocationRecommendation: { platform: string; pct: number; label: string }[];
  benchmarkNote: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type Scenario = "low" | "mid" | "high";

const fmtBRL = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `R$ ${(v / 1_000).toFixed(0)}k`
    : `R$ ${v.toLocaleString("pt-BR")}`;

const fmtNum = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `${(v / 1_000).toFixed(0)}k`
    : `${v.toLocaleString("pt-BR")}`;

const roiColor = (roi: number) =>
  roi >= 200 ? "text-emerald-400" : roi >= 50 ? "text-cyan-400" : roi >= 0 ? "text-yellow-400" : "text-red-400";

const roasColor = (roas: number) =>
  roas >= 3 ? "text-emerald-400" : roas >= 1.5 ? "text-cyan-400" : roas >= 1 ? "text-yellow-400" : "text-red-400";

const SCENARIO_LABELS: Record<Scenario, { label: string; sub: string; dot: string }> = {
  low: { label: "Pessimista",  sub: "CPL alto, conversão baixa",   dot: "bg-yellow-500" },
  mid: { label: "Realista",    sub: "Benchmarks médios do mercado", dot: "bg-cyan-400" },
  high:{ label: "Otimista",   sub: "Criativos fortes, alta conversão", dot: "bg-emerald-400" },
};

const PLATFORM_COLORS: Record<string, string> = {
  meta_ads:    "#1877F2",
  google_ads:  "#4285F4",
  tiktok_ads:  "#fe2c55",
  youtube_ads: "#FF0000",
};

const PLATFORM_BG: Record<string, string> = {
  meta_ads:    "border-blue-500/30 bg-blue-500/5",
  google_ads:  "border-indigo-500/30 bg-indigo-500/5",
  tiktok_ads:  "border-rose-500/30 bg-rose-500/5",
  youtube_ads: "border-red-500/30 bg-red-500/5",
};

// ── Mini stat cell ─────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <span className="font-mono text-sm font-bold text-foreground">{value}</span>
      {sub && <span className="font-mono text-[10px] text-muted-foreground/40">{sub}</span>}
    </div>
  );
}

// ── Budget bar (allocation visual) ─────────────────────────────────────────────

function AllocationBar({ platforms }: { platforms: PlatformSim[] }) {
  const total = platforms.reduce((s, p) => s + p.budgetPct, 0);
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
        Distribuição recomendada do budget
      </div>
      <div className="flex h-3 rounded-none overflow-hidden gap-px">
        {platforms.map((p) => (
          <div
            key={p.platform}
            style={{ width: `${(p.budgetPct / total) * 100}%`, backgroundColor: PLATFORM_COLORS[p.platform] ?? "#888" }}
            title={`${p.label}: ${p.budgetPct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-1">
        {platforms.map((p) => (
          <div key={p.platform} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-none shrink-0" style={{ backgroundColor: PLATFORM_COLORS[p.platform] ?? "#888" }} />
            <span className="font-mono text-[10px] text-muted-foreground/70">{p.label} {p.budgetPct}%</span>
            <span className="font-mono text-[10px] text-primary/60 font-bold">{fmtBRL(p.budgetAllocation)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Platform card ──────────────────────────────────────────────────────────────

function PlatformCard({ p, scenario }: { p: PlatformSim; scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const roas = p.roas[scenario];
  return (
    <div className={`border ${PLATFORM_BG[p.platform] ?? "border-border/30 bg-card/20"} relative`}>
      <button
        className="w-full p-3 text-left flex items-center justify-between gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{p.icon}</span>
          <div>
            <div className="font-mono text-xs font-bold text-foreground">{p.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50">{fmtBRL(p.budgetAllocation)} · {p.budgetPct}% do budget</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-[10px] text-muted-foreground/50">ROAS</div>
            <div className={`font-mono text-sm font-bold ${roasColor(roas)}`}>{roas.toFixed(1)}x</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground/50">Leads</div>
            <div className="font-mono text-sm font-bold text-primary">{fmtNum(p.leads[scenario])}</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-mono text-[10px] text-muted-foreground/50">Vendas</div>
            <div className="font-mono text-sm font-bold text-foreground">{p.sales[scenario]}</div>
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/20 p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 animate-in slide-in-from-top-1 duration-150">
          <Stat label="Impressões"  value={fmtNum(p.impressions[scenario])} />
          <Stat label="Alcance"     value={fmtNum(p.reach[scenario])} />
          <Stat label="Leads"       value={fmtNum(p.leads[scenario])} />
          <Stat label="CPL"         value={fmtBRL(Math.round(p.cpl[scenario]))} sub="custo por lead" />
          <Stat label="Vendas"      value={`${p.sales[scenario]}`} />
          <Stat label="CPA"         value={p.cpa[scenario] > 0 ? fmtBRL(p.cpa[scenario]) : "–"} sub="custo por venda" />
          <div className="col-span-full">
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-1 leading-relaxed">{p.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary KPI card ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="border border-border/30 bg-card/30 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color ?? "text-muted-foreground/50"}`} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{label}</span>
      </div>
      <div className={`font-mono text-lg font-bold ${color ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground/40">{sub}</div>}
    </div>
  );
}

// ── Break-even strip ───────────────────────────────────────────────────────────

function BreakEven({ sim }: { sim: BudgetSimulation }) {
  return (
    <div className="border border-border/30 bg-card/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">Ponto de equilíbrio</div>
        <div className="font-mono text-sm text-foreground">
          Você precisa de <span className="text-primary font-bold">{sim.breakEvenSales} vendas</span> para cobrir o investimento
          <span className="text-muted-foreground/50 ml-1">(CPA máx. {fmtBRL(sim.breakEvenCpa)})</span>
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0">
        {sim.totalSales.mid >= sim.breakEvenSales
          ? <span className="text-emerald-400">✓ Cenário realista supera o break-even</span>
          : <span className="text-yellow-400">⚠ Cenário realista abaixo do break-even — otimize criativos</span>}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BudgetSimulator({
  campaignId,
  budget,
  productPrice,
  campaignType,
  productCategory,
}: {
  campaignId: string;
  budget: number;
  productPrice: number;
  campaignType?: string;
  productCategory?: string;
}) {
  const [sim, setSim] = useState<BudgetSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("mid");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await customFetch<{ simulation: BudgetSimulation }>(
        `/api/intake/${campaignId}/simulate-budget`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget, productPrice, campaignType, productCategory }),
        }
      );
      setSim(res.simulation);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [budget, productPrice, campaignType, productCategory]);

  if (loading) {
    return (
      <div className="border border-primary/20 bg-card/30 p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Calculando simulação com benchmarks reais...
        </span>
      </div>
    );
  }

  if (error || !sim) {
    return (
      <div className="border border-border/30 bg-card/20 p-4 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">Não foi possível carregar a simulação.</span>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="font-mono text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" />Tentar novamente
        </Button>
      </div>
    );
  }

  const s = scenario;

  return (
    <div className="border border-primary/25 bg-card/20 rounded-none overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Simulação de Alcance e Retorno
            </span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
            Budget: <span className="text-foreground font-bold">{fmtBRL(sim.budget)}</span>
            &nbsp;·&nbsp; Ticket: <span className="text-foreground font-bold">{fmtBRL(sim.productPrice)}</span>
            &nbsp;·&nbsp; Dados reais Q1 2025
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="font-mono text-[10px] uppercase tracking-widest gap-1.5 text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <RefreshCw className="h-3 w-3" />Atualizar
        </Button>
      </div>

      <div className="p-4 space-y-5">
        {/* Scenario tabs */}
        <Tabs value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
          <TabsList className="rounded-none bg-muted/20 border border-border/30 h-auto p-0.5 gap-0.5">
            {(["low", "mid", "high"] as Scenario[]).map((sc) => {
              const meta = SCENARIO_LABELS[sc];
              return (
                <TabsTrigger
                  key={sc}
                  value={sc}
                  className="rounded-none font-mono text-[10px] uppercase tracking-widest px-3 py-2 flex flex-col gap-0.5 items-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 data-[state=active]:text-primary-foreground/70 hidden sm:block">
                    {meta.sub}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(["low", "mid", "high"] as Scenario[]).map((sc) => (
            <TabsContent key={sc} value={sc} className="mt-4 space-y-4">
              {/* KPI summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCard
                  icon={Users}
                  label="Alcance total"
                  value={fmtNum(sim.totalReach[sc])}
                  sub="pessoas únicas impactadas"
                  color="text-blue-400"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Leads gerados"
                  value={fmtNum(sim.totalLeads[sc])}
                  sub="contatos capturados"
                  color="text-cyan-400"
                />
                <KpiCard
                  icon={ShoppingCart}
                  label="Vendas estimadas"
                  value={`${sim.totalSales[sc]}`}
                  sub={`CPA médio ${fmtBRL(sim.totalSales[sc] > 0 ? Math.round(sim.budget / sim.totalSales[sc]) : 0)}`}
                  color="text-primary"
                />
                <KpiCard
                  icon={DollarSign}
                  label="Faturamento"
                  value={fmtBRL(sim.totalRevenue[sc])}
                  sub={`ROAS ${sim.totalRoas[sc].toFixed(1)}x · ROI ${sim.totalRoi[sc] > 0 ? "+" : ""}${sim.totalRoi[sc]}%`}
                  color={roiColor(sim.totalRoi[sc])}
                />
              </div>

              {/* Budget allocation */}
              <AllocationBar platforms={sim.platforms} />

              {/* Platform breakdown */}
              <div className="space-y-1.5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
                  Detalhamento por plataforma — clique para expandir
                </div>
                {sim.platforms.map((p) => (
                  <PlatformCard key={p.platform} p={p} scenario={sc} />
                ))}
              </div>

              {/* Break-even */}
              <BreakEven sim={sim} />
            </TabsContent>
          ))}
        </Tabs>

        {/* Benchmark note */}
        <div className="flex gap-2 border border-border/20 bg-muted/10 p-2.5">
          <Info className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
            {sim.benchmarkNote}
          </p>
        </div>
      </div>
    </div>
  );
}
