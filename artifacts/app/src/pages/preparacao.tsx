import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, MessageSquare, Clock, Send, Loader2,
  Lock, Users, ArrowRight, Zap, Star, ChevronDown, ChevronUp,
  Bot, User, Calendar, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
type Segment = "individual" | "agency";
interface ChatMsg { role: "user" | "assistant"; content: string }

// ── Config ────────────────────────────────────────────────────────────────────
const WHATSAPP_LINKS: Record<Segment, string | null> = {
  individual: null, // substituir pelo link real quando disponível
  agency: null,
};

const SEGMENT_CONFIG = {
  individual: {
    badge: "Lançador Solo",
    groupName: "Grupo dos Lançadores",
    headline: "Você está dentro!",
    sub: "Prepare-se — o que vem por aí vai mudar a forma como você enxerga lançamentos digitais. Enquanto isso, o Jeff, nosso especialista, está disponível agora para responder qualquer dúvida.",
    color: "primary" as const,
    totalDays: 10,
    phases: [
      { day: "Em breve",  label: "Conteúdo exclusivo", desc: "Você vai receber acesso a conteúdo que não está disponível em nenhum outro lugar.", icon: Zap },
      { day: "Em breve",  label: "Código NEXOS",       desc: "Bônus exclusivo para quem acompanhar de perto. Fique de olho.", icon: Star },
      { day: "Em breve",  label: "Janela de acesso",   desc: "Vagas limitadas. Sem prorrogação.", icon: Radio },
      { day: "Em breve",  label: "Encerramento",       desc: "Quem não entrar na janela espera a próxima turma — sem data prevista.", icon: Lock },
    ],
    aiGreeting: "Sou Jeff, estou aqui para responder suas dúvidas.\n\nA automação do processo de vendas da NexOS te economiza dinheiro, tempo e otimiza seu retorno — vamos avaliar juntos o impacto que isso pode ter no seu projeto.\n\nPrimeiro: você já tentou lançar alguma vez, ou ainda está esperando o momento certo para começar?",
  },
  agency: {
    badge: "Agência / Gestor",
    groupName: "Grupo das Agências",
    headline: "Você está dentro!",
    sub: "Prepare-se — nos próximos dias você vai ver de perto como a NexOS opera por dentro. Enquanto isso, o Jeff — nosso especialista — está disponível agora.",
    color: "success" as const,
    totalDays: 8,
    phases: [
      { day: "Em breve",  label: "Conteúdo exclusivo", desc: "Cases e demonstrações reais de como agências estão escalando com IA.", icon: Zap },
      { day: "Em breve",  label: "Código NEXOS",       desc: "Bônus exclusivo para agências. Fique de olho.", icon: Star },
      { day: "Em breve",  label: "Janela de acesso",   desc: "Condições especiais para agências. Vagas limitadas.", icon: Radio },
      { day: "Em breve",  label: "Encerramento",       desc: "Carrinho fecha. Sem exceções.", icon: Lock },
    ],
    aiGreeting: "Sou Jeff, estou aqui para responder suas dúvidas.\n\nA automação do processo de vendas da NexOS economiza dinheiro, tempo e otimiza o retorno de cada cliente que você gerencia — vamos avaliar juntos o impacto real na sua operação.\n\nMe conta: há quanto tempo você sonha em escalar os lançamentos dos seus clientes sem precisar aumentar a equipe?",
  },
};

// ── Static 7-day countdown display ────────────────────────────────────────────
function FrozenCountdown({ totalDays }: { totalDays: number }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5">
        <Clock className="h-3 w-3" /> Previsão de abertura
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { v: totalDays, l: "Dias" },
          { v: "00",       l: "Horas" },
          { v: "00",       l: "Min" },
          { v: "00",       l: "Seg" },
        ].map(({ v, l }) => (
          <div key={l} className="flex flex-col items-center border border-primary/30 bg-primary/5 py-3 px-1">
            <span className="font-mono font-black text-3xl md:text-4xl text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
              {String(v).padStart(2, "0")}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{l}</span>
          </div>
        ))}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center pt-1">
        Contagem inicia com o aquecimento · Carrinho abre 24h antes do fim
      </p>
    </div>
  );
}

// ── WhatsApp join button ───────────────────────────────────────────────────────
function WhatsAppButton({ segment }: { segment: Segment }) {
  const link = WHATSAPP_LINKS[segment];
  const cfg = SEGMENT_CONFIG[segment];

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        <Button className="w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 bg-[#25D366] hover:bg-[#1fad55] text-white">
          <MessageSquare className="h-5 w-5" />
          Entrar no {cfg.groupName}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        disabled
        className="w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 opacity-60 bg-[#25D366]/30 text-white cursor-not-allowed"
      >
        <Lock className="h-4 w-4" />
        Grupo do WhatsApp — Em breve
      </Button>
      <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center">
        Link será liberado quando o aquecimento começar · Você receberá no WhatsApp
      </p>
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function AiChat({ segment }: { segment: Segment }) {
  const cfg = SEGMENT_CONFIG[segment];
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [jeffTyping, setJeffTyping] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Simulate Jeff typing the opening greeting on mount
  useEffect(() => {
    const delay = 1800 + Math.random() * 800; // 1.8s–2.6s
    const timer = setTimeout(() => {
      setJeffTyping(false);
      setMessages([{ role: "assistant", content: cfg.aiGreeting }]);
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, jeffTyping]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: ChatMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/waitlist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          segment,
          history: updated.slice(-12).slice(0, -1), // last 12 msgs excluding the one we just sent
        }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Ops, tive um problema. Tente novamente!" }]);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border border-primary/20 bg-card/40 overflow-hidden">
      {/* Chat header */}
      <div className="border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0 bg-muted/5">
        <div className="w-9 h-9 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 font-mono font-black text-primary text-sm">
          J
        </div>
        <div>
          <div className="font-mono font-bold text-xs uppercase tracking-widest text-foreground">Jeff · Especialista NexOS</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-success">Disponível agora</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-sm border flex items-center justify-center shrink-0 font-mono font-black text-xs ${
              msg.role === "assistant"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/20 text-muted-foreground"
            }`}>
              {msg.role === "assistant" ? "J" : <User className="h-3.5 w-3.5" />}
            </div>
            {/* Bubble */}
            <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed font-sans ${
              msg.role === "assistant"
                ? "border border-primary/20 bg-primary/5 text-foreground"
                : "border border-border/50 bg-muted/20 text-foreground"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {(loading || jeffTyping) && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 font-mono font-black text-xs text-primary">
              J
            </div>
            <div className="border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2">
              {loading
                ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                : <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </span>
              }
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">Jeff está digitando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3 shrink-0 bg-muted/5">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Pergunte sobre o NexOS AI, planos, lançamento..."
            className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-sans text-sm h-11 flex-1"
            disabled={loading || jeffTyping}
          />
          <Button
            onClick={() => void send()}
            disabled={loading || jeffTyping || !input.trim()}
            className="rounded-none h-11 px-4 btn-weapon-primary shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest mt-2">
          Jeff · Especialista NexOS · Responde agora
        </p>
      </div>
    </div>
  );
}

// ── Timeline accordion ─────────────────────────────────────────────────────────
function LaunchTimeline({ segment }: { segment: Segment }) {
  const cfg = SEGMENT_CONFIG[segment];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5">
        <Calendar className="h-3 w-3" /> Cronograma do lançamento
      </div>
      {cfg.phases.map((phase, i) => {
        const Icon = phase.icon;
        const isOpen = open === i;
        const isLast = i === cfg.phases.length - 1;
        return (
          <div
            key={i}
            className={`border transition-all ${isLast ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"}`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <div className={`w-7 h-7 border flex items-center justify-center shrink-0 ${isLast ? "border-primary/40 bg-primary/10" : "border-border/40 bg-muted/10"}`}>
                <Icon className={`h-3.5 w-3.5 ${isLast ? "text-primary" : "text-muted-foreground/50"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">{phase.day}</div>
                <div className={`font-mono text-xs font-bold uppercase tracking-wider ${isLast ? "text-primary" : "text-foreground"}`}>{phase.label}</div>
              </div>
              {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground/40 shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
            </button>
            {isOpen && (
              <div className="border-t border-border/30 px-3 py-2.5 bg-muted/5">
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{phase.desc}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PreparacaoPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const rawSegment = params.get("segment");
  const segment: Segment = rawSegment === "agency" ? "agency" : "individual";
  const cfg = SEGMENT_CONFIG[segment];
  const color = cfg.color;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-28 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img src={nexosLogo} alt="NexOS AI" className="h-20 w-20 object-contain" style={{ filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.65))" }} />
            <div>
              <div className="font-mono font-black text-2xl tracking-[0.15em] uppercase leading-tight">NexOS <span className="text-primary">AI</span></div>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70 leading-tight">Plataforma de Lançamento</div>
            </div>
          </div>
          <a href="/login" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            Já tenho acesso →
          </a>
        </div>
      </nav>

      {/* ── Hero confirmation banner ── */}
      <section className="pt-28 pb-10 px-6 auth-bg-gradient">
        <div className="max-w-6xl mx-auto">
          <div className={`inline-flex items-center gap-2 border border-${color}/30 bg-${color}/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-${color} mb-6`}>
            <Users className="h-3.5 w-3.5" />
            {cfg.badge} · {cfg.groupName}
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
            <div className={`w-14 h-14 rounded-full bg-${color}/10 border-2 border-${color}/40 flex items-center justify-center shrink-0`}>
              <CheckCircle2 className={`h-8 w-8 text-${color}`} style={{ filter: `drop-shadow(0 0 10px hsl(var(--${color})/0.7))` }} />
            </div>
            <h1 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none text-foreground">
              {cfg.headline}
            </h1>
          </div>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {cfg.sub}
          </p>
        </div>
      </section>

      {/* ── Main grid ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* AI Chat — takes 3 cols */}
          <div className="lg:col-span-3 h-[600px] lg:h-[680px] flex flex-col">
            <AiChat segment={segment} />
          </div>

          {/* Right panel — 2 cols */}
          <div className="lg:col-span-2 space-y-5">
            {/* Countdown */}
            <div className="border border-border/50 bg-card/40 p-4">
              <FrozenCountdown totalDays={cfg.totalDays} />
            </div>

            {/* WhatsApp button */}
            <div className="border border-border/50 bg-card/40 p-4 space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Grupo do WhatsApp
              </div>
              <WhatsAppButton segment={segment} />
            </div>

            {/* Launch timeline */}
            <div className="border border-border/50 bg-card/40 p-4">
              <LaunchTimeline segment={segment} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom strip ── */}
      <div className="border-t border-border/30 bg-muted/5 py-6 px-6 text-center">
        <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
          Fique de olho no WhatsApp cadastrado · O Jeff está aqui agora para qualquer dúvida
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest mt-1">
          NexOS AI · contato@nexos.ai
        </p>
      </div>
    </div>
  );
}
