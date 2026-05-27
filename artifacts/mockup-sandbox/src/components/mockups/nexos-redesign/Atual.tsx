import { LayoutDashboard, Rocket, Bot, Video, Workflow, DollarSign, Settings, CreditCard, Brain, Receipt, Link2, ShoppingBag, MessageSquare, Crosshair, Clapperboard, Film, Share2, Shield, Star, Gauge, Zap } from "lucide-react";

const navGroups = [
  { label: "Core Systems", items: [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, active: true },
    { name: "Cockpit do Lançamento", href: "/launcher", icon: Crosshair },
    { name: "Campanhas", href: "/campaigns", icon: Rocket },
  ]},
  { label: "AI Team", items: [
    { name: "Agentes IA", href: "/agents", icon: Bot, badge: "57" },
  ]},
  { label: "Criação", items: [
    { name: "VSLs", href: "/vsls", icon: Video },
    { name: "Produção de Vídeo IA", href: "/video-production", icon: Clapperboard },
    { name: "Editor de Vídeo", href: "/video-editor", icon: Film },
  ]},
  { label: "Automações", items: [
    { name: "Produtos", href: "/produtos", icon: ShoppingBag },
    { name: "Atendimento", href: "/atendimento", icon: MessageSquare },
    { name: "Integrações", href: "/integracoes", icon: Link2, badge: "!" },
  ]},
  { label: "Account", items: [
    { name: "Créditos", href: "/credits", icon: CreditCard },
    { name: "Memória IA", href: "/memory", icon: Brain },
    { name: "Billing", href: "/billing", icon: Receipt },
    { name: "Configurações", href: "/settings", icon: Settings },
  ]},
];

export function Atual() {
  return (
    <div className="flex h-screen bg-[#090b14] text-white overflow-hidden" style={{ fontFamily: "'Space Mono', monospace" }}>
      {/* Sidebar atual */}
      <div className="w-56 flex flex-col border-r border-white/10 shrink-0 h-full">
        {/* Logo */}
        <div className="h-36 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xl font-black">N</div>
            <div>
              <div className="font-black text-lg uppercase tracking-widest text-white">NexOS</div>
              <div className="text-xs uppercase tracking-[0.3em] text-violet-400">AI Platform</div>
              <div className="text-[10px] uppercase tracking-widest text-white/20 mt-0.5">Operações Inteligentes</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              <div className="px-2 mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/25">{group.label}</span>
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer relative ${item.active ? "bg-violet-600/15 text-violet-400" : "text-white/40 hover:text-white"}`}>
                      {item.active && <div className="absolute left-0 inset-y-0 w-0.5 bg-violet-400" />}
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.active ? "text-violet-400" : "text-white/30"}`} />
                      <span className="text-[10px] uppercase tracking-widest font-medium flex-1 truncate">{item.name}</span>
                      {item.badge && (
                        <span className="text-[10px] bg-violet-600/10 text-violet-400 border border-violet-500/20 px-1 py-0.5 rounded-sm">{item.badge}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mode toggle */}
          <div>
            <div className="px-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/25">Modo</span>
            </div>
            <div className="flex gap-1 border border-white/10 bg-white/5 p-0.5">
              <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-violet-600 text-white text-[10px] uppercase tracking-widest">
                <Gauge className="h-2.5 w-2.5" /> Fundador
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-white/40 text-[10px] uppercase tracking-widest">
                <Zap className="h-2.5 w-2.5" /> Arquiteto
              </button>
            </div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1 px-1">Visão e resultado · foco no lançamento</p>
          </div>
        </nav>

        {/* Credits */}
        <div className="px-4 py-3 border-t border-white/10 mx-3 mb-2">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Créditos</span>
            <span className="text-[10px] text-violet-400 uppercase tracking-widest">1.847 cr</span>
          </div>
          <div className="h-0.5 w-full bg-white/10 rounded-full">
            <div className="h-full w-[62%] bg-violet-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-white/10 flex items-center justify-between px-6">
          <div className="text-xs uppercase tracking-widest text-white/40">Dashboard</div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-violet-600/30 border border-violet-500/30 text-violet-400 text-[10px] flex items-center justify-center">F</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Hero card */}
          <div className="border border-white/10 bg-white/3 rounded-sm p-4 mb-4 flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Missão em Andamento</div>
              <div className="text-xl font-black uppercase tracking-wider text-white mb-1">Olá, NexOS.</div>
              <div className="text-xs text-white/50 mb-3">NexOS AI — Founders 2026 · Estratégia em análise</div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-32 bg-white/10 rounded-full">
                  <div className="h-full w-[19%] bg-violet-500 rounded-full" />
                </div>
                <span className="text-[10px] text-white/30 uppercase">19% — Briefing</span>
              </div>
            </div>
            <button className="bg-violet-600 hover:bg-violet-500 text-white text-xs uppercase tracking-widest px-4 py-2 font-medium">
              Continuar Briefing →
            </button>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Receita Total", value: "R$ 0", sub: "Sem lançamento ativo", color: "text-emerald-400" },
              { label: "Créditos IA", value: "1.847", sub: "62% disponível", color: "text-violet-400" },
              { label: "Campanhas", value: "1", sub: "1 ativa", color: "text-blue-400" },
              { label: "Próxima Ação", value: "Briefing", sub: "Complete o briefing", color: "text-amber-400" },
            ].map(k => (
              <div key={k.label} className="border border-white/10 bg-white/3 rounded-sm p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{k.label}</div>
                <div className={`text-base font-black uppercase tracking-wide ${k.color}`}>{k.value}</div>
                <div className="text-[10px] text-white/25 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Integrations panel */}
          <div className="border border-white/10 bg-white/3 rounded-sm p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Status das Integrações</div>
            <div className="flex items-center gap-4">
              {["WhatsApp", "Instagram", "Facebook", "RD Station"].map((name, i) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-emerald-400" : "bg-red-400/60"}`} />
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">{name}</span>
                </div>
              ))}
              <button className="ml-auto text-[10px] text-violet-400 border border-violet-500/30 px-2 py-1 uppercase tracking-widest">Conectar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
