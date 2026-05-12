import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Loader2, CheckCircle2, Heart, MessageCircle,
  Send, Bookmark, Music2, ThumbsUp, Share2, Mail, MoreHorizontal,
  ChevronRight, Zap, TrendingUp, Users,
  Play, Shield, Clock, Layers, MessageSquare, ShoppingCart, ExternalLink,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

// ── API helpers ───────────────────────────────────────────────────────────────

interface SimulatorConfig {
  cartOpen: boolean;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

async function fetchSimulatorConfig(): Promise<SimulatorConfig> {
  try {
    const res = await fetch("/api/simulator/config");
    if (!res.ok) throw new Error("config fetch failed");
    return await res.json() as SimulatorConfig;
  } catch {
    return { cartOpen: false, checkoutUrl: null, whatsappUrl: null, telegramUrl: null };
  }
}

async function postSimulatorLead(lead: LeadData): Promise<void> {
  try {
    await fetch("/api/simulator/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch {
    // Never break the UX over a save failure
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductType =
  | "curso" | "mentoria" | "evento" | "software" | "comunidade"
  | "produto_fisico" | "servico" | "academia" | "saude_beleza"
  | "loja_virtual" | "livro" | "podcast" | "outro";
type Step = "form" | "briefing" | "confirm" | "launching" | "reveal" | "summary";

interface LeadData {
  firstName: string;
  productName: string;
  productType: ProductType;
  email: string;
  whatsapp: string;
  countryCode: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const PRODUCT_LABELS: Record<ProductType, string> = {
  curso:          "Curso Digital",
  mentoria:       "Mentoria",
  evento:         "Evento Online",
  software:       "Software / SaaS",
  comunidade:     "Comunidade / Clube",
  produto_fisico: "Produto Físico",
  servico:        "Serviço / Consultoria",
  academia:       "Academia / Fitness",
  saude_beleza:   "Saúde e Beleza",
  loja_virtual:   "Loja Virtual / E-commerce",
  livro:          "Livro / E-book",
  podcast:        "Podcast / Áudio",
  outro:          "Outro",
};

const COUNTRY_CODES = [
  { code: "+55",  label: "🇧🇷 +55"  },
  { code: "+1",   label: "🇺🇸 +1"   },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+34",  label: "🇪🇸 +34"  },
  { code: "+54",  label: "🇦🇷 +54"  },
  { code: "+56",  label: "🇨🇱 +56"  },
  { code: "+57",  label: "🇨🇴 +57"  },
  { code: "+52",  label: "🇲🇽 +52"  },
  { code: "+598", label: "🇺🇾 +598" },
  { code: "+595", label: "🇵🇾 +595" },
  { code: "+591", label: "🇧🇴 +591" },
  { code: "+593", label: "🇪🇨 +593" },
  { code: "+51",  label: "🇵🇪 +51"  },
  { code: "+58",  label: "🇻🇪 +58"  },
  { code: "+44",  label: "🇬🇧 +44"  },
  { code: "+49",  label: "🇩🇪 +49"  },
  { code: "+33",  label: "🇫🇷 +33"  },
  { code: "+39",  label: "🇮🇹 +39"  },
  { code: "+61",  label: "🇦🇺 +61"  },
  { code: "+81",  label: "🇯🇵 +81"  },
  { code: "+27",  label: "🇿🇦 +27"  },
  { code: "+971", label: "🇦🇪 +971" },
];

function phoneMask(v: string, countryCode = "+55") {
  const d = v.replace(/\D/g, "");
  if (countryCode === "+55") {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }
  return d.slice(0, 15);
}

// ── Day config (what gets shown each day) ─────────────────────────────────────

interface DayConfig {
  day: number;
  phase: string;
  phaseColor: string;
  reachEstimate: number;
  leadsEstimate: number;
  groupJoins: number;
  report: string;
  label: string;
}

const DAY_CONFIGS: DayConfig[] = [
  { day: 0, phase: "Antecipação",          phaseColor: "text-purple-400", reachEstimate: 8400,  leadsEstimate: 126, groupJoins: 89,  label: "Dia 0", report: "Primeira onda orgânica. TikTok atingiu 8.4k impressões. Audiência começando a esquentar — grupo VIP enchendo." },
  { day: 1, phase: "Autoridade",           phaseColor: "text-blue-400",   reachEstimate: 1200,  leadsEstimate: 48,  groupJoins: 41,  label: "Dia 1", report: "Posicionamento estabelecido. Stories com 38% de resposta. Novos seguidores orgânicos subindo." },
  { day: 2, phase: "Conteúdo de Valor",    phaseColor: "text-cyan-400",   reachEstimate: 2800,  leadsEstimate: 84,  groupJoins: 62,  label: "Dia 2", report: "Post educativo com 7.2% de salvamentos. Audiência engajando forte — comentários pedindo mais conteúdo." },
  { day: 3, phase: "Prova Social",         phaseColor: "text-indigo-400", reachEstimate: 3200,  leadsEstimate: 96,  groupJoins: 73,  label: "Dia 3", report: "Prova social gerando confiança. CTR 4.1% acima da média do segmento. Objeções caindo." },
  { day: 4, phase: "Desejo Máximo",        phaseColor: "text-orange-400", reachEstimate: 1800,  leadsEstimate: 162, groupJoins: 118, label: "Dia 4", report: "E-mail de desejo enviado para 1.8k leads. Taxa de abertura 38%. Grupo VIP com 312 membros ativos." },
  { day: 5, phase: "Abertura do Carrinho", phaseColor: "text-success",    reachEstimate: 22000, leadsEstimate: 440, groupJoins: 312, label: "Dia 5", report: "CARRINHO ABERTO. 22k alcance simultâneo. Primeiras vendas chegando. Retargeting ativo em todas as plataformas." },
  { day: 6, phase: "Meio do Carrinho",     phaseColor: "text-yellow-400", reachEstimate: 680,   leadsEstimate: 204, groupJoins: 178, label: "Dia 6", report: "Sequência de objeções disparada. WhatsApp VIP com 87% leitura. Escassez progressiva ativada." },
  { day: 7, phase: "Fechamento",           phaseColor: "text-red-400",    reachEstimate: 1400,  leadsEstimate: 168, groupJoins: 142, label: "Dia 7", report: "ÚLTIMA CHANCE. Urgência máxima em todas as plataformas. Last call disparado. Conversão final em andamento." },
  { day: 8, phase: "Remarketing · Oferta Final", phaseColor: "text-orange-500", reachEstimate: 4200, leadsEstimate: 89, groupJoins: 0, label: "Dia 8", report: "Segmento de quem visitou mas não comprou reativado (est. 1.240 pessoas). Produto reofertado sem bônus e sem onboarding ao vivo — só acesso ao conteúdo, preço reduzido. Sequência de e-mail exclusiva para esse segmento." },
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

// ── AI Briefing Animation ──────────────────────────────────────────────────────

const BRIEFING_STEPS = [
  { label: "Comandante IA",   msg: "Lendo briefing do produto...",                            delay: 0    },
  { label: "Estrategista",    msg: "Analisando mercado e posicionamento ideal...",            delay: 600  },
  { label: "Data Analyst",    msg: "Calculando potencial de audiência e receita...",          delay: 1200 },
  { label: "Copywriter IA",   msg: "Gerando copy personalizado para 7 dias...",               delay: 1800 },
  { label: "Social Media IA", msg: "Criando calendário: TikTok · Instagram · Facebook...",   delay: 2400 },
  { label: "Launch Manager",  msg: "Estruturando abertura e fechamento do carrinho...",       delay: 3000 },
  { label: "WhatsApp Agent",  msg: "Preparando sequências de aquecimento VIP...",             delay: 3600 },
  { label: "Compliance IA",   msg: "Validando estratégia e autorizando execução...",          delay: 4200 },
];

function BriefingStep({ lead, onDone }: { lead: LeadData; onDone: () => void }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    BRIEFING_STEPS.forEach((s, i) => { setTimeout(() => setActiveIdx(i), s.delay); });
    const iv = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(iv); return 100; } return Math.min(p + 1.8, 100); }), 80);
    setTimeout(() => setShowCta(true), 4900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={nexosLogo} alt="NEXOS AI" className="h-12 w-12 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.7))" }} />
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">Analisando briefing</div>
          <div className="font-mono text-xl font-black uppercase tracking-tighter text-foreground">{lead.productName}</div>
          <div className="font-mono text-[11px] text-muted-foreground/50">{PRODUCT_LABELS[lead.productType]}</div>
        </div>
        <div className="space-y-1.5">
          <div className="h-1 bg-muted/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground/40">
            <span>Processando</span><span>{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {BRIEFING_STEPS.map((s, i) => (
            <div key={i} className={`flex items-start gap-3 transition-all duration-500 ${i <= activeIdx ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${
                i < activeIdx  ? "border-success bg-success/20" :
                i === activeIdx ? "border-primary bg-primary/20 animate-pulse" :
                "border-border/30 bg-muted/10"
              }`}>
                {i < activeIdx  ? <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                : i === activeIdx ? <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                : null}
              </div>
              <div>
                <div className={`font-mono text-[10px] font-bold uppercase tracking-widest ${i <= activeIdx ? "text-foreground" : "text-muted-foreground/25"}`}>{s.label}</div>
                <div className={`font-mono text-[10px] ${i <= activeIdx ? "text-muted-foreground/65" : "text-muted-foreground/20"}`}>{s.msg}</div>
              </div>
            </div>
          ))}
        </div>
        {showCta && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <button onClick={onDone} className="w-full font-mono uppercase tracking-widest text-sm font-black flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4, height: "52px" }}>
              <CheckCircle2 className="h-4 w-4" />Ver plano gerado →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Confirm Step ───────────────────────────────────────────────────────────

const PLAN_LINES = [
  { icon: "📅", label: "DURAÇÃO",               value: "7 dias de campanha" },
  { icon: "📱", label: "REDES SOCIAIS",          value: "TikTok · Instagram · Facebook" },
  { icon: "🔁", label: "PUBLICAÇÕES",            value: "2 por dia em cada plataforma — 42 no total" },
  { icon: "⏰", label: "HORÁRIO DINÂMICO",       value: "IA otimiza envio pelo engajamento em tempo real" },
  { icon: "📊", label: "ANÁLISE DE ENTREGÁVEIS", value: "Poder de conversão calculado por peça gerada" },
  { icon: "🎯", label: "SEGMENTAÇÃO",            value: "Audiência quente · morna · fria com copy distinto" },
];

function ConfirmStep({ lead, onAuthorize }: { lead: LeadData; onAuthorize: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);
  useEffect(() => { PLAN_LINES.forEach((_, i) => setTimeout(() => setLineIdx(i + 1), 200 + i * 220)); }, []);
  const allRevealed = lineIdx >= PLAN_LINES.length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <img src={nexosLogo} alt="" className="h-8 w-8 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">NEXOS AI · Comandante</div>
            <div className="font-mono text-[11px] text-muted-foreground/60">Briefing processado com sucesso</div>
          </div>
          <div className="ml-auto border border-success/40 bg-success/10 px-2 py-0.5">
            <span className="font-mono text-[9px] text-success uppercase tracking-widest">✓ Aprovado</span>
          </div>
        </div>
        <div className="border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in duration-500">
          <p className="font-mono text-xs text-foreground/80 leading-relaxed">
            Analisei o <strong className="text-foreground">{lead.productName}</strong> e estruturei a campanha completa. Aqui está o que a NEXOS AI vai executar automaticamente. Confirme para iniciar.
          </p>
        </div>
        <div className="border border-border/40 bg-card/30 divide-y divide-border/30">
          {PLAN_LINES.map((line, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 transition-all duration-400 ${i < lineIdx ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>
              <span className="text-base shrink-0 mt-0.5">{line.icon}</span>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">{line.label}</div>
                <div className="font-mono text-[12px] text-foreground font-medium">{line.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className={`border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 transition-all duration-500 ${allRevealed ? "opacity-100" : "opacity-0"}`}>
          <p className="font-mono text-[11px] text-yellow-300/80 leading-relaxed">
            Ao autorizar, a NEXOS AI iniciará a execução automática. Conteúdo será gerado e agendado nas plataformas conectadas conforme o calendário.
          </p>
        </div>
        <div className={`transition-all duration-500 ${allRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <button onClick={onAuthorize}
            className="w-full font-mono uppercase tracking-widest text-base font-black flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4, height: "64px" }}>
            <Zap className="h-5 w-5" />
            Autorizar Lançamento
            <ArrowRight className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Shield className="h-3 w-3 text-muted-foreground/30" />
            <span className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest">Simulação · Nenhum dado real será publicado</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Launching Step ─────────────────────────────────────────────────────────────

const LAUNCH_STEPS = [
  { msg: "Conectando ao TikTok...",             delay: 0    },
  { msg: "Conectando ao Instagram...",           delay: 900  },
  { msg: "Conectando ao Facebook...",            delay: 1800 },
  { msg: "Criando grupos de aquecimento...",     delay: 2700 },
  { msg: "Agendando 42 publicações...",          delay: 3600 },
  { msg: "Ativando automações de WhatsApp...",   delay: 4500 },
];

function LaunchingStep({ lead, onDone }: { lead: LeadData; onDone: () => void }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    LAUNCH_STEPS.forEach((s, i) => { setTimeout(() => setActiveIdx(i), s.delay + 300); });
    setTimeout(() => setLaunched(true), 5600);
    const t = setTimeout(onDone, 6400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <img src={nexosLogo} alt="" className="h-14 w-14 object-contain mx-auto animate-pulse"
            style={{ filter: "drop-shadow(0 0 22px hsl(var(--primary)/0.9))" }} />
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
            {launched ? "Lançamento Iniciado" : "Iniciando lançamento..."}
          </div>
          {!launched && <div className="font-mono text-[11px] text-muted-foreground/50">Autorizado por {lead.firstName}</div>}
        </div>
        {launched ? (
          <div className="animate-in fade-in zoom-in-95 duration-600 space-y-4">
            <div className="border border-success/50 bg-success/10 px-5 py-5">
              <div className="font-mono text-lg font-black uppercase tracking-widest text-success mb-1">✓ LANÇAMENTO INICIADO</div>
              <div className="font-mono text-[11px] text-muted-foreground/60">{lead.productName}</div>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest animate-pulse">
              Carregando DIA 0...
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 text-left">
            {LAUNCH_STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-400 ${i <= activeIdx ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  i < activeIdx  ? "border-success bg-success/20" :
                  i === activeIdx ? "border-primary bg-primary/20 animate-pulse" :
                  "border-border/30"
                }`}>
                  {i < activeIdx  ? <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                  : i === activeIdx ? <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                  : null}
                </div>
                <div className={`font-mono text-[11px] ${i <= activeIdx ? "text-foreground" : "text-muted-foreground/20"}`}>{s.msg}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Day Reveal Step ───────────────────────────────────────────────────────────

function DayRevealStep({ lead, onFinish }: { lead: LeadData; onFinish: () => void }) {
  const [currentDay, setCurrentDay] = useState(0);
  const [revealedPosts, setRevealedPosts] = useState(0);
  const [showLeads, setShowLeads] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [animLeads, setAnimLeads] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const day = DAY_CONFIGS[currentDay]!;
  const isLast = currentDay === DAY_CONFIGS.length - 1;

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRevealedPosts(0);
    setShowLeads(false);
    setShowReport(false);
    setAnimLeads(0);

    const add = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timersRef.current.push(t); };

    add(() => setRevealedPosts(1), 300);
    add(() => setRevealedPosts(2), 1100);
    add(() => setRevealedPosts(3), 1900);
    add(() => setShowLeads(true), 2700);
    add(() => setShowReport(true), 3500);

    const target = day.leadsEstimate;
    add(() => {
      let count = 0;
      const iv = setInterval(() => {
        count = Math.min(count + Math.ceil(target / 25), target);
        setAnimLeads(count);
        if (count >= target) clearInterval(iv);
      }, 40);
    }, 2700);

    return () => { timersRef.current.forEach(clearTimeout); };
  }, [currentDay, day.leadsEstimate]);

  const totalLeads = DAY_CONFIGS.slice(0, currentDay + 1).reduce((s, d) => s + d.leadsEstimate, 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-card/40 px-4 py-3 sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate max-w-[60%]">
              <span className="text-primary">{lead.productName}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/50">DIA {currentDay} / 7</div>
          </div>
          <div className="flex gap-0.5">
            {DAY_CONFIGS.map((d, i) => (
              <button key={i}
                onClick={() => i <= currentDay && setCurrentDay(i)}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  i < currentDay ? "bg-success" : i === currentDay ? "bg-primary" : "bg-muted/30"
                } ${i <= currentDay ? "cursor-pointer" : "cursor-not-allowed"}`}
                title={`Dia ${d.day} · ${d.phase}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* Day header */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="border border-primary/50 bg-primary/10 px-3 py-1">
                <span className="font-mono text-sm text-primary font-black uppercase tracking-widest">DIA {day.day}</span>
              </div>
              <span className={`font-mono text-[13px] font-bold uppercase tracking-widest ${day.phaseColor}`}>{day.phase}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                {day.day === 8
                  ? <>Segmento: <strong className="text-foreground">não-compradores</strong> · via TikTok · Instagram · Facebook</>
                  : <>Publicando em <strong className="text-foreground">TikTok · Instagram · Facebook</strong> · 2 horários por plataforma</>}
              </span>
            </div>
          </div>

          {/* Remarketing degraded-offer card (Day 8 only) */}
          {day.day === 8 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-600 border border-orange-500/30 bg-orange-500/5 px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-orange-400 font-bold">Oferta degradada · só para não-compradores</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground/75 leading-relaxed">
                A NEXOS AI segmenta automaticamente quem viu mas não comprou e relança o produto com um pacote menor — preço reduzido, sem os bônus do lançamento original.
              </p>
              <div className="space-y-1.5">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2">O que foi removido nesta oferta:</div>
                {[
                  { icon: "✗", label: "Onboarding ao vivo",               kept: false },
                  { icon: "✗", label: "Suporte prioritário por WhatsApp",  kept: false },
                  { icon: "✗", label: "Acesso ao grupo exclusivo VIP",     kept: false },
                  { icon: "✓", label: "Acesso ao conteúdo principal",      kept: true  },
                  { icon: "✓", label: "Suporte básico por e-mail",         kept: true  },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] font-bold shrink-0 ${f.kept ? "text-success" : "text-red-400"}`}>{f.icon}</span>
                    <span className={`font-mono text-[11px] ${f.kept ? "text-foreground/80" : "text-muted-foreground/40 line-through"}`}>{f.label}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-orange-500/20 pt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Público-alvo</span>
                <span className="font-mono text-[11px] font-bold text-orange-400">~1.240 visitantes não-compradores</span>
              </div>
            </div>
          )}

          {/* TikTok post */}
          <div className={`transition-all duration-700 ${revealedPosts >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fe2c55] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Publicando em <strong className="text-white">TikTok</strong>
              </span>
              {revealedPosts >= 1 && <span className="ml-auto font-mono text-[9px] text-success">✓ publicado</span>}
            </div>
            <div className="flex justify-center">
              <TikTokMockup lead={lead} day={day} />
            </div>
          </div>

          {/* Instagram post */}
          <div className={`transition-all duration-700 ${revealedPosts >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 animate-pulse" style={{ borderRadius: "50%", background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Publicando em <strong className="text-white">Instagram</strong>
              </span>
              {revealedPosts >= 2 && <span className="ml-auto font-mono text-[9px] text-success">✓ publicado</span>}
            </div>
            <div className="flex justify-center">
              {currentDay >= 5
                ? <InstagramStoryMockup lead={lead} day={day} />
                : <InstagramPostMockup lead={lead} day={day} />}
            </div>
          </div>

          {/* Facebook post */}
          <div className={`transition-all duration-700 ${revealedPosts >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1877F2] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Publicando em <strong className="text-white">Facebook</strong>
              </span>
              {revealedPosts >= 3 && <span className="ml-auto font-mono text-[9px] text-success">✓ publicado</span>}
            </div>
            <div className="flex justify-center">
              <FacebookMockup lead={lead} />
            </div>
          </div>

          {/* Lead activity */}
          {showLeads && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Atividade de leads</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-success/30 bg-success/5 px-3 py-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">Captados hoje</div>
                  <div className="font-mono text-2xl font-black text-success">+{animLeads}</div>
                </div>
                <div className="border border-green-400/30 bg-green-400/5 px-3 py-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">Entradas no grupo</div>
                  <div className="font-mono text-2xl font-black text-green-400">+{Math.round(animLeads * 0.68)}</div>
                  <div className="font-mono text-[8px] text-muted-foreground/40 mt-0.5">WhatsApp · aquecimento</div>
                </div>
              </div>
              <div className="border border-border/30 bg-muted/5 px-3 py-2 flex justify-between items-center">
                <span className="font-mono text-[10px] text-muted-foreground/50">Total acumulado:</span>
                <span className="font-mono text-[11px] font-bold text-success">~{totalLeads} leads</span>
              </div>
            </div>
          )}

          {/* Daily report */}
          {showReport && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="border border-border/40 bg-card/30 px-4 py-4">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
                  <TrendingUp className="h-3 w-3" />Relatório — DIA {day.day}
                </div>
                <p className="font-mono text-[11px] text-foreground/80 leading-relaxed">{day.report}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Alcance", value: fmtNum(day.reachEstimate), color: "text-cyan-400" },
                    { label: "Leads", value: `~${day.leadsEstimate}`, color: "text-success" },
                    { label: "Posts", value: "6", color: "text-primary" },
                  ].map(k => (
                    <div key={k.label} className="border border-border/30 bg-background/40 px-2 py-2 text-center">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/40">{k.label}</div>
                      <div className={`font-mono text-sm font-bold ${k.color}`}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Next day button */}
          {showReport && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8 space-y-2">
              <button onClick={() => isLast ? onFinish() : setCurrentDay(d => d + 1)}
                className="w-full h-14 font-mono uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4 }}>
                {isLast
                  ? <><Zap className="h-4 w-4" />Ver resumo completo do lançamento</>
                  : <>DIA {DAY_CONFIGS[currentDay + 1]?.day} — {DAY_CONFIGS[currentDay + 1]?.phase} <ChevronRight className="h-4 w-4" /></>
                }
              </button>
              {currentDay > 0 && (
                <button onClick={() => setCurrentDay(d => d - 1)}
                  className="w-full text-center font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors py-1.5">
                  ← DIA {DAY_CONFIGS[currentDay - 1]?.day}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Summary + CTA Step ─────────────────────────────────────────────────────────

function SummaryStep({ lead }: { lead: LeadData }) {
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    fetchSimulatorConfig().then(c => { setConfig(c); setLoadingConfig(false); });
  }, []);

  const totalReach = DAY_CONFIGS.reduce((s, d) => s + d.reachEstimate, 0);
  const totalLeads = DAY_CONFIGS.reduce((s, d) => s + d.leadsEstimate, 0);
  const totalPieces = 21;
  const manualHours = 23;
  const signupUrl = `/register?ref=sim&nome=${encodeURIComponent(lead.firstName)}&email=${encodeURIComponent(lead.email)}&produto=${encodeURIComponent(lead.productName)}&tipo=${lead.productType}`;

  const cartOpen = config?.cartOpen ?? false;
  const checkoutUrl = config?.checkoutUrl ?? signupUrl;
  const whatsappUrl = config?.whatsappUrl ?? null;
  const telegramUrl = config?.telegramUrl ?? null;
  const hasGroup = whatsappUrl || telegramUrl;

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
                  <div className="font-mono text-[10px] text-muted-foreground/50 truncate">TikTok · Instagram · Facebook · {fmtNum(d.reachEstimate)} alcance</div>
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

        {/* ── CTA block — cart-aware ── */}
        {loadingConfig ? (
          <div className="h-16 border border-border/30 bg-muted/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        ) : cartOpen ? (
          /* CART OPEN: buy now */
          <div className="space-y-3">
            <div className="border border-success/40 bg-success/5 px-4 py-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
              <span className="font-mono text-[11px] text-success font-bold uppercase tracking-widest">Carrinho aberto agora</span>
            </div>
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
              className="w-full h-16 font-mono uppercase tracking-widest text-base font-black flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(142,76%,36%) 0%, hsl(142,70%,45%) 100%)", color: "white", borderRadius: 4, display: "flex" }}>
              <ShoppingCart className="h-5 w-5" />
              Garantir minha vaga — {lead.productName}
              <ExternalLink className="h-4 w-4" />
            </a>
            <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Pagamento seguro</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Acesso imediato</span>
              <span className="flex items-center gap-1"><Layers className="h-3 w-3" />Campanha já criada</span>
            </div>
            {hasGroup && (
              <div className="pt-2 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 text-center">Ou fique por dentro antes de decidir</div>
                <div className="grid grid-cols-2 gap-2">
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                      className="border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 text-green-400 font-mono text-[11px] font-bold uppercase tracking-widest h-10 flex items-center justify-center gap-2 transition-all">
                      <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                    </a>
                  )}
                  {telegramUrl && (
                    <a href={telegramUrl} target="_blank" rel="noopener noreferrer"
                      className="border border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10 text-blue-400 font-mono text-[11px] font-bold uppercase tracking-widest h-10 flex items-center justify-center gap-2 transition-all">
                      <Send className="h-3.5 w-3.5" />Telegram
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CART CLOSED: join group or get notified */
          <div className="space-y-3">
            <div className="border border-yellow-400/30 bg-yellow-400/5 px-4 py-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold mb-1">Carrinho ainda não aberto</div>
              <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
                O {lead.productName} ainda não está disponível para venda. Entre no grupo VIP para ser avisado na hora exata da abertura — com acesso antecipado e condições exclusivas.
              </p>
            </div>
            {hasGroup ? (
              <div className="space-y-2">
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full h-14 font-mono uppercase tracking-widest text-sm font-black flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #128c7e 0%, #25d366 100%)", color: "white", borderRadius: 4, display: "flex" }}>
                    <MessageSquare className="h-5 w-5" />
                    Entrar no grupo VIP — WhatsApp
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
                {telegramUrl && (
                  <a href={telegramUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full h-12 font-mono uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98] border border-blue-400/50 bg-blue-400/10 text-blue-400"
                    style={{ display: "flex", borderRadius: 4 }}>
                    <Send className="h-4 w-4" />
                    Entrar no Telegram
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={() => { window.location.href = signupUrl; }}
                className="w-full h-14 font-mono uppercase tracking-widest text-sm font-black flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(261,80%,60%) 100%)", color: "white", borderRadius: 4 }}>
                <Zap className="h-5 w-5" />
                Criar conta e ser avisado na abertura
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Sem spam</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Acesso antecipado</span>
            </div>
          </div>
        )}

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
  const [form, setForm] = useState<LeadData>({ firstName: "", productName: "", productType: "curso", email: "", whatsapp: "", countryCode: "+55" });
  const [errors, setErrors] = useState<Partial<LeadData>>({});

  const set = (k: keyof LeadData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = k === "whatsapp" ? phoneMask(e.target.value, form.countryCode) : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    if (k !== "countryCode") setErrors(er => ({ ...er, [k]: "" }));
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
    // Save to backend (fire-and-forget — never blocks the UX)
    void postSimulatorLead(form);
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
              <span className="text-primary">com NEXOS AI</span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
              Sem orçamento. Sem promessas. Só as <strong className="text-foreground">entregas reais</strong> que a NEXOS AI geraria para o seu produto.
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
              <div className="col-span-2">
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
              <div className="col-span-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">WhatsApp *</label>
                <div className="flex gap-1.5">
                  <select
                    value={form.countryCode}
                    onChange={set("countryCode") as React.ChangeEventHandler<HTMLSelectElement>}
                    className="h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-2 font-mono text-xs text-foreground transition-colors shrink-0"
                    style={{ width: "7.5rem" }}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={set("whatsapp")}
                    placeholder={form.countryCode === "+55" ? "(11) 99999-9999" : "número completo"}
                    className="flex-1 h-11 bg-background/60 border border-border/50 focus:border-primary/60 focus:outline-none px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 transition-colors"
                  />
                </div>
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nome = params.get("nome");
    const produto = params.get("produto");
    const email = params.get("email");
    const tel = params.get("tel");
    if (nome && produto) {
      setLead({ firstName: nome, productName: produto, productType: "curso", email: email ?? "", whatsapp: tel ?? "", countryCode: "+55" });
      if (email && tel) setStep("briefing");
    }
  }, []);

  const handleFormSubmit = (data: LeadData) => { setLead(data); setStep("briefing"); postSimulatorLead(data); };

  if (step === "form")                  return <LeadFormStep onSubmit={handleFormSubmit} />;
  if (step === "briefing" && lead)      return <BriefingStep lead={lead} onDone={() => setStep("confirm")} />;
  if (step === "confirm" && lead)       return <ConfirmStep lead={lead} onAuthorize={() => setStep("launching")} />;
  if (step === "launching" && lead)     return <LaunchingStep lead={lead} onDone={() => setStep("reveal")} />;
  if (step === "reveal" && lead)        return <DayRevealStep lead={lead} onFinish={() => setStep("summary")} />;
  if (step === "summary" && lead)       return <SummaryStep lead={lead} />;
  return <LeadFormStep onSubmit={handleFormSubmit} />;
}
