import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ChevronLeft, Sparkles, Edit3,
  Instagram, Mail, MessageSquare, Globe, Calendar,
  Users, Loader2, Send, ArrowRight, Eye,
  BarChart3, Music2, ChevronRight, TrendingUp,
  Zap, Target, Activity, PlayCircle, Link2, Shield,
  RefreshCw, Rocket, AlertTriangle,
} from "lucide-react";
import { SocialPostPreview, estimatePostMetrics } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";
import { ContentCinemaOverlay } from "@/components/campaign-stage-experience";
import type { CinemaPiece } from "@/components/campaign-stage-experience";

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "facebook" | "tiktok" | "email" | "whatsapp" | "landing" | "ads";
type PieceType = "post" | "story" | "reel" | "native_video" | "email" | "message" | "ad" | "copy";
type Status = "pending" | "approved" | "rejected" | "edited";
type Segment = "hot" | "warm" | "cold" | "all";

interface ContentPiece extends PreviewPiece {
  id: string;
  platform: Platform;
  type: PieceType;
  dayIndex: number;
  title: string;
  body: string;
  callToAction?: string;
  status: Status;
  segment?: Segment;
  estimatedReach?: number;
  estimatedCost?: number;
  tiktokHook?: string;
  visualDirection?: string;
  hashtags?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_ICON: Record<Platform, React.ElementType> = {
  instagram: Instagram, facebook: Globe, tiktok: Music2,
  email: Mail, whatsapp: MessageSquare, landing: Globe, ads: BarChart3,
};
const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  email: "E-mail", whatsapp: "WhatsApp", landing: "Landing Page", ads: "Ads",
};
const PLATFORM_COLOR: Record<Platform, string> = {
  instagram: "text-pink-400 border-pink-400/40 bg-pink-400/10",
  facebook: "text-indigo-400 border-indigo-400/40 bg-indigo-400/10",
  tiktok: "text-red-400 border-red-400/40 bg-red-400/10",
  email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
  landing: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  ads: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
};
const SEGMENT_LABEL: Record<string, string> = {
  hot: "Quentes", warm: "Mornos", cold: "Frios", all: "Todos",
};
const SEGMENT_COLOR: Record<string, string> = {
  hot: "text-red-400 border-red-400/40 bg-red-400/10",
  warm: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  cold: "text-blue-300 border-blue-300/40 bg-blue-300/10",
  all: "text-muted-foreground border-border/40 bg-muted/10",
};


// ── Flowchart Phase Data ───────────────────────────────────────────────────────

interface Phase {
  id: string;
  label: string;
  dayRange: string;
  days: number[];
  objective: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
}

const PHASES: Phase[] = [
  { id: "anticipation", label: "Antecipação", dayRange: "Dia 0", days: [0], objective: "Gerar curiosidade e ativar notificações", icon: Sparkles, color: "text-purple-400", borderColor: "border-purple-400/50", bgColor: "bg-purple-400/10" },
  { id: "authority", label: "Autoridade", dayRange: "Dia 1–2", days: [1, 2], objective: "Construir credibilidade e entregar valor", icon: TrendingUp, color: "text-blue-400", borderColor: "border-blue-400/50", bgColor: "bg-blue-400/10" },
  { id: "desire", label: "Desejo", dayRange: "Dia 3–4", days: [3, 4], objective: "Ampliar desejo e mostrar transformação", icon: Target, color: "text-orange-400", borderColor: "border-orange-400/50", bgColor: "bg-orange-400/10" },
  { id: "cart_open", label: "🚀 Abertura", dayRange: "Dia 5", days: [5], objective: "Abrir carrinho — VIPs + retargeting ads", icon: Zap, color: "text-success", borderColor: "border-success/50", bgColor: "bg-success/10" },
  { id: "midcart", label: "Meio Carrinho", dayRange: "Dia 6", days: [6], objective: "Superar objeções com provas sociais", icon: Activity, color: "text-yellow-400", borderColor: "border-yellow-400/50", bgColor: "bg-yellow-400/10" },
  { id: "close", label: "⚡ Fechamento", dayRange: "Dia 7", days: [7], objective: "Urgência máxima — últimas horas", icon: Target, color: "text-red-400", borderColor: "border-red-400/50", bgColor: "bg-red-400/10" },
];

// ── Campaign Flowchart Component ───────────────────────────────────────────────

function CampaignFlowchart({ pieces }: { pieces: ContentPiece[] }) {
  const totalReach = pieces.reduce((sum, p) => sum + estimatePostMetrics(p).reach, 0);
  const totalLeads = pieces.reduce((sum, p) => sum + estimatePostMetrics(p).leads, 0);

  function fmtNum(n: number) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Peças de Conteúdo", value: String(pieces.length), color: "text-primary" },
          { label: "Alcance Total Estimado", value: fmtNum(totalReach), color: "text-cyan-400" },
          { label: "Leads Esperados", value: fmtNum(totalLeads), color: "text-success" },
          { label: "Plataformas Ativas", value: String(new Set(pieces.map(p => p.platform)).size), color: "text-purple-400" },
        ].map(k => (
          <div key={k.label} className="border border-border/50 bg-card/40 p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{k.label}</div>
            <div className={`font-mono text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Phase flowchart */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-0 min-w-max">
          {PHASES.map((phase, idx) => {
            const phasePieces = pieces.filter(p => phase.days.includes(p.dayIndex));
            const phaseReach = phasePieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
            const phaseLeads = phasePieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
            const platforms = [...new Set(phasePieces.map(p => p.platform))];
            const Icon = phase.icon;

            return (
              <div key={phase.id} className="flex items-center">
                <div className={`border ${phase.borderColor} ${phase.bgColor} p-4 w-44 space-y-3 flex-shrink-0 relative`}>
                  {/* Phase header */}
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 border ${phase.borderColor} flex items-center justify-center ${phase.bgColor} shrink-0`}>
                      <Icon className={`h-3 w-3 ${phase.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`font-mono text-[11px] font-bold uppercase tracking-widest ${phase.color} leading-tight`}>
                        {phase.label}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-widest">{phase.dayRange}</div>
                    </div>
                  </div>

                  {/* Objective */}
                  <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                    {phase.objective}
                  </div>

                  {/* Piece count + metrics */}
                  {phasePieces.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] text-foreground/70">
                        <span className={`font-bold ${phase.color}`}>{phasePieces.length}</span> peça{phasePieces.length !== 1 ? "s" : ""}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">
                        Alcance: <span className="text-cyan-400">{fmtNum(phaseReach)}</span>
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">
                        Leads: <span className="text-success">{fmtNum(phaseLeads)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-muted-foreground/40 italic">Sem conteúdo</div>
                  )}

                  {/* Platform icons */}
                  {platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {platforms.map(platform => {
                        const PIcon = PLATFORM_ICON[platform];
                        const pColor = PLATFORM_COLOR[platform];
                        return (
                          <div key={platform} className={`w-5 h-5 border flex items-center justify-center ${pColor}`} title={PLATFORM_LABEL[platform]}>
                            <PIcon className="h-2.5 w-2.5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Arrow connector */}
                {idx < PHASES.length - 1 && (
                  <div className="flex items-center mx-0.5 shrink-0">
                    <div className="w-6 h-px bg-border/50" />
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 -ml-1.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform breakdown table */}
      <div className="border border-border/50 bg-card/40">
        <div className="px-4 py-3 border-b border-border/50">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Breakdown por Plataforma</span>
        </div>
        <div className="divide-y divide-border/30">
          {(["instagram", "facebook", "tiktok", "email", "whatsapp", "ads"] as Platform[]).map(platform => {
            const platformPieces = pieces.filter(p => p.platform === platform);
            if (platformPieces.length === 0) return null;
            const PIcon = PLATFORM_ICON[platform];
            const pColor = PLATFORM_COLOR[platform];
            const reach = platformPieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
            const leads = platformPieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
            const avgEng = Math.round(
              platformPieces.reduce((s, p) => s + estimatePostMetrics(p).engagementRate, 0) / platformPieces.length
            );
            return (
              <div key={platform} className="flex items-center gap-4 px-4 py-2.5">
                <div className={`w-6 h-6 border flex items-center justify-center shrink-0 ${pColor}`}>
                  <PIcon className="h-3 w-3" />
                </div>
                <span className="font-mono text-xs font-bold w-24 shrink-0">{PLATFORM_LABEL[platform]}</span>
                <span className="font-mono text-[11px] text-muted-foreground/60 w-12">{platformPieces.length} peças</span>
                <div className="flex-1 flex gap-4 flex-wrap">
                  <span className="font-mono text-[11px] text-cyan-400">{fmtNum(reach)} alcance</span>
                  <span className="font-mono text-[11px] text-success">{fmtNum(leads)} leads</span>
                  <span className="font-mono text-[11px] text-primary">{avgEng}% eng</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Content Card (text view) ──────────────────────────────────────────────────

function ContentCard({ piece, onApprove, onReject, onEdit, onAiRewrite, loading, rewriting }: {
  piece: ContentPiece;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (piece: ContentPiece) => void;
  onAiRewrite: (id: string) => void;
  loading?: string | null;
  rewriting?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const PlatformIcon = PLATFORM_ICON[piece.platform] ?? Globe;
  const platformColor = PLATFORM_COLOR[piece.platform] ?? "text-muted-foreground border-border/40";
  const isRewriting = rewriting === piece.id;
  const statusBorder = isRewriting ? "border-primary/40" : piece.status === "approved" ? "border-success/40" : piece.status === "rejected" ? "border-destructive/40" : "border-border/50";
  const isLoading = loading === piece.id;
  const m = estimatePostMetrics(piece);

  return (
    <div className={`border bg-card/40 transition-all relative ${statusBorder}`}>
      <div className={`absolute left-0 inset-y-0 w-[3px] ${isRewriting ? "bg-primary animate-pulse" : piece.status === "approved" ? "bg-success" : piece.status === "rejected" ? "bg-destructive" : "bg-border/30"}`} />
      <div className="pl-4 pr-4 py-3">
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-7 h-7 border rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${platformColor}`}>
            <PlatformIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${platformColor}`}>
                {PLATFORM_LABEL[piece.platform]}
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">Dia {piece.dayIndex}</span>
              {piece.segment && piece.segment !== "all" && (
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${SEGMENT_COLOR[piece.segment]}`}>
                  {SEGMENT_LABEL[piece.segment]}
                </Badge>
              )}
              {piece.status !== "pending" && (
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${
                  piece.status === "approved" ? "text-success border-success/40 bg-success/10" :
                  piece.status === "rejected" ? "text-destructive border-destructive/40 bg-destructive/10" :
                  "text-blue-400 border-blue-400/40 bg-blue-400/10"
                }`}>
                  {piece.status === "approved" ? "Aprovado" : piece.status === "rejected" ? "Rejeitado" : "Editado"}
                </Badge>
              )}
            </div>
            <h3 className="font-mono font-bold text-sm text-foreground leading-tight">{piece.title}</h3>
          </div>
        </div>

        {/* Hook (TikTok) */}
        {piece.tiktokHook && (
          <div className="mb-2 px-2 py-1 border border-red-400/30 bg-red-400/5">
            <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest">Hook: </span>
            <span className="font-mono text-[11px] text-foreground/80 italic">"{piece.tiktokHook}"</span>
          </div>
        )}

        {/* Visual direction */}
        {piece.visualDirection && (
          <div className="mb-2 px-2 py-1 border border-purple-400/30 bg-purple-400/5">
            <span className="font-mono text-[10px] text-purple-400 uppercase tracking-widest">Visual agente: </span>
            <span className="font-mono text-[11px] text-foreground/70">{piece.visualDirection}</span>
          </div>
        )}

        <div className={`font-mono text-xs text-muted-foreground bg-muted/10 border border-border/30 p-3 rounded-sm mb-3 whitespace-pre-line leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
          {piece.body}
        </div>
        {piece.body.length > 120 && (
          <button onClick={() => setExpanded(v => !v)} className="font-mono text-[11px] uppercase tracking-widest text-primary hover:text-primary/80 mb-3 flex items-center gap-1">
            {expanded ? "Menos" : "Ver tudo"} <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {piece.callToAction && (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">CTA:</span>
            <span className="font-mono text-xs text-primary border border-primary/30 bg-primary/5 px-2 py-0.5">{piece.callToAction}</span>
          </div>
        )}

        {/* Metrics row */}
        <div className="flex flex-wrap gap-3 mb-3">
          <span className="font-mono text-[10px] text-muted-foreground/50">Alcance <span className="text-cyan-400">{m.reach.toLocaleString("pt-BR")}</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Leads <span className="text-success">~{m.leads}</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Eng. <span className="text-primary">{m.engagementRate}%</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Conv. <span className="text-yellow-400">{m.conversionPct}%</span></span>
        </div>

        {isRewriting ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary">Agente reescrevendo com base no seu feedback...</span>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {piece.status !== "approved" && (
              <Button size="sm" onClick={() => onApprove(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 bg-success/10 border border-success/40 text-success hover:bg-success/20">
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Aprovar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onReject(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
              <XCircle className="h-3 w-3" />Rejeitar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(piece)} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-muted-foreground hover:text-foreground">
              <Edit3 className="h-3 w-3" />Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAiRewrite(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-primary hover:text-primary hover:bg-primary/10">
              <Sparkles className="h-3 w-3" />Reescrever
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Generate More Modal ────────────────────────────────────────────────────────

function GenerateMoreModal({
  platform,
  platformLabel,
  onClose,
  onConfirm,
  loading,
}: {
  platform: Platform;
  platformLabel: string;
  onClose: () => void;
  onConfirm: (count: number, instructions: string) => void;
  loading: boolean;
}) {
  const [count, setCount] = useState(3);
  const [instructions, setInstructions] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-lg mx-4 shadow-2xl">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm uppercase tracking-widest font-bold">Gerar mais peças — {platformLabel}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">O Agente Copywriter vai criar novas inserções alinhadas à campanha</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Count selector */}
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground block mb-3">
              Quantas peças a gerar?
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCount(v => Math.max(1, v - 1))}
                disabled={count <= 1}
                className="w-9 h-9 border border-border/60 font-mono text-lg text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="font-mono text-3xl font-bold text-primary">{count}</span>
                <span className="font-mono text-xs text-muted-foreground ml-2">peça{count !== 1 ? "s" : ""} de {platformLabel}</span>
              </div>
              <button
                onClick={() => setCount(v => Math.min(10, v + 1))}
                disabled={count >= 10}
                className="w-9 h-9 border border-border/60 font-mono text-lg text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              {[1, 3, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 h-7 font-mono text-[11px] uppercase tracking-widest border transition-all ${count === n ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground block mb-2">
              Instruções para o agente (opcional)
            </label>
            <textarea
              placeholder={`Ex: "Foque nos dias de fechamento com urgência máxima" ou "Adicione mais gatilho de prova social e depoimentos"`}
              className="w-full bg-muted/10 border border-border/60 text-sm p-3 min-h-[80px] resize-none font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>

          <div className="bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="font-mono text-xs text-primary/80 leading-relaxed">
                O agente vai ler a campanha existente, manter coerência com o plano e gerar {count} nova{count !== 1 ? "s" : ""} peça{count !== 1 ? "s" : ""} prontas para aprovação.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border/50 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-8">
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(count, instructions)}
            disabled={loading}
            className="rounded-none font-mono uppercase text-[11px] tracking-widest h-8 gap-1.5 btn-weapon-primary"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar {count} Peça{count !== 1 ? "s" : ""} com o agente
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ───────────────────────────────────────────────────────────────

function RejectModal({
  piece,
  onClose,
  onConfirm,
  loading,
}: {
  piece: ContentPiece;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-lg mx-4 shadow-2xl">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="font-mono text-sm uppercase tracking-widest font-bold">Rejeitar e Corrigir com o agente</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground truncate">{piece.title}</p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground block mb-2">
              Por que está rejeitando? O agente vai absorver seu feedback e reescrever.
            </label>
            <textarea
              autoFocus
              placeholder={'Ex: "O tom está muito formal, precisa ser mais urgente e direto" ou "A headline não conecta com o problema do avatar, refaça focando na dor principal..."'}
              className="w-full bg-muted/10 border border-border/60 text-sm p-3 min-h-[110px] resize-none font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="font-mono text-xs text-primary/80 leading-relaxed">
                O Agente Copywriter vai ler seu feedback, entender o que precisa mudar e reescrever a peça automaticamente. Você revisa e aprova — ou rejeita novamente.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border/50 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-8">
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="rounded-none font-mono uppercase text-[11px] tracking-widest h-8 gap-1.5 bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Rejeitar e Corrigir com o agente
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({ piece, onClose, onSave }: { piece: ContentPiece; onClose: () => void; onSave: (id: string, body: string, cta: string) => void }) {
  const [body, setBody] = useState(piece.body);
  const [cta, setCta] = useState(piece.callToAction ?? "");
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border/50 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold uppercase tracking-widest text-sm">Editar Peça</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Conteúdo</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-3 resize-y text-foreground leading-relaxed" />
          </div>
          {piece.callToAction !== undefined && (
            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Call to Action</label>
              <input value={cta} onChange={e => setCta(e.target.value)} className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-2 text-foreground" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(piece.id, body, cta)} className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />Salvar e Aprovar
            </Button>
            <Button variant="ghost" onClick={onClose} className="rounded-none font-mono uppercase tracking-widest h-9 text-xs text-muted-foreground">Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API Content Piece (raw from backend) ──────────────────────────────────────

interface ApiContentPiece {
  id: string;
  type: string;
  platform?: string;
  launchPhase?: string;
  mentalTrigger?: string;
  content: unknown;
  status: string;
  createdAt: string;
}

const TYPE_TO_PLATFORM: Record<string, Platform> = {
  instagram_post: "instagram", instagram_reel: "instagram", instagram_story: "instagram",
  instagram_feed: "instagram", reel: "instagram", story: "instagram",
  tiktok_video: "tiktok", tiktok_reel: "tiktok", native_video: "tiktok",
  facebook_post: "facebook", facebook_ad: "facebook", live_stream: "facebook",
  email_campaign: "email", email: "email",
  whatsapp_message: "whatsapp", whatsapp: "whatsapp",
  ad_copy: "ads", meta_ad: "ads", google_ad: "ads",
  landing_page: "landing",
  // Aggregated AI document types
  email_sequence: "email",
  creative_direction: "instagram",
  landing_page_structure: "landing",
  cpl_script: "tiktok",
  live_script: "facebook",
  stories_sequence: "instagram",
  media_brief: "ads",
  compliance_report: "landing",
  targeting_plan: "ads",
  targeting_config: "ads",
  audience_profile: "email",
  content_calendar: "instagram",
  vsl_script: "tiktok",
  webinar_script: "facebook",
  media_buying_plan: "ads",
};

const TYPE_TO_PIECE_TYPE: Record<string, PieceType> = {
  instagram_post: "post", instagram_feed: "post", facebook_post: "post",
  instagram_reel: "reel", reel: "reel",
  instagram_story: "story", story: "story",
  tiktok_video: "native_video", tiktok_reel: "native_video", native_video: "native_video",
  email_campaign: "email", email: "email",
  whatsapp_message: "message", whatsapp: "message",
  ad_copy: "ad", meta_ad: "ad", facebook_ad: "ad", google_ad: "ad",
  landing_page: "copy",
  // Aggregated AI document types
  email_sequence: "email",
  creative_direction: "post",
  landing_page_structure: "copy",
  cpl_script: "native_video",
  live_script: "post",
  stories_sequence: "story",
  media_brief: "ad",
  compliance_report: "copy",
  targeting_plan: "ad",
  targeting_config: "ad",
  audience_profile: "email",
  content_calendar: "post",
  vsl_script: "native_video",
  webinar_script: "post",
  media_buying_plan: "ad",
};

const PHASE_TO_DAY: Record<string, number> = {
  pre_launch: 0, pre_launch_1: 0, antecipacao: 0, anticipation: 0,
  authority: 1, authority_1: 1, autoridade: 1,
  authority_2: 2, value: 2, conteudo: 2,
  desire: 3, desire_1: 3, desejo: 3,
  desire_2: 4,
  cart_open: 5, abertura: 5,
  cart_middle: 6, meio_carrinho: 6,
  cart_close: 7, fechamento: 7,
};

const AGGREGATED_TYPE_LABELS: Record<string, string> = {
  email_sequence: "Sequência de E-mails",
  creative_direction: "Direção Criativa",
  landing_page_structure: "Landing Page",
  cpl_script: "Roteiro CPL",
  live_script: "Roteiro Live",
  stories_sequence: "Stories",
  media_brief: "Brief de Mídia",
  compliance_report: "Compliance",
  targeting_plan: "Plano de Tráfego",
  targeting_config: "Audiências e Tráfego",
  audience_profile: "Perfil de Audiência",
  content_calendar: "Calendário Social",
  ad_copy: "Copy de Anúncios",
  vsl_script: "Roteiro VSL",
  webinar_script: "Roteiro Webinar",
  media_buying_plan: "Plano de Media Buying",
};

function extractBodyText(content: unknown, type?: string): string {
  if (content === null || content === undefined) return "";
  let obj: unknown = content;
  if (typeof obj === "string") {
    const str = obj;
    try { obj = JSON.parse(str); } catch { return str; }
  }
  if (typeof obj !== "object") return String(obj);
  const c = obj as Record<string, unknown>;
  const lines: string[] = [];
  try {
    if (type === "email_sequence") {
      const sp = c["salesPage"] as Record<string, unknown> | undefined;
      const spSections = sp?.["sections"] as Array<Record<string, unknown>> | undefined;
      const hero = spSections?.find(s => (s["section"] as string)?.includes("hero")) ?? spSections?.[0];
      if (hero?.["headline"]) {
        lines.push("── PÁGINA DE VENDAS ──");
        lines.push(`Headline: ${hero["headline"] as string}`);
        if (hero["subheadline"]) lines.push(`Subtítulo: ${hero["subheadline"] as string}`);
        if (hero["cta"]) lines.push(`CTA: ${hero["cta"] as string}`);
        lines.push("");
      }
      const emails = c["emailSequence"] as Record<string, unknown> | undefined;
      const allEmails = [
        ...((emails?.["preLaunch"] as Array<Record<string, unknown>>) ?? []),
        ...((emails?.["cartOpen"] as Array<Record<string, unknown>>) ?? []),
        ...((emails?.["cartClose"] as Array<Record<string, unknown>>) ?? []),
      ];
      if (allEmails.length) {
        lines.push(`── SEQUÊNCIA DE E-MAILS (${allEmails.length} e-mails) ──`);
        allEmails.forEach((email, i) => {
          lines.push(`\nE-mail ${i + 1}: ${email["subject"] as string ?? ""}`);
          if (email["previewText"]) lines.push(`Preview: ${email["previewText"] as string}`);
          if (email["body"] && typeof email["body"] === "string") lines.push(email["body"].slice(0, 300));
        });
      }
      const wa = c["whatsapp"] as Array<Record<string, unknown>> | undefined;
      if (wa?.length) {
        lines.push(`\n── WHATSAPP (${wa.length} mensagens) ──`);
        wa.forEach((msg, i) => {
          lines.push(`\nMensagem ${i + 1}: ${msg["message"] as string ?? ""}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "stories_sequence") {
      const seqs = c["sequences"] as Array<Record<string, unknown>> | undefined;
      if (seqs?.length) {
        lines.push(`── STORIES (${seqs.length} sequências) ──`);
        seqs.forEach((seq, i) => {
          lines.push(`\nSequência ${i + 1}: ${seq["title"] as string ?? ""}`);
          lines.push(`Fase: ${seq["phase"] as string ?? ""}`);
          const frames = seq["frames"] as Array<Record<string, unknown>> | undefined;
          frames?.forEach((frame, fi) => {
            if (frame["textContent"]) lines.push(`  Frame ${fi + 1}: ${frame["textContent"] as string}`);
          });
          if (seq["cta"]) lines.push(`CTA: ${seq["cta"] as string}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "landing_page_structure") {
      const sections = c["sections"] as Array<Record<string, unknown>> | undefined;
      if (sections?.length) {
        lines.push(`── LANDING PAGE (${sections.length} seções) ──`);
        sections.forEach((section, i) => {
          lines.push(`\nSeção ${i + 1}: ${section["headline"] as string ?? ""}`);
          if (section["bodyContent"]) lines.push(`${(section["bodyContent"] as string).slice(0, 250)}`);
          const cta = section["cta"] as Record<string, unknown> | undefined;
          if (cta?.["text"]) lines.push(`CTA: ${cta["text"] as string}`);
          if (section["purpose"]) lines.push(`Objetivo: ${(section["purpose"] as string).slice(0, 120)}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "cpl_script") {
      const videos = c["videos"] as Array<Record<string, unknown>> | undefined;
      if (videos?.length) {
        lines.push(`── ROTEIROS CPL (${videos.length} vídeos) ──`);
        videos.forEach((video, i) => {
          lines.push(`\nVÍDEO ${i + 1}: ${video["title"] as string ?? ""}`);
          if (video["subtitle"]) lines.push(`Subtítulo: ${video["subtitle"] as string}`);
          if (video["hook"]) lines.push(`Hook: ${video["hook"] as string}`);
          if (video["objective"]) lines.push(`Objetivo: ${(video["objective"] as string).slice(0, 200)}`);
          if (video["cta"]) lines.push(`CTA: ${video["cta"] as string}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "live_script") {
      lines.push(`── LIVE: ${c["title"] as string ?? ""} ──`);
      lines.push(`Tipo: ${c["liveType"] as string ?? ""} | Plataforma: ${c["platform"] as string ?? ""}`);
      const segments = c["segments"] as Array<Record<string, unknown>> | undefined;
      if (segments?.length) {
        lines.push("");
        segments.forEach(seg => {
          lines.push(`[${seg["type"] as string ?? ""}] ${seg["name"] as string ?? ""}`);
          if (seg["script"]) lines.push(`${(seg["script"] as string).slice(0, 300)}`);
          lines.push("");
        });
      }
      return lines.join("\n");
    }
    if (type === "creative_direction") {
      const doAndDonts = c["doAndDonts"] as Record<string, unknown> | undefined;
      if (doAndDonts) {
        const dos = doAndDonts["dos"] as string[] | undefined;
        const donts = doAndDonts["donts"] as string[] | undefined;
        if (dos?.length) {
          lines.push("── FAZER ──");
          dos.forEach(d => lines.push(`• ${d}`));
          lines.push("");
        }
        if (donts?.length) {
          lines.push("── NÃO FAZER ──");
          donts.forEach(d => lines.push(`• ${d}`));
          lines.push("");
        }
      }
      const concepts = c["visualConcepts"] as Array<Record<string, unknown>> | undefined;
      if (concepts?.length) {
        lines.push(`── CONCEITOS VISUAIS (${concepts.length}) ──`);
        concepts.forEach((concept, i) => {
          lines.push(`\nConceito ${i + 1}: ${concept["headline"] as string ?? ""}`);
          if (concept["description"]) lines.push(`${concept["description"] as string}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "media_brief") {
      lines.push(`── BRIEF DE MÍDIA — ${c["campaignTitle"] as string ?? ""} ──`);
      const imageConcepts = c["imageConcepts"] as Array<Record<string, unknown>> | undefined;
      if (imageConcepts?.length) {
        lines.push(`\nCONCEITOS DE IMAGEM (${imageConcepts.length}):`);
        imageConcepts.forEach((ic, i) => lines.push(`${i + 1}. ${JSON.stringify(ic, null, 2)}`));
      }
      const videoConcepts = c["videoConcepts"] as Array<Record<string, unknown>> | undefined;
      if (videoConcepts?.length) {
        lines.push(`\nCONCEITOS DE VÍDEO (${videoConcepts.length}):`);
        videoConcepts.forEach((vc, i) => lines.push(`${i + 1}. ${JSON.stringify(vc, null, 2)}`));
      }
      const approval = c["approvalProcess"] as Array<Record<string, unknown>> | undefined;
      if (approval?.length) {
        lines.push(`\nPROCESSO DE APROVAÇÃO:`);
        approval.forEach(step => lines.push(`${step["step"] as number}. ${step["action"] as string}`));
      }
      return lines.join("\n");
    }
    if (type === "compliance_report") {
      lines.push(`── COMPLIANCE — ${c["campaignTitle"] as string ?? ""} ──`);
      const violations = c["violations"] as unknown[] | undefined;
      lines.push(violations?.length === 0 ? "✓ Nenhuma violação direta identificada" : `⚠ ${violations?.length ?? 0} violações encontradas`);
      const conar = c["conarAnalysis"] as Record<string, unknown> | undefined;
      if (conar?.["verdict"]) lines.push(`CONAR: ${conar["verdict"] as string}`);
      if (conar?.["issues"] && Array.isArray(conar["issues"]) && (conar["issues"] as unknown[]).length > 0) {
        lines.push("\nProblemas CONAR:");
        (conar["issues"] as unknown[]).forEach(issue => lines.push(`• ${JSON.stringify(issue)}`))
      }
      const notes = c["complianceNotes"] as string | undefined;
      if (notes) lines.push(`\nObservações:\n${notes}`);
      return lines.join("\n");
    }
  } catch { /* fallback */ }
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

// Extract the DB UUID from a possibly-synthetic child ID ("parentUUID::subKey")
function getParentId(id: string): string {
  return id.includes("::") ? (id.split("::")[0] ?? id) : id;
}

// Expand aggregated AI documents into individual reviewable cards.
// Each sub-item (email, story, CPL video, landing section…) becomes its own card.
function expandApiPieces(pieces: ApiContentPiece[]): ContentPiece[] {
  const STATUS_MAP: Record<string, Status> = {
    draft: "pending", pending_approval: "pending",
    approved: "approved", rejected: "rejected",
  };
  const result: ContentPiece[] = [];

  for (const piece of pieces) {
    const rawType = piece.type?.toLowerCase().replace(/\s+/g, "_") ?? "copy";
    const status: Status = STATUS_MAP[piece.status] ?? "pending";
    const launchKey = piece.launchPhase?.toLowerCase().replace(/\s+/g, "_") ?? "";
    const baseDayIndex = PHASE_TO_DAY[launchKey] ?? 0;

    // Parse JSONB content (API returns it already as an object, not a string)
    let c: Record<string, unknown> = {};
    try {
      const raw = piece.content as unknown;
      if (typeof raw === "string") c = JSON.parse(raw) as Record<string, unknown>;
      else if (raw && typeof raw === "object") c = raw as Record<string, unknown>;
    } catch { c = {}; }

    // Helper: create a child card
    const child = (subKey: string, overrides: Partial<ContentPiece>): ContentPiece => ({
      id: `${piece.id}::${subKey}`,
      platform: TYPE_TO_PLATFORM[rawType] ?? "email",
      type: TYPE_TO_PIECE_TYPE[rawType] ?? "copy",
      dayIndex: baseDayIndex,
      title: AGGREGATED_TYPE_LABELS[rawType] ?? rawType,
      body: "",
      status,
      segment: "all",
      ...overrides,
    });

    // ── email_sequence ──────────────────────────────────────────────────────
    if (rawType === "email_sequence") {
      const emailSeq = c["emailSequence"] as Record<string, Array<Record<string, unknown>>> | undefined;
      const phases = [
        { key: "preLaunch",   label: "Pré-Lançamento",     day: 0 },
        { key: "cartOpen",    label: "Abertura Carrinho",   day: 5 },
        { key: "cartClose",   label: "Fechamento",          day: 7 },
        { key: "remarketing", label: "Remarketing",         day: 8 },
      ] as const;
      let emailIdx = 0;
      for (const phase of phases) {
        const emails = emailSeq?.[phase.key] ?? [];
        for (const email of emails) {
          result.push(child(`email:${emailIdx}`, {
            platform: "email", type: "email", dayIndex: phase.day,
            title: `✉ ${email["subject"] as string ?? `${phase.label} #${emailIdx + 1}`}`,
            body: [
              email["previewText"] ? `Preview: ${email["previewText"] as string}` : "",
              email["body"] ? (email["body"] as string) : "",
            ].filter(Boolean).join("\n\n"),
            callToAction: email["cta"] as string | undefined,
          }));
          emailIdx++;
        }
      }
      // WhatsApp messages
      const wa = c["whatsapp"] as Array<Record<string, unknown>> | undefined;
      wa?.forEach((msg, i) => {
        result.push(child(`wa:${i}`, {
          platform: "whatsapp", type: "message",
          dayIndex: i < 2 ? 0 : i < 4 ? 5 : 7,
          title: `💬 WhatsApp: Mensagem ${i + 1}`,
          body: msg["message"] as string ?? JSON.stringify(msg, null, 2),
        }));
      });
      // Sales page headline card
      const sp = c["salesPage"] as Record<string, unknown> | undefined;
      const spSections = sp?.["sections"] as Array<Record<string, unknown>> | undefined;
      const hero = spSections?.find(s => (s["section"] as string)?.includes("hero")) ?? spSections?.[0];
      if (hero?.["headline"]) {
        result.push(child("sales_page", {
          platform: "landing", type: "copy", dayIndex: 5,
          title: `🚀 Landing Page de Vendas`,
          body: [
            hero["headline"] as string,
            hero["subheadline"] ? `\n${hero["subheadline"] as string}` : "",
          ].join(""),
          callToAction: hero["cta"] as string | undefined,
        }));
      }
      if (result.filter(p => p.id.startsWith(piece.id)).length === 0) {
        result.push(child("fallback", { body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── stories_sequence ────────────────────────────────────────────────────
    } else if (rawType === "stories_sequence") {
      const seqs = c["sequences"] as Array<Record<string, unknown>> | undefined;
      if (seqs?.length) {
        seqs.forEach((seq, i) => {
          const frames = seq["frames"] as Array<Record<string, unknown>> | undefined;
          const frameLines = frames?.map((f, fi) => `Frame ${fi + 1}: ${f["textContent"] as string ?? ""}`) ?? [];
          result.push(child(`story:${i}`, {
            platform: "instagram", type: "story", dayIndex: i,
            title: `📱 Stories: ${seq["title"] as string ?? `Sequência ${i + 1}`}`,
            body: [
              seq["phase"] ? `Fase: ${seq["phase"] as string}` : "",
              ...frameLines,
              seq["cta"] ? `CTA: ${seq["cta"] as string}` : "",
            ].filter(Boolean).join("\n"),
          }));
        });
      } else {
        result.push(child("fallback", { body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── cpl_script ──────────────────────────────────────────────────────────
    } else if (rawType === "cpl_script") {
      const videos = c["videos"] as Array<Record<string, unknown>> | undefined;
      if (videos?.length) {
        videos.forEach((video, i) => {
          result.push(child(`cpl:${i}`, {
            platform: "tiktok", type: "native_video",
            dayIndex: i < 2 ? 1 : 3,
            title: `🎬 Roteiro CPL ${i + 1}: ${video["title"] as string ?? ""}`,
            body: [
              video["hook"] ? `Hook: ${video["hook"] as string}` : "",
              video["objective"] ? `Objetivo: ${video["objective"] as string}` : "",
              video["body"] ? (video["body"] as string) : "",
              video["cta"] ? `CTA: ${video["cta"] as string}` : "",
            ].filter(Boolean).join("\n\n"),
            tiktokHook: video["hook"] as string | undefined,
            callToAction: video["cta"] as string | undefined,
          }));
        });
      } else {
        result.push(child("fallback", { body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── live_script ─────────────────────────────────────────────────────────
    } else if (rawType === "live_script") {
      const segments = c["segments"] as Array<Record<string, unknown>> | undefined;
      result.push(child("live_intro", {
        platform: "facebook", type: "post", dayIndex: 5,
        title: `🔴 Live: ${c["title"] as string ?? "Script de Live"}`,
        body: [
          c["liveType"] ? `Tipo: ${c["liveType"] as string}` : "",
          c["platform"] ? `Plataforma: ${c["platform"] as string}` : "",
          segments?.length ? `${segments.length} segmentos` : "",
          segments?.[0]?.["script"] ? `Abertura:\n${segments[0]["script"] as string}` : "",
        ].filter(Boolean).join("\n"),
      }));
      segments?.slice(1).forEach((seg, i) => {
        result.push(child(`live_seg:${i}`, {
          platform: "facebook", type: "post", dayIndex: 5,
          title: `🔴 Live — ${seg["name"] as string ?? seg["type"] as string ?? `Segmento ${i + 2}`}`,
          body: seg["script"] ? (seg["script"] as string) : JSON.stringify(seg, null, 2),
        }));
      });

    // ── landing_page_structure ───────────────────────────────────────────────
    } else if (rawType === "landing_page_structure") {
      const sections = c["sections"] as Array<Record<string, unknown>> | undefined;
      if (sections?.length) {
        sections.forEach((section, i) => {
          const cta = section["cta"] as Record<string, unknown> | undefined;
          result.push(child(`section:${i}`, {
            platform: "landing", type: "copy", dayIndex: 5,
            title: `🌐 Landing: ${section["headline"] as string ?? `Seção ${i + 1}`}`,
            body: [
              section["bodyContent"] ? (section["bodyContent"] as string) : "",
              section["purpose"] ? `Objetivo: ${section["purpose"] as string}` : "",
            ].filter(Boolean).join("\n\n"),
            callToAction: cta?.["text"] as string | undefined,
          }));
        });
      } else {
        result.push(child("fallback", { body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── creative_direction ───────────────────────────────────────────────────
    } else if (rawType === "creative_direction") {
      // Guidelines card
      const doAndDonts = c["doAndDonts"] as Record<string, unknown> | undefined;
      const dos = doAndDonts?.["dos"] as string[] | undefined;
      if (dos?.length) {
        result.push(child("guidelines", {
          platform: "instagram", type: "post", dayIndex: 0,
          title: "🎨 Diretrizes Criativas",
          body: dos.map(d => `• ${d}`).join("\n"),
        }));
      }
      // One card per visual concept
      const concepts = c["visualConcepts"] as Array<Record<string, unknown>> | undefined;
      concepts?.forEach((concept, i) => {
        result.push(child(`concept:${i}`, {
          platform: "instagram", type: "post", dayIndex: i,
          title: `🖼 Conceito Visual ${i + 1}: ${concept["headline"] as string ?? ""}`,
          body: [
            concept["description"] ? (concept["description"] as string) : "",
            concept["colorPalette"] ? `Cores: ${concept["colorPalette"] as string}` : "",
            concept["typography"] ? `Tipografia: ${concept["typography"] as string}` : "",
          ].filter(Boolean).join("\n\n"),
          visualDirection: concept["description"] as string | undefined,
        }));
      });
      if (!dos?.length && !concepts?.length) {
        result.push(child("fallback", { body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── media_brief ──────────────────────────────────────────────────────────
    } else if (rawType === "media_brief") {
      const imageConcepts = c["imageConcepts"] as Array<Record<string, unknown>> | undefined;
      const videoConcepts = c["videoConcepts"] as Array<Record<string, unknown>> | undefined;
      let briefIdx = 0;
      imageConcepts?.forEach((ic, i) => {
        result.push(child(`img:${i}`, {
          platform: "ads", type: "ad", dayIndex: 1,
          title: `🖼 Criativo Imagem ${i + 1}: ${ic["concept"] as string ?? ic["headline"] as string ?? `Imagem ${i + 1}`}`,
          body: [
            ic["description"] ? (ic["description"] as string) : "",
            ic["dimensions"] ? `Dimensões: ${ic["dimensions"] as string}` : "",
          ].filter(Boolean).join("\n"),
        }));
        briefIdx++;
      });
      videoConcepts?.forEach((vc, i) => {
        result.push(child(`vid:${i}`, {
          platform: "ads", type: "ad", dayIndex: 2,
          title: `🎬 Criativo Vídeo ${i + 1}: ${vc["concept"] as string ?? vc["title"] as string ?? `Vídeo ${i + 1}`}`,
          body: [
            vc["description"] ? (vc["description"] as string) : "",
            vc["duration"] ? `Duração: ${vc["duration"] as string}` : "",
            vc["hook"] ? `Hook: ${vc["hook"] as string}` : "",
          ].filter(Boolean).join("\n"),
        }));
        briefIdx++;
      });
      if (briefIdx === 0) {
        result.push(child("fallback", { title: "📋 Brief de Mídia", body: extractBodyText(piece.content as unknown, rawType) }));
      }

    // ── compliance_report ────────────────────────────────────────────────────
    } else if (rawType === "compliance_report") {
      result.push(child("compliance", {
        platform: "landing", type: "copy", dayIndex: 7,
        title: "⚖ Relatório de Compliance",
        body: extractBodyText(piece.content as unknown, rawType),
      }));

    // ── content_calendar (social media posts) ────────────────────────────────
    } else if (rawType === "content_calendar") {
      const calendar = c["calendar"] as Array<Record<string, unknown>> | undefined;
      if (calendar?.length) {
        calendar.forEach((post, i) => {
          const platforms = (post["platforms"] as string[] | undefined) ?? ["instagram"];
          const firstPlatform = platforms[0] ?? "instagram";
          const mappedPlatform: Platform = (TYPE_TO_PLATFORM[firstPlatform] ?? "instagram") as Platform;
          result.push(child(`post:${i}`, {
            platform: mappedPlatform,
            type: (post["postType"] as PieceType) ?? "post",
            dayIndex: typeof post["day"] === "number" ? (post["day"] as number) : i,
            title: `📱 Dia ${typeof post["day"] === "number" ? (post["day"] as number) + 1 : i + 1} — ${post["phaseName"] as string ?? post["phase"] as string ?? platforms.join("/")}`,
            body: [
              post["caption"] ? (post["caption"] as string) : post["copyText"] ? (post["copyText"] as string) : "",
              post["hashtags"] && Array.isArray(post["hashtags"]) ? `\n${(post["hashtags"] as string[]).join(" ")}` : "",
              post["visualDirection"] ? `\nVisual: ${post["visualDirection"] as string}` : "",
              post["tiktokHook"] ? `\nHook TikTok: ${post["tiktokHook"] as string}` : "",
            ].filter(Boolean).join(""),
            callToAction: post["engagementTactic"] as string | undefined,
            visualDirection: post["visualDirection"] as string | undefined,
            tiktokHook: post["tiktokHook"] as string | undefined,
          }));
        });
      } else {
        result.push(child("fallback", {
          title: "📅 Calendário de Social Media",
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── ad_copy (meta/google/tiktok ads per segment) ─────────────────────────
    } else if (rawType === "ad_copy") {
      const segments = c["segments"] as Array<Record<string, unknown>> | undefined;
      let adIdx = 0;
      if (segments?.length) {
        segments.forEach((seg) => {
          const metaAds = (seg["meta"] as Array<Record<string, unknown>> | undefined) ?? [];
          const tiktokAds = (seg["tiktok"] as Array<Record<string, unknown>> | undefined) ?? [];
          const googleAds = (seg["google"] as Array<Record<string, unknown>> | undefined) ?? [];
          const allAds: Array<{ ad: Record<string, unknown>; pl: Platform }> = [
            ...metaAds.map(a => ({ ad: a, pl: "ads" as Platform })),
            ...tiktokAds.map(a => ({ ad: a, pl: "tiktok" as Platform })),
            ...googleAds.map(a => ({ ad: a, pl: "ads" as Platform })),
          ];
          allAds.forEach(({ ad, pl }) => {
            const headline = (ad["headline"] as string | undefined) ?? (
              Array.isArray(ad["headlines"]) ? (ad["headlines"] as string[])[0] : undefined
            );
            result.push(child(`ad:${adIdx}`, {
              platform: pl, type: "ad", dayIndex: 0,
              title: `🎯 Anúncio — ${seg["segmentName"] as string ?? `Segmento ${adIdx + 1}`}${headline ? `: ${headline.slice(0, 40)}` : ""}`,
              body: [
                ad["primaryText"] ? (ad["primaryText"] as string) : ad["script"] ? (ad["script"] as string).slice(0, 400) : "",
                headline ? `\nHeadline: ${headline}` : "",
                ad["description"] ? `\nDescrição: ${ad["description"] as string}` : "",
                ad["cta"] ? `\nCTA: ${ad["cta"] as string}` : "",
                ad["hook"] ? `\nHook: ${ad["hook"] as string}` : "",
              ].filter(Boolean).join(""),
              callToAction: ad["cta"] as string | undefined,
              tiktokHook: ad["hook"] as string | undefined,
              visualDirection: ad["visualDirection"] as string | undefined,
            }));
            adIdx++;
          });
        });
      }
      if (adIdx === 0) {
        result.push(child("fallback", {
          title: "🎯 Copy de Anúncios",
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── vsl_script ───────────────────────────────────────────────────────────
    } else if (rawType === "vsl_script") {
      const hook = c["hook"] as Record<string, unknown> | undefined;
      if (hook?.["openingLine"] || hook?.["bigPromise"]) {
        result.push(child("hook", {
          platform: "tiktok", type: "native_video", dayIndex: 5,
          title: `🎬 VSL — Abertura: ${(c["title"] as string | undefined) ?? "Roteiro VSL"}`,
          body: [
            hook["openingLine"] ? `Linha de Abertura:\n${hook["openingLine"] as string}` : "",
            hook["bigPromise"] ? `\nGrande Promessa:\n${hook["bigPromise"] as string}` : "",
            hook["problemStatement"] ? `\nProblema:\n${hook["problemStatement"] as string}` : "",
          ].filter(Boolean).join(""),
        }));
      }
      const sections = c["sections"] as Array<Record<string, unknown>> | undefined;
      sections?.forEach((section, i) => {
        result.push(child(`vsl_section:${i}`, {
          platform: "tiktok", type: "native_video", dayIndex: 5,
          title: `🎬 VSL — ${section["name"] as string ?? `Seção ${i + 1}`}${section["duration"] ? ` (${section["duration"] as string})` : ""}`,
          body: section["script"] ? (section["script"] as string).slice(0, 600) : "",
          visualDirection: section["voiceoverNotes"] as string | undefined,
        }));
      });
      if (!hook?.["openingLine"] && !sections?.length) {
        result.push(child("fallback", {
          title: `🎬 ${(c["title"] as string | undefined) ?? "Roteiro VSL"}`,
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── webinar_script ───────────────────────────────────────────────────────
    } else if (rawType === "webinar_script") {
      const opening = c["opening"] as Record<string, unknown> | undefined;
      if (opening?.["welcomeScript"]) {
        result.push(child("opening", {
          platform: "facebook", type: "post", dayIndex: 5,
          title: `📺 Webinar — Abertura: ${(c["title"] as string | undefined) ?? ""}`,
          body: (opening["welcomeScript"] as string).slice(0, 500),
        }));
      }
      const sections = c["sections"] as Array<Record<string, unknown>> | undefined;
      sections?.forEach((section, i) => {
        result.push(child(`webinar_section:${i}`, {
          platform: "facebook", type: "post", dayIndex: 5,
          title: `📺 Webinar — ${section["name"] as string ?? `Bloco ${i + 1}`}${section["duration"] ? ` (${section["duration"] as string})` : ""}`,
          body: section["script"] ? (section["script"] as string).slice(0, 600) : "",
        }));
      });
      if (!opening?.["welcomeScript"] && !sections?.length) {
        result.push(child("fallback", {
          title: `📺 ${(c["title"] as string | undefined) ?? "Roteiro Webinar"}`,
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── targeting_config / targeting_plan ────────────────────────────────────
    } else if (rawType === "targeting_config" || rawType === "targeting_plan") {
      const metaAudiences = (c["metaAudiences"] as Array<Record<string, unknown>> | undefined) ?? [];
      const googleAudiences = (c["googleAudiences"] as Array<Record<string, unknown>> | undefined) ?? [];
      const tiktokAudiences = (c["tiktokAudiences"] as Array<Record<string, unknown>> | undefined) ?? [];
      const allAudiences = [...metaAudiences, ...googleAudiences, ...tiktokAudiences];
      let audienceIdx = 0;
      allAudiences.forEach((audience) => {
        result.push(child(`audience:${audienceIdx}`, {
          platform: "ads", type: "ad", dayIndex: 0,
          title: `🎯 Audiência: ${audience["name"] as string ?? `Audiência ${audienceIdx + 1}`}`,
          body: [
            audience["interests"] ? `Interesses: ${JSON.stringify(audience["interests"])}` : "",
            audience["behaviors"] ? `Comportamentos: ${JSON.stringify(audience["behaviors"])}` : "",
            audience["keywords"] ? `Keywords: ${JSON.stringify(audience["keywords"])}` : "",
            audience["estimatedSize"] ? `Tamanho estimado: ${audience["estimatedSize"] as string}` : "",
            audience["rationale"] ? `Justificativa: ${audience["rationale"] as string}` : "",
          ].filter(Boolean).join("\n"),
        }));
        audienceIdx++;
      });
      if (audienceIdx === 0) {
        result.push(child("fallback", {
          title: "🎯 Audiências e Configuração de Tráfego",
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── media_buying_plan ────────────────────────────────────────────────────
    } else if (rawType === "media_buying_plan") {
      const budgetByPlatform = c["budgetByPlatform"] as Array<Record<string, unknown>> | undefined;
      let planIdx = 0;
      if (budgetByPlatform?.length) {
        budgetByPlatform.forEach((platform) => {
          result.push(child(`budget:${planIdx}`, {
            platform: "ads", type: "ad", dayIndex: 0,
            title: `💰 Media Buying — ${platform["platform"] as string ?? `Plataforma ${planIdx + 1}`}`,
            body: [
              platform["allocation"] ? `Budget: R$${platform["allocation"] as number}` : "",
              platform["percentage"] ? `Alocação: ${platform["percentage"] as number}%` : "",
              platform["rationale"] ? `Justificativa: ${platform["rationale"] as string}` : "",
            ].filter(Boolean).join("\n"),
          }));
          planIdx++;
        });
      }
      const scalingRules = c["scalingRules"] as Array<Record<string, unknown>> | undefined;
      if (scalingRules?.length && planIdx === 0) {
        result.push(child("scaling", {
          platform: "ads", type: "ad", dayIndex: 0,
          title: `💰 Regras de Escala e Kill Criteria`,
          body: scalingRules.map((r, i) =>
            `Regra ${i + 1}: ${r["trigger"] as string ?? ""} → ${r["action"] as string ?? ""}`
          ).join("\n"),
        }));
        planIdx++;
      }
      if (planIdx === 0) {
        result.push(child("fallback", {
          title: "💰 Plano de Media Buying",
          body: extractBodyText(piece.content as unknown, rawType),
        }));
      }

    // ── extraPieces — from generate-extra endpoint ────────────────────────────
    } else if (Array.isArray(c["extraPieces"]) && (c["extraPieces"] as unknown[]).length > 0) {
      const extras = c["extraPieces"] as Array<Record<string, unknown>>;
      extras.forEach((ep, i) => {
        result.push(child(`extra:${i}`, {
          platform: (ep["platform"] as Platform) ?? "instagram",
          type: (ep["type"] as PieceType) ?? "post",
          dayIndex: typeof ep["dayIndex"] === "number" ? ep["dayIndex"] : 0,
          title: (ep["title"] as string) ?? `Extra ${i + 1}`,
          body: (ep["body"] as string) ?? "",
          callToAction: ep["callToAction"] as string | undefined,
          tiktokHook: ep["tiktokHook"] as string | undefined,
          visualDirection: ep["visualDirection"] as string | undefined,
          segment: (ep["segment"] as Segment) ?? "all",
        }));
      });

    // ── generic fallback ─────────────────────────────────────────────────────
    } else {
      result.push(child("fallback", {
        id: piece.id, // use real ID for true unknowns
        body: extractBodyText(piece.content as unknown, rawType),
      }));
    }
  }

  return result;
}

// ── Social platform → OAuth provider mapping ──────────────────────────────────

interface SocialPlatformDef {
  platform: Platform;
  label: string;
  oauthProvider: string;          // matches /api/integrations/oauth/start/:provider
  dbProvider: string;             // stored in workspaceIntegrationsTable.provider
  Icon: React.ElementType;
  brand: { bg: string; border: string; text: string };
}

const SOCIAL_OAUTH_PLATFORMS: SocialPlatformDef[] = [
  {
    platform: "instagram",
    label: "Instagram",
    oauthProvider: "instagram",
    dbProvider: "instagram",
    Icon: Instagram,
    brand: { bg: "rgba(225,48,108,0.08)", border: "#e1306c", text: "#e1306c" },
  },
  {
    platform: "facebook",
    label: "Facebook",
    oauthProvider: "facebook",
    dbProvider: "meta_ads",
    Icon: Globe,
    brand: { bg: "rgba(24,119,242,0.08)", border: "#1877F2", text: "#1877F2" },
  },
  {
    platform: "tiktok",
    label: "TikTok",
    oauthProvider: "tiktok",
    dbProvider: "tiktok_ads",
    Icon: Music2,
    brand: { bg: "rgba(254,44,85,0.08)", border: "#fe2c55", text: "#fe2c55" },
  },
];

// ── Social Launch Gate ────────────────────────────────────────────────────────
// Shown after all content is approved — user must connect each social platform
// that has content pieces before the real launch button becomes active.

interface WorkspaceIntegration {
  id: string;
  provider: string;
  status: string;
  accountName?: string;
}

// ── Landing Page Preview Component ────────────────────────────────────────────

interface LandingPageSection {
  sectionId: string;
  sectionName?: string;
  order?: number;
  purpose?: string;
  layoutType?: string;
  backgroundColor?: string;
  headline: string;
  subheadline?: string;
  bodyContent?: string;
  visualElements?: string[];
  cta?: { text: string; color?: string; placement?: string };
  socialProofElement?: string;
  mobileNotes?: string;
  conversionPrinciple?: string;
  aboveTheFold?: boolean;
}

interface LandingPageData {
  pageTitle?: string;
  pageType?: string;
  metaTitle?: string;
  metaDescription?: string;
  overallStructure?: string;
  colorScheme?: { primary: string; secondary: string; accent: string; background: string; text: string };
  typography?: { headline: string; body: string; cta: string };
  aboveFoldAnalysis?: { headline: string; subheadline: string; primaryCTA: string; trustElements: string[] };
  sections?: LandingPageSection[];
  exitIntentPopup?: { headline: string; offer: string; cta: string };
  urgencyMechanisms?: { type: string; placement: string; implementation: string }[];
  landingPageNotes?: string;
}

function LandingPagePreview({
  data, onApprove, onReject, isApproved, isRejected, loading,
}: {
  data: LandingPageData;
  onApprove?: () => void;
  onReject?: () => void;
  isApproved?: boolean;
  isRejected?: boolean;
  loading?: boolean;
}) {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const sections = data.sections ?? [];
  const colorScheme = data.colorScheme;
  const primary = colorScheme?.primary ?? "hsl(var(--primary))";
  const aboveFold = data.aboveFoldAnalysis;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Meta / Info */}
      <div className="border border-border/50 bg-card/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Página de Vendas Gerada pelo agente</p>
            <h2 className="font-mono font-bold text-base uppercase tracking-wide">{data.pageTitle ?? "Página de Vendas"}</h2>
            <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">{data.metaDescription}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge variant="outline" className="rounded-none font-mono text-[10px] px-2 border-primary/30 text-primary">{data.pageType ?? "sales_page"}</Badge>
            <Badge variant="outline" className="rounded-none font-mono text-[10px] px-2 border-border/40 text-muted-foreground">{sections.length} seções</Badge>
          </div>
        </div>

        {/* Color palette */}
        {colorScheme && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Paleta:</span>
            {[colorScheme.primary, colorScheme.secondary, colorScheme.accent, colorScheme.background, colorScheme.text].filter(Boolean).map((color, i) => (
              <div key={i} className="group relative">
                <div className="w-6 h-6 border border-border/40 cursor-pointer" style={{ backgroundColor: color }} title={color} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-background border border-border/50 font-mono text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {color}
                </div>
              </div>
            ))}
            {data.typography && (
              <span className="font-mono text-[10px] text-muted-foreground/50 ml-2">{data.typography.headline}</span>
            )}
          </div>
        )}

        {/* Approval bar */}
        {(onApprove || onReject) && (
          <div className="flex gap-2 pt-2 border-t border-border/30">
            {!isApproved && !isRejected && (
              <>
                <Button size="sm" onClick={onApprove} disabled={loading} className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
                  <CheckCircle2 className="h-3 w-3" />Aprovar Estrutura
                </Button>
                <Button size="sm" variant="ghost" onClick={onReject} disabled={loading} className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-xs text-muted-foreground hover:text-destructive">
                  <XCircle className="h-3 w-3" />Rejeitar
                </Button>
              </>
            )}
            {isApproved && <span className="font-mono text-xs text-success flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Estrutura aprovada</span>}
            {isRejected && <span className="font-mono text-xs text-destructive flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Rejeitado</span>}
          </div>
        )}
      </div>

      {/* Above the fold */}
      {aboveFold && (
        <div className="border border-primary/20 bg-primary/5 p-0 overflow-hidden">
          <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Above the Fold — Primeira Dobra</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="border-l-2 pl-4" style={{ borderColor: primary }}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Headline Principal</p>
              <p className="font-mono text-sm font-bold text-foreground leading-tight">{aboveFold.headline}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Sub-headline</p>
              <p className="font-mono text-xs text-muted-foreground/80">{aboveFold.subheadline}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="border px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest" style={{ borderColor: primary, color: primary, backgroundColor: `${primary}18` }}>
                {aboveFold.primaryCTA}
              </div>
            </div>
            {(aboveFold.trustElements ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {aboveFold.trustElements.map((t, i) => (
                  <span key={i} className="font-mono text-[10px] text-muted-foreground/60 border border-border/30 px-2 py-0.5">✓ {t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sections wireframe */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">Estrutura da Página — {sections.length} Seções</p>
        {sections.map((section, i) => {
          const isExpanded = expandedSection === i;
          const isAboveFold = section.aboveTheFold;
          return (
            <div key={i} className={`border transition-colors ${isAboveFold ? "border-primary/30 bg-primary/3" : "border-border/40 bg-card/30"} hover:border-border/70`}>
              {/* Section header */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className={`w-6 h-6 border flex items-center justify-center shrink-0 font-mono text-[10px] font-bold ${isAboveFold ? "border-primary/40 text-primary" : "border-border/40 text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold uppercase tracking-wide truncate">{section.headline}</span>
                    {isAboveFold && <span className="font-mono text-[9px] text-primary border border-primary/30 px-1.5 py-0.5">FOLD</span>}
                    {section.cta && <span className="font-mono text-[9px] text-green-400 border border-green-400/30 px-1.5 py-0.5">CTA</span>}
                  </div>
                  {section.purpose && !isExpanded && (
                    <p className="font-mono text-[10px] text-muted-foreground/50 truncate mt-0.5">{section.purpose}</p>
                  )}
                </div>
                {section.layoutType && (
                  <span className="font-mono text-[9px] text-muted-foreground/40 border border-border/20 px-1.5 py-0.5 shrink-0 hidden sm:block">{section.layoutType}</span>
                )}
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                  {section.subheadline && (
                    <div className="pt-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Sub-headline</p>
                      <p className="font-mono text-xs text-muted-foreground/80 italic">"{section.subheadline}"</p>
                    </div>
                  )}
                  {section.bodyContent && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Copy do Corpo</p>
                      <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{section.bodyContent}</p>
                    </div>
                  )}
                  {section.purpose && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Objetivo da Seção</p>
                      <p className="font-mono text-xs text-muted-foreground/70">{section.purpose}</p>
                    </div>
                  )}
                  {section.conversionPrinciple && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Princípio de Conversão</p>
                      <p className="font-mono text-xs text-primary/80">{section.conversionPrinciple}</p>
                    </div>
                  )}
                  {section.visualElements && section.visualElements.length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Elementos Visuais</p>
                      <div className="flex flex-wrap gap-1.5">
                        {section.visualElements.map((el, j) => (
                          <span key={j} className="font-mono text-[10px] border border-border/30 bg-muted/10 px-2 py-0.5 text-muted-foreground/70">{el}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {section.cta && (
                    <div className="border border-green-400/20 bg-green-400/5 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-green-400/70 mb-1.5">CTA desta Seção</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-green-400 border border-green-400/40 px-3 py-1.5">{section.cta.text}</span>
                        {section.cta.placement && <span className="font-mono text-[10px] text-muted-foreground/50">Posição: {section.cta.placement}</span>}
                      </div>
                    </div>
                  )}
                  {section.socialProofElement && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Prova Social</p>
                      <p className="font-mono text-xs text-muted-foreground/70">{section.socialProofElement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Exit Intent */}
      {data.exitIntentPopup && (
        <div className="border border-border/40 bg-card/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Pop-up de Saída</p>
          <p className="font-mono text-xs font-bold">{data.exitIntentPopup.headline}</p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">{data.exitIntentPopup.offer}</p>
          <span className="font-mono text-[10px] text-primary border border-primary/30 px-2 py-0.5 inline-block mt-1.5">{data.exitIntentPopup.cta}</span>
        </div>
      )}

      {/* Urgency */}
      {data.urgencyMechanisms && data.urgencyMechanisms.length > 0 && (
        <div className="border border-border/40 bg-card/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Mecanismos de Urgência</p>
          <div className="space-y-2">
            {data.urgencyMechanisms.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-[9px] text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 shrink-0 mt-0.5">{m.type}</span>
                <span className="font-mono text-xs text-muted-foreground/70">{m.implementation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.landingPageNotes && (
        <div className="border border-border/30 bg-muted/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Notas do Agente de CRO</p>
          <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{data.landingPageNotes}</p>
        </div>
      )}
    </div>
  );
}

function SocialLaunchGate({
  activePlatforms,
  onLaunch,
  launching,
}: {
  activePlatforms: Platform[];
  onLaunch: () => void;
  launching: boolean;
}) {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);

  const { data: integrationsData, refetch: refetchIntegrations } = useQuery({
    queryKey: ["/api/workspaces/me/integrations", "gate"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as WorkspaceIntegration[] };
      return res.json() as Promise<{ integrations: WorkspaceIntegration[] }>;
    },
    staleTime: 10_000,
  });

  const integrations = integrationsData?.integrations ?? [];

  // Determine which social platforms need to be connected
  const required = SOCIAL_OAUTH_PLATFORMS.filter(def =>
    activePlatforms.includes(def.platform)
  );

  const isConnected = (def: SocialPlatformDef) =>
    integrations.some(i => i.provider === def.dbProvider && i.status === "connected");

  const allConnected = required.every(def => isConnected(def));

  const handleOAuth = useCallback(async (def: SocialPlatformDef) => {
    setConnecting(def.oauthProvider);
    try {
      const body = await customFetch<{ url: string }>(
        `/api/integrations/oauth/start/${def.oauthProvider}`
      );
      const popup = window.open(body.url, "nexos_oauth", "width=620,height=700,scrollbars=yes,resizable=yes");
      if (!popup) {
        toast.error("Popup bloqueado. Permita popups para este site e tente novamente.");
        setConnecting(null);
        return;
      }
      const handler = (event: MessageEvent<{ type?: string; success?: boolean; error?: string }>) => {
        if (event.data?.type !== "oauth_complete") return;
        window.removeEventListener("message", handler);
        clearInterval(timer);
        setConnecting(null);
        if (event.data.success) {
          toast.success(`${def.label} conectado com sucesso!`);
          void refetchIntegrations();
          void queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
        } else {
          toast.error(event.data.error ?? `Falha ao conectar ${def.label}`);
        }
      };
      window.addEventListener("message", handler);
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handler);
          setConnecting(null);
        }
      }, 600);
    } catch (err) {
      setConnecting(null);
      if (err instanceof ApiError) {
        const data = err.data as { code?: string; error?: string } | null;
        if (data?.code === "OAUTH_NOT_CONFIGURED") {
          const platform = def.platform === "facebook" || def.platform === "instagram" ? "META_APP_ID e META_APP_SECRET" : "TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET";
          toast.error(`OAuth do ${def.label} não configurado. O administrador precisa definir ${platform} nas variáveis de ambiente.`, { duration: 7000 });
        } else {
          toast.error(data?.error ?? `Erro ao conectar ${def.label}: ${err.message}`);
        }
      } else {
        toast.error(`Erro de rede ao conectar ${def.label}. Verifique sua conexão.`);
      }
    }
  }, [refetchIntegrations, queryClient]);

  // If no social platforms require OAuth (e.g. only email/whatsapp/ads), skip gate
  if (required.length === 0) {
    return (
      <Button
        onClick={onLaunch}
        disabled={launching}
        className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs flex-1 sm:flex-none"
      >
        {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Lançar<ArrowRight className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="border border-primary/30 bg-card/60 mt-5">
      {/* Header */}
      <div className="border-b border-border/40 px-5 py-4 flex items-center gap-3">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
            Conectar Plataformas Antes de Lançar
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
            A NexOS vai postar automaticamente em seu nome. Conecte cada rede social com sua conta para liberar o lançamento.
          </p>
        </div>
      </div>

      {/* Platform rows */}
      <div className="divide-y divide-border/30">
        {required.map(def => {
          const connected = isConnected(def);
          const isLoading = connecting === def.oauthProvider;
          const integration = integrations.find(i => i.provider === def.dbProvider && i.status === "connected");

          return (
            <div key={def.platform} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              {/* Top row: icon + name (always visible together) */}
              <div className="flex items-center gap-3 sm:contents">
                <div
                  className="w-9 h-9 border flex items-center justify-center shrink-0"
                  style={{ borderColor: def.brand.border, background: def.brand.bg }}
                >
                  <def.Icon className="h-4 w-4" style={{ color: def.brand.text }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-bold">{def.label}</div>
                  {connected && integration?.accountName ? (
                    <div className="font-mono text-[11px] text-success mt-0.5">
                      Conectado como {integration.accountName}
                    </div>
                  ) : (
                    <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">
                      Faça login para autorizar a publicação
                    </div>
                  )}
                </div>
              </div>

              {/* Status / Connect button — full-width on mobile */}
              {connected ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono text-[11px] text-success uppercase tracking-widest">Conectado</span>
                </div>
              ) : (
                <button
                  onClick={() => void handleOAuth(def)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 h-9 font-mono text-[11px] uppercase tracking-widest border transition-all shrink-0 disabled:opacity-50"
                  style={{ borderColor: def.brand.border, color: def.brand.text, background: def.brand.bg }}
                >
                  {isLoading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Conectando...</>
                    : <><Link2 className="h-3.5 w-3.5" />Entrar com {def.label.split(" ")[0]}</>
                  }
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Launch button — unlocks when all connected */}
      <div className="border-t border-border/40 px-5 py-4">
        {allConnected ? (
          <Button
            onClick={onLaunch}
            disabled={launching}
            className="w-full rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-11"
          >
            {launching
              ? <><Loader2 className="h-4 w-4 animate-spin" />Iniciando lançamento...</>
              : <><Send className="h-4 w-4" />Confirmar e Lançar Campanha<ArrowRight className="h-4 w-4" /></>
            }
          </Button>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground/50">
            <div className="flex-1 h-px bg-border/30" />
            <span className="font-mono text-[11px] uppercase tracking-widest">
              {required.filter(d => !isConnected(d)).length} plataforma{required.filter(d => !isConnected(d)).length !== 1 ? "s" : ""} pendente{required.filter(d => !isConnected(d)).length !== 1 ? "s" : ""}
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Tab = "platform" | "preview" | "flowchart" | "schedule" | "segmentation" | "landing";

const VISUAL_PLATFORMS: Platform[] = ["instagram", "facebook", "tiktok"];

export default function ContentApproval() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("platform");
  const [cinemaActive, setCinemaActive] = useState(false);
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [loadingPiece, setLoadingPiece] = useState<string | null>(null);
  const [rejectingPiece, setRejectingPiece] = useState<ContentPiece | null>(null);
  const [rewritingPiece, setRewritingPiece] = useState<string | null>(null);
  const [generateMoreTarget, setGenerateMoreTarget] = useState<Platform | null>(null);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [localPieces, setLocalPieces] = useState<ContentPiece[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<Platform | "all">("all");
  const [regeneratingContent, setRegeneratingContent] = useState(false);

  const [, setLocation] = useLocation();

  const { data: campaignData, isLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}`],
    queryFn: async () => {
      try {
        return await customFetch<{ campaign: { id: string; title: string; status: string } }>(`/api/campaigns/${campaignId}`);
      } catch {
        return null;
      }
    },
    enabled: !!campaignId,
  });

  const [contentFetchError, setContentFetchError] = useState<string | null>(null);

  const { data: apiContentData, isLoading: isContentLoading, refetch: refetchContent } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    queryFn: async () => {
      try {
        setContentFetchError(null);
        const result = await customFetch<{ pieces: ApiContentPiece[]; total?: number }>(`/api/campaigns/${campaignId}/content`);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar conteúdo";
        console.error("[content] fetch failed:", msg, err);
        setContentFetchError(msg);
        return null;
      }
    },
    enabled: !!campaignId,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      const campaignStatus = campaignData?.campaign?.status;
      if (
        campaignStatus === "awaiting_approval" &&
        (!data?.pieces?.length)
      ) return 4000;
      return false;
    },
  });

  // Transition campaign from awaiting_approval → approved when user approves all content
  const approveCampaignMutation = useMutation({
    mutationFn: async () => {
      return await customFetch<{ campaign: unknown }>(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
    },
    onSuccess: () => {
      toast.success("Conteúdo aprovado! Iniciando lançamento...");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      setLocation(`/campaigns/${campaignId}?autolaunch=1`);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao aprovar campanha");
    },
  });

  const campaign = campaignData?.campaign;

  const realPieces: ContentPiece[] | null = (() => {
    if (!apiContentData?.pieces?.length) return null;
    try {
      const expanded = expandApiPieces(apiContentData.pieces);
      return expanded.length > 0 ? expanded : null;
    } catch (err) {
      console.error("[content] expandApiPieces failed", err);
      return null;
    }
  })();

  const pieces: ContentPiece[] = localPieces ?? realPieces ?? [];
  const approvedCount = pieces.filter(p => p.status === "approved").length;
  const pendingCount  = pieces.filter(p => p.status === "pending").length;
  const rejectedCount = pieces.filter(p => p.status === "rejected").length;
  const pct = pieces.length > 0 ? Math.round((approvedCount / pieces.length) * 100) : 0;

  const setPieces = (fn: (prev: ContentPiece[]) => ContentPiece[]) => {
    setLocalPieces(prev => fn(prev ?? pieces));
  };

  const handleApprove = async (id: string) => {
    // Mark locally first for instant feedback
    setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
    setLoadingPiece(id);
    try {
      const parentId = getParentId(id);
      await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${parentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      toast.success("Peça aprovada");
    } catch {
      // Revert on failure
      setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "pending" } : p));
      toast.error("Erro ao aprovar peça");
    } finally {
      setLoadingPiece(null);
    }
  };
  const handleReject = (id: string) => {
    const piece = pieces.find(p => p.id === id);
    if (piece) setRejectingPiece(piece);
  };

  const handleRejectWithFeedback = async (id: string, reason: string) => {
    setRejectingPiece(null);
    setRewritingPiece(id);
    setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "rejected" } : p));
    try {
      const parentId = getParentId(id);
      // 1. Reject with reason
      await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${parentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "" }),
      }).catch(() => null);
      // 2. Rewrite with AI using the feedback
      await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${parentId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: reason || "" }),
      });
      // 3. Refresh from API — piece now has new content + status pending_approval
      setLocalPieces(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.success("Agente reescreveu com base no seu feedback. Revise e aprove.");
    } catch {
      toast.error("Erro ao processar rejeição e reescrita com o agente.");
      setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "pending" } : p));
    } finally {
      setRewritingPiece(null);
    }
  };

  const handleAiRewrite = async (id: string) => {
    setRewritingPiece(id);
    try {
      const parentId = getParentId(id);
      await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${parentId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      setLocalPieces(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.success("Equipe reescreveu. Revise e aprove.");
    } catch {
      toast.error("Erro ao reescrever com o agente");
    } finally {
      setRewritingPiece(null);
    }
  };
  const handleGenerateMore = async (platform: Platform, count: number, instructions: string) => {
    setGeneratingMore(true);
    try {
      await customFetch<{ message: string }>(`/api/campaigns/${campaignId}/content/generate-extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, count, instructions }),
      });
      setGenerateMoreTarget(null);
      setLocalPieces(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.success(`${count} nova${count !== 1 ? "s" : ""} peça${count !== 1 ? "s" : ""} de ${PLATFORM_LABEL[platform]} gerada${count !== 1 ? "s" : ""} pelo agente!`);
    } catch {
      toast.error("Erro ao gerar peças. Tente novamente.");
    } finally {
      setGeneratingMore(false);
    }
  };

  const handleSaveEdit = (id: string, body: string, cta: string) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, body, callToAction: cta, status: "approved" } : p));
    setEditingPiece(null);
    toast.success("Peça editada e aprovada");
  };
  const handleApproveAll = async () => {
    const pendingPieces = pieces.filter(p => p.status === "pending");
    // Mark all approved locally immediately
    setPieces(prev => prev.map(p => p.status === "pending" ? { ...p, status: "approved" } : p));
    // Deduplicate parent IDs to avoid duplicate API calls
    const parentIds = [...new Set(pendingPieces.map(p => getParentId(p.id)))];
    for (const parentId of parentIds) {
      await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${parentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      }).catch(() => null);
    }
    toast.success(`${pendingPieces.length} peças aprovadas`);
    // If campaign is awaiting_approval, transition it to approved and redirect to launch
    if (campaign?.status === "awaiting_approval") {
      approveCampaignMutation.mutate();
    }
  };

  const handleRegenerateContent = async () => {
    setRegeneratingContent(true);
    try {
      await customFetch<{ message?: string }>(`/api/campaigns/${campaignId}/execute/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      toast.success("Agentes ativados. Novo conteúdo sendo gerado — acompanhe o progresso na campanha.");
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      setLocation(`/campaigns/${campaignId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao regenerar conteúdo");
    } finally {
      setRegeneratingContent(false);
    }
  };

  const byPlatform = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    if (!acc[p.platform]) acc[p.platform] = [];
    acc[p.platform].push(p);
    return acc;
  }, {});
  const byDay = pieces.reduce<Record<number, ContentPiece[]>>((acc, p) => {
    if (!acc[p.dayIndex]) acc[p.dayIndex] = [];
    acc[p.dayIndex].push(p);
    return acc;
  }, {});
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const bySegment = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    const seg = p.segment ?? "all";
    if (!acc[seg]) acc[seg] = [];
    acc[seg].push(p);
    return acc;
  }, {});

  // Visual preview: only social platforms that support visual mockups
  const previewPieces = pieces.filter(p =>
    VISUAL_PLATFORMS.includes(p.platform) &&
    (previewFilter === "all" || p.platform === previewFilter)
  );

  if (isLoading || isContentLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 bg-muted/20" />)}</div>
      </div>
    );
  }

  if (pieces.length === 0) {
    const isAwaitingApproval = campaign?.status === "awaiting_approval" || campaign?.status === "generating";
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border-b border-border/50 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Link href={`/campaigns/${campaignId}`}>
              <button className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                <ChevronLeft className="h-3 w-3" />Campanha
              </button>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-mono uppercase tracking-tighter font-bold">
            Aprovação de Conteúdo
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
            {campaign?.title ?? "Campanha"}
          </p>
        </div>

        {contentFetchError ? (
          <div className="py-16 text-center border border-dashed border-destructive/30">
            <AlertTriangle className="h-8 w-8 text-destructive/50 mx-auto mb-3" />
            <p className="font-mono text-xs text-destructive uppercase tracking-widest mb-2">
              Erro ao carregar conteúdo
            </p>
            <p className="font-mono text-[11px] text-muted-foreground/50 max-w-sm mx-auto mb-4">
              {contentFetchError}
            </p>
            <Button
              onClick={() => void refetchContent()}
              className="rounded-none font-mono uppercase tracking-widest gap-1.5 h-9 text-xs"
              variant="outline"
            >
              Tentar Novamente
            </Button>
          </div>
        ) : isAwaitingApproval ? (
          <div className="py-16 text-center border border-dashed border-primary/20">
            <div className="relative mx-auto mb-4 w-8 h-8">
              <Activity className="h-8 w-8 text-primary/40 mx-auto animate-pulse" />
            </div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Carregando peças de conteúdo…
            </p>
            <p className="font-mono text-[11px] text-muted-foreground/50 max-w-sm mx-auto mb-4">
              Os agentes concluíram. Sincronizando peças de conteúdo com o servidor.
            </p>
            <Button
              onClick={() => void refetchContent()}
              variant="outline"
              className="rounded-none font-mono uppercase tracking-widest gap-1.5 h-9 text-xs"
            >
              Atualizar Agora
            </Button>
          </div>
        ) : (
          <div className="py-16 text-center border border-dashed border-border/30">
            <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Conteúdo ainda não gerado
            </p>
            <p className="font-mono text-[11px] text-muted-foreground/50 max-w-sm mx-auto mb-4">
              Execute a fase de geração de conteúdo na campanha para que os especialistas criem as peças de copy e visual.
            </p>
            <Link href={`/campaigns/${campaignId}`}>
              <Button className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />Voltar à Campanha
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Raw landing page piece from API (not flattened into ContentPiece children)
  const rawLandingPiece = apiContentData?.pieces?.find(p => p.type === "landing_page_structure");
  const landingPageData = rawLandingPiece?.content as LandingPageData | undefined;

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: "flowchart",    label: "Fluxograma",      icon: Activity },
    { id: "preview",      label: "Preview Visual",  icon: Eye },
    { id: "platform",     label: "Por Plataforma",  icon: Globe },
    { id: "schedule",     label: "Cronograma",      icon: Calendar },
    { id: "segmentation", label: "Segmentação",     icon: Users },
    ...(landingPageData ? [{ id: "landing" as Tab, label: "Landing Page", icon: Globe, badge: "LP" }] : []),
  ];

  // Build cinema pieces from current pieces
  const cinemaPieces: CinemaPiece[] = pieces
    .filter(p => p.status === "pending")
    .map(p => ({
      id: p.id,
      platform: p.platform,
      type: p.type,
      title: p.title,
      body: p.body,
      hook: p.tiktokHook,
      headline: undefined,
      cta: p.callToAction,
      dayIndex: p.dayIndex,
      status: p.status,
    }));

  return (
    <>
      {cinemaActive && cinemaPieces.length > 0 && (
        <ContentCinemaOverlay
          pieces={cinemaPieces}
          onClose={() => setCinemaActive(false)}
          onApprove={(id) => void handleApprove(id)}
          onReject={(id) => {
            const piece = pieces.find(p => p.id === id);
            if (piece) setRejectingPiece(piece);
          }}
        />
      )}
      {generateMoreTarget && (
        <GenerateMoreModal
          platform={generateMoreTarget}
          platformLabel={PLATFORM_LABEL[generateMoreTarget]}
          onClose={() => setGenerateMoreTarget(null)}
          onConfirm={(count, instructions) => void handleGenerateMore(generateMoreTarget, count, instructions)}
          loading={generatingMore}
        />
      )}
      {rejectingPiece && (
        <RejectModal
          piece={rejectingPiece}
          onClose={() => setRejectingPiece(null)}
          onConfirm={(reason) => handleRejectWithFeedback(rejectingPiece.id, reason)}
          loading={rewritingPiece === rejectingPiece.id}
        />
      )}
      {editingPiece && (
        <EditModal piece={editingPiece} onClose={() => setEditingPiece(null)} onSave={handleSaveEdit} />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="border-b border-border/50 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Link href={`/campaigns/${campaignId}`}>
              <button className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                <ChevronLeft className="h-3 w-3" />Campanha
              </button>
            </Link>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                <h1 className="text-xl sm:text-2xl font-mono uppercase tracking-tighter font-bold">Aprovação de Conteúdo</h1>
              </div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest line-clamp-1">
                {campaign?.title ?? "Campanha"} · {pieces.length} peças · {pct}% aprovadas
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {/* When live: offer content regeneration via agents */}
              {campaign?.status === "live" && (
                <Button
                  onClick={() => void handleRegenerateContent()}
                  disabled={regeneratingContent}
                  variant="outline"
                  className="rounded-none font-mono uppercase tracking-widest gap-1.5 border-primary/40 text-primary hover:bg-primary/10 h-9 text-xs flex-1 sm:flex-none"
                >
                  {regeneratingContent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {regeneratingContent ? "Regenerando..." : "Regenerar Conteúdo"}
                </Button>
              )}
              {/* When all approved but still awaiting: explicit launch CTA */}
              {campaign?.status === "awaiting_approval" && pendingCount === 0 && approvedCount > 0 && (
                <Button
                  onClick={() => approveCampaignMutation.mutate()}
                  disabled={approveCampaignMutation.isPending}
                  className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs flex-1 sm:flex-none"
                >
                  {approveCampaignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  Aprovar e Lançar
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  onClick={() => setCinemaActive(true)}
                  variant="outline"
                  className="rounded-none font-mono uppercase tracking-widest gap-1.5 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 h-9 text-xs flex-1 sm:flex-none"
                >
                  <Eye className="h-3.5 w-3.5" />Cinema Mode ({pendingCount})
                </Button>
              )}
              {pendingCount > 0 && (
                <Button onClick={() => void handleApproveAll()} className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs flex-1 sm:flex-none">
                  <CheckCircle2 className="h-3.5 w-3.5" />Aprovar Tudo ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 bg-muted/20 relative overflow-hidden">
              <div className="h-full bg-success transition-all duration-700" style={{ width: `${pct}%` }} />
              {rejectedCount > 0 && (
                <div className="absolute top-0 right-0 h-full bg-destructive/50 transition-all duration-700"
                     style={{ width: `${Math.round((rejectedCount / pieces.length) * 100)}%` }} />
              )}
            </div>
            <div className="flex gap-4 font-mono text-[10px] text-muted-foreground/50">
              <span className="text-success">{approvedCount} aprovadas</span>
              <span>{pendingCount} pendentes</span>
              {rejectedCount > 0 && <span className="text-destructive">{rejectedCount} rejeitadas</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border border-border/50 bg-card/40 p-1 w-full overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center
                  ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                <Icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && (
                  <span className={`ml-0.5 font-mono text-[8px] px-1 py-0.5 border ${activeTab === tab.id ? "border-primary-foreground/40 text-primary-foreground/80" : "border-primary/40 text-primary"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Flowchart Tab ── */}
        {activeTab === "flowchart" && (
          <CampaignFlowchart pieces={pieces} />
        )}

        {/* ── Preview Visual Tab ── */}
        {activeTab === "preview" && (
          <div className="space-y-5">
            {/* Platform filter */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground shrink-0">Plataforma:</span>
              {([["all", "Todas", Globe], ["instagram", "Instagram", Instagram], ["facebook", "Facebook", Globe], ["tiktok", "TikTok", Music2]] as [Platform | "all", string, React.ElementType][]).map(([val, label, Icon]) => (
                <button key={val} onClick={() => setPreviewFilter(val)}
                  className={`flex items-center gap-1.5 px-3 h-7 font-mono text-[11px] uppercase tracking-widest border transition-all
                    ${previewFilter === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"}`}>
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
              <span className="font-mono text-[11px] text-muted-foreground/40 ml-2">
                {previewPieces.length} peça{previewPieces.length !== 1 ? "s" : ""} com preview visual
              </span>
            </div>

            {/* Preview grid */}
            {previewPieces.length === 0 ? (
              <div className="text-center py-16 font-mono text-sm text-muted-foreground/40 uppercase tracking-widest">
                Nenhuma peça visual para esta plataforma
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {previewPieces.map(piece => (
                  <SocialPostPreview
                    key={piece.id}
                    piece={piece}
                    showMetrics
                    onApprove={handleApprove}
                    onReject={handleReject}
                    loading={loadingPiece}
                  />
                ))}
              </div>
            )}

            {/* Non-visual platforms notice */}
            {previewFilter === "all" && (
              <div className="border border-border/30 bg-muted/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
                    E-mail, WhatsApp e Ads
                  </span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  {pieces.filter(p => !VISUAL_PLATFORMS.includes(p.platform)).length} peças de e-mail, WhatsApp e Ads estão disponíveis na aba "Por Plataforma" com aprovação individual.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Platform Tab ── */}
        {activeTab === "platform" && (
          <div className="space-y-10">
            {Object.entries(byPlatform).map(([platform, platformPieces]) => {
              const PIcon = PLATFORM_ICON[platform as Platform] ?? Globe;
              const pColor = PLATFORM_COLOR[platform as Platform] ?? "text-muted-foreground border-border/40";
              const approvedCount = platformPieces.filter(p => p.status === "approved").length;
              const isVisual = VISUAL_PLATFORMS.includes(platform as Platform);
              return (
                <div key={platform}>
                  {/* Platform header */}
                  <div className="flex items-center gap-3 mb-4 border-b border-border/40 pb-3">
                    <div className={`w-8 h-8 border flex items-center justify-center ${pColor}`}>
                      <PIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="font-mono text-sm uppercase tracking-widest font-bold">{PLATFORM_LABEL[platform as Platform]}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/50 ml-3">
                        {approvedCount}/{platformPieces.length} aprovadas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                    {/* Generate more pieces */}
                    <button
                      onClick={() => setGenerateMoreTarget(platform as Platform)}
                      className="font-mono text-[11px] uppercase tracking-widest border border-primary/30 text-primary px-3 h-7 flex items-center gap-1.5 hover:bg-primary/10 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />+ Gerar mais
                    </button>
                    {/* Approve all for this platform */}
                    {platformPieces.some(p => p.status === "pending") && (
                      <button
                        onClick={async () => {
                          const ids = platformPieces.filter(p => p.status === "pending").map(p => p.id);
                          for (const id of ids) {
                            await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/approve`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ feedback: "" }),
                            }).catch(() => null);
                          }
                          queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
                          toast.success(`${PLATFORM_LABEL[platform as Platform]}: ${ids.length} peças aprovadas`);
                        }}
                        className={`font-mono text-[11px] uppercase tracking-widest border px-3 h-7 flex items-center gap-1.5 transition-colors ${pColor} hover:bg-current/10`}
                      >
                        <CheckCircle2 className="h-3 w-3" />Aprovar tudo
                      </button>
                    )}
                    </div>
                  </div>

                  {/* Visual mocks for social platforms */}
                  {isVisual ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {platformPieces.map(piece => (
                        <div key={piece.id} className="space-y-2">
                          <SocialPostPreview
                            piece={piece}
                            showMetrics
                            onApprove={handleApprove}
                            onReject={handleReject}
                            loading={loadingPiece}
                          />
                          {/* Extra actions under each mock */}
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => setEditingPiece(piece)} className="font-mono text-[11px] uppercase tracking-widest border border-border/40 text-muted-foreground hover:text-foreground hover:border-border px-2 h-6 flex items-center gap-1 transition-colors">
                              <Edit3 className="h-2.5 w-2.5" />Editar
                            </button>
                            <button onClick={() => void handleAiRewrite(piece.id)} disabled={loadingPiece === piece.id} className="font-mono text-[11px] uppercase tracking-widest border border-primary/30 text-primary hover:bg-primary/10 px-2 h-6 flex items-center gap-1 transition-colors">
                              <Sparkles className="h-2.5 w-2.5" />Reescrever
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Text-based platforms: email, whatsapp, ads, landing */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {platformPieces.map(piece => (
                        <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} rewriting={rewritingPiece} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Schedule Tab ── */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            {days.map(day => {
              const dayPieces = byDay[day]!;
              const phaseLabel =
                day === 0 ? "Pré-Lançamento — Antecipação" :
                day <= 2  ? "Pré-Lançamento — Autoridade" :
                day <= 4  ? "Pré-Lançamento — Desejo" :
                day === 5 ? "🚀 Abertura do Carrinho" :
                day === 6 ? "Meio do Carrinho — Prova Social" :
                day === 7 ? "⚡ Fechamento — Urgência Máxima" :
                `Dia ${day}`;
              const phaseReach = dayPieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
              const phaseLeads = dayPieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
              return (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-xs text-primary">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold uppercase tracking-widest">{phaseLabel}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="font-mono text-[11px] text-muted-foreground/50">{dayPieces.length} peça{dayPieces.length !== 1 ? "s" : ""}</span>
                        <span className="font-mono text-[11px] text-cyan-400/70">~{phaseReach.toLocaleString("pt-BR")} alcance</span>
                        <span className="font-mono text-[11px] text-success/70">~{phaseLeads} leads</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayPieces.map(piece => (
                      <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} rewriting={rewritingPiece} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Segmentation Tab ── */}
        {activeTab === "segmentation" && (
          <div className="space-y-8">
            {Object.entries(bySegment).map(([segment, segPieces]) => (
              <div key={segment}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={`rounded-none font-mono text-xs px-2 py-1 uppercase tracking-widest ${SEGMENT_COLOR[segment] ?? ""}`}>
                    {SEGMENT_LABEL[segment] ?? segment}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground/50">{segPieces.length} peça{segPieces.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {segPieces.map(piece => (
                    <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} rewriting={rewritingPiece} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Landing Page Tab ── */}
        {activeTab === "landing" && (
          <div>
            {landingPageData ? (
              <LandingPagePreview
                data={landingPageData}
                onApprove={rawLandingPiece ? () => void handleApprove(rawLandingPiece.id) : undefined}
                onReject={rawLandingPiece ? async () => {
                  setLoadingPiece(rawLandingPiece.id);
                  try {
                    await customFetch<{ piece: unknown }>(`/api/campaigns/${campaignId}/content/${rawLandingPiece.id}/reject`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: "Estrutura rejeitada — gerar nova versão" }),
                    });
                    await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
                    toast.success("Estrutura da landing page rejeitada.");
                  } catch { toast.error("Erro ao rejeitar"); }
                  finally { setLoadingPiece(null); }
                } : undefined}
                isApproved={rawLandingPiece?.status === "approved"}
                isRejected={rawLandingPiece?.status === "rejected"}
                loading={loadingPiece === rawLandingPiece?.id}
              />
            ) : (
              <div className="text-center py-20 font-mono text-sm text-muted-foreground/40 uppercase tracking-widest">
                Landing page ainda não gerada
              </div>
            )}
          </div>
        )}

        {/* ── Social Launch Gate — appears when all content approved ── */}
        {pieces.length > 0 && approvedCount === pieces.length && (
          <SocialLaunchGate
            activePlatforms={Object.keys(byPlatform) as Platform[]}
            onLaunch={() => approveCampaignMutation.mutate()}
            launching={approveCampaignMutation.isPending}
          />
        )}
      </div>
    </>
  );
}
