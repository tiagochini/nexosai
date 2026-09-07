import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, Users, Video, Workflow, BookOpen, Globe, Database,
  ShieldCheck, Zap, Activity, Target, ShieldAlert, Fingerprint,
  Layers, LockKeyhole, RefreshCcw, Lock, Infinity as InfinityIcon, HelpCircle,
  TrendingUp, MonitorPlay, Presentation
} from "lucide-react";
import { Link } from "wouter";

export default function LandingPage() {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [closed, setClosed] = useState(false);
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
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col selection:bg-primary/30 scroll-smooth">
      <Background />
      <Nav openCapture={openCapture} closed={closed} />

      <main className="flex-1">
        <HeroSection openCapture={openCapture} closed={closed} />
        <PainSection />
        <MechanismSection />
        <TransformationSection openCapture={openCapture} closed={closed} />
        <BreadthSection />
        <OperationalProofSection />
        <CommercialSection />
        <ObjectionSection />
        <AnticipationSection />
        <CtaSection openCapture={openCapture} closed={closed} />
      </main>

      <Footer />
      <LeadCaptureModal open={isCaptureOpen} onClose={closeCapture} closed={closed} onCapacityReached={handleCapacityReached} />
    </div>
  );
}
function Background() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-background">
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-primary/10 blur-[140px] rounded-full mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-secondary/10 blur-[130px] rounded-full mix-blend-screen" />
      <div className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] bg-accent/5 blur-[100px] rounded-full mix-blend-screen" />
      <div className="noise-overlay" />
    </div>
  );
}

function Nav({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={nexosLogo} alt="NexOS" className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]" />
          <div className="hidden sm:block">
            <div className="font-sans font-bold text-xl tracking-wide uppercase">NexOS</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary/80">Sistema Operacional</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" aria-label="Entrar no sistema" data-testid="nav-login-link" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hidden sm:block transition-colors">
            Entrar
          </Link>
          <Button onClick={openCapture} aria-label="Entrar na Lista de Abertura" data-testid="nav-guide-button" className="font-mono text-xs uppercase tracking-widest font-bold h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all rounded-md">
            {closed ? "Turma inicial encerrada" : "Lista de Abertura"}
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  const scrollToMechanism = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    document.getElementById('mecanismo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center pt-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-8 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
            <span className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Sistema Operacional Comercial
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-sans font-black leading-[1.05] tracking-tight mb-8">
            Pare de contratar partes<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent pb-2">
              para executar uma estratégia inteira.
            </span>
          </h1>

          <p className="text-lg sm:text-2xl text-muted-foreground max-w-2xl leading-relaxed mb-12 font-light">
            Sua decisão de negócio não pode se perder na troca de mãos. Da inteligência à retenção, a primeira operação comercial centralizada onde a execução nunca dilui a sua visão.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={openCapture} aria-label="Entrar na Lista de Abertura" data-testid="hero-cta-button" className="h-14 px-8 text-sm sm:text-base font-bold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all font-sans tracking-wide">
              {closed ? "Turma inicial encerrada" : "Reservar vaga inicial"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={scrollToMechanism} aria-label="Ver como a operação funciona" className="h-14 px-8 text-sm sm:text-base font-semibold rounded-lg border-border bg-card/30 hover:bg-card hover:border-primary/50 transition-all text-foreground backdrop-blur-md">
              Ver como a operação funciona
            </Button>
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {closed
              ? "As 100 vagas iniciais foram encerradas. Reabertura sem data prevista; condições atuais podem não permanecer."
              : "A abertura inicial terá apenas 100 vagas de pré-lançamento."}
          </p>
        </motion.div>
      </div>

      <div className="absolute right-[-15%] top-[10%] w-[70%] h-[90%] pointer-events-none opacity-30 mix-blend-screen hidden lg:block">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(138,43,226,0.15)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_60%)] animate-[pulse_6s_ease-in-out_infinite]" />
      </div>
    </section>
  );
}

function PainSection() {
  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-destructive mb-6">A Exaustão da Fragmentação</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-bold leading-tight mb-8">
              Você é o gargalo que <br />
              <span className="text-destructive">traduz a mesma estratégia</span><br />
              para cinco áreas diferentes.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 font-light">
              O custo real da sua operação não está nas mensalidades. Está na perda de tração diária. O trabalho braçal para cobrir os buracos da operação está devorando a sua margem de lucro e a sua energia como fundador.
            </p>
            <div className="space-y-5 border-l border-border/50 pl-6 ml-2">
              {[
                "A agência terceirizada que não entende o produto ou erra o tom da marca.",
                "O e-mail de vendas que dispara fora de sincronia com o anúncio atual.",
                "O gestor de tráfego operando às cegas sem retroalimentação do seu CRM.",
                "Dezenas de assinaturas de software isolados cobrando por assento."
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0 shadow-[0_0_8px_rgba(255,51,102,0.8)]" />
                  <span className="font-mono text-sm sm:text-base text-foreground/80 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent blur-3xl rounded-full" />
            <div className="relative border border-border/60 bg-card/40 backdrop-blur-xl rounded-3xl p-8 sm:p-12 overflow-hidden shadow-2xl">
               <div className="flex flex-col gap-6">
                 <BrokenNode title="Agência & Freelancers" delay={0} />
                 <BrokenNode title="Plataformas de Anúncios" delay={0.2} />
                 <BrokenNode title="Disparos e Automações" delay={0.4} />
               </div>
               <div className="mt-8 pt-8 border-t border-border/50 text-center">
                 <p className="font-mono text-xs uppercase tracking-widest text-destructive font-semibold">
                   Toda troca de mãos dilui a conversão
                 </p>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function BrokenNode({ title, delay }: { title: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.4, x: 10 }}
      animate={{ opacity: [0.4, 1, 0.4], x: [10, 0, 10] }}
      transition={{ duration: 5, repeat: Infinity, delay, ease: "easeInOut" }}
      className="flex items-center justify-between border border-destructive/20 bg-destructive/5 p-5 rounded-xl backdrop-blur-sm"
    >
      <span className="font-sans font-semibold text-foreground">{title}</span>
      <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1 rounded-full">
        <Activity className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-wider font-bold">Desconectado</span>
      </div>
    </motion.div>
  )
}

function MechanismSection() {
  return (
    <section className="py-32 relative bg-card/10 border-y border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
          >
            <div id="mecanismo" className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6 scroll-mt-32">
              A Transição Operacional
            </div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-8">
              Do sinal do mercado à<br />
              <span className="text-primary">campanha pronta para aprovação.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 font-light">
              Uma decisão. Um contexto. Toda a operação na mesma direção. Em vez de operar painéis vazios e gerenciar pessoas que não conversam entre si, o NexOS unifica o cérebro da operação.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed font-light">
              Os 64 agentes operacionais compartilham a mesma inteligência de mercado. A pesquisa consolidada orienta o texto. O estrategista instrui o copywriter, que entrega o material ao gestor de tráfego e atualiza o conhecimento do SDR de ponta a ponta.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="grid grid-cols-2 gap-4 relative"
          >
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/30 z-0">
                <InfinityIcon className="w-32 h-32" />
             </div>
             {[
               { title: "Inteligência Ativa", icon: <Globe className="w-5 h-5" /> },
               { title: "Definição de Oferta", icon: <Target className="w-5 h-5" /> },
               { title: "Mídia & Distribuição", icon: <TrendingUp className="w-5 h-5" /> },
               { title: "Fechamento (CRM)", icon: <Users className="w-5 h-5" /> }
             ].map((node, i) => (
                <div key={i} className="border border-primary/20 bg-card/80 p-6 rounded-2xl flex flex-col items-center justify-center text-center z-10 backdrop-blur-md hover:border-primary/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                    {node.icon}
                  </div>
                  <span className="font-sans font-bold text-sm text-foreground">{node.title}</span>
                </div>
             ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TransformationSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-secondary mb-6">O Novo Padrão Executivo</div>
          <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
            Você Define a Direção.<br />O Sistema Entrega o Restante.
          </h2>
          <p className="text-lg text-muted-foreground font-light mb-12">
            Imagine um centro de comando onde aprovações substituem microgerenciamento. Você define o posicionamento, valida a oferta e aprova os recursos; o sistema planeja, escreve, publica, distribui anúncios e engaja leads, preservando seu tom de voz em cada contato.
          </p>
          <Button onClick={openCapture} className="h-14 px-8 text-sm sm:text-base font-bold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all font-sans tracking-wide shadow-[0_0_20px_rgba(138,43,226,0.3)]">
            {closed ? "Turma inicial encerrada" : "Reservar vaga inicial"} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function BreadthSection() {
  return (
    <section className="py-32 relative border-t border-border/30 bg-card/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6">Cobertura Integral</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
              A profundidade do <span className="text-primary">Ciclo de Vida</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              Toda a fundação comercial da sua marca presente de ponta a ponta — sem perder conversão no abismo entre ferramentas soltas.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BentoCard
            icon={<Globe />}
            title="Inteligência de Mercado"
            desc="Monitoramento autônomo de concorrentes, tendências de nicho e análise de sentimento em tempo real para nutrir campanhas."
          />
          <BentoCard
            icon={<Target />}
            title="Estratégia e Oferta"
            desc="O War Room. Planejamento em janela de 30 dias onde ângulos de venda, promessas e objeções são consolidados."
          />
          <BentoCard
            icon={<Presentation />}
            title="Conteúdo e Audiovisual"
            desc="Criação massiva alinhada à estratégia: roteiros de vídeo, cópia persuasiva e integração opcional com clones digitais."
          />
          <BentoCard
            icon={<Workflow />}
            title="Distribuição e Mídia Paga"
            desc="Gestão rigorosa de publicações sociais e aprovação rígida de tráfego, respeitando os limites da sua conta comercial Meta Ads."
          />
          <BentoCard
            icon={<Users />}
            title="Vendas, CRM e Retenção"
            desc="Gestão do funil de pipeline onde agentes acompanham cada lead, realizam o onboarding e maximizam o valor da carteira."
          />
          <BentoCard
            icon={<BookOpen />}
            title="Workspaces de Agência"
            desc="Isolamento cirúrgico de clientes. A inteligência, os dados e os acessos de uma marca nunca se misturam com a da outra."
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({ icon, title, desc }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative group overflow-hidden rounded-3xl border border-border/80 bg-background/50 p-8 backdrop-blur-xl flex flex-col hover:border-primary/30 transition-colors"
    >
      <div className="w-12 h-12 rounded-xl bg-card/80 border border-border flex items-center justify-center mb-6 text-foreground shadow-lg">
        {React.cloneElement(icon, { className: "w-6 h-6 text-primary" })}
      </div>
      <h3 className="text-xl font-sans font-bold mb-3 tracking-tight">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm font-light">{desc}</p>
    </motion.div>
  )
}

function OperationalProofSection() {
  const features = [
    {
      icon: <Layers className="w-6 h-6 text-primary" />,
      title: "Contexto Único",
      desc: "A operação inteira consome a mesma matriz. O que o Radar descobre, o agente de copy utiliza imediatamente no e-mail."
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-secondary" />,
      title: "Execução Governada",
      desc: "As ações externas respeitam autorizações, limites e controles definidos, garantindo previsibilidade em cada publicação ou disparo."
    },
    {
      icon: <Fingerprint className="w-6 h-6 text-accent" />,
      title: "Fato vs. Inferência",
      desc: "O sistema segrega dados empíricos do mercado de deduções de IA, tornando o limite entre evidência e dedução visível para fundamentar suas decisões."
    }
  ];

  return (
    <section className="py-32 relative border-t border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-success mb-6">A Prova Operacional</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
              Capacidade Concreta.<br />Sem métricas inventadas.
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              Exibimos a realidade arquitetural de uma máquina desenvolvida estritamente para governança, consistência e escala, projetada para não quebrar com a complexidade do seu crescimento.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-center">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="border border-border/60 bg-card/30 p-8 rounded-3xl flex flex-col hover:border-primary/40 transition-all backdrop-blur-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center mb-6 shadow-lg">
                {f.icon}
              </div>
              <h3 className="text-xl font-sans font-bold mb-3 text-foreground">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed font-light text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommercialSection() {
  return (
    <section className="py-32 relative bg-card/20 border-t border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-secondary mb-6">Arquitetura de Valor</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-8">
              A orquestração total é a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Escolha de Maior Retorno.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 font-light">
              O mercado tradicional vende "soluções pontuais". Nós oferecemos coerência estrutural. No momento da abertura, a licença integral entregará a conexão de todas as fases da sua máquina de aquisição.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-10 font-light">
              Após a abertura oficial, capacidades avulsas poderão ser contratadas separadamente, porém carregarão um custo 30% a 50% superior ao seu peso na licença completa — refletindo a perda de tração natural da fragmentação. O Radar Pro de Inteligência Ativa será incluído na licença completa nos 90 dias inaugurais.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="rounded-3xl border border-border bg-background/50 p-8 sm:p-12 shadow-2xl relative overflow-hidden backdrop-blur-xl"
          >
            <div className="absolute -bottom-20 -right-20 opacity-10">
              <Database className="w-72 h-72" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 bg-secondary/10 mb-8">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-secondary font-semibold">
                  Mapeamento Futuro
                </span>
              </div>
              <h3 className="text-3xl font-sans font-bold mb-10 tracking-tight">O Custo de Não Integrar</h3>

              <div className="space-y-8">
                <div className="flex justify-between items-end border-b border-border/50 pb-4">
                  <div>
                    <span className="block text-foreground font-semibold mb-1">Módulos Avulsos</span>
                    <span className="block text-xs font-mono text-muted-foreground uppercase">Retenção de Silos</span>
                  </div>
                  <span className="font-mono text-destructive font-bold">+30% a 50%</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div>
                    <span className="block text-xl text-primary font-bold mb-1">Licença Completa NexOS</span>
                    <span className="block text-xs font-mono text-primary/70 uppercase tracking-widest">Execução Alinhada</span>
                  </div>
                  <span className="font-sans text-xl font-bold text-foreground">Melhor Proposta</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ObjectionSection() {
  return (
    <section className="py-32 relative border-t border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-6">Transparência Tática</div>
          <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
            Lidando com a Realidade.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <ObjectionCard
            title="A Inteligência Artificial soará robótica?"
            desc="Apenas se não possuir direcionamento. Nossos agentes escrevem baseados num dossiê denso da sua estratégia comercial, objeções reais da audiência e o tom específico aprovado pela sua marca."
          />
          <ObjectionCard
            title="Perderei o controle de orçamentos e aprovações?"
            desc="O sistema é fundamentado na governança rígida. As ações externas respeitam autorizações, limites e controles definidos por você, garantindo que a operação escale com segurança."
          />
          <ObjectionCard
            title="Terei acesso à interface se eu não assinar o pacote completo?"
            desc="Sim. Módulos que você não assinar no futuro estarão visíveis como somente-leitura. O valor total reside na arquitetura destravada e operando unida."
          />
          <ObjectionCard
            title="Isso é apropriado para Agências de Lançamento?"
            desc="Sim. Construímos workspaces logicamente isolados. Assim, a inteligência consolidada de um cliente nunca influencia ou cruza dados confidenciais com as demais operações de sua agência."
          />
        </div>
      </div>
    </section>
  );
}

function ObjectionCard({ title, desc }: { title: string, desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 rounded-2xl border border-border/60 bg-background/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-start gap-4">
        <HelpCircle className="w-6 h-6 text-accent shrink-0 mt-1" />
        <div>
          <h4 className="font-sans font-bold text-foreground text-lg mb-2">{title}</h4>
          <p className="text-sm text-muted-foreground font-light leading-relaxed">{desc}</p>
        </div>
      </div>
    </motion.div>
  )
}

function AnticipationSection() {
  return (
    <section className="py-32 relative bg-card/20 border-t border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 sm:p-12 relative overflow-hidden backdrop-blur-md">
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <Lock className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-sans font-black leading-tight mb-6 text-foreground">
              O Lançamento Exige Responsabilidade.
            </h2>
            <p className="text-lg text-muted-foreground font-light mb-8">
              A NexOS está pronta para centralizar sua operação comercial com automação, governança e controle. A abertura inicial foi desenhada para receber os primeiros operadores com a atenção que uma nova operação exige.
            </p>
            <p className="text-base text-foreground/80 font-mono tracking-wide uppercase">
              A abertura inicial terá somente 100 vagas de pré-lançamento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
  return (
    <section className="py-32 relative overflow-hidden border-t border-border/50">
      <div className="absolute inset-0 bg-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-primary/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-4xl sm:text-6xl font-sans font-black leading-tight mb-8">
          Pronto para unificar<br />sua execução comercial?
        </h2>
        <Button onClick={openCapture} className="h-16 px-10 text-base sm:text-lg font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all font-sans tracking-wide shadow-2xl">
          {closed ? "Turma inicial encerrada" : "Reservar vaga inicial"} <ArrowRight className="ml-2 h-6 w-6" />
        </Button>
        <p className="mt-5 text-sm text-muted-foreground">
          {closed
            ? "As 100 vagas iniciais foram encerradas. Fale com a equipe no WhatsApp; não há data para reabertura e as condições atuais podem não permanecer."
            : "A abertura inicial terá apenas 100 vagas de pré-lançamento."}
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-12 bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <img src={nexosLogo} alt="NexOS Logo" className="h-6 w-6 object-contain grayscale opacity-50" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">© 2025 NexOS</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/terms" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Termos de Serviço</Link>
          <Link href="/privacy" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Política de Privacidade</Link>
          <Link href="/data-deletion" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Exclusão de Dados</Link>
        </div>
      </div>
    </footer>
  );
}
// End of landing page.
