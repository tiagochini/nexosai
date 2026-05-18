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

        <div className="card-nexos rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.2)] flex items-center justify-center text-xl font-bold text-[hsl(250_90%_75%)] shrink-0">
              {module.number}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-primary">{module.badge}</span>
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
                className={`card-nexos rounded-xl p-5 ${chapter.locked ? "card-locked" : "cursor-pointer"}`}
                onClick={() => !chapter.locked && onNavigate("lesson", { chapterId: chapter.id })}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0 mt-0.5">{chapter.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h3 className="font-semibold text-white text-sm">{chapter.title}</h3>
                      {chapter.locked ? (
                        <span className="badge-locked badge-primary shrink-0">🔒 Bloqueado</span>
                      ) : lessonsDone === chapter.lessons.length ? (
                        <span className="badge-success badge-primary shrink-0">✓ Concluído</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[hsl(220_10%_50%)] mb-3">{chapter.subtitle}</p>
                    <div className="flex items-center gap-4 text-xs text-[hsl(220_10%_45%)] mb-3">
                      <span>⏱ {chapter.duration}</span>
                      <span>{chapter.lessons.length} aulas</span>
                    </div>
                    {!chapter.locked && lessonsDone > 0 && (
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Módulos do Curso</h2>
        <p className="text-sm text-[hsl(220_10%_55%)]">
          {CURRICULUM.length} módulos · {CURRICULUM.flatMap(m => m.chapters).length} capítulos
        </p>
      </div>

      {CURRICULUM.map(module => {
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
    </div>
  );
}
