import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldCheck, Users, Rocket, UserCheck, UserX, Moon, Zap,
  Activity, TrendingUp, CreditCard, AlertTriangle, ArrowLeft,
  DollarSign, BarChart3, Bot, Target, TrendingDown, Clock,
  RefreshCw, CheckCircle2, ArrowUpRight, Percent,
  QrCode, FileText, CheckCheck, Filter, Wallet, Shield,
  X, Phone, Mail, Calendar, Tag, Layers, ChevronRight, Copy, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminPaymentRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  userName: string;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  description: string | null;
  externalId: string | null;
  pixData?: { copiaECola?: string; qrCode?: string; instructions?: string } | null;
  boletoData?: { barcode?: string; barcodeUrl?: string; dueDate?: string; instructions?: string } | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  metadata: unknown;
}

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
interface AdminFinancials {
  accessRevenueCentsBrl: number;
  accessRevenuePaid: number;
  packRevenueCentsBrl: number;
  packSalesCount: number;
  totalRevenueCentsBrl: number;
  totalAiCostUsd: number;
  totalAiCostBrl: number;
  totalAiCallsCount: number;
  marginBrl: number;
  marginPct: number;
  totalRegistered: number;
  totalPaid: number;
  conversionRate: number;
  last7dRevenueCents: number;
  last30dRevenueCents: number;
  last7dSignups: number;
  last30dSignups: number;
  lowCreditWorkspaces: { workspaceId: string; workspaceName: string; email: string; balance: number }[];
  recentPayments: { id: string; email: string; planName: string; amountCents: number; paidAt: string | null; createdAt: string }[];
}

// ── User Profile types ────────────────────────────────────────────────────────
interface UserProfile {
  user: {
    userId: string; name: string; email: string; phone: string | null;
    createdAt: string; workspaceId: string; workspaceName: string;
    workspaceStatus: string; planName: string | null; planSlug: string | null;
    creditsBalance: number; activeCampaigns: number;
  };
  leadSource: { code: string; planSlug: string; usedAt: string | null } | null;
  payments: { id: string; amountCents: number; currency: string; method: string; status: string; description: string | null; createdAt: string; paidAt: string | null }[];
  campaigns: { id: string; name: string; type: string; status: string; track: string | null; createdAt: string }[];
  creditStats: { totalDebited: number; totalCredited: number; txCount: number };
  recentCredits: { id: string; type: string; amount: number; action: string; createdAt: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SAAS_META: Record<SaasStatus, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  novo:          { label: "Novo",      color: "text-blue-400 border-blue-400/40 bg-blue-400/10",       icon: Zap,       desc: "Registrado há menos de 14 dias" },
  ativo_lancando:{ label: "Lançando",  color: "text-success border-success/40 bg-success/10",          icon: Rocket,    desc: "Campanha executando ou ao vivo" },
  ativo:         { label: "Ativo",     color: "text-primary border-primary/40 bg-primary/10",          icon: UserCheck, desc: "Usa regularmente" },
  pausado:       { label: "Pausado",   color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: UserX,     desc: "Workspace suspenso" },
  hibernado:     { label: "Hibernado", color: "text-muted-foreground border-border/50 bg-muted/20",    icon: Moon,      desc: "Paga mas não usa há 14d+" },
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, color = "text-primary", border = "border-border/50",
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color?: string; border?: string;
}) {
  return (
    <div className={`border ${border} bg-card/40 p-4 relative overflow-hidden`}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current/20 pointer-events-none" />
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      </div>
      <div className={`font-mono font-bold text-2xl ${color}`}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">{sub}</div>}
    </div>
  );
}

// ─── User Profile Drawer ──────────────────────────────────────────────────────
function UserProfileDrawer({ userId, onClose, onGrant }: { userId: string; onClose: () => void; onGrant: (workspaceId: string, userName: string, planSlug: string) => void }) {
  const [tab, setTab] = useState<"perfil" | "campanhas" | "pagamentos" | "creditos">("perfil");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/users", userId],
    queryFn: () => customFetch<UserProfile>(`/api/admin/users/${userId}`),
    enabled: !!userId,
  });

  const p = data;
  const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
    draft: "text-muted-foreground", analyzing: "text-blue-400", strategy_ready: "text-cyan-400",
    generating: "text-yellow-400", awaiting_approval: "text-orange-400", approved: "text-primary",
    executing: "text-success", live: "text-success", completed: "text-muted-foreground/50", cancelled: "text-destructive/60",
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-auto w-full max-w-xl h-full bg-[#0a0a0f] border-l border-border/50 flex flex-col overflow-hidden shadow-2xl"
        style={{ animation: "slideInRight 0.2s ease" }}>

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border/40 shrink-0">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-6 w-48 bg-muted/20" /><Skeleton className="h-4 w-64 bg-muted/20" /></div>
            ) : p ? (
              <>
                <div className="font-mono text-lg font-bold text-foreground truncate">{p.user.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border ${p.user.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                    {p.user.planSlug ?? "—"}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground/50">{p.user.workspaceName}</span>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {p && (
              <button
                onClick={() => onGrant(p.user.workspaceId, p.user.name, p.user.planSlug ?? "solo")}
                className="font-mono text-[11px] uppercase tracking-widest border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary px-3 py-1.5 transition-colors"
              >
                🎟 Liberar Acesso
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40 shrink-0">
          {(["perfil", "campanhas", "pagamentos", "creditos"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 font-mono text-[11px] uppercase tracking-widest py-3 transition-colors border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "perfil" ? "Perfil" : t === "campanhas" ? "Campanhas" : t === "pagamentos" ? "Pagamentos" : "Créditos"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
          ) : !p ? (
            <p className="font-mono text-sm text-muted-foreground/50 text-center py-10">Erro ao carregar.</p>
          ) : tab === "perfil" ? (
            <>
              {/* Contact */}
              <div className="border border-border/40 bg-card/20 p-4 space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-3">Contato</div>
                {[
                  { icon: Mail, label: "Email", value: p.user.email },
                  { icon: Phone, label: "Telefone", value: p.user.phone ?? "Não informado" },
                  { icon: Calendar, label: "Cadastro", value: fmtDate(p.user.createdAt) },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <row.icon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">{row.label}</span>
                    <span className="font-mono text-sm text-foreground truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Lead source */}
              <div className="border border-border/40 bg-card/20 p-4">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-3">🔗 Origem do Lead</div>
                {p.leadSource ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Tag className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">Código</span>
                      <span className="font-mono text-sm text-primary font-bold">{p.leadSource.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">Plano</span>
                      <span className="font-mono text-sm text-foreground uppercase">{p.leadSource.planSlug}</span>
                    </div>
                    {p.leadSource.usedAt && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">Usado em</span>
                        <span className="font-mono text-sm text-foreground">{fmtDate(p.leadSource.usedAt)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-muted-foreground/40">Cadastro orgânico — sem código de convite</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Créditos", value: (p.user.creditsBalance ?? 0).toLocaleString("pt-BR"), color: p.user.creditsBalance < 150 ? "text-yellow-400" : "text-foreground" },
                  { label: "Campanhas", value: String(p.campaigns.length), color: "text-foreground" },
                  { label: "Pagamentos", value: String(p.payments.filter(x => x.status === "paid").length), color: "text-success" },
                ].map(s => (
                  <div key={s.label} className="border border-border/40 bg-card/20 p-3 text-center">
                    <div className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : tab === "campanhas" ? (
            p.campaigns.length === 0 ? (
              <div className="py-12 text-center">
                <Target className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40">Nenhuma campanha ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {p.campaigns.map(c => (
                  <div key={c.id} className="border border-border/40 bg-card/20 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-foreground truncate">{c.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5 flex items-center gap-2">
                          <span className="uppercase">{c.type}</span>
                          {c.track && <><span className="text-muted-foreground/30">·</span><span>{c.track}</span></>}
                          <span className="text-muted-foreground/30">·</span>
                          <span>{fmtDate(c.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`font-mono text-[11px] uppercase shrink-0 ${CAMPAIGN_STATUS_COLOR[c.status] ?? "text-muted-foreground"}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "pagamentos" ? (
            p.payments.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40">Nenhum pagamento registrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {p.payments.map(pay => (
                  <div key={pay.id} className="border border-border/40 bg-card/20 p-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-foreground">{fmtBRL(pay.amountCents)}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">
                        {pay.method.toUpperCase()} · {fmtDate(pay.createdAt)}
                        {pay.description && <> · {pay.description}</>}
                      </div>
                    </div>
                    <span className={`font-mono text-[11px] uppercase tracking-widest shrink-0 px-2 py-0.5 border ${pay.status === "paid" ? "text-success border-success/30 bg-success/10" : pay.status === "pending" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" : "text-muted-foreground border-border/30"}`}>
                      {pay.status === "paid" ? "Pago" : pay.status === "pending" ? "Pendente" : pay.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* credits tab */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border/40 bg-card/20 p-4 text-center">
                  <div className="font-mono text-xl font-bold text-primary">{p.creditStats.totalCredited.toLocaleString("pt-BR")}</div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">Total Recebido</div>
                </div>
                <div className="border border-border/40 bg-card/20 p-4 text-center">
                  <div className="font-mono text-xl font-bold text-orange-400">{p.creditStats.totalDebited.toLocaleString("pt-BR")}</div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">Total Consumido</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">Últimas Transações</div>
                {p.recentCredits.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/40 text-center py-6">Sem movimentações.</p>
                ) : p.recentCredits.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between border border-border/30 bg-card/10 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-foreground/80 truncate">{tx.action}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/40">{fmtDate(tx.createdAt)}</div>
                    </div>
                    <span className={`font-mono text-sm font-bold shrink-0 ml-3 ${tx.type === "credit" ? "text-success" : "text-orange-400"}`}>
                      {tx.type === "credit" ? "+" : "−"}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const METHOD_LABEL: Record<string, { label: string; icon: React.ElementType }> = {
  pix:           { label: "PIX",         icon: QrCode },
  boleto:        { label: "Boleto",      icon: FileText },
  bank_transfer: { label: "TED",         icon: Wallet },
  credit_card:   { label: "Cartão",      icon: CreditCard },
  manual:        { label: "Manual",      icon: CheckCheck },
};

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendente",   cls: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  processing: { label: "Processando",cls: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  paid:       { label: "Pago",       cls: "text-success border-success/40 bg-success/10" },
  failed:     { label: "Falhou",     cls: "text-destructive border-destructive/40 bg-destructive/10" },
  cancelled:  { label: "Cancelado",  cls: "text-muted-foreground border-border bg-muted/20" },
  expired:    { label: "Expirado",   cls: "text-muted-foreground border-border bg-muted/20" },
};

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "financials" | "users" | "upsell" | "pagamentos" | "convites" | "solicitacoes" | "rastreamento">("pagamentos");
  const [fpSearch, setFpSearch] = useState("");
  const [fpResult, setFpResult] = useState<null | { found: boolean; record?: { fingerprint: string; userName: string; userEmail: string; userId: string; workspaceName: string; workspaceId: string; campaignId: string; campaignTitle: string | null; track: string | null; generatedAt: string; ipAddress: string | null; userAgent: string | null } }>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const [payFilter, setPayFilter] = useState<"all" | "pending" | "paid">("pending");
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["/api/admin/overview"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminOverview> => {
      const data = await customFetch<AdminOverview>("/api/admin/overview");
      return data;
    },
  });

  const { data: financials, isLoading: loadingFin } = useQuery({
    queryKey: ["/api/admin/financials"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminFinancials> => {
      const data = await customFetch<AdminFinancials>("/api/admin/financials");
      return data;
    },
  });

  const { data: paymentsData, isLoading: loadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["/api/admin/payments", payFilter],
    enabled: isAdmin,
    refetchInterval: tab === "pagamentos" ? 15000 : false,
    queryFn: async () => {
      const qs = payFilter !== "all" ? `?status=${payFilter}` : "";
      const data = await customFetch<{ payments: AdminPaymentRow[] }>(`/api/admin/payments${qs}`);
      return data.payments;
    },
  });

  interface InviteCode {
    id: string; code: string; planSlug: string; label: string | null;
    used: boolean; usedByEmail: string | null; usedByName: string | null; usedAt: string | null; createdAt: string;
  }

  const { data: inviteCodes, isLoading: loadingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["/api/admin/invite-codes"],
    enabled: isAdmin && tab === "convites",
    queryFn: async (): Promise<InviteCode[]> => {
      const data = await customFetch<{ codes: InviteCode[] }>("/api/admin/invite-codes");
      return data.codes;
    },
  });

  interface WaitlistEntry {
    id: string; name: string; whatsapp: string; email: string | null;
    segment: string; source: string | null; notified: boolean;
    confirmedAt: string | null; createdAt: string;
  }

  const { data: waitlistData, isLoading: loadingWaitlist, refetch: refetchWaitlist } = useQuery({
    queryKey: ["/api/admin/waitlist"],
    enabled: isAdmin && tab === "solicitacoes",
    queryFn: async () => {
      const data = await customFetch<{ entries: WaitlistEntry[]; total: number }>("/api/admin/waitlist");
      return data;
    },
  });

  const [approveCodeResult, setApproveCodeResult] = useState<Record<string, string>>({});
  const [approveLoading, setApproveLoading] = useState<string | null>(null);

  const approveWaitlistEntry = async (id: string, planSlug: string) => {
    setApproveLoading(id);
    try {
      const data = await customFetch<{ code: string }>(`/api/admin/waitlist/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      setApproveCodeResult(prev => ({ ...prev, [id]: data.code }));
      toast.success(`Código gerado: ${data.code}`);
      void refetchWaitlist();
    } catch {
      toast.error("Erro ao aprovar solicitação");
    } finally {
      setApproveLoading(null);
    }
  };

  const deleteWaitlistEntry = async (id: string) => {
    try {
      await customFetch(`/api/admin/waitlist/${id}`, { method: "DELETE" });
      toast.success("Solicitação removida");
      void refetchWaitlist();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const generateInvitesMutation = useMutation({
    mutationFn: async ({ count, planSlug }: { count: number; planSlug: string }) => {
      return customFetch<{ codes: InviteCode[] }>("/api/admin/invite-codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, planSlug }),
      });
    },
    onSuccess: () => {
      toast.success("Códigos gerados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao gerar códigos"),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      return customFetch<{ ok: boolean }>(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Código removido.");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao remover código"),
  });

  const [grantTarget, setGrantTarget] = useState<{ workspaceId: string; userName: string; currentPlan: string } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [grantPlan, setGrantPlan] = useState<"solo" | "agency">("solo");
  const [grantNote, setGrantNote] = useState("");

  const grantPlanMutation = useMutation({
    mutationFn: async ({ workspaceId, planSlug, note }: { workspaceId: string; planSlug: string; note: string }) => {
      return customFetch<{ ok: boolean; planName: string }>(`/api/admin/workspaces/${workspaceId}/grant-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, note }),
      });
    },
    onSuccess: (data) => {
      toast.success(`Acesso ${data.planName} liberado com sucesso!`);
      setGrantTarget(null);
      setGrantNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao liberar acesso"),
  });

  const confirmMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const data = await customFetch<{ message: string }>(`/api/admin/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: `Confirmado manualmente via admin` }),
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Pagamento confirmado!");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao confirmar pagamento.");
    },
  });

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-destructive/50 mx-auto" />
        <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-destructive/70">Acesso Restrito</h2>
        <p className="font-mono text-sm text-muted-foreground/60">Esta área é exclusiva para administradores.</p>
        <Button asChild variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2"><Link href="/"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Link></Button>
      </div>
    );
  }

  const fin = financials;
  const ov  = overview;

  const TABS = [
    { id: "pagamentos" as const,   label: "Pagamentos" },
    { id: "overview" as const,     label: "Visão Geral" },
    { id: "financials" as const,   label: "Financeiro" },
    { id: "upsell" as const,       label: "Oportunidades" },
    { id: "users" as const,        label: "Usuários" },
    { id: "convites" as const,     label: "🎟️ Convites" },
    { id: "solicitacoes" as const, label: "📋 Solicitações" },
    { id: "rastreamento" as const, label: "🔍 Rastreamento" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="h-5 w-5 text-yellow-400" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
              Command Center · NexOS
            </h1>
            <Badge variant="outline" className="rounded-none font-mono text-[11px] border-yellow-400/30 text-yellow-400 bg-yellow-400/10">
              Owner
            </Badge>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {ov?.total ?? 0} usuários registrados · {ov?.byStatus?.["ativo_lancando"] ?? 0} lançando agora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/audit-logs">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0"
            >
              <Shield className="h-3 w-3" />Audit Logs
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3 w-3" />Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border/40">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`font-mono text-[11px] uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors
              ${tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* KPI row */}
          {loadingFin ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Receita Total" icon={DollarSign}
                value={fmtBRL(fin?.totalRevenueCentsBrl ?? 0)}
                sub={`+${fmtBRL(fin?.last7dRevenueCents ?? 0)} esta semana`}
                color="text-success" border="border-success/20"
              />
              <MetricCard
                label="Margem Bruta" icon={Percent}
                value={`${(fin?.marginPct ?? 0).toFixed(1)}%`}
                sub={`Margem: ${fmtBRL(fin?.marginBrl ?? 0)}`}
                color="text-primary"
              />
              <MetricCard
                label="Conversão" icon={Target}
                value={`${(fin?.conversionRate ?? 0).toFixed(1)}%`}
                sub={`${fin?.totalPaid ?? 0} pagaram de ${fin?.totalRegistered ?? 0}`}
                color="text-cyan-400"
              />
              <MetricCard
                label="Lançando Agora" icon={Rocket}
                value={String(ov?.byStatus?.["ativo_lancando"] ?? 0)}
                sub="campanhas executing/live"
                color="text-yellow-400"
              />
            </div>
          )}

          {/* SaaS Status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(SAAS_META) as [SaasStatus, typeof SAAS_META[SaasStatus]][]).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={key} className="border border-border/50 bg-card/40 p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
                  <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{meta.label}</div>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-mono font-bold text-foreground">
                      {loadingOverview ? <Skeleton className="h-7 w-10 bg-muted/20" /> : (ov?.byStatus?.[key] ?? 0)}
                    </span>
                    <Icon className={`h-5 w-5 opacity-60 ${meta.color.split(" ")[0]}`} />
                  </div>
                  <div className="text-[11px] text-muted-foreground/40 font-mono mt-2 leading-tight">{meta.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Growth metrics */}
          {loadingFin ? (
            <Skeleton className="h-20 bg-muted/20" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Novos 7 dias",   value: fin?.last7dSignups  ?? 0, icon: Users,        color: "text-primary" },
                { label: "Novos 30 dias",  value: fin?.last30dSignups ?? 0, icon: TrendingUp,   color: "text-cyan-400" },
                { label: "Acessos Pagos",  value: fin?.accessRevenuePaid ?? 0, icon: CheckCircle2, color: "text-success" },
                { label: "Packs Vendidos", value: fin?.packSalesCount ?? 0, icon: Zap,          color: "text-yellow-400" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="border border-border/40 bg-card/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
                    </div>
                    <div className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── FINANCIALS TAB ── */}
      {tab === "financials" && (
        <div className="space-y-5">
          {loadingFin ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-muted/20" />)}</div>
          ) : (
            <>
              {/* Revenue breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-success/20 bg-success/5 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-success/60 mb-2">Receita de Acessos</div>
                  <div className="font-mono text-3xl font-black text-success">{fmtBRL(fin?.accessRevenueCentsBrl ?? 0)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">{fin?.accessRevenuePaid ?? 0} acessos pagos</div>
                </div>
                <div className="border border-primary/20 bg-primary/5 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60 mb-2">Receita de Packs</div>
                  <div className="font-mono text-3xl font-black text-primary">{fmtBRL(fin?.packRevenueCentsBrl ?? 0)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">{fin?.packSalesCount ?? 0} packs vendidos</div>
                </div>
                <div className="border border-cyan-400/20 bg-cyan-400/5 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400/60 mb-2">Custo do agente</div>
                  <div className="font-mono text-3xl font-black text-cyan-400">
                    {fmtBRL(fin?.totalAiCostBrl ?? 0)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">
                    ${(fin?.totalAiCostUsd ?? 0).toFixed(2)} USD · {(fin?.totalAiCallsCount ?? 0).toLocaleString("pt-BR")} calls
                  </div>
                </div>
              </div>

              {/* Margin bar */}
              <div className="border border-border/50 bg-card/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Margem Bruta</div>
                  <div className="font-mono text-xl font-black text-success">{(fin?.marginPct ?? 0).toFixed(1)}%</div>
                </div>
                <div className="h-3 bg-muted/30 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-success transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, fin?.marginPct ?? 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 font-mono text-[11px] text-muted-foreground/50">
                  <span>Receita: {fmtBRL(fin?.totalRevenueCentsBrl ?? 0)}</span>
                  <span>Margem: {fmtBRL(fin?.marginBrl ?? 0)}</span>
                </div>
              </div>

              {/* Conversion funnel */}
              <div className="border border-border/50 bg-card/40 p-5">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-4">Funil de Conversão</div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Registrados", value: fin?.totalRegistered ?? 0, pct: 100, color: "bg-muted/40" },
                    { label: "Pagaram",     value: fin?.totalPaid ?? 0, pct: fin?.conversionRate ?? 0, color: "bg-primary" },
                    { label: "Lançando",    value: ov?.byStatus?.["ativo_lancando"] ?? 0, pct: fin?.totalRegistered ? ((ov?.byStatus?.["ativo_lancando"] ?? 0) / fin.totalRegistered * 100) : 0, color: "bg-success" },
                  ].map(f => (
                    <div key={f.label} className="text-center">
                      <div className="font-mono text-3xl font-bold text-foreground mb-1">{f.value}</div>
                      <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-2">{f.label}</div>
                      <div className="h-1.5 bg-muted/20 overflow-hidden">
                        <div className={`h-full ${f.color} transition-all`} style={{ width: `${Math.min(100, f.pct)}%` }} />
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground/40 mt-1">{f.pct.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent payments */}
              <div className="border border-border/50 bg-card/40 overflow-hidden">
                <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Últimos Pagamentos</span>
                </div>
                {!fin?.recentPayments?.length ? (
                  <div className="py-10 text-center font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">Nenhum pagamento registrado</div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {fin.recentPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/5">
                        <div>
                          <div className="font-mono text-xs font-bold">{p.email}</div>
                          <div className="font-mono text-[11px] text-muted-foreground/50">
                            Plano {p.planName} · {fmtDate(p.createdAt)}
                            {p.paidAt && ` · Pago ${fmtDate(p.paidAt)}`}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-success">{fmtBRL(p.amountCents)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── UPSELL / OPPORTUNITIES TAB ── */}
      {tab === "upsell" && (
        <div className="space-y-5">
          <div className="border border-yellow-400/20 bg-yellow-400/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
              <span className="font-mono text-xs uppercase tracking-widest text-yellow-400 font-bold">Oportunidades de Upsell</span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/60">
              Usuários com menos de 150 créditos — prestes a precisar de um pack. Momento ideal para contato ativo.
            </p>
          </div>

          {loadingFin ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}</div>
          ) : !fin?.lowCreditWorkspaces?.length ? (
            <div className="py-12 text-center border border-border/30">
              <CheckCircle2 className="h-8 w-8 text-success/30 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">Nenhum usuário com créditos baixos no momento</p>
            </div>
          ) : (
            <div className="border border-border/50 bg-card/40 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_120px] text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b border-border/40 bg-muted/10 px-5 py-2.5 gap-4">
                <span>Usuário</span>
                <span className="text-right">Workspace</span>
                <span className="text-right">Créditos</span>
                <span className="text-right">Ação</span>
              </div>
              <div className="divide-y divide-border/30">
                {fin.lowCreditWorkspaces.map(u => (
                  <div key={u.workspaceId} className="grid grid-cols-[1fr_100px_80px_120px] items-center px-5 py-3.5 gap-4 hover:bg-muted/5">
                    <div>
                      <div className="font-mono text-xs font-bold">{u.email}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted-foreground/60 truncate">{u.workspaceName}</div>
                    <div className="text-right">
                      <span className={`font-mono text-sm font-bold ${u.balance < 50 ? "text-destructive" : "text-yellow-400"}`}>
                        {u.balance}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <a href={`mailto:${u.email}?subject=Seus créditos NexOS estão acabando&body=Oi! Notei que você está com apenas ${u.balance} créditos. Posso ajudar com uma recarga?`}>
                        <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-[10px] tracking-widest btn-weapon-outline h-7 gap-1">
                          <ArrowUpRight className="h-2.5 w-2.5" />Contatar
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hibernated users — re-engagement opportunity */}
          <div className="border border-border/50 bg-card/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Hibernados — Reativação</span>
              <Badge variant="outline" className="rounded-none font-mono text-[11px] ml-auto text-muted-foreground border-border/40">
                {ov?.byStatus?.["hibernado"] ?? 0} usuários
              </Badge>
            </div>
            <div className="p-5">
              <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed mb-3">
                Usuários registrados há mais de 14 dias que nunca criaram uma campanha. Alto potencial de reativação com o onboarding guiado.
              </p>
              <div className="font-mono text-[11px] text-primary">
                → Use a sequência de reengajamento: demonstração ao vivo + 3 emails de ativação + call do Jeff
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGAMENTOS TAB ── */}
      {tab === "pagamentos" && (
        <div className="space-y-4">

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pendentes",   val: paymentsData?.filter(p => p.status === "pending").length ?? "—",   cls: "text-yellow-400 border-yellow-400/20" },
              { label: "Confirmados", val: paymentsData?.filter(p => p.status === "paid").length    ?? "—",   cls: "text-success border-success/20" },
              { label: "Total (vis.)",val: paymentsData?.length ?? "—",                                        cls: "text-primary border-primary/20" },
            ].map(s => (
              <div key={s.label} className={`border ${s.cls} bg-card/40 p-3 text-center`}>
                <div className={`font-mono text-2xl font-bold ${s.cls.split(" ")[0]}`}>{s.val}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter + Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground/40" />
            {(["pending", "paid", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-all
                  ${payFilter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/30"}`}
              >
                {f === "pending" ? "Pendentes" : f === "paid" ? "Confirmados" : "Todos"}
              </button>
            ))}
            <Button
              size="sm" variant="ghost"
              className="ml-auto rounded-none font-mono uppercase text-[10px] tracking-widest gap-1.5"
              onClick={() => refetchPayments()}
            >
              <RefreshCw className="h-3 w-3" />Atualizar
            </Button>
          </div>

          {/* Payments list */}
          <div className="border border-border/50 overflow-hidden">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[1fr_120px_90px_80px_100px_120px] text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 border-b border-border/50 bg-muted/10 px-5 py-2 gap-3">
              <span>Cliente</span>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Método</span>
              <span className="text-center">Status</span>
              <span className="text-right">Ação</span>
            </div>

            {loadingPayments ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}</div>
            ) : !paymentsData?.length ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                  {payFilter === "pending" ? "Nenhum pagamento pendente" : "Nenhum pagamento encontrado"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[70vh] overflow-y-auto">
                {paymentsData.map(p => {
                  const meth  = METHOD_LABEL[p.method] ?? { label: p.method.toUpperCase(), icon: CreditCard };
                  const MethodIcon = meth.icon;
                  const st    = PAYMENT_STATUS[p.status] ?? { label: p.status, cls: "text-muted-foreground" };
                  const isPending = p.status === "pending";
                  const isExpanded = expandedPayment === p.id;
                  const meta  = p.metadata as { type?: string; packCredits?: number } | null;
                  return (
                    <div key={p.id} className="hover:bg-muted/5 transition-colors">
                      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_90px_80px_100px_120px] items-center px-5 py-3.5 gap-3">

                        {/* Client */}
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold truncate">{p.userName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground/60 truncate">{p.email}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5 flex gap-2">
                            <span>{fmtDate(p.createdAt)}</span>
                            {meta?.type === "pack" && (
                              <span className="text-cyan-400/70">Pack {meta.packCredits} cr</span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="hidden md:block font-mono text-[11px] text-muted-foreground/70 truncate">
                          {p.description ?? "—"}
                        </div>

                        {/* Amount */}
                        <div className="hidden md:block text-right font-mono text-sm font-bold">
                          R${(p.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>

                        {/* Method */}
                        <div className="hidden md:flex justify-center items-center gap-1.5">
                          <MethodIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <span className="font-mono text-[11px] text-muted-foreground/70">{meth.label}</span>
                        </div>

                        {/* Status */}
                        <div className="hidden md:flex justify-center">
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] ${st.cls}`}>
                            {st.label}
                          </Badge>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="rounded-none font-mono uppercase text-[10px] tracking-widest gap-1 h-7 bg-success/80 hover:bg-success text-white border-0"
                                disabled={confirmMutation.isPending && confirmMutation.variables === p.id}
                                onClick={() => confirmMutation.mutate(p.id)}
                              >
                                {confirmMutation.isPending && confirmMutation.variables === p.id
                                  ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  : <CheckCheck className="h-2.5 w-2.5" />}
                                Confirmar
                              </Button>
                              <button
                                onClick={() => setExpandedPayment(isExpanded ? null : p.id)}
                                className="font-mono text-[10px] text-muted-foreground/50 hover:text-primary uppercase tracking-widest border border-border/30 px-2 h-7"
                              >
                                {isExpanded ? "Fechar" : "Dados"}
                              </button>
                            </>
                          )}
                          {!isPending && p.paidAt && (
                            <span className="font-mono text-[10px] text-success/70">
                              ✓ {fmtDate(p.paidAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded payment details */}
                      {isExpanded && (
                        <div className="border-t border-border/30 bg-muted/10 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {p.pixData?.copiaECola && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">PIX Copia e Cola</div>
                              <div className="font-mono text-[11px] text-muted-foreground break-all border border-border/30 bg-card/40 p-2.5 leading-relaxed max-h-20 overflow-y-auto">
                                {p.pixData.copiaECola}
                              </div>
                            </div>
                          )}
                          {p.pixData?.instructions && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Instruções PIX</div>
                              <div className="font-mono text-[11px] text-muted-foreground border border-border/30 bg-card/40 p-2.5">{p.pixData.instructions}</div>
                            </div>
                          )}
                          {p.boletoData?.barcode && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Código de Barras</div>
                              <div className="font-mono text-[11px] text-muted-foreground break-all border border-border/30 bg-card/40 p-2.5">{p.boletoData.barcode}</div>
                              {p.boletoData.barcodeUrl && (
                                <a href={p.boletoData.barcodeUrl} target="_blank" rel="noreferrer"
                                   className="inline-flex items-center gap-1 font-mono text-[10px] text-primary mt-1 hover:underline">
                                  <ArrowUpRight className="h-3 w-3" />Abrir PDF do boleto
                                </a>
                              )}
                            </div>
                          )}
                          {p.externalId && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">ID Asaas</div>
                              <div className="font-mono text-[11px] text-muted-foreground border border-border/30 bg-card/40 p-2.5">{p.externalId}</div>
                            </div>
                          )}
                          {p.expiresAt && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Expira em</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{new Date(p.expiresAt).toLocaleString("pt-BR")}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Webhook info box */}
          <div className="border border-border/30 bg-muted/5 p-4 space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />Webhook Asaas — Confirmação Automática
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
              Configure no painel Asaas → Integrações → Webhooks:
            </div>
            <div className="font-mono text-[11px] bg-card/60 border border-border/40 px-3 py-2 text-primary break-all">
              {`${window.location.origin}/api/billing/webhooks/asaas`}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40">
              Eventos: PAYMENT_RECEIVED · PAYMENT_CONFIRMED — Confirmação automática ao receber PIX ou boleto pago
            </div>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="border border-border/50 bg-card/40 overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_90px_70px_80px_80px_120px] text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b border-border/50 bg-muted/10 px-5 py-2.5 gap-4">
              <span>Usuário / Workspace</span>
              <span className="text-right">Plano</span>
              <span className="text-right">Camp.</span>
              <span className="text-right">Créditos</span>
              <span className="text-right">Dias</span>
              <span className="text-right">Status</span>
            </div>

            {loadingOverview ? (
              <div className="p-8 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
            ) : !ov?.users?.length ? (
              <div className="py-16 text-center">
                <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Nenhum usuário registrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
                {ov.users.map((u) => {
                  const meta = SAAS_META[u.saasStatus as SaasStatus];
                  const Icon = meta?.icon ?? Activity;
                  const days = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
                  return (
                    <div key={u.workspaceId} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_70px_80px_80px_120px] items-center px-5 py-3.5 gap-4 hover:bg-muted/5 transition-colors group">
                      <div className="min-w-0">
                        <button onClick={() => setProfileUserId(u.userId)} className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate text-left hover:underline underline-offset-2">{u.userName}</button>
                        <div className="text-xs text-muted-foreground font-mono truncate flex items-center gap-2">
                          <span>{u.email}</span>
                          {u.workspaceName && (<><span className="text-muted-foreground/30">·</span><span className="text-muted-foreground/50">{u.workspaceName}</span></>)}
                        </div>
                        <div className="text-[11px] text-muted-foreground/40 font-mono mt-0.5">{fmtDate(u.createdAt)}</div>
                      </div>
                      <div className="hidden md:flex justify-end">
                        <span className={`text-[11px] font-mono uppercase tracking-widest px-2 py-1 border ${u.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>{u.planSlug}</span>
                      </div>
                      <div className="hidden md:block text-right font-mono text-sm text-foreground/80">{u.totalCampaigns}</div>
                      <div className="hidden md:block text-right">
                        <span className={`font-mono text-sm font-bold ${u.creditsBalance < 150 ? "text-yellow-400" : "text-foreground/80"}`}>
                          {(u.creditsBalance ?? 0).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="hidden md:block text-right font-mono text-sm text-muted-foreground/50">{days}d</div>
                      <div className="flex justify-end items-center gap-2">
                        {meta && (
                          <Badge variant="outline" className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 ${meta.color}`}>
                            <Icon className="h-2.5 w-2.5 mr-1 shrink-0" />{meta.label}
                          </Badge>
                        )}
                        <button
                          onClick={() => { setGrantTarget({ workspaceId: u.workspaceId, userName: u.userName, currentPlan: u.planSlug }); setGrantPlan("solo"); }}
                          className="font-mono text-[10px] uppercase tracking-widest border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary px-2 py-1 transition-colors shrink-0"
                          title="Liberar acesso ao plano sem pagamento"
                        >
                          🎟 Liberar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── User profile drawer ── */}
      {profileUserId && (
        <UserProfileDrawer
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onGrant={(workspaceId, userName, planSlug) => {
            setProfileUserId(null);
            setGrantTarget({ workspaceId, userName, currentPlan: planSlug });
            setGrantPlan("solo");
          }}
        />
      )}

      {/* ── Grant plan modal ── */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setGrantTarget(null)}>
          <div className="card-nexos rounded-xl p-7 w-full max-w-md space-y-5 border border-primary/30">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-mono text-base font-bold uppercase tracking-widest text-foreground">🎟 Liberar Acesso</h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">{grantTarget.userName}</p>
              </div>
              <button onClick={() => setGrantTarget(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">Plano</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["solo", "agency"] as const).map(p => (
                    <button key={p} onClick={() => setGrantPlan(p)}
                      className={`border py-2.5 font-mono text-xs uppercase tracking-widest transition-all ${grantPlan === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/30"}`}>
                      {p === "solo" ? "Solo — Individual" : "Agency"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">Motivo (opcional)</label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={e => setGrantNote(e.target.value)}
                  placeholder="Ex: código promocional, parceria, teste..."
                  className="w-full px-3 py-2 bg-card/60 border border-border/50 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
              <p className="font-mono text-[11px] text-yellow-400/80">
                ⚡ Isso vai atualizar o plano de <strong>{grantTarget.currentPlan.toUpperCase()}</strong> → <strong>{grantPlan.toUpperCase()}</strong> e adicionar os créditos do plano.
              </p>
            </div>

            <Button
              onClick={() => grantPlanMutation.mutate({ workspaceId: grantTarget.workspaceId, planSlug: grantPlan, note: grantNote })}
              disabled={grantPlanMutation.isPending}
              className="w-full font-mono uppercase tracking-widest rounded-none btn-weapon-primary"
            >
              {grantPlanMutation.isPending ? "Liberando..." : `Liberar Acesso ${grantPlan.toUpperCase()} →`}
            </Button>
          </div>
        </div>
      )}

      {/* ─── TAB: SOLICITAÇÕES ─────────────────────────────────────────────────── */}
      {tab === "solicitacoes" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">📋 Solicitações de Acesso</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {waitlistData?.total ?? 0} total ·{" "}
                {(waitlistData?.entries ?? []).filter(e => !e.notified).length} pendentes
              </p>
            </div>
            <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2" onClick={() => void refetchWaitlist()}>
              <RefreshCw className="h-3 w-3" /> Atualizar
            </Button>
          </div>

          <div className="border border-primary/10 bg-primary/5 px-4 py-3 font-mono text-[11px] text-primary/70 uppercase tracking-widest">
            💡 Para liberar acesso: gere um código para o plano desejado e envie pelo WhatsApp. O usuário usa o código na tela de cadastro.
          </div>

          {loadingWaitlist ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-none" />)}</div>
          ) : !waitlistData?.entries || waitlistData.entries.length === 0 ? (
            <div className="border border-border/30 bg-card/20 p-12 text-center">
              <p className="font-mono text-sm text-muted-foreground/50">Nenhuma solicitação no momento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {waitlistData.entries.map(entry => (
                <div key={entry.id} className={`border p-4 space-y-3 ${entry.notified ? "border-success/20 bg-success/5" : "border-border/40 bg-card/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{entry.name}</span>
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${entry.notified ? "text-success border-success/30 bg-success/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>
                          {entry.notified ? "Aprovado" : "Pendente"}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 border border-border/30 px-1.5 py-0.5">
                          {entry.segment}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {entry.whatsapp}
                        </span>
                        {entry.email && (
                          <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {entry.email}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground/40 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {fmtDate(entry.createdAt)}
                        </span>
                      </div>
                      {approveCodeResult[entry.id] && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-mono text-sm font-black text-primary tracking-widest border border-primary/30 bg-primary/10 px-3 py-1">
                            {approveCodeResult[entry.id]}
                          </span>
                          <Button size="sm" variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-2 btn-weapon-outline gap-1"
                            onClick={async () => { try { await navigator.clipboard.writeText(approveCodeResult[entry.id]!); toast.success("Copiado!"); } catch { /* ignore */ } }}>
                            <Copy className="h-3 w-3" /> Copiar
                          </Button>
                          <a href={`https://wa.me/55${entry.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${entry.name}! Seu código de acesso NexOS: *${approveCodeResult[entry.id]}* — acesse: https://agencianexos.vip/app/register`)}`}
                            target="_blank" rel="noreferrer">
                            <Button size="sm" className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-2 bg-green-600 hover:bg-green-700 text-white">
                              WhatsApp →
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!entry.notified && (
                        <>
                          <Button size="sm" variant="outline"
                            className="rounded-none font-mono text-[11px] uppercase tracking-widest h-8 px-3 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => void approveWaitlistEntry(entry.id, "solo")}
                            disabled={approveLoading === entry.id}>
                            {approveLoading === entry.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Solo →"}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="rounded-none font-mono text-[11px] uppercase tracking-widest h-8 px-3 border-success/30 text-success hover:bg-success/10"
                            onClick={() => void approveWaitlistEntry(entry.id, "agency")}
                            disabled={approveLoading === entry.id}>
                            {approveLoading === entry.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Agency →"}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline"
                        className="rounded-none font-mono text-[11px] h-8 px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => void deleteWaitlistEntry(entry.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: CONVITES ─────────────────────────────────────────────────────── */}
      {tab === "convites" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">🎟️ Códigos de Convite — NexOS</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {(inviteCodes ?? []).filter(c => !c.used).length} disponíveis ·{" "}
                {(inviteCodes ?? []).filter(c => c.used).length} utilizados
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2"
                onClick={() => generateInvitesMutation.mutate({ count: 10, planSlug: "solo" })}
                disabled={generateInvitesMutation.isPending}
              >
                {generateInvitesMutation.isPending ? <><RefreshCw className="h-3 w-3 animate-spin" /> Gerando...</> : "+ 10 Individual"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2"
                onClick={() => generateInvitesMutation.mutate({ count: 10, planSlug: "agency" })}
                disabled={generateInvitesMutation.isPending}
              >
                + 10 Agency
              </Button>
              <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline" onClick={() => refetchInvites()}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <p className="font-mono text-[11px] text-muted-foreground/50 border border-border/30 bg-card/30 px-4 py-3">
            💡 Para usar: na tela de cadastro do NexOS, o convidado digita o código de convite e ganha acesso ao plano correspondente sem pagar.
          </p>

          {loadingInvites ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}</div>
          ) : !inviteCodes || inviteCodes.length === 0 ? (
            <div className="border border-border/30 bg-card/20 p-12 text-center space-y-3">
              <p className="font-mono text-sm text-muted-foreground/50">Nenhum código gerado ainda.</p>
              <Button size="sm" onClick={() => generateInvitesMutation.mutate({ count: 10, planSlug: "solo" })} className="rounded-none font-mono uppercase text-xs tracking-widest">
                Gerar 10 Códigos Individual
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Disponíveis */}
              {inviteCodes.filter(c => !c.used).length > 0 && (
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2 pb-1 border-b border-border/30">
                    ⚪ Disponíveis — {inviteCodes.filter(c => !c.used).length}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {inviteCodes.filter(c => !c.used).map(c => (
                      <div key={c.id} className="border border-border/40 bg-card/30 px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-mono text-base font-bold text-primary tracking-widest">{c.code}</span>
                          <span className={`ml-3 text-[11px] font-mono uppercase tracking-widest px-1.5 py-0.5 border ${c.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                            {c.planSlug}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm" variant="outline"
                            className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-2 btn-weapon-outline"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(c.code); toast.success("Copiado!"); } catch { /* ignore */ }
                            }}
                          >
                            Copiar
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="rounded-none h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => { if (confirm(`Remover código ${c.code}?`)) deleteInviteMutation.mutate(c.id); }}
                            disabled={deleteInviteMutation.isPending}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utilizados / Usuários Ativos */}
              {inviteCodes.filter(c => c.used).length > 0 && (
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-success/70 mb-2 pb-1 border-b border-success/20">
                    ✅ Usuários Ativos — {inviteCodes.filter(c => c.used).length} código(s) utilizados
                  </div>
                  <div className="space-y-1.5">
                    {inviteCodes.filter(c => c.used).map(c => (
                      <div key={c.id} className="border border-success/15 bg-success/5 px-4 py-3 flex items-center justify-between gap-3">
                        {/* Código riscado à esquerda */}
                        <div className="flex items-center gap-3 min-w-0 shrink-0">
                          <span className="font-mono text-sm font-bold text-muted-foreground/50 tracking-widest line-through select-none">
                            {c.code}
                          </span>
                          <span className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 border ${c.planSlug === "agency" ? "text-success border-success/30 bg-success/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                            {c.planSlug}
                          </span>
                        </div>

                        {/* Nome + email + data à direita */}
                        <div className="text-right min-w-0 flex-1">
                          {c.usedByName && (
                            <p className="font-mono text-sm font-bold text-foreground truncate">{c.usedByName}</p>
                          )}
                          {c.usedByEmail && (
                            <p className="font-mono text-xs text-muted-foreground/70 truncate">{c.usedByEmail}</p>
                          )}
                          {c.usedAt && (
                            <p className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">Ativado em {fmtDate(c.usedAt)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: RASTREAMENTO ─────────────────────────────────────────────── */}
      {tab === "rastreamento" && (
        <div className="space-y-5">
          <div>
            <h2 className="font-mono text-lg uppercase tracking-widest font-bold">🔍 Rastreamento de PDFs</h2>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              Cole o fingerprint encontrado em um PDF vazado para identificar o titular da cópia
            </p>
          </div>

          <div className="border border-primary/20 bg-primary/[0.03] p-5 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">
              Fingerprint do Documento
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fpSearch}
                onChange={e => setFpSearch(e.target.value.toUpperCase().trim())}
                placeholder="NXS-XXXX-XXXX"
                className="flex-1 bg-background border border-border/50 px-3 py-2 font-mono text-sm tracking-widest focus:outline-none focus:border-primary/50"
                onKeyDown={e => {
                  if (e.key === "Enter" && fpSearch) {
                    setFpLoading(true); setFpResult(null);
                    customFetch<{ record: NonNullable<typeof fpResult>["record"] }>(`/api/fingerprints/${encodeURIComponent(fpSearch)}`)
                      .then(data => setFpResult({ found: true, record: data.record }))
                      .catch(() => setFpResult({ found: false }))
                      .finally(() => setFpLoading(false));
                  }
                }}
              />
              <Button size="sm" disabled={fpLoading || !fpSearch}
                className="rounded-none font-mono text-[11px] uppercase tracking-widest h-10 px-4 gap-1.5 bg-primary hover:bg-primary/90"
                onClick={() => {
                  setFpLoading(true); setFpResult(null);
                  customFetch<{ record: NonNullable<typeof fpResult>["record"] }>(`/api/fingerprints/${encodeURIComponent(fpSearch)}`)
                    .then(data => setFpResult({ found: true, record: data.record }))
                    .catch(() => setFpResult({ found: false }))
                    .finally(() => setFpLoading(false));
                }}>
                {fpLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Target className="h-3.5 w-3.5" />Rastrear</>}
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/40">
              O fingerprint está no rodapé e capa de cada PDF. Formato: NXS-XXXX-XXXX
            </p>
          </div>

          {fpResult && (
            <div className={`border p-5 space-y-4 ${fpResult.found ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
              {!fpResult.found ? (
                <div className="flex items-center gap-3">
                  <X className="h-5 w-5 text-destructive" />
                  <div>
                    <div className="font-mono text-sm font-bold text-destructive">Fingerprint não encontrado</div>
                    <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
                      Código não registrado. PDF pode ter sido gerado antes do sistema de rastreamento.
                    </div>
                  </div>
                </div>
              ) : fpResult.record ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-mono text-sm font-bold text-success uppercase tracking-widest">Titular Identificado</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {([
                      ["Fingerprint",   fpResult.record.fingerprint],
                      ["Nome",          fpResult.record.userName],
                      ["Email",         fpResult.record.userEmail],
                      ["ID de Conta",   fpResult.record.userId],
                      ["Workspace",     fpResult.record.workspaceName],
                      ["Campanha",      fpResult.record.campaignTitle ?? fpResult.record.campaignId],
                      ["Track",         fpResult.record.track ?? "—"],
                      ["Gerado em",     new Date(fpResult.record.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
                      ["IP do Download", fpResult.record.ipAddress ?? "—"],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="border border-border/30 bg-background/50 px-4 py-3">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">{label}</div>
                        <div className="font-mono text-sm text-foreground font-bold break-all">{value}</div>
                      </div>
                    ))}
                  </div>
                  {fpResult.record.userAgent && (
                    <div className="border border-border/20 bg-muted/10 px-4 py-2">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">User Agent</div>
                      <div className="font-mono text-[11px] text-muted-foreground/60 break-all">{fpResult.record.userAgent}</div>
                    </div>
                  )}
                  <Button size="sm" variant="outline"
                    className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-3 gap-1 btn-weapon-outline"
                    onClick={() => { if (fpResult.record) setProfileUserId(fpResult.record.userId); }}>
                    <Users className="h-3 w-3" />Ver Perfil Completo
                  </Button>
                </>
              ) : null}
            </div>
          )}

          <FingerprintDownloadsList />
        </div>
      )}
    </div>
  );
}

function FingerprintDownloadsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/fingerprints"],
    queryFn: () => customFetch<{ records: { id: string; fingerprint: string; userName: string; userEmail: string; campaignTitle: string | null; generatedAt: string; ipAddress: string | null }[] }>("/api/fingerprints"),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 pb-1 border-b border-border/30">
        Downloads Registrados — {data?.records?.length ?? 0} total
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}</div>
      ) : !data?.records?.length ? (
        <div className="border border-border/20 bg-card/10 p-8 text-center font-mono text-xs text-muted-foreground/40">
          Nenhum download registrado ainda
        </div>
      ) : (
        <div className="space-y-1">
          {data.records.map(r => (
            <div key={r.id} className="border border-border/25 bg-card/20 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{r.userName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">{r.userEmail}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/40">
                  {r.campaignTitle ?? "—"} · {new Date(r.generatedAt).toLocaleString("pt-BR")}
                  {r.ipAddress ? ` · ${r.ipAddress}` : ""}
                </div>
              </div>
              <div className="shrink-0 font-mono text-xs font-bold text-primary/70 tracking-widest border border-primary/20 bg-primary/5 px-2 py-0.5">
                {r.fingerprint}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
