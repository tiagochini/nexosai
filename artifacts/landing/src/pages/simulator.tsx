import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Loader2, CheckCircle2, Heart, MessageCircle,
  Send, Bookmark, Music2, ThumbsUp, Share2, Mail, MoreHorizontal,
  ChevronRight, Instagram, Zap, Target, TrendingUp, Users,
  Play, Shield, Clock, Layers,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductType = "curso" | "mentoria" | "evento" | "software" | "comunidade";
type Step = "form" | "loading" | "reveal" | "summary";

interface LeadData {
  firstName: string;
  productName: string;
  productType: ProductType;
  email: string;
  whatsapp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const PRODUCT_LABELS: Record<ProductType, string> = {
  curso: "Curso Digital", mentoria: "Mentoria", evento: "Evento Online",
  software: "Software / SaaS", comunidade: "Comunidade / Clube",
};

function phoneMask(v: string) {
  return v.replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

// ── Day config (what gets shown each day) ─────────────────────────────────────

interface DayConfig {
  day: number;
  phase: string;
  objective: string;
  platform: "tiktok" | "instagram_post" | "instagram_story" | "facebook" | "email" | "whatsapp";
  reachEstimate: number;
  leadsEstimate: number;
  label: string;
  phaseColor: string;
}

const DAY_CONFIGS: DayConfig[] = [
  { day: 0, phase: "Antecipação", objective: "Acionar curiosidade e ativar notificações antes mesmo do lançamento começar", platform: "tiktok", reachEstimate: 8400, leadsEstimate: 126, label: "Dia 0", phaseColor: "text-purple-400" },
  { day: 1, phase: "Autoridade", objective: "Posicionar você como referência máxima no tema antes de qualquer venda", platform: "instagram_story", reachEstimate: 1200, leadsEstimate: 48, label: "Dia 1", phaseColor: "text-blue-400" },
  { day: 2, phase: "Conteúdo de Valor", objective: "Entregar transformação real — o lead sente resultado ANTES de comprar", platform: "instagram_post", reachEstimate: 2800, leadsEstimate: 84, label: "Dia 2", phaseColor: "text-cyan-400" },
  { day: 3, phase: "Prova Social", objective: "Mostrar transformação de quem já passou pelo {produto} — eliminar dúvida", platform: "facebook", reachEstimate: 3200, leadsEstimate: 96, label: "Dia 3", phaseColor: "text-indigo-400" },
  { day: 4, phase: "Desejo Máximo", objective: "Ampliar o desejo sem mostrar preço — criar a sensação de urgência emocional", platform: "email", reachEstimate: 1800, leadsEstimate: 162, label: "Dia 4", phaseColor: "text-orange-400" },
  { day: 5, phase: "🚀 Abertura do Carrinho", objective: "Primeiro momento de venda — VIPs + audiência aquecida + retargeting simultâneo", platform: "tiktok", reachEstimate: 22000, leadsEstimate: 440, label: "Dia 5", phaseColor: "text-success" },
  { day: 6, phase: "Meio do Carrinho", objective: "Superar objeções com prova + escassez progressiva antes do fechamento", platform: "whatsapp", reachEstimate: 680, leadsEstimate: 204, label: "Dia 6", phaseColor: "text-yellow-400" },
  { day: 7, phase: "⚡ Fechamento", objective: "Urgência máxima nas últimas 4 horas — conversão de quem estava em dúvida", platform: "instagram_story", reachEstimate: 1400, leadsEstimate: 168, label: "Dia 7", phaseColor: "text-red-400" },
];

// ── Platform Mockup Components ─────────────────────────────────────────────────

function TikTokMockup({ lead, day }: { lead: LeadData; day: DayConfig }) {
  const hooks: Record<number, string> = {
    0: `POV: você vai descobrir como o ${lead.productName} pode transformar tudo`,
    5: `ABRIU. ${lead.productName} está disponível — 72h pelo preço de lançamento`,
  };
  const hook = hooks[day.day] ?? `${lead.productName} — o que vem por aí vai mudar o jogo`;
  const caption = day.day === 0
    ? `Algo diferente está chegando... ${lead.productName} abre em 7 dias. Segue para não perder 🔥`
    : `${lead.productName} acabou de abrir. Fecha em 72h. Link na bio 👆`;
  const likes = fmtNum(Math.round(day.reachEstimate * 0.09));
  const comments = fmtNum(Math.round(day.reachEstimate * 0.009));

  return (
    <div className="relative mx-auto overflow-hidden shadow-2xl"
         style={{ width: 200, aspectRatio: "9/16", borderRadius: 16, background: "linear-gradient(160deg, #0d0d1a 0%, #1a0a2e 40%, #0a1a2e 100%)" }}>
      {/* Top UI */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
        <div className="flex gap-4 text-[10px] text-white/60 font-sans">
          <span>Seguindo</span>
          <span className="text-white font-bold border-b border-white">Recomendados</span>
        </div>
      </div>
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 50%)" }} />
      {/* Play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Play className="h-12 w-12 text-white" />
      </div>
      {/* Right engagement */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 z-10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-white font-bold text-[9px]">
          {lead.firstName[0]?.toUpperCase()}
        </div>
        {[{ icon: Heart, val: likes }, { icon: MessageCircle, val: comments }, { icon: Share2, val: "→" }].map(({ icon: Icon, val }) => (
          <div key={String(val)} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className="text-[9px] text-white/80 font-semibold">{val}</span>
          </div>
        ))}
      </div>
      {/* Caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3 z-10">
        <div className="text-[10px] font-bold text-white mb-1 leading-tight">"{hook}"</div>
        <div className="text-[9px] text-white/70 leading-relaxed line-clamp-2">{caption}</div>
        <div className="flex items-center gap-1 mt-1">
          <Music2 className="h-2.5 w-2.5 text-white/50" />
          <span className="text-[8px] text-white/50">Música em tendência · ♪</span>
        </div>
      </div>
    </div>
  );
}

function InstagramPostMockup({ lead, day }: { lead: LeadData; day: DayConfig }) {
  const titles: Record<number, string> = {
    2: `Os 3 Pilares do ${lead.productName}`,
  };
  const captions: Record<number, string> = {
    2: `Depois de trabalhar com centenas de alunos, identifiquei os 3 pilares que fazem ${lead.productName} transformar vidas de verdade. Salva esse post — você vai precisar. 📌`,
  };
  const title = titles[day.day] ?? `${lead.productName} — Revelação`;
  const caption = captions[day.day] ?? `${lead.productName} está transformando vidas. Fica aqui essa semana e veja como. 🔥`;
  const likes = fmtNum(Math.round(day.reachEstimate * 0.05));

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mx-auto" style={{ width: 260, fontFamily: "system-ui, sans-serif" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-[9px] font-bold text-gray-800">{lead.firstName[0]?.toUpperCase()}</span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-[11px] text-gray-900">{lead.firstName.toLowerCase().replace(" ", "_")}.creator</div>
            <div className="text-[9px] text-gray-400">Patrocinado</div>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="w-full aspect-square flex items-center justify-center p-4 text-center"
           style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
        <div>
          <div className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Criativo IA</div>
          <div className="text-white font-bold text-sm leading-tight">{title}</div>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex gap-3"><Heart className="h-5 w-5 text-gray-700" /><MessageCircle className="h-5 w-5 text-gray-700" /><Send className="h-5 w-5 text-gray-700" /></div>
        <Bookmark className="h-5 w-5 text-gray-700" />
      </div>
      <div className="px-3 pb-3">
        <div className="text-[11px] font-semibold text-gray-900 mb-0.5">{likes} curtidas</div>
        <div className="text-[11px] text-gray-700 leading-relaxed">
          <span className="font-semibold">{lead.firstName.toLowerCase().replace(" ", "_")}.creator</span> {caption}
        </div>
        <div className="text-[10px] text-blue-500 mt-1">#lançamento #{lead.productName.split(" ")[0]?.toLowerCase()} #digital</div>
      </div>
    </div>
  );
}

function InstagramStoryMockup({ lead, day }: { lead: LeadData; day: DayConfig }) {
  const content = day.day === 1
    ? { title: `Bastidores do ${lead.productName}`, body: "O que vem por aí vai mudar tudo. Ativa as notificações →", cta: "Ver mais" }
    : { title: `⚡ Fecha em 4h`, body: `${lead.productName} — preço de lançamento termina à meia-noite`, cta: "Garantir agora →" };

  return (
    <div className="relative mx-auto overflow-hidden shadow-2xl"
         style={{ width: 160, aspectRatio: "9/16", borderRadius: 16, background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      {/* Progress bars */}
      <div className="absolute top-3 left-2 right-2 flex gap-0.5 z-10">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-0.5 flex-1 rounded-full ${i === 1 ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      {/* Profile */}
      <div className="absolute top-5 left-2 right-2 flex items-center gap-1.5 z-10">
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-[8px]">
          {lead.firstName[0]?.toUpperCase()}
        </div>
        <span className="text-[9px] font-semibold text-white">{lead.firstName.split(" ")[0]}</span>
        <span className="text-[8px] text-white/50">agora</span>
      </div>
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center z-10">
        <div className="text-white font-bold text-[13px] leading-tight mb-2 drop-shadow-lg">{content.title}</div>
        <div className="text-[9px] text-white/70 leading-relaxed mb-3">{content.body}</div>
        <div className="bg-white text-black rounded-full px-3 py-1 text-[9px] font-bold">{content.cta}</div>
      </div>
    </div>
  );
}

function FacebookMockup({ lead }: { lead: LeadData }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mx-auto" style={{ width: 260, fontFamily: "system-ui, sans-serif" }}>
      <div className="flex items-start justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">{lead.firstName[0]?.toUpperCase()}</div>
          <div>
            <div className="font-semibold text-[12px] text-blue-800">{lead.firstName} Creator</div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500"><span>Agora</span><span>·</span><span>🌐</span></div>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="px-3 pb-2 text-[12px] text-gray-800 leading-relaxed">
        Depois de trabalhar com +200 alunos, posso afirmar: quem passa pelo <strong>{lead.productName}</strong> sai com resultados reais. Não é promessa — é o que os dados mostram. 📊
        <br/><br/>
        Quer ver a prova? Deixa um ❤️ que eu mando o resultado direto no direct.
      </div>
      <div className="w-full h-28 flex items-center justify-center"
           style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
        <div className="text-white/40 text-[9px] uppercase tracking-wider">Arte Gerada pela IA</div>
      </div>
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-0.5 text-[10px] text-gray-500"><span>👍❤️😮</span><span className="ml-1">{fmtNum(Math.round(3200 * 0.04))}</span></div>
        <div className="text-[10px] text-gray-500">{fmtNum(38)} comentários</div>
      </div>
      <div className="flex justify-around px-2 py-1">
        {[{ icon: ThumbsUp, label: "Curtir" }, { icon: MessageCircle, label: "Comentar" }, { icon: Share2, label: "Compartilhar" }].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1 px-2 py-1 text-gray-500">
            <Icon className="h-3.5 w-3.5" /><span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmailMockup({ lead }: { lead: LeadData }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mx-auto border border-gray-200" style={{ width: 280, fontFamily: "system-ui, sans-serif" }}>
      {/* Email client header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <Mail className="h-2.5 w-2.5 text-primary" />
          </div>
          <span className="text-[10px] text-gray-500">{lead.firstName.toLowerCase()}@gmail.com</span>
        </div>
        <div className="font-bold text-[12px] text-gray-900">Por que o {lead.productName} pode mudar tudo para você</div>
        <div className="text-[9px] text-gray-400 mt-0.5">De: {lead.firstName} Creator &lt;contato@nexos.ai&gt;</div>
      </div>
      {/* Email body */}
      <div className="px-4 py-3">
        <div className="text-[11px] text-gray-700 leading-relaxed mb-3">
          Olá <strong>{lead.firstName}</strong>,<br/><br/>
          Você chegou até aqui porque sabe que algo precisa mudar.<br/><br/>
          O <strong>{lead.productName}</strong> foi criado para pessoas exatamente como você — que têm o conhecimento, têm o produto, mas não conseguem transformar isso em resultado consistente.<br/><br/>
          Amanhã eu vou mostrar algo que vai deixar tudo mais claro.
        </div>
        <div className="bg-primary text-white text-[11px] font-bold text-center py-2.5 rounded-lg">
          Quero ver o que vem por aí →
        </div>
        <div className="text-[9px] text-gray-400 text-center mt-2">
          Você está recebendo porque se inscreveu em {lead.firstName.split(" ")[0]}.creator
        </div>
      </div>
    </div>
  );
}

function WhatsAppMockup({ lead }: { lead: LeadData }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl mx-auto" style={{ width: 260, background: "#0b141a", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#202c33" }}>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">{lead.firstName[0]?.toUpperCase()}</div>
        <div>
          <div className="text-[12px] font-semibold text-white">{lead.firstName} · VIP</div>
          <div className="text-[9px] text-green-400">online agora</div>
        </div>
      </div>
      {/* Messages */}
      <div className="p-3 space-y-2 min-h-[120px]">
        <div className="flex justify-end">
          <div className="bg-[#005c4b] text-white text-[11px] rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] leading-relaxed">
            ⚡ {lead.firstName.split(" ")[0]}, restam só 4h.<br/><br/>
            O preço de lançamento do <strong>{lead.productName}</strong> fecha à meia-noite de hoje.<br/><br/>
            Se você quer entrar pelo preço especial, agora é a hora 👇
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-[#005c4b] text-white text-[11px] rounded-lg rounded-tr-none px-3 py-2 max-w-[80%]">
            <span className="text-blue-300 underline">nexos.ai/garantir/{lead.productName.split(" ")[0]?.toLowerCase()}</span>
            <div className="text-[9px] text-white/50 text-right mt-0.5">23:58 ✓✓</div>
          </div>
        </div>
      </div>
      {/* Input area */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#202c33" }}>
        <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 text-[10px] text-white/30">Mensagem</div>
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <Send className="h-3 w-3 text-white" />
        </div>
      </div>
    </div>
  );
}

function DayMockup({ lead, day }: { lead: LeadData; day: DayConfig }) {
  if (day.platform === "tiktok") return <TikTokMockup lead={lead} day={day} />;
  if (day.platform === "instagram_post") return <InstagramPostMockup lead={lead} day={day} />;
  if (day.platform === "instagram_story") return <InstagramStoryMockup lead={lead} day={day} />;
  if (day.platform === "facebook") return <FacebookMockup lead={lead} />;
  if (day.platform === "email") return <EmailMockup lead={lead} />;
  if (day.platform === "whatsapp") return <WhatsAppMockup lead={lead} />;
  return null;
}

const PLATFORM_NAMES: Record<DayConfig["platform"], string> = {
  tiktok: "TikTok", instagram_post: "Instagram", instagram_story: "Instagram Story",
  facebook: "Facebook", email: "E-mail", whatsapp: "WhatsApp",
};

// ── AI Loading Animation ───────────────────────────────────────────────────────

const AGENT_STEPS = [
  { role: "Comandante IA", msg: "Analisando estrutura do lançamento...", delay: 0 },
  { role: "Estrategista", msg: "Mapeando posicionamento e audiência ideal...", delay: 700 },
  { role: "Copywriter", msg: "Gerando textos para 4 plataformas...", delay: 1400 },
  { role: "Social Media IA", msg: "Criando calendário de 7 dias com conteúdo visual...", delay: 2100 },
  { role: "Launch Manager", msg: "Estruturando sequência de abertura e fechamento...", delay: 2800 },
  { role: "WhatsApp Agent", msg: "Preparando mensagens VIP por segmento de audiência...", delay: 3400 },
];

function AILoadingStep({ onDone }: { onDone: () => void }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    AGENT_STEPS.forEach((s, i) => {
      setTimeout(() => setActiveIdx(i), s.delay);
    });
    const interval = setInterval(() => setProgress(p => Math.min(p + 2, 100)), 80);
    const done = setTimeout(onDone, 4200);
    return () => { clearInterval(interval); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src={nexosLogo} alt="NexOS AI" className="h-12 w-12 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="font-mono text-sm uppercase tracking-[0.3em] text-primary">IA gerando seu lançamento</div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-1 bg-muted/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/50 text-right">{progress}%</div>
        </div>

        {/* Agent activity */}
        <div className="space-y-3">
          {AGENT_STEPS.map((s, i) => (
            <div key={i} className={`flex items-start gap-3 transition-all duration-500 ${i <= activeIdx ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                i < activeIdx ? "border-success bg-success/20" :
                i === activeIdx ? "border-primary bg-primary/20 animate-pulse" :
                "border-border bg-muted/10"
              }`}>
                {i < activeIdx
                  ? <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                  : i === activeIdx
                  ? <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                  : null}
              </div>
              <div>
                <div className={`font-mono text-[11px] font-bold uppercase tracking-widest ${i <= activeIdx ? "text-foreground" : "text-muted-foreground/30"}`}>{s.role}</div>
                <div className={`font-mono text-[10px] ${i <= activeIdx ? "text-muted-foreground/70" : "text-muted-foreground/20"}`}>{s.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day Reveal Step ───────────────────────────────────────────────────────────

function DayRevealStep({ lead, onFinish }: { lead: LeadData; onFinish: () => void }) {
  const [currentDay, setCurrentDay] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const day = DAY_CONFIGS[currentDay]!;
  const isLast = currentDay === DAY_CONFIGS.length - 1;

  useEffect(() => {
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 80);
    return () => clearTimeout(t);
  }, [currentDay]);

  const advance = () => {
    if (animating) return;
    if (isLast) { onFinish(); return; }
    setAnimating(true);
    setTimeout(() => { setCurrentDay(d => d + 1); setAnimating(false); }, 300);
  };

  const totalReach = DAY_CONFIGS.slice(0, currentDay + 1).reduce((s, d) => s + d.reachEstimate, 0);
  const totalLeads = DAY_CONFIGS.slice(0, currentDay + 1).reduce((s, d) => s + d.leadsEstimate, 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-card/40 px-4 py-3 sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Simulação — <span className="text-primary">{lead.productName}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/50">
              {currentDay + 1} / {DAY_CONFIGS.length}
            </div>
          </div>
          {/* Day timeline */}
          <div className="flex items-center gap-1">
            {DAY_CONFIGS.map((d, i) => (
              <button
                key={i}
                onClick={() => { if (i <= currentDay) { setCurrentDay(i); } }}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  i < currentDay ? "bg-success" :
                  i === currentDay ? "bg-primary" :
                  "bg-muted/30"
                } ${i <= currentDay ? "cursor-pointer" : "cursor-not-allowed"}`}
                title={d.label}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-muted-foreground/40">Dia 0</span>
            <span className="font-mono text-[9px] text-muted-foreground/40">Dia 7</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" ref={contentRef}>
          {/* Day header */}
          <div className={`transition-all duration-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="border border-primary/40 bg-primary/10 px-2 py-0.5">
                <span className="font-mono text-[10px] text-primary uppercase tracking-widest">{day.label}</span>
              </div>
              <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${day.phaseColor}`}>{day.phase}</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{day.objective}</p>
          </div>

          {/* Platform badge */}
          <div className={`transition-all duration-500 delay-100 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                Publicando em <span className="text-foreground font-bold">{PLATFORM_NAMES[day.platform]}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/40">· gerado pela IA</span>
            </div>
          </div>

          {/* The mockup */}
          <div className={`transition-all duration-600 delay-200 flex justify-center ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
            <DayMockup lead={lead} day={day} />
          </div>

          {/* Metrics */}
          <div className={`transition-all duration-500 delay-300 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-cyan-400/30 bg-cyan-400/5 px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Alcance estimado</div>
                <div className="font-mono text-lg font-bold text-cyan-400">{fmtNum(day.reachEstimate)}</div>
                <div className="font-mono text-[10px] text-muted-foreground/50">pessoas vão ver isso</div>
              </div>
              <div className="border border-success/30 bg-success/5 px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Leads esperados</div>
                <div className="font-mono text-lg font-bold text-success">~{day.leadsEstimate}</div>
                <div className="font-mono text-[10px] text-muted-foreground/50">leads captados</div>
              </div>
            </div>
            {/* Cumulative */}
            <div className="mt-2 border border-border/30 bg-muted/5 px-3 py-2 flex justify-between items-center">
              <span className="font-mono text-[10px] text-muted-foreground/60">Acumulado até aqui:</span>
              <div className="flex gap-4">
                <span className="font-mono text-[10px] text-cyan-400">{fmtNum(totalReach)} alcance</span>
                <span className="font-mono text-[10px] text-success">~{totalLeads} leads</span>
              </div>
            </div>
          </div>

          {/* Auto delivery note */}
          <div className={`transition-all duration-500 delay-400 ${revealed ? "opacity-100" : "opacity-0"}`}>
            <div className="border border-primary/20 bg-primary/5 px-3 py-2 flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
                <span className="text-primary font-bold">Automático.</span> A IA agenda, publica e envia esse conteúdo no horário exato de maior engajamento — sem você precisar estar online.
              </p>
            </div>
          </div>

          {/* Next button */}
          <div className={`transition-all duration-500 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <button
              onClick={advance}
              className="w-full h-14 font-mono uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-2 transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)",
                color: "white",
                borderRadius: 4,
              }}
            >
              {isLast ? (
                <><Zap className="h-4 w-4" />Ver resumo do meu lançamento</>
              ) : (
                <>Ver {DAY_CONFIGS[currentDay + 1]?.label} — {DAY_CONFIGS[currentDay + 1]?.phase} <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
            {currentDay > 0 && (
              <button onClick={() => setCurrentDay(d => d - 1)} className="w-full mt-2 text-center font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors py-1">
                ← Voltar para {DAY_CONFIGS[currentDay - 1]?.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Summary + CTA Step ─────────────────────────────────────────────────────────

function SummaryStep({ lead }: { lead: LeadData }) {
  const totalReach = DAY_CONFIGS.reduce((s, d) => s + d.reachEstimate, 0);
  const totalLeads = DAY_CONFIGS.reduce((s, d) => s + d.leadsEstimate, 0);
  const totalPieces = 21;
  const manualHours = 23;

  const signupUrl = `/app/register?ref=sim&nome=${encodeURIComponent(lead.firstName)}&email=${encodeURIComponent(lead.email)}&produto=${encodeURIComponent(lead.productName)}&tipo=${lead.productType}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative px-6 py-16 text-center overflow-hidden" style={{ background: "linear-gradient(160deg, #0d0d1a 0%, #1a0a2e 40%, #0a1a2e 100%)" }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 border border-success/40 bg-success/10 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />Simulação Concluída
          </div>
          <h1 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tighter leading-tight">
            Seu lançamento de<br />
            <span className="text-primary">{lead.productName}</span><br />
            está simulado.
          </h1>
          <p className="font-mono text-sm text-muted-foreground/80 leading-relaxed">
            Isso foi gerado em <strong className="text-foreground">4 segundos</strong>.<br />
            Manualmente levaria <strong className="text-foreground">{manualHours} horas</strong> de trabalho.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Peças de conteúdo", value: String(totalPieces), sub: "prontas para publicar", color: "text-primary" },
            { label: "Plataformas cobertas", value: "5", sub: "Instagram · TikTok · FB · Email · WhatsApp", color: "text-purple-400" },
            { label: "Alcance estimado", value: fmtNum(totalReach), sub: "pessoas no total", color: "text-cyan-400" },
            { label: "Leads esperados", value: `~${fmtNum(totalLeads)}`, sub: "ao longo de 7 dias", color: "text-success" },
          ].map(k => (
            <div key={k.label} className="border border-border/50 bg-card/40 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{k.label}</div>
              <div className={`font-mono text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Timeline mini view */}
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Fluxo completo do lançamento</div>
          <div className="space-y-2">
            {DAY_CONFIGS.map(d => (
              <div key={d.day} className="flex items-center gap-3 border border-border/30 bg-card/20 px-3 py-2">
                <div className="w-7 h-7 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-mono text-[10px] text-primary font-bold">{d.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-[11px] font-bold uppercase tracking-widest ${d.phaseColor} leading-tight`}>{d.phase}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 truncate">{PLATFORM_NAMES[d.platform]} · {fmtNum(d.reachEstimate)} alcance</div>
                </div>
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* The catch */}
        <div className="border border-primary/30 bg-primary/5 px-5 py-4 space-y-3">
          <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">O que essa simulação não mostra</div>
          {[
            "Copywriting personalizado com sua voz e seu posicionamento",
            "Segmentação inteligente por temperatura de audiência (quente / morno / frio)",
            "Agendamento automático nos horários de maior engajamento",
            "WhatsApp + Email disparados automaticamente no momento exato",
            "Análise de performance em tempo real e otimização contínua por IA",
            "Sequências de recuperação de carrinho abandonado",
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed">{item}</span>
            </div>
          ))}
          <p className="font-mono text-[11px] text-primary font-bold">Tudo isso acontece dentro da NexOS AI, automaticamente.</p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <a href={signupUrl} className="block w-full">
            <button className="w-full h-16 font-mono uppercase tracking-widest text-base font-black flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4 }}>
              <Zap className="h-5 w-5" />
              Quero lançar {lead.productName} de verdade
              <ArrowRight className="h-5 w-5" />
            </button>
          </a>
          <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Sem cartão agora</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Começa em minutos</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3" />Campanha já iniciada</span>
          </div>
        </div>

        {/* Footer nudge */}
        <div className="border border-border/30 bg-muted/5 px-4 py-3 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
          <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">
            Quando você criar sua conta, a campanha do <strong className="text-foreground">{lead.productName}</strong> já vai estar pré-configurada com os dados da sua simulação.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Lead Form Step ─────────────────────────────────────────────────────────────

function LeadFormStep({ onSubmit }: { onSubmit: (data: LeadData) => void }) {
  const [form, setForm] = useState<LeadData>({ firstName: "", productName: "", productType: "curso", email: "", whatsapp: "" });
  const [errors, setErrors] = useState<Partial<LeadData>>({});

  const set = (k: keyof LeadData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = k === "whatsapp" ? phoneMask(e.target.value) : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    setErrors(er => ({ ...er, [k]: "" }));
  };

  const validate = () => {
    const e: Partial<LeadData> = {};
    if (!form.firstName.trim()) e.firstName = "Obrigatório";
    if (!form.productName.trim()) e.productName = "Obrigatório";
    if (!form.email.includes("@")) e.email = "E-mail inválido";
    if (form.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "WhatsApp inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    // Save to localStorage for app pre-fill
    localStorage.setItem("nexos_simulator_data", JSON.stringify({
      ...form,
      simulatedAt: new Date().toISOString(),
    }));
    onSubmit(form);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <div className="border-b border-border/40 px-6 h-16 flex items-center gap-3">
        <img src={nexosLogo} alt="NexOS" className="h-8 w-8 object-contain" style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.6))" }} />
        <div className="font-mono font-black text-base tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
        <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Simulador de Lançamento</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Hook */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Simulação gratuita · 60 segundos
            </div>
            <h1 className="text-3xl font-mono font-black uppercase tracking-tighter leading-tight">
              Veja como ficaria<br />
              seu lançamento<br />
              <span className="text-primary">com IA</span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
              Sem orçamento. Sem promessas. Só as <strong className="text-foreground">entregas reais</strong> que a IA geraria para o seu produto.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-4">
            {[
              { icon: Layers, val: "21 peças", label: "de conteúdo" },
              { icon: Users, val: "5 plataformas", label: "cobertas" },
              { icon: TrendingUp, val: "7 dias", label: "de lançamento" },
            ].map(k => (
              <div key={k.label} className="flex flex-col items-center gap-0.5">
                <k.icon className="h-3.5 w-3.5 text-primary mb-0.5" />
                <span className="font-mono text-[11px] font-bold text-foreground">{k.val}</span>
                <span className="font-mono text-[9px] text-muted-foreground/50">{k.label}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Nome do Produto *</label>
                <input
                  value={form.productName}
                  onChange={set("productName")}
                  placeholder="Ex: Método Lança Fácil"
                  className="w-full h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 transition-colors"
                />
                {errors.productName && <div className="font-mono text-[10px] text-destructive mt-0.5">{errors.productName}</div>}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Tipo *</label>
                <select
                  value={form.productType}
                  onChange={set("productType") as React.ChangeEventHandler<HTMLSelectElement>}
                  className="w-full h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground transition-colors"
                >
                  {(Object.entries(PRODUCT_LABELS) as [ProductType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Seu nome *</label>
                <input
                  value={form.firstName}
                  onChange={set("firstName")}
                  placeholder="João"
                  className="w-full h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 transition-colors"
                />
                {errors.firstName && <div className="font-mono text-[10px] text-destructive mt-0.5">{errors.firstName}</div>}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="joao@email.com"
                  className="w-full h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 transition-colors"
                />
                {errors.email && <div className="font-mono text-[10px] text-destructive mt-0.5">{errors.email}</div>}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">WhatsApp *</label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  placeholder="(11) 99999-9999"
                  className="w-full h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 transition-colors"
                />
                {errors.whatsapp && <div className="font-mono text-[10px] text-destructive mt-0.5">{errors.whatsapp}</div>}
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-14 font-mono uppercase tracking-widest text-sm font-black flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4 }}
            >
              <Play className="h-4 w-4" />
              Simular meu lançamento agora
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <Shield className="h-3 w-3" />
              Sem spam · Seus dados são privados
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Simulator Page ────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [step, setStep] = useState<Step>("form");
  const [lead, setLead] = useState<LeadData | null>(null);

  // Pre-fill from URL query params (for WhatsApp/Telegram links with lead data)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nome = params.get("nome");
    const produto = params.get("produto");
    const email = params.get("email");
    const tel = params.get("tel");
    if (nome && produto) {
      setLead({ firstName: nome, productName: produto, productType: "curso", email: email ?? "", whatsapp: tel ?? "" });
      if (email && tel) setStep("loading");
    }
  }, []);

  const handleFormSubmit = (data: LeadData) => {
    setLead(data);
    setStep("loading");
  };

  const handleLoadingDone = () => setStep("reveal");
  const handleRevealDone = () => setStep("summary");

  if (step === "form") return <LeadFormStep onSubmit={handleFormSubmit} />;
  if (step === "loading") return <AILoadingStep onDone={handleLoadingDone} />;
  if (step === "reveal" && lead) return <DayRevealStep lead={lead} onFinish={handleRevealDone} />;
  if (step === "summary" && lead) return <SummaryStep lead={lead} />;
  return <LeadFormStep onSubmit={handleFormSubmit} />;
}
