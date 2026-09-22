import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  EarOff,
  Expand,
  Fingerprint,
  Gauge,
  GitBranch,
  Info,
  LockKeyhole,
  MessageSquare,
  Pause,
  Radio,
  Sparkles,
  Target,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import { useState } from "react";

export function GuidedJourney() {
  const [mode, setMode] = useState<"fundador" | "arquiteto">("fundador");
  const [chapter, setChapter] = useState(2);
  const [showEvidence, setShowEvidence] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [approved, setApproved] = useState(false);
  const [paused, setPaused] = useState(true);
  const [view, setView] = useState<"journey" | "pulse">("journey");

  const chapters = [
    { n: "01", label: "Briefing", state: "Concluído", icon: Check },
    { n: "02", label: "Estratégia", state: "Agora", icon: Target },
    { n: "03", label: "Produção", state: "Próximo", icon: WandSparkles },
    { n: "04", label: "Execução", state: "Em seguida", icon: Radio },
    { n: "05", label: "Otimização", state: "Contínuo", icon: Gauge },
  ];

  const agents = [
    ["Erick", "orquestrando", "E", "#c9b5ff"],
    ["Maya", "analisando", "M", "#9db8ff"],
    ["Garry", "agendando", "G", "#e1c58e"],
    ["Nicholas", "realocando", "N", "#91d0c0"],
    ["Philip", "aprovado", "P", "#c7a7ff"],
  ];

  return (
    <div className={`nexos-journey ${quiet ? "is-quiet" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
        .nexos-journey{--ink:#0d0d1b;--ink-2:#14142a;--ink-3:#1b1b35;--line:rgba(226,220,255,.12);--muted:#9894b0;--soft:#dedaf0;--violet:#ae91f8;--violet-2:#7f69cc;--champagne:#e7c887;--mint:#9ed9c1;min-height:100dvh;background:radial-gradient(circle at 61% -10%,#29204e 0%,#121225 35%,var(--ink) 70%);color:#f7f4ff;font-family:Manrope, sans-serif;overflow:hidden;position:relative}
        .nexos-journey:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.13;background-image:radial-gradient(rgba(255,255,255,.35) .5px,transparent .5px);background-size:5px 5px;mix-blend-mode:screen}
        .nexos-journey button:focus-visible,.nexos-journey [role="button"]:focus-visible{outline:2px solid var(--champagne);outline-offset:3px}
        .nj-shell{max-width:1450px;margin:auto;min-height:100dvh;padding:26px 42px 34px;position:relative}
        .nj-top{display:flex;align-items:center;gap:28px;border-bottom:1px solid var(--line);padding-bottom:22px}
        .nj-brand{display:flex;align-items:center;gap:11px;min-width:220px}.nj-mark{width:31px;height:31px;border:1px solid rgba(201,181,255,.6);border-radius:10px;display:grid;place-items:center;color:var(--violet);background:rgba(174,145,248,.11);box-shadow:0 0 26px rgba(174,145,248,.18)}.nj-brand b{font-size:13px;letter-spacing:.18em}.nj-brand small{display:block;color:var(--muted);font-size:10px;margin-top:2px;letter-spacing:.06em}
        .nj-campaign{flex:1;color:var(--soft);font-size:13px}.nj-campaign span{color:var(--muted);margin-left:8px}.nj-top-actions{display:flex;align-items:center;gap:10px}
        .nj-mode{display:flex;padding:3px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:9px}.nj-mode button{border:0;background:transparent;color:var(--muted);border-radius:6px;padding:9px 13px;font:600 11px Manrope;cursor:pointer;min-height:38px}.nj-mode button.active{background:#30264f;color:#f9f6ff;box-shadow:inset 0 0 0 1px rgba(201,181,255,.2)}
        .nj-iconbtn,.nj-quiet{border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--soft);border-radius:9px;min-width:42px;min-height:42px;display:grid;place-items:center;cursor:pointer}.nj-iconbtn:hover,.nj-quiet:hover{background:rgba(174,145,248,.12)}
        .nj-context{display:flex;align-items:center;justify-content:space-between;padding:18px 0 26px}.nj-context-left{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted)}.nj-live{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 14px var(--mint);animation:nj-pulse 2.4s infinite}.nj-context-left strong{color:var(--soft);font-weight:600}.nj-context-right{font:11px 'DM Mono';color:#a9a3bf;display:flex;align-items:center;gap:8px}.nj-context-right b{color:var(--champagne);font-weight:500}
        .nj-layout{display:grid;grid-template-columns:190px minmax(450px,740px) 270px;gap:56px;align-items:start}.nj-rail{padding-top:28px}.nj-rail-label{text-transform:uppercase;color:#77728d;font-size:9px;letter-spacing:.19em;margin:0 0 22px 4px}.nj-chapter{display:flex;gap:13px;position:relative;padding:0 0 31px 3px;cursor:pointer;min-height:53px}.nj-chapter:not(:last-child):after{content:"";position:absolute;left:13px;top:27px;height:calc(100% - 17px);border-left:1px dashed rgba(174,145,248,.25)}.nj-dot{z-index:1;width:22px;height:22px;border:1px solid rgba(255,255,255,.22);background:#17172d;border-radius:50%;display:grid;place-items:center;color:#9994ad;flex-shrink:0}.nj-chapter.active .nj-dot{border-color:var(--violet);color:var(--violet);box-shadow:0 0 0 5px rgba(174,145,248,.09)}.nj-chapter.done .nj-dot{background:#23352f;color:var(--mint);border-color:rgba(158,217,193,.45)}.nj-chapter-text{padding-top:2px}.nj-chapter-text strong{font-size:12px;font-weight:600;color:#aba6bf;display:block}.nj-chapter.active strong{color:#f8f4ff}.nj-chapter-text small{font-size:10px;color:#6f6a84;display:block;margin-top:3px}.nj-chapter.active small{color:var(--violet)}
        .nj-stage{min-width:0}.nj-kicker{display:flex;align-items:center;gap:9px;color:var(--violet);font:500 10px 'DM Mono';letter-spacing:.1em;text-transform:uppercase;margin:2px 0 20px}.nj-kicker i{width:27px;height:1px;background:var(--violet);display:inline-block;opacity:.7}.nj-stage h1{font:600 clamp(33px,4vw,53px)/1.1 "Playfair Display",serif;letter-spacing:-.035em;margin:0 0 17px;max-width:700px}.nj-stage h1 em{color:var(--champagne);font-style:normal}.nj-sub{color:#aaa5bb;line-height:1.7;font-size:14px;max-width:600px;margin:0 0 27px}.nj-sub b{color:#e8e2f6;font-weight:600}
        .nj-decision{border:1px solid rgba(231,200,135,.3);background:linear-gradient(105deg,rgba(231,200,135,.12),rgba(174,145,248,.07));border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:15px;margin:0 0 26px;box-shadow:0 17px 45px rgba(0,0,0,.12)}.nj-decision-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(231,200,135,.13);color:var(--champagne);flex-shrink:0}.nj-decision-text{flex:1}.nj-decision-text small{display:block;color:var(--champagne);font:500 10px 'DM Mono';text-transform:uppercase;letter-spacing:.09em;margin-bottom:5px}.nj-decision-text strong{font-size:13px;font-weight:600}.nj-decision button{border:1px solid rgba(231,200,135,.42);background:#3a3046;color:#f6e5bd;padding:10px 14px;border-radius:8px;font:600 11px Manrope;cursor:pointer;min-height:44px;white-space:nowrap}
        .nj-outcomes{display:grid;grid-template-columns:1.15fr .85fr .85fr 1fr;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:19px 0 17px;margin-bottom:20px;gap:10px}.nj-metric{padding-right:12px;border-right:1px solid var(--line)}.nj-metric:last-child{border:0}.nj-metric label{display:block;color:#827d99;font-size:10px;margin-bottom:7px}.nj-metric strong{font:500 20px 'DM Mono';color:#f2edff;letter-spacing:-.04em}.nj-metric:first-child strong{color:var(--champagne)}.nj-metric small{display:block;color:#76ba9d;font-size:10px;margin-top:6px}
        .nj-evidence{border:1px solid var(--line);background:rgba(255,255,255,.025);border-radius:12px;overflow:hidden}.nj-evidence-toggle{width:100%;border:0;background:none;color:#c8c1dc;text-align:left;padding:15px 17px;display:flex;align-items:center;gap:10px;cursor:pointer;font:600 12px Manrope;min-height:50px}.nj-evidence-toggle svg:last-child{margin-left:auto;color:#87819e}.nj-evidence-body{border-top:1px solid var(--line);padding:16px 18px;color:#9f99b2;font-size:12px;line-height:1.65}.nj-trace{display:flex;gap:9px;margin:8px 0}.nj-trace b{color:#e4dff1;font-weight:600}.nj-trace code{color:var(--violet);font:10px 'DM Mono'}
        .nj-pulse{border:1px solid var(--line);background:rgba(14,14,29,.4);border-radius:15px;padding:19px;margin-top:31px}.nj-pulse-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}.nj-pulse h2{font:600 14px Manrope;margin:0}.nj-pulse h2 small{color:var(--muted);display:block;font-size:10px;font-weight:400;margin-top:4px}.nj-pulse-head button{border:0;background:none;color:#847e9e;cursor:pointer}.nj-agent{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.065)}.nj-agent:last-child{border:0}.nj-avatar{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:800;background:#292346;color:var(--violet);border:1px solid rgba(201,181,255,.27)}.nj-agent div:nth-child(2){flex:1}.nj-agent strong{display:block;font-size:11px;font-weight:600}.nj-agent small{display:block;color:#77728e;font-size:10px;margin-top:2px}.nj-agent-state{font:9px 'DM Mono';color:#88b9a4}.nj-agent.work .nj-agent-state{color:var(--violet)}.nj-signal{width:5px;height:5px;background:var(--violet);border-radius:50%;animation:nj-pulse 1.5s infinite}
        .nj-alert{margin-top:18px;border-left:2px solid #d9aa70;background:rgba(217,170,112,.09);padding:13px 13px 13px 14px;display:flex;gap:9px;border-radius:0 8px 8px 0}.nj-alert svg{color:#e5ba83;flex-shrink:0}.nj-alert div{font-size:11px;color:#c0b7aa;line-height:1.5}.nj-alert strong{display:block;color:#e8c690;margin-bottom:3px}.nj-alert button{margin-top:9px;color:#e8c690;background:none;border:0;border-bottom:1px solid rgba(232,198,144,.35);padding:0 0 2px;font:600 10px Manrope;cursor:pointer}
        .nj-footer{display:flex;align-items:center;justify-content:space-between;margin-top:32px;color:#716c83;font-size:10px}.nj-footer-left,.nj-footer-right{display:flex;align-items:center;gap:9px}.nj-footer-right{font-family:'DM Mono';}.nj-next{color:#aaa4ba}.nj-handoff{border:1px solid rgba(174,145,248,.3);background:rgba(174,145,248,.08);color:#d4c4fa;border-radius:8px;padding:10px 13px;cursor:pointer;font:600 11px Manrope;min-height:44px}
        .nj-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);border:1px solid rgba(158,217,193,.35);background:#182c29;color:#c7efdc;border-radius:9px;padding:12px 17px;font-size:12px;z-index:3;box-shadow:0 15px 40px #0008}.nj-quiet .nj-live,.nj-quiet .nj-signal{animation:none;box-shadow:none}.nj-quiet .nj-stage{opacity:.96}@keyframes nj-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}@media(prefers-reduced-motion:reduce){.nj-live,.nj-signal{animation:none!important}.nexos-journey *{scroll-behavior:auto!important}}
        @media(max-width:1050px){.nj-shell{padding:22px 25px}.nj-layout{grid-template-columns:155px minmax(0,1fr);gap:35px}.nj-pulse{grid-column:1/-1;margin-top:0}.nj-agent{display:inline-flex;width:19%;border:0;margin-right:1%}.nj-pulse{display:block}.nj-pulse-head{margin-bottom:10px}}
        @media(max-width:700px){.nexos-journey{overflow-x:hidden;overflow-y:auto}.nj-shell{padding:17px 17px 26px}.nj-top{gap:12px;padding-bottom:16px;flex-wrap:wrap}.nj-brand{min-width:0;flex:1}.nj-campaign{order:3;flex-basis:100%;font-size:12px;min-width:0;line-height:1.45}.nj-top-actions{gap:6px}.nj-mode button{padding:8px 9px}.nj-iconbtn{min-width:40px}.nj-context{padding:15px 0 23px;align-items:flex-start;gap:12px;flex-direction:column}.nj-context-left{flex-wrap:wrap;row-gap:7px;line-height:1.35}.nj-context-right{font-size:10px;flex-wrap:wrap;line-height:1.4}.nj-layout{display:flex;flex-direction:column;gap:0}.nj-rail{order:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));overflow:visible;padding:0 0 24px;width:100%;gap:3px}.nj-rail-label{display:none}.nj-chapter{padding:0;min-height:48px;gap:8px;flex-direction:column;align-items:flex-start;min-width:0}.nj-chapter:not(:last-child):after{left:25px;top:11px;width:calc(100% - 22px);height:0;border-left:0;border-top:1px dashed rgba(174,145,248,.25)}.nj-dot{width:22px;height:22px}.nj-chapter-text{padding:0}.nj-chapter-text strong{font-size:10px;white-space:normal}.nj-chapter-text small{font-size:9px;white-space:normal}.nj-stage h1{font-size:36px;margin-bottom:14px}.nj-sub{font-size:13px;margin-bottom:21px}.nj-decision{align-items:flex-start;padding:15px;flex-wrap:wrap}.nj-decision button{margin-left:49px;margin-top:-3px}.nj-outcomes{grid-template-columns:1fr 1fr;gap:16px;padding:17px 0}.nj-metric:nth-child(2){border:0}.nj-metric strong{font-size:17px}.nj-pulse{margin-top:25px;padding:16px}.nj-agent{width:100%;display:flex;border-bottom:1px solid rgba(255,255,255,.065);margin:0}.nj-pulse-head{margin-bottom:10px}.nj-alert{margin-top:15px}.nj-footer{align-items:flex-start;gap:13px;flex-direction:column;margin-top:24px}.nj-footer-right{width:100%;justify-content:space-between}}
        @media(max-width:640px){.nj-campaign span{display:block;margin:3px 0 0}.nj-context-right{max-width:100%}}
      `}</style>

      <div className="nj-shell">
        <header className="nj-top">
          <div className="nj-brand"><div className="nj-mark"><Command size={16} /></div><div><b>NEXOS</b><small>GROWTH LAB · OPERATING SYSTEM</small></div></div>
          <div className="nj-campaign"><strong>Método Agenda Cheia</strong><span>São Paulo / Campanha ativa</span></div>
          <div className="nj-top-actions">
            <div className="nj-mode" aria-label="Modo de leitura">
              <button className={mode === "fundador" ? "active" : ""} onClick={() => setMode("fundador")}>Fundador</button>
              <button className={mode === "arquiteto" ? "active" : ""} onClick={() => setMode("arquiteto")}>Arquiteto</button>
            </div>
            <button className="nj-quiet" aria-label={quiet ? "Ativar sons e movimento" : "Reduzir sons e movimento"} onClick={() => setQuiet(!quiet)}>{quiet ? <EarOff size={16} /> : <Volume2 size={16} />}</button>
          </div>
        </header>

        <div className="nj-context">
          <div className="nj-context-left"><span className="nj-live" aria-hidden="true" /><strong>Jornada em andamento</strong><span>•</span><span>Master Plan v12 é a autoridade</span><LockKeyhole size={12} /></div>
          <div className="nj-context-right"><span>ÚLTIMA LEITURA</span><b>há 4 min</b><span>·</span><span>R$ 18.000 aprovados</span></div>
        </div>

        <main className="nj-layout">
          <nav className="nj-rail" aria-label="Etapas da campanha">
            <p className="nj-rail-label">O caminho</p>
            {chapters.map((item, index) => {
              const Icon = item.icon;
              return <div key={item.n} className={`nj-chapter ${index === chapter ? "active" : ""} ${index < chapter ? "done" : ""}`} onClick={() => setChapter(index)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setChapter(index)}>
                <span className="nj-dot">{index < chapter ? <Check size={12} /> : <Icon size={11} />}</span><span className="nj-chapter-text"><strong>{item.label}</strong><small>{index === chapter ? "Agora" : item.state}</small></span>
              </div>;
            })}
          </nav>

          <section className="nj-stage" aria-labelledby="journey-title">
            <div className="nj-kicker"><i /> DECISÃO DA VEZ <span>·</span> {mode === "fundador" ? "VISÃO DO FUNDADOR" : "RASTRO DO SISTEMA"}</div>
            <h1 id="journey-title">{mode === "fundador" ? <>Os sinais estão claros.<br /><em>Podemos escalar.</em></> : <>Escala autorizada.<br /><em>Confiança 0,87.</em></>}</h1>
            <p className="nj-sub">{mode === "fundador" ? <>O Meta encontrou os conjuntos vencedores em São Paulo. Vamos mover verba para eles e proteger o que já funciona — sem aumentar o risco da campanha.</> : <>Maya isolou 3 conjuntos com contribuição de 71% dos leads. Nicholas propõe realocação de 12% com base em CPL marginal e saturação de frequência.</>}</p>

            <div className="nj-decision">
              <div className="nj-decision-icon"><Sparkles size={17} /></div>
              <div className="nj-decision-text"><small>Próximo passo recomendado</small><strong>Autorizar escala dos vencedores no Meta</strong></div>
              {!approved ? <button onClick={() => setApproved(true)}>Aprovar escala <ArrowRight size={13} style={{ verticalAlign: "middle", marginLeft: 5 }} /></button> : <span style={{ color: "var(--mint)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}><Check size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Aprovado</span>}
            </div>

            <div className="nj-outcomes">
              <div className="nj-metric"><label>Investimento</label><strong>R$ 12.480</strong><small>69,3% do orçamento</small></div>
              <div className="nj-metric"><label>Leads</label><strong>1.842</strong><small>+18,4% vs. semana</small></div>
              <div className="nj-metric"><label>CPL</label><strong>R$ 6,78</strong><small>abaixo da meta</small></div>
              <div className="nj-metric"><label>ROAS</label><strong>4,7x</strong><small>+0,6x em 7 dias</small></div>
            </div>

            <div className="nj-evidence">
              <button className="nj-evidence-toggle" onClick={() => setShowEvidence(!showEvidence)} aria-expanded={showEvidence}><GitBranch size={14} color="var(--violet)" /> Por que o sistema recomenda isso? <span style={{ color: "var(--muted)", fontWeight: 400 }}>3 sinais</span>{showEvidence ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
              {showEvidence && <div className="nj-evidence-body">
                <div className="nj-trace"><Check size={13} color="var(--mint)" /><span><b>Performance:</b> conjunto “Dor — Agenda Lotada” gera 42% dos leads com CPL R$ 5,91.</span></div>
                <div className="nj-trace"><Check size={13} color="var(--mint)" /><span><b>Contexto:</b> Master Plan v12 aprovado pelo Fundador em 18/06. A aprovação foi herdada por Mídia Paga.</span></div>
                <div className="nj-trace"><Info size={13} color="var(--champagne)" /><span><b>Limite:</b> Google Search permanece pausado após CPL subir 26%. Nenhuma verba será movida para lá.</span></div>
                {mode === "arquiteto" && <div className="nj-trace"><code>WEIGHT 0.87</code><span><b>Regra:</b> confidence_gate ≥ 0.80 · budget_shift ≤ 12%</span></div>}
              </div>}
            </div>

            <div className="nj-footer">
              <div className="nj-footer-left"><Fingerprint size={13} /><span>Decisão registrada no log da campanha</span></div>
              <div className="nj-footer-right"><span className="nj-next">Depois disso: Produção começa em 6 min</span><button className="nj-handoff" onClick={() => setHandoff(true)}><MessageSquare size={13} style={{ verticalAlign: "middle", marginRight: 6 }} />Falar com a equipe</button></div>
            </div>
          </section>

          <aside className="nj-pulse" aria-label="Pulso da equipe de IA">
            <div className="nj-pulse-head"><h2>Pulso da equipe<small>O que está acontecendo agora</small></h2><button onClick={() => setView(view === "journey" ? "pulse" : "journey")} aria-label="Alternar visão"><Expand size={15} /></button></div>
            {agents.map(([name, state, initial, color], i) => <div key={name} className={`nj-agent ${i === 1 ? "work" : ""}`}><div className="nj-avatar" style={{ color }}>{initial}</div><div><strong>{name}</strong><small>{state}</small></div>{i === 1 ? <span className="nj-signal" aria-label="Trabalhando" /> : <span className="nj-agent-state">{i === 4 ? "OK" : i === 2 ? "7 posts" : i === 3 ? "12%" : "OK"}</span>}</div>)}
            {paused && <div className="nj-alert" role="status"><AlertTriangle size={15} /><div><strong>Google Search pausado</strong>CPL subiu 26% nas últimas 24h.<br /><button onClick={() => setPaused(false)}>Entendi, ocultar alerta</button></div></div>}
            {!paused && <div style={{ marginTop: 15, color: "var(--muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 7 }}><Pause size={13} /> Alerta ocultado · continua no log</div>}
          </aside>
        </main>
      </div>
      {handoff && <div className="nj-toast" role="status"><Check size={14} style={{ verticalAlign: "middle", marginRight: 7 }} />Pedido enviado. Erick assume em seguida.<button onClick={() => setHandoff(false)} style={{ border: 0, background: "none", color: "#c7efdc", marginLeft: 14, cursor: "pointer" }} aria-label="Fechar"><X size={13} /></button></div>}
    </div>
  );
}

export default GuidedJourney;