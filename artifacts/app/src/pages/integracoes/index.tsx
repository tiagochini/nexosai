import { useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Link2, AlertTriangle,
  Wifi, WifiOff, ChevronRight, ExternalLink, Zap,
  MessageSquare, Mail, CreditCard, BarChart2, Instagram,
  Music2, X, Info, ShieldAlert, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Provider =
  | "whatsapp_business" | "telegram"
  | "rd_station" | "activecampaign" | "resend"
  | "hotmart" | "kiwify" | "stripe"
  | "meta_ads" | "google_ads" | "tiktok_ads"
  | "instagram" | "tiktok"
  | "hubspot";

interface WorkspaceIntegration {
  id: string;
  provider: Provider;
  status: "connected" | "disconnected" | "error";
  accountName?: string;
  isPaymentGateway: boolean;
  blocksExecution: boolean;
  createdAt: string;
}

interface SetupStep { title: string; detail: string; url?: string }
interface SetupGuide {
  warning?: string;
  prereqs: string[];
  steps: SetupStep[];
  docsUrl?: string;
  docsLabel?: string;
}
interface FieldDef {
  key: string; label: string; placeholder: string; type?: string; hint?: string;
}
interface CatalogEntry {
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
  oauthPlatform?: "meta" | "tiktok" | "google" | "hubspot" | "rdstation";
  oauthLabel?: string;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
const CATALOG: CatalogEntry[] = [
  {
    provider: "whatsapp_business",
    label: "WhatsApp Business API",
    description: "Disparo automatizado de mensagens e auto-resposta com IA durante o lançamento",
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
    why: "Publica automaticamente posts, stories e reels gerados pela IA nos horários certos do lançamento.",
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
    oauthLabel: "Entrar com Meta",
  },
  {
    provider: "tiktok",
    label: "TikTok Business",
    description: "Auto-post de vídeos e reels no TikTok sincronizados ao lançamento",
    why: "Publica vídeos gerados pela IA no TikTok automaticamente. Essencial para lançamentos que dependem de audiência jovem e vídeos curtos.",
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
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Produtos digitais — compra converte contato automaticamente",
    why: "Quando alguém compra pelo Hotmart, o NexOS move o contato para 'convertido' em tempo real.",
    category: "Pagamentos",
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
    description: "Checkout e gestão de produtos com auto-conversão de leads",
    why: "Compras no Kiwify ativam automações de pós-venda no NexOS instantaneamente.",
    category: "Pagamentos",
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
      prereqs: ["Conta ativa no Kiwify com ao menos um produto"],
      steps: [
        { title: "Acesse as configurações da conta", detail: "No Kiwify, clique no seu perfil → Configurações → aba Conta.", url: "https://dashboard.kiwify.com.br" },
        { title: "Copie o Account ID", detail: "Na aba Conta, copie o Account ID exibido." },
        { title: "Gere uma API Key", detail: "Em Configurações → Desenvolvedor → API Keys → clique em Criar chave." },
      ],
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
      prereqs: ["Conta de Anúncios ativa no Meta Ads Manager", "Acesso ao Meta Business Suite"],
      steps: [
        { title: "Encontre o Ad Account ID", detail: "No Ads Manager, o ID aparece no canto superior esquerdo ao lado do nome da conta. Formato: act_XXXXXXXXX.", url: "https://www.facebook.com/adsmanager" },
        { title: "Crie um usuário do sistema", detail: "Em Meta Business Suite → Configurações → Usuários do Sistema → Adicionar. Defina como Administrador." },
        { title: "Gere o Access Token", detail: "Na tela do usuário do sistema → Gerar novo token → selecione seu App → marque ads_management e ads_read → Gerar token." },
      ],
      docsUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
      docsLabel: "Docs Meta Marketing API",
    },
    oauthPlatform: "meta",
    oauthLabel: "Entrar com Meta",
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
        hint: "Long-term access token gerado em TikTok Developers → Marketing API → Authentication." },
    ],
    guide: {
      prereqs: ["Conta de Anúncios ativa no TikTok Ads Manager", "App aprovado no TikTok Developers"],
      steps: [
        { title: "Encontre o Advertiser ID", detail: "No TikTok Ads Manager, clique no nome da conta no canto superior direito. O ID numérico aparece abaixo do nome.", url: "https://ads.tiktok.com" },
        { title: "Crie um app de marketing", detail: "Em developers.tiktok.com → Manage Apps → Create App → Marketing API.", url: "https://developers.tiktok.com" },
        { title: "Gere o Access Token", detail: "Em seu app de Marketing API → Authentication → gere um Long-Term Access Token para o anunciante." },
      ],
      docsUrl: "https://ads.tiktok.com/marketing_api/docs",
      docsLabel: "Docs TikTok Marketing API",
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
      prereqs: ["Conta ativa no Google Ads", "Acesso ao Google Cloud Console para criar credenciais OAuth"],
      steps: [
        { title: "Encontre o Customer ID", detail: "No Google Ads, o ID de 10 dígitos fica no canto superior direito. Formato: XXX-XXX-XXXX.", url: "https://ads.google.com" },
        { title: "Acesse o API Center", detail: "Em Google Ads → Ferramentas → API Center. Solicite um Developer Token se ainda não tiver.", url: "https://ads.google.com/aw/apicenter" },
        { title: "Aguarde aprovação", detail: "O Google pode levar alguns dias para aprovar o Developer Token. Após aprovado, copie e cole acima." },
      ],
      docsUrl: "https://developers.google.com/google-ads/api/docs/get-started/introduction",
      docsLabel: "Docs Google Ads API",
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
];

const CATEGORIES = ["Mensagens", "E-mail", "Social Orgânico", "Pagamentos", "Mídia Paga", "CRM"];

// ── OAuth platform meta icons (inline SVG, no external deps) ─────────────────
const MetaLogo = () => (
  <svg viewBox="0 0 40 40" className="h-4 w-4" fill="none">
    <path d="M20 7C13 7 7 13 7 20s6 13 13 13 13-6 13-13S27 7 20 7z" fill="#1877F2"/>
    <path d="M22.5 16.5c-1.38 0-2.5 1.12-2.5 2.5v6h3v-5.5h2l.5-3H23v-1.5c0-.55.45-1 1-1h1.5v-2.5A8 8 0 0 0 22.5 11c-2.76 0-5 2.24-5 5v.5h-2v3h2V31h3v-6.5h2.5" fill="#fff"/>
  </svg>
);
const TikTokLogo = () => (
  <svg viewBox="0 0 40 40" className="h-4 w-4" fill="none">
    <rect width="40" height="40" rx="8" fill="#010101"/>
    <path d="M28 14.5a5.5 5.5 0 0 1-5.5-5.5h-3.5v14.5L19 28a3 3 0 1 1-3-3 3 3 0 0 1 .5.04V21.5A6.5 6.5 0 1 0 23 28V19.5A9 9 0 0 0 28 21v-3.5a5.47 5.47 0 0 1-3-.55V14.5z" fill="white"/>
    <path d="M28 14.5a5.5 5.5 0 0 1-5.5-5.5h-3.5v14.5L19 28a3 3 0 1 1-3-3 3 3 0 0 1 .5.04V21.5A6.5 6.5 0 1 0 23 28V19.5A9 9 0 0 0 28 21v-3.5a5.47 5.47 0 0 1-3-.55V14.5" stroke="#69C9D0" strokeWidth=".5" fill="none"/>
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const HubSpotLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FF7A59">
    <path d="M22.447 13.098a5.166 5.166 0 0 0-4.21-5.08V5.57a2.013 2.013 0 0 0 1.164-1.818v-.056A2.013 2.013 0 0 0 17.39 1.68h-.042a2.013 2.013 0 0 0-2.012 2.013v.056c0 .815.487 1.519 1.165 1.818v2.449a5.162 5.162 0 0 0-2.715 1.19L8.017 5.3a2.25 2.25 0 1 0-.944 1.16l5.716 3.864a5.166 5.166 0 0 0-.816 2.898 5.166 5.166 0 0 0 .816 2.898l-1.737 1.237a1.89 1.89 0 1 0 .983 1.09l1.792-1.277a5.166 5.166 0 0 0 3.505 1.179 5.17 5.17 0 0 0 5.115-5.251zm-5.115 3.215a3.212 3.212 0 1 1 0-6.424 3.212 3.212 0 0 1 0 6.424z"/>
  </svg>
);

const RDLogo = () => (
  <svg viewBox="0 0 28 28" className="h-4 w-4">
    <rect width="28" height="28" rx="5" fill="#0071c1"/>
    <text x="3" y="20" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="12" fill="white">RD</text>
  </svg>
);

// ── Connect Modal ─────────────────────────────────────────────────────────────
function ConnectModal({
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
  const [guideOpen, setGuideOpen] = useState(false);
  const { guide } = entry;

  const handleConnect = () => {
    setLoading(true);
    try { onConnect(entry.provider, fields); }
    finally { setLoading(false); }
  };

  const handleOAuth = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const res = await customFetch<Response>(`/api/integrations/oauth/start/${entry.provider}`);
      const body = await res.json() as { url?: string; error?: string; code?: string };

      if (!res.ok || !body.url) {
        if (body.code === "OAUTH_NOT_CONFIGURED") {
          setOauthError("OAuth não configurado no servidor. Use a conexão manual abaixo.");
          setShowManual(true);
        } else {
          setOauthError(body.error ?? "Erro ao iniciar OAuth.");
        }
        return;
      }

      const popup = window.open(body.url, "nexos_oauth", "width=620,height=700,scrollbars=yes,resizable=yes");

      if (!popup) {
        setOauthError("O popup foi bloqueado. Permita popups para este site e tente novamente.");
        return;
      }

      const handler = (event: MessageEvent<{ type?: string; success?: boolean; provider?: string; error?: string }>) => {
        if (event.data?.type !== "oauth_complete") return;
        window.removeEventListener("message", handler);
        setOauthLoading(false);
        if (event.data.success) {
          onOAuthSuccess();
        } else {
          setOauthError(event.data.error ?? "Falha na autenticação.");
        }
      };
      window.addEventListener("message", handler);

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handler);
          setOauthLoading(false);
        }
      }, 600);
    } catch {
      setOauthError("Erro de rede. Tente novamente.");
      setOauthLoading(false);
    }
  };

  const isOAuth = !!entry.oauthPlatform && !showManual;
  const OAUTH_ICONS: Record<string, React.ElementType> = {
    meta: MetaLogo, tiktok: TikTokLogo, google: GoogleLogo,
    hubspot: HubSpotLogo, rdstation: RDLogo,
  };
  const OAUTH_BRAND: Record<string, { bg: string; border: string; color: string }> = {
    meta:      { bg: "rgba(24,119,242,0.07)",  border: "#1877F2", color: "#1877F2" },
    tiktok:    { bg: "rgba(254,44,85,0.07)",   border: "#fe2c55", color: "#fe2c55" },
    google:    { bg: "rgba(66,133,244,0.07)",  border: "#4285F4", color: "#4285F4" },
    hubspot:   { bg: "rgba(255,122,89,0.07)",  border: "#FF7A59", color: "#FF7A59" },
    rdstation: { bg: "rgba(0,113,193,0.07)",   border: "#0071c1", color: "#0071c1" },
  };
  const OAuthIcon = OAUTH_ICONS[entry.oauthPlatform ?? ""] ?? MetaLogo;
  const brand = OAUTH_BRAND[entry.oauthPlatform ?? ""] ?? OAUTH_BRAND["meta"]!;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="border border-border/70 bg-card w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="border-b border-border/50 px-5 py-4 flex items-start justify-between shrink-0">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-widest">Conectar {entry.label}</h3>
            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 ml-3 shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── Why section ── */}
          <div className="px-5 py-3 bg-primary/5 border-b border-border/30 flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] font-mono text-muted-foreground/75 leading-relaxed">{entry.why}</p>
          </div>

          {/* ── Warning banner ── */}
          {guide.warning && (
            <div className="px-5 py-3 bg-yellow-400/8 border-b border-yellow-400/25 flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-mono text-yellow-300/90 leading-relaxed font-medium">{guide.warning}</p>
            </div>
          )}

          {/* ══ OAuth FAST PATH ══════════════════════════════════════════════ */}
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
                style={{
                  borderColor: brand.border,
                  color: brand.color,
                  background: brand.bg,
                }}
              >
                {oauthLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <OAuthIcon />}
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

          {/* ══ MANUAL FORM (shown for non-OAuth or when user chose manual) ══ */}
          {(!entry.oauthPlatform || showManual) && (
            <>
              {entry.oauthPlatform && showManual && (
                <div className="px-5 py-2 border-b border-border/30 flex items-center justify-between bg-muted/5">
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Inserção manual de credenciais</span>
                  <button onClick={() => setShowManual(false)} className="font-mono text-[10px] text-primary hover:underline">
                    ← Usar OAuth
                  </button>
                </div>
              )}

              {/* Prerequisites (only for manual) */}
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

              {/* Step-by-step guide (collapsible) */}
              <div className="border-b border-border/30">
                <button
                  onClick={() => setGuideOpen(v => !v)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-bold">
                      Passo a passo — como encontrar as credenciais
                    </span>
                  </div>
                  {guideOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
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

              {/* Fields */}
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

        {/* ── Footer ── */}
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
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<CatalogEntry | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as WorkspaceIntegration[] };
      return res.json() as Promise<{ integrations: WorkspaceIntegration[] }>;
    },
    staleTime: 30_000,
  });

  const integrations = data?.integrations ?? [];
  const connectedMap = new Map(integrations.filter(i => i.status === "connected").map(i => [i.provider, i]));

  const CRITICAL = ["whatsapp_business", "telegram", "rd_station", "activecampaign", "resend"];
  const hasMessaging = ["whatsapp_business", "telegram"].some(p => connectedMap.has(p as Provider));
  const hasEmail = ["rd_station", "activecampaign", "resend"].some(p => connectedMap.has(p as Provider));
  const isFullAuto = hasMessaging && hasEmail;
  const connectedCount = integrations.filter(i => i.status === "connected").length;

  const connectMutation = useMutation({
    mutationFn: async ({ provider, fields }: { provider: Provider; fields: Record<string, string> }) => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          accountId: fields["accountId"],
          accountName: fields["accountName"],
          accessToken: fields["accessToken"],
          metadata: fields,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao conectar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Integração conectada com sucesso.");
      setConnectModal(null);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      const res = await customFetch<Response>(`/api/workspaces/me/integrations/${integrationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao desconectar");
      toast.success("Integração removida.");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold uppercase tracking-tighter text-foreground">
          Integrações
        </h1>
        <p className="text-sm font-mono text-muted-foreground/60 mt-1">
          Conecte seus canais para ativar o modo Full Auto — disparos automáticos durante o lançamento.
        </p>
      </div>

      {/* Full Auto status bar */}
      <div className={`border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isFullAuto ? "border-success/30 bg-success/5" : "border-yellow-400/25 bg-yellow-400/5"
      }`}>
        <div className="flex items-center gap-3">
          {isFullAuto
            ? <Wifi className="h-5 w-5 text-success shrink-0" />
            : <WifiOff className="h-5 w-5 text-yellow-400 shrink-0" />}
          <div>
            <div className={`font-mono font-bold uppercase tracking-widest text-sm ${isFullAuto ? "text-success" : "text-yellow-400"}`}>
              {isFullAuto ? "Full Auto — Pronto para lançar" : "Modo Parcial — Configure para lançar"}
            </div>
            <div className="text-xs font-mono text-muted-foreground/60 mt-0.5">
              {isFullAuto
                ? `${connectedCount} integrações ativas. Todos os disparos automáticos ativados.`
                : `Conecte ${!hasMessaging ? "um canal de Mensagens" : ""}${!hasMessaging && !hasEmail ? " e " : ""}${!hasEmail ? "um canal de E-mail" : ""} para lançar campanhas.`}
            </div>
          </div>
        </div>
        {!isFullAuto && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {!hasMessaging && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />Mensagens — obrigatório para lançar
              </Badge>
            )}
            {!hasEmail && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />E-mail — obrigatório para lançar
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Integration catalog grouped by category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(cat => {
            const items = CATALOG.filter(c => c.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40">{cat}</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="space-y-2">
                  {items.map(entry => {
                    const isConn = connectedMap.has(entry.provider);
                    const integration = connectedMap.get(entry.provider);
                    const Icon = entry.icon;
                    return (
                      <div
                        key={entry.provider}
                        className={`border flex flex-col sm:flex-row sm:items-center gap-4 p-4 transition-all ${
                          isConn
                            ? "border-success/30 bg-success/5"
                            : entry.required
                            ? "border-yellow-400/25 bg-yellow-400/5"
                            : "border-border/50 bg-card/30"
                        }`}
                      >
                        {/* Icon + name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-8 w-8 border flex items-center justify-center shrink-0 ${isConn ? "border-success/30 bg-success/10" : "border-border/40 bg-muted/20"}`}>
                            <Icon className={`h-4 w-4 ${isConn ? "text-success" : entry.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-sm">{entry.label}</span>
                              {entry.required && !isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 rounded-none px-1.5 py-0">obrigatório</Badge>
                              )}
                              {isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-success/40 text-success rounded-none px-1.5 py-0 gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />conectado
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
                            {isConn && integration?.accountName && (
                              <p className="text-[10px] font-mono text-success/70 mt-0.5">{integration.accountName}</p>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isConn ? (
                            <button
                              onClick={() => integration && handleDisconnect(integration.id)}
                              disabled={disconnecting === integration?.id}
                              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1"
                            >
                              {disconnecting === integration?.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <XCircle className="h-3 w-3" />}
                              Desconectar
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setConnectModal(entry)}
                              className={`font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-[11px] ${
                                entry.required
                                  ? "btn-weapon-primary"
                                  : "bg-muted/40 hover:bg-muted/60 text-foreground border border-border/50"
                              }`}
                            >
                              <Link2 className="h-3 w-3" />
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

      {/* Connect modal */}
      {connectModal && (
        <ConnectModal
          entry={connectModal}
          onClose={() => setConnectModal(null)}
          onConnect={(provider, fields) => connectMutation.mutate({ provider, fields })}
          onOAuthSuccess={() => {
            toast.success("Integração conectada com sucesso via OAuth.");
            setConnectModal(null);
            queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
          }}
        />
      )}
    </div>
  );
}
