import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ChevronLeft, Sparkles, Edit3,
  Instagram, Mail, MessageSquare, Globe, Calendar,
  Users, Loader2, Send, ChevronRight, Eye,
  BarChart3, ArrowRight, RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContentPiece {
  id: string;
  platform: "instagram" | "email" | "whatsapp" | "landing" | "ads" | "facebook";
  type: "post" | "story" | "email" | "message" | "ad" | "copy";
  dayIndex: number;
  title: string;
  body: string;
  callToAction?: string;
  status: "pending" | "approved" | "rejected" | "edited";
  segment?: "hot" | "warm" | "cold" | "all";
  estimatedReach?: number;
  estimatedCost?: number;
}

interface ContentPlan {
  campaignId: string;
  campaignTitle: string;
  campaignStatus: string;
  totalPieces: number;
  approved: number;
  rejected: number;
  pending: number;
  pieces: ContentPiece[];
  startDate?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_ICON: Record<string, React.ElementType> = {
  instagram: Instagram, email: Mail, whatsapp: MessageSquare,
  landing: Globe, ads: BarChart3, facebook: Globe,
};
const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", email: "E-mail", whatsapp: "WhatsApp",
  landing: "Landing Page", ads: "Ads", facebook: "Facebook",
};
const PLATFORM_COLOR: Record<string, string> = {
  instagram: "text-pink-400 border-pink-400/40 bg-pink-400/10",
  email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
  landing: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  ads: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  facebook: "text-indigo-400 border-indigo-400/40 bg-indigo-400/10",
};
const SEGMENT_LABEL: Record<string, string> = {
  hot: "Quentes", warm: "Mornos", cold: "Frios", all: "Todos",
};
const SEGMENT_COLOR: Record<string, string> = {
  hot: "text-red-400 border-red-400/40 bg-red-400/10",
  warm: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  cold: "text-blue-300 border-blue-300/40 bg-blue-300/10",
  all: "text-muted-foreground border-border/40 bg-muted/10",
};

// ── Mock content generator (used when API has no content yet) ─────────────────
function generateMockPlan(campaignTitle: string): ContentPlan {
  const pieces: ContentPiece[] = [
    // Day 0 — Anticipation
    { id: "1", platform: "instagram", type: "post", dayIndex: 0, title: "Teaser de Lançamento", body: "Algo grande está chegando. 🔥\n\nDurante os próximos 7 dias vou revelar o método que me ajudou a sair do zero para os 6 dígitos em um lançamento.\n\nSiga de perto. Não vai querer perder isso.", callToAction: "Ative as notificações agora", status: "pending", segment: "all", estimatedReach: 1200 },
    { id: "2", platform: "email", type: "email", dayIndex: 0, title: "Algo está chegando (abertura da lista)", body: "Olá {nome},\n\nNos próximos 7 dias vou compartilhar algo que mudou completamente minha forma de trabalhar com lançamentos digitais.\n\nFique de olho na sua caixa de entrada.\n\nAté logo,\n{nome_do_produtor}", callToAction: "Confirmar que recebeu →", status: "pending", segment: "all", estimatedCost: 0 },
    // Day 1 — Authority
    { id: "3", platform: "instagram", type: "story", dayIndex: 1, title: "Prova Social — Story", body: "Você sabia que 87% dos lançamentos falham por falta de estratégia?\n\nNos últimos 3 anos trabalhei com +200 produtores. Vi os que venderam e os que não venderam.\n\nAmanhã conto o que separa os dois.", status: "pending", segment: "all", estimatedReach: 800 },
    { id: "4", platform: "whatsapp", type: "message", dayIndex: 1, title: "Aquecimento — Lista VIP", body: "Oi {nome} 👋\n\nAmanhã começa algo especial. Você está na lista VIP, então vai receber em primeira mão.\n\nPrepara o café e fica de olho amanhã cedo.", status: "pending", segment: "hot", estimatedReach: 340 },
    // Day 2 — Content
    { id: "5", platform: "email", type: "email", dayIndex: 2, title: "O Erro que Quase Me Quebrou (Conteúdo)", body: "Olá {nome},\n\nEm 2021 eu investi R$ 47.000 em tráfego para um lançamento que vendeu R$ 3.200.\n\nEu errei na estratégia. Hoje eu conto o que aprendi com isso — e como você pode evitar o mesmo caminho.\n\n[Ler o artigo completo]\n\nNos vemos amanhã,\n{nome}", callToAction: "Ler o método completo →", status: "approved", segment: "warm", estimatedCost: 0 },
    { id: "6", platform: "instagram", type: "post", dayIndex: 2, title: "Carrossel — Os 3 Pilares do Lançamento", body: "Slide 1: Os 3 pilares de todo lançamento que passa dos 6 dígitos\n\nSlide 2: Pilar 1 — Audiência Aquecida\nSlide 3: Pilar 2 — Prova de Transformação\nSlide 4: Pilar 3 — Momento de Decisão\nSlide 5: Qual deles você está ignorando?", status: "pending", segment: "all", estimatedReach: 1800 },
    // Day 5 — Carrinho
    { id: "7", platform: "email", type: "email", dayIndex: 5, title: "🚀 ABRIU — Acesso Liberado", body: "Olá {nome},\n\n✅ O acesso acabou de abrir.\n\nSe você acompanhou tudo essa semana, sabe que esse método muda o jogo.\n\nMas o preço de lançamento fecha em 72h.\n\n[QUERO MEU ACESSO AGORA →]", callToAction: "Garantir acesso →", status: "pending", segment: "hot", estimatedCost: 0 },
    { id: "8", platform: "ads", type: "ad", dayIndex: 5, title: "Meta Ads — Retargeting Carrinho", body: "Você viu o conteúdo dessa semana.\nAgora é a hora de agir.\n\n🔥 {nome_do_produto} está com preço de lançamento.\nEsse preço não vai se repetir.\n\n[Garantir minha vaga →]", callToAction: "Garantir minha vaga →", status: "pending", segment: "warm", estimatedCost: 35000 },
    // Day 7 — Fechamento
    { id: "9", platform: "whatsapp", type: "message", dayIndex: 7, title: "Último Dia — Urgência VIP", body: "⚠️ {nome}, faltam só 4h.\n\nO preço de lançamento fecha à meia-noite de hoje.\n\nDepois disso só entra quem pagar o preço cheio (50% mais caro).\n\nSe você quer entrar, agora é a hora 👇\n[LINK]", status: "pending", segment: "hot", estimatedReach: 340 },
    { id: "10", platform: "email", type: "email", dayIndex: 7, title: "Último aviso — Fecha à meia-noite", body: "Olá {nome},\n\nEssa é minha última mensagem sobre {nome_do_produto}.\n\nÀ meia-noite de hoje o preço sobe.\n\nSe você chegou até aqui, sabe que esse método funciona. Agora é com você.\n\n[QUERO ENTRAR — ÚLTIMAS HORAS →]", callToAction: "Último acesso →", status: "pending", segment: "cold" },
  ];

  const pending = pieces.filter(p => p.status === "pending").length;
  const approved = pieces.filter(p => p.status === "approved").length;

  return {
    campaignId: "mock", campaignTitle,
    campaignStatus: "awaiting_approval",
    totalPieces: pieces.length, approved, rejected: 0, pending,
    pieces,
  };
}

// ── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({
  piece,
  onApprove,
  onReject,
  onEdit,
  onAiRewrite,
  loading,
}: {
  piece: ContentPiece;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (piece: ContentPiece) => void;
  onAiRewrite: (id: string) => void;
  loading?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const PlatformIcon = PLATFORM_ICON[piece.platform] ?? Globe;
  const platformColor = PLATFORM_COLOR[piece.platform] ?? "text-muted-foreground border-border/40";

  const statusBorder = piece.status === "approved" ? "border-success/40" :
                       piece.status === "rejected"  ? "border-destructive/40" :
                                                      "border-border/50";
  const isLoading = loading === piece.id;

  return (
    <div className={`border bg-card/40 transition-all relative overflow-hidden ${statusBorder}`}>
      {/* Status strip */}
      <div className={`absolute left-0 inset-y-0 w-[3px] ${
        piece.status === "approved" ? "bg-success" :
        piece.status === "rejected" ? "bg-destructive" :
        "bg-border/30"
      }`} />

      <div className="pl-4 pr-4 py-3">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-7 h-7 border rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${platformColor}`}>
            <PlatformIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${platformColor}`}>
                {PLATFORM_LABEL[piece.platform]}
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                Dia {piece.dayIndex}
              </span>
              {piece.segment && piece.segment !== "all" && (
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${SEGMENT_COLOR[piece.segment]}`}>
                  {SEGMENT_LABEL[piece.segment]}
                </Badge>
              )}
              {piece.status !== "pending" && (
                <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${
                  piece.status === "approved" ? "text-success border-success/40 bg-success/10" :
                  piece.status === "rejected" ? "text-destructive border-destructive/40 bg-destructive/10" :
                  "text-blue-400 border-blue-400/40 bg-blue-400/10"
                }`}>
                  {piece.status === "approved" ? "Aprovado" : piece.status === "rejected" ? "Rejeitado" : "Editado"}
                </Badge>
              )}
            </div>
            <h3 className="font-mono font-bold text-sm text-foreground leading-tight">{piece.title}</h3>
          </div>
        </div>

        {/* Body preview */}
        <div className={`font-mono text-xs text-muted-foreground bg-muted/10 border border-border/30 p-3 rounded-sm mb-3 whitespace-pre-line leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
          {piece.body}
        </div>
        {piece.body.length > 120 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="font-mono text-[11px] uppercase tracking-widest text-primary hover:text-primary/80 mb-3 flex items-center gap-1"
          >
            {expanded ? "Menos" : "Ver tudo"} <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}

        {piece.callToAction && (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">CTA:</span>
            <span className="font-mono text-xs text-primary border border-primary/30 bg-primary/5 px-2 py-0.5">{piece.callToAction}</span>
          </div>
        )}

        {/* Stats */}
        {(piece.estimatedReach || piece.estimatedCost) && (
          <div className="flex gap-4 mb-3">
            {piece.estimatedReach && (
              <div className="text-[11px] font-mono text-muted-foreground/50">
                Alcance est. <span className="text-foreground/70">{piece.estimatedReach.toLocaleString("pt-BR")}</span>
              </div>
            )}
            {piece.estimatedCost && piece.estimatedCost > 0 && (
              <div className="text-[11px] font-mono text-muted-foreground/50">
                Budget <span className="text-yellow-400">R$ {(piece.estimatedCost / 100).toLocaleString("pt-BR")}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {piece.status !== "approved" && (
            <Button
              size="sm"
              onClick={() => onApprove(piece.id)}
              disabled={isLoading}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 bg-success/10 border border-success/40 text-success hover:bg-success/20"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Aprovar
            </Button>
          )}
          {piece.status !== "rejected" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(piece.id)}
              disabled={isLoading}
              className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-3 w-3" />Rejeitar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(piece)}
            className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="h-3 w-3" />Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAiRewrite(piece.id)}
            disabled={isLoading}
            className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />IA Reescrever
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ piece, onClose, onSave }: { piece: ContentPiece; onClose: () => void; onSave: (id: string, body: string, cta: string) => void }) {
  const [body, setBody] = useState(piece.body);
  const [cta, setCta] = useState(piece.callToAction ?? "");
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border/50 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold uppercase tracking-widest text-sm">Editar Peça</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Conteúdo</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-3 resize-y text-foreground leading-relaxed"
            />
          </div>
          {piece.callToAction !== undefined && (
            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Call to Action</label>
              <input
                value={cta}
                onChange={e => setCta(e.target.value)}
                className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-2 text-foreground"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(piece.id, body, cta)} className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />Salvar e Aprovar
            </Button>
            <Button variant="ghost" onClick={onClose} className="rounded-none font-mono uppercase tracking-widest h-9 text-xs text-muted-foreground">
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "platform" | "schedule" | "segmentation";

export default function ContentApproval() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("platform");
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [loadingPiece, setLoadingPiece] = useState<string | null>(null);
  const [localPieces, setLocalPieces] = useState<ContentPiece[] | null>(null);

  // Try to fetch real content from API
  const { data: campaignData, isLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}`],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ campaign: { id: string; title: string; status: string } }>;
    },
    enabled: !!campaignId,
  });

  const campaign = campaignData?.campaign;

  // Use mock plan (in real app this would come from API)
  const plan: ContentPlan = localPieces
    ? { ...generateMockPlan(campaign?.title ?? "Campanha"), pieces: localPieces }
    : generateMockPlan(campaign?.title ?? "Campanha");

  const pieces = plan.pieces;
  const approvedCount = pieces.filter(p => p.status === "approved").length;
  const pendingCount  = pieces.filter(p => p.status === "pending").length;
  const rejectedCount = pieces.filter(p => p.status === "rejected").length;
  const pct = Math.round((approvedCount / pieces.length) * 100);

  const setPieces = (fn: (prev: ContentPiece[]) => ContentPiece[]) => {
    setLocalPieces(prev => fn(prev ?? pieces));
  };

  const handleApprove = async (id: string) => {
    setLoadingPiece(id);
    await new Promise(r => setTimeout(r, 400));
    setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
    setLoadingPiece(null);
    toast.success("Peça aprovada");
  };

  const handleReject = (id: string) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "rejected" } : p));
    toast.info("Peça rejeitada");
  };

  const handleAiRewrite = async (id: string) => {
    setLoadingPiece(id);
    toast.info("IA reescrevendo...");
    await new Promise(r => setTimeout(r, 2000));
    setPieces(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, body: p.body + "\n\n[Versão reescrita pela IA — clique em Editar para refinar]" };
    }));
    setLoadingPiece(null);
    toast.success("IA reescreveu a peça. Revise e aprove.");
  };

  const handleSaveEdit = (id: string, body: string, cta: string) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, body, callToAction: cta, status: "approved" } : p));
    setEditingPiece(null);
    toast.success("Peça editada e aprovada");
  };

  const handleApproveAll = async () => {
    setPieces(prev => prev.map(p => p.status === "pending" ? { ...p, status: "approved" } : p));
    toast.success(`${pendingCount} peças aprovadas`);
  };

  // Group by platform
  const byPlatform = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    if (!acc[p.platform]) acc[p.platform] = [];
    acc[p.platform].push(p);
    return acc;
  }, {});

  // Group by day
  const byDay = pieces.reduce<Record<number, ContentPiece[]>>((acc, p) => {
    if (!acc[p.dayIndex]) acc[p.dayIndex] = [];
    acc[p.dayIndex].push(p);
    return acc;
  }, {});

  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  // Group by segment
  const bySegment = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    const seg = p.segment ?? "all";
    if (!acc[seg]) acc[seg] = [];
    acc[seg].push(p);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 bg-muted/20" />)}</div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "platform",     label: "Por Plataforma",   icon: Globe },
    { id: "schedule",     label: "Cronograma",        icon: Calendar },
    { id: "segmentation", label: "Segmentação",       icon: Users },
  ];

  return (
    <>
      {editingPiece && (
        <EditModal
          piece={editingPiece}
          onClose={() => setEditingPiece(null)}
          onSave={handleSaveEdit}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="border-b border-border/50 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Link href={`/campaigns/${campaignId}`}>
              <button className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                <ChevronLeft className="h-3 w-3" />Campanha
              </button>
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                <h1 className="text-2xl font-mono uppercase tracking-tighter font-bold">Aprovação de Conteúdo</h1>
              </div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {campaign?.title ?? "Campanha"} · {pieces.length} peças · {pct}% aprovadas
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {pendingCount > 0 && (
                <Button onClick={handleApproveAll} className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprovar Tudo ({pendingCount})
                </Button>
              )}
              {approvedCount === pieces.length && (
                <Link href={`/campaigns/${campaignId}`}>
                  <Button className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
                    <Send className="h-3.5 w-3.5" />Lançar Campanha
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 bg-muted/20 relative overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-500"
                style={{ width: `${pct}%`, boxShadow: "0 0 8px hsl(var(--success)/0.5)" }}
              />
            </div>
            <div className="flex gap-4 text-[11px] font-mono uppercase tracking-widest">
              <span className="text-success">{approvedCount} aprovadas</span>
              <span className="text-muted-foreground/50">{pendingCount} pendentes</span>
              {rejectedCount > 0 && <span className="text-destructive">{rejectedCount} rejeitadas</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border border-border/50 bg-card/40 p-1 w-fit overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
              >
                <Icon className="h-3 w-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Platform Tab ── */}
        {activeTab === "platform" && (
          <div className="space-y-8">
            {Object.entries(byPlatform).map(([platform, platformPieces]) => {
              const PIcon = PLATFORM_ICON[platform] ?? Globe;
              const pColor = PLATFORM_COLOR[platform] ?? "text-muted-foreground border-border/40";
              return (
                <div key={platform}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 border flex items-center justify-center ${pColor}`}>
                      <PIcon className="h-3 w-3" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">{PLATFORM_LABEL[platform]}</span>
                    <span className="font-mono text-[11px] text-muted-foreground/50">
                      {platformPieces.filter(p => p.status === "approved").length}/{platformPieces.length} aprovadas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {platformPieces.map(piece => (
                      <ContentCard
                        key={piece.id}
                        piece={piece}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onEdit={setEditingPiece}
                        onAiRewrite={handleAiRewrite}
                        loading={loadingPiece}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Schedule Tab ── */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            {days.map(day => {
              const dayPieces = byDay[day];
              const phaseLabel =
                day === 0 ? "Pré-Lançamento — Antecipação" :
                day <= 2  ? "Pré-Lançamento — Conteúdo de Valor" :
                day <= 4  ? "Pré-Lançamento — Autoridade" :
                day === 5 ? "🚀 Abertura do Carrinho" :
                day === 7 ? "⚡ Fechamento — Urgência Máxima" :
                            `Dia ${day}`;
              return (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-xs text-primary">{day}</span>
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold uppercase tracking-widest">{phaseLabel}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/50">{dayPieces.length} peça{dayPieces.length !== 1 ? "s" : ""} programada{dayPieces.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayPieces.map(piece => (
                      <ContentCard
                        key={piece.id}
                        piece={piece}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onEdit={setEditingPiece}
                        onAiRewrite={handleAiRewrite}
                        loading={loadingPiece}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Segmentation Tab ── */}
        {activeTab === "segmentation" && (
          <div className="space-y-8">
            {Object.entries(bySegment).map(([segment, segPieces]) => (
              <div key={segment}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={`rounded-none font-mono text-xs px-2 py-1 uppercase tracking-widest ${SEGMENT_COLOR[segment]}`}>
                    {SEGMENT_LABEL[segment] ?? segment}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground/50">
                    {segPieces.length} peça{segPieces.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {segPieces.map(piece => (
                    <ContentCard
                      key={piece.id}
                      piece={piece}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onEdit={setEditingPiece}
                      onAiRewrite={handleAiRewrite}
                      loading={loadingPiece}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
