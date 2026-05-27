import { LayoutDashboard, Rocket, Bot, Video, Settings, CreditCard, Brain, Receipt, Link2, ShoppingBag, MessageSquare, Crosshair, Clapperboard, Film, Gauge, Zap, TrendingUp, AlertCircle, CheckCircle2, Circle } from "lucide-react";

const navGroups = [
  { label: "Core", items: [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, active: true },
    { name: "Cockpit", href: "/launcher", icon: Crosshair },
    { name: "Campanhas", href: "/campaigns", icon: Rocket },
  ]},
  { label: "IA & Criação", items: [
    { name: "Agentes IA", href: "/agents", icon: Bot, badge: "57" },
    { name: "VSLs", href: "/vsls", icon: Video },
    { name: "Produção de Vídeo", href: "/video-production", icon: Clapperboard },
    { name: "Editor de Vídeo", href: "/video-editor", icon: Film },
  ]},
  { label: "Automações", items: [
    { name: "Produtos", href: "/produtos", icon: ShoppingBag },
    { name: "Atendimento", href: "/atendimento", icon: MessageSquare },
    { name: "Integrações", href: "/integracoes", icon: Link2, badge: "!" },
  ]},
  { label: "Conta", items: [
    { name: "Créditos", href: "/credits", icon: CreditCard },
    { name: "Memória IA", href: "/memory", icon: Brain },
    { name: "Configurações", href: "/settings", icon: Settings },
  ]},
];

export function Novo() {
  return (
    <div className="flex h-screen overflow-hidden" style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: "#09090f",
      color: "#f0f0f8"
    }}>
      {/* Sidebar redesenhada */}
      <div className="w-60 flex flex-col shrink-0 h-full" style={{ background: "#0d0d16", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Logo — menos altura, mais limpo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}>N</div>
          <div>
            <div className="font-bold text-sm tracking-wide" style={{ color: "#f0f0f8" }}>NexOS AI</div>
            <div className="text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>Plataforma de Lançamentos</div>
          </div>
        </div>

        {/* Nav — mais espaçoso */}
        <nav className="flex-1 overflow-y-auto px-3 py-5" style={{ gap: "20px", display: "flex", flexDirection: "column" }}>
          {navGroups.map(group => (
            <div key={group.label}>
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>{group.label}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="flex items-center gap-3 px-3 cursor-pointer relative" style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: item.active ? "rgba(124,58,237,0.15)" : "transparent",
                      borderLeft: item.active ? "2px solid #7c3aed" : "2px solid transparent",
                      color: item.active ? "#a78bfa" : "rgba(255,255,255,0.45)",
                      transition: "all 0.15s"
                    }}>
                      <Icon style={{ width: "15px", height: "15px", flexShrink: 0, color: item.active ? "#a78bfa" : "rgba(255,255,255,0.3)" }} />
                      <span className="text-sm font-medium flex-1 truncate" style={{ color: item.active ? "#a78bfa" : "rgba(255,255,255,0.55)" }}>{item.name}</span>
                      {item.badge && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{
                          background: item.badge === "!" ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.15)",
                          color: item.badge === "!" ? "#f87171" : "#a78bfa",
                          border: `1px solid ${item.badge === "!" ? "rgba(239,68,68,0.25)" : "rgba(124,58,237,0.25)"}`,
                          fontSize: "11px"
                        }}>{item.badge}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mode toggle — mais limpo */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>Modo de Trabalho</span>
            </div>
            <div style={{ display: "flex", gap: "4px", padding: "4px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", borderRadius: "7px", background: "#7c3aed", color: "white", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer" }}>
                <Gauge style={{ width: "13px", height: "13px" }} /> Fundador
              </button>
              <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", borderRadius: "7px", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer" }}>
                <Zap style={{ width: "13px", height: "13px" }} /> Arquiteto
              </button>
            </div>
          </div>
        </nav>

        {/* Credits — mais limpo */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Créditos IA</span>
            <span style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600 }}>1.847 cr</span>
          </div>
          <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "62%", background: "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: "99px" }} />
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "6px" }}>62% disponível · 900 cr incluídos</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div style={{ height: "56px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#f0f0f8" }}>Dashboard</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Terça-feira, 27 de Maio</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>founder@nexos.ai</div>
            <div style={{ height: "32px", width: "32px", borderRadius: "8px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.35)", color: "#a78bfa", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>F</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto" style={{ padding: "28px" }}>
          {/* Missão em andamento */}
          <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px", padding: "24px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(167,139,250,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>Missão em Andamento</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#f0f0f8", marginBottom: "4px" }}>NexOS AI — Founders 2026</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginBottom: "16px" }}>Briefing Estratégico · 19% concluído</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ height: "6px", width: "200px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "19%", background: "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: "99px" }} />
                </div>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>19% — Briefing</span>
              </div>
            </div>
            <button style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Continuar Briefing →
            </button>
          </div>

          {/* KPI grid — mais espaçoso */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "Receita Total", value: "R$ 0", sub: "Sem lançamento ativo", accent: "#34d399", icon: TrendingUp },
              { label: "Créditos IA", value: "1.847 cr", sub: "62% disponível", accent: "#a78bfa", icon: CreditCard },
              { label: "Campanhas", value: "1 ativa", sub: "1 criada", accent: "#60a5fa", icon: Rocket },
              { label: "Próxima Ação", value: "Briefing", sub: "Complete o briefing", accent: "#fbbf24", icon: AlertCircle },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>{k.label}</span>
                    <div style={{ padding: "6px", borderRadius: "8px", background: `${k.accent}15` }}>
                      <Icon style={{ width: "14px", height: "14px", color: k.accent }} />
                    </div>
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: k.accent, marginBottom: "4px" }}>{k.value}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{k.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Integrações */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#f0f0f8" }}>Integrações</div>
              <button style={{ fontSize: "13px", color: "#a78bfa", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: 500 }}>Conectar</button>
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { name: "WhatsApp", ok: true },
                { name: "Instagram", ok: false },
                { name: "Facebook", ok: false },
                { name: "RD Station", ok: false },
              ].map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: `1px solid ${item.ok ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                  {item.ok
                    ? <CheckCircle2 style={{ width: "14px", height: "14px", color: "#34d399" }} />
                    : <Circle style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />
                  }
                  <span style={{ fontSize: "13px", fontWeight: 500, color: item.ok ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
