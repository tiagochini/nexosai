import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import {
  MessageSquare, Plus, Bot, Zap, ChevronRight, Users, TrendingUp,
  CheckCircle2, Phone, Send, RefreshCw, AlertTriangle, ArrowLeft,
  Flame, Sparkles, Target, Edit3, Trash2, X, Filter,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

const API = "/api/sales-team";

const STAGE_LABEL: Record<string, string> = {
  warming: "Aquecimento",
  desire: "Desejo",
  scarcity: "Escassez",
  objection: "Objeção",
  post_sale: "Pós-venda",
};
const STAGE_COLOR: Record<string, string> = {
  warming:  "text-blue-400 border-blue-400/30 bg-blue-400/8",
  desire:   "text-amber-400 border-amber-400/30 bg-amber-400/8",
  scarcity: "text-red-400 border-red-400/30 bg-red-400/8",
  objection:"text-violet-400 border-violet-400/30 bg-violet-400/8",
  post_sale:"text-green-400 border-green-400/30 bg-green-400/8",
};
const STATUS_COLOR: Record<string, string> = {
  active:    "text-primary border-primary/30",
  converted: "text-green-400 border-green-400/30",
  lost:      "text-destructive border-destructive/30",
  paused:    "text-muted-foreground border-border",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", converted: "Convertido", lost: "Perdido", paused: "Pausado",
};
const CHANNEL_ICON: Record<string, string> = {
  whatsapp: "📱", telegram: "✈️", facebook: "📘", instagram: "📸", landing: "🌐", manual: "📝",
};
const AGENT_NAME: Record<string, string> = {
  sales_warmer: "Marco • Aquecimento",
  sales_desire: "Renata • Desejo",
  sales_closer: "Vitor • Fechamento",
  sales_objection: "Clara • Objeções",
  sales_consultant: "Alex • Consultor",
};
const AGENT_COPY: Record<string, [string, string]> = {
  sales_warmer: ["Marco • Warm-up", "Marco • Calentamiento"],
  sales_desire: ["Renata • Desire", "Renata • Deseo"],
  sales_closer: ["Vitor • Closing", "Vitor • Cierre"],
  sales_objection: ["Clara • Objections", "Clara • Objeciones"],
  sales_consultant: ["Alex • Consultant", "Alex • Consultor"],
};
const STAGE_COPY: Record<string, [string, string]> = {
  warming: ["Warm-up", "Calentamiento"],
  desire: ["Desire", "Deseo"],
  scarcity: ["Scarcity", "Escasez"],
  objection: ["Objection", "Objeción"],
  post_sale: ["Post-sale", "Posventa"],
};
const STATUS_COPY: Record<string, [string, string]> = {
  active: ["Active", "Activo"], converted: ["Converted", "Convertido"],
  lost: ["Lost", "Perdido"], paused: ["Paused", "En pausa"],
};
function stageLabel(stage: string, t: ReturnType<typeof useUiText>) {
  const enEs = STAGE_COPY[stage];
  return enEs ? t(STAGE_LABEL[stage]!, enEs[0], enEs[1]) : stage;
}
function statusLabel(status: string, t: ReturnType<typeof useUiText>) {
  const enEs = STATUS_COPY[status];
  return enEs ? t(STATUS_LABEL[status]!, enEs[0], enEs[1]) : status;
}
function agentName(agent: string, t: ReturnType<typeof useUiText>) {
  const localized = AGENT_COPY[agent];
  return localized ? t(AGENT_NAME[agent]!, localized[0], localized[1]) : agent;
}

interface SalesConv {
  id: string; contactName: string; contactHandle: string; channel: string;
  funnelStage: string; status: string; assignedAgent: string; notes: string;
  messageCount: number; createdAt: string; updatedAt: string;
}
interface SalesMsg {
  id: string; conversationId: string; role: "contact" | "agent" | "note";
  content: string; agentRole?: string; isAiGenerated: boolean; createdAt: string;
}
interface Analytics {
  total: number; active: number; converted: number; lost: number;
  conversionRate: number; todayConversions: number; weekConversions: number;
  byStage: Record<string, number>; byChannel: Record<string, number>;
}

export default function AtendimentoPage() {
  const t = useUiText();
  const { token } = useAuth();
  const [conversations, setConversations] = useState<SalesConv[]>([]);
  const [selectedConv, setSelectedConv] = useState<(SalesConv & { messages: SalesMsg[] }) | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newChannel, setNewChannel] = useState("whatsapp");
  const [newStage, setNewStage] = useState("warming");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  async function apiFetch(url: string, opts?: RequestInit) {
    const data = await customFetch<unknown>(url, opts);
    return { ok: true as const, json: <T = unknown>() => Promise.resolve(data as T) };
  }

  async function loadAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (roleFilter !== "all") params.set("funnelStage", roleFilter);
      const [convRes, anaRes] = await Promise.all([
        apiFetch(`${API}?${params}`),
        apiFetch(`${API}/analytics`),
      ]);
      const convData = await convRes.json() as { conversations: SalesConv[] };
      const anaData = await anaRes.json() as { analytics: Analytics };
      setConversations(convData.conversations ?? []);
      setAnalytics(anaData.analytics ?? null);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function loadConversation(id: string) {
    setConvLoading(true);
    setSuggestion(null);
    try {
      const res = await apiFetch(`${API}/${id}`);
      const data = await res.json() as { conversation: SalesConv & { messages: SalesMsg[] } };
      setSelectedConv(data.conversation ?? null);
    } catch { /* ignore */ } finally {
      setConvLoading(false);
    }
  }

  async function sendMessage(role: "agent" | "contact" | "note", content: string) {
    if (!selectedConv || !content.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch(`${API}/${selectedConv.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role, content: content.trim() }),
      });
      const data = await res.json() as { message: SalesMsg };
      if (data.message) {
        setSelectedConv(prev => prev ? { ...prev, messages: [...prev.messages, data.message] } : prev);
        setMsgInput("");
        setSuggestion(null);
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }

  async function getSuggestion() {
    if (!selectedConv) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await apiFetch(`${API}/${selectedConv.id}/suggest`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json() as { suggestion: string };
      setSuggestion(data.suggestion ?? null);
    } catch { /* ignore */ } finally {
      setSuggesting(false);
    }
  }

  async function updateStage(stage: string) {
    if (!selectedConv) return;
    try {
      await apiFetch(`${API}/${selectedConv.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ funnelStage: stage }),
      });
      setSelectedConv(prev => prev ? { ...prev, funnelStage: stage } : prev);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, funnelStage: stage } : c));
    } catch { /* ignore */ }
  }

  async function updateStatus(status: string) {
    if (!selectedConv) return;
    try {
      await apiFetch(`${API}/${selectedConv.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      setSelectedConv(prev => prev ? { ...prev, status } : prev);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, status } : c));
      if (status !== "active") { setSelectedConv(null); loadAll(); }
    } catch { /* ignore */ }
  }

  async function deleteConv(id: string) {
    if (!confirm(t("Excluir esta conversa?", "Delete this conversation?", "¿Eliminar esta conversación?"))) return;
    await apiFetch(`${API}/${id}`, { method: "DELETE", headers: authHeaders() });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedConv?.id === id) setSelectedConv(null);
  }

  async function createConv() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch(`${API}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          contactName: newName.trim(),
          contactHandle: newHandle.trim() || undefined,
          channel: newChannel,
          funnelStage: newStage,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json() as { conversation: SalesConv };
      if (data.conversation) {
        setConversations(prev => [{ ...data.conversation, messageCount: 0 }, ...prev]);
        setShowNew(false);
        setNewName(""); setNewHandle(""); setNewNotes("");
        loadConversation(data.conversation.id);
        loadAll();
      }
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  }

  useEffect(() => { loadAll(); }, [statusFilter, roleFilter]);
  useEffect(() => {
    if (selectedConv && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConv?.messages?.length]);

  const kpis = [
    { label: t("Ativos", "Active", "Activos"), value: analytics?.active ?? 0, color: "text-primary" },
    { label: t("Convertidos hoje", "Converted today", "Convertidos hoy"), value: analytics?.todayConversions ?? 0, color: "text-green-400" },
    { label: t("Taxa de conversão", "Conversion rate", "Tasa de conversión"), value: `${analytics?.conversionRate ?? 0}%`, color: "text-amber-400" },
    { label: t("Total semana", "Total this week", "Total de la semana"), value: analytics?.weekConversions ?? 0, color: "text-cyan-400" },
  ];

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col max-w-full">
      {/* Header */}
      <div className="border-b border-border/50 pb-4 mb-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-primary" />
              <h1 className="text-xl md:text-2xl font-mono uppercase tracking-tighter font-bold">
                {t("Time de vendas", "Sales team", "Equipo de ventas")}
              </h1>
              <Badge className="rounded-none font-mono text-[10px] bg-primary/15 text-primary border border-primary/30">
                {t("Agente", "Agent", "Agente")}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {t("Atendimento contextual por etapa do funil · PLF + Dale Carnegie + Daniel Godri", "Contextual sales support at every funnel stage · PLF + Dale Carnegie + Daniel Godri", "Atención contextual en cada etapa del embudo · PLF + Dale Carnegie + Daniel Godri")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} className="rounded-none font-mono text-xs gap-1.5 h-8">
              <RefreshCw className="h-3 w-3" /> {t("Atualizar", "Refresh", "Actualizar")}
            </Button>
            <Button size="sm" className="rounded-none font-mono text-xs gap-1.5 h-8 btn-weapon-primary" onClick={() => setShowNew(true)}>
              <Plus className="h-3 w-3" /> {t("Nova conversa", "New conversation", "Nueva conversación")}
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <FeatureOnboarding
            featureKey={FEATURE_KEYS.ATENDIMENTO}
            title={t("TIME DE VENDAS", "SALES TEAM", "EQUIPO DE VENTAS")}
            description={t("Cada lead na conversa certa, com o agente certo. O agente sugere a resposta ideal de acordo com o estágio do funil.", "Every lead in the right conversation with the right agent. The agent suggests the ideal reply for each funnel stage.", "Cada lead en la conversación adecuada con el agente indicado. El agente sugiere la respuesta ideal según la etapa del embudo.")}
            variant="inline"
            steps={[
              t("Crie uma conversa por lead e classifique o estágio (Aquecimento, Desejo, Fechamento…)", "Create a conversation for each lead and classify their stage (warm-up, desire, closing…)", "Crea una conversación por lead y clasifica su etapa (calentamiento, deseo, cierre…)."),
              t("Clique em 'Sugestão do agente' — o especialista gera a resposta ideal", "Click 'Agent suggestion' — the specialist generates an ideal reply", "Haz clic en 'Sugerencia del agente': el especialista generará una respuesta ideal."),
              t("Mova o lead pelo funil conforme avança na conversa", "Move the lead through the funnel as the conversation progresses", "Avanza el lead por el embudo a medida que progresa la conversación."),
              t("Monitore a taxa de conversão por estágio no painel de KPIs", "Monitor the conversion rate by stage in the KPI dashboard", "Supervisa la tasa de conversión por etapa en el panel de KPI."),
            ]}
          />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {kpis.map((k, i) => (
            <div key={i} className="border border-border/30 bg-card/30 px-3 py-2 flex items-center gap-3">
              <div>
                <div className={`font-mono font-black text-lg leading-none ${k.color}`}>{k.value}</div>
                <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-0.5">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* ── Conversation list ── */}
        <div className={`flex flex-col ${selectedConv ? "hidden md:flex md:w-80" : "w-full md:w-80"} flex-shrink-0 overflow-hidden`}>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-3 flex-wrap flex-shrink-0">
            <select
              className="rounded-none border border-border/50 bg-card/50 text-xs font-mono px-2 py-1 text-foreground focus:outline-none focus:border-primary/60"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">{t("Todos", "All", "Todos")}</option>
              <option value="active">{t("Ativos", "Active", "Activos")}</option>
              <option value="converted">{t("Convertidos", "Converted", "Convertidos")}</option>
              <option value="lost">{t("Perdidos", "Lost", "Perdidos")}</option>
              <option value="paused">{t("Pausados", "Paused", "En pausa")}</option>
            </select>
            <select
              className="rounded-none border border-border/50 bg-card/50 text-xs font-mono px-2 py-1 text-foreground focus:outline-none focus:border-primary/60"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">{t("Todas as etapas", "All stages", "Todas las etapas")}</option>
              {Object.entries(STAGE_LABEL).map(([stage]) => <option key={stage} value={stage}>{stageLabel(stage, t)}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loading ? (
              <div className="text-center py-10 font-mono text-xs text-muted-foreground/50">{t("Carregando...", "Loading...", "Cargando...")}</div>
            ) : conversations.length === 0 ? (
              <div className="border border-border/30 bg-card/20 p-6 text-center">
                <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/50">{t("Nenhuma conversa encontrada.", "No conversations found.", "No se encontraron conversaciones.")}</p>
                <Button size="sm" className="mt-3 rounded-none font-mono text-xs h-7" onClick={() => setShowNew(true)}>
                  <Plus className="h-3 w-3 mr-1" /> {t("Iniciar atendimento", "Start a conversation", "Iniciar atención")}
                </Button>
              </div>
            ) : conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`border bg-card/40 p-3 cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5 group ${selectedConv?.id === conv.id ? "border-primary/60 bg-primary/8" : "border-border/30"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">{CHANNEL_ICON[conv.channel] ?? "💬"}</span>
                    <span className="font-mono font-bold text-xs text-foreground truncate">{conv.contactName}</span>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-1 shrink-0 ${STAGE_COLOR[conv.funnelStage]}`}>
                    {stageLabel(conv.funnelStage, t)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[10px] border rounded-none px-1 ${STATUS_COLOR[conv.status]}`}>
                    {statusLabel(conv.status, t)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {conv.messageCount} {t("mensagens", "messages", "mensajes")}
                  </span>
                </div>
                {conv.notes && (
                  <p className="font-mono text-[10px] text-muted-foreground/50 mt-1 truncate">{conv.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Conversation detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center border border-border/20 bg-card/10">
              <div className="text-center max-w-xs">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-mono text-sm font-bold text-foreground mb-1">{t("Selecione uma conversa", "Select a conversation", "Selecciona una conversación")}</p>
                <p className="font-mono text-xs text-muted-foreground/50 mb-4">
                  {t("O especialista vai gerar a mensagem ideal para cada etapa do funil.", "The specialist will generate the ideal message for each funnel stage.", "El especialista generará el mensaje ideal para cada etapa del embudo.")}
                </p>
                <Button onClick={() => setShowNew(true)} className="rounded-none font-mono text-xs gap-1.5">
                  <Plus className="h-3 w-3" /> {t("Nova conversa", "New conversation", "Nueva conversación")}
                </Button>
              </div>
            </div>
          ) : convLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="font-mono text-xs text-muted-foreground/50">{t("Carregando conversa...", "Loading conversation...", "Cargando conversación...")}</div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="border border-border/30 bg-card/40 p-3 mb-3 flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button className="md:hidden" onClick={() => setSelectedConv(null)}>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-foreground">{selectedConv.contactName}</span>
                      {selectedConv.contactHandle && (
                        <span className="font-mono text-xs text-muted-foreground/60">{selectedConv.contactHandle}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground/50">
                        {CHANNEL_ICON[selectedConv.channel]} {selectedConv.channel}
                      </span>
                      <span className="font-mono text-[10px] text-primary/70">
                        {t("Agente:", "Agent:", "Agente:")} {agentName(selectedConv.assignedAgent, t)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
                  {/* Stage selector */}
                  <select
                    className="rounded-none border border-border/50 bg-card/50 text-[10px] font-mono px-1.5 py-1 text-foreground focus:outline-none focus:border-primary/60"
                    value={selectedConv.funnelStage}
                    onChange={e => updateStage(e.target.value)}
                  >
                    {Object.keys(STAGE_LABEL).map(v => <option key={v} value={v}>{stageLabel(v, t)}</option>)}
                  </select>
                  {/* Status selector */}
                  <select
                    className="rounded-none border border-border/50 bg-card/50 text-[10px] font-mono px-1.5 py-1 text-foreground focus:outline-none focus:border-primary/60"
                    value={selectedConv.status}
                    onChange={e => updateStatus(e.target.value)}
                  >
                    {Object.keys(STATUS_LABEL).map(v => <option key={v} value={v}>{statusLabel(v, t)}</option>)}
                  </select>
                  <button onClick={() => deleteConv(selectedConv.id)} aria-label={t("Excluir conversa", "Delete conversation", "Eliminar conversación")} title={t("Excluir conversa", "Delete conversation", "Eliminar conversación")} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
                {selectedConv.messages.length === 0 && (
                  <div className="border border-dashed border-border/30 p-6 text-center">
                    <Bot className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="font-mono text-xs text-muted-foreground/50 mb-3">
                      {t('Nenhuma mensagem ainda. Use o botão "Sugerir" para o agente gerar a abordagem ideal para a etapa de ', 'No messages yet. Use the "Suggest" button to have the agent generate an ideal approach for the ', 'Aún no hay mensajes. Usa el botón "Sugerir" para que el agente genere el enfoque ideal para la etapa de ')}<strong>{stageLabel(selectedConv.funnelStage, t)}</strong>.
                    </p>
                    <Button size="sm" onClick={getSuggestion} disabled={suggesting} className="rounded-none font-mono text-xs gap-1.5 h-7">
                      <Sparkles className="h-3 w-3" />
                      {suggesting ? t("Gerando...", "Generating...", "Generando...") : t("Sugerir abertura", "Suggest an opener", "Sugerir apertura")}
                    </Button>
                  </div>
                )}
                {selectedConv.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "contact" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] border p-2.5 ${
                      msg.role === "contact"
                        ? "border-border/30 bg-card/40 rounded-br-none"
                        : msg.role === "note"
                        ? "border-amber-400/20 bg-amber-400/5 w-full max-w-full"
                        : msg.isAiGenerated
                        ? "border-primary/30 bg-primary/8 rounded-bl-none"
                        : "border-primary/20 bg-primary/5 rounded-bl-none"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                          {msg.role === "contact" ? selectedConv.contactName : msg.role === "note" ? `📌 ${t("Nota", "Note", "Nota")}` : t("Atendente", "Support agent", "Agente de atención")}
                          {msg.isAiGenerated && <span className="text-primary ml-1">· {t("IA", "AI", "IA")}</span>}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* AI suggestion panel */}
              {suggestion && (
                <div className="border border-primary/30 bg-primary/5 p-3 mb-2 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                         {t("Sugestão do agente", "Agent suggestion", "Sugerencia del agente")} · {agentName(selectedConv.assignedAgent, t)}
                      </span>
                    </div>
                    <button onClick={() => setSuggestion(null)} aria-label={t("Fechar sugestão", "Close suggestion", "Cerrar sugerencia")} className="text-muted-foreground/50 hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="font-mono text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap mb-2">{suggestion}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-none font-mono text-[10px] h-7 gap-1" onClick={() => { setMsgInput(suggestion); setSuggestion(null); }}>
                      <Edit3 className="h-3 w-3" /> {t("Editar antes de enviar", "Edit before sending", "Editar antes de enviar")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 gap-1" onClick={() => sendMessage("agent", suggestion)}>
                      <Send className="h-3 w-3" /> {t("Usar direto", "Use as-is", "Usar directamente")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Input area */}
              <div className="border border-border/30 bg-card/30 p-3 flex-shrink-0">
                <div className="flex gap-2 mb-2">
                  <textarea
                    className="flex-1 rounded-none border border-border/50 bg-card/50 text-xs font-mono px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 resize-none"
                    rows={2}
                    aria-label={t("Mensagem do atendente", "Support message", "Mensaje del agente de atención")}
                    placeholder={t("Escreva a mensagem do atendente...", "Write a support message...", "Escribe el mensaje de atención...")}
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage("agent", msgInput); }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={getSuggestion} disabled={suggesting}
                    >
                      <Sparkles className="h-3 w-3" />
                      {suggesting ? t("Gerando...", "Generating...", "Generando...") : `${t("Sugerir", "Suggest", "Sugerir")} · ${stageLabel(selectedConv.funnelStage, t)}`}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 gap-1"
                      onClick={() => {
                        const msg = prompt(t("Mensagem recebida do lead:", "Message received from the lead:", "Mensaje recibido del lead:"));
                        if (msg) sendMessage("contact", msg);
                      }}
                    >
                      {t("Registrar resposta do lead", "Log lead reply", "Registrar respuesta del lead")}
                    </Button>
                  </div>
                  <Button size="sm" className="rounded-none font-mono text-[10px] h-7 gap-1" onClick={() => sendMessage("agent", msgInput)} disabled={sending || !msgInput.trim()}>
                    <Send className="h-3 w-3" /> {t("Enviar", "Send", "Enviar")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New conversation modal ── */}
      {showNew && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-border/50 bg-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono font-bold text-sm uppercase tracking-widest">{t("Nova conversa", "New conversation", "Nueva conversación")}</h2>
              <button onClick={() => setShowNew(false)} aria-label={t("Fechar", "Close", "Cerrar")}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">{t("Nome do lead *", "Lead name *", "Nombre del lead *")}</label>
                <input className="w-full rounded-none border border-border/50 bg-card/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60"
                  placeholder={t("Ex.: João Silva", "e.g. Jane Smith", "Ej.: Ana García")} value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">{t("Contato (identificador/número)", "Contact (handle/number)", "Contacto (usuario/número)")}</label>
                <input className="w-full rounded-none border border-border/50 bg-card/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60"
                  placeholder={t("@usuario ou +55...", "@handle or +1...", "@usuario o +52...")} value={newHandle} onChange={e => setNewHandle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">{t("Canal", "Channel", "Canal")}</label>
                  <select className="w-full rounded-none border border-border/50 bg-card/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60"
                    value={newChannel} onChange={e => setNewChannel(e.target.value)}>
                    <option value="whatsapp">📱 WhatsApp</option>
                    <option value="telegram">✈️ Telegram</option>
                    <option value="instagram">📸 Instagram</option>
                    <option value="facebook">📘 Facebook</option>
                    <option value="landing">🌐 {t("Página de destino", "Landing page", "Página de destino")}</option>
                    <option value="manual">📝 {t("Manual", "Manual", "Manual")}</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">{t("Etapa do funil", "Funnel stage", "Etapa del embudo")}</label>
                  <select className="w-full rounded-none border border-border/50 bg-card/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60"
                    value={newStage} onChange={e => setNewStage(e.target.value)}>
                    {Object.keys(STAGE_LABEL).map(v => <option key={v} value={v}>{stageLabel(v, t)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">{t("Notas sobre o lead", "Lead notes", "Notas sobre el lead")}</label>
                <textarea className="w-full rounded-none border border-border/50 bg-card/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 resize-none"
                  rows={2} placeholder={t("Contexto, produto, objeções conhecidas...", "Context, product, known objections...", "Contexto, producto, objeciones conocidas...")}
                  value={newNotes} onChange={e => setNewNotes(e.target.value)} />
              </div>
              <Button className="w-full rounded-none font-mono text-xs h-10 gap-2 btn-weapon-primary mt-2"
                onClick={createConv} disabled={creating || !newName.trim()}>
                <Plus className="h-3.5 w-3.5" />
                {creating ? t("Criando...", "Creating...", "Creando...") : t("Iniciar atendimento", "Start conversation", "Iniciar atención")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
