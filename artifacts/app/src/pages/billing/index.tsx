import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CreditCard, CheckCircle2, Clock, Zap,
  RefreshCw, Receipt, ArrowUpRight, Shield, Lock,
  Infinity,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AccessStatus {
  planName: string;
  planSlug: string;
  status: string;
  accessPaid: boolean;
  accessPaidAt?: string;
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
  monthlyPriceBrl: number;    // campo do backend: price_monthly (preço de acesso único)
  creditsMonthly: number;     // créditos incluídos no acesso
  maxCampaigns: number;
  features: string[];
  isWhiteLabel: boolean;
}

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX", bank_transfer: "TED/Transferência", credit_card: "Cartão de Crédito",
  crypto_usdt: "Cripto USDT", crypto_btc: "Cripto BTC", crypto_eth: "Cripto ETH",
  manual: "Manual",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Ativo",      className: "text-success border-success/40 bg-success/10" },
  trial:     { label: "Trial",      className: "text-primary border-primary/40 bg-primary/10" },
  pending:   { label: "Pendente",   className: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  cancelled: { label: "Cancelado",  className: "text-destructive border-destructive/40 bg-destructive/10" },
  paid:      { label: "Pago",       className: "text-success border-success/40 bg-success/10" },
  expired:   { label: "Expirado",   className: "text-muted-foreground border-border bg-muted/20" },
};

const PAYMENT_METHODS = [
  { value: "pix",           label: "PIX",     sub: "Instantâneo, sem taxas" },
  { value: "bank_transfer", label: "TED",     sub: "Transferência bancária" },
  { value: "credit_card",   label: "Cartão",  sub: "Crédito em até 12x" },
  { value: "crypto_usdt",   label: "USDT",    sub: "Stablecoin, TRC20" },
  { value: "crypto_btc",    label: "Bitcoin", sub: "BTC Lightning" },
  { value: "manual",        label: "Manual",  sub: "Envio de comprovante" },
];

// ── Pack data (espelha credits.ts) ─────────────────────────────────────────────
const CREDIT_PACKS = [
  { id: "pack_500",  credits: 500,  priceBrl: 85,  label: "Lançamento Extra", description: "~1 lançamento completo",   highlight: false },
  { id: "pack_1500", credits: 1500, priceBrl: 239, label: "Trimestral",       description: "~3 lançamentos completos", highlight: true  },
  { id: "pack_3500", credits: 3500, priceBrl: 529, label: "Semestral",        description: "~8 lançamentos completos", highlight: false },
  { id: "pack_7000", credits: 7000, priceBrl: 979, label: "Anual",            description: "~16 lançamentos",         highlight: false },
];

export default function BillingPage() {
  const { plan: currentPlan, planSlug } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState("pix");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/billing/status");
      if (!res.ok) return null;
      return res.json() as Promise<AccessStatus>;
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

  // Fallback plans para quando API não retorna dados
  const displayPlans: Plan[] = plans.length > 0 ? plans : [
    {
      id: "solo", name: "Solo", slug: "solo", monthlyPriceBrl: 399000, creditsMonthly: 900,
      maxCampaigns: 3, isWhiteLabel: false,
      features: [
        "Acesso vitalício à plataforma",
        "900 créditos incluídos (2 lançamentos completos)",
        "Até 3 campanhas simultâneas",
        "Track de 6 dígitos",
        "16 agentes de IA especializados",
        "Sequência PLF automatizada",
        "Landing page gerada por IA",
        "Até 5 vídeos por campanha",
      ],
    },
    {
      id: "agency", name: "Agency", slug: "agency", monthlyPriceBrl: 999000, creditsMonthly: 2000,
      maxCampaigns: 10, isWhiteLabel: true,
      features: [
        "Acesso vitalício à plataforma",
        "2.000 créditos incluídos (~4-5 lançamentos)",
        "Até 10 campanhas simultâneas",
        "Todos os tracks (6, 8, 10 dígitos)",
        "White-label incluído",
        "Dashboard multi-cliente",
        "Suporte prioritário",
      ],
    },
  ];

  const isAccessPaid = status?.accessPaid ?? false;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-primary" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Acesso & Créditos
          </h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Acesso vitalício · Lançamentos ilimitados · Packs de créditos sob demanda
        </p>
      </div>

      {/* ── Access Status ── */}
      <div className="border border-border/50 bg-card/40 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40" />
        <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/60 to-transparent" />
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">Seu Acesso</div>
        {loadingStatus ? (
          <div className="space-y-2"><Skeleton className="h-8 w-48 bg-muted/20" /><Skeleton className="h-4 w-64 bg-muted/20" /></div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-mono font-bold text-xl uppercase tracking-tight text-foreground">
                  NexOS AI — {status?.planName ?? currentPlan?.name ?? "Solo"}
                </h2>
                {status?.status && (
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 ${STATUS_BADGE[status.status]?.className ?? "text-primary border-primary/40"}`}>
                    {STATUS_BADGE[status.status]?.label ?? status.status}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Plano", value: (planSlug ?? "solo").toUpperCase() },
                  { label: "Tipo de acesso", value: "Vitalício" },
                  {
                    label: "Acesso pago em",
                    value: status?.accessPaidAt
                      ? new Date(status.accessPaidAt).toLocaleDateString("pt-BR")
                      : isAccessPaid ? "Confirmado" : "Pendente",
                  },
                ].map(item => (
                  <div key={item.label} className="border border-border/30 bg-muted/10 p-2.5">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">{item.label}</div>
                    <div className="font-mono text-xs font-bold mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border border-success/30 bg-success/5 px-4 py-2.5 shrink-0">
              <Infinity className="h-4 w-4 text-success" />
              <div>
                <div className="font-mono text-[11px] text-success/70 uppercase tracking-widest">Lançamentos</div>
                <div className="font-mono text-sm font-bold text-success">Ilimitados</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: "01", title: "Acesso Único", desc: "Pague uma vez. Acesse para sempre. Sem mensalidade.", icon: Lock, color: "text-primary" },
          { step: "02", title: "2 Lançamentos Incluídos", desc: "900 créditos no plano Solo cobrem 2 lançamentos completos com todos os agentes de IA.", icon: Zap, color: "text-cyan-400" },
          { step: "03", title: "Packs sob Demanda", desc: "A partir do 3º lançamento, recarregue créditos no momento que quiser, sem compromisso.", icon: RefreshCw, color: "text-success" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="border border-border/40 bg-card/30 p-4 relative">
              <div className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest mb-2">{item.step}</div>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{item.title}</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          );
        })}
      </div>

      {/* ── Credit Packs ── */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Packs de Créditos</div>
        <div className="text-[11px] font-mono text-muted-foreground/40 mb-3">Para quando seus créditos incluídos acabarem — sem mensalidade, sem prazo</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKS.map(pack => (
            <div
              key={pack.id}
              onClick={() => setBuyingPack(buyingPack === pack.id ? null : pack.id)}
              className={`border p-4 cursor-pointer transition-all relative overflow-hidden
                ${pack.highlight
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.08)]"
                  : "border-border/40 bg-card/30 hover:border-primary/30"
                }
                ${buyingPack === pack.id ? "border-primary/60 bg-primary/8 ring-1 ring-primary/20" : ""}
              `}
            >
              {pack.highlight && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
              {pack.highlight && (
                <Badge variant="outline" className="absolute top-2 right-2 rounded-none font-mono text-[10px] px-1.5 text-primary border-primary/40 bg-primary/10">
                  Popular
                </Badge>
              )}
              <div className="font-mono font-black text-sm uppercase tracking-tight text-foreground mb-0.5">{pack.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground/60 mb-3">{pack.description}</div>
              <div className="font-mono text-2xl font-bold text-primary mb-0.5">
                R${pack.priceBrl.toLocaleString("pt-BR")}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground/50">
                {pack.credits.toLocaleString("pt-BR")} créditos · R${(pack.priceBrl / pack.credits).toFixed(3)}/cr
              </div>
            </div>
          ))}
        </div>

        {/* Pack checkout */}
        {buyingPack && (
          <div className="mt-3 border border-primary/30 bg-primary/5 p-5">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">
              Método de Pagamento · {CREDIT_PACKS.find(p => p.id === buyingPack)?.label}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMethod(m.value)}
                  className={`border p-3 text-left transition-all
                    ${selectedMethod === m.value ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-primary/30 text-muted-foreground"}`}
                >
                  <div className="font-mono text-xs font-bold uppercase tracking-widest">{m.label}</div>
                  <div className="font-mono text-[11px] opacity-60 mt-0.5">{m.sub}</div>
                </button>
              ))}
            </div>
            <Button
              onClick={() => toast.info("Integração de pagamento de packs em breve. Entre em contato: suporte@nexos.ai")}
              className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11"
            >
              <ArrowUpRight className="h-4 w-4" />
              Comprar Pack via {METHOD_LABEL[selectedMethod] ?? selectedMethod}
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest mt-2 text-center">
              Créditos adicionados instantaneamente após confirmação
            </p>
          </div>
        )}
      </div>

      {/* ── Plan Options (upgrade) ── */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">Planos de Acesso</div>
        {loadingPlans ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2].map(i => <Skeleton key={i} className="h-64 bg-muted/20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayPlans.map(plan => {
              const isCurrent = plan.slug === planSlug;
              const isSelected = selectedPlanId === plan.id;
              const priceDisplay = plan.monthlyPriceBrl > 0
                ? `R$${(plan.monthlyPriceBrl / 100).toLocaleString("pt-BR")}`
                : `R$${plan.slug === "solo" ? "3.990" : "9.990"}`;
              const launches = Math.floor((plan.creditsMonthly) / 420);
              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrent && setSelectedPlanId(isSelected ? null : plan.id)}
                  className={`border p-5 cursor-pointer transition-all relative overflow-hidden
                    ${isCurrent
                      ? "border-success/40 bg-success/5"
                      : isSelected
                        ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                        : "border-border/50 bg-card/40 hover:border-primary/30"}`}
                >
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current/30" />
                  {isCurrent && (
                    <Badge variant="outline" className="absolute top-3 right-3 rounded-none font-mono text-[11px] text-success border-success/40 bg-success/10">
                      Plano Atual
                    </Badge>
                  )}
                  <div className="mb-4">
                    <div className="font-mono font-black text-xl uppercase tracking-tight text-foreground mb-1">{plan.name}</div>
                    <div className="font-mono text-2xl font-bold text-primary">
                      {priceDisplay}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
                      pagamento único · acesso vitalício
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Créditos", value: plan.creditsMonthly.toLocaleString("pt-BR") },
                      { label: "Lançamentos", value: `~${launches}` },
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
                        <span className="font-mono text-[11px] text-muted-foreground leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && isSelected && (
                    <div className="mt-3 border-t border-border/30 pt-3">
                      <div className="font-mono text-[11px] text-primary uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Selecionado
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upgrade CTA ── */}
      {selectedPlanId && (
        <div className="border border-primary/30 bg-primary/5 p-5">
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3">
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
                <div className="font-mono text-xs font-bold uppercase tracking-widest">{m.label}</div>
                <div className="font-mono text-[11px] opacity-60 mt-0.5">{m.sub}</div>
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
          <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest mt-2 text-center">
            Acesso liberado imediatamente após confirmação do pagamento
          </p>
        </div>
      )}

      {/* ── Payment History ── */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
          <Receipt className="h-3 w-3" />Histórico de Pagamentos
        </div>
        {loadingHistory ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-muted/20" />)}</div>
        ) : payments.length === 0 ? (
          <div className="border border-border/30 bg-muted/10 p-6 text-center">
            <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Nenhum pagamento registrado ainda</p>
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
                      <div className="font-mono text-[11px] text-muted-foreground/50">
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
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] ${badge.className}`}>
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
        <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">
          Dúvidas sobre seu acesso ou créditos? <span className="text-primary">suporte@nexos.ai</span> · Seu acesso nunca expira e pagamentos nunca bloqueiam campanhas ativas.
        </p>
      </div>
    </div>
  );
}
