import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import {
  useGetCampaign,
  useExecuteCampaign,
  CampaignExecuteInputPhase,
  getGetCampaignQueryKey,
  getGetAutonomyStatusQueryKey,
  useGetAutonomyStatus,
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
  RefreshCw, Rocket, Brain, Video, CheckCheck, Wifi, Image, Database,
} from "lucide-react";
import { LaunchSequenceOverlay, LaunchRocketButton } from "@/components/launch-sequence";
import { StrategyMasterplan, parseStrategyInsights } from "./strategy-masterplan";
import {
  AnalyzingDisplay,
  GeneratingDisplay,
  ContentReadyCinemaPrompt,
  ExecutingLiveDisplay,
  LiveMissionControl,
} from "@/components/campaign-stage-experience";
import { CampaignBrief } from "@/components/campaign-brief";
import { CampaignNorthStar } from "@/components/CampaignNorthStar";
import { SocialPostPreview } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";
import {
  ConnectModal, INTEGRATION_CATALOG,
  type CatalogEntry, type Provider,
} from "@/components/integration-connect-modal";
import { DecisionTracePanel } from "@/components/DecisionTracePanel";
import { AgentClarificationPanel } from "@/components/AgentClarificationPanel";
import { CampaignMindMap } from "@/components/CampaignMindMap";
import { GroupsTab } from "@/components/GroupsTab";
import { AgentLiveFeed } from "@/components/AgentLiveFeed";
import { useMode } from "@/lib/mode";
import { useAuth } from "@/lib/auth";
import { useUiText } from "@/lib/i18n";
import { CreativeStudioBlock } from "@/components/CreativeStudioBlock";
import { PreLaunchChecklist } from "@/components/PreLaunchChecklist";
import { LaunchAuditScanner } from "@/components/LaunchAuditScanner";
import { CampaignCreativeGallery } from "@/components/CampaignCreativeGallery";
import { ComplianceReviewModal } from "@/components/ComplianceReviewModal";
import { MarketValidationReview } from "@/components/MarketValidationReview";
import { AutonomyAcceptanceModal } from "@/components/AutonomyAcceptanceModal";

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
const localizedStatusLabel = (t: ReturnType<typeof useUiText>, status: string) => {
  const labels: Record<string, [string, string, string]> = {
    draft: ["Aguardando Briefing", "Awaiting Brief", "Esperando el briefing"],
    intake: ["Coletando Inteligência", "Gathering Intelligence", "Recopilando inteligencia"],
    analyzing: ["Time em Operação", "Team in Action", "Equipo en acción"],
    strategy_ready: ["Estratégia Aprovada", "Strategy Approved", "Estrategia aprobada"],
    generating: ["Produção em Andamento", "Production in Progress", "Producción en curso"],
    compliance_review: ["Revisão de Compliance", "Compliance Review", "Revisión de cumplimiento"],
    awaiting_approval: ["Aguardando Sua Revisão", "Awaiting Your Review", "Esperando tu revisión"],
    approved: ["Aprovado — Pronto para Lançar", "Approved — Ready to Launch", "Aprobado — listo para lanzar"],
    executing: ["Operação Iniciada", "Operation Started", "Operación iniciada"],
    live: ["Campanha Ao Vivo", "Campaign Live", "Campaña en vivo"],
    completed: ["Ciclo Concluído", "Cycle Completed", "Ciclo completado"],
  };
  const copy = labels[status];
  return copy ? t(...copy) : status;
};
const STATUS_COLOR: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  analyzing: "text-primary border-primary/40 bg-primary/10",
  compliance_review: "text-red-400 border-red-400/40 bg-red-400/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed: "text-muted-foreground border-border bg-muted/20",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-blue-400 border-blue-400/40 bg-blue-400/10",
};
const AGENT_ROLE_LABEL: Record<string, [string, string, string]> = {
  command: ["Comandante de Operação", "Operations Commander", "Comandante de operaciones"],
  strategy: ["Estrategista Sênior", "Senior Strategist", "Estratega sénior"],
  launch_manager: ["Gerente de Lançamento", "Launch Manager", "Gerente de lanzamiento"],
  offer: ["Arquiteto de Oferta", "Offer Architect", "Arquitecto de ofertas"],
  product_builder: ["Especialista em Produto", "Product Specialist", "Especialista en producto"],
  copywriter: ["Time de Posicionamento e Copy", "Positioning and Copy Team", "Equipo de posicionamiento y textos"],
  creative_director: ["Diretor Criativo", "Creative Director", "Director creativo"],
  creative: ["Diretor Criativo", "Creative Director", "Director creativo"],
  landing_page: ["Especialista em Página de Vendas", "Sales Page Specialist", "Especialista en páginas de ventas"],
  targeting: ["Especialista em Audiências", "Audience Specialist", "Especialista en audiencias"],
  media_buyer: ["Especialista em Mídia Paga", "Paid Media Specialist", "Especialista en medios pagados"],
  affiliate_campaign: ["Especialista em Afiliados", "Affiliate Specialist", "Especialista en afiliados"],
  analytics: ["Analista de Performance", "Performance Analyst", "Analista de rendimiento"],
  optimization: ["Especialista em Otimização", "Optimization Specialist", "Especialista en optimización"],
  video: ["Especialista em Estratégia de Vídeo", "Video Strategy Specialist", "Especialista en estrategia de video"],
  video_strategy: ["Especialista em Estratégia de Vídeo", "Video Strategy Specialist", "Especialista en estrategia de video"],
  creator_growth: ["Especialista em Crescimento Orgânico", "Organic Growth Specialist", "Especialista en crecimiento orgánico"],
  compliance: ["Compliance Officer", "Compliance Officer", "Responsable de cumplimiento"],
  profile_builder: ["Especialista em Mapeamento de Avatar", "Audience Persona Mapping Specialist", "Especialista en mapeo de avatares"],
  intake: ["Time de Inteligência — Briefing", "Intelligence Team — Brief", "Equipo de inteligencia — briefing"],
  ad_copy: ["Especialista em Copy de Anúncios", "Ad Copy Specialist", "Especialista en textos publicitarios"],
  cpl_script: ["Roteirista de CPL", "CPL Scriptwriter", "Guionista de CPL"],
  vsl_script: ["Roteirista de VSL", "VSL Scriptwriter", "Guionista de VSL"],
  webinar_script: ["Roteirista de Webinar", "Webinar Scriptwriter", "Guionista de webinars"],
  live_script: ["Roteirista de Live de Vendas", "Sales Livestream Scriptwriter", "Guionista de transmisiones de ventas"],
  stories_sequence: ["Especialista em Sequência de Stories", "Stories Sequence Specialist", "Especialista en secuencias de Stories"],
  media_brief: ["Especialista em Brief de Mídia", "Media Brief Specialist", "Especialista en briefing de medios"],
  financial_projector: ["Projetor Financeiro", "Financial Forecaster", "Proyecciones financieras"],
  launch_sequence_builder: ["Arquiteto de Sequências de Lançamento", "Launch Sequence Architect", "Arquitecto de secuencias de lanzamiento"],
  social_media: ["Especialista em Social Media", "Social Media Specialist", "Especialista en redes sociales"],
  whatsapp_response: ["Especialista em Atendimento WhatsApp", "WhatsApp Support Specialist", "Especialista en atención por WhatsApp"],
  perpetual_launch_manager: ["Gestor de Lançamento Perpétuo", "Evergreen Launch Manager", "Gestor de lanzamientos evergreen"],
  continuous_sales_manager: ["Gestor de Vendas Contínuas", "Continuous Sales Manager", "Gestor de ventas continuas"],
  item_copy: ["Copywriter de Sequência", "Sequence Copywriter", "Redactor de secuencias"],
  domino: ["DOMINO — Revisor Filosófico", "DOMINO — Philosophical Reviewer", "DOMINO — Revisor filosófico"],
  hook_factory: ["Especialista em Hooks", "Hook Specialist", "Especialista en ganchos"],
  objection_killer: ["Especialista em Destruição de Objeções", "Objection Handling Specialist", "Especialista en manejo de objeciones"],
  scarcity_engineer: ["Engenheiro de Escassez", "Scarcity Engineer", "Especialista en escasez"],
  email_architect: ["Arquiteto de Email Marketing", "Email Marketing Architect", "Arquitecto de email marketing"],
  pricing_psychologist: ["Psicólogo de Precificação", "Pricing Psychologist", "Psicólogo de precios"],
  ad_critic: ["Crítico de Criativos", "Creative Critic", "Crítico de creatividades"],
  reengagement: ["Especialista em Reengajamento", "Re-engagement Specialist", "Especialista en reactivación"],
  upsell_architect: ["Arquiteto de Upsell", "Upsell Architect", "Arquitecto de ventas adicionales"],
  crisis_response: ["Especialista em Gestão de Crise", "Crisis Management Specialist", "Especialista en gestión de crisis"],
  execution_governor: ["Governança de Execução", "Execution Governance", "Gobernanza de ejecución"],
  business_intelligence: ["Inteligência de Negócios", "Business Intelligence", "Inteligencia de negocio"],
  sales_warmer: ["Especialista em Aquecimento", "Lead Nurturing Specialist", "Especialista en nutrición de prospectos"],
  sales_desire: ["Especialista em Geração de Desejo", "Desire Generation Specialist", "Especialista en generación de deseo"],
  sales_closer: ["Especialista em Fechamento", "Sales Closing Specialist", "Especialista en cierre de ventas"],
  sales_objection: ["Especialista em Objeções de Venda", "Sales Objections Specialist", "Especialista en objeciones de venta"],
  sales_consultant: ["Consultor de Vendas", "Sales Consultant", "Consultor de ventas"],
  identity_architect: ["Arquiteto de Identidade", "Identity Architect", "Arquitecto de identidad"],
  mental_frequency_coach: ["Coach de Frequência Mental", "Mental Frequency Coach", "Coach de frecuencia mental"],
};
const ACTIVE_STATUSES = ["analyzing", "generating", "executing"];
const PIPELINE = [
  { id: "intake", statuses: ["draft", "intake"] },
  { id: "strategy", statuses: ["analyzing", "strategy_ready"] },
  { id: "content", statuses: ["generating", "compliance_review", "awaiting_approval", "approved"] },
  { id: "launch", statuses: ["executing", "live"] },
  { id: "monitor", statuses: ["completed"] },
];

function getPipelineState(status: string, stepStatuses: string[]): "done" | "active" | "pending" {
  // RC-005 FIX: "paused" and "cancelled" are not in the PIPELINE statuses array.
  // order.indexOf() returns -1 for these → cur = -1 → all steps appear "pending".
  // Map "paused" to "live" (mid-launch, same pipeline position) so 04·LANÇAMENTO
  // shows as active. "cancelled" maps to "" so all steps remain pending (unknown
  // cancellation point — safest neutral display).
  const statusAlias: Record<string, string> = { paused: "live" };
  const effectiveStatus = statusAlias[status] ?? status;

  const order = PIPELINE.map((s) => s.statuses).flat();
  const cur = order.indexOf(effectiveStatus);
  if (cur === -1) return "pending"; // cancelled or unknown status — no active step

  const indices = stepStatuses.map((s) => order.indexOf(s)).filter((i) => i !== -1);
  if (indices.length === 0) return "pending";
  const first = Math.min(...indices);
  const last = Math.max(...indices);
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

function camelToLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function PlanText({ value }: { value: unknown }) {
  if (!value) return null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    return <p className="font-mono text-xs text-foreground/80 leading-relaxed">{value}</p>;
  }
  if (Array.isArray(value)) {
    const items = (value as unknown[]).filter(item => !isEmptyValue(item));
    if (items.length === 0) return null;
    return (
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="font-mono text-xs text-foreground/80 flex items-start gap-2 leading-relaxed">
            <span className="text-primary/50 shrink-0 mt-0.5">·</span>
            <span>{typeof item === "string" ? item : typeof item === "object" && item !== null ? Object.values(item as Record<string, unknown>).filter(v => typeof v === "string").join(" — ") : String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).filter(([, v]) => !isEmptyValue(v));
    if (entries.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider">{camelToLabel(k)}: </span>
            <span className="font-mono text-xs text-foreground/80">
              {typeof v === "string"
                ? v
                : Array.isArray(v)
                  ? (v as unknown[]).filter(x => !isEmptyValue(x)).join(", ")
                  : typeof v === "number" || typeof v === "boolean"
                    ? String(v)
                    : JSON.stringify(v)}
            </span>
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
  const t = useUiText();
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
          {t("Outputs dos Agentes — Plano de Ação", "Agent Outputs — Action Plan", "Resultados de los agentes — Plan de acción")}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/50">
          {expanded ? `▲ ${t("recolher", "collapse", "contraer")}` : `▼ ${t("expandir", "expand", "expandir")}`}
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">

          {/* Strategy summary */}
          {!!strategyD.executiveSummary && (
            <PlanBlock label={t("Diagnóstico Executivo — Estrategista", "Executive Diagnosis — Strategist", "Diagnóstico ejecutivo — Estratega")}>
              <PlanText value={strategyD.executiveSummary} />
            </PlanBlock>
          )}

          {/* Market diagnosis */}
          {!!strategyD.marketDiagnosis && (
            <PlanBlock label={t("Diagnóstico de Mercado — Estrategista", "Market Diagnosis — Strategist", "Diagnóstico de mercado — Estratega")}>
              <PlanText value={strategyD.marketDiagnosis} />
            </PlanBlock>
          )}

          {/* Offer positioning */}
          {!!(strategyD.offerPositioning ?? offerD.positioning ?? offerD.uvp) && (
            <PlanBlock label={t("Posicionamento da Oferta — Especialista em Oferta", "Offer Positioning — Offer Specialist", "Posicionamiento de la oferta — Especialista en ofertas")}>
              <PlanText value={strategyD.offerPositioning ?? offerD} />
            </PlanBlock>
          )}

          {/* Audience segmentation */}
          {!!(strategyD.audienceSegmentation ?? audienceD.avatars ?? audienceD.segments) && (
            <PlanBlock label={t("Segmentação de Audiência — Profile Builder", "Audience Segmentation — Profile Builder", "Segmentación de audiencia — Profile Builder")}>
              <PlanText value={strategyD.audienceSegmentation ?? audienceD} />
            </PlanBlock>
          )}

          {/* Campaign architecture */}
          {!!strategyD.campaignArchitecture && (
            <PlanBlock label={t("Arquitetura da Campanha — Estrategista", "Campaign Architecture — Strategist", "Arquitectura de campaña — Estratega")}>
              <PlanText value={strategyD.campaignArchitecture} />
            </PlanBlock>
          )}

          {/* Trigger map */}
          {!!strategyD.triggerMap && (
            <PlanBlock label={t("Mapa de Gatilhos Mentais — Estrategista", "Mental Triggers Map — Strategist", "Mapa de disparadores mentales — Estratega")}>
              <PlanText value={strategyD.triggerMap} />
            </PlanBlock>
          )}

          {/* Success metrics */}
          {!!strategyD.successMetrics && (
            <PlanBlock label={t("Metas & KPIs Projetados — Estrategista", "Projected Goals & KPIs — Strategist", "Objetivos y KPI proyectados — Estratega")}>
              <PlanText value={strategyD.successMetrics} />
            </PlanBlock>
          )}

          {/* Targeting data */}
          {Object.keys(targetingD).length > 0 && (
            <PlanBlock label={t("Targeting & Mídia Paga — Media Buyer", "Targeting & Paid Media — Media Buyer", "Segmentación y medios pagados — Media Buyer")}>
              <PlanText value={targetingD} />
            </PlanBlock>
          )}

          {/* Timeline */}
          {Object.keys(timelineD).length > 0 && (
            <PlanBlock label={t("Cronograma do Lançamento — Gerente de Lançamento", "Launch Schedule — Launch Manager", "Cronograma del lanzamiento — Gerente de lanzamiento")}>
              <PlanText value={timelineD} />
            </PlanBlock>
          )}

          {/* Approved checkpoints */}
          {approvedCps.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-success/70 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />{t("Checkpoints Aprovados", "Approved Checkpoints", "Puntos de control aprobados")} ({approvedCps.length})
              </div>
              {approvedCps.map(cp => (
                <PlanBlock key={cp.id} label={cp.type.replace(/_/g, " ")}>
                  <div className="text-[11px] font-mono text-muted-foreground/50 mb-2">
                    {t("Aprovado em", "Approved on", "Aprobado el")} {new Date(cp.createdAt).toLocaleString("pt-BR")}
                  </div>
                  {cp.data && Object.keys(cp.data).length > 0 && <PlanText value={cp.data} />}
                </PlanBlock>
              ))}
            </div>
          )}

          {!hasPlan && approvedCps.length === 0 && (
            <div className="py-6 text-center font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
              {t("Nenhum output registrado ainda. Execute uma fase do agente para ver os resultados aqui.", "No output recorded yet. Run an agent phase to see results here.", "Todavía no hay resultados registrados. Ejecuta una fase del agente para verlos aquí.")}
            </div>
          )}

          <button
            onClick={onGoToStrategy}
            className="w-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary flex items-center justify-center gap-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("Ver Proposta Estratégica Completa", "View Full Strategy Proposal", "Ver propuesta estratégica completa")}
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

function buildPlatformBriefs(
  strategyD: Record<string, unknown>,
  targetingD: Record<string, unknown>,
  intakeD: Record<string, unknown>,
  t: ReturnType<typeof useUiText>,
): PlatformBrief[] {
  const insights = parseStrategyInsights(strategyD);
  const product = (intakeD["product.name"] as string) || t("Produto", "Product", "Producto");
  const persona = (intakeD["audience.primaryPersona"] as string) || t("empreendedores digitais", "digital entrepreneurs", "emprendedores digitales");
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
      trigger: String(triggerMap["instagram"] ?? triggerMap["authority"] ?? t("Autoridade", "Authority", "Autoridad")),
      angle: t(`Conteúdo de valor orgânico para ${p2}`, `Organic value content for ${p2}`, `Contenido orgánico de valor para ${p2}`),
      headline: t(`Como ${product} transforma resultados de ${p2}`, `How ${product} transforms results for ${p2}`, `Cómo ${product} transforma los resultados de ${p2}`),
      hook: t(`A maioria de ${p1} não sabe disso ainda...`, `Most ${p1} don't know this yet...`, `La mayoría de ${p1} aún no sabe esto...`),
      caption: t(`📈 Você está deixando resultados na mesa.\n\nO método que mudou tudo para centenas de ${p1}.\n\nSalva e comenta! 👇`, `📈 You're leaving results on the table.\n\nThe method that changed everything for hundreds of ${p1}.\n\nSave and comment! 👇`, `📈 Estás dejando resultados sobre la mesa.\n\nEl método que lo cambió todo para cientos de ${p1}.\n\n¡Guarda y comenta! 👇`),
      cta: t("Link na bio", "Link in bio", "Enlace en la bio"),
      actions: [
        t("3 Reels de valor/semana (Seg·Qua·Sex)", "3 value-focused Reels/week (Mon·Wed·Fri)", "3 Reels de valor por semana (lun·mié·vie)"),
        t("1 Story diário com CTA para lista VIP", "1 daily Story with a CTA to the VIP list", "1 Story diario con CTA a la lista VIP"),
        t("Carrossel educativo a cada 5 dias", "Educational carousel every 5 days", "Carrusel educativo cada 5 días"),
      ],
    },
    {
      platform: "tiktok",
      format: t("Vídeo 30–60s + Lives", "30–60s video + livestreams", "Video de 30–60 s + transmisiones en vivo"),
      trigger: String(triggerMap["tiktok"] ?? triggerMap["curiosity"] ?? t("Curiosidade", "Curiosity", "Curiosidad")),
      angle: t(`Hook viral + revelação rápida para ${p2}`, `Viral hook + quick reveal for ${p2}`, `Gancho viral + revelación rápida para ${p2}`),
      headline: t(`O erro que 90% de ${p1} cometem`, `The mistake 90% of ${p1} make`, `El error que comete el 90 % de ${p1}`),
      hook: t("POV: você descobre o que sabotava seus resultados o tempo todo", "POV: you discover what was sabotaging your results all along", "POV: descubres qué estaba saboteando tus resultados todo este tiempo"),
      caption: `#${t("empreendedorismo", "entrepreneurship", "emprendimiento")} #${t("resultados", "results", "resultados")} #${product.replace(/\s+/g, "").slice(0, 15).toLowerCase()}`,
      cta: t("Link na bio", "Link in bio", "Enlace en la bio"),
      actions: [
        t("1 vídeo de hook/dia nos 7 dias de aquecimento", "1 hook video/day during the 7 warm-up days", "1 video con gancho al día durante los 7 días de calentamiento"),
        t("Lives 30min nos dias D-3 e D-1", "30-minute livestreams on D-3 and D-1", "Transmisiones en vivo de 30 min en D-3 y D-1"),
        t("Dueto/resposta em comentários estratégicos", "Duets/replies to strategic comments", "Dúos/respuestas a comentarios estratégicos"),
      ],
    },
    {
      platform: "facebook",
      format: t("Anúncio Video + Carrossel", "Video Ad + Carousel", "Anuncio en video + carrusel"),
      trigger: String(triggerMap["facebook"] ?? triggerMap["fear_of_loss"] ?? t("Medo da Perda", "Fear of Loss", "Miedo a perder")),
      angle: t("Tráfego pago segmentado — interesses + lookalike", "Targeted paid traffic — interests + lookalike audience", "Tráfico pagado segmentado — intereses + público similar"),
      headline: t(`Pare de perder clientes para quem já usa ${product}`, `Stop losing customers to people already using ${product}`, `Deja de perder clientes frente a quienes ya usan ${product}`),
      caption: t(`Enquanto você lê isso, seus concorrentes estão usando ${product} para fechar mais. Quando vai ser a sua vez?`, `As you read this, your competitors are using ${product} to close more sales. When will it be your turn?`, `Mientras lees esto, tus competidores usan ${product} para cerrar más ventas. ¿Cuándo será tu turno?`),
      cta: t("Saiba Mais", "Learn More", "Más información"),
      actions: [
        t("Lookalike 1% de compradores", "1% lookalike of buyers", "Público similar al 1 % de compradores"),
        t(`Interesse: ${p1}`, `Interest: ${p1}`, `Interés: ${p1}`),
        t("Retargeting D-3 com oferta especial", "D-3 retargeting with a special offer", "Retargeting D-3 con oferta especial"),
      ],
    },
    {
      platform: "whatsapp",
      format: t("Lista VIP — Broadcast 7 dias", "VIP List — 7-day broadcast", "Lista VIP — difusión de 7 días"),
      trigger: String(triggerMap["whatsapp"] ?? triggerMap["community"] ?? t("Exclusividade", "Exclusivity", "Exclusividad")),
      angle: t("Sequência de aquecimento pré-abertura do carrinho", "Pre-launch warm-up sequence before cart opening", "Secuencia de calentamiento antes de abrir el carrito"),
      headline: t("[Lista VIP] Acesso antecipado — só para quem está aqui", "[VIP List] Early access — only for those here", "[Lista VIP] Acceso anticipado — solo para quienes están aquí"),
      caption: t(`Estou preparando algo que vai mudar completamente como você trabalha com ${product}...`, `I'm preparing something that will completely change how you work with ${product}...`, `Estoy preparando algo que cambiará por completo la forma en que trabajas con ${product}...`),
      cta: t("Responda QUERO para saber mais", "Reply YES to learn more", "Responde SÍ para saber más"),
      actions: [
        t("D-7: Teaser exclusivo + primeiro contato", "D-7: Exclusive teaser + first contact", "D-7: Avance exclusivo + primer contacto"),
        t("D-3: Revelação parcial + prova social", "D-3: Partial reveal + social proof", "D-3: Revelación parcial + prueba social"),
        t("D-1: Abertura 24h antes do público geral", "D-1: Open 24 hours before the general public", "D-1: Apertura 24 horas antes que al público general"),
      ],
    },
    {
      platform: "email",
      format: t("Sequência de 7 e-mails", "7-email sequence", "Secuencia de 7 correos"),
      trigger: String(triggerMap["email"] ?? triggerMap["reciprocity"] ?? t("Reciprocidade", "Reciprocity", "Reciprocidad")),
      angle: t(`Nurturing + conversão via e-mail para ${p2}`, `Nurturing + email conversion for ${p2}`, `Nutrición + conversión por correo para ${p2}`),
      headline: t(`[Exclusivo] O que ninguém te conta sobre ${product}`, `[Exclusive] What no one tells you about ${product}`, `[Exclusivo] Lo que nadie te cuenta sobre ${product}`),
      caption: t("Tenho uma novidade que vai mudar sua visão sobre como chegar aos seus resultados mais rápido...", "I have news that will change how you think about reaching your goals faster...", "Tengo una novedad que cambiará tu perspectiva sobre cómo alcanzar tus objetivos más rápido..."),
      cta: t("Quero saber mais", "I want to know more", "Quiero saber más"),
      actions: [
        t("E-mail 1: Entrega de conteúdo de alto valor (gratuito)", "Email 1: Deliver high-value content (free)", "Correo 1: Entrega de contenido de gran valor (gratis)"),
        t("E-mails 2–5: Prova social + queima de objeções", "Emails 2–5: Social proof + objection handling", "Correos 2–5: Prueba social + resolución de objeciones"),
        t("E-mails 6–7: Urgência + escassez + CTA direto", "Emails 6–7: Urgency + scarcity + direct CTA", "Correos 6–7: Urgencia + escasez + CTA directo"),
      ],
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
  const t = useUiText();
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
              <div className="text-[8px] font-mono font-bold text-white/70">{t("Patrocinado", "Sponsored", "Patrocinado")}</div>
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
                <div className="text-[8px] font-mono font-bold text-white/70">{(brief.headline ?? t("Saiba Mais", "Learn More", "Más información")).slice(0, 28)}</div>
                <div className="text-[7px] font-mono text-white/30">patrocinado.com</div>
              </div>
              <div className="bg-blue-600 px-1.5 py-0.5 text-[7px] font-mono font-bold text-white">{t("Saiba mais", "Learn more", "Más información")}</div>
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
              {[
                t("D-7 · Teaser", "D-7 · Teaser", "D-7 · Avance"),
                t("D-3 · Revelação", "D-3 · Reveal", "D-3 · Revelación"),
                t("D-1 · Abertura", "D-1 · Opening", "D-1 · Apertura"),
              ].map((d, i) => (
                <div key={i} className="flex justify-end">
                  <div className="bg-[#005C4B] rounded-lg rounded-tr-none px-2 py-1 max-w-[90%]">
                    <div className="text-[7px] font-mono text-green-300/50 mb-0.5">{d}</div>
                    <p className="text-[8px] font-mono text-[#E9EDEF] leading-snug">
                      {i === 0 ? t("Algo especial está chegando... 🔥", "Something special is coming... 🔥", "Algo especial está por llegar... 🔥") :
                       i === 1 ? (brief.headline ?? t("Novidade exclusiva!", "Exclusive news!", "¡Novedad exclusiva!")).slice(0, 30) :
                       (brief.cta ?? t("Garante sua vaga agora", "Secure your spot now", "Asegura tu lugar ahora"))}
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
                📧 {(brief.headline ?? t("Assunto do e-mail", "Email subject", "Asunto del correo")).slice(0, 35)}
              </div>
              <div className="text-[7px] font-mono text-muted-foreground/30 mt-0.5">De: voce@dominio.com · Para: lista-vip@...</div>
            </div>
            <div className="px-2 py-1.5 space-y-1">
              <div className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 text-[8px] font-mono font-bold text-indigo-300 text-center">
                {(brief.headline ?? t("Chamada Principal", "Main Headline", "Llamada principal")).slice(0, 38)}
              </div>
              <p className="text-[8px] font-mono text-foreground/40 leading-snug line-clamp-2">
                {(brief.caption ?? brief.angle).slice(0, 80)}
              </p>
              <div className="bg-indigo-600/20 border border-indigo-600/30 px-2 py-0.5 text-[8px] font-mono text-indigo-300 text-center">
                {brief.cta ?? t("Clique aqui", "Click here", "Haz clic aquí")}
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
            <CheckCircle2 className="h-2.5 w-2.5" />{t("Aprovar", "Approve", "Aprobar")}
          </button>
          <button onClick={onRevise}
            className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:bg-muted/20 transition-colors flex items-center justify-center gap-1">
            <XCircle className="h-2.5 w-2.5" />{t("Revisar", "Review", "Revisar")}
          </button>
        </div>
      )}
      {state === "approved" && (
        <button onClick={onRevise}
          className="border-t border-success/20 py-2 w-full font-mono text-[10px] uppercase tracking-widest text-success flex items-center justify-center gap-1 hover:bg-success/5 transition-colors">
          <CheckCircle2 className="h-2.5 w-2.5" />{t("Aprovado · Desfazer", "Approved · Undo", "Aprobado · Deshacer")}
        </button>
      )}
    </div>
  );
}

function AgentRunLog({ agents }: { agents: AgentRun[] }) {
  const t = useUiText();
  const localizedAgentStatus = (status: string) => {
    const labels: Record<string, [string, string, string]> = {
      completed: ["Concluído", "Completed", "Completado"],
      running: ["Em execução", "Running", "En ejecución"],
      pending: ["Pendente", "Pending", "Pendiente"],
      failed: ["Falhou", "Failed", "Fallido"],
      draft: ["Rascunho", "Draft", "Borrador"],
      approved: ["Aprovado", "Approved", "Aprobado"],
      rejected: ["Rejeitado", "Rejected", "Rechazado"],
      awaiting_review: ["Aguardando revisão", "Awaiting review", "Pendiente de revisión"],
    };
    return labels[status] ? t(...labels[status]) : status;
  };
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 bg-card/20">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-muted/20 transition-colors">
        <Bot className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 flex-1 text-left">
          {t("Log de Execução", "Execution Log", "Registro de ejecución")} — {agents.length} {t("agente", "agent", "agente")}{agents.length !== 1 ? (t("s", "s", "s")) : ""}
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
                  {(() => {
                    const role = (agent as unknown as Record<string,string>)["agentType"] ?? agent.agentRole;
                    return AGENT_ROLE_LABEL[role] ? t(...AGENT_ROLE_LABEL[role]) : role;
                  })()}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/40">
                  {new Date(agent.startedAt).toLocaleTimeString("pt-BR")}
                  {agent.completedAt && ` → ${new Date(agent.completedAt).toLocaleTimeString("pt-BR")}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {agent.tokensUsed && <span className="text-[10px] font-mono text-muted-foreground/40">{agent.tokensUsed.toLocaleString("pt-BR")} tok</span>}
                <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 ${agent.status === "completed" ? "border-success/30 text-success" : agent.status === "failed" ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}`}>
                  {localizedAgentStatus(agent.status)}
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
  const t = useUiText();
  const briefs = useMemo(
    () => buildPlatformBriefs(strategyD, targetingD, intakeD, t),
    [strategyD, targetingD, intakeD, t],
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
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-success">{t("Análise Estratégica Completa", "Complete Strategic Analysis", "Análisis estratégico completo")}</div>
            <div className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
              {t("Revise e aprove cada seção. Quando tudo ok, o agente gera o conteúdo completo.", "Review and approve each section. Once everything is ready, the agent will generate all content.", "Revisa y aprueba cada sección. Cuando todo esté listo, el agente generará el contenido completo.")}
            </div>
          </div>
        </div>
        <button onClick={approveAll} disabled={proceedLoading || localLoading}
          className="font-mono text-[11px] uppercase tracking-widest text-success border border-success/40 hover:bg-success/10 px-3 py-1.5 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50">
          {(proceedLoading || localLoading) ? <><Loader2 className="h-3 w-3 animate-spin" />{t("Gerando...", "Generating...", "Generando...")}</> : <><Zap className="h-3 w-3" />{t("Aprovar Tudo e Gerar", "Approve All and Generate", "Aprobar todo y generar")}</>}
        </button>
      </div>

      {/* ── Intelligence Panel — Big Domino + AI Thesis (informational) ── */}
      {(bigDomino || execSummaryText || competitive) && (
        <div className="border border-primary/25 bg-primary/3 overflow-hidden">
          <div className="px-4 py-3 border-b border-primary/20">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <Activity className="h-3 w-3" />{t("Inteligência Estratégica — Análise Real do agente", "Strategic Intelligence — Real Agent Analysis", "Inteligencia estratégica — Análisis real del agente")}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{t("Diagnóstico executivo gerado pelos agentes. Informativo — não requer aprovação.", "Executive diagnosis generated by agents. Informational — no approval required.", "Diagnóstico ejecutivo generado por los agentes. Informativo — no requiere aprobación.")}</div>
          </div>
          <div className="p-4 space-y-3">
            {bigDomino && (
              <div className="border border-yellow-400/30 bg-yellow-400/5 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80 mb-1.5 font-bold flex items-center gap-1.5">
                  <Target className="h-3 w-3" />{t("Big Domino — Crença Principal a Plantar", "Big Domino — Core Belief to Establish", "Big Domino — Creencia principal que se debe establecer")}
                </div>
                <p className="font-mono text-xs text-foreground/85 leading-relaxed">{bigDomino}</p>
              </div>
            )}
            {execSummaryText && (
              <div className="border border-border/30 bg-card/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-bold">{t("Diagnóstico Executivo", "Executive Diagnosis", "Diagnóstico ejecutivo")}</div>
                <p className="font-mono text-xs text-foreground/75 leading-relaxed line-clamp-6">{execSummaryText}</p>
              </div>
            )}
            {competitive && (
              <div className="border border-border/30 bg-card/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-bold">{t("Landscape Competitivo", "Competitive Landscape", "Panorama competitivo")}</div>
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
              <Users className="h-3 w-3" />{t("Seção 1 — Segmentação de Audiência", "Section 1 — Audience Segmentation", "Sección 1 — Segmentación de audiencia")}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{t("Quem vamos alcançar e como chegar até eles por canal", "Who we will reach and how to reach them through each channel", "A quién llegaremos y cómo alcanzarlo por canal")}</div>
          </div>
          {secA !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secA === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secA === "approved" ? t("✓ Aprovado", "✓ Approved", "✓ Aprobado") : t("↻ Revisão", "↻ Review", "↻ Revisión")}
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
                <XCircle className="h-3 w-3" />{t("Instruções de ajuste — Segmentação", "Adjustment Instructions — Targeting", "Instrucciones de ajuste — Segmentación")}
              </div>
              <textarea
                className="w-full bg-card/40 border border-yellow-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-yellow-400/60"
                rows={4}
                placeholder={t("Ex: quero tráfego pago com geolocalização nas academias da cidade, raio de 5km por unidade, combinar com orgânico no Instagram...", "E.g.: I want location-targeted paid ads for the city's gyms, within 5 km of each location, combined with organic Instagram content...", "Ej.: quiero anuncios pagados con geolocalización para los gimnasios de la ciudad, a 5 km de cada sede, combinados con contenido orgánico en Instagram...")}
                value={userNotes["secA"] ?? ""}
                onChange={e => setNote("secA", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secA", setSecA)}
                  className="py-2 border border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/15 font-mono text-[10px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />{t("Salvar & Aprovar", "Save & Approve", "Guardar y aprobar")}
                </button>
                <button onClick={() => setSecA("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  {t("Cancelar", "Cancel", "Cancelar")}
                </button>
              </div>
            </div>
          )}
          {secA === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecA("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />{t("Aprovar Segmentação", "Approve Targeting", "Aprobar segmentación")}
              </button>
              <button onClick={() => setSecA("editing")}
                className="py-2.5 border border-yellow-400/30 hover:bg-yellow-400/10 font-mono text-[11px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />{t("Editar & Ajustar", "Edit & Adjust", "Editar y ajustar")}
              </button>
            </div>
          )}
          {secA === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secA"] && (
                <div className="border border-yellow-400/20 bg-yellow-400/5 p-2 font-mono text-[10px] text-yellow-400/80">
                  <span className="text-muted-foreground/50 uppercase">{t("Instrução salva:", "Saved instruction:", "Instrucción guardada:")} </span>{savedNotes["secA"]}
                </div>
              )}
              <button onClick={() => setSecA("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />{t("Aprovado · Clique para editar instrução", "Approved · Click to edit instruction", "Aprobado · Haz clic para editar la instrucción")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Platform creative briefs */}
      <div className="border border-border/50 bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
            <Layers className="h-3 w-3" />{t("Seção 2 — Criativos por Plataforma", "Section 2 — Platform Creatives", "Sección 2 — Creatividades por plataforma")}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">
            {t("Visual, formato, gatilho e ações para cada canal — aprove um a um", "Visuals, format, trigger, and actions for each channel — approve individually", "Visuales, formato, disparador y acciones por canal — apruébalos uno a uno")}
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
              <DollarSign className="h-3 w-3" />{t("Seção 3 — Tráfego Pago & Alcance", "Section 3 — Paid Traffic & Reach", "Sección 3 — Tráfico pagado y alcance")}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{t("Orçamento, distribuição por canal, segmentação e alcance estimado", "Budget, channel distribution, targeting, and estimated reach", "Presupuesto, distribución por canal, segmentación y alcance estimado")}</div>
          </div>
          {secC !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secC === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secC === "approved" ? t("✓ Aprovado", "✓ Approved", "✓ Aprobado") : t("↻ Revisão", "↻ Review", "↻ Revisión")}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {hasBudget ? (
            <>
              {/* Budget KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-orange-400/25 bg-orange-400/5 p-3 text-center">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-orange-400/70 mb-1">{t("Budget Total", "Total Budget", "Presupuesto total")}</div>
                  <div className="font-mono text-sm font-bold text-orange-400">
                    {budgetNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </div>
                </div>
                {cplEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">{t("CPL Est.", "Est. CPL", "CPL est.")}</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">
                      R$ {cplEst.toFixed(0)}
                      {avgCPL > 0 && <span className="font-mono text-[8px] text-muted-foreground/40 block">{t("pelo agente", "agent estimate", "estimado por el agente")}</span>}
                    </div>
                  </div>
                )}
                {leadsEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">{t("Leads Est.", "Est. Leads", "Prospectos est.")}</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{leadsEst.toLocaleString("pt-BR")}</div>
                  </div>
                )}
                {reachEst > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">{t("Alcance Est.", "Est. Reach", "Alcance est.")}</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{reachEst.toLocaleString("pt-BR")}</div>
                  </div>
                )}
                {typicalROAS > 0 && (
                  <div className="border border-border/30 bg-card/20 p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">{t("ROAS Típico", "Typical ROAS", "ROAS típico")}</div>
                    <div className="font-mono text-sm font-bold text-foreground/80">{typicalROAS.toFixed(1)}x</div>
                  </div>
                )}
              </div>
              {/* Channel distribution */}
              <div className="border border-border/30 bg-card/20 p-3 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">{t("Distribuição por Canal", "Channel Distribution", "Distribución por canal")}</div>
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
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">{t("Plano de Segmentação", "Targeting Plan", "Plan de segmentación")}</div>
                <div className="space-y-1.5">
                  {[
                    { label: t("Público Frio — Interesses", "Cold Audience — Interests", "Público frío — Intereses"), value: persona ? t(`Interesses relacionados a: ${persona}`, `Interests related to: ${persona}`, `Intereses relacionados con: ${persona}`) : t("Interesses do nicho + comportamento de compra", "Niche interests + purchasing behavior", "Intereses del nicho + comportamiento de compra") },
                    { label: "Lookalike 1–3%", value: `Baseado em lista de clientes ${product} + engajamento no perfil` },
                    { label: "Retargeting Quente", value: "Visitantes do site D-7 · Engajadores do Instagram D-30 · Leads da lista VIP" },
                    { label: t("Exclusões", "Exclusions", "Exclusiones"), value: t("Clientes ativos · Inscritos na newsletter já convertidos", "Active customers · Newsletter subscribers who already converted", "Clientes activos · Suscriptores del boletín que ya convirtieron") },
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
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-2">{t("Plano de Segmentação (Orgânico)", "Targeting Plan (Organic)", "Plan de segmentación (orgánico)")}</div>
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
                <XCircle className="h-3 w-3" />{t("Instruções de ajuste — Tráfego & Alcance", "Adjustment Instructions — Traffic & Reach", "Instrucciones de ajuste — Tráfico y alcance")}
              </div>
              <textarea
                className="w-full bg-card/40 border border-orange-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-400/60"
                rows={4}
                placeholder={t("Ex: quero tráfego PAGO nas academias da cidade usando geolocalização por raio de 5km em cada unidade, combinar Meta Ads + Google Ads, aumentar número de inserções semanais para pelo menos 5 por plataforma...", "E.g.: I want PAID ads targeting gyms within 5 km of each location, combining Meta Ads and Google Ads, with at least 5 placements per platform each week...", "Ej.: quiero anuncios PAGADOS para gimnasios a 5 km de cada sede, combinando Meta Ads y Google Ads, con al menos 5 publicaciones semanales por plataforma...")}
                value={userNotes["secC"] ?? ""}
                onChange={e => setNote("secC", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secC", setSecC)}
                  className="py-2 border border-orange-400/40 bg-orange-400/10 hover:bg-orange-400/15 font-mono text-[10px] uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />{t("Salvar & Aprovar", "Save & Approve", "Guardar y aprobar")}
                </button>
                <button onClick={() => setSecC("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  {t("Cancelar", "Cancel", "Cancelar")}
                </button>
              </div>
            </div>
          )}
          {secC === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecC("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />{t("Aprovar Plano de Tráfego", "Approve Traffic Plan", "Aprobar plan de tráfico")}
              </button>
              <button onClick={() => setSecC("editing")}
                className="py-2.5 border border-orange-400/30 hover:bg-orange-400/10 font-mono text-[11px] uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />{t("Editar & Ajustar", "Edit & Adjust", "Editar y ajustar")}
              </button>
            </div>
          )}
          {secC === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secC"] && (
                <div className="border border-orange-400/20 bg-orange-400/5 p-2 font-mono text-[10px] text-orange-400/80">
                  <span className="text-muted-foreground/50 uppercase">{t("Instrução salva:", "Saved instruction:", "Instrucción guardada:")} </span>{savedNotes["secC"]}
                </div>
              )}
              <button onClick={() => setSecC("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />{t("Aprovado · Clique para editar instrução", "Approved · Click to edit instruction", "Aprobado · Haz clic para editar la instrucción")}
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
              <Target className="h-3 w-3" />{t("Seção 4 — Arquitetura & Cronograma", "Section 4 — Architecture & Schedule", "Sección 4 — Arquitectura y cronograma")}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{t("Fases do lançamento, milestones e metas projetadas", "Launch phases, milestones, and projected goals", "Fases del lanzamiento, hitos y objetivos proyectados")}</div>
          </div>
          {secB !== "pending" && (
            <span className={`font-mono text-[10px] uppercase shrink-0 ${secB === "approved" ? "text-success" : "text-yellow-400"}`}>
              {secB === "approved" ? t("✓ Aprovado", "✓ Approved", "✓ Aprobado") : t("↻ Revisão", "↻ Review", "↻ Revisión")}
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
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 mb-2 font-bold">{t("Metas & KPIs Projetados", "Projected Goals & KPIs", "Objetivos y KPI proyectados")}</div>
              <PlanText value={strategyD["successMetrics"] as Record<string, unknown>} />
            </div>
          ) : null}
          {secB === "editing" && (
            <div className="pt-1 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80 font-bold flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />{t("Instruções de ajuste — Cronograma", "Adjustment Instructions — Schedule", "Instrucciones de ajuste — Cronograma")}
              </div>
              <textarea
                className="w-full bg-card/40 border border-yellow-400/30 text-foreground/90 font-mono text-xs p-3 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-yellow-400/60"
                rows={4}
                placeholder={t("Ex: quero mais inserções — pelo menos 15 posts antes da abertura do carrinho, dividir entre orgânico diário e pago com boosting nos melhores Reels...", "E.g.: I want more posts — at least 15 before checkout opens, split between daily organic content and paid boosts for the best Reels...", "Ej.: quiero más publicaciones — al menos 15 antes de abrir el carrito, repartidas entre contenido orgánico diario y promoción pagada de los mejores Reels...")}
                value={userNotes["secB"] ?? ""}
                onChange={e => setNote("secB", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => saveNote("secB", setSecB)}
                  className="py-2 border border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/15 font-mono text-[10px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />{t("Salvar & Aprovar", "Save & Approve", "Guardar y aprobar")}
                </button>
                <button onClick={() => setSecB("pending")}
                  className="py-2 border border-border/40 hover:bg-muted/20 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                  {t("Cancelar", "Cancel", "Cancelar")}
                </button>
              </div>
            </div>
          )}
          {secB === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setSecB("approved")}
                className="py-2.5 border border-success/30 bg-success/5 hover:bg-success/10 font-mono text-[11px] uppercase tracking-widest text-success flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-3 w-3" />{t("Aprovar Cronograma", "Approve Schedule", "Aprobar cronograma")}
              </button>
              <button onClick={() => setSecB("editing")}
                className="py-2.5 border border-yellow-400/30 hover:bg-yellow-400/10 font-mono text-[11px] uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5 transition-colors">
                <XCircle className="h-3 w-3" />{t("Editar & Ajustar", "Edit & Adjust", "Editar y ajustar")}
              </button>
            </div>
          )}
          {secB === "approved" && (
            <div className="space-y-1 pt-1">
              {savedNotes["secB"] && (
                <div className="border border-yellow-400/20 bg-yellow-400/5 p-2 font-mono text-[10px] text-yellow-400/80">
                  <span className="text-muted-foreground/50 uppercase">{t("Instrução salva:", "Saved instruction:", "Instrucción guardada:")} </span>{savedNotes["secB"]}
                </div>
              )}
              <button onClick={() => setSecB("editing")}
                className="w-full py-2 border border-success/20 text-success hover:bg-success/5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                <CheckCircle2 className="h-2.5 w-2.5" />{t("Aprovado · Clique para editar instrução", "Approved · Click to edit instruction", "Aprobado · Haz clic para editar la instrucción")}
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
                 {t("Tudo aprovado — pronto para gerar!", "Everything approved — ready to generate!", "¡Todo aprobado — listo para generar!")}
              </div>
              <div className="text-xs font-mono text-muted-foreground/60">
                {hasNotes
                  ? t("Suas instruções foram salvas. O agente vai incorporar todos os ajustes ao gerar copy, criativos, e-mails e sequências.", "Your instructions have been saved. The agent will incorporate all adjustments when generating copy, creatives, emails, and sequences.", "Tus instrucciones se guardaron. El agente incorporará todos los ajustes al generar textos, creatividades, correos y secuencias.")
                  : t("O agente vai gerar todo o conteúdo agora: copy, criativos, e-mails e sequências completas.", "The agent will now generate all content: copy, creatives, emails, and complete sequences.", "El agente generará ahora todo el contenido: textos, creatividades, correos y secuencias completas.")}
              </div>
            </div>
            <Button
              className="font-mono uppercase tracking-widest rounded-none gap-2 h-12 px-8 w-full md:w-auto btn-weapon-primary"
              onClick={() => onProceed(savedNotes)}
              disabled={proceedLoading}
            >
              {proceedLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />{t("Gerando Conteúdo...", "Generating Content...", "Generando contenido...")}</>
                : <><Zap className="h-4 w-4" />{t("Gerar Conteúdo Completo", "Generate All Content", "Generar todo el contenido")}</>
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
  const t = useUiText();
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { data: autonomyStatus } = useGetAutonomyStatus({ campaignId });
  const [pendingExecutionPhase, setPendingExecutionPhase] = useState<CampaignExecuteInputPhase | null>(null);

  const handleExecuteClick = (phase: CampaignExecuteInputPhase) => {
    if (phase === "launch" && autonomyStatus?.missingAcceptanceTypes && autonomyStatus.missingAcceptanceTypes.length > 0) {
      setPendingExecutionPhase(phase);
    } else {
      executeMutation.mutate({ campaignId, data: { phase } });
    }
  };

  const [activeTab, setActiveTab] = useState<"comando" | "agentes" | "estrategia" | "conteudo" | "metricas" | "grupos" | "galeria">("comando");
  const { isArquiteto, isFundador, setMode } = useMode();
  const { user, workspace } = useAuth();
  const [missingIntegrations, setMissingIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [partialIntegrations, setPartialIntegrations] = useState<{ category: string; providers: string[]; reason?: string }[] | null>(null);
  const [showPartialGuide, setShowPartialGuide] = useState(false);
  const [connectingEntry, setConnectingEntry] = useState<CatalogEntry | null>(null);
  const [bypassLaunchLoading, setBypassLaunchLoading] = useState(false);
  const [reorientOpen, setReorientOpen] = useState(false);
  const [rerunStrategyLoading, setRerunStrategyLoading] = useState(false);
  const [reorientDirective, setReorientDirective] = useState("");
  const [showLaunchSequence, setShowLaunchSequence] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);
  const [showAuditScanner, setShowAuditScanner] = useState(false);
  const [showLaunchFeeModal, setShowLaunchFeeModal] = useState(false);
  const [pendingStrategyFn, setPendingStrategyFn] = useState<(() => Promise<void>) | null>(null);

  const reorientMutation = useMutation({
    mutationFn: async (directive: string) => {
      return customFetch<{ ok: boolean; status: string }>(`/api/campaigns/${campaignId}/reorient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive }),
      });
    },
    onSuccess: () => {
      toast.success(t("Reorientação iniciada! A agente está reconstruindo a estratégia do zero.", "Strategy reset started! The agent is rebuilding it from scratch.", "¡Se inició la reorientación! El agente está reconstruyendo la estrategia desde cero."), { duration: 5000 });
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
            t(`Créditos insuficientes. Faltam ${shortage} crédito${shortage !== 1 ? "s" : ""} para reconstruir a estratégia.`, `Insufficient credits. ${shortage} more credit${shortage !== 1 ? "s" : ""} needed to rebuild the strategy.`, `Créditos insuficientes. Faltan ${shortage} crédito${shortage !== 1 ? "s" : ""} para reconstruir la estrategia.`),
            {
              duration: 8000,
              action: { label: t("Comprar créditos", "Buy credits", "Comprar créditos"), onClick: () => setLocation("/credits") },
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
      return customFetch<unknown>("/api/workspaces/me/integrations", {
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
    },
    onSuccess: () => {
      toast.success(t("Integração conectada! Tente lançar novamente.", "Integration connected! Try launching again.", "¡Integración conectada! Intenta lanzar de nuevo."));
      setConnectingEntry(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
  // autoLaunchFired removed — autolaunch bypassed the PreLaunchChecklist and was eliminated

  // Optimistically start polling — staleTime:0 forces a real request every 5s
  // instead of serving cached data, catching the analyzing→strategy_ready transition.
  const [localIsActive, setLocalIsActive] = useState(true);
  const { data, isLoading, isFetching } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
      refetchInterval: localIsActive ? 5000 : false,
      staleTime: 0,
    },
  });

  const campaign = data?.campaign;
  const isActive = ACTIVE_STATUSES.includes(campaign?.status ?? "");

  useEffect(() => {
    setLocalIsActive(ACTIVE_STATUSES.includes(campaign?.status ?? ""));
  }, [campaign?.status]);
  const refetchInterval = isActive ? 5000 : false;

  // Auto-redirect draft/intake → intake wizard; analyzing/strategy_ready → strategy page.
  // Guard with BOTH isLoading AND isFetching:
  //   - isLoading: true only on first load (no cached data yet)
  //   - isFetching: true whenever a background refetch is in flight
  // Without the isFetching guard, a finalize navigation lands here with stale
  // cache (status: "intake"), isLoading=false, isFetching=true → redirect fires
  // before the fresh data (status: "analyzing") arrives → infinite loop.
  useEffect(() => {
    if (!campaign || isLoading || isFetching) return;
    if (campaign.status === "draft" || campaign.status === "intake") {
      setLocation(`/campaigns/${campaignId}/intake`);
    } else if (campaign.status === "analyzing" || campaign.status === "strategy_ready") {
      setLocation(`/campaigns/${campaignId}/strategy`);
    }
  }, [campaign?.status, campaignId, setLocation, campaign, isLoading, isFetching]);

  // ── Agents query ──────────────────────────────────────────────────────────────
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/agents`],
    enabled: !!campaignId && activeTab === "agentes",
    refetchInterval: isActive ? 5000 : false,
    queryFn: async () => {
      return customFetch<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>(`/api/campaigns/${campaignId}/agents`)
        .catch(() => ({ agents: [] as AgentRun[], checkpoints: [] as Checkpoint[] }));
    },
  });

  // ── Content query ──────────────────────────────────────────────────────────────
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    enabled: !!campaignId && (activeTab === "conteudo" || activeTab === "agentes" || campaign?.status === "generating"),
    refetchInterval: isActive ? 5000 : false,
    staleTime: 0,
    queryFn: async () => {
      return customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`)
        .catch(() => null);
    },
  });

  // ── Content preview query (for awaiting_approval visual banner) ────────────
  const { data: previewContentData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content/preview`],
    enabled: !!campaignId && campaign?.status === "awaiting_approval",
    staleTime: 0,
    queryFn: async () => {
      return customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`)
        .catch(() => null);
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
      return customFetch<MetricsSummary>(`/api/campaigns/${campaignId}/metrics/summary`)
        .catch(() => null);
    },
  });

  // ── Alerts query ──────────────────────────────────────────────────────────────
  const { data: alertsData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/alerts`],
    enabled: !!campaignId && activeTab === "metricas",
    queryFn: async () => {
      return customFetch<{ alerts: MetricAlert[] }>(`/api/campaigns/${campaignId}/alerts`)
        .catch(() => ({ alerts: [] as MetricAlert[] }));
    },
  });

  // ── Credit stats (per-campaign usage) ────────────────────────────────────
  const { data: creditStatsData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/credit-stats`],
    enabled: !!campaignId,
    refetchInterval: isActive ? 15000 : false,
    queryFn: async () => {
      return customFetch<{
        creditsCost: number;
        totalCredits: number;
        totalTokens: number;
        totalCostUsd: number;
        byAgent: { agentRole: string; provider: string; credits: number; tokens: number; costUsd: number; runs: number }[];
      }>(`/api/campaigns/${campaignId}/credit-stats`).catch(() => null);
    },
  });

  // ── Connected integrations (for launch sequence overlay) ───────────────────
  const { data: integrationsData } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    enabled: !!campaignId,
    staleTime: 60_000,
    queryFn: async () => {
      return customFetch<{ integrations: { provider: string; status: string }[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as { provider: string; status: string }[] }));
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

  // Clear stale events when campaign is no longer active (e.g. reset after deploy/boot cleanup)
  useEffect(() => {
    if (!isActive) {
      setLiveEvents([]);
    }
  }, [isActive]);

  // Polling fallback: if active but socket hasn't delivered events, show a message after 12s
  useEffect(() => {
    if (!isActive || liveEvents.length > 1) return;
    const timer = setTimeout(() => {
      setLiveEvents(prev => {
        if (prev.length > 1) return prev;
        return [...prev, {
          campaignId,
          type: "execution_update" as const,
          message: t("Processando em background — aguardando próxima atualização dos agentes...", "Processing in the background — waiting for the next agent update...", "Procesando en segundo plano — esperando la próxima actualización de los agentes..."),
          timestamp: new Date().toISOString(),
        }];
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [isActive, liveEvents.length, campaignId]);

  // ── Execute campaign phase ─────────────────────────────────────────────────────
  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: (data: unknown) => {
        const resp = data as { creditWarning?: { balance: number; required: number; shortage: number } } | null;
        if (resp?.creditWarning) {
          const { shortage, balance } = resp.creditWarning;
          toast.warning(t(`Créditos baixos — faltam ${shortage} cr (saldo: ${balance})`, `Low credits — ${shortage} credits short (balance: ${balance})`, `Créditos bajos — faltan ${shortage} cr (saldo: ${balance})`), {
            description: t("A fase foi iniciada, mas recomendamos comprar créditos para evitar interrupções.", "The phase has started, but we recommend buying credits to avoid interruptions.", "La fase comenzó, pero recomendamos comprar créditos para evitar interrupciones."),
            duration: 12000,
            action: { label: t("Comprar créditos", "Buy credits", "Comprar créditos"), onClick: () => setLocation("/credits") },
          });
        } else {
          toast.success(t("Fase iniciada. A agente está em execução.", "Phase started. The agent is running.", "Fase iniciada. El agente está en ejecución."));
        }
        setActiveTab("agentes");
        setLiveEvents(prev => [...prev, {
          campaignId,
          type: "execution_update" as const,
           message: t("Fase iniciada — agentes sendo ativados em instantes...", "Phase started — agents will be activated shortly...", "Fase iniciada — los agentes se activarán en breve..."),
          timestamp: new Date().toISOString(),
        }]);
        // Optimistically mark as active so polling kicks in before first refetch
        // Also reset updatedAt + brainData.pipelineCheckpoint.lockedAt so stale detection
        // doesn't immediately re-show the "Reiniciar" button before the lock is acquired
        queryClient.setQueryData(getGetCampaignQueryKey(campaignId), (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          const o = old as { campaign?: Record<string, unknown> };
          if (!o.campaign) return old;
          const now = new Date().toISOString();
          return { ...o, campaign: { ...o.campaign, status: "analyzing", updatedAt: now, brainData: { pipelineCheckpoint: { lockedAt: now, lastProgressAt: now } } } };
        });
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      },
      onError: async (err: unknown) => {
        // ApiError from customFetch exposes parsed JSON body in .data directly
        // (.response is the raw Fetch Response object, not { data: ... })
        type ErrBody = { error?: string; code?: string; data?: { shortage?: number; balance?: number; required?: number; missing?: { category: string; providers: string[]; reason?: string }[] } };
        const apiErr = err as { data?: ErrBody; status?: number };
        const errData = apiErr?.data;
        const code = errData?.code;
        const msg = errData?.error;
        if (code === "CONTRACT_ACCEPTANCE_REQUIRED") {
          await queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey({ campaignId }) });
          setPendingExecutionPhase("launch");
        } else if (code === "INSUFFICIENT_CREDITS" && errData?.data) {
          const { shortage = 0, balance = 0, required = 0 } = errData.data;
          toast.error(t(`Créditos insuficientes — faltam ${shortage} cr (saldo: ${balance}, necessário: ${required})`, `Insufficient credits — ${shortage} credits short (balance: ${balance}, required: ${required})`, `Créditos insuficientes — faltan ${shortage} cr (saldo: ${balance}, necesarios: ${required})`), {
            description: t("Compre créditos para continuar executando agentes.", "Buy credits to keep running agents.", "Compra créditos para seguir ejecutando agentes."),
            duration: 10000,
            action: { label: t("Comprar créditos", "Buy credits", "Comprar créditos"), onClick: () => setLocation("/credits") },
          });
        } else if (code === "CONTENT_NOT_APPROVED" || code === "NO_CONTENT") {
          const approvalUrl = (errData?.data as { approvalUrl?: string } | undefined)?.approvalUrl ?? `/campaigns/${campaignId}/content`;
          toast.error(msg ?? t("Conteúdo não aprovado.", "Content not approved.", "Contenido no aprobado."), {
            description: t("Aprove todas as peças antes de lançar.", "Approve all pieces before launching.", "Aprueba todas las piezas antes de lanzar."),
            duration: 8000,
            action: { label: t("Ir para Aprovação", "Go to Approval", "Ir a aprobación"), onClick: () => { window.location.href = approvalUrl; } },
          });
        } else if (code === "MISSING_INTEGRATIONS") {
          setMissingIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else if (code === "PARTIAL_INTEGRATIONS") {
          setPartialIntegrations((errData?.data?.missing ?? []).map((m: { category: string; providers: string[]; reason?: string }) => m));
        } else if (msg?.includes("Pipeline já está executando")) {
          toast.info(t("O pipeline já está em execução. Aguarde a conclusão ou verifique a aba Agentes.", "The pipeline is already running. Wait for it to finish or check the Agents tab.", "El flujo ya está en ejecución. Espera a que termine o revisa la pestaña Agentes."), { duration: 8000 });
        } else {
          toast.error(msg ?? t("Falha ao iniciar fase.", "Failed to start phase.", "No se pudo iniciar la fase."), { duration: 6000 });
        }
      },
    },
  });

  // ── Failsafe retry ─────────────────────────────────────────────────────────────
  // Calls POST /execute/retry to clear the pipeline lock, force-reset status, and
  // re-enqueue the appropriate job. Preserves already-generated content pieces.
  const [retryPending, setRetryPending] = useState(false);

  const handleRetry = async () => {
    if (retryPending) return;
    setRetryPending(true);
    try {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/execute/retry`, { method: "POST" });
      toast.success(t("Pipeline retomado — processando...", "Pipeline resumed — processing...", "Flujo reanudado — procesando..."), { description: t("Peças já geradas serão preservadas.", "Previously generated pieces will be preserved.", "Se conservarán las piezas ya generadas.") });
      setActiveTab("agentes");
      queryClient.setQueryData(getGetCampaignQueryKey(campaignId), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const o = old as { campaign?: Record<string, unknown> };
        if (!o.campaign) return old;
        const now = new Date().toISOString();
        return { ...o, campaign: { ...o.campaign, updatedAt: now, brainData: { pipelineCheckpoint: { lockedAt: now, lastProgressAt: now } } } };
      });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (retryErr) {
      if (retryErr instanceof ApiError) {
        const body = retryErr.data as { error?: string; code?: string; data?: { lastFailedAgent?: string; lastFailedPieceType?: string; retryCount?: number } } | undefined;
        if (body?.code === "REQUIRES_INTERVENTION") {
          const pieceName = body.data?.lastFailedPieceType ? (PIECE_DISPLAY_NAMES[body.data.lastFailedPieceType] ? t(...PIECE_DISPLAY_NAMES[body.data.lastFailedPieceType]) : body.data.lastFailedPieceType) : null;
          toast.error(
            pieceName ? t(`Falha repetida em "${pieceName}"`, `Repeated failure for "${pieceName}"`, `Error repetido para "${pieceName}"`) : t("Limite de tentativas atingido", "Retry limit reached", "Se alcanzó el límite de intentos"),
            { description: t("Pule esta peça ou ajuste o briefing antes de tentar novamente.", "Skip this piece or adjust the brief before trying again.", "Omite esta pieza o ajusta el briefing antes de volver a intentarlo."), duration: 10000 },
          );
        } else {
          toast.error(body?.error ?? t("Erro ao retomar pipeline.", "Error resuming pipeline.", "Error al reanudar el flujo."), { duration: 6000 });
        }
      } else {
        toast.error(t("Erro ao retomar pipeline.", "Error resuming pipeline.", "Error al reanudar el flujo."), { duration: 6000 });
      }
    } finally {
      setRetryPending(false);
    }
  };

  // ── Skip broken piece ──────────────────────────────────────────────────────
  // Marks a content piece type as "skipped" in brainData so the next pipeline
  // run bypasses it. Resets requiresIntervention so user can retry normally.
  const [skipPending, setSkipPending] = useState(false);
  const handleSkipPiece = async (pieceType: string) => {
    if (skipPending || !pieceType) return;
    setSkipPending(true);
    try {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/content/pieces/${pieceType}/skip`, { method: "POST" });
      const pieceName = PIECE_DISPLAY_NAMES[pieceType] ? t(...PIECE_DISPLAY_NAMES[pieceType]) : pieceType;
      toast.success(t(`"${pieceName}" marcada para pular`, `"${pieceName}" marked to skip`, `"${pieceName}" marcada para omitir`), { description: t("Ao retomar, o pipeline gerará as demais peças e ignorará esta.", "When resumed, the pipeline will generate the remaining pieces and skip this one.", "Al reanudarse, el flujo generará las demás piezas y omitirá esta.") });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch {
      toast.error(t("Erro ao pular peça.", "Error skipping piece.", "Error al omitir la pieza."), { duration: 4000 });
    } finally {
      setSkipPending(false);
    }
  };

  // Reset execute mutation when campaign is strategy_ready (prevents stuck "isPending" state
  // from a previous attempt that was interrupted e.g. by API server restart)
  useEffect(() => {
    if (campaign?.status === "strategy_ready" && executeMutation.isPending) {
      executeMutation.reset();
    }
  }, [campaign?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: autolaunch=1 was intentionally removed.
  // After content approval, the campaign goes to `approved` and the
  // PreLaunchChecklist (4 mandatory gates) must be completed before launch.
  // No automatic execution is allowed — the user must explicitly click "Lançar"
  // after passing all gates. Any URL with ?autolaunch is ignored.
  useEffect(() => {
    if (!campaign) return;
    const qs = new URLSearchParams(searchString);
    if (qs.get("autolaunch") === "1") {
      // Clean the URL silently but do NOT fire the launch
      window.history.replaceState(null, "", `/campaigns/${campaignId}`);
    }
  }, [campaign?.status, searchString, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Approve/reject content ─────────────────────────────────────────────────────
  const [contentActionLoading, setContentActionLoading] = useState<string | null>(null);
  const handleContentAction = async (pieceId: string, action: "approve" | "reject") => {
    setContentActionLoading(pieceId);
    try {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/content/${pieceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      toast.success(action === "approve" ? t("Conteúdo aprovado.", "Content approved.", "Contenido aprobado.") : t("Conteúdo rejeitado.", "Content rejected.", "Contenido rechazado."));
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Erro ao processar ação", "Error processing action", "Error al procesar la acción"));
    } finally {
      setContentActionLoading(null);
    }
  };

  // ── Launch with bypass (after partial-integrations confirmation) ──────────────
  const handleBypassLaunch = async () => {
    setBypassLaunchLoading(true);
    setPartialIntegrations(null);
    setShowPartialGuide(false);
    try {
      await customFetch<unknown>(
        `/api/campaigns/${campaignId}/execute/launch?skipIntegrationWarning=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      toast.success(t("Lançamento iniciado. A agente está em execução.", "Launch started. The agent is running.", "Lanzamiento iniciado. El agente está en ejecución."));
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Falha ao lançar campanha.", "Failed to launch campaign.", "No se pudo lanzar la campaña."));
    } finally {
      setBypassLaunchLoading(false);
    }
  };

  // ── Approve checkpoint ────────────────────────────────────────────────────────
  const [checkpointLoading, setCheckpointLoading] = useState<string | null>(null);
  const handleCheckpointApprove = async (checkpointId: string) => {
    setCheckpointLoading(checkpointId);
    try {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId, approved: true }),
      });
      toast.success(t("Checkpoint aprovado.", "Checkpoint approved.", "Punto de control aprobado."));
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/agents`] });
      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch {
      toast.error(t("Erro ao aprovar checkpoint.", "Error approving checkpoint.", "Error al aprobar el punto de control."));
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
         {t("Campanha não encontrada no registro", "Campaign not found in records", "Campaña no encontrada en los registros")}
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
             {t("Abrindo o briefing com o agente...", "Opening the agent brief...", "Abriendo el briefing con el agente...")}
          </p>
          <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
             {t("Em alguns segundos o agente vai iniciar a conversa", "The agent will start the conversation in a few seconds", "El agente iniciará la conversación en unos segundos")}
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

  // Read contentRetry state from brainData — drives intervention UI
  const brainDataRaw = (campaignRaw["brainData"] ?? {}) as Record<string, unknown>;
  const contentRetryRaw = (brainDataRaw["contentRetry"] ?? {}) as Record<string, unknown>;
  const requiresIntervention = !!(contentRetryRaw["requiresIntervention"]);
  const failedAgentRaw = (contentRetryRaw["lastFailedAgent"] as string | undefined) ?? "";
  const failedPieceTypeRaw = (contentRetryRaw["lastFailedPieceType"] as string | undefined) ?? "";
  const retryCountRaw = (contentRetryRaw["retryCount"] as number | undefined) ?? 0;
  const lastErrorType = (contentRetryRaw["lastErrorType"] as string | undefined) ?? "";
  const autocorrectionStatus = (contentRetryRaw["autocorrectionStatus"] as string | undefined) ?? "";
  const isAutocorrecting = autocorrectionStatus === "running";
  const isWaitingClarification = autocorrectionStatus === "waiting_clarification";
  const isAutocorrectionDone = autocorrectionStatus === "done";
  const PIECE_DISPLAY_NAMES: Record<string, [string, string, string]> = {
    creative_direction: ["Direção Criativa", "Creative Direction", "Dirección creativa"],
    email_sequence: ["Copy & E-mails", "Copy & Emails", "Textos y correos"],
    social_media_calendar: ["Redes Sociais", "Social Media", "Redes sociales"],
    ad_copy: ["Anúncios", "Ads", "Anuncios"],
    vsl_script: ["Roteiro de VSL", "VSL Script", "Guion de VSL"],
    cpl_script: ["Roteiro de CPL", "CPL Script", "Guion de CPL"],
    webinar_script: ["Roteiro de Webinar", "Webinar Script", "Guion de webinar"],
    live_script: ["Roteiro de Live", "Livestream Script", "Guion de transmisión en vivo"],
    stories_sequence: ["Sequência de Stories", "Stories Sequence", "Secuencia de Stories"],
    landing_page: ["Página de Vendas", "Sales Page", "Página de ventas"],
    targeting_config: ["Segmentação", "Targeting", "Segmentación"],
    media_buying_plan: ["Plano de Mídia", "Media Plan", "Plan de medios"],
    video_strategy: ["Estratégia de Vídeo", "Video Strategy", "Estrategia de video"],
    creator_growth: ["Crescimento de Audiência", "Audience Growth", "Crecimiento de audiencia"],
    compliance: ["Compliance", "Compliance", "Cumplimiento"],
    optimization: ["Otimização", "Optimization", "Optimización"],
  };
  const failedPieceName = PIECE_DISPLAY_NAMES[failedPieceTypeRaw] ? t(...PIECE_DISPLAY_NAMES[failedPieceTypeRaw]) : failedPieceTypeRaw;

  const getNextAction = (): { label: string; phase?: CampaignExecuteInputPhase; href?: string; description: string; isRetry?: boolean; isIntervention?: boolean; failedPieceType?: string } | null => {
    switch (campaign.status) {
      case "analyzing": {
        const cp = brainDataRaw["pipelineCheckpoint"] as { lockedAt?: string; lastProgressAt?: string } | undefined;
        const updatedAt = campaignRaw["updatedAt"] as string | undefined;
        // Threshold is 3.5 min, just above the backend lock grace period of 3 min
        const STALE_THRESHOLD_MS = 3.5 * 60 * 1000;
        const checkTime = cp?.lastProgressAt ?? updatedAt;
        const isStale = !cp?.lockedAt || (checkTime && Date.now() - new Date(checkTime).getTime() > STALE_THRESHOLD_MS);
        if (isAutocorrecting) {
          return { label: t("Autocorrigindo...", "Auto-correcting...", "Corrigiendo automáticamente..."), description: lastErrorType === "COMPLIANCE_VIOLATION" ? t(`🛡️ Ethics Agent ajustando linguagem de conformidade para "${failedPieceName}"...`, `🛡️ Ethics Agent is adjusting compliance language for "${failedPieceName}"...`, `🛡️ Ethics Agent está ajustando el lenguaje de cumplimiento para "${failedPieceName}"...`) : t(`📋 Entry Analyzer analisando lacunas no briefing para "${failedPieceName}"...`, `📋 Entry Analyzer is checking the brief for gaps for "${failedPieceName}"...`, `📋 Entry Analyzer está revisando las carencias del briefing para "${failedPieceName}"...`), isRetry: false };
        }
        if (isWaitingClarification) {
          return { isRetry: true, label: t("Responder pergunta do agente", "Answer agent question", "Responder la pregunta del agente"), description: t(`📋 O Entry Analyzer precisa de uma informação do briefing para desbloquear "${failedPieceName}". Veja a pergunta na aba Agentes.`, `📋 Entry Analyzer needs information from the brief to unblock "${failedPieceName}". See the question in the Agents tab.`, `📋 Entry Analyzer necesita información del briefing para desbloquear "${failedPieceName}". Consulta la pregunta en la pestaña Agentes.`) };
        }
        if (isAutocorrectionDone) {
          return { isRetry: true, label: t("Retomar — corrigido automaticamente", "Resume — automatically corrected", "Reanudar — corregido automáticamente"), description: t(`✅ Ethics Agent ajustou a linguagem de "${failedPieceName}" para conformidade. Clique para tentar novamente com a nova diretriz.`, `✅ Ethics Agent adjusted "${failedPieceName}" for compliance. Click to retry using the updated direction.`, `✅ Ethics Agent ajustó "${failedPieceName}" para cumplir las normas. Haz clic para volver a intentarlo con la nueva directriz.`) };
        }
        // RC-011: Strategy phase failed — brainData.strategyTransitionFailed is the marker
        // written by the catch block in command.agent.ts when transitionCampaign throws.
        // Takes priority over generic isStale so the Founder sees a precise message + retry.
        const strategyFailed = brainDataRaw["strategyTransitionFailed"] as { at?: string; retryable?: boolean; message?: string } | undefined;
        if (strategyFailed) {
          if (strategyFailed.retryable !== false) {
            return {
              isRetry: true,
              label: t("Tentar novamente — fase de estratégia", "Retry — strategy phase", "Reintentar — fase de estrategia"),
              description: strategyFailed.message ?? t("A fase de estratégia falhou ao finalizar. Clique para tentar novamente — o progresso dos agentes anteriores foi preservado e nenhum crédito extra será cobrado.", "The strategy phase failed to finish. Click to retry — previous agent progress has been preserved and no extra credits will be charged.", "La fase de estrategia no terminó. Haz clic para reintentar: se conservó el progreso previo de los agentes y no se cobrarán créditos adicionales."),
            };
          }
          return {
            isIntervention: true,
            isRetry: false,
            label: t("Requer suporte técnico", "Technical support required", "Se requiere soporte técnico"),
            description: t(`A fase de estratégia encontrou um erro não recuperável${strategyFailed.at ? ` (${new Date(strategyFailed.at).toLocaleString("pt-BR")})` : ""}. Entre em contato com o suporte.`, `The strategy phase encountered an unrecoverable error${strategyFailed.at ? ` (${new Date(strategyFailed.at).toLocaleString("en-US")})` : ""}. Contact support.`, `La fase de estrategia encontró un error irrecuperable${strategyFailed.at ? ` (${new Date(strategyFailed.at).toLocaleString("es-419")})` : ""}. Contacta al soporte.`),
          };
        }
        if (requiresIntervention) {
          const errorLabel = lastErrorType === "COMPLIANCE_VIOLATION" ? t(" (filtro de compliance)", " (compliance filter)", " (filtro de cumplimiento)") : lastErrorType === "INVALID_INPUT_CONTEXT" ? t(" (dados insuficientes)", " (insufficient data)", " (datos insuficientes)") : "";
          return { isIntervention: true, isRetry: false, label: t("Intervenção necessária", "Intervention required", "Se requiere intervención"), failedPieceType: failedPieceTypeRaw, description: failedPieceName ? t(`Falha repetida na criação de "${failedPieceName}"${errorLabel}. Pule esta peça ou ajuste o briefing para desbloquear.`, `Repeated failure creating "${failedPieceName}"${errorLabel}. Skip this piece or adjust the brief to unblock the pipeline.`, `Error repetido al crear "${failedPieceName}"${errorLabel}. Omite esta pieza o ajusta el briefing para desbloquear el flujo.`) : t("Falha repetida no pipeline de estratégia. Revise o briefing e tente novamente.", "Repeated strategy pipeline failure. Review the brief and try again.", "Error repetido en el flujo de estrategia. Revisa el briefing e inténtalo de nuevo.") };
        }
        if (isStale) {
          return { isRetry: true, label: t("Retomar Processamento", "Resume Processing", "Reanudar procesamiento"), description: t("O pipeline parou inesperadamente. Clique para desbloquear e retomar os agentes de estratégia — o checkpoint preserva o progresso anterior.", "The pipeline stopped unexpectedly. Click to unlock and resume strategy agents — the checkpoint preserves previous progress.", "El flujo se detuvo inesperadamente. Haz clic para desbloquear y reanudar los agentes; el punto de control conserva el progreso anterior.") };
        }
        return { label: t("Analisando...", "Analyzing...", "Analizando..."), description: t("Agentes de estratégia em execução. Aguarde a conclusão da análise.", "Strategy agents are running. Wait for the analysis to finish.", "Los agentes de estrategia están trabajando. Espera a que termine el análisis."), phase: undefined };
      }
      case "generating": {
        const genUpdatedAt = campaignRaw["updatedAt"] as string | undefined;
        const GEN_STALE_MS = 20 * 60 * 1000;
        const piecesNow = contentData?.pieces?.length ?? 0;
        const genIsStale = !!genUpdatedAt && Date.now() - new Date(genUpdatedAt).getTime() > GEN_STALE_MS;
        // Psychology layer missing — inline recovery failed; user must re-run strategy
        const psychLayerMissing = !!(brainDataRaw["psychologyLayerMissing"]);
        if (psychLayerMissing) {
          return {
            isIntervention: true, isRetry: false,
            label: t("Agentes de psicologia ausentes", "Psychology agents missing", "Faltan agentes de psicología"),
            description: t("Os agentes de pricing, objections e hooks não foram executados. Copy de anúncios, VSL e página de vendas dependem deles. Veja o painel abaixo e re-execute a fase de estratégia.", "Pricing, objections, and hooks agents did not run. Ad copy, VSL, and sales pages depend on them. See the panel below and run the strategy phase again.", "No se ejecutaron los agentes de precios, objeciones y ganchos. Los textos publicitarios, VSL y páginas de ventas dependen de ellos. Consulta el panel y vuelve a ejecutar la fase de estrategia."),
          };
        }
        if (isAutocorrecting) {
          const autocorrectDesc = lastErrorType === "COMPLIANCE_VIOLATION"
            ? t(`🛡️ Ethics Agent analisando o bloqueio e reescrevendo "${failedPieceName}" sem violar políticas de anúncios...`, `🛡️ Ethics Agent is reviewing the block and rewriting "${failedPieceName}" to comply with ad policies...`, `🛡️ Ethics Agent está analizando el bloqueo y reescribiendo "${failedPieceName}" para cumplir las políticas publicitarias...`)
            : t(`📋 Entry Analyzer identificando lacuna no briefing para "${failedPieceName}"...`, `📋 Entry Analyzer is identifying a gap in the brief for "${failedPieceName}"...`, `📋 Entry Analyzer está identificando una carencia en el briefing para "${failedPieceName}"...`);
          return { label: t("Autocorrigindo automaticamente...", "Auto-correcting...", "Corrigiendo automáticamente..."), description: autocorrectDesc, isRetry: false };
        }
        if (isWaitingClarification) {
          return {
            isRetry: true, label: t("Responder pergunta do agente", "Answer agent question", "Responder la pregunta del agente"),
            description: t(`📋 O Entry Analyzer gerou uma pergunta cirúrgica para destravar "${failedPieceName}". Veja e responda na aba Agentes — a pipeline retoma automaticamente.`, `📋 Entry Analyzer generated a targeted question to unblock "${failedPieceName}". View and answer it in the Agents tab — the pipeline resumes automatically.`, `📋 Entry Analyzer generó una pregunta específica para desbloquear "${failedPieceName}". Revísala y respóndela en la pestaña Agentes; el flujo se reanudará automáticamente.`),
          };
        }
        if (isAutocorrectionDone) {
          return {
            isRetry: true, label: t("Retomar — corrigido automaticamente", "Resume — automatically corrected", "Reanudar — corregido automáticamente"),
            description: t(`✅ Ethics Agent ajustou "${failedPieceName}" para conformidade com Meta Ads / CONAR.${piecesNow > 0 ? ` ${piecesNow} peças anteriores preservadas.` : ""} Clique para retomar com a nova diretriz.`, `✅ Ethics Agent adjusted "${failedPieceName}" to comply with Meta Ads / CONAR.${piecesNow > 0 ? ` ${piecesNow} previous pieces preserved.` : ""} Click to resume with the updated direction.`, `✅ Ethics Agent ajustó "${failedPieceName}" para cumplir con Meta Ads / CONAR.${piecesNow > 0 ? ` Se conservaron ${piecesNow} piezas anteriores.` : ""} Haz clic para reanudar con la nueva directriz.`),
          };
        }
        if (requiresIntervention) {
          const errorLabel = lastErrorType === "COMPLIANCE_VIOLATION" ? t(" 🛡️ filtro de compliance", " 🛡️ compliance filter", " 🛡️ filtro de cumplimiento")
            : lastErrorType === "INVALID_INPUT_CONTEXT" ? t(" 📋 dados insuficientes no briefing", " 📋 insufficient information in the brief", " 📋 datos insuficientes en el briefing")
            : "";
          return {
            isIntervention: true, isRetry: false,
            label: t("Intervenção necessária", "Intervention required", "Se requiere intervención"),
            failedPieceType: failedPieceTypeRaw,
            description: failedPieceName
              ? t(`Pipeline travado em "${failedPieceName}" (${retryCountRaw}/10 tentativas${errorLabel}). ${piecesNow > 0 ? `${piecesNow} peça${piecesNow !== 1 ? "s" : ""} anteriores salvas. ` : ""}Pule esta peça ou ajuste o briefing.`, `Pipeline stuck at "${failedPieceName}" (${retryCountRaw}/10 attempts${errorLabel}). ${piecesNow > 0 ? `${piecesNow} previous piece${piecesNow !== 1 ? "s" : ""} saved. ` : ""}Skip this piece or adjust the brief.`, `El flujo está bloqueado en "${failedPieceName}" (${retryCountRaw}/10 intentos${errorLabel}). ${piecesNow > 0 ? `Se guardaron ${piecesNow} piezas anteriores. ` : ""}Omite esta pieza o ajusta el briefing.`)
              : t(`Pipeline travado após ${retryCountRaw} tentativas${errorLabel}. ${piecesNow > 0 ? `${piecesNow} peças salvas. ` : ""}Revise o briefing ou pule a peça problemática.`, `Pipeline stuck after ${retryCountRaw} attempts${errorLabel}. ${piecesNow > 0 ? `${piecesNow} pieces saved. ` : ""}Review the brief or skip the problematic piece.`, `El flujo está bloqueado tras ${retryCountRaw} intentos${errorLabel}. ${piecesNow > 0 ? `Se guardaron ${piecesNow} piezas. ` : ""}Revisa el briefing u omite la pieza problemática.`),
          };
        }
        if (genIsStale) {
          return {
            isRetry: true,
            label: t("Retomar Geração de Conteúdo", "Resume Content Generation", "Reanudar generación de contenido"),
            description: piecesNow > 0
              ? t(`Pipeline pausado — ${piecesNow} peça${piecesNow !== 1 ? "s" : ""} já salva${piecesNow !== 1 ? "s" : ""} e preservada${piecesNow !== 1 ? "s" : ""}. Clique para retomar somente as peças faltantes.`, `Pipeline paused — ${piecesNow} piece${piecesNow !== 1 ? "s" : ""} saved and preserved. Click to resume only the missing pieces.`, `Flujo pausado — ${piecesNow} pieza${piecesNow !== 1 ? "s" : ""} guardada${piecesNow !== 1 ? "s" : ""} y conservada${piecesNow !== 1 ? "s" : ""}. Haz clic para reanudar solo las piezas faltantes.`)
              : t("Pipeline pausado durante geração de conteúdo. Clique para retomar os agentes de conteúdo.", "Pipeline paused during content generation. Click to resume the content agents.", "El flujo se pausó durante la generación de contenido. Haz clic para reanudar los agentes de contenido."),
          };
        }
        return {
          label: t("Gerando...", "Generating...", "Generando..."),
          description: piecesNow > 0
            ? t(`${piecesNow} peça${piecesNow !== 1 ? "s" : ""} gerada${piecesNow !== 1 ? "s" : ""} até agora. Aguarde a conclusão de todas as peças...`, `${piecesNow} piece${piecesNow !== 1 ? "s" : ""} generated so far. Wait for all pieces to finish...`, `${piecesNow} pieza${piecesNow !== 1 ? "s" : ""} generada${piecesNow !== 1 ? "s" : ""} hasta ahora. Espera a que terminen todas...`)
            : t("Agentes criando copy, sequências e scripts personalizados. Aguarde.", "Agents are creating custom copy, sequences, and scripts. Please wait.", "Los agentes están creando textos, secuencias y guiones personalizados. Espera."),
          phase: undefined,
        };
      }
      case "compliance_review": {
        // Button hidden — ComplianceReviewModal handles resolution in both Fundador and Arquiteto views
        return null;
      }
      case "strategy_ready": return { phase: "content", label: t("Gerar Conteúdo", "Generate Content", "Generar contenido"), description: t("Estratégia validada pelos agentes. Clique para gerar as 16+ peças de conteúdo do lançamento.", "Strategy validated by agents. Click to generate the 16+ launch content pieces.", "Estrategia validada por los agentes. Haz clic para generar las más de 16 piezas de contenido del lanzamiento.") };
      case "awaiting_approval": {
        const piecesTotal = (previewContentData?.pieces ?? contentData?.pieces ?? []).length;
        return {
          href: `/campaigns/${campaignId}/content`,
          label: t("Aprovar Conteúdo", "Approve Content", "Aprobar contenido"),
          description: piecesTotal > 0
          ? t(`${piecesTotal} peça${piecesTotal !== 1 ? "s" : ""} gerada${piecesTotal !== 1 ? "s" : ""}. Revise e aprove antes do lançamento.`, `${piecesTotal} piece${piecesTotal !== 1 ? "s" : ""} generated. Review and approve before launch.`, `${piecesTotal} pieza${piecesTotal !== 1 ? "s" : ""} generada${piecesTotal !== 1 ? "s" : ""}. Revisa y aprueba antes del lanzamiento.`)
            : t("Conteúdo gerado. Revise e aprove antes do lançamento.", "Content generated. Review and approve it before launch.", "Contenido generado. Revísalo y apruébalo antes del lanzamiento."),
          phase: undefined,
        };
      }
      case "approved": return { phase: "launch", label: t("Lançar Campanha", "Launch Campaign", "Lanzar campaña"), description: t("Conteúdo aprovado. Inicie o lançamento.", "Content approved. Start the launch.", "Contenido aprobado. Inicia el lanzamiento.") };
      case "executing": return { href: `/war-room/${campaignId}`, label: t("Abrir War Room — Missão ao Vivo", "Open War Room — Live Mission", "Abrir War Room — Misión en vivo"), description: t("Campanha em execução. Acompanhe métricas, disparos e performance em tempo real.", "Campaign in progress. Track metrics, sends, and performance in real time.", "Campaña en ejecución. Sigue las métricas, los envíos y el rendimiento en tiempo real."), phase: undefined };
      case "live": return { href: `/war-room/${campaignId}`, label: t("War Room — Campanha ao Vivo 🔥", "War Room — Campaign Live 🔥", "War Room — Campaña en vivo 🔥"), description: t("Carrinho aberto. Acompanhe leads, vendas e performance em tempo real no War Room.", "Cart is open. Track leads, sales, and performance in real time in the War Room.", "El carrito está abierto. Sigue los prospectos, las ventas y el rendimiento en tiempo real en War Room."), phase: undefined };
      default: return null;
    }
  };
  const nextAction = getNextAction();

  // ── Fundador View — simplified, guided, emotional ────────────────────────────
  if (isFundador) {
    const FUNDADOR_STATUS: Record<string, { emoji: string; headline: string; desc: string }> = {
      analyzing:        { emoji: "🧠", headline: t("O time está estudando seu mercado", "The team is studying your market", "El equipo está estudiando tu mercado"), desc: t("Agentes de estratégia analisando seu produto, público e concorrência. Isso leva de 1 a 3 minutos.", "Strategy agents are analyzing your product, audience, and competitors. This takes 1 to 3 minutes.", "Los agentes de estrategia analizan tu producto, público y competencia. Esto toma de 1 a 3 minutos.") },
      strategy_ready:   { emoji: "📋", headline: t("Sua estratégia está pronta para revisar", "Your strategy is ready for review", "Tu estrategia está lista para revisar"), desc: t("O Estrategista montou o plano completo. Revise e confirme antes de gerar o conteúdo.", "The strategist built the complete plan. Review and confirm it before generating content.", "El estratega preparó el plan completo. Revísalo y confírmalo antes de generar el contenido.") },
      generating:       { emoji: "✍️", headline: t("Copywriters gerando seu conteúdo", "Copywriters are creating your content", "Los copywriters están creando tu contenido"), desc: t("Agentes criando copy, sequências e scripts personalizados para o seu público. Quase lá.", "Agents are creating copy, sequences, and scripts tailored to your audience. Almost there.", "Los agentes crean textos, secuencias y guiones personalizados para tu público. Ya casi.") },
      compliance_review:{ emoji: "🛡️", headline: t("Compliance precisa da sua decisão", "Compliance needs your decision", "Cumplimiento necesita tu decisión"), desc: t("O agente encontrou pontos que precisam ser revisados antes de prosseguir. Aceite as sugestões, ajuste ou autorize assim mesmo.", "The agent found items that need review before proceeding. Accept the suggestions, make adjustments, or authorize anyway.", "El agente encontró puntos que deben revisarse antes de continuar. Acepta las sugerencias, ajústalas o autoriza de todos modos.") },
      awaiting_approval:{ emoji: "👀", headline: t("Seu conteúdo está esperando por você", "Your content is waiting for you", "Tu contenido te está esperando"), desc: t("Tudo pronto! Revise e aprove o conteúdo gerado antes do lançamento.", "All set! Review and approve the generated content before launch.", "¡Todo listo! Revisa y aprueba el contenido generado antes del lanzamiento.") },
      approved:         { emoji: "📋", headline: t("Quase lá! Complete o checklist de lançamento", "Almost there! Complete the launch checklist", "¡Ya casi! Completa la lista de verificación del lanzamiento"), desc: t("Verifique integrações obrigatórias e criativos antes de lançar. Tudo está listado abaixo.", "Check required integrations and creatives before launch. Everything is listed below.", "Verifica las integraciones y piezas creativas obligatorias antes de lanzar. Todo está en la lista de abajo.") },
      executing:        { emoji: "⚡", headline: t("Campanha em execução", "Campaign in progress", "Campaña en ejecución"), desc: t("Os agentes estão disparando sequências e monitorando os resultados em tempo real.", "Agents are sending sequences and monitoring results in real time.", "Los agentes envían secuencias y supervisan los resultados en tiempo real.") },
      live:             { emoji: "🔥", headline: t("Campanha AO VIVO!", "Campaign is LIVE!", "¡Campaña EN VIVO!"), desc: t("Carrinho aberto. Seus leads estão recebendo os emails e mensagens agora.", "Cart is open. Your leads are receiving emails and messages now.", "El carrito está abierto. Tus prospectos están recibiendo correos y mensajes ahora.") },
      completed:        { emoji: "✅", headline: t("Lançamento concluído", "Launch complete", "Lanzamiento completado"), desc: t("Missão encerrada. Veja os resultados e comece o próximo lançamento.", "Mission complete. Review the results and start your next launch.", "Misión cumplida. Revisa los resultados y comienza el próximo lanzamiento.") },
    };
    const isStuck = nextAction?.isRetry === true;
    const piecesCountFundador = contentData?.pieces?.length ?? 0;
    const baseStatusInfo = FUNDADOR_STATUS[campaign.status] ?? { emoji: "⚙️", headline: localizedStatusLabel(t, campaign.status), desc: t("Processando...", "Processing...", "Procesando...") };
    const statusInfo = isStuck
      ? {
          emoji: "⚠️",
          headline: campaign.status === "generating" ? t("Geração pausada — retome", "Generation paused — resume", "Generación pausada — reanudar") : t("Pipeline parou — retome a análise", "Pipeline stopped — resume analysis", "El flujo se detuvo — reanuda el análisis"),
          desc: nextAction!.description,
        }
      : campaign.status === "generating" && piecesCountFundador > 0
      ? { ...baseStatusInfo, desc: t(`${piecesCountFundador} peça${piecesCountFundador !== 1 ? "s" : ""} gerada${piecesCountFundador !== 1 ? "s" : ""} até agora. Os agentes estão trabalhando nas demais.`, `${piecesCountFundador} piece${piecesCountFundador !== 1 ? "s" : ""} generated so far. The agents are working on the rest.`, `${piecesCountFundador} pieza${piecesCountFundador !== 1 ? "s" : ""} generada${piecesCountFundador !== 1 ? "s" : ""} hasta ahora. Los agentes siguen trabajando en las demás.`) }
      : campaign.status === "awaiting_approval" && piecesCountFundador > 0
      ? { ...baseStatusInfo, desc: t(`${piecesCountFundador} peça${piecesCountFundador !== 1 ? "s" : ""} prontas para sua revisão!`, `${piecesCountFundador} piece${piecesCountFundador !== 1 ? "s" : ""} ready for your review!`, `${piecesCountFundador} pieza${piecesCountFundador !== 1 ? "s" : ""} lista${piecesCountFundador !== 1 ? "s" : ""} para revisar.`) }
      : baseStatusInfo;

    const PHASE_MAP = [
      { statuses: ["analyzing"],                     label: t("Estratégia", "Strategy", "Estrategia") },
      { statuses: ["strategy_ready", "generating", "compliance_review"],  label: t("Conteúdo", "Content", "Contenido") },
      { statuses: ["awaiting_approval", "approved"], label: t("Aprovação", "Approval", "Aprobación") },
      { statuses: ["executing"],                     label: t("Execução", "Execution", "Ejecución") },
      { statuses: ["live", "completed"],             label: t("Resultado", "Results", "Resultados") },
    ];
    const currentPhaseIdx = PHASE_MAP.findIndex(p => p.statuses.includes(campaign.status));

    return (
      <div className="max-w-2xl mx-auto space-y-5 py-2">

        {/* Back */}
        <button onClick={() => setLocation("/campaigns")} className="flex items-center gap-1.5 text-muted-foreground/40 hover:text-muted-foreground/70 font-mono text-[11px] uppercase tracking-widest transition-colors">
          <span>←</span> Minhas Campanhas
        </button>

        {/* North Star — briefing sempre visível */}
        <CampaignNorthStar
          campaignId={campaignId}
          title={campaign.title ?? t("Campanha", "Campaign", "Campaña")}
          track={(campaignRaw["track"] as string | undefined) ?? null}
          status={campaign.status ?? ""}
          intakeData={intakeD}
          strategyData={strategyD}
        />

        {/* Status emocional */}
        <div className="border border-primary/30 bg-card/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/60" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/60" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary/60" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/60" />
          <div className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-3 truncate">
              {campaign.title}
            </div>
            <div className="flex items-start gap-4 mb-5">
              <span className="text-3xl shrink-0">{statusInfo.emoji}</span>
              <div className="flex-1">
                <h1 className="font-mono font-black text-lg md:text-xl uppercase tracking-tight text-foreground mb-1.5">
                  {statusInfo.headline}
                </h1>
                <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed">
                  {statusInfo.desc}
                </p>
                {(campaign.status === "analyzing" || campaign.status === "generating") && !isStuck && (() => {
                  const startTime = (brainDataRaw["pipelineCheckpoint"] as { lockedAt?: string } | undefined)?.lockedAt
                    ?? (campaignRaw["updatedAt"] as string | undefined);
                  if (!startTime) return null;
                  const elapsedMs = Date.now() - new Date(startTime).getTime();
                  const elapsedSec = Math.floor(elapsedMs / 1000);
                  const elapsedStr = elapsedSec < 60
                    ? `${elapsedSec}s`
                    : elapsedSec < 3600
                      ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
                      : `${Math.floor(elapsedSec / 3600)}h ${Math.floor((elapsedSec % 3600) / 60)}m`;
                  return (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground/30" />
                      <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
                        Em execução há {elapsedStr}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Progress bar por fase */}
            <div className="flex gap-1 mb-5">
              {PHASE_MAP.map((phase, idx) => (
                <div key={phase.label} className="flex-1 flex flex-col gap-1">
                  <div className={`h-1 transition-all ${
                    idx < currentPhaseIdx ? "bg-success" :
                    idx === currentPhaseIdx ? "bg-primary" :
                    "bg-border/30"
                  }`} />
                  <span className={`font-mono text-[9px] uppercase tracking-widest text-center ${
                    idx === currentPhaseIdx ? "text-primary font-bold" : "text-muted-foreground/30"
                  }`}>{phase.label}</span>
                </div>
              ))}
            </div>

            {/* Próxima ação — oculto quando approved (PreLaunchChecklist assume o controle) */}
            {nextAction && campaign.status !== "approved" && (
              <div className="flex flex-col sm:flex-row gap-2">
                {nextAction.isIntervention ? (
                  <>
                    {nextAction.failedPieceType && (
                      <Button
                        onClick={() => handleSkipPiece(nextAction.failedPieceType!)}
                        disabled={skipPending}
                        className="flex-1 rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm border border-orange-400/60 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20"
                      >
                        {skipPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                        {skipPending ? t("Pulando...", "Skipping...", "Omitiendo...") : t("Pular esta peça", "Skip this piece", "Omitir esta pieza")}
                      </Button>
                    )}
                    <Button
                      onClick={handleRetry}
                      disabled={retryPending}
                      variant="outline"
                      className="flex-1 rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm border-border/40 text-muted-foreground"
                    >
                      {retryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {retryPending ? "Tentando..." : "Tentar assim mesmo"}
                    </Button>
                  </>
                ) : nextAction.isRetry ? (
                  <Button
                    onClick={handleRetry}
                    disabled={retryPending}
                    className="flex-1 rounded-none font-mono uppercase tracking-widest font-black gap-2 h-12 text-sm border border-yellow-400/60 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20"
                  >
                    {retryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {retryPending ? "Retomando..." : nextAction.label}
                  </Button>
                ) : nextAction.href ? (
                  <Link href={nextAction.href} className="flex-1">
                    <Button className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm">
                      {nextAction.label}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : nextAction.phase ? (
                  <Button
                    onClick={() => handleExecuteClick(nextAction.phase!)}
                    disabled={executeMutation.isPending}
                    className="flex-1 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
                  >
                    {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {executeMutation.isPending ? "Processando..." : nextAction.label}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button disabled className="flex-1 rounded-none font-mono uppercase tracking-widest h-12 text-sm opacity-50">
                    {nextAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Psychology Layer Missing Warning ─────────────────────────────────── */}
        {(() => {
          const plm = (brainDataRaw["psychologyLayerMissing"] ?? null) as Record<string, unknown> | null;
          if (!plm) return null;
          const missingAgents = (plm["missingAgents"] as string[] | undefined) ?? [];
          const detectedAt = plm["at"] as string | undefined;
          return (
            <div className="border border-rose-400/30 bg-rose-400/[0.04] rounded-none">
              <div className="px-4 py-3 border-b border-rose-400/30 flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-rose-400 font-bold flex-1">
                  {t("Agentes de Psicologia de Oferta Ausentes", "Missing Offer Psychology Agents", "Faltan agentes de psicología de ofertas")}
                </span>
                {detectedAt && (
                  <span className="font-mono text-[9px] text-rose-400/50 uppercase tracking-widest">
                    {new Date(detectedAt).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
                  {t("Os agentes de psicologia de oferta não foram executados durante a fase de estratégia.", "Offer psychology agents did not run during the strategy phase.", "Los agentes de psicología de ofertas no se ejecutaron durante la fase de estrategia.")}
                  {" "}{t("Os agentes de copy", "Copy agents", "Los agentes de textos")} (<strong className="text-foreground/80">{t("Anúncios, VSL, Página de Vendas", "Ads, VSL, Sales Page", "Anuncios, VSL, Página de ventas")}</strong>) {t("precisam dessas análises para gerar copy com pricing, objections e hooks otimizados.", "need these analyses to create copy with optimized pricing, objections, and hooks.", "necesitan estos análisis para crear textos con precios, objeciones y ganchos optimizados.")}
                </p>
                {missingAgents.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-rose-400/70 mb-2">
                      {t("Agentes em falta:", "Missing agents:", "Agentes faltantes:")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingAgents.map((agent) => (
                        <span
                          key={agent}
                          className="font-mono text-[10px] px-2 py-0.5 border border-rose-400/30 text-rose-300/80 bg-rose-400/5"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecuteClick("strategy")}
                    disabled={executeMutation.isPending}
                    className="rounded-none font-mono uppercase tracking-widest font-black gap-2 text-xs border-rose-400/40 text-rose-300 hover:bg-rose-400/10"
                  >
                    {executeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {executeMutation.isPending ? t("Executando estratégia...", "Running strategy...", "Ejecutando estrategia...") : t("Re-executar fase de estratégia", "Run strategy phase again", "Volver a ejecutar la fase de estrategia")}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── Avaliação Mercadológica — shown when market validation has a result ─── */}
        {(() => {
          const mv = (brainDataRaw["marketValidation"] ?? null) as Record<string, unknown> | null;
          if (!mv || !mv["overallVerdict"]) return null;
          return (
            <>
              <MarketValidationReview
                campaignId={campaignId}
                marketValidation={mv as any}
                onProceed={() => void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })}
              />

              {/* ─── Linha do tempo: Alertas regulatórios confirmados ─── */}
              {mv["acknowledgmentRecordedAt"] && (() => {
                const validators = (mv["validators"] as Array<Record<string, unknown>> | undefined) ?? [];
                const confirmedAlerts = validators
                  .filter((v) => v["requiresAcknowledgment"])
                  .flatMap((v) => (v["regulatoryAlerts"] as string[] | undefined) ?? []);
                const acknowledgedAt = mv["acknowledgmentRecordedAt"] as string;
                return (
                  <div className="border border-orange-400/15 bg-orange-400/[0.03] rounded-none">
                    {/* Timeline header */}
                    <div className="px-4 py-3 border-b border-orange-400/15 flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-orange-400/70 flex-shrink-0" />
                      <span className="font-mono text-[11px] uppercase tracking-widest text-orange-400/80 font-bold flex-1">
                         {t("Histórico de Conformidade Regulatória", "Regulatory Compliance History", "Historial de cumplimiento normativo")}
                      </span>
                       <span className="font-mono text-[9px] text-orange-400/40 uppercase tracking-widest">{t("IMUTÁVEL", "IMMUTABLE", "INMUTABLE")}</span>
                    </div>

                    {/* Timeline event */}
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div className="flex flex-col items-center mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-orange-400/70 flex-shrink-0" />
                        {confirmedAlerts.length > 0 && (
                          <div className="w-px flex-1 bg-orange-400/15 mt-1 min-h-[1.5rem]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="font-mono text-[11px] font-bold text-foreground/80">
                             {t("Alertas regulatórios confirmados", "Regulatory alerts confirmed", "Alertas normativas confirmadas")}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground/50">
                            {new Date(acknowledgedAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                             {" · "}{t("Self-proof gravado e imutável", "Self-proof recorded and immutable", "Autoprueba registrada e inmutable")}
                          </p>
                        </div>

                        {confirmedAlerts.length > 0 && (
                          <div className="space-y-1">
                            {confirmedAlerts.map((alert, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-orange-200/55 leading-relaxed">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5 text-orange-400/40" />
                                {alert}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}

        {/* ─── Compliance Resolution (Fundador) — shown when pipeline is paused for compliance ─── */}
        {campaign.status === "compliance_review" && (() => {
          const cr = (brainDataRaw["complianceReview"] ?? null) as Record<string, unknown> | null;
          if (!cr || !cr["violations"]) return null;
          return (
            <ComplianceReviewModal
              campaignId={campaignId}
              complianceReview={cr as any}
              onResolved={() => void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })}
            />
          );
        })()}

        {/* ─── Acesso Rápido a Criativos (Fundador) ─────────────────────────────── */}
        {["awaiting_approval","approved","executing","live","completed"].includes(campaign.status) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link href={`/campaigns/${campaignId}/control-room`}>
              <div className="border border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10 transition-all px-4 py-3 flex items-center gap-3 cursor-pointer group h-full">
                <div className="w-8 h-8 border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary/60 transition-colors">
                  <Activity className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-bold text-primary/80 uppercase tracking-widest group-hover:text-primary transition-colors">
                    Control Room
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/45">
                     {t("Monitorar trabalho, evidências e operação", "Monitor work, evidence, and operations", "Supervisa el trabajo, la evidencia y las operaciones")}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-primary/30 group-hover:text-primary/70 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
            <Link href={`/campaigns/${campaignId}/content`} className="flex-1">
              <div className="border border-border/30 bg-card/20 hover:border-primary/40 hover:bg-primary/5 transition-all px-4 py-3 flex items-center gap-3 cursor-pointer group">
                <div className="w-8 h-8 border border-border/30 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/70 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-bold text-foreground/70 uppercase tracking-widest group-hover:text-primary/80 transition-colors">
                     {t("Criativos & Conteúdo", "Creatives & Content", "Creatividades y contenido")}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/40">
                    {(previewContentData?.pieces ?? contentData?.pieces ?? []).length > 0
                       ? t(`${(previewContentData?.pieces ?? contentData?.pieces ?? []).length} peça(s) gerada(s) — clique para visualizar e aprovar`, `${(previewContentData?.pieces ?? contentData?.pieces ?? []).length} piece(s) generated — click to review and approve`, `${(previewContentData?.pieces ?? contentData?.pieces ?? []).length} pieza(s) generada(s) — haz clic para revisar y aprobar`)
                       : t("Visualizar e aprovar conteúdo gerado pelos agentes", "Review and approve agent-generated content", "Revisar y aprobar el contenido generado por los agentes")}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
            <Link href="/integracoes">
              <div className="border border-border/30 bg-card/20 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all px-4 py-3 flex items-center gap-3 cursor-pointer group h-full">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-cyan-400/70 transition-colors shrink-0" />
                <span className="font-mono text-[11px] text-muted-foreground/50 group-hover:text-cyan-400/80 transition-colors uppercase tracking-widest whitespace-nowrap">
                   {t("Redes Sociais", "Social Networks", "Redes sociales")}
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* ─── Reset de Status (campanha incorretamente Ao Vivo) ────────────────── */}
        {(campaign.status === "live" || campaign.status === "executing") && (
          <details className="group">
            <summary className="cursor-pointer font-mono text-[10px] text-muted-foreground/20 hover:text-muted-foreground/40 uppercase tracking-widest select-none transition-colors list-none flex items-center gap-2 py-1">
              <span className="group-open:hidden">▸ {t("Opções avançadas", "Advanced options", "Opciones avanzadas")}</span>
              <span className="hidden group-open:inline">▾ {t("Opções avançadas", "Advanced options", "Opciones avanzadas")}</span>
            </summary>
            <div className="mt-2 border border-border/20 bg-card/10 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                 <div className="font-mono text-[11px] font-bold text-muted-foreground/50">{t("Reverter para Aprovação", "Revert to Approval", "Volver a aprobación")}</div>
                <div className="font-mono text-[10px] text-muted-foreground/30 mt-0.5">
                   {t("Retorna a campanha para revisão de conteúdo. Use se o status estiver incorreto.", "Returns the campaign to content review. Use if the status is incorrect.", "Devuelve la campaña a revisión de contenido. Úsalo si el estado es incorrecto.")}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await customFetch(`/api/campaigns/${campaignId}/status`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "awaiting_approval" }),
                    });
                     toast.success(t("Campanha revertida para aprovação", "Campaign reverted to approval", "Campaña devuelta a aprobación"));
                    queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
                  } catch { toast.error(t("Erro ao reverter status", "Error reverting status", "Error al revertir el estado")); }
                }}
                className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 border border-border/30 text-muted-foreground/40 hover:text-orange-400/70 hover:border-orange-400/40 shrink-0"
              >
                 {t("Reverter Status", "Revert Status", "Revertir estado")}
              </Button>
            </div>
          </details>
        )}

        {/* ─── Pré-Lançamento: Checklist Obrigatório (status approved) ─────── */}
        {campaign.status === "approved" && (
          <PreLaunchChecklist
            campaignId={campaignId}
            onLaunchReady={setLaunchReady}
            onLaunch={() => setShowAuditScanner(true)}
            launching={executeMutation.isPending}
            plannedChannels={(brainDataRaw["plannedChannels"] as string[] | undefined)}
          />
        )}

        {/* Revisão de Estratégia — obrigatório revisar antes de gerar conteúdo */}
        {campaign.status === "strategy_ready" && Object.keys(strategyD).length > 0 && (() => {
          const ins = parseStrategyInsights(strategyD);
          return (
            <div className="border border-cyan-400/25 bg-cyan-400/[0.03] overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-cyan-400/25 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-bold flex-1">
                   {t("Masterplan da Campanha — Revise antes de aprovar", "Campaign Masterplan — Review before approval", "Plan maestro de campaña — Revisa antes de aprobar")}
                </span>
                 <span className="font-mono text-[9px] text-cyan-400/50 uppercase tracking-widest">{t("AGUARDANDO APROVAÇÃO", "AWAITING APPROVAL", "ESPERANDO APROBACIÓN")}</span>
              </div>

              {/* Masterplan completo */}
              <div className="p-4">
                <StrategyMasterplan
                  strategyD={strategyD}
                  ins={ins}
                  campaignId={campaignId}
                  campaignTitle={String(intakeD["product.name"] ?? campaign.title ?? "")}
                  track={String(intakeD["launch.track"] ?? "")}
                  userIdentity={user ? {
                    name: user.name ?? "",
                    email: user.email ?? "",
                    userId: user.id,
                    workspaceName: workspace?.name ?? "",
                    workspaceId: workspace?.id ?? "",
                  } : undefined}
                />
              </div>

              {/* Botão de aprovação */}
              <div className="px-4 pb-4 pt-2 border-t border-cyan-400/15">
                <p className="font-mono text-[10px] text-muted-foreground/40 mb-3 text-center">
                   {t("Revise o plano acima e aprove para gerar o conteúdo das plataformas", "Review the plan above and approve it to generate platform content", "Revisa el plan anterior y apruébalo para generar contenido para las plataformas")}
                </p>
                {nextAction?.phase ? (
                  <Button
                    onClick={() => handleExecuteClick(nextAction.phase!)}
                    disabled={executeMutation.isPending}
                    className="w-full rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-12 text-sm"
                  >
                    {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                     {executeMutation.isPending ? t("Gerando conteúdo...", "Generating content...", "Generando contenido...") : `✓ ${t("Aprovar Estratégia e Gerar Conteúdo", "Approve Strategy and Generate Content", "Aprobar estrategia y generar contenido")}`}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })()}

        {/* Agentes — live feed com ícones e pensamentos expansíveis (só quando há atividade real) */}
        {(isActive || liveEvents.length > 0) && (
          <AgentLiveFeed
            events={liveEvents}
            dbAgents={agentsData?.agents ?? []}
            compact
          />
        )}

        {/* Ver visão completa */}
        <div className="text-center pt-2 pb-1">
          <span className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest">
             {t("Quer ver todos os dados técnicos?", "Want to see all technical data?", "¿Quieres ver todos los datos técnicos?")}{" "}
            <button
              onClick={() => setMode("arquiteto")}
              className="text-primary/50 hover:text-primary underline underline-offset-2 transition-colors"
            >
               {t("Mude para modo Arquiteto", "Switch to Architect mode", "Cambiar al modo Arquitecto")}
            </button>
          </span>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "comando" as const, label: "Comando", icon: Zap },
    { id: "agentes" as const, label: "Agentes", icon: Bot },
    { id: "estrategia" as const, label: "Masterplan", icon: BookOpen },
    { id: "conteudo" as const, label: t("Conteúdo", "Content", "Contenido"), icon: Layers },
    { id: "galeria" as const, label: "Galeria", icon: Image },
    { id: "metricas" as const, label: t("Métricas", "Metrics", "Métricas"), icon: BarChart3 },
    { id: "grupos" as const, label: "Grupos", icon: Users },
  ];

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">

      {/* ── Compliance Review Modal ── */}
      {campaign.status === "compliance_review" && (() => {
        const cr = (brainDataRaw["complianceReview"] ?? null) as Record<string, unknown> | null;
        if (!cr || !cr["violations"]) return null;
        return (
          <ComplianceReviewModal
            campaignId={campaignId}
            complianceReview={cr as any}
            onResolved={() => void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) })}
          />
        );
      })()}

      {/* ── Launch Sequence Overlay ── */}
      {showLaunchSequence && (
        <LaunchSequenceOverlay
          campaignId={campaignId}
          campaignTitle={campaign.title ?? "Campanha"}
          connectedProviders={connectedProviders}
          onClose={() => setShowLaunchSequence(false)}
        />
      )}

      {/* ── Launch Audit Scanner — cinematic pre-launch gate ── */}
      {showAuditScanner && (
        <LaunchAuditScanner
          campaignId={campaignId}
          campaignName={campaign.title ?? "Campanha"}
          intakeData={intakeD}
          onClose={() => setShowAuditScanner(false)}
          onConfirmLaunch={() => {
            setShowAuditScanner(false);
            handleExecuteClick("launch");
          }}
          launching={executeMutation.isPending}
        />
      )}

      {/* ── Missing / Partial Integrations Guide Modal ── */}
      {missingIntegrations && !connectingEntry && (() => {
        const SETUP_GUIDE: Record<string, { title: string; steps: string[]; url: string; urlLabel: string }> = {
          "WhatsApp Business": {
            title: "WhatsApp Business API",
            steps: [
              t("Acesse business.whatsapp.com e crie uma conta Meta Business", "Go to business.whatsapp.com and create a Meta Business account", "Ve a business.whatsapp.com y crea una cuenta de Meta Business"),
              t("Vá em Ferramentas → WhatsApp → Adicionar número de telefone", "Go to Tools → WhatsApp → Add phone number", "Ve a Herramientas → WhatsApp → Añadir número de teléfono"),
              t("Siga o assistente para verificar o número (SMS ou ligação)", "Follow the wizard to verify the number (SMS or call)", "Sigue el asistente para verificar el número (SMS o llamada)"),
              t("Em Configurações do App → Copie o Token de Acesso Permanente + Phone Number ID", "In App Settings → Copy the Permanent Access Token + Phone Number ID", "En Configuración de la app → Copia el token de acceso permanente + Phone Number ID"),
              t("Cole as credenciais em Configurações → Integrações → WhatsApp Business", "Paste the credentials in Settings → Integrations → WhatsApp Business", "Pega las credenciales en Configuración → Integraciones → WhatsApp Business"),
            ],
            url: "https://business.whatsapp.com/start",
            urlLabel: "Abrir Meta Business",
          },
          "Telegram": {
            title: "Bot do Telegram",
            steps: [
              t("Abra o Telegram e pesquise @BotFather", "Open Telegram and search for @BotFather", "Abre Telegram y busca @BotFather"),
              t("Envie o comando /newbot", "Send the /newbot command", "Envía el comando /newbot"),
              t("Escolha um nome e username para o bot (deve terminar em 'bot')", "Choose a name and username for the bot (must end in 'bot')", "Elige un nombre y usuario para el bot (debe terminar en 'bot')"),
              t("Copie o token gerado (formato: 123456:ABC-DEF...)", "Copy the generated token (format: 123456:ABC-DEF...)", "Copia el token generado (formato: 123456:ABC-DEF...)"),
              t("Cole o token em Configurações → Integrações → Telegram", "Paste the token in Settings → Integrations → Telegram", "Pega el token en Configuración → Integraciones → Telegram"),
            ],
            url: "https://t.me/BotFather",
            urlLabel: "Abrir BotFather",
          },
          "RD Station": {
            title: "RD Station Marketing",
            steps: [
              t("Acesse app.rdstation.com e crie sua conta (gratuito)", "Go to app.rdstation.com and create your account (free)", "Ve a app.rdstation.com y crea tu cuenta (gratis)"),
              t("Vá em Configurações → Integrações → API", "Go to Settings → Integrations → API", "Ve a Configuración → Integraciones → API"),
              t("Gere um novo token de API", "Generate a new API token", "Genera un nuevo token de API"),
              t("Copie o token gerado", "Copy the generated token", "Copia el token generado"),
              t("Cole em Configurações → Integrações → RD Station", "Paste it in Settings → Integrations → RD Station", "Pégalo en Configuración → Integraciones → RD Station"),
            ],
            url: "https://app.rdstation.com",
            urlLabel: "Abrir RD Station",
          },
          "ActiveCampaign": {
            title: "ActiveCampaign",
            steps: [
              t("Acesse activecampaign.com e crie sua conta", "Go to activecampaign.com and create your account", "Ve a activecampaign.com y crea tu cuenta"),
              t("Clique no menu do usuário → Minha Conta → Developer", "Click the user menu → My Account → Developer", "Haz clic en el menú de usuario → Mi cuenta → Developer"),
              t("Copie a URL da API e a Chave de API", "Copy the API URL and API Key", "Copia la URL de la API y la clave de API"),
              t("Cole ambas em Configurações → Integrações → ActiveCampaign", "Paste both in Settings → Integrations → ActiveCampaign", "Pega ambas en Configuración → Integraciones → ActiveCampaign"),
            ],
            url: "https://www.activecampaign.com",
            urlLabel: "Abrir ActiveCampaign",
          },
        };

        const findGuide = (name: string) => {
          const lower = name.toLowerCase();
          return Object.entries(SETUP_GUIDE).find(([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()))?.[1];
        };

        return (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="border border-primary/30 bg-card w-full max-w-xl shadow-2xl max-h-[92vh] flex flex-col">
              {/* Header */}
              <div className="border-b border-border/40 px-6 py-5 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70 mb-1">{t("Pré-lançamento obrigatório", "Required before launch", "Obligatorio antes del lanzamiento")}</div>
                  <h3 className="font-mono font-bold text-base uppercase tracking-tight text-foreground">{t("Conectar canais de disparo", "Connect Messaging Channels", "Conectar canales de envío")}</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-1 leading-relaxed">
                    {t("Sem pelo menos um canal de mensagens e um de e-mail, a agente não consegue disparar a sequência de lançamento. Siga o guia abaixo para conectar.", "Without at least one messaging channel and one email channel, the agent cannot send the launch sequence. Follow the guide below to connect them.", "Sin al menos un canal de mensajería y uno de correo, el agente no puede enviar la secuencia de lanzamiento. Sigue la guía a continuación para conectarlos.")}
                  </p>
                </div>
                <button onClick={() => setMissingIntegrations(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-1">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step-by-step guides */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {missingIntegrations.map(m => (
                  <div key={m.category}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-5 bg-primary/60" />
                      <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80">{m.category}</div>
                      <div className="flex-1 h-px bg-border/20" />
                    </div>
                    {m.reason && (
                      <p className="font-mono text-[11px] text-muted-foreground/50 mb-4 px-1">{m.reason}</p>
                    )}

                    {/* Platform options for this category */}
                    <div className="space-y-4">
                      {m.providers.map((providerName, pi) => {
                        const guide = findGuide(providerName);
                        return (
                          <div key={providerName} className="border border-border/30 bg-card/40">
                            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {m.providers.length > 1 && (
                                  <span className="font-mono text-[10px] text-primary/60 uppercase tracking-widest border border-primary/30 bg-primary/5 px-1.5 py-0.5">
                                    {t("Opção", "Option", "Opción")} {pi + 1}
                                  </span>
                                )}
                                <span className="font-mono text-xs font-bold text-foreground">{guide?.title ?? providerName}</span>
                              </div>
                              {guide && (
                                <a
                                  href={guide.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                                >
                                  {guide.urlLabel} ↗
                                </a>
                              )}
                            </div>
                            {guide ? (
                              <ol className="p-4 space-y-2">
                                {guide.steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-3">
                                    <span className="font-mono text-[10px] text-primary/60 bg-primary/10 border border-primary/20 w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                      {i + 1}
                                    </span>
                                    <span className="font-mono text-[12px] text-muted-foreground/80 leading-relaxed">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="p-4 font-mono text-[11px] text-muted-foreground/60">
                                {t("Acesse Configurações → Integrações para conectar este canal.", "Go to Settings → Integrations to connect this channel.", "Ve a Configuración → Integraciones para conectar este canal.")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer CTA */}
              <div className="border-t border-border/40 px-6 py-4 shrink-0 flex gap-3">
                <Link href="/integracoes" className="flex-1">
                  <Button
                    onClick={() => setMissingIntegrations(null)}
                    className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 text-[11px]"
                  >
                    <Link2 className="h-4 w-4" />{t("Ir para Integrações", "Go to Integrations", "Ir a Integraciones")}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setMissingIntegrations(null)}
                  className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-5 text-[11px]"
                >
                  {t("Fechar", "Close", "Cerrar")}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Partial Integrations Guide Modal (canais incompletos) ── */}
      {partialIntegrations && showPartialGuide && (() => {
        const SETUP_GUIDE: Record<string, { title: string; steps: string[]; url: string; urlLabel: string }> = {
          "WhatsApp Business": {
            title: "WhatsApp Business API",
            steps: [
              t("Acesse business.whatsapp.com → Meta Business Suite", "Go to business.whatsapp.com → Meta Business Suite", "Ve a business.whatsapp.com → Meta Business Suite"),
              t("Adicione e verifique um número de telefone dedicado", "Add and verify a dedicated phone number", "Añade y verifica un número de teléfono exclusivo"),
              t("Copie o Token de Acesso Permanente + Phone Number ID", "Copy the Permanent Access Token + Phone Number ID", "Copia el token de acceso permanente + Phone Number ID"),
              t("Cole em Configurações → Integrações → WhatsApp Business", "Paste in Settings → Integrations → WhatsApp Business", "Pega en Configuración → Integraciones → WhatsApp Business"),
            ],
            url: "https://business.whatsapp.com/start",
            urlLabel: "Abrir Meta Business",
          },
          "Telegram": {
            title: "Bot do Telegram",
            steps: [
              t("Abra o Telegram → pesquise @BotFather", "Open Telegram → search for @BotFather", "Abre Telegram → busca @BotFather"),
              t("Envie /newbot → escolha nome e username", "Send /newbot → choose a name and username", "Envía /newbot → elige un nombre y usuario"),
              t("Copie o token gerado pelo BotFather", "Copy the token generated by BotFather", "Copia el token generado por BotFather"),
              t("Cole em Configurações → Integrações → Telegram", "Paste in Settings → Integrations → Telegram", "Pega en Configuración → Integraciones → Telegram"),
            ],
            url: "https://t.me/BotFather",
            urlLabel: "Abrir BotFather",
          },
          "RD Station": {
            title: "RD Station Marketing",
            steps: [
              t("Acesse app.rdstation.com → Configurações → API", "Go to app.rdstation.com → Settings → API", "Ve a app.rdstation.com → Configuración → API"),
              t("Gere e copie o token de integração", "Generate and copy the integration token", "Genera y copia el token de integración"),
              t("Cole em Configurações → Integrações → RD Station", "Paste in Settings → Integrations → RD Station", "Pega en Configuración → Integraciones → RD Station"),
            ],
            url: "https://app.rdstation.com",
            urlLabel: "Abrir RD Station",
          },
          "ActiveCampaign": {
            title: "ActiveCampaign",
            steps: [
              t("Acesse sua conta → Configurações → Developer", "Go to your account → Settings → Developer", "Ve a tu cuenta → Configuración → Developer"),
              t("Copie a API URL e a Chave de API", "Copy the API URL and API Key", "Copia la URL de la API y la clave de API"),
              t("Cole em Configurações → Integrações → ActiveCampaign", "Paste in Settings → Integrations → ActiveCampaign", "Pega en Configuración → Integraciones → ActiveCampaign"),
            ],
            url: "https://www.activecampaign.com",
            urlLabel: "Abrir ActiveCampaign",
          },
        };
        const findGuide = (name: string) =>
          Object.entries(SETUP_GUIDE).find(([k]) => k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase()))?.[1];

        return (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="border border-yellow-400/30 bg-card w-full max-w-xl shadow-2xl max-h-[92vh] flex flex-col">
              <div className="border-b border-yellow-400/20 px-6 py-5 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 mb-1">Cobertura incompleta</div>
                  <h3 className="font-mono font-bold text-base uppercase tracking-tight text-foreground">Canais parcialmente conectados</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-1 leading-relaxed">
                    Alguns canais ainda não estão conectados. A agente pode lançar, mas disparos para esses canais não serão enviados. Conecte antes para máxima cobertura.
                  </p>
                </div>
                <button onClick={() => { setShowPartialGuide(false); setPartialIntegrations(null); }} className="text-muted-foreground hover:text-foreground shrink-0 mt-1">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {partialIntegrations.map(m => (
                  <div key={m.category}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-5 bg-yellow-400/60" />
                      <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80">{m.category}</div>
                      <div className="flex-1 h-px bg-border/20" />
                    </div>
                    {m.reason && <p className="font-mono text-[11px] text-muted-foreground/50 mb-4 px-1">{m.reason}</p>}
                    <div className="space-y-4">
                      {m.providers.map((providerName, pi) => {
                        const guide = findGuide(providerName);
                        return (
                          <div key={providerName} className="border border-border/30 bg-card/40">
                            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {m.providers.length > 1 && (
                                  <span className="font-mono text-[10px] text-yellow-400/60 uppercase tracking-widest border border-yellow-400/30 bg-yellow-400/5 px-1.5 py-0.5">
                                    Opção {pi + 1}
                                  </span>
                                )}
                                <span className="font-mono text-xs font-bold text-foreground">{guide?.title ?? providerName}</span>
                              </div>
                              {guide && (
                                <a href={guide.url} target="_blank" rel="noopener noreferrer"
                                  className="font-mono text-[10px] uppercase tracking-widest text-yellow-400 hover:underline flex items-center gap-1">
                                  {guide.urlLabel} ↗
                                </a>
                              )}
                            </div>
                            {guide ? (
                              <ol className="p-4 space-y-2">
                                {guide.steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-3">
                                    <span className="font-mono text-[10px] text-yellow-400/60 bg-yellow-400/10 border border-yellow-400/20 w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                      {i + 1}
                                    </span>
                                    <span className="font-mono text-[12px] text-muted-foreground/80 leading-relaxed">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="p-4 font-mono text-[11px] text-muted-foreground/60">
                                Acesse Configurações → Integrações para conectar este canal.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/40 px-6 py-4 shrink-0 flex gap-3">
                <Link href="/integracoes" className="flex-1">
                  <Button
                    onClick={() => { setShowPartialGuide(false); setPartialIntegrations(null); }}
                    className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 text-[11px]"
                  >
                    <Link2 className="h-4 w-4" />Conectar Canais
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => { setShowPartialGuide(false); setPartialIntegrations(null); }}
                  className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-5 text-[11px]"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Launch Fee Confirmation Modal (R$497/launch) ── */}
      {showLaunchFeeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-primary/40 bg-card w-full max-w-md shadow-2xl">
            <div className="border-b border-primary/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                  <Rocket className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-primary">{t("Confirmar Lançamento", "Confirm Launch", "Confirmar lanzamiento")}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">{t("Taxa de execução por lançamento", "Execution fee per launch", "Tarifa de ejecución por lanzamiento")}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowLaunchFeeModal(false); setPendingStrategyFn(null); }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border border-primary/20 bg-primary/5 px-4 py-3">
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Taxa de lançamento", "Launch fee", "Tarifa de lanzamiento")}</div>
                  <div className="font-mono text-2xl font-bold text-primary mt-0.5">R$497</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60">{t("por lançamento executado", "per launch executed", "por lanzamiento ejecutado")}</div>
                </div>
                <div className="font-mono text-[10px] text-right text-muted-foreground/70 space-y-1">
                  <div>✓ {t("64 agentes ativados", "64 agents activated", "64 agentes activados")}</div>
                  <div>✓ {t("Estratégia + copy completos", "Complete strategy + copy", "Estrategia y textos completos")}</div>
                  <div>✓ {t("Sequência de email + WhatsApp", "Email + WhatsApp sequence", "Secuencia de correo y WhatsApp")}</div>
                  <div>✓ {t("Relatório pós-lançamento", "Post-launch report", "Informe posterior al lanzamiento")}</div>
                </div>
              </div>
              <div className="border border-border/30 bg-muted/20 px-4 py-3 space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">{t("Recorrência mensal opcional", "Optional monthly subscription", "Suscripción mensual opcional")}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  R$1.250/mês — acesso ilimitado a lançamentos + automação contínua
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/50">{t("Disponível em Planos após o primeiro lançamento.", "Available in Plans after the first launch.", "Disponible en Planes después del primer lanzamiento.")}</div>
              </div>
            </div>
            <div className="border-t border-border/30 px-5 py-4 flex gap-3">
              <button
                onClick={() => { setShowLaunchFeeModal(false); setPendingStrategyFn(null); }}
                className="flex-1 font-mono text-xs uppercase tracking-widest border border-border/50 hover:border-border px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("Cancelar", "Cancel", "Cancelar")}
              </button>
              <button
                onClick={async () => {
                  setShowLaunchFeeModal(false);
                  if (pendingStrategyFn) {
                    await pendingStrategyFn();
                    setPendingStrategyFn(null);
                  }
                }}
                className="flex-1 font-mono text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 transition-colors flex items-center justify-center gap-2"
              >
                <Rocket className="h-3.5 w-3.5" />
                {t("Confirmar", "Confirm", "Confirmar")} — R$497
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-orange-400">{t("Reorientar Estratégia", "Redirect Strategy", "Reorientar estrategia")}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">{t("O agente vai apagar tudo e reconstruir do zero com sua nova direção.", "The agent will clear everything and rebuild from scratch using your new direction.", "El agente borrará todo y reconstruirá desde cero con tu nueva orientación.")}</p>
                </div>
              </div>
              <button onClick={() => { setReorientOpen(false); setReorientDirective(""); }} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400/70 font-bold">{t("O que vai acontecer", "What will happen", "Qué sucederá")}</div>
                <ul className="space-y-1">
                  {[
                    t("Estratégia atual será descartada", "Current strategy will be discarded", "Se descartará la estrategia actual"),
                    t("Todos os conteúdos gerados serão removidos", "All generated content will be removed", "Se eliminará todo el contenido generado"),
                    t("A agente relerá seu briefing + nova direção", "The agent will reread your brief and new direction", "El agente volverá a leer tu briefing y la nueva orientación"),
                    t("Estratégia e copy serão reconstruídos do zero", "Strategy and copy will be rebuilt from scratch", "La estrategia y los textos se reconstruirán desde cero"),
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 font-mono text-[11px] text-muted-foreground/70">
                      <span className="text-orange-400/60 shrink-0 mt-0.5">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">
                  {t("Sua nova direção — seja específico sobre o ângulo, posicionamento ou narrativa", "Your new direction — be specific about the angle, positioning, or narrative", "Tu nueva orientación — especifica el enfoque, posicionamiento o narrativa")}
                </label>
                <textarea
                  value={reorientDirective}
                  onChange={e => setReorientDirective(e.target.value)}
                  placeholder={t("Ex: Percebi que meu público-alvo tem medo de falhar, não medo de perder dinheiro. Quero mudar o ângulo de toda a campanha para transformação pessoal e superação do medo, com uma narrativa mais emocional. O produto passa a ser vendido como uma virada de chave, não uma ferramenta técnica.", "E.g.: I realized my audience fears failure more than losing money. I want to shift the whole campaign toward personal transformation and overcoming fear, with a more emotional story. Present the product as a turning point, not a technical tool.", "Ej.: Me di cuenta de que mi público teme fracasar más que perder dinero. Quiero orientar toda la campaña hacia la transformación personal y la superación del miedo, con una narrativa más emotiva. Presentar el producto como un punto de inflexión, no como una herramienta técnica.")}
                  rows={6}
                  className="w-full bg-muted/10 border border-border/50 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-orange-500/50 focus:bg-orange-500/5 transition-colors"
                />
                <div className={`font-mono text-[10px] mt-1 text-right transition-colors ${reorientDirective.length < 10 ? "text-muted-foreground/40" : "text-orange-400/60"}`}>
                  {reorientDirective.length} {t("caracteres", "characters", "caracteres")} {reorientDirective.length < 10 && t("(mínimo 10)", "(minimum 10)", "(mínimo 10)")}
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
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Reorientando...", "Redirecting...", "Reorientando...")}</>
                  : <><RefreshCw className="h-3.5 w-3.5" />{t("Reorientar e Reconstruir", "Redirect and Rebuild", "Reorientar y reconstruir")}</>
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => { setReorientOpen(false); setReorientDirective(""); }}
                disabled={reorientMutation.isPending}
                className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 px-4 text-xs"
              >
                {t("Cancelar", "Cancel", "Cancelar")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingExecutionPhase && autonomyStatus && (
        <AutonomyAcceptanceModal
          campaignId={campaignId}
          autonomyStatus={autonomyStatus}
          onSuccess={() => {
            executeMutation.mutate({ campaignId, data: { phase: pendingExecutionPhase } });
            setPendingExecutionPhase(null);
          }}
          onCancel={() => setPendingExecutionPhase(null)}
        />
      )}

      {/* Inline ConnectModal — opens on top of missing integrations modal */}
      {connectingEntry && (
        <ConnectModal
          entry={connectingEntry}
          onClose={() => setConnectingEntry(null)}
          onConnect={(provider, fields) => connectIntegrationMutation.mutate({ provider, fields })}
          onOAuthSuccess={() => {
            toast.success(t("Integração conectada via OAuth! Tente lançar novamente.", "Integration connected via OAuth! Try launching again.", "¡Integración conectada mediante OAuth! Intenta lanzar de nuevo."));
            setConnectingEntry(null);
          }}
        />
      )}

      {/* ── Partial Integrations Modal (soft confirmation) ── */}
      {partialIntegrations && !showPartialGuide && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-yellow-400/40 bg-card w-full max-w-lg shadow-2xl">
            <div className="border-b border-yellow-400/20 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-yellow-400">{t("Cobertura de Canais Incompleta", "Incomplete Channel Coverage", "Cobertura de canales incompleta")}</h3>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{t("Você pode lançar agora ou completar as integrações para máxima performance.", "You can launch now or complete integrations for maximum performance.", "Puedes lanzar ahora o completar las integraciones para obtener el máximo rendimiento.")}</p>
                </div>
              </div>
              <button onClick={() => { setPartialIntegrations(null); setShowPartialGuide(false); }} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/70 border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                <span className="text-yellow-400 font-bold">{t("Atenção:", "Warning:", "Atención:")}</span> {t("Sem todos os canais conectados, a agente operará com alcance reduzido. Canais ausentes não receberão disparo automático.", "Without all channels connected, the agent will operate with reduced reach. Missing channels will not receive automated sends.", "Sin todos los canales conectados, el agente tendrá un alcance reducido. Los canales faltantes no recibirán envíos automáticos.")}
              </p>
              {partialIntegrations.map(m => (
                <div key={m.category} className="border border-border/40 bg-muted/10 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400/70 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/80 mb-0.5">{m.category}</div>
                    {m.reason && <p className="text-xs font-mono text-muted-foreground/50 mb-1">{m.reason}</p>}
                    <p className="text-xs font-mono text-muted-foreground/70">{t("Opções:", "Options:", "Opciones:")} <span className="text-foreground/60">{m.providers.join(" · ")}</span></p>
                    <button
                      onClick={() => setShowPartialGuide(true)}
                      className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-yellow-400/60 hover:text-yellow-400 underline underline-offset-2"
                    >
                      {t("Ver passo a passo de configuração", "View setup instructions", "Ver instrucciones de configuración")} ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 px-5 py-4 flex flex-col sm:flex-row gap-3">
              <Link href="/integracoes" className="flex-1">
                <Button className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10" onClick={() => { setPartialIntegrations(null); setShowPartialGuide(false); }}>
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
            <ArrowLeft className="h-3 w-3 mr-2" />{t("Retornar ao Radar", "Back to Campaigns", "Volver a campañas")}
          </Button>
        </Link>

        {/* North Star — briefing sempre visível no topo */}
        <CampaignNorthStar
          campaignId={campaignId}
          title={campaign.title ?? t("Campanha", "Campaign", "Campaña")}
          track={(campaignRaw["track"] as string | undefined) ?? null}
          status={campaign.status ?? ""}
          intakeData={intakeD}
          strategyData={strategyD}
        />

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground break-words">
                {campaign.title}
              </h1>
              <Badge variant="outline" className={`font-mono uppercase text-[11px] tracking-widest rounded-none px-2 py-1 border shrink-0 ${STATUS_COLOR[campaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                {localizedStatusLabel(t, campaign.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="bg-card px-2 py-1 border border-border/50">{campaign.type}</span>
              <span className="bg-card px-2 py-1 border border-border/50">Track: <span className="text-primary">{campaign.track}</span></span>
              {campaign.revenueTarget && <span className="bg-card px-2 py-1 border border-border/50 text-success">Meta: R$ {Number(campaign.revenueTarget).toLocaleString("pt-BR")}</span>}
              {isActive && <span className="bg-primary/10 px-2 py-1 border border-primary/30 text-primary animate-pulse">{t("Em execução", "In progress", "En ejecución")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/campaigns/${campaign.id}/intake`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
                <FileText className="h-3.5 w-3.5" />{t("Briefing", "Brief", "Briefing")}
              </Button>
            </Link>
            <Link href={`/campaigns/${campaign.id}/creatives`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-primary/40 hover:border-primary text-primary hover:bg-primary/10 h-9 px-3 text-xs">
                <Layers className="h-3.5 w-3.5" />{t("Criativos", "Creatives", "Creatividades")}
              </Button>
            </Link>
            <Link href={`/campaigns/${campaign.id}/control-room`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-[#00F0FF]/40 hover:border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/10 h-9 px-3 text-xs font-bold">
                <Activity className="h-3.5 w-3.5" />Control Room
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setLocation("/sequences")} className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-3 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />{t("Sequências", "Sequences", "Secuencias")}
            </Button>
            {["strategy_ready", "generating", "awaiting_approval"].includes(campaign.status) && (
              <Button
                variant="outline"
                onClick={() => setReorientOpen(true)}
                className="font-mono uppercase tracking-widest rounded-none gap-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/70 h-9 px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />{t("Reorientar", "Redirect", "Reorientar")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div className="border border-border/50 bg-card/40 p-4 relative overflow-hidden">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{t("Pipeline de Execução", "Execution Pipeline", "Flujo de ejecución")}</div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:items-center relative">
          <div className="hidden md:block absolute top-4 left-0 right-0 h-px bg-border/40 z-0" />
          {PIPELINE.map((step, idx) => {
            const state = getPipelineState(campaign.status, step.statuses);
            const stepLabel = step.id === "intake" ? t("01 · Briefing", "01 · Brief", "01 · Briefing")
              : step.id === "strategy" ? t("02 · Estratégia", "02 · Strategy", "02 · Estrategia")
              : step.id === "content" ? t("03 · Conteúdo", "03 · Content", "03 · Contenido")
              : step.id === "launch" ? t("04 · Lançamento", "04 · Launch", "04 · Lanzamiento")
              : t("05 · Monitor", "05 · Monitor", "05 · Monitoreo");
            return (
              <div key={step.id} className="flex md:flex-col md:flex-1 items-center md:items-center gap-3 md:gap-2 relative z-10">
                {idx > 0 && <div className="md:hidden w-px h-3 bg-border/40 ml-4" />}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                  ${state === "done" ? "border-success bg-success/20" : state === "active" ? "border-primary bg-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "border-border/50 bg-muted/10"}`}>
                  {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> :
                   state === "active" ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> :
                   <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
                <span className={`text-[11px] font-mono uppercase tracking-widest md:text-center ${state === "done" ? "text-success" : state === "active" ? "text-primary" : "text-muted-foreground/40"}`}>{stepLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Credit Counter ── */}
      {creditStatsData && (creditStatsData.totalCredits > 0 || creditStatsData.creditsCost > 0) && (
        <div className="border border-border/30 bg-card/20 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Custo da Campanha", "Campaign Cost", "Costo de campaña")}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-primary font-bold">
              {(creditStatsData.totalCredits || creditStatsData.creditsCost).toLocaleString("pt-BR")}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">{t("créditos", "credits", "créditos")}</span>
          </div>
          {creditStatsData.totalTokens > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-foreground/70">
                {creditStatsData.totalTokens.toLocaleString("pt-BR")}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">tokens</span>
            </div>
          )}
          {Number(creditStatsData.totalCostUsd) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-foreground/50">
                ${Number(creditStatsData.totalCostUsd).toFixed(3)}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">USD</span>
            </div>
          )}
          {creditStatsData.byAgent && creditStatsData.byAgent.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest ml-auto">
              {creditStatsData.byAgent.length} {t("agentes", "agents", "agentes")}
            </span>
          )}
        </div>
      )}

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
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />{t("Próxima Ação", "Next Action", "Próxima acción")}
                  </div>
                  <h3 className="font-mono font-bold text-lg text-foreground uppercase tracking-wide">{nextAction.label}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{nextAction.description}</p>
                </div>
                {nextAction.isIntervention ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {nextAction.failedPieceType && (
                      <Button
                        className="font-mono uppercase tracking-widest rounded-none gap-2 h-12 px-5 w-full md:w-auto border border-orange-400/60 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20"
                        onClick={() => handleSkipPiece(nextAction.failedPieceType!)}
                        disabled={skipPending}
                      >
                        {skipPending ? <><Loader2 className="h-4 w-4 animate-spin" />{t("Pulando...", "Skipping...", "Omitiendo...")}</> : <><AlertTriangle className="h-4 w-4" />{t("Pular esta peça", "Skip this piece", "Omitir esta pieza")}</>}
                      </Button>
                    )}
                    <Button
                      className="font-mono uppercase tracking-widest rounded-none gap-2 h-12 px-5 w-full md:w-auto border-border/40 text-muted-foreground"
                      variant="outline"
                      onClick={handleRetry}
                      disabled={retryPending}
                    >
                      {retryPending ? <><Loader2 className="h-4 w-4 animate-spin" />{t("Tentando...", "Trying...", "Intentando...")}</> : <><RefreshCw className="h-4 w-4" />{t("Tentar assim mesmo", "Try anyway", "Intentar de todos modos")}</>}
                    </Button>
                  </div>
                ) : nextAction.isRetry ? (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 h-12 px-6 w-full md:w-auto border border-yellow-400/60 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20"
                    onClick={handleRetry}
                    disabled={retryPending}
                  >
                    {retryPending ? <><Loader2 className="h-4 w-4 animate-spin" />{t("Retomando...", "Resuming...", "Reanudando...")}</> : <><RefreshCw className="h-4 w-4" />{nextAction.label}</>}
                  </Button>
                ) : nextAction.phase === "launch" ? (
                  <LaunchRocketButton
                    onClick={() => setShowLaunchSequence(true)}
                    loading={executeMutation.isPending}
                  />
                ) : nextAction.phase ? (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto"
                    onClick={() => handleExecuteClick(nextAction.phase!)}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />{t("Processando...", "Processing...", "Procesando...")}</> : <><Play className="h-4 w-4 fill-current" />{nextAction.label}</>}
                  </Button>
                ) : nextAction.href ? (
                  <Link href={nextAction.href}>
                    <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto">
                      {(campaign.status === "live" || campaign.status === "executing") ? <Activity className="h-4 w-4" /> : <Layers className="h-4 w-4" />}{nextAction.label}
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
                <div><div className="font-mono font-bold text-muted-foreground uppercase tracking-widest">{t("Campanha Concluída", "Campaign Completed", "Campaña completada")}</div>
                  <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">{t("Todos os dados disponíveis em Métricas", "All data is available in Metrics", "Todos los datos están disponibles en Métricas")}</div></div></>
              ) : (
                <><AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                <div><div className="font-mono font-bold text-yellow-400 uppercase tracking-widest">{t("Aguardando ação", "Action required", "Acción pendiente")}</div></div></>
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

          {/* ─ Approved: Creative Studio ─ */}
          {campaign.status === "approved" && (
            <CreativeStudioBlock
              campaignId={campaignId}
              campaignTitle={campaign.title}
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
                    {t("Prévia dos Criativos Gerados pelo agente", "Agent-Generated Creatives Preview", "Vista previa de las creatividades generadas por el agente")}
                  </span>
                </div>
                <Link href={`/campaigns/${campaignId}/content`}>
                  <button className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                    {t("Ver todos", "View all", "Ver todo")} <ChevronRight className="h-3 w-3" />
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
                  : t("Pré-visualização do estilo dos criativos. Clique em Aprovar Conteúdo para revisar todas as peças geradas.", "Preview of the creative style. Click Approve Content to review all generated pieces.", "Vista previa del estilo creativo. Haz clic en Aprobar contenido para revisar todas las piezas generadas.")}
              </p>
            </div>
          )}

          {/* Shared Product / Launch Readiness */}
          {campaignRaw["commercialProductId"] ? (
            <div className="border border-primary/30 bg-primary/5 p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                    {t("Vinculado ao Briefing Central", "Linked to Central Brief", "Vinculado al briefing central")}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    {t("Esta campanha consome dados canônicos do produto. Inteligência alinhada.", "This campaign uses canonical product data. Intelligence aligned.", "Esta campaña utiliza datos canónicos del producto. Inteligencia alineada.")}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10">
                <Link href={`/intake/${campaignRaw["commercialProductId"]}?entryPoint=launch`}>
                  {t("Ver Master Intake", "View Master Intake", "Ver Master Intake")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="border border-border/40 bg-card/40 p-5 flex flex-col md:flex-row gap-4 items-start justify-between">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                     {t("Briefing Isolado (Legado)", "Standalone Brief (Legacy)", "Briefing independiente (heredado)")}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1 max-w-lg">
                     {t("Esta campanha usa um briefing próprio. Para que Social Media, Mídia Paga e Market Intel usem os mesmos dados, migre para o Briefing Central.", "This campaign uses its own brief. Move to the Central Brief so Social Media, Paid Media, and Market Intel use the same data.", "Esta campaña usa su propio briefing. Migra al briefing central para que Social Media, medios pagados y Market Intel utilicen los mismos datos.")}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-widest">
                <Link href="/intake?entryPoint=launch">
                   {t("Vincular ao Produto", "Link to Product", "Vincular al producto")}
                </Link>
              </Button>
            </div>
          )}

          {/* Quick stats from intake */}
          {Object.keys(intakeD).filter(k => !k.startsWith("_")).length > 0 && (
            <div className="border border-border/50 bg-card/40 p-4">
              <SectionHeader icon={FileText} label={t("Dados do Briefing (Intake)", "Brief Data (Intake)", "Datos del briefing (intake)")} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  [t("Produto", "Product", "Producto"), intakeD["product.name"] as string],
                  [t("Descrição", "Description", "Descripción"), intakeD["product.description"] as string],
                  [t("Categoria", "Category", "Categoría"), intakeD["product.category"] as string],
                  [t("Preço", "Price", "Precio"), intakeD["product.price"] ? `R$ ${intakeD["product.price"]}` : null],
                  [t("Público", "Audience", "Público"), intakeD["audience.primaryPersona"] as string],
                  [t("Formato", "Format", "Formato"), intakeD["product.deliveryMethod"] as string],
                  [t("Tipo de campanha", "Campaign Type", "Tipo de campaña"), intakeD["campaign.type"] as string],
                  [t("Plataforma de vendas", "Sales Platform", "Plataforma de ventas"), intakeD["offer.salesPlatform"] as string],
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
              { label: t("Criado", "Created", "Creado"), value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—" },
              { label: t("Atualizado", "Updated", "Actualizado"), value: campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString("pt-BR") : "—" },
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

          {/* ─ Generating: static placeholder only while DB agents haven't loaded yet ─ */}
          {campaign.status === "generating" && liveEvents.length === 0 && (agentsData?.agents ?? []).length === 0 && <GeneratingDisplay />}

          {/* ─ Live agent feed ─
              Shows when:
              - there are live WebSocket events, OR
              - campaign is active (isActive), OR
              - DB agents are persisted (survives page refresh)
              Never shown during analyzing/executing/live (those have their own displays).
          ─ */}
          {(isActive || liveEvents.length > 0 || (agentsData?.agents ?? []).length > 0) &&
           !["analyzing", "executing", "live"].includes(campaign.status) &&
           !(campaign.status === "generating" && liveEvents.length === 0 && (agentsData?.agents ?? []).length === 0) && (
            <AgentLiveFeed
              events={liveEvents}
              dbAgents={agentsData?.agents ?? []}
            />
          )}

          {/* ─ Executing / Live: mission ticker ─ */}
          {(campaign.status === "executing" || campaign.status === "live") && (
            <ExecutingLiveDisplay events={liveEvents} />
          )}

          {/* ─ Agent Clarification Panel — shown whenever agents need user input ─ */}
          {(isActive || liveEvents.length > 0) && (
            <AgentClarificationPanel campaignId={campaignId} events={liveEvents} />
          )}

          {/* ─ Empty strategy warning — strategy_ready but no data (bulk-created or agent failed) ─ */}
          {campaign.status === "strategy_ready" && Object.keys(strategyD).length === 0 && (
            <div className="border border-yellow-400/30 bg-yellow-400/5 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-400/60" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-400/60" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-400/60" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-400/60" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 flex items-center gap-2 mb-2">
                <AlertCircle className="h-3.5 w-3.5" />{t("Estratégia não gerada", "Strategy not generated", "Estrategia no generada")}
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4 leading-relaxed">
                {Object.keys(intakeD).length === 0
                  ? t("Esta campanha não tem briefing completo. Complete o intake antes de gerar a estratégia do agente.", "This campaign does not have a complete brief. Complete the intake before generating the agent strategy.", "Esta campaña no tiene un briefing completo. Completa el intake antes de generar la estrategia del agente.")
                  : t("A agente ainda não gerou a estratégia para esta campanha. Clique em Gerar Estratégia para que os agentes elaborem a proposta completa, ou pule direto para a geração de conteúdo.", "The agent has not generated a strategy for this campaign yet. Click Generate Strategy so agents can build the complete proposal, or skip directly to content generation.", "El agente aún no ha generado una estrategia para esta campaña. Haz clic en Generar estrategia para que los agentes preparen la propuesta completa o pasa directamente a generar contenido.")}
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.keys(intakeD).length === 0 ? (
                  <Link href={`/campaigns/${campaignId}/intake`}>
                    <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
                      <FileText className="h-3 w-3" />{t("Completar Briefing", "Complete Brief", "Completar briefing")}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
                    disabled={rerunStrategyLoading || executeMutation.isPending}
                    onClick={() => {
                      setPendingStrategyFn(() => async () => {
                        setRerunStrategyLoading(true);
                        try {
                          await customFetch(`/api/campaigns/${campaignId}/execute/strategy`, { method: "POST" });
                          toast.success(t("Estratégia iniciada. Os agentes estão elaborando a proposta.", "Strategy started. Agents are preparing the proposal.", "Estrategia iniciada. Los agentes están preparando la propuesta."));
                          setActiveTab("agentes");
                          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
                        } catch (err: unknown) {
                          const e = err as { data?: { error?: string } };
                          toast.error(e?.data?.error ?? t("Falha ao iniciar estratégia.", "Failed to start strategy.", "No se pudo iniciar la estrategia."), { duration: 6000 });
                        } finally {
                          setRerunStrategyLoading(false);
                        }
                      });
                      setShowLaunchFeeModal(true);
                    }}
                  >
                    {rerunStrategyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    {t("Gerar Estratégia", "Generate Strategy", "Generar estrategia")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 h-9 px-4 text-xs"
                  disabled={executeMutation.isPending || rerunStrategyLoading}
                  onClick={() => handleExecuteClick("content")}
                >
                  {executeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  {t("Pular e Gerar Conteúdo", "Skip and Generate Content", "Omitir y generar contenido")}
                </Button>
              </div>
            </div>
          )}

          {/* ─ Decision Trace Panel — Modo Arquiteto only ─ */}
          {isArquiteto && campaign.status !== "draft" && (
            <DecisionTracePanel campaignId={campaignId} />
          )}

          {/* ─ Empty state (no data, no activity, no pending events) ─ */}
          {!isActive && liveEvents.length === 0 && Object.keys(strategyD).length === 0 && campaign.status !== "strategy_ready" && (
            <div className="py-16 text-center border border-border/30 bg-card/20">
              <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-widest mb-1">
                {t("Nenhum agente executado ainda", "No agents have run yet", "Todavía no se ejecutó ningún agente")}
              </p>
              <p className="font-mono text-xs text-muted-foreground/40">
                {t("Clique em “Iniciar Análise” no tab Comando para acionar os especialistas", "Click “Start Analysis” in the Command tab to activate the specialists", "Haz clic en “Iniciar análisis” en la pestaña Comando para activar a los especialistas")}
              </p>
            </div>
          )}

          {/* ─ Pending checkpoints ─ */}
          {(agentsData?.checkpoints ?? []).filter(c => c.status === "awaiting_review").map(cp => (
            <div key={cp.id} className="border border-yellow-400/30 bg-yellow-400/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-yellow-400 flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-3 w-3" />{t("Aprovação Necessária", "Approval Required", "Se requiere aprobación")}
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
                {t("Aprovar", "Approve", "Aprobar")}
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

      {/* ══════════════ MASTERPLAN TAB ══════════════ */}
      {activeTab === "estrategia" && (
        <div className="space-y-4">

          {/* ─ Masterplan card — link to dedicated page ─ */}
          {campaign.status === "analyzing" && (
            <div className="border border-primary/30 bg-primary/[0.04] p-6 flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-12 h-12 border border-primary/30 bg-primary/5 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-primary/40" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-primary/40" />
              </div>
              <div>
                <p className="font-mono text-xs font-black uppercase tracking-widest text-foreground mb-1">{t("Gerando Masterplan...", "Generating Masterplan...", "Generando el plan maestro...")}</p>
                <p className="font-mono text-[11px] text-muted-foreground/60">{t("Os agentes estão construindo seu plano de lançamento. Acompanhe em tempo real:", "Agents are building your launch plan. Follow along in real time:", "Los agentes están preparando tu plan de lanzamiento. Sigue el proceso en tiempo real:")}</p>
              </div>
              <Button
                onClick={() => setLocation(`/campaigns/${campaignId}/strategy`)}
                className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-10 text-xs px-6"
              >
                <Brain className="h-3.5 w-3.5" /> {t("Ver Geração ao Vivo", "View Live Generation", "Ver generación en vivo")}
              </Button>
            </div>
          )}

          {campaign.status === "strategy_ready" && (
            <div className="border border-cyan-400/40 bg-cyan-400/[0.04] p-6 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">{t("Masterplan Pronto", "Masterplan Ready", "Plan maestro listo")}</span>
                </div>
                <p className="font-mono text-sm font-black uppercase tracking-wide text-foreground mb-1">
                  {t("Seu plano de lançamento está completo", "Your launch plan is complete", "Tu plan de lanzamiento está completo")}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/60">
                  {t("Revise cada seção e aprove para gerar automaticamente todo o conteúdo do lançamento.", "Review each section and approve to automatically generate all launch content.", "Revisa cada sección y aprueba para generar automáticamente todo el contenido del lanzamiento.")}
                </p>
              </div>
              <Button
                onClick={() => setLocation(`/campaigns/${campaignId}/strategy`)}
                className="shrink-0 rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary h-11 text-xs px-7"
              >
                <BookOpen className="h-4 w-4" /> {t("Abrir Masterplan", "Open Masterplan", "Abrir plan maestro")}
              </Button>
            </div>
          )}

          {Object.keys(strategyD).length > 0 && !["analyzing", "strategy_ready"].includes(campaign.status) && (
            <div className="border border-border/30 bg-muted/5 p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Estratégia — Histórico", "Strategy — History", "Estrategia — Historial")}</p>
                <p className="font-mono text-xs text-foreground font-bold uppercase tracking-wide mb-0.5">
                  {t("Masterplan da Campanha", "Campaign Masterplan", "Plan maestro de campaña")}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  {t("Esta estratégia foi aprovada. Acesse o histórico completo do masterplan.", "This strategy was approved. Open the complete masterplan history.", "Esta estrategia fue aprobada. Consulta el historial completo del plan maestro.")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setLocation(`/campaigns/${campaignId}/strategy`)}
                className="shrink-0 rounded-none font-mono uppercase tracking-widest font-bold gap-2 border-border/40 h-9 text-xs px-5"
              >
                <BookOpen className="h-3.5 w-3.5" /> {t("Ver Masterplan", "View Masterplan", "Ver plan maestro")}
              </Button>
            </div>
          )}

          {Object.keys(strategyD).length === 0 && !["analyzing", "strategy_ready"].includes(campaign.status) && (
            <div className="py-16 text-center border border-border/20">
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest mb-1">
                {t("Masterplan ainda não disponível", "Masterplan not available yet", "El plan maestro aún no está disponible")}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground/30">
                {t("Complete o briefing para que os agentes elaborem o plano de lançamento.", "Complete the brief so agents can prepare the launch plan.", "Completa el briefing para que los agentes preparen el plan de lanzamiento.")}
              </p>
            </div>
          )}

          {/* VSL quick-create */}
          {["strategy_ready", "approved", "generating", "awaiting_approval", "executing", "live", "completed"].includes(campaign.status) && (
            <div className="border border-border/30 bg-card/20 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 border border-primary/30 bg-primary/5 flex items-center justify-center shrink-0">
                  <Video className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{t("VSL — Roteiro de Vídeo de Vendas", "VSL — Video Sales Letter Script", "VSL — Guion de video de ventas")}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {t("Gere o roteiro completo com base neste masterplan.", "Generate the complete script based on this masterplan.", "Genera el guion completo según este plan maestro.")}
                  </p>
                </div>
              </div>
              <Button
                size="sm" variant="outline"
                className="rounded-none font-mono text-xs uppercase tracking-widest h-8 px-4 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                onClick={() => setLocation(`/vsls?campaignId=${campaignId}&from=campaign`)}
              >
                <Video className="h-3 w-3 mr-1.5" />{t("Criar VSL", "Create VSL", "Crear VSL")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ CONTEÚDO TAB ══════════════ */}
      {activeTab === "conteudo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
              <SectionHeader icon={Layers} label={t(`${contentData?.pieces?.length ?? 0} Peças de Conteúdo`, `${contentData?.pieces?.length ?? 0} Content Pieces`, `${contentData?.pieces?.length ?? 0} piezas de contenido`)} />
            {["strategy_ready", "approved"].includes(campaign.status) && (
              <Button
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
                onClick={() => handleExecuteClick("content")}
                disabled={executeMutation.isPending}
              >
                <Zap className="h-3 w-3" />{t("Gerar Conteúdo", "Generate Content", "Generar contenido")}
              </Button>
            )}
          </div>
          {contentLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 bg-muted/20" />)}</div>
          ) : (contentData?.pieces ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">{t("Nenhuma peça de conteúdo gerada ainda.", "No content pieces generated yet.", "Todavía no se generaron piezas de contenido.")}</p>
              {campaign.status === "strategy_ready" && (
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary" onClick={() => handleExecuteClick("content")} disabled={executeMutation.isPending}>
                  <Play className="h-4 w-4 fill-current" />{t("Gerar Conteúdo Agora", "Generate Content Now", "Generar contenido ahora")}
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
                         {piece.status === "approved" ? t("Aprovado", "Approved", "Aprobado") : piece.status === "rejected" ? t("Rejeitado", "Rejected", "Rechazado") : piece.status === "draft" ? t("Rascunho", "Draft", "Borrador") : piece.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap mb-3 line-clamp-4">{piece.content}</p>
                  {piece.status === "draft" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs bg-success/20 hover:bg-success/30 text-success border border-success/30 hover:border-success/50"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "approve")}>
                         {contentActionLoading === piece.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}{t("Aprovar", "Approve", "Aprobar")}
                      </Button>
                      <Button size="sm" variant="outline"
                        className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        disabled={contentActionLoading === piece.id}
                        onClick={() => handleContentAction(piece.id, "reject")}>
                         <XCircle className="h-3 w-3" />{t("Rejeitar", "Reject", "Rechazar")}
                      </Button>
                      <Button size="sm" variant="ghost" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs text-muted-foreground">
                         <Eye className="h-3 w-3" />{t("Ver Completo", "View Full", "Ver completo")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ GALERIA TAB ══════════════ */}
      {activeTab === "galeria" && (
        <CampaignCreativeGallery campaignId={campaignId} />
      )}

      {/* ══════════════ GRUPOS TAB ══════════════ */}
      {activeTab === "grupos" && (
        <GroupsTab campaignId={campaignId} />
      )}

      {/* ══════════════ MÉTRICAS TAB ══════════════ */}
      {activeTab === "metricas" && (
        <div className="space-y-4">
          {metricsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : !metricsData ? (
            <div className="py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("Nenhuma métrica registrada ainda.", "No metrics recorded yet.", "Todavía no hay métricas registradas.")}</p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-2">{t("Métricas são ingeridas automaticamente durante a fase de execução ou via POST /api/campaigns/:id/metrics", "Metrics are ingested automatically during execution or via POST /api/campaigns/:id/metrics", "Las métricas se recopilan automáticamente durante la ejecución o mediante POST /api/campaigns/:id/metrics")}</p>
            </div>
          ) : (
            <>
              {/* Health score */}
              <div className="border border-border/50 bg-card/40 p-5">
                <SectionHeader icon={Activity} label={t("Health Score da Campanha", "Campaign Health Score", "Puntuación de salud de la campaña")} />
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="text-center">
                    <div className={`text-5xl font-mono font-bold ${metricsData.healthScore >= 70 ? "text-success" : metricsData.healthScore >= 40 ? "text-yellow-400" : "text-destructive"}`}>
                      {metricsData.healthScore}
                    </div>
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">/ 100 pts</div>
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] mt-2 px-3 py-0.5">{t("Nota", "Grade", "Calificación")} {metricsData.grade}</Badge>
                  </div>
                  <div className="flex-1">
                    <Progress value={metricsData.healthScore} className="h-2 rounded-none bg-muted/30 [&>div]:transition-all" />
                    <p className="text-xs font-mono text-muted-foreground mt-3 leading-relaxed">{metricsData.summary}</p>
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label={t("Receita Total", "Total Revenue", "Ingresos totales")} value={metricsData.totalRevenueBrl ? `R$ ${Number(metricsData.totalRevenueBrl).toLocaleString("pt-BR")}` : "—"} icon={DollarSign} color="success" />
                <KpiCard label={t("ROAS Médio", "Average ROAS", "ROAS promedio")} value={metricsData.avgRoas ? `${Number(metricsData.avgRoas).toFixed(1)}x` : "—"} icon={TrendingUp} color="primary" />
                <KpiCard label={t("CPL Médio", "Average CPL", "CPL promedio")} value={metricsData.avgCplBrl ? `R$ ${Number(metricsData.avgCplBrl).toFixed(2)}` : "—"} icon={Target} color="cyan" />
                <KpiCard label={t("Total Vendas", "Total Sales", "Ventas totales")} value={metricsData.totalSales?.toString() ?? "—"} icon={Activity} color="yellow" />
              </div>

              {/* Alerts */}
              {(alertsData?.alerts ?? []).length > 0 && (
                <div className="border border-border/50 bg-card/40 p-4 space-y-3">
                  <SectionHeader icon={AlertTriangle} label={t(`${alertsData!.alerts.length} Alertas Ativos`, `${alertsData!.alerts.length} Active Alerts`, `${alertsData!.alerts.length} alertas activas`)} />
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
                  <SectionHeader icon={TrendingUp} label={t("Histórico Diário", "Daily History", "Historial diario")} />
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
