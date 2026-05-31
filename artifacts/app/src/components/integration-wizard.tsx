import { useState, useRef, useCallback, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Bot, Send, ImagePlus, X, Loader2, User, Sparkles,
  ChevronDown, ChevronUp, Paperclip,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
}

function formatReply(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (/^\d+\.\s/.test(line)) {
      return (
        <li key={i} className="ml-4 font-mono text-xs text-foreground/80 leading-relaxed">
          {line.replace(/^\d+\.\s/, "")}
        </li>
      );
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className="font-mono text-xs font-bold text-primary mt-2">
          {line.slice(2, -2)}
        </p>
      );
    }
    if (line.startsWith("── ") || line.startsWith("━")) {
      return (
        <p key={i} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mt-3 mb-1">
          {line.replace(/^──\s+/, "").replace(/━+/g, "")}
        </p>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-1.5" />;
    // Bold inline markers
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="font-mono text-xs text-foreground/80 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

export function IntegrationWizard() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o Assistente de Integração do NexOS.\n\nPosso te guiar passo a passo na configuração de qualquer plataforma — WhatsApp Business, Meta Ads, TikTok Ads, Instagram, RD Station, e mais.\n\nSe uma integração estiver bloqueada ou em aprovação, te mostro a alternativa para você não perder o lançamento.\n\n**Mande uma mensagem ou cole um print** da tela onde você está.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string; mediaType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, open]);

  const handleImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPendingImage({ base64, preview: base64, mediaType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) handleImage(file);
      }
    }
  }, [handleImage]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    if (loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "Analise este screenshot.",
      imagePreview: pendingImage?.preview,
    };

    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const img = pendingImage;
    setPendingImage(null);
    setLoading(true);

    try {
      const data = await customFetch<{ reply: string }>("/api/integration-wizard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "Analise este screenshot.",
          imageBase64: img?.base64,
          imageMediaType: img?.mediaType,
          history,
        }),
      });

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Não consegui processar sua mensagem agora. Tente novamente em instantes.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, pendingImage, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const QUICK_ACTIONS = [
    "Como configuro o WhatsApp Business?",
    "Meta Ads em análise — o que fazer?",
    "TikTok Ads bloqueado — tenho alternativa?",
    "Como conectar o Instagram?",
    "Configurar Telegram em 5 min",
  ];

  return (
    <div className="border border-primary/20 bg-primary/3">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
              Assistente de Integração
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              agente com visão · Guia passo a passo · Cole prints de qualquer tela
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">Online</span>
          </div>
        </div>
        <div className="text-muted-foreground/40">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/30">
          {/* Chat messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4 bg-background/40">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-6 w-6 border flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "assistant"
                    ? "border-primary/30 bg-primary/10"
                    : "border-muted-foreground/20 bg-muted/30"
                }`}>
                  {msg.role === "assistant"
                    ? <Bot className="h-3 w-3 text-primary" />
                    : <User className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className={`flex-1 min-w-0 space-y-1.5 ${msg.role === "user" ? "items-end" : ""}`}>
                  {msg.imagePreview && (
                    <div className={`${msg.role === "user" ? "flex justify-end" : ""}`}>
                      <img
                        src={msg.imagePreview}
                        alt="Screenshot enviado"
                        className="max-w-xs max-h-40 rounded border border-border/50 object-contain bg-muted"
                      />
                    </div>
                  )}
                  <div className={`max-w-xl rounded border p-3 space-y-0.5 ${
                    msg.role === "assistant"
                      ? "border-border/30 bg-card/60 ml-0"
                      : "border-primary/20 bg-primary/5 ml-auto"
                  }`}>
                    {msg.role === "assistant"
                      ? <ol className="space-y-0.5">{formatReply(msg.content)}</ol>
                      : <p className="font-mono text-xs text-foreground/80">{msg.content}</p>}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="h-6 w-6 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="border border-border/30 bg-card/60 rounded p-3 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  <span className="font-mono text-xs text-muted-foreground/50">Analisando…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap border-b border-border/20">
              {QUICK_ACTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="font-mono text-[9px] uppercase tracking-widest border border-border/40 bg-muted/20 hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground px-2 py-1 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Image preview */}
          {pendingImage && (
            <div className="px-4 py-2 border-b border-border/20 flex items-center gap-2">
              <img src={pendingImage.preview} alt="Preview" className="h-10 w-10 object-cover border border-border/40 rounded" />
              <p className="font-mono text-[10px] text-muted-foreground/60 flex-1">Print pronto para enviar</p>
              <button onClick={() => setPendingImage(null)} className="text-muted-foreground/40 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 flex items-end gap-2 bg-card/30">
            <input
              ref={fileInputRef as React.RefObject<HTMLInputElement>}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Anexar screenshot"
              className="h-8 w-8 border border-border/40 bg-muted/20 hover:bg-muted/40 flex items-center justify-center transition-colors shrink-0"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Descreva onde está ou cole um print (Ctrl+V)…"
                rows={1}
                className="w-full bg-muted/30 border border-border/40 rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed"
                style={{ minHeight: "36px", maxHeight: "120px" }}
              />
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                <ImagePlus className="h-2.5 w-2.5 text-muted-foreground/20" />
                <span className="font-mono text-[8px] text-muted-foreground/20">Ctrl+V print</span>
              </div>
            </div>

            <button
              onClick={() => void send()}
              disabled={loading || (!input.trim() && !pendingImage)}
              className="h-8 w-8 bg-primary hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all shrink-0"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                : <Send className="h-3.5 w-3.5 text-white" />}
            </button>
          </div>

          <div className="px-4 py-1.5 border-t border-border/20 flex items-center gap-1.5">
            <Sparkles className="h-2.5 w-2.5 text-primary/40" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">
              Claude Vision — analisa prints em tempo real
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
