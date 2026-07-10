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

const WELCOME_SEEN_KEY = "nexos_welcome_seen";

// Local fallback flag — the source of truth is user.hasSeenOnboarding (DB),
// this just avoids a flash of the flow while /me is loading right after signup.
export function hasSeenWelcome(): boolean {
  try { return !!localStorage.getItem(WELCOME_SEEN_KEY); } catch { return false; }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch {}
}

const TEAM = [
  {
    name: "Erick", role: "General das Operações", icon: Rocket,
    color: "text-primary border-primary/30 bg-primary/8",
    desc: "Orquestra toda a operação e alinha os outros 63 agentes rumo ao seu objetivo.",
  },
  {
    name: "Jefferson", role: "Arquiteto do Lançamento", icon: Brain,
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
    desc: "Monta a estratégia completa do zero: posicionamento, narrativa e cronograma.",
  },
  {
    name: "Gary", role: "Mestre das Palavras", icon: Pen,
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8",
    desc: "Escreve toda a copy — anúncios, e-mails, páginas — no seu tom de voz.",
  },
  {
    name: "Nicholas", role: "Maximizador de ROAS", icon: Target,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/8",
    desc: "Cuida da mídia paga: públicos, verba e otimização de campanha em tempo real.",
  },
  {
    name: "Alexandre", role: "Arquiteto de Ofertas", icon: ShoppingCart,
    color: "text-success border-success/30 bg-success/8",
    desc: "Constrói a oferta: preço, bônus e garantia para maximizar conversão.",
  },
];

const EXPECTATIONS = [
  { icon: Clock, text: "15 minutos de briefing guiado por IA — sem planilha, sem enrolação." },
  { icon: Brain, text: "Estratégia completa pronta para aprovar em minutos, não semanas." },
  { icon: CheckCircle2, text: "Você aprova cada etapa — nada vai ao ar sem seu ok." },
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
  const [phase, setPhase] = useState<Phase>("celebration");
  const [showConfetti, setShowConfetti] = useState(true);
  const markSeen = useMarkOnboardingSeen();
  const firstName = user?.name?.split(" ")[0] ?? "você";

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
                Parabéns, {firstName}.
              </div>
              <h1 className="font-mono font-black text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
                Você acabou de fazer<br />
                <span className="text-primary">a melhor decisão</span><br />
                do seu lançamento.
              </h1>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-md mx-auto">
                Enquanto outros gastam R$8.000 em agências e semanas com copywriters, você acaba de contratar uma equipe inteira de especialistas em IA — pronta para trabalhar agora.
              </p>
            </div>

            <Button
              onClick={() => setPhase("team")}
              className="w-full max-w-sm mx-auto rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
            >
              Conhecer meu time
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── PHASE 2: Meet the team ── */}
        {phase === "team" && (
          <div className="max-w-2xl w-full mt-4 space-y-6">
            <div className="text-center space-y-1">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">Seu time chegou</div>
              <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground">
                Conheça alguns dos seus agentes
              </h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                São 64 no total — estes já começam trabalhando na sua primeira campanha.
              </p>
            </div>

            <div className="space-y-2.5">
              {TEAM.map((agent) => {
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
              O que esperar agora
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
                Agora vamos lançar.
              </h2>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
                É simples: você responde um briefing rápido, e o time entra em ação.
              </p>
            </div>

            <div className="space-y-2 text-left">
              {EXPECTATIONS.map((e, i) => {
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
                Criar minha primeira campanha
              </Button>
              <Button
                onClick={() => finishAndGo("/dashboard")}
                variant="outline"
                className="w-full rounded-none font-mono uppercase tracking-widest h-10 text-xs border-border/50 hover:border-primary/50 hover:text-primary gap-2"
              >
                <Bot className="h-3.5 w-3.5" />
                Fazer tour guiado antes (2 min)
              </Button>
              <button
                onClick={() => finishAndGo("/dashboard")}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
              >
                Ir para o dashboard sem tour
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
