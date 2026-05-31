/**
 * PreLaunchChecklist — Gate obrigatório antes de lançar uma campanha.
 *
 * Aparece no status "approved" antes de liberar o botão "Lançar".
 * Verifica:
 *   1. Integrações obrigatórias (WhatsApp/Telegram + Email)
 *   2. Revisão dos criativos principais (CPL, VSL, sequências)
 *
 * Para cada integração ausente, exibe o wizard passo a passo inline.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, MessageCircle, Mail, FileText, Video,
  Rocket, ShieldCheck, Zap,
} from "lucide-react";

// ─── Integration setup wizards ────────────────────────────────────────────────

const INTEGRATION_WIZARDS = {
  whatsapp: {
    name: "WhatsApp Business API",
    category: "messaging",
    icon: "💬",
    why: "Disparar mensagens para leads, sequências e notificações de abertura do carrinho",
    steps: [
      { label: "Acesse o Meta Business Manager", detail: "Vá em business.facebook.com → Configurações → WhatsApp", url: "https://business.facebook.com" },
      { label: "Adicione seu número de telefone", detail: "Menu WhatsApp → Números de Telefone → Adicionar número. Verifique via SMS ou ligação." },
      { label: "Crie um App na Meta for Developers", detail: "developers.facebook.com → Meus Apps → Criar App → Negócios. Adicione o produto WhatsApp Business.", url: "https://developers.facebook.com" },
      { label: "Obtenha as credenciais", detail: "No painel do App: copie o Phone Number ID (ex: 1234567890) e o Token de Acesso Permanente (começa com EAAB...)" },
      { label: "Cole aqui no NexOS AI", detail: "Configurações → Integrações → WhatsApp Business → Colar credenciais → Conectar" },
    ],
  },
  telegram: {
    name: "Telegram Bot",
    category: "messaging",
    icon: "✈️",
    why: "Alternativa ao WhatsApp para disparo de mensagens em grupos e canais de leads",
    steps: [
      { label: "Abra o Telegram e procure @BotFather", detail: "Pesquise @BotFather na barra de busca do Telegram" },
      { label: "Crie um bot novo", detail: "Envie o comando /newbot → escolha um nome → escolha um username (deve terminar em 'bot')" },
      { label: "Copie o token gerado", detail: "O BotFather vai responder com um token no formato 1234567890:ABCdef..." },
      { label: "Cole o token no NexOS AI", detail: "Configurações → Integrações → Telegram → Colar token → Conectar" },
    ],
  },
  rd_station: {
    name: "RD Station Marketing",
    category: "email",
    icon: "📧",
    why: "Criar e disparar fluxos de email para leads capturados durante o lançamento",
    steps: [
      { label: "Acesse o RD Station", detail: "Vá em app.rdstation.com → crie sua conta (tem plano gratuito)", url: "https://app.rdstation.com" },
      { label: "Gere uma chave de API", detail: "Menu → Configurações → Integrações → API → Gerar nova chave de API" },
      { label: "Copie a chave gerada", detail: "A chave tem formato longo de letras e números. Copie ela completa." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → RD Station → Colar chave → Conectar" },
    ],
  },
  activecampaign: {
    name: "ActiveCampaign",
    category: "email",
    icon: "📨",
    why: "Automação de email marketing e segmentação de leads durante o lançamento",
    steps: [
      { label: "Acesse o ActiveCampaign", detail: "activecampaign.com → crie ou entre na sua conta", url: "https://www.activecampaign.com" },
      { label: "Encontre suas credenciais de API", detail: "Clique no ícone do usuário → Minha Conta → Developer → veja a URL da API e a Chave de API" },
      { label: "Copie a URL e a chave", detail: "URL: algo como https://sua-conta.api-us1.com. Chave: sequência longa. Copie ambas." },
      { label: "Cole no NexOS AI", detail: "Configurações → Integrações → ActiveCampaign → Colar URL e chave → Conectar" },
    ],
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  provider: string;
  status: string;
}

interface ContentPiece {
  id: string;
  type: string;
  status: string;
  platform?: string;
  title?: string;
}

interface Gate {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pass" | "warn" | "fail";
  detail: string;
  wizardKey?: keyof typeof INTEGRATION_WIZARDS;
  link?: string;
}

interface Props {
  campaignId: string;
  onLaunchReady: (ready: boolean) => void;
  onLaunch: () => void;
  launching: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreLaunchChecklist({ campaignId, onLaunchReady, onLaunch, launching }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [content, setContent] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWizard, setExpandedWizard] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] })),
      customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] })),
    ]).then(([intRes, contRes]) => {
      setIntegrations(intRes.integrations ?? []);
      setContent(contRes.pieces ?? []);
      setLoading(false);
    });
  }, [campaignId]);

  const isConnected = (providers: string[]) =>
    integrations.some(i => providers.includes(i.provider) && i.status === "connected");

  const hasMessaging = isConnected(["whatsapp_business", "telegram"]);
  const hasEmail = isConnected(["rd_station", "activecampaign"]);

  const whatsappConn = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
  const telegramConn = integrations.find(i => i.provider === "telegram" && i.status === "connected");
  const rdConn = integrations.find(i => i.provider === "rd_station" && i.status === "connected");
  const acConn = integrations.find(i => i.provider === "activecampaign" && i.status === "connected");

  const missingMessaging = !whatsappConn ? "whatsapp" as const : !telegramConn ? "telegram" as const : null;
  const missingEmail = !rdConn ? "rd_station" as const : !acConn ? "activecampaign" as const : null;

  const cplPiece = content.find(p => p.type === "cpl_script" || p.type?.includes("cpl"));
  const vslPiece = content.find(p => p.type === "vsl_script" || p.type?.includes("vsl"));
  const emailPieces = content.filter(p => p.type?.includes("email") || p.type?.includes("sequence"));

  const cplApproved = !cplPiece || cplPiece.status === "approved";
  const vslApproved = !vslPiece || vslPiece.status === "approved";
  const emailApproved = emailPieces.length === 0 || emailPieces.some(p => p.status === "approved");

  const allReady = hasMessaging && hasEmail && cplApproved && vslApproved;

  useEffect(() => {
    if (!loading) onLaunchReady(allReady);
  }, [loading, allReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const gates: Gate[] = [
    {
      id: "messaging",
      label: "Canal de Mensagens",
      icon: <MessageCircle className="h-4 w-4" />,
      status: hasMessaging ? "pass" : "fail",
      detail: hasMessaging
        ? `${whatsappConn ? "WhatsApp Business" : "Telegram"} conectado`
        : "WhatsApp Business ou Telegram obrigatório para disparar mensagens aos leads",
      wizardKey: hasMessaging ? undefined : missingMessaging ?? undefined,
    },
    {
      id: "email",
      label: "Plataforma de Email",
      icon: <Mail className="h-4 w-4" />,
      status: hasEmail ? "pass" : "fail",
      detail: hasEmail
        ? `${rdConn ? "RD Station" : "ActiveCampaign"} conectado`
        : "RD Station ou ActiveCampaign obrigatório para sequências de email do lançamento",
      wizardKey: hasEmail ? undefined : missingEmail ?? undefined,
    },
    {
      id: "cpl",
      label: "Script CPL revisado",
      icon: <FileText className="h-4 w-4" />,
      status: !cplPiece ? "warn" : cplApproved ? "pass" : "warn",
      detail: !cplPiece
        ? "Script CPL não foi gerado — verifique a geração de conteúdo"
        : cplApproved
        ? "Script CPL aprovado"
        : "Script CPL aguarda sua revisão antes do lançamento",
      link: !cplApproved ? `/campaigns/${campaignId}/content` : undefined,
    },
    {
      id: "vsl",
      label: "Script VSL revisado",
      icon: <Video className="h-4 w-4" />,
      status: !vslPiece ? "warn" : vslApproved ? "pass" : "warn",
      detail: !vslPiece
        ? "Script VSL não foi gerado — verifique a geração de conteúdo"
        : vslApproved
        ? "Script VSL aprovado"
        : "Script VSL aguarda sua revisão antes do lançamento",
      link: !vslApproved ? `/campaigns/${campaignId}/content` : undefined,
    },
  ];

  const passCount = gates.filter(g => g.status === "pass").length;
  const failCount = gates.filter(g => g.status === "fail").length;

  if (loading) {
    return (
      <div className="border border-border/30 rounded-none p-6 flex items-center justify-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-mono text-sm text-muted-foreground">Verificando pré-requisitos de lançamento...</span>
      </div>
    );
  }

  return (
    <div className="border border-primary/30 bg-card/20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">
              Pré-Lançamento — Checklist Obrigatório
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {failCount > 0
                ? `${failCount} item${failCount > 1 ? "s" : ""} obrigatório${failCount > 1 ? "s" : ""} pendente${failCount > 1 ? "s" : ""} — configure antes de lançar`
                : allReady
                ? "Tudo pronto — você pode lançar agora"
                : `${passCount}/${gates.length} itens verificados`}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] uppercase tracking-widest ${
            allReady
              ? "border-green-500/40 text-green-400 bg-green-500/5"
              : failCount > 0
              ? "border-red-500/40 text-red-400 bg-red-500/5"
              : "border-yellow-500/40 text-yellow-400 bg-yellow-500/5"
          }`}
        >
          {allReady ? "✓ Pronto" : failCount > 0 ? `${failCount} pendente${failCount > 1 ? "s" : ""}` : "Revisão"}
        </Badge>
      </div>

      {/* Gates */}
      <div className="divide-y divide-border/20">
        {gates.map(gate => {
          const isOpen = expandedWizard === gate.id;
          const wizard = gate.wizardKey ? INTEGRATION_WIZARDS[gate.wizardKey] : null;

          return (
            <div key={gate.id}>
              {/* Gate row */}
              <div
                className={`flex items-start gap-3 px-5 py-4 ${wizard ? "cursor-pointer hover:bg-background/30 transition-colors" : ""}`}
                onClick={() => wizard && setExpandedWizard(isOpen ? null : gate.id)}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {gate.status === "pass" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                  {gate.status === "fail" && <XCircle className="h-4 w-4 text-red-400" />}
                  {gate.status === "warn" && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                </div>

                {/* Icon + label */}
                <div className={`shrink-0 ${gate.status === "pass" ? "text-green-400/60" : gate.status === "fail" ? "text-red-400/60" : "text-yellow-400/60"}`}>
                  {gate.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-xs font-bold ${gate.status === "pass" ? "text-green-300" : gate.status === "fail" ? "text-red-300" : "text-yellow-300"}`}>
                    {gate.label}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{gate.detail}</div>
                </div>

                {/* Action */}
                {wizard && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-primary/70 uppercase tracking-widest">
                      {isOpen ? "Fechar guia" : "Ver passo a passo"}
                    </span>
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-primary/50" /> : <ChevronDown className="h-3.5 w-3.5 text-primary/50" />}
                  </div>
                )}
                {gate.link && gate.status !== "pass" && (
                  <Link href={gate.link}>
                    <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase shrink-0 h-7 px-3 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                      Revisar
                    </Button>
                  </Link>
                )}
              </div>

              {/* Inline wizard */}
              {isOpen && wizard && (
                <div className="mx-5 mb-4 border border-primary/20 bg-primary/5">
                  {/* Wizard header */}
                  <div className="px-4 py-3 border-b border-primary/15 flex items-start gap-3">
                    <span className="text-xl shrink-0">{wizard.icon}</span>
                    <div>
                      <div className="font-mono text-xs font-bold text-primary">{wizard.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{wizard.why}</div>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="p-4 space-y-2">
                    <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-3">
                      Siga os passos abaixo para conectar agora:
                    </div>
                    {wizard.steps.map((step, idx) => {
                      const stepOpen = expandedStep === idx;
                      return (
                        <div
                          key={idx}
                          className="border border-border/30 bg-background/30 cursor-pointer hover:bg-background/50 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setExpandedStep(stepOpen ? null : idx); }}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="w-5 h-5 rounded bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                              <span className="font-mono text-[9px] font-bold text-primary">{idx + 1}</span>
                            </div>
                            <div className="font-mono text-[11px] font-medium flex-1">{step.label}</div>
                            {stepOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                          </div>
                          {stepOpen && (
                            <div className="px-11 pb-3">
                              <div className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">{step.detail}</div>
                              {("url" in step) && (step as { url?: string }).url && (
                                <a
                                  href={(step as { url?: string }).url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Abrir agora
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* After completing wizard, connect in settings */}
                    <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
                      <div className="font-mono text-[10px] text-muted-foreground/40">
                        Após conectar, esta verificação atualiza automaticamente.
                      </div>
                      <Link href="/integracoes">
                        <Button
                          size="sm"
                          className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <Zap className="h-3 w-3" />
                          Ir para Integrações
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Launch button section */}
      <div className="px-5 pb-5 pt-3 border-t border-border/20">
        {allReady ? (
          <Button
            onClick={onLaunch}
            disabled={launching}
            className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
          >
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {launching ? "Lançando..." : "Lançar Campanha Agora"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              disabled
              className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm opacity-40 cursor-not-allowed"
            >
              <Rocket className="h-4 w-4" />
              Lançar Campanha
            </Button>
            {failCount > 0 && (
              <div className="text-center font-mono text-[10px] text-red-400/70">
                Configure as integrações obrigatórias acima para liberar o lançamento
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
