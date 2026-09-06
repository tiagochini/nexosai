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

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
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
      toast.success("Replay job queued successfully");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dead-letters", id] }),
      ]);
    },
    onError: (err) => {
      if (typeof err === "object" && err !== null && "status" in err && err.status === 409) {
        toast.error("Conflict: Dead letter already claimed or replayed");
      } else {
        toast.error("Failed to trigger replay");
      }
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">Unauthorized access</p>
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
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" aria-label="Back to Admin">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2 font-mono uppercase tracking-widest">
                <Activity className="w-5 h-5 text-red-400" />
                Operations Control
              </h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">
                System Health & Intervention Surface
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
              Sync
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
                <div className="font-mono text-[10px] text-zinc-500 mt-1">Uptime: {Math.floor((health?.health.uptime ?? 0) / 60)}m</div>
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
                <div className="font-mono text-[10px] text-zinc-500 mt-1">{health?.health.services.database.latencyMs ?? 0}ms latency</div>
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
                <div className="font-mono text-[10px] text-zinc-500 mt-1">{health?.health.services.redis.latencyMs ?? 0}ms latency</div>
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
                  Orchestrator: {health?.health.services.queue.workers.orchestration ? "Active" : "Offline"}
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
                    <span>Started</span>
                    <span className="text-zinc-400">{formatRelative(s.startedAt)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>Last Tick</span>
                    <span className={s.stale ? "text-red-400" : "text-zinc-400"}>
                      {s.lastTickAt ? formatRelative(s.lastTickAt) : "Never"}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>Duration</span>
                    <span className="text-zinc-400">{s.lastDurationMs}ms</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>In-flight</span>
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
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">Global Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input 
              placeholder="Workspace ID" 
              value={searchWorkspace} 
              onChange={e => setSearchWorkspace(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Input 
              placeholder="Campaign ID" 
              value={searchCampaign} 
              onChange={e => setSearchCampaign(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Input 
              placeholder="Provider (e.g. meta)" 
              value={searchProvider} 
              onChange={e => setSearchProvider(e.target.value)}
              className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus-visible:ring-1 focus-visible:ring-red-500/50 text-zinc-100"
            />
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-none focus:ring-1 focus:ring-red-500/50 text-zinc-100">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 rounded-none font-mono text-xs text-zinc-100">
                <SelectItem value="10">Limit 10</SelectItem>
                <SelectItem value="50">Limit 50</SelectItem>
                <SelectItem value="100">Limit 100</SelectItem>
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
              Apply filters
            </Button>
          </div>
        </div>

        {error ? (
          <div className="border border-red-500/30 bg-red-500/10 p-6 flex flex-col items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500 mb-3" />
            <p className="font-mono text-sm text-red-400 uppercase tracking-widest">Failed to fetch operations status</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Stuck Campaigns */}
            <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Stuck Campaigns</span>
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
                    No stuck campaigns
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">Campaign</th>
                        <th className="px-4 py-2 font-normal">Status</th>
                        <th className="px-4 py-2 font-normal">Age</th>
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
                            {formatRelative(c.updatedAt)}
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
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Dead Letters</span>
                </div>
                <Badge variant="outline" className={`rounded-none font-mono text-[10px] ${health?.deadLetters.available ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-zinc-950 border-zinc-800 text-zinc-400"}`}>
                  {health?.deadLetters.entries.length ?? 0} {health?.deadLetters.available ? "in queue (more available)" : "in queue"}
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
                    Queue is clear
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">Action</th>
                        <th className="px-4 py-2 font-normal">Class</th>
                        <th className="px-4 py-2 font-normal">Status</th>
                        <th className="px-4 py-2 font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {health?.deadLetters.entries.map(dl => (
                        <tr key={dl.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-zinc-300 truncate max-w-[150px]" title={dl.action}>{dl.action}</div>
                            <div className="font-mono text-[10px] text-zinc-600">{formatRelative(dl.lastFailedAt)}</div>
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
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Integration Health</span>
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
                    No matching integrations
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">Provider / Account</th>
                        <th className="px-4 py-2 font-normal">Health</th>
                        <th className="px-4 py-2 font-normal">Expiry</th>
                        <th className="px-4 py-2 font-normal">Updated</th>
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
                                {i.expiresAt && <div className="font-mono text-[10px] text-zinc-600 mt-1">{formatRelative(i.expiresAt)}</div>}
                              </div>
                            ) : (
                              <span className="font-mono text-[10px] text-zinc-600">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {formatRelative(i.updatedAt)}
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
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Recent Failures</span>
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
                    No recent failures
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 font-mono text-[10px] text-zinc-500 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-normal">Agent / Action</th>
                        <th className="px-4 py-2 font-normal">Campaign</th>
                        <th className="px-4 py-2 font-normal">Occurred</th>
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
                            {formatRelative(f.occurredAt)}
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
              Dead Letter Inspection
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
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Action</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.action}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Classification</p>
                    <Badge variant="outline" className="rounded-none bg-zinc-900 border-zinc-700 text-zinc-300 font-mono text-[10px] uppercase tracking-widest">
                      {deadLetterDetail.deadLetter.classification}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Source</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.source}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Attempt Count</p>
                    <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.attemptCount}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">First Failed</p>
                    <p className="font-mono text-xs text-zinc-300">{formatDate(deadLetterDetail.deadLetter.firstFailedAt)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Last Failed</p>
                    <p className="font-mono text-xs text-zinc-300">{formatDate(deadLetterDetail.deadLetter.lastFailedAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mb-2">Error Summary</p>
                  <div className="bg-red-500/5 border border-red-500/20 p-3 overflow-x-auto">
                    <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap">
                      {deadLetterDetail.deadLetter.errorSummary || "No error details available"}
                    </pre>
                  </div>
                </div>

                {(deadLetterDetail.deadLetter.replayJobId || deadLetterDetail.deadLetter.replayErrorSummary) && (
                  <div className="border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-3 border-b border-zinc-800 pb-2">Replay Evidence</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Replay Job ID</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayJobId || "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Replayed By</p>
                        <p className="font-mono text-xs text-zinc-300 truncate">{deadLetterDetail.deadLetter.replayedBy || "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Replayed At</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayedAt ? formatDate(deadLetterDetail.deadLetter.replayedAt) : "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Finished At</p>
                        <p className="font-mono text-xs text-zinc-300">{deadLetterDetail.deadLetter.replayFinishedAt ? formatDate(deadLetterDetail.deadLetter.replayFinishedAt) : "—"}</p>
                      </div>
                    </div>
                    {deadLetterDetail.deadLetter.replayErrorSummary && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mb-2">Replay Error</p>
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
              Replay Status: {deadLetterDetail?.deadLetter.replayStatus || "Unknown"}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectedDeadLetterId(null)}
                className="rounded-none font-mono text-xs uppercase tracking-widest border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              >
                Cancel
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
                Confirm Replay
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
