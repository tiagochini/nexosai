import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wand2, CheckCircle2, Loader2, ChevronDown, ChevronUp,
  Zap, Eye, Target, AlertTriangle, Sparkles, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativeDraft {
  index: number;
  title: string;
  archetype: string;
  hook: string;
  tone: string;
  dominantEmotion: string;
  visualStyle: string;
  rhythm: string;
  cta: string;
  narrativeFraming: string;
  platformFit: string[];
  confidenceScore: number;
  icpAlignment: number;
  retentionPrediction: number;
  keyInsight: string;
  risk: string;
  creditCost: number;
}

interface CreativeIntentData {
  status: "pending_approval" | "approved" | "generating_final";
  generatedAt: string;
  approvedDraftIndex: number | null;
  approvedAt: string | null;
  drafts: CreativeDraft[];
  creditsSpent: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARCHETYPE_LABELS: Record<string, string> = {
  authority:     "Autoridade",
  aspiration:    "Aspiração",
  fear_removal:  "Remoção de Medo",
  curiosity:     "Curiosidade",
  community:     "Comunidade",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  tiktok:    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  youtube:   "bg-red-500/10 text-red-400 border-red-500/20",
  facebook:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  whatsapp:  "bg-green-500/10 text-green-400 border-green-500/20",
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`font-mono text-xs font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-1 bg-border/30 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${
            value >= 80 ? "bg-emerald-400" : value >= 65 ? "bg-yellow-400" : "bg-red-400"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  isApproved,
  isOtherApproved,
  onApprove,
  approving,
}: {
  draft: CreativeDraft;
  isApproved: boolean;
  isOtherApproved: boolean;
  onApprove: (index: number) => void;
  approving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const letters = ["A", "B", "C"];

  return (
    <div className={`border transition-all duration-300 ${
      isApproved
        ? "border-emerald-400/60 bg-emerald-400/5 shadow-[0_0_20px_rgba(52,211,153,0.08)]"
        : isOtherApproved
        ? "border-border/20 bg-card/20 opacity-40"
        : "border-border/40 bg-card/30 hover:border-border/60 hover:bg-card/40"
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 flex items-center justify-center font-mono text-sm font-black border ${
              isApproved ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "border-border/50 text-muted-foreground"
            }`}>
              {letters[draft.index]}
            </div>
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wide">
                {draft.title}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {ARCHETYPE_LABELS[draft.archetype] ?? draft.archetype}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-mono text-lg font-black ${
              draft.confidenceScore >= 80 ? "text-emerald-400" :
              draft.confidenceScore >= 65 ? "text-yellow-400" : "text-red-400"
            }`}>
              {draft.confidenceScore}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">confidence</div>
          </div>
        </div>

        {/* Hook — the star of the show */}
        <div className="border-l-2 border-cyan-400/50 pl-3 py-1 mb-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/70 mb-1">Hook</div>
          <div className="font-mono text-sm text-foreground/90 italic">"{draft.hook}"</div>
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <ScoreBar label="ICP Alignment" value={draft.icpAlignment}
            color={draft.icpAlignment >= 80 ? "text-emerald-400" : draft.icpAlignment >= 65 ? "text-yellow-400" : "text-red-400"} />
          <ScoreBar label="Retenção" value={draft.retentionPrediction}
            color={draft.retentionPrediction >= 80 ? "text-emerald-400" : draft.retentionPrediction >= 65 ? "text-yellow-400" : "text-red-400"} />
        </div>
      </div>

      {/* Meta badges */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="font-mono text-[10px] uppercase border-border/30 text-muted-foreground">
          {draft.tone}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px] uppercase border-border/30 text-muted-foreground">
          {draft.dominantEmotion}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px] uppercase border-border/30 text-muted-foreground">
          {draft.rhythm}
        </Badge>
        {draft.platformFit.map(p => (
          <Badge key={p} variant="outline" className={`font-mono text-[10px] border ${PLATFORM_COLORS[p] ?? "text-muted-foreground border-border/30"}`}>
            {p}
          </Badge>
        ))}
      </div>

      {/* Expandable details */}
      <div className="px-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors py-2 w-full"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Menos detalhes" : "Ver direção completa"}
        </button>

        {expanded && (
          <div className="pb-4 space-y-3 border-t border-border/20 pt-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Estilo Visual</div>
              <p className="font-mono text-xs text-foreground/80 leading-relaxed">{draft.visualStyle}</p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Enquadramento Narrativo</div>
              <p className="font-mono text-xs text-foreground/80 leading-relaxed">{draft.narrativeFraming}</p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">CTA Principal</div>
              <p className="font-mono text-xs text-cyan-400/80 italic">"{draft.cta}"</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/70 mb-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Por que funciona
                </div>
                <p className="font-mono text-xs text-foreground/70 leading-relaxed">{draft.keyInsight}</p>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Risco
                </div>
                <p className="font-mono text-xs text-foreground/70 leading-relaxed">{draft.risk}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve CTA */}
      {!isOtherApproved && (
        <div className="px-4 pb-4">
          {isApproved ? (
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 py-2">
              <CheckCircle2 className="h-4 w-4" />
              Direção aprovada — criativos finais seguirão esta direção
            </div>
          ) : (
            <Button
              className="w-full font-mono text-[11px] uppercase tracking-widest rounded-none h-9 border border-border/40 bg-transparent hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:border-border/70 transition-all"
              onClick={() => onApprove(draft.index)}
              disabled={approving}
            >
              {approving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Target className="h-3 w-3 mr-2" />}
              Aprovar Direção {letters[draft.index]}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreativeIntentPanel({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["creative-intent", campaignId],
    queryFn: () => customFetch<{ intent: CreativeIntentData | null }>(`/api/campaigns/${campaignId}/creative-intent`),
    staleTime: 30_000,
  });

  const intent = data?.intent ?? null;

  const generateMutation = useMutation({
    mutationFn: () => customFetch<{ intent: CreativeIntentData }>(
      `/api/campaigns/${campaignId}/creative-intent/generate`,
      { method: "POST" },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-intent", campaignId] });
      toast.success("3 direções criativas geradas — escolha a que mais ressoa com sua visão");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar direções"),
  });

  const approveMutation = useMutation({
    mutationFn: (index: number) => customFetch<{ intent: CreativeIntentData }>(
      `/api/campaigns/${campaignId}/creative-intent/approve/${index}`,
      { method: "POST" },
    ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["creative-intent", campaignId] });
      const draft = res.intent.drafts[res.intent.approvedDraftIndex ?? 0];
      toast.success(`Direção "${draft?.title}" aprovada — será usada na geração de criativos`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao aprovar direção"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => customFetch(`/api/campaigns/${campaignId}/creative-intent/approval`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-intent", campaignId] });
      toast.info("Aprovação removida — você pode escolher outra direção");
    },
  });

  if (isLoading) {
    return (
      <div className="border border-border/30 bg-card/20 p-4">
        <div className="h-4 w-48 bg-muted/20 animate-pulse" />
      </div>
    );
  }

  const isApproved = intent?.status === "approved";

  return (
    <div className="border border-border/40 bg-card/10">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest">
              Direção Criativa
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              Defina a filosofia visual antes de gerar os criativos finais
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <Badge className="font-mono text-[10px] uppercase bg-emerald-400/10 text-emerald-400 border-emerald-400/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Direção Aprovada
            </Badge>
          )}
          {!isApproved && intent && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-yellow-400/30 text-yellow-400">
              Aguardando Aprovação
            </Badge>
          )}
          {!intent && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-border/30 text-muted-foreground">
              Não Iniciado
            </Badge>
          )}
        </div>
      </div>

      {/* No intent yet */}
      {!intent && (
        <div className="p-6 text-center space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-sm text-foreground/80">
              NEXOS não desperdiça créditos gerando criativos aleatórios.
            </p>
            <p className="font-mono text-xs text-muted-foreground max-w-md mx-auto">
              Primeiro ela apresenta a direção estratégica visual. Você aprova. Só então o sistema produz os criativos finais — com precisão e intenção.
            </p>
          </div>
          <div className="flex items-center justify-center gap-6 py-2">
            {["Conceito", "Aprovação", "Produção"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 border font-mono text-[10px] flex items-center justify-center ${
                    i === 0 ? "border-violet-400 text-violet-400" : "border-border/30 text-muted-foreground/40"
                  }`}>{i + 1}</div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{step}</span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-border/30 mb-4" />}
              </div>
            ))}
          </div>
          <Button
            className="font-mono text-xs uppercase tracking-widest rounded-none h-10 px-6 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 gap-2"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando direções (10 créditos)…</>
              : <><Wand2 className="h-3.5 w-3.5" />Definir Direção Criativa — 10 créditos</>
            }
          </Button>
          <p className="font-mono text-[10px] text-muted-foreground/50">
            Barato. A produção final é cobrada apenas após sua aprovação.
          </p>
        </div>
      )}

      {/* Draft cards */}
      {intent && !isApproved && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-mono text-[11px] text-muted-foreground">
              Escolha a direção que mais ressoa com sua visão para esta campanha.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase text-muted-foreground h-7 gap-1"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RotateCcw className="h-3 w-3" />
              }
              Regerar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {intent.drafts.map(draft => (
              <DraftCard
                key={draft.index}
                draft={draft}
                isApproved={false}
                isOtherApproved={false}
                onApprove={(i) => approveMutation.mutate(i)}
                approving={approveMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Approved state */}
      {intent && isApproved && (
        <div className="p-4">
          {(() => {
            const approved = intent.drafts[intent.approvedDraftIndex ?? 0];
            if (!approved) return null;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {intent.drafts.map(draft => (
                    <DraftCard
                      key={draft.index}
                      draft={draft}
                      isApproved={draft.index === intent.approvedDraftIndex}
                      isOtherApproved={draft.index !== intent.approvedDraftIndex}
                      onApprove={(i) => approveMutation.mutate(i)}
                      approving={approveMutation.isPending}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      <strong>{approved.title}</strong> aprovada — todos os agentes de criativo seguirão esta direção
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-mono text-[10px] uppercase text-muted-foreground h-7 gap-1 hover:text-foreground"
                    onClick={() => revokeMutation.mutate()}
                    disabled={revokeMutation.isPending}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Alterar
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
