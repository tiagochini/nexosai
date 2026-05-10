import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Users, Rocket, UserCheck, UserX, Moon, Zap,
  Activity, TrendingUp, CreditCard, AlertTriangle, ArrowLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SaasStatus = "novo" | "ativo_lancando" | "ativo" | "pausado" | "hibernado";

interface AdminUser {
  workspaceId: string; workspaceName: string; userId: string; userName: string;
  email: string; planName: string; planSlug: string; saasStatus: string;
  totalCampaigns: number; creditsBalance: number; createdAt: string;
}
interface AdminOverview {
  total: number;
  byStatus: Record<string, number>;
  users: AdminUser[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SAAS_META: Record<SaasStatus, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  novo:          { label: "Novo",      color: "text-blue-400 border-blue-400/40 bg-blue-400/10",       icon: Zap,       desc: "Registrado há menos de 14 dias, sem campanha" },
  ativo_lancando:{ label: "Lançando",  color: "text-success border-success/40 bg-success/10",          icon: Rocket,    desc: "Campanha executando ou ao vivo" },
  ativo:         { label: "Ativo",     color: "text-primary border-primary/40 bg-primary/10",          icon: UserCheck, desc: "Usa a plataforma regularmente" },
  pausado:       { label: "Pausado",   color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: UserX,     desc: "Assinatura suspensa, não cancelou" },
  hibernado:     { label: "Hibernado", color: "text-muted-foreground border-border/50 bg-muted/20",    icon: Moon,      desc: "Paga mas não usa há mais de 14 dias" },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/overview"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminOverview> => {
      const res = await customFetch<Response>("/api/admin/overview");
      if (!res.ok) throw new Error("Acesso negado");
      return res.json() as Promise<AdminOverview>;
    },
  });

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-destructive/50 mx-auto" />
        <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-destructive/70">
          Acesso Restrito
        </h2>
        <p className="font-mono text-sm text-muted-foreground/60">Esta área é exclusiva para administradores da plataforma.</p>
        <Link href="/">
          <Button variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="h-5 w-5 text-yellow-400" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
            Admin SaaS · NexOS AI
          </h1>
          <Badge variant="outline" className="rounded-none font-mono text-[9px] border-yellow-400/30 text-yellow-400 bg-yellow-400/10">
            Owner
          </Badge>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
          Visão geral da plataforma · {data?.total ?? 0} usuários registrados
        </p>
      </div>

      {/* SaaS Status Distribution */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 bg-muted/20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(Object.entries(SAAS_META) as [SaasStatus, typeof SAAS_META[SaasStatus]][]).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <div key={key} className="border border-border/50 bg-card/40 p-4 relative overflow-hidden card-weapon group">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{meta.label}</div>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-mono font-bold text-foreground">{data?.byStatus?.[key] ?? 0}</span>
                  <Icon className={`h-5 w-5 opacity-70 ${
                    key === "ativo_lancando" ? "text-success" :
                    key === "novo"           ? "text-blue-400" :
                    key === "pausado"        ? "text-yellow-400" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="text-[9px] text-muted-foreground/50 font-mono mt-2 leading-tight">{meta.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Platform Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Usuários",     value: data?.total ?? 0,                                          icon: Users,     color: "text-primary" },
          { label: "Lançando Agora",     value: data?.byStatus?.["ativo_lancando"] ?? 0,                  icon: Rocket,    color: "text-success" },
          { label: "Usuários Ativos",    value: (data?.byStatus?.["ativo"] ?? 0) + (data?.byStatus?.["ativo_lancando"] ?? 0), icon: Activity,   color: "text-cyan-400" },
          { label: "Hibernados",         value: data?.byStatus?.["hibernado"] ?? 0,                        icon: Moon,      color: "text-muted-foreground" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="border border-border/50 bg-card/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">{s.label}</span>
              </div>
              <div className={`font-mono font-bold text-2xl ${s.color}`}>
                {isLoading ? <Skeleton className="h-7 w-12 bg-muted/20" /> : s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-mono uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Todos os Usuários — {data?.total ?? 0} registros
          </h2>
        </div>

        <div className="border border-border/50 bg-card/40 overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_90px_70px_80px_120px] text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b border-border/50 bg-muted/10 px-5 py-2.5 gap-4">
            <span>Usuário / Workspace</span>
            <span className="text-right">Plano</span>
            <span className="text-right">Camp.</span>
            <span className="text-right">Créditos</span>
            <span className="text-right">Status SaaS</span>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}
            </div>
          ) : !data?.users?.length ? (
            <div className="py-16 text-center">
              <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Nenhum usuário registrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
              {data.users.map((u) => {
                const meta = SAAS_META[u.saasStatus as SaasStatus];
                const Icon = meta?.icon ?? Activity;
                return (
                  <div
                    key={u.workspaceId}
                    className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_70px_80px_120px] items-center px-5 py-3.5 gap-4 hover:bg-muted/5 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {u.userName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate flex items-center gap-2">
                        <span>{u.email}</span>
                        {u.workspaceName && (
                          <><span className="text-muted-foreground/30">·</span>
                          <span className="text-muted-foreground/50">{u.workspaceName}</span></>
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
                        Criado {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>

                    <div className="hidden md:flex justify-end">
                      <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 border ${u.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                        {u.planSlug}
                      </span>
                    </div>

                    <div className="hidden md:block text-right font-mono text-sm text-foreground/80">
                      {u.totalCampaigns}
                    </div>

                    <div className="hidden md:block text-right font-mono text-sm text-foreground/80">
                      {(u.creditsBalance ?? 0).toLocaleString("pt-BR")}
                    </div>

                    <div className="flex justify-end items-center gap-1.5">
                      {meta && (
                        <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 ${meta.color}`}>
                          <Icon className="h-2.5 w-2.5 mr-1 shrink-0" />
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
    </div>
  );
}
