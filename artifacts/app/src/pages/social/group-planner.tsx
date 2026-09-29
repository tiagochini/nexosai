import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  ChevronLeft, Sparkles, Send, Copy, CheckCircle2, Loader2,
  Users, ExternalLink, ArrowRight, MessageSquare, Phone, Clock,
  Zap, AlertTriangle, ChevronRight, RefreshCw, Lock,
} from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupMessage {
  id: string;
  label: string;
  content: string;
  generatedAt?: string;
  dispatchedAt?: string;
}

interface GroupPhaseData {
  label: string;
  description: string;
  messages: GroupMessage[];
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
  phases: GroupPhaseData[];
}

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASE_DEFS = [
  {
    label: "Pré-Lançamento",
    emoji: "🔥",
    color: "text-orange-400",
    borderColor: "border-orange-400/40",
    bgColor: "bg-orange-400/10",
    barColor: "bg-orange-400",
    days: "D-7 a D-3",
    description: "Aquecimento inicial — construção de autoridade, antecipação e engajamento",
    objective: "Engajar membros, gerar expectativa e posicionar a autoridade do especialista",
    messageDefs: [
      { id: "welcome", label: "Boas-vindas ao Grupo", prompt: "Escreva uma mensagem calorosa de boas-vindas para um grupo exclusivo de lançamento no WhatsApp. Mencione que é um espaço especial e exclusivo. Use emojis com moderação. Máximo 200 palavras." },
      { id: "value1", label: "Conteúdo de Valor — Dia 1", prompt: "Escreva uma mensagem de conteúdo de valor para um grupo de WhatsApp de lançamento (dia 1 de 5). Foque em apresentar o problema que o produto resolve de forma impactante. Use storytelling. Máximo 250 palavras." },
      { id: "value2", label: "Conteúdo de Valor — Dia 2", prompt: "Escreva uma mensagem de conteúdo de valor para um grupo de WhatsApp de lançamento (dia 2 de 5). Foque em prova social e resultados de outros alunos. Use casos reais e transformações. Máximo 250 palavras." },
      { id: "value3", label: "Antecipação — Bastidores", prompt: "Escreva uma mensagem de antecipação e bastidores para um grupo de WhatsApp de lançamento. Revele algo exclusivo sobre o produto que está por vir. Crie curiosidade e expectativa máxima. Máximo 200 palavras." },
    ],
  },
  {
    label: "Aquecimento Intenso",
    emoji: "⚡",
    color: "text-yellow-400",
    borderColor: "border-yellow-400/40",
    bgColor: "bg-yellow-400/10",
    barColor: "bg-yellow-400",
    days: "D-2 a D-1",
    description: "Antecipação máxima — build-up emocional e preparação para abertura",
    objective: "Criar máxima antecipação, revelar detalhes do produto e eliminar objeções antecipadas",
    messageDefs: [
      { id: "reveal", label: "Revelação Parcial do Produto", prompt: "Escreva uma mensagem revelando parcialmente o produto/programa para membros de um grupo de WhatsApp de lançamento. Gere curiosidade extrema sem revelar tudo. Mencione que a abertura é amanhã. Máximo 250 palavras." },
      { id: "countdown_morning", label: "Contagem Regressiva (D-1 manhã)", prompt: "Escreva uma mensagem de contagem regressiva para um grupo de WhatsApp: abre hoje à noite! Crie senso de urgência e antecipação. Pergunte se os membros estão prontos. Máximo 150 palavras." },
      { id: "countdown_night", label: "Lembrete Final (D-1 noite)", prompt: "Escreva uma mensagem de lembrete final para um grupo de WhatsApp: abertura do carrinho abre amanhã cedo! Mencione que as vagas são limitadas e quem está no grupo tem prioridade. Máximo 150 palavras." },
    ],
  },
  {
    label: "Abertura do Carrinho",
    emoji: "🚀",
    color: "text-green-400",
    borderColor: "border-green-400/40",
    bgColor: "bg-green-400/10",
    barColor: "bg-green-400",
    days: "D-0",
    description: "Abertura oficial — anúncio com link, condições e urgência inicial",
    objective: "Converter os mais quentes primeiro, estabelecer escassez e urgência real",
    messageDefs: [
      { id: "cart_open", label: "Anúncio de Abertura + Link", prompt: "Escreva a mensagem de abertura do carrinho para um grupo de WhatsApp de lançamento. Esta é a mensagem mais importante — inclua: o que é o produto, o valor da transformação, o preço e condições especiais, o link de compra [LINK], prazo de encerramento e por que agir AGORA. Use emojis com moderação. Máximo 350 palavras." },
      { id: "early_buyers", label: "Confirmação — Primeiros Compradores", prompt: "Escreva uma mensagem para celebrar e reconhecer os primeiros compradores em um grupo de WhatsApp de lançamento. Isso incentiva os indecisos a agir. Peça para quem comprou mandar um emoji específico. Máximo 150 palavras." },
      { id: "night_reminder", label: "Lembrete Noturno", prompt: "Escreva um lembrete noturno para um grupo de WhatsApp de lançamento (abertura do carrinho foi hoje). Mencione quantas vagas foram vendidas (sem dar número exato — use 'dezenas'), reforce a urgência e inclua o link [LINK]. Máximo 200 palavras." },
    ],
  },
  {
    label: "Urgência & Conversão",
    emoji: "⏰",
    color: "text-red-400",
    borderColor: "border-red-400/40",
    bgColor: "bg-red-400/10",
    barColor: "bg-red-400",
    days: "D+1 a D+6",
    description: "Fase de conversão intensa — objeções, provas sociais e escassez crescente",
    objective: "Converter indecisos com prova social, quebra de objeções e gatilhos de escassez",
    messageDefs: [
      { id: "testimonial", label: "Depoimento de Transformação (D+1)", prompt: "Escreva uma mensagem compartilhando um depoimento de aluno transformado para um grupo de WhatsApp de lançamento. Use formato narrativo: antes → depois. Inclua detalhes específicos que gerem credibilidade. Reforce o link [LINK]. Máximo 250 palavras." },
      { id: "objection", label: "Quebra de Objeção Principal (D+2)", prompt: "Escreva uma mensagem quebrando a objeção mais comum ('não tenho tempo / dinheiro / não é pra mim') para membros de grupo de WhatsApp de lançamento. Seja direto e empático. Termine com o link [LINK]. Máximo 250 palavras." },
      { id: "scarcity", label: "Aviso de Vagas Limitadas (D+3)", prompt: "Escreva uma mensagem de escassez real para grupo de WhatsApp de lançamento. Mencione que as vagas estão acabando (sem número exato). Crie senso de perda. Link: [LINK]. Máximo 200 palavras." },
      { id: "countdown_48h", label: "Contagem Regressiva 48h (D+5)", prompt: "Escreva uma mensagem avisando que faltam apenas 48 horas para encerrar o carrinho em um grupo de WhatsApp de lançamento. Seja urgente mas não desesperado. Liste os bônus que vão embora. Link: [LINK]. Máximo 200 palavras." },
      { id: "last_chance", label: "Último Aviso — 24h (D+6)", prompt: "Escreva a mensagem de último aviso para um grupo de WhatsApp de lançamento: encerra em 24 horas! Esta é a última chance. Seja emocionalmente impactante. Mencione o que a pessoa vai perder ao não agir. Link: [LINK]. Máximo 200 palavras." },
    ],
  },
  {
    label: "Encerramento do Grupo",
    emoji: "🎯",
    color: "text-purple-400",
    borderColor: "border-purple-400/40",
    bgColor: "bg-purple-400/10",
    barColor: "bg-purple-400",
    days: "D+7",
    description: "Encerramento honrado — agradecimento, entrega do link e fechamento do grupo",
    objective: "Honrar quem comprou, dar última chance e encerrar o grupo com gratidão",
    messageDefs: [
      { id: "closure_warning", label: "Aviso de Encerramento (manhã)", prompt: "Escreva uma mensagem avisando que o grupo de WhatsApp de lançamento vai ser encerrado hoje à noite. Esta é a última chance de comprar. Seja emocionante e crie urgência final. Link: [LINK]. Máximo 200 palavras." },
      { id: "final_link", label: "Último Link Disponível (tarde)", prompt: "Escreva a mensagem de último link disponível para um grupo de WhatsApp de lançamento — encerra em algumas horas. Use gatilho de arrependimento futuro. Este é literalmente o último momento. Link: [LINK]. Máximo 150 palavras." },
      { id: "thank_you", label: "🎯 Agradecimento Final + Link de Acesso", prompt: "Escreva a mensagem final de encerramento e agradecimento de um grupo de WhatsApp de lançamento. Esta é a mensagem mais importante da fase de encerramento. Inclua: agradecimento genuíno a todos que participaram, reconhecimento especial a quem comprou, entrega do link de acesso para os compradores [LINK_ACESSO], mensagem de esperança para quem não comprou (próxima turma), e despedida calorosa antes de encerrar o grupo. Seja autêntico e emocionante. Máximo 400 palavras." },
    ],
  },
];

function phaseLabel(index: number, t: ReturnType<typeof useUiText>) {
  const labels = [
    t("Pré-Lançamento", "Pre-launch", "Prelanzamiento"),
    t("Aquecimento Intenso", "Intense Warm-up", "Calentamiento intenso"),
    t("Abertura do Carrinho", "Cart Opens", "Apertura del carrito"),
    t("Urgência & Conversão", "Urgency & Conversion", "Urgencia y conversión"),
    t("Encerramento do Grupo", "Group Closure", "Cierre del grupo"),
  ];
  return labels[index] ?? "";
}
function phaseDescription(index: number, t: ReturnType<typeof useUiText>) {
  const values = [
    t("Aquecimento inicial — construção de autoridade, antecipação e engajamento", "Initial warm-up — building authority, anticipation, and engagement", "Calentamiento inicial: construir autoridad, anticipación e interacción"),
    t("Antecipação máxima — build-up emocional e preparação para abertura", "Maximum anticipation — emotional build-up and preparation for launch", "Máxima anticipación: crear expectativa emocional y preparar la apertura"),
    t("Abertura oficial — anúncio com link, condições e urgência inicial", "Official opening — announcement with link, terms, and initial urgency", "Apertura oficial: anuncio con enlace, condiciones y urgencia inicial"),
    t("Fase de conversão intensa — objeções, provas sociais e escassez crescente", "Intense conversion phase — objections, social proof, and increasing scarcity", "Fase de conversión intensa: objeciones, prueba social y escasez creciente"),
    t("Encerramento honrado — agradecimento, entrega do link e fechamento do grupo", "Thoughtful closure — thanks, access link delivery, and group closure", "Cierre con gratitud: agradecimiento, entrega del enlace y cierre del grupo"),
  ];
  return values[index] ?? "";
}
function phaseObjective(index: number, t: ReturnType<typeof useUiText>) {
  const values = [
    t("Engajar membros, gerar expectativa e posicionar a autoridade do especialista", "Engage members, build anticipation, and establish the expert's authority", "Involucrar a los miembros, generar expectativa y posicionar la autoridad del experto"),
    t("Criar máxima antecipação, revelar detalhes do produto e eliminar objeções antecipadas", "Build maximum anticipation, reveal product details, and address objections early", "Crear máxima anticipación, revelar detalles del producto y resolver objeciones por adelantado"),
    t("Converter os mais quentes primeiro, estabelecer escassez e urgência real", "Convert the warmest leads first and establish genuine scarcity and urgency", "Convertir primero a los prospectos más interesados y establecer escasez y urgencia reales"),
    t("Converter indecisos com prova social, quebra de objeções e gatilhos de escassez", "Convert undecided leads with social proof, objection handling, and scarcity", "Convertir a los indecisos con prueba social, resolución de objeciones y escasez"),
    t("Honrar quem comprou, dar última chance e encerrar o grupo com gratidão", "Recognize buyers, offer one last chance, and close the group with gratitude", "Reconocer a quienes compraron, ofrecer una última oportunidad y cerrar el grupo con gratitud"),
  ];
  return values[index] ?? "";
}
function messageLabel(label: string, t: ReturnType<typeof useUiText>) {
  const translations: Record<string, [string, string]> = {
    "Boas-vindas ao Grupo": ["Welcome to the Group", "Bienvenida al grupo"],
    "Conteúdo de Valor — Dia 1": ["Valuable Content — Day 1", "Contenido de valor — Día 1"],
    "Conteúdo de Valor — Dia 2": ["Valuable Content — Day 2", "Contenido de valor — Día 2"],
    "Antecipação — Bastidores": ["Anticipation — Behind the Scenes", "Anticipación — Entre bastidores"],
    "Revelação Parcial do Produto": ["Partial Product Reveal", "Revelación parcial del producto"],
    "Contagem Regressiva (D-1 manhã)": ["Countdown (D-1 morning)", "Cuenta atrás (D-1 por la mañana)"],
    "Lembrete Final (D-1 noite)": ["Final Reminder (D-1 night)", "Último recordatorio (D-1 por la noche)"],
    "Anúncio de Abertura + Link": ["Launch Announcement + Link", "Anuncio de apertura + enlace"],
    "Confirmação — Primeiros Compradores": ["Celebrating the First Buyers", "Celebración de las primeras compras"],
    "Lembrete Noturno": ["Evening Reminder", "Recordatorio nocturno"],
    "Depoimento de Transformação (D+1)": ["Transformation Testimonial (D+1)", "Testimonio de transformación (D+1)"],
    "Quebra de Objeção Principal (D+2)": ["Address the Main Objection (D+2)", "Resolver la objeción principal (D+2)"],
    "Aviso de Vagas Limitadas (D+3)": ["Limited Spots Notice (D+3)", "Aviso de plazas limitadas (D+3)"],
    "Contagem Regressiva 48h (D+5)": ["48-hour Countdown (D+5)", "Cuenta atrás de 48 h (D+5)"],
    "Último Aviso — 24h (D+6)": ["Last Notice — 24h (D+6)", "Último aviso — 24 h (D+6)"],
    "Aviso de Encerramento (manhã)": ["Closing Notice (morning)", "Aviso de cierre (mañana)"],
    "Último Link Disponível (tarde)": ["Last Link Available (afternoon)", "Último enlace disponible (tarde)"],
    "🎯 Agradecimento Final + Link de Acesso": ["🎯 Final Thanks + Access Link", "🎯 Agradecimiento final + enlace de acceso"],
  };
  const translated = translations[label];
  return translated ? t(label, translated[0], translated[1]) : label;
}

// ─── Hook: group storage ──────────────────────────────────────────────────────

function useGroup(groupId: string, workspaceId: string) {
  const key = `nexos_launch_groups_${workspaceId}`;

  const load = (): LaunchGroup | null => {
    try {
      const all: LaunchGroup[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      return all.find(g => g.id === groupId) ?? null;
    } catch { return null; }
  };

  const [group, setGroup] = useState<LaunchGroup | null>(load);

  useEffect(() => { setGroup(load()); }, [groupId]);

  const save = useCallback((updated: LaunchGroup) => {
    try {
      const all: LaunchGroup[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const next = all.map(g => g.id === groupId ? updated : g);
      localStorage.setItem(key, JSON.stringify(next));
      setGroup(updated);
    } catch { /* ignore */ }
  }, [groupId, key]);

  const updatePhaseMessage = (phaseIdx: number, msgId: string, content: string) => {
    if (!group) return;
    const phases = group.phases.map((p, pi) => {
      if (pi !== phaseIdx) return p;
      const existing = p.messages.find(m => m.id === msgId);
      if (existing) {
        return { ...p, messages: p.messages.map(m => m.id === msgId ? { ...m, content, generatedAt: new Date().toISOString() } : m) };
      }
      const def = PHASE_DEFS[pi]?.messageDefs.find(d => d.id === msgId);
      return { ...p, messages: [...p.messages, { id: msgId, label: def?.label ?? msgId, content, generatedAt: new Date().toISOString() }] };
    });
    save({ ...group, phases });
  };

  const markDispatched = (phaseIdx: number, msgId: string) => {
    if (!group) return;
    const phases = group.phases.map((p, pi) => {
      if (pi !== phaseIdx) return p;
      return { ...p, messages: p.messages.map(m => m.id === msgId ? { ...m, dispatchedAt: new Date().toISOString() } : m) };
    });
    save({ ...group, phases });
  };

  const advancePhase = () => {
    if (!group || group.currentPhase >= PHASE_DEFS.length - 1) return;
    save({ ...group, currentPhase: group.currentPhase + 1 });
  };

  return { group, updatePhaseMessage, markDispatched, advancePhase };
}

// ─── Message Card ─────────────────────────────────────────────────────────────

function MessageCard({
  phaseDef, msgDef, message, phaseIdx, onGenerate, onMarkDispatched, generating,
}: {
  phaseDef: typeof PHASE_DEFS[0];
  msgDef: { id: string; label: string; prompt: string };
  message?: GroupMessage;
  phaseIdx: number;
  onGenerate: (phaseIdx: number, msgId: string, prompt: string) => void;
  onMarkDispatched: (phaseIdx: number, msgId: string) => void;
  generating: boolean;
}) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const copyMsg = () => {
    if (!message?.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      toast.success(t("Mensagem copiada!", "Message copied!", "¡Mensaje copiado!"));
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isLast = msgDef.id === "thank_you";

  return (
    <div className={`border ${message?.dispatchedAt ? "border-success/30 bg-success/5" : "border-border/40 bg-card/30"} transition-colors`}>
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${message?.dispatchedAt ? "bg-success" : message?.content ? phaseDef.color.replace("text", "bg") : "bg-muted/50"}`} />
        <div className="flex-1 min-w-0">
          <span className={`font-mono text-xs font-bold uppercase tracking-wide ${isLast ? phaseDef.color : "text-foreground/80"}`}>
            {isLast && "🎯 "}{messageLabel(msgDef.label, t)}
          </span>
        </div>
        {message?.dispatchedAt && (
          <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 text-success border-success/40 bg-success/10 shrink-0">
            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />{t("Disparado", "Sent", "Enviado")}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        {message?.content ? (
          <div className="bg-background/60 border border-border/30 p-3">
            <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{message.content}</pre>
          </div>
        ) : (
          <div className="bg-muted/10 border border-dashed border-border/30 p-4 text-center">
            <Sparkles className={`h-5 w-5 mx-auto mb-1.5 ${phaseDef.color}`} />
            <p className="font-mono text-xs text-muted-foreground/50">{t("Mensagem não gerada ainda", "Message not generated yet", "El mensaje aún no se ha generado")}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onGenerate(phaseIdx, msgDef.id, msgDef.prompt)}
            disabled={generating}
            className={`rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-current/30 hover:bg-current/10 ${phaseDef.color}`}>
            {generating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
            {generating ? t("Gerando...", "Generating...", "Generando...") : message?.content ? t("Regenerar", "Regenerate", "Regenerar") : t("Gerar com o agente", "Generate with agent", "Generar con el agente")}
          </Button>

          {message?.content && (
            <>
              <Button size="sm" variant="outline" onClick={copyMsg}
                className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline">
                {copied ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
                {copied ? t("Copiado!", "Copied!", "¡Copiado!") : t("Copiar", "Copy", "Copiar")}
              </Button>

              {!message.dispatchedAt && (
                <Button size="sm" variant="outline" onClick={() => onMarkDispatched(phaseIdx, msgDef.id)}
                  className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-success/30 text-success hover:bg-success/10">
                  <CheckCircle2 className="h-2.5 w-2.5" />{t("Marcar Disparado", "Mark as Sent", "Marcar como enviado")}
                </Button>
              )}
            </>
          )}
        </div>

        {message?.generatedAt && (
          <div className="text-[11px] font-mono text-muted-foreground/30 uppercase tracking-widest">
            {t("Gerado em", "Generated", "Generado el")} {new Date(message.generatedAt).toLocaleString(intlLocale(locale))}
            {message.dispatchedAt && ` · ${t("Disparado em", "Sent", "Enviado el")} ${new Date(message.dispatchedAt).toLocaleString(intlLocale(locale))}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupPlannerPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id ?? "";
  const t = useUiText();
  const { locale } = useUiLocale();
  const { workspace } = useAuth();
  const workspaceId = workspace?.id ?? "local";
  const { group, updatePhaseMessage, markDispatched, advancePhase } = useGroup(groupId, workspaceId);

  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    if (group) setActivePhase(group.currentPhase);
  }, [group?.currentPhase]);

  const generateMutation = useMutation({
    mutationFn: async ({ phaseIdx, msgId, prompt }: { phaseIdx: number; msgId: string; prompt: string }) => {
      setGeneratingKey(`${phaseIdx}-${msgId}`);
      const data = await customFetch<{ response?: string }>("/api/agents/direct-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentRole: "copywriter",
          message: `${prompt}\n\nNome do grupo: ${group?.name ?? "Grupo VIP"}\nPlataforma: ${group?.platform === "whatsapp" ? "WhatsApp" : "Telegram"}\n\nResponda APENAS com o texto da mensagem, pronto para copiar e colar. Sem títulos, sem formatação Markdown, apenas o texto puro.`,
        }),
      });
      return { phaseIdx, msgId, content: data.response ?? "" };
    },
    onSuccess: ({ phaseIdx, msgId, content }) => {
      updatePhaseMessage(phaseIdx, msgId, content);
      toast.success(t("Mensagem gerada com sucesso!", "Message generated successfully!", "¡Mensaje generado correctamente!"));
    },
    onError: () => toast.error(t("Erro ao gerar mensagem. Verifique seus créditos do agente.", "Could not generate the message. Check your agent credits.", "No se pudo generar el mensaje. Revisa los créditos del agente.")),
    onSettled: () => setGeneratingKey(null),
  });

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/social">
            <Button variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase tracking-widest gap-2 text-muted-foreground">
              <ChevronLeft className="h-3.5 w-3.5" />{t("Voltar", "Back", "Volver")}
            </Button>
          </Link>
        </div>
        <div className="border border-border/50 bg-card/40 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mb-1">{t("Grupo não encontrado", "Group not found", "Grupo no encontrado")}</p>
          <p className="font-mono text-xs text-muted-foreground/50 mb-4">{t("Este grupo pode ter sido removido ou o link está incorreto", "This group may have been removed or the link is incorrect", "Es posible que se haya eliminado el grupo o que el enlace sea incorrecto")}</p>
          <Link href="/social">
            <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline" variant="outline">
              {t("Ver Todos os Grupos", "View All Groups", "Ver todos los grupos")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentPhaseDef = PHASE_DEFS[activePhase]!;
  const messagesInPhase = group.phases[activePhase]?.messages ?? [];
  const totalMessages = currentPhaseDef.messageDefs.length;
  const generatedCount = currentPhaseDef.messageDefs.filter(d => messagesInPhase.find(m => m.id === d.id)).length;
  const dispatchedCount = currentPhaseDef.messageDefs.filter(d => messagesInPhase.find(m => m.id === d.id && m.dispatchedAt)).length;

  const allGenerated = generatedCount === totalMessages;
  const isLastPhase = activePhase === PHASE_DEFS.length - 1;
  const isCurrentPhase = activePhase === group.currentPhase;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/social">
          <Button variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase tracking-widest gap-2 text-muted-foreground mb-4 -ml-2">
            <ChevronLeft className="h-3.5 w-3.5" />{t("Social Launch Hub", "Social Launch Hub", "Centro de lanzamientos sociales")}
          </Button>
        </Link>
        <div className="border-b border-border/50 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${group.platform === "whatsapp" ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-blue-400 border-blue-400/40 bg-blue-400/10"}`}>
                  {group.platform === "whatsapp" ? "WhatsApp" : "Telegram"}
                </Badge>
                {group.memberCount && (
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 text-muted-foreground border-border/40">
                    <Users className="h-2.5 w-2.5 mr-1" />{group.memberCount.toLocaleString(intlLocale(locale))} {t("membros", "members", "miembros")}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-mono uppercase tracking-tighter font-bold">{group.name}</h1>
              <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                {t("Fase atual:", "Current phase:", "Fase actual:")} {PHASE_DEFS[group.currentPhase]?.emoji} {phaseLabel(group.currentPhase, t)} · {PHASE_DEFS[group.currentPhase]?.days}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {group.link && (
                <Button size="sm" variant="outline" onClick={() => window.open(group.link, "_blank")}
                  className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 h-8">
                  <ExternalLink className="h-3 w-3" />{t("Abrir Grupo", "Open Group", "Abrir grupo")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phase navigation */}
      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PHASE_DEFS.map((p, i) => {
            const phaseMessages = group.phases[i]?.messages ?? [];
            const phaseGenerated = p.messageDefs.filter(d => phaseMessages.find(m => m.id === d.id)).length;
            const isActive = activePhase === i;
            const isCurrent = group.currentPhase === i;
            const isDone = i < group.currentPhase;
            return (
              <button key={i} onClick={() => setActivePhase(i)}
                className={`flex-1 min-w-[140px] border py-2.5 px-3 text-left transition-all group ${
                  isActive ? `${p.borderColor} ${p.bgColor}` : isDone ? "border-success/20 bg-success/5" : "border-border/40 bg-card/30 hover:border-border/60"
                }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{p.emoji}</span>
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  {isDone && <CheckCircle2 className="h-3 w-3 text-success" />}
                </div>
                <div className={`font-mono text-[11px] font-bold uppercase tracking-widest truncate ${isActive ? p.color : isDone ? "text-success" : "text-muted-foreground/60"}`}>
                  {phaseLabel(i, t)}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">{p.days}</div>
                <div className="mt-1.5 flex gap-0.5">
                  {p.messageDefs.map(d => {
                    const m = phaseMessages.find(msg => msg.id === d.id);
                    return (
                      <div key={d.id} className={`h-1 flex-1 rounded-full ${m?.dispatchedAt ? "bg-success" : m ? p.color.replace("text", "bg") : "bg-muted/30"}`} />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase detail */}
      <div className="space-y-5">
        {/* Phase header */}
        <div className={`border ${currentPhaseDef.borderColor} ${currentPhaseDef.bgColor} p-4`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentPhaseDef.emoji}</span>
                <h2 className={`font-mono font-bold text-base uppercase tracking-wider ${currentPhaseDef.color}`}>{phaseLabel(activePhase, t)}</h2>
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${currentPhaseDef.color} ${currentPhaseDef.borderColor}`}>
                  {currentPhaseDef.days}
                </Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{phaseDescription(activePhase, t)}</p>
              <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50">
                <Zap className="h-2.5 w-2.5" />
                <span className="uppercase tracking-widest">{phaseObjective(activePhase, t)}</span>
              </div>
            </div>
            <div className="text-right space-y-1 shrink-0">
              <div className={`font-mono text-lg font-bold ${currentPhaseDef.color}`}>{generatedCount}/{totalMessages}</div>
              <div className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">{t("mensagens geradas", "messages generated", "mensajes generados")}</div>
              <div className="font-mono text-[11px] text-success uppercase tracking-widest">{dispatchedCount} {t("disparadas", "sent", "enviados")}</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3">
          {currentPhaseDef.messageDefs.map(msgDef => {
            const message = messagesInPhase.find(m => m.id === msgDef.id);
            const gKey = `${activePhase}-${msgDef.id}`;
            return (
              <MessageCard
                key={msgDef.id}
                phaseDef={currentPhaseDef}
                msgDef={msgDef}
                message={message}
                phaseIdx={activePhase}
                onGenerate={(pi, mid, prompt) => generateMutation.mutate({ phaseIdx: pi, msgId: mid, prompt })}
                onMarkDispatched={markDispatched}
                generating={generatingKey === gKey && generateMutation.isPending}
              />
            );
          })}
        </div>

        {/* Phase actions */}
        <div className="border border-border/30 bg-card/20 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="font-mono text-xs font-bold text-foreground/70 uppercase tracking-wide">
              {isCurrentPhase ? t("Fase Atual", "Current Phase", "Fase actual") : activePhase < group.currentPhase ? t("Fase Concluída", "Phase Completed", "Fase completada") : t("Próxima Fase", "Next Phase", "Fase siguiente")}
            </div>
            <div className="font-mono text-xs text-muted-foreground/50">
              {isCurrentPhase && !isLastPhase && t("Gere e dispare todas as mensagens antes de avançar para a próxima fase", "Generate and send all messages before advancing to the next phase", "Genera y envía todos los mensajes antes de pasar a la siguiente fase")}
              {isCurrentPhase && isLastPhase && t("Esta é a fase final — após o encerramento, o grupo deve ser fechado", "This is the final phase — the group should be closed after it ends", "Esta es la fase final; al terminar, se debe cerrar el grupo")}
              {!isCurrentPhase && activePhase < group.currentPhase && t("Esta fase já foi concluída e avançada", "This phase has been completed and advanced", "Esta fase ya se completó y se avanzó")}
              {!isCurrentPhase && activePhase > group.currentPhase && t("Conclua as fases anteriores antes de avançar até aqui", "Complete earlier phases before advancing to this one", "Completa las fases anteriores antes de avanzar hasta aquí")}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isCurrentPhase && !isLastPhase && (
              <Button onClick={advancePhase}
                className={`rounded-none font-mono uppercase text-xs tracking-widest gap-2 h-9 btn-weapon-primary`}>
                <ArrowRight className="h-3.5 w-3.5" />{t("Avançar para", "Advance to", "Avanzar a")} {phaseLabel(activePhase + 1, t)}
              </Button>
            )}
            {isCurrentPhase && isLastPhase && (
              <div className={`border ${currentPhaseDef.borderColor} ${currentPhaseDef.bgColor} px-4 py-2 font-mono text-xs ${currentPhaseDef.color} uppercase tracking-widest flex items-center gap-2`}>
                <Lock className="h-3.5 w-3.5" />{t("Grupo Encerrado após esta fase", "Group Closes after this Phase", "El grupo se cierra después de esta fase")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
