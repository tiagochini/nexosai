import { useState, useEffect, useRef } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, Shield, Lock,
  Play, Pause, Volume2, VolumeX, Clock,
  X, AlertTriangle, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";

// ─── CONFIGURAÇÃO — atualizar antes da abertura ───────────────────────────────
const CONFIG = {
  precoFundador:       "R$3.990",
  precoFundadorSufixo: " acesso único",
  precoCheio:          "R$9.990",
  precoCheioSufixo:    " acesso único",
  horasFundador:       24,
  cartUrl:             "/comprar",
  // URL do vídeo de apresentação. Suporta: MP4 direto, YouTube embed, Vimeo embed, path interno (ex: /video-nexos/)
  videoUrl:            "/video-nexos/" as string | null,
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
  const t = useUiText();
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
          <div className="font-mono text-sm font-bold text-foreground uppercase tracking-widest mb-1">{t("Vídeo de apresentação", "Product presentation video", "Video de presentación")}</div>
          <div className="font-mono text-xs text-muted-foreground/60">{t("Disponível na abertura do carrinho", "Available when the cart opens", "Disponible al abrir el carrito")}</div>
        </div>
        {/* Overlay pulsante — visual de "algo importante aqui" */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 bg-primary/5 px-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("agente narrada · 8 minutos", "AI narrated · 8 minutes", "narrado por IA · 8 minutos")}
          </div>
        </div>
      </div>
    );
  }

  // Embed: YouTube, Vimeo ou path interno (começa com /)
  if (url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo") || url.startsWith("/")) {
    return (
      <div className="relative w-full aspect-video border border-primary/20 overflow-hidden bg-black">
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{ border: "none" }}
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{t("Role para baixo · Garanta agora", "Scroll down · Secure your access", "Desliza hacia abajo · Asegura tu acceso")}</span>
        </div>
      )}
    </div>
  );
}

// ─── Script do vídeo — roteiro do narrador agente ─────────────────────────────────
// (exibido como legenda/transcript abaixo do vídeo para quem não pode assistir)
const SCRIPT_SECTIONS = [
  {
    tempo: "0:00 – 1:30",
    titulo: "O problema que você já conhece",
    enTitle: "The problem you already know",
    esTitle: "El problema que ya conoces",
    texto: "Você sabe exatamente o que precisa fazer para lançar. Já fez cursos. Já assistiu conteúdo. O problema nunca foi conhecimento — foi execução. Copy que não sai. Leads esfriando na base. Lançamentos que ficam no planejamento.",
    en: "You know exactly what it takes to launch. You have taken courses and watched the content. The problem was never knowledge — it was execution. Copy that never gets written. Leads going cold. Launches stuck in planning.",
    es: "Sabes exactamente qué necesitas para lanzar. Ya hiciste cursos y viste contenido. El problema nunca fue el conocimiento, sino la ejecución. Textos que no se escriben. Prospectos que se enfrían. Lanzamientos que se quedan en la planificación.",
  },
  {
    tempo: "1:30 – 3:00",
    titulo: "O que o NexOS executa por você",
    enTitle: "What NexOS does for you",
    esTitle: "Lo que NexOS hace por ti",
    texto: "57 especialistas trabalhando 24 horas por dia no seu lançamento. Estratégia completa em 47 minutos. 23 emails e 18 mensagens WhatsApp gerados, agendados e disparados. Carrinho abre e fecha no horário. Sem você tocar em nada.",
    en: "57 specialists working on your launch around the clock. A complete strategy in 47 minutes. 23 emails and 18 WhatsApp messages generated, scheduled, and sent. Your cart opens and closes on time. Without you lifting a finger.",
    es: "57 especialistas trabajando en tu lanzamiento las 24 horas. Una estrategia completa en 47 minutos. 23 correos y 18 mensajes de WhatsApp generados, programados y enviados. El carrito abre y cierra a tiempo. Sin que tengas que hacer nada.",
  },
  {
    tempo: "3:00 – 5:00",
    titulo: "Como funciona na prática",
    enTitle: "How it works in practice",
    esTitle: "Cómo funciona en la práctica",
    texto: "Você responde 7 perguntas sobre seu produto e público. O agente monta tudo — do cronograma ao último email de escassez. Você aprova. Ela executa. Em 72 horas seu próximo lançamento está rodando.",
    en: "Answer 7 questions about your product and audience. The agent builds everything — from the timeline to the final scarcity email. You approve; it executes. Your next launch is running in 72 hours.",
    es: "Respondes 7 preguntas sobre tu producto y audiencia. El agente prepara todo, desde el cronograma hasta el último correo de escasez. Tú apruebas y el agente ejecuta. En 72 horas, tu próximo lanzamiento estará en marcha.",
  },
  {
    tempo: "5:00 – 6:30",
    titulo: "A decisão que está na sua frente",
    enTitle: "The decision in front of you",
    esTitle: "La decisión que tienes delante",
    texto: "Este carrinho abre uma única vez neste preço. Quem estava na lista chega primeiro — e paga o preço de Fundador por 24 horas. Depois disso, esse valor não existe mais. Nunca mais.",
    en: "This cart opens at this price only once. People on the list get first access and pay the Founder price for 24 hours. After that, this price is gone for good.",
    es: "Este carrito abre una sola vez a este precio. Quienes estaban en la lista llegan primero y pagan el precio de Fundador durante 24 horas. Después, ese precio desaparece para siempre.",
  },
  {
    tempo: "6:30 – 8:00",
    titulo: "Por que agora e não depois",
    enTitle: "Why now, not later",
    esTitle: "Por qué ahora y no después",
    texto: "Cada mês sem automação é um mês que o concorrente avançou. A diferença entre quem automatizou e quem não automatizou vai se tornando irreversível. Esta janela é a sua oportunidade de entrar do lado certo dessa linha.",
    en: "Every month without automation is another month your competitors move ahead. The gap between those who automate and those who do not keeps becoming harder to reverse. This window is your chance to get on the right side.",
    es: "Cada mes sin automatización es un mes que avanza tu competencia. La diferencia entre quienes automatizan y quienes no lo hacen se vuelve cada vez más difícil de revertir. Esta ventana es tu oportunidad de estar del lado correcto.",
  },
];

// ─── Seção de prova — o que o produto faz ────────────────────────────────────
function ProvaSection() {
  const t = useUiText();
  const provas = [
    ["Estratégia completa gerada em 47 minutos — cronograma, fases, segmentação e alertas de risco", "Complete strategy generated in 47 minutes — timeline, phases, segmentation, and risk alerts", "Estrategia completa generada en 47 minutos: cronograma, fases, segmentación y alertas de riesgo"],
    ["23 emails escritos em tom de voz personalizado + 18 mensagens WhatsApp por campanha", "23 emails written in your brand voice + 18 WhatsApp messages per campaign", "23 correos con tu tono de voz + 18 mensajes de WhatsApp por campaña"],
    ["Segmentação comportamental em tempo real: hot, warm, cold — cada grupo recebe copy diferente", "Real-time behavioral segmentation: hot, warm, cold — each group gets tailored copy", "Segmentación conductual en tiempo real: hot, warm, cold; cada grupo recibe textos distintos"],
    ["Carrinho abre e fecha automaticamente no horário — sem você precisar lembrar ou fazer nada", "Cart opens and closes on schedule automatically — no reminders or manual work", "El carrito abre y cierra automáticamente a la hora prevista, sin que tengas que recordarlo ni hacer nada"],
    ["Dashboard ao vivo com health score e alertas quando uma métrica indica risco de conversão", "Live dashboard with a health score and alerts when a metric indicates conversion risk", "Panel en vivo con puntuación de salud y alertas cuando una métrica indica riesgo de conversión"],
    ["Agente responde objeções no WhatsApp enquanto você faz outra coisa", "Agent handles objections on WhatsApp while you focus on something else", "El agente responde objeciones por WhatsApp mientras haces otras cosas"],
  ];

  return (
    <div className="border border-primary/20 bg-primary/5 p-7">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">{t("O que o NexOS executa por você", "What NexOS executes for you", "Lo que NexOS ejecuta por ti")}</div>
      <ul className="space-y-2.5">
        {provas.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span className="font-mono text-xs text-foreground/80 leading-relaxed">{t(item[0], item[1], item[2])}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-primary/20 mt-6 pt-5 space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Custo equivalente contratando separado", "Equivalent cost when hired separately", "Costo equivalente contratando por separado")}</div>
        <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
      </div>
    </div>
  );
}

// ─── CTA principal ────────────────────────────────────────────────────────────
function CtaSection({ expired }: { expired: boolean }) {
  const t = useUiText();
  const { precoCheio, precoCheioSufixo, precoFundador, precoFundadorSufixo, cartUrl } = CONFIG;

  return (
    <div className="flex flex-col gap-4">

      {/* Preço cheio */}
      <div className={`border p-5 ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"}`}>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
          {expired ? t("Preço atual", "Current price", "Precio actual") : t("Preço após as 24h de Fundador", "Price after the 24-hour Founder offer", "Precio después de las 24 h de Fundador")}
        </div>
        <div className={`font-mono font-black text-3xl ${expired ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
          {precoCheio}<span className="text-lg font-normal ml-1">{t(precoCheioSufixo, " one-time access", " acceso único")}</span>
        </div>
      </div>

      {/* Preço Fundador */}
      {!expired && (
        <div className="border-2 border-primary bg-primary/5 p-5 relative">
          <div className="absolute top-0 right-0 bg-primary px-2 py-0.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary-foreground font-bold">{t("ÚNICO · FUNDADOR", "ONE-TIME · FOUNDER", "ÚNICO · FUNDADOR")}</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1.5 mt-1">{t("Preço de Fundador", "Founder Price", "Precio de Fundador")}</div>
          <div className="font-mono font-black text-4xl md:text-5xl text-primary drop-shadow-[0_0_16px_hsl(var(--primary)/0.5)]">
            {precoFundador}<span className="text-xl font-normal ml-1.5 text-muted-foreground">{t(precoFundadorSufixo, " one-time access", " acceso único")}</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-2">
            {t("Este valor não volta. Sem cupom, sem reabertura, sem exceção.", "This price will not return. No coupon, reopening, or exceptions.", "Este precio no volverá. Sin cupones, reaperturas ni excepciones.")}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <a href={cartUrl}>
        <Button className={`w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3 ${expired ? "opacity-70" : ""}`}>
          {expired
            ? <><Lock className="h-4 w-4" /> {t("ACESSAR NO PREÇO CHEIO", "GET FULL-PRICE ACCESS", "ACCEDER AL PRECIO COMPLETO")}</>
            : <><ArrowRight className="h-4 w-4" /> {t("GARANTIR MEU ACESSO AGORA", "SECURE MY ACCESS NOW", "ASEGURAR MI ACCESO AHORA")}</>
          }
        </Button>
      </a>

      <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
        <Shield className="h-3 w-3" /> {t("Sem fidelidade · Cancela quando quiser · Acesso em até 24h", "No contract · Cancel anytime · Access within 24 hours", "Sin permanencia · Cancela cuando quieras · Acceso en hasta 24 h")}
      </div>

      {expired && (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            {t("A oferta de Fundador encerrou. O acesso continua disponível no preço cheio. Não há nova janela com condições especiais prevista.", "The Founder offer has ended. Access is still available at the full price. No new special offer window is planned.", "La oferta de Fundador terminó. El acceso sigue disponible al precio completo. No está prevista otra oferta especial.")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sticky countdown + CTA ───────────────────────────────────────────────────
function StickyBar({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const t = useUiText();
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
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">{t("Fundador encerra em", "Founder offer ends in", "La oferta de fundador termina en")}</span>
              </div>
              <div className="font-mono font-black text-xl text-primary tabular-nums">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </div>
              <div className="hidden md:block border-l border-border/40 pl-4">
                <span className="font-mono text-sm font-black text-primary">{precoFundador}</span>
                <span className="font-mono text-xs text-muted-foreground ml-0.5">{t(precoFundadorSufixo, " one-time access", " acceso único")}</span>
              </div>
            </div>
            <a href={cartUrl}>
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-5 gap-2 shrink-0">
                {t("GARANTIR ACESSO", "SECURE ACCESS", "ASEGURAR ACCESO")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-3.5 w-3.5 text-destructive/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Oferta de Fundador encerrada", "Founder offer ended", "Oferta de fundador finalizada")}</span>
            </div>
            <a href={cartUrl}>
              <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-9 px-5">
                {t("VER ACESSO", "VIEW ACCESS", "VER ACCESO")}
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
  const t = useUiText();
  const { h, m, s, expired } = useCountdown(CONFIG.horasFundador);
  const fmt = (v: number) => String(v).padStart(2, "0");
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS" className="h-10 w-10 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-base tracking-[0.15em] uppercase leading-none">NexOS</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/60 leading-none">{t("Apresentação do produto", "Product presentation", "Presentación del producto")}</div>
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
              {t("Garantir acesso", "Secure access", "Asegurar acceso")}
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
              ? t("A janela de Fundador encerrou — preço cheio ativo", "The Founder offer has ended — full price now applies", "La oferta de Fundador terminó — ahora rige el precio completo")
              : t("Carrinho aberto · Preço de Fundador · 24h e fecha para sempre", "Cart open · Founder price · Closes forever in 24 hours", "Carrito abierto · Precio de Fundador · Cierra para siempre en 24 h")
            }
          </div>

          <h1 className="text-4xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
            {t("Assista antes", "Watch before", "Mira antes")}<br />{t("de decidir.", "you decide.", "de decidir.")}<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              {t("Depois a decisão vai ser óbvia.", "Then the decision will be obvious.", "Después, la decisión será obvia.")}
            </span>
          </h1>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-xl mb-10">
            {t("8 minutos. É o tempo que leva para você entender exatamente o que o NexOS executa por você — e por que quem vê isso acha o preço barato de qualquer jeito.", "Eight minutes is all it takes to understand exactly what NexOS does for you — and why people who see it consider the price a bargain.", "Ocho minutos bastan para entender exactamente lo que NexOS hace por ti y por qué quienes lo ven consideran que el precio es una ganga.")}
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
                 {showTranscript ? t("Ocultar roteiro", "Hide script", "Ocultar guion") : t("Ver roteiro completo", "View full script", "Ver guion completo")}
              </button>

              {showTranscript && (
                <div className="border border-border/30 bg-card/20 p-5 space-y-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">{t("Roteiro — narração do agente", "Script — AI narration", "Guion — narración del agente")}</div>
                  {SCRIPT_SECTIONS.map((sec, i) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-primary/50">{sec.tempo}</span>
                         <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{t(sec.titulo, sec.enTitle, sec.esTitle)}</span>
                      </div>
                       <p className="font-mono text-xs text-muted-foreground leading-relaxed">{t(sec.texto, sec.en, sec.es)}</p>
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
                <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">{t("A decisão que já estava tomada", "The decision that was already made", "La decisión que ya estaba tomada")}</div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">
                  {t("Você não chegou até aqui por acaso. Estava na lista. Assistiu ao vídeo. Chegou antes de todo mundo. Isso significa que já tomou a maior parte da decisão — falta só a última parte.", "You did not get here by accident. You were on the list, watched the video, and arrived ahead of everyone else. You have already made most of the decision — only the final step remains.", "No llegaste hasta aquí por casualidad. Estabas en la lista, viste el video y llegaste antes que los demás. Ya tomaste la mayor parte de la decisión: solo falta el último paso.")}
                </p>
                <p className="font-mono text-sm text-foreground leading-relaxed font-bold">
                  {t("A questão não é se você vai precisar disso. É se vai pagar o preço de Fundador ou o preço cheio.", "The question is not whether you need this. It is whether you will pay the Founder price or the full price.", "La cuestión no es si lo necesitas, sino si pagarás el precio de Fundador o el precio completo.")}
                </p>
              </div>

              <div className="border border-border/30 bg-card/20 p-6">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{t("Benefícios exclusivos de Fundador", "Exclusive Founder Benefits", "Beneficios exclusivos de Fundador")}</div>
                <ul className="space-y-2">
                  {[
                    ["Status de Fundador permanente — preço nunca sobe para você", "Permanent Founder status — your price never increases", "Estatus de Fundador permanente: tu precio nunca sube"],
                    ["Grupo privado com acesso direto ao time de produto", "Private group with direct access to the product team", "Grupo privado con acceso directo al equipo de producto"],
                    ["Beta antecipado de todos os novos agentes", "Early beta access to all new agents", "Acceso beta anticipado a todos los agentes nuevos"],
                    ["Onboarding individual ao vivo com o time", "Live one-to-one onboarding with the team", "Sesión individual de incorporación en vivo con el equipo"],
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="font-mono text-xs text-foreground/70 leading-relaxed">{t(item[0], item[1], item[2])}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border/30 mt-4 pt-4">
                  <p className="font-mono text-[11px] text-muted-foreground/50">
                    {t("Esses benefícios são exclusivos desta janela de 24h. A próxima turma entra no preço cheio, sem o grupo privado e sem o onboarding individual.", "These benefits are exclusive to this 24-hour window. The next cohort pays full price, without the private group or one-to-one onboarding.", "Estos beneficios son exclusivos de esta ventana de 24 h. La próxima generación pagará el precio completo, sin grupo privado ni incorporación individual.")}
                  </p>
                </div>
              </div>

              <a href={CONFIG.cartUrl}>
                <Button className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-3">
                  {expired
                    ? <><Lock className="h-4 w-4" /> {t("ACESSAR NO PREÇO CHEIO", "GET FULL-PRICE ACCESS", "ACCEDER AL PRECIO COMPLETO")}</>
                    : <><ArrowRight className="h-4 w-4" /> {t("GARANTIR MEU ACESSO AGORA", "SECURE MY ACCESS NOW", "ASEGURAR MI ACCESO AHORA")}</>
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
          {t("NexOS · Plataforma de Lançamento com o agente", "NexOS · AI Launch Platform", "NexOS · Plataforma de lanzamientos con IA")} · contato@agencianexos.vip
        </p>
      </div>

      <StickyBar h={h} m={m} s={s} expired={expired} />
    </div>
  );
}
