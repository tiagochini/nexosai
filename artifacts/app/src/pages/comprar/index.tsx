import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  Shield, Lock, QrCode, FileText, CreditCard,
  CheckCheck, Copy, ExternalLink, RefreshCw, AlertCircle,
  ChevronRight, Loader2, ArrowRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicProduct {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  successUrl?: string;
}

interface Sale {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  pixData?: { qrCode?: string; copiaECola?: string; expiresAt?: string } | null;
  boletoData?: { barcodeUrl?: string; barcode?: string; dueDate?: string } | null;
  cardData?: { last4?: string; brand?: string; status?: string; installmentCount?: number; installmentValueCents?: number } | null;
}

interface CardInstallmentOption {
  installmentCount: number;
  installmentValueCents: number;
  totalCents: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBarcode(code: string) {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 44) return code;
  return `${clean.slice(0,5)}.${clean.slice(5,10)} ${clean.slice(10,15)}.${clean.slice(15,21)} ${clean.slice(21,26)}.${clean.slice(26,32)} ${clean.slice(32,33)} ${clean.slice(33)}`;
}

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

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pix: QrCode,
  boleto: FileText,
  credit_card: CreditCard,
};

// ── Payment display ───────────────────────────────────────────────────────────

function PaymentDisplay({ sale, onPaid }: { sale: Sale; onPaid: () => void }) {
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(sale.pixData?.expiresAt);

  // Poll until paid
  useEffect(() => {
    if (sale.status === "paid") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/products/sales/${sale.id}`);
        const data = await res.json() as { sale: Sale };
        if (data.sale?.status === "paid") {
          clearInterval(interval);
          onPaid();
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sale.id, sale.status, onPaid]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const amountBrl = fmtBRL(sale.amountCents);

  // Credit card — show result
  if (sale.method === "credit_card") {
    const card = sale.cardData;
    const isApproved = card?.status === "CONFIRMED" || card?.status === "RECEIVED" || sale.status === "paid";
    return (
      <div className="border border-border/40 bg-card/40 p-6 text-center space-y-4">
        {isApproved ? (
          <>
            <CheckCheck className="h-12 w-12 text-success mx-auto" />
            <div>
              <div className="font-mono text-lg font-bold uppercase tracking-widest text-success">Pagamento aprovado!</div>
              <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mt-1">
                {card?.brand} •••• {card?.last4} · {card?.installmentCount ?? 1}x de {fmtBRL(card?.installmentValueCents ?? sale.amountCents)}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto" />
            <div>
              <div className="font-mono text-sm font-bold text-foreground">Processando pagamento...</div>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                {card?.brand} •••• {card?.last4} · {card?.installmentCount ?? 1}x de {fmtBRL(card?.installmentValueCents ?? sale.amountCents)}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  const pix = sale.pixData;
  const boleto = sale.boletoData;

  return (
    <div className="border border-primary/20 bg-card/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-2">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
            {sale.method === "pix" ? "PIX" : "Boleto"} · {amountBrl}
          </div>
        </div>
        {countdown && (
          <span className="font-mono text-[11px] text-yellow-400">{countdown}</span>
        )}
      </div>
      <div className="p-5">
        {/* PIX */}
        {sale.method === "pix" && pix && (
          <div className="space-y-4">
            {pix.qrCode && (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="border-2 border-primary/30 p-2 bg-white inline-block">
                  <img src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code PIX" className="w-40 h-40 block" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest mb-1">Pix Copia e Cola</div>
                    <div className="border border-border/40 bg-muted/10 p-3 font-mono text-[11px] text-muted-foreground break-all max-h-20 overflow-y-auto">
                      {pix.copiaECola}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleCopy(pix.copiaECola!, "Código PIX")}
                    variant="outline"
                    className="w-full rounded-none font-mono uppercase tracking-widest text-xs gap-2 border-primary/30"
                  >
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                Aguardando confirmação automática...
              </span>
            </div>
          </div>
        )}

        {/* Boleto */}
        {sale.method === "boleto" && boleto && (
          <div className="space-y-4">
            {boleto.barcode && (
              <>
                <div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest mb-1">Linha Digitável</div>
                  <div className="border border-border/40 bg-muted/10 p-3 font-mono text-[11px] text-muted-foreground break-all">
                    {formatBarcode(boleto.barcode)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleCopy(boleto.barcode!, "Código")} variant="outline" className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs gap-2">
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar
                  </Button>
                  {boleto.barcodeUrl && (
                    <Button onClick={() => window.open(boleto.barcodeUrl!, "_blank")} variant="outline" className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir PDF
                    </Button>
                  )}
                </div>
              </>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                Aguardando confirmação...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Checkout form ─────────────────────────────────────────────────────────────

function CheckoutForm({ product, onSale }: { product: PublicProduct; onSale: (s: Sale) => void }) {
  const [method, setMethod] = useState<"pix" | "boleto" | "credit_card">("pix");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  // card fields
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardMonth, setCardMonth] = useState("");
  const [cardYear, setCardYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [installmentOptions, setInstallmentOptions] = useState<CardInstallmentOption[]>([]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInstallment = installmentOptions.find((option) => option.installmentCount === installmentCount);
  const chargedAmount = method === "credit_card" ? (selectedInstallment?.totalCents ?? product.priceCents) : product.priceCents;

  useEffect(() => {
    if (method !== "credit_card" || installmentOptions.length > 0) return;
    let cancelled = false;
    setInstallmentsLoading(true);
    fetch(`/api/products/${product.id}/installments`)
      .then(async (response) => {
        const data = await response.json() as { options?: CardInstallmentOption[]; error?: string };
        if (!response.ok || !data.options?.length) throw new Error(data.error ?? "Parcelamento indisponível.");
        if (!cancelled) {
          setInstallmentOptions(data.options);
          setInstallmentCount(data.options[0]?.installmentCount ?? 1);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setInstallmentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [method, installmentOptions.length, product.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        buyerCpf: cpf.trim() || undefined,
        method,
      };
      if (method === "credit_card") {
        body.installmentCount = installmentCount;
        body.card = {
          holderName: cardHolder,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth: cardMonth,
          expiryYear: cardYear,
          cvv: cardCvv,
          cpfCnpj: cardCpf || cpf || undefined,
        };
      }
      const res = await fetch(`/api/products/${product.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { sale?: Sale; error?: string };
      if (!res.ok || !data.sale) {
        setError(data.error ?? "Erro ao processar pagamento.");
        return;
      }
      onSale(data.sale);
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  const methods = [
    { value: "pix" as const, label: "PIX", sub: "Instantâneo · QR Code", icon: QrCode },
    { value: "boleto" as const, label: "Boleto", sub: "Vence em 3 dias", icon: FileText },
    { value: "credit_card" as const, label: "Cartão", sub: "À vista ou parcelado", icon: CreditCard },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Buyer info */}
      <div className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Seus dados</div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nome completo</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Como você se chama" required className="rounded-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className="rounded-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">CPF (opcional)</Label>
          <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-none" />
        </div>
      </div>

      {/* Method selector */}
      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Forma de pagamento</div>
        <div className="grid grid-cols-3 gap-2">
          {methods.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`border p-3 text-left transition-all ${
                  method === m.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 hover:border-primary/30 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                <div className="font-mono text-xs font-bold uppercase tracking-widest">{m.label}</div>
                <div className="font-mono text-[10px] opacity-70 leading-relaxed mt-0.5">{m.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card fields */}
      {method === "credit_card" && (
        <div className="border border-border/40 bg-muted/5 p-4 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
            <Lock className="h-3 w-3" /> Dados do cartão · Cobrança segura via Asaas
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-installments" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Parcelamento</Label>
            <select
              id="card-installments"
              value={installmentCount}
              onChange={(event) => setInstallmentCount(Number(event.target.value))}
              disabled={installmentsLoading || installmentOptions.length === 0}
              className="w-full h-10 border border-border bg-background px-3 font-mono text-xs text-foreground disabled:opacity-50"
            >
              {installmentsLoading && <option>Calculando opções...</option>}
              {!installmentsLoading && installmentOptions.map((option) => (
                <option key={option.installmentCount} value={option.installmentCount}>
                  {option.installmentCount}x de {fmtBRL(option.installmentValueCents)} · total {fmtBRL(option.totalCents)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nome no cartão</Label>
            <Input value={cardHolder} onChange={e => setCardHolder(e.target.value)} placeholder="NOME SOBRENOME" required={method === "credit_card"} className="rounded-none uppercase" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Número do cartão</Label>
            <Input
              value={cardNumber}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
              }}
              placeholder="0000 0000 0000 0000"
              required={method === "credit_card"}
              className="rounded-none font-mono tracking-widest"
              maxLength={19}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Mês</Label>
              <Input value={cardMonth} onChange={e => setCardMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM" required={method === "credit_card"} className="rounded-none font-mono" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Ano</Label>
              <Input value={cardYear} onChange={e => setCardYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="AAAA" required={method === "credit_card"} className="rounded-none font-mono" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">CVV</Label>
              <Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" required={method === "credit_card"} className="rounded-none font-mono" maxLength={4} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">CPF do titular</Label>
            <Input value={cardCpf} onChange={e => setCardCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-none" />
          </div>
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      {/* Total + CTA */}
      <div className="border-t border-border/30 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total</span>
          <span className="font-mono text-2xl font-black text-primary">{fmtBRL(chargedAmount)}</span>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 rounded-none btn-weapon-primary font-mono uppercase tracking-widest font-bold text-sm gap-2">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
          ) : (
            <><Shield className="h-4 w-4" /> Pagar agora <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
        <p className="font-mono text-[11px] text-center text-muted-foreground/40 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" /> Pagamento seguro via Asaas
        </p>
      </div>
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ successUrl }: { successUrl?: string }) {
  useEffect(() => {
    if (!successUrl) return;
    const t = setTimeout(() => { window.location.href = successUrl; }, 3000);
    return () => clearTimeout(t);
  }, [successUrl]);

  return (
    <div className="text-center py-10 space-y-5">
      <div className="w-20 h-20 border-2 border-success/40 bg-success/10 flex items-center justify-center mx-auto">
        <CheckCheck className="h-10 w-10 text-success" />
      </div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-success font-bold mb-2">Compra confirmada!</div>
        <h2 className="font-mono font-black uppercase text-2xl tracking-tight text-foreground mb-2">Obrigado!</h2>
        <p className="font-mono text-xs text-muted-foreground">
          Você receberá um email com os detalhes da sua compra.
          {successUrl && " Redirecionando em instantes..."}
        </p>
      </div>
      {successUrl && (
        <Button onClick={() => { window.location.href = successUrl; }} className="rounded-none font-mono uppercase tracking-widest text-xs gap-2">
          <ChevronRight className="h-3.5 w-3.5" /> Continuar
        </Button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ComprarPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [sale, setSale] = useState<Sale | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}/public`)
      .then(r => r.json())
      .then((d: { product?: PublicProduct }) => {
        if (d.product) setProduct(d.product);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingProduct(false));
  }, [productId]);

  return (
    <div className="min-h-screen bg-background text-foreground auth-bg-gradient">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-mono font-black text-lg tracking-[0.15em] uppercase">
            NexOS
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
            <Lock className="h-3 w-3" /> Compra segura
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {loadingProduct ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/2 bg-muted/20" />
            <Skeleton className="h-48 w-full bg-muted/20" />
            <Skeleton className="h-10 w-full bg-muted/20" />
          </div>
        ) : notFound ? (
          <div className="text-center py-20 space-y-4">
            <X className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="font-mono text-muted-foreground uppercase tracking-widest">Produto não encontrado ou inativo.</p>
          </div>
        ) : product ? (
          <div className="border border-border/30 bg-card/30 backdrop-blur-sm p-8 relative">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40" />

            {paid ? (
              <SuccessScreen successUrl={product.successUrl} />
            ) : sale ? (
              <div className="space-y-5">
                {/* Product summary */}
                <div className="border border-border/30 bg-muted/10 p-4">
                  <div className="font-mono text-sm font-bold text-foreground">{product.name}</div>
                  <div className="font-mono text-2xl font-black text-primary mt-1">{fmtBRL(sale.amountCents)}</div>
                </div>
                <PaymentDisplay sale={sale} onPaid={() => setPaid(true)} />
                <button
                  onClick={() => setSale(null)}
                  className="font-mono text-[11px] text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest transition-colors"
                >
                  ← Escolher outra forma de pagamento
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Product header */}
                <div className="border-b border-border/30 pb-5">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-1">Você está comprando</div>
                  <h1 className="font-mono font-black text-xl text-foreground">{product.name}</h1>
                  {product.description && (
                    <p className="font-mono text-xs text-muted-foreground/70 mt-2 leading-relaxed">{product.description}</p>
                  )}
                  <div className="font-mono text-3xl font-black text-primary mt-3">{fmtBRL(product.priceCents)}</div>
                </div>
                <CheckoutForm product={product} onSale={setSale} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
