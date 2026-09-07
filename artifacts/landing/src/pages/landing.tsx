import React, { useState } from "react";
import { motion } from "framer-motion";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, Users, Video, Workflow, BookOpen, Globe, Database,
  ShieldCheck, Zap, Activity, Target, ShieldAlert, Fingerprint,
  Layers, LockKeyhole, RefreshCcw, Lock, Infinity as InfinityIcon, HelpCircle
} from "lucide-react";
import { Link } from "wouter";

export default function LandingPage() {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const openCapture = () => setCaptureOpen(true);
  const closeCapture = () => setCaptureOpen(false);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col selection:bg-primary/30">
      <Background />
      <Nav openCapture={openCapture} />

      <main className="flex-1">
        <HeroSection openCapture={openCapture} />
        <PainSection />
        <MechanismSection />
        <TransformationSection openCapture={openCapture} />
        <OperationalProofSection />
        <BreadthSection />
        <CommercialSection />
        <ObjectionSection />
        <AnticipationSection />
        <CtaSection openCapture={openCapture} />
      </main>

      <Footer />
      <LeadCaptureModal open={isCaptureOpen} onClose={closeCapture} />
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

function Nav({ openCapture }: { openCapture: () => void }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={nexosLogo} alt="NexOS" className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]" />
          <div className="hidden sm:block">
            <div className="font-sans font-bold text-xl tracking-wide uppercase">NexOS</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary/80">Operating System</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" aria-label="Entrar no sistema" data-testid="nav-login-link" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hidden sm:block transition-colors">
            Entrar
          </Link>
          <Button onClick={openCapture} aria-label="Entrar na Lista Prioritária" data-testid="nav-guide-button" className="font-mono text-xs uppercase tracking-widest font-bold h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all rounded-md">
            Lista Prioritária
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ openCapture }: { openCapture: () => void }) {
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
              Acesso Antecipado e Preparação
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-[6.5rem] font-sans font-black leading-[1.05] tracking-tight mb-8">
            O Sistema Operacional<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent pb-2">
              Que Executa Por Você.
            </span>
          </h1>

          <p className="text-lg sm:text-2xl text-muted-foreground max-w-2xl leading-relaxed mb-12 font-light">
            Sua operação de marketing e vendas governada por 64 agentes especializados compartilhando a mesma inteligência de mercado. O lançamento oficial se aproxima. Prepare-se.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={openCapture} aria-label="Entrar na Lista Prioritária" data-testid="hero-cta-button" className="h-14 px-8 text-sm sm:text-base font-bold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all font-sans tracking-wide">
              Entrar na Lista Prioritária <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={openCapture} aria-label="Receber Diagnóstico" className="h-14 px-8 text-sm sm:text-base font-semibold rounded-lg border-border bg-card/30 hover:bg-card hover:border-primary/50 transition-all text-foreground backdrop-blur-md">
              Receber Diagnóstico
            </Button>
          </div>
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
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-destructive mb-6">A Causa Raiz da Estagnação</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-bold leading-tight mb-8">
              Você gasta mais tempo<br />
              integrando do que<br />
              <span className="text-destructive">escalando.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 font-light">
              A maioria das empresas sangra receita nas entrelinhas operacionais. Quando a agência atrasa a cópia, a automação de e-mail desincroniza da oferta, e o gestor de tráfego opera às cegas. A fragmentação devora suas margens através do esforço brutal de coordenar partes quebradas.
            </p>
            <div className="space-y-5 border-l border-border/50 pl-6 ml-2">
              {[
                "Dezenas de ferramentas fragmentadas cobrando por assento.",
                "Falta de contexto compartilhado entre estratégia e execução.",
                "Agências lentas entregando partes isoladas do ecossistema.",
                "Trabalho manual interminável cobrindo falhas de integração."
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
                 <BrokenNode title="Plataforma de Anúncios (Ads)" delay={0} />
                 <BrokenNode title="CRM e Sequências de Email" delay={0.2} />
                 <BrokenNode title="SDR e Equipe de Vendas" delay={0.4} />
               </div>
               <div className="mt-8 pt-8 border-t border-border/50 text-center">
                 <p className="font-mono text-xs uppercase tracking-widest text-destructive font-semibold">
                   Modelos isolados quebram na escala
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
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6">O Mecanismo Único Integrado</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-8">
              Inteligência de Mercado<br />
              <span className="text-primary">Transformada em Execução.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 font-light">
              Em vez de conectar ferramentas independentes com fluxos frágeis, o NexOS unifica o cérebro da operação. 64 agentes especializados — de redatores a estrategistas — operam dentro do mesmo ecossistema, consumindo a exata mesma verdade sobre seu mercado e avatar.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed font-light">
              A pesquisa consolidada altera a cópia do anúncio instantaneamente. O insight fechado no CRM reajusta a segmentação. A inteligência é centralizada; a execução é coordenada, governada e implacável.
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
               { title: "Radar & Contexto", icon: <Globe className="w-5 h-5" /> },
               { title: "Geração de Oferta", icon: <Target className="w-5 h-5" /> },
               { title: "Governança de Mídia", icon: <ShieldCheck className="w-5 h-5" /> },
               { title: "Ciclo de Vida CRM", icon: <Users className="w-5 h-5" /> }
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

function TransformationSection({ openCapture }: { openCapture: () => void }) {
  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-secondary mb-6">O Futuro Próximo da Sua Operação</div>
          <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
            Você Define a Estratégia.<br />O Ecossistema Entrega o Restante.
          </h2>
          <p className="text-lg text-muted-foreground font-light mb-12">
            Imagine um centro de comando onde aprovações substituem microgerenciamento. Você direciona a meta, a oferta e governa o tom; o sistema planeja, escreve, publica, distribui e engaja, preservando o contexto global.
          </p>
          <Button onClick={openCapture} className="h-14 px-8 text-sm sm:text-base font-bold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all font-sans tracking-wide shadow-[0_0_20px_rgba(138,43,226,0.3)]">
            Garantir Acesso Antecipado <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function OperationalProofSection() {
  const features = [
    {
      icon: <Layers className="w-6 h-6 text-primary" />,
      title: "Contexto Canônico Compartilhado",
      desc: "A operação inteira consome a mesma verdade. O que o Radar descobre, os agentes de copy utilizam instantaneamente."
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-secondary" />,
      title: "Execução Governada",
      desc: "Nenhuma ação externa ocorre no escuro. Disparos e publicações são controlados por validações rigorosas de permissão e APIs."
    },
    {
      icon: <Fingerprint className="w-6 h-6 text-accent" />,
      title: "Fato vs. Inferência",
      desc: "O sistema segrega dados empíricos do mercado de deduções criativas, garantindo que campanhas sejam fundamentadas na realidade."
    },
    {
      icon: <LockKeyhole className="w-6 h-6 text-primary" />,
      title: "Workspaces Multi-Tenant",
      desc: "Isolamento absoluto de dados para agências e múltiplas marcas. Inteligência e faturamento de cada operação permanecem bloqueados."
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-success" />,
      title: "Direitos Validados",
      desc: "O acesso a recursos será liberado dinamicamente via verificação rigorosa de entitlements comerciais (quando o sistema abrir)."
    }
  ];

  return (
    <section className="py-32 relative bg-card/20 border-t border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-success mb-6">Evidência Operacional</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
              A Transparência do Sistema.<br />Sem Falsas Promessas.
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              Não exibimos depoimentos fabricados nem garantimos resultados irreais. Exibimos a realidade arquitetural de uma máquina desenvolvida estritamente para governança, consistência e escala.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-center">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="border border-border/60 bg-background/50 p-8 rounded-3xl flex flex-col hover:border-primary/40 transition-all backdrop-blur-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-6 shadow-lg">
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

function BreadthSection() {
  return (
    <section className="py-32 relative border-y border-border/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6">O Escopo Funcional</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
              Escala Canônica via <span className="text-primary">NexOS</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              Os 64 agentes operacionais cobrem a vastidão do seu ciclo de vida. Do radar inicial à retenção final do cliente.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-min">
          <BentoCard
            colSpan="md:col-span-2"
            icon={<Globe />}
            title="Radar de Mercado"
            subtitle="Inteligência de Competidores"
            desc="O Radar Pro garante monitoramento contínuo das tendências do seu nicho (e será incluído nos primeiros 90 dias do futuro plano completo)."
            glowColor="bg-primary/20"
            delay={0.1}
          />
          <BentoCard
            colSpan="md:col-span-1"
            icon={<Target />}
            title="War Room"
            subtitle="Orquestração"
            desc="Planejamento em janela de 30 dias. Agentes de oferta e psicologia definem a direção."
            glowColor="bg-secondary/20"
            delay={0.2}
          />
          <BentoCard
            colSpan="md:col-span-1"
            icon={<Users />}
            title="SDR e CRM"
            subtitle="Ciclo de Vida"
            desc="Suporte, onboarding e indicações automatizados aprendendo a cada fechamento."
            glowColor="bg-accent/20"
            delay={0.3}
          />
          <BentoCard
            colSpan="md:col-span-2"
            icon={<Workflow />}
            title="Mídia Paga Governada"
            subtitle="Publicação Social"
            desc="Ações externas rigorosamente bloqueadas até que capacidades, permissões e integrações completas (como Meta Ads) estejam garantidas."
            glowColor="bg-secondary/20"
            delay={0.4}
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({ colSpan, icon, title, subtitle, desc, glowColor, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative group overflow-hidden rounded-3xl border border-border/80 bg-card/60 p-8 sm:p-10 backdrop-blur-xl ${colSpan} flex flex-col justify-between hover:border-primary/30 transition-colors`}
    >
      <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[100px] transition-opacity duration-700 opacity-20 group-hover:opacity-60 ${glowColor}`} />

      <div className="relative z-10 flex flex-col h-full">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-background/90 border border-border flex items-center justify-center mb-8 text-foreground shadow-xl">
            {React.cloneElement(icon, { className: "w-7 h-7" })}
          </div>
          <h3 className="text-2xl sm:text-3xl font-sans font-bold mb-3 tracking-tight">{title}</h3>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-6">{subtitle}</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed text-base sm:text-lg font-light">{desc}</p>
      </div>
    </motion.div>
  )
}

function CommercialSection() {
  return (
    <section className="py-32 relative bg-card/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-secondary mb-6">A Lógica Comercial</div>
            <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-8">
              A Licença Completa será a<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Escolha de Maior Valor.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 font-light">
              A verdadeira genialidade do NexOS reside no contexto compartilhado. O valor se multiplica quando a operação inteira trabalha uníssona.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-10 font-light">
              No momento da abertura oficial, você poderá entrar através de capacidades avulsas (standalone), mas elas carregarão um prêmio de 30% a 50% refletindo o custo da fragmentação. A licença completa é estruturalmente o melhor caminho.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="rounded-3xl border border-border bg-card/40 p-8 sm:p-12 shadow-2xl relative overflow-hidden backdrop-blur-xl"
          >
            <div className="absolute -bottom-20 -right-20 opacity-10">
              <Database className="w-72 h-72" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 bg-secondary/10 mb-8">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-secondary font-semibold">
                  Estrutura Futura
                </span>
              </div>
              <h3 className="text-3xl font-sans font-bold mb-10 tracking-tight">O Custo de Não Integrar</h3>

              <div className="space-y-8">
                <div className="flex justify-between items-end border-b border-border/50 pb-4">
                  <div>
                    <span className="block text-foreground font-semibold mb-1">Módulos Avulsos</span>
                    <span className="block text-xs font-mono text-muted-foreground uppercase">Fragmentado</span>
                  </div>
                  <span className="font-mono text-destructive font-bold">+30% a 50%</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div>
                    <span className="block text-xl text-primary font-bold mb-1">Licença Completa NexOS</span>
                    <span className="block text-xs font-mono text-primary/70 uppercase tracking-widest">Acesso Unificado</span>
                  </div>
                  <span className="font-sans text-xl font-bold text-foreground">Maior Valor</span>
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
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-6">Clarificando a Operação</div>
          <h2 className="text-4xl sm:text-5xl font-sans font-black leading-tight mb-6">
            Dúvidas Fundamentais.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <ObjectionCard
            title="A Inteligência Artificial soará robótica?"
            desc="Não. Os agentes do NexOS operam com contexto profundo sobre o seu mercado, seu tom de voz e diretrizes de marca, evitando o padrão genérico de interfaces comuns."
          />
          <ObjectionCard
            title="Perderei o controle de orçamentos e anúncios?"
            desc="O sistema é fundamentado na governança rígida. Todas as ações externas exigem sua aprovação explícita. Nada é gasto ou publicado sem o seu consentimento."
          />
          <ObjectionCard
            title="Serei forçado a assinar todos os módulos?"
            desc="O NexOS é flexível. Embora a orquestração total seja o caminho de maior retorno, permitiremos a contratação de componentes avulsos no futuro."
          />
          <ObjectionCard
            title="Como a estrutura lida com meus clientes de agência?"
            desc="Utilizamos Workspaces isolados. A inteligência, os dados e o faturamento de cada operação que você atende permanecem em ambientes separados."
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
              O Lançamento Oficial<br />Requer Perfeição.
            </h2>
            <p className="text-lg text-muted-foreground font-light mb-8">
              O NexOS não é um experimento frágil. O checkout público está rigorosamente bloqueado até que todo o ecossistema — especialmente a integração de anúncios governada na rede Meta — esteja homologado para proteger sua marca em alta escala. Não apressaremos a infraestrutura.
            </p>
            <p className="text-base text-foreground/80 font-mono tracking-wide uppercase">
              O momento exige antecipação. Somente a lista prioritária receberá o acesso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({ openCapture }: { openCapture: () => void }) {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-primary/20 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <Zap className="w-16 h-16 text-primary mx-auto mb-8 drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]" />
          <h2 className="text-5xl sm:text-7xl font-sans font-black leading-tight mb-8 tracking-tight">
            A Vanguarda Começa Aqui.
          </h2>
          <p className="text-xl text-muted-foreground mb-12 font-light">
            Entre para a lista prioritária, consuma os materiais preparatórios e posicione sua operação antes da abertura oficial dos portões.
          </p>
          <Button onClick={openCapture} aria-label="Entrar na Lista Prioritária" data-testid="footer-cta-button" className="h-16 px-12 text-lg font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all font-sans tracking-wide">
            Entrar na Lista Prioritária
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 border-t border-border bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src={nexosLogo} alt="NexOS" className="h-8 w-8 object-contain opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
          <span className="font-sans text-sm font-medium text-muted-foreground">© {new Date().getFullYear()} NexOS AI. Todos os direitos reservados.</span>
        </div>
        <div className="flex gap-8">
          <Link href="/terms" aria-label="Termos de Serviço" data-testid="footer-terms-link" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Termos</Link>
          <Link href="/privacy" aria-label="Política de Privacidade" data-testid="footer-privacy-link" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Privacidade</Link>
          <Link href="/data-deletion" aria-label="Exclusão de Dados" data-testid="footer-data-link" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Dados</Link>
        </div>
      </div>
    </footer>
  )
}
