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
  Zap, Radio,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";
import { CloneStudioPanel } from "@/components/CloneStudioPanel";
import { CloneWowMoment } from "@/components/CloneWowMoment";
import { useUiText } from "@/lib/i18n";
import jsPDF, { GState } from "jspdf";
import { pdfText } from "@/lib/pdf-text";

// ── Types ─────────────────────────────────────────────────────────────────────
type OnboardingPath = "has_product" | "building_product" | "affiliate_nexos" | "has_audience";
type AudienceSubPath = "micro_launch" | "members_area" | "product_from_audience";
type BriefingCampaignType = "launch" | "perpetual_launch" | "flash_sale" | "live_sale" | "continuous_sales" | "subscription_growth" | "authority" | "audience_growth" | "affiliate";
type UIStep = "welcome" | "path_select" | "audience_subpath" | "conversation" | "trial_social_analysis" | "plan_preview" | "clone_wow" | "diagnosis_approval" | "integration_setup";

const BRIEFING_CAMPAIGN_TYPES: Array<{
  id: BriefingCampaignType;
  icon: typeof Rocket;
  title: [string, string, string];
  description: [string, string, string];
  tag: [string, string, string];
}> = [
  { id: "launch", icon: Rocket, title: ["Lançamento", "Launch", "Lanzamiento"], description: ["Aquecimento, evento e abertura de carrinho em uma janela planejada.", "Warm-up, event, and cart opening on a planned timeline.", "Calentamiento, evento y apertura de carrito en una ventana planificada."], tag: ["PLF / Fórmula", "PLF / Formula", "PLF / Fórmula"] },
  { id: "perpetual_launch", icon: RefreshCw, title: ["Lançamento perpétuo", "Evergreen launch", "Lanzamiento perpetuo"], description: ["Funil contínuo com apresentações e ofertas recorrentes.", "An always-on funnel with recurring presentations and offers.", "Embudo continuo con presentaciones y ofertas recurrentes."], tag: ["Evergreen", "Evergreen", "Evergreen"] },
  { id: "flash_sale", icon: Zap, title: ["Flash sale", "Flash sale", "Venta relámpago"], description: ["Oferta curta, com prazo de 24 a 72 horas.", "A short offer window, typically 24 to 72 hours.", "Oferta breve, normalmente de 24 a 72 horas."], tag: ["24–72 horas", "24–72 hours", "24–72 horas"] },
  { id: "live_sale", icon: Radio, title: ["Venda ao vivo", "Live sale", "Venta en vivo"], description: ["Conversão concentrada em uma live, aula ou evento online.", "Sales concentrated around a live stream, class, or online event.", "Ventas concentradas en una transmisión, clase o evento en línea."], tag: ["Evento ao vivo", "Live event", "Evento en vivo"] },
  { id: "continuous_sales", icon: TrendingUp, title: ["Vendas contínuas", "Continuous sales", "Ventas continuas"], description: ["Aquisição e conversão recorrentes, sem depender de um carrinho de lançamento.", "Ongoing acquisition and conversion without a launch cart window.", "Adquisición y conversión constantes sin depender de un carrito de lanzamiento."], tag: ["Vendas diárias", "Daily sales", "Ventas diarias"] },
  { id: "subscription_growth", icon: Mail, title: ["Crescimento de assinaturas", "Subscription growth", "Crecimiento de suscripciones"], description: ["Captação, ativação e retenção para clube, membros ou serviço recorrente.", "Acquisition, activation, and retention for memberships or recurring services.", "Captación, activación y retención para membresías o servicios recurrentes."], tag: ["Clube / membros", "Membership", "Membresía"] },
  { id: "authority", icon: BarChart2, title: ["Autoridade", "Authority", "Autoridad"], description: ["Posicionamento e conteúdo para fortalecer confiança e referência no mercado.", "Positioning and content to build trust and market authority.", "Posicionamiento y contenido para fortalecer confianza y autoridad."], tag: ["Branding", "Branding", "Marca"] },
  { id: "audience_growth", icon: Users, title: ["Crescimento de audiência", "Audience growth", "Crecimiento de audiencia"], description: ["Atração e relacionamento para ampliar uma audiência própria.", "Attract and engage people to grow an owned audience.", "Atrae y relaciona personas para ampliar una audiencia propia."], tag: ["Orgânico", "Organic", "Orgánico"] },
  { id: "affiliate", icon: Link2, title: ["Campanha de afiliados", "Affiliate campaign", "Campaña de afiliados"], description: ["Divulgação e conversão de um produto de terceiros por afiliados.", "Promote and sell a third-party product through affiliate partners.", "Promoción y venta de un producto de terceros mediante afiliados."], tag: ["Produto de terceiros", "Third-party product", "Producto de terceros"] },
];

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
  const { user, workspace } = useAuth();
  const { setMode } = useMode();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<UIStep>("welcome");
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [trialAccess, setTrialAccess] = useState(false);
  const [trialBriefingCampaignId, setTrialBriefingCampaignId] = useState<string | null>(null);
  const [trialCampaignType, setTrialCampaignType] = useState<BriefingCampaignType>("launch");
  const [trialSocialProfile, setTrialSocialProfile] = useState("");
  const [trialSocialDiagnosis, setTrialSocialDiagnosis] = useState<Record<string, any> | null>(null);
  const [trialSocialAnalysisAvailable, setTrialSocialAnalysisAvailable] = useState(true);
  const [trialSocialLoading, setTrialSocialLoading] = useState(false);
  const [trialSocialSubmitting, setTrialSocialSubmitting] = useState(false);
  const [trialIntakeData, setTrialIntakeData] = useState<Record<string, unknown>>({});
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
    try {
      const status = await customFetch<{
        trialAccess?: boolean;
        trialBriefingCampaignId?: string | null;
      }>("/api/onboarding/status");
      const isTrial = status.trialAccess === true;
      setTrialAccess(isTrial);
      setTrialBriefingCampaignId(status.trialBriefingCampaignId ?? null);

      // Campaign Intake's trial Facebook-analysis flow returns here with the
      // campaign ID so the user sees the same plan preview as the guided flow.
      // Load the persisted briefing and diagnosis instead of starting a new one.
      const trialPreviewCampaignId = new URLSearchParams(window.location.search).get("trialPreviewCampaignId");
      if (trialPreviewCampaignId && /^[0-9a-f-]{36}$/i.test(trialPreviewCampaignId)) {
        if (!isTrial) {
          setLocation(`/campaigns/${trialPreviewCampaignId}/intake`);
          setResumeCheck("resolved");
          return;
        }
        const [campaignResult, diagnosisResult] = await Promise.all([
          customFetch<{ campaign: Record<string, unknown> }>(`/api/campaigns/${trialPreviewCampaignId}`),
          customFetch<{ diagnosis: Record<string, any> | null; socialAnalysisAvailable?: boolean }>(`/api/campaigns/${trialPreviewCampaignId}/social-diagnosis`),
        ]);
        // Do not produce a briefing-only PDF while the trial's social analysis
        // is still available. Return to the campaign step so the user can run it.
        if (!diagnosisResult.diagnosis && diagnosisResult.socialAnalysisAvailable === true) {
          setLocation(`/campaigns/${trialPreviewCampaignId}/intake`);
          setResumeCheck("resolved");
          return;
        }
        const intakeData = (campaignResult.campaign?.intakeData as Record<string, unknown>) ?? {};
        setPath("has_product");
        setCampaignId(trialPreviewCampaignId);
        setTrialIntakeData(intakeData);
        setTrialSocialProfile(String(intakeData["social.facebook"] ?? intakeData["social.facebookPage"] ?? intakeData["social.facebookUrl"] ?? ""));
        setTrialSocialDiagnosis(diagnosisResult.diagnosis);
        setTrialSocialAnalysisAvailable(diagnosisResult.socialAnalysisAvailable !== false);
        setConversationComplete(true);
        setStep("plan_preview");
        setResumeCheck("resolved");
        return;
      }

      const saved = loadOnboardingState();
      if (saved && saved.messages.length > 0 && saved.campaignId) {
        if (!isTrial || saved.path === "has_product") {
          setPath(saved.path);
          setCampaignId(saved.campaignId);
          // A cached trial step may predate the social-analysis gate or point
          // at a paid-only step. Resume the brief, then let handleFinish route
          // through the persisted diagnosis check before showing the preview.
          setStep(isTrial ? "conversation" : saved.step);
          setMessages(saved.messages);
          setConversationComplete(saved.conversationComplete);
          if (saved.audienceSubPath) setAudienceSubPath(saved.audienceSubPath);
          setResumeCheck("resolved");
          return;
        }
        clearOnboardingState();
      }
    } catch {
      setResumeCheck("error");
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
  const handlePathSelect = async (selectedPath: OnboardingPath, selectedCampaignType?: BriefingCampaignType) => {
    if (trialAccess && trialBriefingCampaignId) {
      setLocation(`/campaigns/${trialBriefingCampaignId}/intake`);
      return;
    }
    if (trialAccess && selectedPath !== "has_product") {
      toast.error(t("O trial inclui somente o briefing estratégico e uma análise de Página do Facebook.", "The trial includes only the strategic briefing and one Facebook Page analysis.", "La prueba incluye solo el briefing estratégico y un análisis de página de Facebook."));
      return;
    }
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
        body: JSON.stringify({ path: selectedPath, ...(trialAccess && selectedCampaignType ? { campaignType: selectedCampaignType } : {}) }),
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
        const isCampaignLimit = /campaign limit reached|limite de campanhas atingido/i.test(err.message);
        toast.error(isCampaignLimit
          ? t("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", "Campaign limit reached. Open an existing campaign or upgrade your plan.", "Has alcanzado el límite de campañas. Accede a una campaña existente o mejora tu plan.")
          : err.message, { duration: 6000 });
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
        const isCampaignLimit = /campaign limit reached|limite de campanhas atingido/i.test(err.message);
        toast.error(isCampaignLimit
          ? t("Limite de campanhas atingido. Acesse sua campanha existente ou faça upgrade do plano.", "Campaign limit reached. Open an existing campaign or upgrade your plan.", "Has alcanzado el límite de campañas. Accede a una campaña existente o mejora tu plan.")
          : err.message, { duration: 6000 });
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
    if (trialAccess) {
      if (!campaignId) {
        toast.error(t("Não foi possível localizar o briefing desta avaliação.", "Could not find this trial briefing.", "No se pudo encontrar este briefing de prueba."));
        return;
      }
      setTrialSocialLoading(true);
      try {
        const [campaignResult, diagnosisResult] = await Promise.all([
          customFetch<{ campaign: Record<string, unknown> }>(`/api/campaigns/${campaignId}`),
          customFetch<{ diagnosis: Record<string, any> | null; socialAnalysisAvailable?: boolean }>(`/api/campaigns/${campaignId}/social-diagnosis`),
        ]);
        const intake = (campaignResult.campaign?.intakeData as Record<string, unknown>) ?? {};
        setTrialIntakeData(intake);
        setTrialSocialProfile(String(intake["social.facebook"] ?? intake["social.facebookPage"] ?? intake["social.facebookUrl"] ?? ""));
        setTrialSocialDiagnosis(diagnosisResult.diagnosis);
        setTrialSocialAnalysisAvailable(diagnosisResult.socialAnalysisAvailable !== false);
        if (diagnosisResult.diagnosis) setStep("plan_preview");
        else setStep("trial_social_analysis");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Não foi possível preparar a análise social.", "Could not prepare the social analysis.", "No se pudo preparar el análisis social."));
      } finally {
        setTrialSocialLoading(false);
      }
      return;
    }
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

  const handleTrialSocialAnalysis = async () => {
    if (!campaignId || !trialSocialProfile.trim()) {
      toast.error(t("Informe o endereço ou @ da Página do Facebook que deseja analisar.", "Enter the Facebook Page URL or handle to analyze.", "Ingresa la URL o el usuario de la página de Facebook que quieres analizar."));
      return;
    }
    setTrialSocialSubmitting(true);
    try {
      const result = await customFetch<{ diagnosis: Record<string, any> }>(`/api/campaigns/${campaignId}/social-diagnosis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "facebook", handle: trialSocialProfile.trim() }),
      });
      setTrialSocialDiagnosis(result.diagnosis);
      setTrialSocialAnalysisAvailable(false);
      setStep("plan_preview");
      toast.success(t("Análise da Página do Facebook concluída.", "Facebook Page analysis complete.", "Análisis de página de Facebook completado."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Não foi possível analisar a Página do Facebook.", "Could not analyze the Facebook Page.", "No se pudo analizar la página de Facebook."));
    } finally {
      setTrialSocialSubmitting(false);
    }
  };

  const downloadTrialPlanPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let y = 22;
    const generatedAt = new Date();
    const identityName = user?.name?.trim() || "Usuário NexOS";
    const identityEmail = user?.email?.trim() || "sem-email";
    const identityUserId = user?.id || "unknown-user";
    const identityWorkspaceId = workspace?.id || "unknown-workspace";
    const fingerprintInput = `${identityUserId}::${campaignId ?? "trial"}::${generatedAt.toISOString()}::${window.crypto.randomUUID?.() ?? Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    let fingerprintHash = 0x811c9dc5;
    for (let index = 0; index < fingerprintInput.length; index += 1) {
      fingerprintHash ^= fingerprintInput.charCodeAt(index);
      fingerprintHash = Math.imul(fingerprintHash, 0x01000193) >>> 0;
    }
    const fingerprintHex = fingerprintHash.toString(16).toUpperCase().padStart(8, "0");
    const fingerprint = `NXS-${fingerprintHex.slice(0, 4)}-${fingerprintHex.slice(4, 8)}`;
    const fingerprintBits = fingerprintHex.split("").flatMap((char) => {
      const nibble = Number.parseInt(char, 16);
      return [3, 2, 1, 0].map((bit) => (nibble >> bit) & 1);
    });
    let fingerprintBitIndex = 0;
    const lineHeight = (size: number) => Math.max(4.6, size * 0.48);
    const ensureRoom = (height: number) => {
      if (y + height <= pageHeight - 17) return;
      doc.addPage();
      y = 22;
      doc.setTextColor(70, 80, 220);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("NEXOS - GUIA PRATICO DE EXECUCAO", margin, 13);
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, 16, pageWidth - margin, 16);
      doc.setTextColor(35, 35, 45);
    };
    const write = (rawText: string, size = 10, gap = 4, bold = false, indent = 0) => {
      const text = pdfText(rawText);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - indent) as string[];
      const height = lines.length * lineHeight(size);
      ensureRoom(height + gap);
      const delta = 0.14;
      const baseSpace = doc.getTextWidth(" ");
      lines.forEach((line, lineIndex) => {
        const words = line.split(/\s+/).filter(Boolean);
        let x = margin + indent;
        const lineY = y + lineIndex * lineHeight(size);
        words.forEach((word, wordIndex) => {
          const wordWidth = doc.getTextWidth(word);
          doc.text(word, x, lineY);
          if (wordIndex < words.length - 1) {
            const bit = fingerprintBits[fingerprintBitIndex % fingerprintBits.length];
            fingerprintBitIndex += 1;
            x += wordWidth + baseSpace + (bit ? delta : -delta);
          }
        });
      });
      y += height + gap;
    };
    const section = (title: string) => {
      y += 2;
      ensureRoom(12);
      doc.setTextColor(70, 80, 220);
      write(title.toUpperCase(), 12, 5, true);
      doc.setTextColor(35, 35, 45);
    };
    const field = (...keys: string[]) => {
      for (const key of keys) {
        const value = trialIntakeData[key];
        if (typeof value === "string" && value.trim()) return value.trim().slice(0, 700);
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
        if (Array.isArray(value)) {
          const items = value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
          if (items.length) return items.join(", ").slice(0, 700);
        }
      }
      return "";
    };
    const list = (value: unknown, max = 4): string[] => {
      const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      return items.map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
        if (!item || typeof item !== "object" || Array.isArray(item)) return "";
        const record = item as Record<string, unknown>;
        for (const key of ["action", "recommendation", "nextStep", "suggestion", "title", "description", "text", "step", "content", "summary"]) {
          const candidate = record[key];
          if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
        }
        return "";
      }).filter(Boolean).slice(0, max);
    };
    const label = (name: string, value: string) => write(`${name}: ${value}`, 9, 4);

    const product = field("product.name", "product.nome", "productName") || t("produto/serviço", "product/service", "producto/servicio");
    const description = field("product.description", "product.descricao", "product.summary");
    const audience = field("audience.description", "audience.profile", "audience.public", "audience.target");
    const pains = field("audience.painPoints", "audience.pains");
    const desires = field("audience.desires", "audience.goals");
    const differentiator = field("creator.uniqueAngle", "product.uniqueAngle", "campaign.mainPromise", "campaign.promise");
    const price = field("product.price", "product.offerPrice", "offer.price");
    const campaignType = BRIEFING_CAMPAIGN_TYPES.find((item) => item.id === trialCampaignType);

    doc.setTextColor(70, 80, 220);
    write(t("NexOS: GUIA PRÁTICO DA PRÉVIA", "NexOS: PRACTICAL PREVIEW GUIDE", "NexOS: GUÍA PRÁCTICA DE LA VISTA PREVIA"), 16, 5, true);
    doc.setTextColor(35, 35, 45);
    write(`${t("Cliente", "Customer", "Cliente")}: ${user?.name || t("Usuário NexOS", "NexOS user", "Usuario NexOS")}`, 10, 2);
    write(`${t("Produto", "Product", "Producto")}: ${product}`, 10, 2);
    write(`${t("Estratégia escolhida", "Selected strategy", "Estrategia elegida")}: ${campaignType ? t(...campaignType.title) : t("Não informada", "Not provided", "No indicada")}`, 10, 2);
    write(trialSocialDiagnosis?.handle
      ? `${t("Perfil público analisado", "Public profile analyzed", "Perfil público analizado")}: ${trialSocialDiagnosis.handle} (Facebook)`
      : t("Análise social não realizada; as sugestões usam somente o briefing.", "Social analysis was not performed; suggestions use only the brief.", "No se realizó análisis social; las sugerencias usan solo el briefing."), 9, 5);

    section(t("1. Antes de publicar", "1. Before publishing", "1. Antes de publicar"));
    label(t("O que é a oferta", "What is the offer", "Qué es la oferta"), description || t("Escreva uma frase simples explicando o produto/serviço.", "Write one simple sentence describing the product/service.", "Escribe una frase sencilla que describa el producto/servicio."));
    label(t("Para quem", "Who it is for", "Para quién"), audience || t("Ainda não está específico no briefing. Escolha um grupo de pessoas com uma necessidade em comum.", "Not specific in the brief yet. Choose one group with a shared need.", "Aún no está especificado. Elige un grupo con una necesidad en común."));
    if (pains) label(t("Problema citado", "Problem stated", "Problema indicado"), pains);
    if (desires) label(t("Resultado desejado", "Desired outcome", "Resultado deseado"), desires);
    if (differentiator) label(t("Diferencial informado", "Stated differentiator", "Diferenciador indicado"), differentiator);
    if (price) label(t("Preço informado", "Stated price", "Precio indicado"), price);
    write(t("Checklist: confirme preço, o que está incluído, para quem serve, condições, prazo verdadeiro e link de contato. Complete qualquer campo entre [colchetes] nos exemplos. Não use promessas, depoimentos, números ou escassez que não possa comprovar.", "Checklist: confirm the price, what's included, who it's for, terms, any real deadline, and contact link. Fill every [bracketed] field in the examples. Do not use claims, testimonials, numbers, or scarcity you cannot verify.", "Lista: confirma precio, qué incluye, para quién es, condiciones, plazo real y enlace de contacto. Completa cada campo entre [corchetes]. No uses promesas, testimonios, cifras ni escasez que no puedas comprobar."), 9, 5);

    section(t("2. Plano mínimo de execução - 7 dias", "2. Minimum execution plan - 7 days", "2. Plan mínimo de ejecución - 7 días"));
    write(t("Separe 30 a 45 minutos por dia. Use uma rede onde já tenha público; se ainda não tiver, escolha um canal. Publique uma peça principal por dia e responda às pessoas manualmente. Os exemplos são modelos: adapte-os ao produto e revise antes de publicar.", "Set aside 30 to 45 minutes daily. Use a network where you already have an audience; if you don't, choose one channel. Publish one main piece daily and reply manually. These are templates: adapt and review before posting.", "Reserva de 30 a 45 minutos al día. Usa una red donde ya tengas público; si no, elige un canal. Publica una pieza principal al día y responde manualmente. Son modelos: adáptalos y revísalos antes de publicar."), 9, 5);

    const days = [
      { title: t("Dia 1 - Definir a mensagem", "Day 1 - Define the message", "Día 1 - Define el mensaje"), goal: t("Deixe claro para quem é e qual problema resolve.", "Clarify who it's for and what problem it solves.", "Aclara para quién es y qué problema resuelve."), copy: t("Você também enfrenta [problema]? Nesta semana vou mostrar como [produto/serviço] ajuda [público] com [necessidade]. Quer que eu te avise? Responda 'quero'.", "Do you also face [problem]? This week I'll show how [product/service] helps [audience] with [need]. Want me to let you know? Reply 'yes'.", "¿También tienes [problema]? Esta semana mostraré cómo [producto/servicio] ayuda a [público] con [necesidad]. ¿Quieres que te avise? Responde 'sí'."), action: t("Troque os colchetes por palavras do briefing. Publique em story ou post. Responda quem interagir.", "Replace brackets using the brief. Publish as a story or post. Reply to people who engage.", "Sustituye los corchetes usando el briefing. Publica una historia o post. Responde a quienes interactúen."), metric: t("Anote visualizações, respostas e perguntas.", "Record views, replies, and questions.", "Anota vistas, respuestas y preguntas.") },
      { title: t("Dia 2 - Dar uma dica prática", "Day 2 - Share a practical tip", "Día 2 - Comparte un consejo práctico"), goal: t("Entregue uma pequena ajuda relacionada ao problema do público.", "Give a small piece of help related to the audience's problem.", "Ofrece una pequeña ayuda relacionada con el problema del público."), copy: t("Uma forma de começar com [tema] é: 1) [passo 1]; 2) [passo 2]; 3) [passo 3]. Qual desses passos é mais difícil para você?", "A way to start with [topic] is: 1) [step 1]; 2) [step 2]; 3) [step 3]. Which step is hardest for you?", "Una forma de empezar con [tema] es: 1) [paso 1]; 2) [paso 2]; 3) [paso 3]. ¿Cuál te cuesta más?"), action: t("Use só uma dica que você conhece e consegue explicar. Responda comentários no mesmo dia.", "Use a tip you know and can explain. Reply to comments the same day.", "Usa un consejo que conozcas y puedas explicar. Responde comentarios el mismo día."), metric: t("Anote salvamentos, comentários e perguntas.", "Record saves, comments, and questions.", "Anota guardados, comentarios y preguntas.") },
      { title: t("Dia 3 - Apresentar a oferta", "Day 3 - Present the offer", "Día 3 - Presenta la oferta"), goal: t("Explique o que é, o que inclui, o preço e como comprar ou pedir detalhes.", "Explain what it is, what's included, the price, and how to buy or ask for details.", "Explica qué es, qué incluye, el precio y cómo comprar o pedir detalles."), copy: t("Conheça [produto/serviço], feito para [público] que busca [necessidade]. Inclui [itens principais] e custa [preço/condição]. Veja os detalhes em [link] ou me envie 'detalhes'.", "Meet [product/service], for [audience] looking for [need]. It includes [main items] and costs [price/terms]. Details: [link], or message me 'details'.", "Conoce [producto/servicio], para [público] que busca [necesidad]. Incluye [elementos] y cuesta [precio/condición]. Detalles en [enlace] o escríbeme 'detalles'."), action: t("Teste o link em outro celular/navegador. Não diga 'últimas vagas' sem limite real.", "Test the link on another phone/browser. Don't say 'last spots' without a real limit.", "Prueba el enlace en otro móvil/navegador. No digas 'últimas plazas' sin límite real."), metric: t("Anote cliques, mensagens de interesse e pedidos de compra.", "Record clicks, interested messages, and purchase enquiries.", "Anota clics, mensajes de interés y consultas de compra.") },
      { title: t("Dia 4 - Responder interessados", "Day 4 - Reply to interested people", "Día 4 - Responde a interesados"), goal: t("Entenda a dúvida da pessoa antes de recomendar a oferta.", "Understand the person's question before recommending the offer.", "Entiende la duda antes de recomendar la oferta."), copy: t("Uma pergunta que recebi foi: [dúvida real]. A resposta é: [resposta clara, baseada nas condições]. Se ainda tiver dúvidas, escreva aqui ou me chame.", "A question I received was: [real question]. The answer is: [clear answer based on the terms]. Ask here if you still have questions.", "Una pregunta que recibí fue: [pregunta real]. La respuesta es: [respuesta clara según las condiciones]. Pregunta aquí si aún tienes dudas."), action: t("Responda primeiro a quem pediu informação. Peça permissão antes de enviar mensagens privadas não solicitadas.", "Reply first to people who asked. Get permission before unsolicited private messages.", "Responde primero a quienes preguntaron. Pide permiso antes de enviar mensajes privados no solicitados."), metric: t("Anote as dúvidas frequentes e quantas conversas abriram o link.", "Record frequent questions and conversations that opened the link.", "Anota preguntas frecuentes y conversaciones que abrieron el enlace.") },
      { title: t("Dia 5 - Esclarecer uma objeção", "Day 5 - Address an objection", "Día 5 - Aclara una objeción"), goal: t("Use uma dúvida real e explique para quem a oferta serve ou não serve.", "Use a real concern and explain who the offer is and isn't for.", "Usa una duda real y explica para quién es o no es la oferta."), copy: t("'Isso é para mim?' Pode fazer sentido se [critério verdadeiro]. Não é indicado para [limite real, se houver]. Confira tudo que está incluído em [link].", "'Is this for me?' It may fit if [true criterion]. It may not fit [real limitation, if any]. See what's included at [link].", "'¿Es para mí?' Puede encajar si [criterio verdadero]. No encaja con [límite real, si existe]. Mira qué incluye en [enlace]."), action: t("Não invente depoimentos, resultados ou quantidade de clientes. Use somente informações confirmadas.", "Don't invent testimonials, results, or customer counts. Use confirmed information only.", "No inventes testimonios, resultados ni cantidad de clientes. Usa solo información confirmada."), metric: t("Anote respostas, cliques e dúvidas que ficaram abertas.", "Record replies, clicks, and unanswered questions.", "Anota respuestas, clics y dudas pendientes.") },
      { title: t("Dia 6 - Fazer um lembrete honesto", "Day 6 - Send an honest reminder", "Día 6 - Envía un recordatorio honesto"), goal: t("Reforce condições reais; mencione prazo só se ele existir.", "Restate real terms; mention a deadline only if one exists.", "Repite condiciones reales; menciona plazo solo si existe."), copy: t("Para quem pediu os detalhes: [produto] inclui [benefício verificável] por [preço/condição]. Confira em [link]. [Se houver prazo real: inscrições até data/hora].", "For those who asked: [product] includes [verifiable benefit] for [price/terms]. See [link]. [If real: enrollment closes at date/time].", "Para quienes preguntaron: [producto] incluye [beneficio verificable] por [precio/condiciones]. Mira [enlace]. [Si existe: cierra en fecha/hora]."), action: t("Se não há prazo ou estoque limitado, remova o trecho entre colchetes. Não crie urgência falsa.", "If there is no deadline or stock limit, remove the bracketed part. Don't create false urgency.", "Si no hay plazo ni límite de stock, elimina el texto entre corchetes. No inventes urgencia."), metric: t("Anote cliques, perguntas e pedidos de compra.", "Record clicks, questions, and purchase enquiries.", "Anota clics, preguntas y consultas de compra.") },
      { title: t("Dia 7 - Fechar ou planejar a próxima semana", "Day 7 - Close or plan next week", "Día 7 - Cierra o planifica la próxima semana"), goal: t("Conclua apenas se houver prazo real; caso contrário, revise o que aprendeu.", "Close only if there is a real deadline; otherwise review what you learned.", "Cierra solo si hay un plazo real; si no, revisa lo aprendido."), copy: t("Obrigado por acompanhar. [A oferta encerra hoje às hora, conforme informado] / [A oferta segue disponível em link]. O que devo explicar melhor na próxima semana?", "Thanks for following along. [Offer closes today at stated time] / [Offer remains available at link]. What should I explain better next week?", "Gracias por acompañar. [La oferta cierra hoy a la hora indicada] / [Sigue disponible en enlace]. ¿Qué debo explicar mejor la próxima semana?"), action: t("Use apenas a alternativa verdadeira. Compare os números e repita o conteúdo que trouxe conversas mais relevantes.", "Use only the true option. Compare your numbers and repeat the content that led to the most relevant conversations.", "Usa solo la opción verdadera. Compara tus cifras y repite el contenido que generó conversaciones relevantes."), metric: t("Feche o registro de alcance, respostas, cliques, interessados e vendas pagas.", "Complete reach, replies, clicks, interested people, and paid sales.", "Completa alcance, respuestas, clics, interesados y ventas pagadas.") },
    ];
    days.forEach((day) => {
      ensureRoom(30);
      doc.setTextColor(70, 80, 220);
      write(day.title, 11, 3, true);
      doc.setTextColor(35, 35, 45);
      label(t("Objetivo", "Goal", "Objetivo"), day.goal);
      label(t("Exemplo para adaptar", "Example to adapt", "Ejemplo para adaptar"), day.copy);
      label(t("Faça", "Do", "Hazlo"), day.action);
      label(t("Registre", "Record", "Registra"), day.metric);
      y += 2;
    });

    section(t("3. Como saber se avançou", "3. How to tell if you made progress", "3. Cómo saber si avanzaste"));
    write(t("Ao fim de cada dia, anote em uma folha ou planilha: data e canal; alcance/visualizações; respostas e conversas; cliques no link; interessados; vendas realmente pagas. Mantenha os números de cada rede separados. O resultado mínimo é ter publicado, respondido e registrado dados suficientes para decidir o próximo passo - não há garantia de venda ou alcance.", "At the end of each day, record date/channel, reach/views, replies/conversations, link clicks, interested people, and actually paid sales. Keep network metrics separate. The minimum outcome is to publish, reply, and collect enough data to choose the next step - sales and reach are not guaranteed.", "Al final de cada día, anota fecha/canal, alcance/vistas, respuestas/conversaciones, clics, interesados y ventas pagadas. Separa las redes. El resultado mínimo es publicar, responder y reunir datos para decidir el siguiente paso; no se garantizan ventas ni alcance."), 9, 5);

    const analysis = trialSocialDiagnosis?.publicProfileAnalysis ?? {};
    if (analysis.overview) {
      section(t("4. Sugestões da análise social", "4. Social analysis suggestions", "4. Sugerencias del análisis social"));
      if (typeof analysis.overview === "string") {
        write(analysis.overview, 9, 4);
      } else if (typeof analysis.overview === "object" && !Array.isArray(analysis.overview)) {
        const overview = analysis.overview as Record<string, unknown>;
        const overviewFields: Array<[string, unknown]> = [
          [t("Biografia", "Bio", "Biografía"), overview.bio],
          [t("Seguidores estimados", "Estimated followers", "Seguidores estimados"), overview.estimatedFollowers],
          [t("Seguindo", "Following", "Siguiendo"), overview.followingCount],
          [t("Frequência de publicação", "Posting frequency", "Frecuencia de publicación"), overview.postFrequency],
          [t("Idade da conta", "Account age", "Antigüedad de la cuenta"), overview.accountAge],
          [t("Verificação", "Verified", "Verificación"), overview.verified == null ? null : overview.verified ? t("Sim", "Yes", "Sí") : t("Não", "No", "No")],
        ];
        overviewFields.forEach(([name, value]) => {
          if (typeof value === "string" && value.trim() && !/^(não encontrado|nao encontrado|not found|indisponível|unavailable)$/i.test(value.trim())) label(name, value.trim());
          else if (typeof value === "number" && Number.isFinite(value)) label(name, String(value));
        });
      }
      const strengths = list(analysis.strategicAnalysis?.strengths);
      const opportunities = list(analysis.strategicAnalysis?.opportunities);
      const gapAnalysis = (analysis.gapAnalysis && typeof analysis.gapAnalysis === "object" ? analysis.gapAnalysis : {}) as Record<string, unknown>;
      const actionPlan = (analysis.actionPlan && typeof analysis.actionPlan === "object" ? analysis.actionPlan : {}) as Record<string, unknown>;
      const specificActions = [
        ...list(gapAnalysis.criticalGaps, 2),
        ...list(gapAnalysis.quickWins, 3),
        ...list(actionPlan.immediate, 3),
        ...list(actionPlan.shortTerm, 3),
        ...list(actionPlan.longTerm, 2),
        ...list(analysis.strategicAnalysis?.opportunities, 2),
      ].filter((action, index, all) => all.indexOf(action) === index).slice(0, 5);
      const fallbackActions = [
        t("Revise a descrição da Página para explicar a quem a oferta se destina e qual é o próximo passo. Confira se o link da chamada para ação funciona.", "Update the Page description to explain who the offer is for and what to do next. Check that the call-to-action link works.", "Actualiza la descripción de la página para explicar para quién es la oferta y cuál es el siguiente paso. Comprueba que funcione el enlace de llamada a la acción."),
        t("Fixe uma publicação que apresente a oferta, o que inclui e como pedir detalhes. Use apenas preços, condições e provas autorizadas.", "Pin a post explaining the offer, what's included, and how to get details. Use only authorized prices, terms, and evidence.", "Fija una publicación que presente la oferta, qué incluye y cómo pedir detalles. Usa solo precios, condiciones y pruebas autorizadas."),
        t("Durante uma semana, alterne conteúdo útil, respostas a dúvidas reais e apresentação da oferta. Responda às interações manualmente.", "For one week, rotate useful content, answers to real questions, and an offer post. Reply to interactions manually.", "Durante una semana, alterna contenido útil, respuestas a preguntas reales y presentación de la oferta. Responde manualmente a las interacciones."),
        t("Registre alcance, respostas, cliques, conversas qualificadas e vendas pagas. Ao fim da semana, repita o formato que gerou conversas relevantes.", "Track reach, replies, clicks, qualified conversations, and paid sales. At the end of the week, repeat the format that brought relevant conversations.", "Registra alcance, respuestas, clics, conversaciones cualificadas y ventas pagadas. Al final de la semana, repite el formato que generó conversaciones relevantes."),
      ];
      const actions = specificActions.length ? specificActions : fallbackActions;
      if (strengths.length) label(t("Pontos fortes observados", "Observed strengths", "Puntos fuertes observados"), strengths.join("; "));
      if (opportunities.length) label(t("Oportunidades sugeridas", "Suggested opportunities", "Oportunidades sugeridas"), opportunities.join("; "));
      write(specificActions.length
        ? t("Próximas ações sugeridas pela análise:", "Next actions suggested by the analysis:", "Próximas acciones sugeridas por el análisis:")
        : t("Ações iniciais recomendadas (a análise não retornou ações específicas verificáveis):", "Initial recommended actions (the analysis returned no specific verifiable actions):", "Acciones iniciales recomendadas (el análisis no devolvió acciones específicas verificables):"), 9, 3, true);
      actions.forEach((action, index) => write(`${index + 1}. ${action}`, 9, 3, false, 2));
      if (typeof actionPlan.contentCalendarHint === "string" && actionPlan.contentCalendarHint.trim()) {
        label(t("Sugestão de calendário", "Calendar suggestion", "Sugerencia de calendario"), actionPlan.contentCalendarHint.trim());
      }
      const accountType = analysis.accountType === "personal_profile" || analysis.accountType === "business_page"
        ? analysis.accountType
        : "unknown";
      if (typeof analysis.accountTypeEvidence === "string" && analysis.accountTypeEvidence.trim()) {
        label(
          accountType === "personal_profile"
            ? t("Tipo de presença identificado", "Presence type identified", "Tipo de presencia identificado")
            : accountType === "business_page"
              ? t("Tipo de presença identificado", "Presence type identified", "Tipo de presencia identificado")
              : t("Identificação da presença", "Presence identification", "Identificación de la presencia"),
          analysis.accountTypeEvidence.trim().slice(0, 300),
        );
      }
      if (accountType !== "business_page") {
        const bioSuggestion = (product + (audience ? " para " + audience : "") + (desires ? ": " + desires : "") + ". " + t("Saiba mais", "Learn more", "Más información") + ": [link]").slice(0, 210);
        const accountTypeNote = accountType === "personal_profile"
          ? t("A análise identificou um perfil pessoal. Para esta campanha de produto/serviço, use uma Página como canal principal da marca; mantenha o perfil pessoal para relacionamento e divulgação, se fizer sentido.", "The analysis identified a personal profile. For this product/service campaign, use a Page as the brand's primary channel; keep the personal profile for relationships and promotion if appropriate.", "El análisis identificó un perfil personal. Para esta campaña de producto/servicio, usa una página como canal principal de la marca; conserva el perfil para relaciones y difusión si tiene sentido.")
          : t("Não foi possível confirmar se o endereço é um perfil pessoal ou uma Página. Se for perfil pessoal e a campanha representa uma marca ou empresa, crie uma Página e use-a como canal principal.", "We could not confirm whether the URL is a personal profile or a Page. If it is a personal profile and the campaign represents a brand or business, create a Page and use it as the primary channel.", "No pudimos confirmar si la dirección es un perfil personal o una página. Si es un perfil personal y la campaña representa una marca o empresa, crea una página y úsala como canal principal.");
        write(accountTypeNote, 9, 4);
        write(t("Ajustes rápidos para a campanha:", "Quick setup for this campaign:", "Ajustes rápidos para esta campaña:"), 9, 3, true);
        [
          t("Crie a Página em Facebook > Menu > Páginas > Criar nova Página; escolha um nome e categoria que correspondam ao produto.", "Create the Page from Facebook > Menu > Pages > Create new Page; choose a name and category that match the product.", "Crea la página desde Facebook > Menú > Páginas > Crear nueva página; elige un nombre y categoría que correspondan al producto."),
          t("Bio sugerida", "Suggested bio", "Biografía sugerida") + ": " + bioSuggestion,
          t("Use uma imagem de perfil legível (logo ou rosto do especialista) e uma capa com produto, público e chamada para ação. Evite texto pequeno e promessas sem comprovação.", "Use a clear profile image (logo or expert's face) and a cover with the product, audience, and call to action. Avoid tiny text and unsupported claims.", "Usa una imagen de perfil clara (logo o rostro del especialista) y una portada con producto, público y llamada a la acción. Evita texto pequeño y promesas sin pruebas."),
          t("Primeiras publicações", "First posts", "Primeras publicaciones") + ": " + t("1) apresentação de", "1) introduce", "1) presenta") + " " + product + "; " + t("2) dica prática sobre", "2) practical tip about", "2) consejo práctico sobre") + " " + (pains || audience || product) + "; " + t("3) oferta, o que inclui e como avançar", "3) offer, what's included, and next step", "3) oferta, qué incluye y cómo avanzar") + ".",
          t("Adicione um botão/link de contato e, na primeira semana, acompanhe alcance, compartilhamentos, mensagens e cliques para ajustar os próximos posts.", "Add a contact button/link and track reach, shares, messages, and clicks during the first week to adjust the next posts.", "Añade un botón/enlace de contacto y, durante la primera semana, revisa alcance, compartidos, mensajes y clics para ajustar las próximas publicaciones."),
        ].forEach((action, index) => write((index + 1) + ". " + action, 9, 3, false, 2));
      }
      write(t("A análise de perfil público é indicativa. Confira manualmente as observações antes de mudar a estratégia ou investir em anúncios.", "Public profile analysis is indicative. Verify observations before changing strategy or spending on ads.", "El análisis del perfil público es orientativo. Verifica las observaciones antes de cambiar la estrategia o invertir en anuncios."), 9, 4);
    }
    section(t("Quer levar esta estratégia mais longe?", "Ready to take this strategy further?", "¿Quieres llevar esta estrategia más lejos?"));
    write(t("Este documento é uma análise básica e gratuita, construída a partir das informações que você compartilhou no briefing e, quando realizada, de sinais públicos da rede social. Com uma licença NexOS, os agentes podem aprofundar o diagnóstico e transformar esta primeira direção em um plano de campanha mais completo e personalizado, com estratégia, calendário, conteúdos e recomendações práticas de execução. Quando você conecta e autoriza suas contas, o plano também pode considerar os dados disponíveis dessas redes para orientar melhor as decisões. Você recebe mais contexto para agir com clareza e aproveitar melhor cada etapa da campanha. A profundidade depende das informações e integrações disponíveis; nenhum plano garante resultados de alcance ou vendas. Esta prévia não conecta contas, publica conteúdo, envia mensagens nem cria anúncios.", "This document is a free, basic analysis built from the information you shared in the brief and, when performed, public social signals. With a NexOS license, the agents can deepen the diagnosis and turn this initial direction into a more complete, personalized campaign plan with strategy, a calendar, content, and practical execution recommendations. When you connect and authorize your accounts, the plan can also use the data available from those networks to better inform decisions. You get more context to act with clarity and make the most of each campaign stage. The depth depends on available information and integrations; no plan guarantees reach or sales. This preview does not connect accounts, publish content, send messages, or create ads.", "Este documento es un análisis básico y gratuito, creado a partir de la información compartida en el briefing y, cuando se realiza, de señales públicas de redes sociales. Con una licencia NexOS, los agentes pueden profundizar el diagnóstico y convertir esta primera orientación en un plan de campaña más completo y personalizado, con estrategia, calendario, contenidos y recomendaciones prácticas de ejecución. Cuando conectas y autorizas tus cuentas, el plan también puede considerar los datos disponibles de esas redes para orientar mejor las decisiones. Obtienes más contexto para actuar con claridad y aprovechar cada etapa de la campaña. El nivel de detalle depende de la información y las integraciones disponibles; ningún plan garantiza alcance ni ventas. Esta vista previa no conecta cuentas, publica contenido, envía mensajes ni crea anuncios."), 9, 4);

    // Add the same visible, per-recipient identification used by the licensed Master Plan.
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      const pageCommands = (doc.internal as typeof doc.internal & { pages: string[][] }).pages[page];
      const watermarkStart = pageCommands.length;
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.12 }));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(180, 160, 210);
      const watermark = `CÓPIA IDENTIFICADA PARA ${identityName.toUpperCase()} · ${identityEmail} · ${fingerprint}`;
      doc.text(watermark, pageWidth / 2, pageHeight / 2, { angle: 45, align: "center" });
      doc.setFontSize(7.5);
      doc.text(watermark, pageWidth / 2, pageHeight / 3, { angle: 45, align: "center" });
      doc.text(watermark, pageWidth / 2, (2 * pageHeight) / 3, { angle: 45, align: "center" });
      doc.restoreGraphicsState();
      const watermarkCommands = pageCommands.splice(watermarkStart);
      const firstTextCommand = pageCommands.findIndex((command) => /^BT\b/.test(command));
      pageCommands.splice(firstTextCommand < 0 ? pageCommands.length : firstTextCommand, 0, ...watermarkCommands);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 125);
      doc.text(`${t("Prévia NexOS", "NexOS preview", "Vista previa NexOS")} - ${page}/${totalPages + 1} · ${fingerprint}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }

    // Include a clear usage notice without claiming encryption or preventing copying.
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(70, 80, 220);
    doc.text(pdfText("IDENTIFICAÇÃO E USO DO DOCUMENTO"), margin, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 55);
    const protectionNotice = pdfText(
      `Esta prévia foi gerada para uso de ${identityName} (${identityEmail}), no workspace ${workspace?.name || "NexOS"}. A cópia contém identificação visível em todas as páginas e metadados vinculados à conta. O fingerprint ${fingerprint} identifica esta versão. Use o material para avaliação e execução pessoal no seu negócio; não redistribua ou publique o documento integral sem autorização. A marca d'água auxilia a identificar a origem da cópia, mas não impede tecnicamente a cópia do arquivo.`
    );
    doc.text(doc.splitTextToSize(protectionNotice, pageWidth - margin * 2), margin, 42);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 115);
    doc.text(`${t("Prévia NexOS", "NexOS preview", "Vista previa NexOS")} - ${totalPages + 1}/${totalPages + 1} · ${fingerprint}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    const noticePage = doc.getNumberOfPages();
    const noticeCommands = (doc.internal as typeof doc.internal & { pages: string[][] }).pages[noticePage];
    const noticeWatermarkStart = noticeCommands.length;
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.12 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(180, 160, 210);
    const noticeWatermark = `CÓPIA IDENTIFICADA PARA ${identityName.toUpperCase()} · ${identityEmail} · ${fingerprint}`;
    doc.text(noticeWatermark, pageWidth / 2, pageHeight / 2, { angle: 45, align: "center" });
    doc.setFontSize(7.5);
    doc.text(noticeWatermark, pageWidth / 2, pageHeight / 3, { angle: 45, align: "center" });
    doc.text(noticeWatermark, pageWidth / 2, (2 * pageHeight) / 3, { angle: 45, align: "center" });
    doc.restoreGraphicsState();
    const noticeWatermarkCommands = noticeCommands.splice(noticeWatermarkStart);
    const noticeFirstText = noticeCommands.findIndex((command) => /^BT\b/.test(command));
    noticeCommands.splice(noticeFirstText < 0 ? noticeCommands.length : noticeFirstText, 0, ...noticeWatermarkCommands);
    doc.setProperties({
      title: `NexOS AI — Prévia de lançamento ${campaignId ?? "trial"}`,
      author: identityName,
      creator: "NexOS AI",
      subject: `Prévia personalizada para ${identityEmail}`,
      keywords: `nexos-ai,trial-preview,${fingerprint},${identityUserId},${identityWorkspaceId},${identityEmail}`,
    });
    doc.save(`nexos-previa-lancamento-${(campaignId ?? "trial").slice(0, 8)}-${fingerprint}.pdf`);
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

          {trialAccess && !trialBriefingCampaignId && (
            <div className="mb-8 border border-primary/30 bg-card/20 p-5 md:p-7">
              <div className="text-center mb-5">
                <p className="font-mono text-[11px] uppercase tracking-widest text-primary/70 mb-2">{t("Escolha o tipo da sua campanha", "Choose your campaign type", "Elige el tipo de campaña")}</p>
                <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tight text-foreground mb-2">{t("Qual estratégia você quer planejar?", "What strategy do you want to plan?", "¿Qué estrategia quieres planificar?")}</h2>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{t("O briefing continua gratuito no trial. Os agentes podem recomendar ajustes depois de entender seu produto.", "The briefing remains included in your trial. Agents may recommend adjustments after learning about your product.", "El briefing sigue incluido en tu prueba. Los agentes pueden recomendar ajustes después de conocer tu producto.")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BRIEFING_CAMPAIGN_TYPES.map((campaignType) => {
                  const Icon = campaignType.icon;
                  const selected = trialCampaignType === campaignType.id;
                  return (
                    <button
                      key={campaignType.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTrialCampaignType(campaignType.id)}
                      className={`flex items-start gap-3 p-4 text-left border transition-colors ${selected ? "border-primary bg-primary/10" : "border-border/40 bg-background/40 hover:border-primary/50"}`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">{t(...campaignType.title)}</span>
                          <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-wider px-1.5 py-0 border-primary/25 text-primary/80">{t(...campaignType.tag)}</Badge>
                        </span>
                        <span className="block mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">{t(...campaignType.description)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PRIMARY CTA ──────────────────────────────────────────────── */}
          <div className="mb-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
            <div className="border border-primary/40 bg-primary/5 p-6 md:p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-primary/70 mb-2">{t("Recomendado", "Recommended", "Recomendado")}</p>
              <h2 className="font-mono font-black text-xl md:text-2xl uppercase tracking-tighter text-foreground mb-2">
                {trialAccess && !trialBriefingCampaignId
                  ? t("Briefing de campanha", "Campaign briefing", "Briefing de campaña")
                  : t("Iniciar briefing agora", "Start briefing now", "Iniciar briefing ahora")}
              </h2>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 leading-relaxed">
                {trialAccess && !trialBriefingCampaignId
                  ? <>{t("Tipo selecionado:", "Selected type:", "Tipo seleccionado:")} <strong className="text-primary">{t(...BRIEFING_CAMPAIGN_TYPES.find((item) => item.id === trialCampaignType)!.title)}</strong>. {t("Responda às perguntas para montar a estratégia.", "Answer the questions to build your strategy.", "Responde las preguntas para crear la estrategia.")}</>
                  : t("Responda às perguntas do time de agentes — eles descobrirão o melhor caminho para você", "Answer the agent team's questions — they'll find the best path for you", "Responde las preguntas del equipo de agentes: descubrirán el mejor camino para ti")}
              </p>
              <button
                onClick={() => trialBriefingCampaignId
                  ? setLocation(`/campaigns/${trialBriefingCampaignId}/intake`)
                  : handlePathSelect("has_product", trialAccess ? trialCampaignType : undefined)}
                disabled={starting}
                className="w-full md:w-auto inline-flex items-center justify-center gap-3 rounded-none font-mono uppercase tracking-widest font-black btn-weapon-primary h-14 px-12 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting && path === "has_product"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Rocket className="h-5 w-5" />
                }
                {trialBriefingCampaignId
                  ? t("Continuar briefing", "Continue briefing", "Continuar briefing")
                  : t("Começar briefing", "Start briefing", "Comenzar briefing")}
              </button>
            </div>
          </div>

          {/* Trial access is limited to one strategic briefing; paid product discovery paths stay hidden. */}
          {trialAccess ? (
            <div className="border border-emerald-400/30 bg-emerald-400/5 p-4 text-center">
              <p className="font-mono text-xs text-emerald-300">
                {trialBriefingCampaignId
                  ? t("Seu briefing de avaliação já foi iniciado. Continue de onde parou.", "Your trial briefing has already started. Continue where you left off.", "Tu briefing de prueba ya comenzó. Continúa donde lo dejaste.")
                  : t("A avaliação inclui 1 briefing estratégico e 1 análise de Página do Facebook. Os demais recursos são liberados com uma licença.", "The trial includes 1 strategic briefing and 1 Facebook Page analysis. Other features require a license.", "La prueba incluye 1 briefing estratégico y 1 análisis de página de Facebook. Las demás funciones requieren una licencia.")}
              </p>
            </div>
          ) : <div className="mb-4">
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
          </div>}
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

  if (step === "trial_social_analysis") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 py-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5">
            <Users className="h-4 w-4 text-cyan-300" />
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-300">{t("Etapa trial · análise social", "Trial step · social analysis", "Etapa de prueba · análisis social")}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase">{t("Qual é sua Página do Facebook?", "What is your Facebook Page?", "¿Cuál es tu página de Facebook?")}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t("Vamos avaliar a presença pública da marca antes de montar a prévia do plano. Informe a Página oficial do Facebook. Não precisa conectar a conta nem compartilhar senha para analisar conteúdo público.", "We’ll review the brand’s public presence before preparing the plan preview. Enter its official Facebook Page. You do not need to connect an account or share a password to analyze public content.", "Revisaremos la presencia pública de la marca antes de preparar la vista previa. Indica su página oficial de Facebook. No necesitas conectar una cuenta ni compartir la contraseña para analizar contenido público.")}</p>
        </div>
        <section className="border border-cyan-400/30 bg-card/40 p-5 space-y-4">
          <label className="block space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Página ou perfil público", "Public Page or profile", "Página o perfil público")}</span>
            <input value={trialSocialProfile} onChange={(event) => setTrialSocialProfile(event.target.value)} placeholder="https://facebook.com/sua-marca ou @sua-marca" disabled={trialSocialSubmitting || trialSocialLoading} className="w-full h-12 border border-border/50 bg-background px-4 text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">{t("Use o link ou @ da Página pública da empresa ou marca. Não informe senha. O diagnóstico será indicativo e usará apenas informações públicas.", "Use the link or @handle of the company's or brand's public Page. Do not enter a password. The diagnosis is indicative and uses public information only.", "Usa el enlace o @ de la página pública de la empresa o marca. No indiques contraseñas. El diagnóstico es orientativo y solo usa información pública.")}</p>
          {!trialSocialAnalysisAvailable && !trialSocialDiagnosis && <p role="alert" className="border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">{t("A análise social incluída neste trial já foi utilizada, mas o resultado não foi localizado neste briefing. Não vamos iniciar outra análise para evitar consumir novamente o benefício. Atualize a página; se continuar, contate o suporte.", "The social analysis included with this trial has already been used, but its result was not found in this brief. We will not start another analysis and consume the benefit again. Refresh the page; if this continues, contact support.", "El análisis social incluido en esta prueba ya se utilizó, pero no se encontró el resultado en este briefing. No iniciaremos otro análisis para evitar consumir el beneficio nuevamente. Actualiza la página; si continúa, contacta con soporte.")}</p>}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
            <Button variant="outline" onClick={() => setStep("conversation")} disabled={trialSocialSubmitting} className="rounded-none font-mono uppercase text-xs">{t("Voltar ao briefing", "Back to briefing", "Volver al briefing")}</Button>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setStep("plan_preview")} disabled={trialSocialSubmitting || trialSocialLoading} className="rounded-none font-mono uppercase text-xs">{t("Pular por agora e ver prévia", "Skip for now and view preview", "Omitir por ahora y ver vista previa")}</Button>
              <Button onClick={() => void handleTrialSocialAnalysis()} disabled={!trialSocialAnalysisAvailable || trialSocialSubmitting || trialSocialLoading || !trialSocialProfile.trim()} className="rounded-none font-mono uppercase tracking-wider btn-weapon-primary">
                {trialSocialSubmitting || trialSocialLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("Analisando página…", "Analyzing Page…", "Analizando página…")}</> : <><BarChart2 className="h-4 w-4 mr-2" />{t("Analisar e montar prévia", "Analyze and prepare preview", "Analizar y preparar vista previa")}</>}
              </Button>
            </div>
          </div>
        </section>
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
            <span className="font-mono text-xs uppercase tracking-widest text-success">{trialAccess ? t("Prévia gratuita do plano", "Free plan preview", "Vista previa gratuita del plan") : t("Plano gerado pelo agente", "Plan generated by the agent", "Plan generado por el agente")}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-tighter text-foreground mb-2">
            {t("Seu lançamento em 7 dias", "Your launch in 7 days", "Tu lanzamiento en 7 días")}
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            {trialAccess ? t("Prévia de planejamento: a execução requer uma licença NexOS", "Planning preview: execution requires a NexOS license", "Vista previa de planificación: la ejecución requiere una licencia NexOS") : t("NexOS executa cada fase automaticamente — você só aprova", "NexOS runs each phase automatically — you just approve", "NexOS ejecuta cada fase automáticamente; tú solo tienes que aprobar")}
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

        {!trialAccess && <>
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
        </>}

        {/* CTA */}
        {trialAccess ? (
          <div className="border border-success/30 bg-success/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="font-mono font-bold uppercase tracking-wider">{t("Prévia do trial pronta", "Trial preview is ready", "Vista previa de prueba lista")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{String(trialSocialDiagnosis?.publicProfileAnalysis?.overview ?? (!trialSocialAnalysisAvailable
              ? t("A análise incluída já foi usada, mas o relatório não foi localizado nesta campanha. Esta prévia usa as respostas do briefing.", "The included analysis has already been used, but its report was not found on this campaign. This preview uses your briefing answers.", "El análisis incluido ya se utilizó, pero no se encontró el informe en esta campaña. Esta vista previa usa tus respuestas del briefing.")
              : t("Nenhuma Página foi analisada. Você pode usar esta prévia do briefing sem a análise social.", "No Page was analyzed. You can use this brief preview without the social analysis.", "No se analizó ninguna página. Puedes ver esta vista previa sin el análisis social.")))}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={downloadTrialPlanPdf} className="rounded-none font-mono uppercase tracking-wider btn-weapon-primary gap-2"><ArrowRight className="h-4 w-4" />{t("Baixar plano em PDF", "Download plan PDF", "Descargar plan en PDF")}</Button>
              <Button variant="outline" onClick={() => setLocation("/billing")} className="rounded-none font-mono uppercase tracking-wider">{t("Conhecer as licenças", "View licenses", "Ver licencias")}</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("Este documento é uma prévia. O trial não inicia execução, publicações, anúncios ou automações de campanha.", "This document is a preview. Trial does not start campaign execution, publishing, ads, or automations.", "Este documento es una vista previa. La prueba no inicia ejecución, publicaciones, anuncios ni automatizaciones.")}</p>
          </div>
        ) : (
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
        )}
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
