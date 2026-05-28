import { CURRICULUM } from "@/data/curriculum";

interface ModulesProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  selectedModule?: string;
}

export default function Modules({ onNavigate, progress, selectedModule }: ModulesProps) {
  const module = selectedModule
    ? CURRICULUM.find(m => m.id === selectedModule) ?? CURRICULUM[0]
    : null;

  if (module) {
    const isBonus = module.id === "bonus-infraestrutura";
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            className="btn-outline text-xs px-3 py-1.5"
            onClick={() => onNavigate("modules")}
          >
            ← Voltar
          </button>
          <h2 className="text-xl font-bold text-white">{module.title}</h2>
        </div>

        <div className={`rounded-xl p-5 ${isBonus ? "border border-amber-500/30 bg-amber-500/5" : "card-nexos"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${isBonus ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)]"}`}>
              {isBonus ? "🎁" : module.number}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={isBonus ? "text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30" : "badge-primary"}>{module.badge}</span>
              </div>
              <p className="text-sm text-[hsl(220_10%_65%)] leading-relaxed">{module.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {module.chapters.map(chapter => {
            const lessonsDone = chapter.lessons.filter(l => progress[l.id]).length;
            const pct = Math.round((lessonsDone / chapter.lessons.length) * 100);
            return (
              <div
                key={chapter.id}
                className={`rounded-xl p-5 cursor-pointer transition-all ${isBonus ? "border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/10" : "card-nexos"}`}
                onClick={() => onNavigate("lesson", { chapterId: chapter.id })}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0 mt-0.5">{chapter.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h3 className="font-semibold text-white text-sm">{chapter.title}</h3>
                      {lessonsDone === chapter.lessons.length ? (
                        <span className="badge-success badge-primary shrink-0">✓ Concluído</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[hsl(220_10%_50%)] mb-3">{chapter.subtitle}</p>
                    <div className="flex items-center gap-4 text-xs text-[hsl(220_10%_45%)] mb-3">
                      <span>⏱ {chapter.duration}</span>
                      <span>{chapter.lessons.length} aulas</span>
                    </div>
                    {lessonsDone > 0 && (
                      <div className="progress-bar-track h-1">
                        <div className="progress-bar-fill h-1" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const mainModules = CURRICULUM.filter(m => m.id !== "bonus-infraestrutura");
  const bonusModule = CURRICULUM.find(m => m.id === "bonus-infraestrutura");
  const totalChapters = mainModules.flatMap(m => m.chapters).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Módulos do Curso</h2>
        <p className="text-sm text-[hsl(220_10%_55%)]">
          {mainModules.length} módulos · {totalChapters} capítulos
        </p>
      </div>

      {mainModules.map(module => {
        const allLessons = module.chapters.flatMap(c => c.lessons);
        const doneLessons = allLessons.filter(l => progress[l.id]).length;
        const pct = allLessons.length > 0 ? Math.round((doneLessons / allLessons.length) * 100) : 0;
        return (
          <div key={module.id}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[hsl(250_90%_65%/0.15)] flex items-center justify-center text-sm font-bold text-[hsl(250_90%_75%)]">
                  {module.number}
                </div>
                <div>
                  <h3 className="font-bold text-white">{module.title}</h3>
                  <p className="text-xs text-[hsl(220_10%_50%)]">{module.chapters.length} capítulos · {allLessons.length} aulas</p>
                </div>
              </div>
              <button
                className="btn-outline text-xs px-3 py-1.5"
                onClick={() => onNavigate("module", { moduleId: module.id })}
              >
                Ver Módulo →
              </button>
            </div>

            {doneLessons > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[hsl(220_10%_50%)]">{doneLessons}/{allLessons.length} concluídas</span>
                  <span className="text-[hsl(250_90%_75%)]">{pct}%</span>
                </div>
                <div className="progress-bar-track h-1.5">
                  <div className="progress-bar-fill h-1.5" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {module.chapters.map(chapter => {
                const lessonsDone = chapter.lessons.filter(l => progress[l.id]).length;
                return (
                  <div
                    key={chapter.id}
                    className={`chapter-item ${chapter.locked ? "locked" : ""}`}
                    onClick={() => !chapter.locked && onNavigate("lesson", { chapterId: chapter.id })}
                  >
                    <div className="text-2xl shrink-0">{chapter.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white truncate">{chapter.title}</h4>
                        {chapter.locked ? (
                          <span className="text-sm">🔒</span>
                        ) : lessonsDone === chapter.lessons.length ? (
                          <span className="text-[hsl(168_100%_50%)] text-sm">✓</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[hsl(220_10%_50%)] mt-0.5 truncate">{chapter.subtitle}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[hsl(220_10%_40%)]">
                        <span>⏱ {chapter.duration}</span>
                        <span>{chapter.lessons.length} aulas</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {bonusModule && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-amber-500/20" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Módulo Bônus</span>
            <div className="h-px flex-1 bg-amber-500/20" />
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-amber-600/4 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">
                  🎁
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-white">{bonusModule.title}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Bônus Exclusivo
                    </span>
                  </div>
                  <p className="text-xs text-[hsl(220_10%_50%)]">
                    {bonusModule.chapters.length} capítulos · {bonusModule.chapters.flatMap(c => c.lessons).length} aulas
                  </p>
                </div>
              </div>
              <button
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
                onClick={() => onNavigate("module", { moduleId: bonusModule.id })}
              >
                Acessar →
              </button>
            </div>

            <p className="text-sm text-[hsl(220_10%_60%)] mb-4 leading-relaxed">{bonusModule.description}</p>

            <div className="grid sm:grid-cols-2 gap-2">
              {bonusModule.chapters.map(chapter => {
                const lessonsDone = chapter.lessons.filter(l => progress[l.id]).length;
                return (
                  <div
                    key={chapter.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/15 bg-amber-500/5 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/10 transition-all"
                    onClick={() => onNavigate("lesson", { chapterId: chapter.id })}
                  >
                    <span className="text-xl shrink-0">{chapter.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{chapter.title}</p>
                      <p className="text-xs text-[hsl(220_10%_45%)]">
                        {chapter.duration} · {chapter.lessons.length} aulas
                        {lessonsDone > 0 && ` · ${lessonsDone}/${chapter.lessons.length} ✓`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
