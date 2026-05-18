import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "@/pages/home";
import Modules from "@/pages/modules";
import Lesson from "@/pages/lesson";
import Products from "@/pages/products";
import ProgressPage from "@/pages/progress-page";

const queryClient = new QueryClient();

type Page = "home" | "modules" | "module" | "lesson" | "products" | "progress";

interface NavState {
  page: Page;
  params: Record<string, string>;
}

const STORAGE_KEY = "nexos-academy-progress";

function loadProgress(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveProgress(p: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const NAV_ITEMS = [
  { id: "home", label: "Início", icon: "🏠" },
  { id: "modules", label: "Módulos", icon: "📦" },
  { id: "products", label: "Produtos", icon: "🛒" },
  { id: "progress", label: "Progresso", icon: "📊" },
];

function AcademyApp() {
  const [nav, setNav] = useState<NavState>({ page: "home", params: {} });
  const [progress, setProgress] = useState<Record<string, boolean>>(loadProgress);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useCallback((page: string, params: Record<string, string> = {}) => {
    setNav({ page: page as Page, params });
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const markComplete = useCallback((lessonId: string) => {
    setProgress(prev => {
      const next = { ...prev, [lessonId]: true };
      saveProgress(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    if (confirm("Tem certeza? Isso apagará todo o seu progresso.")) {
      setProgress({});
      saveProgress({});
    }
  }, []);

  const totalLessons = 17;
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedLessons / totalLessons) * 100);

  const isActive = (id: string) =>
    nav.page === id || (id === "modules" && (nav.page === "module" || nav.page === "lesson"));

  function renderPage() {
    switch (nav.page) {
      case "home":
        return <Home onNavigate={navigate} progress={progress} />;
      case "modules":
        return <Modules onNavigate={navigate} progress={progress} />;
      case "module":
        return <Modules onNavigate={navigate} progress={progress} selectedModule={nav.params.moduleId} />;
      case "lesson":
        return (
          <Lesson
            chapterId={nav.params.chapterId ?? ""}
            lessonId={nav.params.lessonId}
            onNavigate={navigate}
            progress={progress}
            onComplete={markComplete}
          />
        );
      case "products":
        return <Products onNavigate={navigate} />;
      case "progress":
        return <ProgressPage onNavigate={navigate} progress={progress} onReset={resetProgress} />;
      default:
        return <Home onNavigate={navigate} progress={progress} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[hsl(220_20%_10%)] bg-[hsl(222_25%_4%/0.95)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            className="flex items-center gap-2 shrink-0"
            onClick={() => navigate("home")}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-extrabold text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              N
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">NexOS Academy</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`sidebar-link ${isActive(item.id) ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Progress pill */}
          <div className="hidden md:flex items-center gap-3">
            {completedLessons > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-[hsl(220_20%_10%)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
                  />
                </div>
                <span className="text-xs text-[hsl(250_90%_75%)] font-semibold">{pct}%</span>
              </div>
            )}
            <button
              className="btn-primary text-xs px-3 py-1.5"
              onClick={() => navigate("products")}
            >
              Adquirir
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden btn-outline px-2 py-1.5"
            onClick={() => setMobileMenuOpen(v => !v)}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[hsl(220_20%_10%)] bg-[hsl(222_25%_5%)] px-4 py-3 space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`sidebar-link w-full ${isActive(item.id) ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Breadcrumb */}
      {nav.page !== "home" && (
        <div className="border-b border-[hsl(220_20%_10%)] bg-[hsl(222_25%_5%/0.5)]">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-xs text-[hsl(220_10%_45%)]">
            <button className="hover:text-white transition-colors" onClick={() => navigate("home")}>Início</button>
            <span>/</span>
            {nav.page === "module" && (
              <>
                <button className="hover:text-white transition-colors" onClick={() => navigate("modules")}>Módulos</button>
              </>
            )}
            {nav.page === "lesson" && (
              <>
                <button className="hover:text-white transition-colors" onClick={() => navigate("modules")}>Módulos</button>
                <span>/</span>
                <span className="text-[hsl(250_90%_75%)]">Aula</span>
              </>
            )}
            {(nav.page === "modules" || nav.page === "products" || nav.page === "progress") && (
              <span className="text-[hsl(250_90%_75%)]">
                {NAV_ITEMS.find(n => n.id === nav.page)?.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {renderPage()}
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(220_20%_10%)] mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[hsl(220_10%_40%)]">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-xs font-extrabold text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              N
            </div>
            <span>© 2025 NexOS AI — Metodologia de Lançamentos</span>
          </div>
          <div className="flex items-center gap-4">
            <span>PT-BR</span>
            <span>·</span>
            <span>Suporte: suporte@nexos.ai</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AcademyApp />
    </QueryClientProvider>
  );
}
