import React, { useState, useEffect, useRef } from "react";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { ArrowRight, CheckCircle2, Download, BookOpen, Lock, Users, ChevronDown, ChevronUp, Zap, Star, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import nexosLogo from "/nexos-logo.png";

// ─── Configuração — atualize aqui ────────────────────────────────────────────
const GRUPO_LINK  = "https://chat.whatsapp.com/SEU_GRUPO_AQUI";
const PDF_URL     = "#download"; // ← substitua pela URL real do PDF
const UNLOCK_KEY  = "nexos_guia_unlocked";

const capitulos = [
  {
    num: "01",
    titulo: "Fundação: Avatar, Posicionamento e Mecanismo Único",
    resumo: "Antes de qualquer copy ou anúncio, você precisa saber com precisão quem é o avatar específico, qual é a dor que só o seu produto resolve, e qual é o mecanismo único que diferencia você de todos os concorrentes no mercado.",
    topicos: [
      "Como mapear as 5 camadas de consciência do seu avatar",
      "O framework do Mecanismo Único — por que toda grande oferta tem um",
      "Posicionamento por contraste: o que não fazer antes do que fazer",
      "Big Idea: como construir uma narrativa que ninguém pode copiar",
    ],
    preview: "O erro mais caro num lançamento não é o anúncio errado. É construir a estratégia para um avatar que você imaginou, não para o cliente que realmente compra.",
  },
  {
    num: "02",
    titulo: "Estratégia de Lançamento: Trilha de Receita e Fases",
    resumo: "Todo lançamento profissional segue uma estrutura de 5 fases com timing específico. A trilha de receita (6, 8 ou 10 dígitos) define o tamanho da operação, o volume de tráfego e a arquitetura de funil necessária.",
    topicos: [
      "Fases do PLF adaptado para o mercado brasileiro",
      "Trilha de 6 dígitos: o mínimo viável de audiência, tráfego e copy",
      "Diferença entre aquecimento orgânico e aquecimento pago",
      "O cronograma reverso: da data de abertura do carrinho para trás",
    ],
    preview: "A diferença entre um lançamento de R$50k e um de R$500k raramente está no produto. Está no tamanho da janela de aquecimento e no número de touchpoints antes da abertura do carrinho.",
  },
  {
    num: "03",
    titulo: "Sequência de Automação: Email + WhatsApp por Segmento",
    resumo: "A automação que converte não é broadcast — é segmentação por comportamento. Leads quentes, mornos e frios precisam receber mensagens diferentes no momento certo do ciclo de compra.",
    topicos: [
      "Segmentação hot/warm/cold: como calcular e agir em cada grupo",
      "Estrutura completa da sequência de 7 dias de aquecimento",
      "Copy específica para cada fase: curiosidade → desejo → urgência → fechamento",
      "Configuração de disparo condicional com RD Station e ActiveCampaign",
    ],
    preview: "Leads quentes compram por urgência. Leads mornos compram por desejo. Leads frios compram por curiosidade e prova social. Mandar a mesma mensagem para os três é deixar dinheiro na mesa.",
  },
  {
    num: "04",
    titulo: "Tráfego Inteligente: Meta Ads, TikTok e Audiências",
    resumo: "O pixel sozinho não resolve. Você precisa entregar o sinal certo para o algoritmo treinar nas pessoas certas. Isso envolve server-side events, segmentação por estágio de consciência e rotação de criativos baseada em dados.",
    topicos: [
      "Server-side events (CAPI): por que o pixel client-side não é mais suficiente",
      "Segmentação por estágio de consciência nos anúncios",
      "Detecção de fadiga criativa: quando trocar o criativo antes de perder ROAS",
      "Lookalike seguro: quando escalar e quando pausar",
    ],
    preview: "Com iOS 14+ e ad blockers, o pixel client-side captura no máximo 60% dos eventos reais. A diferença entre 60% e 100% de match score é a diferença entre treinar o algoritmo para converter ou para clicar.",
  },
  {
    num: "05",
    titulo: "Carrinho Aberto: Escassez, Urgência e Objeções",
    resumo: "Os últimos 7 dias antes do fechamento do carrinho são os mais críticos e os mais desperdiçados. A maioria das conversões acontece nas últimas 24h — se você não tiver uma sequência de fechamento estruturada, está perdendo 40% da sua receita.",
    topicos: [
      "A sequência de 7 emails de carrinho aberto com taxa de abertura acima de 30%",
      "Como usar escassez real sem queimar autoridade",
      "As 5 objeções que bloqueiam 80% das vendas — e como pre-empt cada uma",
      "O email de 'última chance' que não parece desesperado",
    ],
    preview: "A maior falha na fase de carrinho não é o preço alto. É não ter nada para dizer depois do primeiro email de abertura. A sequência de fechamento precisa ter uma razão nova para comprar em cada touchpoint.",
  },
  {
    num: "06",
    titulo: "Pós-Lançamento: Análise, Perpétuo e Próximo Ciclo",
    resumo: "O lançamento acabou. O que fazer com os leads que não compraram? Como transformar um lançamento em uma máquina perpétua? E como usar os dados deste ciclo para o próximo ser 40% mais eficiente?",
    topicos: [
      "Análise pós-lançamento: as 5 métricas que importam vs. as que enganam",
      "Funil perpétuo: como manter receita entre um lançamento e outro",
      "Reengajamento de não-compradores: o segmento mais quente que você está ignorando",
      "Documentação de aprendizado: o ativo que a maioria das pessoas não cria",
    ],
    preview: "Os leads que não compraram no seu último lançamento são os leads mais quentes do próximo. Eles já conhecem você, já consideraram comprar, e só precisam de uma razão diferente para agir.",
  },
];

function CapituloCard({ cap }: { cap: typeof capitulos[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 bg-card/10 transition-all duration-300">
      <button
        className="w-full text-left px-5 sm:px-8 py-5 flex items-start gap-4 sm:gap-6 hover:bg-primary/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="font-mono font-black text-2xl sm:text-3xl text-primary/30 leading-none shrink-0 w-10 pt-0.5">{cap.num}</div>
        <div className="flex-1 min-w-0">
          <div className="font-mono font-black text-sm sm:text-base uppercase tracking-tight text-foreground leading-snug pr-4">{cap.titulo}</div>
          <div className="font-mono text-[11px] text-muted-foreground/50 mt-1.5 leading-relaxed line-clamp-2">{cap.resumo}</div>
        </div>
        <div className="shrink-0 mt-1 text-primary/50">
          {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>
      {open && (
        <div className="px-5 sm:px-8 pb-6 border-t border-border/20 pt-5">
          <div className="border-l-2 border-primary/40 pl-4 mb-5">
            <p className="font-mono text-sm text-muted-foreground/80 italic leading-relaxed">"{cap.preview}"</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cap.topicos.map((t, i) => (
              <div key={i} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuiaPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"download" | "read" | "miniguia" | null>(null);
  const lerOnlineRef = useRef<HTMLDivElement>(null);

  // Persist unlock state for the session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch { /* ignore */ }
  }, []);

  function handleUnlock() {
    setUnlocked(true);
    try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* ignore */ }
  }

  function handleSuccess() {
    handleUnlock();
    if (pendingAction === "download") {
      if (PDF_URL !== "#download") {
        const a = document.createElement("a");
        a.href = PDF_URL;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
    }
    if (pendingAction === "read") {
      setTimeout(() => {
        lerOnlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 600);
    }
    if (pendingAction === "miniguia") {
      setTimeout(() => {
        window.open(GRUPO_LINK, "_blank", "noopener,noreferrer");
      }, 800);
    }
    setPendingAction(null);
    setCaptureOpen(false);
  }

  function requestMiniGuia() {
    setPendingAction("miniguia");
    setCaptureOpen(true);
  }

  function requestDownload() {
    if (unlocked) {
      if (PDF_URL !== "#download") {
        window.open(PDF_URL, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setPendingAction("download");
    setCaptureOpen(true);
  }

  function requestRead() {
    if (unlocked) {
      lerOnlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setPendingAction("read");
    setCaptureOpen(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <a href="/landing/" className="flex items-center gap-2 shrink-0">
            <img src={nexosLogo} alt="NexOS" className="h-8 w-8 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.6))" }} />
            <span className="font-mono font-black text-sm tracking-[0.12em] uppercase">NexOS</span>
          </a>
          <div className="flex items-center gap-2">
            {unlocked ? (
              <Button size="sm" onClick={requestDownload} className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] tracking-widest font-bold h-8 px-3 gap-1.5">
                <Download className="h-3.5 w-3.5" /> Baixar PDF
              </Button>
            ) : (
              <Button size="sm" onClick={() => { setPendingAction(null); setCaptureOpen(true); }} className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] tracking-widest font-bold h-8 px-3 gap-1.5">
                <Users className="h-3.5 w-3.5" /> Quero o Guia
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">

        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Guia Gratuito · NexOS —</div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-[1.05] mb-6">
            O framework que<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              57 especialistas<br />vão executar<br />por você.
            </span>
          </h1>
          <p className="font-mono text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mb-8">
            Este é o mesmo framework que a plataforma NexOS executa autonomamente. Antes de qualquer ferramenta, você precisa entender os 6 estágios que separam um lançamento de R$50k de um de R$500k.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Button
              onClick={requestDownload}
              className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black h-13 px-8 gap-2 text-sm w-full sm:w-auto"
            >
              <Download className="h-4 w-4" /> Baixar PDF Completo
            </Button>
            <Button
              variant="outline"
              onClick={requestRead}
              className="rounded-none font-mono uppercase tracking-widest font-bold h-13 px-6 gap-2 text-sm border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 w-full sm:w-auto"
            >
              <BookOpen className="h-4 w-4" /> Ler Online Agora
            </Button>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/40">
            <Lock className="h-3.5 w-3.5" />
            {unlocked
              ? "Acesso liberado · compartilhe livremente"
              : "Gratuito · informe seu WhatsApp para acessar"}
          </div>
        </div>

        {/* O que tem dentro */}
        <div className="mb-12">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">— O que está no guia —</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { n: "6", label: "Capítulos completos" },
              { n: "57+", label: "Frameworks e templates" },
              { n: "7 dias", label: "Para um lançamento completo" },
            ].map(item => (
              <div key={item.label} className="border border-border/30 bg-card/15 px-6 py-4 text-center">
                <div className="font-mono font-black text-3xl text-primary leading-none mb-1">{item.n}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Capítulos — Ler Online (gated) */}
        <div ref={lerOnlineRef} id="ler-online" className="mb-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">— Ler online · clique para expandir —</div>

          {unlocked ? (
            <div className="space-y-2">
              {capitulos.map((cap) => (
                <CapituloCard key={cap.num} cap={cap} />
              ))}
            </div>
          ) : (
            <div className="relative">
              {/* Blurred preview — first 2 chapters */}
              <div className="space-y-2 select-none pointer-events-none" style={{ filter: "blur(3px)", opacity: 0.4 }}>
                {capitulos.slice(0, 2).map((cap) => (
                  <div key={cap.num} className="border border-border/30 bg-card/10 px-5 sm:px-8 py-5 flex items-start gap-4 sm:gap-6">
                    <div className="font-mono font-black text-2xl sm:text-3xl text-primary/30 leading-none shrink-0 w-10 pt-0.5">{cap.num}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-black text-sm sm:text-base uppercase tracking-tight text-foreground leading-snug pr-4">{cap.titulo}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/50 mt-1.5 leading-relaxed line-clamp-2">{cap.resumo}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gate overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm border border-primary/20">
                <div className="text-center px-6 py-8 max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-mono font-black text-lg uppercase tracking-tight mb-2">
                    Acesso liberado em segundos
                  </div>
                  <p className="font-mono text-xs text-muted-foreground/70 mb-6 leading-relaxed">
                    Informe seu nome e WhatsApp para ler os 6 capítulos completos e baixar o PDF.
                  </p>
                  <Button
                    onClick={requestRead}
                    className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black h-12 px-8 gap-2 text-sm w-full"
                  >
                    <Eye className="h-4 w-4" /> Liberar Acesso Agora
                  </Button>
                  <p className="font-mono text-[10px] text-muted-foreground/30 mt-3">
                    Gratuito · sem spam · apenas o guia no WhatsApp
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download CTA */}
        <div className="border border-primary/30 bg-primary/5 px-6 sm:px-10 py-8 mb-16 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Download —</div>
          <h2 className="font-mono font-black text-2xl sm:text-3xl uppercase tracking-tighter mb-3">
            Leve o guia completo<br />com você.
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-md mx-auto mb-6">
            PDF otimizado para mobile e desktop. Todos os 6 capítulos, frameworks visuais e checklist de lançamento em um arquivo.
          </p>
          <Button
            onClick={requestDownload}
            className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black h-14 px-10 gap-2 text-sm"
          >
            <Download className="h-5 w-5" /> Baixar o Guia (PDF Gratuito)
          </Button>
        </div>

        {/* Upgrade — Mini-Guia R$97 */}
        <div className="border border-amber-400/30 bg-amber-400/5 px-6 sm:px-10 py-8 mb-16">
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-400/60 mb-4">— Próximo passo —</div>
          <h2 className="font-mono font-black text-2xl sm:text-3xl uppercase tracking-tighter leading-tight mb-4">
            Quer o guia completo<br />
            <span className="text-amber-400">com workbook + exemplos reais?</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">
            O mini-guia expandido tem exemplos reais de campanhas documentadas, workbook de planejamento com os frameworks preenchíveis, e o cronograma completo dos 7 dias com scripts prontos para cada fase.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {[
              "Exemplos reais de campanhas de 6 dígitos documentadas",
              "Workbook com todos os frameworks preenchíveis",
              "Scripts prontos de email, WhatsApp e VSL por fase",
              "Cronograma completo dos 7 dias com checklist diário",
              "Biblioteca de headlines que funcionaram em 50+ lançamentos",
              "Guia de segmentação de audiência para Meta e TikTok",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 text-amber-400/70 shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono font-black text-3xl text-amber-400">Gratuito</span>
              </div>
              <div className="font-mono text-xs text-muted-foreground/50 mt-1">Cadastre-se e receba no WhatsApp + acesso ao grupo</div>
            </div>
            <Button
              onClick={requestMiniGuia}
              className="rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 gap-2 text-xs bg-amber-500 hover:bg-amber-400 text-background w-full sm:w-auto"
            >
              Quero o Mini-Guia Completo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/40">
            <Shield className="h-3.5 w-3.5" /> Garantia de 7 dias — não gostou, devolvemos tudo
          </div>
        </div>

        {/* Grupo CTA */}
        <div className="text-center border border-border/30 bg-card/15 px-6 py-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">— Comunidade —</div>
          <h2 className="font-mono font-black text-2xl sm:text-3xl uppercase tracking-tighter mb-3">
            Entre no grupo e receba<br /><span className="text-primary">conteúdo semanal gratuito.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Bastidores de lançamentos reais, estratégias novas toda semana, e acesso antecipado à plataforma quando o lançamento oficial abrir.
          </p>
          <Button
            onClick={() => { setPendingAction(null); setCaptureOpen(true); }}
            className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black h-13 px-10 gap-2 text-sm"
          >
            <Users className="h-5 w-5" /> Quero o Guia + Entrar no Grupo
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-muted-foreground/30">
          <span>© 2026 NexOS — Todos os direitos reservados</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-muted-foreground/60 transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-muted-foreground/60 transition-colors">Termos</a>
            <a href="/landing/" className="hover:text-muted-foreground/60 transition-colors">Landing</a>
          </div>
        </div>

      </div>

      <LeadCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSuccess={handleSuccess}
        title={pendingAction === "download" ? "Informe seu WhatsApp\npara receber o PDF" : "Libere seu acesso\nao guia gratuito"}
        subtitle={
          pendingAction === "download"
            ? "Cadastre-se e receba o link do PDF direto no seu WhatsApp."
            : "Nome e WhatsApp para liberar a leitura completa dos 6 capítulos."
        }
      />
    </div>
  );
}
