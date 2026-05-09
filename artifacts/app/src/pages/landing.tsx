import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, BarChart3, Mail, MessageSquare,
  BrainCircuit, TrendingUp, Clock, Lock, Users, AlertTriangle,
  Building2, User, ChevronRight, Zap, Eye, Cpu, Radio,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────────

type Segment = "individual" | "agency";

// ─── Launch phases config ────────────────────────────────────────────────────────
// CURRENT_PHASE controla o que está visível e ativo na landing.
// Altere para "esquenta" | "abertura" | "fechamento" conforme o lançamento avança.
// Change this value to advance the launch phase on the live page:
// "pre" | "esquenta" | "abertura" | "fechamento"
const CURRENT_PHASE = "pre" as "pre" | "esquenta" | "abertura" | "fechamento";

const PHASES = [
  {
    id: "pre",
    label: "Pré-lançamento",
    sublabel: "Lista de espera aberta",
    done: false,
    active: CURRENT_PHASE === "pre",
  },
  {
    id: "esquenta",
    label: "Esquenta",
    sublabel: "Grupos WhatsApp ativos",
    done: false,
    active: CURRENT_PHASE === "esquenta",
  },
  {
    id: "abertura",
    label: "Abertura do Carrinho",
    sublabel: "24h — sem exceções",
    done: false,
    active: CURRENT_PHASE === "abertura",
  },
  {
    id: "fechamento",
    label: "Carrinho Fechado",
    sublabel: "Próxima turma: indefinido",
    done: false,
    active: CURRENT_PHASE === "fechamento",
  },
];

// ─── Segment data ────────────────────────────────────────────────────────────────

const SEGMENT_DATA = {
  individual: {
    badge: "Lançador Solo",
    groupLabel: "Grupo dos Lançadores",
    groupDesc: "Esquenta · Lançadores Solo",
    headline: "Seu primeiro lançamento de 6 dígitos.",
    sub: "Sem equipe, sem agência, sem freelancer. Você coloca o briefing, a IA faz o resto — estratégia, copy, sequência de email e WhatsApp, tudo disparado no piloto automático.",
    bullets: [
      "Lançamento rodando enquanto você dorme",
      "Copy profissional gerado por IA em segundos",
      "Sem contratar ninguém — só você e a plataforma",
      "Da ideia ao carrinho em 7 dias",
    ],
    // Linha editorial do esquenta — o que o grupo vai receber
    esquentaSequence: [
      { day: "Dia 1", trigger: "Autoridade", label: "PL1", content: "Bastidores: como o NexOS AI foi construído e qual problema ele resolve de verdade." },
      { day: "Dia 3", trigger: "Transformação", label: "PL2", content: "Caso real: um lançamento do briefing ao ao vivo em 7 dias, automatizado, sem equipe." },
      { day: "Dia 5", trigger: "Prova Social", label: "PL3", content: "Demo ao vivo da plataforma + perguntas e respostas no grupo." },
      { day: "Dia 7", trigger: "Urgência", label: "Abertura", content: "Carrinho aberto. 24h. Link exclusivo para quem estava no grupo." },
    ],
    successTitle: "Você está no grupo dos Lançadores.",
    successBody: "Nos próximos dias você vai receber no WhatsApp bastidores, demos e provas de que é possível lançar sozinho com IA. Quando o carrinho abrir — por 24h — você é o primeiro a saber.",
    color: "primary" as const,
  },
  agency: {
    badge: "Agência / Gestor",
    groupLabel: "Grupo das Agências",
    groupDesc: "Esquenta · Agências & Gestores",
    headline: "Escale clientes com IA sem aumentar equipe.",
    sub: "White-label completo, multi-cliente, automação total de copy e sequência. Entregue mais lançamentos com a mesma operação — e com margem muito maior.",
    bullets: [
      "White-label — sua marca, sua operação",
      "Gestão de múltiplos clientes em um painel",
      "Entrega sem aumentar headcount",
      "Mais cliente = mais margem",
    ],
    esquentaSequence: [
      { day: "Dia 1", trigger: "Autoridade", label: "PL1", content: "Bastidores: como agências estão usando IA para multiplicar entregas sem contratar." },
      { day: "Dia 3", trigger: "Transformação", label: "PL2", content: "Modelo de negócio: como precificar white-label e qual margem é possível por cliente." },
      { day: "Dia 5", trigger: "Prova Social", label: "PL3", content: "Demo ao vivo do painel multi-cliente + sessão de perguntas técnicas no grupo." },
      { day: "Dia 7", trigger: "Urgência", label: "Abertura", content: "Carrinho aberto. 24h. Acesso prioritário para agências com condições diferenciadas." },
    ],
    successTitle: "Você está no grupo das Agências.",
    successBody: "Nos próximos dias você vai receber no WhatsApp como agências estão usando IA para escalar, precificar e entregar mais com menos headcount. Quando o carrinho abrir — por 24h — você tem prioridade.",
    color: "success" as const,
  },
};

// ─── Utilities ───────────────────────────────────────────────────────────────────

function formatWhatsApp(val: string) {
  const d = val.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

// ─── Phase bar ───────────────────────────────────────────────────────────────────

function PhaseBanner() {
  const current = PHASES.find(p => p.active) ?? PHASES[0];
  return (
    <div className="fixed top-16 inset-x-0 z-40 border-b border-primary/20 bg-primary/5 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary font-bold">
            Fase atual: {current.label}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 hidden sm:inline">
            · {current.sublabel}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-0">
          {PHASES.map((phase, i) => (
            <div key={phase.id} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[8px] uppercase tracking-widest transition-all ${
                phase.active
                  ? "text-primary font-bold"
                  : phase.done
                  ? "text-muted-foreground/40 line-through"
                  : "text-muted-foreground/30"
              }`}>
                {phase.done && <CheckCircle2 className="h-2.5 w-2.5" />}
                {phase.active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                {phase.label}
              </div>
              {i < PHASES.length - 1 && (
                <span className="text-muted-foreground/20 font-mono text-xs">›</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Segment picker ──────────────────────────────────────────────────────────────

function SegmentPicker({ onSelect }: { onSelect: (s: Segment) => void }) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-mono font-bold uppercase tracking-widest text-sm text-foreground">Lista de Espera</h3>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Primeiro — quem é você?</p>
      </div>

      {(["individual", "agency"] as Segment[]).map(seg => {
        const d = SEGMENT_DATA[seg];
        const isAgency = seg === "agency";
        const color = isAgency ? "success" : "primary";
        const Icon = isAgency ? Building2 : User;
        return (
          <button
            key={seg}
            onClick={() => onSelect(seg)}
            className={`w-full text-left border border-border/50 bg-background/50 p-5 group hover:border-${color}/50 hover:bg-${color}/5 hover:shadow-[0_0_20px_hsl(var(--${color})/0.1)] transition-all duration-200 flex items-start gap-4 relative`}
          >
            <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l border-${color}/0 group-hover:border-${color} transition-colors`}></div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r border-${color}/0 group-hover:border-${color} transition-colors`}></div>
            <div className={`w-10 h-10 border border-${color}/30 bg-${color}/10 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_10px_hsl(var(--${color})/0.3)] transition-all`}>
              <Icon className={`h-5 w-5 text-${color}`} />
            </div>
            <div className="flex-1">
              <div className={`font-mono font-bold text-sm uppercase tracking-wider text-foreground mb-1 group-hover:text-${color} transition-colors`}>
                {seg === "individual" ? "Sou Produtor / Lançador" : "Sou Agência / Gestor"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                {seg === "individual"
                  ? "Tenho produto digital e quero lançar sozinho, sem equipe"
                  : "Lanço para clientes ou gerencio operações de lançamento"}
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground/30 group-hover:text-${color} group-hover:translate-x-1 transition-all mt-0.5 shrink-0`} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Waitlist form ───────────────────────────────────────────────────────────────

function WaitlistForm({ segment, onBack, onSuccess }: { segment: Segment; onBack: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const d = SEGMENT_DATA[segment];
  const color = d.color;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), segment, source: "landing" }),
      });
      const json = await res.json();
      if (res.ok || json.joined) { onSuccess(); } else { toast.error("Erro ao entrar na lista. Tente novamente."); }
    } catch { toast.error("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className={`inline-flex items-center gap-1.5 border border-${color}/30 bg-${color}/5 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-${color} mb-2`}>
            {segment === "agency" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {d.badge}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{d.groupDesc}</p>
        </div>
        <button onClick={onBack} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1">← Voltar</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Seu nome</Label>
          <Input id="wl-name" required placeholder="Como você se chama?" value={name} onChange={e => setName(e.target.value)} className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-sans h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-wa" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
          <Input id="wl-wa" required placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(formatWhatsApp(e.target.value))} className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-mono h-12" />
        </div>
        <Button type="submit" disabled={loading} className={`w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 mt-2 ${segment === "agency" ? "bg-success hover:bg-success/90 text-success-foreground" : "btn-weapon-primary"}`}>
          {loading ? "Entrando na lista..." : (<>Entrar no {segment === "agency" ? "Grupo das Agências" : "Grupo dos Lançadores"} <ArrowRight className="h-4 w-4" /></>)}
        </Button>
        <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground opacity-60">Sem spam · Só conteúdo de lançamento + o link quando abrir</p>
      </form>
    </div>
  );
}

// ─── Success state ───────────────────────────────────────────────────────────────

function SuccessState({ segment }: { segment: Segment }) {
  const d = SEGMENT_DATA[segment];
  const color = d.color;
  return (
    <div className="space-y-6 py-2">
      <div className={`w-14 h-14 rounded-full bg-${color}/10 border border-${color}/30 flex items-center justify-center`}>
        <CheckCircle2 className={`h-7 w-7 text-${color} drop-shadow-[0_0_10px_hsl(var(--${color})/0.7)]`} />
      </div>
      <div>
        <h3 className="font-mono font-black uppercase tracking-wider text-lg text-foreground mb-2">{d.successTitle}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{d.successBody}</p>
      </div>
      <div className={`border border-${color}/20 bg-${color}/5 p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <MessageSquare className={`h-3.5 w-3.5 text-${color}`} />
          <p className={`font-mono text-[9px] uppercase tracking-widest text-${color} font-bold`}>O que vem a seguir</p>
        </div>
        <div className="space-y-2">
          {d.esquentaSequence.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`font-mono text-[8px] uppercase tracking-widest text-${color}/60 mt-0.5 w-12 shrink-0`}>{item.day}</span>
              <span className="font-mono text-[10px] text-muted-foreground leading-relaxed">{item.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Hero card ───────────────────────────────────────────────────────────────────

function HeroCard() {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [joined, setJoined] = useState(false);
  return (
    <div className="relative">
      <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_hsl(var(--primary)/0.1)]">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>
        {joined && segment
          ? <SuccessState segment={segment} />
          : segment
          ? <WaitlistForm segment={segment} onBack={() => setSegment(null)} onSuccess={() => setJoined(true)} />
          : <SegmentPicker onSelect={setSegment} />}
      </div>
      <div className="mt-4 flex items-center gap-2 justify-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
        <Clock className="h-3 w-3" />
        Carrinho abre uma única vez · Fecha em 24h · Sem exceções
      </div>
    </div>
  );
}

// ─── Countdown ───────────────────────────────────────────────────────────────────

function CountdownTimer() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const target = new Date();
    target.setDate(target.getDate() + ((6 - target.getDay() + 7) % 7 || 7));
    target.setHours(20, 0, 0, 0);
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) return;
      setTime({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) });
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return (
    <div className="grid grid-cols-4 gap-2">
      {[{ v: time.days, l: "Dias" }, { v: time.hours, l: "Horas" }, { v: time.minutes, l: "Min" }, { v: time.seconds, l: "Seg" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center border border-primary/30 bg-primary/5 p-4">
          <span className="font-mono font-black text-4xl text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">{String(v).padStart(2, "0")}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────────

export default function Landing() {
  const [count, setCount] = useState<{ total: number; bySegment: Record<string, number> } | null>(null);
  const BASE = 47;
  useEffect(() => { fetch("/api/waitlist/count").then(r => r.json()).then(setCount).catch(() => null); }, []);
  const total = (count?.total ?? 0) + BASE;

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
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">Já tenho acesso</Button>
          </Link>
        </div>
      </nav>

      {/* PHASE BANNER */}
      <PhaseBanner />

      {/* ─── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-28 overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
          <div>
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              Automated Launch · Pré-lançamento em andamento
            </div>
            <h1 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Seu produto digital<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">no ar em 7 dias.</span><br />
              <span className="text-foreground/50 text-3xl md:text-4xl mt-2 block">100% automatizado por IA.</span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
              NexOS AI gera estratégia, escreve copy por segmento, dispara email e WhatsApp no momento certo e monitora seu lançamento — <strong className="text-foreground">do briefing ao carrinho, no piloto automático.</strong>
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Carrinho aberto por apenas 24 horas",
                "Dois grupos de esquenta — lançadores e agências",
                "Conteúdo de lançamento estruturado por perfil",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            {count !== null && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <strong className="text-foreground">{(count.bySegment["individual"] ?? 0) + Math.floor(BASE * 0.6)}</strong>&nbsp;lançadores
                </div>
                <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-success" />
                  <strong className="text-foreground">{(count.bySegment["agency"] ?? 0) + Math.floor(BASE * 0.4)}</strong>&nbsp;agências
                </div>
              </div>
            )}
          </div>
          <HeroCard />
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* ─── META SECTION: este lançamento É o produto ─────────────────────── */}
      <section className="border-y border-primary/20 bg-primary/5 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-primary mb-6">
                <Cpu className="h-3 w-3" />
                Meta · Prova de Conceito
              </div>
              <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground mb-4">
                Este lançamento<br />é operado pelo<br />
                <span className="text-primary">próprio NexOS AI.</span>
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Não estamos te contando sobre automação de lançamento. Estamos <strong className="text-foreground">executando um lançamento automatizado enquanto você lê isso.</strong> Cada fase, cada gatilho mental, cada disparo no grupo do WhatsApp — gerado e disparado pela plataforma que você está prestes a conhecer.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: BrainCircuit, label: "Estratégia do lançamento", value: "Gerada por Claude (IA) com base no produto e público-alvo" },
                { icon: Mail, label: "Copy desta página", value: "Escrito seguindo estrutura de Fórmula de Lançamento com IA" },
                { icon: MessageSquare, label: "Conteúdo dos grupos", value: "Sequência PLF automatizada: PL1 → PL2 → PL3 → Abertura" },
                { icon: BarChart3, label: "Segmentação dos leads", value: "Lançadores e agências em grupos separados, copy diferente" },
                { icon: Zap, label: "Disparo no WhatsApp", value: "Automático, no horário certo, para o perfil certo" },
                { icon: Radio, label: "Abertura do carrinho", value: "24h exatas, com urgência real — sem prorrogação" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 border border-border/30 bg-background/50 p-3 group hover:border-primary/30 transition-colors">
                  <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── LAUNCH SEQUENCE VISIBLE ──────────────────────────────────────── */}
      <section className="py-24 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">A Sequência em Andamento</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            O que acontece depois<br />que você entrar na lista.
          </h2>
          <p className="text-muted-foreground mt-4 text-sm max-w-lg mx-auto leading-relaxed">
            Esta é a sequência de lançamento estruturado que o NexOS AI está executando para este lançamento — e que você poderá configurar para os seus.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(["individual", "agency"] as Segment[]).map(seg => {
            const d = SEGMENT_DATA[seg];
            const color = d.color;
            const Icon = seg === "agency" ? Building2 : User;
            return (
              <div key={seg} className="border border-border/40 overflow-hidden">
                <div className={`p-5 border-b border-border/40 bg-${color}/10 flex items-center gap-3`}>
                  <Icon className={`h-4 w-4 text-${color}`} />
                  <div>
                    <div className={`font-mono text-xs uppercase tracking-widest text-${color} font-bold`}>{d.badge}</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{d.groupLabel}</div>
                  </div>
                </div>
                <div className="divide-y divide-border/20 relative">
                  <div className="absolute left-[2.6rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 to-transparent pointer-events-none"></div>
                  {d.esquentaSequence.map((item, i) => {
                    const isAbertura = item.label === "Abertura";
                    return (
                      <div key={i} className={`p-5 flex items-start gap-4 ${isAbertura ? `bg-${color}/5` : ""}`}>
                        <div className={`w-10 text-center shrink-0`}>
                          <div className={`inline-flex items-center justify-center w-8 h-8 border font-mono font-bold text-[9px] uppercase tracking-widest ${
                            isAbertura
                              ? `border-${color} bg-${color}/20 text-${color} shadow-[0_0_10px_hsl(var(--${color})/0.3)]`
                              : "border-border/40 bg-muted/20 text-muted-foreground"
                          }`}>
                            {item.label}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-mono text-[9px] uppercase tracking-widest ${isAbertura ? `text-${color}` : "text-muted-foreground/60"}`}>{item.day}</span>
                            <span className="font-mono text-[9px] text-muted-foreground/30">·</span>
                            <span className={`font-mono text-[9px] uppercase tracking-widest ${isAbertura ? `text-${color} font-bold` : "text-muted-foreground/50"}`}>Gatilho: {item.trigger}</span>
                          </div>
                          <p className="font-mono text-[11px] text-foreground leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── COUNTDOWN ────────────────────────────────────────────────────── */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm py-12">
        <div className="max-w-xl mx-auto px-6 text-center space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Abertura do carrinho em</p>
          <CountdownTimer />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Quem não estiver na lista não recebe o link · Sem segunda chance
          </p>
        </div>
      </section>

      {/* ─── WHAT IT DOES (PL2 — TRANSFORMAÇÃO) ──────────────────────────── */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O que você passa a ter</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            A transformação real<br />do lançamento automatizado.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border/40 overflow-hidden">
          <div className="border-r border-border/40">
            <div className="p-5 border-b border-border/40 bg-destructive/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-destructive font-bold">Lançamento do jeito atual</h3>
            </div>
            {[
              ["Copywriter por projeto", "R$3.000–8.000"],
              ["Gestor de tráfego + social media", "R$2.000–4.000/mês"],
              ["Agência de email marketing", "R$1.500–3.000/mês"],
              ["Plataforma de CRM e automação", "R$500–2.000/mês"],
              ["60–90 dias de preparação", "Todo lançamento"],
              ["5+ ferramentas descoordenadas", "Risco operacional alto"],
              ["Depende de todo mundo funcionar junto", "Quase nunca funciona"],
            ].map(([item, cost], i) => (
              <div key={i} className="p-4 border-b border-border/20 last:border-0 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0"></div>
                  <span className="font-mono text-sm text-muted-foreground line-through decoration-destructive/30">{item}</span>
                </div>
                <span className="font-mono text-[10px] text-destructive/60 shrink-0">{cost}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="p-5 border-b border-border/40 bg-success/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-success font-bold">Com NexOS AI</h3>
            </div>
            {[
              ["Copy por IA — por segmento, por fase", "Incluído"],
              ["Sequência automatizada completa", "Incluído"],
              ["Email + WhatsApp integrado e automático", "Incluído"],
              ["CRM + segmentação hot/warm/cold por IA", "Incluído"],
              ["Ao vivo em 7 dias após o briefing", "Todo lançamento"],
              ["Uma plataforma, tudo centralizado", "Zero risco operacional"],
              ["Só você e a IA — ponto", "Funciona sempre"],
            ].map(([item, tag], i) => (
              <div key={i} className="p-4 border-b border-border/20 last:border-0 flex items-center justify-between group hover:bg-success/5 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 drop-shadow-[0_0_5px_hsl(var(--success)/0.4)]" />
                  <span className="font-mono text-sm text-foreground">{item}</span>
                </div>
                <span className="font-mono text-[10px] text-success/70 shrink-0">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PL3 — PROVA: o produto por dentro ────────────────────────────── */}
      <section className="py-24 border-t border-border/30 bg-card/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
              Da ideia ao lançamento.<br />4 etapas. 7 dias.
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block"></div>
            <div className="space-y-0">
              {[
                { n: "01", icon: Clock, label: "PL-Prep", title: "Briefing em 10 minutos", desc: "Você responde perguntas sobre produto, público e meta de receita. A IA já começa a construir a estratégia enquanto você responde." },
                { n: "02", icon: BrainCircuit, label: "Estratégia", title: "IA define tudo", desc: "Claude escolhe trilha (6, 8 ou 10 dígitos), monta cronograma de 7 dias, define gatilhos mentais por fase e gera sequência completa de email + WhatsApp." },
                { n: "03", icon: Eye, label: "Aprovação", title: "Você revisa, IA ajusta", desc: "Copy gerado por GPT-4o para cada fase e segmento (hot/warm/cold). Você aprova ou solicita ajuste. Tudo na plataforma, em segundos." },
                { n: "04", icon: Zap, label: "Execução", title: "Piloto automático ligado", desc: "Sequência ativa. NexOS dispara no horário certo, para o segmento certo, monitora engajamento e auto-otimiza se o score cair." },
              ].map((step, i) => (
                <div key={i} className="flex gap-8 py-10 border-b border-border/30 last:border-0 group">
                  <div className="flex-shrink-0 w-16 h-16 border border-primary/30 bg-primary/5 flex items-center justify-center font-mono font-black text-2xl text-primary group-hover:border-primary/70 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all relative z-10">
                    {step.n}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-3 mb-2">
                      <step.icon className="h-4 w-4 text-primary" />
                      <span className="font-mono font-bold uppercase tracking-wider text-sm text-foreground">{step.title}</span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 border border-primary/20 px-2 py-0.5">{step.label}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA — Abertura ─────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              Vagas limitadas · Carrinho abre uma única vez · Fecha em 24h
            </div>
            <h2 className="text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Entre na lista agora.<br />
              <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">O esquenta começa em breve.</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto mb-4 leading-relaxed">
              Você vai entrar no grupo certo para o seu perfil e receber conteúdo de lançamento estruturado antes de qualquer decisão. Quando o carrinho abrir — por 24h — você estará pronto.
            </p>
            {total > 0 && (
              <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground mb-10">
                <Users className="h-3.5 w-3.5 text-primary" />
                <strong className="text-foreground">{total}</strong>&nbsp;pessoas já na lista
              </div>
            )}
          </div>
          <div className="max-w-md mx-auto">
            <HeroCard />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

    </div>
  );
}
