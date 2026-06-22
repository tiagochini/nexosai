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

  const { displayed: tourNarration, done: tourDone } = useTypewriter(
    currentStop.cloneNarration,
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
            <Sparkles className="h-3 w-3 mr-1.5" /> Clone NexOS · Ativo
          </Badge>
          <h2 className="font-mono text-xl font-bold uppercase tracking-tighter text-foreground">
            Seu Clone tem uma mensagem para você
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
              <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">Falando agora</div>
              <div className="font-mono text-sm font-bold text-foreground">Clone de {firstName}</div>
              <div className="font-mono text-[10px] text-primary/70 uppercase tracking-widest mt-0.5">Versão 1.0 · Processando voz</div>
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
                Iniciar tour guiado
              </Button>
              <button
                onClick={onProceed}
                className="font-mono text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors uppercase tracking-widest underline underline-offset-2"
              >
                Pular e ir direto para a campanha
              </button>
            </div>
          )}

          {!isSpeechDone && (
            <div className="flex justify-center">
              <button
                onClick={() => setSkipSpeech(true)}
                className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors uppercase tracking-widest"
              >
                pular apresentação →
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
              Tour guiado · {tourIdx + 1} de {TOUR_STOPS.length}
            </div>
            <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-foreground mt-0.5">
              {currentStop.module}
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
              <div className="font-mono text-xs font-bold uppercase tracking-widest">{currentStop.module}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{currentStop.headline}</div>
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
              {getStopFeatures(currentStop.id).map((f, i) => (
                <div key={i} className="border border-border/30 bg-background/40 px-2 py-2">
                  <div className={`font-mono text-[10px] font-bold uppercase tracking-widest ${currentStop.color}`}>
                    {f.label}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-tight">{f.desc}</div>
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
                <><ChevronRight className="h-3.5 w-3.5" /> Próximo módulo</>
              ) : (
                <><Rocket className="h-3.5 w-3.5" /> Concluir tour</>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onProceed}
              className="font-mono text-[10px] uppercase tracking-widest rounded-none text-muted-foreground/40 h-10 px-3"
            >
              Pular <ArrowRight className="h-3 w-3 ml-1" />
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
          Você está pronto para lançar
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          Clone criado · Plano gerado · Time escalado · Sistema configurado
        </p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Bot,           label: "Clone NexOS",        value: "Ativo · Voz capturada", color: "text-primary" },
          { icon: Target,        label: "Meta 7 dias",         value: revenueTarget ?? "R$ 100k+", color: "text-success" },
          { icon: Zap,           label: "Agentes escalados",   value: "64 especialistas", color: "text-yellow-400" },
          { icon: Shield,        label: "Compliance",          value: "Verificado automaticamente", color: "text-cyan-400" },
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
        Iniciar meu lançamento agora
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
