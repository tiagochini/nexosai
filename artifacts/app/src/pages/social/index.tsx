import { useState, useCallback } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Share2, ExternalLink, CheckCircle2, XCircle, Loader2,
  Calendar, Eye, RefreshCw, Play, Instagram, Facebook,
  MessageSquare, Users, Plus, Copy, ChevronRight, Bot,
  Zap, Send, Phone, ArrowRight, Clock, Sparkles, Lock,
  AlertTriangle, Wifi, WifiOff, Target, TrendingUp, Radio,
  BarChart3,
} from "lucide-react";
import { SocialAnalyticsTab } from "./analytics";
import { SocialIntelligenceTab } from "./intelligence";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialAccount { id: string; platform: string; status: string; accountName?: string; connectedAt?: string }
interface SocialPost {
  id: string; platform: string; status: string; scheduledAt?: string; publishedAt?: string;
  caption?: string; mediaUrl?: string; impressions?: number; reach?: number; clicks?: number;
}

interface LaunchGroup {
  id: string;
  name: string;
  platform: "whatsapp" | "telegram";
  link?: string;
  memberCount?: number;
  campaignId?: string;
  currentPhase: number;
  createdAt: string;
  phases: {
    label: string;
    description: string;
    messages: { id: string; content: string; generatedAt?: string; dispatchedAt?: string }[];
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    color: "text-pink-400 border-pink-400/40 bg-pink-400/10",
    borderGlow: "hover:border-pink-400/30",
    strategy: ["Reels de autoridade (D-7 a D-3)", "Stories de antecipação (D-2 a D-1)", "Post de abertura do carrinho (D-0)", "Stories de urgência + contagem (D+1 a D+6)", "Post de encerramento + agradecimento (D+7)"],
    contentTypes: ["Reels (60s)", "Stories", "Carrossel", "Post estático"],
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    color: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    borderGlow: "hover:border-blue-400/30",
    strategy: ["Posts de aquecimento + prova social", "Live de lançamento no dia D", "Anúncios retargeting (carrinho aberto)", "Posts de urgência + contagem regressiva", "Post final de agradecimento"],
    contentTypes: ["Post nativo", "Live", "Story", "Anúncio"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Radio,
    color: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
    borderGlow: "hover:border-cyan-400/30",
    strategy: ["Vídeos de awareness + problema (D-7)", "Conteúdo de autoridade + resultado (D-5)", "Antecipação + bastidores (D-2)", "Vídeo de lançamento + link bio (D-0)", "Urgência + depoimentos (D+3)"],
    contentTypes: ["Vídeo orgânico", "TikTok Ads", "Dueto/Stitch"],
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Play,
    color: "text-red-400 border-red-400/40 bg-red-400/10",
    borderGlow: "hover:border-red-400/30",
    strategy: ["VSL de captura (pré-lançamento)", "Conteúdo educativo gratuito (D-5)", "Abertura do carrinho + CTA", "FAQ + objeções (D+2)", "Agradecimento + próximos passos"],
    contentTypes: ["VSL", "Vídeo longo", "Shorts", "Ao vivo"],
  },
];

const GROUP_PHASES = [
  {
    label: "Pré-Lançamento",
    emoji: "",
    color: "text-orange-400 border-orange-400/40 bg-orange-400/10",
    days: "D-7 a D-3",
    description: "Aquecimento inicial — construção de autoridade, antecipação e engajamento",
    objective: "Engajar membros, gerar expectativa e posicionar a autoridade do especialista",
    messages: [
      "Mensagem de boas-vindas ao grupo exclusivo",
      "Conteúdo de valor dia 1 (problema + transformação)",
      "Conteúdo de valor dia 2 (prova social + resultados)",
      "Conteúdo de valor dia 3 (bastidores + antecipação)",
    ],
  },
  {
    label: "Aquecimento Intenso",
    emoji: "",
    color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    days: "D-2 a D-1",
    description: "Antecipação máxima — build-up emocional e preparação para abertura",
    objective: "Criar máxima antecipação, revelar detalhes do produto e eliminar objeções antecipadas",
    messages: [
      "Revelação parcial do produto (D-2)",
      "Contagem regressiva para abertura (D-1, manhã)",
      "Lembrete final antes da abertura (D-1, noite)",
    ],
  },
  {
    label: "Abertura do Carrinho",
    emoji: "",
    color: "text-green-400 border-green-400/40 bg-green-400/10",
    days: "D-0",
    description: "Abertura oficial — anúncio com link, condições e urgência inicial",
    objective: "Converter os mais quentes primeiro, estabelecer escassez e urgência real",
    messages: [
      "Anúncio oficial de abertura + link de compra",
      "Confirmação de pedidos (incentivo primeiros compradores)",
      "Lembrete noturno para quem ainda não comprou",
    ],
  },
  {
    label: "Urgência & Conversão",
    emoji: "",
    color: "text-red-400 border-red-400/40 bg-red-400/10",
    days: "D+1 a D+6",
    description: "Fase de conversão intensa — objeções, provas sociais e escassez crescente",
    objective: "Converter indecisos com prova social, quebra de objeções e gatilhos de escassez",
    messages: [
      "Depoimento de aluno transformado (D+1)",
      "Quebra de objeção principal (D+2)",
      "Aviso de vagas/bônus limitados (D+3)",
      "Contagem regressiva encerramento (D+5, 48h)",
      "Último aviso (D+6, 24h antes)",
    ],
  },
  {
    label: "Encerramento do Grupo",
    emoji: "",
    color: "text-purple-400 border-purple-400/40 bg-purple-400/10",
    days: "D+7",
    description: "Encerramento honrado — agradecimento, entrega do link e fechamento do grupo",
    objective: "Honrar quem comprou, dar última chance e encerrar o grupo com gratidão",
    messages: [
      "Aviso de encerramento do grupo (manhã)",
      "Último link de compra disponível (tarde)",
      "Mensagem de agradecimento + entrega do link de acesso (noite)",
    ],
  },
];

const DM_SCENARIOS = [
  {
    id: "payment_failed",
    icon: XCircle,
    color: "text-red-400",
    label: "Pagamento Recusado",
    description: "Cartão não aprovado ou erro no checkout",
    template: `Oi [NOME]! Vi que houve um problema com seu pagamento. Não se preocupe — isso é mais comum do que parece e tem solução fácil!

Algumas opções para você:
• Tente outro cartão de crédito
• Use o PIX (instantâneo e sem risco de falha)
• Entre em contato com seu banco — às vezes bloqueiam compras online por segurança

O link da oferta ainda está ativo: [LINK]

Qualquer dúvida é só me chamar aqui mesmo!`,
  },
  {
    id: "link_not_working",
    icon: ExternalLink,
    color: "text-orange-400",
    label: "Link Não Abre",
    description: "Erro no link ou na página de checkout",
    template: `Oi [NOME]! Vamos resolver isso agora mesmo!

Tenta isso:
1. Copie e cole o link diretamente no seu navegador (não clique)
2. Abra em modo anônimo / navegador diferente
3. Limpe o cache do navegador (Ctrl+Shift+Delete)
4. Se estiver no celular, tente pelo computador

Link direto: [LINK]

Se nenhuma dessas funcionar me manda um print do erro e eu te ajudo!`,
  },
  {
    id: "product_question",
    icon: MessageSquare,
    color: "text-blue-400",
    label: "Dúvida sobre o Produto",
    description: "Perguntas sobre o conteúdo, metodologia ou garantia",
    template: `Oi [NOME]! Que ótima pergunta — fico feliz que tenha me chamado antes de decidir!

[RESPOSTA_PERSONALIZADA]

E sim, você tem 7 dias de garantia incondicional. Se por qualquer motivo não ficar satisfeito(a), devolvemos 100% do seu investimento, sem perguntas.

Ficou alguma dúvida? Pode perguntar à vontade! Estou aqui para te ajudar a tomar a melhor decisão pra você.`,
  },
  {
    id: "no_access",
    icon: Lock,
    color: "text-yellow-400",
    label: "Sem Acesso após Compra",
    description: "Comprou mas não recebeu o acesso",
    template: `Oi [NOME]! Vamos resolver isso imediatamente! Isso acontece às vezes quando o e-mail cai no spam ou há um pequeno delay na plataforma.

- Verifique sua caixa de spam e a pasta "Promoções" (se for Gmail)
- Procure por um e-mail de [NOME_PLATAFORMA] ou [EMAIL_SUPORTE]
- Aguarde até 10 minutos — o sistema pode ter um pequeno delay

Se não encontrar em 15 minutos, me manda:
• O e-mail que você usou na compra
• A confirmação de pagamento (print)

Vou resolver na hora!`,
  },
  {
    id: "discount_request",
    icon: TrendingUp,
    color: "text-green-400",
    label: "Pedido de Desconto",
    description: "Quer condição especial ou prazo maior",
    template: `Oi [NOME]! Entendo completamente — é um investimento e quero que você se sinta confortável! 

Olha, a oferta que temos agora já é a melhor que consigo fazer: é o preço de lançamento que só existe nessa janela. Depois que fecharmos o carrinho, o valor sobe para [VALOR_NORMAL].

O que eu posso fazer por você:
• Parcelamento em até [X]x no cartão
• PIX com [X]% de desconto

A transformação que você vai ter vale muito mais do que qualquer desconto que eu pudesse oferecer. Mas quero que entre porque acredita no resultado, não pelo preço.

Me fala o que está travando sua decisão — vou ser honesto(a) contigo!`,
  },
  {
    id: "late_buyer",
    icon: Clock,
    color: "text-purple-400",
    label: "Quer Comprar Após Fechamento",
    description: "Perdeu o prazo e quer uma última chance",
    template: `Oi [NOME]! Que pena que não conseguiu entrar no prazo... mas fico feliz que tenha entrado em contato! 

Normalmente o carrinho já fechou e não reabrimos — é uma questão de compromisso com quem comprou dentro do prazo e recebe atenção especial.

Posso verificar se ainda há alguma vaga disponível para te colocar em uma lista de prioridade para a próxima turma. Mas não consigo prometer — depende da disponibilidade.

Se quiser, te coloco nessa lista?

E quando abrirmos de novo, você será a primeira pessoa avisada.`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<string, string> = {
  meta: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  tiktok: "text-pink-400 border-pink-400/40 bg-pink-400/10",
};
const POST_STATUS_COLOR: Record<string, string> = {
  draft: "text-muted-foreground border-border/50 bg-muted/10",
  scheduled: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  published: "text-success border-success/40 bg-success/10",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
};

function platformSteps(platformId: string, t: ReturnType<typeof useUiText>): string[] {
  const translations: Record<string, [string[], string[]]> = {
    instagram: [
      ["Authority Reels (D-7 to D-3)", "Anticipation Stories (D-2 to D-1)", "Cart-opening post (D-0)", "Urgency + countdown Stories (D+1 to D+6)", "Closing + thank-you post (D+7)"],
      ["Reels de autoridad (D-7 a D-3)", "Stories de anticipación (D-2 a D-1)", "Publicación de apertura del carrito (D-0)", "Stories de urgencia y cuenta atrás (D+1 a D+6)", "Publicación de cierre y agradecimiento (D+7)"],
    ],
    facebook: [
      ["Warm-up posts + social proof", "Launch-day livestream", "Retargeting ads (cart open)", "Urgency + countdown posts", "Final thank-you post"],
      ["Publicaciones de calentamiento + prueba social", "Directo de lanzamiento el día D", "Anuncios de retargeting (carrito abierto)", "Publicaciones de urgencia y cuenta atrás", "Publicación final de agradecimiento"],
    ],
    tiktok: [
      ["Awareness + problem videos (D-7)", "Authority + results content (D-5)", "Anticipation + behind the scenes (D-2)", "Launch video + bio link (D-0)", "Urgency + testimonials (D+3)"],
      ["Vídeos de reconocimiento y problema (D-7)", "Contenido de autoridad y resultados (D-5)", "Anticipación y detrás de cámaras (D-2)", "Vídeo de lanzamiento y enlace en la bio (D-0)", "Urgencia y testimonios (D+3)"],
    ],
    youtube: [
      ["Lead-capture VSL (pre-launch)", "Free educational content (D-5)", "Cart opening + CTA", "FAQ + objections (D+2)", "Thank-you + next steps"],
      ["VSL de captación (prelanzamiento)", "Contenido educativo gratuito (D-5)", "Apertura del carrito + CTA", "Preguntas frecuentes + objeciones (D+2)", "Agradecimiento + próximos pasos"],
    ],
  };
  const translationsForPlatform = translations[platformId];
  return PLATFORMS.find(p => p.id === platformId)?.strategy.map((item, i) =>
    t(item, translationsForPlatform?.[0][i] ?? item, translationsForPlatform?.[1][i] ?? item)
  ) ?? [];
}
function platformContentTypes(platformId: string, t: ReturnType<typeof useUiText>): string[] {
  const contentTypes = PLATFORMS.find(p => p.id === platformId)?.contentTypes ?? [];
  const en: Record<string, string> = {
    "Reels (60s)": "Reels (60s)", Stories: "Stories", Carrossel: "Carousel", "Post estático": "Static post",
    "Post nativo": "Native post", Live: "Live", Story: "Story", Anúncio: "Ad",
    "Vídeo orgânico": "Organic video", "TikTok Ads": "TikTok Ads", "Dueto/Stitch": "Duet/Stitch",
    "Vídeo longo": "Long-form video", Shorts: "Shorts", "Ao vivo": "Live",
  };
  const es: Record<string, string> = {
    "Reels (60s)": "Reels (60 s)", Stories: "Stories", Carrossel: "Carrusel", "Post estático": "Publicación estática",
    "Post nativo": "Publicación nativa", Live: "Directo", Story: "Historia", Anúncio: "Anuncio",
    "Vídeo orgânico": "Vídeo orgánico", "TikTok Ads": "Anuncios de TikTok", "Dueto/Stitch": "Dúo/Stitch",
    "Vídeo longo": "Vídeo largo", Shorts: "Shorts", "Ao vivo": "En directo",
  };
  return contentTypes.map(value => t(value, en[value] ?? value, es[value] ?? value));
}
function groupPhaseLabel(index: number, t: ReturnType<typeof useUiText>) {
  return [
    t("Pré-Lançamento", "Pre-launch", "Prelanzamiento"),
    t("Aquecimento Intenso", "Intense Warm-up", "Calentamiento intenso"),
    t("Abertura do Carrinho", "Cart Opens", "Apertura del carrito"),
    t("Urgência & Conversão", "Urgency & Conversion", "Urgencia y conversión"),
    t("Encerramento do Grupo", "Group Closure", "Cierre del grupo"),
  ][index] ?? "";
}
function dmScenarioLabel(id: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, string> = {
    payment_failed: t("Pagamento Recusado", "Payment Declined", "Pago rechazado"),
    link_not_working: t("Link Não Abre", "Link Won't Open", "El enlace no se abre"),
    product_question: t("Dúvida sobre o Produto", "Product Question", "Pregunta sobre el producto"),
    no_access: t("Sem Acesso após Compra", "No Access After Purchase", "Sin acceso tras la compra"),
    discount_request: t("Pedido de Desconto", "Discount Request", "Solicitud de descuento"),
    late_buyer: t("Quer Comprar Após Fechamento", "Wants to Buy After Cart Closes", "Quiere comprar tras el cierre"),
  };
  return labels[id] ?? id;
}
function dmScenarioDescription(id: string, t: ReturnType<typeof useUiText>) {
  const descriptions: Record<string, string> = {
    payment_failed: t("Cartão não aprovado ou erro no checkout", "Card declined or checkout error", "Tarjeta no aprobada o error en el pago"),
    link_not_working: t("Erro no link ou na página de checkout", "Broken link or checkout page error", "Error en el enlace o en la página de pago"),
    product_question: t("Perguntas sobre o conteúdo, metodologia ou garantia", "Questions about content, methodology, or guarantee", "Preguntas sobre el contenido, la metodología o la garantía"),
    no_access: t("Comprou mas não recebeu o acesso", "Purchased but did not receive access", "Compró pero no recibió el acceso"),
    discount_request: t("Quer condição especial ou prazo maior", "Asks for a special offer or more time", "Solicita una condición especial o más plazo"),
    late_buyer: t("Perdeu o prazo e quer uma última chance", "Missed the deadline and wants one last chance", "Se le pasó el plazo y quiere una última oportunidad"),
  };
  return descriptions[id] ?? "";
}
function dmScenarioTemplate(id: string, t: ReturnType<typeof useUiText>) {
  const scenario = DM_SCENARIOS.find(item => item.id === id);
  if (!scenario) return "";
  const translations: Record<string, [string, string]> = {
    payment_failed: [
      `Hi [NAME]! I noticed there was a problem with your payment. Don't worry — it happens more often than you might think, and it's easy to fix!

Here are a few options:
• Try another credit card
• Use PIX (instant and reliable)
• Contact your bank — online purchases are sometimes blocked for security

The offer link is still active: [LINK]

If you have any questions, just message me here!`,
      `¡Hola, [NOMBRE]! He visto que hubo un problema con tu pago. No te preocupes: es más común de lo que parece y tiene fácil solución.

Algunas opciones:
• Prueba con otra tarjeta
• Usa PIX (instantáneo y fiable)
• Contacta con tu banco; a veces bloquea compras en línea por seguridad

El enlace de la oferta sigue activo: [LINK]

Si tienes alguna duda, escríbeme por aquí.`,
    ],
    link_not_working: [
      `Hi [NAME]! Let's fix this right away!

Try this:
1. Copy and paste the link directly into your browser (don't click it)
2. Open it in a private window or a different browser
3. Clear your browser cache (Ctrl+Shift+Delete)
4. If you're on your phone, try using a computer

Direct link: [LINK]

If none of these work, send me a screenshot of the error and I'll help!`,
      `¡Hola, [NOMBRE]! Vamos a solucionarlo ahora mismo.

Prueba esto:
1. Copia y pega el enlace directamente en el navegador (no hagas clic)
2. Ábrelo en una ventana privada o en otro navegador
3. Borra la caché del navegador (Ctrl+Shift+Supr)
4. Si estás en el móvil, prueba desde un ordenador

Enlace directo: [LINK]

Si nada de esto funciona, envíame una captura del error y te ayudo.`,
    ],
    product_question: [
      `Hi [NAME]! Great question — I'm glad you reached out before deciding!

[PERSONALIZED_ANSWER]

And yes, you have a 7-day unconditional guarantee. If for any reason you're not satisfied, we'll refund 100% of your investment, no questions asked.

Any other questions? Feel free to ask! I'm here to help you make the best decision for you.`,
      `¡Hola, [NOMBRE]! Qué buena pregunta. Me alegra que me hayas escrito antes de decidirte.

[RESPUESTA_PERSONALIZADA]

Y sí, tienes 7 días de garantía incondicional. Si por cualquier motivo no quedas satisfecho/a, te devolvemos el 100 % de tu inversión, sin preguntas.

¿Tienes alguna otra duda? Pregunta con confianza. Estoy aquí para ayudarte a tomar la mejor decisión.`,
    ],
    no_access: [
      `Hi [NAME]! Let's sort this out right away! Sometimes the email goes to spam or there's a short delay on the platform.

- Check your spam and "Promotions" folders (if you use Gmail)
- Look for an email from [PLATFORM_NAME] or [SUPPORT_EMAIL]
- Wait up to 10 minutes — the system may take a little while

If you still can't find it after 15 minutes, send me:
• The email address you used for the purchase
• Your payment confirmation (screenshot)

I'll take care of it right away!`,
      `¡Hola, [NOMBRE]! Vamos a solucionarlo enseguida. A veces el correo llega a spam o hay un pequeño retraso en la plataforma.

- Revisa las carpetas de spam y «Promociones» (si usas Gmail)
- Busca un correo de [NOMBRE_PLATAFORMA] o [EMAIL_SOPORTE]
- Espera hasta 10 minutos; el sistema puede tardar un poco

Si no lo encuentras en 15 minutos, envíame:
• El correo que usaste para la compra
• La confirmación del pago (captura)

¡Lo resolveré enseguida!`,
    ],
    discount_request: [
      `Hi [NAME]! I completely understand — it's an investment, and I want you to feel comfortable!

The offer we have right now is already the best I can do: it's the launch price available only during this window. Once the cart closes, the price goes up to [REGULAR_PRICE].

Here's what I can offer:
• Split the payment into up to [X] card installments
• Get [X]% off with PIX

The transformation you'll get is worth much more than any discount I could offer. But I want you to join because you believe in the results, not just because of the price.

Tell me what's holding you back — I'll be honest with you!`,
      `¡Hola, [NOMBRE]! Lo entiendo perfectamente: es una inversión y quiero que te sientas cómodo/a.

La oferta actual ya es la mejor que puedo ofrecer: es el precio de lanzamiento, disponible solo durante este periodo. Cuando cerremos el carrito, el precio subirá a [PRECIO_NORMAL].

Esto es lo que puedo ofrecerte:
• Pagar en hasta [X] cuotas con tarjeta
• [X] % de descuento con PIX

La transformación que conseguirás vale mucho más que cualquier descuento. Pero quiero que te unas porque crees en el resultado, no solo por el precio.

Dime qué te frena y te hablaré con total sinceridad.`,
    ],
    late_buyer: [
      `Hi [NAME]! I'm sorry you couldn't join before the deadline, but I'm glad you reached out!

Usually the cart is already closed and we don't reopen it — it's a commitment to those who bought on time and receive special attention.

I can check whether there's still a spot and add you to a priority list for the next group. I can't promise anything, though — it depends on availability.

Would you like me to add you to the list?

When we open again, you'll be the first to know.`,
      `¡Hola, [NOMBRE]! Siento que no hayas podido entrar a tiempo, pero me alegra que te hayas puesto en contacto.

Normalmente el carrito ya está cerrado y no lo volvemos a abrir: es una forma de respetar a quienes compraron dentro del plazo y reciben atención especial.

Puedo comprobar si queda alguna plaza y añadirte a una lista prioritaria para la próxima edición. No puedo prometerlo; depende de la disponibilidad.

¿Quieres que te añada a la lista?

Cuando volvamos a abrir, serás la primera persona en enterarse.`,
    ],
  };
  const translated = translations[id];
  return translated ? t(scenario.template, translated[0], translated[1]) : scenario.template;
}
function postStatusLabel(status: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, string> = {
    draft: t("Rascunho", "Draft", "Borrador"),
    scheduled: t("Agendado", "Scheduled", "Programado"),
    published: t("Publicado", "Published", "Publicado"),
    failed: t("Falhou", "Failed", "Fallido"),
  };
  return labels[status] ?? status;
}

function useGroups(workspaceId: string) {
  const key = `nexos_launch_groups_${workspaceId}`;
  const [groups, setGroupsState] = useState<LaunchGroup[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
  });
  const save = useCallback((next: LaunchGroup[]) => {
    setGroupsState(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, [key]);
  const addGroup = (g: Omit<LaunchGroup, "id" | "createdAt" | "currentPhase" | "phases">) => {
    const newGroup: LaunchGroup = {
      ...g,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      currentPhase: 0,
      phases: GROUP_PHASES.map(p => ({ label: p.label, description: p.description, messages: [] })),
    };
    save([...groups, newGroup]);
    return newGroup;
  };
  const removeGroup = (id: string) => save(groups.filter(g => g.id !== id));
  const updateGroup = (id: string, patch: Partial<LaunchGroup>) =>
    save(groups.map(g => g.id === id ? { ...g, ...patch } : g));
  return { groups, addGroup, removeGroup, updateGroup };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBtn({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-xs font-mono uppercase tracking-widest transition-all rounded-none border-b-2 whitespace-nowrap
        ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50"}`}>
      {label}
    </button>
  );
}

function PlatformCard({ p, posts, onGenerate, generating }: {
  p: typeof PLATFORMS[0];
  posts: SocialPost[];
  onGenerate: () => void;
  generating: boolean;
}) {
  const t = useUiText();
  const Icon = p.icon;
  const platformPosts = posts.filter(post => post.platform === p.id || post.platform === (p.id === "instagram" || p.id === "facebook" ? "meta" : p.id));
  return (
    <div className={`border border-border/50 bg-card/40 ${p.borderGlow} transition-colors relative overflow-hidden`}>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-current/20 to-transparent opacity-50" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 border flex items-center justify-center ${p.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm uppercase tracking-wide">{p.label}</div>
            <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">{platformContentTypes(p.id, t).join(" · ")}</div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 text-muted-foreground border-border/40">
              {platformPosts.length} {t("posts", "posts", "publicaciones")}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          {platformSteps(p.id, t).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground/70">
              <span className={`shrink-0 font-bold text-[11px] mt-0.5 ${p.color.split(" ")[0]}`}>{String(i + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <Button onClick={onGenerate} disabled={generating}
          className={`w-full rounded-none font-mono uppercase text-xs tracking-widest h-9 gap-2 btn-weapon-outline border-current/30 ${p.color.split(" ")[0]}`}
          variant="outline">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? t("Gerando...", "Generating...", "Generando...") : t("Gerar Conteúdo com o agente", "Generate Content with Agent", "Generar contenido con el agente")}
        </Button>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { name: string; platform: "whatsapp" | "telegram"; link?: string; memberCount?: number }) => void }) {
  const t = useUiText();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"whatsapp" | "telegram">("whatsapp");
  const [link, setLink] = useState("");
  const [memberCount, setMemberCount] = useState("");

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-md shadow-2xl">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">{t("Novo Grupo de Lançamento", "New Launch Group", "Nuevo grupo de lanzamiento")}</h3>
            <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">{t("Configure o grupo de aquecimento", "Set up the launch warm-up group", "Configura el grupo de calentamiento")}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors font-mono text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{t("Nome do Grupo *", "Group Name *", "Nombre del grupo *")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("Ex: Grupo VIP - Lançamento Método X", "e.g. VIP Group - Method X Launch", "p. ej., Grupo VIP - Lanzamiento Método X")}
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{t("Plataforma *", "Platform *", "Plataforma *")}</label>
            <div className="grid grid-cols-2 gap-2">
              {(["whatsapp", "telegram"] as const).map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`border py-2.5 font-mono text-xs uppercase tracking-widest transition-all ${platform === p ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}>
                  {p === "whatsapp" ? "WhatsApp" : "Telegram"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{t("Link do Grupo (opcional)", "Group Link (optional)", "Enlace del grupo (opcional)")}</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/..."
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{t("Número de Membros (opcional)", "Member Count (optional)", "Número de miembros (opcional)")}</label>
            <input type="number" value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="e.g. 2500"
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
        </div>
        <div className="border-t border-border/50 px-5 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline">
            {t("Cancelar", "Cancel", "Cancelar")}
          </Button>
          <Button onClick={() => {
            if (!name.trim()) { toast.error(t("Nome do grupo é obrigatório", "Group name is required", "El nombre del grupo es obligatorio")); return; }
            onCreate({ name: name.trim(), platform, link: link || undefined, memberCount: memberCount ? parseInt(memberCount) : undefined });
            onClose();
          }} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            <Plus className="h-3.5 w-3.5" />{t("Criar Grupo", "Create Group", "Crear grupo")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const { workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<"platforms" | "groups" | "dm" | "analytics" | "intelligence">("platforms");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [generatingPlatform, setGeneratingPlatform] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const workspaceId = workspace?.id ?? "local";
  const { groups, addGroup, removeGroup } = useGroups(workspaceId);

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["/api/social/accounts"],
    queryFn: async () => {
      return customFetch<{ accounts: SocialAccount[] }>("/api/social/accounts")
        .catch(() => ({ accounts: [] as SocialAccount[] }));
    },
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/social/posts"],
    queryFn: async () => {
      return customFetch<{ posts: SocialPost[] }>("/api/social/posts?limit=50")
        .catch(() => ({ posts: [] as SocialPost[] }));
    },
  });

  const generatePlatformContent = async (platformId: string) => {
    setGeneratingPlatform(platformId);
    try {
      const platform = PLATFORMS.find(p => p.id === platformId)!;
      await customFetch<{ response?: string }>("/api/agents/direct-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentRole: "copywriter",
          message: `Crie um plano de conteúdo completo para ${platform.label} para um lançamento digital em PT-BR. 
Inclua: ${platform.strategy.join(", ")}.
Para cada etapa, escreva a copy completa pronta para uso.
Seja específico, persuasivo e use gatilhos mentais de autoridade, antecipação e escassez.`,
        }),
      });
      toast.success(t(`Conteúdo ${platform.label} gerado! Veja no chat de Agentes.`, `${platform.label} content generated! See it in Agent chat.`, `¡Contenido de ${platform.label} generado! Consúltalo en el chat de agentes.`));
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    } catch {
      toast.error(t("Erro ao gerar conteúdo. Verifique seus créditos.", "Could not generate content. Check your credits.", "No se pudo generar el contenido. Revisa tus créditos."));
    } finally {
      setGeneratingPlatform(null);
    }
  };

  const copyTemplate = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast.success(t("Template copiado!", "Template copied!", "¡Plantilla copiada!"));
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const TABS = [
    { id: "platforms" as const, label: t("Plataformas", "Platforms", "Plataformas") },
    { id: "analytics" as const, label: t("Analytics", "Analytics", "Analítica") },
    { id: "intelligence" as const, label: t("Inteligência", "Intelligence", "Inteligencia") },
    { id: "groups" as const, label: `${t("Grupos", "Groups", "Grupos")} (${groups.length})` },
    { id: "dm" as const, label: "DM Assist" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={(data) => {
            addGroup(data);
            toast.success(t(`Grupo "${data.name}" criado!`, `Group "${data.name}" created!`, `¡Grupo "${data.name}" creado!`));
          }}
        />
      )}

      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Social Launch Hub</h1>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {t("Estratégia multiplataforma · Grupos de aquecimento · Suporte por mensagem privada", "Cross-platform strategy · Launch groups · Private message support", "Estrategia multiplataforma · Grupos de lanzamiento · Soporte por mensajes privados")}
            </p>
          </div>
          {activeTab === "groups" && (
            <Button onClick={() => setShowCreateGroup(true)}
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />{t("Novo Grupo", "New Group", "Nuevo grupo")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 overflow-x-auto">
        {TABS.map(t => <TabBtn key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>

      {/* ══════════════ TAB: ANALYTICS ══════════════ */}
      {activeTab === "analytics" && <SocialAnalyticsTab />}

      {/* ══════════════ TAB: INTELLIGENCE ══════════════ */}
      {activeTab === "intelligence" && <SocialIntelligenceTab />}

      {/* ══════════════ TAB: PLATAFORMAS ══════════════ */}
      {activeTab === "platforms" && (
        <div className="space-y-5">
          {/* Platform grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLATFORMS.map(p => (
              <PlatformCard
                key={p.id}
                p={p}
                posts={postsData?.posts ?? []}
                onGenerate={() => generatePlatformContent(p.id)}
                generating={generatingPlatform === p.id}
              />
            ))}
          </div>

          {/* Recent posts */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">{t("Publicações Recentes", "Recent Posts", "Publicaciones recientes")}</h2>
            {postsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-muted/20" />)}</div>
            ) : (postsData?.posts ?? []).length === 0 ? (
              <div className="border border-border/30 bg-card/30 py-12 text-center">
                <Calendar className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("Nenhum post gerado ainda", "No posts generated yet", "Aún no se han generado publicaciones")}</p>
                  <p className="font-mono text-xs text-muted-foreground/40">{t('Clique em "Gerar Conteúdo com o agente" em qualquer plataforma acima', 'Click "Generate Content with Agent" on any platform above', 'Haz clic en "Generar contenido con el agente" en cualquiera de las plataformas')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(postsData?.posts ?? []).slice(0, 10).map(post => (
                  <div key={post.id} className="border border-border/40 bg-card/30 p-4 flex items-start gap-4">
                    <div className="flex flex-wrap items-center gap-2 mb-0 shrink-0">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${PLATFORM_COLOR[post.platform] ?? "text-muted-foreground border-border/50"}`}>{post.platform}</Badge>
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${POST_STATUS_COLOR[post.status] ?? ""}`}>{postStatusLabel(post.status, t)}</Badge>
                    </div>
                    {post.caption && <p className="text-xs font-mono text-foreground/70 leading-relaxed line-clamp-2 flex-1">{post.caption}</p>}
                    <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-muted-foreground/50">
                      {post.impressions && <span><Eye className="h-2.5 w-2.5 inline mr-1" />{post.impressions.toLocaleString(intlLocale(locale))}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: GRUPOS ══════════════ */}
      {activeTab === "groups" && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">{t("Como funciona", "How it works", "Cómo funciona")}</div>
              <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
                {t("Crie grupos de WhatsApp ou Telegram para aquecer seus leads antes da abertura do carrinho. O sistema gera as mensagens de cada fase com o agente e você dispara quando quiser. No encerramento, o grupo é fechado com agradecimento e entrega do link de acesso.", "Create WhatsApp or Telegram groups to warm up leads before the cart opens. The agent generates messages for each phase, and you send them whenever you choose. At the end, the group closes with thanks and an access link.", "Crea grupos de WhatsApp o Telegram para preparar a tus prospectos antes de abrir el carrito. El agente genera los mensajes de cada fase y tú decides cuándo enviarlos. Al final, el grupo se cierra con agradecimiento y el enlace de acceso.")}
              </p>
            </div>
          </div>

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="border border-border/30 bg-card/30 py-16 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("Nenhum grupo criado ainda", "No groups created yet", "Aún no has creado grupos")}</p>
              <p className="font-mono text-xs text-muted-foreground/40 mb-4">{t("Crie um grupo para começar a planejar o aquecimento do seu lançamento", "Create a group to start planning your launch warm-up", "Crea un grupo para empezar a planificar el lanzamiento")}</p>
              <Button onClick={() => setShowCreateGroup(true)}
                className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
                <Plus className="h-3.5 w-3.5" />{t("Criar Primeiro Grupo", "Create First Group", "Crear el primer grupo")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const phase = GROUP_PHASES[group.currentPhase];
                return (
                  <div key={group.id} className="border border-border/50 bg-card/40 p-5 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 inset-y-0 ${phase?.color.split(" ")[0].replace("text", "bg")}`} />
                    <div className="pl-3">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">{group.name}</h3>
                            <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${group.platform === "whatsapp" ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-blue-400 border-blue-400/40 bg-blue-400/10"}`}>
                              {group.platform === "whatsapp" ? "WhatsApp" : "Telegram"}
                            </Badge>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                            {group.memberCount ? `${group.memberCount.toLocaleString(intlLocale(locale))} ${t("membros", "members", "miembros")} · ` : ""}
                            {t("Criado", "Created", "Creado")} {new Date(group.createdAt).toLocaleDateString(intlLocale(locale))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${phase?.color}`}>
                            {phase?.emoji} {groupPhaseLabel(group.currentPhase, t)}
                          </Badge>
                        </div>
                      </div>

                      {/* Phase progress bar */}
                      <div className="flex gap-1 mb-3">
                        {GROUP_PHASES.map((p, i) => (
                          <div key={i} title={groupPhaseLabel(i, t)}
                            className={`h-1.5 flex-1 transition-all ${i <= group.currentPhase ? p.color.split(" ")[2] : "bg-muted/30"}`} />
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/social/groups/${group.id}`}>
                          <Button size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-8">
                            {t("Gerenciar Grupo", "Manage Group", "Gestionar grupo")}<ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {group.link && (
                          <Button size="sm" variant="outline" onClick={() => window.open(group.link, "_blank")}
                            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 h-8">
                            <ExternalLink className="h-3 w-3" />{t("Abrir Grupo", "Open Group", "Abrir grupo")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeGroup(group.id)} aria-label={t("Remover grupo", "Remove group", "Eliminar grupo")} title={t("Remover grupo", "Remove group", "Eliminar grupo")}
                          className="rounded-none font-mono uppercase text-xs tracking-widest h-8 text-muted-foreground/40 hover:text-destructive ml-auto">
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TAB: DM ASSIST ══════════════ */}
      {activeTab === "dm" && (
        <div className="space-y-5">
          {/* Info */}
          <div className="border border-cyan-400/20 bg-cyan-400/5 p-4 flex gap-3">
            <MessageSquare className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wide">{t("DM Assist — Suporte por Mensagem Privada", "DM Assist — Private Message Support", "DM Assist — Soporte por mensajes privados")}</div>
              <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
                {t("Templates prontos para os cenários mais comuns de suporte durante o lançamento. Personalize com o nome do lead, copie e envie pelo WhatsApp, Instagram DM ou Telegram. Use agente para personalizar ainda mais cada mensagem.", "Ready-made templates for common launch support scenarios. Personalize with the lead's name, then copy and send via WhatsApp, Instagram DM, or Telegram. Use the agent to further customize each message.", "Plantillas listas para situaciones habituales de soporte durante el lanzamiento. Personalízalas con el nombre del prospecto, copia y envía por WhatsApp, Instagram DM o Telegram. Usa el agente para adaptar cada mensaje.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DM_SCENARIOS.map(scenario => {
              const Icon = scenario.icon;
              return (
                <div key={scenario.id} className="border border-border/50 bg-card/40">
                  <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
                    <div className={`w-8 h-8 border border-current/20 bg-current/10 flex items-center justify-center ${scenario.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className={`font-mono font-bold text-xs uppercase tracking-wide ${scenario.color}`}>{dmScenarioLabel(scenario.id, t)}</div>
                      <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">{dmScenarioDescription(scenario.id, t)}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="bg-background/50 border border-border/30 p-3 rounded-sm">
                      <pre className="text-xs font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">{dmScenarioTemplate(scenario.id, t)}</pre>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyTemplate(scenario.id, scenario.template)}
                        className="rounded-none font-mono uppercase text-[11px] tracking-widest btn-weapon-outline gap-1.5 h-7 flex-1">
                        {copiedId === scenario.id ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
                        {copiedId === scenario.id ? t("Copiado!", "Copied!", "¡Copiado!") : t("Copiar Template", "Copy Template", "Copiar plantilla")}
                      </Button>
                      <Link href="/agents/copywriter">
                        <Button size="sm" variant="outline"
                          className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-purple-400/30 text-purple-400 hover:bg-purple-400/10">
                          <Bot className="h-2.5 w-2.5" />{t("Personalizar agente", "Customize with Agent", "Personalizar con el agente")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pro tip */}
          <div className="border border-border/30 bg-card/20 p-4">
            <div className="flex gap-3">
              <Target className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">{t("Dica Profissional", "Pro Tip", "Consejo profesional")}</div>
                <p className="font-mono text-xs text-muted-foreground/50 leading-relaxed">
                  {t("Configure mensagens de boas-vindas automáticas no WhatsApp Business para quem entra em contato durante o lançamento. Use a integração WhatsApp Business nas configurações para automatizar respostas com o agente.", "Set up automatic welcome messages in WhatsApp Business for people who contact you during the launch. Use the WhatsApp Business integration in settings to automate agent replies.", "Configura mensajes de bienvenida automáticos en WhatsApp Business para quienes te contacten durante el lanzamiento. Usa la integración de WhatsApp Business en ajustes para automatizar las respuestas del agente.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
