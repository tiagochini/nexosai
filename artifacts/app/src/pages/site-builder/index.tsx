/**
 * Construtor de Sites equipe especializada — prompt-flow.
 *
 * O usuário descreve o que quer, faz upload da logo/marca,
 * e a equipe gera a estrutura HTML/CSS da landing page.
 *
 * Feature gate: pode ser habilitado/desabilitado por plano ou toggle de admin.
 * Toggle armazenado em localStorage para facilitar demo.
 */

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe, Wand2, Upload, Eye, Code2, Download, RefreshCw,
  Lock, Unlock, Info, Loader2, CheckCircle2, Trash2,
  Sparkles, ImageIcon, X,
} from "lucide-react";

// ── Feature gate ──────────────────────────────────────────────────────────────

const FEATURE_KEY = "nexos_site_builder_enabled";

function isFeatureEnabled(isAdmin: boolean, planSlug?: string | null): boolean {
  const stored = localStorage.getItem(FEATURE_KEY);
  if (stored !== null) return stored === "1";
  return isAdmin || planSlug === "agency";
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedSite {
  html: string;
  title: string;
  description: string;
  sections: string[];
  seoTips: string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SiteBuilderPage() {
  const { isAdmin, planSlug } = useAuth();

  const [enabled, setEnabled] = useState(() => isFeatureEnabled(isAdmin, planSlug));
  const [prompt, setPrompt]   = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [site, setSite]       = useState<GeneratedSite | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "seo">("preview");
  const [previewFrame, setPreviewFrame] = useState<HTMLIFrameElement | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  const toggleFeature = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(FEATURE_KEY, next ? "1" : "0");
    toast.success(next ? "Construtor de Sites habilitado." : "Construtor de Sites desabilitado.");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo deve ter menos de 5 MB."); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => { setLogoFile(null); setLogoPreview(null); };

  const generateSite = async () => {
    if (!prompt.trim()) { toast.error("Descreva o site que deseja criar."); return; }
    setGenerating(true);
    setSite(null);

    // Build the team prompt
    const systemPrompt = `Você é um especialista em landing pages de alta conversão para o mercado digital brasileiro.
Gere uma landing page completa e profissional em HTML puro (sem frameworks externos, apenas CSS inline e HTML5 semântico).
O site deve ser responsivo, com design premium, preto/branco/dourado, e converter bem para venda de produtos digitais.

Responda APENAS com JSON no seguinte formato (sem markdown, sem código block):
{
  "title": "Título da página",
  "description": "Meta description SEO",
  "sections": ["Hero", "Benefícios", "Prova Social", "Oferta", "FAQ", "CTA"],
  "seoTips": ["Dica 1", "Dica 2", "Dica 3"],
  "html": "<!DOCTYPE html>...HTML COMPLETO DA PÁGINA..."
}`;

    const userMessage = `Crie uma landing page para: ${prompt.trim()}${logoPreview ? "\n\nA logo foi fornecida e deve ser exibida no header como uma imagem." : ""}`;

    try {
      const res = await customFetch<{ response: string; tokensUsed: number; creditsCharged: number }>(
        "/api/agents/direct-chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentRole: "landing_page",
            message: userMessage,
            history: [{ role: "system", content: systemPrompt }],
            contextMode: "strategy",
          }),
        },
      );

      // Parse response
      let parsed: GeneratedSite;
      try {
        const raw = res.response.trim();
        // Try to extract JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        parsed = JSON.parse(jsonMatch[0]) as GeneratedSite;
      } catch {
        // Fallback: treat as HTML directly
        parsed = {
          html: res.response,
          title: "Landing Page Gerada",
          description: "Página gerada pelo NexOS",
          sections: ["Hero", "Benefícios", "CTA"],
          seoTips: ["Adicione palavras-chave no title", "Otimize imagens", "Use HTTPS"],
        };
      }

      // If logo was provided, inject it into the HTML
      if (logoPreview && parsed.html) {
        parsed.html = parsed.html.replace(
          /<body[^>]*>/i,
          `$&\n<!-- Logo injetada pelo NexOS -->\n<script>
  document.addEventListener('DOMContentLoaded', function() {
    var imgs = document.querySelectorAll('img[alt*="logo"], img[alt*="Logo"], #logo, .logo img');
    imgs.forEach(function(img) { img.src = "${logoPreview}"; });
  });
</script>`,
        );
      }

      setSite(parsed);
      toast.success("Site gerado com sucesso!");
    } catch (err) {
      toast.error((err as Error).message || "Erro ao gerar o site. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadHtml = () => {
    if (!site) return;
    const blob = new Blob([site.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "landing-page-nexos.html"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast.success("Download iniciado — arquivo index.html salvo.");
  };

  // ── Locked state ───────────────────────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center p-8">
        <div className="w-16 h-16 border border-border/50 bg-card/40 flex items-center justify-center">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-mono font-black text-2xl uppercase tracking-wide text-foreground mb-2">
            Construtor de Sites equipe especializada
          </h1>
          <p className="font-mono text-sm text-muted-foreground max-w-md leading-relaxed">
            Esta funcionalidade está desabilitada. Descreva o que quer e a equipe gera sua landing page completa.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={toggleFeature} variant="outline" className="rounded-none font-mono uppercase tracking-widest text-xs">
            <Unlock className="h-3.5 w-3.5 mr-2" />Habilitar (Admin)
          </Button>
        )}
        {!isAdmin && (
          <p className="font-mono text-xs text-muted-foreground/60">
            Disponível no plano Agency ou quando habilitado pelo administrador.
          </p>
        )}
      </div>
    );
  }

  // ── Enabled UI ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-primary/40 bg-primary/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono font-black text-2xl uppercase tracking-wide">Construtor de Sites</h1>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Prompt → Logo → Análise → Site Gerado
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] rounded-none border-emerald-500/40 text-emerald-400">
            <Sparkles className="h-2.5 w-2.5 mr-1" />Ativo
          </Badge>
          {isAdmin && (
            <button onClick={toggleFeature}
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
              <Lock className="h-3 w-3" />Desabilitar
            </button>
          )}
        </div>
      </div>

      {/* Input section */}
      {!site && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prompt */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-border/50 bg-card/40 p-5 space-y-4">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground block mb-2">
                  Descreva seu site / produto
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={8}
                  placeholder={`Exemplo: Quero uma landing page de vendas para meu curso "Investimentos do Zero" voltado para iniciantes que querem começar a investir com R$100/mês. O produto custa R$997, inclui 40 aulas, 3 bônus e garantia de 7 dias. Tom: confiante, educativo, sem jargão financeiro. Público: homens e mulheres 25-45 anos.`}
                  className="w-full border border-border/50 bg-background/60 px-4 py-3 text-sm font-mono
                    text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-start gap-2 px-3 py-2 border border-primary/20 bg-primary/5">
                <Info className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  Quanto mais detalhes, melhor o resultado: nicho, avatar, preço, benefícios, garantia, objeções, tom de voz.
                </p>
              </div>

              <Button onClick={generateSite} disabled={generating || !prompt.trim()}
                className="w-full rounded-none font-mono uppercase tracking-widest text-xs">
                {generating ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Gerando site…</>
                ) : (
                  <><Wand2 className="h-3.5 w-3.5 mr-2" />Gerar Landing Page</>
                )}
              </Button>
            </div>
          </div>

          {/* Logo upload */}
          <div className="space-y-4">
            <div className="border border-border/50 bg-card/40 p-5 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Logo / Marca (opcional)
              </p>

              {!logoPreview ? (
                <button onClick={() => logoInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border/50 hover:border-primary/40 p-8 text-center transition-all group">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    Clique para subir
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">PNG · SVG · JPG · até 5MB</p>
                </button>
              ) : (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="w-full h-40 object-contain border border-border/30 bg-black/20 p-4" />
                  <button onClick={removeLogo}
                    className="absolute top-2 right-2 w-6 h-6 bg-destructive/80 hover:bg-destructive flex items-center justify-center transition-colors">
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                  <p className="font-mono text-[10px] text-muted-foreground mt-2 truncate">{logoFile?.name}</p>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

              <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                A equipe analisará sua logo para definir paleta de cores e identidade visual do site.
              </p>
            </div>

            {/* Tips */}
            <div className="border border-border/30 bg-card/20 p-4 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Dicas rápidas</p>
              {[
                "Inclua o preço e forma de pagamento",
                "Mencione o público-alvo específico",
                "Liste os 3 principais benefícios",
                "Fale o que está incluído no produto",
                "Especifique o tom: formal, informal, urgente",
              ].map((tip, i) => (
                <p key={i} className="font-mono text-[10px] text-muted-foreground flex gap-1.5">
                  <span className="text-primary/60">·</span>{tip}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border border-primary/30 bg-primary/5 p-8 text-center space-y-4">
          <div className="relative mx-auto w-14 h-14">
            <div className="absolute inset-0 border-2 border-primary/30 animate-ping rounded-sm" />
            <div className="w-14 h-14 border border-primary/50 flex items-center justify-center">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-foreground uppercase tracking-wide">
              equipe especializada gerando sua landing page…
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Analisando prompt · Definindo estrutura · Escrevendo copy · Gerando HTML
            </p>
          </div>
          <div className="flex justify-center gap-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {site && !generating && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="font-mono text-sm font-bold text-foreground">{site.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{site.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={generateSite}
                className="rounded-none font-mono text-[11px] uppercase tracking-widest">
                <RefreshCw className="h-3 w-3 mr-1.5" />Regenerar
              </Button>
              <Button size="sm" onClick={downloadHtml}
                className="rounded-none font-mono text-[11px] uppercase tracking-widest">
                <Download className="h-3 w-3 mr-1.5" />Baixar HTML
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSite(null)}
                className="rounded-none font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1.5" />Novo
              </Button>
            </div>
          </div>

          {/* Sections badges */}
          <div className="flex flex-wrap gap-1.5">
            {site.sections.map(s => (
              <Badge key={s} variant="outline" className="font-mono text-[10px] rounded-none border-border/50 text-muted-foreground">
                {s}
              </Badge>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border/50">
            {([
              { id: "preview" as const, label: "Preview", icon: Eye },
              { id: "code"    as const, label: "Código HTML", icon: Code2 },
              { id: "seo"     as const, label: "SEO Tips", icon: Globe },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-all
                  ${activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <tab.icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "preview" && (
            <div className="border border-border/50">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-card/40">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">landing-page-nexos.html</span>
              </div>
              <iframe
                ref={el => setPreviewFrame(el)}
                srcDoc={site.html}
                title="Preview da Landing Page"
                className="w-full border-0"
                style={{ height: "70vh" }}
                sandbox="allow-scripts"
              />
            </div>
          )}

          {activeTab === "code" && (
            <div className="relative">
              <pre className="border border-border/50 bg-black/40 p-4 overflow-auto text-[11px] font-mono text-emerald-300/80 leading-relaxed"
                style={{ maxHeight: "70vh" }}>
                {site.html}
              </pre>
              <button
                onClick={() => { void navigator.clipboard.writeText(site.html); toast.success("Código copiado!"); }}
                className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border/40 px-2 py-1 bg-background/80 transition-colors">
                Copiar
              </button>
            </div>
          )}

          {activeTab === "seo" && (
            <div className="border border-border/50 bg-card/20 p-5 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
                Recomendações de SEO
              </p>
              {site.seoTips.map((tip, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="font-mono text-[10px] text-primary/70 shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <p className="font-mono text-xs text-foreground">{tip}</p>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Meta tags geradas</p>
                <code className="block text-[10px] font-mono text-emerald-300/70 bg-black/30 p-3 leading-relaxed">
                  {`<title>${site.title}</title>\n<meta name="description" content="${site.description}" />`}
                </code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
