import { useState } from "react";
import nexosLogo from "/nexos-logo.png";
import { ExternalLink, Clock, Users, Zap, BookOpen } from "lucide-react";
import LeadCaptureModal from "@/components/LeadCaptureModal";

const BASE = typeof window !== "undefined" ? window.location.origin : "";
const GRUPO_LINK = "https://chat.whatsapp.com/KpC38jdRCdOImiq8uZegiU";

type ProductKey = "pdf" | "miniguia" | "academy" | "nexos";

interface Product {
  key: ProductKey;
  tag: string;
  tagOld?: string;
  tagColor: string;
  tagBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  glow: string;
  border: string;
  ctaStyle: React.CSSProperties;
  badge?: string;
  waitlist?: boolean;
  modalTitle?: string;
  modalSubtitle?: string;
}

const PRODUCTS: Product[] = [
  {
    key: "pdf",
    tag: "GRÁTIS",
    tagColor: "hsl(168 100% 42%)",
    tagBg: "hsl(168 100% 42% / 0.1)",
    icon: <BookOpen size={18} />,
    title: "Os 7 Erros Fatais que Matam Lançamentos",
    subtitle: "PDF Gratuito · Guia de Alto Valor",
    description: "Como 93% dos lançadores sabotam suas próprias campanhas — e o método de IA que resolve cada um automaticamente.",
    cta: "Baixar Grátis →",
    glow: "hsl(168 100% 42% / 0.08)",
    border: "hsl(168 100% 42% / 0.18)",
    ctaStyle: { background: "hsl(168 100% 38%)", color: "#fff" },
    modalTitle: "Receba o PDF\nno seu WhatsApp",
    modalSubtitle: "Informe seus dados e enviaremos o guia + acesso ao grupo exclusivo.",
  },
  {
    key: "miniguia",
    tag: "R$97",
    tagOld: "R$290",
    tagColor: "hsl(250 90% 75%)",
    tagBg: "hsl(250 90% 75% / 0.1)",
    icon: <Zap size={18} />,
    title: "Primeiros R$10K em Vendas na Internet em 30 Dias",
    subtitle: "Mini-Guia Pago · Acesso via Grupo WhatsApp",
    description: "O plano operacional completo com scripts de copy, cronograma de 30 dias e o framework que produtores usam para chegar nos primeiros 5 dígitos.",
    cta: "Quero o Mini-Guia →",
    glow: "hsl(250 90% 65% / 0.06)",
    border: "hsl(250 90% 65% / 0.2)",
    ctaStyle: { background: "hsl(250 90% 60%)", color: "#fff" },
    badge: "🔥 Lançamento R$97",
    modalTitle: "Garanta seu acesso\nao Mini-Guia",
    modalSubtitle: "Preencha seus dados e você receberá o link de acesso no WhatsApp.",
  },
  {
    key: "academy",
    tag: "LISTA DE ESPERA",
    tagColor: "hsl(40 95% 65%)",
    tagBg: "hsl(40 95% 60% / 0.1)",
    icon: <BookOpen size={18} />,
    title: "NexOS Academy — Metodologia Completa",
    subtitle: "Curso · Lançamento por carrinho · Acesso Vitalício",
    description: "O sistema completo de lançamento digital. Módulos práticos, aulas ao vivo, Professor Allan com IA adaptativa. Só disponível durante a abertura oficial do carrinho.",
    cta: "Entrar na Lista de Espera →",
    glow: "hsl(40 95% 55% / 0.06)",
    border: "hsl(40 95% 55% / 0.22)",
    ctaStyle: { background: "linear-gradient(135deg, hsl(40 95% 55%), hsl(35 90% 45%))", color: "#000" },
    badge: "Em breve",
    waitlist: true,
    modalTitle: "Entrar na Lista\nde Espera — Academy",
    modalSubtitle: "Você será avisado primeiro quando o carrinho abrir — com condição exclusiva para inscritos.",
  },
  {
    key: "nexos",
    tag: "LISTA DE ESPERA",
    tagColor: "hsl(220 10% 70%)",
    tagBg: "hsl(220 10% 70% / 0.06)",
    icon: <Zap size={18} />,
    title: "NexOS AI — Sistema de Execução Autônoma de Lançamentos",
    subtitle: "SaaS · Lançamento por carrinho · Acesso Único Vitalício",
    description: "57 agentes de IA executando seu lançamento end-to-end — estratégia, copy, sequências, métricas e atendimento. Sem agência, sem equipe.",
    cta: "Entrar na Lista de Espera →",
    glow: "hsl(250 90% 65% / 0.04)",
    border: "hsl(220 15% 18%)",
    ctaStyle: { background: "linear-gradient(135deg, hsl(250 90% 60%), hsl(260 80% 50%))", color: "#fff" },
    badge: "Em breve",
    waitlist: true,
    modalTitle: "Entrar na Lista\nde Espera — NexOS AI",
    modalSubtitle: "Você será notificado primeiro quando o lançamento abrir — com acesso antecipado e condição especial.",
  },
];

export default function Hub() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  function openModal(product: Product) {
    setActiveProduct(product);
    setModalOpen(true);
  }

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
          Do PDF gratuito ao sistema nervoso do seu lançamento — tudo começa aqui.
        </p>
      </div>

      {/* Product cards */}
      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-4">
        {PRODUCTS.map((p) => (
          <div
            key={p.key}
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: "hsl(222 25% 6%)",
              border: `1px solid ${p.border}`,
              boxShadow: `0 0 40px ${p.glow}`,
            }}
          >
            {p.badge && (
              <div
                className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
                style={
                  p.waitlist
                    ? { background: "hsl(220 15% 14%)", color: "hsl(220 10% 50%)", border: "1px solid hsl(220 15% 20%)" }
                    : { background: "hsl(40 95% 55% / 0.15)", color: "hsl(40 95% 65%)", border: "1px solid hsl(40 95% 55% / 0.25)" }
                }
              >
                {p.waitlist ? <><Clock size={10} className="inline mr-1" />{p.badge}</> : p.badge}
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {/* Price tag */}
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded"
                    style={{ color: p.tagColor, background: p.tagBg }}
                  >
                    {p.tag}
                  </span>
                  {/* Old price strikethrough */}
                  {p.tagOld && (
                    <span className="text-xs line-through" style={{ color: "hsl(220 10% 35%)" }}>
                      {p.tagOld}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white mb-0.5 leading-snug">{p.title}</h2>
                <p className="text-xs mb-3" style={{ color: "hsl(220 10% 45%)" }}>{p.subtitle}</p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(220 10% 60%)" }}>{p.description}</p>

                {/* Waitlist extra info */}
                {p.waitlist && (
                  <div
                    className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: "hsl(220 15% 10%)", color: "hsl(220 10% 45%)", border: "1px solid hsl(220 15% 16%)" }}
                  >
                    <Users size={12} />
                    Preço divulgado apenas no dia do lançamento para inscritos na lista
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => openModal(p)}
                className="inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 cursor-pointer border-0"
                style={p.ctaStyle}
              >
                {p.cta}
                {!p.waitlist && <ExternalLink size={14} />}
              </button>
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

      {/* Lead Capture Modal */}
      {activeProduct && (
        <LeadCaptureModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          redirectUrl={GRUPO_LINK}
          title={activeProduct.modalTitle}
          subtitle={activeProduct.modalSubtitle}
        />
      )}
    </div>
  );
}
