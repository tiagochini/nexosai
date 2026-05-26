import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Loader2, Send, MessageCircle, X, ChevronDown, User, Bot, ArrowRight, CheckCircle2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SequenceInfo {
  id: string;
  name: string;
  productName?: string;
  leadCaptureEnabled: boolean;
  captureTitle?: string;
  captureDescription?: string;
  ctaText?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Lead Capture Form ──────────────────────────────────────────────────────────

function LeadCaptureForm({
  sequenceId,
  sequence,
  onCaptured,
}: {
  sequenceId: string;
  sequence: SequenceInfo;
  onCaptured: (name: string, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () =>
      customFetch(`/api/lead-capture/${sequenceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined }),
      }),
    onSuccess: () => {
      setSubmitted(true);
      onCaptured(name, email);
    },
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-lg">Você está dentro!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Confirme seu e-mail e fique de olho nas próximas mensagens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutate(); }}
      className="space-y-3"
    >
      <input
        required
        type="text"
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-background/60 border border-border/60 px-4 py-3 text-sm rounded-md focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
      />
      <input
        required
        type="email"
        placeholder="Seu melhor e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-background/60 border border-border/60 px-4 py-3 text-sm rounded-md focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
      />
      <input
        type="tel"
        placeholder="WhatsApp (opcional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full bg-background/60 border border-border/60 px-4 py-3 text-sm rounded-md focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
      />
      {isError && (
        <p className="text-xs text-destructive">Algo deu errado. Tente novamente.</p>
      )}
      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md font-semibold text-sm py-3 h-auto gap-2"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {sequence.ctaText ?? "Quero participar"} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground/50">
        Sem spam. Você pode cancelar a qualquer momento.
      </p>
    </form>
  );
}

// ── Chat Widget ────────────────────────────────────────────────────────────────

function ChatWidget({
  sequenceId,
  productName,
  contactName,
}: {
  sequenceId: string;
  productName: string;
  contactName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Olá${contactName ? `, ${contactName.split(" ")[0]}` : ""}! 👋 Tem alguma dúvida sobre ${productName}? Estou aqui pra ajudar.`,
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await customFetch<{ reply: string }>(`/api/lead-capture/${sequenceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, contactName }),
      });
      return res;
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, tive um problema técnico. Tente novamente em instantes." },
      ]);
    },
  });

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    sendMessage(msg);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-5 w-5 text-primary-foreground" /> : <MessageCircle className="h-5 w-5 text-primary-foreground" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] rounded-xl border border-border/60 bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 440 }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/80 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Assistente</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{productName}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-muted/40 border border-border/40"
                }`}>
                  {msg.role === "user"
                    ? <User className="h-3 w-3 text-primary" />
                    : <Bot className="h-3 w-3 text-muted-foreground" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted/40 text-foreground rounded-tl-none"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="bg-muted/40 rounded-xl rounded-tl-none px-3 py-2">
                  <div className="flex gap-1 items-center h-5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/40 bg-card/80 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Digite sua dúvida..."
                disabled={isPending}
                className="flex-1 bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={isPending || !input.trim()}
                className="rounded-lg h-9 w-9 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LeadCapturePage() {
  const [, params] = useRoute("/c/:sequenceId");
  const sequenceId = params?.sequenceId ?? "";
  const [capturedName, setCapturedName] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  const { data, isLoading, isError } = useQuery<{ sequence: SequenceInfo }>({
    queryKey: ["public-sequence", sequenceId],
    queryFn: () => customFetch(`/api/lead-capture/${sequenceId}`),
    enabled: !!sequenceId,
    retry: 1,
  });

  if (!sequenceId || isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center p-8">
        <div>
          <p className="text-muted-foreground font-mono text-sm">Página não encontrada.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const sequence = data.sequence;

  if (!sequence.leadCaptureEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center p-8">
        <p className="text-muted-foreground font-mono text-sm">Esta página não está disponível no momento.</p>
      </div>
    );
  }

  const productName = sequence.productName ?? sequence.name;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 blur-3xl rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg mx-auto px-6 py-16 sm:py-24">

        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Lista exclusiva aberta
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-foreground">
            {sequence.captureTitle ?? productName}
          </h1>

          {sequence.captureDescription && (
            <p className="mt-4 text-muted-foreground leading-relaxed text-base">
              {sequence.captureDescription}
            </p>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
          {!captured ? (
            <>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Preencha os dados abaixo para garantir seu lugar:
              </p>
              <LeadCaptureForm
                sequenceId={sequenceId}
                sequence={sequence}
                onCaptured={(name) => {
                  setCapturedName(name);
                  setCaptured(true);
                }}
              />
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="font-bold text-lg">
                {capturedName ? `Bem-vindo, ${capturedName.split(" ")[0]}!` : "Você está dentro!"}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você receberá as próximas informações por e-mail. Fique de olho — o conteúdo exclusivo começa em breve.
              </p>
              <p className="text-xs text-primary font-semibold mt-2">
                Tem dúvidas? Use o chat ao lado →
              </p>
            </div>
          )}
        </div>

        {/* Social proof hint */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground/50">
            Seus dados estão protegidos. Política de privacidade LGPD.
          </p>
        </div>
      </div>

      {/* Chat widget — always visible once page loads */}
      <ChatWidget
        sequenceId={sequenceId}
        productName={productName}
        contactName={capturedName ?? undefined}
      />
    </div>
  );
}
