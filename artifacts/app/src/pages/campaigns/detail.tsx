import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import {
  useGetCampaign,
  useExecuteCampaign,
  CampaignExecuteInputPhase,
  getGetCampaignQueryKey,
} from "@workspace/api-client-react";
import { useCampaignSocket, type CampaignEvent } from "@/lib/socket";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Play, FileText, FileSpreadsheet, CheckCircle2,
  Clock, AlertCircle, Loader2, ChevronRight, Bot, BarChart3,
  ShieldCheck, Layers, Zap, XCircle, Eye, TrendingUp,
  AlertTriangle, Activity, Target, DollarSign, Users, BookOpen, Link2, X,
  RefreshCw, Rocket,
} from "lucide-react";
import { LaunchSequenceOverlay, LaunchRocketButton } from "@/components/launch-sequence";
import {
  AnalyzingDisplay,
  StrategyReadyBanner,
  GeneratingDisplay,
  ContentReadyCinemaPrompt,
  ExecutingLiveDisplay,
  LiveMissionControl,
} from "@/components/campaign-stage-experience";
import { CampaignBrief } from "@/components/campaign-brief";
import { SocialPostPreview } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";
import {
  ConnectModal, INTEGRATION_CATALOG,
  type CatalogEntry, type Provider,
} from "@/components/integration-connect-modal";
import { CreativeIntentPanel } from "@/components/CreativeIntentPanel";
import { DecisionTracePanel } from "@/components/DecisionTracePanel";
import { CampaignMindMap } from "@/components/CampaignMindMap";
import { useMode } from "@/lib/mode";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AgentRun {
  id: string;
  agentRole: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  tokensUsed?: number;
  costUsd?: string;
  errorMessage?: string;
}
interface Checkpoint {
  id: string;
  type: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
}
interface ContentPiece {
  id: string;
  type: string;
  platform?: string;
  launchPhase?: string;
  mentalTrigger?: string;
  content: string;
  status: string;
  createdAt: string;
}
interface MetricAlert { id: string; title: string; severity: string; description: string; recommendation: string; }
interface MetricsSummary {
  healthScore: number;
  grade: string;
  summary: string;
  totalRevenueBrl?: number;
  avgRoas?: number;
  avgCplBrl?: number;
  totalSales?: number;
  alertCount?: number;
  history?: { dayIndex: number; revenueBrl: string; roas: string; cplBrl: string; healthScore: number }[];
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Intake", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando Conteúdo",
  awaiting_approval: "Aguardando Aprovação", approved: "Aprovado",
  executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  analyzing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed: "text-muted-foreground border-border bg-muted/20",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-blue-400 border-blue-400/40 bg-blue-400/10",
};
const AGENT_ROLE_LABEL: Record<string, string> = {
  command:               "Comandante IA",
  strategy:              "Estrategista",
  launch_manager:        "Gerente de Lançamento",
  offer:                 "Especialista em Oferta",
  product_builder:       "Product Builder",
  copywriter:            "Copywriter",
  creative_director:     "Diretor Criativo",
  creative:              "Diretor Criativo",
  landing_page:          "Landing Page Expert",
  targeting:             "Targeting Expert",
  media_buyer:           "Media Buyer",
  affiliate_campaign:    "Especialista em Afiliados",
  analytics:             "Analista de Performance",
  optimization:          "Otimizador IA",
  video:                 "Estrategista de Vídeo",
  video_strategy:        "Estrategista de Vídeo",
  creator_growth:        "Creator Growth",
  compliance:            "Compliance Officer",
  profile_builder:       "Profile Builder",
  intake:                "Intake IA",
  ad_copy:               "Copy de Anúncios",
  cpl_script:            "Script CPL",
  vsl_script:            "Roteiro VSL",
  webinar_script:        "Roteiro Webinar",
  live_script:           "Roteiro Live",
  stories_sequence:      "Sequência Stories",
  media_brief:           "Brief de Mídia",
  financial_projector:   "Projetor Financeiro",
  launch_sequence_builder: "Builder de Sequências",
  social_media:          "Social Media IA",
  whatsapp_response:     "Auto-Resposta WhatsApp",
  perpetual_launch_manager: "Lançamento Perpétuo",
  continuous_sales_manager: "Gestor de Vendas Contínuas",
  item_copy:             "Copy de Item",
};
const ACTIVE_STATUSES = ["analyzing", "generating", "executing"];
const PIPELINE = [
  { id: "intake", label: "01 · Briefing", statuses: ["draft", "intake"] },
  { id: "strategy", label: "02 · Estratégia", statuses: ["analyzing", "strategy_ready"] },
  { id: "content", label: "03 · Conteúdo", statuses: ["generating", "awaiting_approval", "approved"] },
  { id: "launch", label: "04 · Lançamento", statuses: ["executing", "live"] },
  { id: "monitor", label: "05 · Monitor", statuses: ["completed"] },
];

function getPipelineState(status: string, stepStatuses: string[]): "done" | "active" | "pending" {
  const order = PIPELINE.map((s) => s.statuses).flat();
  const cur = order.indexOf(status);
  const first = Math.min(...stepStatuses.map((s) => order.indexOf(s)));
  const last = Math.max(...stepStatuses.map((s) => order.indexOf(s)));
  if (cur > last) return "done";
  if (cur >= first && cur <= last) return "active";
  return "pending";
}

// ── Mini components ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-success", running: "bg-primary animate-pulse",
    pending: "bg-yellow-400 animate-pulse", failed: "bg-destructive",
    draft: "bg-muted-foreground", approved: "bg-success", rejected: "bg-destructive",
    awaiting_review: "bg-yellow-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status] ?? "bg-muted-foreground"}`} />;
}

function KpiCard({ label, value, sub, icon: Icon, color = "primary" }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: "primary" | "success" | "yellow" | "cyan";
}) {
  const colorMap = {
    primary: "text-primary border-primary/20 bg-primary/5",
    success: "text-success border-success/20 bg-success/5",
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
    cyan: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5",
  };
  return (
    <div className={`border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="font-mono font-bold text-xl">{value}</div>
      {sub && <div className="font-mono text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── AgentPlanPanel ─────────────────────────────────────────────────────────────
function PlanBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/40 bg-muted/5 p-4 space-y-2">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary/70 font-bold">{label}</div>
      {children}
    </div>
  );
}

function PlanText({ value }: { value: unknown }) {
  if (!value) return null;
  if (typeof value === "string") return <p className="font-mono text-xs text-foreground/80 leading-relaxed">{value}</p>;
  if (Array.isArray(value)) return (
    <ul className="space-y-1">
      {(value as unknown[]).map((item, i) => (
        <li key={i} className="font-mono text-xs text-foreground/80 flex items-start gap-2 leading-relaxed">
          <span className="text-primary/50 shrink-0 mt-0.5">·</span>
          <span>{typeof item === "string" ? item : typeof item === "object" && item !== null ? Object.values(item as Record<string, unknown>).filter(v => typeof v === "string").join(" — ") : String(item)}</span>
        </li>
      ))}
    </ul>
  );
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider">{k.replace(/_/g, " ")}: </span>
            <span className="font-mono text-xs text-foreground/80">{typeof v === "string" ? v : Array.isArray(v) ? (v as unknown[]).join(", ") : JSON.stringify(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function AgentPlanPanel({
  strategyD, audienceD, offerD, targetingD, timelineD, checkpoints, onGoToStrategy,
}: {
  strategyD: Record<string, unknown>;
  audienceD: Record<string, unknown>;
  offerD: Record<string, unknown>;
  targetingD: Record<string, unknown>;
  timelineD: Record<string, unknown>;
  checkpoints: Checkpoint[];
  onGoToStrategy: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const approvedCps = checkpoints.filter(c => c.status === "approved");

  const hasPlan = Object.keys(strategyD).length > 0 || Object.keys(audienceD).length > 0 || Object.keys(offerD).length > 0;

  return (
    <div className="border border-cyan-400/25 bg-cyan-400/3 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 border-b border-cyan-400/20 hover:bg-cyan-400/5 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px hsl(180 100% 60%)" }} />
        <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold flex-1 text-left">
          Outputs dos Agentes — Plano de Ação
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/50">
          {expanded ? "▲ recolher" : "▼ expandir"}
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">

          {/* Strategy summary */}
          {!!strategyD.executiveSummary && (
            <PlanBlock label="Diagnóstico Executivo — Estrategista IA">
              <PlanText value={strategyD.executiveSummary} />
            </PlanBlock>
          )}

          {/* Market diagnosis */}
          {!!strategyD.marketDiagnosis && (
            <PlanBlock label="Diagnóstico de Mercado — Estrategista IA">
              <PlanText value={strategyD.marketDiagnosis} />
            </PlanBlock>
          )}

          {/* Offer positioning */}
          {!!(strategyD.offerPositioning ?? offerD.positioning ?? offerD.uvp) && (
            <PlanBlock label="Posicionamento da Oferta — Especialista em Oferta">
              <PlanText value={strategyD.offerPositioning ?? offerD} />
            </PlanBlock>
          )}

          {/* Audience segmentation */}
          {!!(strategyD.audienceSegmentation ?? audienceD.avatars ?? audienceD.segments) && (
            <PlanBlock label="Segmentação de Audiência — Profile Builder">
              <PlanText value={strategyD.audienceSegmentation ?? audienceD} />
            </PlanBlock>
          )}

          {/* Campaign architecture */}
          {!!strategyD.campaignArchitecture && (
            <PlanBlock label="Arquitetura da Campanha — Estrategista IA">
              <PlanText value={strategyD.campaignArchitecture} />
            </PlanBlock>
          )}

          {/* Trigger map */}
          {!!strategyD.triggerMap && (
            <PlanBlock label="Mapa de Gatilhos Mentais — Estrategista IA">
              <PlanText value={strategyD.triggerMap} />
            </PlanBlock>
          )}

          {/* Success metrics */}
          {!!strategyD.successMetrics && (
            <PlanBlock label="Metas & KPIs Projetados — Estrategista IA">
              <PlanText value={strategyD.successMetrics} />
            </PlanBlock>
          )}

          {/* Targeting data */}
          {Object.keys(targetingD).length > 0 && (
            <PlanBlock label="Targeting & Mídia Paga — Media Buyer">
              <PlanText value={targetingD} />
            </PlanBlock>
          )}

          {/* Timeline */}
          {Object.keys(timelineD).length > 0 && (
            <PlanBlock label="Cronograma do Lançamento — Gerente de Lançamento">
              <PlanText value={timelineD} />
            </PlanBlock>
          )}

          {/* Approved checkpoints */}
          {approvedCps.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-success/70 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />Checkpoints Aprovados ({approvedCps.length})
              </div>
              {approvedCps.map(cp => (
                <PlanBlock key={cp.id} label={cp.type.replace(/_/g, " ")}>
                  <div className="text-[11px] font-mono text-muted-foreground/50 mb-2">
                    Aprovado em {new Date(cp.createdAt).toLocaleString("pt-BR")}
                  </div>
                  {cp.data && Object.keys(cp.data).length > 0 && <PlanText value={cp.data} />}
                </PlanBlock>
              ))}
            </div>
          )}

          {!hasPlan && approvedCps.length === 0 && (
            <div className="py-6 text-center font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
              Nenhum output registrado ainda. Execute uma fase de IA para ver os resultados aqui.
            </div>
          )}

          <button
            onClick={onGoToStrategy}
            className="w-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary flex items-center justify-center gap-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ver Proposta Estratégica Completa
          </button>
        </div>
      )}
    </div>
  );
}

// ── Platform creative mocks ───────────────────────────────────────────────────
type PlatformId = "instagram" | "tiktok" | "facebook" | "whatsapp" | "email";

const PLT: Record<PlatformId, { label: string; abbr: string; col: string; bdr: string; bg: string }> = {
  instagram: { label: "Instagram", abbr: "IG", col: "text-pink-400",   bdr: "border-pink-400/40",   bg: "bg-pink-400/5"   },
  tiktok:    { label: "TikTok",    abbr: "TK", col: "text-cyan-400",   bdr: "border-cyan-400/40",   bg: "bg-cyan-400/5"   },
  facebook:  { label: "Facebook",  abbr: "FB", col: "text-blue-400",   bdr: "border-blue-400/40",   bg: "bg-blue-400/5"   },
  whatsapp:  { label: "WhatsApp",  abbr: "WA", col: "text-green-400",  bdr: "border-green-400/40",  bg: "bg-green-400/5"  },
  email:     { label: "E-mail",    abbr: "EM", col: "text-indigo-300", bdr: "border-indigo-300/40", bg: "bg-indigo-300/5" },
};

interface PlatformBrief {
  platform: PlatformId;
  format: string;
  trigger: string;
  angle: string;
  hook?: string;
  headline?: string;
  caption?: string;
  cta?: string;
  actions: string[];
}

// ── Extract nested strategy JSON from executiveSummary (AI wraps it in code blocks) ──
function parseStrategyInsights(strategyD: Record<string, unknown>): Record<string, unknown> {
  const raw = strategyD["executiveSummary"];
  if (typeof raw !== "string") return {};
  const stripped = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { return {}; }
  }
}

function buildPlatformBriefs(
  strategyD: Record<string, unknown>,
  targetingD: Record<string, unknown>,
  intakeD: Record<string, unknown>,
): PlatformBrief[] {
  const insights = parseStrategyInsights(strategyD);
  const product = (intakeD["product.name"] as string) || "Produto";
  const persona = (intakeD["audience.primaryPersona"] as string) || "empreendedores digitais";
  const triggerMap = (strategyD["triggerMap"] as Record<string, string> | undefined) ?? {};
  // Pull targeting from insights if available
  const mkt = (insights["marketDiagnosis"] as Record<string, unknown> | undefined) ?? (strategyD["marketDiagnosis"] as Record<string, unknown> | undefined) ?? {};
  const bigDomino = (insights["bigDomino"] as string | undefined) ?? "";
  void targetingD; void mkt; void bigDomino;
  const p2 = persona.split(" ").slice(0, 3).join(" ");
  const p1 = persona.split(" ").slice(0, 2).join(" ");

  return [
    {
      platform: "instagram",
      format: "Reels 9:16 + Feed + Stories",
      trigger: String(triggerMap["instagram"] ?? triggerMap["authority"] ?? "Autoridade"),
      angle: `Conteúdo de valor orgânico para ${p2}`,
      headline: `Como ${product} transforma resultados de ${p2}`,
      hook: `A maioria de ${p1} não sabe disso ainda...`,
      caption: `📈 Você está deixando resultados na mesa.\n\nO método que mudou tudo para centenas de ${p1}.\n\nSalva e comenta! 👇`,
      cta: "Link na bio",
      actions: ["3 Reels de valor/semana (Seg·Qua·Sex)", "1 Story diário com CTA para lista VIP", "Carrossel educativo a cada 5 dias"],
    },
    {
      platform: "tiktok",
      format: "Vídeo 30–60s + Lives",
      trigger: String(triggerMap["tiktok"] ?? triggerMap["curiosity"] ?? "Curiosidade"),
      angle: `Hook viral + revelação rápida para ${p2}`,
      headline: `O erro que 90% de ${p1} cometem`,
      hook: `POV: você descobre o que sabotava seus resultados o tempo todo`,
      caption: `#empreendedorismo #resultados #${product.replace(/\s+/g, "").slice(0, 15).toLowerCase()}`,
      cta: "Link na bio",
      actions: ["1 vídeo de hook/dia nos 7 dias de aquecimento", "Lives 30min nos dias D-3 e D-1", "Dueto/resposta em comentários estratégicos"],
    },
    {
      platform: "facebook",
      format: "Anúncio Video + Carrossel",
      trigger: String(triggerMap["facebook"] ?? triggerMap["fear_of_loss"] ?? "Medo da Perda"),
      angle: `Tráfego pago segmentado — interesses + lookalike`,
      headline: `Pare de perder clientes para quem já usa ${product}`,
      caption: `Enquanto você lê isso, seus concorrentes estão usando ${product} para fechar mais. Quando vai ser a sua vez?`,
      cta: "Saiba Mais",
      actions: [`Lookalike 1% de compradores`, `Interesse: ${p1}`, `Retargeting D-3 com oferta especial`],
    },
    {
      platform: "whatsapp",
      format: "Lista VIP — Broadcast 7 dias",
      trigger: String(triggerMap["whatsapp"] ?? triggerMap["community"] ?? "Exclusividade"),
      angle: `Sequência de aquecimento pré-abertura do carrinho`,
      headline: `[Lista VIP] Acesso antecipado — só para quem está aqui`,
      caption: `Estou preparando algo que vai mudar completamente como você trabalha com ${product}...`,
      cta: "Responda QUERO para saber mais",
      actions: ["D-7: Teaser exclusivo + primeiro contato", "D-3: Revelação parcial + prova social", "D-1: Abertura 24h antes do público geral"],
    },
    {
      platform: "email",
      format: "Sequência de 7 e-mails",
      trigger: String(triggerMap["email"] ?? triggerMap["reciprocity"] ?? "Reciprocidade"),
      angle: `Nurturing + conversão via e-mail para ${p2}`,
      headline: `[Exclusivo] O que ninguém te conta sobre ${product}`,
      caption: `Tenho uma novidade que vai mudar sua visão sobre como chegar aos seus resultados mais rápido...`,
      cta: "Quero saber mais",
      actions: ["E-mail 1: Entrega de conteúdo de alto valor (gratuito)", "E-mails 2–5: Prova social + queima de objeções", "E-mails 6–7: Urgência + escassez + CTA direto"],
    },
  ];
}

function PlatformMockCard({
  brief, state, onApprove, onRevise,
}: {
  brief: PlatformBrief;
  state: "pending" | "approved" | "editing";
  onApprove: () => void;
  onRevise: () => void;
}) {
  const m = PLT[brief.platform];
  return (
    <div className={`border ${m.bdr} ${m.bg} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`px-3 py-2 border-b ${m.bdr} flex items-center gap-2`}>
        <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${m.bdr} ${m.col}`}>{m.abbr}</span>
        <span className={`font-mono text-[11px] uppercase tracking-widest font-bold flex-1 ${m.col}`}>{m.label}</span>
        <span className="font-mono text-[9px] text-muted-foreground/40 truncate max-w-[80px]">{brief.format}</span>
        {state !== "pending" && (
          <span className="font-mono text-[9px] uppercase shrink-0 text-success">✓</span>
        )}
      </div>

      {/* Visual mock */}
      <div className="p-2.5 flex-1 space-y-2">
        {brief.platform === "instagram" && (
          <div className="border border-border/30 bg-card/60 overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/20">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-500/60 to-orange-400/60 shrink-0" />
              <span className="text-[9px] font-mono text-foreground/50">@usuario · Seguir</span>
              <span className="ml-auto text-[9px] font-mono text-muted-foreground/30">···</span>
            </div>
            <div className="relative aspect-square bg-gradient-to-br from-pink-900/25 via-purple-900/15 to-orange-900/15 flex items-center justify-center overflow-hidden" style={{ maxHeight: "90px" }}>
              <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,hsl(var(--primary)),hsl(var(--primary))_1px,transparent_1px,transparent_10px)]" />
              {brief.headline && (
                <p className="relative z-10 text-[9px] font-mono font-bold text-center text-foreground/80 px-2 leading-snug">
                  {brief.headline.slice(0, 55)}{brief.headline.length > 55 ? "…" : ""}
                </p>
              )}
            </div>
            <div className="px-2 py-1">
              <p className="text-[8px] font-mono text-foreground/40 line-clamp-2 leading-snug">
                {(brief.caption ?? brief.angle).split("\n")[0].slice(0, 60)}
              </p>
            </div>
          </div>
        )}

        {brief.platform === "tiktok" && (
          <div className="border border-border/30 bg-black overflow-hidden flex" style={{ minHeight: "100px" }}>
            <div className="flex-1 relative bg-gradient-to-b from-purple-900/30 via-black to-black flex flex-col justify-end p-2">
              <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(0deg,#00f0ff,#00f0ff_1px,transparent_1px,transparent_8px)]" />
              {brief.hook && (
                <div className="relative bg-black/60 px-1.5 py-1 mb-1">
                  <p className="text-[8px] font-mono font-bold text-white leading-snug">
                    &ldquo;{brief.hook.slice(0, 42)}{brief.hook.length > 42 ? "…" : ""}&rdquo;
                  </p>
                </div>
              )}
              <div className="relative flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/20 shrink-0" />
                <span className="text-[8px] font-mono text-white/40">@usuario</span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-end gap-2 px-2 py-2 bg-black">
              {["♥","💬","↗","♫"].map((ic, i) => (
                <span key={i} className="text-[10px] text-white/25">{ic}</span>
              ))}
            </div>
          </div>
        )}

        {brief.platform === "facebook" && (
          <div className="border border-border/30 bg-[#18191A] overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/5">
              <div className="w-4 h-4 rounded-full bg-blue-500/30 border border-blue-500/40 flex items-center justify-center">
                <span className="text-[7px] font-bold text-blue-400">P</span>
              </div>
              <div>
                <div className="text-[8px] font-mono font-bold text-white/70">Patrocinado</div>
                <div className="text-[7px] font-mono text-blue-400">Meta Ads</div>
              </div>
            </div>
            <div className="px-2 py-1">
              <p className="text-[8px] font-mono text-white/50 leading-snug line-clamp-2">
                {(brief.caption ?? brief.angle).slice(0, 70)}
              </p>
            </div>
            <div className="mx-2 mb-2 bg-[#3A3B3C] px-2 py-1 flex items-center justify-between">
              <div>
                <div className="text-[8px] font-mono font-bold text-white/70">{(brief.headline ?? "Saiba Mais").slice(0, 28)}</div>
                <div className="text-[7px] font-mono text-white/30">patrocinado.com</div>
              </div>
              <div className="bg-blue-600 px-1.5 py-0.5 text-[7px] font-mono font-bold text-white">Saiba mais</div>
            </div>
          </div>
        )}

        {brief.platform === "whatsapp" && (
          <div className="border border-border/30 bg-[#0B141A] overflow-hidden p-2">
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-2">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <span className="text-[7px] font-bold text-green-400">L</span>
              </div>
              <div className="text-[8px] font-mono text-green-400">Lista VIP · broadcast</div>
            </div>
            <div className="space-y-1">
              {["D-7 · Teaser", "D-3 · Revelação", "D-1 · Abertura"].map((d, i) => (
                <div key={i} className="flex justify-end">
                  <div className="bg-[#005C4B] rounded-lg rounded-tr-none px-2 py-1 max-w-[90%]">
                    <div className="text-[7px] font-mono text-green-300/50 mb-0.5">{d}</div>
                    <p className="text-[8px] font-mono text-[#E9EDEF] leading-snug">
                      {i === 0 ? "Algo especial está chegando... 🔥" :
                       i === 1 ? (brief.headline ?? "Novidade exclusiva!").slice(0, 30) :
                       (brief.cta ?? "Garante sua vaga agora")}
                    </p>
                    <div className="text-[7px] font-mono text-[#667781] text-right mt-0.5">10:30 ✓✓</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {brief.platform === "email" && (
          <div className="border border-border/30 bg-white/5 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-border/20 bg-white/5">
              <div className="text-[9px] font-mono font-bold text-foreground/80">
                📧 {(brief.headline ?? "Assunto do e-mail").slice(0, 35)}
              </div>
              <div className="text-[7px] font-mono text-muted-foreground/30 mt-0.5">De: voce@dominio.com · Para: lista-vip@...</div>
            </div>
            <div className="px-2 py-1.5 space-y-1">
              <div className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 text-[8px] font-mono font-bold text-indigo-300 text-center">
                {(brief.headline ?? "Chamada Principal").slice(0, 38)}
              </div>
              <p className="text-[8px] font-mono text-foreground/40 leading-snug line-clamp-2">
                {(brief.caption ?? brief.angle).slice(0, 80)}
              </p>
              <div className="bg-indigo-600/20 border border-indigo-600/30 px-2 py-0.5 text-[8px] font-mono text-indigo-300 text-center">
                {brief.cta ?? "Clique aqui"}
              </div>
            </div>
          </div>
        )}

        {/* Trigger badge + actions */}
        <div className="flex flex-wrap gap-1">
          <span className={`px-1.5 py-0.5 text-[8px] font-mono border ${m.bdr} ${m.col} ${m.bg} uppercase tracking-wide`}>
            ⚡ {brief.trigger}
          </span>
        </div>
        <ul className="space-y-0.5">
          {brief.actions.slice(0, 3).map((a, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className={`shrink-0 text-[8px] mt-0.5 ${m.col}`}>·</span>
              <span className="text-[8px] font-mono text-muted-foreground/60 leading-snug">{a}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Approval controls */}
      {state === "pending" && (
        <div className="grid grid-cols-2 border-t border-border/30 divide-x divide-border/30">
          <button onClick={onApprove}
            className="py-2 font-mono text-[10px] uppercase tracking-widest text-success hover:bg-success/10 transition-colors flex items-center justify-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />Aprovar
          </button>
          <button onClick={onRevise}
            className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:bg-muted/20 transition-colors flex items-center justify-center gap-1">
            <XCircle className="h-2.5 w-2.5" />Revisar
          </button>
        </div>
      )}
      {state === "approved" && (
        <button onClick={onRevise}
          className="border-t border-success/20 py-2 w-full font-mono text-[10px] uppercase tracking-widest text-success flex items-center justify-center gap-1 hover:bg-success/5 transition-colors">
          <CheckCircle2 className="h-2.5 w-2.5" />Aprovado · Desfazer
        </button>
      )}
    </div>
  );
}

function AgentRunLog({ agents }: { agents: AgentRun[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 bg-card/20">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-muted/20 transition-colors">
        <Bot className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 flex-1 text-left">
          Log de Execução — {agents.length} agente{agents.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/40">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-border/20 divide-y divide-border/20">
          {[...agents].reverse().map(agent => (
            <div key={agent.id} className="px-4 py-2.5 flex items-center gap-3">
              <StatusDot status={agent.status} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold uppercase tracking-wide truncate">
                  {AGENT_ROLE_LABEL[agent.agentRole] ?? agent.agentRole}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/40">
                  {new Date(agent.startedAt).toLocaleTimeString("pt-BR")}
                  {agent.completedAt && ` → ${new Date(agent.completedAt).toLocaleTimeString("pt-BR")}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {agent.tokensUsed && <span className="text-[10px] font-mono text-muted-foreground/40">{agent.tokensUsed.toLocaleString()} tok</span>}
                <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 ${agent.status === "completed" ? "border-success/30 text-success" : agent.status === "failed" ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}`}>
                  {agent.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyApprovalBoard({
  strategyD, audienceD, targetingD, timelineD, intakeD, onProceed, proceedLoading,
}: {
  strategyD: Record<string, unknown>;
  audienceD: Record<string, unknown>;
  targetingD: Record<string, unknown>;
  timelineD: Record<string, unknown>;
  intakeD: Record<string, unknown>;
  onProceed: (notes: Record<string, string>) => void;
  proceedLoading: boolean;
}) {
  const briefs = useMemo(
    () => buildPlatformBriefs(strategyD, targetingD, intakeD),
    [strategyD, targetingD, intakeD],
  );
  const insights = useMemo(() => parseStrategyInsights(strategyD), [strategyD]);

  type ApprovalState = "pending" | "approved" | "editing";
  const [secA, setSecA] = useState<ApprovalState>("pending");
  const [secB, setSecB] = useState<ApprovalState>("pending");
  const [secC, setSecC] = useState<ApprovalState>("pending");
  const [platStates, setPlatStates] = useState<Record<PlatformId, ApprovalState>>({
    instagram: "pending", tiktok: "pending", facebook: "pending", whatsapp: "pending", email: "pending",
  });
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [localLoading, setLocalLoading] = useState(false);

  // Reset local loading state when the parent mutation finishes (success or error)
  useEffect(() => {
    if (!proceedLoading) setLocalLoading(false);
  }, [proceedLoading]);

  const allDecided = secA !== "pending" && secA !== "editing" && secB !== "pending" && secB !== "editing" && secC !== "pending" && secC !== "editing" && briefs.every(b => platStates[b.platform] !== "pending" && platStates[b.platform] !== "editing");
  const hasNotes = Object.values(savedNotes).some(v => v?.trim());

  const setNote = (key: string, val: string) => setUserNotes(prev => ({ ...prev, [key]: val }));
  const saveNote = (key: string, sec: (s: ApprovalState) => void) => {
    const note = userNotes[key]?.trim() ?? "";
    setSavedNotes(prev => ({ ...prev, [key]: note }));
    sec("approved");
  };

  const approveAll = () => {
    setLocalLoading(true);
    setSecA("approved"); setSecB("approved"); setSecC("approved");
    setPlatStates({ instagram: "approved", tiktok: "approved", facebook: "approved", whatsapp: "approved", email: "approved" });
    setTimeout(() => {
      onProceed(savedNotes);
    }, 80);
  };
  const setPlt = (p: PlatformId, s: ApprovalState) => setPlatStates(prev => ({ ...prev, [p]: s }));

  // Paid traffic data from intake + AI insights
  const trafficBudget = (intakeD["campaign.trafficBudget"] as string | number | undefined);
  const budgetNum = typeof trafficBudget === "number" ? trafficBudget : parseFloat(String(trafficBudget ?? "0").replace(/[^0-9.]/g, "")) || 0;
  const mktDiag = (insights["marketDiagnosis"] as Record<string, unknown> | undefined) ?? (strategyD["marketDiagnosis"] as Record<string, unknown> | undefined) ?? {};
  const bigDomino = (insights["bigDomino"] as string | undefined) ?? (strategyD["bigDomino"] as string | undefined) ?? "";
  const execSummaryText = (insights["executiveSummary"] as string | undefined) ?? "";
  const competitive = (mktDiag["competitiveLandscape"] as string | undefined) ?? "";
  const funnelStrategy = (insights["funnelStrategy"] as Record<string, unknown> | undefined) ?? {};
  const pricingStrategy = (insights["pricingStrategy"] as Record<string, unknown> | undefined) ?? {};
  const product = (intakeD["product.name"] as string) || "Produto";
  const persona = (intakeD["audience.primaryPersona"] as string) || "";
  const targetMkt = (targetingD["marketIntelligence"] as Record<string, unknown> | undefined) ?? {};
  const avgCPL = (targetMkt["averageCPL"] as number | undefined) ?? 0;
  const typicalROAS = (targetMkt["typicalROAS"] as number | undefined) ?? 0;
  // Budget distribution (approx)
  const fbBudget = budgetNum > 0 ? Math.round(budgetNum * 0.45) : null;
  const googleBudget = budgetNum > 0 ? Math.round(budgetNum * 0.30) : null;
  const tiktokBudget = budgetNum > 0 ? Math.round(budgetNum * 0.25) : null;
  const hasBudget = budgetNum > 0;
  // Estimated reach: CPL from AI or estimate
  const cplEst = avgCPL > 0 ? avgCPL : (budgetNum > 0 ? Math.round(budgetNum * 0.04) : 0);
  const reachEst = budgetNum > 0 && cplEst > 0 ? Math.round((budgetNum / cplEst) * 8) : 0;
  const leadsEst = budgetNum > 0 && cplEst > 0 ? Math.round(budgetNum / cplEst) : 0;
  void pricingStrategy; void funnelStrategy;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-success/30 bg-success/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-success">Análise Estratégica Completa</div>
            <div className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
              Revise e aprove cada seção. Quando tudo ok, a IA gera o conteúdo completo.
            </div>
          </div>
        </div>
        <button onClick={approveAll} disabled={proceedLoading || localLoading}
          className="font-mono text-[11px] uppercase tracking-widest text-success border border-success/40 hover:bg-success/10 px-3 py-1.5 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50">
          {(proceedLoading || localLoading) ? <><Loader2 className="h-3 w-3 animate-spin" />Gerando...</> : <><Zap className="h-3 w-3" />Aprovar Tudo e Gerar</>}
        </button>
      </div>

      {/* ── Intelligence Panel — Big Domino + AI Thesis (informational) ── */}
      {(bigDomino || execSummaryText || competitive) && (
        <div className="border border-primary/25 bg-primary/3 overflow-hidden">
          <div className="px-4 py-3 border-b border-primary/20">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <Activity className="h-3 w-3" />Inteligência Estratégica — Análise Real da IA
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">Diagnóstico executivo gerado pelos agentes. Informativo — não requer aprovação.</div>
          </div>
          <div className="p-4 space-y-3">
            {bigDomino && (
              <div className="border border-yellow-400/30 bg-yellow-400/5 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80 mb-1.5 font-bold flex items-center gap-1.5">
                  <Target className="h-3 w-3" />Big Domino — Crença Principal a Plantar
                </div>
                <p className="font-mono text-xs text-foreground/85 leading-relaxed">{bigDomino}</p>
              </div>
            )}
            {execSummaryText && (
              <div className="border border-border/30 bg-card/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-bold">Diagnóstico Executivo</div>
                <p className="font-mono text-xs text-foreground/75 leading-relaxed line-clamp-6">{execSummaryText}</p>
              </div>
            )}
            {competitive && (
              <div className="border border-border/30 bg-card/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-bold">Landscape Competitivo</div>
                <p className="font-mono text-xs text-foreground/75 leading-relaxed line-clamp-4">{competitive}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 1: Audience segmentation */}
      <div className="border border-border/50 bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-2">
              <Users className="h-3 w-3" />Seção 1 — Segmentação de Audiência
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">Quem vamos alcançar e como chegar até eles por canal</div>
          </div>
          {secA !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secA === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secA === "approved" ? "✓ Aprovado" : "↻ Revisão"}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {(strategyD["audienceSegmentation"] ?? audienceD["avatars"] ?? audienceD["segments"]) ? (
            <PlanText value={strategyD["audienceSegmentation"] ?? audienceD} />
          ) : (
            <PlanText value={{
              avatar_primario: (intakeD["audience.primaryPersona"] as string) || "Definido no briefing",
              canal_principal: "Instagram + TikTok + E-mail + WhatsApp",
              abordagem: "Conteúdo orgânico de autoridade + tráfego pago de conversão",
            }} />
          )}
          {/* Per-platform reach summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            {briefs.map(b => {
              const m = PLT[b.platform];
              return (
                <div key={b.platform} className={`border ${m.bdr} ${m.bg} px-2.5 py-2`}>
                  <div className={`font-mono text-[9px] font-bold uppercase tracking-widest ${m.col} mb-1`}>{m.label}</div>
                  <div className="text-[8px] font-mono text-muted-foreground/60 leading-snug">{b.angle.slice(0, 40)}</div>
                </div>
              );
            })}
          </div>
          {secA === "editing" && (
            <div className="pt-1 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80 font-bold flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />Instruções de ajuste — Segmentação
              </div>
              <textarea
                className="w-full bg-card/40 border border-yellow-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-yellow-400/60"
                rows={4}
                placeholder="Ex: quero tráfego pago com geolocalização nas academias da cidade, raio de 5km por unidade, combinar com orgânico no Instagram..."
                value={userNotes["secA"] ?? ""}
                onChange={e => setNote("secA", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secA", setSecA)}
                  className="py-2 border border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/15 font-mono text-[10px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />Salvar & Aprovar
                </button>
                <button onClick={() => setSecA("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {secA === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecA("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />Aprovar Segmentação
              </button>
              <button onClick={() => setSecA("editing")}
                className="py-2.5 border border-yellow-400/30 hover:bg-yellow-400/10 font-mono text-[11px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />Editar & Ajustar
              </button>
            </div>
          )}
          {secA === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secA"] && (
                <div className="border border-yellow-400/20 bg-yellow-400/5 p-2 font-mono text-[10px] text-yellow-400/80">
                  <span className="text-muted-foreground/50 uppercase">Instrução salva: </span>{savedNotes["secA"]}
                </div>
              )}
              <button onClick={() => setSecA("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />Aprovado · Clique para editar instrução
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Platform creative briefs */}
      <div className="border border-border/50 bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
            <Layers className="h-3 w-3" />Seção 2 — Criativos por Plataforma
          </div>
          <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">
            Visual, formato, gatilho e ações para cada canal — aprove um a um
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {briefs.map(b => (
              <PlatformMockCard
                key={b.platform}
                brief={b}
                state={platStates[b.platform]}
                onApprove={() => setPlt(b.platform, "approved")}
                onRevise={() => setPlt(b.platform, "pending")}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Paid Traffic Plan */}
      <div className="border border-border/50 bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-orange-400 font-bold flex items-center gap-2">
              <DollarSign className="h-3 w-3" />Seção 3 — Tráfego Pago & Alcance
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">Orçamento, distribuição por canal, segmentação e alcance estimado</div>
          </div>
          {secC !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secC === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secC === "approved" ? "✓ Aprovado" : "↻ Revisão"}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {hasBudget ? (
            <>
              {/* Budget KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-orange-400/25 bg-orange-400/5 p-3 text-center">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-orange-400/70 mb-1">Budget Total</div>
                  <div className="font-mono text-sm font-bold text-orange-400">
                    {budgetNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </div>
                </div>
                {cplEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">CPL Est.</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">
                      R$ {cplEst.toFixed(0)}
                      {avgCPL > 0 && <span className="font-mono text-[8px] text-muted-foreground/40 block">via IA</span>}
                    </div>
                  </div>
                )}
                {leadsEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">Leads Est.</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{leadsEst.toLocaleString("pt-BR")}</div>
                  </div>
                )}
                {reachEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">Alcance Est.</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{reachEst.toLocaleString("pt-BR")}</div>
                  </div>
                )}
                {typicalROAS > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">ROAS Típico</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{typicalROAS.toFixed(1)}x</div>
                  </div>
                )}
              </div>
              {/* Channel distribution */}
              <div className="border border-border/30 bg-card/20 p-3 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">Distribuição por Canal</div>
                {[
                  { label: "Meta Ads (Facebook + Instagram)", budget: fbBudget, pct: 45, col: "bg-blue-500" },
                  { label: "Google Ads (Search + Display)", budget: googleBudget, pct: 30, col: "bg-red-500" },
                  { label: "TikTok Ads", budget: tiktokBudget, pct: 25, col: "bg-cyan-500" },
                ].map(ch => ch.budget !== null && (
                  <div key={ch.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-foreground/70">{ch.label}</span>
                      <span className="font-mono text-[10px] font-bold text-foreground/80">
                        {ch.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} · {ch.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-border/20 rounded-full overflow-hidden">
                      <div className={`h-full ${ch.col} opacity-60`} style={{ width: `${ch.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Targeting plan */}
              <div className="border border-border/30 bg-card/20 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">Plano de Segmentação</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Público Frio — Interesses", value: persona ? `Interesses relacionados a: ${persona}` : "Interesses do nicho + comportamento de compra" },
                    { label: "Lookalike 1–3%", value: `Baseado em lista de clientes ${product} + engajamento no perfil` },
                    { label: "Retargeting Quente", value: "Visitantes do site D-7 · Engajadores do Instagram D-30 · Leads da lista VIP" },
                    { label: "Exclusões", value: "Clientes ativos · Inscritos na newsletter já convertidos" },
                  ].map(seg => (
                    <div key={seg.label}>
                      <span className="font-mono text-[10px] text-orange-400/70 uppercase">{seg.label}: </span>
                      <span className="font-mono text-[10px] text-foreground/70">{seg.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-border/30 bg-card/20 p-3 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">Plano de Segmentação (Orgânico)</div>
              <PlanText value={{
                abordagem: "Lançamento 100% orgânico — sem investimento pago",
                canais_principais: "Instagram Reels + TikTok + E-mail + WhatsApp VIP",
                estrategia: "Autoridade orgânica + parcerias estratégicas + lista de leads própria",
                amplificacao: "Conteúdo de valor → captura de leads → nutrição → carrinho aberto",
              }} />
            </div>
          )}
          {secC === "editing" && (
            <div className="pt-1 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400/80 font-bold flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />Instruções de ajuste — Tráfego & Alcance
              </div>
              <textarea
                className="w-full bg-card/40 border border-orange-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-400/60"
                rows={4}
                placeholder="Ex: quero tráfego PAGO nas academias da cidade usando geolocalização por raio de 5km em cada unidade, combinar Meta Ads + Google Ads, aumentar número de inserções semanais para pelo menos 5 por plataforma..."
                value={userNotes["secC"] ?? ""}
                onChange={e => setNote("secC", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secC", setSecC)}
                  className="py-2 border border-orange-400/40 bg-orange-400/10 hover:bg-orange-400/15 font-mono text-[10px] uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />Salvar & Aprovar
                </button>
                <button onClick={() => setSecC("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {secC === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecC("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />Aprovar Plano de Tráfego
              </button>
              <button onClick={() => setSecC("editing")}
                className="py-2.5 border border-orange-400/30 hover:bg-orange-400/10 font-mono text-[11px] uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />Editar & Ajustar
              </button>
            </div>
          )}
          {secC === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secC"] && (
                <div className="border border-orange-400/20 bg-orange-400/5 p-2 font-mono text-[10px] text-orange-400/80">
                  <span className="text-muted-foreground/50 uppercase">Instrução salva: </span>{savedNotes["secC"]}
                </div>
              )}
              <button onClick={() => setSecC("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />Aprovado · Clique para editar instrução
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Architecture + Timeline */}
      <div className="border border-border/50 bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-2">
              <Target className="h-3 w-3" />Seção 4 — Arquitetura & Cronograma
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">Fases do lançamento, milestones e metas projetadas</div>
          </div>
          {secB !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secB === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secB === "approved" ? "✓ Aprovado" : "↻ Revisão"}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {strategyD["campaignArchitecture"] ? <PlanText value={strategyD["campaignArchitecture"] as Record<string, unknown>} /> : null}
          {Object.keys(timelineD).length > 0 && <PlanText value={timelineD} />}
          {!strategyD["campaignArchitecture"] && Object.keys(timelineD).length === 0 && (
            <PlanText value={{
              pre_lancamento: "D-7 a D-1: Aquecimento orgânico + lista VIP",
              abertura: "D0: Abertura do carrinho em todas as plataformas simultaneamente",
              meio: "D1-D5: Conteúdo de objeções + prova social + retargeting",
              fechamento: "D6-D7: Escassez máxima + última chamada",
            }} />
          )}
          {strategyD["successMetrics"] ? (
            <div className="border border-yellow-400/20 bg-yellow-400/5 p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 mb-2 font-bold">Metas & KPIs Projetados</div>
              <PlanText value={strategyD["successMetrics"] as Record<string, unknown>} />
            </div>
          ) : null}
          {secB === "editing" && (
            <div className="pt-1 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80 font-bold flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />Instruções de ajuste — Cronograma
              </div>
              <textarea
                className="w-full bg-card/40 border border-yellow-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-yellow-400/60"
                rows={4}
                placeholder="Ex: quero mais inserções — pelo menos 15 posts antes da abertura do carrinho, dividir entre orgânico diário e pago com boosting nos melhores Reels..."
                value={userNotes["secB"] ?? ""}
                onChange={e => setNote("secB", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secB", setSecB)}
                  className="py-2 border border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/15 font-mono text-[10px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />Salvar & Aprovar
                </button>
                <button onClick={() => setSecB("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {secB === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecB("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />Aprovar Cronograma
              </button>
              <button onClick={() => setSecB("editing")}
                className="py-2.5 border border-yellow-400/30 hover:bg-yellow-400/10 font-mono text-[11px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />Editar & Ajustar
              </button>
            </div>
          )}
          {secB === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secB"] && (
                <div className="border border-yellow-400/20 bg-yellow-400/5 p-2 font-mono text-[10px] text-yellow-400/80">
                  <span className="text-muted-foreground/50 uppercase">Instrução salva: </span>{savedNotes["secB"]}
                </div>
              )}
              <button onClick={() => setSecB("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />Aprovado · Clique para editar instrução
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Proceed CTA */}
      {allDecided && (
        <div className="border border-primary/30 bg-primary/5 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="font-mono text-sm font-bold uppercase tracking-widest mb-1 text-primary">
                Tudo aprovado — pronto para gerar!
              </div>
              <div className="text-xs font-mono text-muted-foreground/60">
                {hasNotes
                  ? "Suas instruções foram salvas. A IA vai incorporar todos os ajustes ao gerar copy, criativos, e-mails e sequências."
                  : "A IA vai gerar todo o conteúdo agora: copy, criativos, e-mails e sequências completas."}
              </div>
            </div>
            <Button
              className="font-mono uppercase tracking-widest rounded-none gap-2 h-12 px-8 w-full md:w-auto btn-weapon-primary"
              onClick={() => onProceed(savedNotes)}
              disabled={proceedLoading}
            >
              {proceedLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando Conteúdo...</>
                : <><Zap className="h-4 w-4" />Gerar Conteúdo Completo</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState<"comando" | "agentes" | "estrategia" | "conteudo" | "metricas">("comando");
  const { isArquiteto } = useMode();
  const [missingIntegrations, setMissingIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [partialIntegrations, setPartialIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [connectingEntry, setConnectingEntry] = useState<CatalogEntry | null>(null);
  const [bypassLaunchLoading, setBypassLaunchLoading] = useState(false);
  const [reorientOpen, setReorientOpen] = useState(false);
  const [reorientDirective, setReorientDirective] = useState("");
  const [showLaunchSequence, setShowLaunchSequence] = useState(false);

  const reorientMutation = useMutation({
    mutationFn: async (directive: string) => {
      return customFetch<{ ok: boolean; status: string }>(`/api/campaigns/${campaignId}/reorient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive }),
      });
    },
    onSuccess: () => {
      toast.success("Reorientação iniciada! A IA está reconstruindo a estratégia do zero.", { duration: 5000 });
      setReorientOpen(false);
      setReorientDirective("");
      setActiveTab("agentes");
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const data = err.data as { code?: string; error?: string; data?: { balance?: number; shortage?: number } } | null;
        if (data?.code === "INSUFFICIENT_CREDITS") {
          const shortage = data.data?.shortage ?? 0;
          toast.error(
            `Créditos insuficientes. Faltam ${shortage} crédito${shortage !== 1 ? "s" : ""} para reconstruir a estratégia.`,
            {
              duration: 8000,
              action: { label: "Comprar créditos", onClick: () => setLocation("/creditos") },
            },
          );
        } else {
          toast.error(data?.error ?? err.message);
        }
      } else if (err instanceof Error) {
        toast.error(err.message);
      }
    },
  });

  const connectIntegrationMutation = useMutation({
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
      toast.success("Integração conectada! Tente lançar novamente.");
      setConnectingEntry(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
  const autoLaunchFired = useRef(false);

  const { data, isLoading } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
    },
  });

  const campaign = data?.campaign;
  const isActive = ACTIVE_STATUSES.includes(campaign?.status ?? "");
  const refetchInterval = isActive ? 5000 : false;

  // Auto-redirect draft/intake to the intake wizard
  useEffect(() => {
    if (!campaign) return;
    if (campaign.status === "draft" || campaign.status === "intake") {
      setLocation(`/campaigns/${campaignId}/intake`);
    }
  }, [campaign?.status, campaignId, setLocation, campaign]);

  // ── Agents query ──────────────────────────────────────────────────────────────
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/agents`],
    enabled: !!campaignId && activeTab === "agentes",
    refetchInterval: isActive ? 5000 : false,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/agents`);
      if (!res.ok) return { agents: [], checkpoints: [] };
      return res.json() as Promise<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>;
    },
  });

  // ── Content query ──────────────────────────────────────────────────────────────
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    enabled: !!campaignId && (activeTab === "conteudo" || activeTab === "agentes"),
    refetchInterval: isActive ? 5000 : false,
    staleTime: 0,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return null;
      return res.json() as Promise<{ pieces: ContentPiece[] }>;
    },
  });

  // ── Content preview query (for awaiting_approval visual banner) ────────────
  const { data: previewContentData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content/preview`],
    enabled: !!campaignId && campaign?.status === "awaiting_approval",
    staleTime: 0,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return null;
      return res.json() as Promise<{ pieces: ContentPiece[] }>;
    },
  });

  // Extract actual copy text from aggregated JSON content pieces
  function extractCopyFromPiece(type: string, raw: unknown): { body: string; platform: PreviewPiece["platform"]; pieceType: PreviewPiece["type"]; title: string } | null {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    try {
      if (type === "email_sequence") {
        const sp = (c["salesPage"] as Record<string, unknown> | undefined);
        const headline = sp?.["sections"] && Array.isArray(sp["sections"]) ? (sp["sections"][0] as Record<string, unknown>)?.["headline"] as string : null;
        const emails = c["emailSequence"] as Record<string, unknown> | undefined;
        const preLaunch = emails?.["preLaunch"] as Array<Record<string, unknown>> | undefined;
        const subj = preLaunch?.[0]?.["subject"] as string | undefined;
        const preview = preLaunch?.[0]?.["previewText"] as string | undefined;
        const body = headline ?? subj ?? preview ?? "";
        if (!body) return null;
        return { body, platform: "email", pieceType: "email", title: "E-mail — Sequência de Lançamento" };
      }
      if (type === "stories_sequence") {
        const seqs = c["sequences"] as Array<Record<string, unknown>> | undefined;
        const frame = (seqs?.[0]?.["frames"] as Array<Record<string, unknown>> | undefined)?.[0];
        const text = frame?.["textContent"] as string | undefined;
        if (!text) return null;
        return { body: text, platform: "instagram", pieceType: "story", title: "Stories — Pré-Lançamento" };
      }
      if (type === "landing_page_structure") {
        const sections = c["sections"] as Array<Record<string, unknown>> | undefined;
        const hero = sections?.find(s => (s["sectionId"] as string)?.includes("hero") || (s["purpose"] as string)?.toLowerCase().includes("hero"));
        const headline = (hero ?? sections?.[0])?.["headline"] as string | undefined;
        if (!headline) return null;
        return { body: headline, platform: "instagram", pieceType: "post", title: "Landing Page — Hero" };
      }
      if (type === "cpl_script") {
        const videos = c["videos"] as Array<Record<string, unknown>> | undefined;
        const hook = videos?.[0]?.["hook"] as string | undefined;
        if (!hook) return null;
        return { body: hook, platform: "tiktok", pieceType: "native_video", title: "CPL — Vídeo 1" };
      }
      if (type === "live_script") {
        const segments = c["segments"] as Array<Record<string, unknown>> | undefined;
        const opening = segments?.find(s => (s["type"] as string) === "opening" || (s["name"] as string)?.toLowerCase().includes("open"));
        const script = opening?.["script"] as string | undefined;
        if (!script) return null;
        return { body: script.slice(0, 200), platform: "facebook", pieceType: "post", title: "Live — Abertura do Carrinho" };
      }
      if (type === "creative_direction") {
        const dos = (c["doAndDonts"] as Record<string, unknown> | undefined)?.["dos"] as string[] | undefined;
        const headline = (c["visualConcepts"] as Array<Record<string, unknown>> | undefined)?.[0]?.["headline"] as string | undefined;
        const body = headline ?? dos?.[0] ?? "";
        if (!body) return null;
        return { body, platform: "instagram", pieceType: "post", title: "Direção Criativa — Conceito Visual" };
      }
    } catch { return null; }
    return null;
  }

  const VISUAL_PLATFORM_ORDER = ["instagram", "tiktok", "facebook"];
  const previewSnippets: PreviewPiece[] = (() => {
    const raw = previewContentData?.pieces ?? [];
    if (raw.length === 0) return [];

    const extracted: PreviewPiece[] = [];
    for (const p of raw) {
      const rawType = (p.type ?? "").toLowerCase().replace(/\s+/g, "_");
      let contentObj: unknown = p.content;
      if (typeof contentObj === "string") {
        try { contentObj = JSON.parse(contentObj); } catch { contentObj = null; }
      }
      const result = extractCopyFromPiece(rawType, contentObj);
      if (result && VISUAL_PLATFORM_ORDER.includes(result.platform)) {
        extracted.push({
          id: p.id,
          platform: result.platform,
          type: result.pieceType,
          dayIndex: 0,
          title: result.title,
          body: result.body,
          status: (p.status === "draft" || p.status === "pending_approval") ? "pending" : p.status as PreviewPiece["status"],
          segment: "all",
        });
      }
    }
    // One per platform (instagram, tiktok, facebook)
    const byPlatform = VISUAL_PLATFORM_ORDER.flatMap(plt => extracted.filter(p => p.platform === plt).slice(0, 1));
    return byPlatform.slice(0, 3);
  })();

  // ── Metrics query ──────────────────────────────────────────────────────────────
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/metrics/summary`],
    enabled: !!campaignId && activeTab === "metricas",
    refetchInterval: isActive ? 10000 : false,
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/metrics/summary`);
      if (!res.ok) return null;
      return res.json() as Promise<MetricsSummary>;
    },
  });

  // ── Alerts query ──────────────────────────────────────────────────────────────
  const { data: alertsData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/alerts`],
    enabled: !!campaignId && activeTab === "metricas",
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/alerts`);
      if (!res.ok) return { alerts: [] };
      return res.json() as Promise<{ alerts: MetricAlert[] }>;
    },
  });

  // ── Connected integrations (for launch sequence overlay) ───────────────────
  const { data: integrationsData } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    enabled: !!campaignId,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] };
      return res.json() as Promise<{ integrations: { provider: string; status: string }[] }>;
    },
  });
  const connectedProviders = (integrationsData?.integrations ?? [])
    .filter(i => i.status === "connected")
    .map(i => i.provider);

  // ── Real-time agent streaming via Socket.io ────────────────────────────────────
  const [liveEvents, setLiveEvents] = useState<CampaignEvent[]>([]);
  const liveRef = useRef<HTMLDivElement>(null);

  useCampaignSocket(
    campaignId,
    (event) => {
      setLiveEvents((prev) => {
        const next = [...prev, event].slice(-50); // keep last 50
        return next;
      });
      // Auto-invalidate queries on meaningful events
      if (event.type === "agent_completed" || event.type === "checkpoint_created" || event.type === "phase_changed") {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/agents`] });
      }
    },
    true,
  );

  // Auto-scroll live feed
  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveEvents]);

  // Polling fallback: if active but socket hasn't delivered events, show a message after 12s
  useEffect(() => {
    if (!isActive || liveEvents.length > 1) return;
    const timer = setTimeout(() => {
      setLiveEvents(prev => {
        if (prev.length > 1) return prev;
        return [...prev, {
          campaignId,
          type: "execution_update" as const,
          message: "Processando em background — aguardando próxima atualização dos agentes...",
          timestamp: new Date().toISOString(),
        }];
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [isActive, liveEvents.length, campaignId]);

  // ── Execute campaign phase ─────────────────────────────────────────────────────
  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success("Fase iniciada. A IA está em execução.");
        setActiveTab("agentes");
        setLiveEvents(prev => [...prev, {
          campaignId,
          type: "execution_update" as const,
          message: "Fase iniciada — agentes sendo ativados em instantes...",
          timestamp: new Date().toISOString(),
        }]);
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      },
      onError: (err: unknown) => {
        // ApiError from customFetch exposes parsed JSON body in .data directly
        // (.response is the raw Fetch Response object, not { data: ... })
        type ErrBody = { error?: string; code?: string; data?: { shortage?: number; balance?: number; required?: number; missing?: { category: string; providers: string[]; reason?: string }[] } };
        const apiErr = err as { data?: ErrBody; status?: number };
        const errData = apiErr?.data;
        const code = errData?.code;
        const msg = errData?.error;
        if (code === "INSUFFICIENT_CREDITS" && errData?.data) {
          const { shortage = 0, balance = 0, required = 0 } = errData.data;
          toast.error(`Créditos insuficientes — faltam ${shortage} cr (saldo: ${balance}, necessário: ${required})`, {
            description: "Acesse Créditos de IA para comprar mais.",
            duration: 8000,
          });
        } else if (code === "MISSING_INTEGRATIONS") {
          setMissingIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else if (code === "PARTIAL_INTEGRATIONS") {
          setPartialIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else {
          toast.error(msg ?? "Falha ao iniciar fase.", { duration: 6000 });
        }
      },
    },
  });

  // Reset execute mutation when campaign is strategy_ready (prevents stuck "isPending" state
  // from a previous attempt that was interrupted e.g. by API server restart)
  useEffect(() => {
    if (campaign?.status === "strategy_ready" && executeMutation.isPending) {
      executeMutation.reset();
    }
  }, [campaign?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger launch when redirected from content approval with ?autolaunch=1
  useEffect(() => {
    if (!campaign) return;
    const qs = new URLSearchParams(searchString);
    if (qs.get("autolaunch") !== "1") return;
    if (autoLaunchFired.current) return;
    if (campaign.status !== "approved") return;
    autoLaunchFired.current = true;
    window.history.replaceState(null, "", `/campaigns/${campaignId}`);
    executeMutation.mutate({ campaignId, data: { phase: "launch" as CampaignExecuteInputPhase } });
  }, [campaign?.status, searchString, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Approve/reject content ─────────────────────────────────────────────────────
  const [contentActionLoading, setContentActionLoading] = useState<string | null>(null);
  const handleContentAction = async (pieceId: string, action: "approve" | "reject") => {
    setContentActionLoading(pieceId);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${pieceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro");
      }
      toast.success(action === "approve" ? "Conteúdo aprovado." : "Conteúdo rejeitado.");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar ação");
    } finally {
      setContentActionLoading(null);
    }
  };

  // ── Launch with bypass (after partial-integrations confirmation) ──────────────
  const handleBypassLaunch = async () => {
    setBypassLaunchLoading(true);
    setPartialIntegrations(null);
    try {
      const res = await customFetch<Response>(
        `/api/campaigns/${campaignId}/execute/launch?skipIntegrationWarning=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao lançar");
      }
      toast.success("Lançamento iniciado. A IA está em execução.");
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao lançar campanha.");
    } finally {
      setBypassLaunchLoading(false);
    }
  };

  // ── Approve checkpoint ────────────────────────────────────────────────────────
  const [checkpointLoading, setCheckpointLoading] = useState<string | null>(null);
  const handleCheckpointApprove = async (checkpointId: string) => {
    setCheckpointLoading(checkpointId);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId, approved: true }),
      });
      if (!res.ok) throw new Error("Erro");
      toast.success("Checkpoint aprovado.");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/agents`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch {
      toast.error("Erro ao aprovar checkpoint.");
    } finally {
      setCheckpointLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-32 w-full bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">
        Campanha não encontrada no registro
      </div>
    );
  }

  // While redirecting draft/intake, show a minimal loading state
  if (campaign.status === "draft" || campaign.status === "intake") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="relative">
          <div className="w-14 h-14 border border-primary/30 bg-primary/5 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-primary/40" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-primary/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-sm text-foreground font-bold uppercase tracking-widest">
            Abrindo o briefing com IA...
          </p>
          <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
            Em alguns segundos a IA vai iniciar a conversa
          </p>
        </div>
      </div>
    );
  }

  const campaignRaw = campaign as unknown as Record<string, unknown>;
  const intakeD = ((campaignRaw["intakeData"] ?? {}) as Record<string, unknown>);
  const strategyD = ((campaignRaw["strategyData"] ?? {}) as Record<string, unknown>);
  const offerD = ((campaignRaw["offerData"] ?? {}) as Record<string, unknown>);
  const audienceD = ((campaignRaw["audienceData"] ?? {}) as Record<string, unknown>);
  const targetingD = ((campaignRaw["targetingData"] ?? {}) as Record<string, unknown>);
  const timelineD = ((campaignRaw["timelineData"] ?? {}) as Record<string, unknown>);

  const getNextAction = (): { label: string; phase?: CampaignExecuteInputPhase; href?: string; description: string } | null => {
    switch (campaign.status) {
      case "analyzing": return { phase: "strategy" as CampaignExecuteInputPhase, label: "Iniciar Análise Estratégica", description: "Briefing completo. A IA vai montar sua estratégia de lançamento agora." };
      case "strategy_ready": return { label: "Revisar Estratégia", description: "Estratégia pronta. Revise e aprove cada seção no board antes de gerar o conteúdo.", phase: undefined };
      case "awaiting_approval": return { href: `/campaigns/${campaignId}/content`, label: "Aprovar Conteúdo", description: "A IA gerou o conteúdo completo. Revise e aprove antes do lançamento.", phase: undefined };
      case "approved": return { phase: "launch", label: "Lançar Campanha", description: "Conteúdo aprovado. Inicie o lançamento." };
      case "executing": return { phase: "monitor", label: "Ativar Monitoramento", description: "Campanha em execução. Ative o monitoramento de métricas." };
      default: return null;
    }
  };
  const nextAction = getNextAction();

  const TABS = [
    { id: "comando" as const, label: "Comando", icon: Zap },
    { id: "agentes" as const, label: "Agentes", icon: Bot },
    { id: "estrategia" as const, label: "Proposta", icon: BookOpen },
    { id: "conteudo" as const, label: "Conteúdo", icon: Layers },
    { id: "metricas" as const, label: "Métricas", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">

      {/* ── Launch Sequence Overlay ── */}
      {showLaunchSequence && (
        <LaunchSequenceOverlay
          campaignId={campaignId}
          campaignTitle={campaign.title ?? "Campanha"}
          connectedProviders={connectedProviders}
          onClose={() => setShowLaunchSequence(false)}
        />
      )}

      {/* ── Missing Integrations Modal (hard block) ── */}
      {missingIntegrations && !connectingEntry && (() => {
        const PROVIDER_NAME_MAP: Record<string, CatalogEntry | undefined> = Object.fromEntries(
          INTEGRATION_CATALOG.map(e => [e.label.toLowerCase(), e])
        );
        const SHORT_NAMES: Record<string, string> = {
          "whatsapp business": "whatsapp_business",
          "telegram": "telegram",
          "rd station": "rd_station",
          "activecampaign": "activecampaign",
          "resend": "resend",
          "instagram": "instagram",
          "tiktok": "tiktok",
          "facebook/meta ads": "meta_ads",
        };
        const findEntry = (name: string): CatalogEntry | undefined => {
          const lower = name.toLowerCase();
          const byLabel = PROVIDER_NAME_MAP[lower];
          if (byLabel) return byLabel;
          const providerId = SHORT_NAMES[lower];
          if (providerId) return INTEGRATION_CATALOG.find(e => e.provider === providerId);
          return INTEGRATION_CATALOG.find(e => e.label.toLowerCase().includes(lower) || lower.includes(e.label.toLowerCase().split(" ")[0] ?? ""));
        };
        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="border border-destructive/50 bg-card w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
              <div className="border-b border-destructive/20 px-5 py-4 flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-destructive">Canais Obrigatórios Ausentes</h3>
                    <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">Conecte ao menos um canal de mensagens e um de e-mail para lançar.</p>
                  </div>
                </div>
                <button onClick={() => setMissingIntegrations(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 space-y-5">
                {missingIntegrations.map(m => (
                  <div key={m.category}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-destructive/80">{m.category}</div>
                      <div className="flex-1 h-px bg-destructive/20" />
                    </div>
                    {m.reason && (
                      <p className="font-mono text-[11px] text-muted-foreground/50 mb-3 px-1">{m.reason}</p>
                    )}
                    <div className="space-y-2">
                      {m.providers.map(providerName => {
                        const entry = findEntry(providerName);
                        if (!entry) return (
                          <div key={providerName} className="border border-border/30 bg-muted/10 px-4 py-3 flex items-center justify-between">
                            <span className="font-mono text-xs text-foreground/70">{providerName}</span>
                            <Link href="/integracoes">
                              <Button size="sm" variant="outline" className="font-mono uppercase tracking-widest rounded-none h-7 px-3 text-[11px] border-border/50">
                                <Link2 className="h-3 w-3 mr-1" />Conectar
                              </Button>
                            </Link>
                          </div>
                        );
                        const Icon = entry.icon;
                        return (
                          <div key={entry.provider} className="border border-border/40 bg-card/60 px-4 py-3 flex items-center gap-3">
                            <div className={`w-7 h-7 border rounded-sm flex items-center justify-center shrink-0 ${entry.color} border-current/30 bg-current/5`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs font-bold text-foreground leading-tight">{entry.label}</div>
                              <p className="font-mono text-[10px] text-muted-foreground/55 mt-0.5 leading-relaxed truncate">{entry.description}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => setConnectingEntry(entry)}
                              className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-7 px-3 text-[11px] btn-weapon-primary shrink-0"
                            >
                              <Link2 className="h-3 w-3" />Conectar
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/50 px-5 py-3 shrink-0">
                <Button variant="outline" onClick={() => setMissingIntegrations(null)} className="w-full font-mono uppercase tracking-widest rounded-none border-border/50 h-9 text-[11px]">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Reorient Modal ── */}
      {reorientOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-orange-500/40 bg-card w-full max-w-lg shadow-2xl">
            <div className="border-b border-orange-500/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-orange-500/30 bg-orange-500/10 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-orange-400">Reorientar Estratégia</h3>
                  <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">A IA vai apagar tudo e reconstruir do zero com sua nova direção.</p>
                </div>
              </div>
              <button onClick={() => { setReorientOpen(false); setReorientDirective(""); }} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400/70 font-bold">O que vai acontecer</div>
                <ul className="space-y-1">
                  {["Estratégia atual será descartada", "Todos os conteúdos gerados serão removidos", "A IA relerá seu briefing + nova direção", "Estratégia e copy serão reconstruídos do zero"].map(item => (
                    <li key={item} className="flex items-start gap-2 font-mono text-[11px] text-muted-foreground/70">
                      <span className="text-orange-400/60 shrink-0 mt-0.5">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">
                  Sua nova direção — seja específico sobre o ângulo, posicionamento ou narrativa
                </label>
                <textarea
                  value={reorientDirective}
                  onChange={e => setReorientDirective(e.target.value)}
                  placeholder="Ex: Percebi que meu público-alvo tem medo de falhar, não medo de perder dinheiro. Quero mudar o ângulo de toda a campanha para transformação pessoal e superação do medo, com uma narrativa mais emocional. O produto passa a ser vendido como uma virada de chave, não uma ferramenta técnica."
                  rows={6}
                  className="w-full bg-muted/10 border border-border/50 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-orange-500/50 focus:bg-orange-500/5 transition-colors"
                />
                <div className={`font-mono text-[10px] mt-1 text-right transition-colors ${reorientDirective.length < 10 ? "text-muted-foreground/40" : "text-orange-400/60"}`}>
                  {reorientDirective.length} caracteres {reorientDirective.length < 10 && "(mínimo 10)"}
                </div>
              </div>
            </div>
            <div className="border-t border-orange-500/20 px-5 py-3 flex gap-3">
              <Button
                onClick={() => reorientMutation.mutate(reorientDirective)}
                disabled={reorientMutation.isPending || reorientDirective.trim().length < 10}
                className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 h-10 text-xs"
                style={{ background: "rgb(249 115 22 / 0.15)", border: "1px solid rgb(249 115 22 / 0.5)", color: "rgb(251 146 60)" }}
              >
                {reorientMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reorientando...</>
                  : <><RefreshCw className="h-3.5 w-3.5" />Reorientar e Reconstruir</>
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => { setReorientOpen(false); setReorientDirective(""); }}
                disabled={reorientMutation.isPending}
                className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-4 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline ConnectModal — opens on top of missing integrations modal */}
      {connectingEntry && (
        <ConnectModal
          entry={connectingEntry}
          onClose={() => setConnectingEntry(null)}
          onConnect={(provider, fields) => connectIntegrationMutation.mutate({ provider, fields })}
          onOAuthSuccess={() => {
            toast.success("Integração conectada via OAuth! Tente lançar novamente.");
            setConnectingEntry(null);
          }}
        />
      )}

      {/* ── Partial Integrations Modal (soft confirmation) ── */}
      {partialIntegrations && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-yellow-400/40 bg-card w-full max-w-lg shadow-2xl">
            <div className="border-b border-yellow-400/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-yellow-400">Cobertura de Canais Incompleta</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">Você pode lançar agora ou completar as integrações para máxima performance.</p>
                </div>
              </div>
              <button onClick={() => setPartialIntegrations(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/70 border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                <span className="text-yellow-400 font-bold">Atenção:</span> Sem todos os canais conectados, a IA operará com alcance reduzido. Canais ausentes não receberão disparo automático.
              </p>
              {partialIntegrations.map(m => (
                <div key={m.category} className="border border-border/40 bg-muted/10 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400/70 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80 mb-0.5">{m.category}</div>
                    {m.reason && <p className="text-xs font-mono text-muted-foreground/50 mb-1">{m.reason}</p>}
                    <p className="text-xs font-mono text-muted-foreground/70">Opções: <span className="text-foreground/60">{m.providers.join(" · ")}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 px-5 py-4 flex flex-col sm:flex-row gap-3">
              <Link href="/integracoes" className="flex-1">
                <Button className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10" onClick={() => setPartialIntegrations(null)}>
                  <Link2 className="h-4 w-4" />Completar Integrações
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleBypassLaunch}
                disabled={bypassLaunchLoading}
                className="flex-1 font-mono uppercase tracking-widest rounded-none border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 h-10 gap-2"
              >
                {bypassLaunchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Lançar Assim Mesmo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Retornar ao Radar
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground break-words">
                {campaign.title}
              </h1>
              <Badge variant="outline" className={`font-mono uppercase text-[11px] tracking-widest rounded-none px-2 py-1 border shrink-0 ${STATUS_COLOR[campaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="bg-card px-2 py-1 border border-border/50">{campaign.type}</span>
              <span className="bg-card px-2 py-1 border border-border/50">Track: <span className="text-primary">{campaign.track}</span></span>
              {campaign.revenueTarget && <span className="bg-card px-2 py-1 border border-border/50 text-success">Meta: R$ {Number(campaign.revenueTarget).toLocaleString("pt-BR")}</span>}
              {isActive && <span className="bg-primary/10 px-2 py-1 border border-primary/30 text-primary animate-pulse">IA em execução</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/campaigns/${campaign.id}/intake`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
                <FileText className="h-3.5 w-3.5" />Briefing
              </Button>
            </Link>
            <Link href={`/campaigns/${campaign.id}/creatives`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-primary/40 hover:border-primary text-primary hover:bg-primary/10 h-9 px-3 text-xs">
                <Layers className="h-3.5 w-3.5" />Criativos
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setLocation("/sequences")} className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />Sequências
            </Button>
            {["strategy_ready", "generating", "awaiting_approval"].includes(campaign.status) && (
              <Button
                variant="outline"
                onClick={() => setReorientOpen(true)}
                className="font-mono uppercase tracking-widest rounded-none gap-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/70 h-9 px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />Reorientar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div className="border border-border/50 bg-card/40 p-4 relative overflow-hidden">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Pipeline de Execução</div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:items-center relative">
          <div className="hidden md:block absolute top-4 left-0 right-0 h-px bg-border/40 z-0" />
          {PIPELINE.map((step, idx) => {
            const state = getPipelineState(campaign.status, step.statuses);
            return (
              <div key={step.id} className="flex md:flex-col md:flex-1 items-center md:items-center gap-3 md:gap-2 relative z-10">
                {idx > 0 && <div className="md:hidden w-px h-3 bg-border/40 ml-4" />}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                  ${state === "done" ? "border-success bg-success/20" : state === "active" ? "border-primary bg-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "border-border/50 bg-muted/10"}`}>
                  {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> :
                   state === "active" ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> :
                   <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
                <span className={`text-[11px] font-mono uppercase tracking-widest md:text-center ${state === "done" ? "text-success" : state === "active" ? "text-primary" : "text-muted-foreground/40"}`}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border border-border/50 bg-card/40 p-1 rounded-sm overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all rounded-sm whitespace-nowrap shrink-0 flex-1 justify-center
              ${activeTab === tab.id ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            <tab.icon className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ COMANDO TAB ══════════════ */}
      {activeTab === "comando" && (
        <div className="space-y-4">
          {/* Next action */}
          {nextAction ? (
            <div className="border border-primary/30 bg-card/40 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-primary flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />Próxima Ação
                  </div>
                  <h3 className="font-mono font-bold text-lg text-foreground uppercase tracking-wide">{nextAction.label}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{nextAction.description}</p>
                </div>
                {nextAction.phase === "launch" ? (
                  <LaunchRocketButton
                    onClick={() => setShowLaunchSequence(true)}
                    loading={executeMutation.isPending}
                  />
                ) : nextAction.phase ? (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto"
                    onClick={() => executeMutation.mutate({ campaignId, data: { phase: nextAction.phase! } })}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Processando...</> : <><Play className="h-4 w-4 fill-current" />{nextAction.label}</>}
                  </Button>
                ) : nextAction.href ? (
                  <Link href={nextAction.href}>
                    <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto">
                      <Layers className="h-4 w-4" />{nextAction.label}
                    </Button>
                  </Link>
                ) : campaign.status === "strategy_ready" ? (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto"
                    onClick={() => setActiveTab("agentes")}
                  >
                    <Eye className="h-4 w-4" />Revisar Estratégia
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="border border-border/50 bg-card/40 p-5 flex items-center gap-4">
              {campaign.status === "live" || campaign.status === "executing" ? (
                <><div className="w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_10px_hsl(var(--success))]" />
                <div><div className="font-mono font-bold text-success uppercase tracking-widest">Campanha Ao Vivo</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">Monitorando em tempo real</div></div></>
              ) : campaign.status === "completed" ? (
                <><CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div><div className="font-mono font-bold text-muted-foreground uppercase tracking-widest">Campanha Concluída</div>
                  <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">Todos os dados disponíveis em Métricas</div></div></>
              ) : (
                <><AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div><div className="font-mono font-bold text-yellow-400 uppercase tracking-widest">Aguardando ação</div></div></>
              )}
            </div>
          )}

          {/* ─ Awaiting approval: cinema prompt ─ */}
          {campaign.status === "awaiting_approval" && (
            <ContentReadyCinemaPrompt
              campaignId={campaignId}
              totalPieces={previewContentData?.pieces?.length ?? 0}
            />
          )}

          {/* ─ Live: mission control strip ─ */}
          {(campaign.status === "live" || campaign.status === "executing") && (
            <LiveMissionControl campaignId={campaignId} />
          )}

          {/* ─ Creatives Preview (awaiting_approval) ─ */}
          {campaign.status === "awaiting_approval" && (
            <div className="border border-yellow-400/30 bg-card/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-yellow-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-yellow-400 font-bold">
                    Prévia dos Criativos Gerados pela IA
                  </span>
                </div>
                <Link href={`/campaigns/${campaignId}/content`}>
                  <button className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                    Ver todos <ChevronRight className="h-3 w-3" />
                  </button>
                </Link>
              </div>
              {(() => {
                const productName = String(intakeD["product.name"] ?? campaign.title ?? "seu produto");
                const audience = String(intakeD["audience.primaryPersona"] ?? "sua audiência");
                const handle = productName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "").slice(0, 20);
                const creatorName = handle || "seu.perfil";
                if (previewSnippets.length > 0) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {previewSnippets.map(piece => (
                        <SocialPostPreview key={piece.id} piece={{ ...piece, creatorName }} showMetrics={false} />
                      ))}
                    </div>
                  );
                }
                // Fallback: show neutral style skeletons — never show generic marketing copy
                const fallbackPosts = [
                  { platform: "instagram" as const, type: "post" as const,
                    body: `${productName}\n\nCarregando prévia do conteúdo gerado para esta campanha...`, creatorName },
                  { platform: "tiktok" as const, type: "native_video" as const,
                    body: `${productName} — prévia do roteiro em carregamento.`, tiktokHook: productName, creatorName },
                  { platform: "facebook" as const, type: "post" as const,
                    body: `${productName}\n\nCarregando prévia do conteúdo gerado para esta campanha...`, creatorName },
                ];
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {fallbackPosts.map((p, i) => (
                      <SocialPostPreview key={i} piece={{ id: `preview-${i}`, dayIndex: 0, title: `${p.platform} — Dia 0`, status: "pending", segment: "all", ...p }} showMetrics={false} />
                    ))}
                  </div>
                );
              })()}
              <p className="font-mono text-[11px] text-muted-foreground/50">
                {previewSnippets.length > 0
                  ? `${previewSnippets.length} de ${previewContentData?.pieces?.length ?? 0} peças. Revise e aprove antes de lançar.`
                  : "Pré-visualização do estilo dos criativos. Clique em Aprovar Conteúdo para revisar todas as peças geradas."}
              </p>
            </div>
          )}

          {/* Quick stats from intake */}
          {Object.keys(intakeD).filter(k => !k.startsWith("_")).length > 0 && (
            <div className="border border-border/50 bg-card/40 p-4">
              <SectionHeader icon={FileText} label="Dados do Briefing (Intake)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ["Produto", intakeD["product.name"] as string],
                  ["Descrição", intakeD["product.description"] as string],
                  ["Categoria", intakeD["product.category"] as string],
                  ["Preço", intakeD["product.price"] ? `R$ ${intakeD["product.price"]}` : null],
                  ["Público", intakeD["audience.primaryPersona"] as string],
                  ["Formato", intakeD["product.deliveryMethod"] as string],
                  ["Tipo de campanha", intakeD["campaign.type"] as string],
                  ["Plataforma de vendas", intakeD["offer.salesPlatform"] as string],
                ].filter(([, v]) => !!v).map(([k, v]) => (
                  <div key={k as string} className="space-y-0.5">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{k}</div>
                    <div className="text-xs font-mono text-foreground">{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "ID", value: campaign.id.split("-")[0].toUpperCase() },
              { label: "Criado", value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—" },
              { label: "Atualizado", value: campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString("pt-BR") : "—" },
            ].map((item) => (
              <div key={item.label} className="border border-border/50 bg-card/30 px-4 py-3">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{item.label}</div>
                <div className="font-mono text-sm text-foreground mt-1 font-bold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ AGENTES TAB ══════════════ */}
      {activeTab === "agentes" && (
        <div className="space-y-4">

          {/* ─ Analyzing: cinematic agent activation ─ */}
          {campaign.status === "analyzing" && <AnalyzingDisplay />}

          {/* ─ Generating: live content generation progress ─ */}
          {campaign.status === "generating" && liveEvents.length === 0 && <GeneratingDisplay />}

          {/* ─ Executing / Live: mission ticker ─ */}
          {(campaign.status === "executing" || campaign.status === "live") && (
            <ExecutingLiveDisplay events={liveEvents} />
          )}

          {/* ─ Live feed (Socket.io) — for other active statuses or when events exist ─ */}
          {(isActive || liveEvents.length > 0) &&
           !["analyzing", "executing", "live"].includes(campaign.status) &&
           !(campaign.status === "generating" && liveEvents.length === 0) && (
            <div className="border border-primary/30 bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-pulse" />
              <div className="px-4 py-2.5 border-b border-primary/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 6px hsl(var(--primary))" }} />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Live Production Display</span>
                <span className="font-mono text-[11px] text-muted-foreground/50 ml-auto">Socket.io · Tempo Real</span>
              </div>
              <div ref={liveRef} className="h-48 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px]">
                {liveEvents.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground/50 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      <span>Agentes sendo inicializados... processando em background</span>
                    </div>
                    {[55, 72, 45].map((w, i) => (
                      <div key={i} className="flex items-center gap-2 opacity-30">
                        <span className="text-primary/40 shrink-0 w-3">·</span>
                        <div className="h-2 bg-primary/15 animate-pulse rounded-sm" style={{ width: `${w}%` }} />
                      </div>
                    ))}
                    <p className="text-[10px] font-mono text-muted-foreground/30 mt-2 pt-2 border-t border-border/20">
                      O processamento acontece em background. O status atualiza automaticamente quando concluído.
                    </p>
                  </div>
                ) : (
                  liveEvents.map((ev, i) => {
                    const color =
                      ev.type === "agent_started"      ? "text-primary" :
                      ev.type === "agent_thinking"     ? "text-cyan-400/80" :
                      ev.type === "agent_completed"    ? "text-success" :
                      ev.type === "agent_failed"       ? "text-destructive" :
                      ev.type === "checkpoint_created" ? "text-yellow-400" :
                      "text-muted-foreground/60";
                    const prefix =
                      ev.type === "agent_started"      ? "▶" :
                      ev.type === "agent_thinking"     ? "·" :
                      ev.type === "agent_completed"    ? "✓" :
                      ev.type === "agent_failed"       ? "✗" :
                      ev.type === "checkpoint_created" ? "!" : "·";
                    return (
                      <div key={i} className={`flex items-start gap-2 ${color}`}>
                        <span className="shrink-0 w-3">{prefix}</span>
                        <span className="text-muted-foreground/40 shrink-0 text-[11px] mt-0.5">
                          {new Date(ev.timestamp).toLocaleTimeString("pt-BR")}
                        </span>
                        {ev.agentType && (
                          <span className="shrink-0 uppercase tracking-wider text-[11px] font-bold opacity-80">
                            [{AGENT_ROLE_LABEL[ev.agentType] ?? ev.agentType}]
                          </span>
                        )}
                        <span className="leading-relaxed opacity-90">{ev.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─ Strategy ready: cinematic reveal banner ─ */}
          {campaign.status === "strategy_ready" && (
            <StrategyReadyBanner onReview={() => setActiveTab("estrategia")} />
          )}

          {/* ─ Creative Intent Panel — define visual direction before production ─ */}
          {campaign.status === "strategy_ready" && (
            <CreativeIntentPanel campaignId={campaignId} />
          )}

          {/* ─ Decision Trace Panel — Modo Arquiteto only ─ */}
          {isArquiteto && campaign.status !== "draft" && (
            <DecisionTracePanel campaignId={campaignId} />
          )}

          {/* ─ Strategy Approval Board — shown only when strategy is ready for approval ─ */}
          {campaign.status === "strategy_ready" && (
            <StrategyApprovalBoard
              strategyD={strategyD}
              audienceD={audienceD}
              targetingD={targetingD}
              timelineD={timelineD}
              intakeD={intakeD}
              onProceed={async (notes) => {
                const hasNotes = Object.values(notes).some(v => v?.trim());
                if (hasNotes) {
                  try {
                    await customFetch(`/api/campaigns/${campaignId}/directives`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ directives: notes }),
                    });
                  } catch {
                    // non-blocking — proceed anyway
                  }
                }
                executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } });
              }}
              proceedLoading={executeMutation.isPending}
            />
          )}

          {/* ─ Empty state (no data, no activity, no pending events) ─ */}
          {!isActive && liveEvents.length === 0 && Object.keys(strategyD).length === 0 && campaign.status !== "strategy_ready" && (
            <div className="py-16 text-center border border-border/30 bg-card/20">
              <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-widest mb-1">
                Nenhum agente executado ainda
              </p>
              <p className="font-mono text-xs text-muted-foreground/40">
                Clique em &ldquo;Iniciar Análise&rdquo; no tab Comando para acionar os agentes de IA
              </p>
            </div>
          )}

          {/* ─ Pending checkpoints ─ */}
          {(agentsData?.checkpoints ?? []).filter(c => c.status === "awaiting_review").map(cp => (
            <div key={cp.id} className="border border-yellow-400/30 bg-yellow-400/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-yellow-400 flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-3 w-3" />Aprovação Necessária
                </div>
                <div className="font-mono text-sm font-bold uppercase tracking-wide">{cp.type.replace(/_/g, " ")}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{new Date(cp.createdAt).toLocaleString("pt-BR")}</div>
              </div>
              <Button
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-4 text-xs"
                disabled={checkpointLoading === cp.id}
                onClick={() => handleCheckpointApprove(cp.id)}
              >
                {checkpointLoading === cp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Aprovar
              </Button>
            </div>
          ))}

          {/* ─ Campaign Mind Map — expandable phase/agent/content tree ─ */}
          {agentsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}</div>
          ) : (
            <CampaignMindMap
              campaign={campaign}
              agents={agentsData?.agents ?? []}
              checkpoints={agentsData?.checkpoints ?? []}
              pieces={contentData?.pieces ?? []}
              campaignId={campaignId}
            />
          )}

        </div>
      )}

      {/* ══════════════ PROPOSTA / ESTRATÉGIA TAB ══════════════ */}
      {activeTab === "estrategia" && (
        <CampaignBrief
          campaign={campaign as Parameters<typeof CampaignBrief>[0]["campaign"]}
          showApproveButton={campaign.status === "strategy_ready"}
          approveLoading={executeMutation.isPending}
          onApprove={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
        />
      )}

      {/* ══════════════ CONTEÚDO TAB ══════════════ */}
      {activeTab === "conteudo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader icon={Layers} label={`${contentData?.pieces?.length ?? 0} Peças de Conteúdo`} />
            {["strategy_ready", "approved"].includes(campaign.status) && (
              <Button
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
                onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })}
                disabled={executeMutation.isPending}
              >
                <Zap className="h-3 w-3" />Gerar Conteúdo
              </Button>
            )}
          </div>
          {contentLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 bg-muted/20" />)}</div>
          ) : (contentData?.pieces ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">Nenhuma peça de conteúdo gerada ainda.</p>
              {campaign.status === "strategy_ready" && (
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary" onClick={() => executeMutation.mutate({ campaignId, data: { phase: "content" as CampaignExecuteInputPhase } })} disabled={executeMutation.isPending}>
                  <Play className="h-4 w-4 fill-current" />Gerar Conteúdo Agora
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(contentData?.pieces ?? []).map(piece => (
                <div key={piece.id} className="border border-border/50 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-primary/40 text-primary">{piece.type}</Badge>
                    {piece.platform && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5">{piece.platform}</Badge>}
                    {piece.launchPhase && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-cyan-400/40 text-cyan-400">{piece.launchPhase}</Badge>}
                    {piece.mentalTrigger && <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-yellow-400/40 text-yellow-400">{piece.mentalTrigger}</Badge>}
                    <div className="ml-auto">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${piece.status === "approved" ? "border-success/40 text-success" : piece.status === "rejected" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}>
                        {piece.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap mb-3 line-clamp-4">{piece.content}</p>
                  {piece.status === "draft" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs bg-success/20 hover:bg-success/30 text-success border border-success/30 hover:border-success/50"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "approve")}>
                        {contentActionLoading === piece.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Aprovar
                      </Button>
                      <Button size="sm" variant="outline"
                        className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "reject")}>
                        <XCircle className="h-3 w-3" />Rejeitar
                      </Button>
                      <Button size="sm" variant="ghost" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />Ver Completo
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MÉTRICAS TAB ══════════════ */}
      {activeTab === "metricas" && (
        <div className="space-y-4">
          {metricsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : !metricsData ? (
            <div className="py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhuma métrica registrada ainda.</p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-2">Métricas são ingeridas automaticamente durante a fase de execução ou via POST /api/campaigns/:id/metrics</p>
            </div>
          ) : (
            <>
              {/* Health score */}
              <div className="border border-border/50 bg-card/40 p-5">
                <SectionHeader icon={Activity} label="Health Score da Campanha" />
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="text-center">
                    <div className={`text-5xl font-mono font-bold ${metricsData.healthScore >= 70 ? "text-success" : metricsData.healthScore >= 40 ? "text-yellow-400" : "text-destructive"}`}>
                      {metricsData.healthScore}
                    </div>
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">/ 100 pts</div>
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] mt-2 px-3 py-0.5">Grade {metricsData.grade}</Badge>
                  </div>
                  <div className="flex-1">
                    <Progress value={metricsData.healthScore} className="h-2 rounded-none bg-muted/30 [&>div]:transition-all" />
                    <p className="text-xs font-mono text-muted-foreground mt-3 leading-relaxed">{metricsData.summary}</p>
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Receita Total" value={metricsData.totalRevenueBrl ? `R$ ${Number(metricsData.totalRevenueBrl).toLocaleString("pt-BR")}` : "—"} icon={DollarSign} color="success" />
                <KpiCard label="ROAS Médio" value={metricsData.avgRoas ? `${Number(metricsData.avgRoas).toFixed(1)}x` : "—"} icon={TrendingUp} color="primary" />
                <KpiCard label="CPL Médio" value={metricsData.avgCplBrl ? `R$ ${Number(metricsData.avgCplBrl).toFixed(2)}` : "—"} icon={Target} color="cyan" />
                <KpiCard label="Total Vendas" value={metricsData.totalSales?.toString() ?? "—"} icon={Activity} color="yellow" />
              </div>

              {/* Alerts */}
              {(alertsData?.alerts ?? []).length > 0 && (
                <div className="border border-border/50 bg-card/40 p-4 space-y-3">
                  <SectionHeader icon={AlertTriangle} label={`${alertsData!.alerts.length} Alertas Ativos`} />
                  {alertsData!.alerts.map(alert => (
                    <div key={alert.id} className={`border p-3 ${alert.severity === "critical" ? "border-destructive/40 bg-destructive/5" : "border-yellow-400/30 bg-yellow-400/5"}`}>
                      <div className="font-mono text-xs font-bold mb-1">{alert.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">{alert.description}</div>
                      {alert.recommendation && <div className="text-xs text-primary font-mono mt-1">→ {alert.recommendation}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {(metricsData.history ?? []).length > 0 && (
                <div className="border border-border/50 bg-card/40 p-4">
                  <SectionHeader icon={TrendingUp} label="Histórico Diário" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground uppercase tracking-widest">
                          <th className="text-left py-2 pr-4">Dia</th>
                          <th className="text-right py-2 pr-4">Receita</th>
                          <th className="text-right py-2 pr-4">ROAS</th>
                          <th className="text-right py-2 pr-4">CPL</th>
                          <th className="text-right py-2">Health</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricsData.history!.map(row => (
                          <tr key={row.dayIndex} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="py-2 pr-4">D{row.dayIndex}</td>
                            <td className="py-2 pr-4 text-right text-success">R$ {Number(row.revenueBrl).toLocaleString("pt-BR")}</td>
                            <td className="py-2 pr-4 text-right">{Number(row.roas).toFixed(1)}x</td>
                            <td className="py-2 pr-4 text-right">R$ {Number(row.cplBrl).toFixed(2)}</td>
                            <td className={`py-2 text-right font-bold ${row.healthScore >= 70 ? "text-success" : row.healthScore >= 40 ? "text-yellow-400" : "text-destructive"}`}>{row.healthScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
