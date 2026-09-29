import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { LANG_LABELS, useI18n, type Lang } from "@/lib/i18n";
import { homeText, type HomeTextKey } from "@/lib/home-copy";
import {
  ArrowRight, Users, Video, Workflow,
  Activity, Target, Layers, Lock, ShieldCheck, Search, Megaphone, ChevronDown, CheckCircle2
} from "lucide-react";

export default function LandingPage() {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    let target: HTMLElement | null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return;
    }
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleCapacityReached = useCallback(() => {
    setClosed(true);
  }, []);

  const openCapture = () => {
    if (closed) {
      window.open("https://wa.me/message/NBJH4EXPAV2EN1", "_blank", "noopener,noreferrer");
      return;
    }
    setCaptureOpen(true);
  };

  const closeCapture = () => setCaptureOpen(false);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground scroll-smooth bg-grid-pattern relative">
      <div className="noise-overlay" />
      <Nav openCapture={openCapture} closed={closed} />

      <main className="flex-1 border-x-2 border-border max-w-[1400px] w-full mx-auto bg-background">
        <HeroSection openCapture={openCapture} closed={closed} />
        <ExecutionGapSection openCapture={openCapture} closed={closed} />
        <RealWorkSection />
        <ArchitectureSection />
        <GLP22Section />
        <OperationalScopeSection />
        <ProofOfLogicSection />
        <ScarcitySection openCapture={openCapture} closed={closed} />
      </main>

      <Footer />
      <LeadCaptureModal
        open={isCaptureOpen}
        onClose={closeCapture}
        closed={closed}
        onCapacityReached={handleCapacityReached}
      />
    </div>
  );
}

function Nav({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  const { lang, setLang } = useI18n();
  const navCopy = {
    "pt-BR": { tagline: "Agência Autônoma", login: "Entrar", open: "Reservar vaga", closed: "Vagas esgotadas", language: "Idioma", switchTo: "Mudar idioma para" },
    "en-US": { tagline: "Autonomous Agency", login: "Log in", open: "Reserve a spot", closed: "Spots sold out", language: "Language", switchTo: "Switch language to" },
    "es-LA": { tagline: "Agencia autónoma", login: "Iniciar sesión", open: "Reservar lugar", closed: "Cupos agotados", language: "Idioma", switchTo: "Cambiar idioma a" },
  }[lang];
  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between border-x-2 border-border bg-background">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <img src={`${import.meta.env.BASE_URL}nexos_ai_logo_1024x1024.png`} alt="NexOS" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
          <div className="hidden sm:block">
            <div className="font-display font-black text-2xl tracking-tighter uppercase leading-none">NEXOS</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{navCopy.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <a href="/login" aria-label={navCopy.login} data-testid="nav-login-link" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hidden sm:block transition-colors font-bold">
            [ {navCopy.login} ]
          </a>
          <div className="flex items-center gap-0.5 sm:gap-1 border border-border/60 p-0.5 sm:p-1 shrink-0" role="group" aria-label={navCopy.language}>
            {(Object.keys(LANG_LABELS) as Lang[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setLang(option)}
                aria-label={`${navCopy.switchTo} ${LANG_LABELS[option].label}`}
                aria-pressed={lang === option}
                className={`px-1.5 sm:px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  lang === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "pt-BR" ? "PT" : option === "en-US" ? "EN" : "ES"}
              </button>
            ))}
          </div>
          <Button
            onClick={openCapture}
            data-testid="nav-guide-button"
            className="font-mono text-[10px] sm:text-xs uppercase tracking-widest font-bold h-9 sm:h-12 px-2 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-none shrink-0"
          >
            {closed ? navCopy.closed : navCopy.open}
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  const { lang } = useI18n();
  const copy = {
    "pt-BR": {
      badge: "DA IDEIA À OPERAÇÃO NO AR", h1a: "Pare de contratar partes", h1b: "para executar uma", h1c: "estratégia inteira.",
      body: "Sua ideia sai do papel, vira um plano de ação orientado por inteligência de mercado e acompanhamento contínuo da concorrência — e começa a ganhar presença digital real em poucas horas. A NexOS assume a execução cara, técnica e fragmentada para colocar sua operação em movimento, de ponta a ponta.",
      line: "Da ideia ao plano. Do plano aos ativos. Dos ativos à operação no ar.", primary: "Tirar minha ideia do papel", secondary: "Ver trabalho concreto", closed: "Turma inicial encerrada", access: "REGRAS DE ACESSO: APENAS 100 VAGAS DISPONÍVEIS NO PRÉ-LANÇAMENTO."
    },
    "en-US": {
      badge: "FROM IDEA TO LIVE OPERATION", h1a: "Stop outsourcing in pieces", h1b: "to execute one", h1c: "complete strategy.", body: "Your idea leaves the page and becomes an action plan guided by market intelligence and continuous competitor monitoring — building a real digital presence within hours. NexOS takes on the expensive, technical, fragmented execution to move your operation forward end to end.",
      line: "From idea to plan. From plan to assets. From assets to a live operation.", primary: "Put my idea into motion", secondary: "See the real work", closed: "Initial cohort closed", access: "ACCESS RULES: ONLY 100 SPOTS AVAILABLE AT PRE-LAUNCH."
    },
    "es-LA": {
      badge: "DE LA IDEA A LA OPERACIÓN EN MARCHA", h1a: "Deja de contratar por separado", h1b: "para ejecutar una", h1c: "estrategia completa.", body: "Tu idea sale del papel y se convierte en un plan de acción guiado por inteligencia de mercado y seguimiento continuo de la competencia — creando una presencia digital real en pocas horas. NexOS asume la ejecución costosa, técnica y fragmentada para poner tu operación en marcha de principio a fin.",
      line: "De la idea al plan. Del plan a los activos. De los activos a la operación en marcha.", primary: "Poner mi idea en marcha", secondary: "Ver el trabajo real", closed: "Cohorte inicial cerrada", access: "REGLAS DE ACCESO: SOLO 100 CUPOS DISPONIBLES EN EL PRELANZAMIENTO."
    },
  }[lang];
  const scrollToWork = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    document.getElementById('trabalho-concreto')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90dvh] flex flex-col justify-center border-b-2 border-border overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary)_0%,transparent_15%)] opacity-20 pointer-events-none" />

      <div className="px-6 py-20 relative z-10 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 border-2 border-primary bg-primary/5 mb-10">
            <span className="w-2 h-2 bg-primary animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary font-bold">
              {copy.badge}
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-[7rem] font-display font-black leading-[0.95] tracking-tighter mb-8 uppercase text-foreground">
            {copy.h1a} <br/>
            <span className="text-primary">{copy.h1b}<br/>{copy.h1c}</span>
          </h1>

          <p className="text-lg sm:text-2xl text-muted-foreground max-w-3xl leading-relaxed mb-12 font-sans font-medium">
            {copy.body}
          </p>

          <p className="font-mono text-xs sm:text-sm uppercase tracking-widest text-foreground/70 max-w-3xl mb-10 border-l-2 border-primary pl-4">
            {copy.line}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={openCapture} data-testid="hero-cta-button" className="h-16 px-10 text-base font-display font-bold rounded-none bg-foreground text-background hover:bg-muted-foreground transition-colors uppercase tracking-wide">
              {closed ? copy.closed : copy.primary} <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={scrollToWork} className="h-16 px-10 text-base font-display font-bold rounded-none border-2 border-border bg-transparent hover:bg-card transition-colors text-foreground uppercase tracking-wide">
              {copy.secondary}
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold border-l-2 border-primary pl-4 py-1">
              {closed
                ? copy.closed
                : copy.access}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const executionPains = [
  { markerKey: "gap.pain.course.marker", titleKey: "gap.pain.course.title", bodyKey: "gap.pain.course.body" },
  { markerKey: "gap.pain.traffic.marker", titleKey: "gap.pain.traffic.title", bodyKey: "gap.pain.traffic.body" },
  { markerKey: "gap.pain.agency.marker", titleKey: "gap.pain.agency.title", bodyKey: "gap.pain.agency.body" },
  { markerKey: "gap.pain.online.marker", titleKey: "gap.pain.online.title", bodyKey: "gap.pain.online.body" },
] as const;

function ExecutionGapSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  const { lang } = useI18n();
  return (
    <section className="border-b-2 border-border bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="px-6 py-24 sm:py-32 lg:border-r-2 border-border bg-primary text-primary-foreground flex flex-col justify-between gap-16">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] font-bold mb-8">{homeText(lang, "gap.heading")}</div>
            <h2 className="text-5xl sm:text-7xl font-display font-black uppercase tracking-tighter leading-[0.92]">
              {homeText(lang, "gap.title")}
            </h2>
            <p className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-tight mt-8 border-t-2 border-primary-foreground/30 pt-8">
              {homeText(lang, "gap.subtitle")}
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-widest leading-relaxed max-w-md opacity-80">
            {homeText(lang, "gap.closing")}
          </div>
        </div>

        <div className="bg-card">
          {executionPains.map((pain) => (
            <article key={pain.markerKey} className="p-7 sm:p-10 border-b-2 last:border-b-0 border-border group hover:bg-background transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">{homeText(lang, pain.markerKey)}</div>
              <h3 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight leading-tight max-w-3xl">
                {homeText(lang, pain.titleKey)}
              </h3>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mt-4 max-w-3xl">{homeText(lang, pain.bodyKey)}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:items-center px-6 py-12 sm:px-10 bg-foreground text-background">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest font-bold mb-3">{homeText(lang, "gap.offerLabel")}</div>
          <p className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight max-w-4xl">
            {homeText(lang, "gap.offerTitle")}
          </p>
          <p className="font-sans mt-3 text-background/70 max-w-3xl">
            {homeText(lang, "gap.offerBody")}
          </p>
        </div>
        <Button onClick={openCapture} className="h-16 px-8 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-display font-black uppercase tracking-wide">
          {homeText(lang, closed ? "gap.cta.closed" : "gap.cta.open")} <ArrowRight className="ml-3 h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

function RealWorkSection() {
  const { lang } = useI18n();
  return (
    <section id="trabalho-concreto" className="py-24 sm:py-32 border-b-2 border-border relative bg-card scroll-mt-20">
      <div className="px-6">
        <div className="mb-16">
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">{homeText(lang, "work.heading")}</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight max-w-4xl">
            {homeText(lang, "work.title")}
          </p>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl leading-relaxed">
            {homeText(lang, "work.intro")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[2px] border-2 border-border bg-border">
          <WorkCard
            number="01"
            copyKey="offer"
            icon={<Search className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="02"
            copyKey="video"
            icon={<Video className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="03"
            copyKey="landing"
            icon={<Layers className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="04"
            copyKey="paid"
            icon={<Target className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="05"
            copyKey="organic"
            icon={<Megaphone className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="06"
            copyKey="sales"
            icon={<Users className="w-8 h-8 text-primary" />}
          />
        </div>
      </div>
    </section>
  );
}

function WorkCard({ number, copyKey, icon }: { number: string; copyKey: "offer" | "video" | "landing" | "paid" | "organic" | "sales"; icon: React.ReactNode }) {
  const { lang } = useI18n();
  return (
    <div className="bg-background p-8 flex flex-col group hover:bg-card transition-colors">
      <div className="flex justify-between items-start mb-12">
        <span className="font-mono text-4xl font-black text-muted-foreground/30 group-hover:text-primary transition-colors">{number}</span>
        {icon}
      </div>
      <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-4">{homeText(lang, `work.${copyKey}.title`)}</h3>
      <p className="text-muted-foreground font-sans text-base leading-relaxed">{homeText(lang, `work.${copyKey}.body`)}</p>
    </div>
  );
}

const archSteps = [
  { id: "niche", highlight: false },
  { id: "offer", highlight: false },
  { id: "creative", highlight: true },
  { id: "distribution", highlight: false },
  { id: "ads", highlight: false },
  { id: "crm", highlight: false },
] as const;

function ArchitectureSection() {
  const { lang } = useI18n();
  const [activeStep, setActiveStep] = useState<string | null>(null);

  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-background">
      <div className="px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="lg:sticky lg:top-32">
            <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">{homeText(lang, "architecture.heading")}</h2>
            <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight mb-8">
              {homeText(lang, "architecture.title")}
            </p>
            <div className="space-y-6 text-lg text-muted-foreground font-sans">
              <p>{homeText(lang, "architecture.p1")}</p>
              <p>{homeText(lang, "architecture.p2")}</p>
              <p>{homeText(lang, "architecture.p3.before")}<strong className="text-foreground">{homeText(lang, "architecture.p3.emphasis")}</strong>{homeText(lang, "architecture.p3.after")}</p>
              <p>{homeText(lang, "architecture.p4")}</p>
              <p className="font-mono text-xs uppercase tracking-widest text-primary pt-4 hidden lg:block animate-pulse">
                {homeText(lang, "architecture.hint")}
              </p>
            </div>
          </div>

          <div className="relative border-2 border-border p-4 sm:p-8 bg-card">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b-2 border-l-2 border-border bg-background hidden sm:block">
              {homeText(lang, "architecture.label")}
            </div>

            <div className="mt-8 space-y-2">
              {archSteps.map(step => (
                <ArchNode
                  key={step.id}
                  step={step}
                  isActive={activeStep === step.id}
                  onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type ArchitectureStep = typeof archSteps[number];
function ArchNode({ step, isActive, onClick }: { step: ArchitectureStep; isActive: boolean; onClick: () => void }) {
  const { lang } = useI18n();
  const key = `architecture.step.${step.id}` as const;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-2 p-4 flex flex-col gap-2 transition-colors focus:outline-none focus:border-primary ${step.highlight ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border bg-background hover:bg-card'} ${isActive ? 'border-primary' : ''}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
        <span className="font-display font-bold uppercase tracking-tight text-foreground">{homeText(lang, `${key}.title`)}</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 ${step.highlight ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <span className={`font-mono text-[10px] uppercase font-bold tracking-widest ${step.highlight ? 'text-primary' : 'text-muted-foreground'}`}>{homeText(lang, `${key}.status`)}</span>
        </div>
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-6 pb-2 space-y-4 font-sans text-sm border-t-2 border-border/50 mt-4">
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">{homeText(lang, "architecture.observe")}</span>
                  <span className="text-foreground/90">{homeText(lang, `${key}.observe`)}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">{homeText(lang, "architecture.decide")}</span>
                  <span className="text-foreground/90">{homeText(lang, `${key}.decide`)}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">{homeText(lang, "architecture.create")}</span>
                  <span className="text-foreground/90">{homeText(lang, `${key}.create`)}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                  <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-widest pt-1">{homeText(lang, "architecture.execute")}</span>
                  <span className="text-foreground/90 font-medium">{homeText(lang, `${key}.execute`)}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">{homeText(lang, "architecture.measure")}</span>
                  <span className="text-foreground/90">{homeText(lang, `${key}.measure`)}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function OperationalScopeSection() {
  const { lang } = useI18n();
  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-card">
      <div className="px-6">
        <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-12 font-bold text-center">{homeText(lang, "governance.heading")}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-2 border-border bg-background p-8">
            <ShieldCheck className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">{homeText(lang, "governance.authorization.title")}</h3>
            <p className="text-muted-foreground font-sans">
              {homeText(lang, "governance.authorization.body")}
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Workflow className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">{homeText(lang, "governance.workspaces.title")}</h3>
            <p className="text-muted-foreground font-sans">
              {homeText(lang, "governance.workspaces.body")}
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Activity className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">{homeText(lang, "governance.metrics.title")}</h3>
            <p className="text-muted-foreground font-sans">
              {homeText(lang, "governance.metrics.body")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofOfLogicSection() {
  const { lang } = useI18n();
  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-background">
      <div className="px-6">
        <div className="max-w-4xl mb-16">
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">{homeText(lang, "proof.heading")}</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight">
            {homeText(lang, "proof.title")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">{homeText(lang, "proof.brain.title")}</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                {homeText(lang, "proof.brain.body")}
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">{homeText(lang, "proof.safety.title")}</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                {homeText(lang, "proof.safety.body")}
              </p>
            </div>
          </div>

          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">{homeText(lang, "proof.decisions.title")}</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                {homeText(lang, "proof.decisions.body")}
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">{homeText(lang, "proof.memory.title")}</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                {homeText(lang, "proof.memory.body")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScarcitySection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  const { lang } = useI18n();
  return (
    <section className="py-32 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />

      <div className="px-6 relative z-10 max-w-4xl mx-auto text-center">
        <Lock className="w-16 h-16 mx-auto mb-8" />
        <h2 className="text-4xl sm:text-6xl font-display font-black uppercase tracking-tighter leading-none mb-8">
          {homeText(lang, "scarcity.title")}
        </h2>
        <p className="text-xl font-sans font-medium mb-12 opacity-90 max-w-2xl mx-auto">
          {homeText(lang, "scarcity.body")}
        </p>

        <Button
          onClick={openCapture}
          className="h-20 px-12 text-lg font-display font-black rounded-none bg-background text-foreground hover:bg-muted-foreground hover:text-background transition-colors uppercase tracking-widest border-2 border-background"
        >
          {homeText(lang, closed ? "scarcity.cta.closed" : "scarcity.cta.open")}
        </Button>

        <div className="mt-8 font-mono text-sm font-bold uppercase tracking-widest opacity-80">
          {homeText(lang, closed ? "scarcity.status.closed" : "scarcity.status.open")}
        </div>

        <div className="mt-16 pt-8 border-t-2 border-primary-foreground/20">
          <p className="font-display font-bold text-2xl uppercase tracking-tight mb-3">
            {homeText(lang, "scarcity.credibility")}
          </p>
          <p className="font-sans font-medium text-lg opacity-90">
            {homeText(lang, "scarcity.community")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { lang } = useI18n();
  return (
    <footer className="border-t-2 border-border bg-background py-12 px-6 text-center sm:text-left">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}nexos_ai_logo_1024x1024.png`} alt="NexOS" className="h-8 w-8 object-contain" />
          <span className="font-display font-black text-xl uppercase tracking-tighter text-muted-foreground">NexOS</span>
        </div>

        <div className="flex gap-6 font-mono text-xs uppercase tracking-widest font-bold text-muted-foreground">
          <Link href="/terms" className="hover:text-primary transition-colors">{homeText(lang, "footer.terms")}</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">{homeText(lang, "footer.privacy")}</Link>
          <Link href="/data-deletion" className="hover:text-primary transition-colors">{homeText(lang, "footer.deletion")}</Link>
        </div>

        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} NexOS. {homeText(lang, "footer.signature")}
        </div>
      </div>
    </footer>
  );
}

const glp22Phases = [
  { id: "strategy", labelKey: "glp.phase.strategy.label", nameKey: "glp.phase.strategy.name", titleKey: "glp.phase.strategy.title", itemIds: ["01", "02", "03", "04", "05", "06", "07"] },
  { id: "creation", labelKey: "glp.phase.creation.label", nameKey: "glp.phase.creation.name", titleKey: "glp.phase.creation.title", itemIds: ["08", "09", "10", "11", "12"] },
  { id: "infrastructure", labelKey: "glp.phase.infrastructure.label", nameKey: "glp.phase.infrastructure.name", titleKey: "glp.phase.infrastructure.title", itemIds: ["13", "14", "15", "16"] },
  { id: "sales", labelKey: "glp.phase.sales.label", nameKey: "glp.phase.sales.name", titleKey: "glp.phase.sales.title", itemIds: ["17", "18", "19"] },
  { id: "continuity", labelKey: "glp.phase.continuity.label", nameKey: "glp.phase.continuity.name", titleKey: "glp.phase.continuity.title", itemIds: ["20", "21", "22"] },
] as const;

function GLP22Section() {
  const { lang } = useI18n();
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <section id="metodo-glp22" className="py-24 sm:py-32 border-b-2 border-border bg-foreground text-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,var(--primary)_0%,transparent_10%)] opacity-20 pointer-events-none" />

      <div className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-16 items-start">
          <div className="xl:sticky xl:top-32">
            <div className="inline-flex items-center gap-3 px-4 py-2 border-2 border-background/20 bg-background/5 mb-8">
              <span className="w-2 h-2 bg-primary animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold">{homeText(lang, "glp.heading")}</span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black uppercase tracking-tighter leading-tight mb-8">
              {homeText(lang, "glp.title.before")} <span className="text-primary">{homeText(lang, "glp.title.accent")}</span>
            </h2>

            <div className="space-y-6 text-lg text-background/70 font-sans mb-12">
              <p>{homeText(lang, "glp.intro1")}</p>
              <p>{homeText(lang, "glp.intro2")}</p>
            </div>

            <div className="hidden xl:flex flex-col gap-2">
              {glp22Phases.map((phase, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhaseIndex(idx)}
                  className={`text-left px-6 py-4 border-2 transition-colors font-display font-bold uppercase tracking-tight text-sm flex items-center justify-between ${
                    activePhaseIndex === idx
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-background/20 text-background/60 hover:text-background hover:border-background/40'
                  }`}
                >
                  <span>{homeText(lang, phase.labelKey)}</span>
                  <ArrowRight className={`w-4 h-4 transition-transform ${activePhaseIndex === idx ? 'translate-x-0' : '-translate-x-4 opacity-0'}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-background text-foreground border-2 border-border p-1">
            <div className="xl:hidden flex overflow-x-auto gap-2 p-4 border-b-2 border-border snap-x pb-4">
              {glp22Phases.map((phase, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhaseIndex(idx)}
                  className={`snap-start whitespace-nowrap px-6 py-3 border-2 transition-colors font-display font-bold uppercase tracking-tight text-xs ${
                    activePhaseIndex === idx
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {homeText(lang, phase.labelKey)}
                </button>
              ))}
            </div>

            <div className="p-6 sm:p-10 min-h-[600px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePhaseIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-10">
                    <span className="font-mono text-xs text-primary uppercase font-bold tracking-widest mb-2 block">
                      {homeText(lang, glp22Phases[activePhaseIndex].nameKey)}
                    </span>
                    <h3 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
                      {homeText(lang, glp22Phases[activePhaseIndex].titleKey)}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {glp22Phases[activePhaseIndex].itemIds.map((itemId) => {
                      const itemKey = `glp.phase.${glp22Phases[activePhaseIndex].id}.item.${itemId}` as HomeTextKey;
                      const isExpanded = expandedItems.includes(itemId);
                      return (
                        <div
                          key={itemId}
                          className={`border-2 transition-colors ${isExpanded ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <button
                            onClick={() => toggleItem(itemId)}
                            className="w-full text-left p-5 flex items-center justify-between gap-4 focus:outline-none"
                          >
                            <div className="flex items-center gap-4 sm:gap-6">
                              <span className="font-mono text-sm sm:text-base font-bold text-muted-foreground w-6">
                                {itemId}
                              </span>
                              <span className="font-display font-bold text-lg sm:text-xl uppercase tracking-tight">
                                {homeText(lang, `${itemKey}.title` as HomeTextKey)}
                              </span>
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 text-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-5 pt-0 pl-16 sm:pl-[4.5rem]">
                                  <div className="border-l-2 border-primary/30 pl-4 py-1">
                                    <p className="text-muted-foreground font-sans leading-relaxed">
                                      {homeText(lang, `${itemKey}.desc` as HomeTextKey)}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
