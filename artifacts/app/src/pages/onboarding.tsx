import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Package, ChevronRight, Send, Loader2,
  CheckCircle2, Sparkles, ArrowRight, Star, Bot,
  Mail, MessageSquare, Target, TrendingUp, Shield,
  Users, Video, BarChart2, Link2, Wifi, WifiOff,
  Phone, CreditCard, Megaphone, ExternalLink, RefreshCw, CornerDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";

// ── Types ─────────────────────────────────────────────────────────────────────
type OnboardingPath = "has_product" | "building_product" | "affiliate_nexos" | "has_audience";
type AudienceSubPath = "micro_launch" | "members_area" | "product_from_audience";
type UIStep = "welcome" | "path_select" | "audience_subpath" | "conversation" | "plan_preview" | "diagnosis_approval" | "integration_setup";

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

interface AudienceMonetizationPlan {
  approachTitle: string;
  subPath: AudienceSubPath;
  audienceSummary: string;
  platformFocus: string;
  monetizationModel: string;
  suggestedProductName: string;
  priceRange: string;
  launchTimeline: string;
  firstSteps: string[];
  revenueProjection: string;
  whyItWorks: string;
}

// ── Integration catalog (subset relevant for onboarding) ──────────────────────
interface IntegrationItem {
  provider: string;
  label: string;
  description: string;
  benefit: Record<OnboardingPath, string>;
  category: "mensagens" | "email" | "pagamento" | "social";
  icon: React.ElementType;
  iconColor: string;
  required: boolean;
}

const INTEGRATION_CATALOG: IntegrationItem[] = [
  {
    provider: "whatsapp_business",
    label: "WhatsApp Business",
    description: "Disparo automático de mensagens segmentadas para leads quentes, mornos e frios.",
    benefit: {
      has_product:        "Sequências de WhatsApp com gatilhos mentais disparadas nos horários certos do lançamento",
      building_product:   "Notificações de lançamento e nurturing direto no WhatsApp da sua audiência",
      affiliate_nexos:    "Distribuição automática de conteúdo e links de afiliado para seus contatos",
      has_audience:       "Mensagens de abertura de carrinho enviadas para os fãs mais engajados primeiro",
    },
    category: "mensagens",
    icon: Phone,
    iconColor: "text-green-400",
    required: true,
  },
  {
    provider: "rd_station",
    label: "RD Station",
    description: "E-mail marketing e automação de leads com integração total ao lançamento.",
    benefit: {
      has_product:        "23 emails de lançamento disparados automaticamente — captação, nurturing e escassez",
      building_product:   "Sequência de e-mails para validar sua ideia de produto com sua base",
      affiliate_nexos:    "Automação de e-mail para aquecimento e conversão de afiliados",
      has_audience:       "E-mails de pré-lançamento para monetizar sua lista existente",
    },
    category: "email",
    icon: Mail,
    iconColor: "text-blue-400",
    required: true,
  },
  {
    provider: "activecampaign",
    label: "ActiveCampaign",
    description: "CRM e automação avançada de e-mail com segmentação comportamental.",
    benefit: {
      has_product:        "Automações de e-mail baseadas em comportamento (abriu, clicou, comprou)",
      building_product:   "CRM integrado para acompanhar leads durante a descoberta do produto",
      affiliate_nexos:    "Tags automáticas por engajamento para priorizar os afiliados mais quentes",
      has_audience:       "Segmentação de audiência por comportamento para máxima conversão",
    },
    category: "email",
    icon: Mail,
    iconColor: "text-blue-400",
    required: false,
  },
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Plataforma de produtos digitais — compra automática converte o contato para cliente.",
    benefit: {
      has_product:        "Quando alguém compra no Hotmart, o NexOS move o contato para segmento 'convertido' automaticamente",
      building_product:   "Lance seu novo produto diretamente na Hotmart com checkout já integrado",
      affiliate_nexos:    "Rastreamento automático de vendas dos afiliados com comissões registradas",
      has_audience:       "Venda o produto do micro-lançamento no Hotmart com funil totalmente automatizado",
    },
    category: "pagamento",
    icon: CreditCard,
    iconColor: "text-orange-400",
    required: false,
  },
  {
    provider: "kiwify",
    label: "Kiwify",
    description: "Checkout e gestão de produtos digitais com conversão automática de leads.",
    benefit: {
      has_product:        "Compras no Kiwify trigam automações de pós-venda no NexOS instantaneamente",
      building_product:   "Checkout rápido para o seu produto novo com upsell configurado pela IA",
      affiliate_nexos:    "Monitoramento de vendas de afiliados com atualização de segmentos em tempo real",
      has_audience:       "Carrinho de alta conversão para o micro-lançamento com pós-venda automatizado",
    },
    category: "pagamento",
    icon: CreditCard,
    iconColor: "text-orange-400",
    required: false,
  },
  {
    provider: "meta_ads",
    label: "Meta Ads",
    description: "Facebook e Instagram Ads — remarketing automático para leads que não converteram.",
    benefit: {
      has_product:        "Remarketing automático para leads que não abriram emails ou clicaram em links",
      building_product:   "Audiências de interesse para validar a ideia do produto antes de construir",
      affiliate_nexos:    "Anúncios de afiliado otimizados automaticamente pelo agente Media Buyer",
      has_audience:       "Amplificar conteúdo orgânico com tráfego pago sincronizado ao calendário de lançamento",
    },
    category: "social",
    icon: Megaphone,
    iconColor: "text-cyan-400",
    required: false,
  },
  {
    provider: "tiktok",
    label: "TikTok",
    description: "Auto-post de vídeos e reels no TikTok sincronizados ao calendário de lançamento.",
    benefit: {
      has_product:        "Vídeos de lançamento postados automaticamente no TikTok nos horários de maior alcance",
      building_product:   "Conteúdo de validação do produto publicado no TikTok para atrair primeiros compradores",
      affiliate_nexos:    "Vídeos de afiliado gerados pela IA e postados no TikTok com links de rastreamento",
      has_audience:       "Reels de pré-lançamento disparados automaticamente para engajar sua audiência no TikTok",
    },
    category: "social",
    icon: Video,
    iconColor: "text-pink-400",
    required: false,
  },
];

const PATH_INTEGRATIONS: Record<OnboardingPath, string[]> = {
  has_product:      ["whatsapp_business", "rd_station", "activecampaign", "hotmart", "kiwify", "tiktok"],
  building_product: ["whatsapp_business", "rd_station", "tiktok"],
  affiliate_nexos:  ["whatsapp_business", "rd_station", "tiktok"],
  has_audience:     ["whatsapp_business", "rd_station", "meta_ads", "tiktok"],
};

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
  {
    id: "has_audience" as OnboardingPath,
    icon: Users,
    title: "Tenho audiência, quero monetizar",
    subtitle: "Creator economy · micro-lançamento · membros",
    desc: "Você já tem seguidores, canal ou comunidade. A IA descobre o modelo certo — micro-lançamento, área de membros ou produto derivado — e executa tudo.",
    badge: "Creator",
    badgeColor: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    glow: "hover:border-emerald-400/60 hover:shadow-[0_0_30px_hsl(160_84%_39%/0.12)]",
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
  audienceSubPath?: AudienceSubPath;
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

// ── Simulator pre-fill helpers ────────────────────────────────────────────────
interface SimulatorData {
  firstName: string;
  productName: string;
  productType: string;
  niche?: string;
  revenueGoal?: string;
  email: string;
  whatsapp: string;
  simulatedAt: string;
}

function loadSimulatorData(): SimulatorData | null {
  try {
    const raw = localStorage.getItem("nexos_simulator_data");
    if (!raw) return null;
    return JSON.parse(raw) as SimulatorData;
  } catch { return null; }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<UIStep>("welcome");
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [simulatorBanner, setSimulatorBanner] = useState<SimulatorData | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [proposals, setProposals] = useState<ProductProposal[] | null>(null);
  const [affiliateStrategy, setAffiliateStrategy] = useState<AffiliateStrategy | null>(null);
  const [audienceMonetizationPlan, setAudienceMonetizationPlan] = useState<AudienceMonetizationPlan | null>(null);
  const [audienceSubPath, setAudienceSubPath] = useState<AudienceSubPath | null>(null);
  const [conversationComplete, setConversationComplete] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore saved onboarding state on mount + check simulator pre-fill
  useEffect(() => {
    const saved = loadOnboardingState();
    if (saved && saved.messages.length > 0 && saved.campaignId) {
      setPath(saved.path);
      setCampaignId(saved.campaignId);
      setStep(saved.step);
      setMessages(saved.messages);
      setConversationComplete(saved.conversationComplete);
      if (saved.audienceSubPath) setAudienceSubPath(saved.audienceSubPath);
    } else {
      // Check for simulator data from the landing page
      const sim = loadSimulatorData();
      if (sim) setSimulatorBanner(sim);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Select path and create campaign ──────────────────────────────────────────
  const handlePathSelect = async (selectedPath: OnboardingPath) => {
    if (selectedPath === "has_audience") {
      setPath(selectedPath);
      setStep("audience_subpath");
      return;
    }
    setPath(selectedPath);
    setStarting(true);
    try {
      const data = await customFetch<{ campaign: { id: string }; path: string }>("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath }),
      });
      const cid = data.campaign.id;
      setCampaignId(cid);
      setStep("conversation");

      const greetings: Record<OnboardingPath, string> = {
        has_product: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vou te ajudar a preparar tudo para o lançamento do seu produto.\n\nComeça me contando: qual é o nome do seu produto e o que ele entrega para o cliente?`,
        building_product: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vai ser um prazer ajudar você a encontrar o produto ideal.\n\nVamos começar do seu perfil. Qual é a sua área de atuação ou especialidade principal? (ex: nutrição, finanças, tecnologia, fitness, educação...)`,
        affiliate_nexos: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Bem-vindo ao programa de afiliados NexOS AI.\n\nComo afiliado, você vai lançar a plataforma para o seu público e ganhar comissões recorrentes por cada assinante ativo.\n\nPara montar sua estratégia, me conta: qual é o seu público atual? Tem seguidores, lista de email, grupo ou comunidade?`,
        has_audience: "",
      };
      const initMsgs = [{ role: "assistant" as const, content: greetings[selectedPath] }];
      setMessages(initMsgs);
      saveOnboardingState({ path: selectedPath, campaignId: cid, step: "conversation", messages: initMsgs, conversationComplete: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", { duration: 6000 });
      } else {
        toast.error("Erro ao iniciar. Tente novamente.");
      }
    } finally {
      setStarting(false);
    }
  };

  // ── Select audience sub-path and create campaign ───────────────────────────
  const handleAudienceSubPathSelect = async (subPath: AudienceSubPath) => {
    setAudienceSubPath(subPath);
    setStarting(true);
    try {
      const data = await customFetch<{ campaign: { id: string } }>("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "has_audience", audienceSubPath: subPath }),
      });
      const cid = data.campaign.id;
      setCampaignId(cid);
      setStep("conversation");

      const firstName = user?.name ? `, ${user.name.split(" ")[0]}` : "";
      const subPathGreetings: Record<AudienceSubPath, string> = {
        micro_launch: `Olá${firstName}! Excelente escolha — micro-lançamento é a forma mais rápida de monetizar uma audiência existente.\n\nPrimeira pergunta: em qual plataforma você está mais ativo? (YouTube, Instagram, TikTok, Kwai, Telegram, outros?)`,
        members_area: `Olá${firstName}! Área de membros é o modelo de renda recorrente mais poderoso para creators.\n\nMe conta: em qual plataforma você publica seu conteúdo hoje e quantos seguidores ou inscritos você tem aproximadamente?`,
        product_from_audience: `Olá${firstName}! Transformar audiência em produto é o jeito mais inteligente de monetizar — você já tem a lista quente.\n\nPrimeira pergunta: qual plataforma é o seu principal canal e qual é o nicho do seu conteúdo?`,
      };

      const initMsgs = [{ role: "assistant" as const, content: subPathGreetings[subPath] }];
      setMessages(initMsgs);
      saveOnboardingState({ path: "has_audience", campaignId: cid, step: "conversation", messages: initMsgs, conversationComplete: false, audienceSubPath: subPath });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", { duration: 6000 });
      } else {
        toast.error("Erro ao iniciar. Tente novamente.");
      }
    } finally {
      setStarting(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || sending || !path || !campaignId) return;
    const userMsg = inputValue.trim();

    // Do NOT clear input before the request succeeds — if the token expires or
    // the network fails the user's text must survive for retry.
    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);
    setSending(true);

    try {
      const history = newMessages.slice(0, -1);
      let endpoint = "";
      let body: Record<string, unknown> = { message: userMsg, history };

      if (path === "has_product") {
        endpoint = `/api/intake/${campaignId}/conversation`;
      } else if (path === "building_product") {
        endpoint = "/api/onboarding/product-finder/message";
        body = { message: userMsg, history, campaignId };
      } else if (path === "has_audience") {
        endpoint = "/api/onboarding/audience-monetization/message";
        body = { message: userMsg, history, subPath: audienceSubPath ?? "micro_launch", campaignId };
      } else {
        endpoint = "/api/onboarding/affiliate-nexos/message";
        body = { message: userMsg, history };
      }

      const data = await customFetch<{
        aiMessage?: string;
        message?: string;
        productProposals?: ProductProposal[];
        affiliateStrategy?: AffiliateStrategy;
        plan?: AudienceMonetizationPlan;
        isComplete?: boolean;
      }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Only clear input after confirmed success
      setInputValue("");

      const aiText = data.aiMessage ?? data.message ?? "...";
      const withAi: ChatMessage[] = [...newMessages, { role: "assistant", content: aiText }];
      setMessages(withAi);

      const complete = data.isComplete ?? false;
      if (data.productProposals?.length) setProposals(data.productProposals);
      if (data.affiliateStrategy) setAffiliateStrategy(data.affiliateStrategy);
      if (data.plan) setAudienceMonetizationPlan(data.plan);
      if (complete) setConversationComplete(true);

      if (path && campaignId) {
        saveOnboardingState({ path, campaignId, step, messages: withAi, conversationComplete: complete, audienceSubPath: audienceSubPath ?? undefined });
      }
    } catch {
      // Revert the optimistic user message and restore the typed text
      setMessages(messages);
      setInputValue(userMsg);
      toast.error("Erro de comunicação com a IA. Sua mensagem foi preservada. Tente novamente.", { duration: 6000 });
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

  // ── Integration wizard state ──────────────────────────────────────────────────
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [refreshingIntegrations, setRefreshingIntegrations] = useState(false);

  const fetchConnectedIntegrations = async (silent = false) => {
    if (!silent) setLoadingIntegrations(true);
    else setRefreshingIntegrations(true);
    try {
      const data = await customFetch<{ integrations: { provider: string; status: string }[] }>("/api/workspaces/me/integrations");
      setConnectedIntegrations(
        (data.integrations ?? [])
          .filter((i) => i.status === "connected")
          .map((i) => i.provider)
      );
    } catch { /* silent */ }
    finally {
      setLoadingIntegrations(false);
      setRefreshingIntegrations(false);
    }
  };

  // ── Show plan preview then navigate ──────────────────────────────────────────
  const handleFinish = () => {
    setStep("plan_preview");
  };

  const handleGoToDiagnosis = () => {
    setStep("diagnosis_approval");
  };

  const handleGoToIntegrations = () => {
    setStep("integration_setup");
    void fetchConnectedIntegrations();
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

  // ── Step: welcome — "Time de Briefing NEXOS" ─────────────────────────────────
  if (step === "welcome") {
    const firstName = user?.name?.split(" ")[0] ?? "você";
    const BRIEFING_AGENTS = [
      { name: "Business Discovery",  desc: "Entende seu negócio e produto" },
      { name: "Market Psychology",   desc: "Analisa seu mercado e concorrência" },
      { name: "Avatar Intelligence", desc: "Mapeia seu público ideal" },
      { name: "Product Development", desc: "Valida e estrutura sua oferta" },
      { name: "Monetization Agent",  desc: "Define modelo e precificação" },
      { name: "Positioning Agent",   desc: "Encontra seu diferencial único" },
      { name: "NEXOS Prime",         desc: "Orquestra toda a operação" },
    ];

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-2xl animate-in fade-in duration-700">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={nexosLogo} alt="NexOS AI" className="h-8 opacity-80" />
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
                Time de Briefing NEXOS · ativo
              </span>
            </div>
            <h1 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground mb-4">
              Olá, <span className="text-primary">{firstName}</span>.<br />
              Sua equipe está pronta para você.
            </h1>
            <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-lg mx-auto">
              Antes de montar sua campanha, vamos conversar. Um time de especialistas vai
              entender seu negócio, seu público e sua oferta — e transformar tudo em um
              plano estratégico personalizado.
            </p>
          </div>

          {/* Time de agentes */}
          <div className="border border-border/30 bg-card/20 p-5 mb-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4 text-center">
              Especialistas escalados para o seu briefing
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BRIEFING_AGENTS.map((agent) => (
                <div key={agent.name} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <div>
                    <span className="font-mono text-[11px] font-bold text-foreground/80">{agent.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/40 ml-2">— {agent.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              onClick={() => setStep("path_select")}
              className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-13 px-10 text-sm"
            >
              <Bot className="h-4 w-4" />
              Vamos entender meu negócio
              <ChevronRight className="h-4 w-4" />
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/30 mt-3">
              Leva menos de 5 minutos · Você pode salvar e continuar depois
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "audience_subpath") {
    const SUB_PATHS: { id: AudienceSubPath; icon: typeof Video; title: string; subtitle: string; desc: string; badge: string }[] = [
      {
        id: "micro_launch",
        icon: Rocket,
        title: "Micro-lançamento por conteúdo",
        subtitle: "0 a 7 dias do zero ao faturamento",
        desc: "Crie um produto de entrada (R$97–R$497) baseado no conteúdo que você já publica. A IA monta a oferta, escreve o copy e conduz o lançamento pelo seu canal.",
        badge: "Mais rápido",
      },
      {
        id: "members_area",
        icon: Users,
        title: "Área de membros perpétua",
        subtitle: "Renda recorrente todo mês",
        desc: "Transforme sua audiência engajada em assinantes pagantes. Conteúdo exclusivo, comunidade fechada e renda previsível mês a mês.",
        badge: "Recorrência",
      },
      {
        id: "product_from_audience",
        icon: BarChart2,
        title: "Produto derivado da audiência",
        subtitle: "Lançamento PLF completo",
        desc: "Sua audiência já é sua lista quente. A IA analisa o público, cria o produto ideal, monta a sequência de lançamento completa e executa automaticamente.",
        badge: "Lançamento completo",
      },
    ];

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-3xl animate-in fade-in duration-700">
          <div className="text-center mb-10">
            <button
              onClick={() => { setStep("path_select"); setPath(null); }}
              className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest hover:text-foreground transition-colors mb-6 flex items-center gap-1.5 mx-auto"
            >
              <ChevronRight className="h-3 w-3 rotate-180" /> Voltar
            </button>
            <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-3 py-1 border-emerald-400/40 text-emerald-400 bg-emerald-400/10 mb-4">
              Creator Economy
            </Badge>
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground mb-3">
              Como quer monetizar sua audiência?
            </h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Escolha o modelo — a IA executa tudo a partir daqui
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {SUB_PATHS.map((sp) => {
              const Icon = sp.icon;
              return (
                <button
                  key={sp.id}
                  onClick={() => void handleAudienceSubPathSelect(sp.id)}
                  disabled={starting}
                  className="text-left w-full border border-border/50 bg-card/40 backdrop-blur-sm p-5 md:p-6 transition-all duration-200 relative overflow-hidden group hover:border-emerald-400/60 hover:shadow-[0_0_30px_hsl(160_84%_39%/0.12)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-emerald-400/30 group-hover:border-emerald-400 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-emerald-400/30 group-hover:border-emerald-400 transition-colors" />
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center shrink-0 group-hover:border-emerald-400/40 group-hover:bg-emerald-400/10 transition-all">
                      {starting && audienceSubPath === sp.id
                        ? <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
                        : <Icon className="h-5 w-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-mono font-bold text-base text-foreground group-hover:text-emerald-400 transition-colors">{sp.title}</h3>
                        <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border-emerald-400/40 text-emerald-400 bg-emerald-400/10">
                          {sp.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-emerald-400/70 uppercase tracking-widest mb-2">{sp.subtitle}</p>
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed">{sp.desc}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 mt-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (step === "path_select") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-3xl animate-in fade-in duration-700">
          {/* Header */}
          <div className="text-center mb-8">
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
              A IA monta toda a estratégia a partir do seu briefing
            </p>
          </div>

          {/* Simulator pre-fill banner */}
          {simulatorBanner && (
            <div className="mb-6 border border-primary/40 bg-primary/5 p-4 relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary" />
              <div className="flex items-start gap-3">
                <Rocket className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">Simulação detectada</div>
                  <p className="font-mono text-xs text-foreground leading-relaxed">
                    Você simulou o lançamento de <strong>{simulatorBanner.productName}</strong> antes de criar sua conta. A IA vai usar esses dados automaticamente no briefing.
                  </p>
                </div>
                <button onClick={() => { localStorage.removeItem("nexos_simulator_data"); setSimulatorBanner(null); }} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0">✕</button>
              </div>
            </div>
          )}

          {/* ── PRIMARY CTA — direct start ───────────────────────────────── */}
          <div className="mb-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
            <div className="border border-primary/40 bg-primary/5 p-6 md:p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-primary/70 mb-2">Recomendado</p>
              <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tighter text-foreground mb-2">
                Iniciar briefing agora
              </h2>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 leading-relaxed">
                Responda as perguntas do time de IA — ela descobre o melhor caminho para você
              </p>
              <button
                onClick={() => handlePathSelect("has_product")}
                disabled={starting}
                className="w-full md:w-auto inline-flex items-center justify-center gap-3 rounded-none font-mono uppercase tracking-widest font-black btn-weapon-primary h-14 px-12 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting && path === "has_product"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Rocket className="h-5 w-5" />
                }
                Começar briefing
              </button>
            </div>
          </div>

          {/* ── SECONDARY — specific paths ──────────────────────────────── */}
          <div className="mb-4">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center mb-4">
              Ou escolha um cenário específico
            </p>
            <div className="grid grid-cols-1 gap-3">
              {PATHS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePathSelect(p.id)}
                    disabled={starting}
                    className={`text-left w-full border border-border/30 bg-card/20 backdrop-blur-sm p-4 md:p-5 transition-all duration-200 relative overflow-hidden group ${p.glow} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/20 group-hover:border-primary transition-colors" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/20 group-hover:border-primary transition-colors" />

                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-sm border border-border/40 bg-muted/10 flex items-center justify-center shrink-0 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                        {starting && path === p.id
                          ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          : <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {p.title}
                          </span>
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase tracking-widest px-1.5 py-0 ${p.badgeColor}`}>
                            {p.badge}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 line-clamp-1">{p.subtitle}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "conversation") {
    const pathMeta = PATHS.find((p) => p.id === path)!;

    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] max-w-3xl mx-auto" style={{ minHeight: "600px" }}>
        {/* Chat header */}
        <div className="border-b border-border/50 pb-4 mb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <div>
                <h2 className="font-mono font-bold text-sm text-foreground uppercase tracking-widest">
                  {path === "has_product" ? "Briefing Estratégico" : path === "building_product" ? "Product Discovery" : path === "has_audience" ? "Creator Monetization" : "Estratégia de Afiliado"}
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
          {!conversationComplete && (
            <button
              onClick={() => { clearOnboardingState(); setStep("path_select"); setPath(null); setMessages([]); setCampaignId(null); setProposals(null); setAffiliateStrategy(null); setAudienceMonetizationPlan(null); setAudienceSubPath(null); }}
              className="mt-2.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" /> Mudar caminho
            </button>
          )}
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

          {/* Audience monetization plan card */}
          {audienceMonetizationPlan && (
            <div className="border border-emerald-400/30 bg-emerald-400/5 p-4 rounded-sm space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-emerald-400">{audienceMonetizationPlan.approachTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono">
                <div><span className="text-muted-foreground">Plataforma: </span>{audienceMonetizationPlan.platformFocus}</div>
                <div><span className="text-muted-foreground">Produto: </span>{audienceMonetizationPlan.suggestedProductName}</div>
                <div><span className="text-muted-foreground">Preço: </span>{audienceMonetizationPlan.priceRange}</div>
                <div><span className="text-muted-foreground">Prazo: </span>{audienceMonetizationPlan.launchTimeline}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Projeção: </span><span className="text-emerald-400">{audienceMonetizationPlan.revenueProjection}</span></div>
              </div>
              {audienceMonetizationPlan.firstSteps.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Primeiros passos:</p>
                  <ul className="space-y-1">
                    {audienceMonetizationPlan.firstSteps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] font-mono text-muted-foreground/60 italic">{audienceMonetizationPlan.whyItWorks}</p>
            </div>
          )}

          {/* Complete CTA */}
          {conversationComplete && (
            <div className="border border-success/30 bg-success/5 p-4 rounded-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-success">
                  {path === "has_product" ? "Briefing concluído!" : path === "building_product" ? "Produto definido!" : path === "has_audience" ? "Estratégia de monetização pronta!" : "Estratégia pronta!"}
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
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                  // plain Enter = new line (default textarea behavior)
                }}
                placeholder="Digite sua resposta…"
                disabled={sending}
                rows={4}
                className="flex-1 font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-4 py-3 resize-y text-foreground placeholder:text-muted-foreground/50 transition-all min-h-[140px]"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || !inputValue.trim()}
                  title="Enviar (Ctrl+Enter)"
                  className="font-mono rounded-none h-10 px-4 btn-weapon-primary"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" title="Nova linha (Enter)"
                  onClick={() => {
                    setInputValue(v => v + "\n");
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  disabled={sending}
                  className="font-mono rounded-none h-10 px-4 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                >
                  <CornerDownLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-2 text-right">
              Enter = nova linha · Ctrl+Enter = enviar
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

  // ── INTEGRATION SETUP ────────────────────────────────────────────────────────
  if (step === "integration_setup") {
    const relevantProviders = PATH_INTEGRATIONS[path ?? "has_product"] ?? [];
    const relevantIntegrations = INTEGRATION_CATALOG.filter((i) =>
      relevantProviders.includes(i.provider)
    );

    const requiredConnected = relevantIntegrations
      .filter((i) => i.required)
      .every((i) => connectedIntegrations.includes(i.provider));

    const totalConnected = relevantIntegrations.filter((i) =>
      connectedIntegrations.includes(i.provider)
    ).length;

    const categoryLabels: Record<string, string> = {
      mensagens: "Mensagens",
      email: "E-mail Marketing",
      pagamento: "Gateway de Pagamento",
      social: "Mídia Paga",
    };

    const categoriesInUse = [...new Set(relevantIntegrations.map((i) => i.category))];

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 py-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-1.5 mb-4">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary">Passo 1 de 2 — Conectar Integrações</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tighter text-foreground mb-2">
            Conecta em 23 minutos
          </h2>
          <p className="text-xs font-mono text-muted-foreground max-w-xl mx-auto">
            Integre as ferramentas que você já usa — o NexOS vai operar nelas automaticamente durante o lançamento. Você pode conectar agora ou depois em Configurações.
          </p>
        </div>

        {/* Progress strip */}
        <div className="flex items-center gap-3 border border-border/40 bg-card/40 px-4 py-3">
          <div className="flex gap-1">
            {relevantIntegrations.map((i) => (
              <div
                key={i.provider}
                className={`h-1.5 w-6 rounded-full transition-colors ${connectedIntegrations.includes(i.provider) ? "bg-green-400" : "bg-border/60"}`}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {loadingIntegrations ? "Verificando..." : `${totalConnected} de ${relevantIntegrations.length} conectadas`}
          </span>
          <button
            onClick={() => void fetchConnectedIntegrations(true)}
            disabled={refreshingIntegrations}
            className="ml-auto text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
            title="Verificar novamente"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingIntegrations ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Integrations by category */}
        {loadingIntegrations ? (
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div key={k} className="border border-border/30 bg-card/20 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {categoriesInUse.map((cat) => {
              const items = relevantIntegrations.filter((i) => i.category === cat);
              return (
                <div key={cat}>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-2 pl-1">
                    {categoryLabels[cat] ?? cat}
                  </div>
                  <div className="space-y-2">
                    {items.map((integration) => {
                      const Icon = integration.icon;
                      const isConnected = connectedIntegrations.includes(integration.provider);
                      return (
                        <div
                          key={integration.provider}
                          className={`border bg-card/40 p-4 flex items-start gap-4 transition-colors ${
                            isConnected
                              ? "border-green-400/40 bg-green-400/5"
                              : "border-border/50 hover:border-primary/30"
                          }`}
                        >
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-sm border flex items-center justify-center shrink-0 ${
                            isConnected ? "border-green-400/40 bg-green-400/10" : "border-border/50 bg-muted/20"
                          }`}>
                            <Icon className={`h-5 w-5 ${isConnected ? "text-green-400" : integration.iconColor}`} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {integration.label}
                              </span>
                              {integration.required && (
                                <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5">
                                  Recomendada
                                </Badge>
                              )}
                              {isConnected && (
                                <div className="flex items-center gap-1">
                                  <Wifi className="h-3 w-3 text-green-400" />
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">Conectada</span>
                                </div>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed mb-1">
                              {integration.description}
                            </p>
                            <p className="font-mono text-[11px] text-primary/70 italic leading-relaxed">
                              → {integration.benefit[path ?? "has_product"]}
                            </p>
                          </div>

                          {/* Action */}
                          <div className="shrink-0">
                            {isConnected ? (
                              <div className="flex items-center gap-1.5 border border-green-400/30 bg-green-400/5 px-3 py-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                <span className="font-mono text-[11px] text-green-400 uppercase tracking-widest">Ativo</span>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-none font-mono text-[11px] uppercase tracking-widest gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                                onClick={() => window.open("/configuracoes?tab=integracoes", "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Conectar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tip */}
        <div className="border border-border/30 bg-card/20 px-4 py-3 flex items-start gap-3">
          <WifiOff className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">
            Sem integração conectada o NexOS ainda funciona — gera toda a estratégia e copy, mas o disparo automático fica desativado. Você pode conectar depois em{" "}
            <span
              className="text-primary cursor-pointer underline underline-offset-2"
              onClick={() => window.open("/configuracoes?tab=integracoes", "_blank")}
            >
              Configurações → Integrações
            </span>.
          </p>
        </div>

        {/* CTA */}
        <div className="border border-primary/30 bg-primary/5 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary" />
          <div className="text-center space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {requiredConnected
                ? "Integrações essenciais conectadas — pronto para lançar"
                : "Você pode conectar agora ou continuar e configurar depois"}
            </div>
            <Button
              onClick={handleLaunch}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 text-sm"
            >
              <Rocket className="h-4 w-4" />
              {path === "has_product" ? "Iniciar Briefing Estratégico" : "Ir para Minha Campanha"}
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/50">
              Você pode conectar integrações a qualquer momento em Configurações
            </p>
          </div>
        </div>
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
          <div className="text-center space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Confirme o que entendemos antes de escalar o time
            </div>
            <Button
              onClick={handleGoToDiagnosis}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 text-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Está correto — avançar
            </Button>
            <button
              onClick={handleLaunch}
              className="font-mono text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors uppercase tracking-widest underline underline-offset-2"
            >
              Pular por agora e ir para a campanha
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: diagnosis_approval — confirmação do diagnóstico ────────────────────
  if (step === "diagnosis_approval") {
    const approvalItems = proposals
      ? [
          { label: "Produto identificado", value: proposals[0]?.name ?? "—" },
          { label: "Público-alvo", value: proposals[0]?.targetAudience ?? "—" },
          { label: "Dor principal", value: proposals[0]?.mainPain ?? "—" },
          { label: "Transformação", value: proposals[0]?.transformation ?? "—" },
          { label: "Track recomendado", value: proposals[0]?.suggestedTrack ?? "—" },
        ]
      : affiliateStrategy
      ? [
          { label: "Canal principal", value: affiliateStrategy.mainChannel },
          { label: "Tamanho da audiência", value: affiliateStrategy.audienceSize },
          { label: "Abordagem sugerida", value: affiliateStrategy.suggestedApproach },
          { label: "Projeção de receita", value: affiliateStrategy.revenueProjection },
        ]
      : audienceMonetizationPlan
      ? [
          { label: "Modelo de monetização", value: audienceMonetizationPlan.approachTitle },
          { label: "Produto sugerido", value: audienceMonetizationPlan.suggestedProductName },
          { label: "Faixa de preço", value: audienceMonetizationPlan.priceRange },
          { label: "Timeline de lançamento", value: audienceMonetizationPlan.launchTimeline },
        ]
      : [];

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-2xl animate-in fade-in duration-700 space-y-6">

          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
                Diagnóstico Concluído
              </span>
            </div>
            <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground mb-2">
              O que entendemos sobre você
            </h2>
            <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed">
              Revise o que o time identificou antes de escalarmos os especialistas de campanha.
            </p>
          </div>

          {/* Diagnóstico resumido */}
          {approvalItems.length > 0 && (
            <div className="border border-border/40 bg-card/20 divide-y divide-border/20">
              {approvalItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 shrink-0 pt-0.5">
                    {item.label}
                  </span>
                  <span className="font-mono text-[12px] text-foreground/80 text-right">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pergunta de confirmação */}
          <div className="border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="font-mono text-sm text-foreground/80 mb-1">
              Faltou algo importante ou podemos escalar o time de especialistas para planejar sua campanha?
            </p>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleGoToIntegrations}
              className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Está correto, avançar
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep("plan_preview")}
              className="w-full rounded-none font-mono uppercase tracking-widest h-11 text-sm border-border/50 hover:border-primary/40"
            >
              Quero ajustar informações
            </Button>
            <button
              onClick={handleLaunch}
              className="font-mono text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors uppercase tracking-widest underline underline-offset-2 text-center"
            >
              Adicionar algo e ir para a campanha
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
