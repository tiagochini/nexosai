import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  FileCheck2,
  Gauge,
  Hand,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";

type Mode = "fundador" | "arquiteto";
type ThreadId = "ops" | "meta" | "search" | "social";

const departments = [
  { name: "Estratégia", initials: "ES", tone: "violet", unread: 0 },
  { name: "Criativo", initials: "CR", tone: "amber", unread: 2 },
  { name: "Mídia Paga", initials: "MP", tone: "green", unread: 0 },
  { name: "Social", initials: "SO", tone: "blue", unread: 4 },
  { name: "Vendas", initials: "VE", tone: "rose", unread: 0 },
  { name: "Analytics", initials: "AN", tone: "cyan", unread: 1 },
  { name: "Compliance", initials: "CO", tone: "slate", unread: 0 },
];

const baseMessages = [
  {
    id: 1,
    author: "Orquestrador NexOS",
    role: "Sistema operacional",
    initials: "NX",
    tone: "violet",
    time: "09:41",
    text: "Bom dia. O plano de ação para São Paulo entrou na janela de execução. Vou manter a escala dos vencedores no Meta e observar a eficiência por conjunto.",
    tags: ["Próximo: revisão em 2h", "Master Plan v12"],
    kind: "system",
  },
  {
    id: 2,
    author: "Nicholas Reed",
    role: "Agente de Mídia Paga",
    initials: "NR",
    tone: "green",
    time: "09:44",
    text: "Estou realocando 12% do orçamento para os conjuntos com CPL abaixo de R$ 6,20. A mudança preserva o teto diário e segue a regra de escala gradual.",
    tags: ["Em andamento", "12% realocado"],
    kind: "working",
  },
  {
    id: 3,
    author: "Philip Costa",
    role: "Agente de Compliance",
    initials: "PC",
    tone: "slate",
    time: "09:46",
    text: "Revisão concluída: a nova variação do anúncio “Agenda Cheia em 21 dias” está dentro das políticas da Meta e do manual da campanha.",
    tags: ["Aprovado", "Políticas verificadas"],
    kind: "success",
  },
  {
    id: 4,
    author: "NexOS — alerta de execução",
    role: "Atenção necessária",
    initials: "!",
    tone: "amber",
    time: "09:48",
    text: "Google Search está pausado: o CPL subiu 26% nas últimas 24h (R$ 8,56). Não vou reativar até haver uma nova hipótese de anúncio e uma validação humana.",
    tags: ["Ação recomendada", "CPL +26%"],
    kind: "warning",
  },
  {
    id: 5,
    author: "Garry Martins",
    role: "Agente de Social",
    initials: "GM",
    tone: "blue",
    time: "09:51",
    text: "Estou organizando os 7 posts da próxima semana com os ângulos “prova local” e “agenda sem esforço”. O primeiro rascunho entra para sua revisão às 11:30.",
    tags: ["7 posts", "Entrega 11:30"],
    kind: "normal",
  },
];

const metrics = [
  { label: "Investido", value: "R$ 12.480", delta: "+8,4%", icon: Zap },
  { label: "Leads", value: "1.842", delta: "+18,1%", icon: Users },
  { label: "CPL", value: "R$ 6,78", delta: "−11,6%", icon: Target },
  { label: "ROAS", value: "4,7x", delta: "+0,6x", icon: Gauge },
];

export default function ConversationalOps() {
  const [mode, setMode] = useState<Mode>("fundador");
  const [activeThread, setActiveThread] = useState<ThreadId>("ops");
  const [mobilePanel, setMobilePanel] = useState<"chat" | "context">("chat");
  const [showDetails, setShowDetails] = useState(false);
  const [warningVisible, setWarningVisible] = useState(true);
  const [approved, setApproved] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [searchPaused, setSearchPaused] = useState(true);
  const [draft, setDraft] = useState("");

  const threadTitle = useMemo(
    () =>
      ({
        ops: "Operações da campanha",
        meta: "Escala Meta",
        search: "Google Search",
        social: "Calendário Social",
      })[activeThread],
    [activeThread],
  );

  const submitMessage = () => {
    if (!draft.trim()) return;
    setDraft("");
  };

  return (
    <div className="nx-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
        .nx-root{--bg:#141617;--surface:#1b1e1e;--surface-2:#222727;--surface-3:#292e2e;--line:#343b3a;--text:#f3f0e8;--muted:#9ca6a0;--soft:#c7cec6;--green:#74d19b;--green-bg:#18372b;--violet:#b8a7ff;--violet-bg:#2b2446;--amber:#f4c978;--amber-bg:#45351d;--blue:#91c4ec;--danger:#ef9f9f;background:var(--bg);color:var(--text);font-family:'Manrope',sans-serif;min-height:100dvh;line-height:1.45}
        .nx-root *{box-sizing:border-box}.nx-root button,.nx-root input{font:inherit}.nx-root button{color:inherit}
        .nx-shell{display:grid;grid-template-columns:72px 242px minmax(420px,1fr) 298px;height:100dvh;min-height:700px;overflow:hidden}
        .nx-rail{border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:18px 0 14px;gap:22px;background:#171919}
        .nx-brand{height:38px;width:38px;background:var(--violet);color:#1d1831;border-radius:12px;display:grid;place-items:center;font-weight:800;letter-spacing:-.06em}
        .nx-mode{display:flex;align-items:center;border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:3px;gap:2px}.nx-mode button{border:0;background:transparent;color:var(--muted);border-radius:6px;padding:5px 8px;font-size:10px;cursor:pointer}.nx-mode button.active{background:var(--violet-bg);color:var(--violet);font-weight:700}
        .nx-rail button{border:0;background:transparent;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#76807b;cursor:pointer}.nx-rail button:hover,.nx-rail button.nx-selected{background:var(--surface-3);color:var(--text)}.nx-rail .nx-spacer{flex:1}
        .nx-departments{border-right:1px solid var(--line);padding:24px 14px;background:#191b1b;min-width:0}.nx-kicker{font:500 10px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#7e8982}.nx-workspace{display:flex;align-items:center;justify-content:space-between;margin:10px 0 26px}.nx-workspace strong{font-size:13px}.nx-workspace small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.nx-plus{height:32px;width:32px;border:1px solid var(--line);background:var(--surface);border-radius:9px;display:grid;place-items:center;cursor:pointer}.nx-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:var(--muted);font-size:11px;font-weight:700}.nx-section-title button{border:0;background:none;color:var(--muted);cursor:pointer}.nx-dept{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;margin:2px 0;border-radius:10px;border:0;background:none;text-align:left;cursor:pointer;color:var(--soft);font-size:12px}.nx-dept:hover,.nx-dept.active{background:var(--surface-3);color:var(--text)}.nx-avatar{height:28px;width:28px;flex:0 0 28px;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:800;background:var(--surface-3);color:var(--soft)}.nx-avatar.violet{background:var(--violet-bg);color:var(--violet)}.nx-avatar.green{background:var(--green-bg);color:var(--green)}.nx-avatar.amber{background:var(--amber-bg);color:var(--amber)}.nx-avatar.blue{background:#20374a;color:var(--blue)}.nx-avatar.rose{background:#422a31;color:#efadb2}.nx-avatar.cyan{background:#1f3940;color:#9bd6dc}.nx-avatar.slate{background:#303639;color:#cbd3d2}.nx-unread{margin-left:auto;border-radius:99px;background:var(--violet);color:#201a39;min-width:17px;height:17px;padding:0 5px;text-align:center;font:700 10px/17px 'DM Mono',monospace}
        .nx-main{display:flex;flex-direction:column;min-width:0;background:#151818}.nx-header{height:80px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px;gap:14px}.nx-header h1{font-size:16px;margin:0;font-weight:700;letter-spacing:-.02em}.nx-header p{margin:4px 0 0;color:var(--muted);font-size:11px}.nx-live{display:flex;align-items:center;gap:6px;color:var(--green);font-size:11px;white-space:nowrap}.nx-live i{display:block;width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px #1c3a2c}.nx-conversation{padding:25px 30px 20px;overflow:auto;flex:1}.nx-day{display:flex;align-items:center;gap:12px;color:#707a74;font:500 10px 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;margin:0 0 23px}.nx-day:before,.nx-day:after{content:'';height:1px;background:var(--line);flex:1}.nx-message{display:flex;gap:11px;max-width:680px;margin:0 0 20px}.nx-message .nx-avatar{margin-top:2px}.nx-message-body{min-width:0;flex:1}.nx-message-meta{display:flex;align-items:baseline;gap:7px;margin-bottom:5px}.nx-message-meta strong{font-size:12px}.nx-message-meta span{font-size:10px;color:var(--muted)}.nx-bubble{background:var(--surface);border:1px solid #2b3130;border-radius:4px 13px 13px 13px;padding:13px 15px;color:#d9ded8;font-size:12px;max-width:590px}.nx-message.system .nx-bubble{background:#211d32;border-color:#3b315f}.nx-message.success .nx-bubble{background:#192821;border-color:#28533f}.nx-message.warning .nx-bubble{background:#30271a;border-color:#695127}.nx-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.nx-tag{display:inline-flex;align-items:center;gap:5px;border-radius:6px;padding:5px 8px;background:var(--surface-3);color:var(--muted);font:500 10px 'DM Mono',monospace}.nx-tag.green{color:var(--green);background:var(--green-bg)}.nx-tag.violet{color:var(--violet);background:var(--violet-bg)}.nx-tag.amber{color:var(--amber);background:var(--amber-bg)}.nx-working{display:inline-flex;align-items:center;gap:4px;margin:0 0 20px 39px;color:var(--muted);font-size:11px}.nx-working b{color:var(--green);font-weight:600}.nx-dots{display:flex;gap:3px;margin-left:3px}.nx-dots i{height:4px;width:4px;background:var(--green);border-radius:50%;animation:nx-bounce 1.1s infinite}.nx-dots i:nth-child(2){animation-delay:.16s}.nx-dots i:nth-child(3){animation-delay:.32s}@keyframes nx-bounce{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}.nx-action{display:flex;gap:8px;margin-top:12px}.nx-action button,.nx-handoff{min-height:36px;border:1px solid var(--line);background:var(--surface-3);border-radius:8px;padding:0 12px;font-size:11px;font-weight:700;cursor:pointer}.nx-action button.primary{background:var(--green);border-color:var(--green);color:#15251c}.nx-action button:hover,.nx-handoff:hover{border-color:var(--soft)}.nx-composer{border-top:1px solid var(--line);padding:13px 28px;display:flex;align-items:center;gap:10px;background:#171a1a}.nx-composer input{min-width:0;flex:1;background:var(--surface);border:1px solid var(--line);height:42px;border-radius:11px;padding:0 14px;color:var(--text);outline:none;font-size:12px}.nx-composer input:focus{border-color:var(--violet);box-shadow:0 0 0 3px #332957}.nx-composer button{height:40px;width:40px;border:0;border-radius:10px;background:var(--violet);color:#211b36;display:grid;place-items:center;cursor:pointer}.nx-context{border-left:1px solid var(--line);background:#191b1b;padding:24px 18px;overflow:auto}.nx-context-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.nx-context h2{font-size:13px;margin:0}.nx-context-icon{border:0;background:none;color:var(--muted);cursor:pointer}.nx-plan{border:1px solid #3d345b;background:#211d32;padding:15px;border-radius:12px;margin-bottom:22px}.nx-plan-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.nx-plan-title{font-size:12px;font-weight:700}.nx-plan-version{color:var(--violet);font:500 10px 'DM Mono',monospace}.nx-plan p{font-size:11px;color:var(--soft);line-height:1.55;margin:0 0 14px}.nx-approved{display:flex;align-items:center;gap:6px;color:var(--green);font-size:10px;font-weight:700}.nx-context h3{font-size:11px;color:var(--muted);margin:20px 0 10px;text-transform:uppercase;letter-spacing:.08em}.nx-metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.nx-metric{background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:11px 10px}.nx-metric-label{color:var(--muted);font-size:10px;display:flex;justify-content:space-between}.nx-metric svg{color:#78847d}.nx-metric strong{font:600 15px 'DM Mono',monospace;display:block;margin:7px 0 3px}.nx-metric small{color:var(--green);font:500 9px 'DM Mono',monospace}.nx-reach{display:flex;justify-content:space-between;align-items:end;background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:12px 10px;margin-top:7px}.nx-reach strong{font:600 18px 'DM Mono',monospace}.nx-reach small{color:var(--muted);font-size:10px}.nx-progress{height:5px;border-radius:3px;background:var(--surface-3);margin-top:13px;overflow:hidden}.nx-progress i{display:block;background:var(--green);height:100%;width:69%}.nx-alert{display:flex;gap:9px;background:var(--amber-bg);border:1px solid #6c5126;padding:11px;border-radius:10px;color:var(--amber);font-size:10px;line-height:1.4}.nx-alert button{margin-left:auto;border:0;background:none;color:var(--amber);cursor:pointer;height:24px;width:24px}.nx-detail{margin-top:18px;border-top:1px solid var(--line);padding-top:13px}.nx-detail button{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:none;color:var(--soft);font-size:11px;font-weight:700;padding:0;cursor:pointer}.nx-trace{color:var(--muted);font:10px/1.65 'DM Mono',monospace;margin-top:12px}.nx-trace b{color:var(--violet);font-weight:500}.nx-mobile-nav,.nx-mobile-context{display:none}
        @media(max-width:1050px){.nx-shell{grid-template-columns:64px 210px minmax(390px,1fr)}.nx-context{display:none}.nx-mobile-context{display:block}.nx-conversation{padding-left:22px;padding-right:22px}}
        @media(max-width:700px){.nx-shell{display:block;min-height:100dvh;height:auto}.nx-rail,.nx-departments{display:none}.nx-main{min-height:100dvh;padding-bottom:64px}.nx-header{height:72px;padding:0 17px}.nx-header h1{font-size:14px}.nx-header p{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:225px}.nx-header>div:last-child{gap:8px!important}.nx-mode button{padding:5px 6px;font-size:9px}.nx-live{font-size:0}.nx-live i{font-size:initial}.nx-conversation{padding:20px 15px 16px}.nx-message{gap:8px;margin-bottom:18px}.nx-message .nx-avatar{height:25px;width:25px;flex-basis:25px;font-size:9px}.nx-message-meta strong{font-size:11px}.nx-message-meta span{font-size:9px}.nx-bubble{font-size:11px;padding:11px 12px}.nx-working{margin-left:33px}.nx-composer{padding:10px 12px;position:fixed;bottom:64px;left:0;right:0;z-index:3}.nx-composer input{height:40px}.nx-mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:64px;background:#1a1c1c;border-top:1px solid var(--line);z-index:4;justify-content:space-around}.nx-mobile-nav button{background:none;border:0;color:var(--muted);font-size:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:60px;cursor:pointer}.nx-mobile-nav button.active{color:var(--violet)}.nx-mobile-context{position:fixed;inset:0;z-index:6;background:rgba(0,0,0,.55);display:flex;align-items:flex-end}.nx-mobile-context .nx-context{display:block;width:100%;max-height:82dvh;border:0;border-radius:18px 18px 0 0;padding:20px 17px;background:#1b1e1e}.nx-mobile-context .nx-context-head{margin-bottom:12px}.nx-mobile-close{display:block!important;border:0;background:var(--surface-3);border-radius:50%;width:32px;height:32px;color:var(--muted)}.nx-mobile-context .nx-context h3{margin-top:14px}.nx-mobile-context .nx-alert{margin-bottom:4px}.nx-context{overflow:auto}.nx-section-title{margin-top:4px}}
        @media(prefers-reduced-motion:reduce){.nx-dots i{animation:none}.nx-root *{scroll-behavior:auto}}
      `}</style>
      <div className="nx-shell">
        <nav className="nx-rail" aria-label="Navegação principal">
          <div className="nx-brand" aria-label="NexOS">N</div>
          <button className="nx-selected" aria-label="Operações"><MessageSquare size={18} /></button>
          <button aria-label="Visão geral"><LayoutDashboard size={18} /></button>
          <button aria-label="Analytics"><BarChart3 size={18} /></button>
          <button aria-label="Notificações"><Bell size={18} /></button>
          <div className="nx-spacer" />
          <button aria-label="Configurações"><Settings2 size={18} /></button>
        </nav>

        <aside className="nx-departments">
          <div className="nx-kicker">Workspace</div>
          <div className="nx-workspace"><div><strong>NexOS Growth Lab</strong><small>São Paulo · ativo</small></div><button className="nx-plus" aria-label="Adicionar workspace"><Plus size={15} /></button></div>
          <div className="nx-section-title"><span>Departamentos</span><button aria-label="Pesquisar"><Search size={13} /></button></div>
          {departments.map((department) => (
            <button key={department.name} className={`nx-dept ${department.name === "Mídia Paga" && activeThread === "meta" ? "active" : ""}`} onClick={() => setActiveThread(department.name === "Social" ? "social" : department.name === "Mídia Paga" ? "meta" : "ops")}>
              <span className={`nx-avatar ${department.tone}`}>{department.initials}</span><span>{department.name}</span>{department.unread > 0 && <span className="nx-unread">{department.unread}</span>}
            </button>
          ))}
          <div className="nx-section-title" style={{ marginTop: 27 }}><span>Threads recentes</span><button aria-label="Mais opções"><MoreHorizontal size={14} /></button></div>
          {(["ops", "meta", "search", "social"] as ThreadId[]).map((thread) => (
            <button key={thread} className={`nx-dept ${activeThread === thread ? "active" : ""}`} onClick={() => setActiveThread(thread)}>
              <span className="nx-avatar slate"><MessageSquare size={13} /></span><span>{({ ops: "Operações", meta: "Escala Meta", search: "Google Search", social: "Calendário Social" })[thread]}</span>
            </button>
          ))}
        </aside>

        <main className="nx-main">
          <header className="nx-header">
            <div><h1>{threadTitle}</h1><p>Método Agenda Cheia — São Paulo <span style={{ color: "var(--violet)" }}>·</span> Master Plan v12</p></div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="nx-mode" role="group" aria-label="Modo de visualização">
                <button className={mode === "fundador" ? "active" : ""} onClick={() => setMode("fundador")} type="button">Fundador</button>
                <button className={mode === "arquiteto" ? "active" : ""} onClick={() => setMode("arquiteto")} type="button">Arquiteto</button>
              </div>
              <div className="nx-live"><i /> <span>7 agentes online</span></div>
            </div>
          </header>
          <section className="nx-conversation" aria-label="Conversa de operações">
            <div className="nx-day">Hoje, 14 de maio</div>
            {baseMessages.map((message) => message.kind === "warning" && !warningVisible ? null : (
              <div className={`nx-message ${message.kind}`} key={message.id}>
                <span className={`nx-avatar ${message.tone}`}>{message.initials}</span>
                <div className="nx-message-body">
                  <div className="nx-message-meta"><strong>{message.author}</strong><span>{message.role} · {message.time}</span></div>
                  <div className="nx-bubble">{message.text}</div>
                  <div className="nx-tags">{message.tags.map((tag) => <span key={tag} className={`nx-tag ${message.kind === "success" ? "green" : message.kind === "warning" ? "amber" : message.kind === "system" ? "violet" : ""}`}>{message.kind === "success" ? <Check size={11} /> : message.kind === "warning" ? <AlertTriangle size={11} /> : null}{tag}</span>)}</div>
                  {message.kind === "success" && <div className="nx-action"><button className="primary" onClick={() => setApproved(true)}>{approved ? "Aprovação registrada" : "Aprovar variação"}</button><button onClick={() => setHandoffSent(true)}><Hand size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{handoffSent ? "Enviado para você" : "Pedir revisão humana"}</button></div>}
                  {message.kind === "warning" && <div className="nx-action"><button className="primary" onClick={() => setHandoffSent(true)}><Hand size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{handoffSent ? "Você assumiu a revisão" : "Assumir revisão"}</button><button onClick={() => setWarningVisible(false)}><X size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Dispensar</button></div>}
                </div>
              </div>
            ))}
            <div className="nx-working"><Bot size={15} /><b>Nicholas</b> está trabalhando<span className="nx-dots"><i /><i /><i /></span></div>
          </section>
          <form className="nx-composer" onSubmit={(event) => { event.preventDefault(); submitMessage(); }}>
            <button type="button" style={{ background: "var(--surface-3)", color: "var(--muted)" }} aria-label="Comandos"><Command size={16} /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma instrução para os agentes..." aria-label="Mensagem para os agentes" />
            <button type="submit" aria-label="Enviar mensagem"><Send size={16} /></button>
          </form>
        </main>

        <aside className="nx-context" aria-label="Contexto da campanha">
          <div className="nx-context-head"><div><div className="nx-kicker">Contexto vivo</div><h2>O que está acontecendo</h2></div><button className="nx-context-icon" aria-label="Ocultar contexto"><ChevronRight size={17} /></button></div>
          <div className="nx-plan"><div className="nx-plan-top"><span className="nx-plan-title">Master Plan</span><span className="nx-plan-version">v12 · autoridade</span></div><p>Escalar prova local em São Paulo, mantendo CPL abaixo de R$ 7,20 e priorizando leads com intenção de agendamento.</p><div className="nx-approved"><FileCheck2 size={13} /> Aprovado por Mariana · herdado por agentes</div></div>
          <h3>Agora no sistema</h3>
          <div className="nx-metric-grid">{metrics.map(({ label, value, delta, icon: Icon }) => <div className="nx-metric" key={label}><div className="nx-metric-label"><span>{label}</span><Icon size={12} /></div><strong>{value}</strong><small>{delta} vs. período anterior</small></div>)}</div>
          <div className="nx-reach"><div><small>Alcance orgânico</small><strong>284 mil</strong></div><Activity size={18} color="var(--green)" /></div><div className="nx-progress" aria-label="69 por cento da meta de alcance"><i /></div>
          {warningVisible && <><h3>Precisa de atenção</h3><div className="nx-alert"><AlertTriangle size={16} /><span>Google Search pausado após CPL subir 26%. O sistema espera uma hipótese humana.</span><button onClick={() => setWarningVisible(false)} aria-label="Dispensar alerta"><X size={14} /></button></div></>}
          <div className="nx-detail"><button onClick={() => setShowDetails(!showDetails)}>Detalhes técnicos <ChevronDown size={15} style={{ transform: showDetails ? "rotate(180deg)" : undefined }} /></button>{showDetails && <div className="nx-trace"><div><b>pipeline</b> · Execução / Otimização</div><div><b>budget_cap</b> · R$ 18.000</div><div><b>approval</b> · inherited:true</div><div><b>next_action</b> · revisar em 02:00:00</div></div>}</div>
          <h3>Estado do canal</h3><div className="nx-alert" style={{ background: searchPaused ? "var(--amber-bg)" : "var(--green-bg)", borderColor: searchPaused ? "#6c5126" : "#28533f", color: searchPaused ? "var(--amber)" : "var(--green)" }}><Pause size={15} /><span><b>Google Search</b><br />{searchPaused ? "Pausado · aguarda validação" : "Ativo · monitoramento ligado"}</span><button onClick={() => setSearchPaused(!searchPaused)} aria-label={searchPaused ? "Reativar canal" : "Pausar canal"}>{searchPaused ? <Play size={14} /> : <Pause size={14} />}</button></div>
        </aside>
      </div>
      <div className="nx-mobile-nav" aria-label="Navegação mobile"><button className={mobilePanel === "chat" ? "active" : ""} onClick={() => setMobilePanel("chat")}><MessageSquare size={17} />Conversa</button><button onClick={() => setMobilePanel("context")} className={mobilePanel === "context" ? "active" : ""}><BarChart3 size={17} />Contexto</button><button><Users size={17} />Agentes</button><button><Menu size={17} />Mais</button></div>
      {mobilePanel === "context" && <div className="nx-mobile-context" onClick={() => setMobilePanel("chat")}><div className="nx-context" onClick={(event) => event.stopPropagation()}><div className="nx-context-head"><div><div className="nx-kicker">Contexto vivo</div><h2>Master Plan & métricas</h2></div><button className="nx-mobile-close" onClick={() => setMobilePanel("chat")} aria-label="Fechar contexto"><X size={16} /></button></div><div className="nx-plan"><div className="nx-plan-top"><span className="nx-plan-title">Master Plan</span><span className="nx-plan-version">v12 · aprovado</span></div><p>Escalar prova local em São Paulo, mantendo CPL abaixo de R$ 7,20.</p><div className="nx-approved"><ShieldCheck size={13} /> Aprovação herdada pelos agentes</div></div><h3>Métricas atuais</h3><div className="nx-metric-grid">{metrics.map(({ label, value, delta, icon: Icon }) => <div className="nx-metric" key={label}><div className="nx-metric-label"><span>{label}</span><Icon size={12} /></div><strong>{value}</strong><small>{delta}</small></div>)}</div><div className="nx-reach"><div><small>Alcance orgânico</small><strong>284 mil</strong></div><Activity size={18} color="var(--green)" /></div>{warningVisible && <><h3>Precisa de atenção</h3><div className="nx-alert"><AlertTriangle size={16} /><span>Google Search pausado. CPL +26%.</span></div></>}</div></div>}
    </div>
  );
}