import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateCampaign, CampaignInputType, CampaignInputTrack } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Rocket, RefreshCw, Zap, TrendingUp,
  BarChart3, Users, Radio, Youtube, Mail, ChevronRight,
} from "lucide-react";

const TRACKS = [
  {
    id: "six_digits",
    label: "6 Dígitos",
    sub: "Lançamento Semente",
    range: "R$ 100k – 999k",
    days: "7 dias",
    borderActive: "border-blue-400/60 shadow-[0_0_30px_rgba(59,130,246,0.25)]",
    gradient: "from-blue-500/15 to-cyan-500/5",
    textColor: "text-blue-400",
    icon: Rocket,
  },
  {
    id: "eight_digits",
    label: "8 Dígitos",
    sub: "Lançamento Fórmula",
    range: "R$ 10M – 99M",
    days: "7 dias",
    borderActive: "border-purple-400/60 shadow-[0_0_30px_rgba(168,85,247,0.25)]",
    gradient: "from-purple-500/15 to-violet-500/5",
    textColor: "text-purple-400",
    icon: TrendingUp,
  },
  {
    id: "ten_digits",
    label: "10 Dígitos",
    sub: "Lançamento Elite",
    range: "R$ 100M+",
    days: "7 dias",
    borderActive: "border-red-400/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]",
    gradient: "from-red-500/15 to-orange-500/5",
    textColor: "text-red-400",
    icon: BarChart3,
  },
];

const TYPES = [
  { id: "launch",              label: "Lançamento",    sub: "PLF / Fórmula",       icon: Rocket    },
  { id: "perpetual_launch",    label: "Perpétuo",      sub: "Evergreen",            icon: RefreshCw },
  { id: "flash_sale",          label: "Flash Sale",    sub: "72h de urgência",      icon: Zap       },
  { id: "live_sale",           label: "Live Sale",     sub: "Live de vendas",       icon: Radio     },
  { id: "continuous_sales",    label: "Contínuo",      sub: "Fluxo constante",      icon: TrendingUp},
  { id: "affiliate",           label: "Afiliado",      sub: "Produto de terceiros", icon: Users     },
  { id: "authority",           label: "Autoridade",    sub: "Branding & posição",   icon: BarChart3 },
  { id: "audience_growth",     label: "Crescimento",   sub: "Audiência orgânica",   icon: Youtube   },
  { id: "subscription_growth", label: "Assinatura",    sub: "Clube / Membros",      icon: Mail      },
];

type Step = "track" | "type" | "details";
const STEPS: { id: Step; label: string; num: string }[] = [
  { id: "track",   label: "Trilha",   num: "01" },
  { id: "type",    label: "Modelo",   num: "02" },
  { id: "details", label: "Detalhes", num: "03" },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground/40"}`}>
              <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-mono font-bold border transition-all ${
                active ? "border-primary bg-primary/10 text-primary" :
                done   ? "border-success bg-success/10 text-success" :
                         "border-border/30 text-muted-foreground/30"
              }`}>
                {done ? <Check className="h-3 w-3" /> : s.num}
              </div>
              <span className="font-mono text-xs uppercase tracking-widest hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px ${i < idx ? "bg-success/50" : "bg-border/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const [step,          setStep]          = useState<Step>("track");
  const [track,         setTrack]         = useState("");
  const [type,          setType]          = useState("");
  const [title,         setTitle]         = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: (data) => {
        toast.success("Missão iniciada. Intake da IA começa agora.");
        setLocation(`/campaigns/${data.campaign.id}`);
      },
      onError: () => toast.error("Erro ao criar campanha."),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Defina o codinome da missão."); return; }
    createMutation.mutate({
      data: {
        title,
        type:  type  as CampaignInputType,
        track: track as CampaignInputTrack,
        revenueTarget: revenueTarget || undefined,
      },
    });
  };

  const selectedTrack = TRACKS.find(t => t.id === track);
  const selectedType  = TYPES.find(t  => t.id === type);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Voltar às Missões
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Iniciar Nova Missão</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              Configure os parâmetros. A IA toma conta do restante.
            </p>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      {/* ── STEP 1 — TRACK ───────────────────────────────────────────────────── */}
      {step === "track" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Qual é a meta de faturamento desta operação?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRACKS.map((t) => {
              const Icon = t.icon;
              const active = track === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTrack(t.id)}
                  className={`relative flex flex-col p-6 border text-left transition-all group ${
                    active
                      ? `${t.borderActive} bg-gradient-to-br ${t.gradient}`
                      : "border-border/40 bg-card/30 hover:border-border/70 hover:bg-card/50"
                  }`}
                >
                  {active && (
                    <>
                      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-current opacity-60 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-current opacity-60 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-current opacity-60 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-current opacity-60 pointer-events-none" />
                      <div className={`absolute top-3 right-3 w-5 h-5 rounded-sm flex items-center justify-center ${t.textColor} bg-current/10`}>
                        <Check className="h-3 w-3" />
                      </div>
                    </>
                  )}
                  <Icon className={`h-7 w-7 mb-5 transition-colors ${active ? t.textColor : "text-muted-foreground/40 group-hover:text-muted-foreground/60"}`} />
                  <div className={`font-mono font-bold text-2xl uppercase tracking-tighter mb-0.5 ${active ? t.textColor : "text-foreground"}`}>
                    {t.label}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-5">{t.sub}</div>
                  <div className="mt-auto border-t border-border/20 pt-4">
                    <div className="font-mono text-sm font-bold text-foreground">{t.range}</div>
                    <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">em {t.days}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setStep("type")}
              disabled={!track}
              className="rounded-none font-mono uppercase tracking-widest font-bold h-11 px-6 btn-weapon-primary gap-2"
            >
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 — TYPE ────────────────────────────────────────────────────── */}
      {step === "type" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Qual modelo de operação?</p>
            {selectedTrack && (
              <span className={`font-mono text-[11px] px-2 py-0.5 border uppercase tracking-widest ${selectedTrack.textColor} border-current/30 bg-current/5`}>
                {selectedTrack.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`flex items-start gap-3 p-4 border text-left transition-all group ${
                    active
                      ? "border-primary/50 bg-primary/8 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                      : "border-border/40 bg-card/30 hover:border-border/70 hover:bg-card/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-mono text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                    <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">{t.sub}</div>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("track")} className="rounded-none font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />Voltar
            </Button>
            <Button onClick={() => setStep("details")} disabled={!type} className="rounded-none font-mono uppercase tracking-widest font-bold h-11 px-6 btn-weapon-primary gap-2">
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3 — DETAILS ─────────────────────────────────────────────────── */}
      {step === "details" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {selectedTrack && (
                <span className={`font-mono text-[11px] px-2 py-0.5 border uppercase tracking-widest ${selectedTrack.textColor} border-current/30 bg-current/5`}>
                  {selectedTrack.label}
                </span>
              )}
              {selectedType && (
                <span className="font-mono text-[11px] px-2 py-0.5 border border-primary/30 bg-primary/8 text-primary uppercase tracking-widest">
                  {selectedType.label}
                </span>
              )}
            </div>

            <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-6 relative card-weapon space-y-6">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 pointer-events-none" />

              <div className="space-y-2 relative z-10">
                <label className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  Codinome da Missão
                </label>
                <Input
                  required autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 text-base rounded-none px-4"
                  placeholder="Ex: Lançamento Produto Alpha — Q3 2025"
                />
                <p className="font-mono text-xs text-muted-foreground/40">Nome interno. Pode alterar depois.</p>
              </div>

              <div className="space-y-2 relative z-10 pt-4 border-t border-border/30">
                <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Meta de Faturamento <span className="text-muted-foreground/40 ml-1">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-sm">R$</span>
                  <Input
                    type="text"
                    value={revenueTarget}
                    onChange={(e) => setRevenueTarget(e.target.value)}
                    className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none pl-10"
                    placeholder="500.000,00"
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground/40">
                  A IA calibra a estratégia da trilha {selectedTrack?.label} com esse valor.
                </p>
              </div>

              <div className="relative z-10 pt-4 border-t border-border/20">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50 mb-3">O que acontece após iniciar</div>
                <div className="space-y-2">
                  {[
                    "Intake IA: conversa para entender seu produto e mercado",
                    "Estrategista gera o plano completo de lançamento",
                    "Copywriter produz todo o conteúdo para aprovação",
                    "Missão vai ao ar com monitoramento em tempo real",
                  ].map((s, i) => (
                    <div key={s} className="flex items-start gap-3">
                      <span className="font-mono text-[11px] text-primary/50 w-4 shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-mono text-xs text-muted-foreground/60">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep("type")} className="rounded-none font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />Voltar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !title.trim()}
                className="rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary gap-2"
              >
                {createMutation.isPending
                  ? <span className="animate-pulse font-mono">Inicializando...</span>
                  : <><Rocket className="h-4 w-4" />Iniciar Missão<ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
