import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Shield, Zap,
  CreditCard, Lock, User, Loader2, Check,
  Infinity, Star, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Credit packs ──────────────────────────────────────────────────────────────
const CREDIT_PACKS = [
  {
    id: "starter",
    credits: 1500,
    price: "R$150",
    priceNum: 150,
    label: "Starter",
    perCredit: "R$0,10/crédito",
    tag: null,
    highlight: false,
  },
  {
    id: "pro",
    credits: 3000,
    price: "R$240",
    priceNum: 240,
    label: "Pro",
    perCredit: "R$0,08/crédito",
    tag: "Melhor valor",
    highlight: true,
  },
] as const;

type PackId = typeof CREDIT_PACKS[number]["id"];

// ── Credit pack picker ────────────────────────────────────────────────────────
function CreditPackPicker({ selected, onSelect }: { selected: PackId | null; onSelect: (id: PackId | null) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">
            Recarga de créditos inicial
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">Opcional</span>
      </div>
      <div className="border border-primary/10 bg-primary/5 px-4 py-3 flex items-start gap-2.5">
        <Infinity className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed">
          Créditos nunca expiram. Sem mensalidade obrigatória — você recarrega quando quiser, no valor que preferir.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {CREDIT_PACKS.map(pack => {
          const isSelected = selected === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : pack.id)}
              className={`relative text-left border p-4 transition-all duration-150 group ${
                isSelected
                  ? "border-primary/60 bg-primary/8 shadow-[0_0_20px_hsl(var(--primary)/0.10)]"
                  : "border-border/40 bg-card/20 hover:border-border/70"
              }`}
            >
              {pack.tag && (
                <div className="absolute -top-2.5 left-3 bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-bold">
                  {pack.tag}
                </div>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary" />
                </div>
              )}
              <div className="font-mono font-black text-lg text-foreground mb-0.5">{pack.price}</div>
              <div className="font-mono text-xs text-primary font-bold mb-1">{pack.credits.toLocaleString("pt-BR")} créditos</div>
              <div className="font-mono text-[11px] text-muted-foreground/60">{pack.perCredit}</div>
            </button>
          );
        })}
      </div>
      {selected === null && (
        <p className="font-mono text-[11px] text-muted-foreground/40 text-center">
          Sem recarga agora — você compra créditos quando precisar
        </p>
      )}
    </div>
  );
}

// ── Checkout form ─────────────────────────────────────────────────────────────
function CheckoutForm({
  onSuccess,
}: {
  onSuccess: (accessToken: string, isNew: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pack, setPack] = useState<PackId | null>("pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPack = CREDIT_PACKS.find(p => p.id === pack);
  const total = 3990 + (selectedPack?.priceNum ?? 0);
  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          creditPackId: pack ?? "none",
          creditPackCredits: selectedPack?.credits ?? 0,
        }),
      });
      const data = await res.json() as {
        success?: boolean;
        accessToken?: string;
        refreshToken?: string;
        isNewUser?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao processar. Tente novamente.");
        return;
      }
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      onSuccess(data.accessToken!, data.isNewUser ?? true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Product summary */}
      <div className="border border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-0.5">
              NexOS AI — Acesso Completo
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              29 agentes IA · 3 campanhas · Sequências automáticas
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-black text-2xl text-foreground">{fmtBRL(3990)}</div>
            <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">pagamento único</div>
          </div>
        </div>
        <div className="border-t border-primary/20 pt-3 flex items-center gap-2 flex-wrap">
          {[
            "29 agentes IA",
            "Aprovação antes de qualquer execução",
            "WhatsApp + Email automáticos",
            "Health score em tempo real",
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

      {/* Divider + total */}
      <div className="border-t border-border/30 pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Acesso à plataforma</span>
          <span className="font-mono text-sm font-bold text-foreground">{fmtBRL(3990)}</span>
        </div>
        {selectedPack && (
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Créditos {selectedPack.label} ({selectedPack.credits.toLocaleString("pt-BR")} créditos)
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
      </div>

      {/* Test payment */}
      <div className="border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-yellow-400" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold">Modo Teste · Pagamento Simulado</span>
        </div>
        <p className="font-mono text-[11px] text-yellow-400/70 leading-relaxed">
          Qualquer número de cartão é aceito. Nenhuma cobrança real será feita.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Input defaultValue="4111 1111 1111 1111" readOnly
            className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-10 text-muted-foreground cursor-default text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <Input defaultValue="12/28" readOnly
              className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-10 text-muted-foreground cursor-default text-xs" />
            <Input defaultValue="123" readOnly
              className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-10 text-muted-foreground cursor-default text-xs" />
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">{error}</div>
      )}

      <Button type="submit" disabled={loading} className="w-full h-14 rounded-none btn-weapon-primary font-mono uppercase tracking-widest font-black text-sm gap-3">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
        ) : (
          <><Shield className="h-4 w-4" /> Confirmar e criar minha conta <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>
      <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 flex items-center justify-center gap-2">
        <Lock className="h-3 w-3" /> Modo teste · Acesso imediato · Sem cobrança real
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
  const { setToken } = useAuth();
  const [, navigate] = useLocation();

  const handleSuccess = (accessToken: string, newUser: boolean, refreshToken?: string) => {
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    setIsNew(newUser);
    setDone(true);
    localStorage.setItem("accessToken", accessToken);
    setToken(accessToken);
    setTimeout(() => {
      navigate(newUser ? "/onboarding" : "/dashboard");
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-background text-foreground auth-bg-gradient">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={nexosLogo} alt="NexOS AI" className="h-14 w-14 object-contain"
              style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.6))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-xl tracking-[0.15em] uppercase leading-tight">
                NexOS <span className="text-primary">AI</span>
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

          {/* Left: form */}
          <div className="lg:col-span-3">
            <div className="border border-border/30 bg-card/30 backdrop-blur-sm p-8 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40" />
              {done
                ? <SuccessScreen isNew={isNew} />
                : <CheckoutForm onSuccess={handleSuccess} />
              }
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
                  "29 agentes de IA especializados",
                  "Diagnóstico completo do produto e mercado",
                  "Estratégia de lançamento gerada por Claude",
                  "Copy de WhatsApp e Email por segmento de lead",
                  "Segmentação hot/warm/cold automática em tempo real",
                  "Abertura e fechamento de carrinho automáticos",
                  "Dashboard de performance com health score",
                  "Aprovação antes de qualquer execução",
                  "Calendário de lançamento dia a dia",
                  "3 campanhas ativas simultâneas",
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
                  { label: "Créditos nunca expiram", desc: "Os créditos que você compra ficam na sua conta para sempre" },
                  { label: "Sem mensalidade obrigatória", desc: "Você recarrega quando consumir — sem cobrança automática" },
                  { label: "Recarga a qualquer momento", desc: "R$150 · 1.500 créditos ou R$240 · 3.000 créditos" },
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
                Sua conta é criada na hora. Você entra direto no dashboard — sem esperar email de confirmação.
              </p>
            </div>

            {/* Test notice */}
            <div className="border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ChevronDown className="h-3 w-3 text-yellow-400" />
                <p className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold">Fase de testes</p>
              </div>
              <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
                Plataforma em testes privados. Qualquer dado de pagamento é aceito. Nenhuma cobrança real é processada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
