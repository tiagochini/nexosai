import nexosLogo from "/nexos-logo.png";
import { ExternalLink } from "lucide-react";

const BASE = typeof window !== "undefined" ? window.location.origin : "";

const PRODUCTS = [
  {
    tag: "GRÁTIS",
    tagColor: "hsl(168 100% 42%)",
    tagBg: "hsl(168 100% 42% / 0.1)",
    title: "7 Erros que Travam o Crescimento da Sua Audiência",
    subtitle: "PDF Gratuito · Lead Magnet",
    description: "O guia rápido para quem quer crescer online e para de se autossabotar antes de começar.",
    cta: "Baixar Grátis",
    href: `${BASE}/nexos-academy/#guia`,
    glow: "hsl(168 100% 42% / 0.08)",
    border: "hsl(168 100% 42% / 0.18)",
    ctaStyle: { background: "hsl(168 100% 38%)", color: "#fff" },
    badge: null,
  },
  {
    tag: "R$97",
    tagColor: "hsl(250 90% 75%)",
    tagBg: "hsl(250 90% 75% / 0.1)",
    title: "Mapa dos Primeiros R$10.000 em Vendas Online",
    subtitle: "Mini-Guia · PDF 14 Páginas com Marca d'Água",
    description: "10 capítulos práticos, scripts de copy prontos e o plano operacional para chegar aos 5 dígitos no Brasil real.",
    cta: "Adquirir Mini-Guia →",
    href: `${BASE}/nexos-academy/#products`,
    glow: "hsl(250 90% 65% / 0.06)",
    border: "hsl(250 90% 65% / 0.2)",
    ctaStyle: { background: "hsl(250 90% 60%)", color: "#fff" },
    badge: null,
  },
  {
    tag: "R$2.500",
    tagColor: "hsl(40 95% 60%)",
    tagBg: "hsl(40 95% 60% / 0.1)",
    title: "Metodologia NexOS — Academy",
    subtitle: "Curso Completo · Acesso Vitalício",
    description: "O sistema completo de lançamento digital. Módulos, aulas ao vivo, glossário estratégico e o Professor Allan com IA adaptativa.",
    cta: "Acessar Academy →",
    href: `${BASE}/nexos-academy/`,
    glow: "hsl(40 95% 55% / 0.06)",
    border: "hsl(40 95% 55% / 0.22)",
    ctaStyle: { background: "linear-gradient(135deg, hsl(40 95% 55%), hsl(35 90% 45%))", color: "#000" },
    badge: "Mais Popular",
  },
  {
    tag: "R$3.990",
    tagColor: "hsl(220 10% 75%)",
    tagBg: "hsl(220 10% 75% / 0.06)",
    title: "NexOS AI — Plataforma de Lançamentos",
    subtitle: "SaaS · Acesso Único Vitalício · Solo e Agency",
    description: "35 agentes de IA executando seu lançamento end-to-end. Do briefing à campanha ao vivo — sem agência, sem equipe.",
    cta: "Ver Plataforma →",
    href: `${BASE}/landing/`,
    glow: "hsl(250 90% 65% / 0.04)",
    border: "hsl(220 15% 18%)",
    ctaStyle: { background: "linear-gradient(135deg, hsl(250 90% 60%), hsl(260 80% 50%))", color: "#fff" },
    badge: null,
  },
];

export default function Hub() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "hsl(222 25% 4%)", color: "hsl(220 10% 96%)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Header */}
      <header style={{ borderBottom: "1px solid hsl(220 20% 10%)" }} className="px-6 py-4 flex items-center justify-between">
        <a href={`${BASE}/landing/`} className="flex items-center gap-3">
          <img src={nexosLogo} alt="NexOS" className="h-8 w-8 object-contain" />
          <span className="font-bold text-lg tracking-tight text-white">NexOS</span>
        </a>
        <a
          href={`${BASE}/`}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: "hsl(250 90% 60%)", color: "#fff" }}
        >
          Entrar na Plataforma →
        </a>
      </header>

      {/* Hero */}
      <div className="text-center pt-16 pb-10 px-6">
        <div
          className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6"
          style={{ background: "hsl(250 90% 60% / 0.12)", color: "hsl(250 90% 75%)", border: "1px solid hsl(250 90% 60% / 0.2)" }}
        >
          Ecossistema NexOS
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Escolha seu ponto de entrada
        </h1>
        <p style={{ color: "hsl(220 10% 55%)" }} className="text-base max-w-lg mx-auto">
          Do PDF gratuito ao sistema completo de lançamento com IA — cada produto está aqui.
        </p>
      </div>

      {/* Product cards */}
      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-4">
        {PRODUCTS.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: `hsl(222 25% 6%)`,
              border: `1px solid ${p.border}`,
              boxShadow: `0 0 40px ${p.glow}`,
            }}
          >
            {p.badge && (
              <div
                className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: "hsl(40 95% 55% / 0.15)", color: "hsl(40 95% 65%)", border: "1px solid hsl(40 95% 55% / 0.25)" }}
              >
                ⭐ {p.badge}
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded"
                    style={{ color: p.tagColor, background: p.tagBg }}
                  >
                    {p.tag}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mb-0.5 leading-snug">{p.title}</h2>
                <p className="text-xs mb-3" style={{ color: "hsl(220 10% 45%)" }}>{p.subtitle}</p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(220 10% 60%)" }}>{p.description}</p>
              </div>
            </div>

            <div className="mt-5">
              <a
                href={p.href}
                className="inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
                style={p.ctaStyle}
              >
                {p.cta}
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer
        className="text-center py-8 text-xs px-4"
        style={{ borderTop: "1px solid hsl(220 20% 10%)", color: "hsl(220 10% 35%)" }}
      >
        © 2026 NexOS · Metodologia de Lançamentos ·{" "}
        <a href={`${BASE}/landing/privacy`} className="hover:text-white">Privacidade</a>
        {" · "}
        <a href={`${BASE}/landing/terms`} className="hover:text-white">Termos</a>
      </footer>
    </div>
  );
}
