import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useListCampaigns,
  useGetCreditsBalance,
  getListCampaignsQueryKey,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Rocket, Plus, Activity, AlertTriangle, ShieldCheck,
  Users, Building2, TrendingUp, CreditCard,
  UserCheck, UserX, Moon, Zap, ChevronRight, Wifi,
} from "lucide-react";

type DashMode = "launcher" | "agency" | "admin";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Intake", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando",
  awaiting_approval: "Aguardando Aprovação", approved: "Aprovado",
  executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};
const STATUS_CLASS: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-muted-foreground border-border bg-muted/20",
};

type SaasStatus = "novo" | "ativo_lancando" | "ativo" | "pausado" | "hibernado";
const SAAS_META: Record<SaasStatus, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  novo:          { label: "Novo",            color: "text-blue-400 border-blue-400/40 bg-blue-400/10",    icon: Zap,       desc: "Registrado há menos de 14 dias, sem campanha" },
  ativo_lancando:{ label: "Em Lançamento",   color: "text-success border-success/40 bg-success/10",       icon: Rocket,    desc: "Campanha executando ou ao vivo" },
  ativo:         { label: "Ativo",           color: "text-primary border-primary/40 bg-primary/10",       icon: UserCheck, desc: "Usa a plataforma, sem lançamento ativo" },
  pausado:       { label: "Pausado",         color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: UserX, desc: "Assinatura suspensa, não cancelou" },
  hibernado:     { label: "Hibernado",       color: "text-muted-foreground border-border/50 bg-muted/20", icon: Moon,      desc: "Paga mas não usa há mais de 14 dias" },
};

interface AgencyStatsData { totalClients: number; activeCampaigns: number; totalRevenue?: number }
interface AgencyClient    { id: string; clientName?: string; clientEmail: string; status: string }
interface AdminUser {
  workspaceId: string; workspaceName: string; userId: string; userName: string;
  email: string; planName: string; planSlug: string; saasStatus: string;
  totalCampaigns: number; creditsBalance: number; createdAt: string;
}
interface AdminOverview { total: number; byStatus: Record<string, number>; users: AdminUser[] }

function useAgencyStats(enabled: boolean) {
  return useQuery({
    queryKey: ["/api/agency/stats"] as const,
    enabled,
    queryFn: async (): Promise<AgencyStatsData> => {
      const res = await customFetch<Response>("/api/agency/stats");
      if (!res.ok) return { totalClients: 0, activeCampaigns: 0 };
      return res.json() as Promise<AgencyStatsData>;
    },
  });
}
function useAgencyClients(enabled: boolean) {
  return useQuery({
    queryKey: ["/api/agency/clients"] as const,
    enabled,
    queryFn: async (): Promise<{ clients: AgencyClient[] }> => {
      const res = await customFetch<Response>("/api/agency/clients");
      if (!res.ok) return { clients: [] };
      return res.json() as Promise<{ clients: AgencyClient[] }>;
    },
  });
}
function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["/api/admin/overview"] as const,
    enabled,
    queryFn: async (): Promise<AdminOverview> => {
      const res = await customFetch<Response>("/api/admin/overview");
      if (!res.ok) throw new Error("Acesso negado");
      return res.json() as Promise<AdminOverview>;
    },
  });
}

export default function Dashboard() {
  const { isAdmin, planSlug } = useAuth();

  // Determine which tabs this user may see
  const canSeeLauncher = isAdmin || planSlug === "solo" || planSlug === null;
  const canSeeAgency   = isAdmin || planSlug === "agency";
  const canSeeAdmin    = isAdmin;

  // Default mode: admin → launcher, agency-only → agency, solo → launcher
  const defaultMode: DashMode = canSeeAgency && !canSeeLauncher ? "agency" : "launcher";
  const [mode, setMode] = useState<DashMode>(defaultMode);

  // Sync when planSlug loads (async from /me)
  useEffect(() => {
    if (planSlug === null) return;           // still loading
    if (!isAdmin && planSlug === "agency") setMode("agency");
    else setMode("launcher");
  }, [planSlug, isAdmin]);

  const { data: campaignsData, isLoading: loadingCampaigns } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey(), enabled: mode === "launcher" },
  });
  const { data: creditsData, isLoading: loadingCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), enabled: mode === "launcher" },
  });
  const { data: agencyStats, isLoading: loadingAgencyStats } = useAgencyStats(mode === "agency");
  const { data: agencyClients, isLoading: loadingClients }   = useAgencyClients(mode === "agency");
  const { data: adminData, isLoading: loadingAdmin }         = useAdminOverview(mode === "admin" && isAdmin);

  const tabs: { id: DashMode; label: string; icon: React.ElementType }[] = [
    ...(canSeeLauncher ? [{ id: "launcher" as DashMode, label: "Eu — Lançador", icon: Rocket }] : []),
    ...(canSeeAgency   ? [{ id: "agency"   as DashMode, label: "Agência",        icon: Building2 }] : []),
    ...(canSeeAdmin    ? [{ id: "admin"    as DashMode, label: "Admin SaaS",      icon: ShieldCheck }] : []),
  ];

  // While plan is still loading (null) and user has token, show skeleton
  if (planSlug === null && !isAdmin) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-5">
          <Skeleton className="h-9 w-64 bg-muted/20" />
          <Skeleton className="h-4 w-48 bg-muted/20 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 bg-muted/20" />)}
        </div>
      </div>
    );
  }

  const roleBadge = isAdmin
    ? { label: "Owner · Admin SaaS", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" }
    : planSlug === "agency"
    ? { label: "Agência",            color: "text-success border-success/30 bg-success/10" }
    : { label: "Lançador",           color: "text-primary border-primary/30 bg-primary/10" };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
              Painel de Controle
            </h1>
            <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 border rounded-sm ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Central operacional NexOS
          </p>
        </div>
        {mode === "launcher" && (
          <Link href="/campaigns/new">
            <Button className="font-mono uppercase tracking-widest font-bold rounded-none gap-2 btn-weapon-primary px-5">
              <Plus className="h-4 w-4" />Nova Campanha
            </Button>
          </Link>
        )}
      </div>

      {/* ── Mode tabs — only render when user has more than 1 tab ── */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm w-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all rounded-sm
                  ${active
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ════════════════════ TAB: LANÇADOR ════════════════════ */}
      {mode === "launcher" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Campanhas Ativas" icon={<Activity className="h-4 w-4 text-primary" />} loading={loadingCampaigns} glow="primary">
              <span className="text-4xl font-mono font-bold text-foreground">
                {campaignsData?.campaigns?.filter((c) => c.status !== "completed").length ?? 0}
              </span>
            </StatCard>
            <StatCard label="Créditos de IA" icon={<CreditCard className="h-4 w-4 text-primary" />} loading={loadingCredits} glow="primary">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-mono font-bold text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                  {creditsData?.balance ?? 0}
                </span>
                {creditsData?.balance != null && creditsData.balance < 50 && (
                  <Badge variant="destructive" className="rounded-none font-mono text-[9px] uppercase tracking-widest animate-pulse-slow">Crítico</Badge>
                )}
              </div>
            </StatCard>
            <StatCard label="Status Global" icon={<Wifi className="h-4 w-4 text-success" />} glow="success">
              <div className="flex items-center gap-2 text-success font-mono font-bold text-2xl uppercase tracking-widest">
                Nominal<div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
            </StatCard>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">Minhas Campanhas</h2>
            <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/50 to-transparent pointer-events-none" />
              {loadingCampaigns ? (
                <div className="p-8 space-y-3">
                  <Skeleton className="h-14 w-full bg-muted/20" />
                  <Skeleton className="h-14 w-full bg-muted/20" />
                </div>
              ) : !campaignsData?.campaigns?.length ? (
                <EmptyState
                  icon={<AlertTriangle className="h-5 w-5 text-muted-foreground/50" />}
                  message="Nenhuma campanha criada ainda."
                  action={
                    <Link href="/campaigns/new">
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-wider btn-weapon-outline mt-3">
                        <Plus className="h-3.5 w-3.5 mr-2" />Criar primeira campanha
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-border/50">
                  {campaignsData.campaigns.map((c) => (
                    <div key={c.id} className="px-5 py-4 flex items-center justify-between table-row-glow group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-1.5 h-6 shrink-0 ${c.status === "live" ? "bg-success shadow-[0_0_8px_hsl(var(--success))]" : "bg-primary/50"}`} />
                        <div className="min-w-0">
                          <h3 className="font-bold font-mono text-sm group-hover:text-primary transition-colors truncate max-w-sm">{c.title}</h3>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground bg-background/50 px-2 py-0.5 border border-border/40">{c.type}</span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground bg-background/50 px-2 py-0.5 border border-border/40">{c.track}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <Badge variant="outline" className={`rounded-none font-mono text-[9px] tracking-widest uppercase px-3 py-1 ${STATUS_CLASS[c.status] ?? "text-primary border-primary/40 bg-primary/10"}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                        <Link href={`/campaigns/${c.id}`}>
                          <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-wider btn-weapon-outline h-8 px-3">
                            Acessar<ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ TAB: AGÊNCIA ════════════════════ */}
      {mode === "agency" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total de Clientes" icon={<Users className="h-4 w-4 text-primary" />} loading={loadingAgencyStats} glow="primary">
              <span className="text-4xl font-mono font-bold text-foreground">{agencyStats?.totalClients ?? 0}</span>
            </StatCard>
            <StatCard label="Lançamentos Ativos" icon={<Rocket className="h-4 w-4 text-success" />} loading={loadingAgencyStats} glow="success">
              <span className="text-4xl font-mono font-bold text-success drop-shadow-[0_0_10px_hsl(var(--success)/0.5)]">{agencyStats?.activeCampaigns ?? 0}</span>
            </StatCard>
            <StatCard label="Receita Gerida" icon={<TrendingUp className="h-4 w-4 text-primary" />} loading={loadingAgencyStats} glow="primary">
              <span className="text-2xl font-mono font-bold text-foreground">
                {agencyStats?.totalRevenue != null ? `R$ ${(agencyStats.totalRevenue / 100).toLocaleString("pt-BR")}` : "—"}
              </span>
            </StatCard>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">Clientes</h2>
            <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-success/50 to-transparent pointer-events-none" />
              {loadingClients ? (
                <div className="p-8 space-y-3">
                  <Skeleton className="h-14 w-full bg-muted/20" /><Skeleton className="h-14 w-full bg-muted/20" />
                </div>
              ) : !agencyClients?.clients?.length ? (
                <EmptyState
                  icon={<Users className="h-5 w-5 text-muted-foreground/50" />}
                  message="Nenhum cliente adicionado."
                  action={
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-wider btn-weapon-outline mt-3">
                      <Plus className="h-3.5 w-3.5 mr-2" />Convidar primeiro cliente
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border/50">
                  {agencyClients.clients.map((client) => (
                    <div key={client.id} className="px-5 py-4 flex items-center justify-between table-row-glow group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center">
                          <span className="text-xs font-mono font-bold text-primary">
                            {(client.clientName ?? client.clientEmail).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold font-mono text-sm group-hover:text-primary transition-colors truncate">
                            {client.clientName ?? client.clientEmail}
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{client.clientEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest px-3 py-1 ${
                          client.status === "active"  ? "text-success border-success/40 bg-success/10" :
                          client.status === "pending" ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" :
                          "text-muted-foreground border-border bg-muted/20"
                        }`}>
                          {client.status === "active" ? "Ativo" : client.status === "pending" ? "Pendente" : client.status}
                        </Badge>
                        <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-wider btn-weapon-outline h-8 px-3">
                          Ver<ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ TAB: ADMIN SAAS ════════════════════ */}
      {mode === "admin" && isAdmin && (
        <div className="space-y-6">
          {loadingAdmin ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 bg-muted/20" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(Object.entries(SAAS_META) as [SaasStatus, typeof SAAS_META[SaasStatus]][]).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div key={key} className="border border-border/50 bg-card/40 p-4 relative overflow-hidden group card-weapon">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{meta.label}</div>
                      <div className="flex items-end justify-between">
                        <span className="text-3xl font-mono font-bold text-foreground">{adminData?.byStatus?.[key] ?? 0}</span>
                        <Icon className={`h-5 w-5 opacity-70 ${
                          key === "ativo_lancando" ? "text-success" :
                          key === "novo"           ? "text-blue-400" :
                          key === "pausado"        ? "text-yellow-400" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 font-mono mt-2 leading-tight">{meta.desc}</div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
                  Todos os Usuários — {adminData?.total ?? 0} total
                </h2>
                <div className="border border-border/50 bg-card/40 overflow-hidden">
                  <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_110px] text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 border-b border-border/50 bg-muted/10 px-4 py-2 gap-4">
                    <span>Usuário</span>
                    <span className="text-right">Plano</span>
                    <span className="text-right">Camp.</span>
                    <span className="text-right">Créditos</span>
                    <span className="text-right">Status</span>
                  </div>
                  {!adminData?.users?.length ? (
                    <EmptyState icon={<Users className="h-5 w-5 text-muted-foreground/50" />} message="Nenhum usuário registrado." />
                  ) : (
                    <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
                      {adminData.users.map((u) => {
                        const meta = SAAS_META[u.saasStatus as SaasStatus];
                        return (
                          <div key={u.workspaceId} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_80px_80px_110px] items-center px-4 py-3 gap-4 table-row-glow group">
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{u.userName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</div>
                            </div>
                            <div className="hidden md:block text-right">
                              <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 border ${u.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                                {u.planSlug}
                              </span>
                            </div>
                            <div className="hidden md:block text-right font-mono text-sm text-foreground">{u.totalCampaigns}</div>
                            <div className="hidden md:block text-right font-mono text-sm text-foreground">{u.creditsBalance}</div>
                            <div className="text-right">
                              {meta && (
                                <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest px-2 py-1 ${meta.color}`}>
                                  {meta.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, icon, loading, glow, children }: {
  label: string; icon: React.ReactNode; loading?: boolean; glow?: "primary" | "success"; children?: React.ReactNode;
}) {
  const via = glow === "success" ? "via-success" : "via-primary";
  return (
    <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon relative overflow-hidden group">
      <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent ${via} to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24 bg-muted/20" /> : children}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-full border border-border/50 flex items-center justify-center mb-3 bg-muted/10 relative">
        <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-slow pointer-events-none" />
        {icon}
      </div>
      <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">{message}</p>
      {action}
    </div>
  );
}
