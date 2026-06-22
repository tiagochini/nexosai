/**
 * CampaignCreativeGallery — Galeria permanente de criativos de uma campanha.
 *
 * Exibe todas as peças de conteúdo geradas como mocks visuais de plataforma.
 * Peças aprovadas ficam preservadas e podem ser referenciadas em novos lançamentos.
 * "Copiar" exporta o texto para clipboard; "Compartilhar" gera um link de preview.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { toast } from "sonner";
import {
  Copy, CheckCircle2, Filter, Layers, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieceMock, extractPieceText, PIECE_LABELS, type ContentPiece,
} from "./LaunchAuditScanner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { campaignId: string; }

type StatusFilter = "all" | "approved" | "generated" | "pending" | "rejected";
type TypeFilter   = "all" | string;

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved:  { label: "Aprovado",         color: "border-green-400/30 text-green-400 bg-green-400/8" },
  generated: { label: "Gerado",           color: "border-yellow-400/30 text-yellow-400 bg-yellow-400/8" },
  pending:   { label: "Aguardando",       color: "border-yellow-400/30 text-yellow-400 bg-yellow-400/8" },
  rejected:  { label: "Rejeitado",        color: "border-red-400/30 text-red-400 bg-red-400/8" },
  draft:     { label: "Rascunho",         color: "border-border/30 text-muted-foreground bg-muted/10" },
};

// ─── Piece Card ────────────────────────────────────────────────────────────────

function PieceCard({ piece }: { piece: ContentPiece }) {
  const [expanded, setExpanded]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const text = extractPieceText(piece.content, 800);
  const label = PIECE_LABELS[piece.type] ?? piece.type;
  const statusInfo = STATUS_META[piece.status] ?? { label: piece.status, color: "border-border/30 text-muted-foreground" };

  const handleCopy = async () => {
    if (!text) { toast.error("Sem texto para copiar"); return; }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Texto copiado para o clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div className="border border-border/30 bg-card/20 overflow-hidden flex flex-col group hover:border-border/50 transition-colors">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-card/30">
        <Layers className="h-3 w-3 text-muted-foreground/30 shrink-0" />
        <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest flex-1 truncate">{label}</span>
        <Badge variant="outline" className={`rounded-none font-mono text-[8px] px-1.5 py-0 border ${statusInfo.color}`}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Mock preview */}
      <div className="p-3 flex-1 bg-black/20 flex items-center justify-center">
        <PieceMock piece={piece} expanded={expanded} />
      </div>

      {/* Expanded full text */}
      {expanded && text && (
        <div className="px-3 py-2 border-t border-border/10 bg-black/30">
          <pre className="font-mono text-[9px] text-white/50 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{text}</pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-border/10 bg-card/10">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          disabled={!text}
          className="h-7 px-2 rounded-none font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-foreground/70 gap-1.5 flex-1 justify-start"
        >
          {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          className="h-7 px-2 rounded-none font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 hover:text-foreground/60 gap-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Recolher" : "Expandir"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main gallery component ────────────────────────────────────────────────────

export function CampaignCreativeGallery({ campaignId }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");
  const [showFilters,  setShowFilters]  = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content/gallery`],
    queryFn: () => customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] as ContentPiece[] })),
    staleTime: 30_000,
  });

  const pieces = data?.pieces ?? [];

  // Available type options from the actual pieces
  const availableTypes = useMemo(() => {
    const types = new Set(pieces.map(p => p.type));
    return Array.from(types);
  }, [pieces]);

  // Filtered pieces
  const filtered = useMemo(() => {
    return pieces.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter   !== "all" && p.type   !== typeFilter)   return false;
      return true;
    });
  }, [pieces, statusFilter, typeFilter]);

  // Stats
  const approvedCount  = pieces.filter(p => p.status === "approved").length;
  const generatedCount = pieces.filter(p => p.status === "generated").length;
  const pendingCount   = pieces.filter(p => p.status !== "approved" && p.status !== "generated").length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
      <span className="ml-3 font-mono text-sm text-muted-foreground">Carregando galeria...</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="border border-border/30 bg-card/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Archive className="h-3.5 w-3.5 text-primary/50" />
            <span className="font-mono text-[11px] font-bold text-foreground/80 uppercase tracking-widest">Galeria de Criativos</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/40">
            {pieces.length} peça{pieces.length !== 1 ? "s" : ""} gerada{pieces.length !== 1 ? "s" : ""} · ficam salvas permanentemente nesta campanha
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {approvedCount > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")}
              className={`font-mono text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors ${statusFilter === "approved" ? "border-green-400/50 text-green-400 bg-green-400/10" : "border-green-400/20 text-green-400/50 hover:border-green-400/40"}`}>
              ✓ {approvedCount} aprovada{approvedCount !== 1 ? "s" : ""}
            </button>
          )}
          {generatedCount > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "generated" ? "all" : "generated")}
              className={`font-mono text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors ${statusFilter === "generated" ? "border-yellow-400/50 text-yellow-400 bg-yellow-400/10" : "border-yellow-400/20 text-yellow-400/50 hover:border-yellow-400/40"}`}>
              ↻ {generatedCount} para revisar
            </button>
          )}
          {pendingCount > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
              className={`font-mono text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors ${statusFilter === "pending" ? "border-border text-foreground/50 bg-muted/20" : "border-border/20 text-muted-foreground/30 hover:border-border/40"}`}>
              {pendingCount} outros
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-7 w-7 p-0 rounded-none text-muted-foreground/30 hover:text-foreground/50"
          >
            <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      {pieces.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 hover:text-foreground/50 transition-colors"
          >
            <Filter className="h-3 w-3" />
            Filtros
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showFilters && (
            <>
              {/* Type filter */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 border transition-colors ${typeFilter === "all" ? "border-primary/50 text-primary bg-primary/10" : "border-border/20 text-muted-foreground/30 hover:border-border/40"}`}
                >
                  Todos
                </button>
                {availableTypes.map(t => (
                  <button key={t}
                    onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
                    className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 border transition-colors ${typeFilter === t ? "border-primary/50 text-primary bg-primary/10" : "border-border/20 text-muted-foreground/30 hover:border-border/40"}`}
                  >
                    {PIECE_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            </>
          )}

          {filtered.length !== pieces.length && (
            <span className="font-mono text-[8px] text-muted-foreground/20 ml-auto">
              Mostrando {filtered.length} de {pieces.length}
            </span>
          )}
        </div>
      )}

      {/* ── Reuse note ── */}
      <div className="border border-primary/10 bg-primary/3 px-3 py-2 flex items-start gap-2">
        <Archive className="h-3 w-3 text-primary/30 shrink-0 mt-0.5" />
        <span className="font-mono text-[9px] text-muted-foreground/35 leading-relaxed">
          Peças aprovadas ficam permanentemente nesta galeria. Em novos lançamentos, acesse a campanha original para copiar e adaptar os criativos que já funcionaram.
        </span>
      </div>

      {/* ── Grid ── */}
      {pieces.length === 0 ? (
        <div className="border border-border/20 py-16 flex flex-col items-center gap-3">
          <Layers className="h-8 w-8 text-muted-foreground/15" />
          <div className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest">Nenhum criativo gerado ainda</div>
          <div className="font-mono text-[9px] text-muted-foreground/20 text-center max-w-xs">
            Execute as fases de Conteúdo para gerar as peças da campanha. Elas aparecerão aqui.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border/20 py-12 flex flex-col items-center gap-3">
          <div className="font-mono text-[11px] text-muted-foreground/30">Nenhuma peça com este filtro</div>
          <button onClick={() => { setStatusFilter("all"); setTypeFilter("all"); }} className="font-mono text-[9px] text-primary/50 hover:text-primary transition-colors uppercase tracking-widest">Limpar filtros</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(piece => (
            <PieceCard key={piece.id} piece={piece} />
          ))}
        </div>
      )}
    </div>
  );
}
