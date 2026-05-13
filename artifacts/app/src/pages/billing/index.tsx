import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CreditCard, CheckCircle2, Clock, Zap, RefreshCw, Receipt,
  ArrowUpRight, Lock, Infinity, Copy, ExternalLink, QrCode,
  FileText, CheckCheck, AlertCircle, X, ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccessStatus {
  planName: string;
  planSlug: string;
  status: string;
  accessPaid: boolean;
  accessPaidAt?: string;
}

interface PixData {
  qrCode?: string;
  copiaECola?: string;
  expiresAt?: string;
  asaasId?: string;
  instructions?: string;
}

interface BoletoData {
  barcodeUrl?: string;
  barcode?: string;
  dueDate?: string;
  asaasId?: string;
  instructions?: string;
}

interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  description?: string;
  createdAt: string;
  paidAt?: string;
  pixData?: PixData | null;
  boletoData?: BoletoData | null;
  expiresAt?: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthlyPriceBrl: number;
  creditsMonthly: number;
  maxCampaigns: number;
  features: string[];
  isWhiteLabel: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX", boleto: "Boleto", bank_transfer: "TED/Transferência",
  credit_card: "Cartão", crypto_usdt: "USDT", manual: "Manual",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Ativo",     className: "text-success border-success/40 bg-success/10" },
  trial:     { label: "Trial",     className: "text-primary border-primary/40 bg-primary/10" },
  pending:   { label: "Pendente",  className: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  cancelled: { label: "Cancelado", className: "text-destructive border-destructive/40 bg-destructive/10" },
  paid:      { label: "Pago",      className: "text-success border-success/40 bg-success/10" },
  expired:   { label: "Expirado",  className: "text-muted-foreground border-border bg-muted/20" },
};

const PAYMENT_METHODS = [
  { value: "pix",         label: "PIX",    sub: "Instantâneo · QR Code",          icon: QrCode    },
  { value: "boleto",      label: "Boleto", sub: "Vence em 3 dias · Código",        icon: FileText  },
  { value: "credit_card", label: "Cartão", sub: "+3,5% de taxa · Aprovação rápida", icon: CreditCard },
];

const CREDIT_PACKS = [
  { id: "pack_500",  credits: 500,  priceBrl: 85,  label: "Lançamento Extra", description: "~1 lançamento completo",   perCr: "0,170", highlight: false },
  { id: "pack_1500", credits: 1500, priceBrl: 239, label: "Trimestral",       description: "~3 lançamentos completos", perCr: "0,159", highlight: true  },
  { id: "pack_3500", credits: 3500, priceBrl: 529, label: "Semestral",        description: "~8 lançamentos completos", perCr: "0,151", highlight: false },
  { id: "pack_7000", credits: 7000, priceBrl: 979, label: "Anual",            description: "~16 lançamentos",         perCr: "0,140", highlight: false },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`)).catch(() => {
    toast.error("Não foi possível copiar. Selecione manualmente.");
  });
}

function formatBarcode(code: string) {
  if (!code) return "";
  const clean = code.replace(/\D/g, "");
  if (clean.length < 44) return code;
  return `${clean.slice(0,5)}.${clean.slice(5,10)} ${clean.slice(10,15)}.${clean.slice(15,21)} ${clean.slice(21,26)}.${clean.slice(26,32)} ${clean.slice(32,33)} ${clean.slice(33)}`;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────

function useCountdown(expiresAt?: string | null) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expirado"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2,"0")}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return remaining;
}

// ── Payment Panel ─────────────────────────────────────────────────────────────

function PaymentPanel({ payment, onClose, onConfirmed }: {
  payment: PaymentRecord;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const countdown = useCountdown(payment.expiresAt);
  const [copied, setCopied] = useState(false);

  const { data: polled } = useQuery<{ payment: PaymentRecord }>({
    queryKey: ["/api/billing/payment", payment.id],
    queryFn: async () => {
      const data = await customFetch<{ payment: PaymentRecord }>(`/api/billing/payment/${payment.id}`);
      return data;
    },
    enabled: payment.status !== "paid",
    refetchInterval: (query) => {
      const status = query.state.data?.payment?.status;
      return status === "paid" ? false : 5000;
    },
  });

  const currentStatus = polled?.payment?.status ?? payment.status;
  const isPaid = currentStatus === "paid";

  useEffect(() => {
    if (isPaid) { onConfirmed(); }
  }, [isPaid, onConfirmed]);

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, label);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pix = payment.pixData;
  const boleto = payment.boletoData;
  const amountBrl = (payment.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="border border-primary/30 bg-card/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          {payment.method === "pix" ? (
            <QrCode className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
            {METHOD_LABEL[payment.method]} · R${amountBrl}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isPaid && countdown && (
            <span className="font-mono text-[11px] text-yellow-400 uppercase tracking-widest">
              <Clock className="h-3 w-3 inline mr-1" />
              {countdown}
            </span>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* ── Paid state ── */}
        {isPaid && (
          <div className="text-center py-6">
            <CheckCheck className="h-12 w-12 text-success mx-auto mb-3" />
            <div className="font-mono text-lg font-bold uppercase tracking-widest text-success mb-1">
              Pagamento Confirmado!
            </div>
            <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
              {payment.description?.includes("crédito")
                ? "Seus créditos foram adicionados automaticamente"
                : "Seu acesso foi liberado automaticamente"}
            </p>
          </div>
        )}

        {/* ── PIX ── */}
        {!isPaid && payment.method === "pix" && pix && (
          <div className="space-y-4">
            {pix.qrCode ? (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="flex-shrink-0">
                  <div className="border-2 border-primary/30 p-2 bg-white inline-block">
                    <img
                      src={`data:image/png;base64,${pix.qrCode}`}
                      alt="QR Code PIX"
                      className="w-40 h-40 block"
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-1 text-center">
                    Escaneie com seu banco
                  </p>
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                      Pix Copia e Cola
                    </div>
                    <div className="border border-border/40 bg-muted/10 p-3 font-mono text-[11px] text-muted-foreground break-all leading-relaxed max-h-24 overflow-y-auto">
                      {pix.copiaECola}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleCopy(pix.copiaECola!, "Código PIX")}
                    variant="outline"
                    className="w-full rounded-none font-mono uppercase tracking-widest text-xs gap-2 border-primary/30 hover:bg-primary/10"
                  >
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                  <div className="border border-border/30 bg-muted/5 p-3 space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground/60 uppercase tracking-widest">Valor</span>
                      <span className="font-bold text-foreground">R${amountBrl}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground/60 uppercase tracking-widest">Banco</span>
                      <span className="text-muted-foreground">Qualquer banco / carteira</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-border/40 bg-muted/10 p-4">
                <AlertCircle className="h-5 w-5 text-yellow-400 mx-auto mb-2" />
                <p className="font-mono text-[11px] text-center text-muted-foreground">
                  {pix.instructions}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 py-2 border-t border-border/30">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                Aguardando confirmação automática...
              </span>
            </div>
          </div>
        )}

        {/* ── Boleto ── */}
        {!isPaid && payment.method === "boleto" && boleto && (
          <div className="space-y-4">
            {boleto.barcode ? (
              <>
                <div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                    Linha Digitável
                  </div>
                  <div className="border border-border/40 bg-muted/10 p-3 font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                    {formatBarcode(boleto.barcode)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCopy(boleto.barcode!, "Código de barras")}
                    variant="outline"
                    className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs gap-2 border-primary/30 hover:bg-primary/10"
                  >
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado!" : "Copiar código"}
                  </Button>
                  {boleto.barcodeUrl && (
                    <Button
                      onClick={() => window.open(boleto.barcodeUrl!, "_blank")}
                      variant="outline"
                      className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs gap-2 border-primary/30 hover:bg-primary/10"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir PDF
                    </Button>
                  )}
                </div>
                <div className="border border-border/30 bg-muted/5 p-3 space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground/60 uppercase tracking-widest">Valor</span>
                    <span className="font-bold text-foreground">R${amountBrl}</span>
                  </div>
                  {boleto.dueDate && (
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground/60 uppercase tracking-widest">Vencimento</span>
                      <span className="text-muted-foreground">
                        {new Date(boleto.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground/60 uppercase tracking-widest">Onde pagar</span>
                    <span className="text-muted-foreground">Qualquer banco / lotérica / app</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="border border-border/40 bg-muted/10 p-4 text-center">
                <AlertCircle className="h-5 w-5 text-yellow-400 mx-auto mb-2" />
                <p className="font-mono text-[11px] text-muted-foreground">{boleto.instructions}</p>
              </div>
            )}
            <div className="flex items-center gap-2 py-2 border-t border-border/30">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                Aguardando confirmação do pagamento...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card data type ────────────────────────────────────────────────────────────

interface CardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cpfCnpj?: string;
}

// ── Checkout selector ─────────────────────────────────────────────────────────

function CheckoutSelector({ label, amount, amountCents, onMethod, loading, onCancel }: {
  label: string;
  amount: string;
  amountCents: number;
  onMethod: (method: string, card?: CardData) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState("pix");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardMonth, setCardMonth] = useState("");
  const [cardYear, setCardYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpf, setCardCpf] = useState("");

  const cardFee = Math.round(amountCents * 1.035);
  const displayAmount = method === "credit_card" ? `R$ ${(cardFee / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : amount;

  const handlePay = () => {
    if (method === "credit_card") {
      if (!cardHolder || !cardNumber || !cardMonth || !cardYear || !cardCvv) {
        return;
      }
      onMethod(method, {
        holderName: cardHolder,
        number: cardNumber.replace(/\s/g, ""),
        expiryMonth: cardMonth,
        expiryYear: cardYear,
        cvv: cardCvv,
        cpfCnpj: cardCpf || undefined,
      });
    } else {
      onMethod(method);
    }
  };

  return (
    <div className="border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Pagamento</div>
          <div className="font-mono text-sm font-bold text-foreground">{label}</div>
          <div className="font-mono text-xl font-bold text-primary">{displayAmount}</div>
          {method === "credit_card" && (
            <div className="font-mono text-[10px] text-yellow-400/80 mt-0.5">+3,5% de taxa de cartão</div>
          )}
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PAYMENT_METHODS.map(m => {
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`border p-3 text-left transition-all flex items-start gap-2
                ${method === m.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 hover:border-primary/30 text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-widest">{m.label}</div>
                <div className="font-mono text-[10px] opacity-70 mt-0.5 leading-relaxed">{m.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Card form */}
      {method === "credit_card" && (
        <div className="border border-border/40 bg-muted/5 p-4 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
            <Lock className="h-3 w-3" /> Dados do cartão
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Nome no cartão</label>
            <input
              value={cardHolder}
              onChange={e => setCardHolder(e.target.value.toUpperCase())}
              placeholder="NOME SOBRENOME"
              className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Número do cartão</label>
            <input
              value={cardNumber}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
              }}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Mês</label>
              <input value={cardMonth} onChange={e => setCardMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM" maxLength={2}
                className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Ano</label>
              <input value={cardYear} onChange={e => setCardYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="AAAA" maxLength={4}
                className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CVV</label>
              <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" maxLength={4}
                className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CPF do titular (opcional)</label>
            <input value={cardCpf} onChange={e => setCardCpf(e.target.value)} placeholder="000.000.000-00"
              className="w-full border border-border/40 bg-background/50 rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      )}

      <Button
        onClick={handlePay}
        disabled={loading || (method === "credit_card" && (!cardHolder || !cardNumber || !cardMonth || !cardYear || !cardCvv))}
        className="w-full font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11"
      >
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {loading ? "Processando..." : `Pagar via ${METHOD_LABEL[method]}`}
      </Button>
      <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center">
        Confirmação automática · Acesso/créditos liberados na hora
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { plan: currentPlan, planSlug } = useAuth();
  const queryClient = useQueryClient();

  const [checkout, setCheckout] = useState<{
    type: "pack" | "plan";
    id: string;
    label: string;
    amountBrl: string;
  } | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentRecord | null>(null);

  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/billing/status"],
    queryFn: () => customFetch<AccessStatus>("/api/billing/status"),
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/billing/history"],
    queryFn: async () => {
      const data = await customFetch<{ payments: PaymentRecord[] }>("/api/billing/history");
      return data;
    },
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const data = await customFetch<{ plans: Plan[] }>("/api/plans");
      return data;
    },
  });

  const initiatePlanMutation = useMutation({
    mutationFn: async ({ planId, method, card }: { planId: string; method: string; card?: CardData }) => {
      const data = await customFetch<{ payment: PaymentRecord }>("/api/billing/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, method, card }),
      });
      return data;
    },
    onSuccess: (data) => {
      setActivePayment(data.payment);
      setCheckout(null);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/history"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Não foi possível gerar o pagamento. Tente novamente.");
    },
  });

  const initiatePackMutation = useMutation({
    mutationFn: async ({ packId, method, card }: { packId: string; method: string; card?: CardData }) => {
      const data = await customFetch<{ payment: PaymentRecord }>("/api/billing/packs/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, method, card }),
      });
      return data;
    },
    onSuccess: (data) => {
      setActivePayment(data.payment);
      setCheckout(null);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/history"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Não foi possível gerar o pagamento. Tente novamente.");
    },
  });

  const handlePaymentConfirmed = () => {
    toast.success("Pagamento confirmado! Créditos/acesso liberados.", { duration: 6000 });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/credits/balance"] });
    setTimeout(() => setActivePayment(null), 4000);
  };

  const status = statusData;
  const payments = historyData?.payments ?? [];
  const plans = plansData?.plans ?? [];
  const isAccessPaid = status?.accessPaid ?? false;

  const displayPlans: Plan[] = plans.length > 0 ? plans : [
    {
      id: "solo", name: "Solo", slug: "solo", monthlyPriceBrl: 399000, creditsMonthly: 900,
      maxCampaigns: 3, isWhiteLabel: false,
      features: [
        "Acesso vitalício à plataforma",
        "900 créditos incluídos (~2 lançamentos completos)",
        "Até 3 campanhas simultâneas",
        "Track de 6 dígitos",
        "16 agentes de IA especializados",
        "Sequência PLF automatizada",
        "Landing page gerada por IA",
      ],
    },
    {
      id: "agency", name: "Agency", slug: "agency", monthlyPriceBrl: 999000, creditsMonthly: 2000,
      maxCampaigns: 10, isWhiteLabel: true,
      features: [
        "Acesso vitalício à plataforma",
        "2.000 créditos incluídos (~5 lançamentos)",
        "Até 10 campanhas simultâneas",
        "Todos os tracks (6, 8, 10 dígitos)",
        "White-label incluído",
        "Dashboard multi-cliente",
        "Suporte prioritário",
      ],
    },
  ];

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

      {/* ── Active payment panel ── */}
      {activePayment && (
        <PaymentPanel
          payment={activePayment}
          onClose={() => setActivePayment(null)}
          onConfirmed={handlePaymentConfirmed}
        />
      )}

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
          {CREDIT_PACKS.map(pack => {
            const isSelected = checkout?.id === pack.id && checkout.type === "pack";
            return (
              <div
                key={pack.id}
                onClick={() => {
                  if (activePayment) return;
                  setCheckout(isSelected ? null : {
                    type: "pack",
                    id: pack.id,
                    label: pack.label,
                    amountBrl: `R$${pack.priceBrl}`,
                  });
                }}
                className={`border p-4 cursor-pointer transition-all relative overflow-hidden
                  ${pack.highlight
                    ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.08)]"
                    : "border-border/40 bg-card/30 hover:border-primary/30"
                  }
                  ${isSelected ? "border-primary/60 bg-primary/8 ring-1 ring-primary/20" : ""}
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
                  {pack.credits.toLocaleString("pt-BR")} créditos · R${pack.perCr}/cr
                </div>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1 font-mono text-[11px] text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Selecionado
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pack checkout */}
        {checkout?.type === "pack" && !activePayment && (
          <div className="mt-3">
            <CheckoutSelector
              label={`Pack ${checkout.label}`}
              amount={checkout.amountBrl}
              amountCents={parseInt(checkout.amountBrl.replace(/[^\d]/g, ""), 10) || 0}
              loading={initiatePackMutation.isPending}
              onCancel={() => setCheckout(null)}
              onMethod={(method, card) => initiatePackMutation.mutate({ packId: checkout.id, method, card })}
            />
          </div>
        )}
      </div>

      {/* ── Plan Options ── */}
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
              const isSelected = checkout?.id === plan.id && checkout.type === "plan";
              const priceDisplay = plan.monthlyPriceBrl > 0
                ? `R$${(plan.monthlyPriceBrl / 100).toLocaleString("pt-BR")}`
                : plan.slug === "solo" ? "R$3.990" : "R$9.990";
              const launches = Math.max(1, Math.floor(plan.creditsMonthly / 420));
              return (
                <div key={plan.id}>
                  <div
                    onClick={() => {
                      if (isCurrent || activePayment) return;
                      setCheckout(isSelected ? null : {
                        type: "plan",
                        id: plan.id,
                        label: `Plano ${plan.name}`,
                        amountBrl: priceDisplay,
                      });
                    }}
                    className={`border p-5 cursor-pointer transition-all relative overflow-hidden
                      ${isCurrent
                        ? "border-success/40 bg-success/5 cursor-default"
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
                      <div className="font-mono text-2xl font-bold text-primary">{priceDisplay}</div>
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
                      <div className="mt-3 border-t border-border/30 pt-3 flex items-center gap-1 font-mono text-[11px] text-primary">
                        <CheckCircle2 className="h-3 w-3" /> Selecionado — escolha a forma de pagamento abaixo
                      </div>
                    )}
                  </div>

                  {isSelected && !activePayment && (
                    <div className="mt-2">
                      <CheckoutSelector
                        label={`Plano ${plan.name}`}
                        amount={priceDisplay}
                        amountCents={plan.monthlyPriceBrl}
                        loading={initiatePlanMutation.isPending}
                        onCancel={() => setCheckout(null)}
                        onMethod={(method, card) => initiatePlanMutation.mutate({ planId: plan.id, method, card })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                      R${(p.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {badge && (
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    )}
                    {p.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 font-mono text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 rounded-none"
                        onClick={() => setActivePayment(p)}
                      >
                        Ver
                        <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
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
        <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">
          Pagamentos processados via <strong className="text-foreground/80">Asaas</strong>.
          Confirmação automática via webhook. Dúvidas:{" "}
          <a href="mailto:suporte@nexos.ai" className="text-primary hover:underline">suporte@nexos.ai</a>
        </p>
      </div>

    </div>
  );
}
