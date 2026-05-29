import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield, Trash2, EyeOff, MessageSquare, ThumbsUp,
  AlertTriangle, RefreshCw, Settings, ChevronLeft,
  CheckCircle2, Loader2, Filter, Instagram, Facebook,
  Zap, MessageCircle, HelpCircle, Heart, MinusCircle, Flag,
  Send, X, Bot,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentAction {
  id: string;
  platform: "instagram" | "facebook_page" | "tiktok";
  postId: string;
  commentId: string;
  authorName: string | null;
  commentText: string;
  classification: "hostile" | "spam" | "question" | "compliment" | "objection" | "neutral" | null;
  confidence: string | null;
  action: "pending" | "replied" | "deleted" | "hidden" | "liked" | "ignored" | "error";
  aiReply: string | null;
  processingError: string | null;
  overriddenAt: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface ModerationConfig {
  autoDeleteHostile: boolean;
  autoHideSpam: boolean;
  autoReplyQuestions: boolean;
  autoReplyCompliments: boolean;
  autoReplyObjections: boolean;
  replyTone: string;
  productContext: string;
  brandVoice: string;
  hostileKeywords: string[];
  verifyToken: string;
}

interface Stats {
  total: number;
  todayTotal: number;
  byAction: Record<string, number>;
  todayByAction: Record<string, number>;
  byClassification: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASSIFICATION_META: Record<string, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  hostile:   { label: "Hostil",      color: "text-destructive border-destructive/40 bg-destructive/10",    icon: AlertTriangle },
  spam:      { label: "Spam",        color: "text-orange-400 border-orange-400/40 bg-orange-400/10",       icon: MinusCircle },
  question:  { label: "Pergunta",    color: "text-blue-400 border-blue-400/40 bg-blue-400/10",             icon: HelpCircle },
  compliment:{ label: "Elogio",      color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",    icon: Heart },
  objection: { label: "Objeção",     color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",       icon: MessageCircle },
  neutral:   { label: "Neutro",      color: "text-muted-foreground border-border/50 bg-transparent",       icon: MinusCircle },
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pendente",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  replied:  { label: "Respondido", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  deleted:  { label: "Deletado",  color: "text-destructive bg-destructive/10 border-destructive/30" },
  hidden:   { label: "Oculto",    color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
  liked:    { label: "Curtido",   color: "text-pink-400 bg-pink-400/10 border-pink-400/30" },
  ignored:  { label: "Ignorado",  color: "text-muted-foreground bg-muted/10 border-border/30" },
  error:    { label: "Erro",      color: "text-destructive bg-destructive/10 border-destructive/30" },
};

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-400" />;
  if (platform === "facebook_page") return <Facebook className="h-3.5 w-3.5 text-blue-400" />;
  return <span className="font-mono text-[10px] text-muted-foreground">TT</span>;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<ModerationConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    customFetch("/api/social-moderation/config").then((d: { config: ModerationConfig }) => setConfig(d.config));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await customFetch("/api/social-moderation/config", { method: "PUT", body: JSON.stringify(config) });
      toast.success("Configurações salvas");
      onClose();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  if (!config) return <div className="p-8 text-center font-mono text-xs text-muted-foreground">Carregando...</div>;

  const toggle = (key: keyof ModerationConfig) =>
    setConfig((c) => c ? { ...c, [key]: !c[key as keyof ModerationConfig] } : c);

  const TOGGLES: Array<{ key: keyof ModerationConfig; label: string; desc: string; danger?: boolean }> = [
    { key: "autoDeleteHostile", label: "Auto-deletar comentários hostis", desc: "Detecta e remove automaticamente ataques, xingamentos e discurso de ódio", danger: true },
    { key: "autoHideSpam", label: "Auto-ocultar spam", desc: "Esconde propagandas não solicitadas, bots e links suspeitos" },
    { key: "autoReplyQuestions", label: "Auto-responder perguntas", desc: "IA responde dúvidas sobre o produto em seu nome, 24h/dia" },
    { key: "autoReplyObjections", label: "Auto-responder objeções", desc: "IA responde 'isso funciona mesmo?', 'é caro demais' com argumentos personalizados" },
    { key: "autoReplyCompliments", label: "Auto-responder elogios", desc: "IA agradece comentários positivos de forma humanizada" },
  ];

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-3">
        {TOGGLES.map(({ key, label, desc, danger }) => (
          <div key={key} className={`flex items-start gap-3 border p-3 ${danger && config[key] ? "border-destructive/30 bg-destructive/5" : "border-border/30"}`}>
            <button
              onClick={() => toggle(key)}
              className={`mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative ${config[key] ? (danger ? "bg-destructive" : "bg-primary") : "bg-muted/40"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config[key] ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <div>
              <div className="font-mono text-xs font-bold text-foreground">{label}</div>
              <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-1">Tom de resposta</label>
          <input
            className="w-full bg-transparent border border-border/40 font-mono text-xs text-foreground px-3 py-2 focus:outline-none focus:border-primary/50"
            value={config.replyTone}
            onChange={(e) => setConfig((c) => c ? { ...c, replyTone: e.target.value } : c)}
            placeholder="ex: amigável e direto, sem ser corporativo"
          />
        </div>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-1">Contexto do produto (para a equipe especializada)</label>
          <textarea
            className="w-full bg-transparent border border-border/40 font-mono text-xs text-foreground px-3 py-2 focus:outline-none focus:border-primary/50 resize-none h-16"
            value={config.productContext}
            onChange={(e) => setConfig((c) => c ? { ...c, productContext: e.target.value } : c)}
            placeholder="ex: Curso de lançamento digital para infoprodutores. Preço R$997. Resultado: R$100k em 7 dias."
          />
        </div>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-1">Palavras proibidas (deletar automaticamente)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {config.hostileKeywords.map((kw) => (
              <span key={kw} className="flex items-center gap-1 font-mono text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5">
                {kw}
                <button onClick={() => setConfig((c) => c ? { ...c, hostileKeywords: c.hostileKeywords.filter((k) => k !== kw) } : c)}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-transparent border border-border/40 font-mono text-xs px-3 py-1.5 focus:outline-none focus:border-primary/50"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="palavra + Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter" && keywordInput.trim()) {
                  setConfig((c) => c ? { ...c, hostileKeywords: [...c.hostileKeywords, keywordInput.trim().toLowerCase()] } : c);
                  setKeywordInput("");
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button onClick={save} disabled={saving} className="rounded-none font-mono uppercase tracking-widest text-xs h-9 px-5 btn-weapon-primary gap-2">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Salvar configurações
        </Button>
        <Button onClick={onClose} variant="ghost" className="rounded-none font-mono text-xs h-9 px-4">Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Reply Modal ───────────────────────────────────────────────────────────────

function ReplyModal({
  comment,
  onClose,
  onSent,
}: {
  comment: CommentAction;
  onClose: () => void;
  onSent: () => void;
}) {
  const [reply, setReply] = useState(comment.aiReply ?? "");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await customFetch(`/api/social-moderation/actions/${comment.id}/override`, {
        method: "POST",
        body: JSON.stringify({ newAction: "replied", manualReply: reply }),
      });
      toast.success("Resposta enviada");
      onSent();
      onClose();
    } catch { toast.error("Erro ao enviar resposta"); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border/40 w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
          <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Responder comentário</span>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="border border-border/20 bg-muted/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <PlatformIcon platform={comment.platform} />
              <span className="font-mono text-[11px] text-muted-foreground/60">{comment.authorName ?? "Anônimo"}</span>
            </div>
            <p className="font-mono text-sm text-foreground/80">{comment.commentText}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Bot className="h-3.5 w-3.5 text-primary/60" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Resposta</span>
            </div>
            <textarea
              className="w-full bg-transparent border border-border/40 font-mono text-sm text-foreground px-3 py-2 focus:outline-none focus:border-primary/50 resize-none h-24"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva ou edite a resposta..."
            />
            <div className="font-mono text-[10px] text-muted-foreground/40 mt-1">{reply.length} caracteres</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={send} disabled={sending || !reply.trim()} className="rounded-none font-mono uppercase tracking-widest text-xs h-9 px-5 btn-weapon-primary gap-2">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </Button>
            <Button onClick={onClose} variant="ghost" className="rounded-none font-mono text-xs h-9 px-4">Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialModerationPage() {
  const [actions, setActions] = useState<CommentAction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [filterClassification, setFilterClassification] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [replyTarget, setReplyTarget] = useState<CommentAction | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClassification) params.set("classification", filterClassification);
      if (filterAction) params.set("action", filterAction);
      if (filterPlatform) params.set("platform", filterPlatform);
      params.set("limit", "100");

      const [actionsRes, statsRes] = await Promise.all([
        customFetch(`/api/social-moderation/actions?${params}`) as Promise<{ actions: CommentAction[]; total: number }>,
        customFetch("/api/social-moderation/stats") as Promise<{ stats: Stats }>,
      ]);
      setActions(actionsRes.actions);
      setStats(statsRes.stats);
    } catch { toast.error("Erro ao carregar moderação"); }
    finally { setLoading(false); }
  }, [filterClassification, filterAction, filterPlatform]);

  useEffect(() => { load(); }, [load]);

  const override = async (comment: CommentAction, newAction: "deleted" | "hidden" | "ignored") => {
    setOverriding(comment.id);
    try {
      await customFetch(`/api/social-moderation/actions/${comment.id}/override`, {
        method: "POST",
        body: JSON.stringify({ newAction }),
      });
      toast.success(`Comentário ${newAction === "deleted" ? "deletado" : newAction === "hidden" ? "ocultado" : "ignorado"}`);
      load();
    } catch { toast.error("Erro ao executar ação"); }
    finally { setOverriding(null); }
  };

  const STATS_STRIP = [
    { label: "Deletados hoje", value: stats?.todayByAction.deleted ?? 0, color: "text-destructive" },
    { label: "Ocultos hoje", value: stats?.todayByAction.hidden ?? 0, color: "text-orange-400" },
    { label: "Respondidos hoje", value: stats?.todayByAction.replied ?? 0, color: "text-emerald-400" },
    { label: "Total processsado", value: stats?.total ?? 0, color: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background font-mono">
      {/* Header */}
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/social">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </Link>
            <Shield className="h-4 w-4 text-primary" />
            <div>
              <h1 className="font-mono font-black text-sm uppercase tracking-widest text-foreground">Moderação de Comentários</h1>
              <p className="font-mono text-[11px] text-muted-foreground/50">Bot equipe especializada responde, oculta e deleta automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={load} variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setShowConfig(!showConfig)} variant="outline" size="sm" className="rounded-none font-mono uppercase tracking-widest text-xs h-8 px-4 gap-2 border-border/40">
              <Settings className="h-3.5 w-3.5" />
              Configurar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Config Panel */}
        {showConfig && (
          <div className="border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Configurações do Bot</span>
            </div>
            <ConfigPanel onClose={() => setShowConfig(false)} />
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS_STRIP.map((s) => (
            <div key={s.label} className="border border-border/30 p-4">
              <div className={`font-mono font-black text-2xl ${s.color}`}>{s.value}</div>
              <div className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Classification breakdown */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(CLASSIFICATION_META).map(([key, meta]) => {
              const count = stats.byClassification[key] ?? 0;
              if (!count) return null;
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => setFilterClassification(filterClassification === key ? "" : key)}
                  className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] transition-all ${filterClassification === key ? meta.color : "border-border/30 text-muted-foreground/50 hover:border-border/60"}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                  <span className="font-bold">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/40" />
          {(["", "instagram", "facebook_page", "tiktok"] as const).map((p) => (
            <button
              key={p || "all"}
              onClick={() => setFilterPlatform(p)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1 border transition-all ${filterPlatform === p ? "border-primary/50 text-primary bg-primary/10" : "border-border/30 text-muted-foreground/50 hover:border-border/60"}`}
            >
              {p === "" ? "Todas" : p === "facebook_page" ? "Facebook" : p === "instagram" ? "Instagram" : "TikTok"}
            </button>
          ))}
          <div className="w-px h-4 bg-border/30" />
          {(["", "pending", "replied", "deleted", "hidden", "error"] as const).map((a) => (
            <button
              key={a || "all-actions"}
              onClick={() => setFilterAction(a)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1 border transition-all ${filterAction === a ? "border-primary/50 text-primary bg-primary/10" : "border-border/30 text-muted-foreground/50 hover:border-border/60"}`}
            >
              {a === "" ? "Todos" : ACTION_META[a]?.label ?? a}
            </button>
          ))}
        </div>

        {/* Comment Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Carregando comentários...</span>
          </div>
        ) : actions.length === 0 ? (
          <div className="border border-border/30 p-12 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground/50 uppercase tracking-widest">Nenhum comentário processado ainda</p>
            <p className="font-mono text-[11px] text-muted-foreground/30 mt-1">Configure o webhook Meta nas suas integrações para ativar o monitoramento automático</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((comment) => {
              const cls = CLASSIFICATION_META[comment.classification ?? "neutral"];
              const act = ACTION_META[comment.action];
              const Icon = cls?.icon ?? MinusCircle;
              return (
                <div
                  key={comment.id}
                  className={`border p-4 transition-all ${comment.action === "deleted" ? "opacity-50 border-border/20" : "border-border/30 hover:border-border/50"}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Platform + Classification icon */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <PlatformIcon platform={comment.platform} />
                      {cls && <Icon className={`h-3.5 w-3.5 ${cls.color.split(" ")[0]}`} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold text-foreground/80">{comment.authorName ?? "Anônimo"}</span>
                        {cls && (
                          <span className={`font-mono text-[10px] border px-1.5 py-0.5 ${cls.color}`}>
                            {cls.label}
                            {comment.confidence && <span className="opacity-60 ml-1">{Math.round(Number(comment.confidence) * 100)}%</span>}
                          </span>
                        )}
                        <span className={`font-mono text-[10px] border px-1.5 py-0.5 ${act?.color}`}>{act?.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground/30 ml-auto">{timeAgo(comment.createdAt)}</span>
                      </div>

                      <p className="font-mono text-sm text-foreground/70 leading-relaxed mb-2">
                        {comment.commentText}
                      </p>

                      {/* AI Reply shown */}
                      {comment.aiReply && (
                        <div className="border-l-2 border-primary/30 pl-3 mb-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Bot className="h-3 w-3 text-primary/50" />
                            <span className="font-mono text-[10px] text-primary/50 uppercase tracking-widest">Resposta automática</span>
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground/70 italic">{comment.aiReply}</p>
                        </div>
                      )}

                      {/* Error */}
                      {comment.processingError && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="font-mono text-[10px] text-destructive/70">{comment.processingError}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {comment.action !== "deleted" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setReplyTarget(comment)}
                          className="p-1.5 border border-border/30 hover:border-primary/50 hover:text-primary text-muted-foreground/40 transition-colors"
                          title="Responder"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => override(comment, "hidden")}
                          disabled={overriding === comment.id}
                          className="p-1.5 border border-border/30 hover:border-orange-400/50 hover:text-orange-400 text-muted-foreground/40 transition-colors"
                          title="Ocultar"
                        >
                          {overriding === comment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => override(comment, "deleted")}
                          disabled={overriding === comment.id}
                          className="p-1.5 border border-border/30 hover:border-destructive/50 hover:text-destructive text-muted-foreground/40 transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyTarget && (
        <ReplyModal
          comment={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSent={load}
        />
      )}
    </div>
  );
}
