import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Zap, Target, Pen, Eye, ShoppingCart, Users, BarChart3,
  TrendingUp, Video, Star, Shield, Rocket, Megaphone, Globe, MessageCircle,
  ChevronRight, Bot, FileText, Radio, Mail, DollarSign, Layers,
  Cpu, Mic, Play, BarChart2, RefreshCw, Hash, Flame, AlertTriangle,
  Crosshair, Clock, BarChart, Scissors, Search, FlaskConical,
  Award, Camera, Repeat2, Sparkles, Filter, BookOpen, LineChart,
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
  isNew?: boolean;
}

const AGENTS: AgentDef[] = [
  // ── ESTRATÉGIA & COMANDO ──────────────────────────────────────────────────
  {
    role: "command", name: "Erick", tagline: "General das Operações",
    description: "Orquestra toda a operação de lançamento. Pensa estrategicamente sobre cada etapa e alinha todos os agentes para o objetivo final.",
    category: "Estratégia", provider: "Claude", icon: Rocket,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Orquestração", "Planejamento", "Coordenação", "Decisão"],
  },
  {
    role: "strategy", name: "Jefferson", tagline: "Arquiteto do Lançamento",
    description: "Cria estratégias de lançamento de 6 a 10 dígitos com base em dados, psicologia do consumidor e posicionamento de mercado.",
    category: "Estratégia", provider: "Claude", icon: Brain,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["PLF", "Big Domino", "Narrativa", "Concorrência"],
  },
  {
    role: "launch_manager", name: "Ryan", tagline: "Coordenador de Fases",
    description: "Coordena cada fase do lançamento com precisão milimétrica. Domina sequências PLF, semente, interno e externo.",
    category: "Estratégia", provider: "Claude", icon: Zap,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["PLF", "Cronograma", "Fases", "Execução"],
  },
  {
    role: "offer", name: "Alexandre", tagline: "Arquiteto de Ofertas",
    description: "Constrói ofertas irresistíveis com stack de bônus, garantias inversas, pricing psicológico e ancoragem de valor.",
    category: "Estratégia", provider: "Claude", icon: ShoppingCart,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Pricing", "Bônus", "Garantia", "Posicionamento"],
  },
  {
    role: "product_builder", name: "Danny", tagline: "Descobridor de Produtos",
    description: "Descobre e refina produtos digitais de alto valor percebido. Transforma expertise em produto escalável e lucrativo.",
    category: "Estratégia", provider: "Claude", icon: Star,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Validação", "Formato", "Escopo", "Precificação"],
  },
  {
    role: "perpetual_launch_manager", name: "Francisco", tagline: "Motor de Vendas 24/7",
    description: "Gerencia lançamentos perpétuos com evergreen funnels, otimização contínua e automações de nurturing de longo prazo.",
    category: "Estratégia", provider: "Claude", icon: RefreshCw,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Evergreen", "Funil Perpétuo", "Automação", "LTV"],
  },
  {
    role: "market_intel", name: "Albert", tagline: "Desmontador de Concorrentes",
    description: "Engenharia reversa de estratégias de concorrentes, mapeamento de gaps de posicionamento e identificação de arbitragens de plataforma, conteúdo e preço.",
    category: "Estratégia", provider: "Claude", icon: Search,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Concorrência", "Gaps", "Arbitragem", "Posicionamento"],
    isNew: true,
  },
  {
    role: "pricing_psychologist", name: "Roberto", tagline: "Arquiteto de Valor",
    description: "Otimiza precificação com ancoragem, efeito decoy, psicologia de parcelamento e value stack. Projeta a garantia como acelerador de conversão.",
    category: "Estratégia", provider: "Claude", icon: DollarSign,
    accent: "border-primary/40 hover:border-primary",
    specialties: ["Ancoragem", "Decoy", "Parcelamento", "Value Stack"],
    isNew: true,
  },

  // ── COPYWRITING & CONTEÚDO ────────────────────────────────────────────────
  {
    role: "copywriter", name: "Gary", tagline: "Mestre das Palavras",
    description: "Escreve copy de venda que converte. Domina AIDA, PAS, storytelling emocional, emails, páginas e scripts.",
    category: "Conteúdo", provider: "GPT-4o", icon: Pen,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["VSL Copy", "Email", "Anúncios", "Headline"],
  },
  {
    role: "creative_director", name: "David", tagline: "Arquiteto Visual",
    description: "Define identidade visual, branding e direção criativa completa. Paleta de cores, tipografia, fotografia e componentes.",
    category: "Conteúdo", provider: "GPT-4o", icon: Eye,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Branding", "Visual", "Tipografia", "Paleta"],
  },
  {
    role: "landing_page", name: "Russell", tagline: "Especialista em Conversão",
    description: "Cria páginas de captura e vendas que convertem. Estrutura VSL page, copy acima do fold, CTAs e redução de atrito.",
    category: "Conteúdo", provider: "GPT-4o", icon: Globe,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["VSL Page", "Squeeze Page", "Copy", "UX"],
  },
  {
    role: "ad_copy", name: "Carlton", tagline: "Criativo de Performance",
    description: "Cria copies de anúncios que param o scroll. Especialista em headlines de impacto, ganchos e CTAs para Meta Ads e Google Ads.",
    category: "Conteúdo", provider: "GPT-4o", icon: Megaphone,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Meta Ads", "Google Ads", "Hook", "CTA"],
  },
  {
    role: "social_media", name: "Garry", tagline: "Calendário de Conteúdo",
    description: "Cria calendários completos de conteúdo para Instagram, TikTok, YouTube e Facebook. Captions, hashtags e estratégia de engajamento.",
    category: "Conteúdo", provider: "GPT-4o", icon: Hash,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Instagram", "TikTok", "YouTube", "Calendário"],
  },
  {
    role: "stories_sequence", name: "Donald", tagline: "Narrativa em Frames",
    description: "Cria roteiros completos de stories para lançamento — sequência narrativa com ganchos, revelações e chamadas para ação.",
    category: "Conteúdo", provider: "GPT-4o", icon: Layers,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Stories", "Narrativa", "Instagram", "Sequência"],
  },
  {
    role: "hook_factory", name: "Jonah", tagline: "Fábrica de Ganchos",
    description: "Gera 20+ hooks calibrados por plataforma, avatar e tipo (curiosidade, identidade, controvérsia, resultado, método). Os primeiros 3 segundos que param o scroll.",
    category: "Conteúdo", provider: "GPT-4o", icon: Flame,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["TikTok", "Reels", "CTR", "Pattern Interrupt"],
    isNew: true,
  },
  {
    role: "objection_killer", name: "Jordan", tagline: "Destruidor de Objeções",
    description: "Mapeia sistematicamente cada objeção do avatar, identifica o medo subjacente real e gera copy de inoculação — você levanta a objeção antes que o prospect a use.",
    category: "Conteúdo", provider: "Claude", icon: Crosshair,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Inoculação", "Preço", "Confiança", "Timing"],
    isNew: true,
  },
  {
    role: "email_architect", name: "André", tagline: "Arquiteto de Sequências",
    description: "Projeta sequências completas de email com arco narrativo: do indiferente ao comprador. Bodys completos por fase, subjects e previews calibrados.",
    category: "Conteúdo", provider: "Claude", icon: Mail,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Sequência", "Open Rate", "Narrativa", "Segmentação"],
    isNew: true,
  },
  {
    role: "content_calendar", name: "Joseph", tagline: "Jornada de 30 Dias",
    description: "Cria calendários narrativos de lançamento: cada post tem papel específico na mudança de estado do lead. Captions completas, conceitos visuais e calendário de produção.",
    category: "Conteúdo", provider: "GPT-4o", icon: BookOpen,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["30 Dias", "Orgânico", "Narrativa", "Produção"],
    isNew: true,
  },
  {
    role: "scarcity_engineer", name: "Dean", tagline: "Engenheiro de Urgência",
    description: "Projeta mecanismos de escassez autêntica e urgência que convertem. Diferencia escassez real de falsa (que destrói credibilidade) e entrega o copy de fechamento por fase.",
    category: "Conteúdo", provider: "Claude", icon: Clock,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Urgência", "Autenticidade", "Fechamento", "Deadline"],
    isNew: true,
  },
  {
    role: "testimonial_curator", name: "Jay", tagline: "Arquiteto de Credibilidade",
    description: "Projeta estratégia completa de prova social: o que coletar, como pedir, onde colocar. Cada depoimento mapeado a uma objeção específica.",
    category: "Conteúdo", provider: "Claude", icon: Award,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Depoimentos", "Casos", "UGC", "Credibilidade"],
    isNew: true,
  },

  // ── AUDIÊNCIA & MÍDIA ─────────────────────────────────────────────────────
  {
    role: "targeting", name: "Perry", tagline: "Caçador de Públicos",
    description: "Encontra os públicos certos nas plataformas certas. Cria arquiteturas de segmentação precisas: interesses, comportamentos e lookalikes.",
    category: "Audiência", provider: "GPT-4o", icon: Target,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Meta Ads", "Lookalike", "Interesses", "Comportamento"],
  },
  {
    role: "media_buyer", name: "Nicholas", tagline: "Maximizador de ROAS",
    description: "Maximiza ROAS em Meta Ads, Google Ads, TikTok e YouTube. Estrutura de campanha, criativos e otimização de budget.",
    category: "Audiência", provider: "GPT-4o", icon: BarChart2,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["ROAS", "Budget", "Criativos", "Escala"],
  },
  {
    role: "affiliate_campaign", name: "Stuart", tagline: "Multiplicador de Alcance",
    description: "Estrutura programas de afiliados para explosão de alcance. Comissionamento, materiais de apoio e reativação.",
    category: "Audiência", provider: "GPT-4o", icon: Users,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Comissão", "Materiais", "Reativação", "Escala"],
  },
  {
    role: "media_brief", name: "Andrew", tagline: "Guia para o Time de Tráfego",
    description: "Gera briefs completos para o time de tráfego pago: objetivos, públicos, criativos, budgets e KPIs esperados por fase.",
    category: "Audiência", provider: "GPT-4o", icon: FileText,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Brief", "Criativos", "Budget", "KPIs"],
  },
  {
    role: "ad_critic", name: "Luke", tagline: "Juiz dos Criativos",
    description: "Avalia criativos antes de investir budget. Nota por dimensão (hook, clareza, CTA, fit, política), veredicto claro e reescrita do hook quando necessário.",
    category: "Audiência", provider: "GPT-4o", icon: Filter,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Hook Score", "Política", "CTR", "Veredicto"],
    isNew: true,
  },
  {
    role: "reengagement", name: "Leandro", tagline: "Ressuscitador de Leads",
    description: "Reativa audiências frias segmentadas por razão de frieza. Projeta ângulos específicos para cada grupo e sequências de win-back que funcionam de verdade.",
    category: "Audiência", provider: "Claude", icon: Repeat2,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Leads Frios", "Win-Back", "Segmentação", "Ângulos"],
    isNew: true,
  },
  {
    role: "organic_traffic", name: "Marcus", tagline: "Especialista de Tráfego Orgânico",
    description: "Opera 24h preparando audiências, crescendo seguidores e construindo o ativo que tráfego pago não compra: confiança real. Domina algoritmos de Instagram, TikTok, YouTube e Facebook simultaneamente.",
    category: "Audiência", provider: "GPT-4o", icon: TrendingUp,
    accent: "border-yellow-500/40 hover:border-yellow-500",
    specialties: ["Algoritmo", "Seguidores", "Engajamento", "Pré-aquecimento"],
    isNew: true,
  },

  // ── VÍDEO & SCRIPTS ───────────────────────────────────────────────────────
  {
    role: "vsl_script", name: "Jon", tagline: "Script de Alta Conversão",
    description: "Escreve roteiros completos de VSL (Video Sales Letter) com estrutura AIDA, provas sociais e fechamento irresistível.",
    category: "Vídeo", provider: "GPT-4o", icon: Video,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["VSL", "AIDA", "Storytelling", "Fechamento"],
  },
  {
    role: "cpl_script", name: "Conrado", tagline: "Conteúdo de Pré-Lançamento",
    description: "Roteiros para vídeos CPL (Conteúdo de Pré-Lançamento) com educação, autoridade e antecipação progressiva.",
    category: "Vídeo", provider: "GPT-4o", icon: Play,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["CPL", "Pré-Lançamento", "Educação", "Antecipação"],
  },
  {
    role: "webinar_script", name: "Jason", tagline: "Apresentação de Vendas",
    description: "Roteiros completos para webinários de venda — estrutura de apresentação, slides, transição para oferta e Q&A estratégico.",
    category: "Vídeo", provider: "GPT-4o", icon: Mic,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Webinar", "Slides", "Pitch", "Q&A"],
  },
  {
    role: "live_script", name: "Grant", tagline: "Venda ao Vivo",
    description: "Roteiros para lives de lançamento — abertura de impacto, entrega de valor, quebra de objeções e fechamento ao vivo.",
    category: "Vídeo", provider: "GPT-4o", icon: Radio,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Live", "Abertura", "Objeções", "Fechamento"],
  },
  {
    role: "video_strategy", name: "Blake", tagline: "Arquitetura do Vídeo",
    description: "Define a estratégia completa de vídeo para o lançamento: quais vídeos produzir, sequência, duração e objetivo de cada um.",
    category: "Vídeo", provider: "Claude", icon: Cpu,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Estratégia", "Sequência", "YouTube", "Orgânico"],
  },
  {
    role: "creator_growth", name: "Ali", tagline: "Monetização de Audiência",
    description: "Estratégias para creators monetizarem sua audiência — lançamentos, membros, produtos derivados e crescimento de canal.",
    category: "Vídeo", provider: "Claude", icon: TrendingUp,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Criadores", "Monetização", "Membros", "Crescimento"],
  },
  {
    role: "video_hook", name: "Alex", tagline: "Primeiros 3 Segundos",
    description: "Gera 15+ hooks de vídeo calibrados por plataforma — frame zero, gancho verbal, texto na tela e conceito de filmagem. Pensa como o algoritmo e como o avatar.",
    category: "Vídeo", provider: "GPT-4o", icon: Camera,
    accent: "border-purple-500/40 hover:border-purple-500",
    specialties: ["Frame Zero", "Stop Rate", "TikTok", "Reels"],
    isNew: true,
  },

  // ── PERFORMANCE & ANALYTICS ───────────────────────────────────────────────
  {
    role: "analytics", name: "Avinash", tagline: "Intérprete dos Números",
    description: "Analisa métricas de campanha em profundidade. Identifica o que está funcionando, o que travar e onde está o dinheiro.",
    category: "Analytics", provider: "Gemini", icon: BarChart3,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Métricas", "ROAS", "CAC", "LTV"],
  },
  {
    role: "optimization", name: "Bryan", tagline: "Motor de Melhoria Contínua",
    description: "Detecta gargalos de conversão e sugere otimizações em tempo real. Prioriza ações de maior impacto no resultado.",
    category: "Analytics", provider: "Gemini", icon: TrendingUp,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Conversão", "A/B", "Funil", "Otimização"],
  },
  {
    role: "financial_projector", name: "Chet", tagline: "Simulador de Resultados",
    description: "Projeta receita esperada, break-even, ROI e fluxo de caixa do lançamento com base no histórico e benchmarks do mercado.",
    category: "Analytics", provider: "Gemini", icon: LineChart,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Projeção", "ROI", "Break-even", "Fluxo de Caixa"],
  },
  {
    role: "compliance", name: "Philip", tagline: "Guardião da Conformidade",
    description: "Verifica conformidade com LGPD, CONAR, regulamentos de publicidade digital e políticas das plataformas.",
    category: "Analytics", provider: "Gemini", icon: Shield,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["LGPD", "CONAR", "Políticas", "Risco"],
  },
  {
    role: "ab_test_designer", name: "Tim", tagline: "Cientista do Marketing",
    description: "Projeta experimentos com hipóteses rigorosas, tamanhos de amostra calculados e métricas corretas. Marketing tratado como ciência.",
    category: "Analytics", provider: "Gemini", icon: FlaskConical,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Hipóteses", "Amostragem", "Métricas", "Significância"],
    isNew: true,
  },
  {
    role: "launch_debriefing", name: "Noah", tagline: "Analista Pós-Lançamento",
    description: "Análise pós-lançamento brutalmente honesta: o que funcionou, o que falhou, causa raiz real e aprendizados institucionalizáveis para o próximo.",
    category: "Analytics", provider: "Gemini", icon: BarChart,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Causa Raiz", "Aprendizados", "ROAS", "Benchmark"],
    isNew: true,
  },
  {
    role: "crisis_response", name: "Peter", tagline: "Resposta em 2 Horas",
    description: "Protocolo completo para crises de reputação: avaliação de severidade, ações imediatas, declarações públicas prontas e plano de recuperação de 30 dias.",
    category: "Analytics", provider: "Claude", icon: AlertTriangle,
    accent: "border-green-500/40 hover:border-green-500",
    specialties: ["Velocidade", "Reputação", "Declarações", "Recuperação"],
    isNew: true,
  },

  // ── AUTOMAÇÃO & MONETIZAÇÃO ───────────────────────────────────────────────
  {
    role: "launch_sequence_builder", name: "Chris", tagline: "Arquiteto de Automações",
    description: "Cria sequências completas de lançamento com email + WhatsApp — fases, timing, mensagens e segmentação por engajamento.",
    category: "Automação", provider: "Claude", icon: Mail,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["Sequência", "Email", "WhatsApp", "Automação"],
  },
  {
    role: "continuous_sales_manager", name: "Aaron", tagline: "Receita Previsível",
    description: "Gerencia o ciclo de vendas contínuas pós-lançamento — nurturing, recompra, upsell e expansão de LTV.",
    category: "Automação", provider: "Claude", icon: RefreshCw,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["Nurturing", "Recompra", "Upsell", "LTV"],
  },
  {
    role: "whatsapp_response", name: "Neil", tagline: "Atendimento Inteligente",
    description: "Classifica mensagens recebidas no WhatsApp e gera respostas contextuais. Detecta intenção de compra, objeções e urgências.",
    category: "Automação", provider: "Claude", icon: MessageCircle,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["WhatsApp", "Atendimento", "Intenção", "Auto-Resposta"],
  },
  {
    role: "upsell_architect", name: "Brad", tagline: "Motor de LTV",
    description: "Projeta order bumps, OTOs, downsells e cross-sells genuinamente úteis. Calcula impacto em LTV por 100 compradores e escreve o pitch completo de cada oferta.",
    category: "Automação", provider: "Claude", icon: Sparkles,
    accent: "border-orange-500/40 hover:border-orange-500",
    specialties: ["Order Bump", "OTO", "Downsell", "LTV"],
    isNew: true,
  },

  // ── MENTALIDADE & PERFORMANCE ─────────────────────────────────────────────
  {
    role: "mental_frequency_coach", name: "Viktor", tagline: "Engenheiro de Frequência Mental",
    description: "Diagnostica em qual das 4 Frequências Mentais você está operando e aplica protocolos de PNL de terceira geração para instalar progressivamente a Mente de Destino — obstinação cirúrgica, ciclo invertido e decreto inabalável.",
    category: "Mentalidade", provider: "Claude", icon: Brain,
    accent: "border-violet-500/40 hover:border-violet-500",
    specialties: ["4 Frequências", "PNL", "Obstinação", "Mente de Destino"],
    isNew: true,
  },
  {
    role: "identity_architect", name: "Nadia", tagline: "Arquiteta de Identidade",
    description: "Mapeia os metaprogramas dominantes que sabotam sua execução e reconstrói a identidade do empreendedor desvinculada dos resultados. Especialista em estabilização hormonal e colapso de âncoras.",
    category: "Mentalidade", provider: "Claude", icon: Crosshair,
    accent: "border-violet-500/40 hover:border-violet-500",
    specialties: ["Metaprogramas", "Identidade", "Âncoras", "PNL"],
    isNew: true,
  },
  {
    role: "obstinacy_trainer", name: "Krav", tagline: "Instrutor de Obstinação",
    description: "Sessões de treino ativo de obstinação — desafios progressivos de execução, confronto de objeções internas e instalação da Ponte ao Futuro Reversa. Treina você a perseguir conquistas com a frieza de quem já sabe o resultado.",
    category: "Mentalidade", provider: "Claude", icon: Flame,
    accent: "border-violet-500/40 hover:border-violet-500",
    specialties: ["Obstinação", "Execução", "Treino", "Frequência 4"],
    isNew: true,
  },

  // ── TIME DE VENDAS ────────────────────────────────────────────────────────
  {
    role: "sales_warmer", name: "Marco", tagline: "Especialista em Aquecimento",
    description: "Conduz a primeira abordagem com o lead usando o protocolo PLF + Daniel Godri. Cria rapport, agita o problema e planta curiosidade genuína antes de qualquer pitch.",
    category: "Vendas", provider: "Claude", icon: Flame,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["PLF", "Rapport", "Godri", "Warming"],
    isNew: true,
  },
  {
    role: "sales_desire", name: "Renata", tagline: "Especialista em Desejo",
    description: "Cria ancoragem profunda de valor antes de revelar o preço. Usa Dale Carnegie para espelhar os sonhos do lead e conectar cada funcionalidade ao problema específico dele.",
    category: "Vendas", provider: "Claude", icon: Sparkles,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Carnegie", "Ancoragem", "Valor", "Desejo"],
    isNew: true,
  },
  {
    role: "sales_closer", name: "Vitor", tagline: "Especialista em Fechamento",
    description: "Opera no momento decisivo do funil com protocolo PLF de carrinho. Usa custo de inação como alavanca principal e sempre define o próximo passo com clareza.",
    category: "Vendas", provider: "Claude", icon: Target,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["PLF", "Fechamento", "Urgência", "Escassez"],
    isNew: true,
  },
  {
    role: "sales_objection", name: "Clara", tagline: "Quebradora de Objeções",
    description: "Especialista no framework ACR (Acknowledge → Challenge → Redirect). Tem respostas precisas para as 7 objeções mais comuns de SaaS e produto digital.",
    category: "Vendas", provider: "Claude", icon: Shield,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Objeções", "ACR", "Técnica", "Conversão"],
    isNew: true,
  },
  {
    role: "sales_consultant", name: "Alex", tagline: "Consultor NexOS AI",
    description: "Especialista técnico e comercial completo: conhece cada funcionalidade, plano, caso de uso e integração. Responde dúvidas com precisão e transforma informação em confiança.",
    category: "Vendas", provider: "Claude", icon: Bot,
    accent: "border-cyan-500/40 hover:border-cyan-500",
    specialties: ["Produto", "Técnico", "Comercial", "Consultoria"],
    isNew: true,
  },
];

const CATEGORIES = ["Todos", "Estratégia", "Conteúdo", "Audiência", "Vídeo", "Analytics", "Automação", "Mentalidade", "Vendas"];

const PROVIDER_COLOR: Record<string, string> = {
  "Claude":  "text-orange-400 border-orange-400/30 bg-orange-400/8",
  "GPT-4o":  "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
  "Gemini":  "text-green-400 border-green-400/30 bg-green-400/8",
};

export default function AgentsHub() {
  const newCount = AGENTS.filter(a => a.isNew).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4 text-primary" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Hub de Agentes IA
          </h1>
          {newCount > 0 && (
            <Badge className="rounded-none font-mono text-[10px] bg-primary/15 text-primary border border-primary/30 px-2">
              +{newCount} novos
            </Badge>
          )}
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
          {AGENTS.length} agentes especializados · Framework ReAct (Reason + Act) · Claude · GPT-4o · Gemini
        </p>
      </div>

      {/* ReAct badge */}
      <div className="border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
        <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="font-mono text-xs font-bold text-primary uppercase tracking-widest">Framework ReAct Ativo</div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
            Cada agente opera no ciclo OBSERVE → REASON → ACT → OUTPUT. Além de gerar conteúdo, os agentes emitem diretivas de ação acionáveis (pausar criativos, escalar budget, disparar sequências, alertar humano) com confiança, urgência e parâmetros.
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
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
                  <Link key={agent.role} href={`/agents/${agent.role}`} className="block">
                    <div
                      className={`border bg-card/40 p-4 cursor-pointer transition-all group relative overflow-hidden h-full flex flex-col ${agent.accent}`}
                    >
                      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current/20 pointer-events-none" />
                      {agent.isNew && (
                        <div className="absolute top-2 right-2">
                          <span className="font-mono text-[9px] uppercase tracking-widest bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5">NOVO</span>
                        </div>
                      )}
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
                        {!agent.isNew && (
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 shrink-0 ${PROVIDER_COLOR[agent.provider]}`}>
                            {agent.provider}
                          </Badge>
                        )}
                      </div>

                      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-3 line-clamp-2 flex-1">
                        {agent.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.specialties.map(s => (
                          <span key={s} className="font-mono text-[10px] uppercase tracking-widest border border-border/30 bg-muted/10 px-1.5 py-0.5 text-muted-foreground/60">
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="w-full rounded-none font-mono uppercase text-[11px] tracking-widest border border-border/50 group-hover:border-primary/60 group-hover:text-primary text-muted-foreground transition-colors h-8 flex items-center justify-center gap-2 bg-card/20 group-hover:bg-primary/5">
                        Conversar com Agente
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
