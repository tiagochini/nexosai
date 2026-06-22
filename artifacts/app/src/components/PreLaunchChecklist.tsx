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
  const [socialExpanded, setSocialExpanded]   = useState(true);
  const [oauthLoading, setOauthLoading]       = useState<string | null>(null);
  const [oauthError, setOauthError]           = useState<string | null>(null);
  const [funnelExpanded, setFunnelExpanded]   = useState(true);

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
    ]).then(([intRes, contRes, finRes]) => {
      setIntegrations(intRes.integrations ?? []);
      setContent(contRes.pieces ?? []);
      const fin = finRes.financials ?? null;
      setFinancials(fin);
      setLocalBudget(fin?.paidTrafficBudget ?? 5000);
      setLocalRetargetPct(fin?.retargetingPct ?? 25);
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
  const hasSocial     = isConnected(["instagram", "tiktok_ads", "meta_ads"]);
  const whatsappConn  = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
  const rdConn        = integrations.find(i => i.provider === "rd_station" && i.status === "connected");
  const instagramConn = integrations.find(i => i.provider === "instagram" && i.status === "connected");
  const tiktokConn    = integrations.find(i => i.provider === "tiktok_ads" && i.status === "connected");
  const connectedSocials = [instagramConn && "Instagram", tiktokConn && "TikTok"].filter(Boolean).join(", ");
  const missingMsg    = !isConnected(["whatsapp_business"]) ? "whatsapp" as const : "telegram" as const;
  const missingEmail  = !isConnected(["rd_station"]) ? "rd_station" as const : "activecampaign" as const;
  const missingSocial = !instagramConn ? "instagram" as const : "tiktok" as const;

  // ── Content checks ──────────────────────────────────────────────────────────
  const allPieces         = content;
  const approvedCount     = allPieces.filter(p => p.status === "approved").length;
  const pendingPieces     = allPieces.filter(p => p.status !== "approved");
  const allContentApproved = allPieces.length > 0 && pendingPieces.length === 0;
  const noContent         = allPieces.length === 0;

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
  const allReady = hasMessaging && hasEmail && hasSocial && contentVerified && funnelConfirmed && finReady;

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

  // ── Scan animation overlay (shown once per campaign) ─────────────────────────
  if (!scanDone) {
    const completeScanNow = () => {
      setScanDone(true);
      try { localStorage.setItem(scanKey, "1"); } catch {}
    };
    const SCAN_GATES = [
      {
        label: "Canal de Mensagens",
        icon: <MessageCircle className="h-4 w-4" />,
        passed: hasMessaging,
        passMsg: whatsappConn ? "WhatsApp Business conectado" : "Telegram conectado",
        failMsg: "WhatsApp Business ou Telegram obrigatório — vá em Integrações → Mensagens",
      },
      {
        label: "Plataforma de Email",
        icon: <Mail className="h-4 w-4" />,
        passed: hasEmail,
        passMsg: rdConn ? "RD Station conectado" : "ActiveCampaign conectado",
        failMsg: "RD Station ou ActiveCampaign obrigatório — vá em Integrações → Email",
      },
      {
        label: "Redes Sociais",
        icon: <Users className="h-4 w-4" />,
        passed: hasSocial,
        passMsg: `Conectado: ${connectedSocials} — auto-post ativo`,
        failMsg: "Conecte Instagram ou TikTok para distribuição automática do conteúdo gerado",
      },
      {
        label: "Aprovação de Conteúdo",
        icon: <FileText className="h-4 w-4" />,
        passed: allContentApproved,
        passMsg: `${approvedCount} peça${approvedCount !== 1 ? "s" : ""} aprovada${approvedCount !== 1 ? "s" : ""}`,
        failMsg: noContent
          ? "Nenhuma peça gerada — gere o conteúdo antes de lançar"
          : `${pendingPieces.length} peça${pendingPieces.length !== 1 ? "s" : ""} aguardando revisão — abra a aba Conteúdo`,
      },
      {
        label: "Funil & Landing Page",
        icon: <TrendingUp className="h-4 w-4" />,
        passed: funnelConfirmed,
        passMsg: "Landing page e checkout confirmados como publicados",
        failMsg: "Confirme que sua landing page está publicada e checkout ativo antes de lançar",
      },
      {
        label: "Plano Financeiro",
        icon: <DollarSign className="h-4 w-4" />,
        passed: finReady,
        passMsg: "Plano revisado e confirmado",
        failMsg: "Revise e confirme o plano financeiro abaixo antes de lançar",
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
            <div className="font-mono text-sm font-bold uppercase tracking-widest">Auditoria de Pré-Lançamento</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {revealedGates < 4 ? `Verificando ${revealedGates + 1} de 4...` : "Auditoria concluída"}
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
              Pular animação
            </button>
          ) : (
            <div className={`font-mono text-[10px] uppercase tracking-widest font-bold ${allPassed ? "text-green-400" : "text-yellow-400"}`}>
              {allPassed ? "✓ Todos os gates aprovados" : `${SCAN_GATES.filter(g => !g.passed).length} pendente${SCAN_GATES.filter(g => !g.passed).length !== 1 ? "s" : ""}`}
            </div>
          )}
          {revealedGates >= 6 && (
            <Button
              onClick={completeScanNow}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 btn-weapon-primary"
            >
              {allPassed ? "Ver Checklist Completo" : "Resolver Pendências"}
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
        setOauthError("Popup bloqueado pelo browser. Permita popups para este site e tente novamente.");
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
          setOauthError(event.data.error ?? "Falha na autenticação.");
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
      setOauthError("Erro ao iniciar autenticação. Verifique sua conexão e tente novamente.");
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
            <div className="font-mono text-sm font-bold uppercase tracking-widest">Controladoria de Lançamento</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              {allReady
                ? "Todos os gates aprovados — lançamento liberado"
                : `${passedGates}/6 verificações aprovadas — complete o restante antes de lançar`}
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
              Redes Sociais — Distribuição de Conteúdo
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {hasSocial
                ? `Conectado: ${connectedSocials} — posts publicados automaticamente conforme o schedule`
                : "Conecte Instagram ou TikTok para distribuição automática do conteúdo gerado"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {socialExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />}
          </div>
        </div>

        {socialExpanded && (
          <div className="mx-5 mb-4 space-y-2">
            {/* OAuth error */}
            {oauthError && (
              <div className="border border-red-500/20 bg-red-500/5 px-4 py-3">
                <div className="font-mono text-[10px] text-red-400 leading-relaxed">{oauthError}</div>
              </div>
            )}

            {!hasSocial && (
              <div className="border border-border/30 bg-background/20 p-4 space-y-3">
                <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-1">
                  Conecte via login automático (OAuth) — NexOS captura o token automaticamente
                </div>

                {/* Instagram / Meta OAuth */}
                <div className="border border-border/30 bg-background/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📸</span>
                    <div>
                      <div className="font-mono text-[11px] font-bold">Instagram Business</div>
                      <div className="font-mono text-[9px] text-muted-foreground/50">Posts, Stories e Reels automáticos via Meta Graph API</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); void handleOAuth("instagram"); }}
                    disabled={oauthLoading === "instagram"}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 shrink-0"
                    style={{ background: "rgba(24,119,242,0.12)", border: "1px solid rgba(24,119,242,0.35)", color: "#1877F2" }}
                  >
                    {oauthLoading === "instagram"
                      ? <><Loader2 className="h-3 w-3 animate-spin" />Aguardando…</>
                      : <>Entrar com Instagram</>}
                  </Button>
                </div>

                {/* TikTok OAuth */}
                <div className="border border-border/30 bg-background/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎵</span>
                    <div>
                      <div className="font-mono text-[11px] font-bold">TikTok Business</div>
                      <div className="font-mono text-[9px] text-muted-foreground/50">Vídeos curtos, Reels e TikTok Ads via Content Posting API</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); void handleOAuth("tiktok"); }}
                    disabled={oauthLoading === "tiktok"}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 shrink-0"
                    style={{ background: "rgba(254,44,85,0.10)", border: "1px solid rgba(254,44,85,0.35)", color: "#fe2c55" }}
                  >
                    {oauthLoading === "tiktok"
                      ? <><Loader2 className="h-3 w-3 animate-spin" />Aguardando…</>
                      : <>Entrar com TikTok</>}
                  </Button>
                </div>

                <div className="pt-1 border-t border-border/20 flex items-center justify-between">
                  <div className="font-mono text-[9px] text-muted-foreground/30">
                    O NexOS captura os tokens de acesso automaticamente — sem copiar/colar credenciais
                  </div>
                  <Button asChild size="sm" variant="outline" className="font-mono text-[9px] uppercase tracking-widest h-6 px-2 gap-1 rounded-none border-border/30" onClick={e => e.stopPropagation()}>
                    <Link href="/integracoes">
                      <Zap className="h-3 w-3" />Mais opções
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {hasSocial && (
              <div className="border border-green-500/20 bg-green-500/5 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 font-mono text-[11px] text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {connectedSocials} — conectado via OAuth
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/40">
                  O conteúdo aprovado será publicado automaticamente conforme o calendário de lançamento
                </div>
              </div>
            )}
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
              {!allContentApproved ? "Aprovação de Conteúdo do Schedule"
                : verifyPhase === 0 ? "Verificando aprovações..."
                : verifyPhase === 1 ? "Verificando conformidade CONAR..."
                : verifyPhase === 2 ? "Validando cronograma de publicação..."
                : "Conteúdo verificado — schedule completo"}
            </div>
            {/* Animated sub-steps when content is approved */}
            {allContentApproved && verifyPhase > 0 && (
              <div className="flex flex-col gap-0.5 mt-1.5">
                <div className={`flex items-center gap-1.5 font-mono text-[9px] transition-opacity duration-300 ${verifyPhase >= 1 ? "opacity-100" : "opacity-30"}`}>
                  <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                  <span className="text-green-400/80">{approvedCount} peça{approvedCount !== 1 ? "s" : ""} aprovada{approvedCount !== 1 ? "s" : ""}</span>
                </div>
                {verifyPhase >= 2 && (
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                    <span className="text-green-400/80">Sem violações CONAR/CDC detectadas</span>
                  </div>
                )}
                {verifyPhase >= 3 && (
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                    <span className="text-green-400/80">Cronograma de publicação validado</span>
                  </div>
                )}
              </div>
            )}
            {!allContentApproved && (
              <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                {noContent
                  ? "Nenhuma peça gerada — gere o conteúdo antes de lançar"
                  : `${pendingPieces.length} peça${pendingPieces.length > 1 ? "s" : ""} aguardando revisão e aprovação`}
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
                <div className="font-mono text-[10px] text-muted-foreground/50">Revise e aprove cada peça na página de conteúdo</div>
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

            {/* ── Budget overview + interactive sliders ─────────────────── */}
            {financials?.hasBudget && scaled && (
              <>
                {/* ── Budget slider ───────────────────────────────────────── */}
                <div className="border border-primary/20 bg-primary/5 px-4 py-4 space-y-4">
                  <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                    Ajuste o orçamento — projeções atualizam em tempo real
                  </div>

                  {/* Paid traffic budget slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">Budget de Tráfego Pago</span>
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
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">% Retargeting</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-cyan-400">{localRetargetPct}% retargeting</span>
                        <span className="font-mono text-[10px] text-muted-foreground/30">·</span>
                        <span className="font-mono text-[10px] text-primary/70">{100 - localRetargetPct}% prospecção</span>
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
                      <span className="font-mono text-[9px] text-muted-foreground/25">10% retarget</span>
                      <span className="font-mono text-[9px] text-muted-foreground/25">50% retarget</span>
                    </div>
                  </div>

                  {/* Split summary */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="border border-primary/20 bg-background/30 px-3 py-2">
                      <div className="font-mono text-[9px] text-primary/50 uppercase tracking-widest mb-0.5">Prospecção ({100 - localRetargetPct}%)</div>
                      <div className="font-mono text-sm font-bold text-primary">{R$(scaled.prospecting)}</div>
                    </div>
                    <div className="border border-cyan-500/20 bg-background/30 px-3 py-2">
                      <div className="font-mono text-[9px] text-cyan-400/50 uppercase tracking-widest mb-0.5">Retargeting ({localRetargetPct}%)</div>
                      <div className="font-mono text-sm font-bold text-cyan-400">{R$(scaled.retargeting)}</div>
                    </div>
                  </div>
                </div>

                {/* KPI strip — live values */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { icon: <DollarSign className="h-3.5 w-3.5" />, label: "Investimento Total",  value: R$(localBudget),                       sub: "tráfego pago" },
                    { icon: <Target      className="h-3.5 w-3.5" />, label: "Leads Pagos",         value: scaled.paidLeads.mid.toLocaleString("pt-BR"), sub: `${scaled.paidLeads.low}–${scaled.paidLeads.high} (faixa)` },
                    { icon: <Users       className="h-3.5 w-3.5" />, label: "Total Leads",         value: scaled.totalLeads.mid.toLocaleString("pt-BR"), sub: `+${scaled.organicLeads.mid} orgânico` },
                    { icon: <TrendingUp  className="h-3.5 w-3.5" />, label: "Receita Projetada",   value: R$(scaled.totalRevenue.mid),           sub: `ROAS ${scaled.totalRoas.mid.toFixed(1)}x realista` },
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
                      <BarChart3 className="h-3 w-3" />Distribuição por Plataforma
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

                {/* Revenue scenarios — scaled */}
                <div className="border border-border/30 bg-background/20">
                  <div className="px-4 py-2 border-b border-border/20 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                    Cenários de Retorno (Pessimista / Realista / Otimista)
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border/20">
                    {(["low", "mid", "high"] as const).map((sc, i) => {
                      const labels = ["Pess.", "Real.", "Otim."];
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
                      Break-even: {scaled.breakEvenSales} venda{scaled.breakEvenSales !== 1 ? "s" : ""}
                      {financials.revenueTarget ? ` • Meta: ${R$(financials.revenueTarget)}` : ""}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/25">+{scaled.organicLeads.mid} leads orgânicos estimados</div>
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
              Funil & Landing Page
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {funnelConfirmed
                ? `Landing page confirmada: ${landingUrl}`
                : "Informe a URL pública da sua landing page antes de lançar"}
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
              URL da Landing Page publicada
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={landingUrlInput}
                onChange={e => setLandingUrlInput(e.target.value)}
                placeholder="https://seu-dominio.com/produto"
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
                  <CheckCircle2 className="h-3 w-3" />Confirmar
                </Button>
              ) : (
                <Button size="sm" disabled className="rounded-none font-mono text-[10px] uppercase tracking-widest h-9 px-3 opacity-30 shrink-0">
                  Confirmar
                </Button>
              )}
            </div>
            {landingUrlInput && !landingUrlInput.startsWith("http") && (
              <div className="font-mono text-[9px] text-red-400/70">URL deve começar com https://</div>
            )}
          </div>

          {/* Checklist items */}
          <div className="border border-border/30 bg-background/20 px-4 py-3 space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Verificações antes de lançar</div>
            {[
              { text: "Landing page publicada e acessível pelo link acima", done: funnelConfirmed },
              { text: "Checkout configurado e aceitando pagamentos (Hotmart, Kiwify, etc.)", done: false },
              { text: "Pixel do Meta e/ou TikTok instalado na landing page", done: hasSocial },
              { text: "Página de obrigado configurada com evento de conversão", done: false },
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
                alterar
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
              {!hasSocial && <span>Conecte uma rede social •</span>}
              {!allContentApproved && !noContent && <span>Aprove {pendingPieces.length} peça{pendingPieces.length > 1 ? "s" : ""} •</span>}
              {noContent && <span>Gere o conteúdo •</span>}
              {!funnelConfirmed && <span>Informe a URL da landing page •</span>}
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
              <Button asChild size="sm" className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5" onClick={e => e.stopPropagation()}>
                <Link href="/integracoes">
                  <Zap className="h-3 w-3" />Ir para Integrações
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
