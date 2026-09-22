import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePause,
  Clock3,
  Command,
  Eye,
  GitBranch,
  Hand,
  Layers3,
  Menu,
  MoreHorizontal,
  Play,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";

type Mode = "fundador" | "arquiteto";
type View = "visão geral" | "atividade" | "alertas";

const agents = [
  { name: "Nicholas", role: "Mídia Paga", action: "reallocating 12% do orçamento", state: "working", icon: TrendingUp, tone: "violet" },
  { name: "Garry", role: "Social", action: "agendando 7 posts para amanhã", state: "working", icon: Radio, tone: "cyan" },
  { name: "Philip", role: "Compliance", action: "verificação concluída", state: "success", icon: ShieldCheck, tone: "green" },
  { name: "Mídia Paga", role: "Google Search", action: "pausado após CPL +26%", state: "paused", icon: CirclePause, tone: "amber" },
];

const pipeline = [
  { label: "Briefing", count: "12/12", sub: "concluído", state: "done" },
  { label: "Estratégia", count: "v12", sub: "aprovada", state: "done" },
  { label: "Produção", count: "18", sub: "em fila", state: "active" },
  { label: "Execução", count: "03", sub: "agora", state: "active" },
  { label: "Otimização", count: "—", sub: "próximo", state: "next" },
];

const css = `
  .nx-cockpit, .nx-cockpit * { box-sizing: border-box; }
  .nx-cockpit {
    --bg: #0d1017; --surface: #151a24; --surface-2: #1b2130; --line: #2c3445;
    --muted: #8f9aae; --text: #eef2f7; --violet: #a78bfa; --cyan: #5eead4;
    --amber: #f6c85f; --green: #79e2a6; --red: #f28b8b;
    min-height: 100dvh; background: var(--bg); color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -.01em; overflow: hidden;
  }
  .nx-cockpit button { font: inherit; color: inherit; }
  .nx-shell { display: grid; grid-template-columns: 58px 1fr; min-height: 100dvh; }
  .nx-rail { background: #10141d; border-right: 1px solid var(--line); padding: 15px 8px; display:flex; flex-direction:column; align-items:center; gap:22px; }
  .nx-mark { width: 35px; height: 35px; border: 1px solid #7064bd; color: var(--violet); display:grid; place-items:center; border-radius: 10px; background:#211d39; }
  .nx-rail button { width: 40px; height: 40px; border: 0; border-radius: 9px; display:grid; place-items:center; background:transparent; color:#718096; cursor:pointer; }
  .nx-rail button:hover, .nx-rail button:focus-visible { background:#242b3a; color:var(--text); outline:2px solid var(--cyan); outline-offset:2px; }
  .nx-rail .rail-spacer { flex:1; }
  .nx-main { padding: 24px 30px 38px; max-width: 1500px; width:100%; margin:auto; }
  .nx-top { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:26px; }
  .nx-breadcrumb { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.11em; }
  .nx-breadcrumb strong { color:var(--text); font-weight:650; }
  .nx-top-actions { display:flex; align-items:center; gap:10px; }
  .nx-icon-btn { background:#171d28; border:1px solid var(--line); border-radius:9px; width:38px; height:38px; display:grid; place-items:center; cursor:pointer; }
  .nx-icon-btn:hover, .nx-icon-btn:focus-visible { border-color:var(--cyan); outline:none; }
  .nx-mode { display:flex; border:1px solid var(--line); background:#131821; border-radius:9px; padding:3px; }
  .nx-mode button { border:0; background:transparent; padding:8px 11px; min-height:34px; font-size:11px; color:var(--muted); cursor:pointer; border-radius:6px; }
  .nx-mode button[aria-pressed=true] { color:var(--text); background:#332b58; box-shadow:inset 0 0 0 1px #5f51a0; }
  .nx-heading { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px; gap:15px; }
  .nx-heading h1 { margin:0 0 6px; font-size:clamp(24px,3vw,34px); line-height:1.05; font-weight:650; letter-spacing:-.045em; }
  .nx-heading p { color:var(--muted); margin:0; font-size:13px; }
  .nx-live { border:1px solid #294c51; color:var(--cyan); background:#12272b; border-radius:20px; display:flex; align-items:center; gap:7px; padding:8px 12px; font-size:11px; white-space:nowrap; }
  .nx-dot { width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 3px #21474a; }
  .nx-kpis { display:grid; grid-template-columns:1.1fr 1fr 1fr 1fr 1.2fr; border:1px solid var(--line); border-radius:12px; background:linear-gradient(110deg,#191e2b,#151a24); margin-bottom:22px; overflow:hidden; }
  .nx-kpi { padding:15px 17px; border-right:1px solid var(--line); min-height:92px; }
  .nx-kpi:last-child { border:0; } .nx-kpi-label { color:var(--muted); font-size:11px; display:flex; align-items:center; gap:5px; margin-bottom:9px; }
  .nx-kpi-value { font-weight:650; font-size:21px; letter-spacing:-.04em; } .nx-kpi-delta { font-size:11px; margin-left:7px; color:var(--green); font-weight:500; }
  .nx-mini-chart { width:100%; height:30px; margin-top:3px; overflow:visible; }
  .nx-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(300px,.8fr); gap:18px; align-items:start; }
  .nx-panel { background:var(--surface); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .nx-panel-head { min-height:57px; border-bottom:1px solid var(--line); padding:14px 17px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .nx-panel-title { font-size:13px; font-weight:650; display:flex; align-items:center; gap:8px; }
  .nx-panel-title small { color:var(--muted); font-weight:400; font-size:11px; }
  .nx-subtle-btn { background:transparent; border:0; color:var(--muted); font-size:11px; cursor:pointer; display:flex; align-items:center; gap:5px; padding:7px; }
  .nx-subtle-btn:hover, .nx-subtle-btn:focus-visible { color:var(--text); outline:2px solid var(--cyan); border-radius:5px; }
  .nx-pipeline { padding:22px 17px 25px; }
  .nx-pipeline-line { height:2px; background:#30384a; position:absolute; top:15px; left:8%; right:8%; }
  .nx-pipeline-items { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; position:relative; }
  .nx-step { position:relative; text-align:center; z-index:1; }
  .nx-step-pin { margin:0 auto 12px; width:31px; height:31px; border-radius:50%; border:2px solid #485268; background:var(--surface); display:grid; place-items:center; color:var(--muted); font-size:11px; }
  .nx-step.done .nx-step-pin { border-color:var(--violet); color:var(--violet); background:#292440; } .nx-step.active .nx-step-pin { border-color:var(--cyan); color:var(--cyan); background:#18343a; }
  .nx-step-title { font-size:11px; font-weight:600; } .nx-step-sub { color:var(--muted); font-size:10px; margin-top:5px; }
  .nx-step.active .nx-step-sub { color:var(--cyan); } .nx-step.next .nx-step-sub { color:#69758c; }
  .nx-focus { margin-top:16px; padding:13px 14px; border:1px solid #3b3262; border-radius:9px; background:#201d32; display:flex; align-items:center; justify-content:space-between; gap:15px; }
  .nx-focus-copy { display:flex; gap:11px; align-items:flex-start; } .nx-focus-copy b { font-size:12px; } .nx-focus-copy p { margin:4px 0 0; color:#aaa6c5; font-size:11px; }
  .nx-tag { border:1px solid #584a9c; color:var(--violet); border-radius:5px; padding:4px 6px; font-size:10px; white-space:nowrap; }
  .nx-queue { margin-top:18px; } .nx-list { list-style:none; margin:0; padding:0; }
  .nx-agent { display:flex; gap:12px; align-items:center; padding:14px 17px; border-bottom:1px solid #252d3b; cursor:pointer; }
  .nx-agent:last-child { border-bottom:0; } .nx-agent:hover { background:#1b2230; } .nx-agent-avatar { width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:#282c43;color:var(--violet); flex:none; }
  .nx-agent-avatar.cyan { background:#183339;color:var(--cyan); }.nx-agent-avatar.green {background:#17352b;color:var(--green)}.nx-agent-avatar.amber{background:#3b3020;color:var(--amber)}
  .nx-agent-copy { min-width:0; flex:1; } .nx-agent-copy b { font-size:12px; font-weight:600; } .nx-agent-copy p { color:var(--muted); margin:4px 0 0; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .nx-state { display:flex; align-items:center; gap:6px; color:var(--muted); font-size:10px; white-space:nowrap; } .nx-state i { width:6px; height:6px; border-radius:50%; background:#758096; }.nx-state.working i{background:var(--cyan)}.nx-state.success i{background:var(--green)}.nx-state.paused i{background:var(--amber)}
  .nx-alert { padding:15px 17px; border-bottom:1px solid #252d3b; } .nx-alert:last-child {border:0}.nx-alert-main {display:flex;gap:10px;align-items:flex-start}.nx-alert-main svg{color:var(--amber);flex:none}.nx-alert b{font-size:12px}.nx-alert p{font-size:11px;color:var(--muted);line-height:1.45;margin:5px 0 0}.nx-alert-actions{display:flex;gap:8px;margin:12px 0 0 24px}.nx-action { min-height:32px; padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:#202838; font-size:10px; cursor:pointer; }.nx-action.primary{background:#4b3e84;border-color:#6958ae}.nx-action:hover,.nx-action:focus-visible{border-color:var(--cyan);outline:none}
  .nx-governance { margin-top:18px; padding:15px 17px; background:#131a22; border:1px solid #2b4647; border-radius:12px; } .nx-gov-head{display:flex;justify-content:space-between;align-items:center}.nx-gov-head b{font-size:12px}.nx-gov-head span{font-size:10px;color:var(--green);display:flex;gap:5px;align-items:center}.nx-gov p{font-size:11px;color:var(--muted);line-height:1.5;margin:10px 0 0}.nx-gov strong{color:#d7dbe3;font-weight:550}
  .nx-footer-note { margin-top:20px;color:#6f7b90;font-size:10px;display:flex;align-items:center;gap:7px; }
  .nx-architect { margin-top:15px; padding:12px; border:1px dashed #4b3e75; background:#1a1927; border-radius:8px; font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;color:#b9b1dd; line-height:1.7; }
  .nx-architect code{color:var(--cyan)} .nx-mobile-bar{display:none}
  @media (max-width: 850px){ .nx-shell{grid-template-columns:1fr}.nx-rail{display:none}.nx-main{padding:16px 15px 30px}.nx-top{margin-bottom:20px}.nx-heading{align-items:flex-end}.nx-kpis{grid-template-columns:repeat(2,1fr)}.nx-kpi{border-bottom:1px solid var(--line)}.nx-kpi:nth-child(2n){border-right:0}.nx-kpi:last-child{grid-column:span 2}.nx-grid{grid-template-columns:1fr}.nx-mobile-bar{position:sticky;bottom:0;z-index:5;display:flex;justify-content:space-around;background:#111720;border-top:1px solid var(--line);padding:8px 4px}.nx-mobile-bar button{border:0;background:transparent;color:var(--muted);font-size:10px;display:grid;gap:4px;justify-items:center;min-width:70px;min-height:44px}.nx-mobile-bar button.active{color:var(--cyan)} }
  @media (max-width: 520px){.nx-main{padding:13px 12px 78px}.nx-breadcrumb{font-size:10px}.nx-heading h1{font-size:25px}.nx-heading p{font-size:11px;max-width:220px}.nx-live{padding:7px 9px}.nx-mode button{padding:8px 9px}.nx-kpi{padding:13px 12px}.nx-kpi-value{font-size:18px}.nx-pipeline{overflow-x:auto}.nx-pipeline-items{min-width:560px}.nx-panel-head{padding-left:13px;padding-right:13px}.nx-agent{padding:13px}.nx-state{display:none}.nx-focus{align-items:flex-start;flex-direction:column}.nx-alert-actions{margin-left:0}.nx-top-actions .nx-icon-btn{display:none}}
  @media (max-width: 640px){
    .nx-cockpit, .nx-shell, .nx-main, .nx-grid, .nx-panel, .nx-kpis { min-width: 0; max-width: 100%; }
    .nx-cockpit { overflow-x: hidden; }
    .nx-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .nx-kpi { min-width: 0; overflow: hidden; }
    .nx-kpi-value { min-width: 0; overflow-wrap: anywhere; }
    .nx-kpi-delta { display: block; margin: 3px 0 0; line-height: 1.1; }
    .nx-pipeline { overflow: visible; }
    .nx-pipeline-items { display: block; min-width: 0; }
    .nx-pipeline-line { top: 15px; bottom: 15px; left: 23px; right: auto; width: 2px; height: auto; }
    .nx-step { display: grid; grid-template-columns: 32px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 12px; text-align: left; margin-bottom: 13px; }
    .nx-step:last-child { margin-bottom: 0; }
    .nx-step-pin { grid-row: 1 / span 2; margin: 0; }
    .nx-step-title, .nx-step-sub { min-width: 0; }
    .nx-step-sub { margin-top: 3px; }
  }
  @media (prefers-reduced-motion: reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

export default function ExecutiveCockpit() {
  const [mode, setMode] = useState<Mode>("fundador");
  const [view, setView] = useState<View>("visão geral");
  const [selectedAgent, setSelectedAgent] = useState("Nicholas");
  const [alertOpen, setAlertOpen] = useState(true);
  const [handoff, setHandoff] = useState(false);
  const [details, setDetails] = useState(false);
  const [muted, setMuted] = useState(false);
  const selected = useMemo(() => agents.find((a) => a.name === selectedAgent) ?? agents[0], [selectedAgent]);

  return (
    <div className="nx-cockpit">
      <style>{css}</style>
      <div className="nx-shell">
        <aside className="nx-rail" aria-label="Navegação principal">
          <div className="nx-mark" aria-label="NexOS"><Command size={18} /></div>
          <button aria-label="Visão geral" onClick={() => setView("visão geral")}><Layers3 size={18} /></button>
          <button aria-label="Atividade" onClick={() => setView("atividade")}><Activity size={18} /></button>
          <button aria-label="Alertas" onClick={() => setView("alertas")}><AlertTriangle size={18} /></button>
          <div className="rail-spacer" />
          <button aria-label={muted ? "Ativar sinais" : "Silenciar sinais"} onClick={() => setMuted(!muted)}><Zap size={18} /></button>
          <button aria-label="Configurações"><Settings2 size={18} /></button>
        </aside>
        <main className="nx-main">
          <header className="nx-top">
            <div className="nx-breadcrumb"><span>NexOS</span><ChevronRight size={13} /><strong>Growth Lab</strong><ChevronRight size={13} /><span>Campanha</span></div>
            <div className="nx-top-actions">
              <div className="nx-mode" aria-label="Modo de visualização">
                <button aria-pressed={mode === "fundador"} onClick={() => setMode("fundador")}>Fundador</button>
                <button aria-pressed={mode === "arquiteto"} onClick={() => setMode("arquiteto")}>Arquiteto</button>
              </div>
              <button className="nx-icon-btn" aria-label="Pesquisar"><Search size={16} /></button>
              <button className="nx-icon-btn" aria-label={muted ? "Ativar sinais" : "Silenciar sinais"} onClick={() => setMuted(!muted)}><Zap size={16} /></button>
            </div>
          </header>

          <section className="nx-heading">
            <div><h1>Missão: Agenda Cheia</h1><p>São Paulo · Master Plan v12 · orçamento aprovado R$ 18.000</p></div>
            <div className="nx-live"><i className="nx-dot" /> SISTEMA OPERACIONAL</div>
          </section>

          <section className="nx-kpis" aria-label="Indicadores da campanha">
            <div className="nx-kpi"><div className="nx-kpi-label"><Target size={13} /> Investimento</div><div className="nx-kpi-value">R$ 12.480 <span className="nx-kpi-delta">69,3%</span></div></div>
            <div className="nx-kpi"><div className="nx-kpi-label"><UserRound size={13} /> Leads</div><div className="nx-kpi-value">1.842 <span className="nx-kpi-delta">+18,4%</span></div></div>
            <div className="nx-kpi"><div className="nx-kpi-label"><ArrowDownRight size={13} /> CPL</div><div className="nx-kpi-value">R$ 6,78 <span className="nx-kpi-delta">−11,2%</span></div></div>
            <div className="nx-kpi"><div className="nx-kpi-label"><TrendingUp size={13} /> ROAS</div><div className="nx-kpi-value">4,7x <span className="nx-kpi-delta">+0,8x</span></div></div>
            <div className="nx-kpi"><div className="nx-kpi-label"><Eye size={13} /> Alcance orgânico <ArrowUpRight size={12} color="#79e2a6" /></div><div className="nx-kpi-value">284 mil</div><svg className="nx-mini-chart" viewBox="0 0 190 30" role="img" aria-label="Tendência de alcance orgânico crescente"><polyline points="0,25 22,22 43,24 62,15 83,18 101,8 120,13 142,5 162,8 189,1" fill="none" stroke="#5eead4" strokeWidth="2" /></svg></div>
          </section>

          <div className="nx-grid">
            <div>
              <section className="nx-panel">
                <div className="nx-panel-head"><div className="nx-panel-title"><GitBranch size={15} color="#a78bfa" /> Pipeline da missão <small>· 5 frentes</small></div><button className="nx-subtle-btn" onClick={() => setDetails(!details)}>{details ? "Ocultar detalhes" : "Ver detalhes"} <ChevronDown size={13} /></button></div>
                <div className="nx-pipeline">
                  <div className="nx-pipeline-items"><div className="nx-pipeline-line" />{pipeline.map((step, i) => <div className={`nx-step ${step.state}`} key={step.label}><div className="nx-step-pin">{step.state === "done" ? <Check size={14} /> : i + 1}</div><div className="nx-step-title">{step.label}</div><div className="nx-step-sub">{step.count} · {step.sub}</div></div>)}</div>
                  <div className="nx-focus"><div className="nx-focus-copy"><Sparkles size={17} color="#a78bfa" /><div><b>Foco atual: escalar vencedores no Meta</b><p>O sistema identificou criativos com CPL abaixo de R$ 5,90. Próxima ação: redistribuir verba em 2 horas.</p></div></div><span className="nx-tag">EM EXECUÇÃO</span></div>
                  {mode === "arquiteto" && details && <div className="nx-architect"><div><code>orquestrador</code> → meta_scaling_v3</div><div><code>confidence</code> 0.87 · <code>approval_inherited</code> true</div><div><code>next_checkpoint</code> hoje, 16:40 BRT · 4 agentes dependentes</div></div>}
                </div>
              </section>

              <section className="nx-panel nx-queue">
                <div className="nx-panel-head"><div className="nx-panel-title"><Activity size={15} color="#5eead4" /> Fila de agentes <small>· ao vivo</small></div><button className="nx-subtle-btn" onClick={() => setView("atividade")}>Abrir fluxo <ChevronRight size={13} /></button></div>
                <ul className="nx-list">{agents.map((agent) => { const Icon = agent.icon; return <li className="nx-agent" key={agent.name} onClick={() => setSelectedAgent(agent.name)} aria-selected={selected.name === agent.name}><div className={`nx-agent-avatar ${agent.tone}`}><Icon size={16} /></div><div className="nx-agent-copy"><b>{agent.name} <span style={{ color: "#718096", fontWeight: 400 }}>· {agent.role}</span></b><p>{agent.action}</p></div><span className={`nx-state ${agent.state}`}><i />{agent.state === "working" ? "trabalhando" : agent.state === "success" ? "sucesso" : "pausado"}</span><MoreHorizontal size={15} color="#6f7b90" /></li>; })}</ul>
              </section>
            </div>

            <aside>
              <section className="nx-panel">
                <div className="nx-panel-head"><div className="nx-panel-title"><AlertTriangle size={15} color="#f6c85f" /> Atenção necessária <small>· 1</small></div><button className="nx-subtle-btn" onClick={() => setAlertOpen(false)} aria-label="Fechar alertas"><X size={14} /></button></div>
                {alertOpen ? <div className="nx-alert"><div className="nx-alert-main"><AlertTriangle size={16} /><div><b>Google Search está pausado</b><p>O CPL subiu 26% nas últimas 24h. Nenhuma verba será consumida até a revisão humana.</p></div></div><div className="nx-alert-actions"><button className="nx-action primary" onClick={() => setHandoff(true)}><Hand size={13} /> {handoff ? "Handoff solicitado" : "Escalar para humano"}</button><button className="nx-action" onClick={() => setAlertOpen(false)}>Entendido</button></div></div> : <div className="nx-alert"><div className="nx-alert-main"><Check size={16} color="#79e2a6" /><div><b>Sem novos alertas</b><p>Você será avisado quando a próxima decisão precisar de revisão.</p></div></div></div>}
              </section>
              <section className="nx-governance">
                <div className="nx-gov-head"><b>Governança ativa</b><span><ShieldCheck size={13} /> APROVADO</span></div>
                <p><strong>Master Plan v12</strong> foi aprovado por você e herdado por Estratégia, Criativo e Mídia Paga. O orçamento máximo permanece em <strong>R$ 18.000</strong>.</p>
              </section>
              <div className="nx-footer-note"><Clock3 size={13} /> Próximo resumo executivo em 42 min · {muted ? "sinais silenciados" : "sinais sonoros ativos"}</div>
              {mode === "arquiteto" && <div className="nx-architect"><div><code>selected_agent</code> {selected.name} / {selected.role}</div><div><code>thread</code> campaign.sp.v12.execution</div><div><code>handoff</code> {handoff ? "pending_human_review" : "not_required"}</div></div>}
            </aside>
          </div>
        </main>
      </div>
      <nav className="nx-mobile-bar" aria-label="Navegação móvel">
        <button className={view === "visão geral" ? "active" : ""} onClick={() => setView("visão geral")}><Menu size={16} />Visão geral</button>
        <button className={view === "atividade" ? "active" : ""} onClick={() => setView("atividade")}><Activity size={16} />Atividade</button>
        <button className={view === "alertas" ? "active" : ""} onClick={() => setView("alertas")}><AlertTriangle size={16} />Alertas</button>
        <button onClick={() => setMuted(!muted)}><Zap size={16} />{muted ? "Sinais" : "Som"}</button>
      </nav>
    </div>
  );
}