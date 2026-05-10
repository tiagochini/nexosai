import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, ArrowDown,
  BrainCircuit, Mail, MessageSquare,
  Lock, Shield, Zap, Target, Activity,
  ChevronRight, X, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { LiveDemoSection, SimulatorSection } from "@/components/landing-demo-sections";

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
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={nexosLogo} alt="NexOS AI" className="h-14 w-14 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="hidden sm:block">
            <div className="font-mono font-black text-xl tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">Plataforma de Lançamento</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">Já tenho acesso</Button>
          </a>
          <a href="/comprar">
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-9 px-5">Aderir agora</Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Scroll indicator ─────────────────────────────────────────────────────────
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
            TESTES PRIVADOS — APENAS 47 VAGAS RESTANTES
          </div>
          <h1 className="text-6xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-none mb-8 max-w-4xl">
            Sua IA de<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">Lançamento</span><br />
            Chegou.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl">
            NexOS AI monta estratégia, escreve copy, segmenta leads, dispara WhatsApp e Email, abre e fecha carrinho.{" "}
            <strong className="text-foreground">Tudo automático. Você assiste o faturamento subir.</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <a href="/comprar">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                QUERO MINHA VAGA NOS TESTES <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
            <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground/60">
              <Lock className="h-4 w-4" />
              Sem fidelidade. Cancela quando quiser. Acesso em 24h.
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 2: FEAR — Travamento ─────────────────────────────────────────────
function FearTravaSection() {
  const { ref, inView } = useInView(0.2);
  const cards = [
    { pain: "Copy que nunca sai", reason: "Você sabe o que escrever. Mas senta pra fazer e trava. A página fica 3 semanas no rascunho." },
    { pain: "Leads esfriando na base", reason: "Capturou 2.000 leads no perpétuo. Mandou 1 email. Depois silêncio. Dinheiro apodrecendo." },
    { pain: "Lançamento que não sai", reason: "Janeiro vira março. Março vira junho. O ano acaba e você fez 1 lançamento. Deveria ter feito 6." },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">A VERDADE QUE NINGUÉM FALA</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Você não está travado<br />
            por falta de<br />
            <span className="text-destructive/80">conhecimento.</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground/70 leading-relaxed border-l-2 border-destructive/30 pl-6 mb-10">
            Você está travado por falta de execução.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {cards.map((item, i) => (
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
              Não é sobre saber mais.<br />
              <strong className="text-foreground">É sobre ter algo que EXECUTA por você enquanto você foca no que importa: produto e audiência.</strong>
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 3: FEAR — Custo de terceiros ─────────────────────────────────────
function FearCustoSection() {
  const { ref, inView } = useInView(0.2);
  const alternativas = [
    { nome: "Agência de lançamento completa", preco: "R$15.000 a R$50.000/mês", nota: "Contratos de 6 meses. Resultados em 90 dias." },
    { nome: "Copywriter sênior dedicado", preco: "R$8.000 a R$15.000/mês", nota: "Entrega 2 a 3 copies por semana. No máximo." },
    { nome: "Gestor de tráfego + automação", preco: "R$5.000 a R$12.000/mês", nota: "Só tráfego. Automação é outro fornecedor." },
    { nome: "Social media + suporte", preco: "R$3.000 a R$6.000/mês", nota: "Posts genéricos. Não entende lançamento." },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">FAÇA AS CONTAS</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Quer execução<br />de verdade?<br />
            <span className="text-yellow-400/80">O mercado cobra caro. E ainda falha.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="space-y-4">
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
                  <div className="font-mono font-black text-sm text-destructive/70 text-right ml-4 shrink-0">{item.preco}</div>
                </div>
              ))}
            </div>
            <div className="border border-primary/30 bg-primary/5 p-8 flex flex-col justify-center">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">NexOS AI — tudo isso</div>
              <div className="font-mono font-black text-5xl text-primary mb-3">R$3.990</div>
              <div className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                R$3.990 = 29 agentes de IA executando estratégia, copy, segmentação, WhatsApp, Email, carrinho. Funcionando em 24h.
              </div>
              <a href="/comprar">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 w-full">
                  QUERO OS 29 AGENTES AGORA <ArrowRight className="h-4 w-4" />
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

// ─── Section 4: FEAR — Execução sozinho ──────────────────────────────────────
function FearExecucaoSection() {
  const { ref, inView } = useInView(0.2);
  const items = [
    "Acordar 6h pra escrever email de abertura de carrinho antes do café esfriar",
    "Copiar e colar mensagem no WhatsApp pra 200 leads. Um por um. Braço doendo.",
    "Ficar 4 horas segmentando lista no Excel porque a ferramenta não conversa com outra",
    "Reescrever a mesma copy 7 vezes porque não sabe se está boa o suficiente",
    "Dormir 4h em semana de lançamento e ainda errar o horário de fechar carrinho",
    "Perder venda porque esqueceu de mandar o último email de escassez",
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">RECONHECE ESSA ROTINA?</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Enquanto você faz<br />isso manualmente,<br />
            <span className="text-primary">seu concorrente já automatizou.</span>
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
            Cada hora que você gasta em execução manual é uma hora que não está criando produto, gravando conteúdo ou fechando parceria.<br />
            <strong className="text-foreground">O custo invisível é brutal.</strong>
          </p>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5: SOLUÇÃO — Reveal ─────────────────────────────────────────────
function SolutionSection() {
  const { ref, inView } = useInView(0.2);
  const features = [
    { icon: BrainCircuit, label: "Estrategista IA", sub: "Analisa seu produto, público e histórico. Monta cronograma completo de lançamento em 47 minutos." },
    { icon: Target, label: "Copywriter IA", sub: "Escreve página de vendas, emails, scripts de WhatsApp, anúncios. Tudo no seu tom de voz." },
    { icon: MessageSquare, label: "Segmentador IA", sub: "Divide sua base por comportamento, engajamento e probabilidade de compra. Atualiza em tempo real." },
    { icon: Activity, label: "Disparador IA", sub: "Envia sequências WhatsApp e Email no momento certo. Responde objeções. Opera carrinho sozinho." },
  ];
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
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">A SOLUÇÃO EXISTE</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
            Apresentamos<br />NexOS AI.<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">29 agentes executando 24h.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            Você define o produto e a data. A IA monta a estratégia, escreve todos os copies, segmenta sua base, dispara as sequências e opera o carrinho.{" "}
            <strong className="text-foreground">Você aprova. Ela executa.</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {features.map(({ icon: Icon, label, sub }, i) => (
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
          <a href="/comprar">
            <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-10 gap-3">
              QUERO MINHA VAGA NOS TESTES PRIVADOS <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 6: COMO FUNCIONA ────────────────────────────────────────────────
function HowItWorksSection() {
  const { ref, inView } = useInView(0.2);
  const steps = [
    {
      num: "01",
      title: "Conecta e configura em 23 minutos",
      desc: "Integra WhatsApp Business, seu email marketing e gateway de pagamento. Sobe sua base de leads. A IA mapeia tudo automaticamente e identifica 12 segmentos de comportamento na sua audiência.",
      tag: "Tempo médio: 23 minutos",
      icon: BrainCircuit,
    },
    {
      num: "02",
      title: "IA monta estratégia e copies",
      desc: "Você responde 7 perguntas sobre produto e público. Em 47 minutos a IA entrega: cronograma, 23 emails, 18 mensagens WhatsApp, página de vendas completa, 8 variações de anúncio. Você aprova ou ajusta.",
      tag: "Entrega completa em 47 minutos",
      icon: Layers,
    },
    {
      num: "03",
      title: "Execução automática total",
      desc: "A IA dispara no horário certo, segmenta em tempo real, responde dúvidas frequentes, abre carrinho, envia escassez, fecha carrinho. Você acompanha o dashboard. Faturamento entrando.",
      tag: "Roda 24h sem você tocar",
      icon: Zap,
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">SIMPLES ASSIM</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-12">
            3 passos.<br />
            <span className="text-primary">Lançamento rodando em 72 horas.</span>
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

// ─── Section 7: PROVA META ────────────────────────────────────────────────────
function ProofSection() {
  const { ref, inView } = useInView(0.2);
  const itens = [
    { label: "Headline e subheadline desta página", valor: "Geradas pelo Agente Copywriter em 3 minutos e 22 segundos" },
    { label: "Segmentação que trouxe você aqui", valor: "Agente Segmentador identificou seu perfil na base" },
    { label: "Sequência de emails pré-página", valor: "12 variações escritas e testadas pelo Agente de Email" },
    { label: "Mensagens WhatsApp de aquecimento", valor: "Disparadas pelo Agente WhatsApp com 73% de abertura" },
    { label: "Estrutura de persuasão da página", valor: "Agente Estrategista definiu ordem dos blocos em 8 minutos" },
    { label: "Gatilhos de escassez e urgência", valor: "Calibrados pelo Agente de Conversão com base em 847 testes" },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/10">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">PROVA REAL</div>
              <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
                Esta página que<br />você está lendo<br />
                <span className="text-primary">foi criada pelo NexOS AI.</span>
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                Cada palavra, cada seção, cada gatilho desta landing page foi gerado pelos 29 agentes. A segmentação que trouxe você aqui. O email ou anúncio que você clicou.{" "}
                <strong className="text-foreground">Tudo executado pela IA que você está prestes a acessar.</strong>
              </p>
              <div className="border-l-2 border-primary/50 pl-6">
                <p className="font-mono text-base font-bold text-foreground">
                  "Você não está lendo sobre o que a IA faz. Você está vivendo o que ela faz. Agora."
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {itens.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 border border-border/30 bg-background/50 px-4 py-3 transition-all duration-400 ${inView ? "opacity-100" : "opacity-0"}`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{item.valor}</div>
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

// ─── Section 8: FEAR — Urgência ──────────────────────────────────────────────
function UrgencySection() {
  const { ref, inView } = useInView(0.2);
  const cards = [
    { gatilho: "Esperar o momento perfeito", impacto: "O momento perfeito era ontem. O segundo melhor é agora." },
    { gatilho: "Fazer mais um lançamento manual", impacto: "40 horas de trabalho que a IA faz em 47 minutos." },
    { gatilho: "Deixar pra próxima semana", impacto: "Vagas esgotam. Você entra na fila. Concorrente sai na frente." },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full text-center">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">O RELÓGIO ESTÁ CORRENDO</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
            Cada dia sem automação<br />é dinheiro que<br />
            <span className="text-primary">você queima.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            Enquanto você lê isso, 3 lançadores acabaram de solicitar acesso.<br />
            <strong className="text-foreground">As 47 vagas dos testes privados estão fechando. Depois disso: lista de espera.</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-12">
            {cards.map((item, i) => (
              <div
                key={i}
                className={`border border-primary/15 bg-primary/5 p-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="font-mono text-xs text-primary font-bold uppercase tracking-widest mb-2">{item.gatilho}</div>
                <div className="font-mono text-sm text-muted-foreground leading-relaxed">{item.impacto}</div>
              </div>
            ))}
          </div>
          <a href="/comprar">
            <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-12 gap-3">
              GARANTIR MINHA VAGA AGORA <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 9: OFERTA FINAL ──────────────────────────────────────────────────
function OfferSection() {
  const { ref, inView } = useInView(0.15);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
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
        setTimeout(() => { window.location.href = "/preparacao?segment=individual"; }, 1500);
      } else {
        toast.error("Erro ao entrar na lista.");
      }
    } catch { toast.error("Erro de conexão."); }
    finally { setLoading(false); }
  };

  const features = [
    "29 agentes de IA trabalhando 24h no seu lançamento",
    "Estratégia completa montada em 47 minutos",
    "Copy de página, emails e WhatsApp gerados automaticamente",
    "Segmentação inteligente em tempo real da sua base",
    "Disparos automáticos WhatsApp Business API",
    "Sequências de email com 12 variações por campanha",
    "Abertura e fechamento de carrinho 100% automático",
    "Suporte prioritário via grupo exclusivo de testadores",
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/20" id="oferta">
      <div className="max-w-5xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Left — Offer */}
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">SUA OFERTA</div>
              <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
                Testes Privados<br />
                <span className="text-primary">NexOS AI.</span>
              </h2>
              <div className="border border-primary/30 bg-primary/5 p-6 mb-6">
                <div className="font-mono font-black text-6xl text-foreground mb-1">
                  R$3.990
                </div>
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                  47 vagas restantes · Acesso liberado em 24h · Sem fidelidade
                </div>
                <ul className="space-y-2">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono text-xs text-foreground/80">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a href="/comprar">
                <Button className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3">
                  QUERO MINHA VAGA NOS TESTES <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <div className="flex items-center justify-center gap-2 mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">
                <Shield className="h-3 w-3" />
                Sem fidelidade. Cancela quando quiser. Acesso em 24h.
              </div>
            </div>

            {/* Right — Waitlist for esquenta */}
            <div className="border border-border/30 bg-card/20 p-7">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                Bônus: Esquenta de 7 Dias
              </div>
              <h3 className="font-mono font-black uppercase text-xl tracking-tight text-foreground mb-2">
                Entre antes de todo mundo.
              </h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                Ao entrar nos testes, você recebe acesso imediato ao Esquenta. 7 dias de conteúdo exclusivo mostrando os bastidores dos 29 agentes antes de rodar seu primeiro lançamento.
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
                    {loading ? "Entrando..." : <><ChevronRight className="h-3.5 w-3.5" /> Garantir minha vaga no esquenta</>}
                  </Button>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 text-center">
                    Sem spam · Só conteúdo de lançamento
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

// ─── Main ────────────────────────────────────────────────────────────────────
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
      <FearTravaSection />
      <FearCustoSection />
      <FearExecucaoSection />
      <SolutionSection />
      <HowItWorksSection />
      <LiveDemoSection />
      <SimulatorSection />
      <ProofSection />
      <UrgencySection />
      <OfferSection />
    </div>
  );
}
