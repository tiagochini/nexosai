import { useState } from "react";
import { CURRICULUM } from "@/data/curriculum";

const OWNER_PIN = "nexos2025";
const OWNER_KEY = "nexos-owner-mode";

export function isOwnerMode(): boolean {
  try {
    return localStorage.getItem(OWNER_KEY) === "true";
  } catch {
    return false;
  }
}

function setOwnerMode(val: boolean) {
  try {
    if (val) localStorage.setItem(OWNER_KEY, "true");
    else localStorage.removeItem(OWNER_KEY);
  } catch {}
}

interface OwnerProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onOwnerChange: (isOwner: boolean) => void;
  isOwner: boolean;
}

export default function Owner({ onNavigate, onOwnerChange, isOwner }: OwnerProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);

  const allChapters = CURRICULUM.flatMap(m => m.chapters);
  const allLessons = allChapters.flatMap(c => c.lessons);
  const totalModules = CURRICULUM.length;
  const totalChapters = allChapters.length;
  const totalLessons = allLessons.length;
  const totalDuration = allChapters.reduce((sum, ch) => {
    const match = ch.duration?.match(/(\d+)h\s*(\d+)?/);
    if (!match) return sum;
    return sum + parseInt(match[1]) * 60 + (match[2] ? parseInt(match[2]) : 0);
  }, 0);
  const totalHours = Math.floor(totalDuration / 60);
  const totalMinutes = totalDuration % 60;

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === OWNER_PIN) {
      setOwnerMode(true);
      onOwnerChange(true);
      setError("");
    } else {
      setError("PIN incorreto.");
      setPin("");
    }
  }

  function handleLogout() {
    if (confirm("Sair do modo dono?")) {
      setOwnerMode(false);
      onOwnerChange(false);
      onNavigate("home");
    }
  }

  if (!isOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white mx-auto mb-4"
              style={{ background: "var(--gradient-primary)" }}
            >
              N
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Área do Dono</h1>
            <p className="text-sm text-[hsl(220_10%_50%)]">Acesso restrito — insira o PIN de administrador</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN de acesso"
                className="w-full px-4 py-3 rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] text-white text-center text-xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-[hsl(220_10%_40%)] focus:outline-none focus:border-[hsl(250_90%_65%)] transition-colors"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220_10%_40%)] hover:text-white transition-colors text-sm"
                onClick={() => setShowPin(v => !v)}
              >
                {showPin ? "ocultar" : "ver"}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full py-3">
              Entrar como Dono
            </button>

            <button
              type="button"
              className="w-full text-sm text-[hsl(220_10%_40%)] hover:text-white transition-colors py-2"
              onClick={() => onNavigate("home")}
            >
              ← Voltar ao portal
            </button>
          </form>

          <p className="text-center text-xs text-[hsl(220_10%_30%)] mt-8">
            Esta página não está listada no menu — acesse sempre por URL direta.
          </p>
        </div>
      </div>
    );
  }

  const moduleStats = CURRICULUM.map(mod => {
    const lessons = mod.chapters.flatMap(c => c.lessons);
    return {
      id: mod.id,
      number: mod.number,
      title: mod.title,
      chapters: mod.chapters.length,
      lessons: lessons.length,
      badge: mod.badge,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.3)]">
              ⚡ MODO DONO ATIVO
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
          <p className="text-[hsl(220_10%_50%)] mt-1">Visão completa do portal NexOS Academy</p>
        </div>
        <button
          onClick={handleLogout}
          className="btn-outline text-sm px-4 py-2 shrink-0"
        >
          Sair do modo dono
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Módulos", value: totalModules, icon: "📦" },
          { label: "Capítulos", value: totalChapters, icon: "📖" },
          { label: "Aulas", value: totalLessons, icon: "🎓" },
          { label: "Horas de conteúdo", value: `${totalHours}h ${totalMinutes}m`, icon: "⏱️" },
        ].map(kpi => (
          <div key={kpi.label} className="card p-5 text-center">
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-3xl font-extrabold text-white">{kpi.value}</div>
            <div className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Access info */}
      <div className="card p-6 border border-[hsl(250_90%_65%/0.3)] bg-[hsl(250_90%_65%/0.05)]">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🔑</span> Seu Acesso de Dono
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-green-400 mt-0.5">✓</span>
              <div>
                <p className="text-white font-medium">Conteúdo 100% desbloqueado</p>
                <p className="text-[hsl(220_10%_45%)]">Você acessa todas as aulas sem pagar</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 mt-0.5">✓</span>
              <div>
                <p className="text-white font-medium">Sem paywall nunca</p>
                <p className="text-[hsl(220_10%_45%)]">O modo dono fica salvo neste navegador</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 mt-0.5">✓</span>
              <div>
                <p className="text-white font-medium">Badge "Dono" visível</p>
                <p className="text-[hsl(220_10%_45%)]">Você sempre sabe que está no modo admin</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[hsl(220_20%_8%)] space-y-2">
              <p className="text-xs text-[hsl(220_10%_45%)] uppercase tracking-wider font-semibold">URL de acesso ao painel</p>
              <code className="text-[hsl(250_90%_75%)] text-sm break-all">
                /nexos-academy/#owner
              </code>
              <p className="text-xs text-[hsl(220_10%_40%)]">Salve este link. Só você sabe que ele existe.</p>
            </div>
            <div className="p-4 rounded-xl bg-[hsl(220_20%_8%)]">
              <p className="text-xs text-[hsl(220_10%_45%)] uppercase tracking-wider font-semibold mb-1">PIN atual</p>
              <code className="text-[hsl(250_90%_75%)] text-sm">{OWNER_PIN}</code>
              <p className="text-xs text-[hsl(220_10%_40%)] mt-1">Guarde em local seguro.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Module overview */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>📦</span> Conteúdo do Curso
        </h2>
        <div className="space-y-2">
          {moduleStats.map(mod => (
            <div
              key={mod.id}
              className="card p-4 flex items-center justify-between gap-4 hover:border-[hsl(250_90%_65%/0.4)] transition-colors cursor-pointer"
              onClick={() => onNavigate("module", { moduleId: mod.id })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[hsl(250_90%_65%/0.15)] flex items-center justify-center text-xs font-bold text-[hsl(250_90%_75%)] shrink-0">
                  {mod.number}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{mod.title}</p>
                  <p className="text-xs text-[hsl(220_10%_45%)]">{mod.chapters} capítulos · {mod.lessons} aulas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {mod.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(220_20%_12%)] text-[hsl(220_10%_55%)] border border-[hsl(220_20%_18%)]">
                    {mod.badge}
                  </span>
                )}
                <span className="text-[hsl(220_10%_40%)] text-xs">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Ações Rápidas
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "Ver todos os módulos", icon: "📦", page: "modules" },
            { label: "Ver glossário", icon: "📖", page: "glossary" },
            { label: "Página de produtos", icon: "🛒", page: "products" },
          ].map(action => (
            <button
              key={action.page}
              className="card p-4 text-left hover:border-[hsl(250_90%_65%/0.4)] transition-colors flex items-center gap-3"
              onClick={() => onNavigate(action.page)}
            >
              <span className="text-xl">{action.icon}</span>
              <span className="text-sm font-medium text-white">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-[hsl(220_10%_30%)] py-4">
        Painel acessível apenas via <code className="text-[hsl(220_10%_40%)]">/nexos-academy/#owner</code> — não aparece em nenhum menu público.
      </div>
    </div>
  );
}
