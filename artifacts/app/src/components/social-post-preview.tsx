import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Music2, Share2, ThumbsUp, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreviewPiece {
  id: string;
  platform: "instagram" | "facebook" | "tiktok" | "email" | "whatsapp" | "landing" | "ads";
  type: "post" | "story" | "reel" | "email" | "message" | "ad" | "copy" | "native_video";
  dayIndex: number;
  title: string;
  body: string;
  callToAction?: string;
  status: "pending" | "approved" | "rejected" | "edited";
  segment?: "hot" | "warm" | "cold" | "all";
  estimatedReach?: number;
  tiktokHook?: string;
  visualDirection?: string;
  hashtags?: string[];
}

// ── Metrics estimator ─────────────────────────────────────────────────────────

export function estimatePostMetrics(piece: PreviewPiece): {
  reach: number;
  engagementRate: number;
  engagements: number;
  leads: number;
  conversionPct: number;
  leadsLabel: string;
} {
  const base = piece.estimatedReach ??
    (piece.platform === "tiktok" ? 8400 :
     piece.platform === "instagram" && piece.type === "reel" ? 4200 :
     piece.platform === "instagram" && piece.type === "story" ? 900 :
     piece.platform === "instagram" ? 1600 :
     piece.platform === "facebook" ? 2800 :
     500);

  const engRate =
    piece.platform === "tiktok" ? 0.09 :
    piece.platform === "instagram" && piece.type === "reel" ? 0.07 :
    piece.platform === "instagram" ? 0.05 :
    piece.platform === "facebook" ? 0.03 : 0.02;

  const engagements = Math.round(base * engRate);
  const ctr = piece.segment === "hot" ? 0.15 : piece.segment === "warm" ? 0.07 : 0.03;
  const leads = Math.round(engagements * ctr);
  const convPct = piece.segment === "hot" ? 9 : piece.segment === "warm" ? 3.5 : 1.2;

  return {
    reach: base,
    engagementRate: Math.round(engRate * 100),
    engagements,
    leads,
    conversionPct: convPct,
    leadsLabel: leads > 0 ? `~${leads} leads` : "—",
  };
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// ── Metrics Strip ─────────────────────────────────────────────────────────────

function MetricsStrip({ piece }: { piece: PreviewPiece }) {
  const m = estimatePostMetrics(piece);
  return (
    <div className="flex flex-wrap gap-2 mt-2 px-0.5">
      <div className="flex items-center gap-1 bg-muted/20 border border-border/30 px-2 py-1 rounded-sm">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Alcance</span>
        <span className="font-mono text-[10px] font-bold text-foreground">{fmtNum(m.reach)}</span>
      </div>
      <div className="flex items-center gap-1 bg-muted/20 border border-border/30 px-2 py-1 rounded-sm">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Eng.</span>
        <span className="font-mono text-[10px] font-bold text-primary">{m.engagementRate}%</span>
      </div>
      <div className="flex items-center gap-1 bg-muted/20 border border-border/30 px-2 py-1 rounded-sm">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Leads</span>
        <span className="font-mono text-[10px] font-bold text-success">{m.leadsLabel}</span>
      </div>
      <div className="flex items-center gap-1 bg-muted/20 border border-border/30 px-2 py-1 rounded-sm">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Conv.</span>
        <span className="font-mono text-[10px] font-bold text-yellow-400">{m.conversionPct}%</span>
      </div>
    </div>
  );
}

// ── Instagram Post ─────────────────────────────────────────────────────────────

function InstagramPost({ piece }: { piece: PreviewPiece }) {
  const m = estimatePostMetrics(piece);
  const caption = piece.body.slice(0, 140) + (piece.body.length > 140 ? "..." : "");
  const hashtags = piece.hashtags?.slice(0, 5).join(" ") ?? "#lançamento #digital #resultado";
  const isReel = piece.type === "reel";
  const likes = Math.round(m.engagements * 0.7);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg text-black text-xs font-sans max-w-[320px] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">N</div>
          <div>
            <div className="font-semibold text-[11px] leading-tight">nexos.creator</div>
            <div className="text-[9px] text-gray-400">Patrocinado</div>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>

      {/* Image / Reel placeholder */}
      <div className={`relative w-full overflow-hidden ${isReel ? "aspect-[9/16]" : "aspect-square"}`}
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          {isReel && (
            <div className="mb-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Video className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="text-white/50 text-[10px] uppercase tracking-widest mb-2">Visual IA</div>
          <div className="text-white/80 text-[11px] leading-relaxed text-center px-2 font-medium">
            {piece.visualDirection?.slice(0, 80) ?? "Arte gerada pela IA com identidade visual da campanha"}
          </div>
        </div>
        {isReel && (
          <div className="absolute right-2 bottom-16 flex flex-col gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <Heart className="h-5 w-5 text-white" />
              <span className="text-white text-[9px]">{fmtNum(likes)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <MessageCircle className="h-5 w-5 text-white" />
              <span className="text-white text-[9px]">{fmtNum(Math.round(m.engagements * 0.15))}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Send className="h-5 w-5 text-white" />
              <span className="text-white text-[9px]">{fmtNum(Math.round(m.engagements * 0.12))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isReel && (
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex gap-3">
            <Heart className="h-5 w-5 text-gray-700" />
            <MessageCircle className="h-5 w-5 text-gray-700" />
            <Send className="h-5 w-5 text-gray-700" />
          </div>
          <Bookmark className="h-5 w-5 text-gray-700" />
        </div>
      )}

      {/* Caption */}
      <div className="px-3 pb-3">
        {!isReel && <div className="font-semibold text-[11px] mb-0.5">{fmtNum(likes)} curtidas</div>}
        <div className="text-[11px] leading-relaxed text-gray-800">
          <span className="font-semibold">nexos.creator</span> {caption}
        </div>
        <div className="text-[10px] text-blue-500 mt-1">{hashtags}</div>
        {piece.callToAction && (
          <div className="mt-1.5 text-[10px] text-blue-600 font-medium">→ {piece.callToAction}</div>
        )}
      </div>
    </div>
  );
}

// ── Instagram Story ────────────────────────────────────────────────────────────

function InstagramStory({ piece }: { piece: PreviewPiece }) {
  return (
    <div className="bg-black rounded-xl overflow-hidden shadow-lg text-white text-xs font-sans max-w-[180px] w-full"
         style={{ aspectRatio: "9/16" }}>
      {/* Progress bars */}
      <div className="flex gap-0.5 px-2 pt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-0.5 flex-1 rounded-full ${i === 1 ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-[8px]">N</div>
        <span className="text-[10px] font-semibold">nexos.creator</span>
        <span className="text-[9px] text-white/50 ml-0.5">agora</span>
      </div>
      {/* Content */}
      <div className="flex-1 relative"
           style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", minHeight: 200 }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <div className="text-[12px] font-bold leading-tight mb-2 drop-shadow-lg">
            {piece.title}
          </div>
          <div className="text-[9px] text-white/70 leading-relaxed">
            {piece.body.slice(0, 60)}...
          </div>
          {piece.callToAction && (
            <div className="mt-3 bg-white text-black rounded-full px-3 py-1 text-[9px] font-bold">
              {piece.callToAction}
            </div>
          )}
        </div>
      </div>
      {/* Bottom */}
      <div className="px-2 py-2">
        <div className="border border-white/30 rounded-full px-3 py-1 text-[9px] text-center text-white/70">
          Enviar mensagem
        </div>
      </div>
    </div>
  );
}

// ── Facebook Post ─────────────────────────────────────────────────────────────

function FacebookPost({ piece }: { piece: PreviewPiece }) {
  const m = estimatePostMetrics(piece);
  const reactions = Math.round(m.engagements * 0.65);
  const comments = Math.round(m.engagements * 0.2);
  const shares = Math.round(m.engagements * 0.15);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg text-black text-xs font-sans max-w-[320px] w-full">
      {/* Header */}
      <div className="flex items-start justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">N</div>
          <div>
            <div className="font-semibold text-[12px] text-blue-800 leading-tight">NexOS Creator</div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <span>Agora</span>
              <span>·</span>
              <span>🌐</span>
            </div>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>

      {/* Post text — Facebook is more text-forward */}
      <div className="px-3 pb-2">
        <div className="text-[12px] text-gray-800 leading-relaxed">
          {piece.body.slice(0, 200)}{piece.body.length > 200 ? "... " : " "}
          {piece.body.length > 200 && <span className="text-gray-500 cursor-pointer">ver mais</span>}
        </div>
      </div>

      {/* Image placeholder */}
      <div className="w-full h-36 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1">Criativo IA</div>
          <div className="text-white/70 text-[10px] text-center px-4 leading-relaxed">
            {piece.visualDirection?.slice(0, 60) ?? "Arte gerada com identidade visual da campanha"}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
          <span>👍❤️😮</span>
          <span className="ml-1">{fmtNum(reactions)}</span>
        </div>
        <div className="text-[10px] text-gray-500">
          {fmtNum(comments)} comentários · {fmtNum(shares)} compartilhamentos
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-around px-2 py-1">
        {[
          { icon: ThumbsUp, label: "Curtir" },
          { icon: MessageCircle, label: "Comentar" },
          { icon: Share2, label: "Compartilhar" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-600">
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TikTok Preview ─────────────────────────────────────────────────────────────

function TikTokPost({ piece }: { piece: PreviewPiece }) {
  const m = estimatePostMetrics(piece);
  const likes = fmtNum(Math.round(m.reach * 0.09));
  const comments = fmtNum(Math.round(m.reach * 0.009));
  const saves = fmtNum(Math.round(m.reach * 0.006));

  return (
    <div className="relative rounded-xl overflow-hidden shadow-xl text-white font-sans max-w-[180px] w-full"
         style={{ aspectRatio: "9/16", background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)" }}>
      {/* Background gradient */}
      <div className="absolute inset-0"
           style={{ background: "linear-gradient(160deg, #0d0d1a 0%, #1a0a2e 40%, #0a1a2e 100%)" }} />

      {/* Visual direction hint */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center p-4">
          <Video className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <div className="text-white/30 text-[9px] uppercase tracking-widest">Vídeo TikTok</div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-[9px]">N</div>
        {[
          { icon: Heart, val: likes, color: "text-white" },
          { icon: MessageCircle, val: comments, color: "text-white" },
          { icon: Bookmark, val: saves, color: "text-white" },
          { icon: Share2, val: "→", color: "text-white" },
        ].map(({ icon: Icon, val, color }) => (
          <div key={val} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <span className="text-[9px] text-white/80 font-semibold">{val}</span>
          </div>
        ))}
      </div>

      {/* Bottom caption */}
      <div className="absolute bottom-0 left-0 right-10 p-2"
           style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
        {piece.tiktokHook && (
          <div className="text-[10px] font-bold text-white mb-1 leading-tight">
            "{piece.tiktokHook?.slice(0, 50)}"
          </div>
        )}
        <div className="text-[9px] text-white/80 leading-relaxed line-clamp-2">
          {piece.body.slice(0, 60)}...
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Music2 className="h-2.5 w-2.5 text-white/60" />
          <span className="text-[8px] text-white/60">Música em tendência · ♪</span>
        </div>
      </div>

      {/* Top username */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5">
          <span className="text-[9px] text-white/50">Recomendados</span>
          <span className="text-[9px] text-white">Seguindo</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Router Component ─────────────────────────────────────────────────────

interface SocialPostPreviewProps {
  piece: PreviewPiece;
  showMetrics?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  loading?: string | null;
}

export function SocialPostPreview({ piece, showMetrics = true, onApprove, onReject, loading }: SocialPostPreviewProps) {
  const isLoading = loading === piece.id;

  const previewEl =
    piece.platform === "tiktok" ? <TikTokPost piece={piece} /> :
    piece.platform === "facebook" ? <FacebookPost piece={piece} /> :
    piece.type === "story" ? <InstagramStory piece={piece} /> :
    <InstagramPost piece={piece} />;

  const SEGMENT_LABEL: Record<string, string> = { hot: "🔥 Quentes", warm: "🌡️ Mornos", cold: "❄️ Frios", all: "Todos" };
  const PHASE_MAP: Record<number, string> = {
    0: "Pré-lançamento", 1: "Captura", 2: "Aquecimento", 3: "Autoridade",
    4: "Desejo", 5: "🚀 Abertura", 6: "Escassez", 7: "⚡ Fechamento",
  };

  const statusColor =
    piece.status === "approved" ? "border-success/60 bg-success/5" :
    piece.status === "rejected" ? "border-destructive/60 bg-destructive/5" :
    "border-border/40 bg-card/40";

  return (
    <div className={`border p-3 space-y-3 transition-all ${statusColor}`}>
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-mono text-[10px] rounded-none px-1.5 py-0 uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
          Dia {piece.dayIndex}
        </Badge>
        {piece.segment && piece.segment !== "all" && (
          <Badge variant="outline" className="font-mono text-[10px] rounded-none px-1.5 py-0">
            {SEGMENT_LABEL[piece.segment]}
          </Badge>
        )}
        <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest ml-auto">
          {PHASE_MAP[piece.dayIndex] ?? `Dia ${piece.dayIndex}`}
        </span>
      </div>

      {/* Preview mockup */}
      <div className="flex justify-center">
        {previewEl}
      </div>

      {/* Title */}
      <div className="font-mono text-xs font-bold text-foreground">{piece.title}</div>

      {/* Metrics */}
      {showMetrics && <MetricsStrip piece={piece} />}

      {/* Action buttons */}
      {(onApprove || onReject) && piece.status === "pending" && (
        <div className="flex gap-2 pt-1">
          {onApprove && (
            <button
              onClick={() => onApprove(piece.id)}
              disabled={isLoading}
              className="flex-1 h-7 font-mono text-[11px] uppercase tracking-widest border border-success/50 text-success bg-success/10 hover:bg-success/20 transition-colors disabled:opacity-50"
            >
              {isLoading ? "..." : "✓ Aprovar"}
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(piece.id)}
              disabled={isLoading}
              className="h-7 px-4 font-mono text-[11px] uppercase tracking-widest border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      )}
      {piece.status !== "pending" && (
        <div className={`text-center font-mono text-[11px] uppercase tracking-widest py-1 ${
          piece.status === "approved" ? "text-success" : "text-destructive"
        }`}>
          {piece.status === "approved" ? "✓ Aprovado" : "✕ Rejeitado"}
        </div>
      )}
    </div>
  );
}
