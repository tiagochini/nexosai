import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetIntake,
  useSaveIntake,
  useGetIntakeScore,
  getGetIntakeQueryKey,
  getGetIntakeScoreQueryKey,
} from "@workspace/api-client-react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { globalSilentRefresh } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle2, Loader2, Send, Database,
  MessageSquare, LayoutList, ChevronRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 md:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <img src={nexosLogo} alt="AI" className="w-4 h-4 object-contain" />
        </div>
      )}
      <div className={`max-w-[88%] px-3 md:px-4 py-2.5 md:py-3 rounded-sm text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap
        ${isUser
          ? "bg-primary/20 border border-primary/30 text-foreground ml-auto"
          : "bg-card/80 border border-border/50 text-foreground"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function CampaignIntake() {
  const [, params] = useRoute("/campaigns/:id/intake");
  const campaignId = params?.id || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"chat" | "form">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [chatComplete, setChatComplete] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const aiTriggered = useRef(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useGetIntake(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetIntakeQueryKey(campaignId) },
  });

  const { data: scoreData } = useGetIntakeScore(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetIntakeScoreQueryKey(campaignId) },
  });

  const saveMutation = useSaveIntake({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
        toast.success("Dados salvos.");
      },
      onError: () => toast.error("Erro ao salvar."),
    },
  });

  // Load existing intake data + restore conversation history
  useEffect(() => {
    if (!data?.intakeData) return;
    setFormData(data.intakeData as Record<string, string>);
    const comp = data.completeness;
    setProgress(typeof comp === "number" ? comp : (comp as { progress?: number })?.progress ?? 0);

    // Restore saved conversation history from the DB
    const raw = data.intakeData as Record<string, unknown>;
    const savedHistory = raw._conversationHistory;
    if (Array.isArray(savedHistory) && savedHistory.length > 0) {
      setMessages(savedHistory as ChatMessage[]);
      aiTriggered.current = true; // history exists — don't fire auto-trigger greeting
    }
  }, [data]);

  // ── Helper: call conversation endpoint with auto-refresh on 401 ──────────────
  const callConversation = async (body: object): Promise<{
    aiMessage: string; isComplete: boolean; progress: number; intakeData: Record<string, unknown>;
  }> => {
    const doFetch = () => customFetch<{
      aiMessage: string; isComplete: boolean; progress: number; intakeData: Record<string, unknown>;
    }>(`/api/intake/${campaignId}/conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    try {
      return await doFetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const refreshed = await globalSilentRefresh();
        if (refreshed) return await doFetch(); // retry once with new token
      }
      throw err;
    }
  };

  // ── AI AUTO-TRIGGER on fresh campaign ─────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !campaignId || aiTriggered.current) return;
    aiTriggered.current = true;

    const intakeD = (data?.intakeData ?? {}) as Record<string, unknown>;
    const filledKeys = Object.keys(intakeD).filter(k => !k.startsWith("_"));

    const autoTrigger = async () => {
      setSending(true);
      try {
        const result = await callConversation({
          message: filledKeys.length > 0 ? "continuar_intake" : "iniciar_intake",
          history: [],
        });
        setMessages([{ role: "assistant", content: result.aiMessage }]);
        if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
        if (result.progress) setProgress(result.progress);
        if (result.isComplete) setChatComplete(true);
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
      } catch {
        setMessages([{
          role: "assistant",
          content: "Olá! Sou o especialista de intake do NexOS AI. Vou coletar informações sobre seu produto em conversa natural.\n\nComeça me contando: qual é o nome do seu produto e o que ele entrega para o cliente?",
        }]);
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    };

    void autoTrigger();
  }, [isLoading, campaignId, data]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    const userMsg = inputValue.trim();
    setInputValue("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setSending(true);

    try {
      const history = newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const result = await callConversation({ message: userMsg, history });

      setMessages((prev) => [...prev, { role: "assistant", content: result.aiMessage }]);
      if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
      if (result.progress != null) setProgress(result.progress);
      if (result.isComplete) setChatComplete(true);

      queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
    } catch (err) {
      const is401 = err instanceof ApiError && err.status === 401;
      if (is401) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant" as const,
            content: "⚠️ Sua sessão expirou enquanto você escrevia. A página será recarregada automaticamente para reconectar.",
          },
        ]);
        setTimeout(() => window.location.reload(), 2500);
      } else {
        toast.error("Erro de comunicação com a IA. Tente novamente.");
      }
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Finalize intake ────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await customFetch<Response>(`/api/intake/${campaignId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao finalizar");
      }
      toast.success("Intake finalizado! A IA está montando sua estratégia.");
      setLocation(`/campaigns/${campaignId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar intake");
    } finally {
      setFinalizing(false);
    }
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Inicializando IA de Intake...</p>
        </div>
      </div>
    );
  }

  const isComplete = typeof data?.completeness === "object" && (data?.completeness as { valid?: boolean })?.valid;

  return (
    <div className="space-y-4 md:space-y-5 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-4">
        <Link href={`/campaigns/${campaignId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Retornar à Campanha
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
                Briefing Estratégico
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              A IA aprende sobre seu produto em conversa natural e extrai os dados automaticamente
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card/30 p-3 border border-border/40 min-w-[220px]">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Completude</span>
              <span className="font-mono text-xs font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 rounded-none bg-muted/30 [&>div]:bg-primary [&>div]:shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
            {scoreData && (
              <div className="flex justify-between items-center pt-1 border-t border-border/30">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Score IA</span>
                <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-success/30 text-success bg-success/10">
                  {scoreData.score} · {scoreData.label}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── View toggle ── */}
      <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm w-fit">
        {[
          { id: "chat" as const, label: "Chat com IA", icon: MessageSquare },
          { id: "form" as const, label: "Formulário", icon: LayoutList },
        ].map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-xs font-mono uppercase tracking-widest transition-all rounded-sm
              ${view === v.id ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            <v.icon className="h-3.5 w-3.5" />{v.label}
          </button>
        ))}
      </div>

      {/* ════════════════ CHAT VIEW ════════════════ */}
      {view === "chat" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 22rem)" }}>
          {/* Info bar */}
          <div className="border border-border/50 bg-card/30 px-3 py-2 flex items-center gap-2 shrink-0">
            <Database className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Dados extraídos automaticamente e salvos em tempo real · IA iniciada automaticamente
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 border-x border-border/50">
            {/* Initial loading state while AI triggers */}
            {messages.length === 0 && sending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-card/80 border border-border/50 px-4 py-3 rounded-sm">
                  <div className="flex gap-1 items-center mb-1">
                    {[0, 150, 300].map((delay) => (
                      <div key={delay} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">IA inicializando sessão de intake...</span>
                </div>
              </div>
            )}

            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

            {/* Sending indicator (after initial) */}
            {sending && messages.length > 0 && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-card/80 border border-border/50 px-4 py-3 rounded-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <div key={delay} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Completion banner */}
            {chatComplete && (
              <div className="border border-success/30 bg-success/5 p-4 rounded-sm mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono font-bold text-xs uppercase tracking-widest text-success">
                    Briefing completo! A IA tem tudo que precisa.
                  </span>
                </div>
                <Button onClick={() => void handleFinalize()} disabled={finalizing}
                  className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11">
                  {finalizing ? <><Loader2 className="h-4 w-4 animate-spin" />Finalizando...</>
                    : <><Zap className="h-4 w-4" />Finalizar e Iniciar Análise Estratégica</>}
                </Button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          {!chatComplete && (
            <div className="border border-t-0 border-border/50 p-3 shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder="Responda aqui… (Enter para enviar, Shift+Enter para nova linha)"
                  disabled={sending}
                  rows={2}
                  className="flex-1 font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-3 py-2.5 resize-none text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
                <Button onClick={() => void handleSend()} disabled={sending || !inputValue.trim()}
                  className="font-mono rounded-none h-[66px] px-4 btn-weapon-primary shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Finalize button (when intake is complete but chat didn't flag it) */}
          {isComplete && !chatComplete && (
            <div className="pt-3 border-t border-border/50 shrink-0">
              <Button onClick={() => void handleFinalize()} disabled={finalizing}
                className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11">
                {finalizing ? <><Loader2 className="h-4 w-4 animate-spin" />Finalizando...</>
                  : <><ChevronRight className="h-4 w-4" />Briefing Completo — Iniciar Estratégia</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ FORM VIEW ════════════════ */}
      {view === "form" && (
        <div className="space-y-4">
          <div className="border border-border/50 bg-card/30 px-3 py-2 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Edite campos individuais — sincronizados com o chat em tempo real
            </span>
          </div>

          <div className="border border-border/50 bg-card/40 backdrop-blur-sm p-5 md:p-6 space-y-5">
            {data?.questions?.map((q) => {
              const placeholder = (q as unknown as { placeholder?: string }).placeholder ?? "Insira os dados...";
              return (
                <div key={q.key} className="space-y-1.5 group">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2 group-focus-within:text-primary transition-colors">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30 group-focus-within:bg-primary transition-all" />
                    {q.label} {q.required && <span className="text-primary">*</span>}
                  </label>
                  {q.type === "textarea" ? (
                    <textarea value={formData[q.key] ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                      className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm min-h-[90px] p-3 resize-y text-foreground placeholder:text-muted-foreground/50 transition-all"
                      placeholder={placeholder} />
                  ) : (
                    <input value={formData[q.key] ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                      className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm h-10 px-3 text-foreground placeholder:text-muted-foreground/50 transition-all"
                      placeholder={placeholder} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <Button variant="outline"
              onClick={() => saveMutation.mutate({ campaignId, data: { intakeData: formData } })}
              disabled={saveMutation.isPending}
              className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 text-xs">
              {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
            {isComplete && (
              <Button onClick={() => void handleFinalize()} disabled={finalizing}
                className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10">
                {finalizing ? <><Loader2 className="h-4 w-4 animate-spin" />Finalizando...</>
                  : <><Zap className="h-4 w-4" />Finalizar e Iniciar Estratégia</>}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
