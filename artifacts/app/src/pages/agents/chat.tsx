import { useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoute, Link } from "wouter";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Loader2, Bot, Brain, Zap, Target, Pen, Eye,
  ShoppingCart, Users, BarChart3, TrendingUp, Video, Star,
  Shield, Rocket, Megaphone, Globe, RefreshCw, Download, CornerDownLeft,
  Mic, MicOff, Play, Radio, FileText, Hash, Mail, MessageCircle, DollarSign, Layers, Cpu,
  Paperclip, X, ImageIcon, File, ChevronDown, ChevronUp,
  Search, Sparkles, CheckCircle2, FileVideo, FileAudio, Camera,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";

// ── Agent catalog (must match backend) ───────────────────────────────────────
interface AgentInfo {
  name: string; tagline: string; description: string;
  provider: "Claude" | "GPT-4o" | "Gemini";
  icon: React.ElementType; accentColor: string;
  suggestions: string[];
}

const AGENT_INFO: Record<string, AgentInfo> = {
  command: { name: "Erick", tagline: "General das Operações", provider: "Claude", icon: Rocket, accentColor: "primary",
    description: "Orquestra toda a operação de lançamento com visão estratégica e execução impecável.",
    suggestions: ["Como devo estruturar meu próximo lançamento?", "Quais são os maiores erros em lançamentos de 6 dígitos?", "Monte um plano de 7 dias para meu lançamento", "Analise minha estratégia atual e aponte gargalos"] },
  strategy: { name: "Jefferson", tagline: "Arquiteto do Lançamento", provider: "Claude", icon: Brain, accentColor: "primary",
    description: "Cria estratégias de lançamento de 6 a 10 dígitos com base em dados e psicologia do consumidor.",
    suggestions: ["Como posicionar meu produto no mercado?", "Qual narrativa usar para meu avatar primário?", "Como me diferenciar da concorrência?", "Monte uma estratégia de lançamento semente para mim"] },
  launch_manager: { name: "Ryan", tagline: "Coordenador de Fases", provider: "Claude", icon: Zap, accentColor: "primary",
    description: "Coordena cada fase do lançamento com precisão milimétrica.",
    suggestions: ["Crie um cronograma de lançamento de 10 dias", "Quais CPLs devo publicar e quando?", "Como faço a transição do pré-lançamento para o carrinho?", "Monte uma timeline PLF completa para mim"] },
  offer: { name: "Alexandre", tagline: "Arquiteto de Ofertas", provider: "Claude", icon: ShoppingCart, accentColor: "primary",
    description: "Constrói ofertas irresistíveis com stack de bônus e pricing psicológico.",
    suggestions: ["Analise minha oferta e sugira melhorias", "Qual garantia mais converte no mercado brasileiro?", "Como montar um stack de bônus que justifique R$2.000?", "Como usar ancoragem de preço no meu lançamento?"] },
  product_builder: { name: "Danny", tagline: "Descobridor de Produtos", provider: "Claude", icon: Star, accentColor: "primary",
    description: "Descobre e refina produtos digitais de alto valor percebido.",
    suggestions: ["Tenho expertise em X, qual produto criar?", "Como validar minha ideia de curso antes de criar?", "Que formato de produto vende mais no Brasil?", "Como precificar meu infoproduto?"] },
  copywriter: { name: "Gary", tagline: "Mestre das Palavras", provider: "GPT-4o", icon: Pen, accentColor: "cyan",
    description: "Escreve copy de venda que converte. Domina AIDA, PAS e storytelling emocional.",
    suggestions: ["Escreva uma headline para meu produto", "Crie um email de pré-lançamento", "Escreva um script de VSL para meu produto", "Crie copy para anúncio de topo de funil"] },
  creative_director: { name: "David", tagline: "Arquiteto Visual", provider: "GPT-4o", icon: Eye, accentColor: "cyan",
    description: "Define identidade visual, branding e direção criativa completa.",
    suggestions: ["Crie um moodboard para meu produto premium", "Que paleta de cores usar para transmitir autoridade?", "Como fazer um branding que posicione como premium?", "Sugira tipografia para um produto de saúde"] },
  landing_page: { name: "Russell", tagline: "Especialista em Conversão", provider: "GPT-4o", icon: Globe, accentColor: "cyan",
    description: "Cria páginas de captura e vendas que convertem.",
    suggestions: ["Escreva a copy acima do fold da minha página de vendas", "Como estruturar uma VSL page que converte?", "Quais elementos de prova social incluir?", "Crie uma squeeze page para meu webinário"] },
  targeting: { name: "Perry", tagline: "Caçador de Públicos", provider: "GPT-4o", icon: Target, accentColor: "yellow",
    description: "Encontra os públicos certos nas plataformas certas com arquiteturas precisas.",
    suggestions: ["Quais interesses usar no Meta Ads para coaches?", "Como montar uma arquitetura de públicos lookalike?", "Qual é o melhor público para um curso de finanças?", "Como segmentar para um produto de R$2.000?"] },
  media_buyer: { name: "Nicholas", tagline: "Maximizador de ROAS", provider: "GPT-4o", icon: Megaphone, accentColor: "yellow",
    description: "Maximiza ROAS em Meta Ads, Google Ads, TikTok e YouTube.",
    suggestions: ["Como distribuir R$10k de budget num lançamento?", "Qual ROAS é considerado bom no Brasil?", "Como escalar um conjunto de anúncios vencedor?", "Quando pausar um anúncio no Meta?"] },
  affiliate_campaign: { name: "Stuart", tagline: "Multiplicador de Alcance", provider: "GPT-4o", icon: Users, accentColor: "yellow",
    description: "Estrutura programas de afiliados para explosão de alcance.",
    suggestions: ["Qual comissão oferecer para afiliados top?", "Como criar um kit de materiais para afiliados?", "Como reativar afiliados inativos?", "Monte uma estratégia de co-produção"] },
  analytics: { name: "Avinash", tagline: "Intérprete de Dados", provider: "Gemini", icon: BarChart3, accentColor: "green",
    description: "Interpreta dados e extrai insights acionáveis de campanhas.",
    suggestions: ["Meu CPL está em R$25, é bom para meu nicho?", "Como calcular o LTV do meu produto de R$997?", "Quais métricas acompanhar num lançamento?", "Como montar um dashboard de performance?"] },
  optimization: { name: "Bryan", tagline: "Motor de Melhoria Contínua", provider: "Gemini", icon: TrendingUp, accentColor: "green",
    description: "Melhora continuamente resultados com testes estruturados.",
    suggestions: ["Como fazer A/B test na minha página de vendas?", "Meu ROAS caiu 30%, o que fazer?", "Quais são os primeiros elementos a otimizar?", "Como testar criativos de forma eficiente?"] },
  video: { name: "Blake", tagline: "Diretor de Conteúdo Visual", provider: "Gemini", icon: Video, accentColor: "green",
    description: "Define estratégias de VSL, YouTube, Reels, TikTok e Lives.",
    suggestions: ["Crie a estrutura de um VSL de 30 minutos", "Qual hook usar para Reels de lançamento?", "Como estruturar uma live de vendas?", "Monte um roteiro de CPL para YouTube"] },
  creator_growth: { name: "Ali", tagline: "Arquiteto de Audiência", provider: "Gemini", icon: Star, accentColor: "green",
    description: "Cresce audiências orgânicas em Instagram, YouTube, TikTok e podcasts.",
    suggestions: ["Como crescer do 0 a 10k no Instagram?", "Qual frequência de posts no TikTok?", "Como transformar seguidores em compradores?", "Monte uma estratégia de conteúdo para 90 dias"] },
  compliance: { name: "Philip", tagline: "Guardião Legal", provider: "Claude", icon: Shield, accentColor: "red",
    description: "Garante que seu lançamento não viola CONAR, Meta Ads Policy, LGPD e CVM.",
    suggestions: ["Minha copy está dentro das normas do CONAR?", "O que não posso prometer num anúncio de saúde?", "Como fazer garantia de resultado sem risco legal?", "Quais disclaimers incluir em produtos financeiros?"] },
  perpetual_launch_manager: { name: "Francisco", tagline: "Motor de Vendas 24/7", provider: "Claude", icon: RefreshCw, accentColor: "primary",
    description: "Gerencia lançamentos perpétuos com evergreen funnels e automações de longo prazo.",
    suggestions: ["Como estruturar um funil perpétuo do zero?", "Qual é a diferença entre lançamento e perpétuo?", "Como criar urgência real num funil evergreen?", "Monte um funil perpétuo para meu produto de R$997"] },
  ad_copy: { name: "Carlton", tagline: "Criativo de Performance", provider: "GPT-4o", icon: Megaphone, accentColor: "cyan",
    description: "Cria copies de anúncios que param o scroll para Meta Ads e Google Ads.",
    suggestions: ["Escreva um hook para anúncio de topo de funil", "Crie copy para remarketing de carrinho abandonado", "Qual é o melhor ângulo para anúncio de curso de finanças?", "Escreva 3 variações de headline para meu produto"] },
  social_media: { name: "Garry", tagline: "Calendário de Conteúdo", provider: "GPT-4o", icon: Hash, accentColor: "cyan",
    description: "Cria calendários completos de conteúdo para Instagram, TikTok, YouTube e Facebook.",
    suggestions: ["Crie um calendário de conteúdo para semana de lançamento", "Qual é a proporção ideal entre posts de valor e venda?", "Como criar conteúdo que filtra o avatar certo?", "Monte estratégia de conteúdo para 30 dias pré-lançamento"] },
  stories_sequence: { name: "Donald", tagline: "Narrativa em Frames", provider: "GPT-4o", icon: Layers, accentColor: "cyan",
    description: "Cria roteiros completos de stories para lançamento com ganchos e revelações.",
    suggestions: ["Crie uma sequência de stories de abertura de carrinho", "Como manter atenção por 20 stories seguidos?", "Monte sequência de stories para CPL de pré-lançamento", "Crie stories de urgência para últimas horas de carrinho"] },
  media_brief: { name: "Andrew", tagline: "Guia para o Time de Tráfego", provider: "GPT-4o", icon: FileText, accentColor: "cyan",
    description: "Gera briefs completos para o time de tráfego pago com objetivos, públicos e KPIs.",
    suggestions: ["Gere um brief completo para lançamento de 10 dias", "O que não pode faltar num brief de tráfego?", "Como especificar públicos para o gestor de tráfego?", "Monte um brief de remarketing para carrinho abandonado"] },
  vsl_script: { name: "Jon", tagline: "Script de Alta Conversão", provider: "GPT-4o", icon: Video, accentColor: "cyan",
    description: "Escreve roteiros completos de VSL com estrutura AIDA, provas sociais e fechamento.",
    suggestions: ["Como estruturar um VSL de 30 minutos?", "Qual é o hook mais forte para abrir minha VSL?", "Escreva os primeiros 5 minutos do meu VSL", "Como fazer a transição para oferta sem soar forçado?"] },
  cpl_script: { name: "Conrado", tagline: "Conteúdo de Pré-Lançamento", provider: "GPT-4o", icon: Play, accentColor: "cyan",
    description: "Roteiros para vídeos CPL com educação, autoridade e antecipação progressiva.",
    suggestions: ["Escreva o roteiro do CPL 1 para meu produto", "Como equilibrar entrega de valor e antecipação no CPL?", "Qual é a estrutura dos 3 CPLs no PLF?", "Como terminar cada CPL com gancho para o próximo?"] },
  webinar_script: { name: "Jason", tagline: "Apresentação de Vendas", provider: "GPT-4o", icon: Mic, accentColor: "cyan",
    description: "Roteiros completos para webinários de venda com slides, pitch e Q&A estratégico.",
    suggestions: ["Como estruturar um webinário de 90 minutos?", "Qual é a transição perfeita para o pitch?", "Como manter atenção durante 90 minutos ao vivo?", "Escreva a abertura de impacto do meu webinário"] },
  live_script: { name: "Grant", tagline: "Venda ao Vivo", provider: "GPT-4o", icon: Radio, accentColor: "cyan",
    description: "Roteiros para lives de lançamento com abertura de impacto e fechamento ao vivo.",
    suggestions: ["Como abrir uma live de carrinho sem soar artificial?", "Como responder objeções ao vivo no chat?", "Monte o roteiro de uma live de fechamento de 90min", "Como criar urgência real nos últimos 10 minutos?"] },
  video_strategy: { name: "Blake", tagline: "Arquitetura do Conteúdo em Vídeo", provider: "Claude", icon: Cpu, accentColor: "primary",
    description: "Define a estratégia completa de vídeo para o lançamento: quais produzir e em qual sequência.",
    suggestions: ["Quais vídeos devo produzir para meu lançamento?", "Como planejar a produção de vídeo para 30 dias?", "Qual é a diferença entre VSL, CPL e webinário?", "Monte a arquitetura de vídeo para um PLF completo"] },
  financial_projector: { name: "Chet", tagline: "Simulador de Resultados", provider: "Gemini", icon: DollarSign, accentColor: "green",
    description: "Projeta receita, break-even, ROI e fluxo de caixa com base em benchmarks do mercado.",
    suggestions: ["Qual receita posso esperar com lista de 2.000 leads?", "Como calcular o break-even do meu lançamento?", "Projete 3 cenários (conservador, realista, otimista) para mim", "Quais custos não posso esquecer na projeção?"] },
  launch_sequence_builder: { name: "Chris", tagline: "Arquiteto de Automações", provider: "Claude", icon: Mail, accentColor: "primary",
    description: "Cria sequências completas de email + WhatsApp por fase e segmento de engajamento.",
    suggestions: ["Monte uma sequência de 7 dias para abertura de carrinho", "Como segmentar mensagens por nível de engajamento?", "Qual é o timing ideal entre os emails de lançamento?", "Crie sequência de recuperação de carrinho abandonado"] },
  continuous_sales_manager: { name: "Aaron", tagline: "Receita Previsível", provider: "Claude", icon: TrendingUp, accentColor: "primary",
    description: "Gerencia o ciclo de vendas contínuas pós-lançamento: nurturing, recompra e upsell.",
    suggestions: ["Como criar um programa de upsell pós-lançamento?", "Como reduzir churn em produto de recorrência?", "Monte uma sequência de reativação de leads frios", "Como identificar sinais de churn antes que aconteça?"] },
  whatsapp_response: { name: "Neil", tagline: "Atendimento Inteligente", provider: "Claude", icon: MessageCircle, accentColor: "primary",
    description: "Classifica mensagens do WhatsApp e gera respostas contextuais para leads e clientes.",
    suggestions: ["Como responder 'tá caro' sem dar desconto?", "Crie respostas para as 5 objeções mais comuns", "Como identificar intenção de compra numa mensagem?", "Monte roteiro de resposta para lead que sumiu por 3 dias"] },
  mental_frequency_coach: { name: "Viktor", tagline: "Engenheiro de Frequência Mental", provider: "Claude", icon: Brain, accentColor: "violet",
    description: "Diagnostica em qual das 4 Frequências Mentais você está e aplica protocolos de PNL para instalar a Mente de Destino.",
    suggestions: ["Diagnostique em qual frequência estou operando agora", "Como instalo a Mente de Destino no dia a dia?", "Sinto que oscilo muito — como estabilizar minha identidade?", "Me guie pelo exercício da Ponte ao Futuro Reversa"] },
  identity_architect: { name: "Nadia", tagline: "Arquiteta de Identidade", provider: "Claude", icon: Brain, accentColor: "violet",
    description: "Reconstrói a identidade do empreendedor desvinculada dos resultados com metaprogramas e colapso de âncoras.",
    suggestions: ["Quais metaprogramas estão me sabotando?", "Como desvincular minha identidade dos resultados diários?", "Me guie pelo exercício de colapso de âncoras", "Como criar uma âncora de estado poderoso?"] },
  obstinacy_trainer: { name: "Krav", tagline: "Instrutor de Obstinação", provider: "Claude", icon: Brain, accentColor: "violet",
    description: "Sessões de treino ativo de obstinação — desafios progressivos de execução e instalação da frieza cirúrgica.",
    suggestions: ["Quero uma sessão de treino de obstinação agora", "Como perseguir minha meta mesmo quando não tenho vontade?", "Me desafie a executar algo difícil hoje", "Como agir com a frieza da Frequência 4 em situações de crise?"] },
};

type ContextMode = "brainstorm" | "review" | "strategy" | "question" | "optimize";

interface FileAttachment {
  name: string;
  type: string;
  url: string;
  size: number;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  content?: string;
  isTranscribing?: boolean;
  transcription?: string;
  isAnalyzingVideo?: boolean;
  videoFrames?: string[];
  videoTranscription?: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  meta?: { tokensUsed?: number; creditsCharged?: number; elapsedMs?: number };
}

// ── Thinking phases shown while agent is working ──────────────────────────────
interface ThinkingPhase {
  icon: React.ElementType;
  label: string;
  color: string;
}
const THINKING_PHASES: ThinkingPhase[] = [
  { icon: Brain,       label: "Analisando contexto…",       color: "text-primary" },
  { icon: Search,      label: "Buscando referências…",      color: "text-cyan-400" },
  { icon: Sparkles,    label: "Elaborando estratégia…",     color: "text-yellow-400" },
  { icon: Pen,         label: "Redigindo resposta…",        color: "text-green-400" },
  { icon: CheckCircle2,label: "Revisando qualidade…",       color: "text-primary" },
];

const ACCENT_CLASSES: Record<string, { border: string; text: string; bg: string }> = {
  primary: { border: "border-primary/40",      text: "text-primary",      bg: "bg-primary/10" },
  cyan:    { border: "border-cyan-400/40",      text: "text-cyan-400",     bg: "bg-cyan-400/10" },
  yellow:  { border: "border-yellow-400/40",    text: "text-yellow-400",   bg: "bg-yellow-400/10" },
  green:   { border: "border-green-400/40",     text: "text-green-400",    bg: "bg-green-400/10" },
  red:     { border: "border-red-400/40",       text: "text-red-400",      bg: "bg-red-400/10" },
};
const PROVIDER_BADGE_CLASS: Record<string, string> = {
  Claude:  "text-primary border-primary/40 bg-primary/10",
  "GPT-4o":"text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  Gemini:  "text-green-400 border-green-400/40 bg-green-400/10",
};
const MODE_LABELS: Record<ContextMode, string> = {
  brainstorm: "Brainstorm", review: "Revisão", strategy: "Estratégia", question: "Pergunta", optimize: "Otimizar",
};

// ── localStorage helpers ──────────────────────────────────────────────────────
const CHAT_MAX_STORED = 60;

function chatStorageKey(role: string, campaignId: string) {
  return `nexos-chat-${role}${campaignId ? `-${campaignId}` : ""}`;
}
function loadChatHistory(role: string, campaignId: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(role, campaignId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ role: string; content: string; timestamp: string; meta?: ChatMsg["meta"] }>;
    return parsed.map(m => ({ ...m, role: m.role as "user" | "assistant", timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function saveChatHistory(role: string, campaignId: string, msgs: ChatMsg[]) {
  try {
    localStorage.setItem(chatStorageKey(role, campaignId), JSON.stringify(msgs.slice(-CHAT_MAX_STORED)));
  } catch { /* storage full */ }
}

// ── File icon helper ──────────────────────────────────────────────────────────
function fileIcon(att: FileAttachment) {
  if (att.isImage) return <ImageIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />;
  if (att.isVideo) return <FileVideo className="h-3.5 w-3.5 text-cyan-400/70 shrink-0" />;
  if (att.isAudio) return <FileAudio className="h-3.5 w-3.5 text-green-400/70 shrink-0" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Thinking indicator component ──────────────────────────────────────────────
function AgentThinking({ agentName, accent, showAll, onToggleAll }:
  { agentName: string; accent: { border: string; text: string; bg: string }; showAll: boolean; onToggleAll: () => void }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setPhaseIdx(0);
    setElapsed(0);
    setCompletedPhases([]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phaseIdx >= THINKING_PHASES.length - 1) return;
    const delay = 3500 + Math.random() * 1500;
    const t = setTimeout(() => {
      setCompletedPhases(prev => [...prev, phaseIdx]);
      setPhaseIdx(p => p + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  const currentPhase = THINKING_PHASES[phaseIdx]!;
  const CurrentIcon = currentPhase.icon;

  return (
    <div className="flex gap-3">
      {/* Agent avatar */}
      <div className={`w-8 h-8 border flex items-center justify-center shrink-0 mt-1 ${accent.border} ${accent.bg}`}>
        <img src={nexosLogo} alt="AI" className="w-5 h-5 object-contain" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Process panel */}
        <div className="border border-border/40 bg-card/50">
          {/* Header */}
          <button
            onClick={onToggleAll}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/10 transition-colors text-left"
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Loader2 className={`h-3.5 w-3.5 ${accent.text} animate-spin shrink-0`} />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">
                {agentName} está trabalhando
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/40 ml-1">
                {elapsed}s
              </span>
            </div>
            {showAll
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
          </button>

          {/* Current phase — always visible */}
          <div className={`border-t border-border/30 px-3 py-2 flex items-center gap-2.5 ${accent.bg}/30`}>
            <CurrentIcon className={`h-3.5 w-3.5 ${currentPhase.color} shrink-0`} />
            <span className={`font-mono text-xs ${currentPhase.color}`}>{currentPhase.label}</span>
            {/* Animated dots */}
            <div className="flex gap-0.5 ml-auto">
              {[0, 150, 300].map(d => (
                <div key={d}
                  className={`w-1 h-1 rounded-full ${accent.text.replace("text-", "bg-")} animate-bounce opacity-80`}
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>

          {/* Expanded process: all completed phases */}
          {showAll && completedPhases.length > 0 && (
            <div className="border-t border-border/20 px-3 py-2 space-y-1.5">
              {completedPhases.map(idx => {
                const phase = THINKING_PHASES[idx]!;
                const PhaseIcon = phase.icon;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success/60 shrink-0" />
                    <PhaseIcon className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="font-mono text-[10px] text-muted-foreground/40 line-through">{phase.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message detail panel (expandable on each AI message) ──────────────────────
function MessageProcess({ msg, agentName, phaseCount }:
  { msg: ChatMsg; agentName: string; phaseCount: number }) {
  const [open, setOpen] = useState(false);
  if (!msg.meta) return null;
  const { tokensUsed, creditsCharged, elapsedMs } = msg.meta;
  const elapsedSec = elapsedMs != null ? (elapsedMs / 1000).toFixed(1) : null;

  return (
    <div className="mt-1.5 border border-border/25 bg-card/20">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/10 transition-colors"
      >
        <Sparkles className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 flex-1 text-left">
          Ver processo completo
        </span>
        {open
          ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />}
      </button>

      {open && (
        <div className="border-t border-border/20 px-3 py-2.5 space-y-2">
          {/* Timeline of phases */}
          <div className="space-y-1.5">
            {THINKING_PHASES.slice(0, phaseCount).map((phase, idx) => {
              const PhaseIcon = phase.icon;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success/60 shrink-0" />
                  <PhaseIcon className={`h-3 w-3 shrink-0 ${phase.color} opacity-60`} />
                  <span className="font-mono text-[10px] text-muted-foreground/50">{phase.label}</span>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="border-t border-border/20 pt-2 grid grid-cols-3 gap-3">
            {elapsedSec && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">Tempo</div>
                <div className="font-mono text-xs text-muted-foreground/60">{elapsedSec}s</div>
              </div>
            )}
            {tokensUsed != null && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">Tokens</div>
                <div className="font-mono text-xs text-muted-foreground/60">{tokensUsed.toLocaleString()}</div>
              </div>
            )}
            {creditsCharged != null && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">Créditos</div>
                <div className="font-mono text-xs text-muted-foreground/60">{creditsCharged}</div>
              </div>
            )}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/30">
            Agente: {agentName} · Resposta gerada em {new Date(msg.timestamp).toLocaleTimeString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main chat page ────────────────────────────────────────────────────────────
export default function AgentChat() {
  const [, params] = useRoute("/agents/:role");
  const role = params?.role ?? "command";
  const agent = AGENT_INFO[role] ?? AGENT_INFO.command!;
  const accent = ACCENT_CLASSES[agent.accentColor] ?? ACCENT_CLASSES.primary!;
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; max: number } | null>(null);
  const [contextMode, setContextMode] = useState<ContextMode>("question");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showThinkingProcess, setShowThinkingProcess] = useState(false);
  const [msgPhaseCount, setMsgPhaseCount] = useState<Record<number, number>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const sendStartRef = useRef<number>(0);

  const { data: campaignsData } = useListCampaigns({ query: { queryKey: getListCampaignsQueryKey() } });

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Restore history
  useEffect(() => {
    setMessages(loadChatHistory(role, selectedCampaign));
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [role, selectedCampaign]);

  // Auto-save
  useEffect(() => {
    if (messages.length > 0) saveChatHistory(role, selectedCampaign, messages);
  }, [messages, role, selectedCampaign]);

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 240); // max ~10 lines
    el.style.height = `${next}px`;
  }, []);

  useEffect(() => { autoGrow(); }, [input, autoGrow]);

  // ── Video frame extraction ──────────────────────────────────────────────────
  const extractVideoFrames = (file: File, numFrames = 6): Promise<string[]> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.muted = true;
      vid.preload = "auto";
      vid.crossOrigin = "anonymous";
      vid.src = url;

      vid.onloadedmetadata = () => {
        const duration = vid.duration;
        if (!isFinite(duration) || duration <= 0) { URL.revokeObjectURL(url); resolve([]); return; }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const frames: string[] = [];
        const timestamps = Array.from({ length: numFrames }, (_, i) =>
          (duration * (i + 0.5)) / numFrames
        );
        let idx = 0;

        const captureNext = () => {
          if (idx >= timestamps.length) {
            URL.revokeObjectURL(url);
            resolve(frames);
            return;
          }
          vid.currentTime = timestamps[idx]!;
        };

        vid.onseeked = () => {
          canvas.width = Math.min(vid.videoWidth, 768);
          canvas.height = Math.min(vid.videoHeight, 432);
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          frames.push(dataUrl);
          idx++;
          captureNext();
        };

        vid.onerror = () => { URL.revokeObjectURL(url); resolve(frames); };
        captureNext();
      };

      vid.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
    });

  // ── File handling ──────────────────────────────────────────────────────────
  const readFileContent = (file: File): Promise<string | undefined> =>
    new Promise(resolve => {
      if (file.type.startsWith("image/") && file.size <= 8_000_000) {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string | undefined));
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
        return;
      }
      // Audio: read as dataURL for sending to Whisper
      if (file.type.startsWith("audio/") && file.size <= 25_000_000) {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string | undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
        return;
      }
      // Video: will be analyzed separately — skip content here
      if (file.type.startsWith("video/")) { resolve(undefined); return; }
      const isReadable =
        file.type.startsWith("text/") ||
        ["application/json", "application/xml", "application/pdf"].includes(file.type) ||
        /\.(txt|md|csv|json|html|xml|yml|yaml|ts|tsx|js|jsx|py|sql|sh|env)$/i.test(file.name);
      if (!isReadable || file.size > 400_000) { resolve(undefined); return; }
      const reader = new FileReader();
      reader.onload = e => resolve((e.target?.result as string | undefined));
      reader.onerror = () => resolve(undefined);
      reader.readAsText(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const attachments: FileAttachment[] = await Promise.all(
      files.map(async f => ({
        name: f.name,
        type: f.type,
        url: URL.createObjectURL(f),
        size: f.size,
        isImage: f.type.startsWith("image/"),
        isVideo: f.type.startsWith("video/"),
        isAudio: f.type.startsWith("audio/"),
        content: await readFileContent(f),
        isTranscribing: f.type.startsWith("audio/"),
        isAnalyzingVideo: f.type.startsWith("video/"),
      }))
    );
    setPendingAttachments(prev => [...prev, ...attachments]);
    e.target.value = "";
    textareaRef.current?.focus();

    // Auto-transcribe audio files in background
    for (const att of attachments) {
      if (att.isAudio && att.content) {
        void (async () => {
          try {
            const token = localStorage.getItem("nexos_access_token");
            const res = await fetch("/api/agents/transcribe", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ audioBase64: att.content, mimeType: att.type }),
            });
            if (!res.ok) throw new Error("Transcrição falhou");
            const data = await res.json() as { text: string };
            const transcript = data.text?.trim();
            if (!transcript) return;
            setPendingAttachments(prev =>
              prev.map(a => a.url === att.url
                ? { ...a, isTranscribing: false, transcription: transcript }
                : a
              )
            );
            setInput(prev => prev ? `${prev}\n\n${transcript}` : transcript);
            setTimeout(() => { textareaRef.current?.focus(); autoGrow(); }, 50);
          } catch {
            setPendingAttachments(prev =>
              prev.map(a => a.url === att.url
                ? { ...a, isTranscribing: false, transcription: undefined }
                : a
              )
            );
          }
        })();
      }

      // Auto-analyze video files: extract frames + transcribe audio
      if (att.isVideo) {
        const originalFile = files.find(f => f.name === att.name && f.type === att.type);
        if (!originalFile) continue;
        void (async () => {
          try {
            // 1. Extract keyframes via canvas
            const frames = await extractVideoFrames(originalFile, 6);

            // 2. Try to extract audio and transcribe via Whisper
            let videoTranscription: string | undefined;
            try {
              const audioBlob = await new Promise<Blob | null>((res) => {
                const vid = document.createElement("video");
                vid.src = att.url;
                vid.muted = false;
                vid.preload = "auto";
                vid.onloadedmetadata = () => {
                  try {
                    const stream = (vid as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
                    if (!stream) { res(null); return; }
                    const audioTracks = stream.getAudioTracks();
                    if (audioTracks.length === 0) { res(null); return; }
                    const audioStream = new MediaStream(audioTracks);
                    const mr = new MediaRecorder(audioStream);
                    const chunks: Blob[] = [];
                    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                    mr.onstop = () => res(new Blob(chunks, { type: "audio/webm" }));
                    mr.start();
                    void vid.play();
                    // Record up to 60s of audio
                    setTimeout(() => { mr.stop(); vid.pause(); }, Math.min(vid.duration * 1000, 60_000));
                  } catch { res(null); }
                };
                vid.onerror = () => res(null);
              });

              if (audioBlob && audioBlob.size > 1000) {
                const reader = new FileReader();
                const audioBase64: string = await new Promise(r => {
                  reader.onload = e => r(e.target?.result as string);
                  reader.readAsDataURL(audioBlob);
                });
                const token = localStorage.getItem("nexos_access_token");
                const tRes = await fetch("/api/agents/transcribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
                });
                if (tRes.ok) {
                  const tData = await tRes.json() as { text: string };
                  videoTranscription = tData.text?.trim() || undefined;
                }
              }
            } catch { /* audio extraction optional */ }

            // 3. Update attachment state
            setPendingAttachments(prev =>
              prev.map(a => a.url === att.url
                ? { ...a, isAnalyzingVideo: false, videoFrames: frames, videoTranscription }
                : a
              )
            );

            // 4. If transcription, append to input
            if (videoTranscription) {
              setInput(prev => {
                const note = `[Transcrição do vídeo "${att.name}"]:\n${videoTranscription}`;
                return prev ? `${prev}\n\n${note}` : note;
              });
              setTimeout(() => { textareaRef.current?.focus(); autoGrow(); }, 50);
            }

            toast.success(
              frames.length > 0
                ? `Vídeo analisado: ${frames.length} frames extraídos${videoTranscription ? " + transcrição" : ""}`
                : "Vídeo anexado (sem frames extraídos)",
              { duration: 4000 }
            );
          } catch {
            setPendingAttachments(prev =>
              prev.map(a => a.url === att.url ? { ...a, isAnalyzingVideo: false } : a)
            );
            toast.warning("Não foi possível analisar o vídeo automaticamente");
          }
        })();
      }
    }
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments(prev => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const MAX_RETRIES = 2;
  const RETRY_DELAYS_MS = [4000, 8000];
  const FETCH_TIMEOUT_MS = 110_000;

  const sendMessage = async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if ((!text && pendingAttachments.length === 0) || sending) return;

    const attachmentsSnapshot = pendingAttachments;
    setPendingAttachments([]);

    const attachmentNote = attachmentsSnapshot.length > 0
      ? `\n\n[Arquivos anexados: ${attachmentsSnapshot.map(a => a.name).join(", ")}]`
      : "";
    const displayText = text + attachmentNote;

    const snapshotMessages = messages;
    const newMsg: ChatMsg = { role: "user", content: displayText, timestamp: new Date(), attachments: attachmentsSnapshot };
    const withUser = [...messages, newMsg];
    setMessages(withUser);
    setInput("");
    setSending(true);
    setRetryInfo(null);
    setShowThinkingProcess(false);
    sendStartRef.current = Date.now();

    // Separate images vs text vs video attachments
    const imageAttachments = attachmentsSnapshot.filter(a => a.isImage && a.content);
    const videoAttachments = attachmentsSnapshot.filter(a => a.isVideo && (a.videoFrames?.length ?? 0) > 0);
    const textAttachments  = attachmentsSnapshot.filter(a => !a.isImage && !a.isVideo && a.content);

    // Build file context: text files + video transcriptions
    const fileContext = [
      ...textAttachments.map(a => `\n\n--- Arquivo: ${a.name} ---\n${a.content}`),
      ...videoAttachments.filter(a => a.videoTranscription).map(a =>
        `\n\n--- Transcrição do vídeo "${a.name}" ---\n${a.videoTranscription}`
      ),
    ].join("");

    // Include video metadata as context
    const videoContext = videoAttachments.length > 0
      ? `\n\n[Vídeos anexados para análise: ${videoAttachments.map(a =>
          `"${a.name}" (${(a.videoFrames?.length ?? 0)} frames extraídos${a.videoTranscription ? ", com transcrição" : ""})`
        ).join(", ")}]`
      : "";

    const messageWithFiles = text + fileContext + videoContext;

    // All visual images = regular images + video frames
    const allImages = [
      ...imageAttachments.map(a => a.content!),
      ...videoAttachments.flatMap(a => a.videoFrames ?? []),
    ];

    const requestBody = JSON.stringify({
      agentRole: role,
      message: messageWithFiles || (allImages.length > 0 ? "Analise este(s) arquivo(s) anexado(s)." : ""),
      history: snapshotMessages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      contextMode,
      ...(selectedCampaign ? { campaignId: selectedCampaign } : {}),
      ...(allImages.length > 0 ? { images: allImages } : {}),
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        setRetryInfo({ attempt, max: MAX_RETRIES });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new DOMException("Tempo limite excedido", "TimeoutError")), FETCH_TIMEOUT_MS);

      try {
        const res = await customFetch<{ response: string; tokensUsed: number; creditsCharged: number }>(
          "/api/agents/direct-chat",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody, signal: controller.signal },
        );
        clearTimeout(timeoutId);
        setRetryInfo(null);

        const elapsedMs = Date.now() - sendStartRef.current;
        const msgIndex = withUser.length;
        // Record how many phases completed (approx based on elapsed)
        const phasesCompleted = Math.min(THINKING_PHASES.length, Math.floor(elapsedMs / 3500) + 1);
        setMsgPhaseCount(prev => ({ ...prev, [msgIndex]: phasesCompleted }));

        const aiMsg: ChatMsg = {
          role: "assistant",
          content: res.response,
          timestamp: new Date(),
          meta: { tokensUsed: res.tokensUsed, creditsCharged: res.creditsCharged, elapsedMs },
        };
        const withAi = [...withUser, aiMsg];
        setMessages(withAi);
        saveChatHistory(role, selectedCampaign, withAi);
        setSending(false);
        setTimeout(() => textareaRef.current?.focus(), 100);
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = !(err instanceof ApiError) || err.status >= 500;
        if (!isRetryable || attempt === MAX_RETRIES) break;
      }
    }

    setMessages(snapshotMessages);
    setInput(text);
    setRetryInfo(null);
    setSending(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
    const isTimeout = lastError?.name === "AbortError" || lastError?.name === "TimeoutError";
    toast.error(
      isTimeout
        ? "A IA demorou demais. Sua mensagem foi preservada — tente novamente."
        : (lastError?.message ?? "Erro de comunicação. Sua mensagem foi preservada."),
      { duration: 7000 },
    );
  };

  // ── Voice to text ──────────────────────────────────────────────────────────
  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    const rec = new SpeechRec() as any;
    rec.lang = "pt-BR"; rec.continuous = false; rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const transcript = (e.results[0]?.[0]?.transcript as string | undefined) ?? "";
      if (transcript) { setInput(prev => prev ? `${prev} ${transcript}` : transcript); setTimeout(() => textareaRef.current?.focus(), 50); }
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => { setIsListening(false); toast.error("Não foi possível capturar o áudio. Verifique as permissões."); };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    toast("Ouvindo… fale agora.", { duration: 2500 });
  };

  const clearChat = () => { setMessages([]); localStorage.removeItem(chatStorageKey(role, selectedCampaign)); };
  const exportChat = () => {
    const text = messages.map(m => `[${m.role === "user" ? "Você" : agent.name}] ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `conversa-${role}-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const Icon = agent.icon;

  return (
    <div className="flex flex-col max-w-5xl mx-auto" style={{ height: "calc(100vh - 7rem)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 py-2 border-b border-border/50 mb-2">
        <Link href="/agents">
          <button className="h-7 w-7 border border-border/50 bg-muted/10 hover:bg-muted/30 flex items-center justify-center transition-all shrink-0">
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </Link>
        <div className={`w-8 h-8 border flex items-center justify-center shrink-0 ${accent.border} ${accent.bg}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <h1 className="font-mono font-bold text-sm uppercase tracking-wide text-foreground leading-none">{agent.name}</h1>
          <span className="font-mono text-[11px] text-muted-foreground/60 truncate hidden sm:inline">{agent.tagline}</span>
          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 border ${PROVIDER_BADGE_CLASS[agent.provider]}`}>{agent.provider}</Badge>
          <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground/60">3 cr</Badge>
        </div>
        {messages.length > 0 && (
          <div className="flex gap-1 shrink-0">
            <button onClick={exportChat} title="Exportar conversa" className="h-7 w-7 border border-border/40 bg-muted/10 hover:bg-muted/30 flex items-center justify-center transition-all text-muted-foreground hover:text-foreground">
              <Download className="h-3 w-3" />
            </button>
            <button onClick={clearChat} title="Limpar histórico" className="h-7 w-7 border border-border/40 bg-muted/10 hover:bg-muted/30 flex items-center justify-center transition-all text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Capabilities onboarding ─────────────────────────────────────────── */}
      <FeatureOnboarding
        featureKey={FEATURE_KEYS.AGENT_CHAT}
        title="CHAT COM AGENTES IA"
        description="Não precisa digitar tudo — você pode falar, enviar áudios, vídeos, prints ou documentos. O agente processa qualquer formato."
        variant="banner"
        steps={[
          "Texto: escreva normalmente ou use o modo Brainstorm / Estratégia / Revisão",
          "Voz: clique no microfone — o sistema transcreve em tempo real",
          "Áudio/Vídeo (MP3, MP4): arraste ou clique no clipe — o Whisper transcreve automaticamente",
          "Screenshot ou imagem: o agente analisa o visual e responde com base no que vê",
          "Documento ou código: cole ou faça upload de .txt, .json, .ts, .py e o agente lê tudo",
        ]}
      />

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto border border-border/50 bg-card/10 p-4 space-y-5 min-h-0">

        {/* Empty state */}
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-8">
            <div className={`w-16 h-16 border flex items-center justify-center ${accent.border} ${accent.bg}`}>
              <Icon className={`h-7 w-7 ${accent.text}`} />
            </div>
            <div className="text-center">
              <p className="font-mono text-sm text-foreground font-bold uppercase tracking-wide mb-1">{agent.name}</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Escolha uma sugestão ou escreva sua pergunta</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-xl">
              {agent.suggestions.map(s => (
                <button key={s} onClick={() => void sendMessage(s)}
                  className="text-left border border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/60 p-3 transition-all group">
                  <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              {!isUser ? (
                <div className={`w-8 h-8 border flex items-center justify-center shrink-0 mt-1 ${accent.border} ${accent.bg}`}>
                  <img src={nexosLogo} alt="AI" className="w-5 h-5 object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 border border-border/50 bg-muted/20 shrink-0 mt-1 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} min-w-0 max-w-[85%]`}>
                {/* Attachments — rich preview per type */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 flex flex-col gap-1.5 w-full max-w-sm">
                    {msg.attachments.map((att, ai) => {
                      if (att.isImage) return (
                        <a key={`img-${ai}`} href={att.url} target="_blank" rel="noreferrer"
                          className="block border border-border/40 overflow-hidden bg-muted/10 hover:opacity-90 transition-opacity">
                          <img src={att.url} alt={att.name} className="max-h-48 w-full object-contain" />
                          <div className="px-2 py-1 border-t border-border/30 flex items-center gap-1.5">
                            <ImageIcon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground/50 truncate">{att.name}</span>
                          </div>
                        </a>
                      );
                      if (att.isVideo) return (
                        <div key={`vid-${ai}`} className="border border-cyan-400/30 bg-card/40 overflow-hidden">
                          <video src={att.url} controls className="w-full max-h-48 bg-black" preload="metadata" />
                          <div className="px-2 py-1 border-t border-border/30 flex items-center gap-1.5">
                            <FileVideo className="h-3 w-3 text-cyan-400/70 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground/50 truncate flex-1">{att.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/30">{formatBytes(att.size)}</span>
                          </div>
                        </div>
                      );
                      if (att.isAudio) return (
                        <div key={`aud-${ai}`} className="border border-green-400/30 bg-card/40 p-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <FileAudio className="h-3.5 w-3.5 text-green-400/70 shrink-0" />
                            <span className="font-mono text-[11px] text-muted-foreground/70 truncate">{att.name}</span>
                          </div>
                          <audio src={att.url} controls className="w-full h-8" />
                        </div>
                      );
                      const ext = att.name.split(".").pop()?.toUpperCase() ?? "FILE";
                      const isPdf = /pdf/i.test(att.type ?? att.name);
                      const isDoc = /\.(ppt|pptx|doc|docx|xls|xlsx)$/i.test(att.name);
                      return (
                        <div key={`doc-${ai}`} className="flex items-center gap-2 border border-border/50 bg-muted/20 px-2.5 py-2">
                          <div className={`w-7 h-8 border flex items-center justify-center shrink-0 font-mono text-[8px] font-bold
                            ${isPdf ? "border-red-400/40 text-red-400 bg-red-400/10" : isDoc ? "border-blue-400/40 text-blue-400 bg-blue-400/10" : "border-border/50 text-muted-foreground bg-muted/20"}`}>
                            {ext}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[11px] text-foreground/80 truncate">{att.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground/40">{formatBytes(att.size)}</div>
                          </div>
                          <a href={att.url} download={att.name} title="Baixar"
                            className="h-7 w-7 border border-border/40 bg-muted/10 hover:bg-muted/30 flex items-center justify-center transition-all text-muted-foreground hover:text-foreground shrink-0">
                            <Download className="h-3 w-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bubble */}
                <div className={`px-4 py-3 text-sm font-mono leading-relaxed whitespace-pre-wrap border
                  ${isUser
                    ? "bg-primary/15 border-primary/25 text-foreground"
                    : "bg-card/70 border-border/40 text-foreground"}`}>
                  {msg.content}
                </div>

                {/* Timestamp */}
                <div className="mt-1 px-1 text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>

                {/* "Ver processo completo" — only on AI messages */}
                {!isUser && (
                  <MessageProcess
                    msg={msg}
                    agentName={agent.name}
                    phaseCount={msgPhaseCount[i] ?? THINKING_PHASES.length}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {sending && (
          <AgentThinking
            agentName={agent.name}
            accent={accent}
            showAll={showThinkingProcess}
            onToggleAll={() => setShowThinkingProcess(o => !o)}
          />
        )}
        {/* Retry banner */}
        {retryInfo && (
          <div className="flex items-center gap-2 px-3 py-2 border border-amber-400/30 bg-amber-400/10">
            <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin shrink-0" />
            <span className="font-mono text-[11px] text-amber-400 uppercase tracking-widest">
              Tentando novamente {retryInfo.attempt}/{retryInfo.max}…
            </span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Composer ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border border-t-0 border-border/50 bg-card/20">

        {/* Hidden file input — accepts EVERYTHING */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="*/*"
          onChange={e => { void handleFileSelect(e); }}
        />

        {/* Pending attachments — rich preview */}
        {pendingAttachments.length > 0 && (
          <div className="border-b border-border/30 px-3 pt-2.5 pb-2">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.isImage && att.content ? (
                    <div className="relative border border-border/50 bg-muted/20 overflow-hidden">
                      <img src={att.content} alt={att.name} className="h-16 w-16 object-cover" />
                      <button onClick={() => removeAttachment(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-background/80 hover:bg-destructive/80 flex items-center justify-center transition-colors">
                        <X className="h-2.5 w-2.5 text-foreground" />
                      </button>
                    </div>
                  ) : att.isVideo ? (
                    <div className="relative border border-cyan-400/30 bg-card/40 overflow-hidden">
                      <video src={att.url} className="h-16 w-24 object-cover bg-black" preload="metadata" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        {att.isAnalyzingVideo ? (
                          <>
                            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                            <span className="font-mono text-[8px] text-cyan-400 mt-0.5 uppercase tracking-widest">Analisando…</span>
                          </>
                        ) : att.videoFrames && att.videoFrames.length > 0 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            <span className="font-mono text-[8px] text-cyan-400 mt-0.5 uppercase tracking-widest">{att.videoFrames.length} frames{att.videoTranscription ? " + voz" : ""}</span>
                          </>
                        ) : (
                          <FileVideo className="h-5 w-5 text-cyan-400/80" />
                        )}
                      </div>
                      <button onClick={() => removeAttachment(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-background/80 hover:bg-destructive/80 flex items-center justify-center transition-colors">
                        <X className="h-2.5 w-2.5 text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 border border-border/50 bg-muted/20 pl-2 pr-1 py-1.5 max-w-[180px]">
                      {att.isTranscribing
                        ? <Loader2 className="h-3.5 w-3.5 text-green-400 animate-spin shrink-0" />
                        : att.isAudio
                          ? <FileAudio className="h-3.5 w-3.5 text-green-400/70 shrink-0" />
                          : fileIcon(att)
                      }
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] text-muted-foreground truncate">{att.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground/40">
                          {att.isTranscribing ? (
                            <span className="text-green-400/70 animate-pulse">Transcrevendo…</span>
                          ) : att.transcription ? (
                            <span className="text-green-400/70">✓ Transcrito</span>
                          ) : formatBytes(att.size)}
                        </div>
                      </div>
                      <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listening indicator */}
        {isListening && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="font-mono text-[11px] text-destructive uppercase tracking-widest flex-1">Ouvindo… fale agora</span>
            <button onClick={toggleVoice} className="text-destructive hover:text-destructive/60 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Textarea row */}
        <div className="px-3 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (isMobile || e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }
            }}
            placeholder={`Fale com ${agent.name}…`}
            disabled={sending}
            rows={3}
            className="w-full font-mono text-sm bg-transparent border-none focus:outline-none resize-none text-foreground placeholder:text-muted-foreground/40 leading-relaxed min-h-[72px]"
            style={{ maxHeight: 240 }}
          />
        </div>

        {/* Toolbar row 1: context + campaign */}
        <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 border-t border-border/20 flex-wrap">
          {/* Context mode pills — compact */}
          <div className="flex gap-0.5">
            {(Object.keys(MODE_LABELS) as ContextMode[]).map(m => (
              <button key={m} onClick={() => setContextMode(m)}
                className={`px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-all
                  ${contextMode === m ? `${accent.bg} ${accent.text} border ${accent.border}` : "text-muted-foreground/50 hover:text-foreground"}`}>
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          {(campaignsData?.campaigns ?? []).length > 0 && (
            <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
              className="text-[10px] font-mono uppercase tracking-widest bg-card/40 border border-border/40 px-2 py-1 text-muted-foreground/60 focus:border-primary/50 focus:outline-none max-w-[160px] truncate">
              <option value="">Sem campanha</option>
              {(campaignsData?.campaigns ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/25">
            {isMobile ? "Enter = enviar" : "Ctrl+Enter"}
          </span>
        </div>

        {/* Toolbar row 2: actions + send */}
        <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo, foto, vídeo ou documento"
            className={`h-8 px-2.5 flex items-center gap-1.5 border transition-all shrink-0
              ${pendingAttachments.length > 0
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground"}`}
          >
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">Arquivo</span>
            {pendingAttachments.length > 0 && (
              <span className="text-[9px] font-bold text-primary bg-primary/20 px-1">{pendingAttachments.length}</span>
            )}
          </button>

          {isMobile && (
            <button
              type="button"
              onClick={() => {
                const tmp = document.createElement("input");
                tmp.type = "file"; tmp.accept = "image/*,video/*"; tmp.capture = "environment";
                tmp.style.display = "none";
                tmp.onchange = () => { void handleFileSelect({ target: tmp } as React.ChangeEvent<HTMLInputElement>); document.body.removeChild(tmp); };
                document.body.appendChild(tmp); tmp.click();
              }}
              title="Tirar foto ou gravar vídeo"
              className="h-8 w-8 flex items-center justify-center border border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all shrink-0"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleVoice}
            title={isListening ? "Parar gravação de voz" : "Gravar mensagem por voz"}
            className={`h-8 px-2.5 flex items-center gap-1.5 border transition-all shrink-0
              ${isListening
                ? "border-destructive bg-destructive/20 text-destructive"
                : "border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground"}`}
          >
            {isListening ? <MicOff className="h-4 w-4 shrink-0" /> : <Mic className="h-4 w-4 shrink-0" />}
            <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">
              {isListening ? "Parar" : "Voz"}
            </span>
          </button>

          <div className="flex-1" />

          {!isMobile && (
            <Button variant="outline" size="sm"
              title="Inserir nova linha"
              onClick={() => { setInput(v => v + "\n"); setTimeout(() => textareaRef.current?.focus(), 0); autoGrow(); }}
              disabled={sending}
              className="font-mono rounded-sm h-8 px-2.5 border-border/50 text-muted-foreground hover:text-foreground hover:border-border shrink-0">
              <CornerDownLeft className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            onPointerDown={e => { if (e.pointerType === "touch") e.preventDefault(); }}
            onClick={() => { if (!input.trim() && pendingAttachments.length === 0) { textareaRef.current?.focus(); return; } void sendMessage(); }}
            disabled={sending}
            title={isMobile ? "Enviar" : "Enviar (Ctrl+Enter)"}
            className={`font-mono h-8 px-4 gap-1.5 rounded-sm ${accent.bg} ${accent.border} border hover:brightness-125 shrink-0`}
          >
            {sending
              ? <Loader2 className={`h-4 w-4 ${accent.text} animate-spin`} />
              : <>
                  <Send className={`h-4 w-4 ${accent.text}`} />
                  <span className={`font-mono text-[11px] uppercase tracking-widest ${accent.text} hidden sm:inline`}>Enviar</span>
                </>}
          </Button>
        </div>

        {/* Input capability hint */}
        <p className="font-mono text-[9px] text-muted-foreground/30 px-3 pb-2 text-right leading-relaxed">
          Texto · Voz · MP3/MP4 (Whisper) · Screenshot · PDF/Código{isMobile ? "" : " · Ctrl+Enter = enviar"}
        </p>
      </div>
    </div>
  );
}
