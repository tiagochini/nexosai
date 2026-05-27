import { useState, useEffect, useRef } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, Shield, Lock,
  Play, Pause, Volume2, VolumeX, Clock,
  X, AlertTriangle, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── CONFIGURAÇÃO — atualizar antes da abertura ───────────────────────────────
const CONFIG = {
  precoFundador:       "R$3.990",
  precoFundadorSufixo: " acesso único",
  precoCheio:          "R$9.990",
  precoCheioSufixo:    " acesso único",
  horasFundador:       24,
  cartUrl:             "/comprar",
  // URL do vídeo de IA — substituir pelo link real antes do lançamento
  // Suporta: MP4 direto, YouTube embed, Vimeo embed
  videoUrl:            null as string | null,
};

// ─── Countdown (mesmo sistema da /abertura) ───────────────────────────────────
function useCountdown(hours: number) {
  const key = "nexos_cart_open_ts";
  const getOrSetTs = () => {
    try {
      const s = localStorage.getItem(key);
      if (s) return Number(s);
      const ts = Date.now() + hours * 3_600_000;
      localStorage.setItem(key, String(ts));
      return ts;
    } catch { return Date.now() + hours * 3_600_000; }
  };
  const [endsAt] = useState(getOrSetTs);
  const [rem, setRem] = useState(endsAt - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRem(Math.max(0, endsAt - Date.now())), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return {
    h: Math.floor(rem / 3_600_000),
    m: Math.floor((rem % 3_600_000) / 60_000),
    s: Math.floor((rem % 60_000) / 1_000),
    expired: rem <= 0,
  };
}

// ─── Player de vídeo ──────────────────────────────────────────────────────────
function VideoPlayer({ url }: { url: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCtaHint, setShowCtaHint] = useState(false);

  // Mostrar hint de CTA após 70% do vídeo
  useEffect(() => {
    if (progress >= 0.7 && !showCtaHint) setShowCtaHint(true);
  }, [progress, showCtaHint]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress(v.currentTime / v.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * v.duration;
  };

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Se não há URL configurada, mostra placeholder
  if (!url) {
    return (
      <div className="relative w-full aspect-video bg-card/40 border border-primary/20 flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
          <Play className="h-8 w-8 text-primary ml-1" />
        </div>
        <div className="text-center">
          <div className="font-mono text-sm font-bold text-foreground uppercase tracking-widest mb-1">Vídeo de apresentação</div>
          <div className="font-mono text-xs text-muted-foreground/60">Disponível na abertura do carrinho</div>
        </div>
        {/* Overlay pulsante — visual de "algo importante aqui" */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 bg-primary/5 px-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            IA narrada · 8 minutos
          </div>
        </div>
      </div>
    );
  }

  // Embed YouTube/Vimeo
  if (url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo")) {
    return (
      <div className="relative w-full aspect-video border border-primary/20">
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  // Player nativo para MP4
  return (
    <div className="relative w-full aspect-video bg-black border border-primary/20 group">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
        onEnded={() => setPlaying(false)}
        muted={muted}
        playsInline
      />

      {/* Play overlay quando pausado */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity group-hover:bg-black/50"
        >
          <div className="w-20 h-20 rounded-full border-2 border-primary/60 bg-primary/20 flex items-center justify-center backdrop-blur-sm">
            <Play className="h-8 w-8 text-primary ml-1" />
          </div>
        </button>
      )}

      {/* Controles */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Barra de progresso */}
        <div
          className="w-full h-1 bg-white/20 mb-3 cursor-pointer"
          onClick={handleSeek}
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white/80 hover:text-white">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }} className="text-white/60 hover:text-white">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="font-mono text-[10px] text-white/50">
              {fmt(duration * progress)} / {fmt(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Hint de CTA após 70% */}
      {showCtaHint && (
        <div className="absolute top-4 right-4 border border-primary/50 bg-background/90 backdrop-blur-sm px-3 py-2 flex items-center gap-2 animate-pulse">
          <ChevronRight className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Role para baixo · Garanta agora</span>
        </div>
      )}
    </div>
  );
}

// ─── Script do vídeo — roteiro do narrador IA ─────────────────────────────────
// (exibido como legenda/transcript abaixo do vídeo para quem não pode assistir)
const SCRIPT_SECTIONS = [
  {
    tempo: "0:00 – 1:30",
    titulo: "O problema que você já conhece",
    texto: "Você sabe exatamente o que precisa fazer para lançar. Já fez cursos. Já assistiu conteúdo. O problema nunca foi conhecimento — foi execução. Copy que não sai. Leads esfriando na base. Lançamentos que ficam no planejamento.",
  },
  {
    tempo: "1:30 – 3:00",
    titulo: "O que o NexOS AI executa por você",
    texto: "57 agentes de IA trabalhando 24 horas por dia no seu lançamento. Estratégia completa em 47 minutos. 23 emails e 18 mensagens WhatsApp gerados, agendados e disparados. Carrinho abre e fecha no horário. Sem você tocar em nada.",
  },
  {
    tempo: "3:00 – 5:00",
    titulo: "Como funciona na prática",
    texto: "Você responde 7 perguntas sobre seu produto e público. A IA monta tudo — do cronograma ao último email de escassez. Você aprova. Ela executa. Em 72 horas seu próximo lançamento está rodando.",
  },
  {
    tempo: "5:00 – 6:30",
    titulo: "A decisão que está na sua frente",
    texto: "Este carrinho abre uma única vez neste preço. Quem estava na lista chega primeiro — e paga o preço de Fundador por 24 horas. Depois disso, esse valor não existe mais. Nunca mais.",
  },
  {
    tempo: "6:30 – 8:00",
    titulo: "Por que agora e não depois",
    texto: "Cada mês sem automação é um mês que o concorrente avançou. A diferença entre quem automatizou e quem não automatizou vai se tornando irreversível. Esta janela é a sua oportunidade de entrar do lado certo dessa linha.",
  },
];

// ─── Seção de prova — o que o produto faz ────────────────────────────────────
function ProvaSection() {
  const provas = [
    "Estratégia completa gerada em 47 minutos — cronograma, fases, segmentação e alertas de risco",
    "23 emails escritos em tom de voz personalizado + 18 mensagens WhatsApp por campanha",
    "Segmentação comportamental em tempo real: hot, warm, cold — cada grupo recebe copy diferente",
    "Carrinho abre e fecha automaticamente no horário — sem você precisar lembrar ou fazer nada",
    "Dashboard ao vivo com health score e alertas quando uma métrica indica risco de conversão",
    "IA responde objeções no WhatsApp enquanto você faz outra coisa",
  ];

  return (
    <div className="border border-primary/20 bg-primary/5 p-7">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">O que o NexOS AI executa por você</div>
      <ul className="space-y-2.5">
        {provas.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span className="font-mono text-xs text-foreground/80 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-primary/20 mt-6 pt-5 space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Custo equivalente contratando separado</div>
        <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
      </div>
    </div>
  );
}

// ─── CTA principal ────────────────────────────────────────────────────────────
function CtaSection({ expired }: { expired: boolean }) {
  const { precoCheio, precoCheioSufixo, precoFundador, precoFundadorSufixo, cartUrl } = CONFIG;

  return (
    <div className="flex flex-col gap-4">

      {/* Preço cheio */}
      <div className={`border p-5 ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"}`}>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
          {expired ? "Preço atual" : "Preço após as 24h de Fundador"}
        </div>
        <div className={`font-mono font-black text-3xl ${expired ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
          {precoCheio}<span className="text-lg font-normal ml-1">{precoCheioSufixo}</span>
        </div>
      </div>

      {/* Preço Fundador */}
      {!expired && (
        <div className="border-2 border-primary bg-primary/5 p-5 relative">
          <div className="absolute top-0 right-0 bg-primary px-2 py-0.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary-foreground font-bold">ÚNICO · FUNDADOR</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1.5 mt-1">Preço de Fundador</div>
          <div className="font-mono font-black text-4xl md:text-5xl text-primary drop-shadow-[0_0_16px_hsl(var(--primary)/0.5)]">
            {precoFundador}<span className="text-xl font-normal ml-1.5 text-muted-foreground">{precoFundadorSufixo}</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-2">
            Este valor não volta. Sem cupom, sem reabertura, sem exceção.
          </div>
        </div>
      )}

      {/* CTA Button */}
      <a href={cartUrl}>
        <Button className={`w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3 ${expired ? "opacity-70" : ""}`}>
          {expired
            ? <><Lock className="h-4 w-4" /> ACESSAR NO PREÇO CHEIO</>
            : <><ArrowRight className="h-4 w-4" /> GARANTIR MEU ACESSO AGORA</>
          }
        </Button>
      </a>

      <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
        <Shield className="h-3 w-3" /> Sem fidelidade · Cancela quando quiser · Acesso em até 24h
      </div>

      {expired && (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            A oferta de Fundador encerrou. O acesso continua disponível no preço cheio. Não há nova janela com condições especiais prevista.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sticky countdown + CTA ───────────────────────────────────────────────────
function StickyBar({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const { precoFundador, precoFundadorSufixo, cartUrl } = CONFIG;
  const fmt = (v: number) => String(v).padStart(2, "0");

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/30 bg-background/96 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {!expired ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">Fundador encerra em</span>
              </div>
              <div className="font-mono font-black text-xl text-primary tabular-nums">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </div>
              <div className="hidden md:block border-l border-border/40 pl-4">
                <span className="font-mono text-sm font-black text-primary">{precoFundador}</span>
                <span className="font-mono text-xs text-muted-foreground ml-0.5">{precoFundadorSufixo}</span>
              </div>
            </div>
            <a href={cartUrl}>
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-5 gap-2 shrink-0">
                GARANTIR ACESSO <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-3.5 w-3.5 text-destructive/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Oferta de Fundador encerrada</span>
            </div>
            <a href={cartUrl}>
              <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-9 px-5">
                VER ACESSO
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function ConversaoPage() {
  const { h, m, s, expired } = useCountdown(CONFIG.horasFundador);
  const fmt = (v: number) => String(v).padStart(2, "0");
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-base tracking-[0.15em] uppercase leading-none">NexOS <span className="text-primary">AI</span></div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/60 leading-none">Apresentação do produto</div>
            </div>
          </div>
          {!expired && (
            <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-destructive font-bold tabular-nums">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </span>
            </div>
          )}
          <a href={CONFIG.cartUrl}>
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] tracking-widest font-bold h-8 px-4">
              Garantir acesso
            </Button>
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-24 pb-10 px-6 auth-bg-gradient">
        <div className="max-w-5xl mx-auto">

          <div className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-2 mb-6 font-mono text-xs uppercase tracking-[0.25em] text-destructive">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            {expired
              ? "A janela de Fundador encerrou — preço cheio ativo"
              : "Carrinho aberto · Preço de Fundador · 24h e fecha para sempre"
            }
          </div>

          <h1 className="text-4xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
            Assista antes<br />de decidir.<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              Depois a decisão vai ser óbvia.
            </span>
          </h1>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-xl mb-10">
            8 minutos. É o tempo que leva para você entender exatamente o que o NexOS AI executa por você — e por que quem vê isso acha o preço barato de qualquer jeito.
          </p>
        </div>
      </section>

      {/* ── Vídeo + Oferta ── */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

            {/* Coluna esquerda — vídeo + transcript */}
            <div className="space-y-4">
              <VideoPlayer url={CONFIG.videoUrl} />

              {/* Transcript toggle */}
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Clock className="h-3 w-3" />
                {showTranscript ? "Ocultar roteiro" : "Ver roteiro completo"}
              </button>

              {showTranscript && (
                <div className="border border-border/30 bg-card/20 p-5 space-y-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Roteiro — narração da IA</div>
                  {SCRIPT_SECTIONS.map((sec, i) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-primary/50">{sec.tempo}</span>
                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{sec.titulo}</span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground leading-relaxed">{sec.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coluna direita — oferta */}
            <div className="space-y-4 lg:sticky lg:top-20">
              <CtaSection expired={expired} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Prova completa ── */}
      <section className="border-t border-border/20 px-6 pb-32">
        <div className="max-w-5xl mx-auto py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProvaSection />

            {/* Comprometimento */}
            <div className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 p-7">
                <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">A decisão que já estava tomada</div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">
                  Você não chegou até aqui por acaso. Estava na lista. Assistiu ao vídeo. Chegou antes de todo mundo. Isso significa que já tomou a maior parte da decisão — falta só a última parte.
                </p>
                <p className="font-mono text-sm text-foreground leading-relaxed font-bold">
                  A questão não é se você vai precisar disso. É se vai pagar o preço de Fundador ou o preço cheio.
                </p>
              </div>

              <div className="border border-border/30 bg-card/20 p-6">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Benefícios exclusivos de Fundador</div>
                <ul className="space-y-2">
                  {[
                    "Status de Fundador permanente — preço nunca sobe para você",
                    "Grupo privado com acesso direto ao time de produto",
                    "Beta antecipado de todos os novos agentes",
                    "Onboarding individual ao vivo com o time",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="font-mono text-xs text-foreground/70 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border/30 mt-4 pt-4">
                  <p className="font-mono text-[11px] text-muted-foreground/50">
                    Esses benefícios são exclusivos desta janela de 24h. A próxima turma entra no preço cheio, sem o grupo privado e sem o onboarding individual.
                  </p>
                </div>
              </div>

              <a href={CONFIG.cartUrl}>
                <Button className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3">
                  {expired
                    ? <><Lock className="h-4 w-4" /> ACESSAR NO PREÇO CHEIO</>
                    : <><ArrowRight className="h-4 w-4" /> GARANTIR MEU ACESSO AGORA</>
                  }
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="border-t border-border/30 bg-muted/5 py-5 px-6 text-center mb-16">
        <p className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
          NexOS AI · Plataforma de Lançamento com IA · contato@nexos.ai
        </p>
      </div>

      <StickyBar h={h} m={m} s={s} expired={expired} />
    </div>
  );
}
