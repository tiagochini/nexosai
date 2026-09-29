import { useState, useRef, useCallback, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Bot, Send, ImagePlus, X, Loader2, User, Sparkles,
  ChevronDown, ChevronUp, Paperclip,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

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
  const t = useUiText();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("Olá! Sou o Assistente de Integração do NexOS.\n\nPosso te guiar passo a passo na configuração de qualquer plataforma — WhatsApp Business, Meta Ads, TikTok Ads, Instagram, RD Station, e mais.\n\nSe uma integração estiver bloqueada ou em aprovação, te mostro a alternativa para você não perder o lançamento.\n\n**Mande uma mensagem ou cole um print** da tela onde você está.", "Hello! I’m NexOS’s Integration Assistant.\n\nI can guide you step by step through setting up any platform — WhatsApp Business, Meta Ads, TikTok Ads, Instagram, RD Station, and more.\n\nIf an integration is blocked or awaiting approval, I’ll show you an alternative so your launch isn’t delayed.\n\n**Send a message or paste a screenshot** of the screen you’re on.", "¡Hola! Soy el Asistente de Integraciones de NexOS.\n\nPuedo guiarte paso a paso para configurar cualquier plataforma — WhatsApp Business, Meta Ads, TikTok Ads, Instagram, RD Station y más.\n\nSi una integración está bloqueada o pendiente de aprobación, te mostraré una alternativa para que no se retrase tu lanzamiento.\n\n**Envía un mensaje o pega una captura** de la pantalla en la que estás."),
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
      content: text || t("Analise este screenshot.", "Review this screenshot.", "Analiza esta captura."),
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
          message: text || t("Analise este screenshot.", "Review this screenshot.", "Analiza esta captura."),
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
        content: t("Não consegui processar sua mensagem agora. Tente novamente em instantes.", "I couldn’t process your message right now. Please try again shortly.", "No pude procesar tu mensaje ahora. Inténtalo de nuevo en un momento."),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, pendingImage, loading, messages, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const QUICK_ACTIONS = [
    t("Como configuro o WhatsApp Business?", "How do I set up WhatsApp Business?", "¿Cómo configuro WhatsApp Business?"),
    t("Meta Ads em análise — o que fazer?", "Meta Ads under review — what should I do?", "Meta Ads en revisión — ¿qué hago?"),
    t("TikTok Ads bloqueado — tenho alternativa?", "TikTok Ads blocked — is there an alternative?", "TikTok Ads bloqueado — ¿hay una alternativa?"),
    t("Como conectar o Instagram?", "How do I connect Instagram?", "¿Cómo conecto Instagram?"),
    t("Configurar Telegram em 5 min", "Set up Telegram in 5 minutes", "Configurar Telegram en 5 min"),
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
              {t("Assistente de Integração", "Integration Assistant", "Asistente de integraciones")}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              {t("agente com visão · Guia passo a passo · Cole prints de qualquer tela", "vision-enabled agent · Step-by-step guide · Paste screenshots from any screen", "agente con visión · Guía paso a paso · Pega capturas de cualquier pantalla")}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">{t("Online", "Online", "En línea")}</span>
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
                        alt={t("Screenshot enviado", "Screenshot sent", "Captura enviada")}
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
                  <span className="font-mono text-xs text-muted-foreground/50">{t("Analisando…", "Analysing…", "Analizando…")}</span>
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
              <img src={pendingImage.preview} alt={t("Pré-visualização", "Preview", "Vista previa")} className="h-10 w-10 object-cover border border-border/40 rounded" />
              <p className="font-mono text-[10px] text-muted-foreground/60 flex-1">{t("Print pronto para enviar", "Screenshot ready to send", "Captura lista para enviar")}</p>
              <button onClick={() => setPendingImage(null)} aria-label={t("Remover imagem", "Remove image", "Quitar imagen")} className="text-muted-foreground/40 hover:text-destructive">
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
              title={t("Anexar screenshot", "Attach screenshot", "Adjuntar captura")}
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
                placeholder={t("Descreva onde está ou cole um print (Ctrl+V)…", "Describe where you are or paste a screenshot (Ctrl+V)…", "Describe dónde estás o pega una captura (Ctrl+V)…")}
                rows={1}
                className="w-full bg-muted/30 border border-border/40 rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed"
                style={{ minHeight: "36px", maxHeight: "120px" }}
              />
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                <ImagePlus className="h-2.5 w-2.5 text-muted-foreground/20" />
                <span className="font-mono text-[8px] text-muted-foreground/20">{t("Ctrl+V print", "Ctrl+V screenshot", "Ctrl+V captura")}</span>
              </div>
            </div>

            <button
              onClick={() => void send()}
              aria-label={t("Enviar mensagem", "Send message", "Enviar mensaje")}
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
              {t("Claude Vision — analisa prints em tempo real", "Claude Vision — analyses screenshots in real time", "Claude Vision — analiza capturas en tiempo real")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
