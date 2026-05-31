/**
 * Welcome — Pós-venda superior. Primeiro contato emocional + tour de desejo.
 *
 * Filosofia: cada área da plataforma entrega uma necessidade realizada.
 * O usuário não vê um "mapa do site" — vê o que ele AGORA consegue fazer
 * que antes era impossível. Cada feature é apresentada como uma vitória
 * desbloqueada, usando conceitos de desejo, urgência e transformação.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Rocket, CheckCircle2, ChevronRight,
  LayoutDashboard, PlayCircle, Bot, Video,
  Mail, Link2, TrendingUp, Camera, Radio,
  Users, Zap, Shield, MessageSquare, Target,
  BarChart2, Clapperboard, ShoppingCart, Star,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

const WELCOME_SEEN_KEY = "nexos_welcome_seen";

export function hasSeenWelcome(): boolean {
  try { return !!localStorage.getItem(WELCOME_SEEN_KEY); } catch { return false; }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch {}
}

interface FeatureArea {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge: string;
  title: string;
  desire: string;
  realized: string;
  action: string;
  path: string;
  bullets: string[];
}

const FEATURE_AREAS: FeatureArea[] = [
  {
    id: "campaigns",
    icon: PlayCircle,
    color: "text-primary",
    badge: "CORE",
    title: "Campanhas de Lançamento",
    desire: "Antes você precisava de uma equipe inteira para lançar. Agora são 34 agentes IA trabalhando ao mesmo tempo.",
    realized: "Você acabou de ganhar uma equipe completa de especialistas. Por uma fração do custo.",
    action: "Criar minha primeira campanha",
    path: "/campaigns/new",
    bullets: [
      "Estratégia gerada por IA em minutos, não semanas",
      "Copy de todos os canais escrita automaticamente",
      "Sequências de automação montadas pelo próprio sistema",
      "Métricas ao vivo com otimização contínua",
    ],
  },
  {
    id: "agents",
    icon: Bot,
    color: "text-indigo-400",
    badge: "34 AGENTES",
    title: "Hub de Agentes IA",
    desire: "Cada especialista que você sempre precisou — estrategista, copywriter, analista, closer — agora disponível 24/7 sem folga, sem ego e sem fatura mensal.",
    realized: "Você tem acesso instantâneo a décadas de conhecimento de lançamento. Converse com qualquer agente agora.",
    action: "Ver meus agentes",
    path: "/agents",
    bullets: [
      "Claude (Anthropic) para estratégia e raciocínio profundo",
      "GPT-4o para copy, criatividade e persuasão",
      "Gemini para analytics, otimização e vídeo",
      "Agentes de vendas, compliance, automação e mais",
    ],
  },
  {
    id: "sequences",
    icon: Mail,
    color: "text-green-400",
    badge: "AUTOMAÇÃO",
    title: "Sequências de Lançamento",
    desire: "Imagine sua sequência de aquecimento, abertura de carrinho e fechamento rodando sozinha, mandando a mensagem certa para a pessoa certa no momento exato.",
    realized: "Você não precisa mais ficar colado no celular durante o lançamento. A operação roda no piloto automático.",
    action: "Montar minha sequência",
    path: "/sequences/new",
    bullets: [
      "E-mail + WhatsApp integrados numa única automação",
      "Segmentação inteligente: quente, morno, frio",
      "Disparo de mensagens no horário de maior engajamento",
      "Copy gerada por IA para cada fase do lançamento",
    ],
  },
  {
    id: "video",
    icon: Video,
    color: "text-blue-400",
    badge: "CYRUS",
    title: "Produção de Vídeo com IA",
    desire: "CYRUS transforma seu produto em um roteiro cinematográfico completo: hook, desenvolvimento, prova, CTA. O que levaria dias de roteirista, em minutos.",
    realized: "Seu VSL profissional está a poucos cliques. Com ou sem você na câmera.",
    action: "Criar meu primeiro vídeo",
    path: "/video-production",
    bullets: [
      "Roteiro cinematográfico completo gerado por IA",
      "Storyboard cena a cena com direção visual",
      "Modo com apresentador ou B-roll cinematográfico",
      "Guia do Diretor personalizado para filmagem",
    ],
  },
  {
    id: "director",
    icon: Clapperboard,
    color: "text-purple-400",
    badge: "EXCLUSIVO",
    title: "Guia do Diretor de Filmagem",
    desire: "O Diretor da NexOS instrui você sobre cada detalhe: que roupa usar, como montar o cenário, como falar, como gerenciar energia em cada cena. Nada de improvisar.",
    realized: "Você vai para a frente da câmera com briefing completo de produção profissional.",
    action: "Ver instruções do diretor",
    path: "/video-production/director-guide",
    bullets: [
      "Briefing de vestuário por tipo de produto",
      "Direção de cenário: fundo, iluminação, profundidade",
      "Mapa de energia emocional cena a cena",
      "Download personalizado com anti-pirataria",
    ],
  },
  {
    id: "launch-room",
    icon: Radio,
    color: "text-success",
    badge: "AO VIVO",
    title: "Sala de Lançamento",
    desire: "Durante o lançamento, você precisa de um centro de controle. Métricas ao vivo, plataformas conectadas, sequências rodando — tudo num único lugar.",
    realized: "Você tem uma sala de guerra para o dia do lançamento. Sem surpresa, sem caos.",
    action: "Entrar na Sala de Lançamento",
    path: "/launch-room",
    bullets: [
      "Status ao vivo de todas as plataformas conectadas",
      "Leads, vendas e receita em tempo real",
      "Alertas automáticos de problemas de integração",
      "NexOS Live: WebSocket com eventos em tempo real",
    ],
  },
  {
    id: "integracoes",
    icon: Link2,
    color: "text-orange-400",
    badge: "CONECTAR",
    title: "Integrações e Plataformas",
    desire: "WhatsApp, Instagram, e-mail, Meta Ads, pagamentos — tudo conectado numa só operação. O sistema cuida da orquestração enquanto você foca no que importa.",
    realized: "Uma vez conectado, o sistema opera sozinho. Você define a estratégia, a NexOS executa.",
    action: "Conectar minhas plataformas",
    path: "/integracoes",
    bullets: [
      "WhatsApp Business + resposta automática por IA",
      "Instagram e Facebook auto-post na aprovação",
      "E-mail via RD Station, ActiveCampaign ou Resend",
      "Meta Ads + TikTok Ads + Server-Side Events",
    ],
  },
  {
    id: "revenue",
    icon: TrendingUp,
    color: "text-yellow-400",
    badge: "RESULTADOS",
    title: "Painel de Receita",
    desire: "Números reais do seu lançamento: receita total, ROAS, CPL, health score com IA detectando problemas antes que você perceba.",
    realized: "Você tem visibilidade total do que está funcionando e o que precisa de ajuste — em tempo real.",
    action: "Ver meus resultados",
    path: "/revenue",
    bullets: [
      "Health score de 100 pontos com alertas automáticos",
      "Detecção de fadiga criativa por CTR caído",
      "Relatório semanal enviado por e-mail",
      "Export CSV para análise externa",
    ],
  },
  {
    id: "atendimento",
    icon: MessageSquare,
    color: "text-cyan-400",
    badge: "TIME DE VENDAS",
    title: "Atendimento e Conversão",
    desire: "5 agentes de vendas especializados — aquecedor, desejo, closer, objeção, consultor — sugerindo a resposta certa para cada lead em cada momento do funil.",
    realized: "Você tem um time de vendas de alta performance que nunca deixa um lead sem resposta.",
    action: "Acessar meu time de vendas",
    path: "/atendimento",
    bullets: [
      "Marco: aquece leads frios com storytelling",
      "Renata: cria desejo com prova social e escassez",
      "Vitor: fecha objeções com argumentos precisos",
      "Clara: cuida de quem quase saiu do funil",
    ],
  },
];

function FeatureCard({ area, onNavigate }: { area: FeatureArea; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = area.icon;

  return (
    <div
      className={`border transition-all duration-300 cursor-pointer ${
        expanded ? "border-primary/40 bg-card/40" : "border-border/25 bg-card/15 hover:border-border/50 hover:bg-card/25"
      }`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full border border-border/30 bg-card/30 flex items-center justify-center shrink-0">
          <Icon className={`h-4 w-4 ${area.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-mono text-[9px] font-bold uppercase tracking-widest ${area.color} opacity-70`}>
              {area.badge}
            </span>
          </div>
          <div className="font-mono text-[13px] font-bold text-foreground/90 leading-tight">
            {area.title}
          </div>
          <p className={`font-mono text-[11px] text-muted-foreground/60 leading-relaxed mt-1 ${expanded ? "" : "line-clamp-2"}`}>
            {area.desire}
          </p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground/30 shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
      </div>

      {expanded && (
        <div
          className="border-t border-border/20 px-4 pb-4 pt-3"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start gap-2 mb-3 bg-success/5 border border-success/20 p-2.5">
            <Star className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <p className="font-mono text-[11px] text-success/80 leading-relaxed font-bold">
              {area.realized}
            </p>
          </div>
          <div className="space-y-1.5 mb-4">
            {area.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-primary/50 shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] text-foreground/60 leading-relaxed">{b}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => onNavigate(area.path)}
            size="sm"
            className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary gap-2 h-9"
          >
            {area.action}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Welcome() {
  const { user, plan } = useAuth();
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"hero" | "features">("hero");

  const firstName = user?.name?.split(" ")[0] ?? "você";
  const planName = plan?.name ?? "NexOS";

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleNavigate(path: string) {
    markWelcomeSeen();
    setLocation(path);
  }

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
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
            Acesso {planName} · Ativo agora
          </span>
        </div>
      </div>

      {phase === "hero" ? (
        /* ══════════════ FASE 1: HERO EMOCIONAL ══════════════ */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto w-full">

          {/* Badge */}
          <div className="flex items-center gap-2 mb-8">
            <Rocket className="h-4 w-4 text-primary animate-bounce" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
              Decisão tomada · Operação iniciada
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-mono font-black text-3xl md:text-5xl uppercase tracking-tight text-foreground text-center mb-6 leading-tight">
            {firstName},<br />
            <span className="text-primary">você mudou de nível.</span>
          </h1>

          {/* Mensagem principal */}
          <div className="border border-border/40 bg-card/30 p-6 md:p-8 mb-8 w-full relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/50" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/50" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/50" />
            <p className="font-mono text-sm md:text-base text-foreground/80 leading-relaxed text-center mb-4">
              A partir de hoje, você não está mais tentando fazer tudo sozinho.
            </p>
            <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed text-center mb-4">
              Estrategistas lentos, copies fracas, automações complicadas, tráfego sem resultado,
              lançamentos confusos — <span className="text-foreground font-bold">isso foi ontem.</span>
            </p>
            <p className="font-mono text-sm text-foreground/80 leading-relaxed text-center font-bold">
              Agora você tem 34 especialistas trabalhando pelo seu lançamento. 24 horas por dia.
              Sem folga. Sem fatura mensal. Sem ego.
            </p>
          </div>

          {/* 3 vitórias imediatas */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            {[
              { icon: Zap,      text: "Campanha completa montada em minutos, não semanas" },
              { icon: Shield,   text: "Compliance e copy verificados automaticamente" },
              { icon: BarChart2, text: "Métricas ao vivo com IA otimizando em tempo real" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2 border border-success/20 bg-success/5 px-3 py-3">
                <Icon className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] text-success/80 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setPhase("features")}
              className="rounded-none font-mono uppercase tracking-widest font-black gap-3 btn-weapon-primary h-14 px-10 text-sm"
            >
              <Target className="h-4 w-4" />
              Ver o que tenho agora
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleContinue}
              className="rounded-none font-mono uppercase tracking-widest font-black gap-2 h-14 px-8 text-sm border-border/40"
            >
              <Rocket className="h-4 w-4" />
              Começar onboarding
            </Button>
          </div>

          <p className="font-mono text-[11px] text-muted-foreground/30 mt-4 text-center">
            Leva menos de 5 minutos · Você pode continuar depois
          </p>
        </div>
      ) : (
        /* ══════════════ FASE 2: TOUR DE DESEJO ══════════════ */
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">

          {/* Sub-header */}
          <div className="text-center mb-8">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 mb-2">
              Tudo que você agora tem acesso
            </p>
            <h2 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground">
              Cada área, uma <span className="text-primary">vitória desbloqueada.</span>
            </h2>
            <p className="font-mono text-sm text-muted-foreground/50 mt-2">
              Clique em qualquer área para entender o que ela entrega para você — e acesse agora mesmo.
            </p>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { icon: Bot,      value: "34",   label: "Agentes IA" },
              { icon: Users,    value: "24/7",  label: "Disponíveis" },
              { icon: Zap,      value: "3x",    label: "Mais rápido" },
              { icon: ShoppingCart, value: "0",  label: "Risco de execução" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="border border-border/25 bg-card/15 p-3 text-center">
                <Icon className="h-4 w-4 text-primary/50 mx-auto mb-1" />
                <div className="font-mono font-black text-lg text-foreground/90">{value}</div>
                <div className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Feature areas grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-10">
            {FEATURE_AREAS.map(area => (
              <FeatureCard key={area.id} area={area} onNavigate={handleNavigate} />
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="border border-primary/20 bg-primary/5 p-6 text-center">
            <p className="font-mono text-sm font-bold text-foreground mb-1">
              Pronto para começar de verdade?
            </p>
            <p className="font-mono text-[11px] text-muted-foreground/50 mb-4">
              O onboarding vai entender profundamente o seu negócio e preparar
              sua primeira operação comercial sob medida.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleContinue}
                className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 px-8 text-sm"
              >
                <Rocket className="h-4 w-4" />
                Começar onboarding
              </Button>
              <Button
                variant="outline"
                onClick={() => handleNavigate("/campaigns/new")}
                className="rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 px-8 text-sm border-border/40"
              >
                <PlayCircle className="h-4 w-4" />
                Criar campanha direto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
