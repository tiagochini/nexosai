import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, MessageSquare, Send, Loader2,
  Lock, Users, ArrowRight, Zap, Star,
  ChevronDown, ChevronUp, Bot, User, Radio,
  Shield, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUiText } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────────
type Segment = "individual" | "agency";
interface ChatMsg { role: "user" | "assistant"; content: string }

// ── Config ────────────────────────────────────────────────────────────────────
// Preencha os links reais dos grupos antes de ativar a campanha:
const GROUP_LINKS: Record<Segment, { whatsapp: string | null; telegram: string | null }> = {
  individual: {
    whatsapp: "https://chat.whatsapp.com/H49MCBiw2x92E8YoQMIRXH",
    telegram:  null,
  },
  agency: {
    whatsapp: "https://chat.whatsapp.com/H49MCBiw2x92E8YoQMIRXH",
    telegram:  null,
  },
};

const SEGMENT_CONFIG = {
  individual: {
    badge: "Lançador Solo",
    groupName: "Grupo dos Fundadores",
    headline: "Você está dentro!",
    sub: "A sua vaga na lista está confirmada. Agora começa a fase mais importante — o aquecimento. Fique no grupo, tire todas as dúvidas com o Jeff, entenda cada detalhe do NexOS. No dia combinado, o carrinho abre por 24 horas e fecha para sempre neste preço.",
    aiGreeting: "Sou Jeff, estou aqui para responder suas dúvidas antes do carrinho abrir.\n\nVocê acabou de garantir sua vaga na lista — isso já coloca você na frente de quem vai tentar entrar no dia da abertura sem ter acompanhado o aquecimento.\n\nAntes de qualquer coisa: você já tentou fazer um lançamento antes, ou ainda está esperando o momento certo para começar?",
    phases: [
      {
        fase: "Fase 1",
        label: "Você está aqui — Aquecimento",
        desc: "Fique no grupo. Assista aos conteúdos exclusivos que vão sair por aqui. Tire cada dúvida com o Jeff. Entenda o que o NexOS faz na prática — não só o que ele é, mas o que ele executa por você. Quanto mais você entender antes do carrinho abrir, mais rápida será a sua decisão.",
        ativo: true,
      },
      {
        fase: "Fase 2",
        label: "Demonstração ao vivo",
        desc: "Antes do carrinho abrir, você vai ver o NexOS funcionando em tempo real — estratégia sendo gerada, copy sendo escrita, sequência sendo montada. Não é promessa. É execução ao vivo.",
        ativo: false,
      },
      {
        fase: "Fase 3",
        label: "Ação final — o momento decisivo",
        desc: "No dia combinado, uma última ação exclusiva para quem acompanhou o aquecimento. Todos os gatilhos pulsando. Tudo que você precisa para tomar a melhor decisão.",
        ativo: false,
      },
      {
        fase: "Fase 4",
        label: "Carrinho aberto — 24h",
        desc: "O carrinho abre uma única vez neste preço. Você tem 24 horas para garantir o acesso de Fundador. Quando o contador chegar a zero, essa condição fecha definitivamente — sem reabertura, sem cupom, sem segunda chance.",
        ativo: false,
        destaque: true,
      },
      {
        fase: "Fase 5",
        label: "Carrinho fechado",
        desc: "Quem não entrou na janela de 24 horas aguarda a próxima turma — sem data prevista — e no preço cheio, sem os benefícios de Fundador.",
        ativo: false,
        alerta: true,
      },
    ],
  },
  agency: {
    badge: "Agência / Gestor",
    groupName: "Grupo das Agências",
    headline: "Você está dentro!",
    sub: "Sua vaga está confirmada. Durante o aquecimento, você vai entender como o NexOS escala lançamentos de múltiplos clientes sem aumentar equipe. Fique no grupo, tire dúvidas com o Jeff. No dia combinado, o carrinho abre por 24 horas.",
    aiGreeting: "Sou Jeff, estou aqui para responder suas dúvidas antes do carrinho abrir.\n\nVocê acabou de confirmar sua vaga na lista de agências — isso já mostra que você está pensando diferente de quem ainda lança no manual.\n\nMe conta: há quanto tempo você sonha em escalar os lançamentos dos seus clientes sem precisar contratar mais ninguém?",
    phases: [
      {
        fase: "Fase 1",
        label: "Você está aqui — Aquecimento",
        desc: "Fique no grupo. Conteúdo exclusivo sobre como agências estão usando agente para executar múltiplos lançamentos simultâneos. Jeff está disponível para responder tudo sobre a operação, planos e ROI esperado.",
        ativo: true,
      },
      {
        fase: "Fase 2",
        label: "Demonstração para agências",
        desc: "Você vai ver na prática como o NexOS gerencia múltiplas campanhas ao mesmo tempo — painel multi-cliente, segmentação por produto e disparos coordenados.",
        ativo: false,
      },
      {
        fase: "Fase 3",
        label: "Ação final — o momento decisivo",
        desc: "Última ação exclusiva para quem acompanhou. Tudo que sua agência precisa ver para tomar a decisão certa.",
        ativo: false,
      },
      {
        fase: "Fase 4",
        label: "Carrinho aberto — 24h",
        desc: "Uma única janela de 24 horas para garantir o acesso no preço de Fundador para agências. Quando fechar, essa condição não volta.",
        ativo: false,
        destaque: true,
      },
      {
        fase: "Fase 5",
        label: "Carrinho fechado",
        desc: "Quem não entrou aguarda próxima turma — sem data prevista — no preço cheio, sem benefícios de Fundador.",
        ativo: false,
        alerta: true,
      },
    ],
  },
};

const PREP_COPY: Record<string, [string, string]> = {
  "Lançador Solo": ["Solo Launcher", "Lanzador individual"],
  "Grupo dos Fundadores": ["Founders Group", "Grupo de fundadores"],
  "Grupo das Agências": ["Agency Group", "Grupo de agencias"],
  "Você está dentro!": ["You're in!", "¡Ya estás dentro!"],
  "Fase 1": ["Phase 1", "Fase 1"], "Fase 2": ["Phase 2", "Fase 2"],
  "Fase 3": ["Phase 3", "Fase 3"], "Fase 4": ["Phase 4", "Fase 4"], "Fase 5": ["Phase 5", "Fase 5"],
  "Você está aqui — Aquecimento": ["You're here — Warm-up", "Estás aquí — Calentamiento"],
  "Demonstração ao vivo": ["Live demonstration", "Demostración en vivo"],
  "Ação final — o momento decisivo": ["Final action — the decisive moment", "Acción final — el momento decisivo"],
  "Carrinho aberto — 24h": ["Cart open — 24 hours", "Carrito abierto — 24 h"],
  "Carrinho fechado": ["Cart closed", "Carrito cerrado"],
  "Demonstração para agências": ["Agency demonstration", "Demostración para agencias"],
  "Agência / Gestor": ["Agency / Manager", "Agencia / Gestor"],
  "Fases do lançamento": ["Launch phases", "Fases del lanzamiento"],
  "O que fazer agora": ["What to do now", "Qué hacer ahora"],
  "Entre no grupo agora": ["Join the group now", "Únete al grupo ahora"],
  "Tire todas as suas dúvidas com o Jeff": ["Ask Jeff anything", "Resuelve todas tus dudas con Jeff"],
  "Aguarde o dia combinado": ["Wait for the scheduled day", "Espera al día acordado"],
  "Decida em 24h": ["Decide within 24 hours", "Decide en 24 h"],
  "Prepare-se agora": ["Get ready now", "Prepárate ahora"],
  "A sua vaga na lista está confirmada. Agora começa a fase mais importante — o aquecimento. Fique no grupo, tire todas as dúvidas com o Jeff, entenda cada detalhe do NexOS. No dia combinado, o carrinho abre por 24 horas e fecha para sempre neste preço.": ["Your place on the list is confirmed. Now the most important phase begins — the warm-up. Stay in the group, ask Jeff anything, and learn every detail about NexOS. On the scheduled day, the cart opens for 24 hours and then closes permanently at this price.", "Tu plaza en la lista está confirmada. Ahora comienza la fase más importante: el calentamiento. Quédate en el grupo, resuelve todas tus dudas con Jeff y conoce cada detalle de NexOS. El día acordado, el carrito se abrirá durante 24 horas y se cerrará para siempre a este precio."],
  "Sou Jeff, estou aqui para responder suas dúvidas antes do carrinho abrir.\n\nVocê acabou de garantir sua vaga na lista — isso já coloca você na frente de quem vai tentar entrar no dia da abertura sem ter acompanhado o aquecimento.\n\nAntes de qualquer coisa: você já tentou fazer um lançamento antes, ou ainda está esperando o momento certo para começar?": ["I'm Jeff, here to answer your questions before the cart opens.\n\nYou've just secured your place on the list — putting you ahead of those who will try to join on launch day without following the warm-up.\n\nFirst things first: have you tried launching before, or are you still waiting for the right moment to start?", "Soy Jeff y estoy aquí para responder tus dudas antes de que se abra el carrito.\n\nAcabas de asegurar tu plaza en la lista, por delante de quienes intentarán entrar el día de la apertura sin haber seguido el calentamiento.\n\nAntes que nada: ¿ya intentaste hacer un lanzamiento o todavía esperas el momento adecuado para empezar?"],
  "Fique no grupo. Assista aos conteúdos exclusivos que vão sair por aqui. Tire cada dúvida com o Jeff. Entenda o que o NexOS faz na prática — não só o que ele é, mas o que ele executa por você. Quanto mais você entender antes do carrinho abrir, mais rápida será a sua decisão.": ["Stay in the group. Watch the exclusive content shared here. Ask Jeff anything. Understand what NexOS does in practice — not just what it is, but what it does for you. The more you know before the cart opens, the faster you can decide.", "Quédate en el grupo. Mira el contenido exclusivo que compartiremos aquí. Resuelve tus dudas con Jeff. Entiende lo que NexOS hace en la práctica: no solo qué es, sino qué ejecuta por ti. Cuanto más sepas antes de que se abra el carrito, más rápido podrás decidir."],
  "Antes do carrinho abrir, você vai ver o NexOS funcionando em tempo real — estratégia sendo gerada, copy sendo escrita, sequência sendo montada. Não é promessa. É execução ao vivo.": ["Before the cart opens, you'll see NexOS working in real time — generating strategy, writing copy, and building sequences. Not a promise. A live demonstration.", "Antes de que se abra el carrito, verás NexOS en funcionamiento en tiempo real: generando estrategias, redactando textos y creando secuencias. No es una promesa. Es una demostración en vivo."],
  "No dia combinado, uma última ação exclusiva para quem acompanhou o aquecimento. Todos os gatilhos pulsando. Tudo que você precisa para tomar a melhor decisão.": ["On the scheduled day, one final exclusive action for those who followed the warm-up. Every trigger in motion. Everything you need to make the best decision.", "El día acordado, habrá una última acción exclusiva para quienes siguieron el calentamiento. Todos los elementos estarán listos. Tendrás todo lo necesario para tomar la mejor decisión."],
  "O carrinho abre uma única vez neste preço. Você tem 24 horas para garantir o acesso de Fundador. Quando o contador chegar a zero, essa condição fecha definitivamente — sem reabertura, sem cupom, sem segunda chance.": ["The cart opens only once at this price. You have 24 hours to secure Founder access. When the countdown reaches zero, this offer closes permanently — no reopening, no coupon, no second chance.", "El carrito se abrirá una sola vez a este precio. Tienes 24 horas para asegurar el acceso de fundador. Cuando el contador llegue a cero, la oferta se cerrará definitivamente: sin reapertura, cupón ni segunda oportunidad."],
  "Quem não entrou na janela de 24 horas aguarda a próxima turma — sem data prevista — e no preço cheio, sem os benefícios de Fundador.": ["Anyone who misses the 24-hour window must wait for the next cohort — with no date set — at the full price, without Founder benefits.", "Quienes no aprovechen la ventana de 24 horas deberán esperar a la próxima edición —sin fecha prevista— y pagar el precio completo, sin los beneficios de fundador."],
  "Sua vaga está confirmada. Durante o aquecimento, você vai entender como o NexOS escala lançamentos de múltiplos clientes sem aumentar equipe. Fique no grupo, tire dúvidas com o Jeff. No dia combinado, o carrinho abre por 24 horas.": ["Your place is confirmed. During the warm-up, you'll learn how NexOS scales launches for multiple clients without growing your team. Stay in the group and ask Jeff anything. On the scheduled day, the cart opens for 24 hours.", "Tu plaza está confirmada. Durante el calentamiento, descubrirás cómo NexOS escala lanzamientos para varios clientes sin ampliar el equipo. Quédate en el grupo y resuelve tus dudas con Jeff. El día acordado, el carrito se abrirá durante 24 horas."],
  "Sou Jeff, estou aqui para responder suas dúvidas antes do carrinho abrir.\n\nVocê acabou de confirmar sua vaga na lista de agências — isso já mostra que você está pensando diferente de quem ainda lança no manual.\n\nMe conta: há quanto tempo você sonha em escalar os lançamentos dos seus clientes sem precisar contratar mais ninguém?": ["I'm Jeff, here to answer your questions before the cart opens.\n\nYou've just confirmed your place on the agency list — already setting yourself apart from those still launching manually.\n\nTell me: how long have you wanted to scale your clients' launches without hiring anyone else?", "Soy Jeff y estoy aquí para responder tus dudas antes de que se abra el carrito.\n\nAcabas de confirmar tu plaza en la lista de agencias, lo que ya te diferencia de quienes todavía hacen los lanzamientos manualmente.\n\nCuéntame: ¿desde hace cuánto sueñas con escalar los lanzamientos de tus clientes sin contratar a nadie más?"],
  "Conteúdo exclusivo sobre como agências estão usando agente para executar múltiplos lançamentos simultâneos. Jeff está disponível para responder tudo sobre a operação, planos e ROI esperado.": ["Exclusive content on how agencies use agents to run multiple launches at once. Jeff is available to answer questions about operations, plans, and expected ROI.", "Contenido exclusivo sobre cómo las agencias usan agentes para ejecutar varios lanzamientos simultáneos. Jeff está disponible para responder tus dudas sobre la operación, los planes y el ROI esperado."],
  "Você vai ver na prática como o NexOS gerencia múltiplas campanhas ao mesmo tempo — painel multi-cliente, segmentação por produto e disparos coordenados.": ["You'll see how NexOS manages multiple campaigns at once — multi-client dashboard, product segmentation, and coordinated sends.", "Verás cómo NexOS gestiona varias campañas al mismo tiempo: panel multicliente, segmentación por producto y envíos coordinados."],
  "Última ação exclusiva para quem acompanhou. Tudo que sua agência precisa ver para tomar a decisão certa.": ["One final exclusive action for those who followed along. Everything your agency needs to make the right decision.", "Una última acción exclusiva para quienes siguieron el proceso. Todo lo que tu agencia necesita para tomar la decisión correcta."],
  "Uma única janela de 24 horas para garantir o acesso no preço de Fundador para agências. Quando fechar, essa condição não volta.": ["One 24-hour window to secure agency Founder pricing. Once it closes, this offer will not return.", "Una única ventana de 24 horas para asegurar el precio de fundador para agencias. Cuando se cierre, la oferta no volverá."],
  "Quem não entrou aguarda próxima turma — sem data prevista — no preço cheio, sem benefícios de Fundador.": ["Anyone who misses it must wait for the next cohort — with no date set — at full price, without Founder benefits.", "Quienes no entren deberán esperar a la próxima edición —sin fecha prevista— al precio completo y sin beneficios de fundador."],
  "O NexOS escala lançamentos": ["NexOS scales launches", "NexOS escala lanzamientos"],
  "Fique no grupo agora": ["Join the group now", "Únete al grupo ahora"],
  "O Grupo dos Fundadores é onde o aquecimento acontece. É por lá que o conteúdo exclusivo será enviado e que você vai acompanhar tudo antes do carrinho abrir.": ["The Founders Group is where the warm-up happens. Exclusive content will be shared there, so you can follow everything before the cart opens.", "El grupo de fundadores es donde tiene lugar el calentamiento. Allí compartiremos contenido exclusivo para que puedas seguir todo antes de que se abra el carrito."],
  "O Grupo das Agências é onde o aquecimento acontece. É por lá que o conteúdo exclusivo será enviado e que você vai acompanhar tudo antes do carrinho abrir.": ["The Agency Group is where the warm-up happens. Exclusive content will be shared there, so you can follow everything before the cart opens.", "El grupo de agencias es donde tiene lugar el calentamiento. Allí compartiremos contenido exclusivo para que puedas seguir todo antes de que se abra el carrito."],
  "Antes de decidir qualquer coisa, entenda o que o NexOS faz na prática. O Jeff está aqui agora — pergunte sobre funcionalidades, planos, casos de uso, o que precisar.": ["Before deciding anything, understand what NexOS does in practice. Jeff is here now — ask about features, plans, use cases, or anything else.", "Antes de decidir, entiende qué hace NexOS en la práctica. Jeff está aquí: pregúntale sobre funciones, planes, casos de uso o lo que necesites."],
  "Você será avisado pelo WhatsApp cadastrado. No dia da abertura, você receberá uma última comunicação com tudo que precisa para tomar a melhor decisão.": ["We'll notify you on the WhatsApp number you registered. On launch day, you'll receive one final message with everything you need to make the best decision.", "Te avisaremos por el WhatsApp registrado. El día de la apertura recibirás un último mensaje con todo lo necesario para tomar la mejor decisión."],
  "Quando o carrinho abrir, você terá 24 horas. Não existe extensão de prazo, não existe negociação posterior, não existe segunda janela neste preço.": ["When the cart opens, you'll have 24 hours. There will be no extension, later negotiation, or second window at this price.", "Cuando se abra el carrito, tendrás 24 horas. No habrá prórroga, negociación posterior ni una segunda ventana a este precio."],
};
function prepText(pt: string, t: ReturnType<typeof useUiText>) {
  const localized = PREP_COPY[pt];
  return localized ? t(pt, localized[0], localized[1]) : t(pt, pt, pt);
}

// ── Group join buttons (WhatsApp + Telegram) ──────────────────────────────────
function GroupButtons({ segment }: { segment: Segment }) {
  const t = useUiText();
  const links = GROUP_LINKS[segment];
  const cfg   = SEGMENT_CONFIG[segment];
  const hasAny = links.whatsapp || links.telegram;

  if (hasAny) {
    return (
      <div className="space-y-2">
        {links.whatsapp && (
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">
            <Button className="w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 bg-[#25D366] hover:bg-[#1fad55] text-white">
              <MessageSquare className="h-5 w-5" />
              {t("Entrar no", "Join the", "Únete al")} {prepText(cfg.groupName, t)} — WhatsApp
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        )}
        {links.telegram && (
          <a href={links.telegram} target="_blank" rel="noopener noreferrer">
            <Button className="w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 bg-[#229ED9] hover:bg-[#1a87bb] text-white">
              <Send className="h-5 w-5" />
              {t("Entrar no", "Join the", "Únete al")} {prepText(cfg.groupName, t)} — Telegram
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled
          className="w-full h-12 rounded-none font-mono uppercase tracking-widest text-xs gap-2 opacity-50 bg-[#25D366]/20 text-white cursor-not-allowed border border-[#25D366]/20"
        >
          <MessageSquare className="h-4 w-4" />
          WhatsApp — {t("Em breve", "Coming soon", "Próximamente")}
        </Button>
        <Button
          disabled
          className="w-full h-12 rounded-none font-mono uppercase tracking-widest text-xs gap-2 opacity-50 bg-[#229ED9]/20 text-white cursor-not-allowed border border-[#229ED9]/20"
        >
          <Send className="h-4 w-4" />
          Telegram — {t("Em breve", "Coming soon", "Próximamente")}
        </Button>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center">
        {t("Os links serão disponibilizados quando o aquecimento iniciar", "Links will be shared when the warm-up begins", "Los enlaces estarán disponibles cuando comience el calentamiento")}
      </p>
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function AiChat({ segment }: { segment: Segment }) {
  const t = useUiText();
  const cfg = SEGMENT_CONFIG[segment];
  const storageKey = `nexos-jeff-${segment}`;

  const loadSaved = (): ChatMsg[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as ChatMsg[]) : [];
    } catch { return []; }
  };

  const savedMsgs = loadSaved();
  const [messages, setMessages] = useState<ChatMsg[]>(savedMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [jeffTyping, setJeffTyping] = useState(savedMsgs.length === 0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savedMsgs.length > 0) return;
    const delay = 1800 + Math.random() * 800;
    const timer = setTimeout(() => {
      setJeffTyping(false);
      const initMsgs: ChatMsg[] = [{ role: "assistant", content: prepText(cfg.aiGreeting, t) }];
      setMessages(initMsgs);
      try { localStorage.setItem(storageKey, JSON.stringify(initMsgs)); } catch { /* ignore */ }
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, jeffTyping]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, segment, history: withUser.slice(-12).slice(0, -1) }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const aiReply = data.reply ?? t("Ops, tive um problema. Tente novamente!", "Oops, something went wrong. Please try again!", "Vaya, ocurrió un problema. ¡Inténtalo de nuevo!");
      const withAi: ChatMsg[] = [...withUser, { role: "assistant", content: aiReply }];
      // Clear input only after confirmed success
      setInput("");
      setMessages(withAi);
      try { localStorage.setItem(storageKey, JSON.stringify(withAi.slice(-40))); } catch { /* ignore */ }
    } catch {
      // Revert optimistic message and restore input
      setMessages(messages);
      toast.error(t("Erro de conexão. Sua mensagem foi preservada. Tente novamente.", "Connection error. Your message was preserved. Please try again.", "Error de conexión. Tu mensaje se conservó. Inténtalo de nuevo."), { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border border-primary/20 bg-card/40 overflow-hidden">
      <div className="border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0 bg-muted/5">
        <div className="w-9 h-9 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 font-mono font-black text-primary text-sm">J</div>
        <div>
          <div className="font-mono font-bold text-xs uppercase tracking-widest text-foreground">{t("Jeff · Especialista NexOS", "Jeff · NexOS Specialist", "Jeff · Especialista de NexOS")}</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-success">{t("Disponível agora · Tire todas as suas dúvidas", "Available now · Ask anything", "Disponible ahora · Resuelve todas tus dudas")}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-sm border flex items-center justify-center shrink-0 font-mono font-black text-xs ${
              msg.role === "assistant"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/20 text-muted-foreground"
            }`}>
              {msg.role === "assistant" ? "J" : <User className="h-3.5 w-3.5" />}
            </div>
            <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed font-sans ${
              msg.role === "assistant"
                ? "border border-primary/20 bg-primary/5 text-foreground"
                : "border border-border/50 bg-muted/20 text-foreground"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {(loading || jeffTyping) && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 font-mono font-black text-xs text-primary">J</div>
            <div className="border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2">
              {loading
                ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                : <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </span>
              }
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">{t("Jeff está digitando...", "Jeff is typing...", "Jeff está escribiendo...")}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border/50 p-3 shrink-0 bg-muted/5">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            aria-label={t("Mensagem para Jeff", "Message Jeff", "Mensaje para Jeff")}
            placeholder={jeffTyping ? t("Aguarde o Jeff...", "Please wait for Jeff...", "Espera a Jeff...") : t("Pergunte sobre planos, funcionalidades, lançamento...", "Ask about plans, features, or launches...", "Pregunta sobre planes, funciones o lanzamientos...")}
            className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-sans text-sm h-11 flex-1"
            disabled={loading || jeffTyping}
          />
          <Button
            onClick={() => void send()}
            disabled={loading || jeffTyping || !input.trim()}
            className="rounded-none h-11 px-4 btn-weapon-primary shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest mt-2">
          {t("Jeff responde agora · Sem chatbot genérico", "Jeff replies in real time · No generic chatbot", "Jeff responde ahora · Sin chatbot genérico")}
        </p>
      </div>
    </div>
  );
}

// ── Funil do lançamento ────────────────────────────────────────────────────────
function FunilSection({ segment }: { segment: Segment }) {
  const t = useUiText();
  const cfg = SEGMENT_CONFIG[segment];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5">
        <Radio className="h-3 w-3" /> {prepText("Fases do lançamento", t)}
      </div>
      {cfg.phases.map((phase, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`border transition-all ${
              phase.ativo
                ? "border-primary/40 bg-primary/5"
                : phase.destaque
                ? "border-primary/20 bg-primary/5"
                : phase.alerta
                ? "border-destructive/20 bg-destructive/5"
                : "border-border/40 bg-card/20"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <div className={`w-7 h-7 border flex items-center justify-center shrink-0 text-[10px] font-mono font-black ${
                phase.ativo
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : phase.alerta
                  ? "border-destructive/30 bg-destructive/10 text-destructive/60"
                  : "border-border/40 bg-muted/10 text-muted-foreground/40"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">{prepText(phase.fase, t)}</div>
                <div className={`font-mono text-xs font-bold uppercase tracking-wider ${
                  phase.ativo ? "text-primary" : phase.alerta ? "text-destructive/70" : "text-foreground/60"
                }`}>{prepText(phase.label, t)}</div>
              </div>
              {phase.ativo && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              )}
              {isOpen
                ? <ChevronUp className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                : <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              }
            </button>
            {isOpen && (
              <div className="border-t border-border/30 px-3 py-2.5 bg-muted/5">
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{prepText(phase.desc, t)}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bloco de instruções: o que fazer agora ────────────────────────────────────
function InstrucoesCard({ segment }: { segment: Segment }) {
  const t = useUiText();
  const cfg = SEGMENT_CONFIG[segment];
  const steps = [
    {
      icon: MessageSquare,
      titulo: "Entre no grupo agora",
      desc: t(`O ${cfg.groupName} é onde o aquecimento acontece. É por lá que o conteúdo exclusivo será enviado e que você vai acompanhar tudo antes do carrinho abrir.`, `The ${prepText(cfg.groupName, t)} is where the warm-up happens. Exclusive content will be shared there so you can follow everything before the cart opens.`, `El ${prepText(cfg.groupName, t)} es donde ocurre el calentamiento. Allí compartiremos contenido exclusivo para que puedas seguir todo antes de que se abra el carrito.`),
    },
    {
      icon: Bot,
      titulo: "Tire todas as suas dúvidas com o Jeff",
      desc: "Antes de decidir qualquer coisa, entenda o que o NexOS faz na prática. O Jeff está aqui agora — pergunte sobre funcionalidades, planos, casos de uso, o que precisar.",
    },
    {
      icon: Clock,
      titulo: "Aguarde o dia combinado",
      desc: "Você será avisado pelo WhatsApp cadastrado. No dia da abertura, você receberá uma última comunicação com tudo que precisa para tomar a melhor decisão.",
    },
    {
      icon: Zap,
      titulo: "Decida em 24h",
      desc: "Quando o carrinho abrir, você terá 24 horas. Não existe extensão de prazo, não existe negociação posterior, não existe segunda janela neste preço.",
    },
  ];

  return (
    <div className="border border-border/40 bg-card/30 p-5 space-y-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3" /> {prepText("O que fazer agora", t)}
      </div>
      <div className="space-y-3">
        {steps.map(({ icon: Icon, titulo, desc }, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 border border-primary/20 bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3.5 w-3.5 text-primary/70" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground font-bold mb-0.5">{prepText(titulo, t)}</div>
              <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">{prepText(desc, t)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aviso de escassez honesta ─────────────────────────────────────────────────
function EscassezHonesta() {
  const t = useUiText();
  return (
    <div className="border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-destructive/60 shrink-0 mt-0.5" />
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-destructive/70 font-bold mb-1">{prepText("Prepare-se agora", t)}</div>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            {t("Quando o carrinho abrir, você terá 24 horas. Quem não entrar nessa janela aguarda a próxima turma — sem data prevista — e nunca mais no preço de Fundador. Não existe segunda chance nesta condição.", "When the cart opens, you'll have 24 hours. Anyone who misses this window must wait for the next cohort — with no date set — and will never get the Founder price again. This offer will not return.", "Cuando se abra el carrito, tendrás 24 horas. Quienes no aprovechen esta ventana deberán esperar a la próxima edición —sin fecha prevista— y no volverán a tener el precio de fundador. Esta oferta no se repetirá.")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PreparacaoPage() {
  const t = useUiText();
  const [_location] = useLocation();
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const rawSegment = params.get("segment");
  const segment: Segment = rawSegment === "agency" ? "agency" : "individual";
  const cfg = SEGMENT_CONFIG[segment];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={nexosLogo} alt="NexOS" className="h-14 w-14 object-contain" style={{ filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.65))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-xl tracking-[0.15em] uppercase leading-tight">NexOS</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70 leading-tight">{t("Plataforma de lançamento", "Launch platform", "Plataforma de lanzamientos")}</div>
            </div>
          </div>
          <a href="/login" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {t("Já tenho acesso", "I already have access", "Ya tengo acceso")} →
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-20 pb-10 px-6 auth-bg-gradient">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-primary mb-6">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {prepText(cfg.badge, t)} · {t("Vaga confirmada", "Spot confirmed", "Plaza confirmada")} · {prepText(cfg.groupName, t)}
          </div>
          <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
            <div className="w-12 h-12 rounded-sm border-2 border-primary/50 bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-7 w-7 text-primary" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
            </div>
            <h1 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none text-foreground">
              {prepText(cfg.headline, t)}
            </h1>
          </div>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl font-mono">
            {prepText(cfg.sub, t)}
          </p>
        </div>
      </section>

      {/* ── Main grid ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* AI Chat — 3 cols */}
          <div className="lg:col-span-3 h-[620px] lg:h-[700px] flex flex-col">
            <AiChat segment={segment} />
          </div>

          {/* Right panel — 2 cols */}
          <div className="lg:col-span-2 space-y-4">

            {/* WhatsApp */}
            <div className="border border-border/50 bg-card/40 p-4 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> {t("Passo 1 — entre no grupo", "Step 1 — join the group", "Paso 1 — únete al grupo")}
              </div>
              <GroupButtons segment={segment} />
            </div>

            {/* Funil */}
            <div className="border border-border/50 bg-card/40 p-4">
              <FunilSection segment={segment} />
            </div>

            {/* Escassez honesta */}
            <EscassezHonesta />
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-6">
          <InstrucoesCard segment={segment} />
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="border-t border-border/30 bg-muted/5 py-6 px-6 text-center">
        <div className="flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground/40 uppercase tracking-widest mb-1">
          <Shield className="h-3 w-3" />
          {t("Fique atento ao WhatsApp cadastrado — todas as comunicações chegam por lá", "Watch the WhatsApp number you registered — all updates will arrive there", "Presta atención al WhatsApp registrado: todas las comunicaciones llegarán por allí")}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/20 uppercase tracking-widest">
          NexOS · contato@agencianexos.vip
        </p>
      </div>
    </div>
  );
}
