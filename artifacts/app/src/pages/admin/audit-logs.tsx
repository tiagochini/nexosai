import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  ArrowLeft, Search, Filter, RefreshCw, Bot, CheckCircle2,
  XCircle, Clock, AlertTriangle, Shield, Zap, BarChart3,
  ChevronRight, Eye, Download, FlaskConical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  campaignId: string | null;
  workspaceId: string;
  userId: string | null;
  agentName: string;
  actionType: string;
  inputSummary: string | null;
  outputSummary: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  approvalRequired: boolean;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  executionStatus: "started" | "completed" | "failed" | "skipped" | "dry_run";
  errorMessage: string | null;
  providerUsed: string | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  estimatedCostUsd: number | null;
  isDryRun: boolean;
  startedAt: string;
  completedAt: string | null;
}

interface AuditSummary {
  totals: {
    total: number;
    completed: number;
    failed: number;
    dryRun: number;
    pendingApproval: number;
    totalTokens: number;
    totalCostUsd: number;
    avgRiskScore: number;
    avgConfidence: number;
  };
  byAgent: { agentName: string; runs: number; failures: number; avgCostUsd: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: AuditLogRow["executionStatus"], isDryRun: boolean) {
  if (isDryRun) return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">DRY RUN</Badge>;
  const map: Record<string, { color: string; label: string }> = {
    completed: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Concluído" },
    failed:    { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Falhou" },
    started:   { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Em andamento" },
    skipped:   { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: "Ignorado" },
    dry_run:   { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "DRY RUN" },
  };
  const s = map[status] ?? { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: status };
  return <Badge className={`${s.color} text-xs border`}>{s.label}</Badge>;
}

function approvalBadge(status: AuditLogRow["approvalStatus"]) {
  if (status === "not_required") return null;
  const map: Record<string, { color: string; label: string }> = {
    pending:  { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Aguardando" },
    approved: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Aprovado" },
    rejected: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Rejeitado" },
  };
  const s = map[status] ?? { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: status };
  return <Badge className={`${s.color} text-xs border`}>{s.label}</Badge>;
}

function riskColor(score: number | null) {
  if (score === null) return "text-zinc-500";
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-yellow-400";
  return "text-emerald-400";
}

function durationMs(row: AuditLogRow): string {
  if (!row.completedAt) return "—";
  const ms = new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function LogDetailModal({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">{log.agentName}</span>
            {statusBadge(log.executionStatus, log.isDryRun)}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">✕</Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Ação</p>
              <p className="text-zinc-200 font-mono text-xs">{log.actionType}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Duração</p>
              <p className="text-zinc-200">{durationMs(log)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Provider / Model</p>
              <p className="text-zinc-200">{log.providerUsed ?? "—"} / {log.modelUsed ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Tokens / Custo</p>
              <p className="text-zinc-200">{log.tokensUsed?.toLocaleString() ?? "—"} / ${log.estimatedCostUsd?.toFixed(4) ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Confidence Score</p>
              <p className="text-emerald-400">{log.confidenceScore !== null ? `${(log.confidenceScore * (log.confidenceScore <= 1 ? 100 : 1)).toFixed(0)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Risk Score</p>
              <p className={riskColor(log.riskScore)}>{log.riskScore !== null ? `${log.riskScore.toFixed(0)}/100` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Aprovação</p>
              <div>{approvalBadge(log.approvalStatus) ?? <span className="text-zinc-500 text-xs">Não requerida</span>}</div>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Campaign ID</p>
              <p className="text-zinc-400 font-mono text-xs">{log.campaignId ?? "—"}</p>
            </div>
          </div>

          {log.inputSummary && (
            <div>
              <p className="text-zinc-500 text-xs mb-1">Input (resumo)</p>
              <pre className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap overflow-x-auto">{log.inputSummary}</pre>
            </div>
          )}
          {log.outputSummary && (
            <div>
              <p className="text-zinc-500 text-xs mb-1">Output (resumo)</p>
              <pre className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap overflow-x-auto">{log.outputSummary}</pre>
            </div>
          )}
          {log.errorMessage && (
            <div>
              <p className="text-red-400 text-xs mb-1">Erro</p>
              <pre className="bg-red-950/40 border border-red-900/50 rounded-lg p-3 text-xs text-red-300 whitespace-pre-wrap">{log.errorMessage}</pre>
            </div>
          )}
          <div className="text-xs text-zinc-600">
            <p>Iniciado: {formatDate(log.startedAt)}</p>
            {log.completedAt && <p>Concluído: {formatDate(log.completedAt)}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isDryRunFilter, setIsDryRunFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 50;

  const params = new URLSearchParams();
  if (search) params.set("agentName", search);
  if (statusFilter) params.set("executionStatus", statusFilter);
  if (approvalFilter === "required") params.set("approvalRequired", "true");
  if (riskFilter) params.set("minRiskScore", riskFilter);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (isDryRunFilter) params.set("isDryRun", isDryRunFilter);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data: logs, isLoading, refetch } = useQuery<AuditLogRow[]>({
    queryKey: ["audit-logs", params.toString()],
    queryFn: async () => {
      return customFetch<{ logs: AuditLogRow[] }>(`/api/admin/audit-logs?${params.toString()}`)
        .then(d => d.logs);
    },
    refetchInterval: 15000,
  });

  const { data: summary } = useQuery<AuditSummary>({
    queryKey: ["audit-logs-summary"],
    queryFn: async () => {
      return customFetch<AuditSummary>("/api/admin/audit-logs/summary");
    },
    refetchInterval: 30000,
  });

  const isAdmin = ["admin@agencianexos.vip", "founder@agencianexos.vip"].includes(user?.email ?? "");
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                Audit Logs
              </h1>
              <p className="text-xs text-zinc-500">Registro auditável de todas as execuções de agentes</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} className="text-zinc-400 hover:text-white gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Summary KPIs */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total execuções", value: summary.totals.total?.toLocaleString() ?? "0", icon: Bot, color: "text-cyan-400" },
              { label: "Concluídas", value: summary.totals.completed?.toLocaleString() ?? "0", icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Falhas", value: summary.totals.failed?.toLocaleString() ?? "0", icon: XCircle, color: "text-red-400" },
              { label: "Aprovação pendente", value: summary.totals.pendingApproval?.toLocaleString() ?? "0", icon: Clock, color: "text-yellow-400" },
              { label: "DRY RUN", value: summary.totals.dryRun?.toLocaleString() ?? "0", icon: FlaskConical, color: "text-purple-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-zinc-500">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cost / tokens row */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Tokens totais", value: summary.totals.totalTokens?.toLocaleString() ?? "0" },
              { label: "Custo estimado (USD)", value: `$${(summary.totals.totalCostUsd ?? 0).toFixed(4)}` },
              { label: "Risk Score médio", value: `${(summary.totals.avgRiskScore ?? 0).toFixed(1)}/100` },
              { label: "Confidence médio", value: `${((summary.totals.avgConfidence ?? 0) * (summary.totals.avgConfidence > 1 ? 1 : 100)).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className="text-base font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Agente..."
                className="pl-8 bg-zinc-800 border-zinc-700 text-sm h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 px-3 h-9"
            >
              <option value="">Todos os status</option>
              <option value="completed">Concluído</option>
              <option value="failed">Falhou</option>
              <option value="started">Em andamento</option>
              <option value="dry_run">DRY RUN</option>
              <option value="skipped">Ignorado</option>
            </select>
            <select
              value={approvalFilter}
              onChange={(e) => { setApprovalFilter(e.target.value); setPage(0); }}
              className="bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 px-3 h-9"
            >
              <option value="">Todas as aprovações</option>
              <option value="required">Requer aprovação</option>
            </select>
            <select
              value={riskFilter}
              onChange={(e) => { setRiskFilter(e.target.value); setPage(0); }}
              className="bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 px-3 h-9"
            >
              <option value="">Qualquer risco</option>
              <option value="70">Alto (≥70)</option>
              <option value="40">Médio+ (≥40)</option>
            </select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="bg-zinc-800 border-zinc-700 text-sm h-9 text-zinc-300"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="bg-zinc-800 border-zinc-700 text-sm h-9 text-zinc-300"
            />
            <select
              value={isDryRunFilter}
              onChange={(e) => { setIsDryRunFilter(e.target.value); setPage(0); }}
              className="bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 px-3 h-9"
            >
              <option value="">Real + DRY RUN</option>
              <option value="true">Apenas DRY RUN</option>
              <option value="false">Apenas Real</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-zinc-400 hover:text-white"
              onClick={() => { setSearch(""); setStatusFilter(""); setApprovalFilter(""); setRiskFilter(""); setDateFrom(""); setDateTo(""); setIsDryRunFilter(""); setPage(0); }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                  <th className="text-left px-4 py-3">Agente</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Aprovação</th>
                  <th className="text-left px-4 py-3">Risk</th>
                  <th className="text-left px-4 py-3">Confidence</th>
                  <th className="text-left px-4 py-3">Provider</th>
                  <th className="text-left px-4 py-3">Tokens</th>
                  <th className="text-left px-4 py-3">Custo</th>
                  <th className="text-left px-4 py-3">Duração</th>
                  <th className="text-left px-4 py-3">Iniciado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="px-4 py-3" colSpan={11}>
                      <Skeleton className="h-4 w-full bg-zinc-800" />
                    </td>
                  </tr>
                ))}
                {!isLoading && (!logs || logs.length === 0) && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-zinc-500">
                      Nenhum log encontrado com os filtros aplicados
                    </td>
                  </tr>
                )}
                {logs?.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(row)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="font-mono text-xs text-zinc-200">{row.agentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(row.executionStatus, row.isDryRun)}</td>
                    <td className="px-4 py-3">
                      {approvalBadge(row.approvalStatus) ?? <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${riskColor(row.riskScore)}`}>
                        {row.riskScore !== null ? `${row.riskScore.toFixed(0)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-300">
                        {row.confidenceScore !== null
                          ? `${(row.confidenceScore * (row.confidenceScore <= 1 ? 100 : 1)).toFixed(0)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">{row.providerUsed ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">{row.tokensUsed?.toLocaleString() ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">{row.estimatedCostUsd != null ? `$${row.estimatedCostUsd.toFixed(4)}` : "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">{durationMs(row)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-500">{formatDate(row.startedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              {logs?.length === PAGE_SIZE ? `Mostrando ${page * PAGE_SIZE + 1}–${(page + 1) * PAGE_SIZE}` : `${(logs?.length ?? 0) + page * PAGE_SIZE} resultados`}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-zinc-400 h-7 text-xs">Anterior</Button>
              <Button variant="ghost" size="sm" disabled={(logs?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="text-zinc-400 h-7 text-xs">Próxima</Button>
            </div>
          </div>
        </div>

        {/* Agent breakdown */}
        {summary && summary.byAgent.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-sm">Execuções por agente</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                    <th className="text-left px-4 py-2">Agente</th>
                    <th className="text-left px-4 py-2">Execuções</th>
                    <th className="text-left px-4 py-2">Falhas</th>
                    <th className="text-left px-4 py-2">Taxa de sucesso</th>
                    <th className="text-left px-4 py-2">Custo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byAgent.map((a) => {
                    const successRate = a.runs > 0 ? ((a.runs - a.failures) / a.runs * 100) : 0;
                    return (
                      <tr key={a.agentName} className="border-b border-zinc-800/50">
                        <td className="px-4 py-2 font-mono text-xs text-zinc-200">{a.agentName}</td>
                        <td className="px-4 py-2 text-xs text-zinc-400">{a.runs}</td>
                        <td className="px-4 py-2 text-xs text-red-400">{a.failures}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${successRate >= 90 ? "bg-emerald-500" : successRate >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-400">{successRate.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">${a.avgCostUsd.toFixed(4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
