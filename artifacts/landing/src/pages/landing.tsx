import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { LANG_LABELS, useI18n, type Lang } from "@/lib/i18n";
import {
  ArrowRight, Users, Video, Workflow,
  Activity, Target, Layers, Lock, ShieldCheck, Search, Megaphone, ChevronDown, CheckCircle2
} from "lucide-react";

export default function LandingPage() {
  const { lang } = useI18n();
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (!window.location.hash) return;
    requestAnimationFrame(() => {
      document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" });
    });
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
    "pt-BR": { tagline: "Agência Autônoma", login: "Entrar", open: "Reservar vaga", closed: "Vagas esgotadas" },
    "en-US": { tagline: "Autonomous Agency", login: "Log in", open: "Reserve a spot", closed: "Spots sold out" },
    "es-LA": { tagline: "Agencia autónoma", login: "Iniciar sesión", open: "Reservar lugar", closed: "Cupos agotados" },
  }[lang];
  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between border-x-2 border-border bg-background">
        <div className="flex items-center gap-4">
          <img src="/nexos_ai_logo_1024x1024.png" alt="NexOS" className="h-10 w-10 object-contain" />
          <div className="hidden sm:block">
            <div className="font-display font-black text-2xl tracking-tighter uppercase leading-none">NEXOS</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{navCopy.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" aria-label={navCopy.login} data-testid="nav-login-link" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hidden sm:block transition-colors font-bold">
            [ {navCopy.login} ]
          </Link>
          <div className="flex items-center gap-1 border border-border/60 p-1" role="group" aria-label="Language">
            {(Object.keys(LANG_LABELS) as Lang[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setLang(option)}
                aria-label={`Switch language to ${LANG_LABELS[option].label}`}
                aria-pressed={lang === option}
                className={`px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
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
            className="font-mono text-xs uppercase tracking-widest font-bold h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-none"
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
      badge: "FROM IDEA TO LIVE OPERATION", h1a: "Stop hiring separate pieces", h1b: "to execute an entire", h1c: "strategy.", body: "Your idea leaves the page and becomes an action plan guided by market intelligence and continuous competitor monitoring — building a real digital presence within hours. NexOS takes on the expensive, technical, fragmented execution to move your operation forward end to end.",
      line: "From idea to plan. From plan to assets. From assets to a live operation.", primary: "Put my idea into motion", secondary: "See the real work", closed: "Initial cohort closed", access: "ACCESS RULES: ONLY 100 SPOTS AVAILABLE AT PRE-LAUNCH."
    },
    "es-LA": {
      badge: "DE LA IDEA A LA OPERACIÓN EN MARCHA", h1a: "Deja de contratar piezas", h1b: "para ejecutar una", h1c: "estrategia completa.", body: "Tu idea sale del papel y se convierte en un plan de acción guiado por inteligencia de mercado y seguimiento continuo de la competencia — creando una presencia digital real en pocas horas. NexOS asume la ejecución costosa, técnica y fragmentada para poner tu operación en marcha de principio a fin.",
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
  {
    marker: "01 / CURSOS",
    title: "Você aprendeu a estratégia. A campanha nunca saiu do rascunho.",
    body: "Módulos assistidos, anotações prontas, frameworks salvos. Mas ainda faltam a oferta, a copy, os criativos, a página, os anúncios e alguém capaz de fazer tudo conversar."
  },
  {
    marker: "02 / TRÁFEGO",
    title: "Você sabe que precisa anunciar. Só não pode pagar para aprender errando.",
    body: "Configurar conta, pixel, público, criativo, verba e remarketing ao mesmo tempo transforma cada clique em risco. O medo de queimar dinheiro paralisa antes do primeiro teste."
  },
  {
    marker: "03 / AGÊNCIA",
    title: "Uma agência resolveria. Se coubesse no caixa de quem ainda nem lançou.",
    body: "Estrategista, copywriter, designer, editor, gestor de tráfego e CRM separados custam antes de gerar a primeira venda — e ainda deixam você responsável por coordenar todos eles."
  },
  {
    marker: "04 / RENDA ONLINE",
    title: "Você enxerga pessoas monetizando. Não enxerga como replicar a máquina.",
    body: "Curso, comunidade, canal, consultoria, infoproduto: o modelo parece simples quando está pronto. Por trás dele existe uma operação inteira que ninguém mostra funcionando em conjunto."
  }
];

function ExecutionGapSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  return (
    <section className="border-b-2 border-border bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="px-6 py-24 sm:py-32 lg:border-r-2 border-border bg-primary text-primary-foreground flex flex-col justify-between gap-16">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] font-bold mb-8">O problema não é falta de informação</div>
            <h2 className="text-5xl sm:text-7xl font-display font-black uppercase tracking-tighter leading-[0.92]">
              Você não precisa de mais um curso.
            </h2>
            <p className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-tight mt-8 border-t-2 border-primary-foreground/30 pt-8">
              Precisa de uma operação que faça.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-widest leading-relaxed max-w-md opacity-80">
            A distância entre “eu sei o que deveria fazer” e “minha campanha está vendendo” é execução.
          </div>
        </div>

        <div className="bg-card">
          {executionPains.map((pain) => (
            <article key={pain.marker} className="p-7 sm:p-10 border-b-2 last:border-b-0 border-border group hover:bg-background transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">{pain.marker}</div>
              <h3 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight leading-tight max-w-3xl">
                {pain.title}
              </h3>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mt-4 max-w-3xl">{pain.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:items-center px-6 py-12 sm:px-10 bg-foreground text-background">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest font-bold mb-3">Condição de abertura</div>
          <p className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight max-w-4xl">
            Coloque a ideia em produção agora e pague parcelado no cartão.
          </p>
          <p className="font-sans mt-3 text-background/70 max-w-3xl">
            A NexOS estrutura e executa a operação completa. Pagamento parcelado no cartão. Consulte as condições disponíveis no checkout.
          </p>
        </div>
        <Button onClick={openCapture} className="h-16 px-8 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-display font-black uppercase tracking-wide">
          {closed ? "Turma encerrada" : "Quero colocar no ar"} <ArrowRight className="ml-3 h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

function RealWorkSection() {
  return (
    <section id="trabalho-concreto" className="py-24 sm:py-32 border-b-2 border-border relative bg-card scroll-mt-20">
      <div className="px-6">
        <div className="mb-16">
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">A solução não é outra aula</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight max-w-4xl">
            Você chega com a ideia. A NexOS constrói e opera o que faltava.
          </p>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Não entregamos um plano para você montar sozinho. Entregamos a pesquisa, a oferta, os ativos, a infraestrutura, a distribuição e o acompanhamento funcionando como uma única operação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[2px] border-2 border-border bg-border">
          <WorkCard
            number="01"
            title="Inteligência & Oferta"
            desc="Transforma sua ideia em uma oferta vendável: encontra a dor, estuda o mercado, mapeia concorrentes e estrutura promessa, preço, bônus, objeções e ganchos para a campanha."
            icon={<Search className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="02"
            title="Produção de Vídeo"
            desc="Você não precisa virar editor nem montar um estúdio. A NexOS roteiriza, produz, corta e renderiza vídeos usando gravações reais ou produção autônoma com voz e avatar."
            icon={<Video className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="03"
            title="Landings & Criativos"
            desc="Não entrega um wireframe. Registra o domínio, escreve a copy, desenha a página, conecta a captura, produz os criativos e coloca tudo no ar."
            icon={<Layers className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="04"
            title="Tráfego Pago Multi-Canal"
            desc="Tira a campanha do gerenciador e coloca em circulação: cria públicos, sobe anúncios, testa criativos, acompanha verba e pausa o que não responde — dentro das suas regras."
            icon={<Target className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="05"
            title="Distribuição Orgânica & Grupos"
            desc="Converte uma ideia em presença contínua: publica, aquece, responde e modera canais e comunidades sem deixar todo o calendário depender da sua energia."
            icon={<Megaphone className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="06"
            title="Vendas & Retenção"
            desc="A venda não termina no checkout. Acompanha leads no CRM, recupera abandonos, recebe compradores, conduz onboarding, trabalha retenção e ativa indicações."
            icon={<Users className="w-8 h-8 text-primary" />}
          />
        </div>
      </div>
    </section>
  );
}

function WorkCard({ number, title, desc, icon }: any) {
  return (
    <div className="bg-background p-8 flex flex-col group hover:bg-card transition-colors">
      <div className="flex justify-between items-start mb-12">
        <span className="font-mono text-4xl font-black text-muted-foreground/30 group-hover:text-primary transition-colors">{number}</span>
        {icon}
      </div>
      <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-4">{title}</h3>
      <p className="text-muted-foreground font-sans text-base leading-relaxed">{desc}</p>
    </div>
  );
}

const archSteps = [
  {
    id: "niche",
    title: "Pesquisa de Nicho e Análise de Concorrentes",
    status: "Concluído",
    sees: "Avaliações de concorrentes, debates em redes sociais, tendências de busca e buracos em produtos similares.",
    decides: "A dor exata não resolvida e o perfil do comprador mais propenso à conversão imediata.",
    creates: "Matrizes de objeções, relatórios de inteligência de mercado e mapas de empatia operacionais.",
    publishes: "Consolida as diretrizes no Dossiê interno, proibindo que agentes assumam premissas genéricas.",
    measures: "Densidade da demanda, sofisticação do mercado e viabilidade."
  },
  {
    id: "offer",
    title: "Definição de Oferta e Ganchos (War Room)",
    status: "Concluído",
    sees: "O Dossiê validado cruzado com o seu histórico real de campanhas e custos de aquisição passados.",
    decides: "A promessa central irrecusável, bônus para elevar ticket, ancoragem de preço e ângulos de vendas (ganchos).",
    creates: "Estruturas argumentativas completas para VSLs, páginas de vendas e anúncios.",
    publishes: "Deixa a arquitetura de persuasão pronta para ser materializada nos formatos finais.",
    measures: "Alinhamento lógico com objeções e coerência com a política da marca."
  },
  {
    id: "creative",
    title: "Copy, Design e Renderização Audiovisual",
    status: "Ativo",
    highlight: true,
    sees: "Os ganchos definidos, o tom de voz imutável do Dossiê e o pacote visual da sua empresa.",
    decides: "Quais formatos (estático, reel vertical, página longa) entregam a oferta com mais eficácia.",
    creates: "Copy impecável, interfaces otimizadas, e vídeos 100% renderizados na nossa GPU (via vozes clonadas ou avatares).",
    publishes: "Registra os domínios, aponta servidores DNS e coloca a landing page no ar sem fricção humana.",
    measures: "Velocidade da página (LCP), coesão visual e retenção estimada."
  },
  {
    id: "distribution",
    title: "Distribuição Orgânica e Grupos",
    status: "Ativo",
    sees: "Picos de engajamento do seu nicho, algoritmos de distribuição e interações pendentes das comunidades.",
    decides: "A ordem de publicação, as respostas certas em direct e como moderar o aquecimento de um grupo.",
    creates: "Legendas precisas, interações de moderação em WhatsApp/Telegram e alertas automáticos.",
    publishes: "Executa os posts em todas as redes orgânicas vinculadas nos horários estipulados.",
    measures: "Crescimento de base, taxa de respostas orgânicas e retenção nos grupos de lançamento."
  },
  {
    id: "ads",
    title: "Operação de Tráfego Pago",
    status: "Ativo",
    sees: "Os criativos recém-produzidos, a landing ativa, os públicos do pixel e as regras de orçamento diário.",
    decides: "Onde testar a verba primeiro (CBO/ABO), pausas de criativos fadigados e realocações de lances.",
    creates: "Estruturas completas de campanha nas plataformas de anúncio mais rentáveis para a oferta.",
    publishes: "Ativa publicações patrocinadas conectadas ao seu cartão de crédito nas redes de pesquisa e social.",
    measures: "CPA real, ROAS, fadiga de criativos e CTR cruzado (direto nos dashboards oficiais)."
  },
  {
    id: "crm",
    title: "Vendas, Retenção e Onboarding",
    status: "Ativo",
    sees: "Leads quentes, eventos de abandono de carrinho, compras confirmadas e conversas interrompidas.",
    decides: "A hora exata de invocar recuperação ativa, quebrar a objeção que falta ou dar boas-vindas VIP.",
    creates: "Fluxos invisíveis de e-mail marketing, disparos via WhatsApp e alertas de alta prioridade.",
    publishes: "Envia comunicações 1-a-1 diretamente para a base, sustentando o LTV do cliente a longo prazo.",
    measures: "Taxa de recuperação, churn, engajamento com onboarding e vendas cruzadas (upsell)."
  }
];

function ArchitectureSection() {
  const [activeStep, setActiveStep] = useState<string | null>(null);

  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-background">
      <div className="px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="lg:sticky lg:top-32">
            <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">A Quebra de Silos</h2>
            <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight mb-8">
              Seu projeto não travou por falta de potencial. Travou porque você virou o operador de cinco profissões.
            </p>
            <div className="space-y-6 text-lg text-muted-foreground font-sans">
              <p>Você deveria decidir o que quer construir. Em vez disso, tenta aprender copy, design, edição, tráfego, automação e vendas ao mesmo tempo.</p>
              <p>O custo real não está só nas ferramentas. Está nos meses sem publicar, no anúncio que nunca foi testado e na oferta que continua dentro de um documento.</p>
              <p>Com a NexOS, o cérebro é unificado e <strong className="text-foreground">autônomo</strong>.</p>
              <p>A inteligência orienta o texto. O estrategista instrui a renderização, que sobe as páginas online e entrega os vídeos ao tráfego. Toda a operação consome a mesma matriz — executando a campanha inteira sem você precisar intervir a cada etapa.</p>
              <p className="font-mono text-xs uppercase tracking-widest text-primary pt-4 hidden lg:block animate-pulse">
                [ Selecione um nó operacional ao lado para inspecionar ]
              </p>
            </div>
          </div>

          <div className="relative border-2 border-border p-4 sm:p-8 bg-card">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b-2 border-l-2 border-border bg-background hidden sm:block">
              Arquitetura Operacional
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

function ArchNode({ step, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-2 p-4 flex flex-col gap-2 transition-colors focus:outline-none focus:border-primary ${step.highlight ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border bg-background hover:bg-card'} ${isActive ? 'border-primary' : ''}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
        <span className="font-display font-bold uppercase tracking-tight text-foreground">{step.title}</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 ${step.highlight ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <span className={`font-mono text-[10px] uppercase font-bold tracking-widest ${step.highlight ? 'text-primary' : 'text-muted-foreground'}`}>{step.status}</span>
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
                 <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">Observa</span>
                 <span className="text-foreground/90">{step.sees}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                 <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">Decide</span>
                 <span className="text-foreground/90">{step.decides}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                 <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">Cria</span>
                 <span className="text-foreground/90">{step.creates}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                 <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-widest pt-1">Executa</span>
                 <span className="text-foreground/90 font-medium">{step.publishes}</span>
               </div>
               <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-4">
                 <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-1">Mede</span>
                 <span className="text-foreground/90">{step.measures}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function OperationalScopeSection() {
  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-card">
      <div className="px-6">
        <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-12 font-bold text-center">Governança Integrada</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-2 border-border bg-background p-8">
            <ShieldCheck className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">Autorização Estrita</h3>
            <p className="text-muted-foreground font-sans">
              As ações externas (publicar posts, subir campanhas de tráfego, enviar e-mails) só acontecem após sua aprovação ou dentro de limites pré-estabelecidos por você.
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Workflow className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">Workspaces Isolados</h3>
            <p className="text-muted-foreground font-sans">
              Perfeito para separar múltiplos produtos e serviços da mesma empresa, ou isolar clientes de agências. Os dados, a inteligência e as estratégias nunca se misturam.
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Activity className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">Métricas Reais. Fim.</h3>
            <p className="text-muted-foreground font-sans">
              O sistema baseia-se em dados empíricos puxados diretamente de canais reais de tráfego e do seu CRM. Nenhuma IA inventando números de conversão para o painel parecer completo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofOfLogicSection() {
  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-background">
      <div className="px-6">
        <div className="max-w-4xl mb-16">
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">Lógica de Execução e Coerência</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight">
            Como garantimos que a autonomia não crie um frankenstein de IA genérica.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">1. O Cérebro Único (Dossiê)</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Modelos rasos cometem erros de lógica e causam contradições bizarras. A NexOS resolve isso criando um Dossiê mestre imutável para a campanha. O mesmo arquivo de regras bloqueia o roteirista de vídeo, baliza o copywriter e dita o tom dos anúncios — evitando saídas genéricas.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">2. Autonomia com Trava de Segurança</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Você pode automatizar a publicação a 100% ou exigir revisão. A NexOS desenha a página, edita os vídeos, formata os anúncios e prepara as postagens. Eles vão ao ar e o domínio é registrado assim que você dá o seu "Aprovado" — sem exigir o trabalho braçal de montar a peça na ferramenta.
              </p>
            </div>
          </div>

          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">3. Fim das Decisões Ruins</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                IAs tradicionais falham por não verem o quadro inteiro. Quando a agência autônoma relata que um criativo saturou e decide pausá-lo nas redes, ela cruzou o CTR de cliques reais com as conversões no seu CRM. Nenhuma decisão superficial é tomada sem cruzamento de dados empíricos.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">4. Memória Institucional Ativa</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Repetições maçantes acontecem quando a IA perde o contexto. A NexOS armazena vencedores, perdedores e lições aprendidas. O erro e a objeção que não funcionaram no mês passado já estão internalizados como regras de restrição permanente para a campanha atual.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScarcitySection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  return (
    <section className="py-32 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />

      <div className="px-6 relative z-10 max-w-4xl mx-auto text-center">
        <Lock className="w-16 h-16 mx-auto mb-8" />
        <h2 className="text-4xl sm:text-6xl font-display font-black uppercase tracking-tighter leading-none mb-8">
          Apenas 100 Operações no Lançamento.
        </h2>
        <p className="text-xl font-sans font-medium mb-12 opacity-90 max-w-2xl mx-auto">
          Se o que impediu você até agora foi o custo e a complexidade de montar uma agência inteira, esta abertura foi desenhada para remover esse bloqueio: execução ponta a ponta e pagamento parcelado no cartão. Você confere as opções e escolhe a melhor condição no checkout. O acesso inicial é restrito. Não há exceções.
        </p>

        <Button
          onClick={openCapture}
          className="h-20 px-12 text-lg font-display font-black rounded-none bg-background text-foreground hover:bg-muted-foreground hover:text-background transition-colors uppercase tracking-widest border-2 border-background"
        >
          {closed ? "Turma Encerrada" : "Reservar Minha Vaga Agora"}
        </Button>

        <div className="mt-8 font-mono text-sm font-bold uppercase tracking-widest opacity-80">
          {closed ? "As vagas foram preenchidas." : "A ordem de reserva define a prioridade de ativação."}
        </div>

        <div className="mt-16 pt-8 border-t-2 border-primary-foreground/20">
          <p className="font-display font-bold text-2xl uppercase tracking-tight mb-3">
            Esta landing page foi criada e colocada no ar pelos agentes da NexOS.
          </p>
          <p className="font-sans font-medium text-lg opacity-90">
            Entre na lista agora e acesse nosso grupo para ver a operação acontecendo nos bastidores.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-border bg-background py-12 px-6 text-center sm:text-left">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <img src="/nexos_ai_logo_1024x1024.png" alt="NexOS" className="h-8 w-8 object-contain" />
          <span className="font-display font-black text-xl uppercase tracking-tighter text-muted-foreground">NexOS</span>
        </div>

        <div className="flex gap-6 font-mono text-xs uppercase tracking-widest font-bold text-muted-foreground">
          <Link href="/terms" className="hover:text-primary transition-colors">Termos de Uso</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacidade</Link>
          <Link href="/data-deletion" className="hover:text-primary transition-colors">Exclusão de Dados</Link>
        </div>

        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} NexOS. Operação Centralizada.
        </div>
      </div>
    </footer>
  );
}

const glp22Phases = [
  {
    phase: "Fase 01 / Estratégia e Fundações",
    title: "Onde o achismo termina e a inteligência de mercado começa.",
    items: [
      { id: "01", title: "Imersão e intake", desc: "Coleta profunda da sua visão, objetivos e restrições para balizar a operação sem recorrer a premissas genéricas." },
      { id: "02", title: "Inteligência e análise de mercado", desc: "Mapeamento ativo da concorrência e do ambiente competitivo para encontrar brechas de atenção, demandas ocultas e padrões de mercado." },
      { id: "03", title: "Avatar, segmentação e jornada", desc: "Definição clara do cliente ideal e desenho do caminho exato que ele percorre do primeiro contato até o momento da decisão." },
      { id: "04", title: "Posicionamento, mecanismo e narrativa", desc: "Construção de uma tese única e argumentação central que diferenciem sua mensagem da comoditização do nicho." },
      { id: "05", title: "Engenharia da oferta", desc: "Estruturação de preço, ancoragem, quebra de objeções, garantias e bônus para criar uma proposta comercial robusta." },
      { id: "06", title: "Arquitetura estratégica do lançamento", desc: "Desenho do formato e do modelo de vendas mais adequados, estipulando cronograma, eventos e pontos de contato da campanha." },
      { id: "07", title: "Master Plan", desc: "Consolidação de todas as diretrizes em um documento mestre, alinhando a execução autônoma em torno do mesmo objetivo." }
    ]
  },
  {
    phase: "Fase 02 / Criação e Ativos Visuais",
    title: "Da arquitetura conceitual para interfaces e roteiros focados em conversão.",
    items: [
      { id: "08", title: "Construção do funil", desc: "Desenho prático da estrutura de aquisição e qualificação, conectando os passos da jornada de compra de forma fluida." },
      { id: "09", title: "Copy", desc: "Redação persuasiva de cartas de vendas, anúncios e scripts visuais, orquestrada para respeitar o tom de voz definido no Master Plan." },
      { id: "10", title: "Direção criativa e produção visual", desc: "Desenvolvimento da identidade visual da campanha e desdobramento em peças gráficas e banners padronizados para todos os canais." },
      { id: "11", title: "Direção e produção de vídeos", desc: "Roteirização e renderização dinâmica de VSLs, anúncios e conteúdos audiovisuais voltados a reter a atenção nos segundos cruciais." },
      { id: "12", title: "Páginas e ativos digitais", desc: "Implementação de landing pages desenhadas para conversão e performance de carregamento, prontas para receber tráfego." }
    ]
  },
  {
    phase: "Fase 03 / Infraestrutura e Engajamento",
    title: "Sistemas técnicos, gestão de audiência e comunicação orgânica.",
    items: [
      { id: "13", title: "Infraestrutura, tracking e integrações", desc: "Configuração técnica de pixels, tags e fluxos de dados, além de apoio em domínios e hospedagem (serviços faturados diretamente pelos fornecedores escolhidos)." },
      { id: "14", title: "CRM, gestão de leads, grupos e comunidades", desc: "Estruturação das bases de contatos e organização de ambientes de aquecimento para centralizar a comunicação com os interessados." },
      { id: "15", title: "Presença Digital e audiência", desc: "Programação e controle de postagens para manter consistência nos perfis sociais, aproveitando os algoritmos de descoberta." },
      { id: "16", title: "E-mail, mensagens e nutrição", desc: "Desenvolvimento de sequências de comunicação ativa e fluxos automatizados para elevar o nível de consciência dos leads." }
    ]
  },
  {
    phase: "Fase 04 / Aquisição e Vendas",
    title: "Geração de tráfego, orquestração e recuperação de receita.",
    items: [
      { id: "17", title: "Mídia paga", desc: "Planejamento e gestão de campanhas publicitárias com distribuição de verba em criativos e públicos que apresentam o melhor custo por aquisição." },
      { id: "18", title: "Execução coordenada do lançamento", desc: "Sincronização de todos os canais, e-mails, grupos e anúncios nos dias-chave da campanha para um fluxo de aberturas de carrinho alinhado." },
      { id: "19", title: "Atendimento, vendas e conversão", desc: "Atuação voltada para recuperação de boletos/Pix, carrinhos abandonados e quebra de objeções de última hora, maximizando a receita aprovada." }
    ]
  },
  {
    phase: "Fase 05 / Dados e Continuidade",
    title: "Leitura de métricas, aprendizado institucional e próximos passos.",
    items: [
      { id: "20", title: "Monitoramento e otimização", desc: "Acompanhamento e leitura contínua de métricas reais para possibilitar ajustes finos e proteção de orçamento ao longo da campanha." },
      { id: "21", title: "Pós-lançamento e aprendizado", desc: "Consolidação de dados de performance em inteligência institucional, registrando o que converteu melhor e mapeando novas objeções." },
      { id: "22", title: "Continuidade, relançamento e perpétuo", desc: "Transformação da inteligência acumulada em novas esteiras de vendas e adaptação do produto para campanhas sucessivas ou recorrência." }
    ]
  }
];

function GLP22Section() {
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
              <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold">O Método GLP22</span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black uppercase tracking-tighter leading-tight mb-8">
              A Engenharia de uma <span className="text-primary">Operação Autônoma.</span>
            </h2>

            <div className="space-y-6 text-lg text-background/70 font-sans mb-12">
              <p>Não é um pacote de ferramentas. É o fluxo contínuo de 22 capacidades interdependentes — da ideia embrionária à escala de vendas.</p>
              <p>Cada etapa alimenta a próxima. O estrategista instrui a copy, a copy orienta o design, o design alimenta o tráfego. Tudo orquestrado por uma inteligência central, sem gaps de execução.</p>
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
                  <span>{phase.phase.split(' / ')[0]}</span>
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
                  {phase.phase.split(' / ')[0]}
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
                      {glp22Phases[activePhaseIndex].phase.split(' / ')[1]}
                    </span>
                    <h3 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
                      {glp22Phases[activePhaseIndex].title}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {glp22Phases[activePhaseIndex].items.map((item) => {
                      const isExpanded = expandedItems.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`border-2 transition-colors ${isExpanded ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="w-full text-left p-5 flex items-center justify-between gap-4 focus:outline-none"
                          >
                            <div className="flex items-center gap-4 sm:gap-6">
                              <span className="font-mono text-sm sm:text-base font-bold text-muted-foreground w-6">
                                {item.id}
                              </span>
                              <span className="font-display font-bold text-lg sm:text-xl uppercase tracking-tight">
                                {item.title}
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
                                      {item.desc}
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
