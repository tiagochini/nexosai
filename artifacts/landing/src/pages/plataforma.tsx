import { useState } from "react";
import { Link } from "wouter";
import nexosLogo from "/nexos-logo.png";

const CONTENT = {
  "pt-BR": {
    lang: "pt-BR",
    alt: "EN",
    altPath: "/platform",
    badge: "DOCUMENTO TÉCNICO · NXS-2026-002",
    title: "NexOS AI",
    subtitle: "Sistema Operacional de Execução de Campanhas",
    tagline: "De intenção a lançamento. Totalmente autônomo.",
    version: "Versão 2.0 · Junho 2026",
    confidential: "Documento Institucional — Uso Público Autorizado",

    execSummary: {
      h: "Sumário Executivo",
      p: [
        "NexOS AI é uma plataforma de execução autônoma de campanhas digitais movida por 64 agentes especializados de inteligência artificial. Ela transforma intenção do usuário em lançamentos completos — estratégia, copy, criativos, funis, sequências de automação e análise de performance — sem exigir expertise técnica.",
        "O sistema opera sobre uma arquitetura de orquestração em camadas: um Command Agent coordena agentes especializados por domínio, cada um treinado nas melhores doutrinas do mercado global (Jeff Walker, Gary Halbert, Frank Kern, Dan Kennedy, Eugene Schwartz, David Ogilvy, entre outros). O resultado é a entrega de uma agência completa de lançamento digital operando 24h/7/365.",
        "A plataforma está em operação ativa. Pipeline de execução com 94% de aprovação em testes de estresse completos com 34 agentes simultâneos.",
      ],
    },

    capabilities: {
      h: "Capacidades da Plataforma",
      items: [
        {
          id: "5.1",
          title: "Command Agent & Orquestração",
          status: "ATIVO",
          desc: "Um agente de comando central coordena 64 agentes especializados agrupados em 7 departamentos: Estratégia, Conteúdo, Audiência, Vídeo, Analytics, Automação e Vendas. O usuário não escolhe agentes — o sistema os convoca no momento certo, na sequência certa.",
          agents: ["Strategy", "Offer", "Copywriter", "Creative Director", "VSL Script", "CPL Script", "Launch Manager", "Media Buyer", "Targeting", "Compliance", "Analytics", "Optimization", "Creator Growth", "Affiliate Campaign", "Financial Projector", "+ 49 agentes especializados"],
        },
        {
          id: "5.2",
          title: "Live Production Display",
          status: "ATIVO",
          desc: "Interface em tempo real que exibe a produção acontecendo — pensamentos dos agentes, decisões tomadas, checkpoints completos. Tudo se torna um log auditável. Comunicação via WebSocket (Socket.io) com rooms de campanha.",
        },
        {
          id: "5.3",
          title: "Motor de Produção de Vídeo",
          status: "ATIVO · CHAVES EXTERNAS",
          desc: "Três modos: (1) Com aparição — roteiro completo, storyboard, guia de filmagem, direção de cena, notas de edição; (2) Sem aparição — avatar digital + voz clonada via HeyGen + ElevenLabs, pré-aprovação obrigatória de frames antes da renderização final; (3) Híbrido. O editor de vídeo nativo conecta-se aos agentes de direção para análise e orientação quando o usuário sobe seu arquivo.",
        },
        {
          id: "5.4",
          title: "Motor de Tipos de Campanha",
          status: "ATIVO",
          desc: "Identifica e executa automaticamente: Lançamento PLF, Lançamento Semente, Afiliado, Perpétuo, Branding Regional, Vendas Contínuas, Remarketing, Upsell, Crescimento de Audiência, Monetização de Criador.",
        },
        {
          id: "5.5",
          title: "Launch Engine — Sequência Completa",
          status: "ATIVO",
          desc: "Execução completa do funil PLF: captura → aquecimento → autoridade → desejo → oferta → escassez → abertura do carrinho → fechamento → remarketing → prova social → próximo ciclo. Scheduler automático com despacho segmentado (quente/morno/frio) e analytics de engajamento em tempo real.",
        },
        {
          id: "5.6",
          title: "Self-Proof Engine",
          status: "ATIVO",
          desc: "O NexOS lança a si próprio e documenta sua própria execução. O módulo captura métricas reais de campanhas NexOS, gera cases automáticos com resultado auditável e publica como prova pública. A plataforma que usa a própria metodologia como vitrine.",
        },
        {
          id: "5.7",
          title: "Inteligência de Tráfego Pago",
          status: "ATIVO",
          desc: "Planejamento e análise profunda: sinais de entrega, janelas de aprendizado, otimização de lance, segmentação dinâmica, comportamento de leilão. Estratégia Meta Live em 3 camadas simultâneas (Engajamento + Tráfego + Vendas). Integração com Meta Ads, Google Ads e TikTok Ads.",
        },
        {
          id: "5.8",
          title: "Interface Adaptativa — Modo Fundador / Arquiteto",
          status: "ATIVO",
          desc: "Dois modos de uso: FUNDADOR (simples, guiado, emocional, visual limpo — para quem está iniciando) e ARQUITETO (técnico, granular, logs completos, métricas avançadas). O usuário alterna livremente. A experiência segue 22 estados oficiais de UX.",
        },
        {
          id: "5.9",
          title: "Geração de Landing Page + Publicação",
          status: "ATIVO · PUBLICAÇÃO GUIADA",
          desc: "O agente Russell gera landing pages completas com copy, estrutura, CTAs, CRO notes e guia visual. A publicação é assistida: o sistema entrega o conteúdo otimizado e guia o usuário pelas melhores opções de hospedagem. Roadmap: publicação autônoma nativa.",
        },
      ],
    },

    pricing: {
      h: "Modelo de Precificação",
      sub: "Você não paga por tokens. Você paga por execução de excelência.",
      plans: [
        {
          name: "Acesso à Plataforma — Solo",
          price: "R$ 3.990",
          tag: "Lançamento",
          regular: "R$ 5.000 regular",
          desc: "Acesso vitalício único. Inclui até 3 campanhas + 2 lançamentos no estilo PLF.",
          items: ["3 campanhas ativas", "Track de 6 dígitos", "NexOS Academy inclusa", "Suporte via comunidade"],
        },
        {
          name: "Acesso à Plataforma — Agency",
          price: "R$ 9.990",
          tag: "Lançamento",
          regular: "R$ 14.000 regular",
          desc: "Acesso vitalício único. Para agências e profissionais de alto volume.",
          items: ["10 campanhas ativas", "Todos os tracks (6, 8, 10 dígitos)", "White-label", "NexOS Academy inclusa", "Suporte prioritário"],
        },
        {
          name: "Execução de Lançamento",
          price: "R$ 497",
          tag: "Por lançamento",
          regular: null,
          desc: "Pagamento único por ciclo de lançamento completo. Os melhores launchers e copywriters do mundo trabalhando pelo seu negócio.",
          items: ["Pipeline completo: estratégia + copy + compliance + sequência", "64 agentes especializados", "Aprovação em cada etapa", "Sem limite de iterações dentro do lançamento"],
          highlight: true,
        },
        {
          name: "Campanha Perpétua",
          price: "R$ 1.250",
          tag: "Por mês",
          regular: null,
          desc: "Para quem opera em modo contínuo. Ciclos de conteúdo automáticos, sequências ativas, métricas em tempo real.",
          items: ["Ciclos de conteúdo ilimitados", "Sequência de nutrição ativa 24/7", "Otimização automática por IA", "Analytics semanal por e-mail"],
          highlight: true,
        },
      ],
      note: "Produção de vídeo com avatar digital ou voz clonada: cobrado separado por produção. Scripts + frame cards entregues para pré-aprovação antes de qualquer renderização final.",
    },

    agents: {
      h: "Os 64 Agentes",
      sub: "Cada agente é treinado nas melhores doutrinas do mercado global e opera dentro do sistema DOMINO — a filosofia central de persuasão da plataforma.",
      groups: [
        {
          cat: "Estratégia",
          color: "text-blue-400",
          list: ["Command (Erick)", "Strategy (Jefferson)", "Launch Manager (Gerente)", "Offer (Alexandre)", "Compliance (Philip)", "Product Builder (Builder)", "Perpetual Launch Manager (Magnus)", "Financial Projector (Chet)", "Market Intel", "Pricing Psychologist", "Product Validator"],
        },
        {
          cat: "Conteúdo",
          color: "text-green-400",
          list: ["Copywriter (Gary)", "Creative Director (Tyler)", "Ad Copy (Dean)", "Social Media (Chris)", "Stories Sequence (Jordan)", "Media Brief (Miles)", "Landing Page (Russell)", "Affiliate Campaign (Chip)", "VSL Script (Jon)", "CPL Script (Neil)", "Email Architect", "Webinar Script (Todd)", "Live Script (Grant)", "Domino Agent", "Hook Factory", "AB Test Designer"],
        },
        {
          cat: "Audiência",
          color: "text-purple-400",
          list: ["Targeting (Perry)", "Media Buyer (Nicholas)", "Organic Traffic (Marcus)", "Creator Growth (Leandro)", "Analytics (Avinash)", "Optimization (Laura)", "Traffic Intelligence", "Scarcity Engineer", "Objection Killer", "Testimonial Curator", "Reengagement", "Upsell Architect"],
        },
        {
          cat: "Vídeo",
          color: "text-orange-400",
          list: ["Video Strategy (Sandra)", "Scene Director", "Avatar + Voice Agent", "Video Hook", "Campaign Emotional Arc"],
        },
        {
          cat: "Automação & Analytics",
          color: "text-cyan-400",
          list: ["Launch Sequence Builder", "Continuous Sales Manager (Brad)", "WhatsApp Response (Marco)", "Business Intelligence", "Launch Debriefing", "Memory Compression", "Cross-Campaign Intelligence", "Execution Governor", "Output Judge", "Context Refinement"],
        },
        {
          cat: "Vendas",
          color: "text-yellow-400",
          list: ["Sales Warmer (Marco)", "Sales Desire (Renata)", "Sales Closer (Vitor)", "Sales Objection Handler (Clara)", "Sales Consultant (Alex)", "Buyer Onboarding"],
        },
        {
          cat: "Mentalidade",
          color: "text-pink-400",
          list: ["Mental Frequency Coach (Viktor)", "Identity Architect (Nadia)", "Obstinacy Trainer (Krav)", "Ethics Autocorrect", "Emotional Coherence Checker"],
        },
      ],
    },

    arch: {
      h: "Arquitetura Técnica",
      items: [
        { label: "Runtime", val: "Node.js 24 · TypeScript 5.9" },
        { label: "API", val: "Express 5 · Modular domain architecture" },
        { label: "Banco de Dados", val: "PostgreSQL + Drizzle ORM" },
        { label: "Tempo real", val: "Socket.io (WebSocket) · BullMQ + Redis" },
        { label: "IA — Estratégia", val: "Anthropic Claude (raciocínio profundo)" },
        { label: "IA — Conteúdo", val: "OpenAI GPT (copy, criativo)" },
        { label: "IA — Analytics", val: "Google Gemini (análise, otimização)" },
        { label: "IA — Vídeo", val: "HeyGen (avatar) · ElevenLabs (voz)" },
        { label: "Auth", val: "JWT (access 15m + refresh 30d) · bcrypt" },
        { label: "Integrations", val: "Meta Ads, Google Ads, TikTok Ads, WhatsApp Business, RD Station, ActiveCampaign, Hotmart, Kiwify, Stripe, ASAAS" },
      ],
    },

    footer: {
      doc: "Documento NXS-2026-002",
      copy: "© 2026 NexOS AI. Todos os direitos reservados.",
      contact: "contato@nexos.ai",
    },
  },
  "en": {
    lang: "en",
    alt: "PT-BR",
    altPath: "/plataforma",
    badge: "TECHNICAL DOCUMENT · NXS-2026-002",
    title: "NexOS AI",
    subtitle: "Campaign Execution Operating System",
    tagline: "From intention to launch. Fully autonomous.",
    version: "Version 2.0 · June 2026",
    confidential: "Institutional Document — Public Use Authorized",

    execSummary: {
      h: "Executive Summary",
      p: [
        "NexOS AI is an autonomous digital campaign execution platform powered by 64 specialized AI agents. It transforms user intention into complete launches — strategy, copy, creatives, funnels, automation sequences and performance analytics — without requiring technical expertise.",
        "The system operates on a layered orchestration architecture: a Command Agent coordinates domain-specialized agents, each trained on the best global marketing doctrines (Jeff Walker, Gary Halbert, Frank Kern, Dan Kennedy, Eugene Schwartz, David Ogilvy, and others). The result is a complete digital launch agency operating 24h/7/365.",
        "The platform is in active operation. Execution pipeline with 94% approval rate on full stress tests with 34 simultaneous agents.",
      ],
    },

    capabilities: {
      h: "Platform Capabilities",
      items: [
        {
          id: "5.1",
          title: "Command Agent & Orchestration",
          status: "ACTIVE",
          desc: "A central command agent coordinates 64 specialized agents grouped into 7 departments: Strategy, Content, Audience, Video, Analytics, Automation and Sales. The user doesn't choose agents — the system summons them at the right moment, in the right sequence.",
          agents: ["Strategy", "Offer", "Copywriter", "Creative Director", "VSL Script", "CPL Script", "Launch Manager", "Media Buyer", "Targeting", "Compliance", "Analytics", "Optimization", "Creator Growth", "Affiliate Campaign", "Financial Projector", "+ 49 specialized agents"],
        },
        {
          id: "5.2",
          title: "Live Production Display",
          status: "ACTIVE",
          desc: "Real-time interface displaying production as it happens — agent thinking, decisions made, completed checkpoints. Everything becomes an auditable log. Communication via WebSocket (Socket.io) with campaign rooms.",
        },
        {
          id: "5.3",
          title: "Video Production Engine",
          status: "ACTIVE · EXTERNAL KEYS",
          desc: "Three modes: (1) With appearance — full script, storyboard, filming guide, scene direction, editing notes; (2) Without appearance — digital avatar + cloned voice via HeyGen + ElevenLabs, mandatory frame pre-approval before final rendering; (3) Hybrid. The native video editor connects to direction agents for analysis and guidance when the user uploads their file.",
        },
        {
          id: "5.4",
          title: "Campaign Type Engine",
          status: "ACTIVE",
          desc: "Automatically identifies and executes: PLF Launch, Seed Launch, Affiliate, Evergreen, Regional Branding, Continuous Sales, Remarketing, Upsell, Audience Growth, Creator Monetization.",
        },
        {
          id: "5.5",
          title: "Launch Engine — Full Sequence",
          status: "ACTIVE",
          desc: "Complete PLF funnel execution: capture → warming → authority → desire → offer → scarcity → cart open → close → remarketing → social proof → next cycle. Automatic scheduler with segmented dispatch (hot/warm/cold) and real-time engagement analytics.",
        },
        {
          id: "5.6",
          title: "Self-Proof Engine",
          status: "ACTIVE",
          desc: "NexOS launches itself and documents its own execution. The module captures real metrics from NexOS campaigns, auto-generates cases with auditable results, and publishes them as public proof. The platform that uses its own methodology as showcase.",
        },
        {
          id: "5.7",
          title: "Paid Traffic & Algorithm Intelligence",
          status: "ACTIVE",
          desc: "Deep planning and analysis: delivery signals, learning windows, bid optimization, dynamic segmentation, auction behavior. Meta Live strategy in 3 simultaneous layers (Engagement + Traffic + Sales). Integration with Meta Ads, Google Ads and TikTok Ads.",
        },
        {
          id: "5.8",
          title: "Adaptive Interface — Founder / Architect Mode",
          status: "ACTIVE",
          desc: "Two usage modes: FOUNDER (simple, guided, emotional, clean visuals — for those starting out) and ARCHITECT (technical, granular, full logs, advanced metrics). The user switches freely. The experience follows 22 official UX states.",
        },
        {
          id: "5.9",
          title: "Landing Page Generation + Publication",
          status: "ACTIVE · GUIDED PUBLISHING",
          desc: "Agent Russell generates complete landing pages with copy, structure, CTAs, CRO notes and visual guide. Publication is assisted: the system delivers optimized content and guides the user through the best hosting options. Roadmap: native autonomous publishing.",
        },
      ],
    },

    pricing: {
      h: "Pricing Model",
      sub: "You don't pay for tokens. You pay for excellence in execution.",
      plans: [
        {
          name: "Platform Access — Solo",
          price: "R$ 3,990",
          tag: "Launch price",
          regular: "R$ 5,000 regular",
          desc: "Single lifetime access. Includes up to 3 campaigns + 2 PLF-style launches.",
          items: ["3 active campaigns", "6-digit revenue track", "NexOS Academy included", "Community support"],
        },
        {
          name: "Platform Access — Agency",
          price: "R$ 9,990",
          tag: "Launch price",
          regular: "R$ 14,000 regular",
          desc: "Single lifetime access. For agencies and high-volume professionals.",
          items: ["10 active campaigns", "All tracks (6, 8, 10-digit revenue)", "White-label", "NexOS Academy included", "Priority support"],
        },
        {
          name: "Launch Execution",
          price: "R$ 497",
          tag: "Per launch",
          regular: null,
          desc: "Single payment per complete launch cycle. The world's best launchers and copywriters working for your business.",
          items: ["Full pipeline: strategy + copy + compliance + sequence", "64 specialized agents", "Approval at every stage", "Unlimited iterations within the launch"],
          highlight: true,
        },
        {
          name: "Evergreen Campaign",
          price: "R$ 1,250",
          tag: "Per month",
          regular: null,
          desc: "For those operating in continuous mode. Automatic content cycles, active sequences, real-time metrics.",
          items: ["Unlimited content cycles", "Active 24/7 nurturing sequence", "Automatic AI optimization", "Weekly email analytics report"],
          highlight: true,
        },
      ],
      note: "Video production with digital avatar or cloned voice: charged separately per production. Scripts + frame cards delivered for pre-approval before any final rendering.",
    },

    agents: {
      h: "The 64 Agents",
      sub: "Each agent is trained on the best global market doctrines and operates within the DOMINO system — the platform's central persuasion philosophy.",
      groups: [
        {
          cat: "Strategy",
          color: "text-blue-400",
          list: ["Command (Erick)", "Strategy (Jefferson)", "Launch Manager", "Offer (Alexandre)", "Compliance (Philip)", "Product Builder", "Perpetual Launch Manager (Magnus)", "Financial Projector (Chet)", "Market Intel", "Pricing Psychologist", "Product Validator"],
        },
        {
          cat: "Content",
          color: "text-green-400",
          list: ["Copywriter (Gary)", "Creative Director (Tyler)", "Ad Copy (Dean)", "Social Media (Chris)", "Stories Sequence (Jordan)", "Media Brief (Miles)", "Landing Page (Russell)", "Affiliate Campaign (Chip)", "VSL Script (Jon)", "CPL Script (Neil)", "Email Architect", "Webinar Script (Todd)", "Live Script (Grant)", "Domino Agent", "Hook Factory", "AB Test Designer"],
        },
        {
          cat: "Audience",
          color: "text-purple-400",
          list: ["Targeting (Perry)", "Media Buyer (Nicholas)", "Organic Traffic (Marcus)", "Creator Growth (Leandro)", "Analytics (Avinash)", "Optimization (Laura)", "Traffic Intelligence", "Scarcity Engineer", "Objection Killer", "Testimonial Curator", "Reengagement", "Upsell Architect"],
        },
        {
          cat: "Video",
          color: "text-orange-400",
          list: ["Video Strategy (Sandra)", "Scene Director", "Avatar + Voice Agent", "Video Hook", "Campaign Emotional Arc"],
        },
        {
          cat: "Automation & Analytics",
          color: "text-cyan-400",
          list: ["Launch Sequence Builder", "Continuous Sales Manager (Brad)", "WhatsApp Response (Marco)", "Business Intelligence", "Launch Debriefing", "Memory Compression", "Cross-Campaign Intelligence", "Execution Governor", "Output Judge", "Context Refinement"],
        },
        {
          cat: "Sales",
          color: "text-yellow-400",
          list: ["Sales Warmer (Marco)", "Sales Desire (Renata)", "Sales Closer (Vitor)", "Sales Objection Handler (Clara)", "Sales Consultant (Alex)", "Buyer Onboarding"],
        },
        {
          cat: "Mindset",
          color: "text-pink-400",
          list: ["Mental Frequency Coach (Viktor)", "Identity Architect (Nadia)", "Obstinacy Trainer (Krav)", "Ethics Autocorrect", "Emotional Coherence Checker"],
        },
      ],
    },

    arch: {
      h: "Technical Architecture",
      items: [
        { label: "Runtime", val: "Node.js 24 · TypeScript 5.9" },
        { label: "API", val: "Express 5 · Modular domain architecture" },
        { label: "Database", val: "PostgreSQL + Drizzle ORM" },
        { label: "Real-time", val: "Socket.io (WebSocket) · BullMQ + Redis" },
        { label: "AI — Strategy", val: "Anthropic Claude (deep reasoning)" },
        { label: "AI — Content", val: "OpenAI GPT (copy, creative)" },
        { label: "AI — Analytics", val: "Google Gemini (analysis, optimization)" },
        { label: "AI — Video", val: "HeyGen (avatar) · ElevenLabs (voice)" },
        { label: "Auth", val: "JWT (access 15m + refresh 30d) · bcrypt" },
        { label: "Integrations", val: "Meta Ads, Google Ads, TikTok Ads, WhatsApp Business, RD Station, ActiveCampaign, Hotmart, Kiwify, Stripe, ASAAS" },
      ],
    },

    footer: {
      doc: "Document NXS-2026-002",
      copy: "© 2026 NexOS AI. All rights reserved.",
      contact: "contact@nexos.ai",
    },
  },
};

function StatusBadge({ status }: { status: string }) {
  const isActive = status.startsWith("ACTIVE") || status.startsWith("ATIVO");
  const isPartial = status.includes("·");
  return (
    <span
      className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-widest border ${
        isActive && !isPartial
          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
          : isPartial
          ? "bg-amber-950 text-amber-400 border-amber-800"
          : "bg-gray-950 text-gray-400 border-gray-800"
      }`}
    >
      {status}
    </span>
  );
}

export default function PlataformaPage({ lang = "pt-BR" }: { lang?: "pt-BR" | "en" }) {
  const [activeLang, setActiveLang] = useState<"pt-BR" | "en">(lang);
  const c = CONTENT[activeLang];

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');
        body { font-family: 'IBM Plex Mono', monospace; }
        .doc-section { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3rem; margin-top: 3rem; }
        .capability-card { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); border-radius: 4px; }
        .capability-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
        .plan-highlight { border-color: rgba(99,102,241,0.6) !important; background: rgba(99,102,241,0.05) !important; }
        .plan-highlight:hover { border-color: rgba(99,102,241,0.9) !important; }
        .agent-tag { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); font-size: 11px; padding: 2px 8px; border-radius: 2px; }
      `}</style>

      {/* Header nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS AI" className="h-6 w-auto opacity-90" />
            <span className="text-xs text-white/40 tracking-widest hidden sm:inline">PLATAFORMA</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-white/30 hidden sm:inline tracking-wider">{c.badge}</span>
            <button
              onClick={() => setActiveLang(activeLang === "pt-BR" ? "en" : "pt-BR")}
              className="text-xs border border-white/20 px-3 py-1 rounded hover:border-white/40 hover:bg-white/5 transition-all tracking-wider"
            >
              {c.alt}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Cover */}
        <header className="mb-20">
          <div className="mb-6">
            <span className="text-[11px] tracking-[0.3em] text-white/30">{c.badge}</span>
          </div>
          <div className="mb-2">
            <span className="text-[11px] tracking-widest text-indigo-400 border border-indigo-900 px-2 py-1 rounded">
              {c.version}
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter mt-6 mb-3">
            {c.title}
          </h1>
          <h2 className="text-xl sm:text-2xl text-white/50 font-light mb-4">
            {c.subtitle}
          </h2>
          <p className="text-2xl sm:text-3xl font-medium text-indigo-300 mb-8">
            {c.tagline}
          </p>
          <div className="flex flex-wrap gap-6 text-[11px] text-white/30 tracking-widest pt-8 border-t border-white/10">
            <span>{c.confidential}</span>
            <span>{c.footer.doc}</span>
          </div>
        </header>

        {/* Executive Summary */}
        <section className="doc-section">
          <div className="mb-2 text-[10px] tracking-[0.3em] text-white/30">01</div>
          <h2 className="text-2xl font-semibold mb-8">{c.execSummary.h}</h2>
          <div className="space-y-4">
            {c.execSummary.p.map((p, i) => (
              <p key={i} className="text-white/60 leading-relaxed text-sm">{p}</p>
            ))}
          </div>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
            {[
              { n: "64", l: activeLang === "pt-BR" ? "Agentes IA" : "AI Agents" },
              { n: "94%", l: activeLang === "pt-BR" ? "Taxa de aprovação" : "Pass rate" },
              { n: "7", l: activeLang === "pt-BR" ? "Departamentos" : "Departments" },
              { n: "24/7/365", l: activeLang === "pt-BR" ? "Operação" : "Operation" },
            ].map((k) => (
              <div key={k.n} className="border border-white/10 p-4">
                <div className="text-3xl font-bold text-indigo-300 mb-1">{k.n}</div>
                <div className="text-[11px] text-white/40 tracking-wider">{k.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="doc-section">
          <div className="mb-2 text-[10px] tracking-[0.3em] text-white/30">02</div>
          <h2 className="text-2xl font-semibold mb-8">{c.capabilities.h}</h2>
          <div className="space-y-4">
            {c.capabilities.items.map((cap) => (
              <div key={cap.id} className="capability-card p-6 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-white/30 tracking-widest font-bold">{cap.id}</span>
                    <h3 className="text-base font-semibold">{cap.title}</h3>
                  </div>
                  <StatusBadge status={cap.status} />
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-3">{cap.desc}</p>
                {"agents" in cap && cap.agents && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {cap.agents.map((a) => (
                      <span key={a} className="agent-tag text-white/40">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="doc-section">
          <div className="mb-2 text-[10px] tracking-[0.3em] text-white/30">03</div>
          <h2 className="text-2xl font-semibold mb-2">{c.pricing.h}</h2>
          <p className="text-white/40 text-sm mb-8">{c.pricing.sub}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {c.pricing.plans.map((plan) => (
              <div
                key={plan.name}
                className={`capability-card p-6 transition-all ${plan.highlight ? "plan-highlight" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white/80">{plan.name}</h3>
                  {plan.highlight && (
                    <span className="text-[9px] tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded font-bold shrink-0">
                      {plan.tag.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {!plan.highlight && (
                    <span className="text-xs text-indigo-400 tracking-wider">{plan.tag}</span>
                  )}
                </div>
                {plan.regular && (
                  <div className="text-[11px] text-white/30 line-through mb-2">{plan.regular}</div>
                )}
                <p className="text-xs text-white/45 leading-relaxed mb-4">{plan.desc}</p>
                <ul className="space-y-1.5">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-white/55">
                      <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/30 mt-6 leading-relaxed border-l-2 border-white/10 pl-4">
            {c.pricing.note}
          </p>
        </section>

        {/* Agents */}
        <section className="doc-section">
          <div className="mb-2 text-[10px] tracking-[0.3em] text-white/30">04</div>
          <h2 className="text-2xl font-semibold mb-2">{c.agents.h}</h2>
          <p className="text-white/40 text-sm mb-8">{c.agents.sub}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.agents.groups.map((g) => (
              <div key={g.cat} className="capability-card p-5">
                <h3 className={`text-xs font-bold tracking-widest mb-4 ${g.color}`}>
                  {g.cat.toUpperCase()}
                </h3>
                <ul className="space-y-1.5">
                  {g.list.map((a) => (
                    <li key={a} className="text-xs text-white/45 flex items-start gap-1.5">
                      <span className={`${g.color} opacity-60 shrink-0`}>·</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="doc-section">
          <div className="mb-2 text-[10px] tracking-[0.3em] text-white/30">05</div>
          <h2 className="text-2xl font-semibold mb-8">{c.arch.h}</h2>
          <div className="capability-card">
            <table className="w-full text-sm">
              <tbody>
                {c.arch.items.map((row, i) => (
                  <tr key={row.label} className={i !== c.arch.items.length - 1 ? "border-b border-white/5" : ""}>
                    <td className="py-3 px-5 text-white/30 text-xs tracking-wider whitespace-nowrap w-1/3">
                      {row.label}
                    </td>
                    <td className="py-3 px-5 text-white/70 text-xs">{row.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="doc-section mt-20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={nexosLogo} alt="NexOS AI" className="h-5 w-auto opacity-40" />
              <span className="text-xs text-white/25">{c.footer.copy}</span>
            </div>
            <div className="flex gap-6 text-[11px] text-white/25">
              <span>{c.footer.doc}</span>
              <a href={`mailto:${c.footer.contact}`} className="hover:text-white/50 transition-colors">
                {c.footer.contact}
              </a>
              <Link href="/" className="hover:text-white/50 transition-colors">
                nexos.ai
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
