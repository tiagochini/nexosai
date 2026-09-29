/**
 * PreLaunchChecklist — Gate obrigatório antes de lançar uma campanha.
 *
 * Verifica 6 gates antes de liberar o botão "Lançar":
 *   1. Canal de mensagens (WhatsApp Business ou Telegram) — obrigatório
 *   2. Plataforma de email (RD Station ou ActiveCampaign) — obrigatório
 *   3. Redes sociais (Instagram / TikTok) — opcional, com bypass
 *   4. TODAS as peças de conteúdo do schedule aprovadas pelo usuário — obrigatório
 *   5. Funil & Landing Page publicada — confirmação manual — obrigatório
 *   6. Plano financeiro & de mídia revisado e confirmado — obrigatório
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useUiText } from "@/lib/i18n";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, MessageCircle, Mail,
  Rocket, ShieldCheck, Zap, FileText, Eye,
  DollarSign, TrendingUp, BarChart3, Users, Target,
  Image, Clapperboard,
} from "lucide-react";

// ─── Integration setup wizards ────────────────────────────────────────────────

const INTEGRATION_WIZARDS = {
  whatsapp: {
    name: "WhatsApp Business API",
    icon: "💬",
    why: "Disparar mensagens para leads, sequências e notificações de abertura do carrinho",
    steps: [
      { label: "Acesse o Meta Business Manager", detail: "Vá em business.facebook.com → Configurações → WhatsApp", url: "https://business.facebook.com" },
      { label: "Adicione seu número de telefone", detail: "Menu WhatsApp → Números de Telefone → Adicionar número. Verifique via SMS ou ligação." },
      { label: "Crie um App na Meta for Developers", detail: "developers.facebook.com → Meus Apps → Criar App → Negócios. Adicione o produto WhatsApp Business.", url: "https://developers.facebook.com" },
      { label: "Obtenha as credenciais", detail: "No painel do App: copie o Phone Number ID e o Token de Acesso Permanente (começa com EAAB...)" },
      { label: "Cole aqui no NexOS AI", detail: "Configurações → Integrações → WhatsApp Business → Colar credenciais → Conectar" },
    ],
  },
  telegram: {
    name: "Telegram Bot",
    icon: "✈️",
    why: "Alternativa ao WhatsApp para disparo de mensagens em grupos e canais de leads",
    steps: [
      { label: "Abra o Telegram e procure @BotFather", detail: "Pesquise @BotFather na barra de busca do Telegram" },
      { label: "Crie um bot novo", detail: "Envie /newbot → escolha nome → escolha username (deve terminar em 'bot')" },
      { label: "Copie o token gerado", detail: "O BotFather responde com token no formato 1234567890:ABCdef..." },
      { label: "Cole o token no NexOS AI", detail: "Configurações → Integrações → Telegram → Colar token → Conectar" },
    ],
  },
  rd_station: {
    name: "RD Station Marketing",
    icon: "📧",
    why: "Criar e disparar fluxos de email para leads capturados durante o lançamento",
    steps: [
      { label: "Acesse o RD Station", detail: "app.rdstation.com → crie sua conta (tem plano gratuito)", url: "https://app.rdstation.com" },
      { label: "Gere uma chave de API", detail: "Menu → Configurações → Integrações → API → Gerar nova chave de API" },
      { label: "Copie a chave gerada", detail: "A chave tem formato longo de letras e números. Copie ela completa." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → RD Station → Colar chave → Conectar" },
    ],
  },
  activecampaign: {
    name: "ActiveCampaign",
    icon: "📨",
    why: "Automação de email marketing e segmentação de leads durante o lançamento",
    steps: [
      { label: "Acesse o ActiveCampaign", detail: "activecampaign.com → crie ou entre na sua conta", url: "https://www.activecampaign.com" },
      { label: "Encontre suas credenciais de API", detail: "Ícone do usuário → Minha Conta → Developer → URL da API e Chave de API" },
      { label: "Copie a URL e a chave", detail: "URL: https://sua-conta.api-us1.com. Chave: sequência longa. Copie ambas." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → ActiveCampaign → Colar URL e chave → Conectar" },
    ],
  },
  instagram: {
    name: "Instagram / Meta Business",
    icon: "📸",
    why: "Auto-post de conteúdo orgânico, Stories e Reels gerados pelo NexOS AI durante o lançamento",
    steps: [
      { label: "Acesse o Meta Business Suite", detail: "business.facebook.com → certifique-se que sua Página do Instagram está vinculada à conta Business", url: "https://business.facebook.com" },
      { label: "Crie um App na Meta for Developers", detail: "developers.facebook.com → Meus Apps → Criar App → Tipo: Negócios. Adicione o produto Instagram Graph API.", url: "https://developers.facebook.com" },
      { label: "Gere um token de acesso", detail: "No painel do App: Ferramentas → Gerador de Token de Acesso → selecione sua Página → copie o token de longa duração (60 dias)." },
      { label: "Obtenha o Instagram Account ID", detail: "Faça GET https://graph.facebook.com/me/accounts com seu token → copie o id da página vinculada ao Instagram." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → Instagram → Colar token + Account ID → Conectar" },
    ],
  },
  tiktok: {
    name: "TikTok Business",
    icon: "🎵",
    why: "Auto-post de vídeos curtos e TikTok Ads com conteúdo gerado pelo NexOS AI",
    steps: [
      { label: "Acesse o TikTok for Business", detail: "business.tiktok.com → crie uma conta Business ou entre na existente", url: "https://business.tiktok.com" },
      { label: "Crie um App no TikTok Developers", detail: "developers.tiktok.com → Meus Apps → Criar App → tipo: Web. Habilite Content Posting API.", url: "https://developers.tiktok.com" },
      { label: "Configure as permissões", detail: "No App: Produtos → Content Posting API → solicite acesso. Adicione o escopo video.publish." },
      { label: "Gere as credenciais OAuth", detail: "Client Key e Client Secret ficam em Gerenciar Apps → seu app → Chaves e Credenciais." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → TikTok Business → Colar Client Key + Secret → Autorizar" },
    ],
  },
};

const WIZARD_TRANSLATIONS: Record<string, [string, string]> = {
  "Disparar mensagens para leads, sequências e notificações de abertura do carrinho": ["Send messages to leads, sequences, and cart-opening notifications", "Enviar mensajes a prospectos, secuencias y notificaciones de apertura del carrito"],
  "Acesse o Meta Business Manager": ["Open Meta Business Manager", "Abre Meta Business Manager"],
  "Vá em business.facebook.com → Configurações → WhatsApp": ["Go to business.facebook.com → Settings → WhatsApp", "Ve a business.facebook.com → Configuración → WhatsApp"],
  "Adicione seu número de telefone": ["Add your phone number", "Añade tu número de teléfono"],
  "Menu WhatsApp → Números de Telefone → Adicionar número. Verifique via SMS ou ligação.": ["WhatsApp menu → Phone Numbers → Add Number. Verify by SMS or phone call.", "Menú WhatsApp → Números de teléfono → Añadir número. Verifica por SMS o llamada."],
  "Crie um App na Meta for Developers": ["Create an app in Meta for Developers", "Crea una aplicación en Meta for Developers"],
  "developers.facebook.com → Meus Apps → Criar App → Negócios. Adicione o produto WhatsApp Business.": ["developers.facebook.com → My Apps → Create App → Business. Add the WhatsApp Business product.", "developers.facebook.com → Mis aplicaciones → Crear aplicación → Negocios. Añade el producto WhatsApp Business."],
  "Obtenha as credenciais": ["Get the credentials", "Obtén las credenciales"],
  "No painel do App: copie o Phone Number ID e o Token de Acesso Permanente (começa com EAAB...)": ["In the app dashboard: copy the Phone Number ID and Permanent Access Token (starts with EAAB...)", "En el panel de la aplicación: copia el Phone Number ID y el token de acceso permanente (empieza con EAAB...)"],
  "Cole aqui no NexOS AI": ["Paste them into NexOS AI", "Pégalos en NexOS AI"],
  "Configurações → Integrações → WhatsApp Business → Colar credenciais → Conectar": ["Settings → Integrations → WhatsApp Business → Paste credentials → Connect", "Configuración → Integraciones → WhatsApp Business → Pegar credenciales → Conectar"],
  "Alternativa ao WhatsApp para disparo de mensagens em grupos e canais de leads": ["An alternative to WhatsApp for sending messages to lead groups and channels", "Una alternativa a WhatsApp para enviar mensajes a grupos y canales de prospectos"],
  "Abra o Telegram e procure @BotFather": ["Open Telegram and search for @BotFather", "Abre Telegram y busca @BotFather"],
  "Pesquise @BotFather na barra de busca do Telegram": ["Search for @BotFather in Telegram's search bar", "Busca @BotFather en la barra de búsqueda de Telegram"],
  "Crie um bot novo": ["Create a new bot", "Crea un bot nuevo"],
  "Envie /newbot → escolha nome → escolha username (deve terminar em 'bot')": ["Send /newbot → choose a name → choose a username (must end in 'bot')", "Envía /newbot → elige un nombre → elige un nombre de usuario (debe terminar en 'bot')"],
  "Copie o token gerado": ["Copy the generated token", "Copia el token generado"],
  "O BotFather responde com token no formato 1234567890:ABCdef...": ["BotFather replies with a token in the format 1234567890:ABCdef...", "BotFather responde con un token con el formato 1234567890:ABCdef..."],
  "Cole o token no NexOS AI": ["Paste the token into NexOS AI", "Pega el token en NexOS AI"],
  "Configurações → Integrações → Telegram → Colar token → Conectar": ["Settings → Integrations → Telegram → Paste token → Connect", "Configuración → Integraciones → Telegram → Pegar token → Conectar"],
  "Criar e disparar fluxos de email para leads capturados durante o lançamento": ["Create and send email flows to leads captured during the launch", "Crear y enviar flujos de correo a los prospectos captados durante el lanzamiento"],
  "Acesse o RD Station": ["Open RD Station", "Abre RD Station"],
  "app.rdstation.com → crie sua conta (tem plano gratuito)": ["app.rdstation.com → create your account (a free plan is available)", "app.rdstation.com → crea tu cuenta (hay un plan gratuito)"],
  "Gere uma chave de API": ["Generate an API key", "Genera una clave de API"],
  "Menu → Configurações → Integrações → API → Gerar nova chave de API": ["Menu → Settings → Integrations → API → Generate new API key", "Menú → Configuración → Integraciones → API → Generar nueva clave de API"],
  "Copie a chave gerada": ["Copy the generated key", "Copia la clave generada"],
  "A chave tem formato longo de letras e números. Copie ela completa.": ["The key is a long string of letters and numbers. Copy it in full.", "La clave es una cadena larga de letras y números. Cópiala completa."],
  "Cole no NexOS AI": ["Paste it into NexOS AI", "Pégala en NexOS AI"],
  "Configurações → Integrações → RD Station → Colar chave → Conectar": ["Settings → Integrations → RD Station → Paste key → Connect", "Configuración → Integraciones → RD Station → Pegar clave → Conectar"],
  "Automação de email marketing e segmentação de leads durante o lançamento": ["Email marketing automation and lead segmentation during the launch", "Automatización de email marketing y segmentación de prospectos durante el lanzamiento"],
  "Acesse o ActiveCampaign": ["Open ActiveCampaign", "Abre ActiveCampaign"],
  "activecampaign.com → crie ou entre na sua conta": ["activecampaign.com → create or sign in to your account", "activecampaign.com → crea una cuenta o inicia sesión"],
  "Encontre suas credenciais de API": ["Find your API credentials", "Encuentra tus credenciales de API"],
  "Ícone do usuário → Minha Conta → Developer → URL da API e Chave de API": ["User icon → My Account → Developer → API URL and API Key", "Icono de usuario → Mi cuenta → Developer → URL y clave de API"],
  "Copie a URL e a chave": ["Copy the URL and key", "Copia la URL y la clave"],
  "URL: https://sua-conta.api-us1.com. Chave: sequência longa. Copie ambas.": ["URL: https://your-account.api-us1.com. Key: a long string. Copy both.", "URL: https://tu-cuenta.api-us1.com. Clave: una cadena larga. Copia ambas."],
  "Configurações → Integrações → ActiveCampaign → Colar URL e chave → Conectar": ["Settings → Integrations → ActiveCampaign → Paste URL and key → Connect", "Configuración → Integraciones → ActiveCampaign → Pegar URL y clave → Conectar"],
  "Auto-post de conteúdo orgânico, Stories e Reels gerados pelo NexOS AI durante o lançamento": ["Automatically publish organic content, Stories, and Reels generated by NexOS AI during the launch", "Publicación automática de contenido orgánico, Stories y Reels generados por NexOS AI durante el lanzamiento"],
  "Acesse o Meta Business Suite": ["Open Meta Business Suite", "Abre Meta Business Suite"],
  "business.facebook.com → certifique-se que sua Página do Instagram está vinculada à conta Business": ["business.facebook.com → make sure your Instagram Page is linked to your Business account", "business.facebook.com → asegúrate de que tu página de Instagram esté vinculada a tu cuenta Business"],
  "developers.facebook.com → Meus Apps → Criar App → Tipo: Negócios. Adicione o produto Instagram Graph API.": ["developers.facebook.com → My Apps → Create App → Type: Business. Add the Instagram Graph API product.", "developers.facebook.com → Mis aplicaciones → Crear aplicación → Tipo: Negocios. Añade el producto Instagram Graph API."],
  "Gere um token de acesso": ["Generate an access token", "Genera un token de acceso"],
  "No painel do App: Ferramentas → Gerador de Token de Acesso → selecione sua Página → copie o token de longa duração (60 dias).": ["In the app dashboard: Tools → Access Token Generator → select your Page → copy the long-lived token (60 days).", "En el panel de la aplicación: Herramientas → Generador de tokens de acceso → selecciona tu página → copia el token de larga duración (60 días)."],
  "Obtenha o Instagram Account ID": ["Get the Instagram Account ID", "Obtén el Instagram Account ID"],
  "Faça GET https://graph.facebook.com/me/accounts com seu token → copie o id da página vinculada ao Instagram.": ["Send GET https://graph.facebook.com/me/accounts with your token → copy the ID of the Page linked to Instagram.", "Haz GET https://graph.facebook.com/me/accounts con tu token → copia el ID de la página vinculada a Instagram."],
  "Configurações → Integrações → Instagram → Colar token + Account ID → Conectar": ["Settings → Integrations → Instagram → Paste token + Account ID → Connect", "Configuración → Integraciones → Instagram → Pegar token + Account ID → Conectar"],
  "Auto-post de vídeos curtos e TikTok Ads com conteúdo gerado pelo NexOS AI": ["Automatically publish short videos and TikTok Ads using content generated by NexOS AI", "Publicación automática de vídeos cortos y anuncios de TikTok con contenido generado por NexOS AI"],
  "Acesse o TikTok for Business": ["Open TikTok for Business", "Abre TikTok for Business"],
  "business.tiktok.com → crie uma conta Business ou entre na existente": ["business.tiktok.com → create a Business account or sign in to an existing one", "business.tiktok.com → crea una cuenta Business o inicia sesión en una existente"],
  "Crie um App no TikTok Developers": ["Create an app in TikTok Developers", "Crea una aplicación en TikTok Developers"],
  "developers.tiktok.com → Meus Apps → Criar App → tipo: Web. Habilite Content Posting API.": ["developers.tiktok.com → My Apps → Create App → type: Web. Enable Content Posting API.", "developers.tiktok.com → Mis aplicaciones → Crear aplicación → tipo: Web. Activa Content Posting API."],
  "Configure as permissões": ["Configure permissions", "Configura los permisos"],
  "No App: Produtos → Content Posting API → solicite acesso. Adicione o escopo video.publish.": ["In the app: Products → Content Posting API → request access. Add the video.publish scope.", "En la aplicación: Productos → Content Posting API → solicita acceso. Añade el permiso video.publish."],
  "Gere as credenciais OAuth": ["Generate OAuth credentials", "Genera las credenciales OAuth"],
  "Client Key e Client Secret ficam em Gerenciar Apps → seu app → Chaves e Credenciais.": ["Find the Client Key and Client Secret in Manage Apps → your app → Keys and Credentials.", "Encuentra Client Key y Client Secret en Administrar aplicaciones → tu aplicación → Claves y credenciales."],
  "Configurações → Integrações → TikTok Business → Colar Client Key + Secret → Autorizar": ["Settings → Integrations → TikTok Business → Paste Client Key + Secret → Authorize", "Configuración → Integraciones → TikTok Business → Pegar Client Key + Secret → Autorizar"],
};

// ─── Content piece labels ──────────────────────────────────────────────────────

const PIECE_TYPE_LABELS: Record<string, string> = {
  vsl_script:         "Script VSL",
  cpl_script:         "Script CPL",
  email_sequence:     "Sequência de Email",
  ad_copy:            "Copy de Anúncio",
  social_post:        "Post para Redes Sociais",
  webinar_script:     "Script de Webinar",
  content_calendar:   "Calendário de Conteúdo",
  targeting_config:   "Configuração de Segmentação",
  media_buying_plan:  "Plano de Mídia",
  whatsapp_message:   "Mensagem WhatsApp",
  landing_page_copy:  "Copy de Landing Page",
  sales_letter:       "Carta de Vendas",
  video_script:       "Script de Vídeo",
  story_sequence:     "Sequência de Stories",
  launch_sequence:    "Sequência de Lançamento",
};

const PIECE_STATUS_META: Record<string, { label: string; color: string }> = {
  approved:  { label: "Aprovado",         color: "text-green-400 border-green-400/30 bg-green-400/8" },
  pending:   { label: "Aguardando",       color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8" },
  rejected:  { label: "Rejeitado",        color: "text-red-400 border-red-400/30 bg-red-400/8" },
  generated: { label: "Gerado — revisar", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8" },
  draft:     { label: "Rascunho",         color: "text-muted-foreground border-border/30 bg-muted/10" },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Integration { id: string; provider: string; status: string; }

interface ContentPiece {
  id: string; type: string; status: string;
  platform?: string; title?: string;
}

interface CreativePiece { id: string; status: string; format?: string; }
interface VideoProjectLite { id: string; title: string; status: string; }
interface VslLite { id: string; title: string; sections: unknown[]; campaignId?: string | null; }

interface ScenarioValues { low: number; mid: number; high: number; }

interface PlatformSim {
  platform: string; label: string; icon: string; color: string;
  budgetAllocation: number; budgetPct: number;
  leads: ScenarioValues; cpl: ScenarioValues; roas: ScenarioValues;
}

interface LaunchFinancials {
  hasBudget: boolean;
  totalBudget: number;
  paidTrafficBudget: number;
  prospectingBudget: number;
  retargetingBudget: number;
  retargetingPct: number;
  productPrice: number;
  campaignType: string;
  productCategory: string;
  revenueTarget: number | null;
  organicLeads: ScenarioValues;
  totalLeads: ScenarioValues;
  simulation: {
    totalLeads: ScenarioValues;
    totalRevenue: ScenarioValues;
    totalRoas: ScenarioValues;
    totalRoi: ScenarioValues;
    breakEvenSales: number;
    platforms: PlatformSim[];
    benchmarkNote: string;
  } | null;
}

interface Props {
  campaignId: string;
  onLaunchReady: (ready: boolean) => void;
  onLaunch: () => void;
  launching: boolean;
  /** Channels planned by the strategy agent (e.g. ["instagram","tiktok","facebook"]).
   *  If not provided, defaults to requiring Instagram + TikTok. */
  plannedChannels?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const R$ = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `R$ ${(n / 1_000).toFixed(0)}k`
    : `R$ ${n.toFixed(0)}`;

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Channel → provider(s) mapping for Gate 5 ─────────────────────────────────
const CHANNEL_TO_PROVIDERS: Record<string, string[]> = {
  instagram:  ["instagram"],
  tiktok:     ["tiktok_ads", "meta_ads"],
  facebook:   ["meta_ads"],
  // whatsapp/email are covered by Gates 1+2; no separate Gate 5 provider needed
};
const DEFAULT_SOCIAL_CHANNELS = ["instagram", "tiktok"];

export function PreLaunchChecklist({ campaignId, onLaunchReady, onLaunch, launching, plannedChannels }: Props) {
  const t = useUiText();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [content, setContent]           = useState<ContentPiece[]>([]);
  const [financials, setFinancials]     = useState<LaunchFinancials | null>(null);
  const [creatives, setCreatives]       = useState<CreativePiece[]>([]);
  const [videoProjects, setVideoProjects] = useState<VideoProjectLite[]>([]);
  const [vsls, setVsls]                 = useState<VslLite[]>([]);
  const [loading, setLoading]           = useState(true);

  // Wizard / expand state
  const [expandedWizard, setExpandedWizard]   = useState<string | null>(null);
  const [expandedStep, setExpandedStep]       = useState<number | null>(null);
  const [contentExpanded, setContentExpanded] = useState(true);
  const [finExpanded, setFinExpanded]         = useState(true);
  const [finConfirmed, setFinConfirmed]       = useState(false);
  const [socialExpanded, setSocialExpanded]   = useState(true);
  const [oauthLoading, setOauthLoading]       = useState<string | null>(null);
  const [oauthError, setOauthError]           = useState<string | null>(null);
  const [funnelExpanded, setFunnelExpanded]   = useState(true);
  const [entregaveisExpanded, setEntregaveisExpanded] = useState(true);
  const [deliverablesConfirmed, setDeliverablesConfirmed] = useState(false);

  // Gate 6 — landing page URL (persisted per campaign in localStorage)
  const funnelKey = `nexos_funnel_url_${campaignId}`;
  const [landingUrl, setLandingUrl] = useState<string>(() => {
    try { return localStorage.getItem(funnelKey) ?? ""; } catch { return ""; }
  });
  const [landingUrlInput, setLandingUrlInput] = useState(landingUrl);
  const funnelConfirmed = landingUrl.startsWith("http");

  // Gate 3 animated verification (cosmetic multi-step review)
  // 0 = pending/loading, 1 = counting pieces ✓, 2 = checking compliance ✓, 3 = validating schedule ✓
  const [verifyPhase, setVerifyPhase]         = useState(0);
  const verifyStarted                         = useRef(false);

  // ── Pre-launch scan animation (plays once per campaign) ───────────────────
  const scanKey = `nexos_plscan_${campaignId}`;
  const [scanDone, setScanDone] = useState(() => { try { return !!localStorage.getItem(scanKey); } catch { return false; } });
  const [revealedGates, setRevealedGates] = useState(0);

  // ── Interactive budget slider state ──────────────────────────────────────
  const [localBudget, setLocalBudget]           = useState<number>(0);
  const [localRetargetPct, setLocalRetargetPct] = useState<number>(25);

  useEffect(() => {
    Promise.all([
      customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] })),
      customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] })),
      customFetch<{ financials: LaunchFinancials }>(`/api/campaigns/${campaignId}/launch-financials`).catch(() => ({ financials: null })),
      customFetch<{ creatives: CreativePiece[] }>(`/api/campaigns/${campaignId}/creatives`).catch(() => ({ creatives: [] })),
      customFetch<{ projects: VideoProjectLite[] }>(`/api/video-projects?campaignId=${campaignId}`).catch(() => ({ projects: [] })),
      customFetch<{ vsls: VslLite[] }>(`/api/vsls?campaignId=${campaignId}`).catch(() => ({ vsls: [] as VslLite[] })),
    ]).then(([intRes, contRes, finRes, creaRes, vidRes, vslRes]) => {
      setIntegrations(intRes.integrations ?? []);
      setContent(contRes.pieces ?? []);
      const fin = finRes.financials ?? null;
      setFinancials(fin);
      setLocalBudget(fin?.paidTrafficBudget ?? 5000);
      setLocalRetargetPct(fin?.retargetingPct ?? 25);
      setCreatives(creaRes.creatives ?? []);
      setVideoProjects(vidRes.projects ?? []);
      setVsls((vslRes.vsls ?? []).filter(v => v.campaignId === campaignId));
      setLoading(false);
    });
  }, [campaignId]);

  // ── Proportional scaling from original simulation ─────────────────────────
  const scaled = useMemo(() => {
    if (!financials?.simulation || !financials.hasBudget) return null;
    const origProspecting = financials.prospectingBudget || 1;
    const newProspecting  = Math.round(localBudget * (1 - localRetargetPct / 100));
    const newRetargeting  = localBudget - newProspecting;
    const k               = newProspecting / origProspecting; // scale factor

    const scaleVal = (v: ScenarioValues): ScenarioValues => ({
      low:  Math.round(v.low  * k),
      mid:  Math.round(v.mid  * k),
      high: Math.round(v.high * k),
    });

    const totalRevenue = scaleVal(financials.simulation.totalRevenue);
    const totalLeads   = scaleVal(financials.simulation.totalLeads);

    const totalRoas: ScenarioValues = {
      low:  localBudget > 0 ? Math.round((totalRevenue.low  / localBudget) * 100) / 100 : 0,
      mid:  localBudget > 0 ? Math.round((totalRevenue.mid  / localBudget) * 100) / 100 : 0,
      high: localBudget > 0 ? Math.round((totalRevenue.high / localBudget) * 100) / 100 : 0,
    };
    const totalRoi: ScenarioValues = {
      low:  localBudget > 0 ? Math.round(((totalRevenue.low  - localBudget) / localBudget) * 100) : 0,
      mid:  localBudget > 0 ? Math.round(((totalRevenue.mid  - localBudget) / localBudget) * 100) : 0,
      high: localBudget > 0 ? Math.round(((totalRevenue.high - localBudget) / localBudget) * 100) : 0,
    };
    const organicLeads = scaleVal(financials.organicLeads);
    const totalLeadsWithOrganic: ScenarioValues = {
      low:  totalLeads.low  + organicLeads.low,
      mid:  totalLeads.mid  + organicLeads.mid,
      high: totalLeads.high + organicLeads.high,
    };
    const breakEvenSales = financials.simulation.breakEvenSales;

    const platforms: PlatformSim[] = (financials.simulation.platforms ?? []).map(p => ({
      ...p,
      budgetAllocation: Math.round(p.budgetAllocation * k),
      leads: scaleVal(p.leads),
    }));

    return {
      prospecting: newProspecting,
      retargeting: newRetargeting,
      totalLeads: totalLeadsWithOrganic,
      paidLeads: totalLeads,
      organicLeads,
      totalRevenue,
      totalRoas,
      totalRoi,
      breakEvenSales,
      platforms,
    };
  }, [financials, localBudget, localRetargetPct]);

  // ── Integration checks ──────────────────────────────────────────────────────
  const isConnected   = (providers: string[]) => integrations.some(i => providers.includes(i.provider) && i.status === "connected");
  const hasMessaging  = isConnected(["whatsapp_business", "telegram"]);
  const hasEmail      = isConnected(["rd_station", "activecampaign"]);

  // Gate 5: Dynamic — ALL channels from the strategy plan must be connected.
  // Defaults to Instagram + TikTok when no strategy plan is available yet.
  const _socialChannels = (plannedChannels ?? DEFAULT_SOCIAL_CHANNELS)
    .map((c) => c.toLowerCase())
    .filter((c) => Object.keys(CHANNEL_TO_PROVIDERS).includes(c));
  const channelStatus = _socialChannels.map((ch) => ({
    key: ch,
    label: ch === "instagram" ? "Instagram" : ch === "tiktok" ? "TikTok" : ch === "facebook" ? "Facebook" : ch.charAt(0).toUpperCase() + ch.slice(1),
    providers: CHANNEL_TO_PROVIDERS[ch] ?? [],
    connected: isConnected(CHANNEL_TO_PROVIDERS[ch] ?? []),
  }));
  const hasSocial     = channelStatus.length > 0 && channelStatus.every(c => c.connected);
  const connectedSocials = channelStatus.filter(c => c.connected).map(c => c.label).join(" + ");
  const missingSocialLabels = channelStatus.filter(c => !c.connected).map(c => c.label);
  // Backward-compat refs for per-platform UI rows
  const hasInstagram  = channelStatus.find(c => c.key === "instagram")?.connected ?? false;
  const hasTikTok     = channelStatus.find(c => c.key === "tiktok")?.connected ?? false;
  const instagramConn = integrations.find(i => i.provider === "instagram" && i.status === "connected");
  const tiktokConn    = integrations.find(i => (i.provider === "tiktok_ads" || i.provider === "meta_ads") && i.status === "connected");
  const whatsappConn  = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
  const rdConn        = integrations.find(i => i.provider === "rd_station" && i.status === "connected");
  const missingMsg    = !isConnected(["whatsapp_business"]) ? "whatsapp" as const : "telegram" as const;
  const missingEmail  = !isConnected(["rd_station"]) ? "rd_station" as const : "activecampaign" as const;
  const missingSocial = !hasInstagram ? "instagram" as const : "tiktok" as const;

  // ── Content checks ──────────────────────────────────────────────────────────
  const allPieces         = content;
  const approvedCount     = allPieces.filter(p => p.status === "approved").length;
  const pendingPieces     = allPieces.filter(p => p.status !== "approved");
  const allContentApproved = allPieces.length > 0 && pendingPieces.length === 0;
  const noContent         = allPieces.length === 0;

  // ── Entregáveis (imagens/vídeos) checks — Gate "Produzir Entregáveis" ──────
  const totalCreatives        = creatives.length;
  const approvedCreativesCnt  = creatives.filter(c => c.status === "approved" || c.status === "final_approved").length;
  const pendingCreativesCnt   = totalCreatives - approvedCreativesCnt;
  const creativesAllApproved  = totalCreatives > 0 && pendingCreativesCnt === 0;
  const vslsWithScript        = vsls.filter(v => (v.sections ?? []).length > 0);
  const vslsWithoutVideo      = vslsWithScript.filter(v => !videoProjects.some(vp => vp.title.includes(v.title.slice(0, 15))));
  const completedVideosCnt    = videoProjects.filter(v => v.status === "completed").length;
  const hasNoDeliverableWork  = totalCreatives === 0 && videoProjects.length === 0;
  const deliverablesReady     = creativesAllApproved || (hasNoDeliverableWork ? deliverablesConfirmed : deliverablesConfirmed && pendingCreativesCnt === 0);

  // ── Scan animation effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading || scanDone) return;
    const t1 = setTimeout(() => setRevealedGates(1), 600);
    const t2 = setTimeout(() => setRevealedGates(2), 1200);
    const t3 = setTimeout(() => setRevealedGates(3), 1800);
    const t4 = setTimeout(() => setRevealedGates(4), 2400);
    const t5 = setTimeout(() => setRevealedGates(5), 3000);
    const t6 = setTimeout(() => setRevealedGates(6), 3600);
    const t7 = setTimeout(() => {
      setScanDone(true);
      try { localStorage.setItem(scanKey, "1"); } catch {}
    }, 4400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); clearTimeout(t7); };
  }, [loading, scanDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gate 3 animated verification — triggers once when allContentApproved ──
  useEffect(() => {
    if (loading || !allContentApproved || verifyStarted.current) return;
    verifyStarted.current = true;
    setVerifyPhase(0);
    const t1 = setTimeout(() => setVerifyPhase(1), 700);
    const t2 = setTimeout(() => setVerifyPhase(2), 1500);
    const t3 = setTimeout(() => setVerifyPhase(3), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading, allContentApproved]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Financials check ────────────────────────────────────────────────────────
  const finReady = finConfirmed;

  // ── Overall gate ────────────────────────────────────────────────────────────
  // Gate 3 verification must complete (animation phase 3) before launch is allowed
  const contentVerified = allContentApproved && verifyPhase >= 3;
  const allReady = hasMessaging && hasEmail && hasSocial && contentVerified && deliverablesReady && funnelConfirmed && finReady;

  useEffect(() => {
    if (!loading) onLaunchReady(allReady);
  }, [loading, allReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="border border-border/30 p-6 flex items-center justify-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-mono text-sm text-muted-foreground">{t("Verificando pré-requisitos de lançamento...", "Checking launch prerequisites...", "Verificando requisitos previos del lanzamiento...")}</span>
      </div>
    );
  }

  // ── Scan animation overlay (shown once per campaign) ─────────────────────────
  if (!scanDone) {
    const completeScanNow = () => {
      setScanDone(true);
      try { localStorage.setItem(scanKey, "1"); } catch {}
    };
    const SCAN_GATES = [
      {
        label: t("Canal de Mensagens", "Messaging Channel", "Canal de mensajes"),
        icon: <MessageCircle className="h-4 w-4" />,
        passed: hasMessaging,
        passMsg: whatsappConn ? t("WhatsApp Business conectado", "WhatsApp Business connected", "WhatsApp Business conectado") : t("Telegram conectado", "Telegram connected", "Telegram conectado"),
        failMsg: t("WhatsApp Business ou Telegram obrigatório — vá em Integrações → Mensagens", "WhatsApp Business or Telegram is required — go to Integrations → Messaging", "Se requiere WhatsApp Business o Telegram — ve a Integraciones → Mensajes"),
      },
      {
        label: t("Plataforma de Email", "Email Platform", "Plataforma de correo"),
        icon: <Mail className="h-4 w-4" />,
        passed: hasEmail,
        passMsg: rdConn ? t("RD Station conectado", "RD Station connected", "RD Station conectado") : t("ActiveCampaign conectado", "ActiveCampaign connected", "ActiveCampaign conectado"),
        failMsg: t("RD Station ou ActiveCampaign obrigatório — vá em Integrações → Email", "RD Station or ActiveCampaign is required — go to Integrations → Email", "Se requiere RD Station o ActiveCampaign — ve a Integraciones → Correo"),
      },
      {
        label: t("Redes Sociais", "Social Networks", "Redes sociales"),
        icon: <Users className="h-4 w-4" />,
        passed: hasSocial,
        passMsg: t(`Conectado: ${connectedSocials} — auto-post ativo`, `Connected: ${connectedSocials} — auto-post active`, `Conectadas: ${connectedSocials} — publicación automática activa`),
        failMsg: t("Conecte Instagram ou TikTok para distribuição automática do conteúdo gerado", "Connect Instagram or TikTok to automatically distribute generated content", "Conecta Instagram o TikTok para distribuir automáticamente el contenido generado"),
      },
      {
        label: t("Aprovação de Conteúdo", "Content Approval", "Aprobación de contenido"),
        icon: <FileText className="h-4 w-4" />,
        passed: allContentApproved,
        passMsg: t(`${approvedCount} peça${approvedCount !== 1 ? "s" : ""} aprovada${approvedCount !== 1 ? "s" : ""}`, `${approvedCount} creative${approvedCount !== 1 ? "s" : ""} approved`, `${approvedCount} pieza${approvedCount !== 1 ? "s" : ""} aprobada${approvedCount !== 1 ? "s" : ""}`),
        failMsg: noContent
          ? t("Nenhuma peça gerada — gere o conteúdo antes de lançar", "No content generated — create content before launching", "No se generó contenido — créalo antes de lanzar")
          : t(`${pendingPieces.length} peça${pendingPieces.length !== 1 ? "s" : ""} aguardando revisão — abra a aba Conteúdo`, `${pendingPieces.length} item${pendingPieces.length !== 1 ? "s" : ""} awaiting review — open the Content tab`, `${pendingPieces.length} pieza${pendingPieces.length !== 1 ? "s" : ""} pendiente${pendingPieces.length !== 1 ? "s" : ""} de revisión — abre la pestaña Contenido`),
      },
      {
        label: t("Produzir Entregáveis", "Produce Deliverables", "Producir entregables"),
        icon: <Image className="h-4 w-4" />,
        passed: deliverablesReady,
        passMsg: creativesAllApproved
          ? t(`${approvedCreativesCnt} criativo${approvedCreativesCnt !== 1 ? "s" : ""} aprovado${approvedCreativesCnt !== 1 ? "s" : ""}${completedVideosCnt > 0 ? ` + ${completedVideosCnt} vídeo${completedVideosCnt !== 1 ? "s" : ""} concluído${completedVideosCnt !== 1 ? "s" : ""}` : ""}`, `${approvedCreativesCnt} creative${approvedCreativesCnt !== 1 ? "s" : ""} approved${completedVideosCnt > 0 ? ` + ${completedVideosCnt} video${completedVideosCnt !== 1 ? "s" : ""} completed` : ""}`, `${approvedCreativesCnt} creatividad${approvedCreativesCnt !== 1 ? "es aprobadas" : " aprobada"}${completedVideosCnt > 0 ? ` + ${completedVideosCnt} vídeo${completedVideosCnt !== 1 ? "s" : ""} completado${completedVideosCnt !== 1 ? "s" : ""}` : ""}`)
          : t("Confirmado manualmente — sem entregáveis visuais necessários", "Manually confirmed — no visual deliverables needed", "Confirmado manualmente — no se necesitan recursos visuales"),
        failMsg: hasNoDeliverableWork
          ? t("Nenhuma imagem ou vídeo gerado ainda — produza os entregáveis ou confirme que não são necessários", "No images or videos generated yet — create deliverables or confirm they are not needed", "Aún no hay imágenes ni videos — produce los recursos o confirma que no son necesarios")
          : t(`${pendingCreativesCnt} criativo${pendingCreativesCnt !== 1 ? "s" : ""} aguardando aprovação final`, `${pendingCreativesCnt} creative${pendingCreativesCnt !== 1 ? "s" : ""} awaiting final approval`, `${pendingCreativesCnt} creatividad${pendingCreativesCnt !== 1 ? "es" : ""} pendiente${pendingCreativesCnt !== 1 ? "s" : ""} de aprobación final`),
      },
      {
        label: t("Funil & Landing Page", "Funnel & Landing Page", "Embudo y página de aterrizaje"),
        icon: <TrendingUp className="h-4 w-4" />,
        passed: funnelConfirmed,
        passMsg: t("Landing page e checkout confirmados como publicados", "Landing page and checkout confirmed as published", "Página de aterrizaje y checkout confirmados como publicados"),
        failMsg: t("Confirme que sua landing page está publicada e checkout ativo antes de lançar", "Confirm your landing page is published and checkout is active before launching", "Confirma que tu página de aterrizaje está publicada y el checkout activo antes de lanzar"),
      },
      {
        label: t("Plano Financeiro", "Financial Plan", "Plan financiero"),
        icon: <DollarSign className="h-4 w-4" />,
        passed: finReady,
        passMsg: t("Plano revisado e confirmado", "Plan reviewed and confirmed", "Plan revisado y confirmado"),
        failMsg: t("Revise e confirme o plano financeiro abaixo antes de lançar", "Review and confirm the financial plan below before launching", "Revisa y confirma el plan financiero antes de lanzar"),
      },
    ] as const;

    const allPassed = SCAN_GATES.every(g => g.passed);

    return (
      <div className="border border-primary/30 bg-card/20 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-3">
          <div className="relative w-4 h-4 shrink-0">
            {revealedGates < 4
              ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
              : allPassed
                ? <ShieldCheck className="h-4 w-4 text-green-400" />
                : <ShieldCheck className="h-4 w-4 text-yellow-400" />}
          </div>
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">{t("Auditoria de Pré-Lançamento", "Pre-Launch Audit", "Auditoría Previa al Lanzamiento")}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {revealedGates < 4 ? t(`Verificando ${revealedGates + 1} de 4...`, `Checking ${revealedGates + 1} of 4...`, `Verificando ${revealedGates + 1} de 4...`) : t("Auditoria concluída", "Audit complete", "Auditoría completada")}
            </div>
          </div>
        </div>

        {/* Scan gates */}
        <div className="divide-y divide-border/15">
          {SCAN_GATES.map((gate, i) => {
            const isRevealed = revealedGates > i;
            const isScanning = revealedGates === i;
            return (
              <div
                key={gate.label}
                className={`flex items-start gap-3 px-5 py-4 transition-all duration-700 ${
                  isRevealed || isScanning ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {!isRevealed
                    ? <Loader2 className="h-4 w-4 text-primary/50 animate-spin" />
                    : gate.passed
                      ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                      : <XCircle className="h-4 w-4 text-red-400" />}
                </div>

                {/* Gate icon */}
                <div className={`shrink-0 mt-0.5 transition-colors ${
                  !isRevealed ? "text-muted-foreground/20"
                  : gate.passed ? "text-green-400/60"
                  : "text-red-400/60"
                }`}>
                  {gate.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-xs font-bold transition-colors ${
                    !isRevealed ? "text-muted-foreground/30"
                    : gate.passed ? "text-green-300"
                    : "text-red-300"
                  }`}>
                    {!isRevealed ? "Verificando..." : gate.label}
                  </div>
                  {isRevealed && (
                    <div className={`font-mono text-[10px] mt-0.5 leading-relaxed ${
                      gate.passed ? "text-green-400/60" : "text-red-400/70"
                    }`}>
                      {gate.passed ? gate.passMsg : gate.failMsg}
                    </div>
                  )}
                </div>

                {/* Scanning bar */}
                {isScanning && (
                  <div className="shrink-0 mt-1">
                    <div className="w-16 h-0.5 bg-border/30 overflow-hidden">
                      <div className="h-full bg-primary animate-pulse w-full" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: skip or wait */}
        <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between">
          {revealedGates < 6 ? (
            <button
              onClick={completeScanNow}
              className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 uppercase tracking-widest transition-colors"
            >
              {t("Pular animação", "Skip animation", "Omitir animación")}
            </button>
          ) : (
            <div className={`font-mono text-[10px] uppercase tracking-widest font-bold ${allPassed ? "text-green-400" : "text-yellow-400"}`}>
              {allPassed ? t("✓ Todos os gates aprovados", "✓ All checks approved", "✓ Todas las verificaciones aprobadas") : t(`${SCAN_GATES.filter(g => !g.passed).length} pendente${SCAN_GATES.filter(g => !g.passed).length !== 1 ? "s" : ""}`, `${SCAN_GATES.filter(g => !g.passed).length} pending`, `${SCAN_GATES.filter(g => !g.passed).length} pendiente${SCAN_GATES.filter(g => !g.passed).length !== 1 ? "s" : ""}`)}
            </div>
          )}
          {revealedGates >= 6 && (
            <Button
              onClick={completeScanNow}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 btn-weapon-primary"
            >
              {allPassed ? t("Ver Checklist Completo", "View Full Checklist", "Ver lista completa") : t("Resolver Pendências", "Resolve Pending Items", "Resolver pendientes")}
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── OAuth popup helper ───────────────────────────────────────────────────────
  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    setOauthError(null);
    try {
      const body = await customFetch<{ url: string }>(`/api/integrations/oauth/start/${provider}`);
      const popup = window.open(body.url, "nexos_oauth", "width=620,height=700,scrollbars=yes,resizable=yes");
      if (!popup) {
        setOauthError(t("Popup bloqueado pelo navegador. Permita pop-ups para este site e tente novamente.", "Popup blocked by your browser. Allow pop-ups for this site and try again.", "El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo."));
        setOauthLoading(null);
        return;
      }
      const handler = (event: MessageEvent<{ type?: string; success?: boolean; error?: string }>) => {
        if (event.data?.type !== "oauth_complete") return;
        window.removeEventListener("message", handler);
        setOauthLoading(null);
        if (event.data.success) {
          // Reload integrations to reflect new connection
          Promise.all([
            customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] })),
          ]).then(([intRes]) => setIntegrations(intRes.integrations ?? []));
        } else {
          setOauthError(event.data.error ?? t("Falha na autenticação.", "Authentication failed.", "Error de autenticación."));
        }
      };
      window.addEventListener("message", handler);
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handler);
          setOauthLoading(null);
        }
      }, 600);
    } catch {
      setOauthLoading(null);
      setOauthError(t("Erro ao iniciar a autenticação. Verifique sua conexão e tente novamente.", "Error starting authentication. Check your connection and try again.", "Error al iniciar la autenticación. Comprueba tu conexión e inténtalo de nuevo."));
    }
  };

  const passedGates = (hasMessaging ? 1 : 0) + (hasEmail ? 1 : 0) + (hasSocial ? 1 : 0) + (contentVerified ? 1 : 0) + (funnelConfirmed ? 1 : 0) + (finReady ? 1 : 0);
  const failedGates = 6 - passedGates;

  return (
    <div className="border border-primary/30 bg-card/20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">{t("Controladoria de Lançamento", "Launch Control", "Control de Lanzamiento")}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {allReady
                ? t("Todos os gates aprovados — lançamento liberado", "All gates approved — launch cleared", "Todas las verificaciones aprobadas — lanzamiento autorizado")
                : t(`${passedGates}/6 verificações aprovadas — complete o restante antes de lançar`, `${passedGates}/6 checks approved — complete the remaining steps before launch`, `${passedGates}/6 verificaciones aprobadas — completa el resto antes de lanzar`)}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${
          allReady ? "border-green-500/40 text-green-400 bg-green-500/5"
          : failedGates > 0 ? "border-red-500/40 text-red-400 bg-red-500/5"
          : "border-yellow-500/40 text-yellow-400 bg-yellow-500/5"
        }`}>
          {allReady ? t("✓ Liberado", "✓ Cleared", "✓ Autorizado") : t(`${failedGates} pendente${failedGates > 1 ? "s" : ""}`, `${failedGates} pending`, `${failedGates} pendiente${failedGates !== 1 ? "s" : ""}`)}
        </Badge>
      </div>

      {/* ── Gate 1: Canal de Mensagens ──────────────────────────────────────── */}
      <GateRow
        id="messaging" icon={<MessageCircle className="h-4 w-4" />}
        label={t("Canal de Mensagens", "Messaging Channel", "Canal de mensajes")} passed={hasMessaging}
        passDetail={whatsappConn ? t("WhatsApp Business conectado", "WhatsApp Business connected", "WhatsApp Business conectado") : t("Telegram conectado", "Telegram connected", "Telegram conectado")}
        failDetail={t("WhatsApp Business ou Telegram obrigatório para disparar mensagens aos leads", "WhatsApp Business or Telegram is required to send messages to leads", "Se requiere WhatsApp Business o Telegram para enviar mensajes a los prospectos")}
        wizardKey={hasMessaging ? null : missingMsg}
        expandedWizard={expandedWizard} expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 2: Plataforma de Email ─────────────────────────────────────── */}
      <GateRow
        id="email" icon={<Mail className="h-4 w-4" />}
        label={t("Plataforma de Email", "Email Platform", "Plataforma de correo")} passed={hasEmail}
        passDetail={rdConn ? t("RD Station conectado", "RD Station connected", "RD Station conectado") : t("ActiveCampaign conectado", "ActiveCampaign connected", "ActiveCampaign conectado")}
        failDetail={t("RD Station ou ActiveCampaign obrigatório para sequências de email do lançamento", "RD Station or ActiveCampaign is required for launch email sequences", "Se requiere RD Station o ActiveCampaign para las secuencias de correo del lanzamiento")}
        wizardKey={hasEmail ? null : missingEmail}
        expandedWizard={expandedWizard} expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 5: Redes Sociais (obrigatório — OAuth) ──────────────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setSocialExpanded(v => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {hasSocial
              ? <CheckCircle2 className="h-4 w-4 text-green-400" />
              : <XCircle className="h-4 w-4 text-red-400" />}
          </div>
          <div className={`shrink-0 ${hasSocial ? "text-green-400/60" : "text-red-400/60"}`}>
            <Users className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${hasSocial ? "text-green-300" : "text-red-300"}`}>
              {t("Redes Sociais", "Social Networks", "Redes sociales")} — {channelStatus.map(c => c.label).join(" + ")} ({t("todas obrigatórias", "all required", "todas obligatorias")})
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {hasSocial
                ? t(`Conectado: ${connectedSocials} — posts e Reels publicados automaticamente conforme o calendário`, `Connected: ${connectedSocials} — posts and Reels are automatically published on schedule`, `Conectado: ${connectedSocials} — publicaciones y Reels se publican automáticamente según el calendario`)
                : missingSocialLabels.length === channelStatus.length
                  ? t(`Conecte ${missingSocialLabels.join(" + ")} para distribuição automática`, `Connect ${missingSocialLabels.join(" + ")} for automatic distribution`, `Conecta ${missingSocialLabels.join(" + ")} para la distribución automática`)
                  : t(`${missingSocialLabels.join(", ")} ${missingSocialLabels.length === 1 ? "ainda não conectado" : "ainda não conectados"} — conecte para completar o Gate 5`, `${missingSocialLabels.join(", ")} ${missingSocialLabels.length === 1 ? "not connected yet" : "not connected yet"} — connect to complete check 5`, `${missingSocialLabels.join(", ")} aún no está conectado — conecta para completar la verificación 5`)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {socialExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {socialExpanded && (
          <div className="mx-5 mb-4 space-y-2">
            {/* Per-platform status rows — always visible when expanded */}
            <div className="space-y-2">
              {/* Instagram row */}
              <div className={`px-4 py-3 flex items-center justify-between gap-3 border ${hasInstagram ? "border-green-500/20 bg-green-500/5" : "border-border/30 bg-background/30"}`}>
                <div className="flex items-center gap-3">
                  {hasInstagram
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className="text-base">📸</span>
                  <div>
                    <div className="font-mono text-[11px] font-bold">Instagram Business</div>
                    <div className="font-mono text-[9px] text-muted-foreground/50">{t("Posts, Stories e Reels automáticos via Meta Graph API", "Automatic posts, Stories, and Reels via Meta Graph API", "Publicaciones, Stories y Reels automáticos mediante Meta Graph API")}</div>
                  </div>
                </div>
                {!hasInstagram && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); void handleOAuth("instagram"); }}
                    disabled={oauthLoading === "instagram"}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 shrink-0"
                    style={{ background: "rgba(24,119,242,0.12)", border: "1px solid rgba(24,119,242,0.35)", color: "#1877F2" }}
                  >
                    {oauthLoading === "instagram"
                      ? <><Loader2 className="h-3 w-3 animate-spin" />{t("Aguardando…", "Waiting…", "Esperando…")}</>
                      : <>{t("Entrar com Instagram", "Connect Instagram", "Conectar Instagram")}</>}
                  </Button>
                )}
                {hasInstagram && (
                  <span className="font-mono text-[10px] text-green-400/70">{t("Conectado ✓", "Connected ✓", "Conectado ✓")}</span>
                )}
              </div>

              {/* TikTok row */}
              <div className={`px-4 py-3 flex items-center justify-between gap-3 border ${hasTikTok ? "border-green-500/20 bg-green-500/5" : "border-border/30 bg-background/30"}`}>
                <div className="flex items-center gap-3">
                  {hasTikTok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className="text-base">🎵</span>
                  <div>
                    <div className="font-mono text-[11px] font-bold">TikTok Business</div>
                    <div className="font-mono text-[9px] text-muted-foreground/50">{t("Vídeos curtos e TikTok Ads via Content Posting API", "Short videos and TikTok Ads via Content Posting API", "Videos cortos y anuncios de TikTok mediante Content Posting API")}</div>
                  </div>
                </div>
                {!hasTikTok && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); void handleOAuth("tiktok"); }}
                    disabled={oauthLoading === "tiktok"}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 shrink-0"
                    style={{ background: "rgba(254,44,85,0.10)", border: "1px solid rgba(254,44,85,0.35)", color: "#fe2c55" }}
                  >
                    {oauthLoading === "tiktok"
                      ? <><Loader2 className="h-3 w-3 animate-spin" />{t("Aguardando…", "Waiting…", "Esperando…")}</>
                      : <>{t("Entrar com TikTok", "Connect TikTok", "Conectar TikTok")}</>}
                  </Button>
                )}
                {hasTikTok && (
                  <span className="font-mono text-[10px] text-green-400/70">{t("Conectado ✓", "Connected ✓", "Conectado ✓")}</span>
                )}
              </div>

              {oauthError && (
                <div className="border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <div className="font-mono text-[10px] text-red-400 leading-relaxed">{oauthError}</div>
                </div>
              )}

              <div className="pt-1 border-t border-border/20 flex items-center justify-between">
                <div className="font-mono text-[9px] text-muted-foreground/30">
                  NexOS captura tokens via OAuth — sem copiar/colar credenciais
                </div>
                <Button asChild size="sm" variant="outline" className="font-mono text-[9px] uppercase tracking-widest h-6 px-2 gap-1 rounded-none border-border/30" onClick={e => e.stopPropagation()}>
                  <Link href="/integracoes">
                    <Zap className="h-3 w-3" />Mais opções
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Gate 3: Verificação de Conteúdo ─────────────────────────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setContentExpanded(v => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {noContent || !allContentApproved
              ? <XCircle className="h-4 w-4 text-red-400" />
              : verifyPhase < 3
                ? <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
                : <CheckCircle2 className="h-4 w-4 text-green-400" />}
          </div>
          <div className={`shrink-0 ${allContentApproved && verifyPhase >= 3 ? "text-green-400/60" : allContentApproved ? "text-yellow-400/60" : "text-red-400/60"}`}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${allContentApproved && verifyPhase >= 3 ? "text-green-300" : allContentApproved ? "text-yellow-300" : "text-red-300"}`}>
              {!allContentApproved ? t("Aprovação de Conteúdo do Schedule", "Schedule Content Approval", "Aprobación del contenido programado")
                : verifyPhase === 0 ? t("Verificando aprovações...", "Checking approvals...", "Verificando aprobaciones...")
                : verifyPhase === 1 ? t("Verificando conformidade CONAR...", "Checking CONAR compliance...", "Verificando cumplimiento de CONAR...")
                : verifyPhase === 2 ? t("Validando cronograma de publicação...", "Validating publishing schedule...", "Validando el calendario de publicaciones...")
                : t("Conteúdo verificado — schedule completo", "Content verified — schedule complete", "Contenido verificado — programación completa")}
            </div>
            {/* Animated sub-steps when content is approved */}
            {allContentApproved && verifyPhase > 0 && (
              <div className="flex flex-col gap-0.5 mt-1.5">
                <div className={`flex items-center gap-1.5 font-mono text-[9px] transition-opacity duration-300 ${verifyPhase >= 1 ? "opacity-100" : "opacity-30"}`}>
                  <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                  <span className="text-green-400/80">{t(`${approvedCount} peça${approvedCount !== 1 ? "s" : ""} aprovada${approvedCount !== 1 ? "s" : ""}`, `${approvedCount} piece${approvedCount !== 1 ? "s" : ""} approved`, `${approvedCount} pieza${approvedCount !== 1 ? "s" : ""} aprobada${approvedCount !== 1 ? "s" : ""}`)}</span>
                </div>
                {verifyPhase >= 2 && (
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                    <span className="text-green-400/80">{t("Sem violações CONAR/CDC detectadas", "No CONAR/CDC violations detected", "No se detectaron infracciones de CONAR/CDC")}</span>
                  </div>
                )}
                {verifyPhase >= 3 && (
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                    <span className="text-green-400/80">{t("Cronograma de publicação validado", "Publishing schedule validated", "Calendario de publicación validado")}</span>
                  </div>
                )}
              </div>
            )}
            {!allContentApproved && (
              <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                {noContent
                  ? t("Nenhuma peça gerada — gere o conteúdo antes de lançar", "No content generated — generate content before launch", "No se generó contenido — genéralo antes de lanzar")
                  : t(`${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} aguardando revisão e aprovação`, `${pendingPieces.length} piece${pendingPieces.length > 1 ? "s" : ""} awaiting review and approval`, `${pendingPieces.length} pieza${pendingPieces.length > 1 ? "s" : ""} pendiente${pendingPieces.length > 1 ? "s" : ""} de revisión y aprobación`)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!allContentApproved && !noContent && (
              <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                {approvedCount}/{allPieces.length}
              </span>
            )}
            {contentExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {contentExpanded && allPieces.length > 0 && (
          <div className="mx-5 mb-4 border border-border/30 divide-y divide-border/20">
            {allPieces.map((piece) => {
              const isApproved = piece.status === "approved";
              const typeLabel  = PIECE_TYPE_LABELS[piece.type] ?? piece.type;
              const statusMeta = PIECE_STATUS_META[piece.status] ?? { label: piece.status, color: "text-muted-foreground border-border/30" };
              return (
                <div key={piece.id} className="flex items-center gap-3 px-3 py-2.5 bg-background/20 hover:bg-background/30 transition-colors">
                  <div className="shrink-0">
                    {isApproved ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-mono text-[11px] font-medium truncate ${isApproved ? "text-foreground/70" : "text-foreground"}`}>
                      {piece.title || typeLabel}
                    </div>
                    {piece.platform && (
                      <div className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">{piece.platform}</div>
                    )}
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-1.5 py-0 shrink-0 ${statusMeta.color}`}>
                    {statusMeta.label}
                  </Badge>
                  {!isApproved && (
                    <Button asChild size="sm" variant="outline" className="font-mono text-[9px] uppercase shrink-0 h-6 px-2 gap-1 border-primary/30 text-primary/70 hover:bg-primary/10" onClick={e => e.stopPropagation()}>
                      <Link href={`/campaigns/${campaignId}/content`}>
                        <Eye className="h-3 w-3" />Revisar
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
            {!allContentApproved && (
              <div className="px-3 py-3 bg-background/10 flex items-center justify-between">
                <div className="font-mono text-[10px] text-muted-foreground/50">{t("Revise e aprove cada peça na página de conteúdo", "Review and approve each piece on the content page", "Revisa y aprueba cada pieza en la página de contenido")}</div>
                <Button asChild size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5">
                  <Link href={`/campaigns/${campaignId}/content`}>
                    <Eye className="h-3 w-3" />Abrir Conteúdo
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {contentExpanded && noContent && (
          <div className="mx-5 mb-4 border border-border/30 px-4 py-3 bg-background/20 text-center">
            <div className="font-mono text-[10px] text-muted-foreground/50">{t("Nenhuma peça gerada. Gere o conteúdo antes de lançar.", "No content generated. Generate content before launching.", "No se generó contenido. Genéralo antes de lanzar.")}</div>
          </div>
        )}
      </div>

      {/* ── Gate 3.5: Produzir Entregáveis (imagens & vídeos) ───────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setEntregaveisExpanded(v => !v)}
        >
          {deliverablesReady
            ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Image className="h-3.5 w-3.5 text-pink-400" />
              <span className="font-mono text-sm font-bold uppercase tracking-wide">{t("Produzir Entregáveis", "Produce Deliverables", "Producir Entregables")}</span>
              <Badge variant="outline" className={`font-mono text-[9px] rounded-none px-1.5 uppercase ${deliverablesReady ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}`}>
                {deliverablesReady ? "Pronto" : "Pendente"}
              </Badge>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/70 mt-1">
              Imagens (banners/criativos) e vídeos reais gerados por IA — etapa intermediária entre aprovar conteúdo e lançar.
            </p>
          </div>
          {entregaveisExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        {entregaveisExpanded && (
          <div className="mx-5 mb-4 border border-border/30 divide-y divide-border/20">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Image className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                <span className="font-mono text-[11px] text-foreground/90">{t("Criativos (banners/imagens)", "Creatives (banners/images)", "Creatividades (banners/imágenes)")}</span>
              </div>
              <span className={`font-mono text-[11px] ${creativesAllApproved || totalCreatives === 0 ? "text-muted-foreground" : "text-yellow-400"}`}>
              {totalCreatives === 0 ? t("Nenhum gerado", "None generated", "Ninguno generado") : t(`${approvedCreativesCnt}/${totalCreatives} aprovados`, `${approvedCreativesCnt}/${totalCreatives} approved`, `${approvedCreativesCnt}/${totalCreatives} aprobados`)}
              </span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="font-mono text-[11px] text-foreground/90">{t("Vídeos", "Videos", "Videos")}</span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {videoProjects.length === 0 ? t("Nenhum criado", "None created", "Ninguno creado") : t(`${completedVideosCnt}/${videoProjects.length} concluídos`, `${completedVideosCnt}/${videoProjects.length} completed`, `${completedVideosCnt}/${videoProjects.length} completados`)}
                {vslsWithoutVideo.length > 0 && ` • ${t(`${vslsWithoutVideo.length} roteiro(s) sem vídeo`, `${vslsWithoutVideo.length} script(s) without video`, `${vslsWithoutVideo.length} guion(es) sin vídeo`)}`}
              </span>
            </div>
            <div className="px-4 py-3 bg-background/10 flex items-center justify-between gap-3">
              <div className="font-mono text-[10px] text-muted-foreground/50">
                {t("Gere e aprove as imagens/vídeos no Estúdio de Criativos, na aba de Conteúdo", "Generate and approve images/videos in Creative Studio, under the Content tab", "Genera y aprueba las imágenes y vídeos en el Estudio creativo, en la pestaña Contenido")}
              </div>
              <Button asChild size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5">
                <Link href={`/campaigns/${campaignId}/content`}>
                  <Clapperboard className="h-3 w-3" />{t("Produzir Entregáveis", "Produce Deliverables", "Producir entregables")}
                </Link>
              </Button>
            </div>
            {!creativesAllApproved && (
              <label className="px-4 py-3 flex items-start gap-2.5 cursor-pointer bg-background/5">
                <input
                  type="checkbox"
                  checked={deliverablesConfirmed}
                  onChange={e => setDeliverablesConfirmed(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="font-mono text-[10px] text-muted-foreground/80 leading-relaxed">
                  {t("Confirmo que este lançamento não precisa de imagens/vídeos adicionais aprovados agora (ex: campanha de teste)", "I confirm this launch does not need additional approved images/videos right now (e.g., a test campaign)", "Confirmo que este lanzamiento no necesita imágenes o vídeos adicionales aprobados ahora (p. ej., una campaña de prueba)")}
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* ── Gate 4: Plano Financeiro & Mídia ────────────────────────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setFinExpanded(v => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {finReady ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
          </div>
          <div className={`shrink-0 ${finReady ? "text-green-400/60" : "text-red-400/60"}`}>
            <DollarSign className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${finReady ? "text-green-300" : "text-red-300"}`}>
              {t("Plano Financeiro & Distribuição de Mídia", "Financial Plan & Media Distribution", "Plan financiero y distribución de medios")}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {finReady
                ? t("Plano revisado e confirmado", "Plan reviewed and confirmed", "Plan revisado y confirmado")
                : financials?.hasBudget
                ? t("Revise a estrutura de custo e retorno estimado — confirme antes de lançar", "Review the cost structure and estimated return — confirm before launching", "Revisa la estructura de costes y el retorno estimado — confirma antes de lanzar")
                : t("Orçamento de tráfego não informado no intake — verifique o plano abaixo", "No traffic budget was provided in the intake — review the plan below", "No se indicó un presupuesto de tráfico en el intake — revisa el plan a continuación")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {finExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {finExpanded && (
          <div className="mx-5 mb-4 space-y-3">

            {/* ── No budget data ─────────────────────────────────────────── */}
            {!financials?.hasBudget && (
              <div className="border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                <div className="font-mono text-[11px] text-yellow-400 font-bold mb-1">{t("Orçamento não cadastrado", "Budget not set", "Presupuesto no registrado")}</div>
                <div className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                  {t("O intake desta campanha não incluiu orçamento de tráfego. Antes de lançar, garanta que seu planejamento financeiro está definido (quanto vai investir em Meta Ads, Google Ads, etc.). Você pode confirmar assim mesmo ou voltar ao intake e informar o orçamento.", "This campaign's intake did not include a traffic budget. Before launching, make sure your financial plan is defined (how much you will invest in Meta Ads, Google Ads, etc.). You can confirm anyway or return to the intake and enter the budget.", "El intake de esta campaña no incluyó un presupuesto de tráfico. Antes de lanzar, asegúrate de definir tu planificación financiera (cuánto invertirás en Meta Ads, Google Ads, etc.). Puedes confirmar de todos modos o volver al intake e indicar el presupuesto.")}
                </div>
              </div>
            )}

            {/* ── Budget overview + interactive sliders ─────────────────── */}
            {financials?.hasBudget && scaled && (
              <>
                {/* ── Budget slider ───────────────────────────────────────── */}
                <div className="border border-primary/20 bg-primary/5 px-4 py-4 space-y-4">
                  <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                    {t("Ajuste o orçamento — projeções atualizam em tempo real", "Adjust the budget — projections update in real time", "Ajusta el presupuesto — las proyecciones se actualizan en tiempo real")}
                  </div>

                  {/* Paid traffic budget slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">{t("Budget de Tráfego Pago", "Paid Traffic Budget", "Presupuesto de Tráfico Pago")}</span>
                      <span className="font-mono text-sm font-bold text-primary">{R$(localBudget)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={1000}
                        max={500000}
                        step={1000}
                        value={localBudget}
                        onChange={e => { setLocalBudget(Number(e.target.value)); setFinConfirmed(false); }}
                        className="w-full h-1.5 rounded-none appearance-none bg-border/30 cursor-pointer accent-primary"
                        style={{ accentColor: "hsl(var(--primary))" }}
                      />
                      <div className="flex justify-between mt-1">
                        <span className="font-mono text-[9px] text-muted-foreground/25">R$ 1k</span>
                        <span className="font-mono text-[9px] text-muted-foreground/25">R$ 500k</span>
                      </div>
                    </div>
                    {/* Quick preset buttons */}
                    <div className="flex gap-1.5 flex-wrap">
                      {[5000, 10000, 25000, 50000, 100000, 250000].map(v => (
                        <button
                          key={v}
                          onClick={() => { setLocalBudget(v); setFinConfirmed(false); }}
                          className={`font-mono text-[9px] px-2 py-1 border transition-colors uppercase tracking-widest ${
                            localBudget === v
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border/30 text-muted-foreground/50 hover:border-primary/30 hover:text-foreground"
                          }`}
                        >
                          {R$(v)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Retargeting % slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">% {t("Retargeting", "Retargeting", "Retargeting")}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-cyan-400">{localRetargetPct}% {t("retargeting", "retargeting", "retargeting")}</span>
                        <span className="font-mono text-[10px] text-muted-foreground/30">·</span>
                        <span className="font-mono text-[10px] text-primary/70">{100 - localRetargetPct}% {t("prospecção", "prospecting", "prospección")}</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={5}
                      value={localRetargetPct}
                      onChange={e => { setLocalRetargetPct(Number(e.target.value)); setFinConfirmed(false); }}
                      className="w-full h-1.5 rounded-none appearance-none bg-border/30 cursor-pointer"
                      style={{ accentColor: "hsl(var(--primary))" }}
                    />
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-muted-foreground/25">10% {t("retargeting", "retargeting", "retargeting")}</span>
                      <span className="font-mono text-[9px] text-muted-foreground/25">50% {t("retargeting", "retargeting", "retargeting")}</span>
                    </div>
                  </div>

                  {/* Split summary */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="border border-primary/20 bg-background/30 px-3 py-2">
                      <div className="font-mono text-[9px] text-primary/50 uppercase tracking-widest mb-0.5">{t("Prospecção", "Prospecting", "Prospección")} ({100 - localRetargetPct}%)</div>
                      <div className="font-mono text-sm font-bold text-primary">{R$(scaled.prospecting)}</div>
                    </div>
                    <div className="border border-cyan-500/20 bg-background/30 px-3 py-2">
                      <div className="font-mono text-[9px] text-cyan-400/50 uppercase tracking-widest mb-0.5">{t("Retargeting", "Retargeting", "Retargeting")} ({localRetargetPct}%)</div>
                      <div className="font-mono text-sm font-bold text-cyan-400">{R$(scaled.retargeting)}</div>
                    </div>
                  </div>
                </div>

                {/* KPI strip — live values */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { icon: <DollarSign className="h-3.5 w-3.5" />, label: t("Investimento Total", "Total Investment", "Inversión total"),  value: R$(localBudget),                       sub: t("tráfego pago", "paid traffic", "tráfico pagado") },
                    { icon: <Target      className="h-3.5 w-3.5" />, label: t("Leads Pagos", "Paid Leads", "Prospectos pagados"),         value: scaled.paidLeads.mid.toLocaleString("pt-BR"), sub: `${scaled.paidLeads.low}–${scaled.paidLeads.high} ${t("(faixa)", "(range)", "(rango)")}` },
                    { icon: <Users       className="h-3.5 w-3.5" />, label: t("Total Leads", "Total Leads", "Total de prospectos"),         value: scaled.totalLeads.mid.toLocaleString("pt-BR"), sub: `+${scaled.organicLeads.mid} ${t("orgânico", "organic", "orgánicos")}` },
                    { icon: <TrendingUp  className="h-3.5 w-3.5" />, label: t("Receita Projetada", "Projected Revenue", "Ingresos proyectados"),   value: R$(scaled.totalRevenue.mid),           sub: `ROAS ${scaled.totalRoas.mid.toFixed(1)}x ${t("realista", "realistic", "realista")}` },
                  ].map(kpi => (
                    <div key={kpi.label} className="border border-border/30 bg-background/30 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground/40 mb-1">{kpi.icon}<span className="font-mono text-[9px] uppercase tracking-widest">{kpi.label}</span></div>
                      <div className="font-mono text-sm font-bold text-foreground">{kpi.value}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/40">{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Platform breakdown — scaled */}
                {scaled.platforms.length > 0 && (
                  <div className="border border-border/30 bg-background/20">
                    <div className="px-4 py-2 border-b border-border/20 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="h-3 w-3" />{t("Distribuição por Plataforma", "Distribution by Platform", "Distribución por plataforma")}
                    </div>
                    {scaled.platforms.map(p => (
                      <div key={p.platform} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/10 last:border-0 hover:bg-background/20 transition-colors">
                        <span className="text-base shrink-0">{p.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-medium">{p.label}</span>
                            <Badge variant="outline" className="rounded-none font-mono text-[8px] px-1 py-0 border-border/30 text-muted-foreground/40">
                              {p.budgetPct}% • {R$(p.budgetAllocation)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="font-mono text-[10px] text-foreground/70">
                            <span className="text-muted-foreground/40">{t("Leads:", "Leads:", "Prospectos:")} </span>{p.leads.low}–{p.leads.high}
                          </div>
                          <div className="font-mono text-[9px] text-muted-foreground/40">
                            CPL R${p.cpl.low}–R${p.cpl.high} • ROAS {p.roas.mid.toFixed(1)}x
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Revenue scenarios — scaled */}
                <div className="border border-border/30 bg-background/20">
                  <div className="px-4 py-2 border-b border-border/20 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                    {t("Cenários de Retorno (Pessimista / Realista / Otimista)", "Return Scenarios (Pessimistic / Realistic / Optimistic)", "Escenarios de retorno (pesimista / realista / optimista)")}
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border/20">
                    {(["low", "mid", "high"] as const).map((sc, i) => {
                      const labels = [t("Pess.", "Pess.", "Pesim."), t("Real.", "Real.", "Real."), t("Otim.", "Optim.", "Optim.")];
                      const colors = ["text-red-400", "text-yellow-400", "text-green-400"];
                      const rev    = scaled.totalRevenue[sc];
                      const roi    = scaled.totalRoi[sc];
                      const roas   = scaled.totalRoas[sc];
                      return (
                        <div key={sc} className={`px-3 py-3 ${sc === "mid" ? "bg-yellow-500/3" : ""}`}>
                          <div className={`font-mono text-[9px] uppercase tracking-widest ${colors[i]} mb-1`}>{labels[i]}</div>
                          <div className="font-mono text-sm font-bold text-foreground">{R$(rev)}</div>
                          <div className="font-mono text-[9px] text-muted-foreground/50 mt-1">ROI {roi > 0 ? "+" : ""}{roi}%</div>
                          <div className="font-mono text-[9px] text-muted-foreground/50">ROAS {roas.toFixed(1)}x</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 py-2 border-t border-border/10 flex items-center justify-between">
                    <div className="font-mono text-[9px] text-muted-foreground/30">
                      {t("Ponto de equilíbrio", "Break-even", "Punto de equilibrio")}: {scaled.breakEvenSales} {t("venda", "sale", "venta")}{scaled.breakEvenSales !== 1 ? t("s", "s", "s") : ""}
                      {financials.revenueTarget ? ` • ${t("Meta", "Target", "Meta")}: ${R$(financials.revenueTarget)}` : ""}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/25">+{scaled.organicLeads.mid} {t("leads orgânicos estimados", "estimated organic leads", "prospectos orgánicos estimados")}</div>
                  </div>
                </div>

                {/* Benchmark note */}
                {financials.simulation?.benchmarkNote && (
                  <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed px-1">
                    ⚠ {financials.simulation.benchmarkNote}
                  </div>
                )}
              </>
            )}

            {/* Confirm button */}
            {!finConfirmed ? (
              <Button
                onClick={() => setFinConfirmed(true)}
                variant="outline"
                className="w-full rounded-none font-mono uppercase tracking-widest text-xs h-10 gap-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {financials?.hasBudget ? t("Revisei e Confirmo o Plano Financeiro", "I have reviewed and confirm the Financial Plan", "Revisé y confirmo el plan financiero") : t("Confirmo que defini meu orçamento externamente", "I confirm that I set my budget externally", "Confirmo que definí mi presupuesto externamente")}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("Plano financeiro confirmado", "Financial plan confirmed", "Plan financiero confirmado")}
                <button onClick={() => setFinConfirmed(false)} className="ml-2 text-muted-foreground/30 hover:text-muted-foreground text-[9px] underline">{t("desfazer", "undo", "deshacer")}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Gate 6: Funil & Landing Page ────────────────────────────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setFunnelExpanded(v => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {funnelConfirmed
              ? <CheckCircle2 className="h-4 w-4 text-green-400" />
              : <XCircle className="h-4 w-4 text-red-400" />}
          </div>
          <div className={`shrink-0 ${funnelConfirmed ? "text-green-400/60" : "text-red-400/60"}`}>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${funnelConfirmed ? "text-green-300" : "text-red-300"}`}>
              {t("Funil & Landing Page", "Funnel & Landing Page", "Embudo y página de aterrizaje")}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {funnelConfirmed
                ? t(`Landing page confirmada: ${landingUrl}`, `Landing page confirmed: ${landingUrl}`, `Página de aterrizaje confirmada: ${landingUrl}`)
                : t("Informe a URL pública da sua landing page antes de lançar", "Enter your public landing page URL before launching", "Introduce la URL pública de tu página de aterrizaje antes de lanzar")}
            </div>
          </div>
          <div className="shrink-0">
            {funnelExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {funnelExpanded && <div className="mx-5 mb-4 space-y-3">
          {/* URL input */}
          <div className="border border-border/30 bg-background/20 p-4 space-y-3">
            <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
              {t("URL da Landing Page publicada", "Published Landing Page URL", "URL de la página de aterrizaje publicada")}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={landingUrlInput}
                onChange={e => setLandingUrlInput(e.target.value)}
                placeholder={t("https://seu-dominio.com/produto", "https://your-domain.com/product", "https://tu-dominio.com/producto")}
                className="flex-1 bg-background/30 border border-border/40 px-3 py-2 font-mono text-[11px] text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-background/50"
              />
              {landingUrlInput.startsWith("http") ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const url = landingUrlInput.trim();
                    setLandingUrl(url);
                    try { localStorage.setItem(funnelKey, url); } catch {}
                  }}
                  className="rounded-none font-mono text-[10px] uppercase tracking-widest h-9 px-3 gap-1.5 btn-weapon-primary shrink-0"
                >
                  <CheckCircle2 className="h-3 w-3" />{t("Confirmar", "Confirm", "Confirmar")}
                </Button>
              ) : (
                <Button size="sm" disabled className="rounded-none font-mono text-[10px] uppercase tracking-widest h-9 px-3 opacity-30 shrink-0">
                  {t("Confirmar", "Confirm", "Confirmar")}
                </Button>
              )}
            </div>
            {landingUrlInput && !landingUrlInput.startsWith("http") && (
              <div className="font-mono text-[9px] text-red-400/70">{t("URL deve começar com https://", "URL must start with https://", "La URL debe comenzar con https://")}</div>
            )}
          </div>

          {/* Checklist items */}
          <div className="border border-border/30 bg-background/20 px-4 py-3 space-y-2">
              <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">{t("Verificações antes de lançar", "Pre-launch checks", "Verificaciones previas al lanzamiento")}</div>
            {[
              { text: t("Landing page publicada e acessível pelo link acima", "Landing page published and accessible at the link above", "Página de aterrizaje publicada y accesible en el enlace anterior"), done: funnelConfirmed },
              { text: t("Checkout configurado e aceitando pagamentos (Hotmart, Kiwify, etc.)", "Checkout configured and accepting payments (Hotmart, Kiwify, etc.)", "Checkout configurado y aceptando pagos (Hotmart, Kiwify, etc.)"), done: false },
              { text: t("Pixel do Meta e/ou TikTok instalado na landing page", "Meta and/or TikTok Pixel installed on the landing page", "Píxel de Meta o TikTok instalado en la página de aterrizaje"), done: hasSocial },
              { text: t("Página de obrigado configurada com evento de conversão", "Thank-you page configured with a conversion event", "Página de agradecimiento configurada con un evento de conversión"), done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className={`h-3 w-3 mt-0.5 shrink-0 ${item.done ? "text-green-400/60" : "text-muted-foreground/20"}`} />
                <span className={`font-mono text-[10px] leading-relaxed ${item.done ? "text-foreground/60" : "text-muted-foreground/50"}`}>{item.text}</span>
              </div>
            ))}
          </div>

          {funnelConfirmed && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-green-400 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">{landingUrl}</span>
              <button
                onClick={() => { setLandingUrl(""); setLandingUrlInput(""); try { localStorage.removeItem(funnelKey); } catch {} }}
                className="text-muted-foreground/30 hover:text-muted-foreground text-[9px] underline shrink-0"
              >
                {t("alterar", "change", "cambiar")}
              </button>
            </div>
          )}
        </div>}
      </div>

      {/* ── Launch button ──────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-4 border-t border-border/20">
        {allReady ? (
          <Button
            onClick={onLaunch}
            disabled={launching}
            className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
          >
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {launching ? t("Lançando...", "Launching...", "Lanzando...") : t("Lançar Campanha Agora", "Launch Campaign Now", "Lanzar campaña ahora")}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button disabled className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm opacity-30 cursor-not-allowed">
              <Rocket className="h-4 w-4" />
              {t("Lançar Campanha", "Launch Campaign", "Lanzar campaña")}
            </Button>
            <div className="text-center font-mono text-[10px] text-muted-foreground/50 space-x-1">
              {!hasMessaging && <span>{t("Configure mensagens •", "Configure messaging •", "Configura los mensajes •")}</span>}
              {!hasEmail && <span>{t("Configure email •", "Configure email •", "Configura el correo •")}</span>}
              {!hasSocial && <span>{!hasInstagram && !hasTikTok ? t("Conecte Instagram + TikTok •", "Connect Instagram + TikTok •", "Conecta Instagram + TikTok •") : !hasInstagram ? t("Conecte Instagram •", "Connect Instagram •", "Conecta Instagram •") : t("Conecte TikTok •", "Connect TikTok •", "Conecta TikTok •")}</span>}
              {!allContentApproved && !noContent && <span>{t(`Aprove ${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} •`, `Approve ${pendingPieces.length} piece${pendingPieces.length !== 1 ? "s" : ""} •`, `Aprueba ${pendingPieces.length} pieza${pendingPieces.length !== 1 ? "s" : ""} •`)}</span>}
              {noContent && <span>{t("Gere o conteúdo •", "Generate content •", "Genera el contenido •")}</span>}
              {!funnelConfirmed && <span>{t("Informe a URL da landing page •", "Enter the landing page URL •", "Introduce la URL de la página de aterrizaje •")}</span>}
              {!finReady && <span>{t("Confirme o plano financeiro", "Confirm the financial plan", "Confirma el plan financiero")}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GateRow sub-component ────────────────────────────────────────────────────

interface GateRowProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  passed: boolean;
  passDetail: string;
  failDetail: string;
  wizardKey: keyof typeof INTEGRATION_WIZARDS | null;
  expandedWizard: string | null;
  expandedStep: number | null;
  onToggleWizard: (id: string) => void;
  onToggleStep: (idx: number | null) => void;
}

function GateRow({
  id, icon, label, passed, passDetail, failDetail,
  wizardKey, expandedWizard, expandedStep, onToggleWizard, onToggleStep,
}: GateRowProps) {
  const t = useUiText();
  const isOpen = expandedWizard === id;
  const wizard = wizardKey ? INTEGRATION_WIZARDS[wizardKey] : null;
  const localizeWizardText = (text: string) => {
    const translations = WIZARD_TRANSLATIONS[text];
    return translations ? t(text, translations[0], translations[1]) : text;
  };

  return (
    <div className="border-t border-border/20">
      <div
        className={`flex items-start gap-3 px-5 py-4 ${wizard ? "cursor-pointer hover:bg-background/20 transition-colors" : ""}`}
        onClick={() => wizard && onToggleWizard(id)}
      >
        <div className="mt-0.5 shrink-0">
          {passed ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
        </div>
        <div className={`shrink-0 ${passed ? "text-green-400/60" : "text-red-400/60"}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-xs font-bold ${passed ? "text-green-300" : "text-red-300"}`}>{label}</div>
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{passed ? passDetail : failDetail}</div>
        </div>
        {wizard && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-primary/70 uppercase tracking-widest">
              {isOpen ? t("Fechar guia", "Close guide", "Cerrar guía") : t("Ver passo a passo", "View step-by-step guide", "Ver guía paso a paso")}
            </span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-primary/50" /> : <ChevronDown className="h-3.5 w-3.5 text-primary/50" />}
          </div>
        )}
      </div>

      {isOpen && wizard && (
        <div className="mx-5 mb-4 border border-primary/20 bg-primary/5">
          <div className="px-4 py-3 border-b border-primary/15 flex items-start gap-3">
            <span className="text-xl shrink-0">{wizard.icon}</span>
            <div>
              <div className="font-mono text-xs font-bold text-primary">{wizard.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{localizeWizardText(wizard.why)}</div>
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-3">
              {t("Siga os passos abaixo para conectar agora:", "Follow the steps below to connect now:", "Sigue estos pasos para conectar ahora:")}
            </div>
            {wizard.steps.map((step, idx) => {
              const stepOpen = expandedStep === idx;
              return (
                <div
                  key={idx}
                  className="border border-border/30 bg-background/30 cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onToggleStep(stepOpen ? null : idx); }}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-5 h-5 rounded bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="font-mono text-[9px] font-bold text-primary">{idx + 1}</span>
                    </div>
                    <div className="font-mono text-[11px] font-medium flex-1">{localizeWizardText(step.label)}</div>
                    {stepOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                  </div>
                  {stepOpen && (
                    <div className="px-11 pb-3">
                      <div className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">{localizeWizardText(step.detail)}</div>
                      {("url" in step) && (step as { url?: string }).url && (
                        <a
                          href={(step as { url?: string }).url}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />{t("Abrir agora", "Open now", "Abrir ahora")}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground/40">{t("Após conectar, esta verificação atualiza automaticamente.", "After connecting, this check updates automatically.", "Después de conectar, esta verificación se actualiza automáticamente.")}</div>
              <Button asChild size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5" onClick={e => e.stopPropagation()}>
                <Link href="/integracoes">
                  <Zap className="h-3 w-3" />{t("Ir para Integrações", "Go to Integrations", "Ir a Integraciones")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
