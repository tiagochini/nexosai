import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Shield, Zap,
  CreditCard, Lock, User, Loader2, Check,
  Infinity, Star, Copy, QrCode, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Plan config ───────────────────────────────────────────────────────────────
const PLANS = {
  solo: {
    id: "solo",
    label: "Solo",
    price: 3990,
    fmtPrice: "R$3.990",
    credits: 900,
    campaigns: 3,
    desc: "Produtor solo ou equipe pequena",
  },
  agency: {
    id: "agency",
    label: "Agency",
    price: 9990,
    fmtPrice: "R$9.990",
    credits: 2000,
    campaigns: 10,
    desc: "Agências e gestores com múltiplos clientes",
  },
} as const;

type PlanId = keyof typeof PLANS;

// ── Credit packs ──────────────────────────────────────────────────────────────
const CREDIT_PACKS = [
  { id: "boost",   credits: 500,  priceNum: 85,  label: "Boost",   perCredit: "R$0,17/cr", tag: undefined },
  { id: "starter", credits: 1500, priceNum: 239, label: "Starter", perCredit: "R$0,16/cr", tag: undefined },
  { id: "pro",     credits: 3500, priceNum: 529, label: "Pro",     perCredit: "R$0,15/cr", tag: "Melhor valor" as string | undefined },
  { id: "elite",   credits: 7000, priceNum: 979, label: "Elite",   perCredit: "R$0,14/cr", tag: undefined },
] as const;
type PackId = typeof CREDIT_PACKS[number]["id"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

// ── PIX payment screen ────────────────────────────────────────────────────────
function PixScreen({
  qrCode, copiaECola, expiresAt, planLabel, amount,
}: {
  qrCode: string;
  copiaECola: string;
  expiresAt: string;
  planLabel: string;
  amount: number;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(copiaECola).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const expiry = expiresAt ? new Date(expiresAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }) : null;

  return (
    <div className="space-y-6">
      <div className="border border-primary/30 bg-primary/5 p-5 space-y-1">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">PIX gerado com sucesso</div>
        <div className="font-mono text-xs text-muted-foreground">
          NexOS — Plano {planLabel} · {fmtBRL(amount)}
        </div>
        {expiry && (
          <div className="font-mono text-[11px] text-muted-foreground/60">Válido até {expiry}</div>
        )}
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4">
        <div className="border border-border/40 p-4 bg-white">
          <img
            src={`data:image/png;base64,${qrCode}`}
            alt="QR Code PIX"
            className="w-44 h-44 block"
          />
        </div>
        <p className="font-mono text-[11px] text-muted-foreground text-center">
          Escaneie com o app do seu banco para pagar
        </p>
      </div>

      {/* Copia e cola */}
      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1.5">
          <QrCode className="h-3 w-3" /> PIX Copia e Cola
        </div>
        <div className="border border-border/30 bg-background/50 p-3 flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground/70 break-all flex-1 select-all">
            {copiaECola.slice(0, 60)}...
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 rounded-none font-mono text-[11px] h-8 gap-1.5"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </div>

      <div className="border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed">
          Sua conta já está ativa. Você pode acessar a plataforma agora —
          seus créditos serão liberados após a confirmação do pagamento.
        </p>
      </div>
    </div>
  );
}

// ── Credit pack picker ────────────────────────────────────────────────────────
function CreditPackPicker({ selected, onSelect }: { selected: PackId | null; onSelect: (id: PackId | null) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">Recarga de créditos (opcional)</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CREDIT_PACKS.map(pack => {
          const active = selected === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => onSelect(active ? null : pack.id)}
              className={`relative border p-3 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border/30 bg-background/30 hover:border-primary/40"
              }`}
            >
              {pack.tag && (
                <div className="absolute -top-px right-2 bg-primary px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-primary-foreground">
                  {pack.tag}
                </div>
              )}
              {active && (
                <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-primary flex items-center justify-center">
                  <Check className="h-2 w-2 text-primary-foreground" />
                </div>
              )}
              <div className="font-mono font-black text-base text-foreground">{fmtBRL(pack.priceNum)}</div>
              <div className="font-mono text-[11px] text-primary font-bold">{pack.credits.toLocaleString("pt-BR")} créditos</div>
              <div className="font-mono text-[10px] text-muted-foreground/60">{pack.perCredit}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Checkout form ─────────────────────────────────────────────────────────────
function CheckoutForm({
  initialPlan,
  onSuccess,
  onPix,
}: {
  initialPlan: PlanId;
  onSuccess: (accessToken: string, refreshToken: string, isNew: boolean) => void;
  onPix: (data: { qrCode: string; copiaECola: string; expiresAt: string; planLabel: string; amount: number }) => void;
}) {
  const [plan] = useState<PlanId>(initialPlan);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [pack, setPack] = useState<PackId | null>("pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPack = CREDIT_PACKS.find(p => p.id === pack);
  const planConfig = PLANS[plan];
  const total = planConfig.price + (selectedPack?.priceNum ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          cpfCnpj: cpf.trim() || undefined,
          plan,
          creditPackId: pack ?? "none",
          creditPackCredits: selectedPack?.credits ?? 0,
        }),
      });
      const data = await res.json() as {
        success?: boolean;
        accessToken?: string;
        refreshToken?: string;
        isNewUser?: boolean;
        startingCredits?: number;
        plan?: string;
        planAmount?: number;
        pix?: { qrCode: string; copiaECola: string; expiresAt: string } | null;
        error?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao processar. Tente novamente.");
        return;
      }
      // Log in user immediately
      onSuccess(data.accessToken!, data.refreshToken ?? "", data.isNewUser ?? true);
      // Show PIX if available
      if (data.pix?.qrCode) {
        onPix({
          qrCode: data.pix.qrCode,
          copiaECola: data.pix.copiaECola,
          expiresAt: data.pix.expiresAt,
          planLabel: planConfig.label,
          amount: data.planAmount ?? planConfig.price,
        });
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Plan summary */}
      <div className="border border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-0.5">
              NexOS — Plano {planConfig.label}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {planConfig.campaigns} campanhas · {planConfig.credits} créditos incluídos
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-black text-2xl text-foreground">{planConfig.fmtPrice}</div>
            <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">pagamento único</div>
          </div>
        </div>
        <div className="border-t border-primary/20 pt-3 flex flex-wrap gap-x-4 gap-y-1">
          {[
            "64 agentes",
            "Acesso vitalício",
            "WhatsApp + Email automáticos",
            "Dashboard em tempo real",
          ].map(f => (
            <div key={f} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary shrink-0" />
              <span className="font-mono text-[11px] text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Credit pack */}
      <CreditPackPicker selected={pack} onSelect={setPack} />

      {/* Total */}
      <div className="border-t border-border/30 pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Plano {planConfig.label}</span>
          <span className="font-mono text-sm font-bold text-foreground">{fmtBRL(planConfig.price)}</span>
        </div>
        {selectedPack && (
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Pack {selectedPack.label} ({selectedPack.credits.toLocaleString("pt-BR")} créditos)
            </span>
            <span className="font-mono text-sm font-bold text-foreground">{fmtBRL(selectedPack.priceNum)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/20 pt-2 mt-2">
          <span className="font-mono text-xs uppercase tracking-widest font-bold text-foreground">Total hoje</span>
          <span className="font-mono text-xl font-black text-primary">{fmtBRL(total)}</span>
        </div>
      </div>

      {/* Account fields */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">Seus dados de acesso</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-name" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nome completo</Label>
          <Input id="co-name" required value={name} onChange={e => setName(e.target.value)}
            placeholder="Como você se chama?" className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-12 font-sans" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
          <Input id="co-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-12 font-sans" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-pass" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Senha de acesso</Label>
          <Input id="co-pass" type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-12 font-sans" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-cpf" className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            CPF / CNPJ <span className="text-muted-foreground/40">(opcional — para nota fiscal)</span>
          </Label>
          <Input id="co-cpf" value={cpf} onChange={e => setCpf(e.target.value)}
            placeholder="000.000.000-00" className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-12 font-sans" />
        </div>
      </div>

      {/* Payment method: PIX */}
      <div className="border border-border/30 bg-card/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-foreground font-bold">Pagamento via PIX</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
          O QR Code será gerado após confirmar. Aprovação instantânea. Disponível 24h.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center gap-2 font-mono text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full h-14 rounded-none btn-weapon-primary font-mono uppercase tracking-widest font-black text-sm gap-3">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
        ) : (
          <><Shield className="h-4 w-4" /> Confirmar e gerar PIX <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>
      <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 flex items-center justify-center gap-2">
        <Lock className="h-3 w-3" /> Conta criada na hora · Acesso imediato
      </p>
    </form>
  );
}

// ── Processing success ────────────────────────────────────────────────────────
function SuccessScreen({ isNew }: { isNew: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
      <div className="w-20 h-20 border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]" />
      </div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-2">Acesso Ativado</div>
        <h2 className="font-mono font-black uppercase text-2xl tracking-tight text-foreground mb-3">
          {isNew ? "Conta criada!" : "Acesso liberado!"}
        </h2>
        <p className="font-mono text-xs text-muted-foreground max-w-sm">
          Sua conta está pronta. Redirecionando para a plataforma...
        </p>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Entrando na plataforma...
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const [done, setDone] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [pixData, setPixData] = useState<{
    qrCode: string; copiaECola: string; expiresAt: string; planLabel: string; amount: number;
  } | null>(null);
  const { setToken } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Read plan from URL ?plan=solo or ?plan=agency
  const planParam = new URLSearchParams(search).get("plan");
  const initialPlan: PlanId = planParam === "agency" ? "agency" : "solo";

  const handleSuccess = (accessToken: string, refreshToken: string, newUser: boolean) => {
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    setIsNew(newUser);
    setDone(true);
    localStorage.setItem("accessToken", accessToken);
    setToken(accessToken);
    // Navigate after a short delay (or immediately if PIX screen takes over)
    setTimeout(() => {
      navigate(newUser ? "/welcome" : "/dashboard");
    }, pixData ? 8000 : 2200);
  };

  const handlePix = (data: typeof pixData) => {
    setPixData(data);
  };

  // Auto-navigate once done + PIX screen shown
  useEffect(() => {
    if (done && !pixData) {
      const t = setTimeout(() => navigate(isNew ? "/welcome" : "/dashboard"), 2200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [done, pixData, isNew, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground auth-bg-gradient">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={nexosLogo} alt="NexOS" className="h-14 w-14 object-contain"
              style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.6))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-xl tracking-[0.15em] uppercase leading-tight">
                NexOS
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/70">Checkout</div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
            <Lock className="h-3 w-3" /> Ambiente seguro
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Left: form or PIX */}
          <div className="lg:col-span-3">
            <div className="border border-border/30 bg-card/30 backdrop-blur-sm p-8 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40" />
              {done && !pixData ? (
                <SuccessScreen isNew={isNew} />
              ) : done && pixData ? (
                <div className="space-y-8">
                  <SuccessScreen isNew={isNew} />
                  <PixScreen {...pixData} />
                </div>
              ) : (
                <CheckoutForm
                  initialPlan={initialPlan}
                  onSuccess={handleSuccess}
                  onPix={handlePix}
                />
              )}
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="lg:col-span-2 space-y-5">
            {/* What's included */}
            <div className="border border-border/30 bg-card/20 p-6">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-4">
                Incluso no acesso
              </div>
              <ul className="space-y-2.5">
                {[
                  "57 especialistas especializados",
                  "Diagnóstico completo do produto e mercado",
                  "Estratégia de lançamento gerada por Claude",
                  "Copy de WhatsApp e Email por segmento",
                  "Segmentação hot/warm/cold automática",
                  "Abertura e fechamento de carrinho automáticos",
                  "Dashboard de performance com health score",
                  "Aprovação antes de qualquer execução",
                  "Calendário de lançamento dia a dia",
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Credits model */}
            <div className="border border-primary/20 bg-primary/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Infinity className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Modelo de créditos</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Créditos nunca expiram", desc: "Os créditos ficam na conta para sempre" },
                  { label: "Sem mensalidade obrigatória", desc: "Você recarrega quando consumir" },
                  { label: "Recarga a qualquer momento", desc: "Packs de 500 a 7.000 créditos" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Access guarantee */}
            <div className="border border-border/30 bg-card/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Acesso imediato</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Sua conta é criada na hora. Você entra direto no dashboard assim que confirmar.
              </p>
            </div>

            {/* Security */}
            <div className="border border-border/30 bg-card/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Pagamento seguro</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                PIX processado via Asaas. Aprovação instantânea, disponível 24h.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
