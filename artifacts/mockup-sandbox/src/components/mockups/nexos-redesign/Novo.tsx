import { Bot, Send, BookOpen, LayoutDashboard, Rocket, Zap, ChevronDown, Sparkles } from "lucide-react";

export function Novo() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#07070f",
      color: "#f0f0f8",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflow: "hidden",
    }}>

      {/* ── TOPBAR fina — logo + nav + contexto da campanha + user ── */}
      <div style={{
        height: "52px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: "0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0a14",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "28px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Space Mono, monospace", fontWeight: 900, fontSize: "13px", color: "#a78bfa",
            boxShadow: "0 0 12px rgba(124,58,237,0.25)",
          }}>N</div>
          <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 900, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#f0f0f8" }}>NexOS <span style={{ color: "#a78bfa" }}>AI</span></span>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1 }}>
          {[
            { name: "Dashboard", icon: LayoutDashboard },
            { name: "Campanhas", icon: Rocket, active: true },
            { name: "Agentes", icon: Bot },
            { name: "Academia", icon: BookOpen },
            { name: "Automações", icon: Zap },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.name} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "5px 11px", borderRadius: "6px",
                background: item.active ? "rgba(124,58,237,0.12)" : "transparent",
                borderBottom: item.active ? "2px solid #7c3aed" : "2px solid transparent",
                cursor: "pointer",
              }}>
                <Icon size={12} style={{ color: item.active ? "#a78bfa" : "rgba(255,255,255,0.3)" }} />
                <span style={{ fontSize: "12px", fontWeight: item.active ? 600 : 400, color: item.active ? "#c4b5fd" : "rgba(255,255,255,0.4)" }}>{item.name}</span>
              </div>
            );
          })}
        </div>

        {/* Direita */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "11px", color: "#a78bfa", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", padding: "3px 9px", borderRadius: "5px" }}>1.847 cr</div>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>F</div>
        </div>
      </div>

      {/* ── Barra da campanha ativa — fina, contextual ── */}
      <div style={{
        height: "38px", flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: "0 24px", gap: "16px",
        background: "rgba(124,58,237,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 8px rgba(124,58,237,0.9)" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Founders 2026</span>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>·</span>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>PLF · 6 dígitos · Briefing (19%)</span>
        </div>
        <div style={{ height: "14px", width: "1px", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={11} style={{ color: "#fbbf24" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Conclua o briefing para liberar a Estratégia</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Trocar campanha</span>
          <ChevronDown size={11} style={{ color: "rgba(255,255,255,0.25)" }} />
        </div>
      </div>

      {/* ── CHAT — tudo restante, amplitude máxima ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Agente atual */}
        <div style={{
          padding: "10px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: "10px",
          flexShrink: 0, background: "rgba(255,255,255,0.01)",
        }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#f0f0f8", lineHeight: 1.2 }}>Erick — General das Operações</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Claude · Coleta de briefing · Etapa 2/7</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: "6px" }}>
            {["Erick", "Maya", "Léo", "Atlas", "Zara"].map((a, i) => (
              <div key={a} style={{
                padding: "3px 9px", borderRadius: "5px", fontSize: "11px", cursor: "pointer",
                background: i === 0 ? "rgba(124,58,237,0.15)" : "transparent",
                border: `1px solid ${i === 0 ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: i === 0 ? "#c4b5fd" : "rgba(255,255,255,0.3)",
              }}>{a}</div>
            ))}
          </div>
        </div>

        {/* ── Mensagens — muito espaço, sem compressão ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "40px 0" }}>
          <div style={{ maxWidth: "700px", width: "100%", margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", gap: "32px" }}>

            {/* IA */}
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                <Bot size={16} style={{ color: "#a78bfa" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Erick</div>
                <div style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "12px", padding: "20px 22px",
                  fontSize: "15px", lineHeight: 1.75, color: "rgba(255,255,255,0.8)",
                }}>
                  Olá! Sou o <strong style={{ color: "#f0f0f8" }}>Erick</strong>, seu General de Operações. Estou aqui para orquestrar cada fase do seu lançamento com precisão estratégica.<br /><br />
                  Para montar a melhor estrutura possível, preciso entender seu produto de dentro pra fora. Vamos começar pelo principal:<br /><br />
                  <strong style={{ color: "#f0f0f8" }}>Qual é o seu produto e qual ticket você pretende praticar neste lançamento?</strong>
                </div>
              </div>
            </div>

            {/* Usuário */}
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flexDirection: "row-reverse" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "14px", fontWeight: 800, color: "#a78bfa", marginTop: "2px" }}>F</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Você</div>
                <div style={{
                  background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)",
                  borderRadius: "12px", padding: "20px 22px",
                  fontSize: "15px", lineHeight: 1.75, color: "rgba(255,255,255,0.75)",
                  maxWidth: "85%",
                }}>
                  NexOS AI — plataforma de automação de lançamentos com IA. Ticket R$3.990 no lançamento, acesso vitalício.
                </div>
              </div>
            </div>

            {/* IA 2 */}
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                <Bot size={16} style={{ color: "#a78bfa" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Erick</div>
                <div style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "12px", padding: "20px 22px",
                  fontSize: "15px", lineHeight: 1.75, color: "rgba(255,255,255,0.8)",
                }}>
                  Perfeito. R$3.990 com acesso vitalício é um <strong style={{ color: "#f0f0f8" }}>posicionamento de valor permanente</strong> — isso exige uma narrativa de "decisão única, resultado para sempre".<br /><br />
                  Vou calibrar toda a sequência de persuasão em cima disso. Agora preciso entender quem vai comprar:<br /><br />
                  <strong style={{ color: "#f0f0f8" }}>Quem é seu avatar? O que ele faz hoje e qual a maior dor que o NexOS AI resolve pra ele?</strong>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── INPUT — amplo, sem margens espremidas ── */}
        <div style={{
          padding: "20px 0 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          background: "#07070f",
        }}>
          <div style={{ maxWidth: "700px", width: "100%", margin: "0 auto", padding: "0 32px" }}>
            <div style={{
              display: "flex", alignItems: "flex-end", gap: "12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "14px",
              padding: "16px 18px",
            }}>
              <textarea
                placeholder="Responda ao Erick..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: "15px", color: "#f0f0f8", lineHeight: 1.65,
                  minHeight: "60px", maxHeight: "160px",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              />
              <button style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: "#7c3aed", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 0 16px rgba(124,58,237,0.4)",
              }}>
                <Send size={16} style={{ color: "white" }} />
              </button>
            </div>
            {/* Chips de sugestão */}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
              {["Meu avatar é infoprodutor", "Produto de R$3.990 com bônus", "Quero lançar em 30 dias", "Público: agências digitais"].map(s => (
                <button key={s} style={{
                  fontSize: "12px", color: "rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "7px", padding: "5px 11px", cursor: "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
