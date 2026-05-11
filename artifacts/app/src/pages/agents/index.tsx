import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Zap, Target, Pen, Eye, ShoppingCart, Users, BarChart3,
  TrendingUp, Video, Star, Shield, Rocket, Megaphone, Globe, MessageCircle,
  ChevronRight, Bot, FileText, Radio, Mail, DollarSign, Layers,
  Cpu, Mic, Play, BarChart2, RefreshCw, Hash,
} from "lucide-react";

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
  // ── ESTRATÉGIA & COMANDO ──────────────────────────────────────────────────
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
  {
    role: "perpetual_launch_manager", name: "Gerente de Perpétuo", tagline: "Motor de Vendas 24/7",
    description: "Gerencia lançamentos perpétuos com evergreen funnels, otimização contínua e automações de nurturing de longo prazo.",
    category: "Estratégia", provider: "Claude", icon: RefreshCw,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Evergreen", "Funil Perpétuo", "Automação", "LTV"],
  },

  // ── COPYWRITING & CONTEÚDO ────────────────────────────────────────────────
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
  {
    role: "ad_copy", name: "Copy de Anúncios", tagline: "Criativo de Performance",
    description: "Cria copies de anúncios que param o scroll. Especialista em headlines de impacto, ganchos e CTAs para Meta Ads e Google Ads.",
    category: "Conteúdo", provider: "GPT-4o", icon: Megaphone,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Meta Ads", "Google Ads", "Hook", "CTA"],
  },
  {
    role: "social_media", name: "Social Media IA", tagline: "Calendário de Conteúdo",
    description: "Cria calendários completos de conteúdo para Instagram, TikTok, YouTube e Facebook. Captions, hashtags e estratégia de engajamento.",
    category: "Conteúdo", provider: "GPT-4o", icon: Hash,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Instagram", "TikTok", "YouTube", "Calendário"],
  },
  {
    role: "stories_sequence", name: "Sequência de Stories", tagline: "Narrativa em Frames",
    description: "Cria roteiros completos de stories para lançamento — sequência narrativa com ganchos, revelações e chamadas para ação.",
    category: "Conteúdo", provider: "GPT-4o", icon: Layers,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Stories", "Narrativa", "Instagram", "Sequência"],
  },

  // ── AUDIÊNCIA & MÍDIA ─────────────────────────────────────────────────────
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
    category: "Audiência", provider: "GPT-4o", icon: BarChart2,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["ROAS", "Budget", "Criativos", "Escala"],
  },
  {
    role: "affiliate_campaign", name: "Especialista em Afiliados", tagline: "Multiplicador de Alcance",
    description: "Estrutura programas de afiliados para explosão de alcance. Comissionamento, materiais de apoio e reativação.",
    category: "Audiência", provider: "GPT-4o", icon: Users,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Comissão", "Materiais", "Reativação", "Escala"],
  },
  {
    role: "media_brief", name: "Brief de Mídia", tagline: "Guia para o Time de Tráfego",
    description: "Gera briefs completos para o time de tráfego pago: objetivos, públicos, criativos, budgets e KPIs esperados por fase.",
    category: "Audiência", provider: "GPT-4o", icon: FileText,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Brief", "Criativos", "Budget", "KPIs"],
  },

  // ── VÍDEO & SCRIPTS ───────────────────────────────────────────────────────
  {
    role: "vsl_script", name: "Roteirista VSL", tagline: "Script de Alta Conversão",
    description: "Escreve roteiros completos de VSL (Video Sales Letter) com estrutura AIDA, provas sociais e fechamento irresistível.",
    category: "Vídeo", provider: "GPT-4o", icon: Video,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["VSL", "AIDA", "Storytelling", "Fechamento"],
  },
  {
    role: "cpl_script", name: "Script CPL", tagline: "Conteúdo de Pré-Lançamento",
    description: "Roteiros para vídeos CPL (Conteúdo de Pré-Lançamento) com educação, autoridade e antecipação progressiva.",
    category: "Vídeo", provider: "GPT-4o", icon: Play,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["CPL", "Pré-Lançamento", "Educação", "Antecipação"],
  },
  {
    role: "webinar_script", name: "Roteirista Webinar", tagline: "Apresentação de Vendas",
    description: "Roteiros completos para webinários de venda — estrutura de apresentação, slides, transição para oferta e Q&A estratégico.",
    category: "Vídeo", provider: "GPT-4o", icon: Mic,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Webinar", "Slides", "Pitch", "Q&A"],
  },
  {
    role: "live_script", name: "Roteirista de Live", tagline: "Venda ao Vivo",
    description: "Roteiros para lives de lançamento — abertura de impacto, entrega de valor, quebra de objeções e fechamento ao vivo.",
    category: "Vídeo", provider: "GPT-4o", icon: Radio,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Live", "Abertura", "Objeções", "Fechamento"],
  },
  {
    role: "video_strategy", name: "Estrategista de Vídeo", tagline: "Arquitetura do Conteúdo em Vídeo",
    description: "Define a estratégia completa de vídeo para o lançamento: quais vídeos produzir, sequência, duração e objetivo de cada um.",
    category: "Vídeo", provider: "Claude", icon: Cpu,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Estratégia", "Sequência", "YouTube", "Orgânico"],
  },
  {
    role: "creator_growth", name: "Creator Growth", tagline: "Monetização de Audiência",
    description: "Estratégias para creators monetizarem sua audiência — lançamentos, membros, produtos derivados e crescimento de canal.",
    category: "Vídeo", provider: "Claude", icon: TrendingUp,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Criadores", "Monetização", "Membros", "Crescimento"],
  },

  // ── PERFORMANCE & ANALYTICS ───────────────────────────────────────────────
  {
    role: "analytics", name: "Analista de Performance", tagline: "Intérprete dos Números",
    description: "Analisa métricas de campanha em profundidade. Identifica o que está funcionando, o que travar e onde está o dinheiro.",
    category: "Analytics", provider: "Gemini", icon: BarChart3,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Métricas", "ROAS", "CAC", "LTV"],
  },
  {
    role: "optimization", name: "Otimizador IA", tagline: "Motor de Melhoria Contínua",
    description: "Detecta gargalos de conversão e sugere otimizações em tempo real. Prioriza ações de maior impacto no resultado.",
    category: "Analytics", provider: "Gemini", icon: TrendingUp,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Conversão", "A/B", "Funil", "Otimização"],
  },
  {
    role: "financial_projector", name: "Projetor Financeiro", tagline: "Simulador de Resultados",
    description: "Projeta receita esperada, break-even, ROI e fluxo de caixa do lançamento com base no histórico e benchmarks do mercado.",
    category: "Analytics", provider: "Gemini", icon: DollarSign,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Projeção", "ROI", "Break-even", "Fluxo de Caixa"],
  },
  {
    role: "compliance", name: "Compliance Officer", tagline: "Guardião da Conformidade",
    description: "Verifica conformidade com LGPD, CONAR, regulamentos de publicidade digital e políticas das plataformas.",
    category: "Analytics", provider: "Gemini", icon: Shield,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["LGPD", "CONAR", "Políticas", "Risco"],
  },

  // ── AUTOMAÇÃO ────────────────────────────────────────────────────────────
  {
    role: "launch_sequence_builder", name: "Builder de Sequências", tagline: "Arquiteto de Automações",
    description: "Cria sequências completas de lançamento com email + WhatsApp — fases, timing, mensagens e segmentação por engajamento.",
    category: "Automação", provider: "Claude", icon: Mail,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["Sequência", "Email", "WhatsApp", "Automação"],
  },
  {
    role: "continuous_sales_manager", name: "Gestor de Vendas Contínuas", tagline: "Receita Previsível",
    description: "Gerencia o ciclo de vendas contínuas pós-lançamento — nurturing, recompra, upsell e expansão de LTV.",
    category: "Automação", provider: "Claude", icon: RefreshCw,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["Nurturing", "Recompra", "Upsell", "LTV"],
  },
  {
    role: "whatsapp_response", name: "Auto-Resposta WhatsApp", tagline: "Atendimento Inteligente",
    description: "Classifica mensagens recebidas no WhatsApp e gera respostas contextuais. Detecta intenção de compra, objeções e urgências.",
    category: "Automação", provider: "Claude", icon: MessageCircle,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["WhatsApp", "Atendimento", "Intenção", "Auto-Resposta"],
  },
];

const CATEGORIES = ["Todos", "Estratégia", "Conteúdo", "Audiência", "Vídeo", "Analytics", "Automação"];

const PROVIDER_COLOR: Record<string, string> = {
  "Claude":  "text-orange-400 border-orange-400/30 bg-orange-400/8",
  "GPT-4o":  "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
  "Gemini":  "text-green-400 border-green-400/30 bg-green-400/8",
};

export default function AgentsHub() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4 text-primary" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Hub de Agentes IA
          </h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
          {AGENTS.length} agentes especializados · Claude · GPT-4o · Gemini · Cada agente, uma expertise
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(
          AGENTS.reduce((acc, a) => { acc[a.category] = (acc[a.category] ?? 0) + 1; return acc; }, {} as Record<string, number>)
        ).map(([cat, n]) => (
          <div key={cat} className="border border-border/30 bg-card/30 p-2.5 text-center">
            <div className="font-mono text-xs font-bold text-primary">{n}</div>
            <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-0.5 truncate">{cat}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {CATEGORIES.filter(c => c !== "Todos").map(category => {
        const agents = AGENTS.filter(a => a.category === category);
        return (
          <div key={category}>
            <div className="flex items-center gap-3 mb-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 font-bold">{category}</div>
              <div className="flex-1 h-px bg-border/30" />
              <div className="font-mono text-[11px] text-muted-foreground/40">{agents.length} agentes</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map(agent => {
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.role}
                    className={`border bg-card/40 p-4 cursor-pointer transition-all group relative overflow-hidden ${agent.accent}`}
                  >
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current/20 pointer-events-none" />
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 border border-border/30 bg-muted/20">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
                            {agent.name}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground/60">{agent.tagline}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 shrink-0 ${PROVIDER_COLOR[agent.provider]}`}>
                        {agent.provider}
                      </Badge>
                    </div>

                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                      {agent.description}
                    </p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.specialties.map(s => (
                        <span key={s} className="font-mono text-[10px] uppercase tracking-widest border border-border/30 bg-muted/10 px-1.5 py-0.5 text-muted-foreground/60">
                          {s}
                        </span>
                      ))}
                    </div>

                    <Link href={`/agents/${agent.role}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-none font-mono uppercase text-[11px] tracking-widest btn-weapon-outline gap-2 group-hover:border-primary/50 group-hover:text-primary transition-colors h-8"
                      >
                        Conversar com Agente
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
