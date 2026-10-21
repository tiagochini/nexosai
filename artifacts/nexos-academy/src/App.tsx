import { academyFetch, studentRequest, type StudentSession } from "@/lib/academy-session";
import AccessForm from "@/components/AccessForm";
import { useState, useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "@/pages/home";
import Modules from "@/pages/modules";
import Lesson from "@/pages/lesson";
import Products from "@/pages/products";
import ProgressPage from "@/pages/progress-page";
import Glossary from "@/pages/glossary";
import Owner, { isOwnerMode, loadBrand, type BrandConfig } from "@/pages/owner";
import MiniGuide from "@/pages/mini-guide";
import MiniGuideSales from "@/pages/mini-guide-sales";
import FreeGuide from "@/pages/free-guide";
import LeadMagnet from "@/pages/lead-magnet";
import { useAntiPiracy } from "@/hooks/useAntiPiracy";
import { academyAccessHeaders } from '@/pages/owner';
import { setPaidCurriculum, resetPaidCurriculum } from '@/data/curriculum';
import { setPaidglossary } from '@/data/glossary';
import { setPaidbibliography } from '@/data/bibliography';

const queryClient = new QueryClient();

type Page = "login" | "home" | "modules" | "module" | "lesson" | "products" | "progress" | "glossary" | "owner" | "mini-guide" | "mini-guide-sales" | "free-guide" | "lead-magnet";

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

const ALL_NAV_ITEMS = [
  { id: "home", label: "Início", icon: "🏠" },
  { id: "modules", label: "Curso Completo", icon: "📦" },
  { id: "mini-guide", label: "Mini-Guia 10K", icon: "📖" },
  { id: "glossary", label: "Glossário", icon: "📚" },
  { id: "products", label: "Produtos", icon: "🛒" },
  { id: "progress", label: "Progresso", icon: "📊" },
];


const RESTRICTED_PAGES: Page[] = ["modules", "module", "lesson", "progress", "glossary", "mini-guide"];

function getHashPage(): string {
  const hash = window.location.hash;
  return hash.split("?")[0]; // strip any query-string embedded in the hash
}

function getInitialPage(): NavState {
  if (typeof window !== "undefined") {
    const hashPage = getHashPage();
    if (hashPage === "#reset-password") return { page: "login", params: {} };
    if (hashPage === "#login" || hashPage === "#entrar") return { page: "login", params: {} };
    if (hashPage === "#owner") return { page: "owner", params: {} };
    if (hashPage === "#guia") return { page: "lead-magnet", params: {} };
    if (hashPage === "#guia-gratuito") return { page: "free-guide", params: {} };
    if (hashPage === "#mini-guide") return { page: "mini-guide", params: {} };
    if (hashPage === "#venda" || hashPage === "#mapa-10k") return { page: "mini-guide-sales", params: {} };
    if (hashPage === "#products") return { page: "products", params: {} };
    const search = new URLSearchParams(window.location.search);
    if (search.get("payment") === "success") return { page: "products", params: { paymentSuccess: "1" } };
  }
  return { page: "home", params: {} };
}

function AcademyApp() {
  const [nav, setNav] = useState<NavState>(getInitialPage);
  const [progress, setProgress] = useState<Record<string, boolean>>(loadProgress);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ownerMode, setOwnerMode] = useState<boolean>(() => isOwnerMode());
  const [hasAccess, setHasAccess] = useState(false);
  const [verifiedProduct, setVerifiedProduct] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(() => loadBrand());
  const [student, setStudent] = useState<StudentSession["user"] | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [restoringSession, setRestoringSession] = useState(true);
  const [courseReady, setCourseReady] = useState(false);
  const [courseError, setCourseError] = useState('');
  const studentName = student?.name ?? "";
  const studentEmail = student?.email ?? "";

  useEffect(() => {
    const onBrandUpdated = () => setBrand(loadBrand());
    window.addEventListener("brand-updated", onBrandUpdated);
    return () => window.removeEventListener("brand-updated", onBrandUpdated);
  }, []);

  const clearStudent = useCallback(() => {
    setStudent(null); setHasAccess(false); setVerifiedProduct(null); setProgress({});
    resetPaidCurriculum(); setPaidglossary([]); setPaidbibliography([]);
    localStorage.removeItem("nexos-academy-user-id"); localStorage.removeItem("nexos-academy-email"); localStorage.removeItem("nexos-academy-name");
  }, []);
  const refreshStudent = useCallback(async () => {
    try {
      const response = await fetch("/api/academy/student/session", { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) clearStudent();
        else setSessionMessage("Não foi possível verificar sua conta. Tente novamente.");
        return;
      }
      const result = await response.json() as StudentSession;
      setStudent(result.user); setProgress(result.progress ?? {}); setSessionMessage("");
      localStorage.setItem("nexos-academy-user-id", result.user.id); localStorage.setItem("nexos-academy-name", result.user.name); localStorage.setItem("nexos-academy-email", result.user.email);
      setHasAccess(result.products.some(item => item.productId === "complete-bundle"));
      setVerifiedProduct(result.products.some(item => item.productId === "complete-bundle") ? "complete-bundle" : result.products.some(item => item.productId === "mini-guide") ? "mini-guide" : null);
    } catch { setSessionMessage("Não foi possível verificar sua conta. Confira sua conexão."); }
    finally { setRestoringSession(false); }
  }, [clearStudent]);
  useEffect(() => {
    void refreshStudent();
    const ended = (event: Event) => {
      clearStudent(); setSessionMessage((event as CustomEvent<string>).detail || "Sua conta foi acessada em outro dispositivo. Entre novamente para continuar.");
      setNav({ page: "login", params: {} });
    };
    const ownerEnded = () => setOwnerMode(false);
    window.addEventListener("academy-session-ended", ended); window.addEventListener("owner-session-ended", ownerEnded);
    return () => { window.removeEventListener("academy-session-ended", ended); window.removeEventListener("owner-session-ended", ownerEnded); };
  }, [clearStudent, refreshStudent]);
  useEffect(() => {
    if (!student) return;
    const check = async () => {
      try { const response = await academyFetch("/api/academy/student/session");
        if (response.ok) {
          const result = await response.json() as StudentSession;
          setStudent(result.user);
          setHasAccess(result.products.some(item => item.productId === "complete-bundle"));
          setVerifiedProduct(result.products.some(item => item.productId === "complete-bundle") ? "complete-bundle" : result.products.some(item => item.productId === "mini-guide") ? "mini-guide" : null);
        }
      } catch { /* Recheck on focus and the next heartbeat. */ }
    };
    const timer = window.setInterval(() => void check(), 15_000);
    const focus = () => void check(); window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [student?.id]);

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash;
      if (hash.startsWith("#reset-password?")) setNav({ page: "login", params: {} });
      else if (hash === "#login" || hash === "#entrar") setNav({ page: "login", params: {} });
      else if (hash === "#owner") setNav({ page: "owner", params: {} });
      else if (hash === "#guia-gratuito") setNav({ page: "free-guide", params: {} });
      else if (hash === "#mini-guide") setNav({ page: "mini-guide", params: {} });
      else if (hash === "#venda" || hash === "#mapa-10k") setNav({ page: "mini-guide-sales", params: {} });
      else if (hash === "#products") setNav({ page: "products", params: {} });
      setMobileMenuOpen(false);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((page: string, params: Record<string, string> = {}) => {
    setNav({ page: page as Page, params });
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", window.location.pathname + window.location.search + (page === "login" ? "#login" : page === "owner" ? "#owner" : ""));
  }, []);

  const markComplete = useCallback((lessonId: string) => {
    if (ownerMode) { setProgress(previous => { const next = { ...previous, [lessonId]: true }; saveProgress(next); return next; }); return; }
    void studentRequest("progress", { lessonId, complete: true }, "PATCH")
      .then(result => setProgress(result.progress)).catch(error => setSessionMessage(error.message));
  }, [ownerMode]);
  const resetProgress = useCallback(() => {
    if (!confirm("Tem certeza? Isso apagará todo o seu progresso.")) return;
    if (ownerMode) { setProgress({}); saveProgress({}); return; }
    void studentRequest("progress", undefined, "DELETE")
      .then(() => setProgress({})).catch(error => setSessionMessage(error.message));
  }, [ownerMode]);

  const handleOwnerChange = useCallback((val: boolean) => {
    setOwnerMode(val);
  }, []);

  const totalLessons = 118;
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedLessons / totalLessons) * 100);

  const canAccess = hasAccess || ownerMode;

  useEffect(() => {
    setCourseReady(false); setCourseError('');
    resetPaidCurriculum(); setPaidglossary([]); setPaidbibliography([]);
    if (!canAccess) return;
    const controller = new AbortController();
    academyFetch('/api/academy/content/course', { headers: academyAccessHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Acesso ao curso recusado. Entre na sua conta e confira seus produtos.'); return response.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        setPaidCurriculum(data.curriculum); setPaidglossary(data.glossary); setPaidbibliography(data.bibliography); setCourseReady(true);
      }).catch(err => { if (!controller.signal.aborted) setCourseError(err.message); });
    return () => controller.abort();
  }, [canAccess, ownerMode, student?.id]);

  useAntiPiracy({
    studentName,
    studentEmail,
    enabled: canAccess && !ownerMode,

  });

  const isActive = (id: string) =>
    nav.page === id || (id === "modules" && (nav.page === "module" || nav.page === "lesson"));

  const navItems = ALL_NAV_ITEMS;
  const isLocked = (id: string) => !canAccess && RESTRICTED_PAGES.includes(id as Page) && !(id === "mini-guide" && verifiedProduct === "mini-guide");

  function renderPage() {
    if (restoringSession && RESTRICTED_PAGES.includes(nav.page)) return <p>Verificando seu acesso…</p>;
    if (canAccess && ['modules', 'module', 'lesson', 'progress', 'glossary'].includes(nav.page) && !courseReady) {
      return <p role={courseError ? 'alert' : undefined}>{courseError || 'Carregando material autorizado...'}</p>;
    }
    if (!canAccess && !(nav.page === "mini-guide" && verifiedProduct === "mini-guide") && RESTRICTED_PAGES.includes(nav.page)) {
      return (
        <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
          <div className="text-5xl mb-2">🔒</div>
          <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
          <p className="text-[hsl(220_10%_55%)]">
            Esta área é exclusiva para alunos da Metodologia NexOS. Adquira o acesso completo para desbloquear todos os módulos, capítulos e aulas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="btn-primary" onClick={() => navigate("products")}>
              Ver Planos e Preços →
            </button>
            <button className="btn-outline" onClick={() => navigate("login")}>
              Já sou aluno — Entrar
            </button>
          </div>
        </div>
      );
    }

    switch (nav.page) {
      case "login":
        return <div className="max-w-lg mx-auto py-8 space-y-6">
          <AccessForm key={student?.id ?? "guest"} onNavigate={navigate} onAccountChange={() => void refreshStudent()} />
          <div className="text-center space-y-3 text-sm">
            <button className="btn-outline" onClick={() => navigate("products")}>Conhecer os produtos</button>
            <p><button className="text-[hsl(250_90%_75%)] hover:underline" onClick={() => navigate("owner")}>Acesso administrativo</button></p>
          </div>
        </div>;
      case "home":
        return <Home onNavigate={navigate} progress={progress} hasAccess={canAccess} brand={brand} />;
      case "modules":
        return <Modules onNavigate={navigate} progress={progress} />;
      case "module":
        return <Modules onNavigate={navigate} progress={progress} selectedModule={nav.params.moduleId} />;
      case "lesson":
        return (
          <Lesson key={student?.id ?? "owner"}
            chapterId={nav.params.chapterId ?? ""}
            lessonId={nav.params.lessonId}
            onNavigate={navigate}
            progress={progress}
            onComplete={markComplete}
            studentName={studentName}
            studentEmail={studentEmail}
          />
        );
      case "products":
        return <Products onNavigate={navigate} hasAccess={canAccess} onAccountChange={() => void refreshStudent()} paymentSuccess={nav.params.paymentSuccess === "1"} />;
      case "progress":
        return <ProgressPage onNavigate={navigate} progress={progress} onReset={resetProgress} />;
      case "glossary":
        return <Glossary onNavigate={navigate} />;
      case "owner":
        return <Owner onNavigate={navigate} onOwnerChange={handleOwnerChange} isOwner={ownerMode} />;
      case "mini-guide":
        return <MiniGuide key={student?.id ?? "owner"} onNavigate={navigate} studentName={studentName || (ownerMode ? "Fundador NexOS" : undefined)} studentEmail={studentEmail || (ownerMode ? "founder@nexos.ai" : undefined)} />;
      case "mini-guide-sales":
        return <MiniGuideSales onNavigate={navigate} />;
      case "free-guide":
        return <FreeGuide onNavigate={navigate} />;
      case "lead-magnet":
        return <LeadMagnet onNavigate={navigate} />;
      default:
        return <Home onNavigate={navigate} progress={progress} hasAccess={canAccess} />;
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
              style={{ background: brand.primaryColor || "var(--gradient-primary)" }}
            >
              {brand.logoLetter || "N"}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="font-bold text-white text-sm">{brand.academyName || "NexOS Academy"}</span>
              {brand.ownerName && (
                <span className="text-[10px] text-[hsl(220_10%_40%)]">por {brand.ownerName}</span>
              )}
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-link ${isActive(item.id) ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {isLocked(item.id) && <span className="text-xs" aria-label="Acesso restrito">🔒</span>}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden xl:flex items-center gap-3">
            {ownerMode && (
              <button
                onClick={() => navigate("owner")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.3)] hover:bg-[hsl(250_90%_65%/0.3)] transition-colors"
              >
                ⚡ Dono
              </button>
            )}
            {canAccess && completedLessons > 0 && (
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
            {!student && !ownerMode && <button className="btn-outline text-xs px-3 py-1.5" onClick={() => navigate("login")}>Entrar</button>}
            {student && <button className="btn-outline text-xs px-3 py-1.5" onClick={() => navigate("login")}>Minha conta</button>}
            {!canAccess ? (
              <button
                className="btn-primary text-xs px-3 py-1.5"
                onClick={() => navigate("products")}
              >
                Adquirir Acesso
              </button>
            ) : !ownerMode && (
              <button
                className="btn-outline text-xs px-3 py-1.5"
                onClick={() => navigate("products")}
              >
                Produtos
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden flex items-center gap-2">
          {student && <button className="btn-outline text-xs px-3 py-1.5" onClick={() => navigate("login")}>Minha conta</button>}
          {!student && !ownerMode && <button className="btn-primary text-xs px-3 py-1.5" onClick={() => navigate("login")}>Entrar</button>}
          <button
            className="btn-outline px-2 py-1.5"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="academy-mobile-menu"
            onClick={() => setMobileMenuOpen(v => !v)}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div id="academy-mobile-menu" className="xl:hidden border-t border-[hsl(220_20%_10%)] bg-[hsl(222_25%_5%)] px-4 py-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-link w-full ${isActive(item.id) ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {isLocked(item.id) && <span className="text-xs" aria-label="Acesso restrito">🔒</span>}
              </button>
            ))}
            {!student && !ownerMode && <button className="sidebar-link w-full" onClick={() => navigate("login")}>Entrar na Academy</button>}
            {ownerMode && (
              <button
                className="sidebar-link w-full text-[hsl(250_90%_75%)]"
                onClick={() => navigate("owner")}
              >
                <span>⚡</span>
                <span>Painel do Dono</span>
              </button>
            )}
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
            {(nav.page === "modules" || nav.page === "products" || nav.page === "progress" || nav.page === "glossary") && (
              <span className="text-[hsl(250_90%_75%)]">
                {ALL_NAV_ITEMS.find(n => n.id === nav.page)?.label}
              </span>
            )}
            {nav.page === "login" && <span className="text-[hsl(250_90%_75%)]">Entrar</span>}
            {nav.page === "owner" && (
              <span className="text-[hsl(250_90%_75%)]">Painel do Dono</span>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {sessionMessage && <p role="alert" className="max-w-lg mx-auto mb-4 rounded-lg border border-amber-500/30 p-4 text-sm text-amber-200">{sessionMessage}</p>}
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
            <span>© 2026 NexOS — Metodologia de Lançamentos</span>
          </div>
          <div className="flex items-center gap-4">
            <span>PT-BR</span>
            <span>·</span>
            <span>Suporte: suporte@agencianexos.vip</span>
            <span>·</span>
            <button
              className="hover:text-[hsl(250_90%_75%)] transition-colors"
              onClick={() => navigate("owner")}
            >
              ⚡
            </button>
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
