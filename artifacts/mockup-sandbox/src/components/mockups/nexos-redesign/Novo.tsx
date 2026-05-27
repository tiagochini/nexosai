import { Bot, Send, ChevronDown, CheckCircle2, Circle, LayoutDashboard, Rocket, Zap } from "lucide-react";

export function Novo() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#09090f",
      color: "#f0f0f8",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflow: "hidden",
    }}>

      {/* ── TOPBAR — logo + nav mínima + user ── */}
      <div style={{
        height: "56px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 20px",
        background: "#0b0b14",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Space Mono, monospace", fontWeight: 900, fontSize: "14px", color: "#a78bfa" }}>N</div>
          <div>
            <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 900, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#f0f0f8" }}>NexOS</span>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.2em", color: "#a78bfa", marginLeft: "6px" }}>AI</span>
          </div>
        </div>

        {/* Nav links — principais direto no topo */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {[
            { name: "Dashboard", icon: LayoutDashboard },
            { name: "Campanhas", icon: Rocket, active: true },
            { name: "Agentes", icon: Bot, badge: "57" },
            { name: "Automações", icon: Zap },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.name} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "6px",
                background: item.active ? "rgba(124,58,237,0.15)" : "transparent",
                cursor: "pointer",
              }}>
                <Icon style={{ width: "13px", height: "13px", color: item.active ? "#a78bfa" : "rgba(255,255,255,0.35)" }} />
                <span style={{ fontSize: "13px", fontWeight: item.active ? 600 : 400, color: item.active ? "#a78bfa" : "rgba(255,255,255,0.45)" }}>{item.name}</span>
                {item.badge && <span style={{ fontSize: "10px", background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)", padding: "1px 5px", borderRadius: "4px" }}>{item.badge}</span>}
              </div>
            );
          })}
        </div>

        {/* User + créditos */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "#a78bfa", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", padding: "4px 10px", borderRadius: "6px" }}>1.847 cr</div>
          <div style={{ height: "30px", width: "30px", borderRadius: "8px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.35)", color: "#a78bfa", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>F</div>
        </div>
      </div>

      {/* ── KPI strip — borda a borda, sem cards flutuantes ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        {[
          { label: "Receita Total", value: "R$ 0", sub: "Sem lançamento ativo", accent: "#34d399" },
          { label: "Créditos IA", value: "1.847 cr", sub: "62% disponível", accent: "#a78bfa" },
          { label: "Campanhas", value: "1 ativa", sub: "1 criada", accent: "#60a5fa" },
          { label: "Próxima Ação", value: "Briefing", sub: "Complete o briefing", accent: "#fbbf24" },
        ].map((k, i) => (
          <div key={k.label} style={{
            padding: "14px 20px",
            borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none",
          }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "5px", fontFamily: "Space Mono, monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: k.accent, marginBottom: "2px" }}>{k.value}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── CORPO PRINCIPAL — chat dominante + coluna direita fina ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* CHAT — ocupa toda a área central */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Agente header */}
          <div style={{
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f0f0f8" }}>Erick — General das Operações</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Claude · NexOS AI — Founders 2026 · Briefing em andamento</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Trocar agente</span>
              <ChevronDown style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.35)" }} />
            </div>
          </div>

          {/* Mensagens — área grande, muito espaço */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 12px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

              {/* Mensagem IA */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  <Bot style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontWeight: 500 }}>Erick</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px 18px", fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>
                    Olá! Sou o <strong style={{ color: "#f0f0f8" }}>Erick</strong>, seu General de Operações. Vou coordenar toda a execução do seu lançamento.<br /><br />
                    Para estruturar a melhor estratégia, preciso entender o seu produto. Me conta: <strong style={{ color: "#f0f0f8" }}>qual é o produto principal e qual ticket você pretende praticar neste lançamento?</strong>
                  </div>
                </div>
              </div>

              {/* Mensagem usuário */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexDirection: "row-reverse" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", fontWeight: 700, color: "#a78bfa", marginTop: "2px" }}>F</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontWeight: 500 }}>Você</div>
                  <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "10px", padding: "16px 18px", fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.75)", maxWidth: "80%" }}>
                    NexOS AI é uma plataforma de automação de lançamentos. Ticket: R$3.990 no lançamento.
                  </div>
                </div>
              </div>

              {/* Mensagem IA 2 */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  <Bot style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontWeight: 500 }}>Erick</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px 18px", fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>
                    Perfeito. R$3.990 é um <strong style={{ color: "#f0f0f8" }}>ticket de autoridade</strong> — requer uma estratégia de pré-aquecimento forte e uma sequência de CPLs bem posicionados.<br /><br />
                    Agora me diz: <strong style={{ color: "#f0f0f8" }}>quem é o seu avatar principal?</strong> O que ele faz hoje e qual a maior dor que ele quer resolver com o NexOS AI?
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── INPUT — grande, limpo, sem margens laterais excessivas ── */}
          <div style={{ padding: "16px 28px 20px", flexShrink: 0 }}>
            <div style={{ maxWidth: "760px", margin: "0 auto" }}>
              <div style={{
                display: "flex", alignItems: "flex-end", gap: "10px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "14px 16px",
              }}>
                <textarea
                  placeholder="Digite sua resposta para o Erick..."
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    resize: "none", fontSize: "14px", color: "#f0f0f8", lineHeight: 1.6,
                    minHeight: "52px", maxHeight: "140px",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
                <button style={{
                  width: "38px", height: "38px", borderRadius: "8px",
                  background: "#7c3aed", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Send style={{ width: "15px", height: "15px", color: "white" }} />
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                {["Meu avatar é um infoprodutor iniciante", "Ticket de R$3.990 com bônus exclusivos", "Quero lançar em 30 dias"].map(s => (
                  <button key={s} style={{
                    fontSize: "12px", color: "rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "6px", padding: "5px 10px", cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — fina, só o essencial */}
        <div style={{
          width: "240px", flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Campanha */}
          <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "10px", fontFamily: "Space Mono, monospace", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", marginBottom: "10px" }}>Campanha</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f8", marginBottom: "3px" }}>Founders 2026</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "10px" }}>PLF · 6 dígitos</div>
            <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "99px", overflow: "hidden", marginBottom: "4px" }}>
              <div style={{ height: "100%", width: "19%", background: "#7c3aed", borderRadius: "99px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>19% · Briefing</div>
          </div>

          {/* Integrações */}
          <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "10px", fontFamily: "Space Mono, monospace", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", marginBottom: "10px" }}>Integrações</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {[
                { name: "WhatsApp", ok: true },
                { name: "Instagram", ok: false },
                { name: "RD Station", ok: false },
              ].map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {item.ok
                    ? <CheckCircle2 style={{ width: "13px", height: "13px", color: "#34d399", flexShrink: 0 }} />
                    : <Circle style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />}
                  <span style={{ fontSize: "12px", color: item.ok ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>{item.name}</span>
                </div>
              ))}
            </div>
            <button style={{ marginTop: "10px", width: "100%", padding: "7px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "6px", color: "#a78bfa", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>+ Conectar</button>
          </div>

          {/* Passos */}
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "10px", fontFamily: "Space Mono, monospace", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", marginBottom: "10px" }}>Pipeline</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { step: "Briefing", current: true },
                { step: "Estratégia", done: false },
                { step: "Conteúdo", done: false },
                { step: "Lançamento", done: false },
              ].map(s => (
                <div key={s.step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, background: s.current ? "#7c3aed" : "rgba(255,255,255,0.12)", boxShadow: s.current ? "0 0 8px rgba(124,58,237,0.8)" : "none" }} />
                  <span style={{ fontSize: "12px", color: s.current ? "#a78bfa" : "rgba(255,255,255,0.25)", fontWeight: s.current ? 600 : 400 }}>{s.step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
