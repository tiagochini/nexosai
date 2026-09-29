import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Search, RefreshCw, Activity, Server, Database, Network, Clock, 
  AlertTriangle, ShieldAlert, XCircle, RotateCcw, Link2, Target, CheckCircle2, ListFilter
} from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemHealth {
  health: {
    statusCode: number;
    status: string;
    version: string;
    env: string;
    startedAt: string;
    uptime: number;
    services: {
      database: { ok: boolean; latencyMs: number };
      redis: { ok: boolean; latencyMs: number };
      queue: {
        ok: boolean;
        backlogs: Record<string, { waiting: number; active: number; delayed: number; failed: number }> | null;
        workers: { orchestration: boolean };
      };
    };
    schedulers: Record<string, {
      startedAt: string;
      lastTickAt: string | null;
      lastSuccessAt: string | null;
      lastErrorAt: string | null;
      lastDurationMs: number;
      inFlight: number;
      stale: boolean;
    }>;
  };
  generatedAt: string;
  thresholds: Record<string, number>;
  correlation: Record<string, string>;
  summary: Record<string, number>;
  integrations: IntegrationRow[];
  stuckCampaigns: StuckCampaignRow[];
  recentFailures: FailureRow[];
  deadLetters: {
    available: boolean;
    entries: DeadLetterRow[];
  };
}

interface IntegrationRow {
  id: string;
  workspaceId: string;
  provider: string;
  purpose: string;
  accountLabel: string | null;
  connectionHealth: string;
  expiry: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

interface StuckCampaignRow {
  id: string;
  workspaceId: string;
  title: string | null;
  status: string;
  updatedAt: string;
  ageMs: number;
}

interface FailureRow {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  agentName: string;
  actionType: string;
  occurredAt: string;
}

interface DeadLetterRow {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  action: string;
  jobId: string | null;
  correlationId: string | null;
  attemptCount: number;
  classification: string;
  replayStatus: string;
  lastFailedAt: string;
}

interface DeadLetterDetail {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  action: string;
  jobId: string | null;
  correlationId: string | null;
  attemptCount: number;
  classification: string;
  replayStatus: string;
  errorSummary: string | null;
  source: string;
  firstFailedAt: string;
  lastFailedAt: string;
  replayJobId: string | null;
  replayedBy: string | null;
  replayedAt: string | null;
  replayFinishedAt: string | null;
  replayErrorSummary: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string, t: ReturnType<typeof useUiText>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t(`${minutes} min atrás`, `${minutes}m ago`, `hace ${minutes} min`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(`${hours} h atrás`, `${hours}h ago`, `hace ${hours} h`);
  const days = Math.floor(hours / 24);
  return t(`${days} d atrás`, `${days}d ago`, `hace ${days} d`);
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleString(locale, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
}

function StatusDot({ status }: { status: string }) {
  let color = "bg-zinc-500";
  if (status === "ok" || status === "up" || status === "active" || status === "healthy") color = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  if (status === "degraded" || status === "warning") color = "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]";
  if (status === "critical" || status === "down" || status === "error" || status === "expired") color = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { user } = useAuth();
  const t = useUiText();
  const { locale } = useUiLocale();
  const queryClient = useQueryClient();

  const [searchWorkspace, setSearchWorkspace] = useState("");
  const [searchCampaign, setSearchCampaign] = useState("");
  const [searchProvider, setSearchProvider] = useState("");
  const [limit, setLimit] = useState("50");
  const [appliedFilters, setAppliedFilters] = useState({
    workspaceId: "",
    campaignId: "",
    provider: "",
    limit: "50",
  });

  const [selectedDeadLetterId, setSelectedDeadLetterId] = useState<string | null>(null);

  const isAdmin = ["admin@agencianexos.vip", "founder@agencianexos.vip"].includes(user?.email ?? "");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (appliedFilters.workspaceId) p.set("workspaceId", appliedFilters.workspaceId);
    if (appliedFilters.campaignId) p.set("campaignId", appliedFilters.campaignId);
    if (appliedFilters.provider) p.set("provider", appliedFilters.provider);
    if (appliedFilters.limit) p.set("limit", appliedFilters.limit);
    return p;
  }, [appliedFilters]);

  const { data: health, isLoading, error, refetch, isRefetching } = useQuery<SystemHealth>({
    queryKey: ["/api/admin/operations/status", params.toString()],
    queryFn: async () => {
      return customFetch<SystemHealth>(`/api/admin/operations/status?${params.toString()}`);
    },
    enabled: isAdmin,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: deadLetterDetail, isLoading: loadingDetail } = useQuery<{ deadLetter: DeadLetterDetail }>({
    queryKey: ["/api/admin/dead-letters", selectedDeadLetterId],
    queryFn: async () => customFetch<{ deadLetter: DeadLetterDetail }>(`/api/admin/dead-letters/${selectedDeadLetterId}`),
    enabled: !!selectedDeadLetterId && isAdmin,
    refetchInterval: (query) => {
      const status = query.state.data?.deadLetter.replayStatus;
      return status === "claimed" || status === "queued" ? 1_000 : false;
    },
    refetchOnWindowFocus: true,
  });

  const replayMutation = useMutation<{ replayed: boolean; replayJobId: string }, unknown, string>({
    mutationFn: async (id) => customFetch<{ replayed: boolean; replayJobId: string }>(
      `/api/admin/dead-letters/${id}/replay`,
      { method: "POST" },
    ),
    onSuccess: async (result, id) => {
      queryClient.setQueryData<{ deadLetter: DeadLetterDetail }>(
        ["/api/admin/dead-letters", id],
        (current) => current ? {
          deadLetter: {
            ...current.deadLetter,
            replayStatus: "queued",
            replayJobId: result.replayJobId,
            replayedAt: new Date().toISOString(),
          },
        } : current,
      );
      toast.success(t("Tarefa de repetição adicionada à fila.", "Replay job queued successfully.", "Tarea de repetición añadida a la cola."));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dead-letters", id] }),
      ]);
    },
    onError: (err) => {
      if (typeof err === "object" && err !== null && "status" in err && err.status === 409) {
        toast.error(t("Conflito: tarefa com falha já reivindicada ou repetida.", "Conflict: dead letter already claimed or replayed.", "Conflicto: la tarea fallida ya fue reclamada o repetida."));
      } else {
        toast.error(t("Não foi possível iniciar a repetição.", "Failed to trigger replay.", "No se pudo iniciar la repetición."));
      }
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">{t("Acesso não autorizado", "Unauthorized access", "Acceso no autorizado")}</p>
      </div>
    );
  }

  const isDegraded = health?.health.status === "degraded";
  const isCritical = health?.health.status === "critical";
  const statusColor = isCritical ? "text-red-500" : isDegraded ? "text-yellow-500" : "text-emerald-500";
  const statusBorder = isCritical ? "border-red-500/30" : isDegraded ? "border-yellow-500/30" : "border-emerald-500/30";
  const statusBg = isCritical ? "bg-red-500/10" : isDegraded ? "bg-yellow-500/10" : "bg-emerald-500/10";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" aria-label={t("Voltar ao admin", "Back to Admin", "Volver al admin")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2 font-mono uppercase tracking-widest">
                <Activity className="w-5 h-5 text-red-400" />
                {t("Controle de operações", "Operations Control", "Control de operaciones")}
              </h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">
                {t("Saúde do sistema e intervenções", "System Health & Intervention Surface", "Estado del sistema e intervenciones")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <Badge variant="outline" className={`font-mono text-xs px-3 py-1 rounded-none uppercase tracking-widest ${statusBorder} ${statusColor} ${statusBg}`}>
                SYS: {health.health.status}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              {t("Sincronizar", "Sync", "Sincronizar")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Core Services Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">Core API</span>
              </div>
              <StatusDot status={health?.health.status ?? "loading"} />
            </div>
            {isLoading ? <Skeleton className="h-6 w-24 bg-zinc-800" /> : (
              <div>
                <div className="font-mono text-lg text-zinc-100 uppercase">{health?.health.status ?? "unknown"}</div>
                <div className="font-mono text-[10px] text-zinc-500 mt-1">{t("Tempo ativo:", "Uptime:", "Tiempo activo:")} {Math.floor((health?.health.uptime ?? 0) / 60)} min</div>
              </div>
            )}
          </div>
          
          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">Database</span>
              </div>
              <StatusDot status={health?.health.services.database.ok ? "ok" : "critical"} />
            </div>
            {isLoading ? <Skeleton className="h-6 w-24 bg-zinc-800" /> : (
              <div>
                <div className="font-mono text-lg text-zinc-100 uppercase">{health?.health.services.database.ok ? "OK" : "DOWN"}</div>
                <div className="font-mono text-[10px] text-zinc-500 mt-1">{health?.health.services.database.latencyMs ?? 0} ms {t("de latência", "latency", "de latencia")}</div>
              </div>
            )}
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">Redis</span>
              </div>
              <StatusDot status={health?.health.services.redis.ok ? "ok" : "critical"} />
            </div>
            {isLoading ? <Skeleton className="h-6 w-24 bg-zinc-800" /> : (
              <div>
                <div className="font-mono text-lg text-zinc-100 uppercase">{health?.health.services.redis.ok ? "OK" : "DOWN"}</div>
                <div className="font-mono text-[10px] text-zinc-500 mt-1">{health?.health.services.redis.latencyMs ?? 0} ms {t("de latência", "latency", "de latencia")}</div>
              </div>
            )}
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-zinc-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">Queue</span>
              </div>
              <StatusDot status={health?.health.services.queue.ok ? "ok" : "critical"} />
            </div>
            {isLoading ? <Skeleton className="h-6 w-24 bg-zinc-800" /> : (
              <div>
                <div className="font-mono text-lg text-zinc-100 uppercase">{health?.health.services.queue.ok ? "OK" : "DOWN"}</div>
                <div className="font-mono text-[10px] text-zinc-500 mt-1">
                  {t("Orquestrador:", "Orchestrator:", "Orquestador:")} {health?.health.services.queue.workers.orchestration ? t("Ativo", "Active", "Activo") : t("Offline", "Offline", "Desconectado")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedulers */}
        {health?.health.schedulers && Object.keys(health.health.schedulers).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(health.health.schedulers).map(([name, s]) => (
              <div key={name} className="border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">{name}</span>
                  </div>
                  <StatusDot status={s.stale ? "critical" : "ok"} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>{t("Iniciado", "Started", "Iniciado")}</span>
                    <span className="text-zinc-400">{formatRelative(s.startedAt, t)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>{t("Última atividade", "Last tick", "Última actividad")}</span>
                    <span className={s.stale ? "text-red-400" : "text-zinc-400"}>
                      {s.lastTickAt ? formatRelative(s.lastTickAt, t) : t("Nunca", "Never", "Nunca")}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>{t("Duração", "Duration", "Duración")}</span>
                    <span className="text-zinc-400">{s.lastDurationMs}ms</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>{t("Em andamento", "In flight", "En curso")}</span>
                    <span className="text-zinc-400">{s.inFlight}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="border border-zinc-800 bg-zinc-900/20 p-4">
          <div className="flex items-center gap-3 mb-4">
            <ListFilter className="w-4 h-4 text-zinc-500" />
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">{t("Filtros globais", "Global Filters", "Filtros globales")}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input 
              placeholder={t("ID do workspace", "Workspace ID", "ID del workspace")}
              value={searchWorkspace} 
              onChange={e => setSearchWorkspace(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Input 
              placeholder={t("ID da campanha", "Campaign ID", "ID de la campaña")}
              value={searchCampaign} 
              onChange={e => setSearchCampaign(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Input 
              placeholder={t("Provedor (ex.: Meta)", "Provider (e.g. Meta)", "Proveedor (p. ej., Meta)")}
              value={searchProvider} 
              onChange={e => setSearchProvider(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus:ring-1 focus:ring-red-500/50 text-zinc-100">
                <SelectValue placeholder={t("Limite", "Limit", "Límite")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 rounded-none font-mono text-xs text-zinc-100">
                <SelectItem value="10">{t("Limite 10", "Limit 10", "Límite 10")}</SelectItem>
                <SelectItem value="50">{t("Limite 50", "Limit 50", "Límite 50")}</SelectItem>
                <SelectItem value="100">{t("Limite 100", "Limit 100", "Límite 100")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => setAppliedFilters({
                workspaceId: searchWorkspace.trim(),
                campaignId: searchCampaign.trim(),
                provider: searchProvider.trim(),
                limit,
              })}
              className="rounded-none font-mono uppercase text-xs tracking-widest gap-2"
            >
              <Search className="h-3.5 w-3.5" />
              {t("Aplicar filtros", "Apply filters", "Aplicar filtros")}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="border border-red-500/30 bg-red-500/10 p-6 flex flex-col items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500 mb-3" />
            <p className="font-mono text-sm text-red-400 uppercase tracking-widest">{t("Falha ao carregar o status das operações", "Failed to fetch operations status", "No se pudo cargar el estado de las operaciones")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Stuck Campaigns */}
            <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">{t("Campanhas travadas", "Stuck Campaigns", "Campañas atascadas")}</span>
                </div>
                <Badge variant="outline" className="rounded-none bg-zinc-950 border-zinc-800 text-zinc-400 font-mono text-[10px]">
                  {health?.stuckCampaigns.length ?? 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                  </div>
                ) : health?.stuckCampaigns.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs uppercase tracking-widest p-8">
                    {t("Nenhuma campanha travada", "No stuck campaigns", "No hay campañas atascadas")}
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">{t("Campanha", "Campaign", "Campaña")}</th>
                        <th className="px-4 py-2 font-normal">{t("Status", "Status", "Estado")}</th>
                        <th className="px-4 py-2 font-normal">{t("Tempo", "Age", "Tiempo")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {health?.stuckCampaigns.map(c => (
                        <tr key={c.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-zinc-300 truncate max-w-[200px]" title={c.title || c.id}>{c.title || c.id}</div>
                            <div className="font-mono text-[10px] text-zinc-600 truncate max-w-[200px]" title={c.workspaceId}>{c.workspaceId}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="rounded-none bg-orange-500/10 border-orange-500/30 text-orange-400 font-mono text-[10px] uppercase">
                              {c.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {formatRelative(c.updatedAt, t)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Dead Letters */}
            <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">{t("Tarefas com falha", "Dead Letters", "Tareas fallidas")}</span>
                </div>
                <Badge variant="outline" className={`rounded-none font-mono text-[10px] ${health?.deadLetters.available ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-zinc-950 border-zinc-800 text-zinc-400"}`}>
                  {health?.deadLetters.entries.length ?? 0} {health?.deadLetters.available ? t("na fila (há mais)", "in queue (more available)", "en cola (hay más)") : t("na fila", "in queue", "en cola")}
                </Badge>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                  </div>
                ) : health?.deadLetters.entries.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs uppercase tracking-widest p-8">
                    {t("Fila vazia", "Queue is clear", "Cola vacía")}
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">{t("Ação", "Action", "Acción")}</th>
                        <th className="px-4 py-2 font-normal">{t("Classificação", "Class", "Clasificación")}</th>
                        <th className="px-4 py-2 font-normal">{t("Status", "Status", "Estado")}</th>
                        <th className="px-4 py-2 font-normal">{t("Ação", "Action", "Acción")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {health?.deadLetters.entries.map(dl => (
                        <tr key={dl.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-zinc-300 truncate max-w-[150px]" title={dl.action}>{dl.action}</div>
                            <div className="font-mono text-[10px] text-zinc-600">{formatRelative(dl.lastFailedAt, t)}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-zinc-400 uppercase">
                            {dl.classification}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="rounded-none bg-zinc-950 border-zinc-800 text-zinc-400 font-mono text-[10px] uppercase">
                              {dl.replayStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-none h-7 px-2 font-mono text-[10px] uppercase tracking-widest border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                              onClick={() => setSelectedDeadLetterId(dl.id)}
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Integrations Health */}
            <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">{t("Saúde das integrações", "Integration Health", "Estado de las integraciones")}</span>
                </div>
                <Badge variant="outline" className="rounded-none bg-zinc-950 border-zinc-800 text-zinc-400 font-mono text-[10px]">
                  {health?.integrations.length ?? 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                  </div>
                ) : health?.integrations.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs uppercase tracking-widest p-8">
                    {t("Nenhuma integração encontrada", "No matching integrations", "No se encontraron integraciones")}
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">{t("Provedor / conta", "Provider / Account", "Proveedor / cuenta")}</th>
                        <th className="px-4 py-2 font-normal">{t("Saúde", "Health", "Estado")}</th>
                        <th className="px-4 py-2 font-normal">{t("Expiração", "Expiry", "Vencimiento")}</th>
                        <th className="px-4 py-2 font-normal">{t("Atualizado", "Updated", "Actualizado")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {health?.integrations.map(i => (
                        <tr key={i.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-zinc-300 uppercase tracking-wider">{i.provider} <span className="text-zinc-600">/</span> {i.purpose}</div>
                            <div className="font-mono text-[10px] text-zinc-500 mt-1 truncate max-w-[200px]">{i.accountLabel || i.workspaceId}</div>
                          </td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <StatusDot status={i.connectionHealth} />
                            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">{i.connectionHealth}</span>
                          </td>
                          <td className="px-4 py-3">
                            {i.expiry ? (
                              <div>
                                <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase tracking-widest ${i.expiry === "expired" ? "border-red-500/30 text-red-400 bg-red-500/10" : i.expiry === "expiring_soon" ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" : "border-zinc-800 text-zinc-400 bg-zinc-950"}`}>
                                  {i.expiry}
                                </Badge>
                                {i.expiresAt && <div className="font-mono text-[10px] text-zinc-600 mt-1">{formatRelative(i.expiresAt, t)}</div>}
                              </div>
                            ) : (
                              <span className="font-mono text-[10px] text-zinc-600">{t("N/D", "N/A", "N/D")}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {formatRelative(i.updatedAt, t)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Recent Failures */}
            <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-zinc-500" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">{t("Falhas recentes", "Recent Failures", "Fallos recientes")}</span>
                </div>
                <Badge variant="outline" className="rounded-none bg-zinc-950 border-zinc-800 text-zinc-400 font-mono text-[10px]">
                  {health?.recentFailures.length ?? 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                  </div>
                ) : health?.recentFailures.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs uppercase tracking-widest p-8">
                    {t("Nenhuma falha recente", "No recent failures", "No hay fallos recientes")}
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">{t("Agente / ação", "Agent / Action", "Agente / acción")}</th>
                        <th className="px-4 py-2 font-normal">{t("Campanha", "Campaign", "Campaña")}</th>
                        <th className="px-4 py-2 font-normal">{t("Ocorrência", "Occurred", "Ocurrido")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {health?.recentFailures.map(f => (
                        <tr key={f.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono text-[11px] text-zinc-300 uppercase tracking-widest">{f.agentName}</div>
                            <div className="font-mono text-[10px] text-zinc-500 mt-1 truncate max-w-[150px]">{f.actionType}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-[10px] text-zinc-500 truncate max-w-[150px]" title={f.campaignId || ""}>
                              {f.campaignId || "N/A"}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {formatRelative(f.occurredAt, t)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Dead Letter Detail / Replay Dialog */}
      <Dialog open={!!selectedDeadLetterId} onOpenChange={(open) => !open && setSelectedDeadLetterId(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 max-w-2xl text-zinc-100 rounded-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-zinc-800 bg-zinc-900/50">
            <DialogTitle className="font-mono uppercase tracking-widest text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              {t("Inspeção de tarefa com falha", "Dead Letter Inspection", "Inspección de tarea fallida")}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-500 mt-2">
              ID: {selectedDeadLetterId}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loadingDetail || !deadLetterDetail ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/3 bg-zinc-800/50" />
                <Skeleton className="h-24 w-full bg-zinc-800/50" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Ação", "Action", "Acción")}</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.action}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Classificação", "Classification", "Clasificación")}</p>
                    <Badge variant="outline" className="rounded-none bg-zinc-900 border-zinc-700 text-zinc-300 font-mono text-[10px] uppercase tracking-widest">
                      {deadLetterDetail.deadLetter.classification}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Origem", "Source", "Origen")}</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.source}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Número de tentativas", "Attempt Count", "Número de intentos")}</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.attemptCount}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Primeira falha", "First Failed", "Primer fallo")}</p>
                    <p className="font-mono text-xs text-zinc-300">{formatDate(deadLetterDetail.deadLetter.firstFailedAt, intlLocale(locale))}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Última falha", "Last Failed", "Último fallo")}</p>
                    <p className="font-mono text-xs text-zinc-300">{formatDate(deadLetterDetail.deadLetter.lastFailedAt, intlLocale(locale))}</p>
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mb-2">{t("Resumo do erro", "Error Summary", "Resumen del error")}</p>
                  <div className="bg-red-500/5 border border-red-500/20 p-3 overflow-x-auto">
                    <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap">
                      {deadLetterDetail.deadLetter.errorSummary || t("Detalhes do erro indisponíveis", "No error details available", "Detalles del error no disponibles")}
                    </pre>
                  </div>
                </div>

                {(deadLetterDetail.deadLetter.replayJobId || deadLetterDetail.deadLetter.replayErrorSummary) && (
                  <div className="border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-3 border-b border-zinc-800 pb-2">{t("Dados da repetição", "Replay Evidence", "Datos de repetición")}</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("ID da tarefa repetida", "Replay Job ID", "ID de tarea repetida")}</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayJobId || "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Repetida por", "Replayed By", "Repetida por")}</p>
                        <p className="font-mono text-xs text-zinc-300 truncate">{deadLetterDetail.deadLetter.replayedBy || "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Repetida em", "Replayed At", "Repetida el")}</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayedAt ? formatDate(deadLetterDetail.deadLetter.replayedAt, intlLocale(locale)) : "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t("Finalizada em", "Finished At", "Finalizada el")}</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayFinishedAt ? formatDate(deadLetterDetail.deadLetter.replayFinishedAt, intlLocale(locale)) : "—"}</p>
                      </div>
                    </div>
                    {deadLetterDetail.deadLetter.replayErrorSummary && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mb-2">{t("Erro ao repetir", "Replay Error", "Error al repetir")}</p>
                        <div className="bg-red-500/5 border border-red-500/20 p-3 overflow-x-auto">
                          <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap">
                            {deadLetterDetail.deadLetter.replayErrorSummary}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-zinc-800 bg-zinc-900/50 sm:justify-between items-center flex-row flex">
            <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              {t("Status da repetição:", "Replay Status:", "Estado de repetición:")} {deadLetterDetail?.deadLetter.replayStatus || "unknown"}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectedDeadLetterId(null)}
                className="rounded-none font-mono text-xs uppercase tracking-widest border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              >
                {t("Cancelar", "Cancel", "Cancelar")}
              </Button>
              <Button 
                variant="default"
                disabled={
                  replayMutation.isPending
                  || loadingDetail
                  || !deadLetterDetail
                  || !["none", "failed"].includes(deadLetterDetail.deadLetter.replayStatus)
                }
                onClick={() => selectedDeadLetterId && replayMutation.mutate(selectedDeadLetterId)}
                className="rounded-none font-mono text-xs uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white gap-2"
              >
                {replayMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                {t("Confirmar repetição", "Confirm Replay", "Confirmar repetición")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
