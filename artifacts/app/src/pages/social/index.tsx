import { useState, useCallback } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Share2, ExternalLink, CheckCircle2, XCircle, Loader2,
  Calendar, Eye, RefreshCw, Play, Instagram, Facebook,
  MessageSquare, Users, Plus, Copy, ChevronRight, Bot,
  Zap, Send, Phone, ArrowRight, Clock, Sparkles, Lock,
  AlertTriangle, Wifi, WifiOff, Target, TrendingUp, Radio,
} from "lucide-react";

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
    emoji: "🔥",
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
    emoji: "⚡",
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
    emoji: "🚀",
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
    emoji: "⏰",
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
    emoji: "🎯",
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
    template: `Oi [NOME]! Vi que houve um problema com seu pagamento. Não se preocupe — isso é mais comum do que parece e tem solução fácil! 🙏

Algumas opções para você:
• Tente outro cartão de crédito
• Use o PIX (instantâneo e sem risco de falha)
• Entre em contato com seu banco — às vezes bloqueiam compras online por segurança

O link da oferta ainda está ativo: [LINK]

Qualquer dúvida é só me chamar aqui mesmo! 💪`,
  },
  {
    id: "link_not_working",
    icon: ExternalLink,
    color: "text-orange-400",
    label: "Link Não Abre",
    description: "Erro no link ou na página de checkout",
    template: `Oi [NOME]! Vamos resolver isso agora mesmo! 🔧

Tenta isso:
1. Copie e cole o link diretamente no seu navegador (não clique)
2. Abra em modo anônimo / navegador diferente
3. Limpe o cache do navegador (Ctrl+Shift+Delete)
4. Se estiver no celular, tente pelo computador

Link direto: [LINK]

Se nenhuma dessas funcionar me manda um print do erro e eu te ajudo! 📱`,
  },
  {
    id: "product_question",
    icon: MessageSquare,
    color: "text-blue-400",
    label: "Dúvida sobre o Produto",
    description: "Perguntas sobre o conteúdo, metodologia ou garantia",
    template: `Oi [NOME]! Que ótima pergunta — fico feliz que tenha me chamado antes de decidir! 😊

[RESPOSTA_PERSONALIZADA]

E sim, você tem 7 dias de garantia incondicional. Se por qualquer motivo não ficar satisfeito(a), devolvemos 100% do seu investimento, sem perguntas.

Ficou alguma dúvida? Pode perguntar à vontade! Estou aqui para te ajudar a tomar a melhor decisão pra você. 🙏`,
  },
  {
    id: "no_access",
    icon: Lock,
    color: "text-yellow-400",
    label: "Sem Acesso após Compra",
    description: "Comprou mas não recebeu o acesso",
    template: `Oi [NOME]! Vamos resolver isso imediatamente! Isso acontece às vezes quando o e-mail cai no spam ou há um pequeno delay na plataforma.

✅ Verifique sua caixa de spam e a pasta "Promoções" (se for Gmail)
✅ Procure por um e-mail de [NOME_PLATAFORMA] ou [EMAIL_SUPORTE]
✅ Aguarde até 10 minutos — o sistema pode ter um pequeno delay

Se não encontrar em 15 minutos, me manda:
• O e-mail que você usou na compra
• A confirmação de pagamento (print)

Vou resolver na hora! 🚀`,
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

A transformação que você vai ter vale muito mais do que qualquer desconto que eu pudesse oferecer. Mas quero que entre porque acredita no resultado, não pelo preço. 🙏

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

E quando abrirmos de novo, você será a primeira pessoa avisada. 🙏`,
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
            <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">{p.contentTypes.join(" · ")}</div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 text-muted-foreground border-border/40">
              {platformPosts.length} posts
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          {p.strategy.map((step, i) => (
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
          {generating ? "Gerando..." : "Gerar Conteúdo com o agente"}
        </Button>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { name: string; platform: "whatsapp" | "telegram"; link?: string; memberCount?: number }) => void }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"whatsapp" | "telegram">("whatsapp");
  const [link, setLink] = useState("");
  const [memberCount, setMemberCount] = useState("");

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-md shadow-2xl">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">Novo Grupo de Lançamento</h3>
            <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">Configure o grupo de aquecimento</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors font-mono text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Nome do Grupo *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Grupo VIP - Lançamento Método X"
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Plataforma *</label>
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
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Link do Grupo (opcional)</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/..."
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">Número de Membros (opcional)</label>
            <input type="number" value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="Ex: 2500"
              className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30" />
          </div>
        </div>
        <div className="border-t border-border/50 px-5 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline">
            Cancelar
          </Button>
          <Button onClick={() => {
            if (!name.trim()) { toast.error("Nome do grupo é obrigatório"); return; }
            onCreate({ name: name.trim(), platform, link: link || undefined, memberCount: memberCount ? parseInt(memberCount) : undefined });
            onClose();
          }} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            <Plus className="h-3.5 w-3.5" />Criar Grupo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<"platforms" | "groups" | "dm">("platforms");
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
      toast.success(`Conteúdo ${platform.label} gerado! Veja no chat de Agentes.`);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    } catch {
      toast.error("Erro ao gerar conteúdo. Verifique seus créditos.");
    } finally {
      setGeneratingPlatform(null);
    }
  };

  const copyTemplate = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast.success("Template copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const TABS = [
    { id: "platforms" as const, label: "Plataformas" },
    { id: "groups" as const, label: `Grupos (${groups.length})` },
    { id: "dm" as const, label: "DM Assist" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={(data) => {
            addGroup(data);
            toast.success(`Grupo "${data.name}" criado!`);
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
              Estratégia multiplataforma · Grupos de aquecimento · Suporte por mensagem privada
            </p>
          </div>
          {activeTab === "groups" && (
            <Button onClick={() => setShowCreateGroup(true)}
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />Novo Grupo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 overflow-x-auto">
        {TABS.map(t => <TabBtn key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>

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
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">Publicações Recentes</h2>
            {postsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-muted/20" />)}</div>
            ) : (postsData?.posts ?? []).length === 0 ? (
              <div className="border border-border/30 bg-card/30 py-12 text-center">
                <Calendar className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Nenhum post gerado ainda</p>
                <p className="font-mono text-xs text-muted-foreground/40">Clique em "Gerar Conteúdo com o agente" em qualquer plataforma acima</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(postsData?.posts ?? []).slice(0, 10).map(post => (
                  <div key={post.id} className="border border-border/40 bg-card/30 p-4 flex items-start gap-4">
                    <div className="flex flex-wrap items-center gap-2 mb-0 shrink-0">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${PLATFORM_COLOR[post.platform] ?? "text-muted-foreground border-border/50"}`}>{post.platform}</Badge>
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${POST_STATUS_COLOR[post.status] ?? ""}`}>{post.status}</Badge>
                    </div>
                    {post.caption && <p className="text-xs font-mono text-foreground/70 leading-relaxed line-clamp-2 flex-1">{post.caption}</p>}
                    <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-muted-foreground/50">
                      {post.impressions && <span><Eye className="h-2.5 w-2.5 inline mr-1" />{post.impressions.toLocaleString()}</span>}
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
              <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">Como funciona</div>
              <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
                Crie grupos de WhatsApp ou Telegram para aquecer seus leads antes da abertura do carrinho.
                O sistema gera as mensagens de cada fase com o agente e você dispara quando quiser.
                No encerramento, o grupo é fechado com agradecimento e entrega do link de acesso.
              </p>
            </div>
          </div>

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="border border-border/30 bg-card/30 py-16 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Nenhum grupo criado ainda</p>
              <p className="font-mono text-xs text-muted-foreground/40 mb-4">Crie um grupo para começar a planejar o aquecimento do seu lançamento</p>
              <Button onClick={() => setShowCreateGroup(true)}
                className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
                <Plus className="h-3.5 w-3.5" />Criar Primeiro Grupo
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
                            {group.memberCount ? `${group.memberCount.toLocaleString()} membros · ` : ""}
                            Criado {new Date(group.createdAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${phase?.color}`}>
                            {phase?.emoji} {phase?.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Phase progress bar */}
                      <div className="flex gap-1 mb-3">
                        {GROUP_PHASES.map((p, i) => (
                          <div key={i} title={p.label}
                            className={`h-1.5 flex-1 transition-all ${i <= group.currentPhase ? p.color.split(" ")[2] : "bg-muted/30"}`} />
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/social/groups/${group.id}`}>
                          <Button size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-8">
                            Gerenciar Grupo<ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {group.link && (
                          <Button size="sm" variant="outline" onClick={() => window.open(group.link, "_blank")}
                            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 h-8">
                            <ExternalLink className="h-3 w-3" />Abrir Grupo
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeGroup(group.id)}
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
              <div className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wide">DM Assist — Suporte por Mensagem Privada</div>
              <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
                Templates prontos para os cenários mais comuns de suporte durante o lançamento.
                Personalize com o nome do lead, copie e envie pelo WhatsApp, Instagram DM ou Telegram.
                Use agente para personalizar ainda mais cada mensagem.
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
                      <div className={`font-mono font-bold text-xs uppercase tracking-wide ${scenario.color}`}>{scenario.label}</div>
                      <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">{scenario.description}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="bg-background/50 border border-border/30 p-3 rounded-sm">
                      <pre className="text-xs font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">{scenario.template}</pre>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyTemplate(scenario.id, scenario.template)}
                        className="rounded-none font-mono uppercase text-[11px] tracking-widest btn-weapon-outline gap-1.5 h-7 flex-1">
                        {copiedId === scenario.id ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
                        {copiedId === scenario.id ? "Copiado!" : "Copiar Template"}
                      </Button>
                      <Link href="/agents/copywriter">
                        <Button size="sm" variant="outline"
                          className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 border-purple-400/30 text-purple-400 hover:bg-purple-400/10">
                          <Bot className="h-2.5 w-2.5" />Personalizar agente
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
                <div className="font-mono text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">Dica Profissional</div>
                <p className="font-mono text-xs text-muted-foreground/50 leading-relaxed">
                  Configure mensagens de boas-vindas automáticas no WhatsApp Business para quem entra em contato durante o lançamento.
                  Use a integração WhatsApp Business nas configurações para automatizar respostas com o agente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
