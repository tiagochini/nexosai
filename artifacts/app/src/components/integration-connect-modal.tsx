import { useState } from "react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import {
  X, AlertTriangle, ExternalLink, Zap, ShieldAlert, Info,
  ChevronDown, ChevronUp, CheckCircle2, Loader2, Sparkles,
  MessageSquare, Mail, CreditCard, BarChart2, Instagram, Music2,
} from "lucide-react";
import { IntegrationAssistantChat } from "@/components/integration-assistant-chat";

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
  accountName?: string;
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
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const { guide } = entry;

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
        setOauthError("O popup foi bloqueado pelo browser. Permita popups para este site e tente novamente.");
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
          setOauthError(error ?? "Falha na autenticação.");
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
        handleResult(false, "Conexão não concluída. Verifique se autorizou o acesso e tente novamente.");
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
            : "as variáveis OAuth";
          setOauthError(
            `Conexão OAuth não habilitada ainda. Para ativar o login via ${entry.label}, o administrador da plataforma precisa configurar ${vars} nas variáveis de ambiente do servidor.`
          );
        } else if (data?.code === "UNKNOWN_PROVIDER") {
          setOauthError("Provedor não suportado via OAuth. Use a inserção manual de credenciais.");
          setShowManual(true);
        } else {
          setOauthError(data?.error ?? `Erro ${err.status} ao iniciar autenticação.`);
        }
      } else {
        setOauthError("Erro de rede. Verifique sua conexão e tente novamente.");
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
              <h3 className="font-mono font-bold text-sm uppercase tracking-widest">Conectar {entry.label}</h3>
              <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {!showAssistant && (
              <button
                onClick={() => setShowAssistant(true)}
                title="Falar com o especialista em integrações"
                className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors mr-1"
              >
                <Sparkles className="h-3 w-3" />
                Preciso de ajuda
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
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
            <p className="text-[11px] font-mono text-muted-foreground/75 leading-relaxed">{entry.why}</p>
          </div>

          {/* Warning */}
          {guide.warning && (
            <div className="px-5 py-3 bg-yellow-400/8 border-b border-yellow-400/25 flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-mono text-yellow-300/90 leading-relaxed font-medium">{guide.warning}</p>
            </div>
          )}

          {/* OAuth fast path */}
          {entry.oauthPlatform && !showManual && (
            <div className="px-5 py-6 flex flex-col items-center gap-4 border-b border-border/30">
              <div className="text-center">
                <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest mb-1">Método recomendado</p>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  O NexOS vai abrir uma janela segura da plataforma. Faça login e autorize o acesso — tokens são capturados automaticamente.
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
                {oauthLoading ? "Aguardando autorização…" : (entry.oauthLabel ?? `Entrar com ${entry.oauthPlatform}`)}
                {!oauthLoading && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
              </button>
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-border/30" />
                <button
                  onClick={() => setShowManual(true)}
                  className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 uppercase tracking-widest transition-colors"
                >
                  ou inserir credenciais manualmente
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
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Inserção manual de credenciais</span>
                  <button onClick={() => setShowManual(false)} className="font-mono text-[10px] text-primary hover:underline">← Usar OAuth</button>
                </div>
              )}
              {guide.prereqs.length > 0 && (
                <div className="px-5 py-4 border-b border-border/30 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Antes de começar — você precisa ter:</div>
                  {guide.prereqs.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-mono text-[9px] text-primary font-bold">{i + 1}</span>
                      </div>
                      <p className="font-mono text-[11px] text-foreground/75 leading-relaxed">{p}</p>
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
                      Passo a passo completo — do cadastro até conectar
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
                          <div className="font-mono text-[11px] font-bold text-foreground">{s.title}</div>
                          <p className="font-mono text-[10px] text-muted-foreground/65 leading-relaxed mt-0.5">{s.detail}</p>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5">
                              Abrir <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {guide.docsUrl && (
                      <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50 hover:text-primary transition-colors mt-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        {guide.docsLabel ?? "Documentação oficial"}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="p-5 space-y-5">
                {entry.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{f.label}</label>
                    <input
                      type={f.type ?? "text"}
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      autoComplete="off"
                      className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/50 rounded-none"
                    />
                    {f.hint && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <Info className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                        <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">{f.hint}</p>
                      </div>
                    )}
                  </div>
                ))}
                {entry.fields.some(f => f.type === "password") && (
                  <div className="flex items-start gap-1.5 border border-border/30 bg-muted/10 px-3 py-2">
                    <Info className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                      Campos de token ficam em branco mesmo se você já conectou antes — o NexOS mantém o token salvo. Preencha apenas para atualizar.
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
              Fechar
            </Button>
          ) : (
            <>
              <Button onClick={handleConnect} disabled={loading} className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Salvar Credenciais
              </Button>
              <Button variant="outline" onClick={onClose} className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-5">
                Cancelar
              </Button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
