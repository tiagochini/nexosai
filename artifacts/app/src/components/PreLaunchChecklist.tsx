/**
 * PreLaunchChecklist — Gate obrigatório antes de lançar uma campanha.
 *
 * Aparece no status "approved" antes de liberar o botão "Lançar".
 * Verifica:
 *   1. Canal de mensagens (WhatsApp Business ou Telegram)
 *   2. Plataforma de email (RD Station ou ActiveCampaign)
 *   3. TODAS as peças de conteúdo do schedule — cada uma deve ser aprovada pelo usuário
 *
 * Nenhuma peça é ignorada. O lançamento só é liberado quando:
 *   - Pelo menos 1 canal de mensagens conectado
 *   - Pelo menos 1 plataforma de email conectada
 *   - 100% das peças de conteúdo aprovadas
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, MessageCircle, Mail,
  Rocket, ShieldCheck, Zap, FileText, Eye,
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

const PIECE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  approved:  { label: "Aprovado",       color: "text-green-400 border-green-400/30 bg-green-400/8" },
  pending:   { label: "Aguardando",     color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8" },
  rejected:  { label: "Rejeitado",      color: "text-red-400 border-red-400/30 bg-red-400/8" },
  generated: { label: "Gerado — revisar", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8" },
  draft:     { label: "Rascunho",       color: "text-muted-foreground border-border/30 bg-muted/10" },
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
  metadata?: Record<string, unknown>;
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
  const [contentExpanded, setContentExpanded] = useState(true);

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

  // ── Integration checks ──────────────────────────────────────────────────────
  const isConnected = (providers: string[]) =>
    integrations.some(i => providers.includes(i.provider) && i.status === "connected");

  const hasMessaging = isConnected(["whatsapp_business", "telegram"]);
  const hasEmail     = isConnected(["rd_station", "activecampaign"]);

  const whatsappConn  = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
  const rdConn        = integrations.find(i => i.provider === "rd_station"       && i.status === "connected");

  const missingMessaging = !isConnected(["whatsapp_business"]) ? "whatsapp" as const : "telegram" as const;
  const missingEmail     = !isConnected(["rd_station"]) ? "rd_station" as const : "activecampaign" as const;

  // ── Content approval check — ALL pieces must be approved ───────────────────
  const allPieces     = content;
  const approvedCount = allPieces.filter(p => p.status === "approved").length;
  const pendingPieces = allPieces.filter(p => p.status !== "approved");
  const allContentApproved = allPieces.length > 0 && pendingPieces.length === 0;
  const noContentGenerated = allPieces.length === 0;

  // ── Overall gate ───────────────────────────────────────────────────────────
  const allReady = hasMessaging && hasEmail && allContentApproved;

  useEffect(() => {
    if (!loading) onLaunchReady(allReady);
  }, [loading, allReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="border border-border/30 p-6 flex items-center justify-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-mono text-sm text-muted-foreground">Verificando pré-requisitos de lançamento...</span>
      </div>
    );
  }

  const totalGates    = 3;
  const passedGates   =
    (hasMessaging ? 1 : 0) +
    (hasEmail ? 1 : 0) +
    (allContentApproved ? 1 : 0);
  const failedGates   = totalGates - passedGates;

  return (
    <div className="border border-primary/30 bg-card/20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">
              Controladoria de Lançamento
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {allReady
                ? "Todos os itens verificados — lançamento liberado"
                : `${passedGates}/${totalGates} verificações aprovadas — complete o que falta antes de lançar`}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] uppercase tracking-widest ${
            allReady
              ? "border-green-500/40 text-green-400 bg-green-500/5"
              : failedGates > 0
              ? "border-red-500/40 text-red-400 bg-red-500/5"
              : "border-yellow-500/40 text-yellow-400 bg-yellow-500/5"
          }`}
        >
          {allReady ? "✓ Liberado" : `${failedGates} pendente${failedGates > 1 ? "s" : ""}`}
        </Badge>
      </div>

      {/* ── Gate 1: Mensagens ─────────────────────────────────────────────── */}
      <GateRow
        id="messaging"
        icon={<MessageCircle className="h-4 w-4" />}
        label="Canal de Mensagens"
        passed={hasMessaging}
        passDetail={whatsappConn ? "WhatsApp Business conectado" : "Telegram conectado"}
        failDetail="WhatsApp Business ou Telegram obrigatório para disparar mensagens aos leads"
        wizardKey={hasMessaging ? null : missingMessaging}
        expandedWizard={expandedWizard}
        expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 2: Email ─────────────────────────────────────────────────── */}
      <GateRow
        id="email"
        icon={<Mail className="h-4 w-4" />}
        label="Plataforma de Email"
        passed={hasEmail}
        passDetail={rdConn ? "RD Station conectado" : "ActiveCampaign conectado"}
        failDetail="RD Station ou ActiveCampaign obrigatório para sequências de email do lançamento"
        wizardKey={hasEmail ? null : missingEmail}
        expandedWizard={expandedWizard}
        expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 3: Aprovação de todas as peças de conteúdo ──────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setContentExpanded(v => !v)}
        >
          {/* Status icon */}
          <div className="mt-0.5 shrink-0">
            {noContentGenerated
              ? <XCircle className="h-4 w-4 text-red-400" />
              : allContentApproved
              ? <CheckCircle2 className="h-4 w-4 text-green-400" />
              : <XCircle className="h-4 w-4 text-red-400" />}
          </div>
          <div className={`shrink-0 ${allContentApproved ? "text-green-400/60" : "text-red-400/60"}`}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${allContentApproved ? "text-green-300" : "text-red-300"}`}>
              Aprovação de Conteúdo do Schedule
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {noContentGenerated
                ? "Nenhuma peça de conteúdo gerada ainda — gere o conteúdo antes de lançar"
                : allContentApproved
                ? `${approvedCount} peça${approvedCount > 1 ? "s" : ""} aprovada${approvedCount > 1 ? "s" : ""} — schedule completo`
                : `${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} aguardando sua revisão e aprovação`}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!allContentApproved && !noContentGenerated && (
              <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                {approvedCount}/{allPieces.length}
              </span>
            )}
            {contentExpanded
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {/* Piece list */}
        {contentExpanded && allPieces.length > 0 && (
          <div className="mx-5 mb-4 border border-border/30 divide-y divide-border/20">
            {allPieces.map((piece) => {
              const isApproved = piece.status === "approved";
              const typeLabel = PIECE_TYPE_LABELS[piece.type] ?? piece.type;
              const statusMeta = PIECE_STATUS_LABELS[piece.status] ?? { label: piece.status, color: "text-muted-foreground border-border/30" };

              return (
                <div key={piece.id} className="flex items-center gap-3 px-3 py-2.5 bg-background/20 hover:bg-background/30 transition-colors">
                  <div className="shrink-0">
                    {isApproved
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-mono text-[11px] font-medium truncate ${isApproved ? "text-foreground/70" : "text-foreground"}`}>
                      {piece.title || typeLabel}
                    </div>
                    {piece.platform && (
                      <div className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">
                        {piece.platform}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-none font-mono text-[9px] px-1.5 py-0 shrink-0 ${statusMeta.color}`}
                  >
                    {statusMeta.label}
                  </Badge>
                  {!isApproved && (
                    <Link href={`/campaigns/${campaignId}/content`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[9px] uppercase shrink-0 h-6 px-2 gap-1 border-primary/30 text-primary/70 hover:bg-primary/10"
                        onClick={e => e.stopPropagation()}
                      >
                        <Eye className="h-3 w-3" />
                        Revisar
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}

            {/* Footer with CTA */}
            {!allContentApproved && (
              <div className="px-3 py-3 bg-background/10 flex items-center justify-between">
                <div className="font-mono text-[10px] text-muted-foreground/50">
                  Revise e aprove cada peça na página de conteúdo
                </div>
                <Link href={`/campaigns/${campaignId}/content`}>
                  <Button size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5">
                    <Eye className="h-3 w-3" />
                    Abrir Conteúdo
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {contentExpanded && noContentGenerated && (
          <div className="mx-5 mb-4 border border-border/30 px-4 py-3 bg-background/20 text-center">
            <div className="font-mono text-[10px] text-muted-foreground/50">
              Nenhuma peça gerada ainda. Volte à campanha e gere o conteúdo antes de lançar.
            </div>
          </div>
        )}
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
            {launching ? "Lançando..." : "Lançar Campanha Agora"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              disabled
              className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm opacity-30 cursor-not-allowed"
            >
              <Rocket className="h-4 w-4" />
              Lançar Campanha
            </Button>
            <div className="text-center font-mono text-[10px] text-muted-foreground/50">
              {!hasMessaging && "Configure o canal de mensagens • "}
              {!hasEmail && "Configure a plataforma de email • "}
              {!allContentApproved && !noContentGenerated && `Aprove ${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} de conteúdo`}
              {noContentGenerated && "Gere o conteúdo da campanha"}
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
  const isOpen  = expandedWizard === id;
  const wizard  = wizardKey ? INTEGRATION_WIZARDS[wizardKey] : null;

  return (
    <div className="border-t border-border/20">
      <div
        className={`flex items-start gap-3 px-5 py-4 ${wizard ? "cursor-pointer hover:bg-background/20 transition-colors" : ""}`}
        onClick={() => wizard && onToggleWizard(id)}
      >
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {passed
            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
            : <XCircle className="h-4 w-4 text-red-400" />}
        </div>
        <div className={`shrink-0 ${passed ? "text-green-400/60" : "text-red-400/60"}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-xs font-bold ${passed ? "text-green-300" : "text-red-300"}`}>{label}</div>
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
            {passed ? passDetail : failDetail}
          </div>
        </div>
        {wizard && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-primary/70 uppercase tracking-widest">
              {isOpen ? "Fechar guia" : "Ver passo a passo"}
            </span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-primary/50" /> : <ChevronDown className="h-3.5 w-3.5 text-primary/50" />}
          </div>
        )}
      </div>

      {/* Inline wizard */}
      {isOpen && wizard && (
        <div className="mx-5 mb-4 border border-primary/20 bg-primary/5">
          <div className="px-4 py-3 border-b border-primary/15 flex items-start gap-3">
            <span className="text-xl shrink-0">{wizard.icon}</span>
            <div>
              <div className="font-mono text-xs font-bold text-primary">{wizard.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{wizard.why}</div>
            </div>
          </div>

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
                  onClick={(e) => { e.stopPropagation(); onToggleStep(stepOpen ? null : idx); }}
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
}
