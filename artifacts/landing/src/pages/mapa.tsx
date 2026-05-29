import { useState, useEffect } from "react";
import nexosLogo from "/nexos-logo.png";
import { CheckCircle2, ArrowRight, Gift, Loader2, Map, Lock } from "lucide-react";

const SEQUENCE_ID = "f3756cb9-a767-47b5-97a2-386c080b0354";

const BULLETS = [
  "O framework dos primeiros R$10K em 7 dias",
  "Como escolher o produto certo sem audiência",
  "A sequência exata de email + WhatsApp que converte",
  "Os 3 gatilhos que multiplicam o ticket médio",
  "O checklist de lançamento usado por produtores de 6 dígitos",
];

export default function MapaPage() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [refCode, setRefCode]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ref = p.get("ref");
    if (ref) setRefCode(ref.toUpperCase().trim());
    // Scroll to top
    window.scrollTo(0, 0);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const p = new URLSearchParams(window.location.search);
      const body: Record<string, string> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        utm_source:   p.get("utm_source")   || "whatsapp",
        utm_medium:   p.get("utm_medium")   || "catalog",
        utm_campaign: p.get("utm_campaign") || "mapa_gratis",
      };
      if (refCode)           body.referralCode = refCode;
      if (p.get("utm_term")) body.utmTerm = p.get("utm_term")!;

      const res = await fetch(`/api/lead-capture/${SEQUENCE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok && res.status !== 409) {
        throw new Error("Erro ao registrar");
      }
      setSuccess(true);
    } catch {
      setError("Algo deu errado. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/30 bg-background/90 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <img src={nexosLogo} alt="NexOS" className="h-9 w-9 object-contain"
          style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.6))" }} />
        <div className="font-mono font-black text-base tracking-[0.15em] uppercase">
          NexOS
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {!success ? (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Download Gratuito
                </div>

                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none mb-4">
                  Mapa dos{" "}
                  <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
                    Primeiros R$10K
                  </span>
                </h1>

                <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
                  O framework que produtores usam para chegar nos primeiros R$10K — sem audiência, sem agência e sem precisar virar expert em tráfego.
                </p>
              </div>

              {/* Bullets */}
              <div className="border border-border/30 bg-card/30 p-5 mb-6 space-y-3">
                {BULLETS.map((b, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/80 leading-snug">{b}</span>
                  </div>
                ))}
              </div>

              {/* Referral badge */}
              {refCode && (
                <div className="border border-success/30 bg-success/5 px-4 py-3 flex items-center gap-2 mb-4">
                  <Gift className="h-4 w-4 text-success shrink-0" />
                  <span className="font-mono text-xs text-success uppercase tracking-widest">
                    Indicado por <strong>{refCode}</strong> — você tem prioridade de acesso
                  </span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Seu primeiro nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full font-mono bg-background/60 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_hsl(var(--primary)/0.2)] transition-all"
                />
                <input
                  type="email"
                  required
                  placeholder="Seu melhor email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full font-mono bg-background/60 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_hsl(var(--primary)/0.2)] transition-all"
                />

                {error && (
                  <p className="font-mono text-xs text-destructive uppercase tracking-widest">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !name.trim() || !email.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-black uppercase tracking-[0.2em] py-4 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                    : <><Map className="h-4 w-4" /> Quero o Mapa Grátis <ArrowRight className="h-4 w-4" /></>
                  }
                </button>

                <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                  <Lock className="h-3 w-3" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Sem spam. Seus dados são protegidos pela LGPD.</span>
                </div>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-success/50 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>

              <h2 className="text-2xl font-black uppercase tracking-tight mb-3">
                Mapa enviado para o seu email!
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                Verifique sua caixa de entrada nos próximos minutos.
                Enquanto isso — veja como a NexOS executa o método completo por você.
              </p>

              {refCode && (
                <div className="border border-primary/20 bg-primary/5 px-5 py-4 mb-6 text-left">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">Bônus de indicação</p>
                  <p className="text-sm text-foreground/80">
                    Compartilhe com amigos usando o link que você recebeu — cada amigo que baixar rende créditos do agente para o indicador.
                  </p>
                </div>
              )}

              <a
                href="https://agencianexos.vip"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-black uppercase tracking-[0.15em] px-8 py-4 transition-all text-sm"
              >
                Ver o Sistema Completo <ArrowRight className="h-4 w-4" />
              </a>

              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                agencianexos.vip
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/20 px-4 py-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
          © 2026 NexOS · agencianexos.vip · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
