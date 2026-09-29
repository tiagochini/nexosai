import { useState, useCallback } from "react";
import { Link } from "wouter";
import {
  ChevronRight, ChevronDown, Circle, CheckCircle2, Loader2,
  AlertCircle, Clock, Bot, FileText, Target, Layers, Rocket,
  BarChart2, Instagram, Facebook, Music2, Mail, MessageCircle,
  Globe, Video, Image, Megaphone, Zap, Brain, TrendingUp,
  Shield, Users, Star, Play, BookOpen, LayoutList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUiText } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface Checkpoint {
  id: string;
  type: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  track?: string;
  type?: string;
  intakeData?: Record<string, unknown>;
  strategyData?: Record<string, unknown>;
  createdAt?: string;
}

interface MindMapProps {
  campaign: Campaign;
  agents: AgentRun[];
  checkpoints: Checkpoint[];
  pieces: ContentPiece[];
  campaignId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_LABEL: Record<string, string> = {
  command: "Comandante", strategy: "Estrategista", launch_manager: "Gerente de Lançamento",
  offer: "Especialista em Oferta", product_builder: "Product Builder",
  copywriter: "Copywriter", creative_director: "Diretor Criativo",
  landing_page: "Landing Page", targeting: "Targeting Expert",
  media_buyer: "Media Buyer", analytics: "Analista de Performance",
  optimization: "Otimizador", compliance: "Compliance Officer",
  profile_builder: "Profile Builder", ad_copy: "Copy de Anúncios",
  cpl_script: "Script CPL", vsl_script: "Roteiro VSL",
  webinar_script: "Roteiro Webinar", live_script: "Roteiro Live",
  stories_sequence: "Sequência Stories", media_brief: "Brief de Mídia",
  financial_projector: "Projetor Financeiro",
  launch_sequence_builder: "Builder de Sequências",
  social_media: "Social Media", creator_growth: "Creator Growth",
  video: "Estrategista de Vídeo", video_strategy: "Estrategista de Vídeo",
  affiliate_campaign: "Especialista em Afiliados",
  perpetual_launch_manager: "Lançamento Perpétuo",
  continuous_sales_manager: "Gestor de Vendas Contínuas",
  whatsapp_response: "Auto-Resposta WhatsApp",
  intake: "Briefing", item_copy: "Copy de Item",
};

const AGENT_ICON: Record<string, React.ElementType> = {
  command: Brain, strategy: Target, launch_manager: Rocket,
  offer: Star, product_builder: BookOpen, copywriter: FileText,
  creative_director: Image, landing_page: Globe, targeting: Users,
  media_buyer: Megaphone, analytics: BarChart2, optimization: TrendingUp,
  compliance: Shield, profile_builder: Users, ad_copy: FileText,
  cpl_script: Video, vsl_script: Video, webinar_script: Video,
  live_script: Video, stories_sequence: LayoutList, media_brief: Image,
  financial_projector: TrendingUp, launch_sequence_builder: Zap,
  social_media: Instagram, video: Video, video_strategy: Video,
};

const PLATFORM_ICON: Record<string, React.ElementType> = {
  instagram: Instagram, facebook: Facebook, tiktok: Music2,
  email: Mail, whatsapp: MessageCircle, landing: Globe, ads: Megaphone,
};
const PLATFORM_COLOR: Record<string, string> = {
  instagram: "text-pink-400", facebook: "text-blue-400", tiktok: "text-red-400",
  email: "text-indigo-300", whatsapp: "text-green-400", landing: "text-cyan-400",
  ads: "text-orange-300",
};
const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  email: "E-mail", whatsapp: "WhatsApp", landing: "Landing Page", ads: "Anúncios",
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  email_sequence: "Sequência de E-mail", sales_page: "Página de Vendas",
  whatsapp_broadcast: "Broadcast WA", whatsapp_group_message: "Mensagem Grupo WA",
  telegram_message: "Mensagem Telegram", social_post: "Post Social",
  ad_copy: "Copy de Anúncio", vsl_script: "Roteiro VSL",
  media_brief: "Brief de Mídia", content_calendar: "Calendário de Conteúdo",
  cart_open_announcement: "Abertura de Carrinho", cart_close_urgency: "Urgência Fechamento",
  remarketing_sequence: "Sequência Remarketing", cpl_script: "Script CPL",
  webinar_script: "Roteiro Webinar", live_script: "Roteiro Live",
  stories_sequence: "Sequência Stories", landing_page_structure: "Estrutura Landing Page",
  creative_direction: "Direção Criativa", targeting_config: "Config Targeting",
  media_buying_plan: "Plano de Mídia", video_strategy: "Estratégia de Vídeo",
  creator_growth_plan: "Plano Creator Growth", compliance_report: "Relatório Compliance",
  optimization_report: "Relatório Otimização",
  // legacy frontend types
  post: "Post", reel: "Reel", story: "Story", carousel: "Carrossel",
  email: "E-mail", whatsapp_message: "Mensagem WA",
  vsl: "Roteiro VSL", landing_page_copy: "Copy Landing",
  video_script: "Roteiro de Vídeo", caption: "Legenda", headline: "Headline",
};

const LAUNCH_PHASE_LABEL: Record<string, string> = {
  pre_launch: "Pré-Lançamento", launch: "Lançamento",
  cart_open: "Abertura de Carrinho", cart_middle: "Meio de Carrinho",
  cart_close: "Fechamento", post_launch: "Pós-Lançamento",
};

const STATUS_ORDER: Record<string, number> = {
  draft: 0, intake: 1, analyzing: 2, strategy_ready: 3,
  generating: 4, awaiting_approval: 5, approved: 6,
  executing: 7, live: 8, completed: 9,
};

// Phase definitions — maps campaign statuses to phases
const PHASES = [
  {
    id: "briefing",
    label: "01 · Briefing",
    icon: FileText,
    color: "text-blue-400",
    border: "border-blue-400/35",
    bg: "bg-blue-400/8",
    activeBg: "bg-blue-400/15",
    glow: "shadow-[0_0_12px_hsl(217_91%_60%/0.15)]",
    statuses: ["draft", "intake"],
    agentRoles: ["intake", "profile_builder", "command"],
    description: "Coleta de informações, perfil do produto e posicionamento estratégico",
  },
  {
    id: "strategy",
    label: "02 · Estratégia",
    icon: Target,
    color: "text-cyan-400",
    border: "border-cyan-400/35",
    bg: "bg-cyan-400/8",
    activeBg: "bg-cyan-400/15",
    glow: "shadow-[0_0_12px_hsl(187_100%_42%/0.15)]",
    statuses: ["analyzing", "strategy_ready"],
    agentRoles: ["strategy", "offer", "financial_projector", "targeting", "launch_manager", "compliance"],
    description: "Análise de mercado, posicionamento, oferta e projeções financeiras",
  },
  {
    id: "content",
    label: "03 · Conteúdo",
    icon: Layers,
    color: "text-purple-400",
    border: "border-purple-400/35",
    bg: "bg-purple-400/8",
    activeBg: "bg-purple-400/15",
    glow: "shadow-[0_0_12px_hsl(270_80%_70%/0.15)]",
    statuses: ["generating", "awaiting_approval", "approved"],
    agentRoles: ["copywriter", "creative_director", "ad_copy", "landing_page", "social_media",
                 "stories_sequence", "vsl_script", "cpl_script", "media_brief", "launch_sequence_builder"],
    description: "Geração de copy, criativos, roteiros e peças por canal",
  },
  {
    id: "launch",
    label: "04 · Lançamento",
    icon: Rocket,
    color: "text-success",
    border: "border-success/35",
    bg: "bg-success/8",
    activeBg: "bg-success/15",
    glow: "shadow-[0_0_12px_hsl(var(--success)/0.15)]",
    statuses: ["executing", "live"],
    agentRoles: ["media_buyer", "optimization", "creator_growth", "affiliate_campaign",
                 "perpetual_launch_manager", "continuous_sales_manager", "whatsapp_response"],
    description: "Execução nos canais, automações ativas e otimização em tempo real",
  },
  {
    id: "results",
    label: "05 · Resultados",
    icon: BarChart2,
    color: "text-yellow-400",
    border: "border-yellow-400/35",
    bg: "bg-yellow-400/8",
    activeBg: "bg-yellow-400/15",
    glow: "shadow-[0_0_12px_hsl(48_96%_53%/0.15)]",
    statuses: ["completed"],
    agentRoles: ["analytics"],
    description: "Consolidação de métricas, ROAS, CPL e relatório de lançamento",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function phaseStatus(campaignStatus: string, phaseStatuses: string[]): "done" | "active" | "pending" {
  const cur = STATUS_ORDER[campaignStatus] ?? 0;
  const min = Math.min(...phaseStatuses.map(s => STATUS_ORDER[s] ?? 0));
  const max = Math.max(...phaseStatuses.map(s => STATUS_ORDER[s] ?? 0));
  if (cur > max) return "done";
  if (cur >= min && cur <= max) return "active";
  return "pending";
}

function agentStatusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-3 w-3 text-success shrink-0" />;
  if (status === "running")   return <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />;
  if (status === "failed")    return <AlertCircle className="h-3 w-3 text-destructive shrink-0" />;
  if (status === "pending")   return <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />;
  return <Clock className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
}

function agentDuration(agent: AgentRun): string | null {
  if (!agent.startedAt) return null;
  const start = new Date(agent.startedAt).getTime();
  const end = agent.completedAt ? new Date(agent.completedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m${secs % 60}s`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TreeLine({ last }: { last: boolean }) {
  return (
    <div className="flex flex-col items-center w-4 shrink-0 self-stretch">
      <div className="w-px flex-1 bg-border/25" style={{ marginBottom: last ? "50%" : 0 }} />
    </div>
  );
}

function ExpandChevron({ open }: { open: boolean }) {
  return open
    ? <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform" />
    : <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform" />;
}

// Level 3 — Content piece node
function PieceNode({ piece, last }: { piece: ContentPiece; last: boolean }) {
  const PIcon = PLATFORM_ICON[piece.platform ?? ""] ?? FileText;
  const pColor = PLATFORM_COLOR[piece.platform ?? ""] ?? "text-muted-foreground/50";
  const typeLabel = CONTENT_TYPE_LABEL[piece.type] ?? piece.type;
  const phaseLabel = piece.launchPhase ? LAUNCH_PHASE_LABEL[piece.launchPhase] ?? piece.launchPhase : null;

  return (
    <div className="flex items-start gap-0">
      <TreeLine last={last} />
      <div className="flex items-start gap-0 mt-0">
        <div className="w-4 h-px bg-border/25 mt-3 shrink-0" />
        <div className={`flex items-center gap-2 px-2.5 py-1.5 my-0.5 border border-border/20 bg-card/20
          hover:bg-card/40 hover:border-border/40 transition-all cursor-default group`}>
          <PIcon className={`h-2.5 w-2.5 shrink-0 ${pColor}`} />
          <span className={`font-mono text-[10px] uppercase tracking-wider font-bold ${pColor}`}>
            {PLATFORM_LABEL[piece.platform ?? ""] ?? "—"}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">·</span>
          <span className="font-mono text-[10px] text-foreground/70">{typeLabel}</span>
          {phaseLabel && (
            <>
              <span className="font-mono text-[10px] text-muted-foreground/40">·</span>
              <span className="font-mono text-[10px] text-muted-foreground/50 italic">{phaseLabel}</span>
            </>
          )}
          {piece.mentalTrigger && (
            <Badge variant="outline" className="rounded-none px-1 py-0 font-mono text-[9px] border-border/20 text-muted-foreground/40 ml-auto hidden group-hover:flex">
              {piece.mentalTrigger}
            </Badge>
          )}
          <div className={`w-1.5 h-1.5 rounded-full ml-auto shrink-0 ${
            piece.status === "approved" ? "bg-success" :
            piece.status === "rejected" ? "bg-destructive" :
            piece.status === "draft" ? "bg-muted-foreground/30" :
            "bg-yellow-400"
          }`} />
        </div>
      </div>
    </div>
  );
}

// Level 3 — Checkpoint node
function CheckpointNode({ cp, last }: { cp: Checkpoint; last: boolean }) {
  return (
    <div className="flex items-start gap-0">
      <TreeLine last={last} />
      <div className="flex items-start gap-0 mt-0">
        <div className="w-4 h-px bg-border/25 mt-3 shrink-0" />
        <div className="flex items-center gap-2 px-2.5 py-1.5 my-0.5 border border-border/20 bg-card/20">
          {cp.status === "approved"
            ? <CheckCircle2 className="h-2.5 w-2.5 text-success shrink-0" />
            : <Clock className="h-2.5 w-2.5 text-yellow-400 shrink-0" />
          }
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {cp.type.replace(/_/g, " ")}
          </span>
          <Badge variant="outline" className={`rounded-none px-1 py-0 font-mono text-[9px] ml-auto ${
            cp.status === "approved" ? "border-success/30 text-success" :
            cp.status === "rejected" ? "border-destructive/30 text-destructive" :
            "border-yellow-400/30 text-yellow-400"
          }`}>
            {cp.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Level 2 — Agent node with expandable outputs/pieces
function AgentNode({
  agent, pieces, checkpoints, phaseColor, last, campaignId,
}: {
  agent: AgentRun;
  pieces: ContentPiece[];
  checkpoints: Checkpoint[];
  phaseColor: string;
  last: boolean;
  campaignId: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = AGENT_ICON[agent.agentRole] ?? Bot;
  const label = AGENT_LABEL[agent.agentRole] ?? agent.agentRole;
  const dur = agentDuration(agent);
  const hasSubs = pieces.length > 0 || checkpoints.length > 0;

  return (
    <div className="flex items-start gap-0">
      <TreeLine last={last} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-0">
          <div className="w-4 h-px bg-border/25 mt-4 shrink-0" />
          <div className={`flex-1 min-w-0 my-0.5 border transition-all
            ${agent.status === "running"
              ? `border-primary/40 bg-primary/5 shadow-[0_0_8px_hsl(var(--primary)/0.12)]`
              : agent.status === "completed"
              ? "border-border/20 bg-card/20 hover:bg-card/35"
              : agent.status === "failed"
              ? "border-destructive/25 bg-destructive/5"
              : "border-border/15 bg-muted/5"
            }`}>
            <button
              onClick={() => hasSubs && setOpen(o => !o)}
              className={`w-full px-3 py-2 flex items-center gap-2.5 text-left ${hasSubs ? "cursor-pointer" : "cursor-default"}`}
            >
              {agentStatusIcon(agent.status)}
              <Icon className={`h-3 w-3 shrink-0 ${
                agent.status === "running" ? "text-primary" :
                agent.status === "completed" ? phaseColor :
                "text-muted-foreground/40"
              }`} />
              <span className={`font-mono text-[11px] font-bold uppercase tracking-wide flex-1 truncate ${
                agent.status === "running" ? "text-primary" :
                agent.status === "completed" ? "text-foreground/80" :
                agent.status === "failed" ? "text-destructive" :
                "text-muted-foreground/40"
              }`}>
                {label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {dur && (
                  <span className="font-mono text-[10px] text-muted-foreground/40">{dur}</span>
                )}
                {agent.tokensUsed && (
                  <span className="font-mono text-[10px] text-muted-foreground/30">
                    {agent.tokensUsed.toLocaleString("pt-BR")} tok
                  </span>
                )}
                {pieces.length > 0 && (
                  <Badge variant="outline" className={`rounded-none px-1.5 py-0 font-mono text-[10px] border-current/30 ${phaseColor}`}>
                    {pieces.length} peça{pieces.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {hasSubs && <ExpandChevron open={open} />}
              </div>
            </button>

            {/* Agent error message */}
            {agent.status === "failed" && agent.errorMessage && (
              <div className="px-3 pb-2 font-mono text-[10px] text-destructive/70 border-t border-destructive/15 pt-1.5">
                {agent.errorMessage.slice(0, 120)}
              </div>
            )}

            {/* Expanded sub-nodes: content pieces + checkpoints */}
            {open && hasSubs && (
              <div className="border-t border-border/15 pt-1.5 pb-1.5 pl-2">
                {/* Pieces grouped by platform */}
                {pieces.length > 0 && (
                  <div>
                    {Object.entries(
                      pieces.reduce((acc, p) => {
                        const k = p.platform ?? "other";
                        if (!acc[k]) acc[k] = [];
                        acc[k].push(p);
                        return acc;
                      }, {} as Record<string, ContentPiece[]>)
                    ).map(([platform, plPieces], gi, garr) => (
                      <PlatformGroup
                        key={platform}
                        platform={platform}
                        pieces={plPieces}
                        last={gi === garr.length - 1 && checkpoints.length === 0}
                        campaignId={campaignId}
                      />
                    ))}
                  </div>
                )}
                {checkpoints.map((cp, ci) => (
                  <CheckpointNode key={cp.id} cp={cp} last={ci === checkpoints.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Level 2.5 — Platform group node (between agent and pieces)
function PlatformGroup({
  platform, pieces, last, campaignId,
}: {
  platform: string;
  pieces: ContentPiece[];
  last: boolean;
  campaignId: string;
}) {
  const [open, setOpen] = useState(false);
  const PIcon = PLATFORM_ICON[platform] ?? FileText;
  const pColor = PLATFORM_COLOR[platform] ?? "text-muted-foreground/50";
  const label = PLATFORM_LABEL[platform] ?? platform;
  const approvedCount = pieces.filter(p => p.status === "approved").length;

  return (
    <div className="flex items-start gap-0">
      <TreeLine last={last} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-0">
          <div className="w-4 h-px bg-border/20 mt-3 shrink-0" />
          <button
            onClick={() => setOpen(o => !o)}
            className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 my-0.5
              border border-border/15 bg-muted/5 hover:bg-muted/10 transition-colors"
          >
            <PIcon className={`h-2.5 w-2.5 shrink-0 ${pColor}`} />
            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${pColor}`}>{label}</span>
            <span className="font-mono text-[10px] text-muted-foreground/40 ml-1">
              {pieces.length} peça{pieces.length !== 1 ? "s" : ""}
              {approvedCount > 0 && ` · ${approvedCount} aprovada${approvedCount !== 1 ? "s" : ""}`}
            </span>
            <ExpandChevron open={open} />
          </button>
        </div>
        {open && (
          <div className="pl-2">
            {pieces.map((p, pi) => (
              <PieceNode key={p.id} piece={p} last={pi === pieces.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Level 1 — Phase node
function PhaseNode({
  phase, campaignStatus, phaseAgents, phasePieces, phaseCheckpoints,
  campaignId, defaultOpen,
}: {
  phase: typeof PHASES[number];
  campaignStatus: string;
  phaseAgents: AgentRun[];
  phasePieces: ContentPiece[];
  phaseCheckpoints: Checkpoint[];
  campaignId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const st = phaseStatus(campaignStatus, phase.statuses);
  const Icon = phase.icon;
  const totalPieces = phasePieces.length;

  const agentsByRole = phaseAgents.reduce((acc, a) => {
    if (!acc[a.agentRole]) acc[a.agentRole] = [];
    acc[a.agentRole].push(a);
    return acc;
  }, {} as Record<string, AgentRun[]>);

  // Dedup: keep latest run per role
  const dedupedAgents = Object.values(agentsByRole).map(group =>
    group.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]!
  ).filter(Boolean);

  // Agents to show: expected roles (if no run yet, show pending placeholders)
  const shownAgents: (AgentRun & { isPlaceholder?: boolean })[] = [];
  phase.agentRoles.forEach(role => {
    const found = dedupedAgents.find(a => a.agentRole === role);
    if (found) {
      shownAgents.push(found);
    } else if (st !== "pending") {
      shownAgents.push({
        id: `placeholder-${role}`,
        agentRole: role,
        status: "pending",
        startedAt: "",
        isPlaceholder: true,
      });
    }
  });
  // Also include agents not in the expected list (extra agents that ran)
  dedupedAgents.forEach(a => {
    if (!phase.agentRoles.includes(a.agentRole)) shownAgents.push(a);
  });

  const completedCount = dedupedAgents.filter(a => a.status === "completed").length;
  const runningCount = dedupedAgents.filter(a => a.status === "running").length;
  const failedCount = dedupedAgents.filter(a => a.status === "failed").length;

  return (
    <div className={`border transition-all duration-200 ${
      st === "active"
        ? `${phase.border} ${phase.activeBg} ${phase.glow}`
        : st === "done"
        ? "border-border/30 bg-card/15"
        : "border-border/15 bg-muted/5 opacity-60"
    }`}>
      {/* Phase header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        {/* Status indicator */}
        <div className={`w-8 h-8 border flex items-center justify-center shrink-0 ${
          st === "active" ? `${phase.border} ${phase.bg}` :
          st === "done" ? "border-success/30 bg-success/10" :
          "border-border/20 bg-muted/10"
        }`}>
          {st === "done"
            ? <CheckCircle2 className="h-4 w-4 text-success" />
            : st === "active" && runningCount > 0
            ? <Loader2 className={`h-4 w-4 ${phase.color} animate-spin`} />
            : <Icon className={`h-4 w-4 ${st === "active" ? phase.color : "text-muted-foreground/30"}`} />
          }
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`font-mono text-[13px] font-bold uppercase tracking-widest ${
              st === "active" ? phase.color : st === "done" ? "text-foreground/70" : "text-muted-foreground/30"
            }`}>
              {phase.label}
            </span>
            {st === "active" && runningCount > 0 && (
              <Badge variant="outline" className={`rounded-none px-1.5 py-0 font-mono text-[10px] animate-pulse ${phase.border} ${phase.color}`}>
                {runningCount} agente{runningCount !== 1 ? "s" : ""} ativos
              </Badge>
            )}
            {st === "done" && (
              <Badge variant="outline" className="rounded-none px-1.5 py-0 font-mono text-[10px] border-success/30 text-success">
                concluído
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge variant="outline" className="rounded-none px-1.5 py-0 font-mono text-[10px] border-destructive/30 text-destructive">
                {failedCount} falha{failedCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/45 mt-0.5 truncate">
            {phase.description}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 shrink-0">
          {completedCount > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/50 hidden sm:block">
              {completedCount}/{shownAgents.filter(a => !a.isPlaceholder || st !== "pending").length} agentes
            </span>
          )}
          {totalPieces > 0 && (
            <Badge variant="outline" className={`rounded-none px-1.5 py-0 font-mono text-[10px] ${phase.border} ${phase.color}`}>
              {totalPieces} peças
            </Badge>
          )}
          <ExpandChevron open={open} />
        </div>
      </button>

      {/* Expanded agent tree */}
      {open && (
        <div className="border-t border-border/15 px-4 py-3">
          {shownAgents.length === 0 ? (
            <div className="font-mono text-[11px] text-muted-foreground/30 py-2 text-center">
              {st === "pending" ? "Aguardando fase anterior" : "Nenhum agente registrado"}
            </div>
          ) : (
            <div>
              {shownAgents.map((agent, ai) => {
                // Pieces for this agent: by agent role mapping to content types
                const agentPieces = phasePieces.filter(p => {
                  if (agent.agentRole === "copywriter" || agent.agentRole === "social_media")
                    return ["social_post","email_sequence","post","reel","story","carousel","caption","headline","email"].includes(p.type);
                  if (agent.agentRole === "ad_copy")
                    return ["ad_copy","remarketing_sequence","cart_open_announcement","cart_close_urgency"].includes(p.type);
                  if (agent.agentRole === "vsl_script" || agent.agentRole === "cpl_script")
                    return ["vsl_script","cpl_script","webinar_script","live_script","video_strategy","video_script"].includes(p.type);
                  if (agent.agentRole === "landing_page")
                    return ["landing_page_structure","landing_page_copy","sales_page"].includes(p.type);
                  if (agent.agentRole === "launch_sequence_builder")
                    return ["whatsapp_broadcast","whatsapp_group_message","telegram_message","whatsapp_message","content_calendar"].includes(p.type);
                  if (agent.agentRole === "stories_sequence")
                    return p.type === "stories_sequence";
                  if (agent.agentRole === "media_brief")
                    return ["media_brief","creative_direction","media_buying_plan"].includes(p.type);
                  if (agent.agentRole === "creative_director")
                    return ["creative_direction","media_brief"].includes(p.type);
                  if (agent.agentRole === "targeting")
                    return p.type === "targeting_config";
                  if (agent.agentRole === "media_buyer")
                    return p.type === "media_buying_plan";
                  if (agent.agentRole === "creator_growth")
                    return p.type === "creator_growth_plan";
                  if (agent.agentRole === "analytics" || agent.agentRole === "optimization")
                    return ["compliance_report","optimization_report"].includes(p.type);
                  return false;
                });
                const agentCheckpoints = phaseCheckpoints.filter(cp =>
                  (agent.agentRole === "strategy" && cp.type.includes("strategy")) ||
                  (agent.agentRole === "copywriter" && cp.type.includes("content")) ||
                  (agent.agentRole === "compliance" && cp.type.includes("compliance"))
                );

                return (
                  <AgentNode
                    key={agent.id}
                    agent={agent}
                    pieces={agentPieces}
                    checkpoints={agentCheckpoints}
                    phaseColor={phase.color}
                    last={ai === shownAgents.length - 1}
                    campaignId={campaignId}
                  />
                );
              })}
            </div>
          )}

          {/* Quick action for active phase */}
          {st === "active" && phase.id === "content" && (
            <div className="mt-3 pt-3 border-t border-border/15">
              <Link href={`/campaigns/${campaignId}/content`}>
                <button className={`w-full font-mono text-[11px] uppercase tracking-widest font-bold
                  border ${phase.border} ${phase.color} px-3 py-2 flex items-center justify-center gap-2
                  hover:${phase.bg} transition-colors`}>
                  <Play className="h-3 w-3" />
                  Revisar Conteúdo Gerado
                </button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export function CampaignMindMap({ campaign, agents, checkpoints, pieces, campaignId }: MindMapProps) {
  const t = useUiText();
  const [allExpanded, setAllExpanded] = useState(false);
  const [key, setKey] = useState(0);

  const toggleAll = useCallback(() => {
    setAllExpanded(v => !v);
    setKey(k => k + 1);
  }, []);

  const currentPhaseIdx = PHASES.findIndex(p =>
    p.statuses.includes(campaign.status)
  );
  const activePhaseIdx = currentPhaseIdx === -1 ? 0 : currentPhaseIdx;

  // Stats
  const totalAgents = agents.length;
  const completedAgents = agents.filter(a => a.status === "completed").length;
  const totalPieces = pieces.length;
  const approvedPieces = pieces.filter(p => p.status === "approved").length;
  const pct = PHASES.length > 1 ? Math.round((activePhaseIdx / (PHASES.length - 1)) * 100) : 0;

  return (
    <div className="border border-border/40 bg-card/20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-6 border border-primary/40 bg-primary/8 flex items-center justify-center shrink-0">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[12px] font-bold uppercase tracking-widest text-foreground/80">
              {t("Mapa de Execução", "Execution Map", "Mapa de Ejecución")}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/45">
              {totalAgents} {t("agentes", "agents", "agentes")} · {totalPieces} {t("peças", "pieces", "piezas")}
              {approvedPieces > 0 && ` · ${approvedPieces} ${t("aprovadas", "approved", "aprobadas")}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Pipeline progress bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-24 h-1 bg-muted/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 via-cyan-400 via-purple-400 to-success transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/40">{pct}%</span>
          </div>
          <button
            onClick={toggleAll}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50
              hover:text-muted-foreground/80 border border-border/25 px-2.5 py-1.5 hover:bg-muted/10 transition-colors"
          >
            {allExpanded ? t("Recolher", "Collapse", "Contraer") : t("Expandir", "Expand", "Expandir")} {t("Tudo", "All", "Todo")}
          </button>
        </div>
      </div>

      {/* Pipeline overview strip */}
      <div className="flex border-b border-border/20 overflow-x-auto">
        {PHASES.map((phase, pi) => {
          const st = phaseStatus(campaign.status, phase.statuses);
          const Icon = phase.icon;
          return (
            <div key={phase.id} className={`flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2.5 px-1 border-r border-border/15 last:border-r-0
              transition-all ${st === "active" ? phase.activeBg : st === "done" ? "bg-success/5" : ""}`}>
              <Icon className={`h-3.5 w-3.5 ${
                st === "done" ? "text-success" : st === "active" ? phase.color : "text-muted-foreground/20"
              }`} />
              <span className={`font-mono text-[9px] uppercase tracking-widest text-center leading-tight ${
                st === "done" ? "text-success/70" : st === "active" ? phase.color : "text-muted-foreground/25"
              }`}>
                {phase.label.split(" · ")[1]}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${
                st === "done" ? "bg-success" : st === "active" ? "bg-current animate-pulse" : "bg-muted/20"
              } ${st === "active" ? phase.color : ""}`} />
            </div>
          );
        })}
      </div>

      {/* Phase tree */}
      <div className="divide-y divide-border/15">
        {PHASES.map((phase, pi) => {
          const phaseAgents = agents.filter(a => phase.agentRoles.includes(a.agentRole));
          const phasePieces = pieces.filter(p => {
            if (phase.id === "content") return true;
            return false;
          });
          const phaseCheckpoints = checkpoints.filter(cp => {
            if (phase.id === "strategy") return cp.type.includes("strategy") || cp.type.includes("compliance");
            if (phase.id === "content") return cp.type.includes("content") || cp.type.includes("creative");
            return false;
          });
          const st = phaseStatus(campaign.status, phase.statuses);
          const isDefaultOpen = st === "active" || (st === "done" && pi === activePhaseIdx - 1);

          return (
            <PhaseNode
              key={`${phase.id}-${key}`}
              phase={phase}
              campaignStatus={campaign.status}
              phaseAgents={phaseAgents}
              phasePieces={phasePieces}
              phaseCheckpoints={phaseCheckpoints}
              campaignId={campaignId}
              defaultOpen={allExpanded ? true : isDefaultOpen}
            />
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2.5 border-t border-border/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
            {t("Agentes:", "Agents:", "Agentes:")} {completedAgents}/{totalAgents} {t("concluídos", "completed", "completados")}
          </span>
          {totalPieces > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
              {t("Conteúdo:", "Content:", "Contenido:")} {approvedPieces}/{totalPieces} {t("aprovados", "approved", "aprobados")}
            </span>
          )}
        </div>
        <Link href={`/campaigns/${campaignId}`}>
          <span className="font-mono text-[10px] text-primary/50 hover:text-primary/80 uppercase tracking-widest transition-colors">
            {t("Ver Campanha →", "View Campaign →", "Ver Campaña →")}
          </span>
        </Link>
      </div>
    </div>
  );
}
