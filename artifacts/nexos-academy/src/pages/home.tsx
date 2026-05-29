import { useState } from "react";
import { CURRICULUM, PRODUCTS } from "@/data/curriculum";
import { type BrandConfig, DEFAULT_BRAND } from "@/pages/owner";

interface HomeProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  hasAccess: boolean;
  brand?: BrandConfig;
}

// ─── Dashboard view (for logged-in students) ─────────────────────────────────
function Dashboard({ onNavigate, progress, brand: brandProp }: Omit<HomeProps, "hasAccess">) {
  const brand = brandProp ?? DEFAULT_BRAND;
  const allChapters = CURRICULUM.flatMap(m => m.chapters);
  const totalLessons = CURRICULUM.flatMap(m => m.chapters).flatMap(c => c.lessons).length;
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const progressPct = Math.round((completedLessons / totalLessons) * 100);
  const nextChapter = allChapters.find(ch => !ch.locked && !progress[ch.id + "_done"]);

  return (
    <div className="space-y-8">
      {/* Hero resumido para aluno */}
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(250_90%_65%/0.2)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8 hero-glow">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge-primary">⚡ {brand.academyName || "NexOS Academy"}</span>
            <span className="badge-primary badge-gold">{CURRICULUM.length} Módulos · {allChapters.length} Capítulos</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-3">
            {completedLessons === 0 ? "Bem-vindo à Academia." : `Você está em ${progressPct}% da jornada.`}
          </h1>
          <p className="text-[hsl(220_10%_65%)] text-base leading-relaxed mb-5">
            {completedLessons === 0
              ? "Comece pelo Módulo 1 e siga a sequência. Cada aula foi construída para que a próxima faça mais sentido."
              : `${completedLessons} de ${totalLessons} aulas concluídas. Continue de onde parou.`}
          </p>
          <div className="flex gap-3">
            {nextChapter ? (
              <button className="btn-primary" onClick={() => onNavigate("lesson", { chapterId: nextChapter.id })}>
                <span>{completedLessons === 0 ? "▶" : "→"}</span>
                {completedLessons === 0 ? "Começar Módulo 1" : "Continuar"}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => onNavigate("modules")}>
                <span>📚</span> Ver Todos os Módulos
              </button>
            )}
            <button className="btn-outline" onClick={() => onNavigate("modules")}>
              Ver Currículo Completo
            </button>
          </div>
        </div>
        <div className="absolute right-8 top-8 opacity-15 text-6xl floating-icon select-none hidden md:block">⚡</div>
      </div>

      {/* Barra de progresso */}
      {completedLessons > 0 && (
        <div className="card-nexos rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">Seu Progresso Geral</p>
              <p className="text-xs text-[hsl(220_10%_50%)] mt-0.5">{completedLessons} de {totalLessons} aulas concluídas</p>
            </div>
            <span className="text-2xl font-extrabold" style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {progressPct}%
            </span>
          </div>
          <div className="progress-bar-track h-2">
            <div className="progress-bar-fill h-2" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Módulos", value: CURRICULUM.length, icon: "📦" },
          { label: "Capítulos", value: allChapters.length, icon: "📖" },
          { label: "Aulas", value: totalLessons, icon: "🎓" },
          { label: "Horas de Conteúdo", value: "18+", icon: "⏱" },
        ].map(stat => (
          <div key={stat.label} className="stat-card text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-extrabold text-white">{stat.value}</div>
            <div className="text-xs text-[hsl(220_10%_50%)] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Módulos */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">Módulos do Curso</h2>
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => onNavigate("modules")}>
            Ver Todos →
          </button>
        </div>
        <div className="space-y-3">
          {CURRICULUM.map(module => {
            const moduleLessons = module.chapters.flatMap(c => c.lessons);
            const moduleDone = moduleLessons.filter(l => progress[l.id]).length;
            const pct = Math.round((moduleDone / moduleLessons.length) * 100);
            return (
              <div
                key={module.id}
                className="card-nexos rounded-xl p-5 cursor-pointer hover:border-[hsl(250_90%_65%/0.4)] transition-all"
                onClick={() => onNavigate("module", { moduleId: module.id })}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.2)] flex items-center justify-center text-sm font-bold text-[hsl(250_90%_75%)] shrink-0">
                    {module.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white text-sm">{module.title}</h3>
                      <span className="badge-primary">{module.badge}</span>
                      {moduleDone > 0 && <span className="text-[hsl(168_100%_50%)] text-[10px] font-bold">✓ {moduleDone}/{moduleLessons.length}</span>}
                    </div>
                    <p className="text-xs text-[hsl(220_10%_55%)] leading-relaxed mb-3">{module.description}</p>
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-[hsl(220_20%_10%)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? "hsl(168 100% 42%)" : "var(--gradient-primary)" }} />
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: pct === 100 ? "hsl(168 100% 50%)" : "hsl(250 90% 70%)", minWidth: "28px", textAlign: "right" }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bridge to platform */}
      <div className="rounded-xl border border-[hsl(250_90%_65%/0.25)] bg-gradient-to-br from-[hsl(250_30%_8%)] to-[hsl(222_25%_6%)] p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[hsl(250_90%_65%/0.55)] mb-2">⚡ Próximo nível</div>
            <h3 className="text-lg font-extrabold text-white leading-snug mb-2">
              Já domina a estratégia?{" "}
              <span style={{ color: "hsl(250 90% 70%)" }}>A plataforma executa por você.</span>
            </h3>
            <p className="text-sm text-[hsl(220_10%_52%)] leading-relaxed max-w-md">
              A Academia te dá o mapa. A <strong className="text-[hsl(220_10%_72%)]">NexOS</strong> faz o lançamento acontecer — 57 especialistas, do briefing à venda.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <a href="/landing/" className="inline-flex items-center justify-center gap-2 px-7 py-3 font-mono text-[11px] uppercase tracking-widest font-bold text-white border border-[hsl(250_90%_65%/0.5)] hover:border-[hsl(250_90%_65%/0.9)] hover:bg-[hsl(250_90%_65%/0.08)] transition-all whitespace-nowrap">
              Conhecer a plataforma →
            </a>
            <p className="text-[10px] font-mono text-[hsl(220_10%_35%)] text-center">Dois caminhos. Destino idêntico.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Landing Page (for non-logged-in visitors) ────────────────────────────────
function AcademyLanding({ onNavigate }: Pick<HomeProps, "onNavigate">) {
  const totalLessons = CURRICULUM.flatMap(m => m.chapters).flatMap(c => c.lessons).length;
  const allChapters = CURRICULUM.flatMap(m => m.chapters);

  const modulos = [
    { n: "01", titulo: "Economia da Atenção & Tráfego", desc: "Como o algoritmo filtra 99,9% do conteúdo e como engenheirar atenção nos primeiros 1,7 segundos. Meta Ads, Google, orgânico.", badge: "Fundação", cor: "from-blue-600 to-indigo-700" },
    { n: "02", titulo: "Fórmula de Lançamento & PLF", desc: "A estrutura completa do Product Launch Formula adaptada ao Brasil. Os 12 gatilhos comportamentais operacionalizados como regras, não conceitos.", badge: "Método", cor: "from-violet-600 to-purple-700" },
    { n: "03", titulo: "Modelos de Lançamento & Monetização", desc: "Semente, Perpétuo, Interno, Externo, Afiliado. Escada de valor, upsell, downsell e recorrência — com a matemática de LTV por modelo.", badge: "Monetização", cor: "from-emerald-600 to-teal-700" },
    { n: "04", titulo: "Plataformas, Ferramentas & Produção", desc: "TikTok, Instagram, Facebook, YouTube — como cada algoritmo distribui e o que produzir para cada um. Setup operacional completo.", badge: "Canais", cor: "from-rose-600 to-pink-700" },
    { n: "05", titulo: "Meta Ads: Fundamentos & Avançado", desc: "Estrutura de campanha para lançamentos. Públicos, criativos, CAPI, otimização, mensuração. O que os gestores de tráfego cobram R$8k/mês para fazer.", badge: "Tráfego", cor: "from-orange-600 to-amber-700" },
    { n: "06", titulo: "NexOS — A Plataforma que Executa", desc: "Como o sistema de 57 agentes transforma cada framework desta Academia em execução automatizada — do briefing ao carrinho fechado.", badge: "Automação", cor: "from-cyan-600 to-blue-700" },
    { n: "07", titulo: "Domínio Total dos Algoritmos", desc: "TikTok, Instagram, YouTube, Facebook, Google. Seis sistemas de distribuição desmontados: o que cada um mede, recompensa e penaliza.", badge: "Algoritmos", cor: "from-indigo-600 to-violet-700" },
    { n: "08", titulo: "Operações, Automação & Calendário", desc: "Webhooks, Make/Zapier, sequências de automação, calendário operacional de 30 dias, distribuição de budget por fase.", badge: "Operações", cor: "from-slate-600 to-gray-700" },
    { n: "09", titulo: "Copywriting & Persuasão Avançada", desc: "Gatilhos aplicados, estruturas de copy para landing, VSL, email e WhatsApp. Storytelling de vendas. Provas sociais documentadas.", badge: "Copy", cor: "from-pink-600 to-rose-700" },
    { n: "10", titulo: "Produto Digital & Audiência", desc: "Jobs-to-be-done, pesquisa de mercado, avatar real vs. imaginado, criação de produto, precificação e escolha de plataforma de entrega.", badge: "Produto", cor: "from-teal-600 to-emerald-700" },
    { n: "11", titulo: "Frequências Mentais & Identidade", desc: "O ciclo neuroestrutural do empreendedor. As 4 frequências de operação e por que a maioria trava na Frequência 1 sem saber.", badge: "Mindset", cor: "from-purple-600 to-fuchsia-700" },
    { n: "12", titulo: "Psicologia Avançada de Vendas", desc: "Os frameworks que os melhores copywriters e estrategistas do mundo usam: Schwartz, Kahneman, Cialdini Pre-Suasion, Van Westendorp, Jay Abraham, Bencivenga.", badge: "Premium", cor: "from-amber-600 to-yellow-700" },
  ];

  const frameworks = [
    { autor: "Eugene Schwartz", doutrina: "5 Níveis de Sofisticação de Mercado", aplicacao: "Determina o tipo de lead, headline e tom para cada campanha" },
    { autor: "Daniel Kahneman", doutrina: "Prospect Theory — Aversão à Perda", aplicacao: "Frame de urgência e escassez que gera 2x mais resposta que promessa de ganho" },
    { autor: "Robert Cialdini", doutrina: "Pre-Suasion — Atenção Precede Persuasão", aplicacao: "Como preparar o frame mental do prospect antes da oferta principal" },
    { autor: "Gary Bencivenga", doutrina: "Proof Principle — A Pirâmide de Evidência", aplicacao: "Hierarquia de provas que elimina o ceticismo racional de forma irrefutável" },
    { autor: "Jay Abraham", doutrina: "Strategy of Preeminence — O Próximo Problema", aplicacao: "Upsell baseado no obstáculo real pós-compra — não no produto que você quer vender" },
    { autor: "Perry Marshall", doutrina: "80/20 em Tráfego Pago", aplicacao: "Identifica os 4% de anúncios que geram 64% das conversões e onde dobrar" },
    { autor: "Blair Warren", doutrina: "One Sentence Persuasion", aplicacao: "A estrutura de 5 elementos que está na base de toda copy que converte" },
    { autor: "Van Westendorp", doutrina: "Price Sensitivity Meter (PSM)", aplicacao: "Encontra o preço ótimo com 4 perguntas — antes de lançar qualquer produto" },
  ];

  const depoimentos = [
    {
      resultado: "R$134k",
      prazo: "7 dias de carrinho",
      nome: "Rodrigo M.",
      cargo: "Produtor digital — Finanças Pessoais",
      depo: "Fiz a FL duas vezes antes da Academia. O que mudou foi entender o porquê de cada elemento — não apenas o como. Meu copy ficou irrecusável porque entendi o nível de sofisticação do meu avatar.",
    },
    {
      resultado: "R$41k",
      prazo: "Primeiro lançamento solo",
      nome: "André L.",
      cargo: "Infoprodutor — Produtividade",
      depo: "Nunca tinha lançado. Achei que precisava de equipe, de agência, de orçamento alto. A Academia me mostrou que o problema era operacional — e que a equipe especializada resolve a operação quando você tem o método.",
    },
    {
      resultado: "CPL de R$27 → R$11",
      prazo: "72 horas de otimização",
      nome: "Camila F.",
      cargo: "Gestora de Tráfego",
      depo: "O módulo de algoritmos e o de psicologia de vendas transformaram como eu faço anúncios. Não é mais 'testar criativos' — é engenheirar atenção com método científico.",
    },
  ];

  return (
    <div className="space-y-0 -mx-4 -mt-8">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(222_25%_5%)] via-[hsl(250_30%_7%)] to-[hsl(222_25%_4%)] px-6 py-20 md:py-28 hero-glow">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <span className="badge-primary">⚡ NexOS Academy</span>
            <span className="badge-primary badge-gold">12 Módulos · {allChapters.length} Capítulos · {totalLessons} Aulas</span>
            <span className="badge-primary" style={{ borderColor: "hsl(250 90% 65% / 0.3)", color: "hsl(250 90% 75%)" }}>🇧🇷 PT-BR</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            O método completo de lançamento digital.<br />
            <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Do briefing ao algoritmo.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[hsl(220_10%_65%)] leading-relaxed mb-4 max-w-2xl">
            A única Academia que ensina o método que os <strong className="text-white">57 especialistas do NexOS</strong> usam para orquestrar lançamentos completos — com os frameworks reais de Schwartz, Cialdini, Kahneman, Bencivenga e Jay Abraham operacionalizados como regras de decisão.
          </p>
          <p className="text-sm text-[hsl(220_10%_45%)] mb-10 max-w-xl">
            Não é teoria de livro. É o mapa exato que transforma conhecimento em execução — e execução em resultado mensurável.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button className="btn-primary text-base px-8 py-4 font-bold" onClick={() => onNavigate("products")}>
              <span>🔓</span> Adquirir Acesso Completo
            </button>
            <button className="btn-outline text-base px-8 py-4" onClick={() => onNavigate("products")}>
              <span>📄</span> Baixar Guia Gratuito
            </button>
          </div>

          <div className="flex flex-wrap gap-6 text-xs text-[hsl(220_10%_40%)] font-mono">
            <span>✓ Acesso vitalício</span>
            <span>✓ {totalLessons} aulas em texto denso</span>
            <span>✓ Exercícios práticos por aula</span>
            <span>✓ Glossário com 80+ termos</span>
          </div>
        </div>

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, hsl(250 90% 65%), transparent 70%)" }} />
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="bg-[hsl(222_25%_5%)] border-y border-[hsl(220_20%_10%)] px-6 py-5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: `${CURRICULUM.length}`, label: "Módulos Completos" },
            { n: `${allChapters.length}`, label: "Capítulos" },
            { n: `${totalLessons}+`, label: "Aulas em Texto Denso" },
            { n: "8", label: "Frameworks de Classe Mundial" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold mb-1" style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.n}</div>
              <div className="text-xs text-[hsl(220_10%_45%)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-16 max-w-4xl mx-auto space-y-20">

        {/* ── DOR / AGITAÇÃO ── */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-rose-500/60 mb-4">— O cenário que ninguém quer admitir —</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
            Você sabe o que fazer.<br />
            <span className="text-[hsl(220_10%_42%)]">Mas ainda não está fazendo.</span>
          </h2>
          <p className="text-sm text-[hsl(220_10%_50%)] mb-8 max-w-2xl leading-relaxed">
            Não é falta de conhecimento. Você já leu os livros, já assistiu os cursos, já entende os conceitos. O problema é a distância entre saber e executar — e o custo de ficar nessa distância.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                titulo: "Você tem produto. Não tem lançamento.",
                desc: "O produto está pronto faz meses. Cada semana sem lançar é receita que não entra, lista que esfria e janela de mercado que fecha. O problema não é o produto — é a operação.",
                cor: "border-rose-500/40",
              },
              {
                titulo: "Você testa. Não escala.",
                desc: "Já fez anúncio, já investiu em tráfego, já teve algum resultado. Mas não sabe exatamente por que funcionou — então não consegue replicar. Cada lançamento parece o primeiro.",
                cor: "border-amber-500/40",
              },
              {
                titulo: "Você executa. Mas quebra no detalhe.",
                desc: "Sabe a estratégia. Mas no dia do carrinho aberto, algo quebra — disparo errado, copy genérica, sequência fora de ordem. O mercado não perdoa falha de execução.",
                cor: "border-blue-500/40",
              },
            ].map((item, i) => (
              <div key={i} className={`card-nexos rounded-xl p-5 border-l-2 ${item.cor}`}>
                <div className="text-xs font-mono uppercase tracking-widest text-[hsl(220_10%_65%)] mb-2 font-bold">{item.titulo}</div>
                <p className="text-sm text-[hsl(220_10%_50%)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[hsl(250_90%_65%/0.2)] bg-[hsl(250_30%_7%)] px-6 py-5">
            <p className="text-sm text-[hsl(220_10%_60%)] leading-relaxed">
              <strong className="text-white">A Academia existe para fechar essa distância.</strong>{" "}
              Não como revisão de conteúdo — como sistema de decisão operacional. Você sai sabendo exatamente o que fazer, em que ordem, por quê, e o que muda se você mudar qualquer variável.
            </p>
          </div>
        </div>

        {/* ── PARA QUEM É ── */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Para quem é esta Academia —</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-8">Se isso soa familiar, você está no lugar certo.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { titulo: "Você tem produto mas ainda não lançou", desc: "Sabe que tem valor, mas a complexidade do lançamento trava a execução. Quer o mapa completo antes de investir em tráfego." },
              { titulo: "Você já lançou mas quer escalar com método", desc: "Seu lançamento funcionou, mas foi baseado em feeling. Quer entender por que funcionou — e como replicar com consistência." },
              { titulo: "Você é gestor de tráfego e quer ir além do anúncio", desc: "Já domina Meta Ads, mas quer entender estratégia de lançamento, psicologia de compra e como o anúncio se encaixa no funil completo." },
              { titulo: "Você quer usar equipe especializada mas primeiro quer o método", desc: "Entende que a automação só funciona quando você sabe o que está automatizando. Quer o método antes de ativar os especialistas." },
            ].map((item, i) => (
              <div key={i} className="card-nexos rounded-xl p-5">
                <div className="text-[hsl(250_90%_75%)] text-xs font-mono uppercase tracking-widest mb-2 border-l-2 border-[hsl(250_90%_65%/0.4)] pl-3">{item.titulo}</div>
                <p className="text-sm text-[hsl(220_10%_55%)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── AUTORIDADE — Por que confiar neste método ── */}
        <div className="rounded-2xl border border-[hsl(250_90%_65%/0.2)] bg-gradient-to-br from-[hsl(250_30%_7%)] to-[hsl(222_25%_5%)] p-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Por que confiar neste método —</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-5">
                Este não é mais um curso.<br />
                <span style={{ color: "hsl(250 90% 70%)" }}>É o mapa que os especialistas usam.</span>
              </h2>
              <div className="space-y-4 text-sm text-[hsl(220_10%_58%)] leading-relaxed">
                <p>
                  Cada framework desta Academia foi operacionalizado como regra de decisão dentro dos 57 especialistas do NexOS. Não é teoria que você vai tentar aplicar depois — é o mesmo raciocínio que o sistema executa automaticamente em cada lançamento.
                </p>
                <p>
                  A diferença entre "conhecer o método" e "dominar o método" é saber exatamente quando e como cada variável muda a decisão. A Academia cruza essa distância.
                </p>
                <p className="text-white font-semibold">
                  Você aprende o que funciona porque está vendo de dentro do sistema que já executa centenas de lançamentos.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { num: "R$2.3B+", label: "em campanhas analisadas para calibrar os frameworks" },
                { num: "1.200+", label: "lançamentos documentados como base de treinamento" },
                { num: "8", label: "frameworks de classe mundial operacionalizados como regras" },
                { num: "12", label: "módulos sequenciados do fundamento ao avançado" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-[hsl(250_90%_65%/0.15)] bg-[hsl(250_90%_65%/0.05)] p-4">
                  <div className="text-xl font-extrabold mb-1" style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{item.num}</div>
                  <div className="text-[11px] text-[hsl(220_10%_48%)] leading-relaxed">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 12 MÓDULOS ── */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Currículo Completo —</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">12 módulos. Do básico ao avançado.</h2>
          <p className="text-sm text-[hsl(220_10%_55%)] mb-8 max-w-xl">
            Cada módulo foi construído com o mesmo framework dos especialistas — não como revisão de conteúdo, mas como sistema de decisão operacional.
          </p>
          <div className="space-y-3">
            {modulos.map((m, i) => (
              <div key={i} className="card-nexos rounded-xl p-5 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shrink-0 bg-gradient-to-br ${m.cor}`}>
                  {m.n}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white text-sm">{m.titulo}</span>
                    <span className={`badge-primary text-[10px] ${m.badge === "Premium" ? "badge-gold" : ""}`}>{m.badge}</span>
                  </div>
                  <p className="text-xs text-[hsl(220_10%_50%)] leading-relaxed">{m.desc}</p>
                </div>
                <div className="text-[hsl(220_10%_25%)] text-lg shrink-0">🔒</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FRAMEWORKS ── */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Os Mestres por Trás do Método —</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
            Cada framework operacionalizado como regra de decisão.
          </h2>
          <p className="text-sm text-[hsl(220_10%_55%)] mb-8 max-w-2xl">
            A diferença entre estudar marketing e dominar marketing é a distância entre "conheço este conceito" e "sei exatamente quando e como aplicar". Esta Academia cruza essa distância.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {frameworks.map((fw, i) => (
              <div key={i} className="card-nexos rounded-xl p-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.2)] flex items-center justify-center text-[hsl(250_90%_75%)] font-bold text-xs shrink-0">{i + 1}</div>
                  <div>
                    <div className="font-bold text-white text-sm">{fw.autor}</div>
                    <div className="text-[11px] text-[hsl(250_90%_65%/0.8)] font-mono uppercase tracking-widest">{fw.doutrina}</div>
                  </div>
                </div>
                <p className="text-xs text-[hsl(220_10%_55%)] leading-relaxed pl-11">{fw.aplicacao}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── DEPOIMENTOS ── */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Resultados Reais —</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-8">
            O que muda quando você tem o método.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {depoimentos.map((d, i) => (
              <div key={i} className="card-nexos rounded-xl p-6 flex flex-col gap-4">
                <div className="border-l-2 border-[hsl(250_90%_65%/0.6)] pl-4">
                  <div className="font-extrabold text-2xl" style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{d.resultado}</div>
                  <div className="text-[10px] text-[hsl(250_90%_65%/0.6)] uppercase tracking-widest mt-0.5 font-mono">{d.prazo}</div>
                </div>
                <blockquote className="text-xs text-[hsl(220_10%_65%)] leading-relaxed italic flex-1">"{d.depo}"</blockquote>
                <div>
                  <div className="text-sm font-bold text-white">{d.nome}</div>
                  <div className="text-[10px] text-[hsl(220_10%_45%)] uppercase tracking-widest">{d.cargo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── URGÊNCIA — Preço de lançamento ── */}
        <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-[hsl(0_60%_7%)] to-[hsl(222_25%_5%)] p-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-rose-500/60 mb-4">— Preço de Lançamento —</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
                Esta janela fecha.<br />
                <span className="text-[hsl(220_10%_42%)]">Sem data fixa de encerramento.</span>
              </h2>
              <div className="space-y-3 text-sm text-[hsl(220_10%_55%)] leading-relaxed">
                <p>
                  O acesso à NexOS Academy está em lançamento inaugural. O preço atual — R$2.500 — é o preço de acesso de abertura. Após esta janela, sobe para R$3.900.
                </p>
                <p>
                  Os primeiros alunos testam o método, geram os primeiros resultados e tornam-se a prova social que justifica o próximo preço. É a lógica da Fórmula de Lançamento — e você está vendo ela acontecer agora, em tempo real.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-6 py-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-rose-400/60 font-bold">Preço atual</div>
                  <div className="text-2xl font-extrabold text-white">R$2.500</div>
                </div>
                <div className="text-[11px] text-[hsl(220_10%_40%)] font-mono">Acesso vitalício · Ticket único · Sem mensalidade</div>
              </div>
              <div className="rounded-xl border border-[hsl(220_20%_12%)] bg-[hsl(222_25%_5%)] px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[hsl(220_10%_35%)] mb-1">Após lançamento</div>
                  <div className="text-xl font-extrabold text-[hsl(220_10%_30%)] line-through">R$3.900</div>
                </div>
                <div className="text-[11px] text-[hsl(220_10%_35%)] font-mono text-right">Preço regular<br />sem data definida</div>
              </div>
              <button
                className="btn-primary w-full text-base py-4 font-bold"
                onClick={() => onNavigate("products")}
              >
                Garantir acesso no preço de lançamento →
              </button>
              <p className="text-[11px] font-mono text-[hsl(220_10%_35%)] text-center">
                30 dias de garantia · Acesso imediato após confirmação
              </p>
            </div>
          </div>
        </div>

        {/* ── O QUE ESTÁ INCLUSO ── */}
        <div className="rounded-2xl border border-[hsl(250_90%_65%/0.25)] bg-gradient-to-br from-[hsl(250_30%_8%)] to-[hsl(222_25%_6%)] p-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[hsl(250_90%_65%/0.6)] mb-4">— Edição Completa —</div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Metodologia NexOS — Tudo incluso.</h2>
          <p className="text-sm text-[hsl(220_10%_55%)] mb-6">Um investimento único. Acesso vitalício. O mapa completo de lançamento digital.</p>
          {/* Professor equipe especializada highlight */}
          <div className="rounded-xl border border-[hsl(250_90%_65%/0.35)] bg-[hsl(250_90%_65%/0.06)] px-6 py-5 mb-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(250_90%_65%)] to-[hsl(280_80%_60%)] flex items-center justify-center text-white text-lg shrink-0 shadow-lg">
              🎓
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[hsl(250_90%_65%/0.7)] mb-1">Incluso no seu acesso</div>
              <div className="font-extrabold text-white text-base mb-1">
                Professor equipe especializada — sempre pronto pra te atender
              </div>
              <p className="text-sm text-[hsl(220_10%_58%)] leading-relaxed">
                A qualquer momento que tiver dúvida, o Professor responde, ensina e explica — com exemplos práticos do seu contexto, no seu ritmo, quantas vezes quiser.
                Não precisa esperar aula ao vivo nem suporte com prazo de resposta.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {[
              "12 módulos com conteúdo denso e aplicado",
              `${totalLessons}+ aulas com exercício prático por aula`,
              "Professor equipe especializada disponível 24h — responde qualquer dúvida",
              "Glossário completo com 80+ termos técnicos",
              "Frameworks de Schwartz, Kahneman, Cialdini e mais",
              "Módulo exclusivo de Psicologia Avançada de Vendas",
              "Cases documentados com números reais",
              "Acesso vitalício com atualizações incluídas",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[hsl(220_10%_65%)]">
                <span className="text-[hsl(168_100%_50%)] shrink-0">✓</span> {item}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button className="btn-primary text-base px-10 py-4 font-bold" onClick={() => onNavigate("products")}>
              Adquirir Acesso Completo →
            </button>
            <div className="text-sm text-[hsl(220_10%_45%)]">
              Ou{" "}
              <button className="text-[hsl(250_90%_70%)] underline underline-offset-2" onClick={() => onNavigate("products")}>
                baixe o guia gratuito
              </button>{" "}
              primeiro.
            </div>
          </div>
        </div>

        {/* ── BRIDGE TO PLATFORM ── */}
        <div className="border border-[hsl(220_20%_12%)] rounded-xl p-7 bg-[hsl(222_25%_5%)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[hsl(250_90%_65%/0.55)] mb-2">→ Próximo passo depois da Academia</div>
              <h3 className="text-xl font-extrabold text-white mb-2">
                A plataforma que <span style={{ color: "hsl(250 90% 70%)" }}>executa o método por você.</span>
              </h3>
              <p className="text-sm text-[hsl(220_10%_52%)] leading-relaxed">
                A NexOS tem 57 especialistas que aplicam cada framework desta Academia automaticamente — geração de copy, anúncios, email, WhatsApp, e otimização em tempo real.
              </p>
            </div>
            <div className="shrink-0">
              <a href="/landing/" className="inline-flex items-center justify-center gap-2 px-7 py-3 font-mono text-[11px] uppercase tracking-widest font-bold text-white border border-[hsl(250_90%_65%/0.4)] hover:border-[hsl(250_90%_65%/0.8)] hover:bg-[hsl(250_90%_65%/0.08)] transition-all whitespace-nowrap">
                Ver a plataforma →
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Home({ onNavigate, progress, hasAccess, brand }: HomeProps) {
  if (!hasAccess) {
    return <AcademyLanding onNavigate={onNavigate} />;
  }
  return <Dashboard onNavigate={onNavigate} progress={progress} brand={brand} />;
}
