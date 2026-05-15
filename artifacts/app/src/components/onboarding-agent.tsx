import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import {
  Bot, ChevronDown, ChevronUp, CheckCircle2, Circle,
  ExternalLink, Instagram, MessageSquare, ArrowRight, Sparkles,
  Facebook,
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
}

interface OnboardingFlow {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
  connectProvider?: string;
}

const FLOWS: OnboardingFlow[] = [
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
        detail: "Selecione a categoria que melhor descreve seu negócio. Se não encontrar uma exata, use 'Empreendedor' ou 'Criador de conteúdo'.",
      },
      {
        id: "link_facebook",
        title: "Vincule a uma Página do Facebook",
        detail: "O Instagram vai pedir para vincular a uma Página. Se não tiver, toque em 'Não vincular agora' — você pode fazer depois.",
      },
      {
        id: "done",
        title: "Pronto — agora conecte aqui",
        detail: "Com a conta convertida, volte aqui e clique em 'Entrar com Instagram' na integração do Instagram.",
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
        detail: "Escolha o nome da sua empresa ou produto. Adicione uma foto de perfil e capa.",
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
        detail: "No painel → 'Configurações' → 'WhatsApp' → 'Adicionar número'. Siga o processo de verificação por SMS.",
      },
      {
        id: "developer_app",
        title: "No Meta Developers, adicione o produto WhatsApp",
        detail: "Acesse seu app NexOS AI em developers.facebook.com → 'Adicionar produto' → WhatsApp. Siga as instruções.",
        url: "https://developers.facebook.com/apps/992748096543542",
      },
      {
        id: "get_token",
        title: "Gere o Token de Acesso",
        detail: "No painel do app → WhatsApp → Configuração → 'Gerar token'. Copie o Phone Number ID e o Token.",
      },
      {
        id: "connect_here",
        title: "Cole as credenciais aqui",
        detail: "Na integração WhatsApp Business acima, clique em 'Conectar' e insira o Phone Number ID e o Access Token.",
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
  const hasFacebook = connectedProviders.includes("instagram"); // shares token
  const hasWhatsApp = connectedProviders.includes("whatsapp_business");

  const suggestedFlows = FLOWS.filter(f => {
    if (f.id === "instagram_business" && hasInstagram) return false;
    if (f.id === "facebook_page" && hasFacebook) return false;
    if (f.id === "whatsapp_business" && hasWhatsApp) return false;
    return true;
  });

  if (suggestedFlows.length === 0) return null;

  const currentFlow = activeFlow ? FLOWS.find(f => f.id === activeFlow) : null;
  const flowSteps = currentFlow?.steps ?? [];
  const doneSteps = completedSteps[activeFlow ?? ""] ?? new Set<string>();
  const allStepsDone = flowSteps.length > 0 && doneSteps.size >= flowSteps.length;

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const key = activeFlow ?? "";
      const cur = new Set(prev[key] ?? []);
      if (cur.has(stepId)) cur.delete(stepId); else cur.add(stepId);
      return { ...prev, [key]: cur };
    });
  };

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
            Vou te guiar para configurar tudo sem complicação
          </div>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-primary/10">
          {!activeFlow ? (
            /* Flow selection */
            <div className="p-4 space-y-2">
              <p className="font-mono text-[11px] text-muted-foreground/60 mb-3">
                Selecione o que quer configurar agora — vou te guiar passo a passo:
              </p>
              {suggestedFlows.map(flow => {
                const Icon = flow.icon;
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
                      <div className="font-mono text-xs font-semibold">{flow.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">{flow.subtitle}</div>
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
                            <p className="font-mono text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{step.detail}</p>
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
                    Todos os passos concluídos! Agora conecte a integração:
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
                    Perfeito! Agora volte à lista de integrações e clique em Conectar no canal desejado.
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
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as WorkspaceIntegration[] };
      return res.json() as Promise<{ integrations: WorkspaceIntegration[] }>;
    },
    staleTime: 30_000,
  });
  const connected = (data?.integrations ?? [])
    .filter(i => i.status === "connected")
    .map(i => i.provider);
  return { connectedProviders: connected };
}
