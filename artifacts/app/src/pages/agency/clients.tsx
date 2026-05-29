import { useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Users, Plus, Mail, CheckCircle2, XCircle, Loader2,
  ChevronRight, Clock, AlertTriangle, Copy, Building2,
  BarChart3, Activity, Eye, Trash2, Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgencyClient {
  id: string;
  clientEmail: string;
  clientName?: string;
  status: "pending" | "active" | "suspended" | "revoked";
  inviteToken?: string;
  inviteExpiresAt?: string;
  notes?: string;
  permissions: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AgencyStats {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  totalCampaigns: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:    "text-success border-success/40 bg-success/10",
  pending:   "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  suspended: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  revoked:   "text-destructive border-destructive/40 bg-destructive/10",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", pending: "Aguardando", suspended: "Suspenso", revoked: "Revogado",
};

const PERMISSION_LABELS: Record<string, string> = {
  canViewCampaigns:    "Ver Campanhas",
  canEditCampaigns:    "Editar Campanhas",
  canViewMetrics:      "Ver Métricas",
  canViewRevenue:      "Ver Receita",
  canExecuteCampaigns: "Executar Campanhas",
  canApproveContent:   "Aprovar Conteúdo",
  canManageSocial:     "Social Media",
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }: {
  onClose: () => void;
  onInvite: (data: { clientEmail: string; clientName?: string; notes?: string; permissions: Record<string, boolean> }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    canViewCampaigns: true,
    canViewMetrics: true,
    canEditCampaigns: false,
    canViewRevenue: false,
    canExecuteCampaigns: false,
    canApproveContent: false,
    canManageSocial: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) { toast.error("E-mail inválido"); return; }
    setLoading(true);
    try { onInvite({ clientEmail: email.trim(), clientName: name.trim() || undefined, notes: notes.trim() || undefined, permissions }); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-lg shadow-2xl">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">Convidar Cliente</h3>
            <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">Enviar convite de acesso à agência</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground font-mono text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">E-mail do Cliente *</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@empresa.com" type="email"
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Nome do Cliente</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva / Empresa X"
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Notas Internas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Contexto sobre este cliente..."
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30 resize-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Permissões de Acesso</label>
            <div className="space-y-1.5">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setPermissions(p => ({ ...p, [key]: !p[key] }))}
                    className={`w-4 h-4 border flex items-center justify-center transition-all shrink-0 ${permissions[key] ? "border-primary bg-primary/20" : "border-border/50 hover:border-primary/40"}`}>
                    {permissions[key] && <CheckCircle2 className="h-2.5 w-2.5 text-primary" />}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border/50 px-5 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Enviar Convite
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Client Detail Panel ──────────────────────────────────────────────────────

function ClientCard({ client, onUpdate, onRevoke, onCopyLink }: {
  client: AgencyClient;
  onUpdate: (id: string, patch: { status?: string }) => void;
  onRevoke: (id: string) => void;
  onCopyLink: (token: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/50 bg-card/40 relative overflow-hidden">
      <div className={`absolute left-0 inset-y-0 w-[2px] ${client.status === "active" ? "bg-success" : client.status === "pending" ? "bg-yellow-400" : "bg-muted/50"}`} />
      <div className="pl-4 pr-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 border border-border/50 bg-muted/20 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <div className="min-w-0">
              <div className="font-mono font-bold text-sm truncate">{client.clientName ?? client.clientEmail}</div>
              {client.clientName && <div className="text-xs font-mono text-muted-foreground/60 truncate">{client.clientEmail}</div>}
              <div className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                Convidado {new Date(client.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${STATUS_COLOR[client.status]}`}>
              {STATUS_LABEL[client.status]}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => setExpanded(e => !e)}
              className="rounded-sm h-7 w-7 hover:bg-muted/30">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {client.status === "pending" && client.inviteToken && (
            <Button size="sm" variant="outline" onClick={() => onCopyLink(client.inviteToken!)}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline">
              <Copy className="h-2.5 w-2.5" />Copiar Link Convite
            </Button>
          )}
          {client.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate(client.id, { status: "suspended" })}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-orange-400/30 text-orange-400 hover:bg-orange-400/10">
              Suspender
            </Button>
          )}
          {client.status === "suspended" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate(client.id, { status: "active" })}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-success/30 text-success hover:bg-success/10">
              Reativar
            </Button>
          )}
          {client.status !== "revoked" && (
            <Button size="sm" variant="ghost" onClick={() => onRevoke(client.id)}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 ml-auto">
              <Trash2 className="h-2.5 w-2.5" />Revogar
            </Button>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
            {client.notes && (
              <div className="bg-muted/10 border border-border/20 p-3">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Notas</div>
                <p className="font-mono text-xs text-muted-foreground/80">{client.notes}</p>
              </div>
            )}
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">Permissões</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <span key={key} className={`font-mono text-[11px] px-2 py-0.5 border ${client.permissions[key] ? "border-primary/30 text-primary bg-primary/10" : "border-border/30 text-muted-foreground/30"}`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {client.inviteExpiresAt && client.status === "pending" && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/50">
                <Clock className="h-2.5 w-2.5" />
                Convite expira em {new Date(client.inviteExpiresAt).toLocaleString("pt-BR")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgencyClientsPage() {
  const { planSlug } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ["/api/agency/stats"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/agency/stats");
      if (!res.ok) return null;
      return res.json() as Promise<AgencyStats>;
    },
  });

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ["/api/agency/clients", filterStatus],
    queryFn: async () => {
      const qs = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await customFetch<Response>(`/api/agency/clients${qs}`);
      if (!res.ok) return { clients: [] };
      return res.json() as Promise<{ clients: AgencyClient[] }>;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { clientEmail: string; clientName?: string; notes?: string; permissions: Record<string, boolean> }) => {
      const res = await customFetch<Response>("/api/agency/clients/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao convidar");
      }
      return res.json() as Promise<{ client: AgencyClient; inviteUrl: string }>;
    },
    onSuccess: (data) => {
      toast.success(`Convite enviado para ${data.client.clientEmail}`);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/stats"] });
      setShowInvite(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await customFetch<Response>(`/api/agency/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cliente atualizado.");
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
    },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await customFetch<Response>(`/api/agency/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao revogar");
    },
    onSuccess: () => {
      toast.success("Acesso revogado.");
      queryClient.invalidateQueries({ queryKey: ["/api/agency/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/stats"] });
    },
    onError: () => toast.error("Erro ao revogar cliente"),
  });

  const copyInviteLink = (token: string) => {
    const appUrl = window.location.origin;
    const link = `${appUrl}/api/agency/accept?token=${token}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Link de convite copiado!"));
  };

  const clients = clientsData?.clients ?? [];

  if (planSlug && planSlug !== "agency") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-border/50 pb-5">
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Clientes da Agência</h1>
        </div>
        <div className="border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
          <Shield className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
          <h2 className="font-mono font-bold text-base uppercase tracking-wide text-yellow-400 mb-2">Funcionalidade Exclusiva — Plano Agency</h2>
          <p className="font-mono text-sm text-muted-foreground/70 mb-6 max-w-md mx-auto">
            Gerencie múltiplos clientes, delegue acesso e acompanhe as campanhas de cada um em um só lugar. Disponível no Plano Agency.
          </p>
          <Link href="/settings">
            <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
              Ver Planos<ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={(data) => inviteMutation.mutate(data)}
        />
      )}

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Clientes da Agência</h1>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Gerencie clientes, delegue acesso e acompanhe campanhas
            </p>
          </div>
          <Button onClick={() => setShowInvite(true)}
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 shrink-0">
            <Plus className="h-3.5 w-3.5" />Convidar Cliente
          </Button>
        </div>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Clientes",  value: statsData.totalClients,    icon: Users,    color: "text-primary" },
            { label: "Ativos",          value: statsData.activeClients,   icon: Activity, color: "text-success" },
            { label: "Pendentes",       value: statsData.pendingClients,  icon: Clock,    color: "text-yellow-400" },
            { label: "Campanhas Total", value: statsData.totalCampaigns,  icon: BarChart3, color: "text-cyan-400" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border border-border/50 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{s.label}</span>
                </div>
                <div className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border/40 overflow-x-auto">
        {[
          { id: "all", label: "Todos" },
          { id: "active", label: "Ativos" },
          { id: "pending", label: "Pendentes" },
          { id: "suspended", label: "Suspensos" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterStatus(f.id)}
            className={`px-4 py-2.5 text-xs font-mono uppercase tracking-widest transition-all border-b-2 whitespace-nowrap
              ${filterStatus === f.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
      ) : clients.length === 0 ? (
        <div className="border border-border/30 bg-card/30 py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {filterStatus === "all" ? "Nenhum cliente ainda" : `Nenhum cliente ${STATUS_LABEL[filterStatus] ?? filterStatus}`}
          </p>
          <p className="font-mono text-xs text-muted-foreground/40 mb-4">
            Convide clientes para gerenciar suas campanhas com a NexOS
          </p>
          <Button onClick={() => setShowInvite(true)}
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            <Plus className="h-3.5 w-3.5" />Convidar Primeiro Cliente
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
              onRevoke={(id) => revokeMutation.mutate(id)}
              onCopyLink={copyInviteLink}
            />
          ))}
        </div>
      )}
    </div>
  );
}
