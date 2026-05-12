import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ChevronLeft, Sparkles, Edit3,
  Instagram, Mail, MessageSquare, Globe, Calendar,
  Users, Loader2, Send, ArrowRight, Eye,
  BarChart3, Music2, ChevronRight, TrendingUp,
  Zap, Target, Activity, PlayCircle,
} from "lucide-react";
import { SocialPostPreview, estimatePostMetrics } from "@/components/social-post-preview";
import type { PreviewPiece } from "@/components/social-post-preview";

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "facebook" | "tiktok" | "email" | "whatsapp" | "landing" | "ads";
type PieceType = "post" | "story" | "reel" | "native_video" | "email" | "message" | "ad" | "copy";
type Status = "pending" | "approved" | "rejected" | "edited";
type Segment = "hot" | "warm" | "cold" | "all";

interface ContentPiece extends PreviewPiece {
  id: string;
  platform: Platform;
  type: PieceType;
  dayIndex: number;
  title: string;
  body: string;
  callToAction?: string;
  status: Status;
  segment?: Segment;
  estimatedReach?: number;
  estimatedCost?: number;
  tiktokHook?: string;
  visualDirection?: string;
  hashtags?: string[];
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

const PLATFORM_ICON: Record<Platform, React.ElementType> = {
  instagram: Instagram, facebook: Globe, tiktok: Music2,
  email: Mail, whatsapp: MessageSquare, landing: Globe, ads: BarChart3,
};
const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  email: "E-mail", whatsapp: "WhatsApp", landing: "Landing Page", ads: "Ads",
};
const PLATFORM_COLOR: Record<Platform, string> = {
  instagram: "text-pink-400 border-pink-400/40 bg-pink-400/10",
  facebook: "text-indigo-400 border-indigo-400/40 bg-indigo-400/10",
  tiktok: "text-red-400 border-red-400/40 bg-red-400/10",
  email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
  landing: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  ads: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
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

// ── Mock content generator ─────────────────────────────────────────────────────

function generateMockPlan(campaignTitle: string): ContentPlan {
  const pieces: ContentPiece[] = [
    // Day 0 — Antecipação
    {
      id: "1", platform: "instagram", type: "post", dayIndex: 0,
      title: "Teaser de Lançamento", status: "pending", segment: "all", estimatedReach: 1600,
      visualDirection: "Fundo dark com partículas de luz dourada, texto 'Algo grande está chegando' em fonte bold",
      hashtags: ["#lançamento", "#digital", "#empreendedorismo", "#resultado"],
      body: "Algo grande está chegando. 🔥\n\nDurante os próximos 7 dias vou revelar o método que me ajudou a sair do zero para os 6 dígitos em um único lançamento.\n\nSiga de perto. Não vai querer perder isso.",
      callToAction: "Ative as notificações agora",
    },
    {
      id: "2", platform: "facebook", type: "post", dayIndex: 0,
      title: "Teaser Facebook — Pré-Lançamento", status: "pending", segment: "all", estimatedReach: 2800,
      visualDirection: "Arte clean com logo e countdown até o lançamento",
      body: "Nos próximos 7 dias, vou compartilhar tudo que aprendi nos últimos 3 anos trabalhando com lançamentos digitais.\n\nSe você quer aprender a vender mais no digital — fica aqui comigo essa semana.\n\nSalva esse post e ativa as notificações 🔔",
      callToAction: "Curtir para acompanhar",
    },
    {
      id: "3", platform: "tiktok", type: "native_video", dayIndex: 0,
      title: "TikTok Gancho — Revelar Segredo", status: "pending", segment: "all", estimatedReach: 8400,
      tiktokHook: "POV: você vai descobrir o que separa os lançamentos de 6 dígitos dos que não vendem",
      visualDirection: "Vídeo vertical, rosto na câmera, ambiente profissional desfocado, corte dinâmico a cada 3 segundos",
      body: "POV: você vai descobrir o que separa os lançamentos de 6 dígitos dos que não vendem nada.\n\nFica aqui essa semana que eu vou te contar tudo.\n\n#lancamento #marketing #digital #resultado",
      callToAction: "Seguir para ver o próximo",
    },
    {
      id: "4", platform: "email", type: "email", dayIndex: 0,
      title: "Algo está chegando (abertura da lista)", status: "pending", segment: "all",
      body: "Olá {nome},\n\nNos próximos 7 dias vou compartilhar algo que mudou completamente minha forma de trabalhar com lançamentos digitais.\n\nFique de olho na sua caixa de entrada — cada email vai valer.\n\nAté logo,\n{nome_do_produtor}",
      callToAction: "Confirmar que recebeu →",
    },

    // Day 1 — Autoridade
    {
      id: "5", platform: "instagram", type: "story", dayIndex: 1,
      title: "Story — Prova Social Dia 1", status: "pending", segment: "all", estimatedReach: 900,
      body: "Você sabia que 87% dos lançamentos falham por falta de estratégia?\n\nNos últimos 3 anos trabalhei com +200 produtores. Vi os que venderam e os que não venderam.\n\nAmanhã conto o que separa os dois.",
      callToAction: "Swipe up →",
    },
    {
      id: "6", platform: "whatsapp", type: "message", dayIndex: 1,
      title: "Aquecimento — Lista VIP", status: "pending", segment: "hot", estimatedReach: 340,
      body: "Oi {nome} 👋\n\nAmanhã começa algo especial. Você está na lista VIP, então vai receber em primeira mão.\n\nPrepara o café e fica de olho amanhã cedo.",
    },
    {
      id: "7", platform: "tiktok", type: "native_video", dayIndex: 1,
      title: "TikTok — Erro Que Quase Me Quebrou", status: "pending", segment: "all", estimatedReach: 12000,
      tiktokHook: "Eu perdi R$47.000 em um lançamento. Aqui está o que aprendi",
      visualDirection: "Talking head sério, cortes rápidos, números em tela (R$47.000, R$3.200), fundo de escritório",
      body: "Eu perdi R$47.000 em um lançamento. Aqui está o que aprendi:\n\n1. Tráfego sem aquecimento = desperdício\n2. Oferta sem contexto = sem venda\n3. Estratégia sem dados = aposta\n\nNo próximo vídeo: como corrigir cada um deles 👇",
    },

    // Day 2 — Conteúdo de Valor
    {
      id: "8", platform: "instagram", type: "post", dayIndex: 2,
      title: "Carrossel — Os 3 Pilares do Lançamento", status: "pending", segment: "all", estimatedReach: 2100,
      visualDirection: "Carrossel com 6 slides, fundo escuro com gradiente roxo, ícones minimalistas por pilar",
      hashtags: ["#estrategia", "#lancamento", "#marketing", "#empreendedorismo", "#vendas"],
      body: "Slide 1: Os 3 pilares de todo lançamento que passa dos 6 dígitos\n\nSlide 2: Pilar 1 — Audiência Aquecida\n→ Sem audiência preparada, qualquer oferta falha\n\nSlide 3: Pilar 2 — Prova de Transformação\n→ Resultados reais de alunos valem mais que qualquer argumento\n\nSlide 4: Pilar 3 — Momento de Decisão\n→ Criar o contexto certo para a compra acontecer\n\nSlide 5: Qual deles você está ignorando?\n\nSlide 6: Comenta aqui 👇",
      callToAction: "Salva para consultar depois",
    },
    {
      id: "9", platform: "email", type: "email", dayIndex: 2,
      title: "O Erro que Quase Me Quebrou (Conteúdo)", status: "approved", segment: "warm",
      body: "Olá {nome},\n\nEm 2021 eu investi R$ 47.000 em tráfego para um lançamento que vendeu R$ 3.200.\n\nEu errei na estratégia. Hoje eu conto o que aprendi com isso — e como você pode evitar o mesmo caminho.\n\n[Ler o artigo completo]\n\nNos vemos amanhã,\n{nome}",
      callToAction: "Ler o método completo →",
    },
    {
      id: "10", platform: "facebook", type: "post", dayIndex: 2,
      title: "Facebook — Carrossel Os 3 Pilares", status: "pending", segment: "all", estimatedReach: 3200,
      visualDirection: "Post com link para artigo, imagem de destaque com os 3 pilares listados visualmente",
      body: "Depois de trabalhar em mais de 200 lançamentos, identifiquei os 3 pilares que separam quem bate 6 dígitos de quem não vende.\n\nEscrevi um artigo completo com cada um deles:\n\n✅ Audiência Aquecida\n✅ Prova de Transformação  \n✅ Momento de Decisão\n\nQual desses pilares você sente que ainda está fraco no seu negócio? Comenta abaixo 👇",
    },

    // Day 3 — TikTok Viral
    {
      id: "11", platform: "tiktok", type: "native_video", dayIndex: 3,
      title: "TikTok — Quanto Ganha Um Lançamento Digital?", status: "pending", segment: "all", estimatedReach: 18000,
      tiktokHook: "Quanto dá para faturar em um lançamento digital? A resposta vai te surpreender",
      visualDirection: "Talking head com tela dividida mostrando números reais, animação de crescimento, música motivacional de fundo",
      body: "Quanto dá para faturar em um lançamento digital? A resposta vai te surpreender.\n\nR$10k? R$50k? R$500k?\n\nDepende de 3 variáveis que vou revelar no próximo vídeo.\n\nSalva esse e me segue para não perder 👆",
    },
    {
      id: "12", platform: "instagram", type: "reel", dayIndex: 3,
      title: "Reels — Fórmula do Lançamento de 6 Dígitos", status: "pending", segment: "all", estimatedReach: 4200,
      tiktokHook: "A fórmula exata que usei para faturar 6 dígitos em 7 dias",
      visualDirection: "Reel dinâmico, cortes rápidos, texto animado na tela, fundo com gradiente premium",
      hashtags: ["#reels", "#lancamento", "#empreendedor", "#faturamento", "#digital"],
      body: "A fórmula exata que usei para faturar 6 dígitos em 7 dias:\n\nDia 1-2: Antecipação + Curiosidade\nDia 3-4: Conteúdo de Valor + Autoridade\nDia 5: Abertura do Carrinho\nDia 6: Meio do Carrinho (Prova)\nDia 7: Fechamento com Urgência\n\nSalva esse Reel! 📌",
    },

    // Day 5 — Abertura do Carrinho
    {
      id: "13", platform: "email", type: "email", dayIndex: 5,
      title: "🚀 ABRIU — Acesso Liberado", status: "pending", segment: "hot",
      body: "Olá {nome},\n\n✅ O acesso acabou de abrir.\n\nSe você acompanhou tudo essa semana, sabe que esse método muda o jogo.\n\nMas o preço de lançamento fecha em 72h.\n\n[QUERO MEU ACESSO AGORA →]",
      callToAction: "Garantir acesso →",
    },
    {
      id: "14", platform: "instagram", type: "post", dayIndex: 5,
      title: "Instagram — Abertura Oficial do Carrinho", status: "pending", segment: "all", estimatedReach: 3800,
      visualDirection: "Arte impactante com 'ABRIU' em destaque, cores vibrantes verde e dourado, elementos de countdown",
      hashtags: ["#abriu", "#lancamento", "#oportunidade", "#resultado", "#agora"],
      body: "🚀 ABRIU.\n\nDepois de uma semana de conteúdo, você já sabe o que esse método pode fazer pelo seu lançamento.\n\nAgora é a hora de agir.\n\n⚡ Preço de lançamento válido por 72h\n✅ Acesso imediato\n🔒 Garantia de 7 dias\n\nLink na bio 👆",
      callToAction: "Link na bio →",
    },
    {
      id: "15", platform: "facebook", type: "ad", dayIndex: 5,
      title: "Facebook Ads — Retargeting Abertura", status: "pending", segment: "warm", estimatedReach: 4500, estimatedCost: 25000,
      visualDirection: "Criativo de anúncio com urgência: timer countdown, depoimento em destaque, CTA em laranja",
      body: "Você viu o conteúdo dessa semana.\nAgora é a hora de agir.\n\n🔥 {nome_do_produto} está com preço de lançamento.\nEsse preço não vai se repetir.\n\n✅ Acesso imediato\n✅ Garantia de 7 dias\n⚡ Só até domingo à meia-noite\n\n[Garantir minha vaga →]",
      callToAction: "Garantir minha vaga →",
    },
    {
      id: "16", platform: "tiktok", type: "native_video", dayIndex: 5,
      title: "TikTok — Abertura Urgência", status: "pending", segment: "all", estimatedReach: 22000,
      tiktokHook: "Acabou de abrir. 72 horas para pegar pelo preço de lançamento",
      visualDirection: "Talking head animado, elementos de urgência (timer, emoji de foguete), cortes super rápidos",
      body: "Acabou de abrir. 72 horas para pegar pelo preço de lançamento.\n\nDepois disso, o preço sobe.\n\nLink na bio se você quer entrar agora 🔥\n\n#abriu #lancamento #agora #resultado",
    },
    {
      id: "17", platform: "whatsapp", type: "message", dayIndex: 5,
      title: "WhatsApp — Abertura VIP", status: "pending", segment: "hot", estimatedReach: 340,
      body: "🚀 {nome}!\n\nO acesso acabou de abrir.\n\nComo você está na lista VIP, você tem prioridade. Mas o preço de lançamento é por tempo limitado.\n\n👇 Acesse agora:\n[LINK]",
      callToAction: "Acessar agora",
    },

    // Day 7 — Fechamento
    {
      id: "18", platform: "whatsapp", type: "message", dayIndex: 7,
      title: "Último Dia — Urgência VIP", status: "pending", segment: "hot", estimatedReach: 340,
      body: "⚠️ {nome}, faltam só 4h.\n\nO preço de lançamento fecha à meia-noite de hoje.\n\nDepois disso só entra quem pagar o preço cheio (50% mais caro).\n\nSe você quer entrar, agora é a hora 👇\n[LINK]",
    },
    {
      id: "19", platform: "email", type: "email", dayIndex: 7,
      title: "Último aviso — Fecha à meia-noite", status: "pending", segment: "cold",
      body: "Olá {nome},\n\nEssa é minha última mensagem sobre {nome_do_produto}.\n\nÀ meia-noite de hoje o preço sobe.\n\nSe você chegou até aqui, sabe que esse método funciona. Agora é com você.\n\n[QUERO ENTRAR — ÚLTIMAS HORAS →]",
      callToAction: "Último acesso →",
    },
    {
      id: "20", platform: "tiktok", type: "native_video", dayIndex: 7,
      title: "TikTok — Última Chance", status: "pending", segment: "all", estimatedReach: 15000,
      tiktokHook: "Fecha em 4 horas. Última chance de entrar pelo preço de lançamento",
      visualDirection: "Timer na tela contando regressivamente, expressão séria de urgência real, ambiente dimmed",
      body: "Fecha em 4 horas. Última chance de entrar pelo preço de lançamento.\n\nDepois disso o preço sobe e não volta mais.\n\nLink na bio se você ainda não entrou.\n\n#fechamento #ultimachance #lancamento",
    },
    {
      id: "21", platform: "instagram", type: "story", dayIndex: 7,
      title: "Story — Countdown Final 4h", status: "pending", segment: "all", estimatedReach: 1100,
      body: "⚡ FECHA EM 4H\n\nSe você está esperando o momento certo, esse é ele.\n\nSwipe up e garanta agora →",
      callToAction: "Swipe up — últimas horas",
    },
  ];

  const pending  = pieces.filter(p => p.status === "pending").length;
  const approved = pieces.filter(p => p.status === "approved").length;

  return {
    campaignId: "mock", campaignTitle,
    campaignStatus: "awaiting_approval",
    totalPieces: pieces.length, approved, rejected: 0, pending,
    pieces,
  };
}

// ── Flowchart Phase Data ───────────────────────────────────────────────────────

interface Phase {
  id: string;
  label: string;
  dayRange: string;
  days: number[];
  objective: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
}

const PHASES: Phase[] = [
  { id: "anticipation", label: "Antecipação", dayRange: "Dia 0", days: [0], objective: "Gerar curiosidade e ativar notificações", icon: Sparkles, color: "text-purple-400", borderColor: "border-purple-400/50", bgColor: "bg-purple-400/10" },
  { id: "authority", label: "Autoridade", dayRange: "Dia 1–2", days: [1, 2], objective: "Construir credibilidade e entregar valor", icon: TrendingUp, color: "text-blue-400", borderColor: "border-blue-400/50", bgColor: "bg-blue-400/10" },
  { id: "desire", label: "Desejo", dayRange: "Dia 3–4", days: [3, 4], objective: "Ampliar desejo e mostrar transformação", icon: Target, color: "text-orange-400", borderColor: "border-orange-400/50", bgColor: "bg-orange-400/10" },
  { id: "cart_open", label: "🚀 Abertura", dayRange: "Dia 5", days: [5], objective: "Abrir carrinho — VIPs + retargeting ads", icon: Zap, color: "text-success", borderColor: "border-success/50", bgColor: "bg-success/10" },
  { id: "midcart", label: "Meio Carrinho", dayRange: "Dia 6", days: [6], objective: "Superar objeções com provas sociais", icon: Activity, color: "text-yellow-400", borderColor: "border-yellow-400/50", bgColor: "bg-yellow-400/10" },
  { id: "close", label: "⚡ Fechamento", dayRange: "Dia 7", days: [7], objective: "Urgência máxima — últimas horas", icon: Target, color: "text-red-400", borderColor: "border-red-400/50", bgColor: "bg-red-400/10" },
];

// ── Campaign Flowchart Component ───────────────────────────────────────────────

function CampaignFlowchart({ pieces }: { pieces: ContentPiece[] }) {
  const totalReach = pieces.reduce((sum, p) => sum + estimatePostMetrics(p).reach, 0);
  const totalLeads = pieces.reduce((sum, p) => sum + estimatePostMetrics(p).leads, 0);

  function fmtNum(n: number) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Peças de Conteúdo", value: String(pieces.length), color: "text-primary" },
          { label: "Alcance Total Estimado", value: fmtNum(totalReach), color: "text-cyan-400" },
          { label: "Leads Esperados", value: fmtNum(totalLeads), color: "text-success" },
          { label: "Plataformas Ativas", value: String(new Set(pieces.map(p => p.platform)).size), color: "text-purple-400" },
        ].map(k => (
          <div key={k.label} className="border border-border/50 bg-card/40 p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{k.label}</div>
            <div className={`font-mono text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Phase flowchart */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-0 min-w-max">
          {PHASES.map((phase, idx) => {
            const phasePieces = pieces.filter(p => phase.days.includes(p.dayIndex));
            const phaseReach = phasePieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
            const phaseLeads = phasePieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
            const platforms = [...new Set(phasePieces.map(p => p.platform))];
            const Icon = phase.icon;

            return (
              <div key={phase.id} className="flex items-center">
                <div className={`border ${phase.borderColor} ${phase.bgColor} p-4 w-44 space-y-3 flex-shrink-0 relative`}>
                  {/* Phase header */}
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 border ${phase.borderColor} flex items-center justify-center ${phase.bgColor} shrink-0`}>
                      <Icon className={`h-3 w-3 ${phase.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`font-mono text-[11px] font-bold uppercase tracking-widest ${phase.color} leading-tight`}>
                        {phase.label}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-widest">{phase.dayRange}</div>
                    </div>
                  </div>

                  {/* Objective */}
                  <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                    {phase.objective}
                  </div>

                  {/* Piece count + metrics */}
                  {phasePieces.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] text-foreground/70">
                        <span className={`font-bold ${phase.color}`}>{phasePieces.length}</span> peça{phasePieces.length !== 1 ? "s" : ""}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">
                        Alcance: <span className="text-cyan-400">{fmtNum(phaseReach)}</span>
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">
                        Leads: <span className="text-success">{fmtNum(phaseLeads)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-muted-foreground/40 italic">Sem conteúdo</div>
                  )}

                  {/* Platform icons */}
                  {platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {platforms.map(platform => {
                        const PIcon = PLATFORM_ICON[platform];
                        const pColor = PLATFORM_COLOR[platform];
                        return (
                          <div key={platform} className={`w-5 h-5 border flex items-center justify-center ${pColor}`} title={PLATFORM_LABEL[platform]}>
                            <PIcon className="h-2.5 w-2.5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Arrow connector */}
                {idx < PHASES.length - 1 && (
                  <div className="flex items-center mx-0.5 shrink-0">
                    <div className="w-6 h-px bg-border/50" />
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 -ml-1.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform breakdown table */}
      <div className="border border-border/50 bg-card/40">
        <div className="px-4 py-3 border-b border-border/50">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Breakdown por Plataforma</span>
        </div>
        <div className="divide-y divide-border/30">
          {(["instagram", "facebook", "tiktok", "email", "whatsapp", "ads"] as Platform[]).map(platform => {
            const platformPieces = pieces.filter(p => p.platform === platform);
            if (platformPieces.length === 0) return null;
            const PIcon = PLATFORM_ICON[platform];
            const pColor = PLATFORM_COLOR[platform];
            const reach = platformPieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
            const leads = platformPieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
            const avgEng = Math.round(
              platformPieces.reduce((s, p) => s + estimatePostMetrics(p).engagementRate, 0) / platformPieces.length
            );
            return (
              <div key={platform} className="flex items-center gap-4 px-4 py-2.5">
                <div className={`w-6 h-6 border flex items-center justify-center shrink-0 ${pColor}`}>
                  <PIcon className="h-3 w-3" />
                </div>
                <span className="font-mono text-xs font-bold w-24 shrink-0">{PLATFORM_LABEL[platform]}</span>
                <span className="font-mono text-[11px] text-muted-foreground/60 w-12">{platformPieces.length} peças</span>
                <div className="flex-1 flex gap-4 flex-wrap">
                  <span className="font-mono text-[11px] text-cyan-400">{fmtNum(reach)} alcance</span>
                  <span className="font-mono text-[11px] text-success">{fmtNum(leads)} leads</span>
                  <span className="font-mono text-[11px] text-primary">{avgEng}% eng</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Content Card (text view) ──────────────────────────────────────────────────

function ContentCard({ piece, onApprove, onReject, onEdit, onAiRewrite, loading }: {
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
  const statusBorder = piece.status === "approved" ? "border-success/40" : piece.status === "rejected" ? "border-destructive/40" : "border-border/50";
  const isLoading = loading === piece.id;
  const m = estimatePostMetrics(piece);

  return (
    <div className={`border bg-card/40 transition-all relative overflow-hidden ${statusBorder}`}>
      <div className={`absolute left-0 inset-y-0 w-[3px] ${piece.status === "approved" ? "bg-success" : piece.status === "rejected" ? "bg-destructive" : "bg-border/30"}`} />
      <div className="pl-4 pr-4 py-3">
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-7 h-7 border rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${platformColor}`}>
            <PlatformIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${platformColor}`}>
                {PLATFORM_LABEL[piece.platform]}
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">Dia {piece.dayIndex}</span>
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

        {/* Hook (TikTok) */}
        {piece.tiktokHook && (
          <div className="mb-2 px-2 py-1 border border-red-400/30 bg-red-400/5">
            <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest">Hook: </span>
            <span className="font-mono text-[11px] text-foreground/80 italic">"{piece.tiktokHook}"</span>
          </div>
        )}

        {/* Visual direction */}
        {piece.visualDirection && (
          <div className="mb-2 px-2 py-1 border border-purple-400/30 bg-purple-400/5">
            <span className="font-mono text-[10px] text-purple-400 uppercase tracking-widest">Visual IA: </span>
            <span className="font-mono text-[11px] text-foreground/70">{piece.visualDirection.slice(0, 80)}...</span>
          </div>
        )}

        <div className={`font-mono text-xs text-muted-foreground bg-muted/10 border border-border/30 p-3 rounded-sm mb-3 whitespace-pre-line leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
          {piece.body}
        </div>
        {piece.body.length > 120 && (
          <button onClick={() => setExpanded(v => !v)} className="font-mono text-[11px] uppercase tracking-widest text-primary hover:text-primary/80 mb-3 flex items-center gap-1">
            {expanded ? "Menos" : "Ver tudo"} <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {piece.callToAction && (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">CTA:</span>
            <span className="font-mono text-xs text-primary border border-primary/30 bg-primary/5 px-2 py-0.5">{piece.callToAction}</span>
          </div>
        )}

        {/* Metrics row */}
        <div className="flex flex-wrap gap-3 mb-3">
          <span className="font-mono text-[10px] text-muted-foreground/50">Alcance <span className="text-cyan-400">{m.reach.toLocaleString("pt-BR")}</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Leads <span className="text-success">~{m.leads}</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Eng. <span className="text-primary">{m.engagementRate}%</span></span>
          <span className="font-mono text-[10px] text-muted-foreground/50">Conv. <span className="text-yellow-400">{m.conversionPct}%</span></span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {piece.status !== "approved" && (
            <Button size="sm" onClick={() => onApprove(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 bg-success/10 border border-success/40 text-success hover:bg-success/20">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Aprovar
            </Button>
          )}
          {piece.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={() => onReject(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
              <XCircle className="h-3 w-3" />Rejeitar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(piece)} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-muted-foreground hover:text-foreground">
            <Edit3 className="h-3 w-3" />Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAiRewrite(piece.id)} disabled={isLoading} className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 text-primary hover:text-primary hover:bg-primary/10">
            <Sparkles className="h-3 w-3" />IA Reescrever
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

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
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Conteúdo</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-3 resize-y text-foreground leading-relaxed" />
          </div>
          {piece.callToAction !== undefined && (
            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Call to Action</label>
              <input value={cta} onChange={e => setCta(e.target.value)} className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-4 py-2 text-foreground" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(piece.id, body, cta)} className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />Salvar e Aprovar
            </Button>
            <Button variant="ghost" onClick={onClose} className="rounded-none font-mono uppercase tracking-widest h-9 text-xs text-muted-foreground">Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API Content Piece (raw from backend) ──────────────────────────────────────

interface ApiContentPiece {
  id: string;
  type: string;
  platform?: string;
  launchPhase?: string;
  mentalTrigger?: string;
  content: string;
  status: string;
  createdAt: string;
}

const TYPE_TO_PLATFORM: Record<string, Platform> = {
  instagram_post: "instagram", instagram_reel: "instagram", instagram_story: "instagram",
  instagram_feed: "instagram", reel: "instagram", story: "instagram",
  tiktok_video: "tiktok", tiktok_reel: "tiktok", native_video: "tiktok",
  facebook_post: "facebook", facebook_ad: "facebook",
  email_campaign: "email", email: "email",
  whatsapp_message: "whatsapp", whatsapp: "whatsapp",
  ad_copy: "ads", meta_ad: "ads", google_ad: "ads",
  landing_page: "landing",
};

const TYPE_TO_PIECE_TYPE: Record<string, PieceType> = {
  instagram_post: "post", instagram_feed: "post", facebook_post: "post",
  instagram_reel: "reel", reel: "reel",
  instagram_story: "story", story: "story",
  tiktok_video: "native_video", tiktok_reel: "native_video", native_video: "native_video",
  email_campaign: "email", email: "email",
  whatsapp_message: "message", whatsapp: "message",
  ad_copy: "ad", meta_ad: "ad", facebook_ad: "ad", google_ad: "ad",
  landing_page: "copy",
};

const PHASE_TO_DAY: Record<string, number> = {
  pre_launch: 0, pre_launch_1: 0, antecipacao: 0, anticipation: 0,
  authority: 1, authority_1: 1, autoridade: 1,
  authority_2: 2, value: 2, conteudo: 2,
  desire: 3, desire_1: 3, desejo: 3,
  desire_2: 4,
  cart_open: 5, abertura: 5,
  cart_middle: 6, meio_carrinho: 6,
  cart_close: 7, fechamento: 7,
};

function mapApiPiece(p: ApiContentPiece, idx: number): ContentPiece {
  const rawType = p.type?.toLowerCase().replace(/\s+/g, "_") ?? "copy";
  const platform = (p.platform as Platform | undefined)
    ?? TYPE_TO_PLATFORM[rawType]
    ?? "instagram";
  const pieceType = TYPE_TO_PIECE_TYPE[rawType] ?? "post";
  const launchKey = p.launchPhase?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const dayIndex = PHASE_TO_DAY[launchKey] ?? (idx % 8);
  const statusMap: Record<string, Status> = { draft: "pending", approved: "approved", rejected: "rejected" };
  return {
    id: p.id,
    platform,
    type: pieceType,
    dayIndex,
    title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} — ${rawType.replace(/_/g, " ")}`,
    body: p.content,
    status: statusMap[p.status] ?? "pending",
    segment: "all",
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Tab = "platform" | "preview" | "flowchart" | "schedule" | "segmentation";

const VISUAL_PLATFORMS: Platform[] = ["instagram", "facebook", "tiktok"];

export default function ContentApproval() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [loadingPiece, setLoadingPiece] = useState<string | null>(null);
  const [localPieces, setLocalPieces] = useState<ContentPiece[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<Platform | "all">("all");

  const [, setLocation] = useLocation();

  const { data: campaignData, isLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}`],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ campaign: { id: string; title: string; status: string } }>;
    },
    enabled: !!campaignId,
  });

  const { data: apiContentData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/content`],
    queryFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content`);
      if (!res.ok) return null;
      return res.json() as Promise<{ pieces: ApiContentPiece[] }>;
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });

  // Transition campaign from awaiting_approval → approved when user approves all content
  const approveCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao aprovar campanha");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Conteúdo aprovado! Campanha pronta para lançamento.");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      setLocation(`/campaigns/${campaignId}`);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao aprovar campanha");
    },
  });

  const campaign = campaignData?.campaign;

  const realPieces: ContentPiece[] | null = apiContentData?.pieces?.length
    ? apiContentData.pieces.map((p, i) => mapApiPiece(p, i))
    : null;

  const basePieces = realPieces ?? generateMockPlan(campaign?.title ?? "Campanha").pieces;
  const plan: ContentPlan = localPieces
    ? { ...generateMockPlan(campaign?.title ?? "Campanha"), pieces: localPieces }
    : {
        ...generateMockPlan(campaign?.title ?? "Campanha"),
        pieces: basePieces,
        totalPieces: basePieces.length,
        approved: basePieces.filter(p => p.status === "approved").length,
        rejected: basePieces.filter(p => p.status === "rejected").length,
        pending: basePieces.filter(p => p.status === "pending").length,
      };

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
    if (realPieces) {
      try {
        const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: "" }),
        });
        if (!res.ok) throw new Error("Erro");
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
        toast.success("Peça aprovada");
      } catch {
        toast.error("Erro ao aprovar peça");
      } finally {
        setLoadingPiece(null);
      }
    } else {
      await new Promise(r => setTimeout(r, 300));
      setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
      setLoadingPiece(null);
      toast.success("Peça aprovada");
    }
  };
  const handleReject = async (id: string) => {
    if (realPieces) {
      try {
        const res = await customFetch<Response>(`/api/campaigns/${campaignId}/content/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: "" }),
        });
        if (!res.ok) throw new Error("Erro");
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
        toast.info("Peça rejeitada");
      } catch {
        toast.error("Erro ao rejeitar peça");
      }
    } else {
      setPieces(prev => prev.map(p => p.id === id ? { ...p, status: "rejected" } : p));
      toast.info("Peça rejeitada");
    }
  };
  const handleAiRewrite = async (id: string) => {
    setLoadingPiece(id);
    toast.info("IA reescrevendo...");
    await new Promise(r => setTimeout(r, 1800));
    setPieces(prev => prev.map(p => p.id !== id ? p : { ...p, body: p.body + "\n\n[Versão reescrita pela IA — clique em Editar para refinar]" }));
    setLoadingPiece(null);
    toast.success("IA reescreveu. Revise e aprove.");
  };
  const handleSaveEdit = (id: string, body: string, cta: string) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, body, callToAction: cta, status: "approved" } : p));
    setEditingPiece(null);
    toast.success("Peça editada e aprovada");
  };
  const handleApproveAll = () => {
    setPieces(prev => prev.map(p => p.status === "pending" ? { ...p, status: "approved" } : p));
    toast.success(`${pendingCount} peças aprovadas`);
  };

  const byPlatform = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    if (!acc[p.platform]) acc[p.platform] = [];
    acc[p.platform].push(p);
    return acc;
  }, {});
  const byDay = pieces.reduce<Record<number, ContentPiece[]>>((acc, p) => {
    if (!acc[p.dayIndex]) acc[p.dayIndex] = [];
    acc[p.dayIndex].push(p);
    return acc;
  }, {});
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const bySegment = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    const seg = p.segment ?? "all";
    if (!acc[seg]) acc[seg] = [];
    acc[seg].push(p);
    return acc;
  }, {});

  // Visual preview: only social platforms that support visual mockups
  const previewPieces = pieces.filter(p =>
    VISUAL_PLATFORMS.includes(p.platform) &&
    (previewFilter === "all" || p.platform === previewFilter)
  );

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 bg-muted/20" />)}</div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "flowchart",    label: "Fluxograma",      icon: Activity },
    { id: "preview",      label: "Preview Visual",  icon: Eye },
    { id: "platform",     label: "Por Plataforma",  icon: Globe },
    { id: "schedule",     label: "Cronograma",      icon: Calendar },
    { id: "segmentation", label: "Segmentação",     icon: Users },
  ];

  return (
    <>
      {editingPiece && (
        <EditModal piece={editingPiece} onClose={() => setEditingPiece(null)} onSave={handleSaveEdit} />
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
                  <CheckCircle2 className="h-3.5 w-3.5" />Aprovar Tudo ({pendingCount})
                </Button>
              )}
              {approvedCount === pieces.length && (
                <Button
                  onClick={() => approveCampaignMutation.mutate()}
                  disabled={approveCampaignMutation.isPending}
                  className="rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-9 text-xs"
                >
                  {approveCampaignMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                  Aprovar e Lançar<ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 bg-muted/20 relative overflow-hidden">
              <div className="h-full bg-success transition-all duration-700" style={{ width: `${pct}%` }} />
              {rejectedCount > 0 && (
                <div className="absolute top-0 right-0 h-full bg-destructive/50 transition-all duration-700"
                     style={{ width: `${Math.round((rejectedCount / pieces.length) * 100)}%` }} />
              )}
            </div>
            <div className="flex gap-4 font-mono text-[10px] text-muted-foreground/50">
              <span className="text-success">{approvedCount} aprovadas</span>
              <span>{pendingCount} pendentes</span>
              {rejectedCount > 0 && <span className="text-destructive">{rejectedCount} rejeitadas</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border border-border/50 bg-card/40 p-1 w-full overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center
                  ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                <Icon className="h-3 w-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Flowchart Tab ── */}
        {activeTab === "flowchart" && (
          <CampaignFlowchart pieces={pieces} />
        )}

        {/* ── Preview Visual Tab ── */}
        {activeTab === "preview" && (
          <div className="space-y-5">
            {/* Platform filter */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground shrink-0">Plataforma:</span>
              {([["all", "Todas", Globe], ["instagram", "Instagram", Instagram], ["facebook", "Facebook", Globe], ["tiktok", "TikTok", Music2]] as [Platform | "all", string, React.ElementType][]).map(([val, label, Icon]) => (
                <button key={val} onClick={() => setPreviewFilter(val)}
                  className={`flex items-center gap-1.5 px-3 h-7 font-mono text-[11px] uppercase tracking-widest border transition-all
                    ${previewFilter === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"}`}>
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
              <span className="font-mono text-[11px] text-muted-foreground/40 ml-2">
                {previewPieces.length} peça{previewPieces.length !== 1 ? "s" : ""} com preview visual
              </span>
            </div>

            {/* Preview grid */}
            {previewPieces.length === 0 ? (
              <div className="text-center py-16 font-mono text-sm text-muted-foreground/40 uppercase tracking-widest">
                Nenhuma peça visual para esta plataforma
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {previewPieces.map(piece => (
                  <SocialPostPreview
                    key={piece.id}
                    piece={piece}
                    showMetrics
                    onApprove={handleApprove}
                    onReject={handleReject}
                    loading={loadingPiece}
                  />
                ))}
              </div>
            )}

            {/* Non-visual platforms notice */}
            {previewFilter === "all" && (
              <div className="border border-border/30 bg-muted/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
                    E-mail, WhatsApp e Ads
                  </span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  {pieces.filter(p => !VISUAL_PLATFORMS.includes(p.platform)).length} peças de e-mail, WhatsApp e Ads estão disponíveis na aba "Por Plataforma" com aprovação individual.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Platform Tab ── */}
        {activeTab === "platform" && (
          <div className="space-y-8">
            {Object.entries(byPlatform).map(([platform, platformPieces]) => {
              const PIcon = PLATFORM_ICON[platform as Platform] ?? Globe;
              const pColor = PLATFORM_COLOR[platform as Platform] ?? "text-muted-foreground border-border/40";
              return (
                <div key={platform}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 border flex items-center justify-center ${pColor}`}><PIcon className="h-3 w-3" /></div>
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">{PLATFORM_LABEL[platform as Platform]}</span>
                    <span className="font-mono text-[11px] text-muted-foreground/50">
                      {platformPieces.filter(p => p.status === "approved").length}/{platformPieces.length} aprovadas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {platformPieces.map(piece => (
                      <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
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
              const dayPieces = byDay[day]!;
              const phaseLabel =
                day === 0 ? "Pré-Lançamento — Antecipação" :
                day <= 2  ? "Pré-Lançamento — Autoridade" :
                day <= 4  ? "Pré-Lançamento — Desejo" :
                day === 5 ? "🚀 Abertura do Carrinho" :
                day === 6 ? "Meio do Carrinho — Prova Social" :
                day === 7 ? "⚡ Fechamento — Urgência Máxima" :
                `Dia ${day}`;
              const phaseReach = dayPieces.reduce((s, p) => s + estimatePostMetrics(p).reach, 0);
              const phaseLeads = dayPieces.reduce((s, p) => s + estimatePostMetrics(p).leads, 0);
              return (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-xs text-primary">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold uppercase tracking-widest">{phaseLabel}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="font-mono text-[11px] text-muted-foreground/50">{dayPieces.length} peça{dayPieces.length !== 1 ? "s" : ""}</span>
                        <span className="font-mono text-[11px] text-cyan-400/70">~{phaseReach.toLocaleString("pt-BR")} alcance</span>
                        <span className="font-mono text-[11px] text-success/70">~{phaseLeads} leads</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayPieces.map(piece => (
                      <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
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
                  <Badge variant="outline" className={`rounded-none font-mono text-xs px-2 py-1 uppercase tracking-widest ${SEGMENT_COLOR[segment] ?? ""}`}>
                    {SEGMENT_LABEL[segment] ?? segment}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground/50">{segPieces.length} peça{segPieces.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {segPieces.map(piece => (
                    <ContentCard key={piece.id} piece={piece} onApprove={handleApprove} onReject={handleReject} onEdit={setEditingPiece} onAiRewrite={handleAiRewrite} loading={loadingPiece} />
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
