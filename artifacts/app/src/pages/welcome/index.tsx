/**
 * Welcome — Primeiro contato emocional.
 *
 * Mostrado uma única vez ao novo usuário (gate: user.hasSeenOnboarding no banco).
 * Fluxo: celebração → conheça o time → o que esperar → CTA para criar a campanha.
 */

import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMarkOnboardingSeen } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Rocket, Bot, ArrowRight, PartyPopper,
  Brain, ShoppingCart, Pen, Target, Clock, CheckCircle2,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { hasDoneTour } from "@/components/AppTour";
import { useUiText } from "@/lib/i18n";
import { markWelcomeSeen } from "@/lib/welcome-state";

const getTeam = (t: ReturnType<typeof useUiText>) => [
  {
    name: "Erick", role: t("General das Operações", "Operations General", "General de operaciones"), icon: Rocket,
    color: "text-primary border-primary/30 bg-primary/8",
    desc: t("Orquestra toda a operação e alinha os outros 63 agentes rumo ao seu objetivo.", "Coordinates the entire operation and aligns the other 63 agents with your goal.", "Coordina toda la operación y guía a los otros 63 agentes hacia tu objetivo."),
  },
  {
    name: "Jefferson", role: t("Arquiteto do Lançamento", "Launch Architect", "Arquitecto de lanzamiento"), icon: Brain,
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
    desc: t("Monta a estratégia completa do zero: posicionamento, narrativa e cronograma.", "Builds the complete strategy from scratch: positioning, narrative, and timeline.", "Crea la estrategia completa desde cero: posicionamiento, narrativa y cronograma."),
  },
  {
    name: "Gary", role: t("Mestre das Palavras", "Wordsmith", "Maestro de las palabras"), icon: Pen,
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8",
    desc: t("Escreve toda a copy — anúncios, e-mails, páginas — no seu tom de voz.", "Writes all your copy — ads, emails, and pages — in your voice.", "Escribe todo el contenido — anuncios, correos y páginas — con tu tono de voz."),
  },
  {
    name: "Nicholas", role: t("Maximizador de ROAS", "ROAS Optimizer", "Optimizador de ROAS"), icon: Target,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/8",
    desc: t("Cuida da mídia paga: públicos, verba e otimização de campanha em tempo real.", "Manages paid media: audiences, budgets, and real-time campaign optimization.", "Gestiona los medios pagados: audiencias, presupuesto y optimización de campañas en tiempo real."),
  },
  {
    name: "Alexandre", role: t("Arquiteto de Ofertas", "Offer Architect", "Arquitecto de ofertas"), icon: ShoppingCart,
    color: "text-success border-success/30 bg-success/8",
    desc: t("Constrói a oferta: preço, bônus e garantia para maximizar conversão.", "Builds your offer — pricing, bonuses, and guarantees — to maximize conversion.", "Diseña tu oferta — precio, bonos y garantía — para maximizar la conversión."),
  },
];

const getExpectations = (t: ReturnType<typeof useUiText>) => [
  { icon: Clock, text: t("15 minutos de briefing guiado por IA — sem planilha, sem enrolação.", "A 15-minute AI-guided brief — no spreadsheets, no busywork.", "15 minutos de resumen guiado por IA: sin hojas de cálculo ni complicaciones.") },
  { icon: Brain, text: t("Estratégia completa pronta para aprovar em minutos, não semanas.", "A complete strategy ready for your approval in minutes, not weeks.", "Una estrategia completa lista para aprobar en minutos, no semanas.") },
  { icon: CheckCircle2, text: t("Você aprova cada etapa — nada vai ao ar sem seu ok.", "You approve every step — nothing goes live without your approval.", "Apruebas cada paso: nada se publica sin tu autorización.") },
];

type Phase = "celebration" | "team" | "expectations";

// Lightweight confetti burst — no external dependency needed.
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2.2 + Math.random() * 1.4,
    color: ["bg-primary", "bg-success", "bg-yellow-400", "bg-cyan-400", "bg-orange-400"][i % 5],
    rotate: Math.random() * 360,
  })), []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {pieces.map(p => (
        <span
          key={p.id}
          className={`absolute top-[-5%] w-2 h-2 ${p.color}`}
          style={{
            left: `${p.left}%`,
            animation: `nexos-confetti-fall ${p.duration}s ease-in ${p.delay}s 1 forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes nexos-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function Welcome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const t = useUiText();
  const [phase, setPhase] = useState<Phase>("celebration");
  const [showConfetti, setShowConfetti] = useState(true);
  const markSeen = useMarkOnboardingSeen();
  const firstName = user?.name?.split(" ")[0] ?? t("você", "you", "tú");
  const team = getTeam(t);
  const expectations = getExpectations(t);

  useEffect(() => {
    markWelcomeSeen();
    void markSeen.mutateAsync().catch(() => {});
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishAndGo = (path: string) => {
    if (!hasDoneTour() && path === "/dashboard") {
      try { localStorage.setItem("nexos_show_tour_next", "1"); } catch {}
    }
    setLocation(path);
  };

  const goToCampaign = () => finishAndGo("/campaigns/new");

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {showConfetti && phase === "celebration" && <Confetti />}

      {/* Header */}
      <div className="flex items-center justify-center pt-10 pb-6 relative z-10">
        <div className="flex items-center gap-3">
          <img
            src={nexosLogo}
            alt="NexOS"
            className="h-10 w-10 object-contain"
            style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.8))" }}
          />
          <div className="font-mono font-black text-2xl uppercase tracking-widest leading-none">NEXOS AI</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-16 relative z-10">

        {/* ── PHASE 1: Celebration ── */}
        {phase === "celebration" && (
          <div className="max-w-xl w-full text-center space-y-8 mt-4">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                  <PartyPopper className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">
                {t(`Parabéns, ${firstName}.`, `Congratulations, ${firstName}.`, `Felicidades, ${firstName}.`)}
              </div>
              <h1 className="font-mono font-black text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
                {t("Você acabou de fazer", "You just made", "Acabas de tomar")}<br />
                <span className="text-primary">{t("a melhor decisão", "the best decision", "la mejor decisión")}</span><br />
                {t("do seu lançamento.", "for your launch.", "para tu lanzamiento.")}
              </h1>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-md mx-auto">
                {t("Enquanto outros gastam R$8.000 em agências e semanas com copywriters, você acaba de contratar uma equipe inteira de especialistas em IA — pronta para trabalhar agora.", "While others spend R$8,000 on agencies and weeks waiting for copywriters, you've just hired a full team of AI specialists — ready to work now.", "Mientras otros gastan R$8.000 en agencias y esperan semanas por redactores, acabas de contratar a todo un equipo de especialistas en IA, listo para trabajar ahora.")}
              </p>
            </div>

            <Button
              onClick={() => setPhase("team")}
              className="w-full max-w-sm mx-auto rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
            >
              {t("Conhecer meu time", "Meet my team", "Conocer a mi equipo")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── PHASE 2: Meet the team ── */}
        {phase === "team" && (
          <div className="max-w-2xl w-full mt-4 space-y-6">
            <div className="text-center space-y-1">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">{t("Seu time chegou", "Your team is here", "Tu equipo ya llegó")}</div>
              <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground">
                {t("Conheça alguns dos seus agentes", "Meet some of your agents", "Conoce a algunos de tus agentes")}
              </h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {t("São 64 no total — estes já começam trabalhando na sua primeira campanha.", "There are 64 in total — these agents are ready to start on your first campaign.", "Son 64 en total; estos ya están listos para trabajar en tu primera campaña.")}
              </p>
            </div>

            <div className="space-y-2.5">
              {team.map((agent) => {
                const Icon = agent.icon;
                return (
                  <div key={agent.name} className={`border ${agent.color} px-4 py-3 flex items-center gap-3`}>
                    <div className="w-10 h-10 rounded-full border border-current/20 bg-current/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                        {agent.name} <span className="text-muted-foreground/50 normal-case font-normal">· {agent.role}</span>
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed mt-0.5">
                        {agent.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={() => setPhase("expectations")}
              className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
            >
              {t("O que esperar agora", "What to expect next", "Qué esperar ahora")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── PHASE 3: Expectations + CTA ── */}
        {phase === "expectations" && (
          <div className="max-w-xl w-full text-center mt-4 space-y-8">
            <div className="space-y-3">
              <div className="text-5xl">🔥</div>
              <h2 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground">
                {t("Agora vamos lançar.", "Now let's launch.", "Ahora vamos a lanzar.")}
              </h2>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
                {t("É simples: você responde um briefing rápido, e o time entra em ação.", "It's simple: answer a quick brief, and your team gets to work.", "Es sencillo: respondes un breve cuestionario y tu equipo se pone en marcha.")}
              </p>
            </div>

            <div className="space-y-2 text-left">
              {expectations.map((e, i) => {
                const Icon = e.icon;
                return (
                  <div key={i} className="border border-border/30 bg-card/30 px-4 py-3 flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground/70">{e.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <Button
                onClick={goToCampaign}
                className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
              >
                <Rocket className="h-4 w-4" />
                {t("Criar minha primeira campanha", "Create my first campaign", "Crear mi primera campaña")}
              </Button>
              <Button
                onClick={() => finishAndGo("/dashboard")}
                variant="outline"
                className="w-full rounded-none font-mono uppercase tracking-widest h-10 text-xs border-border/50 hover:border-primary/50 hover:text-primary gap-2"
              >
                <Bot className="h-3.5 w-3.5" />
                {t("Fazer tour guiado antes (2 min)", "Take the 2-minute guided tour first", "Hacer primero el recorrido guiado (2 min)")}
              </Button>
              <button
                onClick={() => finishAndGo("/dashboard")}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
              >
                {t("Ir para o dashboard sem tour", "Go to the dashboard without the tour", "Ir al panel sin el recorrido")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
