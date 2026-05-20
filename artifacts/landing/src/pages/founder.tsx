import { useEffect, useRef } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  Globe, MapPin, BookOpen, Brain, Zap, Target,
  Award, Briefcase, ArrowRight,
} from "lucide-react";

const COUNTRIES = [
  "Espanha", "Inglaterra", "Itália", "Alemanha",
  "Estados Unidos", "Argentina", "Paraguai", "Bolívia", "Uruguai", "Austrália",
];

const PILLARS = [
  { icon: Brain, label: "Pensamento Sistêmico", desc: "Visão de sistemas jurídicos, econômicos, tecnológicos e comportamentais como um todo integrado." },
  { icon: Target, label: "Execução Estratégica", desc: "Da concepção ao produto real — arquiteturas de solução que saem do papel e escalam." },
  { icon: Zap, label: "Inteligência Artificial", desc: "Automação operacional, agentes especializados e sistemas autônomos de crescimento digital." },
  { icon: Globe, label: "Visão Global", desc: "Experiência em +10 países. Perspectiva multicultural aplicada a tecnologia, mercado e comportamento." },
  { icon: BookOpen, label: "Multidisciplinaridade", desc: "Direito, Filosofia, Marketing, Geopolítica, BJJ — campos que se retroalimentam em uma visão única." },
  { icon: Award, label: "Alta Performance", desc: "Coach de BJJ aprovado no programa Global Talent australiano. Performance como mentalidade de vida." },
];

const TIMELINE = [
  { period: "Formação", label: "Direito · Filosofia · Marketing", desc: "Foco em constitucionalidade, comportamento humano, políticas públicas e Alienação Parental. Produção de artigos acadêmicos em análise constitucional." },
  { period: "Brasil", label: "Concurso Público & Empreendedorismo", desc: "Aprovado em concurso público no estado do Rio de Janeiro. Redireciona trajetória para inovação tecnológica e empreendedorismo, movido pela convicção de que grandes transformações surgem de novos sistemas." },
  { period: "Mundo", label: "+10 Países · Perspectiva Global", desc: "Espanha, Inglaterra, Itália, Alemanha, EUA, Argentina, Paraguai, Bolívia e Uruguai. Percepção ampliada sobre cultura, tecnologia, economia e comportamento de mercado." },
  { period: "Austrália", label: "Global Talent Visa", desc: "Aceito na Austrália pelo programa Global Talent com base no reconhecimento como coach de BJJ de alta performance. Residência permanente consolidada, cidadania australiana em processo." },
  { period: "Hoje", label: "IA · Automação · NexOS AI", desc: "Lidera o desenvolvimento da NexOS AI e outros projetos em inteligência artificial, arbitragem inteligente, protocolos de segurança digital e sistemas autônomos de crescimento." },
];

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.classList.add("in-view");
        obs.disconnect();
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

export default function FounderPage() {
  const heroRef = useInView(0.1);
  const bioRef = useInView(0.1);

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <style>{`
        .fade-up { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .in-view .fade-up, .fade-up.in-view { opacity: 1; transform: none; }
        .delay-1 { transition-delay: 0.1s; }
        .delay-2 { transition-delay: 0.2s; }
        .delay-3 { transition-delay: 0.3s; }
        .delay-4 { transition-delay: 0.4s; }
        .delay-5 { transition-delay: 0.5s; }
        .delay-6 { transition-delay: 0.6s; }
        .glow-line { box-shadow: 0 0 8px hsl(var(--primary, 195 100% 50%) / 0.6); }
      `}</style>

      {/* Nav */}
      <div className="border-b border-white/10 bg-black/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
            <img src={nexosLogo} alt="NexOS" className="h-7 w-7 object-contain" />
            <span className="text-sm font-bold tracking-widest text-white">NEXOS AI</span>
          </a>
          <span className="text-xs text-white/30 uppercase tracking-widest">Fundador</span>
        </div>
      </div>

      {/* Hero */}
      <section
        ref={heroRef as React.Ref<HTMLElement>}
        className="relative min-h-[70vh] flex items-center justify-center px-6 py-24 overflow-hidden"
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="fade-up">
            <span className="inline-block text-xs uppercase tracking-[0.3em] text-white/30 border border-white/10 px-4 py-1.5 mb-6">
              Fundador & Arquiteto
            </span>
          </div>

          <h1 className="fade-up delay-1 text-5xl md:text-7xl font-black uppercase tracking-tight leading-none">
            Bruce<br />
            <span style={{ background: "linear-gradient(90deg, #00d4ff, #0066ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Allan
            </span>
          </h1>

          <p className="fade-up delay-2 text-base md:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed tracking-wide">
            Empreendedor brasileiro radicado na Austrália. Construtor de sistemas de inteligência artificial, automação operacional e ecossistemas digitais de alta performance.
          </p>

          <div className="fade-up delay-3 flex flex-wrap items-center justify-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Perth, Austrália</span>
            <span className="text-white/10">·</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> +10 Países</span>
            <span className="text-white/10">·</span>
            <span className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> Global Talent Visa</span>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Bio completa */}
      <section
        ref={bioRef as React.Ref<HTMLElement>}
        className="max-w-4xl mx-auto px-6 py-20 space-y-8"
      >
        <div className="fade-up">
          <div className="text-xs uppercase tracking-[0.3em] text-white/25 mb-4">Sobre</div>
          <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-widest">Quem é Bruce Allan</h2>
        </div>

        {[
          "Bruce Allan é um empreendedor brasileiro radicado na Austrália, reconhecido por sua visão estratégica, pensamento sistêmico e capacidade de transformar conceitos complexos em estruturas operacionais reais.",
          "Com trajetória marcada pela multidisciplinaridade e pela inquietude intelectual, iniciou formação em Direito, Filosofia e Marketing, aprofundando-se especialmente em temas ligados à constitucionalidade, política pública, comportamento humano e estruturas sociais. Seu trabalho acadêmico em Direito teve como foco Alienação Parental, além da produção de artigos voltados à análise constitucional e políticas públicas.",
          "Mais do que seguir caminhos convencionais, Bruce construiu uma mentalidade voltada à compreensão profunda de sistemas — jurídicos, econômicos, tecnológicos e comportamentais — utilizando essa capacidade analítica como base para criação de negócios, produtos e ecossistemas digitais.",
          "Aprovado em concurso público no estado do Rio de Janeiro, posteriormente direcionou sua trajetória para o empreendedorismo e inovação tecnológica, movido pela convicção de que grandes transformações surgem da capacidade de questionar padrões estabelecidos e executar novas arquiteturas de solução.",
          "Sua trajetória internacional ganhou novo marco ao ser aceito na Austrália por meio do programa Global Talent, tendo como base sua atuação e reconhecimento no Brazilian Jiu-Jitsu como coach de alta performance — conquista que viabilizou sua residência permanente no país e o atual processo de cidadania australiana.",
          "Hoje, residente permanente na Austrália, lidera o desenvolvimento de projetos voltados à inteligência artificial, automação operacional, protocolos digitais, segurança tecnológica e sistemas autônomos de conversão e aquisição de clientes.",
          "Seu perfil combina profundidade analítica, pensamento provocativo, criatividade estratégica e forte capacidade de execução prática — características que o levaram a construir projetos complexos em múltiplos segmentos simultaneamente.",
          "Apaixonado por filosofia, direito constitucional, geopolítica, comportamento humano, inteligência artificial, tecnologia e empreendedorismo, Bruce acredita que conhecimento só possui valor real quando é capaz de gerar transformação concreta, impacto escalável e novas possibilidades para indivíduos e mercados.",
        ].map((para, i) => (
          <p key={i} className={`fade-up delay-${Math.min(i + 1, 6)} text-sm text-white/60 leading-relaxed tracking-wide`}>
            {para}
          </p>
        ))}
      </section>

      {/* Timeline */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-[0.3em] text-white/25 mb-4">Trajetória</div>
        <h2 className="text-2xl font-bold text-white mb-12 uppercase tracking-widest">Linha do Tempo</h2>

        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[72px] top-0 bottom-0 w-px bg-white/10" />

          {TIMELINE.map((item, i) => (
            <div key={i} className="relative flex gap-8 pb-10 last:pb-0">
              {/* Period badge */}
              <div className="w-[72px] shrink-0 flex justify-end pt-0.5">
                <span className="text-[10px] uppercase tracking-widest text-white/25 text-right leading-tight whitespace-nowrap pr-4">
                  {item.period}
                </span>
              </div>

              {/* Dot */}
              <div className="absolute left-[68px] top-1.5 w-2 h-2 rounded-full border border-white/30 bg-black z-10" />

              {/* Content */}
              <div className="flex-1 pl-4">
                <div className="text-xs font-bold uppercase tracking-widest text-white mb-2">{item.label}</div>
                <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-[0.3em] text-white/25 mb-4">Pilares</div>
        <h2 className="text-2xl font-bold text-white mb-12 uppercase tracking-widest">Competências-Chave</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {PILLARS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-black p-6 hover:bg-white/[0.02] transition-colors group">
              <Icon className="h-5 w-5 text-white/20 mb-4 group-hover:text-white/40 transition-colors" />
              <div className="text-xs font-bold uppercase tracking-widest text-white mb-2">{label}</div>
              <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Countries */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-[0.3em] text-white/25 mb-4">Experiência Internacional</div>
        <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-widest">Países</h2>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(c => (
            <span key={c} className="text-[11px] uppercase tracking-widest text-white/40 border border-white/10 px-3 py-1.5 hover:border-white/25 hover:text-white/60 transition-all">
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* NexOS AI project highlight */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="border border-white/10 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full"
            style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />

          <div className="relative">
            <div className="text-xs uppercase tracking-[0.3em] text-white/25 mb-4">Projeto Principal</div>
            <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-widest">NexOS AI</h2>
            <p className="text-sm text-white/50 leading-relaxed max-w-2xl mb-8">
              Uma arquitetura avançada de inteligência artificial voltada à automação completa de operações digitais de marketing, vendas, retenção e aquisição. Múltiplos agentes especializados capazes de executar campanhas, analisar métricas, adaptar estratégias e operar ecossistemas de crescimento digital de forma contínua e autônoma.
            </p>
            <a href="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/60 border border-white/20 px-5 py-2.5 hover:bg-white/5 hover:text-white transition-all">
              Conhecer a plataforma <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-white/5 max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <img src={nexosLogo} alt="NexOS" className="h-5 w-5 object-contain opacity-50" />
          <span className="text-xs text-white/25 uppercase tracking-widest">NexOS AI</span>
        </a>
        <span className="text-[10px] text-white/15 uppercase tracking-widest">Criado e desenvolvido por Bruce Allan</span>
      </div>
    </div>
  );
}
