import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CreditCard, CheckCircle2, Clock, AlertCircle, Zap, ChevronRight,
  RefreshCw, Receipt, ArrowUpRight, Shield, Users, Rocket, Brain,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface BillingStatus {
  planName: string;
  planSlug: string;
  status: string;
  onboardingPaid: boolean;
  nextBillingDate?: string;
  lastPaymentAt?: string;
  trialEndsAt?: string;
}
interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  description?: string;
  createdAt: string;
  paidAt?: string;
}
interface Plan {
  id: string;
  name: string;
  slug: string;
  monthlyPriceBrl: number;
  onboardingFeeBrl: number;
  creditsMonthly: number;
  maxCampaigns: number;
  maxWorkspaceUsers: number;
  tracks: string[];
  features: string[];
  isWhiteLabel: boolean;
}

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX", bank_transfer: "TED/Transferência", credit_card: "Cartão de Crédito",
  crypto_usdt: "Cripto USDT", crypto_btc: "Cripto BTC", crypto_eth: "Cripto ETH",
  manual: "Manual",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Ativo",       className: "text-success border-success/40 bg-success/10" },
  trial:     { label: "Trial",       className: "text-primary border-primary/40 bg-primary/10" },
  pending:   { label: "Pendente",    className: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  cancelled: { label: "Cancelado",  className: "text-destructive border-destructive/40 bg-destructive/10" },
  paid:      { label: "Pago",        className: "text-success border-success/40 bg-success/10" },
  expired:   { label: "Expirado",   className: "text-muted-foreground border-border bg-muted/20" },
};

const PAYMENT_METHODS = [
  { value: "pix",          label: "PIX",           sub: "Instantâneo, sem taxas" },
  { value: "bank_transfer",label: "TED",            sub: "Transferência bancária" },
  { value: "credit_card",  label: "Cartão",         sub: "Crédito em até 12x" },
  { value: "crypto_usdt",  label: "USDT",           sub: "Stablecoin, TRC20" },
  { value: "crypto_btc",   label: "Bitcoin",        sub: "BTC Lightning" },
  { value: "manual",       label: "Manual",         sub: "Envio de comprovante" },
];

export default function BillingPage() {
  const { plan: currentPlan, planSlug } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState("pix");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/billing/status");
      if (!res.ok) return null;
      return res.json() as Promise<BillingStatus>;
    },
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/billing/history"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/billing/history");
      if (!res.ok) return { payments: [] };
      return res.json() as Promise<{ payments: Payment[] }>;
    },
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/plans");
      if (!res.ok) return { plans: [] };
      return res.json() as Promise<{ plans: Plan[] }>;
    },
  });

  const initiateMutation = useMutation({
    mutationFn: async ({ planId, method }: { planId: string; method: string }) => {
      const res = await customFetch<Response>("/api/billing/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, method }),
      });
      if (!res.ok) throw new Error("Falha ao iniciar pagamento");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Pagamento iniciado! Verifique os dados de pagamento.");
    },
    onError: () => {
      toast.error("Não foi possível iniciar o pagamento agora. Tente novamente.");
    },
  });

  const status = statusData;
  const payments = historyData?.payments ?? [];
  const plans = plansData?.plans ?? [];
  const targetPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-primary" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Plano & Faturamento
          </h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Gestão de assinatura, histórico de pagamentos e upgrade de plano
        </p>
      </div>

      {/* ── Current Status ── */}
      <div className="border border-border/50 bg-card/40 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40" />
        <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/60 to-transparent" />
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">Assinatura Atual</div>
        {loadingStatus ? (
          <div className="space-y-2"><Skeleton className="h-8 w-48 bg-muted/20" /><Skeleton className="h-4 w-64 bg-muted/20" /></div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-mono font-bold text-xl uppercase tracking-tight text-foreground">
                  {status?.planName ?? currentPlan?.name ?? "NexOS AI"}
                </h2>
                {status?.status && (
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 ${STATUS_BADGE[status.status]?.className ?? "text-primary border-primary/40"}`}>
                    {STATUS_BADGE[status.status]?.label ?? status.status}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Plano", value: planSlug?.toUpperCase() ?? "—" },
                  { label: "Onboarding", value: status?.onboardingPaid ? "Pago" : "Pendente" },
                  { label: "Próxima cobrança", value: status?.nextBillingDate ? new Date(status.nextBillingDate).toLocaleDateString("pt-BR") : "—" },
                ].map(item => (
                  <div key={item.label} className="border border-border/30 bg-muted/10 p-2.5">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">{item.label}</div>
                    <div className="font-mono text-xs font-bold mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Plan Comparison ── */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">Planos Disponíveis</div>
        {loadingPlans ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2].map(i => <Skeleton key={i} className="h-64 bg-muted/20" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                id: "solo", name: "Solo", slug: "solo", monthlyPriceBrl: 29700, onboardingFeeBrl: 250000,
                creditsMonthly: 1500, maxCampaigns: 3, isWhiteLabel: false,
                features: ["3 campanhas simultâneas", "1.500 créditos de IA/mês", "Track 6 dígitos", "16 agentes para consulta", "Sequências de email + WhatsApp", "VSL Studio", "Relatório semanal de IA"],
              },
              {
                id: "agency", name: "Agency", slug: "agency", monthlyPriceBrl: 149700, onboardingFeeBrl: 250000,
                creditsMonthly: 5000, maxCampaigns: 10, isWhiteLabel: true,
                features: ["10 campanhas simultâneas", "5.000 créditos de IA/mês", "Todos os tracks (6, 8, 10 dígitos)", "16 agentes + todos os autônomos", "Gestão de múltiplos clientes", "White-label da plataforma", "Relatório semanal de IA"],
              },
            ].map(plan => {
              const isCurrent = plan.slug === planSlug;
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrent && setSelectedPlanId(isSelected ? null : plan.id)}
                  className={`border p-5 cursor-pointer transition-all relative overflow-hidden
                    ${isCurrent ? "border-success/40 bg-success/5" : isSelected ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)]" : "border-border/50 bg-card/40 hover:border-primary/30"}`}
                >
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current/30" />
                  {isCurrent && (
                    <Badge variant="outline" className="absolute top-3 right-3 rounded-none font-mono text-[8px] text-success border-success/40 bg-success/10">
                      Plano Atual
                    </Badge>
                  )}
                  <div className="mb-4">
                    <div className="font-mono font-black text-xl uppercase tracking-tight text-foreground mb-1">{plan.name}</div>
                    <div className="font-mono text-2xl font-bold text-primary">
                      R${(plan.monthlyPriceBrl / 100).toLocaleString("pt-BR")}
                      <span className="text-xs text-muted-foreground font-normal">/mês</span>
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
                      + R${(plan.onboardingFeeBrl / 100).toLocaleString("pt-BR")} onboarding (único)
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Créditos IA/mês", value: plan.creditsMonthly.toLocaleString("pt-BR") },
                      { label: "Campanhas", value: String(plan.maxCampaigns) },
                    ].map(m => (
                      <div key={m.label} className="border border-border/30 bg-muted/10 p-2 text-center">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground/50">{m.label}</div>
                        <div className="font-mono text-sm font-bold text-primary">{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                        <span className="font-mono text-[9px] text-muted-foreground leading-relaxed">{f}</span>
                      </li>
                    ))}
                    {plan.isWhiteLabel && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                        <span className="font-mono text-[9px] text-muted-foreground">White-label incluso</span>
                      </li>
                    )}
                  </ul>
                  {!isCurrent && isSelected && (
                    <div className="mt-3 border-t border-border/30 pt-3">
                      <div className="font-mono text-[9px] text-primary uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Selecionado para upgrade
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map(plan => {
              const isCurrent = plan.slug === planSlug;
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrent && setSelectedPlanId(isSelected ? null : plan.id)}
                  className={`border p-5 cursor-pointer transition-all relative overflow-hidden
                    ${isCurrent ? "border-success/40 bg-success/5" : isSelected ? "border-primary/60 bg-primary/5" : "border-border/50 bg-card/40 hover:border-primary/30"}`}
                >
                  {isCurrent && (
                    <Badge variant="outline" className="absolute top-3 right-3 rounded-none font-mono text-[8px] text-success border-success/40 bg-success/10">
                      Atual
                    </Badge>
                  )}
                  <div className="font-mono font-black text-lg uppercase tracking-tight mb-1">{plan.name}</div>
                  <div className="font-mono text-xl font-bold text-primary mb-3">
                    R${(plan.monthlyPriceBrl / 100).toLocaleString("pt-BR")}
                    <span className="text-xs text-muted-foreground font-normal">/mês</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                    <div className="border border-border/30 bg-muted/10 p-2">
                      <div className="font-mono text-[7px] text-muted-foreground/50 uppercase">Créditos</div>
                      <div className="font-mono text-sm font-bold text-primary">{plan.creditsMonthly.toLocaleString("pt-BR")}</div>
                    </div>
                    <div className="border border-border/30 bg-muted/10 p-2">
                      <div className="font-mono text-[7px] text-muted-foreground/50 uppercase">Campanhas</div>
                      <div className="font-mono text-sm font-bold text-primary">{plan.maxCampaigns}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upgrade CTA ── */}
      {selectedPlanId && (
        <div className="border border-primary/30 bg-primary/5 p-5">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">
            Método de Pagamento · {targetPlan?.name ?? "Plano selecionado"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setSelectedMethod(m.value)}
                className={`border p-3 text-left transition-all
                  ${selectedMethod === m.value ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-primary/30 text-muted-foreground"}`}
              >
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest">{m.label}</div>
                <div className="font-mono text-[8px] opacity-60 mt-0.5">{m.sub}</div>
              </button>
            ))}
          </div>
          <Button
            onClick={() => {
              if (!selectedPlanId) return;
              initiateMutation.mutate({ planId: selectedPlanId, method: selectedMethod });
            }}
            disabled={initiateMutation.isPending}
            className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11"
          >
            {initiateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            Iniciar Pagamento via {METHOD_LABEL[selectedMethod] ?? selectedMethod}
          </Button>
          <p className="font-mono text-[8px] text-muted-foreground/40 uppercase tracking-widest mt-2 text-center">
            Pagamento não bloqueia execução de campanhas · Ativação imediata após confirmação
          </p>
        </div>
      )}

      {/* ── Payment History ── */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
          <Receipt className="h-3 w-3" />Histórico de Pagamentos
        </div>
        {loadingHistory ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
        ) : payments.length === 0 ? (
          <div className="border border-border/30 bg-muted/10 p-6 text-center">
            <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Nenhum pagamento registrado ainda</p>
          </div>
        ) : (
          <div className="border border-border/50 divide-y divide-border/30">
            {payments.map(p => {
              const badge = STATUS_BADGE[p.status];
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-card/40 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <div>
                      <div className="font-mono text-xs font-bold">{p.description ?? METHOD_LABEL[p.method] ?? p.method}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/50">
                        {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                        {p.paidAt && ` · Pago em ${new Date(p.paidAt).toLocaleDateString("pt-BR")}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-bold">
                      R${(p.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {badge && (
                      <Badge variant="outline" className={`rounded-none font-mono text-[8px] ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Support ── */}
      <div className="border border-border/30 bg-muted/10 p-4 flex items-center gap-3">
        <Shield className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <p className="font-mono text-[9px] text-muted-foreground/60 leading-relaxed">
          Problemas com pagamento? Entre em contato: <span className="text-primary">suporte@nexos.ai</span> · Pagamentos nunca bloqueiam execução de campanhas ativas.
        </p>
      </div>
    </div>
  );
}
