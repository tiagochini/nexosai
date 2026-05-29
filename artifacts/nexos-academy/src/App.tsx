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
import { useAntiPiracy, clearSession } from "@/hooks/useAntiPiracy";

const queryClient = new QueryClient();

type Page = "home" | "modules" | "module" | "lesson" | "products" | "progress" | "glossary" | "owner" | "mini-guide" | "mini-guide-sales" | "free-guide" | "lead-magnet";

interface NavState {
  page: Page;
  params: Record<string, string>;
}

const STORAGE_KEY = "nexos-academy-progress";
const ACCESS_KEY = "nexos-academy-access";
const PRODUCT_KEY = "nexos-academy-product";

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

function hasStoredAccess(): boolean {
  // Requires both the access flag AND the correct product (complete-bundle)
  return (
    localStorage.getItem(ACCESS_KEY) === "true" &&
    localStorage.getItem(PRODUCT_KEY) === "complete-bundle"
  );
}

const ALL_NAV_ITEMS = [
  { id: "home", label: "Início", icon: "🏠" },
  { id: "modules", label: "Módulos", icon: "📦" },
  { id: "glossary", label: "Glossário", icon: "📖" },
  { id: "products", label: "Produtos", icon: "🛒" },
  { id: "progress", label: "Progresso", icon: "📊" },
];

const PUBLIC_NAV_ITEMS = ALL_NAV_ITEMS.filter(n => ["home", "products"].includes(n.id));

const RESTRICTED_PAGES: Page[] = ["modules", "module", "lesson", "progress", "glossary", "mini-guide"];

function getHashPage(): string {
  const hash = window.location.hash;
  return hash.split("?")[0]; // strip any query-string embedded in the hash
}

function getInitialPage(): NavState {
  if (typeof window !== "undefined") {
    const hashPage = getHashPage();
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
  const [ownerMode, setOwnerMode] = useState<boolean>(() => {
    if (isOwnerMode()) return true;
    // Check both ?owner= in search AND embedded in hash (e.g. #mini-guide?owner=TOKEN)
    const hashSearch = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?")[1])
      : null;
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("owner") ?? hashSearch?.get("owner");
    if (token === "NX-FOUNDER-2026") {
      sessionStorage.setItem("nexos-owner-mode", "true");
      return true;
    }
    return false;
  });
  const [hasAccess, setHasAccess] = useState<boolean>(() => hasStoredAccess() || isOwnerMode());
  const [brand, setBrand] = useState<BrandConfig>(() => loadBrand());
  const [sessionConflict, setSessionConflict] = useState(false);
  const [studentName] = useState<string>(() => localStorage.getItem("nexos-student-name") ?? "");
  const [studentEmail] = useState<string>(() => localStorage.getItem("nexos-student-email") ?? "");

  useEffect(() => {
    const onBrandUpdated = () => setBrand(loadBrand());
    window.addEventListener("brand-updated", onBrandUpdated);
    return () => window.removeEventListener("brand-updated", onBrandUpdated);
  }, []);

  const ACADEMY_TOKEN_KEY = "nexos-academy-token";

  const grantAccess = useCallback((token?: string) => {
    localStorage.setItem(ACCESS_KEY, "true");
    localStorage.setItem(PRODUCT_KEY, "complete-bundle");
    if (token) localStorage.setItem(ACADEMY_TOKEN_KEY, token);
    setHasAccess(true);
  }, []);

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash;
      if (hash === "#owner") setNav({ page: "owner", params: {} });
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
    if (page !== "owner") {
      history.replaceState(null, "", window.location.pathname);
    }
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

  const handleOwnerChange = useCallback((val: boolean) => {
    setOwnerMode(val);
    if (val) {
      localStorage.setItem(ACCESS_KEY, "true");
      setHasAccess(true);
    }
  }, []);

  const totalLessons = 118;
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedLessons / totalLessons) * 100);

  const canAccess = hasAccess || ownerMode;

  useAntiPiracy({
    studentName,
    studentEmail,
    enabled: canAccess && !ownerMode,
    onSessionConflict: () => setSessionConflict(true),
  });

  const isActive = (id: string) =>
    nav.page === id || (id === "modules" && (nav.page === "module" || nav.page === "lesson"));

  const navItems = canAccess ? ALL_NAV_ITEMS : PUBLIC_NAV_ITEMS;

  function renderPage() {
    if (!canAccess && RESTRICTED_PAGES.includes(nav.page)) {
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
            <button className="btn-outline" onClick={() => navigate("home")}>
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }

    switch (nav.page) {
      case "home":
        return <Home onNavigate={navigate} progress={progress} hasAccess={canAccess} brand={brand} />;
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
            studentName={studentName}
            studentEmail={studentEmail}
          />
        );
      case "products":
        return <Products onNavigate={navigate} hasAccess={canAccess} onAccessGranted={grantAccess} paymentSuccess={nav.params.paymentSuccess === "1"} />;
      case "progress":
        return <ProgressPage onNavigate={navigate} progress={progress} onReset={resetProgress} />;
      case "glossary":
        return <Glossary onNavigate={navigate} />;
      case "owner":
        return <Owner onNavigate={navigate} onOwnerChange={handleOwnerChange} isOwner={ownerMode} />;
      case "mini-guide":
        return <MiniGuide onNavigate={navigate} studentName={studentName || (ownerMode ? "Fundador NexOS" : undefined)} studentEmail={studentEmail || (ownerMode ? "founder@nexos.ai" : undefined)} />;
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
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
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

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
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
            {navItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-link w-full ${isActive(item.id) ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
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
            {nav.page === "owner" && (
              <span className="text-[hsl(250_90%_75%)]">Painel do Dono</span>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {renderPage()}
      </main>

      {/* Session Conflict Modal */}
      {sessionConflict && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[hsl(222_25%_7%)] border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl mx-auto">
              🔐
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Sessão Ativa em Outro Dispositivo</h2>
              <p className="text-sm text-[hsl(220_10%_55%)] leading-relaxed">
                Detectamos que sua conta está sendo usada simultaneamente em outro dispositivo ou aba. 
                Por segurança, apenas uma sessão é permitida por vez.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                className="btn-primary w-full py-3"
                onClick={() => {
                  clearSession();
                  setSessionConflict(false);
                }}
              >
                Assumir esta Sessão
              </button>
              <button
                className="btn-outline w-full py-2 text-sm"
                onClick={() => {
                  setHasAccess(false);
                  localStorage.removeItem(ACCESS_KEY);
                  setSessionConflict(false);
                  setNav({ page: "home", params: {} });
                }}
              >
                Sair
              </button>
            </div>
            <p className="text-xs text-[hsl(220_10%_35%)]">
              Se você não reconhece outra sessão, considere trocar sua senha.
            </p>
          </div>
        </div>
      )}

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
