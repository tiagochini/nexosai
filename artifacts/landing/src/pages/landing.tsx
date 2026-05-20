import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, ArrowDown,
  BrainCircuit, Lock, Shield, Zap, Target, Activity,
  Layers, Clock, TrendingDown, Users, TrendingUp,
  BookOpen, GraduationCap, BarChart3,
  Play, Download, Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { LiveDemoSection, SimulatorSection } from "@/components/landing-demo-sections";
import { useI18n, LANG_LABELS, type Lang } from "@/lib/i18n";

// ─── Scroll-snap section wrapper ──────────────────────────────────────────────
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const Section = React.forwardRef<HTMLElement, { children: React.ReactNode; className?: string; id?: string }>(
  ({ children, className = "", id }, ref) => (
    <section
      ref={ref as React.Ref<HTMLElement>}
      id={id}
      style={{ scrollSnapAlign: "start", minHeight: "100vh" }}
      className={`relative flex flex-col justify-center overflow-hidden ${className}`}
    >
      {children}
    </section>
  )
);

// ─── Language switcher ────────────────────────────────────────────────────────
function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const langs: Lang[] = ["pt-BR", "en-US", "es-LA"];
  return (
    <div className="flex items-center gap-0.5">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={LANG_LABELS[l].label}
          className={`text-base leading-none px-1 py-0.5 rounded-sm transition-all ${
            lang === l
              ? "opacity-100 ring-1 ring-primary/50 bg-primary/10"
              : "opacity-40 hover:opacity-70"
          }`}
        >
          {LANG_LABELS[l].flag}
        </button>
      ))}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ scrolled }: { scrolled: boolean }) {
  const { t } = useI18n();
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border/40 bg-background/90 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 sm:h-14 sm:w-14 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="hidden sm:block">
            <div className="font-mono font-black text-xl tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">{t.nav.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <a href="/landing/simulador" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-primary/80 hover:text-primary border border-primary/20 hover:border-primary/40 h-9 px-4 gap-1.5">
              <Zap className="h-3 w-3" />{t.nav.simulate}
            </Button>
          </a>
          <a href="/landing/simulador" className="sm:hidden">
            <Button variant="ghost" size="sm" className="font-mono border border-primary/20 h-8 w-8 p-0 text-primary/80">
              <Zap className="h-3.5 w-3.5" />
            </Button>
          </a>
          <a href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground hidden sm:flex">{t.nav.login}</Button>
          </a>
          <a href="#oferta">
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] sm:text-xs tracking-widest font-bold h-8 sm:h-9 px-3 sm:px-5">
              <span className="hidden sm:inline">{t.nav.cta}</span>
              <span className="sm:hidden">{t.nav.cta_mobile}</span>
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

function ScrollHint() {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
      <ArrowDown className="h-4 w-4 text-primary/30" />
    </div>
  );
}

// ─── Section 1: HERO ──────────────────────────────────────────────────────────
function HeroSection() {
  const { ref, inView } = useInView(0.1);
  const { t } = useI18n();
  const h = t.hero;
  return (
    <Section id="hero" className="auth-bg-gradient" ref={ref as React.Ref<HTMLElement>}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 w-full pb-28 sm:pb-20">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 sm:px-4 py-2 mb-6 sm:mb-10 font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="hidden sm:inline">{h.badge}</span>
            <span className="sm:hidden">{h.badge_mobile}</span>
          </div>

          <h1 className="text-[2.2rem] sm:text-6xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6 sm:mb-8 max-w-5xl">
            {h.h1_1}<br />{h.h1_2}<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              {h.h1_3}
            </span>
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground leading-relaxed mb-8 sm:mb-12 max-w-2xl">
            {h.p_pre}<strong className="text-foreground">{h.p_bold}</strong>{h.p_post}<br /><br />
            <strong className="text-foreground">{h.p2}</strong>
          </p>

          <div className="flex flex-col gap-4 items-start w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a href="/landing/simulador" className="w-full sm:w-auto">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs sm:text-base h-12 sm:h-16 px-6 sm:px-10 gap-2 sm:gap-3 w-full sm:w-auto">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5" />{h.btn_sim}
                </Button>
              </a>
              <a href="#oferta" className="w-full sm:w-auto">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs sm:text-base h-12 sm:h-16 px-5 sm:px-8 gap-2 border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 w-full sm:w-auto">
                  {h.btn_offer} <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground/40">
              <Lock className="h-3.5 w-3.5" />
              {h.access}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 sm:bottom-10 left-0 right-0 border-t border-border/15 bg-background/60 backdrop-blur-md py-2.5 sm:py-3">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-1">
          {[
            { n: "R$41k",  label: h.s1, hide: false },
            { n: "R$78k",  label: h.s2, hide: false },
            { n: "R$134k", label: h.s3, hide: false },
            { n: "44",     label: h.s4, hide: false },
            { n: "100%",   label: h.s5, hide: true  },
            { n: "24h",    label: h.s6, hide: true  },
          ].map(({ n, label, hide }) => (
            <div key={label} className={`flex flex-col items-center ${hide ? "hidden md:flex" : ""}`}>
              <div className="font-mono font-black text-xs sm:text-base text-primary leading-none">{n}</div>
              <div className="font-mono text-[7px] sm:text-[9px] uppercase tracking-widest text-muted-foreground/50 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 2: A FERIDA ──────────────────────────────────────────────────────
function FeriadaSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const p = t.pain;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 delay-100 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-8">{p.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-8 sm:mb-10">
            {p.h2_1}<br />{p.h2_2}<br />
            <span className="text-destructive/80">{p.h2_3}</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-12">
            {p.p}<strong className="text-foreground">{p.p_bold}</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {p.dores.map((item, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-7 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-3 border-l-2 border-primary/40 pl-3">{item.situacao}</div>
                <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{item.realidade}</p>
              </div>
            ))}
          </div>
          <div className={`mt-6 border border-destructive/20 bg-destructive/5 px-6 py-4 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "640ms" }}>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              {p.closing}<strong className="text-foreground">{p.closing_bold}</strong>{p.closing2}{" "}
              <span className="text-destructive/70 font-bold">{p.closing_red}</span>
            </p>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 3: O CUSTO REAL ──────────────────────────────────────────────────
function CustoRealSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const c = t.cost;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">{c.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-8 sm:mb-10">
            {c.h2_1}<br />{c.h2_2}<br />
            <span className="text-destructive/80">{c.h2_3}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {c.alt.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold">{item.nome}</div>
                    <div className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">{item.nota}</div>
                  </div>
                  <div className="font-mono font-black text-sm text-destructive/60 text-right ml-4 shrink-0">{item.preco}</div>
                </div>
              ))}
              <div
                className={`flex items-center justify-between border border-destructive/40 bg-destructive/5 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                style={{ transitionDelay: "420ms" }}
              >
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-black">{c.total_label}</div>
                <div className="font-mono font-black text-base text-destructive text-right ml-4 shrink-0">{c.total}</div>
              </div>
            </div>

            <div
              className={`border border-primary/30 bg-primary/5 p-8 flex flex-col justify-center transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">{c.box_label}</div>
              <p className="font-mono font-black text-2xl text-foreground leading-snug mb-6">
                {c.box_p}<span className="text-primary">{c.box_p_accent}</span>
              </p>
              <div className="border-l-2 border-primary/50 pl-4 mb-6">
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  {c.box_body_1}<br />{c.box_body_2}<br />
                  <strong className="text-foreground">{c.box_body_3}</strong><br /><br />
                  {c.box_body_4}
                </p>
              </div>
              <a href="#oferta">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 w-full">
                  {c.box_cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 4: A ROTINA ──────────────────────────────────────────────────────
function RotinaSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const r = t.routine;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-8">{r.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-8 sm:mb-10">
            {r.h2_1}<br />{r.h2_2}<br />
            <span className="text-primary">{r.h2_3}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
            {r.items.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-5 h-5 border border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-destructive/60 font-bold">{i + 1}</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-base text-muted-foreground/70 leading-relaxed border-l-2 border-destructive/30 pl-6">
            {r.closing}<strong className="text-foreground">{r.closing_bold}</strong>
          </p>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5: SOLUÇÃO ───────────────────────────────────────────────────────
function SolutionSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const s = t.solution;
  const icons = [BrainCircuit, Target, Users, Activity, TrendingUp, Shield];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20">
      <div className="max-w-5xl mx-auto px-6 w-full text-center">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <img src={nexosLogo} alt="NexOS AI" className="h-24 w-24 object-contain mx-auto mb-8" style={{ filter: "drop-shadow(0 0 28px hsl(var(--primary)/0.8))" }} />
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">{s.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6 sm:mb-8">
            {s.h2_1}<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">{s.h2_2}</span>
          </h2>
          <p className="text-base sm:text-xl text-muted-foreground leading-relaxed mb-10 sm:mb-12 max-w-2xl mx-auto">
            {s.p}<strong className="text-foreground">{s.p_bold}</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {s.features.map(({ label, sub }, i) => {
              const Icon = icons[i]!;
              return (
                <div
                  key={i}
                  className={`border border-primary/20 bg-primary/5 p-5 text-center transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <Icon className="h-6 w-6 text-primary mx-auto mb-3" />
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1">{label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">{sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5b: VIDEO DEMO ───────────────────────────────────────────────────
function VideoSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20" id="video">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-1.5 mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <Play className="h-3 w-3 fill-primary" /> Veja em ação
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-tight mb-3">
              44 agentes.<br /><span className="text-primary">Um lançamento completo.</span>
            </h2>
            <p className="font-mono text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Do briefing à venda — tudo acontece enquanto você dorme. Veja a NexOS AI executando um lançamento de 6 dígitos sem equipe.
            </p>
          </div>

          {/* Video embed */}
          <div
            className={`relative w-full overflow-hidden border border-primary/25 bg-black/80 shadow-[0_0_60px_hsl(var(--primary)/0.15)] transition-all duration-700 delay-200 ${inView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
            style={{ aspectRatio: "16/9" }}
          >
            <iframe
              src="/video-nexos/"
              className="absolute inset-0 w-full h-full"
              style={{ border: "none" }}
              title="NexOS AI — Marketing Video"
              allow="autoplay"
            />
            {/* corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/60 pointer-events-none" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/60 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/60 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/60 pointer-events-none" />
          </div>

          {/* Action row */}
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 transition-all duration-700 delay-300 ${inView ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center gap-4">
              <a
                href="/video-nexos/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors border border-border/30 hover:border-primary/30 px-4 py-2"
              >
                <Maximize2 className="h-3 w-3" /> Tela cheia
              </a>
              <a
                href="/video-nexos/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-primary/70 hover:text-primary transition-colors border border-primary/20 hover:border-primary/50 px-4 py-2"
                title="Clique com botão direito → Salvar como"
              >
                <Download className="h-3 w-3" /> Baixar vídeo
              </a>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-6 gap-2">
                Quero executar assim <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>

        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5c: NEXOS ACADEMY ────────────────────────────────────────────────
function AcademySection() {
  const { ref, inView } = useInView(0.15);
  const { t } = useI18n();
  const a = t.academy;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20" id="academy">
      <div className="max-w-6xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left: heading + stats + methodology box */}
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-5 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-primary/60" />
                {a.label}
              </div>
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
                {a.h2_1}<br />
                <span className="text-primary">{a.h2_2}</span>
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-2">
                {a.p}
              </p>
              <p className="font-mono text-sm text-foreground font-bold leading-relaxed mb-8">
                {a.p_bold}
              </p>

              {/* Stats */}
              <div className="flex gap-0 mb-10">
                {a.stats.map((s, i) => (
                  <div key={i} className="flex-1 border border-border/30 px-4 py-3 bg-card/20 text-center">
                    <div className="font-mono font-black text-2xl text-primary leading-none mb-1">{s.num}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Methodology box example */}
              <div className="border border-[#334155] bg-[#0f172a] p-5 space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" />
                  {a.box_label}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{a.box_p}</p>
                <div className="space-y-1.5 pt-1">
                  {["A) Conceito — a lógica que a IA aplica", "B) Aplicação prática — como você executa ou aprova", "C) Resultado esperado — o que medir para saber que funcionou"].map((item, i) => (
                    <div key={i} className="font-mono text-[10px] text-[#a78bfa] leading-relaxed">{item}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: modules grid */}
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3" />
                6 módulos · {a.stats[0].num} aulas
              </div>
              {a.modules.map((mod, i) => (
                <div
                  key={i}
                  className={`border border-border/30 bg-card/20 px-5 py-4 transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}
                  style={{ transitionDelay: `${200 + i * 80}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono font-black text-2xl text-primary/15 leading-none shrink-0 mt-0.5">{mod.code}</span>
                    <div>
                      <div className="font-mono text-xs font-black uppercase tracking-widest text-foreground mb-1">{mod.nome}</div>
                      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{mod.desc}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className={`mt-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "700ms" }}>
                <a href="#oferta">
                  <Button className="btn-weapon-primary w-full rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 text-xs">
                    {a.cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 5c: MODELOS & TRACKS ─────────────────────────────────────────────
function ModelosSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const m = t.models;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">{m.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-3">
            {m.h2_1}<br />
            <span className="text-primary">{m.h2_2}</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">{m.p}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {m.list.map((item, i) => (
              <div
                key={item.code}
                className={`border border-border/30 bg-card/20 p-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${100 + i * 80}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9px] border border-primary/30 bg-primary/5 text-primary px-1.5 py-0.5 uppercase tracking-widest shrink-0">{item.code}</span>
                  <span className="font-mono text-xs font-black uppercase tracking-wide text-foreground leading-tight">{item.nome}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {m.tracks.map((track, i) => (
              <div
                key={track.label}
                className={`border border-primary/20 bg-primary/5 p-5 text-center transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${580 + i * 80}ms` }}
              >
                <div className="font-mono font-black text-lg text-primary mb-0.5">{track.label}</div>
                <div className="font-mono font-black text-sm text-foreground mb-1">{track.range}</div>
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">{track.sub}</div>
                <div className="font-mono text-[9px] text-primary/60 uppercase tracking-widest mt-0.5">{track.plano}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 6: COMO FUNCIONA ─────────────────────────────────────────────────
function ComoFuncionaSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const h = t.howto;
  const icons = [BrainCircuit, Layers, Zap];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">{h.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-8 sm:mb-12">
            {h.h2_1}<br /><span className="text-primary">{h.h2_2}</span>
          </h2>
          <div className="space-y-5">
            {h.steps.map((step, i) => {
              const Icon = icons[i]!;
              return (
                <div
                  key={i}
                  className={`grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 border border-border/30 bg-card/20 p-7 transition-all duration-600 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  <div className="flex items-start gap-4 md:flex-col md:gap-0 md:w-20">
                    <div className="font-mono font-black text-5xl text-primary/20 leading-none">{step.num}</div>
                    <Icon className="h-6 w-6 text-primary mt-2 hidden md:block" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono font-black uppercase tracking-wide text-base text-foreground">{step.title}</span>
                      <span className="font-mono text-[10px] border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 uppercase tracking-widest">{step.tag}</span>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 7b: PROVA SOCIAL ─────────────────────────────────────────────────
function ProvaSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const pr = t.proof;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background/95 border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">{pr.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            {pr.h2_1}<br /><span className="text-primary">{pr.h2_2}</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-12">{pr.p}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {pr.cases.map((item, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-6 flex flex-col gap-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${150 + i * 130}ms` }}
              >
                <div className="border-l-2 border-primary/60 pl-4">
                  <div className="font-mono font-black text-3xl text-primary leading-none">{item.resultado}</div>
                  <div className="font-mono text-[10px] text-primary/60 uppercase tracking-widest mt-0.5">{item.prazo}</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-black text-foreground uppercase tracking-wide mb-0.5">{item.nome}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">{item.cargo}</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[9px] text-destructive/60 uppercase tracking-widest shrink-0 mt-0.5 font-bold">{pr.before}</span>
                  <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{item.antes}</p>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border/30 pt-3">{item.detalhe}</p>
              </div>
            ))}
          </div>

          <div className={`border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "580ms" }}>
            <div>
              <div className="font-mono text-xs font-black text-foreground uppercase tracking-widest mb-1">{pr.common_label}</div>
              <p className="font-mono text-sm text-muted-foreground">
                {pr.common_p}<strong className="text-foreground">{pr.common_bold}</strong>
              </p>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 whitespace-nowrap text-xs px-6">
                {pr.common_cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 7c: AO VIVO ──────────────────────────────────────────────────────
function AoVivoSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const lv = t.live;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-primary/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary mb-6">{lv.label}</div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05]">
              {lv.h2_1}<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">{lv.h2_2}</span>
            </h2>
            <div className="font-mono text-xs text-muted-foreground/60 max-w-xs leading-relaxed shrink-0">
              {lv.disclaimer.split("\n").map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : null}</span>)}
            </div>
          </div>

          <div className={`flex items-center gap-3 border border-primary/30 bg-primary/5 px-5 py-4 mb-10 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "100ms" }}>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-xs font-black uppercase tracking-widest text-primary">{lv.live_badge}</span>
            </div>
            <div className="w-px h-4 bg-border/40" />
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">{lv.live_desc}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {lv.moments.map((m, i) => (
              <div
                key={i}
                className={`border border-border/30 bg-card/20 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <div className="font-mono font-black text-5xl text-primary/10 leading-none mb-4">{m.icone}</div>
                <div className="font-mono text-xs font-black uppercase tracking-widest text-foreground mb-2">{m.titulo}</div>
                <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className={`border border-primary/40 bg-primary/8 px-7 py-6 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "620ms" }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">{lv.proof_label}</div>
            <p className="font-mono text-base text-foreground leading-relaxed font-bold">{lv.proof_p1}</p>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed mt-2">{lv.proof_p2}</p>
            <a href="#oferta" className="inline-block mt-5">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-bold h-12 gap-2 text-xs px-8">
                {lv.proof_cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 8: O QUE ESTÁ EM JOGO ────────────────────────────────────────────
function EmJogoSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const sk = t.stake;
  const icons = [Clock, TrendingDown, Target, Activity];
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-8">{sk.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-4">
            {sk.h2_1}<br /><span className="text-destructive/80">{sk.h2_2}</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">{sk.p}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {sk.items.map(({ titulo, dado, detalhe }, i) => {
              const Icon = icons[i]!;
              return (
                <div
                  key={i}
                  className={`border border-border/30 bg-card/20 p-6 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Icon className="h-5 w-5 text-destructive/50 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-0.5">{titulo}</div>
                      <div className="font-mono text-xs text-destructive/60 font-bold">{dado}</div>
                    </div>
                  </div>
                  <div className="border-l-2 border-border/40 pl-3 ml-8">
                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{detalhe}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 8b: SHIFTING DECISIONS — escolha seu caminho ─────────────────────
function AcademyBridgeSection() {
  const { ref, inView } = useInView(0.15);
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground/40 mb-4">
              — Dois caminhos. Destino idêntico. —
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-tight">
              Qual é o seu<br /><span className="text-primary">ponto de entrada?</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border/30">
            {/* Caminho A — Plataforma */}
            <div className={`border-r border-border/30 bg-primary/5 p-8 flex flex-col gap-6 transition-all duration-600 delay-100 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"}`}>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/60 mb-3">→ Caminho A</div>
                <div className="font-mono font-black text-2xl uppercase tracking-tight text-foreground leading-tight mb-3">
                  A IA executa<br /><span className="text-primary">o lançamento por você</span>
                </div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Você tem um produto. Quer velocidade, automação e resultado em 7 dias. A NexOS AI faz o trabalho pesado — 44 agentes, do briefing à venda.
                </p>
              </div>
              <div className="space-y-2.5">
                {[
                  "Produto validado ou em fase de lançamento",
                  "Quer escalar sem contratar equipe",
                  "Precisa de automação e execução imediata",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                    <span className="text-primary shrink-0 mt-0.5">✓</span> {item}
                  </div>
                ))}
              </div>
              <a href="#oferta" className="mt-auto">
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-12 gap-2 w-full">
                  Quero a plataforma <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>

            {/* Caminho B — Academia */}
            <div className={`bg-card/10 p-8 flex flex-col gap-6 transition-all duration-600 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-400/50 mb-3">→ Caminho B</div>
                <div className="font-mono font-black text-2xl uppercase tracking-tight text-foreground leading-tight mb-3">
                  Primeiro o método.<br /><span className="text-amber-400/80">Depois a execução.</span>
                </div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Ainda construindo sua base? A NexOS Academy tem o framework completo — estratégia, posicionamento e o mapa que a plataforma vai executar.
                </p>
              </div>
              <div className="space-y-2.5">
                {[
                  "Está estruturando produto ou oferta",
                  "Quer entender a estratégia antes de automatizar",
                  "Prefere dominar o método com profundidade",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                    <span className="text-amber-400/60 shrink-0 mt-0.5">✓</span> {item}
                  </div>
                ))}
              </div>
              <a href="/nexos-academy/" className="mt-auto">
                <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-12 gap-2 w-full border-amber-400/25 text-amber-400/70 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/5">
                  <GraduationCap className="h-4 w-4" /> Quero a Academia primeiro
                </Button>
              </a>
            </div>
          </div>

          <p className="font-mono text-[11px] text-muted-foreground/30 text-center uppercase tracking-widest mt-6">
            Os dois se complementam. Muitos começam pela Academia e ativam a plataforma em seguida.
          </p>

        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 9: A JANELA ──────────────────────────────────────────────────────
function JanelaSection() {
  const { ref, inView } = useInView(0.2);
  const { t } = useI18n();
  const w = t.window;
  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="bg-background border-t border-border/20">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">{w.label}</div>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
            {w.h2_1}<br />{w.h2_2}<br />
            <span className="text-primary">{w.h2_3}</span>
          </h2>
          <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mb-8">
            {w.p}<strong className="text-foreground">{w.p_bold}</strong>
          </p>

          <div className={`flex items-center gap-3 mb-10 transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "100ms" }}>
            <div className="flex -space-x-2">
              {["#7c3aed","#6d28d9","#5b21b6","#4c1d95","#3b0764"].map((bg, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <span className="font-mono text-[8px] text-white font-bold">{String.fromCharCode(65+i)}</span>
                </div>
              ))}
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              <strong className="text-foreground">+{Math.floor(Date.now() / 10000) % 200 + 847}</strong>{w.community}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {w.slots.map((item, i) => (
              <div
                key={i}
                className={`border ${item.destaque ? "border-primary/40 bg-primary/8" : "border-border/30 bg-card/20"} p-7 flex flex-col gap-4 transition-all duration-600 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${200 + i * 150}ms` }}
              >
                <div className="font-mono font-black text-5xl text-foreground/10 leading-none">{item.num}</div>
                <div>
                  <div className={`font-mono font-black text-sm uppercase tracking-widest mb-2 ${item.cor}`}>{item.titulo}</div>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {item.destaque && (
                  <div className="mt-auto border border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{w.only_list}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border border-primary/20 bg-primary/5 px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-bold mb-1">{w.box_label}</div>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">{w.box_p}</p>
            </div>
            <a href="#oferta" className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 px-10 gap-3 whitespace-nowrap">
                {w.box_cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
      <ScrollHint />
    </Section>
  );
}

// ─── Section 10: OFERTA FINAL ─────────────────────────────────────────────────
function OfferSection() {
  const { ref, inView } = useInView(0.15);
  const { t } = useI18n();
  const o = t.offer;
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const formatWA = (v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), segment: "individual", source: "landing" }),
      });
      const json = await res.json();
      if (res.ok || json.joined) {
        localStorage.setItem("nexos_joined", "true");
        setJoined(true);
        setTimeout(() => { window.location.href = "/preparacao?segment=individual"; }, 1500);
      } else {
        toast.error("Erro ao entrar na lista.");
      }
    } catch { toast.error(o.error_conn); }
    finally { setLoading(false); }
  };

  return (
    <Section ref={ref as React.Ref<HTMLElement>} className="auth-bg-gradient border-t border-primary/20" id="oferta">
      <div className="max-w-5xl mx-auto px-6 w-full py-20">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

          <div className="text-center mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">{o.label}</div>
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
              {o.h2_1}<br />{o.h2_2}<br />
              <span className="text-primary">{o.h2_3}</span>
            </h2>
            <p className="font-mono text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {o.p}<strong className="text-foreground">{o.p_bold}</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="border border-primary/20 bg-primary/5 p-7">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">{o.includes_label}</div>
              <ul className="space-y-2.5 mb-8">
                {o.includes.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-primary/20 pt-5 space-y-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{o.cost_label}</div>
                  <div className="font-mono font-black text-2xl text-destructive/60 line-through">{o.cost_value}</div>
                </div>
                <div className="border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{o.price_label}</div>
                  <div className="font-mono font-black text-xl text-foreground">{o.price_value}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1">{o.price_note}</div>
                </div>
              </div>
            </div>

            <div className="border border-border/30 bg-card/20 p-7 flex flex-col">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-1">{o.form_label}</div>
              <h3 className="font-mono font-black uppercase text-xl tracking-tight text-foreground mb-2">{o.form_h3}</h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">{o.form_p}</p>

              {joined ? (
                <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-5 mt-auto">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">{o.confirmed_title}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{o.confirmed_desc}</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-3 flex-1 flex flex-col">
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{o.field_name}</Label>
                    <Input required value={name} onChange={e => setName(e.target.value)} placeholder={o.field_name_ph}
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-sans" />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{o.field_wa}</Label>
                    <Input required value={whatsapp} onChange={e => setWhatsapp(formatWA(e.target.value))} placeholder={o.field_wa_ph}
                      className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary h-11 font-mono" />
                  </div>
                  <div className="mt-auto pt-2">
                    <Button type="submit" disabled={loading}
                      className="w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-sm h-14 gap-2">
                      {loading ? o.btn_loading : <><ArrowRight className="h-4 w-4" /> {o.btn_submit}</>}
                    </Button>
                    <div className="flex items-center justify-center gap-2 mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                      <Shield className="h-3 w-3" />{o.no_spam}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="mt-8 border border-primary/15 bg-primary/5 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="font-mono text-xs text-foreground/80">
                <strong>{o.bottom_text}</strong> {o.bottom_sub}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-destructive/50 shrink-0">{o.bottom_warn}</span>
          </div>

        </div>
      </div>
    </Section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 40);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: "100vh", overflowY: "scroll", scrollSnapType: "y mandatory", scrollBehavior: "smooth" }}
      className="bg-background text-foreground"
    >
      <Nav scrolled={scrolled} />
      <HeroSection />
      <FeriadaSection />
      <CustoRealSection />
      <RotinaSection />
      <SolutionSection />
      <VideoSection />
      <AcademySection />
      <ModelosSection />
      <ComoFuncionaSection />
      <LiveDemoSection />
      <SimulatorSection />
      <ProvaSection />
      <AoVivoSection />
      <EmJogoSection />
      <AcademyBridgeSection />
      <JanelaSection />
      <OfferSection />
    </div>
  );
}
