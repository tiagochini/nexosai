import { useState, useEffect } from "react";
import { CURRICULUM } from "@/data/curriculum";

interface LessonProps {
  chapterId: string;
  lessonId?: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  onComplete: (lessonId: string) => void;
}

export default function Lesson({ chapterId, lessonId, onNavigate, progress, onComplete }: LessonProps) {
  const chapter = CURRICULUM.flatMap(m => m.chapters).find(c => c.id === chapterId);

  const [activeLesson, setActiveLesson] = useState(
    lessonId
      ? chapter?.lessons.find(l => l.id === lessonId) ?? chapter?.lessons[0]
      : chapter?.lessons[0]
  );

  useEffect(() => {
    if (chapter && !activeLesson) {
      setActiveLesson(chapter.lessons[0]);
    }
  }, [chapter, activeLesson]);

  if (!chapter || !activeLesson) {
    return (
      <div className="text-center py-20">
        <p className="text-[hsl(220_10%_55%)]">Capítulo não encontrado.</p>
        <button className="btn-primary mt-4" onClick={() => onNavigate("modules")}>
          ← Voltar aos Módulos
        </button>
      </div>
    );
  }

  const currentIndex = chapter.lessons.findIndex(l => l.id === activeLesson.id);
  const prevLesson = currentIndex > 0 ? chapter.lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < chapter.lessons.length - 1 ? chapter.lessons[currentIndex + 1] : null;

  const allChapters = CURRICULUM.flatMap(m => m.chapters);
  const chapterIndex = allChapters.findIndex(c => c.id === chapterId);
  const nextChapter = allChapters[chapterIndex + 1];

  const lessonDone = progress[activeLesson.id];

  const typeIcon = { text: "📖", video: "🎬", exercise: "✏️", quiz: "❓" }[activeLesson.type];
  const typeLabel = { text: "Leitura", video: "Vídeo", exercise: "Exercício", quiz: "Quiz" }[activeLesson.type];

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="sticky top-4 space-y-2">
          <button
            className="btn-outline text-xs px-3 py-1.5 w-full justify-start"
            onClick={() => onNavigate("module", { moduleId: CURRICULUM.find(m => m.chapters.some(c => c.id === chapterId))?.id ?? "" })}
          >
            ← Voltar ao Módulo
          </button>

          <div className="card-nexos rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{chapter.icon}</span>
              <div>
                <p className="text-xs font-bold text-white">{chapter.title}</p>
                <p className="text-xs text-[hsl(220_10%_45%)]">{chapter.lessons.length} aulas</p>
              </div>
            </div>
            <div className="space-y-1">
              {chapter.lessons.map((lesson, idx) => (
                <button
                  key={lesson.id}
                  className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all ${
                    lesson.id === activeLesson.id
                      ? "bg-[hsl(250_90%_65%/0.12)] text-[hsl(250_90%_75%)]"
                      : "text-[hsl(220_10%_55%)] hover:text-white hover:bg-[hsl(220_20%_10%)]"
                  }`}
                  onClick={() => setActiveLesson(lesson)}
                >
                  <span className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-xs"
                    style={{
                      borderColor: progress[lesson.id] ? "hsl(168 100% 42%)" : lesson.id === activeLesson.id ? "hsl(250 90% 65%)" : "hsl(220 20% 20%)",
                      background: progress[lesson.id] ? "hsl(168 100% 42% / 0.1)" : "transparent",
                      color: progress[lesson.id] ? "hsl(168 100% 50%)" : "inherit",
                    }}
                  >
                    {progress[lesson.id] ? "✓" : idx + 1}
                  </span>
                  <span className="truncate">{lesson.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <div className="card-nexos rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="tag-chip">{typeIcon} {typeLabel}</span>
                <span className="tag-chip">⏱ {activeLesson.duration}</span>
                {lessonDone && <span className="badge-success badge-primary">✓ Concluído</span>}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{activeLesson.title}</h1>
              <p className="text-sm text-[hsl(220_10%_50%)] mt-1">{chapter.title}</p>
            </div>
          </div>
        </div>

        {/* Key Points */}
        <div className="card-nexos rounded-xl p-5 mb-5">
          <h3 className="text-xs font-bold text-[hsl(220_10%_50%)] uppercase tracking-wider mb-3">
            Pontos-Chave desta Aula
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeLesson.keyPoints.map((kp, i) => (
              <span key={i} className="tag-chip">{kp}</span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="card-nexos rounded-xl p-6 md:p-8 mb-5">
          <div
            className="lesson-content"
            dangerouslySetInnerHTML={{ __html: activeLesson.content }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {prevLesson ? (
              <button
                className="btn-outline"
                onClick={() => setActiveLesson(prevLesson)}
              >
                ← Anterior
              </button>
            ) : (
              <button
                className="btn-outline"
                onClick={() => onNavigate("module", { moduleId: CURRICULUM.find(m => m.chapters.some(c => c.id === chapterId))?.id ?? "" })}
              >
                ← Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!lessonDone && (
              <button
                className="btn-outline"
                onClick={() => onComplete(activeLesson.id)}
              >
                Marcar como concluído ✓
              </button>
            )}
            {nextLesson ? (
              <button
                className="btn-primary"
                onClick={() => {
                  if (!lessonDone) onComplete(activeLesson.id);
                  setActiveLesson(nextLesson);
                }}
              >
                Próxima Aula →
              </button>
            ) : nextChapter && !nextChapter.locked ? (
              <button
                className="btn-primary"
                onClick={() => {
                  if (!lessonDone) onComplete(activeLesson.id);
                  onNavigate("lesson", { chapterId: nextChapter.id });
                }}
              >
                Próximo Capítulo →
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  if (!lessonDone) onComplete(activeLesson.id);
                  onNavigate("modules");
                }}
              >
                Concluir ✓
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
