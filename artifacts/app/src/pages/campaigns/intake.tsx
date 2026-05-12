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
  Rocket, RefreshCw, Radio, TrendingUp, BarChart3,
  Users, Mail, Check, X, BarChart2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";
import { BudgetSimulator } from "@/components/budget-simulator";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConversationResult {
  aiMessage: string;
  isComplete: boolean;
  progress: number;
  intakeData: Record<string, unknown>;
  proposedType: string | null;
  proposedTrack: string | null;
  proposedReason: string | null;
}

// ── Campaign type/track label maps ─────────────────────────────────────────────
const TYPE_LABELS: Record<string, { label: string; tag: string; icon: React.ElementType; color: string }> = {
  launch:              { label: "Lançamento",      tag: "PLF / Fórmula",       icon: Rocket,     color: "text-blue-400" },
  perpetual_launch:    { label: "Perpétuo",         tag: "Evergreen",           icon: RefreshCw,  color: "text-emerald-400" },
  flash_sale:          { label: "Flash Sale",       tag: "24h a 72h",           icon: Zap,        color: "text-yellow-400" },
  live_sale:           { label: "Live Sale",        tag: "Vendas ao vivo",      icon: Radio,      color: "text-pink-400" },
  continuous_sales:    { label: "Contínuo",         tag: "Vendas diárias",      icon: TrendingUp, color: "text-cyan-400" },
  subscription_growth: { label: "Assinatura",       tag: "Clube / Membros",     icon: Mail,       color: "text-violet-400" },
  authority:           { label: "Autoridade",       tag: "Branding",            icon: BarChart3,  color: "text-orange-400" },
  audience_growth:     { label: "Crescimento",      tag: "Audiência orgânica",  icon: Users,      color: "text-teal-400" },
  affiliate:           { label: "Afiliado",         tag: "Produto de terceiros", icon: Users,     color: "text-lime-400" },
};

const TRACK_LABELS: Record<string, { label: string; range: string }> = {
  six_digits:      { label: "6 Dígitos",  range: "R$ 100k – 999k" },
  eight_digits:    { label: "8 Dígitos",  range: "R$ 10M – 99M" },
  ten_digits:      { label: "10 Dígitos", range: "R$ 100M+" },
  not_applicable:  { label: "Crescimento", range: "Sem meta de faturamento concentrado" },
};

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

// ── Type Proposal Card ─────────────────────────────────────────────────────────
function TypeProposalCard({
  proposedType,
  proposedTrack,
  proposedReason,
  onConfirm,
  onReject,
  confirming,
}: {
  proposedType: string;
  proposedTrack: string;
  proposedReason: string | null;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
}) {
  const typeInfo = TYPE_LABELS[proposedType];
  const trackInfo = TRACK_LABELS[proposedTrack];
  if (!typeInfo || !trackInfo) return null;
  const Icon = typeInfo.icon;

  return (
    <div className="border border-primary/40 bg-primary/5 p-4 rounded-sm animate-in slide-in-from-bottom-3 duration-300 relative">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/50" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/50" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary/50" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/50" />

      <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-3">
        Modelo Recomendado pela IA
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 border border-current/30 bg-current/5 flex items-center justify-center shrink-0 ${typeInfo.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className={`font-mono font-bold text-base uppercase tracking-tighter ${typeInfo.color}`}>
            {typeInfo.label}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            {typeInfo.tag}
          </div>
          <div className="font-mono text-xs text-muted-foreground/80 mt-1">
            Trilha: <span className="text-foreground font-bold">{trackInfo.label}</span>
            <span className="text-muted-foreground/50 ml-1">({trackInfo.range})</span>
          </div>
        </div>
      </div>

      {proposedReason && (
        <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed mb-4 border-t border-border/30 pt-3">
          {proposedReason}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 rounded-none font-mono uppercase tracking-widest h-10 gap-2 btn-weapon-primary text-xs"
        >
          {confirming
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Confirmando...</>
            : <><Check className="h-3.5 w-3.5" />Confirmar esse modelo</>
          }
        </Button>
        <Button
          onClick={onReject}
          disabled={confirming}
          variant="outline"
          className="rounded-none font-mono uppercase tracking-widest h-10 px-4 gap-2 text-xs border-border/50"
        >
          <X className="h-3.5 w-3.5" />Quero outro
        </Button>
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

  // Pending type proposal from AI
  const [pendingProposal, setPendingProposal] = useState<{
    type: string;
    track: string;
    reason: string | null;
  } | null>(null);
  const [confirmingType, setConfirmingType] = useState(false);

  // Budget simulator panel
  const [showSimulator, setShowSimulator] = useState(false);

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

  // Track if user is returning to an in-progress intake
  const [isReturning, setIsReturning] = useState(false);

  // Load existing intake data + restore conversation history
  useEffect(() => {
    if (!data?.intakeData) return;
    setFormData(data.intakeData as Record<string, string>);
    const comp = data.completeness;
    setProgress(typeof comp === "number" ? comp : (comp as { progress?: number })?.progress ?? 0);

    // Restore saved conversation history from the DB
    const raw = data.intakeData as Record<string, unknown>;
    const savedHistory = raw._conversationHistory;
    const filledKeys = Object.keys(raw).filter(k => !k.startsWith("_") && raw[k]);
    if (Array.isArray(savedHistory) && savedHistory.length > 0) {
      setMessages(savedHistory as ChatMessage[]);
      aiTriggered.current = true; // history exists — don't fire auto-trigger greeting
      setIsReturning(true);
    } else if (filledKeys.length > 0) {
      // Has data but no history — auto-trigger will fire continuar_intake, mark as returning
      setIsReturning(true);
    }
  }, [data]);

  // ── Helper: call conversation endpoint with auto-refresh on 401 ──────────────
  const callConversation = async (body: object): Promise<ConversationResult> => {
    const doFetch = () => customFetch<ConversationResult>(
      `/api/intake/${campaignId}/conversation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    try {
      return await doFetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const refreshed = await globalSilentRefresh();
        if (refreshed) return await doFetch();
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
        if (result.proposedType && result.proposedTrack) {
          setPendingProposal({ type: result.proposedType, track: result.proposedTrack, reason: result.proposedReason });
        }
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
      } catch {
        setMessages([{
          role: "assistant",
          content: "Olá! Sou o especialista de intake do NexOS AI. Vou entender seu produto em conversa natural e definir juntos o melhor modelo de campanha.\n\nComeça me contando: qual é o nome do seu produto e o que ele entrega para o cliente?",
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
  }, [messages, sending, pendingProposal]);

  // ── Confirm proposed type ─────────────────────────────────────────────────────
  const handleConfirmType = async () => {
    if (!pendingProposal) return;
    setConfirmingType(true);
    try {
      await customFetch(`/api/intake/${campaignId}/confirm-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pendingProposal.type, track: pendingProposal.track }),
      });
      setPendingProposal(null);
      queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });

      // Continue conversation with confirmation
      setSending(true);
      const result = await callConversation({
        message: `Confirmo o modelo: ${pendingProposal.type} na trilha ${pendingProposal.track}`,
        history: messages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.aiMessage }]);
      if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
      if (result.progress != null) setProgress(result.progress);
      if (result.isComplete) setChatComplete(true);
    } catch {
      toast.error("Erro ao confirmar modelo. Tente novamente.");
    } finally {
      setConfirmingType(false);
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  const handleRejectType = async () => {
    setPendingProposal(null);
    setSending(true);
    try {
      const result = await callConversation({
        message: "Quero considerar outras opções de modelo de campanha. Pode me explicar as alternativas que fariam sentido para o meu caso?",
        history: messages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.aiMessage }]);
      if (result.proposedType && result.proposedTrack) {
        setPendingProposal({ type: result.proposedType, track: result.proposedTrack, reason: result.proposedReason });
      }
    } catch {
      toast.error("Erro. Tente novamente.");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    const userMsg = inputValue.trim();

    // Do NOT clear input before the request succeeds. If the token is expired
    // or the network fails, the user's text must be preserved for retry.
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setSending(true);
    setPendingProposal(null);

    try {
      const history = newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const result = await callConversation({ message: userMsg, history });

      // Clear input only after confirmed success
      setInputValue("");

      setMessages((prev) => [...prev, { role: "assistant", content: result.aiMessage }]);
      if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
      if (result.progress != null) setProgress(result.progress);
      if (result.isComplete) setChatComplete(true);

      if (result.proposedType && result.proposedTrack) {
        setPendingProposal({
          type: result.proposedType,
          track: result.proposedTrack,
          reason: result.proposedReason,
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
    } catch (err) {
      // Revert optimistic user message and restore the input text.
      // The customFetch 401-retry already attempted a token refresh, so if we
      // still land here it was a genuine failure — let the user retry manually.
      setMessages(messages);
      setInputValue(userMsg);
      toast.error(
        err instanceof ApiError && err.status === 401
          ? "Sessão expirada. Tente enviar novamente — o token foi renovado automaticamente."
          : "Erro de comunicação com a IA. Sua mensagem foi preservada. Tente novamente.",
        { duration: 6000 },
      );
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Finalize intake ────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await customFetch(`/api/intake/${campaignId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Briefing finalizado! A IA está montando sua estratégia.");
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
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Inicializando Briefing IA...</p>
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
              A IA entende seu produto, define o modelo ideal e extrai os dados automaticamente
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm">
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

        {/* Budget simulator toggle — appears when budget + price detected */}
        {(() => {
          const rawData = data?.intakeData as Record<string, unknown> | undefined;
          const detectedBudget = Number(rawData?.["campaign.budget.total"] ?? rawData?.["campaign.budget"] ?? 0);
          const detectedPrice = Number(rawData?.["product.price"] ?? rawData?.["product.preco"] ?? 0);
          if (detectedBudget > 0 && detectedPrice > 0) {
            return (
              <button
                onClick={() => setShowSimulator((s) => !s)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-widest border transition-all rounded-sm
                  ${showSimulator
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Simulação de Budget
                {showSimulator ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            );
          }
          return null;
        })()}
      </div>

      {/* ── Budget Simulator Panel ── */}
      {(() => {
        const rawData = data?.intakeData as Record<string, unknown> | undefined;
        const detectedBudget = Number(rawData?.["campaign.budget.total"] ?? rawData?.["campaign.budget"] ?? 0);
        const detectedPrice = Number(rawData?.["product.price"] ?? rawData?.["product.preco"] ?? 0);
        const detectedCategory = (rawData?.["product.category"] as string | undefined) ?? "infoproduct";
        const detectedType = (data as unknown as { type?: string } | undefined)?.type ?? "launch";

        if (!showSimulator || detectedBudget <= 0 || detectedPrice <= 0) return null;

        return (
          <BudgetSimulator
            campaignId={campaignId}
            budget={detectedBudget}
            productPrice={detectedPrice}
            campaignType={detectedType}
            productCategory={detectedCategory}
          />
        );
      })()}

      {/* ════════════════ CHAT VIEW ════════════════ */}
      {view === "chat" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 22rem)" }}>
          {/* Info bar / "onde você parou" summary */}
          {isReturning && progress > 0 ? (
            <div className="border border-blue-400/30 bg-blue-400/5 px-3 py-2.5 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-blue-400 font-bold">
                    Retomando briefing · {progress}% concluído
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground/60">
                  {progress < 25 ? "Fase 1 — Produto" :
                   progress < 50 ? "Fase 2 — Audiência" :
                   progress < 70 ? "Fase 3 — Metas & Orçamento" :
                   progress < 90 ? "Fase 4 — Modelo de Campanha" :
                   "Fase 5 — Perguntas Específicas"}
                </span>
              </div>
              {(() => {
                const highlights: { label: string; value: string }[] = [];
                const fd = formData;
                if (fd["product.name"] || fd["product.nome"]) highlights.push({ label: "Produto", value: String(fd["product.name"] ?? fd["product.nome"]) });
                if (fd["product.price"] || fd["product.preco"]) highlights.push({ label: "Preço", value: `R$${Number(fd["product.price"] ?? fd["product.preco"]).toLocaleString("pt-BR")}` });
                if (fd["audience.avatar"] || fd["audience.target"]) highlights.push({ label: "Público", value: String(fd["audience.avatar"] ?? fd["audience.target"]).slice(0, 40) + (String(fd["audience.avatar"] ?? fd["audience.target"]).length > 40 ? "…" : "") });
                if (fd["campaign.budget.total"] || fd["campaign.budget"]) highlights.push({ label: "Budget", value: `R$${Number(fd["campaign.budget.total"] ?? fd["campaign.budget"]).toLocaleString("pt-BR")}` });
                if (highlights.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {highlights.map(h => (
                      <span key={h.label} className="font-mono text-[11px] text-muted-foreground">
                        <span className="text-foreground/60">{h.label}:</span> <span className="text-foreground/90 font-bold">{h.value}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="border border-border/50 bg-card/30 px-3 py-2 flex items-center gap-2 shrink-0">
              <Database className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Produto → Audiência → Metas → Modelo ideal → Perguntas específicas
              </span>
            </div>
          )}

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
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Iniciando briefing com IA...</span>
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

            {/* Type proposal card — AI recommends a model */}
            {pendingProposal && !sending && (
              <TypeProposalCard
                proposedType={pendingProposal.type}
                proposedTrack={pendingProposal.track}
                proposedReason={pendingProposal.reason}
                onConfirm={() => void handleConfirmType()}
                onReject={() => void handleRejectType()}
                confirming={confirmingType}
              />
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
                  disabled={sending || confirmingType}
                  rows={2}
                  className="flex-1 font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-3 py-2.5 resize-none text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
                <Button onClick={() => void handleSend()} disabled={sending || !inputValue.trim() || confirmingType}
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
