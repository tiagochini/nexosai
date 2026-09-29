import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMode } from "@/lib/mode";
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
import { CloneStudioPanel } from "@/components/CloneStudioPanel";
import { CloneWowMoment } from "@/components/CloneWowMoment";
import { useUiText } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────
type OnboardingPath = "has_product" | "building_product" | "affiliate_nexos" | "has_audience";
type AudienceSubPath = "micro_launch" | "members_area" | "product_from_audience";
type UIStep = "welcome" | "path_select" | "audience_subpath" | "conversation" | "plan_preview" | "clone_wow" | "diagnosis_approval" | "integration_setup";

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
      building_product:   "Checkout rápido para o seu produto novo com upsell configurado pelo agente",
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
      affiliate_nexos:    "Vídeos de afiliado gerados pelo agente e postados no TikTok com links de rastreamento",
      has_audience:       "Reels de pré-lançamento disparados automaticamente para engajar sua audiência no TikTok",
    },
    category: "social",
    icon: Video,
    iconColor: "text-pink-400",
    required: false,
  },
];

const INTEGRATION_COPY: Record<string, {
  description: [string, string];
  benefits: Record<OnboardingPath, [string, string]>;
}> = {
  whatsapp_business: {
    description: ["Automated segmented messages to hot, warm, and cold leads.", "Envío automático de mensajes segmentados a leads interesados, templados y fríos."],
    benefits: {
      has_product: ["WhatsApp sequences with mental triggers sent at the right launch times", "Secuencias de WhatsApp con disparadores mentales enviadas en los momentos clave del lanzamiento"],
      building_product: ["Launch notifications and nurturing directly on your audience's WhatsApp", "Notificaciones de lanzamiento y nutrición directamente en el WhatsApp de tu audiencia"],
      affiliate_nexos: ["Automatically distribute content and affiliate links to your contacts", "Distribución automática de contenido y enlaces de afiliado a tus contactos"],
      has_audience: ["Cart-opening messages sent to your most engaged fans first", "Mensajes de apertura del carrito enviados primero a tus seguidores más activos"],
    },
  },
  rd_station: {
    description: ["Email marketing and lead automation fully integrated with your launch.", "Marketing por correo y automatización de leads integrados con el lanzamiento."],
    benefits: {
      has_product: ["23 launch emails sent automatically — capture, nurture, and scarcity", "23 correos de lanzamiento enviados automáticamente: captación, nutrición y escasez"],
      building_product: ["Email sequence to validate your product idea with your audience", "Secuencia de correos para validar tu idea de producto con tu audiencia"],
      affiliate_nexos: ["Email automation to warm up and convert affiliates", "Automatización de correo para preparar y convertir afiliados"],
      has_audience: ["Pre-launch emails to monetize your existing list", "Correos previos al lanzamiento para monetizar tu lista actual"],
    },
  },
  activecampaign: {
    description: ["CRM and advanced email automation with behavioral segmentation.", "CRM y automatización avanzada de correo con segmentación por comportamiento."],
    benefits: {
      has_product: ["Behavior-based email automation (opened, clicked, purchased)", "Automatizaciones de correo basadas en el comportamiento (abrió, hizo clic, compró)"],
      building_product: ["Integrated CRM to track leads as they discover your product", "CRM integrado para seguir a los leads durante el descubrimiento del producto"],
      affiliate_nexos: ["Automatic engagement tags to prioritize your hottest affiliates", "Etiquetas automáticas de interacción para priorizar a los afiliados más interesados"],
      has_audience: ["Behavior-based audience segmentation for maximum conversion", "Segmentación de audiencia por comportamiento para maximizar conversiones"],
    },
  },
  hotmart: {
    description: ["Digital product platform — purchases automatically convert contacts into customers.", "Plataforma de productos digitales: las compras convierten automáticamente los contactos en clientes."],
    benefits: {
      has_product: ["When someone buys on Hotmart, NexOS automatically moves them to the converted segment", "Cuando alguien compra en Hotmart, NexOS lo pasa automáticamente al segmento de conversiones"],
      building_product: ["Launch your new product on Hotmart with checkout already integrated", "Lanza tu nuevo producto en Hotmart con el pago ya integrado"],
      affiliate_nexos: ["Automatic affiliate sales tracking with commissions recorded", "Seguimiento automático de ventas de afiliados con registro de comisiones"],
      has_audience: ["Sell your micro-launch product on Hotmart with a fully automated funnel", "Vende tu producto de microlanzamiento en Hotmart con un embudo totalmente automatizado"],
    },
  },
  kiwify: {
    description: ["Checkout and digital product management with automatic lead conversion.", "Pago y gestión de productos digitales con conversión automática de leads."],
    benefits: {
      has_product: ["Kiwify purchases trigger NexOS post-sale automations instantly", "Las compras en Kiwify activan al instante las automatizaciones posventa de NexOS"],
      building_product: ["Fast checkout for your new product with an agent-configured upsell", "Pago rápido para tu nuevo producto con upsell configurado por el agente"],
      affiliate_nexos: ["Track affiliate sales with real-time segment updates", "Seguimiento de ventas de afiliados con actualización de segmentos en tiempo real"],
      has_audience: ["High-conversion cart for your micro-launch with automated post-sale flow", "Carrito de alta conversión para tu microlanzamiento con posventa automatizada"],
    },
  },
  meta_ads: {
    description: ["Facebook and Instagram Ads — automatic remarketing for leads who haven't converted.", "Anuncios de Facebook e Instagram: remarketing automático para leads que aún no han convertido."],
    benefits: {
      has_product: ["Automatic remarketing for leads who didn't open emails or click links", "Remarketing automático para leads que no abrieron correos ni hicieron clic en enlaces"],
      building_product: ["Interest-based audiences to validate your product idea before building", "Audiencias por intereses para validar tu idea de producto antes de crearla"],
      affiliate_nexos: ["Affiliate ads automatically optimized by the Media Buyer agent", "Anuncios de afiliados optimizados automáticamente por el agente de compra de medios"],
      has_audience: ["Amplify organic content with paid traffic synced to your launch calendar", "Amplía el alcance del contenido orgánico con tráfico pagado sincronizado con el calendario de lanzamiento"],
    },
  },
  tiktok: {
    description: ["Auto-post videos and reels on TikTok, synced with your launch calendar.", "Publicación automática de videos y reels en TikTok, sincronizada con el calendario de lanzamiento."],
    benefits: {
      has_product: ["Launch videos automatically posted on TikTok at peak-reach times", "Videos de lanzamiento publicados automáticamente en TikTok en los horarios de mayor alcance"],
      building_product: ["Product validation content published on TikTok to attract early buyers", "Contenido de validación del producto publicado en TikTok para atraer a los primeros compradores"],
      affiliate_nexos: ["Affiliate videos created by the agent and posted on TikTok with tracking links", "Videos de afiliados creados por el agente y publicados en TikTok con enlaces de seguimiento"],
      has_audience: ["Pre-launch reels automatically published to engage your TikTok audience", "Reels previos al lanzamiento publicados automáticamente para atraer a tu audiencia de TikTok"],
    },
  },
};

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
    desc: "Curso, mentoria, serviço, software ou produto físico. Vamos montar sua estratégia de lançamento com o agente.",
    badge: "Mais comum",
    badgeColor: "text-primary border-primary/40 bg-primary/10",
    glow: "hover:border-primary/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)]",
  },
  {
    id: "building_product" as OnboardingPath,
    icon: Sparkles,
    title: "Tenho expertise mas não tenho produto",
    subtitle: "Vamos criar juntos",
    desc: "Nosso agente analisa suas habilidades e o mercado para propor 3 ideias de produto viáveis — você escolhe e construímos juntos.",
    badge: "Agente + Você",
    badgeColor: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
    glow: "hover:border-cyan-400/60 hover:shadow-[0_0_30px_hsl(175_100%_60%/0.12)]",
  },
  {
    id: "affiliate_nexos" as OnboardingPath,
    icon: Star,
    title: "Quero lançar o NexOS",
    subtitle: "Programa de afiliados",
    desc: "Torne-se um afiliado parceiro e lance o NexOS para o seu público. Comissões recorrentes + suporte completo.",
    badge: "Afiliado",
    badgeColor: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    glow: "hover:border-yellow-400/60 hover:shadow-[0_0_30px_hsl(45_100%_60%/0.12)]",
  },
  {
    id: "has_audience" as OnboardingPath,
    icon: Users,
    title: "Tenho audiência, quero monetizar",
    subtitle: "Creator economy · micro-lançamento · membros",
    desc: "Você já tem seguidores, canal ou comunidade. O agente descobre o modelo certo — micro-lançamento, área de membros ou produto derivado — e executa tudo.",
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
  const t = useUiText();
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
        <p><span className="text-foreground/70">{t("Formato:", "Format:", "Formato:")}</span> {proposal.format}</p>
        <p><span className="text-foreground/70">{t("Público:", "Audience:", "Público:")}</span> {proposal.targetAudience}</p>
        <p><span className="text-foreground/70">{t("Transformação:", "Transformation:", "Transformación:")}</span> {proposal.transformation}</p>
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
  const t = useUiText();
  const { user } = useAuth();
  const { setMode } = useMode();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<UIStep>("welcome");
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [simulatorBanner, setSimulatorBanner] = useState<SimulatorData | null>(null);
  const [resumeCheck, setResumeCheck] = useState<"checking" | "resolved" | "error">("checking");

  // Clone Studio state
  const [showCloneStudio, setShowCloneStudio] = useState(false);
  const [cloneSessionId, setCloneSessionId] = useState<string | null>(null);

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

  // Restore saved onboarding state on mount + check simulator pre-fill.
  // localStorage is only a fast-path cache — if it's empty (browser data
  // cleared, new device, private tab), fall back to asking the backend
  // whether this account already has an in-progress intake campaign, since
  // the conversation itself (messages + extracted data) is durably stored
  // server-side in campaigns.intake_data, not in the browser.
  //
  // This check BLOCKS the path-select screen (resumeCheck stays "checking")
  // until it resolves. A failed check never silently falls through to a
  // fresh onboarding — that could spawn a duplicate campaign and strand the
  // user's already-answered questions. On failure we show an explicit
  // retry screen; only the user's own confirmed choice moves past it.
  const checkForResumableCampaign = async () => {
    setResumeCheck("checking");
    const saved = loadOnboardingState();
    if (saved && saved.messages.length > 0 && saved.campaignId) {
      setPath(saved.path);
      setCampaignId(saved.campaignId);
      setStep(saved.step);
      setMessages(saved.messages);
      setConversationComplete(saved.conversationComplete);
      if (saved.audienceSubPath) setAudienceSubPath(saved.audienceSubPath);
      setResumeCheck("resolved");
      return;
    }

    // Check for simulator data from the landing page
    const sim = loadSimulatorData();
    if (sim) setSimulatorBanner(sim);

    // No local cache — ask the backend if there's an unfinished intake to resume.
    try {
      const data = await customFetch<{ campaigns: Array<Record<string, unknown>> }>("/api/campaigns");
      const intakeCampaigns = (data.campaigns ?? [])
        .filter((c) => c["status"] === "intake")
        .sort((a, b) =>
          new Date(b["updatedAt"] as string).getTime() - new Date(a["updatedAt"] as string).getTime(),
        );
      const candidate = intakeCampaigns[0];
      if (!candidate) {
        setResumeCheck("resolved");
        return;
      }

      const detail = await customFetch<{ campaign: Record<string, unknown> }>(`/api/campaigns/${candidate["id"]}`);
      const intakeData = (detail.campaign["intakeData"] as Record<string, unknown>) ?? {};
      const history = Array.isArray(intakeData["_conversationHistory"])
        ? (intakeData["_conversationHistory"] as Array<{ role: string; content: string }>)
        : [];
      const restoredPath = (intakeData["_onboardingPath"] as OnboardingPath) ?? "has_product";
      if (history.length === 0) {
        setResumeCheck("resolved");
        return;
      }

      const restoredMessages: ChatMessage[] = history.map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.content,
      }));
      const cid = candidate["id"] as string;

      setPath(restoredPath);
      setCampaignId(cid);
      setStep("conversation");
      setMessages(restoredMessages);
      saveOnboardingState({
        path: restoredPath,
        campaignId: cid,
        step: "conversation",
        messages: restoredMessages,
        conversationComplete: false,
      });
      toast.info(t("Retomamos sua campanha em andamento de onde você parou.", "We resumed your in-progress campaign where you left off.", "Retomamos tu campaña en curso desde donde la dejaste."));
      setResumeCheck("resolved");
    } catch {
      // Could not confirm whether a campaign exists — do NOT silently start
      // fresh. Surface a blocking retry screen instead.
      setResumeCheck("error");
    }
  };

  useEffect(() => {
    checkForResumableCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        has_product: t(`Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vou te ajudar a preparar tudo para o lançamento do seu produto.\n\nComeça me contando: qual é o nome do seu produto e o que ele entrega para o cliente?`, `Hi${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! I'll help you get everything ready to launch your product.\n\nLet's start with this: what's your product called, and what does it deliver for the customer?`, `¡Hola${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Te ayudaré a preparar todo para el lanzamiento de tu producto.\n\nEmpecemos: ¿cómo se llama tu producto y qué ofrece al cliente?`),
        building_product: t(`Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vai ser um prazer ajudar você a encontrar o produto ideal.\n\nVamos começar do seu perfil. Qual é a sua área de atuação ou especialidade principal? (ex: nutrição, finanças, tecnologia, fitness, educação...)`, `Hi${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! I'll be glad to help you find the right product.\n\nLet's start with your background. What's your field or main area of expertise? (e.g. nutrition, finance, technology, fitness, education...)`, `¡Hola${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Será un placer ayudarte a encontrar el producto ideal.\n\nEmpecemos por tu perfil. ¿A qué te dedicas o cuál es tu especialidad principal? (por ejemplo: nutrición, finanzas, tecnología, fitness, educación...)`),
        affiliate_nexos: t(`Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Bem-vindo ao programa de afiliados NexOS.\n\nComo afiliado, você vai lançar a plataforma para o seu público e ganhar comissões recorrentes por cada assinante ativo.\n\nPara montar sua estratégia, me conta: qual é o seu público atual? Tem seguidores, lista de email, grupo ou comunidade?`, `Hi${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Welcome to the NexOS affiliate program.\n\nAs an affiliate, you'll promote the platform to your audience and earn recurring commissions for each active subscriber.\n\nTo build your strategy, tell me: who is your current audience? Do you have followers, an email list, a group, or a community?`, `¡Hola${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Te damos la bienvenida al programa de afiliados de NexOS.\n\nComo afiliado, promocionarás la plataforma a tu público y ganarás comisiones recurrentes por cada suscriptor activo.\n\nPara crear tu estrategia, cuéntame: ¿quién es tu público actual? ¿Tienes seguidores, una lista de correo, un grupo o una comunidad?`),
        has_audience: "",
      };
      const initMsgs = [{ role: "assistant" as const, content: greetings[selectedPath] }];
      setMessages(initMsgs);
      saveOnboardingState({ path: selectedPath, campaignId: cid, step: "conversation", messages: initMsgs, conversationComplete: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", "Campaign limit reached. Open an existing campaign or upgrade your plan.", "Has alcanzado el límite de campañas. Accede a una campaña existente o mejora tu plan."), { duration: 6000 });
      } else {
        toast.error(t("Erro ao iniciar. Tente novamente.", "Couldn't get started. Please try again.", "No se pudo iniciar. Inténtalo de nuevo."));
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
        micro_launch: t(`Olá${firstName}! Excelente escolha — micro-lançamento é a forma mais rápida de monetizar uma audiência existente.\n\nPrimeira pergunta: em qual plataforma você está mais ativo? (YouTube, Instagram, TikTok, Kwai, Telegram, outros?)`, `Hi${firstName}! Great choice — a micro-launch is the fastest way to monetize an existing audience.\n\nFirst question: which platform are you most active on? (YouTube, Instagram, TikTok, Kwai, Telegram, or another?)`, `¡Hola${firstName}! Excelente elección: un microlanzamiento es la forma más rápida de monetizar una audiencia existente.\n\nPrimera pregunta: ¿en qué plataforma tienes más actividad? (YouTube, Instagram, TikTok, Kwai, Telegram u otra)`),
        members_area: t(`Olá${firstName}! Área de membros é o modelo de renda recorrente mais poderoso para creators.\n\nMe conta: em qual plataforma você publica seu conteúdo hoje e quantos seguidores ou inscritos você tem aproximadamente?`, `Hi${firstName}! A membership site is one of the most powerful recurring-revenue models for creators.\n\nTell me: which platform do you publish on today, and roughly how many followers or subscribers do you have?`, `¡Hola${firstName}! Una membresía es uno de los modelos más potentes de ingresos recurrentes para creadores.\n\nCuéntame: ¿en qué plataforma publicas y cuántos seguidores o suscriptores tienes aproximadamente?`),
        product_from_audience: t(`Olá${firstName}! Transformar audiência em produto é o jeito mais inteligente de monetizar — você já tem a lista quente.\n\nPrimeira pergunta: qual plataforma é o seu principal canal e qual é o nicho do seu conteúdo?`, `Hi${firstName}! Turning your audience into a product is a smart way to monetize — you already have a warm list.\n\nFirst question: what's your main platform, and what niche is your content in?`, `¡Hola${firstName}! Convertir tu audiencia en un producto es una forma inteligente de monetizar: ya tienes una lista interesada.\n\nPrimera pregunta: ¿cuál es tu plataforma principal y cuál es el nicho de tu contenido?`),
      };

      const initMsgs = [{ role: "assistant" as const, content: subPathGreetings[subPath] }];
      setMessages(initMsgs);
      saveOnboardingState({ path: "has_audience", campaignId: cid, step: "conversation", messages: initMsgs, conversationComplete: false, audienceSubPath: subPath });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", "Campaign limit reached. Open an existing campaign or upgrade your plan.", "Has alcanzado el límite de campañas. Accede a una campaña existente o mejora tu plan."), { duration: 6000 });
      } else {
        toast.error(t("Erro ao iniciar. Tente novamente.", "Couldn't get started. Please try again.", "No se pudo iniciar. Inténtalo de nuevo."));
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
      toast.error(t("Erro de comunicação com o agente. Sua mensagem foi preservada. Tente novamente.", "Couldn't reach the agent. Your message was preserved. Please try again.", "Error de comunicación con el agente. Tu mensaje se conservó. Inténtalo de nuevo."), { duration: 6000 });
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

  // ── Financial scenario estimates ──────────────────────────────────────────────
  interface FinancialScenario {
    label: string;
    key: "conservador" | "realista" | "otimista";
    leads: number;
    convRate: number;
    revenue: number;
    color: string;
    active: boolean;
  }
  const [financialScenarios, setFinancialScenarios] = useState<FinancialScenario[] | null>(null);

  const computeScenarios = (revenueTarget: number, budget: number): FinancialScenario[] => {
    // Conservative: 40% of target, 1.2% conversion, minimal spend efficiency
    const cRevenue = Math.round(revenueTarget * 0.4);
    const cLeads = budget > 0 ? Math.round(budget / 12) : 200;
    const cConv = 1.2;
    // Realistic: 70% of target, 2% conversion
    const rRevenue = Math.round(revenueTarget * 0.7);
    const rLeads = budget > 0 ? Math.round(budget / 8) : 350;
    const rConv = 2.0;
    // Optimistic: 110% of target, 3.5% conversion
    const oRevenue = Math.round(revenueTarget * 1.1);
    const oLeads = budget > 0 ? Math.round(budget / 5) : 600;
    const oConv = 3.5;
    return [
      { label: t("Conservador", "Conservative", "Conservador"), key: "conservador", leads: cLeads, convRate: cConv, revenue: cRevenue, color: "border-muted-foreground/30 text-muted-foreground", active: false },
      { label: t("Realista", "Realistic", "Realista"), key: "realista", leads: rLeads, convRate: rConv, revenue: rRevenue, color: "border-primary/50 text-primary", active: true },
      { label: t("Otimista", "Optimistic", "Optimista"), key: "otimista", leads: oLeads, convRate: oConv, revenue: oRevenue, color: "border-success/40 text-success", active: false },
    ];
  };

  const formatBRL = (n: number) => {
    if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
    return `R$ ${n.toLocaleString("pt-BR")}`;
  };

  // ── Show plan preview then navigate ──────────────────────────────────────────
  const handleFinish = async () => {
    setStep("plan_preview");
    // Fetch campaign intake data to compute real financial scenarios
    if (campaignId) {
      try {
        const data = await customFetch<{ campaign: Record<string, unknown> }>(`/api/campaigns/${campaignId}`);
        const intake = (data.campaign?.intakeData as Record<string, unknown>) ?? {};
        const revenueTarget = Number(intake["campaign.revenueTarget"] ?? intake["revenueTarget"] ?? 100000);
        const budget = Number(intake["campaign.budget.total"] ?? intake["budget"] ?? 0);
        if (revenueTarget > 0) {
          setFinancialScenarios(computeScenarios(revenueTarget, budget));
        }
      } catch { /* non-blocking — generic tracks shown as fallback */ }
    }
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

  // ── Resume-check gate — never let the user start (and risk duplicating) a
  // campaign before we've confirmed whether one is already in progress.
  if (resumeCheck === "checking") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
            {t("Verificando se você já tem uma campanha em andamento...", "Checking whether you already have a campaign in progress...", "Comprobando si ya tienes una campaña en curso...")}
          </p>
        </div>
      </div>
    );
  }

  if (resumeCheck === "error") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center border border-destructive/30 bg-destructive/5 p-8">
          <WifiOff className="h-6 w-6 text-destructive mx-auto mb-4" />
          <h2 className="font-mono font-black text-sm uppercase tracking-widest text-foreground mb-3">
            {t("Não conseguimos verificar sua campanha", "We couldn't check your campaign", "No pudimos comprobar tu campaña")}
          </h2>
          <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed mb-6">
            {t("Antes de continuar, precisamos confirmar se você já tem uma campanha em andamento — isso evita que você perca seu progresso ou crie uma duplicada. Não foi possível falar com o servidor agora.", "Before continuing, we need to confirm whether you already have a campaign in progress — this prevents lost progress or a duplicate campaign. We couldn't reach the server right now.", "Antes de continuar, debemos confirmar si ya tienes una campaña en curso para evitar que pierdas tu progreso o crees otra. No pudimos conectar con el servidor en este momento.")}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => checkForResumableCampaign()}
              className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary"
            >
              <RefreshCw className="h-4 w-4" />
              {t("Tentar novamente", "Try again", "Intentar de nuevo")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: welcome — "Time de Briefing NEXOS" ─────────────────────────────────
  if (step === "welcome") {
    const firstName = user?.name?.split(" ")[0] ?? "você";
    const BRIEFING_AGENTS = [
      { name: "Business Discovery",  desc: t("Entende seu negócio e produto", "Understands your business and product", "Comprende tu negocio y producto") },
      { name: "Market Psychology",   desc: t("Analisa seu mercado e concorrência", "Analyzes your market and competitors", "Analiza tu mercado y competencia") },
      { name: "Avatar Intelligence", desc: t("Mapeia seu público ideal", "Maps your ideal audience", "Define tu público ideal") },
      { name: "Product Development", desc: t("Valida e estrutura sua oferta", "Validates and structures your offer", "Valida y estructura tu oferta") },
      { name: "Monetization Agent",  desc: t("Define modelo e precificação", "Defines your model and pricing", "Define el modelo y los precios") },
      { name: "Positioning Agent",   desc: t("Encontra seu diferencial único", "Finds your unique differentiator", "Encuentra tu diferenciador único") },
      { name: "NEXOS Prime",         desc: t("Orquestra toda a operação", "Orchestrates the entire operation", "Orquesta toda la operación") },
    ];

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-2xl animate-in fade-in duration-700">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={nexosLogo} alt="NexOS" className="h-8 opacity-80" />
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
                {t("Time de briefing NEXOS · ativo", "NEXOS Briefing Team · active", "Equipo de briefing NEXOS · activo")}
              </span>
            </div>
            <h1 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground mb-4">
              {t("Olá, ", "Hello, ", "Hola, ")}<span className="text-primary">{firstName}</span>.<br />
              {t("Sua equipe está pronta para você.", "Your team is ready for you.", "Tu equipo está listo para ayudarte.")}
            </h1>
            <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed max-w-lg mx-auto">
              {t("Antes de montar sua campanha, vamos conversar. Um time de especialistas vai entender seu negócio, seu público e sua oferta — e transformar tudo em um plano estratégico personalizado.", "Before building your campaign, let's talk. A team of specialists will learn about your business, audience, and offer — and turn it all into a personalized strategic plan.", "Antes de crear tu campaña, conversemos. Un equipo de especialistas conocerá tu negocio, público y oferta, y lo convertirá todo en un plan estratégico personalizado.")}
            </p>
          </div>

          {/* Time de agentes */}
          <div className="border border-border/30 bg-card/20 p-5 mb-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4 text-center">
              {t("Especialistas escalados para o seu briefing", "Specialists assigned to your briefing", "Especialistas asignados a tu briefing")}
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
              {t("Vamos entender meu negócio", "Let's understand my business", "Conozcamos mi negocio")}
              <ChevronRight className="h-4 w-4" />
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/30 mt-3">
              {t("Leva menos de 5 minutos · Você pode salvar e continuar depois", "Takes less than 5 minutes · You can save and continue later", "Toma menos de 5 minutos · Puedes guardar y continuar después")}
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
        title: t("Micro-lançamento por conteúdo", "Content-led micro-launch", "Microlanzamiento con contenido"),
        subtitle: t("0 a 7 dias do zero ao faturamento", "From zero to revenue in 0–7 days", "De cero a ingresos en 0–7 días"),
        desc: t("Crie um produto de entrada (R$97–R$497) baseado no conteúdo que você já publica. O agente monta a oferta, escreve o copy e conduz o lançamento pelo seu canal.", "Create an entry-level product (R$97–R$497) based on content you already publish. The agent builds the offer, writes the copy, and runs the launch through your channel.", "Crea un producto inicial (R$97–R$497) basado en el contenido que ya publicas. El agente prepara la oferta, redacta los textos y dirige el lanzamiento en tu canal."),
        badge: t("Mais rápido", "Fastest", "Más rápido"),
      },
      {
        id: "members_area",
        icon: Users,
        title: t("Área de membros perpétua", "Evergreen membership", "Membresía continua"),
        subtitle: t("Renda recorrente todo mês", "Recurring monthly revenue", "Ingresos recurrentes cada mes"),
        desc: t("Transforme sua audiência engajada em assinantes pagantes. Conteúdo exclusivo, comunidade fechada e renda previsível mês a mês.", "Turn your engaged audience into paying subscribers. Exclusive content, a private community, and predictable monthly income.", "Convierte a tu audiencia activa en suscriptores de pago. Contenido exclusivo, comunidad privada e ingresos mensuales previsibles."),
        badge: t("Recorrência", "Recurring", "Recurrente"),
      },
      {
        id: "product_from_audience",
        icon: BarChart2,
        title: t("Produto derivado da audiência", "Audience-led product", "Producto derivado de la audiencia"),
        subtitle: t("Lançamento PLF completo", "Full PLF launch", "Lanzamiento PLF completo"),
        desc: t("Sua audiência já é sua lista quente. O agente analisa o público, cria o produto ideal, monta a sequência de lançamento completa e executa automaticamente.", "Your audience is already a warm list. The agent analyzes it, creates the right product, builds the complete launch sequence, and runs it automatically.", "Tu audiencia ya es una lista interesada. El agente la analiza, crea el producto ideal, prepara toda la secuencia de lanzamiento y la ejecuta automáticamente."),
        badge: t("Lançamento completo", "Full launch", "Lanzamiento completo"),
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
              <ChevronRight className="h-3 w-3 rotate-180" /> {t("Voltar", "Back", "Volver")}
            </button>
            <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-3 py-1 border-emerald-400/40 text-emerald-400 bg-emerald-400/10 mb-4">
              {t("Creator Economy", "Creator Economy", "Economía de creadores")}
            </Badge>
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground mb-3">
              {t("Como quer monetizar sua audiência?", "How would you like to monetize your audience?", "¿Cómo quieres monetizar tu audiencia?")}
            </h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {t("Escolha o modelo — o agente executa tudo a partir daqui", "Choose a model — the agent takes it from here", "Elige un modelo: el agente se encargará de todo a partir de aquí")}
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
              {t("Bem-vindo ao NexOS", "Welcome to NexOS", "Te damos la bienvenida a NexOS")}
            </h1>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              {t("O agente monta toda a estratégia a partir do seu briefing", "The agent builds your entire strategy from your briefing", "El agente crea toda la estrategia a partir de tu briefing")}
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
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">{t("Simulação detectada", "Simulation detected", "Simulación detectada")}</div>
                  <p className="font-mono text-xs text-foreground leading-relaxed">
                    {t("Você simulou o lançamento de ", "You simulated the launch of ", "Simulaste el lanzamiento de ")}<strong>{simulatorBanner.productName}</strong>{t(" antes de criar sua conta. O agente vai usar esses dados automaticamente no briefing.", " before creating your account. The agent will automatically use this data in your briefing.", " antes de crear tu cuenta. El agente usará estos datos automáticamente en tu briefing.")}
                  </p>
                </div>
                <button aria-label={t("Fechar aviso", "Dismiss notice", "Cerrar aviso")} onClick={() => { localStorage.removeItem("nexos_simulator_data"); setSimulatorBanner(null); }} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0">✕</button>
              </div>
            </div>
          )}

          {/* ── PRIMARY CTA — direct start ───────────────────────────────── */}
          <div className="mb-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
            <div className="border border-primary/40 bg-primary/5 p-6 md:p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-primary/70 mb-2">{t("Recomendado", "Recommended", "Recomendado")}</p>
              <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tighter text-foreground mb-2">
                {t("Iniciar briefing agora", "Start briefing now", "Iniciar briefing ahora")}
              </h2>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 leading-relaxed">
                {t("Responda às perguntas do time de agentes — eles descobrirão o melhor caminho para você", "Answer the agent team's questions — they'll find the best path for you", "Responde las preguntas del equipo de agentes: descubrirán el mejor camino para ti")}
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
                {t("Começar briefing", "Start briefing", "Comenzar briefing")}
              </button>
            </div>
          </div>

          {/* ── SECONDARY — specific paths ──────────────────────────────── */}
          <div className="mb-4">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center mb-4">
              {t("Ou escolha um cenário específico", "Or choose a specific scenario", "O elige un escenario específico")}
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
                            {t(p.title, p.id === "has_product" ? "I have a product" : p.id === "building_product" ? "I have expertise but no product" : p.id === "affiliate_nexos" ? "I want to launch NexOS" : "I have an audience and want to monetize", p.id === "has_product" ? "Tengo un producto" : p.id === "building_product" ? "Tengo experiencia, pero no producto" : p.id === "affiliate_nexos" ? "Quiero lanzar NexOS" : "Tengo audiencia y quiero monetizar")}
                          </span>
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase tracking-widest px-1.5 py-0 ${p.badgeColor}`}>
                            {t(p.badge, p.id === "has_product" ? "Most common" : p.id === "building_product" ? "Agent + You" : p.id === "affiliate_nexos" ? "Affiliate" : "Creator", p.id === "has_product" ? "Más común" : p.id === "building_product" ? "Agente + tú" : p.id === "affiliate_nexos" ? "Afiliado" : "Creador")}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 line-clamp-1">{t(p.subtitle, p.id === "has_product" ? "Ready or in progress" : p.id === "building_product" ? "Let's build it together" : p.id === "affiliate_nexos" ? "Affiliate program" : "Creator economy · micro-launch · memberships", p.id === "has_product" ? "Listo o en desarrollo" : p.id === "building_product" ? "Vamos a crearlo juntos" : p.id === "affiliate_nexos" ? "Programa de afiliados" : "Economía de creadores · microlanzamiento · membresías")}</p>
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
                  {path === "has_product" ? t("Briefing estratégico", "Strategic briefing", "Briefing estratégico") : path === "building_product" ? t("Descoberta de produto", "Product discovery", "Descubrimiento de producto") : path === "has_audience" ? t("Monetização de criadores", "Creator monetization", "Monetización de creadores") : t("Estratégia de afiliado", "Affiliate strategy", "Estrategia de afiliados")}
                </h2>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  {t(pathMeta.subtitle, path === "has_product" ? "Ready or in progress" : path === "building_product" ? "Let's build it together" : path === "affiliate_nexos" ? "Affiliate program" : "Creator economy · micro-launch · memberships", path === "has_product" ? "Listo o en desarrollo" : path === "building_product" ? "Vamos a crearlo juntos" : path === "affiliate_nexos" ? "Programa de afiliados" : "Economía de creadores · microlanzamiento · membresías")}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-1 ${pathMeta.badgeColor}`}>
              {t(pathMeta.badge, path === "has_product" ? "Most common" : path === "building_product" ? "Agent + You" : path === "affiliate_nexos" ? "Affiliate" : "Creator", path === "has_product" ? "Más común" : path === "building_product" ? "Agente + tú" : path === "affiliate_nexos" ? "Afiliado" : "Creador")}
            </Badge>
          </div>
          {!conversationComplete && (
            <button
              onClick={() => { clearOnboardingState(); setStep("path_select"); setPath(null); setMessages([]); setCampaignId(null); setProposals(null); setAffiliateStrategy(null); setAudienceMonetizationPlan(null); setAudienceSubPath(null); }}
              className="mt-2.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" /> {t("Mudar caminho", "Change path", "Cambiar de opción")}
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
                {t("Selecione a proposta que mais combina com você:", "Choose the proposal that fits you best:", "Selecciona la propuesta que mejor encaje contigo:")}
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
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-yellow-400">{t("Sua estratégia de afiliado", "Your affiliate strategy", "Tu estrategia de afiliados")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                <div><span className="text-muted-foreground">{t("Público:", "Audience:", "Público:")} </span>{affiliateStrategy.audienceSize}</div>
                <div><span className="text-muted-foreground">{t("Canal:", "Channel:", "Canal:")} </span>{affiliateStrategy.mainChannel}</div>
                <div className="col-span-2"><span className="text-muted-foreground">{t("Projeção:", "Projection:", "Proyección:")} </span><span className="text-success">{affiliateStrategy.revenueProjection}</span></div>
              </div>
              {affiliateStrategy.firstSteps.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">{t("Primeiros passos:", "First steps:", "Primeros pasos:")}</p>
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
                <div><span className="text-muted-foreground">{t("Plataforma:", "Platform:", "Plataforma:")} </span>{audienceMonetizationPlan.platformFocus}</div>
                <div><span className="text-muted-foreground">{t("Produto:", "Product:", "Producto:")} </span>{audienceMonetizationPlan.suggestedProductName}</div>
                <div><span className="text-muted-foreground">{t("Preço:", "Price:", "Precio:")} </span>{audienceMonetizationPlan.priceRange}</div>
                <div><span className="text-muted-foreground">{t("Prazo:", "Timeline:", "Plazo:")} </span>{audienceMonetizationPlan.launchTimeline}</div>
                <div className="col-span-2"><span className="text-muted-foreground">{t("Projeção:", "Projection:", "Proyección:")} </span><span className="text-emerald-400">{audienceMonetizationPlan.revenueProjection}</span></div>
              </div>
              {audienceMonetizationPlan.firstSteps.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">{t("Primeiros passos:", "First steps:", "Primeros pasos:")}</p>
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
                   {path === "has_product" ? t("Briefing concluído!", "Briefing complete!", "¡Briefing completado!") : path === "building_product" ? t("Produto definido!", "Product defined!", "¡Producto definido!") : path === "has_audience" ? t("Estratégia de monetização pronta!", "Monetization strategy ready!", "¡Estrategia de monetización lista!") : t("Estratégia pronta!", "Strategy ready!", "¡Estrategia lista!")}
                </span>
              </div>
              <Button
                onClick={handleFinish}
                className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11"
              >
                <ArrowRight className="h-4 w-4" />
                {path === "has_product" ? t("Acessar intake completo", "Open full intake", "Acceder al formulario completo") : t("Ir para minha campanha", "Go to my campaign", "Ir a mi campaña")}
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
                aria-label={t("Sua resposta", "Your response", "Tu respuesta")}
                placeholder={t("Digite sua resposta…", "Type your answer…", "Escribe tu respuesta…")}
                disabled={sending}
                rows={4}
                className="flex-1 font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-4 py-3 resize-y text-foreground placeholder:text-muted-foreground/50 transition-all min-h-[140px]"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || !inputValue.trim()}
                  title={t("Enviar (Ctrl+Enter)", "Send (Ctrl+Enter)", "Enviar (Ctrl+Enter)")}
                  aria-label={t("Enviar", "Send", "Enviar")}
                  className="font-mono rounded-none h-10 px-4 btn-weapon-primary"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" title={t("Nova linha (Enter)", "New line (Enter)", "Nueva línea (Enter)")} aria-label={t("Inserir nova linha", "Insert new line", "Insertar nueva línea")}
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
              {t("Enter = nova linha · Ctrl+Enter = enviar", "Enter = new line · Ctrl+Enter = send", "Enter = nueva línea · Ctrl+Enter = enviar")}
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
      mensagens: t("Mensagens", "Messaging", "Mensajería"),
      email: t("E-mail Marketing", "Email marketing", "Marketing por correo"),
      pagamento: t("Gateway de Pagamento", "Payment gateway", "Pasarela de pago"),
      social: t("Mídia Paga", "Paid media", "Medios pagados"),
    };

    const categoriesInUse = [...new Set(relevantIntegrations.map((i) => i.category))];

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 py-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-1.5 mb-4">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary">{t("Passo 1 de 2 — Conectar integrações", "Step 1 of 2 — Connect integrations", "Paso 1 de 2 — Conectar integraciones")}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tighter text-foreground mb-2">
            {t("Conecta em 23 minutos", "Connect in 23 minutes", "Conecta en 23 minutos")}
          </h2>
          <p className="text-xs font-mono text-muted-foreground max-w-xl mx-auto">
            {t("Integre as ferramentas que você já usa — o NexOS vai operar nelas automaticamente durante o lançamento. Você pode conectar agora ou depois em Configurações.", "Connect the tools you already use — NexOS will operate them automatically during your launch. You can connect them now or later in Settings.", "Integra las herramientas que ya usas: NexOS las operará automáticamente durante el lanzamiento. Puedes conectarlas ahora o más adelante en Configuración.")}
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
            {loadingIntegrations ? t("Verificando...", "Checking...", "Comprobando...") : t(`${totalConnected} de ${relevantIntegrations.length} conectadas`, `${totalConnected} of ${relevantIntegrations.length} connected`, `${totalConnected} de ${relevantIntegrations.length} conectadas`)}
          </span>
          <button
            onClick={() => void fetchConnectedIntegrations(true)}
            disabled={refreshingIntegrations}
            className="ml-auto text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
            title={t("Verificar novamente", "Check again", "Volver a comprobar")}
            aria-label={t("Verificar integrações novamente", "Check integrations again", "Volver a comprobar las integraciones")}
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
                      const copy = INTEGRATION_COPY[integration.provider];
                      const selectedPath = path ?? "has_product";
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
                                  {t("Recomendada", "Recommended", "Recomendada")}
                                </Badge>
                              )}
                              {isConnected && (
                                <div className="flex items-center gap-1">
                                  <Wifi className="h-3 w-3 text-green-400" />
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">{t("Conectada", "Connected", "Conectada")}</span>
                                </div>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed mb-1">
                              {copy ? t(integration.description, copy.description[0], copy.description[1]) : integration.description}
                            </p>
                            <p className="font-mono text-[11px] text-primary/70 italic leading-relaxed">
                              → {copy ? t(integration.benefit[selectedPath], ...copy.benefits[selectedPath]) : integration.benefit[selectedPath]}
                            </p>
                          </div>

                          {/* Action */}
                          <div className="shrink-0">
                            {isConnected ? (
                              <div className="flex items-center gap-1.5 border border-green-400/30 bg-green-400/5 px-3 py-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                <span className="font-mono text-[11px] text-green-400 uppercase tracking-widest">{t("Ativo", "Active", "Activo")}</span>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-none font-mono text-[11px] uppercase tracking-widest gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                                onClick={() => window.open("/configuracoes?tab=integracoes", "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                                {t("Conectar", "Connect", "Conectar")}
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
            {t("Sem integração conectada o NexOS ainda funciona — gera toda a estratégia e copy, mas o disparo automático fica desativado. Você pode conectar depois em ", "NexOS still works without a connected integration — it generates your strategy and copy, but automatic sending is disabled. You can connect one later in ", "NexOS sigue funcionando sin integraciones: genera la estrategia y los textos, pero los envíos automáticos quedan desactivados. Puedes conectar una más adelante en ")}
            <span
              className="text-primary cursor-pointer underline underline-offset-2"
              onClick={() => window.open("/configuracoes?tab=integracoes", "_blank")}
            >
              {t("Configurações → Integrações", "Settings → Integrations", "Configuración → Integraciones")}
            </span>.
          </p>
        </div>

        {/* ── Mode selection — Fundador vs Arquiteto ── */}
        <div className="space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("Como você quer trabalhar com o NexOS?", "How do you want to work with NexOS?", "¿Cómo quieres trabajar con NexOS?")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("fundador")}
              className="border border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 p-4 text-left transition-colors group"
            >
              <div className="font-mono text-xs font-bold text-primary uppercase tracking-widest mb-1.5">
                🚀 {t("Modo Fundador", "Founder mode", "Modo fundador")}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
                {t("Guiado, passo a passo. O agente conduz tudo — você decide nos pontos certos.", "Guided, step by step. The agent handles everything — you decide at the right moments.", "Guiado, paso a paso. El agente se encarga de todo; tú decides en los momentos clave.")}
              </div>
              <div className="font-mono text-[10px] text-primary/50 mt-2">{t("Recomendado para primeiros lançamentos", "Recommended for first launches", "Recomendado para los primeros lanzamientos")}</div>
            </button>
            <button
              onClick={() => setMode("arquiteto")}
              className="border border-border/40 hover:border-border/80 bg-muted/10 hover:bg-muted/20 p-4 text-left transition-colors group"
            >
              <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest mb-1.5">
                ⚙️ {t("Modo Arquiteto", "Architect mode", "Modo arquitecto")}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
                {t("Controle total. Visualize cada decisão dos agentes, edite e itere em tempo real.", "Full control. Review every agent decision, edit, and iterate in real time.", "Control total. Revisa cada decisión de los agentes, edita e itera en tiempo real.")}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/40 mt-2">{t("Para usuários avançados", "For advanced users", "Para usuarios avanzados")}</div>
            </button>
          </div>
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
                ? t("Integrações essenciais conectadas — pronto para lançar", "Essential integrations connected — ready to launch", "Integraciones esenciales conectadas: listo para lanzar")
                : t("Você pode conectar agora ou continuar e configurar depois", "You can connect now or continue and set them up later", "Puedes conectar ahora o continuar y configurarlas después")}
            </div>
            <Button
              onClick={handleLaunch}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 text-sm"
            >
              <Rocket className="h-4 w-4" />
              {path === "has_product" ? t("Iniciar briefing estratégico", "Start strategic briefing", "Iniciar briefing estratégico") : t("Ir para minha campanha", "Go to my campaign", "Ir a mi campaña")}
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/50">
              {t("Você pode conectar integrações a qualquer momento em Configurações", "You can connect integrations anytime in Settings", "Puedes conectar integraciones cuando quieras desde Configuración")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAN PREVIEW ─────────────────────────────────────────────────────────────
  if (step === "plan_preview") {
    const DAY_PLAN = [
      { day: 1, phase: t("Pré-lançamento", "Pre-launch", "Prelanzamiento"), activity: t("Aquecimento de audiência + conteúdo de antecipação publicado", "Audience warm-up + teaser content published", "Calentamiento de audiencia + contenido de anticipación publicado"), icon: Target, color: "border-primary/40 bg-primary/10 text-primary" },
      { day: 2, phase: t("Pré-lançamento", "Pre-launch", "Prelanzamiento"), activity: t("Lista de espera ativada + sequência de email iniciada", "Waitlist activated + email sequence started", "Lista de espera activada + secuencia de correo iniciada"), icon: Mail, color: "border-primary/40 bg-primary/10 text-primary" },
      { day: 3, phase: t("Abertura", "Opening", "Apertura"), activity: t("Carrinho aberto + VSL publicado + email blast para lista", "Cart opens + VSL published + email blast to list", "Carrito abierto + VSL publicado + envío masivo a la lista"), icon: Rocket, color: "border-success/40 bg-success/10 text-success" },
      { day: 4, phase: t("Abertura", "Opening", "Apertura"), activity: t("Nurturing automático + WhatsApp ativo para leads quentes", "Automated nurturing + WhatsApp active for hot leads", "Nutrición automática + WhatsApp activo para leads interesados"), icon: MessageSquare, color: "border-success/40 bg-success/10 text-success" },
      { day: 5, phase: t("Urgência", "Urgency", "Urgencia"), activity: t("Email de bônus + social proof + remarketing ativado", "Bonus email + social proof + remarketing activated", "Correo con bono + prueba social + remarketing activado"), icon: TrendingUp, color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" },
      { day: 6, phase: t("Urgência", "Urgency", "Urgencia"), activity: t("Escassez real + último aviso para indecisos", "Real scarcity + final reminder for undecided leads", "Escasez real + último aviso para indecisos"), icon: Shield, color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" },
      { day: 7, phase: t("Fechamento", "Closing", "Cierre"), activity: t("Carrinho fecha às 23:59 + sequência de última hora", "Cart closes at 11:59 p.m. + final-hour sequence", "El carrito cierra a las 23:59 + secuencia de última hora"), icon: CheckCircle2, color: "border-orange-400/40 bg-orange-400/10 text-orange-400" },
    ];

    const CHAT_AGENTS = [
      { label: t("Comandante", "Commander", "Comandante"), color: "text-primary", cat: t("Estratégia", "Strategy", "Estrategia") },
      { label: t("Estrategista", "Strategist", "Estratega"), color: "text-primary", cat: t("Estratégia", "Strategy", "Estrategia") },
      { label: t("Gerente de Lançamento", "Launch Manager", "Gerente de lanzamientos"), color: "text-primary", cat: t("Estratégia", "Strategy", "Estrategia") },
      { label: t("Especialista em Oferta", "Offer Specialist", "Especialista en ofertas"), color: "text-primary", cat: t("Estratégia", "Strategy", "Estrategia") },
      { label: "Product Builder", color: "text-primary", cat: t("Estratégia", "Strategy", "Estrategia") },
      { label: "Copywriter", color: "text-cyan-400", cat: t("Conteúdo", "Content", "Contenido") },
      { label: t("Diretor Criativo", "Creative Director", "Director creativo"), color: "text-cyan-400", cat: t("Conteúdo", "Content", "Contenido") },
      { label: "Landing Page Expert", color: "text-cyan-400", cat: t("Conteúdo", "Content", "Contenido") },
      { label: "Targeting Expert", color: "text-yellow-400", cat: t("Audiência", "Audience", "Audiencia") },
      { label: "Media Buyer", color: "text-yellow-400", cat: t("Audiência", "Audience", "Audiencia") },
      { label: t("Especialista em afiliados", "Affiliate specialist", "Especialista en afiliados"), color: "text-yellow-400", cat: t("Audiência", "Audience", "Audiencia") },
      { label: t("Analista de performance", "Performance analyst", "Analista de rendimiento"), color: "text-success", cat: "Performance" },
      { label: t("Otimizador", "Optimizer", "Optimizador"), color: "text-success", cat: "Performance" },
      { label: t("Estrategista de vídeo", "Video strategist", "Estratega de video"), color: "text-success", cat: "Performance" },
      { label: "Creator Growth", color: "text-success", cat: "Performance" },
      { label: "Compliance Officer", color: "text-orange-400", cat: t("Qualidade", "Quality", "Calidad") },
    ];
    const AUTO_AGENTS = [
      "VSL Script", t("Roteiro de webinar", "Webinar script", "Guion de webinar"), t("Roteiro de live", "Live script", "Guion de directo"), t("Texto de anúncios", "Ad copy", "Textos publicitarios"),
      "CPL Script", t("Sequência de stories", "Stories sequence", "Secuencia de stories"), t("Brief de mídia", "Media brief", "Brief de medios"), "Profile Builder",
      t("Projeção financeira", "Financial projection", "Proyección financiera"), t("Criador de sequências", "Sequence builder", "Creador de secuencias"), "Social Media",
      t("Resposta automática no WhatsApp", "WhatsApp auto-reply", "Respuesta automática de WhatsApp"), t("Lançamento perpétuo", "Evergreen launch", "Lanzamiento evergreen"),
    ];

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 py-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 border border-success/40 bg-success/10 px-3 py-1.5 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="font-mono text-xs uppercase tracking-widest text-success">{t("Plano gerado pelo agente", "Plan generated by the agent", "Plan generado por el agente")}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tighter text-foreground mb-2">
            {t("Seu lançamento em 7 dias", "Your launch in 7 days", "Tu lanzamiento en 7 días")}
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            {t("NexOS executa cada fase automaticamente — você só aprova", "NexOS runs each phase automatically — you just approve", "NexOS ejecuta cada fase automáticamente; tú solo tienes que aprobar")}
          </p>
        </div>

        {/* 7-day timeline strip */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_PLAN.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.day} className={`border p-2 text-center ${d.color}`}>
                <div className="font-mono text-[11px] uppercase tracking-widest opacity-60 mb-1.5">{t("D", "Day ", "D")}{d.day}</div>
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

        {/* Specialists grid */}
        <div className="border border-border/50 bg-card/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("Sistema de 29 agentes NexOS", "29-agent NexOS system", "Sistema de 29 agentes de NexOS")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-0.5">
                {t("16 chat direto", "16 direct chat", "16 de chat directo")}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5">
                {t("13 autônomos", "13 autonomous", "13 autónomos")}
              </span>
            </div>
          </div>

          {/* Direct-chat agents by category */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">
              {t("Disponíveis para consulta direta", "Available for direct chat", "Disponibles para consultas directas")}
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
              {t("Executados automaticamente durante campanhas", "Run automatically during campaigns", "Se ejecutan automáticamente durante las campañas")}
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

        {/* Financial scenarios — real computed from intake data, fallback to tracks */}
        {financialScenarios ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Projeção financeira · 7 dias", "Financial projection · 7 days", "Proyección financiera · 7 días")}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {financialScenarios.map(sc => (
                <div key={sc.key} className={`border px-3 py-3 relative ${sc.color} ${sc.active ? "bg-primary/5" : "opacity-60"}`}>
                  {sc.active && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 border-primary/40 text-primary bg-background">
                        {t("Mais provável", "Most likely", "Más probable")}
                      </Badge>
                    </div>
                  )}
                  <div className="font-mono text-[11px] uppercase tracking-widest opacity-70 mb-2">{sc.label}</div>
                  <div className="font-mono text-sm font-bold mb-1">{formatBRL(sc.revenue)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{sc.leads.toLocaleString("pt-BR")} leads</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{sc.convRate}% conv.</div>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/50">
              {t("Estimativa baseada nos dados do briefing · será refinada pelo Agente de Projeção Financeira durante a estratégia", "Estimate based on your briefing · refined by the Financial Projection Agent during strategy development", "Estimación basada en tu briefing · el agente de proyección financiera la ajustará durante la estrategia")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t("6 Dígitos", "6 Figures", "6 cifras"), value: "R$ 100k–999k", color: "border-primary/40 text-primary", active: path !== "affiliate_nexos" },
              { label: t("8 Dígitos", "8 Figures", "8 cifras"), value: "R$ 10M–99M", color: "border-cyan-400/40 text-cyan-400", active: false },
              { label: t("10 Dígitos", "10 Figures", "10 cifras"), value: "R$ 100M+", color: "border-yellow-400/40 text-yellow-400", active: false },
            ].map(track => (
              <div key={track.label} className={`border px-3 py-2.5 text-center relative ${track.color} ${track.active ? "bg-primary/5" : "opacity-40"}`}>
                {track.active && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 border-primary/40 text-primary bg-background">
                      {t("Seu track", "Your track", "Tu nivel")}
                    </Badge>
                  </div>
                )}
                <div className="font-mono text-[11px] uppercase tracking-widest opacity-60 mb-1">{track.label}</div>
                <div className="font-mono text-xs font-bold">{track.value}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{t("em 7 dias", "in 7 days", "en 7 días")}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Clone Studio ──────────────────────────────────────────────── */}
        {!cloneSessionId && !showCloneStudio && (
          <div className="border border-dashed border-primary/30 p-4 flex items-center gap-4 bg-primary/3 hover:bg-primary/5 transition-colors cursor-pointer group"
            onClick={() => setShowCloneStudio(true)}
          >
            <div className="w-9 h-9 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Video className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-0.5">
                 {t("Clone Studio · Opcional · 5 min", "Clone Studio · Optional · 5 min", "Clone Studio · Opcional · 5 min")}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                {t("Enquanto os agentes trabalham, crie seu clone de voz. Ele vai gerar vídeos de campanha com sua voz e jeito de falar.", "While the agents work, create your voice clone. It will generate campaign videos in your voice and speaking style.", "Mientras trabajan los agentes, crea tu clon de voz. Generará videos de campaña con tu voz y tu forma de hablar.")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}

        {showCloneStudio && !cloneSessionId && (
          <CloneStudioPanel
            firstName={user?.name?.split(" ")[0] ?? "Fundador"}
            onComplete={(sessionId) => {
              setCloneSessionId(sessionId);
              setShowCloneStudio(false);
              toast.success(t("Clone capturado! Seu clone está sendo processado.", "Clone captured! Your clone is being processed.", "¡Clon capturado! Se está procesando."));
            }}
            onSkip={() => setShowCloneStudio(false)}
          />
        )}

        {cloneSessionId && (
          <div className="border border-success/30 bg-success/5 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <div className="flex-1">
              <div className="font-mono text-[11px] font-bold text-success uppercase tracking-widest">{t("Clone capturado com sucesso", "Clone captured successfully", "Clon capturado correctamente")}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{t("Voz e expressões em processamento · disponível em breve para geração de vídeo", "Voice and expressions are processing · available soon for video generation", "Voz y expresiones en proceso · pronto para generar videos próximamente")}</div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border border-primary/30 bg-primary/5 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary" />
          <div className="text-center space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("Confirme o que entendemos antes de escalar o time", "Confirm what we've learned before scaling up the team", "Confirma lo que entendimos antes de ampliar el equipo")}
            </div>
            <Button
              onClick={() => {
                if (cloneSessionId) {
                  setStep("clone_wow");
                } else {
                  handleGoToDiagnosis();
                }
              }}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 text-sm"
            >
              {cloneSessionId ? (
                <><Sparkles className="h-4 w-4" /> {t("Ver apresentação do seu clone", "View your clone's introduction", "Ver la presentación de tu clon")}</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> {t("Está correto — avançar", "That's correct — continue", "Es correcto — continuar")}</>
              )}
            </Button>
            <button
              onClick={handleLaunch}
              className="font-mono text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors uppercase tracking-widest underline underline-offset-2"
            >
              {t("Pular por agora e ir para a campanha", "Skip for now and go to the campaign", "Omitir por ahora e ir a la campaña")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: clone_wow — apresentação do clone + tour guiado ────────────────────
  if (step === "clone_wow") {
    const productName = proposals?.[0]?.name ?? undefined;
    const revenueTarget = proposals?.[0]?.suggestedTrack === "8_digit" ? "R$ 10M+" :
                          proposals?.[0]?.suggestedTrack === "10_digit" ? "R$ 100M+" : "R$ 100k+";
    return (
      <div className="relative">
        <button
          onClick={() => setStep("plan_preview")}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          {t("Voltar ao plano", "Back to plan", "Volver al plan")}
        </button>
        <CloneWowMoment
          userName={user?.name ?? "Usuário"}
          productName={productName}
          revenueTarget={revenueTarget}
          onProceed={handleGoToDiagnosis}
        />
      </div>
    );
  }

  // ── Step: diagnosis_approval — confirmação do diagnóstico ────────────────────
  if (step === "diagnosis_approval") {
    const approvalItems = proposals
      ? [
           { label: t("Produto identificado", "Product identified", "Producto identificado"), value: proposals[0]?.name ?? "—" },
           { label: t("Público-alvo", "Target audience", "Público objetivo"), value: proposals[0]?.targetAudience ?? "—" },
           { label: t("Dor principal", "Main pain point", "Problema principal"), value: proposals[0]?.mainPain ?? "—" },
           { label: t("Transformação", "Transformation", "Transformación"), value: proposals[0]?.transformation ?? "—" },
           { label: t("Track recomendado", "Recommended track", "Nivel recomendado"), value: proposals[0]?.suggestedTrack ?? "—" },
        ]
      : affiliateStrategy
      ? [
           { label: t("Canal principal", "Main channel", "Canal principal"), value: affiliateStrategy.mainChannel },
           { label: t("Tamanho da audiência", "Audience size", "Tamaño de la audiencia"), value: affiliateStrategy.audienceSize },
           { label: t("Abordagem sugerida", "Suggested approach", "Enfoque sugerido"), value: affiliateStrategy.suggestedApproach },
           { label: t("Projeção de receita", "Revenue projection", "Proyección de ingresos"), value: affiliateStrategy.revenueProjection },
        ]
      : audienceMonetizationPlan
      ? [
           { label: t("Modelo de monetização", "Monetization model", "Modelo de monetización"), value: audienceMonetizationPlan.approachTitle },
           { label: t("Produto sugerido", "Suggested product", "Producto sugerido"), value: audienceMonetizationPlan.suggestedProductName },
           { label: t("Faixa de preço", "Price range", "Rango de precios"), value: audienceMonetizationPlan.priceRange },
           { label: t("Timeline de lançamento", "Launch timeline", "Calendario de lanzamiento"), value: audienceMonetizationPlan.launchTimeline },
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
                 {t("Diagnóstico concluído", "Diagnosis complete", "Diagnóstico completado")}
              </span>
            </div>
            <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground mb-2">
               {t("O que entendemos sobre você", "What we've learned about you", "Lo que entendimos sobre ti")}
            </h2>
            <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed">
               {t("Revise o que o time identificou antes de escalarmos os especialistas de campanha.", "Review what the team identified before we scale up the campaign specialists.", "Revisa lo que el equipo identificó antes de ampliar el equipo de especialistas de campaña.")}
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
              {t("Faltou algo importante ou podemos escalar o time de especialistas para planejar sua campanha?", "Is anything important missing, or can we scale up the specialists to plan your campaign?", "¿Falta algo importante o podemos ampliar el equipo de especialistas para planificar tu campaña?")}
            </p>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleGoToIntegrations}
              className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("Está correto, avançar", "That's correct, continue", "Es correcto, continuar")}
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep("plan_preview")}
              className="w-full rounded-none font-mono uppercase tracking-widest h-11 text-sm border-border/50 hover:border-primary/40"
            >
              {t("Quero ajustar informações", "I want to edit the information", "Quiero ajustar la información")}
            </Button>
            <button
              onClick={handleLaunch}
              className="font-mono text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors uppercase tracking-widest underline underline-offset-2 text-center"
            >
              {t("Adicionar algo e ir para a campanha", "Add something and go to the campaign", "Añadir algo e ir a la campaña")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
