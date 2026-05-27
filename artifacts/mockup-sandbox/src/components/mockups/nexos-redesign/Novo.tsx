import { LayoutDashboard, Rocket, Bot, Video, Settings, CreditCard, Brain, Receipt, Link2, ShoppingBag, MessageSquare, Crosshair, Clapperboard, Film, Gauge, Zap, TrendingUp, AlertCircle, CheckCircle2, Circle, Send } from "lucide-react";

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
      {/* ── SIDEBAR ── Logo mesmo tamanho, nav mais respirável, fecha ao clicar */}
      <div className="flex flex-col shrink-0 h-full" style={{ width: "224px", background: "#0b0b14", borderRight: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Logo — mesmo tamanho do original */}
        <div style={{ height: "144px", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ height: "80px", width: "80px", borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 900, color: "#a78bfa", flexShrink: 0, fontFamily: "Space Mono, monospace" }}>N</div>
            <div>
              <div style={{ fontFamily: "Space Mono, monospace", fontWeight: 900, fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#f0f0f8" }}>NexOS</div>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#a78bfa" }}>AI Platform</div>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>Operações Inteligentes</div>
            </div>
          </div>
        </div>

        {/* Nav — itens com mais padding vertical, fecha ao clicar (simulado com cursor pointer) */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "16px 10px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {navGroups.map(group => (
            <div key={group.label}>
              <div style={{ padding: "0 8px", marginBottom: "6px" }}>
                <span style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)" }}>{group.label}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 10px",
                      borderRadius: "4px",
                      background: item.active ? "rgba(124,58,237,0.15)" : "transparent",
                      borderLeft: item.active ? "2px solid #7c3aed" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.15s"
                    }}>
                      <Icon style={{ width: "14px", height: "14px", flexShrink: 0, color: item.active ? "#a78bfa" : "rgba(255,255,255,0.35)" }} />
                      <span style={{ fontFamily: "Space Mono, monospace", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: item.active ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>{item.name}</span>
                      {item.badge && (
                        <span style={{ fontSize: "10px", fontFamily: "Space Mono, monospace", background: item.badge === "!" ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.12)", color: item.badge === "!" ? "#f87171" : "#a78bfa", border: `1px solid ${item.badge === "!" ? "rgba(239,68,68,0.25)" : "rgba(124,58,237,0.2)"}`, padding: "1px 5px", borderRadius: "3px" }}>{item.badge}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mode toggle */}
          <div>
            <div style={{ padding: "0 8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)" }}>Modo</span>
            </div>
            <div style={{ display: "flex", gap: "2px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "2px", borderRadius: "4px" }}>
              <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "7px 4px", background: "#7c3aed", color: "white", fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", border: "none", borderRadius: "3px", cursor: "pointer" }}>
                <Gauge style={{ width: "10px", height: "10px" }} /> Fundador
              </button>
              <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "7px 4px", background: "transparent", color: "rgba(255,255,255,0.35)", fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", border: "none", borderRadius: "3px", cursor: "pointer" }}>
                <Zap style={{ width: "10px", height: "10px" }} /> Arquiteto
              </button>
            </div>
          </div>
        </nav>

        {/* Credits */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "0 8px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)" }}>Créditos</span>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: "10px", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em" }}>1.847 cr</span>
          </div>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "62%", background: "#7c3aed", borderRadius: "99px" }} />
          </div>
        </div>
      </div>

      {/* ── MAIN — sem padding lateral excessivo, conteúdo vai de borda a borda ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar sem margens flutuantes */}
        <div style={{ height: "52px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)" }}>Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "Space Mono, monospace" }}>founder@nexos.ai</div>
            <div style={{ height: "28px", width: "28px", borderRadius: "4px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>F</div>
          </div>
        </div>

        {/* Content — sem padding lateral grande, tudo colado nas bordas */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* KPI strip — full width, sem card wrapper externo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { label: "Receita Total", value: "R$ 0", sub: "Sem lançamento ativo", accent: "#34d399" },
              { label: "Créditos IA", value: "1.847 cr", sub: "62% disponível", accent: "#a78bfa" },
              { label: "Campanhas", value: "1 ativa", sub: "1 criada", accent: "#60a5fa" },
              { label: "Próxima Ação", value: "Briefing", sub: "Complete o briefing", accent: "#fbbf24" },
            ].map((k, i) => (
              <div key={k.label} style={{ padding: "16px 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", fontFamily: "Space Mono, monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: k.accent, marginBottom: "2px" }}>{k.value}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Layout dois painéis: esquerda chat grande, direita info */}
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

            {/* PAINEL ESQUERDO — Chat box grande e dominante */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Chat header limpo */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f8" }}>Erick — General das Operações</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>NexOS AI — Founders 2026 · Briefing</div>
                </div>
              </div>

              {/* Mensagens — área grande */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Mensagem IA */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot style={{ width: "13px", height: "13px", color: "#a78bfa" }} />
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px", maxWidth: "80%" }}>
                      <div style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,0.8)" }}>
                        Olá! Sou o Erick, seu General de Operações. Vamos estruturar o lançamento <strong style={{ color: "#f0f0f8" }}>NexOS AI — Founders 2026</strong>.<br /><br />
                        Para começar, me conta: qual é o seu produto principal e o ticket que você pretende praticar neste lançamento?
                      </div>
                    </div>
                  </div>

                  {/* Mensagem usuário */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexDirection: "row-reverse" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "12px", fontWeight: 700, color: "#a78bfa" }}>F</div>
                    <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px", padding: "14px 16px", maxWidth: "80%" }}>
                      <div style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,0.75)" }}>
                        NexOS AI é uma plataforma de automação de lançamentos. Ticket: R$3.990 no lançamento.
                      </div>
                    </div>
                  </div>

                  {/* Mensagem IA 2 */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot style={{ width: "13px", height: "13px", color: "#a78bfa" }} />
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px", maxWidth: "80%" }}>
                      <div style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,0.8)" }}>
                        Excelente. R$3.990 é um ticket de autoridade — precisa de uma estratégia de pré-aquecimento forte.<br /><br />
                        Agora me diga: <strong style={{ color: "#f0f0f8" }}>qual é o perfil do seu avatar principal?</strong> Quem é essa pessoa, o que ela faz hoje e qual dor ela quer resolver?
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input box — grande, limpo, sem margens laterais */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 14px" }}>
                  <textarea
                    placeholder="Digite sua resposta..."
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: "14px", color: "#f0f0f8", lineHeight: 1.5, minHeight: "48px", maxHeight: "120px", fontFamily: "inherit" }}
                    defaultValue=""
                  />
                  <button style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#7c3aed", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Send style={{ width: "15px", height: "15px", color: "white" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* PAINEL DIREITO — Info resumida, não sobrecarregada */}
            <div style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>

              {/* Campanha info */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "Space Mono, monospace" }}>Campanha</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f8", marginBottom: "4px" }}>NexOS AI — Founders 2026</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>PLF · 6 dígitos · Em briefing</div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "99px", overflow: "hidden", marginBottom: "4px" }}>
                  <div style={{ height: "100%", width: "19%", background: "#7c3aed", borderRadius: "99px" }} />
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>19% · Briefing</div>
              </div>

              {/* Integrações */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "Space Mono, monospace" }}>Integrações</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { name: "WhatsApp", ok: true },
                    { name: "Instagram", ok: false },
                    { name: "RD Station", ok: false },
                  ].map(item => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {item.ok
                        ? <CheckCircle2 style={{ width: "13px", height: "13px", color: "#34d399", flexShrink: 0 }} />
                        : <Circle style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />}
                      <span style={{ fontSize: "12px", color: item.ok ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}>{item.name}</span>
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: "10px", width: "100%", padding: "7px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "6px", color: "#a78bfa", fontSize: "12px", cursor: "pointer" }}>
                  + Conectar
                </button>
              </div>

              {/* Próximos passos */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "Space Mono, monospace" }}>Próximos Passos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { step: "Completar briefing", done: false, current: true },
                    { step: "Análise estratégica", done: false },
                    { step: "Geração de conteúdo", done: false },
                    { step: "Lançamento", done: false },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, background: s.current ? "#7c3aed" : "rgba(255,255,255,0.15)", boxShadow: s.current ? "0 0 6px rgba(124,58,237,0.8)" : "none" }} />
                      <span style={{ fontSize: "12px", color: s.current ? "#a78bfa" : "rgba(255,255,255,0.3)", fontWeight: s.current ? 600 : 400 }}>{s.step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
