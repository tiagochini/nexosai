/**
 * PreLaunchChecklist — Gate obrigatório antes de lançar uma campanha.
 *
 * Verifica 4 gates antes de liberar o botão "Lançar":
 *   1. Canal de mensagens (WhatsApp Business ou Telegram)
 *   2. Plataforma de email (RD Station ou ActiveCampaign)
 *   3. TODAS as peças de conteúdo do schedule aprovadas pelo usuário
 *   4. Plano financeiro & de mídia revisado e confirmado
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
  DollarSign, TrendingUp, BarChart3, Users, Target,
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
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const R$ = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `R$ ${(n / 1_000).toFixed(0)}k`
    : `R$ ${n.toFixed(0)}`;

// ─── Component ────────────────────────────────────────────────────────────────

export function PreLaunchChecklist({ campaignId, onLaunchReady, onLaunch, launching }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [content, setContent]           = useState<ContentPiece[]>([]);
  const [financials, setFinancials]     = useState<LaunchFinancials | null>(null);
  const [loading, setLoading]           = useState(true);

  // Wizard / expand state
  const [expandedWizard, setExpandedWizard]   = useState<string | null>(null);
  const [expandedStep, setExpandedStep]       = useState<number | null>(null);
  const [contentExpanded, setContentExpanded] = useState(true);
  const [finExpanded, setFinExpanded]         = useState(true);
  const [finConfirmed, setFinConfirmed]       = useState(false);

  useEffect(() => {
    Promise.all([
      customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] })),
      customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] })),
      customFetch<{ financials: LaunchFinancials }>(`/api/campaigns/${campaignId}/launch-financials`).catch(() => ({ financials: null })),
    ]).then(([intRes, contRes, finRes]) => {
      setIntegrations(intRes.integrations ?? []);
      setContent(contRes.pieces ?? []);
      setFinancials(finRes.financials ?? null);
      setLoading(false);
    });
  }, [campaignId]);

  // ── Integration checks ──────────────────────────────────────────────────────
  const isConnected   = (providers: string[]) => integrations.some(i => providers.includes(i.provider) && i.status === "connected");
  const hasMessaging  = isConnected(["whatsapp_business", "telegram"]);
  const hasEmail      = isConnected(["rd_station", "activecampaign"]);
  const whatsappConn  = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
  const rdConn        = integrations.find(i => i.provider === "rd_station" && i.status === "connected");
  const missingMsg    = !isConnected(["whatsapp_business"]) ? "whatsapp" as const : "telegram" as const;
  const missingEmail  = !isConnected(["rd_station"]) ? "rd_station" as const : "activecampaign" as const;

  // ── Content checks ──────────────────────────────────────────────────────────
  const allPieces         = content;
  const approvedCount     = allPieces.filter(p => p.status === "approved").length;
  const pendingPieces     = allPieces.filter(p => p.status !== "approved");
  const allContentApproved = allPieces.length > 0 && pendingPieces.length === 0;
  const noContent         = allPieces.length === 0;

  // ── Financials check ────────────────────────────────────────────────────────
  const finReady = finConfirmed;

  // ── Overall gate ────────────────────────────────────────────────────────────
  const allReady = hasMessaging && hasEmail && allContentApproved && finReady;

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

  const passedGates = (hasMessaging ? 1 : 0) + (hasEmail ? 1 : 0) + (allContentApproved ? 1 : 0) + (finReady ? 1 : 0);
  const failedGates = 4 - passedGates;

  return (
    <div className="border border-primary/30 bg-card/20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">Controladoria de Lançamento</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {allReady
                ? "Todos os gates aprovados — lançamento liberado"
                : `${passedGates}/4 verificações aprovadas — complete o restante antes de lançar`}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${
          allReady ? "border-green-500/40 text-green-400 bg-green-500/5"
          : failedGates > 0 ? "border-red-500/40 text-red-400 bg-red-500/5"
          : "border-yellow-500/40 text-yellow-400 bg-yellow-500/5"
        }`}>
          {allReady ? "✓ Liberado" : `${failedGates} pendente${failedGates > 1 ? "s" : ""}`}
        </Badge>
      </div>

      {/* ── Gate 1: Canal de Mensagens ──────────────────────────────────────── */}
      <GateRow
        id="messaging" icon={<MessageCircle className="h-4 w-4" />}
        label="Canal de Mensagens" passed={hasMessaging}
        passDetail={whatsappConn ? "WhatsApp Business conectado" : "Telegram conectado"}
        failDetail="WhatsApp Business ou Telegram obrigatório para disparar mensagens aos leads"
        wizardKey={hasMessaging ? null : missingMsg}
        expandedWizard={expandedWizard} expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 2: Plataforma de Email ─────────────────────────────────────── */}
      <GateRow
        id="email" icon={<Mail className="h-4 w-4" />}
        label="Plataforma de Email" passed={hasEmail}
        passDetail={rdConn ? "RD Station conectado" : "ActiveCampaign conectado"}
        failDetail="RD Station ou ActiveCampaign obrigatório para sequências de email do lançamento"
        wizardKey={hasEmail ? null : missingEmail}
        expandedWizard={expandedWizard} expandedStep={expandedStep}
        onToggleWizard={(id) => { setExpandedWizard(expandedWizard === id ? null : id); setExpandedStep(null); }}
        onToggleStep={setExpandedStep}
      />

      {/* ── Gate 3: Aprovação de todo o conteúdo ────────────────────────────── */}
      <div className="border-t border-border/20">
        <div
          className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-background/20 transition-colors"
          onClick={() => setContentExpanded(v => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {noContent || !allContentApproved
              ? <XCircle className="h-4 w-4 text-red-400" />
              : <CheckCircle2 className="h-4 w-4 text-green-400" />}
          </div>
          <div className={`shrink-0 ${allContentApproved ? "text-green-400/60" : "text-red-400/60"}`}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-mono text-xs font-bold ${allContentApproved ? "text-green-300" : "text-red-300"}`}>
              Aprovação de Conteúdo do Schedule
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {noContent
                ? "Nenhuma peça gerada — gere o conteúdo antes de lançar"
                : allContentApproved
                ? `${approvedCount} peça${approvedCount > 1 ? "s" : ""} aprovada${approvedCount > 1 ? "s" : ""} — schedule completo`
                : `${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} aguardando revisão e aprovação`}
            </div>
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
                    <Link href={`/campaigns/${campaignId}/content`}>
                      <Button size="sm" variant="outline" className="font-mono text-[9px] uppercase shrink-0 h-6 px-2 gap-1 border-primary/30 text-primary/70 hover:bg-primary/10" onClick={e => e.stopPropagation()}>
                        <Eye className="h-3 w-3" />Revisar
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
            {!allContentApproved && (
              <div className="px-3 py-3 bg-background/10 flex items-center justify-between">
                <div className="font-mono text-[10px] text-muted-foreground/50">Revise e aprove cada peça na página de conteúdo</div>
                <Link href={`/campaigns/${campaignId}/content`}>
                  <Button size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5">
                    <Eye className="h-3 w-3" />Abrir Conteúdo
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {contentExpanded && noContent && (
          <div className="mx-5 mb-4 border border-border/30 px-4 py-3 bg-background/20 text-center">
            <div className="font-mono text-[10px] text-muted-foreground/50">Nenhuma peça gerada. Gere o conteúdo antes de lançar.</div>
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
              Plano Financeiro & Distribuição de Mídia
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {finReady
                ? "Plano revisado e confirmado"
                : financials?.hasBudget
                ? "Revise a estrutura de custo e retorno estimado — confirme antes de lançar"
                : "Orçamento de tráfego não informado no intake — verifique o plano abaixo"}
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
                <div className="font-mono text-[11px] text-yellow-400 font-bold mb-1">Orçamento não cadastrado</div>
                <div className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                  O intake desta campanha não incluiu orçamento de tráfego. Antes de lançar, garanta que seu planejamento financeiro está definido (quanto vai investir em Meta Ads, Google Ads, etc.). Você pode confirmar assim mesmo ou voltar ao intake e informar o orçamento.
                </div>
              </div>
            )}

            {/* ── Budget overview ────────────────────────────────────────── */}
            {financials?.hasBudget && (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { icon: <DollarSign className="h-3.5 w-3.5" />, label: "Investimento Total", value: R$(financials.totalBudget), sub: "orçamento da campanha" },
                    { icon: <Target className="h-3.5 w-3.5" />, label: "Tráfego Pago", value: R$(financials.paidTrafficBudget), sub: `${financials.retargetingPct}% retargeting` },
                    { icon: <Users className="h-3.5 w-3.5" />, label: "Leads Projetados", value: `${financials.totalLeads.mid.toLocaleString("pt-BR")}`, sub: `+${financials.organicLeads.mid} orgânico` },
                    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Receita Projetada", value: R$(financials.simulation?.totalRevenue.mid ?? 0), sub: `ROAS ${financials.simulation?.totalRoas.mid.toFixed(1)}x` },
                  ].map(kpi => (
                    <div key={kpi.label} className="border border-border/30 bg-background/30 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground/40 mb-1">{kpi.icon}<span className="font-mono text-[9px] uppercase tracking-widest">{kpi.label}</span></div>
                      <div className="font-mono text-sm font-bold text-foreground">{kpi.value}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/40">{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Prospecting / Retargeting split */}
                <div className="border border-border/30 bg-background/20 px-4 py-3">
                  <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">Distribuição do Orçamento de Mídia</div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-border/20 rounded-none overflow-hidden">
                      <div className="h-full bg-primary/60" style={{ width: `${100 - financials.retargetingPct}%` }} />
                    </div>
                    <div className="font-mono text-[10px] text-primary/80 whitespace-nowrap">{100 - financials.retargetingPct}% Prospecção</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-border/20 rounded-none overflow-hidden">
                      <div className="h-full bg-cyan-500/50" style={{ width: `${financials.retargetingPct}%` }} />
                    </div>
                    <div className="font-mono text-[10px] text-cyan-400/80 whitespace-nowrap">{financials.retargetingPct}% Retargeting</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="font-mono text-[10px] text-muted-foreground/50">
                      Prospecção: <span className="text-foreground/70">{R$(financials.prospectingBudget)}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground/50">
                      Retargeting: <span className="text-foreground/70">{R$(financials.retargetingBudget)}</span>
                    </div>
                  </div>
                </div>

                {/* Platform breakdown */}
                {(financials.simulation?.platforms ?? []).length > 0 && (
                  <div className="border border-border/30 bg-background/20">
                    <div className="px-4 py-2 border-b border-border/20 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="h-3 w-3" />Plataformas — Leads & Eficiência
                    </div>
                    {(financials.simulation?.platforms ?? []).map(p => (
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
                            <span className="text-muted-foreground/40">Leads: </span>{p.leads.low}–{p.leads.high}
                          </div>
                          <div className="font-mono text-[9px] text-muted-foreground/40">
                            CPL R${p.cpl.low}–R${p.cpl.high} • ROAS {p.roas.mid.toFixed(1)}x
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Revenue scenarios */}
                {financials.simulation && (
                  <div className="border border-border/30 bg-background/20">
                    <div className="px-4 py-2 border-b border-border/20 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                      Cenários de Retorno (Pessimista / Realista / Otimista)
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-border/20">
                      {[
                        { key: "low",  label: "Pess.",  color: "text-red-400",    bgBar: "bg-red-500/20" },
                        { key: "mid",  label: "Real.",  color: "text-yellow-400", bgBar: "bg-yellow-500/30" },
                        { key: "high", label: "Otim.",  color: "text-green-400",  bgBar: "bg-green-500/20" },
                      ].map(sc => {
                        const rev  = financials.simulation!.totalRevenue[sc.key as keyof ScenarioValues];
                        const roi  = financials.simulation!.totalRoi[sc.key as keyof ScenarioValues];
                        const roas = financials.simulation!.totalRoas[sc.key as keyof ScenarioValues];
                        return (
                          <div key={sc.key} className={`px-3 py-3 ${sc.key === "mid" ? "bg-yellow-500/3" : ""}`}>
                            <div className={`font-mono text-[9px] uppercase tracking-widest ${sc.color} mb-1`}>{sc.label}</div>
                            <div className="font-mono text-sm font-bold text-foreground">{R$(rev)}</div>
                            <div className="font-mono text-[9px] text-muted-foreground/50 mt-1">
                              ROI {roi > 0 ? "+" : ""}{roi}%
                            </div>
                            <div className="font-mono text-[9px] text-muted-foreground/50">
                              ROAS {roas.toFixed(1)}x
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 py-2 border-t border-border/10 flex items-center justify-between">
                      <div className="font-mono text-[9px] text-muted-foreground/30">
                        Break-even: {financials.simulation.breakEvenSales} venda{financials.simulation.breakEvenSales !== 1 ? "s" : ""}
                        {financials.revenueTarget ? ` • Meta: ${R$(financials.revenueTarget)}` : ""}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/25">Leads orgânicos: +{financials.organicLeads.mid} (estimado)</div>
                    </div>
                  </div>
                )}

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
                {financials?.hasBudget ? "Revisei e Confirmo o Plano Financeiro" : "Confirmo que defini meu orçamento externamente"}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Plano financeiro confirmado
                <button onClick={() => setFinConfirmed(false)} className="ml-2 text-muted-foreground/30 hover:text-muted-foreground text-[9px] underline">desfazer</button>
              </div>
            )}
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
            <Button disabled className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm opacity-30 cursor-not-allowed">
              <Rocket className="h-4 w-4" />
              Lançar Campanha
            </Button>
            <div className="text-center font-mono text-[10px] text-muted-foreground/50 space-x-1">
              {!hasMessaging && <span>Configure mensagens •</span>}
              {!hasEmail && <span>Configure email •</span>}
              {!allContentApproved && !noContent && <span>Aprove {pendingPieces.length} peça{pendingPieces.length > 1 ? "s" : ""} •</span>}
              {noContent && <span>Gere o conteúdo •</span>}
              {!finReady && <span>Confirme o plano financeiro</span>}
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
  const isOpen = expandedWizard === id;
  const wizard = wizardKey ? INTEGRATION_WIZARDS[wizardKey] : null;

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
              {isOpen ? "Fechar guia" : "Ver passo a passo"}
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
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />Abrir agora
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground/40">Após conectar, esta verificação atualiza automaticamente.</div>
              <Link href="/integracoes">
                <Button size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5" onClick={e => e.stopPropagation()}>
                  <Zap className="h-3 w-3" />Ir para Integrações
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
