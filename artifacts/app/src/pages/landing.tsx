import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";
import {
  Zap, ArrowRight, CheckCircle2, BarChart3, Mail,
  MessageSquare, Target, BrainCircuit, Rocket, Shield,
  TrendingUp, Users, Clock, DollarSign
} from "lucide-react";

const STATS = [
  { value: "7", unit: "dias", label: "Do briefing ao lançamento ao vivo" },
  { value: "R$100k+", unit: "", label: "Potencial em 6 dígitos no 1º lançamento" },
  { value: "3", unit: "IAs", label: "Estratégia, copy e otimização em paralelo" },
  { value: "0", unit: "equipe", label: "Sem freelancer, sem agência, sem reunião" },
];

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Intake Inteligente",
    desc: "Responda um briefing de 10 minutos. A IA analisa seu produto, seu público e define a estratégia completa de lançamento — trilha, fase, cronograma e gatilhos mentais.",
    accent: "primary",
  },
  {
    icon: Mail,
    title: "Copy Gerado por IA",
    desc: "Emails e mensagens de WhatsApp escritos pela IA para cada fase do lançamento. Cada segmento recebe uma abordagem diferente: hot, warm e cold.",
    accent: "primary",
  },
  {
    icon: Zap,
    title: "Disparo 100% Automático",
    desc: "A sequência executa sozinha no horário certo, para o segmento certo. Você não toca em nada — o NexOS cuida de cada disparo.",
    accent: "success",
  },
  {
    icon: BarChart3,
    title: "Painel de Métricas em Tempo Real",
    desc: "Score de saúde de 0 a 100, segmentação automática de leads por temperatura, taxa de abertura e clique por disparo. Tudo atualizado em tempo real.",
    accent: "success",
  },
  {
    icon: TrendingUp,
    title: "IA Auto-Otimiza",
    desc: "Quando o engajamento cai, a IA detecta a anomalia, gera sugestões adaptativas e reescreve a abordagem antes que seu lançamento desacelere.",
    accent: "primary",
  },
  {
    icon: Shield,
    title: "Múltiplos Canais Integrados",
    desc: "Email via RD Station ou ActiveCampaign. WhatsApp via Meta Business API. Tudo disparado e rastreado dentro da mesma plataforma.",
    accent: "primary",
  },
];

const BEFORE_AFTER = [
  { before: "Contrata copywriter (R$3k–8k)", after: "Copy gerado por IA em segundos" },
  { before: "Gestor de tráfego + social media", after: "Automação de sequência completa" },
  { before: "Agência de email (R$1.5k/mês)", after: "Disparos automáticos integrados" },
  { before: "Plataforma de CRM + segmentação", after: "Segmentação hot/warm/cold automática" },
  { before: "Horas de planilha e reunião", after: "Dashboard com tudo em um lugar" },
  { before: "Lançamento em 60–90 dias", after: "Ao vivo em 7 dias" },
];

const PLANS = [
  {
    name: "Solo",
    price: "R$297",
    period: "/mês",
    onboarding: "+ R$2.500 onboarding",
    track: "Trilha 6 dígitos",
    trackDesc: "R$100k a R$999k em 7 dias",
    features: [
      "3 campanhas simultâneas",
      "1.500 créditos de IA/mês",
      "Email + WhatsApp automático",
      "Copy gerado por IA",
      "Painel de métricas em tempo real",
      "Sequência de lançamento automatizada",
    ],
    primary: false,
  },
  {
    name: "Agency",
    price: "R$1.497",
    period: "/mês",
    onboarding: "+ R$2.500 onboarding",
    track: "Trilhas 6, 8 e 10 dígitos",
    trackDesc: "R$100k a R$100M+ em 7 dias",
    features: [
      "10 campanhas simultâneas",
      "5.000 créditos de IA/mês",
      "Todas as trilhas de lançamento",
      "White-label completo",
      "Gestão de múltiplos clientes",
      "Prioridade nas novas features",
    ],
    primary: true,
  },
];

export default function Landing() {
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
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="font-mono uppercase text-xs tracking-widest btn-weapon-primary rounded-none px-5">
                Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
            Automated Launch · IA Operacional
          </div>

          <h1 className="text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-none mb-6 text-foreground">
            Seu Produto Digital<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">No Ar em 7 Dias.</span><br />
            <span className="text-foreground/60 text-4xl md:text-5xl">Sem Equipe. Sem Agência.</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground font-sans max-w-2xl mx-auto leading-relaxed mb-10">
            NexOS AI gera sua estratégia, escreve todo o copy, dispara email e WhatsApp no momento certo
            e monitora seu lançamento em tempo real — <strong className="text-foreground">do briefing ao ao vivo, completamente automatizado.</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="font-mono uppercase tracking-widest font-black btn-weapon-primary rounded-none gap-3 px-10 text-sm h-14">
                Automatizar Meu Lançamento
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-3 px-10 text-sm h-14 btn-weapon-outline border-border/50">
                Já tenho conta
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground font-mono uppercase tracking-widest opacity-60">
            Onboarding assistido por IA · Sem fidelidade mínima
          </p>
        </div>

        {/* bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-border/30">
          {STATS.map((s, i) => (
            <div key={i} className="px-8 py-4 flex flex-col items-center text-center group">
              <div className="font-mono font-black text-4xl md:text-5xl text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.4)] group-hover:drop-shadow-[0_0_25px_hsl(var(--primary)/0.7)] transition-all">
                {s.value}<span className="text-2xl text-muted-foreground ml-1">{s.unit}</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-2 max-w-[140px] leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O Problema</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground">
            Lançar é caro, lento e<br />depende de gente demais.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            Você gasta meses coordenando freelancers, pagando ferramentas separadas e ainda depende de que tudo funcione junto na semana do lançamento. Quase nunca funciona.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border/40 overflow-hidden">
          <div className="border-r border-border/40 bg-destructive/5">
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
          <div className="bg-success/5">
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
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">Como Funciona</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground">
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
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">O Processo</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground">
            De zero a lançamento em 4 etapas.
          </h2>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block"></div>
          <div className="space-y-0">
            {[
              { n: "01", icon: Clock, title: "Briefing em 10 minutos", desc: "Responda perguntas sobre seu produto, nicho, avatar e meta de receita. A IA já começa a montar sua estratégia enquanto você responde." },
              { n: "02", icon: BrainCircuit, title: "Estratégia gerada por IA", desc: "Claude analisa seu briefing e gera trilha, cronograma de 7 dias, gatilhos mentais por fase, segmentação de lista e sequência completa de disparos." },
              { n: "03", icon: MessageSquare, title: "Copy criado e aprovado", desc: "GPT-4o escreve cada email e mensagem de WhatsApp. Você revisa, aprova ou solicita ajuste. Tudo dentro da plataforma, em segundos." },
              { n: "04", icon: Rocket, title: "Lançamento no piloto automático", desc: "Ative a sequência. O NexOS dispara tudo no horário certo, segmenta leads por temperatura e otimiza em tempo real. Você só acompanha o painel." },
            ].map((step, i) => (
              <div key={i} className="flex gap-8 py-10 border-b border-border/30 last:border-0 group">
                <div className="flex-shrink-0 w-16 h-16 border border-primary/30 bg-primary/5 flex items-center justify-center font-mono font-black text-2xl text-primary group-hover:border-primary/70 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all md:ml-0 ml-0 relative z-10">
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

      {/* PLANS */}
      <section className="py-24 border-t border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">Planos</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground">
              Quanto você quer faturar?
            </h2>
            <p className="text-muted-foreground mt-4 text-sm">Escolha sua trilha. A plataforma se adapta à sua meta.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/40">
            {PLANS.map((plan, i) => (
              <div key={i} className={`relative p-10 bg-background overflow-hidden group card-weapon ${plan.primary ? 'border-primary/40' : ''}`}>
                {plan.primary && (
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                )}
                {plan.primary && (
                  <div className="absolute top-4 right-4 font-mono text-[9px] uppercase tracking-widest bg-primary/10 border border-primary/30 text-primary px-3 py-1">
                    Recomendado
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-mono font-black uppercase tracking-widest text-lg text-foreground mb-1">{plan.name}</h3>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{plan.track}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{plan.trackDesc}</div>
                </div>
                <div className="mb-8">
                  <span className="font-mono font-black text-5xl text-foreground">{plan.price}</span>
                  <span className="font-mono text-muted-foreground text-sm">{plan.period}</span>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">{plan.onboarding}</div>
                </div>
                <ul className="space-y-3 mb-10">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 font-mono text-xs text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className={`w-full rounded-none font-mono uppercase tracking-widest font-bold h-12 ${plan.primary ? 'btn-weapon-primary' : 'btn-weapon-outline border-border/50'}`}>
                    Começar Agora
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 relative overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-6">
            Você já perdeu tempo suficiente.
          </p>
          <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6 text-foreground">
            Chega de montar planilha,<br />
            gerenciar freelancer<br />
            <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">e esperar agência.</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Seu próximo lançamento pode rodar sozinho, com copy profissional, segmentação inteligente e métricas em tempo real — por menos do que você paga em um freelancer por mês.
          </p>
          <Link href="/register">
            <Button size="lg" className="font-mono uppercase tracking-widest font-black btn-weapon-primary rounded-none gap-3 px-12 text-sm h-16">
              Automatizar Meu Lançamento Agora
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-6 text-xs text-muted-foreground font-mono uppercase tracking-widest opacity-40">
            NexOS AI · Lançamento Digital Automatizado
          </p>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

    </div>
  );
}
