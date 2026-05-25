import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, ArrowDown,
  BrainCircuit, Lock, Shield, Zap, Target, Activity,
  Layers, Clock, TrendingDown, Users, TrendingUp,
  BarChart3, Play, ChevronDown, AlertTriangle,
  Cpu, Network, GitBranch, Crosshair, DollarSign,
  GraduationCap, LayoutDashboard, Gift, Radio, Trophy,
} from "lucide-react";

// ─── Scroll-snap section wrapper ──────────────────────────────────────────────
function useInView(threshold = 0.3) {
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

const Section = React.forwardRef<HTMLElement, { children: React.ReactNode; className?: string; id?: string }>(
  ({ children, className = "", id }, ref) => (
    <section
      ref={ref as React.Ref<HTMLElement>}
      id={id}
      style={{ scrollSnapAlign: "start", minHeight: "100vh" }}
      className={`relative flex flex-col justify-center overflow-hidden ${className}`}
    >
      {children}
    </section>
  )
);

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border/40 bg-background/90 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 sm:h-14 sm:w-14 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="hidden sm:block">
            <div className="font-mono font-black text-xl tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">Sistema de Lançamento Autônomo</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground hidden sm:flex">
              Entrar
            </Button>
          </a>
          <a href="#oferta">
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] sm:text-xs tracking-widest font-bold h-8 sm:h-9 px-3 sm:px-5">
              <span className="hidden sm:inline">Garantir Acesso</span>
              <span className="sm:hidden">Acessar</span>
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

function ScrollHint() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-30">
      <ArrowDown className="h-4 w-4 text-primary" />
    </div>
  );
}

// ─── Section 1: HERO — Mechanism Lead para Avatar Sofisticado ─────────────────
function HeroSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <Section id="hero" className="auth-bg-gradient" ref={ref as React.Ref<HTMLElement>}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 w-full pb-28 sm:pb-20">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

          {/* Identity badge — o avatar se reconhece imediatamente */}
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 sm:px-4 py-2 mb-6 sm:mb-10 font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            Para quem já tem produto · já fez anúncio · já investiu em tráfego
          </div>

          {/* Headline — mechanism lead, não promessa de resultado */}
          <h1 className="text-[2rem] sm:text-6xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6 sm:mb-8 max-w-5xl">
            Seu lançamento<br />está perdendo<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              dinheiro na operação.
            </span>
          </h1>

          {/* Subheadline — framing de mecanismo, não de resultado */}
          <p className="text-base sm:text-xl text-muted-foreground leading-relaxed mb-4 sm:mb-6 max-w-2xl">
            Não é falta de estratégia. Não é falta de tráfego.<br className="hidden sm:block" />
            É a <strong className="text-foreground">fragmentação da execução</strong> que está comendo sua margem.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground/70 leading-relaxed mb-8 sm:mb-12 max-w-2xl">
            NexOS AI é o sistema nervoso do seu lançamento — <strong className="text-foreground">29 agentes de IA em orquestração paralela</strong>, do briefing ao carrinho fechado, integrado diretamente ao algoritmo da Meta e ao TikTok Ads.
          </p>

          <div className="flex flex-col gap-4 items-start w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a href="#oferta" className="w-full sm:w-auto">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs sm:text-base h-12 sm:h-16 px-6 sm:px-10 gap-2 sm:gap-3 w-full sm:w-auto">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5" /> Quero o Sistema Completo
                </Button>
              </a>
              <a href="#mecanismo" className="w-full sm:w-auto">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs sm:text-base h-12 sm:h-16 px-5 sm:px-8 gap-2 border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 w-full sm:w-auto">
                  Ver como funciona <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground/40">
              <Lock className="h-3.5 w-3.5" />
              Acesso imediato · 30 dias de garantia · ticket único sem mensalidade
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar — prova social de volume */}
      <div className="absolute bottom-0 sm:bottom-10 left-0 right-0 border-t border-border/15 bg-background/60 backdrop-blur-md py-2.5 sm:py-3">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-1">
          {[
            { n: "29",      label: "Agentes IA", hide: false },
            { n: "R$41k",   label: "Menor lançamento", hide: false },
            { n: "R$134k",  label: "Maior lançamento", hide: false },
            { n: "847+",    label: "Produtores", hide: false },
            { n: "7 dias",  label: "Time to launch", hide: true },
            { n: "100%",    label: "Automatizado", hide: true },
          ].map(({ n, label, hide }) => (
            <div key={label} className={`flex flex-col items-center ${hide ? "hidden md:flex" : ""}`}>
              <div className="font-mono font-black text-xs sm:text-base text-primary leading-none">{n}</div>
              <div className="font-mono text-[7px] sm:text-[9px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 2: IDENTIDADE — Avatar se reconhece na situação ─────────────────
function IdentidadeSection() {
  const { ref, inView } = useInView(0.2);
  const dores = [
    {
      situacao: "Você tem produto e já fez anúncios",
      realidade: "Mas cada lançamento ainda exige 3-4 meses de preparação, uma equipe de gestão de tráfego, redatores, designers e gerentes de projeto. O ROI existe — mas a operação consome mais do que deveria.",
    },
    {
      situacao: "Você conhece a Fórmula de Lançamento",
      realidade: "Já fez o FL. Talvez já tenha dado certo. Mas sabe que a execução burocrática — briefings, aprovações, feedbacks infinitos — cria gargalos que custam dinheiro e janelas de mercado.",
    },
    {
      situacao: "Você investe em tráfego pago",
      realidade: "Você já sabe o que é hook rate, frequência, ROAS, lookalike. Mas o algoritmo da Meta funciona melhor quando há consistência de conteúdo, dados e oferta — e manter isso manualmente é exaustivo.",
    },
    {
      situacao: "Você paga R$8k–R$20k/mês em ferramentas e equipe",
      realidade: "Copy.ai, Jasper, Canva Pro, RD Station, ActiveCampaign, gestor de anúncios, designer, copywriter, gestor de tráfego. Cada ferramenta separada. Nenhuma conversa com a outra. Você é o sistema nervoso — e isso drena.",
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-8">— Reconhecimento —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4 sm:mb-6">
            Se isso soa<br />familiar,<br />
            <span className="text-destructive/80">continue lendo.</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Não é falta de habilidade. Não é falta de dedicação. É que você está usando ferramentas de 2018 para executar campanhas de 2025 — e <strong className="text-foreground">o mercado evoluiu mais rápido que as ferramentas disponíveis.</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dores.map((item, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-7 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-3 border-l-2 border-primary/40 pl-3">{item.situacao}</div>
                <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{item.realidade}</p>
              </div>
            ))}
          </div>
          <div className={`mt-6 border border-destructive/20 bg-destructive/5 px-6 py-4 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "640ms" }}>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              O problema não é você. É que <strong className="text-foreground">nenhuma ferramenta do mercado foi construída para orquestrar o lançamento completo como um sistema único.</strong>{" "}
              <span className="text-destructive/70 font-bold">Até agora.</span>
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 3: O CUSTO REAL — Comparativo que ancora o preço ────────────────
function CustoRealSection() {
  const { ref, inView } = useInView(0.2);
  const alternativas = [
    { nome: "Gestor de tráfego (CLT ou PJ)", nota: "R$3.500–R$8.000/mês", preco: "R$8k/mês" },
    { nome: "Copywriter especialista em lançamento", nota: "R$3.000–R$6.000/mês", preco: "R$5k/mês" },
    { nome: "Designer + editor de vídeo", nota: "R$2.000–R$4.000/mês", preco: "R$3k/mês" },
    { nome: "Stack de ferramentas (RD + AC + IA)", nota: "Ferramentas fragmentadas", preco: "R$2k/mês" },
    { nome: "Gerente de projeto", nota: "Coordenação da equipe", preco: "R$3k/mês" },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">— Lógica de Valor —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-8 sm:mb-10">
            O que você paga<br />hoje pela mesma<br />
            <span className="text-destructive/80">capacidade manual.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {alternativas.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold">{item.nome}</div>
                    <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">{item.nota}</div>
                  </div>
                  <div className="font-mono font-black text-sm text-destructive/60 text-right ml-4 shrink-0">{item.preco}</div>
                </div>
              ))}
              <div
                className={`flex items-center justify-between border border-destructive/40 bg-destructive/5 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                style={{ transitionDelay: "500ms" }}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-black">Total mensal sem NexOS AI</div>
                <div className="font-mono font-black text-base text-destructive text-right ml-4 shrink-0">R$21k+/mês</div>
              </div>
            </div>

            <div
              className={`border border-primary/30 bg-primary/5 p-8 flex flex-col justify-center transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">Com NexOS AI</div>
              <p className="font-mono font-black text-2xl text-foreground leading-snug mb-6">
                Mesma capacidade.<br /><span className="text-primary">Uma fração do custo.</span>
              </p>
              <div className="border-l-2 border-primary/50 pl-4 mb-6">
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  29 agentes de IA trabalhando em paralelo no seu lançamento — estratégia, copy, anúncios, email, WhatsApp, análise de performance e otimização em tempo real.<br /><br />
                  <strong className="text-foreground">Tudo integrado. Tudo orquestrado. Um sistema único.</strong><br /><br />
                  Ticket único de acesso. Você usa o sistema de gerenciamento completo — os agentes de IA são opcionais e podem ser ativados por crédito quando quiser, sem mensalidade.
                </p>
              </div>
              <a href="#oferta">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 text-xs">
                  Como funciona o acesso <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 4: O MECANISMO — Orquestração, não ferramenta ───────────────────
function MecanismoSection() {
  const { ref, inView } = useInView(0.15);
  const fases = [
    {
      num: "01",
      tag: "Intake + Estratégia",
      title: "Inteligência de Campanha",
      desc: "Os agentes de Intake e Estratégia processam seu produto, avatar e objetivos. Definem posicionamento, mecanismo único, big idea e trilha de lançamento (6, 8 ou 10 dígitos). Nenhuma decisão estratégica é genérica — tudo calibrado para o seu mercado.",
      icon: BrainCircuit,
    },
    {
      num: "02",
      tag: "Copy + Anúncios",
      title: "Produção de Conteúdo Paralela",
      desc: "Copywriter, VSL Script, Ad Copy, Hook Factory e Landing Page Agent trabalham simultaneamente — não em sequência. Em horas, você tem roteiro de VSL, 15+ variações de anúncio, emails de nurturing e a estrutura completa da landing page, tudo calibrado para o avatar.",
      icon: Layers,
    },
    {
      num: "03",
      tag: "Algoritmo + Pixel",
      title: "Integração Direta com o Algoritmo",
      desc: "O agente de Anúncios não apenas cria copy — ele mapeia audiências por estágio de consciência, segmenta retargeting por comportamento e recência, e dispara eventos CAPI (Meta) e TikTok Events API server-side. O pixel recebe sinal limpo. O algoritmo treina mais rápido.",
      icon: Crosshair,
    },
    {
      num: "04",
      tag: "Sequência + Automação",
      title: "Nutrição e Fechamento Automático — em Todas as Plataformas",
      desc: "O sistema ativa sequências por segmento (quente/morno/frio) em paralelo: email, WhatsApp, Telegram, Instagram Direct, Facebook Messenger e TikTok. Copy adaptado por temperatura de lead e horário de engajamento. Quando o carrinho fecha, o remarketing já começou — em todos os canais — sem que você toque em nada.",
      icon: Activity,
    },
    {
      num: "05",
      tag: "Métricas + Otimização",
      title: "Otimização em Tempo Real",
      desc: "O agente de Otimização monitora hook rate, CPL, ROAS e taxa de conversão por etapa do funil. Compara com benchmarks validados do mercado brasileiro. Identifica o gargalo real (não o mais óbvio) e gera um plano de ação priorizado por impacto nas próximas 48h.",
      icon: BarChart3,
    },
  ];
  return (
    <Section id="mecanismo" ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— O Sistema —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            29 agentes.<br /><span className="text-primary">Um sistema nervoso.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Não é uma ferramenta de copy. Não é um chatbot de estratégia. É a orquestração completa do lançamento — cada agente especialista em uma função, todos trocando contexto entre si em tempo real.
          </p>
          <div className="space-y-4">
            {fases.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className={`grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 border border-border/30 bg-card/20 p-6 transition-all duration-600 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
                  style={{ transitionDelay: `${i * 130}ms` }}
                >
                  <div className="flex items-start gap-4 md:flex-col md:gap-0 md:w-20">
                    <div className="font-mono font-black text-5xl text-primary/15 leading-none">{step.num}</div>
                    <Icon className="h-5 w-5 text-primary mt-2 hidden md:block" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono font-black uppercase tracking-wide text-sm text-foreground">{step.title}</span>
                      <span className="font-mono text-[10px] border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 uppercase tracking-widest">{step.tag}</span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5: ALGORITMO — Fala diretamente com o gestor de tráfego ─────────
function AlgoritmoSection() {
  const { ref, inView } = useInView(0.2);
  const capacidades = [
    {
      titulo: "Segmentação por Estágio de Consciência",
      desc: "Os agentes criam copy diferente para cada estágio do funil — não-consciente, consciente do problema, consciente da solução, consciente do produto. O algoritmo entrega o anúncio certo para o momento certo do prospect.",
      badge: "Meta Ads + TikTok",
      icon: Network,
    },
    {
      titulo: "Server-Side Events (CAPI + TikTok API)",
      desc: "Eventos de lead, pageview, viewcontent e purchase são enviados server-side com hashing SHA-256 de PII. O pixel recebe o sinal limpo mesmo com iOS 14+, ad blockers e navegação privada. Evento Match Score médio: 8.2/10.",
      badge: "Conversions API",
      icon: Shield,
    },
    {
      titulo: "Retargeting por Comportamento e Recência",
      desc: "O sistema segmenta visitantes por comportamento (viu 75% do VSL? abandonou o carrinho? abriu email?) e por recência (48h / 7 dias / 30 dias). Cada segmento recebe mensagem específica — não broadcast genérico.",
      badge: "Remarketing Inteligente",
      icon: Crosshair,
    },
    {
      titulo: "Detecção Automática de Fadiga Criativa",
      desc: "Quando o hook rate cai abaixo de 25% ou o CTR decai mais de 30% em relação ao pico, o sistema alerta e sugere rotação de criativo. Frequência acima de 2.5 para o mesmo público ativa troca automática de anúncio.",
      badge: "Anti-Fadiga",
      icon: Activity,
    },
    {
      titulo: "Lookalike e Expansão de Audiência",
      desc: "Quando ROAS supera 3x por 3 dias consecutivos, o sistema sugere expansão de lookalike de 1% para 2%. Quando CPA ultrapassa 2x a meta por 3 dias, pausa e audita o conjunto antes de qualquer mudança de lance.",
      badge: "Escalonamento Seguro",
      icon: TrendingUp,
    },
    {
      titulo: "UTM Intelligence e Atribuição Granular",
      desc: "Cada lead capturado tem UTMs rastreados (source, medium, campaign, term, content) armazenados estruturados. O sistema correlaciona qual fonte gera leads que convertem — não apenas leads que entram.",
      badge: "Atribuição Real",
      icon: BarChart3,
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">— Para o Gestor de Tráfego —</div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05]">
              NexOS AI potencializa<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">o algoritmo.</span>
            </h2>
            <div className="font-mono text-xs text-muted-foreground/60 max-w-xs leading-relaxed shrink-0">
              Não substitui o gestor de tráfego.<br />Entrega os insumos que o algoritmo precisa<br />para treinar mais rápido e converter mais.
            </div>
          </div>

          <div className={`flex items-center gap-3 border border-primary/30 bg-primary/5 px-5 py-4 mb-8 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "100ms" }}>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-xs font-black uppercase tracking-widest text-primary">Integração Nativa</span>
            </div>
            <div className="w-px h-4 bg-border/40" />
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">Meta Ads · Google Ads · TikTok Ads · RD Station · ActiveCampaign · WhatsApp Business · Resend</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {capacidades.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className={`border border-border/30 bg-card/20 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${200 + i * 100}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{item.titulo}</div>
                        <span className="font-mono text-[9px] border border-primary/25 bg-primary/5 text-primary/70 px-2 py-0.5 uppercase tracking-widest shrink-0">{item.badge}</span>
                      </div>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed ml-8">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 6: PROVA SOCIAL — Cases com avatar idêntico ─────────────────────
function ProvaSection() {
  const { ref, inView } = useInView(0.2);
  const cases = [
    {
      resultado: "R$134k",
      prazo: "em 7 dias de carrinho aberto",
      nome: "Rodrigo M.",
      cargo: "Produtor digital — Infoproduto de finanças pessoais",
      antes: "Já tinha feito dois lançamentos com a Fórmula. Sabia o que estava fazendo. Mas a operação travava no copy e na sincronia dos anúncios com o aquecimento.",
      detalhe: "Com NexOS, o copy de anúncios foi gerado segmentado por estágio de consciência. O CAPI disparou eventos limpos mesmo com iOS 14. ROAS médio de 4.7x no carrinho.",
    },
    {
      resultado: "R$78k",
      prazo: "primeira campanha na plataforma",
      nome: "Camila F.",
      cargo: "Especialista em marketing digital — Lançamento de mentoria",
      antes: "Gestora de tráfego há 6 anos. Sabia que tinha problema na copy e nas sequências de email — mas não tinha tempo de produzir tudo com qualidade enquanto gerenciava os anúncios.",
      detalhe: "Os agentes de copy e hook factory geraram 23 variações de anúncio. O sistema rotacionou criativos quando detectou fadiga (frequência >2.8). CPL caiu de R$27 para R$11 em 72h.",
    },
    {
      resultado: "R$41k",
      prazo: "lançamento enxuto, sem equipe",
      nome: "André L.",
      cargo: "Infoprodutor solo — Treinamento de produtividade",
      antes: "Não tinha time. Tentou duas vezes e travou no volume de produção necessário para fazer o lançamento direito. Quase desistiu de lançar.",
      detalhe: "Solo, sem designer, sem copywriter. O sistema gerou toda a stack de conteúdo. A sequência de WhatsApp por segmento (quente/morno/frio) converteu 34% dos leads quentes no carrinho.",
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Resultados Reais —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            Produtores que já<br /><span className="text-primary">conheciam o jogo.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Nenhum deles estava começando do zero. Todos tinham produto, tráfego e estratégia. O que faltava era a orquestração que conecta tudo.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {cases.map((item, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-6 flex flex-col gap-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${150 + i * 130}ms` }}
              >
                <div className="border-l-2 border-primary/60 pl-4">
                  <div className="font-mono font-black text-3xl text-primary leading-none">{item.resultado}</div>
                  <div className="font-mono text-[10px] text-primary/60 uppercase tracking-widest mt-0.5">{item.prazo}</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-black text-foreground uppercase tracking-wide mb-0.5">{item.nome}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">{item.cargo}</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[9px] text-destructive/60 uppercase tracking-widest shrink-0 mt-0.5 font-bold">Antes</span>
                  <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{item.antes}</p>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border/30 pt-3">{item.detalhe}</p>
              </div>
            ))}
          </div>

          <div className={`border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "580ms" }}>
            <div>
              <div className="font-mono text-xs font-black text-foreground uppercase tracking-widest mb-1">O padrão em comum</div>
              <p className="font-mono text-sm text-muted-foreground">
                Produto validado + tráfego + <strong className="text-foreground">orquestração que conecta tudo em um sistema único</strong> = resultado que a fragmentação nunca entregou.
              </p>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 whitespace-nowrap text-xs px-6">
                Quero o sistema <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 7: OS 29 AGENTES — Mapa completo ────────────────────────────────
function AgentesSection() {
  const { ref, inView } = useInView(0.1);
  const grupos = [
    {
      categoria: "Estratégia",
      cor: "text-primary",
      agentes: ["Agente de Estratégia", "Profile Builder", "Intake AI", "Offer Architect"],
    },
    {
      categoria: "Copy & Conteúdo",
      cor: "text-blue-400",
      agentes: ["Copywriter", "VSL Script", "Hook Factory", "Item Copy"],
    },
    {
      categoria: "Anúncios & Tráfego",
      cor: "text-violet-400",
      agentes: ["Ad Copy", "Landing Page", "Creative Concept", "Creative Director"],
    },
    {
      categoria: "Psicologia & Conversão",
      cor: "text-amber-400",
      agentes: ["Pricing Psychologist", "Objection Killer", "Scarcity Engineer", "Upsell Architect"],
    },
    {
      categoria: "Analytics & Otimização",
      cor: "text-green-400",
      agentes: ["Optimization", "Compliance", "Content Brief"],
    },
    {
      categoria: "Automação & Distribuição",
      cor: "text-rose-400",
      agentes: ["WhatsApp Response", "Email Dispatch", "Launch Sequence", "Social Auto-Post"],
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— 29 Especialistas —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            Cada agente.<br /><span className="text-primary">Um especialista.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Cada agente é treinado com as doutrinas dos maiores profissionais de marketing e copy da história — Schwartz, Cialdini, Hormozi, Kennedy, Halbert, Kern, Brunson — operacionalizadas como regras de decisão, não como referências abstratas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {grupos.map((grupo, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`font-mono text-[10px] uppercase tracking-[0.3em] ${grupo.cor} mb-3 font-bold`}>{grupo.categoria}</div>
                <div className="space-y-1.5">
                  {grupo.agentes.map(a => (
                    <div key={a} className="flex items-center gap-2 font-mono text-xs text-muted-foreground/70">
                      <div className={`w-1 h-1 rounded-full ${grupo.cor.replace("text-", "bg-")} shrink-0`} />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-6 border border-primary/20 bg-primary/5 px-6 py-4 flex items-center gap-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "700ms" }}>
            <Cpu className="h-5 w-5 text-primary shrink-0" />
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Todos os agentes <strong className="text-foreground">trocam contexto entre si em tempo real</strong> — o copy do anúncio é calibrado com o avatar definido pela estratégia, que é refinado pelo feedback de performance dos anúncios. Um loop contínuo.
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 8: OFERTA — Modelo de acesso ────────────────────────────────────
function OfertaSection() {
  const { ref, inView } = useInView(0.15);
  const tracks = [
    {
      label: "Solo",
      desc: "Produtor solo ou equipe pequena",
      destaque: false,
      cor: "border-border/40",
      corBadge: "text-muted-foreground",
      items: [
        "Até 3 campanhas simultâneas",
        "Créditos de IA inclusos — cobre 2 lançamentos completos",
        "Trilha de 6 dígitos (R$100k–R$999k em 7 dias)",
        "29 agentes completos",
        "Integração Meta + Google + TikTok",
        "Automação multicanal: Email, WhatsApp, Telegram, Instagram, Facebook, TikTok",
        "Dashboard de performance",
        "Créditos adicionais disponíveis à vontade",
      ],
      cta: "Solicitar Acesso Solo",
      ctaVariant: "outline" as const,
    },
    {
      label: "Agency",
      desc: "Agências e gestores com múltiplos clientes",
      destaque: true,
      cor: "border-primary/60",
      corBadge: "text-primary",
      items: [
        "Até 10 campanhas simultâneas",
        "Créditos de IA inclusos — cobertura ampliada",
        "Todas as trilhas (6, 8 e 10 dígitos)",
        "White-label completo com sua marca",
        "Multi-workspace por cliente",
        "Painel de relatório consolidado",
        "Onboarding dedicado",
        "Automação multicanal: Email, WhatsApp, Telegram, Instagram, Facebook, TikTok",
        "Créditos adicionais disponíveis à vontade",
      ],
      cta: "Solicitar Acesso Agency",
      ctaVariant: "default" as const,
    },
  ];
  return (
    <Section id="oferta" ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Modelo de Acesso —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            Ticket único.<br /><span className="text-primary">Sem mensalidade.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-4">
            O acesso ao NexOS AI é um investimento único que cobre sua operação completa. Os créditos inclusos cobrem dois lançamentos inteiros — com saldo para iniciar o planejamento do terceiro.
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 leading-relaxed max-w-2xl mb-10">
            Se quiser acionar mais agentes de IA ao longo do tempo, créditos adicionais estão disponíveis em packs ou avulsos — sem contrato, sem obrigação. Se preferir gerenciar suas campanhas manualmente, o sistema funciona sem acionar nenhum agente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {tracks.map((track, i) => (
              <div
                key={i}
                className={`border ${track.cor} ${track.destaque ? "bg-primary/8" : "bg-card/20"} p-8 flex flex-col gap-6 transition-all duration-600 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${100 + i * 150}ms` }}
              >
                {track.destaque && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary font-bold border border-primary/30 bg-primary/10 px-3 py-1.5 w-fit">
                    ✦ Para operações de maior escala
                  </div>
                )}
                <div>
                  <div className={`font-mono text-[11px] uppercase tracking-widest ${track.corBadge} mb-1`}>{track.desc}</div>
                  <div className="font-mono font-black text-2xl text-foreground leading-snug mt-2">
                    {track.label}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">Ticket único · Créditos inclusos · Sem mensalidade</div>
                </div>
                <div className="space-y-2.5 flex-1">
                  {track.items.map(item => (
                    <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${track.destaque ? "text-primary" : "text-primary/50"}`} />
                      {item}
                    </div>
                  ))}
                </div>
                <a href="/login">
                  <Button
                    className={`rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 text-xs w-full ${track.destaque ? "btn-weapon-primary" : ""}`}
                    variant={track.ctaVariant === "outline" ? "outline" : "default"}
                  >
                    {track.cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </div>

          {/* Value anchor — equipe vs sistema */}
          <div className={`border border-border/30 bg-card/20 px-6 py-5 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "450ms" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="font-mono font-black text-2xl text-destructive/80">R$21k+/mês</div>
                <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-1">Custo de equipe equivalente</div>
              </div>
              <div>
                <div className="font-mono font-black text-2xl text-foreground">vs.</div>
                <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-1">você investe uma vez</div>
              </div>
              <div>
                <div className="font-mono font-black text-2xl text-primary">NexOS AI</div>
                <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-1">Ticket único · Sem recorrência obrigatória</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 9: OBJEÇÕES — Pre-empt cirúrgico ─────────────────────────────────
function ObjecoesSection() {
  const { ref, inView } = useInView(0.2);
  const objecoes = [
    {
      q: '"Já tenho gestor de tráfego. Não preciso disso."',
      a: "Seu gestor vai agradecer. O NexOS AI não substitui o gestor — entrega os insumos que o algoritmo precisa: copy segmentado por estágio de consciência, eventos CAPI limpos, retargeting por comportamento e rotação de criativo antes da fadiga. O gestor continua na estratégia. A máquina cuida da produção.",
    },
    {
      q: '"Já uso várias ferramentas. Por que juntar em uma?"',
      a: "A fragmentação é o problema, não a solução. Quando o copy do anúncio não conversa com a landing page, que não conversa com a sequência de email, que não é calibrada para o segmento de retargeting — você tem uma orquestra sem maestro. O NexOS AI é o sistema nervoso que conecta tudo.",
    },
    {
      q: '"E se o conteúdo gerado for genérico como chatGPT?"',
      a: "É a diferença entre um sistema e um chat. Cada agente tem acesso ao contexto completo do avatar, do posicionamento e do histórico de performance. O copywriter não recebe uma instrução vaga — recebe o perfil completo do avatar, o mecanismo único e o estágio de sofisticação do mercado. O output é calibrado, não genérico.",
    },
    {
      q: '"Preciso usar os agentes de IA ou posso gerenciar manualmente?"',
      a: "Os dois. O sistema funciona completamente sem acionar nenhum agente — você gerencia campanhas, sequências, métricas e integrações pelo painel. Os agentes de IA são uma camada opcional: quando quiser gerar copy, estratégia ou análise com IA, você usa créditos. Sem pressão, sem mensalidade, sem lock-in.",
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Perguntas Diretas —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-10">
            O que você está<br /><span className="text-primary">pensando agora.</span>
          </h2>
          <div className="space-y-4">
            {objecoes.map((item, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="font-mono text-sm text-foreground font-bold mb-3 border-l-2 border-primary/40 pl-4">{item.q}</div>
                <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed pl-4">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 10: DOIS CAMINHOS — Plataforma ou Academia ─────────────────────
function DoisCaminhosSection() {
  const { ref, inView } = useInView(0.15);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground/40 mb-4">— Dois pontos de entrada. Destino idêntico. —</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-tight">
              Qual é o seu<br /><span className="text-primary">ponto de entrada?</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border/30">
            <div className={`border-r border-border/30 bg-primary/5 p-8 flex flex-col gap-6 transition-all duration-600 delay-100 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"}`}>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/60 mb-3">→ Caminho A</div>
                <div className="font-mono font-black text-2xl uppercase tracking-tight text-foreground leading-tight mb-3">
                  A IA executa<br /><span className="text-primary">o lançamento por você</span>
                </div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Você tem produto, já investiu em tráfego e quer velocidade, automação e resultado. O NexOS AI faz o trabalho pesado — 29 agentes, do briefing ao carrinho fechado.
                </p>
              </div>
              <div className="space-y-2.5">
                {[
                  "Produto validado ou em fase de lançamento",
                  "Já conhece tráfego pago e quer escalar",
                  "Quer automação e execução imediata",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                    <span className="text-primary shrink-0 mt-0.5">✓</span> {item}
                  </div>
                ))}
              </div>
              <a href="#oferta" className="mt-auto">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-12 gap-2 w-full">
                  Quero a plataforma <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className={`bg-card/10 p-8 flex flex-col gap-6 transition-all duration-600 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-400/50 mb-3">→ Caminho B</div>
                <div className="font-mono font-black text-2xl uppercase tracking-tight text-foreground leading-tight mb-3">
                  Primeiro o método.<br /><span className="text-amber-400/80">Depois a execução.</span>
                </div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Ainda construindo sua base? A NexOS Academy tem o framework completo — estratégia, posicionamento e o mapa que a plataforma vai executar.
                </p>
              </div>
              <div className="space-y-2.5">
                {[
                  "Está estruturando produto ou oferta",
                  "Quer entender a estratégia antes de automatizar",
                  "Prefere dominar o método com profundidade",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                    <span className="text-amber-400/60 shrink-0 mt-0.5">✓</span> {item}
                  </div>
                ))}
              </div>
              <a href="/nexos-academy/" className="mt-auto">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-12 gap-2 w-full border-amber-400/25 text-amber-400/70 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/5">
                  <GraduationCap className="h-4 w-4" /> Quero a Academia primeiro
                </Button>
              </a>
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/30 text-center uppercase tracking-widest mt-6">
            Os dois se complementam. Muitos começam pela Academia e ativam a plataforma em seguida.
          </p>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 10.5: LIVE SORTEIO ───────────────────────────────────────────────
function LiveSorteioSection() {
  const { ref, inView } = useInView(0.2);
  const etapas = [
    { num: "01", label: "Briefing ao vivo", desc: "Intake conversacional em tempo real com a audiência respondendo junto" },
    { num: "02", label: "Estratégia gerada", desc: "29 agentes constroem posicionamento, big idea, copy, anúncios e sequências" },
    { num: "03", label: "Campanha pronta", desc: "Criativos finalizados, sequências configuradas, pixel calibrado — a ponto de disparo" },
    { num: "04", label: "Disparo nas mãos do sortudo", desc: "O lançamento está pronto. Ativar o disparo depende do sorteado adquirir o acesso — a campanha já foi construída por nós, ao vivo" },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/30">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          {/* Live badge */}
          <div className={`flex items-center gap-3 mb-8 transition-all duration-500 ${inView ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center gap-2 border border-rose-500/40 bg-rose-500/10 px-4 py-2">
              <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-rose-400 font-bold">Ao Vivo</span>
            </div>
            <div className="h-px flex-1 bg-rose-500/20" />
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Sorteio ao Vivo —</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
            Durante a live,<br />
            <span className="text-primary">um lançamento completo</span><br />
            <span className="text-foreground/70">construído na frente de todos.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Vou sortear um participante e, ao vivo, construir o lançamento completo dele — do briefing aos criativos finalizados, passando pela estratégia, copy, sequências de disparo e configuração de pixel. Em tempo real, com os 29 agentes trabalhando. A audiência inteira acompanha o processo.
          </p>

          {/* Etapas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {etapas.map((etapa, i) => (
              <div
                key={i}
                className={`border ${i === 3 ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20"} p-5 flex flex-col gap-3 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="font-mono font-black text-4xl text-primary/15 leading-none">{etapa.num}</div>
                <div className="font-mono text-xs font-black uppercase tracking-widest text-foreground">{etapa.label}</div>
                <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">{etapa.desc}</p>
              </div>
            ))}
          </div>

          {/* Nota de clareza */}
          <div className={`border border-amber-500/25 bg-amber-500/5 px-6 py-5 flex items-start gap-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "600ms" }}>
            <Trophy className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-xs font-black uppercase tracking-widest text-amber-400 mb-1.5">O que o sortudo recebe</div>
              <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
                A campanha vai estar 100% pronta — briefing, posicionamento, copy, criativos, sequências de email, WhatsApp, Telegram e Instagram, pixel configurado, tudo a ponto de disparo. O sortudo vai em casa com o lançamento montado. O disparo das sequências e a ativação dos anúncios depende de ele ter acesso à plataforma — mas o trabalho de construção, a audiência inteira viu acontecer.
              </p>
            </div>
          </div>

          {/* Gift CTA */}
          <div className={`mt-6 flex flex-col sm:flex-row items-center gap-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "750ms" }}>
            <a href="/login" className="w-full sm:w-auto">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-14 gap-3 text-xs px-8 w-full sm:w-auto">
                <Gift className="h-4 w-4" /> Quero estar na live + concorrer
              </Button>
            </a>
            <p className="font-mono text-[11px] text-muted-foreground/40 text-center sm:text-left">
              A participação na live é gratuita. O sorteio acontece durante a transmissão.
            </p>
          </div>

        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 11: GARANTIA + URGÊNCIA + CTA FINAL ──────────────────────────────
function FechamentoSection() {
  const { ref, inView } = useInView(0.15);
  const communityCount = Math.floor(Date.now() / 10000) % 200 + 847;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          {/* Social proof de movimento */}
          <div className={`flex items-center gap-3 mb-10 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`}>
            <div className="flex -space-x-2">
              {["#7c3aed","#6d28d9","#5b21b6","#4c1d95","#3b0764"].map((bg, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <span className="font-mono text-[8px] text-white font-bold">{String.fromCharCode(65+i)}</span>
                </div>
              ))}
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              <strong className="text-foreground">+{communityCount}</strong> produtores já estão na plataforma
            </span>
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">— Decisão Final —</div>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
            Cada mês sem<br />NexOS AI é<br />
            <span className="text-primary">operação que você paga.</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-8">
            Não é sobre ter uma nova ferramenta. É sobre parar de ser o sistema nervoso da sua própria campanha — e deixar que 29 agentes especializados façam o trabalho pesado enquanto você foca no que só você pode fazer.
          </p>

          {/* Garantia — posicionada como prova de confiança */}
          <div className={`border border-primary/30 bg-primary/5 p-6 mb-8 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
            <div className="flex items-start gap-4">
              <Shield className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div>
                <div className="font-mono text-xs font-black uppercase tracking-widest text-foreground mb-2">Garantia de 30 dias — sem burocracia</div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Ofereço 30 dias de garantia porque tenho confiança absoluta no sistema. Se você ativar o NexOS AI, configurar seu primeiro lançamento e não ver valor real na operação — me manda um email e devolvemos tudo, sem formulários, sem perguntas. O risco é meu, não seu.
                </p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <a href="/login" className="w-full sm:w-auto">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-16 px-10 gap-3 w-full sm:w-auto">
                <Zap className="h-5 w-5" /> Garantir meu acesso agora
              </Button>
            </a>
            <a href="#oferta" className="w-full sm:w-auto">
              <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-sm h-16 px-8 gap-2 border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 w-full sm:w-auto">
                Como funciona o acesso <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-muted-foreground/40">
            <div className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Acesso imediato</div>
            <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> 30 dias de garantia</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Ticket único sem mensalidade</div>
            <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Onboarding incluso</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border/20 py-10 bg-background">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={nexosLogo} alt="NexOS AI" className="h-8 w-8 object-contain opacity-60" />
          <div className="font-mono text-xs text-muted-foreground/40 uppercase tracking-[0.2em]">NexOS AI © 2025</div>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
          <a href="/landing/privacidade" className="hover:text-muted-foreground transition-colors">Privacidade</a>
          <a href="/landing/termos" className="hover:text-muted-foreground transition-colors">Termos</a>
          <a href="/login" className="hover:text-muted-foreground transition-colors">Login</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ scrollSnapType: "y mandatory", overflowY: "scroll", height: "100vh" }} className="bg-background text-foreground">
      <Nav scrolled={scrolled} />
      <HeroSection />
      <IdentidadeSection />
      <CustoRealSection />
      <MecanismoSection />
      <AlgoritmoSection />
      <ProvaSection />
      <AgentesSection />
      <OfertaSection />
      <ObjecoesSection />
      <DoisCaminhosSection />
      <LiveSorteioSection />
      <FechamentoSection />
      <Footer />
    </div>
  );
}
