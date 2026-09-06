import { useState, useCallback, useRef, useEffect } from "react";
import { Camera, Sparkles, Loader2, Send, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { videoEditorClient } from "./lib/video-editor-client";

interface VisualFrame {
  timestamp: number;
  notes: string;
  issues: string[];
  strengths: string[];
}

interface VisualAnalysisResult {
  overallScore: number;
  summary: string;
  frames: VisualFrame[];
  recommendations: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VisualAnalysisCard({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await videoEditorClient.visualAnalysis<VisualAnalysisResult>(fileId);
      setResult(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na análise visual.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const scoreColor = result
    ? result.overallScore >= 80 ? "text-chart-2" : result.overallScore >= 60 ? "text-primary" : "text-chart-5"
    : "";

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
        </div>
        {!result && (
          <button
            onClick={() => void runAnalysis()}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 bg-primary/10 border border-primary/30 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando frames…</> : <><Sparkles className="w-3.5 h-3.5" /> Analisar fotografia (ATLAS)</>}
          </button>
        )}
        {result && (
          <button onClick={() => setExpanded(e => !e)} className={`text-xs font-semibold ${scoreColor}`}>
            {result.overallScore}/100 {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-chart-5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}

      {result && expanded && (
        <div className="space-y-3 pt-1 border-t border-border/60">
          <p className="text-xs text-muted-foreground italic pt-2">{result.summary}</p>

          <div className="space-y-1.5">
            {result.frames.map((f, i) => (
              <div key={i} className="text-xs bg-background/50 rounded-lg p-2.5 space-y-1">
                <span className="font-mono text-muted-foreground">{formatTime(f.timestamp)}</span>
                <p className="text-foreground/80">{f.notes}</p>
                {f.strengths.length > 0 && (
                  <p className="text-chart-2 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> {f.strengths.join(" · ")}</p>
                )}
                {f.issues.length > 0 && (
                  <p className="text-chart-5 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {f.issues.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>

          {result.recommendations.length > 0 && (
            <div className="text-xs bg-primary/5 border border-primary/20 rounded-lg p-2.5">
              <p className="font-semibold text-foreground mb-1">Recomendações do diretor de fotografia:</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {result.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DirectorChatPanel({ script, fileIds }: { script: string; fileIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextHistory: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const data = await videoEditorClient.directorChat<{ reply?: string; error?: string }>({ message: text, history: messages, script, fileIds });
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "Sem resposta." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Falha ao consultar o diretor. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, script, fileIds]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 py-3 px-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-opacity"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm font-semibold">Falar com ATLAS</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[360px] max-w-[90vw] h-[480px] max-h-[70vh] bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">ATLAS — Diretor ao vivo</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-sm" aria-label="Fechar chat com o diretor">✕</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground px-2">
            Pergunte sobre enquadramento, ritmo de corte, qual take usar, ou como consertar uma cena específica — a qualquer momento da edição.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] text-xs rounded-xl px-3 py-2 ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-background border border-border text-foreground"}`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 w-fit">
            <Loader2 className="w-3 h-3 animate-spin" /> ATLAS está pensando…
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-border">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Pergunte ao diretor…"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button onClick={() => void send()} disabled={loading || !input.trim()} className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-40" aria-label="Enviar mensagem">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
