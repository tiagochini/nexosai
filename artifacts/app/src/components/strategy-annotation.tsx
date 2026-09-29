/**
 * Strategy Annotation System
 *
 * Lets users select any text in the strategy masterplan and either:
 * - Indagar  — challenge/question the agent's reasoning
 * - Sugerir  — propose an alternative or complementary angle
 *
 * The floating toolbar appears near the selection; a dialog opens for
 * the user's input and streams the agent's reconsidered response.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Lightbulb, X, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useUiText } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnnotationType = "indagar" | "sugerir";

interface SelectionState {
  text: string;
  rect: DOMRect;
  sectionId: string;
  sectionTitle: string;
}

interface AnnotationDialogState {
  type: AnnotationType;
  highlightedText: string;
  sectionId: string;
  sectionTitle: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTextAnnotation(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [dialog, setDialog] = useState<AnnotationDialogState | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseUp = () => {
      // Small delay so the browser finalises the selection
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelection(null);
          return;
        }

        const text = sel.toString().trim();
        if (text.length < 10) { setSelection(null); return; }

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Walk up the DOM from the anchor to find [data-section-id]
        let node: Node | null = range.commonAncestorContainer;
        let sectionId = "";
        let sectionTitle = "";
        while (node && node !== container) {
          if (node instanceof HTMLElement) {
            const sid = node.getAttribute("data-section-id");
            if (sid) {
              sectionId = sid;
              sectionTitle = node.getAttribute("data-section-title") ?? sid;
              break;
            }
          }
          node = node.parentNode;
        }

        if (!sectionId) { setSelection(null); return; }
        if (!container.contains(range.commonAncestorContainer)) { setSelection(null); return; }

        setSelection({ text, rect, sectionId, sectionTitle });
      }, 50);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef]);

  const openDialog = useCallback((type: AnnotationType) => {
    if (!selection) return;
    setDialog({
      type,
      highlightedText: selection.text,
      sectionId: selection.sectionId,
      sectionTitle: selection.sectionTitle,
    });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection]);

  const closeDialog = useCallback(() => setDialog(null), []);

  return { selection, clearSelection, openDialog, dialog, closeDialog };
}

// ─── Floating Toolbar (portal) ────────────────────────────────────────────────

interface ToolbarProps {
  selection: SelectionState;
  onAction: (type: AnnotationType) => void;
  onDismiss: () => void;
}

export function AnnotationToolbar({ selection, onAction, onDismiss }: ToolbarProps) {
  const t = useUiText();
  const { rect } = selection;

  // Position above the selection midpoint, clamped to viewport
  const midX = rect.left + rect.width / 2;
  const toolbarWidth = 220;
  const rawLeft = midX - toolbarWidth / 2;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - toolbarWidth - 8));
  const top = rect.top + window.scrollY - 52; // 52px above selection

  return createPortal(
    <div
      style={{ position: "absolute", top, left, width: toolbarWidth, zIndex: 9500 }}
      className="flex items-center gap-1 border border-white/15 bg-[#0c0c0f]/95 backdrop-blur-sm shadow-2xl shadow-black/60 px-1.5 py-1.5 animate-in fade-in-0 zoom-in-95 duration-100"
      onMouseDown={e => e.preventDefault()} // keep selection alive
    >
      {/* Tip arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-0 h-0
        border-l-[5px] border-l-transparent
        border-r-[5px] border-r-transparent
        border-t-[5px] border-t-white/15" />

      <button
        onClick={() => onAction("indagar")}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest
          px-2.5 py-1.5 border border-violet-400/25 text-violet-300/80 bg-violet-400/[0.06]
          hover:bg-violet-400/[0.14] hover:text-violet-200 hover:border-violet-400/40
          transition-all duration-100 shrink-0"
      >
        <MessageSquare className="h-2.5 w-2.5" />
        {t("Indagar", "Question", "Indagar")}
      </button>
      <button
        onClick={() => onAction("sugerir")}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest
          px-2.5 py-1.5 border border-cyan-400/25 text-cyan-300/80 bg-cyan-400/[0.06]
          hover:bg-cyan-400/[0.14] hover:text-cyan-200 hover:border-cyan-400/40
          transition-all duration-100 shrink-0 flex-1"
      >
        <Lightbulb className="h-2.5 w-2.5" />
        {t("Sugerir", "Suggest", "Sugerir")}
      </button>
      <button
        onClick={onDismiss}
        className="p-1.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors shrink-0"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>,
    document.body,
  );
}

// ─── Annotation Dialog ────────────────────────────────────────────────────────

interface DialogProps {
  state: AnnotationDialogState;
  campaignId: string;
  onClose: () => void;
}

export function AnnotationDialog({ state, campaignId, onClose }: DialogProps) {
  const t = useUiText();
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteCollapsed, setQuoteCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when dialog opens
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const isIndagar = state.type === "indagar";
  const accentCls = isIndagar
    ? { border: "border-violet-400/30", bg: "bg-violet-400/[0.04]", text: "text-violet-300/80", icon: "text-violet-400/70" }
    : { border: "border-cyan-400/30", bg: "bg-cyan-400/[0.04]", text: "text-cyan-300/80", icon: "text-cyan-400/70" };

  const label = isIndagar ? t("Indagar Especialista", "Question the Specialist", "Consultar al Especialista") : t("Sugerir ao Especialista", "Suggest to the Specialist", "Sugerir al Especialista");
  const placeholder = isIndagar
    ? t("Questione, discorde ou peça mais profundidade sobre este trecho...", "Question, disagree, or ask for more depth on this passage...", "Pregunta, discrepa o pide más profundidad sobre este fragmento...")
    : t("Proponha uma abordagem alternativa, solução ou perspectiva adicional...", "Suggest an alternative approach, solution, or additional perspective...", "Propón un enfoque alternativo, solución o perspectiva adicional...");

  const handleSubmit = async () => {
    if (!userMessage.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await customFetch<{ response: string }>(
        `/api/campaigns/${campaignId}/strategy/annotate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: state.type,
            sectionId: state.sectionId,
            sectionTitle: state.sectionTitle,
            highlightedText: state.highlightedText,
            userMessage: userMessage.trim(),
          }),
        },
      );
      setResponse(result.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erro ao processar sua pergunta.", "Error processing your question.", "Error al procesar tu pregunta."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl border-white/10 bg-[#0c0c0f] rounded-none font-mono p-0 gap-0">
        {/* Header */}
        <DialogHeader className={`px-5 pt-4 pb-3 border-b ${accentCls.border} ${accentCls.bg}`}>
          <DialogTitle className={`font-mono text-[11px] uppercase tracking-widest font-bold ${accentCls.text} flex items-center gap-2`}>
            {isIndagar
              ? <MessageSquare className="h-3 w-3" />
              : <Lightbulb className="h-3 w-3" />}
            {label}
          </DialogTitle>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 mt-0.5">
            {t("Seção:", "Section:", "Sección:")} {state.sectionTitle}
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Highlighted text quote */}
          <div className={`border ${accentCls.border} bg-white/[0.015]`}>
            <button
              onClick={() => setQuoteCollapsed(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">
                Trecho selecionado
              </span>
              {quoteCollapsed
                ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/25" />
                : <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/25" />}
            </button>
            {!quoteCollapsed && (
              <div className="px-3 pb-3">
                <p className="font-mono text-[11px] text-foreground/55 leading-relaxed italic border-l-2 border-white/10 pl-3 line-clamp-6">
                  {state.highlightedText}
                </p>
              </div>
            )}
          </div>

          {/* Input */}
          {!response && (
            <div className="space-y-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">
                {isIndagar ? t("Seu questionamento", "Your question", "Tu pregunta") : t("Sua sugestão", "Your suggestion", "Tu sugerencia")}
              </div>
              <Textarea
                ref={textareaRef}
                value={userMessage}
                onChange={e => setUserMessage(e.target.value)}
                placeholder={placeholder}
                className="font-mono text-xs bg-white/[0.02] border-white/10 resize-none min-h-[90px] focus:border-white/25 rounded-none"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-muted-foreground/25">
                  ⌘ + Enter para enviar
                </span>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={loading || !userMessage.trim()}
                  className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-7 px-4 gap-1.5
                    ${isIndagar
                      ? "bg-violet-500/80 hover:bg-violet-500 border-violet-400/30 text-white"
                      : "bg-cyan-500/80 hover:bg-cyan-500 border-cyan-400/30 text-white"
                    }`}
                >
                  {loading
                    ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />{t("Analisando…", "Analyzing…", "Analizando…")}</>
                    : <><Send className="h-2.5 w-2.5" />{t("Enviar", "Send", "Enviar")}</>}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border border-red-500/25 bg-red-500/[0.04] px-3 py-2.5">
              <p className="font-mono text-[11px] text-red-400/80">{error}</p>
            </div>
          )}

          {/* Agent response */}
          {response && (
            <div className="space-y-3">
              <div className="border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35 mb-2 flex items-center gap-1.5">
                  <span className={accentCls.text}>◆</span>
                  Resposta do Especialista
                </div>
                <p className="font-mono text-xs text-foreground/75 leading-relaxed whitespace-pre-wrap">
                  {response}
                </p>
              </div>

              {/* Ask another */}
              <div className="space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/25">
                  Continuar o debate
                </div>
                <Textarea
                  value={userMessage}
                  onChange={e => setUserMessage(e.target.value)}
                  placeholder={t("Aprofundar, questionar a resposta...", "Explore further or question the response...", "Profundizar o cuestionar la respuesta...")}
                  className="font-mono text-xs bg-white/[0.02] border-white/10 resize-none min-h-[60px] focus:border-white/25 rounded-none"
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      setResponse(null);
                      setUserMessage("");
                      handleSubmit();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={onClose}
                    className="rounded-none font-mono text-[9px] h-7 px-3 text-muted-foreground/40 hover:text-muted-foreground/70">
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setResponse(null); setUserMessage(""); handleSubmit(); }}
                    disabled={loading || !userMessage.trim()}
                    className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-7 px-4 gap-1.5
                      ${isIndagar
                        ? "bg-violet-500/70 hover:bg-violet-500/90 text-white"
                        : "bg-cyan-500/70 hover:bg-cyan-500/90 text-white"
                      }`}
                  >
                    {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                    Nova pergunta
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
