import { useState, useMemo } from "react";
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryTerm } from "@/data/glossary";

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Lançamentos": "🚀",
  "Meta Ads & Tráfego Pago": "🎯",
  "Algoritmos & Plataformas": "🧮",
  "Copywriting & Persuasão": "✍️",
  "Email & WhatsApp Marketing": "📧",
  "Analytics & Métricas": "📊",
  "Monetização & Funis": "💰",
  "Automação & Ferramentas": "⚙️",
  "Negócio & Estratégia": "🏛",
  "SEO & Busca Orgânica": "🔍",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Lançamentos": "from-violet-600 to-purple-600",
  "Meta Ads & Tráfego Pago": "from-blue-600 to-blue-800",
  "Algoritmos & Plataformas": "from-slate-600 to-gray-700",
  "Copywriting & Persuasão": "from-amber-600 to-orange-600",
  "Email & WhatsApp Marketing": "from-green-600 to-emerald-600",
  "Analytics & Métricas": "from-cyan-600 to-teal-600",
  "Monetização & Funis": "from-rose-600 to-pink-600",
  "Automação & Ferramentas": "from-indigo-600 to-violet-600",
  "Negócio & Estratégia": "from-sky-600 to-blue-600",
  "SEO & Busca Orgânica": "from-lime-600 to-green-600",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Glossary({ onNavigate }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let terms = [...GLOSSARY];
    if (activeCategory) terms = terms.filter(t => t.category === activeCategory);
    if (activeLetter) terms = terms.filter(t => t.term[0].toUpperCase() === activeLetter);
    if (search.trim()) {
      const q = search.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return terms.sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));
  }, [search, activeCategory, activeLetter]);

  const lettersWithContent = useMemo(() => {
    const base = activeCategory
      ? GLOSSARY.filter(t => t.category === activeCategory)
      : GLOSSARY;
    return new Set(base.map(t => t.term[0].toUpperCase()));
  }, [activeCategory]);

  const grouped = useMemo(() => {
    const map: Record<string, GlossaryTerm[]> = {};
    for (const term of filtered) {
      const letter = term.term[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(term);
    }
    return map;
  }, [filtered]);

  const sortedLetters = Object.keys(grouped).sort();

  function clearFilters() {
    setSearch("");
    setActiveCategory(null);
    setActiveLetter(null);
  }

  const hasFilters = search || activeCategory || activeLetter;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="card p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 70% 50%, hsl(250 90% 60%), transparent 60%)" }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="badge">📖 GLOSSÁRIO COMPLETO</span>
            <span className="badge" style={{ background: "hsl(250 60% 15%)", color: "hsl(250 90% 75%)" }}>
              {GLOSSARY.length} termos
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Glossário do Marketing Digital
          </h1>
          <p className="text-[hsl(220_10%_60%)] max-w-2xl">
            Todos os termos, siglas e conceitos que você precisa dominar — da linguagem de algoritmos ao vocabulário de lançamentos, Meta Ads, copywriting e métricas. Definições profundas com exemplos práticos.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(220_10%_40%)] text-lg pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="Buscar termo, sigla ou conceito..."
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveLetter(null); }}
          className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-[hsl(220_20%_12%)] bg-[hsl(222_25%_6%)] text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:ring-2 focus:ring-[hsl(250_90%_60%/40%)] text-base"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(220_10%_40%)] hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-[hsl(220_10%_50%)]">
          <span>
            <span className="text-white font-semibold">{filtered.length}</span> termos
            {hasFilters && " encontrados"}
          </span>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[hsl(250_90%_70%)] hover:text-white transition-colors text-xs underline underline-offset-2">
              Limpar filtros
            </button>
          )}
        </div>
        <div className="text-xs text-[hsl(220_10%_40%)]">
          {GLOSSARY_CATEGORIES.length} categorias · {ALPHABET.filter(l => lettersWithContent.has(l)).length} letras
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar filters */}
        <aside className="space-y-5">
          {/* Categories */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-3">Categorias</h3>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveCategory(null); setActiveLetter(null); }}
                className={`sidebar-link w-full text-left text-sm ${!activeCategory ? "active" : ""}`}
              >
                <span>📚</span>
                <span>Todos os termos</span>
                <span className="ml-auto text-xs text-[hsl(220_10%_40%)]">{GLOSSARY.length}</span>
              </button>
              {GLOSSARY_CATEGORIES.map(cat => {
                const count = GLOSSARY.filter(t => t.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat === activeCategory ? null : cat); setActiveLetter(null); }}
                    className={`sidebar-link w-full text-left text-sm ${activeCategory === cat ? "active" : ""}`}
                  >
                    <span>{CATEGORY_ICONS[cat]}</span>
                    <span className="flex-1 leading-tight">{cat}</span>
                    <span className="ml-auto text-xs text-[hsl(220_10%_40%)] shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alphabet nav */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-3">Alfabético</h3>
            <div className="flex flex-wrap gap-1">
              {ALPHABET.map(letter => {
                const hasContent = lettersWithContent.has(letter);
                const isActive = activeLetter === letter;
                return (
                  <button
                    key={letter}
                    disabled={!hasContent}
                    onClick={() => { setActiveLetter(isActive ? null : letter); setSearch(""); }}
                    className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                      !hasContent
                        ? "text-[hsl(220_10%_20%)] cursor-not-allowed"
                        : isActive
                        ? "text-white"
                        : "text-[hsl(220_10%_55%)] hover:text-white hover:bg-[hsl(220_20%_10%)]"
                    }`}
                    style={isActive ? { background: "var(--gradient-primary)" } : {}}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category summary cards */}
          {!search && !activeLetter && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest px-1">Explorar por área</h3>
              {GLOSSARY_CATEGORIES.map(cat => {
                const count = GLOSSARY.filter(t => t.category === cat).length;
                const color = CATEGORY_COLORS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat === activeCategory ? null : cat); setActiveLetter(null); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activeCategory === cat
                        ? "border-[hsl(250_90%_60%/40%)] bg-[hsl(250_90%_60%/8%)]"
                        : "border-[hsl(220_20%_10%)] hover:border-[hsl(220_20%_18%)] bg-[hsl(222_25%_5%)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-xs bg-gradient-to-br ${color}`}>
                        {CATEGORY_ICONS[cat]}
                      </div>
                      <span className="text-xs font-semibold text-white">{cat}</span>
                    </div>
                    <div className="text-xs text-[hsl(220_10%_40%)] pl-7">{count} termos</div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Terms list */}
        <div className="min-w-0">
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-white mb-2">Nenhum termo encontrado</h3>
              <p className="text-[hsl(220_10%_50%)] mb-4">Tente buscar com outros termos ou remova os filtros ativos.</p>
              <button onClick={clearFilters} className="btn-primary text-sm px-4 py-2">
                Ver todos os termos
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedLetters.map(letter => (
                <div key={letter}>
                  {/* Letter divider */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      {letter}
                    </div>
                    <div className="flex-1 h-px bg-[hsl(220_20%_10%)]" />
                    <span className="text-xs text-[hsl(220_10%_35%)]">{grouped[letter].length} termo{grouped[letter].length !== 1 ? "s" : ""}</span>
                  </div>

                  <div className="space-y-3">
                    {grouped[letter].map(term => {
                      const isExpanded = expandedId === term.id;
                      const catColor = CATEGORY_COLORS[term.category] || "from-gray-600 to-gray-700";
                      return (
                        <div
                          key={term.id}
                          className={`card overflow-hidden transition-all ${isExpanded ? "ring-1 ring-[hsl(250_90%_60%/30%)]" : ""}`}
                        >
                          <button
                            className="w-full text-left p-5 flex items-start gap-4"
                            onClick={() => setExpandedId(isExpanded ? null : term.id)}
                          >
                            {/* Category dot */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 bg-gradient-to-br ${catColor}`}>
                              {CATEGORY_ICONS[term.category]}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <h3 className="font-bold text-white text-base leading-snug">{term.term}</h3>
                                  <span className="text-xs text-[hsl(220_10%_40%)] mt-0.5 inline-block">{term.category}</span>
                                </div>
                                <span className={`text-[hsl(220_10%_40%)] transition-transform duration-200 shrink-0 mt-1 ${isExpanded ? "rotate-180" : ""}`}>
                                  ▼
                                </span>
                              </div>

                              {/* Preview — always visible */}
                              <p className={`text-[hsl(220_10%_60%)] text-sm leading-relaxed mt-2 ${isExpanded ? "" : "line-clamp-2"}`}>
                                {term.definition}
                              </p>
                            </div>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-5 pb-5 space-y-4 border-t border-[hsl(220_20%_10%)] pt-4">
                              <div>
                                <h4 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-2">Definição Completa</h4>
                                <p className="text-[hsl(220_10%_65%)] text-sm leading-relaxed">{term.definition}</p>
                              </div>

                              {term.example && (
                                <div className="p-4 rounded-lg bg-[hsl(250_90%_60%/6%)] border border-[hsl(250_90%_60%/15%)]">
                                  <h4 className="text-xs font-bold text-[hsl(250_90%_75%)] uppercase tracking-widest mb-2">Exemplo Prático</h4>
                                  <p className="text-[hsl(220_10%_65%)] text-sm leading-relaxed italic">{term.example}</p>
                                </div>
                              )}

                              {term.related && term.related.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-2">Termos Relacionados</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {term.related.map(rel => {
                                      const found = GLOSSARY.find(g => g.term === rel);
                                      return found ? (
                                        <button
                                          key={rel}
                                          onClick={e => { e.stopPropagation(); setSearch(rel); setActiveCategory(null); setActiveLetter(null); setExpandedId(found.id); }}
                                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-[hsl(220_20%_10%)] text-[hsl(250_90%_75%)] hover:bg-[hsl(250_90%_60%/15%)] transition-colors"
                                        >
                                          {rel}
                                        </button>
                                      ) : (
                                        <span key={rel} className="px-2.5 py-1 rounded-md text-xs font-medium bg-[hsl(220_20%_8%)] text-[hsl(220_10%_45%)]">
                                          {rel}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
