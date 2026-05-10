import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Zap, Target, Pen, Eye, ShoppingCart, Users, BarChart3,
  TrendingUp, Video, Star, Shield, Rocket, Megaphone, Globe, MessageCircle,
  ChevronRight, Bot,
} from "lucide-react";

// ── Agent catalog ─────────────────────────────────────────────────────────────
interface AgentDef {
  role: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  provider: "Claude" | "GPT-4o" | "Gemini";
  specialties: string[];
  icon: React.ElementType;
  accent: string;
}

const AGENTS: AgentDef[] = [
  // ESTRATÉGIA & COMANDO
  {
    role: "command", name: "Comandante IA", tagline: "General das Operações",
    description: "Orquestra toda a operação de lançamento. Pensa estrategicamente sobre cada etapa e alinha todos os agentes para o objetivo final.",
    category: "Estratégia", provider: "Claude", icon: Rocket,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Orquestração", "Planejamento", "Coordenação", "Decisão"],
  },
  {
    role: "strategy", name: "Estrategista", tagline: "Arquiteto do Lançamento",
    description: "Cria estratégias de lançamento de 6 a 10 dígitos com base em dados, psicologia do consumidor e posicionamento de mercado.",
    category: "Estratégia", provider: "Claude", icon: Brain,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["PLF", "Posicionamento", "Narrativa", "Concorrência"],
  },
  {
    role: "launch_manager", name: "Gerente de Lançamento", tagline: "Coordenador de Fases",
    description: "Coordena cada fase do lançamento com precisão milimétrica. Domina sequências PLF, semente, interno e externo.",
    category: "Estratégia", provider: "Claude", icon: Zap,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["PLF", "Cronograma", "Fases", "Execução"],
  },
  {
    role: "offer", name: "Especialista em Oferta", tagline: "Arquiteto de Ofertas",
    description: "Constrói ofertas irresistíveis com stack de bônus, garantias inversas, pricing psicológico e ancoragem de valor.",
    category: "Estratégia", provider: "Claude", icon: ShoppingCart,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Pricing", "Bônus", "Garantia", "Posicionamento"],
  },
  {
    role: "product_builder", name: "Product Builder", tagline: "Descobridor de Produtos",
    description: "Descobre e refina produtos digitais de alto valor percebido. Transforma expertise em produto escalável e lucrativo.",
    category: "Estratégia", provider: "Claude", icon: Star,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Validação", "Formato", "Escopo", "Precificação"],
  },
  // COPYWRITING & CONTEÚDO
  {
    role: "copywriter", name: "Copywriter", tagline: "Mestre das Palavras",
    description: "Escreve copy de venda que converte. Domina AIDA, PAS, storytelling emocional, emails, páginas e scripts.",
    category: "Conteúdo", provider: "GPT-4o", icon: Pen,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["VSL Copy", "Email", "Anúncios", "Headline"],
  },
  {
    role: "creative_director", name: "Diretor Criativo", tagline: "Arquiteto Visual",
    description: "Define identidade visual, branding e direção criativa completa. Paleta de cores, tipografia, fotografia e componentes.",
    category: "Conteúdo", provider: "GPT-4o", icon: Eye,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Branding", "Visual", "Tipografia", "Paleta"],
  },
  {
    role: "landing_page", name: "Landing Page", tagline: "Especialista em Conversão",
    description: "Cria páginas de captura e vendas que convertem. Estrutura VSL page, copy acima do fold, CTAs e redução de atrito.",
    category: "Conteúdo", provider: "GPT-4o", icon: Globe,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["VSL Page", "Squeeze Page", "Copy", "UX"],
  },
  // AUDIÊNCIA & MÍDIA
  {
    role: "targeting", name: "Targeting Expert", tagline: "Caçador de Públicos",
    description: "Encontra os públicos certos nas plataformas certas. Cria arquiteturas de segmentação precisas: interesses, comportamentos e lookalikes.",
    category: "Audiência", provider: "GPT-4o", icon: Target,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Meta Ads", "Lookalike", "Interesses", "Comportamento"],
  },
  {
    role: "media_buyer", name: "Media Buyer", tagline: "Maximizador de ROAS",
    description: "Maximiza ROAS em Meta Ads, Google Ads, TikTok e YouTube. Estrutura de campanha, criativos e otimização de budget.",
    category: "Audiência", provider: "GPT-4o", icon: Megaphone,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["ROAS", "Budget", "Criativos", "Escala"],
  },
  {
    role: "affiliate_campaign", name: "Especialista em Afiliados", tagline: "Multiplicador de Alcance",
    description: "Estrutura programas de afiliados para explosão de alcance. Comissionamento, materiais de apoio e reativação.",
    category: "Audiência", provider: "GPT-4o", icon: Users,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Programa", "Comissão", "Materiais", "Ranking"],
  },
  // PERFORMANCE & ANÁLISE
  {
    role: "analytics", name: "Analista de Performance", tagline: "Intérprete de Dados",
    description: "Interpreta dados e extrai insights acionáveis. ROAS, CPL, LTV, cohort analysis e attribution modeling.",
    category: "Performance", provider: "Gemini", icon: BarChart3,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["KPIs", "ROAS", "CPL", "Funil"],
  },
  {
    role: "optimization", name: "Otimizador", tagline: "Motor de Melhoria Contínua",
    description: "Melhora continuamente resultados com testes estruturados. Identifica gargalos e implementa mudanças de alto impacto.",
    category: "Performance", provider: "Gemini", icon: TrendingUp,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["A/B Test", "Gargalos", "ROI", "Escala"],
  },
  {
    role: "video", name: "Estrategista de Vídeo", tagline: "Diretor de Conteúdo Visual",
    description: "Define estratégias de VSL, YouTube, Reels, TikTok e Lives. Scripts, hooks, estruturas narrativas e direção.",
    category: "Performance", provider: "Gemini", icon: Video,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["VSL", "Reels", "Lives", "YouTube"],
  },
  {
    role: "creator_growth", name: "Creator Growth", tagline: "Arquiteto de Audiência",
    description: "Cresce audiências orgânicas em Instagram, YouTube, TikTok e podcasts. Algoritmos, consistência e monetização.",
    category: "Performance", provider: "Gemini", icon: Star,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Instagram", "YouTube", "TikTok", "Orgânico"],
  },
  // QUALIDADE
  {
    role: "compliance", name: "Compliance Officer", tagline: "Guardião Legal",
    description: "Garante que seu lançamento não viola CONAR, Meta Ads Policy, Google Ads Policy, LGPD e CVM.",
    category: "Qualidade", provider: "Claude", icon: Shield,
    accent: "border-red-500/40 hover:border-red-500",
    specialties: ["CONAR", "Meta Policy", "LGPD", "CVM"],
  },
];

const CATEGORIES = ["Estratégia", "Conteúdo", "Audiência", "Performance", "Qualidade"];

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  Claude:  { label: "Claude",  className: "text-primary border-primary/40 bg-primary/10" },
  "GPT-4o": { label: "GPT-4o", className: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10" },
  Gemini:  { label: "Gemini",  className: "text-green-400 border-green-400/40 bg-green-400/10" },
};

export default function AgentsHub() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <h1 className="text-2xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Time de Especialistas IA
          </h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest max-w-2xl">
          {AGENTS.length} agentes especializados disponíveis para consulta individual · Brainstorm, revisão, estratégia e geração de conteúdo sob demanda
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Total Agentes", value: String(AGENTS.length), sub: "especialistas" },
          { label: "Claude AI", value: String(AGENTS.filter(a => a.provider === "Claude").length), sub: "estratégia" },
          { label: "GPT-4o", value: String(AGENTS.filter(a => a.provider === "GPT-4o").length), sub: "conteúdo" },
          { label: "Gemini", value: String(AGENTS.filter(a => a.provider === "Gemini").length), sub: "performance" },
          { label: "Créditos/msg", value: "3", sub: "custo fixo" },
        ].map((stat) => (
          <div key={stat.label} className="border border-border/50 bg-card/40 p-3">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{stat.label}</div>
            <div className="text-xl font-mono font-bold text-primary mt-0.5">{stat.value}</div>
            <div className="text-[11px] font-mono text-muted-foreground/50">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Agent grid by category */}
      {CATEGORIES.map((cat) => {
        const agents = AGENTS.filter(a => a.category === cat);
        if (agents.length === 0) return null;
        return (
          <div key={cat}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-border/40" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground px-3">{cat}</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => {
                const pBadge = PROVIDER_BADGE[agent.provider];
                return (
                  <Link key={agent.role} href={`/agents/${agent.role}`}>
                    <div className={`border bg-card/40 p-4 cursor-pointer transition-all duration-200 group relative overflow-hidden ${agent.accent}`}>
                      {/* Corners */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/20 group-hover:border-primary transition-colors" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/20 group-hover:border-primary transition-colors" />

                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 border border-primary/20 bg-primary/5 flex items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all">
                            <agent.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors uppercase tracking-wide">
                              {agent.name}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-widest">{agent.tagline}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0.5 shrink-0 border ${pBadge.className}`}>
                          {pBadge.label}
                        </Badge>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed mb-3 line-clamp-2">
                        {agent.description}
                      </p>

                      {/* Specialties */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.specialties.map(s => (
                          <span key={s} className="text-[11px] font-mono uppercase tracking-widest bg-muted/30 border border-border/50 px-1.5 py-0.5 text-muted-foreground/70">
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-3 w-3 text-primary/60" />
                          <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">3 créditos/msg</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-widest text-primary group-hover:gap-2 transition-all">
                          Conversar <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Bottom CTA */}
      <div className="border border-primary/20 bg-card/40 p-6 text-center">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
          Você também pode acionar agentes diretamente na execução de campanhas
        </p>
        <Link href="/campaigns">
          <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-5 text-xs mt-2">
            <Rocket className="h-3.5 w-3.5" />Ver Campanhas Ativas
          </Button>
        </Link>
      </div>
    </div>
  );
}
