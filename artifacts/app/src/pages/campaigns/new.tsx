import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateCampaign, CampaignInputType, CampaignInputTrack } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ApiError } from "@workspace/api-client-react/custom-fetch";
import {
  ArrowLeft, Rocket, Brain, Zap, ChevronRight,
  TrendingUp, Users, RefreshCw, CheckCircle2,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

interface GoalOption {
  id: string;
  icon: React.ElementType;
  title: [string, string, string];
  desc: [string, string, string];
  badge: [string, string, string];
  badgeTextColor: string;
  badgeBorderColor: string;
  badgeBgColor: string;
  targetLabel: [string, string, string];
  ideal: [string, string, string];
  type: CampaignInputType;
  track: CampaignInputTrack;
  nameSuggestion: [string, string, string];
  accentLine: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "launch",
    icon: Rocket,
    title: ["Quero faturar alto num lançamento de carrinho aberto", "I want to generate high revenue from an open-cart launch", "Quiero generar altos ingresos con un lanzamiento de carrito abierto"],
    desc: ["O agente monta a estratégia completa para R$100k+ em 7 dias. Mesmo sem copywriter, sem agência e mesmo que você nunca tenha lançado antes.", "The agent builds a complete strategy to reach R$100k+ in 7 days—even without a copywriter, an agency, or prior launch experience.", "El agente prepara una estrategia completa para alcanzar R$100 mil o más en 7 días, incluso sin copywriter, agencia ni experiencia previa."],
    badge: ["6 dígitos", "6 digits", "6 dígitos"],
    badgeTextColor: "text-primary",
    badgeBorderColor: "border-primary/40",
    badgeBgColor: "bg-primary/10",
    targetLabel: ["R$100k – R$999k em 7 dias", "R$100k–R$999k in 7 days", "R$100 mil–R$999 mil en 7 días"],
    ideal: ["Mesmo sem lista grande · Mesmo sem experiência", "Even without a large list · Even without experience", "Incluso sin una lista grande · Incluso sin experiencia"],
    type: "launch" as CampaignInputType,
    track: "six_digits" as CampaignInputTrack,
    nameSuggestion: ["Meu lançamento", "My launch", "Mi lanzamiento"],
    accentLine: "bg-primary",
  },
  {
    id: "perpetual",
    icon: RefreshCw,
    title: ["Quero vendas todos os dias sem abrir e fechar carrinho", "I want daily sales without opening and closing a cart", "Quiero ventas diarias sin abrir y cerrar el carrito"],
    desc: ["Funil perpétuo automatizado — o produto vende enquanto você dorme, sem depender de datas, energia ou novos lançamentos.", "An automated evergreen funnel—the product sells while you sleep, without relying on dates, launches, or constant effort.", "Un embudo automatizado que vende mientras duermes, sin depender de fechas, lanzamientos ni esfuerzo constante."],
    badge: ["Perpétuo", "Evergreen", "Evergreen"],
    badgeTextColor: "text-emerald-400",
    badgeBorderColor: "border-emerald-400/40",
    badgeBgColor: "bg-emerald-400/10",
    targetLabel: ["Renda automática todos os dias", "Automated revenue every day", "Ingresos automatizados todos los días"],
    ideal: ["Mesmo sem time · Mesmo sem rotina de lançamento", "Even without a team · Even without a launch routine", "Incluso sin equipo · Incluso sin una rutina de lanzamiento"],
    type: "perpetual_launch" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: ["Funil perpétuo", "Evergreen funnel", "Embudo evergreen"],
    accentLine: "bg-emerald-400",
  },
  {
    id: "flash",
    icon: Zap,
    title: ["Quero gerar caixa rápido com uma promoção de 48-72h", "I want to generate cash quickly with a 48–72 hour promotion", "Quiero generar ingresos rápidamente con una promoción de 48 a 72 horas"],
    desc: ["Flash Sale para sua lista atual. Resultado em dias, não semanas. Sem estrutura pesada, sem tráfego pago obrigatório.", "A flash sale for your existing list. Results in days, not weeks. No heavy setup or required paid traffic.", "Una oferta relámpago para tu lista actual. Resultados en días, no semanas, sin una infraestructura compleja ni tráfico pagado obligatorio."],
    badge: ["Flash Sale", "Flash Sale", "Oferta relámpago"],
    badgeTextColor: "text-yellow-400",
    badgeBorderColor: "border-yellow-400/40",
    badgeBgColor: "bg-yellow-400/10",
    targetLabel: ["Resultado em até 72 horas", "Results in up to 72 hours", "Resultados en hasta 72 horas"],
    ideal: ["Mesmo com lista pequena · Mesmo sem anúncios", "Even with a small list · Even without ads", "Incluso con una lista pequeña · Incluso sin anuncios"],
    type: "flash_sale" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: ["Flash Sale", "Flash sale", "Oferta relámpago"],
    accentLine: "bg-yellow-400",
  },
  {
    id: "audience",
    icon: Users,
    title: ["Quero construir minha base antes de lançar", "I want to build my audience before launching", "Quiero crear mi audiencia antes del lanzamiento"],
    desc: ["Estratégia de captação orgânica e paga para encher a lista antes do grande lançamento. Sem produto pronto ainda? Começa aqui.", "An organic and paid acquisition strategy to grow your list before the big launch. Don't have a finished product yet? Start here.", "Una estrategia de captación orgánica y pagada para hacer crecer tu lista antes del gran lanzamiento. ¿Aún no tienes el producto listo? Empieza aquí."],
    badge: ["Crescimento", "Growth", "Crecimiento"],
    badgeTextColor: "text-cyan-400",
    badgeBorderColor: "border-cyan-400/40",
    badgeBgColor: "bg-cyan-400/10",
    targetLabel: ["Leads, seguidores e base qualificada", "Leads, followers, and qualified audience", "Contactos, seguidores y audiencia cualificada"],
    ideal: ["Mesmo do zero · Mesmo sem produto finalizado", "Even from scratch · Even without a finished product", "Incluso desde cero · Incluso sin un producto terminado"],
    type: "audience_growth" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: ["Crescimento de audiência", "Audience growth", "Crecimiento de audiencia"],
    accentLine: "bg-cyan-400",
  },
  {
    id: "semente",
    icon: Brain,
    title: ["Quero validar e vender antes de criar o produto", "I want to validate and sell before creating the product", "Quiero validar y vender antes de crear el producto"],
    desc: ["Lançamento Semente — vende antes de existir, valida com dinheiro real, e constrói o produto junto com os primeiros alunos. O agente monta a PLC, oferta de fundador e lives de venda.", "Seed launch—sell before it exists, validate with real money, and build the product alongside the first students. The agent prepares the pre-launch content, founding offer, and live sales.", "Lanzamiento semilla: vende antes de crear el producto, valida con dinero real y constrúyelo junto con tus primeros alumnos. El agente prepara el contenido previo, la oferta fundadora y las ventas en directo."],
     badge: ["Semente", "Seed", "Semilla"],
    badgeTextColor: "text-orange-400",
    badgeBorderColor: "border-orange-400/40",
    badgeBgColor: "bg-orange-400/10",
    targetLabel: ["Validação + primeiros alunos", "Validation + first students", "Validación + primeros alumnos"],
    ideal: ["Mesmo sem produto · Mesmo sem audiência grande", "Even without a product · Even without a large audience", "Incluso sin producto · Incluso sin una audiencia grande"],
    type: "semente_launch" as CampaignInputType,
    track: "not_applicable" as CampaignInputTrack,
    nameSuggestion: ["Lançamento semente", "Seed launch", "Lanzamiento semilla"],
    accentLine: "bg-orange-400",
  },
];

export default function NewCampaign() {
  const t = useUiText();
  const [, setLocation] = useLocation();
  const [step, setStep]           = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalOption | null>(null);
  const [title, setTitle]         = useState("");
  // null = user chose "skip" (AI will discover track)
  const [directMode, setDirectMode] = useState(false);

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: (data) => {
         toast.success(t("Perfeito! A agente está pronta para o seu briefing.", "Perfect! Your agent is ready for your briefing.", "¡Perfecto! Tu agente está listo para el briefing."));
        setLocation(`/campaigns/${data.campaign.id}/intake`);
      },
      onError: (err: unknown) => {
        const apiErr = err as { status?: number; data?: { error?: string } };
        if (apiErr?.status === 403 || (err instanceof ApiError && err.status === 403)) {
           toast.error(t("Limite de campanhas atingido", "Campaign limit reached", "Se alcanzó el límite de campañas"), {
             description: t("Conclua ou arquive uma campanha existente para criar uma nova.", "Complete or archive an existing campaign to create a new one.", "Completa o archiva una campaña existente para crear una nueva."),
            duration: 10000,
            action: {
               label: t("Gerenciar campanhas", "Manage campaigns", "Administrar campañas"),
              onClick: () => setLocation("/campaigns"),
            },
          });
        } else {
           toast.error(t("Erro ao criar. Tente novamente.", "Error creating campaign. Please try again.", "Error al crear la campaña. Inténtalo de nuevo."));
        }
      },
    },
  });

  const handleSelectGoal = (goal: GoalOption) => {
    setSelectedGoal(goal);
    setDirectMode(false);
     if (!title.trim()) setTitle(t(...goal.nameSuggestion));
    setStep(2);
  };

  const handleDirectStart = () => {
    setDirectMode(true);
    setSelectedGoal(null);
     if (!title.trim()) setTitle(t("Meu lançamento", "My launch", "Mi lanzamiento"));
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // When in direct mode, use launch/six_digits as defaults — intake AI will refine
    const type  = selectedGoal?.type  ?? ("launch" as CampaignInputType);
    const track = selectedGoal?.track ?? ("six_digits" as CampaignInputTrack);
    createMutation.mutate({ data: { title: title.trim(), type, track } });
  };

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
             <ArrowLeft className="h-3 w-3 mr-2" />{t("Voltar", "Back", "Volver")}
          </Button>
        </Link>

        {step === 1 ? (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary/70 mb-2">
               {t("Nova campanha", "New campaign", "Nueva campaña")}
            </p>
            <h1 className="text-3xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground leading-tight">
               {t("Vamos criar sua", "Let's create your", "Vamos a crear tu")}<br />
               <span className="text-primary">{t("próxima campanha", "next campaign", "próxima campaña")}</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-3 max-w-lg">
               {t("A agente faz as perguntas certas e monta tudo para você. Não precisa escolher nada agora.", "The agent asks the right questions and builds everything for you. You don't need to choose anything now.", "El agente hace las preguntas adecuadas y lo prepara todo por ti. No tienes que elegir nada todavía.")}
            </p>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary/70 mb-2">
               {t("Nova campanha · Último passo", "New campaign · Last step", "Nueva campaña · Último paso")}
            </p>
            <h1 className="text-3xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground">
               {t("Como vai se chamar", "What should we call", "¿Cómo llamaremos")}<br />
               <span className="text-primary">{t("este lançamento?", "this launch?", "a este lanzamiento?")}</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-3">
               {t("Qualquer nome serve — você pode mudar depois.", "Any name will do—you can change it later.", "Cualquier nombre sirve; puedes cambiarlo después.")}
            </p>
          </div>
        )}
      </div>

      {/* Step 1: Direct start CTA */}
      {step === 1 && (
        <div className="mb-8">
          <button
            onClick={handleDirectStart}
            className="w-full text-left border border-primary/60 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all duration-200 group relative overflow-hidden cursor-pointer"
          >
            <div className="h-0.5 w-full bg-primary opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="p-7 flex items-center justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <div className="w-12 h-12 flex items-center justify-center border border-primary/40 bg-primary/10 shrink-0">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                   <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-1">{t("Recomendado", "Recommended", "Recomendado")}</p>
                  <h3 className="font-mono font-bold text-lg text-foreground group-hover:text-primary transition-colors leading-tight">
                     {t("Iniciar briefing agora", "Start briefing now", "Iniciar briefing ahora")}
                  </h3>
                  <p className="font-mono text-[12px] text-muted-foreground/60 mt-1">
                     {t("A agente descobre o melhor cenário para você durante a conversa — sem escolhas manuais.", "The agent discovers the best scenario for you during the conversation—no manual choices needed.", "El agente encuentra el mejor escenario para ti durante la conversación, sin que tengas que elegirlo manualmente.")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-3 py-1 hidden sm:block">
                  ~3 min
                </span>
                <ChevronRight className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </div>
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border/30" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
               {t("Ou escolha um cenário específico", "Or choose a specific scenario", "O elige un escenario específico")}
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
        </div>
      )}

      {/* Step 1: Goal selection cards */}
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
                       {t(...goal.badge)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-mono font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug mb-3">
                     {t(...goal.title)}
                  </h3>

                  {/* Description */}
                  <p className="font-mono text-[12px] text-muted-foreground/60 leading-relaxed mb-4 flex-1">
                     {t(...goal.desc)}
                  </p>

                  {/* Ideal for */}
                  <p className="font-mono text-[10px] text-muted-foreground/40 italic mb-5">
                     {t(...goal.ideal)}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/20">
                    <span className={`font-mono text-[11px] font-bold ${goal.badgeTextColor} uppercase tracking-widest`}>
                       {t(...goal.targetLabel)}
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
      {step === 2 && (
        <div className="space-y-6">

          {/* Recap: selected goal OR direct mode */}
          {selectedGoal ? (
            <div className={`flex items-center gap-4 border p-4 ${selectedGoal.badgeBorderColor} ${selectedGoal.badgeBgColor}`}>
              <CheckCircle2 className={`h-5 w-5 shrink-0 ${selectedGoal.badgeTextColor}`} />
              <div className="flex-1 min-w-0">
                 <div className="font-mono text-sm font-bold text-foreground leading-snug">{t(...selectedGoal.title)}</div>
                 <div className={`font-mono text-[11px] uppercase tracking-widest mt-1 ${selectedGoal.badgeTextColor}`}>{t(...selectedGoal.targetLabel)}</div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 px-3 py-1.5 border border-border/30 hover:border-border/60"
              >
                 {t("Alterar", "Change", "Cambiar")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 border p-4 border-primary/30 bg-primary/5">
              <Brain className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                 <div className="font-mono text-sm font-bold text-foreground leading-snug">{t("Briefing guiado pelo agente", "Agent-guided briefing", "Briefing guiado por el agente")}</div>
                 <div className="font-mono text-[11px] uppercase tracking-widest mt-1 text-primary/70">{t("O agente define o cenário durante a conversa", "The agent determines the scenario during the conversation", "El agente define el escenario durante la conversación")}</div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 px-3 py-1.5 border border-border/30 hover:border-border/60"
              >
                 {t("Alterar", "Change", "Cambiar")}
              </button>
            </div>
          )}

          {/* Name form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border border-primary/20 bg-card/40 p-8 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40 pointer-events-none" />

              <label className="font-mono text-[11px] uppercase tracking-widest text-primary flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                 {t("Nome do lançamento", "Launch name", "Nombre del lanzamiento")}
              </label>
              <Input
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-13 text-base rounded-none px-4 mb-3"
                 placeholder={t("Ex.: Curso de marketing digital", "E.g., Digital Marketing Course", "Ej.: Curso de marketing digital")}
              />
              <p className="font-mono text-[11px] text-muted-foreground/40">
                 {t("Só para você se organizar internamente. A agente vai entender tudo durante o briefing.", "This is just for your own organization. The agent will understand everything during the briefing.", "Es solo para que te organices. El agente entenderá todo durante el briefing.")}
              </p>
            </div>

            {/* What happens next */}
            <div className="grid grid-cols-3 gap-4">
              {[
                 { num: "01", title: t("Briefing rápido", "Quick briefing", "Briefing rápido"), desc: t("~3 min de conversa com a agente sobre seu produto", "~3 min talking with your agent about your product", "~3 min hablando con el agente sobre tu producto") },
                 { num: "02", title: t("Plano completo", "Complete plan", "Plan completo"), desc: t("Estratégia, cronograma e canais definidos pela agente", "Strategy, timeline, and channels defined by the agent", "Estrategia, cronograma y canales definidos por el agente") },
                 { num: "03", title: t("Conteúdo + Execução", "Content + Execution", "Contenido + Ejecución"), desc: t("Você aprova e a campanha vai ao ar", "You approve, and the campaign goes live", "Tú apruebas y la campaña se publica") },
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
                 <ArrowLeft className="h-4 w-4 mr-2" />{t("Voltar", "Back", "Volver")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !title.trim()}
                className="flex-1 rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary gap-2"
              >
                {createMutation.isPending
                   ? <span className="animate-pulse font-mono">{t("Iniciando...", "Starting...", "Iniciando...")}</span>
                   : <><Brain className="h-4 w-4" />{t("Iniciar briefing com o agente", "Start briefing with the agent", "Iniciar briefing con el agente")}<ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
