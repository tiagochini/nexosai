import { useState } from "react";
import { CURRICULUM, PRODUCTS } from "@/data/curriculum";

interface HomeProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
}

export default function Home({ onNavigate, progress }: HomeProps) {
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const totalLessons = CURRICULUM.flatMap(m => m.chapters).flatMap(c => c.lessons).length;
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const progressPct = Math.round((completedLessons / totalLessons) * 100);

  const allChapters = CURRICULUM.flatMap(m => m.chapters);
  const nextChapter = allChapters.find(ch => !ch.locked && !progress[ch.id + "_done"]);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(250_90%_65%/0.2)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8 md:p-12 hero-glow">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="badge-primary">⚡ NexOS Academy</span>
            <span className="badge-primary badge-gold">10 Módulos · 34 Capítulos · 118 Aulas</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">
            Crie, Lance e Venda{" "}
            <br />
            <span className="shimmer-text">Produtos Digitais</span>
          </h1>
          <p className="text-[hsl(220_10%_70%)] text-lg leading-relaxed mb-6">
            Formação completa em lançamentos: estratégia, tráfego pago e orgânico, copywriting, automações, criação de produto e como transformar sua audiência em clientes.
          </p>
          <div className="flex flex-wrap gap-3">
            {nextChapter ? (
              <button
                className="btn-primary"
                onClick={() => onNavigate("lesson", { chapterId: nextChapter.id })}
              >
                <span>▶</span>
                {completedLessons === 0 ? "Começar Agora" : "Continuar"}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => onNavigate("modules")}>
                <span>📚</span> Ver Módulos
              </button>
            )}
            <button className="btn-outline" onClick={() => onNavigate("products")}>
              <span>🛒</span> Adquirir Ebook
            </button>
          </div>
        </div>

        {/* Floating icons */}
        <div className="absolute right-8 top-8 opacity-20 text-6xl floating-icon select-none hidden md:block">⚡</div>
        <div className="absolute right-32 bottom-8 opacity-10 text-4xl floating-icon select-none hidden md:block" style={{ animationDelay: "1.5s" }}>🚀</div>
      </div>

      {/* Progress Bar */}
      {completedLessons > 0 && (
        <div className="card-nexos rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">Seu Progresso</p>
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
          { label: "Horas de Conteúdo", value: "12+", icon: "⏱" },
        ].map(stat => (
          <div key={stat.label} className="stat-card text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-extrabold text-white">{stat.value}</div>
            <div className="text-xs text-[hsl(220_10%_50%)] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Modules Overview */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">Módulos do Curso</h2>
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => onNavigate("modules")}>
            Ver Todos →
          </button>
        </div>
        <div className="space-y-4">
          {CURRICULUM.map(module => {
            const moduleChapters = module.chapters;
            const moduleLessons = moduleChapters.flatMap(c => c.lessons);
            const moduleDone = moduleLessons.filter(l => progress[l.id]).length;
            return (
              <div
                key={module.id}
                className="card-nexos rounded-xl p-5 cursor-pointer"
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
                    </div>
                    <p className="text-xs text-[hsl(220_10%_55%)] leading-relaxed mb-3">{module.description}</p>
                    <div className="flex items-center gap-4 text-xs text-[hsl(220_10%_45%)] mb-2.5">
                      <span>{moduleChapters.length} capítulos</span>
                      <span>{moduleLessons.length} aulas</span>
                      {moduleDone > 0 && (
                        <span className="text-[hsl(168_100%_50%)] font-semibold">✓ {moduleDone}/{moduleLessons.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-[hsl(220_20%_10%)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((moduleDone / moduleLessons.length) * 100)}%`,
                            background: moduleDone === moduleLessons.length
                              ? "hsl(168 100% 42%)"
                              : "var(--gradient-primary)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{
                        color: moduleDone === moduleLessons.length ? "hsl(168 100% 50%)" : "hsl(250 90% 70%)",
                        minWidth: "28px",
                        textAlign: "right",
                      }}>
                        {Math.round((moduleDone / moduleLessons.length) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Products */}
      <div>
        <h2 className="text-xl font-bold text-white mb-5">Produtos Disponíveis</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRODUCTS.map(product => (
            <div
              key={product.id}
              className="card-nexos rounded-xl p-6 cursor-pointer"
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
              onClick={() => onNavigate("products")}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`badge-primary ${product.type === "premium" ? "badge-gold" : ""}`}>{product.badge}</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-white">
                    R${product.price.toLocaleString("pt-BR")}
                  </div>
                  {product.type === "premium" && (
                    <div className="text-xs text-[hsl(220_10%_45%)]">acesso vitalício</div>
                  )}
                </div>
              </div>
              <h3 className="font-bold text-white mb-2">{product.name}</h3>
              <p className="text-sm text-[hsl(220_10%_55%)] mb-4">{product.description}</p>
              <ul className="space-y-1.5">
                {product.features.slice(0, hoveredProduct === product.id ? product.features.length : 3).map((f, i) => (
                  <li key={i} className="text-xs text-[hsl(220_10%_65%)] flex items-center gap-2">
                    <span className="text-[hsl(168_100%_50%)]">✓</span> {f}
                  </li>
                ))}
                {hoveredProduct !== product.id && product.features.length > 3 && (
                  <li className="text-xs text-[hsl(220_10%_45%)]">+ {product.features.length - 3} mais...</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
