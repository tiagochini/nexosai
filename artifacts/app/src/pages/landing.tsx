import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, ArrowDown,
  BrainCircuit, Mail, MessageSquare,
  Lock, Shield, Zap, Target, Activity,
  ChevronRight, X, Layers, TrendingUp, DollarSign,
} from "lucide-react";
import { toast } from "sonner";

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

function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border/40 bg-background/90 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={nexosLogo} alt="NexOS AI" className="h-14 w-14 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="hidden sm:block">
            <div className="font-mono font-black text-xl tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">Automação de Vendas em Volume</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">Já tenho acesso</Button>
          </Link>
          <Link href="/comprar">
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-9 px-5">Aderir agora</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function ScrollHint() {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">role</span>
      <ArrowDown className="h-4 w-4 text-primary/40" />
    </div>
  );
}

// ─── Section 1: HERO ─────────────────────────────────────────────────────────
function HeroSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <Section id="hero" className="auth-bg-gradient" ref={ref as React.Ref<HTMLElement>}>
      <div className="max-w-6xl mx-auto px-6 pt-20 w-full">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-10 font-mono text-xs uppercase tracking-[0.3em] text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Lançamento Oficial · Acesso Imediato
          </div>
          <h1 className="text-6xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-none mb-8 max-w-4xl">
            Você está<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">vendendo menos</span><br />
            do que poderia.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl">
            A maioria das pessoas que tem um produto fatura uma fração do que poderia —
            não por falta de esforço, mas porque vender em volume exige uma operação que uma pessoa só não consegue sustentar.
            <strong className="text-foreground"> O NexOS AI é essa operação.</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/comprar">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                Quero Vender Mais <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground/60">
              <Lock className="h-4 w-4" />
              R$3.990 · Acesso completo · Pagamento único
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 2: O PROBLEMA REAL ───────────────────────────────────────────────
function ProblemSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">O problema real</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Você tem produto.<br />
            Você tem audiência.<br />
            <span className="text-destructive/80">O número não fecha.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {[
              { pain: "Estratégia travada", reason: "Você não sabe qual ação tomar agora para gerar mais vendas esta semana" },
              { pain: "Copy não converte", reason: "As mensagens saem mas as vendas não chegam — o problema está no ângulo, não no produto" },
              { pain: "Operação manual", reason: "Você faz tudo sozinho: responde, segmenta, agenda, fecha. Isso não escala." },
            ].map((item, i) => (
              <div
                key={i}
                className={`border border-destructive/20 bg-destructive/5 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <X className="h-4 w-4 text-destructive/60 shrink-0" />
                  <span className="font-mono font-bold text-sm uppercase tracking-wider text-foreground/80">{item.pain}</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.reason}</p>
              </div>
            ))}
          </div>
          <div className="border-l-2 border-primary/40 pl-6">
            <p className="font-mono text-base text-muted-foreground leading-relaxed">
              Não é falta de produto. Não é falta de talento.<br />
              <strong className="text-foreground">É falta de uma máquina de execução funcionando ao seu lado.</strong>
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 3: CUSTO ─────────────────────────────────────────────────────────
function CustoSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">O custo de fazer sozinho</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Já pagou alguém<br />pra resolver?<br />
            <span className="text-yellow-400/80">Quanto custou?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="space-y-4">
              {[
                { label: "Agência de marketing digital", value: "R$15.000 – R$50.000", note: "Sem garantia de resultado" },
                { label: "Gestor de tráfego", value: "R$3.000 – R$8.000/mês", note: "+ % sobre verba de anúncios" },
                { label: "Copywriter especializado", value: "R$2.000 – R$12.000", note: "Por campanha, prazo de semanas" },
                { label: "Consultor de estratégia", value: "R$5.000 – R$20.000", note: "Consultoria por projeto" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">{item.note}</div>
                  </div>
                  <div className="font-mono font-black text-sm text-destructive/70">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="border border-primary/30 bg-primary/5 p-8 flex flex-col justify-center">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">NexOS AI — tudo isso</div>
              <div className="font-mono font-black text-5xl text-primary mb-3">R$3.990</div>
              <div className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                Pagamento único. 57 agentes especializados disponíveis 24h — estratégia, copy, anúncios, automação, criativos visuais, análise e aprovação.
              </div>
              <Link href="/comprar">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 w-full">
                  Quero acesso <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 4: O QUE VOCÊ FAZ SOZINHO ───────────────────────────────────────
function SozinhoSection() {
  const { ref, inView } = useInView(0.2);
  const items = [
    "Você pesquisa o mercado por semanas antes de vender",
    "Você reescreve a copy 4 vezes sem saber se ficou boa",
    "Você manda mensagens manualmente para cada lead no WhatsApp",
    "Você monitora as métricas de hora em hora durante a campanha",
    "Você não sabe qual lead está pronto para comprar agora",
    "Você esquece de fechar a oferta no horário exato",
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">A realidade de operar sozinho</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            O que você faz<br />quando quer<br />
            <span className="text-primary">vender mais?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
            {items.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-5 h-5 rounded-full border border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-destructive/70 font-bold">{i + 1}</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-base text-muted-foreground/70 leading-relaxed border-l-2 border-destructive/30 pl-6">
            Isso não é vender. É trabalho manual disfarçado de estratégia.<br />
            <strong className="text-foreground">E enquanto você faz tudo isso, seu concorrente está usando automação.</strong>
          </p>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5: SOLUÇÃO ───────────────────────────────────────────────────────
function SolucaoSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20">
      <div className="max-w-5xl mx-auto px-6 w-full text-center">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <img
            src={nexosLogo}
            alt="NexOS AI"
            className="h-28 w-28 object-contain mx-auto mb-8"
            style={{ filter: "drop-shadow(0 0 30px hsl(var(--primary)/0.8))" }}
          />
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">A solução</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
            E se uma IA gerasse<br />tudo e você só<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">aprovasse?</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            O NexOS AI é uma plataforma com 57 agentes especializados — cada um treinado para uma parte da operação de vendas.
            Você conversa. A IA executa. <strong className="text-foreground">Nada vai ao ar sem a sua aprovação.</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: BrainCircuit, label: "Diagnóstico", sub: "Claude analisa produto, mercado e potencial de receita" },
              { icon: Target, label: "Estratégia", sub: "Plano completo de 7 dias de vendas com gatilhos por fase" },
              { icon: MessageSquare, label: "Copy + Automação", sub: "WhatsApp + Email por segmento de lead, automático" },
              { icon: Activity, label: "Performance", sub: "Health score e alertas de receita em tempo real" },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div
                key={i}
                className={`border border-primary/20 bg-primary/5 p-5 text-center transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${300 + i * 100}ms` }}
              >
                <Icon className="h-6 w-6 text-primary mx-auto mb-3" />
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1">{label}</div>
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">{sub}</div>
              </div>
            ))}
          </div>
          <Link href="/comprar">
            <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-10 gap-3">
              Quero os 57 agentes trabalhando <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 6: COMO FUNCIONA ─────────────────────────────────────────────────
function ComoFuncionaSection() {
  const { ref, inView } = useInView(0.2);
  const steps = [
    {
      num: "01",
      title: "Você conta sobre o produto",
      desc: "A IA faz as perguntas certas, entende o produto, o público e a meta de receita. Calcula viabilidade, score de prontidão e aponta o que precisa ajustar antes de vender.",
      tag: "Diagnóstico · 30–60 min",
      icon: BrainCircuit,
    },
    {
      num: "02",
      title: "A IA monta tudo para aprovação",
      desc: "Estratégia de 7 dias de vendas, copy por segmento de lead, criativos visuais, calendário de ações, sequência WhatsApp + Email — tudo apresentado para você revisar e aprovar antes de qualquer execução.",
      tag: "Estratégia + Copy + Criativos · Aprovação obrigatória",
      icon: Layers,
    },
    {
      num: "03",
      title: "A plataforma executa sozinha",
      desc: "Oferta abre e fecha no horário certo. Leads são segmentados em quente/morno/frio em tempo real. Copy diferente por perfil. Você acompanha as vendas pelo dashboard — sem tocar em nada.",
      tag: "Execução automática · 7 dias de vendas",
      icon: Zap,
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">Como funciona</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-12">
            3 passos.<br />
            <span className="text-primary">7 dias de vendas.</span>
          </h2>
          <div className="space-y-5">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 border border-border/30 bg-card/20 p-7 transition-all duration-600 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="flex items-start gap-4 md:flex-col md:gap-0 md:w-20">
                  <div className="font-mono font-black text-5xl text-primary/20 leading-none">{step.num}</div>
                  <step.icon className="h-6 w-6 text-primary mt-2 hidden md:block" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-mono font-black uppercase tracking-wide text-base text-foreground">{step.title}</span>
                    <span className="font-mono text-[10px] border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 uppercase tracking-widest">{step.tag}</span>
                  </div>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 7: META-PROVA ────────────────────────────────────────────────────
function MetaProvaSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/10">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">Meta-prova</div>
              <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
                Esta campanha<br />foi operada pelo<br />
                <span className="text-primary">próprio NexOS.</span>
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                Não estamos te contando sobre automação de vendas.
                Estamos <strong className="text-foreground">executando uma operação de vendas automatizada enquanto você lê isso.</strong>
                Cada fase, cada gatilho mental, cada disparo — gerado e orquestrado pela plataforma que você vai usar.
              </p>
              <div className="border-l-2 border-primary/50 pl-6">
                <p className="font-mono text-base font-bold text-foreground">
                  "Você é o resultado do que o app faz."
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Estratégia desta página", value: "Gerada por Claude com gatilhos sequenciados" },
                { label: "Copy de cada seção", value: "Fórmula de vendas · persuasão emocional por etapa" },
                { label: "Segmentação de leads", value: "Quente/morno/frio — conteúdo diferente por perfil" },
                { label: "Sequência WhatsApp + Email", value: "20 mensagens · 2x/dia · gatilho por dia" },
                { label: "Abertura e fechamento da oferta", value: "Automático · sem intervenção manual" },
                { label: "Aprovação de cada peça", value: "Nada foi ao ar sem revisão humana da equipe NexOS" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 border border-border/30 bg-background/50 px-4 py-3 transition-all duration-400 ${inView ? "opacity-100" : "opacity-0"}`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 8: MARCOS FINANCEIROS ───────────────────────────────────────────
function MarcosSection() {
  const { ref, inView } = useInView(0.2);
  const marcos = [
    { meta: "R$100k – R$999k", label: "6 dígitos", desc: "Primeiros 7 dias de vendas em volume. Estrutura básica de tráfego + sequência automatizada.", tag: "Plano Solo" },
    { meta: "R$1M – R$9,9M", label: "7 dígitos", desc: "Operação completa: tráfego pago, afiliados, múltiplas campanhas simultâneas.", tag: "Plano Agência" },
    { meta: "R$10M+", label: "8 dígitos", desc: "Lançamentos e vendas perpétuas em paralelo, white-label e time de agência.", tag: "Plano Agência" },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">Marcos financeiros</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
            Qual é o seu<br />
            <span className="text-primary">próximo marco?</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground mb-12 max-w-xl">
            O NexOS AI foi construído para levar você de onde está até o próximo marco de receita — com uma operação que você consegue rodar sozinho.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {marcos.map((m, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-7 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="font-mono font-black text-3xl text-primary">{m.label}</div>
                  <div className="font-mono text-[10px] border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 uppercase tracking-widest">{m.tag}</div>
                </div>
                <div className="font-mono text-lg font-bold text-foreground mb-3">{m.meta}</div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 9: URGÊNCIA ─────────────────────────────────────────────────────
function UrgenciaSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full text-center">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A pergunta certa</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
            Enquanto você hesita,<br />alguém no seu mercado<br />
            <span className="text-primary">está vendendo.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            Cada semana sem operar em volume é receita que ficou na mesa.
            Cada copy que não saiu é lead quente que esfriou.
            Cada concorrente que agiu primeiro é mercado que você vai ter que reconquistar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-12">
            {[
              { trigger: "Cada semana de atraso", impact: "= semana a mais do concorrente na frente" },
              { trigger: "Cada campanha adiada", impact: "= audiência que esfria e para de engajar" },
              { trigger: "Cada copy não gerado", impact: "= lead quente que comprou de outro" },
            ].map((item, i) => (
              <div
                key={i}
                className={`border border-primary/15 bg-primary/5 p-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="font-mono text-xs text-primary font-bold uppercase tracking-widest mb-2">{item.trigger}</div>
                <div className="font-mono text-sm text-muted-foreground leading-relaxed">{item.impact}</div>
              </div>
            ))}
          </div>
          <Link href="/comprar">
            <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-12 gap-3">
              Quero Vender Mais Agora <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 10: OFERTA FINAL ────────────────────────────────────────────────
function OfertaSection() {
  const { ref, inView } = useInView(0.15);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [, navigate] = useLocation();

  const formatWA = (v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), segment: "individual", source: "landing" }),
      });
      const json = await res.json();
      if (res.ok || json.joined) {
        localStorage.setItem("nexos_joined", "true");
        setJoined(true);
        setTimeout(() => navigate("/preparacao?segment=individual"), 1500);
      } else {
        toast.error("Erro ao entrar na lista.");
      }
    } catch { toast.error("Erro de conexão."); }
    finally { setLoading(false); }
  };

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/20" id="oferta">
      <div className="max-w-5xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A oferta</div>
              <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
                NexOS AI.<br />
                <span className="text-primary">Acesso completo.</span>
              </h2>
              <div className="border border-primary/30 bg-primary/5 p-6 mb-6">
                <div className="font-mono font-black text-6xl text-foreground mb-1">R$3.990</div>
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                  Pagamento único · Créditos não expiram · Sem mensalidade obrigatória
                </div>
                <ul className="space-y-2">
                  {[
                    "57 agentes de IA especializados em vendas",
                    "Diagnóstico completo de produto e mercado",
                    "Estratégia de 7 dias de vendas em volume",
                    "Copy WhatsApp + Email por segmento de lead",
                    "Criativos visuais gerados por IA (DALL-E 3)",
                    "Sequências automáticas com scheduler",
                    "Dashboard com health score e alertas de receita",
                    "Aprovação obrigatória antes de qualquer execução",
                    "3 campanhas ativas simultâneas",
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono text-xs text-foreground/80">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/comprar">
                <Button className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3">
                  Aderir à Plataforma <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center justify-center gap-2 mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">
                <Shield className="h-3 w-3" />
                Pagamento seguro · Acesso imediato · Garantia de 7 dias
              </div>
            </div>

            <div className="border border-border/30 bg-card/20 p-7">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                Não está pronto para aderir agora?
              </div>
              <h3 className="font-mono font-black uppercase text-xl tracking-tight text-foreground mb-2">
                Entre no aquecimento.
              </h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                10 dias de conteúdo sobre como vender mais com automação via WhatsApp. 2 mensagens por dia, gatilho mental definido por IA, antes da abertura do acesso.
              </p>
              {joined ? (
                <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-4">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">Você está dentro!</div>
                    <div className="font-mono text-[11px] text-muted-foreground">Redirecionando para falar com o Jeff...</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Seu nome</Label>
                    <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Como você se chama?"
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-sans" />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
                    <Input required value={whatsapp} onChange={e => setWhatsapp(formatWA(e.target.value))} placeholder="(11) 99999-9999"
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-mono" />
                  </div>
                  <Button type="submit" disabled={loading} variant="outline"
                    className="w-full h-11 rounded-none font-mono uppercase tracking-widest text-xs font-bold border-border/50 gap-2">
                    {loading ? "Entrando..." : <><ChevronRight className="h-3.5 w-3.5" /> Entrar no aquecimento</>}
                  </Button>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 text-center">
                    Sem spam · Só conteúdo sobre volume de vendas
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 40);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: "100vh", overflowY: "scroll", scrollSnapType: "y mandatory", scrollBehavior: "smooth" }}
      className="bg-background text-foreground"
    >
      <Nav scrolled={scrolled} />
      <HeroSection />
      <ProblemSection />
      <CustoSection />
      <SozinhoSection />
      <SolucaoSection />
      <ComoFuncionaSection />
      <MetaProvaSection />
      <MarcosSection />
      <UrgenciaSection />
      <OfertaSection />
    </div>
  );
}
