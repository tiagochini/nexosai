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
  accentLine: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "launch",
    icon: Rocket,
    title: "Quero faturar alto num lançamento de carrinho aberto",
    desc: "A IA monta a estratégia completa para R$100k+ em 7 dias. Mesmo sem copywriter, sem agência e mesmo que você nunca tenha lançado antes.",
    badge: "6 Dígitos",
    badgeTextColor: "text-primary",
    badgeBorderColor: "border-primary/40",
    badgeBgColor: "bg-primary/10",
    targetLabel: "R$100k – R$999k em 7 dias",
    ideal: "Mesmo sem lista grande · Mesmo sem experiência",
    type: "launch" as CampaignInputType,
    track: "six_digits" as CampaignInputTrack,
    nameSuggestion: "Meu Lançamento",
    accentLine: "bg-primary",
  },
  {
    id: "perpetual",
    icon: RefreshCw,
    title: "Quero vendas todos os dias sem abrir e fechar carrinho",
    desc: "Funil perpétuo automatizado — o produto vende enquanto você dorme, sem depender de datas, energia ou novos lançamentos.",
    badge: "Perpétuo",
    badgeTextColor: "text-emerald-400",
    badgeBorderColor: "border-emerald-400/40",
    badgeBgColor: "bg-emerald-400/10",
    targetLabel: "Renda automática todos os dias",
    ideal: "Mesmo sem time · Mesmo sem rotina de lançamento",
    type: "perpetual_launch" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Funil Perpétuo",
    accentLine: "bg-emerald-400",
  },
  {
    id: "flash",
    icon: Zap,
    title: "Quero gerar caixa rápido com uma promoção de 48-72h",
    desc: "Flash Sale para sua lista atual. Resultado em dias, não semanas. Sem estrutura pesada, sem tráfego pago obrigatório.",
    badge: "Flash Sale",
    badgeTextColor: "text-yellow-400",
    badgeBorderColor: "border-yellow-400/40",
    badgeBgColor: "bg-yellow-400/10",
    targetLabel: "Resultado em até 72 horas",
    ideal: "Mesmo com lista pequena · Mesmo sem anúncios",
    type: "flash_sale" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Flash Sale",
    accentLine: "bg-yellow-400",
  },
  {
    id: "audience",
    icon: Users,
    title: "Quero construir minha base antes de lançar",
    desc: "Estratégia de captação orgânica e paga para encher a lista antes do grande lançamento. Sem produto pronto ainda? Começa aqui.",
    badge: "Crescimento",
    badgeTextColor: "text-cyan-400",
    badgeBorderColor: "border-cyan-400/40",
    badgeBgColor: "bg-cyan-400/10",
    targetLabel: "Leads, seguidores e base qualificada",
    ideal: "Mesmo do zero · Mesmo sem produto finalizado",
    type: "audience_growth" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: "Crescimento de Audiência",
    accentLine: "bg-cyan-400",
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
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Voltar
          </Button>
        </Link>

        {step === 1 ? (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary/70 mb-2">
              Nova Campanha · Passo 1 de 2
            </p>
            <h1 className="text-3xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground leading-tight">
              Qual é o seu<br />
              <span className="text-primary">objetivo agora?</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-3 max-w-lg">
              Escolha o cenário que melhor descreve o que você quer conquistar. A IA adapta toda a estratégia a partir daqui.
            </p>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary/70 mb-2">
              Nova Campanha · Passo 2 de 2
            </p>
            <h1 className="text-3xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground">
              Como vai chamar<br />
              <span className="text-primary">este lançamento?</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-3">
              Qualquer nome serve — você pode mudar depois.
            </p>
          </div>
        )}
      </div>

      {/* Step 1: Goal selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {GOAL_OPTIONS.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                key={goal.id}
                onClick={() => handleSelectGoal(goal)}
                className="text-left border border-border/40 bg-card/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group relative overflow-hidden cursor-pointer flex flex-col"
              >
                {/* top accent line */}
                <div className={`h-0.5 w-full ${goal.accentLine} opacity-40 group-hover:opacity-100 transition-opacity`} />

                <div className="p-7 flex flex-col flex-1">
                  {/* Icon + Badge row */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-10 h-10 flex items-center justify-center border ${goal.badgeBorderColor} ${goal.badgeBgColor} transition-all`}>
                      <Icon className={`h-5 w-5 ${goal.badgeTextColor}`} />
                    </div>
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border ${goal.badgeTextColor} ${goal.badgeBorderColor} ${goal.badgeBgColor}`}>
                      {goal.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-mono font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug mb-3">
                    {goal.title}
                  </h3>

                  {/* Description */}
                  <p className="font-mono text-[12px] text-muted-foreground/60 leading-relaxed mb-4 flex-1">
                    {goal.desc}
                  </p>

                  {/* Ideal for */}
                  <p className="font-mono text-[10px] text-muted-foreground/40 italic mb-5">
                    {goal.ideal}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/20">
                    <span className={`font-mono text-[11px] font-bold ${goal.badgeTextColor} uppercase tracking-widest`}>
                      {goal.targetLabel}
                    </span>
                    <ChevronRight className={`h-4 w-4 ${goal.badgeTextColor} opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1 duration-200`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2: Name + submit */}
      {step === 2 && selectedGoal && (
        <div className="space-y-6">

          {/* Selected goal recap */}
          <div className={`flex items-center gap-4 border p-4 ${selectedGoal.badgeBorderColor} ${selectedGoal.badgeBgColor}`}>
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${selectedGoal.badgeTextColor}`} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-bold text-foreground leading-snug">{selectedGoal.title}</div>
              <div className={`font-mono text-[11px] uppercase tracking-widest mt-1 ${selectedGoal.badgeTextColor}`}>{selectedGoal.targetLabel}</div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 px-3 py-1.5 border border-border/30 hover:border-border/60"
            >
              Alterar
            </button>
          </div>

          {/* Name form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border border-primary/20 bg-card/40 p-8 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40 pointer-events-none" />

              <label className="font-mono text-[11px] uppercase tracking-widest text-primary flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                Nome do Lançamento
              </label>
              <Input
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-13 text-base rounded-none px-4 mb-3"
                placeholder="Ex: Curso de Marketing Digital"
              />
              <p className="font-mono text-[11px] text-muted-foreground/40">
                Só para você se organizar internamente. A IA vai entender tudo durante o briefing.
              </p>
            </div>

            {/* What happens next */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { num: "01", title: "Briefing rápido", desc: "~3 min de conversa com a IA sobre seu produto" },
                { num: "02", title: "Plano completo", desc: "Estratégia, cronograma e canais definidos pela IA" },
                { num: "03", title: "Conteúdo + Execução", desc: "Você aprova e a campanha vai ao ar" },
              ].map(s => (
                <div key={s.num} className="flex flex-col gap-2 p-5 border border-border/20 bg-card/20">
                  <span className="font-mono text-[10px] text-primary/50 tracking-widest">{s.num}</span>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/80 leading-tight">{s.title}</div>
                  <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
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
