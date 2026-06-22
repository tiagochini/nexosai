import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Video, Loader2, Copy, Check, Download, Sparkles,
  UserCheck, UserX, ChevronDown, ChevronUp, Settings,
  Zap, Clock, Hash, Eye, Film, BookOpen, Clapperboard,
} from "lucide-react";
import { Link } from "wouter";

type VideoFormat = "reels" | "tiktok" | "shorts" | "stories" | "youtube" | "long_form";
type VideoStyle = "clone" | "no_face";
type VideoGoal = "awareness" | "engagement" | "sales" | "lead_capture";

interface DailyVideoScript {
  title: string;
  format: VideoFormat;
  style: VideoStyle;
  durationEstimate: string;
  creditsCost: number;
  hook: { openingLine: string; patternInterrupt: string };
  script: string;
  sections: Array<{ name: string; duration: string; script: string; visualDirection: string; toneNote: string }>;
  captions: string[];
  cta: string;
  hashtags: string[];
  thumbnailDirection: string;
  uploadInstructions: { bestPlatforms: string[]; bestTime: string; captionSuggestion: string; firstComment: string };
  productionNotes: string;
}

const FORMAT_OPTIONS: { id: VideoFormat; label: string; icon: string; duration: string; credits: number }[] = [
  { id: "reels",     label: "Instagram Reels", icon: "📸", duration: "15–60s",   credits: 12 },
  { id: "tiktok",    label: "TikTok",          icon: "🎵", duration: "15–60s",   credits: 12 },
  { id: "shorts",    label: "YouTube Shorts",  icon: "▶️", duration: "até 60s",  credits: 12 },
  { id: "stories",   label: "Stories",         icon: "⭕", duration: "4–6 frames", credits: 8  },
  { id: "youtube",   label: "YouTube",         icon: "🎬", duration: "5–15 min", credits: 20 },
  { id: "long_form", label: "Longo (Podcast/Lives)", icon: "🎙️", duration: "10–20 min", credits: 20 },
];

const GOAL_OPTIONS: { id: VideoGoal; label: string; desc: string }[] = [
  { id: "awareness",    label: "Conscientização",  desc: "Novos seguidores / alcance" },
  { id: "engagement",   label: "Engajamento",      desc: "Comentários, salvar, compartilhar" },
  { id: "sales",        label: "Vendas",           desc: "Levar para link na bio / carrinho" },
  { id: "lead_capture", label: "Captura de leads", desc: "Pegar e-mail / WhatsApp" },
];

const TONE_OPTIONS = [
  "Educativo e direto",
  "Storytelling pessoal",
  "Polêmico / contrário",
  "Revelação exclusiva",
  "Inspiracional",
  "Humor e leveza",
  "Autoridade técnica",
];

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={() => void handleCopy()} className={`flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest ${className ?? ""}`}>
      {copied ? <><Check className="h-3 w-3 text-success" />Copiado</> : <><Copy className="h-3 w-3" />Copiar</>}
    </button>
  );
}

function ScriptSection({ section, index }: { section: DailyVideoScript["sections"][0]; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border border-border/40 bg-card/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
            <span className="font-mono text-[9px] text-primary font-bold">{index + 1}</span>
          </div>
          <div className="text-left">
            <div className="font-mono text-[11px] font-bold text-foreground uppercase tracking-widest">{section.name}</div>
            <div className="font-mono text-[9px] text-muted-foreground/50">{section.duration}</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/30 px-4 py-4 space-y-3">
          <div className="space-y-1">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Fala</div>
            <div className="font-mono text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap bg-background/40 border border-border/20 px-3 py-2">
              {section.script}
            </div>
            <CopyButton text={section.script} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                <Eye className="h-3 w-3" />Visual
              </div>
              <div className="font-mono text-[10px] text-foreground/70 leading-relaxed">{section.visualDirection}</div>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />Tom
              </div>
              <div className="font-mono text-[10px] text-foreground/70 leading-relaxed">{section.toneNote}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideoDiarioPage() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<VideoFormat>("reels");
  const [goal, setGoal] = useState<VideoGoal>("engagement");
  const [tone, setTone] = useState("");
  const [productName, setProductName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DailyVideoScript | null>(null);
  const [activeTab, setActiveTab] = useState<"script" | "upload" | "production">("script");

  const { data: workspaceData } = useQuery({
    queryKey: ["/api/workspaces/me"],
    queryFn: () => customFetch<{ workspace: { metadata?: Record<string, unknown> } }>("/api/workspaces/me"),
    staleTime: 60_000,
  });
  const videoStyle: VideoStyle = (workspaceData?.workspace?.metadata?.videoProductionStyle as VideoStyle | undefined) ?? "no_face";
  const hasClone = !!(workspaceData?.workspace?.metadata?.hasClone);

  const selectedFormat = FORMAT_OPTIONS.find(f => f.id === format)!;

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("Informe o tópico do vídeo."); return; }
    setGenerating(true);
    setResult(null);
    try {
      const data = await customFetch<{ script: DailyVideoScript }>("/api/daily-video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          format,
          style: videoStyle,
          goal,
          tone: tone || undefined,
          productName: productName || undefined,
          targetAudience: targetAudience || undefined,
        }),
      });
      setResult(data.script);
      setActiveTab("script");
      toast.success(`Roteiro gerado — ${data.script.creditsCost} créditos debitados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar roteiro");
    } finally {
      setGenerating(false);
    }
  };

  const downloadScript = () => {
    if (!result) return;
    const lines = [
      `ROTEIRO — ${result.title}`,
      `Formato: ${selectedFormat.label} | Duração: ${result.durationEstimate} | Estilo: ${result.style === "clone" ? "Com Clone" : "Sem Face"}`,
      "",
      "═══════════════════════════════════════",
      "HOOK",
      "═══════════════════════════════════════",
      `Pattern interrupt: ${result.hook.patternInterrupt}`,
      `Abertura: "${result.hook.openingLine}"`,
      "",
      "═══════════════════════════════════════",
      "ROTEIRO COMPLETO",
      "═══════════════════════════════════════",
      result.script,
      "",
      "═══════════════════════════════════════",
      "SEÇÕES",
      "═══════════════════════════════════════",
      ...result.sections.map(s => [
        `\n[${s.name}] ${s.duration}`,
        `Fala: ${s.script}`,
        `Visual: ${s.visualDirection}`,
        `Tom: ${s.toneNote}`,
      ].join("\n")),
      "",
      "═══════════════════════════════════════",
      "CAPTIONS",
      "═══════════════════════════════════════",
      result.captions.join("\n"),
      "",
      `CTA: ${result.cta}`,
      "",
      `HASHTAGS: ${result.hashtags.join(" ")}`,
      "",
      "═══════════════════════════════════════",
      "INSTRUÇÕES DE UPLOAD",
      "═══════════════════════════════════════",
      `Plataformas: ${result.uploadInstructions.bestPlatforms.join(", ")}`,
      `Melhor horário: ${result.uploadInstructions.bestTime}`,
      `Legenda: ${result.uploadInstructions.captionSuggestion}`,
      `1º comentário: ${result.uploadInstructions.firstComment}`,
      "",
      "═══════════════════════════════════════",
      "NOTAS DE PRODUÇÃO",
      "═══════════════════════════════════════",
      result.productionNotes,
      "",
      `Thumbnail: ${result.thumbnailDirection}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roteiro-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center">
            <Video className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-xl font-mono uppercase tracking-tighter font-bold">Vídeo Diário</h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">
          Roteiro profissional gerado por IA · você grava e publica onde quiser
        </p>
      </div>

      {/* Video style indicator */}
      <div className={`border flex items-center gap-3 px-4 py-3 ${videoStyle === "clone" && hasClone ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"}`}>
        <div className="flex items-center gap-2 flex-1">
          {videoStyle === "clone" && hasClone
            ? <UserCheck className="h-4 w-4 text-primary shrink-0" />
            : <UserX className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest">
              {videoStyle === "clone" && hasClone ? "Estilo: Com Clone — roteiro para presença na câmera" : "Estilo: Sem Face — roteiro para narração + animação"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/50">
              {videoStyle === "clone" && hasClone
                ? "Os roteiros incluem instruções de expressão, gestos e presença"
                : "Os roteiros incluem instruções de screen recording, B-roll e texto animado"}
            </div>
          </div>
        </div>
        <Link href="/configuracoes?tab=identidade">
          <button className="flex items-center gap-1 font-mono text-[10px] text-primary hover:underline uppercase tracking-widest shrink-0">
            <Settings className="h-3 w-3" />Alterar
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Form ── */}
        <div className="space-y-5">

          {/* Format selector */}
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/70 font-bold">Formato</div>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`border px-3 py-3 text-left transition-all ${format === f.id ? "border-primary bg-primary/10" : "border-border/40 bg-background/30 hover:border-primary/30"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{f.icon}</span>
                    <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${format === f.id ? "text-primary" : "text-foreground/80"}`}>{f.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-muted-foreground/50">{f.duration}</span>
                    <span className={`font-mono text-[9px] font-bold ${format === f.id ? "text-primary" : "text-muted-foreground/50"}`}>{f.credits} cr</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/70 font-bold">Objetivo</div>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map(g => (
                <button key={g.id} onClick={() => setGoal(g.id)}
                  className={`border px-3 py-2 text-left transition-all ${goal === g.id ? "border-primary bg-primary/10" : "border-border/40 bg-background/30 hover:border-primary/30"}`}
                >
                  <div className={`font-mono text-[10px] font-bold uppercase tracking-widest ${goal === g.id ? "text-primary" : "text-foreground/80"}`}>{g.label}</div>
                  <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/70 font-bold">Tópico do vídeo <span className="text-primary">*</span></div>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ex: 3 erros que fazem o avatar não comprar no lançamento · Por que 90% dos CPLs falham no terceiro dia · O segredo que nenhum guru vai te contar sobre..."
              rows={3}
              className="w-full font-mono text-[11px] bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
            />
          </div>

          {/* Optional fields */}
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">Opcional — enriquece o roteiro</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest block mb-1">Produto / Serviço</label>
                <input value={productName} onChange={e => setProductName(e.target.value)}
                  placeholder="Ex: Mentoria em lançamentos"
                  className="w-full font-mono text-[11px] bg-background/60 border border-border/50 focus:border-primary px-3 py-1.5 text-foreground outline-none placeholder:text-muted-foreground/30 h-8" />
              </div>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest block mb-1">Público</label>
                <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                  placeholder="Ex: Empreendedores digitais"
                  className="w-full font-mono text-[11px] bg-background/60 border border-border/50 focus:border-primary px-3 py-1.5 text-foreground outline-none placeholder:text-muted-foreground/30 h-8" />
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest block mb-1">Tom</label>
              <div className="flex flex-wrap gap-1.5">
                {TONE_OPTIONS.map(t => (
                  <button key={t} onClick={() => setTone(tone === t ? "" : t)}
                    className={`border px-2 py-1 font-mono text-[10px] transition-all ${tone === t ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground/60 hover:border-primary/40"}`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate CTA */}
          <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">Custo estimado</div>
              <div className="font-mono text-sm font-bold text-primary">{selectedFormat.credits} créditos</div>
            </div>
            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || !topic.trim()}
              className="w-full rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-12 text-sm"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando roteiro…</>
                : <><Sparkles className="h-4 w-4" />Gerar Roteiro de Hoje</>}
            </Button>
            <div className="font-mono text-[9px] text-muted-foreground/30 text-center">
              Você recebe o roteiro completo — grava, edita e publica onde quiser
            </div>
          </div>
        </div>

        {/* ── Right: Result ── */}
        <div className="space-y-4">
          {!result && !generating && (
            <div className="border border-dashed border-border/30 bg-card/20 p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
              <Clapperboard className="h-10 w-10 text-muted-foreground/20" />
              <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                Seu roteiro aparece aqui
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/30 max-w-xs leading-relaxed">
                Preencha o tópico, escolha o formato e clique em Gerar
              </div>
            </div>
          )}

          {generating && (
            <div className="border border-primary/20 bg-primary/3 p-8 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <div className="relative">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              </div>
              <div className="font-mono text-[11px] text-primary uppercase tracking-widest">Gerando roteiro…</div>
              <div className="font-mono text-[10px] text-muted-foreground/40 text-center max-w-xs">
                Os agentes estão escrevendo hook, seções, captions e instruções de upload
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Result header */}
              <div className="border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] font-bold text-success uppercase tracking-widest">{result.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
                    {result.durationEstimate} · {result.style === "clone" ? "Com Clone" : "Sem Face"} · {result.creditsCost} cr
                  </div>
                </div>
                <button
                  onClick={downloadScript}
                  className="flex items-center gap-1.5 font-mono text-[10px] border border-success/30 text-success hover:bg-success/10 transition-colors px-3 py-1.5 uppercase tracking-widest"
                >
                  <Download className="h-3.5 w-3.5" />Download
                </button>
              </div>

              {/* Hook highlight */}
              <div className="border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 font-bold flex items-center gap-2">
                  <Zap className="h-3 w-3" />Hook — Primeiros 3 segundos
                </div>
                <div className="font-mono text-[11px] text-foreground/90 font-bold">"{result.hook.openingLine}"</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">{result.hook.patternInterrupt}</div>
                <CopyButton text={result.hook.openingLine} />
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border border-border/50 bg-card/30">
                {(["script", "upload", "production"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                    {tab === "script" ? "Roteiro" : tab === "upload" ? "Upload" : "Produção"}
                  </button>
                ))}
              </div>

              {activeTab === "script" && (
                <div className="space-y-3">
                  {/* Full script */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5"><BookOpen className="h-3 w-3" />Roteiro Completo</div>
                      <CopyButton text={result.script} />
                    </div>
                    <div className="font-mono text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap bg-background/30 border border-border/20 px-3 py-3 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border/30">
                      {result.script}
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5"><Film className="h-3 w-3" />Seções</div>
                    {result.sections.map((s, i) => <ScriptSection key={i} section={s} index={i} />)}
                  </div>

                  {/* Captions + CTA */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5"><Eye className="h-3 w-3" />Captions</div>
                      <div className="space-y-1">
                        {result.captions.map((c, i) => (
                          <div key={i} className="font-mono text-[10px] border border-border/20 bg-background/30 px-2 py-1 text-foreground/80">{c}</div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5"><Hash className="h-3 w-3" />Hashtags</div>
                      <div className="flex flex-wrap gap-1">
                        {result.hashtags.map((h, i) => (
                          <Badge key={i} variant="outline" className="font-mono text-[9px] rounded-none border-border/30 text-muted-foreground/70 px-1.5 py-0.5">{h}</Badge>
                        ))}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5 mt-2"><Zap className="h-3 w-3" />CTA</div>
                      <div className="font-mono text-[11px] border border-primary/20 bg-primary/5 px-2 py-1.5 text-primary">{result.cta}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "upload" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border/30 bg-card/30 px-4 py-4 space-y-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Melhores plataformas</div>
                      <div className="space-y-0.5">
                        {result.uploadInstructions.bestPlatforms.map((p, i) => (
                          <div key={i} className="font-mono text-[11px] text-foreground/80">• {p}</div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-border/30 bg-card/30 px-4 py-4 space-y-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5"><Clock className="h-3 w-3" />Melhor horário</div>
                      <div className="font-mono text-[11px] text-foreground/80">{result.uploadInstructions.bestTime}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Legenda pronta</div>
                      <CopyButton text={result.uploadInstructions.captionSuggestion} />
                    </div>
                    <div className="font-mono text-[11px] text-foreground/80 leading-relaxed bg-background/30 border border-border/20 px-3 py-3 whitespace-pre-wrap">
                      {result.uploadInstructions.captionSuggestion}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">1º comentário (engajamento)</div>
                      <CopyButton text={result.uploadInstructions.firstComment} />
                    </div>
                    <div className="font-mono text-[11px] text-foreground/80 bg-background/30 border border-border/20 px-3 py-2">
                      {result.uploadInstructions.firstComment}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Thumbnail / Capa</div>
                    <div className="font-mono text-[11px] text-foreground/70 leading-relaxed bg-background/30 border border-border/20 px-3 py-2">
                      {result.thumbnailDirection}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "production" && (
                <div className="space-y-3">
                  <div className="border border-border/30 bg-card/30 px-4 py-4">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-2">Notas de Produção</div>
                    <div className="font-mono text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{result.productionNotes}</div>
                  </div>
                  <div className="border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70 font-bold">Próximos passos</div>
                    <ol className="space-y-1.5">
                      {["Leia o roteiro em voz alta 2× antes de gravar", "Configure iluminação e fundo (ou tela de captura)", "Grave o hook 3 vezes — escolha o melhor", "Edite com as captions e direção visual indicadas", "Publique nas plataformas recomendadas no horário certo"].map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="font-mono text-[8px] text-primary font-bold">{i + 1}</span>
                          </div>
                          <span className="font-mono text-[10px] text-foreground/70">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
