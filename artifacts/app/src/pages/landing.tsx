import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  Zap, ArrowRight, CheckCircle2, BarChart3, Mail,
  MessageSquare, BrainCircuit, Shield, TrendingUp,
  Clock, Lock, Users, AlertTriangle, Building2, User,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type Segment = "individual" | "agency";

// ─── Segment-specific content ──────────────────────────────────────────────────

const SEGMENT_DATA = {
  individual: {
    badge: "Lançador Solo",
    groupLabel: "Grupo dos Lançadores",
    headline: "Seu primeiro lançamento de 6 dígitos.",
    sub: "Sem equipe, sem agência, sem freelancer. Você coloca o briefing, a IA faz o resto — estratégia, copy, sequência de email e WhatsApp, tudo disparado no piloto automático.",
    bullets: [
      "Seu lançamento rodando enquanto você dorme",
      "Copy profissional gerado por IA em segundos",
      "Sem contratar ninguém — só você e a plataforma",
      "Da ideia ao carrinho aberto em 7 dias",
    ],
    successTitle: "Você está no grupo dos Lançadores.",
    successBody: "No grupo você vai receber bastidores, demos ao vivo e o passo a passo de como fazer seu primeiro lançamento de 6 dígitos — do zero, sozinho. Quando o carrinho abrir (por 24h), você será o primeiro a saber.",
    groupDesc: "Grupo de Esquenta · Lançadores Solo",
    color: "primary" as const,
  },
  agency: {
    badge: "Agência / Gestor",
    groupLabel: "Grupo das Agências",
    headline: "Escale seus clientes com IA.",
    sub: "Entregue mais lançamentos com a mesma equipe — ou menos. NexOS AI é white-label, multi-cliente e automatiza toda a operação de copy, sequência e métricas dos seus clientes.",
    bullets: [
      "White-label completo — sua marca, sua operação",
      "Gerencie múltiplos clientes em um único painel",
      "Entregue resultados sem aumentar headcount",
      "Margem maior por cliente, operação menor",
    ],
    successTitle: "Você está no grupo das Agências.",
    successBody: "No grupo você vai receber conteúdo sobre como escalar entregas de lançamento usando IA, como precificar white-label e como aumentar a margem por cliente sem contratar. Quando o carrinho abrir (por 24h), você é prioridade.",
    groupDesc: "Grupo de Esquenta · Agências & Gestores",
    color: "success" as const,
  },
};

// ─── Static content ────────────────────────────────────────────────────────────

const FEATURES_BY_SEGMENT: Record<Segment, Array<{ icon: React.ElementType; title: string; desc: string; accent: string }>> = {
  individual: [
    { icon: BrainCircuit, title: "Estratégia gerada por IA", desc: "Claude define trilha, cronograma de 7 dias, gatilhos mentais e sequência completa a partir do seu briefing.", accent: "primary" },
    { icon: Mail, title: "Copy por segmento", desc: "Emails e WhatsApp escritos pela IA para cada fase. Hot, warm e cold recebem abordagens diferentes.", accent: "primary" },
    { icon: Zap, title: "Disparo 100% automático", desc: "A sequência roda sozinha, no horário certo, para o lead certo. Você não toca em nada.", accent: "success" },
    { icon: BarChart3, title: "Painel de métricas", desc: "Score de saúde, temperatura de leads e taxa de abertura por disparo — tudo ao vivo.", accent: "success" },
    { icon: TrendingUp, title: "IA auto-otimiza", desc: "Quando o engajamento cai, a IA detecta e reescreve antes que o lançamento desacelere.", accent: "primary" },
    { icon: Shield, title: "Email + WhatsApp integrado", desc: "RD Station, ActiveCampaign e Meta Business API na mesma plataforma.", accent: "primary" },
  ],
  agency: [
    { icon: Building2, title: "White-label completo", desc: "Plataforma com sua marca, seu domínio. Seus clientes não precisam saber que é NexOS.", accent: "primary" },
    { icon: Users, title: "Multi-cliente", desc: "Gerencie múltiplas campanhas e sequências de clientes diferentes em um único painel centralizado.", accent: "primary" },
    { icon: Zap, title: "Operação automatizada", desc: "Cada cliente tem sua sequência rodando sozinha. Zero operação manual, zero acompanhamento por disparo.", accent: "success" },
    { icon: BarChart3, title: "Métricas por cliente", desc: "Score de saúde, engajamento e conversão por cliente — dashboards separados, visão centralizada.", accent: "success" },
    { icon: TrendingUp, title: "Margem maior", desc: "Entregue mais lançamentos com a mesma equipe. Cada automação é horas que você não precisa pagar.", accent: "primary" },
    { icon: Shield, title: "IA que escreve copy", desc: "Cada cliente recebe copy profissional por IA, por segmento de lista. Você aprova, não redige.", accent: "primary" },
  ],
};

const BEFORE_AFTER: Record<Segment, Array<{ before: string; after: string }>> = {
  individual: [
    { before: "Copywriter (R$3k–8k)", after: "Copy gerado por IA em segundos" },
    { before: "Gestor de tráfego + social media", after: "Automação de sequência completa" },
    { before: "Agência de email (R$1.5k/mês)", after: "Disparos automáticos integrados" },
    { before: "60–90 dias de preparação", after: "Ao vivo em 7 dias" },
    { before: "5+ ferramentas diferentes", after: "Tudo em uma única plataforma" },
    { before: "Depende de todo mundo funcionar junto", after: "Só você e a IA — ponto." },
  ],
  agency: [
    { before: "Redatores por projeto (custo variável)", after: "Copy por IA para todos os clientes" },
    { before: "Gestor dedicado por cliente", after: "Um painel, todos os clientes" },
    { before: "Operação de email manual por campanha", after: "Sequências automáticas por cliente" },
    { before: "Relatório manual de métricas", after: "Dashboards em tempo real por cliente" },
    { before: "Limite de clientes por capacidade", after: "Escala sem contratar" },
    { before: "Margem corroída por headcount", after: "Mais cliente = mais margem" },
  ],
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

function formatWhatsApp(val: string) {
  const digits = val.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// ─── Segment picker ────────────────────────────────────────────────────────────

function SegmentPicker({ onSelect }: { onSelect: (s: Segment) => void }) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-mono font-bold uppercase tracking-widest text-sm text-foreground">Lista de Espera</h3>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Primeiro: quem é você?</p>
      </div>

      <button
        onClick={() => onSelect("individual")}
        className="w-full text-left border border-border/50 bg-background/50 p-5 group hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)] transition-all duration-200 flex items-start gap-4 relative"
      >
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/0 group-hover:border-primary transition-colors"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/0 group-hover:border-primary transition-colors"></div>
        <div className="w-10 h-10 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 group-hover:border-primary/70 group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.3)] transition-all">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-mono font-bold text-sm uppercase tracking-wider text-foreground mb-1 group-hover:text-primary transition-colors">
            Sou Produtor / Lançador
          </div>
          <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Tenho produto digital e quero lançar sozinho, sem equipe
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all mt-0.5 shrink-0" />
      </button>

      <button
        onClick={() => onSelect("agency")}
        className="w-full text-left border border-border/50 bg-background/50 p-5 group hover:border-success/50 hover:bg-success/5 hover:shadow-[0_0_20px_hsl(var(--success)/0.1)] transition-all duration-200 flex items-start gap-4 relative"
      >
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-success/0 group-hover:border-success transition-colors"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-success/0 group-hover:border-success transition-colors"></div>
        <div className="w-10 h-10 border border-success/30 bg-success/10 flex items-center justify-center shrink-0 group-hover:border-success/70 group-hover:shadow-[0_0_10px_hsl(var(--success)/0.3)] transition-all">
          <Building2 className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <div className="font-mono font-bold text-sm uppercase tracking-wider text-foreground mb-1 group-hover:text-success transition-colors">
            Sou Agência / Gestor
          </div>
          <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Lanço para clientes ou gerencio operações de lançamento
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-success group-hover:translate-x-1 transition-all mt-0.5 shrink-0" />
      </button>
    </div>
  );
}

// ─── Waitlist form ─────────────────────────────────────────────────────────────

function WaitlistForm({
  segment,
  onBack,
  onSuccess,
}: {
  segment: Segment;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const data = SEGMENT_DATA[segment];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp: whatsapp.replace(/\D/g, ""),
          segment,
          source: "landing",
        }),
      });
      const json = await res.json();
      if (res.ok || json.joined) {
        onSuccess();
      } else {
        toast.error("Erro ao entrar na lista. Tente novamente.");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const accentColor = segment === "agency" ? "success" : "primary";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className={`inline-flex items-center gap-1.5 border border-${accentColor}/30 bg-${accentColor}/5 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-${accentColor} mb-2`}>
            {segment === "agency" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {data.badge}
          </div>
          <div className="flex items-center gap-2">
            <Lock className={`h-3.5 w-3.5 text-${accentColor}`} />
            <h3 className="font-mono font-bold uppercase tracking-widest text-sm text-foreground">Lista de Espera</h3>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{data.groupDesc}</p>
        </div>
        <button
          onClick={onBack}
          className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
        >
          ← Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Seu nome</Label>
          <Input
            id="wl-name"
            required
            placeholder="Como você se chama?"
            value={name}
            onChange={e => setName(e.target.value)}
            className={`rounded-none bg-background/50 border-border/50 focus-visible:ring-${accentColor} focus-visible:border-${accentColor} font-sans h-12`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-wa" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
          <Input
            id="wl-wa"
            required
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
            className={`rounded-none bg-background/50 border-border/50 focus-visible:ring-${accentColor} focus-visible:border-${accentColor} font-mono h-12`}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 mt-2 ${segment === "agency" ? "bg-success hover:bg-success/90 text-success-foreground" : "btn-weapon-primary"}`}
        >
          {loading ? "Entrando na lista..." : (
            <>Quero Entrar no {segment === "agency" ? "Grupo das Agências" : "Grupo dos Lançadores"} <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
        <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground opacity-60">
          Sem spam · Só o link do grupo quando abrir
        </p>
      </form>
    </div>
  );
}

// ─── Success state ─────────────────────────────────────────────────────────────

function SuccessState({ segment }: { segment: Segment }) {
  const data = SEGMENT_DATA[segment];
  const accentColor = segment === "agency" ? "success" : "primary";

  return (
    <div className="text-center py-4 space-y-6">
      <div className={`w-16 h-16 rounded-full bg-${accentColor}/10 border border-${accentColor}/30 flex items-center justify-center mx-auto`}>
        <CheckCircle2 className={`h-8 w-8 text-${accentColor} drop-shadow-[0_0_10px_hsl(var(--${accentColor})/0.7)]`} />
      </div>
      <div>
        <h3 className="font-mono font-black uppercase tracking-wider text-xl text-foreground mb-3">{data.successTitle}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {data.successBody}
        </p>
      </div>
      <div className={`border border-${accentColor}/20 bg-${accentColor}/5 p-4 text-left space-y-2`}>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className={`h-3.5 w-3.5 text-${accentColor}`} />
          <p className={`font-mono text-[10px] uppercase tracking-widest text-${accentColor} font-bold`}>
            {data.groupLabel}
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          O link do grupo chegará no seu WhatsApp assim que a data do esquenta for confirmada. Ative as notificações para não perder.
        </p>
      </div>
    </div>
  );
}

// ─── Countdown ─────────────────────────────────────────────────────────────────

function CountdownTimer() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date();
    target.setDate(target.getDate() + ((6 - target.getDay() + 7) % 7 || 7));
    target.setHours(20, 0, 0, 0);
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-2">
      {[{ v: time.days, l: "Dias" }, { v: time.hours, l: "Horas" }, { v: time.minutes, l: "Min" }, { v: time.seconds, l: "Seg" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center border border-primary/30 bg-primary/5 p-3">
          <span className="font-mono font-black text-3xl text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
            {String(v).padStart(2, "0")}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Hero form card ─────────────────────────────────────────────────────────────

function HeroFormCard() {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [joined, setJoined] = useState(false);

  return (
    <div className="relative">
      <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden group hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_hsl(var(--primary)/0.1)]">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>

        {joined && segment ? (
          <SuccessState segment={segment} />
        ) : segment ? (
          <WaitlistForm segment={segment} onBack={() => setSegment(null)} onSuccess={() => setJoined(true)} />
        ) : (
          <SegmentPicker onSelect={setSegment} />
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 justify-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
        <Clock className="h-3 w-3" />
        Carrinho abre uma única vez · Fecha em 24h · Sem exceções
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const [count, setCount] = useState<{ total: number; bySegment: Record<string, number> } | null>(null);
  const BASE_COUNT = 47;

  useEffect(() => {
    fetch("/api/waitlist/count")
      .then(r => r.json())
      .then(d => setCount(d))
      .catch(() => null);
  }, []);

  const total = (count?.total ?? 0) + BASE_COUNT;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS AI" className="h-8 w-8 object-contain" style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.6))" }} />
            <span className="font-mono font-bold text-sm tracking-widest uppercase">NexOS <span className="text-primary">AI</span></span>
          </div>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
              Já tenho acesso
            </Button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-20">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              Automated Launch · Em Breve
            </div>

            <h1 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Seu produto digital<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">no ar em 7 dias.</span><br />
              <span className="text-foreground/50 text-3xl md:text-4xl mt-2 block">100% automatizado.</span>
            </h1>

            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
              NexOS AI gera estratégia, escreve copy, dispara email e WhatsApp e monitora seu lançamento — <strong className="text-foreground">do briefing ao ao vivo, no piloto automático.</strong>
            </p>

            <div className="space-y-3 mb-8">
              {[
                "Carrinho aberto por apenas 24 horas",
                "Grupo de esquenta separado por perfil",
                "Conteúdo direcionado para seu tipo de negócio",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {count !== null && (
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span><strong className="text-foreground">{(count.bySegment["individual"] ?? 0) + Math.floor(BASE_COUNT * 0.6)}</strong> lançadores</span>
                </div>
                <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-success" />
                  <span><strong className="text-foreground">{(count.bySegment["agency"] ?? 0) + Math.floor(BASE_COUNT * 0.4)}</strong> agências</span>
                </div>
              </div>
            )}
          </div>

          {/* Right — form */}
          <HeroFormCard />
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* COUNTDOWN */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm py-10">
        <div className="max-w-xl mx-auto px-6 text-center space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Abertura do carrinho em</p>
          <CountdownTimer />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Quem não estiver na lista não recebe o link · Sem segunda chance
          </p>
        </div>
      </section>

      {/* SEGMENT SHOWCASE */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">Dois grupos. Dois caminhos.</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            Conteúdo focado<br />no seu perfil.
          </h2>
          <p className="text-muted-foreground mt-4 text-sm max-w-lg mx-auto leading-relaxed">
            Não existe conteúdo genérico aqui. Cada grupo tem uma linha editorial focada na conversão do seu tipo de negócio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/30">
          {(["individual", "agency"] as Segment[]).map(seg => {
            const d = SEGMENT_DATA[seg];
            const color = seg === "agency" ? "success" : "primary";
            const Icon = seg === "agency" ? Building2 : User;
            return (
              <div key={seg} className="bg-background p-10 relative overflow-hidden group card-weapon">
                <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-${color} to-transparent opacity-60 group-hover:opacity-100 transition-opacity`}></div>
                <div className={`inline-flex items-center gap-2 border border-${color}/30 bg-${color}/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-${color} mb-6`}>
                  <Icon className="h-3 w-3" />
                  {d.badge}
                </div>
                <h3 className="font-mono font-black uppercase tracking-tight text-2xl text-foreground mb-4">{d.headline}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">{d.sub}</p>
                <ul className="space-y-3">
                  {d.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 font-mono text-xs text-foreground">
                      <CheckCircle2 className={`h-3.5 w-3.5 text-${color} shrink-0 mt-0.5`} />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className={`mt-8 border-t border-${color}/20 pt-6`}>
                  <p className={`font-mono text-[9px] uppercase tracking-widest text-${color} font-bold`}>{d.groupLabel}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">Esquenta exclusivo · Conteúdo focado em conversão</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* BEFORE / AFTER — tabs by segment */}
      <section className="py-24 border-t border-border/30 bg-card/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O Problema</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
              Lançar do jeito atual<br />é caro e lento demais.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(["individual", "agency"] as Segment[]).map(seg => {
              const color = seg === "agency" ? "success" : "primary";
              const Icon = seg === "agency" ? Building2 : User;
              const d = SEGMENT_DATA[seg];
              return (
                <div key={seg} className="space-y-0 border border-border/40 overflow-hidden">
                  <div className={`p-4 bg-${color}/10 border-b border-border/40 flex items-center gap-2`}>
                    <Icon className={`h-4 w-4 text-${color}`} />
                    <span className={`font-mono text-xs uppercase tracking-widest text-${color} font-bold`}>{d.badge}</span>
                  </div>
                  <div className="divide-y divide-border/20">
                    {BEFORE_AFTER[seg].map((item, i) => (
                      <div key={i} className="grid grid-cols-2 gap-0 divide-x divide-border/20">
                        <div className="p-4 flex items-start gap-2 bg-destructive/5">
                          <div className="w-1 h-1 rounded-full bg-destructive/50 mt-2 shrink-0"></div>
                          <span className="font-mono text-[11px] text-muted-foreground line-through decoration-destructive/30">{item.before}</span>
                        </div>
                        <div className="p-4 flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                          <span className="font-mono text-[11px] text-foreground">{item.after}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURES — by segment */}
      {(["individual", "agency"] as Segment[]).map(seg => {
        const d = SEGMENT_DATA[seg];
        const color = seg === "agency" ? "success" : "primary";
        const Icon = seg === "agency" ? Building2 : User;
        const features = FEATURES_BY_SEGMENT[seg];
        return (
          <section key={seg} className={`py-24 border-t border-border/30 ${seg === "agency" ? "bg-card/10" : ""}`}>
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex items-center gap-4 mb-12">
                <div className={`flex items-center gap-2 border border-${color}/30 bg-${color}/5 px-4 py-2`}>
                  <Icon className={`h-4 w-4 text-${color}`} />
                  <span className={`font-mono text-[10px] uppercase tracking-widest text-${color} font-bold`}>{d.badge}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-mono font-black uppercase tracking-tight text-foreground">{d.headline}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/30">
                {features.map((f, i) => (
                  <div key={i} className="bg-background p-8 group relative overflow-hidden card-weapon">
                    <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-${f.accent === 'success' ? 'success' : 'primary'} to-transparent opacity-30 group-hover:opacity-100 transition-opacity`}></div>
                    <f.icon className={`h-5 w-5 mb-4 ${f.accent === 'success' ? 'text-success' : 'text-primary'}`} />
                    <h3 className="font-mono font-bold uppercase tracking-wider text-xs text-foreground mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* FINAL CTA */}
      <section className="py-32 relative overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              Vagas limitadas · Carrinho abre uma única vez · Fecha em 24h
            </div>
            <h2 className="text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Escolha seu grupo.<br />
              <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">Entre na lista agora.</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed">
              Lançadores e agências vão para grupos separados, com conteúdo focado para o seu modelo de negócio. Quem não estiver na lista não recebe o link quando o carrinho abrir.
            </p>
            {total > 0 && (
              <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground mb-10">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span><strong className="text-foreground">{total}</strong> pessoas já na lista de espera</span>
              </div>
            )}
          </div>
          <div className="max-w-md mx-auto">
            <HeroFormCard />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

    </div>
  );
}
