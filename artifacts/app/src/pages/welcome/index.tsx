/**
 * Welcome — Primeiro contato emocional.
 *
 * Mostrado uma única vez ao novo usuário.
 * Foco: reforçar a decisão de compra + apresentar o potencial da plataforma
 * de forma humana e profunda. Sem lista de features chata.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Rocket, Bot, Zap, Target,
  BarChart3, Link2, ArrowRight,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { hasDoneTour } from "@/components/AppTour";

const WELCOME_SEEN_KEY = "nexos_welcome_seen";

export function hasSeenWelcome(): boolean {
  try { return !!localStorage.getItem(WELCOME_SEEN_KEY); } catch { return false; }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch {}
}

const PILLARS = [
  {
    icon: Bot,
    color: "text-primary border-primary/30 bg-primary/8",
    title: "64 Agentes IA",
    desc: "Estrategista, copywriter, mídia paga, compliance, vendas — uma equipe completa trabalhando ao mesmo tempo.",
  },
  {
    icon: Zap,
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8",
    title: "Automação Total",
    desc: "Email + WhatsApp disparando automaticamente para o lead certo, no momento certo, com a mensagem certa.",
  },
  {
    icon: Target,
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
    title: "Estratégia em Minutos",
    desc: "3 minutos de briefing → estratégia completa, copy, cronograma e sequências prontos para aprovar.",
  },
  {
    icon: BarChart3,
    color: "text-success border-success/30 bg-success/8",
    title: "Resultados em Tempo Real",
    desc: "Leads, vendas, ROAS e receita ao vivo. O sistema otimiza sozinho enquanto o lançamento acontece.",
  },
  {
    icon: Link2,
    color: "text-purple-400 border-purple-400/30 bg-purple-400/8",
    title: "Integrações Nativas",
    desc: "WhatsApp Business, Meta Ads, RD Station, Hotmart, Kiwify — tudo conectado e orquestrado numa operação.",
  },
  {
    icon: Rocket,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/8",
    title: "Do Briefing ao Lançamento",
    desc: "Briefing → Estratégia → Conteúdo → Lançamento → Resultados. Um fluxo claro, sem dúvidas, sem improvisos.",
  },
];

type Phase = "welcome" | "pillars" | "ready";

export default function Welcome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("welcome");
  const firstName = user?.name?.split(" ")[0] ?? "você";

  useEffect(() => {
    markWelcomeSeen();
  }, []);

  const goToDashboard = () => {
    if (!hasDoneTour()) {
      // Signal app-layout to show tour after navigation
      try { localStorage.setItem("nexos_show_tour_next", "1"); } catch {}
    }
    setLocation("/dashboard");
  };

  const goToCampaign = () => {
    markWelcomeSeen();
    setLocation("/campaigns/new");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-center pt-10 pb-6">
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

      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-16">

        {/* ── PHASE 1: Welcome message ── */}
        {phase === "welcome" && (
          <div className="max-w-xl w-full text-center space-y-8 mt-4">

            {/* Headline */}
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">
                Bem-vindo, {firstName}.
              </div>
              <h1 className="font-mono font-black text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
                Você acabou de fazer<br />
                <span className="text-primary">a melhor decisão</span><br />
                do seu lançamento.
              </h1>
            </div>

            {/* Message */}
            <div className="space-y-4 text-left border border-primary/20 bg-primary/5 px-6 py-5">
              <p className="font-mono text-sm text-foreground/80 leading-relaxed">
                Enquanto você lê isso, outros empreendedores estão gastando R$8.000 em agências, semanas com copywriters e meses planejando o que você vai executar <strong className="text-foreground">em dias</strong>.
              </p>
              <p className="font-mono text-sm text-foreground/80 leading-relaxed">
                A NexOS AI não é uma ferramenta. É a diferença entre lançar e não lançar — entre ter uma equipe de especialistas ou improvisar sozinho.
              </p>
              <p className="font-mono text-sm text-primary leading-relaxed font-bold">
                64 agentes IA. Uma operação completa. Seu próximo lançamento.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => setPhase("pillars")}
                className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
              >
                Ver o que tenho nas mãos
                <ChevronRight className="h-4 w-4" />
              </Button>
              <button
                onClick={goToCampaign}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              >
                Já sei — quero criar minha campanha →
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE 2: Pillars ── */}
        {phase === "pillars" && (
          <div className="max-w-2xl w-full mt-4 space-y-6">
            <div className="text-center space-y-1">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">O que você tem nas mãos</div>
              <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground">
                6 blocos que mudam um lançamento
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PILLARS.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className={`border ${p.color} px-4 py-3 flex gap-3`}>
                    <div className={`w-8 h-8 border border-current/20 bg-current/10 flex items-center justify-center shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground mb-0.5">
                        {p.title}
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={() => setPhase("ready")}
                className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
              >
                Estou pronto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── PHASE 3: Ready ── */}
        {phase === "ready" && (
          <div className="max-w-xl w-full text-center mt-4 space-y-8">
            <div className="space-y-3">
              <div className="text-5xl">🔥</div>
              <h2 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground">
                Agora vamos lançar.
              </h2>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
                Faça um tour rápido pela plataforma para conhecer cada área — ou vá direto criar sua primeira campanha.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={goToDashboard}
                className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
              >
                <Bot className="h-4 w-4" />
                Fazer tour guiado (2 min)
              </Button>
              <Button
                onClick={goToCampaign}
                variant="outline"
                className="w-full rounded-none font-mono uppercase tracking-widest h-10 text-xs border-border/50 hover:border-primary/50 hover:text-primary gap-2"
              >
                <Rocket className="h-3.5 w-3.5" />
                Criar minha primeira campanha agora
              </Button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
              >
                Ir para o dashboard sem tour
              </button>
            </div>

            {/* Trust element */}
            <div className="border border-border/20 bg-card/20 px-4 py-3 text-left">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-2">Próximos passos recomendados</div>
              <div className="space-y-1.5">
                {[
                  "01. Conectar WhatsApp Business e plataforma de email",
                  "02. Criar primeira campanha (briefing de 3 min com o agente)",
                  "03. Aprovar estratégia e aguardar geração de conteúdo",
                  "04. Revisar conteúdo e executar checklist de lançamento",
                  "05. Clicar em Lançar e acompanhar resultados em tempo real",
                ].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="font-mono text-[11px] text-muted-foreground/60">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
