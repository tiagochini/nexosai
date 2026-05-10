import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Shield, Zap, Users,
  CreditCard, Lock, Building2, User, ChevronRight,
  Loader2, Star, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Plan = "solo" | "agency";

const PLANS = {
  solo: {
    name: "Solo",
    badge: "Lançador",
    price: "R$297",
    period: "/mês",
    onboarding: "+ R$2.500 onboarding único",
    tagline: "Para quem lança sozinho sem equipe",
    icon: User,
    color: "primary",
    credits: "1.500 créditos IA/mês",
    campaigns: "3 campanhas simultâneas",
    track: "Trilha 6 dígitos (R$100k–R$999k)",
    features: [
      "29 agentes de IA especializados",
      "Sequências WhatsApp + Email automáticas",
      "Segmentação hot/warm/cold em tempo real",
      "Dashboard de performance + health score",
      "Aprovação antes de qualquer execução",
      "Copy por fase e por segmento de lead",
      "Abertura e fechamento de carrinho automáticos",
    ],
  },
  agency: {
    name: "Agency",
    badge: "Agência",
    price: "R$1.497",
    period: "/mês",
    onboarding: "+ R$2.500 onboarding único",
    tagline: "Para agências e gestores de lançamento",
    icon: Building2,
    color: "success",
    credits: "5.000 créditos IA/mês",
    campaigns: "10 campanhas simultâneas",
    track: "Todas as trilhas + White-label completo",
    features: [
      "Tudo do Solo, mais:",
      "White-label — sua marca na plataforma",
      "Gestão multi-cliente em um painel",
      "Todas as trilhas de receita (6, 8 e 10 dígitos)",
      "Relatórios de performance por cliente",
      "Onboarding guiado no primeiro cliente",
      "Suporte prioritário",
    ],
  },
};

// ── Step 1: Plan picker ────────────────────────────────────────────────────────
function PlanPicker({ selected, onSelect }: { selected: Plan; onSelect: (p: Plan) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-2">Escolha seu plano</p>
        <h2 className="font-mono font-black uppercase text-2xl tracking-tight text-foreground">
          Qual é o seu perfil?
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["solo", "agency"] as Plan[]).map((plan) => {
          const p = PLANS[plan];
          const Icon = p.icon;
          const isSelected = selected === plan;
          return (
            <button
              key={plan}
              onClick={() => onSelect(plan)}
              className={`relative text-left border p-6 transition-all duration-200 group ${
                isSelected
                  ? `border-${p.color}/60 bg-${p.color}/8 shadow-[0_0_30px_hsl(var(--${p.color})/0.12)]`
                  : "border-border/40 bg-card/30 hover:border-border/70"
              }`}
            >
              {isSelected && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full bg-${p.color}/20 border border-${p.color}/50 flex items-center justify-center`}>
                  <Check className={`h-3 w-3 text-${p.color}`} />
                </div>
              )}
              <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-border/30 group-hover:border-primary/40 transition-colors" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-border/30 group-hover:border-primary/40 transition-colors" />
              <div className={`inline-flex items-center gap-1.5 border border-${p.color}/30 bg-${p.color}/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-${p.color} mb-4`}>
                <Icon className="h-3 w-3" />{p.badge}
              </div>
              <div className="mb-1">
                <span className={`font-mono font-black text-3xl ${isSelected ? `text-${p.color}` : "text-foreground"}`}>{p.price}</span>
                <span className="font-mono text-xs text-muted-foreground">{p.period}</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground mb-4">{p.onboarding}</p>
              <p className="font-mono text-xs text-foreground/70 leading-relaxed mb-4">{p.tagline}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Zap className={`h-3 w-3 text-${p.color}`} />
                  <span className="font-mono text-xs text-foreground">{p.credits}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className={`h-3 w-3 text-${p.color}`} />
                  <span className="font-mono text-xs text-foreground">{p.campaigns}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className={`h-3 w-3 text-${p.color}`} />
                  <span className="font-mono text-xs text-foreground">{p.track}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Checkout form ─────────────────────────────────────────────────────
function CheckoutForm({
  plan,
  onSuccess,
}: {
  plan: Plan;
  onSuccess: (accessToken: string, isNew: boolean) => void;
}) {
  const p = PLANS[plan];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          plan,
          testCard: { number: "4111 1111 1111 1111", expiry: "12/28", cvv: "123", name: name.trim() },
        }),
      });
      const data = await res.json() as { success?: boolean; accessToken?: string; isNewUser?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao processar. Tente novamente.");
        return;
      }
      onSuccess(data.accessToken!, data.isNewUser ?? true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan summary */}
      <div className={`border border-${p.color}/30 bg-${p.color}/5 p-4 flex items-center justify-between`}>
        <div>
          <div className={`font-mono text-[11px] uppercase tracking-widest text-${p.color} font-bold mb-0.5`}>Plano {p.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{p.credits} · {p.campaigns}</div>
        </div>
        <div className="text-right">
          <div className={`font-mono font-black text-xl text-${p.color}`}>{p.price}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
        </div>
      </div>

      {/* Account data */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
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
          <Label htmlFor="co-pass" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Senha</Label>
          <Input id="co-pass" type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-12 font-sans" />
          <p className="font-mono text-[11px] text-muted-foreground/50">Esta senha será usada para acessar a plataforma</p>
        </div>
      </div>

      {/* Test mode payment */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">Pagamento</span>
          <span className="font-mono text-[11px] px-2 py-0.5 border border-yellow-500/40 text-yellow-400 bg-yellow-500/5 uppercase tracking-widest">Modo Teste</span>
        </div>
        <div className="border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
          <p className="font-mono text-[11px] text-yellow-400/80 uppercase tracking-widest leading-relaxed">
            Fase de testes — qualquer dado de pagamento é aceito. Use os dados abaixo ou invente qualquer número.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Número do cartão</Label>
              <Input defaultValue="4111 1111 1111 1111" readOnly
                className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-11 text-muted-foreground cursor-default" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">Validade</Label>
                <Input defaultValue="12/28" readOnly
                  className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-11 text-muted-foreground cursor-default" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">CVV</Label>
                <Input defaultValue="123" readOnly
                  className="rounded-none bg-background/30 border-border/30 font-mono text-sm h-11 text-muted-foreground cursor-default" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading}
        className={`w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 ${plan === "agency" ? "bg-success hover:bg-success/90 text-success-foreground" : "btn-weapon-primary"}`}>
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
        ) : (
          <><Shield className="h-4 w-4" /> Confirmar compra e criar conta <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>
      <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 flex items-center justify-center gap-2">
        <Lock className="h-3 w-3" /> Modo teste · Dados protegidos
      </p>
    </form>
  );
}

// ── Step 3: Processing → Success ──────────────────────────────────────────────
function ProcessingScreen({ plan, isNew }: { plan: Plan; isNew: boolean }) {
  const p = PLANS[plan];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
      <div className={`w-20 h-20 border-2 border-${p.color}/40 bg-${p.color}/10 flex items-center justify-center`}>
        <CheckCircle2 className={`h-10 w-10 text-${p.color} drop-shadow-[0_0_15px_hsl(var(--${p.color})/0.6)]`} />
      </div>
      <div>
        <div className={`font-mono text-[11px] uppercase tracking-widest text-${p.color} font-bold mb-2`}>Plano {p.name} ativado</div>
        <h2 className="font-mono font-black uppercase text-2xl tracking-tight text-foreground mb-3">
          {isNew ? "Conta criada!" : "Plano atualizado!"}
        </h2>
        <p className="font-mono text-xs text-muted-foreground max-w-sm">
          {isNew
            ? "Sua conta foi criada e o plano ativado. Redirecionando para o dashboard..."
            : "Plano atualizado com sucesso. Redirecionando para o dashboard..."}
        </p>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Entrando na plataforma...
      </div>
    </div>
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultPlan = (params.get("plan") === "agency" ? "agency" : "solo") as Plan;

  const [step, setStep] = useState<"plan" | "form" | "success">("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan);
  const [isNew, setIsNew] = useState(true);
  const { setToken } = useAuth();
  const [, navigate] = useLocation();

  const handlePlanContinue = () => setStep("form");

  const handleSuccess = (accessToken: string, newUser: boolean) => {
    setIsNew(newUser);
    setStep("success");
    // Store token and redirect after brief animation
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
            <img src={nexosLogo} alt="NexOS AI" className="h-14 w-14 object-contain" style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.6))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-xl tracking-[0.15em] uppercase leading-tight">NexOS <span className="text-primary">AI</span></div>
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

          {/* Left: form area */}
          <div className="lg:col-span-3">
            <div className="border border-border/30 bg-card/30 backdrop-blur-sm p-8 relative">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40" />

              {step === "success" ? (
                <ProcessingScreen plan={selectedPlan} isNew={isNew} />
              ) : step === "plan" ? (
                <div className="space-y-6">
                  <PlanPicker selected={selectedPlan} onSelect={setSelectedPlan} />
                  <Button onClick={handlePlanContinue}
                    className={`w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 ${selectedPlan === "agency" ? "bg-success hover:bg-success/90 text-success-foreground" : "btn-weapon-primary"}`}>
                    Continuar com o plano {PLANS[selectedPlan].name} <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setStep("plan")} className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      ← Trocar plano
                    </button>
                  </div>
                  <CheckoutForm plan={selectedPlan} onSuccess={handleSuccess} />
                </div>
              )}
            </div>
          </div>

          {/* Right: features sidebar */}
          <div className="lg:col-span-2 space-y-6">
            {/* What's included */}
            <div className="border border-border/30 bg-card/20 p-6">
              <div className={`font-mono text-[11px] uppercase tracking-widest text-${PLANS[selectedPlan].color} font-bold mb-4`}>
                Incluso no plano {PLANS[selectedPlan].name}
              </div>
              <ul className="space-y-2.5">
                {PLANS[selectedPlan].features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className={`h-3.5 w-3.5 text-${PLANS[selectedPlan].color} shrink-0 mt-0.5`} />
                    <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Guarantee */}
            <div className="border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Acesso imediato</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Após confirmar a compra, sua conta é criada instantaneamente e você entra direto no dashboard — sem esperar email de confirmação.
              </p>
            </div>

            {/* Test mode notice */}
            <div className="border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold mb-1">Fase de testes</p>
              <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
                Qualquer email e dados de pagamento são aceitos para testar a experiência completa. Integração com gateway de pagamento real ativada em breve.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
