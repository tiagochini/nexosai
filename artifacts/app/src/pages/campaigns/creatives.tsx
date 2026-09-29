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
import { useUiText } from "@/lib/i18n";

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

const FORMATS: Record<string, { label: [string, string, string]; ratio: string; desc: string }> = {
  feed_square:    { label: ["Feed quadrado", "Square feed", "Feed cuadrado"], ratio: "1:1",   desc: "1080×1080px" },
  feed_portrait:  { label: ["Feed retrato", "Portrait feed", "Feed vertical"],  ratio: "4:5",   desc: "1080×1350px" },
  stories:        { label: ["Stories", "Stories", "Stories"],       ratio: "9:16",  desc: "1080×1920px" },
  banner:         { label: ["Banner", "Banner", "Banner"],        ratio: "16:9",  desc: "1920×1080px" },
  carousel_slide: { label: ["Slide de carrossel", "Carousel slide", "Diapositiva de carrusel"],     ratio: "1:1",   desc: "1080×1080px" },
};

const STATUS_CONFIG: Record<string, { label: [string, string, string]; color: string; icon: React.ElementType }> = {
  concept_pending:   { label: ["Gerando conceito...", "Generating concept...", "Generando concepto..."], color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  concept_ready:     { label: ["Aguardando aprovação", "Awaiting approval", "Pendiente de aprobación"], color: "border-primary/40 bg-primary/10 text-primary", icon: Eye },
  preview_generating:{ label: ["Gerando imagem...", "Generating image...", "Generando imagen..."],  color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  preview_ready:     { label: ["Preview pronto", "Preview ready", "Vista previa lista"],     color: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400", icon: Eye },
  final_generating:  { label: ["Gerando versão final HD...", "Generating final HD...", "Generando versión final HD..."],color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400", icon: Loader2 },
  approved:          { label: ["Aprovado", "Approved", "Aprobado"],           color: "border-green-400/40 bg-green-400/10 text-green-400", icon: CheckCircle2 },
  rejected:          { label: ["Rejeitado", "Rejected", "Rechazado"],          color: "border-red-400/40 bg-red-400/10 text-red-400", icon: XCircle },
};

const TRIGGER_LABELS: Record<string, [string, string, string]> = {
  authority: ["Autoridade", "Authority", "Autoridad"], transformation: ["Transformação", "Transformation", "Transformación"], scarcity: ["Escassez", "Scarcity", "Escasez"],
  curiosity: ["Curiosidade", "Curiosity", "Curiosidad"], social_proof: ["Prova social", "Social proof", "Prueba social"], urgency: ["Urgência", "Urgency", "Urgencia"],
};

// ── Generate form ─────────────────────────────────────────────────────────────

function GenerateForm({ campaignId, onGenerated }: { campaignId: string; onGenerated: () => void }) {
  const t = useUiText();
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("feed_square");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      return customFetch<unknown>(`/api/campaigns/${campaignId}/creatives/concept`, {
        method: "POST",
        body: JSON.stringify({ platform, format, requestNote: note }),
      });
    },
    onSuccess: () => {
      toast.success(t("Conceito gerado! Revise e aprove para gerar a imagem.", "Concept generated! Review and approve it to generate the image.", "¡Concepto generado! Revísalo y apruébalo para generar la imagen."));
      setOpen(false);
      setNote("");
      onGenerated();
    },
    onError: () => toast.error(t("Erro ao gerar conceito. Verifique seus créditos.", "Error generating concept. Check your credits.", "Error al generar el concepto. Comprueba tus créditos.")),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold gap-2">
        <Plus className="h-4 w-4" /> {t("Gerar criativo", "Generate creative", "Generar creativo")}
      </Button>
    );
  }

  return (
    <div className="border border-primary/30 bg-primary/5 p-6 mb-6">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4">{t("Novo criativo", "New creative", "Nuevo creativo")}</div>
      <div className="space-y-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("Plataforma", "Platform", "Plataforma")}</div>
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
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("Formato", "Format", "Formato")}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMATS).map(([value, fmt]) => (
              <button
                key={value}
                onClick={() => setFormat(value)}
                className={`px-3 py-1.5 border font-mono text-xs uppercase tracking-widest transition-all ${format === value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border"}`}
              >
                {t(...fmt.label)} <span className="opacity-50">{fmt.ratio}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("Briefing adicional (opcional)", "Additional briefing (optional)", "Briefing adicional (opcional)")}</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Ex.: foco na transformação do produto, tons quentes, mostrar uma pessoa sorrindo...", "E.g., focus on the product transformation, warm tones, show a smiling person...", "Ej.: destacar la transformación del producto, tonos cálidos, mostrar a una persona sonriente...")}
            rows={2}
            maxLength={500}
            className="w-full bg-background/50 border border-border/50 rounded-none px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/60"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => mutate()} disabled={isPending} className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-10 gap-2">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {isPending ? t("Gerando conceito...", "Generating concept...", "Generando concepto...") : t("Gerar conceito (10 créditos)", "Generate concept (10 credits)", "Generar concepto (10 créditos)")}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase text-xs tracking-widest h-10">
            {t("Cancelar", "Cancel", "Cancelar")}
          </Button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          {t("Conceito: 10 créditos · Preview: 50 créditos · Final HD: 150 créditos", "Concept: 10 credits · Preview: 50 credits · Final HD: 150 credits", "Concepto: 10 créditos · Vista previa: 50 créditos · Final HD: 150 créditos")}
        </p>
      </div>
    </div>
  );
}

// ── Creative Card ─────────────────────────────────────────────────────────────

function CreativeCard({ creative, campaignId, onRefresh }: { creative: Creative; campaignId: string; onRefresh: () => void }) {
  const t = useUiText();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const status = STATUS_CONFIG[creative.status] ?? STATUS_CONFIG.concept_pending;
  const StatusIcon = status.icon;
  const fmt = FORMATS[creative.format];
  const plat = PLATFORMS.find((p) => p.value === creative.platform);

  const approveConcept = useMutation({
    mutationFn: async () => {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/creatives/${creative.id}/approve-concept`, { method: "POST" });
    },
    onSuccess: () => { toast.success(t("Conceito aprovado! Gerando imagem...", "Concept approved! Generating image...", "¡Concepto aprobado! Generando imagen...")); onRefresh(); },
    onError: () => toast.error(t("Erro ao aprovar conceito", "Error approving concept", "Error al aprobar el concepto")),
  });

  const approvePreview = useMutation({
    mutationFn: async () => {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/creatives/${creative.id}/approve-preview`, { method: "POST" });
    },
    onSuccess: () => { toast.success(t("Preview aprovado! Gerando versão final HD...", "Preview approved! Generating final HD version...", "¡Vista previa aprobada! Generando la versión final HD...")); onRefresh(); },
    onError: () => toast.error(t("Erro ao aprovar preview", "Error approving preview", "Error al aprobar la vista previa")),
  });

  const reject = useMutation({
    mutationFn: async () => {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/creatives/${creative.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
    },
    onSuccess: () => { toast.success(t("Criativo rejeitado", "Creative rejected", "Creativo rechazado")); setShowReject(false); onRefresh(); },
    onError: () => toast.error(t("Erro ao rejeitar", "Error rejecting", "Error al rechazar")),
  });

  const regenerate = useMutation({
    mutationFn: async (quality: "standard" | "hd") => {
      await customFetch<unknown>(`/api/campaigns/${campaignId}/creatives/${creative.id}/regenerate`, {
        method: "POST",
        body: JSON.stringify({ quality }),
      });
    },
    onSuccess: () => { toast.success(t("Regenerando imagem...", "Regenerating image...", "Regenerando imagen...")); onRefresh(); },
    onError: () => toast.error(t("Erro ao regenerar", "Error regenerating", "Error al regenerar")),
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
             {plat?.label ?? creative.platform} · {fmt ? t(...fmt.label) : creative.format}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 border px-2 py-0.5 shrink-0 ${status.color}`}>
          <StatusIcon className={`h-3 w-3 shrink-0 ${["concept_pending","preview_generating","final_generating"].includes(creative.status) ? "animate-spin" : ""}`} />
           <span className="font-mono text-[10px] uppercase tracking-widest">{t(...status.label)}</span>
        </div>
      </div>

      {/* Image area */}
      <div className={`relative bg-background/40 flex items-center justify-center ${creative.format === "stories" || creative.format === "feed_portrait" ? "aspect-[9/16] max-h-64" : creative.format === "banner" ? "aspect-video" : "aspect-square"} overflow-hidden`}
        style={{ maxHeight: 320 }}>
        {hasImage ? (
          <img
            src={imageUrl!}
            alt={t("Criativo gerado", "Generated creative", "Creativo generado")}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground/30 p-6 text-center">
            {["preview_generating", "final_generating", "concept_pending"].includes(creative.status) ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                <span className="font-mono text-xs uppercase tracking-widest">{t("Processando...", "Processing...", "Procesando...")}</span>
              </>
            ) : imageError ? (
              <>
                <ImageOff className="h-10 w-10" />
                <span className="font-mono text-[10px] uppercase tracking-widest">{t("A geração de imagem requer uma chave OpenAI com acesso ao DALL-E 3.", "Image generation requires an OpenAI key with access to DALL-E 3.", "La generación de imágenes requiere una clave de OpenAI con acceso a DALL-E 3.")}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-10 w-10 text-primary/30" />
                <span className="font-mono text-xs uppercase tracking-widest">{t("Conceito pronto · aprove para gerar a imagem", "Concept ready · approve to generate the image", "Concepto listo · apruébalo para generar la imagen")}</span>
              </>
            )}
          </div>
        )}

        {/* Approved badge overlay */}
        {creative.status === "approved" && hasImage && (
          <div className="absolute top-2 right-2 bg-green-500/90 px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white font-bold">✓ {t("Aprovado", "Approved", "Aprobado")}</span>
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
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 block">{t("Gatilho", "Trigger", "Disparador")}</span>
                <span className="font-mono text-foreground/70">{TRIGGER_LABELS[creative.concept.mentalTrigger] ? t(...TRIGGER_LABELS[creative.concept.mentalTrigger]) : creative.concept.mentalTrigger}</span>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Zap className="h-3 w-3 text-primary/50 mt-0.5 shrink-0" />
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 block">{t("Ângulo", "Angle", "Ángulo")}</span>
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
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Visão do criativo", "Creative vision", "Visión del creativo")}</div>
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
                {t("Aprovar · Gerar imagem (50 créditos)", "Approve · Generate image (50 credits)", "Aprobar · Generar imagen (50 créditos)")}
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
                  <RefreshCw className="h-3 w-3" /> {t("Gerar outra variação (50 créditos)", "Generate another variation (50 credits)", "Generar otra variación (50 créditos)")}
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
                  <Download className="h-3.5 w-3.5" /> {t("Baixar criativo", "Download creative", "Descargar creativo")}
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
                <RefreshCw className="h-3.5 w-3.5" /> {t("Regenerar", "Regenerate", "Regenerar")}
              </Button>
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div className="border border-red-400/20 bg-red-400/5 p-3 space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("Motivo da rejeição (opcional)...", "Reason for rejection (optional)...", "Motivo del rechazo (opcional)...")}
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
                  <XCircle className="h-3 w-3" /> {t("Rejeitar", "Reject", "Rechazar")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReject(false)}
                  className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8"
                >
                  {t("Cancelar", "Cancel", "Cancelar")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {creative.status === "rejected" && creative.rejectionReason && (
        <div className="px-4 pb-4">
          <p className="font-mono text-xs text-muted-foreground/60">{t("Motivo:", "Reason:", "Motivo:")} {creative.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

// ── Flow diagram ──────────────────────────────────────────────────────────────

function FlowDiagram() {
  const t = useUiText();
  const steps = [
    { icon: Wand2, label: t("Conceito", "Concept", "Concepto"), sub: t("Equipe gera headline,\nvisual e prompt", "Team creates headline,\nvisual, and prompt", "El equipo crea el titular,\nla imagen y el prompt"), approval: false },
    { icon: Eye, label: t("Sua aprovação", "Your approval", "Tu aprobación"), sub: t("Revise o conceito\nantes de gerar qualquer imagem", "Review the concept\nbefore generating an image", "Revisa el concepto\nantes de generar una imagen"), approval: true },
    { icon: Sparkles, label: "Preview", sub: t("DALL-E 3 gera\na imagem (padrão)", "DALL-E 3 generates\nthe image (standard)", "DALL-E 3 genera\nla imagen (estándar)"), approval: false },
    { icon: Eye, label: t("Sua aprovação", "Your approval", "Tu aprobación"), sub: t("Veja a imagem antes\nda versão final HD", "Review the image before\nthe final HD version", "Revisa la imagen antes\nde la versión final HD"), approval: true },
    { icon: CheckCircle2, label: "Final HD", sub: t("Alta resolução\npara uso real", "High resolution\nfor real-world use", "Alta resolución\npara uso real"), approval: false },
  ];
  return (
    <div className="border border-border/20 bg-card/10 px-6 py-4 mb-6">
       <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3">{t("Fluxo de aprovação", "Approval flow", "Flujo de aprobación")}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-8 h-8 border flex items-center justify-center ${step.approval ? "border-primary/60 bg-primary/10" : "border-border/40 bg-background/40"}`}>
                <step.icon className={`h-3.5 w-3.5 ${step.approval ? "text-primary" : "text-muted-foreground/50"}`} />
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
  const t = useUiText();
  const { id: campaignId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["creatives", campaignId],
    queryFn: async () => {
      return customFetch<{ creatives: Creative[] }>(`/api/campaigns/${campaignId}/creatives`);
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
              <ArrowLeft className="h-3.5 w-3.5" /> {t("Campanha", "Campaign", "Campaña")}
            </Button>
          </Link>
          <div>
            <h1 className="font-mono font-black uppercase text-xl tracking-tighter text-foreground">
               {t("Criativos", "Visual", "Creativos")} <span className="text-primary">{t("Visuais", "Creatives", "visuales")}</span>
            </h1>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {approved}/{total} {t("aprovados", "approved", "aprobados")} {hasProcessing && <span className="text-yellow-400 ml-2 animate-pulse">· {t("processando...", "processing...", "procesando...")}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {autoRefresh && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-yellow-400/70">
              <Clock className="h-3 w-3 animate-spin" /> {t("atualizando", "refreshing", "actualizando")}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="rounded-none font-mono uppercase text-xs tracking-widest gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> {t("Atualizar", "Refresh", "Actualizar")}
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
                 {t(`${autoGenPending.length} conceito${autoGenPending.length !== 1 ? "s" : ""} gerado${autoGenPending.length !== 1 ? "s" : ""} automaticamente do briefing de mídia`, `${autoGenPending.length} concept${autoGenPending.length !== 1 ? "s" : ""} automatically generated from the media briefing`, `${autoGenPending.length} concepto${autoGenPending.length !== 1 ? "s" : ""} generado${autoGenPending.length !== 1 ? "s" : ""} automáticamente a partir del briefing de medios`)}
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                 {t("O briefing de mídia aprovado gerou esses conceitos automaticamente. Revise cada um e aprove para o agente gerar a imagem com DALL-E 3.", "The approved media briefing generated these concepts automatically. Review and approve each one to have the agent generate its image with DALL-E 3.", "El briefing de medios aprobado generó estos conceptos automáticamente. Revísalos y aprueba cada uno para que el agente genere la imagen con DALL-E 3.")}
              </p>
            </div>
            <div className="font-mono text-[10px] text-primary/60 uppercase tracking-widest shrink-0 pt-0.5">
               ↓ {t("abaixo", "below", "abajo")}
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
           <div className="font-mono font-black uppercase tracking-tight text-lg text-foreground/60 mb-2">{t("Nenhum criativo ainda", "No creatives yet", "Aún no hay creativos")}</div>
          <p className="font-mono text-sm text-muted-foreground/50 max-w-sm mx-auto mb-6">
             {t('Clique em "Gerar criativo" para que o agente crie o conceito visual completo — título, paleta de cores, composição e prompt para gerar a imagem.', 'Click "Generate creative" to have the agent create the complete visual concept—headline, color palette, composition, and image-generation prompt.', 'Haz clic en "Generar creativo" para que el agente cree el concepto visual completo: titular, paleta de colores, composición y prompt para generar la imagen.')}
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
           {t("Imagens geradas por DALL-E 3 · Os links expiram em cerca de 1 hora · Baixe imediatamente as imagens aprovadas", "Images generated by DALL-E 3 · URLs expire in about 1 hour · Download approved images immediately", "Imágenes generadas por DALL-E 3 · Los enlaces caducan en aproximadamente 1 hora · Descarga enseguida las imágenes aprobadas")}
        </div>
      )}
    </div>
  );
}
