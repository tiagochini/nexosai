import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Loader2, Bot, Brain, Zap, Target, Pen, Eye,
  ShoppingCart, Users, BarChart3, TrendingUp, Video, Star,
  Shield, Rocket, Megaphone, Globe, RefreshCw, Download,
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

export default function AgentChat() {
  const [, params] = useRoute("/agents/:role");
  const role = params?.role ?? "command";
  const agent = AGENT_INFO[role] ?? AGENT_INFO.command!;
  const accent = ACCENT_CLASSES[agent.accentColor] ?? ACCENT_CLASSES.primary!;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>("question");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: campaignsData } = useListCampaigns({ query: { queryKey: getListCampaignsQueryKey() } });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    inputRef.current?.focus();
  }, [role]);

  const sendMessage = async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if (!text || sending) return;
    setInput("");
    const newMsg: ChatMsg = { role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, newMsg]);
    setSending(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await customFetch<Response>("/api/agents/direct-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentRole: role, message: text,
          history, contextMode,
          ...(selectedCampaign ? { campaignId: selectedCampaign } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Erro na comunicação com o agente");
      }

      const data = await res.json() as { response: string; tokensUsed: number; creditsCharged: number };
      setMessages(prev => [...prev, { role: "assistant", content: data.response, timestamp: new Date() }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de comunicação");
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => setMessages([]);

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

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-2.5">
            <div className={`w-7 h-7 border shrink-0 flex items-center justify-center ${accent.border} ${accent.bg}`}>
              <Loader2 className={`h-3.5 w-3.5 ${accent.text} animate-spin`} />
            </div>
            <div className="border border-border/40 bg-card/70 px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(d => (
                  <div key={d} className={`w-1.5 h-1.5 rounded-full animate-bounce ${accent.text.replace("text-", "bg-")}`} style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
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
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
            placeholder={`Fale com ${agent.name}… (Enter para enviar, Shift+Enter nova linha)`}
            disabled={sending} rows={2}
            className="flex-1 font-mono text-xs bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-3 py-2.5 resize-none text-foreground placeholder:text-muted-foreground/50 transition-all"
          />
          <Button onClick={() => void sendMessage()} disabled={sending || !input.trim()}
            className={`font-mono rounded-none h-[66px] px-4 shrink-0 ${accent.bg} ${accent.border} border hover:brightness-125`}>
            {sending ? <Loader2 className={`h-4 w-4 ${accent.text} animate-spin`} /> : <Send className={`h-4 w-4 ${accent.text}`} />}
          </Button>
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            Modo: {MODE_LABELS[contextMode]} · {selectedCampaign ? "Com contexto de campanha" : "Sem contexto"}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/40">3 créditos por mensagem</span>
        </div>
      </div>
    </div>
  );
}
