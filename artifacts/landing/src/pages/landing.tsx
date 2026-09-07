import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";
import { Link } from "wouter";
import {
  ArrowRight, Users, Video, Workflow,
  Activity, Target, Layers, Lock, ShieldCheck, Search, Megaphone, CheckSquare
} from "lucide-react";

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
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground scroll-smooth bg-grid-pattern relative">
      <div className="noise-overlay" />
      <Nav openCapture={openCapture} closed={closed} />

      <main className="flex-1 border-x-2 border-border max-w-[1400px] w-full mx-auto bg-background">
        <HeroSection openCapture={openCapture} closed={closed} />
        <RealWorkSection />
        <ArchitectureSection />
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
  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between border-x-2 border-border bg-background">
        <div className="flex items-center gap-4">
          <img src={nexosLogo} alt="NexOS" className="h-10 w-10 object-contain grayscale contrast-200" />
          <div className="hidden sm:block">
            <div className="font-display font-black text-2xl tracking-tighter uppercase leading-none">NEXOS</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Agência Autônoma</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" aria-label="Entrar no sistema" data-testid="nav-login-link" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hidden sm:block transition-colors font-bold">
            [ Log in ]
          </Link>
          <Button
            onClick={openCapture}
            data-testid="nav-guide-button"
            className="font-mono text-xs uppercase tracking-widest font-bold h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-none"
          >
            {closed ? "Vagas Esgotadas" : "Reservar Vaga"}
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ openCapture, closed }: { openCapture: () => void; closed: boolean }) {
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
              OPERAÇÃO COMERCIAL PRONTA
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-[7rem] font-display font-black leading-[0.95] tracking-tighter mb-8 uppercase text-foreground">
            Pare de contratar partes <br/>
            <span className="text-primary">para executar uma<br/>estratégia inteira.</span>
          </h1>

          <p className="text-lg sm:text-2xl text-muted-foreground max-w-3xl leading-relaxed mb-12 font-sans font-medium">
            Da pesquisa de mercado inicial à retenção do cliente. Uma agência autônoma que cria sua oferta, produz as páginas, edita os vídeos, roda os anúncios no Meta Ads e gerencia seu CRM — sem você precisar conectar ferramentas ou explicar o produto de novo a cada etapa.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={openCapture} data-testid="hero-cta-button" className="h-16 px-10 text-base font-display font-bold rounded-none bg-foreground text-background hover:bg-muted-foreground transition-colors uppercase tracking-wide">
              {closed ? "Turma inicial encerrada" : "Garantir Vaga de Abertura"} <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={scrollToWork} className="h-16 px-10 text-base font-display font-bold rounded-none border-2 border-border bg-transparent hover:bg-card transition-colors text-foreground uppercase tracking-wide">
              Ver Trabalho Concreto
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold border-l-2 border-primary pl-4 py-1">
              {closed
                ? "LIMITE DE 100 OPERAÇÕES ATINGIDO. SEM PREVISÃO DE REABERTURA."
                : "REGRAS DE ACESSO: APENAS 100 VAGAS DISPONÍVEIS NO PRÉ-LANÇAMENTO."}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function RealWorkSection() {
  return (
    <section id="trabalho-concreto" className="py-24 sm:py-32 border-b-2 border-border relative bg-card scroll-mt-20">
      <div className="px-6">
        <div className="mb-16">
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">O Escopo do Sistema</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight max-w-4xl">
            O que a NexOS faz todos os dias pela sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[2px] border-2 border-border bg-border">
          <WorkCard
            number="01"
            title="Inteligência & Oferta"
            desc="O sistema varre o mercado, estuda seus concorrentes e estrutura ângulos de venda, ganchos e promessas para os próximos 30 dias de campanha."
            icon={<Search className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="02"
            title="Produção de Vídeo"
            desc="Roteiriza, corta e edita vídeos curtos e VSLs. Usa suas gravações reais ou gera os vídeos automaticamente integrando avatares HeyGen e vozes ElevenLabs."
            icon={<Video className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="03"
            title="Landings & Criativos"
            desc="Gera copy e design para landing pages focadas em conversão, além de produzir criativos estáticos de alta performance alinhados à sua identidade."
            icon={<Layers className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="04"
            title="Tráfego (Meta Ads)"
            desc="Cria, sobe e gerencia campanhas no Facebook e Instagram. Testa criativos, distribui verba e pausa o que não dá ROI — seguindo suas regras e limites de conta."
            icon={<Target className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="05"
            title="Social Media & Grupos"
            desc="Agenda e publica posts no Instagram, responde directs e modera comunidades e grupos, mantendo o aquecimento e a antecipação da audiência."
            icon={<Megaphone className="w-8 h-8 text-primary" />}
          />
          <WorkCard
            number="06"
            title="Vendas & Retenção"
            desc="Acompanha o pipeline no CRM, envia e-mails de onboarding para novos clientes, recupera carrinhos abandonados e aciona campanhas de indicação."
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

function ArchitectureSection() {
  return (
    <section className="py-24 sm:py-32 border-b-2 border-border bg-background">
      <div className="px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">A Quebra de Silos</h2>
            <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight mb-8">
              Você é o gargalo que traduz a mesma estratégia para cinco áreas diferentes.
            </p>
            <div className="space-y-6 text-lg text-muted-foreground font-sans">
              <p>O custo real da sua operação não está nas mensalidades de software. Está na perda de tração diária.</p>
              <p>É o e-mail que sai fora de sincronia com o anúncio. É a agência de design que erra o tom da marca. É o gestor de tráfego otimizando campanhas às cegas sem feedback do CRM.</p>
              <p className="font-bold text-foreground">Com a NexOS, o cérebro é unificado.</p>
              <p>A pesquisa consolidada pela IA orienta o texto. O estrategista instrui o copywriter, que entrega o material ao gestor de anúncios e atualiza o conhecimento do SDR. Toda a operação consome a mesma matriz de inteligência de ponta a ponta.</p>
            </div>
          </div>

          <div className="relative border-2 border-border p-8 bg-card">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b-2 border-l-2 border-border bg-background">
              Arquitetura Operacional
            </div>

            <div className="mt-8 space-y-4">
              <ArchNode title="Pesquisa de Nicho e Análise de Concorrentes" status="Concluído" />
              <ArchNode title="Definição de Oferta e Ganchos (War Room)" status="Concluído" />
              <ArchNode title="Criação de Copy, Design e Vídeos (HeyGen/ElevenLabs)" status="Ativo" highlight />
              <ArchNode title="Distribuição de Conteúdo e Grupos" status="Ativo" />
              <ArchNode title="Operação Meta Ads (Publicação e Otimização)" status="Ativo" />
              <ArchNode title="Acompanhamento CRM (Vendas e Onboarding)" status="Ativo" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchNode({ title, status, highlight = false }: any) {
  return (
    <div className={`border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${highlight ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
      <span className={`font-display font-bold uppercase tracking-tight text-foreground`}>{title}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 ${highlight ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
        <span className={`font-mono text-[10px] uppercase font-bold tracking-widest ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{status}</span>
      </div>
    </div>
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
              As ações externas (publicar posts, subir campanhas no Meta, enviar e-mails) só acontecem após sua aprovação ou dentro de limites pré-estabelecidos por você.
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Workflow className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">Workspaces Isolados</h3>
            <p className="text-muted-foreground font-sans">
              Perfeito para agências de lançamento. Os dados, a inteligência e as estratégias de um cliente jamais se misturam com as demais operações do seu portfólio.
            </p>
          </div>

          <div className="border-2 border-border bg-background p-8">
            <Activity className="w-10 h-10 text-primary mb-6" />
            <h3 className="font-display font-bold text-xl uppercase tracking-tight mb-4">Métricas Reais. Fim.</h3>
            <p className="text-muted-foreground font-sans">
              O sistema baseia-se em dados empíricos puxados diretamente do Meta Ads e do seu CRM. Nenhuma IA inventando números de conversão para o painel parecer completo. O que está lá é o que o dinheiro comprou.
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
          <h2 className="font-mono text-sm uppercase tracking-widest text-primary mb-4 font-bold">Lógica de Execução</h2>
          <p className="text-4xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-tight">
            Como garantimos que a estratégia não vire um frankenstein de IA.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">1. O Cérebro Único (Dossiê)</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Sua marca não tem "várias vozes". A NexOS cria um Dossiê mestre da campanha. Se o seu público odeia agressividade, essa regra bloqueia o roteirista de vídeo, modera o copywriter de e-mail e dita o tom dos seus anúncios no Meta.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">2. Revisão Humana Opcional</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Você pode automatizar 100% da publicação ou ligar a trava de segurança. No modo seguro, a NexOS escreve os 30 posts, edita os 10 reels e agenda as campanhas no Meta, mas elas só sobem após o seu "Aprovado" na interface.
              </p>
            </div>
          </div>

          <div className="space-y-12">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">3. Dados, Não Alucinações</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Quando a agência autônoma relata que um criativo saturou, ela não está "adivinhando". Ela cruzou o CTR do Meta Ads com a conversão do seu CRM e com as aberturas do seu e-mail. Se ela sugere pausar, é porque o CPA subiu.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-6">
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">4. Memória Institucional</h3>
              <p className="text-muted-foreground font-sans leading-relaxed text-lg">
                Ferramentas genéricas esquecem quem você é a cada nova sessão. A NexOS armazena os vencedores e perdedores. O que não funcionou no mês passado já está marcado como "Não Fazer" para a campanha atual.
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
          Uma agência autônoma exige governança robusta e suporte dedicado nos primeiros dias. Para garantir a estabilidade do ecossistema, o acesso inicial é severamente restrito. Não há exceções.
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
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-border bg-background py-12 px-6 text-center sm:text-left">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <img src={nexosLogo} alt="NexOS" className="h-8 w-8 object-contain grayscale" />
          <span className="font-display font-black text-xl uppercase tracking-tighter text-muted-foreground">NexOS</span>
        </div>

        <div className="flex gap-6 font-mono text-xs uppercase tracking-widest font-bold text-muted-foreground">
          <Link href="/termos" className="hover:text-primary transition-colors">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
        </div>

        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} NexOS. Operação Centralizada.
        </div>
      </div>
    </footer>
  );
}
