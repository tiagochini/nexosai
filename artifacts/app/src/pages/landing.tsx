import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  Zap, ArrowRight, CheckCircle2, BarChart3, Mail,
  MessageSquare, BrainCircuit, Shield, TrendingUp,
  Clock, Lock, Users, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Estratégia gerada por IA",
    desc: "Claude analisa seu produto e define trilha, cronograma de 7 dias, gatilhos mentais por fase e sequência completa.",
    accent: "primary",
  },
  {
    icon: Mail,
    title: "Copy por segmento",
    desc: "Emails e WhatsApp escritos pela IA para cada fase. Hot, warm e cold recebem abordagens completamente diferentes.",
    accent: "primary",
  },
  {
    icon: Zap,
    title: "Disparo 100% automático",
    desc: "A sequência executa sozinha, no horário certo, para o segmento certo. Você não toca em nada.",
    accent: "success",
  },
  {
    icon: BarChart3,
    title: "Métricas em tempo real",
    desc: "Score de saúde, segmentação por temperatura e taxa de abertura por disparo — tudo ao vivo no painel.",
    accent: "success",
  },
  {
    icon: TrendingUp,
    title: "IA auto-otimiza",
    desc: "Quando o engajamento cai, a IA detecta e reescreve a abordagem antes que seu lançamento desacelere.",
    accent: "primary",
  },
  {
    icon: Shield,
    title: "Email + WhatsApp integrado",
    desc: "RD Station, ActiveCampaign e Meta Business API. Tudo disparado e rastreado dentro da mesma plataforma.",
    accent: "primary",
  },
];

const BEFORE_AFTER = [
  { before: "Copywriter (R$3k–8k)", after: "Copy gerado por IA em segundos" },
  { before: "Gestor de tráfego + social media", after: "Automação de sequência completa" },
  { before: "Agência de email (R$1.5k/mês)", after: "Disparos automáticos integrados" },
  { before: "CRM + segmentação manual", after: "Segmentação hot/warm/cold automática" },
  { before: "60–90 dias de preparação", after: "Ao vivo em 7 dias" },
  { before: "5+ ferramentas diferentes", after: "Tudo em uma única plataforma" },
];

function WaitlistForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  const formatWhatsApp = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), source: "landing" }),
      });
      const data = await res.json();
      if (res.ok || data.joined) {
        onSuccess();
      } else {
        toast.error("Erro ao entrar na lista. Tente novamente.");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="wl-name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Seu nome</Label>
        <Input
          id="wl-name"
          required
          placeholder="Como você se chama?"
          value={name}
          onChange={e => setName(e.target.value)}
          className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-sans h-12"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wl-wa" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
        <Input
          id="wl-wa"
          required
          placeholder="(11) 99999-9999"
          value={whatsapp}
          onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
          className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-mono h-12"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-14 rounded-none font-mono uppercase tracking-widest font-black btn-weapon-primary text-sm gap-3 mt-2"
      >
        {loading ? "Entrando na lista..." : (
          <>Quero Ser Avisado Primeiro <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>
      <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground opacity-60">
        Sem spam · Só o link do grupo quando abrir
      </p>
    </form>
  );
}

function CountdownTimer() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    // Target: next Saturday at 20:00 BRT (for demo)
    const target = new Date();
    target.setDate(target.getDate() + ((6 - target.getDay() + 7) % 7 || 7));
    target.setHours(20, 0, 0, 0);

    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { v: time.days, l: "Dias" },
        { v: time.hours, l: "Horas" },
        { v: time.minutes, l: "Min" },
        { v: time.seconds, l: "Seg" },
      ].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center border border-primary/30 bg-primary/5 p-3">
          <span className="font-mono font-black text-3xl text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
            {String(v).padStart(2, "0")}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist/count")
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS AI" className="h-8 w-8 object-contain" style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.6))" }} />
            <span className="font-mono font-bold text-sm tracking-widest uppercase text-foreground">NexOS <span className="text-primary">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
                Já tenho acesso
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-20">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              Automated Launch · Em Breve
            </div>

            <h1 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Seu produto digital<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">no ar em 7 dias.</span><br />
              <span className="text-foreground/50 text-3xl md:text-4xl mt-2 block">Sem equipe. Sem agência.<br />100% automatizado.</span>
            </h1>

            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
              NexOS AI gera sua estratégia, escreve todo o copy, dispara email e WhatsApp no momento certo e monitora seu lançamento — <strong className="text-foreground">do briefing ao ao vivo, completamente no piloto automático.</strong>
            </p>

            <div className="space-y-3 mb-8">
              {[
                "Carrinho aberto por apenas 24 horas",
                "Vagas limitadas no lançamento fundador",
                "Grupo exclusivo de esquenta no WhatsApp",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {count !== null && (
              <div className="inline-flex items-center gap-2 border border-border/40 bg-card/30 px-4 py-2 font-mono text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span><strong className="text-foreground">{count + 47}</strong> pessoas já na lista de espera</span>
              </div>
            )}
          </div>

          {/* Right — form / success */}
          <div className="relative">
            <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden group hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_hsl(var(--primary)/0.1)]">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>

              {joined ? (
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-success drop-shadow-[0_0_10px_hsl(var(--success)/0.7)]" />
                  </div>
                  <div>
                    <h3 className="font-mono font-black uppercase tracking-wider text-xl text-foreground mb-2">Você está dentro.</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Quando o carrinho abrir — por <strong className="text-foreground">24h exatas</strong> — você será o primeiro a saber pelo WhatsApp.
                    </p>
                  </div>
                  <div className="border border-success/20 bg-success/5 p-4 text-left space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-success font-bold">Próximos passos</p>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                      Você receberá no WhatsApp o link do grupo exclusivo de esquenta. Lá você terá acesso antecipado a demos, bastidores e à oferta fundadora antes de qualquer pessoa.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      <h3 className="font-mono font-bold uppercase tracking-widest text-sm text-foreground">Lista de Espera</h3>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Acesso antecipado · Oferta fundadora</p>
                  </div>
                  <WaitlistForm onSuccess={() => setJoined(true)} />
                </>
              )}
            </div>

            {/* Scarcity note below card */}
            <div className="mt-4 flex items-center gap-2 justify-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              Carrinho abre uma única vez · Fecha em 24h · Sem exceções
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* COUNTDOWN STRIP */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm py-10">
        <div className="max-w-xl mx-auto px-6 text-center space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Abertura do carrinho em</p>
          <CountdownTimer />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Quem não estiver na lista não recebe o link · Sem segunda chance
          </p>
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O Problema</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            Lançar é caro, lento<br />e depende de gente demais.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/30">
          <div className="bg-background border-r border-border/40">
            <div className="p-5 border-b border-border/40 bg-destructive/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-destructive font-bold">Antes do NexOS</h3>
            </div>
            {BEFORE_AFTER.map((item, i) => (
              <div key={i} className="p-5 border-b border-border/20 last:border-0 flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 mt-2 shrink-0"></div>
                <span className="font-mono text-sm text-muted-foreground line-through decoration-destructive/40">{item.before}</span>
              </div>
            ))}
          </div>
          <div className="bg-background">
            <div className="p-5 border-b border-border/40 bg-success/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-success font-bold">Com NexOS AI</h3>
            </div>
            {BEFORE_AFTER.map((item, i) => (
              <div key={i} className="p-5 border-b border-border/20 last:border-0 flex items-start gap-4">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5 drop-shadow-[0_0_5px_hsl(var(--success)/0.5)]" />
                <span className="font-mono text-sm text-foreground">{item.after}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 border-t border-border/30 bg-card/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O que você vai ter</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
              Cada peça do lançamento.<br />Automatizada.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/30">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-background p-8 group relative overflow-hidden card-weapon">
                <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-${f.accent === 'success' ? 'success' : 'primary'} to-transparent opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                <f.icon className={`h-6 w-6 mb-5 ${f.accent === 'success' ? 'text-success drop-shadow-[0_0_8px_hsl(var(--success)/0.5)]' : 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]'}`} />
                <h3 className="font-mono font-bold uppercase tracking-wider text-sm text-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT FLOWS */}
      <section className="py-24 max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O Processo</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            De zero a lançamento<br />em 4 etapas.
          </h2>
        </div>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block"></div>
          <div className="space-y-0">
            {[
              { n: "01", icon: Clock, title: "Briefing em 10 minutos", desc: "Responda perguntas sobre seu produto, nicho, avatar e meta. A IA já começa a montar sua estratégia enquanto você responde." },
              { n: "02", icon: BrainCircuit, title: "Estratégia gerada por IA", desc: "Claude define trilha, cronograma, gatilhos mentais por fase, segmentação de lista e sequência completa de disparos." },
              { n: "03", icon: MessageSquare, title: "Copy criado e aprovado", desc: "GPT-4o escreve cada email e mensagem de WhatsApp. Você revisa e aprova dentro da plataforma, em segundos." },
              { n: "04", icon: Zap, title: "Lançamento no piloto automático", desc: "Ative a sequência. O NexOS dispara tudo no horário certo, segmenta leads por temperatura e otimiza em tempo real." },
            ].map((step, i) => (
              <div key={i} className="flex gap-8 py-10 border-b border-border/30 last:border-0 group">
                <div className="flex-shrink-0 w-16 h-16 border border-primary/30 bg-primary/5 flex items-center justify-center font-mono font-black text-2xl text-primary group-hover:border-primary/70 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all relative z-10">
                  {step.n}
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-2">
                    <step.icon className="h-4 w-4 text-primary" />
                    <h3 className="font-mono font-bold uppercase tracking-wider text-sm text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 relative overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            Vagas limitadas · Carrinho abre uma única vez
          </div>

          <h2 className="text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
            Não perca a abertura.<br />
            <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">Ela fecha em 24h.</span>
          </h2>

          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Entre na lista agora e garanta o link do grupo de esquenta. Quem não estiver na lista não recebe o link quando o carrinho abrir.
          </p>

          {!joined ? (
            <div className="max-w-md mx-auto">
              <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                <WaitlistForm onSuccess={() => setJoined(true)} />
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto border border-success/20 bg-success/5 p-6 flex flex-col items-center gap-4">
              <CheckCircle2 className="h-10 w-10 text-success drop-shadow-[0_0_10px_hsl(var(--success)/0.7)]" />
              <p className="font-mono text-sm text-foreground font-bold">Você já está na lista. Aguarde o link no WhatsApp.</p>
            </div>
          )}

          <p className="mt-8 text-xs text-muted-foreground font-mono uppercase tracking-widest opacity-40">
            NexOS AI · Lançamento Digital Automatizado
          </p>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

    </div>
  );
}
