import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Rule = { id: string; name: string; enabled: boolean; scheduleMinutes: number; lastRunAt: string | null; lastError: string | null; configuration: Record<string, unknown> };
type Alert = { id: string; ruleId: string; message: string; severity: string; createdAt: string; metrics: Record<string, unknown>; readAt: string | null };
export function OptimizationRulesTab() {
  const client = useQueryClient();
  const [accountId, setAccount] = useState(""), [name, setName] = useState(""), [maxCpa, setMaxCpa] = useState(""), [minRoas, setMinRoas] = useState(""), [minCtr, setMinCtr] = useState(""), [scheduleMinutes, setSchedule] = useState(60), [lookbackDays, setLookback] = useState(7);
  const rulesQuery = useQuery({ queryKey: ["/api/paid-media/optimization-rules"], queryFn: () => customFetch<{ rules: Rule[] }>("/api/paid-media/optimization-rules"), refetchInterval: 60000 });
  const alertsQuery = useQuery({ queryKey: ["/api/paid-media/optimization-alerts"], queryFn: () => customFetch<{ alerts: Alert[] }>("/api/paid-media/optimization-alerts"), refetchInterval: 60000 });
  const accountsQuery = useQuery({ queryKey: ["/api/paid-media/accounts/meta_ads"], queryFn: () => customFetch<{ accounts: Array<{ id: string; accountName: string; isSelected: boolean }> }>("/api/paid-media/accounts/meta_ads") });
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["/api/paid-media/optimization-rules"] }); await client.invalidateQueries({ queryKey: ["/api/paid-media/optimization-alerts"] }); };
  const post = async (url: string, body?: unknown) => { try { await customFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body == null ? undefined : JSON.stringify(body) }); await refresh(); toast.success("Operação concluída."); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); } };
  const create = async (e: React.FormEvent) => { e.preventDefault(); await post("/api/paid-media/optimization-rules", { accountId, name, scheduleMinutes, lookbackDays, entityTypes: ["campaign", "ad_set", "ad"], ...(maxCpa ? { maxCpa: Number(maxCpa) } : {}), ...(minRoas ? { minRoas: Number(minRoas) } : {}), ...(minCtr ? { minCtr: Number(minCtr) } : {}) }); setName(""); };
  return <section className="space-y-5 text-sm">
    <div className="rounded border border-border/50 p-4 space-y-3"><h3 className="font-semibold">Regras de otimização monitoradas</h3><p className="text-muted-foreground text-xs">Avaliação automática por dados sincronizados. Os alertas pedem revisão; não alteram campanhas nem anúncios.</p>
      <form onSubmit={create} className="grid gap-2 md:grid-cols-5">
        <select required value={accountId} onChange={e => setAccount(e.target.value)} className="rounded border bg-background p-2"><option value="">Conta Meta</option>{accountsQuery.data?.accounts.map(a => <option key={a.id} value={a.id}>{a.accountName || a.id}{a.isSelected ? " (selecionada)" : ""}</option>)}</select>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nome da regra" className="rounded border bg-background p-2" />
        <select value={scheduleMinutes} onChange={e => setSchedule(Number(e.target.value))} className="rounded border bg-background p-2"><option value={15}>A cada 15 min</option><option value={30}>A cada 30 min</option><option value={60}>A cada hora</option><option value={180}>A cada 3 h</option><option value={360}>A cada 6 h</option><option value={1440}>Diariamente</option></select>
        <select value={lookbackDays} onChange={e => setLookback(Number(e.target.value))} className="rounded border bg-background p-2"><option value={1}>Janela: 1 dia</option><option value={3}>Janela: 3 dias</option><option value={7}>Janela: 7 dias</option><option value={14}>Janela: 14 dias</option><option value={30}>Janela: 30 dias</option></select>
        <input type="number" min="0.01" step="0.01" value={maxCpa} onChange={e => setMaxCpa(e.target.value)} placeholder="CPA máximo" className="rounded border bg-background p-2" />
        <input type="number" min="0.01" step="0.01" value={minRoas} onChange={e => setMinRoas(e.target.value)} placeholder="ROAS mínimo" className="rounded border bg-background p-2" />
        <div className="flex gap-2"><input type="number" min="0" max="100" step="0.01" value={minCtr} onChange={e => setMinCtr(e.target.value)} placeholder="CTR mínimo %" className="min-w-0 rounded border bg-background p-2" /><Button type="submit">Salvar</Button></div>
      </form>
    </div>
    <div className="space-y-2">{rulesQuery.data?.rules.map(rule => <article key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border/40 p-3"><div><strong>{rule.name}</strong><p className="text-xs text-muted-foreground">{rule.enabled ? "Ativa" : "Pausada"} · a cada {rule.scheduleMinutes} min · última avaliação {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleString() : "pendente"}{rule.lastError ? " · erro na avaliação" : ""}</p></div><Button variant="outline" onClick={() => void post(`/api/paid-media/optimization-rules/${rule.id}/enable`, { enabled: !rule.enabled, confirm: true })}>{rule.enabled ? "Pausar" : "Ativar"}</Button></article>)}</div>
    <div className="space-y-2"><h3 className="font-semibold">Alertas</h3>{alertsQuery.data?.alerts.length ? alertsQuery.data.alerts.map(alert => <article key={alert.id} className="rounded border border-amber-500/30 p-3"><div className="flex justify-between gap-3"><strong>{alert.message}</strong>{!alert.readAt && <Button size="sm" variant="outline" onClick={() => void post(`/api/paid-media/optimization-alerts/${alert.id}/read`)}>Marcar como lido</Button>}</div><p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()} · leitura dos últimos {String(alert.metrics["since"] ?? "—")} a {String(alert.metrics["until"] ?? "—")}; métrica atual: {JSON.stringify({ spend: alert.metrics["spend"], conversions: alert.metrics["conversions"], cpa: alert.metrics["cpa"], roas: alert.metrics["roas"], ctr: alert.metrics["ctr"] })}</p></article>) : <p className="text-xs text-muted-foreground">Sem alertas.</p>}</div>
  </section>;
}
