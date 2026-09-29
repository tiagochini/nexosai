import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import {
  ArrowRight, Zap, Brain, Target, Users, TrendingUp,
  GraduationCap, Building2, Rocket, Bot, Globe, ChevronDown,
  Play, Shield, BarChart3, Cpu, Layers, Star, CheckCircle2,
  Mail, Phone, Instagram, Youtube, MessageCircle,
} from "lucide-react";

function useInView(threshold = 0.2) {
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

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Nav({ scrolled }: { scrolled: boolean }) {
  const t = useUiText();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-[#04060f]/95 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <img src="/nexos-logo.png" alt="NexOS" className="h-9 w-9 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(250 90% 65% / 0.8))" }} />
          <div>
            <div className="font-mono font-black text-base tracking-[0.15em] uppercase text-white">NexOS AI</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-purple-400/70 hidden sm:block">{t("Ecossistema de IA", "AI ecosystem", "Ecosistema de IA")}</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest text-white/50">
          <a href="#produtos" className="hover:text-white transition-colors">{t("Produtos", "Products", "Productos")}</a>
          <a href="#servicos" className="hover:text-white transition-colors">{t("Serviços", "Services", "Servicios")}</a>
          <a href="#academy" className="hover:text-white transition-colors">Academy</a>
          <a href="#contato" className="hover:text-white transition-colors">{t("Contato", "Contact", "Contacto")}</a>
        </div>

        <div className="flex items-center gap-2">
          <a href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-white/50 hover:text-white">
              {t("Entrar", "Sign in", "Entrar")}
            </Button>
          </a>
          <a href="/landing/">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white font-mono uppercase text-[10px] tracking-widest font-bold rounded-none h-9 px-4">
              {t("Começar", "Get started", "Comenzar")}
            </Button>
          </a>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white/60 hover:text-white p-1">
            <div className={`space-y-1 transition-all ${mobileOpen ? "rotate-45" : ""}`}>
              <div className="w-5 h-0.5 bg-current" />
              <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
              <div className="w-5 h-0.5 bg-current" />
            </div>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#04060f]/98 border-b border-white/10 px-6 py-4 flex flex-col gap-4 font-mono text-sm uppercase tracking-widest text-white/60">
          <a href="#produtos" onClick={() => setMobileOpen(false)} className="hover:text-white">{t("Produtos", "Products", "Productos")}</a>
          <a href="#servicos" onClick={() => setMobileOpen(false)} className="hover:text-white">{t("Serviços", "Services", "Servicios")}</a>
          <a href="#academy" onClick={() => setMobileOpen(false)} className="hover:text-white">Academy</a>
          <a href="#contato" onClick={() => setMobileOpen(false)} className="hover:text-white">{t("Contato", "Contact", "Contacto")}</a>
          <a href="/login" className="hover:text-white">{t("Entrar", "Sign in", "Entrar")}</a>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  const t = useUiText();
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(250_90%_15%/0.5)_0%,_transparent_60%)]" />
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, hsl(250 90% 65% / 0.06) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 border border-purple-500/30 bg-purple-500/10 text-purple-300 font-mono text-[10px] uppercase tracking-[0.3em] px-4 py-2 rounded-full mb-8">
          <Zap className="h-3 w-3" />
          {t("Ecossistema de Inteligência Artificial", "Artificial intelligence ecosystem", "Ecosistema de inteligencia artificial")}
        </div>

        <h1 className="font-mono font-black text-4xl sm:text-6xl md:text-7xl uppercase tracking-tight text-white leading-none mb-6">
          {t("O futuro do", "The future of", "El futuro del")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            {t("marketing digital", "digital marketing", "marketing digital")}
          </span>
          <br />{t("já chegou.", "is here.", "ya llegó.")}
        </h1>

        <p className="text-white/50 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("NexOS AI é o ecossistema completo de IA para lançamentos, tráfego pago, automação e crescimento digital. Do briefing ao resultado — em modo autônomo.", "NexOS AI is the complete AI ecosystem for launches, paid media, automation, and digital growth. From briefing to results — autonomously.", "NexOS AI es el ecosistema completo de IA para lanzamientos, publicidad, automatización y crecimiento digital. Del briefing a los resultados, en modo autónomo.")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/landing/">
            <Button className="bg-purple-600 hover:bg-purple-500 text-white font-mono uppercase tracking-widest text-sm font-bold rounded-none h-12 px-8 gap-2">
              {t("Ver NexOS AI", "Explore NexOS AI", "Ver NexOS AI")} <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
          <a href="#produtos">
            <Button variant="outline" className="border-white/20 text-white/70 hover:text-white hover:border-white/40 font-mono uppercase tracking-widest text-sm rounded-none h-12 px-8 gap-2 bg-transparent">
              {t("Explorar ecossistema", "Explore ecosystem", "Explorar ecosistema")} <ChevronDown className="h-4 w-4" />
            </Button>
          </a>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {[
            { value: "57+", label: t("Agentes AI", "AI agents", "Agentes de IA") },
            { value: "7", label: t("Dias até o lançamento", "Days to launch", "Días hasta el lanzamiento") },
            { value: "100%", label: "Autopilot" },
          ].map(s => (
            <div key={s.label} className="border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-mono font-black text-2xl text-purple-400">{s.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-30">
        <ChevronDown className="h-4 w-4 text-purple-400" />
      </div>
    </section>
  );
}

const PRODUTOS = [
  {
    id: "nexos-ai",
    icon: <Rocket className="h-8 w-8 text-purple-400" />,
    badge: "CARRO-CHEFE",
    badgeColor: "text-purple-300 border-purple-500/40 bg-purple-500/10",
    title: "NexOS AI",
    subtitle: "Lançamentos 100% Autopilot",
    description: "O sistema operacional para lançamentos digitais. 57 agentes de IA executam estratégia, copy, criativos, sequência PLF e tráfego pago — do briefing ao carrinho aberto, sem precisar de equipe.",
    features: [
      "57 agentes de IA especializados",
      "Sequência PLF completa automatizada",
      "Estratégia, copy e criativos por IA",
      "Dashboard de métricas em tempo real",
      "Tracks: 6 dígitos → 10 dígitos",
    ],
    cta: "Quero execução autônoma",
    href: "/landing/",
    highlight: true,
    comingSoon: false,
  },
  {
    id: "academy",
    icon: <GraduationCap className="h-8 w-8 text-yellow-400" />,
    badge: "CURSO COMPLETO",
    badgeColor: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
    title: "NexOS Academy",
    subtitle: "Metodologia de Lançamentos",
    description: "O método por trás da máquina. 12 módulos cobrindo lançamentos PLF, tráfego pago, copy de alta conversão, automação e psicologia do consumidor — do zero ao avançado.",
    features: [
      "12 módulos + 118 aulas completas",
      "PLF, Semente, Perpétuo e Afiliados",
      "Meta Ads + Google Ads — agentes autônomos",
      "Psicologia e neuromarketing",
      "Glossário com 80+ termos técnicos",
    ],
    cta: "Acessar Academy",
    href: "/nexos-academy/",
    highlight: false,
    comingSoon: false,
  },
  {
    id: "autopilot",
    icon: <Bot className="h-8 w-8 text-cyan-400" />,
    badge: "NOVO CURSO",
    badgeColor: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
    title: "Curso AUTOPILOT",
    subtitle: "Automações & Redes Sociais — Piloto Automático",
    description: "Aprenda a criar conexões e automatizar operações completas nas redes sociais, anúncios e campanhas. Fluxos que trabalham por você enquanto você dorme.",
    features: [
      "Automação de redes sociais end-to-end",
      "Criação de agentes de IA customizados",
      "Gestão automatizada de campanhas",
      "Integrações: WhatsApp, Instagram, Meta Ads",
      "Fluxos de nutrição e vendas no piloto automático",
    ],
    cta: "Quero ser notificado",
    href: "#contato",
    highlight: false,
    comingSoon: true,
  },
  {
    id: "primeiros10k",
    icon: <TrendingUp className="h-8 w-8 text-green-400" />,
    badge: "INICIANTE",
    badgeColor: "text-green-300 border-green-500/40 bg-green-500/10",
    title: "Primeiros 10K",
    subtitle: "Primeiras Vendas Online",
    description: "O curso completo para quem quer fazer as primeiras vendas na internet. Passo a passo desde a ideia até os primeiros R$10.000 — sem precisar de audiência ou experiência prévia.",
    features: [
      "Validação de produto do zero",
      "Primeiras campanhas de tráfego pago",
      "Copy que converte para iniciantes",
      "Funil de vendas simplificado",
      "Suporte e comunidade exclusiva",
    ],
    cta: "Quero ser notificado",
    href: "#contato",
    highlight: false,
    comingSoon: true,
  },
];

function ProdutosSection() {
  const t = useUiText();
  const productCopy: Record<string, { title: [string, string]; badge: [string, string]; subtitle: [string, string]; description: [string, string]; features: [string, string][]; cta: [string, string] }> = {
    "nexos-ai": {
      title: ["NexOS AI", "NexOS AI"],
      badge: ["FLAGSHIP", "PRODUCTO PRINCIPAL"], subtitle: ["100% Autopilot Launches", "Lanzamientos 100% automáticos"],
      description: ["The operating system for digital launches. 57 AI agents execute strategy, copy, creative, PLF sequences, and paid traffic — from briefing to open cart, with no team required.", "El sistema operativo para lanzamientos digitales. 57 agentes de IA ejecutan estrategia, textos, creatividades, secuencias PLF y tráfico pagado, desde el briefing hasta la apertura del carrito y sin necesidad de un equipo."],
      features: [["57 specialized AI agents", "57 agentes de IA especializados"], ["Complete automated PLF sequence", "Secuencia PLF completa y automatizada"], ["AI-powered strategy, copy, and creative", "Estrategia, textos y creatividades con IA"], ["Real-time metrics dashboard", "Panel de métricas en tiempo real"], ["Tracks: 6 to 10 figures", "Tracks: de 6 a 10 cifras"]],
      cta: ["I want autonomous execution", "Quiero ejecución autónoma"],
    },
    academy: {
      title: ["NexOS Academy", "NexOS Academy"],
      badge: ["COMPLETE COURSE", "CURSO COMPLETO"], subtitle: ["Launch Methodology", "Metodología de lanzamientos"],
      description: ["The method behind the machine. 12 modules cover PLF launches, paid traffic, high-converting copy, automation, and consumer psychology — from beginner to advanced.", "El método detrás de la máquina. 12 módulos sobre lanzamientos PLF, tráfico pagado, textos de alta conversión, automatización y psicología del consumidor, de principiante a avanzado."],
      features: [["12 modules + 118 complete lessons", "12 módulos + 118 lecciones completas"], ["PLF, Seed, Evergreen, and Affiliates", "PLF, Semilla, Evergreen y Afiliados"], ["Meta Ads + Google Ads — autonomous agents", "Meta Ads + Google Ads — agentes autónomos"], ["Psychology and neuromarketing", "Psicología y neuromarketing"], ["Glossary with 80+ technical terms", "Glosario con más de 80 términos técnicos"]],
      cta: ["Access the Academy", "Acceder a la Academy"],
    },
    autopilot: {
      title: ["AUTOPILOT Course", "Curso AUTOPILOT"],
      badge: ["NEW COURSE", "NUEVO CURSO"], subtitle: ["Automation & Social Media — Autopilot", "Automatización y redes sociales — piloto automático"],
      description: ["Learn to build connections and automate complete operations across social media, ads, and campaigns. Workflows that work for you while you sleep.", "Aprende a crear conexiones y automatizar operaciones completas en redes sociales, anuncios y campañas. Flujos que trabajan por ti mientras duermes."],
      features: [["End-to-end social media automation", "Automatización integral de redes sociales"], ["Custom AI agent creation", "Creación de agentes de IA personalizados"], ["Automated campaign management", "Gestión automatizada de campañas"], ["Integrations: WhatsApp, Instagram, Meta Ads", "Integraciones: WhatsApp, Instagram y Meta Ads"], ["Automated nurturing and sales workflows", "Flujos automáticos de nutrición y ventas"]],
      cta: ["Notify me", "Quiero recibir avisos"],
    },
    primeiros10k: {
      title: ["First 10K", "Primeros 10K"],
      badge: ["BEGINNER", "PRINCIPIANTE"], subtitle: ["First Online Sales", "Primeras ventas en línea"],
      description: ["The complete course for making your first online sales. A step-by-step path from idea to your first R$10,000 — with no audience or prior experience required.", "El curso completo para lograr tus primeras ventas en internet. Paso a paso, desde la idea hasta los primeros R$10.000, sin necesidad de audiencia ni experiencia previa."],
      features: [["Validate a product from scratch", "Validación de producto desde cero"], ["Your first paid traffic campaigns", "Primeras campañas de tráfico pagado"], ["Copy that converts for beginners", "Textos que convierten para principiantes"], ["Simplified sales funnel", "Embudo de ventas simplificado"], ["Exclusive support and community", "Comunidad y soporte exclusivos"]],
      cta: ["Notify me", "Quiero recibir avisos"],
    },
  };
  return (
    <section id="produtos" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-purple-400 mb-4">{t("Ecossistema", "Ecosystem", "Ecosistema")}</div>
          <h2 className="font-mono font-black text-3xl sm:text-5xl uppercase text-white tracking-tight">
            {t("Quatro produtos.", "Four products.", "Cuatro productos.")}<br />{t("Um ecossistema.", "One ecosystem.", "Un ecosistema.")}
          </h2>
          <p className="text-white/40 mt-4 max-w-xl mx-auto">
            {t("Do aprendizado ao lançamento em piloto automático — tudo integrado sob a marca NexOS.", "From learning to launching on autopilot — all integrated under the NexOS brand.", "Del aprendizaje al lanzamiento automatizado: todo integrado bajo la marca NexOS.")}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PRODUTOS.map((p, i) => (
            <FadeIn key={p.id} delay={i * 80}>
              <div className={`relative border flex flex-col h-full p-7 transition-all duration-300 hover:border-white/20 ${p.highlight ? "border-purple-500/50 bg-gradient-to-b from-purple-900/20 to-transparent" : p.comingSoon ? "border-white/8 bg-white/[0.02] opacity-80" : "border-white/10 bg-white/[0.03]"}`}>
                {p.highlight && (
                  <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
                )}
                <div className="flex items-start justify-between mb-6">
                  <div className={`inline-flex items-center gap-1.5 border font-mono text-[9px] uppercase tracking-[0.25em] px-2 py-1 ${p.badgeColor}`}>
                    {t(p.badge, productCopy[p.id].badge[0], productCopy[p.id].badge[1])}
                  </div>
                  {p.comingSoon && (
                    <div className="inline-flex items-center gap-1 border border-white/15 bg-white/5 font-mono text-[9px] uppercase tracking-widest px-2 py-1 text-white/40">
                      {t("Em breve", "Coming soon", "Próximamente")}
                    </div>
                  )}
                </div>
                <div className="mb-3">{p.icon}</div>
                <h3 className="font-mono font-black text-xl text-white uppercase tracking-wide">{t(p.title, productCopy[p.id].title[0], productCopy[p.id].title[1])}</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">{t(p.subtitle, productCopy[p.id].subtitle[0], productCopy[p.id].subtitle[1])}</p>
                <p className="text-white/55 text-sm leading-relaxed mb-6">{t(p.description, productCopy[p.id].description[0], productCopy[p.id].description[1])}</p>
                <ul className="space-y-2 mb-8 flex-1">
                  {p.features.map((f, featureIndex) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/45">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${p.comingSoon ? "text-white/20" : "text-purple-400"}`} />
                      {t(f, productCopy[p.id].features[featureIndex][0], productCopy[p.id].features[featureIndex][1])}
                    </li>
                  ))}
                </ul>
                <a href={p.href}>
                  <Button className={`w-full font-mono uppercase text-xs tracking-widest rounded-none h-10 gap-2 ${p.highlight ? "bg-purple-600 hover:bg-purple-500 text-white" : p.comingSoon ? "bg-white/5 hover:bg-white/10 text-white/50 border border-white/10" : "bg-white/10 hover:bg-white/15 text-white border border-white/20"}`}>
                    {t(p.cta, productCopy[p.id].cta[0], productCopy[p.id].cta[1])} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const SERVICOS = [
  { icon: <Bot className="h-6 w-6 text-purple-400" />, title: "Agentes de IA Customizados", desc: "Criação de agentes especializados para seus processos internos de vendas, atendimento, operações e marketing." },
  { icon: <Zap className="h-6 w-6 text-cyan-400" />, title: "Automações Full Autopilot", desc: "Integração de IA em todos os fluxos da empresa: CRM, e-mail, WhatsApp, redes sociais, relatórios e muito mais." },
  { icon: <BarChart3 className="h-6 w-6 text-green-400" />, title: "Gestão de Tráfego Autônoma", desc: "Campanhas de Meta Ads e Google Ads gerenciadas por agentes com otimização em tempo real e relatórios automáticos." },
  { icon: <Rocket className="h-6 w-6 text-yellow-400" />, title: "Lançamentos Full Service", desc: "Executamos o lançamento completo do seu produto digital usando o sistema NexOS — do briefing ao carrinho fechado." },
  { icon: <Globe className="h-6 w-6 text-purple-400" />, title: "Integrações & Tech", desc: "Conectamos qualquer stack: CRMs, plataformas de pagamento, e-mail marketing, WhatsApp Business API e mais." },
  { icon: <Layers className="h-6 w-6 text-cyan-400" />, title: "White-Label Agency", desc: "Revenda o NexOS AI com sua marca. Suite completa para agências que querem oferecer IA de ponta aos seus clientes." },
];

function ServicosSection() {
  const t = useUiText();
  const serviceCopy: [string, string, string, string][] = [
    ["Custom AI Agents", "Agentes de IA personalizados", "Creation of specialized agents for your internal sales, support, operations, and marketing processes.", "Creación de agentes especializados para tus procesos internos de ventas, atención, operaciones y marketing."],
    ["Full Autopilot Automation", "Automatizaciones Full Autopilot", "AI integration across every business workflow: CRM, email, WhatsApp, social media, reports, and more.", "Integración de IA en todos los flujos de la empresa: CRM, correo, WhatsApp, redes sociales, informes y mucho más."],
    ["Autonomous Traffic Management", "Gestión autónoma del tráfico", "Meta Ads and Google Ads campaigns managed by agents with real-time optimization and automatic reporting.", "Campañas de Meta Ads y Google Ads gestionadas por agentes con optimización en tiempo real e informes automáticos."],
    ["Full-Service Launches", "Lanzamientos Full Service", "We execute your complete digital product launch with NexOS — from briefing to cart close.", "Ejecutamos el lanzamiento completo de tu producto digital con NexOS, desde el briefing hasta el cierre del carrito."],
    ["Integrations & Tech", "Integraciones y tecnología", "We connect any stack: CRMs, payment platforms, email marketing, WhatsApp Business API, and more.", "Conectamos cualquier stack: CRM, plataformas de pago, marketing por correo, WhatsApp Business API y más."],
    ["White-Label Agency", "Agencia de marca blanca", "Resell NexOS AI under your brand. A complete suite for agencies offering cutting-edge AI to clients.", "Revende NexOS AI con tu marca. Una suite completa para agencias que ofrecen IA de vanguardia a sus clientes."],
  ];
  return (
    <section id="servicos" className="py-24 px-4 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-400 mb-4">{t("Serviços", "Services", "Servicios")}</div>
          <h2 className="font-mono font-black text-3xl sm:text-5xl uppercase text-white tracking-tight">
            {t("IA aplicada ao", "AI for", "IA aplicada a")}<br />{t("seu negócio", "your business", "tu negocio")}
          </h2>
          <p className="text-white/40 mt-4 max-w-xl mx-auto">
            {t("Para empresas que precisam de IA de verdade — não buzzword, mas resultado.", "For businesses that need real AI — not buzzwords, but results.", "Para empresas que necesitan IA de verdad: resultados, no palabras de moda.")}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICOS.map((s, i) => (
            <FadeIn key={s.title} delay={i * 80}>
              <div className="border border-white/8 bg-white/[0.03] p-6 hover:border-white/15 hover:bg-white/[0.05] transition-all duration-300 group">
                <div className="mb-4 p-2 w-fit bg-white/5 group-hover:bg-white/10 transition-colors">
                  {s.icon}
                </div>
                  <h3 className="font-mono font-bold text-sm text-white uppercase tracking-wide mb-2">{t(s.title, serviceCopy[i][0], serviceCopy[i][1])}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{t(s.desc, serviceCopy[i][2], serviceCopy[i][3])}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn className="mt-12 text-center">
          <a href="#contato">
            <Button className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-mono uppercase text-xs tracking-widest rounded-none h-11 px-8 gap-2">
              {t("Falar sobre o seu projeto", "Discuss your project", "Hablar sobre tu proyecto")} <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </FadeIn>
      </div>
    </section>
  );
}

function AcademySection() {
  const t = useUiText();
  const modules: [string, string, string][] = [
    ["Fundamentos de Lançamentos PLF", "PLF Launch Fundamentals", "Fundamentos de lanzamientos PLF"],
    ["Fórmula de Lançamento Semente", "Seed Launch Formula", "Fórmula de lanzamiento Semilla"],
    ["Copywriting de Alta Conversão", "High-Converting Copywriting", "Redacción de alta conversión"],
    ["Meta Ads & Google Ads — execução autônoma", "Meta Ads & Google Ads — autonomous execution", "Meta Ads y Google Ads — ejecución autónoma"],
    ["Psicologia e Neuromarketing", "Psychology and Neuromarketing", "Psicología y neuromarketing"],
    ["Automação de Marketing", "Marketing Automation", "Automatización de marketing"],
    ["Sequências de E-mail e WhatsApp", "Email and WhatsApp Sequences", "Secuencias de correo y WhatsApp"],
    ["Analytics e Otimização", "Analytics and Optimization", "Analítica y optimización"],
    ["Perpétuo e Escala", "Evergreen and Scaling", "Evergreen y escalado"],
    ["IA Aplicada ao Marketing", "AI Applied to Marketing", "IA aplicada al marketing"],
    ["Afiliados e Parcerias", "Affiliates and Partnerships", "Afiliados y alianzas"],
    ["Compliance e Proteção de Marca", "Compliance and Brand Protection", "Cumplimiento y protección de marca"],
  ];
  return (
    <section id="academy" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 font-mono text-[10px] uppercase tracking-[0.3em] px-3 py-1.5 mb-6">
              <GraduationCap className="h-3 w-3" />
              NexOS Academy
            </div>
            <h2 className="font-mono font-black text-3xl sm:text-4xl uppercase text-white tracking-tight leading-tight mb-6">
              {t("Aprenda o método.", "Learn the method.", "Aprende el método.")}<br />
              <span className="text-yellow-400">{t("Domine o mercado.", "Master the market.", "Domina el mercado.")}</span>
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-8">
              {t("Curso completo de marketing digital para lançamentos, tráfego pago, automação e psicologia de conversão. A metodologia que alimenta o NexOS AI — ensinada do zero ao avançado.", "A complete digital marketing course covering launches, paid media, automation, and conversion psychology. Learn the methodology behind NexOS AI — from beginner to advanced.", "Curso completo de marketing digital para lanzamientos, publicidad, automatización y psicología de conversión. Aprende desde cero y hasta un nivel avanzado la metodología detrás de NexOS AI.")}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: "12", label: t("Módulos", "Modules", "Módulos") },
                { value: "118+", label: t("Aulas", "Lessons", "Lecciones") },
                { value: "80+", label: t("Termos no glossário", "Glossary terms", "Términos del glosario") },
                { value: "Professor Allan", label: t("Instrutor IA", "AI instructor", "Instructor de IA") },
              ].map(s => (
                <div key={s.label} className="border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <div className="font-mono font-black text-xl text-yellow-400">{s.value}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <a href="/nexos-academy/">
              <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-mono uppercase text-xs tracking-widest font-bold rounded-none h-11 px-8 gap-2">
                {t("Acessar Academy", "Access the Academy", "Acceder a Academy")} <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="border border-yellow-500/20 bg-gradient-to-b from-yellow-900/10 to-transparent p-8">
              <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 mb-6">{t("Conteúdo do curso", "Course content", "Contenido del curso")}</div>
              <div className="space-y-3">
                {modules.map(([pt, en, es], i) => (
                  <div key={pt} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-[10px] text-yellow-500/50 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-white/60">{t(pt, en, es)}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function DiferencialSection() {
  const t = useUiText();
  const diferencialCopy: [string, string, string, string][] = [
    ["Real AI", "IA de verdad", "Claude, GPT-5.5, and Gemini work together — each agent uses its ideal model.", "Claude, GPT-5.5 y Gemini trabajan juntos; cada agente usa el modelo ideal."],
    ["Privacy & Compliance", "Privacidad y cumplimiento", "Complete audit trail, automatic consent, and compliance in every action.", "Trazabilidad completa, consentimiento automático y cumplimiento en cada acción."],
    ["Robust Infrastructure", "Infraestructura sólida", "BullMQ, real-time Socket.io, PostgreSQL, and Redis — enterprise-grade architecture.", "BullMQ, Socket.io en tiempo real, PostgreSQL y Redis: arquitectura de nivel empresarial."],
    ["Results Focus", "Enfoque en resultados", "Every agent is trained on performance frameworks — DOMINO, PLF, CBO, and more.", "Cada agente se entrenó con marcos de rendimiento: DOMINO, PLF, CBO y más."],
  ];
  const items = [
    { icon: <Brain className="h-5 w-5" />, title: "IA de Verdade", desc: "Claude, GPT-5.5 e Gemini trabalhando juntos — cada agente no seu modelo ideal." },
    { icon: <Shield className="h-5 w-5" />, title: "LGPD & Compliance", desc: "Trilha de auditoria completa, consentimento automático e conformidade em cada ação." },
    { icon: <Cpu className="h-5 w-5" />, title: "Infraestrutura Sólida", desc: "BullMQ, Socket.io em tempo real, PostgreSQL e Redis — arquitetura de nível enterprise." },
    { icon: <Target className="h-5 w-5" />, title: "Foco em Resultado", desc: "Cada agente foi treinado com frameworks de performance — DOMINO, PLF, CBO e mais." },
  ];

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <h2 className="font-mono font-black text-3xl sm:text-4xl uppercase text-white tracking-tight">
              {t("Por que NexOS?", "Why NexOS?", "¿Por qué NexOS?")}
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map((item, i) => (
            <FadeIn key={item.title} delay={i * 100}>
              <div className="flex gap-5 p-6 border border-white/8 bg-white/[0.02]">
                <div className="shrink-0 p-2 bg-purple-500/15 text-purple-400 h-fit">{item.icon}</div>
                <div>
                  <h3 className="font-mono font-bold text-sm text-white uppercase tracking-wide mb-2">{t(item.title, diferencialCopy[i][0], diferencialCopy[i][1])}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{t(item.desc, diferencialCopy[i][2], diferencialCopy[i][3])}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContatoSection() {
  const t = useUiText();
  return (
    <section id="contato" className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-purple-400 mb-4">{t("Contato", "Contact", "Contacto")}</div>
          <h2 className="font-mono font-black text-3xl sm:text-5xl uppercase text-white tracking-tight mb-6">
            {t("Pronto para", "Ready to", "¿Listo para")}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              {t("operar em modo autônomo?", "operate autonomously?", "operar de forma autónoma?")}
            </span>
          </h2>
          <p className="text-white/45 text-base max-w-xl mx-auto mb-10">
            {t("Fale com nossa equipe para entender qual solução faz mais sentido para o seu negócio.", "Talk to our team to find the right solution for your business.", "Habla con nuestro equipo para descubrir qué solución se adapta mejor a tu negocio.")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {[
              {
                icon: <MessageCircle className="h-5 w-5 text-green-400" />,
                label: "WhatsApp",
                 value: t("Falar no WhatsApp", "Chat on WhatsApp", "Hablar por WhatsApp"),
                href: "https://wa.me/55",
                color: "border-green-500/20 hover:border-green-500/40",
              },
              {
                icon: <Instagram className="h-5 w-5 text-pink-400" />,
                label: "Instagram",
                value: "@nexos.ai",
                href: "https://instagram.com/nexos.ai",
                color: "border-pink-500/20 hover:border-pink-500/40",
              },
              {
                icon: <Mail className="h-5 w-5 text-purple-400" />,
                label: "E-mail",
                value: "contato@nexos.ai",
                href: "mailto:contato@nexos.ai",
                color: "border-purple-500/20 hover:border-purple-500/40",
              },
            ].map(c => (
              <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                className={`border ${c.color} bg-white/[0.03] hover:bg-white/[0.06] p-5 flex flex-col items-center gap-2 transition-all duration-300`}>
                {c.icon}
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{c.label}</div>
                <div className="font-mono text-sm text-white/70">{c.value}</div>
              </a>
            ))}
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-8">
            <h3 className="font-mono font-bold text-white uppercase tracking-wide mb-6 text-sm">{t("Acesso rápido aos produtos", "Quick access to products", "Acceso rápido a los productos")}</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/landing/">
                <Button className="bg-purple-600 hover:bg-purple-500 text-white font-mono uppercase text-xs tracking-widest rounded-none h-10 px-6 gap-2">
                  <Rocket className="h-3.5 w-3.5" /> NexOS AI
                </Button>
              </a>
              <a href="/nexos-academy/">
                <Button className="bg-yellow-600 hover:bg-yellow-500 text-black font-mono uppercase text-xs tracking-widest font-bold rounded-none h-10 px-6 gap-2">
                  <GraduationCap className="h-3.5 w-3.5" /> Academy
                </Button>
              </a>
              <a href="/login">
                <Button variant="outline" className="border-white/20 text-white/60 hover:text-white hover:border-white/40 font-mono uppercase text-xs tracking-widest rounded-none h-10 px-6 gap-2 bg-transparent">
                   <Users className="h-3.5 w-3.5" /> {t("Entrar na plataforma", "Sign in to the platform", "Entrar a la plataforma")}
                </Button>
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Footer() {
  const t = useUiText();
  return (
    <footer className="border-t border-white/10 py-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/nexos-logo.png" alt="NexOS" className="h-7 w-7 object-contain opacity-50" />
          <div className="font-mono text-xs text-white/25 uppercase tracking-[0.2em]">NexOS AI © 2026</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] text-white/25 uppercase tracking-widest">
          <a href="/landing/" className="hover:text-white/50 transition-colors">NexOS AI</a>
          <a href="/nexos-academy/" className="hover:text-white/50 transition-colors">Academy</a>
          <a href="/login" className="hover:text-white/50 transition-colors">{t("Entrar", "Sign in", "Entrar")}</a>
          <a href="/landing/privacy" className="hover:text-white/50 transition-colors">{t("Privacidade", "Privacy", "Privacidad")}</a>
          <a href="/landing/terms" className="hover:text-white/50 transition-colors">{t("Termos", "Terms", "Términos")}</a>
        </div>
      </div>
    </footer>
  );
}

export default function InstitucionalPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#04060f] text-white">
      <Nav scrolled={scrolled} />
      <HeroSection />
      <ProdutosSection />
      <ServicosSection />
      <AcademySection />
      <DiferencialSection />
      <ContatoSection />
      <Footer />
    </div>
  );
}
