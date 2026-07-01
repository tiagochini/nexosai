import { useEffect, useRef, useState } from "react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Sparkles, Send, Paperclip, X, Loader2, ImageIcon, AlertTriangle, Copy, LogOut, MessageCircleQuestion,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
}

interface Conversation {
  id: string;
  status: "active" | "ended";
}

interface PendingImage {
  name: string;
  dataUrl: string;
}

interface DetectedCredentials {
  accessToken?: string;
  accountId?: string;
  accountName?: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10_000_000;

function parseCredentialsBlock(text: string): { clean: string; detected: DetectedCredentials | null } {
  const match = text.match(/CREDENCIAIS_DETECTADAS([\s\S]*?)(?:```|$)/);
  if (!match) return { clean: text, detected: null };

  const block = match[1] ?? "";
  const detected: DetectedCredentials = {};
  const accessToken = block.match(/accessToken:\s*(.+)/i)?.[1]?.trim();
  const accountId = block.match(/accountId:\s*(.+)/i)?.[1]?.trim();
  const accountName = block.match(/accountName:\s*(.+)/i)?.[1]?.trim();
  if (accessToken) detected.accessToken = accessToken;
  if (accountId) detected.accountId = accountId;
  if (accountName) detected.accountName = accountName;

  const clean = text.slice(0, match.index).trim();
  return { clean, detected: Object.keys(detected).length > 0 ? detected : null };
}

function copyValue(label: string, value: string) {
  navigator.clipboard?.writeText(value).then(() => {
    toast.success(`${label} copiado!`);
  }).catch(() => toast.error("Não consegui copiar. Selecione o texto manualmente."));
}

export function IntegrationChatPanel() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const loadActiveConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch<{ conversation: Conversation; messages: ChatMessage[] }>(
        "/api/integration-chat/active",
      );
      setConversation(res.conversation);
      setMessages(res.messages);
    } catch {
      setError("Não consegui carregar o assistente agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!loaded) loadActiveConversation();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - pendingImages.length;
    const toRead = Array.from(files).filter(f => f.type.startsWith("image/") && f.size <= MAX_IMAGE_BYTES).slice(0, remaining);
    toRead.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string | undefined;
        if (dataUrl) setPendingImages(prev => [...prev, { name: file.name, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || sending || !conversation) return;

    const imagesSnapshot = pendingImages;
    setPendingImages([]);
    setInput("");
    setError(null);
    setSending(true);

    const optimisticUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text || "(enviei um print para você analisar)",
      imageUrl: imagesSnapshot[0]?.dataUrl,
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const res = await customFetch<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>(
        `/api/integration-chat/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            ...(imagesSnapshot.length > 0 ? { images: imagesSnapshot.map(i => i.dataUrl) } : {}),
          }),
        },
      );
      setMessages(prev => {
        const withoutOptimistic = prev.filter(m => m.id !== optimisticUser.id);
        return [...withoutOptimistic, res.userMessage, res.assistantMessage];
      });
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimisticUser.id));
      if (err instanceof ApiError && err.status === 402) {
        setError("Créditos insuficientes para continuar a conversa. Adicione créditos para seguir recebendo ajuda.");
      } else if (err instanceof ApiError) {
        setError((err.data as { error?: string } | null)?.error ?? "Não consegui responder agora. Tente de novo em instantes.");
      } else {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (!conversation) return;
    setEnding(true);
    try {
      await customFetch(`/api/integration-chat/${conversation.id}/end`, { method: "POST" });
      setConversation(null);
      setMessages([]);
      setLoaded(false);
      toast.success("Conversa encerrada.");
    } catch {
      toast.error("Não consegui encerrar a conversa agora.");
    } finally {
      setEnding(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-[500] flex items-center gap-2 btn-weapon-primary rounded-full px-4 py-3 shadow-lg shadow-primary/20 font-mono text-[11px] uppercase tracking-widest"
      >
        <MessageCircleQuestion className="h-4 w-4" />
        Ajuda para conectar
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[500] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-4rem)] bg-background border border-border/60 shadow-2xl flex flex-col">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
            Especialista em Integrações
          </span>
        </div>
        <div className="flex items-center gap-3">
          {conversation && (
            <button
              onClick={handleEndConversation}
              disabled={ending}
              title="Encerrar conversa"
              className="font-mono text-[9px] text-muted-foreground/50 hover:text-destructive uppercase tracking-widest flex items-center gap-1"
            >
              {ending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <LogOut className="h-2.5 w-2.5" />}
              Encerrar
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar chat de integrações"
            title="Fechar"
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((m) => {
            const { clean, detected } = m.role === "assistant" ? parseCredentialsBlock(m.content) : { clean: m.content, detected: null };
            return (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[88%] space-y-2">
                  <div
                    className={`px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary/15 text-foreground border border-primary/20"
                        : "bg-muted/20 text-foreground/85 border border-border/30"
                    }`}
                  >
                    {clean}
                  </div>
                  {m.imageUrl && (
                    <div className="flex justify-end">
                      <img src={m.imageUrl} alt="print enviado" className="h-14 w-14 object-cover border border-border/40" />
                    </div>
                  )}
                  {detected && (
                    <div className="border border-primary/30 bg-primary/5 p-2 space-y-1">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-primary/80">Credenciais detectadas</p>
                      {Object.entries(detected).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => copyValue(key, value as string)}
                          className="w-full flex items-center justify-between gap-2 font-mono text-[10px] text-foreground/80 hover:text-primary border border-border/30 px-2 py-1"
                        >
                          <span className="truncate">{key}: {value as string}</span>
                          <Copy className="h-2.5 w-2.5 shrink-0" />
                        </button>
                      ))}
                      <p className="font-mono text-[9px] text-muted-foreground/50">Copie e cole no formulário da integração correspondente.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex justify-start">
              <div className="px-3 py-2 bg-muted/20 border border-border/30 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="font-mono text-[11px] text-muted-foreground/60">Digitando…</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 border-t border-yellow-400/25 bg-yellow-400/8 flex items-start gap-2 shrink-0">
          <AlertTriangle className="h-3 w-3 text-yellow-400 mt-0.5 shrink-0" />
          <p className="font-mono text-[10px] text-yellow-300/90 leading-relaxed">{error}</p>
        </div>
      )}

      {pendingImages.length > 0 && (
        <div className="px-4 pt-2 flex flex-wrap gap-2 shrink-0">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.dataUrl} alt={img.name} className="h-10 w-10 object-cover border border-border/40" />
              <button
                onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-background border border-border/50 rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border/50 shrink-0 space-y-1">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingImages.length >= MAX_IMAGES || !conversation}
            title="Enviar print ou foto"
            className="border border-border/50 p-2 text-muted-foreground/60 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Digite sua resposta ou anexe um print…"
            rows={1}
            disabled={!conversation}
            className="flex-1 bg-background border border-border/50 px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-primary/50 resize-none max-h-20 disabled:opacity-50"
          />
          <Button onClick={sendMessage} disabled={sending || !conversation || (!input.trim() && pendingImages.length === 0)} className="h-[38px] px-3 btn-weapon-primary rounded-none">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/40 flex items-center gap-1">
          <ImageIcon className="h-2.5 w-2.5" /> Aceita fotos e prints de tela
        </p>
      </div>
    </div>
  );
}
