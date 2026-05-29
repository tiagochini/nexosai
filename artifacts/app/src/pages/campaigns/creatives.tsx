import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, CheckCircle2, XCircle, RefreshCw,
  Download, Instagram, Facebook, Globe, Layers, Monitor,
  Loader2, Plus, ImageOff, Eye, Wand2, ChevronRight,
  Palette, Target, Zap, Clock,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreativeConcept {
  headline: string;
  subHeadline: string;
  visualDescription: string;
  colorPalette: string[];
  cta: string;
  mentalTrigger: string;
  angle: string;
  mood: string;
  dallePrompt: string;
  rationale: string;
}

interface Creative {
  id: string;
  campaignId: string;
  status: string;
  format: string;
  platform: string;
  requestNote?: string;
  concept: CreativeConcept | null;
  previewUrl: string | null;
  finalUrl: string | null;
  rejectionReason: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400 border-pink-400/40 bg-pink-400/10" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-indigo-400 border-indigo-400/40 bg-indigo-400/10" },
  { value: "tiktok", label: "TikTok", icon: Layers, color: "text-red-400 border-red-400/40 bg-red-400/10" },
  { value: "google", label: "Google", icon: Globe, color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  { value: "universal", label: "Universal", icon: Monitor, color: "text-primary border-primary/40 bg-primary/10" },
];

const FORMATS: Record<string, { label: string; ratio: string; desc: string }> = {
  feed_square:    { label: "Feed Quadrado", ratio: "1:1",   desc: "1080×1080px" },
  feed_portrait:  { label: "Feed Retrato",  ratio: "4:5",   desc: "1080×1350px" },
  stories:        { label: "Stories",       ratio: "9:16",  desc: "1080×1920px" },
  banner:         { label: "Banner",        ratio: "16:9",  desc: "1920×1080px" },
  carousel_slide: { label: "Carrossel",     ratio: "1:1",   desc: "1080×1080px" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  concept_pending:   { label: "Gerando conceito...", color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  concept_ready:     { label: "Aguardando aprovação", color: "border-primary/40 bg-primary/10 text-primary", icon: Eye },
  preview_generating:{ label: "Gerando imagem...",  color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  preview_ready:     { label: "Preview pronto",     color: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400", icon: Eye },
  final_generating:  { label: "Gerando final HD...",color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  approved:          { label: "Aprovado",           color: "border-green-400/40 bg-green-400/10 text-green-400", icon: CheckCircle2 },
  rejected:          { label: "Rejeitado",          color: "border-red-400/40 bg-red-400/10 text-red-400", icon: XCircle },
};

const TRIGGER_LABELS: Record<string, string> = {
  authority: "Autoridade", transformation: "Transformação", scarcity: "Escassez",
  curiosity: "Curiosidade", social_proof: "Prova Social", urgency: "Urgência",
};

// ── Generate form ─────────────────────────────────────────────────────────────

function GenerateForm({ campaignId, onGenerated }: { campaignId: string; onGenerated: () => void }) {
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("feed_square");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives/concept`, {
        method: "POST",
        body: JSON.stringify({ platform, format, requestNote: note }),
      });
      if (!res.ok) throw new Error("Erro ao gerar conceito");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Conceito gerado! Revise e aprove para gerar a imagem.");
      setOpen(false);
      setNote("");
      onGenerated();
    },
    onError: () => toast.error("Erro ao gerar conceito. Verifique seus créditos."),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold gap-2">
        <Plus className="h-4 w-4" /> Gerar Criativo
      </Button>
    );
  }

  return (
    <div className="border border-primary/30 bg-primary/5 p-6 mb-6">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">Novo Criativo</div>
      <div className="space-y-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Plataforma</div>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-xs uppercase tracking-widest transition-all ${platform === p.value ? p.color + " border-opacity-100" : "border-border/30 text-muted-foreground hover:border-border"}`}
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Formato</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMATS).map(([value, fmt]) => (
              <button
                key={value}
                onClick={() => setFormat(value)}
                className={`px-3 py-1.5 border font-mono text-xs uppercase tracking-widest transition-all ${format === value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border"}`}
              >
                {fmt.label} <span className="opacity-50">{fmt.ratio}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Briefing adicional (opcional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: foco na transformação do produto, tons quentes, mostrar pessoa sorrindo..."
            rows={2}
            maxLength={500}
            className="w-full bg-background/50 border border-border/50 rounded-none px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/60"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => mutate()} disabled={isPending} className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-10 gap-2">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {isPending ? "Gerando conceito..." : "Gerar Conceito (10 cr)"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase text-xs tracking-widest h-10">
            Cancelar
          </Button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          Conceito: 10 cr · Preview: 50 cr · Final HD: 150 cr
        </p>
      </div>
    </div>
  );
}

// ── Creative Card ─────────────────────────────────────────────────────────────

function CreativeCard({ creative, campaignId, onRefresh }: { creative: Creative; campaignId: string; onRefresh: () => void }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const status = STATUS_CONFIG[creative.status] ?? STATUS_CONFIG.concept_pending;
  const StatusIcon = status.icon;
  const fmt = FORMATS[creative.format];
  const plat = PLATFORMS.find((p) => p.value === creative.platform);

  const approveConcept = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives/${creative.id}/approve-concept`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { toast.success("Conceito aprovado! Gerando imagem..."); onRefresh(); },
    onError: () => toast.error("Erro ao aprovar conceito"),
  });

  const approvePreview = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives/${creative.id}/approve-preview`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { toast.success("Preview aprovado! Gerando versão final HD..."); onRefresh(); },
    onError: () => toast.error("Erro ao aprovar preview"),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives/${creative.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { toast.success("Criativo rejeitado"); setShowReject(false); onRefresh(); },
    onError: () => toast.error("Erro ao rejeitar"),
  });

  const regenerate = useMutation({
    mutationFn: async (quality: "standard" | "hd") => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives/${creative.id}/regenerate`, {
        method: "POST",
        body: JSON.stringify({ quality }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { toast.success("Regenerando imagem..."); onRefresh(); },
    onError: () => toast.error("Erro ao regenerar"),
  });

  const imageUrl = creative.finalUrl ?? creative.previewUrl;
  const hasImage = !!imageUrl;
  const imageError = creative.metadata?.imageError;

  return (
    <div className={`border bg-card/20 overflow-hidden transition-all ${creative.status === "approved" ? "border-green-400/30" : creative.status === "rejected" ? "border-red-400/20 opacity-60" : "border-border/30"}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {plat && <plat.icon className={`h-3.5 w-3.5 shrink-0 ${plat.color.split(" ")[0]}`} />}
          <span className="font-mono text-xs uppercase tracking-widest text-foreground/80 font-bold truncate">
            {plat?.label ?? creative.platform} · {fmt?.label ?? creative.format}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 border px-2 py-0.5 shrink-0 ${status.color}`}>
          <StatusIcon className={`h-3 w-3 shrink-0 ${["concept_pending","preview_generating","final_generating"].includes(creative.status) ? "animate-spin" : ""}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest">{status.label}</span>
        </div>
      </div>

      {/* Image area */}
      <div className={`relative bg-background/40 flex items-center justify-center ${creative.format === "stories" || creative.format === "feed_portrait" ? "aspect-[9/16] max-h-64" : creative.format === "banner" ? "aspect-video" : "aspect-square"} overflow-hidden`}
        style={{ maxHeight: 320 }}>
        {hasImage ? (
          <img
            src={imageUrl!}
            alt="Criativo gerado"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground/30 p-6 text-center">
            {["preview_generating", "final_generating", "concept_pending"].includes(creative.status) ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                <span className="font-mono text-xs uppercase tracking-widest">Processando...</span>
              </>
            ) : imageError ? (
              <>
                <ImageOff className="h-10 w-10" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Geração de imagem requer OPENAI_API_KEY com acesso ao DALL-E 3</span>
              </>
            ) : (
              <>
                <Sparkles className="h-10 w-10 text-primary/30" />
                <span className="font-mono text-xs uppercase tracking-widest">Conceito pronto · Aprovação gera a imagem</span>
              </>
            )}
          </div>
        )}

        {/* Approved badge overlay */}
        {creative.status === "approved" && hasImage && (
          <div className="absolute top-2 right-2 bg-green-500/90 px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white font-bold">✓ Aprovado</span>
          </div>
        )}
      </div>

      {/* Concept block */}
      {creative.concept && (
        <div className="px-4 py-4 border-t border-border/10 space-y-3">
          <div>
            <div className="font-mono font-black text-sm text-foreground uppercase tracking-wide">{creative.concept.headline}</div>
            {creative.concept.subHeadline && (
              <div className="font-mono text-xs text-muted-foreground mt-0.5">{creative.concept.subHeadline}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-1.5">
              <Target className="h-3 w-3 text-primary/50 mt-0.5 shrink-0" />
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 block">Gatilho</span>
                <span className="font-mono text-foreground/70">{TRIGGER_LABELS[creative.concept.mentalTrigger] ?? creative.concept.mentalTrigger}</span>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Zap className="h-3 w-3 text-primary/50 mt-0.5 shrink-0" />
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 block">Ângulo</span>
                <span className="font-mono text-foreground/70 capitalize">{creative.concept.angle}</span>
              </div>
            </div>
          </div>

          {creative.concept.colorPalette?.length > 0 && (
            <div className="flex items-center gap-2">
              <Palette className="h-3 w-3 text-muted-foreground/50" />
              <div className="flex gap-1">
                {creative.concept.colorPalette.map((color, i) => (
                  <div key={i} className="w-5 h-5 rounded-sm border border-border/30" style={{ backgroundColor: color }} title={color} />
                ))}
              </div>
            </div>
          )}

          <div className="border border-border/20 bg-background/30 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Visão do criativo</div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed line-clamp-3">{creative.concept.visualDescription}</p>
          </div>

          {creative.concept.rationale && (
            <div className="border-l-2 border-primary/30 pl-3">
              <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">{creative.concept.rationale}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {creative.status !== "rejected" && (
        <div className="px-4 pb-4 space-y-2">
          {/* Approve concept → generate preview */}
          {creative.status === "concept_ready" && (
            <div className="flex gap-2">
              <Button
                onClick={() => approveConcept.mutate()}
                disabled={approveConcept.isPending}
                className="flex-1 btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-10 gap-1.5"
              >
                {approveConcept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Aprovar · Gerar Imagem (50 cr)
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReject(true)}
                className="rounded-none font-mono uppercase text-xs tracking-widest h-10 border-red-400/30 text-red-400 hover:bg-red-400/10"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Approve preview → generate final HD */}
          {creative.status === "preview_ready" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => approvePreview.mutate()}
                  disabled={approvePreview.isPending}
                  className="flex-1 btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-10 gap-1.5"
                >
                  {approvePreview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Aprovar Preview · Final HD (150 cr)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReject(true)}
                  className="rounded-none font-mono uppercase text-xs tracking-widest h-10 border-red-400/30 text-red-400 hover:bg-red-400/10"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
              {hasImage && (
                <Button
                  variant="outline"
                  onClick={() => regenerate.mutate("standard")}
                  disabled={regenerate.isPending}
                  size="sm"
                  className="w-full rounded-none font-mono uppercase text-[10px] tracking-widest h-8 gap-1.5 border-border/30"
                >
                  <RefreshCw className="h-3 w-3" /> Gerar outra variação (50 cr)
                </Button>
              )}
            </div>
          )}

          {/* Approved — download */}
          {creative.status === "approved" && (
            <div className="flex gap-2">
              {hasImage ? (
                <a
                  href={imageUrl!}
                  download={`criativo-${creative.id}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full rounded-none font-mono uppercase text-xs tracking-widest font-bold h-10 gap-2 border border-green-400/40 bg-green-400/10 text-green-400 hover:bg-green-400/20">
                    <Download className="h-3.5 w-3.5" /> Baixar Criativo
                  </Button>
                </a>
              ) : null}
              <Button
                variant="outline"
                onClick={() => regenerate.mutate("hd")}
                disabled={regenerate.isPending}
                size="sm"
                className="rounded-none font-mono uppercase text-[10px] tracking-widest h-10 gap-1.5 border-border/30"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar
              </Button>
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div className="border border-red-400/20 bg-red-400/5 p-3 space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição (opcional)..."
                rows={2}
                className="w-full bg-background/50 border border-border/40 rounded-none px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => reject.mutate()}
                  disabled={reject.isPending}
                  size="sm"
                  className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8 gap-1 bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30"
                >
                  <XCircle className="h-3 w-3" /> Rejeitar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReject(false)}
                  className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {creative.status === "rejected" && creative.rejectionReason && (
        <div className="px-4 pb-4">
          <p className="font-mono text-xs text-muted-foreground/60">Motivo: {creative.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

// ── Flow diagram ──────────────────────────────────────────────────────────────

function FlowDiagram() {
  const steps = [
    { icon: Wand2, label: "Conceito", sub: "Equipe gera headline,\nvisual e prompt" },
    { icon: Eye, label: "Sua aprovação", sub: "Revise o conceito\navant de qualquer imagem" },
    { icon: Sparkles, label: "Preview", sub: "DALL-E 3 gera\na imagem (standard)" },
    { icon: Eye, label: "Sua aprovação", sub: "Veja a imagem antes\ndo final HD" },
    { icon: CheckCircle2, label: "Final HD", sub: "Alta resolução\npara uso real" },
  ];
  return (
    <div className="border border-border/20 bg-card/10 px-6 py-4 mb-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3">Fluxo de aprovação</div>
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-8 h-8 border flex items-center justify-center ${step.label === "Sua aprovação" ? "border-primary/60 bg-primary/10" : "border-border/40 bg-background/40"}`}>
                <step.icon className={`h-3.5 w-3.5 ${step.label === "Sua aprovação" ? "text-primary" : "text-muted-foreground/50"}`} />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 text-center whitespace-pre-line">{step.label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mb-3" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreativesPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["creatives", campaignId],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/creatives`);
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ creatives: Creative[] }>;
    },
    refetchInterval: autoRefresh ? 4000 : false,
  });

  const creatives = data?.creatives ?? [];

  const hasProcessing = creatives.some((c) =>
    ["concept_pending", "preview_generating", "final_generating"].includes(c.status)
  );

  useEffect(() => {
    setAutoRefresh(hasProcessing);
  }, [hasProcessing]);

  const approved = creatives.filter((c) => c.status === "approved").length;
  const total = creatives.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Campanha
            </Button>
          </Link>
          <div>
            <h1 className="font-mono font-black uppercase text-xl tracking-tighter text-foreground">
              Criativos <span className="text-primary">Visuais</span>
            </h1>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {approved}/{total} aprovados {hasProcessing && <span className="text-yellow-400 ml-2 animate-pulse">· processando...</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {autoRefresh && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-yellow-400/70">
              <Clock className="h-3 w-3 animate-spin" /> atualizando
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="rounded-none font-mono uppercase text-xs tracking-widest gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <GenerateForm campaignId={campaignId!} onGenerated={() => { refetch(); setAutoRefresh(true); }} />
        </div>
      </div>

      <FlowDiagram />

      {/* Auto-generated concepts banner */}
      {(() => {
        const autoGenPending = creatives.filter(
          (c) => c.metadata?.autoGenerated && c.status === "concept_ready"
        );
        if (!autoGenPending.length) return null;
        return (
          <div className="border border-primary/30 bg-primary/5 px-5 py-4 flex items-start gap-4">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-bold text-primary uppercase tracking-widest">
                {autoGenPending.length} conceito{autoGenPending.length !== 1 ? "s" : ""} gerado{autoGenPending.length !== 1 ? "s" : ""} automaticamente do briefing de mídia
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                O briefing de mídia aprovado gerou esses conceitos automaticamente. Revise cada um e aprove para o agente gerar a imagem com DALL-E 3.
              </p>
            </div>
            <div className="font-mono text-[10px] text-primary/60 uppercase tracking-widest shrink-0 pt-0.5">
              ↓ abaixo
            </div>
          </div>
        );
      })()}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="border border-border/20 bg-card/10 aspect-square animate-pulse" />)}
        </div>
      ) : creatives.length === 0 ? (
        <div className="border border-border/20 bg-card/10 p-16 text-center">
          <Sparkles className="h-10 w-10 text-primary/20 mx-auto mb-4" />
          <div className="font-mono font-black uppercase tracking-tight text-lg text-foreground/60 mb-2">Nenhum criativo ainda</div>
          <p className="font-mono text-sm text-muted-foreground/50 max-w-sm mx-auto mb-6">
            Clique em "Gerar Criativo" para o agente criar o conceito visual completo — headline, paleta de cores, composição e prompt para geração de imagem.
          </p>
          <GenerateForm campaignId={campaignId!} onGenerated={() => { refetch(); setAutoRefresh(true); }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatives.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              campaignId={campaignId!}
              onRefresh={() => { refetch(); setAutoRefresh(true); }}
            />
          ))}
        </div>
      )}

      {creatives.length > 0 && (
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30 text-center">
          Imagens geradas por DALL-E 3 · URLs expiram em ~1 hora · Baixe os aprovados imediatamente
        </div>
      )}
    </div>
  );
}
