/**
 * CloneWowMoment — O momento "uau" do onboarding.
 *
 * Após o briefing + clone studio:
 *   1. O clone "apresenta" o plano de campanha em primeira pessoa (typewriter)
 *   2. Tour guiado interativo pelos módulos do NexOS
 *   3. CTA final para iniciar a campanha
 *
 * Não depende de HeyGen real — exibe avatar placeholder com animações
 * e uma narrativa gerada a partir dos dados do briefing.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, ChevronRight, CheckCircle2, Bot,
  Target, Mail, MessageSquare, TrendingUp, Shield,
  Video, BarChart2, Rocket, Users, Zap,
  Volume2, Play, ArrowRight, Star,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

// ── Tour stops ─────────────────────────────────────────────────────────────────

interface TourStop {
  id: string;
  module: string;
  icon: React.ElementType;
  color: string;
  headline: string;
  cloneNarration: string;
  path: string;
}

const TOUR_STOPS: TourStop[] = [
  {
    id: "dashboard",
    module: "Central de Comando",
    icon: BarChart2,
    color: "text-primary",
    headline: "Sua visão 360° do lançamento",
    cloneNarration: "Aqui você acompanha tudo em tempo real — receita, leads, taxa de abertura, saúde da campanha. É a sua sala de guerra. Os agentes trabalham aqui enquanto você toma decisões.",
    path: "/",
  },
  {
    id: "campaigns",
    module: "Campanhas",
    icon: Target,
    color: "text-primary",
    headline: "Onde seu lançamento vive",
    cloneNarration: "Cada campanha é uma missão. Briefing, estratégia, conteúdo, lançamento — tudo em sequência automática. Você aprova, os agentes executam. Simples assim.",
    path: "/campaigns",
  },
  {
    id: "sequences",
    module: "Sequências de Lançamento",
    icon: Mail,
    color: "text-cyan-400",
    headline: "Automação de email + WhatsApp",
    cloneNarration: "Eu programei cada mensagem para sair no momento certo, para a pessoa certa. E-mail, WhatsApp, com copy personalizada por segmento — quente, morno, frio. Tudo dispara sozinho.",
    path: "/launch-sequences",
  },
  {
    id: "agents",
    module: "Agentes NexOS",
    icon: Bot,
    color: "text-yellow-400",
    headline: "64 especialistas trabalhando por você",
    cloneNarration: "Tenho 64 agentes disponíveis — copywriter, estrategista, media buyer, compliance. Você consulta qualquer um em tempo real. Eles sabem tudo sobre o seu lançamento.",
    path: "/agents",
  },
  {
    id: "atendimento",
    module: "Time de Vendas",
    icon: MessageSquare,
    color: "text-rose-400",
    headline: "IA fecha vendas por você",
    cloneNarration: "Cada lead que entra vai para o funil certo. O agente de vendas sugere a mensagem ideal para cada estágio — aquecimento, desejo, fechamento, objeções. Você só aprova ou envia.",
    path: "/atendimento",
  },
  {
    id: "metrics",
    module: "Métricas & Performance",
    icon: TrendingUp,
    color: "text-success",
    headline: "Otimização em tempo real",
    cloneNarration: "Se o CTR cair, eu detecto e sugiro trocar o criativo. Se o CPL subir, ajusto a segmentação. Tudo auditado, tudo registrado. Você nunca fica no escuro.",
    path: "/metrics",
  },
];

const TOUR_UI_COPY: Record<string, {
  module: readonly [string, string, string];
  headline: readonly [string, string, string];
  narration: readonly [string, string, string];
  features: { label: readonly [string, string, string]; desc: readonly [string, string, string] }[];
}> = {
  dashboard: {
    module: ["Central de Comando", "Command Center", "Centro de comando"],
    headline: ["Sua visão 360° do lançamento", "Your 360° launch overview", "Tu visión 360° del lanzamiento"],
    narration: ["Aqui você acompanha tudo em tempo real — receita, leads, taxa de abertura, saúde da campanha. É a sua sala de guerra. Os agentes trabalham aqui enquanto você toma decisões.", "Track everything in real time here—revenue, leads, open rate, and campaign health. This is your command center. Agents work here while you make decisions.", "Aquí puedes seguirlo todo en tiempo real: ingresos, leads, tasa de apertura y estado de la campaña. Es tu centro de operaciones. Los agentes trabajan mientras tú decides."],
    features: [
      { label: ["Health Score", "Health Score", "Health Score"], desc: ["Calculado de 0 a 100 em tempo real", "Calculated live on a 0–100 scale", "Calculado en tiempo real de 0 a 100"] },
      { label: ["KPIs ao vivo", "Live KPIs", "KPIs en vivo"], desc: ["Receita, leads, ROAS, CPL", "Revenue, leads, ROAS, CPL", "Ingresos, leads, ROAS, CPL"] },
      { label: ["Alertas IA", "AI alerts", "Alertas de IA"], desc: ["Detecta anomalias automaticamente", "Detects anomalies automatically", "Detecta anomalías automáticamente"] },
    ],
  },
  campaigns: {
    module: ["Campanhas", "Campaigns", "Campañas"],
    headline: ["Onde seu lançamento vive", "Where your launch lives", "Donde vive tu lanzamiento"],
    narration: ["Cada campanha é uma missão. Briefing, estratégia, conteúdo, lançamento — tudo em sequência automática. Você aprova, os agentes executam. Simples assim.", "Every campaign is a mission. Briefing, strategy, content, launch—all in an automated sequence. You approve; the agents execute. That's it.", "Cada campaña es una misión. Briefing, estrategia, contenido y lanzamiento, todo en secuencia automática. Tú apruebas y los agentes ejecutan. Así de simple."],
    features: [
      { label: ["State Machine", "State machine", "State machine"], desc: ["Pipeline automático de fases", "Automated stage pipeline", "Flujo automático de etapas"] },
      { label: ["Multi-agente", "Multi-agent", "Multiagente"], desc: ["Claude + GPT-4o + Gemini", "Claude + GPT-4o + Gemini", "Claude + GPT-4o + Gemini"] },
      { label: ["Aprovação", "Approval", "Aprobación"], desc: ["Você aprova, IA executa", "You approve; AI executes", "Tú apruebas y la IA ejecuta"] },
    ],
  },
  sequences: {
    module: ["Sequências de Lançamento", "Launch Sequences", "Secuencias de lanzamiento"],
    headline: ["Automação de email + WhatsApp", "Email + WhatsApp automation", "Automatización de email + WhatsApp"],
    narration: ["Eu programei cada mensagem para sair no momento certo, para a pessoa certa. E-mail, WhatsApp, com copy personalizada por segmento — quente, morno, frio. Tudo dispara sozinho.", "Each message is scheduled for the right person at the right time. Email and WhatsApp copy is tailored by segment—hot, warm, or cold. Everything sends automatically.", "Cada mensaje está programado para la persona adecuada en el momento justo. El texto de email y WhatsApp se adapta a cada segmento: caliente, templado o frío. Todo se envía automáticamente."],
    features: [
      { label: ["Email + WhatsApp", "Email + WhatsApp", "Email + WhatsApp"], desc: ["Disparo multicanal automático", "Automated multichannel delivery", "Envío multicanal automático"] },
      { label: ["Segmentação", "Segmentation", "Segmentación"], desc: ["Quente / Morno / Frio", "Hot / Warm / Cold", "Caliente / Templado / Frío"] },
      { label: ["Engajamento", "Engagement", "Interacción"], desc: ["Open and click rates in real time", "Open and click rates in real time", "Tasas de apertura y clics en tiempo real"] },
    ],
  },
  agents: {
    module: ["Agentes NexOS", "NexOS Agents", "Agentes NexOS"],
    headline: ["64 especialistas trabalhando por você", "64 specialists working for you", "64 especialistas trabajando para ti"],
    narration: ["Tenho 64 agentes disponíveis — copywriter, estrategista, media buyer, compliance. Você consulta qualquer um em tempo real. Eles sabem tudo sobre o seu lançamento.", "You have 64 agents available—copywriters, strategists, media buyers, and compliance specialists. Consult any of them in real time; they know all about your launch.", "Tienes 64 agentes disponibles: redactores, estrategas, especialistas en medios y cumplimiento. Consulta a cualquiera en tiempo real; conocen tu lanzamiento."],
    features: [
      { label: ["64 agentes", "64 agents", "64 agentes"], desc: ["Cada um com especialidade", "Each with a specialty", "Cada uno con una especialidad"] },
      { label: ["Chat direto", "Direct chat", "Chat directo"], desc: ["Consulta em tempo real", "Real-time consultation", "Consulta en tiempo real"] },
      { label: ["Multi-provider", "Multi-provider", "Multiproveedor"], desc: ["Claude, GPT-4o, Gemini", "Claude, GPT-4o, Gemini", "Claude, GPT-4o, Gemini"] },
    ],
  },
  atendimento: {
    module: ["Time de Vendas", "Sales Team", "Equipo de ventas"],
    headline: ["IA fecha vendas por você", "AI closes sales for you", "La IA cierra ventas por ti"],
    narration: ["Cada lead que entra vai para o funil certo. O agente de vendas sugere a mensagem ideal para cada estágio — aquecimento, desejo, fechamento, objeções. Você só aprova ou envia.", "Every incoming lead goes to the right funnel. The sales agent suggests the ideal message for each stage—nurturing, desire, closing, and objections. You just approve or send.", "Cada lead entra en el embudo adecuado. El agente de ventas sugiere el mensaje ideal para cada etapa: acercamiento, deseo, cierre y objeciones. Tú solo apruebas o envías."],
    features: [
      { label: ["5 Agentes venda", "5 sales agents", "5 agentes de venta"], desc: ["Warmer, Closer, Objeções...", "Warmer, Closer, Objections...", "Warmer, Closer, Objeciones..."] },
      { label: ["Kanban funil", "Funnel Kanban", "Kanban del embudo"], desc: ["Visualização por estágio", "View by stage", "Vista por etapa"] },
      { label: ["IA sugere reply", "AI suggests replies", "La IA sugiere respuestas"], desc: ["Copy ideal para cada momento", "Ideal copy for each moment", "Texto ideal para cada momento"] },
    ],
  },
  metrics: {
    module: ["Métricas & Performance", "Metrics & Performance", "Métricas y rendimiento"],
    headline: ["Otimização em tempo real", "Real-time optimisation", "Optimización en tiempo real"],
    narration: ["Se o CTR cair, eu detecto e sugiro trocar o criativo. Se o CPL subir, ajusto a segmentação. Tudo auditado, tudo registrado. Você nunca fica no escuro.", "If CTR drops, I detect it and suggest a new creative. If CPL rises, I adjust targeting. Everything is audited and recorded, so you're never left in the dark.", "Si baja el CTR, lo detecto y sugiero cambiar la creatividad. Si sube el CPL, ajusto la segmentación. Todo queda auditado y registrado; nunca te quedas a oscuras."],
    features: [
      { label: ["Score 100pts", "100-point score", "Puntuación de 100 puntos"], desc: ["Receita + ROAS + CPL + Email", "Revenue + ROAS + CPL + email", "Ingresos + ROAS + CPL + email"] },
      { label: ["Fadiga criativa", "Creative fatigue", "Fatiga creativa"], desc: ["Detecta queda de CTR", "Detects CTR decline", "Detecta caídas del CTR"] },
      { label: ["Auto-otimização", "Auto-optimisation", "Autooptimización"], desc: ["Score ≤30 → agent activates", "Score ≤30 → agent activates", "Puntuación ≤30 → se activa un agente"] },
    ],
  },
};

// ── Typewriter hook ────────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 28, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);

  return { displayed, done };
}

// ── Avatar component ───────────────────────────────────────────────────────────

function CloneAvatar({ name, speaking }: { name: string; speaking: boolean }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative shrink-0">
      {/* Outer pulse ring */}
      {speaking && (
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
      )}
      {/* Mid ring */}
      <div className={`absolute -inset-1 rounded-full border ${speaking ? "border-primary/40 animate-pulse" : "border-white/10"} transition-all`} />
      {/* Avatar circle */}
      <div className="relative w-14 h-14 rounded-full border-2 border-primary/60 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <span className="font-mono text-lg font-black text-primary">{initials}</span>
        {/* Mic indicator */}
        {speaking && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
            <Volume2 className="h-2.5 w-2.5 text-black" />
          </div>
        )}
      </div>
      {/* Sound bars below */}
      {speaking && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-4">
          {[3,5,8,5,3,7,4,6,3].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-primary/60 animate-pulse rounded-sm"
              style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  userName: string;
  productName?: string;
  revenueTarget?: string;
  onProceed: () => void;
}

type WowPhase = "clone_speech" | "tour" | "done";

export function CloneWowMoment({ userName, productName, revenueTarget, onProceed }: Props) {
  const t = useUiText();
  const firstName = userName.split(" ")[0] ?? "você";

  const CLONE_SPEECH = `${firstName}, eu sou seu clone — criado com a sua voz e o seu jeito de falar.\n\nSeu lançamento de ${productName ?? "produto"} está traçado. Em 7 dias, ${revenueTarget ?? "R$ 100 mil"} é a meta. Não como promessa — como plano de execução.\n\nEu vou produzir os vídeos, escrever os emails, responder os leads, ajustar os anúncios e monitorar cada métrica — enquanto você foca no que importa: criar e conectar com a sua audiência.\n\nAgora deixa eu te mostrar onde tudo acontece.`;

  const [wowPhase, setWowPhase] = useState<WowPhase>("clone_speech");
  const [tourIdx, setTourIdx] = useState(0);
  const [skipSpeech, setSkipSpeech] = useState(false);

  const { displayed: speechDisplayed, done: speechDone } = useTypewriter(
    CLONE_SPEECH,
    22,
    wowPhase === "clone_speech" && !skipSpeech
  );
  const displayedSpeech = skipSpeech ? CLONE_SPEECH : speechDisplayed;
  const isSpeechDone = skipSpeech || speechDone;

  const currentStop = TOUR_STOPS[tourIdx]!;
  const StopIcon = currentStop.icon;
  const currentLabels = TOUR_UI_COPY[currentStop.id];

  const { displayed: tourNarration, done: tourDone } = useTypewriter(
    currentLabels ? t(...currentLabels.narration) : currentStop.cloneNarration,
    20,
    wowPhase === "tour"
  );

  const advanceTour = () => {
    if (tourIdx < TOUR_STOPS.length - 1) {
      setTourIdx(i => i + 1);
    } else {
      setWowPhase("done");
    }
  };

  // ── Clone speech phase ──────────────────────────────────────────────────────
  if (wowPhase === "clone_speech") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700 py-6">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="rounded-none font-mono text-[11px] border-primary/40 text-primary uppercase tracking-widest">
            <Sparkles className="h-3 w-3 mr-1.5" /> {t("Clone NexOS · Ativo", "NexOS Clone · Active", "Clon NexOS · Activo")}
          </Badge>
          <h2 className="font-mono text-xl font-bold uppercase tracking-tighter text-foreground">
            {t("Seu Clone tem uma mensagem para você", "Your clone has a message for you", "Tu clon tiene un mensaje para ti")}
          </h2>
        </div>

        {/* Clone speech card */}
        <div className="border border-primary/30 bg-primary/5 p-6 space-y-5 relative overflow-hidden">
          {/* Corner marks */}
          {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((c,i) => (
            <div key={i} className={`absolute w-3 h-3 ${c} border-primary`} />
          ))}

          {/* Avatar + name */}
          <div className="flex items-start gap-4 pb-2">
            <CloneAvatar name={userName} speaking={!isSpeechDone} />
            <div className="pt-8">
              <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">{t("Falando agora", "Speaking now", "Hablando ahora")}</div>
              <div className="font-mono text-sm font-bold text-foreground">{t(`Clone de ${firstName}`, `${firstName}'s clone`, `Clon de ${firstName}`)}</div>
              <div className="font-mono text-[10px] text-primary/70 uppercase tracking-widest mt-0.5">{t("Versão 1.0 · Processando voz", "Version 1.0 · Processing voice", "Versión 1.0 · Procesando voz")}</div>
            </div>
          </div>

          {/* Speech text */}
          <div className="border border-border/30 bg-background/50 px-5 py-4">
            <p className="font-mono text-[13px] text-foreground/90 leading-relaxed whitespace-pre-line">
              {displayedSpeech}
              {!isSpeechDone && <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />}
            </p>
          </div>

          {/* CTA */}
          {isSpeechDone && (
            <div className="animate-in fade-in duration-500 flex flex-col items-center gap-3">
              <Button
                onClick={() => setWowPhase("tour")}
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11 px-8 text-sm"
              >
                <Play className="h-4 w-4" />
                {t("Iniciar tour guiado", "Start guided tour", "Iniciar recorrido guiado")}
              </Button>
              <button
                onClick={onProceed}
                className="font-mono text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors uppercase tracking-widest underline underline-offset-2"
              >
                {t("Pular e ir direto para a campanha", "Skip and go straight to the campaign", "Omitir e ir directamente a la campaña")}
              </button>
            </div>
          )}

          {!isSpeechDone && (
            <div className="flex justify-center">
              <button
                onClick={() => setSkipSpeech(true)}
                className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors uppercase tracking-widest"
              >
                {t("pular apresentação →", "skip introduction →", "omitir presentación →")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tour phase ─────────────────────────────────────────────────────────────
  if (wowPhase === "tour") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-500 py-4">
        {/* Tour header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {t(`Tour guiado · ${tourIdx + 1} de ${TOUR_STOPS.length}`, `Guided tour · ${tourIdx + 1} of ${TOUR_STOPS.length}`, `Recorrido guiado · ${tourIdx + 1} de ${TOUR_STOPS.length}`)}
            </div>
            <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-foreground mt-0.5">
              {currentLabels ? t(...currentLabels.module) : currentStop.module}
            </h2>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1">
            {TOUR_STOPS.map((_, i) => (
              <div
                key={i}
                className={`w-6 h-1 ${i <= tourIdx ? "bg-primary" : "bg-border/40"} transition-all`}
              />
            ))}
          </div>
        </div>

        {/* Module preview card */}
        <div className="border border-border/50 bg-card/40 overflow-hidden">
          {/* Module header */}
          <div className={`px-5 py-4 border-b border-border/30 flex items-center gap-3 ${currentStop.color}`}>
            <StopIcon className="h-5 w-5" />
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-widest">{currentLabels ? t(...currentLabels.module) : currentStop.module}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{currentLabels ? t(...currentLabels.headline) : currentStop.headline}</div>
            </div>
          </div>

          {/* Clone narration */}
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CloneAvatar name={userName} speaking={!tourDone} />
              <div className="flex-1 pt-8">
                <div className="border border-border/30 bg-background/60 px-4 py-3">
                  <p className="font-mono text-[12px] text-foreground/80 leading-relaxed">
                    {tourNarration}
                    {!tourDone && <span className="inline-block w-0.5 h-3 bg-primary ml-0.5 animate-pulse align-middle" />}
                  </p>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-1.5">
              {(currentLabels?.features ?? getStopFeatures(currentStop.id).map(f => ({
                label: [f.label, f.label, f.label] as const,
                desc: [f.desc, f.desc, f.desc] as const,
              }))).map((f, i) => (
                <div key={i} className="border border-border/30 bg-background/40 px-2 py-2">
                  <div className={`font-mono text-[10px] font-bold uppercase tracking-widest ${currentStop.color}`}>
                    {t(...f.label)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-tight">{t(...f.desc)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 pb-5 flex gap-2">
            <Button
              onClick={advanceTour}
              className="flex-1 font-mono text-[11px] uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10"
            >
              {tourIdx < TOUR_STOPS.length - 1 ? (
                <><ChevronRight className="h-3.5 w-3.5" /> {t("Próximo módulo", "Next module", "Siguiente módulo")}</>
              ) : (
                <><Rocket className="h-3.5 w-3.5" /> {t("Concluir tour", "Finish tour", "Finalizar recorrido")}</>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onProceed}
              className="font-mono text-[10px] uppercase tracking-widest rounded-none text-muted-foreground/40 h-10 px-3"
            >
              {t("Pular", "Skip", "Omitir")} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Module nav dots */}
        <div className="flex items-center justify-center gap-2">
          {TOUR_STOPS.map((s, i) => {
            const SIcon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setTourIdx(i)}
                className={`transition-all ${i === tourIdx ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
              >
                <SIcon className={`h-3.5 w-3.5 ${s.color}`} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Done phase ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700 py-8">
      {/* Star burst */}
      <div className="text-center space-y-3">
        <div className="flex justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <h2 className="font-mono text-2xl font-bold uppercase tracking-tighter text-foreground">
          {t("Você está pronto para lançar", "You're ready to launch", "Estás listo para lanzar")}
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          {t("Clone criado · Plano gerado · Time escalado · Sistema configurado", "Clone created · Plan generated · Team assembled · System configured", "Clon creado · Plan generado · Equipo preparado · Sistema configurado")}
        </p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Bot, label: t("Clone NexOS", "NexOS Clone", "Clon NexOS"), value: t("Ativo · Voz capturada", "Active · Voice captured", "Activo · Voz capturada"), color: "text-primary" },
          { icon: Target, label: t("Meta 7 dias", "7-day target", "Meta de 7 días"), value: revenueTarget ?? "R$ 100k+", color: "text-success" },
          { icon: Zap, label: t("Agentes escalados", "Agents assigned", "Agentes asignados"), value: t("64 especialistas", "64 specialists", "64 especialistas"), color: "text-yellow-400" },
          { icon: Shield, label: t("Compliance", "Compliance", "Cumplimiento"), value: t("Verificado automaticamente", "Automatically verified", "Verificado automáticamente"), color: "text-cyan-400" },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className={`border border-current/20 bg-current/5 px-3 py-2.5 ${item.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] uppercase tracking-widest">{item.label}</span>
              </div>
              <div className="font-mono text-xs font-bold text-foreground">{item.value}</div>
            </div>
          );
        })}
      </div>

      <Button
        onClick={onProceed}
        className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-13 text-sm"
      >
        <Rocket className="h-4 w-4" />
        {t("Iniciar meu lançamento agora", "Start my launch now", "Iniciar mi lanzamiento ahora")}
      </Button>
    </div>
  );
}

// ── Feature highlights per module ─────────────────────────────────────────────

function getStopFeatures(id: string): { label: string; desc: string }[] {
  const map: Record<string, { label: string; desc: string }[]> = {
    dashboard: [
      { label: "Health Score", desc: "0–100 calculado em tempo real" },
      { label: "KPIs ao vivo", desc: "Receita, leads, ROAS, CPL" },
      { label: "Alertas IA", desc: "Detecta anomalias sozinho" },
    ],
    campaigns: [
      { label: "State Machine", desc: "Pipeline automático de fases" },
      { label: "Multi-agente", desc: "Claude + GPT-4o + Gemini" },
      { label: "Aprovação", desc: "Você aprova, IA executa" },
    ],
    sequences: [
      { label: "Email + WhatsApp", desc: "Disparo multicanal automático" },
      { label: "Segmentação", desc: "Quente / Morno / Frio" },
      { label: "Engajamento", desc: "Open rate + click rate em tempo real" },
    ],
    agents: [
      { label: "64 agentes", desc: "Cada um com especialidade" },
      { label: "Chat direto", desc: "Consulta em tempo real" },
      { label: "Multi-provider", desc: "Claude, GPT-4o, Gemini" },
    ],
    atendimento: [
      { label: "5 Agentes venda", desc: "Warmer, Closer, Objeções..." },
      { label: "Kanban funil", desc: "Visualização por estágio" },
      { label: "IA sugere reply", desc: "Copy ideal para cada momento" },
    ],
    metrics: [
      { label: "Score 100pts", desc: "Receita + ROAS + CPL + Email" },
      { label: "Fadiga criativa", desc: "Detecta queda de CTR" },
      { label: "Auto-otimização", desc: "Score ≤30 → agente ativa" },
    ],
  };
  return map[id] ?? [];
}
