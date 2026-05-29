import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, Loader2, Zap, Target, Users, PenTool, BarChart3, Mail,
  Rocket, Bot, Activity, Play, Eye, X, ChevronLeft, ChevronRight,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import type { CampaignEvent } from "@/lib/socket";

// ── Shared types ──────────────────────────────────────────────────────────────
type AgentConfig = {
  role: string;
  label: string;
  provider: "Claude" | "GPT-4o" | "Gemini";
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const AGENTS: AgentConfig[] = [
  { role: "strategy",        label: "Estrategista",           provider: "Claude",  desc: "Lendo briefing e analisando mercado...",         Icon: Target    },
  { role: "profile_builder", label: "Profile Builder",        provider: "Claude",  desc: "Construindo perfil de audiência-alvo...",         Icon: Users     },
  { role: "offer",           label: "Especialista em Oferta", provider: "Claude",  desc: "Destilando proposta de valor única...",           Icon: Zap       },
  { role: "media_buyer",     label: "Media Buyer",            provider: "GPT-4o",  desc: "Mapeando landscape de mídia paga...",             Icon: BarChart3 },
  { role: "copywriter",      label: "Copywriter",             provider: "GPT-4o",  desc: "Preparando arsenal de copy de conversão...",      Icon: PenTool   },
  { role: "content_planner", label: "Planejador de Conteúdo", provider: "GPT-4o",  desc: "Arquitetando calendário e sequências...",          Icon: Activity  },
  { role: "email_marketer",  label: "Email Marketer",         provider: "Gemini",  desc: "Configurando sequências de nutrição...",          Icon: Mail      },
  { role: "launch_manager",  label: "Gerente de Lançamento",  provider: "Gemini",  desc: "Calculando cronograma e checkpoints...",          Icon: Rocket    },
];

const PROVIDER_COLORS: Record<string, string> = {
  Claude:  "text-cyan-400/70 border-cyan-400/25 bg-cyan-400/5",
  "GPT-4o": "text-green-400/70 border-green-400/25 bg-green-400/5",
  Gemini:  "text-purple-400/70 border-purple-400/25 bg-purple-400/5",
};

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 1 — ANALYZING: Agents Activating
// ══════════════════════════════════════════════════════════════════════════════
export function AnalyzingDisplay() {
  const [activeCount, setActiveCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const PHASE_LABELS = [
    "Conectando ao NEXOS CORE...",
    "Lendo seu briefing e contexto de mercado...",
    "Preparando diagnóstico estratégico para revisão...",
    "Construindo plano de ação — pronto em breve para sua avaliação...",
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase transitions
    timers.push(setTimeout(() => setPhase(1), 600));
    timers.push(setTimeout(() => setPhase(2), 1800));
    timers.push(setTimeout(() => setPhase(3), 4000));

    // Activate agents staggered
    AGENTS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveCount(c => c + 1), 2200 + i * 1000));
    });

    // Smooth progress bar
    const progInt = setInterval(() => {
      setProgress(prev => {
        if (prev >= 94) { clearInterval(progInt); return prev; }
        return prev + (prev < 40 ? 3 : prev < 75 ? 1.5 : 0.4);
      });
    }, 280);

    return () => { timers.forEach(clearTimeout); clearInterval(progInt); };
  }, []);

  return (
    <div className="relative overflow-hidden border border-primary/40 bg-gradient-to-b from-primary/8 via-primary/3 to-background">
      {/* Scanning line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />

      {/* Orbital glow top-right */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-primary/10 pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-primary/8 pointer-events-none" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full border-2 border-primary/50 flex items-center justify-center bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-primary uppercase tracking-widest">
              Agentes Trabalhando para Você
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5 transition-all duration-500">
              {PHASE_LABELS[phase]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-primary/70 border border-primary/30 bg-primary/5 px-3 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          EM ANÁLISE
        </div>
      </div>

      {/* Agents grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AGENTS.map((agent, i) => {
          const { Icon } = agent;
          const isOnline  = i < activeCount;
          const isLoading = i === activeCount && phase >= 2;
          return (
            <div
              key={agent.role}
              className={`border px-3 py-2.5 flex items-center gap-3 transition-all duration-500
                ${isOnline  ? "border-success/35 bg-success/5"
                : isLoading ? "border-primary/45 bg-primary/5 animate-pulse"
                :             "border-border/20 bg-card/15 opacity-35"}`}
            >
              <div className={`w-7 h-7 border flex items-center justify-center shrink-0 transition-all duration-300
                ${isOnline  ? "border-success/40 bg-success/10"
                : isLoading ? "border-primary/40 bg-primary/10"
                :             "border-border/25 bg-muted/10"}`}>
                {isOnline  ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                : isLoading ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                :              <Icon className="h-3.5 w-3.5 text-muted-foreground/35" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold uppercase tracking-wide truncate
                    ${isOnline ? "text-success" : isLoading ? "text-primary" : "text-muted-foreground/35"}`}>
                    {agent.label}
                  </span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 border uppercase tracking-wider shrink-0 ${PROVIDER_COLORS[agent.provider]}`}>
                    {agent.provider}
                  </span>
                </div>
                <div className={`font-mono text-[10px] mt-0.5 truncate
                  ${isOnline ? "text-success/55" : isLoading ? "text-primary/55" : "text-muted-foreground/25"}`}>
                  {isOnline ? "✓ Online — operacional" : isLoading ? agent.desc : "Aguardando inicialização..."}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-5 space-y-2">
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground/45">
          <span>Diagnóstico em construção</span>
          <span>{activeCount}/{AGENTS.length} agentes · {Math.round(Math.max(progress, (activeCount / AGENTS.length) * 100))}%</span>
        </div>
        <div className="h-1 bg-muted/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary/60 transition-all duration-300"
            style={{ width: `${Math.max(progress, (activeCount / AGENTS.length) * 100)}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/35 text-center pt-0.5">
          O plano estratégico será apresentado para sua revisão e aprovação · Tempo estimado: 1–3 minutos
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 2 — STRATEGY READY: Cinematic Reveal Banner
// ══════════════════════════════════════════════════════════════════════════════
export function StrategyReadyBanner({ onReview }: { onReview: () => void }) {
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 80);
    const t2 = setInterval(() => setPulse(p => !p), 2200);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, []);

  return (
    <div className={`relative overflow-hidden border border-success/55 transition-all duration-700
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
      bg-gradient-to-r from-success/12 via-success/5 to-background`}>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-success to-transparent" />
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${pulse ? "opacity-100" : "opacity-0"}`}
           style={{ background: "radial-gradient(ellipse at 10% 50%, hsl(var(--success)/0.07) 0%, transparent 60%)" }} />

      <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full border-2 border-success/60 flex items-center justify-center bg-success/12">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-success/25 animate-ping" />
          </div>
          <div>
            <div className="font-mono text-base font-bold text-success uppercase tracking-widest leading-tight">
              Análise Estratégica Completa
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/65 mt-1.5">
              8 agentes especializados concluíram o diagnóstico. Sua estratégia aguarda revisão.
            </div>
            <div className="flex gap-5 mt-2.5">
              {[
                { label: "Agentes", value: "8" },
                { label: "Gatilhos", value: "12" },
                { label: "Plataformas", value: "5" },
                { label: "Insights", value: "24+" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="font-mono text-lg font-bold text-success leading-none">{s.value}</div>
                  <div className="font-mono text-[9px] text-muted-foreground/45 uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onReview}
          className="font-mono text-sm uppercase tracking-widest font-bold text-background transition-all duration-200 px-7 py-3.5 flex items-center gap-2.5 shrink-0 border-0"
          style={{
            background: "hsl(var(--success))",
            boxShadow: "0 0 24px hsl(var(--success) / 0.45), 0 0 4px hsl(var(--success) / 0.3)",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 32px hsl(var(--success) / 0.6), 0 0 8px hsl(var(--success) / 0.4)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 24px hsl(var(--success) / 0.45), 0 0 4px hsl(var(--success) / 0.3)")}
        >
          <Eye className="h-4 w-4" />
          Revelar Estratégia
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 3 — GENERATING: Live Content Generation
// ══════════════════════════════════════════════════════════════════════════════
const PLATFORMS_GEN = [
  { id: "instagram", label: "Instagram",  total: 20, color: "text-pink-400",    bar: "from-pink-500 to-pink-400"    },
  { id: "tiktok",    label: "TikTok",     total: 10, color: "text-cyan-400",    bar: "from-cyan-500 to-cyan-400"    },
  { id: "facebook",  label: "Facebook",   total: 14, color: "text-blue-400",    bar: "from-blue-500 to-blue-400"    },
  { id: "whatsapp",  label: "WhatsApp",   total: 8,  color: "text-green-400",   bar: "from-green-500 to-green-400"  },
  { id: "email",     label: "E-mail",     total: 12, color: "text-indigo-300",  bar: "from-indigo-400 to-indigo-300"},
];

const COPY_PHRASES = [
  "Escrevendo hook principal...",
  "Criando variações de copy...",
  "Gerando roteiro de vídeo...",
  "Compondo sequência de e-mail...",
  "Finalizando CTA...",
];

export function GeneratingDisplay() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [dot, setDot] = useState(0);

  useEffect(() => {
    // Stagger platform generation
    const ints = PLATFORMS_GEN.map(({ id, total }, pi) => {
      return setInterval(() => {
        setCounts(prev => {
          const cur = prev[id] ?? 0;
          if (cur >= total) return prev;
          const add = pi === 0 ? 2 : 1;
          return { ...prev, [id]: Math.min(cur + add, total) };
        });
      }, 500 + pi * 180 + Math.random() * 300);
    });

    const phraseInt = setInterval(() => setPhraseIdx(i => (i + 1) % COPY_PHRASES.length), 2400);
    const dotInt    = setInterval(() => setDot(d => (d + 1) % 4), 450);

    return () => { ints.forEach(clearInterval); clearInterval(phraseInt); clearInterval(dotInt); };
  }, []);

  const total = PLATFORMS_GEN.reduce((a, p) => a + p.total, 0);
  const done  = Object.values(counts).reduce((a, v) => a + v, 0);
  const pct   = Math.round((done / total) * 100);

  return (
    <div className="relative overflow-hidden border border-primary/35 bg-gradient-to-b from-primary/6 via-primary/2 to-background">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <PenTool className="h-5 w-5 text-primary" />
            <Sparkles className="absolute -top-1.5 -right-1.5 h-3 w-3 text-yellow-400 animate-pulse" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-primary uppercase tracking-widest">
              COPYWRITER equipe especializada — CRIANDO{"."[dot > 0 ? 0 : -1]}{"."[dot > 1 ? 0 : -1]}{"."[dot > 2 ? 0 : -1]}
              {"...".slice(0, dot)}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5 transition-all duration-500">
              {COPY_PHRASES[phraseIdx]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-primary/70 border border-primary/30 bg-primary/5 px-3 py-1.5 shrink-0">
          <Loader2 className="h-3 w-3 animate-spin" />
          {pct}% GERADO
        </div>
      </div>

      {/* Per-platform bars */}
      <div className="p-4 space-y-3">
        {PLATFORMS_GEN.map(({ id, label, total: t, color, bar }) => {
          const cur  = counts[id] ?? 0;
          const p    = Math.round((cur / t) * 100);
          const done = cur === t;
          return (
            <div key={id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${color}`}>{label}</span>
                  {!done && cur > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground/40 animate-pulse">escrevendo...</span>
                  )}
                  {done && <span className="font-mono text-[10px] text-success">✓ pronto</span>}
                </div>
                <span className={`font-mono text-[11px] font-bold ${done ? "text-success" : "text-muted-foreground/55"}`}>
                  {cur}/{t}
                </span>
              </div>
              <div className="h-1.5 bg-muted/20 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${bar} transition-all duration-400 ${done ? "opacity-90" : "opacity-65"}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress */}
      <div className="px-4 pb-5 space-y-1.5">
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
          <span>Progresso total</span>
          <span>{done} de {total} peças</span>
        </div>
        <div className="h-2 bg-muted/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary/70 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/30 text-center pt-0.5">
          Página atualiza automaticamente quando a geração estiver completa
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 4 — AWAITING APPROVAL: Content Ready Cinema Prompt
// ══════════════════════════════════════════════════════════════════════════════
export function ContentReadyCinemaPrompt({
  campaignId,
  totalPieces,
}: {
  campaignId: string;
  totalPieces: number;
}) {
  const [glow, setGlow] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlow(g => !g), 1800);
    return () => clearInterval(t);
  }, []);

  const PLATFORMS = [
    { label: "Instagram", color: "text-pink-400"   },
    { label: "TikTok",    color: "text-cyan-400"   },
    { label: "Facebook",  color: "text-blue-400"   },
    { label: "WhatsApp",  color: "text-green-400"  },
    { label: "E-mail",    color: "text-indigo-300" },
  ];

  return (
    <div className={`relative overflow-hidden border transition-all duration-1000
      ${glow ? "border-yellow-400/60" : "border-yellow-400/35"}
      bg-gradient-to-r from-yellow-400/10 via-yellow-400/4 to-background`}>
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent transition-opacity duration-1000 ${glow ? "opacity-100" : "opacity-40"}`} />

      <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 border-2 border-yellow-400/55 flex items-center justify-center bg-yellow-400/10">
              <Eye className="h-7 w-7 text-yellow-400" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center animate-bounce">
              <span className="font-mono text-[10px] font-black text-background">!</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-base font-bold text-yellow-400 uppercase tracking-widest leading-tight">
              {totalPieces > 0 ? `${totalPieces} Peças` : "Conteúdo"} Aguardam Sua Aprovação
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/65 mt-1.5">
              A equipe especializada gerou copy, criativos e roteiros para todos os canais. Você comanda a aprovação.
            </div>
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              {PLATFORMS.map(p => (
                <div key={p.label} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${p.color}`} />
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${p.color}`}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Link href={`/campaigns/${campaignId}/content`}>
          <button
            className="font-mono text-sm uppercase tracking-widest font-bold text-background transition-all duration-200 px-7 py-3.5 flex items-center gap-2.5 shrink-0 border-0"
            style={{
              background: "hsl(60 100% 55% / 0.9)",
              boxShadow: "0 0 24px hsl(60 100% 55% / 0.35), 0 0 4px hsl(60 100% 55% / 0.25)",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 32px hsl(60 100% 55% / 0.55), 0 0 8px hsl(60 100% 55% / 0.35)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 24px hsl(60 100% 55% / 0.35), 0 0 4px hsl(60 100% 55% / 0.25)")}
          >
            <Play className="h-4 w-4 fill-current" />
            Iniciar Revisão
            <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 5 — EXECUTING: Live Execution Ticker
// ══════════════════════════════════════════════════════════════════════════════
const MOCK_DISPATCHES = [
  { ch: "WhatsApp",   msg: "Disparando sequência de abertura — Segmento VIP (aguardando integração)" },
  { ch: "Meta ADS",   msg: "Conjunto de anúncios ativado — Tráfego Frio cold audience" },
  { ch: "E-mail",     msg: "Sequência dia 1 enfileirada — aguardando janela de envio" },
  { ch: "Instagram",  msg: "Reel principal agendado — publicação automática ativa" },
  { ch: "TikTok",     msg: "Campanha Awareness inicializando — criativos sendo revisados" },
  { ch: "RD Station", msg: "Fluxo de automação ativo — nutrição configurada" },
];

const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: "text-green-400",
  "Meta ADS": "text-blue-400",
  "E-mail": "text-indigo-300",
  Instagram: "text-pink-400",
  TikTok: "text-cyan-400",
  "RD Station": "text-orange-300",
};

export function ExecutingLiveDisplay({
  events,
}: {
  events: CampaignEvent[];
}) {
  const feedRef  = useRef<HTMLDivElement>(null);
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    if (events.length > 0) return;
    const t = setInterval(() => setTicker(i => (i + 1) % MOCK_DISPATCHES.length), 1800);
    return () => clearInterval(t);
  }, [events.length]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events, ticker]);

  return (
    <div className="relative overflow-hidden border border-success/40 bg-gradient-to-b from-success/8 via-success/2 to-background">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-success to-transparent" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-success/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full border-2 border-success/55 flex items-center justify-center bg-success/12">
              <Rocket className="h-5 w-5 text-success" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-success/20 animate-ping" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-success uppercase tracking-widest">
              CAMPANHA EM EXECUÇÃO
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
              Operando nos canais aprovados · Sob sua supervisão estratégica
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-success/70 border border-success/35 bg-success/5 px-3 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          AO VIVO
        </div>
      </div>

      {/* Channel indicators */}
      <div className="px-5 py-2.5 border-b border-success/10 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {["WhatsApp", "E-mail", "Meta ADS", "TikTok", "Instagram", "RD Station"].map(ch => (
          <div key={ch} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse ${CHANNEL_COLORS[ch] ?? "text-muted-foreground"}`} />
            <span className={`font-mono text-[9px] uppercase tracking-wider truncate ${CHANNEL_COLORS[ch] ?? "text-muted-foreground/50"}`}>{ch}</span>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div ref={feedRef} className="h-44 overflow-y-auto p-4 space-y-2">
        {events.length === 0 ? (
          MOCK_DISPATCHES.map((d, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 font-mono text-[11px] transition-all duration-500
                ${i === ticker ? "opacity-100" : i < ticker ? "opacity-55" : "opacity-20"}`}
            >
              <span className={`shrink-0 font-bold ${CHANNEL_COLORS[d.ch] ?? "text-muted-foreground"}`}>·</span>
              <span className={`shrink-0 font-bold uppercase text-[10px] tracking-wider ${CHANNEL_COLORS[d.ch] ?? "text-muted-foreground/50"}`}>[{d.ch}]</span>
              <span className="text-muted-foreground/60 leading-relaxed">{d.msg}</span>
            </div>
          ))
        ) : (
          events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 font-mono text-[11px] text-success/75">
              <span className="shrink-0 text-success font-bold">✓</span>
              <span className="text-muted-foreground/35 shrink-0 text-[10px]">
                {new Date(ev.timestamp).toLocaleTimeString("pt-BR")}
              </span>
              {ev.agentType && (
                <span className="shrink-0 text-primary/70 font-bold text-[10px] uppercase tracking-wider">[{ev.agentType}]</span>
              )}
              <span className="leading-relaxed text-foreground/75">{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 6 — LIVE: Mission Control Strip
// ══════════════════════════════════════════════════════════════════════════════
export function LiveMissionControl({ campaignId }: { campaignId: string }) {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden border border-success/50 bg-gradient-to-r from-success/12 via-success/4 to-background">
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-success to-transparent transition-opacity duration-1000 ${pulse ? "opacity-100" : "opacity-35"}`} />

      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full border-2 border-success/55 flex items-center justify-center bg-success/12">
              <Rocket className="h-6 w-6 text-success" />
            </div>
            <div className={`absolute inset-0 rounded-full border-2 border-success/25 transition-opacity duration-1000 ${pulse ? "opacity-100 animate-ping" : "opacity-0"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 10px hsl(var(--success))" }} />
              <span className="font-mono text-base font-bold text-success uppercase tracking-widest">CAMPANHA AO VIVO</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/60">
              Todos os canais operacionais · Acompanhe resultados em tempo real pelo painel
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/campaigns/${campaignId}/metrics`}>
            <button className="font-mono text-[11px] uppercase tracking-widest text-success border border-success/45 hover:bg-success/12 px-4 py-2.5 flex items-center gap-2 transition-colors">
              <BarChart3 className="h-3.5 w-3.5" />
              Métricas ao Vivo
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT CINEMA OVERLAY — Full-screen per-piece approval
// ══════════════════════════════════════════════════════════════════════════════
export interface CinemaPiece {
  id: string;
  platform: string;
  type: string;
  title?: string;
  body?: string;
  hook?: string;
  headline?: string;
  cta?: string;
  dayIndex?: number;
  status?: string;
}

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; bdr: string }> = {
  instagram: { label: "Instagram",  color: "text-pink-400",    bg: "bg-pink-400/8",    bdr: "border-pink-400/35"   },
  tiktok:    { label: "TikTok",     color: "text-cyan-400",    bg: "bg-cyan-400/8",    bdr: "border-cyan-400/35"   },
  facebook:  { label: "Facebook",   color: "text-blue-400",    bg: "bg-blue-400/8",    bdr: "border-blue-400/35"   },
  whatsapp:  { label: "WhatsApp",   color: "text-green-400",   bg: "bg-green-400/8",   bdr: "border-green-400/35"  },
  email:     { label: "E-mail",     color: "text-indigo-300",  bg: "bg-indigo-300/8",  bdr: "border-indigo-300/35" },
};

export function ContentCinemaOverlay({
  pieces,
  onClose,
  onApprove,
  onReject,
}: {
  pieces: CinemaPiece[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const [animDir, setAnimDir] = useState<"none" | "left" | "right">("none");

  const pending = pieces.filter(p => !decisions[p.id]);
  const current = pending[0] ?? null;
  const approved = Object.values(decisions).filter(d => d === "approved").length;
  const total    = pieces.length;
  const done     = total - pending.length;

  const navigate = useCallback((dir: "prev" | "next") => {
    if (dir === "next" && idx < pieces.length - 1) {
      setAnimDir("right");
      setTimeout(() => { setIdx(i => i + 1); setAnimDir("none"); }, 200);
    } else if (dir === "prev" && idx > 0) {
      setAnimDir("left");
      setTimeout(() => { setIdx(i => i - 1); setAnimDir("none"); }, 200);
    }
  }, [idx, pieces.length]);

  const decide = useCallback((id: string, decision: "approved" | "rejected") => {
    setDecisions(prev => ({ ...prev, [id]: decision }));
    if (decision === "approved") onApprove(id);
    else onReject(id);
    // Auto-advance to next pending
    setAnimDir("right");
    setTimeout(() => setAnimDir("none"), 200);
  }, [onApprove, onReject]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === "ArrowRight" || e.key === "Enter") decide(current.id, "approved");
      if (e.key === "ArrowLeft"  || e.key === "Backspace") decide(current.id, "rejected");
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, decide, onClose]);

  const piece = current;
  const meta  = piece ? (PLATFORM_META[piece.platform] ?? PLATFORM_META.instagram) : null;
  const allDone = pending.length === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-background/97 backdrop-blur-md flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border/50 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
            Cinema de Aprovação
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {done}/{total} revisados · {approved} aprovados
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-1 bg-muted/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-success transition-all duration-300"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/50">{Math.round((done / total) * 100)}%</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="px-5 py-2 border-b border-border/20 flex items-center gap-4 shrink-0">
        <span className="font-mono text-[10px] text-muted-foreground/35 uppercase tracking-widest">Atalhos:</span>
        {[
          { key: "→ Enter", label: "Aprovar" },
          { key: "← Backspace", label: "Rejeitar" },
          { key: "Esc", label: "Fechar" },
        ].map(h => (
          <div key={h.key} className="flex items-center gap-1.5">
            <kbd className="font-mono text-[9px] border border-border/40 bg-muted/20 px-1.5 py-0.5 rounded-sm text-muted-foreground/50">{h.key}</kbd>
            <span className="font-mono text-[10px] text-muted-foreground/35">{h.label}</span>
          </div>
        ))}
      </div>

      {/* Main content area */}
      {allDone ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-success/50 flex items-center justify-center bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-success/20 animate-ping" />
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-success uppercase tracking-widest mb-2">
              Revisão Concluída
            </div>
            <div className="font-mono text-sm text-muted-foreground/60">
              {approved} aprovados · {total - approved} rejeitados de {total} peças
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-sm uppercase tracking-widest text-background bg-success hover:bg-success/90 px-8 py-3 flex items-center gap-2 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Voltar à Campanha
          </button>
        </div>
      ) : piece && meta ? (
        <div className={`flex-1 flex flex-col items-center justify-center p-4 md:p-8 transition-all duration-200
          ${animDir === "right" ? "opacity-0 translate-x-4" : animDir === "left" ? "opacity-0 -translate-x-4" : "opacity-100 translate-x-0"}`}>

          {/* Platform badge */}
          <div className={`mb-5 flex items-center gap-2 border px-4 py-2 ${meta.bdr} ${meta.bg}`}>
            <div className={`w-2 h-2 rounded-full bg-current ${meta.color}`} />
            <span className={`font-mono text-xs font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground/40">·</span>
            <span className="font-mono text-[10px] text-muted-foreground/50 uppercase">{piece.type?.replace(/_/g, " ")}</span>
            {piece.dayIndex !== undefined && (
              <>
                <span className="font-mono text-[10px] text-muted-foreground/40">·</span>
                <span className="font-mono text-[10px] text-muted-foreground/50">Dia {piece.dayIndex}</span>
              </>
            )}
          </div>

          {/* Content card */}
          <div className={`w-full max-w-xl border ${meta.bdr} bg-card/60 shadow-2xl overflow-hidden`}>
            {/* Title bar */}
            {piece.title && (
              <div className={`border-b ${meta.bdr} px-4 py-2.5 ${meta.bg}`}>
                <span className={`font-mono text-[10px] uppercase tracking-widest ${meta.color}`}>{piece.title}</span>
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Hook */}
              {piece.hook && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/45 mb-1.5 flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Hook
                  </div>
                  <p className={`font-mono text-sm font-bold leading-snug ${meta.color}`}>{piece.hook}</p>
                </div>
              )}

              {/* Headline */}
              {piece.headline && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/45 mb-1.5">Headline</div>
                  <p className="font-mono text-sm font-semibold text-foreground leading-snug">{piece.headline}</p>
                </div>
              )}

              {/* Body */}
              {piece.body && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/45 mb-1.5">Copy</div>
                  <p className="font-mono text-xs text-foreground/80 leading-relaxed whitespace-pre-line line-clamp-8">{piece.body}</p>
                </div>
              )}

              {/* CTA */}
              {piece.cta && (
                <div className={`border ${meta.bdr} ${meta.bg} px-3 py-2`}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/45 mb-1">CTA</div>
                  <p className={`font-mono text-sm font-bold ${meta.color}`}>{piece.cta}</p>
                </div>
              )}

              {!piece.hook && !piece.headline && !piece.body && !piece.cta && (
                <div className="py-6 text-center font-mono text-xs text-muted-foreground/40">
                  Sem prévia disponível para esta peça
                </div>
              )}
            </div>
          </div>

          {/* Decision buttons */}
          <div className="flex gap-4 mt-6 w-full max-w-xl">
            <button
              onClick={() => decide(piece.id, "rejected")}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-mono text-sm uppercase tracking-widest font-bold border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <ThumbsDown className="h-4 w-4" />
              Rejeitar
            </button>
            <button
              onClick={() => decide(piece.id, "approved")}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-mono text-sm uppercase tracking-widest font-bold border border-success/40 text-success hover:bg-success/10 transition-colors"
              style={{ boxShadow: "0 0 16px hsl(var(--success)/0.15)" }}
            >
              <ThumbsUp className="h-4 w-4" />
              Aprovar
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => navigate("prev")}
              disabled={idx === 0}
              className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-mono text-[11px] text-muted-foreground/40">
              {done + 1} de {total}
            </span>
            <button
              onClick={() => navigate("next")}
              disabled={idx >= pieces.length - 1}
              className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
