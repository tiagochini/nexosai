import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Zap, Target, Users, Brain, Flame, Radio, ChevronDown, ChevronUp,
  Copy, RefreshCw, Rocket, Star, Shield, AlertTriangle, Play,
  MessageSquare, Mail, Video, Megaphone, FileText, Mic,
} from "lucide-react";
import { Link } from "wouter";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ContentType =
  | "vsl_script"
  | "cpl_series"
  | "captacao_copy"
  | "whatsapp_sequence"
  | "email_sequence"
  | "live_script"
  | "ad_copy"
  | "live_talking_points";

interface GeneratedContent {
  type: ContentType;
  titulo: string;
  conteudo: string;
  geradoEm: string;
}

// ─── Arsenal Config ─────────────────────────────────────────────────────────────

const ARSENAL: {
  type: ContentType;
  label: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  tempo: string;
}[] = [
  {
    type: "live_script",
    label: "Roteiro da Live + Sorteado",
    descricao: "O roteiro completo da live — da abertura ao fechamento, incluindo como conduzir o sorteado ao vivo",
    icon: Radio,
    cor: "text-red-400",
    tempo: "~90 seg",
  },
  {
    type: "live_talking_points",
    label: "Talking Points da Live",
    descricao: "Guia de bolso para usar durante a live — frases que não podem faltar, gatilhos de fechamento, como lidar com objeções ao vivo",
    icon: Mic,
    cor: "text-orange-400",
    tempo: "~60 seg",
  },
  {
    type: "vsl_script",
    label: "Roteiro VSL",
    descricao: "VSL completo que instala as micro-convicções na ordem certa — do gancho emocional ao CTA",
    icon: Video,
    cor: "text-purple-400",
    tempo: "~90 seg",
  },
  {
    type: "cpl_series",
    label: "Série CPL 1/2/3",
    descricao: "Outline dos 3 vídeos de conteúdo de pré-lançamento — cada um remove uma camada de objeção",
    icon: Play,
    cor: "text-blue-400",
    tempo: "~75 seg",
  },
  {
    type: "captacao_copy",
    label: "Copy de Captação",
    descricao: "Headlines, subheadlines, copy do botão e página de obrigado — para a captura de leads",
    icon: FileText,
    cor: "text-cyan-400",
    tempo: "~60 seg",
  },
  {
    type: "whatsapp_sequence",
    label: "Sequência WhatsApp",
    descricao: "7 dias de mensagens — do opt-in ao fechamento do carrinho — com timing e segmentação",
    icon: MessageSquare,
    cor: "text-green-400",
    tempo: "~75 seg",
  },
  {
    type: "email_sequence",
    label: "Sequência de Emails",
    descricao: "7 emails que constroem antecipação, instalam a epifania e fecham com urgência real",
    icon: Mail,
    cor: "text-yellow-400",
    tempo: "~75 seg",
  },
  {
    type: "ad_copy",
    label: "Pacote de Anúncios",
    descricao: "Copy para Meta Ads e TikTok — tráfego frio, morno e remarketing — com hook de vídeo",
    icon: Megaphone,
    cor: "text-pink-400",
    tempo: "~60 seg",
  },
];

// ─── Micro-convicções (exibição visual) ────────────────────────────────────────

const MICRO_CONVICCOES = [
  { num: "01", texto: "O método de lançamento funciona — você já sabe disso" },
  { num: "02", texto: "O que faz a diferença não é o conhecimento, é a execução" },
  { num: "03", texto: "Quem executa bem tem time especializado — copy, estratégia, vídeo, sequências" },
  { num: "04", texto: "Contratar esse time custa R$30k+/mês — fora do alcance de quem está começando" },
  { num: "05", texto: "Uma agente treinada para cada função do time de lançamento resolve isso" },
  { num: "06", texto: "NexOS tem 64 agentes especializados — cada um treinado para uma função" },
  { num: "07", texto: "Você pode ver funcionando ao vivo — sem promessa, sem slide" },
  { num: "08", texto: "R$3.990 uma única vez é menos que um mês de um bom copywriter" },
];

const MICRO_TRANSLATIONS: Record<string, [string, string, string]> = {
  "01": ["O método de lançamento funciona — você já sabe disso", "The launch method works—you already know that", "El método de lanzamiento funciona: ya lo sabes"],
  "02": ["O que faz a diferença não é o conhecimento, é a execução", "What makes the difference is execution, not knowledge", "Lo que marca la diferencia no es el conocimiento, sino la ejecución"],
  "03": ["Quem executa bem tem time especializado — copy, estratégia, vídeo, sequências", "Strong execution requires a specialist team—copy, strategy, video, and sequences", "Una buena ejecución requiere un equipo especializado: copy, estrategia, video y secuencias"],
  "04": ["Contratar esse time custa R$30k+/mês — fora do alcance de quem está começando", "Hiring that team costs R$30k+/month—out of reach for people just starting out", "Contratar a ese equipo cuesta más de R$30k al mes: fuera del alcance de quienes empiezan"],
  "05": ["Uma agente treinada para cada função do time de lançamento resolve isso", "A trained agent for every launch-team role solves this", "Un agente capacitado para cada función del equipo de lanzamiento resuelve este problema"],
  "06": ["NexOS tem 64 agentes especializados — cada um treinado para uma função", "NexOS has 64 specialist agents, each trained for a specific role", "NexOS tiene 64 agentes especializados, cada uno capacitado para una función"],
  "07": ["Você pode ver funcionando ao vivo — sem promessa, sem slide", "You can see it work live—no promises, no slides", "Puedes verlo funcionar en vivo: sin promesas ni diapositivas"],
  "08": ["R$3.990 uma única vez é menos que um mês de um bom copywriter", "A one-time R$3.990 payment is less than one month of a good copywriter", "Un único pago de R$3.990 cuesta menos que un mes de un buen copywriter"],
};

const ARSENAL_TRANSLATIONS: Record<ContentType, { label: [string, string, string]; description: [string, string, string] }> = {
  live_script: { label: ["Roteiro da live + participante sorteado", "Livestream script + selected participant", "Guion de la transmisión + participante seleccionado"], description: ["Roteiro completo da live — da abertura ao fechamento, incluindo como conduzir o participante sorteado", "Complete livestream script—from opening to close, including how to guide the selected participant", "Guion completo de la transmisión, desde la apertura hasta el cierre, incluido cómo guiar al participante seleccionado"] },
  live_talking_points: { label: ["Pontos de fala da live", "Livestream talking points", "Puntos clave para la transmisión"], description: ["Guia de bolso para a live — frases essenciais, gatilhos de fechamento e como lidar com objeções ao vivo", "A quick-reference guide for the livestream—key lines, closing triggers, and handling objections live", "Guía rápida para la transmisión: frases clave, recursos de cierre y cómo gestionar objeciones en directo"] },
  vsl_script: { label: ["Roteiro VSL", "VSL script", "Guion VSL"], description: ["VSL completo que apresenta as microconvicções na ordem certa — do gancho emocional à chamada para ação", "Complete VSL that presents micro-beliefs in the right order—from the emotional hook to the CTA", "VSL completo que presenta las microconvicciones en el orden adecuado, desde el gancho emocional hasta la llamada a la acción"] },
  cpl_series: { label: ["Série CPL 1/2/3", "CPL series 1/2/3", "Serie CPL 1/2/3"], description: ["Estrutura dos três vídeos de conteúdo pré-lançamento — cada um responde a uma objeção", "Outline for three pre-launch content videos—each addressing one objection", "Esquema de los tres videos previos al lanzamiento; cada uno responde a una objeción"] },
  captacao_copy: { label: ["Texto de captação", "Lead capture copy", "Texto de captación"], description: ["Títulos, subtítulos, texto do botão e da página de agradecimento para captar leads", "Headlines, subheadlines, button copy, and thank-you page for lead capture", "Titulares, subtitulares, texto del botón y página de agradecimiento para captar leads"] },
  whatsapp_sequence: { label: ["Sequência de WhatsApp", "WhatsApp sequence", "Secuencia de WhatsApp"], description: ["Sete dias de mensagens — da inscrição à abertura do carrinho — com horários e segmentação", "Seven days of messages—from opt-in to cart opening—with timing and segmentation", "Siete días de mensajes, desde el registro hasta la apertura del carrito, con horarios y segmentación"] },
  email_sequence: { label: ["Sequência de e-mails", "Email sequence", "Secuencia de correos"], description: ["Sete e-mails para criar expectativa, apresentar a epifania e fechar com urgência real", "Seven emails to build anticipation, introduce the epiphany, and close with genuine urgency", "Siete correos para generar expectativa, presentar la epifanía y cerrar con urgencia real"] },
  ad_copy: { label: ["Pacote de anúncios", "Ad package", "Paquete de anuncios"], description: ["Texto para Meta Ads e TikTok — tráfego frio, morno e remarketing — com gancho para vídeo", "Copy for Meta Ads and TikTok—cold and warm traffic and retargeting—with a video hook", "Copy para Meta Ads y TikTok: tráfico frío y templado y remarketing, con gancho para video"] },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NexosLaunchRoom() {
  const { isAdmin } = useAuth();
  const t = useUiText();
  const { locale } = useUiLocale();
  const [generated, setGenerated] = useState<Record<string, GeneratedContent>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [epifaniaExpanded, setEpifaniaExpanded] = useState(true);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("Acesso restrito ao fundador", "Founder access only", "Acceso exclusivo para el fundador")}</p>
          <Button asChild variant="ghost" className="mt-4"><Link href="/admin">← {t("Voltar", "Back", "Volver")}</Link></Button>
        </div>
      </div>
    );
  }

  const generateMutation = useMutation({
    mutationFn: async (type: ContentType) => {
      const data = await customFetch<{ content: GeneratedContent }>("/api/nexos-launch/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      return data.content;
    },
    onSuccess: (data) => {
      setGenerated(prev => ({ ...prev, [data.type]: data }));
      setExpanded(data.type);
      toast.success(t(`${data.titulo} gerado com sucesso`, `${data.titulo} generated successfully`, `${data.titulo} generado correctamente`));
    },
    onError: () => toast.error(t("Erro ao gerar — verifique os especialistas", "Generation failed — check the specialists", "Error al generar — revisa a los especialistas")),
  });

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t(`${label} copiado`, `${label} copied`, `${label} copiado`));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">
                  {t("ACESSO DO FUNDADOR", "FOUNDER ACCESS", "ACCESO DEL FUNDADOR")}
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-mono text-xs">
                  {t("NÃO DISPONÍVEL PARA CLIENTES", "NOT AVAILABLE TO CLIENTS", "NO DISPONIBLE PARA CLIENTES")}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {t("Sala de lançamento NexOS", "NexOS Launch Room", "Sala de lanzamiento NexOS")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Framework estratégico exclusivo · Agentes pré-calibrados · NexOS vendendo NexOS", "Exclusive strategic framework · Pre-calibrated agents · NexOS selling NexOS", "Marco estratégico exclusivo · Agentes precalibrados · NexOS vendiendo NexOS")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-mono">{t("META DO LANÇAMENTO", "LAUNCH TARGET", "META DEL LANZAMIENTO")}</p>
              <p className="text-2xl font-bold text-foreground">{t("500 acessos", "500 memberships", "500 accesos")}</p>
              <p className="text-sm text-muted-foreground">{t("R$1.995.000 bruto", "R$1,995,000 gross", "R$1.995.000 brutos")}</p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: "Ticket", value: "R$3.990", sub: t("lançamento", "launch", "lanzamiento"), color: "text-green-400" },
              { label: t("Faixa", "Track", "Rango"), value: t("6 dígitos", "6 figures", "6 cifras"), sub: t("R$100k–999k em 7 dias", "R$100k–999k in 7 days", "R$100k–999k en 7 días"), color: "text-blue-400" },
              { label: t("Orçamento de mídia", "Media budget", "Presupuesto de medios"), value: "R$20–35k", sub: t("ROAS alvo: 57x", "Target ROAS: 57x", "ROAS objetivo: 57x"), color: "text-purple-400" },
              { label: t("CPL alvo", "Target CPL", "CPL objetivo"), value: "≤ R$15", sub: t("3.300+ leads", "3,300+ leads", "3.300+ leads"), color: "text-orange-400" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-mono">{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── A Epifania Central ── */}
        <div className="border border-amber-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setEpifaniaExpanded(e => !e)}
            className="w-full flex items-center justify-between px-6 py-4 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-400" />
              <span className="font-semibold text-foreground">{t("A epifania central — o argumento de vendas mais importante", "The core epiphany — the most important sales argument", "La epifanía central — el argumento de venta más importante")}</span>
            </div>
            {epifaniaExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {epifaniaExpanded && (
            <div className="px-6 py-6 space-y-6 bg-card/20">

              {/* Gancho */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-xs text-amber-400 font-mono mb-2">{t("GANCHO CENTRAL", "CORE HOOK", "GANCHO CENTRAL")}</p>
                <p className="text-lg font-bold text-foreground leading-snug">
                  {t('"A única coisa que separava você de um lançamento de 6 dígitos não era o método — era o time de execução."', '"The only thing separating you from a six-figure launch wasn’t the method—it was the execution team."', '"Lo único que te separaba de un lanzamiento de 6 cifras no era el método: era el equipo de ejecución."')}
                </p>
              </div>

              {/* Antes / Depois */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-xs text-red-400 font-mono mb-3">{t("AVATAR ANTES", "BEFORE AVATAR", "AVATAR ANTES")}</p>
                  <ul className="space-y-2">
                    {[
                      t("Sabe o método — viu funcionar para outros", "Knows the method—it has worked for others", "Conoce el método: ha visto que funciona para otras personas"),
                      t("Travou na execução toda vez que tentou", "Got stuck executing every time they tried", "Se bloqueó al ejecutar cada vez que lo intentó"),
                      t("Não tem time, não tem orçamento para agência", "Has no team and no budget for an agency", "No tiene equipo ni presupuesto para una agencia"),
                      t('"Sei que funciona, mas não sei se funciono"', '"I know it works, but I don’t know if I can make it work"', '"Sé que funciona, pero no sé si yo puedo hacerlo funcionar"'),
                    ].map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">✗</span> {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <p className="text-xs text-green-400 font-mono mb-3">{t("AVATAR DEPOIS", "AFTER AVATAR", "AVATAR DESPUÉS")}</p>
                  <ul className="space-y-2">
                    {[
                      t("64 agentes executando cada etapa do lançamento", "64 agents executing every step of the launch", "64 agentes ejecutando cada etapa del lanzamiento"),
                      t("Briefing preenchido — estratégia, copy e vídeo gerados", "Brief completed—strategy, copy, and video generated", "Briefing completado: estrategia, copy y video generados"),
                      t("Sequência rodando, leads aquecendo, atendimento 24h", "Sequence running, leads warming up, 24/7 support", "Secuencia activa, leads preparados y atención 24/7"),
                      t('"Finalmente executei — e os números são reais"', '"I finally executed—and the numbers are real"', '"Por fin ejecuté, y los números son reales"'),
                    ].map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span> {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mecanismo */}
              <div className="bg-card border border-border/50 rounded-lg p-4">
                <p className="text-xs text-blue-400 font-mono mb-2">{t("O MECANISMO (como explicar na live)", "THE MECHANISM (how to explain it on the livestream)", "EL MECANISMO (cómo explicarlo en la transmisión en vivo)")}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">{t("NexOS não é mais um curso. Não é mais um framework.", "NexOS is not another course. It is not another framework.", "NexOS no es otro curso. No es otro marco de trabajo.")}</span>{" "}
                  {t("É o time de execução que o Érico tem — disponível para qualquer pessoa, a qualquer hora, sem mensalidade. Quando você compra NexOS, você não aprende como lançar.", "It is Érico’s execution team—available to anyone, at any time, with no monthly fee. When you buy NexOS, you do not learn how to launch.", "Es el equipo de ejecución que tiene Érico, disponible para cualquier persona y en cualquier momento, sin cuota mensual. Al comprar NexOS, no aprendes cómo lanzar.")}{" "}
                  <span className="text-foreground font-medium">{t("Você ganha 57 especialistas que lançam junto com você.", "You get 57 specialists who launch alongside you.", "Obtienes 57 especialistas que lanzan contigo.")}</span>
                </p>
              </div>

              {/* Estratégia do Sorteado */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-purple-400" />
                   <p className="text-xs text-purple-400 font-mono">{t("ESTRATÉGIA DO PARTICIPANTE SORTEADO — A CHAVE DE OURO", "RANDOMLY SELECTED PARTICIPANT STRATEGY — THE GOLDEN KEY", "ESTRATEGIA DEL PARTICIPANTE SORTEADO — LA CLAVE DE ORO")}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {t("A maior objeção do público não é", "The audience’s biggest objection is not", "La mayor objeción del público no es")} <em>{t('"o produto funciona?"', '"does the product work?"', '"¿funciona el producto?"')}</em> — {t("é", "it is", "sino")} <em>{t('"funciona para alguém como eu?"', '"will it work for someone like me?"', '"¿funciona para alguien como yo?"')}</em>.
                   {" "}{t("O participante sorteado supera essa objeção em tempo real, ao vivo, com uma pessoa aleatória da plateia. Não é um depoimento nem uma simulação. É o produto sendo demonstrado para alguém que não foi escolhido a dedo.", "The randomly selected participant overcomes that objection in real time, live, with someone chosen at random from the audience. It is not a testimonial or a simulation. It is the product demonstrated for someone who was not handpicked.", "El participante elegido al azar supera esa objeción en tiempo real, en directo, con una persona seleccionada al azar entre el público. No es un testimonio ni una simulación. Es el producto demostrando su valor a alguien que no fue elegido a dedo.")}
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                     { step: t("1. Sorteio ao vivo", "1. Live draw", "1. Sorteo en vivo"), desc: t("Escolha aleatória — credibilidade total", "Random selection—full credibility", "Selección aleatoria: credibilidad total") },
                     { step: t("2. Briefing em 5 min", "2. Brief in 5 minutes", "2. Briefing en 5 min"), desc: t("Onboarding do NexOS para a pessoa sorteada", "NexOS intake for the selected participant", "Onboarding de NexOS para la persona seleccionada") },
                     { step: t("3. Demo em 30 min", "3. Demo in 30 minutes", "3. Demo en 30 min"), desc: t("Estratégia completa gerada na tela", "Complete strategy generated on screen", "Estrategia completa generada en pantalla") },
                  ].map(s => (
                    <div key={s.step} className="bg-purple-500/10 rounded p-2">
                      <p className="text-purple-300 font-medium">{s.step}</p>
                      <p className="text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Micro-convicções */}
              <div>
                 <p className="text-xs text-muted-foreground font-mono mb-3">{t("SEQUÊNCIA DE MICROCONVICÇÕES (apresente nesta ordem)", "MICRO-BELIEF SEQUENCE (present in this order)", "SECUENCIA DE MICROCONVICCIONES (presentar en este orden)")}</p>
                <div className="space-y-2">
                  {MICRO_CONVICCOES.map(mc => (
                    <div key={mc.num} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="font-mono text-xs text-muted-foreground/50 w-6 shrink-0">{mc.num}</span>
                       <span className="text-sm text-muted-foreground">{t(...MICRO_TRANSLATIONS[mc.num])}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Avatar: Dores e Linguagem ── */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
               <p className="text-sm font-semibold">{t("Medos reais do público", "The audience’s real fears", "Miedos reales del público")}</p>
            </div>
            <ul className="space-y-2">
              {[
                 t("Tentar mais uma vez e fracassar novamente", "Trying one more time and failing again", "Intentarlo una vez más y volver a fracasar"),
                 t("Perder dinheiro com mídia e não converter", "Losing money on ads without converting", "Perder dinero en publicidad sin convertir"),
                 t("Montar tudo sozinho e chegar ao carrinho sem lista", "Building everything alone and reaching cart open without a list", "Montarlo todo a solas y llegar a la apertura del carrito sin una lista"),
                 t("Não conseguir escrever copy que converte", "Being unable to write copy that converts", "No poder escribir copy que convierta"),
                 t("Ser mais um que sabia o método mas não conseguiu", "Being another person who knew the method but could not execute it", "Ser otra persona que conocía el método, pero no logró ejecutarlo"),
               ].map((fear, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                  {fear}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-muted-foreground" />
               <p className="text-sm font-semibold">{t("Linguagem literal (use nas copies)", "Audience’s own words (use in copy)", "Palabras textuales (úsalas en los textos)")}</p>
            </div>
            <ul className="space-y-2">
              {[
                 t('"Sei que funciona, mas não sei se funciono"', '"I know it works, but I don’t know if I can make it work"', '"Sé que funciona, pero no sé si yo puedo hacerlo funcionar"'),
                 t('"Não tenho time pra criar tudo isso"', '"I don’t have a team to create all this"', '"No tengo un equipo para crear todo esto"'),
                 t('"Tentei antes e não saiu do papel"', '"I tried before, but never got it off the ground"', '"Ya lo intenté, pero no llegué a ponerlo en marcha"'),
                 t('"O método está certo, mas eu travo na hora de fazer"', '"The method is right, but I freeze when it is time to execute"', '"El método es correcto, pero me bloqueo a la hora de ejecutarlo"'),
                 t('"Quero lançar mas não sei por onde começar a execução"', '"I want to launch, but I don’t know where to start with execution"', '"Quiero lanzar, pero no sé por dónde empezar a ejecutarlo"'),
               ].map((phrase, i) => (
                <li key={i} className="text-sm text-muted-foreground font-mono text-xs bg-muted/30 rounded px-2 py-1">
                   {phrase}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Arsenal de Conteúdo ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Rocket className="h-5 w-5 text-primary" />
             <h2 className="text-lg font-semibold">{t("Arsenal de conteúdo", "Content arsenal", "Arsenal de contenido")}</h2>
            <Badge variant="outline" className="text-xs font-mono">
               {Object.keys(generated).length}/{ARSENAL.length} {t("gerados", "generated", "generados")}
            </Badge>
          </div>

          <div className="space-y-3">
            {ARSENAL.map(item => {
              const Icon = item.icon;
              const isGenerating = generateMutation.isPending && generateMutation.variables === item.type;
              const isDone = Boolean(generated[item.type]);
              const isOpen = expanded === item.type;

              return (
                <div
                  key={item.type}
                  className={`border rounded-xl overflow-hidden transition-all ${isDone ? "border-border" : "border-border/40"}`}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-4 px-5 py-4 bg-card/50">
                    <div className={`p-2 rounded-lg bg-card border border-border/50`}>
                      <Icon className={`h-4 w-4 ${item.cor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <p className="font-medium text-sm">{t(...ARSENAL_TRANSLATIONS[item.type].label)}</p>
                        {isDone && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                             {t("Gerado", "Generated", "Generado")}
                          </Badge>
                        )}
                      </div>
                       <p className="text-xs text-muted-foreground mt-0.5">{t(...ARSENAL_TRANSLATIONS[item.type].description)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">{item.tempo.replace(" seg", "")} {t("seg", "sec", "s")}</span>
                      {isDone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setExpanded(isOpen ? null : item.type)}
                        >
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={isDone ? "outline" : "default"}
                        className="h-7 text-xs gap-1.5"
                        disabled={isGenerating}
                        onClick={() => generateMutation.mutate(item.type)}
                      >
                        {isGenerating ? (
                           <><RefreshCw className="h-3 w-3 animate-spin" /> {t("Gerando...", "Generating...", "Generando...")}</>
                        ) : isDone ? (
                           <><RefreshCw className="h-3 w-3" /> {t("Regenerar", "Regenerate", "Volver a generar")}</>
                        ) : (
                           <><Zap className="h-3 w-3" /> {t("Gerar com o agente", "Generate with agent", "Generar con el agente")}</>
                        )}
                      </Button>
                      {isDone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => copyToClipboard(generated[item.type]!.conteudo, t(...ARSENAL_TRANSLATIONS[item.type].label))}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Content Area */}
                  {isDone && isOpen && (
                    <div className="border-t border-border/50 bg-card/20 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-muted-foreground font-mono">
                           {t("Gerado em", "Generated", "Generado el")} {new Date(generated[item.type]!.geradoEm).toLocaleString(intlLocale(locale))}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs gap-1"
                          onClick={() => copyToClipboard(generated[item.type]!.conteudo, t(...ARSENAL_TRANSLATIONS[item.type].label))}
                        >
                           <Copy className="h-3 w-3" /> {t("Copiar tudo", "Copy all", "Copiar todo")}
                        </Button>
                      </div>
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto scrollbar-thin">
                        {generated[item.type]!.conteudo}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Checklist Pré-Live ── */}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-primary" />
             <h2 className="text-lg font-semibold">{t("Checklist de lançamento", "Launch checklist", "Lista de verificación del lanzamiento")}</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                fase: t("Semana -1", "Week -1", "Semana -1"),
                cor: "border-blue-500/30",
                items: [
                  t("Página de captura no ar", "Lead capture page live", "Página de captación publicada"),
                  t("Texto de captação gerado e aprovado", "Lead capture copy generated and approved", "Texto de captación generado y aprobado"),
                  t("Anúncios publicados no Meta + TikTok", "Ads published on Meta + TikTok", "Anuncios publicados en Meta + TikTok"),
                  t("Sequência de WhatsApp configurada", "WhatsApp sequence configured", "Secuencia de WhatsApp configurada"),
                  t("Grupo de WhatsApp criado", "WhatsApp group created", "Grupo de WhatsApp creado"),
                ],
              },
              {
                fase: t("D-3 a D-1", "D-3 to D-1", "D-3 a D-1"),
                cor: "border-amber-500/30",
                items: [
                  t("CPL 1, 2 e 3 publicados", "CPL 1, 2, and 3 published", "CPL 1, 2 y 3 publicados"),
                  t("E-mails D-5, D-3 e D-1 agendados", "D-5, D-3, and D-1 emails scheduled", "Correos D-5, D-3 y D-1 programados"),
                  t("Participante sorteado pré-selecionado (tem produto?)", "Selected participant pre-screened (has a product?)", "Participante seleccionado preevaluado (¿tiene un producto?)"),
                  t("Roteiro da live revisado", "Livestream script reviewed", "Guion de la transmisión revisado"),
                  t("Pontos de fala impressos/disponíveis", "Talking points printed/available", "Puntos clave impresos/disponibles"),
                ],
              },
              {
                fase: t("Dia da live", "Livestream day", "Día de la transmisión"),
                cor: "border-red-500/30",
                items: [
                  t("Link da live nas mensagens da manhã do D0", "Livestream link included in D0 morning messages", "Enlace de la transmisión en los mensajes de la mañana del D0"),
                  t("NexOS conectado e pronto para a demonstração", "NexOS logged in and ready to demo", "NexOS conectado y listo para la demostración"),
                  t("Checkout configurado e testado", "Checkout configured and tested", "Checkout configurado y probado"),
                  t("Sequência de abertura do carrinho ativa", "Cart-open sequence active", "Secuencia de apertura del carrito activa"),
                  t("Recuperação pós-live programada", "Post-livestream recovery scheduled", "Recuperación posterior a la transmisión programada"),
                ],
              },
            ].map(fase => (
              <div key={fase.fase} className={`border ${fase.cor} rounded-lg p-4`}>
                <p className="text-xs font-mono text-muted-foreground mb-3">{fase.fase}</p>
                <ul className="space-y-2">
                  {fase.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border border-border/60 rounded shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Projeção ── */}
        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20 rounded-xl p-6">
           <p className="text-xs text-primary font-mono mb-4">{t("PROJEÇÃO DO LANÇAMENTO", "LAUNCH PROJECTION", "PROYECCIÓN DEL LANZAMIENTO")}</p>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label: t("Leads via mídia", "Paid-media leads", "Leads de medios pagados"), value: "2.000–3.000", sub: t("com R$30k, CPL ≤R$15", "with R$30k, CPL ≤R$15", "con R$30k, CPL ≤R$15") },
              { label: t("Leads orgânicos", "Organic leads", "Leads orgánicos"), value: "+500–800", sub: t("indicações + compartilhamentos do participante", "referrals + participant shares", "referidos + difusión del participante") },
              { label: t("Assistiram à live", "Watched the livestream", "Vieron la transmisión"), value: "770–1.400", sub: t("35–45% da lista", "35–45% of list", "35–45% de la lista") },
              { label: t("Conversão esperada", "Expected conversions", "Conversiones esperadas"), value: "200–500", sub: t("15–35% de quem assistiu à live", "15–35% of livestream viewers", "15–35% de quienes vieron la transmisión") },
            ].map(p => (
              <div key={p.label}>
                <p className="text-2xl font-bold text-foreground">{p.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.label}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{p.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
             <p className="text-sm text-muted-foreground">{t("Receita potencial no cenário base", "Potential revenue in the base scenario", "Ingresos potenciales en el escenario base")}</p>
            <div className="text-right">
              <span className="text-xl font-bold text-green-400">R$800k–R$1.995.000</span>
               <span className="text-xs text-muted-foreground ml-2">{t("com R$30k de mídia", "with R$30k in media spend", "con R$30k de inversión en medios")}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
