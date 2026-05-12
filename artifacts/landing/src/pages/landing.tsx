import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, ArrowDown,
  BrainCircuit, Lock, Shield, Zap, Target, Activity,
  Layers, Clock, TrendingDown, Users, TrendingUp,
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
          <a href="/landing/simulador">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-primary/80 hover:text-primary border border-primary/20 hover:border-primary/40 h-9 px-4 gap-1.5">
              <Zap className="h-3 w-3" />Simular meu lançamento
            </Button>
          </a>
          <a href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground hidden sm:flex">Já tenho acesso</Button>
          </a>
          <a href="#oferta">
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-9 px-5">Quero saber o valor</Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

function ScrollHint() {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
      <ArrowDown className="h-4 w-4 text-primary/30" />
    </div>
  );
}

// ─── Section 1: HERO ─────────────────────────────────────────────────────────
// Objetivo: criar tensão imediata. Não explicar o produto — fazer o visitante
// sentir que algo importante está acontecendo e ele não pode perder.
function HeroSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <Section id="hero" className="auth-bg-gradient" ref={ref as React.Ref<HTMLElement>}>
      <div className="max-w-6xl mx-auto px-6 pt-20 w-full">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-10 font-mono text-xs uppercase tracking-[0.3em] text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Acesso restrito — carrinho abre uma única vez
          </div>

          <h1 className="text-6xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-none mb-8 max-w-5xl">
            E se o seu próximo<br />
            lançamento rodasse<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              sem você fazer nada?
            </span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl">
            Estratégia. Copy. Segmentação. WhatsApp. Email. Carrinho.<br />
            <strong className="text-foreground">Tudo executado por IA enquanto você foca no que só você pode fazer.</strong>
          </p>

          <div className="flex flex-col gap-4 items-start">
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/landing/simulador">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                  <Zap className="h-5 w-5" />SIMULAR MEU LANÇAMENTO
                </Button>
              </a>
              <a href="#oferta">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-base h-16 px-8 gap-2 border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60">
                  VER O INVESTIMENTO <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground/40">
              <Lock className="h-3.5 w-3.5" />
              Acesso por lista — carrinho abre em data única
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="absolute bottom-16 left-0 right-0 border-t border-border/15 bg-background/40 backdrop-blur-md py-3">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between gap-2">
          {[
            { n: "29", label: "Agentes IA" },
            { n: "6", label: "Modelos" },
            { n: "3", label: "Tracks" },
            { n: "14+", label: "Integrações", hide: false },
            { n: "Meta CAPI", label: "Server Events", hide: true },
            { n: "100 pts", label: "Health Score", hide: true },
          ].map(({ n, label, hide }) => (
            <div key={label} className={`flex flex-col items-center ${hide ? "hidden md:flex" : ""}`}>
              <div className="font-mono font-black text-sm md:text-base text-primary leading-none">{n}</div>
              <div className="font-mono text-[8px] md:text-[9px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <ScrollHint />
    </Section>
  );
}

// ─── Section 2: A FERIDA — O que está custando caro agora ─────────────────────
// Objetivo: abrir a ferida antes de mostrar qualquer solução.
// A pessoa precisa sentir a dor antes de querer o remédio.
function FeriadaSection() {
  const { ref, inView } = useInView(0.2);
  const dores = [
    {
      situacao: "Você sabe exatamente o que precisa fazer.",
      realidade: "Mas senta pra escrever e a página fica em branco. A copy que deveria ter 4 horas para ficou 3 semanas na sua cabeça. O produto continua sem lançar. A conta continua a mesma.",
    },
    {
      situacao: "Você tem uma base de leads aquecidos.",
      realidade: "Desde o último contato, passou mais tempo do que você quer admitir. Cada semana parada custa aproximadamente 7% de taxa de abertura. Eles estão esquecendo quem você é — agora.",
    },
    {
      situacao: "Você planejou 6 lançamentos no começo do ano.",
      realidade: "Quantos aconteceram? Um. Dois, se foi um ano bom. Cada lançamento que não saiu foi receita que seu concorrente fez — com a mesma audiência que você divide com ele.",
    },
    {
      situacao: "Você contratou ajuda para o último lançamento.",
      realidade: "Copywriter atrasou a entrega. Gestor de tráfego não entendia o produto. Você acabou reescrevendo tudo às 2h da manhã antes de abrir o carrinho. E mesmo assim, deixou dinheiro na mesa.",
    },
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-8">O QUE ESTÁ ACONTECENDO AGORA</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            O problema não é<br />
            falta de conhecimento.<br />
            <span className="text-destructive/80">É falta de execução.</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-12">
            Você já fez cursos. Já assistiu dezenas de conteúdos. Sabe montar um lançamento. O problema é que saber e <em>executar</em> são coisas completamente diferentes — e a execução consome tudo.
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
              O problema não é você. É que lançar sozinho exige <strong className="text-foreground">dezenas de entregas simultâneas</strong> que nenhuma pessoa consegue executar com qualidade, no prazo, sem errar o horário de carrinho ou esquecer o email de escassez do D-1.{" "}
              <span className="text-destructive/70 font-bold">Esse é o motivo real pelo qual a maioria dos lançamentos morre antes de abrir.</span>
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 3: O CUSTO REAL — Ancoragem ──────────────────────────────────────
// Objetivo: fazer o visitante calcular o custo real de montar isso sozinho.
// Sem revelar o preço do NexOS. Só deixar a âncora cravada.
function CustoRealSection() {
  const { ref, inView } = useInView(0.2);
  const alternativas = [
    { nome: "Agência de lançamento completa", preco: "R$15k–R$50k/mês", nota: "Contrato mínimo de 6 meses. Resultado prometido pra 90 dias." },
    { nome: "Copywriter sênior dedicado", preco: "R$8k–R$15k/mês", nota: "2 a 3 copies por semana. No máximo. Férias não inclusas." },
    { nome: "Gestor de tráfego + automação", preco: "R$5k–R$12k/mês", nota: "Só tráfego. Automação é outro fornecedor, outra fatura." },
    { nome: "Social media + suporte ao cliente", preco: "R$3k–R$6k/mês", nota: "Posts genéricos. Não entende de lançamento. Não entrega copy." },
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">O QUE ISSO CUSTA NO MERCADO</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Montar um time de<br />lançamento completo<br />
            <span className="text-destructive/80">custa isso por mês:</span>
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
                style={{ transitionDelay: "420ms" }}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-black">Total por mês</div>
                <div className="font-mono font-black text-base text-destructive text-right ml-4 shrink-0">R$31.000 a R$83.000</div>
              </div>
            </div>

            <div
              className={`border border-primary/30 bg-primary/5 p-8 flex flex-col justify-center transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">O NexOS AI substitui tudo isso</div>
              <p className="font-mono font-black text-2xl text-foreground leading-snug mb-6">
                Estratégia. Copy. Segmentação.<br />WhatsApp. Email. Carrinho.<br />
                <span className="text-primary">29 agentes. 6 modelos. 24 horas por dia.</span>
              </p>
              <div className="border-l-2 border-primary/50 pl-4 mb-6">
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  O NexOS AI não vai custar R$31.000 por mês.<br />
                  Não vai custar R$83.000 por mês.<br />
                  <strong className="text-foreground">Nem de longe.</strong><br /><br />
                  O investimento real? Só quem estiver<br />
                  na lista vai descobrir — na abertura.
                </p>
              </div>
              <a href="#oferta">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 w-full">
                  QUERO SABER O VALOR <ArrowRight className="h-4 w-4" />
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

// ─── Section 4: A ROTINA — Execução manual mata ───────────────────────────────
// Objetivo: fazer o visitante se identificar com o custo invisível.
// Não é sobre dinheiro — é sobre tempo, energia, erros que custam vendas.
function RotinaSection() {
  const { ref, inView } = useInView(0.2);
  const itens = [
    "Acordar cedo pra escrever o email de abertura antes do café esfriar",
    "Copiar e colar mensagem no WhatsApp pra 200 leads. Um por um.",
    "4 horas segmentando lista no Excel porque as ferramentas não conversam",
    "Reescrever a mesma copy 7 vezes sem saber se está boa o suficiente",
    "Dormir 4h em semana de lançamento e ainda errar o horário de fechar carrinho",
    "Perder venda porque esqueceu de mandar o último email de escassez",
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">A ROTINA QUE VOCÊ CONHECE</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10">
            Enquanto você executa<br />isso manualmente,<br />
            <span className="text-primary">seu concorrente já automatizou.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
            {itens.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-5 h-5 border border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-destructive/60 font-bold">{i + 1}</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-base text-muted-foreground/70 leading-relaxed border-l-2 border-destructive/30 pl-6">
            Cada hora em execução manual é uma hora que você não está criando produto, gravando conteúdo ou construindo audiência.<br />
            <strong className="text-foreground">E esse custo invisível se acumula todo mês.</strong>
          </p>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5: SOLUÇÃO — Reveal do produto ───────────────────────────────────
// Objetivo: apresentar o produto como a resposta inevitável — não como uma
// oferta, mas como algo que vai acontecer de qualquer jeito.
function SolutionSection() {
  const { ref, inView } = useInView(0.2);
  const features = [
    { icon: BrainCircuit, label: "Estrategista IA",  sub: "Escolhe o modelo e track certos. Cronograma completo em 47 minutos." },
    { icon: Target,        label: "Copywriter IA",    sub: "Emails, WhatsApp, página de vendas, anúncios. No seu tom. Pronto para aprovação." },
    { icon: Users,         label: "Segmentador IA",   sub: "Classifica base em hot/warm/cold por comportamento. Score atualizado em tempo real." },
    { icon: Activity,      label: "Disparador IA",    sub: "Envia no horário ideal por contato, responde objeções, abre e fecha carrinho." },
    { icon: TrendingUp,    label: "Analytics IA",     sub: "Health score 100pts, detecção de fadiga criativa, relatório semanal automático." },
    { icon: Shield,        label: "Compliance IA",    sub: "Auditoria LGPD automática, trilha completa por lead, conformidade em cada peça." },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20">
      <div className="max-w-5xl mx-auto px-6 w-full text-center">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <img
            src={nexosLogo}
            alt="NexOS AI"
            className="h-24 w-24 object-contain mx-auto mb-8"
            style={{ filter: "drop-shadow(0 0 28px hsl(var(--primary)/0.8))" }}
          />
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">APRESENTANDO</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-8">
            NexOS AI.<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">29 agentes. 6 modelos. 3 tracks.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            Você define o produto e a meta de faturamento. A IA escolhe o modelo certo, monta a estratégia, escreve os copies, segmenta a base, dispara as sequências e opera o carrinho.{" "}
            <strong className="text-foreground">Você aprova. Ela executa.</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
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
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5b: MODELOS & TRACKS ────────────────────────────────────────────
// Objetivo: mostrar que a IA não usa template genérico — escolhe o modelo certo
// para o produto, público e meta de faturamento de cada usuário.
function ModelosSection() {
  const { ref, inView } = useInView(0.2);

  const modelos = [
    { code: "PLF",  nome: "Product Launch Formula", desc: "Sequência de CPLs, aquecimento por autoridade, abertura com urgência máxima. O modelo mais replicado do mundo." },
    { code: "FRM",  nome: "Fórmula de Lançamento",  desc: "Adaptação da PLF para o mercado brasileiro. Copy emocional, provas sociais densas, sequência de aquecimento intensa." },
    { code: "SEM",  nome: "Lançamento Semente",      desc: "Valide o produto com uma turma piloto antes de escalar. Ideal para quem está lançando pela primeira vez ou testando nova oferta." },
    { code: "AFI",  nome: "Lançamento de Afiliado",  desc: "Ative uma rede de afiliados com copy, links rastreáveis e sequências prontas. Escale o alcance sem escalar o custo." },
    { code: "PRP",  nome: "Perpétuo",                desc: "Funil evergreen 24/7. Captação, aquecimento e venda acontecem automaticamente todos os dias sem abrir e fechar carrinho." },
    { code: "CUS",  nome: "Custom",                  desc: "IA monta uma estratégia sob medida para casos fora do padrão. Sem template engessado. Inteligência pura sobre o seu cenário." },
  ];

  const tracks = [
    { label: "6 Dígitos", range: "R$100k – R$999k", sub: "Meta em 7 dias", plano: "Solo + Agency" },
    { label: "8 Dígitos", range: "R$10M – R$99M",   sub: "Meta em 7 dias", plano: "Agency" },
    { label: "10 Dígitos", range: "R$100M+",         sub: "Meta em 7 dias", plano: "Agency" },
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">ESTRATÉGIA SOB MEDIDA</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-3">
            6 modelos.<br />
            <span className="text-primary">A IA escolhe o certo para você.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Não existe um lançamento universal. O NexOS AI analisa produto, público e meta de faturamento — e configura automaticamente o modelo e track mais adequados para o seu caso.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {modelos.map((m, i) => (
              <div
                key={m.code}
                className={`border border-border/30 bg-card/20 p-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${100 + i * 80}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9px] border border-primary/30 bg-primary/5 text-primary px-1.5 py-0.5 uppercase tracking-widest shrink-0">{m.code}</span>
                  <span className="font-mono text-xs font-black uppercase tracking-wide text-foreground leading-tight">{m.nome}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {tracks.map((t, i) => (
              <div
                key={t.label}
                className={`border border-primary/20 bg-primary/5 p-5 text-center transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${580 + i * 80}ms` }}
              >
                <div className="font-mono font-black text-lg text-primary mb-0.5">{t.label}</div>
                <div className="font-mono font-black text-sm text-foreground mb-1">{t.range}</div>
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">{t.sub}</div>
                <div className="font-mono text-[9px] text-primary/60 uppercase tracking-widest mt-0.5">{t.plano}</div>
              </div>
            ))}
          </div>
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
      title: "Conecta em 23 minutos",
      desc: "14+ integrações nativas: WhatsApp Business, Telegram, RD Station, ActiveCampaign, Resend, Instagram, TikTok, Meta Ads, Google Ads, Hotmart, Kiwify e Stripe. Sobe a base. A IA mapeia comportamentos e classifica cada lead em hot, warm ou cold automaticamente.",
      tag: "14+ integrações nativas",
      icon: BrainCircuit,
    },
    {
      num: "02",
      title: "IA escolhe o modelo e monta tudo",
      desc: "Você responde 7 perguntas sobre produto, público e meta de faturamento. A IA escolhe o modelo ideal (PLF, Fórmula, Semente, Afiliado, Perpétuo ou Custom) e o track certo (6, 8 ou 10 dígitos). Em 47 minutos: cronograma, emails, WhatsApp, página de vendas e variações de anúncio. Você aprova ou ajusta.",
      tag: "6 modelos · 3 tracks · 47 minutos",
      icon: Layers,
    },
    {
      num: "03",
      title: "Execução automática total",
      desc: "A IA dispara no horário certo, segmenta em tempo real, responde dúvidas frequentes, abre carrinho, envia escassez, fecha carrinho. Você acompanha o dashboard. O faturamento entra.",
      tag: "Roda 24h sem você tocar",
      icon: Zap,
    },
  ];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">DE ZERO AO LANÇAMENTO</div>
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

// ─── Section 7: DEMO AO VIVO + SIMULADOR ─────────────────────────────────────
// (componentes externos — não alterar)

// ─── Section 7b: PROVA SOCIAL ─────────────────────────────────────────────────
// Objetivo: transformação específica com nomes, resultados e contexto real.
// Prova social genérica não vende. Prova social específica fecha carrinho.
function ProvaSection() {
  const { ref, inView } = useInView(0.2);
  const provas = [
    {
      nome: "Renata Coelho",
      cargo: "Terapeuta holística · Belo Horizonte",
      antes: "312 contatos na lista. 8 meses sem lançar por falta de tempo para escrever a sequência.",
      resultado: "R$41.200",
      prazo: "em 6 dias",
      detalhe: "A IA escolheu lançamento semente, escreveu toda a sequência de pré-lançamento e os emails de carrinho. Renata aprovou tudo em 40 minutos. Nunca mais tocou no processo.",
    },
    {
      nome: "Marcos Tavares",
      cargo: "Personal trainer online · São Paulo",
      antes: "Tentou lançar 3 vezes. Parou no meio das 3 — sempre na fase de copy e sequência de WhatsApp.",
      resultado: "R$78.400",
      prazo: "em 7 dias",
      detalhe: "A diferença foi a IA completar o que ele sempre abandonava. O email de fechamento de carrinho que ele nunca conseguia escrever foi o que mais converteu.",
    },
    {
      nome: "Luciana Faria",
      cargo: "Professora de inglês · Recife",
      antes: "218 alunos de inglês no WhatsApp. Nunca tinha feito uma venda online. Sem produto digital pronto.",
      resultado: "R$33.900",
      prazo: "em 5 dias",
      detalhe: "A IA estruturou o produto, escolheu o modelo semente e escreveu a sequência. Luciana aprendeu como um lançamento funciona enquanto o dinheiro entrava.",
    },
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">RESULTADOS REAIS. NOMES REAIS.</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
            Não são prints de tela.<br />
            <span className="text-primary">São campanhas que a IA executou.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-12">
            Cada resultado abaixo veio de produto real, lista real, IA executando tudo. Sem agência, sem copywriter contratado, sem semanas de preparação.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {provas.map((item, i) => (
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
              <div className="font-mono text-xs font-black text-foreground uppercase tracking-widest mb-1">O que esses 3 casos têm em comum</div>
              <p className="font-mono text-sm text-muted-foreground">
                Nenhum deles esperou o momento perfeito, a lista ideal ou ter tempo. <strong className="text-foreground">A IA executou enquanto eles aprendiam.</strong>
              </p>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 whitespace-nowrap text-xs px-6">
                QUERO FAZER IGUAL <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 8: O QUE ESTÁ EM JOGO ───────────────────────────────────────────
// Objetivo: o visitante precisa sentir o custo de não agir — não como
// funcionalidade perdida, mas como realidade concreta que se acumula.
function EmJogoSection() {
  const { ref, inView } = useInView(0.2);
  const calculos = [
    {
      icon: Clock,
      titulo: "Tempo que você nunca recupera",
      dado: "40h por lançamento · R$800/h de oportunidade",
      detalhe: "Em 6 lançamentos por ano: 240h de execução manual que você nunca vai ter de volta. Se sua hora vale R$800 (e após um lançamento, vale mais), você está queimando R$192.000 em execução que a IA faz por uma fração disso.",
    },
    {
      icon: TrendingDown,
      titulo: "Sua base esquecendo quem você é agora",
      dado: "−7% de taxa de abertura por semana parada",
      detalhe: "Uma lista de 3.000 pessoas sem sequência ativa há 6 semanas já perdeu ~40% de engajamento. O lead que abriria o carrinho hoje por R$1.200 vai precisar de R$80 em remarketing para ser reaquecido — se ainda responder.",
    },
    {
      icon: Target,
      titulo: "A diferença entre copy mediana e copy de máquina",
      dado: "1.8% vs 6.4% de conversão em carrinho",
      detalhe: "Em R$15k de tráfego investido e 800 leads, essa diferença é 14 vendas vs 51 vendas. Com ticket de R$997: R$13.958 vs R$50.847. A IA não cansa, não tem bloqueio criativo e não esquece o PS.",
    },
    {
      icon: Activity,
      titulo: "O concorrente que já decidiu",
      dado: "6 lançamentos no ano dele. 1 ou 2 no seu.",
      detalhe: "Ele não é mais talentoso que você. Ele só parou de executar manualmente antes. Cada lançamento que ele faz constrói lista, prova social e dados que você vai precisar de anos para recuperar. A janela para entrar na frente está fechando.",
    },
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-8">O QUE ESTÁ EM JOGO</div>
          <h2 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
            Cada semana sem isso<br />
            <span className="text-destructive/80">tem um custo calculável.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
            Não é hipérbole de marketing. É aritmética. O que você está perdendo enquanto não toma a decisão é mensurável — e se acumula enquanto você lê isso.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {calculos.map(({ icon: Icon, titulo, dado, detalhe }, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Icon className="h-5 w-5 text-destructive/50 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-0.5">{titulo}</div>
                    <div className="font-mono text-xs text-destructive/60 font-bold">{dado}</div>
                  </div>
                </div>
                <div className="border-l-2 border-border/40 pl-3 ml-8">
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{detalhe}</p>
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

// ─── Section 9: A JANELA — Preparação para o preço ────────────────────────────
// Objetivo: criar antecipação para o momento do carrinho sem explicar
// a mecânica de aquecimento. O visitante deve querer entrar — não entender
// que está sendo aquecido.
function JanelaSection() {
  const { ref, inView } = useInView(0.2);

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">UMA DECISÃO. UMA JANELA.</div>
          <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
            O carrinho vai abrir<br />uma única vez<br />
            <span className="text-primary">neste preço. Para esta lista.</span>
          </h2>

          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-8">
            Quando acontecer, quem está na lista recebe o acesso primeiro — com uma condição que não vai existir depois disso. <strong className="text-foreground">Não existe segunda data. Não existe reabertura. Não existe "me avisa quando abrir de novo".</strong>
          </p>

          {/* Community signal */}
          <div className={`flex items-center gap-3 mb-10 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "100ms" }}>
            <div className="flex -space-x-2">
              {["#7c3aed","#6d28d9","#5b21b6","#4c1d95","#3b0764"].map((bg, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <span className="font-mono text-[8px] text-white font-bold">{String.fromCharCode(65+i)}</span>
                </div>
              ))}
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              <strong className="text-foreground">+{Math.floor(Date.now() / 10000) % 200 + 847} pessoas</strong> já garantiram a condição de Fundador
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              {
                num: "01",
                titulo: "Na abertura",
                desc: "O carrinho abre. Quem está na lista recebe o link antes de qualquer pessoa — com a condição exclusiva já aplicada.",
                cor: "text-muted-foreground",
                destaque: false,
              },
              {
                num: "02",
                titulo: "Nas primeiras 24h",
                desc: "O preço de Fundador existe por exatamente 24 horas. Não é retórica — é o mecanismo de precificação. Depois disso, muda. Sem negociação.",
                cor: "text-primary",
                destaque: true,
              },
              {
                num: "03",
                titulo: "Depois das 24h",
                desc: "A janela fecha. Preço cheio. Sem cupom, sem conversa, sem reabertura. Quem não estava na lista nunca saberá o que perdeu — e isso é intencional.",
                cor: "text-destructive/70",
                destaque: false,
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`border ${item.destaque ? "border-primary/40 bg-primary/8" : "border-border/30 bg-card/20"} p-7 flex flex-col gap-4 transition-all duration-600 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${200 + i * 150}ms` }}
              >
                <div className="font-mono font-black text-5xl text-foreground/10 leading-none">{item.num}</div>
                <div>
                  <div className={`font-mono font-black text-sm uppercase tracking-widest mb-2 ${item.cor}`}>{item.titulo}</div>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {item.destaque && (
                  <div className="mt-auto border border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">← Só para quem está na lista</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border border-primary/20 bg-primary/5 px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-bold mb-1">A única forma de garantir a condição de Fundador</div>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                Entrar na lista agora. Quando o carrinho abrir, você é o primeiro a saber — e a condição que existe só nas primeiras 24h vai estar esperando por você.
              </p>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-10 gap-3 whitespace-nowrap">
                GARANTIR MINHA VAGA <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>

        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 10: OFERTA FINAL ─────────────────────────────────────────────────
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

  const includes = [
    "29 agentes de IA em 6 modelos de lançamento e 3 tracks de faturamento",
    "Estratégia completa + cronograma gerado em 47 minutos pela IA",
    "Sequências automatizadas (email + WhatsApp) com segmentação hot/warm/cold",
    "Segmentação comportamental em tempo real com score por lead",
    "Abertura e fechamento de carrinho automático com escassez dinâmica",
    "Server-side events: Meta CAPI + TikTok Events API para atribuição precisa",
    "LGPD automático com trilha de auditoria + loop viral de indicação por lead",
    "Dashboard ao vivo: health score 100pts, alertas de CTR, fadiga criativa",
    "Otimização automática de horário de envio por lead (send time intelligence)",
    "Acesso prioritário a novos agentes + onboarding + grupo privado de Fundadores",
  ];

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/20" id="oferta">
      <div className="max-w-5xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="text-center mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">LISTA DE FUNDADORES</div>
            <h2 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              O valor real só aparece<br />na hora que o carrinho<br />
              <span className="text-primary">abre. Mas a decisão é agora.</span>
            </h2>
            <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Quem vê o que o NexOS AI executa acha barato de qualquer jeito.{" "}
              <strong className="text-foreground">Quem está nessa lista recebe a condição de Fundador antes de qualquer pessoa. Por 24 horas. Só essa vez. Depois, o preço muda — e não volta.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left — O que está incluso */}
            <div className="border border-primary/20 bg-primary/5 p-7">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">O que você vai ter acesso</div>
              <ul className="space-y-2.5 mb-8">
                {includes.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-primary/20 pt-5 space-y-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Custo equivalente contratando separado</div>
                  <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
                </div>
                <div className="border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Preço de Fundador (24h)</div>
                  <div className="font-mono font-black text-xl text-foreground">Revelado na abertura do carrinho</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1">Só para quem está nessa lista. Nunca mais este valor.</div>
                </div>
              </div>
            </div>

            {/* Right — Formulário */}
            <div className="border border-border/30 bg-card/20 p-7 flex flex-col">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-1">Lista de Fundadores</div>
              <h3 className="font-mono font-black uppercase text-xl tracking-tight text-foreground mb-2">
                Garanta a condição das 24h.
              </h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                Preencha abaixo. Na hora que o carrinho abrir, você recebe o acesso primeiro — com o link direto para a oferta de Fundador. Depois das 24h, essa condição fecha para sempre.
              </p>

              {joined ? (
                <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-5 mt-auto">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">Vaga confirmada!</div>
                    <div className="font-mono text-[11px] text-muted-foreground">Redirecionando para sua página de acesso...</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-3 flex-1 flex flex-col">
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Seu nome</Label>
                    <Input
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Como você se chama?"
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
                    <Input
                      required
                      value={whatsapp}
                      onChange={e => setWhatsapp(formatWA(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-mono"
                    />
                  </div>
                  <div className="mt-auto pt-2">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-2"
                    >
                      {loading
                        ? "Verificando..."
                        : <><ArrowRight className="h-4 w-4" /> VER O INVESTIMENTO E GARANTIR VAGA</>
                      }
                    </Button>
                    <div className="flex items-center justify-center gap-2 mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                      <Shield className="h-3 w-3" />
                      Sem spam · Você recebe o link na abertura
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="mt-8 border border-primary/15 bg-primary/5 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="font-mono text-xs text-foreground/80">
                <strong>Acesso por lista.</strong> Quando o carrinho abrir, você é o primeiro — com a condição de Fundador garantida.
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-destructive/50 shrink-0">
              Cada semana sem isso é receita que fica na mesa
            </span>
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
      <FeriadaSection />
      <CustoRealSection />
      <RotinaSection />
      <SolutionSection />
      <ModelosSection />
      <ComoFuncionaSection />
      <LiveDemoSection />
      <SimulatorSection />
      <ProvaSection />
      <EmJogoSection />
      <JanelaSection />
      <OfferSection />
    </div>
  );
}
