import { useEffect, useRef, useState } from "react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Send, Paperclip, X, Loader2, ImageIcon, CheckCircle2, AlertTriangle,
} from "lucide-react";
import type { CatalogEntry } from "@/components/integration-connect-modal";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
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

export function IntegrationAssistantChat({
  entry, onApplyCredentials, onBack,
}: {
  entry: CatalogEntry;
  onApplyCredentials: (values: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: `Oi! Sou o especialista em integrações do NexOS 👋\n\nVi que você está tentando conectar **${entry.label}**. Me conta em que passo você travou, ou me manda um print da tela que você está vendo agora — eu te guio a partir daí.`,
  }]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
    if ((!text && pendingImages.length === 0) || sending) return;

    const imagesSnapshot = pendingImages;
    setPendingImages([]);
    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      role: "user",
      content: text || "(enviei um print para você analisar)",
      images: imagesSnapshot.map(i => i.dataUrl),
    };
    const snapshotMessages = messages;
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setSending(true);

    const isFirstUserMessage = !snapshotMessages.some(m => m.role === "user");
    const contextBlock = isFirstUserMessage
      ? `[Contexto — a pessoa está tentando conectar "${entry.label}" (${entry.description}). Campos exigidos pelo NexOS: ${entry.fields.map(f => f.label).join(", ")}. Passo a passo oficial: ${entry.guide.steps.map((s, i) => `${i + 1}) ${s.title}: ${s.detail}`).join(" ")}${entry.guide.warning ? ` Aviso importante: ${entry.guide.warning}` : ""}]\n\n`
      : "";

    try {
      const res = await customFetch<{ response: string; creditsCharged: number }>(
        "/api/agents/direct-chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentRole: "integrations_specialist",
            message: contextBlock + (text || "Analise o print que enviei e me diga o próximo passo."),
            history: snapshotMessages.map(m => ({ role: m.role, content: m.content })).slice(-12),
            ...(imagesSnapshot.length > 0 ? { images: imagesSnapshot.map(i => i.dataUrl) } : {}),
          }),
        },
      );
      const { clean, detected } = parseCredentialsBlock(res.response);
      setMessages(prev => {
        const next = [...prev, { role: "assistant" as const, content: clean || res.response }];
        if (detected) (next[next.length - 1] as ChatMessage & { detected?: DetectedCredentials }).detected = detected;
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError("Créditos insuficientes para usar o especialista. Adicione créditos para continuar recebendo ajuda por aqui.");
      } else if (err instanceof ApiError) {
        setError((err.data as { error?: string } | null)?.error ?? "Não consegui responder agora. Tente de novo em instantes.");
      } else {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-5 py-2.5 border-b border-border/30 flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
            Especialista em Integrações
          </span>
        </div>
        <button onClick={onBack} className="font-mono text-[10px] text-muted-foreground/50 hover:text-foreground uppercase tracking-widest">
          ← Voltar ao formulário
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[280px] max-h-[46vh]">
        {messages.map((m, i) => {
          const detected = (m as ChatMessage & { detected?: DetectedCredentials }).detected;
          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`px-3.5 py-2.5 text-[12px] font-mono leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/20"
                      : "bg-muted/20 text-foreground/85 border border-border/30"
                  }`}
                >
                  {m.content}
                </div>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {m.images.map((src, j) => (
                      <img key={j} src={src} alt="print enviado" className="h-14 w-14 object-cover border border-border/40" />
                    ))}
                  </div>
                )}
                {detected && (
                  <button
                    onClick={() => {
                      onApplyCredentials(detected as Record<string, string>);
                      setAppliedIndex(i);
                    }}
                    className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 hover:bg-primary/15 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {appliedIndex === i ? "Preenchido no formulário!" : "Preencher formulário automaticamente"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 bg-muted/20 border border-border/30 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="font-mono text-[11px] text-muted-foreground/60">Analisando…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 py-2 border-t border-yellow-400/25 bg-yellow-400/8 flex items-start gap-2 shrink-0">
          <AlertTriangle className="h-3 w-3 text-yellow-400 mt-0.5 shrink-0" />
          <p className="font-mono text-[10px] text-yellow-300/90 leading-relaxed">{error}</p>
        </div>
      )}

      {pendingImages.length > 0 && (
        <div className="px-5 pt-2.5 flex flex-wrap gap-2 shrink-0">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.dataUrl} alt={img.name} className="h-12 w-12 object-cover border border-border/40" />
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

      <div className="px-5 py-3 border-t border-border/50 shrink-0 space-y-1.5">
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
            disabled={pendingImages.length >= MAX_IMAGES}
            title="Enviar print ou foto"
            className="border border-border/50 p-2.5 text-muted-foreground/60 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Descreva onde você travou ou anexe um print…"
            rows={1}
            className="flex-1 bg-background border border-border/50 px-3 py-2.5 text-[12px] font-mono focus:outline-none focus:border-primary/50 resize-none max-h-24"
          />
          <Button onClick={sendMessage} disabled={sending || (!input.trim() && pendingImages.length === 0)} className="h-[42px] px-3.5 btn-weapon-primary rounded-none">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/40 flex items-center gap-1">
          <ImageIcon className="h-2.5 w-2.5" /> Aceita fotos e prints de tela · vídeos ainda não são suportados, use um print do momento
        </p>
      </div>
    </div>
  );
}
