import { useState, useEffect, useRef } from "react";
import { CURRICULUM } from "@/data/curriculum";
import { GLOSSARY } from "@/data/glossary";
import { useAntiPiracy } from "@/hooks/useAntiPiracy";
import PiracyWatermark from "@/components/PiracyWatermark";

interface LessonProps {
  chapterId: string;
  lessonId?: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  progress: Record<string, boolean>;
  onComplete: (lessonId: string) => void;
  studentName?: string;
  studentEmail?: string;
}

const LOG_KEY = (id: string) => `nexos-log-${id}`;
const TUTOR_KEY = (id: string) => `nexos-tutor-${id}`;

function loadLog(id: string): string {
  try { return localStorage.getItem(LOG_KEY(id)) ?? ""; } catch { return ""; }
}
function saveLog(id: string, text: string) {
  try { localStorage.setItem(LOG_KEY(id), text); } catch { /* noop */ }
}

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

function loadTutorHistory(id: string): TutorMessage[] {
  try {
    const raw = localStorage.getItem(TUTOR_KEY(id));
    if (!raw) return [];
    return JSON.parse(raw) as TutorMessage[];
  } catch { return []; }
}
function saveTutorHistory(id: string, msgs: TutorMessage[]) {
  try { localStorage.setItem(TUTOR_KEY(id), JSON.stringify(msgs.slice(-30))); } catch { /* noop */ }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
}

function getAllLessonsInOrder() {
  return CURRICULUM.flatMap(m =>
    m.chapters.flatMap(c =>
      c.lessons.map(l => ({ lessonId: l.id, title: l.title, chapterId: c.id }))
    )
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^• (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[uop]|<li)(.+)$/gm, "$1")
    .replace(/\n/g, "<br/>");
}

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/../../api";

export default function Lesson({ chapterId, lessonId, onNavigate, progress, onComplete, studentName, studentEmail }: LessonProps) {
  useAntiPiracy({ studentName, studentEmail, enabled: true });
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

  // Tutor state
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorHistory, setTutorHistory] = useState<TutorMessage[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const tutorEndRef = useRef<HTMLDivElement>(null);
  const tutorInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chapter && !activeLesson) setActiveLesson(chapter.lessons[0]);
  }, [chapter, activeLesson]);

  useEffect(() => {
    if (activeLesson) {
      setLogText(loadLog(activeLesson.id));
      setLogSaved(false);
      setShowExercise(false);
      setShowGlossaryTerm(null);
      setTutorHistory(loadTutorHistory(activeLesson.id));
      setTutorInput("");
      setTutorError(null);
    }
  }, [activeLesson?.id]);

  useEffect(() => {
    if (tutorOpen && tutorEndRef.current) {
      tutorEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [tutorHistory, tutorOpen, tutorLoading]);

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
  const prevChapter = chapterIndex > 0 ? allChapters[chapterIndex - 1] : null;
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

  // Build tutor context
  function buildTutorContext() {
    const allLessons = getAllLessonsInOrder();
    const currentIdx = allLessons.findIndex(l => l.lessonId === activeLesson!.id);
    const previousTopics = allLessons.slice(0, currentIdx).map(l => l.title);
    const upcomingTopics = allLessons.slice(currentIdx + 1).map(l => l.title);
    return {
      lessonTitle: activeLesson!.title,
      chapterTitle: chapter!.title,
      lessonContent: stripHtml(activeLesson!.content),
      keyPoints: activeLesson!.keyPoints,
      previousTopics,
      upcomingTopics,
    };
  }

  async function sendTutorQuestion() {
    const q = tutorInput.trim();
    if (!q || tutorLoading) return;

    const ctx = buildTutorContext();
    const newUserMsg: TutorMessage = { role: "user", content: q };
    const updatedHistory = [...tutorHistory, newUserMsg];

    setTutorHistory(updatedHistory);
    setTutorInput("");
    setTutorLoading(true);
    setTutorError(null);
    saveTutorHistory(activeLesson!.id, updatedHistory);

    try {
      const res = await fetch(`${API_BASE}/academy/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ctx,
          question: q,
          history: updatedHistory.slice(0, -1).slice(-10),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Erro ao consultar o professor.");
      }

      const data = await res.json() as { answer: string };
      const assistantMsg: TutorMessage = { role: "assistant", content: data.answer };
      const finalHistory = [...updatedHistory, assistantMsg];
      setTutorHistory(finalHistory);
      saveTutorHistory(activeLesson!.id, finalHistory);
    } catch (err) {
      setTutorError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setTutorLoading(false);
    }
  }

  function handleTutorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTutorQuestion();
    }
  }

  function clearTutorHistory() {
    if (!activeLesson) return;
    if (!confirm("Apagar o histórico desta conversa?")) return;
    setTutorHistory([]);
    saveTutorHistory(activeLesson.id, []);
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[hsl(220_20%_10%)] bg-[hsl(222_25%_4%/0.97)] backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-2">
        <button
          className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
          onClick={() => {
            if (prevLesson) setActiveLesson(prevLesson);
            else if (prevChapter) onNavigate("lesson", { chapterId: prevChapter.id, lessonId: prevChapter.lessons[prevChapter.lessons.length - 1].id });
            else onNavigate("module", { moduleId });
          }}
        >
          ← {prevLesson ? "Anterior" : prevChapter ? "Cap. Anterior" : "Módulo"}
        </button>
        <span className="text-xs text-[hsl(220_10%_45%)] truncate px-2 text-center flex-1">
          {activeLesson.title}
        </span>
        <button
          className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
          onClick={() => {
            if (!lessonDone) onComplete(activeLesson.id);
            if (nextLesson) setActiveLesson(nextLesson);
            else if (nextChapter && !nextChapter.locked) onNavigate("lesson", { chapterId: nextChapter.id });
            else onNavigate("modules");
          }}
        >
          {nextLesson ? "Próxima →" : nextChapter ? "Cap. →" : "Concluir ✓"}
        </button>
      </div>

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

          {/* Tutor shortcut in sidebar */}
          <button
            onClick={() => setTutorOpen(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border"
            style={{
              borderColor: tutorOpen ? "hsl(250 90% 60% / 40%)" : "hsl(220 20% 15%)",
              background: tutorOpen ? "hsl(250 90% 60% / 8%)" : "transparent",
              color: tutorOpen ? "hsl(250 90% 75%)" : "hsl(220 10% 50%)",
            }}
          >
            <span className="text-base">🎓</span>
            <span className="flex-1 text-left">Professor IA</span>
            {tutorHistory.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[hsl(250_90%_60%)] text-white text-[9px] flex items-center justify-center font-bold">
                {Math.min(tutorHistory.filter(m => m.role === "assistant").length, 9)}
              </span>
            )}
          </button>
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
        <div className="card-nexos rounded-xl p-6 md:p-8 relative" data-lesson-content>
          <PiracyWatermark studentName={studentName} studentEmail={studentEmail} visible={!!(studentName || studentEmail)} />
          <div className="lesson-content relative z-10" dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
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
              <div className="px-6 pb-6 border-t border-[hsl(220_20%_10%)] pt-5 relative" data-lesson-content>
                <PiracyWatermark studentName={studentName} studentEmail={studentEmail} visible={!!(studentName || studentEmail)} />
                <div
                  className="lesson-content text-sm relative z-10"
                  dangerouslySetInnerHTML={{ __html: activeLesson.exercise }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── AI Tutor Panel ───────────────────────────────────── */}
        <div className="card-nexos rounded-xl overflow-hidden border border-[hsl(250_90%_60%/20%)]">
          {/* Header — always visible */}
          <button
            onClick={() => setTutorOpen(v => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-[hsl(220_20%_8%)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "hsl(250 90% 60% / 15%)" }}>
                🎓
              </div>
              <div>
                <p className="font-bold text-white text-sm">Professor Allan</p>
                <p className="text-xs text-[hsl(220_10%_45%)]">
                  {tutorHistory.length === 0
                    ? "Dúvidas sobre esta aula? Pergunte aqui"
                    : `${tutorHistory.filter(m => m.role === "assistant").length} resposta${tutorHistory.filter(m => m.role === "assistant").length !== 1 ? "s" : ""} nesta aula`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tutorHistory.length > 0 && !tutorOpen && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "hsl(250 90% 60%)" }}>
                  {Math.min(tutorHistory.filter(m => m.role === "assistant").length, 9)}
                </span>
              )}
              <span className={`text-[hsl(220_10%_40%)] transition-transform duration-200 ${tutorOpen ? "rotate-180" : ""}`}>▼</span>
            </div>
          </button>

          {tutorOpen && (
            <div className="border-t border-[hsl(220_20%_10%)]">
              {/* Scope notice */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[hsl(250_90%_60%/6%)] border border-[hsl(250_90%_60%/15%)]">
                  <span className="text-xs shrink-0">🔍</span>
                  <p className="text-xs text-[hsl(220_10%_50%)] leading-relaxed">
                    O professor responde sobre <strong className="text-[hsl(250_90%_75%)]">{activeLesson.title}</strong> e aulas já estudadas. Tópicos futuros são mencionados mas não antecipados.
                  </p>
                </div>
              </div>

              {/* Message history */}
              <div className="px-5 py-3 space-y-4 max-h-96 overflow-y-auto">
                {tutorHistory.length === 0 && (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl"
                      style={{ background: "hsl(250 90% 60% / 10%)" }}>
                      🎓
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Olá! Sou o Professor Allan.</p>
                      <p className="text-xs text-[hsl(220_10%_45%)] mt-1">
                        Criador da <strong className="text-[hsl(250_90%_70%)]">NexOS AI</strong> — a automação de marketing digital mais completa e moderna do Brasil.<br className="hidden sm:block" />
                        Estou aqui para aprofundar <strong className="text-[hsl(250_90%_70%)]">{activeLesson.title}</strong> com você. Qual é a sua dúvida?
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        "Como aplicar isso na prática?",
                        "Pode dar um exemplo real?",
                        "Qual o erro mais comum aqui?",
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => { setTutorInput(q); tutorInputRef.current?.focus(); }}
                          className="px-3 py-1.5 rounded-lg text-xs border border-[hsl(250_90%_60%/25%)] text-[hsl(250_90%_75%)] hover:bg-[hsl(250_90%_60%/10%)] transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tutorHistory.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-bold mt-0.5 ${
                      msg.role === "user"
                        ? "bg-[hsl(220_20%_12%)] text-[hsl(220_10%_50%)]"
                        : "bg-[hsl(250_90%_60%/15%)] text-[hsl(250_90%_70%)]"
                    }`}>
                      {msg.role === "user" ? "V" : "🎓"}
                    </div>
                    <div className={`flex-1 max-w-[85%] ${msg.role === "user" ? "flex justify-end" : ""}`}>
                      {msg.role === "user" ? (
                        <div className="inline-block px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[hsl(250_90%_60%/12%)] border border-[hsl(250_90%_60%/20%)]">
                          <p className="text-sm text-[hsl(220_10%_80%)]">{msg.content}</p>
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[hsl(222_25%_7%)] border border-[hsl(220_20%_12%)]">
                          <div
                            className="text-sm text-[hsl(220_10%_75%)] leading-relaxed prose-tutor"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {tutorLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm bg-[hsl(250_90%_60%/15%)] text-[hsl(250_90%_70%)]">🎓</div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[hsl(222_25%_7%)] border border-[hsl(220_20%_12%)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(250_90%_60%)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(250_90%_60%)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(250_90%_60%)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                {tutorError && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {tutorError}
                  </div>
                )}

                <div ref={tutorEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 pb-5">
                <div className="border border-[hsl(220_20%_14%)] rounded-xl bg-[hsl(222_25%_5%)] focus-within:border-[hsl(250_90%_60%/50%)] transition-colors">
                  <textarea
                    ref={tutorInputRef}
                    value={tutorInput}
                    onChange={e => setTutorInput(e.target.value)}
                    onKeyDown={handleTutorKeyDown}
                    placeholder="Sua dúvida sobre esta aula..."
                    rows={2}
                    disabled={tutorLoading}
                    className="w-full px-4 pt-3 pb-2 bg-transparent text-sm text-[hsl(220_10%_80%)] placeholder-[hsl(220_10%_30%)] resize-none focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between px-3 pb-3 gap-2">
                    <p className="text-[10px] text-[hsl(220_10%_30%)]">Enter para enviar • Shift+Enter para nova linha</p>
                    <div className="flex items-center gap-2">
                      {tutorHistory.length > 0 && (
                        <button
                          onClick={clearTutorHistory}
                          className="text-[10px] text-[hsl(220_10%_35%)] hover:text-red-400 transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        onClick={sendTutorQuestion}
                        disabled={!tutorInput.trim() || tutorLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: tutorInput.trim() && !tutorLoading ? "var(--gradient-primary)" : "hsl(220 20% 12%)",
                          color: tutorInput.trim() && !tutorLoading ? "white" : "hsl(220 10% 40%)",
                        }}
                      >
                        {tutorLoading ? "Pensando..." : "Perguntar →"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

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
                <button className="btn-outline text-sm" onClick={() => setActiveLesson(prevLesson)}>← Aula Anterior</button>
              ) : prevChapter ? (
                <button className="btn-outline text-sm" onClick={() => onNavigate("lesson", { chapterId: prevChapter.id, lessonId: prevChapter.lessons[prevChapter.lessons.length - 1].id })}>← Capítulo Anterior</button>
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
