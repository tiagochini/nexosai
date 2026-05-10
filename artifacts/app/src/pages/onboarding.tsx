import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Package, ChevronRight, Send, Loader2,
  CheckCircle2, Sparkles, ArrowRight, Star, Bot,
  Mail, MessageSquare, Target, TrendingUp, Shield,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";

// ── Types ─────────────────────────────────────────────────────────────────────
type OnboardingPath = "has_product" | "building_product" | "affiliate_nexos";
type UIStep = "path_select" | "conversation" | "plan_preview";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProductProposal {
  id: string;
  name: string;
  category: string;
  format: string;
  targetAudience: string;
  mainPain: string;
  transformation: string;
  estimatedPrice: number;
  suggestedTrack: string;
  whyViable: string;
}

interface AffiliateStrategy {
  audienceSize: string;
  mainChannel: string;
  suggestedApproach: string;
  revenueProjection: string;
  firstSteps: string[];
}

// ── Path selector ─────────────────────────────────────────────────────────────
const PATHS = [
  {
    id: "has_product" as OnboardingPath,
    icon: Package,
    title: "Tenho um produto",
    subtitle: "Pronto ou em andamento",
    desc: "Curso, mentoria, serviço, software ou produto físico. Vamos montar sua estratégia de lançamento com IA.",
    badge: "Mais comum",
    badgeColor: "text-primary border-primary/40 bg-primary/10",
    glow: "hover:border-primary/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)]",
  },
  {
    id: "building_product" as OnboardingPath,
    icon: Sparkles,
    title: "Tenho expertise mas não tenho produto",
    subtitle: "Vamos criar juntos",
    desc: "Nossa IA analisa suas habilidades e o mercado para propor 3 ideias de produto viáveis — você escolhe e construímos juntos.",
    badge: "IA + Você",
    badgeColor: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
    glow: "hover:border-cyan-400/60 hover:shadow-[0_0_30px_hsl(175_100%_60%/0.12)]",
  },
  {
    id: "affiliate_nexos" as OnboardingPath,
    icon: Star,
    title: "Quero lançar o NexOS AI",
    subtitle: "Programa de afiliados",
    desc: "Torne-se um afiliado parceiro e lance o NexOS AI para o seu público. Comissões recorrentes + suporte completo.",
    badge: "Afiliado",
    badgeColor: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    glow: "hover:border-yellow-400/60 hover:shadow-[0_0_30px_hsl(45_100%_60%/0.12)]",
  },
];

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <img src={nexosLogo} alt="NexOS" className="w-5 h-5 object-contain" />
        </div>
      )}
      <div className={`max-w-[85%] px-4 py-3 rounded-sm text-sm font-mono leading-relaxed whitespace-pre-wrap
        ${isUser
          ? "bg-primary/20 border border-primary/30 text-foreground ml-auto"
          : "bg-card/80 border border-border/50 text-foreground"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

// ── Product proposal card ─────────────────────────────────────────────────────
function ProposalCard({ proposal, onSelect }: { proposal: ProductProposal; onSelect: (p: ProductProposal) => void }) {
  return (
    <div
      className="border border-border/50 bg-card/60 p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden rounded-sm"
      onClick={() => onSelect(proposal)}
    >
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">{proposal.name}</h3>
        <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border-primary/40 text-primary bg-primary/10 shrink-0">
          R$ {proposal.estimatedPrice.toLocaleString("pt-BR")}
        </Badge>
      </div>

      <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground">
        <p><span className="text-foreground/70">Formato:</span> {proposal.format}</p>
        <p><span className="text-foreground/70">Público:</span> {proposal.targetAudience}</p>
        <p><span className="text-foreground/70">Transformação:</span> {proposal.transformation}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
        <p className="text-xs font-mono text-success italic">{proposal.whyViable}</p>
        <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
      </div>
    </div>
  );
}

// ── localStorage persistence ──────────────────────────────────────────────────
const ONBOARDING_KEY = "nexos-onboarding-state";

interface OnboardingState {
  path: OnboardingPath;
  campaignId: string;
  step: UIStep;
  messages: ChatMessage[];
  conversationComplete: boolean;
}

function loadOnboardingState(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch { return null; }
}

function saveOnboardingState(state: OnboardingState) {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function clearOnboardingState() {
  localStorage.removeItem(ONBOARDING_KEY);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<UIStep>("path_select");
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [proposals, setProposals] = useState<ProductProposal[] | null>(null);
  const [affiliateStrategy, setAffiliateStrategy] = useState<AffiliateStrategy | null>(null);
  const [conversationComplete, setConversationComplete] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore saved onboarding state on mount
  useEffect(() => {
    const saved = loadOnboardingState();
    if (saved && saved.messages.length > 0 && saved.campaignId) {
      setPath(saved.path);
      setCampaignId(saved.campaignId);
      setStep(saved.step);
      setMessages(saved.messages);
      setConversationComplete(saved.conversationComplete);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Select path and create campaign ──────────────────────────────────────────
  const handlePathSelect = async (selectedPath: OnboardingPath) => {
    setPath(selectedPath);
    setStarting(true);
    try {
      const res = await customFetch<Response>("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath }),
      });
      if (!res.ok) throw new Error("Falha ao iniciar");
      const data = await res.json() as { campaign: { id: string }; path: string };
      const cid = data.campaign.id;
      setCampaignId(cid);
      setStep("conversation");

      // Initial AI greeting based on path
      const greetings: Record<OnboardingPath, string> = {
        has_product: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vou te ajudar a preparar tudo para o lançamento do seu produto.\n\nComeça me contando: qual é o nome do seu produto e o que ele entrega para o cliente?`,
        building_product: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vai ser um prazer ajudar você a encontrar o produto ideal.\n\nVamos começar do seu perfil. Qual é a sua área de atuação ou especialidade principal? (ex: nutrição, finanças, tecnologia, fitness, educação...)`,
        affiliate_nexos: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Bem-vindo ao programa de afiliados NexOS AI.\n\nComo afiliado, você vai lançar a plataforma para o seu público e ganhar comissões recorrentes por cada assinante ativo.\n\nPara montar sua estratégia, me conta: qual é o seu público atual? Tem seguidores, lista de email, grupo ou comunidade?`,
      };
      const initMsgs = [{ role: "assistant" as const, content: greetings[selectedPath] }];
      setMessages(initMsgs);
      saveOnboardingState({ path: selectedPath, campaignId: cid, step: "conversation", messages: initMsgs, conversationComplete: false });
    } catch {
      toast.error("Erro ao iniciar. Tente novamente.");
    } finally {
      setStarting(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || sending || !path || !campaignId) return;
    const userMsg = inputValue.trim();
    setInputValue("");
    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);
    setSending(true);

    try {
      const history = newMessages.slice(0, -1); // exclude the last user message since we send it separately
      let endpoint = "";
      let body: Record<string, unknown> = { message: userMsg, history };

      if (path === "has_product") {
        endpoint = `/api/intake/${campaignId}/conversation`;
      } else if (path === "building_product") {
        endpoint = "/api/onboarding/product-finder/message";
        body = { message: userMsg, history, campaignId };
      } else {
        endpoint = "/api/onboarding/affiliate-nexos/message";
        body = { message: userMsg, history };
      }

      const res = await customFetch<Response>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Falha na resposta da IA");
      const data = await res.json() as {
        aiMessage?: string;
        message?: string;
        productProposals?: ProductProposal[];
        affiliateStrategy?: AffiliateStrategy;
        isComplete?: boolean;
      };

      const aiText = data.aiMessage ?? data.message ?? "...";
      const withAi: ChatMessage[] = [...newMessages, { role: "assistant", content: aiText }];
      setMessages(withAi);

      const complete = data.isComplete ?? false;
      if (data.productProposals?.length) setProposals(data.productProposals);
      if (data.affiliateStrategy) setAffiliateStrategy(data.affiliateStrategy);
      if (complete) setConversationComplete(true);

      // Persist updated conversation
      if (path && campaignId) {
        saveOnboardingState({ path, campaignId, step, messages: withAi, conversationComplete: complete });
      }
    } catch {
      toast.error("Erro de comunicação com a IA. Tente novamente.");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Select product proposal ───────────────────────────────────────────────────
  const handleProposalSelect = async (proposal: ProductProposal) => {
    setProposals(null);
    const msg = `Quero o produto "${proposal.name}" — ${proposal.format} para ${proposal.targetAudience}.`;
    setInputValue(msg);
    setTimeout(() => handleSend(), 50);
  };

  // ── Show plan preview then navigate ──────────────────────────────────────────
  const handleFinish = () => {
    setStep("plan_preview");
  };

  const handleLaunch = () => {
    clearOnboardingState(); // wipe saved state — onboarding is complete
    if (path === "has_product" && campaignId) {
      setLocation(`/campaigns/${campaignId}/intake`);
    } else if (campaignId) {
      setLocation(`/campaigns/${campaignId}`);
    } else {
      setLocation("/");
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────

  if (step === "path_select") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-3xl animate-in fade-in duration-700">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <img src={nexosLogo} alt="NexOS" className="h-24 w-24 md:h-28 md:w-28 object-contain relative z-10" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground mb-3">
              Bem-vindo ao NexOS AI
            </h1>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              Qual é a sua situação hoje?
            </p>
          </div>

          {/* Path cards */}
          <div className="grid grid-cols-1 gap-4">
            {PATHS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePathSelect(p.id)}
                  disabled={starting}
                  className={`text-left w-full border border-border/50 bg-card/40 backdrop-blur-sm p-5 md:p-6 transition-all duration-200 relative overflow-hidden group ${p.glow} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/30 group-hover:border-primary transition-colors" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/30 group-hover:border-primary transition-colors" />

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center shrink-0 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                      {starting && path === p.id
                        ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        : <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-mono font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                        <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 ${p.badgeColor}`}>
                          {p.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-2">{p.subtitle}</p>
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed">{p.desc}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-3" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs font-mono text-muted-foreground/50 uppercase tracking-widest mt-8">
            Você pode mudar de caminho a qualquer momento
          </p>
        </div>
      </div>
    );
  }

  if (step === "conversation") {
    const pathMeta = PATHS.find((p) => p.id === path)!;

    return (
      <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] max-w-3xl mx-auto">
        {/* Chat header */}
        <div className="border-b border-border/50 pb-4 mb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <div>
              <h2 className="font-mono font-bold text-sm text-foreground uppercase tracking-widest">
                {path === "has_product" ? "Briefing Estratégico" : path === "building_product" ? "Product Discovery" : "Estratégia de Afiliado"}
              </h2>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                {pathMeta.subtitle}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-1 ${pathMeta.badgeColor}`}>
            {pathMeta.badge}
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} />
          ))}

          {/* Product proposals */}
          {proposals && proposals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-1">
                Selecione a proposta que mais combina com você:
              </p>
              {proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} onSelect={handleProposalSelect} />
              ))}
            </div>
          )}

          {/* Affiliate strategy card */}
          {affiliateStrategy && (
            <div className="border border-yellow-400/30 bg-yellow-400/5 p-4 rounded-sm space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-yellow-400">Sua Estratégia de Afiliado</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                <div><span className="text-muted-foreground">Público: </span>{affiliateStrategy.audienceSize}</div>
                <div><span className="text-muted-foreground">Canal: </span>{affiliateStrategy.mainChannel}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Projeção: </span><span className="text-success">{affiliateStrategy.revenueProjection}</span></div>
              </div>
              {affiliateStrategy.firstSteps.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Primeiros passos:</p>
                  <ul className="space-y-1">
                    {affiliateStrategy.firstSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Complete CTA */}
          {conversationComplete && (
            <div className="border border-success/30 bg-success/5 p-4 rounded-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-success">
                  {path === "has_product" ? "Briefing concluído!" : path === "building_product" ? "Produto definido!" : "Estratégia pronta!"}
                </span>
              </div>
              <Button
                onClick={handleFinish}
                className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11"
              >
                <ArrowRight className="h-4 w-4" />
                {path === "has_product" ? "Acessar Intake Completo" : "Ir para Minha Campanha"}
              </Button>
            </div>
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="bg-card/80 border border-border/50 px-4 py-3 rounded-sm">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        {!conversationComplete && (
          <div className="border-t border-border/50 pt-4 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                }}
                placeholder="Digite sua resposta… (Enter para enviar)"
                disabled={sending}
                rows={2}
                className="flex-1 font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-4 py-3 resize-none text-foreground placeholder:text-muted-foreground/50 transition-all"
              />
              <Button
                onClick={() => void handleSend()}
                disabled={sending || !inputValue.trim()}
                className="font-mono rounded-none h-[70px] px-4 btn-weapon-primary shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-2 text-right">
              Shift+Enter para nova linha
            </p>
          </div>
        )}

        {conversationComplete && !affiliateStrategy && !proposals && (
          <div className="border-t border-border/50 pt-4 shrink-0">
            <Button
              onClick={handleFinish}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12"
            >
              <ArrowRight className="h-4 w-4" />
              {path === "has_product" ? "Continuar para Intake Completo" : "Ir para Minha Campanha"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── PLAN PREVIEW ─────────────────────────────────────────────────────────────
  if (step === "plan_preview") {
    const DAY_PLAN = [
      { day: 1, phase: "Pré-lançamento", activity: "Aquecimento de audiência + conteúdo de antecipação publicado", icon: Target, color: "border-primary/40 bg-primary/10 text-primary" },
      { day: 2, phase: "Pré-lançamento", activity: "Lista de espera ativada + sequência de email iniciada", icon: Mail, color: "border-primary/40 bg-primary/10 text-primary" },
      { day: 3, phase: "Abertura", activity: "Carrinho aberto + VSL publicado + email blast para lista", icon: Rocket, color: "border-success/40 bg-success/10 text-success" },
      { day: 4, phase: "Abertura", activity: "Nurturing automático + WhatsApp ativo para leads quentes", icon: MessageSquare, color: "border-success/40 bg-success/10 text-success" },
      { day: 5, phase: "Urgência", activity: "Email de bônus + social proof + remarketing ativado", icon: TrendingUp, color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" },
      { day: 6, phase: "Urgência", activity: "Escassez real + último aviso para indecisos", icon: Shield, color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" },
      { day: 7, phase: "Fechamento", activity: "Carrinho fecha às 23:59 + sequência de última hora", icon: CheckCircle2, color: "border-orange-400/40 bg-orange-400/10 text-orange-400" },
    ];

    const CHAT_AGENTS = [
      { label: "Comandante IA",          color: "text-primary",     cat: "Estratégia" },
      { label: "Estrategista",           color: "text-primary",     cat: "Estratégia" },
      { label: "Gerente de Lançamento",  color: "text-primary",     cat: "Estratégia" },
      { label: "Especialista em Oferta", color: "text-primary",     cat: "Estratégia" },
      { label: "Product Builder",        color: "text-primary",     cat: "Estratégia" },
      { label: "Copywriter",             color: "text-cyan-400",    cat: "Conteúdo" },
      { label: "Diretor Criativo",       color: "text-cyan-400",    cat: "Conteúdo" },
      { label: "Landing Page Expert",    color: "text-cyan-400",    cat: "Conteúdo" },
      { label: "Targeting Expert",       color: "text-yellow-400",  cat: "Audiência" },
      { label: "Media Buyer",            color: "text-yellow-400",  cat: "Audiência" },
      { label: "Especialista Afiliados", color: "text-yellow-400",  cat: "Audiência" },
      { label: "Analista de Performance",color: "text-success",     cat: "Performance" },
      { label: "Otimizador IA",          color: "text-success",     cat: "Performance" },
      { label: "Estrategista de Vídeo",  color: "text-success",     cat: "Performance" },
      { label: "Creator Growth",         color: "text-success",     cat: "Performance" },
      { label: "Compliance Officer",     color: "text-orange-400",  cat: "Qualidade" },
    ];
    const AUTO_AGENTS = [
      "VSL Script", "Roteiro Webinar", "Roteiro Live", "Copy de Anúncios",
      "Script CPL", "Sequência Stories", "Brief de Mídia", "Profile Builder",
      "Projetor Financeiro", "Builder de Sequências", "Social Media IA",
      "Auto-Resposta WhatsApp", "Lançamento Perpétuo",
    ];

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 py-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 border border-success/40 bg-success/10 px-3 py-1.5 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="font-mono text-xs uppercase tracking-widest text-success">Plano Gerado pela IA</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tighter text-foreground mb-2">
            Seu Lançamento em 7 Dias
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            NexOS executa cada fase automaticamente — você só aprova
          </p>
        </div>

        {/* 7-day timeline strip */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_PLAN.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.day} className={`border p-2 text-center ${d.color}`}>
                <div className="font-mono text-[11px] uppercase tracking-widest opacity-60 mb-1.5">D{d.day}</div>
                <Icon className="h-3.5 w-3.5 mx-auto mb-1.5" />
                <div className="font-mono text-[11px] font-bold uppercase leading-tight hidden sm:block">{d.phase}</div>
              </div>
            );
          })}
        </div>

        {/* Day details */}
        <div className="space-y-1.5">
          {DAY_PLAN.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.day} className={`border px-4 py-2.5 flex items-center gap-4 ${d.color}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-[11px] font-bold w-6 shrink-0">{d.day}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest opacity-60 w-24 shrink-0 hidden md:block">{d.phase}</span>
                <span className="font-mono text-xs text-foreground leading-relaxed">{d.activity}</span>
              </div>
            );
          })}
        </div>

        {/* AI Agents grid */}
        <div className="border border-border/50 bg-card/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Sistema de 29 Agentes IA
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-0.5">
                16 chat direto
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5">
                13 autônomos
              </span>
            </div>
          </div>

          {/* Direct-chat agents by category */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">
              Disponíveis para consulta direta
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {CHAT_AGENTS.map((agent) => (
                <div key={agent.label} className={`border border-current/15 bg-current/5 px-2 py-1.5 ${agent.color}`}>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide leading-tight block">{agent.label}</span>
                  <span className="font-mono text-[7px] text-muted-foreground/50 uppercase">{agent.cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomous agents */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">
              Executados automaticamente durante campanhas
            </p>
            <div className="flex flex-wrap gap-1">
              {AUTO_AGENTS.map((name) => (
                <span key={name} className="font-mono text-[11px] border border-cyan-400/20 bg-cyan-400/5 text-cyan-400/70 px-2 py-1 uppercase tracking-wide">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue projection */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "6 Dígitos", value: "R$ 100k–999k", color: "border-primary/40 text-primary", active: path !== "affiliate_nexos" },
            { label: "8 Dígitos", value: "R$ 10M–99M", color: "border-cyan-400/40 text-cyan-400", active: false },
            { label: "10 Dígitos", value: "R$ 100M+", color: "border-yellow-400/40 text-yellow-400", active: false },
          ].map(track => (
            <div key={track.label} className={`border px-3 py-2.5 text-center relative ${track.color} ${track.active ? "bg-primary/5" : "opacity-40"}`}>
              {track.active && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 border-primary/40 text-primary bg-background">
                    Seu track
                  </Badge>
                </div>
              )}
              <div className="font-mono text-[11px] uppercase tracking-widest opacity-60 mb-1">{track.label}</div>
              <div className="font-mono text-xs font-bold">{track.value}</div>
              <div className="font-mono text-[11px] text-muted-foreground">em 7 dias</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="border border-primary/30 bg-primary/5 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary" />
          <div className="text-center">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
              Próximo passo: Briefing Completo com a IA
            </div>
            <Button
              onClick={handleLaunch}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 text-sm"
            >
              <Rocket className="h-4 w-4" />
              {path === "has_product" ? "Iniciar Briefing Estratégico" : "Ir para Minha Campanha"}
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-2">
              A IA conduz você pelo restante do processo — leva ~8 minutos
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
