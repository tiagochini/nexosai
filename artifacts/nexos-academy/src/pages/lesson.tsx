import { useState, useEffect, useRef } from "react";
import { CURRICULUM } from "@/data/curriculum";
import { GLOSSARY } from "@/data/glossary";

interface LessonProps {
  chapterId: string;
  lessonId?: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  onComplete: (lessonId: string) => void;
}

const LOG_KEY = (id: string) => `nexos-log-${id}`;

function loadLog(id: string): string {
  try { return localStorage.getItem(LOG_KEY(id)) ?? ""; } catch { return ""; }
}
function saveLog(id: string, text: string) {
  try { localStorage.setItem(LOG_KEY(id), text); } catch { /* noop */ }
}

export default function Lesson({ chapterId, lessonId, onNavigate, progress, onComplete }: LessonProps) {
  const chapter = CURRICULUM.flatMap(m => m.chapters).find(c => c.id === chapterId);

  const [activeLesson, setActiveLesson] = useState(
    lessonId
      ? chapter?.lessons.find(l => l.id === lessonId) ?? chapter?.lessons[0]
      : chapter?.lessons[0]
  );
  const [logText, setLogText] = useState("");
  const [logSaved, setLogSaved] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const [showGlossaryTerm, setShowGlossaryTerm] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chapter && !activeLesson) setActiveLesson(chapter.lessons[0]);
  }, [chapter, activeLesson]);

  useEffect(() => {
    if (activeLesson) {
      setLogText(loadLog(activeLesson.id));
      setLogSaved(false);
      setShowExercise(false);
      setShowGlossaryTerm(null);
    }
  }, [activeLesson?.id]);

  if (!chapter || !activeLesson) {
    return (
      <div className="text-center py-20">
        <p className="text-[hsl(220_10%_55%)]">Capítulo não encontrado.</p>
        <button className="btn-primary mt-4" onClick={() => onNavigate("modules")}>← Voltar</button>
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
  const moduleId = CURRICULUM.find(m => m.chapters.some(c => c.id === chapterId))?.id ?? "";

  const typeIcon = { text: "📖", video: "🎬", exercise: "✏️", quiz: "❓" }[activeLesson.type];
  const typeLabel = { text: "Leitura", video: "Vídeo", exercise: "Exercício", quiz: "Quiz" }[activeLesson.type];

  const linkedTerms = (activeLesson.glossaryTerms ?? [])
    .map(id => GLOSSARY.find(g => g.id === id))
    .filter(Boolean) as typeof GLOSSARY;

  const expandedTerm = showGlossaryTerm ? GLOSSARY.find(g => g.id === showGlossaryTerm) : null;

  function handleLogChange(val: string) {
    if (!activeLesson) return;
    const currentId = activeLesson.id;
    setLogText(val);
    setLogSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveLog(currentId, val);
      setLogSaved(true);
    }, 800);
  }

  const completedCount = chapter.lessons.filter(l => progress[l.id]).length;
  const chapterPct = Math.round((completedCount / chapter.lessons.length) * 100);

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="sticky top-4 space-y-3">
          {/* Back */}
          <button
            className="btn-outline text-xs px-3 py-1.5 w-full justify-start"
            onClick={() => onNavigate("module", { moduleId })}
          >
            ← Voltar ao Módulo
          </button>

          {/* Chapter progress */}
          <div className="card-nexos rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{chapter.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{chapter.title}</p>
                <p className="text-xs text-[hsl(220_10%_40%)]">{completedCount}/{chapter.lessons.length} concluídas</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[hsl(220_20%_10%)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${chapterPct}%`, background: "var(--gradient-primary)" }} />
            </div>

            <div className="space-y-1 mt-3">
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
                  <span className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold"
                    style={{
                      borderColor: progress[lesson.id] ? "hsl(168 100% 42%)" : lesson.id === activeLesson.id ? "hsl(250 90% 65%)" : "hsl(220 20% 20%)",
                      background: progress[lesson.id] ? "hsl(168 100% 42% / 0.1)" : "transparent",
                      color: progress[lesson.id] ? "hsl(168 100% 50%)" : "inherit",
                    }}
                  >
                    {progress[lesson.id] ? "✓" : idx + 1}
                  </span>
                  <span className="truncate leading-tight">{lesson.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Glossary terms panel */}
          {linkedTerms.length > 0 && (
            <div className="card-nexos rounded-xl p-4">
              <h3 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-2.5">
                📖 Vocabulário desta Aula
              </h3>
              <div className="space-y-1">
                {linkedTerms.map(term => (
                  <button
                    key={term.id}
                    onClick={() => setShowGlossaryTerm(showGlossaryTerm === term.id ? null : term.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      showGlossaryTerm === term.id
                        ? "bg-[hsl(250_90%_60%/15%)] text-[hsl(250_90%_80%)]"
                        : "text-[hsl(220_10%_60%)] hover:text-white hover:bg-[hsl(220_20%_10%)]"
                    }`}
                  >
                    <span className="font-semibold">{term.term}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => onNavigate("glossary")}
                className="mt-3 w-full text-center text-xs text-[hsl(250_90%_65%)] hover:text-[hsl(250_90%_80%)] transition-colors"
              >
                Ver glossário completo →
              </button>
            </div>
          )}

          {/* Learning log indicator */}
          {logText && (
            <div className="card-nexos rounded-xl p-3 border border-[hsl(168_100%_42%/20%)]">
              <p className="text-xs text-[hsl(168_100%_45%)] font-semibold">📝 Registro salvo</p>
              <p className="text-xs text-[hsl(220_10%_40%)] mt-0.5 line-clamp-2">{logText}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 space-y-5">
        {/* Header */}
        <div className="card-nexos rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="tag-chip">{typeIcon} {typeLabel}</span>
                <span className="tag-chip">⏱ {activeLesson.duration}</span>
                {activeLesson.exercise && (
                  <span className="tag-chip">✏️ Com exercício</span>
                )}
                {lessonDone && <span className="badge-success badge-primary">✓ Concluído</span>}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{activeLesson.title}</h1>
              <p className="text-sm text-[hsl(220_10%_50%)] mt-1">{chapter.title}</p>
            </div>
          </div>
        </div>

        {/* Key Points */}
        <div className="card-nexos rounded-xl p-5">
          <h3 className="text-xs font-bold text-[hsl(220_10%_50%)] uppercase tracking-wider mb-3">
            Pontos-Chave desta Aula
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeLesson.keyPoints.map((kp, i) => (
              <span key={i} className="tag-chip">{kp}</span>
            ))}
          </div>
        </div>

        {/* Glossary term expanded (mobile / inline) */}
        {expandedTerm && (
          <div className="card-nexos rounded-xl p-5 border border-[hsl(250_90%_60%/20%)] bg-[hsl(250_90%_60%/5%)]">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className="text-xs font-bold text-[hsl(250_90%_70%)] uppercase tracking-widest">📖 Glossário</span>
                <h3 className="font-bold text-white text-base mt-0.5">{expandedTerm.term}</h3>
                <span className="text-xs text-[hsl(220_10%_45%)]">{expandedTerm.category}</span>
              </div>
              <button onClick={() => setShowGlossaryTerm(null)} className="text-[hsl(220_10%_40%)] hover:text-white text-sm shrink-0">✕</button>
            </div>
            <p className="text-sm text-[hsl(220_10%_65%)] leading-relaxed">{expandedTerm.definition}</p>
            {expandedTerm.example && (
              <div className="mt-3 p-3 rounded-lg bg-[hsl(250_90%_60%/8%)] border border-[hsl(250_90%_60%/15%)]">
                <p className="text-xs font-bold text-[hsl(250_90%_70%)] mb-1">Exemplo</p>
                <p className="text-xs text-[hsl(220_10%_60%)] italic">{expandedTerm.example}</p>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="card-nexos rounded-xl p-6 md:p-8">
          <div className="lesson-content" dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
        </div>

        {/* Exercise section */}
        {activeLesson.exercise && (
          <div className="card-nexos rounded-xl overflow-hidden border border-[hsl(45_100%_55%/15%)]">
            <button
              onClick={() => setShowExercise(v => !v)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-[hsl(220_20%_8%)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ background: "hsl(45 100% 55% / 15%)" }}>
                  ✏️
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Exercício Prático</p>
                  <p className="text-xs text-[hsl(220_10%_45%)]">Aplique o que aprendeu agora</p>
                </div>
              </div>
              <span className={`text-[hsl(220_10%_40%)] transition-transform duration-200 ${showExercise ? "rotate-180" : ""}`}>▼</span>
            </button>
            {showExercise && (
              <div className="px-6 pb-6 border-t border-[hsl(220_20%_10%)] pt-5">
                <div
                  className="lesson-content text-sm"
                  dangerouslySetInnerHTML={{ __html: activeLesson.exercise }}
                />
              </div>
            )}
          </div>
        )}

        {/* Linked glossary terms — mobile inline list */}
        {linkedTerms.length > 0 && (
          <div className="lg:hidden card-nexos rounded-xl p-4">
            <h3 className="text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-widest mb-3">📖 Vocabulário desta Aula</h3>
            <div className="flex flex-wrap gap-2">
              {linkedTerms.map(term => (
                <button
                  key={term.id}
                  onClick={() => setShowGlossaryTerm(showGlossaryTerm === term.id ? null : term.id)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-[hsl(220_20%_10%)] text-[hsl(250_90%_75%)] hover:bg-[hsl(250_90%_60%/15%)] transition-colors"
                >
                  {term.term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Learning Log */}
        <div className="card-nexos rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[hsl(220_20%_10%)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <div>
                  <p className="font-bold text-white text-sm">Registro de Aprendizado</p>
                  <p className="text-xs text-[hsl(220_10%_45%)]">Suas anotações são salvas automaticamente neste dispositivo</p>
                </div>
              </div>
              {logSaved && (
                <span className="text-xs text-[hsl(168_100%_45%)] font-semibold shrink-0">✓ Salvo</span>
              )}
            </div>
          </div>
          <div className="p-5">
            <textarea
              value={logText}
              onChange={e => handleLogChange(e.target.value)}
              placeholder={`O que você aprendeu nesta aula? Quais insights vão mudar sua estratégia? Que ação você vai tomar hoje com base no que aprendeu?`}
              rows={5}
              className="w-full px-4 py-3 rounded-lg bg-[hsl(222_25%_6%)] border border-[hsl(220_20%_12%)] text-[hsl(220_10%_75%)] placeholder-[hsl(220_10%_30%)] text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(250_90%_60%/30%)] transition-all"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-[hsl(220_10%_30%)]">{logText.length} caracteres</p>
              <div className="flex gap-2">
                {logText && (
                  <button
                    onClick={() => { if (confirm("Apagar o registro desta aula?")) { setLogText(""); saveLog(activeLesson.id, ""); } }}
                    className="text-xs text-[hsl(220_10%_35%)] hover:text-red-400 transition-colors"
                  >
                    Apagar
                  </button>
                )}
                <button
                  onClick={() => { saveLog(activeLesson.id, logText); setLogSaved(true); }}
                  className="text-xs text-[hsl(250_90%_70%)] hover:text-white transition-colors font-semibold"
                >
                  Salvar nota
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Completion + Navigation */}
        <div className="card-nexos rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {prevLesson ? (
                <button className="btn-outline text-sm" onClick={() => setActiveLesson(prevLesson)}>← Anterior</button>
              ) : (
                <button className="btn-outline text-sm" onClick={() => onNavigate("module", { moduleId })}>← Módulo</button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {!lessonDone && (
                <button
                  className="btn-outline text-sm"
                  onClick={() => onComplete(activeLesson.id)}
                >
                  ✓ Marcar concluída
                </button>
              )}
              {lessonDone && (
                <span className="badge-success badge-primary text-sm">✓ Concluído</span>
              )}
              {nextLesson ? (
                <button
                  className="btn-primary text-sm"
                  onClick={() => { if (!lessonDone) onComplete(activeLesson.id); setActiveLesson(nextLesson); }}
                >
                  Próxima Aula →
                </button>
              ) : nextChapter && !nextChapter.locked ? (
                <button
                  className="btn-primary text-sm"
                  onClick={() => { if (!lessonDone) onComplete(activeLesson.id); onNavigate("lesson", { chapterId: nextChapter.id }); }}
                >
                  Próximo Capítulo →
                </button>
              ) : (
                <button
                  className="btn-primary text-sm"
                  onClick={() => { if (!lessonDone) onComplete(activeLesson.id); onNavigate("modules"); }}
                >
                  Concluir ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
