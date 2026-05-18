import { CURRICULUM } from "@/data/curriculum";

interface ProgressPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  onReset: () => void;
}

export default function ProgressPage({ onNavigate, progress, onReset }: ProgressPageProps) {
  const allModules = CURRICULUM;
  const allChapters = allModules.flatMap(m => m.chapters);
  const allLessons = allChapters.flatMap(c => c.lessons);

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter(l => progress[l.id]).length;
  const overallPct = Math.round((completedLessons / totalLessons) * 100);

  const completedChapters = allChapters.filter(c =>
    c.lessons.every(l => progress[l.id])
  ).length;

  const completedModules = allModules.filter(m =>
    m.chapters.flatMap(c => c.lessons).every(l => progress[l.id])
  ).length;

  const streak = completedLessons > 0 ? Math.min(completedLessons, 7) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Meu Progresso</h2>
        <p className="text-sm text-[hsl(220_10%_55%)]">Acompanhe sua jornada de aprendizado</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Progresso Geral", value: `${overallPct}%`, color: "hsl(250 90% 75%)", icon: "📊" },
          { label: "Aulas Concluídas", value: `${completedLessons}/${totalLessons}`, color: "hsl(168 100% 50%)", icon: "✓" },
          { label: "Capítulos Completos", value: `${completedChapters}/${allChapters.length}`, color: "hsl(220 90% 70%)", icon: "📖" },
          { label: "Streak de Aulas", value: `${streak} dias`, color: "hsl(40 95% 65%)", icon: "🔥" },
        ].map(stat => (
          <div key={stat.label} className="stat-card text-center">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-xl font-extrabold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-[hsl(220_10%_50%)] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card-nexos rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white">Progresso Total</p>
          <span className="text-2xl font-extrabold" style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {overallPct}%
          </span>
        </div>
        <div className="progress-bar-track h-3">
          <div className="progress-bar-fill h-3" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-xs text-[hsl(220_10%_45%)] mt-2">
          {completedLessons} de {totalLessons} aulas concluídas
        </p>
      </div>

      {/* Per-module breakdown */}
      <div className="space-y-4">
        <h3 className="font-bold text-white">Por Módulo</h3>
        {allModules.map(module => {
          const mLessons = module.chapters.flatMap(c => c.lessons);
          const mDone = mLessons.filter(l => progress[l.id]).length;
          const mPct = mLessons.length > 0 ? Math.round((mDone / mLessons.length) * 100) : 0;
          return (
            <div key={module.id} className="card-nexos rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.2)] flex items-center justify-center text-sm font-bold text-[hsl(250_90%_75%)]">
                    {module.number}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{module.title}</h4>
                    <p className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{mDone}/{mLessons.length} aulas</p>
                  </div>
                </div>
                <span className="text-lg font-bold" style={{ color: mPct === 100 ? "hsl(168 100% 50%)" : "hsl(250 90% 75%)" }}>
                  {mPct}%
                </span>
              </div>
              <div className="progress-bar-track h-1.5">
                <div className="progress-bar-fill h-1.5" style={{ width: `${mPct}%` }} />
              </div>

              {/* Chapters within module */}
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {module.chapters.map(chapter => {
                  const cLessons = chapter.lessons;
                  const cDone = cLessons.filter(l => progress[l.id]).length;
                  const cPct = Math.round((cDone / cLessons.length) * 100);
                  return (
                    <button
                      key={chapter.id}
                      className={`text-left flex items-center gap-3 p-2.5 rounded-lg border text-xs transition-all ${
                        chapter.locked
                          ? "border-[hsl(220_20%_12%)] opacity-40 cursor-not-allowed"
                          : "border-[hsl(220_20%_12%)] hover:border-[hsl(250_90%_65%/0.3)] hover:bg-[hsl(250_90%_65%/0.04)] cursor-pointer"
                      }`}
                      disabled={chapter.locked}
                      onClick={() => !chapter.locked && onNavigate("lesson", { chapterId: chapter.id })}
                    >
                      <span className="text-lg shrink-0">{chapter.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white truncate">{chapter.title}</span>
                          {chapter.locked ? (
                            <span>🔒</span>
                          ) : cPct === 100 ? (
                            <span className="text-[hsl(168_100%_50%)]">✓</span>
                          ) : cDone > 0 ? (
                            <span className="text-[hsl(250_90%_75%)]">{cPct}%</span>
                          ) : null}
                        </div>
                        <span className="text-[hsl(220_10%_40%)]">{cDone}/{cLessons.length} aulas</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Certificates / achievements */}
      <div className="card-nexos rounded-xl p-6">
        <h3 className="font-bold text-white mb-4">Conquistas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: "🎯", name: "Primeira Aula", desc: "Completou a 1ª aula", unlocked: completedLessons >= 1 },
            { icon: "📚", name: "Leitor Ávido", desc: "5 aulas completas", unlocked: completedLessons >= 5 },
            { icon: "🔥", name: "Em Chamas", desc: "10 aulas completas", unlocked: completedLessons >= 10 },
            { icon: "🏆", name: "Mestre", desc: "Todos os módulos", unlocked: completedModules === CURRICULUM.length },
          ].map(ach => (
            <div
              key={ach.name}
              className={`text-center p-3 rounded-xl border ${
                ach.unlocked
                  ? "border-[hsl(250_90%_65%/0.3)] bg-[hsl(250_90%_65%/0.05)]"
                  : "border-[hsl(220_20%_12%)] opacity-40"
              }`}
            >
              <div className="text-3xl mb-2">{ach.icon}</div>
              <div className="text-xs font-semibold text-white">{ach.name}</div>
              <div className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{ach.desc}</div>
              {ach.unlocked && (
                <div className="mt-1.5">
                  <span className="badge-success badge-primary" style={{ fontSize: "0.6rem" }}>Desbloqueado</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {completedLessons > 0 && (
        <div className="text-center">
          <button
            className="btn-outline text-xs text-[hsl(220_10%_40%)]"
            onClick={onReset}
          >
            Reiniciar Progresso
          </button>
        </div>
      )}
    </div>
  );
}
