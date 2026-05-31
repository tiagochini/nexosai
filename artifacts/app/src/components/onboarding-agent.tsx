import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Bot, ChevronDown, ChevronUp, CheckCircle2, Circle,
  ExternalLink, Instagram, MessageSquare, ArrowRight, Sparkles,
  Facebook, Shield, Music2, BarChart2, Search,
} from "lucide-react";

interface WorkspaceIntegration {
  provider: string;
  status: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  detail: string;
  url?: string;
  important?: string;
}

interface OnboardingFlow {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
  connectProvider?: string;
  tag?: string;
}

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.01a8.16 8.16 0 004.77 1.52V7.07a4.85 4.85 0 01-1-.38z"/>
  </svg>
);

const FLOWS: OnboardingFlow[] = [
  // ── Meta / Instagram ────────────────────────────────────────────────────────
  {
    id: "meta_app_review",
    icon: Shield,
    color: "text-yellow-400",
    title: "Submeter Meta App Review",
    subtitle: "Libera publicação automática no Instagram e Facebook — urgente",
    tag: "URGENTE",
    steps: [
      {
        id: "privacy_policy",
        title: "Publique uma Privacy Policy acessível",
        detail: "O Meta exige uma URL pública. Use agencianexos.vip/privacy (já está configurada) ou iubenda.com (grátis e profissional). Inclua: quais dados coleta, como usa tokens de redes sociais, e como o usuário pode revogar acesso.",
        url: "https://www.iubenda.com/en/privacy-and-cookie-policy-generator",
        important: "Sem Privacy Policy o App Review é rejeitado automaticamente.",
      },
      {
        id: "business_verify",
        title: "Verifique o negócio com seu ABN",
        detail: "No Meta Business Manager → Configurações → Central de Segurança → Verificação da empresa. Selecione Austrália como país. Use seu ABN como número de registro — sole traders são aceitos. Tenha em mãos: extrato bancário ou documento oficial com seu nome e ABN.",
        url: "https://business.facebook.com/settings/security",
        important: "ABN funciona para sole traders. Você não precisa de Pty Ltd.",
      },
      {
        id: "demo_video",
        title: "Grave um vídeo demo do fluxo",
        detail: "O Meta pede um vídeo mostrando como seu app usa cada permissão. Mostre: login com Instagram → o app carregando dados → um post sendo publicado automaticamente durante um lançamento. Resolução mínima 720p, pode ser gravação de tela.",
      },
      {
        id: "submit_scopes",
        title: "Submeta os escopos no App Review",
        detail: "Em developers.facebook.com → seu app → App Review → Solicitar permissões. Submeta: instagram_content_publish, pages_manage_posts, instagram_basic, pages_read_engagement, business_management. Para cada escopo, explique o caso de uso em 1–2 frases.",
        url: "https://developers.facebook.com/apps/992748096543542/app-review/",
        important: "Prazo: 5–10 dias úteis. Submeta agora para não atrasar o lançamento.",
      },
      {
        id: "wait_review",
        title: "Aguarde e responda perguntas",
        detail: "O Meta pode pedir esclarecimentos por email. Responda em até 24h ou o processo é pausado. Se rejeitado, releia o motivo — geralmente é a Privacy Policy ou a demonstração do uso.",
      },
    ],
  },
  {
    id: "instagram_business",
    icon: Instagram,
    color: "text-pink-400",
    title: "Converter Instagram para Business",
    subtitle: "Necessário para publicação automática de conteúdo",
    steps: [
      {
        id: "open_settings",
        title: "Abra o Instagram no celular",
        detail: "Toque na foto do perfil → depois no menu (≡) no canto superior direito.",
      },
      {
        id: "go_account",
        title: "Vá em Configurações e privacidade",
        detail: "Role até encontrar 'Tipo de conta e ferramentas' → toque em 'Mudar para conta profissional'.",
      },
      {
        id: "choose_business",
        title: "Escolha 'Empresa'",
        detail: "Selecione a categoria que melhor descreve seu negócio. Se não encontrar uma exata, use 'Empreendedor'.",
      },
      {
        id: "link_facebook",
        title: "Vincule à Página do Facebook",
        detail: "O Instagram vai pedir para vincular a uma Página. Se não tiver, toque em 'Não vincular agora' — você pode fazer depois.",
      },
      {
        id: "done",
        title: "Pronto — agora conecte aqui",
        detail: "Com a conta convertida, volte aqui e clique em 'Entrar com Instagram'.",
      },
    ],
    connectProvider: "instagram",
  },
  {
    id: "facebook_page",
    icon: Facebook,
    color: "text-blue-400",
    title: "Criar Página do Facebook",
    subtitle: "Necessário para publicação orgânica no Facebook",
    steps: [
      {
        id: "open_fb",
        title: "Acesse o Facebook",
        detail: "No app ou no computador, clique no menu (≡) → 'Páginas'.",
        url: "https://www.facebook.com/pages/create",
      },
      {
        id: "create_page",
        title: "Clique em 'Criar nova Página'",
        detail: "Escolha o nome da sua empresa ou produto. Adicione foto de perfil e capa.",
      },
      {
        id: "link_instagram",
        title: "Vincule seu Instagram Business (opcional)",
        detail: "Na sua nova Página → Configurações → Instagram → 'Conectar conta'. Isso permite publicar nos dois ao mesmo tempo.",
      },
      {
        id: "connect_here",
        title: "Volte aqui e conecte",
        detail: "Com a Página criada, clique em 'Entrar com Facebook' na integração do Facebook acima.",
      },
    ],
    connectProvider: "facebook",
  },

  // ── TikTok ──────────────────────────────────────────────────────────────────
  {
    id: "tiktok_developer",
    icon: TikTokIcon,
    color: "text-pink-400",
    title: "Configurar TikTok Developer",
    subtitle: "Necessário para publicação orgânica e anúncios no TikTok",
    steps: [
      {
        id: "create_account",
        title: "Crie conta em developers.tiktok.com",
        detail: "Acesse developers.tiktok.com e clique em 'Login / Register'. Use sua conta TikTok Business ou crie uma nova.",
        url: "https://developers.tiktok.com",
      },
      {
        id: "create_app",
        title: "Crie um novo app",
        detail: "No Developer Portal → 'Manage Apps' → 'Create App'. Preencha: nome (NexOS), categoria (Content/Marketing), website (URL do app). Salve.",
      },
      {
        id: "request_scopes",
        title: "Solicite os escopos de publicação",
        detail: "No seu app → 'Add products' → 'Content Posting API'. Solicite: video.publish, video.upload, user.info.basic. Para TikTok Ads também adicione 'TikTok for Business Marketing API'.",
        important: "O TikTok revisa apps em 3–7 dias úteis. Submeta agora.",
      },
      {
        id: "add_redirect",
        title: "Adicione as URLs de callback",
        detail: `No app → Settings → adicione a URL de redirect:\n${window.location.origin}/api/integrations/oauth/callback/tiktok\n${window.location.origin}/api/integrations/oauth/callback/tiktok_ads`,
      },
      {
        id: "get_credentials",
        title: "Copie o Client Key e Client Secret",
        detail: "Em 'App Details' você encontra o Client Key e Client Secret. Eles precisam ser configurados no servidor como TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET para ativar o OAuth.",
        important: "Informe essas credenciais ao administrador da plataforma.",
      },
    ],
  },

  // ── Google Ads ──────────────────────────────────────────────────────────────
  {
    id: "google_ads_setup",
    icon: Search,
    color: "text-cyan-400",
    title: "Configurar Google Ads",
    subtitle: "Campanhas de pesquisa e remarketing durante o lançamento",
    steps: [
      {
        id: "google_cloud",
        title: "Crie um projeto no Google Cloud Console",
        detail: "Acesse console.cloud.google.com → 'Novo Projeto' → nomeie como 'NexOS'. Ative a 'Google Ads API' em APIs & Services → Library.",
        url: "https://console.cloud.google.com",
      },
      {
        id: "oauth_credentials",
        title: "Crie credenciais OAuth 2.0",
        detail: "APIs & Services → Credentials → Create Credentials → OAuth Client ID. Tipo: 'Web Application'. Adicione a URL de redirect: .../callback/google_ads. Copie o Client ID e Client Secret.",
      },
      {
        id: "developer_token",
        title: "Solicite o Developer Token no Google Ads",
        detail: "No Google Ads → Ferramentas e Configurações → API Center → Solicitar acesso de desenvolvedor. Preencha o questionário. O Google pode levar alguns dias para aprovar.",
        url: "https://ads.google.com/aw/apicenter",
        important: "Sem o Developer Token aprovado a API não funciona — solicite agora.",
      },
      {
        id: "configure_vars",
        title: "Configure as variáveis de ambiente",
        detail: "Informe ao administrador da plataforma: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (do Cloud Console). Após configurados, o botão 'Entrar com Google' ficará disponível.",
      },
    ],
  },

  // ── LinkedIn Ads ─────────────────────────────────────────────────────────────
  {
    id: "linkedin_ads_setup",
    icon: BarChart2,
    color: "text-blue-500",
    title: "Configurar LinkedIn Ads",
    subtitle: "Anúncios B2B e alto ticket — aprovação em 1–3 dias",
    steps: [
      {
        id: "campaign_manager",
        title: "Crie sua conta no Campaign Manager",
        detail: "Acesse linkedin.com/campaignmanager → criar conta. Adicione método de pagamento (cartão de crédito australiano funciona).",
        url: "https://www.linkedin.com/campaignmanager",
      },
      {
        id: "developer_app",
        title: "Crie um app no LinkedIn Developer Portal",
        detail: "Acesse developer.linkedin.com/apps → Create App. Nome: NexOS. Vincule à sua Página do LinkedIn.",
        url: "https://developer.linkedin.com/apps",
      },
      {
        id: "request_marketing_api",
        title: "Solicite acesso à Marketing Developer Platform",
        detail: "No seu app → Products → 'Request access' ao lado de 'Marketing Developer Platform'. Preencha o formulário explicando o caso de uso de automação de lançamentos.",
        important: "Aprovação: 1–3 dias úteis. É necessário para anúncios via API.",
      },
      {
        id: "redirect_url",
        title: "Configure o redirect URI",
        detail: `No app → Auth → OAuth 2.0 settings → adicione:\n${window.location.origin}/api/integrations/oauth/callback/linkedin_ads`,
      },
      {
        id: "get_credentials",
        title: "Copie Client ID e Client Secret",
        detail: "Em Auth → Application Credentials: copie o Client ID e Client Secret. Configure no servidor como LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET.",
      },
    ],
  },

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  {
    id: "whatsapp_business",
    icon: MessageSquare,
    color: "text-green-400",
    title: "Configurar WhatsApp Business API",
    subtitle: "Obrigatório para disparos automáticos de sequências",
    steps: [
      {
        id: "business_suite",
        title: "Acesse o Meta Business Suite",
        detail: "Vá em business.facebook.com → faça login com sua conta Facebook que tem a Página.",
        url: "https://business.facebook.com",
      },
      {
        id: "whatsapp_section",
        title: "Adicione o WhatsApp Business",
        detail: "No painel → Configurações → WhatsApp → Adicionar número. Siga o processo de verificação por SMS.",
      },
      {
        id: "developer_app",
        title: "Adicione WhatsApp ao seu app Meta",
        detail: "Em developers.facebook.com → seu app NexOS → Adicionar produto → WhatsApp. Siga as instruções de configuração.",
        url: "https://developers.facebook.com/apps/992748096543542",
      },
      {
        id: "get_token",
        title: "Gere o Token de Acesso",
        detail: "WhatsApp → Configuração → gere o token de acesso permanente. Copie também o Phone Number ID.",
      },
      {
        id: "connect_here",
        title: "Cole as credenciais na integração",
        detail: "Na integração WhatsApp Business, clique em 'Conectar' e insira o Phone Number ID e o Access Token.",
      },
    ],
  },
];

export function OnboardingAgent({
  connectedProviders,
  onConnect,
}: {
  connectedProviders: string[];
  onConnect: (provider: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, Set<string>>>({});

  const hasInstagram = connectedProviders.includes("instagram");
  const hasFacebook  = connectedProviders.includes("instagram");
  const hasWhatsApp  = connectedProviders.includes("whatsapp_business");
  const hasTikTok    = connectedProviders.includes("tiktok_ads");
  const hasGoogle    = connectedProviders.includes("google_ads");
  const hasLinkedIn  = connectedProviders.includes("linkedin_ads");

  const suggestedFlows = FLOWS.filter(f => {
    if (f.id === "instagram_business"  && hasInstagram) return false;
    if (f.id === "facebook_page"       && hasFacebook)  return false;
    if (f.id === "whatsapp_business"   && hasWhatsApp)  return false;
    if (f.id === "tiktok_developer"    && hasTikTok)    return false;
    if (f.id === "google_ads_setup"    && hasGoogle)    return false;
    if (f.id === "linkedin_ads_setup"  && hasLinkedIn)  return false;
    return true;
  });

  if (suggestedFlows.length === 0) return null;

  const currentFlow = activeFlow ? FLOWS.find(f => f.id === activeFlow) : null;
  const flowSteps   = currentFlow?.steps ?? [];
  const doneSteps   = completedSteps[activeFlow ?? ""] ?? new Set<string>();
  const allStepsDone = flowSteps.length > 0 && doneSteps.size >= flowSteps.length;

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const key = activeFlow ?? "";
      const cur = new Set(prev[key] ?? []);
      if (cur.has(stepId)) cur.delete(stepId); else cur.add(stepId);
      return { ...prev, [key]: cur };
    });
  };

  // priority flows first — urgent ones
  const orderedFlows = [
    ...suggestedFlows.filter(f => f.tag === "URGENTE"),
    ...suggestedFlows.filter(f => f.tag !== "URGENTE"),
  ];

  return (
    <div className="border border-primary/20 bg-primary/5">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="h-7 w-7 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-mono font-bold uppercase tracking-widest text-xs text-primary flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Agente de Setup — {suggestedFlows.length} {suggestedFlows.length === 1 ? "passo pendente" : "passos pendentes"}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
            Vou te guiar para configurar cada integração — passo a passo, sem complicação
          </div>
        </div>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-primary/10">
          {!activeFlow ? (
            /* Flow selection */
            <div className="p-4 space-y-2">
              <p className="font-mono text-[11px] text-muted-foreground/60 mb-3">
                Selecione o que quer configurar agora:
              </p>
              {orderedFlows.map(flow => {
                const Icon = flow.icon;
                const done = completedSteps[flow.id]?.size ?? 0;
                const total = flow.steps.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setActiveFlow(flow.id)}
                    className="w-full border border-border/40 bg-card/30 hover:border-primary/30 hover:bg-primary/5 flex items-center gap-3 p-3 text-left transition-all group"
                  >
                    <div className="h-7 w-7 border border-border/40 group-hover:border-primary/30 flex items-center justify-center shrink-0">
                      <Icon className={`h-3.5 w-3.5 ${flow.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-semibold flex items-center gap-1.5 flex-wrap">
                        {flow.title}
                        {flow.tag && (
                          <span className="text-[9px] font-mono uppercase tracking-widest border border-yellow-400/50 text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5">
                            {flow.tag}
                          </span>
                        )}
                        {done > 0 && (
                          <span className="text-[9px] font-mono text-success/70 ml-auto">{pct}%</span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">{flow.subtitle}</div>
                      {done > 0 && (
                        <div className="mt-1.5 w-full h-0.5 bg-border/30 overflow-hidden">
                          <div className="h-full bg-success/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* Active flow */
            <div className="p-4">
              {/* Flow header */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setActiveFlow(null)}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-primary/60 transition-colors"
                >
                  ← Voltar
                </button>
                {currentFlow && (
                  <>
                    <span className="text-muted-foreground/20">|</span>
                    <span className="font-mono text-xs font-semibold">{currentFlow.title}</span>
                    {currentFlow.tag && (
                      <span className="text-[9px] font-mono uppercase tracking-widest border border-yellow-400/50 text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5">
                        {currentFlow.tag}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-2 mb-4">
                {flowSteps.map((step, idx) => {
                  const done = doneSteps.has(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`border p-3 transition-all ${done ? "border-success/30 bg-success/5" : "border-border/40 bg-card/20"}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleStep(step.id)}
                          className="mt-0.5 shrink-0"
                        >
                          {done
                            ? <CheckCircle2 className="h-4 w-4 text-success" />
                            : <Circle className="h-4 w-4 text-muted-foreground/30 hover:text-primary/50 transition-colors" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`font-mono text-xs font-semibold flex items-center gap-1.5 ${done ? "line-through text-muted-foreground/40" : ""}`}>
                            <span className="text-muted-foreground/30 text-[10px]">{String(idx + 1).padStart(2, "0")}</span>
                            {step.title}
                          </div>
                          {!done && (
                            <p className="font-mono text-[11px] text-muted-foreground/60 mt-1 leading-relaxed whitespace-pre-line">{step.detail}</p>
                          )}
                          {!done && step.important && (
                            <div className="mt-1.5 border border-yellow-400/30 bg-yellow-400/5 px-2 py-1 font-mono text-[10px] text-yellow-400/80">
                              ⚠ {step.important}
                            </div>
                          )}
                          {!done && step.url && (
                            <a
                              href={step.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 font-mono text-[10px] uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              Abrir link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              {allStepsDone && currentFlow?.connectProvider && (
                <div className="border border-success/30 bg-success/5 p-3">
                  <p className="font-mono text-[11px] text-success/80 mb-2">
                    Todos os passos concluídos! Clique para conectar agora:
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (currentFlow.connectProvider) {
                        onConnect(currentFlow.connectProvider);
                        setActiveFlow(null);
                      }
                    }}
                    className="btn-weapon-primary font-mono uppercase tracking-widest rounded-none h-8 px-4 text-[11px] gap-1.5"
                  >
                    <Sparkles className="h-3 w-3" />
                    Conectar agora
                  </Button>
                </div>
              )}

              {allStepsDone && !currentFlow?.connectProvider && (
                <div className="border border-success/30 bg-success/5 p-3">
                  <p className="font-mono text-[11px] text-success/80">
                    Perfeito! Agora que você tem as credenciais, conecte na lista de integrações abaixo.
                  </p>
                  <button
                    onClick={() => setActiveFlow(null)}
                    className="mt-2 font-mono text-[10px] uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                  >
                    ← Ver integrações
                  </button>
                </div>
              )}

              {!allStepsDone && (
                <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
                  Marque cada passo como feito (✓) ao concluir
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useOnboardingAgent() {
  const { data } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      return customFetch<{ integrations: WorkspaceIntegration[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as WorkspaceIntegration[] }));
    },
    staleTime: 30_000,
  });
  const connected = (data?.integrations ?? [])
    .filter(i => i.status === "connected")
    .map(i => i.provider);
  return { connectedProviders: connected };
}
