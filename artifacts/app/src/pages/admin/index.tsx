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
  ChevronDown, Search, Plus, Building2, Edit3, Printer, Send,
  CheckSquare, XCircle, FileSpreadsheet, TrendingUp as TrendUp,
  PieChart, Banknote, Receipt, ClipboardList, User,
} from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignCostRow {
  campaignId: string;
  campaignName: string | null;
  workspaceId: string;
  workspaceName: string | null;
  ownerEmail: string;
  totalCostUsd: number;
  totalCredits: number;
  totalTokens: number;
  totalCalls: number;
  byAgent: { agentType: string; costUsd: number; credits: number; calls: number }[];
}

interface CostBreakdownResponse {
  campaigns: CampaignCostRow[];
  platformTotals: { totalCostUsd: number; totalCredits: number; totalTokens: number; totalCalls: number };
}

interface DREMonthRow {
  month: string; label: string;
  receitaBrutaCents: number; newClients: number;
  impostosCents: number; receitaLiquidaCents: number;
  aiCostUsd: number; aiCostBrlCents: number;
  lucroBrutoCents: number; aiCalls: number;
}

interface DREResponse {
  year: number; usdBrl: number; simplasRate: number; rows: DREMonthRow[];
}

interface CRMClient {
  workspaceId: string; workspaceName: string; workspaceStatus: string;
  userId: string; userName: string; email: string; phone: string | null;
  planSlug: string | null; planName: string | null;
  creditsBalance: number; totalRevCents: number; paymentCount: number;
  totalCampaigns: number; createdAt: string;
}

interface Proposal {
  id: string; clientName: string; clientEmail: string;
  items: { desc: string; qty: number; unit: string; priceCents: number }[];
  status: "rascunho" | "enviada" | "aceita" | "recusada";
  notes: string; createdAt: string;
}

function loadProposals(): Proposal[] {
  try { return JSON.parse(localStorage.getItem("nexos_admin_proposals") ?? "[]"); } catch { return []; }
}
function saveProposals(p: Proposal[]) {
  localStorage.setItem("nexos_admin_proposals", JSON.stringify(p));
}

// ─── RH types ────────────────────────────────────────────────────────────────

type MemberType   = "humano" | "agente_ia" | "contador" | "advogado" | "parceiro";
type MemberStatus = "ativo" | "inativo" | "pendente";

interface TeamMember {
  id:           string;
  name:         string;
  email:        string;
  role:         string;           // "CFO", "Agente Contador", "Dev", etc.
  type:         MemberType;
  status:       MemberStatus;
  jurisdiction: "BR" | "AU" | "ambos";
  proLabore:    number;           // BRL cents (0 = voluntário / IA)
  commission:   number;           // % (0–100)
  permissions:  string[];         // module slugs they can access
  notes:        string;
  createdAt:    string;
}

function loadTeam(): TeamMember[] {
  try { return JSON.parse(localStorage.getItem("nexos_admin_team") ?? "[]"); } catch { return []; }
}
function saveTeam(t: TeamMember[]) {
  localStorage.setItem("nexos_admin_team", JSON.stringify(t));
}

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
const SAAS_COPY: Record<SaasStatus, { label: [string, string, string]; desc: [string, string, string] }> = {
  novo: { label: ["Novo", "New", "Nuevo"], desc: ["Registrado há menos de 14 dias", "Registered less than 14 days ago", "Registrado hace menos de 14 días"] },
  ativo_lancando: { label: ["Lançando", "Launching", "En lanzamiento"], desc: ["Campanha executando ou ao vivo", "Campaign running or live", "Campaña en ejecución o activa"] },
  ativo: { label: ["Ativo", "Active", "Activo"], desc: ["Usa regularmente", "Uses the product regularly", "Usa el producto con regularidad"] },
  pausado: { label: ["Pausado", "Paused", "En pausa"], desc: ["Workspace suspenso", "Workspace suspended", "Workspace suspendido"] },
  hibernado: { label: ["Hibernado", "Dormant", "Inactivo"], desc: ["Paga mas não usa há 14 dias ou mais", "Pays but has not used the product for 14+ days", "Paga, pero lleva más de 14 días sin usarlo"] },
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}
function fmtDate(iso: string, locale = "pt-BR") {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" });
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
  const t = useUiText();
  const { locale } = useUiLocale();
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
                🎟 {t("Liberar acesso", "Grant access", "Conceder acceso")}
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40 shrink-0">
          {(["perfil", "campanhas", "pagamentos", "creditos"] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={`flex-1 font-mono text-[11px] uppercase tracking-widest py-3 transition-colors border-b-2 ${tab === tabKey ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tabKey === "perfil" ? t("Perfil", "Profile", "Perfil") : tabKey === "campanhas" ? t("Campanhas", "Campaigns", "Campañas") : tabKey === "pagamentos" ? t("Pagamentos", "Payments", "Pagos") : t("Créditos", "Credits", "Créditos")}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
          ) : !p ? (
            <p className="font-mono text-sm text-muted-foreground/50 text-center py-10">{t("Erro ao carregar.", "Failed to load.", "Error al cargar.")}</p>
          ) : tab === "perfil" ? (
            <>
              {/* Contact */}
              <div className="border border-border/40 bg-card/20 p-4 space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-3">{t("Contato", "Contact", "Contacto")}</div>
                {[
                  { icon: Mail, label: t("Email", "Email", "Correo electrónico"), value: p.user.email },
                  { icon: Phone, label: t("Telefone", "Phone", "Teléfono"), value: p.user.phone ?? t("Não informado", "Not provided", "No indicado") },
                { icon: Calendar, label: t("Cadastro", "Joined", "Registro"), value: fmtDate(p.user.createdAt, intlLocale(locale)) },
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
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-3">{t("🔗 Origem do lead", "🔗 Lead source", "🔗 Origen del lead")}</div>
                {p.leadSource ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Tag className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">{t("Código", "Code", "Código")}</span>
                      <span className="font-mono text-sm text-primary font-bold">{p.leadSource.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">{t("Plano", "Plan", "Plan")}</span>
                      <span className="font-mono text-sm text-foreground uppercase">{p.leadSource.planSlug}</span>
                    </div>
                    {p.leadSource.usedAt && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <span className="font-mono text-[11px] text-muted-foreground/50 w-20 shrink-0">{t("Usado em", "Used on", "Usado el")}</span>
                        <span className="font-mono text-sm text-foreground">{fmtDate(p.leadSource.usedAt, intlLocale(locale))}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-muted-foreground/40">{t("Cadastro orgânico — sem código de convite", "Organic signup — no invite code", "Registro orgánico — sin código de invitación")}</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t("Créditos", "Credits", "Créditos"), value: (p.user.creditsBalance ?? 0).toLocaleString(intlLocale(locale)), color: p.user.creditsBalance < 150 ? "text-yellow-400" : "text-foreground" },
                  { label: t("Campanhas", "Campaigns", "Campañas"), value: String(p.campaigns.length), color: "text-foreground" },
                  { label: t("Pagamentos", "Payments", "Pagos"), value: String(p.payments.filter(x => x.status === "paid").length), color: "text-success" },
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
                <p className="font-mono text-xs text-muted-foreground/40">{t("Nenhuma campanha ainda.", "No campaigns yet.", "Aún no hay campañas.")}</p>
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
                          <span>{fmtDate(c.createdAt, intlLocale(locale))}</span>
                        </div>
                      </div>
                      <span className={`font-mono text-[11px] uppercase shrink-0 ${CAMPAIGN_STATUS_COLOR[c.status] ?? "text-muted-foreground"}`}>
                        {({
                          draft: t("Rascunho", "Draft", "Borrador"),
                          analyzing: t("Analisando", "Analyzing", "Analizando"),
                          strategy_ready: t("Estratégia pronta", "Strategy ready", "Estrategia lista"),
                          generating: t("Gerando", "Generating", "Generando"),
                          awaiting_approval: t("Aguardando aprovação", "Awaiting approval", "Esperando aprobación"),
                          approved: t("Aprovada", "Approved", "Aprobada"),
                          executing: t("Em execução", "Executing", "En ejecución"),
                          live: t("Ao vivo", "Live", "En vivo"),
                          completed: t("Concluída", "Completed", "Completada"),
                          cancelled: t("Cancelada", "Cancelled", "Cancelada"),
                        } as Record<string, string>)[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "pagamentos" ? (
            p.payments.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground/40">{t("Nenhum pagamento registrado.", "No payments recorded.", "No hay pagos registrados.")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {p.payments.map(pay => (
                  <div key={pay.id} className="border border-border/40 bg-card/20 p-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-foreground">{fmtBRL(pay.amountCents)}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">
                        {(pay.method === "pix" ? "PIX" : pay.method === "boleto" ? t("Boleto", "Boleto", "Boleto") : pay.method === "bank_transfer" ? "TED" : pay.method === "credit_card" ? t("Cartão", "Card", "Tarjeta") : pay.method === "manual" ? t("Manual", "Manual", "Manual") : pay.method.toUpperCase())} · {fmtDate(pay.createdAt, intlLocale(locale))}
                        {pay.description && <> · {pay.description}</>}
                      </div>
                    </div>
                    <span className={`font-mono text-[11px] uppercase tracking-widest shrink-0 px-2 py-0.5 border ${pay.status === "paid" ? "text-success border-success/30 bg-success/10" : pay.status === "pending" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" : "text-muted-foreground border-border/30"}`}>
                      {pay.status === "paid" ? t("Pago", "Paid", "Pagado") : pay.status === "pending" ? t("Pendente", "Pending", "Pendiente") : pay.status === "processing" ? t("Processando", "Processing", "Procesando") : pay.status === "failed" ? t("Falhou", "Failed", "Fallido") : pay.status === "cancelled" ? t("Cancelado", "Cancelled", "Cancelado") : pay.status === "expired" ? t("Expirado", "Expired", "Vencido") : pay.status}
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
                   <div className="font-mono text-xl font-bold text-primary">{p.creditStats.totalCredited.toLocaleString(intlLocale(locale))}</div>
                   <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{t("Total recebido", "Total received", "Total recibido")}</div>
                </div>
                <div className="border border-border/40 bg-card/20 p-4 text-center">
                   <div className="font-mono text-xl font-bold text-orange-400">{p.creditStats.totalDebited.toLocaleString(intlLocale(locale))}</div>
                   <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{t("Total consumido", "Total used", "Total consumido")}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                 <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-2">{t("Últimas transações", "Recent transactions", "Últimas transacciones")}</div>
                {p.recentCredits.length === 0 ? (
                   <p className="font-mono text-xs text-muted-foreground/40 text-center py-6">{t("Sem movimentações.", "No activity.", "Sin movimientos.")}</p>
                ) : p.recentCredits.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between border border-border/30 bg-card/10 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-foreground/80 truncate">{tx.action}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/40">{fmtDate(tx.createdAt, intlLocale(locale))}</div>
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
  const t = useUiText();
  const { locale } = useUiLocale();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "financials" | "users" | "upsell" | "pagamentos" | "convites" | "solicitacoes" | "rastreamento" | "custo" | "crm" | "dre" | "fiscal" | "propostas" | "rh">("pagamentos");
  const [fpSearch, setFpSearch] = useState("");
  const [costWorkspaceFilter, setCostWorkspaceFilter] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // CRM state
  const [crmSearch, setCrmSearch] = useState("");
  const [crmStages, setCrmStages]  = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("nexos_crm_stages") ?? "{}"); } catch { return {}; }
  });
  const [crmNotes, setCrmNotes]    = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("nexos_crm_notes") ?? "{}"); } catch { return {}; }
  });
  const [crmSelected, setCrmSelected] = useState<string | null>(null);
  const [crmNoteEdit, setCrmNoteEdit]  = useState("");

  // DRE state
  const [dreYear, setDreYear] = useState(new Date().getFullYear());
  const [dreExpenses, setDreExpenses] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("nexos_dre_expenses") ?? "{}"); } catch { return {}; }
  });
  const [dreExpenseEdit, setDreExpenseEdit] = useState<{ month: string; val: string } | null>(null);

  // RH state
  const [team, setTeam]               = useState<TeamMember[]>(loadTeam);
  const [rhView, setRhView]           = useState<"list" | "create" | "detail">("list");
  const [rhSelected, setRhSelected]   = useState<TeamMember | null>(null);
  const [rhForm, setRhForm]           = useState<Partial<TeamMember>>({
    name: "", email: "", role: "", type: "humano", status: "pendente",
    jurisdiction: "ambos", proLabore: 0, commission: 0, permissions: [], notes: "",
  });

  // Propostas state
  const [proposals, setProposals] = useState<Proposal[]>(loadProposals);
  const [proposalView, setProposalView] = useState<"list" | "create" | "detail">("list");
  const [proposalForm, setProposalForm] = useState<Partial<Proposal>>({
    clientName: "", clientEmail: "", items: [], status: "rascunho", notes: "",
  });
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
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

  const { data: costData, isLoading: loadingCost, refetch: refetchCost } = useQuery({
    queryKey: ["/api/admin/cost-breakdown"],
    enabled: isAdmin && tab === "custo",
    queryFn: () => customFetch<CostBreakdownResponse>("/api/admin/cost-breakdown?limit=100"),
    staleTime: 60_000,
  });

  const { data: dreData, isLoading: loadingDRE, refetch: refetchDRE } = useQuery({
    queryKey: ["/api/admin/dre", dreYear],
    enabled: isAdmin && (tab === "dre" || tab === "fiscal"),
    queryFn: () => customFetch<DREResponse>(`/api/admin/dre?year=${dreYear}`),
    staleTime: 120_000,
  });

  const { data: crmData, isLoading: loadingCRM, refetch: refetchCRM } = useQuery({
    queryKey: ["/api/admin/crm"],
    enabled: isAdmin && tab === "crm",
    queryFn: () => customFetch<{ clients: CRMClient[] }>("/api/admin/crm"),
    staleTime: 60_000,
  });

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
      toast.success(t(`Código gerado: ${data.code}`, `Code generated: ${data.code}`, `Código generado: ${data.code}`));
      void refetchWaitlist();
    } catch {
      toast.error(t("Erro ao aprovar solicitação", "Failed to approve request", "Error al aprobar la solicitud"));
    } finally {
      setApproveLoading(null);
    }
  };

  const deleteWaitlistEntry = async (id: string) => {
    try {
      await customFetch(`/api/admin/waitlist/${id}`, { method: "DELETE" });
      toast.success(t("Solicitação removida", "Request removed", "Solicitud eliminada"));
      void refetchWaitlist();
    } catch {
      toast.error(t("Erro ao remover", "Failed to remove", "Error al eliminar"));
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
      toast.success(t("Códigos gerados com sucesso!", "Codes generated successfully!", "¡Códigos generados correctamente!"));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast.error(err.message ?? t("Erro ao gerar códigos", "Failed to generate codes", "Error al generar los códigos")),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      return customFetch<{ ok: boolean }>(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success(t("Código removido.", "Code removed.", "Código eliminado."));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast.error(err.message ?? t("Erro ao remover código", "Failed to remove code", "Error al eliminar el código")),
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
      toast.success(t(`Acesso ${data.planName} liberado com sucesso!`, `${data.planName} access granted successfully!`, `¡Acceso ${data.planName} concedido correctamente!`));
      setGrantTarget(null);
      setGrantNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    },
    onError: (err: Error) => toast.error(err.message ?? t("Erro ao liberar acesso", "Failed to grant access", "Error al conceder el acceso")),
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
      toast.success(data.message ?? t("Pagamento confirmado!", "Payment confirmed!", "¡Pago confirmado!"));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t("Erro ao confirmar pagamento.", "Failed to confirm payment.", "Error al confirmar el pago."));
    },
  });

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-destructive/50 mx-auto" />
        <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-destructive/70">{t("Acesso restrito", "Restricted access", "Acceso restringido")}</h2>
        <p className="font-mono text-sm text-muted-foreground/60">{t("Esta área é exclusiva para administradores.", "This area is for administrators only.", "Esta área es exclusiva para administradores.")}</p>
        <Button asChild variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2"><Link href="/"><ArrowLeft className="h-3.5 w-3.5" />{t("Voltar", "Back", "Volver")}</Link></Button>
      </div>
    );
  }

  const fin = financials;
  const ov  = overview;

  const TABS = [
    { id: "pagamentos" as const,   label: t("Pagamentos", "Payments", "Pagos") },
    { id: "overview" as const,     label: t("Visão geral", "Overview", "Resumen") },
    { id: "financials" as const,   label: t("Financeiro", "Financials", "Finanzas") },
    { id: "upsell" as const,       label: t("Oportunidades", "Opportunities", "Oportunidades") },
    { id: "users" as const,        label: t("Usuários", "Users", "Usuarios") },
    { id: "convites" as const,     label: t("🎟️ Convites", "🎟️ Invites", "🎟️ Invitaciones") },
    { id: "solicitacoes" as const, label: t("📋 Solicitações", "📋 Requests", "📋 Solicitudes") },
    { id: "rastreamento" as const, label: t("🔍 Rastreamento", "🔍 Tracking", "🔍 Seguimiento") },
    { id: "custo" as const,        label: t("💰 Custo de IA", "💰 AI costs", "💰 Costes de IA") },
    { id: "crm" as const,          label: "👥 CRM" },
    { id: "dre" as const,          label: "📊 DRE" },
    { id: "fiscal" as const,       label: t("🧾 Fiscal", "🧾 Tax", "🧾 Fiscal") },
    { id: "propostas" as const,    label: t("📋 Propostas", "📋 Proposals", "📋 Propuestas") },
    { id: "rh" as const,           label: t("👔 RH / Equipe", "👔 HR / Team", "👔 RR. HH. / Equipo") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="h-5 w-5 text-yellow-400" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">
              {t("Central de comando · NexOS", "Command Center · NexOS", "Centro de control · NexOS")}
            </h1>
            <Badge variant="outline" className="rounded-none font-mono text-[11px] border-yellow-400/30 text-yellow-400 bg-yellow-400/10">
              {t("Proprietário", "Owner", "Propietario")}
            </Badge>
            <Badge variant="outline" className="rounded-none font-mono text-[11px] border-primary/40 text-primary bg-primary/10">
              ∞ {t("Créditos ilimitados", "Unlimited credits", "Créditos ilimitados")}
            </Badge>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {t(`${ov?.total ?? 0} usuários registrados · ${ov?.byStatus?.["ativo_lancando"] ?? 0} lançando agora`, `${ov?.total ?? 0} registered users · ${ov?.byStatus?.["ativo_lancando"] ?? 0} launching now`, `${ov?.total ?? 0} usuarios registrados · ${ov?.byStatus?.["ativo_lancando"] ?? 0} en lanzamiento ahora`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/operations">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Activity className="h-3 w-3" />{t("Operações", "Operations", "Operaciones")}
            </Button>
          </Link>
          <Link href="/admin/audit-logs">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0"
            >
              <Shield className="h-3 w-3" />{t("Registros de auditoria", "Audit logs", "Registros de auditoría")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3 w-3" />{t("Atualizar", "Refresh", "Actualizar")}
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
                label={t("Receita total", "Total revenue", "Ingresos totales")} icon={DollarSign}
                value={fmtBRL(fin?.totalRevenueCentsBrl ?? 0)}
                sub={`+${fmtBRL(fin?.last7dRevenueCents ?? 0)} ${t("esta semana", "this week", "esta semana")}`}
                color="text-success" border="border-success/20"
              />
              <MetricCard
                label={t("Margem bruta", "Gross margin", "Margen bruto")} icon={Percent}
                value={`${(fin?.marginPct ?? 0).toFixed(1)}%`}
                sub={`${t("Margem:", "Margin:", "Margen:")} ${fmtBRL(fin?.marginBrl ?? 0)}`}
                color="text-primary"
              />
              <MetricCard
                label={t("Conversão", "Conversion", "Conversión")} icon={Target}
                value={`${(fin?.conversionRate ?? 0).toFixed(1)}%`}
                sub={t(`${fin?.totalPaid ?? 0} pagaram de ${fin?.totalRegistered ?? 0}`, `${fin?.totalPaid ?? 0} paid out of ${fin?.totalRegistered ?? 0}`, `${fin?.totalPaid ?? 0} pagaron de ${fin?.totalRegistered ?? 0}`)}
                color="text-cyan-400"
              />
              <MetricCard
                label={t("Lançando agora", "Launching now", "En lanzamiento")}
                value={String(ov?.byStatus?.["ativo_lancando"] ?? 0)}
                sub={t("campanhas em execução/ao vivo", "campaigns running/live", "campañas en ejecución/en vivo")}
                icon={Rocket}
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
                  <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{t(...SAAS_COPY[key].label)}</div>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-mono font-bold text-foreground">
                      {loadingOverview ? <Skeleton className="h-7 w-10 bg-muted/20" /> : (ov?.byStatus?.[key] ?? 0)}
                    </span>
                    <Icon className={`h-5 w-5 opacity-60 ${meta.color.split(" ")[0]}`} />
                  </div>
                  <div className="text-[11px] text-muted-foreground/40 font-mono mt-2 leading-tight">{t(...SAAS_COPY[key].desc)}</div>
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
                { label: t("Novos 7 dias", "New in 7 days", "Nuevos en 7 días"), value: fin?.last7dSignups ?? 0, icon: Users, color: "text-primary" },
                { label: t("Novos 30 dias", "New in 30 days", "Nuevos en 30 días"), value: fin?.last30dSignups ?? 0, icon: TrendingUp, color: "text-cyan-400" },
                { label: t("Acessos Pagos", "Paid Access", "Accesos Pagados"), value: fin?.accessRevenuePaid ?? 0, icon: CheckCircle2, color: "text-success" },
                { label: t("Packs Vendidos", "Packs Sold", "Packs Vendidos"), value: fin?.packSalesCount ?? 0, icon: Zap, color: "text-yellow-400" },
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
                  <div className="font-mono text-[11px] uppercase tracking-widest text-success/60 mb-2">{t("Receita de Acessos", "Access Revenue", "Ingresos por Accesos")}</div>
                  <div className="font-mono text-3xl font-black text-success">{fmtBRL(fin?.accessRevenueCentsBrl ?? 0)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">{fin?.accessRevenuePaid ?? 0} {t("acessos pagos", "paid accesses", "accesos pagados")}</div>
                </div>
                <div className="border border-primary/20 bg-primary/5 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60 mb-2">{t("Receita de Packs", "Pack Revenue", "Ingresos por Packs")}</div>
                  <div className="font-mono text-3xl font-black text-primary">{fmtBRL(fin?.packRevenueCentsBrl ?? 0)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">{fin?.packSalesCount ?? 0} {t("packs vendidos", "packs sold", "packs vendidos")}</div>
                </div>
                <div className="border border-cyan-400/20 bg-cyan-400/5 p-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400/60 mb-2">{t("Custo do agente", "Agent Cost", "Costo del agente")}</div>
                  <div className="font-mono text-3xl font-black text-cyan-400">
                    {fmtBRL(fin?.totalAiCostBrl ?? 0)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/50 mt-1">
                    ${(fin?.totalAiCostUsd ?? 0).toFixed(2)} USD · {(fin?.totalAiCallsCount ?? 0).toLocaleString("pt-BR")} {t("chamadas", "calls", "llamadas")}
                  </div>
                </div>
              </div>

              {/* Margin bar */}
              <div className="border border-border/50 bg-card/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Margem Bruta", "Gross Margin", "Margen Bruto")}</div>
                  <div className="font-mono text-xl font-black text-success">{(fin?.marginPct ?? 0).toFixed(1)}%</div>
                </div>
                <div className="h-3 bg-muted/30 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-success transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, fin?.marginPct ?? 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 font-mono text-[11px] text-muted-foreground/50">
                  <span>{t("Receita:", "Revenue:", "Ingresos:")} {fmtBRL(fin?.totalRevenueCentsBrl ?? 0)}</span>
                  <span>{t("Margem:", "Margin:", "Margen:")} {fmtBRL(fin?.marginBrl ?? 0)}</span>
                </div>
              </div>

              {/* Conversion funnel */}
              <div className="border border-border/50 bg-card/40 p-5">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-4">{t("Funil de Conversão", "Conversion Funnel", "Embudo de Conversión")}</div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: t("Registrados", "Registered", "Registrados"), value: fin?.totalRegistered ?? 0, pct: 100, color: "bg-muted/40" },
                    { label: t("Pagaram", "Paid", "Pagaron"), value: fin?.totalPaid ?? 0, pct: fin?.conversionRate ?? 0, color: "bg-primary" },
                    { label: t("Lançando", "Launching", "En lanzamiento"), value: ov?.byStatus?.["ativo_lancando"] ?? 0, pct: fin?.totalRegistered ? ((ov?.byStatus?.["ativo_lancando"] ?? 0) / fin.totalRegistered * 100) : 0, color: "bg-success" },
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
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Últimos Pagamentos", "Recent Payments", "Pagos Recientes")}</span>
                </div>
                {!fin?.recentPayments?.length ? (
                  <div className="py-10 text-center font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">{t("Nenhum pagamento registrado", "No payments recorded", "No hay pagos registrados")}</div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {fin.recentPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/5">
                        <div>
                          <div className="font-mono text-xs font-bold">{p.email}</div>
                          <div className="font-mono text-[11px] text-muted-foreground/50">
                            {t("Plano", "Plan", "Plan")} {p.planName} · {fmtDate(p.createdAt, intlLocale(locale))}
                            {p.paidAt && ` · ${t("Pago", "Paid", "Pagado")} ${fmtDate(p.paidAt, intlLocale(locale))}`}
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
              <span className="font-mono text-xs uppercase tracking-widest text-yellow-400 font-bold">{t("Oportunidades de Upsell", "Upsell Opportunities", "Oportunidades de venta adicional")}</span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/60">
              {t("Usuários com menos de 150 créditos — prestes a precisar de um pack. Momento ideal para contato ativo.", "Users with fewer than 150 credits — likely to need a pack soon. An ideal time for proactive outreach.", "Usuarios con menos de 150 créditos: pronto necesitarán un pack. Es el momento ideal para contactarlos.")}
            </p>
          </div>

          {loadingFin ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}</div>
          ) : !fin?.lowCreditWorkspaces?.length ? (
            <div className="py-12 text-center border border-border/30">
              <CheckCircle2 className="h-8 w-8 text-success/30 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">{t("Nenhum usuário com créditos baixos no momento", "No users with low credits right now", "No hay usuarios con pocos créditos en este momento")}</p>
            </div>
          ) : (
            <div className="border border-border/50 bg-card/40 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_120px] text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b border-border/40 bg-muted/10 px-5 py-2.5 gap-4">
                <span>{t("Usuário", "User", "Usuario")}</span>
                <span className="text-right">{t("Workspace", "Workspace", "Espacio de trabajo")}</span>
                <span className="text-right">{t("Créditos", "Credits", "Créditos")}</span>
                <span className="text-right">{t("Ação", "Action", "Acción")}</span>
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
                      <a href={`mailto:${u.email}?subject=${encodeURIComponent(t("Seus créditos NexOS estão acabando", "Your NexOS credits are running low", "Tus créditos de NexOS se están agotando"))}&body=${encodeURIComponent(t(`Oi! Notei que você está com apenas ${u.balance} créditos. Posso ajudar com uma recarga?`, `Hi! I noticed you only have ${u.balance} credits left. Can I help you top up?`, `¡Hola! Veo que solo te quedan ${u.balance} créditos. ¿Puedo ayudarte a recargar?`))}`}>
                        <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-[10px] tracking-widest btn-weapon-outline h-7 gap-1">
                          <ArrowUpRight className="h-2.5 w-2.5" />{t("Contatar", "Contact", "Contactar")}
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
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Hibernados — Reativação", "Dormant — Re-engagement", "Inactivos — Reactivación")}</span>
              <Badge variant="outline" className="rounded-none font-mono text-[11px] ml-auto text-muted-foreground border-border/40">
                {ov?.byStatus?.["hibernado"] ?? 0} {t("usuários", "users", "usuarios")}
              </Badge>
            </div>
            <div className="p-5">
              <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed mb-3">
                {t("Usuários registrados há mais de 14 dias que nunca criaram uma campanha. Alto potencial de reativação com o onboarding guiado.", "Users who registered over 14 days ago but have never created a campaign. Strong re-engagement potential with guided onboarding.", "Usuarios registrados hace más de 14 días que nunca crearon una campaña. Alto potencial de reactivación con una incorporación guiada.")}
              </p>
              <div className="font-mono text-[11px] text-primary">
                → {t("Use a sequência de reengajamento: demonstração ao vivo + 3 emails de ativação + call do Jeff", "Use the re-engagement sequence: live demo + 3 activation emails + Jeff's call", "Usa la secuencia de reactivación: demostración en vivo + 3 correos de activación + llamada de Jeff")}
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
              { label: t("Pendentes", "Pending", "Pendientes"), val: paymentsData?.filter(p => p.status === "pending").length ?? "—", cls: "text-yellow-400 border-yellow-400/20" },
              { label: t("Confirmados", "Confirmed", "Confirmados"), val: paymentsData?.filter(p => p.status === "paid").length ?? "—", cls: "text-success border-success/20" },
              { label: t("Total (vis.)", "Total (shown)", "Total (vis.)"), val: paymentsData?.length ?? "—", cls: "text-primary border-primary/20" },
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
                {f === "pending" ? t("Pendentes", "Pending", "Pendientes") : f === "paid" ? t("Confirmados", "Confirmed", "Confirmados") : t("Todos", "All", "Todos")}
              </button>
            ))}
            <Button
              size="sm" variant="ghost"
              className="ml-auto rounded-none font-mono uppercase text-[10px] tracking-widest gap-1.5"
              onClick={() => refetchPayments()}
            >
              <RefreshCw className="h-3 w-3" />{t("Atualizar", "Refresh", "Actualizar")}
            </Button>
          </div>

          {/* Payments list */}
          <div className="border border-border/50 overflow-hidden">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[1fr_120px_90px_80px_100px_120px] text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 border-b border-border/50 bg-muted/10 px-5 py-2 gap-3">
              <span>{t("Cliente", "Customer", "Cliente")}</span>
              <span>{t("Descrição", "Description", "Descripción")}</span>
              <span className="text-right">{t("Valor", "Amount", "Importe")}</span>
              <span className="text-center">{t("Método", "Method", "Método")}</span>
              <span className="text-center">{t("Status", "Status", "Estado")}</span>
              <span className="text-right">{t("Ação", "Action", "Acción")}</span>
            </div>

            {loadingPayments ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}</div>
            ) : !paymentsData?.length ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                  {payFilter === "pending" ? t("Nenhum pagamento pendente", "No pending payments", "No hay pagos pendientes") : t("Nenhum pagamento encontrado", "No payments found", "No se encontraron pagos")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[70vh] overflow-y-auto">
                {paymentsData.map(p => {
                  const meth  = METHOD_LABEL[p.method] ?? { label: p.method.toUpperCase(), icon: CreditCard };
                  const methodLabel = p.method === "pix" ? "PIX" : p.method === "boleto" ? t("Boleto", "Boleto", "Boleto") : p.method === "bank_transfer" ? "TED" : p.method === "credit_card" ? t("Cartão", "Card", "Tarjeta") : p.method === "manual" ? t("Manual", "Manual", "Manual") : meth.label;
                  const MethodIcon = meth.icon;
                  const st    = PAYMENT_STATUS[p.status] ?? { label: p.status, cls: "text-muted-foreground" };
                  const statusLabel = p.status === "pending" ? t("Pendente", "Pending", "Pendiente") : p.status === "processing" ? t("Processando", "Processing", "Procesando") : p.status === "paid" ? t("Pago", "Paid", "Pagado") : p.status === "failed" ? t("Falhou", "Failed", "Fallido") : p.status === "cancelled" ? t("Cancelado", "Cancelled", "Cancelado") : p.status === "expired" ? t("Expirado", "Expired", "Vencido") : st.label;
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
                            <span>{fmtDate(p.createdAt, intlLocale(locale))}</span>
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
                          <span className="font-mono text-[11px] text-muted-foreground/70">{methodLabel}</span>
                        </div>

                        {/* Status */}
                        <div className="hidden md:flex justify-center">
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] ${st.cls}`}>
                            {statusLabel}
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
                                {t("Confirmar", "Confirm", "Confirmar")}
                              </Button>
                              <button
                                onClick={() => setExpandedPayment(isExpanded ? null : p.id)}
                                className="font-mono text-[10px] text-muted-foreground/50 hover:text-primary uppercase tracking-widest border border-border/30 px-2 h-7"
                              >
                                {isExpanded ? t("Fechar", "Close", "Cerrar") : t("Dados", "Details", "Datos")}
                              </button>
                            </>
                          )}
                          {!isPending && p.paidAt && (
                            <span className="font-mono text-[10px] text-success/70">
                              ✓ {fmtDate(p.paidAt, intlLocale(locale))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded payment details */}
                      {isExpanded && (
                        <div className="border-t border-border/30 bg-muted/10 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {p.pixData?.copiaECola && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("PIX Copia e Cola", "PIX Copy and Paste", "PIX: copiar y pegar")}</div>
                              <div className="font-mono text-[11px] text-muted-foreground break-all border border-border/30 bg-card/40 p-2.5 leading-relaxed max-h-20 overflow-y-auto">
                                {p.pixData.copiaECola}
                              </div>
                            </div>
                          )}
                          {p.pixData?.instructions && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Instruções PIX", "PIX Instructions", "Instrucciones de PIX")}</div>
                              <div className="font-mono text-[11px] text-muted-foreground border border-border/30 bg-card/40 p-2.5">{p.pixData.instructions}</div>
                            </div>
                          )}
                          {p.boletoData?.barcode && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Código de Barras", "Barcode", "Código de barras")}</div>
                              <div className="font-mono text-[11px] text-muted-foreground break-all border border-border/30 bg-card/40 p-2.5">{p.boletoData.barcode}</div>
                              {p.boletoData.barcodeUrl && (
                                <a href={p.boletoData.barcodeUrl} target="_blank" rel="noreferrer"
                                   className="inline-flex items-center gap-1 font-mono text-[10px] text-primary mt-1 hover:underline">
                                  <ArrowUpRight className="h-3 w-3" />{t("Abrir PDF do boleto", "Open boleto PDF", "Abrir PDF del boleto")}
                                </a>
                              )}
                            </div>
                          )}
                          {p.externalId && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("ID Asaas", "Asaas ID", "ID de Asaas")}</div>
                              <div className="font-mono text-[11px] text-muted-foreground border border-border/30 bg-card/40 p-2.5">{p.externalId}</div>
                            </div>
                          )}
                          {p.expiresAt && (
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Expira em", "Expires on", "Vence el")}</div>
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
              <Activity className="h-3.5 w-3.5" />{t("Webhook Asaas — Confirmação Automática", "Asaas Webhook — Automatic Confirmation", "Webhook de Asaas — Confirmación automática")}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
              {t("Configure no painel Asaas → Integrações → Webhooks:", "Configure in the Asaas dashboard → Integrations → Webhooks:", "Configura en el panel de Asaas → Integraciones → Webhooks:")}
            </div>
            <div className="font-mono text-[11px] bg-card/60 border border-border/40 px-3 py-2 text-primary break-all">
              {`${window.location.origin}/api/billing/webhooks/asaas`}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40">
              {t("Eventos:", "Events:", "Eventos:")} PAYMENT_RECEIVED · PAYMENT_CONFIRMED — {t("Confirmação automática ao receber PIX ou boleto pago", "Automatic confirmation when a PIX or boleto payment is received", "Confirmación automática al recibir un pago PIX o boleto")}
            </div>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="border border-border/50 bg-card/40 overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_90px_70px_80px_80px_120px] text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b border-border/50 bg-muted/10 px-5 py-2.5 gap-4">
              <span>{t("Usuário / Workspace", "User / Workspace", "Usuario / Espacio de trabajo")}</span>
              <span className="text-right">{t("Plano", "Plan", "Plan")}</span>
              <span className="text-right">{t("Camp.", "Campaigns", "Camp.")}</span>
              <span className="text-right">{t("Créditos", "Credits", "Créditos")}</span>
              <span className="text-right">{t("Dias", "Days", "Días")}</span>
              <span className="text-right">{t("Status", "Status", "Estado")}</span>
            </div>

            {loadingOverview ? (
              <div className="p-8 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
            ) : !ov?.users?.length ? (
              <div className="py-16 text-center">
                <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">{t("Nenhum usuário registrado.", "No users registered.", "No hay usuarios registrados.")}</p>
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
                        <div className="text-[11px] text-muted-foreground/40 font-mono mt-0.5">{fmtDate(u.createdAt, intlLocale(locale))}</div>
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
                          title={t("Liberar acesso ao plano sem pagamento", "Grant plan access without payment", "Conceder acceso al plan sin pago")}
                        >
                          🎟 {t("Liberar", "Grant", "Conceder")}
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
                <h3 className="font-mono text-base font-bold uppercase tracking-widest text-foreground">🎟 {t("Liberar Acesso", "Grant Access", "Conceder Acceso")}</h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">{grantTarget.userName}</p>
              </div>
              <button onClick={() => setGrantTarget(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-2">{t("Plano", "Plan", "Plan")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["solo", "agency"] as const).map(p => (
                    <button key={p} onClick={() => setGrantPlan(p)}
                      className={`border py-2.5 font-mono text-xs uppercase tracking-widest transition-all ${grantPlan === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/30"}`}>
                      {p === "solo" ? t("Solo — Individual", "Solo — Individual", "Solo — Individual") : "Agency"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 block mb-1.5">{t("Motivo (opcional)", "Reason (optional)", "Motivo (opcional)")}</label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={e => setGrantNote(e.target.value)}
                  placeholder={t("Ex: código promocional, parceria, teste...", "E.g. promotional code, partnership, trial...", "Ej.: código promocional, colaboración, prueba...")}
                  className="w-full px-3 py-2 bg-card/60 border border-border/50 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
              <p className="font-mono text-[11px] text-yellow-400/80">
                ⚡ {t("Isso vai atualizar o plano de", "This will change the plan from", "Esto cambiará el plan de")} <strong>{grantTarget.currentPlan.toUpperCase()}</strong> → <strong>{grantPlan.toUpperCase()}</strong> {t("e adicionar os créditos do plano.", "and add the plan credits.", "y añadirá los créditos del plan.")}
              </p>
            </div>

            <Button
              onClick={() => grantPlanMutation.mutate({ workspaceId: grantTarget.workspaceId, planSlug: grantPlan, note: grantNote })}
              disabled={grantPlanMutation.isPending}
              className="w-full font-mono uppercase tracking-widest rounded-none btn-weapon-primary"
            >
              {grantPlanMutation.isPending ? t("Liberando...", "Granting...", "Concediendo...") : `${t("Liberar Acesso", "Grant Access", "Conceder Acceso")} ${grantPlan.toUpperCase()} →`}
            </Button>
          </div>
        </div>
      )}

      {/* ─── TAB: SOLICITAÇÕES ─────────────────────────────────────────────────── */}
      {tab === "solicitacoes" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">📋 {t("Solicitações de Acesso", "Access Requests", "Solicitudes de acceso")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {waitlistData?.total ?? 0} {t("total", "total", "en total")} ·{" "}
                {(waitlistData?.entries ?? []).filter(e => !e.notified).length} {t("pendentes", "pending", "pendientes")}
              </p>
            </div>
            <Button size="sm" variant="outline" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2" onClick={() => void refetchWaitlist()}>
              <RefreshCw className="h-3 w-3" /> {t("Atualizar", "Refresh", "Actualizar")}
            </Button>
          </div>

          <div className="border border-primary/10 bg-primary/5 px-4 py-3 font-mono text-[11px] text-primary/70 uppercase tracking-widest">
            💡 {t("Para liberar acesso: gere um código para o plano desejado e envie pelo WhatsApp. O usuário usa o código na tela de cadastro.", "To grant access: generate a code for the desired plan and send it via WhatsApp. The user enters the code on the registration page.", "Para conceder acceso: genera un código para el plan deseado y envíalo por WhatsApp. El usuario lo introduce en la página de registro.")}
          </div>

          {loadingWaitlist ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-none" />)}</div>
          ) : !waitlistData?.entries || waitlistData.entries.length === 0 ? (
            <div className="border border-border/30 bg-card/20 p-12 text-center">
              <p className="font-mono text-sm text-muted-foreground/50">{t("Nenhuma solicitação no momento.", "No requests right now.", "No hay solicitudes en este momento.")}</p>
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
                          {entry.notified ? t("Aprovado", "Approved", "Aprobado") : t("Pendente", "Pending", "Pendiente")}
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
                          <Calendar className="h-3 w-3" /> {fmtDate(entry.createdAt, intlLocale(locale))}
                        </span>
                      </div>
                      {approveCodeResult[entry.id] && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-mono text-sm font-black text-primary tracking-widest border border-primary/30 bg-primary/10 px-3 py-1">
                            {approveCodeResult[entry.id]}
                          </span>
                          <Button size="sm" variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-2 btn-weapon-outline gap-1"
                            onClick={async () => { try { await navigator.clipboard.writeText(approveCodeResult[entry.id]!); toast.success(t("Copiado!", "Copied!", "¡Copiado!")); } catch { /* ignore */ } }}>
                            <Copy className="h-3 w-3" /> {t("Copiar", "Copy", "Copiar")}
                          </Button>
                          <a href={`https://wa.me/55${entry.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(t(`Olá ${entry.name}! Seu código de acesso NexOS: *${approveCodeResult[entry.id]}* — acesse: https://agencianexos.vip/app/register`, `Hi ${entry.name}! Your NexOS access code is: *${approveCodeResult[entry.id]}* — register here: https://agencianexos.vip/app/register`, `¡Hola ${entry.name}! Tu código de acceso de NexOS es: *${approveCodeResult[entry.id]}* — regístrate aquí: https://agencianexos.vip/app/register`))}`}
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
                            {approveLoading === entry.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : `${t("Solo", "Solo", "Solo")} →`}
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
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">🎟️ {t("Códigos de Convite — NexOS", "Invite Codes — NexOS", "Códigos de invitación — NexOS")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {(inviteCodes ?? []).filter(c => !c.used).length} {t("disponíveis", "available", "disponibles")} ·{" "}
                {(inviteCodes ?? []).filter(c => c.used).length} {t("utilizados", "used", "utilizados")}
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
                {generateInvitesMutation.isPending ? <><RefreshCw className="h-3 w-3 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</> : `+ 10 ${t("Individual", "Individual", "Individual")}`}
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
            💡 {t("Para usar: na tela de cadastro do NexOS, o convidado digita o código de convite e ganha acesso ao plano correspondente sem pagar.", "How to use: on the NexOS registration page, the invitee enters the code to access the corresponding plan at no cost.", "Uso: en la página de registro de NexOS, el invitado introduce el código y obtiene acceso al plan correspondiente sin pagar.")}
          </p>

          {loadingInvites ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}</div>
          ) : !inviteCodes || inviteCodes.length === 0 ? (
            <div className="border border-border/30 bg-card/20 p-12 text-center space-y-3">
              <p className="font-mono text-sm text-muted-foreground/50">{t("Nenhum código gerado ainda.", "No codes generated yet.", "Aún no se generaron códigos.")}</p>
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
                   ⚪ {t("Disponíveis", "Available", "Disponibles")} — {inviteCodes.filter(c => !c.used).length}
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
                              try { await navigator.clipboard.writeText(c.code); toast.success(t("Copiado!", "Copied!", "¡Copiado!")); } catch { /* ignore */ }
                            }}
                          >
                             {t("Copiar", "Copy", "Copiar")}
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="rounded-none h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => { if (confirm(t(`Remover código ${c.code}?`, `Remove code ${c.code}?`, `¿Eliminar el código ${c.code}?`))) deleteInviteMutation.mutate(c.id); }}
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
                     ✅ {t("Usuários Ativos", "Active Users", "Usuarios activos")} — {inviteCodes.filter(c => c.used).length} {t("código(s) utilizados", "code(s) used", "código(s) utilizados")}
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
                            <p className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">{t("Ativado em", "Activated on", "Activado el")} {fmtDate(c.usedAt, intlLocale(locale))}</p>
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
            <h2 className="font-mono text-lg uppercase tracking-widest font-bold">🔍 {t("Rastreamento de PDFs", "PDF Tracking", "Seguimiento de PDF")}</h2>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              {t("Cole o fingerprint encontrado em um PDF vazado para identificar o titular da cópia", "Paste the fingerprint found in a leaked PDF to identify the copy's owner", "Pega la huella encontrada en un PDF filtrado para identificar al titular de la copia")}
            </p>
          </div>

          <div className="border border-primary/20 bg-primary/[0.03] p-5 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary/60">
              {t("Fingerprint do Documento", "Document Fingerprint", "Huella del documento")}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fpSearch}
                onChange={e => setFpSearch(e.target.value.toUpperCase().trim())}
                placeholder={t("NXS-XXXX-XXXX", "NXS-XXXX-XXXX", "NXS-XXXX-XXXX")}
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
                {fpLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Target className="h-3.5 w-3.5" />{t("Rastrear", "Track", "Rastrear")}</>}
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/40">
              {t("O fingerprint está no rodapé e capa de cada PDF. Formato:", "The fingerprint appears in the footer and cover of each PDF. Format:", "La huella aparece en el pie y la portada de cada PDF. Formato:")} NXS-XXXX-XXXX
            </p>
          </div>

          {fpResult && (
            <div className={`border p-5 space-y-4 ${fpResult.found ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
              {!fpResult.found ? (
                <div className="flex items-center gap-3">
                  <X className="h-5 w-5 text-destructive" />
                  <div>
                    <div className="font-mono text-sm font-bold text-destructive">{t("Fingerprint não encontrado", "Fingerprint not found", "Huella digital no encontrada")}</div>
                    <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
                      {t("Código não registrado. PDF pode ter sido gerado antes do sistema de rastreamento.", "Code not registered. The PDF may have been generated before tracking was enabled.", "Código no registrado. El PDF pudo haberse generado antes de habilitar el seguimiento.")}
                    </div>
                  </div>
                </div>
              ) : fpResult.record ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-mono text-sm font-bold text-success uppercase tracking-widest">{t("Titular Identificado", "Owner Identified", "Titular identificado")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {([
                      ["Fingerprint",   fpResult.record.fingerprint],
                      [t("Nome", "Name", "Nombre"), fpResult.record.userName],
                      [t("Email", "Email", "Correo electrónico"), fpResult.record.userEmail],
                      [t("ID de Conta", "Account ID", "ID de cuenta"), fpResult.record.userId],
                      [t("Workspace", "Workspace", "Espacio de trabajo"), fpResult.record.workspaceName],
                      [t("Campanha", "Campaign", "Campaña"), fpResult.record.campaignTitle ?? fpResult.record.campaignId],
                      [t("Track", "Track", "Track"), fpResult.record.track ?? "—"],
                      [t("Gerado em", "Generated on", "Generado el"), new Date(fpResult.record.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
                      [t("IP do Download", "Download IP", "IP de descarga"), fpResult.record.ipAddress ?? "—"],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="border border-border/30 bg-background/50 px-4 py-3">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">{label}</div>
                        <div className="font-mono text-sm text-foreground font-bold break-all">{value}</div>
                      </div>
                    ))}
                  </div>
                  {fpResult.record.userAgent && (
                    <div className="border border-border/20 bg-muted/10 px-4 py-2">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{t("Agente do navegador", "User Agent", "Agente de usuario")}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/60 break-all">{fpResult.record.userAgent}</div>
                    </div>
                  )}
                  <Button size="sm" variant="outline"
                    className="rounded-none font-mono text-[11px] uppercase tracking-widest h-7 px-3 gap-1 btn-weapon-outline"
                    onClick={() => { if (fpResult.record) setProfileUserId(fpResult.record.userId); }}>
                    <Users className="h-3 w-3" />{t("Ver Perfil Completo", "View Full Profile", "Ver perfil completo")}
                  </Button>
                </>
              ) : null}
            </div>
          )}

          <FingerprintDownloadsList />
        </div>
      )}

      {/* ─── TAB: CRM ──────────────────────────────────────────────────────── */}
      {tab === "crm" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">👥 CRM — {t("Gestão de Clientes", "Customer Management", "Gestión de clientes")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">{t("Pipeline de relacionamento com todos os workspaces. Estágios e notas salvos localmente.", "Relationship pipeline for all workspaces. Stages and notes are saved locally.", "Pipeline de relaciones para todos los espacios de trabajo. Las etapas y notas se guardan localmente.")}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-none font-mono text-xs btn-weapon-outline gap-2 shrink-0" onClick={() => refetchCRM()}>
              <RefreshCw className="h-3 w-3" /> {t("Atualizar", "Refresh", "Actualizar")}
            </Button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 border border-border/40 bg-card/20 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input type="text" placeholder={t("Buscar por nome, email ou plano...", "Search by name, email or plan...", "Buscar por nombre, correo o plan...")} value={crmSearch}
              onChange={e => setCrmSearch(e.target.value)}
              className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/40" />
            {crmSearch && <button onClick={() => setCrmSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground/50" /></button>}
          </div>

          {loadingCRM ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-none bg-muted/20" />)}</div>
          ) : (() => {
            const CRM_STAGES = ["Prospect", "Trial", "Ativo", "Churn Risk", "Churned"];
            const stageLabel = (stage: string) =>
              stage === "Prospect" ? t("Prospect", "Prospect", "Prospecto")
                : stage === "Trial" ? t("Teste", "Trial", "Prueba")
                : stage === "Ativo" ? t("Ativo", "Active", "Activo")
                : stage === "Churn Risk" ? t("Risco de cancelamento", "Churn Risk", "Riesgo de cancelación")
                : stage === "Churned" ? t("Cancelado", "Churned", "Cancelado")
                : stage;
            const STAGE_COLORS: Record<string, string> = {
              Prospect: "text-blue-400 border-blue-400/30 bg-blue-400/10",
              Trial: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
              Ativo: "text-green-400 border-green-400/30 bg-green-400/10",
              "Churn Risk": "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
              Churned: "text-red-400/60 border-red-400/20 bg-red-400/5",
            };

            function autoStage(c: CRMClient): string {
              if (crmStages[c.workspaceId]) return crmStages[c.workspaceId]!;
              if (c.workspaceStatus === "suspended") return "Churn Risk";
              if (c.totalRevCents === 0 && c.totalCampaigns === 0) return "Prospect";
              if (c.totalRevCents === 0) return "Trial";
              const daysSince = (Date.now() - new Date(c.createdAt).getTime()) / 86400000;
              if (c.totalCampaigns === 0 && daysSince > 14) return "Churned";
              return "Ativo";
            }

            const clients = (crmData?.clients ?? []).filter(c =>
              !crmSearch ||
              c.userName.toLowerCase().includes(crmSearch.toLowerCase()) ||
              c.email.toLowerCase().includes(crmSearch.toLowerCase()) ||
              (c.planSlug ?? "").toLowerCase().includes(crmSearch.toLowerCase()) ||
              c.workspaceName.toLowerCase().includes(crmSearch.toLowerCase())
            );

            const selectedClient = crmSelected ? clients.find(c => c.workspaceId === crmSelected) ?? null : null;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                {/* Client list */}
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_80px_70px_80px_100px_28px] gap-2 px-3 pb-1 border-b border-border/30">
                    {[t("Cliente / Email", "Customer / Email", "Cliente / Correo"), t("Plano", "Plan", "Plan"), t("Receita", "Revenue", "Ingresos"), t("Campanhas", "Campaigns", "Campañas"), t("Estágio", "Stage", "Etapa"), ""].map((h,i) => (
                      <span key={i} className={`font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 ${i > 0 ? "text-right" : ""}`}>{h}</span>
                    ))}
                  </div>
                  {clients.length === 0 && (
                    <div className="border border-border/20 p-8 text-center font-mono text-xs text-muted-foreground/40">{t("Nenhum cliente encontrado", "No customers found", "No se encontraron clientes")}</div>
                  )}
                  {clients.map(c => {
                    const stage = autoStage(c);
                    const isSelected = crmSelected === c.workspaceId;
                    return (
                      <button key={c.workspaceId} onClick={() => { setCrmSelected(isSelected ? null : c.workspaceId); setCrmNoteEdit(crmNotes[c.workspaceId] ?? ""); }}
                        className={`w-full grid grid-cols-[1fr_80px_70px_80px_100px_28px] gap-2 px-3 py-2.5 items-center text-left border transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "border-border/20 hover:bg-white/[0.02]"}`}>
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold truncate">{c.userName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/50 truncate">{c.email}</div>
                        </div>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 border text-right ${c.planSlug === "agency" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                          {c.planSlug ?? "—"}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-right text-foreground/70">
                          {(c.totalRevCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-right text-muted-foreground/60">{c.totalCampaigns}</span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 border text-center ${STAGE_COLORS[stage] ?? ""}`}>{stageLabel(stage)}</span>
                        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </button>
                    );
                  })}
                </div>

                {/* Detail drawer */}
                {selectedClient && (
                  <div className="border border-border/40 bg-card/30 p-5 space-y-4 lg:sticky lg:top-4 self-start">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-base font-bold">{selectedClient.userName}</div>
                        <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{selectedClient.email}</div>
                        {selectedClient.phone && <div className="font-mono text-xs text-muted-foreground/50">{selectedClient.phone}</div>}
                      </div>
                      <button onClick={() => setCrmSelected(null)} className="text-muted-foreground/40 hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: t("Receita total", "Total Revenue", "Ingresos totales"), val: (selectedClient.totalRevCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
                        { label: t("Pagamentos", "Payments", "Pagos"), val: `${selectedClient.paymentCount}×` },
                        { label: t("Campanhas", "Campaigns", "Campañas"), val: String(selectedClient.totalCampaigns) },
                        { label: t("Créditos", "Credits", "Créditos"), val: String(selectedClient.creditsBalance) },
                        { label: t("Plano", "Plan", "Plan"), val: selectedClient.planName ?? "—" },
                        { label: t("Desde", "Since", "Desde"), val: new Date(selectedClient.createdAt).toLocaleDateString("pt-BR") },
                      ].map(({ label, val }) => (
                        <div key={label} className="border border-border/30 bg-card/20 px-3 py-2">
                          <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">{label}</div>
                          <div className="font-mono text-sm font-bold mt-0.5">{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Stage override */}
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">{t("Estágio no Pipeline", "Pipeline Stage", "Etapa del pipeline")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {["Prospect","Trial","Ativo","Churn Risk","Churned"].map(s => (
                          <button key={s} onClick={() => {
                            const updated = { ...crmStages, [selectedClient.workspaceId]: s };
                            setCrmStages(updated);
                            localStorage.setItem("nexos_crm_stages", JSON.stringify(updated));
                          }} className={`font-mono text-[10px] px-2 py-1 border transition-colors ${
                            (crmStages[selectedClient.workspaceId] ?? "Ativo") === s
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border/40 text-muted-foreground/60 hover:border-border"
                          }`}>{stageLabel(s)}</button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">{t("Notas internas", "Internal Notes", "Notas internas")}</div>
                      <textarea value={crmNoteEdit} onChange={e => setCrmNoteEdit(e.target.value)}
                        placeholder={t("Contexto, histórico de conversa, próximos passos...", "Context, conversation history, next steps...", "Contexto, historial de conversación, próximos pasos...")}
                        className="w-full h-24 bg-card/30 border border-border/40 font-mono text-xs p-2 text-foreground placeholder:text-muted-foreground/30 outline-none resize-none" />
                      <Button size="sm" className="font-mono text-xs mt-2 w-full" onClick={() => {
                        const updated = { ...crmNotes, [selectedClient.workspaceId]: crmNoteEdit };
                        setCrmNotes(updated);
                        localStorage.setItem("nexos_crm_notes", JSON.stringify(updated));
                        toast.success(t("Nota salva", "Note saved", "Nota guardada"));
                      }}>{t("Salvar nota", "Save note", "Guardar nota")}</Button>
                    </div>

                    {/* Last note preview */}
                    {crmNotes[selectedClient.workspaceId] && (
                      <div className="border-l-2 border-primary/40 pl-3 py-1">
                        <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-1">{t("Nota salva", "Saved Note", "Nota guardada")}</div>
                        <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{crmNotes[selectedClient.workspaceId]}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── TAB: DRE ──────────────────────────────────────────────────────── */}
      {tab === "dre" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">📊 DRE — {t("Resultado do Exercício", "Income Statement", "Estado de resultados")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">{t("Receita real × Impostos estimados (Simples 6%) × Custo IA = Resultado mensal", "Actual revenue × Estimated taxes (Simples 6%) × AI cost = Monthly result", "Ingresos reales × Impuestos estimados (Simples 6%) × Costo de IA = Resultado mensual")}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={dreYear} onChange={e => setDreYear(Number(e.target.value))}
                className="font-mono text-xs bg-card border border-border/40 px-2 py-1.5 text-foreground outline-none">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button variant="outline" size="sm" className="rounded-none font-mono text-xs btn-weapon-outline gap-1.5 shrink-0" onClick={() => refetchDRE()}>
                <RefreshCw className="h-3 w-3" /> {t("Atualizar", "Refresh", "Actualizar")}
              </Button>
            </div>
          </div>

          {loadingDRE ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-none bg-muted/20" />)}</div>
          ) : (() => {
            const rows = dreData?.rows ?? [];
            const totals = rows.reduce((acc, r) => ({
              receitaBruta: acc.receitaBruta + r.receitaBrutaCents,
              impostos:     acc.impostos     + r.impostosCents,
              receitaLiq:   acc.receitaLiq   + r.receitaLiquidaCents,
              aiCost:       acc.aiCost       + r.aiCostBrlCents,
              lucro:        acc.lucro        + r.lucroBrutoCents,
              clientes:     acc.clientes     + r.newClients,
              aiCalls:      acc.aiCalls      + r.aiCalls,
            }), { receitaBruta: 0, impostos: 0, receitaLiq: 0, aiCost: 0, lucro: 0, clientes: 0, aiCalls: 0 });

            const fmt = (cents: number) =>
              (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
            const fmtSigned = (cents: number) =>
              `${cents >= 0 ? "+" : ""}${fmt(cents)}`;
            const maxRev = Math.max(...rows.map(r => r.receitaBrutaCents), 1);

            return (
              <>
                {/* Annual summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label={`${t("Receita Bruta", "Gross Revenue", "Ingresos brutos")} ${dreYear}`} value={fmt(totals.receitaBruta)} sub={`${totals.clientes} ${t("pagamentos", "payments", "pagos")}`} icon={Banknote} color="text-green-400" border="border-green-400/20" />
                  <MetricCard label={t("Impostos (Simples 6%)", "Taxes (Simples 6%)", "Impuestos (Simples 6%)")} value={fmt(totals.impostos)} sub={t("estimativa", "estimate", "estimación")} icon={Receipt} color="text-yellow-400" border="border-yellow-400/20" />
                  <MetricCard label={t("Custo IA (BRL)", "AI Cost (BRL)", "Costo de IA (BRL)")} value={fmt(totals.aiCost)} sub={`${totals.aiCalls.toLocaleString("pt-BR")} ${t("chamadas", "calls", "llamadas")}`} icon={Zap} color="text-orange-400" border="border-orange-400/20" />
                  <MetricCard label={t("Resultado Bruto", "Gross Result", "Resultado bruto")} value={fmt(totals.lucro)} sub={`${totals.receitaBruta > 0 ? ((totals.lucro / totals.receitaBruta) * 100).toFixed(1) : "0"}% ${t("margem", "margin", "margen")}`} icon={TrendingUp} color={totals.lucro >= 0 ? "text-primary" : "text-destructive"} border={totals.lucro >= 0 ? "border-primary/20" : "border-destructive/20"} />
                </div>

                {/* Monthly table */}
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        {[t("Mês", "Month", "Mes"), t("Rec. Bruta", "Gross Rev.", "Ing. brutos"), t("Impostos", "Taxes", "Impuestos"), t("Rec. Líq.", "Net Rev.", "Ing. netos"), t("Custo IA", "AI Cost", "Costo de IA"), t("Despesas", "Expenses", "Gastos"), t("Resultado", "Result", "Resultado"), t("Margem", "Margin", "Margen")].map(h => (
                          <th key={h} className="px-3 py-2 text-right first:text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const despCents = (dreExpenses[r.month] ?? 0) * 100;
                        const resultadoFinal = r.lucroBrutoCents - despCents;
                        const marginPct = r.receitaBrutaCents > 0 ? (resultadoFinal / r.receitaBrutaCents) * 100 : 0;
                        const isEditing = dreExpenseEdit?.month === r.month;
                        return (
                          <tr key={r.month} className={`border-b border-border/20 hover:bg-white/[0.02] ${r.receitaBrutaCents === 0 ? "opacity-40" : ""}`}>
                            <td className="px-3 py-2.5 font-bold text-foreground/80">{r.label}</td>
                            <td className="px-3 py-2.5 text-right text-green-400/80 tabular-nums">{fmt(r.receitaBrutaCents)}</td>
                            <td className="px-3 py-2.5 text-right text-yellow-400/70 tabular-nums">−{fmt(r.impostosCents)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground/70">{fmt(r.receitaLiquidaCents)}</td>
                            <td className="px-3 py-2.5 text-right text-orange-400/70 tabular-nums">−{fmt(r.aiCostBrlCents)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {isEditing ? (
                                <input autoFocus type="number" value={dreExpenseEdit.val}
                                  onChange={e => setDreExpenseEdit({ month: r.month, val: e.target.value })}
                                  onBlur={() => {
                                    const v = parseFloat(dreExpenseEdit.val) || 0;
                                    const upd = { ...dreExpenses, [r.month]: v };
                                    setDreExpenses(upd);
                                    localStorage.setItem("nexos_dre_expenses", JSON.stringify(upd));
                                    setDreExpenseEdit(null);
                                  }}
                                  onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                  className="w-24 bg-card border border-primary/40 text-foreground px-1 py-0.5 font-mono text-xs outline-none text-right" />
                              ) : (
                                <button onClick={() => setDreExpenseEdit({ month: r.month, val: String(dreExpenses[r.month] ?? 0) })}
                                  className="text-red-400/70 hover:text-red-400 transition-colors tabular-nums">
                                  {despCents > 0 ? `−${fmt(despCents)}` : <span className="text-muted-foreground/30">+{t("despesa", "expense", "gasto")}</span>}
                                </button>
                              )}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${resultadoFinal >= 0 ? "text-primary" : "text-destructive"}`}>
                              {fmtSigned(resultadoFinal)}
                            </td>
                            <td className={`px-3 py-2.5 text-right text-[11px] tabular-nums ${marginPct >= 50 ? "text-green-400" : marginPct >= 20 ? "text-yellow-400" : marginPct < 0 ? "text-destructive" : "text-muted-foreground/60"}`}>
                              {r.receitaBrutaCents > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/60 bg-card/20">
                        <td className="px-3 py-3 font-bold text-foreground uppercase text-[11px] tracking-widest">{t("TOTAL", "TOTAL", "TOTAL")}</td>
                        <td className="px-3 py-3 text-right font-bold text-green-400 tabular-nums">{fmt(totals.receitaBruta)}</td>
                        <td className="px-3 py-3 text-right font-bold text-yellow-400 tabular-nums">−{fmt(totals.impostos)}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">{fmt(totals.receitaLiq)}</td>
                        <td className="px-3 py-3 text-right font-bold text-orange-400 tabular-nums">−{fmt(totals.aiCost)}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-400/70 tabular-nums">
                          {Object.values(dreExpenses).reduce((a,b) => a+b, 0) > 0
                            ? `−${fmt(Object.values(dreExpenses).reduce((a,b) => a+b, 0) * 100)}`
                            : "—"}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold text-lg tabular-nums ${totals.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                          {fmtSigned(totals.lucro - Object.values(dreExpenses).reduce((a,b) => a+b, 0) * 100)}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold tabular-nums ${totals.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                          {totals.receitaBruta > 0 ? `${((totals.lucro / totals.receitaBruta) * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/40">
                  {t('* Impostos estimados pelo regime Simples Nacional (6% sobre receita bruta). Clique na coluna "Despesas" para registrar despesas operacionais mensais. Consulte seu contador para cálculos oficiais.', '* Taxes are estimated under Simples Nacional (6% of gross revenue). Click the "Expenses" column to record monthly operating expenses. Consult your accountant for official calculations.', '* Impuestos estimados según el régimen Simples Nacional (6% de los ingresos brutos). Haz clic en la columna "Gastos" para registrar gastos operativos mensuales. Consulta a tu contador para cálculos oficiales.')}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* ─── TAB: FISCAL ───────────────────────────────────────────────────── */}
      {tab === "fiscal" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">🧾 {t("Fiscal — Apuração de Impostos", "Tax — Tax Assessment", "Fiscal — Cálculo de impuestos")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">{t("Estimativa de DAS mensal (Simples Nacional) e composição tributária. Não substitui a assessoria contábil.", "Estimated monthly DAS (Simples Nacional) and tax breakdown. This is not a substitute for accounting advice.", "Estimación mensual del DAS (Simples Nacional) y composición tributaria. No sustituye la asesoría contable.")}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={dreYear} onChange={e => setDreYear(Number(e.target.value))}
                className="font-mono text-xs bg-card border border-border/40 px-2 py-1.5 text-foreground outline-none">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button variant="outline" size="sm" className="rounded-none font-mono text-xs btn-weapon-outline gap-1.5 shrink-0" onClick={() => window.print()}>
                <Printer className="h-3 w-3" /> {t("Imprimir", "Print", "Imprimir")}
              </Button>
            </div>
          </div>

          {/* Regime info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-primary/20 bg-primary/5 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-1">{t("Regime Tributário", "Tax Regime", "Régimen tributario")}</div>
              <div className="font-mono text-lg font-bold">{t("Simples Nacional", "Simples Nacional", "Simples Nacional")}</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">{t("Anexo III — SaaS/Serviços de TI", "Annex III — SaaS/IT Services", "Anexo III — SaaS/Servicios de TI")}</div>
            </div>
            <div className="border border-border/30 bg-card/20 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Alíquota Efetiva Estimada", "Estimated Effective Rate", "Tasa efectiva estimada")}</div>
              <div className="font-mono text-lg font-bold text-yellow-400">~6,00%</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">{t("Sobre receita bruta (1ª faixa)", "On gross revenue (1st bracket)", "Sobre ingresos brutos (1.er tramo)")}</div>
            </div>
            <div className="border border-border/30 bg-card/20 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Competência", "Tax Period", "Período fiscal")}</div>
              <div className="font-mono text-lg font-bold">{dreYear}</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">{t("DAS vence todo dia 20", "DAS is due on the 20th of each month", "El DAS vence el día 20 de cada mes")}</div>
            </div>
          </div>

          {/* Composição Simples Nacional Anexo III */}
          <div className="border border-border/40 bg-card/20 p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-4">{t("Composição Tributária — Simples Nacional Anexo III (1ª Faixa)", "Tax Breakdown — Simples Nacional Annex III (1st Bracket)", "Composición tributaria — Simples Nacional Anexo III (1.er tramo)")}</div>
            <div className="space-y-2">
              {[
                { tributo: "IRPJ", pct: 0.25, desc: t("Imposto de Renda Pessoa Jurídica", "Corporate Income Tax", "Impuesto sobre la renta corporativa") },
                { tributo: "CSLL", pct: 1.15, desc: t("Contribuição Social sobre Lucro Líquido", "Social Contribution on Net Income", "Contribución social sobre la renta neta") },
                { tributo: "COFINS", pct: 0.74, desc: t("Contribuição para Fins Sociais", "Social Security Financing Contribution", "Contribución para fines sociales") },
                { tributo: "PIS/Pasep", pct: 0.13, desc: t("Programa de Integração Social", "Social Integration Program", "Programa de Integración Social") },
                { tributo: "CPP", pct: 3.45, desc: t("Contribuição Patronal Previdenciária", "Employer Social Security Contribution", "Contribución patronal a la seguridad social") },
                { tributo: "ISS", pct: 0.30, desc: t("Imposto sobre Serviços (mín. 2% — varia por município)", "Service Tax (min. 2% — varies by municipality)", "Impuesto sobre servicios (mín. 2% — varía según el municipio)") },
              ].map(({ tributo, pct, desc }) => (
                <div key={tributo} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <span className="font-mono text-xs font-bold text-foreground">{tributo}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(pct / 6) * 100}%` }} />
                  </div>
                  <div className="w-12 text-right font-mono text-xs tabular-nums text-primary">{pct.toFixed(2)}%</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 hidden md:block">{desc}</div>
                </div>
              ))}
              <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest">{t("Total DAS", "Total DAS", "Total DAS")}</span>
                <span className="font-mono text-sm font-bold text-yellow-400">6,02%</span>
              </div>
            </div>
          </div>

          {/* Monthly DAS table */}
          {loadingDRE ? (
            <Skeleton className="h-48 rounded-none bg-muted/20" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {[t("Mês", "Month", "Mes"), t("Rec. Bruta", "Gross Rev.", "Ing. brutos"), t("Alíquota", "Rate", "Tasa"), t("DAS Estimado", "Estimated DAS", "DAS estimado"), "IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ISS"].map(h => (
                      <th key={h} className="px-2 py-2 text-right first:text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dreData?.rows ?? []).map(r => {
                    const b = r.receitaBrutaCents / 100;
                    const das     = b * 0.0602;
                    const irpj    = b * 0.0025;
                    const csll    = b * 0.0115;
                    const cofins  = b * 0.0074;
                    const pis     = b * 0.0013;
                    const cpp     = b * 0.0345;
                    const iss     = b * 0.0030;
                    const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
                    return (
                      <tr key={r.month} className={`border-b border-border/20 hover:bg-white/[0.02] ${r.receitaBrutaCents === 0 ? "opacity-35" : ""}`}>
                        <td className="px-2 py-2.5 font-bold">{r.label}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-green-400/80">{fmtR(b)}</td>
                        <td className="px-2 py-2.5 text-right text-yellow-400/70">6,02%</td>
                        <td className="px-2 py-2.5 text-right font-bold tabular-nums text-yellow-300">{fmtR(das)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(irpj)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(csll)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(cofins)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(pis)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(cpp)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground/60">{fmtR(iss)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/60 bg-card/20 font-bold">
                    <td className="px-2 py-3 uppercase text-[10px] tracking-widest">{t("Total", "Total", "Total")} {dreYear}</td>
                    {(() => {
                      const totalB = (dreData?.rows ?? []).reduce((a,r) => a + r.receitaBrutaCents / 100, 0);
                      const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
                      return <>
                        <td className="px-2 py-3 text-right text-green-400 tabular-nums">{fmtR(totalB)}</td>
                        <td className="px-2 py-3 text-right text-yellow-400">6,02%</td>
                        <td className="px-2 py-3 text-right text-yellow-300 text-sm tabular-nums">{fmtR(totalB * 0.0602)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0025)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0115)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0074)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0013)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0345)}</td>
                        <td className="px-2 py-3 text-right text-muted-foreground/60 tabular-nums">{fmtR(totalB * 0.0030)}</td>
                      </>;
                    })()}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="font-mono text-[10px] text-muted-foreground/40">
            ⚠️ {t("Estimativa automática baseada no Simples Nacional Anexo III, 1ª faixa. Alíquota de ISS varia por município. Consulte seu contador para apuração oficial e emissão de NF-e/NFS-e.", "Automatic estimate based on Simples Nacional Annex III, 1st bracket. The ISS rate varies by municipality. Consult your accountant for official assessment and NF-e/NFS-e issuance.", "Estimación automática basada en Simples Nacional Anexo III, 1.er tramo. La tasa del ISS varía según el municipio. Consulta a tu contador para el cálculo oficial y la emisión de NF-e/NFS-e.")}
          </p>
        </div>
      )}

      {/* ─── TAB: PROPOSTAS ────────────────────────────────────────────────── */}
      {tab === "propostas" && (() => {
        const statusColors: Record<Proposal["status"], string> = {
          rascunho: "text-muted-foreground border-border/40 bg-card/20",
          enviada:  "text-blue-400 border-blue-400/30 bg-blue-400/10",
          aceita:   "text-green-400 border-green-400/30 bg-green-400/10",
          recusada: "text-red-400/70 border-red-400/20 bg-red-400/5",
        };

        function saveAndUpdate(updated: Proposal[]) {
          saveProposals(updated);
          setProposals(updated);
        }

        function createProposal() {
          const id = `prop_${Date.now()}`;
          const p: Proposal = {
            id, status: "rascunho",
            clientName:  proposalForm.clientName  ?? "",
            clientEmail: proposalForm.clientEmail ?? "",
            items:       proposalForm.items        ?? [],
            notes:       proposalForm.notes        ?? "",
            createdAt:   new Date().toISOString(),
          };
          saveAndUpdate([p, ...proposals]);
          setProposalView("list");
          setProposalForm({ clientName: "", clientEmail: "", items: [], status: "rascunho", notes: "" });
          toast.success(t("Proposta criada!", "Proposal created!", "¡Propuesta creada!"));
        }

        const totalFor = (items: Proposal["items"]) =>
          items.reduce((a, i) => a + i.qty * i.priceCents, 0);
        const fmt = (cents: number) =>
          (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        return (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-mono text-lg uppercase tracking-widest font-bold">📋 {t("Propostas Comerciais", "Sales Proposals", "Propuestas comerciales")}</h2>
                <p className="font-mono text-xs text-muted-foreground/60 mt-1">{proposals.length} {t("proposta(s) · salvas localmente neste navegador", "proposal(s) · saved locally in this browser", "propuesta(s) · guardadas localmente en este navegador")}</p>
              </div>
              <div className="flex items-center gap-2">
                {proposalView !== "list" && (
                  <Button variant="outline" size="sm" className="rounded-none font-mono text-xs btn-weapon-outline gap-1.5"
                    onClick={() => { setProposalView("list"); setSelectedProposal(null); }}>
                    <ArrowLeft className="h-3.5 w-3.5" /> {t("Voltar", "Back", "Volver")}
                  </Button>
                )}
                {proposalView === "list" && (
                  <Button size="sm" className="rounded-none font-mono text-xs gap-1.5"
                    onClick={() => setProposalView("create")}>
                    <Plus className="h-3.5 w-3.5" /> {t("Nova Proposta", "New Proposal", "Nueva propuesta")}
                  </Button>
                )}
              </div>
            </div>

            {/* List */}
            {proposalView === "list" && (
              proposals.length === 0 ? (
                <div className="border border-border/20 bg-card/10 p-12 text-center space-y-3">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <div className="font-mono text-sm text-muted-foreground/50">{t("Nenhuma proposta ainda.", "No proposals yet.", "Aún no hay propuestas.")}</div>
                  <Button size="sm" className="font-mono gap-1.5" onClick={() => setProposalView("create")}>
                    <Plus className="h-3.5 w-3.5" /> {t("Criar primeira proposta", "Create your first proposal", "Crear la primera propuesta")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {proposals.map(p => (
                    <div key={p.id} className="border border-border/30 bg-card/20 px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-sm font-bold">{p.clientName || "—"}</span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${statusColors[p.status]}`}>{p.status === "rascunho" ? t("Rascunho", "Draft", "Borrador") : p.status === "enviada" ? t("Enviada", "Sent", "Enviada") : p.status === "aceita" ? t("Aceita", "Accepted", "Aceptada") : t("Recusada", "Declined", "Rechazada")}</span>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground/50">
                          {p.clientEmail} · {p.items.length} {t("item(ns)", "item(s)", "artículo(s)")} · {fmt(totalFor(p.items))} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status buttons */}
                        {p.status === "rascunho" && (
                          <button onClick={() => saveAndUpdate(proposals.map(x => x.id === p.id ? { ...x, status: "enviada" } : x))}
                            className="font-mono text-[10px] px-2 py-1 border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 transition-colors flex items-center gap-1">
                            <Send className="h-2.5 w-2.5" /> {t("Marcar enviada", "Mark as sent", "Marcar como enviada")}
                          </button>
                        )}
                        {p.status === "enviada" && <>
                          <button onClick={() => saveAndUpdate(proposals.map(x => x.id === p.id ? { ...x, status: "aceita" } : x))}
                            className="font-mono text-[10px] px-2 py-1 border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors flex items-center gap-1">
                            <CheckSquare className="h-2.5 w-2.5" /> {t("Aceita", "Accept", "Aceptar")}
                          </button>
                          <button onClick={() => saveAndUpdate(proposals.map(x => x.id === p.id ? { ...x, status: "recusada" } : x))}
                            className="font-mono text-[10px] px-2 py-1 border border-red-400/20 text-red-400/60 hover:bg-red-400/5 transition-colors flex items-center gap-1">
                            <XCircle className="h-2.5 w-2.5" /> {t("Recusada", "Decline", "Rechazar")}
                          </button>
                        </>}
                        <button onClick={() => { setSelectedProposal(p); setProposalView("detail"); }}
                          className="font-mono text-[10px] px-2 py-1 border border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1">
                          <FileText className="h-2.5 w-2.5" /> {t("Ver", "View", "Ver")}
                        </button>
                        <button onClick={() => { if (confirm(t("Deletar proposta?", "Delete proposal?", "¿Eliminar propuesta?"))) saveAndUpdate(proposals.filter(x => x.id !== p.id)); }}
                          className="font-mono text-[10px] px-2 py-1 border border-red-400/10 text-red-400/40 hover:bg-red-400/5 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Create form */}
            {proposalView === "create" && (
              <div className="border border-border/40 bg-card/20 p-6 space-y-5 max-w-2xl">
                <div className="font-mono text-sm font-bold uppercase tracking-widest">{t("Nova Proposta", "New Proposal", "Nueva propuesta")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Nome do Cliente", "Customer Name", "Nombre del cliente")}</label>
                    <input value={proposalForm.clientName} onChange={e => setProposalForm(p => ({ ...p, clientName: e.target.value }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("Ex: João Silva", "E.g. John Smith", "Ej.: Juan Pérez")} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("E-mail", "Email", "Correo electrónico")}</label>
                    <input value={proposalForm.clientEmail} onChange={e => setProposalForm(p => ({ ...p, clientEmail: e.target.value }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("cliente@empresa.com", "client@company.com", "cliente@empresa.com")} />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Itens / Serviços", "Items / Services", "Artículos / Servicios")}</label>
                    <button onClick={() => setProposalForm(p => ({
                      ...p, items: [...(p.items ?? []), { desc: "", qty: 1, unit: "un", priceCents: 0 }]
                    }))} className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" /> {t("Adicionar item", "Add item", "Agregar artículo")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(proposalForm.items ?? []).length === 0 && (
                      <div className="border border-dashed border-border/30 p-4 text-center font-mono text-[11px] text-muted-foreground/40">
                        {t("Nenhum item adicionado", "No items added", "No se agregaron artículos")}
                      </div>
                    )}
                    {(proposalForm.items ?? []).map((item, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_50px_50px_90px_24px] gap-2 items-center">
                        <input value={item.desc} onChange={e => setProposalForm(p => ({
                          ...p, items: p.items!.map((x,i) => i===idx ? { ...x, desc: e.target.value } : x)
                        }))} placeholder={t("Descrição do serviço", "Service description", "Descripción del servicio")} className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 outline-none text-foreground" />
                        <input type="number" value={item.qty} onChange={e => setProposalForm(p => ({
                          ...p, items: p.items!.map((x,i) => i===idx ? { ...x, qty: Number(e.target.value) } : x)
                        }))} className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 outline-none text-foreground text-center" min={1} />
                        <input value={item.unit} onChange={e => setProposalForm(p => ({
                          ...p, items: p.items!.map((x,i) => i===idx ? { ...x, unit: e.target.value } : x)
                        }))} className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 outline-none text-foreground text-center" placeholder={t("un", "unit", "ud.")} />
                        <input type="number" value={item.priceCents / 100} onChange={e => setProposalForm(p => ({
                          ...p, items: p.items!.map((x,i) => i===idx ? { ...x, priceCents: Math.round(Number(e.target.value) * 100) } : x)
                        }))} className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 outline-none text-foreground text-right" placeholder={t("0,00", "0.00", "0,00")} step="0.01" min={0} />
                        <button onClick={() => setProposalForm(p => ({ ...p, items: p.items!.filter((_,i) => i!==idx) }))}
                          className="text-destructive/50 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    {(proposalForm.items ?? []).length > 0 && (
                      <div className="flex justify-end pt-1">
                        <span className="font-mono text-sm font-bold text-primary">
                          {t("Total:", "Total:", "Total:")} {fmt(totalFor(proposalForm.items ?? []))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Observações", "Notes", "Observaciones")}</label>
                  <textarea value={proposalForm.notes} onChange={e => setProposalForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full h-20 bg-card border border-border/40 font-mono text-xs p-2 outline-none text-foreground resize-none"
                    placeholder={t("Condições de pagamento, validade da proposta, escopo...", "Payment terms, proposal validity, scope...", "Condiciones de pago, vigencia de la propuesta, alcance...")} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={createProposal} className="font-mono gap-2">
                    <FileText className="h-4 w-4" /> {t("Criar Proposta", "Create Proposal", "Crear propuesta")}
                  </Button>
                  <Button variant="outline" onClick={() => setProposalView("list")} className="font-mono">{t("Cancelar", "Cancel", "Cancelar")}</Button>
                </div>
              </div>
            )}

            {/* Detail / Print view */}
            {proposalView === "detail" && selectedProposal && (
              <div className="border border-border/40 bg-card/20 p-8 max-w-2xl space-y-6 print:border-0 print:p-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Proposta Comercial", "Sales Proposal", "Propuesta comercial")}</div>
                    <div className="font-mono text-xl font-bold">{selectedProposal.clientName}</div>
                    <div className="font-mono text-sm text-muted-foreground/60">{selectedProposal.clientEmail}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono text-[10px] px-2 py-1 border ${statusColors[selectedProposal.status]} inline-block mb-2`}>
                      {selectedProposal.status === "rascunho" ? t("RASCUNHO", "DRAFT", "BORRADOR") : selectedProposal.status === "enviada" ? t("ENVIADA", "SENT", "ENVIADA") : selectedProposal.status === "aceita" ? t("ACEITA", "ACCEPTED", "ACEPTADA") : t("RECUSADA", "DECLINED", "RECHAZADA")}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground/50 block">
                      {new Date(selectedProposal.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>

                <table className="w-full font-mono text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Descrição", "Description", "Descripción")}</th>
                      <th className="text-center py-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Qtd", "Qty", "Cant.")}</th>
                      <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Unitário", "Unit Price", "Precio unitario")}</th>
                      <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Total", "Total", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProposal.items.map((item, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-2">{item.desc}</td>
                        <td className="py-2 text-center text-muted-foreground/70">{item.qty} {item.unit}</td>
                        <td className="py-2 text-right text-muted-foreground/70 tabular-nums">{fmt(item.priceCents)}</td>
                        <td className="py-2 text-right font-bold tabular-nums">{fmt(item.qty * item.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border/60">
                      <td colSpan={3} className="py-3 text-right font-bold uppercase text-[11px] tracking-widest">{t("Total", "Total", "Total")}</td>
                      <td className="py-3 text-right font-bold text-lg text-primary tabular-nums">{fmt(totalFor(selectedProposal.items))}</td>
                    </tr>
                  </tfoot>
                </table>

                {selectedProposal.notes && (
                  <div className="border-l-2 border-primary/40 pl-4 py-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t("Observações", "Notes", "Observaciones")}</div>
                    <div className="font-mono text-sm text-muted-foreground/70 whitespace-pre-wrap">{selectedProposal.notes}</div>
                  </div>
                )}

                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" className="font-mono gap-1.5" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5" /> {t("Imprimir / PDF", "Print / PDF", "Imprimir / PDF")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TAB: RH / EQUIPE ─────────────────────────────────────────────── */}
      {tab === "rh" && (() => {
        const TYPE_META: Record<MemberType, { label: string; color: string; icon: string }> = {
          humano:     { label: t("Humano", "Human", "Humano"), color: "text-foreground border-border/50 bg-card/30", icon: "👤" },
          agente_ia:  { label: t("Agente IA", "AI Agent", "Agente de IA"), color: "text-primary border-primary/30 bg-primary/10", icon: "🤖" },
          contador:   { label: t("Contador", "Accountant", "Contador"), color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", icon: "📒" },
          advogado:   { label: t("Advogado", "Lawyer", "Abogado"), color: "text-blue-400 border-blue-400/30 bg-blue-400/10", icon: "⚖️" },
          parceiro:   { label: t("Parceiro", "Partner", "Socio"), color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10", icon: "🤝" },
        };
        const STATUS_META: Record<MemberStatus, { label: string; color: string }> = {
          ativo:    { label: t("Ativo", "Active", "Activo"), color: "text-green-400 border-green-400/30 bg-green-400/10" },
          inativo:  { label: t("Inativo", "Inactive", "Inactivo"), color: "text-muted-foreground border-border/40 bg-card/20" },
          pendente: { label: t("Pendente", "Pending", "Pendiente"), color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
        };
        const ALL_PERMISSIONS = [
          { slug: "crm", label: `CRM — ${t("Clientes", "Customers", "Clientes")}` },
          { slug: "dre", label: t("DRE — Resultado", "Income Statement — Results", "Estado de resultados") },
          { slug: "fiscal", label: t("Fiscal — Impostos", "Tax — Taxes", "Fiscal — Impuestos") },
          { slug: "propostas", label: t("Propostas Comerciais", "Sales Proposals", "Propuestas comerciales") },
          { slug: "pagamentos", label: t("Pagamentos", "Payments", "Pagos") },
          { slug: "financials", label: t("Financeiro", "Financials", "Finanzas") },
          { slug: "custo", label: t("Custo IA", "AI Cost", "Costo de IA") },
          { slug: "users", label: t("Usuários (somente leitura)", "Users (read-only)", "Usuarios (solo lectura)") },
        ];

        const fmtBRLm = (cents: number) =>
          cents === 0 ? t("Voluntário / IA", "Volunteer / AI", "Voluntario / IA") : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        function saveAndSet(t: TeamMember[]) { saveTeam(t); setTeam(t); }

        function createMember() {
          const m: TeamMember = {
            id: `mem_${Date.now()}`,
            name:         rhForm.name ?? "",
            email:        rhForm.email ?? "",
            role:         rhForm.role ?? "",
            type:         rhForm.type ?? "humano",
            status:       rhForm.status ?? "pendente",
            jurisdiction: rhForm.jurisdiction ?? "ambos",
            proLabore:    rhForm.proLabore ?? 0,
            commission:   rhForm.commission ?? 0,
            permissions:  rhForm.permissions ?? [],
            notes:        rhForm.notes ?? "",
            createdAt:    new Date().toISOString(),
          };
          saveAndSet([m, ...team]);
          setRhView("list");
          setRhForm({ name:"",email:"",role:"",type:"humano",status:"pendente",jurisdiction:"ambos",proLabore:0,commission:0,permissions:[],notes:"" });
          toast.success(t("Colaborador adicionado!", "Team member added!", "¡Miembro del equipo agregado!"));
        }

        // Monthly payroll summary
        const activeMembers   = team.filter(m => m.status === "ativo");
        const totalProLabore  = activeMembers.reduce((a,m) => a + m.proLabore, 0);
        const humanCount      = activeMembers.filter(m => m.type === "humano").length;
        const aiCount         = activeMembers.filter(m => m.type === "agente_ia").length;

        return (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-mono text-lg uppercase tracking-widest font-bold">👔 {t("RH / Equipe", "HR / Team", "RR. HH. / Equipo")} — DasKapital Holdings</h2>
                <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                  {t("Colaboradores humanos e agentes de IA. Gerencie permissões, pró-labore e escopo de acesso.", "Human team members and AI agents. Manage permissions, director's fees and access scope.", "Miembros humanos y agentes de IA. Gestiona permisos, remuneración y alcance de acceso.")}
                  <span className="text-yellow-400/70"> · {t("Sistema de login próprio por colaborador está na fila de implementação.", "Individual team-member login is queued for implementation.", "El inicio de sesión individual para cada miembro está pendiente de implementación.")}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {rhView !== "list" && (
                  <Button variant="outline" size="sm" className="rounded-none font-mono text-xs btn-weapon-outline gap-1.5"
                    onClick={() => { setRhView("list"); setRhSelected(null); }}>
                    <ArrowLeft className="h-3.5 w-3.5" /> {t("Voltar", "Back", "Volver")}
                  </Button>
                )}
                {rhView === "list" && (
                  <Button size="sm" className="rounded-none font-mono text-xs gap-1.5"
                    onClick={() => setRhView("create")}>
                    <Plus className="h-3.5 w-3.5" /> {t("Adicionar colaborador", "Add Team Member", "Agregar miembro")}
                  </Button>
                )}
              </div>
            </div>

            {/* Summary cards */}
            {rhView === "list" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label={t("Total na Equipe", "Total Team", "Total del equipo")} value={String(team.length)} sub={`${activeMembers.length} ${t("ativos", "active", "activos")}`} icon={Users} color="text-foreground" />
                <MetricCard label={t("Humanos Ativos", "Active Humans", "Personas activas")} value={String(humanCount)} sub={t("pessoas", "people", "personas")} icon={User} color="text-foreground" />
                <MetricCard label={t("Agentes de IA", "AI Agents", "Agentes de IA")} value={String(aiCount)} sub={t("autônomos", "autonomous", "autónomos")} icon={Bot} color="text-primary" border="border-primary/20" />
                <MetricCard label={t("Pró-Labore / Mês", "Director's Fee / Month", "Remuneración / Mes")} value={fmtBRLm(totalProLabore)} sub={t("equipe ativa", "active team", "equipo activo")} icon={Banknote} color="text-yellow-400" border="border-yellow-400/20" />
              </div>
            )}

            {/* Member list */}
            {rhView === "list" && (
              team.length === 0 ? (
                <div className="border border-border/20 bg-card/10 p-12 text-center space-y-3">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <div className="font-mono text-sm text-muted-foreground/50">{t("Equipe vazia. Adicione o primeiro colaborador ou agente.", "The team is empty. Add the first team member or agent.", "El equipo está vacío. Agrega al primer miembro o agente.")}</div>
                  <Button size="sm" className="font-mono gap-1.5" onClick={() => setRhView("create")}>
                    <Plus className="h-3.5 w-3.5" /> {t("Adicionar", "Add", "Agregar")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Headers */}
                  <div className="grid grid-cols-[1fr_90px_80px_90px_100px_110px_28px] gap-2 px-3 pb-1 border-b border-border/30">
                    {[t("Colaborador", "Team Member", "Miembro"), t("Tipo", "Type", "Tipo"), t("Status", "Status", "Estado"), t("Jurisdição", "Jurisdiction", "Jurisdicción"), t("Pró-Labore", "Director's Fee", "Remuneración"), t("Permissões", "Permissions", "Permisos"), ""].map((h,i) => (
                      <span key={i} className={`font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 ${i > 0 && i < 6 ? "text-center" : i === 6 ? "" : ""}`}>{h}</span>
                    ))}
                  </div>
                  {team.map(m => {
                    const tm = TYPE_META[m.type];
                    const sm = STATUS_META[m.status];
                    return (
                      <div key={m.id} className="grid grid-cols-[1fr_90px_80px_90px_100px_110px_28px] gap-2 px-3 py-3 items-center border border-border/20 hover:bg-white/[0.02] transition-colors">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold truncate">{tm.icon} {m.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/50 truncate">{m.email} {m.role ? `· ${m.role}` : ""}</div>
                        </div>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 border text-center block truncate ${tm.color}`}>{tm.label}</span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 border text-center block ${sm.color}`}>{sm.label}</span>
                        <span className="font-mono text-[10px] text-center text-muted-foreground/60">{m.jurisdiction === "ambos" ? "BR + AU" : m.jurisdiction}</span>
                        <span className="font-mono text-[11px] text-center tabular-nums text-muted-foreground/70">
                          {m.proLabore > 0 ? (m.proLabore / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}
                          {m.commission > 0 ? ` +${m.commission}%` : ""}
                        </span>
                        <div className="flex flex-wrap gap-0.5">
                          {m.permissions.slice(0, 3).map(p => (
                            <span key={p} className="font-mono text-[9px] px-1 py-0.5 border border-primary/20 bg-primary/5 text-primary/70">{p}</span>
                          ))}
                          {m.permissions.length > 3 && <span className="font-mono text-[9px] text-muted-foreground/40">+{m.permissions.length - 3}</span>}
                          {m.permissions.length === 0 && <span className="font-mono text-[9px] text-muted-foreground/30">{t("sem acesso", "no access", "sin acceso")}</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button title={t("Editar colaborador", "Edit team member", "Editar miembro")} onClick={() => { setRhSelected(m); setRhView("detail"); setRhForm({ ...m }); }}
                            className="text-muted-foreground/40 hover:text-primary transition-colors"><Edit3 className="h-3 w-3" /></button>
                          <button title={t("Remover colaborador", "Remove team member", "Eliminar miembro")} onClick={() => { if (confirm(t("Remover colaborador?", "Remove team member?", "¿Eliminar miembro?"))) saveAndSet(team.filter(x => x.id !== m.id)); }}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Create / Edit form */}
            {(rhView === "create" || (rhView === "detail" && rhSelected)) && (
              <div className="border border-border/40 bg-card/20 p-6 space-y-5 max-w-2xl">
                <div className="font-mono text-sm font-bold uppercase tracking-widest">
                  {rhView === "create" ? t("Novo Colaborador / Agente", "New Team Member / Agent", "Nuevo miembro / agente") : `${t("Editar", "Edit", "Editar")} — ${rhSelected?.name}`}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Nome completo", "Full Name", "Nombre completo")}</label>
                    <input value={rhForm.name ?? ""} onChange={e => setRhForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("Ex: Maria Fernanda", "E.g. Alex Morgan", "Ej.: María Fernanda")} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("E-mail / ID do Agente", "Email / Agent ID", "Correo / ID del agente")}</label>
                    <input value={rhForm.email ?? ""} onChange={e => setRhForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("maria@email.com", "name@email.com", "maria@correo.com")} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Cargo / Função", "Title / Role", "Cargo / Función")}</label>
                    <input value={rhForm.role ?? ""} onChange={e => setRhForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("CFO, Agente Contador, Dev...", "CFO, Accounting Agent, Developer...", "CFO, agente contable, desarrollador...")} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Tipo", "Type", "Tipo")}</label>
                    <select value={rhForm.type} onChange={e => setRhForm(f => ({ ...f, type: e.target.value as MemberType }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground">
                      {(Object.keys(TYPE_META) as MemberType[]).map(t => <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Status", "Status", "Estado")}</label>
                    <select value={rhForm.status} onChange={e => setRhForm(f => ({ ...f, status: e.target.value as MemberStatus }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground">
                      {(Object.keys(STATUS_META) as MemberStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Jurisdição", "Jurisdiction", "Jurisdicción")}</label>
                    <select value={rhForm.jurisdiction} onChange={e => setRhForm(f => ({ ...f, jurisdiction: e.target.value as TeamMember["jurisdiction"] }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground">
                      <option value="BR">{t("Brasil", "Brazil", "Brasil")}</option>
                      <option value="AU">{t("Austrália", "Australia", "Australia")}</option>
                      <option value="ambos">BR + AU</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Pró-labore / Salário (R$/mês)", "Director's Fee / Salary (R$/month)", "Remuneración / Salario (R$/mes)")}</label>
                    <input type="number" value={(rhForm.proLabore ?? 0) / 100} min={0} step={100}
                      onChange={e => setRhForm(f => ({ ...f, proLabore: Math.round(Number(e.target.value) * 100) }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder={t("0 = voluntário / IA", "0 = volunteer / AI", "0 = voluntario / IA")} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Comissão (%)", "Commission (%)", "Comisión (%)")}</label>
                    <input type="number" value={rhForm.commission ?? 0} min={0} max={100} step={1}
                      onChange={e => setRhForm(f => ({ ...f, commission: Number(e.target.value) }))}
                      className="w-full bg-card border border-border/40 font-mono text-xs px-3 py-2 outline-none text-foreground" placeholder="0" />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-2">{t("Módulos que este colaborador pode acessar", "Modules this team member can access", "Módulos a los que puede acceder este miembro")}</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_PERMISSIONS.map(p => {
                      const checked = (rhForm.permissions ?? []).includes(p.slug);
                      return (
                        <label key={p.slug} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors ${checked ? "border-primary/40 bg-primary/10" : "border-border/30 bg-card/10 hover:border-border/60"}`}>
                          <input type="checkbox" checked={checked} onChange={e => setRhForm(f => ({
                            ...f, permissions: e.target.checked
                              ? [...(f.permissions ?? []), p.slug]
                              : (f.permissions ?? []).filter(x => x !== p.slug)
                          }))} className="accent-primary" />
                          <span className={`font-mono text-[11px] ${checked ? "text-primary" : "text-muted-foreground/70"}`}>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="font-mono text-[10px] text-yellow-400/60 mt-2">
                    ⚠️ {t("Login dedicado por colaborador está na fila de implementação. Por ora, registre as permissões aqui para referência.", "Individual team-member login is queued for implementation. For now, record permissions here for reference.", "El inicio de sesión individual está pendiente de implementación. Por ahora, registra aquí los permisos como referencia.")}
                  </p>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">{t("Notas internas", "Internal Notes", "Notas internas")}</label>
                  <textarea value={rhForm.notes ?? ""} onChange={e => setRhForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-20 bg-card border border-border/40 font-mono text-xs p-2 outline-none text-foreground resize-none"
                    placeholder={t("Contexto do contrato, acordo, responsabilidades, chave API do agente...", "Contract context, agreement, responsibilities, agent API key...", "Contexto del contrato, acuerdo, responsabilidades, clave API del agente...")} />
                </div>

                <div className="flex gap-2">
                  {rhView === "create" ? (
                    <Button onClick={createMember} className="font-mono gap-2">
                      <Plus className="h-4 w-4" /> {t("Adicionar à equipe", "Add to Team", "Agregar al equipo")}
                    </Button>
                  ) : (
                    <Button onClick={() => {
                      const updated = team.map(m => m.id === rhSelected!.id ? { ...m, ...rhForm, id: m.id } as TeamMember : m);
                      saveAndSet(updated);
                      setRhView("list");
                      toast.success(t("Colaborador atualizado!", "Team member updated!", "¡Miembro del equipo actualizado!"));
                    }} className="font-mono gap-2">
                      <CheckSquare className="h-4 w-4" /> {t("Salvar alterações", "Save Changes", "Guardar cambios")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setRhView("list"); setRhSelected(null); }} className="font-mono">{t("Cancelar", "Cancel", "Cancelar")}</Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TAB: CUSTO IA ─────────────────────────────────────────────────── */}
      {tab === "custo" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-mono text-lg uppercase tracking-widest font-bold">💰 {t("Custo Real por Lançamento", "Actual Cost per Launch", "Costo real por lanzamiento")}</h2>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {t("Custo real de tokens em USD por campanha, agente por agente. Use para calibrar precificação de créditos e detectar vazamentos.", "Actual token cost in USD per campaign, broken down by agent. Use this to calibrate credit pricing and detect cost leaks.", "Costo real de tokens en USD por campaña y agente. Úsalo para ajustar el precio de los créditos y detectar fugas.")}
              </p>
            </div>
            <Button variant="outline" size="sm"
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 shrink-0"
              onClick={() => refetchCost()}>
              <RefreshCw className="h-3 w-3" /> {t("Atualizar", "Refresh", "Actualizar")}
            </Button>
          </div>

          {loadingCost ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-muted/20 rounded-none" />)}
              </div>
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 bg-muted/20 rounded-none" />)}
              </div>
            </div>
          ) : !costData ? (
            <div className="border border-border/20 bg-card/10 p-8 text-center font-mono text-xs text-muted-foreground/40">
              {t("Erro ao carregar dados. Tente novamente.", "Error loading data. Please try again.", "Error al cargar los datos. Inténtalo de nuevo.")}
            </div>
          ) : (() => {
            const pt = costData.platformTotals;
            const campaigns = costData.campaigns;
            const filtered = campaigns.filter(c =>
              !costWorkspaceFilter ||
              (c.workspaceName ?? "").toLowerCase().includes(costWorkspaceFilter.toLowerCase()) ||
              (c.ownerEmail ?? "").toLowerCase().includes(costWorkspaceFilter.toLowerCase())
            );
            const mostExpensive = campaigns[0];
            const avgCost = campaigns.length > 0 ? pt.totalCostUsd / campaigns.length : 0;

            return (
              <>
                {/* ── Summary cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label={t("Custo Total Plataforma", "Total Platform Cost", "Costo total de la plataforma")}
                    value={`$${pt.totalCostUsd.toFixed(4)}`}
                    sub={`${pt.totalCalls.toLocaleString("pt-BR")} ${t("chamadas", "calls", "llamadas")}`}
                    icon={DollarSign}
                    color="text-yellow-400"
                    border="border-yellow-400/20"
                  />
                  <MetricCard
                    label={t("Média por Campanha", "Average per Campaign", "Promedio por campaña")}
                    value={`$${avgCost.toFixed(4)}`}
                    sub={`${campaigns.length} ${t("campanhas", "campaigns", "campañas")}`}
                    icon={BarChart3}
                    color="text-primary"
                    border="border-primary/20"
                  />
                  <MetricCard
                    label={t("Campanha Mais Cara", "Most Expensive Campaign", "Campaña más costosa")}
                    value={`$${(mostExpensive?.totalCostUsd ?? 0).toFixed(4)}`}
                    sub={mostExpensive?.campaignName ?? mostExpensive?.campaignId?.slice(0,8) ?? "—"}
                    icon={TrendingUp}
                    color="text-orange-400"
                    border="border-orange-400/20"
                  />
                  <MetricCard
                    label={t("Total de Tokens", "Total Tokens", "Total de tokens")}
                    value={(pt.totalTokens / 1_000_000).toFixed(2) + "M"}
                    sub={`${pt.totalCredits.toLocaleString("pt-BR")} ${t("créditos", "credits", "créditos")}`}
                    icon={Zap}
                    color="text-cyan-400"
                    border="border-cyan-400/20"
                  />
                </div>

                {/* ── Workspace filter ── */}
                <div className="flex items-center gap-2 border border-border/40 bg-card/20 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <input
                    type="text"
                    placeholder={t("Filtrar por workspace ou e-mail...", "Filter by workspace or email...", "Filtrar por espacio de trabajo o correo...")}
                    value={costWorkspaceFilter}
                    onChange={e => setCostWorkspaceFilter(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  {costWorkspaceFilter && (
                    <button onClick={() => setCostWorkspaceFilter("")}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">
                    {filtered.length}/{campaigns.length}
                  </span>
                </div>

                {/* ── Column headers ── */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 px-4 pb-1 border-b border-border/30">
                  {[t("Campanha / Workspace", "Campaign / Workspace", "Campaña / Espacio de trabajo"), "USD", t("Créditos", "Credits", "Créditos"), "Tokens", t("Chamadas", "Calls", "Llamadas"), ""].map((h, i) => (
                    <span key={i} className={`font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 ${i > 0 ? "text-right" : ""}`}>{h}</span>
                  ))}
                </div>

                {/* ── Campaign rows ── */}
                {filtered.length === 0 ? (
                  <div className="border border-border/20 bg-card/10 p-8 text-center font-mono text-xs text-muted-foreground/40">
                    {t("Nenhuma campanha encontrada", "No campaigns found", "No se encontraron campañas")}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.map((c, idx) => {
                      const isExpanded = expandedCampaign === c.campaignId;
                      const maxAgentCost = Math.max(...c.byAgent.map(a => a.costUsd), 0.000001);

                      return (
                        <div key={c.campaignId} className="border border-border/30 overflow-hidden">
                          {/* Row */}
                          <button
                            onClick={() => setExpandedCampaign(isExpanded ? null : c.campaignId)}
                            className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 px-4 py-3 items-center text-left hover:bg-white/[0.02] transition-colors"
                          >
                            {/* Name + workspace */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                                  #{idx + 1}
                                </span>
                                <span className="font-mono text-sm font-bold text-foreground truncate">
                                  {c.campaignName ?? `${t("Campanha", "Campaign", "Campaña")} ${c.campaignId.slice(0, 8)}`}
                                </span>
                              </div>
                              <div className="font-mono text-[11px] text-muted-foreground/50 truncate pl-5">
                                {c.workspaceName ?? c.workspaceId.slice(0, 8)} · {c.ownerEmail}
                              </div>
                            </div>

                            {/* Cost USD — colored by magnitude */}
                            <span className={`font-mono text-sm font-bold tabular-nums text-right ${
                              c.totalCostUsd >= 0.05 ? "text-red-400" :
                              c.totalCostUsd >= 0.01 ? "text-orange-400" :
                              c.totalCostUsd >= 0.003 ? "text-yellow-400" : "text-green-400"
                            }`}>
                              ${c.totalCostUsd.toFixed(4)}
                            </span>

                            <span className="font-mono text-xs text-muted-foreground/70 tabular-nums text-right">
                              {c.totalCredits.toLocaleString("pt-BR")}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground/50 tabular-nums text-right">
                              {c.totalTokens >= 1000
                                ? `${(c.totalTokens / 1000).toFixed(1)}k`
                                : c.totalTokens.toLocaleString("pt-BR")}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground/50 tabular-nums text-right">
                              {c.totalCalls}×
                            </span>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>

                          {/* Expanded agent breakdown */}
                          {isExpanded && (
                            <div className="border-t border-border/30 bg-card/20 px-4 py-3 space-y-2">
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-3">
                                {t("Detalhamento por agente", "Breakdown by agent", "Desglose por agente")} — {c.byAgent.length} {t("agentes", "agents", "agentes")}
                              </div>
                              {c.byAgent.length === 0 ? (
                                <div className="font-mono text-[11px] text-muted-foreground/40">
                                  {t("Sem registros de agentes para esta campanha", "No agent logs for this campaign", "No hay registros de agentes para esta campaña")}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {c.byAgent.map(a => (
                                    <div key={a.agentType} className="grid grid-cols-[180px_1fr_80px_60px_50px] gap-3 items-center">
                                      {/* Agent name */}
                                      <span className="font-mono text-[11px] text-muted-foreground/80 truncate" title={a.agentType}>
                                        {a.agentType}
                                      </span>

                                      {/* Horizontal bar */}
                                      <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all"
                                          style={{
                                            width: `${Math.max(1, (a.costUsd / maxAgentCost) * 100)}%`,
                                            background: a.costUsd >= maxAgentCost * 0.5
                                              ? "var(--color-primary)"
                                              : "hsl(var(--primary) / 0.4)",
                                          }}
                                        />
                                      </div>

                                      {/* USD */}
                                      <span className="font-mono text-[11px] font-bold tabular-nums text-right text-foreground/70">
                                        ${a.costUsd.toFixed(5)}
                                      </span>

                                      {/* Credits */}
                                      <span className="font-mono text-[10px] tabular-nums text-right text-muted-foreground/50">
                                        {a.credits}cr
                                      </span>

                                      {/* Calls */}
                                      <span className="font-mono text-[10px] tabular-nums text-right text-muted-foreground/40">
                                        {a.calls}×
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function FingerprintDownloadsList() {
  const t = useUiText();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/fingerprints"],
    queryFn: () => customFetch<{ records: { id: string; fingerprint: string; userName: string; userEmail: string; campaignTitle: string | null; generatedAt: string; ipAddress: string | null }[] }>("/api/fingerprints"),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 pb-1 border-b border-border/30">
        {t("Downloads Registrados", "Registered Downloads", "Descargas registradas")} — {data?.records?.length ?? 0} {t("total", "total", "en total")}
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}</div>
      ) : !data?.records?.length ? (
        <div className="border border-border/20 bg-card/10 p-8 text-center font-mono text-xs text-muted-foreground/40">
          {t("Nenhum download registrado ainda", "No downloads recorded yet", "Aún no hay descargas registradas")}
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
