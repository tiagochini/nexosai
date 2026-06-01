import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Loader2, TrendingUp,
  Users, ShoppingCart, DollarSign, Bot, Zap, Target,
  BrainCircuit, FileText, Layers, BarChart2, Activity,
  ChevronDown, ChevronUp, Play, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioValues { low: number; mid: number; high: number }
interface PlatformSim {
  platform: string; label: string; icon: string;
  budgetAllocation: number; budgetPct: number;
  leads: ScenarioValues; sales: ScenarioValues;
  revenue: ScenarioValues; roas: ScenarioValues; cpl: ScenarioValues;
}
interface BudgetSimulation {
  budget: number; productPrice: number;
  totalLeads: ScenarioValues; totalSales: ScenarioValues;
  totalRevenue: ScenarioValues; totalRoas: ScenarioValues; totalRoi: ScenarioValues;
  breakEvenSales: number; breakEvenCpa: number;
  platforms: PlatformSim[];
  benchmarkNote: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)}k`
  : `R$ ${v.toLocaleString("pt-BR")}`;

const fmtNum = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
  : `${v.toLocaleString("pt-BR")}`;

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A: LIVE DEMO — Agent Activity Feed
// Shows the exact same UI the user will see inside the app
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_SEQUENCE = [
  { role: "command",         label: "Comandante",        status: "running",   msg: "Analisando estrutura do lançamento. Detectando tipo: PLF — Fórmula de Lançamento.", delay: 0 },
  { role: "strategy",        label: "Estrategista",         status: "running",   msg: "Mapeando mercado. Ticket R$1.997. Audiência: empreendedores 28–45. Track: 6 dígitos.", delay: 1800 },
  { role: "strategy",        label: "Estrategista",         status: "done",      msg: "Plano de 7 dias gerado. 4 fases: pré-lançamento, abertura, carrinho, escassez.", delay: 4200 },
  { role: "offer",           label: "Especialista em Oferta", status: "running", msg: "Analisando posicionamento de preço vs concorrência. Calculando percepção de valor.", delay: 5500 },
  { role: "copywriter",      label: "Copywriter",           status: "running",   msg: "Gerando copy de página de vendas. Aplicando gatilho de escassez e autoridade.", delay: 6800 },
  { role: "offer",           label: "Especialista em Oferta", status: "done",    msg: "Oferta estruturada. Bônus recomendados: 3. Garantia: 7 dias. Âncora: R$3.997.", delay: 8200 },
  { role: "targeting",       label: "Targeting Expert",     status: "running",   msg: "Segmentando base: 847 leads hot, 1.203 warm, 2.140 cold. Criando sequências por segmento.", delay: 9500 },
  { role: "copywriter",      label: "Copywriter",           status: "done",      msg: "23 peças de copy aprovadas: página de vendas, 8 emails, 7 mensagens WhatsApp.", delay: 11000 },
  { role: "launch_manager",  label: "Gerente de Lançamento", status: "running",  msg: "Programando disparos. Abertura do carrinho: quinta, 20h. Escassez: domingo, 18h.", delay: 12500 },
  { role: "targeting",       label: "Targeting Expert",     status: "done",      msg: "Segmentação concluída. Hot: urgência máxima. Warm: benefício. Cold: curiosidade.", delay: 14000 },
  { role: "analytics",       label: "Analista de Performance", status: "running", msg: "Calculando health score. Meta Ads: CPL R$18. Google: ROAS projetado 3.2x.", delay: 15500 },
  { role: "launch_manager",  label: "Gerente de Lançamento", status: "done",     msg: "Sequência programada. 14 touchpoints em 7 dias. Carrinho abre em 72h.", delay: 17200 },
  { role: "analytics",       label: "Analista de Performance", status: "done",   msg: "Health Score: 87/100. Projeção: R$89k–R$134k. Break-even: 28 vendas.", delay: 19000 },
];

const ROLE_ICON: Record<string, React.ElementType> = {
  command:         Bot,
  strategy:        BrainCircuit,
  offer:           Target,
  copywriter:      FileText,
  targeting:       Users,
  launch_manager:  Rocket,
  analytics:       BarChart2,
};

function Rocket(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

const PIPELINE_NODES = [
  { id: "briefing",   label: "Briefing",   active: true,  done: true  },
  { id: "estrategia", label: "Estratégia", active: true,  done: false },
  { id: "conteudo",   label: "Conteúdo",   active: false, done: false },
  { id: "lancamento", label: "Lançamento", active: false, done: false },
  { id: "resultados", label: "Resultados", active: false, done: false },
];

export function LiveDemoSection() {
  const { ref, inView } = useInView(0.15);
  const [events, setEvents] = useState<typeof AGENT_SEQUENCE>([]);
  const [started, setStarted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);
  const feedRef = useRef<HTMLDivElement>(null);

  const runDemo = useCallback(() => {
    setEvents([]);
    setCurrentPhase(1);
    setStarted(true);
    AGENT_SEQUENCE.forEach((ev) => {
      setTimeout(() => {
        setEvents(prev => [...prev, ev]);
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
        if (ev.status === "done" && ev.role === "strategy") setCurrentPhase(2);
        if (ev.status === "done" && ev.role === "copywriter") setCurrentPhase(3);
        if (ev.status === "done" && ev.role === "launch_manager") setCurrentPhase(4);
      }, ev.delay);
    });
  }, []);

  useEffect(() => {
    if (inView && !started) runDemo();
  }, [inView, started, runDemo]);

  useEffect(() => {
    if (feedRef.current && events.length > 0) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const pipeline = [
    { label: "Briefing",   done: true,          active: currentPhase === 0 },
    { label: "Estratégia", done: currentPhase >= 2, active: currentPhase === 1 },
    { label: "Conteúdo",   done: currentPhase >= 3, active: currentPhase === 2 },
    { label: "Lançamento", done: currentPhase >= 4, active: currentPhase === 3 },
    { label: "Resultados", done: false,          active: currentPhase >= 4 },
  ];

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      style={{ scrollSnapAlign: "start", minHeight: "100vh" }}
      className="relative flex flex-col justify-center overflow-hidden bg-background border-t border-primary/10"
    >
      <div className="max-w-6xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          {/* Label + headline */}
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">VEJA AO VIVO</div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none">
              Esta é a máquina<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">rodando por você.</span>
            </h2>
            <div className="font-mono text-xs text-muted-foreground/50 max-w-xs leading-relaxed">
              Interface real do NexOS. Ao criar sua campanha, você vê exatamente isso — cada agente trabalhando em tempo real.
            </div>
          </div>

          {/* App shell */}
          <div className="border border-border/40 bg-card/30 overflow-hidden">

            {/* Fake browser bar */}
            <div className="border-b border-border/30 bg-muted/10 px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/40" />
                <div className="w-3 h-3 rounded-full bg-success/40" />
              </div>
              <div className="flex-1 bg-background/40 border border-border/30 rounded-none px-3 py-1 font-mono text-[10px] text-muted-foreground/40 text-center">
                agencianexos.vip/app/campaigns/demo-lancamento
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="font-mono text-[10px] text-success uppercase tracking-widest">Ao vivo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-border/20">

              {/* Left sidebar — campaign info */}
              <div className="bg-background/40 p-5 space-y-5">
                {/* Campaign header */}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-1">Campanha ativa</div>
                  <div className="font-mono font-bold text-sm text-foreground truncate">Método Presença Digital</div>
                  <div className="font-mono text-[11px] text-primary mt-0.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Em execução
                  </div>
                </div>

                {/* Pipeline */}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-3">Pipeline</div>
                  <div className="space-y-0">
                    {pipeline.map((step, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className={`w-4 h-4 rounded-none flex items-center justify-center border transition-all ${
                            step.done   ? "bg-success/20 border-success/40 text-success" :
                            step.active ? "bg-primary/20 border-primary/40 text-primary" :
                                          "bg-muted/10 border-border/20 text-muted-foreground/20"
                          }`}>
                            {step.done ? <CheckCircle2 className="h-2.5 w-2.5" /> : <div className={`w-1.5 h-1.5 rounded-full ${step.active ? "bg-primary animate-pulse" : "bg-muted/20"}`} />}
                          </div>
                          {i < pipeline.length - 1 && <div className={`w-px h-5 transition-all ${step.done ? "bg-success/30" : "bg-border/20"}`} />}
                        </div>
                        <span className={`font-mono text-[11px] uppercase tracking-widest ${
                          step.done   ? "text-muted-foreground/60" :
                          step.active ? "text-primary font-bold" :
                                        "text-muted-foreground/25"
                        }`}>{step.label}</span>
                        {step.active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-auto" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-2">Resumo</div>
                  {[
                    { l: "Tipo", v: "PLF" },
                    { l: "Track", v: "6 Dígitos" },
                    { l: "Ticket", v: "R$1.997" },
                    { l: "Budget", v: "R$12.000" },
                    { l: "Agentes", v: `${events.length} ativos` },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">{l}</span>
                      <span className="font-mono text-[11px] text-foreground/70 font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Agent feed */}
              <div className="flex flex-col">
                <div className="border-b border-border/20 bg-muted/5 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80">Agentes em ação</span>
                    <div className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {events.filter(e => e.status === "running").length > 0 ? `${events.filter(e => e.status === "running").length} processando` : events.length > 0 ? "Concluído" : "Aguardando"}
                    </div>
                  </div>
                  <button
                    onClick={runDemo}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    <Play className="h-2.5 w-2.5" /> Reiniciar
                  </button>
                </div>

                <div
                  ref={feedRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[340px] scroll-smooth"
                  style={{ scrollBehavior: "smooth" }}
                >
                  {events.length === 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground/30 font-mono text-xs py-4">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Inicializando agentes...
                    </div>
                  )}
                  {events.map((ev, i) => {
                    const Icon = ROLE_ICON[ev.role] ?? Bot;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300"
                      >
                        <div className={`w-6 h-6 rounded-none border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          ev.status === "done"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-primary/30 bg-primary/10 text-primary"
                        }`}>
                          {ev.status === "done"
                            ? <CheckCircle2 className="h-3 w-3" />
                            : <Icon className="h-3 w-3" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/70">{ev.label}</span>
                            <span className={`font-mono text-[10px] uppercase tracking-widest ${ev.status === "done" ? "text-success/60" : "text-primary/60"}`}>
                              {ev.status === "done" ? "concluído" : "processando..."}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">{ev.msg}</p>
                        </div>
                      </div>
                    );
                  })}

                  {events.length > 0 && events.length < AGENT_SEQUENCE.length && (
                    <div className="flex items-center gap-2 text-primary/40 font-mono text-[10px] pt-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Próximo agente entrando em ação...
                    </div>
                  )}

                  {events.length === AGENT_SEQUENCE.length && (
                    <div className="border border-success/20 bg-success/5 px-3 py-2.5 flex items-center gap-3 mt-2 animate-in fade-in duration-500">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <div>
                        <div className="font-mono text-xs font-bold text-success uppercase tracking-widest">Lançamento pronto para execução</div>
                        <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">Estratégia + copy + sequências aprovadas. Aguardando confirmação.</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Health score bar */}
                {events.length === AGENT_SEQUENCE.length && (
                  <div className="border-t border-border/20 px-4 py-3 flex items-center justify-between gap-4 bg-muted/5 animate-in slide-in-from-bottom-2 duration-500">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Health Score</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-2xl text-success">87</span>
                        <span className="font-mono text-xs text-muted-foreground/40">/100</span>
                        <Activity className="h-3.5 w-3.5 text-success" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-muted/20 rounded-none overflow-hidden">
                        <div className="h-full bg-success transition-all duration-1000" style={{ width: "87%" }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">Projeção</div>
                      <div className="font-mono text-xs font-bold text-foreground">R$89k–R$134k</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA below */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <p className="font-mono text-sm text-muted-foreground/60 max-w-lg leading-relaxed">
              O que você acabou de ver leva <strong className="text-foreground">menos de 1 hora</strong> no mundo real. Você aprova cada etapa antes de qualquer execução.
            </p>
            <a href="/comprar" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-12 px-8 gap-2">
                Quero isso agora <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B: INTERACTIVE BUDGET SIMULATOR
// Calls the real /api/demo/simulate endpoint — no login required
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "infoproduct",    label: "Infoproduto / Curso" },
  { value: "mentorship",     label: "Mentoria" },
  { value: "software",       label: "Software / SaaS" },
  { value: "service",        label: "Serviço / Consultoria" },
  { value: "event",          label: "Evento / Live" },
  { value: "physical",       label: "Produto Físico" },
  { value: "academia",       label: "Academia / Fitness" },
  { value: "health_beauty",  label: "Saúde e Beleza" },
  { value: "ecommerce",      label: "Loja Virtual" },
  { value: "community",      label: "Comunidade / Clube" },
];

const TYPE_OPTIONS = [
  { value: "launch",           label: "PLF / Fórmula de Lançamento" },
  { value: "perpetual_launch", label: "Lançamento Perpétuo" },
  { value: "flash_sale",       label: "Flash Sale" },
  { value: "live_sale",        label: "Live de Vendas" },
];

const PLATFORM_COLORS: Record<string, string> = {
  meta_ads:    "#1877F2",
  google_ads:  "#4285F4",
  tiktok_ads:  "#fe2c55",
  youtube_ads: "#FF0000",
};

type Scenario = "low" | "mid" | "high";

const SCENARIO_META: Record<Scenario, { label: string; color: string; dot: string }> = {
  low:  { label: "Pessimista",  color: "text-yellow-400", dot: "bg-yellow-400" },
  mid:  { label: "Realista",    color: "text-cyan-400",   dot: "bg-cyan-400" },
  high: { label: "Otimista",    color: "text-emerald-400", dot: "bg-emerald-400" },
};

function SimKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-border/30 bg-background/30 p-3 flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{label}</span>
      <span className={`font-mono text-lg font-black ${color}`}>{value}</span>
    </div>
  );
}

export function SimulatorSection() {
  const { ref, inView } = useInView(0.1);
  const [budget, setBudget] = useState(10000);
  const [price, setPrice] = useState(997);
  const [category, setCategory] = useState("infoproduct");
  const [type, setType] = useState("launch");
  const [scenario, setScenario] = useState<Scenario>("mid");
  const [sim, setSim] = useState<BudgetSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const runSim = useCallback(async (b: number, p: number, cat: string, tp: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: b, productPrice: p, campaignType: tp, productCategory: cat }),
      });
      const data = await res.json() as { simulation: BudgetSimulation };
      if (data.simulation) setSim(data.simulation);
    } catch {
      // silent fail — sim stays as previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!inView) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSim(budget, price, category, type), 350);
    return () => clearTimeout(debounceRef.current);
  }, [budget, price, category, type, inView, runSim]);

  const s = scenario;

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      style={{ scrollSnapAlign: "start", minHeight: "100vh" }}
      className="relative flex flex-col justify-center overflow-hidden auth-bg-gradient border-t border-primary/10"
    >
      <div className="max-w-6xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          {/* Header */}
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">PROJETE SEU LANÇAMENTO</div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none">
              Quanto você pode<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">faturar agora?</span>
            </h2>
            <p className="font-mono text-xs text-muted-foreground/50 max-w-xs leading-relaxed">
              Números reais. Benchmarks Q1 2026: Meta Ads, Google, TikTok, YouTube Brasil. Sem estimativas de agência.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

            {/* Controls */}
            <div className="border border-border/30 bg-card/30 p-6 space-y-6">

              {/* Budget slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Budget de mídia</label>
                  <span className="font-mono text-sm font-black text-primary">{fmtBRL(budget)}</span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={100000}
                  step={1000}
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className="w-full h-1 bg-muted/20 rounded-none appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground/30 mt-1">
                  <span>R$2k</span><span>R$100k</span>
                </div>
              </div>

              {/* Price slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Ticket do produto</label>
                  <span className="font-mono text-sm font-black text-primary">{fmtBRL(price)}</span>
                </div>
                <input
                  type="range"
                  min={97}
                  max={9997}
                  step={100}
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  className="w-full h-1 bg-muted/20 rounded-none appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground/30 mt-1">
                  <span>R$97</span><span>R$9.997</span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">Tipo de produto</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CATEGORY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCategory(opt.value)}
                      className={`px-3 py-2 border text-left font-mono text-xs uppercase tracking-widest transition-all ${
                        category === opt.value
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/20 bg-transparent text-muted-foreground/50 hover:border-border/40 hover:text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">Modelo de lançamento</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`px-3 py-2 border text-left font-mono text-xs uppercase tracking-widest transition-all ${
                        type === opt.value
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/20 bg-transparent text-muted-foreground/50 hover:border-border/40 hover:text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">

              {/* Scenario selector */}
              <div className="flex gap-1.5">
                {(["low", "mid", "high"] as Scenario[]).map(sc => {
                  const meta = SCENARIO_META[sc];
                  return (
                    <button
                      key={sc}
                      onClick={() => setScenario(sc)}
                      className={`flex-1 px-3 py-2.5 border font-mono text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        scenario === sc
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/20 text-muted-foreground/40 hover:text-muted-foreground/70"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {loading && (
                <div className="border border-primary/20 bg-card/20 p-4 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                    Calculando com benchmarks reais...
                  </span>
                </div>
              )}

              {sim && !loading && (
                <>
                  {/* Main KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SimKpi label="Leads gerados" value={fmtNum(sim.totalLeads[s])} color="text-cyan-400" />
                    <SimKpi label="Vendas est." value={`${sim.totalSales[s]}`} color="text-primary" />
                    <SimKpi label="Faturamento" value={fmtBRL(sim.totalRevenue[s])} color={sim.totalRoi[s] >= 100 ? "text-emerald-400" : sim.totalRoi[s] >= 0 ? "text-yellow-400" : "text-red-400"} />
                    <SimKpi label={`ROAS ${SCENARIO_META[s].label}`} value={`${sim.totalRoas[s].toFixed(1)}x`} color={sim.totalRoas[s] >= 3 ? "text-emerald-400" : sim.totalRoas[s] >= 1.5 ? "text-cyan-400" : "text-yellow-400"} />
                  </div>

                  {/* Break-even */}
                  <div className="border border-border/20 bg-card/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-mono text-sm text-foreground/70">
                      Break-even: <span className="text-primary font-bold">{sim.breakEvenSales} vendas</span>
                      <span className="text-muted-foreground/40 text-xs ml-2">(CPA máx. {fmtBRL(sim.breakEvenCpa)})</span>
                    </div>
                    <div className={`font-mono text-xs font-bold ${sim.totalSales[s] >= sim.breakEvenSales ? "text-emerald-400" : "text-yellow-400"}`}>
                      {sim.totalSales[s] >= sim.breakEvenSales
                        ? "Cenário supera o break-even"
                        : "Abaixo do break-even — otimize criativos"}
                    </div>
                  </div>

                  {/* Budget allocation bar */}
                  <div className="border border-border/20 bg-card/20 p-4 space-y-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                      Distribuição recomendada — benchmarks reais Q1 2026
                    </div>
                    <div className="flex h-2 overflow-hidden gap-px">
                      {sim.platforms.map(p => (
                        <div
                          key={p.platform}
                          style={{
                            width: `${p.budgetPct}%`,
                            backgroundColor: PLATFORM_COLORS[p.platform] ?? "#888",
                          }}
                          title={`${p.label}: ${p.budgetPct}%`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {sim.platforms.map(p => (
                        <div key={p.platform} className="flex items-center gap-1.5">
                          <div className="w-2 h-2" style={{ backgroundColor: PLATFORM_COLORS[p.platform] ?? "#888" }} />
                          <span className="font-mono text-[10px] text-muted-foreground/60">{p.label}</span>
                          <span className="font-mono text-[10px] text-primary/60 font-bold">{fmtBRL(p.budgetAllocation)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Platform breakdown */}
                  <div className="space-y-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-2">
                      Por plataforma — {SCENARIO_META[s].label.toLowerCase()}
                    </div>
                    {sim.platforms.map(p => (
                      <div key={p.platform} className="border border-border/20 bg-card/10 px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{p.icon}</span>
                          <div>
                            <div className="font-mono text-xs font-bold text-foreground/80">{p.label}</div>
                            <div className="font-mono text-[10px] text-muted-foreground/40">{fmtBRL(p.budgetAllocation)} · {p.budgetPct}%</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-[10px] text-muted-foreground/40">CPL</div>
                            <div className="font-mono text-xs font-bold text-foreground">{fmtBRL(Math.round(p.cpl[s]))}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[10px] text-muted-foreground/40">Leads</div>
                            <div className="font-mono text-xs font-bold text-primary">{fmtNum(p.leads[s])}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[10px] text-muted-foreground/40">ROAS</div>
                            <div className={`font-mono text-xs font-bold ${p.roas[s] >= 3 ? "text-emerald-400" : p.roas[s] >= 1.5 ? "text-cyan-400" : "text-yellow-400"}`}>
                              {p.roas[s].toFixed(1)}x
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Benchmark note */}
                  <div className="flex gap-2 border border-border/10 bg-muted/5 px-3 py-2.5">
                    <Info className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-0.5" />
                    <p className="font-mono text-[10px] text-muted-foreground/40 leading-relaxed">{sim.benchmarkNote}</p>
                  </div>
                </>
              )}

              {/* CTA */}
              <div className="border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                    A agente já sabe como atingir esses números.
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/60">
                    Cada plataforma, cada segmento, cada horário de disparo — automatizado.
                  </div>
                </div>
                <a href="/comprar" className="shrink-0">
                  <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-11 px-6 gap-2 text-xs">
                    Garantir vaga <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
