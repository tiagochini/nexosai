import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
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
} from "lucide-react";
import { SocialPostPreview, estimatePostMetrics } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";

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

function ContentCard({ piece, onApprove, onReject, onEdit, onAiRewrite, loading }: {
  piece: ContentPiece;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (piece: ContentPiece) => void;
  onAiRewrite: (id: string) => void;
  loading?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const PlatformIcon = PLATFORM_ICON[piece.platform] ?? Globe;
  const platformColor = PLATFORM_COLOR[piece.platform] ?? "text-muted-foreground border-border/40";
  const statusBorder = piece.status === "approved" ? "border-success/40" : piece.status === "rejected" ? "border-destructive/40" : "border-border/50";
  const isLoading = loading === piece.id;
  const m = estimatePostMetrics(piece);

  return (
    <div className={`border bg-card/40 transition-all relative overflow-hidden ${statusBorder}`}>
      <div className={`absolute left-0 inset-y-0 w-[3px] ${piece.status === "approved" ? "bg-success" : piece.status === "rejected" ? "bg-destructive" : "bg-border/30"}`} />
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
            <span className="font-mono text-[10px] text-purple-400 uppercase tracking-widest">Visual IA: </span>
            <span className="font-mono text-[11px] text-foreground/70">{piece.visualDirection.slice(0, 80)}...</span>
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

        <div className="flex gap-2 flex-wrap">
          {piece.status !== "approved" && (
            <Button size="sm" onClick={() => onApprove(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 bg-success/10 border border-success/40 text-success hover:bg-success/20">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Aprovar
            </Button>
          )}
          {piece.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={() => onReject(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
              <XCircle className="h-3 w-3" />Rejeitar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(piece)} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-muted-foreground hover:text-foreground">
            <Edit3 className="h-3 w-3" />Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAiRewrite(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-primary hover:text-primary hover:bg-primary/10">
            <Sparkles className="h-3 w-3" />IA Reescrever
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
  content: string;
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
  audience_profile: "email",
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
  audience_profile: "email",
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
  audience_profile: "Perfil de Audiência",
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
          if (concept["description"]) lines.push(`${(concept["description"] as string).slice(0, 200)}`);
        });
      }
      return lines.join("\n");
    }
    if (type === "media_brief") {
      lines.push(`── BRIEF DE MÍDIA — ${c["campaignTitle"] as string ?? ""} ──`);
      const imageConcepts = c["imageConcepts"] as Array<Record<string, unknown>> | undefined;
      if (imageConcepts?.length) {
        lines.push(`\nCONCEITOS DE IMAGEM (${imageConcepts.length}):`);
        imageConcepts.forEach((ic, i) => lines.push(`${i + 1}. ${JSON.stringify(ic).slice(0, 150)}`));
      }
      const videoConcepts = c["videoConcepts"] as Array<Record<string, unknown>> | undefined;
      if (videoConcepts?.length) {
        lines.push(`\nCONCEITOS DE VÍDEO (${videoConcepts.length}):`);
        videoConcepts.forEach((vc, i) => lines.push(`${i + 1}. ${JSON.stringify(vc).slice(0, 150)}`));
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
        (conar["issues"] as unknown[]).forEach(issue => lines.push(`• ${JSON.stringify(issue).slice(0, 100)}`));
      }
      const notes = c["complianceNotes"] as string | undefined;
      if (notes) lines.push(`\nObservações:\n${notes.slice(0, 600)}`);
      return lines.join("\n");
    }
  } catch { /* fallback */ }
  try { return JSON.stringify(obj, null, 2).slice(0, 3000); } catch { return String(obj); }
}

function mapApiPiece(p: ApiContentPiece, idx: number): ContentPiece {
  const rawType = p.type?.toLowerCase().replace(/\s+/g, "_") ?? "copy";
  const platform = (p.platform as Platform | undefined)
    ?? TYPE_TO_PLATFORM[rawType]
    ?? "email";
  const pieceType = TYPE_TO_PIECE_TYPE[rawType] ?? "copy";
  const launchKey = p.launchPhase?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const dayIndex = PHASE_TO_DAY[launchKey] ?? (idx % 8);
  const statusMap: Record<string, Status> = { draft: "pending", pending_approval: "pending", approved: "approved", rejected: "rejected" };
  const label = AGGREGATED_TYPE_LABELS[rawType] ?? rawType.replace(/_/g, " ");
  return {
    id: p.id,
    platform,
    type: pieceType,
    dayIndex,
    title: label,
    body: extractBodyText(p.content, rawType),
    status: statusMap[p.status] ?? "pending",
    segment: "all",
  };
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
    label: "Instagram Business",
    oauthProvider: "instagram",
    dbProvider: "instagram",
    Icon: Instagram,
    brand: { bg: "rgba(225,48,108,0.08)", border: "#e1306c", text: "#e1306c" },
  },
  {
    platform: "facebook",
    label: "Facebook Pages",
    oauthProvider: "meta_ads",
    dbProvider: "meta_ads",
    Icon: Globe,
    brand: { bg: "rgba(24,119,242,0.08)", border: "#1877F2", text: "#1877F2" },
  },
  {
    platform: "tiktok",
    label: "TikTok Business",
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
          toast.success(`${def.label} conectado!`);
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
    } catch {
      toast.error(`Erro ao iniciar conexão com ${def.label}. Verifique se as credenciais OAuth estão configuradas.`);
      setConnecting(null);
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
            A NexOS AI vai postar automaticamente em seu nome. Conecte cada rede social com sua conta para liberar o lançamento.
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
            <div key={def.platform} className="flex items-center gap-4 px-5 py-4">
              {/* Icon */}
              <div
                className="w-9 h-9 border flex items-center justify-center shrink-0"
                style={{ borderColor: def.brand.border, background: def.brand.bg }}
              >
                <def.Icon className="h-4 w-4" style={{ color: def.brand.text }} />
              </div>

              {/* Info */}
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

              {/* Status / Connect button */}
              {connected ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono text-[11px] text-success uppercase tracking-widest">Conectado</span>
                </div>
              ) : (
                <button
                  onClick={() => void handleOAuth(def)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 h-9 font-mono text-[11px] uppercase tracking-widest border transition-all shrink-0 disabled:opacity-50"
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

type Tab = "platform" | "preview" | "flowchart" | "schedule" | "segmentation";

const VISUAL_PLATFORMS: Platform[] = ["instagram", "facebook", "tiktok"];

export default function ContentApproval() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("platform");
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [loadingPiece, setLoadingPiece] = useState<string | null>(null);
  const [localPieces, setLocalPieces] = useState<ContentPiece[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<Platform | "all">("all");

  const [, setLocation] = useLocation();

  const { data: campaignData, isLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}`],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ campaign: { id: string; title: string; status: string } }>;
    },
    enabled: !!campaignId,
  });

  const { data: apiContentData, isLoading: isContentLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return null;
      return res.json() as Promise<{ pieces: ApiContentPiece[] }>;
    },
    enabled: !!campaignId,
    staleTime: 0,
    gcTime: 0,
  });

  // Transition campaign from awaiting_approval → approved when user approves all content
  const approveCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao aprovar campanha");
      }
      return res.json();
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
    const mapped: ContentPiece[] = [];
    for (let i = 0; i < apiContentData.pieces.length; i++) {
      try {
        mapped.push(mapApiPiece(apiContentData.pieces[i]!, i));
      } catch (err) {
        console.error("[content] mapApiPiece failed for piece", apiContentData.pieces[i]?.id, err);
      }
    }
    return mapped.length > 0 ? mapped : null;
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
    setLoadingPiece(id);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      if (!res.ok) throw new Error("Erro");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.success("Peça aprovada");
    } catch {
      toast.error("Erro ao aprovar peça");
    } finally {
      setLoadingPiece(null);
    }
  };
  const handleReject = async (id: string) => {
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      });
      if (!res.ok) throw new Error("Erro");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.info("Peça rejeitada");
    } catch {
      toast.error("Erro ao rejeitar peça");
    }
  };
  const handleAiRewrite = async (id: string) => {
    setLoadingPiece(id);
    try {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      toast.success("IA reescreveu. Revise e aprove.");
    } catch {
      toast.error("Erro ao reescrever com IA");
    } finally {
      setLoadingPiece(null);
    }
  };
  const handleSaveEdit = (id: string, body: string, cta: string) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, body, callToAction: cta, status: "approved" } : p));
    setEditingPiece(null);
    toast.success("Peça editada e aprovada");
  };
  const handleApproveAll = async () => {
    const pendingIds = pieces.filter(p => p.status === "pending").map(p => p.id);
    for (const id of pendingIds) {
      await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "" }),
      }).catch(() => null);
    }
    queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
    toast.success(`${pendingIds.length} peças aprovadas`);
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
        <div className="py-16 text-center border border-dashed border-border/30">
          <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
            Conteúdo ainda não gerado
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/50 max-w-sm mx-auto mb-4">
            Execute a fase de geração de conteúdo na campanha para que os agentes de IA criem as peças de copy e visual.
          </p>
          <Link href={`/campaigns/${campaignId}`}>
            <Button className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" />Voltar à Campanha
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "flowchart",    label: "Fluxograma",      icon: Activity },
    { id: "preview",      label: "Preview Visual",  icon: Eye },
    { id: "platform",     label: "Por Plataforma",  icon: Globe },
    { id: "schedule",     label: "Cronograma",      icon: Calendar },
    { id: "segmentation", label: "Segmentação",     icon: Users },
  ];

  return (
    <>
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
              {pendingCount > 0 && (
                <Button onClick={handleApproveAll} className="rounded-none font-mono uppercase tracking-widest gap-1.5 btn-weapon-primary h-9 text-xs flex-1 sm:flex-none">
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
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center
                  ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                <Icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
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
                              <Sparkles className="h-2.5 w-2.5" />IA Reescrever
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Text-based platforms: email, whatsapp, ads, landing */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {platformPieces.map(piece => (
                        <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
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
                      <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
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
                    <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
                  ))}
                </div>
              </div>
            ))}
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
