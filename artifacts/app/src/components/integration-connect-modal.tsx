import { useState } from "react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import {
  X, AlertTriangle, ExternalLink, Zap, ShieldAlert, Info,
  ChevronDown, ChevronUp, CheckCircle2, Loader2, Sparkles,
  MessageSquare, Mail, CreditCard, BarChart2, Instagram, Music2,
} from "lucide-react";
import { IntegrationAssistantChat } from "@/components/integration-assistant-chat";
import { useUiText } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Provider =
  | "whatsapp_business" | "telegram"
  | "rd_station" | "activecampaign" | "resend"
  | "stripe" | "paypal" | "mercado_pago" | "pagarme" | "asaas"
  | "hotmart" | "kiwify" | "eduzz"
  | "meta_ads" | "google_ads" | "tiktok_ads" | "linkedin_ads"
  | "instagram" | "facebook" | "tiktok"
  | "hubspot"
  | "heygen" | "runway_ml" | "kling_fal" | "elevenlabs";

export interface WorkspaceIntegration {
  id: string;
  provider: Provider;
  status: "connected" | "disconnected" | "error";
  accountId?: string;
  accountName?: string;
  metadata?: {
    igUsername?: string;
    igFollowersCount?: number;
    igProfilePictureUrl?: string;
    igMediaCount?: number;
    accountName?: string;
    igAccountId?: string;
    [key: string]: unknown;
  };
  isPaymentGateway: boolean;
  blocksExecution: boolean;
  createdAt: string;
}

export interface SetupStep { title: string; detail: string; url?: string }
export interface SetupGuide {
  warning?: string;
  prereqs: string[];
  steps: SetupStep[];
  docsUrl?: string;
  docsLabel?: string;
}
export interface FieldDef {
  key: string; label: string; placeholder: string; type?: string; hint?: string;
}
export interface CatalogEntry {
  provider: Provider;
  label: string;
  description: string;
  why: string;
  category: string;
  color: string;
  icon: React.ElementType;
  required: boolean;
  fields: FieldDef[];
  guide: SetupGuide;
  oauthPlatform?: "meta" | "tiktok" | "google" | "hubspot" | "rdstation" | "linkedin";
  oauthLabel?: string;
}

// ── OAuth platform logos (inline SVG) ─────────────────────────────────────────
export const MetaLogo = () => (
  <svg viewBox="0 0 40 40" className="h-4 w-4" fill="none">
    <path d="M20 7C13 7 7 13 7 20s6 13 13 13 13-6 13-13S27 7 20 7z" fill="#1877F2"/>
    <path d="M22.5 16.5c-1.38 0-2.5 1.12-2.5 2.5v6h3v-5.5h2l.5-3H23v-1.5c0-.55.45-1 1-1h1.5v-2.5A8 8 0 0 0 22.5 11c-2.76 0-5 2.24-5 5v.5h-2v3h2V31h3v-6.5h2.5" fill="#fff"/>
  </svg>
);
export const TikTokLogo = () => (
  <svg viewBox="0 0 40 40" className="h-4 w-4" fill="none">
    <rect width="40" height="40" rx="8" fill="#010101"/>
    <path d="M28 14.5a5.5 5.5 0 0 1-5.5-5.5h-3.5v14.5L19 28a3 3 0 1 1-3-3 3 3 0 0 1 .5.04V21.5A6.5 6.5 0 1 0 23 28V19.5A9 9 0 0 0 28 21v-3.5a5.47 5.47 0 0 1-3-.55V14.5z" fill="white"/>
    <path d="M28 14.5a5.5 5.5 0 0 1-5.5-5.5h-3.5v14.5L19 28a3 3 0 1 1-3-3 3 3 0 0 1 .5.04V21.5A6.5 6.5 0 1 0 23 28V19.5A9 9 0 0 0 28 21v-3.5a5.47 5.47 0 0 1-3-.55V14.5" stroke="#69C9D0" strokeWidth=".5" fill="none"/>
  </svg>
);
export const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
export const HubSpotLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FF7A59">
    <path d="M22.447 13.098a5.166 5.166 0 0 0-4.21-5.08V5.57a2.013 2.013 0 0 0 1.164-1.818v-.056A2.013 2.013 0 0 0 17.39 1.68h-.042a2.013 2.013 0 0 0-2.012 2.013v.056c0 .815.487 1.519 1.165 1.818v2.449a5.162 5.162 0 0 0-2.715 1.19L8.017 5.3a2.25 2.25 0 1 0-.944 1.16l5.716 3.864a5.166 5.166 0 0 0-.816 2.898 5.166 5.166 0 0 0 .816 2.898l-1.737 1.237a1.89 1.89 0 1 0 .983 1.09l1.792-1.277a5.166 5.166 0 0 0 3.505 1.179 5.17 5.17 0 0 0 5.115-5.251zm-5.115 3.215a3.212 3.212 0 1 1 0-6.424 3.212 3.212 0 0 1 0 6.424z"/>
  </svg>
);
export const RDLogo = () => (
  <svg viewBox="0 0 28 28" className="h-4 w-4">
    <rect width="28" height="28" rx="5" fill="#0071c1"/>
    <text x="3" y="20" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="12" fill="white">RD</text>
  </svg>
);
export const LinkedInLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// ── Catalog ───────────────────────────────────────────────────────────────────
export const INTEGRATION_CATALOG: CatalogEntry[] = [
  {
    provider: "whatsapp_business",
    label: "WhatsApp Business API",
    description: "Disparo automatizado de mensagens e auto-resposta com o agente durante o lançamento",
    why: "Obrigatório para disparar sequências de mensagens durante o lançamento. Sem isso o NexOS não consegue executar uma campanha completa.",
    category: "Mensagens",
    color: "text-green-400",
    icon: MessageSquare,
    required: true,
    fields: [
      { key: "accountId",   label: "Phone Number ID",     placeholder: "123456789012345",
        hint: "Não é o número de telefone em si — é o ID numérico de 15 dígitos encontrado no Meta Business Suite → WhatsApp → Números de telefone." },
      { key: "accountName", label: "Nome da Conta",       placeholder: "Minha Empresa" },
      { key: "accessToken", label: "Access Token (Meta)", placeholder: "EAAxxxx...", type: "password",
        hint: "Token de acesso permanente gerado em Meta Developers → Seu App → WhatsApp → Configuração da API → Generate Token." },
    ],
    guide: {
      warning: "Requer WhatsApp Business API — não funciona com o aplicativo WhatsApp comum ou WhatsApp Business App.",
      prereqs: [
        "Conta verificada no Meta Business Suite (business.facebook.com)",
        "Número de telefone dedicado — não pode ser seu WhatsApp pessoal ou do WhatsApp Business App",
        "App criado no Meta Developers com a API do WhatsApp ativada",
      ],
      steps: [
        { title: "Acesse o Meta Business Suite", detail: "Vá em business.facebook.com → Configurações → WhatsApp.", url: "https://business.facebook.com" },
        { title: "Encontre o Phone Number ID", detail: "No menu WhatsApp → Números de Telefone. Clique no número → copie o campo 'Phone Number ID' (não é o número de telefone)." },
        { title: "Crie o App no Meta Developers", detail: "Acesse developers.facebook.com → Meus Apps → Criar App → escolha 'Business'.", url: "https://developers.facebook.com" },
        { title: "Ative o WhatsApp no App", detail: "No painel do app → Adicionar produto → WhatsApp → Configurar. Associe sua conta do Meta Business." },
        { title: "Gere o Access Token", detail: "Em WhatsApp → Configuração da API → clique em 'Generate Token'. Copie o token permanente (começa com EAA...)." },
      ],
      docsUrl: "https://developers.facebook.com/docs/whatsapp/getting-started",
      docsLabel: "Documentação oficial Meta",
    },
  },
  {
    provider: "telegram",
    label: "Telegram Bot",
    description: "Bot de automação e notificações via canal do Telegram",
    why: "Alternativa ao WhatsApp para disparo automático de mensagens e notificações do lançamento.",
    category: "Mensagens",
    color: "text-sky-400",
    icon: MessageSquare,
    required: false,
    fields: [
      { key: "accountId",   label: "Bot Token",    placeholder: "1234567890:AAFxxxx...",
        hint: "Gerado pelo @BotFather no Telegram. Formato: 1234567890:AAFxxxxxxxxxx" },
      { key: "accountName", label: "Nome do Bot",  placeholder: "@meubot" },
    ],
    guide: {
      prereqs: ["Conta no Telegram (qualquer conta serve)"],
      steps: [
        { title: "Abra o Telegram e busque @BotFather", detail: "No Telegram, pesquise por @BotFather e inicie a conversa." },
        { title: "Crie um novo bot", detail: "Digite /newbot e siga as instruções. Escolha um nome e um username (deve terminar em 'bot')." },
        { title: "Copie o Bot Token", detail: "O BotFather vai te enviar um token no formato: 1234567890:AAFxxxxxxxxxx. Cole aqui." },
      ],
      docsUrl: "https://core.telegram.org/bots#how-do-i-create-a-bot",
      docsLabel: "Como criar um bot no Telegram",
    },
  },
  {
    provider: "rd_station",
    label: "RD Station",
    description: "E-mail marketing e automação de leads integrados ao lançamento",
    why: "Obrigatório para enviar a sequência de e-mails de lançamento. Conecte RD Station, ActiveCampaign ou Resend.",
    category: "E-mail",
    color: "text-blue-400",
    icon: Mail,
    required: true,
    fields: [
      { key: "accountId",   label: "Client ID",    placeholder: "seu-client-id",
        hint: "Encontrado em RD Station → Configurações → Integrações → API Pública → Client ID." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Workspace RD" },
      { key: "accessToken", label: "API Token",     placeholder: "rdst_xxxx...", type: "password",
        hint: "Token privado de API em RD Station → Configurações → Integrações → API Pública." },
    ],
    guide: {
      prereqs: ["Conta ativa no RD Station Marketing", "Plano que inclui acesso à API (Marketing ou superior)"],
      steps: [
        { title: "Acesse as configurações do RD Station", detail: "Vá em Configurações → Integrações → API Pública.", url: "https://app.rdstation.com.br/integrations" },
        { title: "Copie o Client ID", detail: "Na seção API Pública, você verá o Client ID. Copie e cole no campo acima." },
        { title: "Gere o Token de API", detail: "Na mesma tela, clique em 'Gerar Token' se não houver um. Copie o token gerado." },
      ],
      docsUrl: "https://developers.rdstation.com/pt-BR/authentication",
      docsLabel: "Docs RD Station API",
    },
    oauthPlatform: "rdstation",
    oauthLabel: "Entrar com RD Station",
  },
  {
    provider: "activecampaign",
    label: "ActiveCampaign",
    description: "CRM e automação de e-mail com segmentação avançada",
    why: "Alternativa ao RD Station com CRM e automações comportamentais integradas.",
    category: "E-mail",
    color: "text-blue-400",
    icon: Mail,
    required: false,
    fields: [
      { key: "accountId",   label: "Account Name (subdomínio)", placeholder: "minhaempresa",
        hint: "É o subdomínio da sua conta. Se você acessa minhaempresa.activehosted.com, o Account Name é 'minhaempresa'." },
      { key: "accountName", label: "Nome da Conta",              placeholder: "Minha AC" },
      { key: "accessToken", label: "API Key",                    placeholder: "xxxxxx...", type: "password",
        hint: "Em ActiveCampaign → Settings → Developer → API Access → API Key." },
    ],
    guide: {
      prereqs: ["Conta ativa no ActiveCampaign"],
      steps: [
        { title: "Acesse as configurações de desenvolvedor", detail: "No ActiveCampaign, vá em Settings (engrenagem) → Developer.", url: "https://www.activecampaign.com/settings/developer" },
        { title: "Copie o Account Name", detail: "Na seção API Access, você verá a URL base. Ex: https://minhaempresa.api-us1.com — o Account Name é 'minhaempresa'." },
        { title: "Copie a API Key", detail: "Na mesma tela, copie a API Key. Nunca compartilhe essa chave." },
      ],
      docsUrl: "https://developers.activecampaign.com/reference/authentication",
      docsLabel: "Docs ActiveCampaign API",
    },
  },
  {
    provider: "resend",
    label: "Resend",
    description: "E-mail transacional de alta entregabilidade — opção mais simples",
    why: "Opção mais simples para envio de e-mails. Basta a API Key do Resend — sem configuração complexa.",
    category: "E-mail",
    color: "text-violet-400",
    icon: Mail,
    required: false,
    fields: [
      { key: "accountId",   label: "Audience ID (para broadcasts)", placeholder: "78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        hint: "UUID da sua Audience no Resend. Encontrado em Resend → Audiences → clique na audience → copie o ID." },
      { key: "accountName", label: "Nome da Conta",   placeholder: "Meu Workspace Resend" },
      { key: "accessToken", label: "API Key",         placeholder: "re_xxxx...", type: "password",
        hint: "Gerada em Resend → API Keys → Create API Key. Começa com 're_'." },
    ],
    guide: {
      prereqs: ["Conta no Resend (resend.com — plano gratuito disponível)", "Domínio de e-mail verificado no Resend"],
      steps: [
        { title: "Crie uma conta no Resend", detail: "Acesse resend.com e crie sua conta gratuitamente.", url: "https://resend.com/signup" },
        { title: "Verifique seu domínio", detail: "Em Resend → Domains → Add Domain. Adicione os registros DNS indicados no seu provedor de domínio." },
        { title: "Crie uma API Key", detail: "Em Resend → API Keys → Create API Key. Dê um nome descritivo e copie a chave gerada (começa com 're_')." },
        { title: "Copie o Audience ID (opcional)", detail: "Em Resend → Audiences → clique na sua audience → copie o UUID. Necessário apenas para broadcasts." },
      ],
      docsUrl: "https://resend.com/docs",
      docsLabel: "Docs Resend",
    },
  },
  {
    provider: "instagram",
    label: "Instagram Business",
    description: "Auto-post de conteúdo orgânico sincronizado ao calendário",
    why: "Publica automaticamente posts, stories e reels gerados pelo agente nos horários certos do lançamento.",
    category: "Social Orgânico",
    color: "text-pink-300",
    icon: Instagram,
    required: false,
    fields: [
      { key: "accountId",   label: "Instagram Account ID", placeholder: "17841400000000000",
        hint: "ID numérico da conta Instagram Business. Encontrado em Meta Business Suite → Instagram → Contas → clique na conta → copie o ID." },
      { key: "accountName", label: "Nome da Conta",         placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token (Meta)",   placeholder: "EAAxxxx...", type: "password",
        hint: "Token de acesso com permissão instagram_basic e instagram_content_publish. Gerado em Meta Developers → Graph API Explorer." },
    ],
    guide: {
      warning: "Requer conta Instagram Business ou Creator — não funciona com perfis pessoais.",
      prereqs: [
        "Conta Instagram convertida para Business ou Creator",
        "Conta Instagram vinculada a uma Página do Facebook",
        "App no Meta Developers com permissões instagram_basic e instagram_content_publish",
      ],
      steps: [
        { title: "Converta sua conta para Business", detail: "No Instagram → Configurações → Conta → Mudar para conta profissional → Empresa." },
        { title: "Vincule a uma Página do Facebook", detail: "No Meta Business Suite → Instagram → Contas → conecte seu Instagram." },
        { title: "Encontre o Account ID", detail: "No Meta Business Suite → Instagram → clique na conta → o ID numérico está na URL ou nas configurações." },
        { title: "Gere o Access Token", detail: "Em Meta Developers → Graph API Explorer → selecione seu app → adicione permissões instagram_basic e instagram_content_publish → gere o token.", url: "https://developers.facebook.com/tools/explorer" },
      ],
      docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
      docsLabel: "Docs Instagram API",
    },
    oauthPlatform: "meta",
    oauthLabel: "Entrar com Instagram",
  },
  {
    provider: "facebook",
    label: "Facebook (Páginas)",
    description: "Auto-post orgânico em Páginas do Facebook sincronizado ao lançamento",
    why: "Publica automaticamente no Facebook durante o lançamento. Obrigatório para quem tem audiência orgânica no Facebook.",
    category: "Social Orgânico",
    color: "text-blue-400",
    icon: MetaLogo,
    required: false,
    fields: [
      { key: "accountId",   label: "Page ID", placeholder: "123456789012345",
        hint: "ID numérico da sua Página do Facebook. Encontrado em Configurações da Página → Informações da página → ID da página." },
      { key: "accountName", label: "Nome da Página",        placeholder: "Minha Empresa" },
      { key: "accessToken", label: "Access Token (Meta)",   placeholder: "EAAxxxx...", type: "password",
        hint: "Token de acesso com permissão pages_manage_posts. Gerado em Meta Developers → Graph API Explorer." },
    ],
    guide: {
      warning: "Requer uma Página do Facebook — não funciona com perfis pessoais.",
      prereqs: [
        "Página do Facebook criada (não perfil pessoal)",
        "Conta Instagram Business vinculada à Página (para publicar no Instagram também)",
      ],
      steps: [
        { title: "Crie ou acesse sua Página", detail: "No Facebook → Menu → Páginas → Criar nova página. Use nome da sua empresa ou produto.", url: "https://www.facebook.com/pages/create" },
        { title: "Vincule seu Instagram Business", detail: "Na sua Página → Configurações → Instagram → conecte sua conta Instagram Business." },
        { title: "Conecte via OAuth acima", detail: "Clique em 'Entrar com Facebook' — o NexOS vai detectar automaticamente sua Página e Instagram vinculado." },
      ],
      docsUrl: "https://developers.facebook.com/docs/pages/getting-started",
      docsLabel: "Docs Facebook Pages",
    },
    oauthPlatform: "meta",
    oauthLabel: "Entrar com Facebook",
  },
  {
    provider: "tiktok",
    label: "TikTok Business",
    description: "Auto-post de vídeos e reels no TikTok sincronizados ao lançamento",
    why: "Publica vídeos gerados pelo agente no TikTok automaticamente. Essencial para lançamentos que dependem de audiência jovem e vídeos curtos.",
    category: "Social Orgânico",
    color: "text-pink-400",
    icon: Music2,
    required: false,
    fields: [
      { key: "accountId",   label: "Open ID (TikTok Account ID)", placeholder: "6912345678901234567",
        hint: "ID único da sua conta TikTok Business. Obtido via TikTok Login Kit após autorizar o app." },
      { key: "accountName", label: "Nome da Conta",               placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token",                placeholder: "act.xxxx...", type: "password",
        hint: "Token OAuth obtido após autorizar o app no TikTok Developers. Em TikTok Developers → Manage Apps → seu app → Test Users." },
    ],
    guide: {
      warning: "Requer conta TikTok Business e app aprovado no TikTok Developers.",
      prereqs: ["Conta TikTok convertida para Business", "App criado e aprovado em developers.tiktok.com"],
      steps: [
        { title: "Crie um app no TikTok Developers", detail: "Acesse developers.tiktok.com → Manage Apps → Create App → escolha Content Posting API.", url: "https://developers.tiktok.com" },
        { title: "Autorize o app na sua conta", detail: "Em seu app → Test Users → adicione sua conta TikTok Business como usuário de teste." },
        { title: "Obtenha o Access Token", detail: "Use o fluxo de autorização OAuth do TikTok ou a ferramenta de teste no painel do desenvolvedor para gerar o token." },
        { title: "Copie o Open ID", detail: "Após autorizar, o Open ID da conta fica disponível na resposta da autenticação ou no painel do app." },
      ],
      docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
      docsLabel: "Docs TikTok Content API",
    },
    oauthPlatform: "tiktok",
    oauthLabel: "Entrar com TikTok",
  },
  // ── Checkout / Payment gateways ─────────────────────────────────────────────
  {
    provider: "stripe",
    label: "Stripe",
    description: "Checkout internacional · Cartão · Pix · Recorrência · alto nível de conversão",
    why: "Stripe é o gateway mais completo para venda internacional. Suporta cartão, PIX, Apple Pay, Google Pay e assinaturas. Ideal para produtos premium e clientes no exterior.",
    category: "Checkout",
    color: "text-violet-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accessToken", label: "Secret Key", placeholder: "sk_live_xxxx...", type: "password",
        hint: "Encontrada em dashboard.stripe.com → Developers → API keys → Secret key. Use a chave de produção (sk_live_...)." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accountId",   label: "Stripe Account ID", placeholder: "acct_xxxx",
        hint: "Opcional. Usado para Stripe Connect (marketplace). Encontrado em dashboard.stripe.com → Configurações → Conta." },
    ],
    guide: {
      prereqs: ["Conta ativa no Stripe (stripe.com)", "KYC aprovado (dados bancários cadastrados)"],
      steps: [
        { title: "Crie ou acesse sua conta Stripe", detail: "Acesse dashboard.stripe.com e complete o cadastro com dados empresariais e conta bancária.", url: "https://dashboard.stripe.com" },
        { title: "Obtenha a Secret Key", detail: "No painel: Developers → API keys → Secret key. Clique em 'Reveal live key' e copie (começa com sk_live_...)." },
        { title: "Configure o webhook (opcional)", detail: "Para receber eventos de pagamento em tempo real: Developers → Webhooks → Add endpoint → cole a URL gerada pelo NexOS." },
        { title: "Cole a Secret Key aqui", detail: "Preencha o campo acima e salve. Pronto — seus checkouts processam cartão, PIX e recorrência." },
      ],
      docsUrl: "https://stripe.com/docs",
      docsLabel: "Documentação Stripe",
    },
  },
  {
    provider: "paypal",
    label: "PayPal",
    description: "Checkout internacional · aceito em 200+ países · ideal para clientes no exterior",
    why: "PayPal é o método de pagamento internacional mais reconhecido. Permite vender para clientes fora do Brasil sem fricção, com checkout de 1 clique.",
    category: "Checkout",
    color: "text-blue-500",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId",   label: "Client ID", placeholder: "AcXxxxx...",
        hint: "Encontrado em developer.paypal.com → Apps & Credentials → nome do app → Client ID. Use as credenciais de produção (Live)." },
      { key: "accessToken", label: "Client Secret", placeholder: "EJxxx...", type: "password",
        hint: "Ao lado do Client ID, clique em 'Show' ao lado do Client Secret e copie." },
      { key: "accountName", label: "Nome da Conta / Email PayPal", placeholder: "pagamentos@minhaempresa.com" },
    ],
    guide: {
      prereqs: ["Conta Business no PayPal (paypal.com/br)"],
      steps: [
        { title: "Acesse o PayPal Developer", detail: "Entre em developer.paypal.com com sua conta Business.", url: "https://developer.paypal.com" },
        { title: "Crie um App", detail: "Apps & Credentials → Create App → tipo Business. Escolha suas contas Live na seleção de sandbox/live." },
        { title: "Copie as credenciais Live", detail: "Na tela do app, mude para 'Live' (canto superior direito) → copie o Client ID e o Client Secret." },
        { title: "Cole aqui e salve", detail: "Preencha os campos acima com as credenciais de produção. Seus clientes podem pagar via PayPal em qualquer país." },
      ],
      docsUrl: "https://developer.paypal.com/docs/checkout/",
      docsLabel: "Docs PayPal Checkout",
    },
  },
  {
    provider: "mercado_pago",
    label: "Mercado Pago",
    description: "PIX · Boleto · Cartão · maior gateway da América Latina",
    why: "Mercado Pago é o gateway mais usado no Brasil e LatAm. Alta taxa de aprovação, PIX com split automático e checkout transparente nativo.",
    category: "Checkout",
    color: "text-cyan-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-xxxx...", type: "password",
        hint: "Encontrado em mercadopago.com.br → Seu negócio → Configurações → Credenciais → Credenciais de produção → Access Token." },
      { key: "accountId",   label: "Public Key", placeholder: "APP_USR-xxxx...",
        hint: "Também em Credenciais de produção → Public Key. Necessária para o checkout transparente no frontend." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Loja" },
    ],
    guide: {
      prereqs: ["Conta ativa no Mercado Pago Business", "CNPJ ou CPF validado"],
      steps: [
        { title: "Acesse as credenciais", detail: "Em mercadopago.com.br: Seu negócio → Configurações → Gestão e administração → Credenciais.", url: "https://www.mercadopago.com.br/settings/account/credentials" },
        { title: "Copie o Access Token", detail: "Na aba 'Produção': copie o Access Token (começa com APP_USR-...). Nunca compartilhe este token." },
        { title: "Copie a Public Key", detail: "Na mesma tela, copie também a Public Key. Ela é usada para o checkout transparente." },
        { title: "Configure o IPN/Webhook", detail: "Em Configurações → Notificações IPN → cole a URL do NexOS. Assim conversões são capturadas em tempo real." },
      ],
      docsUrl: "https://www.mercadopago.com.br/developers/pt/docs",
      docsLabel: "Docs Mercado Pago",
    },
  },
  {
    provider: "pagarme",
    label: "Pagar.me",
    description: "Gateway brasileiro by Stone · PIX · Boleto · Cartão · Split de pagamento",
    why: "Pagar.me (Stone) oferece split de pagamento nativo, ideal para co-produções e afiliados. Alta taxa de aprovação no Brasil com suporte a PIX, boleto e cartão.",
    category: "Checkout",
    color: "text-green-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accessToken", label: "Secret Key", placeholder: "sk_live_xxxx...", type: "password",
        hint: "Em dashboard.pagar.me → Configurações → Credenciais → Secret Key. Use a chave de produção." },
      { key: "accountId",   label: "Public Key", placeholder: "pk_live_xxxx...",
        hint: "Na mesma tela: Public Key. Usada para tokenizar cartões no frontend." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
    ],
    guide: {
      prereqs: ["Conta ativa no Pagar.me", "Conta bancária cadastrada e aprovada"],
      steps: [
        { title: "Acesse o Dashboard Pagar.me", detail: "Entre em dashboard.pagar.me com seu login.", url: "https://dashboard.pagar.me" },
        { title: "Acesse as Credenciais", detail: "Menu → Configurações → Credenciais. Selecione 'Produção' no seletor de ambiente." },
        { title: "Copie as chaves", detail: "Copie a Secret Key (sk_live_...) e a Public Key (pk_live_...). Ambas são necessárias." },
        { title: "Configure o Webhook", detail: "Em Configurações → Webhooks → adicione a URL do NexOS para receber eventos de pagamento em tempo real." },
      ],
      docsUrl: "https://docs.pagar.me",
      docsLabel: "Docs Pagar.me",
    },
  },
  {
    provider: "asaas",
    label: "Asaas",
    description: "Checkout próprio · PIX · Boleto · Cartão · sem comissão de plataforma",
    why: "Com o Asaas conectado, seus clientes pagam direto para você via PIX, boleto ou cartão. O dinheiro cai na sua conta sem intermediários.",
    category: "Checkout",
    color: "text-blue-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accessToken", label: "API Key do Asaas", placeholder: "$aact_prod_xxxx...", type: "password",
        hint: "Encontrada em Asaas → Minha Conta → Integrações → API Keys. Use a chave de produção ($aact_prod_...)." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accountId",   label: "Ambiente", placeholder: "production",
        hint: "Deixe 'production' para conta real, ou 'sandbox' para testes." },
    ],
    guide: {
      prereqs: ["Conta ativa no Asaas (crie pelo link de indicação abaixo para benefícios)"],
      steps: [
        { title: "Crie sua conta no Asaas", detail: "Acesse o link de indicação da NexOS para criar sua conta e já começar com vantagens.", url: "https://www.asaas.com/referral?referral=nexosai" },
        { title: "Acesse suas API Keys", detail: "No painel do Asaas: Menu → Minha Conta → Integrações → API Keys. Copie a chave de produção (começa com $aact_prod_...)." },
        { title: "Cole a chave aqui", detail: "Preencha o campo API Key acima com sua chave de produção e salve. Pronto — seus checkouts já cobram direto na sua conta." },
      ],
      docsUrl: "https://docs.asaas.com",
      docsLabel: "Documentação Asaas",
    },
  },
  // ── Plataformas de produto digital ─────────────────────────────────────────
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Plataforma de produtos digitais — compra converte contato automaticamente",
    why: "Quando alguém compra pelo Hotmart, o NexOS move o contato para 'convertido' em tempo real. Ideal para quem já vende na plataforma.",
    category: "Plataformas",
    color: "text-orange-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId",   label: "Client ID",     placeholder: "hotmart-client-id",
        hint: "Encontrado em Hotmart → Ferramentas → API → Credenciais → Client ID." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Hotmart Workspace" },
    ],
    guide: {
      prereqs: ["Conta ativa no Hotmart com produtos cadastrados"],
      steps: [
        { title: "Acesse as credenciais de API", detail: "No Hotmart, vá em Ferramentas → Desenvolvedores → API → Credenciais.", url: "https://app.hotmart.com/tools/developer/api-credentials" },
        { title: "Copie o Client ID", detail: "Na tela de credenciais, copie o Client ID e cole acima." },
        { title: "Configure o Webhook", detail: "Para conversões em tempo real, configure o webhook do NexOS em Hotmart → Ferramentas → Webhooks." },
      ],
      docsUrl: "https://developers.hotmart.com",
      docsLabel: "Docs Hotmart API",
    },
  },
  {
    provider: "kiwify",
    label: "Kiwify",
    description: "Plataforma de checkout e gestão de produtos — auto-conversão de leads",
    why: "Compras no Kiwify ativam automações de pós-venda no NexOS instantaneamente.",
    category: "Plataformas",
    color: "text-orange-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId",   label: "Account ID",    placeholder: "kiwify-account-id",
        hint: "ID da sua conta Kiwify. Encontrado em Kiwify → Configurações → Conta → Account ID." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Kiwify" },
      { key: "accessToken", label: "API Key",       placeholder: "kwf_xxxx...", type: "password",
        hint: "Em Kiwify → Configurações → Desenvolvedor → API Keys → gere ou copie a chave." },
    ],
    guide: {
      prereqs: ["Conta ativa no Kiwify, com ao menos um produto cadastrado"],
      steps: [
        { title: "Se ainda não tiver, crie sua conta no Kiwify", detail: "Acesse kiwify.com.br → Criar conta gratuita → cadastre seus dados e o primeiro produto.", url: "https://dashboard.kiwify.com.br" },
        { title: "Acesse as configurações da conta", detail: "Já logado, clique no seu perfil (canto superior direito) → Configurações → aba Conta." },
        { title: "Copie o Account ID", detail: "Na aba Conta, copie o número exibido em Account ID e cole no campo acima." },
        { title: "Gere uma chave de API (API Key)", detail: "Vá em Configurações → Desenvolvedor → API Keys → clique em Criar chave. Copie o código gerado (começa com 'kwf_') e cole no campo Access Token acima." },
      ],
      docsUrl: "https://docs.kiwify.com.br",
      docsLabel: "Documentação oficial (Kiwify)",
    },
  },
  {
    provider: "eduzz",
    label: "Eduzz",
    description: "Plataforma brasileira de infoprodutos — compra dispara automação em tempo real",
    why: "Com Eduzz conectado, cada venda automaticamente converte o contato no NexOS e dispara automações de pós-venda.",
    category: "Plataformas",
    color: "text-orange-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId",   label: "API Key (Public)",  placeholder: "xxxx",
        hint: "Em Eduzz: Perfil → Configurações → API → API Key Pública." },
      { key: "accessToken", label: "API Key (Private)", placeholder: "xxxx...", type: "password",
        hint: "Na mesma tela: API Key Privada. Necessária para autenticação." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Conta Eduzz" },
    ],
    guide: {
      prereqs: ["Conta ativa no Eduzz com produtos cadastrados"],
      steps: [
        { title: "Acesse as configurações de API", detail: "Em eduzz.com: Menu → Perfil → Configurações → aba API.", url: "https://eduzz.com" },
        { title: "Copie as API Keys", detail: "Copie a API Key Pública e a API Key Privada exibidas na tela." },
        { title: "Configure o Postback", detail: "Em Eduzz → Meus Produtos → Postback → adicione a URL do NexOS para receber notificações de venda." },
      ],
      docsUrl: "https://docs.eduzz.com",
      docsLabel: "Docs Eduzz API",
    },
  },
  {
    provider: "meta_ads",
    label: "Meta Ads",
    description: "Facebook e Instagram Ads — remarketing automático",
    why: "Remarketing automático para leads que não converteram. O agente Media Buyer otimiza os anúncios durante o lançamento.",
    category: "Mídia Paga",
    color: "text-cyan-400",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId",   label: "Ad Account ID", placeholder: "act_123456789",
        hint: "Formato: act_XXXXXXXXX. Encontrado em Facebook Ads Manager → canto superior esquerdo → nome da conta." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Conta Ads" },
      { key: "accessToken", label: "Access Token",  placeholder: "EAAxxxx...", type: "password",
        hint: "Token de acesso com permissão ads_management. Gerado em Meta Business Suite → Usuários do Sistema → Gerar token." },
    ],
    guide: {
      prereqs: [
        "Uma conta de anúncios ativa no Meta Ads Manager, com um cartão ou forma de pagamento cadastrada",
        "Acesso de administrador ao Meta Business Suite (o painel de gestão da sua empresa no Facebook/Instagram)",
      ],
      steps: [
        { title: "Se ainda não tiver, crie sua conta de anúncios", detail: "Acesse business.facebook.com → Contas → Contas de anúncios → Adicionar. Cadastre os dados da sua empresa e uma forma de pagamento.", url: "https://business.facebook.com/settings/accounts" },
        { title: "Encontre o Ad Account ID", detail: "Abra o Gerenciador de Anúncios — o número aparece no canto superior esquerdo, ao lado do nome da conta. Formato: act_XXXXXXXXX. Copie e cole no campo acima.", url: "https://www.facebook.com/adsmanager" },
        { title: "Crie um 'Usuário do Sistema' (uma conta técnica de acesso)", detail: "Em Meta Business Suite → Configurações → Usuários do Sistema → Adicionar. É uma conta especial só para permitir que o NexOS publique anúncios em seu nome — defina como Administrador.", url: "https://business.facebook.com/settings/system-users" },
        { title: "Gere o código de acesso (Access Token)", detail: "Ainda na tela do usuário do sistema, clique em 'Gerar novo token' → selecione seu App → marque as permissões 'ads_management' e 'ads_read' → clique em Gerar. Copie o código gerado e cole no campo acima." },
      ],
      docsUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
      docsLabel: "Documentação oficial (Meta Marketing API)",
    },
    oauthPlatform: "meta",
    oauthLabel: "Entrar com Meta Ads",
  },
  {
    provider: "tiktok_ads",
    label: "TikTok Ads",
    description: "Anúncios pagos no TikTok sincronizados ao lançamento",
    why: "O agente Media Buyer gerencia campanhas pagas no TikTok, otimizando automaticamente durante o lançamento.",
    category: "Mídia Paga",
    color: "text-pink-400",
    icon: Music2,
    required: false,
    fields: [
      { key: "accountId",   label: "Advertiser ID", placeholder: "6912345678901234567",
        hint: "ID do anunciante no TikTok Ads Manager. Encontrado em TikTok Ads → canto superior direito → nome da conta → ID." },
      { key: "accountName", label: "Nome da Conta", placeholder: "TikTok Ads" },
      { key: "accessToken", label: "Access Token",  placeholder: "act.xxxx...", type: "password",
        hint: "Código de acesso de longa duração ('Long-Term Access Token'), gerado em TikTok for Developers → Marketing API → Authentication." },
    ],
    guide: {
      warning: "O acesso à Marketing API do TikTok passa por uma aprovação manual da própria TikTok e pode levar de 1 a 5 dias úteis. Comece esse cadastro com antecedência ao lançamento.",
      prereqs: [
        "Uma conta comercial gratuita no TikTok for Business",
        "Uma conta de anúncios ativa no TikTok Ads Manager, com forma de pagamento cadastrada",
        "Um app aprovado no TikTok for Developers com acesso liberado à Marketing API",
      ],
      steps: [
        { title: "Crie sua conta comercial no TikTok", detail: "Se ainda não tiver, acesse business.tiktok.com e crie uma conta TikTok for Business — é gratuito e leva poucos minutos.", url: "https://business.tiktok.com" },
        { title: "Crie sua conta de anúncios no Ads Manager", detail: "Acesse ads.tiktok.com → Criar conta → preencha os dados da sua empresa e cadastre um cartão ou outra forma de pagamento.", url: "https://ads.tiktok.com" },
        { title: "Encontre o Advertiser ID", detail: "Já dentro do Ads Manager, clique no nome da sua conta no canto superior direito. O número que aparece embaixo do nome é o Advertiser ID — copie e cole no campo acima." },
        { title: "Cadastre-se no TikTok for Developers", detail: "Acesse developers.tiktok.com e crie uma conta de desenvolvedor — pode usar o mesmo login da sua conta TikTok.", url: "https://developers.tiktok.com" },
        { title: "Crie um app e peça acesso à Marketing API", detail: "No painel, vá em 'Manage apps' → 'Create an app', e escolha o produto 'Marketing API'. Preencha as informações pedidas sobre sua empresa/uso e envie para aprovação da TikTok." },
        { title: "Gere o Access Token", detail: "Depois que o app for aprovado (você recebe um e-mail da TikTok), volte em Marketing API → Authentication e gere um 'Long-Term Access Token' vinculado à sua conta de anúncios. Copie esse código e cole no campo acima." },
      ],
      docsUrl: "https://ads.tiktok.com/marketing_api/docs",
      docsLabel: "Documentação oficial (TikTok Marketing API)",
    },
    oauthPlatform: "tiktok",
    oauthLabel: "Entrar com TikTok",
  },
  {
    provider: "google_ads",
    oauthPlatform: "google",
    oauthLabel: "Entrar com Google",
    label: "Google Ads",
    description: "Campanhas de pesquisa e display no Google",
    why: "Captura de leads via pesquisa durante o lançamento, gerenciada pelo agente Media Buyer.",
    category: "Mídia Paga",
    color: "text-cyan-400",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId",   label: "Customer ID",     placeholder: "123-456-7890",
        hint: "ID de 10 dígitos no formato XXX-XXX-XXXX. Aparece no canto superior direito do Google Ads ao lado do nome da conta." },
      { key: "accountName", label: "Nome da Conta",   placeholder: "Google Ads" },
      { key: "accessToken", label: "Developer Token", placeholder: "xxxx...", type: "password",
        hint: "Token de desenvolvedor obtido em Google Ads API Center (google.com/apis/ads/developer). Requer aprovação do Google." },
    ],
    guide: {
      warning: "O Developer Token do Google Ads passa por revisão manual do Google e pode levar alguns dias para ser liberado no nível de acesso completo — comece esse cadastro com antecedência ao lançamento.",
      prereqs: [
        "Uma conta ativa no Google Ads, com forma de pagamento cadastrada",
        "Um Developer Token (código de acesso de desenvolvedor) aprovado pelo Google",
      ],
      steps: [
        { title: "Se ainda não tiver, crie sua conta no Google Ads", detail: "Acesse ads.google.com → Nova conta → siga o assistente, informando sua empresa/produto e um cartão de pagamento.", url: "https://ads.google.com/aw/campaigns/new" },
        { title: "Encontre o Customer ID", detail: "No topo do Google Ads, o ID de 10 dígitos fica no canto superior direito, ao lado do nome da conta. Formato: XXX-XXX-XXXX. Copie e cole no campo acima.", url: "https://ads.google.com" },
        { title: "Solicite o Developer Token", detail: "Vá em Ferramentas e configurações → Configuração → API Center. Preencha o formulário explicando o uso (automação de campanhas de lançamento) e envie para aprovação do Google.", url: "https://ads.google.com/aw/apicenter" },
        { title: "Aguarde a aprovação e copie o código", detail: "O Google avisa por e-mail quando aprovar. Depois de aprovado, volte no API Center, copie o Developer Token e cole no campo acima." },
      ],
      docsUrl: "https://developers.google.com/google-ads/api/docs/get-started/introduction",
      docsLabel: "Documentação oficial (Google Ads API)",
    },
  },
  {
    provider: "hubspot",
    label: "HubSpot",
    description: "CRM e pipeline de vendas integrado com campanhas",
    why: "CRM completo integrado — leads das campanhas entram automaticamente no pipeline de vendas.",
    category: "CRM",
    color: "text-orange-300",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId",   label: "Portal ID",           placeholder: "12345678",
        hint: "ID numérico do seu portal HubSpot. Aparece no canto superior direito do HubSpot, ao lado do nome da conta." },
      { key: "accountName", label: "Nome da Conta",        placeholder: "HubSpot CRM" },
      { key: "accessToken", label: "Private App Token",    placeholder: "pat-xxxx...", type: "password",
        hint: "Token de app privado criado em HubSpot → Configurações → Integrações → Apps Privados → Criar app privado." },
    ],
    guide: {
      prereqs: ["Conta ativa no HubSpot (plano gratuito ou pago)"],
      steps: [
        { title: "Encontre o Portal ID", detail: "No HubSpot, clique no nome da conta no canto superior direito. O Portal ID numérico aparece abaixo.", url: "https://app.hubspot.com" },
        { title: "Crie um App Privado", detail: "Em HubSpot → Configurações → Integrações → Apps Privados → Criar app privado." },
        { title: "Defina as permissões", detail: "Marque os escopos: crm.objects.contacts.write, crm.objects.deals.write, crm.lists.write." },
        { title: "Copie o token gerado", detail: "Após criar o app, copie o token que começa com 'pat-'. Ele só é exibido uma vez." },
      ],
      docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
      docsLabel: "Docs HubSpot Private Apps",
    },
    oauthPlatform: "hubspot",
    oauthLabel: "Entrar com HubSpot",
  },


  {
    provider: "linkedin_ads",
    label: "LinkedIn Ads",
    description: "Anúncios B2B no LinkedIn para produtos de alto ticket e infoprodutos empresariais",
    why: "Alcança decisores e profissionais de alta renda. Ideal para produtos B2B, cursos corporativos e infoprodutos premium acima de R$2.000.",
    category: "Mídia Paga",
    color: "text-blue-500",
    icon: LinkedInLogo,
    required: false,
    fields: [
      { key: "accountId",   label: "Ad Account ID", placeholder: "urn:li:sponsoredAccount:123456789",
        hint: "ID da conta de anúncios. No Campaign Manager → nome da conta → 'Ver conta'. Formato: urn:li:sponsoredAccount:XXXXXXXXX." },
      { key: "accountName", label: "Nome da Conta", placeholder: "LinkedIn Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "AQV...", type: "password",
        hint: "Token gerado no LinkedIn Developer Portal → seu app → Auth → OAuth 2.0 tools → Request access token." },
    ],
    guide: {
      prereqs: ["Conta pessoal no LinkedIn", "Conta de anúncios criada no Campaign Manager"],
      steps: [
        { title: "Crie sua conta de anúncios", detail: "Em linkedin.com/campaignmanager → criar conta. Adicione método de pagamento.", url: "https://www.linkedin.com/campaignmanager" },
        { title: "Crie um app no Developer Portal", detail: "Em developer.linkedin.com → Create App. Use o nome NexOS ou seu produto.", url: "https://developer.linkedin.com/apps" },
        { title: "Solicite acesso à Marketing API", detail: "No seu app → Products → clique em 'Request access' ao lado de 'Marketing Developer Platform'. O LinkedIn aprova em 1–3 dias úteis." },
        { title: "Conecte via OAuth acima", detail: "Após aprovação, clique em 'Entrar com LinkedIn' e autorize os escopos de anúncios." },
      ],
      docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
      docsLabel: "Docs LinkedIn Marketing API",
    },
    oauthPlatform: "linkedin",
    oauthLabel: "Entrar com LinkedIn",
  },
];

export const INTEGRATION_CATEGORIES = ["Mensagens", "E-mail", "Social Orgânico", "Checkout", "Plataformas", "Mídia Paga", "CRM"];

// ── ConnectModal ───────────────────────────────────────────────────────────────
export function ConnectModal({
  entry, onClose, onConnect, onOAuthSuccess,
}: {
  entry: CatalogEntry;
  onClose: () => void;
  onConnect: (provider: Provider, fields: Record<string, string>) => void;
  onOAuthSuccess: () => void;
}) {
  const t = useUiText();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const { guide } = entry;
  const localizedLabels: Partial<Record<Provider, string>> = {
    whatsapp_business: "WhatsApp Business", telegram: "Telegram", rd_station: "RD Station",
    activecampaign: "ActiveCampaign", resend: "Resend", stripe: "Stripe", paypal: "PayPal",
    mercado_pago: "Mercado Pago", pagarme: "Pagar.me", asaas: "Asaas", hotmart: "Hotmart",
    kiwify: "Kiwify", eduzz: "Eduzz", meta_ads: "Meta Ads", google_ads: "Google Ads",
    tiktok_ads: "TikTok Ads", linkedin_ads: "LinkedIn Ads", instagram: "Instagram Business",
    facebook: t("Facebook (Páginas)", "Facebook (Pages)", "Facebook (Páginas)"),
    tiktok: "TikTok", hubspot: "HubSpot", heygen: "HeyGen", runway_ml: "Runway",
    kling_fal: "Kling", elevenlabs: "ElevenLabs",
  };
  const localizedLabel = localizedLabels[entry.provider] ?? entry.label;
  const localizedCatalogCopy: Partial<Record<Provider, { description: [string, string]; why: [string, string]; warning?: [string, string] }>> = {
    whatsapp_business: { description: ["Automated message delivery and agent-powered replies during your launch", "Envío automatizado de mensajes y respuestas del agente durante tu lanzamiento"], why: ["Required to send message sequences during your launch. Without it, NexOS can’t run a complete campaign.", "Es necesario para enviar secuencias de mensajes durante el lanzamiento. Sin esto, NexOS no puede ejecutar una campaña completa."], warning: ["Requires WhatsApp Business API — it doesn’t work with the regular WhatsApp or WhatsApp Business app.", "Requiere WhatsApp Business API; no funciona con WhatsApp normal ni con la aplicación WhatsApp Business."] },
    telegram: { description: ["Automation and notification bot through Telegram", "Bot de automatización y notificaciones por Telegram"], why: ["An alternative to WhatsApp for automatically sending messages and launch notifications.", "Una alternativa a WhatsApp para enviar mensajes y notificaciones del lanzamiento automáticamente."] },
    rd_station: { description: ["Email marketing and lead automation integrated with your launch", "Marketing por correo y automatización de leads integrados con tu lanzamiento"], why: ["Required to send your launch email sequence. Connect RD Station, ActiveCampaign, or Resend.", "Es necesario para enviar la secuencia de correos del lanzamiento. Conecta RD Station, ActiveCampaign o Resend."] },
    activecampaign: { description: ["CRM and email automation with advanced segmentation", "CRM y automatización de correo con segmentación avanzada"], why: ["An alternative to RD Station with integrated CRM and behavioural automations.", "Una alternativa a RD Station con CRM y automatizaciones de comportamiento integradas."] },
    resend: { description: ["Highly deliverable transactional email — the simplest option", "Correo transaccional con alta entregabilidad: la opción más sencilla"], why: ["The simplest option for sending email. Just use a Resend API Key — no complex setup required.", "La opción más sencilla para enviar correos. Solo necesitas la API Key de Resend, sin una configuración compleja."] },
    instagram: { description: ["Organic content auto-posting synced with your calendar", "Publicación automática de contenido orgánico sincronizada con tu calendario"], why: ["Automatically publishes agent-generated posts, stories, and reels at the right times during your launch.", "Publica automáticamente las publicaciones, historias y reels creados por el agente en los momentos adecuados del lanzamiento."], warning: ["Requires an Instagram Business or Creator account — personal profiles aren’t supported.", "Requiere una cuenta de Instagram Business o Creator; no admite perfiles personales."] },
    facebook: { description: ["Organic auto-posting to Facebook Pages, synced with your launch", "Publicación automática de contenido orgánico en páginas de Facebook, sincronizada con tu lanzamiento"], why: ["Automatically publishes to Facebook during your launch. Required if you have an organic Facebook audience.", "Publica automáticamente en Facebook durante el lanzamiento. Es necesario si tienes una audiencia orgánica en Facebook."], warning: ["Requires a Facebook Page — personal profiles aren’t supported.", "Requiere una página de Facebook; no admite perfiles personales."] },
    tiktok: { description: ["Auto-post videos and reels to TikTok, synced with your launch", "Publicación automática de videos y reels en TikTok, sincronizada con tu lanzamiento"], why: ["Automatically publishes agent-generated videos on TikTok. Essential for launches focused on younger audiences and short-form video.", "Publica automáticamente en TikTok los videos creados por el agente. Es esencial para lanzamientos dirigidos a audiencias jóvenes y a videos cortos."], warning: ["Requires a TikTok Business account and an app approved by TikTok Developers.", "Requiere una cuenta de TikTok Business y una app aprobada por TikTok Developers."] },
    stripe: { description: ["International checkout · Cards · Pix · Recurring payments · high conversion", "Checkout internacional · Tarjetas · Pix · Pagos recurrentes · alta conversión"], why: ["Stripe is a comprehensive gateway for international sales. It supports cards, Pix, Apple Pay, Google Pay, and subscriptions. Ideal for premium products and customers abroad.", "Stripe es una pasarela completa para ventas internacionales. Admite tarjetas, Pix, Apple Pay, Google Pay y suscripciones. Ideal para productos premium y clientes en el extranjero."] },
    paypal: { description: ["International checkout · accepted in 200+ countries · ideal for overseas customers", "Checkout internacional · aceptado en más de 200 países · ideal para clientes en el extranjero"], why: ["PayPal is the most recognised international payment method. Sell to customers outside Brazil with a frictionless, one-click checkout.", "PayPal es el método de pago internacional más reconocido. Vende a clientes fuera de Brasil con un checkout sencillo de un clic."] },
    mercado_pago: { description: ["Pix · Bank slip · Card · Latin America’s largest gateway", "Pix · Boleta · Tarjeta · la mayor pasarela de América Latina"], why: ["Mercado Pago is the most widely used gateway in Brazil and Latin America. It offers high approval rates, automatic Pix splits, and native transparent checkout.", "Mercado Pago es la pasarela más utilizada en Brasil y Latinoamérica. Ofrece una alta tasa de aprobación, división automática de Pix y checkout transparente nativo."] },
    pagarme: { description: ["Brazilian gateway by Stone · Pix · Bank slip · Card · payment splitting", "Pasarela brasileña de Stone · Pix · Boleta · Tarjeta · división de pagos"], why: ["Pagar.me (Stone) offers native payment splitting, ideal for co-productions and affiliates. High approval rates in Brazil with Pix, bank slip, and card support.", "Pagar.me (Stone) ofrece división de pagos nativa, ideal para coproducciones y afiliados. Alta aprobación en Brasil con Pix, boleta y tarjetas."] },
    asaas: { description: ["Your own checkout · Pix · Bank slip · Card · no platform commission", "Checkout propio · Pix · Boleta · Tarjeta · sin comisión de plataforma"], why: ["With Asaas connected, customers pay you directly by Pix, bank slip, or card. Funds go to your account without intermediaries.", "Con Asaas conectado, tus clientes te pagan directamente por Pix, boleta o tarjeta. El dinero llega a tu cuenta sin intermediarios."] },
    hotmart: { description: ["Digital product platform — purchases automatically convert contacts", "Plataforma de productos digitales: las compras convierten contactos automáticamente"], why: ["When someone buys through Hotmart, NexOS moves the contact to ‘converted’ in real time. Ideal if you already sell on the platform.", "Cuando alguien compra en Hotmart, NexOS cambia el contacto a «convertido» en tiempo real. Ideal si ya vendes en la plataforma."] },
    kiwify: { description: ["Checkout and product management platform — automatic lead conversion", "Plataforma de checkout y gestión de productos: conversión automática de leads"], why: ["Kiwify purchases instantly trigger NexOS post-sale automations.", "Las compras en Kiwify activan al instante las automatizaciones posventa de NexOS."] },
    eduzz: { description: ["Brazilian digital product platform — purchases trigger real-time automation", "Plataforma brasileña de productos digitales: las compras activan automatizaciones en tiempo real"], why: ["With Eduzz connected, every sale automatically converts the contact in NexOS and triggers post-sale automations.", "Con Eduzz conectado, cada venta convierte automáticamente el contacto en NexOS y activa automatizaciones posventa."] },
    meta_ads: { description: ["Facebook and Instagram Ads — automatic remarketing", "Facebook e Instagram Ads: remarketing automático"], why: ["Automatically remarket to leads who haven’t converted. The Media Buyer agent optimises ads during your launch.", "Haz remarketing automático a los leads que aún no han convertido. El agente Media Buyer optimiza los anuncios durante el lanzamiento."] },
    tiktok_ads: { description: ["TikTok paid ads synced with your launch", "Anuncios pagos de TikTok sincronizados con tu lanzamiento"], why: ["The Media Buyer agent manages TikTok paid campaigns, automatically optimising them throughout your launch.", "El agente Media Buyer gestiona campañas pagas de TikTok y las optimiza automáticamente durante el lanzamiento."], warning: ["TikTok Marketing API access requires manual approval and may take 1–5 business days. Start the application early.", "El acceso a TikTok Marketing API requiere aprobación manual y puede tardar entre 1 y 5 días hábiles. Solicítalo con anticipación."] },
    google_ads: { description: ["Google search and display campaigns", "Campañas de búsqueda y display de Google"], why: ["Captures leads through search during your launch, managed by the Media Buyer agent.", "Capta leads mediante búsquedas durante el lanzamiento, con la gestión del agente Media Buyer."], warning: ["Google Ads Developer Tokens require a manual review and may take several days to unlock full access. Start the application early.", "Los Developer Tokens de Google Ads requieren revisión manual y pueden tardar varios días en obtener acceso completo. Solicítalo con anticipación."] },
    hubspot: { description: ["CRM and sales pipeline integrated with campaigns", "CRM y pipeline de ventas integrados con campañas"], why: ["A complete integrated CRM — campaign leads automatically enter your sales pipeline.", "Un CRM completo e integrado: los leads de las campañas entran automáticamente en tu pipeline de ventas."] },
    linkedin_ads: { description: ["B2B LinkedIn ads for high-ticket products and business information products", "Anuncios B2B en LinkedIn para productos de alto valor y productos empresariales"], why: ["Reach decision-makers and high-income professionals. Ideal for B2B products, corporate courses, and premium products over R$2,000.", "Llega a responsables de decisiones y profesionales de altos ingresos. Ideal para productos B2B, cursos corporativos y productos premium de más de R$2.000."] },
  };
  const catalogCopy = localizedCatalogCopy[entry.provider];
  const catalogFieldHints: Partial<Record<Provider, Partial<Record<string, [string, string]>>>> = {
    whatsapp_business: {
      accountId: ["This is not the phone number itself — it’s the 15-digit numeric ID in Meta Business Suite → WhatsApp → Phone Numbers.", "No es el número de teléfono; es el ID numérico de 15 dígitos que está en Meta Business Suite → WhatsApp → Números de teléfono."],
      accessToken: ["Permanent access token from Meta Developers → Your App → WhatsApp → API Setup → Generate Token.", "Token de acceso permanente de Meta Developers → Tu app → WhatsApp → Configuración de la API → Generate Token."],
    },
    telegram: { accountId: ["Generated by @BotFather on Telegram. Format: 1234567890:AAFxxxxxxxxxx", "Generado por @BotFather en Telegram. Formato: 1234567890:AAFxxxxxxxxxx"] },
    rd_station: {
      accountId: ["Find it in RD Station → Settings → Integrations → Public API → Client ID.", "Lo encuentras en RD Station → Configuración → Integraciones → API pública → Client ID."],
      accessToken: ["Private API token in RD Station → Settings → Integrations → Public API.", "Token privado de API en RD Station → Configuración → Integraciones → API pública."],
    },
    activecampaign: {
      accountId: ["This is your account subdomain. If you visit minhaempresa.activehosted.com, the Account Name is ‘minhaempresa’.", "Es el subdominio de tu cuenta. Si accedes a minhaempresa.activehosted.com, el Account Name es «minhaempresa»."],
      accessToken: ["ActiveCampaign → Settings → Developer → API Access → API Key.", "ActiveCampaign → Settings → Developer → API Access → API Key."],
    },
    resend: {
      accountId: ["UUID of your Resend Audience. Find it in Resend → Audiences → select the audience → copy the ID.", "UUID de tu Audience de Resend. Ve a Resend → Audiences → selecciona la audiencia → copia el ID."],
      accessToken: ["Create it in Resend → API Keys → Create API Key. It starts with ‘re_’.", "Créala en Resend → API Keys → Create API Key. Empieza con «re_»."],
    },
    instagram: {
      accountId: ["Numeric ID of your Instagram Business account. Find it in Meta Business Suite → Instagram → Accounts → select the account → copy the ID.", "ID numérico de tu cuenta Instagram Business. Está en Meta Business Suite → Instagram → Cuentas → selecciona la cuenta → copia el ID."],
      accessToken: ["Access token with instagram_basic and instagram_content_publish permissions. Generate it in Meta Developers → Graph API Explorer.", "Token de acceso con los permisos instagram_basic e instagram_content_publish. Genéralo en Meta Developers → Graph API Explorer."],
    },
    facebook: {
      accountId: ["Numeric ID of your Facebook Page. Find it in Page Settings → Page Information → Page ID.", "ID numérico de tu página de Facebook. Está en Configuración de la página → Información de la página → ID de la página."],
      accessToken: ["Access token with pages_manage_posts permission. Generate it in Meta Developers → Graph API Explorer.", "Token de acceso con el permiso pages_manage_posts. Genéralo en Meta Developers → Graph API Explorer."],
    },
    tiktok: {
      accountId: ["Unique ID of your TikTok Business account. Get it through TikTok Login Kit after authorising the app.", "ID único de tu cuenta TikTok Business. Se obtiene mediante TikTok Login Kit después de autorizar la app."],
      accessToken: ["OAuth token obtained after authorising the app in TikTok Developers → Manage Apps → your app → Test Users.", "Token OAuth obtenido al autorizar la app en TikTok Developers → Manage Apps → tu app → Test Users."],
    },
    stripe: {
      accessToken: ["Find it in dashboard.stripe.com → Developers → API keys → Secret key. Use the live key (sk_live_...).", "Está en dashboard.stripe.com → Developers → API keys → Secret key. Usa la clave de producción (sk_live_...)."],
      accountId: ["Optional. Used for Stripe Connect (marketplace). Find it in dashboard.stripe.com → Settings → Account.", "Opcional. Se usa para Stripe Connect (marketplace). Está en dashboard.stripe.com → Settings → Account."],
    },
    paypal: {
      accountId: ["Find it at developer.paypal.com → Apps & Credentials → app name → Client ID. Use Live credentials.", "Está en developer.paypal.com → Apps & Credentials → nombre de la app → Client ID. Usa las credenciales Live."],
      accessToken: ["Next to Client ID, click ‘Show’ beside Client Secret and copy it.", "Junto a Client ID, haz clic en «Show» al lado de Client Secret y cópialo."],
    },
    mercado_pago: {
      accessToken: ["Find it at mercadopago.com.br → Your business → Settings → Credentials → Production credentials → Access Token.", "Está en mercadopago.com.br → Tu negocio → Configuración → Credenciales → Credenciales de producción → Access Token."],
      accountId: ["Also in Production credentials → Public Key. Required for transparent checkout on the frontend.", "También está en Credenciales de producción → Public Key. Se necesita para el checkout transparente en el frontend."],
    },
    pagarme: {
      accessToken: ["In dashboard.pagar.me → Settings → Credentials → Secret Key. Use the live key.", "En dashboard.pagar.me → Configuración → Credenciales → Secret Key. Usa la clave de producción."],
      accountId: ["On the same page: Public Key. Used to tokenise cards on the frontend.", "En la misma página: Public Key. Se usa para tokenizar tarjetas en el frontend."],
    },
    asaas: {
      accessToken: ["Find it in Asaas → My Account → Integrations → API Keys. Use the live key ($aact_prod_...).", "Está en Asaas → Mi cuenta → Integraciones → API Keys. Usa la clave de producción ($aact_prod_...)."],
      accountId: ["Leave ‘production’ for a live account, or use ‘sandbox’ for testing.", "Deja «production» para una cuenta real o usa «sandbox» para pruebas."],
    },
    hotmart: { accountId: ["Find it in Hotmart → Tools → API → Credentials → Client ID.", "Está en Hotmart → Herramientas → API → Credenciales → Client ID."] },
    kiwify: {
      accountId: ["Your Kiwify account ID. Find it in Kiwify → Settings → Account → Account ID.", "ID de tu cuenta Kiwify. Está en Kiwify → Configuración → Cuenta → Account ID."],
      accessToken: ["In Kiwify → Settings → Developer → API Keys → generate or copy the key.", "En Kiwify → Configuración → Developer → API Keys → genera o copia la clave."],
    },
    eduzz: {
      accountId: ["In Eduzz: Profile → Settings → API → Public API Key.", "En Eduzz: Perfil → Configuración → API → API Key pública."],
      accessToken: ["On the same page: Private API Key. Required for authentication.", "En la misma página: API Key privada. Se necesita para la autenticación."],
    },
    meta_ads: {
      accountId: ["Format: act_XXXXXXXXX. Find it in Facebook Ads Manager → top-left corner → account name.", "Formato: act_XXXXXXXXX. Está en Facebook Ads Manager → esquina superior izquierda → nombre de la cuenta."],
      accessToken: ["Access token with ads_management permission. Generate it in Meta Business Suite → System Users → Generate token.", "Token de acceso con el permiso ads_management. Genéralo en Meta Business Suite → Usuarios del sistema → Generar token."],
    },
    tiktok_ads: {
      accountId: ["Advertiser ID in TikTok Ads Manager. Find it in TikTok Ads → top-right corner → account name → ID.", "Advertiser ID en TikTok Ads Manager. Está en TikTok Ads → esquina superior derecha → nombre de la cuenta → ID."],
      accessToken: ["Long-Term Access Token generated in TikTok for Developers → Marketing API → Authentication.", "Long-Term Access Token generado en TikTok for Developers → Marketing API → Authentication."],
    },
    google_ads: {
      accountId: ["10-digit ID in XXX-XXX-XXXX format. It appears at the top-right of Google Ads beside the account name.", "ID de 10 dígitos con formato XXX-XXX-XXXX. Aparece arriba a la derecha en Google Ads, junto al nombre de la cuenta."],
      accessToken: ["Developer token from Google Ads API Center (google.com/apis/ads/developer). Google approval is required.", "Developer token de Google Ads API Center (google.com/apis/ads/developer). Requiere aprobación de Google."],
    },
    hubspot: {
      accountId: ["Numeric ID of your HubSpot portal. It appears at the top-right of HubSpot beside the account name.", "ID numérico de tu portal HubSpot. Aparece arriba a la derecha en HubSpot, junto al nombre de la cuenta."],
      accessToken: ["Private app token created in HubSpot → Settings → Integrations → Private Apps → Create private app.", "Token de app privada creado en HubSpot → Configuración → Integraciones → Apps privadas → Crear app privada."],
    },
    linkedin_ads: {
      accountId: ["Ads account ID. In Campaign Manager → account name → ‘View account’. Format: urn:li:sponsoredAccount:XXXXXXXXX.", "ID de la cuenta publicitaria. En Campaign Manager → nombre de la cuenta → «Ver cuenta». Formato: urn:li:sponsoredAccount:XXXXXXXXX."],
      accessToken: ["Token generated in LinkedIn Developer Portal → your app → Auth → OAuth 2.0 tools → Request access token.", "Token generado en LinkedIn Developer Portal → tu app → Auth → OAuth 2.0 tools → Request access token."],
    },
  };
  const localizeCatalogText = (source: string, key: "description" | "why" | "warning") => {
    const translations = catalogCopy?.[key];
    return translations
      ? t(source, translations[0], translations[1])
      : t(source, "[Catalog translation missing]", "[Falta traducción del catálogo]");
  };
  const commonGuideTranslations: Record<string, [string, string]> = {
    "Vá em business.facebook.com → Configurações → WhatsApp.": ["Go to business.facebook.com → Settings → WhatsApp.", "Ve a business.facebook.com → Configuración → WhatsApp."],
    "No menu WhatsApp → Números de Telefone. Clique no número → copie o campo 'Phone Number ID' (não é o número de telefone).": ["In the WhatsApp menu → Phone Numbers, click the number and copy the ‘Phone Number ID’ field (not the phone number itself).", "En el menú WhatsApp → Números de teléfono, haz clic en el número y copia el campo «Phone Number ID» (no es el número de teléfono)."],
    "Acesse developers.facebook.com → Meus Apps → Criar App → escolha 'Business'.": ["Go to developers.facebook.com → My Apps → Create App → choose ‘Business’.", "Ve a developers.facebook.com → My Apps → Create App → elige «Business»."],
    "No painel do app → Adicionar produto → WhatsApp → Configurar. Associe sua conta do Meta Business.": ["In the app dashboard → Add product → WhatsApp → Set up. Link your Meta Business account.", "En el panel de la app → Añadir producto → WhatsApp → Configurar. Vincula tu cuenta de Meta Business."],
    "Em WhatsApp → Configuração da API → clique em 'Generate Token'. Copie o token permanente (começa com EAA...).": ["In WhatsApp → API Setup, click ‘Generate Token’. Copy the permanent token (it starts with EAA...).", "En WhatsApp → Configuración de la API, haz clic en «Generate Token». Copia el token permanente (empieza con EAA...)."],
    "No Telegram, pesquise por @BotFather e inicie a conversa.": ["In Telegram, search for @BotFather and start a conversation.", "En Telegram, busca @BotFather e inicia la conversación."],
    "Digite /newbot e siga as instruções. Escolha um nome e um username (deve terminar em 'bot').": ["Type /newbot and follow the instructions. Choose a name and username (it must end in ‘bot’).", "Escribe /newbot y sigue las instrucciones. Elige un nombre y un username (debe terminar en «bot»)."],
    "O BotFather vai te enviar um token no formato: 1234567890:AAFxxxxxxxxxx. Cole aqui.": ["BotFather will send you a token in this format: 1234567890:AAFxxxxxxxxxx. Paste it here.", "BotFather te enviará un token con este formato: 1234567890:AAFxxxxxxxxxx. Pégalo aquí."],
    "Vá em Configurações → Integrações → API Pública.": ["Go to Settings → Integrations → Public API.", "Ve a Configuración → Integraciones → API pública."],
    "Na seção API Pública, você verá o Client ID. Copie e cole no campo acima.": ["You’ll find the Client ID in the Public API section. Copy it and paste it in the field above.", "Encontrarás el Client ID en la sección API pública. Cópialo y pégalo en el campo de arriba."],
    "Na mesma tela, clique em 'Gerar Token' se não houver um. Copie o token gerado.": ["On the same page, click ‘Generate Token’ if one isn’t available. Copy the generated token.", "En la misma página, haz clic en «Generar token» si aún no hay uno. Copia el token generado."],
    "No ActiveCampaign, vá em Settings (engrenagem) → Developer.": ["In ActiveCampaign, go to Settings (gear icon) → Developer.", "En ActiveCampaign, ve a Settings (icono de engranaje) → Developer."],
    "Na seção API Access, você verá a URL base. Ex: https://minhaempresa.api-us1.com — o Account Name é 'minhaempresa'.": ["In API Access, you’ll find the base URL. Example: https://minhaempresa.api-us1.com — the Account Name is ‘minhaempresa’.", "En API Access encontrarás la URL base. Ejemplo: https://minhaempresa.api-us1.com; el Account Name es «minhaempresa»."],
    "Na mesma tela, copie a API Key. Nunca compartilhe essa chave.": ["Copy the API Key on the same page. Never share this key.", "Copia la API Key en la misma página. Nunca compartas esta clave."],
    "Acesse resend.com e crie sua conta gratuitamente.": ["Go to resend.com and create a free account.", "Ve a resend.com y crea una cuenta gratis."],
    "Em Resend → Domains → Add Domain. Adicione os registros DNS indicados no seu provedor de domínio.": ["In Resend → Domains → Add Domain, add the DNS records provided to your domain provider.", "En Resend → Domains → Add Domain, añade los registros DNS indicados en tu proveedor de dominios."],
    "Em Resend → API Keys → Create API Key. Dê um nome descritivo e copie a chave gerada (começa com 're_').": ["In Resend → API Keys → Create API Key, enter a descriptive name and copy the generated key (it starts with ‘re_’).", "En Resend → API Keys → Create API Key, asigna un nombre descriptivo y copia la clave generada (empieza con «re_»)."],
    "Em Resend → Audiences → clique na sua audience → copie o UUID. Necessário apenas para broadcasts.": ["In Resend → Audiences, select your audience and copy its UUID. Only required for broadcasts.", "En Resend → Audiences, selecciona tu audiencia y copia el UUID. Solo es necesario para envíos masivos."],
    "No Instagram → Configurações → Conta → Mudar para conta profissional → Empresa.": ["In Instagram → Settings → Account → Switch to professional account → Business.", "En Instagram → Configuración → Cuenta → Cambiar a cuenta profesional → Empresa."],
    "No Meta Business Suite → Instagram → Contas → conecte seu Instagram.": ["In Meta Business Suite → Instagram → Accounts, connect your Instagram account.", "En Meta Business Suite → Instagram → Cuentas, conecta tu cuenta de Instagram."],
    "No Meta Business Suite → Instagram → clique na conta → o ID numérico está na URL ou nas configurações.": ["In Meta Business Suite → Instagram, select the account. The numeric ID is in the URL or settings.", "En Meta Business Suite → Instagram, selecciona la cuenta. El ID numérico aparece en la URL o en la configuración."],
    "Em Meta Developers → Graph API Explorer → selecione seu app → adicione permissões instagram_basic e instagram_content_publish → gere o token.": ["In Meta Developers → Graph API Explorer, select your app, add the instagram_basic and instagram_content_publish permissions, then generate the token.", "En Meta Developers → Graph API Explorer, selecciona tu app, añade los permisos instagram_basic e instagram_content_publish y genera el token."],
    "No Facebook → Menu → Páginas → Criar nova página. Use nome da sua empresa ou produto.": ["In Facebook → Menu → Pages → Create new Page. Use your business or product name.", "En Facebook → Menú → Páginas → Crear página nueva. Usa el nombre de tu empresa o producto."],
    "Na sua Página → Configurações → Instagram → conecte sua conta Instagram Business.": ["On your Page → Settings → Instagram, connect your Instagram Business account.", "En tu página → Configuración → Instagram, conecta tu cuenta Instagram Business."],
    "Clique em 'Entrar com Facebook' — o NexOS vai detectar automaticamente sua Página e Instagram vinculado.": ["Click ‘Sign in with Facebook’ — NexOS will automatically detect your Page and linked Instagram account.", "Haz clic en «Iniciar sesión con Facebook»; NexOS detectará automáticamente tu página y la cuenta de Instagram vinculada."],
    "Acesse developers.tiktok.com → Manage Apps → Create App → escolha Content Posting API.": ["Go to developers.tiktok.com → Manage Apps → Create App → choose Content Posting API.", "Ve a developers.tiktok.com → Manage Apps → Create App → elige Content Posting API."],
    "Em seu app → Test Users → adicione sua conta TikTok Business como usuário de teste.": ["In your app → Test Users, add your TikTok Business account as a test user.", "En tu app → Test Users, añade tu cuenta TikTok Business como usuario de prueba."],
    "Use o fluxo de autorização OAuth do TikTok ou a ferramenta de teste no painel do desenvolvedor para gerar o token.": ["Use TikTok’s OAuth authorisation flow or the developer dashboard’s testing tool to generate the token.", "Usa el flujo de autorización OAuth de TikTok o la herramienta de pruebas del panel de desarrolladores para generar el token."],
    "Após autorizar, o Open ID da conta fica disponível na resposta da autenticação ou no painel do app.": ["After authorisation, the account’s Open ID is available in the authentication response or the app dashboard.", "Después de autorizar, el Open ID de la cuenta estará disponible en la respuesta de autenticación o en el panel de la app."],
    "Acesse dashboard.stripe.com e complete o cadastro com dados empresariais e conta bancária.": ["Go to dashboard.stripe.com and complete registration with your business details and bank account.", "Ve a dashboard.stripe.com y completa el registro con los datos de tu empresa y tu cuenta bancaria."],
    "No painel: Developers → API keys → Secret key. Clique em 'Reveal live key' e copie (começa com sk_live_...).": ["In the dashboard: Developers → API keys → Secret key. Click ‘Reveal live key’ and copy it (starts with sk_live_...).", "En el panel: Developers → API keys → Secret key. Haz clic en «Reveal live key» y cópiala (empieza con sk_live_...)."],
    "Para receber eventos de pagamento em tempo real: Developers → Webhooks → Add endpoint → cole a URL gerada pelo NexOS.": ["To receive payment events in real time: Developers → Webhooks → Add endpoint → paste the URL generated by NexOS.", "Para recibir eventos de pago en tiempo real: Developers → Webhooks → Add endpoint → pega la URL generada por NexOS."],
    "Preencha o campo acima e salve. Pronto — seus checkouts processam cartão, PIX e recorrência.": ["Complete the field above and save. Your checkouts can now process cards, Pix, and recurring payments.", "Completa el campo de arriba y guarda. Tus checkouts ya podrán procesar tarjetas, Pix y pagos recurrentes."],
    "Entre em developer.paypal.com com sua conta Business.": ["Sign in to developer.paypal.com with your Business account.", "Inicia sesión en developer.paypal.com con tu cuenta Business."],
    "Apps & Credentials → Create App → tipo Business. Escolha suas contas Live na seleção de sandbox/live.": ["Apps & Credentials → Create App → Business type. Select your Live accounts in the sandbox/live selector.", "Apps & Credentials → Create App → tipo Business. Selecciona tus cuentas Live en el selector sandbox/live."],
    "Na tela do app, mude para 'Live' (canto superior direito) → copie o Client ID e o Client Secret.": ["On the app page, switch to ‘Live’ (top-right corner) → copy the Client ID and Client Secret.", "En la página de la app, cambia a «Live» (esquina superior derecha) → copia el Client ID y el Client Secret."],
    "Preencha os campos acima com as credenciais de produção. Seus clientes podem pagar via PayPal em qualquer país.": ["Enter your production credentials in the fields above. Your customers can pay with PayPal from any country.", "Introduce tus credenciales de producción en los campos de arriba. Tus clientes podrán pagar con PayPal desde cualquier país."],
    "Em mercadopago.com.br: Seu negócio → Configurações → Gestão e administração → Credenciais.": ["At mercadopago.com.br: Your business → Settings → Management and administration → Credentials.", "En mercadopago.com.br: Tu negocio → Configuración → Gestión y administración → Credenciales."],
    "Na aba 'Produção': copie o Access Token (começa com APP_USR-...). Nunca compartilhe este token.": ["In the ‘Production’ tab, copy the Access Token (starts with APP_USR-...). Never share this token.", "En la pestaña «Producción», copia el Access Token (empieza con APP_USR-...). Nunca compartas este token."],
    "Na mesma tela, copie também a Public Key. Ela é usada para o checkout transparente.": ["On the same page, also copy the Public Key. It’s used for transparent checkout.", "En la misma página, copia también la Public Key. Se usa para el checkout transparente."],
    "Em Configurações → Notificações IPN → cole a URL do NexOS. Assim conversões são capturadas em tempo real.": ["In Settings → IPN Notifications, paste the NexOS URL to capture conversions in real time.", "En Configuración → Notificaciones IPN, pega la URL de NexOS para registrar conversiones en tiempo real."],
    "Entre em dashboard.pagar.me com seu login.": ["Sign in to dashboard.pagar.me with your account.", "Inicia sesión en dashboard.pagar.me con tu cuenta."],
    "Menu → Configurações → Credenciais. Selecione 'Produção' no seletor de ambiente.": ["Menu → Settings → Credentials. Select ‘Production’ in the environment selector.", "Menú → Configuración → Credenciales. Selecciona «Producción» en el selector de entorno."],
    "Copie a Secret Key (sk_live_...) e a Public Key (pk_live_...). Ambas são necessárias.": ["Copy the Secret Key (sk_live_...) and Public Key (pk_live_...). Both are required.", "Copia la Secret Key (sk_live_...) y la Public Key (pk_live_...). Necesitas ambas."],
    "Em Configurações → Webhooks → adicione a URL do NexOS para receber eventos de pagamento em tempo real.": ["In Settings → Webhooks, add the NexOS URL to receive payment events in real time.", "En Configuración → Webhooks, añade la URL de NexOS para recibir eventos de pago en tiempo real."],
    "Acesse o link de indicação da NexOS para criar sua conta e já começar com vantagens.": ["Use the NexOS referral link to create your account and get started with benefits.", "Usa el enlace de recomendación de NexOS para crear tu cuenta y empezar con beneficios."],
    "No painel do Asaas: Menu → Minha Conta → Integrações → API Keys. Copie a chave de produção (começa com $aact_prod_...).": ["In the Asaas dashboard: Menu → My Account → Integrations → API Keys. Copy the live key (starts with $aact_prod_...).", "En el panel de Asaas: Menú → Mi cuenta → Integraciones → API Keys. Copia la clave de producción (empieza con $aact_prod_...)."],
    "Preencha o campo API Key acima com sua chave de produção e salve. Pronto — seus checkouts já cobram direto na sua conta.": ["Enter your live key in the API Key field above and save. Your checkouts will charge directly to your account.", "Introduce tu clave de producción en el campo API Key de arriba y guarda. Tus checkouts cobrarán directamente en tu cuenta."],
    "No Hotmart, vá em Ferramentas → Desenvolvedores → API → Credenciais.": ["In Hotmart, go to Tools → Developers → API → Credentials.", "En Hotmart, ve a Herramientas → Desarrolladores → API → Credenciales."],
    "Na tela de credenciais, copie o Client ID e cole acima.": ["On the credentials page, copy the Client ID and paste it above.", "En la página de credenciales, copia el Client ID y pégalo arriba."],
    "Para conversões em tempo real, configure o webhook do NexOS em Hotmart → Ferramentas → Webhooks.": ["For real-time conversions, configure the NexOS webhook in Hotmart → Tools → Webhooks.", "Para recibir conversiones en tiempo real, configura el webhook de NexOS en Hotmart → Herramientas → Webhooks."],
    "Acesse kiwify.com.br → Criar conta gratuita → cadastre seus dados e o primeiro produto.": ["Go to kiwify.com.br → Create free account → enter your details and first product.", "Ve a kiwify.com.br → Crear cuenta gratis → introduce tus datos y tu primer producto."],
    "Já logado, clique no seu perfil (canto superior direito) → Configurações → aba Conta.": ["Once signed in, click your profile (top-right corner) → Settings → Account tab.", "Cuando hayas iniciado sesión, haz clic en tu perfil (esquina superior derecha) → Configuración → pestaña Cuenta."],
    "Na aba Conta, copie o número exibido em Account ID e cole no campo acima.": ["In the Account tab, copy the number shown under Account ID and paste it in the field above.", "En la pestaña Cuenta, copia el número que aparece en Account ID y pégalo en el campo de arriba."],
    "Vá em Configurações → Desenvolvedor → API Keys → clique em Criar chave. Copie o código gerado (começa com 'kwf_') e cole no campo Access Token acima.": ["Go to Settings → Developer → API Keys → click Create key. Copy the generated code (starts with ‘kwf_’) and paste it in the Access Token field above.", "Ve a Configuración → Developer → API Keys → haz clic en Crear clave. Copia el código generado (empieza con «kwf_») y pégalo en el campo Access Token de arriba."],
    "Em eduzz.com: Menu → Perfil → Configurações → aba API.": ["At eduzz.com: Menu → Profile → Settings → API tab.", "En eduzz.com: Menú → Perfil → Configuración → pestaña API."],
    "Copie a API Key Pública e a API Key Privada exibidas na tela.": ["Copy the Public API Key and Private API Key shown on the page.", "Copia la API Key pública y la API Key privada que aparecen en la página."],
    "Em Eduzz → Meus Produtos → Postback → adicione a URL do NexOS para receber notificações de venda.": ["In Eduzz → My Products → Postback, add the NexOS URL to receive sales notifications.", "En Eduzz → Mis productos → Postback, añade la URL de NexOS para recibir notificaciones de ventas."],
    "Acesse business.facebook.com → Contas → Contas de anúncios → Adicionar. Cadastre os dados da sua empresa e uma forma de pagamento.": ["Go to business.facebook.com → Accounts → Ad accounts → Add. Enter your business details and a payment method.", "Ve a business.facebook.com → Cuentas → Cuentas publicitarias → Añadir. Registra los datos de tu empresa y un método de pago."],
    "Abra o Gerenciador de Anúncios — o número aparece no canto superior esquerdo, ao lado do nome da conta. Formato: act_XXXXXXXXX. Copie e cole no campo acima.": ["Open Ads Manager — the number appears in the top-left corner beside the account name. Format: act_XXXXXXXXX. Copy it into the field above.", "Abre Ads Manager: el número aparece arriba a la izquierda, junto al nombre de la cuenta. Formato: act_XXXXXXXXX. Cópialo en el campo de arriba."],
    "Em Meta Business Suite → Configurações → Usuários do Sistema → Adicionar. É uma conta especial só para permitir que o NexOS publique anúncios em seu nome — defina como Administrador.": ["In Meta Business Suite → Settings → System Users → Add. This special account lets NexOS publish ads on your behalf — set it as Administrator.", "En Meta Business Suite → Configuración → Usuarios del sistema → Añadir. Esta cuenta especial permite que NexOS publique anuncios en tu nombre; asígnale el rol de Administrador."],
    "Ainda na tela do usuário do sistema, clique em 'Gerar novo token' → selecione seu App → marque as permissões 'ads_management' e 'ads_read' → clique em Gerar. Copie o código gerado e cole no campo acima.": ["On the System User page, click ‘Generate new token’ → select your app → check the ‘ads_management’ and ‘ads_read’ permissions → click Generate. Copy the code into the field above.", "En la página del usuario del sistema, haz clic en «Generar nuevo token» → selecciona tu app → marca los permisos «ads_management» y «ads_read» → haz clic en Generar. Copia el código en el campo de arriba."],
    "Se ainda não tiver, acesse business.tiktok.com e crie uma conta TikTok for Business — é gratuito e leva poucos minutos.": ["If you don’t have one yet, go to business.tiktok.com and create a TikTok for Business account — it’s free and only takes a few minutes.", "Si aún no tienes una, ve a business.tiktok.com y crea una cuenta de TikTok for Business; es gratis y solo toma unos minutos."],
    "Acesse ads.tiktok.com → Criar conta → preencha os dados da sua empresa e cadastre um cartão ou outra forma de pagamento.": ["Go to ads.tiktok.com → Create account → enter your business details and add a card or other payment method.", "Ve a ads.tiktok.com → Crear cuenta → introduce los datos de tu empresa y registra una tarjeta u otro método de pago."],
    "Já dentro do Ads Manager, clique no nome da sua conta no canto superior direito. O número que aparece embaixo do nome é o Advertiser ID — copie e cole no campo acima.": ["In Ads Manager, click your account name in the top-right corner. The number below it is the Advertiser ID — copy it into the field above.", "En Ads Manager, haz clic en el nombre de tu cuenta en la esquina superior derecha. El número que aparece debajo es el Advertiser ID; cópialo en el campo de arriba."],
    "Acesse developers.tiktok.com e crie uma conta de desenvolvedor — pode usar o mesmo login da sua conta TikTok.": ["Go to developers.tiktok.com and create a developer account — you can use the same login as your TikTok account.", "Ve a developers.tiktok.com y crea una cuenta de desarrollador; puedes usar el mismo inicio de sesión que en TikTok."],
    "No painel, vá em 'Manage apps' → 'Create an app', e escolha o produto 'Marketing API'. Preencha as informações pedidas sobre sua empresa/uso e envie para aprovação da TikTok.": ["In the dashboard, go to ‘Manage apps’ → ‘Create an app’ and select the ‘Marketing API’ product. Complete the requested information about your business and use case, then submit it to TikTok for approval.", "En el panel, ve a «Manage apps» → «Create an app» y elige el producto «Marketing API». Completa la información solicitada sobre tu empresa y el uso, y envíala a TikTok para su aprobación."],
    "Depois que o app for aprovado (você recebe um e-mail da TikTok), volte em Marketing API → Authentication e gere um 'Long-Term Access Token' vinculado à sua conta de anúncios. Copie esse código e cole no campo acima.": ["After the app is approved (TikTok will email you), go to Marketing API → Authentication and generate a ‘Long-Term Access Token’ for your ads account. Copy it into the field above.", "Cuando aprueben la app (TikTok te enviará un correo), ve a Marketing API → Authentication y genera un «Long-Term Access Token» vinculado a tu cuenta publicitaria. Cópialo en el campo de arriba."],
    "Acesse ads.google.com → Nova conta → siga o assistente, informando sua empresa/produto e um cartão de pagamento.": ["Go to ads.google.com → New account → follow the setup wizard and enter your business/product details and a payment card.", "Ve a ads.google.com → Nueva cuenta → sigue el asistente e introduce los datos de tu empresa/producto y una tarjeta de pago."],
    "No topo do Google Ads, o ID de 10 dígitos fica no canto superior direito, ao lado do nome da conta. Formato: XXX-XXX-XXXX. Copie e cole no campo acima.": ["In Google Ads, the 10-digit ID is at the top-right beside the account name. Format: XXX-XXX-XXXX. Copy it into the field above.", "En Google Ads, el ID de 10 dígitos está arriba a la derecha, junto al nombre de la cuenta. Formato: XXX-XXX-XXXX. Cópialo en el campo de arriba."],
    "Vá em Ferramentas e configurações → Configuração → API Center. Preencha o formulário explicando o uso (automação de campanhas de lançamento) e envie para aprovação do Google.": ["Go to Tools and Settings → Setup → API Center. Complete the form explaining your use case (launch campaign automation) and submit it to Google for approval.", "Ve a Herramientas y configuración → Configuración → API Center. Completa el formulario explicando el uso (automatización de campañas de lanzamiento) y envíalo a Google para su aprobación."],
    "O Google avisa por e-mail quando aprovar. Depois de aprovado, volte no API Center, copie o Developer Token e cole no campo acima.": ["Google will notify you by email when approved. Return to API Center, copy the Developer Token, and paste it in the field above.", "Google te avisará por correo cuando lo apruebe. Vuelve a API Center, copia el Developer Token y pégalo en el campo de arriba."],
    "No HubSpot, clique no nome da conta no canto superior direito. O Portal ID numérico aparece abaixo.": ["In HubSpot, click the account name in the top-right corner. The numeric Portal ID appears below it.", "En HubSpot, haz clic en el nombre de la cuenta en la esquina superior derecha. El Portal ID numérico aparece debajo."],
    "Em HubSpot → Configurações → Integrações → Apps Privados → Criar app privado.": ["In HubSpot → Settings → Integrations → Private Apps → Create private app.", "En HubSpot → Configuración → Integraciones → Apps privadas → Crear app privada."],
    "Marque os escopos: crm.objects.contacts.write, crm.objects.deals.write, crm.lists.write.": ["Select these scopes: crm.objects.contacts.write, crm.objects.deals.write, crm.lists.write.", "Marca estos permisos: crm.objects.contacts.write, crm.objects.deals.write, crm.lists.write."],
    "Após criar o app, copie o token que começa com 'pat-'. Ele só é exibido uma vez.": ["After creating the app, copy the token starting with ‘pat-’. It is only shown once.", "Después de crear la app, copia el token que empieza con «pat-». Solo se muestra una vez."],
    "Em linkedin.com/campaignmanager → criar conta. Adicione método de pagamento.": ["At linkedin.com/campaignmanager → create an account. Add a payment method.", "En linkedin.com/campaignmanager → crea una cuenta. Añade un método de pago."],
    "Em developer.linkedin.com → Create App. Use o nome NexOS ou seu produto.": ["At developer.linkedin.com → Create App. Use NexOS or your product name.", "En developer.linkedin.com → Create App. Usa el nombre NexOS o el de tu producto."],
    "No seu app → Products → clique em 'Request access' ao lado de 'Marketing Developer Platform'. O LinkedIn aprova em 1–3 dias úteis.": ["In your app → Products → click ‘Request access’ beside ‘Marketing Developer Platform’. LinkedIn approval takes 1–3 business days.", "En tu app → Products → haz clic en «Request access» junto a «Marketing Developer Platform». LinkedIn tarda entre 1 y 3 días hábiles en aprobarlo."],
    "Após aprovação, clique em 'Entrar com LinkedIn' e autorize os escopos de anúncios.": ["After approval, click ‘Sign in with LinkedIn’ and authorise the advertising scopes.", "Después de la aprobación, haz clic en «Iniciar sesión con LinkedIn» y autoriza los permisos publicitarios."],
    "Mensagens": ["Messages", "Mensajes"],
    "E-mail": ["Email", "Correo"],
    "Social Orgânico": ["Organic Social", "Social orgánico"],
    "Checkout": ["Checkout", "Checkout"],
    "Plataformas": ["Platforms", "Plataformas"],
    "Mídia Paga": ["Paid Media", "Medios pagados"],
    "CRM": ["CRM", "CRM"],
    "Conta verificada no Meta Business Suite (business.facebook.com)": ["A verified account in Meta Business Suite (business.facebook.com)", "Una cuenta verificada en Meta Business Suite (business.facebook.com)"],
    "Número de telefone dedicado — não pode ser seu WhatsApp pessoal ou do WhatsApp Business App": ["A dedicated phone number — it can’t be your personal WhatsApp or the WhatsApp Business app number", "Un número de teléfono dedicado; no puede ser tu WhatsApp personal ni el número de la app WhatsApp Business"],
    "App criado no Meta Developers com a API do WhatsApp ativada": ["An app created in Meta Developers with the WhatsApp API enabled", "Una app creada en Meta Developers con WhatsApp API habilitada"],
    "Conta ativa no RD Station Marketing": ["An active RD Station Marketing account", "Una cuenta activa de RD Station Marketing"],
    "Plano que inclui acesso à API (Marketing ou superior)": ["A plan that includes API access (Marketing or higher)", "Un plan que incluya acceso a la API (Marketing o superior)"],
    "Conta no Telegram (qualquer conta serve)": ["A Telegram account (any account will do)", "Una cuenta de Telegram (cualquiera sirve)"],
    "Conta ativa no ActiveCampaign": ["An active ActiveCampaign account", "Una cuenta activa de ActiveCampaign"],
    "Conta no Resend (resend.com — plano gratuito disponível)": ["A Resend account (resend.com — free plan available)", "Una cuenta de Resend (resend.com — hay un plan gratuito)"],
    "Conta ativa no Stripe (stripe.com)": ["An active Stripe account (stripe.com)", "Una cuenta activa de Stripe (stripe.com)"],
    "KYC aprovado (dados bancários cadastrados)": ["KYC approved (bank details registered)", "KYC aprobado (datos bancarios registrados)"],
    "Conta ativa no Resend (resend.com — plano gratuito disponível)": ["An active Resend account (resend.com — free plan available)", "Una cuenta activa de Resend (resend.com — hay un plan gratuito)"],
    "Domínio de e-mail verificado no Resend": ["An email domain verified in Resend", "Un dominio de correo verificado en Resend"],
    "Conta Instagram convertida para Business ou Creator": ["An Instagram account converted to Business or Creator", "Una cuenta de Instagram convertida a Business o Creator"],
    "Conta Instagram vinculada a uma Página do Facebook": ["An Instagram account linked to a Facebook Page", "Una cuenta de Instagram vinculada a una página de Facebook"],
    "App no Meta Developers com permissões instagram_basic e instagram_content_publish": ["A Meta Developers app with instagram_basic and instagram_content_publish permissions", "Una app de Meta Developers con los permisos instagram_basic e instagram_content_publish"],
    "Página do Facebook criada (não perfil pessoal)": ["A Facebook Page (not a personal profile)", "Una página de Facebook creada (no un perfil personal)"],
    "Conta Instagram Business vinculada à Página (para publicar no Instagram também)": ["An Instagram Business account linked to the Page (to publish on Instagram too)", "Una cuenta Instagram Business vinculada a la página (para publicar también en Instagram)"],
    "Conta TikTok convertida para Business": ["A TikTok account converted to Business", "Una cuenta de TikTok convertida a Business"],
    "App criado e aprovado em developers.tiktok.com": ["An app created and approved at developers.tiktok.com", "Una app creada y aprobada en developers.tiktok.com"],
    "Conta ativa no Mercado Pago Business": ["An active Mercado Pago Business account", "Una cuenta activa de Mercado Pago Business"],
    "CNPJ ou CPF validado": ["A validated CNPJ or CPF", "CNPJ o CPF validado"],
    "Conta ativa no Pagar.me": ["An active Pagar.me account", "Una cuenta activa de Pagar.me"],
    "Conta bancária cadastrada e aprovada": ["A registered and approved bank account", "Una cuenta bancaria registrada y aprobada"],
    "Conta ativa no Asaas (crie pelo link de indicação abaixo para benefícios)": ["An active Asaas account (use the referral link below for benefits)", "Una cuenta activa de Asaas (usa el enlace de recomendación para obtener beneficios)"],
    "Conta ativa no Hotmart com produtos cadastrados": ["An active Hotmart account with products listed", "Una cuenta activa de Hotmart con productos registrados"],
    "Conta ativa no Kiwify, com ao menos um produto cadastrado": ["An active Kiwify account with at least one product listed", "Una cuenta activa de Kiwify con al menos un producto registrado"],
    "Conta ativa no Eduzz com produtos cadastrados": ["An active Eduzz account with products listed", "Una cuenta activa de Eduzz con productos registrados"],
    "Conta Business no PayPal (paypal.com/br)": ["A PayPal Business account (paypal.com/br)", "Una cuenta PayPal Business (paypal.com/br)"],
    "Uma conta de anúncios ativa no Meta Ads Manager, com um cartão ou forma de pagamento cadastrada": ["An active Meta Ads Manager account with a card or other payment method registered", "Una cuenta activa de Meta Ads Manager con una tarjeta u otro método de pago registrado"],
    "Acesso de administrador ao Meta Business Suite (o painel de gestão da sua empresa no Facebook/Instagram)": ["Admin access to Meta Business Suite (your company’s Facebook/Instagram management dashboard)", "Acceso de administrador a Meta Business Suite (el panel de gestión de tu empresa en Facebook/Instagram)"],
    "Uma conta comercial gratuita no TikTok for Business": ["A free TikTok for Business account", "Una cuenta comercial gratuita de TikTok for Business"],
    "Uma conta de anúncios ativa no TikTok Ads Manager, com forma de pagamento cadastrada": ["An active TikTok Ads Manager account with a payment method registered", "Una cuenta activa de TikTok Ads Manager con un método de pago registrado"],
    "Um app aprovado no TikTok for Developers com acesso liberado à Marketing API": ["An app approved by TikTok for Developers with Marketing API access granted", "Una app aprobada en TikTok for Developers con acceso a Marketing API"],
    "Uma conta ativa no Google Ads, com forma de pagamento cadastrada": ["An active Google Ads account with a payment method registered", "Una cuenta activa de Google Ads con un método de pago registrado"],
    "Um Developer Token (código de acesso de desenvolvedor) aprovado pelo Google": ["A Google-approved Developer Token", "Un Developer Token aprobado por Google"],
    "Conta ativa no HubSpot (plano gratuito ou pago)": ["An active HubSpot account (free or paid plan)", "Una cuenta activa de HubSpot (plan gratuito o de pago)"],
    "Conta pessoal no LinkedIn": ["A personal LinkedIn account", "Una cuenta personal de LinkedIn"],
    "Conta de anúncios criada no Campaign Manager": ["An ad account created in Campaign Manager", "Una cuenta publicitaria creada en Campaign Manager"],
    "Abra o Telegram e busque @BotFather": ["Open Telegram and search for @BotFather", "Abre Telegram y busca @BotFather"],
    "Acesse as configurações da conta": ["Open account settings", "Abre la configuración de la cuenta"],
    "Acesse as configurações de API": ["Open API settings", "Abre la configuración de la API"],
    "Acesse as configurações de desenvolvedor": ["Open developer settings", "Abre la configuración para desarrolladores"],
    "Acesse as configurações do RD Station": ["Open RD Station settings", "Abre la configuración de RD Station"],
    "Acesse as credenciais": ["Open credentials", "Abre las credenciales"],
    "Acesse as Credenciais": ["Open credentials", "Abre las credenciales"],
    "Acesse as credenciais de API": ["Open API credentials", "Abre las credenciales de la API"],
    "Acesse o Dashboard Pagar.me": ["Open the Pagar.me dashboard", "Abre el panel de Pagar.me"],
    "Acesse o Meta Business Suite": ["Open Meta Business Suite", "Abre Meta Business Suite"],
    "Acesse o PayPal Developer": ["Open PayPal Developer", "Abre PayPal Developer"],
    "Acesse suas API Keys": ["Open your API Keys", "Abre tus API Keys"],
    "Aguarde a aprovação e copie o código": ["Wait for approval and copy the code", "Espera la aprobación y copia el código"],
    "Ative o WhatsApp no App": ["Enable WhatsApp in the app", "Activa WhatsApp en la app"],
    "Autorize o app na sua conta": ["Authorise the app in your account", "Autoriza la app en tu cuenta"],
    "Cadastre-se no TikTok for Developers": ["Sign up for TikTok for Developers", "Regístrate en TikTok for Developers"],
    "Cole a chave aqui": ["Paste the key here", "Pega la clave aquí"],
    "Cole aqui e salve": ["Paste here and save", "Pega aquí y guarda"],
    "Cole a Secret Key aqui": ["Paste the Secret Key here", "Pega aquí la Secret Key"],
    "Conecte via OAuth acima": ["Connect using OAuth above", "Conecta mediante OAuth arriba"],
    "Configure o IPN/Webhook": ["Configure the IPN/Webhook", "Configura el IPN/Webhook"],
    "Configure o Postback": ["Configure the postback", "Configura el postback"],
    "Configure o Webhook": ["Configure the webhook", "Configura el webhook"],
    "Configure o webhook (opcional)": ["Configure the webhook (optional)", "Configura el webhook (opcional)"],
    "Converta sua conta para Business": ["Convert your account to Business", "Convierte tu cuenta a Business"],
    "Copie a API Key": ["Copy the API Key", "Copia la API Key"],
    "Copie a Public Key": ["Copy the Public Key", "Copia la Public Key"],
    "Copie as API Keys": ["Copy the API Keys", "Copia las API Keys"],
    "Copie as chaves": ["Copy the keys", "Copia las claves"],
    "Copie as credenciais Live": ["Copy the Live credentials", "Copia las credenciales Live"],
    "Copie o Access Token": ["Copy the Access Token", "Copia el Access Token"],
    "Copie o Account ID": ["Copy the Account ID", "Copia el Account ID"],
    "Copie o Account Name": ["Copy the Account Name", "Copia el Account Name"],
    "Copie o Audience ID (opcional)": ["Copy the Audience ID (optional)", "Copia el Audience ID (opcional)"],
    "Copie o Bot Token": ["Copy the Bot Token", "Copia el Bot Token"],
    "Copie o Client ID": ["Copy the Client ID", "Copia el Client ID"],
    "Copie o Open ID": ["Copy the Open ID", "Copia el Open ID"],
    "Copie o token gerado": ["Copy the generated token", "Copia el token generado"],
    "Crie o App no Meta Developers": ["Create the app in Meta Developers", "Crea la app en Meta Developers"],
    "Crie ou acesse sua conta Stripe": ["Create or open your Stripe account", "Crea o abre tu cuenta de Stripe"],
    "Crie ou acesse sua Página": ["Create or open your Page", "Crea o abre tu página"],
    "Crie sua conta comercial no TikTok": ["Create your TikTok Business account", "Crea tu cuenta TikTok Business"],
    "Crie sua conta de anúncios": ["Create your ads account", "Crea tu cuenta publicitaria"],
    "Crie sua conta de anúncios no Ads Manager": ["Create your ads account in Ads Manager", "Crea tu cuenta publicitaria en Ads Manager"],
    "Crie sua conta no Asaas": ["Create your Asaas account", "Crea tu cuenta de Asaas"],
    "Crie uma API Key": ["Create an API Key", "Crea una API Key"],
    "Crie uma conta no Resend": ["Create a Resend account", "Crea una cuenta de Resend"],
    "Crie um App": ["Create an app", "Crea una app"],
    "Crie um app e peça acesso à Marketing API": ["Create an app and request Marketing API access", "Crea una app y solicita acceso a Marketing API"],
    "Crie um app no Developer Portal": ["Create an app in the Developer Portal", "Crea una app en Developer Portal"],
    "Crie um app no TikTok Developers": ["Create an app in TikTok Developers", "Crea una app en TikTok Developers"],
    "Crie um App Privado": ["Create a private app", "Crea una app privada"],
    "Crie um novo bot": ["Create a new bot", "Crea un bot nuevo"],
    "Crie um 'Usuário do Sistema' (uma conta técnica de acesso)": ["Create a ‘System User’ (a technical access account)", "Crea un «Usuario del sistema» (una cuenta técnica de acceso)"],
    "Defina as permissões": ["Set permissions", "Define los permisos"],
    "Encontre o Account ID": ["Find the Account ID", "Encuentra el Account ID"],
    "Encontre o Ad Account ID": ["Find the Ad Account ID", "Encuentra el Ad Account ID"],
    "Encontre o Advertiser ID": ["Find the Advertiser ID", "Encuentra el Advertiser ID"],
    "Encontre o Customer ID": ["Find the Customer ID", "Encuentra el Customer ID"],
    "Encontre o Phone Number ID": ["Find the Phone Number ID", "Encuentra el Phone Number ID"],
    "Encontre o Portal ID": ["Find the Portal ID", "Encuentra el Portal ID"],
    "Gere o Access Token": ["Generate the Access Token", "Genera el Access Token"],
    "Gere o código de acesso (Access Token)": ["Generate the access token (Access Token)", "Genera el código de acceso (Access Token)"],
    "Gere o Token de API": ["Generate the API Token", "Genera el API Token"],
    "Gere uma chave de API (API Key)": ["Generate an API key (API Key)", "Genera una clave de API (API Key)"],
    "Obtenha a Secret Key": ["Get the Secret Key", "Obtén la Secret Key"],
    "Obtenha o Access Token": ["Get the Access Token", "Obtén el Access Token"],
    "Se ainda não tiver, crie sua conta de anúncios": ["If you don’t have one yet, create your ads account", "Si aún no tienes una, crea tu cuenta publicitaria"],
    "Se ainda não tiver, crie sua conta no Google Ads": ["If you don’t have one yet, create your Google Ads account", "Si aún no tienes una, crea tu cuenta de Google Ads"],
    "Se ainda não tiver, crie sua conta no Kiwify": ["If you don’t have one yet, create your Kiwify account", "Si aún no tienes una, crea tu cuenta de Kiwify"],
    "Solicite acesso à Marketing API": ["Request Marketing API access", "Solicita acceso a Marketing API"],
    "Solicite o Developer Token": ["Request the Developer Token", "Solicita el Developer Token"],
    "Verifique seu domínio": ["Verify your domain", "Verifica tu dominio"],
    "Vincule a uma Página do Facebook": ["Link to a Facebook Page", "Vincula una página de Facebook"],
    "Vincule seu Instagram Business": ["Link your Instagram Business account", "Vincula tu cuenta Instagram Business"],
    "Documentação oficial Meta": ["Official Meta documentation", "Documentación oficial de Meta"],
    "Documentação Stripe": ["Stripe documentation", "Documentación de Stripe"],
    "Documentação Asaas": ["Asaas documentation", "Documentación de Asaas"],
    "Docs ActiveCampaign API": ["ActiveCampaign API docs", "Documentación de la API de ActiveCampaign"],
    "Docs RD Station API": ["RD Station API docs", "Documentación de la API de RD Station"],
    "Docs Resend": ["Resend docs", "Documentación de Resend"],
    "Docs Instagram API": ["Instagram API docs", "Documentación de la API de Instagram"],
    "Docs Facebook Pages": ["Facebook Pages docs", "Documentación de páginas de Facebook"],
    "Docs TikTok Content API": ["TikTok Content API docs", "Documentación de TikTok Content API"],
    "Docs PayPal Checkout": ["PayPal Checkout docs", "Documentación de PayPal Checkout"],
    "Docs Mercado Pago": ["Mercado Pago docs", "Documentación de Mercado Pago"],
    "Docs Pagar.me": ["Pagar.me docs", "Documentación de Pagar.me"],
    "Docs Hotmart API": ["Hotmart API docs", "Documentación de la API de Hotmart"],
    "Documentação oficial (Kiwify)": ["Official Kiwify documentation", "Documentación oficial de Kiwify"],
    "Docs Eduzz API": ["Eduzz API docs", "Documentación de la API de Eduzz"],
    "Documentação oficial (Meta Marketing API)": ["Official Meta Marketing API documentation", "Documentación oficial de Meta Marketing API"],
    "Documentação oficial (TikTok Marketing API)": ["Official TikTok Marketing API documentation", "Documentación oficial de TikTok Marketing API"],
    "Documentação oficial (Google Ads API)": ["Official Google Ads API documentation", "Documentación oficial de Google Ads API"],
    "Docs HubSpot Private Apps": ["HubSpot private apps docs", "Documentación de apps privadas de HubSpot"],
    "Docs LinkedIn Marketing API": ["LinkedIn Marketing API docs", "Documentación de LinkedIn Marketing API"],
    "Como criar um bot no Telegram": ["How to create a Telegram bot", "Cómo crear un bot de Telegram"],
    "Minha Empresa": ["Minha Empresa", "Minha Empresa"],
    "Minha Loja": ["Minha Loja", "Minha Loja"],
    "Minha Conta Ads": ["Minha Conta Ads", "Minha Conta Ads"],
    "Meu Workspace Resend": ["Meu Workspace Resend", "Meu Workspace Resend"],
    "Minha AC": ["Minha AC", "Minha AC"],
    "Minha Kiwify": ["Minha Kiwify", "Minha Kiwify"],
    "Minha Conta Eduzz": ["Minha Conta Eduzz", "Minha Conta Eduzz"],
    "Workspace RD": ["Workspace RD", "Workspace RD"],
    "Hotmart Workspace": ["Hotmart Workspace", "Hotmart Workspace"],
    "HubSpot CRM": ["HubSpot CRM", "HubSpot CRM"],
    "Nome da Conta": ["Account Name", "Nombre de la cuenta"],
    "Nome do Bot": ["Bot Name", "Nombre del bot"],
    "Nome da Página": ["Page Name", "Nombre de la página"],
    "Nome da Conta / Email PayPal": ["Account Name / PayPal Email", "Nombre de la cuenta / correo de PayPal"],
    "Account Name (subdomínio)": ["Account Name (subdomain)", "Nombre de cuenta (subdominio)"],
    "Ambiente": ["Environment", "Entorno"],
    "API Key do Asaas": ["Asaas API Key", "API Key de Asaas"],
    "Audience ID (para broadcasts)": ["Audience ID (for broadcasts)", "Audience ID (para envíos masivos)"],
    "@meubot": ["@meubot", "@meubot"],
    "@meucanal": ["@meucanal", "@meucanal"],
    "pagamentos@minhaempresa.com": ["pagamentos@minhaempresa.com", "pagamentos@minhaempresa.com"],
    "seu-client-id": ["seu-client-id", "seu-client-id"],
    // Keep API/provider identifiers and example credential formats intact.
    "Phone Number ID": ["Phone Number ID", "Phone Number ID"],
    "Access Token": ["Access Token", "Access Token"],
    "API Token": ["API Token", "API Token"],
    "Client ID": ["Client ID", "Client ID"],
    "API Key": ["API Key", "API Key"],
    "Stripe Account ID": ["Stripe Account ID", "Stripe Account ID"],
    "Secret Key": ["Secret Key", "Secret Key"],
    "Client Secret": ["Client Secret", "Client Secret"],
    "Public Key": ["Public Key", "Public Key"],
    "API Key (Public)": ["API Key (Public)", "API Key (Public)"],
    "API Key (Private)": ["API Key (Private)", "API Key (Private)"],
    "Access Token (Meta)": ["Access Token (Meta)", "Access Token (Meta)"],
    "Instagram Account ID": ["Instagram Account ID", "Instagram Account ID"],
    "Page ID": ["Page ID", "Page ID"],
    "Open ID (TikTok Account ID)": ["Open ID (TikTok Account ID)", "Open ID (TikTok Account ID)"],
    "Bot Token": ["Bot Token", "Bot Token"],
    "Ad Account ID": ["Ad Account ID", "Ad Account ID"],
    "Advertiser ID": ["Advertiser ID", "Advertiser ID"],
    "Customer ID": ["Customer ID", "Customer ID"],
    "Developer Token": ["Developer Token", "Developer Token"],
    "Portal ID": ["Portal ID", "Portal ID"],
    "Private App Token": ["Private App Token", "Private App Token"],
    "Account ID": ["Account ID", "Account ID"],
    "Account Name": ["Account Name", "Account Name"],
    "Audience ID (for broadcasts)": ["Audience ID (for broadcasts)", "Audience ID (for broadcasts)"],
    "Facebook (Pages)": ["Facebook (Pages)", "Facebook (Pages)"],
    "RD Station": ["RD Station", "RD Station"],
    "ActiveCampaign": ["ActiveCampaign", "ActiveCampaign"],
    "Resend": ["Resend", "Resend"],
    "Stripe": ["Stripe", "Stripe"],
    "PayPal": ["PayPal", "PayPal"],
    "Mercado Pago": ["Mercado Pago", "Mercado Pago"],
    "Pagar.me": ["Pagar.me", "Pagar.me"],
    "Asaas": ["Asaas", "Asaas"],
    "Hotmart": ["Hotmart", "Hotmart"],
    "Kiwify": ["Kiwify", "Kiwify"],
    "Eduzz": ["Eduzz", "Eduzz"],
    "Meta Ads": ["Meta Ads", "Meta Ads"],
    "TikTok Ads": ["TikTok Ads", "TikTok Ads"],
    "Google Ads": ["Google Ads", "Google Ads"],
    "HubSpot": ["HubSpot", "HubSpot"],
    "LinkedIn Ads": ["LinkedIn Ads", "LinkedIn Ads"],
    "WhatsApp Business API": ["WhatsApp Business API", "WhatsApp Business API"],
    "Telegram Bot": ["Telegram Bot", "Telegram Bot"],
    "Instagram Business": ["Instagram Business", "Instagram Business"],
    "TikTok Business": ["TikTok Business", "TikTok Business"],
    "123456789012345": ["123456789012345", "123456789012345"],
    "1234567890:AAFxxxx...": ["1234567890:AAFxxxx...", "1234567890:AAFxxxx..."],
    "EAAxxxx...": ["EAAxxxx...", "EAAxxxx..."],
    "rdst_xxxx...": ["rdst_xxxx...", "rdst_xxxx..."],
    "xxxxxx...": ["xxxxxx...", "xxxxxx..."],
    "78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx": ["78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
    "re_xxxx...": ["re_xxxx...", "re_xxxx..."],
    "17841400000000000": ["17841400000000000", "17841400000000000"],
    "6912345678901234567": ["6912345678901234567", "6912345678901234567"],
    "act.xxxx...": ["act.xxxx...", "act.xxxx..."],
    "sk_live_xxxx...": ["sk_live_xxxx...", "sk_live_xxxx..."],
    "acct_xxxx": ["acct_xxxx", "acct_xxxx"],
    "AcXxxxx...": ["AcXxxxx...", "AcXxxxx..."],
    "EJxxx...": ["EJxxx...", "EJxxx..."],
    "APP_USR-xxxx...": ["APP_USR-xxxx...", "APP_USR-xxxx..."],
    "pk_live_xxxx...": ["pk_live_xxxx...", "pk_live_xxxx..."],
    "$aact_prod_xxxx...": ["$aact_prod_xxxx...", "$aact_prod_xxxx..."],
    "production": ["production", "production"],
    "hotmart-client-id": ["hotmart-client-id", "hotmart-client-id"],
    "kiwify-account-id": ["kiwify-account-id", "kiwify-account-id"],
    "kwf_xxxx...": ["kwf_xxxx...", "kwf_xxxx..."],
    "xxxx": ["xxxx", "xxxx"],
    "xxxx...": ["xxxx...", "xxxx..."],
    "act_123456789": ["act_123456789", "act_123456789"],
    "123-456-7890": ["123-456-7890", "123-456-7890"],
    "pat-xxxx...": ["pat-xxxx...", "pat-xxxx..."],
    "12345678": ["12345678", "12345678"],
    "urn:li:sponsoredAccount:123456789": ["urn:li:sponsoredAccount:123456789", "urn:li:sponsoredAccount:123456789"],
    "AQV...": ["AQV...", "AQV..."],
    "minhaempresa": ["minhaempresa", "minhaempresa"],
  };
  const localizeGuideText = (source: string) => {
    const translation = commonGuideTranslations[source];
    return translation
      ? t(source, translation[0], translation[1])
      : t(source, "[Catalog translation missing]", "[Falta traducción del catálogo]");
  };
  const localizeFieldHint = (key: string, source: string) => {
    const translation = catalogFieldHints[entry.provider]?.[key];
    return translation
      ? t(source, translation[0], translation[1])
      : t(source, "[Catalog translation missing]", "[Falta traducción del catálogo]");
  };
  const localizedCategory = localizeGuideText(entry.category);
  const localizedOauthLabel = entry.oauthPlatform
    ? `${t("Entrar com", "Sign in with", "Iniciar sesión con")} ${
        entry.oauthPlatform === "meta"
          ? localizedLabel
          : entry.oauthPlatform === "tiktok"
          ? "TikTok"
          : entry.oauthPlatform === "google"
          ? "Google"
          : entry.oauthPlatform === "hubspot"
          ? "HubSpot"
          : entry.oauthPlatform === "rdstation"
          ? "RD Station"
          : "LinkedIn"
      }`
    : undefined;

  const handleApplyCredentials = (values: Record<string, string>) => {
    setFields(prev => ({ ...prev, ...values }));
    setShowManual(true);
    setShowAssistant(false);
  };

  const handleConnect = () => {
    setLoading(true);
    try { onConnect(entry.provider, fields); }
    finally { setLoading(false); }
  };

  const handleOAuth = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      // Detect mobile — Android / iOS browsers intercept Meta OAuth via the Facebook/Instagram
      // native app, which means window.opener is null and the callback can't reach the
      // original tab via postMessage or localStorage. The fix: on mobile, redirect the
      // current tab to the OAuth URL (redirect-mode) and let the callback redirect back
      // to /integracoes with ?oauth_connected=<provider> or ?oauth_error=<msg>.
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      const startUrl = isMobile
        ? `/api/integrations/oauth/start/${entry.provider}?redirect_mode=1`
        : `/api/integrations/oauth/start/${entry.provider}`;

      const body = await customFetch<{ url: string }>(startUrl);

      if (isMobile) {
        // Full-page redirect: navigates the current tab to Meta OAuth.
        // The callback will redirect back to /integracoes?oauth_connected=<provider>.
        window.location.href = body.url;
        return; // state updates don't matter — page is leaving
      }

      const popup = window.open(body.url, "nexos_oauth", "width=620,height=700,scrollbars=yes,resizable=yes");
      if (!popup) {
        setOauthError(t("O popup foi bloqueado pelo browser. Permita popups para este site e tente novamente.", "The browser blocked the pop-up. Allow pop-ups for this site and try again.", "El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo."));
        setOauthLoading(false);
        return;
      }

      // Track whether any signal already handled the result so we don't double-fire.
      let resultHandled = false;

      const handleResult = (success: boolean, error?: string) => {
        if (resultHandled) return;
        resultHandled = true;
        window.removeEventListener("message", messageHandler);
        window.removeEventListener("storage", storageHandler);
        clearInterval(closedTimer);
        if (success) {
          onOAuthSuccess(); // modal closes — no need to setOauthLoading(false)
        } else {
          setOauthLoading(false);
          setOauthError(error ?? t("Falha na autenticação.", "Authentication failed.", "Falló la autenticación."));
        }
      };

      // Path 1: postMessage — works on desktop where window.opener is set.
      const messageHandler = (event: MessageEvent<{ type?: string; success?: boolean; provider?: string; error?: string }>) => {
        if (event.data?.type !== "oauth_complete") return;
        handleResult(!!event.data.success, event.data.error);
      };
      window.addEventListener("message", messageHandler);

      // Path 2: localStorage — works on mobile Chrome/Android where window.opener
      // is null (different-tab OAuth). The callback page writes to localStorage;
      // the storage event fires in ALL other tabs of the same origin immediately.
      // Clear any stale value first so a leftover key doesn't fire instantly.
      try { localStorage.removeItem("nexos_oauth_result"); } catch { /* ignore */ }
      const storageHandler = (event: StorageEvent) => {
        if (event.key !== "nexos_oauth_result" || !event.newValue) return;
        try {
          const data = JSON.parse(event.newValue) as { type?: string; success?: boolean; error?: string; ts?: number };
          if (data.type !== "oauth_complete") return;
          // Guard against stale values older than 30s
          if (data.ts && Date.now() - data.ts > 30_000) return;
          try { localStorage.removeItem("nexos_oauth_result"); } catch { /* ignore */ }
          handleResult(!!data.success, data.error);
        } catch { /* malformed — ignore */ }
      };
      window.addEventListener("storage", storageHandler);

      // Path 3: popup.closed polling — last-resort API check when the tab closes
      // without either signal firing (e.g. pop-up blocker edge cases).
      const closedTimer = setInterval(async () => {
        if (!popup.closed) return;
        clearInterval(closedTimer);
        if (resultHandled) return;

        // Small delay to let localStorage storage event fire first if it's in-flight.
        await new Promise(r => setTimeout(r, 400));
        if (resultHandled) return;

        // Check the API once as the final fallback.
        try {
          const integrations = await customFetch<Array<{ provider: string; status: string }>>(
            "/api/workspaces/me/integrations"
          );
          const justConnected = integrations.find(
            (i) => i.provider === entry.provider && i.status === "connected"
          );
          if (justConnected) {
            handleResult(true);
            return;
          }
        } catch { /* ignore */ }

        // Popup closed without any completion signal and integration not found.
        // This usually means the user cancelled OAuth or it failed silently on mobile.
        handleResult(false, t("Conexão não concluída. Verifique se autorizou o acesso e tente novamente.", "Connection wasn’t completed. Check that you authorised access and try again.", "La conexión no se completó. Comprueba que autorizaste el acceso e inténtalo de nuevo."));
        setOauthLoading(false); // explicitly reset if handleResult didn't fire success
      }, 600);
    } catch (err) {
      setOauthLoading(false);
      if (err instanceof ApiError) {
        const data = err.data as { code?: string; error?: string } | null;
        if (data?.code === "OAUTH_NOT_CONFIGURED") {
          const isMeta = entry.oauthPlatform === "meta";
          const isTikTok = entry.oauthPlatform === "tiktok";
          const vars = isMeta
            ? "META_APP_ID e META_APP_SECRET"
            : isTikTok
            ? "TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET"
            : t("as variáveis OAuth", "the OAuth variables", "las variables de OAuth");
          setOauthError(
            t(`Conexão OAuth não habilitada ainda. Para ativar o login via ${localizedLabel}, o administrador da plataforma precisa configurar ${vars} nas variáveis de ambiente do servidor.`, `OAuth connection isn’t enabled yet. To activate sign-in with ${localizedLabel}, the platform administrator must configure ${vars} in the server environment variables.`, `La conexión OAuth aún no está habilitada. Para activar el inicio de sesión con ${localizedLabel}, el administrador de la plataforma debe configurar ${vars} en las variables de entorno del servidor.`)
          );
        } else if (data?.code === "UNKNOWN_PROVIDER") {
          setOauthError(t("Provedor não suportado via OAuth. Use a inserção manual de credenciais.", "This provider doesn’t support OAuth. Enter credentials manually.", "Este proveedor no admite OAuth. Introduce las credenciales manualmente."));
          setShowManual(true);
        } else {
          setOauthError(data?.error ?? t(`Erro ${err.status} ao iniciar autenticação.`, `Error ${err.status} starting authentication.`, `Error ${err.status} al iniciar la autenticación.`));
        }
      } else {
        setOauthError(t("Erro de rede. Verifique sua conexão e tente novamente.", "Network error. Check your connection and try again.", "Error de red. Comprueba tu conexión e inténtalo de nuevo."));
      }
    }
  };

  const OAUTH_ICONS: Record<string, React.ElementType> = {
    meta: MetaLogo, tiktok: TikTokLogo, google: GoogleLogo,
    hubspot: HubSpotLogo, rdstation: RDLogo, linkedin: LinkedInLogo,
  };
  const OAUTH_BRAND: Record<string, { bg: string; border: string; color: string }> = {
    meta:      { bg: "rgba(24,119,242,0.07)",  border: "#1877F2", color: "#1877F2" },
    tiktok:    { bg: "rgba(254,44,85,0.07)",   border: "#fe2c55", color: "#fe2c55" },
    google:    { bg: "rgba(66,133,244,0.07)",  border: "#4285F4", color: "#4285F4" },
    hubspot:   { bg: "rgba(255,122,89,0.07)",  border: "#FF7A59", color: "#FF7A59" },
    rdstation: { bg: "rgba(0,113,193,0.07)",   border: "#0071c1", color: "#0071c1" },
    linkedin:  { bg: "rgba(10,102,194,0.07)",  border: "#0A66C2", color: "#0A66C2" },
  };

  const isOAuth = !!entry.oauthPlatform && !showManual;
  const OAuthIcon = OAUTH_ICONS[entry.oauthPlatform ?? ""] ?? MetaLogo;
  const brand = OAUTH_BRAND[entry.oauthPlatform ?? ""] ?? OAUTH_BRAND["meta"]!;
  const EntryIcon = entry.icon;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="border border-border/70 bg-card w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="border-b border-border/50 px-5 py-4 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 border rounded-sm flex items-center justify-center shrink-0 ${entry.color} border-current/30 bg-current/5`}>
              <EntryIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm uppercase tracking-widest">{t("Conectar", "Connect", "Conectar")} {localizedLabel}</h3>
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">{localizedCategory}</span>
              <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{localizeCatalogText(entry.description, "description")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {!showAssistant && (
              <button
                onClick={() => setShowAssistant(true)}
                title={t("Falar com o especialista em integrações", "Talk to the integration specialist", "Hablar con el especialista en integraciones")}
                className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors mr-1"
              >
                <Sparkles className="h-3 w-3" />
                {t("Preciso de ajuda", "I need help", "Necesito ayuda")}
              </button>
            )}
            <button onClick={onClose} aria-label={t("Fechar", "Close", "Cerrar")} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showAssistant ? (
          <IntegrationAssistantChat
            entry={entry}
            onApplyCredentials={handleApplyCredentials}
            onBack={() => setShowAssistant(false)}
          />
        ) : (
        <div className="overflow-y-auto flex-1">
          {/* Why */}
          <div className="px-5 py-3 bg-primary/5 border-b border-border/30 flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] font-mono text-muted-foreground/75 leading-relaxed">{localizeCatalogText(entry.why, "why")}</p>
          </div>

          {/* Warning */}
          {guide.warning && (
            <div className="px-5 py-3 bg-yellow-400/8 border-b border-yellow-400/25 flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-mono text-yellow-300/90 leading-relaxed font-medium">{localizeCatalogText(guide.warning, "warning")}</p>
            </div>
          )}

          {/* OAuth fast path */}
          {entry.oauthPlatform && !showManual && (
            <div className="px-5 py-6 flex flex-col items-center gap-4 border-b border-border/30">
              <div className="text-center">
                  <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest mb-1">{t("Método recomendado", "Recommended method", "Método recomendado")}</p>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  {t("O NexOS vai abrir uma janela segura da plataforma. Faça login e autorize o acesso — tokens são capturados automaticamente.", "NexOS will open a secure platform window. Sign in and authorise access — tokens are captured automatically.", "NexOS abrirá una ventana segura de la plataforma. Inicia sesión y autoriza el acceso; los tokens se capturan automáticamente.")}
                </p>
              </div>
              {oauthError && (
                <div className="w-full flex items-start gap-2 border border-yellow-400/30 bg-yellow-400/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="font-mono text-[10px] text-yellow-300/80 leading-relaxed">{oauthError}</p>
                </div>
              )}
              <button
                onClick={handleOAuth}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 border-2 px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
                style={{ borderColor: brand.border, color: brand.color, background: brand.bg }}
              >
                {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <OAuthIcon />}
                {oauthLoading ? t("Aguardando autorização…", "Waiting for authorisation…", "Esperando autorización…") : localizedOauthLabel}
                {!oauthLoading && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
              </button>
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-border/30" />
                <button
                  onClick={() => setShowManual(true)}
                  className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 uppercase tracking-widest transition-colors"
                >
                  {t("ou inserir credenciais manualmente", "or enter credentials manually", "o introducir las credenciales manualmente")}
                </button>
                <div className="flex-1 h-px bg-border/30" />
              </div>
            </div>
          )}

          {/* Manual form */}
          {(!entry.oauthPlatform || showManual) && (
            <>
              {entry.oauthPlatform && showManual && (
                <div className="px-5 py-2 border-b border-border/30 flex items-center justify-between bg-muted/5">
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">{t("Inserção manual de credenciais", "Manual credential entry", "Introducción manual de credenciales")}</span>
                  <button onClick={() => setShowManual(false)} className="font-mono text-[10px] text-primary hover:underline">← {t("Usar OAuth", "Use OAuth", "Usar OAuth")}</button>
                </div>
              )}
              {guide.prereqs.length > 0 && (
                <div className="px-5 py-4 border-b border-border/30 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">{t("Antes de começar — você precisa ter:", "Before you begin — you’ll need:", "Antes de empezar — necesitarás:")}</div>
                  {guide.prereqs.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-mono text-[9px] text-primary font-bold">{i + 1}</span>
                      </div>
                      <p className="font-mono text-[11px] text-foreground/75 leading-relaxed">{localizeGuideText(p)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-b border-border/30">
                <button
                  onClick={() => setGuideOpen(v => !v)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-bold">
                      {t("Passo a passo completo — do cadastro até conectar", "Complete step-by-step guide — from sign-up to connection", "Guía completa paso a paso — desde el registro hasta la conexión")}
                    </span>
                  </div>
                  {guideOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                </button>
                {guideOpen && (
                  <div className="px-5 pb-4 space-y-3 bg-muted/5">
                    {guide.steps.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="font-mono text-[9px] text-cyan-400 font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <div className="font-mono text-[11px] font-bold text-foreground">{localizeGuideText(s.title)}</div>
                          <p className="font-mono text-[10px] text-muted-foreground/65 leading-relaxed mt-0.5">{localizeGuideText(s.detail)}</p>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5">
                              {t("Abrir", "Open", "Abrir")} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {guide.docsUrl && (
                      <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50 hover:text-primary transition-colors mt-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        {guide.docsLabel ? localizeGuideText(guide.docsLabel) : t("Documentação oficial", "Official documentation", "Documentación oficial")}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="p-5 space-y-5">
                {entry.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">
                      {f.label === "Nome da Conta" ? t("Nome da Conta", "Account Name", "Nombre de la cuenta") : localizeGuideText(f.label)}
                    </label>
                    <input
                      type={f.type ?? "text"}
                      placeholder={localizeGuideText(f.placeholder)}
                      value={fields[f.key] ?? ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      autoComplete="off"
                      className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/50 rounded-none"
                    />
                    {f.hint && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <Info className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                        <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">{localizeFieldHint(f.key, f.hint)}</p>
                      </div>
                    )}
                  </div>
                ))}
                {entry.fields.some(f => f.type === "password") && (
                  <div className="flex items-start gap-1.5 border border-border/30 bg-muted/10 px-3 py-2">
                    <Info className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                      {t("Campos de token ficam em branco mesmo se você já conectou antes — o NexOS mantém o token salvo. Preencha apenas para atualizar.", "Token fields stay blank even if you’ve connected before — NexOS keeps the token saved. Fill them in only to update.", "Los campos de token quedan vacíos aunque ya te hayas conectado; NexOS conserva el token. Complétalos solo para actualizarlo.")}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        )}

        {/* Footer */}
        {!showAssistant && (
        <div className="border-t border-border/50 px-5 py-4 flex gap-3 shrink-0">
          {isOAuth ? (
            <Button onClick={onClose} variant="outline" className="flex-1 font-mono uppercase tracking-widest rounded-none border-border/50 h-10">
              {t("Fechar", "Close", "Cerrar")}
            </Button>
          ) : (
            <>
              <Button onClick={handleConnect} disabled={loading} className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t("Salvar Credenciais", "Save Credentials", "Guardar credenciales")}
              </Button>
              <Button variant="outline" onClick={onClose} className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-5">
                {t("Cancelar", "Cancel", "Cancelar")}
              </Button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
