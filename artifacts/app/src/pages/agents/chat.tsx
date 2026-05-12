import { useState, useEffect, useRef } from "react";
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
  Mic, Play, Radio, FileText, Hash, Mail, MessageCircle, DollarSign, Layers, Cpu,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

// ── Agent catalog (must match backend) ───────────────────────────────────────
interface AgentInfo {
  name: string; tagline: string; description: string;
  provider: "Claude" | "GPT-4o" | "Gemini";
  icon: React.ElementType; accentColor: string;
  suggestions: string[];
}

const AGENT_INFO: Record<string, AgentInfo> = {
  command: { name: "Comandante IA", tagline: "General das Operações", provider: "Claude", icon: Rocket, accentColor: "primary",
    description: "Orquestra toda a operação de lançamento com visão estratégica e execução impecável.",
    suggestions: ["Como devo estruturar meu próximo lançamento?", "Quais são os maiores erros em lançamentos de 6 dígitos?", "Monte um plano de 7 dias para meu lançamento", "Analise minha estratégia atual e aponte gargalos"] },
  strategy: { name: "Estrategista", tagline: "Arquiteto do Lançamento", provider: "Claude", icon: Brain, accentColor: "primary",
    description: "Cria estratégias de lançamento de 6 a 10 dígitos com base em dados e psicologia do consumidor.",
    suggestions: ["Como posicionar meu produto no mercado?", "Qual narrativa usar para meu avatar primário?", "Como me diferenciar da concorrência?", "Monte uma estratégia de lançamento semente para mim"] },
  launch_manager: { name: "Gerente de Lançamento", tagline: "Coordenador de Fases", provider: "Claude", icon: Zap, accentColor: "primary",
    description: "Coordena cada fase do lançamento com precisão milimétrica.",
    suggestions: ["Crie um cronograma de lançamento de 10 dias", "Quais CPLs devo publicar e quando?", "Como faço a transição do pré-lançamento para o carrinho?", "Monte uma timeline PLF completa para mim"] },
  offer: { name: "Especialista em Oferta", tagline: "Arquiteto de Ofertas", provider: "Claude", icon: ShoppingCart, accentColor: "primary",
    description: "Constrói ofertas irresistíveis com stack de bônus e pricing psicológico.",
    suggestions: ["Analise minha oferta e sugira melhorias", "Qual garantia mais converte no mercado brasileiro?", "Como montar um stack de bônus que justifique R$2.000?", "Como usar ancoragem de preço no meu lançamento?"] },
  product_builder: { name: "Product Builder", tagline: "Descobridor de Produtos", provider: "Claude", icon: Star, accentColor: "primary",
    description: "Descobre e refina produtos digitais de alto valor percebido.",
    suggestions: ["Tenho expertise em X, qual produto criar?", "Como validar minha ideia de curso antes de criar?", "Que formato de produto vende mais no Brasil?", "Como precificar meu infoproduto?"] },
  copywriter: { name: "Copywriter", tagline: "Mestre das Palavras", provider: "GPT-4o", icon: Pen, accentColor: "cyan",
    description: "Escreve copy de venda que converte. Domina AIDA, PAS e storytelling emocional.",
    suggestions: ["Escreva uma headline para meu produto", "Crie um email de pré-lançamento", "Escreva um script de VSL para meu produto", "Crie copy para anúncio de topo de funil"] },
  creative_director: { name: "Diretor Criativo", tagline: "Arquiteto Visual", provider: "GPT-4o", icon: Eye, accentColor: "cyan",
    description: "Define identidade visual, branding e direção criativa completa.",
    suggestions: ["Crie um moodboard para meu produto premium", "Que paleta de cores usar para transmitir autoridade?", "Como fazer um branding que posicione como premium?", "Sugira tipografia para um produto de saúde"] },
  landing_page: { name: "Landing Page", tagline: "Especialista em Conversão", provider: "GPT-4o", icon: Globe, accentColor: "cyan",
    description: "Cria páginas de captura e vendas que convertem.",
    suggestions: ["Escreva a copy acima do fold da minha página de vendas", "Como estruturar uma VSL page que converte?", "Quais elementos de prova social incluir?", "Crie uma squeeze page para meu webinário"] },
  targeting: { name: "Targeting Expert", tagline: "Caçador de Públicos", provider: "GPT-4o", icon: Target, accentColor: "yellow",
    description: "Encontra os públicos certos nas plataformas certas com arquiteturas precisas.",
    suggestions: ["Quais interesses usar no Meta Ads para coaches?", "Como montar uma arquitetura de públicos lookalike?", "Qual é o melhor público para um curso de finanças?", "Como segmentar para um produto de R$2.000?"] },
  media_buyer: { name: "Media Buyer", tagline: "Maximizador de ROAS", provider: "GPT-4o", icon: Megaphone, accentColor: "yellow",
    description: "Maximiza ROAS em Meta Ads, Google Ads, TikTok e YouTube.",
    suggestions: ["Como distribuir R$10k de budget num lançamento?", "Qual ROAS é considerado bom no Brasil?", "Como escalar um conjunto de anúncios vencedor?", "Quando pausar um anúncio no Meta?"] },
  affiliate_campaign: { name: "Especialista em Afiliados", tagline: "Multiplicador de Alcance", provider: "GPT-4o", icon: Users, accentColor: "yellow",
    description: "Estrutura programas de afiliados para explosão de alcance.",
    suggestions: ["Qual comissão oferecer para afiliados top?", "Como criar um kit de materiais para afiliados?", "Como reativar afiliados inativos?", "Monte uma estratégia de co-produção"] },
  analytics: { name: "Analista de Performance", tagline: "Intérprete de Dados", provider: "Gemini", icon: BarChart3, accentColor: "green",
    description: "Interpreta dados e extrai insights acionáveis de campanhas.",
    suggestions: ["Meu CPL está em R$25, é bom para meu nicho?", "Como calcular o LTV do meu produto de R$997?", "Quais métricas acompanhar num lançamento?", "Como montar um dashboard de performance?"] },
  optimization: { name: "Otimizador", tagline: "Motor de Melhoria Contínua", provider: "Gemini", icon: TrendingUp, accentColor: "green",
    description: "Melhora continuamente resultados com testes estruturados.",
    suggestions: ["Como fazer A/B test na minha página de vendas?", "Meu ROAS caiu 30%, o que fazer?", "Quais são os primeiros elementos a otimizar?", "Como testar criativos de forma eficiente?"] },
  video: { name: "Estrategista de Vídeo", tagline: "Diretor de Conteúdo Visual", provider: "Gemini", icon: Video, accentColor: "green",
    description: "Define estratégias de VSL, YouTube, Reels, TikTok e Lives.",
    suggestions: ["Crie a estrutura de um VSL de 30 minutos", "Qual hook usar para Reels de lançamento?", "Como estruturar uma live de vendas?", "Monte um roteiro de CPL para YouTube"] },
  creator_growth: { name: "Creator Growth", tagline: "Arquiteto de Audiência", provider: "Gemini", icon: Star, accentColor: "green",
    description: "Cresce audiências orgânicas em Instagram, YouTube, TikTok e podcasts.",
    suggestions: ["Como crescer do 0 a 10k no Instagram?", "Qual frequência de posts no TikTok?", "Como transformar seguidores em compradores?", "Monte uma estratégia de conteúdo para 90 dias"] },
  compliance: { name: "Compliance Officer", tagline: "Guardião Legal", provider: "Claude", icon: Shield, accentColor: "red",
    description: "Garante que seu lançamento não viola CONAR, Meta Ads Policy, LGPD e CVM.",
    suggestions: ["Minha copy está dentro das normas do CONAR?", "O que não posso prometer num anúncio de saúde?", "Como fazer garantia de resultado sem risco legal?", "Quais disclaimers incluir em produtos financeiros?"] },
  perpetual_launch_manager: { name: "Gerente de Perpétuo", tagline: "Motor de Vendas 24/7", provider: "Claude", icon: RefreshCw, accentColor: "primary",
    description: "Gerencia lançamentos perpétuos com evergreen funnels e automações de longo prazo.",
    suggestions: ["Como estruturar um funil perpétuo do zero?", "Qual é a diferença entre lançamento e perpétuo?", "Como criar urgência real num funil evergreen?", "Monte um funil perpétuo para meu produto de R$997"] },
  ad_copy: { name: "Copy de Anúncios", tagline: "Criativo de Performance", provider: "GPT-4o", icon: Megaphone, accentColor: "cyan",
    description: "Cria copies de anúncios que param o scroll para Meta Ads e Google Ads.",
    suggestions: ["Escreva um hook para anúncio de topo de funil", "Crie copy para remarketing de carrinho abandonado", "Qual é o melhor ângulo para anúncio de curso de finanças?", "Escreva 3 variações de headline para meu produto"] },
  social_media: { name: "Social Media IA", tagline: "Calendário de Conteúdo", provider: "GPT-4o", icon: Hash, accentColor: "cyan",
    description: "Cria calendários completos de conteúdo para Instagram, TikTok, YouTube e Facebook.",
    suggestions: ["Crie um calendário de conteúdo para semana de lançamento", "Qual é a proporção ideal entre posts de valor e venda?", "Como criar conteúdo que filtra o avatar certo?", "Monte estratégia de conteúdo para 30 dias pré-lançamento"] },
  stories_sequence: { name: "Sequência de Stories", tagline: "Narrativa em Frames", provider: "GPT-4o", icon: Layers, accentColor: "cyan",
    description: "Cria roteiros completos de stories para lançamento com ganchos e revelações.",
    suggestions: ["Crie uma sequência de stories de abertura de carrinho", "Como manter atenção por 20 stories seguidos?", "Monte sequência de stories para CPL de pré-lançamento", "Crie stories de urgência para últimas horas de carrinho"] },
  media_brief: { name: "Brief de Mídia", tagline: "Guia para o Time de Tráfego", provider: "GPT-4o", icon: FileText, accentColor: "cyan",
    description: "Gera briefs completos para o time de tráfego pago com objetivos, públicos e KPIs.",
    suggestions: ["Gere um brief completo para lançamento de 10 dias", "O que não pode faltar num brief de tráfego?", "Como especificar públicos para o gestor de tráfego?", "Monte um brief de remarketing para carrinho abandonado"] },
  vsl_script: { name: "Roteirista VSL", tagline: "Script de Alta Conversão", provider: "GPT-4o", icon: Video, accentColor: "cyan",
    description: "Escreve roteiros completos de VSL com estrutura AIDA, provas sociais e fechamento.",
    suggestions: ["Como estruturar um VSL de 30 minutos?", "Qual é o hook mais forte para abrir minha VSL?", "Escreva os primeiros 5 minutos do meu VSL", "Como fazer a transição para oferta sem soar forçado?"] },
  cpl_script: { name: "Script CPL", tagline: "Conteúdo de Pré-Lançamento", provider: "GPT-4o", icon: Play, accentColor: "cyan",
    description: "Roteiros para vídeos CPL com educação, autoridade e antecipação progressiva.",
    suggestions: ["Escreva o roteiro do CPL 1 para meu produto", "Como equilibrar entrega de valor e antecipação no CPL?", "Qual é a estrutura dos 3 CPLs no PLF?", "Como terminar cada CPL com gancho para o próximo?"] },
  webinar_script: { name: "Roteirista Webinar", tagline: "Apresentação de Vendas", provider: "GPT-4o", icon: Mic, accentColor: "cyan",
    description: "Roteiros completos para webinários de venda com slides, pitch e Q&A estratégico.",
    suggestions: ["Como estruturar um webinário de 90 minutos?", "Qual é a transição perfeita para o pitch?", "Como manter atenção durante 90 minutos ao vivo?", "Escreva a abertura de impacto do meu webinário"] },
  live_script: { name: "Roteirista de Live", tagline: "Venda ao Vivo", provider: "GPT-4o", icon: Radio, accentColor: "cyan",
    description: "Roteiros para lives de lançamento com abertura de impacto e fechamento ao vivo.",
    suggestions: ["Como abrir uma live de carrinho sem soar artificial?", "Como responder objeções ao vivo no chat?", "Monte o roteiro de uma live de fechamento de 90min", "Como criar urgência real nos últimos 10 minutos?"] },
  video_strategy: { name: "Estrategista de Vídeo", tagline: "Arquitetura do Conteúdo em Vídeo", provider: "Claude", icon: Cpu, accentColor: "primary",
    description: "Define a estratégia completa de vídeo para o lançamento: quais produzir e em qual sequência.",
    suggestions: ["Quais vídeos devo produzir para meu lançamento?", "Como planejar a produção de vídeo para 30 dias?", "Qual é a diferença entre VSL, CPL e webinário?", "Monte a arquitetura de vídeo para um PLF completo"] },
  financial_projector: { name: "Projetor Financeiro", tagline: "Simulador de Resultados", provider: "Gemini", icon: DollarSign, accentColor: "green",
    description: "Projeta receita, break-even, ROI e fluxo de caixa com base em benchmarks do mercado.",
    suggestions: ["Qual receita posso esperar com lista de 2.000 leads?", "Como calcular o break-even do meu lançamento?", "Projete 3 cenários (conservador, realista, otimista) para mim", "Quais custos não posso esquecer na projeção?"] },
  launch_sequence_builder: { name: "Builder de Sequências", tagline: "Arquiteto de Automações", provider: "Claude", icon: Mail, accentColor: "primary",
    description: "Cria sequências completas de email + WhatsApp por fase e segmento de engajamento.",
    suggestions: ["Monte uma sequência de 7 dias para abertura de carrinho", "Como segmentar mensagens por nível de engajamento?", "Qual é o timing ideal entre os emails de lançamento?", "Crie sequência de recuperação de carrinho abandonado"] },
  continuous_sales_manager: { name: "Gestor de Vendas Contínuas", tagline: "Receita Previsível", provider: "Claude", icon: TrendingUp, accentColor: "primary",
    description: "Gerencia o ciclo de vendas contínuas pós-lançamento: nurturing, recompra e upsell.",
    suggestions: ["Como criar um programa de upsell pós-lançamento?", "Como reduzir churn em produto de recorrência?", "Monte uma sequência de reativação de leads frios", "Como identificar sinais de churn antes que aconteça?"] },
  whatsapp_response: { name: "Auto-Resposta WhatsApp", tagline: "Atendimento Inteligente", provider: "Claude", icon: MessageCircle, accentColor: "primary",
    description: "Classifica mensagens do WhatsApp e gera respostas contextuais para leads e clientes.",
    suggestions: ["Como responder 'tá caro' sem dar desconto?", "Crie respostas para as 5 objeções mais comuns", "Como identificar intenção de compra numa mensagem?", "Monte roteiro de resposta para lead que sumiu por 3 dias"] },
};

type ContextMode = "brainstorm" | "review" | "strategy" | "question" | "optimize";
interface ChatMsg { role: "user" | "assistant"; content: string; timestamp: Date }

const ACCENT_CLASSES: Record<string, { border: string; text: string; bg: string }> = {
  primary: { border: "border-primary/40", text: "text-primary", bg: "bg-primary/10" },
  cyan:    { border: "border-cyan-400/40", text: "text-cyan-400", bg: "bg-cyan-400/10" },
  yellow:  { border: "border-yellow-400/40", text: "text-yellow-400", bg: "bg-yellow-400/10" },
  green:   { border: "border-green-400/40", text: "text-green-400", bg: "bg-green-400/10" },
  red:     { border: "border-red-400/40", text: "text-red-400", bg: "bg-red-400/10" },
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
const CHAT_MAX_STORED = 60; // max messages to persist per agent

function chatStorageKey(role: string, campaignId: string) {
  return `nexos-chat-${role}${campaignId ? `-${campaignId}` : ""}`;
}

function loadChatHistory(role: string, campaignId: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(role, campaignId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ role: string; content: string; timestamp: string }>;
    return parsed.map(m => ({ ...m, role: m.role as "user" | "assistant", timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}

function saveChatHistory(role: string, campaignId: string, msgs: ChatMsg[]) {
  try {
    const toStore = msgs.slice(-CHAT_MAX_STORED);
    localStorage.setItem(chatStorageKey(role, campaignId), JSON.stringify(toStore));
  } catch { /* storage full — ignore */ }
}

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: campaignsData } = useListCampaigns({ query: { queryKey: getListCampaignsQueryKey() } });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Restore history when role or campaign changes
  useEffect(() => {
    const saved = loadChatHistory(role, selectedCampaign);
    setMessages(saved);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [role, selectedCampaign]);

  // Auto-save whenever messages change (belt-and-suspenders — also catches
  // any case where the explicit save inside sendMessage is missed)
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(role, selectedCampaign, messages);
    }
  }, [messages, role, selectedCampaign]);

  const MAX_RETRIES = 2;
  const RETRY_DELAYS_MS = [4000, 8000];
  const FETCH_TIMEOUT_MS = 110_000; // 110s — AI calls can take up to 90s

  const sendMessage = async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if (!text || sending) return;

    const snapshotMessages = messages; // capture before optimistic update
    const newMsg: ChatMsg = { role: "user", content: text, timestamp: new Date() };
    const withUser = [...messages, newMsg];
    setMessages(withUser);
    setSending(true);
    setRetryInfo(null);

    const requestBody = JSON.stringify({
      agentRole: role,
      message: text,
      history: snapshotMessages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      contextMode,
      ...(selectedCampaign ? { campaignId: selectedCampaign } : {}),
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
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);
        setInput("");
        setRetryInfo(null);
        const aiMsg: ChatMsg = { role: "assistant", content: res.response, timestamp: new Date() };
        const withAi = [...withUser, aiMsg];
        setMessages(withAi);
        saveChatHistory(role, selectedCampaign, withAi);
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 100);
        return; // success
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on 4xx (bad request, auth, credits).
        // AbortError / TypeError (network failure) are never ApiError instances,
        // so !(err instanceof ApiError) covers them automatically.
        const isRetryable = !(err instanceof ApiError) || err.status >= 500;

        if (!isRetryable || attempt === MAX_RETRIES) break;
        // else loop continues → wait then retry
      }
    }

    // All attempts exhausted — revert optimistic message, always restore text
    setMessages(snapshotMessages);
    setInput(text); // restore for BOTH typed input and suggestion clicks
    setRetryInfo(null);
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);

    const isTimeout = lastError?.name === "AbortError" || lastError?.name === "TimeoutError";
    toast.error(
      isTimeout
        ? "A IA demorou demais para responder. Sua mensagem foi preservada — tente novamente."
        : (lastError?.message ?? "Erro de comunicação. Sua mensagem foi preservada — tente novamente."),
      { duration: 7000 },
    );
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(chatStorageKey(role, selectedCampaign));
  };

  const exportChat = () => {
    const text = messages.map(m => `[${m.role === "user" ? "Você" : agent.name}] ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `conversa-${role}-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const Icon = agent.icon;

  return (
    <div className="flex flex-col max-w-5xl mx-auto" style={{ height: "calc(100vh - 7rem)" }}>
      {/* Header */}
      <div className="shrink-0 pb-4 border-b border-border/50 mb-4">
        <Link href="/agents">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Time de Agentes
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className={`w-12 h-12 border flex items-center justify-center shrink-0 ${accent.border} ${accent.bg}`}>
            <Icon className={`h-5 w-5 ${accent.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="font-mono font-bold text-xl uppercase tracking-wide text-foreground">{agent.name}</h1>
              <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 border ${PROVIDER_BADGE_CLASS[agent.provider]}`}>{agent.provider}</Badge>
              <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-border/50 text-muted-foreground">3 cr/msg</Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{agent.tagline} · {agent.description}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {messages.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={exportChat} className="font-mono text-xs uppercase tracking-widest rounded-sm h-8 px-3 text-muted-foreground hover:text-foreground">
                  <Download className="h-3 w-3 mr-1.5" />Exportar
                </Button>
                <Button variant="ghost" size="sm" onClick={clearChat} className="font-mono text-xs uppercase tracking-widest rounded-sm h-8 px-3 text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-3 w-3 mr-1.5" />Limpar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Context controls */}
      <div className="shrink-0 flex flex-wrap gap-2 mb-3">
        {/* Mode selector */}
        <div className="flex gap-1 border border-border/50 bg-card/40 p-0.5 rounded-sm">
          {(Object.keys(MODE_LABELS) as ContextMode[]).map(m => (
            <button key={m} onClick={() => setContextMode(m)}
              className={`px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-widest transition-all rounded-sm
                ${contextMode === m ? `${accent.bg} ${accent.text} border ${accent.border}` : "text-muted-foreground hover:text-foreground"}`}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Campaign context */}
        {(campaignsData?.campaigns ?? []).length > 0 && (
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
            className="text-[11px] font-mono uppercase tracking-widest bg-card/40 border border-border/50 px-3 py-1.5 text-muted-foreground rounded-sm focus:border-primary/50 focus:outline-none">
            <option value="">Sem contexto de campanha</option>
            {(campaignsData?.campaigns ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto border border-border/50 bg-card/10 p-4 space-y-4 min-h-0">
        {/* Empty state with suggestions */}
        {messages.length === 0 && (
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
            <div key={i} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              {!isUser && (
                <div className={`w-7 h-7 border shrink-0 mt-1 flex items-center justify-center ${accent.border} ${accent.bg}`}>
                  <img src={nexosLogo} alt="AI" className="w-4 h-4 object-contain" />
                </div>
              )}
              {isUser && (
                <div className="w-7 h-7 border border-border/50 bg-muted/20 shrink-0 mt-1 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <div className={`max-w-[85%] px-4 py-3 text-xs font-mono leading-relaxed whitespace-pre-wrap border
                ${isUser ? "bg-primary/15 border-primary/25 text-foreground" : "bg-card/70 border-border/40 text-foreground"}`}>
                {msg.content}
                <div className="mt-2 text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing / retry indicator */}
        {sending && (
          <div className="flex gap-2.5">
            <div className={`w-7 h-7 border shrink-0 flex items-center justify-center ${accent.border} ${accent.bg}`}>
              <Loader2 className={`h-3.5 w-3.5 ${accent.text} animate-spin`} />
            </div>
            <div className="border border-border/40 bg-card/70 px-4 py-3 flex flex-col gap-1.5">
              {retryInfo ? (
                <span className="font-mono text-[11px] text-amber-400/80 uppercase tracking-widest">
                  Tentando novamente {retryInfo.attempt}/{retryInfo.max}…
                </span>
              ) : (
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map(d => (
                    <div key={d} className={`w-1.5 h-1.5 rounded-full animate-bounce ${accent.text.replace("text-", "bg-")}`} style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border border-t-0 border-border/50 p-3 bg-card/20">
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                // Mobile: plain Enter sends (no Ctrl available on virtual keyboard)
                // Desktop: Ctrl+Enter or Meta+Enter sends; plain Enter = new line
                if (isMobile || e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }
            }}
            placeholder={`Fale com ${agent.name}…`}
            disabled={sending} rows={isMobile ? 3 : 4}
            className="flex-1 font-mono text-xs bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-3 py-2.5 resize-y text-foreground placeholder:text-muted-foreground/50 transition-all min-h-[64px]"
          />
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              onPointerDown={e => {
                // On touch only: prevent the textarea from losing focus (and the
                // mobile keyboard from dismissing + reshaping the layout) before
                // the click event fires. For mouse events leave default intact so
                // the click event is never blocked on desktop.
                if (e.pointerType === "touch") e.preventDefault();
              }}
              onClick={() => {
                if (!input.trim()) {
                  inputRef.current?.focus();
                  return;
                }
                void sendMessage();
              }}
              disabled={sending}
              title={isMobile ? "Enviar" : "Enviar (Ctrl+Enter)"}
              className={`font-mono rounded-none h-10 px-4 ${accent.bg} ${accent.border} border hover:brightness-125`}>
              {sending ? <Loader2 className={`h-4 w-4 ${accent.text} animate-spin`} /> : <Send className={`h-4 w-4 ${accent.text}`} />}
            </Button>
            {!isMobile && (
              <Button variant="outline" size="sm" title="Nova linha (Enter)"
                onClick={() => {
                  setInput(v => v + "\n");
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                disabled={sending}
                className="font-mono rounded-none h-10 px-4 border-border/50 text-muted-foreground hover:text-foreground hover:border-border">
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            Modo: {MODE_LABELS[contextMode]} · {selectedCampaign ? "Com contexto de campanha" : "Sem contexto"}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/40">
            {isMobile ? "Enter = enviar · 3 cr/msg" : "Enter = nova linha · Ctrl+Enter = enviar · 3 cr/msg"}
          </span>
        </div>
      </div>
    </div>
  );
}
