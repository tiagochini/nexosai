import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateCampaign, CampaignInputType, CampaignInputTrack } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Rocket, Brain, Zap, ChevronRight,
  TrendingUp, Users, RefreshCw, CheckCircle2,
} from "lucide-react";

interface GoalOption {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  badge: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  badgeBgColor: string;
  targetLabel: string;
  ideal: string;
  type: CampaignInputType;
  track: CampaignInputTrack;
  nameSuggestion: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "launch",
    icon: Rocket,
    title: "Quero fazer um lançamento e faturar alto",
    desc: "A IA monta toda a estratégia para você alcançar R$100k+ em 7 dias de carrinho aberto. Plano completo, copy e execução inclusos.",
    badge: "6 Dígitos",
    badgeTextColor: "text-primary",
    badgeBorderColor: "border-primary/40",
    badgeBgColor: "bg-primary/10",
    targetLabel: "R$100k – R$999k em 7 dias",
    ideal: "Ideal para produto digital com audiência existente",
    type: "launch" as CampaignInputType,
    track: "six_digits" as CampaignInputTrack,
    nameSuggestion: "Meu Lançamento",
  },
  {
    id: "perpetual",
    icon: RefreshCw,
    title: "Quero vendas todos os dias no piloto automático",
    desc: "Sistema de vendas perpétuas — o produto continua vendendo enquanto você dorme, sem precisar de novos lançamentos.",
    badge: "Perpétuo",
    badgeTextColor: "text-emerald-400",
    badgeBorderColor: "border-emerald-400/40",
    badgeBgColor: "bg-emerald-400/10",
    targetLabel: "Renda recorrente e automática",
    ideal: "Ideal para infoproduto digital com margem alta",
    type: "perpetual_launch" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Funil Perpétuo",
  },
  {
    id: "flash",
    icon: Zap,
    title: "Quero gerar caixa rápido com uma promoção",
    desc: "Flash Sale de 24h a 72h para sua lista atual. Resultado imediato sem precisar de grande estrutura ou mídia paga.",
    badge: "Flash Sale",
    badgeTextColor: "text-yellow-400",
    badgeBorderColor: "border-yellow-400/40",
    badgeBgColor: "bg-yellow-400/10",
    targetLabel: "Resultado em até 72 horas",
    ideal: "Ideal para quem já tem lista ou audiência aquecida",
    type: "flash_sale" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Flash Sale",
  },
  {
    id: "audience",
    icon: Users,
    title: "Quero captar leads e crescer minha audiência",
    desc: "Estratégia de crescimento orgânico e pago para construir sua base antes do grande lançamento. Sem produto pronto? Sem problema.",
    badge: "Crescimento",
    badgeTextColor: "text-cyan-400",
    badgeBorderColor: "border-cyan-400/40",
    badgeBgColor: "bg-cyan-400/10",
    targetLabel: "Mais leads, seguidores e alcance",
    ideal: "Ideal para quem está começando do zero",
    type: "audience_growth" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Crescimento de Audiência",
  },
];

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const [step, setStep]           = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalOption | null>(null);
  const [title, setTitle]         = useState("");

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: (data) => {
        toast.success("Perfeito! A IA está pronta para o seu briefing.");
        setLocation(`/campaigns/${data.campaign.id}/intake`);
      },
      onError: () => toast.error("Erro ao criar. Tente novamente."),
    },
  });

  const handleSelectGoal = (goal: GoalOption) => {
    setSelectedGoal(goal);
    if (!title.trim()) setTitle(goal.nameSuggestion);
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !title.trim()) return;
    createMutation.mutate({
      data: {
        title: title.trim(),
        type:  selectedGoal.type,
        track: selectedGoal.track,
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Voltar
          </Button>
        </Link>
        {step === 1 ? (
          <>
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
              Qual é o seu objetivo?
            </h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              Escolha o que melhor descreve o que você quer conquistar agora
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
              Como vai chamar este lançamento?
            </h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              Pode ser qualquer nome — você muda depois se quiser
            </p>
          </>
        )}
      </div>

      {/* Step 1: Goal selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                key={goal.id}
                onClick={() => handleSelectGoal(goal)}
                className="text-left border border-border/50 bg-card/40 p-5 hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 border border-border/40 bg-card/60 flex items-center justify-center shrink-0 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                    <Icon className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                  <span className={`font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border ${goal.badgeTextColor} ${goal.badgeBorderColor} ${goal.badgeBgColor}`}>
                    {goal.badge}
                  </span>
                </div>

                <h3 className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-tight mb-2">
                  {goal.title}
                </h3>
                <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed mb-3">
                  {goal.desc}
                </p>

                <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
                  <span className={`font-mono text-[11px] font-bold ${goal.badgeTextColor} uppercase tracking-widest`}>
                    {goal.targetLabel}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2: Name + submit */}
      {step === 2 && selectedGoal && (
        <div className="space-y-5">

          {/* Selected goal recap */}
          <div className={`flex items-center gap-3 border p-3 ${selectedGoal.badgeBorderColor} ${selectedGoal.badgeBgColor}`}>
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${selectedGoal.badgeTextColor}`} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs font-bold text-foreground leading-snug">{selectedGoal.title}</div>
              <div className={`font-mono text-[11px] uppercase tracking-widest mt-0.5 ${selectedGoal.badgeTextColor}`}>{selectedGoal.targetLabel}</div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 px-2 py-1 border border-border/30 hover:border-border/60"
            >
              Alterar
            </button>
          </div>

          {/* Name form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border border-primary/20 bg-card/40 p-6 relative card-weapon space-y-4">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 pointer-events-none" />

              <div className="space-y-2 relative z-10">
                <label className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  Nome do Lançamento
                </label>
                <Input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 text-base rounded-none px-4"
                  placeholder="Ex: Curso de Marketing Digital"
                />
                <p className="font-mono text-xs text-muted-foreground/40">
                  Só para você se organizar internamente. A IA vai entender tudo durante o briefing.
                </p>
              </div>
            </div>

            {/* What happens next — mini preview */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { num: "01", title: "Briefing rápido", desc: "~3 min de conversa com a IA sobre seu produto" },
                { num: "02", title: "Plano completo", desc: "Estratégia, cronograma e canais definidos pela IA" },
                { num: "03", title: "Conteúdo + Execução", desc: "Você aprova e a campanha vai ao ar" },
              ].map(s => (
                <div key={s.num} className="flex flex-col gap-1.5 p-3 border border-border/30 bg-card/20">
                  <span className="font-mono text-[10px] text-primary/50 tracking-widest">{s.num}</span>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/80 leading-tight">{s.title}</div>
                  <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="rounded-none font-mono uppercase tracking-widest h-12 px-6 border-border/50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />Voltar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !title.trim()}
                className="flex-1 rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary gap-2"
              >
                {createMutation.isPending
                  ? <span className="animate-pulse font-mono">Iniciando...</span>
                  : <><Brain className="h-4 w-4" />Iniciar Briefing com IA<ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
