/**
 * Welcome — tela emocional de boas-vindas pós-compra.
 *
 * Exibida uma única vez: após registro ou após compra, antes do onboarding.
 * Persistida em localStorage para não repetir.
 * Tom: conquista, reforço de decisão, sensação de ter contratado uma equipe inteira.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Bot, Rocket, Shield, Zap, Target,
  Users, BarChart2, MessageSquare, CheckCircle2,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

const WELCOME_SEEN_KEY = "nexos_welcome_seen";

export function hasSeenWelcome(): boolean {
  try { return !!localStorage.getItem(WELCOME_SEEN_KEY); } catch { return false; }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch {}
}

const DEPARTMENTS = [
  { icon: Target,       label: "Estratégia",   desc: "Define o plano de ataque" },
  { icon: MessageSquare,label: "Copy",          desc: "Escreve tudo que você precisa" },
  { icon: Zap,          label: "Criativos",     desc: "Conceitos visuais e roteiros" },
  { icon: Users,        label: "Público",       desc: "Mapeia e segmenta sua audiência" },
  { icon: Bot,          label: "Automação",     desc: "Executa sequências no piloto" },
  { icon: BarChart2,    label: "Métricas",      desc: "Monitora e otimiza em tempo real" },
  { icon: Shield,       label: "Compliance",    desc: "Garante que tudo está nos eixos" },
  { icon: Rocket,       label: "Lançamento",    desc: "Coordena a operação do carrinho" },
];

export default function Welcome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "você";

  useEffect(() => {
    // Fade in suave
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleContinue() {
    markWelcomeSeen();
    setLocation("/onboarding");
  }

  return (
    <div
      className={`min-h-screen bg-background flex flex-col transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ── Top bar ── */}
      <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between">
        <img src={nexosLogo} alt="NexOS" className="h-7 opacity-90" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">
          Bem-vindo à operação
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto w-full">

        {/* ── Badge ── */}
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
            Acesso ativo · Operação iniciada
          </span>
        </div>

        {/* ── Headline ── */}
        <h1 className="font-mono font-black text-3xl md:text-4xl uppercase tracking-tight text-foreground text-center mb-6 leading-tight">
          Parabéns,{" "}
          <span className="text-primary">{firstName}.</span>
        </h1>

        {/* ── Mensagem principal ── */}
        <div className="border border-border/40 bg-card/30 p-6 md:p-8 mb-8 w-full relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/50" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/50" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/50" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/50" />

          <p className="font-mono text-sm md:text-base text-foreground/80 leading-relaxed text-center">
            A partir de agora, você não está mais tentando fazer tudo sozinho.
          </p>
          <p className="font-mono text-sm md:text-base text-muted-foreground/70 leading-relaxed text-center mt-4">
            A NEXOS foi criada para colocar uma equipe inteira de especialistas
            trabalhando pelo seu negócio: estratégia, copy, criativos, funis,
            automações, tráfego, campanhas e análise.
          </p>
          <p className="font-mono text-sm md:text-base text-muted-foreground/70 leading-relaxed text-center mt-4">
            As antigas dificuldades — profissionais lentos, copies fracas, campanhas
            confusas, custos altos e falta de clareza —{" "}
            <span className="text-foreground font-bold">começam a ficar para trás.</span>
          </p>
          <p className="font-mono text-sm md:text-base text-foreground/80 leading-relaxed text-center mt-6 font-bold">
            Agora vamos entender profundamente o seu negócio para preparar uma
            operação comercial sob medida para você.
          </p>
        </div>

        {/* ── Time de departamentos ── */}
        <div className="w-full mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center mb-4">
            Sua nova equipe completa — ativa agora
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DEPARTMENTS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="border border-border/30 bg-card/20 p-3 flex flex-col items-center text-center gap-1.5 hover:border-primary/30 transition-colors"
              >
                <Icon className="h-4 w-4 text-primary/70" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/80 font-bold">
                  {label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reforços de decisão ── */}
        <div className="w-full flex flex-col sm:flex-row gap-3 mb-10">
          {[
            "Você tomou a decisão certa.",
            "O tempo de trabalhar sozinho acabou.",
            "A operação começa agora.",
          ].map((line) => (
            <div
              key={line}
              className="flex-1 flex items-center gap-2 border border-success/20 bg-success/5 px-3 py-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              <span className="font-mono text-[11px] text-success/80">{line}</span>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <Button
          onClick={handleContinue}
          className="rounded-none font-mono uppercase tracking-widest font-black gap-3 btn-weapon-primary h-14 px-10 text-sm w-full sm:w-auto"
        >
          <Rocket className="h-4 w-4" />
          Vamos entender meu negócio
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="font-mono text-[11px] text-muted-foreground/30 mt-4 text-center">
          Leva menos de 5 minutos · Você pode salvar e continuar depois
        </p>
      </div>
    </div>
  );
}
